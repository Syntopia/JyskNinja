import {poseLadder} from './ladder-climb.js';
import {poseClimb} from './ledge-climb.js';
import * as T from 'three';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {makeWoolMaterial} from './fabric-material.js';
import {V} from './physics.js';
export function makeSword(color=0xe7d7b3){
 const group=new T.Group();group.name='Contact katana';
 const steel=new T.MeshStandardMaterial({color:0xc8e0e8,metalness:.85,roughness:.27}),gripMat=new T.MeshStandardMaterial({color:0x17232c,roughness:.85}),gold=new T.MeshStandardMaterial({color,metalness:.65,roughness:.35});
 const shape=new T.Shape();shape.moveTo(-.016,0);shape.lineTo(.016,0);shape.quadraticCurveTo(.026,.45,.062,.84);shape.lineTo(.036,.89);shape.quadraticCurveTo(.006,.40,-.016,0);
 const blade=new T.Mesh(new T.ExtrudeGeometry(shape,{depth:.006,bevelEnabled:false}),steel);blade.position.y=.115;group.add(blade);
 const grip=new T.Mesh(new T.CylinderGeometry(.018,.018,.22,8),gripMat);group.add(grip);const guard=new T.Mesh(new T.CylinderGeometry(.055,.055,.012,16),gold);guard.position.y=.11;guard.scale.z=.7;group.add(guard);
 for(let i=0;i<7;i++){const wrap=new T.Mesh(new T.TorusGeometry(.019,.003,3,8),gold);wrap.rotation.x=Math.PI/2;wrap.position.y=-.09+i*.027;group.add(wrap)}
 group.position.set(0,.067,.014);group.rotation.set(Math.PI/2,0,0);group.traverse(o=>{if(o.isMesh)o.castShadow=true});
 const base=new T.Object3D(),tip=new T.Object3D();base.position.set(0,.14,.003);tip.position.set(.044,1.0,.003);group.add(base,tip);group.userData={base,tip};return group;
}
function maskedHead(color,wetness){
 const root=new T.Group(),cloth=makeWoolMaterial({name:'Ninja hood | wool cloth',color:0x182532},wetness),trim=makeWoolMaterial({name:'Ninja headband | wool cloth',color},wetness),black=new T.MeshStandardMaterial({color:0x080e15,roughness:.9}),eyes=new T.MeshStandardMaterial({color:0xe2bd91,emissive:0xab6e32,emissiveIntensity:.22});
 function part(g,m,p,scale){const o=new T.Mesh(g,m);o.position.copy(p);if(scale)o.scale.copy(scale);o.castShadow=true;root.add(o);return o}
 part(new T.SphereGeometry(1,18,14),cloth,V(0,0,0),V(.117,.145,.119));
 part(new T.CylinderGeometry(.073,.095,.24,12),cloth,V(0,-.18,0));
 part(new T.SphereGeometry(1,16,10),cloth,V(0,-.062,.04),V(.115,.072,.071));
 part(new T.BoxGeometry(.18,.036,.02),black,V(0,.023,.109));
 for(const x of [-.044,.044])part(new T.SphereGeometry(1,8,6),eyes,V(x,.023,.122),V(.018,.007,.003));
 const band=part(new T.TorusGeometry(.116,.012,4,24),trim,V(0,.078,0));band.rotation.x=Math.PI/2;
 for(const x of [-.055,.045]){const tie=part(new T.BoxGeometry(.038,.24,.008),trim,V(x,-.03,-.125));tie.rotation.z=x*3}
 return root;
}
export function createCharacter(template,clips,scene,{enemy=false,boss=false,color=0x843d4a,name='The Last Blade',index=0,rig=null}={}){
 const wetness={value:0};
 const root=new T.Group(),model=clone(template);root.add(model);const size=boss?1.48:1;root.scale.setScalar(size);scene.add(root);const bones={};const tint=new Map();
 model.traverse(o=>{if(o.isBone)bones[o.name]=o;if(enemy&&/^Ninja_(Hair|Face|Skin)/.test(o.name))o.visible=false;if(o.isMesh){o.frustumCulled=false;o.castShadow=!o.name.includes('Hair');o.receiveShadow=false;let ms=Array.isArray(o.material)?o.material:[o.material];ms=ms.map(m=>{if(tint.has(m))return tint.get(m);let n=m.clone();if(n.name.includes('dyeable')){n=makeWoolMaterial({name:n.name,color:enemy?color:0x283d48,side:n.side},wetness)}if(o.name.includes('Hair')){const cropped=n.name.includes('stubble'),tie=n.name.includes('cotton tie');n.roughness=cropped?.87:tie?.94:.60;n.metalness=0;n.side=T.DoubleSide;n.envMapIntensity=cropped?.25:.45;if(n.isMeshPhysicalMaterial){n.anisotropy=cropped||tie?0:.25;n.specularIntensity=cropped||tie?.5:.44;n.anisotropyRotation=Math.PI/2;}if(cropped){n.alphaHash=false;n.transparent=true;n.depthWrite=false;n.side=T.FrontSide;n.opacity=1;o.renderOrder=2;}o.userData.noCameraFade=true;}if(/Face|Skin/.test(o.name)){n.roughness=.73;n.envMapIntensity=.25;n.color.multiplyScalar(.86)}tint.set(m,n);return n});o.material=Array.isArray(o.material)?ms:ms[0]}});
 const clothClock={value:0};model.traverse(o=>{if(!o.isMesh)return;if(o.name.includes('SashTail')){const prior=o.material.onBeforeCompile;o.material=o.material.clone();o.material.side=T.DoubleSide;o.material.onBeforeCompile=shader=>{prior(shader);shader.uniforms.clothTime=clothClock;shader.vertexShader='uniform float clothTime;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>\n float loose=clamp((.99-position.y)/.32,0.,1.);transformed.z+=sin(clothTime*3.4+position.y*13.+position.x*9.)*.028*loose*loose;transformed.x+=sin(clothTime*2.1+position.y*8.)*.015*loose;`);};o.material.customProgramCacheKey=()=> 'pinned-sash-motion-v2';}});
 // Mk II cloth keeps its attachment seam fixed; free hems receive subtle secondary motion.
 if(boss)model.traverse(o=>{
  if(!o.isMesh)return;
  if(/woven/.test(o.material.name)){
   o.material.metalness=0;o.material.roughness=.95;o.material.envMapIntensity=.32;
   if(o.material.specularIntensity!==undefined)o.material.specularIntensity=.35;
  }
  if(!/^Mech_(Cape|Tabard)_/.test(o.name))return;
  const cape=o.name.startsWith('Mech_Cape_');o.userData.noCameraFade=true;
  o.material=o.material.clone();o.material.side=T.DoubleSide;
  o.material.onBeforeCompile=shader=>{
   shader.uniforms.mechClothTime=clothClock;
   shader.vertexShader='uniform float mechClothTime;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
    float loose=clamp((${cape?'1.56':'1.04'}-position.y)/${cape?'.52':'.45'},0.,1.);
    transformed.z+=sin(mechClothTime*3.3+position.y*14.+position.x*8.)*${cape?'.022':'.009'}*loose*loose;
    transformed.x+=sin(mechClothTime*2.2+position.y*11.)*${cape?'.012':'.005'}*loose*loose;
   `);
  };
  o.material.customProgramCacheKey=()=>cape?'mech-mk2-cape':'mech-mk2-tabard';
 });
 const sword=makeSword(boss?0xbfa575:enemy?color:0xd5bb7c);if(boss)sword.scale.setScalar(1.12);if(rig){const socket=new T.Group();socket.name=rig.name+' sword socket';socket.quaternion.fromArray(rig.swordSocketRotation);if(rig.swordSocketPosition)socket.position.fromArray(rig.swordSocketPosition);socket.scale.setScalar(1/rig.displayScale);bones.right_wrist.add(socket);socket.add(sword)}else bones.right_wrist.add(sword);
 const mixer=new T.AnimationMixer(model),actions={};for(const [name,clip] of Object.entries(clips))actions[name]=mixer.clipAction(clip);
 const shadow=new T.Mesh(new T.CircleGeometry(.44,24),new T.MeshBasicMaterial({color:0x050d18,transparent:true,opacity:.3,depthWrite:false}));shadow.rotation.x=-Math.PI/2;scene.add(shadow);
 const tell=new T.Mesh(new T.RingGeometry(.39,.44,48),new T.MeshBasicMaterial({color:enemy?0xf28772:0xd4c397,transparent:true,opacity:.5,side:T.DoubleSide,depthWrite:false}));tell.rotation.x=-Math.PI/2;root.add(tell);tell.position.y=.055;
 const head=enemy&&!boss&&!rig?maskedHead(color,wetness):null;if(head)root.add(head);
 const bar=new T.Group();if(enemy){const bg=new T.Mesh(new T.PlaneGeometry(.62,.045),new T.MeshBasicMaterial({color:0x15212c,depthTest:false})),fill=new T.Mesh(new T.PlaneGeometry(.60,.028),new T.MeshBasicMaterial({color:0xd09b90,depthTest:false}));fill.position.z=.001;bar.add(bg,fill);bar.userData.fill=fill;scene.add(bar)}
 const c={poseHistory:new Map(),poseVelocity:new Map(),velocity:V(),ragdoll:null,root,model,bones,mixer,actions,sword,head,bar,shadow,tell,enemy,boss,size,color,name,index,severed:new Set(),pos:V(),yaw:0,vy:0,radius:.29*size,height:1.72*size,grounded:true,hp:enemy?70:100,maxHp:enemy?70:100,stamina:100,state:'idle',timer:0,duration:0,invuln:0,cooldown:.7+index*.4,combo:0,hitSet:new Set(),previousBlade:null,knock:V(),moveDir:V(),activeClip:'',alive:true,block:false,blockTime:0,aiHold:false,queued:false,deadTime:0};
 c.setFabricWetness=value=>{wetness.value=T.MathUtils.clamp(value,0,1)};
 Object.defineProperty(c,'fabricWetness',{get:()=>wetness.value});
 c.play=(name,fade=.12,speed=1,once=false)=>{if(c.activeClip===name&&!once){c.action.setEffectiveTimeScale(speed);c.clipSpeed=speed;return;}const next=actions[name]||actions.idle;if(c.action)c.action.fadeOut(fade);next.reset().setEffectiveWeight(1).setEffectiveTimeScale(speed).setLoop(once?T.LoopOnce:T.LoopRepeat,once?1:Infinity);next.clampWhenFinished=true;next.fadeIn(fade).play();c.action=next;c.activeClip=name;c.clipSpeed=speed};
 c.blade=()=>({a:sword.userData.base.getWorldPosition(V()),b:sword.userData.tip.getWorldPosition(V())});
 c.capsules=()=>{const p=n=>bones[n].getWorldPosition(V());const parts=[['spine1','neck',.235,'body'],['left_shoulder','left_elbow',.11,'arm'],['left_elbow','left_wrist',.095,'arm'],['right_shoulder','right_elbow',.11,'arm'],['right_elbow','right_wrist',.095,'arm'],['left_hip','left_knee',.14,'leg'],['left_knee','left_ankle',.115,'leg'],['right_hip','right_knee',.14,'leg'],['right_knee','right_ankle',.115,'leg']].map(([a,b,r,part])=>({a:p(a),b:p(b),r,part,region:part==='arm'?(a.startsWith('left')?'left_arm':'right_arm'):null}));const h=p('head').add(V(0,(enemy?.08:.036)*size,0));parts.push({a:h,b:h.clone().add(V(0,.07*size,0)),r:.14,part:'head',region:'head'});for(const p of parts)p.r*=size;return parts.filter(p=>!c.severed.has(p.region))};
 c.visual=(dt,camera)=>{if(c.ragdoll){clothClock.value+=dt;c.ragdoll.apply();return;}clothClock.value+=dt;root.position.copy(c.pos);root.rotation.y=c.yaw;mixer.update(dt);root.updateMatrixWorld(true);if(c.climb)poseClimb(c);if(c.ladder)poseLadder(c);if(c.alive&&dt>0){for(const [name,b] of Object.entries(bones)){const p=b.getWorldPosition(V()),old=c.poseHistory.get(name);if(old)c.poseVelocity.set(name,p.clone().sub(old).divideScalar(dt).clampLength(0,12));c.poseHistory.set(name,p)}}if(head){head.position.copy(root.worldToLocal(bones.head.getWorldPosition(V()))).add(V(0,.035,0));head.rotation.z=Math.sin(c.timer*2)*.015}shadow.position.copy(c.pos).add(V(0,.018,0));shadow.scale.setScalar(size*Math.max(.4,1-c.pos.y*.12));tell.visible=c.alive&&(c.enemy||c.state==='block');tell.material.color.setHex(boss?(c.phase===2?0xff753d:0xeac176):enemy?0xf28772:0xd4c397);tell.material.opacity=['windup','overdrive'].includes(c.state)?.65+.3*Math.sin(c.timer*25):.14;tell.scale.setScalar(c.state==='windup'?1+c.timer*.7:1);if(enemy){bar.visible=!boss&&c.alive&&c.hp<c.maxHp;bar.position.copy(c.pos).add(V(0,2.02,0));bar.quaternion.copy(camera.quaternion);bar.userData.fill.scale.x=Math.max(0,c.hp/c.maxHp);bar.userData.fill.position.x=-(1-c.hp/c.maxHp)*.3}};
 c.play('guard',0);return c;
}
