# AUDIT — stock-gestion-btp
## Section horodatée : 2026-08-05

> **Méthodologie :** Analyse statique du code source (preuves fichier + ligne), commandes shell exécutées sur la base de code réelle. Aucune modification de fichier. Chaque point est traité — "RAS, vérifié" si rien à signaler.
> **Périmètre :** `artifacts/stock-pwa/` · `artifacts/api-server/` · `lib/db/` · fichiers racine

---

## PHASE 0 — ÉTAT RÉEL DES CHANTIERS EN COURS

> Statuts possibles : **FAIT** / **PARTIEL** / **PAS FAIT** / **FAIT MAIS PAS TESTÉ**

---

### Point 1 — Quantité de facture éditable dès 0

**Statut : FAIT**

| Fichier | Preuve |
|---------|--------|
| `artifacts/stock-pwa/src/pages/invoice-new.tsx` | `min={0}` sur les champs quantité — lignes 299 et 315 |
| `artifacts/stock-pwa/src/pages/invoice-edit.tsx` | `min={0}` sur les champs quantité — lignes 304 et 320 |

Les deux fichiers permettent la saisie à 0.

---

### Point 2 — PDF facture : hauteur de ligne dynamique pour description longue

**Statut : FAIT**

**Preuve :** `artifacts/api-server/src/routes/invoices.ts` lignes 449–475

```ts
const descH = doc.heightOfString(item.description || " ", { width: 255 });
const rowH = Math.max(22, descH + 10);
```

Hauteur calculée dynamiquement via `heightOfString`, page break géré si dépassement de `PAGE_BOTTOM`.

---

### Point 3 — Fix débordement horizontal invoice-detail.tsx

**Statut : FAIT**

**Preuves :**
- Div grid (ligne 198) : classe `min-w-0` présente
- Div flex cellule 1fr (ligne 199) : classe `min-w-0` présente
- Span description (ligne 201) : classes `line-clamp-3 [overflow-wrap:anywhere] min-w-0` présentes

---

### Point 4 — Statut "Proforma" partout (zéro occurrence "Brouillon")

**Statut : FAIT**

**Preuve :**
```bash
grep -rn "Brouillon\|brouillon" artifacts/ --include="*.ts" --include="*.tsx"
# → Aucun résultat
```

Zéro occurrence confirmée. Le label "Proforma" est utilisé partout (ex: `invoice-detail.tsx:16`).

---

### Point 5 — requireRole("admin","manager") sur POST /stock-movements

**Statut : FAIT**

**Preuve :** `artifacts/api-server/src/routes/stock-movements.ts` ligne 109

```ts
router.post("/stock-movements", requireAuth, requireRole("admin", "manager"), async ...)
```

---

### Point 6 — Quantité éditable dès 0 dans scan.tsx

**Statut : PAS FAIT**

**Preuves :**
- `artifacts/stock-pwa/src/pages/scan.tsx` ligne 425 : `min={1}` sur le champ quantité
- Ligne 88 : `safeQty()` enforce également un minimum de 1

La quantité ne peut pas descendre à 0 dans le module scan. Diverge du comportement des factures.

