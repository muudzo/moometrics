-- Direct port of backend/alembic/versions/77a74867627e_multi_tenant_schema_with_audit_and_.py
-- This is the ONLY Alembic migration in the Python backend (squashed/fresh schema),
-- so this is a mechanical one-time port, not a multi-step replay.

create table farms (
    id serial primary key,
    name varchar(120) not null,
    created_at timestamp not null default now()
);
create index ix_farms_id on farms (id);

create table audit_logs (
    id serial primary key,
    farm_id integer not null references farms (id),
    actor_user_id integer,
    actor_username varchar(32),
    action varchar(40) not null,
    entity_type varchar(40) not null,
    entity_id integer,
    details jsonb,
    ip varchar(64),
    created_at timestamp not null default now()
);
create index ix_audit_logs_id on audit_logs (id);
create index ix_audit_entity on audit_logs (entity_type, entity_id);
create index ix_audit_farm_created on audit_logs (farm_id, created_at);

create table users (
    id serial primary key,
    username varchar(32) not null,
    password_hash varchar(255) not null,
    role varchar(20) not null check (role in ('manager', 'employee')),
    farm_id integer not null references farms (id),
    failed_login_attempts integer not null default 0,
    locked_until timestamp,
    created_at timestamp not null default now()
);
create index ix_users_id on users (id);
create unique index ix_users_username on users (username);
create index ix_user_farm on users (farm_id);

create table animals (
    id serial primary key,
    farm_id integer not null references farms (id),
    name varchar(100) not null,
    animal_type varchar(20) not null
        check (animal_type in ('cattle', 'sheep', 'goat', 'pig', 'horse', 'chicken', 'other')),
    tag_number varchar(50),
    breed varchar(100),
    date_of_birth date,
    status varchar(10) not null default 'alive' check (status in ('alive', 'dead')),
    notes varchar(1000),
    added_by_user_id integer not null references users (id),
    created_at timestamp not null default now(),
    updated_at timestamp not null default now(),
    constraint uq_animal_farm_tag unique (farm_id, tag_number)
);
create index ix_animals_id on animals (id);
create index ix_animal_farm on animals (farm_id);
create index ix_animal_status on animals (status);

create table refresh_tokens (
    id serial primary key,
    user_id integer not null references users (id),
    token_hash varchar(64) not null,
    expires_at timestamp not null,
    revoked boolean not null default false,
    created_at timestamp not null default now()
);
create index ix_refresh_tokens_id on refresh_tokens (id);
create unique index ix_refresh_tokens_token_hash on refresh_tokens (token_hash);
create index ix_refresh_user on refresh_tokens (user_id);

create table death_records (
    id serial primary key,
    farm_id integer not null references farms (id),
    animal_id integer not null unique references animals (id),
    reported_by_user_id integer not null references users (id),
    cause_of_death varchar(200) not null,
    date_of_death date not null,
    image_path varchar(500) not null,
    image_hash varchar(64) not null,
    notes varchar(1000),
    created_at timestamp not null default now(),
    constraint uq_death_farm_image_hash unique (farm_id, image_hash)
);
create index ix_death_records_id on death_records (id);
create index ix_death_farm on death_records (farm_id);
create index ix_death_reported_by on death_records (reported_by_user_id);

-- New: Postgres-backed rate limiter for auth endpoints (replaces in-process slowapi,
-- which cannot work across stateless/distributed Edge Function invocations).
-- One row per (bucket key e.g. "login:<ip>", time window); atomic upsert-and-count.
create table rate_limit_hits (
    bucket text not null,
    window_start timestamp not null,
    hits integer not null default 1,
    primary key (bucket, window_start)
);
create index ix_rate_limit_bucket on rate_limit_hits (bucket);
