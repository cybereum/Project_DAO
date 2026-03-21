import { useState, useEffect, useCallback, useRef } from 'react';
import { motion as Motion } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import { keccak256, toUtf8Bytes } from 'ethers';
import {
  MessageCircle, Send, Inbox, CheckCircle, Clock, Lock, Eye,
  RefreshCw, Wallet, ChevronRight, User, Search, ArrowLeft
} from 'lucide-react';
import { useApp } from '../store/appStore';
import { markFunnelStep } from '../lib/utm.js';
import { trackEvent } from '../lib/analytics.js';

function Btn({ children, loading, variant = 'primary', disabled, className = '', ...props }) {
  const base = 'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-opacity disabled:opacity-50';
  const v = variant === 'primary'
    ? 'bg-gradient-to-r from-nexus-cyan to-nexus-purple text-white hover:opacity-90'
    : 'border border-nexus-border text-nexus-text-dim hover:text-nexus-text hover:border-nexus-cyan/40';
  return (
    <button className={`${base} ${v} ${className}`} disabled={disabled || loading} {...props}>
      {loading && <RefreshCw size={14} className="animate-spin" />}
      {children}
    </button>
  );
}

function EmptyState({ icon: Icon, title, desc }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-nexus-surface border border-nexus-border flex items-center justify-center mb-4">
        <Icon size={28} className="text-nexus-text-dim" />
      </div>
      <h3 className="font-semibold text-nexus-text mb-1">{title}</h3>
      <p className="text-sm text-nexus-text-dim max-w-xs">{desc}</p>
    </div>
  );
}

