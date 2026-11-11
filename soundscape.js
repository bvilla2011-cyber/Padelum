/* PADELUM Soundscape • original, procedural Web Audio soundtrack.
   Everything is synthesised in browser; no third-party recordings or music.
   Browser policy: the first real user gesture unlocks sound. */
(function(){
'use strict';
let ac=null, master=null, music=null, stadium=null, noiseBuffer=null;
let muted=false, scene='menu', nextStep=0, stepIndex=0, interval=0, lastAudienceWave=0;
const bpm=80, eighth=60/bpm/2;
const notes={C:261.63,D:293.66,E:329.63,F:349.23,G:392,A:440,B:493.88};
const chordSets=[
 [174.61,220,261.63,329.63],   // Fmaj7
 [146.83,196,246.94,293.66],   // Dm7
 [196,246.94,293.66,392],       // G9
 [164.81,196,261.63,329.63]    // Cmaj7/E
];
const melody=[329.63,392,440,392,293.66,329.63,261.63,293.66,329.63,261.63,246.94,293.66,392,329.63,261.63,196];
function createNoise(sec){
 let b=ac.createBuffer(1,Math.floor(ac.sampleRate*sec),ac.sampleRate),d=b.getChannelData(0),prev=0;
 for(let i=0;i<d.length;i++){let x=(Math.random()*2-1);prev=(prev*.78+x*.22);d[i]=prev*.52}
 return b;
}
function setup(){
 if(ac)return ac;
 try{
  const A=window.AudioContext||window.webkitAudioContext;if(!A)return null;
  ac=new A();master=ac.createGain();master.gain.value=muted?0:.65;master.connect(ac.destination);
  music=ac.createGain();music.gain.value=0;music.connect(master);
  stadium=ac.createGain();stadium.gain.value=0;stadium.connect(master);
  noiseBuffer=createNoise(3);
  const crowd=ac.createBufferSource();crowd.buffer=noiseBuffer;crowd.loop=true;
  const bass=ac.createBiquadFilter();bass.type='bandpass';bass.frequency.value=380;bass.Q.value=.42;
  const quiet=ac.createGain();quiet.gain.value=.115;
  crowd.connect(bass);bass.connect(quiet);quiet.connect(stadium);crowd.start();
  interval=setInterval(tick,75);
  return ac;
 }catch(_){return null}
}
function unlock(){
 const a=setup();if(!a)return;
 if(a.state!=='running')a.resume().catch(()=>{});
 applyScene();return a;
}
function fade(node,value,duration=.45){
 if(!node||!ac)return;
 const now=ac.currentTime;node.gain.cancelScheduledValues(now);
 node.gain.setTargetAtTime(value,now,duration/3);
}
function applyScene(){
 if(!ac)return;
 fade(music,scene==='menu'?.48:0,.45);
 fade(stadium,scene==='game'?.46:scene==='result'?.35:scene==='pause'?.12:0,.65);
 if(scene==='menu'&&nextStep<ac.currentTime)nextStep=ac.currentTime+.08;
}
function setScene(s){
 if(!['menu','game','pause','result'].includes(s))return;
 const prev=scene;scene=s;
 if(prev!==s){if(s==='menu'){nextStep=ac?ac.currentTime+.09:0;stepIndex=0}applyScene()}
}
function tone(freq,when,duration,volume,type='sine',bus=music,cutoff=1800){
 if(!ac||!bus)return;
 const o=ac.createOscillator(),g=ac.createGain(),f=ac.createBiquadFilter();
 f.type='lowpass';f.frequency.value=cutoff;
 o.type=type;o.frequency.setValueAtTime(freq,when);
 g.gain.setValueAtTime(.0001,when);
 g.gain.exponentialRampToValueAtTime(Math.max(.0002,volume),when+.026);
 g.gain.exponentialRampToValueAtTime(.0001,when+duration);
 o.connect(f);f.connect(g);g.connect(bus);
 o.start(when);o.stop(when+duration+.025);
}
function softNoise(t,vol,duration,bus=music,cutoff=2000){
 if(!ac||!noiseBuffer||!bus)return;
 let src=ac.createBufferSource(),f=ac.createBiquadFilter(),g=ac.createGain();
 src.buffer=noiseBuffer;f.type='highpass';f.frequency.value=cutoff;
 g.gain.setValueAtTime(.0001,t);
 g.gain.exponentialRampToValueAtTime(vol,t+.006);
 g.gain.exponentialRampToValueAtTime(.0001,t+duration);
 src.connect(f);f.connect(g);g.connect(bus);src.start(t);src.stop(t+duration+.01);
}
function musicStep(at,n){
 const bar=Math.floor(n/8)%4,step=n%8;
 if(step===0){
  for(const [i,f] of chordSets[bar].entries()){
   tone(f/2,at+i*.026,eighth*7.8,.018+(i===0?.008:0),'sine',music,720);
   tone(f,at+i*.026,eighth*5.6,.009,'triangle',music,1100);
  }
 }
 if(step===0||step===4){
  const root=chordSets[bar][0]/2;
  tone(root,at,eighth*2.35,.07,'sine',music,470);
  tone(root*2,at,eighth*1.1,.012,'triangle',music,900);
 }
 if([2,4,7].includes(step)){
  const lead=melody[(bar*4+({2:0,4:1,7:2}[step]))%melody.length];
  tone(lead,at,eighth*1.25,.023,'sine',music,1400);
  tone(lead*2,at+.018,eighth*.9,.004,'triangle',music,2400);
 }
 if(step%2===1)softNoise(at,.011,.036,music,4600);
 if(step===2||step===6)softNoise(at,.021,.068,music,1200);
}
function tick(){
 if(!ac||ac.state!=='running')return;
 if(scene==='game'){
  if(ac.currentTime-lastAudienceWave>11+Math.random()*3){lastAudienceWave=ac.currentTime;cheer(.22)}
  return;
 }
 if(scene!=='menu')return;
 if(nextStep<ac.currentTime-.3)nextStep=ac.currentTime+.045;
 let n=0;
 while(nextStep<ac.currentTime+.19&&n++<4){
  musicStep(nextStep,stepIndex++);
  nextStep+=eighth;
 }
}
function click(){
 const a=unlock();if(!a||a.state!=='running'||muted)return;
 let now=a.currentTime+.004;
 // One consistent, soft UI confirmation for EVERY button.
 tone(740,now,.068,.063,'sine',master,2350);
 tone(1110,now+.018,.079,.020,'triangle',master,2850);
}
function count(n){
 const a=unlock();if(!a||a.state!=='running'||muted)return;
 const t=a.currentTime+.01;
 tone(n===1?660:n===2?590:525,t,.15,.11,'triangle',master,1600);
 tone(n===1?990:n===2?885:785,t+.025,.12,.023,'sine',master,2600);
}
function go(){
 const a=unlock();if(!a||a.state!=='running'||muted)return;
 const t=a.currentTime+.01;
 [392,523.25,659.25].forEach((hz,i)=>tone(hz,t+i*.067,.37,.065,'triangle',master,2400));
}
function whoosh(){
 const a=unlock();if(!a||a.state!=='running'||muted)return;
 let t=a.currentTime+.01;
 softNoise(t,.045,.2,master,1500);
 tone(310,t,.16,.023,'sine',master,900);
}
function cheer(power=1){
 const a=unlock();if(!a||a.state!=='running'||muted)return;
 let t=a.currentTime+.03;
 for(let i=0;i<8;i++){
  const f=155+(i%5)*37,dt=i*.045,vol=.012*power;
  tone(f,t+dt,.42+Math.random()*.34,vol,'sawtooth',stadium,600);
  tone(f*1.45,t+dt+.05,.26,vol*.55,'sine',stadium,920);
 }
 for(let i=0;i<12;i++)softNoise(t+i*.078,.025*power,.05,stadium,1300);
}
function result(win){
 setScene('result');
 const a=unlock();if(!a||a.state!=='running'||muted)return;
 const t=a.currentTime+.08;
 if(win){
  [392,493.88,587.33,783.99].forEach((f,i)=>tone(f,t+i*.16,.47,.08,'triangle',master,2800));
  [392,493.88,587.33].forEach((f,i)=>tone(f/2,t+.72+i*.016,1.18,.046,'sine',master,1100));
  cheer(1.65);
 }else{
  [392,349.23,293.66,261.63].forEach((f,i)=>tone(f,t+i*.23,.46,.055,'sine',master,1150));
  // The crowd settles rather than mocking the player.
  cheer(.32);
 }
}
function mute(val){
 muted=!!val;
 if(ac)fade(master,muted?0:.65,.2);
 const b=document.getElementById('soundToggle');
 if(b){b.textContent=muted?'♪ AUDIO: OFF':'♫ AUDIO: ON';b.setAttribute('aria-pressed',String(!muted))}
}
function bind(){
 // Capture delegated pointer and keyboard activation, including dynamic online/auth buttons.
 document.addEventListener('pointerdown',e=>{
  if(e.target&&e.target.closest&&e.target.closest('button,[role="button"]'))click();else unlock();
 },true);
 document.addEventListener('keydown',e=>{
  if(e.repeat||!['Enter',' '].includes(e.key))return;
  if(e.target&&e.target.closest&&e.target.closest('button,[role="button"]'))click();else unlock();
 },true);
 const b=document.getElementById('soundToggle');
 if(b){b.addEventListener('click',()=>mute(!muted));mute(false)}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
window.PADELUMSound={unlock,setScene,click,count,go,whoosh,cheer,result,mute};
})();
