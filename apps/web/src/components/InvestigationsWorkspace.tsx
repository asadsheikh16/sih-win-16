import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

type Patient = { id: string; name: string; niramay_id: string };
type Investigation = { id: string; name: string };
type Order = { id: string; status: string; patients?: Patient; investigations?: Investigation; lab_results?: { result: string; unit?: string; verified_at?: string }[] };

export default function InvestigationsWorkspace() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [investigations, setInvestigations] = useState<Investigation[]>([]);
  const [patientId, setPatientId] = useState('');
  const [investigationId, setInvestigationId] = useState('');
  const [resultText, setResultText] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('Loading investigations...');
  const [saving, setSaving] = useState(false);
  const load = async () => {
    if (!supabase) return setMessage('Supabase is not configured.');
    const result = await supabase.from('investigation_orders').select('id,status,patients(id,name,niramay_id),investigations(id,name),lab_results(result,unit,verified_at)').order('created_at', { ascending: false });
    if (result.error) setMessage(`Unable to load investigations: ${result.error.message}`);
    else { setOrders(result.data || []); setMessage(result.data?.length ? '' : 'No investigations found'); }
  };
  useEffect(() => {
    if (!supabase) return;
    void Promise.all([load(), supabase.from('patients').select('id,name,niramay_id').order('name'), supabase.from('investigations').select('id,name').order('name')]).then(([, patientsResult, investigationsResult]) => {
      if (patientsResult.error || investigationsResult.error) setMessage(`Unable to load investigation choices: ${(patientsResult.error || investigationsResult.error)?.message}`);
      else { setPatients(patientsResult.data || []); setInvestigations(investigationsResult.data || []); setPatientId(patientsResult.data?.[0]?.id || ''); setInvestigationId(investigationsResult.data?.[0]?.id || ''); }
    });
  }, []);
  const createOrder = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase || !patientId || !investigationId) return setMessage('Select an authorized patient and investigation.');
    setSaving(true); setMessage('');
    const result = await supabase.from('investigation_orders').insert({ patient_id: patientId, investigation_id: investigationId, status: 'REQUESTED' }).select().single();
    if (result.error) setMessage(`Unable to save investigation order: ${result.error.message}`); else { setMessage('Investigation order saved in Supabase.'); await load(); }
    setSaving(false);
  };
  const saveResult = async (orderId: string) => {
    if (!supabase || !resultText[orderId]?.trim()) return setMessage('Enter the real lab result before saving.');
    setSaving(true); setMessage('');
    const result = await supabase.from('lab_results').insert({ order_id: orderId, result: resultText[orderId].trim(), verified_at: new Date().toISOString() }).select().single();
    if (result.error) setMessage(`Unable to save lab result: ${result.error.message}`);
    else { const status = await supabase.from('investigation_orders').update({ status: 'VERIFIED' }).eq('id', orderId); if (status.error) setMessage(`Lab result was saved, but order verification failed: ${status.error.message}`); else { setMessage('Lab result saved and verified in Supabase.'); await load(); } }
    setSaving(false);
  };
  return <div><div className="page-head"><div><p className="eyebrow">LABORATORY SERVICES · SUPABASE</p><h1>Investigations</h1><p>Orders and results below are read from and written to the connected database.</p></div><button className="button" onClick={load}>Refresh</button></div><form className="panel form-card" onSubmit={createOrder}><h2>Request investigation</h2><label>Patient<select value={patientId} onChange={event => setPatientId(event.target.value)}><option value="">Select authorized patient</option>{patients.map(patient => <option key={patient.id} value={patient.id}>{patient.name} · {patient.niramay_id}</option>)}</select></label><label>Investigation<select value={investigationId} onChange={event => setInvestigationId(event.target.value)}><option value="">Select investigation</option>{investigations.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><button className="button" disabled={saving}>Save order</button></form>{message && <div className="state">{message}</div>}<section className="panel">{orders.map(order => <div className="patient-row" key={order.id}><div><b>{order.investigations?.name || 'Investigation'}</b><small>{order.patients?.name || 'Patient'}</small></div><span className="badge">{order.status}</span><span>{order.lab_results?.[0]?.result || 'Awaiting result'}</span>{!order.lab_results?.length && <><input value={resultText[order.id] || ''} onChange={event => setResultText(current => ({ ...current, [order.id]: event.target.value }))} placeholder="Enter verified result" /><button className="button" disabled={saving} onClick={() => saveResult(order.id)}>Save result</button></>}</div>)}</section></div>;
}
