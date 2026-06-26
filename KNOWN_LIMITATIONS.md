# Limitations connues — StockBTP PWA

## Mode offline sur iOS / Safari

### Problème
L'API Web **BackgroundSync** utilisée par le service worker de l'application (`stockbtp-mutations-queue`) **n'est pas supportée sur iOS Safari** (état au 2025, toutes versions).

### Impact
Sur iPhone et iPad :
- Les actions effectuées hors-ligne (créations de mouvements de stock, mises à jour) sont bien mises en file d'attente dans l'application.
- **Si l'utilisateur ferme l'onglet ou l'application avant que la connexion réseau ne soit rétablie**, les mutations en attente sont **définitivement perdues** et ne seront jamais synchronisées avec le serveur.
- Sur Android (Chrome) et desktop, ce problème n'existe pas — la synchronisation s'effectue automatiquement en arrière-plan.

### Recommandation pour les utilisateurs terrain (iOS)
1. **Ne jamais fermer l'application** (ni l'onglet Safari, ni l'app si installée en mode standalone) tant que l'indicateur de synchronisation n'affiche pas "Synchronisé" ou que la connexion réseau n'est pas rétablie.
2. Surveiller le **bandeau orange "Hors ligne"** et le compteur de **"X action(s) en attente"** affichés dans l'interface — attendre leur disparition avant de fermer.
3. En cas de doute, rouvrir l'application une fois reconnecté au réseau et vérifier que les mouvements apparaissent bien dans l'historique avant de quitter.

### Contournement possible (futur)
Implémenter un mécanisme de persistance locale complémentaire (IndexedDB manuel) avec retry déclenché par l'événement `online` du navigateur, indépendamment de BackgroundSync. Ce contournement est compatible iOS.
