import { test } from "node:test";
import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import { build } from "esbuild";
import { randomUUID } from "node:crypto";

const compiled = await build({ entryPoints: ["src/utils/atendimento.ts"], bundle: true, write: false, format: "cjs", platform: "browser", define: { 'import.meta.env.VITE_TIKTOK_PIXEL_ID': '"test-pixel"' } });
function browser() {
  const store = new Map(), calls = [], navigations = [], events = [];
  const context = {
    module: { exports: {} }, URL, navigator: {}, crypto: { randomUUID },
    location: { pathname: "/", origin: "https://oncred-captacao.pages.dev", href: "https://oncred-captacao.pages.dev/?ttclid=campaign-test", assign: url => navigations.push(url) },
    sessionStorage: { getItem: key => store.get(key) || null, setItem: (key, value) => store.set(key, value) },
    localStorage: { getItem: key => key === 'oncred_measurement' ? 'yes' : null },
    fetch: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, headers: new Headers({ "Content-Type": "application/json" }), json: async () => url.endsWith("visitor") ? { ready: true } : { phone: "5511999991111", eventId: "test-event", trackContact: true } };
    },
    window: { ttq: { ready: fn => fn(), track: (...args) => events.push(args) }, setTimeout, clearTimeout },
  };
  context.history = { replaceState: (_state, _title, url) => { context.location.href = new URL(url, context.location.origin).href; } };
  runInNewContext(compiled.outputFiles[0].text, context);
  return { api: context.module.exports, store, calls, navigations, events, context };
}

test("simulação passa para /contato sem colocar a mensagem ou valores na URL", async () => {
  const s = browser();
  const message = "Perfil: Pessoa Física\nValor de interesse: R$ 10.000";
  await s.api.goToWhatsApp(message);
  assert.equal(s.calls.length, 0, "a landing não aloca nem conta conversão");
  const target = new URL(s.navigations[0], s.context.location.origin);
  assert.ok(target.pathname === "/contato" || target.pathname === "/atendente");
  assert.equal(target.searchParams.get("ttclid"), "campaign-test");
  assert.match(target.searchParams.get("atendimento"), /^[0-9a-f-]{36}$/);
  assert.equal(target.searchParams.size, 2);
  s.context.location.href = target.href;
  assert.equal(s.api.handoffMessage(), message);
  const [first, duplicate] = await Promise.all([s.api.assignAttendant(), s.api.assignAttendant()]);
  assert.equal(first.href, duplicate.href);
  assert.equal(new URL(first.href).searchParams.get("text"), message);
  assert.equal(s.calls.filter(c => c.url === "/api/route").length, 1);
  assert.equal(JSON.parse(s.calls.find(c => c.url === "/api/route").options.body).handoffId, target.searchParams.get("atendimento"));
  await s.api.trackAttendantEntry(first);
  assert.equal(s.events[0][0], "Lead");
  assert.equal(s.events[0][1].content_name, "entrada_atendente");
});

test("simulação com atendente fixo encaminha para /contato com parâmetro atendente", async () => {
  const s = browser();
  await s.api.goToWhatsApp("Teste específico", "atendimento1");
  const target = new URL(s.navigations[0], s.context.location.origin);
  assert.equal(target.pathname, "/contato");
  assert.equal(target.searchParams.get("atendente"), "atendimento1");
});

test("cada clique cria atendimento novo, mas recarga ou retry conserva a chave", async () => {
  const s = browser();
  await s.api.goToWhatsApp("teste");
  await s.api.goToWhatsApp("teste");
  assert.notEqual(s.navigations[0], s.navigations[1]);
  s.context.location.href = "https://oncred-captacao.pages.dev/atendente";
  const direct = s.api.handoffId();
  assert.equal(s.api.handoffId(), direct);
  assert.equal(new URL(s.context.location.href).searchParams.get("atendimento"), direct);
});

test("entrada direta ou mensagem vencida usa texto genérico sem recuperar simulação antiga", () => {
  const s = browser();
  assert.ok(!s.api.handoffMessage().includes("Valor de interesse"));
  s.store.set("oncred_handoff", JSON.stringify({ message: "simulação antiga", at: Date.now() - 31 * 60000 }));
  assert.ok(!s.api.handoffMessage().includes("simulação antiga"));
});

test("falha de atendimento pode ser tentada novamente sem inventar número", async () => {
  const s = browser();
  const fetch = s.context.fetch;
  let fail = true;
  s.context.fetch = async (url, options) => {
    if (url.endsWith("route") && fail) { fail = false; throw new Error("offline"); }
    return fetch(url, options);
  };
  await assert.rejects(s.api.assignAttendant(), /offline/);
  assert.equal(s.navigations.length, 0);
  const result = await s.api.assignAttendant();
  assert.equal(new URL(result.href).hostname, "wa.me");
});

test("recusar medição mantém o encaminhamento e não emite Lead", async () => {
  const s=browser();
  s.context.localStorage.getItem=()=>"no";
  const result=await s.api.assignAttendant();
  assert.equal(new URL(result.href).hostname,"wa.me");
  assert.equal(JSON.parse(s.calls.find(c=>c.url==="/api/route").options.body).analytics,false);
  await s.api.trackAttendantEntry(result);
  assert.equal(s.events.length,0);
});

test("painel não permite medição mesmo com consentimento anterior", () => {
  const s=browser();s.context.location.pathname="/painel";
  assert.equal(s.api.analyticsAllowed(),false);
});
