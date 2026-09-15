import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

type Patient = { id: string; name: string; niramay_id: string; patient_contacts?: { value: string }[]; patient_identifiers?: { value: string }[] };
type Department = { id: string; name: string };
type PatientForm = { name: string; dob: string; gender: string; bloodGroup: string; mobile: string };

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
  const [facilityId, setFacilityId] = useState('');
  const [facilityName, setFacilityName] = useState('');
  const [showPatientForm, setShowPatientForm] = useState(false);
  const [patientForm, setPatientForm] = useState<PatientForm>({ name: '', dob: '', gender: '', bloodGroup: '', mobile: '' });
  const [patientMessage, setPatientMessage] = useState('');
  const [registeringPatient, setRegisteringPatient] = useState(false);

  const loadPatients = async (term = '') => {
    if (!supabase) return;
    const searchTerm = term.trim();
    const result = await supabase.from('patients').select('id,name,niramay_id,patient_contacts(value),patient_identifiers(value)').order('name').limit(100);
    if (result.error) throw result.error;
    const matches = (result.data || []).filter(patient => {
      if (!searchTerm) return true;
      const values = [patient.name, patient.niramay_id, ...(patient.patient_contacts || []).map(contact => contact.value), ...(patient.patient_identifiers || []).map(identifier => identifier.value)];
      return values.some(value => value.toLowerCase().includes(searchTerm.toLowerCase()));
    });
    setPatients(matches.map(patient => ({ id: patient.id, name: patient.name, niramay_id: patient.niramay_id })));
    setPatientId(current => matches.some(patient => patient.id === current) ? current : '');
  };

  useEffect(() => {
    if (!supabase) { setError('Supabase is not configured. Add your project values in .env.'); setLoading(false); return; }
    void (async () => {
      const userResult = await supabase.auth.getUser();
      if (userResult.error || !userResult.data.user) throw new Error(userResult.error?.message || 'Signed-in user was not found.');
      const [patientResult, departmentResult, profileResult] = await Promise.all([
        supabase.from('patients').select('id,name,niramay_id').order('name').limit(50),
        supabase.from('departments').select('id,name').order('name'),
        supabase.from('profiles').select('facility_id,facilities(name)').eq('id', userResult.data.user.id).maybeSingle()
      ]);
      const failure = patientResult.error || departmentResult.error || profileResult.error;
      if (failure) {
        console.error('Unable to load OPD registration choices from Supabase.', { patientResult, departmentResult });
        setError(`Unable to load registration choices. ${failure.message}`);
      } else {
        if (!patientResult.data?.length) console.warn('Supabase returned no authorized patients for OPD registration.', patientResult);
        if (!departmentResult.data?.length) console.warn('Supabase returned no departments for OPD registration.', departmentResult);
        const profile = profileResult.data as any;
        setFacilityId(profile?.facility_id || ''); setFacilityName(profile?.facilities?.name || 'District Hospital, Kota');
        setPatients(patientResult.data || []); setDepartments(departmentResult.data || []); setPatientId(patientResult.data?.[0]?.id || ''); setDepartmentId(departmentResult.data?.[0]?.id || '');
      }
    })().catch(loadError => { console.error('Unable to load OPD registration choices from Supabase.', loadError); setError(`Unable to load registration choices. ${loadError instanceof Error ? loadError.message : 'Please retry.'}`); }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!supabase) return;
    if (!search.trim()) {
      const reloadPatients = async () => {
        setSearching(true);
        try { await loadPatients(''); } catch (loadError) { console.error('Unable to reload OPD patients from Supabase.', loadError); setError(`Unable to load patients. ${loadError instanceof Error ? loadError.message : 'Please retry.'}`); }
        setSearching(false);
      };
      void reloadPatients();
      return;
    }
    const timer = window.setTimeout(async () => {
      setSearching(true);
      setError('');
      try {
        const term = search.trim();
        await loadPatients(term);
      } catch (searchError) {
        setError(`Unable to search patients. ${searchError instanceof Error ? searchError.message : 'Please retry.'}`);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const visiblePatients = useMemo(() => patients, [patients]);
  const registerPatient = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase || !facilityId) return setPatientMessage('Unable to determine your authorised facility.');
    if (!patientForm.name.trim()) return setPatientMessage('Patient name is required.');
    setRegisteringPatient(true); setPatientMessage('Registering patient securely…');
    const niramayId = `AV-${new Date().getFullYear()}-${crypto.randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase()}`;
    const patient = await supabase.from('patients').insert({ niramay_id: niramayId, name: patientForm.name.trim(), dob: patientForm.dob || null, gender: patientForm.gender || null, blood_group: patientForm.bloodGroup || null, facility_id: facilityId }).select('id,name,niramay_id').single();
    if (patient.error) { setPatientMessage(`Unable to register patient: ${patient.error.message}`); setRegisteringPatient(false); return; }
    if (patientForm.mobile.trim()) {
      const contact = await supabase.from('patient_contacts').insert({ patient_id: patient.data.id, type: 'MOBILE', value: patientForm.mobile.trim() });
      if (contact.error) { await supabase.from('patients').delete().eq('id', patient.data.id); setPatientMessage(`Unable to save contact. Patient registration was rolled back: ${contact.error.message}`); setRegisteringPatient(false); return; }
    }
    setPatients(current => [patient.data, ...current.filter(item => item.id !== patient.data.id)]); setPatientId(patient.data.id); setPatientForm({ name: '', dob: '', gender: '', bloodGroup: '', mobile: '' }); setPatientMessage(`Patient registered successfully: ${patient.data.niramay_id}`); setShowPatientForm(false); setRegisteringPatient(false);
  };
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
  const noPatients = !search.trim() && !searching && !visiblePatients.length;
  const noSearchMatch = Boolean(search.trim()) && !searching && !visiblePatients.length;
  return <div><div className="page-head"><div><p className="eyebrow">REGISTRATION COUNTER · SUPABASE</p><h1>OPD registration</h1><p>Search authorized patients or register a real patient for {facilityName || 'your facility'}.</p></div><span className="badge">NO DEMO DATA</span></div>{error && <div className="error-panel"><span>{error}</span><button onClick={() => location.reload()}>Retry</button></div>}<section className="panel form-card"><div className="conversation-actions"><button className="button secondary" type="button" onClick={() => { setShowPatientForm(true); setPatientMessage(''); }}>{'Register New Patient'}</button></div><label>Search patient<input value={search} onChange={event => setSearch(event.target.value)} placeholder="Name, Patient Number, mobile or identifier" />{searching && <small>Searching authorized patients…</small>}</label>{noPatients && <div className="empty-panel patient-empty"><h2>No patients registered yet</h2><p>Register the patient at this facility to continue with OPD registration.</p><button className="button" type="button" onClick={() => { setShowPatientForm(true); setPatientMessage(''); }}>Register New Patient</button></div>}{noSearchMatch && <div className="empty-panel patient-empty"><p>No matching patient found.</p><button className="button secondary" type="button" onClick={() => setSearch('')}>Show all patients</button></div>}<label>Patient<select value={patientId} onChange={event => setPatientId(event.target.value)} disabled={searching || !visiblePatients.length}><option value="">{searching ? 'Searching…' : visiblePatients.length ? 'Select patient' : noSearchMatch ? 'No matching patient found' : 'No patients registered yet'}</option>{visiblePatients.map(patient => <option key={patient.id} value={patient.id}>{patient.name} · {patient.niramay_id}</option>)}</select></label><label>Department<select value={departmentId} onChange={event => setDepartmentId(event.target.value)} disabled={!departments.length}><option value="">{departments.length ? 'Select department' : 'No departments available'}</option>{departments.map(department => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label><label>Priority<select value={priority} onChange={event => setPriority(event.target.value)}><option value="ROUTINE">Routine</option><option value="HIGH">High priority</option><option value="EMERGENCY">Emergency</option></select></label><button className="button" onClick={register} disabled={saving || searching || !patientId || !departmentId}>{saving ? 'Registering securely…' : 'Register and generate token'}</button></section>{showPatientForm && <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !registeringPatient) setShowPatientForm(false); }}><div className="patient-modal" role="dialog" aria-modal="true" aria-labelledby="patient-registration-title"><div className="modal-head"><div><p className="eyebrow">PATIENT REGISTRATION · SUPABASE</p><h2 id="patient-registration-title">Register new patient</h2></div><button className="modal-close" type="button" aria-label="Close registration" onClick={() => setShowPatientForm(false)} disabled={registeringPatient}>×</button></div><p className="modal-help">Only basic registration details are required. The patient will be created at {facilityName || 'your authorized facility'}.</p><form className="patient-registration-form" onSubmit={registerPatient}><label>Full name<input value={patientForm.name} onChange={event => setPatientForm(current => ({ ...current, name: event.target.value }))} autoFocus required /></label><label>Date of birth<input type="date" value={patientForm.dob} onChange={event => setPatientForm(current => ({ ...current, dob: event.target.value }))} /></label><label>Gender<select value={patientForm.gender} onChange={event => setPatientForm(current => ({ ...current, gender: event.target.value }))}><option value="">Not recorded</option><option value="FEMALE">Female</option><option value="MALE">Male</option><option value="OTHER">Other</option></select></label><label>Blood group <span className="optional-label">(optional)</span><input value={patientForm.bloodGroup} onChange={event => setPatientForm(current => ({ ...current, bloodGroup: event.target.value }))} placeholder="Example: O+" /></label><label>Mobile/contact <span className="optional-label">(optional)</span><input value={patientForm.mobile} onChange={event => setPatientForm(current => ({ ...current, mobile: event.target.value }))} placeholder="Mobile number" inputMode="tel" /></label>{patientMessage && <div className={patientMessage.startsWith('Patient registered') ? 'success' : 'error-panel'}><span>{patientMessage}</span></div>}<div className="conversation-actions"><button className="button secondary" type="button" onClick={() => setShowPatientForm(false)} disabled={registeringPatient}>Cancel</button><button className="button" disabled={registeringPatient}>{registeringPatient ? 'Saving patient…' : 'Save patient'}</button></div></form></div></div>}</div>;
}
