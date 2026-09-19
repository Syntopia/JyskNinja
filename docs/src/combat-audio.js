import {createRecordedFoley,recordedKinds} from './recorded-foley.js';
// Procedural movement/death cues, plus legacy recipes retained for the audition page.
// Gameplay swings, hits and clashes use the preloaded recorded-foley banks.
export function synthesizeEffect(kind,rate=44100,seed=1){
 let state=seed|0,low=0,mid=0;const random=()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return (state>>>0)/2147483648-1};
 const durations={slash:.28,heavy:.42,cloth:.31,hit:.23,'mech-hit':.39,death:.85,'mech-death':1.05,parry:.9,block:.43,metal:.37,stone:.25,wood:.23,break:.62,ice:.62,jump:.19,dodge:.4,land:.26,body:.48,'train-body':.68,ladder:.14};
 const duration=durations[kind]||.18,data=new Float32Array(Math.ceil(duration*rate)),pitch=1+(seed%13-6)*.008;
 const ring=(t,f,d)=>Math.sin(t*f*6.2831853*pitch)*Math.exp(-t/d);
 const foot=kind.startsWith('foot-');
 for(let i=0;i<data.length;i++){
  const t=i/rate,u=t/duration,n=random();low+=.035*(n-low);mid+=.25*(n-mid);const air=n-mid,body=low*4,grain=mid-low;
  let v=0;
  if(kind==='slash'||kind==='heavy'){const env=Math.pow(Math.sin(Math.PI*u),kind==='heavy'?1.9:2.8);v=env*(grain*.95+air*.25+body*.28)*(kind==='heavy'?1.15:.8);}
  else if(kind==='cloth'||kind==='dodge'||kind==='jump'){const env=Math.sin(Math.PI*u)**1.4;v=(grain*.55+air*.13)*env*(kind==='jump'?.55:.8);}
  else if(['parry','block','metal','mech-hit','ladder'].includes(kind)){
   const long=kind==='parry'?1:kind==='block'?.45:.26;
   v=(air*.38+body*.7)*Math.exp(-t/.025);
   for(const [f,a] of [[740,.22],[1187,.18],[1983,.12],[3171,.08],[4627,.035]])v+=ring(t,f,long/(f/1200+1))*a;
   v*=kind==='ladder'?.35:1;
  }else if(kind==='death'){
   // Exhalation and chest resonance, deliberately nonverbal.
   const breath=Math.sin(Math.PI*u)**1.3;
   v=grain*breath*.65+ring(t,94,.16)*.25+body*Math.exp(-t/.12)*.35;
  }else if(kind==='mech-death'){
   const whirr=Math.sin(6.2831853*(620*t-220*t*t));v=(grain*.35+whirr*.12)*(1-u)**2+body*Math.exp(-t/.15)*.7;
   v+=air*.12*Math.exp(-(((t-.25)/.06)**2));
  }else if(kind==='ice'||kind==='break'){
   v=body*Math.exp(-t/.075)*.8+air*Math.exp(-t/.018)*.45;
   for(let j=1;j<6;j++){const dt=t-j*.065;if(dt>0)v+=(kind==='ice'?ring(dt,1700+j*331,.05)*.11:grain*.5)*Math.exp(-dt/.04);}
  }else if(foot){
   const snow=kind==='foot-snow',water=kind==='foot-water',metal=kind==='foot-metal';
   v=(snow?grain*.42+air*.06:water?grain*.75:grain*.25)*Math.exp(-t/(snow?.075:water?.07:.035));
   v+=ring(t,metal?175:85,.026)*(snow?.08:.18);if(metal)v+=ring(t,620,.05)*.075;
  }else{
   const weight=kind==='body'||kind==='train-body',f=kind==='wood'?180:kind==='stone'?250:weight?65:100;
   v=ring(t,f,weight?.11:.045)*.45+body*Math.exp(-t/(weight?.09:.035))*.65+air*Math.exp(-t/.014)*.25;
   if(kind==='train-body')v+=grain*.65*Math.exp(-t/.23);
  }
  const fade=Math.min(1,t/.002)*Math.min(1,(duration-t)/.018);data[i]=Math.tanh(v*1.25)*fade*.72;
 }
 return data;
}
export function createCombatAudio(camera,onUnlock){
 let context=null,master=null,enabled=true,muted=false,unlocked=false,serial=0,played=0,dropped=0;const recorded=createRecordedFoley();let recordedPlayed=0;const cache=new Map(),voices=new Set(),last=new Map(),counts={},history=new WeakMap();
 function unlock(){
  try{if(!context){context=new (window.AudioContext||window.webkitAudioContext)();master=context.createGain();master.gain.value=muted||!enabled?0:.72;const limit=context.createDynamicsCompressor();limit.threshold.value=-15;limit.knee.value=16;limit.ratio.value=5;limit.attack.value=.003;limit.release.value=.15;master.connect(limit);limit.connect(context.destination);onUnlock?.(context);}
   unlocked=true;if(context.state==='suspended')context.resume().catch(()=>{});
  }catch{}
 }
 function setState(active,mute){enabled=active;muted=mute;if(master)master.gain.setTargetAtTime(enabled&&!muted?.72:0,context.currentTime,.025);}
 function play(kind,point=null,{gain=1,legacy=false}={}){
  if(!unlocked||!context||muted||!enabled||context.state!=='running')return false;
  const now=context.currentTime;if(voices.size>=28||now-(last.get(kind)??-99)<.035){dropped++;return false;}
  let attenuation=1,pan=0;if(point){const dx=point.x-camera.position.x,dy=point.y-camera.position.y,dz=point.z-camera.position.z,dist=Math.hypot(dx,dy,dz);if(dist>32)return false;attenuation=1/(1+dist*dist/95);const e=camera.matrixWorld.elements;pan=Math.max(-.9,Math.min(.9,(dx*e[0]+dz*e[2])/Math.max(2,dist)));}
  const isRecorded=!legacy&&!!recordedKinds[kind];let buffer,rate=1,level=1;
  if(isRecorded){const sample=recorded.select(kind);if(!sample)return false;({buffer,rate,gain:level}=sample);recordedPlayed++;}
  else{const key=kind+':'+serial%3;serial++;buffer=cache.get(key);if(!buffer){const data=synthesizeEffect(kind,context.sampleRate,31+(serial%3)*53);buffer=context.createBuffer(1,data.length,context.sampleRate);buffer.copyToChannel(data,0);cache.set(key,buffer);}}
  const source=context.createBufferSource(),volume=context.createGain(),panner=context.createStereoPanner();source.buffer=buffer;source.playbackRate.value=rate*(isRecorded?.985+Math.random()*.03:.96+Math.random()*.08);volume.gain.value=gain*level*attenuation;panner.pan.value=pan;source.connect(volume);volume.connect(panner);panner.connect(master);voices.add(source);source.onended=()=>{voices.delete(source);source.disconnect();volume.disconnect();panner.disconnect()};source.start();last.set(kind,now);played++;counts[kind]=(counts[kind]||0)+1;return true;
 }
 function surface(c,world){const p=c.pos;if(world.stage==='garden'&&p.x>-14.75&&p.x< -9.25&&p.z>-4&&p.z<6&&p.y<.15)return 'water';if(world.stage==='harbour')return world.snow?.sample(p.x,p.z,p.y)>.025?'snow':p.y>.3?'metal':'stone';return ['ferry','shinkansen'].includes(world.stage)?'metal':'stone';}
 function update(actors,world){
  for(const c of actors){let old=history.get(c);if(!old){old={x:c.pos.x,y:c.pos.y,z:c.pos.z,travel:0,corpse:c.ragdoll,bodyHit:false};history.set(c,old)}
   if(old.corpse!==c.ragdoll){old.corpse=c.ragdoll;old.bodyHit=false;}
   if(c.ragdoll&&!old.bodyHit&&c.deadTime>.12){const nodes=c.ragdoll.solver.nodes,hit=nodes.some(n=>(/pelvis|spine/.test(n.name)&&n.normal.lengthSq()>0)||n.surface?.moving);if(hit){play(c.deathReason==='train-fall'?'train-body':'body',c.ragdoll.focus,{gain:c.boss?1.1:.8});old.bodyHit=true;}}
   const dx=c.pos.x-old.x,dy=c.pos.y-old.y,dz=c.pos.z-old.z,moved=Math.hypot(dx,dz),climbing=c.state==='ladder'||c.state==='climb';
   if(c.alive&&(c.grounded||climbing)&&moved<1&&Math.abs(dy)<.5&&(!['attack','stun','dodge'].includes(c.state))){old.travel+=climbing?Math.abs(dy):moved;if(old.travel>(climbing?.36:.64*c.size)){old.travel=0;play(climbing?'ladder':'foot-'+surface(c,world),c.pos,{gain:c.enemy?.32:.52});}}
   else old.travel=0;
   old.x=c.pos.x;old.y=c.pos.y;old.z=c.pos.z;
  }
 }
 return {loaded:recorded.loaded,unlock,setState,play,surface,update,get state(){return {ready:unlocked,context:context?.state,enabled,muted,voices:voices.size,played,dropped,counts:{...counts},cached:cache.size,recordedPlayed,recorded:recorded.state}}};
}
