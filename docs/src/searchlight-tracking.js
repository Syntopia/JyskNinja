import {Vector3} from '../vendor/three/build/three.module.js';
import {segmentBox} from './physics.js';
const V=(x=0,y=0,z=0)=>new Vector3(x,y,z),clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function createSearchlightTracking(origin,home){
 let time=0,yaw=Math.atan2(home.x-origin.x,home.z-origin.z),pitch=Math.atan2(home.y-origin.y,Math.hypot(home.x-origin.x,home.z-origin.z)),seen=0,occluded=false,mode='sweep';const aim=home.clone(),lastSeen=home.clone();
 const direction=()=>V(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch));
 return {step(dt,target,solids=[]){if(!(dt>0))return;dt=Math.min(dt,.05);time+=dt;seen=Math.max(0,seen-dt);
  const desired=target?.alive?target.pos.clone().add(V(0,1.05*target.size,0)):null;
  occluded=!!desired&&solids.some(w=>!w.broken&&!w.bamboo&&!w.searchlightTransparent&&segmentBox(origin,desired,w.box,.015));
  if(desired&&!occluded&&desired.distanceTo(origin)<65){lastSeen.copy(desired);seen=1.8}
  if(seen>0){mode=occluded?'search':'track';aim.lerp(lastSeen,1-Math.exp(-dt*1.5));aim.x+=Math.sin(time*1.7)*dt*.1;}
  else{mode='sweep';aim.set(home.x+Math.sin(time*.20)*9,home.y,home.z+Math.sin(time*.13+.5)*10)}
  const d=aim.clone().sub(origin),wantedYaw=Math.atan2(d.x,d.z),wantedPitch=clamp(Math.atan2(d.y,Math.hypot(d.x,d.z)),-1.15,.06),dy=Math.atan2(Math.sin(wantedYaw-yaw),Math.cos(wantedYaw-yaw));yaw+=clamp(dy,-dt*.28,dt*.28);pitch+=clamp(wantedPitch-pitch,-dt*.20,dt*.20);
 },reset(){time=seen=0;mode='sweep';occluded=false;aim.copy(home);lastSeen.copy(home);yaw=Math.atan2(home.x-origin.x,home.z-origin.z);pitch=Math.atan2(home.y-origin.y,Math.hypot(home.x-origin.x,home.z-origin.z))},get state(){return {time,yaw,pitch,mode,occluded,aim:aim.clone(),direction:direction()}}};
}
