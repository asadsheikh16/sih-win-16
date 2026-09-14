create extension if not exists pgcrypto;

create type public.app_role as enum ('PATIENT','REGISTRATION_OPERATOR','NURSE','DOCTOR','PHARMACIST','LAB_TECHNICIAN','HOSPITAL_ADMIN','DISTRICT_ADMIN','STATE_ADMIN','SUPER_ADMIN');
create type public.queue_status as enum ('WAITING','CALLED','IN_CONSULTATION','ON_HOLD','COMPLETED','SKIPPED');

create table public.facilities (id uuid primary key default gen_random_uuid(), name text not null, code text unique not null, district text not null, state text not null, created_at timestamptz not null default now());
create table public.profiles (id uuid primary key references auth.users(id) on delete cascade, full_name text not null, facility_id uuid references public.facilities(id), status text not null default 'ACTIVE', created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.user_roles (user_id uuid references auth.users(id) on delete cascade, role public.app_role not null, primary key(user_id, role));
create table public.departments (id uuid primary key default gen_random_uuid(), facility_id uuid not null references public.facilities(id), name text not null, unique(facility_id,name));
create table public.doctors (id uuid primary key default gen_random_uuid(), user_id uuid unique not null references auth.users(id), department_id uuid not null references public.departments(id));
create table public.patients (id uuid primary key default gen_random_uuid(), niramay_id text unique not null, name text not null, dob date, gender text, blood_group text, facility_id uuid not null references public.facilities(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.patient_identifiers (id uuid primary key default gen_random_uuid(), patient_id uuid not null references public.patients(id) on delete cascade, type text not null, value text not null);
create table public.patient_contacts (id uuid primary key default gen_random_uuid(), patient_id uuid not null references public.patients(id) on delete cascade, type text not null, value text not null);
create table public.patient_cards (id uuid primary key default gen_random_uuid(), patient_id uuid not null references public.patients(id), facility_id uuid not null references public.facilities(id), secure_ref text unique not null, issue_date timestamptz not null default now());
create table public.appointments (id uuid primary key default gen_random_uuid(), patient_id uuid not null references public.patients(id), department_id uuid not null references public.departments(id), doctor_id uuid references public.doctors(id), status text not null default 'SCHEDULED', scheduled_at timestamptz not null);
create table public.opd_registrations (id uuid primary key default gen_random_uuid(), patient_id uuid not null references public.patients(id), department_id uuid not null references public.departments(id), registered_at timestamptz not null default now());
create table public.queue_tokens (id uuid primary key default gen_random_uuid(), token text not null, patient_id uuid not null references public.patients(id), department_id uuid not null references public.departments(id), doctor_id uuid references public.doctors(id), priority text not null default 'ROUTINE', status public.queue_status not null default 'WAITING', created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.consultations (id uuid primary key default gen_random_uuid(), patient_id uuid not null references public.patients(id), doctor_id uuid not null references public.doctors(id), chief_complaint text, history text, examination text, diagnosis text, followup_date date, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.vitals (id uuid primary key default gen_random_uuid(), patient_id uuid not null references public.patients(id), consultation_id uuid references public.consultations(id), blood_pressure text, pulse numeric, temperature numeric, spo2 numeric, respiratory_rate numeric, height numeric, weight numeric, recorded_at timestamptz not null default now());
create table public.medical_histories (id uuid primary key default gen_random_uuid(), patient_id uuid not null references public.patients(id) on delete cascade, condition text not null, notes text);
create table public.allergies (id uuid primary key default gen_random_uuid(), patient_id uuid not null references public.patients(id) on delete cascade, substance text not null, reaction text);
create table public.diagnoses (id uuid primary key default gen_random_uuid(), patient_id uuid not null references public.patients(id), consultation_id uuid references public.consultations(id), label text not null);
create table public.investigations (id uuid primary key default gen_random_uuid(), name text unique not null);
create table public.investigation_orders (id uuid primary key default gen_random_uuid(), patient_id uuid not null references public.patients(id), investigation_id uuid not null references public.investigations(id), consultation_id uuid references public.consultations(id), status text not null default 'REQUESTED', created_at timestamptz not null default now());
create table public.lab_results (id uuid primary key default gen_random_uuid(), order_id uuid unique not null references public.investigation_orders(id) on delete cascade, result text not null, unit text, reference_range text, remarks text, verified_at timestamptz);
create table public.prescriptions (id uuid primary key default gen_random_uuid(), patient_id uuid not null references public.patients(id), doctor_id uuid not null references public.doctors(id), consultation_id uuid references public.consultations(id), status text not null default 'PENDING', followup_date date, created_at timestamptz not null default now());
create table public.prescription_items (id uuid primary key default gen_random_uuid(), prescription_id uuid not null references public.prescriptions(id) on delete cascade, medicine text not null, dose text not null, route text, frequency text not null, duration text not null, instructions text);
create table public.medicines (id uuid primary key default gen_random_uuid(), name text unique not null);
create table public.medicine_batches (id uuid primary key default gen_random_uuid(), medicine_id uuid not null references public.medicines(id), batch_number text not null, quantity integer not null default 0, expiry_date date not null);
create table public.pharmacy_dispensing (id uuid primary key default gen_random_uuid(), prescription_id uuid not null references public.prescriptions(id), medicine_id uuid not null references public.medicines(id), quantity integer not null, dispensed_at timestamptz not null default now());
create table public.documents (id uuid primary key default gen_random_uuid(), patient_id uuid not null references public.patients(id), type text not null, file_path text not null, status text not null default 'UPLOADED', created_at timestamptz not null default now());
create table public.ocr_extractions (id uuid primary key default gen_random_uuid(), document_id uuid unique not null references public.documents(id) on delete cascade, data jsonb not null default '{}', verified boolean not null default false);
create table public.voice_intakes (id uuid primary key default gen_random_uuid(), patient_id uuid not null references public.patients(id), language text not null, transcript text not null, verified boolean not null default false, created_at timestamptz not null default now());
create table public.ai_triage_assessments (id uuid primary key default gen_random_uuid(), patient_id uuid not null references public.patients(id), risk_level text not null, input jsonb not null, output jsonb not null, created_at timestamptz not null default now());
create table public.ayush_consultations (id uuid primary key default gen_random_uuid(), patient_id uuid not null references public.patients(id), system text not null, treatment text not null, followup_date date, created_at timestamptz not null default now());
create table public.government_schemes (id uuid primary key default gen_random_uuid(), name text not null);
create table public.scheme_verifications (id uuid primary key default gen_random_uuid(), patient_id uuid not null references public.patients(id), scheme_id uuid not null references public.government_schemes(id), status text not null);
create table public.notifications (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id), title text not null, body text not null, read_at timestamptz, created_at timestamptz not null default now());
create table public.followups (id uuid primary key default gen_random_uuid(), patient_id uuid not null references public.patients(id), due_date date not null, reason text not null, status text not null default 'DUE');
create table public.consents (id uuid primary key default gen_random_uuid(), patient_id uuid not null references public.patients(id), purpose text not null, granted_at timestamptz not null default now());
create table public.audit_logs (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id), facility_id uuid references public.facilities(id), action text not null, patient_ref text, result text not null, created_at timestamptz not null default now());
create table public.intake_sessions (id uuid primary key default gen_random_uuid(), patient_id uuid references public.patients(id), status text not null default 'IN_PROGRESS', language text not null default 'hi-IN', created_at timestamptz not null default now(), completed_at timestamptz);
create table public.intake_messages (id uuid primary key default gen_random_uuid(), session_id uuid not null references public.intake_sessions(id) on delete cascade, sender text not null, message text not null, created_at timestamptz not null default now());
create table public.intake_answers (id uuid primary key default gen_random_uuid(), session_id uuid not null references public.intake_sessions(id) on delete cascade, question_key text not null, answer text not null, source text not null default 'TOUCH', created_at timestamptz not null default now());
create table public.clinical_summaries (id uuid primary key default gen_random_uuid(), session_id uuid unique not null references public.intake_sessions(id) on delete cascade, patient_id uuid not null references public.patients(id), summary jsonb not null, verified boolean not null default false, created_at timestamptz not null default now());

create index patients_name_idx on public.patients(name); create index queue_status_idx on public.queue_tokens(status); create index audit_created_idx on public.audit_logs(created_at desc);
insert into public.facilities(name,code,district,state) values ('District Hospital, Kota','DH-KOT-042','Kota','Rajasthan') on conflict(code) do nothing;
insert into public.departments(facility_id,name) select id, name from public.facilities cross join (values ('General Medicine'),('Emergency'),('Pediatrics'),('Orthopedics'),('Gynecology'),('ENT'),('Dermatology'),('AYUSH'),('Laboratory'),('Pharmacy')) as d(name) where code='DH-KOT-042' on conflict do nothing;

create or replace function public.is_staff() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.user_roles where user_id=auth.uid() and role in ('REGISTRATION_OPERATOR','NURSE','DOCTOR','PHARMACIST','LAB_TECHNICIAN','HOSPITAL_ADMIN','DISTRICT_ADMIN','STATE_ADMIN','SUPER_ADMIN')); $$;
alter table public.facilities enable row level security; alter table public.profiles enable row level security; alter table public.user_roles enable row level security; alter table public.patients enable row level security; alter table public.patient_contacts enable row level security; alter table public.patient_cards enable row level security; alter table public.appointments enable row level security; alter table public.opd_registrations enable row level security; alter table public.queue_tokens enable row level security; alter table public.consultations enable row level security; alter table public.vitals enable row level security; alter table public.prescriptions enable row level security; alter table public.prescription_items enable row level security; alter table public.investigation_orders enable row level security; alter table public.lab_results enable row level security; alter table public.documents enable row level security; alter table public.audit_logs enable row level security;
create policy facilities_read on public.facilities for select to authenticated using (true);
create policy profiles_self on public.profiles for all to authenticated using (id=auth.uid() or public.is_staff()) with check (id=auth.uid() or public.is_staff());
create policy roles_self on public.user_roles for select to authenticated using (user_id=auth.uid() or public.is_staff());
create policy patients_staff on public.patients for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy patients_self on public.patients for select to authenticated using (id in (select patient_id from public.patient_contacts where value=(select email from auth.users where id=auth.uid())));
create policy clinical_staff on public.patient_contacts for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy cards_staff on public.patient_cards for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy workflow_staff on public.appointments for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy opd_staff on public.opd_registrations for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy queue_staff on public.queue_tokens for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy consultations_staff on public.consultations for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy vitals_staff on public.vitals for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy prescriptions_staff on public.prescriptions for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy prescription_items_staff on public.prescription_items for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy investigations_staff on public.investigation_orders for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy lab_results_staff on public.lab_results for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy documents_staff on public.documents for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy audit_read_staff on public.audit_logs for select to authenticated using (public.is_staff());
alter table public.intake_sessions enable row level security;
alter table public.intake_messages enable row level security;
alter table public.intake_answers enable row level security;
alter table public.clinical_summaries enable row level security;
create policy intake_staff on public.intake_sessions for all to authenticated using (public.is_staff() or patient_id in (select id from public.patients where id=patient_id)) with check (public.is_staff() or patient_id in (select id from public.patients where id=patient_id));
create policy intake_messages_staff on public.intake_messages for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy intake_answers_staff on public.intake_answers for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy summaries_staff on public.clinical_summaries for all to authenticated using (public.is_staff()) with check (public.is_staff());

insert into storage.buckets(id,name,public) values ('patient-photos','patient-photos',false),('medical-documents','medical-documents',false) on conflict(id) do nothing;
create policy patient_photos_staff on storage.objects for all to authenticated using (bucket_id='patient-photos' and public.is_staff()) with check (bucket_id='patient-photos' and public.is_staff());
create policy medical_documents_staff on storage.objects for all to authenticated using (bucket_id='medical-documents' and public.is_staff()) with check (bucket_id='medical-documents' and public.is_staff());

do $$
declare table_name text;
begin
  for table_name in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end $$;
