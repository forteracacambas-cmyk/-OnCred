export const PIXEL_ID = import.meta.env.VITE_TIKTOK_PIXEL_ID || "DBNB4HJC77U6ITB73GS0";
export const isPanel = () => /^\/painel(?:\/|$)/.test(location.pathname);
declare global {
  interface Window {
    ttq?: any;
    TiktokAnalyticsObject?: string;
  }
}
export function analyticsAllowed() {
  try { return !isPanel() && !!PIXEL_ID && localStorage.getItem("oncred_measurement") === "yes"; }
  catch { return false; }
}
export function loadPixel() {
  if (isPanel() || !analyticsAllowed() || window.ttq) return;
  const q: any = [];
  window.TiktokAnalyticsObject = "ttq";
  window.ttq = q;
  const methods = [
    "page",
    "track",
    "identify",
    "instances",
    "debug",
    "on",
    "off",
    "once",
    "ready",
    "alias",
    "group",
    "enableCookie",
    "disableCookie",
    "holdConsent",
    "revokeConsent",
    "grantConsent",
  ];
  const defer = (obj: any, key: string) => {
    obj[key] = (...args: any[]) => obj.push([key, ...args]);
  };
  methods.forEach((m) => defer(q, m));
  q.instance = (id: string) => {
    const x = q._i[id] || [];
    methods.forEach((m) => defer(x, m));
    return x;
  };
  q.load = (id: string, options: any = {}) => {
    const src = "https://analytics.tiktok.com/i18n/pixel/events.js";
    q._i = q._i || {};
    q._i[id] = [];
    q._i[id]._u = src;
    q._t = q._t || {};
    q._t[id] = Date.now();
    q._o = q._o || {};
    q._o[id] = options;
    const script = document.createElement("script");
    script.async = true;
    script.src = src + "?sdkid=" + id + "&lib=ttq";
    document.head.appendChild(script);
  };
  q.load(PIXEL_ID, { autoConfig: false });
  q.page();
}
export function setAnalyticsConsent(value: boolean) {
  try {
    localStorage.setItem("oncred_measurement", value ? "yes" : "no");
  } catch {}
  if (value) {
    loadPixel();
    window.ttq?.grantConsent?.();
  } else window.ttq?.revokeConsent?.();
  window.dispatchEvent(new Event("oncred_consent"));
}
export async function api(
  path: string,
  method = "GET",
  data?: unknown,
  token?: string,
) {
  const res = await fetch("/api/" + path, {
    method,
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      ...(data !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
  });
  if (!res.headers.get("Content-Type")?.includes("application/json"))
    throw new Error("Serviço de atendimento ainda não publicado/configurado.");
  const result = await res.json();
  if (!res.ok)
    throw Object.assign(new Error(result.error || "Não foi possível salvar."), {
      status: res.status,
    });
  return result;
}
let initialization: Promise<any> | undefined;
export function initVisitor() {
  if (!initialization) {
    const run = () => api("visitor");
    initialization = (
      navigator.locks
        ? navigator.locks.request("oncred-visitor-init", run)
        : run()
    ).catch((e) => {
      initialization = undefined;
      throw e;
    });
  }
  return initialization;
}
let routing = false;
export async function goToWhatsApp(message: string, fixedAgent?: string) {
  if (routing) return;
  routing = true;
  try {
    sessionStorage.setItem("oncred_handoff", JSON.stringify({ message, at: Date.now() }));
    if (fixedAgent && !/^[0-9a-f-]{36}$/i.test(fixedAgent.trim())) {
      sessionStorage.setItem("oncred_fixed_agent", fixedAgent.trim());
    } else {
      if (typeof sessionStorage?.removeItem === "function") {
        sessionStorage.removeItem("oncred_fixed_agent");
      } else {
        sessionStorage.setItem("oncred_fixed_agent", "");
      }
    }
    const next = new URL("/contato", location.origin);
    next.searchParams.set("atendimento", crypto.randomUUID());
    if (fixedAgent && !/^[0-9a-f-]{36}$/i.test(fixedAgent.trim())) {
      next.searchParams.set("atendente", fixedAgent.trim());
    }
    const current = new URL(location.href);
    for (const key of ["ttclid", "tt_test_id", "utm_source", "utm_medium", "utm_campaign", "utm_id", "utm_content", "utm_term"]) {
      const value = current.searchParams.get(key);
      if (value) next.searchParams.set(key, value);
    }
    // Preserva atendente caso tenha vindo via query param (nunca atendimento como agente)
    const agentParam = current.searchParams.get("atendente") || current.searchParams.get("agente");
    if (agentParam && !next.searchParams.has("atendente") && !/^[0-9a-f-]{36}$/i.test(agentParam.trim())) {
      next.searchParams.set("atendente", agentParam.trim());
    }
    location.assign(next.pathname + next.search);
  } finally {
    routing = false;
  }
}

export function hasValidRecentHandoff(): boolean {
  try {
    const raw = sessionStorage.getItem("oncred_handoff");
    if (!raw) return false;
    const saved = JSON.parse(raw);
    return !!(
      saved &&
      typeof saved.message === "string" &&
      saved.message.trim().length > 0 &&
      saved.message.length <= 4000 &&
      typeof saved.at === "number" &&
      Date.now() - saved.at >= 0 &&
      Date.now() - saved.at < 30 * 60000
    );
  } catch {
    return false;
  }
}

export function isValidHandoffId(id: string | null | undefined): boolean {
  return typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id.trim());
}

