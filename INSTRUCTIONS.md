# Instructions de déploiement — StockBTP

## Fichiers dans ce ZIP

Copiez chaque fichier à sa destination dans votre projet :

```
DESTINATION DANS VOTRE PROJET          ← FICHIER DU ZIP
─────────────────────────────────────────────────────────
pnpm-workspace.yaml                    ← pnpm-workspace.yaml
package.json                           ← package.json
vercel.json                            ← vercel.json          (NOUVEAU)
railway.toml                           ← railway.toml         (NOUVEAU)
artifacts/mockup-sandbox/vite.config.ts ← artifacts/mockup-sandbox/vite.config.ts
artifacts/stock-pwa/vite.config.ts     ← artifacts/stock-pwa/vite.config.ts
```

## Étape obligatoire AVANT de déployer sur Vercel

Dans `vercel.json`, remplacez :
  https://VOTRE_URL_RAILWAY
par l'URL réelle de votre service Railway (ex: https://stock-btp-api.up.railway.app)

## Ordre de déploiement

1. Remplacez tous les fichiers listés ci-dessus
2. Déployez d'abord sur Railway (l'API)
3. Notez l'URL Railway
4. Mettez à jour vercel.json avec cette URL
5. Committez et déployez sur Vercel (le frontend)
6. Mettez à jour CORS_ORIGIN dans Railway avec l'URL Vercel

## Variables d'environnement Railway (à configurer dans le dashboard Railway)

NODE_ENV=production
SUPABASE_DATABASE_URL=<votre URL Supabase pooler port 6543>
SESSION_SECRET=<valeur aléatoire forte — générer avec: openssl rand -base64 48>
CORS_ORIGIN=https://<votre-app>.vercel.app
PORT=8080
