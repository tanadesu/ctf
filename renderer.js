import {C} from './config.js';

// A regular hex lattice with every tile inset by the same amount.
// Slot indices stay row-major (4 columns x 6 rows), including spaceport slot 9.
export function mapLayout(w,h){
 const scale=Math.min(w/760,h/500),radius=50*scale,rx=radius*.8,ry=rx*Math.sqrt(3)/2;
 const stepY=radius*Math.sqrt(3)/2;
 const ox=w/2+radius*1.5,oy=(h-(stepY*8+ry*2+36*scale))/2+ry;
 return {scale,rx,ry,point:(x,y)=>[ox+(x-y)*radius*1.5,oy+(x+y)*stepY]};
}
export function insideHex(x,y,v){
 const dx=Math.abs(x-v.cx),dy=Math.abs(y-v.cy);
 return dy<=v.ry&&dx<=v.rx*(1-dy/(2*v.ry));
}
export function createRenderer(canvas,onSelect){
 const ctx=canvas.getContext('2d');let state=null,w=100,h=100,hit=[],running=true,frame,view='self';
 const colors=['#62e6c0','#ff997c'];
 const sprites=Object.fromEntries(Object.keys(C.buildings).map(type=>{const image=new Image();image.src=`assets/buildings/hex-v2/${type}.png`;return[type,image];}));
 const hexPath=(cx,cy,rx,ry)=>{ctx.beginPath();[[cx-rx,cy],[cx-rx*.5,cy-ry],[cx+rx*.5,cy-ry],[cx+rx,cy],[cx+rx*.5,cy+ry],[cx-rx*.5,cy+ry]].forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();};
 const polygon=(points,color)=>{ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle=color;ctx.fill();};
 function resize(){const r=canvas.getBoundingClientRect();w=r.width;h=r.height;const d=devicePixelRatio||1;canvas.width=w*d;canvas.height=h*d;ctx.setTransform(d,0,0,d,0,0);}
 const observer=new ResizeObserver(resize);observer.observe(canvas);
 function draw(now){
 if(!running)return;frame=requestAnimationFrame(draw);ctx.clearRect(0,0,w,h);if(!state||w<=0||h<=0)return;
 const {scale,rx,ry,point}=mapLayout(w,h),owner=view==='rival'?1-state.you:state.you,p=state.players[owner],color=colors[owner];
 hit=Array.from({length:24},(_,slot)=>{const[cx,cy]=point(slot%4,Math.floor(slot/4));return{cx,cy,rx,ry,owner,slot};});
 ctx.save();
 for(const tile of hit){
 const {cx,cy,slot}=tile,b=p?.buildings.find(b=>b.slot===slot);
 hexPath(cx,cy,rx,ry);ctx.fillStyle=owner===0?'#193a39':'#3b302f';ctx.fill();ctx.strokeStyle=color+'88';ctx.lineWidth=1.2*scale;ctx.stroke();
 if(!b){ctx.fillStyle=color+'aa';ctx.font=`${10*scale}px monospace`;ctx.textAlign='center';ctx.fillText(String(slot+1).padStart(2,'0'),cx,cy+4*scale);continue;}
 const constructing=b.readyAt>state.elapsed,stopped=!['稼働中','建設中'].includes(b.status),sprite=sprites[b.type];
 ctx.save();hexPath(cx,cy,rx*.96,ry*.96);ctx.clip();
 if(sprite?.complete&&sprite.naturalWidth){
 ctx.globalAlpha=constructing?.55:1;if(stopped)ctx.filter='saturate(0.45)';
 const size=rx*2.12;ctx.drawImage(sprite,cx-size/2,cy-size/2,size,size);
 }else{ctx.font=`${24*scale}px sans-serif`;ctx.textAlign='center';ctx.fillStyle=color;ctx.fillText(C.buildings[b.type].icon,cx,cy);}
 ctx.restore();
 if(constructing){ctx.save();ctx.setLineDash([4*scale,3*scale]);hexPath(cx,cy,rx*.94,ry*.94);ctx.strokeStyle='#f5ce83';ctx.stroke();ctx.restore();}
 if(b.type==='port'&&!constructing&&p.rocket){
 const rocket=p.rocket,fly=rocket.phase==='flight',count=rocket.phase==='countdown';
 const drift=fly?Math.max(0,Math.min(220,(C.rocket.flight-(rocket.until-state.elapsed))*15))*scale:0;
 const py=cy-drift;
 // The parked rocket is small enough to fit within its own hexagon.
 ctx.save();if(!fly){hexPath(cx,cy,rx*.96,ry*.96);ctx.clip();}
 polygon([[cx,py-17*scale],[cx+4*scale,py-9*scale],[cx+4*scale,py+5*scale],[cx-4*scale,py+5*scale],[cx-4*scale,py-9*scale]],'#e7f2ee');
 ctx.fillStyle=color;ctx.fillRect(cx-3*scale,py-6*scale,6*scale,3*scale);
 if(fly||count)polygon([[cx-3*scale,py+5*scale],[cx,py+(12+Math.sin(now/60)*3)*scale],[cx+3*scale,py+5*scale]],'#ffce74');
 ctx.restore();
 }
 if(b.type==='port'&&p.rocket?.phase==='boarding')for(let j=0;j<4;j++){const t=(now/1800+j/4)%1;ctx.fillStyle=color;ctx.beginPath();ctx.arc(cx-rx*.4+t*rx*.3,cy+ry*.3,1.4*scale,0,Math.PI*2);ctx.fill();}
 }
 // Draw all labels last, inside their own tiles, so neighbours cannot cover them.
 for(const {cx,cy,slot} of hit){const b=p?.buildings.find(b=>b.slot===slot);if(!b)continue;
 const constructing=b.readyAt>state.elapsed,stopped=!['稼働中','建設中'].includes(b.status);
 const name=b.type==='habitat'?'滞在施設':C.buildings[b.type].name;
 ctx.save();hexPath(cx,cy,rx*.96,ry*.96);ctx.clip();
 ctx.fillStyle='#0b1822ed';ctx.fillRect(cx-rx*.69,cy+ry*.52,rx*1.38,12*scale);
 ctx.font=`600 ${8*scale}px sans-serif`;ctx.textAlign='center';ctx.fillStyle=constructing?'#f5ce83':stopped?'#ffc477':'#effaf6';
 ctx.fillText(`${slot+1} ${name}`,cx,cy+ry*.52+9*scale,rx*1.12);ctx.restore();
 }
 const lastY=point(3,5)[1];ctx.fillStyle=color;ctx.font=`700 ${12*scale}px sans-serif`;ctx.textAlign='center';ctx.fillText((owner?'B / ':'A / ')+(p?.name||'参加待ち'),w/2,lastY+ry+25*scale);ctx.restore();
 }
 canvas.addEventListener('click',e=>{const r=canvas.getBoundingClientRect();const found=hit.find(v=>insideHex(e.clientX-r.left,e.clientY-r.top,v));if(found)onSelect(found);});
 canvas.addEventListener('mousemove',e=>{const r=canvas.getBoundingClientRect();canvas.style.cursor=hit.some(v=>v.owner===state?.you&&insideHex(e.clientX-r.left,e.clientY-r.top,v))?'pointer':'default';});
 frame=requestAnimationFrame(draw);return{update(s){state=s;},setView(next){view=next==='rival'?'rival':'self';},stop(){running=false;cancelAnimationFrame(frame);observer.disconnect();}};
}