export function handoffMessage() {
  const fallback = "Olá! Vim pelo site da ZM SCD e gostaria de iniciar uma solicitação para análise de crédito.";
  try {
    const saved = JSON.parse(sessionStorage.getItem("oncred_handoff") || "null");
    if (saved && typeof saved.message === "string" && saved.message.length <= 4000 &&
        typeof saved.at === "number" && Date.now() - saved.at >= 0 && Date.now() - saved.at < 30 * 60000) return saved.message;
  } catch {}
  return fallback;
}

export interface AssignmentResult {
  href: string;
  trackContact: boolean;
  eventId: string;
  agentName?: string;
  isDirect?: boolean;
}

let assignment: Promise<AssignmentResult> | undefined;
export function handoffId() {
  const url = new URL(location.href);
  const existing = url.searchParams.get("atendimento");
  if (existing && isValidHandoffId(existing)) return existing.trim();
  const id = crypto.randomUUID();
  url.searchParams.set("atendimento", id);
  history.replaceState(null, "", url.pathname + url.search + url.hash);
  return id;
}

export function getFixedAgent(): string | undefined {
  try {
    const url = new URL(location.href);
    const candidate =
      url.searchParams.get("atendente") ||
      url.searchParams.get("agente") ||
      sessionStorage.getItem("oncred_fixed_agent") ||
      "";
    const trimmed = candidate.trim();
    if (!trimmed) return undefined;
    // Nunca tratar UUID como identificador de atendente
    if (/^[0-9a-f-]{36}$/i.test(trimmed)) return undefined;
    return trimmed;
  } catch {
    return undefined;
  }
}

export function assignAttendant() {
  if (!assignment) assignment = (async (): Promise<AssignmentResult> => {
    const handoff = handoffId();
    const fixedAgent = getFixedAgent();
    let data: any;
    try {
      await initVisitor();
      data = await api("route", "POST", {
        analytics: analyticsAllowed(),
        handoffId: handoff,
        agent: fixedAgent,
      });
    } catch (e: any) {
      // 4) Fallback oncred_local_agents somente em import.meta.env.DEV e sem Lead.
      if (Boolean(import.meta.env?.DEV)) {
        try {
          const localAgentsRaw = localStorage.getItem("oncred_local_agents");
          if (localAgentsRaw) {
            const localAgents = JSON.parse(localAgentsRaw);
            if (Array.isArray(localAgents) && localAgents.length > 0) {
              let selected = localAgents[0];
              if (fixedAgent) {
                const ordinalMatch = fixedAgent.match(/^(?:atendimento|atendente)?([1-9]\d*)$/i);
                const pos = ordinalMatch ? parseInt(ordinalMatch[1], 10) : -1;
                const found = localAgents.find((a: any) =>
                  a.id === fixedAgent ||
                  a.position === pos ||
                  String(a.name).toLowerCase() === fixedAgent.toLowerCase() ||
                  `atendimento${a.position}` === fixedAgent.toLowerCase() ||
                  `atendente${a.position}` === fixedAgent.toLowerCase()
                );
                if (found) selected = found;
              }
              data = {
                phone: selected.phone,
                name: selected.name,
                eventId: crypto.randomUUID(),
                trackContact: false, // Sem Lead no fallback local
                isDirect: !!fixedAgent,
              };
            }
          }
        } catch {}
      }
      if (!data) throw e;
    }

    let phone = String(data.phone || "").replace(/\D/g, "");
    if ((phone.length === 10 || phone.length === 11) && !phone.startsWith("55")) {
      phone = "55" + phone;
    }
    if (!/^55\d{10,11}$/.test(phone))
      throw new Error("Número de atendimento inválido.");
    return {
      href: "https://wa.me/" + phone + "?text=" + encodeURIComponent(handoffMessage()),
      trackContact: data.trackContact === true,
      eventId: data.eventId,
      agentName: data.name || data.agentName,
      isDirect: data.isDirect === true,
    };
  })().catch((error) => { assignment = undefined; throw error; });
  return assignment;
}

export async function trackAttendantEntry(data: { href?: string; trackContact: boolean; eventId: string }) {
  // 5) Garanta Lead apenas pathname /contato, destino válido, analytics autorizado e trackContact da API true, uma vez por atendimento, sem dados financeiros/pessoais.
  const path = typeof location !== "undefined" ? (location.pathname || new URL(location.href).pathname) : "";
  if (!/^\/contato(?:\/|$)/.test(path)) return;
  if (!data.href || !data.href.startsWith("https://wa.me/")) return;
  if (!data.trackContact || !analyticsAllowed()) return;
  if (!data.eventId) return;

  try {
    loadPixel();
    // A fresh routing page must give the asynchronous SDK time to initialize.
    await new Promise<void>((resolve) => {
      const timer = window.setTimeout(resolve, 1500);
      window.ttq?.ready(() => { window.clearTimeout(timer); resolve(); });
    });
    // Disparo oficial do Pixel TikTok ZM SCD (DBNB4HJC77U6ITB73GS0)
    // Apenas evento Lead genérico deduplicado via event_id
    // Sem envio de valor, parcelas, dados pessoais, CPF, telefone ou mensagens
    window.ttq?.track("Lead", { content_name: "entrada_atendente" }, { event_id: data.eventId });
  } catch {}
}
