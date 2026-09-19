import {Quaternion} from '../vendor/three/build/three.module.js';
import {V} from './physics.js';
import {poseArmTarget} from './ledge-climb.js';
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t)};
export const FERRY_LADDERS=[-1,1].map(side=>({id:side<0?'port':'starboard',bottom:V(side*4.8,0,-8.55),top:V(side*4.65,7.90,-10.35),rungZ:-9.15,normal:V(0,0,1)}));
export function nearestLadder(c,world){if(world.stage!=='ferry'||!c.alive||!c.grounded||!['idle','block'].includes(c.state)||c.severed.has('left_arm')||c.severed.has('right_arm'))return null;return FERRY_LADDERS.find(l=>Math.abs(c.pos.y-l.bottom.y)<.4&&Math.hypot(c.pos.x-l.bottom.x,c.pos.z-l.bottom.z)<.8)||null}
export function ladderRoute(c,target,world){if(world.stage!=='ferry'||target.pos.y<4||c.pos.y>1||!c.grounded||c.state!=='idle'||c.severed.has('left_arm')||c.severed.has('right_arm'))return null;return [...FERRY_LADDERS].sort((a,b)=>a.bottom.distanceToSquared(c.pos)-b.bottom.distanceToSquared(c.pos))[0]}
export function beginLadder(c,l){c.ladder={...l,start:c.pos.clone(),elapsed:0,mount:.28,ascent:l.top.y/1.5,exit:.72};c.state='ladder';c.timer=0;c.vy=0;c.grounded=false;c.block=false;c.queued=false;c.previousBlade=null;c.knock.set(0,0,0);c.yaw=Math.PI;c.sword.visible=false;c.play('walk',.1,.6)}
export function cancelLadder(c){if(!c.ladder)return;c.ladder=null;c.sword.visible=!c.severed.has('right_arm');}
export function stepLadder(c,dt){const l=c.ladder;if(!l)return false;if(!c.alive||c.state!=='ladder'||c.severed.has('left_arm')||c.severed.has('right_arm')){cancelLadder(c);return false}l.elapsed+=dt;const lift=l.elapsed-l.mount;
 if(lift<0)c.pos.lerpVectors(l.start,l.bottom,smooth(l.elapsed/l.mount));else if(lift<l.ascent)c.pos.copy(l.bottom).add(V(0,(l.top.y+.06)*smooth(lift/l.ascent),0));else{const high=l.bottom.clone();high.y=l.top.y+.06;c.pos.lerpVectors(high,l.top,smooth((lift-l.ascent)/l.exit))}
 c.vy=0;c.velocity.set(0,0,0);c.grounded=false;
 if(lift>=l.ascent+l.exit){c.pos.copy(l.top);cancelLadder(c);c.state='land';c.timer=0;c.duration=.2;c.grounded=true;c.play('land',.08,3,true)}return true;
}
function placeLeg(c,side,target){
 const a=c.bones[side+'_hip'],b=c.bones[side+'_knee'],end=c.bones[side+'_ankle'],p=a.getWorldPosition(V()),bp=b.getWorldPosition(V()),ep=end.getWorldPosition(V()),l1=p.distanceTo(bp),l2=bp.distanceTo(ep),d=target.clone().sub(p),distance=Math.max(.01,Math.min(d.length(),l1+l2-.001));d.normalize();const x=(l1*l1-l2*l2+distance*distance)/(2*distance),h=Math.sqrt(Math.max(0,l1*l1-x*x)),pole=V(side==='left'?-.15:.15,.2,1).applyAxisAngle(V(0,1,0),c.yaw);pole.addScaledVector(d,-pole.dot(d)).normalize();const knee=p.clone().addScaledVector(d,x).addScaledVector(pole,h),reach=p.clone().addScaledVector(d,distance);
 for(const [bone,child,goal] of [[a,b,knee],[b,end,reach]]){const start=bone.getWorldPosition(V()),from=child.getWorldPosition(V()).sub(start).normalize(),to=goal.clone().sub(start).normalize(),q=new Quaternion().setFromUnitVectors(from,to).multiply(bone.getWorldQuaternion(new Quaternion()));bone.quaternion.copy(bone.parent.getWorldQuaternion(new Quaternion()).invert().multiply(q));bone.updateWorldMatrix(false,true)}
}
export function poseLadder(c){const l=c.ladder;if(!l)return;const ascent=Math.max(0,l.elapsed-l.mount),release=1-smooth((ascent-l.ascent+.4)/.8);
 for(const [i,side] of ['left','right'].entries()){
  const q=c.pos.y/.64+i*.5,k=Math.floor(q),u=smooth((q-k-.60)/.40),handY=Math.min(8.75,(k+u-i*.5)*.64+1.46*c.size),target=V(l.bottom.x+(i?-.19:.19)*c.size,handY,l.rungZ+.065),wrist=c.bones[side+'_wrist'].getWorldPosition(V());poseArmTarget(c,side,wrist.lerp(target,release));
  const fq=q+.5,fk=Math.floor(fq),fu=smooth((fq-fk-.60)/.40),footY=(fk+fu-i*.5-.5)*.64+.58,foot=V(l.bottom.x+(i?-.14:.14)*c.size,footY,l.rungZ+.18),ankle=c.bones[side+'_ankle'].getWorldPosition(V());placeLeg(c,side,ankle.lerp(foot,release));
 }
 c.root.updateMatrixWorld(true);
}
