import * as T from '../vendor/three/build/three.module.js';
import {V} from './physics.js';
import {createRagdollSolver} from './ragdoll-solver.js';
const nextBone={pelvis:'spine1',spine1:'spine2',spine2:'spine3',spine3:'neck',neck:'head',head:'head_end'};
for(const side of ['left','right'])Object.assign(nextBone,{[side+'_collar']:side+'_shoulder',[side+'_shoulder']:side+'_elbow',[side+'_elbow']:side+'_wrist',[side+'_wrist']:side+'_hand_end',[side+'_hip']:side+'_knee',[side+'_knee']:side+'_ankle',[side+'_ankle']:side+'_foot',[side+'_foot']:side+'_toe_end'});
function torsoFrame(p){const y=p('neck').clone().sub(p('pelvis')).normalize(),x=p('left_shoulder').clone().sub(p('right_shoulder'));x.addScaledVector(y,-x.dot(y)).normalize();if(x.lengthSq()<.1)x.set(1,0,0);const z=x.clone().cross(y).normalize();return new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(x,y,z))}
export function createRagdoll(c,world,{impulse=V(),point=null}={}){
 // Finger bones follow the simulated wrists, retaining their grip pose.
 c.root.updateMatrixWorld(true);const names=Object.keys(c.bones).filter(name=>nextBone[name]),points=[],index=new Map(),saved=new Map(),worldQuats=new Map();
 const missing=name=>(c.severed.has('head')&&name.startsWith('head'))||(['left','right'].some(side=>c.severed.has(side+'_arm')&&new RegExp('^'+side+'_(shoulder|elbow|wrist|hand)').test(name)));
 const radius=name=>name==='pelvis'?.15:/spine|collar/.test(name)?.13:name==='neck'?.085:name==='head'?.10:/hip/.test(name)?.11:/knee/.test(name)?.082:/ankle|foot/.test(name)?.062:/shoulder/.test(name)?.085:/elbow/.test(name)?.064:.048;
 function add(name,p,mass,r,velocity){const near=point?Math.exp(-p.distanceToSquared(point)/(.48*c.size)**2):.4,v=velocity?.clone()||c.velocity?.clone()||V();if(c.deathReason==='train-fall'&&velocity){v.sub(c.poseVelocity?.get('pelvis')||V()).add(c.velocity||V())}v.addScaledVector(impulse,.45+near*.9);v.clampLength(0,c.deathReason==='train-fall'?24:13);index.set(name,points.length);points.push({name,p,v,mass:missing(name)?.03:mass,radius:missing(name)?.009:r*c.size})}
 for(const name of names){const b=c.bones[name],p=b.getWorldPosition(V());saved.set(name,{position:b.position.clone(),quaternion:b.quaternion.clone(),scale:b.scale.clone()});worldQuats.set(name,b.getWorldQuaternion(new T.Quaternion()));add(name,p,/pelvis|spine/.test(name)?4:/hip|shoulder/.test(name)?2.2:name==='head'?2:1,radius(name),c.poseVelocity?.get(name))}
 const p=name=>points[index.get(name)].p;
 for(const [name,start,parent,extension,r] of [['head_end','head','neck',.115,.12],...['left','right'].flatMap(s=>[[s+'_hand_end',s+'_wrist',s+'_elbow',.09,.045],[s+'_toe_end',s+'_foot',s+'_ankle',.065,.05]])]){
  const direction=p(start).clone().sub(p(parent)).normalize();add(name,p(start).clone().addScaledVector(direction,extension*c.size),.6,r,c.poseVelocity?.get(start));
 }
 const links=[],keys=new Set();function link(a,b,opts={}){if(!index.has(a)||!index.has(b))return;const ia=index.get(a),ib=index.get(b),key=[ia,ib].sort((x,y)=>x-y).join(':');if(keys.has(key))return;keys.add(key);links.push({a:ia,b:ib,...opts})}
 for(const name of names){const parent=c.bones[name].parent?.name;if(index.has(parent))link(parent,name,{capsule:true,radius:Math.min(points[index.get(name)].radius,points[index.get(parent)].radius)})}
 for(const [a,b] of Object.entries(nextBone))if(b.endsWith('_end'))link(a,b,{capsule:true});
 // Pelvis and ribcage maintain their volume; the short spine between them bends.
 for(const cluster of [['pelvis','left_hip','right_hip','spine1'],['spine2','spine3','neck','left_collar','right_collar','left_shoulder','right_shoulder']])for(let i=0;i<cluster.length;i++)for(let j=i+1;j<cluster.length;j++)link(cluster[i],cluster[j]);
 for(const side of ['left','right']){
  for(const [a,b,d] of [[side+'_hip',side+'_knee',side+'_ankle'],[side+'_shoulder',side+'_elbow',side+'_wrist']]){const l1=p(a).distanceTo(p(b)),l2=p(b).distanceTo(p(d));link(a,d,{min:Math.sqrt(l1*l1+l2*l2-2*l1*l2*Math.cos(.42)),max:l1+l2,stiff:.8})}
  const dist=p(side+'_hip').distanceTo(p(side+'_shoulder'));link(side+'_hip',side+'_shoulder',{min:dist*.8,max:dist*1.08,stiff:.55});
 }
 const selfPairs=[];for(let a=0;a<points.length;a++)for(let b=a+1;b<points.length;b++){if(missing(points[a].name)||missing(points[b].name)||keys.has(a+':'+b))continue;const d=points[a].p.distanceTo(points[b].p);if(d>(points[a].radius+points[b].radius)*1.3)selfPairs.push([a,b])}
 const solver=createRagdollSolver({points,links,selfPairs}),previous=solver.nodes.map(n=>n.p.clone()),display=solver.nodes.map(n=>n.p.clone()),at=name=>display[index.get(name)],initialFrame=torsoFrame(p).invert(),initialDirs=new Map(names.map(n=>[n,p(nextBone[n]).clone().sub(p(n)).normalize()]));
 const headPose=c.head?{position:c.head.position.clone(),quaternion:c.head.quaternion.clone(),scale:c.head.scale.clone()}:null;
 const headOffset=c.head?c.bones.head.matrixWorld.clone().invert().multiply(c.head.matrixWorld):null;
 c.mixer.timeScale=0;c.shadow.visible=false;c.tell.visible=false;c.bar.visible=false;c.grounded=false;
 function apply(alpha=1){
  for(let i=0;i<display.length;i++)display[i].copy(previous[i]).lerp(solver.nodes[i].p,alpha);
  const bodyDelta=torsoFrame(at).multiply(initialFrame),parentQ=new T.Quaternion();
  for(const name of names){const b=c.bones[name],direction=at(nextBone[name]).clone().sub(at(name)).normalize(),reference=initialDirs.get(name).clone().applyQuaternion(bodyDelta);
   const q=new T.Quaternion().setFromUnitVectors(reference,direction).multiply(bodyDelta).multiply(worldQuats.get(name));
   b.parent.updateWorldMatrix(true,false);b.position.copy(b.parent.worldToLocal(at(name).clone()));b.parent.getWorldQuaternion(parentQ);b.quaternion.copy(parentQ.invert().multiply(q));b.updateWorldMatrix(false,false);
  }
  c.root.updateMatrixWorld(true);
  if(c.head&&headOffset){const m=c.root.matrixWorld.clone().invert().multiply(c.bones.head.matrixWorld).multiply(headOffset);m.decompose(c.head.position,c.head.quaternion,c.head.scale)}
 }
 function restore(){c.mixer.timeScale=1;c.mixer.stopAllAction();c.activeClip='';for(const [name,s] of saved){const b=c.bones[name];b.position.copy(s.position);b.quaternion.copy(s.quaternion);b.scale.copy(s.scale)}if(headPose){c.head.position.copy(headPose.position);c.head.quaternion.copy(headPose.quaternion);c.head.scale.copy(headPose.scale)}c.shadow.visible=true;c.root.updateMatrixWorld(true);c.poseHistory?.clear();c.poseVelocity?.clear()}
 return {solver,apply,restore,step(dt){for(let i=0;i<previous.length;i++)previous[i].copy(solver.nodes[i].p);solver.step(dt,world)},get focus(){return at('pelvis').clone().lerp(at('spine3'),.6)},get state(){return solver.state}};
}
export function clearRagdoll(c){if(c.ragdoll){c.ragdoll.restore();c.ragdoll=null}}
