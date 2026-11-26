import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";
import { Miniflare } from "miniflare";
const source = await build({
  stdin: {
    contents: `import {onRequest} from './functions/api/[[path]].js';export default {fetch(request,env){return onRequest({request,env});}};`,
    resolveDir: process.cwd(),
  },
  bundle: true,
  write: false,
  format: "esm",
  platform: "browser",
});
const schema = (
  (await readFile("migrations/0001_atendimento.sql", "utf8")) +
  "\n" +
  (await readFile("migrations/0002_equipes.sql", "utf8")) +
  "\n" +
  (await readFile("migrations/0003_multi_equipe_phone.sql", "utf8")) +
  "\n" +
  (await readFile("migrations/0004_team_sync_mode.sql", "utf8")) +
  "\n" +
  (await readFile("migrations/0005_equalize_distribution.sql", "utf8"))
).replace(/--[^\n]*/g, "");
const legacySchema = (
  await readFile("migrations/0001_atendimento.sql", "utf8")
).replace(/--[^\n]*/g, "");

test("cookie de visitante fica isolado no host, inclusive no domínio gratuito", async (t) => {
  const { mf } = await setup(t);
  for (const domain of ["oncred.com.br", "oncred-captacao.pages.dev"]) {
    for (const host of [domain, `www.${domain}`]) {
      const res = await mf.dispatchFetch(`https://${host}/api/visitor`);
      assert.equal(res.status, 200);
      const cookie = res.headers.get("Set-Cookie");
      assert.ok(!cookie.includes('; Domain='));
      assert.ok(cookie.includes('; Secure'));
      assert.ok(cookie.includes("; HttpOnly; SameSite=Lax;"));
    }
  }
  const preview = await mf.dispatchFetch("https://santscredito.pages.dev/api/visitor");
  assert.equal(preview.status, 200);
  assert.ok(!preview.headers.get("Set-Cookie").includes("; Domain="));
});
function statements(text) {
  const result = [];
  let buffer = "";
  for (const c of text) {
    buffer += c;
    if (
      c === ";" &&
      (!/^\s*CREATE TRIGGER/i.test(buffer) || /END;\s*$/i.test(buffer))
    ) {
      result.push(buffer.trim());
      buffer = "";
    }
  }
  return result;
}
async function setup(t, initialSql = schema) {
  const mf = new Miniflare({
    workers: [
      {
        name: "test",
        modules: true,
        script: source.outputFiles[0].text,
        compatibilityDate: "2026-08-01",
        d1Databases: ["DB"],
        bindings: { ADMIN_PASSWORD: "test-only-password" },
      },
    ],
  });
  t.after(() => mf.dispose());
  const db = await mf.getD1Database("DB");
  for (const s of statements(initialSql)) {
    if (s) await db.prepare(s).run();
  }
  const call = async (
    path,
    {
      method = "GET",
      body,
      cookie,
      token,
      origin = "http://localhost",
      ip = "127.0.0.1",
    } = {},
  ) => {
    const res = await mf.dispatchFetch("http://localhost/api/" + path, {
      method,
      headers: {
        Origin: origin,
        "CF-Connecting-IP": ip,
        ...(cookie ? { Cookie: cookie } : {}),
        ...(token ? { Authorization: "Bearer " + token } : {}),
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    return {
      status: res.status,
      data: await res.json(),
      cookie: res.headers.get("Set-Cookie")?.split(";")[0],
    };
  };
  const login = await call("login", {
    method: "POST",
    body: { password: "test-only-password" },
  });
  assert.equal(login.status, 200);
  const token = login.data.token;
  const admin = (path, method = "GET", body) =>
    call("admin/" + path, { method, body, token });
  const visitor = async () => {
    const r = await call("visitor");
    assert.equal(r.status, 200);
    assert.match(r.cookie, /oncred_visitor=/);
    return r.cookie;
  };
  const route = (cookie, analytics = true) =>
    call("route", { method: "POST", body: { analytics }, cookie });
  const add = async (name, phone) => {
    const r = await admin("agents", "POST", { name, phone });
    assert.equal(r.status, 200);
    return (await admin("config")).data.agents.find((a) => a.name === name);
  };
  return { mf, db, call, admin, visitor, route, add, token };
}
test("login protegido, origem, senha, sessão, formato e normalização de telefone", async (t) => {
  const s = await setup(t);
  assert.equal((await s.call("admin/config")).status, 401);
  assert.equal(
    (await s.call("login", { method: "POST", body: { password: "wrong" } }))
      .status,
    401,
  );
  assert.equal(
    (
      await s.call("login", {
        method: "POST",
        body: { password: "test-only-password" },
        origin: "https://evil.example",
      })
    ).status,
    403,
  );
  const a = await s.add("Ana", "(11) 99999-1111");
  assert.equal(a.phone, "5511999991111");
  assert.equal(
    (await s.admin("agents", "POST", { name: "Outro", phone: a.phone })).status,
    409,
  );
  // Testa número com 8 dígitos e DDD 31 fornecido com 55 (ex: 553190915057)
  const c = await s.add("Carlos", "553190915057");
  assert.equal(c.phone, "553190915057");
  // Testa número com 8 dígitos e DDD 11 sem 55 (ex: 1187654321)
  const d = await s.add("Fernanda", "1187654321");
  assert.equal(d.phone, "551187654321");
  // Testa número com 9 dígitos e zero à esquerda no DDD (ex: 011987654321)
  const e = await s.add("Gabriel", "011987654321");
  assert.equal(e.phone, "5511987654321");
  assert.equal(
    (await s.admin("agents", "POST", { name: "Ruim", phone: "123" })).status,
    400,
  );
  assert.equal((await s.admin("config", "PUT", { batchSize: 0 })).status, 400);
  await s.admin("logout", "POST", {});
  assert.equal((await s.admin("config")).status, 401);
});
for (const batchSize of [1, 5, 10])
  test(`lote ${batchSize}, concorrência, afinidade e conversão única`, async (t) => {
    const s = await setup(t);
    const a = await s.add("Ana", "11999991111"),
      b = await s.add("Bia", "11999992222");
    await s.admin("config", "PUT", { batchSize });
    // Sequential arrivals prove exact order, not merely balanced totals.
    for (let i = 0; i < batchSize * 4; i++) {
      const c = await s.visitor();
      const r = await s.route(c);
      assert.equal(r.status, 200);
      assert.equal(
        r.data.phone,
        Math.floor(i / batchSize) % 2 === 0 ? a.phone : b.phone,
      );
      const duplicate = await s.route(c);
      assert.equal(duplicate.data.phone, r.data.phone);
      assert.equal(duplicate.data.trackContact, false);
    }
    const c = await s.visitor();
    const concurrent = await Promise.all(
      Array.from({ length: 20 }, () => s.route(c)),
    );
    assert.ok(concurrent.every((r) => r.status === 200));
    assert.equal(new Set(concurrent.map((r) => r.data.phone)).size, 1);
    assert.equal(concurrent.filter((r) => r.data.trackContact).length, 1);
    const total = await s.db.prepare("SELECT COUNT(*) n FROM visitors").first();
    assert.equal(total.n, batchSize * 4 + 1);
    const routes = await s.db
      .prepare("SELECT COUNT(*) n FROM deliveries")
      .first();
    assert.equal(routes.n, total.n);
    const cookies = await Promise.all(
      Array.from({ length: 40 }, () => s.visitor()),
    );
    const results = await Promise.all(cookies.map((c) => s.route(c)));
    assert.ok(results.every((r) => r.status === 200));
    const counts = await s.db
      .prepare("SELECT agent_id,COUNT(*) n FROM deliveries GROUP BY agent_id")
      .all();
    assert.ok(Math.abs(counts.results[0].n - counts.results[1].n) <= batchSize);
    assert.equal(
      (await s.db.prepare("SELECT COUNT(*) n FROM route_requests").first()).n,
      0,
    );
  });
test("pausa, exclusão lógica, reatribuição sem duplicar cliente, edição e lista vazia", async (t) => {
  const s = await setup(t);
  const empty = await s.visitor();
  assert.equal((await s.route(empty)).status, 503);
  assert.equal(
    (await s.db.prepare("SELECT COUNT(*) n FROM visitors").first()).n,
    0,
  );
  const a = await s.add("Ana", "11999991111"),
    b = await s.add("Bia", "11999992222");
  const c = await s.visitor();
  assert.equal((await s.route(c)).data.phone, a.phone);
  await s.admin("agents/" + a.id, "PUT", { ...a, active: false });
  const re = await s.route(c);
  assert.equal(re.data.phone, b.phone);
  assert.equal(re.data.trackContact, false);
  assert.equal(
    (await s.db.prepare("SELECT COUNT(*) n FROM visitors").first()).n,
    1,
  );
  assert.equal(
    (await s.db.prepare("SELECT COUNT(*) n FROM deliveries").first()).n,
    2,
  );
  await s.admin("agents/" + b.id, "PUT", {
    ...b,
    active: true,
    phone: "11999993333",
    name: "Bia editada",
  });
  assert.equal((await s.route(c)).data.phone, "5511999993333");
  await s.admin("agents/" + b.id, "DELETE");
  assert.equal((await s.route(c)).status, 503);
  const stats = (await s.admin("stats?period=total")).data;
  assert.equal(stats.totals.total, 1);
  assert.equal(stats.agents.find((x) => x.id === b.id).deliveries, 1);
});
test("mesmo navegador alterna por clique e deduplica recarga e requisições simultâneas", async (t) => {
  const s = await setup(t);
  const a = await s.add("Ana", "11999991111"), b = await s.add("Bia", "11999992222");
  const cookie = await s.visitor();
  const route = (handoffId) => s.call("route", { method: "POST", cookie, body: { analytics: true, handoffId } });
  const firstId = crypto.randomUUID(), secondId = crypto.randomUUID();
  const duplicate = await Promise.all(Array.from({ length: 10 }, () => route(firstId)));
  assert.ok(duplicate.every(r => r.status === 200 && r.data.phone === a.phone));
  assert.equal(duplicate.filter(r => r.data.trackContact).length, 1);
  const second = await route(secondId);
  assert.equal(second.data.phone, b.phone);
  assert.equal(second.data.trackContact, true);
  assert.notEqual(second.data.eventId, duplicate[0].data.eventId);
  assert.equal((await route(secondId)).data.trackContact, false);
  assert.equal((await route(crypto.randomUUID())).data.phone, a.phone);
  assert.equal((await s.db.prepare("SELECT COUNT(*) n FROM deliveries").first()).n, 3);
  assert.equal((await route("invalid")).status, 400);
});

test("filtros de data de São Paulo, consentimento tardio e rate limit", async (t) => {
  const s = await setup(t);
  await s.add("Ana", "11999991111");
  const c = await s.visitor();
  assert.equal((await s.route(c, false)).data.trackContact, false);
  assert.equal((await s.route(c, true)).data.trackContact, true);
  assert.equal((await s.route(c, true)).data.trackContact, false);
  const { rangeStart } = await import("../functions/api/[[path]].js");
  assert.equal(
    new Date(rangeStart(1, Date.parse("2026-10-22T02:30:00Z"))).toISOString(),
    "2026-10-21T03:00:00.000Z",
  );
  assert.equal(
    new Date(rangeStart(7, Date.parse("2026-10-22T18:00:00Z"))).toISOString(),
    "2026-10-16T03:00:00.000Z",
  );
  const now = Date.now(),
    today = rangeStart(1, now);
  await s.db
    .prepare("UPDATE visitors SET created_at=?")
    .bind(today - 1)
    .run();
  const stats = (await s.admin("stats")).data;
  assert.equal(stats.totals.today, 0);
  assert.equal(stats.totals.yesterday, 1);
  assert.equal(stats.totals["7"], 1);
  for (let i = 0; i < 10; i++)
    assert.equal(
      (
        await s.call("login", {
          method: "POST",
          body: { password: "wrong" },
          ip: "other-ip",
        })
      ).status,
      401,
    );
  assert.equal(
    (
      await s.call("login", {
        method: "POST",
        body: { password: "test-only-password" },
        ip: "other-ip",
      })
    ).status,
    429,
  );
});

test("limpar histórico zera todos os registros, visitantes, encaminhamentos e contadores no painel", async (t) => {
  const s = await setup(t);
  const a = await s.add("Carlos", "11999994444");
  const c1 = await s.visitor();
  await s.route(c1);
  const c2 = await s.visitor();
  await s.route(c2);

  let stats = (await s.admin("stats?period=total")).data;
  assert.equal(stats.totals.total, 2);
  assert.equal(stats.agents.find((x) => x.id === a.id).deliveries, 2);

  const clearRes = await s.admin("clear-history", "POST", {});
  assert.equal(clearRes.status, 200);
  assert.equal(clearRes.data.ok, true);

  stats = (await s.admin("stats?period=total")).data;
  assert.equal(stats.totals.total, 0);
  assert.equal(stats.totals.today, 0);
  assert.equal(stats.agents.find((x) => x.id === a.id).deliveries, 0);
  assert.equal(stats.agents.find((x) => x.id === a.id).new_clients, 0);
  assert.equal((await s.db.prepare("SELECT COUNT(*) n FROM visitors").first()).n, 0);
  assert.equal((await s.db.prepare("SELECT COUNT(*) n FROM deliveries").first()).n, 0);
});

test("rota direta por atendente (/atendimento1) direciona exclusivamente para aquele número sem afetar rodízio", async (t) => {
  const s = await setup(t);
  const a1 = await s.add("Atendente Um", "11999991111");
  const a2 = await s.add("Atendente Dois", "11999992222");

  const v1 = await s.visitor();
  const res1 = await s.call("route", {
    method: "POST",
    body: { analytics: true, handoffId: "11111111-1111-1111-1111-111111111111", agent: "atendimento2" },
    cookie: v1,
  });
  assert.equal(res1.status, 200);
  assert.equal(res1.data.phone, a2.phone);
  assert.equal(res1.data.isDirect, true);

  // O rodízio geral não foi afetado pela rota direta
  const v2 = await s.visitor();
  const res2 = await s.route(v2);
  assert.equal(res2.data.phone, a1.phone);
});

test("rota direta recusa atendente inativo com 409 e inexistente/excluído com 404 sem cair no rodízio", async (t) => {
  const s = await setup(t);
  const a1 = await s.add("Atendente Ativo", "11999991111");
  const a2 = await s.add("Atendente Inativo", "11999992222");
  await s.admin("agents/" + a2.id, "PUT", { ...a2, active: false });

  const v1 = await s.visitor();
  // Atendente inativo -> 409
  const resInactive = await s.call("route", {
    method: "POST",
    body: { analytics: true, handoffId: "22222222-2222-2222-2222-222222222222", agent: "atendimento2" },
    cookie: v1,
  });
  assert.equal(resInactive.status, 409);
  assert.equal(resInactive.data.error, "Atendente temporariamente indisponível.");

  // Atendente inexistente -> 404
  const resNotFound = await s.call("route", {
    method: "POST",
    body: { analytics: true, handoffId: "33333333-3333-3333-3333-333333333333", agent: "atendimento99" },
    cookie: v1,
  });
  assert.equal(resNotFound.status, 404);
  assert.equal(resNotFound.data.error, "Atendente não encontrado.");

  // O rodízio geral continua intacto apontando para a1
  const v3 = await s.visitor();
  const resNormal = await s.route(v3);
  assert.equal(resNormal.status, 200);
  assert.equal(resNormal.data.phone, a1.phone);
});

test("retentativas na rota específica retornam o eventId persistido original e trackContact false", async (t) => {
  const s = await setup(t);
  const a1 = await s.add("Atendente Um", "11999991111");

  const v = await s.visitor();
  const handoffId = "44444444-4444-4444-4444-444444444444";
  const first = await s.call("route", {
    method: "POST",
    body: { analytics: true, handoffId, agent: "atendimento1" },
    cookie: v,
  });
  assert.equal(first.status, 200);
  assert.equal(first.data.trackContact, true);
  const originalEventId = first.data.eventId;
  assert.ok(originalEventId);

  // Retentativa com mesmo handoffId (recarregou /contato ou clicou em tentar novamente)
  const retry = await s.call("route", {
    method: "POST",
    body: { analytics: true, handoffId, agent: "atendimento1" },
    cookie: v,
  });
  assert.equal(retry.status, 200);
  assert.equal(retry.data.eventId, originalEventId, "eventId deve ser o persistido original");
  assert.equal(retry.data.trackContact, false, "trackContact deve ser false em retry");
});

test("equipes isolam o rodízio por URL (/equipe1, /equipe2) mantendo o site principal separado", async (t) => {
  const s = await setup(t);
  const g1 = await s.add("Geral 1", "11999990001");
  const g2 = await s.add("Geral 2", "11999990002");
  const e1a = await s.add("Equipe 1 A", "11999991001");
  const e1b = await s.add("Equipe 1 B", "11999991002");
  const e2a = await s.add("Equipe 2 A", "11999992001");

  // Cria equipe1 e equipe2
  const t1Res = await s.admin("teams", "POST", { name: "Equipe 1", slug: "equipe1", batchSize: 1 });
  assert.equal(t1Res.status, 200);
  const t1 = t1Res.data.team;

  const t2Res = await s.admin("teams", "POST", { name: "Equipe 2", slug: "equipe2", batchSize: 2 });
  assert.equal(t2Res.status, 200);
  const t2 = t2Res.data.team;

  // Slugs reservados e duplicados devem ser recusados
  assert.equal((await s.admin("teams", "POST", { name: "Painel", slug: "painel" })).status, 400);
  assert.equal((await s.admin("teams", "POST", { name: "Atend", slug: "atendimento1" })).status, 400);
  assert.equal((await s.admin("teams", "POST", { name: "Duplicada", slug: "equipe1" })).status, 409);

  // Move (simula arrastar) os atendentes para as equipes
  assert.equal((await s.admin("agents/move", "POST", { agentId: e1a.id, teamId: t1.id })).status, 200);
  assert.equal((await s.admin("agents/move", "POST", { agentId: e1b.id, teamId: t1.id })).status, 200);
  assert.equal((await s.admin("agents/move", "POST", { agentId: e2a.id, teamId: t2.id })).status, 200);

  // Site principal gira apenas entre Geral 1 e Geral 2
  const vG1 = await s.visitor();
  const vG2 = await s.visitor();
  const vG3 = await s.visitor();
  assert.equal((await s.route(vG1)).data.phone, g1.phone);
  assert.equal((await s.route(vG2)).data.phone, g2.phone);
  assert.equal((await s.route(vG3)).data.phone, g1.phone);

  // Equipe 1 gira apenas entre Equipe 1 A e Equipe 1 B
  const routeTeam = async (teamSlug) => {
    const c = await s.visitor();
    return s.call("route", {
      method: "POST",
      cookie: c,
      body: { analytics: true, handoffId: crypto.randomUUID(), team: teamSlug },
    });
  };
  const r1 = await routeTeam("equipe1");
  const r2 = await routeTeam("equipe1");
  const r3 = await routeTeam("equipe1");
  assert.equal(r1.status, 200);
  assert.equal(r1.data.phone, e1a.phone);
  assert.equal(r1.data.teamName, "Equipe 1");
  assert.equal(r1.data.isTeam, true);
  assert.equal(r2.data.phone, e1b.phone);
  assert.equal(r3.data.phone, e1a.phone);

  // Equipe 2 vai apenas para e2a
  const r4 = await routeTeam("equipe2");
  assert.equal(r4.status, 200);
  assert.equal(r4.data.phone, e2a.phone);

  // Equipe pausada -> 409; equipe inexistente -> 404
  await s.admin("teams/" + t2.id, "PUT", { name: t2.name, slug: t2.slug, batchSize: t2.batch_size, active: false });
  assert.equal((await routeTeam("equipe2")).status, 409);
  assert.equal((await routeTeam("equipe-inexistente")).status, 404);

  // Excluir equipe devolve seus atendentes ao Site Principal
  await s.admin("teams/" + t2.id, "DELETE");
  const cfg = (await s.admin("config")).data;
  const movedBack = cfg.agents.find((a) => a.id === e2a.id);
  assert.equal(movedBack.team_id, null);
});

test("banco legado (apenas 0001) é atualizado automaticamente para suportar equipes", async (t) => {
  const s = await setup(t, legacySchema);
  const a1 = await s.add("Legado 1", "11999998888");
  const t1 = await s.admin("teams", "POST", { name: "Equipe Auto", slug: "auto" });
  assert.equal(t1.status, 200);
  await s.admin("agents/move", "POST", { agentId: a1.id, teamId: t1.data.team.id });

  const c = await s.visitor();
  const r = await s.call("route", {
    method: "POST",
    cookie: c,
    body: { analytics: true, handoffId: crypto.randomUUID(), team: "auto" },
  });
  assert.equal(r.status, 200);
  assert.equal(r.data.phone, a1.phone);
});

test("POST /api/admin/save publica alterações em lote e GET /api/team reflete status online", async (t) => {
  const s = await setup(t);

  // Antes de criar equipe2, /api/team retorna 404
  const notFound = await s.call("team?slug=equipe2");
  assert.equal(notFound.status, 404);
  assert.equal(notFound.data.online, false);

  // Salva tudo de uma vez (equipe2 temporária + atendente temporário + ajuste de lote)
  const saveRes = await s.admin("save", "POST", {
    batchSize: 3,
    teams: [
      { id: "temp-team-2", name: "Equipe 2", slug: "equipe2", batch_size: 2, active: true },
      { id: "temp-team-3", name: "Equipe Vazia", slug: "equipe3", batch_size: 1, active: true },
    ],
    agents: [
      { id: "temp-agent-1", name: "Atendente E2", phone: "11988887777", active: true, team_id: "temp-team-2" },
      { id: "temp-agent-2", name: "Atendente Geral", phone: "11988886666", active: true, team_id: null },
    ],
  });
  assert.equal(saveRes.status, 200);
  assert.equal(saveRes.data.ok, true);
  assert.equal(saveRes.data.batchSize, 3);
  assert.equal(saveRes.data.teams.length, 2);
  assert.equal(saveRes.data.agents.length, 2);

  // /api/team?slug=equipe2 deve estar online com 1 atendente
  const e2Status = await s.call("team?slug=equipe2");
  assert.equal(e2Status.status, 200);
  assert.equal(e2Status.data.online, true);
  assert.equal(e2Status.data.agentCount, 1);

  // /api/team?slug=equipe3 existe mas está sem atendentes (online: false)
  const e3Status = await s.call("team?slug=equipe3");
  assert.equal(e3Status.status, 200);
  assert.equal(e3Status.data.exists, true);
  assert.equal(e3Status.data.online, false);
  assert.equal(e3Status.data.agentCount, 0);

  // Roteamento para equipe2 funciona imediatamente
  const v = await s.visitor();
  const routeRes = await s.call("route", {
    method: "POST",
    cookie: v,
    body: { analytics: true, handoffId: crypto.randomUUID(), team: "equipe2" },
  });
  assert.equal(routeRes.status, 200);
  assert.equal(routeRes.data.phone, "5511988887777");
  assert.equal(routeRes.data.teamName, "Equipe 2");

  // Troca de telefones entre dois atendentes no mesmo Save + pausa da equipe2
  const savedE2 = saveRes.data.teams.find((x) => x.slug === "equipe2");
  const savedA1 = saveRes.data.agents.find((x) => x.name === "Atendente E2");
  const savedA2 = saveRes.data.agents.find((x) => x.name === "Atendente Geral");
  const swapSave = await s.admin("save", "POST", {
    batchSize: 1,
    teams: [{ ...savedE2, active: false }],
    agents: [
      { ...savedA1, phone: savedA2.phone, active: true },
      { ...savedA2, phone: savedA1.phone, active: true },
    ],
  });
  assert.equal(swapSave.status, 200);
  const pausedStatus = await s.call("team?slug=equipe2");
  assert.equal(pausedStatus.data.active, false);
  assert.equal(pausedStatus.data.online, false);
});

test("ensureSchema repara banco em estado parcial (tabela teams existe mas faltam colunas/triggers)", async (t) => {
  const partialSql =
    legacySchema +
    "\nCREATE TABLE IF NOT EXISTS teams (id TEXT PRIMARY KEY, slug TEXT NOT NULL, name TEXT NOT NULL, batch_size INTEGER NOT NULL DEFAULT 1, cursor_agent TEXT, used INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, deleted INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL DEFAULT 0);";
  const s = await setup(t, partialSql);
  const res = await s.admin("save", "POST", {
    batchSize: 1,
    teams: [{ id: "temp-t1", name: "Equipe Reparo", slug: "reparo", batch_size: 1, active: true }],
    agents: [{ id: "temp-a1", name: "Reparo 1", phone: "11977776666", active: true, team_id: "temp-t1" }],
  });
  assert.equal(res.status, 200);
  const c = await s.visitor();
  const r = await s.call("route", {
    method: "POST",
    cookie: c,
    body: { analytics: true, handoffId: crypto.randomUUID(), team: "reparo" },
  });
  assert.equal(r.status, 200);
  assert.equal(r.data.phone, "5511977776666");
});

test("reordenar posições dos atendentes por equipe e no site principal via /api/admin/save altera a ordem de atendimento", async (t) => {
  const s = await setup(t);

  const initialSave = await s.admin("save", "POST", {
    batchSize: 1,
    teams: [{ id: "temp-t1", name: "Firma 1", slug: "firma1", batch_size: 1, active: true }],
    agents: [
      { id: "temp-g1", name: "Geral 1", phone: "11911110001", position: 1, active: true, team_id: null },
      { id: "temp-g2", name: "Geral 2", phone: "11911110002", position: 2, active: true, team_id: null },
      { id: "temp-f1", name: "Firma A", phone: "11922220001", position: 3, active: true, team_id: "temp-t1" },
      { id: "temp-f2", name: "Firma B", phone: "11922220002", position: 4, active: true, team_id: "temp-t1" },
      { id: "temp-f3", name: "Firma C", phone: "11922220003", position: 5, active: true, team_id: "temp-t1" },
    ],
  });
  assert.equal(initialSave.status, 200);

  const team = initialSave.data.teams[0];
  const byName = (name) => initialSave.data.agents.find((a) => a.name === name);

  const routeTeam = async (teamSlug) => {
    const c = await s.visitor();
    return s.call("route", {
      method: "POST",
      cookie: c,
      body: { analytics: true, handoffId: crypto.randomUUID(), ...(teamSlug ? { team: teamSlug } : {}) },
    });
  };

  // Ordem inicial: Firma A -> Firma B
  assert.equal((await routeTeam("firma1")).data.name, "Firma A");
  assert.equal((await routeTeam("firma1")).data.name, "Firma B");

  // Reordena dentro da Firma 1 (C -> 1º, A -> 2º, B -> 3º) e inverte Geral (Geral 2 -> 1º, Geral 1 -> 2º)
  const reorderSave = await s.admin("save", "POST", {
    batchSize: 1,
    teams: [{ id: team.id, name: team.name, slug: team.slug, batch_size: 1, active: true }],
    agents: [
      { ...byName("Geral 2"), position: 1, active: true },
      { ...byName("Geral 1"), position: 2, active: true },
      { ...byName("Firma C"), position: 3, active: true },
      { ...byName("Firma A"), position: 4, active: true },
      { ...byName("Firma B"), position: 5, active: true },
    ],
  });
  assert.equal(reorderSave.status, 200);

  // Confirma persistência no /api/admin/config
  const cfg = (await s.admin("config")).data;
  const firmaAgents = cfg.agents.filter((a) => a.team_id === team.id).map((a) => a.name);
  assert.deepEqual(firmaAgents, ["Firma C", "Firma A", "Firma B"]);

  // Próximos clientes na Firma 1 devem seguir a nova ordem exata (C -> A -> B)
  assert.equal((await routeTeam("firma1")).data.name, "Firma C");
  assert.equal((await routeTeam("firma1")).data.name, "Firma A");
  assert.equal((await routeTeam("firma1")).data.name, "Firma B");

  // Próximos clientes no Site Principal devem seguir a nova ordem exata (Geral 2 -> Geral 1)
  assert.equal((await routeTeam(null)).data.name, "Geral 2");
  assert.equal((await routeTeam(null)).data.name, "Geral 1");
});

test("mesmo número de WhatsApp em até 2+ links (Site Principal e equipe duplicada) com ordens independentes", async (t) => {
  const s = await setup(t);

  // Salva os mesmos 2 telefones no Site Principal (Ana -> Bia) e em Equipe Duplicada (/equipe2 com Bia -> Ana)
  const saveRes = await s.admin("save", "POST", {
    batchSize: 1,
    teams: [{ id: "temp-t2", name: "Equipe 2", slug: "equipe2", batch_size: 1, active: true }],
    agents: [
      { id: "temp-p1", name: "Ana", phone: "11999991111", position: 1, active: true, team_id: null },
      { id: "temp-p2", name: "Bia", phone: "11999992222", position: 2, active: true, team_id: null },
      { id: "temp-e1", name: "Bia", phone: "11999992222", position: 3, active: true, team_id: "temp-t2" },
      { id: "temp-e2", name: "Ana", phone: "11999991111", position: 4, active: true, team_id: "temp-t2" },
    ],
  });
  assert.equal(saveRes.status, 200);
  assert.equal(saveRes.data.agents.length, 4);

  // Telefone duplicado dentro da MESMA equipe continua bloqueado (409)
  const dupSameTeam = await s.admin("save", "POST", {
    batchSize: 1,
    teams: saveRes.data.teams,
    agents: [
      ...saveRes.data.agents,
      { id: "temp-dup", name: "Ana Repetida", phone: "11999991111", active: true, team_id: null },
    ],
  });
  assert.equal(dupSameTeam.status, 409);

  const routeScope = async (teamSlug) => {
    const c = await s.visitor();
    return s.call("route", {
      method: "POST",
      cookie: c,
      body: { analytics: true, handoffId: crypto.randomUUID(), ...(teamSlug ? { team: teamSlug } : {}) },
    });
  };

  // Site principal gira Ana -> Bia -> Ana
  assert.equal((await routeScope(null)).data.phone, "5511999991111");
  assert.equal((await routeScope(null)).data.phone, "5511999992222");
  assert.equal((await routeScope(null)).data.phone, "5511999991111");

  // Equipe 2 gira na ordem invertida: Bia -> Ana -> Bia
  assert.equal((await routeScope("equipe2")).data.phone, "5511999992222");
  assert.equal((await routeScope("equipe2")).data.phone, "5511999991111");
  assert.equal((await routeScope("equipe2")).data.phone, "5511999992222");

  // Pausar Ana apenas em Equipe 2 mantém Ana ativa no Site Principal
  const e2 = saveRes.data.teams[0];
  const anaE2 = saveRes.data.agents.find((a) => a.team_id === e2.id && a.name === "Ana");
  await s.admin("agents/" + anaE2.id, "PUT", { ...anaE2, active: false });
  assert.equal((await routeScope("equipe2")).data.phone, "5511999992222");
  assert.equal((await routeScope("equipe2")).data.phone, "5511999992222");

  // Excluir Equipe 2 remove a cópia sem colidir com o Site Principal
  const delRes = await s.admin("teams/" + e2.id, "DELETE");
  assert.equal(delRes.status, 200);
  const cfg = (await s.admin("config")).data;
  assert.equal(cfg.agents.filter((a) => !a.team_id).length, 2);
});

test("banco legado (apenas 0001) migra índice de telefone por equipe automaticamente", async (t) => {
  const s = await setup(t, legacySchema);
  const a1 = await s.add("Ana", "11999991111");
  const saveRes = await s.admin("save", "POST", {
    batchSize: 1,
    teams: [{ id: "temp-e", name: "Setor 2", slug: "setor2", batch_size: 1, active: true }],
    agents: [
      { ...a1, team_id: null, active: true },
      { id: "temp-copy", name: "Ana Setor 2", phone: "11999991111", active: true, team_id: "temp-e" },
    ],
  });
  assert.equal(saveRes.status, 200);
  assert.equal(saveRes.data.agents.length, 2);
});

test("equipe espelhada de trás pra frente (general_reverse) acompanha adições, edições e pausas do Site Principal automaticamente", async (t) => {
  const s = await setup(t);

  const init = await s.admin("save", "POST", {
    batchSize: 1,
    teams: [
      { id: "temp-e3", name: "Equipe 3", slug: "equipe3", batch_size: 1, active: true, sync_mode: "general_reverse" },
    ],
    agents: [
      { id: "temp-a", name: "Ana", phone: "11911110001", position: 1, active: true, team_id: null },
      { id: "temp-b", name: "Bia", phone: "11911110002", position: 2, active: true, team_id: null },
      { id: "temp-c", name: "Carlos", phone: "11911110003", position: 3, active: true, team_id: null },
    ],
  });
  assert.equal(init.status, 200);

  // /api/team?slug=equipe3 já enxerga os 3 atendentes do Site Principal
  const info3 = await s.call("team?slug=equipe3");
  assert.equal(info3.status, 200);
  assert.equal(info3.data.online, true);
  assert.equal(info3.data.agentCount, 3);
  assert.equal(info3.data.syncMode, "general_reverse");

  const routeScope = async (teamSlug, handoffId = crypto.randomUUID()) => {
    const c = await s.visitor();
    return {
      cookie: c,
      handoffId,
      res: await s.call("route", {
        method: "POST",
        cookie: c,
        body: { analytics: true, handoffId, ...(teamSlug ? { team: teamSlug } : {}) },
      }),
    };
  };

  // Site Principal vai na ordem normal: Ana -> Bia -> Carlos
  assert.equal((await routeScope(null)).res.data.name, "Ana");
  assert.equal((await routeScope(null)).res.data.name, "Bia");

  // Equipe 3 vai de trás pra frente: Carlos -> Bia -> Ana -> Carlos
  const firstE3 = await routeScope("equipe3");
  assert.equal(firstE3.res.data.name, "Carlos");
  assert.equal(firstE3.res.data.trackContact, true);

  // Retentativa / reload com mesmo handoffId mantém Carlos e não avança cursor nem dispara novo Lead
  const retryE3 = await s.call("route", {
    method: "POST",
    cookie: firstE3.cookie,
    body: { analytics: true, handoffId: firstE3.handoffId, team: "equipe3" },
  });
  assert.equal(retryE3.status, 200);
  assert.equal(retryE3.data.name, "Carlos");
  assert.equal(retryE3.data.trackContact, false);

  assert.equal((await routeScope("equipe3")).res.data.name, "Bia");
  assert.equal((await routeScope("equipe3")).res.data.name, "Ana");
  assert.equal((await routeScope("equipe3")).res.data.name, "Carlos");

  // Entra um novo número ("Daniel") apenas no Site Principal -> entra automaticamente como 1º em Equipe 3!
  const addDaniel = await s.admin("save", "POST", {
    batchSize: 1,
    teams: init.data.teams,
    agents: [
      ...init.data.agents,
      { id: "temp-d", name: "Daniel", phone: "11911110004", position: 4, active: true, team_id: null },
    ],
  });
  assert.equal(addDaniel.status, 200);
  assert.equal((await s.call("team?slug=equipe3")).data.agentCount, 4);
  assert.equal((await routeScope("equipe3")).res.data.name, "Daniel");

  // Pausar "Carlos" no Site Principal -> pausa automaticamente em Equipe 3 também (pula Carlos -> Bia)!
  const danielPausado = addDaniel.data.agents.map((a) =>
    a.name === "Carlos" ? { ...a, active: false } : a,
  );
  const pauseRes = await s.admin("save", "POST", {
    batchSize: 1,
    teams: addDaniel.data.teams,
    agents: danielPausado,
  });
  assert.equal(pauseRes.status, 200);
  assert.equal((await s.call("team?slug=equipe3")).data.agentCount, 3);
  assert.equal((await routeScope("equipe3")).res.data.name, "Daniel");
  assert.equal((await routeScope("equipe3")).res.data.name, "Bia");
  assert.equal((await routeScope("equipe3")).res.data.name, "Ana");
});

test("banco existente (0001+0002+0003) com equipe3 já criada migra automaticamente para general_reverse via ensureSchema", async (t) => {
  const preSyncSchema = (
    (await readFile("migrations/0001_atendimento.sql", "utf8")) +
    "\n" +
    (await readFile("migrations/0002_equipes.sql", "utf8")) +
    "\n" +
    (await readFile("migrations/0003_multi_equipe_phone.sql", "utf8")) +
    "\n" +
    "INSERT INTO agents(id,name,phone,position,active,deleted,team_id) VALUES('pre-a1','Primero','5511988880001',1,1,0,NULL);\n" +
    "INSERT INTO agents(id,name,phone,position,active,deleted,team_id) VALUES('pre-a2','Ultimo','5511988880002',2,1,0,NULL);\n" +
    "INSERT INTO teams(id,slug,name,batch_size,active,deleted,created_at) VALUES('pre-t3','equipe3','Equipe 3',1,1,0,1002);\n"
  ).replace(/--[^\n]*/g, "");
  const s = await setup(t, preSyncSchema);

  // Primeira chamada em /api/team?slug=equipe3 dispara ensureSchema e configura equipe3 como general_reverse
  const teamInfo = await s.call("team?slug=equipe3");
  assert.equal(teamInfo.status, 200);
  assert.equal(teamInfo.data.online, true);
  assert.equal(teamInfo.data.agentCount, 2);
  assert.equal(teamInfo.data.syncMode, "general_reverse");

  const c = await s.visitor();
  const r = await s.call("route", {
    method: "POST",
    cookie: c,
    body: { analytics: true, handoffId: crypto.randomUUID(), team: "equipe3" },
  });
  assert.equal(r.status, 200);
  assert.equal(r.data.name, "Ultimo");
});

test("equalização preenche atendente ativado/adicionado com menos fichas hoje até igualar e depois retoma a ordem", async (t) => {
  const s = await setup(t);
  const a = await s.add("Ana", "11999990001");
  const b = await s.add("Bia", "11999990002");

  // Ana e Bia recebem 10 fichas cada uma hoje
  for (let i = 0; i < 20; i++) {
    const c = await s.visitor();
    const r = await s.route(c);
    assert.equal(r.status, 200);
    assert.equal(r.data.name, i % 2 === 0 ? "Ana" : "Bia");
  }

  // Admin adiciona/ativa Carlos agora (com 0 fichas hoje)
  const carlos = await s.add("Carlos", "11999990003");
  assert.ok(carlos.id);

  // Próximas 10 fichas preenchem Carlos primeiro até ficar igual (10 = 10 = 10)
  for (let i = 0; i < 10; i++) {
    const c = await s.visitor();
    const r = await s.route(c);
    assert.equal(r.status, 200);
    assert.equal(r.data.name, "Carlos");
  }

  // Agora todos estão iguais com 10 -> retoma a ordem normal Ana -> Bia -> Carlos
  const nextOrder = [];
  for (let i = 0; i < 3; i++) {
    const c = await s.visitor();
    nextOrder.push((await s.route(c)).data.name);
  }
  assert.deepEqual(nextOrder, ["Ana", "Bia", "Carlos"]);

  // Pausa Bia com 11 fichas enquanto Ana e Carlos chegam em 14, depois reativa Bia
  await s.admin("agents/" + b.id, "PUT", { ...b, active: false });
  for (let i = 0; i < 6; i++) {
    const c = await s.visitor();
    await s.route(c);
  }
  await s.admin("agents/" + b.id, "PUT", { ...b, active: true });

  // Bia está com 11 e Ana/Carlos com 14 -> próximas 3 fichas preenchem Bia até 14
  for (let i = 0; i < 3; i++) {
    const c = await s.visitor();
    assert.equal((await s.route(c)).data.name, "Bia");
  }

  // Estatísticas confirmam todos exatamente empatados em 14 fichas hoje
  const stats = (await s.admin("stats?period=today")).data;
  assert.equal(stats.agents.find((x) => x.id === a.id).deliveries, 14);
  assert.equal(stats.agents.find((x) => x.id === b.id).deliveries, 14);
  assert.equal(stats.agents.find((x) => x.id === carlos.id).deliveries, 14);
});

test("sistema unificado entre Site Principal (cima pra baixo) e Equipe 3 (baixo pra cima) equaliza fichas", async (t) => {
  const s = await setup(t);
  const init = await s.admin("save", "POST", {
    batchSize: 1,
    teams: [
      { id: "temp-e3", name: "Equipe 3", slug: "equipe3", batch_size: 1, active: true, sync_mode: "general_reverse" },
    ],
    agents: [
      { id: "temp-a", name: "Ana", phone: "11911110001", position: 1, active: true, team_id: null },
      { id: "temp-b", name: "Bia", phone: "11911110002", position: 2, active: true, team_id: null },
      { id: "temp-c", name: "Carlos", phone: "11911110003", position: 3, active: false, team_id: null },
    ],
  });
  assert.equal(init.status, 200);

  const routeScope = async (teamSlug) => {
    const c = await s.visitor();
    return s.call("route", {
      method: "POST",
      cookie: c,
      body: { analytics: true, handoffId: crypto.randomUUID(), ...(teamSlug ? { team: teamSlug } : {}) },
    });
  };

  // Ana e Bia recebem 6 fichas cada: Site Principal alterna Ana->Bia e Equipe 3 alterna Bia->Ana enquanto Carlos está pausado
  for (let i = 0; i < 6; i++) {
    assert.equal((await routeScope(null)).data.name, i % 2 === 0 ? "Ana" : "Bia");
    assert.equal((await routeScope("equipe3")).data.name, i % 2 === 0 ? "Bia" : "Ana");
  }

  // Agora reativa Carlos (com 0 fichas hoje)
  const carlosReactivated = init.data.agents.map((a) =>
    a.name === "Carlos" ? { ...a, active: true } : a,
  );
  assert.equal(
    (await s.admin("save", "POST", { batchSize: 1, teams: init.data.teams, agents: carlosReactivated })).status,
    200,
  );

  // Tanto chamadas no Site Principal quanto na Equipe 3 preenchem Carlos primeiro até empatar em 6
  for (let i = 0; i < 6; i++) {
    const slug = i % 2 === 0 ? null : "equipe3";
    assert.equal((await routeScope(slug)).data.name, "Carlos");
  }

  // Igualados em 6: Site Principal segue de cima pra baixo (Ana=7), Equipe 3 passa para Bia (7) e depois Carlos (7)
  assert.equal((await routeScope(null)).data.name, "Ana");
  assert.equal((await routeScope("equipe3")).data.name, "Bia");
  assert.equal((await routeScope("equipe3")).data.name, "Carlos");

  const stats = (await s.admin("stats?period=today")).data;
  assert.deepEqual(
    stats.agents.map((x) => x.deliveries),
    [7, 7, 7],
  );
});

test("banco existente (0001..0004) atualiza triggers via ensureSchema para aplicar equalização", async (t) => {
  const preEqSchema = (
    (await readFile("migrations/0001_atendimento.sql", "utf8")) +
    "\n" +
    (await readFile("migrations/0002_equipes.sql", "utf8")) +
    "\n" +
    (await readFile("migrations/0003_multi_equipe_phone.sql", "utf8")) +
    "\n" +
    (await readFile("migrations/0004_team_sync_mode.sql", "utf8"))
  ).replace(/--[^\n]*/g, "");
  const s = await setup(t, preEqSchema);
  const a1 = await s.add("Ana", "11999990001");
  const a2 = await s.add("Bia", "11999990002");

  // Simula 5 fichas antigas de hoje para Ana e 0 para Bia usando entrega direta no banco
  const now = Date.now();
  for (let i = 0; i < 5; i++) {
    const vid = crypto.randomUUID();
    await s.db.prepare("INSERT INTO visitors(id,event_id,agent_id,created_at) VALUES(?,?,?,?)").bind(vid, crypto.randomUUID(), a1.id, now).run();
    await s.db.prepare("INSERT INTO deliveries(id,visitor_id,agent_id,created_at,first_delivery) VALUES(?,?,?,?,1)").bind(crypto.randomUUID(), vid, a1.id, now).run();
  }

  // Chamada pública aciona ensureSchema (atualiza route_assign e cria índice) e envia para Bia (0 < 5)
  const c = await s.visitor();
  const r = await s.route(c);
  assert.equal(r.status, 200);
  assert.equal(r.data.id ?? r.data.name, a2.name);
});

test("rodízio 10 em 10 completa diferença acima ou abaixo de 10 sem ultrapassar e retoma 10 em 10", async (t) => {
  const s = await setup(t);
  await s.admin("config", "PUT", { batchSize: 10 });
  const a1 = await s.add("Ana", "11999990001");
  const a2 = await s.add("Bia", "11999990002");

  // Simula Ana=15 e Bia=15 hoje no banco (passou de 10) + Equipe 3 espelhada (de trás pra frente, lote 10)
  await s.admin("teams", "POST", {
    name: "Equipe 3",
    slug: "equipe3",
    batchSize: 10,
    syncMode: "general_reverse",
  });
  const now = Date.now();
  for (const agent of [a1, a2]) {
    for (let i = 0; i < 15; i++) {
      const vid = crypto.randomUUID();
      await s.db.prepare("INSERT INTO visitors(id,event_id,agent_id,created_at) VALUES(?,?,?,?)").bind(vid, crypto.randomUUID(), agent.id, now).run();
      await s.db.prepare("INSERT INTO deliveries(id,visitor_id,agent_id,created_at,first_delivery) VALUES(?,?,?,?,1)").bind(crypto.randomUUID(), vid, agent.id, now).run();
    }
  }

  // Adiciona Carlos com 0 fichas hoje (diferença de 15 > 10)
  const carlos = await s.add("Carlos", "11999990003");
  const routeScope = async (teamSlug) => {
    const c = await s.visitor();
    return s.call("route", {
      method: "POST",
      cookie: c,
      body: { analytics: true, handoffId: crypto.randomUUID(), ...(teamSlug ? { team: teamSlug } : {}) },
    });
  };

  // Primeiras 15 fichas (misturando Site Principal e Equipe 3) preenchem Carlos até completar 15 (0 -> 15)
  for (let i = 0; i < 15; i++) {
    const res = await routeScope(i % 2 === 0 ? null : "equipe3");
    assert.equal(res.status, 200);
    assert.equal(res.data.name, "Carlos");
  }

  // Assim que Carlos completou 15, o lote de catch-up encerra imediatamente (NÃO vai até 20) e retoma 10 em 10 em Ana
  const nextBatch = [];
  for (let i = 0; i < 10; i++) {
    nextBatch.push((await routeScope(null)).data.name);
  }
  assert.deepEqual(nextBatch, Array(10).fill("Ana"));

  // Em seguida Bia recebe 10, ficando Ana=25, Bia=25, Carlos=15; e depois Carlos recebe 10 -> 25 = 25 = 25
  for (let i = 0; i < 10; i++) {
    assert.equal((await routeScope(null)).data.name, "Bia");
  }
  for (let i = 0; i < 10; i++) {
    assert.equal((await routeScope(null)).data.name, "Carlos");
  }

  const stats = (await s.admin("stats?period=today")).data;
  assert.equal(stats.agents.find((x) => x.id === a1.id).deliveries, 25);
  assert.equal(stats.agents.find((x) => x.id === a2.id).deliveries, 25);
  assert.equal(stats.agents.find((x) => x.id === carlos.id).deliveries, 25);
});

test("sessão persistente via cookie HttpOnly (30 dias), proteção cross-site e logout revogando cookie", async (t) => {
  const { mf } = await setup(t);

  // Login por HTTPS deve emitir cookie HttpOnly Secure SameSite=None Partitioned em /api/admin
  const loginRes = await mf.dispatchFetch("https://zmscd.online/api/login", {
    method: "POST",
    headers: {
      Origin: "https://zmscd.online",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ password: "test-only-password" }),
  });
  assert.equal(loginRes.status, 200);
  const loginData = await loginRes.json();
  assert.ok(loginData.expires - Date.now() > 29 * 86400 * 1000);
  const setCookie = loginRes.headers.get("Set-Cookie") || "";
  assert.match(setCookie, /^oncred_admin=[^;]+/);
  assert.ok(setCookie.includes("Path=/api/admin"));
  assert.ok(setCookie.includes("HttpOnly"));
  assert.ok(setCookie.includes("Secure"));
  assert.ok(setCookie.includes("SameSite=None"));
  assert.ok(setCookie.includes("Partitioned"));
  assert.ok(setCookie.includes("Max-Age=2592000"));
  const adminCookiePair = setCookie.split(";")[0];

  // Sem Bearer token, apenas com o cookie salvo, deve autenticar GET /api/admin/config e GET /api/admin/stats
  const cfgRes = await mf.dispatchFetch("https://zmscd.online/api/admin/config", {
    headers: { Cookie: adminCookiePair },
  });
  assert.equal(cfgRes.status, 200);

  // Bloqueia requisição cross-site mesmo com cookie
  const crossSiteRes = await mf.dispatchFetch("https://zmscd.online/api/admin/config", {
    headers: { Cookie: adminCookiePair, "Sec-Fetch-Site": "cross-site" },
  });
  assert.equal(crossSiteRes.status, 403);

  // Logout invalida sessão no banco e expira cookie (Max-Age=0)
  const logoutRes = await mf.dispatchFetch("https://zmscd.online/api/admin/logout", {
    method: "POST",
    headers: {
      Origin: "https://zmscd.online",
      Cookie: adminCookiePair,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });
  assert.equal(logoutRes.status, 200);
  const logoutCookie = logoutRes.headers.get("Set-Cookie") || "";
  assert.ok(logoutCookie.includes("Max-Age=0"));

  // Reutilizar cookie após logout retorna 401
  const afterLogoutRes = await mf.dispatchFetch("https://zmscd.online/api/admin/config", {
    headers: { Cookie: adminCookiePair },
  });
  assert.equal(afterLogoutRes.status, 401);
});

test("/api/admin/stats retorna queues em tempo real (chegando agora, próximo, progresso 10 em 10, equalização e equipe3 invertida)", async (t) => {
  const s = await setup(t);
  await s.admin("config", "PUT", { batchSize: 10 });
  const a1 = await s.add("Ana", "11999990001");
  const a2 = await s.add("Bia", "11999990002");
  const t3 = (
    await s.admin("teams", "POST", {
      name: "Equipe 3",
      slug: "equipe3",
      batchSize: 10,
      syncMode: "general_reverse",
    })
  ).data.team;

  // Inicial: todos com 0 hoje -> Geral: Ana (0/10, próximo Bia); Equipe 3: Bia (0/10, próximo Ana)
  let st = (await s.admin("stats?period=today")).data;
  assert.equal(st.queues.general.receivingNow.id, a1.id);
  assert.equal(st.queues.general.receivingNow.usedInBatch, 0);
  assert.equal(st.queues.general.receivingNow.remainingToSwitch, 10);
  assert.equal(st.queues.general.receivingNow.equalizing, false);
  assert.equal(st.queues.general.nextUp.id, a2.id);

  assert.equal(st.queues.teams[t3.id].receivingNow.id, a2.id);
  assert.equal(st.queues.teams[t3.id].nextUp.id, a1.id);

  // Envia 4 clientes no Geral -> Ana 4/10, faltam 6, próximo Bia
  for (let i = 0; i < 4; i++) {
    const v = await s.visitor();
    assert.equal((await s.route(v)).data.name, "Ana");
  }
  st = (await s.admin("stats?period=today")).data;
  assert.equal(st.queues.general.receivingNow.id, a1.id);
  assert.equal(st.queues.general.receivingNow.todayCount, 4);
  assert.equal(st.queues.general.receivingNow.usedInBatch, 4);
  assert.equal(st.queues.general.receivingNow.remainingToSwitch, 6);
  assert.equal(st.queues.general.nextUp.id, a2.id);

  // Completa os 10 de Ana -> agora quem está chegando no Geral passa a ser Bia (usedInBatch 0, faltam 10)
  for (let i = 0; i < 6; i++) {
    const v = await s.visitor();
    assert.equal((await s.route(v)).data.name, "Ana");
  }
  st = (await s.admin("stats?period=today")).data;
  assert.equal(st.queues.general.receivingNow.id, a2.id);
  assert.equal(st.queues.general.receivingNow.usedInBatch, 0);
  assert.equal(st.queues.general.receivingNow.remainingToSwitch, 10);
  assert.equal(st.queues.general.receivingNow.equalizing, true);
  assert.equal(st.queues.general.receivingNow.missingToEqualize, 10);
  assert.equal(st.queues.general.nextUp.id, a1.id);

  // Adiciona Carlos com 0 fichas enquanto Ana=10, Bia=0 -> primeiro menor ainda é Bia (pos 2), próximo é Carlos (pos 3)
  const carlos = await s.add("Carlos", "11999990003");
  st = (await s.admin("stats?period=today")).data;
  assert.equal(st.queues.general.receivingNow.id, a2.id);
  assert.equal(st.queues.general.receivingNow.equalizing, true);
  assert.equal(st.queues.general.receivingNow.missingToEqualize, 10);
  assert.equal(st.queues.general.nextUp.id, carlos.id);

  // Na Equipe 3 (invertida), Carlos está no topo (0 fichas, falta 10 p/ igualar) e o próximo depois de igualar em 10 será Bia (0 fichas)!
  assert.equal(st.queues.teams[t3.id].receivingNow.id, carlos.id);
  assert.equal(st.queues.teams[t3.id].receivingNow.equalizing, true);
  assert.equal(st.queues.teams[t3.id].receivingNow.missingToEqualize, 10);
  assert.equal(st.queues.teams[t3.id].nextUp.id, a2.id);
});






