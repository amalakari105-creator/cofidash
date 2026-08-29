-- ============================================================
-- CofiDash — schéma Supabase
-- À exécuter dans l'éditeur SQL du projet Supabase.
-- Le script est ré-exécutable sans risque (il nettoie d'abord les objets
-- existants) : utile si une exécution précédente a échoué en cours de route.
-- ⚠️ Ne PAS relancer après avoir importé de vraies données : ces DROP les effaceraient.
-- Pour une base déjà en production, utilise plutôt supabase/migration_hierarchie.sql.
-- ============================================================

drop table if exists production_journaliere cascade;
drop table if exists evenements_qualite cascade;
drop table if exists synthese_mensuelle_trancannage cascade;
drop table if exists referentiel_lignes cascade;
drop table if exists user_permissions cascade;
drop table if exists profiles cascade;
drop table if exists departments cascade;
drop function if exists is_super_admin();
drop function if exists is_manager();
drop function if exists my_department();

-- ---------- Départements (3 niveaux : super admin / manager / superviseur) ----------
create table if not exists departments (
  id text primary key,
  nom text not null
);

insert into departments (id, nom) values
  ('production', 'Production'),
  ('qualite', 'Quality'),
  ('dept3', 'DummyText Dep')
on conflict (id) do nothing;

-- ---------- Profiles (miroir de auth.users avec l'ID COFICAB et le rôle) ----------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  coficab_id text unique not null,
  full_name text,
  role text not null default 'supervisor' check (role in ('super_admin', 'manager', 'supervisor')),
  department_id text references departments(id),
  created_at timestamptz default now()
);

-- un seul manager par département
create unique index if not exists one_manager_per_department
  on profiles(department_id) where role = 'manager';

-- ---------- Permissions d'affichage par module ----------
create table if not exists user_permissions (
  user_id uuid references profiles(id) on delete cascade,
  module_id text not null,
  can_view boolean not null default false,
  primary key (user_id, module_id)
);

-- ---------- Référentiel des lignes (MUL0x <-> TFE0x) ----------
create table if not exists referentiel_lignes (
  code_qa text primary key,
  code_production text not null unique,
  nom_affiche text,
  en_perimetre boolean not null default true
);

insert into referentiel_lignes (code_qa, code_production, nom_affiche, en_perimetre) values
  ('MUL02', 'TFE02', 'Ligne 2', true),
  ('MUL03', 'TFE03', 'Ligne 3', true),
  ('MUL04', 'TFE04', 'Ligne 4', true),
  ('MUL05', 'TFE05', 'Ligne 5', true),
  ('MUL06', 'TFE06', 'Ligne 6', true),
  ('MUL07', 'TFE07', 'Ligne 7', true),
  ('MUL09', 'TFE09', 'Ligne 9 (hors périmètre)', false)
on conflict (code_qa) do nothing;

-- ---------- Événements qualité (import MUL_COFTN) ----------
create table if not exists evenements_qualite (
  id bigserial primary key,
  ligne text references referentiel_lignes(code_qa),
  n_serie_bobine text,
  hu_erp text,
  quantite_m numeric,
  type_cable text,
  date_production date,
  date_validation timestamptz,
  code_defaut text,
  libelle_defaut text,
  imported_by uuid references profiles(id),
  imported_at timestamptz default now()
);

create index if not exists idx_evenements_qualite_date on evenements_qualite(date_production);
create index if not exists idx_evenements_qualite_ligne on evenements_qualite(ligne);

-- ---------- Production journalière (import Capacite_Production_TFE) ----------
create table if not exists production_journaliere (
  id bigserial primary key,
  ligne text references referentiel_lignes(code_production),
  date date not null,
  quantite_produite_m numeric,
  shift text,
  est_donnee_demo boolean not null default false,
  imported_by uuid references profiles(id),
  imported_at timestamptz default now()
);

create index if not exists idx_production_journaliere_date on production_journaliere(date);

-- ---------- Synthèse mensuelle trancannage (seed historique) ----------
create table if not exists synthese_mensuelle_trancannage (
  periode text primary key,
  annee int not null,
  mois_num int not null,
  conforme int,
  non_conforme int
);

create or replace view v_synthese_mensuelle as
  select
    periode, annee, mois_num, conforme, non_conforme,
    case when conforme is null then null else conforme + non_conforme end as total,
    case when conforme is null then null
         else round(non_conforme::numeric / (conforme + non_conforme) * 100, 2)
    end as taux_nc_pct
  from synthese_mensuelle_trancannage;

-- ============================================================
-- Row Level Security
-- ============================================================

create or replace function is_super_admin()
returns boolean language sql stable as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'super_admin'
  );
$$;

create or replace function is_manager()
returns boolean language sql stable as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'manager');
$$;

create or replace function my_department()
returns text language sql stable as $$
  select department_id from profiles where id = auth.uid();
$$;

alter table departments enable row level security;
alter table profiles enable row level security;
alter table user_permissions enable row level security;
alter table referentiel_lignes enable row level security;
alter table evenements_qualite enable row level security;
alter table production_journaliere enable row level security;
alter table synthese_mensuelle_trancannage enable row level security;

-- departments : lecture pour tout utilisateur authentifié
create policy "departments_select_auth" on departments
  for select using (auth.role() = 'authenticated');

-- profiles : chacun voit son propre profil, le super admin voit tout,
-- un manager voit les superviseurs de son département
create policy "profiles_select_own_admin_or_team" on profiles
  for select using (
    id = auth.uid()
    or is_super_admin()
    or (is_manager() and role = 'supervisor' and department_id = my_department())
  );
create policy "profiles_update_admin" on profiles
  for update using (is_super_admin());
create policy "profiles_insert_admin" on profiles
  for insert with check (is_super_admin());

-- user_permissions : chacun voit les siennes, seul le super admin modifie
create policy "perms_select_own_or_admin" on user_permissions
  for select using (user_id = auth.uid() or is_super_admin());
create policy "perms_write_admin" on user_permissions
  for all using (is_super_admin()) with check (is_super_admin());

-- referentiel_lignes : lecture pour tout utilisateur authentifié, écriture admin
create policy "lignes_select_auth" on referentiel_lignes
  for select using (auth.role() = 'authenticated');
create policy "lignes_write_admin" on referentiel_lignes
  for all using (is_super_admin()) with check (is_super_admin());

-- evenements_qualite : lecture pour authentifié, insertion pour authentifié (import)
create policy "evq_select_auth" on evenements_qualite
  for select using (auth.role() = 'authenticated');
create policy "evq_insert_auth" on evenements_qualite
  for insert with check (auth.role() = 'authenticated');

-- production_journaliere : idem
create policy "prod_select_auth" on production_journaliere
  for select using (auth.role() = 'authenticated');
create policy "prod_insert_auth" on production_journaliere
  for insert with check (auth.role() = 'authenticated');

-- synthese_mensuelle_trancannage : lecture pour authentifié, écriture admin
create policy "synthese_select_auth" on synthese_mensuelle_trancannage
  for select using (auth.role() = 'authenticated');
create policy "synthese_write_admin" on synthese_mensuelle_trancannage
  for all using (is_super_admin()) with check (is_super_admin());
