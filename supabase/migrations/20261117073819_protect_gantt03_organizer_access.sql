-- Organizer requests run through the authenticated, allowlisted Edge Function.
alter table public.gantt03_nodes enable row level security;
alter table public.gantt03_settings enable row level security;
revoke all on table public.gantt03_nodes, public.gantt03_settings from public, anon, authenticated;
grant select, insert, update, delete on table public.gantt03_nodes, public.gantt03_settings to service_role;

revoke all on function public.gantt03_check_tree() from public, anon, authenticated;
revoke all on function public.gantt03_add_parent(uuid,text) from public, anon, authenticated;
revoke all on function public.gantt03_update_colors(jsonb) from public, anon, authenticated;
revoke all on function public.gantt03_save_notes(uuid,text,text,text) from public, anon, authenticated;
revoke all on function public.gantt03_add_comment(uuid,uuid,text) from public, anon, authenticated;
revoke all on function public.gantt03_undo_action(jsonb,text,text) from public, anon, authenticated;
grant execute on function public.gantt03_check_tree(), public.gantt03_add_parent(uuid,text), public.gantt03_update_colors(jsonb), public.gantt03_save_notes(uuid,text,text,text), public.gantt03_add_comment(uuid,uuid,text), public.gantt03_undo_action(jsonb,text,text) to service_role;

comment on table public.gantt03_nodes is 'Private Gantt03 chart. Access is restricted to the organizer Edge Function.';
comment on table public.gantt03_settings is 'Private Gantt03 settings. Access is restricted to the organizer Edge Function.';
