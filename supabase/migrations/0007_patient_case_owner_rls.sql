drop policy if exists intake_owner on public.intake_sessions;
create policy intake_owner on public.intake_sessions for all to authenticated
using (patient_id = public.patient_id_for_user())
with check (patient_id = public.patient_id_for_user());

drop policy if exists intake_answers_owner on public.intake_answers;
create policy intake_answers_owner on public.intake_answers for all to authenticated
using (exists (select 1 from public.intake_sessions s where s.id = session_id and s.patient_id = public.patient_id_for_user()))
with check (exists (select 1 from public.intake_sessions s where s.id = session_id and s.patient_id = public.patient_id_for_user()));

drop policy if exists intake_messages_owner on public.intake_messages;
create policy intake_messages_owner on public.intake_messages for all to authenticated
using (exists (select 1 from public.intake_sessions s where s.id = session_id and s.patient_id = public.patient_id_for_user()))
with check (exists (select 1 from public.intake_sessions s where s.id = session_id and s.patient_id = public.patient_id_for_user()));

drop policy if exists summaries_owner on public.clinical_summaries;
create policy summaries_owner on public.clinical_summaries for all to authenticated
using (patient_id = public.patient_id_for_user())
with check (patient_id = public.patient_id_for_user());

drop policy if exists consents_owner on public.consents;
create policy consents_owner on public.consents for all to authenticated
using (patient_id = public.patient_id_for_user())
with check (patient_id = public.patient_id_for_user());
