insert into public.profiles (id, full_name, facility_id)
select u.id,
       case u.email
         when 'doctor@niramay.demo' then 'Dr. Ananya Sharma'
         when 'operator@niramay.demo' then 'Ravi Kumar'
         when 'pharmacy@niramay.demo' then 'Neha Singh'
         else coalesce(u.raw_user_meta_data ->> 'full_name', u.email)
       end,
       f.id
from auth.users as u
cross join public.facilities as f
where f.code = 'DH-KOT-042'
  and u.email in ('doctor@niramay.demo', 'operator@niramay.demo', 'pharmacy@niramay.demo')
on conflict (id) do update
set facility_id = excluded.facility_id,
    full_name = excluded.full_name,
    updated_at = now();

insert into public.user_roles (user_id, role)
select u.id,
       case u.email
         when 'doctor@niramay.demo' then 'DOCTOR'::public.app_role
         when 'operator@niramay.demo' then 'REGISTRATION_OPERATOR'::public.app_role
         when 'pharmacy@niramay.demo' then 'PHARMACIST'::public.app_role
       end
from auth.users as u
where u.email in ('doctor@niramay.demo', 'operator@niramay.demo', 'pharmacy@niramay.demo')
on conflict (user_id, role) do nothing;