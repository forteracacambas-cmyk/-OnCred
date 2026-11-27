import fs from 'fs';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {fileURLToPath} from 'url';
import {defineConfig} from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEV_STATE_FILE = path.resolve(__dirname, '.dev-panel-state.json');

const RESERVED_TEAM_SLUGS = new Set([
  'painel',
  'contato',
  'simulacao',
  'simular',
  'api',
  'atendente',
  'atendimento',
  'politica-de-privacidade',
  'termos-de-uso',
  'assets',
  'doc',
  'favicon',
  'robots',
  'sitemap',
]);

function normalizeDevSlug(input: any) {
  const s = String(input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!s || !/^[a-z0-9][a-z0-9_-]{0,48}$/.test(s) || RESERVED_TEAM_SLUGS.has(s) || /^atend(?:imento|ente)\d+$/i.test(s)) {
    return null;
  }
  return s;
}

function normalizeDevPhone(input: any) {
  let n = String(input || '').replace(/\D/g, '').replace(/^0+/, '');
  if (n.length === 10 || n.length === 11) n = '55' + n;
  if (!/^55[1-9][0-9]\d{8,9}$/.test(n)) return null;
  return n;
}

function devApiPlugin() {
  const VALID_SYNC_MODES = new Set(['independent', 'general_same', 'general_reverse']);
  const normalizeSync = (v: any) => (VALID_SYNC_MODES.has(v) ? v : 'independent');

  const getSpDayKey = () =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(Date.now());

  const defaultState = () => ({
    devTeams: [
      { id: "11111111-1111-1111-1111-111111111111", slug: "equipe1", name: "Equipe 1", batch_size: 1, active: 1, sync_mode: "independent", deleted: 0, cursorAgent: null as string | null, used: 0 },
    ],
    devAgents: [
      { id: "22222222-2222-2222-2222-222222222201", name: "Atendente Comercial 1", phone: "551130420181", position: 1, active: 1, deleted: 0, team_id: null },
      { id: "22222222-2222-2222-2222-222222222202", name: "Atendente Comercial 2", phone: "551130420182", position: 2, active: 1, deleted: 0, team_id: "11111111-1111-1111-1111-111111111111" },
    ],
    batchSize: 1,
    generalCursorAgent: null as string | null,
    generalUsed: 0,
    dayKey: getSpDayKey(),
    devDeliveries: {} as Record<string, number>,
    devCatchup: [] as Array<{ scope_key: string; agent_id: string; remaining: number; created_at: number }>,
    devSessions: [] as Array<{ token: string; expires: number }>,
  });

  const loadState = () => {
    try {
      if (fs.existsSync(DEV_STATE_FILE)) {
        const parsed = JSON.parse(fs.readFileSync(DEV_STATE_FILE, 'utf8'));
        if (parsed && Array.isArray(parsed.devTeams) && Array.isArray(parsed.devAgents)) {
          return {
            ...defaultState(),
            ...parsed,
            devDeliveries: parsed.devDeliveries && typeof parsed.devDeliveries === 'object' ? parsed.devDeliveries : {},
            devCatchup: Array.isArray(parsed.devCatchup) ? parsed.devCatchup : [],
            devSessions: Array.isArray(parsed.devSessions) ? parsed.devSessions : [],
          };
        }
      }
    } catch {}
    return defaultState();
  };

  let state = loadState();
  const ensureTodayCounters = () => {
    const today = getSpDayKey();
    if (state.dayKey !== today) {
      state.dayKey = today;
      state.devDeliveries = {};
      state.devCatchup = [];
    }
  };
  const persistState = () => {
    try {
      fs.writeFileSync(DEV_STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
    } catch {}
  };

  const DEV_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
  const extractAdminCookie = (req: any) =>
    String(req.headers?.cookie || '')
      .match(/(?:^|;\s*)oncred_admin=([0-9a-f-]{16,120})(?:;|$)/i)?.[1] || '';

  const pruneScopeCatchups = (scopeKey: string, pool: any[]) => {
    const poolIds = new Set(pool.map((a: any) => a.id));
    state.devCatchup = (state.devCatchup || []).filter((c: any) => {
      if (c.scope_key !== scopeKey) return true;
      if (Number(c.remaining) <= 0 || !poolIds.has(c.agent_id)) return false;
      const aCnt = Number(state.devDeliveries[c.agent_id] || 0);
      let maxOther = 0;
      for (const b of pool) {
        if (b.id !== c.agent_id) {
          const bc = Number(state.devDeliveries[b.id] || 0);
          if (bc > maxOther) maxOther = bc;
        }
      }
      return aCnt < maxOther;
    });
  };

  const computeDevQueuePreview = (
    scopeKey: string,
    pool: any[],
    batchSize: number,
    cursorAgentId: string | null | undefined,
    used: number,
    reverse: boolean,
    allAgentsInScope: any[],
  ) => {
    ensureTodayCounters();
    const cleanBatch = Math.max(1, Number(batchSize) || 1);
    const cleanUsed = Math.max(0, Number(used) || 0);
    const sortedPool = [...pool].sort((a, b) =>
      reverse
        ? (b.position - a.position) || String(b.id).localeCompare(String(a.id))
        : (a.position - b.position) || String(a.id).localeCompare(String(b.id)),
    );
    if (sortedPool.length === 0) {
      return { activeCount: 0, batchSize: cleanBatch, maxToday: 0, receivingNow: null, nextUp: null };
    }
    const counts = new Map<string, number>();
    let initialMaxToday = 0;
    for (const a of sortedPool) {
      const c = Number(state.devDeliveries[a.id] || 0);
      counts.set(a.id, c);
      if (c > initialMaxToday) initialMaxToday = c;
    }
    const poolById = new Map(sortedPool.map((a) => [a.id, a]));
    const scopeById = new Map<string, any>();
    for (const a of allAgentsInScope) scopeById.set(a.id, a);
    for (const a of sortedPool) scopeById.set(a.id, a);

    const catchupQueue = (state.devCatchup || [])
      .filter((c: any) => c.scope_key === scopeKey && Number(c.remaining) > 0 && poolById.has(c.agent_id))
      .map((c: any) => ({
        agent: poolById.get(c.agent_id),
        remaining: Number(c.remaining),
        createdAt: Number(c.created_at || 0),
      }))
      .sort((a: any, b: any) => {
        if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt;
        return reverse
          ? (b.agent.position - a.agent.position) || String(a.agent.id).localeCompare(String(b.agent.id))
          : (a.agent.position - b.agent.position) || String(a.agent.id).localeCompare(String(b.agent.id));
      });

    const pruneSim = () => {
      for (let i = catchupQueue.length - 1; i >= 0; i--) {
        const item = catchupQueue[i];
        let maxOther = 0;
        for (const a of sortedPool) {
          if (a.id !== item.agent.id) {
            const val = counts.get(a.id) || 0;
            if (val > maxOther) maxOther = val;
          }
        }
        if (item.remaining <= 0 || (counts.get(item.agent.id) || 0) >= maxOther) {
          catchupQueue.splice(i, 1);
        }
      }
    };
    pruneSim();

    let simCursorId = cursorAgentId || null;
    let simUsed = cleanUsed;

    const stepOne = () => {
      pruneSim();
      if (catchupQueue.length > 0) {
        const head = catchupQueue[0];
        let maxOther = 0;
        for (const a of sortedPool) {
          if (a.id !== head.agent.id) {
            const val = counts.get(a.id) || 0;
            if (val > maxOther) maxOther = val;
          }
        }
        const effRem = Math.min(head.remaining, Math.max(0, maxOther - (counts.get(head.agent.id) || 0)));
        counts.set(head.agent.id, (counts.get(head.agent.id) || 0) + 1);
        head.remaining -= 1;
        pruneSim();
        if (catchupQueue.length === 0) {
          simCursorId = null;
          simUsed = 0;
        }
        return {
          selected: head.agent,
          equalizing: true,
          remainingBeforeStep: effRem,
          usedInBatch: Math.max(0, Math.min(cleanBatch, cleanBatch - effRem)),
        };
      }

      const activeCursor = simCursorId ? poolById.get(simCursorId) : undefined;
      if (simUsed < cleanBatch && activeCursor) {
        const usedBefore = simUsed;
        simUsed = usedBefore + 1;
        counts.set(activeCursor.id, (counts.get(activeCursor.id) || 0) + 1);
        return {
          selected: activeCursor,
          equalizing: false,
          remainingBeforeStep: cleanBatch - usedBefore,
          usedInBatch: usedBefore,
        };
      }

      const cursorRef = simCursorId ? scopeById.get(simCursorId) : undefined;
      let chosen = sortedPool[0];
      if (cursorRef) {
        const after = sortedPool.find((a) =>
          reverse
            ? a.position < cursorRef.position || (a.position === cursorRef.position && String(a.id) < String(cursorRef.id))
            : a.position > cursorRef.position || (a.position === cursorRef.position && String(a.id) > String(cursorRef.id)),
        );
        if (after) chosen = after;
      }
      simCursorId = chosen.id;
      simUsed = 1;
      counts.set(chosen.id, (counts.get(chosen.id) || 0) + 1);
      return {
        selected: chosen,
        equalizing: false,
        remainingBeforeStep: cleanBatch,
        usedInBatch: 0,
      };
    };

    const firstStep = stepOne();
    const firstAgent = firstStep.selected;
    const initialFirstToday = Number(state.devDeliveries[firstAgent.id] || 0);
    const initialMissing = firstStep.equalizing ? firstStep.remainingBeforeStep : 0;

    let consecutiveCount = 1;
    let nextCandidate: any = null;
    if (sortedPool.length > 1) {
      const maxSimSteps = cleanBatch * 2 + 10;
      for (let step = 0; step < maxSimSteps && step < 2500; step++) {
        const nextStep = stepOne();
        if (nextStep.selected.id !== firstAgent.id) {
          nextCandidate = {
            agent: nextStep.selected,
            equalizing: nextStep.equalizing,
            missing: nextStep.equalizing ? nextStep.remainingBeforeStep : 0,
          };
          break;
        }
        consecutiveCount++;
      }
    }

    return {
      activeCount: sortedPool.length,
      batchSize: cleanBatch,
      maxToday: initialMaxToday,
      receivingNow: {
        id: firstAgent.id,
        name: firstAgent.name,
        phone: firstAgent.phone,
        todayCount: initialFirstToday,
        usedInBatch: firstStep.usedInBatch,
        batchSize: cleanBatch,
        remainingToSwitch: sortedPool.length > 1 ? consecutiveCount : null,
        equalizing: firstStep.equalizing,
        missingToEqualize: initialMissing,
      },
      nextUp: nextCandidate
        ? {
            id: nextCandidate.agent.id,
            name: nextCandidate.agent.name,
            todayCount: Number(state.devDeliveries[nextCandidate.agent.id] || 0),
            equalizing: nextCandidate.equalizing,
            missingToEqualize: nextCandidate.missing,
          }
        : null,
    };
  };

  const selectOrderedAgent = (
    scopeKey: string,
    pool: any[],
    cursorId: string | null | undefined,
    used: number,
    batchSize: number,
    reverse = false,
  ) => {
    ensureTodayCounters();
    const cleanBatch = Math.max(1, Number(batchSize) || 1);
    const sorted = [...pool].sort((a, b) =>
      reverse
        ? (b.position - a.position) || String(b.id).localeCompare(String(a.id))
        : (a.position - b.position) || String(a.id).localeCompare(String(b.id)),
    );
    const poolById = new Map(sorted.map((a) => [a.id, a]));
    pruneScopeCatchups(scopeKey, sorted);

    const activeCatchups = (state.devCatchup || [])
      .filter((c: any) => c.scope_key === scopeKey && Number(c.remaining) > 0 && poolById.has(c.agent_id))
      .sort((a: any, b: any) => {
        if ((a.created_at || 0) !== (b.created_at || 0)) return (a.created_at || 0) - (b.created_at || 0);
        const agA = poolById.get(a.agent_id);
        const agB = poolById.get(b.agent_id);
        return reverse
          ? (agB.position - agA.position) || String(agA.id).localeCompare(String(agB.id))
          : (agA.position - agB.position) || String(agA.id).localeCompare(String(agB.id));
      });

    if (activeCatchups.length > 0) {
      const head = activeCatchups[0];
      const chosen = poolById.get(head.agent_id);
      head.remaining = Number(head.remaining) - 1;
      state.devDeliveries[chosen.id] = (state.devDeliveries[chosen.id] || 0) + 1;
      state.devCatchup = (state.devCatchup || []).filter(
        (c: any) => !(c.scope_key === scopeKey && Number(c.remaining) <= 0),
      );
      const stillHasCatchup = (state.devCatchup || []).some(
        (c: any) => c.scope_key === scopeKey && Number(c.remaining) > 0,
      );
      return {
        selected: chosen,
        nextCursor: stillHasCatchup ? (cursorId || null) : null,
        nextUsed: stillHasCatchup ? used : 0,
      };
    }

    const activeCursor = cursorId ? sorted.find((a) => a.id === cursorId) : undefined;
    if (used < cleanBatch && activeCursor) {
      state.devDeliveries[activeCursor.id] = (state.devDeliveries[activeCursor.id] || 0) + 1;
      return { selected: activeCursor, nextCursor: activeCursor.id, nextUsed: used + 1 };
    }
    const cursorRef = cursorId ? state.devAgents.find((a: any) => a.id === cursorId) : undefined;
    let chosen = sorted[0];
    if (cursorRef) {
      const after = sorted.find((a) =>
        reverse
          ? a.position < cursorRef.position || (a.position === cursorRef.position && String(a.id) < String(cursorRef.id))
          : a.position > cursorRef.position || (a.position === cursorRef.position && String(a.id) > String(cursorRef.id)),
      );
      if (after) chosen = after;
    }
    state.devDeliveries[chosen.id] = (state.devDeliveries[chosen.id] || 0) + 1;
    return { selected: chosen, nextCursor: chosen.id, nextUsed: 1 };
  };

  const readJson = (req: any): Promise<any> =>
    new Promise((resolve) => {
      let bodyStr = '';
      req.on('data', (chunk: any) => { bodyStr += chunk; });
      req.on('end', () => {
        try { resolve(JSON.parse(bodyStr || '{}')); } catch { resolve({}); }
      });
    });

  const apiMiddleware = async (req: any, res: any, next: any) => {
        if (!req.url?.startsWith('/api/')) return next();
        const url = new URL(req.url, 'http://localhost');
        const pathname = url.pathname.replace(/\/$/, '');
        const isHttps =
          req.headers?.['x-forwarded-proto'] === 'https' ||
          String(req.headers?.origin || '').startsWith('https://');
        const adminCookieFlags = isHttps
          ? '; HttpOnly; Secure; SameSite=None; Partitioned'
          : '; HttpOnly; SameSite=Lax';

        res.setHeader('Content-Type', 'application/json');

        if (pathname === '/api/visitor') {
          res.setHeader(
            'Set-Cookie',
            `oncred_visitor=00000000-0000-0000-0000-000000000001; Path=/; SameSite=Lax${isHttps ? '; Secure' : ''}`,
          );
          res.end(JSON.stringify({ ready: true }));
          return;
        }

        if (pathname === '/api/team' && req.method === 'GET') {
          const slug = String(url.searchParams.get('slug') || '').trim();
          const team = state.devTeams.find((t: any) => !t.deleted && (t.id === slug || t.slug.toLowerCase() === slug.toLowerCase()));
          if (!team) {
            res.statusCode = 404;
            res.end(JSON.stringify({ exists: false, online: false, error: 'Equipe não encontrada.' }));
            return;
          }
          const syncMode = normalizeSync(team.sync_mode);
          const isMirrored = syncMode === 'general_same' || syncMode === 'general_reverse';
          const agentCount = isMirrored
            ? state.devAgents.filter((a: any) => !a.deleted && a.active && !a.team_id).length
            : state.devAgents.filter((a: any) => !a.deleted && a.active && a.team_id === team.id).length;
          const active = !!team.active;
          res.end(JSON.stringify({
            exists: true,
            active,
            online: active && agentCount > 0,
            slug: team.slug,
            name: team.name,
            syncMode,
            agentCount,
          }));
          return;
        }

        if (pathname === '/api/route' && req.method === 'POST') {
          const data = await readJson(req);
          let selected: any;
          let teamObj: any = null;
          const specificAgent = data.agent ? String(data.agent).trim() : null;
          const specificTeam = data.team ? String(data.team).trim() : null;

          if (specificAgent) {
            const ordinalMatch = specificAgent.match(/^(?:atendimento|atendente)?([1-9]\d*)$/i);
            const pos = ordinalMatch ? parseInt(ordinalMatch[1], 10) : -1;
            const found = state.devAgents.find((a: any) =>
              !a.deleted && (
                a.id === specificAgent ||
                a.position === pos ||
                `atendimento${a.position}` === specificAgent.toLowerCase() ||
                `atendente${a.position}` === specificAgent.toLowerCase()
              )
            );
            if (!found) {
              res.statusCode = 404;
              res.end(JSON.stringify({ error: "Atendente não encontrado." }));
              return;
            }
            if (!found.active) {
              res.statusCode = 409;
              res.end(JSON.stringify({ error: "Atendente temporariamente indisponível." }));
              return;
            }
            ensureTodayCounters();
            state.devDeliveries[found.id] = (state.devDeliveries[found.id] || 0) + 1;
            persistState();
            selected = found;
          } else if (specificTeam) {
            teamObj = state.devTeams.find((t: any) => !t.deleted && (t.id === specificTeam || t.slug.toLowerCase() === specificTeam.toLowerCase()));
            if (!teamObj) {
              res.statusCode = 404;
              res.end(JSON.stringify({ error: "Equipe não encontrada." }));
              return;
            }
            if (!teamObj.active) {
              res.statusCode = 409;
              res.end(JSON.stringify({ error: "Equipe temporariamente indisponível." }));
              return;
            }
            const syncMode = normalizeSync(teamObj.sync_mode);
            const pool =
              syncMode === 'general_reverse' || syncMode === 'general_same'
                ? state.devAgents.filter((a: any) => !a.deleted && a.active && !a.team_id)
                : state.devAgents.filter((a: any) => !a.deleted && a.active && a.team_id === teamObj.id);
            if (!pool.length) {
              res.statusCode = 503;
              res.end(JSON.stringify({ error: `Nenhum atendente disponível na equipe ${teamObj.name} no momento.` }));
              return;
            }
            const pick = selectOrderedAgent(
              teamObj.id,
              pool,
              teamObj.cursorAgent,
              Number(teamObj.used || 0),
              Number(teamObj.batch_size || 1),
              syncMode === 'general_reverse',
            );
            selected = pick.selected;
            teamObj.cursorAgent = pick.nextCursor;
            teamObj.used = pick.nextUsed;
            persistState();
          } else {
            const pool = state.devAgents.filter((a: any) => !a.deleted && a.active && !a.team_id);
            if (!pool.length) {
              res.statusCode = 503;
              res.end(JSON.stringify({ error: "Nenhum atendente disponível no momento." }));
              return;
            }
            const pick = selectOrderedAgent(
              '__general__',
              pool,
              state.generalCursorAgent,
              Number(state.generalUsed || 0),
              Number(state.batchSize || 1),
              false,
            );
            selected = pick.selected;
            state.generalCursorAgent = pick.nextCursor;
            state.generalUsed = pick.nextUsed;
            persistState();
          }

          res.end(JSON.stringify({
            phone: selected.phone,
            name: selected.name,
            ...(teamObj ? { teamName: teamObj.name, isTeam: true } : {}),
            eventId: 'dev-event-' + Date.now(),
            trackContact: true,
            isDirect: !!specificAgent,
          }));
          return;
        }

        if (pathname === '/api/login' && req.method === 'POST') {
          const data = await readJson(req);
          const expected = process.env.ADMIN_PASSWORD;
          if (typeof data.password !== 'string' || !data.password || (expected && data.password !== expected)) {
            res.statusCode = 401;
            res.end(JSON.stringify({ error: 'Senha incorreta.' }));
            return;
          }
          const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
          const expires = Date.now() + DEV_SESSION_TTL_MS;
          state.devSessions = (state.devSessions || []).filter((s: any) => s.expires > Date.now());
          state.devSessions.push({ token, expires });
          persistState();
          res.setHeader(
            'Set-Cookie',
            `oncred_admin=${token}; Path=/api/admin${adminCookieFlags}; Max-Age=${Math.floor(DEV_SESSION_TTL_MS / 1000)}`,
          );
          res.end(JSON.stringify({ token, expires }));
          return;
        }

        if (pathname.startsWith('/api/admin/')) {
          const bearer = String(req.headers?.authorization || '').replace(/^Bearer /, '');
          const cookieToken = extractAdminCookie(req);
          const tok = bearer || cookieToken;
          const now = Date.now();
          state.devSessions = (state.devSessions || []).filter((s: any) => s.expires > now);
          const validSession = tok && state.devSessions.find((s: any) => s.token === tok);
          if (!validSession) {
            res.statusCode = 401;
            res.end(JSON.stringify({ error: 'Entre novamente no painel.' }));
            return;
          }
        }

        if (pathname === '/api/admin/logout' && req.method === 'POST') {
          const bearer = String(req.headers?.authorization || '').replace(/^Bearer /, '');
          const tok = bearer || extractAdminCookie(req);
          state.devSessions = (state.devSessions || []).filter((s: any) => s.token !== tok);
          persistState();
          res.setHeader('Set-Cookie', `oncred_admin=; Path=/api/admin${adminCookieFlags}; Max-Age=0`);
          res.end(JSON.stringify({ ok: true }));
          return;
        }

        if (pathname === '/api/admin/clear-history' && req.method === 'POST') {
          state.generalCursorAgent = null;
          state.generalUsed = 0;
          state.devDeliveries = {};
          state.devCatchup = [];
          state.devTeams.forEach((t: any) => { t.cursorAgent = null; t.used = 0; });
          persistState();
          res.end(JSON.stringify({ ok: true }));
          return;
        }

        if (pathname === '/api/admin/config') {
          if (req.method === 'PUT') {
            const data = await readJson(req);
            if (Number.isInteger(data.batchSize) && data.batchSize >= 1) state.batchSize = data.batchSize;
            persistState();
            res.end(JSON.stringify({ ok: true }));
            return;
          }
          res.end(JSON.stringify({
            batchSize: state.batchSize,
            agents: [...state.devAgents]
              .filter((a: any) => !a.deleted)
              .sort((a: any, b: any) => (a.position - b.position) || String(a.id).localeCompare(String(b.id))),
            teams: state.devTeams.filter((t: any) => !t.deleted),
          }));
          return;
        }

        if (pathname === '/api/admin/save' && req.method === 'POST') {
          const data = await readJson(req);
          const nextBatch = Number(data.batchSize);
          if (!Number.isInteger(nextBatch) || nextBatch < 1 || nextBatch > 1000) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: "O lote do Site Principal deve ser de 1 a 1000." }));
            return;
          }

          const buildDevOrder = (rows: any[]) => {
            const map = new Map<string, string[]>();
            const sorted = [...rows]
              .filter((r) => !r.deleted && r.active)
              .sort((a, b) => (a.position - b.position) || String(a.id).localeCompare(String(b.id)));
            for (const r of sorted) {
              const key = r.team_id || '__general__';
              if (!map.has(key)) map.set(key, []);
              map.get(key)!.push(r.id);
            }
            return new Map([...map.entries()].map(([k, ids]) => [k, ids.join(',')]));
          };
          const beforeOrder = buildDevOrder(state.devAgents);

          const teamIdMap = new Map<string, string>();
          const seenSlugs = new Set<string>();
          const newTeams: any[] = [];
          for (const rawT of (data.teams || [])) {
            if (!rawT || rawT.deleted) continue;
            const slug = normalizeDevSlug(rawT.slug || rawT.name);
            if (!slug) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: "URL da equipe inválida ou reservada." }));
              return;
            }
            if (seenSlugs.has(slug)) {
              res.statusCode = 409;
              res.end(JSON.stringify({ error: `URL duplicada entre equipes: /${slug}` }));
              return;
            }
            seenSlugs.add(slug);
            const existing = state.devTeams.find((x: any) => x.id === rawT.id && !x.deleted);
            const id = existing ? existing.id : crypto.randomUUID();
            if (rawT.id) teamIdMap.set(String(rawT.id), id);
            newTeams.push({
              id,
              slug,
              name: String(rawT.name || slug).trim(),
              batch_size: Number(rawT.batch_size) || 1,
              active: rawT.active === false || rawT.active === 0 ? 0 : 1,
              sync_mode: normalizeSync(rawT.sync_mode),
              deleted: 0,
              cursorAgent: existing?.cursorAgent ?? null,
              used: Number(existing?.used || 0),
            });
          }

          let maxPos = state.devAgents.reduce((m: number, a: any) => Math.max(m, a.position || 0), 0);
          const seenPhoneInScope = new Set<string>();
          const usedPos = new Set<number>();
          const newAgents: any[] = [];
          for (const rawA of (data.agents || [])) {
            if (!rawA || rawA.deleted) continue;
            const phone = normalizeDevPhone(rawA.phone);
            if (!phone) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: `Telefone inválido para ${rawA.name || 'atendente'}. Informe DDD + número.` }));
              return;
            }
            const existing = state.devAgents.find((x: any) => x.id === rawA.id && !x.deleted);
            const resolvedTeam = rawA.team_id ? (teamIdMap.get(String(rawA.team_id)) || rawA.team_id) : null;
            const phoneScopeKey = `${resolvedTeam || '__general__'}:${phone}`;
            if (seenPhoneInScope.has(phoneScopeKey)) {
              res.statusCode = 409;
              res.end(JSON.stringify({ error: `Telefone duplicado dentro da mesma equipe: ${phone}` }));
              return;
            }
            seenPhoneInScope.add(phoneScopeKey);
            const reqPos = Number(rawA.position);
            let pos = rawA.position !== undefined && Number.isInteger(reqPos) && reqPos >= 1 && reqPos <= 1000000
              ? reqPos
              : existing
              ? existing.position
              : ++maxPos;
            while (usedPos.has(pos)) pos = ++maxPos;
            usedPos.add(pos);
            if (pos > maxPos) maxPos = pos;

            newAgents.push({
              id: existing ? existing.id : crypto.randomUUID(),
              name: String(rawA.name || '').trim(),
              phone,
              position: pos,
              active: rawA.active === false || rawA.active === 0 ? 0 : 1,
              deleted: 0,
              team_id: resolvedTeam,
            });
          }

          newAgents.sort((a, b) => (a.position - b.position) || String(a.id).localeCompare(String(b.id)));
          const afterOrder = buildDevOrder(newAgents);
          const generalChanged = (beforeOrder.get('__general__') || '') !== (afterOrder.get('__general__') || '');
          if (generalChanged) {
            state.generalCursorAgent = null;
            state.generalUsed = 0;
          }
          for (const t of newTeams) {
            const prevT = state.devTeams.find((x: any) => x.id === t.id);
            const isMirrored = t.sync_mode === 'general_same' || t.sync_mode === 'general_reverse';
            if (
              normalizeSync(prevT?.sync_mode) !== t.sync_mode ||
              (isMirrored ? generalChanged : (beforeOrder.get(t.id) || '') !== (afterOrder.get(t.id) || ''))
            ) {
              t.cursorAgent = null;
              t.used = 0;
            }
          }

          const prevAgentsMap = new Map(state.devAgents.filter((a: any) => !a.deleted).map((a: any) => [a.id, a]));
          const prevCatchupMap = new Map(
            (state.devCatchup || []).map((c: any) => [`${c.scope_key}:${c.agent_id}`, c]),
          );
          ensureTodayCounters();
          const nextCatchup: Array<{ scope_key: string; agent_id: string; remaining: number; created_at: number }> = [];
          const devScopes = [
            {
              scopeKey: '__general__',
              batchSize: nextBatch,
              pool: newAgents.filter((a: any) => a.active === 1 && !a.team_id),
              isMirrored: false,
            },
            ...newTeams.map((t: any) => {
              const isMirrored = t.sync_mode === 'general_same' || t.sync_mode === 'general_reverse';
              return {
                scopeKey: t.id,
                batchSize: Number(t.batch_size || 1),
                pool: t.active
                  ? newAgents.filter((a: any) => a.active === 1 && (isMirrored ? !a.team_id : a.team_id === t.id))
                  : [],
                isMirrored,
              };
            }),
          ];
          let seq = Date.now();
          for (const sc of devScopes) {
            if (sc.pool.length < 2) continue;
            for (const a of sc.pool) {
              const aToday = Number(state.devDeliveries[a.id] || 0);
              let maxOther = 0;
              for (const b of sc.pool) {
                if (b.id !== a.id) {
                  const bt = Number(state.devDeliveries[b.id] || 0);
                  if (bt > maxOther) maxOther = bt;
                }
              }
              const gap = Math.max(0, maxOther - aToday);
              if (gap <= 0) continue;
              const prevA: any = prevAgentsMap.get(a.id);
              const prevScopeKey = prevA ? (prevA.team_id || '__general__') : null;
              const enteredScope =
                !prevA ||
                prevA.active === 0 ||
                (!sc.isMirrored && prevScopeKey !== sc.scopeKey) ||
                (sc.isMirrored && !!prevA.team_id);
              const prevC: any = prevCatchupMap.get(`${sc.scopeKey}:${a.id}`);
              let remaining = 0;
              let createdAt = seq++;
              if (enteredScope) {
                remaining = Math.min(gap, sc.batchSize);
              } else if (prevC && Number(prevC.remaining) > 0) {
                remaining = Math.min(Number(prevC.remaining), gap, sc.batchSize);
                createdAt = Number(prevC.created_at || createdAt);
              }
              if (remaining > 0) {
                nextCatchup.push({ scope_key: sc.scopeKey, agent_id: a.id, remaining, created_at: createdAt });
              }
            }
          }

          state.batchSize = nextBatch;
          state.devTeams = newTeams;
          state.devAgents = newAgents;
          state.devCatchup = nextCatchup;
          persistState();
          res.end(JSON.stringify({
            ok: true,
            batchSize: state.batchSize,
            agents: state.devAgents,
            teams: state.devTeams,
          }));
          return;
        }

        if (pathname === '/api/admin/teams' && req.method === 'POST') {
          const data = await readJson(req);
          const slug = normalizeDevSlug(data.slug || data.name);
          if (!slug) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: "URL da equipe inválida ou reservada." }));
            return;
          }
          if (state.devTeams.some((t: any) => !t.deleted && t.slug.toLowerCase() === slug)) {
            res.statusCode = 409;
            res.end(JSON.stringify({ error: "Já existe uma equipe com essa URL." }));
            return;
          }
          const team = {
            id: crypto.randomUUID(),
            slug,
            name: String(data.name || slug).trim(),
            batch_size: Number(data.batchSize) || 1,
            active: 1,
            sync_mode: normalizeSync(data.syncMode || data.sync_mode),
            deleted: 0,
            cursorAgent: null,
            used: 0,
          };
          state.devTeams.push(team);
          persistState();
          res.end(JSON.stringify({ ok: true, team }));
          return;
        }

        if (pathname.startsWith('/api/admin/teams/')) {
          const id = pathname.split('/').pop();
          const team = state.devTeams.find((t: any) => t.id === id && !t.deleted);
          if (!team) {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: "Equipe não encontrada." }));
            return;
          }
          if (req.method === 'DELETE') {
            team.deleted = 1;
            team.active = 0;
            const generalPhones = new Set(
              state.devAgents
                .filter((a: any) => !a.deleted && !a.team_id)
                .map((a: any) => a.phone),
            );
            state.devAgents.forEach((a: any) => {
              if (a.team_id === id && !a.deleted) {
                if (generalPhones.has(a.phone)) {
                  a.deleted = 1;
                  a.active = 0;
                  a.team_id = null;
                } else {
                  a.team_id = null;
                  generalPhones.add(a.phone);
                }
              }
            });
            persistState();
            res.end(JSON.stringify({ ok: true }));
            return;
          }
          if (req.method === 'PUT') {
            const data = await readJson(req);
            team.name = String(data.name || team.name).trim();
            team.slug = normalizeDevSlug(data.slug || team.slug) || team.slug;
            team.batch_size = Number(data.batchSize) || 1;
            team.active = data.active ? 1 : 0;
            if (data.syncMode || data.sync_mode) team.sync_mode = normalizeSync(data.syncMode || data.sync_mode);
            persistState();
            res.end(JSON.stringify({ ok: true }));
            return;
          }
        }

        const resetScopeCursor = (teamId: string | null) => {
          if (!teamId) {
            state.generalCursorAgent = null;
            state.generalUsed = 0;
            state.devTeams.forEach((t: any) => {
              const sm = normalizeSync(t.sync_mode);
              if (sm === 'general_same' || sm === 'general_reverse') {
                t.cursorAgent = null;
                t.used = 0;
              }
            });
          } else {
            const tm = state.devTeams.find((t: any) => t.id === teamId);
            if (tm) {
              tm.cursorAgent = null;
              tm.used = 0;
            }
          }
        };

        const addCatchupForDevAgent = (agentObj: any, targetTeamId: string | null) => {
          ensureTodayCounters();
          state.devCatchup = (state.devCatchup || []).filter((c: any) => c.agent_id !== agentObj.id);
          if (!agentObj.active) return;
          const nowTs = Date.now();
          const aToday = Number(state.devDeliveries[agentObj.id] || 0);
          if (!targetTeamId) {
            const others = state.devAgents.filter((a: any) => !a.deleted && a.active && !a.team_id && a.id !== agentObj.id);
            const maxOther = others.reduce((m: number, a: any) => Math.max(m, Number(state.devDeliveries[a.id] || 0)), 0);
            const gap = Math.max(0, maxOther - aToday);
            if (gap > 0) {
              state.devCatchup.push({
                scope_key: '__general__',
                agent_id: agentObj.id,
                remaining: Math.min(gap, Number(state.batchSize || 1)),
                created_at: nowTs,
              });
              for (const t of state.devTeams.filter((x: any) => !x.deleted && x.active)) {
                const sm = normalizeSync(t.sync_mode);
                if (sm === 'general_same' || sm === 'general_reverse') {
                  state.devCatchup.push({
                    scope_key: t.id,
                    agent_id: agentObj.id,
                    remaining: Math.min(gap, Number(t.batch_size || 1)),
                    created_at: nowTs,
                  });
                }
              }
            }
          } else {
            const tm = state.devTeams.find((t: any) => t.id === targetTeamId && !t.deleted && t.active);
            if (!tm) return;
            const others = state.devAgents.filter((a: any) => !a.deleted && a.active && a.team_id === targetTeamId && a.id !== agentObj.id);
            const maxOther = others.reduce((m: number, a: any) => Math.max(m, Number(state.devDeliveries[a.id] || 0)), 0);
            const gap = Math.max(0, maxOther - aToday);
            if (gap > 0) {
              state.devCatchup.push({
                scope_key: targetTeamId,
                agent_id: agentObj.id,
                remaining: Math.min(gap, Number(tm.batch_size || 1)),
                created_at: nowTs,
              });
            }
          }
        };

        if (pathname === '/api/admin/agents/move' && req.method === 'POST') {
          const data = await readJson(req);
          const agent = state.devAgents.find((a: any) => a.id === data.agentId && !a.deleted);
          if (agent) {
            const prevTeam = agent.team_id || null;
            const nextTeam = data.teamId || null;
            const conflict = state.devAgents.some(
              (a: any) => !a.deleted && a.id !== agent.id && (a.team_id || null) === nextTeam && a.phone === agent.phone,
            );
            if (conflict) {
              res.statusCode = 409;
              res.end(JSON.stringify({ error: "Esse telefone já está cadastrado nessa equipe." }));
              return;
            }
            agent.team_id = nextTeam;
            resetScopeCursor(prevTeam);
            if (nextTeam !== prevTeam) {
              resetScopeCursor(nextTeam);
              addCatchupForDevAgent(agent, nextTeam);
            }
          }
          persistState();
          res.end(JSON.stringify({ ok: true }));
          return;
        }

        if (pathname === '/api/admin/agents' && req.method === 'POST') {
          const data = await readJson(req);
          const maxPos = state.devAgents.reduce((m: number, a: any) => Math.max(m, a.position || 0), 0);
          const phone = normalizeDevPhone(data.phone);
          if (!phone) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: "Informe um telefone brasileiro válido com DDD." }));
            return;
          }
          const targetTeam = data.team_id || null;
          if (state.devAgents.some((a: any) => !a.deleted && (a.team_id || null) === targetTeam && a.phone === phone)) {
            res.statusCode = 409;
            res.end(JSON.stringify({ error: "Esse telefone já está cadastrado nessa equipe." }));
            return;
          }
          const createdAgent = {
            id: crypto.randomUUID(),
            name: String(data.name || '').trim(),
            phone,
            position: maxPos + 1,
            active: 1,
            deleted: 0,
            team_id: targetTeam,
          };
          state.devAgents.push(createdAgent);
          resetScopeCursor(targetTeam);
          addCatchupForDevAgent(createdAgent, targetTeam);
          persistState();
          res.end(JSON.stringify({ ok: true }));
          return;
        }

        if (pathname.startsWith('/api/admin/agents/')) {
          const id = pathname.split('/').pop();
          const agent = state.devAgents.find((a: any) => a.id === id && !a.deleted);
          if (!agent) {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: "Atendente não encontrado." }));
            return;
          }
          if (req.method === 'DELETE') {
            agent.deleted = 1;
            agent.active = 0;
            state.devCatchup = (state.devCatchup || []).filter((c: any) => c.agent_id !== id);
            persistState();
            res.end(JSON.stringify({ ok: true }));
            return;
          }
          if (req.method === 'PUT') {
            const data = await readJson(req);
            const phone = normalizeDevPhone(data.phone || agent.phone);
            if (!phone) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: "Informe um telefone brasileiro válido com DDD." }));
              return;
            }
            const nextTeam = data.team_id || null;
            if (state.devAgents.some((a: any) => !a.deleted && a.id !== agent.id && (a.team_id || null) === nextTeam && a.phone === phone)) {
              res.statusCode = 409;
              res.end(JSON.stringify({ error: "Esse telefone já está cadastrado nessa equipe." }));
              return;
            }
            const prevActive = agent.active;
            const prevPos = agent.position;
            const prevTeam = agent.team_id || null;
            const nextActive = data.active ? 1 : 0;
            const nextPos = Number.isInteger(data.position) ? data.position : agent.position;
            agent.name = String(data.name || agent.name).trim();
            agent.phone = phone;
            agent.active = nextActive;
            agent.position = nextPos;
            agent.team_id = nextTeam;
            if (!nextActive) {
              state.devCatchup = (state.devCatchup || []).filter((c: any) => c.agent_id !== id);
            }
            if (prevActive !== nextActive || prevPos !== nextPos || prevTeam !== nextTeam) {
              resetScopeCursor(prevTeam);
              if (nextTeam !== prevTeam) resetScopeCursor(nextTeam);
            }
            if (nextActive === 1 && (prevActive === 0 || prevTeam !== nextTeam)) {
              addCatchupForDevAgent(agent, nextTeam);
            }
            persistState();
            res.end(JSON.stringify({ ok: true }));
            return;
          }
        }

        if (pathname === '/api/admin/stats') {
          ensureTodayCounters();
          const totalToday = Object.values(state.devDeliveries).reduce((s: number, v: any) => s + Number(v || 0), 0);
          const liveAgents = state.devAgents.filter((a: any) => !a.deleted);
          const generalScope = liveAgents.filter((a: any) => !a.team_id);
          const generalQueue = computeDevQueuePreview(
            '__general__',
            generalScope.filter((a: any) => a.active),
            Number(state.batchSize || 1),
            state.generalCursorAgent,
            Number(state.generalUsed || 0),
            false,
            generalScope,
          );
          const teamQueues: Record<string, any> = {};
          for (const t of state.devTeams.filter((x: any) => !x.deleted)) {
            const sm = normalizeSync(t.sync_mode);
            const isMirrored = sm === 'general_same' || sm === 'general_reverse';
            const scope = isMirrored ? generalScope : liveAgents.filter((a: any) => a.team_id === t.id);
            const pool = !t.active ? [] : scope.filter((a: any) => a.active);
            teamQueues[t.id] = computeDevQueuePreview(
              t.id,
              pool,
              Number(t.batch_size || 1),
              t.cursorAgent,
              Number(t.used || 0),
              sm === 'general_reverse',
              scope,
            );
          }
          res.end(JSON.stringify({
            totals: { today: totalToday, yesterday: 0, '7': totalToday, '15': totalToday, '30': totalToday, total: totalToday },
            agents: state.devAgents.map((a: any) => {
              const cnt = Number(state.devDeliveries[a.id] || 0);
              return { id: a.id, name: a.name, phone: a.phone, active: a.active, deleted: a.deleted, team_id: a.team_id, deliveries: cnt, new_clients: cnt, today_deliveries: cnt };
            }),
            queues: { general: generalQueue, teams: teamQueues },
            period: url.searchParams.get('period') || 'today',
            timeZone: 'America/Sao_Paulo',
            generatedAt: Date.now(),
          }));
          return;
        }

        next();
  };

  return {
    name: 'dev-api-middleware',
    configureServer(server: any) {
      server.middlewares.use(apiMiddleware);
    },
    configurePreviewServer(server: any) {
      server.middlewares.use(apiMiddleware);
    },
  };
}

export default defineConfig(() => {
  return {
    base: '/',
    plugins: [react(), tailwindcss(), devApiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      outDir: 'dist',
    },
    server: {
      allowedHosts: true as const,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    preview: {
      allowedHosts: true as const,
    },
  };
});
