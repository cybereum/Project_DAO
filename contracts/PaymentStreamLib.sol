// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title PaymentStreamLib — Recurring payment streams
 * @notice External library holding stream creation, balance calculation,
 *         withdrawal, and cancellation logic. The main contract enforces
 *         authorization and fee collection; this library handles validation,
 *         mutation, and event emission.
 */
library PaymentStreamLib {
    enum StreamStatus { Active, Paused, Cancelled, Completed }

    struct PaymentStream {
        uint256 id;
        address payer;
        address recipient;
        uint256 ratePerSecond;
        uint256 totalDeposited;
        uint256 totalWithdrawn;
        uint256 startTime;
        uint256 stopTime;
        StreamStatus status;
    }

    struct Store {
        uint256 currentId;
        mapping(uint256 => PaymentStream) streams;
        mapping(address => uint256) activeCount;
        // Reserved for future fields — storage-gap pattern.
        uint256[50] __gap;
    }

    event PaymentStreamCreated(uint256 indexed streamId, address indexed payer, address indexed recipient, uint256 ratePerSecond, uint256 totalDeposit, uint256 startTime, uint256 stopTime);
    event PaymentStreamWithdrawn(uint256 indexed streamId, address indexed recipient, uint256 amount);
    event PaymentStreamCancelled(uint256 indexed streamId, address indexed cancelledBy, uint256 recipientAmount, uint256 payerRefund);

    /// @notice Create a payment stream. Returns (streamId, adjustedDeposit).
    /// @dev Caller must validate agent registration and debit escrow.
    function create(
        Store storage self,
        address payer,
        address recipient,
        uint256 totalDeposit,
        uint256 startTime,
        uint256 stopTime
    ) external returns (uint256 streamId, uint256 adjustedDeposit) {
        require(recipient != payer, "Cannot stream to yourself.");
        require(totalDeposit > 0, "Deposit must be greater than zero.");
        require(stopTime > startTime, "Stop time must be after start time.");
        require(startTime >= block.timestamp, "Start time must be now or in the future.");

        uint256 duration = stopTime - startTime;
        uint256 ratePerSecond = totalDeposit / duration;
        require(ratePerSecond > 0, "Rate per second too low - increase deposit or shorten duration.");

        // Adjust to exact multiple of rate to avoid dust
        adjustedDeposit = ratePerSecond * duration;
        self.activeCount[payer]++;
        self.activeCount[recipient]++;

        streamId = self.currentId++;
        self.streams[streamId] = PaymentStream({
            id: streamId,
            payer: payer,
            recipient: recipient,
            ratePerSecond: ratePerSecond,
            totalDeposited: adjustedDeposit,
            totalWithdrawn: 0,
            startTime: startTime,
            stopTime: stopTime,
            status: StreamStatus.Active
        });

        emit PaymentStreamCreated(streamId, payer, recipient, ratePerSecond, adjustedDeposit, startTime, stopTime);
    }

    /// @notice Calculate how much the recipient can currently withdraw.
    function balanceOf(Store storage self, uint256 streamId) public view returns (uint256) {
        PaymentStream storage s = self.streams[streamId];
        if (s.id == 0 || s.status == StreamStatus.Cancelled) return 0;

        uint256 elapsed;
        if (block.timestamp >= s.stopTime) {
            elapsed = s.stopTime - s.startTime;
        } else if (block.timestamp > s.startTime) {
            elapsed = block.timestamp - s.startTime;
        } else {
            elapsed = 0;
        }

        uint256 earned = elapsed * s.ratePerSecond;
        return earned > s.totalWithdrawn ? earned - s.totalWithdrawn : 0;
    }

    /// @notice Recipient withdraws accrued funds. Returns (available, isCompleted, payer, recipient).
    /// @dev Caller must handle fee collection and escrow credit.
    function withdraw(Store storage self, uint256 streamId, address caller)
        external returns (uint256 available, bool isCompleted, address payer, address recipient)
    {
        PaymentStream storage s = self.streams[streamId];
        require(s.id > 0, "Stream not found.");
        require(s.recipient == caller, "Only the recipient can withdraw.");
        require(s.status == StreamStatus.Active, "Stream is not active.");

        // Inline balance calc to avoid redundant SLOAD from balanceOf
        uint256 elapsed;
        if (block.timestamp >= s.stopTime) {
            elapsed = s.stopTime - s.startTime;
        } else if (block.timestamp > s.startTime) {
            elapsed = block.timestamp - s.startTime;
        }
        available = elapsed * s.ratePerSecond;
        available = available > s.totalWithdrawn ? available - s.totalWithdrawn : 0;
        require(available > 0, "No funds available to withdraw.");

        s.totalWithdrawn += available;

        // Auto-complete if fully withdrawn
        if (s.totalWithdrawn >= s.totalDeposited) {
            s.status = StreamStatus.Completed;
            self.activeCount[s.payer]--;
            self.activeCount[s.recipient]--;
            isCompleted = true;
        }

        return (available, isCompleted, s.payer, s.recipient);
    }

    /// @notice Cancel a stream. Returns (recipientAmount, payerRefund, payer, recipient).
    /// @dev Caller must handle fee collection and escrow credits.
    function cancel(Store storage self, uint256 streamId, address caller)
        external returns (uint256 recipientAmount, uint256 payerRefund, address payer, address recipient)
    {
        PaymentStream storage s = self.streams[streamId];
        require(s.id > 0, "Stream not found.");
        require(s.status == StreamStatus.Active, "Stream is not active.");
        require(caller == s.payer || caller == s.recipient, "Not a party to this stream.");

        // Calculate accrued amount BEFORE changing status (balanceOf returns 0 if Cancelled)
        recipientAmount = balanceOf(self, streamId);
        payerRefund = s.totalDeposited - s.totalWithdrawn - recipientAmount;

        s.status = StreamStatus.Cancelled;
        self.activeCount[s.payer]--;
        self.activeCount[s.recipient]--;

        if (recipientAmount > 0) {
            s.totalWithdrawn += recipientAmount;
        }

        payer = s.payer;
        recipient = s.recipient;
    }

    // ─── View Functions ────────────────────────────────────────────────────

    function getStream(Store storage self, uint256 streamId) external view returns (
        uint256 id, address payer, address recipient, uint256 ratePerSecond,
        uint256 totalDeposited, uint256 totalWithdrawn, uint256 startTime,
        uint256 stopTime, StreamStatus status, uint256 withdrawable
    ) {
        PaymentStream storage s = self.streams[streamId];
        return (s.id, s.payer, s.recipient, s.ratePerSecond, s.totalDeposited, s.totalWithdrawn,
                s.startTime, s.stopTime, s.status, balanceOf(self, streamId));
    }
}
