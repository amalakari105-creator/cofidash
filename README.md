# CofiDash

Dashboard de suivi qualité du défaut de mauvais trancannage — COFICAB Tunisie, atelier tréfilage.

## Mise en route

### 1. Créer le projet Supabase
Sur [supabase.com](https://supabase.com) → New Project → plan gratuit. Choisis une région
proche (Europe est le plus proche pour la Tunisie). Garde le mot de passe de la base généré à
la création, tu en as besoin une fois.

### 2. Exécuter le schéma
SQL Editor (menu de gauche) → coller le contenu de `supabase/schema.sql` → Run. Ça crée toutes
les tables, le référentiel des 6 lignes, et active les policies RLS.

### 3. Récupérer les clés API
Project Settings → **API Keys**.
- Si ton projet affiche un onglet "Publishable and secret API keys" : utilise la **publishable
  key** côté front et la **secret key** côté serveur (nouveau système Supabase, en cours de
  déploiement en 2026).
- Sinon (onglet "Legacy API Keys") : utilise **anon key** côté front et **service_role key**
  côté serveur.
Les deux fonctionnent à l'identique dans ce projet — seul le nom affiché dans le dashboard change.

### 4. Configurer les variables d'environnement
```
cp .env.example .env
```
Renseigner `VITE_SUPABASE_URL` (Project Settings → API → Project URL) et
`VITE_SUPABASE_ANON_KEY` (la publishable/anon key ci-dessus — jamais la secret/service_role key
ici, elle serait exposée dans le navigateur).

### 5. Installer et lier la CLI Supabase
La CLI nécessite **Node.js 20+**.
```
npx supabase login
npx supabase init
npx supabase link --project-ref TON_PROJECT_REF
```
Le `project-ref` est dans l'URL de ton projet (`supabase.com/dashboard/project/<ref>`).

### 6. Déployer la fonction de création d'utilisateurs
```
npx supabase functions deploy create-user
```
Pas besoin de configurer `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` toi-même : Supabase les
injecte automatiquement dans les Edge Functions. Docker n'est requis que pour tester en local
(`supabase functions serve`) ; le déploiement fonctionne sans.

### 7. Installer les dépendances et lancer
```
npm install
npm run dev
```

## Premier compte super admin

Le schéma ne crée aucun utilisateur. Pour le tout premier compte : Authentication → Users →
Add user, avec l'email technique `<ton_id_coficab>@cofidash.internal` et un mot de passe.
Coche "Auto Confirm User". Puis, dans Table Editor → `profiles`, insère une ligne avec le même
`id` (copié depuis Authentication → Users), ton `coficab_id`, et `role = 'super_admin'`.
Les comptes suivants pourront être créés depuis l'interface (Utilisateurs), qui passe par la
fonction déployée à l'étape 6.

## Structure

- `src/pages/Login.jsx` — connexion par ID COFICAB + mot de passe
- `src/pages/Dashboard.jsx` — KPIs qualité / trancannage
- `src/pages/DashboardProduction.jsx` — KPIs production / capacité
- `src/pages/ImportExcel.jsx` — import manuel des exports Excel
- `src/pages/admin/Users.jsx` — création de comptes (super admin)
- `src/pages/admin/Permissions.jsx` — permissions d'affichage par module (super admin)
- `supabase/schema.sql` — tables + Row Level Security
- `supabase/functions/create-user` — Edge Function de création de compte

## Points restés ouverts (voir SPEC_Dashboard_Trancannage_COFICAB.md)

- Filtre "par shift" non calculable côté production (pas d'horodatage dans l'export actuel)
- `Conforme` / `Total` 2025 manquants dans `synthese_mensuelle_trancannage` (seul `Non_Conforme` est rempli)
