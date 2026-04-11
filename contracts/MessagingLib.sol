// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title MessagingLib — Secure agent direct messaging
 * @notice External library holding the encrypted direct messaging
 *         storage for Project_DAO. The main contract handles the
 *         messaging fee (escrow decrement + treasury transfer) BEFORE
 *         calling the library, and forwards authenticated requests for
 *         store/read/mark operations.
 */
library MessagingLib {
    struct DirectMessage {
        uint256 id;
        address sender;
        address recipient;
        bytes32 contentHash;
        string  encryptedContent;
        uint256 timestamp;
        bool    readByRecipient;
    }

    struct Store {
        uint256 currentDirectMessageId;
        mapping(uint256 => DirectMessage) directMessages;
        // keccak256(min(a,b), max(a,b)) => conversation message IDs
        mapping(bytes32 => uint256[]) conversationIndex;
        // recipient => inbox message IDs
        mapping(address => uint256[]) inbox;
        // Reserved for future fields — storage-gap pattern.
        uint256[50] __gap;
    }

    event DirectMessageSent(
        uint256 indexed messageId,
        address indexed sender,
        address indexed recipient,
        bytes32 contentHash,
        uint256 timestamp
    );
    event DirectMessageRead(uint256 indexed messageId, address indexed recipient);

    function _conversationKey(address a, address b) internal pure returns (bytes32) {
        return a < b
            ? keccak256(abi.encodePacked(a, b))
            : keccak256(abi.encodePacked(b, a));
    }

    /**
     * @notice Validate + store a new direct message.
     *         Authorization (both parties are registered agents) and
     *         any messaging fee collection are the caller's responsibility.
     */
    function sendMessage(
        Store storage self,
        address sender,
        address recipient,
        string calldata encryptedContent,
        bytes32 contentHash
    ) external returns (uint256 id) {
        require(recipient != sender, "Cannot message self.");
        require(bytes(encryptedContent).length > 0, "Message content required.");
        require(contentHash != bytes32(0), "Content hash required.");

        if (self.currentDirectMessageId == 0) {
            self.currentDirectMessageId = 1;
        }
        id = self.currentDirectMessageId++;
        self.directMessages[id] = DirectMessage({
            id:               id,
            sender:           sender,
            recipient:        recipient,
            contentHash:      contentHash,
            encryptedContent: encryptedContent,
            timestamp:        block.timestamp,
            readByRecipient:  false
        });

        bytes32 convKey = _conversationKey(sender, recipient);
        self.conversationIndex[convKey].push(id);
        self.inbox[recipient].push(id);

        emit DirectMessageSent(id, sender, recipient, contentHash, block.timestamp);
    }

    /**
     * @notice Mark `messageId` as read by `caller`. Only the recipient may
     *         call this; the main contract enforces onlyRegisteredAgent.
     */
    function markRead(Store storage self, uint256 messageId, address caller) external {
        DirectMessage storage m = self.directMessages[messageId];
        require(m.id != 0, "Message not found.");
        require(m.recipient == caller, "Only recipient can mark as read.");
        if (m.readByRecipient) {
            return;
        }
        m.readByRecipient = true;
        emit DirectMessageRead(messageId, caller);
    }

    /**
     * @notice Read a message. Only sender or recipient may call.
     */
    function readMessage(Store storage self, uint256 messageId, address caller) external view returns (
        uint256 id,
        address sender,
        address recipient,
        bytes32 contentHash,
        string memory encryptedContent,
        uint256 timestamp,
        bool readByRecipient
    ) {
        DirectMessage storage m = self.directMessages[messageId];
        require(m.id != 0, "Message not found.");
        require(
            caller == m.sender || caller == m.recipient,
            "Only sender or recipient can read this message."
        );
        return (m.id, m.sender, m.recipient, m.contentHash, m.encryptedContent, m.timestamp, m.readByRecipient);
    }

    /**
     * @notice Get the conversation thread between `caller` and `other`.
     */
    function conversation(
        Store storage self,
        address caller,
        address other,
        uint256 offset,
        uint256 limit
    ) external view returns (uint256[] memory messageIds, uint256 total) {
        bytes32 convKey = _conversationKey(caller, other);
        uint256[] storage allIds = self.conversationIndex[convKey];
        total = allIds.length;
        if (offset >= total) return (new uint256[](0), total);
        uint256 end = offset + limit;
        if (end > total) end = total;
        messageIds = new uint256[](end - offset);
        for (uint256 i = 0; i < messageIds.length; i++) {
            messageIds[i] = allIds[offset + i];
        }
    }

    /**
     * @notice Paginated inbox for `caller`.
     */
    function getInbox(
        Store storage self,
        address caller,
        uint256 offset,
        uint256 limit
    ) external view returns (uint256[] memory messageIds, uint256 total) {
        uint256[] storage allIds = self.inbox[caller];
        total = allIds.length;
        if (offset >= total) return (new uint256[](0), total);
        uint256 end = offset + limit;
        if (end > total) end = total;
        messageIds = new uint256[](end - offset);
        for (uint256 i = 0; i < messageIds.length; i++) {
            messageIds[i] = allIds[offset + i];
        }
    }
}