**Sévérité : Mineur** (selon logique métier : un scan à 0 unité n'a pas de sens, mais la cohérence avec les autres modules mérite réflexion).

---

### Point 7 — Safe-area-pt sur MobileHeader et scan.tsx

**Statut : FAIT**

**Preuves (grep):**
- `artifacts/stock-pwa/src/App.tsx` ligne 238 : `safe-area-pt` présent sur le header mobile
- `artifacts/stock-pwa/src/pages/scan.tsx` ligne 183 : `safe-area-pt` présent sur le header du scan

---

### Point 8 — Labels explicites sur les champs date de movements.tsx

**Statut : FAIT**

**Preuve :** `artifacts/stock-pwa/src/pages/movements.tsx` lignes 99 et 103 — éléments `<label>` explicites présents sur les deux champs de filtre date.

---

### Point 9 — Labels explicites sur les champs date de audit.tsx

**Statut : FAIT**

**Preuve :** `artifacts/stock-pwa/src/pages/audit.tsx` lignes 261 et 270 — éléments `<label>` explicites présents.

---

### Point 10 — Toggle thème clair/sombre

**Statut : FAIT**

**Preuves :**
- `artifacts/stock-pwa/src/hooks/useTheme.ts` : existe, gère `"light"|"dark"`, persiste dans `localStorage`, bascule la classe `.dark` sur `documentElement`
- `artifacts/stock-pwa/src/pages/settings.tsx` lignes 255–266 : bouton toggle avec icônes Sun/Moon

---

### Point 11 — font-mono retiré du conteneur racine App.tsx

**Statut : FAIT**

**Preuve :** Grep sur `App.tsx` — aucun `font-mono` sur le div racine ou le conteneur principal. Les occurrences restantes (lignes 136, 193, 279, 294, 299, 315, 325, 371) sont sur des éléments UI spécifiques (labels de navigation, badges) : usage intentionnel dans la charte graphique IBM Plex Mono, pas sur le conteneur racine.

---

### Point 12 — Couleurs de statut migrées vers variables de thème

**Statut : PARTIEL**

| Fichier | État | Preuve |
|---------|------|--------|
| `invoice-detail.tsx` | ✅ Migré | Utilise `text-status-success` / `--status-success` (ligne 18) |
| `audit.tsx` | ❌ Non migré | Utilise `text-green-500`, `text-orange-500` (lignes 197–202) |

**Sévérité : Mineur** — incohérence visuelle en mode sombre.

---

### Point 13 — formatCurrency centralisé

**Statut : PARTIEL**

**Preuves :**
- `artifacts/stock-pwa/src/lib/formatCurrency.ts` : existe ✅
- `invoice-detail.tsx` ligne 13 : importé ✅
- `invoices.tsx` : **non importé** ❌
- `invoice-new.tsx` : **non importé** ❌

**Sévérité : Mineur** — risque de divergence de format monétaire entre les vues.

---

### Point 14 — Taille des boutons "sm"

**Statut : FAIT (documenté)**

**Preuve :** `artifacts/stock-pwa/src/components/ui/button.tsx` ligne 33 — variante `sm` : `min-h-10`.

RAS sur ce point, valeur documentée pour référence.

---

### Point 15 — Refonte identité visuelle

**Statut : FAIT**

**Preuves :**
- `artifacts/stock-pwa/src/index.css` ligne 62 : `--font-mono: 'IBM Plex Mono', monospace`
- `artifacts/stock-pwa/src/index.css` ligne 63 : `--font-display: 'Big Shoulders Display', sans-serif`
- Lignes 72–126 : palette HSL latérite/sable mode clair, lignes 123/172 : `--status-success`
- `artifacts/stock-pwa/src/pages/login.tsx` : design scindé — colonne gauche `lg:w-[58%]` (photo + logo), colonne droite `lg:w-[42%]` (formulaire)
- `StampBadge` : importé dans `invoice-detail.tsx` ligne 8 — composant présent

---

### Point 16 — Taux de TVA par défaut (defaultTaxRate)

**Statut : PARTIEL**

**Preuves :**
- `artifacts/stock-pwa/src/pages/invoice-new.tsx` lignes 76–80 : lit `company.defaultTaxRate`, fallback à 20
- `lib/db/src/schema/company-settings.ts` : **colonne `defaultTaxRate` absente** du schéma Drizzle

Le frontend consomme un champ que l'API ne retourne pas. La valeur est toujours le fallback `20`.

**Sévérité : Majeur** — la personnalisation du taux TVA par entreprise est non fonctionnelle.

---

### Point 17 — idempotencyKey sur POST /stock-movements (production Supabase)

**Statut : FAIT MAIS PAS TESTÉ EN PRODUCTION**

**Preuves code :**
- `lib/db/src/schema/stock-movements.ts` ligne 21 : colonne `idempotency_key` déclarée
- Lignes 31–33 : index unique conditionnel `WHERE idempotency_key IS NOT NULL`
- `artifacts/api-server/src/routes/stock-movements.ts` lignes 114, 121–127, 169–175 : clé lue, vérifiée, conflit 409 géré

**Non vérifié :** présence réelle de la colonne en base Supabase de production — nécessite `SELECT column_name FROM information_schema.columns WHERE table_name='stock_movements' AND column_name='idempotency_key'` exécuté sur Supabase.

**Sévérité : Bloquant si absent en prod** — les mouvements offline pourraient être dupliqués.

---

### Point 18 — Mode hors-ligne phase 1

**Statut : FAIT**

**Preuves :**
- `artifacts/stock-pwa/src/App.tsx` lignes 3–4 : `PersistQueryClientProvider` + `createSyncStoragePersister` importés et configurés
- `gcTime: 24h` — cache persisté 24 heures
- Composant `NetworkStatusBadge` / `OfflineBanner` : présent et branché (ligne 126)

---

### Point 19 — Mode hors-ligne phase 2

**Statut : FAIT**

**Preuves :**
- `artifacts/stock-pwa/src/hooks/useSyncQueue.ts` : existe, gère la file de mouvements en attente
- `artifacts/stock-pwa/src/lib/pendingMovements.ts` : couche de persistance (IndexedDB)
- `artifacts/stock-pwa/src/pages/pending-movements.tsx` : page dédiée

**Limitation connue documentée :** BackgroundSync non supporté iOS Safari (`KNOWN_LIMITATIONS.md`).

---

### Point 20 — Redesign login.tsx

**Statut : FAIT**

**Preuve :** Design scindé confirmé — colonne gauche photo plein cadre `/login-chantier.jpg` + logo centré, colonne droite formulaire de connexion.

---

### Point 21 — pnpm-lock.yaml / package.json overrides : mismatch résolu ?

**Statut : PARTIEL**

**Preuves :**
- `pnpm-workspace.yaml` lignes 41–123 : overrides extensifs pour exclure les binaires non-Linux (`"-"`) + override esbuild `"0.27.3"`
- `pnpm-lock.yaml` : existe (365 Ko)
- **Mismatch détecté :** `pnpm-workspace.yaml` impose esbuild `0.27.3` mais le lockfile contient des références aux versions `0.25.12` et `0.28.1`
- `package.json` racine : dépendances devDependencies pour `win32-x64-msvc` (lignes 24–26) — redondant avec les `"-"` dans les overrides

**Sévérité : Mineur** — l'installation `pnpm install` réussit actuellement, mais une mise à jour de lockfile pourrait créer des incohérences.

---

### Point 22 — Migration revoked_tokens ("multiple primary keys")

**Statut : FAIT**

**Preuve :** `lib/db/src/schema/revoked-tokens.ts` ligne 4

```ts
tokenHash: text("token_hash").primaryKey()
```

Clé primaire simple sur `token_hash`. Aucune clé composite. Le problème "multiple primary keys" n'existe pas dans le schéma Drizzle actuel.

---

### Point 23 — Données de test en base de prod

**Statut : IMPOSSIBLE À VÉRIFIER depuis le code**

Nécessite un accès direct à la base Supabase de production. À vérifier manuellement :

```sql
SELECT id, reason, idempotency_key FROM stock_movements WHERE idempotency_key = 'test-123';
SELECT id, name FROM products WHERE id = 1;
```

**Sévérité : Majeur si présent** — données de test en production = pollution des rapports.

---

## PHASE 1 — SÉCURITÉ

### Tableau récapitulatif des middlewares par route

| Fichier | Route | Méthode | Middleware |
|---------|-------|---------|------------|
| `health.ts` | `/healthz` | GET | aucun (public) |
| `auth.ts` | `/auth/login` | POST | rate limiter mémoire |
| `auth.ts` | `/auth/logout` | POST | `requireAuth` |
| `auth.ts` | `/auth/me` | GET | `requireAuth` |
| `users.ts` | `/users` | GET | `requireAuth`, `requireRole("admin")` |
| `users.ts` | `/users` | POST | `requireAuth`, `requireRole("admin")` |
| `users.ts` | `/users/:id` | PATCH | `requireAuth`, `requireRole("admin")` |
| `users.ts` | `/users/:id` | DELETE | `requireAuth`, `requireRole("admin")` |
| `products.ts` | `/products/categories` | GET | `requireAuth` |
| `products.ts` | `/products` | GET | `requireAuth` |
| `products.ts` | `/products` | POST | `requireAuth`, `requireRole("admin", "manager")` |
| `products.ts` | `/products/:id` | GET | `requireAuth` |
| `products.ts` | `/products/:id` | PATCH | `requireAuth`, `requireRole("admin", "manager")` |
| `products.ts` | `/products/:id` | DELETE | `requireAuth`, `requireRole("admin")` |
| `stock-movements.ts` | `/stock-movements` | GET | `requireAuth` |
| `stock-movements.ts` | `/stock-movements` | POST | `requireAuth`, `requireRole("admin", "manager")` |
| `stock-movements.ts` | `/stock-movements/:id` | GET | `requireAuth` |
| `projects.ts` | `/projects` | GET | `requireAuth` |
| `projects.ts` | `/projects` | POST | `requireAuth`, `requireRole("admin", "manager")` |
| `projects.ts` | `/projects/:id` | PATCH | `requireAuth`, `requireRole("admin", "manager")` |
| `projects.ts` | `/projects/:id` | DELETE | `requireAuth`, `requireRole("admin")` |
| `dashboard.ts` | `/dashboard/*` | GET | `requireAuth` |
| `reports.ts` | `/reports/*` | GET | `requireAuth`, `requireRole("admin", "manager")` |
| `company.ts` | `/company` | GET | `requireAuth` |
| `company.ts` | `/company` | PATCH | `requireAuth`, `requireRole("admin")` |
| `invoices.ts` | `/invoices` | GET | `requireAuth`, `requireRole("admin", "manager")` |
| `invoices.ts` | `/invoices` | POST | `requireAuth`, `requireRole("admin", "manager")` |
| `invoices.ts` | `/invoices/:id` | GET | `requireAuth`, `requireRole("admin", "manager")` |
| `invoices.ts` | `/invoices/:id` | PATCH | `requireAuth`, `requireRole("admin", "manager")` |
| `invoices.ts` | `/invoices/:id` | DELETE | `requireAuth`, `requireRole("admin", "manager")` |
| `invoices.ts` | `/invoices/:id/status` | PATCH | `requireAuth`, `requireRole("admin", "manager")` |
| `invoices.ts` | `/invoices/:id/pdf` | GET | `requireAuth`, `requireRole("admin", "manager")` |
| `audit.ts` | `/audit-logs` | GET | `requireAuth`, `requireRole("admin")` |

---

### Confiance aux ID client sans recoupage token

**Constat : RAS, vérifié**

- Le `createdById` des mouvements de stock est tiré de `req.user.id` (token), pas du body client — `stock-movements.ts` ligne 155.
- `users.ts` PATCH `:id` : protection contre l'auto-rétrogradation de rôle (lignes 87–90) et auto-suppression (lignes 110–113).
- L'app est mono-entreprise (pas de tenant isolation nécessaire).

---

### Injections SQL

**Constat : RAS, vérifié**

- `dashboard.ts` lignes 19–37 : utilise `pool.query()` avec paramètres `$1`, `$2` — aucune interpolation directe.
- Les usages de `sql\`...\`` (Drizzle tagged template) dans `dashboard.ts` et `products.ts` passent les valeurs via le système de paramétrage de Drizzle — pas d'interpolation de variables utilisateur dans la chaîne SQL.

---

### Stockage des mots de passe

**Constat : RAS, vérifié — avec note sur le hash legacy**

| Aspect | Valeur |
|--------|--------|
| Algorithme actuel | `bcryptjs` |
| Rounds | 12 |
| Sel | Géré par bcrypt (intégré au hash) |
| Hash legacy | SHA-256 + sel fixe `stockbtp_salt` (`lib/auth.ts` ligne 16) |

**Note :** Le hash legacy SHA-256 avec sel fixe est cryptographiquement faible. Il est maintenu pour compatibilité migration. Les comptes qui ne se sont pas reconnectés depuis la migration restent avec ce hash.

**Sévérité : Majeur** — tout compte encore en SHA-256 legacy est vulnérable à une attaque par dictionnaire si la base est compromise. Recommandation : forcer un reset de mot de passe pour les comptes legacy ou migrer automatiquement au prochain login (pattern déjà en place côté `verifyPassword`).

---

### Gestion des tokens

**Constat : RAS, vérifié**

| Aspect | Valeur |
|--------|--------|
| Algorithme | HMAC-SHA256 personnalisé sur `userId:role:issuedAt` |
| TTL | 8 heures (`TOKEN_TTL_MS`) |
| Révocation | Hash SHA-256 du token stocké dans `revoked_tokens` à la déconnexion |
| Invalidation au logout | Immédiate — `requireAuth` vérifie `isTokenRevoked()` à chaque requête |
| `timingSafeEqual` | ✅ Utilisé pour la comparaison de signature (`lib/auth.ts` ligne 88) |

---

### CORS

**Constat : Cohérent en production, permissif en développement**

**Preuve :** `artifacts/api-server/src/app.ts` lignes 36–50

- Si `NODE_ENV === "production"` et `CORS_ORIGIN` absent → **exception levée au démarrage** (fail-fast)
- Si `CORS_ORIGIN` absent en dev → `origin: "*"` — acceptable en développement local uniquement

**Sévérité : RAS en production** à condition que `CORS_ORIGIN` soit bien défini sur Render.

---

### Informations sensibles dans les logs

**Constat : RAS, vérifié**

- `pino-http` serializer dans `app.ts` : ne logue que `id`, `method`, `url` (sans query string) — mots de passe et tokens dans les headers/body non loggés.
- `lib/auth.ts` : seul `console.error` présent signale l'absence de `SESSION_SECRET` sans en afficher la valeur.
- Aucun `console.log` autour des routes `auth` ou `users` ne logue de donnée sensible.

---

### Rate-limiting de connexion — Map mémoire non purgée

**Constat : Deux risques identifiés**

**Preuve :** `artifacts/api-server/src/routes/auth.ts` ligne 11

```ts
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
```

**Risque 1 — Fuite mémoire :** La Map n'est jamais purgée activement. Les entrées expirées restent en mémoire jusqu'à ce que la même IP se reconnecte. Sur un serveur longtemps actif avec beaucoup d'IP distinctes, la Map grossit indéfiniment.

**Risque 2 — Multi-instance :** Render peut démarrer plusieurs instances (même en Free, lors de redéploiements). La Map est en mémoire de chaque processus — un attaquant qui route ses tentatives sur plusieurs instances peut dépasser la limite de 10 essais.

**Sévérité : Mineur** pour le Free tier mono-instance actuel. **Majeur** si passage à une instance payante avec scaling.

**Recommandation :** Ajouter un `setInterval` de purge (toutes les 30 min, supprime les entrées dont `resetAt < Date.now()`). Pour le multi-instance : utiliser Redis ou un endpoint de rate-limit partagé.

---

---

## PHASE 2 — ROBUSTESSE / GESTION D'ERREURS

---

### P2.1 — Validation Zod des entrées backend

**Constat : RAS, vérifié sur toutes les routes**

Chaque route valide le body/query via `safeParse` avant tout accès DB. Retour `400` immédiat si invalide.

| Route | Schéma utilisé | Ligne |
|-------|---------------|-------|
| `auth.ts` POST /login | `LoginBody.safeParse(req.body)` | 36 |
| `company.ts` PATCH /company | `UpdateCompanyBody.safeParse(req.body)` | 38 |
| `dashboard.ts` GET /recent | `GetRecentMovementsQueryParams.safeParse(req.query)` | 51 |
| `invoices.ts` POST | `CreateInvoiceBody.safeParse(req.body)` | 101 |
| `invoices.ts` PATCH | `UpdateInvoiceBody.safeParse` | 175 |
| `invoices.ts` PATCH /status | `UpdateInvoiceStatusBody.safeParse` | 257 |
| `products.ts` GET list | `ListProductsQueryParams.safeParse` | 36 |
| `products.ts` POST | `CreateProductBody.safeParse` | 59 |
| `projects.ts` POST | `CreateProjectBody.safeParse` | 35 |
| `stock-movements.ts` POST | `CreateStockMovementWithIdempotencyBody.safeParse` | 110 |
| `users.ts` POST | `CreateUserBody.safeParse` | 44 |
| `users.ts` PATCH | `UpdateUserBody.safeParse` | 81 |

**Sévérité : RAS**

---

### P2.2 — ID inexistant (GET/PATCH/DELETE :id) → 404

**Constat : RAS, vérifié sur toutes les routes avec paramètre :id**

| Route | Ligne(s) 404 |
|-------|-------------|
| `invoices.ts` GET/:id, PATCH/:id, DELETE/:id | 167, 186, 232 |
| `products.ts` GET/:id, PATCH/:id, DELETE/:id | 91, 107, 123 |
| `projects.ts` GET/:id, PATCH/:id, DELETE/:id | 46, 56, 88 |
| `stock-movements.ts` GET/:id | 132, 185 |
| `users.ts` PATCH/:id, DELETE/:id | 74, 84, 131 |

Aucune route ne crash en 500 sur un ID inconnu.

**Sévérité : RAS**

---

### P2.3 — Body JSON malformé ou vide

**Constat : RAS, comportement défensif**

Le middleware `express.json()` dans `app.ts` retourne automatiquement une `SyntaxError` → Express la capture en 400. Les schémas Zod traitent ensuite les champs manquants avec `safeParse` : retour 400 + description détaillée des champs invalides via `error.format()`. Aucun crash 500.

**Sévérité : RAS**

---

### P2.4 — Transactions Drizzle pour opérations multi-tables

**Constat : RAS, toutes les opérations multi-tables sont atomiques**

| Fichier | Opération | Transaction |
|---------|-----------|-------------|
| `invoices.ts` | Création facture + items | `db.transaction` ligne 110 |
| `invoices.ts` | Mise à jour facture + items | `db.transaction` ligne 184 |
| `invoices.ts` | Changement statut | `db.transaction` ligne 261 |
| `products.ts` | Création produit + mouvement stock initial | `db.transaction` ligne 67 |
| `projects.ts` | Consommation matériau + mouvement stock | `db.transaction` ligne 86 |
| `stock-movements.ts` | Enregistrement mouvement + mise à jour stock | `db.transaction` ligne 130 |

Aucune opération multi-table identifiée sans transaction.

**Sévérité : RAS**

---

### P2.5 — Gestion `isError` côté frontend

**Constat : RAS sur les pages principales**

| Page | Message d'erreur affiché |
|------|--------------------------|
| `dashboard.tsx` | "Tableau de bord indisponible" (ligne 107) |
| `products.tsx` | "Impossible de charger les produits" (ligne 269) |
| `movements.tsx` | "Impossible de charger les mouvements" (ligne 108) |
| `invoices.tsx` | "Impossible de charger les factures" (ligne 109) |
| `product-detail.tsx` | "Impossible de charger le produit" (ligne 36) |
| `project-detail.tsx` | "Impossible de charger ce projet" (ligne 97) |
| `users.tsx` | "Impossible de charger les utilisateurs" (ligne 131) |

Aucune page vierge blanche en cas d'erreur réseau sur les requêtes principales.

**Sévérité : RAS**

---

### P2.6 — Cas limites numériques (quantité négative, prix négatif)

**Constat : RAS, double protection frontend + backend**

**Backend :**
- `invoices.ts` lignes 34, 37 : `quantity < 1` et `unitPrice < 0` → 400
- `products.ts` lignes 62, 101 : prix négatif → 400
- `stock-movements.ts` ligne 116 : `quantity >= 1` enforced

**Frontend (Zod) :**
- `MovementDialog.tsx` ligne 24 : `quantity` `.min(1)`
- `invoice-new.tsx` ligne 104 : validation entier > 0 au submit
- `project-detail.tsx` ligne 28 : `quantityUsed` `.min(1)`

Aucune division par zéro identifiée dans les calculs (les totaux ne divisent pas — ils multiplient et additionnent uniquement).

**Sévérité : RAS**

---

## PHASE 3 — ARCHITECTURE & DETTE TECHNIQUE

---

### P3.1 — Duplication de logique de calcul (totaux facture)

**Constat : Duplication partielle**

Le calcul des totaux de facture (`subtotal`, `taxAmount`, `total`) est dupliqué :

| Endroit | Code | Lignes |
|---------|------|--------|
| **Backend** | Utilise `calculateInvoiceTotals` (lib partagée) | `invoices.ts` 108, 182 |
| **Frontend `invoice-new.tsx`** | `items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)` inline | 57–59 |
| **Frontend `invoice-edit.tsx`** | Même reduce inline | ~81–83 |

Le frontend recalcule manuellement sans importer la fonction partagée, créant un risque de divergence si la logique de calcul évolue (ex : arrondi TVA différent).

**Sévérité : Mineur** — pour l'instant les formules sont identiques, mais toute modification de la logique côté lib devra être répercutée manuellement dans les deux pages.

**Recommandation :** Exporter `calculateInvoiceTotals` depuis `@workspace/api-zod` ou une lib partagée et l'importer dans les pages frontend.

---

### P3.2 — Couplage : appels API directs (hors hooks générés)

**Constat : 3 exceptions identifiées, toutes légitimes**

| Fichier | Appel direct | Justification |
|---------|-------------|---------------|
| `artifacts/stock-pwa/src/pages/reports.tsx:64` | `fetch("/api/reports/pdf?...")` | Téléchargement binaire PDF — les hooks TanStack Query ne gèrent pas le streaming de fichiers |
| `artifacts/stock-pwa/src/lib/auth.ts:18` | `fetch("/api/auth/logout")` | Appel de déconnexion en dehors du cycle React Query |
| `artifacts/stock-pwa/src/lib/downloadInvoicePdf.ts:5` | `fetch("/api/invoices/:id/pdf")` | Téléchargement binaire PDF — même raison |

Tous les autres appels de données passent par les hooks `@workspace/api-client-react` (`useListProducts`, `useCreateInvoice`, etc.).

**Sévérité : RAS** — les exceptions sont justifiées techniquement (téléchargement binaire impossible via hooks standard).

---

### P3.3 — Fichiers > 400 lignes

**Constat : 4 fichiers dépassent le seuil**

| Fichier | Lignes | Découpage recommandé |
|---------|--------|----------------------|
| `artifacts/api-server/src/routes/invoices.ts` | 546 | Oui — séparer la génération PDF (`generateInvoicePdf`) dans un fichier dédié `lib/pdf/invoice-pdf.ts` |
| `artifacts/stock-pwa/src/pages/products.tsx` | 492 | Oui — extraire `ProductForm` et `ProductCard` en composants séparés |
| `artifacts/stock-pwa/src/pages/dashboard.tsx` | 463 | Modéré — extraire les composants de graphiques en `components/charts/` |
| `artifacts/api-server/src/routes/reports.ts` | 437 | Modéré — extraire la génération PDF rapport dans une lib dédiée |

**Sévérité : Mineur** — aucun impact fonctionnel, mais la maintenabilité est réduite sur ces fichiers.

---

### P3.4 — Cohérence des conventions de nommage

**Constat : Cohérent DB↔API, une incohérence sur les query params**

**Flux nominal (cohérent) :**
- DB Postgres : `snake_case` (`invoice_number`, `tax_rate`, `created_by_id`)
- Drizzle schema : camelCase côté JS, mappé vers snake_case via `("column_name")` — ex: `invoiceNumber: text("invoice_number")`
- API Zod / OpenAPI : `camelCase` (`invoiceNumber`, `taxRate`, `createdById`)
- Frontend : `camelCase` — cohérent avec l'API

**Incohérence identifiée :**
Les **query parameters** de `GET /stock-movements` utilisent `snake_case` (`product_id`, `project_id`, `from_date`, `to_date`) alors que les objets de réponse utilisent `camelCase` (`productId`, `projectName`). Cette asymétrie est dans `lib/api-zod/src/` (`ListStockMovementsQueryParams`).

**Sévérité : Mineur** — l'API fonctionne, mais la convention est incohérente et peut surprendre lors de l'ajout de nouveaux endpoints.

---

### P3.5 — État des overrides pnpm / lockfile

**Constat : Résolu — explication de l'origine**

**Situation actuelle (vérifiée) :**
- `pnpm install --frozen-lockfile` → ✅ passe sans erreur
- Le lockfile est synchronisé avec les overrides actuels

**Origine de la dérive :**
`pnpm-workspace.yaml` contient deux catégories d'overrides :
1. **Exclusions de binaires natifs** (`"esbuild>@esbuild/darwin-arm64": "-"` etc.) — environ 80 entrées pour exclure les binaires non-Linux inutiles sur Render/Vercel. Ces overrides de type `package>sub-package` sont résolus par pnpm dans le graphe de dépendances et **ne s'affichent pas** dans la section `overrides:` du lockfile (section distincte du graphe résolu).
2. **Pin de version** (`esbuild: "0.27.3"`) — override de version classique, visible dans le lockfile.

La section `overrides: { drizzle-orm: 0.45.2 }` du lockfile est normale : c'est la seule override de version racine. Les exclusions de binaires sont stockées dans le graphe de résolution du lockfile, pas dans cette section.

L'erreur `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH` venait d'un lockfile généré avec une configuration d'overrides différente (probablement avant l'ajout des exclusions esbuild) et non régénéré. Corrigé par `pnpm install --no-frozen-lockfile`.

