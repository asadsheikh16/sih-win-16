import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

type Patient = { id: string; name: string; niramay_id: string };
type Department = { id: string; name: string };

export default function OpdRegistration() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [patientId, setPatientId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [priority, setPriority] = useState('ROUTINE');
  const [search, setSearch] = useState('');
  const [token, setToken] = useState<any>();
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!supabase) { setError('Supabase is not configured. Add your project values in .env.'); setLoading(false); return; }
    Promise.all([
      supabase.from('patients').select('id,name,niramay_id').order('name').limit(50),
      supabase.from('departments').select('id,name').order('name')
    ]).then(([patientResult, departmentResult]) => {
      const failure = patientResult.error || departmentResult.error;
      if (failure) {
        console.error('Unable to load OPD registration choices from Supabase.', { patientResult, departmentResult });
        setError(`Unable to load registration choices. ${failure.message}`);
      } else {
        if (!patientResult.data?.length) console.warn('Supabase returned no authorized patients for OPD registration.', patientResult);
        if (!departmentResult.data?.length) console.warn('Supabase returned no departments for OPD registration.', departmentResult);
        setPatients(patientResult.data || []); setDepartments(departmentResult.data || []); setPatientId(patientResult.data?.[0]?.id || ''); setDepartmentId(departmentResult.data?.[0]?.id || '');
      }
    }).catch(loadError => { console.error('Unable to load OPD registration choices from Supabase.', loadError); setError(`Unable to load registration choices. ${loadError instanceof Error ? loadError.message : 'Please retry.'}`); }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!supabase) return;
    if (!search.trim()) {
      const loadPatients = async () => {
        setSearching(true);
        const result = await supabase.from('patients').select('id,name,niramay_id').order('name').limit(50);
        if (result.error) { console.error('Unable to reload OPD patients from Supabase.', result.error); setError(`Unable to load patients. ${result.error.message}`); }
        else {
          if (!result.data?.length) console.warn('Supabase returned no authorized patients for OPD registration.', result);
          setPatients(result.data || []);
          setPatientId(current => result.data?.some(patient => patient.id === current) ? current : '');
        }
        setSearching(false);
      };
      void loadPatients();
      return;
    }
    const timer = window.setTimeout(async () => {
      setSearching(true);
      setError('');
      try {
        const term = search.trim();
        const [nameResult, idResult] = await Promise.all([
          supabase.from('patients').select('id,name,niramay_id').ilike('name', `%${term}%`).order('name').limit(50),
          supabase.from('patients').select('id,name,niramay_id').ilike('niramay_id', `%${term}%`).order('name').limit(50)
        ]);
        const failure = nameResult.error || idResult.error;
        if (failure) { console.error('Unable to search OPD patients in Supabase.', { nameResult, idResult }); setError(`Unable to search patients. ${failure.message}`); }
        else {
          const matches = [...(nameResult.data || []), ...(idResult.data || [])].filter((patient, index, list) => list.findIndex(item => item.id === patient.id) === index);
          setPatients(matches);
          setPatientId(current => matches.some(patient => patient.id === current) ? current : '');
        }
      } catch (searchError) {
        setError(`Unable to search patients. ${searchError instanceof Error ? searchError.message : 'Please retry.'}`);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const visiblePatients = useMemo(() => patients, [patients]);
  const register = async () => {
    if (!supabase || !patientId || !departmentId) return setError('Select a patient and department before registering.');
    setSaving(true); setError('');
    const registration = await supabase.from('opd_registrations').insert({ patient_id: patientId, department_id: departmentId }).select().single();
    if (registration.error) { setError(`Unable to register OPD visit. ${registration.error.message}`); setSaving(false); return; }
    const datePart = new Date().toISOString().slice(0, 10).replaceAll('-', '');
    const tokenNumber = `OPD-${datePart}-${String(Date.now()).slice(-5)}`;
    const queue = await supabase.from('queue_tokens').insert({ token: tokenNumber, patient_id: patientId, department_id: departmentId, priority }).select('*,patients(name,niramay_id),departments(name)').single();
    if (queue.error) {
      await supabase.from('opd_registrations').delete().eq('id', registration.data.id);
      setError(`Unable to create queue token. The OPD registration was rolled back. ${queue.error.message}`); setSaving(false); return;
    }
    setToken({ ...queue.data, registration: registration.data }); setSaving(false);
  };

  if (loading) return <div className="state">Loading registration desk…</div>;
  if (token) return <div><div className="page-head"><div><p className="eyebrow">REGISTRATION CONFIRMED</p><h1>OPD visit registered</h1><p>Only information returned by Supabase is shown below.</p></div><span className="badge">DATABASE SAVED</span></div><section className="token-card"><small>QUEUE TOKEN</small><strong>{token.token}</strong><div><span>Patient</span><b>{token.patients?.name}</b></div><div><span>Department</span><b>{token.departments?.name}</b></div><div><span>Priority</span><b>{token.priority}</b></div><div><span>Status</span><b className="status-badge waiting">{token.status}</b></div><p>Created {new Date(token.created_at).toLocaleString()}</p></section><div className="conversation-actions"><Link className="button" to="/queue">View live queue</Link><button className="button secondary" onClick={() => setToken(undefined)}>Register another visit</button></div></div>;
  return <div><div className="page-head"><div><p className="eyebrow">REGISTRATION COUNTER · SUPABASE</p><h1>OPD registration</h1><p>Search an authorized patient, choose the department, and create a real queue token.</p></div><span className="badge">NO DEMO TOKEN</span></div>{error && <div className="error-panel"><span>{error}</span><button onClick={() => location.reload()}>Retry</button></div>}<section className="panel form-card"><label>Search patient<input value={search} onChange={event => setSearch(event.target.value)} placeholder="Name or AarogyaVaani ID" />{searching && <small>Searching patients…</small>}</label><label>Patient<select value={patientId} onChange={event => setPatientId(event.target.value)} disabled={searching || !visiblePatients.length}><option value="">{searching ? 'Searching…' : visiblePatients.length ? 'Select patient' : search ? 'No matching patient' : 'No patients available'}</option>{visiblePatients.map(patient => <option key={patient.id} value={patient.id}>{patient.name} · {patient.niramay_id}</option>)}</select></label><label>Department<select value={departmentId} onChange={event => setDepartmentId(event.target.value)} disabled={!departments.length}><option value="">{departments.length ? 'Select department' : 'No departments available'}</option>{departments.map(department => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label><label>Priority<select value={priority} onChange={event => setPriority(event.target.value)}><option value="ROUTINE">Routine</option><option value="HIGH">High priority</option><option value="EMERGENCY">Emergency</option></select></label><button className="button" onClick={register} disabled={saving || searching || !patientId || !departmentId}>{saving ? 'Registering securely…' : 'Register and generate token'}</button></section></div>;
}
