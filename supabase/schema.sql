-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────
-- PROFILES (app users, managed by admin)
-- ─────────────────────────────────────────
create table profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  username text unique not null,
  full_name text not null,
  role text not null default 'member' check (role in ('admin', 'member')),
  avatar_initials text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table profiles enable row level security;

create policy "Users can view all profiles" on profiles
  for select using (auth.role() = 'authenticated');

create policy "Admins can manage profiles" on profiles
  for all using (
    exists (
      select 1 from profiles where id = auth.uid() and role = 'admin'
    )
  );

create policy "Users can update own profile" on profiles
  for update using (auth.uid() = id);

-- ─────────────────────────────────────────
-- CLIENTS
-- ─────────────────────────────────────────
create table clients (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  company text,
  email text,
  phone text,
  address text,
  city text,
  country text default 'Croatia',
  tax_id text,
  status text default 'active' check (status in ('active', 'inactive', 'lead', 'churned')),
  notes text,
  tags text[],
  assigned_to uuid references profiles(id),
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table clients enable row level security;
create policy "Authenticated users can do everything on clients" on clients
  for all using (auth.role() = 'authenticated');

-- ─────────────────────────────────────────
-- DEALS (projects / contracts)
-- ─────────────────────────────────────────
create table deals (
  id uuid default uuid_generate_v4() primary key,
  client_id uuid references clients(id) on delete set null,
  title text not null,
  description text,
  stage text default 'lead' check (stage in ('lead', 'proposal', 'negotiation', 'won', 'lost', 'paused')),
  value numeric(12,2) default 0,
  currency text default 'EUR',
  start_date date,
  end_date date,
  probability integer default 50 check (probability between 0 and 100),
  assigned_to uuid references profiles(id),
  created_by uuid references profiles(id),
  notes text,
  tags text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table deals enable row level security;
create policy "Authenticated users can do everything on deals" on deals
  for all using (auth.role() = 'authenticated');

-- ─────────────────────────────────────────
-- INVOICES
-- ─────────────────────────────────────────
create table invoices (
  id uuid default uuid_generate_v4() primary key,
  invoice_number text unique not null,
  client_id uuid references clients(id) on delete set null,
  deal_id uuid references deals(id) on delete set null,
  title text not null,
  status text default 'draft' check (status in ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
  issue_date date default current_date,
  due_date date,
  subtotal numeric(12,2) default 0,
  tax_rate numeric(5,2) default 0,
  tax_amount numeric(12,2) default 0,
  total numeric(12,2) default 0,
  currency text default 'EUR',
  notes text,
  paid_at timestamptz,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table invoices enable row level security;
create policy "Authenticated users can do everything on invoices" on invoices
  for all using (auth.role() = 'authenticated');

-- Invoice line items
create table invoice_items (
  id uuid default uuid_generate_v4() primary key,
  invoice_id uuid references invoices(id) on delete cascade,
  description text not null,
  quantity numeric(10,2) default 1,
  unit_price numeric(12,2) default 0,
  amount numeric(12,2) default 0,
  sort_order integer default 0
);

alter table invoice_items enable row level security;
create policy "Authenticated users can do everything on invoice_items" on invoice_items
  for all using (auth.role() = 'authenticated');

-- ─────────────────────────────────────────
-- INSTALLMENTS (payment schedules)
-- ─────────────────────────────────────────
create table installments (
  id uuid default uuid_generate_v4() primary key,
  deal_id uuid references deals(id) on delete cascade,
  invoice_id uuid references invoices(id) on delete set null,
  client_id uuid references clients(id) on delete set null,
  title text not null,
  amount numeric(12,2) not null,
  currency text default 'EUR',
  due_date date not null,
  status text default 'pending' check (status in ('pending', 'paid', 'overdue', 'cancelled')),
  paid_at timestamptz,
  payment_method text check (payment_method in ('bank_transfer', 'cash', 'card', 'other')),
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table installments enable row level security;
create policy "Authenticated users can do everything on installments" on installments
  for all using (auth.role() = 'authenticated');

-- ─────────────────────────────────────────
-- EXPENSES
-- ─────────────────────────────────────────
create table expenses (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  amount numeric(12,2) not null,
  currency text default 'EUR',
  category text not null check (category in (
    'software', 'hardware', 'advertising', 'travel',
    'office', 'contractor', 'subscription', 'tax', 'other'
  )),
  deal_id uuid references deals(id) on delete set null,
  client_id uuid references clients(id) on delete set null,
  expense_date date default current_date,
  receipt_url text,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table expenses enable row level security;
create policy "Authenticated users can do everything on expenses" on expenses
  for all using (auth.role() = 'authenticated');

-- ─────────────────────────────────────────
-- ACTIVITY LOG
-- ─────────────────────────────────────────
create table activity_log (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id),
  entity_type text not null,
  entity_id uuid,
  action text not null,
  description text,
  metadata jsonb,
  created_at timestamptz default now()
);

alter table activity_log enable row level security;
create policy "Authenticated users can view and insert activity" on activity_log
  for all using (auth.role() = 'authenticated');

-- ─────────────────────────────────────────
-- AUTO-UPDATE updated_at trigger
-- ─────────────────────────────────────────
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger clients_updated_at before update on clients for each row execute procedure update_updated_at();
create trigger deals_updated_at before update on deals for each row execute procedure update_updated_at();
create trigger invoices_updated_at before update on invoices for each row execute procedure update_updated_at();
create trigger installments_updated_at before update on installments for each row execute procedure update_updated_at();
create trigger expenses_updated_at before update on expenses for each row execute procedure update_updated_at();
create trigger profiles_updated_at before update on profiles for each row execute procedure update_updated_at();

-- ─────────────────────────────────────────
-- INVOICE NUMBER SEQUENCE FUNCTION
-- ─────────────────────────────────────────
create sequence if not exists invoice_number_seq start 1000;

create or replace function generate_invoice_number()
returns text as $$
begin
  return 'AUR-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('invoice_number_seq')::text, 4, '0');
end;
$$ language plpgsql;
