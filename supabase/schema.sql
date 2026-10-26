-- Isolated, login-free Gantt chart. Intentionally public read/write.
create table public.gantt03_nodes (
 id uuid primary key default gen_random_uuid(),
 parent_id uuid references public.gantt03_nodes(id) on delete cascade,
 title text not null check (length(trim(title)) > 0),
 start_date date, end_date date,
 color text not null default '#ef8080',
 text_color text not null default '#000000',
 notes text not null default '', links text not null default '',
 position double precision not null default 0,
 check (end_date is null or start_date is not null),
 check (end_date is null or end_date >= start_date)
);
create index gantt03_parent_idx on public.gantt03_nodes(parent_id);
alter table public.gantt03_nodes disable row level security;
grant select, insert, update, delete on public.gantt03_nodes to anon, authenticated;

create function public.gantt03_check_tree() returns trigger language plpgsql set search_path = public as $$
declare depth integer; height integer; cycle_found boolean;
begin
 perform pg_advisory_xact_lock(7032026);
 if new.parent_id = new.id then raise exception 'A node cannot be its own parent'; end if;
 with recursive ancestors as (
   select id,parent_id,1 as d,array[id] as path,false as cycle from gantt03_nodes where id=new.parent_id
   union all select n.id,n.parent_id,a.d+1,a.path||n.id,n.id=any(a.path)
   from gantt03_nodes n join ancestors a on n.id=a.parent_id where not a.cycle
 ) select coalesce(max(d),0),coalesce(bool_or(id=new.id or cycle),false) into depth,cycle_found from ancestors;
 if cycle_found then raise exception 'A node cannot contain its ancestor'; end if;
 with recursive descendants as (
   select id,1 as h from gantt03_nodes where id=new.id
   union all select n.id,d.h+1 from gantt03_nodes n join descendants d on n.parent_id=d.id
 ) select coalesce(max(h),1) into height from descendants;
 if depth+height > 4 then raise exception 'The chart supports at most four levels'; end if;
 return new;
end $$;
create trigger gantt03_tree_guard before insert or update of parent_id on public.gantt03_nodes for each row execute function public.gantt03_check_tree();

create function public.gantt03_add_parent(target_id uuid, parent_title text) returns uuid language plpgsql set search_path = public as $$
declare target gantt03_nodes; new_id uuid;
begin
 perform pg_advisory_xact_lock(7032026);
 select * into strict target from gantt03_nodes where id=target_id for update;
 insert into gantt03_nodes(title,parent_id,position) values(parent_title,target.parent_id,target.position) returning id into new_id;
 update gantt03_nodes set parent_id=new_id,position=0 where id=target_id;
 return new_id;
end $$;
grant execute on function public.gantt03_add_parent(uuid,text) to anon, authenticated;

create table public.gantt03_settings (id integer primary key check(id=1), general_links text not null default '');
alter table public.gantt03_settings disable row level security;
grant select,update on public.gantt03_settings to anon,authenticated;
insert into public.gantt03_settings(id) values(1);

insert into public.gantt03_nodes(id,parent_id,title,position,text_color,start_date,end_date) values
('00000000-0000-4000-8000-000000000001',null,'Bnai Mitzvah',1,'#000000',null,null),
('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','Aria',1,'#000000',null,null),
('00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000002','Log',1,'#e00000',null,null),
('00000000-0000-4000-8000-000000000004',null,'Brotherhood',2,'#000000',null,null),
('00000000-0000-4000-8000-000000000005','00000000-0000-4000-8000-000000000004','Events',1,'#000000',null,null),
('00000000-0000-4000-8000-000000000006','00000000-0000-4000-8000-000000000005','Bob Seeger Concert',1,'#000000',null,null),
('00000000-0000-4000-8000-000000000007','00000000-0000-4000-8000-000000000005','First Day School Barbecue',2,'#000000',null,null),
('00000000-0000-4000-8000-000000000008','00000000-0000-4000-8000-000000000005','Hanukkah Carnival',3,'#000000','2026-11-08','2026-11-08'),
('00000000-0000-4000-8000-000000000009','00000000-0000-4000-8000-000000000005','Membership Barbecue',4,'#000000',null,null),
('00000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-000000000005','Purim Carnival',5,'#000000',null,null),
('00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000004','Meetings',2,'#e00000',null,null),
('00000000-0000-4000-8000-000000000012','00000000-0000-4000-8000-000000000004','Ushering',3,'#000000',null,null),
('00000000-0000-4000-8000-000000000013','00000000-0000-4000-8000-000000000012','Resolve Badges',1,'#000000',null,null),
('00000000-0000-4000-8000-000000000014','00000000-0000-4000-8000-000000000012','Secure Documentation',2,'#000000',null,null),
('00000000-0000-4000-8000-000000000015','00000000-0000-4000-8000-000000000012','Solicit Volunteers',3,'#000000',null,null),
('00000000-0000-4000-8000-000000000016',null,'Eye',3,'#d00000',null,null),
('00000000-0000-4000-8000-000000000017','00000000-0000-4000-8000-000000000016','Dr. john hovanesian',1,'#000000',null,null),
('00000000-0000-4000-8000-000000000018','00000000-0000-4000-8000-000000000017','Appointments',1,'#000000',null,null),
('00000000-0000-4000-8000-000000000019','00000000-0000-4000-8000-000000000017','Faq',2,'#e00000',null,null),
('00000000-0000-4000-8000-000000000020','00000000-0000-4000-8000-000000000017','Task - Fill out forms from Website',3,'#000000',null,null);
