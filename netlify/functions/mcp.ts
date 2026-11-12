// Netlify-Function-Adapter für eine kostenlose Preview auf *.netlify.app.
// Derselbe Worker-Code wie bei Cloudflare; Netlify liefert die Client-IP als x-nf-client-connection-ip,
// die hier nur für das flüchtige In-Memory-Rate-Limit weitergereicht und nirgends gespeichert wird.
import worker from '../../src/index';
export default async (req: Request): Promise<Response> => {
  const ip = req.headers.get('x-nf-client-connection-ip');
  if (!ip) return worker.fetch(req);
  // Immer mit der Netlify-Client-IP überschreiben, damit ein gefälschter cf-connecting-ip-Header das Rate-Limit nicht umgeht.
  const headers = new Headers(req.headers);
  headers.set('cf-connecting-ip', ip);
  const init: RequestInit & { duplex?: 'half' } = { method: req.method, headers };
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') { init.body = req.body; init.duplex = 'half'; }
  return worker.fetch(new Request(req.url, init));
};
export const config = { path: ['/', '/mcp', '/health'] };
