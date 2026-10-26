alter table public.gantt03_nodes add column archived boolean not null default false;

-- Replace the former Blue schedule color while preserving all dates/ranges.
update public.gantt03_nodes n set
 color=case when lower(color) in ('#0000ff','#00f','blue') then '#ffff00' else color end,
 bars=(select coalesce(jsonb_agg(case when lower(b.value->>'color') in ('#0000ff','#00f','blue')
   then jsonb_set(b.value,'{color}','"#ffff00"'::jsonb) else b.value end order by b.ordinality),'[]'::jsonb)
   from jsonb_array_elements(n.bars) with ordinality as b(value,ordinality))
where lower(color) in ('#0000ff','#00f','blue')
 or exists(select 1 from jsonb_array_elements(n.bars) b where lower(b->>'color') in ('#0000ff','#00f','blue'));

-- Restore one locally recorded action without overwriting newer shared changes.
create or replace function public.gantt03_undo_action(changes jsonb, settings_before text default null, settings_after text default null)
returns void language plpgsql set search_path = public as $$
declare change jsonb; actual jsonb; restored jsonb; current_links text; item record;
begin
 perform pg_advisory_xact_lock(7032026);
 if jsonb_typeof(changes) <> 'array' then raise exception 'Invalid undo action'; end if;
 for change in select value from jsonb_array_elements(changes) order by value->>'id' loop
  actual := null;
  select to_jsonb(n) into actual from gantt03_nodes n where id=(change->>'id')::uuid for update;
  if coalesce(actual,'null'::jsonb) is distinct from change->'after' then
   raise exception 'This item changed in another session. Refresh before undoing.';
  end if;
 end loop;
 if settings_before is not null then
  select general_links into strict current_links from gantt03_settings where id=1 for update;
  if current_links is distinct from settings_after then raise exception 'General links changed in another session.'; end if;
 end if;
 -- Restore parents before children, then remove nodes created by the action.
 for item in
  with recursive desired as (
   select to_jsonb(n) as data from gantt03_nodes n where not exists(select 1 from jsonb_array_elements(changes) c where c->>'id'=n.id::text)
   union all select c->'before' from jsonb_array_elements(changes) c where c->'before' <> 'null'::jsonb
  ), tree as (
   select data,1 as depth from desired where data->>'parent_id' is null
   union all select d.data,t.depth+1 from desired d join tree t on d.data->>'parent_id'=t.data->>'id' where t.depth<4
  ) select t.data from tree t where exists(select 1 from jsonb_array_elements(changes) c where c->>'id'=t.data->>'id') order by t.depth
 loop
  restored := item.data;
  insert into gantt03_nodes(id,parent_id,title,start_date,end_date,color,text_color,notes,links,position,bars,notes_html,comments,archived)
  values((restored->>'id')::uuid,(restored->>'parent_id')::uuid,restored->>'title',(restored->>'start_date')::date,
   (restored->>'end_date')::date,restored->>'color',restored->>'text_color',restored->>'notes',restored->>'links',
   (restored->>'position')::double precision,restored->'bars',coalesce(restored->>'notes_html',''),coalesce(restored->'comments','[]'::jsonb),coalesce((restored->>'archived')::boolean,false))
  on conflict(id) do update set parent_id=excluded.parent_id,title=excluded.title,start_date=excluded.start_date,
   end_date=excluded.end_date,color=excluded.color,text_color=excluded.text_color,notes=excluded.notes,
   links=excluded.links,position=excluded.position,bars=excluded.bars,notes_html=excluded.notes_html,comments=excluded.comments,archived=excluded.archived;
 end loop;
 -- Refuse to cascade-delete a newly attached branch that was not part of this action.
 if exists(select 1 from gantt03_nodes n join jsonb_array_elements(changes) c on n.parent_id=(c->>'id')::uuid
   where c->'before'='null'::jsonb and not exists(select 1 from jsonb_array_elements(changes) ch where ch->>'id'=n.id::text and ch->'before'='null'::jsonb)) then
  raise exception 'A new child was added in another session. Refresh before undoing.';
 end if;
 delete from gantt03_nodes n where exists(select 1 from jsonb_array_elements(changes) c where c->>'id'=n.id::text and c->'before'='null'::jsonb);
 if settings_before is not null then update gantt03_settings set general_links=settings_before where id=1; end if;
end $$;
grant execute on function public.gantt03_undo_action(jsonb,text,text) to anon,authenticated;
