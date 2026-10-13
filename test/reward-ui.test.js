import test from 'node:test';
import assert from 'node:assert/strict';
import {showReward} from '../reward-ui.js';
class Element{
 constructor(tag){this.tag=tag;this.children=[];this.isConnected=true;this.textContent='';}
 append(...nodes){this.children.push(...nodes);}
 replaceChildren(...nodes){this.children=nodes;}
 setAttribute(){}
 remove(){this.isConnected=false;}
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
test('result UI: own QR, zero, early finish, retry and stale results',async()=>{
 const previous=globalThis.document;globalThis.document={createElement:tag=>new Element(tag)};
 try{
  const card=new Element('section');showReward(card,{eligible:true,request:async()=>({coins:10000,qrImageDataUrl:'data:image/png;base64,aGVsbG8=',expiresAt:1900000000})});await settle();
  assert.match(card.children[1].textContent,/10,000枚/);assert.equal(card.children[2].children[0].tag,'img');assert.match(card.children[2].children[0].src,/^data:image\/png/);
  const zero=new Element('section');showReward(zero,{eligible:true,request:async()=>({coins:0})});await settle();assert.match(zero.children[1].textContent,/0枚/);assert.ok(!zero.children[2].children.some(x=>x.tag==='img'));
  showReward(new Element('section'),{eligible:false,request:()=>assert.fail('early finish must not request')});
  let attempts=0;const retry=new Element('section');showReward(retry,{eligible:true,request:async()=>{if(!attempts++)throw Error('付与数確認中');return{coins:0};}});await settle();assert.match(retry.children[1].textContent,/付与数確認中/);assert.equal(retry.children[3].hidden,false);await retry.children[3].onclick();assert.match(retry.children[1].textContent,/0枚/);
  let release;const stale=new Element('section');showReward(stale,{eligible:true,isCurrent:()=>false,request:()=>new Promise(resolve=>release=resolve)});release({coins:10000});await settle();assert.equal(stale.children[2].children.length,0);
 }finally{globalThis.document=previous;}
});
