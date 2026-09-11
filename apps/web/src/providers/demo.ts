export type TriageLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'EMERGENCY REVIEW';

export const DemoOCRProvider = {
  async extract(fileName: string) {
    return { provider: 'DEMO OCR', status: 'OCR_EXTRACTED', fields: { documentName: fileName, patientName: 'Human verification required', date: 'Not verified', clinicalText: 'Demo extraction only. Review and verify before saving.' } };
  }
};

export const DemoVoiceProvider = {
  async transcribe() {
    return { provider: 'DEMO VOICE', language: 'Hindi / English', transcript: 'Demo transcript. Please verify symptoms, duration, and medicines with the patient before saving.' };
  }
};

export const DemoAIProvider = {
  assess(input: { symptoms: string; temperature: number; spo2: number }): { level: TriageLevel; indicators: string[] } {
    const indicators = input.spo2 < 92 ? ['SpO₂ below 92%'] : input.temperature >= 103 ? ['High temperature'] : ['No emergency demo indicator detected'];
    const level: TriageLevel = input.spo2 < 90 ? 'EMERGENCY REVIEW' : input.spo2 < 94 || input.temperature >= 103 ? 'HIGH' : input.symptoms.trim().length > 30 ? 'MEDIUM' : 'LOW';
    return { level, indicators };
  }
};
