// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title PKILib — PKI registry + encrypted artifact envelopes
 * @notice External library that holds most of the PKI logic for
 *         Project_DAO. Deploying it separately and linking it keeps
 *         the main contract's bytecode smaller. All external library
 *         functions here are invoked via DELEGATECALL, so:
 *           - `msg.sender` is preserved (original caller)
 *           - `address(this)` is the main Project_DAO contract
 *           - events emitted here appear under the main contract's address
 *           - storage writes operate on the main contract's storage via
 *             the `storage` struct pointers the caller passes in.
 *
 *         The main contract retains:
 *           - Authorization (party checks, pause, onlyRegisteredAgent)
 *           - Wrapper functions that match the public API
 *         This library owns:
 *           - Length/format validation and storage mutation
 *           - EIP-712 signature verification for the signed attach variant
 *           - Event declarations (see note above about delegatecall)
 */
library PKILib {
    // ─── Constants ──────────────────────────────────────────────────────────
    uint256 internal constant MIN_KEY_BYTES = 32;
    uint256 internal constant MAX_KEY_BYTES = 256;
    uint256 internal constant MAX_CIPHERTEXT_BYTES = 8192;

    // ─── Types ──────────────────────────────────────────────────────────────
    struct EncryptedEnvelope {
        bytes32 contentHash;    // keccak256 of the shared plaintext
        uint256 updatedAt;      // Block timestamp of the last attach
        address setBy;          // Who performed the last attach
        bool    exists;         // True once an envelope has been stored
        bool    hasSignatures;  // True if attached via the signed variant
        // Tracks the full recipient set whose ciphertexts exist in
        // ciphertextFor[id][...] so re-attach can clear them atomically
        // (fixing the partial re-attach footgun).
        address[] recipients;
    }

    struct PubKeyRegistry {
        mapping(address => bytes) keys;
        mapping(address => uint256) updatedAt;
        // Reserved for future fields so appending to this struct does not
        // shift the layout of unrelated state variables in Project_DAO.
        uint256[50] __gap;
    }

    struct EnvelopeStore {
        mapping(uint256 => EncryptedEnvelope) envelopes;
        mapping(uint256 => mapping(address => string)) ciphertextFor;
        // Same storage-gap pattern as PubKeyRegistry above.
        uint256[50] __gap;
    }

    // ─── Events ────────────────────────────────────────────────────────────
    // Declared in both the library (where they are emitted) and in the main
    // contract (so they appear in its ABI). Signatures match exactly.
    event AgentPublicKeyPublished(address indexed agent, bytes publicKey, uint256 updatedAt);
    event AgentPublicKeyRevoked(address indexed agent, uint256 revokedAt);
    event AgreementEncryptedPayloadAttached(
        uint256 indexed agreementId,
        address indexed setBy,
        bytes32 contentHash,
        uint256 recipientCount,
        uint256 updatedAt,
        bool signed
    );
    event PaymentRequestEncryptedPayloadAttached(
        uint256 indexed requestId,
        address indexed setBy,
        bytes32 contentHash,
        uint256 updatedAt,
        bool signed
    );

    // ─── Public key registry ────────────────────────────────────────────────

    /// @notice Publish or rotate the caller's encryption public key.
    function publishKey(PubKeyRegistry storage self, bytes calldata publicKey) external {
        uint256 len = publicKey.length;
        require(len >= MIN_KEY_BYTES, "Public key too short.");
        require(len <= MAX_KEY_BYTES, "Public key too long.");
        self.keys[msg.sender] = publicKey;
        self.updatedAt[msg.sender] = block.timestamp;
        emit AgentPublicKeyPublished(msg.sender, publicKey, block.timestamp);
    }

    /// @notice Revoke the caller's published public key.
    function revokeKey(PubKeyRegistry storage self) external {
        require(self.keys[msg.sender].length > 0, "No public key published.");
        delete self.keys[msg.sender];
        self.updatedAt[msg.sender] = block.timestamp;
        emit AgentPublicKeyRevoked(msg.sender, block.timestamp);
    }

    /// @notice Read an agent's published public key.
    function getKey(PubKeyRegistry storage self, address agent) external view returns (bytes memory publicKey, uint256 updatedAt) {
        return (self.keys[agent], self.updatedAt[agent]);
    }

    /// @notice Shorthand: does the agent have a published public key?
    function hasKey(PubKeyRegistry storage self, address agent) external view returns (bool) {
        return self.keys[agent].length > 0;
    }

    // ─── Envelope storage primitives ────────────────────────────────────────

    /**
     * @dev Core validate-and-store routine for agreement envelopes.
     *      The caller must have already checked authorization (party
     *      membership). This routine enforces recipient-side invariants
     *      (published pubkey, ciphertext length, non-zero hash) AND fixes
     *      the partial re-attach footgun:
     *
     *      - If the caller re-attaches with a DIFFERENT contentHash, ALL
     *        previously-stored ciphertexts are cleared before the new ones
     *        are written, so non-passed parties can never see a stale
     *        ciphertext paired with a new hash.
     *      - If the caller re-attaches with the SAME contentHash, existing
     *        ciphertexts are preserved. This supports the legitimate
     *        "rotate one party's key — rewrite only their ciphertext"
     *        use case, since the plaintext (and thus the hash) is unchanged.
     *
     *      The recipients array in the envelope tracks the full current
     *      set of addresses with a stored ciphertext so the clear step
     *      can run without knowing who was written in the past.
     */
    function _writeEnvelope(
        EnvelopeStore storage store,
        PubKeyRegistry storage pubKeys,
        uint256 id,
        address[] calldata recipients,
        string[] calldata ciphertexts,
        bytes32 contentHash,
        bool signed
    ) private {
        require(recipients.length == ciphertexts.length, "Recipients/ciphertexts length mismatch.");
        require(recipients.length > 0, "At least one recipient required.");
        require(contentHash != bytes32(0), "Content hash required.");

        EncryptedEnvelope storage env = store.envelopes[id];

        // ── Hash change → clear every previously-stored ciphertext so no
        //    non-passed party can be left with data that no longer matches
        //    the envelope's integrity hash.
        if (env.exists && env.contentHash != contentHash) {
            address[] storage oldRecipients = env.recipients;
            uint256 oldLen = oldRecipients.length;
            for (uint256 j = 0; j < oldLen; j++) {
                delete store.ciphertextFor[id][oldRecipients[j]];
            }
            delete env.recipients;
        }

        // ── Write new ciphertexts. A recipient is "new to the envelope"
        //    iff there's no existing ciphertext for it in this id — after
        //    the clear step above, that's automatically true for every
        //    recipient in the hash-change case. On same-hash re-attach,
        //    recipients whose ciphertext is being refreshed are skipped
        //    from the recipients array push so we don't create duplicates.
        for (uint256 i = 0; i < recipients.length; i++) {
            address r = recipients[i];
            require(pubKeys.keys[r].length > 0, "Recipient has no published public key.");
            bytes calldata ct = bytes(ciphertexts[i]);
            require(ct.length > 0, "Ciphertext must be non-empty.");
            require(ct.length <= MAX_CIPHERTEXT_BYTES, "Ciphertext exceeds max length.");

            bool isNewRecipient = bytes(store.ciphertextFor[id][r]).length == 0;
            store.ciphertextFor[id][r] = ciphertexts[i];
            if (isNewRecipient) {
                env.recipients.push(r);
            }
        }

        env.contentHash   = contentHash;
        env.updatedAt     = block.timestamp;
        env.setBy         = msg.sender;
        env.exists        = true;
        env.hasSignatures = signed;
    }

    /**
     * @notice Validate and store an unsigned agreement envelope.
     * @dev Emits AgreementEncryptedPayloadAttached from the delegated frame.
     */
    function attachAgreementEnvelope(
        EnvelopeStore storage store,
        PubKeyRegistry storage pubKeys,
        uint256 agreementId,
        address[] calldata recipients,
        string[] calldata ciphertexts,
        bytes32 contentHash
    ) external {
        _writeEnvelope(store, pubKeys, agreementId, recipients, ciphertexts, contentHash, false);
        emit AgreementEncryptedPayloadAttached(agreementId, msg.sender, contentHash, recipients.length, block.timestamp, false);
    }

    /**
     * @notice Validate and store a signed agreement envelope.
     *         Each address in `expectedSigners` must have produced one of
     *         the EIP-712 signatures in `signatures` over the agreement's
     *         (agreementId, contentHash) pair — establishing explicit,
     *         on-chain-verifiable agreement to the plaintext hash by all
     *         parties. Signatures are positional: signatures[i] must
     *         recover to expectedSigners[i].
     */
    function attachAgreementEnvelopeSigned(
        EnvelopeStore storage store,
        PubKeyRegistry storage pubKeys,
        uint256 agreementId,
        address[] calldata recipients,
        string[] calldata ciphertexts,
        bytes32 contentHash,
        address[] calldata expectedSigners,
        bytes[] calldata signatures
    ) external {
        _verifyAgreementSignatures(agreementId, contentHash, expectedSigners, signatures);
        _writeEnvelope(store, pubKeys, agreementId, recipients, ciphertexts, contentHash, true);
        emit AgreementEncryptedPayloadAttached(agreementId, msg.sender, contentHash, recipients.length, block.timestamp, true);
    }

    /**
     * @notice Validate and store an unsigned payment request envelope.
     *         Exactly two recipients: the requester and the payer.
     */
    function attachPaymentRequestEnvelope(
        EnvelopeStore storage store,
        PubKeyRegistry storage pubKeys,
        uint256 requestId,
        address requester,
        address payer,
        string calldata ciphertextForRequester,
        string calldata ciphertextForPayer,
        bytes32 contentHash
    ) external {
        _writePaymentRequestEnvelope(store, pubKeys, requestId, requester, payer, ciphertextForRequester, ciphertextForPayer, contentHash, false);
        emit PaymentRequestEncryptedPayloadAttached(requestId, msg.sender, contentHash, block.timestamp, false);
    }

    /**
     * @notice Validate and store a signed payment request envelope.
     *         Both the requester and payer must have signed the
     *         (requestId, contentHash) pair.
     */
    function attachPaymentRequestEnvelopeSigned(
        EnvelopeStore storage store,
        PubKeyRegistry storage pubKeys,
        uint256 requestId,
        address requester,
        address payer,
        string calldata ciphertextForRequester,
        string calldata ciphertextForPayer,
        bytes32 contentHash,
        bytes calldata requesterSig,
        bytes calldata payerSig
    ) external {
        bytes32 digest = _paymentRequestDigest(requestId, contentHash);
        require(_recover(digest, requesterSig) == requester, "Invalid requester signature.");
        require(_recover(digest, payerSig) == payer, "Invalid payer signature.");
        _writePaymentRequestEnvelope(store, pubKeys, requestId, requester, payer, ciphertextForRequester, ciphertextForPayer, contentHash, true);
        emit PaymentRequestEncryptedPayloadAttached(requestId, msg.sender, contentHash, block.timestamp, true);
    }

    function _writePaymentRequestEnvelope(
        EnvelopeStore storage store,
        PubKeyRegistry storage pubKeys,
        uint256 requestId,
        address requester,
        address payer,
        string calldata ciphertextForRequester,
        string calldata ciphertextForPayer,
        bytes32 contentHash,
        bool signed
    ) private {
        require(contentHash != bytes32(0), "Content hash required.");
        bytes calldata reqCt = bytes(ciphertextForRequester);
        bytes calldata payCt = bytes(ciphertextForPayer);
        require(reqCt.length > 0 && payCt.length > 0, "Ciphertexts must be non-empty.");
        require(
            reqCt.length <= MAX_CIPHERTEXT_BYTES && payCt.length <= MAX_CIPHERTEXT_BYTES,
            "Ciphertext exceeds max length."
        );
        require(pubKeys.keys[requester].length > 0, "Requester has no published public key.");
        require(pubKeys.keys[payer].length > 0, "Payer has no published public key.");

        store.ciphertextFor[requestId][requester] = ciphertextForRequester;
        store.ciphertextFor[requestId][payer] = ciphertextForPayer;

        // Field-by-field assignment: the struct contains a dynamic array
        // (recipients) so Solidity won't accept a literal with mixed
        // calldata→storage copy semantics. Update each field explicitly.
        EncryptedEnvelope storage env = store.envelopes[requestId];
        env.contentHash   = contentHash;
        env.updatedAt     = block.timestamp;
        env.setBy         = msg.sender;
        env.exists        = true;
        env.hasSignatures = signed;
        // Payment requests always write both slots on every attach, so no
        // need to track recipients — the partial-reattach footgun doesn't
        // apply here.
    }

    /**
     * @notice Read the caller's own ciphertext from an envelope store.
     *         Authorization (party check) is the caller's responsibility.
     */
    function readEnvelope(EnvelopeStore storage store, uint256 id, address reader) external view returns (
        bytes32 contentHash,
        string memory ciphertextForCaller,
        uint256 updatedAt,
        address setBy,
        bool hasSignatures
    ) {
        EncryptedEnvelope storage e = store.envelopes[id];
        require(e.exists, "No encrypted payload attached.");
        return (e.contentHash, store.ciphertextFor[id][reader], e.updatedAt, e.setBy, e.hasSignatures);
    }

    // ─── EIP-712 signature verification ─────────────────────────────────────

    bytes32 internal constant EIP712_DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 internal constant DOMAIN_NAME_HASH = keccak256("Project_DAO");
    bytes32 internal constant DOMAIN_VERSION_HASH = keccak256("1");

    bytes32 internal constant AGREEMENT_TERMS_TYPEHASH =
        keccak256("AgreementTerms(uint256 agreementId,bytes32 contentHash)");
    bytes32 internal constant PAYMENT_REQUEST_TERMS_TYPEHASH =
        keccak256("PaymentRequestTerms(uint256 requestId,bytes32 contentHash)");

    /// @notice Compute the EIP-712 domain separator.
    ///         Because this library runs via delegatecall, address(this)
    ///         resolves to the main contract and block.chainid is the
    ///         current chain — identical to the main contract's view.
    function _domainSeparator() internal view returns (bytes32) {
        return keccak256(
            abi.encode(
                EIP712_DOMAIN_TYPEHASH,
                DOMAIN_NAME_HASH,
                DOMAIN_VERSION_HASH,
                block.chainid,
                address(this)
            )
        );
    }

    function _hashTypedData(bytes32 structHash) internal view returns (bytes32) {
        return keccak256(abi.encodePacked("\x19\x01", _domainSeparator(), structHash));
    }

    function _agreementDigest(uint256 agreementId, bytes32 contentHash) internal view returns (bytes32) {
        bytes32 structHash = keccak256(abi.encode(AGREEMENT_TERMS_TYPEHASH, agreementId, contentHash));
        return _hashTypedData(structHash);
    }

    function _paymentRequestDigest(uint256 requestId, bytes32 contentHash) internal view returns (bytes32) {
        bytes32 structHash = keccak256(abi.encode(PAYMENT_REQUEST_TERMS_TYPEHASH, requestId, contentHash));
        return _hashTypedData(structHash);
    }

    /**
     * @notice Expose the EIP-712 digest so clients can check what to sign.
     *         External so the main contract can surface it through a view.
     */
    function agreementDigest(uint256 agreementId, bytes32 contentHash) external view returns (bytes32) {
        return _agreementDigest(agreementId, contentHash);
    }

    function paymentRequestDigest(uint256 requestId, bytes32 contentHash) external view returns (bytes32) {
        return _paymentRequestDigest(requestId, contentHash);
    }

    /// @dev Recover the signer from a 65-byte EIP-191/EIP-712 signature.
    ///      Delegates to OpenZeppelin's audited ECDSA library — which
    ///      enforces canonical s (EIP-2 anti-malleability), a 65-byte
    ///      payload shape, v ∈ {27, 28}, and reverts on non-zero invalid
    ///      signatures. Passing the memory copy is required because OZ
    ///      ECDSA.recover only takes `bytes memory`.
    function _recover(bytes32 digest, bytes memory sig) internal pure returns (address) {
        return ECDSA.recover(digest, sig);
    }

    function _verifyAgreementSignatures(
        uint256 agreementId,
        bytes32 contentHash,
        address[] calldata expectedSigners,
        bytes[] calldata signatures
    ) private view {
        require(expectedSigners.length == signatures.length, "Signers/signatures length mismatch.");
        require(expectedSigners.length > 0, "At least one signer required.");
        bytes32 digest = _agreementDigest(agreementId, contentHash);
        for (uint256 i = 0; i < expectedSigners.length; i++) {
            require(_recover(digest, signatures[i]) == expectedSigners[i], "Invalid party signature.");
        }
    }
}
