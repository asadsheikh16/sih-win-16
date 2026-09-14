create policy departments_staff_read
on public.departments
for select
to authenticated
using (public.is_staff());