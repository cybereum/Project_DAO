import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageView } from '../lib/analytics';

const BASE_URL = 'https://www.cybereum.io';
const SITE_NAME = 'Cybereum';
const OG_IMAGE = 'https://cdn.prod.website-files.com/6632a548562bd3696c947be1/66c8e5fdf48bbde6bc9ebe09_Blue_Logo_256.png';

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
  '/agents': {
    title: 'Agent Economy Settlement Layer | NEXUS Protocol — Project_DAO',
    description: 'The on-chain settlement layer built for AI agents and autonomous systems. Register agent identity, escrow ETH, transfer between agents, settle payment requests. Every transaction routes a fee to cybereum.eth. Deploy in minutes.',
    keywords: 'AI agent payments, agent economy, autonomous agent settlement, agent-to-agent transfer, on-chain agent identity, agent escrow, cybereum, Project_DAO, agent economy infrastructure',
  },
  '/builders': {
    title: 'Build on Project_DAO | NEXUS Protocol — Agent Economy Developer Guide',
    description: 'Integration guide for developers building on the agent economy settlement layer. Deploy Project_DAO.sol, configure the Cybereum fee rail, and wire agent transaction flows in minutes. Open source, EVM compatible.',
    keywords: 'Project_DAO developer, build agent economy, DAO smart contract integration, agent settlement layer development, Cybereum fee rail, NEXUS Protocol builders, EVM DAO deployment',
  },
  '/ngo': {
    title: 'NGO Governance Toolkit | NEXUS Protocol — Transparent Programme Delivery',
    description: 'Deploy transparent governance and disbursement accountability for NGOs, foundations, and impact programmes. Verify partners, track milestones, and prove outcomes on-chain.',
    keywords: 'NGO transparency, foundation governance, donor accountability, impact programme tracking, anti-corruption tooling',
  },
  '/enterprise': {
    title: 'Enterprise Governance Layer | NEXUS Protocol — Procurement & Settlement',
    description: 'Bring procurement governance, milestone execution, and programmable settlement into one auditable on-chain operating layer for enterprise teams and supply chains.',
    keywords: 'enterprise governance, procurement transparency, supply chain accountability, milestone settlement, on-chain operations',
  },
  '/cities': {
    title: 'City Transparency Stack | NEXUS Protocol — Public Infrastructure Accountability',
    description: 'Help cities and municipalities publish verifiable procurement, milestone progress, and disbursement records for public infrastructure and civic programmes.',
    keywords: 'city transparency, municipal governance, public infrastructure accountability, procurement integrity, civic technology',
  },
  '/agent-economy': {
    title: 'Agent Economy Console | NEXUS Protocol — On-Chain Agent Transactions',
    description: 'Live agent economy console. Register as an agent, manage escrow, transfer ETH and tokens, create and settle payment requests. All transactions route a protocol fee to cybereum.eth.',
    keywords: 'agent economy console, agent registration, escrow management, agent payment requests, cybereum fee, on-chain agent transactions, NEXUS agent console',
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


const upsertJsonLd = (id, payload) => {
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement('script');
    el.type = 'application/ld+json';
    el.id = id;
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(payload);
};

const getRouteSEO = (pathname) => {
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
    setMeta('property', 'og:image', OG_IMAGE);
    setMeta('property', 'og:image:alt', 'Cybereum circular logo');
    setMeta('property', 'og:site_name', SITE_NAME);
    setMeta('property', 'og:type', 'website');

    setMeta('name', 'twitter:title', pageTitle);
    setMeta('name', 'twitter:description', pageDescription);
    setMeta('name', 'twitter:url', pageUrl);
    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:image', OG_IMAGE);
    setMeta('name', 'theme-color', '#0d2137');

    let canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) {
      canonical.setAttribute('href', pageUrl);
    } else {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      canonical.setAttribute('href', pageUrl);
      document.head.appendChild(canonical);
    }



    upsertJsonLd('jsonld-org', {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Cybereum',
      url: BASE_URL,
      logo: OG_IMAGE,
      email: 'cybereum@cybereum.io',
    });

    upsertJsonLd('jsonld-site', {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Cybereum',
      url: BASE_URL,
    });

    upsertJsonLd('jsonld-software', {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Cybereum',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      offers: {
        '@type': 'Offer',
        url: `${BASE_URL}/contact2`,
        description: 'Request pricing via quote',
        availability: 'https://schema.org/OnlineOnly',
      },
      url: BASE_URL,
    });

    // Track page view for analytics
    trackPageView(location.pathname, pageTitle);
  }, [location.pathname, title, description, keywords]);

  return null;
}
