import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createRewardService} from '../arcade-rewards.js';
import {room,player,advance,command,snapshot} from '../simulation.js';
import {C} from '../config.js';
const env={ZERO_ARCADE_API_URL:'https://admin.example/api/arcade/rewards',ZERO_ARCADE_API_KEY:'test-only-placeholder'};
const qr='data:image/png;base64,aGVsbG8=';
const success=(coins=10000)=>({ok:true,status:200,json:async()=>({coins,outcome:coins?'win':'lose',qrImageDataUrl:qr,expiresAt:1900000000,qrPayload:'not-for-browser'})});
function finished(){const r=room('ABC123');r.uuid=randomUUID();r.players=[player('A',0),player('B',1)];r.players[0].score=60;r.players[1].score=30;r.phase='playing';r.elapsed=C.duration-.25;advance(r,.25);return r;}

test('natural finish: two private IDs, authoritative scores and cached responses',async()=>{
 const calls=[];const service=createRewardService({env,fetchImpl:async(url,options)=>{calls.push({url,options,payload:JSON.parse(options.body)});return success(calls.length===1?10000:0);}});const r=finished();service.capture(r);
 const a=await service.reward(r,0,0),b=await service.reward(r,1,0);
 assert.equal(a.body.coins,10000);assert.equal(b.body.coins,0);assert.equal(b.body.qrImageDataUrl,null);
 assert.equal(a.body.outcome,'win');assert.equal(b.body.outcome,'lose');
 assert.equal(calls[0].payload.playId,`${r.uuid}:0:0`);assert.equal(calls[1].payload.playId,`${r.uuid}:0:1`);
 assert.deepEqual(calls[0].payload,{playId:`${r.uuid}:0:0`,points:60,opponentPoints:30});
 assert.equal(calls[1].payload.points,30);assert.equal(calls[1].payload.opponentPoints,60);
 assert.equal(calls[0].options.headers.Authorization,`Bearer ${env.ZERO_ARCADE_API_KEY}`);
 assert.equal(calls[0].options.redirect,'error');assert.equal((await service.reward(r,0,0)),a);assert.equal(calls.length,2);
 const publicState=JSON.stringify(snapshot(r,1));for(const secret of [qr,r.uuid,env.ZERO_ARCADE_API_KEY,'qrPayload','playId'])assert.ok(!publicState.includes(secret));
 assert.ok(!JSON.stringify(a).includes('qrPayload'));
});
test('lobby, in progress, manual end, missing opponent and stale epoch cannot issue',async()=>{
 let calls=0;const service=createRewardService({env,fetchImpl:async()=>{calls++;return success();}});
 for(const phase of ['lobby','playing']){const r=finished();r.phase=phase;assert.equal((await service.reward(r,0,0)).status,409);}
 const r=finished();r.phase='playing';r.elapsed=800;command(r,r.players[0],{type:'end'});assert.equal((await service.reward(r,0,0)).status,409);
 const one=finished();one.players.pop();assert.equal((await service.reward(one,0,0)).status,409);
 assert.equal((await service.reward(finished(),0,99)).status,409);assert.equal((await service.reward(finished(),99,0)).status,409);assert.equal(calls,0);
});
test('simultaneous requests coalesce; failed retry keeps frozen ID and both scores',async()=>{
 const sent=[];let release;const gate=new Promise(resolve=>release=resolve);
 const service=createRewardService({env,fetchImpl:async(_,options)=>{sent.push(options.body);if(sent.length===1){await gate;throw Error('private upstream detail');}return success();}});
 const r=finished();const pending=Array.from({length:8},()=>service.reward(r,0,0));release();assert.ok((await Promise.all(pending)).every(x=>x.status===503));assert.equal(sent.length,1);
 r.players[0].score=9999;r.players[1].score=0;
 assert.equal((await service.reward(r,0,0)).status,200);assert.equal(sent[0],sent[1]);assert.equal(JSON.parse(sent[1]).points,60);
});
test('rematch and reused room codes get new IDs; old in-flight response stays with old record',async()=>{
 const sent=[];let release;const gate=new Promise(resolve=>release=resolve);
 const service=createRewardService({env,fetchImpl:async(_,options)=>{sent.push(JSON.parse(options.body));if(sent.length===1)await gate;return success();}});const r=finished();const old=service.reward(r,0,0);
 command(r,r.players[0],{type:'rematch'});command(r,r.players[1],{type:'rematch'});r.phase='playing';r.elapsed=C.duration-.25;advance(r,.25);
 await service.reward(r,0,1);release();await old;await service.reward(r,0,1);await service.reward(finished(),0,0);
 assert.equal(sent.length,3);assert.equal(new Set(sent.map(x=>x.playId)).size,3);assert.equal(sent[1].points,0);
});
test('draw 422 is retriable after configuration with the same payload',async()=>{
 const sent=[];const service=createRewardService({env,fetchImpl:async(_,options)=>{sent.push(options.body);return sent.length===1?{ok:false,status:422}:success(0);}});const r=finished();r.players[1].score=60;
 assert.match((await service.reward(r,0,0)).body.error,/付与数確認中/);assert.equal((await service.reward(r,0,0)).status,200);assert.equal(sent[0],sent[1]);
});
test('missing configuration and unsafe URL never send; upstream errors are not leaked',async()=>{
 for(const config of [{},{...env,ZERO_ARCADE_API_URL:'http://admin.example/api/arcade/rewards'},{...env,ZERO_ARCADE_API_URL:'https://admin.example/api/arcade/rewards?key=bad'}]){
 const service=createRewardService({env:config,fetchImpl:async()=>{assert.fail('must not send');}});assert.equal((await service.reward(finished(),0,0)).status,503);}
 for(const status of [400,401,403,409,500]){const service=createRewardService({env,fetchImpl:async()=>({ok:false,status,json:async()=>{assert.fail('must not read error body');}})});assert.equal((await service.reward(finished(),0,0)).status,503);}
});
test('malformed success or QR error is retryable; zero coins needs no QR',async()=>{
 for(const data of [{coins:-1},{coins:1.5},{coins:10,qrImageDataUrl:'https://bad.example',expiresAt:1900000000},{coins:10,qrImageDataUrl:qr},{coins:10,qrImageDataUrl:qr,expiresAt:'tomorrow'}]){
 const service=createRewardService({env,fetchImpl:async()=>({ok:true,status:200,json:async()=>data})});assert.equal((await service.reward(finished(),0,0)).status,503);}
 const service=createRewardService({env,fetchImpl:async()=>({ok:true,status:200,json:async()=>({coins:0,outcome:'lose'})})});assert.equal((await service.reward(finished(),0,0)).body.qrImageDataUrl,null);
});
test('timeout leaves result intact and allows retry',async()=>{
 const service=createRewardService({env,timeoutMs:10,fetchImpl:async(_,options)=>new Promise((_,reject)=>options.signal.addEventListener('abort',()=>reject(Error('timeout'))))});const r=finished();
 const keepAlive=setTimeout(()=>{},100);try{assert.equal((await service.reward(r,0,0)).status,503);assert.equal(r.phase,'ended');assert.equal(r.players[0].score,60);}finally{clearTimeout(keepAlive);}
});