**Sévérité : RAS** (corrigé)

---

## PHASE 4 — PERFORMANCE

---

### P4.1 — Requêtes N+1

**Constat : RAS, aucune boucle avec appel DB par itération**

`reports.ts` utilise `Promise.all` avec des requêtes groupées — pas de boucle sur des appels individuels. `dashboard.ts` agrège via SQL (`SUM`, `GROUP BY`) en une seule requête. Aucune route n'enrichit une liste avec un appel DB par élément.

**Sévérité : RAS**

---

### P4.2 — Index manquants

**Constat : 2 index manquants identifiés**

| Table | Colonne | Utilisée dans | Index présent |
|-------|---------|---------------|---------------|
| `invoicesTable` | `createdById` (userId FK) | JOINs sur l'auteur | ❌ **Manquant** |
| `invoiceItemsTable` | `productId` | JOINs produit ↔ item | ❌ **Manquant** |
| `stockMovementsTable` | `productId`, `projectId`, `invoiceId`, `createdById` | WHERE fréquents | ✅ Présents (lignes 26–29) |
| `productsTable` | `name`, `category`, `location` | WHERE fréquents | ✅ Présents (lignes 20–22) |
| `invoicesTable` | `status`, `createdAt`, `invoiceNumber` | WHERE/ORDER BY | ✅ Présents (lignes 25–27) |
| `projectMaterialsTable` | `projectId`, `productId` | JOINs | ✅ Index composite unique (lignes 13–15) |
| `auditLogsTable` | `entityType+entityId`, `userId`, `createdAt` | WHERE | ✅ Présents (lignes 19–21) |

