import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';

function apiDevServer(): Plugin {
  return {
    name: 'api-dev-server',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) {
          return next();
        }

        const pathname = req.url.split('?')[0];

        try {
          if (pathname === '/api/health') {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true, dev: true, time: new Date().toISOString() }));
            return;
          }

          if (req.method === 'POST') {
            const chunks: Buffer[] = [];
            for await (const chunk of req) {
              chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
            }
            const rawBody = Buffer.concat(chunks).toString('utf-8');
            const body = rawBody ? JSON.parse(rawBody) : {};

            const vReq: any = {
              method: req.method,
              headers: req.headers,
              body,
              query: {},
            };

            let statusCode = 200;
            const headers: Record<string, string> = {
              'Content-Type': 'application/json',
            };

            const vRes: any = {
              status(code: number) {
                statusCode = code;
                return vRes;
              },
              setHeader(k: string, v: string) {
                headers[k] = v;
                return vRes;
              },
              json(data: any) {
                for (const [k, v] of Object.entries(headers)) {
                  res.setHeader(k, v);
                }
                res.statusCode = statusCode;
                res.end(JSON.stringify(data));
                return vRes;
              },
              end(data?: any) {
                for (const [k, v] of Object.entries(headers)) {
                  res.setHeader(k, v);
                }
                res.statusCode = statusCode;
                res.end(data);
                return vRes;
              },
            };

            if (pathname === '/api/analyze') {
              const analyzeMod = await server.ssrLoadModule('./api/analyze.ts');
              return await analyzeMod.default(vReq, vRes);
            }

            if (pathname === '/api/generate') {
              const generateMod = await server.ssrLoadModule('./api/generate.ts');
              return await generateMod.default(vReq, vRes);
            }
          }
        } catch (err: any) {
          console.error('[Vite Dev API Error]:', err);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: { message: err?.message || 'Dev server error' } }));
          return;
        }

        next();
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), apiDevServer()],
  server: {
    port: 5173,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
