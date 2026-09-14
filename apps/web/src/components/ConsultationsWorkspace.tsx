import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function ConsultationsWorkspace() {
  const [cases, setCases] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>();
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [history, setHistory] = useState('');
  const [examination, setExamination] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = async () => {
    if (!supabase) { setError('Supabase is not configured. Add your project values in .env.'); setLoading(false); return; }
    setLoading(true);
    const result = await supabase.from('clinical_summaries').select('id,session_id,patient_id,summary,verified,created_at,patients(name,niramay_id),intake_sessions(language,status,completed_at)').order('created_at', { ascending: false });
    if (result.error) { console.error(result.error); setError(`Unable to load consultation cases. Please retry. (${result.error.message})`); }
    else { setCases(result.data || []); setError(''); }
    setLoading(false);
  };
  const saveConsultation = async () => {
    if (!supabase || !selected) return;
    setSaving(true); setError('');
    const userResult = await supabase.auth.getUser();
    if (userResult.error || !userResult.data.user) { setError(`Unable to identify the signed-in doctor. ${userResult.error?.message || 'Please sign in again.'}`); setSaving(false); return; }
    const doctorResult = await supabase.from('doctors').select('id').eq('user_id', userResult.data.user.id).single();
    if (doctorResult.error || !doctorResult.data) { setError(`No doctor profile is linked to this account. ${doctorResult.error?.message || 'Ask an administrator to link the doctor profile.'}`); setSaving(false); return; }
    const consultation = await supabase.from('consultations').insert({ patient_id: selected.patient_id, doctor_id: doctorResult.data.id, chief_complaint: chiefComplaint || null, history: history || null, examination: examination || null, diagnosis: diagnosis || null }).select().single();
    if (consultation.error) { setError(`Unable to save consultation. ${consultation.error.message}`); setSaving(false); return; }
    const summary = await supabase.from('clinical_summaries').update({ verified: true }).eq('id', selected.id).select().single();
    if (summary.error) { setError(`Consultation was saved, but the intake summary could not be marked verified. ${summary.error.message}`); setSaving(false); return; }
    const queue = await supabase.from('queue_tokens').update({ status: 'IN_CONSULTATION', updated_at: new Date().toISOString() }).eq('patient_id', selected.patient_id).in('status', ['WAITING', 'CALLED']).select('id');
    if (queue.error) { setError(`Consultation and verification were saved, but the queue could not advance. ${queue.error.message}`); setSaving(false); return; }
    setSelected(undefined); setChiefComplaint(''); setHistory(''); setExamination(''); setDiagnosis(''); setSaving(false); await load();
  };
  useEffect(() => { load(); }, []);
  return <div><div className="page-head"><div><p className="eyebrow">CLINICAL REVIEW · SUPABASE</p><h1>Consultation cases</h1><p>Patient intake summaries submitted for authorised practitioner review.</p></div><button className="button" onClick={load}>Refresh</button></div>{error && <div className="error-panel"><span>{error}</span><button onClick={load}>Retry</button></div>}{selected && <section className="panel form-card"><h2>Consult {selected.patients?.name || 'patient'}</h2><div className="summary-columns">{Object.entries(selected.summary || {}).map(([key, value]) => <div key={key}><b>{key}</b><p>{String(value)}</p></div>)}</div><label>Chief complaint<textarea value={chiefComplaint} onChange={event => setChiefComplaint(event.target.value)} /></label><label>History<textarea value={history} onChange={event => setHistory(event.target.value)} /></label><label>Examination<textarea value={examination} onChange={event => setExamination(event.target.value)} /></label><label>Diagnosis<textarea value={diagnosis} onChange={event => setDiagnosis(event.target.value)} /></label><div className="conversation-actions"><button className="button" disabled={saving} onClick={saveConsultation}>{saving ? 'Saving consultation…' : 'Save consultation and start queue visit'}</button><button className="button secondary" onClick={() => setSelected(undefined)}>Cancel</button></div></section>}{loading ? <div className="state">Loading consultation cases…</div> : !cases.length ? <div className="empty-panel"><h2>No submitted cases</h2><p>Confirmed patient intake handoffs will appear here.</p></div> : <div className="consultation-list">{cases.map(item => <article className="panel consultation-case" key={item.id}><div className="consultation-case-head"><div><p className="eyebrow">DRAFT CASE SUMMARY</p><h2>{item.patients?.name || 'Patient'}</h2><small>{item.patients?.niramay_id || 'ID unavailable'} · {new Date(item.created_at).toLocaleString()}</small></div><span className={item.verified ? 'status-badge completed' : 'status-badge waiting'}>{item.verified ? 'VERIFIED' : 'PENDING REVIEW'}</span></div><div className="summary-columns">{Object.entries(item.summary || {}).map(([key, value]) => <div key={key}><b>{key}</b><p>{String(value)}</p></div>)}</div><div className="integration-note"><b>Practitioner action</b><span>Review and confirm this draft before clinical decisions. Intake language: {item.intake_sessions?.language || 'not recorded'}.</span></div>{!item.verified && <button className="button" onClick={() => setSelected(item)}>Open consultation</button>}</article>)}</div>}</div>;
}
