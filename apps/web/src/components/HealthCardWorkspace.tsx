import React, { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

type Patient = { id: string; name: string; niramay_id: string; dob: string | null; gender: string | null; blood_group: string | null; facility_id: string };
type Card = { id: string; secure_ref: string; issue_date: string };

export default function HealthCardWorkspace() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientId, setPatientId] = useState('');
  const [card, setCard] = useState<Card>();
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [mobile, setMobile] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const patient = useMemo(() => patients.find(item => item.id === patientId), [patients, patientId]);
  const age = patient?.dob ? Math.max(0, new Date().getFullYear() - new Date(patient.dob).getFullYear()) : undefined;

  const loadPatients = async () => {
    if (!supabase) { setError('Supabase is not configured.'); setLoading(false); return; }
    const result = await supabase.from('patients').select('id,name,niramay_id,dob,gender,blood_group,facility_id').order('name').limit(100);
    if (result.error) setError(`Unable to load authorized patients. ${result.error.message}`);
    else { setPatients(result.data || []); setPatientId(current => current || result.data?.[0]?.id || ''); }
    setLoading(false);
  };
  useEffect(() => { void loadPatients(); }, []);
  useEffect(() => {
    if (!supabase || !patientId) { setCard(undefined); setQrDataUrl(''); return; }
    setError('');
    void Promise.all([
      supabase.from('patient_cards').select('id,secure_ref,issue_date').eq('patient_id', patientId).order('issue_date', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('patient_contacts').select('value').eq('patient_id', patientId).eq('type', 'MOBILE').limit(1).maybeSingle()
    ]).then(([cardResult, contactResult]) => {
      if (cardResult.error) setError(`Unable to load health card. ${cardResult.error.message}`); else setCard(cardResult.data || undefined);
      if (!contactResult.error) setMobile(contactResult.data?.value || '');
    });
  }, [patientId]);
  useEffect(() => {
    if (!card) { setQrDataUrl(''); return; }
    const verificationUrl = `${window.location.origin}/verify/${encodeURIComponent(card.secure_ref)}`;
    void QRCode.toDataURL(verificationUrl, { width: 220, margin: 2, errorCorrectionLevel: 'M' }).then(setQrDataUrl).catch(() => setError('Unable to generate the secure QR code.'));
  }, [card]);

  const updateProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!supabase || !patient) return;
    setSaving(true); setError(''); setSuccess('');
    const form = new FormData(event.currentTarget);
    const update = await supabase.from('patients').update({ name: String(form.get('name') || '').trim(), dob: form.get('dob') || null, gender: form.get('gender') || null, blood_group: form.get('blood_group') || null, updated_at: new Date().toISOString() }).eq('id', patient.id).select('id,name,niramay_id,dob,gender,blood_group,facility_id').single();
    if (update.error) { setError(`Unable to save profile. ${update.error.message}`); setSaving(false); return; }
    if (mobile.trim()) {
      const contact = await supabase.from('patient_contacts').select('id').eq('patient_id', patient.id).eq('type', 'MOBILE').limit(1).maybeSingle();
      const contactResult = contact.data?.id ? await supabase.from('patient_contacts').update({ value: mobile.trim() }).eq('id', contact.data.id) : await supabase.from('patient_contacts').insert({ patient_id: patient.id, type: 'MOBILE', value: mobile.trim() });
      if (contactResult.error) { setError(`Profile saved, but mobile number was not saved. ${contactResult.error.message}`); setSaving(false); return; }
    }
    setPatients(current => current.map(item => item.id === patient.id ? update.data : item)); setEditing(false); setSuccess('Health profile saved securely.'); setSaving(false);
  };
  const issueCard = async () => {
    if (!supabase || !patient) return;
    setSaving(true); setError(''); setSuccess('');
    const result = await supabase.from('patient_cards').insert({ patient_id: patient.id, facility_id: patient.facility_id, secure_ref: `AVCARD-${crypto.randomUUID().replaceAll('-', '').slice(0, 20).toUpperCase()}` }).select('id,secure_ref,issue_date').single();
    if (result.error) setError(`Unable to issue health card. ${result.error.message}`); else { setCard(result.data); setSuccess('Secure digital identity card issued.'); }
    setSaving(false);
  };
  const revokeCard = async () => {
    if (!supabase || !card) return;
    if (!window.confirm('Revoke this health-card QR? The current QR will stop verifying and a new card can be issued later.')) return;
    setSaving(true); setError(''); setSuccess('');
    const result = await supabase.from('patient_cards').delete().eq('id', card.id);
    if (result.error) setError(`Unable to revoke health card. ${result.error.message}`);
    else { setCard(undefined); setQrDataUrl(''); setSuccess('Health-card QR revoked. Issue a new reference when required.'); }
    setSaving(false);
  };
  if (loading) return <div className="state">Loading authorized health cards…</div>;
  return <div>
    <div className="page-head"><div><p className="eyebrow">PATIENT IDENTITY · SUPABASE</p><h1>AarogyaVaani Health Card</h1><p>Manage basic identity details and issue a secure, opaque QR reference.</p></div><span className="badge">NO MEDICAL DATA IN QR</span></div>
    {error && <div className="error-panel"><span>{error}</span></div>}{success && <div className="success card-note">{success}</div>}
    {!patients.length ? <div className="empty-panel"><h2>No authorized patients found</h2><p>Register a real patient before creating a health card.</p><Link className="button" to="/opd/register">Register New Patient</Link></div> : <>
      <section className="panel form-card"><label>Authorized patient<select value={patientId} onChange={event => { setPatientId(event.target.value); setSuccess(''); }}>{patients.map(item => <option key={item.id} value={item.id}>{item.name} · {item.niramay_id}</option>)}</select></label><div className="conversation-actions"><button className="button secondary" onClick={() => setEditing(current => !current)}>{editing ? 'Close profile editor' : 'Create / Update Health Profile'}</button></div></section>
      {editing && patient && <form className="panel form-card" onSubmit={updateProfile}><h2>Create / Update Health Profile</h2><p className="muted">Only basic identity details supported by the current patient record are collected.</p><label>Full name<input name="name" required minLength={2} defaultValue={patient.name} /></label><label>Date of birth<input name="dob" type="date" defaultValue={patient.dob || ''} /></label><label>Gender<select name="gender" defaultValue={patient.gender || ''}><option value="">Not recorded</option><option>Female</option><option>Male</option><option>Other</option><option>Prefer not to say</option></select></label><label>Blood group (optional)<input name="blood_group" defaultValue={patient.blood_group || ''} placeholder="e.g. O+" /></label><label>Mobile number (optional)<input value={mobile} onChange={event => setMobile(event.target.value)} inputMode="tel" /></label><button className="button" disabled={saving}>{saving ? 'Saving securely…' : 'Save health profile'}</button></form>}
      {patient && <section className="medical-card"><div><p className="eyebrow">AAROGYAVAANI HEALTH CARD</p><h2>Secure Digital Health Identity</h2><h3>{patient.name}</h3><p>{age === undefined ? 'Age not recorded' : `Age ${age}`} · {patient.gender || 'Gender not recorded'}</p><p>AarogyaVaani ID · {patient.niramay_id}</p><p>Blood group · {patient.blood_group || 'Not recorded'}</p></div>{qrDataUrl ? <img className="qr-image" src={qrDataUrl} alt="Secure patient verification QR code" /> : <div className="qr-box">QR NOT<br />ISSUED</div>}<footer>Verification QR contains only an opaque reference. Medical history is never stored in the QR.</footer></section>}
      {!card ? <button className="button" onClick={issueCard} disabled={saving}>{saving ? 'Issuing securely…' : 'Issue secure health card reference'}</button> : <div className="panel card-note"><b>Secure card reference active</b><p>{card.secure_ref} · Issued {new Date(card.issue_date).toLocaleString()}</p><div className="conversation-actions"><Link className="button secondary" to={`/verify/${encodeURIComponent(card.secure_ref)}`}>Verify Patient</Link><button className="button secondary" onClick={() => window.print()}>View / Download Health Card</button><button className="button danger" onClick={revokeCard} disabled={saving}>{saving ? 'Revoking…' : 'Revoke QR'}</button></div></div>}
      <div className="conversation-actions"><Link className="button secondary" to={`/patient/intake?patient=${patientId}`}>Start Case Taking</Link><Link className="button secondary" to={`/patients/${patientId}`}>View Patient Profile</Link></div>
    </>}
  </div>;
}
