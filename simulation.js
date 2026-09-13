import { C } from './config.js';
import {createMarkets, marketTick,quote,price} from './economy.js';
export function player(name,id){return{id,name:name.slice(0,20),ready:false,cash:C.initialCash,inventory:{materials:30,parts:0,fuel:0},buildings:[{type:'materials',slot:5,level:1,readyAt:0,nextAt:8,status:'稼働中'},{type:'port',slot:9,level:1,readyAt:0,nextAt:0,status:'稼働中'}],access:[2,0,0],surveys:{},waiting:0,nextApplicant:5,score:0,launches:0,rocket:null,sales:0,costs:{production:0,trade:0,operation:0,investment:0,research:0},produced:{materials:0,parts:0,fuel:0},events:[]};}
function ensureDefaultFacilities(p){if(!p.buildings.some(b=>b.type==='port'))p.buildings.push({type:'port',slot:9,level:1,readyAt:0,nextAt:0,status:'稼働中'});}
export function room(code){return{code,phase:'lobby',elapsed:0,paused:false,players:[],markets:createMarkets(),events:[],epoch:0};}
const spend=(p,c,kind,goods={})=>{if(p.cash<c)throw Error(`資金が不足しています（必要 ¥${c.toLocaleString()}）`);for(const [g,n]of Object.entries(goods))if(p.inventory[g]<n)throw Error(`${C.goods[g].name}が${n-p.inventory[g]}個不足しています`);p.cash-=c;p.costs[kind]+=c;for(const [g,n]of Object.entries(goods))p.inventory[g]-=n;};
export const active=(p,type,t)=>p.buildings.filter(b=>b.type===type&&b.readyAt<=t);
export function shipSpec(r){return{capacity:C.rocket.capacity+(r.capacity-1)*15,fuel:Math.ceil(C.rocket.fuel*(1-(r.efficiency-1)*.2)),cycle:C.rocket.flight-(r.speed-1)*7};}
function dispatch(r,p,n){const ship=p.rocket;if(!ship||ship.phase!=='idle')throw Error('輸送船の準備が完了していません');const s=shipSpec(ship);if(!Number.isInteger(n)||n<1||n>s.capacity||n>p.waiting)throw Error('搭乗人数を確認してください');spend(p,C.rocket.operating,'operation',{fuel:s.fuel});p.waiting-=n;ship.passengers=n;ship.phase='boarding';ship.until=r.elapsed+C.rocket.boarding;ship.reason='';}
function event(r,p,text){r.events.unshift({at:r.elapsed,player:p.id,text});r.events.length=Math.min(r.events.length,20);}
export function command(r,p,a){
 ensureDefaultFacilities(p);
 if(a.type==='ready'){if(r.phase!=='lobby')throw Error('開始済みです');p.ready=true;if(r.players.length===2&&r.players.every(x=>x.ready)){r.phase='playing';r.elapsed=0;}return;}
 if(a.type==='rematch'){if(r.phase!=='ended')throw Error('試合終了後に再戦できます');p.rematch=true;if(r.players.every(x=>x.rematch)){r.players=r.players.map(x=>player(x.name,x.id));r.phase='lobby';r.elapsed=0;r.markets=createMarkets();r.events=[];r.epoch++;}return;}
 if(r.phase!=='playing'||r.paused)throw Error('試合が進行中ではありません');
 switch(a.type){
 case 'build': {const b=C.buildings[a.building];if(!Object.hasOwn(C.buildings,a.building)||!b||!Number.isInteger(a.slot)||a.slot<0||a.slot>=24)throw Error('区画または施設が不正です');if(p.buildings.some(x=>x.slot===a.slot))throw Error('取得済み区画です');if(a.building==='port'&&p.buildings.some(x=>x.type==='port'))throw Error('宇宙港は1社1か所です');spend(p,b.cost,'investment',{materials:b.materials});p.buildings.push({type:a.building,slot:a.slot,level:1,readyAt:r.elapsed+b.time,nextAt:r.elapsed+b.time+(C.goods[a.building]?.cycle||0),status:'建設中'});break;}
 case 'upgrade': {const b=p.buildings.find(x=>x.slot===a.slot);if(!b||b.readyAt>r.elapsed||b.level>=3||b.type==='port'||b.type==='logistics')throw Error('この施設は強化できません');spend(p,C.upgradeCost*b.level,'investment',{materials:C.upgradeMaterials});b.level++;break;}
 case 'toggleProduction':{const b=p.buildings.find(x=>x.slot===a.slot);if(!b||!C.goods[b.type])throw Error('工場を選んでください');b.off=!b.off;break;}
 case 'survey':{const m=r.markets[a.market];if(!m||a.market===0||p.access[a.market]||p.surveys[a.market])throw Error('調査できません');spend(p,m.survey,'research');p.surveys[a.market]=r.elapsed+m.time;break;}
 case 'enter':{const m=r.markets[a.market];if(!m||p.access[a.market]!==1)throw Error('先に調査してください');spend(p,m.entry,'investment');p.access[a.market]=2;break;}
 case 'trade':{const q=a.quote;if(!q||p.access[q.market]!==2)throw Error('市場へ参入してください');if(q.expires!==undefined&&r.elapsed>q.expires)throw Error('見積もりが期限切れです。再見積もりしてください');const m=r.markets[q.market];quote(m,q.good,q.side,q.n); // Revalidate capacity and quota, but honor the server-issued price.
if(q.side==='buy'){if(p.inventory[q.good]+q.n>C.inventoryCap)throw Error('自社在庫の上限です');spend(p,q.total,'trade');p.inventory[q.good]+=q.n;m.stock[q.good]-=q.n;}else{if(p.inventory[q.good]<q.n)throw Error('自社在庫が不足しています');p.inventory[q.good]-=q.n;p.cash+=q.total;p.sales+=q.gross;p.costs.trade+=q.fees;m.stock[q.good]+=q.n;m.quota-=q.n;}m.revision++;m.reasonTTL=5;m.reason=q.side==='buy'?'企業の購入で在庫減少':'企業の販売で在庫増加';break;}
 case 'rocket':if(p.rocket)throw Error('輸送船は1社1隻です');if(!active(p,'port',r.elapsed).length)throw Error('宇宙港の完成を待ってください');spend(p,C.rocket.cost,'investment',{materials:C.rocket.materials,parts:C.rocket.parts});p.rocket={phase:'building',until:r.elapsed+C.rocket.time,capacity:1,speed:1,efficiency:1,auto:false,passengers:0,reason:''};break;
 case 'shipUpgrade':{const s=p.rocket;if(!s||s.phase!=='idle'||!['capacity','speed','efficiency'].includes(a.kind)||s[a.kind]>=C.rocket.maxLevel)throw Error('待機中の船を選ぶか、強化段階を確認してください');spend(p,C.rocket.upgrade*s[a.kind],'investment',{parts:C.rocket.upgradeParts});s[a.kind]++;break;}
 case 'dispatch':dispatch(r,p,a.passengers);break;
 case 'auto':if(!p.rocket)throw Error('輸送船がありません');p.rocket.auto=!!a.enabled;break;
 default:throw Error('不明な操作です');
 }
}
export function advance(r,dt){
 if(r.phase!=='playing'||r.paused)return;
 const target=Math.min(C.duration,r.elapsed+dt);
 // Fixed substeps preserve event order even after an event-loop stall.
 while(r.elapsed<target){const step=Math.min(.25,target-r.elapsed);r.elapsed=Math.min(target,r.elapsed+step);const t=r.elapsed;
 for(const m of r.markets){marketTick(m,step);if(Math.floor(t/5)>Math.floor((t-step)/5))for(const g of Object.keys(C.goods)){m.history[g].push(price(m,g));if(m.history[g].length>48)m.history[g].shift();}}
 for(const p of r.players){
 for(const [id,until]of Object.entries(p.surveys))if(t>=until){p.access[id]=1;delete p.surveys[id];event(r,p,`${r.markets[id].name}の調査完了`);}
 for(const b of p.buildings){if(t<b.readyAt){b.status='建設中';continue;}b.status='稼働中';const g=C.goods[b.type];if(!g)continue;const n=g.batch*b.level;if(b.off)b.status='手動停止';else if(p.cash<g.cost*n)b.status='資金不足';else if(p.inventory[b.type]+n>C.inventoryCap)b.status='在庫上限';if(t>=b.nextAt){if(b.status==='稼働中'){spend(p,g.cost*n,'production');p.inventory[b.type]+=n;p.produced[b.type]+=n;}b.nextAt=t+g.cycle;}}
 if(t>=p.nextApplicant){const cap=active(p,'habitat',t).reduce((s,b)=>s+b.level*60,0);if(p.waiting<cap)p.waiting++;p.nextApplicant=t+C.applicantInterval;}
 const s=p.rocket;if(!s)continue;
 if(s.phase!=='idle'&&t>=s.until){switch(s.phase){case 'building':s.phase='idle';break;case 'boarding':s.phase='countdown';s.until+=C.rocket.countdown;break;case 'countdown':if(s.until<C.duration){p.score+=s.passengers;p.launches++;event(r,p,`${s.passengers}人が火星へ出発！`);}s.phase='flight';s.until+=shipSpec(s).cycle;break;case 'flight':s.phase='maintenance';s.until+=C.rocket.maintenance;break;case 'maintenance':s.phase='idle';s.passengers=0;break;}}
 if(s.phase==='idle'&&s.auto&&t<C.duration){try{dispatch(r,p,Math.min(p.waiting,shipSpec(s).capacity));}catch(e){s.reason=e.message;}}
 }
 }
 if(r.elapsed>=C.duration)r.phase='ended';
}
export function snapshot(r,id){return structuredClone({sequence:r.viewSequence=(r.viewSequence||0)+1,code:r.code,phase:r.phase,elapsed:r.elapsed,paused:r.paused,epoch:r.epoch,you:id,events:r.events,players:r.players.map(p=>p.id===id||r.phase==='ended'?p:{id:p.id,name:p.name,ready:p.ready,rematch:p.rematch,score:p.score,launches:p.launches,buildings:p.buildings.map(({type,slot,level,readyAt,status})=>({type,slot,level,readyAt,status})),rocket:p.rocket?{phase:p.rocket.phase,until:p.rocket.until,passengers:p.rocket.passengers}:null}),markets:r.markets.map((m,i)=>{const p=r.players.find(x=>x.id===id);return p?.access[i]>0?{...m,prices:Object.fromEntries(Object.keys(C.goods).map(g=>[g,price(m,g)]))}:{id:i,name:m.name,label:m.label,survey:m.survey,time:m.time};})});}
