import {describe,it,expect} from 'vitest';
import handler,{config} from '../netlify/functions/mcp';
describe('Netlify-Adapter',()=>{
 it('leitet POST /mcp an den Worker weiter',async()=>{const r=await handler(new Request('https://preview.netlify.app/mcp',{method:'POST',headers:{'content-type':'application/json','x-nf-client-connection-ip':'198.51.100.9'},body:'{"jsonrpc":"2.0","id":1,"method":"tools/list"}'}));expect(r.status).toBe(200);expect((await r.json()).result.tools).toHaveLength(2);});
 it('ein gefälschter cf-connecting-ip-Header umgeht das Rate-Limit nicht',async()=>{const req=(i:number)=>handler(new Request('https://preview.netlify.app/mcp',{method:'POST',headers:{'content-type':'application/json','x-nf-client-connection-ip':'198.51.100.77','cf-connecting-ip':`10.0.0.${i}`},body:'{"jsonrpc":"2.0","id":1,"method":"ping"}'}));for(let i=0;i<120;i++)expect((await req(i)).status).toBe(200);expect((await req(200)).status).toBe(429);});
 it('liefert /health und bedient die erwarteten Pfade',async()=>{expect((await handler(new Request('https://preview.netlify.app/health'))).status).toBe(200);expect(config.path).toEqual(['/','/mcp','/health']);});
});
