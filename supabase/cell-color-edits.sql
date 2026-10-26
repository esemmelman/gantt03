-- Batch painting and moves commit together, including moves between rows.
-- Compare the original colors under row locks to avoid overwriting another session.
create function public.gantt03_update_colors(changes jsonb) returns void
language plpgsql set search_path = public as $$
declare change jsonb; current_bars jsonb; new_bars jsonb;
begin
 if jsonb_typeof(changes) <> 'array' then raise exception 'Invalid color changes'; end if;
 for change in select value from jsonb_array_elements(changes) order by value->>'id' loop
  select bars into strict current_bars from gantt03_nodes where id=(change->>'id')::uuid for update;
  if current_bars is distinct from change->'expected_bars' then
   raise exception 'Colors changed in another session. Refresh and try again.';
  end if;
  new_bars := change->'bars';
  if new_bars is null or jsonb_typeof(new_bars) <> 'array' then raise exception 'Invalid color ranges'; end if;
  if exists(select 1 from jsonb_array_elements(new_bars) b where
    b->>'start_date' is null or b->>'end_date' is null or b->>'color' is null or
    b->>'color' !~ '^#[0-9a-fA-F]{6}$' or (b->>'end_date')::date < (b->>'start_date')::date
  ) then raise exception 'Invalid color range'; end if;
  update gantt03_nodes set bars=new_bars,
   start_date=(new_bars->0->>'start_date')::date,
   end_date=(new_bars->0->>'end_date')::date,
   color=coalesce(new_bars->0->>'color','#ef8080')
  where id=(change->>'id')::uuid;
 end loop;
end $$;
grant execute on function public.gantt03_update_colors(jsonb) to anon,authenticated;
