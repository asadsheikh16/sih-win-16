import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import QrCameraScanner from './QrCameraScanner';

type VerifiedPatient = { id: string; name: string; niramay_id: string; dob: string | null; gender: string | null; blood_group: string | null };
type CaseSummary = { id: string; verified: boolean; created_at: string };

export default function VerifyPatient() {
  const routeToken = window.location.pathname.startsWith('/verify/') ? decodeURIComponent(window.location.pathname.split('/').pop() || '') : '';
  const [reference, setReference] = useState(routeToken);
  const [patient, setPatient] = useState<VerifiedPatient>();
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'verified' | 'not-found' | 'error'>('idle');
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);
  const verify = async (event?: React.FormEvent, scannedReference?: string) => {
    event?.preventDefault();
    const lookupReference = scannedReference?.trim() || reference.trim();
    if (!supabase || !lookupReference) { setStatus('error'); setError('Enter or scan a secure patient reference.'); return; }
    setStatus('loading'); setError(''); setPatient(undefined); setCases([]);
    const card = await supabase.from('patient_cards').select('secure_ref,issue_date,patients!inner(id,name,niramay_id,dob,gender,blood_group)').eq('secure_ref', lookupReference).maybeSingle();
    if (card.error) { setStatus('error'); setError('The patient reference could not be verified for this account.'); return; }
    if (!card.data?.patients) { setStatus('not-found'); return; }
    const verifiedPatient = card.data.patients as VerifiedPatient;
    const summaries = await supabase.from('clinical_summaries').select('id,verified,created_at').eq('patient_id', verifiedPatient.id).order('created_at', { ascending: false });
    if (summaries.error) { setStatus('error'); setError('Identity verified, but the authorized case record could not be loaded.'); return; }
    setPatient(verifiedPatient); setCases(summaries.data || []); setStatus('verified');
  };
  useEffect(() => { if (routeToken) void verify(); }, [routeToken]);
  if (status === 'idle') return <div><div className="page-head"><div><p className="eyebrow">HOSPITAL WORKSPACE · AUTHORIZED LOOKUP</p><h1>Scan / Verify Patient</h1><p>Scan the patient QR to open this page, or enter the opaque reference printed below the QR.</p></div><span className="badge">STAFF AUTHORIZATION REQUIRED</span></div>{scanning ? <QrCameraScanner onClose={() => setScanning(false)} onDetected={value => { setReference(value); setScanning(false); void verify(undefined, value); }} /> : <section className="panel form-card"><button className="button" type="button" onClick={() => setScanning(true)}>Open camera scanner</button><form onSubmit={verify}><label>Secure patient reference<input value={reference} onChange={event => setReference(event.target.value)} placeholder="AVCARD-..." autoFocus /></label><button className="button secondary">Verify patient</button></form><p className="muted">A QR scan only supplies a secure reference. Patient data is returned only after this authenticated account passes facility RLS.</p></section>}</div>;
  if (status === 'loading') return <div className="state">Verifying secure patient reference…</div>;
  if (status === 'error') return <div className="error-panel"><span>{error}</span><Link className="button secondary" to="/verify">Try again</Link></div>;
  if (status === 'not-found') return <div className="empty-panel"><h2>Patient reference not available</h2><p>This QR is invalid, revoked, or outside your authorized facility.</p><Link className="button" to="/verify">Scan another patient</Link></div>;
  const age = patient?.dob ? Math.max(0, new Date().getFullYear() - new Date(patient.dob).getFullYear()) : undefined;
  return <div><div className="page-head"><div><p className="eyebrow">HOSPITAL WORKSPACE · VERIFIED PATIENT</p><h1>{patient?.name}</h1><p>Patient ID · {patient?.niramay_id} · Identity verified for this authorized facility.</p></div><span className="badge">VERIFIED</span></div><section className="panel verified-card"><h2>Authorized patient identity</h2><p>{age === undefined ? 'Age not recorded' : `Age ${age}`} · {patient?.gender || 'Gender not recorded'} · Blood group {patient?.blood_group || 'Not recorded'}</p><div className="integration-note"><b>Privacy boundary</b><span>Address, phone, emergency contact, prescriptions and unrelated records are not shown in this lookup.</span></div></section><section className="panel verified-card"><div className="consultation-case-head"><div><p className="eyebrow">PATIENT-REPORTED INFORMATION</p><h2>Available case intake</h2></div><span className="status-badge waiting">{cases.length ? `${cases.length} record${cases.length === 1 ? '' : 's'}` : 'No records'}</span></div>{cases.length ? cases.map(item => <article className="record-row" key={item.id}><b>Case intake card</b><span>{new Date(item.created_at).toLocaleString()}</span><small>{item.verified ? 'Reviewed by healthcare staff' : 'Submitted · Awaiting healthcare staff review'}</small><Link className="button secondary no-print" to={`/patient/case-card?patient=${encodeURIComponent(patient?.id || '')}&case=${encodeURIComponent(item.id)}`}>Open Case Intake Card</Link></article>) : <p>No submitted case intake is available to this authorized account.</p>}</section><div className="conversation-actions no-print"><Link className="button secondary" to="/verify">Scan another patient</Link><Link className="button" to={`/consultations?patient=${encodeURIComponent(patient?.id || '')}`}>Open Doctor Review</Link></div></div>;
}
