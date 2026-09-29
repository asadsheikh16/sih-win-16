import React, { useEffect, useRef, useState } from 'react';
import { BrowserQRCodeReader, IScannerControls } from '@zxing/browser';

type Props = { onDetected: (value: string) => void; onClose: () => void };

function secureReference(rawValue: string) {
  try {
    const url = new URL(rawValue, window.location.origin);
    if (url.pathname.startsWith('/verify/')) return decodeURIComponent(url.pathname.split('/').pop() || '');
  } catch { /* QR may contain a plain opaque reference. */ }
  return rawValue.trim().startsWith('AVCARD-') ? rawValue.trim() : '';
}

export default function QrCameraScanner({ onDetected, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | undefined>(undefined);
  const deliveredRef = useRef(false);
  const [camera, setCamera] = useState<'environment' | 'user'>('environment');
  const [starting, setStarting] = useState(true);
  const [error, setError] = useState('');

  const stop = () => { controlsRef.current?.stop(); controlsRef.current = undefined; };
  const start = async () => {
    stop(); setStarting(true); setError(''); deliveredRef.current = false;
    if (!navigator.mediaDevices?.getUserMedia) { setError('Camera access is not available in this browser. Use manual verification below.'); setStarting(false); return; }
    try {
      const reader = new BrowserQRCodeReader();
      const controls = await reader.decodeFromConstraints({ video: { facingMode: { ideal: camera }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }, videoRef.current!, (result) => {
        if (!result || deliveredRef.current) return;
        const reference = secureReference(result.getText());
        if (!reference) { setError('This QR is not an AarogyaVaani patient reference. Try the patient QR again.'); return; }
        deliveredRef.current = true; stop(); onDetected(reference);
      });
      controlsRef.current = controls; setStarting(false);
    } catch (cameraError) {
      setStarting(false);
      const message = cameraError instanceof DOMException && cameraError.name === 'NotAllowedError' ? 'Camera permission was denied. Allow camera access or use manual verification below.' : 'Camera could not be opened. Check that it is available and not being used by another app.';
      setError(message);
    }
  };
  useEffect(() => { void start(); return stop; }, [camera]);
  return <section className="qr-scanner panel" aria-live="polite"><div className="qr-scanner-head"><div><p className="eyebrow">SECURE CAMERA SCAN</p><h2>Scan patient QR</h2></div><button className="modal-close" type="button" onClick={() => { stop(); onClose(); }} aria-label="Close camera scanner">×</button></div><div className="qr-video-wrap"><video ref={videoRef} muted playsInline aria-label="Camera preview for QR scanning" />{starting && <span className="qr-scanner-status">Starting camera…</span>}<span className="qr-scan-frame" aria-hidden="true" /></div>{error && <div className="error-panel"><span>{error}</span></div>}<div className="conversation-actions"><button className="button secondary" type="button" onClick={() => setCamera(value => value === 'environment' ? 'user' : 'environment')} disabled={starting}>{camera === 'environment' ? 'Use front camera' : 'Use back camera'}</button><button className="button secondary" type="button" onClick={() => { stop(); onClose(); }}>Use manual verification</button></div><p className="muted">Only the opaque AarogyaVaani reference is read. Patient details are loaded afterward through authenticated facility authorization.</p></section>;
}
