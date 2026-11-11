/* PADELUM Showcase — high-detail articulated 2D athletes and result cinematics.
   All geometry is original Canvas artwork; no external sprites or render dependencies. */
(function(){
'use strict';
const TAU=Math.PI*2;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const smooth=x=>x*x*(3-2*x);
const rnd=i=>{let x=Math.sin(i*91.37+1.29)*43843.5453;return x-Math.floor(x)};
let raf=0,lastResultTime=0,win=true,firstFrame=0;
const el=()=>document.getElementById('resultCinematic');
function poly(c,pts){c.beginPath();pts.forEach((p,i)=>{if(i)c.lineTo(p[0],p[1]);else c.moveTo(p[0],p[1])});c.closePath()}
function limb(c,pts,width,color){
 c.lineCap='round';c.lineJoin='round';c.beginPath();c.moveTo(pts[0][0],pts[0][1]);
 if(pts.length===3)c.quadraticCurveTo(pts[1][0],pts[1][1],pts[2][0],pts[2][1]);
 else for(let i=1;i<pts.length;i++)c.lineTo(pts[i][0],pts[i][1]);
 c.strokeStyle='#172923';c.lineWidth=width+4;c.stroke();
 c.strokeStyle=color;c.lineWidth=width;c.stroke();
}
function circle(c,x,y,rad,fill){c.fillStyle=fill;c.beginPath();c.arc(x,y,rad,0,TAU);c.fill()}
function gradient(c,x1,y1,x2,y2,colors){
 let g=c.createLinearGradient(x1,y1,x2,y2);
 colors.forEach(([at,color])=>g.addColorStop(at,color));return g;
}
function softGlow(c,x,y,r,color){
 c.save();let g=c.createRadialGradient(x,y,0,x,y,r);
 g.addColorStop(0,color);g.addColorStop(1,'#ffffff00');
 c.fillStyle=g;c.fillRect(x-r,y-r,2*r,2*r);c.restore();
}
function racket(c,x,y,angle,t,color){
 c.save();c.translate(x,y);c.rotate(angle);
 // Hand grip and wrappings.
 limb(c,[[0,3],[1,-6],[0,-20]],7,'#22312d');
 c.strokeStyle='#f5f0db';c.lineWidth=1.2;
 for(let j=0;j<5;j++){let v=-4-j*2.8;c.beginPath();c.moveTo(-3,v);c.lineTo(3,v-1.7);c.stroke()}
 // Blade neck and triangular open throat.
 limb(c,[[0,-19],[0,-29]],4,'#bdc9bc');
 c.strokeStyle='#e3f3d1';c.lineWidth=3;c.beginPath();c.moveTo(0,-29);c.lineTo(-8,-37);c.moveTo(0,-29);c.lineTo(8,-37);c.stroke();
 c.save();c.translate(0,-49);c.rotate(Math.sin(t*.002)*.018);
 c.fillStyle='#142920';c.strokeStyle='#f1f2df';c.lineWidth=4;
 c.beginPath();c.ellipse(0,0,15,22,0,0,TAU);c.fill();c.stroke();
 c.strokeStyle=color;c.lineWidth=1.5;c.beginPath();c.ellipse(0,0,12.1,19.2,0,0,TAU);c.stroke();
 c.save();c.beginPath();c.ellipse(0,0,11.5,18.4,0,0,TAU);c.clip();
 c.strokeStyle='#f0f6da77';c.lineWidth=.95;
 for(let i=-4;i<=4;i++){
  let x=i*3.2;c.beginPath();c.moveTo(x,-23);c.lineTo(x,23);c.stroke();
 }
 for(let i=-7;i<=7;i++){
  let y=i*3;c.beginPath();c.moveTo(-17,y);c.lineTo(17,y);c.stroke();
 }
 c.restore();
 circle(c,-4,-7,2,'#eaff65');circle(c,3,2,2,'#eaff65');circle(c,-3,9,2,'#eaff65');
 c.fillStyle='#eaff65';c.font='900 7px sans-serif';c.textAlign='center';c.fillText('P',0,3.5);
 c.restore();c.restore();
}
function body(c,pose,t,anim){
 const victory=pose==='victory',defeat=pose==='defeat',menu=pose==='menu';
 const walk=menu?Math.sin(anim.phase||t*.005):Math.sin(t*.006)*.13;
 const breath=Math.sin(t*.0023);
 const jump=victory?22+Math.max(0,Math.sin(t*.0074))*24:0;
 const sink=defeat?7+2.8*breath:0;
 const lean=victory?-.10+Math.sin(t*.003)*.035:defeat?.19:.018+walk*.036;
 const faceTilt=victory?-.16+Math.sin(t*.003)*.065:defeat?.38+Math.sin(t*.0022)*.03:walk*.035;
 const skin='#d6a082',skinLite='#efbd98',skinShadow='#9d654e';
 const short='#183b31',hem='#c5df90',shirtHi='#eaff68',edge='#172921';
 c.save();c.translate(0,-jump+sink);
 // Ground shadow in local body coordinates (counter-translated to stay grounded).
 c.save();c.translate(0,jump-sink);
 let shadow=c.createRadialGradient(0,4,1,0,4,57);
 shadow.addColorStop(0,'#06170bd0');shadow.addColorStop(.58,'#071b145e');shadow.addColorStop(1,'#071b1400');
 c.fillStyle=shadow;c.scale(1,.26);c.beginPath();c.arc(0,15,56,0,TAU);c.fill();c.restore();
 // Rear arm: lively balancing while running, raised overhead for the win.
 const rearArm= victory?[[-17,-89],[-37,-112],[-31,-161]]:defeat?[[-17,-83],[-43,-91],[-27,-117]]:[[-17,-86],[-32-walk*5,-66],[-32-walk*8,-45]];
 limb(c,rearArm,11,skin);
 circle(c,rearArm[2][0],rearArm[2][1],7.3,skinLite);
 if(victory){c.strokeStyle=skinShadow;c.lineWidth=1.2;c.beginPath();c.arc(-32,-165,5,0,Math.PI*1.6);c.stroke()}
 // Left and right legs, each with knee joints and athletic calf taper.
 let poses;
 if(victory){
  const f=Math.sin(t*.0074);
  poses=[
   {hip:[-13,-52],knee:[-29,-29],foot:[-43+f*7,-2],tilt:-.22},
   {hip:[13,-52],knee:[36,-40],foot:[48,-19-f*7],tilt:.15}
  ];
 }else if(defeat){
  poses=[
   {hip:[-12,-48],knee:[-26,-19],foot:[-29,0],tilt:-.2},
   {hip:[12,-48],knee:[28,-17],foot:[36,0],tilt:.14}
  ];
 }else{
  poses=[
   {hip:[-12,-52],knee:[-14+walk*8,-28-Math.max(0,walk)*7],foot:[-13+walk*15,-1-Math.max(0,walk)*6],tilt:-walk*.13},
   {hip:[12,-52],knee:[13-walk*8,-28-Math.max(0,-walk)*7],foot:[14-walk*15,-1-Math.max(0,-walk)*6],tilt:walk*.13}
  ];
 }
 poses.forEach((leg,i)=>{
  limb(c,[leg.hip,leg.knee],15,short);
  limb(c,[leg.knee,leg.foot],12,skin);
  circle(c,leg.knee[0],leg.knee[1],5.4,skinLite);
  const sockX=leg.foot[0],sockY=leg.foot[1];
  c.fillStyle='#f5f2e6';c.fillRect(sockX-5,sockY-11,10,6);
  c.save();c.translate(sockX,sockY);c.rotate(leg.tilt);
  c.fillStyle='#faf7e5';c.strokeStyle='#1d3829';c.lineWidth=2.4;
  c.beginPath();c.ellipse(i===0?-5:5,1,15,6,0,0,TAU);c.fill();c.stroke();
  c.strokeStyle='#bed8ac';c.lineWidth=1;
  for(let j=0;j<3;j++){let k=-4+j*4;c.beginPath();c.moveTo(k,-1);c.lineTo(k+3,1);c.stroke()}
  c.fillStyle='#eaff65';c.fillRect(i===0?-11:5,3,9,1.3);
  c.restore();
 });
 c.save();c.translate(0,-67);c.rotate(lean);
 // 3D-looking shorts, side splits and embroidered trim.
 c.fillStyle=gradient(c,-20,-4,22,14,[[0,'#0a2822'],[.5,'#375347'],[1,'#112e25']]);
 poly(c,[[-20,-2],[20,-2],[17,19],[3,18],[0,10],[-3,18],[-18,19]]);c.fill();
 c.strokeStyle='#071f1b';c.lineWidth=3;c.stroke();
 c.strokeStyle=hem;c.lineWidth=1.1;
 c.beginPath();c.moveTo(-15,16);c.lineTo(-4,16);c.moveTo(4,16);c.lineTo(16,16);c.stroke();
 // The jersey's polygon construction and textured inset.
 let main=gradient(c,-23,-33,25,-30,[[0,'#1c6349'],[.24,'#5cbe86'],[.53,'#eaff65'],[.74,'#a5cb4a'],[1,'#3a6440']]);
 c.fillStyle=main;c.lineJoin='round';c.lineWidth=3;c.strokeStyle=edge;
 c.beginPath();c.moveTo(-13,-49);c.lineTo(-25,-38);c.lineTo(-20,-25);c.lineTo(-17,-7);
 c.quadraticCurveTo(0,0,17,-7);c.lineTo(20,-25);c.lineTo(25,-38);c.lineTo(13,-49);
 c.quadraticCurveTo(0,-53,-13,-49);c.closePath();c.fill();c.stroke();
 c.fillStyle='#17382c';poly(c,[[-13,-49],[-7,-53],[7,-53],[13,-49],[5,-43],[-5,-43]]);c.fill();
 c.strokeStyle='#e9ffc9';c.lineWidth=1.6;c.beginPath();c.moveTo(-17,-39);c.lineTo(-11,-16);c.moveTo(17,-39);c.lineTo(11,-16);c.stroke();
 c.fillStyle='#fefee3aa';poly(c,[[-14,-38],[-10,-40],[-8,-17],[-11,-14]]);c.fill();
 c.strokeStyle='#152b23a0';c.lineWidth=1.2;
 for(let i=0;i<4;i++){let y=-33+i*5;c.beginPath();c.moveTo(12,y);c.lineTo(17,y+1);c.stroke()}
 c.fillStyle='#132b21';c.beginPath();c.roundRect(-11,-34,22,21,5);c.fill();
 c.fillStyle='#f2ffe0';c.font='900 12px sans-serif';c.textAlign='center';c.fillText('01',0,-19);
 c.fillStyle='#eaff65';c.font='900 4.7px sans-serif';c.fillText('PADELUM',0,-13.5);
 // Neck and ears.
 c.fillStyle=skinShadow;c.fillRect(-6,-59,12,11);
 c.fillStyle=skin;c.fillRect(-4,-62,8,14);
 c.save();c.translate(0,-68+breath*.5);c.rotate(faceTilt);
 circle(c,-15,-47,4.2,skinShadow);circle(c,15,-47,4.2,skinShadow);
 // Modelled shaded head, jawline, cheekbones.
 const head=gradient(c,-17,-60,16,-33,[[0,skinShadow],[.28,skin],[.62,skinLite],[1,skin]]);
 c.fillStyle=head;c.strokeStyle='#593b30';c.lineWidth=2.2;
 c.beginPath();c.moveTo(-16,-60);c.bezierCurveTo(-20,-82,17,-84,17,-60);
 c.lineTo(14,-39);c.quadraticCurveTo(1,-30,-11,-39);
 c.closePath();c.fill();c.stroke();
 c.fillStyle='#f8c39a88';c.beginPath();c.ellipse(-9,-50,4,5,0,0,TAU);c.fill();
 c.fillStyle='#ad7155aa';c.beginPath();c.ellipse(10,-49,3.5,5,0,0,TAU);c.fill();
 // Hair: separated aerodynamic swept strands.
 c.fillStyle='#2b2924';
 c.beginPath();c.moveTo(-16,-61);c.bezierCurveTo(-23,-86,-8,-90,4,-86);
 c.quadraticCurveTo(21,-87,19,-63);c.lineTo(11,-73);c.lineTo(3,-71);c.lineTo(-5,-75);c.lineTo(-15,-65);c.closePath();c.fill();
 c.strokeStyle='#584538';c.lineWidth=2;
 for(let i=0;i<5;i++){let x=-13+i*6;c.beginPath();c.moveTo(x,-77-(i%2)*2);c.quadraticCurveTo(x+5,-83,x+10,-78);c.stroke()}
 // Eyes track the ball in menu. Defeat has lowered, heavy eyebrows.
 const blink= Math.sin(t*.0013+4.3)>.997;
 c.strokeStyle='#352c25';c.lineWidth=1.55;
 c.beginPath();c.moveTo(-11,-56);c.lineTo(-4,-56+(defeat?2:-.8));c.moveTo(4,-56+(defeat?2:-.8));c.lineTo(11,-56);c.stroke();
 c.fillStyle='#252725';
 if(!blink&&!defeat){circle(c,-7,-52,1.7,'#242721');circle(c,7,-52,1.7,'#242721');circle(c,-6.6,-52.5,.6,'#fff')}
 else{c.beginPath();c.moveTo(-9,-51);c.lineTo(-4,-51);c.moveTo(4,-51);c.lineTo(9,-51);c.stroke()}
 // Nose, nostril shadow, distinct emotional mouth.
 c.fillStyle=skinShadow;c.beginPath();c.ellipse(0,-46,2,3,0,0,TAU);c.fill();
 c.strokeStyle='#733e37';c.lineWidth=1.65;c.beginPath();
 if(victory){c.moveTo(-7,-41);c.quadraticCurveTo(0,-29,8,-42);c.quadraticCurveTo(0,-37,-7,-41)}
 else if(defeat){c.moveTo(-6,-37);c.quadraticCurveTo(0,-41,6,-37)}
 else{c.moveTo(-5,-39);c.quadraticCurveTo(0,-35,5,-39)}
 c.stroke();
 if(victory){circle(c,-11,-44,2,'#e69b78cc');circle(c,10,-44,2,'#e69b78cc')}
 if(defeat){
  c.fillStyle='#a8ecffb8';c.beginPath();c.ellipse(9,-43+Math.sin(t*.004)*1,1.6,4,0,0,TAU);c.fill();
 }
 c.restore(); // head
 // Front/right arm and active racket hand, carefully articulated.
 const arm=victory?[[16,-45],[32,-83],[37,-144]]:
  defeat?[[17,-43],[31,-17],[34,-7]]:
  [[16,-45],[30+(anim.swing||0)*13,-24-(anim.swing||0)*19],[37+(anim.swing||0)*18,-30-(anim.swing||0)*38]];
 limb(c,arm,11,skin);
 circle(c,arm[1][0],arm[1][1],6.8,skinLite);
 circle(c,arm[2][0],arm[2][1],6.4,skin);
 c.strokeStyle='#ebc29a';c.lineWidth=1.5;
 c.beginPath();c.moveTo(arm[1][0]-2,arm[1][1]-4);c.lineTo(arm[1][0]+1,arm[1][1]+2);c.stroke();
 c.restore(); // torso
 const hand={x:arm[2][0]*Math.cos(lean)-arm[2][1]*Math.sin(lean),y:-67+arm[2][0]*Math.sin(lean)+arm[2][1]*Math.cos(lean)};
 racket(c,hand.x,hand.y, victory?-.3+Math.sin(t*.006)*.12:defeat?1.7: .28-(anim.swing||0)*1.5,t, victory?'#f4e77c':'#a2cbbb');
 if(victory){
  // Air streak arcs, exclusive to victory pose.
  c.save();c.globalAlpha=.67;c.strokeStyle='#faffc3';c.lineWidth=2.3;
  c.beginPath();c.arc(0,-89,82,-Math.PI*.84,-Math.PI*.25);c.stroke();c.restore();
 }
 c.restore(); // root
}
function menuAthlete(c,p,mp,w,h,t){
 if(!w||!h)return;
 const q=mp(p.x,p.y),s=clamp(Math.min(w*.0018,h*.003),.78,2.7);
 c.save();
 // Focus glow and grounded movement, scaled with menu depth.
 softGlow(c,q.x,q.y-105*s,96*s,'#edff8435');
 c.translate(q.x,q.y);
 c.scale(s,s);
 body(c,'menu',t,p);
 c.restore();
 // Kinetic labels become part of the stadium screen, not a separate slideshow.
 c.save();c.globalAlpha=.62+Math.sin(t*.002)*.09;
 c.font='900 '+clamp(w*.011,9,15)+'px sans-serif';c.textAlign='center';
 c.fillStyle='#f8f7de';c.fillText('PADELUM  /  ATHLETE 01',q.x,q.y+clamp(20*s,18,39));
 c.restore();
}
function backdrop(c,w,h,t,winning){
 c.save();
 const x=w*.69,y=h*.91;
 // Court floor with multi-layer shadow and depth perspective.
 let g=gradient(c,0,h*.71,0,h,[[0,'#193b2b00'],[.8,winning?'#12442b99':'#2d323aba'],[1,'#06130de8']]);
 c.fillStyle=g;c.fillRect(0,h*.7,w,h*.3);
 c.fillStyle=winning?'#dfff7714':'#becce80d';
 poly(c,[[w*.26,h*.9],[w*.91,h*.9],[w*1.1,h],[w*.08,h]]);c.fill();
 c.strokeStyle=winning?'#dcff9a55':'#bdcfda43';c.lineWidth=3;
 c.beginPath();c.moveTo(w*.2,h*.94);c.lineTo(w,h*.94);c.stroke();
 c.globalAlpha=.65;softGlow(c,x,y-160,h*.36,winning?'#eaff6555':'#7695e03b');c.globalAlpha=1;
 // Illustrated dust and confetti strips; fixed seeds for stable frame rate.
 for(let i=0;i<(winning?105:47);i++){
  let baseX=rnd(i+111)*w;
  let baseY=rnd(i+1)*h;
  const speed=winning?37+rnd(i+12)*85:10+rnd(i+12)*27;
  let yy=(baseY+t*.001*speed)%(h+45)-20;
  const xx=baseX+Math.sin(t*.0012+i)* (winning?20:5);
  c.save();c.translate(xx,yy);c.rotate(t*.0018*(i%2?1:-1)+i);
  const alpha=winning?.56:.18;
  c.globalAlpha=alpha*(.7+.3*Math.sin(t*.001+i));
  c.fillStyle=winning?['#eaff65','#fff2cd','#ffb779','#79e4d0','#ffc4a6'][i%5]:['#e4eded','#a6c9de','#909eb5'][i%3];
  if(winning)c.fillRect(-3,-6,4+(i%3)*2,10+(i%2)*5);
  else{c.beginPath();c.arc(0,0,1.1+rnd(i)*2,0,TAU);c.fill()}
  c.restore();
 }
 // Scenic stadium shafts, stadium lighting and cinematic vignette.
 for(let i=0;i<4;i++){
  const lx=w*(.41+i*.18),ly=-36;
  c.save();c.globalAlpha=winning?.18:.072;
  c.fillStyle=winning?'#fff2bb':'#d9efff';
  poly(c,[[lx-11,ly],[lx+11,ly],[lx+w*.23,h],[lx-w*.16,h]]);c.fill();
  c.restore();
 }
 const vign=c.createRadialGradient(w*.66,h*.52,h*.21,w*.66,h*.52,h*.8);
 vign.addColorStop(0,'#0000');vign.addColorStop(1,'#03100bc9');
 c.fillStyle=vign;c.fillRect(0,0,w,h);
 c.restore();
}
function ensureSize(canvas){
 const rect=canvas.getBoundingClientRect(),w=Math.max(1,Math.round(rect.width)),h=Math.max(1,Math.round(rect.height));
 const d=Math.min(window.devicePixelRatio||1,2);
 if(canvas.width!==Math.round(w*d)||canvas.height!==Math.round(h*d)){
  canvas.width=Math.round(w*d);canvas.height=Math.round(h*d);
 }
 const c=canvas.getContext('2d');c.setTransform(d,0,0,d,0,0);return {c,w,h};
}
function animate(time){
 const canvas=el(),box=document.getElementById('endbox');
 if(!canvas||!box||!box.classList.contains('on')){raf=0;return}
 const {c,w,h}=ensureSize(canvas);
 c.clearRect(0,0,w,h);
 const t=time-firstFrame;
 backdrop(c,w,h,t,win);
 const s=clamp(Math.min(h/178,w/390),.88,3.65);
 let x=win?w*.73:w*.73,y=h*.93;
 // Dynamic stadium rim light and motion trails.
 c.save();
 c.translate(x,y);
 c.scale(s,s);
 if(win){c.strokeStyle='#eaff6588';c.lineWidth=1.5;let a=t*.0015;
  for(let i=0;i<4;i++){c.beginPath();c.arc(0,-92,66+i*12,-.5+a*.12+i*.06,.4+a*.15+i*.1);c.stroke()}
 }
 body(c,win?'victory':'defeat',time,{});
 c.restore();
 if(win){
  const pulse=(.5+.5*Math.sin(t*.008));
  softGlow(c,w*.69,h*.43,90+pulse*22,'#fff8b21d');
 }
 raf=requestAnimationFrame(animate);
}
function stop(){if(raf)cancelAnimationFrame(raf);raf=0}
function result(won){
 win=!!won;stop();firstFrame=performance.now();lastResultTime=firstFrame;
 raf=requestAnimationFrame(animate);
}
window.PADELUMShowcase={menuAthlete,result,stop};
})();
