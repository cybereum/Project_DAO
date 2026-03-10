import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageView } from '../lib/analytics';
import { BASE_URL, ROUTE_SEO } from '../config/routeManifest';

const SITE_NAME = 'Cybereum';
const OG_IMAGE = 'https://cdn.prod.website-files.com/6632a548562bd3696c947be1/66c8e5fdf48bbde6bc9ebe09_Blue_Logo_256.png';


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
