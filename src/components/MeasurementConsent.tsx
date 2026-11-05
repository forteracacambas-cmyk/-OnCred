import { useEffect } from 'react';
import { setAnalyticsConsent, loadPixel } from '../utils/atendimento';

/**
 * Consentimento automático para medição e cookies técnicos
 * Conforme solicitado: ativa automaticamente na entrada sem exibir banner invasivo.
 */
export function MeasurementConsent() {
  useEffect(() => {
    try {
      if (localStorage.getItem('oncred_measurement') !== 'no') {
        setAnalyticsConsent(true);
      }
      loadPixel();
    } catch {
      loadPixel();
    }
  }, []);

  return null;
}
