import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BASE_URL, SITEMAP_ROUTES } from '../src/config/routeManifest.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sitemapPath = path.join(__dirname, '..', 'public', 'sitemap.xml');

const xml = fs.readFileSync(sitemapPath, 'utf-8');

const missing = SITEMAP_ROUTES
  .map((route) => route.path)
  .filter((route) => {
    const loc = `${BASE_URL}${route}`;
    return !xml.includes(`<loc>${loc}</loc>`);
  });

if (missing.length > 0) {
  console.error('❌ sitemap validation failed. Missing routes:');
  missing.forEach((route) => console.error(`  - ${route}`));
  process.exit(1);
}

console.log(`✅ sitemap validation passed (${SITEMAP_ROUTES.length} routes).`);
