import {Vector3,Quaternion} from '../vendor/three/build/three.module.js';
const V=(x=0,y=0,z=0)=>new Vector3(x,y,z),smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t)};
function usable(w){const b=w.box;return !w.broken&&!w.bamboo&&!w.breakable&&b&&b.max.x-b.min.x>1&&b.max.z-b.min.z>1&&b.max.y-b.min.y>.6}
function faces(b,p,r){return [
 {edge:V(b.min.x,b.max.y,Math.max(b.min.z+r,Math.min(b.max.z-r,p.z))),normal:V(-1,0,0)},
 {edge:V(b.max.x,b.max.y,Math.max(b.min.z+r,Math.min(b.max.z-r,p.z))),normal:V(1,0,0)},
 {edge:V(Math.max(b.min.x+r,Math.min(b.max.x-r,p.x)),b.max.y,b.min.z),normal:V(0,0,-1)},
 {edge:V(Math.max(b.min.x+r,Math.min(b.max.x-r,p.x)),b.max.y,b.max.z),normal:V(0,0,1)}]}
function clearLanding(c,p,world){return !world.solids.some(w=>!w.broken&&!w.bamboo&&w.box.max.y>p.y+.08&&w.box.min.y<p.y+c.height&&p.x+c.radius>w.box.min.x&&p.x-c.radius<w.box.max.x&&p.z+c.radius>w.box.min.z&&p.z-c.radius<w.box.max.z)}
export function findLedge(c,dir,world){
 if(c.state!=='jump'||c.grounded||c.vy< -6||c.severed.has('left_arm')||c.severed.has('right_arm')||dir.lengthSq()<.01)return null;
 const candidates=[];
 for(const w of world.solids){if(!usable(w))continue;const b=w.box,rise=b.max.y-c.pos.y;if(rise<.65*c.size||rise>2.08*c.size)continue;
  for(const f of faces(b,c.pos,c.radius+.15)){
   const offset=c.pos.clone().sub(f.edge);offset.y=0;const outside=offset.dot(f.normal),along=offset.clone().addScaledVector(f.normal,-outside).length();
   if(outside<c.radius-.12||outside>c.radius+.55||along>.26||dir.dot(f.normal)>-.45)continue;
   const end=f.edge.clone().addScaledVector(f.normal,-c.radius-.22);end.y+=.035;if(!clearLanding(c,end,world))continue;
   candidates.push({...f,end,solid:w,distance:offset.length()});
  }
 }
 return candidates.sort((a,b)=>a.distance-b.distance)[0]||null;
}
export function enemyClimbRoute(c,target,world){
 if(c.severed.has('left_arm')||c.severed.has('right_arm')||target.pos.y-c.pos.y<.65||target.pos.y-c.pos.y>3.55*c.size)return null;
 let best=null;
 for(const w of world.solids){if(!usable(w))continue;const b=w.box;if(Math.abs(b.max.y-target.pos.y)>.25||target.pos.x<b.min.x||target.pos.x>b.max.x||target.pos.z<b.min.z||target.pos.z>b.max.z)continue;
  for(const f of faces(b,c.pos,c.radius+.2)){
   const waypoint=f.edge.clone().addScaledVector(f.normal,c.radius+.4);waypoint.y=c.pos.y;
   const end=f.edge.clone().addScaledVector(f.normal,-c.radius-.22);end.y+=.035;if(!clearLanding(c,end,world)||!clearLanding(c,waypoint,world))continue;
   const distance=waypoint.distanceTo(c.pos);if(!best||distance<best.distance)best={waypoint,direction:f.normal.clone().negate(),distance};
  }
 }return best;
}
export function beginClimb(c,ledge){
 c.climb={...ledge,start:c.pos.clone(),elapsed:0,duration:1.18};c.state='climb';c.timer=0;c.vy=0;c.grounded=false;c.block=false;c.queued=false;c.previousBlade=null;c.knock.set(0,0,0);c.yaw=Math.atan2(-ledge.normal.x,-ledge.normal.z);c.play('jump',.08,.6);c.sword.visible=false;
}
export function cancelClimb(c){if(!c.climb)return;c.climb=null;c.sword.visible=!c.severed.has('right_arm');}
export function stepClimb(c,dt,world){
 const m=c.climb;if(!m)return false;
 if(!c.alive||c.state!=='climb'||m.solid.broken||c.severed.has('left_arm')||c.severed.has('right_arm')){cancelClimb(c);return false}
 m.elapsed+=dt;const t=Math.min(1,m.elapsed/m.duration),hang=m.edge.clone().addScaledVector(m.normal,c.radius+.03);hang.y=m.edge.y-1.65*c.size;
 const high=hang.clone();high.y=m.end.y+.10*c.size;
 if(t<.18)c.pos.lerpVectors(m.start,hang,smooth(t/.18));else if(t<.70)c.pos.lerpVectors(hang,high,smooth((t-.18)/.52));else c.pos.lerpVectors(high,m.end,smooth((t-.70)/.30));
 c.velocity.set(0,0,0);c.vy=0;c.grounded=false;
 if(t===1){c.pos.copy(m.end);cancelClimb(c);c.state='land';c.timer=0;c.duration=.2;c.grounded=true;c.play('land',.06,3,true)}return true;
}
function aim(bone,child,target){const start=bone.getWorldPosition(V()),from=child.getWorldPosition(V()).sub(start).normalize(),to=target.clone().sub(start).normalize(),q=new Quaternion().setFromUnitVectors(from,to).multiply(bone.getWorldQuaternion(new Quaternion())),parent=bone.parent.getWorldQuaternion(new Quaternion()).invert();bone.quaternion.copy(parent.multiply(q));bone.updateWorldMatrix(false,true)}
export function poseArmTarget(c,side,target){const a=c.bones[side+'_shoulder'],b=c.bones[side+'_elbow'],tip=c.bones[side+'_wrist'],p=a.getWorldPosition(V()),bp=b.getWorldPosition(V()),tp=tip.getWorldPosition(V()),l1=p.distanceTo(bp),l2=bp.distanceTo(tp),d=target.clone().sub(p),distance=Math.max(.01,Math.min(d.length(),l1+l2-.001));d.normalize();const reach=p.clone().addScaledVector(d,distance),x=(l1*l1-l2*l2+distance*distance)/(2*distance),h=Math.sqrt(Math.max(0,l1*l1-x*x));const pole=V(side==='left'?-.8:.8,-.4,-.65).applyAxisAngle(V(0,1,0),c.yaw);pole.addScaledVector(d,-pole.dot(d)).normalize();const elbow=p.clone().addScaledVector(d,x).addScaledVector(pole,h);aim(a,b,elbow);aim(b,tip,reach)}
export function poseClimb(c){const m=c.climb;if(!m)return;const t=m.elapsed/m.duration,weight=1-smooth((t-.47)/.25),side=V(m.normal.z,0,-m.normal.x);
 for(const name of ['left','right']){const target=m.edge.clone().addScaledVector(side,(name==='left'?1:-1)*.23*c.size).addScaledVector(m.normal,-.025);target.y+=.025;const wrist=c.bones[name+'_wrist'].getWorldPosition(V());poseArmTarget(c,name,wrist.lerp(target,weight));}
 // Tuck the legs while hauling the hips over the edge.
 const tuck=Math.sin(Math.PI*Math.min(1,t/.85));for(const name of ['left','right']){c.bones[name+'_hip'].quaternion.multiply(new Quaternion().setFromAxisAngle(V(1,0,0),-.65*tuck));c.bones[name+'_knee'].quaternion.multiply(new Quaternion().setFromAxisAngle(V(1,0,0),1.05*tuck))}c.root.updateMatrixWorld(true);
}
