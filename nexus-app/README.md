# NEXUS App (Project_DAO Frontend)

NEXUS is the React/Vite frontend for `Project_DAO`.
It includes:

- public marketing + persona landing pages,
- the in-app governance console,
- and the Agent Economy transaction interface (native/token/NFT rails).

## Local development

```bash
npm install
cp .env.example .env
npm run dev
```

## Required environment variable

- `VITE_PROJECT_DAO_ADDRESS`: deployed `Project_DAO` contract address.

If this value is missing, the app gracefully falls back to local simulation for non-critical flows.

## Deployment readiness checks

Run the full frontend deployment gate:

```bash
npm run check:deploy
```

This runs:

1. `npm run lint`
2. `npm run check:seo` (generates and validates `public/sitemap.xml` from the route manifest)
3. `npm run build`

## Sitemap maintenance

Sitemap entries are generated from `src/config/routeManifest.js`.

```bash
npm run generate:sitemap
npm run check:seo
```
