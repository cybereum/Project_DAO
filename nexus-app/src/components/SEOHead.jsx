import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageView } from '../lib/analytics';

const BASE_URL = 'https://nexusprotocol.io';
const SITE_NAME = 'NEXUS Protocol';

const ROUTE_SEO = {
  '/': {
    title: 'NEXUS Protocol | Decentralized Governance for Every City, Community & Cause',
    description: 'The open protocol making corruption structurally impossible. Verify companies on-chain, govern projects transparently, track impact in real-time. Free. Global. Deployable in minutes.',
    keywords: 'decentralized governance, DAO, corruption prevention, transparent government, community governance, public accountability, NGO transparency, ESG verification, blockchain governance, open source DAO',
  },
  '/pulse': {
    title: 'Global Pulse | NEXUS Protocol — Live Accountability Concerns Monitor',
    description: 'Real-time tracker of global governance failures, corruption hotspots, ESG greenwashing, and accountability gaps — with NEXUS Protocol structural solutions for each.',
    keywords: 'global corruption, ESG greenwashing, public spending transparency, community governance, accountability, NGO fraud, infrastructure corruption, supply chain fraud',
  },
  '/dashboard': {
    title: 'Command Center | NEXUS Protocol',
    description: 'Real-time overview of decentralized governance activity, project milestones, proposals, and protocol health across the NEXUS ecosystem.',
    keywords: 'DAO dashboard, decentralized governance overview, protocol metrics, Web3 command center',
  },
  '/projects': {
    title: 'Projects | NEXUS Protocol - Decentralized Project Orchestration',
    description: 'Browse and manage decentralized projects with milestone-based escrow, transparent budgets, and DAO governance. From infrastructure to environmental initiatives.',
    keywords: 'decentralized projects, DAO project management, milestone escrow, blockchain project funding',
  },
  '/milestones': {
    title: 'Milestones | NEXUS Protocol - Smart Contract Escrow Gates',
    description: 'Track project milestones with smart contract-based escrow. Transparent progress tracking, contractor management, and automated payment release on completion.',
    keywords: 'milestone escrow, smart contract payments, project milestones, decentralized project tracking',
  },
  '/proposals': {
    title: 'Proposals | NEXUS Protocol - DAO Governance Voting',
    description: 'Participate in transparent DAO governance. Vote on proposals, track quorum, and shape the direction of decentralized projects and protocol upgrades.',
    keywords: 'DAO voting, governance proposals, decentralized decision making, on-chain voting, quorum',
  },
  '/verification': {
    title: 'Verification | NEXUS Protocol - Company Trust & Credentials',
    description: 'Verify companies on-chain with verifiable credentials, reliability scoring, and audit tracking. Build trust in the decentralized economy.',
    keywords: 'company verification, verifiable credentials, on-chain identity, corporate trust, blockchain KYC',
  },
  '/reputation': {
    title: 'Reputation | NEXUS Protocol - On-Chain Reputation Scoring',
    description: 'Earn and track on-chain reputation through contributions, task completion, and peer voting. Transparent leaderboard for the decentralized workforce.',
    keywords: 'on-chain reputation, decentralized identity score, contributor ranking, Web3 reputation',
  },
  '/assets': {
    title: 'Assets | NEXUS Protocol - Tokenized Project Assets & NFTs',
    description: 'Manage tokenized project assets, intellectual property NFTs, carbon credits, and infrastructure blueprints on the NEXUS Protocol.',
    keywords: 'NFT assets, tokenized IP, carbon credit NFTs, project asset management, Web3 assets',
  },
};

const getRouteSEO = (pathname) => {
  // Exact match from static route config
  if (ROUTE_SEO[pathname]) {
    return ROUTE_SEO[pathname];
  }

  // Dynamic project detail routes: /projects/:id
  if (pathname.startsWith('/projects/') && pathname !== '/projects') {
    return {
      title: 'Project Details | NEXUS Protocol',
      description:
        'View detailed information, milestones, governance activity, and performance metrics for this NEXUS Protocol project.',
      keywords:
        'project details, NEXUS project, governance, milestones, decentralized project overview',
    };
  }

  // Fallback to global defaults handled later
  return {};
};

export default function SEOHead({ title, description, keywords }) {
  const location = useLocation();

  useEffect(() => {
    const routeSEO = getRouteSEO(location.pathname);
    const pageTitle = title || routeSEO.title || `${SITE_NAME} | Decentralized Governance & Verified Trust`;
    const pageDescription = description || routeSEO.description || 'Decentralized platform where companies earn verified trust, govern transparently, and build reputation on-chain.';
    const pageKeywords = keywords || routeSEO.keywords || 'DAO, decentralized governance, verified trust, blockchain';
    const pageUrl = `${BASE_URL}${location.pathname}`;

    document.title = pageTitle;

    const setMeta = (attr, key, content) => {
      let el = document.querySelector(`meta[${attr}="${key}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    setMeta('name', 'description', pageDescription);
    setMeta('name', 'keywords', pageKeywords);

    setMeta('property', 'og:title', pageTitle);
    setMeta('property', 'og:description', pageDescription);
    setMeta('property', 'og:url', pageUrl);

    setMeta('name', 'twitter:title', pageTitle);
    setMeta('name', 'twitter:description', pageDescription);
    setMeta('name', 'twitter:url', pageUrl);

    let canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) {
      canonical.setAttribute('href', pageUrl);
    } else {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      canonical.setAttribute('href', pageUrl);
      document.head.appendChild(canonical);
    }

    // Track page view for analytics
    trackPageView(location.pathname, pageTitle);
  }, [location.pathname, title, description, keywords]);

  return null;
}
