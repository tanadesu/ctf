import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {C} from './config.js';
import {room,player,command,advance,snapshot} from './simulation.js';
import {quote} from './economy.js';
const rooms=new Map(), sessions=new Map(), root=new URL('./',import.meta.url);
const token=()=>randomBytes(24).toString('hex');
if(process.env.NODE_ENV==='production'&&!process.env.ADMIN_KEY)throw Error('Renderの環境変数 ADMIN_KEY を設定してください');
const adminKey=process.env.ADMIN_KEY||token();
const allowedOrigins=new Set((process.env.ALLOWED_ORIGINS||'').split(',').map(x=>x.trim()).filter(Boolean));
const send=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
let last=performance.now();
function sync(){const now=performance.now(),dt=(now-last)/1000;last=now;for(const r of rooms.values())advance(r,dt);}
const timer=setInterval(sync,C.tickMs);timer.unref();
const allowed=new Map([['/','index.html'],['/index.html','index.html'],['/game.js','game.js'],['/renderer.js','renderer.js'],['/network.js','network.js'],['/runtime-config.js','runtime-config.js'],['/config.js','config.js'],['/styles.css','styles.css'],['/assets/planet-horizon.png','assets/planet-horizon.png'],['/admin','admin.html']]);
const server=http.createServer(async(req,res)=>{
 try{
 const url=new URL(req.url,'http://localhost');
 if(req.method==='GET'&&allowed.has(url.pathname)){const name=allowed.get(url.pathname),data=await readFile(new URL(name,root));res.writeHead(200,{'Content-Type':name.endsWith('.html')?'text/html; charset=utf-8':name.endsWith('.css')?'text/css':name.endsWith('.png')?'image/png':'text/javascript','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});return res.end(data);}
 if(req.method==='GET'&&url.pathname==='/health')return send(res,200,{ok:true});
 if(url.pathname.startsWith('/api/')){
 const origin=req.headers.origin;
 const accepted=!origin||allowedOrigins.has(origin)||origin===`http://${req.headers.host}`||origin===`https://${req.headers.host}`;
 if(!accepted)return send(res,403,{error:'許可されていないサイトからの通信です'});
 if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
 if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization','Access-Control-Max-Age':'600'});return res.end();}
 }
 if(req.method!=='POST')return send(res,404,{error:'ページがありません'});
 
 let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>16384)return send(res,413,{error:'リクエストが大きすぎます'});}let body;try{body=JSON.parse(raw||'{}');}catch{return send(res,400,{error:'JSONが不正です'});}
 sync();
 if(url.pathname==='/api/create'||url.pathname==='/api/join'){
 let r;if(url.pathname.endsWith('create')){if(rooms.size>=100)throw Error('ルーム上限です。運営にご連絡ください');let code;do{code=randomBytes(3).toString('hex').toUpperCase();}while(rooms.has(code));r=room(code);rooms.set(code,r);}else{r=rooms.get(String(body.code).toUpperCase().trim());if(!r)throw Error('ルームが見つかりません');if(r.players.length>=2||r.phase!=='lobby')throw Error('このルームは満員、または開始済みです');}
 const id=r.players.length,p=player(String(body.name||`COMPANY ${id+1}`),id),key=token();r.players.push(p);sessions.set(key,{r,id,seen:new Map(),quotes:new Map()});return send(res,200,{token:key,state:snapshot(r,id)});
 }
 if(url.pathname==='/api/admin'){
 const key=String(body.key||'');if(key.length!==adminKey.length||!timingSafeEqual(Buffer.from(key),Buffer.from(adminKey)))return send(res,403,{error:'運営キーが違います'});
 const r=rooms.get(String(body.code).toUpperCase());if(!r)throw Error('ルームがありません');if(body.action==='pause')r.paused=!r.paused;else if(body.action==='reset'){r.players=r.players.map(p=>player(p.name,p.id));r.phase='lobby';r.elapsed=0;r.paused=false;r.markets=room('').markets;r.events=[];r.epoch++;}else throw Error('不明な運営操作です');return send(res,200,{ok:true,phase:r.phase,paused:r.paused});
 }
 const s=sessions.get(req.headers.authorization?.replace(/^Bearer /,''));if(!s)return send(res,401,{error:'参加し直してください（サーバー再起動後は復帰できません）'});
 const {r,id}=s,p=r.players[id];
 if(url.pathname==='/api/state')return send(res,200,snapshot(r,id));
 if(url.pathname==='/api/quote'){
 if(r.phase!=='playing'||r.paused)throw Error('試合が進行中ではありません');if(p.access[body.market]!==2)throw Error('市場へ参入してください');const q=quote(r.markets[body.market],body.good,body.side,body.n),key=token();
 if(q.side==='buy'&&(p.cash<q.total||p.inventory[q.good]+q.n>C.inventoryCap))throw Error('資金または自社の在庫容量が不足しています');if(q.side==='sell'&&p.inventory[q.good]<q.n)throw Error('自社在庫が不足しています');
 s.quotes.clear();s.quotes.set(key,{...q,expires:r.elapsed+C.quoteLife,epoch:r.epoch});return send(res,200,{...q,key,expires:r.elapsed+C.quoteLife});
 }
 if(url.pathname==='/api/action'){
 if(typeof body.id!=='string'||body.id.length>100||!body.id)throw Error('操作IDが必要です');
 if(s.seen.has(body.id)){const old=s.seen.get(body.id);return send(res,old.status,old.data);}
 // Never evict accepted IDs: old retries must remain idempotent for the room's lifetime.
 if(s.seen.size>=20000)throw Error('操作数が上限に達しました');
 let status=200,data;try{if(body.epoch!==r.epoch)throw Error('試合が更新されました。最新状態を取得してください');const a={...body.action};if(a.type==='trade'){const q=s.quotes.get(a.key);if(!q||q.expires<r.elapsed||q.epoch!==r.epoch)throw Error('見積もりが期限切れです。再見積もりしてください');a.quote=q;s.quotes.delete(a.key);}command(r,p,a);data={ok:true,state:snapshot(r,id)};}catch(e){status=409;data={error:e.message};}s.seen.set(body.id,{status,data});return send(res,status,data);
 }
 send(res,404,{error:'APIがありません'});
 }catch(e){send(res,400,{error:e.message});}
});
const port=Number(process.env.PORT||3000);server.listen(port,'0.0.0.0',()=>{console.log(`ORBIS FRONTIER: http://localhost:${port}`);console.log('運営画面: /admin');console.log(process.env.ADMIN_KEY?'運営キー: 環境変数 ADMIN_KEY を使用':'運営キー: '+adminKey);});
