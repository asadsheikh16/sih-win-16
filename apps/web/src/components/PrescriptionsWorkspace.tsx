import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

type Patient = { id: string; name: string; niramay_id: string };
type Prescription = { id: string; status: string; patients?: Patient; prescription_items?: Array<{ id: string; medicine: string; dose: string; frequency: string; duration: string }> };

export default function PrescriptionsWorkspace() {
  const [items, setItems] = useState<Prescription[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientId, setPatientId] = useState('');
  const [medicine, setMedicine] = useState('');
  const [dose, setDose] = useState('');
  const [frequency, setFrequency] = useState('');
  const [duration, setDuration] = useState('');
  const [message, setMessage] = useState('Loading prescriptions...');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!supabase) return setMessage('Supabase is not configured.');
    const result = await supabase.from('prescriptions').select('id,status,patients(id,name,niramay_id),prescription_items(id,medicine,dose,frequency,duration)').order('created_at', { ascending: false });
    if (result.error) setMessage(`Unable to load prescriptions: ${result.error.message}`);
    else { setItems(result.data || []); setMessage(result.data?.length ? '' : 'No prescriptions found'); }
  };
  useEffect(() => {
    if (!supabase) return;
    void Promise.all([load(), supabase.from('patients').select('id,name,niramay_id').order('name')]).then(([, patientsResult]) => {
      if (patientsResult.error) setMessage(`Unable to load authorized patients: ${patientsResult.error.message}`);
      else { setPatients(patientsResult.data || []); setPatientId(patientsResult.data?.[0]?.id || ''); }
    });
  }, []);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase || !patientId || !medicine.trim() || !dose.trim() || !frequency.trim() || !duration.trim()) { setMessage('Select a patient and complete every medicine field.'); return; }
    setSaving(true); setMessage('');
    const user = await supabase.auth.getUser();
    if (user.error || !user.data.user) { setMessage(`Unable to identify the signed-in doctor: ${user.error?.message || 'Please sign in again.'}`); setSaving(false); return; }
    const doctor = await supabase.from('doctors').select('id').eq('user_id', user.data.user.id).single();
    if (doctor.error || !doctor.data) { setMessage(`No doctor profile is linked to this account: ${doctor.error?.message || 'contact an administrator.'}`); setSaving(false); return; }
    const prescription = await supabase.from('prescriptions').insert({ patient_id: patientId, doctor_id: doctor.data.id }).select('id').single();
    if (prescription.error) { setMessage(`Unable to save prescription: ${prescription.error.message}`); setSaving(false); return; }
    const line = await supabase.from('prescription_items').insert({ prescription_id: prescription.data.id, medicine: medicine.trim(), dose: dose.trim(), frequency: frequency.trim(), duration: duration.trim() });
    if (line.error) { await supabase.from('prescriptions').delete().eq('id', prescription.data.id); setMessage(`Unable to save prescription item. The incomplete prescription was removed. ${line.error.message}`); setSaving(false); return; }
    setMedicine(''); setDose(''); setFrequency(''); setDuration(''); setMessage('Prescription saved in Supabase.'); setSaving(false); await load();
  };

  return <div><div className="page-head"><div><p className="eyebrow">DIGITAL PARCHA · SUPABASE</p><h1>Prescriptions</h1><p>Only prescriptions returned by the connected database are shown.</p></div><button className="button" onClick={load}>Refresh</button></div><form className="panel form-card" onSubmit={save}><h2>Save prescription</h2><label>Patient<select value={patientId} onChange={event => setPatientId(event.target.value)}><option value="">Select authorized patient</option>{patients.map(patient => <option key={patient.id} value={patient.id}>{patient.name} · {patient.niramay_id}</option>)}</select></label><label>Medicine<input value={medicine} onChange={event => setMedicine(event.target.value)} required /></label><label>Dose<input value={dose} onChange={event => setDose(event.target.value)} required /></label><label>Frequency<input value={frequency} onChange={event => setFrequency(event.target.value)} required /></label><label>Duration<input value={duration} onChange={event => setDuration(event.target.value)} required /></label><button className="button" disabled={saving}>{saving ? 'Saving prescription...' : 'Save prescription'}</button></form>{message && <div className="state">{message}</div>}<section className="panel">{items.map(item => <div className="patient-row" key={item.id}><div><b>{item.patients?.name || 'Patient'}</b><small>{item.id}</small></div><span>{item.prescription_items?.map(line => `${line.medicine} ${line.dose}`).join(', ')}</span><span className="badge">{item.status}</span></div>)}</section></div>;
}
