create table if not exists public.audit_logs (
  id serial primary key,
  action text not null,
  entity_type text not null,
  entity_id text,
  user_id integer references public.users(id) on delete set null,
  user_email text,
  old_value jsonb,
  new_value jsonb,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_created_at_idx on public.audit_logs(created_at desc);
create index if not exists audit_logs_entity_idx on public.audit_logs(entity_type, entity_id);
create index if not exists audit_logs_user_id_idx on public.audit_logs(user_id);

alter table public.audit_logs drop constraint if exists audit_logs_user_id_fkey;
alter table public.audit_logs
  add constraint audit_logs_user_id_fkey
  foreign key (user_id) references public.users(id) on delete set null;
