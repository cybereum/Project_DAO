/**
 * Analytics and performance monitoring module for NEXUS Protocol.
 *
 * Drop-in setup: configure GA_MEASUREMENT_ID or PLAUSIBLE_DOMAIN
 * environment variables to activate tracking. Zero tracking runs
 * if neither is set (privacy-first default).
 */

const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID || '';
const PLAUSIBLE_DOMAIN = import.meta.env.VITE_PLAUSIBLE_DOMAIN || '';

// Google Analytics 4
function initGA(id) {
  if (!id || typeof window === 'undefined') return;

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  function gtag(...args) { window.dataLayer.push(args); }
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', id, {
    send_page_view: false, // we send manually per route change
  });
}

// Plausible Analytics (privacy-friendly alternative)
function initPlausible(domain) {
  if (!domain || typeof window === 'undefined') return;

  const script = document.createElement('script');
  script.async = true;
  script.defer = true;
  script.setAttribute('data-domain', domain);
  script.src = 'https://plausible.io/js/script.js';
  document.head.appendChild(script);
}

// Track page view
export function trackPageView(path, title) {
  if (GA_MEASUREMENT_ID && window.gtag) {
    window.gtag('event', 'page_view', {
      page_path: path,
      page_title: title,
    });
  }

  // Plausible tracks automatically via script
}

// Track custom events (wallet connect, vote cast, proposal submit, etc.)
export function trackEvent(eventName, params = {}) {
  if (GA_MEASUREMENT_ID && window.gtag) {
    window.gtag('event', eventName, params);
  }

  if (PLAUSIBLE_DOMAIN && window.plausible) {
    window.plausible(eventName, { props: params });
  }
}

// Web Vitals reporting
export function reportWebVitals() {
  if (typeof window === 'undefined') return;

  // Use Performance Observer for Core Web Vitals
  try {
    // Largest Contentful Paint
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
      trackEvent('web_vitals', { metric: 'LCP', value: Math.round(lastEntry.startTime) });
    });
    lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });

    // First Input Delay
    const fidObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach(entry => {
        trackEvent('web_vitals', { metric: 'FID', value: Math.round(entry.processingStart - entry.startTime) });
      });
    });
    fidObserver.observe({ type: 'first-input', buffered: true });

    // Cumulative Layout Shift
    let clsValue = 0;
    let clsReported = false;
    const clsObserver = new PerformanceObserver((list) => {
      list.getEntries().forEach(entry => {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
        }
      });
    });
    clsObserver.observe({ type: 'layout-shift', buffered: true });

    const reportFinalCLS = () => {
      if (clsReported) return;
      clsReported = true;
      clsObserver.disconnect();
      trackEvent('web_vitals', { metric: 'CLS', value: Math.round(clsValue * 1000) });
    };

    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        reportFinalCLS();
      }
    }, { once: true });

    window.addEventListener('pagehide', () => {
      reportFinalCLS();
    }, { once: true });
  } catch {
    // PerformanceObserver not supported
  }
}

// Initialize analytics
export function initAnalytics() {
  initGA(GA_MEASUREMENT_ID);
  initPlausible(PLAUSIBLE_DOMAIN);
  reportWebVitals();
}
