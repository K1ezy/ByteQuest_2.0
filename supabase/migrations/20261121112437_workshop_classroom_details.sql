alter table public.workshops
  add column block varchar(24),
  add column year_level integer check (year_level between 1 and 4),
  add column subject varchar(80),
  add column room varchar(40);
