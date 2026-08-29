-- ============================================================
-- CofiDash — module Maintenance (pannes machine)
-- Nouveau module, indépendant de la qualité/production.
-- Sans risque à exécuter sur une base existante (ne touche à aucune
-- table déjà en place).
-- ============================================================

create table if not exists pannes (
  id bigserial primary key,
  ligne text references referentiel_lignes(code_qa),
  date_panne date not null,
  date_validation timestamptz,       -- horodatage précis (pour le filtre "par shift")
  duree_arret_min numeric,           -- durée d'arrêt en minutes, si connue
  code_panne text,
  libelle_panne text,
  imported_by uuid references profiles(id),
  imported_at timestamptz default now()
);

create index if not exists idx_pannes_date on pannes(date_panne);
create index if not exists idx_pannes_ligne on pannes(ligne);

alter table pannes enable row level security;

create policy "pannes_select_auth" on pannes
  for select using (auth.role() = 'authenticated');
create policy "pannes_insert_auth" on pannes
  for insert with check (auth.role() = 'authenticated');

-- Module de permission pour l'affichage (à cocher dans la page Permissions
-- pour les superviseurs/managers qui doivent voir ce dashboard).
-- Rien à insérer : les permissions sont gérées par utilisateur, pas par une
-- table de modules séparée dans ce projet.