function MessageBubble({ msg, isOwn, walletAddress, onMarkRead }) {
  const ts = new Date(msg.timestamp * 1000);
  const timeStr = ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateStr = ts.toLocaleDateString([], { month: 'short', day: 'numeric' });

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-3`}>
      <div className={`max-w-[75%] ${isOwn ? 'order-1' : 'order-0'}`}>
        <div className={`px-4 py-3 rounded-2xl text-sm break-words ${
          isOwn
            ? 'bg-gradient-to-br from-nexus-cyan/20 to-nexus-purple/20 border border-nexus-cyan/20 rounded-br-md'
            : 'bg-nexus-surface border border-nexus-border rounded-bl-md'
        }`}>
          {msg.encryptedContent}
        </div>
        <div className={`flex items-center gap-2 mt-1 px-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
          <span className="text-xs text-nexus-text-dim">{dateStr} {timeStr}</span>
          {isOwn && msg.readByRecipient && (
            <span className="text-xs text-green-400 flex items-center gap-0.5"><CheckCircle size={10} /> Read</span>
          )}
          {!isOwn && !msg.readByRecipient && (
            <button onClick={() => onMarkRead(msg.id)}
              className="text-xs text-nexus-cyan hover:underline flex items-center gap-0.5">
              <Eye size={10} /> Mark read
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ContactItem({ address, lastMsg, isActive, unreadCount, onClick }) {
  const short = `${address.slice(0, 6)}...${address.slice(-4)}`;
  const preview = lastMsg?.encryptedContent
    ? (lastMsg.encryptedContent.length > 40 ? lastMsg.encryptedContent.slice(0, 40) + '...' : lastMsg.encryptedContent)
    : 'No messages yet';
  const time = lastMsg?.timestamp
    ? new Date(lastMsg.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <button onClick={onClick}
      className={`w-full text-left px-4 py-3 border-b border-nexus-border transition-colors ${
        isActive ? 'bg-nexus-cyan/10 border-l-2 border-l-nexus-cyan' : 'hover:bg-white/5'
      }`}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-nexus-cyan/30 to-nexus-purple/30 flex items-center justify-center">
            <User size={14} className="text-nexus-text-dim" />
          </div>
          <span className="font-mono text-sm text-nexus-text">{short}</span>
        </div>
        <div className="flex items-center gap-2">
          {time && <span className="text-xs text-nexus-text-dim">{time}</span>}
          {unreadCount > 0 && (
            <span className="min-w-5 h-5 flex items-center justify-center px-1.5 rounded-full bg-nexus-cyan text-white text-xs font-bold">
              {unreadCount}
            </span>
          )}
        </div>
      </div>
      <p className="text-xs text-nexus-text-dim truncate pl-10">{preview}</p>
    </button>
  );
}

export default function AgentMessages() {
  const {
    walletConnected, walletAddress, walletError, txPending,
    connectWallet,
    agentProfile,
    loadAgentProfile,
    inbox, inboxLoading,
    conversationMessages, conversationLoading,
    loadInbox, loadConversation, agentSendMessage, agentMarkMessageRead,
  } = useApp();

  const [searchParams] = useSearchParams();
  const [activeAgent, setActiveAgent] = useState(searchParams.get('to') || '');
  const [newMessage, setNewMessage] = useState('');
  const [newConvoAddr, setNewConvoAddr] = useState('');
  const [showNewConvo, setShowNewConvo] = useState(false);
  const [contactFilter, setContactFilter] = useState('');
  const messagesEndRef = useRef(null);

  // Derive contacts from inbox messages
  const contacts = (() => {
    if (!inbox?.messages?.length || !walletAddress) return [];
    const contactMap = new Map();
    for (const msg of inbox.messages) {
      const other = msg.sender.toLowerCase() === walletAddress.toLowerCase() ? msg.recipient : msg.sender;
      const key = other.toLowerCase();
      if (!contactMap.has(key)) {
        contactMap.set(key, { address: other, lastMsg: msg, unread: 0 });
      }
      if (!msg.readByRecipient && msg.recipient.toLowerCase() === walletAddress.toLowerCase()) {
        contactMap.get(key).unread++;
      }
    }
    return Array.from(contactMap.values())
      .sort((a, b) => (b.lastMsg?.timestamp || 0) - (a.lastMsg?.timestamp || 0));
  })();

  const filteredContacts = contactFilter
    ? contacts.filter(c => c.address.toLowerCase().includes(contactFilter.toLowerCase()))
    : contacts;

  const totalUnread = contacts.reduce((n, c) => n + c.unread, 0);

  // Load inbox on mount
  useEffect(() => {
    if (walletConnected) {
      loadInbox();
      loadAgentProfile();
    }
  }, [walletConnected, loadInbox, loadAgentProfile]);

  // Load conversation when active agent changes
  useEffect(() => {
    if (activeAgent && walletConnected) {
      loadConversation(activeAgent);
    }
  }, [activeAgent, walletConnected, loadConversation]);

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversationMessages]);

  const handleSend = useCallback(async () => {
    if (!newMessage.trim() || !activeAgent) return;
    const contentHash = keccak256(toUtf8Bytes(newMessage));
    const hash = await agentSendMessage(activeAgent, newMessage, contentHash);
    if (hash) {
      setNewMessage('');
      loadConversation(activeAgent);
      loadInbox();
      markFunnelStep('agent_tx_complete');
      trackEvent('agent_transaction', { action: 'direct_message_sent' });
    }
  }, [newMessage, activeAgent, agentSendMessage, loadConversation, loadInbox]);

  const handleMarkRead = useCallback(async (messageId) => {
    const hash = await agentMarkMessageRead(messageId);
    if (hash) {
      loadConversation(activeAgent);
      loadInbox();
    }
  }, [activeAgent, agentMarkMessageRead, loadConversation, loadInbox]);

  const startNewConversation = () => {
    if (newConvoAddr.trim()) {
      setActiveAgent(newConvoAddr.trim());
      setShowNewConvo(false);
      setNewConvoAddr('');
    }
  };

  // Not connected state
  if (!walletConnected) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 mb-1">
          <MessageCircle size={24} className="text-nexus-cyan" />
          <h1 className="text-2xl font-bold">Agent Messages</h1>
        </div>
        <div className="flex flex-col items-center justify-center py-24">
          <Lock size={40} className="text-nexus-text-dim mb-4" />
          <h2 className="text-lg font-semibold mb-2">Connect your wallet</h2>
          <p className="text-sm text-nexus-text-dim mb-6 max-w-sm text-center">
            Connect a wallet to access on-chain secure messaging between registered agents.
          </p>
          <Btn onClick={connectWallet}><Wallet size={16} /> Connect Wallet</Btn>
        </div>
        {walletError && (
          <div className="p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-sm text-red-400">{walletError}</div>
        )}
      </div>
    );
  }

  // Not registered as agent
  if (agentProfile && !agentProfile.registered) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 mb-1">
          <MessageCircle size={24} className="text-nexus-cyan" />
          <h1 className="text-2xl font-bold">Agent Messages</h1>
        </div>
        <EmptyState
          icon={Lock}
          title="Agent registration required"
          desc="You must be a registered agent to use direct messaging. Register in the Agent Economy console."
        />
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2">
          <MessageCircle size={24} className="text-nexus-cyan" />
          <h1 className="text-2xl font-bold">Agent Messages</h1>
          {totalUnread > 0 && (
            <span className="min-w-6 h-6 flex items-center justify-center px-2 rounded-full bg-nexus-cyan text-white text-xs font-bold">
              {totalUnread}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Btn variant="secondary" loading={inboxLoading} onClick={() => loadInbox()}>
            <RefreshCw size={14} /> Refresh
          </Btn>
          <Btn onClick={() => setShowNewConvo(true)}>
            <Send size={14} /> New Message
          </Btn>
        </div>
      </div>

      {walletError && (
        <div className="p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-sm text-red-400 mb-4">{walletError}</div>
      )}

      {/* New conversation dialog */}
      {showNewConvo && (
        <Motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-4 rounded-xl border border-nexus-cyan/30 bg-nexus-cyan/5">
          <div className="flex items-center gap-2 mb-3">
            <Send size={14} className="text-nexus-cyan" />
            <span className="text-sm font-semibold">Start new conversation</span>
          </div>
          <div className="flex gap-2">
            <input
              className="flex-1 px-3 py-2 rounded-lg bg-nexus-bg border border-nexus-border text-sm text-nexus-text placeholder-nexus-text-dim focus:outline-none focus:border-nexus-cyan"
              placeholder="Enter agent address (0x...)"
              value={newConvoAddr}
              onChange={e => setNewConvoAddr(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && startNewConversation()}
            />
            <Btn onClick={startNewConversation} disabled={!newConvoAddr.trim()}>
              <ChevronRight size={14} /> Open
            </Btn>
            <Btn variant="secondary" onClick={() => setShowNewConvo(false)}>Cancel</Btn>
          </div>
        </Motion.div>
      )}

      {/* Main messaging layout */}
      <div className="flex rounded-2xl border border-nexus-border bg-nexus-surface/50 overflow-hidden" style={{ height: 'calc(100vh - 260px)', minHeight: '480px' }}>
        {/* Contact list */}
        <div className="w-80 flex-shrink-0 border-r border-nexus-border flex flex-col">
          <div className="p-3 border-b border-nexus-border">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-nexus-text-dim" />
              <input
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-nexus-bg border border-nexus-border text-sm text-nexus-text placeholder-nexus-text-dim focus:outline-none focus:border-nexus-cyan"
                placeholder="Search agents..."
                value={contactFilter}
                onChange={e => setContactFilter(e.target.value)}
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredContacts.length > 0 ? (
              filteredContacts.map(c => (
                <ContactItem
                  key={c.address}
                  address={c.address}
                  lastMsg={c.lastMsg}
                  isActive={activeAgent.toLowerCase() === c.address.toLowerCase()}
                  unreadCount={c.unread}
                  onClick={() => setActiveAgent(c.address)}
                />
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <Inbox size={24} className="text-nexus-text-dim mb-2" />
                <p className="text-sm text-nexus-text-dim">
                  {inboxLoading ? 'Loading inbox...' : 'No conversations yet'}
                </p>
                {!inboxLoading && (
                  <button onClick={() => setShowNewConvo(true)}
                    className="mt-2 text-xs text-nexus-cyan hover:underline">
                    Start a conversation
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Conversation area */}
        <div className="flex-1 flex flex-col">
          {activeAgent ? (
            <>
              {/* Conversation header */}
              <div className="h-14 px-4 border-b border-nexus-border flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                  <button className="md:hidden p-1 hover:bg-white/5 rounded" onClick={() => setActiveAgent('')}>
                    <ArrowLeft size={16} />
                  </button>
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-nexus-cyan/30 to-nexus-purple/30 flex items-center justify-center">
                    <User size={14} className="text-nexus-text-dim" />
                  </div>
                  <div>
                    <p className="font-mono text-sm text-nexus-text">{activeAgent.slice(0, 6)}...{activeAgent.slice(-4)}</p>
                    <p className="text-xs text-nexus-text-dim font-mono">{activeAgent}</p>
                  </div>
                </div>
                <Btn variant="secondary" loading={conversationLoading} onClick={() => loadConversation(activeAgent)}
                  className="!px-2 !py-1">
                  <RefreshCw size={12} />
                </Btn>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4">
                {conversationLoading && !conversationMessages?.messages?.length ? (
                  <div className="flex items-center justify-center py-12">
                    <RefreshCw size={20} className="animate-spin text-nexus-text-dim" />
                  </div>
                ) : conversationMessages?.messages?.length > 0 ? (
                  <>
                    {conversationMessages.total > conversationMessages.messages.length && (
                      <p className="text-xs text-nexus-text-dim text-center mb-4">
                        Showing {conversationMessages.messages.length} of {conversationMessages.total} messages
                      </p>
                    )}
                    {conversationMessages.messages.map(msg => (
                      <MessageBubble
                        key={msg.id}
                        msg={msg}
                        isOwn={msg.sender.toLowerCase() === walletAddress?.toLowerCase()}
                        walletAddress={walletAddress}
                        onMarkRead={handleMarkRead}
                      />
                    ))}
                    <div ref={messagesEndRef} />
                  </>
                ) : (
                  <EmptyState
                    icon={MessageCircle}
                    title="No messages yet"
                    desc="Send the first message to start this conversation."
                  />
                )}
              </div>

              {/* Message input */}
              <div className="p-4 border-t border-nexus-border flex-shrink-0">
                <div className="flex gap-2">
                  <input
                    className="flex-1 px-4 py-3 rounded-xl bg-nexus-bg border border-nexus-border text-sm text-nexus-text placeholder-nexus-text-dim focus:outline-none focus:border-nexus-cyan"
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                  />
                  <Btn loading={txPending} disabled={!newMessage.trim()} onClick={handleSend}
                    className="!rounded-xl !px-5">
                    <Send size={16} />
                  </Btn>
                </div>
                <div className="flex items-center gap-2 mt-2 px-1">
                  <Lock size={10} className="text-nexus-purple" />
                  <span className="text-xs text-nexus-text-dim">
                    Messages are stored on-chain with keccak256 integrity hashes. Press Enter to send.
                  </span>
                </div>
              </div>
            </>
          ) : (
            <EmptyState
              icon={MessageCircle}
              title="Select a conversation"
              desc="Choose an agent from the list or start a new conversation."
            />
          )}
        </div>
      </div>
    </div>
  );
}
