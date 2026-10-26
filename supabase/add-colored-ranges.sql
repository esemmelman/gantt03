-- Preserve existing schedules while allowing independently colored ranges.
alter table public.gantt03_nodes add column bars jsonb not null default '[]'::jsonb;
alter table public.gantt03_nodes add constraint gantt03_bars_array check (jsonb_typeof(bars) = 'array');
update public.gantt03_nodes set bars = jsonb_build_array(jsonb_build_object(
 'start_date',start_date,'end_date',coalesce(end_date,start_date),'color',color
)) where start_date is not null;
