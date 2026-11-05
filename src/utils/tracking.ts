// Eventos do simulador permanecem locais, sem dados financeiros para publicidade.
export type TrackingEventName =
  | "page_view"
  | "profile_selected"
  | "amount_changed"
  | "loan_amount_changed"
  | "term_changed"
  | "payment_estimate_calculated"
  | "privacy_accepted"
  | "whatsapp_click"
  | "application_started"
  | "simulation_started";
export function trackEvent(
  event: TrackingEventName,
  _payload?: Record<string, unknown>,
) {
  window.dispatchEvent(
    new CustomEvent("oncred_analytics", { detail: { event } }),
  );
}
