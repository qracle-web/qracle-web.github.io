// web/src/api/p2p/signal.ts 또는 server/routes/p2p-signal.ts
// 정식 도메인 / 공인 SSL 환경 호환, 덮어쓰기 방지 키 구조 적용

const signals = new Map<string, { room: string, type: string, from: string, to: string, sdp: any, ts: number }>();

export async function handleSignal(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const room = url.searchParams.get('room') || '';
  
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (req.method === 'POST') {
    try {
      const body = await req.json();
      const key = `${body.room}:${body.type}:${body.from || 'any'}:${body.to || 'any'}`;
      signals.set(key, { ...body, ts: Date.now() });
      setTimeout(() => signals.delete(key), 5 * 60 * 1000);
      return new Response(JSON.stringify({ ok: true, room: body.room, type: body.type }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    } catch (e: any) {
      return new Response(JSON.stringify({ ok: false, error: e.message }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
  }
  
  if (req.method === 'GET') {
    const type = url.searchParams.get('type') || 'offer';
    const from = url.searchParams.get('from') || 'any';
    const to = url.searchParams.get('to') || 'any';
    const key = `${room}:${type}:${from}:${to}`;
    const data = signals.get(key);
    if (!data) {
      return new Response(JSON.stringify({ ok: false, notfound: true }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
  
  return new Response('Method not allowed', { status: 405 });
}

export function viteP2PSignalMiddleware() {
  return {
    name: 'p2p-signal',
    configureServer(server: any) {
      server.middlewares.use('/api/p2p/signal', async (req: any, res: any) => {
        if (req.method === 'OPTIONS') {
          res.writeHead(200, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          });
          res.end();
          return;
        }

        let body = '';
        req.on('data', (chunk: any) => body += chunk);
        req.on('end', async () => {
          try {
            const url = new URL(req.url, `http://${req.headers.host}`);
            if (req.method === 'POST') {
              const json = JSON.parse(body || '{}');
              const key = `${json.room}:${json.type}:${json.from || 'any'}:${json.to || 'any'}`;
              signals.set(key, { ...json, ts: Date.now() });
              setTimeout(() => signals.delete(key), 5 * 60 * 1000);
              res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
              res.end(JSON.stringify({ ok: true }));
            } else if (req.method === 'GET') {
              const room = url.searchParams.get('room');
              const type = url.searchParams.get('type') || 'offer';
              const from = url.searchParams.get('from') || 'any';
              const to = url.searchParams.get('to') || 'any';
              const key = `${room}:${type}:${from}:${to}`;
              const data = signals.get(key);
              res.writeHead(data ? 200 : 404, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
              res.end(JSON.stringify(data || { ok: false }));
            } else {
              res.writeHead(405); res.end();
            }
          } catch (e: any) {
            res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ error: e.message }));
          }
        });
      });
    }
  };
}