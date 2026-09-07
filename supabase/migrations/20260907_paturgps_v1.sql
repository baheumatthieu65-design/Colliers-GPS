-- Copie versionnée du schéma Pâtur'GPS V1
create extension if not exists pgcrypto;

create table if not exists public.collars (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    internal_code text not null unique,
    animal_name text,
    animal_number text,
    imei text,
    iccid text,
    sim_phone text,
    mode text not null default 'simulation' check (mode in ('simulation','real')),
    status text not null default 'active' check (status in ('active','inactive','maintenance')),
    color text default '#5A6F4E',
    last_latitude double precision,
    last_longitude double precision,
    last_altitude double precision,
    last_accuracy double precision,
    battery_percent integer check (battery_percent is null or battery_percent between 0 and 100),
    signal_strength integer,
    last_seen timestamptz,
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index if not exists collars_imei_unique on public.collars (imei) where imei is not null and imei <> '';
create unique index if not exists collars_iccid_unique on public.collars (iccid) where iccid is not null and iccid <> '';

create table if not exists public.positions (
    id uuid primary key default gen_random_uuid(),
    collar_id uuid not null references public.collars(id) on delete cascade,
    latitude double precision not null,
    longitude double precision not null,
    altitude double precision,
    accuracy double precision,
    speed double precision,
    heading double precision,
    battery_percent integer check (battery_percent is null or battery_percent between 0 and 100),
    signal_strength integer,
    source text not null default 'manual' check (source in ('manual','simulation','gps','mqtt')),
    recorded_at timestamptz not null default now(),
    created_at timestamptz not null default now()
);

create index if not exists positions_collar_id_idx on public.positions (collar_id);
create index if not exists positions_recorded_at_idx on public.positions (recorded_at desc);
create index if not exists positions_collar_date_idx on public.positions (collar_id, recorded_at desc);

create table if not exists public.zones (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    type text not null default 'polygon' check (type in ('circle','polygon')),
    center_latitude double precision,
    center_longitude double precision,
    radius_meters double precision,
    polygon_coords jsonb,
    color text not null default '#5A6F4E',
    enabled boolean not null default true,
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists zones_enabled_idx on public.zones (enabled);

create table if not exists public.collar_zones (
    collar_id uuid not null references public.collars(id) on delete cascade,
    zone_id uuid not null references public.zones(id) on delete cascade,
    enabled boolean not null default true,
    created_at timestamptz not null default now(),
    primary key (collar_id, zone_id)
);

create table if not exists public.alerts (
    id uuid primary key default gen_random_uuid(),
    collar_id uuid references public.collars(id) on delete cascade,
    zone_id uuid references public.zones(id) on delete set null,
    type text not null check (type in ('zone_entry','zone_exit','low_battery','offline','signal_lost','gps_error','system','other')),
    severity text not null default 'warning' check (severity in ('info','warning','critical')),
    message text not null,
    latitude double precision,
    longitude double precision,
    battery_percent integer,
    acknowledged boolean not null default false,
    acknowledged_at timestamptz,
    created_at timestamptz not null default now()
);

create index if not exists alerts_created_at_idx on public.alerts (created_at desc);
create index if not exists alerts_collar_id_idx on public.alerts (collar_id);

create table if not exists public.commands (
    id uuid primary key default gen_random_uuid(),
    command_type text not null default 'push' check (command_type in ('push','stop','locate','configure','custom')),
    cadence_seconds integer,
    duration_minutes integer,
    target_mode text not null default 'selected' check (target_mode in ('all','selected')),
    status text not null default 'pending' check (status in ('pending','sent','acknowledged','failed','cancelled')),
    payload jsonb,
    created_at timestamptz not null default now(),
    sent_at timestamptz,
    completed_at timestamptz,
    error_message text
);

create table if not exists public.command_targets (
    command_id uuid not null references public.commands(id) on delete cascade,
    collar_id uuid not null references public.collars(id) on delete cascade,
    status text not null default 'pending' check (status in ('pending','sent','acknowledged','failed')),
    sent_at timestamptz,
    acknowledged_at timestamptz,
    error_message text,
    primary key (command_id, collar_id)
);

create table if not exists public.push_subscriptions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid,
    device_name text,
    platform text check (platform is null or platform in ('android','ios','web','other')),
    endpoint text not null unique,
    p256dh text,
    auth text,
    enabled boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.device_events (
    id uuid primary key default gen_random_uuid(),
    collar_id uuid references public.collars(id) on delete cascade,
    event_type text not null,
    payload jsonb,
    created_at timestamptz not null default now()
);

alter table public.collars enable row level security;
alter table public.positions enable row level security;
alter table public.zones enable row level security;
alter table public.collar_zones enable row level security;
alter table public.alerts enable row level security;
alter table public.commands enable row level security;
alter table public.command_targets enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.device_events enable row level security;
