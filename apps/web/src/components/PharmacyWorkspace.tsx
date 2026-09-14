import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

type Prescription = { id: string; patients?: { name: string; niramay_id: string }; prescription_items?: Array<{ medicine: string; quantity: number }> };

export default function PharmacyWorkspace() {
  const [items, setItems] = useState<Prescription[]>([]);
  const [message, setMessage] = useState('Loading pharmacy queue...');
  const [saving, setSaving] = useState('');
  const load = async () => {
    if (!supabase) return setMessage('Supabase is not configured.');
    const result = await supabase.from('prescriptions').select('id,patients(name,niramay_id),prescription_items(medicine,quantity)').eq('status', 'PENDING').order('created_at');
    if (result.error) setMessage(`Unable to load pharmacy queue: ${result.error.message}`);
    else { setItems(result.data || []); setMessage(result.data?.length ? '' : 'No prescriptions pending'); }
  };
  useEffect(() => { void load(); }, []);
  const dispense = async (id: string) => {
    if (!supabase) return;
    setSaving(id); setMessage('');
    const result = await supabase.rpc('dispense_prescription', { target_prescription_id: id });
    if (result.error) setMessage(`Unable to dispense prescription: ${result.error.message}`);
    else { setMessage('Dispensing saved in Supabase.'); await load(); }
    setSaving('');
  };
  return <div><div className="page-head"><div><p className="eyebrow">PHARMACY WORKFLOW · SUPABASE</p><h1>Dispensing queue</h1><p>Stock is checked before dispensing and the dispensing record is persisted.</p></div><button className="button" onClick={load}>Refresh</button></div>{message && <div className="state">{message}</div>}<section className="panel">{items.map(item => <div className="patient-row" key={item.id}><div><b>{item.patients?.name || 'Patient'}</b><small>{item.patients?.niramay_id || item.id}</small></div><span>{item.prescription_items?.map(line => `${line.medicine} × ${line.quantity}`).join(', ')}</span><button className="button" disabled={saving === item.id} onClick={() => dispense(item.id)}>{saving === item.id ? 'Checking stock...' : 'Dispense'}</button></div>)}</section></div>;
}
