# StockBTP

PWA de gestion de stock pour chantiers BTP — monorepo pnpm.

## Stack

- **Frontend** : React + Vite + Tailwind CSS (`artifacts/stock-pwa`)
- **Backend** : Express.js + Drizzle ORM (`artifacts/api-server`)
- **Base de données** : Supabase PostgreSQL
- **Libs partagées** : `lib/db`, `lib/api-zod`, `lib/api-spec`, `lib/api-client-react`

## Déploiement cible

- API → Railway (`railway.toml`)
- Frontend → Vercel (`vercel.json`)

## Variables d'environnement requises

| Variable | Description |
|---|---|
| `SUPABASE_DATABASE_URL` | URL pooler Supabase (port 6543) |
| `SESSION_SECRET` | Secret de signature des tokens |
| `CORS_ORIGIN` | URL du frontend en production |
| `PORT` | Port de l'API (défaut : 8080) |

## Commandes utiles

```bash
pnpm db:push      # Appliquer le schéma Drizzle sur Supabase
pnpm db:migrate   # Appliquer la migration SQL production
pnpm db:seed      # Créer comptes de test et données démo
pnpm test         # Lancer tous les tests
```

## User preferences

- Aucune importation Replit dans le code source
- Aucune modification de logique pouvant nuire au déploiement sur Render ou Vercel
