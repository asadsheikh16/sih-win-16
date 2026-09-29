import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import QRCode from 'qrcode';
import { supabase } from '../lib/supabase';

type Patient = { id: string; name: string; niramay_id: string; dob: string | null; gender: string | null; blood_group: string | null; facility_id: string };
type PrivateProfile = { address: string | null; city: string | null; state: string | null; pincode: string | null; emergency_contact_name: string | null; emergency_contact_number: string | null; known_allergies: string | null; medical_conditions: string | null; current_medications: string | null };

const fields = [['address', 'Complete address', true], ['city', 'City', true], ['state', 'State', true], ['pincode', 'Pincode', true], ['emergency_contact_name', 'Emergency contact name', false], ['emergency_contact_number', 'Emergency contact number', false], ['known_allergies', 'Known allergies', false], ['medical_conditions', 'Existing medical conditions', false], ['current_medications', 'Current medications', false]] as const;

export default function PatientDashboard() {
  const [patient, setPatient] = useState<Patient>();
  const [privateProfile, setPrivateProfile] = useState<PrivateProfile>();
  const [card, setCard] = useState<{ id: string; secure_ref: string; issue_date: string }>();
  const [caseSummaries, setCaseSummaries] = useState<{ id: string; summary: Record<string, unknown>; verified: boolean; created_at: string }[]>([]);
  const [qr, setQr] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const load = async () => {
    if (!supabase) { setError('Supabase is not configured.'); setLoading(false); return; }
    const owner = await supabase.rpc('patient_id_for_user');
    if (owner.error) { setError(`Patient profile service is not available. Apply migration 0006 first. ${owner.error.message}`); setLoading(false); return; }
    if (!owner.data) { setLoading(false); return; }
    const [patientResult, privateResult, cardResult, casesResult] = await Promise.all([
      supabase.from('patients').select('id,name,niramay_id,dob,gender,blood_group,facility_id').eq('id', owner.data).single(),
      supabase.from('patient_private_profiles').select('*').eq('patient_id', owner.data).maybeSingle(),
      supabase.from('patient_cards').select('id,secure_ref,issue_date').eq('patient_id', owner.data).order('issue_date', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('clinical_summaries').select('id,summary,verified,created_at').eq('patient_id', owner.data).order('created_at', { ascending: false })
    ]);
    if (patientResult.error) setError(patientResult.error.message); else setPatient(patientResult.data);
    if (!privateResult.error) setPrivateProfile(privateResult.data || undefined);
    if (!cardResult.error && cardResult.data) setCard(cardResult.data);
    if (!casesResult.error) setCaseSummaries(casesResult.data || []);
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);
  useEffect(() => { if (card) void QRCode.toDataURL(`${window.location.origin}/verify/${encodeURIComponent(card.secure_ref)}`, { width: 180, margin: 2 }).then(setQr); }, [card]);
  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!supabase) return;
    const form = new FormData(event.currentTarget); setError(''); setMessage('');
    const values = Object.fromEntries(fields.map(([key]) => [key, String(form.get(key) || '').trim() || null]));
    const patientValues = { name: String(form.get('name') || '').trim(), dob: form.get('dob') || null, gender: form.get('gender') || null, blood_group: form.get('blood_group') || null };
    if (patient) {
      const update = await supabase.from('patients').update(patientValues).eq('id', patient.id).eq('owner_user_id', (await supabase.rpc('patient_id_for_user')).data).select().single();
      if (update.error) { setError(update.error.message); return; }
      const privateUpdate = await supabase.from('patient_private_profiles').upsert({ patient_id: patient.id, ...values, updated_at: new Date().toISOString() });
      if (privateUpdate.error) { setError(privateUpdate.error.message); return; }
      setMessage('Your health profile was updated securely.'); setEditing(false); await load(); return;
    }
    const result = await supabase.rpc('create_owned_patient_profile', { full_name: patientValues.name, date_of_birth: patientValues.dob || null, patient_gender: patientValues.gender || null, patient_blood_group: patientValues.blood_group || null, mobile_number: String(form.get('mobile') || '').trim(), patient_address: values.address, patient_city: values.city, patient_state: values.state, patient_pincode: values.pincode, emergency_name: values.emergency_contact_name, emergency_number: values.emergency_contact_number, allergies: values.known_allergies, medical_conditions: values.medical_conditions, current_medications: values.current_medications });
    if (result.error) { setError(result.error.message); return; }
    setPatient(result.data); setPrivateProfile(values as PrivateProfile); setMessage('Health profile created. Your AarogyaVaani ID is ready.'); setEditing(false); await load();
  };
  const issueCard = async () => { if (!supabase || !patient) return; const result = await supabase.from('patient_cards').insert({ patient_id: patient.id, facility_id: patient.facility_id, secure_ref: `AVCARD-${crypto.randomUUID().replaceAll('-', '').slice(0, 20).toUpperCase()}` }).select('id,secure_ref,issue_date').single(); if (result.error) setError(result.error.message); else { setCard(result.data); setMessage('Secure health card created.'); } };
  if (loading) return <div className="state">Loading your patient profile…</div>;
  if (error && !patient) return <div className="error-panel"><span>{error}</span></div>;
  const profile = patient || { name: '', dob: '', gender: '', blood_group: '' } as Patient;
  return <div><div className="page-head"><div><p className="eyebrow">PATIENT DASHBOARD · PRIVATE</p><h1>{patient ? `Welcome, ${patient.name}` : 'Create your Health Profile'}</h1><p>{patient ? 'Your profile and health-card reference are protected by your account.' : 'Create your own profile to receive an AarogyaVaani Patient ID.'}</p></div><span className="badge">OWNER ACCESS ONLY</span></div>{error && <div className="error-panel"><span>{error}</span></div>}{message && <div className="success">{message}</div>}{(!patient || editing) && <form className="panel form-card" onSubmit={save}><h2>{patient ? 'Edit my information' : 'Create your Health Profile'}</h2><label>Full name *<input name="name" required minLength={2} defaultValue={profile.name} /></label><label>Date of birth<input name="dob" type="date" defaultValue={profile.dob || ''} /></label><label>Gender<select name="gender" defaultValue={profile.gender || ''}><option value="">Select</option><option>Female</option><option>Male</option><option>Other</option><option>Prefer not to say</option></select></label><label>Blood group<input name="blood_group" defaultValue={profile.blood_group || ''} /></label><label>Mobile number *<input name="mobile" required pattern="[0-9+ ()-]{8,}" defaultValue="" /></label>{fields.map(([key, label, required]) => <label key={key}>{label} {required ? '*' : '(optional)'}{key === 'address' || key === 'known_allergies' || key === 'medical_conditions' || key === 'current_medications' ? <textarea name={key} required={required} defaultValue={privateProfile?.[key] || ''} /> : <input name={key} required={required} defaultValue={privateProfile?.[key] || ''} />}</label>)}<button className="button">{patient ? 'Save my profile' : 'Create Health Profile'}</button></form>}{patient && !editing && <><section className="panel profile-summary"><h2>My Profile</h2><p><b>AarogyaVaani ID:</b> {patient.niramay_id}</p><p>{patient.gender || 'Gender not recorded'} · {patient.dob || 'Date of birth not recorded'}</p><button className="button secondary" onClick={() => setEditing(true)}>Edit my information</button></section><section className="panel profile-summary"><h2>My Health Card</h2>{qr ? <img className="qr-image-inline" src={qr} alt="Private health-card QR" /> : <p>No card issued yet.</p>}{card ? <p>Secure reference active: {card.secure_ref}</p> : <button className="button" onClick={issueCard}>Create Health Card</button>}<div className="conversation-actions"><Link className="button secondary" to="/patient/intake">Start Case Taking</Link><Link className="button secondary" to="/patient/card">View Card</Link></div></section><section className="panel profile-summary"><h2>My Case Records</h2>{caseSummaries.length ? caseSummaries.map(item => <article className="record-row" key={item.id}><b>Draft case sheet</b><span>{new Date(item.created_at).toLocaleString()}</span><small>{item.verified ? 'Reviewed by healthcare staff' : 'Submitted · Awaiting healthcare staff review'}</small></article>) : <p>No saved case records yet.</p>}</section></>}</div>;
}
