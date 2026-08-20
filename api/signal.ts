// web/src/api/p2p/signal.ts 또는 server/routes/p2p-signal.ts
// 정식 도메인 / 공인 SSL 환경 호환, CORS 보완 및 예외 처리 강화

const signals = new Map<string, { room: string, type: string, from: string, to: string, sdp: any, ts: number }>();

// 허용할 프론트엔드 주소 (필요 시 특정 도메인 고정 가능, 여기서는 동적 허용 및 예외 방어 적용)
function getCORSHeaders(reqHeaders?: any) {
  return {
    // 'Access-Control-Allow-Origin': '*', // 또는 보안을 위해 특정 도메인 지정: 'https://github.io'
    'Access-Control-Allow-Origin': 'https://github.io'  
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400', // Preflight(OPTIONS) 요청 캐싱으로 성능 향상
  };
}

export async function handleSignal(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const room = url.searchParams.get('room') || '';
  const corsHeaders = getCORSHeaders();
  
  // 1. OPTIONS (Preflight) 요청 처리
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204, // 200 대신 No Content 표준인 204 권장
      headers: corsHeaders,
    });
  }

  // 2. POST 요청 처리 (시그널 등록)
  if (req.method === 'POST') {
    try {
      const body = await req.json();
      if (!body.room) throw new Error('Missing room parameter');
      
      const key = `${body.room}:${body.type || 'offer'}:${body.from || 'any'}:${body.to || 'any'}`;
      signals.set(key, { ...body, ts: Date.now() });
      
      // 5분 후 자동 삭제 (메모리 누수 방지)
      setTimeout(() => signals.delete(key), 5 * 60 * 1000);
      
      return new Response(JSON.stringify({ ok: true, room: body.room, type: body.type }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    } catch (e: any) {
      return new Response(JSON.stringify({ ok: false, error: e.message }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }
  
  // 3. GET 요청 처리 (시그널 조회)
  if (req.method === 'GET') {
    const type = url.searchParams.get('type') || 'offer';
    const from = url.searchParams.get('from') || 'any';
    const to = url.searchParams.get('to') || 'any';
    const key = `${room}:${type}:${from}:${to}`;
    
    const data = signals.get(key);
    if (!data) {
      return new Response(JSON.stringify({ ok: false, notfound: true }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
  
  // 4. 허용되지 않은 메서드 처리 (여기에도 CORS 헤더가 반드시 있어야 에러를 추적할 수 있습니다)
  return new Response('Method not allowed', { 
    status: 405,
    headers: corsHeaders
  });
}

// Vite 로컬 개발 서버용 미들웨어
export function viteP2PSignalMiddleware() {
  return {
    name: 'p2p-signal',
    configureServer(server: any) {
      server.middlewares.use('/api/p2p/signal', async (req: any, res: any) => {
        // 클라이언트의 Origin 헤더를 동적으로 읽어오거나 전체 허용
        const origin = req.headers.origin || '*';
        const nodeCorsHeaders = {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Content-Type': 'application/json'
        };

        if (req.method === 'OPTIONS') {
          res.writeHead(204, nodeCorsHeaders);
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
              if (!json.room) {
                res.writeHead(400, nodeCorsHeaders);
                res.end(JSON.stringify({ ok: false, error: 'Missing room' }));
                return;
              }
              const key = `${json.room}:${json.type || 'offer'}:${json.from || 'any'}:${json.to || 'any'}`;
              signals.set(key, { ...json, ts: Date.now() });
              setTimeout(() => signals.delete(key), 5 * 60 * 1000);
              
              res.writeHead(200, nodeCorsHeaders);
              res.end(JSON.stringify({ ok: true }));
              
            } else if (req.method === 'GET') {
              const room = url.searchParams.get('room');
              const type = url.searchParams.get('type') || 'offer';
              const from = url.searchParams.get('from') || 'any';
              const to = url.searchParams.get('to') || 'any';
              const key = `${room}:${type}:${from}:${to}`;
              
              const data = signals.get(key);
              res.writeHead(data ? 200 : 404, nodeCorsHeaders);
              res.end(JSON.stringify(data || { ok: false, notfound: true }));
              
            } else {
              res.writeHead(405, nodeCorsHeaders);
              res.end(JSON.stringify({ error: 'Method not allowed' }));
            }
          } catch (e: any) {
            res.writeHead(500, nodeCorsHeaders);
            res.end(JSON.stringify({ error: e.message }));
          }
        });
      });
    }
  };
}




// // web/src/api/p2p/signal.ts 또는 server/routes/p2p-signal.ts
// // 정식 도메인 / 공인 SSL 환경 호환, 덮어쓰기 방지 키 구조 적용

// const signals = new Map<string, { room: string, type: string, from: string, to: string, sdp: any, ts: number }>();

// export async function handleSignal(req: Request): Promise<Response> {
//   const url = new URL(req.url);
//   const room = url.searchParams.get('room') || '';
  
//   if (req.method === 'OPTIONS') {
//     return new Response(null, {
//       status: 200,
//       headers: {
//         'Access-Control-Allow-Origin': '*',
//         'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
//         'Access-Control-Allow-Headers': 'Content-Type',
//       },
//     });
//   }

//   if (req.method === 'POST') {
//     try {
//       const body = await req.json();
//       const key = `${body.room}:${body.type}:${body.from || 'any'}:${body.to || 'any'}`;
//       signals.set(key, { ...body, ts: Date.now() });
//       setTimeout(() => signals.delete(key), 5 * 60 * 1000);
//       return new Response(JSON.stringify({ ok: true, room: body.room, type: body.type }), {
//         headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
//       });
//     } catch (e: any) {
//       return new Response(JSON.stringify({ ok: false, error: e.message }), {
//         status: 400,
//         headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
//       });
//     }
//   }
  
//   if (req.method === 'GET') {
//     const type = url.searchParams.get('type') || 'offer';
//     const from = url.searchParams.get('from') || 'any';
//     const to = url.searchParams.get('to') || 'any';
//     const key = `${room}:${type}:${from}:${to}`;
//     const data = signals.get(key);
//     if (!data) {
//       return new Response(JSON.stringify({ ok: false, notfound: true }), {
//         status: 404,
//         headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
//       });
//     }
//     return new Response(JSON.stringify(data), {
//       headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
//     });
//   }
  
//   return new Response('Method not allowed', { status: 405 });
// }

// export function viteP2PSignalMiddleware() {
//   return {
//     name: 'p2p-signal',
//     configureServer(server: any) {
//       server.middlewares.use('/api/p2p/signal', async (req: any, res: any) => {
//         if (req.method === 'OPTIONS') {
//           res.writeHead(200, {
//             'Access-Control-Allow-Origin': '*',
//             'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
//             'Access-Control-Allow-Headers': 'Content-Type',
//           });
//           res.end();
//           return;
//         }

//         let body = '';
//         req.on('data', (chunk: any) => body += chunk);
//         req.on('end', async () => {
//           try {
//             const url = new URL(req.url, `http://${req.headers.host}`);
//             if (req.method === 'POST') {
//               const json = JSON.parse(body || '{}');
//               const key = `${json.room}:${json.type}:${json.from || 'any'}:${json.to || 'any'}`;
//               signals.set(key, { ...json, ts: Date.now() });
//               setTimeout(() => signals.delete(key), 5 * 60 * 1000);
//               res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
//               res.end(JSON.stringify({ ok: true }));
//             } else if (req.method === 'GET') {
//               const room = url.searchParams.get('room');
//               const type = url.searchParams.get('type') || 'offer';
//               const from = url.searchParams.get('from') || 'any';
//               const to = url.searchParams.get('to') || 'any';
//               const key = `${room}:${type}:${from}:${to}`;
//               const data = signals.get(key);
//               res.writeHead(data ? 200 : 404, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
//               res.end(JSON.stringify(data || { ok: false }));
//             } else {
//               res.writeHead(405); res.end();
//             }
//           } catch (e: any) {
//             res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
//             res.end(JSON.stringify({ error: e.message }));
//           }
//         });
//       });
//     }
//   };
// }