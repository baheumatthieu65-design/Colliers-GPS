-- Pâtur'GPS V12 - séparation matériel / configuration et file PUSH
-- Compatible avec le schéma V1 existant. Cette migration n'efface aucune donnée.

create table if not exists public.devices (
    id uuid primary key default gen_random_uuid(),
    imei text not null unique,
    iccid text,
    sim_phone text,
    model text default 'BG95',
    firmware_version text,
    last_seen timestamptz,
    last_latitude double precision,
    last_longitude double precision,
    battery_percent integer check (battery_percent is null or battery_percent between 0 and 100),
    signal_strength integer,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists devices_last_seen_idx on public.devices (last_seen desc);

alter table public.collars
    add column if not exists device_id uuid references public.devices(id) on delete set null;

create index if not exists collars_device_id_idx on public.collars (device_id);

-- Reprise automatique des matériels déjà connus dans collars.
insert into public.devices (imei, iccid, sim_phone, last_seen, last_latitude, last_longitude, battery_percent, signal_strength)
select imei, max(iccid), max(sim_phone), max(last_seen), max(last_latitude), max(last_longitude), max(battery_percent), max(signal_strength)
from public.collars
where imei is not null and imei <> ''
group by imei
on conflict (imei) do nothing;

update public.collars c
set device_id = d.id
from public.devices d
where c.imei = d.imei
  and c.device_id is null;

-- Informations de livraison nécessaires au futur worker MQTT.
alter table public.commands
    add column if not exists delivery_status text not null default 'queued'
      check (delivery_status in ('queued','published','acknowledged','failed','cancelled')),
    add column if not exists next_wakeup_at timestamptz,
    add column if not exists mqtt_topic text,
    add column if not exists mqtt_payload jsonb;

alter table public.command_targets
    add column if not exists delivery_status text not null default 'queued'
      check (delivery_status in ('queued','published','acknowledged','failed','cancelled')),
    add column if not exists next_wakeup_at timestamptz,
    add column if not exists mqtt_topic text,
    add column if not exists mqtt_payload jsonb;

alter table public.devices enable row level security;