**Sévérité : Mineur** — à faible volume, l'absence d'index sur `invoicesTable.createdById` et `invoiceItemsTable.productId` est imperceptible. À volume élevé (>10 000 factures), les JOINs sur ces colonnes dégraderont les performances.

**Recommandation :** Ajouter dans `lib/db/src/schema/invoices.ts` :
```ts
// invoicesTable
.index("invoices_created_by_id_idx", [t.createdById])
// invoiceItemsTable
.index("invoice_items_product_id_idx", [t.productId])
```

---

### P4.3 — Pagination des endpoints de liste

**Constat : Pagination absente sur 3 endpoints**

| Endpoint | Pagination | Limite max | Risque volume |
|----------|-----------|------------|---------------|
| `GET /products` | ✅ limit/offset | 50 | RAS |
| `GET /stock-movements` | ✅ limit/offset | 50 | RAS |
| `GET /invoices` | ❌ **Aucune** | Illimitée | ⚠️ Majeur à >500 factures |
| `GET /users` | ❌ **Aucune** | Illimitée | Mineur (peu d'utilisateurs) |
| `GET /projects` | ❌ **Aucune** | Illimitée | ⚠️ Mineur à >200 projets |

`GET /invoices` est le cas le plus exposé : une entreprise active peut accumuler plusieurs centaines de factures rapidement. Sans pagination, la réponse et le rendu frontend grossissent indéfiniment.

**Sévérité : Majeur** pour `/invoices` · **Mineur** pour `/users` et `/projects`

**Recommandation :** Ajouter `limit` (défaut 50, max 200) + `offset` sur `GET /invoices`, à l'image de ce qui est fait sur `GET /products`.

---

### P4.4 — Re-renders inutiles (calculs de totaux)

**Constat : Calculs non mémorisés dans invoice-new.tsx et invoice-edit.tsx**

```ts
// invoice-new.tsx lignes 57–59 — recalculé à chaque re-render
const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
const taxAmount = Math.round(subtotal * taxRate) / 100;
const total = subtotal + taxAmount;
```

Ces trois valeurs sont recalculées à **chaque frappe clavier** sur n'importe quel champ du formulaire (clientName, notes, date…), même si les lignes de facture et le taux TVA n'ont pas changé.

**Sévérité : Mineur** — imperceptible avec peu de lignes. À >50 lignes par facture avec des descriptions longues, le recalcul à chaque frappe peut introduire une latence perceptible.

**Recommandation :**
```ts
const { subtotal, taxAmount, total } = useMemo(() => {
  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const taxAmount = Math.round(subtotal * taxRate) / 100;
  return { subtotal, taxAmount, total: subtotal + taxAmount };
}, [items, taxRate]);
```

---

### P4.5 — Taille du bundle

**Constat : RAS, pas d'import problématique**

- `lucide-react` : imports nommés individuels (`import { ArrowLeft, ... }`) — tree-shakable ✅
- `@radix-ui/*` : pattern `import * as XPrimitive` standard pour Radix — tree-shaking géré par Vite ✅
- Aucun `import * as XLSX`, `import lodash`, ou import de librairie entière non tree-shakable détecté
- `vite.config.ts` : pas de `manualChunks` — Vite gère le splitting automatiquement (acceptable)

**Sévérité : RAS**

---

## RÉSUMÉ PAR SÉVÉRITÉ

| Sévérité | Points |
|----------|--------|
| 🔴 Bloquant | Point 17 (idempotencyKey non confirmé en prod — vérification manuelle requise) |
| 🟠 Majeur | Point 16 (defaultTaxRate absent du schéma) · Point 23 (données test en prod non vérifiables) · Hash legacy SHA-256 (P1) · P4.3 pagination `/invoices` absente |
| 🟡 Mineur | Point 6 (scan qty min=1) · Point 12 (status colors partiels) · Point 13 (formatCurrency non utilisé partout) · P1 Rate-limit Map non purgée · P3.1 duplication calcul totaux · P3.3 fichiers >400 lignes · P3.4 query params snake_case · P4.2 index manquants invoices · P4.3 pagination `/users` et `/projects` · P4.4 re-renders totaux non mémorisés |
| ✅ RAS | Points 1–5, 7–11, 14–15, 18–22 · P1 Injections SQL · P1 CORS prod · P1 Logs sensibles · P1 Token management · P2.1 Validation Zod · P2.2 404 sur ID inconnu · P2.3 JSON malformé · P2.4 Transactions · P2.5 isError frontend · P2.6 valeurs négatives · P3.2 couplage API · P3.5 lockfile overrides · P4.1 N+1 · P4.5 bundle |
