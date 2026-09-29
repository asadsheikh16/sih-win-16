alter table public.patients
  add column if not exists owner_user_id uuid references auth.users(id) on delete set null;

create unique index if not exists patients_owner_user_id_unique
  on public.patients(owner_user_id)
  where owner_user_id is not null;

create table if not exists public.patient_private_profiles (
  patient_id uuid primary key references public.patients(id) on delete cascade,
  address text,
  city text,
  state text,
  pincode text,
  emergency_contact_name text,
  emergency_contact_number text,
  known_allergies text,
  medical_conditions text,
  current_medications text,
  updated_at timestamptz not null default now()
);

alter table public.patient_private_profiles enable row level security;

create or replace function public.patient_id_for_user()
returns uuid
language sql stable security definer set search_path = public
as $$ select id from public.patients where owner_user_id = auth.uid() limit 1 $$;

create or replace function public.create_owned_patient_profile(
  full_name text,
  date_of_birth date,
  patient_gender text,
  patient_blood_group text,
  mobile_number text,
  patient_address text,
  patient_city text,
  patient_state text,
  patient_pincode text,
  emergency_name text,
  emergency_number text,
  allergies text,
  medical_conditions text,
  current_medications text
)
returns public.patients
language plpgsql security definer set search_path = public
as $$
declare
  target_facility uuid;
  created_patient public.patients;
begin
  if auth.uid() is null then raise exception 'Authentication is required'; end if;
  if exists (select 1 from public.patients where owner_user_id = auth.uid()) then
    raise exception 'A patient profile already exists for this account';
  end if;
  if length(trim(full_name)) < 2 then raise exception 'Full name is required'; end if;
  select id into target_facility from public.facilities where code = 'DH-KOT-042' limit 1;
  if target_facility is null then raise exception 'Patient facility is not configured'; end if;
  insert into public.patients (owner_user_id, niramay_id, name, dob, gender, blood_group, facility_id)
  values (auth.uid(), 'AV-' || to_char(current_date, 'YYYY') || '-' || upper(substr(md5(random()::text || clock_timestamp()::text || auth.uid()::text), 1, 6)), trim(full_name), date_of_birth, nullif(trim(patient_gender), ''), nullif(trim(patient_blood_group), ''), target_facility)
  returning * into created_patient;
  insert into public.patient_contacts (patient_id, type, value)
  values (created_patient.id, 'MOBILE', trim(mobile_number));
  insert into public.patient_private_profiles (patient_id, address, city, state, pincode, emergency_contact_name, emergency_contact_number, known_allergies, medical_conditions, current_medications)
  values (created_patient.id, nullif(trim(patient_address), ''), nullif(trim(patient_city), ''), nullif(trim(patient_state), ''), nullif(trim(patient_pincode), ''), nullif(trim(emergency_name), ''), nullif(trim(emergency_number), ''), nullif(trim(allergies), ''), nullif(trim(medical_conditions), ''), nullif(trim(current_medications), ''));
  return created_patient;
end;
$$;

revoke all on function public.create_owned_patient_profile(text, date, text, text, text, text, text, text, text, text, text, text, text, text) from public;
grant execute on function public.create_owned_patient_profile(text, date, text, text, text, text, text, text, text, text, text, text, text, text) to authenticated;

drop policy if exists patients_staff on public.patients;
drop policy if exists patients_staff_read on public.patients;
drop policy if exists patients_owner_read on public.patients;
drop policy if exists patients_owner_update on public.patients;
drop policy if exists patients_registration_insert on public.patients;
create policy patients_staff_read on public.patients for select to authenticated
using (public.staff_can_access_facility(facility_id));
create policy patients_owner_read on public.patients for select to authenticated
using (owner_user_id = auth.uid());
create policy patients_owner_update on public.patients for update to authenticated
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());
create policy patients_registration_insert on public.patients for insert to authenticated
with check (public.staff_can_access_facility(facility_id));

drop policy if exists private_profile_owner on public.patient_private_profiles;
create policy private_profile_owner on public.patient_private_profiles for all to authenticated
using (patient_id = public.patient_id_for_user())
with check (patient_id = public.patient_id_for_user());

drop policy if exists contacts_owner on public.patient_contacts;
drop policy if exists clinical_staff on public.patient_contacts;
create policy contacts_owner on public.patient_contacts for all to authenticated
using (patient_id = public.patient_id_for_user())
with check (patient_id = public.patient_id_for_user());
