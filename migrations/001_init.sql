create table if not exists event (
  id integer primary key,
  title text not null,
  starts_at timestamptz,
  ends_at timestamptz,
  time_zone text not null,
  place_name text not null,
  place_address text not null,
  notes text not null,
  constraint event_one_row check (id = 1)
);

create table if not exists items (
  id text primary key,
  name text not null,
  category text not null,
  details text not null,
  needed integer not null,
  source text not null,
  created_at timestamptz not null default now(),
  constraint items_needed_range check (needed >= 1 and needed <= 12),
  constraint items_source check (source in ('host', 'guest')),
  constraint items_category check (
    category in ('main', 'side', 'dessert', 'drink', 'supplies', 'other')
  )
);

create table if not exists claims (
  id text primary key,
  item_id text not null references items (id) on delete cascade,
  guest_name text not null,
  quantity integer not null,
  note text not null,
  created_at timestamptz not null default now(),
  constraint claims_quantity_range check (quantity >= 1 and quantity <= 12)
);

create index if not exists claims_item_id_idx on claims (item_id);
