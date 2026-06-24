# Mise en production StockBTP

Ce guide decrit les etapes pour publier l'application sur Vercel avec Supabase, sans exposer de secrets dans le depot.

## 1. Supabase

Projet production actuel :

- URL : `https://wxszyisiaklskyyrztvq.supabase.co`
- Project ref : `wxszyisiaklskyyrztvq`

Avant la mise en production finale, creer un second projet Supabase pour staging. Le projet production doit rester reserve aux donnees reelles.

Variables a preparer pour chaque environnement :

- `SUPABASE_DATABASE_URL`
- `SESSION_SECRET`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` uniquement cote serveur si necessaire

Ne jamais exposer `SUPABASE_SERVICE_ROLE_KEY` dans le navigateur.

## 2. Staging

Ordre recommande :

1. Creer un projet Supabase staging.
2. Copier le schema depuis la production vers staging.
3. Importer seulement quelques donnees de test.
4. Pointer les variables Vercel Preview vers staging.
5. Garder les variables Vercel Production vers la vraie base.

## 3. GitHub et Vercel

1. Creer un depot GitHub.
2. Pousser le code.
3. Importer le depot dans Vercel.
4. Configurer les variables d'environnement dans Vercel :
   - Production : vraie base Supabase.
   - Preview : base Supabase staging.
   - Development : base Supabase staging ou locale.
5. Lancer un Preview Deployment.
6. Tester login, produits, mouvements, filtres, rapports PDF.
7. Promouvoir en production uniquement apres validation.

## 4. Exports PDF

L'application supporte maintenant :

- rapport journalier : `GET /api/reports/pdf?period=day&date=YYYY-MM-DD`
- rapport hebdomadaire : `GET /api/reports/pdf?period=week&date=YYYY-MM-DD`
- rapport mensuel : `GET /api/reports/pdf?period=month&date=YYYY-MM-DD`

La date sert de reference :

- `day` : la journee choisie.
- `week` : la semaine ISO contenant la date choisie, du lundi au dimanche.
- `month` : le mois contenant la date choisie.

## 5. Audit

Le code peut enregistrer les exports PDF et les suppressions de produits dans `audit_logs`.

L'audit est volontairement non bloquant : si la table n'existe pas encore, l'action metier continue et un warning est logge.

Avant d'activer l'audit en production, executer le SQL dans `docs/sql/audit_logs.sql` sur staging, verifier, puis appliquer en production.

## 6. Supabase Auth

Migration recommandee en deux phases :

1. Ajouter Supabase Auth en parallele de l'auth actuelle.
2. Creer une table `profiles` liee a `auth.users`, avec les roles `admin`, `manager`, `worker`.
3. Faire accepter les tokens Supabase par l'API.
4. Basculer le login front vers Supabase Auth.
5. Activer RLS seulement quand les acces directs depuis le navigateur sont clairement definis.

## 7. Sauvegardes

Comme la base actuelle est la vraie base :

- verifier que les backups Supabase sont actifs ;
- envisager PITR si le budget le permet ;
- tester une restauration sur staging avant de compter dessus.

## 8. Checklist avant prod

- Typecheck API et PWA OK.
- Tests API et PWA OK.
- Variables Vercel Production configurees.
- Variables Vercel Preview configurees vers staging.
- Aucun secret dans Git.
- Export PDF jour/semaine/mois teste.
- Suppression produit testee avec audit disponible.
- Sauvegarde Supabase verifiee.
- Compte admin cree et mot de passe fort.
