import {C} from './config.js';
export function createRenderer(canvas,onSelect){
 const ctx=canvas.getContext('2d');let state=null,w=100,h=100,hit=[],running=true,frame;
 const colors=['#62e6c0','#ff997c'];
 const polygon=(points,fill,stroke)=>{ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.stroke();}};
 function resize(){const r=canvas.getBoundingClientRect();w=r.width;h=r.height;const d=devicePixelRatio||1;canvas.width=w*d;canvas.height=h*d;ctx.setTransform(d,0,0,d,0,0);}
 new ResizeObserver(resize).observe(canvas);
 function draw(now){if(!running)return;frame=requestAnimationFrame(draw);ctx.clearRect(0,0,w,h);if(!state)return;
 const scale=Math.min(w/1070,h/650),tw=62*scale,th=31*scale,ox=w/2-2*tw,oy=h*.12;
 const point=(x,y)=>[ox+(x-y)*tw,oy+(x+y)*th];hit=[];
 ctx.save();ctx.strokeStyle='#a4c8d510';for(let i=-14;i<20;i++){ctx.beginPath();ctx.moveTo(0,h/2+i*35);ctx.lineTo(w,h/2+i*35-100);ctx.stroke();}
 const tiles=Array.from({length:60},(_,i)=>({x:i%10,y:Math.floor(i/10)})).sort((a,b)=>a.x+a.y-b.x-b.y);
 for(const layer of [0,1])for(const {x,y} of tiles){
 const [sx,sy]=point(x,y),owner=x<4?0:x>5?1:null,slot=owner===0?y*4+x:owner===1?y*4+x-6:null;
 const p=state.players[owner],b=p?.buildings.find(b=>b.slot===slot),color=colors[owner]||'#637486';
 if(layer===0){polygon([[sx,sy],[sx+tw-2,sy+th-1],[sx,sy+2*th-2],[sx-tw+2,sy+th-1]],owner===null?'#202e36':owner===0?'#193a39':'#3b302f',owner===state.you?'#62e6c033':'#ffffff09');
 if(owner!==null){hit.push({x:sx,y:sy+th,tw,th,owner,slot});ctx.fillStyle=color+'55';ctx.font=`${9*scale}px monospace`;ctx.textAlign='center';ctx.fillText(String(slot+1).padStart(2,'0'),sx,sy+1.6*th);}
 continue;}
 if(!b)continue;
 const constructing=b.readyAt>state.elapsed,stopped=!['稼働中','建設中'].includes(b.status),z=(b.type==='port'?60:b.type==='habitat'?51:34+b.level*7)*scale*(constructing?.65:1),a=tw*.64,d=th*.64,base=sy+th;
 const face=stopped?'#655745':owner===0?'#33716d':'#926151';
 polygon([[sx-a,base],[sx,base+d],[sx,base+d-z],[sx-a,base-z]],face);
 polygon([[sx,base+d],[sx+a,base],[sx+a,base-z],[sx,base+d-z]],stopped?'#423a31':owner===0?'#20494a':'#5c403a');
 polygon([[sx-a,base-z],[sx,base-d-z],[sx+a,base-z],[sx,base+d-z]],constructing?'#596666':color+'b0',color+'88');
 if(constructing){ctx.setLineDash([4,4]);ctx.strokeStyle='#f5ce83';ctx.strokeRect(sx-a,base-z-d,a*2,z+d);ctx.setLineDash([]);}
 else if(b.type==='port'){
 const rocket=p.rocket,fly=rocket?.phase==='flight',count=rocket?.phase==='countdown';
 ctx.fillStyle='#15272e';ctx.fillRect(sx-4*scale,base-z-35*scale,5*scale,40*scale);
 if(rocket){const drift=fly?Math.min(220,(C.rocket.flight-(rocket.until-state.elapsed))*15):0,ry=base-z-15*scale-drift*scale;
 polygon([[sx+9*scale,ry-30*scale],[sx+16*scale,ry-17*scale],[sx+16*scale,ry+12*scale],[sx+2*scale,ry+12*scale],[sx+2*scale,ry-17*scale]],'#e7f2ee');
 ctx.fillStyle=color;ctx.fillRect(sx+4*scale,ry-11*scale,10*scale,6*scale);
 if(fly||count)polygon([[sx+2*scale,ry+12*scale],[sx+9*scale,ry+(26+Math.sin(now/60)*8)*scale],[sx+16*scale,ry+12*scale]],'#ffce74');}
 }else if(C.goods[b.type]&&!constructing){
 ctx.fillStyle='#a0c2be';ctx.fillRect(sx-15*scale,base-z-18*scale,7*scale,20*scale);
 if(!stopped)for(let j=0;j<3;j++){const t=(now/1300+j/3)%1;ctx.globalAlpha=(1-t)*.25;ctx.fillStyle='#abc9c3';ctx.beginPath();ctx.arc(sx-11*scale+t*10*scale,base-z-22*scale-t*30*scale,(4+t*7)*scale,0,7);ctx.fill();}ctx.globalAlpha=1;
 }
 if(!constructing){ctx.fillStyle='#cef4e5';for(let j=-1;j<=1;j++)ctx.fillRect(sx+j*9*scale-2*scale,base-z/2,3*scale,5*scale);}
 ctx.font=`600 ${10*scale}px sans-serif`;ctx.textAlign='center';ctx.fillStyle=constructing?'#f5ce83':stopped?'#ffc477':'#d7e7e3';ctx.fillText(C.buildings[b.type].name,sx,base+d+13*scale);
 }
 // Decorative vehicles and boarding passengers; no simulation state is changed here.
 for(let i=0;i<5;i++){const t=(now/7000+i/5)%1,[x,y]=point(4.5,t*5.3);ctx.fillStyle=colors[i%2];ctx.fillRect(x-5*scale,y-3*scale,10*scale,6*scale);ctx.fillStyle='#08171c';ctx.fillRect(x-2*scale,y-2*scale,3*scale,3*scale);}
 state.players.forEach((p,i)=>{const port=p.buildings.find(b=>b.type==='port');if(p.rocket?.phase==='boarding'&&port){const x=port.slot%4+(i?6:0),y=Math.floor(port.slot/4);for(let j=0;j<5;j++){const t=(now/1800+j/5)%1,[px,py]=point(x+.2,y+.6+t*.5);ctx.fillStyle=colors[i];ctx.beginPath();ctx.arc(px,py-5,2.5*scale,0,7);ctx.fill();}}});
 ctx.fillStyle='#62e6c0';ctx.font=`700 ${12*scale}px sans-serif`;ctx.textAlign='center';let [lx,ly]=point(1.5,6.5);ctx.fillText('A / '+state.players[0]?.name,lx,ly);[lx,ly]=point(7.5,6.5);ctx.fillStyle=colors[1];ctx.fillText('B / '+(state.players[1]?.name||'参加待ち'),lx,ly);ctx.restore();
 }
 canvas.addEventListener('click',e=>{const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;const found=hit.find(v=>Math.abs(x-v.x)/v.tw+Math.abs(y-v.y)/v.th<=1);if(found)onSelect(found);});
 canvas.addEventListener('mousemove',e=>{const r=canvas.getBoundingClientRect();canvas.style.cursor=hit.some(v=>v.owner===state?.you&&Math.abs(e.clientX-r.left-v.x)/v.tw+Math.abs(e.clientY-r.top-v.y)/v.th<=1)?'pointer':'default';});
 frame=requestAnimationFrame(draw);return{update(s){state=s;},stop(){running=false;cancelAnimationFrame(frame);}};
}
