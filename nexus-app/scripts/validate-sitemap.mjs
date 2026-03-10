import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sitemapPath = path.join(__dirname, '..', 'public', 'sitemap.xml');

const requiredRoutes = [
  '/',
  '/pulse',
  '/agents',
  '/builders',
  '/ngo',
  '/enterprise',
  '/cities',
  '/agent-economy',
  '/dashboard',
  '/projects',
  '/proposals',
  '/verification',
  '/reputation',
  '/milestones',
  '/assets',
];

const xml = fs.readFileSync(sitemapPath, 'utf-8');

const missing = requiredRoutes.filter((route) => {
  const loc = `https://www.cybereum.io${route}`;
  return !xml.includes(`<loc>${loc}</loc>`);
});

if (missing.length > 0) {
  console.error('❌ sitemap validation failed. Missing routes:');
  missing.forEach((route) => console.error(`  - ${route}`));
  process.exit(1);
}

console.log('✅ sitemap validation passed.');
