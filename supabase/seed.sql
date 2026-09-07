-- Optional development seed. Run after schema.sql in a development Supabase project.
insert into public.units(name, code) values
  ('יחידה 8200','8200'),
  ('יחידה 81','81'),
  ('ממ״ר','ממ״ר'),
  ('מפא״ת','מפא״ת'),
  ('יחידת מודיעין','מודיעין'),
  ('יחידת תקשוב','תקשוב')
on conflict(name) do nothing;
