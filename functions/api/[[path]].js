const headers = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow",
};
const json = (data, status = 200, extra = {}) =>
  Response.json(data, { status, headers: { ...headers, ...extra } });
const fail = (message, status = 400) => {
  throw Object.assign(new Error(message), { status });
};
const uuid = () => crypto.randomUUID();
const validID = (v) => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);

const RESERVED_TEAM_SLUGS = new Set([
  "painel",
  "contato",
  "simulacao",
  "simular",
  "api",
  "atendente",
  "atendimento",
  "politica-de-privacidade",
  "termos-de-uso",
  "assets",
  "doc",
  "favicon",
  "robots",
  "sitemap",
]);

export function normalizeTeamSlug(input) {
  const s = String(input || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (
    !s ||
    !/^[a-z0-9][a-z0-9_-]{0,48}$/.test(s) ||
    RESERVED_TEAM_SLUGS.has(s) ||
    /^atend(?:imento|ente)\d+$/i.test(s)
  ) {
    fail(
      "URL da equipe inválida ou reservada. Use apenas letras minúsculas, números, '-' ou '_' (ex: equipe1, vendas).",
    );
  }
  return s;
}

const VALID_SYNC_MODES = new Set([
  "independent",
  "general_same",
  "general_reverse",
]);
function normalizeSyncMode(v) {
  return VALID_SYNC_MODES.has(v) ? v : "independent";
}

const ROUTE_AVAILABLE_TRIGGER_SQL = `CREATE TRIGGER route_available BEFORE INSERT ON route_requests
WHEN (NEW.team_id IS NULL AND NOT EXISTS(SELECT 1 FROM agents WHERE active=1 AND deleted=0 AND team_id IS NULL))
  OR (NEW.team_id IS NOT NULL AND COALESCE(
    (SELECT CASE
      WHEN sync_mode IN ('general_same','general_reverse') THEN
        NOT EXISTS(SELECT 1 FROM agents WHERE active=1 AND deleted=0 AND team_id IS NULL)
      ELSE
        NOT EXISTS(SELECT 1 FROM agents WHERE active=1 AND deleted=0 AND team_id=NEW.team_id)
    END FROM teams WHERE id=NEW.team_id),
    1
  ))
BEGIN SELECT RAISE(ABORT,'NO_AGENTS'); END`;

const ROUTE_ASSIGN_TRIGGER_SQL = `CREATE TRIGGER route_assign AFTER INSERT ON route_requests
BEGIN
 INSERT INTO visitors(id,event_id,created_at) VALUES(NEW.visitor_id,NEW.event_id,NEW.at) ON CONFLICT(id) DO NOTHING;

 UPDATE settings SET
  cursor_agent=CASE
   WHEN used<batch_size
    AND EXISTS(SELECT 1 FROM agents WHERE id=cursor_agent AND active=1 AND deleted=0 AND team_id IS NULL)
    AND (used=0 OR EXISTS(
     SELECT 1 FROM agents b
     WHERE b.active=1 AND b.deleted=0 AND b.team_id IS NULL
      AND (SELECT COUNT(*) FROM deliveries d WHERE d.agent_id=b.id AND d.created_at>=((NEW.at-10800000)/86400000)*86400000+10800000)
       !=(SELECT COUNT(*) FROM deliveries d WHERE d.agent_id=cursor_agent AND d.created_at>=((NEW.at-10800000)/86400000)*86400000+10800000)
    ))
   THEN cursor_agent
   ELSE COALESCE(
    (SELECT a.id FROM agents a
     WHERE a.active=1 AND a.deleted=0 AND a.team_id IS NULL
      AND NOT EXISTS(
       SELECT 1 FROM agents b
       WHERE b.active=1 AND b.deleted=0 AND b.team_id IS NULL
        AND (SELECT COUNT(*) FROM deliveries d WHERE d.agent_id=b.id AND d.created_at>=((NEW.at-10800000)/86400000)*86400000+10800000)
          < (SELECT COUNT(*) FROM deliveries d WHERE d.agent_id=a.id AND d.created_at>=((NEW.at-10800000)/86400000)*86400000+10800000)
      )
      AND (a.position>COALESCE((SELECT position FROM agents WHERE id=cursor_agent AND team_id IS NULL),-1)
       OR (a.position=(SELECT position FROM agents WHERE id=cursor_agent AND team_id IS NULL) AND a.id>cursor_agent))
     ORDER BY a.position ASC,a.id ASC LIMIT 1),
    (SELECT a.id FROM agents a
     WHERE a.active=1 AND a.deleted=0 AND a.team_id IS NULL
      AND NOT EXISTS(
       SELECT 1 FROM agents b
       WHERE b.active=1 AND b.deleted=0 AND b.team_id IS NULL
        AND (SELECT COUNT(*) FROM deliveries d WHERE d.agent_id=b.id AND d.created_at>=((NEW.at-10800000)/86400000)*86400000+10800000)
          < (SELECT COUNT(*) FROM deliveries d WHERE d.agent_id=a.id AND d.created_at>=((NEW.at-10800000)/86400000)*86400000+10800000)
      )
     ORDER BY a.position ASC,a.id ASC LIMIT 1)
   )
  END,
  used=CASE
   WHEN used<batch_size
    AND EXISTS(SELECT 1 FROM agents WHERE id=cursor_agent AND active=1 AND deleted=0 AND team_id IS NULL)
    AND (used=0 OR EXISTS(
     SELECT 1 FROM agents b
     WHERE b.active=1 AND b.deleted=0 AND b.team_id IS NULL
      AND (SELECT COUNT(*) FROM deliveries d WHERE d.agent_id=b.id AND d.created_at>=((NEW.at-10800000)/86400000)*86400000+10800000)
       !=(SELECT COUNT(*) FROM deliveries d WHERE d.agent_id=cursor_agent AND d.created_at>=((NEW.at-10800000)/86400000)*86400000+10800000)
    ))
   THEN used ELSE 0
  END
 WHERE id=1
  AND NEW.team_id IS NULL
  AND NOT EXISTS(SELECT 1 FROM visitors v JOIN agents a ON a.id=v.agent_id WHERE v.id=NEW.visitor_id AND a.active=1 AND a.deleted=0 AND a.team_id IS NULL);

 UPDATE teams SET
  cursor_agent=CASE
   WHEN sync_mode IN ('general_same','general_reverse') THEN
    CASE
     WHEN used<batch_size
      AND EXISTS(SELECT 1 FROM agents WHERE id=cursor_agent AND active=1 AND deleted=0 AND team_id IS NULL)
      AND (used=0 OR EXISTS(
       SELECT 1 FROM agents b
       WHERE b.active=1 AND b.deleted=0 AND b.team_id IS NULL
        AND (SELECT COUNT(*) FROM deliveries d WHERE d.agent_id=b.id AND d.created_at>=((NEW.at-10800000)/86400000)*86400000+10800000)
         !=(SELECT COUNT(*) FROM deliveries d WHERE d.agent_id=cursor_agent AND d.created_at>=((NEW.at-10800000)/86400000)*86400000+10800000)
      ))
     THEN cursor_agent
     WHEN sync_mode='general_reverse' THEN
      COALESCE(
       (SELECT a.id FROM agents a
        WHERE a.active=1 AND a.deleted=0 AND a.team_id IS NULL
         AND NOT EXISTS(
          SELECT 1 FROM agents b
          WHERE b.active=1 AND b.deleted=0 AND b.team_id IS NULL
           AND (SELECT COUNT(*) FROM deliveries d WHERE d.agent_id=b.id AND d.created_at>=((NEW.at-10800000)/86400000)*86400000+10800000)
             < (SELECT COUNT(*) FROM deliveries d WHERE d.agent_id=a.id AND d.created_at>=((NEW.at-10800000)/86400000)*86400000+10800000)
         )
         AND (
          (SELECT position FROM agents WHERE id=cursor_agent AND team_id IS NULL) IS NULL
          OR a.position<(SELECT position FROM agents WHERE id=cursor_agent AND team_id IS NULL)
          OR (a.position=(SELECT position FROM agents WHERE id=cursor_agent AND team_id IS NULL) AND a.id<cursor_agent)
         )
        ORDER BY a.position DESC,a.id DESC LIMIT 1),
       (SELECT a.id FROM agents a
        WHERE a.active=1 AND a.deleted=0 AND a.team_id IS NULL
         AND NOT EXISTS(
          SELECT 1 FROM agents b
          WHERE b.active=1 AND b.deleted=0 AND b.team_id IS NULL
           AND (SELECT COUNT(*) FROM deliveries d WHERE d.agent_id=b.id AND d.created_at>=((NEW.at-10800000)/86400000)*86400000+10800000)
             < (SELECT COUNT(*) FROM deliveries d WHERE d.agent_id=a.id AND d.created_at>=((NEW.at-10800000)/86400000)*86400000+10800000)
         )
        ORDER BY a.position DESC,a.id DESC LIMIT 1)
      )
     ELSE
      COALESCE(
       (SELECT a.id FROM agents a
        WHERE a.active=1 AND a.deleted=0 AND a.team_id IS NULL
         AND NOT EXISTS(
          SELECT 1 FROM agents b
          WHERE b.active=1 AND b.deleted=0 AND b.team_id IS NULL
           AND (SELECT COUNT(*) FROM deliveries d WHERE d.agent_id=b.id AND d.created_at>=((NEW.at-10800000)/86400000)*86400000+10800000)
             < (SELECT COUNT(*) FROM deliveries d WHERE d.agent_id=a.id AND d.created_at>=((NEW.at-10800000)/86400000)*86400000+10800000)
         )
         AND (a.position>COALESCE((SELECT position FROM agents WHERE id=cursor_agent AND team_id IS NULL),-1)
          OR (a.position=(SELECT position FROM agents WHERE id=cursor_agent AND team_id IS NULL) AND a.id>cursor_agent))
        ORDER BY a.position ASC,a.id ASC LIMIT 1),
       (SELECT a.id FROM agents a
        WHERE a.active=1 AND a.deleted=0 AND a.team_id IS NULL
         AND NOT EXISTS(
          SELECT 1 FROM agents b
          WHERE b.active=1 AND b.deleted=0 AND b.team_id IS NULL
           AND (SELECT COUNT(*) FROM deliveries d WHERE d.agent_id=b.id AND d.created_at>=((NEW.at-10800000)/86400000)*86400000+10800000)
             < (SELECT COUNT(*) FROM deliveries d WHERE d.agent_id=a.id AND d.created_at>=((NEW.at-10800000)/86400000)*86400000+10800000)
         )
        ORDER BY a.position ASC,a.id ASC LIMIT 1)
      )
    END
   ELSE
    CASE
     WHEN used<batch_size
      AND EXISTS(SELECT 1 FROM agents WHERE id=cursor_agent AND active=1 AND deleted=0 AND team_id=NEW.team_id)
      AND (used=0 OR EXISTS(
       SELECT 1 FROM agents b
       WHERE b.active=1 AND b.deleted=0 AND b.team_id=NEW.team_id
        AND (SELECT COUNT(*) FROM deliveries d WHERE d.agent_id=b.id AND d.created_at>=((NEW.at-10800000)/86400000)*86400000+10800000)
         !=(SELECT COUNT(*) FROM deliveries d WHERE d.agent_id=cursor_agent AND d.created_at>=((NEW.at-10800000)/86400000)*86400000+10800000)
      ))
     THEN cursor_agent
     ELSE COALESCE(
      (SELECT a.id FROM agents a
       WHERE a.active=1 AND a.deleted=0 AND a.team_id=NEW.team_id
        AND NOT EXISTS(
         SELECT 1 FROM agents b
         WHERE b.active=1 AND b.deleted=0 AND b.team_id=NEW.team_id
          AND (SELECT COUNT(*) FROM deliveries d WHERE d.agent_id=b.id AND d.created_at>=((NEW.at-10800000)/86400000)*86400000+10800000)
            < (SELECT COUNT(*) FROM deliveries d WHERE d.agent_id=a.id AND d.created_at>=((NEW.at-10800000)/86400000)*86400000+10800000)
        )
        AND (a.position>COALESCE((SELECT position FROM agents WHERE id=cursor_agent AND team_id=NEW.team_id),-1)
         OR (a.position=(SELECT position FROM agents WHERE id=cursor_agent AND team_id=NEW.team_id) AND a.id>cursor_agent))
       ORDER BY a.position ASC,a.id ASC LIMIT 1),
      (SELECT a.id FROM agents a
       WHERE a.active=1 AND a.deleted=0 AND a.team_id=NEW.team_id
        AND NOT EXISTS(
         SELECT 1 FROM agents b
         WHERE b.active=1 AND b.deleted=0 AND b.team_id=NEW.team_id
          AND (SELECT COUNT(*) FROM deliveries d WHERE d.agent_id=b.id AND d.created_at>=((NEW.at-10800000)/86400000)*86400000+10800000)
            < (SELECT COUNT(*) FROM deliveries d WHERE d.agent_id=a.id AND d.created_at>=((NEW.at-10800000)/86400000)*86400000+10800000)
        )
       ORDER BY a.position ASC,a.id ASC LIMIT 1)
     )
    END
  END,
  used=CASE
   WHEN sync_mode IN ('general_same','general_reverse')
    AND used<batch_size
    AND EXISTS(SELECT 1 FROM agents WHERE id=cursor_agent AND active=1 AND deleted=0 AND team_id IS NULL)
    AND (used=0 OR EXISTS(
     SELECT 1 FROM agents b
     WHERE b.active=1 AND b.deleted=0 AND b.team_id IS NULL
      AND (SELECT COUNT(*) FROM deliveries d WHERE d.agent_id=b.id AND d.created_at>=((NEW.at-10800000)/86400000)*86400000+10800000)
       !=(SELECT COUNT(*) FROM deliveries d WHERE d.agent_id=cursor_agent AND d.created_at>=((NEW.at-10800000)/86400000)*86400000+10800000)
    ))
   THEN used
   WHEN sync_mode='independent'
    AND used<batch_size
    AND EXISTS(SELECT 1 FROM agents WHERE id=cursor_agent AND active=1 AND deleted=0 AND team_id=NEW.team_id)
    AND (used=0 OR EXISTS(
     SELECT 1 FROM agents b
     WHERE b.active=1 AND b.deleted=0 AND b.team_id=NEW.team_id
      AND (SELECT COUNT(*) FROM deliveries d WHERE d.agent_id=b.id AND d.created_at>=((NEW.at-10800000)/86400000)*86400000+10800000)
       !=(SELECT COUNT(*) FROM deliveries d WHERE d.agent_id=cursor_agent AND d.created_at>=((NEW.at-10800000)/86400000)*86400000+10800000)
    ))
   THEN used
   ELSE 0
  END
 WHERE id=NEW.team_id
  AND NEW.team_id IS NOT NULL
  AND NOT EXISTS(
   SELECT 1 FROM visitors v JOIN agents a ON a.id=v.agent_id
   WHERE v.id=NEW.visitor_id AND a.active=1 AND a.deleted=0
    AND CASE
     WHEN (SELECT t.sync_mode FROM teams t WHERE t.id=NEW.team_id) IN ('general_same','general_reverse') THEN a.team_id IS NULL
     ELSE a.team_id=NEW.team_id
    END
  );

 UPDATE visitors SET
  agent_id=CASE
   WHEN NEW.team_id IS NULL THEN (SELECT cursor_agent FROM settings WHERE id=1)
   ELSE (SELECT cursor_agent FROM teams WHERE id=NEW.team_id)
  END,
  route_token=NEW.id
 WHERE id=NEW.visitor_id
  AND NOT EXISTS(
   SELECT 1 FROM agents a
   WHERE a.id=visitors.agent_id AND a.active=1 AND a.deleted=0
    AND (
     (NEW.team_id IS NULL AND a.team_id IS NULL)
     OR (NEW.team_id IS NOT NULL AND CASE
      WHEN (SELECT sync_mode FROM teams WHERE id=NEW.team_id) IN ('general_same','general_reverse') THEN a.team_id IS NULL
      ELSE a.team_id=NEW.team_id
     END)
    )
  );

 INSERT INTO deliveries(id,visitor_id,agent_id,created_at,first_delivery)
 SELECT NEW.id,id,agent_id,NEW.at,NOT EXISTS(SELECT 1 FROM deliveries WHERE visitor_id=NEW.visitor_id)
 FROM visitors WHERE id=NEW.visitor_id AND route_token=NEW.id;

 UPDATE settings SET used=used+1
 WHERE id=1 AND NEW.team_id IS NULL
  AND EXISTS(SELECT 1 FROM visitors WHERE id=NEW.visitor_id AND route_token=NEW.id);

 UPDATE teams SET used=used+1
 WHERE id=NEW.team_id AND NEW.team_id IS NOT NULL
  AND EXISTS(SELECT 1 FROM visitors WHERE id=NEW.visitor_id AND route_token=NEW.id);
END`;

async function ensureSchema(db) {
  let hasTeams = false;
  let hasAgentTeamCol = false;
  let hasReqTeamCol = false;
  let hasSyncModeCol = false;
  let triggersReady = false;
  let phoneIdxReady = false;
  let deliveriesIdxReady = false;

  try {
    hasTeams = !!(await db
      .prepare(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name='teams'",
      )
      .first());

    deliveriesIdxReady = !!(await db
      .prepare(
        "SELECT 1 FROM sqlite_master WHERE type='index' AND name='deliveries_agent_date'",
      )
      .first());

    if (hasTeams) {
      const teamCols = await db.prepare("PRAGMA table_info(teams)").all();
      hasSyncModeCol = (teamCols.results || []).some(
        (c) => c.name === "sync_mode",
      );

      const agentCols = await db.prepare("PRAGMA table_info(agents)").all();
      hasAgentTeamCol = (agentCols.results || []).some(
        (c) => c.name === "team_id",
      );

      const reqCols = await db
        .prepare("PRAGMA table_info(route_requests)")
        .all();
      hasReqTeamCol = (reqCols.results || []).some((c) => c.name === "team_id");

      const tr = await db
        .prepare(
          "SELECT name, sql FROM sqlite_master WHERE type='trigger' AND name IN ('route_available','route_assign')",
        )
        .all();
      const rows = tr.results || [];
      const availRow = rows.find((r) => r.name === "route_available");
      const assignRow = rows.find((r) => r.name === "route_assign");
      triggersReady =
        !!availRow &&
        !!assignRow &&
        String(availRow.sql || "").includes("team_id") &&
        String(availRow.sql || "").includes("sync_mode") &&
        String(assignRow.sql || "").includes("team_id") &&
        String(assignRow.sql || "").includes("sync_mode") &&
        String(assignRow.sql || "").includes("10800000") &&
        String(assignRow.sql || "").includes("deliveries d WHERE d.agent_id=b.id") &&
        String(assignRow.sql || "").includes("!=(SELECT COUNT(*)");

      const phoneIdx = await db
        .prepare(
          "SELECT sql FROM sqlite_master WHERE type='index' AND name='agents_phone'",
        )
        .first();
      phoneIdxReady =
        !!phoneIdx && String(phoneIdx.sql || "").includes("team_id");
    }
  } catch {
    return;
  }

  if (
    hasTeams &&
    hasSyncModeCol &&
    hasAgentTeamCol &&
    hasReqTeamCol &&
    triggersReady &&
    phoneIdxReady &&
    deliveriesIdxReady
  )
    return;

  if (!hasTeams) {
    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS teams (
          id TEXT PRIMARY KEY,
          slug TEXT NOT NULL,
          name TEXT NOT NULL,
          batch_size INTEGER NOT NULL DEFAULT 1 CHECK(batch_size BETWEEN 1 AND 1000),
          cursor_agent TEXT,
          used INTEGER NOT NULL DEFAULT 0,
          active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
          deleted INTEGER NOT NULL DEFAULT 0 CHECK(deleted IN (0,1)),
          sync_mode TEXT NOT NULL DEFAULT 'independent' CHECK(sync_mode IN ('independent','general_same','general_reverse')),
          created_at INTEGER NOT NULL DEFAULT 0
        )`,
      )
      .run();
  } else if (!hasSyncModeCol) {
    try {
      await db
        .prepare(
          "ALTER TABLE teams ADD COLUMN sync_mode TEXT NOT NULL DEFAULT 'independent' CHECK(sync_mode IN ('independent','general_same','general_reverse'))",
        )
        .run();
      await db
        .prepare(
          "UPDATE teams SET sync_mode='general_reverse', cursor_agent=NULL, used=0 WHERE lower(slug)='equipe3' AND deleted=0",
        )
        .run();
    } catch {}
  }

  await db
    .prepare(
      "CREATE UNIQUE INDEX IF NOT EXISTS teams_slug ON teams(lower(slug)) WHERE deleted=0",
    )
    .run();

  if (!hasAgentTeamCol) {
    try {
      await db
        .prepare(
          "ALTER TABLE agents ADD COLUMN team_id TEXT REFERENCES teams(id)",
        )
        .run();
    } catch {}
  }

  if (!phoneIdxReady) {
    await db.batch([
      db.prepare("DROP INDEX IF EXISTS agents_phone"),
      db.prepare(
        "CREATE UNIQUE INDEX IF NOT EXISTS agents_phone ON agents(phone, COALESCE(team_id, '')) WHERE deleted=0",
      ),
    ]);
  }

  await db
    .prepare(
      "CREATE INDEX IF NOT EXISTS agents_team ON agents(team_id, active, deleted, position)",
    )
    .run();

  if (!deliveriesIdxReady) {
    await db
      .prepare(
        "CREATE INDEX IF NOT EXISTS deliveries_agent_date ON deliveries(agent_id, created_at)",
      )
      .run();
  }

  if (!hasReqTeamCol) {
    try {
      await db
        .prepare("ALTER TABLE route_requests ADD COLUMN team_id TEXT")
        .run();
    } catch {}
  }

  if (!triggersReady) {
    await db.batch([
      db.prepare("DROP TRIGGER IF EXISTS route_available"),
      db.prepare("DROP TRIGGER IF EXISTS route_assign"),
      db.prepare(ROUTE_AVAILABLE_TRIGGER_SQL),
      db.prepare(ROUTE_ASSIGN_TRIGGER_SQL),
    ]);
  }
}

async function hash(s) {
  return [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)),
    ),
  ]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
async function equal(a, b) {
  const x = await hash(a),
    y = await hash(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}
function cookie(request) {
  return request.headers
    .get("Cookie")
    ?.match(/(?:^|;\s*)oncred_visitor=([0-9a-f-]{36})(?:;|$)/i)?.[1];
}
function visitorCookie(request, id) {
  const domain = ""; // Host-only cookie: isolated from SANTS and other Pages projects.
  return `oncred_visitor=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${domain}${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`;
}
async function body(request, maxBytes = 8192) {
  if (!request.headers.get("Content-Type")?.startsWith("application/json"))
    fail("Formato inválido.", 415);
  const text = await request.text();
  if (text.length > maxBytes) fail("Solicitação muito grande.", 413);
  try {
    return JSON.parse(text);
  } catch {
    fail("Dados inválidos.");
  }
}
export function normalizePhone(input) {
  let n = String(input || "").replace(/\D/g, "");
  n = n.replace(/^0+/, "");
  if (n.startsWith("55") && (n.length === 12 || n.length === 13)) {
    // Já possui o DDI 55 com 10 ou 11 dígitos nacionais
  } else if (n.length === 10 || n.length === 11) {
    // DDD (2 dígitos) + número com 8 ou 9 dígitos
    n = "55" + n;
  }
  if (!/^55[1-9][0-9]\d{8,9}$/.test(n))
    fail("Informe um telefone brasileiro válido com DDD.");
  return n;
}
export function rangeStart(days, now = Date.now()) {
  // Local calendar days in São Paulo; the IANA zone handles offset changes.
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const midnight = new Date(`${day}T00:00:00-03:00`).getTime();
  return midnight - (days - 1) * 86400000;
}
async function handle({ request, env, params }) {
  const url = new URL(request.url),
    path = url.pathname.replace(/\/$/, "");
  if (!env.DB)
    fail(
      "Atendimento ainda não configurado. Tente novamente em instantes.",
      503,
    );
  const db = env.DB.withSession ? env.DB.withSession("first-primary") : env.DB;
  const sql = (s, ...args) => db.prepare(s).bind(...args);
  if (request.method !== "GET") {
    if (request.headers.get("Origin") !== url.origin)
      fail("Origem não autorizada.", 403);
    if (request.headers.get("Sec-Fetch-Site") === "cross-site")
      fail("Origem não autorizada.", 403);
  }
  if (path === "/api/visitor" && request.method === "GET") {
    const id = cookie(request) || uuid();
    return json({ ready: true }, 200, {
      "Set-Cookie": visitorCookie(request, id),
      Vary: "Cookie",
    });
  }
  if (path === "/api/team" && request.method === "GET") {
    await ensureSchema(db);
    const slug = String(url.searchParams.get("slug") || "").trim();
    if (!slug) fail("Equipe não informada.", 400);
    const team = await sql(
      `SELECT id, slug, name, active, deleted, sync_mode FROM teams
       WHERE (id=? OR lower(slug)=lower(?))
       ORDER BY deleted ASC, (CASE WHEN active=1 THEN 0 ELSE 1 END) LIMIT 1`,
      slug,
      slug,
    ).first();
    if (!team || team.deleted === 1) {
      return json(
        { exists: false, online: false, error: "Equipe não encontrada." },
        404,
      );
    }
    const syncMode = normalizeSyncMode(team.sync_mode);
    const isMirrored =
      syncMode === "general_same" || syncMode === "general_reverse";
    const countRow = isMirrored
      ? await sql(
          "SELECT COUNT(*) AS count FROM agents WHERE active=1 AND deleted=0 AND team_id IS NULL",
        ).first()
      : await sql(
          "SELECT COUNT(*) AS count FROM agents WHERE active=1 AND deleted=0 AND team_id=?",
          team.id,
        ).first();
    const agentCount = Number(countRow?.count || 0);
    const active = team.active === 1;
    return json({
      exists: true,
      active,
      online: active && agentCount > 0,
      slug: team.slug,
      name: team.name,
      syncMode,
      agentCount,
    });
  }
  if (path === "/api/route" && request.method === "POST") {
    await ensureSchema(db);
    const data = await body(request);
    if (!validID(cookie(request)))
      fail("Recarregue a página para iniciar o atendimento.", 409);
    if (data.handoffId !== undefined && !validID(data.handoffId))
      fail("Identificação do atendimento inválida.");
    // Each simulation click gets a new key; retries/reloads keep that key.
    // Legacy clients keep cookie affinity until they load the current frontend.
    const id = data.handoffId || cookie(request);
    const req = uuid(),
      event = uuid(),
      now = Date.now();

    // 1. Rota direta para atendente específico (/atendimento1, /atendente1, número ou ID)
    const specificAgent = data.agent ? String(data.agent).trim() : null;
    if (specificAgent) {
      const ordinalMatch = specificAgent.match(
        /^(?:atendimento|atendente)?([1-9]\d*)$/i,
      );
      const pos = ordinalMatch ? parseInt(ordinalMatch[1], 10) : -1;
      const found = await sql(
        `SELECT id, name, phone, active, deleted FROM agents 
         WHERE (
           id=? 
           OR position=? 
           OR lower(name)=lower(?) 
           OR 'atendimento' || position = lower(?)
           OR 'atendente' || position = lower(?)
         )
         ORDER BY deleted ASC, (CASE WHEN active=1 THEN 0 ELSE 1 END), position LIMIT 1`,
        specificAgent,
        pos,
        specificAgent,
        specificAgent,
        specificAgent,
      ).first();

      if (!found || found.deleted === 1) {
        fail("Atendente não encontrado.", 404);
      }
      if (!found.active) {
        fail("Atendente temporariamente indisponível.", 409);
      }

      const batchResults = await db.batch([
        sql(
          "INSERT INTO visitors(id,event_id,agent_id,created_at,route_token) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET agent_id=?, route_token=?",
          id,
          event,
          found.id,
          now,
          req,
          found.id,
          req,
        ),
        sql("SELECT event_id FROM visitors WHERE id=?", id),
        sql(
          "INSERT INTO deliveries(id,visitor_id,agent_id,created_at,first_delivery) VALUES(?,?,?,?, NOT EXISTS(SELECT 1 FROM deliveries WHERE visitor_id=?))",
          req,
          id,
          found.id,
          now,
          id,
        ),
        sql(
          "UPDATE visitors SET pixel_claimed=1 WHERE id=? AND pixel_claimed=0 AND ?=1 RETURNING event_id",
          id,
          data.analytics === true ? 1 : 0,
        ),
      ]);
      const persistedEventId = batchResults[1].results[0]?.event_id || event;
      return json(
        {
          phone: found.phone,
          name: found.name,
          eventId: persistedEventId,
          trackContact: batchResults[3].results.length === 1,
          isDirect: true,
        },
        200,
        { Vary: "Cookie" },
      );
    }

    // 2. Rota por equipe (/equipe1, /equipe2, /vendas, etc.) ou Site Principal (team_id = NULL)
    const specificTeam = data.team ? String(data.team).trim() : null;
    let targetTeam = null;
    if (specificTeam) {
      targetTeam = await sql(
        `SELECT id, slug, name, active, deleted FROM teams
         WHERE (id=? OR lower(slug)=lower(?))
         ORDER BY deleted ASC, (CASE WHEN active=1 THEN 0 ELSE 1 END) LIMIT 1`,
        specificTeam,
        specificTeam,
      ).first();
      if (!targetTeam || targetTeam.deleted === 1) {
        fail("Equipe não encontrada.", 404);
      }
      if (!targetTeam.active) {
        fail("Equipe temporariamente indisponível.", 409);
      }
    }

    let results;
    try {
      results = await db.batch([
        sql(
          "INSERT INTO route_requests(id,visitor_id,event_id,at,team_id) VALUES(?,?,?,?,?)",
          req,
          id,
          event,
          now,
          targetTeam ? targetTeam.id : null,
        ),
        sql(
          "SELECT v.event_id,a.phone,a.name FROM visitors v JOIN agents a ON a.id=v.agent_id WHERE v.id=?",
          id,
        ),
        sql("DELETE FROM route_requests WHERE id=?", req),
        sql(
          "UPDATE visitors SET pixel_claimed=1 WHERE id=? AND pixel_claimed=0 AND ?=1 RETURNING event_id",
          id,
          data.analytics === true ? 1 : 0,
        ),
      ]);
    } catch (e) {
      if (String(e).includes("NO_AGENTS"))
        fail(
          targetTeam
            ? `Nenhum atendente disponível na equipe ${targetTeam.name} no momento. Tente novamente mais tarde.`
            : "Nenhum atendente disponível no momento. Tente novamente mais tarde.",
          503,
        );
      throw e;
    }
    const row = results[1].results[0];
    if (!row) fail("Não foi possível encaminhar. Tente novamente.", 503);
    return json(
      {
        phone: row.phone,
        name: row.name,
        ...(targetTeam ? { teamName: targetTeam.name, isTeam: true } : {}),
        eventId: row.event_id,
        trackContact: results[3].results.length === 1,
      },
      200,
      { Vary: "Cookie" },
    );
  }
  if (path === "/api/login" && request.method === "POST") {
    if (!env.ADMIN_PASSWORD)
      fail("A senha do painel ainda não foi configurada no servidor.", 503);
    const data = await body(request),
      now = Date.now();
    // CF-Connecting-IP is supplied by Cloudflare, never stored as raw IP.
    const key = await hash(
      "login:" + (request.headers.get("CF-Connecting-IP") || "local"),
    );
    const result = await sql(
      `INSERT INTO login_limits(key,attempts,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN expires<? THEN 1 ELSE attempts+1 END, expires=CASE WHEN expires<? THEN ? ELSE expires END RETURNING attempts`,
      key,
      now + 900000,
      now,
      now,
      now + 900000,
    ).first();
    if (result.attempts > 10)
      fail("Muitas tentativas. Aguarde 15 minutos.", 429);
    if (
      typeof data.password !== "string" ||
      data.password.length > 128 ||
      !(await equal(data.password, env.ADMIN_PASSWORD))
    )
      fail("Senha incorreta.", 401);
    const token = uuid() + uuid();
    await db.batch([
      sql(
        "INSERT INTO sessions(token_hash,expires) VALUES(?,?)",
        await hash(token),
        now + 1800000,
      ),
      sql("DELETE FROM sessions WHERE expires<?", now),
      sql("DELETE FROM login_limits WHERE expires<?", now),
    ]);
    return json({ token, expires: now + 1800000 });
  }
  if (path.startsWith("/api/admin/")) {
    await ensureSchema(db);
    const token = request.headers.get("Authorization")?.replace(/^Bearer /, "");
    if (!token || token.length > 100) fail("Entre novamente no painel.", 401);
    const tokenHash = await hash(token);
    if (
      !(await sql(
        "SELECT 1 FROM sessions WHERE token_hash=? AND expires>?",
        tokenHash,
        Date.now(),
      ).first())
    )
      fail("Sessão expirada. Entre novamente.", 401);
    if (path === "/api/admin/logout" && request.method === "POST") {
      await sql("DELETE FROM sessions WHERE token_hash=?", tokenHash).run();
      return json({ ok: true });
    }
    if (path === "/api/admin/clear-history" && request.method === "POST") {
      await db.batch([
        sql("DELETE FROM deliveries"),
        sql("DELETE FROM visitors"),
        sql("DELETE FROM route_requests"),
        sql("UPDATE settings SET cursor_agent=NULL, used=0 WHERE id=1"),
        sql("UPDATE teams SET cursor_agent=NULL, used=0"),
      ]);
      return json({ ok: true, message: "Histórico zerado com sucesso." });
    }
    if (path === "/api/admin/config" && request.method === "GET") {
      const res = await db.batch([
        sql("SELECT batch_size FROM settings WHERE id=1"),
        sql("SELECT * FROM agents WHERE deleted=0 ORDER BY position,id"),
        sql(
          "SELECT id,slug,name,batch_size,active,sync_mode,created_at FROM teams WHERE deleted=0 ORDER BY created_at,lower(name)",
        ),
      ]);
      return json({
        batchSize: res[0].results[0].batch_size,
        agents: res[1].results,
        teams: res[2].results,
      });
    }
    if (path === "/api/admin/config" && request.method === "PUT") {
      const data = await body(request);
      if (
        !Number.isInteger(data.batchSize) ||
        data.batchSize < 1 ||
        data.batchSize > 1000
      )
        fail("O lote deve ser de 1 a 1000.");
      await sql(
        "UPDATE settings SET batch_size=? WHERE id=1",
        data.batchSize,
      ).run();
      return json({ ok: true });
    }
    if (path === "/api/admin/save" && request.method === "POST") {
      const data = await body(request, 65536);
      const batchSize = Number(data.batchSize);
      if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 1000)
        fail("O lote do Site Principal deve ser de 1 a 1000.");
      if (!Array.isArray(data.teams) || !Array.isArray(data.agents))
        fail("Dados de salvamento inválidos.");

      const existingRes = await db.batch([
        sql("SELECT id, sync_mode FROM teams WHERE deleted=0"),
        sql("SELECT id, position, team_id, active FROM agents WHERE deleted=0 ORDER BY position, id"),
        sql("SELECT COALESCE(MAX(position),0) AS max_pos FROM agents"),
      ]);
      const existingTeamMap = new Map(
        (existingRes[0].results || []).map((r) => [r.id, r]),
      );
      const existingTeamIds = new Set(existingTeamMap.keys());
      const existingAgentMap = new Map(
        (existingRes[1].results || []).map((r) => [r.id, r]),
      );
      let nextPos = Number(existingRes[2].results?.[0]?.max_pos || 0);

      const buildScopeOrder = (rows) => {
        const map = new Map();
        const sorted = [...rows].sort(
          (a, b) => (a.position - b.position) || String(a.id).localeCompare(String(b.id)),
        );
        for (const r of sorted) {
          if (!r.active) continue;
          const key = r.team_id || "__general__";
          if (!map.has(key)) map.set(key, []);
          map.get(key).push(r.id);
        }
        return new Map([...map.entries()].map(([k, ids]) => [k, ids.join(",")]));
      };
      const beforeScopeOrder = buildScopeOrder(existingRes[1].results || []);

      const teamIdMap = new Map();
      const seenSlugs = new Set();
      const normalizedTeams = [];

      for (const rawTeam of data.teams) {
        if (!rawTeam || rawTeam.deleted) continue;
        const tName = String(rawTeam.name || "").trim();
        if (!tName || tName.length > 80)
          fail("Todas as equipes precisam ter um nome de até 80 caracteres.");
        const slug = normalizeTeamSlug(rawTeam.slug || tName);
        if (seenSlugs.has(slug.toLowerCase()))
          fail(`URL duplicada entre equipes: /${slug}`, 409);
        seenSlugs.add(slug.toLowerCase());
        const tBatch =
          rawTeam.batch_size === undefined ? 1 : Number(rawTeam.batch_size);
        if (!Number.isInteger(tBatch) || tBatch < 1 || tBatch > 1000)
          fail(`O lote da equipe "${tName}" deve ser de 1 a 1000.`);
        const rawId = String(rawTeam.id || "");
        const isExisting = validID(rawId) && existingTeamIds.has(rawId);
        const resolvedId = isExisting ? rawId : uuid();
        if (rawId) teamIdMap.set(rawId, resolvedId);
        teamIdMap.set(resolvedId, resolvedId);

        const syncMode = normalizeSyncMode(rawTeam.sync_mode);

        normalizedTeams.push({
          id: resolvedId,
          isExisting,
          slug,
          name: tName,
          batch_size: tBatch,
          active: rawTeam.active === false || rawTeam.active === 0 ? 0 : 1,
          sync_mode: syncMode,
        });
      }

      const validTeamIds = new Set(normalizedTeams.map((t) => t.id));
      const seenPhoneInScope = new Set();
      const usedPositions = new Set();
      const normalizedAgents = [];

      for (const rawAgent of data.agents) {
        if (!rawAgent || rawAgent.deleted) continue;
        const aName = String(rawAgent.name || "").trim();
        if (!aName || aName.length > 80)
          fail("Todos os atendentes precisam ter um nome de até 80 caracteres.");
        const phone = normalizePhone(rawAgent.phone);

        let resolvedTeamId = null;
        if (rawAgent.team_id) {
          const mapped = teamIdMap.get(String(rawAgent.team_id)) || String(rawAgent.team_id);
          if (!validTeamIds.has(mapped))
            fail(`Equipe de destino inválida para ${aName}.`);
          resolvedTeamId = mapped;
        }

        const phoneScopeKey = `${resolvedTeamId || "__general__"}:${phone}`;
        if (seenPhoneInScope.has(phoneScopeKey))
          fail(`Telefone duplicado dentro da mesma equipe: ${phone}`, 409);
        seenPhoneInScope.add(phoneScopeKey);

        const rawId = String(rawAgent.id || "");
        const isExisting = validID(rawId) && existingAgentMap.has(rawId);
        const resolvedId = isExisting ? rawId : uuid();

        const reqPosNum = Number(rawAgent.position);
        let position =
          rawAgent.position !== undefined &&
          Number.isInteger(reqPosNum) &&
          reqPosNum >= 1 &&
          reqPosNum <= 1000000
            ? reqPosNum
            : isExisting
            ? existingAgentMap.get(rawId).position
            : ++nextPos;

        while (usedPositions.has(position)) {
          position = ++nextPos;
        }
        usedPositions.add(position);
        if (position > nextPos) nextPos = position;

        normalizedAgents.push({
          id: resolvedId,
          isExisting,
          name: aName,
          phone,
          position,
          active: rawAgent.active === false || rawAgent.active === 0 ? 0 : 1,
          team_id: resolvedTeamId,
        });
      }

      const afterScopeOrder = buildScopeOrder(normalizedAgents);
      const generalOrderChanged =
        (beforeScopeOrder.get("__general__") || "") !==
        (afterScopeOrder.get("__general__") || "");

      const keptTeamIds = new Set(normalizedTeams.filter((t) => t.isExisting).map((t) => t.id));
      const keptAgentIds = new Set(normalizedAgents.filter((a) => a.isExisting).map((a) => a.id));

      const stmts = [
        generalOrderChanged
          ? sql("UPDATE settings SET batch_size=?, cursor_agent=NULL, used=0 WHERE id=1", batchSize)
          : sql("UPDATE settings SET batch_size=? WHERE id=1", batchSize),
      ];

      // 1. Soft-delete agents removed from the board first so freed phones are immediately reusable
      for (const oldId of existingAgentMap.keys()) {
        if (!keptAgentIds.has(oldId)) {
          stmts.push(
            sql("UPDATE agents SET deleted=1,active=0,team_id=NULL WHERE id=?", oldId),
          );
        }
      }

      // 2. Soft-delete teams removed from the board (only moving non-deleted, non-colliding agents)
      for (const oldTeamId of existingTeamIds) {
        if (!keptTeamIds.has(oldTeamId)) {
          stmts.push(
            sql("UPDATE agents SET team_id=NULL WHERE team_id=? AND deleted=0", oldTeamId),
          );
          stmts.push(
            sql("UPDATE teams SET deleted=1,active=0 WHERE id=?", oldTeamId),
          );
        }
      }

      // 3. Upsert teams (resetting cursor when order or sync_mode changed)
      const now = Date.now();
      for (const t of normalizedTeams) {
        if (t.isExisting) {
          const prevSync = normalizeSyncMode(existingTeamMap.get(t.id)?.sync_mode);
          const isMirrored =
            t.sync_mode === "general_same" || t.sync_mode === "general_reverse";
          const teamOrderChanged =
            prevSync !== t.sync_mode ||
            (isMirrored
              ? generalOrderChanged
              : (beforeScopeOrder.get(t.id) || "") !== (afterScopeOrder.get(t.id) || ""));
          stmts.push(
            teamOrderChanged
              ? sql(
                  "UPDATE teams SET name=?,slug=?,batch_size=?,active=?,sync_mode=?,cursor_agent=NULL,used=0 WHERE id=? AND deleted=0",
                  t.name,
                  t.slug,
                  t.batch_size,
                  t.active,
                  t.sync_mode,
                  t.id,
                )
              : sql(
                  "UPDATE teams SET name=?,slug=?,batch_size=?,active=?,sync_mode=? WHERE id=? AND deleted=0",
                  t.name,
                  t.slug,
                  t.batch_size,
                  t.active,
                  t.sync_mode,
                  t.id,
                ),
          );
        } else {
          stmts.push(
            sql(
              "INSERT INTO teams(id,slug,name,batch_size,active,sync_mode,deleted,created_at) VALUES(?,?,?,?,?,?,0,?)",
              t.id,
              t.slug,
              t.name,
              t.batch_size,
              t.active,
              t.sync_mode,
              now,
            ),
          );
        }
      }

      // 4. Temporarily clear phones of kept existing agents to allow phone swaps within the same save
      for (const a of normalizedAgents) {
        if (a.isExisting) {
          stmts.push(
            sql("UPDATE agents SET phone=? WHERE id=? AND deleted=0", "__swap__" + a.id, a.id),
          );
        }
      }

      // 5. Upsert all agents with final values
      for (const a of normalizedAgents) {
        if (a.isExisting) {
          stmts.push(
            sql(
              "UPDATE agents SET name=?,phone=?,active=?,position=?,team_id=? WHERE id=? AND deleted=0",
              a.name,
              a.phone,
              a.active,
              a.position,
              a.team_id,
              a.id,
            ),
          );
        } else {
          stmts.push(
            sql(
              "INSERT INTO agents(id,name,phone,position,active,deleted,team_id) VALUES(?,?,?,?,?,0,?)",
              a.id,
              a.name,
              a.phone,
              a.position,
              a.active,
              a.team_id,
            ),
          );
        }
      }

      await db.batch(stmts);

      const savedSnapshot = await db.batch([
        sql("SELECT batch_size FROM settings WHERE id=1"),
        sql("SELECT * FROM agents WHERE deleted=0 ORDER BY position,id"),
        sql(
          "SELECT id,slug,name,batch_size,active,sync_mode,created_at FROM teams WHERE deleted=0 ORDER BY created_at,lower(name)",
        ),
      ]);

      return json({
        ok: true,
        batchSize: savedSnapshot[0].results[0].batch_size,
        agents: savedSnapshot[1].results,
        teams: savedSnapshot[2].results,
      });
    }
    if (path === "/api/admin/teams" && request.method === "POST") {
      const data = await body(request);
      const teamName = String(data.name || "").trim();
      if (!teamName || teamName.length > 80)
        fail("Informe um nome de equipe de até 80 caracteres.");
      const slug = normalizeTeamSlug(data.slug || teamName);
      const batchSize =
        data.batchSize === undefined ? 1 : Number(data.batchSize);
      if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 1000)
        fail("O lote da equipe deve ser de 1 a 1000.");
      const syncMode = normalizeSyncMode(data.syncMode || data.sync_mode);
      const existing = await sql(
        "SELECT 1 FROM teams WHERE lower(slug)=lower(?) AND deleted=0",
        slug,
      ).first();
      if (existing) fail("Já existe uma equipe com essa URL.", 409);
      const teamId = uuid();
      await sql(
        "INSERT INTO teams(id,slug,name,batch_size,active,sync_mode,deleted,created_at) VALUES(?,?,?,?,1,?,0,?)",
        teamId,
        slug,
        teamName,
        batchSize,
        syncMode,
        Date.now(),
      ).run();
      return json({
        ok: true,
        team: { id: teamId, slug, name: teamName, batch_size: batchSize, active: 1, sync_mode: syncMode },
      });
    }
    if (
      path.startsWith("/api/admin/teams/") &&
      ["PUT", "DELETE"].includes(request.method)
    ) {
      const id = path.split("/").pop();
      if (!validID(id)) fail("Equipe inválida.");
      if (request.method === "DELETE") {
        await db.batch([
          sql(
            `UPDATE agents SET deleted=1,active=0,team_id=NULL
             WHERE team_id=? AND deleted=0
               AND EXISTS(SELECT 1 FROM agents g WHERE g.team_id IS NULL AND g.deleted=0 AND g.phone=agents.phone)`,
            id,
          ),
          sql("UPDATE agents SET team_id=NULL WHERE team_id=? AND deleted=0", id),
          sql("UPDATE teams SET deleted=1,active=0 WHERE id=?", id),
        ]);
        return json({ ok: true });
      }
      const data = await body(request);
      const teamName = String(data.name || "").trim();
      const slug = normalizeTeamSlug(data.slug || teamName);
      const batchSize = Number(data.batchSize);
      const syncMode = normalizeSyncMode(data.syncMode || data.sync_mode);
      if (
        !teamName ||
        teamName.length > 80 ||
        typeof data.active !== "boolean" ||
        !Number.isInteger(batchSize) ||
        batchSize < 1 ||
        batchSize > 1000
      )
        fail("Dados da equipe inválidos.");
      const conflict = await sql(
        "SELECT 1 FROM teams WHERE lower(slug)=lower(?) AND deleted=0 AND id!=?",
        slug,
        id,
      ).first();
      if (conflict) fail("Já existe outra equipe com essa URL.", 409);
      await sql(
        "UPDATE teams SET name=?,slug=?,batch_size=?,active=?,sync_mode=? WHERE id=? AND deleted=0",
        teamName,
        slug,
        batchSize,
        data.active ? 1 : 0,
        syncMode,
        id,
      ).run();
      return json({ ok: true });
    }
    if (path === "/api/admin/agents/move" && request.method === "POST") {
      const data = await body(request);
      if (!validID(data.agentId)) fail("Atendente inválido.");
      const prevAgent = await sql(
        "SELECT team_id FROM agents WHERE id=? AND deleted=0",
        data.agentId,
      ).first();
      let targetTeamId = null;
      if (data.teamId) {
        if (!validID(data.teamId)) fail("Equipe de destino inválida.");
        const foundTeam = await sql(
          "SELECT 1 FROM teams WHERE id=? AND deleted=0",
          data.teamId,
        ).first();
        if (!foundTeam) fail("Equipe de destino não encontrada.", 404);
        targetTeamId = data.teamId;
      }
      const resetStmts = [
        sql(
          "UPDATE agents SET team_id=? WHERE id=? AND deleted=0",
          targetTeamId,
          data.agentId,
        ),
      ];
      if (!prevAgent?.team_id || !targetTeamId) {
        resetStmts.push(sql("UPDATE settings SET cursor_agent=NULL, used=0 WHERE id=1"));
        resetStmts.push(
          sql("UPDATE teams SET cursor_agent=NULL, used=0 WHERE deleted=0 AND sync_mode IN ('general_same','general_reverse')"),
        );
      }
      if (prevAgent?.team_id) {
        resetStmts.push(sql("UPDATE teams SET cursor_agent=NULL, used=0 WHERE id=?", prevAgent.team_id));
      }
      if (targetTeamId && targetTeamId !== prevAgent?.team_id) {
        resetStmts.push(sql("UPDATE teams SET cursor_agent=NULL, used=0 WHERE id=?", targetTeamId));
      }
      await db.batch(resetStmts);
      return json({ ok: true });
    }
    if (path === "/api/admin/agents" && request.method === "POST") {
      const data = await body(request),
        name = String(data.name || "").trim();
      if (!name || name.length > 80)
        fail("Informe um nome de até 80 caracteres.");
      const phone = normalizePhone(data.phone);
      let teamId = null;
      if (data.team_id) {
        if (!validID(data.team_id)) fail("Equipe inválida.");
        const foundTeam = await sql(
          "SELECT 1 FROM teams WHERE id=? AND deleted=0",
          data.team_id,
        ).first();
        if (!foundTeam) fail("Equipe não encontrada.", 404);
        teamId = data.team_id;
      }
      const addStmts = [
        sql(
          "INSERT INTO agents(id,name,phone,position,team_id) SELECT ?,?,?,COALESCE(MAX(position),0)+1,? FROM agents",
          uuid(),
          name,
          phone,
          teamId,
        ),
      ];
      if (!teamId) {
        addStmts.push(sql("UPDATE settings SET cursor_agent=NULL, used=0 WHERE id=1"));
        addStmts.push(
          sql("UPDATE teams SET cursor_agent=NULL, used=0 WHERE deleted=0 AND sync_mode IN ('general_same','general_reverse')"),
        );
      } else {
        addStmts.push(sql("UPDATE teams SET cursor_agent=NULL, used=0 WHERE id=?", teamId));
      }
      await db.batch(addStmts);
      return json({ ok: true });
    }
    if (
      path.startsWith("/api/admin/agents/") &&
      ["PUT", "DELETE"].includes(request.method)
    ) {
      const id = path.split("/").pop();
      if (!validID(id)) fail("Atendente inválido.");
      if (request.method === "DELETE") {
        await sql("UPDATE agents SET deleted=1,active=0 WHERE id=?", id).run();
        return json({ ok: true });
      }
      const data = await body(request),
        name = String(data.name || "").trim();
      if (
        !name ||
        name.length > 80 ||
        typeof data.active !== "boolean" ||
        !Number.isInteger(data.position) ||
        data.position < 0
      )
        fail("Dados do atendente inválidos.");
      let teamId = null;
      if (data.team_id) {
        if (!validID(data.team_id)) fail("Equipe inválida.");
        const foundTeam = await sql(
          "SELECT 1 FROM teams WHERE id=? AND deleted=0",
          data.team_id,
        ).first();
        if (!foundTeam) fail("Equipe não encontrada.", 404);
        teamId = data.team_id;
      }
      const prev = await sql(
        "SELECT active, position, team_id FROM agents WHERE id=? AND deleted=0",
        id,
      ).first();
      const nextActive = data.active ? 1 : 0;
      const routingChanged =
        prev &&
        (prev.active !== nextActive ||
          prev.position !== data.position ||
          (prev.team_id || null) !== teamId);
      const putStmts = [
        sql(
          "UPDATE agents SET name=?,phone=?,active=?,position=?,team_id=? WHERE id=? AND deleted=0",
          name,
          normalizePhone(data.phone),
          nextActive,
          data.position,
          teamId,
          id,
        ),
      ];
      if (routingChanged) {
        if (!prev.team_id || !teamId) {
          putStmts.push(sql("UPDATE settings SET cursor_agent=NULL, used=0 WHERE id=1"));
          putStmts.push(
            sql("UPDATE teams SET cursor_agent=NULL, used=0 WHERE deleted=0 AND sync_mode IN ('general_same','general_reverse')"),
          );
        }
        if (prev.team_id) {
          putStmts.push(sql("UPDATE teams SET cursor_agent=NULL, used=0 WHERE id=?", prev.team_id));
        }
        if (teamId && teamId !== prev.team_id) {
          putStmts.push(sql("UPDATE teams SET cursor_agent=NULL, used=0 WHERE id=?", teamId));
        }
      }
      await db.batch(putStmts);
      return json({ ok: true });
    }
    if (path === "/api/admin/stats" && request.method === "GET") {
      const now = Date.now(),
        today = rangeStart(1, now),
        yesterday = today - 86400000;
      const periods = [
        ["today", today, now + 1],
        ["yesterday", yesterday, today],
        ["7", rangeStart(7, now), now + 1],
        ["15", rangeStart(15, now), now + 1],
        ["30", rangeStart(30, now), now + 1],
        ["total", 0, now + 1],
      ];
      const selected = url.searchParams.get("period") || "today";
      const p = periods.find((x) => x[0] === selected);
      if (!p) fail("Período inválido.");
      const statements = periods.map(([, start, end]) =>
        sql(
          "SELECT COUNT(*) AS unique_clients FROM visitors WHERE created_at>=? AND created_at<?",
          start,
          end,
        ),
      );
      statements.push(
        sql(
          `SELECT a.id,a.name,a.phone,a.active,a.deleted,a.team_id,COUNT(d.id) AS deliveries,COALESCE(SUM(d.first_delivery),0) AS new_clients FROM agents a LEFT JOIN deliveries d ON d.agent_id=a.id AND d.created_at>=? AND d.created_at<? GROUP BY a.id ORDER BY a.position,a.id`,
          p[1],
          p[2],
        ),
      );
      const res = await db.batch(statements);
      return json({
        totals: Object.fromEntries(
          periods.map((p, i) => [p[0], res[i].results[0].unique_clients]),
        ),
        agents: res[6].results,
        period: selected,
        timeZone: "America/Sao_Paulo",
      });
    }
  }
  return json({ error: "Página não encontrada." }, 404);
}
export async function onRequest(context) {
  try {
    return await handle(context);
  } catch (e) {
    if (
      String(e).includes("UNIQUE constraint failed: agents.phone") ||
      String(e).includes("UNIQUE constraint failed: index 'agents_phone'")
    )
      return json({ error: "Esse telefone já está cadastrado nessa equipe." }, 409);
    if (String(e).includes("UNIQUE constraint failed: teams.slug") || String(e).includes("UNIQUE constraint failed: teams"))
      return json({ error: "Já existe uma equipe com essa URL." }, 409);
    if (e.status) return json({ error: e.message }, e.status);
    console.error("Falha na API de atendimento");
    return json(
      { error: "Serviço indisponível. Tente novamente em instantes." },
      503,
    );
  }
}
