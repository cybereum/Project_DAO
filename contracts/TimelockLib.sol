// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title TimelockLib — Delayed execution for sensitive operations
 * @notice External library that implements a timelock pattern for critical
 *         owner operations. Changes to treasury address, fee configuration,
 *         and contract pause must be queued and wait a delay period before
 *         execution, giving the community time to react.
 *
 *         The owner queues an operation with a unique ID. After the delay
 *         period elapses, the same owner can execute it. Operations expire
 *         after the grace period if not executed.
 */
library TimelockLib {
    struct TimelockOp {
        bytes32  id;         // keccak256 of the operation parameters
        uint256  readyTime;  // block.timestamp after which it can execute
        uint256  expiresAt;  // block.timestamp after which it's invalid
        bool     executed;
        bool     cancelled;
    }

    struct Store {
        uint256 delay;       // seconds to wait after queueing (default 24h)
        uint256 gracePeriod; // seconds after readyTime to execute (default 48h)
        mapping(bytes32 => TimelockOp) operations;
        // Reserved for future fields — storage-gap pattern.
        uint256[50] __gap;
    }

    event TimelockQueued(bytes32 indexed opId, uint256 readyTime, uint256 expiresAt);
    event TimelockExecuted(bytes32 indexed opId);
    event TimelockCancelled(bytes32 indexed opId);
    event TimelockDelayUpdated(uint256 newDelay);

    uint256 internal constant MIN_DELAY = 1 hours;
    uint256 internal constant MAX_DELAY = 30 days;

    /// @notice Queue an operation for future execution.
    function queue(Store storage self, bytes32 opId) external returns (uint256 readyTime) {
        require(self.delay > 0, "Timelock not initialized.");
        TimelockOp storage op = self.operations[opId];
        require(op.id == bytes32(0) || op.executed || op.cancelled, "Operation already pending.");

        readyTime = block.timestamp + self.delay;
        uint256 expiresAt = readyTime + self.gracePeriod;

        self.operations[opId] = TimelockOp({
            id: opId,
            readyTime: readyTime,
            expiresAt: expiresAt,
            executed: false,
            cancelled: false
        });

        emit TimelockQueued(opId, readyTime, expiresAt);
    }

    /// @notice Verify an operation is ready for execution. Reverts if not ready.
    function assertReady(Store storage self, bytes32 opId) external view {
        TimelockOp storage op = self.operations[opId];
        require(op.id != bytes32(0), "Operation not queued.");
        require(!op.executed, "Operation already executed.");
        require(!op.cancelled, "Operation was cancelled.");
        require(block.timestamp >= op.readyTime, "Timelock: not ready yet.");
        require(block.timestamp <= op.expiresAt, "Timelock: operation expired.");
    }

    /// @notice Mark an operation as executed.
    function markExecuted(Store storage self, bytes32 opId) external {
        self.operations[opId].executed = true;
        emit TimelockExecuted(opId);
    }

    /// @notice Cancel a pending (not yet executed) operation.
    function cancel(Store storage self, bytes32 opId) external {
        TimelockOp storage op = self.operations[opId];
        require(op.id != bytes32(0), "Operation not queued.");
        require(!op.executed, "Already executed.");
        op.cancelled = true;
        emit TimelockCancelled(opId);
    }

    /// @notice Update the timelock delay. Must be between MIN_DELAY and MAX_DELAY.
    function setDelay(Store storage self, uint256 newDelay) external {
        require(newDelay >= MIN_DELAY, "Delay below minimum (1 hour).");
        require(newDelay <= MAX_DELAY, "Delay exceeds maximum (30 days).");
        self.delay = newDelay;
        emit TimelockDelayUpdated(newDelay);
    }

    /// @notice Get the status of a timelocked operation.
    function getOperation(Store storage self, bytes32 opId) external view returns (
        bytes32 id, uint256 readyTime, uint256 expiresAt, bool executed, bool cancelled
    ) {
        TimelockOp storage op = self.operations[opId];
        return (op.id, op.readyTime, op.expiresAt, op.executed, op.cancelled);
    }
}
