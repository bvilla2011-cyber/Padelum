/* PADELUM | Cinematic 2D Art Direction
   Procedural vector additions. No sprites, no external assets or gameplay dependencies.
   Drawn in the same Canvas 2D camera/projection as the original game. */
(function(){
'use strict';
const TAU=Math.PI*2, effects=[];
let audio=null, soundEnabled=true;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const edge=(g,side,y)=>g.c+side*g.w*(.54+.45*y);
const yy=(g,y)=>g.top+(g.bottom-g.top)*y;
function poly(c,points){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();}
function line(c,a,b,color,width=1){c.beginPath();c.moveTo(a[0],a[1]);c.lineTo(b[0],b[1]);c.strokeStyle=color;c.lineWidth=width;c.stroke();}
function glow(c,x,y,rx,ry,color){c.save();c.translate(x,y);c.scale(rx,ry);let g=c.createRadialGradient(0,0,0,0,0,1);g.addColorStop(0,color);g.addColorStop(1,'#ffffff00');c.fillStyle=g;c.beginPath();c.arc(0,0,1,0,TAU);c.fill();c.restore();}
function rounded(c,x,y,w,h,r){c.beginPath();c.roundRect(x,y,w,h,r);}
function rand(n){const s=Math.sin(n*127.1+31.97)*43758.5453;return s-Math.floor(s)}
function stadium(c,g){
 const {W,H,t,top,bottom,w}=g, cy=g.c, d=bottom-top;
 c.save();
 // Immersive stadium shell, recessed bays, decorative bracing, and perimeter steps.
 for(let side of [-1,1]){
  let outside=cy+side*w*1.1;
  c.fillStyle='#0b2218';poly(c,[[outside,top-20],[cy+side*w*1.39,top-59],[cy+side*w*1.75,bottom+55],[cy+side*w*1.04,bottom+35]]);c.fill();
  c.strokeStyle='#7d9f8b77';c.lineWidth=3;
  for(let i=0;i<10;i++){
   let y=top-25+i*(d+65)/10, x=cy+side*w*(1.1+.19*i/10);
   line(c,[x,y],[x+side*w*.29,y+13],'#9bb8a638',1.1);
   line(c,[x,y],[x+side*w*.1,y-44],'#c8ddc124',1);
  }
  // Embossed padded sponsor panels in the court apron.
  for(let i=0;i<4;i++){
   let v=(i+.22)/4.5, x=edge(g,side,v)+side*(22+v*15), y=yy(g,v);
   c.save();c.translate(x,y);c.transform(1,0,side*.16,1,0,0);
   let wid=clamp(w*.22,35,94)*(1+v*.3), ht=12+v*7;
   c.fillStyle='#061b14';rounded(c,side<0?-wid:0,-ht,wid,ht,3);c.fill();
   c.strokeStyle=i%2?'#f9ad82':'#ccf76f';c.lineWidth=1.4;c.stroke();
   c.fillStyle=i%2?'#f8b18e':'#e5ff95';c.textAlign='center';
   c.font='900 '+Math.floor(7+v*2)+'px sans-serif';
   c.fillText(['PADELUM','COURT CLUB','UNIFORMER','PLAY HARD'][i],side<0?-wid*.5:wid*.5,-ht*.35);
   c.restore();
  }
  // Bottom service aisle, guardrail and layered chrome profile.
  let x1=cy+side*w*1.03,x2=cy+side*w*1.23;
  poly(c,[[x1,bottom],[x2,bottom+8],[x2,bottom+24],[x1,bottom+14]]);
  c.fillStyle='#34483a';c.fill();
  line(c,[x1,bottom],[x2,bottom+8],'#d7e1c28c',2);
  // Floodlight poles and their bloom.
  let lx=cy+side*w*1.22,ly=top-33;
  line(c,[lx,bottom+18],[lx,ly],'#9eaea1',4);
  for(let j=0;j<3;j++){
   let py=ly+j*11;
   c.fillStyle='#1c2b22';rounded(c,lx-12,py-5,24,8,1);c.fill();
   c.fillStyle='#f7f0d4';c.fillRect(lx-9,py-3,18,3);
   glow(c,lx,py,35,43,'#fff2ce24');
  }
 }
 // Projection of hanging trusses over the far side.
 for(let i=0;i<8;i++){
  let x=(i+.5)/8*W,y=top-74+(i%2)*2;
  line(c,[x-28,y],[x+28,y],'#a5c4b04b',2);
  line(c,[x-28,y],[x,y+13],'#a5c4b02d',1);
  line(c,[x+28,y],[x,y+13],'#a5c4b02d',1);
 }
 // Volumetric sunlight wash changes subtly through time.
 let sunX=cy-w*.8;
 let beam=c.createLinearGradient(sunX-w*.32,top,sunX+w*.95,bottom);
 beam.addColorStop(0,'#ffe7b300');beam.addColorStop(.28,'#ffe7b312');beam.addColorStop(.7,'#ffe7b304');beam.addColorStop(1,'#ffe7b300');
 c.fillStyle=beam;poly(c,[[sunX,top-90],[sunX+w*.2,top-90],[sunX+w*1.4,bottom+30],[sunX-w*.3,bottom+30]]);c.fill();
 c.restore();
}
function turf(c,g){
 const {top,bottom,w,t}=g,cy=g.c,d=bottom-top;
 c.save();
 poly(c,[[edge(g,-1,0),top],[edge(g,1,0),top],[edge(g,1,1),bottom],[edge(g,-1,1),bottom]]);
 c.clip();
 // Cut-grass tessellation and directional fibre. Fixed seeded texture (no flickering).
 for(let i=0;i<240;i++){
  let q=rand(i+4),v=rand(i+911),x=cy+(q-.5)*w*2.5,y=top+v*d;
  c.globalAlpha=.12+.17*rand(i+18);
  c.strokeStyle=i%4===0?'#c6e7a3':i%4===1?'#071d10':'#e4f4d3';
  c.lineWidth=.55+(v*.75);c.beginPath();c.moveTo(x,y);c.lineTo(x+.8+v*1.6,y-2-v*2);c.stroke();
 }
 c.globalAlpha=1;
 // Alternating inlaid performance turf panels.
 for(let k=0;k<7;k++){
  const v=k/7,q=(k+1)/7,a=yy(g,v),b=yy(g,q);
  c.fillStyle=k%2?'#d2ffad07':'#072a1812';
  poly(c,[[edge(g,-1,v),a],[edge(g,1,v),a],[edge(g,1,q),b],[edge(g,-1,q),b]]);c.fill();
 }
 // Authentic service lines and geometric acrylic coatings.
 c.strokeStyle='#f4f2dfbd';c.lineWidth=1.6;c.shadowColor='#e7ffe6';c.shadowBlur=2;
 for(let y of [.24,.76])line(c,[edge(g,-1,y),yy(g,y)],[edge(g,1,y),yy(g,y)],'#f9f9e1ce',1.6);
 line(c,[cy,yy(g,.24)],[cy,yy(g,.76)],'#e6f5d0c0',1.4);
 c.shadowBlur=0;
 // Low poly facets, very subtle.
 for(let i=0;i<55;i++){
  let v=rand(i+499),q=rand(i+113),x=cy+(q-.5)*w*(1+v*.55),y=top+d*v;
  let s=4+rand(i+8)*16;
  c.fillStyle=i%2?'#fff5d607':'#07251c0b';
  poly(c,[[x-s,y],[x+s*.6,y-s*.6],[x+s*1.3,y+s*.8]]);c.fill();
 }
 // Ghosted court identity printed into the surface.
 c.save();c.translate(cy,yy(g,.7));c.scale(1,.44);c.rotate(-.035);
 c.globalAlpha=.065;c.fillStyle='#eaffc7';c.font='900 '+Math.max(24,w*.25)+'px sans-serif';
 c.textAlign='center';c.fillText('PADELUM',0,0);c.restore();
 c.restore();
}
function glass(c,g){
 const {top,bottom,w,t}=g,cy=g.c;
 c.save();
 // Four depth-graded panoramic glass segments and aluminium supports per side.
 for(let side of [-1,1]){
  for(let k=0;k<6;k++){
   let a=k/6,b=(k+1)/6,xa=edge(g,side,a),xb=edge(g,side,b),
       ya=yy(g,a),yb=yy(g,b),ha=27+65*a,hb=27+65*b;
   let grad=c.createLinearGradient(xa,ya-ha,xb,yb);
   grad.addColorStop(0,side<0?'#defcff10':'#c6eaff19');
   grad.addColorStop(.35,'#e0f7e909');
   grad.addColorStop(1,'#d0f4ee04');
   poly(c,[[xa,ya-ha],[xb,yb-hb],[xb,yb],[xa,ya]]);
   c.fillStyle=grad;c.fill();
   c.strokeStyle='#b9d2bc4d';c.lineWidth=1;c.stroke();
   c.save();c.clip();
   let offset=((t*.009)%180)/180;
   c.fillStyle='#ffffff15';
   poly(c,[[xa-24+offset*21,ya-ha-3],[xa-9+offset*21,ya-ha-3],[xb+25+offset*35,yb],[xb+8+offset*35,yb]]);c.fill();
   c.fillStyle='#daffe50b';
   poly(c,[[xa+9,ya-ha],[xa+18,ya-ha],[xb+34,yb],[xb+19,yb]]);c.fill();
   c.restore();
   // Gasket, brackets, mullions, bolts.
   line(c,[xa,ya-ha],[xa,ya],'#183e327a',4.2);
   line(c,[xa,ya-ha],[xa,ya],'#b9d8c5c9',1.3);
   for(let h of [.17,.82]){
    let vy=ya-ha*(1-h);
    c.fillStyle='#dfe4db88';c.beginPath();c.arc(xa,vy,1.6,0,TAU);c.fill();
   }
   line(c,[xa,ya-ha],[xb,yb-hb],'#c9e0c68c',1.5);
  }
  let near=edge(g,side,1),far=edge(g,side,0);
  line(c,[far,top-27],[near,bottom-92],'#e2f5e1b6',2);
  line(c,[far,top],[near,bottom],'#d7e6dfd2',2.5);
  // Steel mesh around the upper half of fence.
  for(let v=.05;v<=.95;v+=.065){
   let x=edge(g,side,v),y=yy(g,v),h=27+65*v;
   line(c,[x,y-h],[x,y-h*.15],'#dcead72a',.6);
  }
 }
 // Rear acrylic glass with a broad diagonal glint.
 c.save();let gx=cy-w*.54;
 c.beginPath();c.rect(gx,top-47,w*1.08,47);c.clip();
 let shimmer= Math.sin(t*.0004)*15;
 c.fillStyle='#e2fff014';
 poly(c,[[gx+w*.12+shimmer,top-47],[gx+w*.23+shimmer,top-47],[gx+w*.4+shimmer,top],[gx+w*.28+shimmer,top]]);c.fill();
 c.strokeStyle='#c8e1d955';c.lineWidth=1;
 for(let k=0;k<6;k++){
  let x=gx+w*1.08*k/6;line(c,[x,top-47],[x,top],'#c9e9d34c',1);
 }
 c.restore();
 c.restore();
}
function details(c,g){
 const {top,bottom,w,H,W,t}=g,cy=g.c;
 c.save();
 // Net knots, centre strap and a branded tournament ribbon.
 let ny=yy(g,.5),nw=w*1.19;
 c.strokeStyle='#142c2478';c.lineWidth=.6;
 for(let x=cy-nw/2+3;x<cy+nw/2;x+=5.5){
  for(let y=ny-5;y<ny+7;y+=4.5){
   c.beginPath();c.moveTo(x,y);c.lineTo(x+2.8,y+2.2);c.lineTo(x+5.5,y);c.stroke();
  }
 }
 let band=c.createLinearGradient(cy,ny-8,cy,ny-4);
 band.addColorStop(0,'#f9f7eb');band.addColorStop(1,'#acbbb2');c.fillStyle=band;
 c.fillRect(cy-10,ny-8,20,5);
 c.fillStyle='#223a30';c.font='900 5.5px sans-serif';c.textAlign='center';c.fillText('P',cy,ny-3.5);
 line(c,[cy,ny-3],[cy,ny+12],'#e7efe7a0',1.6);
 // Track-level illuminated court-boundary edge.
 for(let side of [-1,1]){
  let a=[edge(g,side,0),top],b=[edge(g,side,1),bottom];
  c.save();c.shadowBlur=10;c.shadowColor='#d7ffc990';
  line(c,[a[0]+side*2,a[1]],[b[0]+side*2,b[1]],'#d7f7bb99',1.1);c.restore();
  // Camera mounting pods near the front corners.
  let cx=b[0]+side*14,by=bottom+4;
  c.fillStyle='#263d35';rounded(c,cx-9,by-8,18,11,2);c.fill();
  c.strokeStyle='#9db6a0';c.lineWidth=1;c.stroke();
  c.fillStyle='#9de7de';c.beginPath();c.arc(cx,by-3,3.4,0,TAU);c.fill();
  glow(c,cx,by-3,18,12,'#7be9df26');
 }
 // Dust drifting through stadium beams, fixed spatial distribution.
 for(let i=0;i<52;i++){
  let x=rand(i+66)*W+Math.sin(t*.0004+i)*5,y=rand(i+107)*H;
  if(x>cy-w*.9&&x<cy+w*.9&&y>top&&y<bottom)continue;
  let alpha=.12+.18*(.5+.5*Math.sin(t*.0018+i));
  c.globalAlpha=alpha;c.fillStyle=i%3?'#fff2ca':'#d8f5d8';
  c.beginPath();c.arc(x,y,.5+rand(i+4)*1.1,0,TAU);c.fill();
 }
 c.globalAlpha=1;c.restore();
}
function kit(c,p,t,bob){
 const side=!!p.side,co=side?'#ffe3d5':'#fafdd6',dark=side?'#8e3d36':'#506a24';
 c.save();
 // Sportswear panelling, ribbing, breathable shoulders and embossed badge.
 c.lineJoin='round';
 c.strokeStyle=co;c.globalAlpha=.48;c.lineWidth=1.5;
 c.beginPath();c.moveTo(-12,-42);c.lineTo(-7,-31);c.moveTo(12,-42);c.lineTo(7,-31);c.stroke();
 c.globalAlpha=.7;c.strokeStyle=dark;c.lineWidth=1;
 for(let i=0;i<4;i++){
  c.beginPath();c.moveTo(-13,-36+i*4);c.lineTo(-7,-35+i*4);c.stroke();
  c.beginPath();c.moveTo(8,-36+i*4);c.lineTo(14,-35+i*4);c.stroke();
 }
 c.globalAlpha=1;c.fillStyle='#17251f';rounded(c,-6,-49,12,7,2);c.fill();
 c.fillStyle='#f7fff0';c.font='900 6px sans-serif';c.textAlign='center';c.fillText(side?'02':'01',0,-43.5);
 c.strokeStyle=co;c.lineWidth=1.6;
 c.beginPath();c.moveTo(-11,-46);c.quadraticCurveTo(0,-40,11,-46);c.stroke();
 c.fillStyle='#ffffff38';c.beginPath();c.ellipse(-8,-31,4,1.3,.1,0,TAU);c.fill();
 // Shorts seams and elastic waistband.
 c.fillStyle=dark;c.fillRect(-14,-18,28,3);
 c.strokeStyle='#e6f3d577';c.lineWidth=1;
 c.beginPath();c.moveTo(0,-16);c.lineTo(0,-13);c.stroke();
 // Face: modeled ears, animated blink, nose, eyes, highlights and hair strands.
 let hy=-64-bob*.2, blink=(Math.sin(t*.0011+(side?6:2))>.997);
 c.fillStyle='#c88f6b';c.beginPath();c.ellipse(-11,hy+1,2.6,4.7,0,0,TAU);c.ellipse(11,hy+1,2.6,4.7,0,0,TAU);c.fill();
 c.strokeStyle='#6a4230';c.lineWidth=.95;c.beginPath();
 c.moveTo(-6,hy);c.lineTo(-3,hy-.6);c.moveTo(3,hy-.6);c.lineTo(6,hy);c.stroke();
 c.strokeStyle='#332820';c.lineWidth=blink?1.2:.85;
 c.beginPath();c.moveTo(-5.6,hy+2.5);c.lineTo(-3.2,hy+2.5+(blink?0:.9));c.moveTo(3.2,hy+2.5+(blink?0:.9));c.lineTo(5.6,hy+2.5);c.stroke();
 c.fillStyle='#b2795a';c.beginPath();c.arc(0,hy+5.1,1.25,0,TAU);c.fill();
 c.strokeStyle='#854c3c88';c.lineWidth=1;c.beginPath();c.arc(0,hy+6.8,2.7,.25,Math.PI-.25);c.stroke();
 c.strokeStyle=side?'#211916':'#37231a';c.lineWidth=1.4;
 for(let i=0;i<5;i++){
  let x=-8+i*3.6;c.beginPath();c.moveTo(x,hy-8);c.lineTo(x+1.7,hy-11-(i%3));c.stroke();
 }
 c.restore();
}
function playerTrace(c,p,t,q,scale){
 const velocity=Math.hypot(p.vx||0,p.vy||0);
 if(velocity<.004) return;
 c.save();
 let alpha=clamp((velocity-.003)*80,0,.55);
 c.strokeStyle=p.side?'#ffa38b':'#eaff93';c.globalAlpha=alpha;
 c.lineWidth=1.25;c.lineCap='round';
 let stride=p.step||0;
 for(let i=0;i<4;i++){
  let x=q.x+(i-2)*10*scale,y=q.y+3+Math.sin(stride+i)*3*scale;
  c.beginPath();c.moveTo(x,y);c.lineTo(x-(p.vx||0)*2200-i*.4,y-(p.vy||0)*650);c.stroke();
 }
 c.globalAlpha=alpha*.48;glow(c,q.x,q.y+2,31*scale,9*scale,p.side?'#ffa38b66':'#ecff9e6c');c.restore();
}
function impact(x,y,kind='hit',power=false){
 effects.push({x,y,kind,power,start:performance.now(),life:power?680:kind==='bounce'?360:490});
 if(effects.length>24)effects.splice(0,effects.length-24);
}
function point(who){
 effects.push({kind:'point',who,start:performance.now(),life:1550});
 if(effects.length>24)effects.shift();
}
function frame(c,g){
 const {W,H,t,score}=g;
 c.save();
 // Broadcast grade: atmospheric falloff and thin anamorphic glints.
 let vign=c.createRadialGradient(W*.5,H*.48,Math.min(W,H)*.26,W*.5,H*.48,Math.max(W,H)*.77);
 vign.addColorStop(0,'#00000000');vign.addColorStop(.75,'#08120c05');vign.addColorStop(1,'#030e0a55');
 c.fillStyle=vign;c.fillRect(0,0,W,H);
 c.fillStyle='#ebffbd12';c.fillRect(0,0,W,1);
 c.fillStyle='#00000029';c.fillRect(0,H-7,W,7);
 // Tournament broadcast corner marks, anchored clear of HUD controls.
 c.strokeStyle='#e1f8d24a';c.lineWidth=1;
 for(let s of [-1,1]){
  let x=s<0?15:W-15;
  line(c,[x,H-31],[x,H-18],'#e1f8d24a',1);
  line(c,[x,H-18],[x-s*13,H-18],'#e1f8d24a',1);
 }
 c.font='800 9px sans-serif';c.textAlign='center';
 c.fillStyle='#e1f7df95';c.fillText('P A D E L U M   /   C O U R T   C L U B',W*.5,H-13);
 // Time-based screen-space impact halos and sparks, independent of game simulation.
 const now=performance.now();
 for(let i=effects.length-1;i>=0;i--){
  const fx=effects[i],p=(now-fx.start)/fx.life;
  if(p>=1){effects.splice(i,1);continue}
  if(fx.kind==='point'){
   let fade=Math.min(1,p*7,(1-p)*5);
   c.save();c.globalAlpha=clamp(fade,0,1);
   let y=H*.33-12*Math.sin(Math.min(p,1)*Math.PI);
   let grd=c.createLinearGradient(W*.18,y,W*.82,y);
   grd.addColorStop(0,'#061f1b00');grd.addColorStop(.3,'#061f1bcb');grd.addColorStop(.7,'#061f1bcb');grd.addColorStop(1,'#061f1b00');
   c.fillStyle=grd;c.fillRect(W*.13,y-34,W*.74,69);
   c.fillStyle=fx.who===0?'#eaff65':'#ffa083';c.textAlign='center';
   c.font='900 '+clamp(W*.045,21,43)+'px sans-serif';
   c.shadowBlur=18;c.shadowColor=c.fillStyle;
   c.fillText('¡PUNTO '+(fx.who===0?'LOCAL':'RIVAL')+'!',W*.5,y+9);
   c.restore();
  }else{
   c.save();c.globalAlpha=(1-p)*.87;
   c.strokeStyle=fx.power?'#ffb74c':fx.kind==='bounce'?'#dffc9b':'#f6f1d8';
   c.shadowColor=c.strokeStyle;c.shadowBlur=fx.power?24:9;
   c.lineWidth=(fx.power?4:2)*(1-p*.7);
   c.beginPath();c.ellipse(fx.x,fx.y,(7+(fx.power?65:27)*p),(3+(fx.power?28:14)*p),0,0,TAU);c.stroke();
   const count=fx.power?16:fx.kind==='bounce'?5:9;
   for(let j=0;j<count;j++){
    let a=j*TAU/count+rand(j+20),r=(fx.power?78:36)*p;
    let x=fx.x+Math.cos(a)*r,y=fx.y+Math.sin(a)*r*.73;
    c.globalAlpha=(1-p)*(.4+.6*rand(j+3));
    c.beginPath();c.arc(x,y,fx.power?1.8:1.15,0,TAU);c.fillStyle=fx.power?'#ffca77':'#d9ff9f';c.fill();
   }
   c.restore();
  }
 }
 c.restore();
}
function ensureAudio(){
 if(!soundEnabled)return null;
 if(!audio){
  try{const A=window.AudioContext||window.webkitAudioContext;if(!A)return null;audio=new A()}catch(_){return null}
 }
 if(audio.state==='suspended')audio.resume().catch(()=>{});
 return audio;
}
function sound(kind,power=false){
 const a=ensureAudio();if(!a||a.state!=='running')return;
 try{
  let now=a.currentTime,osc=a.createOscillator(),vol=a.createGain(),filter=a.createBiquadFilter();
  const defs={start:[550,420,.17,.08],hit:[power?220:370,power?82:185,.12,power?.13:.075],bounce:[205,135,.075,.026],point:[580,850,.34,.065],serve:[440,265,.095,.045]};
  const [f,e,d,v]=defs[kind]||defs.hit;
  osc.type=kind==='point'?'sine':kind==='hit'?'triangle':'sine';
  filter.type='lowpass';filter.frequency.value=kind==='hit'?1400:1150;
  osc.frequency.setValueAtTime(f,now);
  osc.frequency.exponentialRampToValueAtTime(e,now+d);
  vol.gain.setValueAtTime(.0001,now);
  vol.gain.exponentialRampToValueAtTime(v,now+.006);
  vol.gain.exponentialRampToValueAtTime(.0001,now+d);
  osc.connect(filter);filter.connect(vol);vol.connect(a.destination);
  osc.start(now);osc.stop(now+d+.012);
 }catch(_){}
}
window.PADELUMArt={stadium,turf,glass,details,kit,playerTrace,impact,point,frame,sound,unlock:ensureAudio};
})();
