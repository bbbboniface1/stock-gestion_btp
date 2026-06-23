# StockBTP — Gestion de Stock BTP

Application PWA de gestion de stock pour entreprise de construction container.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — API server (port 8080)
- `pnpm --filter @workspace/stock-pwa run dev` — Frontend PWA
- `pnpm run typecheck` — typecheck complet
- `pnpm run build` — typecheck + build tous les packages
- `pnpm --filter @workspace/api-spec run codegen` — régénérer les hooks et schemas depuis l'OpenAPI spec
- `pnpm --filter @workspace/db run push` — appliquer les migrations DB (dev only)
- Env requis: `DATABASE_URL` — PostgreSQL connection string, `SESSION_SECRET` — secret HMAC pour auth

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 (port 8080, path `/api`)
- Frontend: React + Vite + Tailwind v4 (PWA installable)
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (depuis spec OpenAPI)
- Auth: email/password + token HMAC-SHA256 (stocké en localStorage key `stock_token`)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/api-server/` — serveur Express avec toutes les routes API
- `artifacts/stock-pwa/` — frontend React PWA (login, dashboard, produits, mouvements, projets, utilisateurs)
- `artifacts/api-server/src/routes/` — routes auth, products, stock-movements, projects, users, dashboard
- `artifacts/api-server/src/lib/auth.ts` — middleware JWT-like + hashPassword
- `lib/db/src/schema.ts` — schéma Drizzle (users, products, projects, stock_movements, project_materials)
- `lib/api-spec/openapi.yaml` — spec OpenAPI source de vérité
- `lib/api-client-react/src/generated/api.ts` — hooks React Query générés par Orval

## Architecture decisions

- Auth sans JWT lib externe : token = base64(`userId:role:timestamp:hmac`) vérifié côté serveur avec SESSION_SECRET
- Passwords hashés en SHA256 + sel statique "stockbtp_salt" (suffisant pour usage interne)
- Supabase secrets présents mais non utilisés — on utilise le PostgreSQL Replit natif (DATABASE_URL)
- Stock guard côté API : les sorties (OUT) sont refusées si quantité > stock actuel
- vite-plugin-pwa intégré pour PWA installable (manifest + service worker offline)

## Product

- **Login** : authentification email/password avec RBAC (admin/manager/worker)
- **Dashboard** : KPIs temps réel (produits totaux, alertes stock, mouvements du jour, projets actifs)
- **Produits** : liste avec filtres, création, boutons IN/OUT rapides, détail avec historique
- **Mouvements** : historique complet avec filtres type/produit/projet/date
- **Projets** : gestion projets, matériaux consommés par projet, changement de statut
- **Utilisateurs** : liste des comptes, création avec rôle
- **Paramètres** : profil connecté, infos application

## User preferences

- Interface en français
- Thème industriel BTP : fond béton foncé, accent orange construction, typographie monospace

## Gotchas

- Ne pas lancer `pnpm run dev` à la racine — chaque artifact a son propre workflow
- Après modification du schema DB, lancer `pnpm --filter @workspace/db run push`
- Après modification de l'OpenAPI spec, lancer `pnpm --filter @workspace/api-spec run codegen`
- vite-plugin-pwa 0.21.x a un peer warning avec Vite 7 — fonctionne quand même

## Comptes de test

| Email | Mot de passe | Rôle |
|---|---|---|
| admin@stockbtp.fr | admin123 | Admin |
| sophie.dupont@stockbtp.fr | manager123 | Manager |
| karim.benali@stockbtp.fr | worker123 | Ouvrier |

## Pointers

- Voir le skill `pnpm-workspace` pour la structure workspace, TypeScript, et détails packages
