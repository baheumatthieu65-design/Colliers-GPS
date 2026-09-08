-- Pâtur'GPS : colonne de remontée DANGER du BG95.
-- Si la colonne existe déjà, cette migration ne la recrée pas.
alter table public.positions add column if not exists "DANGER" text;
create index if not exists positions_danger_idx on public.positions (created_at desc) where "DANGER" is not null and "DANGER" <> '';
