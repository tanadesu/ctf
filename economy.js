import { C } from './config.js';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function price(m,g,stock=m.stock[g]){return Math.round(C.goods[g].base*m.factor*clamp(1+C.elasticity*(1-(Math.floor(stock/5)*5)/m.target),C.priceMin,C.priceMax)*100)/100;}
export function createMarkets(){return C.markets.map((c,id)=>({...c,id,stock:Object.fromEntries(Object.keys(C.goods).map(g=>[g,c.target])),quota:C.tradeCap,history:Object.fromEntries(Object.keys(C.goods).map(g=>[g,[]])),reason:'初期在庫',revision:0}));}
export function quote(m,g,side,n){
  if(!Object.hasOwn(C.goods,g)||!['buy','sell'].includes(side)||!Number.isSafeInteger(n)||n<1||n>C.maxOrder)throw Error('数量は1〜80の整数で指定してください');
  if(side==='buy'&&m.stock[g]<n)throw Error('市場在庫が不足しています');
  if(side==='sell'&&(m.stock[g]+n>C.marketCap||m.quota<n))throw Error('市場の取引枠または保管容量が不足しています');
  let gross=0; for(let i=0;i<n;i++)gross+=price(m,g,m.stock[g]+(side==='buy'?-i:i))*(side==='buy'?1+C.spread:1-C.spread);
  gross=Math.round(gross); const fees=n*m.fee;return{market:m.id,good:g,side,n,gross,fees,total:side==='buy'?gross+fees:gross-fees,revision:m.revision};
}
export function marketTick(m,dt){
  for(const g of Object.keys(C.goods)){
    const before=m.stock[g],ratio=price(m,g)/(C.goods[g].base*m.factor);
    m.stock[g]=clamp(before+m.supply*dt-m.consume*dt/Math.max(.5,ratio),0,C.marketCap);
    if(Math.abs(m.stock[g]-before)>.00001)m.revision++;
  }
  m.quota=Math.min(C.tradeCap,m.quota+C.tradeRefill*dt);
  m.reasonTTL=Math.max(0,(m.reasonTTL||0)-dt);if(!m.reasonTTL)m.reason='NPC企業の消費・有限補充';
}
