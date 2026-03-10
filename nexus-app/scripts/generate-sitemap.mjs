import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BASE_URL, SITEMAP_ROUTES } from '../src/config/routeManifest.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sitemapPath = path.join(__dirname, '..', 'public', 'sitemap.xml');

const lastmod = new Date().toISOString().slice(0, 10);

const entries = SITEMAP_ROUTES.map((route) => {
  const loc = `${BASE_URL}${route.path}`;
  return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${route.sitemap.changefreq}</changefreq>\n    <priority>${route.sitemap.priority}</priority>\n  </url>`;
}).join('\n\n');

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n\n${entries}\n\n</urlset>\n`;

fs.writeFileSync(sitemapPath, xml, 'utf-8');
console.log(`✅ sitemap generated with ${SITEMAP_ROUTES.length} routes -> ${sitemapPath}`);
