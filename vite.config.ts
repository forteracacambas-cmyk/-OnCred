import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {fileURLToPath} from 'url';
import {defineConfig} from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function devApiPlugin() {
  const devTeams: any[] = [
    { id: "11111111-1111-1111-1111-111111111111", slug: "equipe1", name: "Equipe 1", batch_size: 1, active: 1, deleted: 0, cursor: 0 },
  ];
  const devAgents: any[] = [
    { id: "22222222-2222-2222-2222-222222222201", name: "Atendente Comercial 1", phone: "551130420181", position: 1, active: 1, deleted: 0, team_id: null },
    { id: "22222222-2222-2222-2222-222222222202", name: "Atendente Comercial 2", phone: "551130420181", position: 2, active: 1, deleted: 0, team_id: "11111111-1111-1111-1111-111111111111" },
  ];
  let batchSize = 1;
  let generalCursor = 0;

  const readJson = (req: any): Promise<any> =>
    new Promise((resolve) => {
      let bodyStr = '';
      req.on('data', (chunk: any) => { bodyStr += chunk; });
      req.on('end', () => {
        try { resolve(JSON.parse(bodyStr || '{}')); } catch { resolve({}); }
      });
    });

  return {
    name: 'dev-api-middleware',
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        if (!req.url?.startsWith('/api/')) return next();
        const url = new URL(req.url, 'http://localhost');
        const pathname = url.pathname.replace(/\/$/, '');

        res.setHeader('Content-Type', 'application/json');

        if (pathname === '/api/visitor') {
          res.setHeader('Set-Cookie', 'oncred_visitor=00000000-0000-0000-0000-000000000001; Path=/; SameSite=Lax');
          res.end(JSON.stringify({ ready: true }));
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
            const found = devAgents.find(a =>
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
            selected = found;
          } else if (specificTeam) {
            teamObj = devTeams.find(t => !t.deleted && (t.id === specificTeam || t.slug.toLowerCase() === specificTeam.toLowerCase()));
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
            const pool = devAgents.filter(a => !a.deleted && a.active && a.team_id === teamObj.id);
            if (!pool.length) {
              res.statusCode = 503;
              res.end(JSON.stringify({ error: `Nenhum atendente disponível na equipe ${teamObj.name} no momento.` }));
              return;
            }
            selected = pool[teamObj.cursor % pool.length];
            teamObj.cursor++;
          } else {
            const pool = devAgents.filter(a => !a.deleted && a.active && !a.team_id);
            if (!pool.length) {
              res.statusCode = 503;
              res.end(JSON.stringify({ error: "Nenhum atendente disponível no momento." }));
              return;
            }
            selected = pool[generalCursor % pool.length];
            generalCursor++;
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
          res.end(JSON.stringify({ token: 'dev-token-admin', expires: Date.now() + 1800000 }));
          return;
        }

        if (pathname === '/api/admin/logout' && req.method === 'POST') {
          res.end(JSON.stringify({ ok: true }));
          return;
        }

        if (pathname === '/api/admin/clear-history' && req.method === 'POST') {
          generalCursor = 0;
          devTeams.forEach(t => { t.cursor = 0; });
          res.end(JSON.stringify({ ok: true }));
          return;
        }

        if (pathname === '/api/admin/config') {
          if (req.method === 'PUT') {
            const data = await readJson(req);
            if (Number.isInteger(data.batchSize) && data.batchSize >= 1) batchSize = data.batchSize;
            res.end(JSON.stringify({ ok: true }));
            return;
          }
          res.end(JSON.stringify({
            batchSize,
            agents: devAgents.filter(a => !a.deleted),
            teams: devTeams.filter(t => !t.deleted),
          }));
          return;
        }

        if (pathname === '/api/admin/teams' && req.method === 'POST') {
          const data = await readJson(req);
          const slug = String(data.slug || data.name || '').toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
          if (devTeams.some(t => !t.deleted && t.slug.toLowerCase() === slug)) {
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
            deleted: 0,
            cursor: 0,
          };
          devTeams.push(team);
          res.end(JSON.stringify({ ok: true, team }));
          return;
        }

        if (pathname.startsWith('/api/admin/teams/')) {
          const id = pathname.split('/').pop();
          const team = devTeams.find(t => t.id === id && !t.deleted);
          if (!team) {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: "Equipe não encontrada." }));
            return;
          }
          if (req.method === 'DELETE') {
            team.deleted = 1;
            team.active = 0;
            devAgents.forEach(a => { if (a.team_id === id) a.team_id = null; });
            res.end(JSON.stringify({ ok: true }));
            return;
          }
          if (req.method === 'PUT') {
            const data = await readJson(req);
            team.name = String(data.name || team.name).trim();
            team.slug = String(data.slug || team.slug).toLowerCase().trim();
            team.batch_size = Number(data.batchSize) || 1;
            team.active = data.active ? 1 : 0;
            res.end(JSON.stringify({ ok: true }));
            return;
          }
        }

        if (pathname === '/api/admin/agents/move' && req.method === 'POST') {
          const data = await readJson(req);
          const agent = devAgents.find(a => a.id === data.agentId && !a.deleted);
          if (agent) agent.team_id = data.teamId || null;
          res.end(JSON.stringify({ ok: true }));
          return;
        }

        if (pathname === '/api/admin/agents' && req.method === 'POST') {
          const data = await readJson(req);
          const maxPos = devAgents.reduce((m, a) => Math.max(m, a.position || 0), 0);
          let digits = String(data.phone || '').replace(/\D/g, '').replace(/^0+/, '');
          if (digits.length === 10 || digits.length === 11) digits = '55' + digits;
          devAgents.push({
            id: crypto.randomUUID(),
            name: String(data.name || '').trim(),
            phone: digits,
            position: maxPos + 1,
            active: 1,
            deleted: 0,
            team_id: data.team_id || null,
          });
          res.end(JSON.stringify({ ok: true }));
          return;
        }

        if (pathname.startsWith('/api/admin/agents/')) {
          const id = pathname.split('/').pop();
          const agent = devAgents.find(a => a.id === id && !a.deleted);
          if (!agent) {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: "Atendente não encontrado." }));
            return;
          }
          if (req.method === 'DELETE') {
            agent.deleted = 1;
            agent.active = 0;
            res.end(JSON.stringify({ ok: true }));
            return;
          }
          if (req.method === 'PUT') {
            const data = await readJson(req);
            let digits = String(data.phone || agent.phone).replace(/\D/g, '').replace(/^0+/, '');
            if (digits.length === 10 || digits.length === 11) digits = '55' + digits;
            agent.name = String(data.name || agent.name).trim();
            agent.phone = digits;
            agent.active = data.active ? 1 : 0;
            agent.position = Number.isInteger(data.position) ? data.position : agent.position;
            agent.team_id = data.team_id || null;
            res.end(JSON.stringify({ ok: true }));
            return;
          }
        }

        if (pathname === '/api/admin/stats') {
          res.end(JSON.stringify({
            totals: { today: 12, yesterday: 8, '7': 45, '15': 89, '30': 150, total: 320 },
            agents: devAgents.map(a => ({ id: a.id, name: a.name, phone: a.phone, active: a.active, deleted: a.deleted, team_id: a.team_id, deliveries: 15, new_clients: 12 })),
            period: 'today',
          }));
          return;
        }

        next();
      });
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
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
