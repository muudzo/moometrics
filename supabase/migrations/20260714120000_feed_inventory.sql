-- Feed inventory: named feed items per farm with a running bag count, plus an
-- append-only transaction log. Stock is never written absolutely — every
-- change is a delta (+ restock, - usage) so offline devices can sync late
-- without clobbering each other. client_txn_id is the idempotency key for
-- outbox replays (a duplicate is treated as success by the API, not an error).

create table feed_items (
    id serial primary key,
    farm_id integer not null references farms (id),
    name varchar(100) not null,
    -- May legitimately go negative when a late-syncing usage entry lands on
    -- an already-low count; the UI surfaces it as "recount needed".
    quantity integer not null default 0,
    low_stock_threshold integer not null default 5,
    created_at timestamp not null default now(),
    updated_at timestamp not null default now(),
    constraint uq_feed_farm_name unique (farm_id, name)
);
create index ix_feed_farm on feed_items (farm_id);

create table feed_transactions (
    id serial primary key,
    farm_id integer not null references farms (id),
    feed_item_id integer not null references feed_items (id) on delete cascade,
    delta integer not null,
    reason varchar(200),
    recorded_by_user_id integer not null references users (id),
    client_txn_id varchar(36) not null unique,
    created_at timestamp not null default now()
);
create index ix_feed_txn_item on feed_transactions (feed_item_id);
create index ix_feed_txn_farm on feed_transactions (farm_id);
