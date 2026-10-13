import {C} from './config.js';

const fail=(status,error)=>({status,body:{error}});
const png=/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/;

// Server-only: never include this module or its state in a public snapshot/build.
export function createRewardService({env=process.env,fetchImpl=globalThis.fetch,timeoutMs=6500}={}){
 const results=new WeakMap();
 function capture(r){
  if(r.phase!=='ended'||r.elapsed<C.duration||r.players.length!==2)return;
  if(results.get(r)?.epoch===r.epoch)return;
  const records=new Map(r.players.map(p=>[p.id,{
   payload:Object.freeze({playId:`${r.uuid}:${r.epoch}:${p.id}`,points:p.score,opponentPoints:r.players.find(other=>other.id!==p.id).score}),
   response:null,pending:null
  }]));
  results.set(r,{epoch:r.epoch,records});
 }
 async function issue(record){
  const key=env.ZERO_ARCADE_API_KEY,endpoint=env.ZERO_ARCADE_API_URL;
  if(!key||!endpoint)return fail(503,'ユニコイン連携は未設定です。スタッフにお知らせください。');
  let url;
  try{url=new URL(endpoint);if(url.protocol!=='https:'||url.pathname!=='/api/arcade/rewards'||url.username||url.password||url.search||url.hash)throw Error();}
  catch{return fail(503,'ユニコイン連携の接続先設定を確認してください。');}
  try{
   const response=await fetchImpl(url.href,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json',Authorization:`Bearer ${key}`},body:JSON.stringify(record.payload),signal:AbortSignal.timeout(timeoutMs)});
   if(response.status===422)return fail(422,'付与数確認中です。スタッフの確認後に再試行してください。');
   if(!response.ok)return fail(503,'ユニコインを発行できませんでした。時間をおいて再試行するか、スタッフにお知らせください。');
   // Do not echo upstream bodies, headers, errors or qrPayload to clients/logs.
   const data=await response.json();
   if(!Number.isSafeInteger(data.coins)||data.coins<0)throw Error();
   if(data.outcome!==undefined&&(typeof data.outcome!=='string'||data.outcome.length>50))throw Error();
   if(data.coins>0&&(!Number.isSafeInteger(data.expiresAt)||data.expiresAt<=0||data.expiresAt>8640000000000||typeof data.qrImageDataUrl!=='string'||data.qrImageDataUrl.length>1000000||!png.test(data.qrImageDataUrl)))throw Error();
   const body={coins:data.coins,outcome:data.outcome??null,qrImageDataUrl:data.coins>0?data.qrImageDataUrl:null,expiresAt:data.coins>0?data.expiresAt:null};
   record.response={status:200,body};return record.response;
  }catch{return fail(503,'QRの取得に失敗しました。ゲーム結果は確定しています。同じ結果で再試行できます。');}
 }
 function reward(r,id,epoch){
  if(epoch!==r.epoch)return Promise.resolve(fail(409,'試合が更新されました。現在の結果画面を開いてください。'));
  if(r.phase!=='ended'||r.elapsed<C.duration||r.players.length!==2)return Promise.resolve(fail(409,'ユニコインは2人で15分間プレイを完了した場合のみ発行できます。途中終了は対象外です。'));
  capture(r);
  const record=results.get(r)?.records.get(id);
  if(!record||!r.uuid||!Object.values(record.payload).slice(1).every(n=>Number.isSafeInteger(n)&&n>=0))return Promise.resolve(fail(409,'確定したゲーム結果を確認できません。'));
  if(record.response)return Promise.resolve(record.response);
  if(!record.pending)record.pending=issue(record).finally(()=>{record.pending=null;});
  return record.pending;
 }
 return {capture,reward};
}
