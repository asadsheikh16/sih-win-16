create or replace function public.staff_facility_id()
returns uuid
language sql stable security definer set search_path = public
as $$ select facility_id from public.profiles where id = auth.uid() and status = 'ACTIVE' $$;

create or replace function public.staff_can_access_facility(target_facility_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$ select public.is_staff() and target_facility_id = public.staff_facility_id() $$;

insert into public.profiles (id, full_name, facility_id)
select u.id,
	   case u.email when 'doctor@niramay.demo' then 'Dr. Ananya Sharma' when 'operator@niramay.demo' then 'Ravi Kumar' when 'pharmacy@niramay.demo' then 'Neha Singh' else coalesce(u.raw_user_meta_data ->> 'full_name', u.email) end,
	   f.id
from auth.users u cross join public.facilities f
where u.email in ('doctor@niramay.demo', 'operator@niramay.demo', 'pharmacy@niramay.demo') and f.code = 'DH-KOT-042'
on conflict (id) do update set facility_id = excluded.facility_id, updated_at = now();

insert into public.user_roles (user_id, role)
select u.id, case u.email when 'doctor@niramay.demo' then 'DOCTOR'::public.app_role when 'operator@niramay.demo' then 'REGISTRATION_OPERATOR'::public.app_role when 'pharmacy@niramay.demo' then 'PHARMACIST'::public.app_role end from auth.users u where u.email in ('doctor@niramay.demo', 'operator@niramay.demo', 'pharmacy@niramay.demo')
on conflict (user_id, role) do nothing;

alter table public.prescription_items add column if not exists quantity integer not null default 1;

drop policy if exists departments_staff_read on public.departments;
create policy departments_staff_read on public.departments for select to authenticated
using (public.staff_can_access_facility(facility_id));

drop policy if exists patients_staff on public.patients;
create policy patients_staff on public.patients for all to authenticated
using (public.staff_can_access_facility(facility_id))
with check (public.staff_can_access_facility(facility_id));

drop policy if exists doctors_staff on public.doctors;
create policy doctors_staff on public.doctors for select to authenticated
using (exists (select 1 from public.departments d where d.id = department_id and public.staff_can_access_facility(d.facility_id)));

drop policy if exists opd_staff on public.opd_registrations;
create policy opd_staff on public.opd_registrations for all to authenticated
using (exists (select 1 from public.patients p where p.id = patient_id and public.staff_can_access_facility(p.facility_id)))
with check (exists (select 1 from public.patients p join public.departments d on d.id = department_id where p.id = patient_id and p.facility_id = d.facility_id and public.staff_can_access_facility(p.facility_id)));

drop policy if exists queue_staff on public.queue_tokens;
create policy queue_staff on public.queue_tokens for all to authenticated
using (exists (select 1 from public.patients p where p.id = patient_id and public.staff_can_access_facility(p.facility_id)))
with check (exists (select 1 from public.patients p join public.departments d on d.id = department_id where p.id = patient_id and p.facility_id = d.facility_id and public.staff_can_access_facility(p.facility_id)));

drop policy if exists consultations_staff on public.consultations;
create policy consultations_staff on public.consultations for all to authenticated
using (exists (select 1 from public.patients p where p.id = patient_id and public.staff_can_access_facility(p.facility_id)))
with check (exists (select 1 from public.patients p join public.doctors d on d.id = doctor_id join public.departments dep on dep.id = d.department_id where p.id = patient_id and p.facility_id = dep.facility_id and d.user_id = auth.uid() and public.staff_can_access_facility(p.facility_id)));

drop policy if exists prescriptions_staff on public.prescriptions;
create policy prescriptions_staff on public.prescriptions for all to authenticated
using (exists (select 1 from public.patients p where p.id = patient_id and public.staff_can_access_facility(p.facility_id)))
with check (exists (select 1 from public.patients p join public.doctors d on d.id = doctor_id join public.departments dep on dep.id = d.department_id where p.id = patient_id and p.facility_id = dep.facility_id and d.user_id = auth.uid() and public.staff_can_access_facility(p.facility_id)));

drop policy if exists prescription_items_staff on public.prescription_items;
create policy prescription_items_staff on public.prescription_items for all to authenticated
using (exists (select 1 from public.prescriptions p where p.id = prescription_id and exists (select 1 from public.patients pt where pt.id = p.patient_id and public.staff_can_access_facility(pt.facility_id))))
with check (exists (select 1 from public.prescriptions p where p.id = prescription_id and exists (select 1 from public.patients pt where pt.id = p.patient_id and public.staff_can_access_facility(pt.facility_id))));

drop policy if exists investigations_staff on public.investigation_orders;
create policy investigations_staff on public.investigation_orders for all to authenticated
using (exists (select 1 from public.patients p where p.id = patient_id and public.staff_can_access_facility(p.facility_id)))
with check (exists (select 1 from public.patients p where p.id = patient_id and public.staff_can_access_facility(p.facility_id)));

drop policy if exists lab_results_staff on public.lab_results;
create policy lab_results_staff on public.lab_results for all to authenticated
using (exists (select 1 from public.investigation_orders o join public.patients p on p.id = o.patient_id where o.id = order_id and public.staff_can_access_facility(p.facility_id)))
with check (exists (select 1 from public.investigation_orders o join public.patients p on p.id = o.patient_id where o.id = order_id and public.staff_can_access_facility(p.facility_id)));

drop policy if exists investigations_master_staff on public.investigations;
create policy investigations_master_staff on public.investigations for select to authenticated using (public.is_staff());
drop policy if exists medicines_staff on public.medicines;
create policy medicines_staff on public.medicines for select to authenticated using (public.is_staff());
drop policy if exists medicine_batches_staff on public.medicine_batches;
create policy medicine_batches_staff on public.medicine_batches for select to authenticated using (public.is_staff());
drop policy if exists pharmacy_dispensing_staff on public.pharmacy_dispensing;
create policy pharmacy_dispensing_staff on public.pharmacy_dispensing for all to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists consents_staff on public.consents;
create policy consents_staff on public.consents for all to authenticated using (exists (select 1 from public.patients p where p.id = patient_id and public.staff_can_access_facility(p.facility_id))) with check (exists (select 1 from public.patients p where p.id = patient_id and public.staff_can_access_facility(p.facility_id)));
drop policy if exists intake_messages_staff on public.intake_messages;
create policy intake_messages_staff on public.intake_messages for all to authenticated using (exists (select 1 from public.intake_sessions s join public.patients p on p.id = s.patient_id where s.id = session_id and public.staff_can_access_facility(p.facility_id))) with check (exists (select 1 from public.intake_sessions s join public.patients p on p.id = s.patient_id where s.id = session_id and public.staff_can_access_facility(p.facility_id)));
drop policy if exists intake_answers_staff on public.intake_answers;
create policy intake_answers_staff on public.intake_answers for all to authenticated using (exists (select 1 from public.intake_sessions s join public.patients p on p.id = s.patient_id where s.id = session_id and public.staff_can_access_facility(p.facility_id))) with check (exists (select 1 from public.intake_sessions s join public.patients p on p.id = s.patient_id where s.id = session_id and public.staff_can_access_facility(p.facility_id)));
drop policy if exists intake_staff on public.intake_sessions;
create policy intake_staff on public.intake_sessions for all to authenticated using (exists (select 1 from public.patients p where p.id = patient_id and public.staff_can_access_facility(p.facility_id))) with check (exists (select 1 from public.patients p where p.id = patient_id and public.staff_can_access_facility(p.facility_id)));
drop policy if exists summaries_staff on public.clinical_summaries;
create policy summaries_staff on public.clinical_summaries for all to authenticated using (exists (select 1 from public.patients p where p.id = patient_id and public.staff_can_access_facility(p.facility_id))) with check (exists (select 1 from public.patients p where p.id = patient_id and public.staff_can_access_facility(p.facility_id)));

create or replace function public.dispense_prescription(target_prescription_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
	line record;
	medicine_row record;
	batch_row record;
	remaining integer;
begin
	if not public.is_staff() then raise exception 'Only authorized pharmacy staff can dispense prescriptions'; end if;
	if not exists (select 1 from prescriptions p join patients pt on pt.id = p.patient_id where p.id = target_prescription_id and p.status = 'PENDING' and public.staff_can_access_facility(pt.facility_id)) then raise exception 'Prescription is unavailable or already dispensed'; end if;
	for line in select * from prescription_items where prescription_id = target_prescription_id loop
		select * into medicine_row from medicines where lower(name) = lower(line.medicine) limit 1;
		if medicine_row.id is null then raise exception 'Medicine is not available in the master data: %', line.medicine; end if;
		remaining := line.quantity;
		for batch_row in select * from medicine_batches where medicine_id = medicine_row.id and quantity > 0 and expiry_date >= current_date order by expiry_date for update loop
			if remaining <= 0 then exit; end if;
			if batch_row.quantity >= remaining then
				update medicine_batches set quantity = quantity - remaining where id = batch_row.id;
				insert into pharmacy_dispensing(prescription_id, medicine_id, quantity) values (target_prescription_id, medicine_row.id, remaining);
				remaining := 0;
			else
				update medicine_batches set quantity = 0 where id = batch_row.id;
				insert into pharmacy_dispensing(prescription_id, medicine_id, quantity) values (target_prescription_id, medicine_row.id, batch_row.quantity);
				remaining := remaining - batch_row.quantity;
			end if;
		end loop;
		if remaining > 0 then raise exception 'Insufficient stock for medicine: %', line.medicine; end if;
	end loop;
	update prescriptions set status = 'DISPENSED' where id = target_prescription_id;
	return jsonb_build_object('prescription_id', target_prescription_id, 'status', 'DISPENSED');
end $$;