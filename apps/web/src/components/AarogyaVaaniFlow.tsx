import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { DemoOCRProvider, DemoVoiceProvider } from '../providers/demo';

type Step = 'identify' | 'collect' | 'scan' | 'summary' | 'consult';
type Patient = { id: string; name: string; niramay_id: string };

const hindiSymptoms = ['बुखार', 'खांसी', 'सिर दर्द', 'पेट दर्द', 'सांस लेने में परेशानी', 'अन्य'];
const englishSymptoms = ['Fever', 'Cough', 'Headache', 'Stomach pain', 'Breathing difficulty', 'Other'];

export default function AarogyaVaaniFlow() {
  const [step, setStep] = useState<Step>('identify');
  const [language, setLanguage] = useState('hi-IN');
  const [questionIndex, setQuestionIndex] = useState(0);
  const [consent, setConsent] = useState(false);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [answer, setAnswer] = useState('');
  const [voice, setVoice] = useState('');
  const [document, setDocument] = useState<{ name: string; text: string }>();
  const [summary, setSummary] = useState<Record<string, string>>();
  const [message, setMessage] = useState('');
  const [savingHandoff, setSavingHandoff] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientId, setPatientId] = useState('');
  const [patientSearch, setPatientSearch] = useState('');
  const questions = [
    { key: 'duration', hi: 'यह समस्या कब से है?', en: 'Since when have you had this problem?', hiHint: 'उदाहरण: आज से, 3 दिन से या 2 हफ्ते से', enHint: 'Example: today, 3 days, or 2 weeks' },
    { key: 'severity', hi: 'तकलीफ कितनी ज्यादा है?', en: 'How severe is the problem?', hiHint: 'हल्की, मध्यम या बहुत ज्यादा', enHint: 'Mild, moderate, or severe' },
    { key: 'history', hi: 'क्या आपको कोई पुरानी बीमारी है?', en: 'Do you have any previous medical condition?', hiHint: 'जैसे diabetes, BP, asthma या कोई अन्य बीमारी', enHint: 'For example diabetes, blood pressure, asthma, or another condition' },
    { key: 'medicines', hi: 'क्या आप अभी कोई दवा ले रहे हैं?', en: 'Are you currently taking any medicines?', hiHint: 'दवा का नाम बताएं, नहीं तो “नहीं” लिखें', enHint: 'Tell us the medicine name, or type “No”' }
  ];

  useEffect(() => {
    if (!supabase) return;
    void supabase.from('patients').select('id,name,niramay_id').order('name').then(result => {
      if (result.error) setMessage(`Unable to load authorized patients: ${result.error.message}`);
      else setPatients(result.data || []);
    });
  }, []);

  const toggleSymptom = (value: string) => setSelectedSymptoms(current => current.includes(value) ? current.filter(item => item !== value) : [...current, value]);
  const collectNext = () => {
    if (step === 'collect' && !selectedSymptoms.length) return setMessage(english ? 'Please select at least one symptom.' : 'कम से कम एक symptom चुनें।');
    if (step === 'collect' && !answer.trim()) return setMessage(english ? 'Please answer this question before continuing.' : 'कृपया इस सवाल का जवाब दें।');
    const nextAnswers = step === 'collect' ? { ...answers, [questions[questionIndex].key]: answer.trim() } : answers;
    if (step === 'collect') setAnswers(nextAnswers);
    setAnswer('');
    setMessage('');
    if (step === 'identify') return setStep('collect');
    if (step === 'collect' && questionIndex < questions.length - 1) return setQuestionIndex(current => current + 1);
    if (step === 'collect') return setStep('scan');
  };
  const captureVoice = async () => {
    const result = await DemoVoiceProvider.transcribe();
    setVoice(result.transcript);
    setMessage('Voice input captured. कृपया transcript verify करें।');
  };
  const scanDocument = async (file: File) => {
    setMessage('Document securely process हो रहा है…');
    let name = file.name;
    if (supabase) {
      const path = `demo-intake/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`;
      const upload = await supabase.storage.from('medical-documents').upload(path, file, { upsert: false });
      if (upload.error) return setMessage(`Upload नहीं हुआ: ${upload.error.message}`);
      name = path;
    }
    const result = await DemoOCRProvider.extract(file.name);
    setDocument({ name, text: result.fields.clinicalText });
    setMessage('OCR draft तैयार है। यह unverified है और practitioner review जरूरी है।');
  };
  const createSummary = async () => {
    const result = {
      symptoms: selectedSymptoms.join(', '),
      duration: answers.duration || 'Not provided',
      severity: answers.severity || 'Not provided',
      history: answers.history || 'Not provided',
      medicines: answers.medicines || 'Not provided',
      voice: voice || 'Touch input',
      document: document?.text || 'No document uploaded',
      language
    };
    setSummary(result);
    setStep('summary');
  };
  const confirmHandoff = async () => {
    if (!supabase) return setMessage(english ? 'Supabase is not configured.' : 'Supabase configure नहीं है।');
    if (!patientId) return setMessage(english ? 'Select the patient for this intake before confirming handoff.' : 'Handoff confirm करने से पहले patient चुनें।');
    setSavingHandoff(true); setMessage('');
    const session = await supabase.from('intake_sessions').insert({ patient_id: patientId, status: 'COMPLETED', language, completed_at: new Date().toISOString() }).select().single();
    if (session.error) { setMessage(`Unable to save intake session: ${session.error.message}`); setSavingHandoff(false); return; }
    const answerRows = Object.entries(answers).map(([question_key, value]) => ({ session_id: session.data.id, question_key, answer: value, source: 'TOUCH' }));
    answerRows.push({ session_id: session.data.id, question_key: 'symptoms', answer: selectedSymptoms.join(', '), source: 'TOUCH' });
    if (voice) answerRows.push({ session_id: session.data.id, question_key: 'voice_transcript', answer: voice, source: 'VOICE' });
    const answerResult = await supabase.from('intake_answers').insert(answerRows);
    if (answerResult.error) { await supabase.from('intake_sessions').delete().eq('id', session.data.id); setMessage(`Unable to save intake answers. The incomplete session was removed. ${answerResult.error.message}`); setSavingHandoff(false); return; }
    const messageResult = await supabase.from('intake_messages').insert({ session_id: session.data.id, sender: 'PATIENT', message: JSON.stringify({ symptoms: selectedSymptoms, answers, voice: voice || null }) });
    if (messageResult.error) { await supabase.from('intake_sessions').delete().eq('id', session.data.id); setMessage(`Unable to save intake messages. The incomplete session was removed. ${messageResult.error.message}`); setSavingHandoff(false); return; }
    const consentResult = await supabase.from('consents').insert({ patient_id: patientId, purpose: 'AarogyaVaani intake handoff' });
    if (consentResult.error) { await supabase.from('intake_sessions').delete().eq('id', session.data.id); setMessage(`Unable to save consent. The incomplete handoff was removed. ${consentResult.error.message}`); setSavingHandoff(false); return; }
    const summaryResult = await supabase.from('clinical_summaries').insert({ session_id: session.data.id, patient_id: patientId, summary: summary || {} });
    if (summaryResult.error) { await supabase.from('intake_sessions').delete().eq('id', session.data.id); setMessage(`Unable to save clinical summary. The incomplete handoff was removed. ${summaryResult.error.message}`); setSavingHandoff(false); return; }
    setMessage(english ? 'Summary saved securely and shared for practitioner review.' : 'Summary securely save होकर practitioner review के लिए share हो गई।'); setStep('consult'); setSavingHandoff(false);
  };

  const english = language === 'en-IN';
  const activeSymptoms = english ? englishSymptoms : hindiSymptoms;
  const currentQuestion = questions[questionIndex];
  const visiblePatients = patients.filter(patient => {
    const term = patientSearch.trim().toLowerCase();
    return !term || patient.name.toLowerCase().includes(term) || patient.niramay_id.toLowerCase().includes(term);
  });
  return <div className="aarogya-flow">
    <div className="page-head"><div><p className="eyebrow">AAROGYAVAANI · PATIENT CASE-TAKING</p><h1>{english ? 'Prepare your health story before meeting the practitioner' : 'डॉक्टर से पहले अपनी health story तैयार करें'}</h1><p>{english ? 'Answer by touch or voice. AarogyaVaani prepares a draft case sheet; it does not diagnose.' : 'Touch या voice से जवाब दें। AarogyaVaani diagnosis नहीं करता, केवल practitioner के लिए draft case sheet बनाता है।'}</p></div><span className="badge">SIH PROTOTYPE / DEMO</span></div>
    <div className="aarogya-steps">{(english ? [['identify', 'Identify'], ['collect', 'Questions'], ['scan', 'Records'], ['summary', 'Summary'], ['consult', 'Consult']] : [['identify', 'पहचान'], ['collect', 'सवाल'], ['scan', 'पुरानी रिपोर्ट'], ['summary', 'Summary'], ['consult', 'Consult']]).map(([key, label], index) => <span className={step === key ? 'active' : ''} key={key}><b>{index + 1}</b>{label}</span>)}</div>
    <section className="panel aarogya-panel">
      {step === 'identify' && <><h2>{english ? 'Basic details and consent' : 'पहले basic details और consent'}</h2><label className="aarogya-label">{english ? 'Search authorised patient' : 'अधिकृत patient खोजें'}<input value={patientSearch} onChange={event => setPatientSearch(event.target.value)} placeholder={english ? 'Name or patient number' : 'नाम या patient number'} /></label><label className="aarogya-label">Patient<select value={patientId} onChange={event => setPatientId(event.target.value)}><option value="">{visiblePatients.length ? (english ? 'Select authorised patient' : 'Select authorised patient') : (patientSearch ? (english ? 'No authorised patient found' : 'कोई authorised patient नहीं मिला') : (english ? 'No authorised patients available' : 'कोई authorised patient उपलब्ध नहीं है'))}</option>{visiblePatients.map(patient => <option key={patient.id} value={patient.id}>{patient.name} · {patient.niramay_id}</option>)}</select></label><label className="aarogya-label">{english ? 'Language' : 'भाषा'}<select value={language} onChange={event => setLanguage(event.target.value)}><option value="hi-IN">हिन्दी</option><option value="en-IN">English</option><option value="hi-en">हिन्दी + English</option></select></label><label className="consent"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} /> {english ? 'I consent to share the health information I provide with an authorised healthcare professional.' : 'मैं अपनी दी गई health information को authorized healthcare professional के साथ share करने की अनुमति देता/देती हूँ।'}</label>{message && <div className="error-panel"><span>{message}</span></div>}<button className="button" disabled={!consent || !patientId} onClick={collectNext}>{english ? 'Start →' : 'शुरू करें →'}</button></>}
      {step === 'collect' && <><p className="eyebrow">{english ? 'TOUCH-GUIDED QUESTIONS' : 'TOUCH-GUIDED QUESTIONS'}</p><h2>{english ? 'What symptoms are you experiencing?' : 'आपको अभी कौन-कौन सी तकलीफ है?'}</h2><div className="symptom-grid">{activeSymptoms.map(item => <button className={selectedSymptoms.includes(item) ? 'symptom selected' : 'symptom'} key={item} onClick={() => toggleSymptom(item)}>{selectedSymptoms.includes(item) ? '✓ ' : ''}{item}</button>)}</div><p className="assistant-bubble">{english ? currentQuestion.en : currentQuestion.hi}<small>{english ? currentQuestion.enHint : currentQuestion.hiHint}</small></p><textarea className="answer-box" value={answer} onChange={event => setAnswer(event.target.value)} placeholder={english ? 'Type your answer or use voice…' : 'अपना जवाब लिखें या बोलें…'} /><div className="conversation-actions"><button className="voice-button" onClick={captureVoice}>🎙 {english ? 'Speak' : 'बोलकर बताएं'}</button><button className="button" onClick={collectNext}>{questionIndex === questions.length - 1 ? (english ? 'Continue →' : 'आगे बढ़ें →') : (english ? 'Next question →' : 'आगे बढ़ें →')}</button></div>{message && <div className="error-panel"><span>{message}</span></div>}</>}
      {step === 'scan' && <><p className="eyebrow">SCAN OLD RECORDS</p><h2>{english ? 'Add an old prescription or report' : 'पुरानी prescription या report जोड़ें'}</h2><p>{english ? 'OCR creates a text draft only. A practitioner must verify the clinical meaning.' : 'OCR केवल text draft बनाएगा। Final clinical meaning practitioner verify करेगा।'}</p><input type="file" accept="image/*,.pdf" onChange={event => event.target.files?.[0] && scanDocument(event.target.files[0])} />{document && <div className="ocr-box"><small>DEMO OCR · UNVERIFIED</small><b>{document.name}</b><p>{document.text}</p></div>}<div className="conversation-actions"><button className="button" onClick={createSummary}>{english ? 'Create summary →' : 'Summary बनाएं →'}</button><button className="button secondary" onClick={createSummary}>{english ? 'Skip for now' : 'Skip for now'}</button></div></>}
      {step === 'summary' && summary && <><p className="eyebrow">STRUCTURED CASE SHEET · DRAFT</p><h2>{english ? 'Your consultation summary is ready' : 'आपकी consultation summary तैयार है'}</h2><div className="summary-columns">{Object.entries(summary).map(([key, value]) => <div key={key}><b>{key}</b><p>{value}</p></div>)}</div><div className="integration-note"><b>{english ? 'Safety boundary' : 'Safety boundary'}</b><span>{english ? 'This is not a diagnosis or prescription. An authorised practitioner must review and confirm it.' : 'यह diagnosis या prescription नहीं है। Authorized practitioner review और confirmation के बाद ही consultation शुरू होगी।'}</span></div><button className="button" disabled={savingHandoff} onClick={confirmHandoff}>{savingHandoff ? (english ? 'Saving securely…' : 'Securely save हो रहा है…') : (english ? 'Confirm handoff →' : 'Handoff confirm करें →')}</button></>}
      {step === 'consult' && <><p className="eyebrow">CONSULTATION HANDOFF</p><h2>{english ? 'Case sheet is ready for practitioner review' : 'Case sheet practitioner review के लिए तैयार है'}</h2><div className="success">{message || (english ? 'An authorised practitioner will review your summary.' : 'Authorized practitioner आपकी summary review करेगा।')}</div><p>{english ? 'HIS, ABDM and government integrations are DEMO/MOCK in this prototype. No diagnosis is generated automatically.' : 'HIS/ABDM और government integrations इस prototype में DEMO/MOCK हैं। कोई diagnosis अपने-आप नहीं दिया गया है।'}</p><button className="button" onClick={() => setMessage(english ? 'Demo handoff complete. Practitioner review pending.' : 'Demo handoff complete. Practitioner review pending.')}>{english ? 'Confirm handoff' : 'Handoff confirm करें'}</button></>}
    </section>
  </div>;
}
