import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {fileURLToPath} from 'url';
import {defineConfig} from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function devApiPlugin() {
  const devAgents = [
    { id: "agent-1", name: "Atendente Comercial 1", phone: "551130420181", position: 1, active: 1, deleted: 0 },
    { id: "agent-2", name: "Atendente Comercial 2", phone: "551130420181", position: 2, active: 1, deleted: 0 },
  ];
  let cursor = 0;

  return {
    name: 'dev-api-middleware',
    configureServer(server: any) {
      server.middlewares.use((req: any, res: any, next: any) => {
        if (!req.url?.startsWith('/api/')) return next();
        const url = new URL(req.url, 'http://localhost');
        const path = url.pathname;

        res.setHeader('Content-Type', 'application/json');

        if (path === '/api/visitor') {
          res.setHeader('Set-Cookie', 'oncred_visitor=00000000-0000-0000-0000-000000000001; Path=/; SameSite=Lax');
          res.end(JSON.stringify({ ready: true }));
          return;
        }

        if (path === '/api/route' && req.method === 'POST') {
          let bodyStr = '';
          req.on('data', (chunk: any) => { bodyStr += chunk; });
          req.on('end', () => {
            let data: any = {};
            try { data = JSON.parse(bodyStr); } catch {}
            let selected = devAgents[0];
            const specificAgent = data.agent ? String(data.agent).trim() : null;
            if (specificAgent) {
              const ordinalMatch = specificAgent.match(/^(?:atendimento|atendente)?([1-9]\d*)$/i);
              const pos = ordinalMatch ? parseInt(ordinalMatch[1], 10) : -1;
              const found = devAgents.find(a =>
                a.id === specificAgent ||
                a.position === pos ||
                `atendimento${a.position}` === specificAgent.toLowerCase() ||
                `atendente${a.position}` === specificAgent.toLowerCase()
              );
              if (!found || found.deleted) {
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
            } else {
              selected = devAgents[cursor % devAgents.length];
              cursor++;
            }
            res.end(JSON.stringify({
              phone: selected.phone,
              name: selected.name,
              eventId: 'dev-event-' + Date.now(),
              trackContact: true,
              isDirect: !!specificAgent,
            }));
          });
          return;
        }

        if (path === '/api/login' && req.method === 'POST') {
          res.end(JSON.stringify({ token: 'dev-token-admin', expires: Date.now() + 1800000 }));
          return;
        }

        if (path === '/api/admin/config') {
          res.end(JSON.stringify({ batchSize: 1, agents: devAgents }));
          return;
        }

        if (path === '/api/admin/stats') {
          res.end(JSON.stringify({
            totals: { today: 12, yesterday: 8, '7': 45, '15': 89, '30': 150, total: 320 },
            agents: devAgents.map(a => ({ id: a.id, name: a.name, phone: a.phone, active: a.active, deleted: 0, deliveries: 15, new_clients: 12 })),
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
