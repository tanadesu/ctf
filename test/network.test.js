import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
// Opt in because restricted environments may not allow opening a listening socket.
test('two clients, concurrent orders, retries, private state, admin controls and room capacity',{skip:!process.env.NETWORK_TEST},async()=>{
 const server=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:'3097',ADMIN_KEY:'test-operator-key',ALLOWED_ORIGINS:'https://ctf1-99feb.web.app'},stdio:['ignore','pipe','pipe']});
 try{
 await Promise.race([once(server.stdout,'data'),once(server,'exit').then(()=>{throw Error('test server exited');})]);
 const call=async(path,body={},token)=>{const r=await fetch('http://127.0.0.1:3097/api/'+path,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});return{status:r.status,...await r.json()};};
 const preflight=await fetch('http://127.0.0.1:3097/api/create',{method:'OPTIONS',headers:{Origin:'https://ctf1-99feb.web.app','Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization,content-type'}});
 assert.equal(preflight.status,204);assert.equal(preflight.headers.get('access-control-allow-origin'),'https://ctf1-99feb.web.app');
 const cross=await fetch('http://127.0.0.1:3097/api/state',{method:'POST',headers:{Origin:'https://ctf1-99feb.web.app'}});assert.equal(cross.status,401);assert.equal(cross.headers.get('access-control-allow-origin'),'https://ctf1-99feb.web.app');
 const blocked=await fetch('http://127.0.0.1:3097/api/create',{method:'POST',headers:{Origin:'https://untrusted.example'}});assert.equal(blocked.status,403);assert.equal(blocked.headers.get('access-control-allow-origin'),null);
 const a=await call('create',{name:'A'}),b=await call('join',{name:'B',code:a.state.code});assert.equal((await call('join',{name:'C',code:a.state.code})).status,400);
 const action=async(who,id,action,epoch=0)=>call('action',{id,epoch,action},who.token);
 await action(a,'ready-a',{type:'ready'});await action(b,'ready-b',{type:'ready'});
 const q=await call('quote',{market:0,good:'materials',side:'sell',n:10},a.token);
 const retries=await Promise.all(Array.from({length:8},()=>action(a,'same-sale',{type:'trade',key:q.key})));assert.ok(retries.every(r=>r.ok));let s=await call('state',{},a.token);assert.equal(s.players[0].inventory.materials,20);assert.equal(s.players[0].sales,q.gross);
 const qs=await Promise.all([call('quote',{market:0,good:'parts',side:'buy',n:60},a.token),call('quote',{market:0,good:'parts',side:'buy',n:60},b.token)]);
 const both=await Promise.all(qs.map((q,i)=>action(i?b:a,'bulk-'+i,{type:'trade',key:q.key})));assert.equal(both.filter(r=>r.ok).length,1);
 s=await call('state',{},b.token);assert.equal(s.players[0].cash,undefined);assert.ok(s.markets[0].stock.parts>=0);assert.equal((await call('admin',{key:'wrong',code:a.state.code,action:'pause'})).status,403);
 await call('admin',{key:'test-operator-key',code:a.state.code,action:'pause'});const paused=await call('state',{},a.token);await new Promise(r=>setTimeout(r,350));assert.equal((await call('state',{},b.token)).elapsed,paused.elapsed);
 await call('admin',{key:'test-operator-key',code:a.state.code,action:'reset'});s=await call('state',{},a.token);assert.equal(s.epoch,1);assert.equal(s.phase,'lobby');assert.equal(s.players[0].cash,18000);assert.equal((await action(a,'old-epoch',{type:'ready'},0)).status,409);
 assert.equal((await call('state',{},'invalid')).status,401);
 }finally{server.kill();await once(server,'exit');}
});
