import { useState } from 'react';
import { Twitter, Linkedin, Link2, CheckCircle } from 'lucide-react';

/**
 * ShareProposal — inline share buttons for a governance proposal.
 * Pass `proposal` object with { id, title, yesVotes, noVotes, status }.
 */
export default function ShareProposal({ proposal }) {
  const [copied, setCopied] = useState(false);

  const base = typeof window !== 'undefined' ? window.location.origin : 'https://www.cybereum.io';
  const url = `${base}/proposals#proposal-${proposal.id}`;
  const total = (proposal.yesVotes || 0) + (proposal.noVotes || 0);
  const pct = total > 0 ? Math.round(((proposal.yesVotes || 0) / total) * 100) : 0;
  const text = `"${proposal.title}" — ${pct}% approval on NEXUS Protocol. Transparent on-chain governance in action. ${url}`;

  const copy = () => {
    const markCopied = () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };

    const fallbackCopy = () => {
      if (typeof document === 'undefined') {
        return false;
      }
      try {
        const textarea = document.createElement('textarea');
        textarea.value = url;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'absolute';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        const successful = document.execCommand && document.execCommand('copy');
        document.body.removeChild(textarea);
        if (successful) {
          markCopied();
        }
        return successful;
      } catch (err) {
        console.error('Fallback copy failed', err);
        return false;
      }
    };

    if (
      typeof navigator !== 'undefined' &&
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === 'function'
    ) {
      navigator.clipboard
        .writeText(url)
        .then(() => {
          markCopied();
        })
        .catch((err) => {
          console.error('Clipboard write failed, using fallback copy', err);
          fallbackCopy();
        });
    } else {
      fallbackCopy();
    }
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-nexus-text-dim">Share</span>
      <a
        href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="p-1.5 rounded-md bg-white/5 hover:bg-white/10 text-nexus-text-dim hover:text-white transition-colors"
        title="Share on X/Twitter"
        aria-label="Share on X/Twitter"
      >
        <Twitter size={13} />
      </a>
      <a
        href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="p-1.5 rounded-md bg-white/5 hover:bg-white/10 text-nexus-text-dim hover:text-white transition-colors"
        title="Share on LinkedIn"
        aria-label="Share on LinkedIn"
      >
        <Linkedin size={13} />
      </a>
      <button
        onClick={copy}
        className="p-1.5 rounded-md bg-white/5 hover:bg-white/10 text-nexus-text-dim hover:text-white transition-colors"
        title="Copy link"
        aria-label="Copy link"
      >
        {copied ? <CheckCircle size={13} className="text-green-400" /> : <Link2 size={13} />}
      </button>
    </div>
  );
}
