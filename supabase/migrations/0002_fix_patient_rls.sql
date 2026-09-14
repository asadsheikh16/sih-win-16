drop policy if exists patients_self on public.patients;

create policy patients_self
on public.patients
for select
to authenticated
using (
  id in (
    select pc.patient_id
    from public.patient_contacts as pc
    where pc.value = auth.email()
  )
);
