import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

type Patient = { id: string; name: string; niramay_id: string; dob: string | null; gender: string | null; blood_group: string | null };
type CaseSummary = { id: string; session_id: string; summary: Record<string, unknown>; verified: boolean; created_at: string };

const labels: Record<string, string> = {
  symptoms: 'Symptoms', duration: 'Duration', severity: 'Severity', history: 'Previous medical history',
  medicines: 'Current medications', voice: 'Voice input', document: 'Uploaded record notes', language: 'Language'
};

function displayValue(value: unknown) {
  if (Array.isArray(value)) return value.join(', ');
  if (value && typeof value === 'object') return JSON.stringify(value);
  return String(value ?? 'Not provided');
}

export default function CaseIntakeCard() {
  const params = new URLSearchParams(window.location.search);
  const requestedPatientId = params.get('patient');
  const requestedCaseId = params.get('case');
  const [patient, setPatient] = useState<Patient>();
  const [caseSummary, setCaseSummary] = useState<CaseSummary>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      if (!supabase) { setError('Supabase is not configured.'); setLoading(false); return; }
      let patientId = requestedPatientId;
      if (!patientId) {
        const owner = await supabase.rpc('patient_id_for_user');
        if (owner.error) { setError('Your patient profile could not be loaded.'); setLoading(false); return; }
        patientId = owner.data;
      }
      if (!patientId) { setError('No patient profile is linked to this account.'); setLoading(false); return; }
      const patientResult = await supabase.from('patients').select('id,name,niramay_id,dob,gender,blood_group').eq('id', patientId).single();
      if (patientResult.error) { setError('This patient is not available to the current authorized account.'); setLoading(false); return; }
      let summaryQuery = supabase.from('clinical_summaries').select('id,session_id,summary,verified,created_at').eq('patient_id', patientId).order('created_at', { ascending: false }).limit(1);
      if (requestedCaseId) summaryQuery = summaryQuery.eq('id', requestedCaseId);
      const summaryResult = await summaryQuery.maybeSingle();
      if (summaryResult.error) { setError('The case intake card could not be loaded.'); setLoading(false); return; }
      setPatient(patientResult.data); setCaseSummary(summaryResult.data || undefined); setLoading(false);
    };
    void load();
  }, [requestedCaseId, requestedPatientId]);

  if (loading) return <div className="state">Loading case intake card…</div>;
  if (error) return <div className="error-panel"><span>{error}</span><Link className="button secondary" to={requestedPatientId ? '/verify' : '/patient'}>Back</Link></div>;
  if (!patient) return <div className="empty-panel"><h2>Patient not found</h2><p>This record is not available to the current authorized account.</p></div>;
  const age = patient.dob ? Math.max(0, Math.floor((Date.now() - new Date(patient.dob).getTime()) / 31557600000)) : undefined;
  const summaryEntries = Object.entries(caseSummary?.summary || {});
  return <div className="case-card-page">
    <div className="page-head no-print"><div><p className="eyebrow">AAROGYAVAANI · CASE INTAKE CARD</p><h1>Patient case intake</h1><p>Patient-reported information prepared for authorized practitioner review.</p></div><div className="conversation-actions"><span className={caseSummary?.verified ? 'status-badge completed' : 'status-badge waiting'}>{caseSummary?.verified ? 'REVIEWED' : 'PATIENT-REPORTED'}</span><button className="button" onClick={() => window.print()}>Print Case Intake Card</button></div></div>
    <article className="case-intake-card">
      <header className="case-card-header"><div><p className="eyebrow">AAROGYAVAANI · DISTRICT HOSPITAL, KOTA</p><h1>Case Intake Card</h1><p>Pre-consultation information · Not a diagnosis or prescription</p></div><strong>{patient.niramay_id}</strong></header>
      <section className="case-card-section"><h2>Patient details</h2><div className="case-card-grid"><div><b>Patient ID</b><span>{patient.niramay_id}</span></div><div><b>Name</b><span>{patient.name}</span></div><div><b>Age / date of birth</b><span>{age === undefined ? 'Not recorded' : `${age} years`} {patient.dob ? `· ${patient.dob}` : ''}</span></div><div><b>Gender</b><span>{patient.gender || 'Not recorded'}</span></div><div><b>Blood group</b><span>{patient.blood_group || 'Not recorded'}</span></div><div><b>Case reference</b><span>{caseSummary?.id || 'No submitted case'}</span></div><div><b>Case date</b><span>{caseSummary ? new Date(caseSummary.created_at).toLocaleString() : 'No submitted case'}</span></div><div><b>Case status</b><span>{caseSummary?.verified ? 'Reviewed by healthcare staff' : caseSummary ? 'Awaiting healthcare review' : 'No case submitted'}</span></div></div></section>
      <section className="case-card-section"><h2>Patient-reported information</h2>{caseSummary ? <div className="case-card-answers">{summaryEntries.map(([key, value]) => <div key={key}><b>{labels[key] || key}</b><p>{displayValue(value)}</p></div>)}</div> : <p>No completed case intake is available.</p>}</section>
      <section className="case-card-safety"><b>Clinical safety boundary</b><span>This card records what the patient reported. It does not automatically diagnose, prescribe, or replace examination by an authorized healthcare professional.</span></section>
      <footer className="case-card-footer">Generated by AarogyaVaani · Show this card to the authorized practitioner.</footer>
    </article>
    <div className="conversation-actions no-print"><Link className="button secondary" to={requestedPatientId ? '/verify' : '/patient'}>Back</Link>{requestedPatientId && <Link className="button secondary" to={`/consultations?patient=${encodeURIComponent(patient.id)}`}>Open Doctor Review</Link>}</div>
  </div>;
}
