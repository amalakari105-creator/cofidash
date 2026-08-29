-- ============================================================
-- Migration : hiérarchie à 3 niveaux + données shift démo
-- À coller telle quelle dans le SQL Editor Supabase.
-- Ne touche à aucune donnée réelle déjà importée.
-- ============================================================

-- ---------- 1. Départements ----------
create table if not exists departments (
  id text primary key,
  nom text not null
);

insert into departments (id, nom) values
  ('production', 'Production'),
  ('qualite', 'Quality'),
  ('dept3', 'DummyText Dep')
on conflict (id) do nothing;

alter table departments enable row level security;
drop policy if exists "departments_select_auth" on departments;
create policy "departments_select_auth" on departments
  for select using (auth.role() = 'authenticated');

-- ---------- 2. Profiles : department_id + rôle à 3 niveaux ----------
alter table profiles add column if not exists department_id text references departments(id);

-- migre les anciens comptes 'user' vers 'supervisor' avant de changer la contrainte
alter table profiles drop constraint if exists profiles_role_check;
update profiles set role = 'supervisor' where role = 'user';
alter table profiles add constraint profiles_role_check
  check (role in ('super_admin', 'manager', 'supervisor'));

-- un seul manager par département
create unique index if not exists one_manager_per_department
  on profiles(department_id) where role = 'manager';

-- ---------- 3. Fonctions utilitaires pour les policies ----------
create or replace function is_manager()
returns boolean language sql stable as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'manager');
$$;

create or replace function my_department()
returns text language sql stable as $$
  select department_id from profiles where id = auth.uid();
$$;

-- ---------- 4. Un manager voit les superviseurs de son département ----------
drop policy if exists "profiles_select_own_or_admin" on profiles;
create policy "profiles_select_own_admin_or_team" on profiles
  for select using (
    id = auth.uid()
    or is_super_admin()
    or (is_manager() and role = 'supervisor' and department_id = my_department())
  );

-- ---------- 5. Production par shift (démo) ----------
alter table production_journaliere add column if not exists shift text;
alter table production_journaliere add column if not exists est_donnee_demo boolean not null default false;

-- Génère une répartition 35/35/30 par shift à partir des totaux journaliers déjà
-- importés, uniquement si ça n'a pas déjà été fait (pas de doublon au ré-exécution).
insert into production_journaliere (ligne, date, quantite_produite_m, shift, est_donnee_demo)
select ligne, date, round(quantite_produite_m * 0.35), 'Matin (07h-14h)', true
from production_journaliere
where shift is null
  and not exists (
    select 1 from production_journaliere p2
    where p2.est_donnee_demo and p2.ligne = production_journaliere.ligne and p2.date = production_journaliere.date
  )
union all
select ligne, date, round(quantite_produite_m * 0.35), 'Après-midi (14h-22h)', true
from production_journaliere
where shift is null
  and not exists (
    select 1 from production_journaliere p2
    where p2.est_donnee_demo and p2.ligne = production_journaliere.ligne and p2.date = production_journaliere.date
  )
union all
select ligne, date, round(quantite_produite_m * 0.30), 'Nuit (22h-07h)', true
from production_journaliere
where shift is null
  and not exists (
    select 1 from production_journaliere p2
    where p2.est_donnee_demo and p2.ligne = production_journaliere.ligne and p2.date = production_journaliere.date
  );
