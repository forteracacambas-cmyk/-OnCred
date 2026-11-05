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
async function setup(t) {
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
  for (const s of statements(schema)) await db.prepare(s).run();
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
