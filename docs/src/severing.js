import * as T from 'three';
import {V,segmentBox} from './physics.js';
const regions={left_arm:['left_shoulder','left_elbow','left_wrist'],right_arm:['right_shoulder','right_elbow','right_wrist'],head:['head']};
const pivotBone={left_arm:'left_shoulder',right_arm:'right_shoulder',head:'head'};
const classifications=new WeakMap();
function classify(mesh){
 const geo=mesh.geometry;if(classifications.has(geo))return classifications.get(geo);
 const ids=geo.attributes.skinIndex,weights=geo.attributes.skinWeight,result=new Uint8Array(geo.attributes.position.count);
 const names=Object.keys(regions),boneRegion=mesh.skeleton.bones.map(b=>{for(let joint=b;joint?.isBone;joint=joint.parent){const region=names.findIndex(n=>regions[n].includes(joint.name));if(region>=0)return region+1}return 0});
 for(let i=0;i<result.length;i++){const sums=[0,0,0,0];for(let j=0;j<4;j++)sums[boneRegion[ids.getComponent(i,j)]||0]+=weights.getComponent(i,j);let best=0;for(let k=1;k<4;k++)if(sums[k]>sums[best])best=k;result[i]=best}
 classifications.set(geo,result);return result;
}
function isVisible(object){for(let o=object;o;o=o.parent)if(!o.visible)return false;return true}
function materialCopies(material){return Array.isArray(material)?material.map(m=>m.clone()):material.clone()}
function bakedPiece(mesh,indices,pivot,material){
 const source=mesh.geometry,positions=[],uvs=[],point=V(),uv=source.attributes.uv;
 for(const i of indices){mesh.getVertexPosition(i,point).applyMatrix4(mesh.matrixWorld).sub(pivot);positions.push(point.x,point.y,point.z);uvs.push(uv?uv.getX(i):0,uv?uv.getY(i):0)}
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));geo.computeVertexNormals();
 const piece=new T.Mesh(geo,materialCopies(material));piece.castShadow=true;piece.receiveShadow=true;piece.frustumCulled=false;return piece;
}
function disposeObject(root){root.traverse(o=>{if(o.isMesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose()}});root.removeFromParent()}
export function restoreCharacter(c){
 for(const [mesh,original] of c.cutGeometry||[]){mesh.geometry.dispose();mesh.geometry=original}
 c.cutGeometry?.clear();for(const cap of c.cutCaps||[])disposeObject(cap);c.cutCaps=[];c.severed.clear();c.sword.visible=true;if(c.head)c.head.visible=true;
}
export function detachRegion(c,region){
 if(!regions[region]||c.severed.has(region))return null;
 c.root.updateMatrixWorld(true);const pivot=c.bones[pivotBone[region]].getWorldPosition(V()),group=new T.Group();group.position.copy(pivot);group.name='Detached '+region;
 const regionId=Object.keys(regions).indexOf(region)+1;
 c.model.traverse(mesh=>{
  if(!mesh.isSkinnedMesh||!isVisible(mesh))return;
  mesh.skeleton.update();const geo=mesh.geometry,tag=classify(mesh),idx=geo.index;
  const materialGroups=geo.groups.length?geo.groups:[{start:0,count:idx?idx.count:geo.attributes.position.count,materialIndex:0}];
  const remaining=[],groups=[];let removed=0;
  for(const g of materialGroups){const cut=[],start=remaining.length;
   for(let at=g.start;at<g.start+g.count;at+=3){const ids=[0,1,2].map(j=>idx?idx.getX(at+j):at+j);const chosen=ids.filter(i=>tag[i]===regionId).length>=2;(chosen?cut:remaining).push(...ids)}
   groups.push({start,count:remaining.length-start,materialIndex:g.materialIndex});
   if(cut.length){const mat=Array.isArray(mesh.material)?mesh.material[g.materialIndex]:mesh.material;group.add(bakedPiece(mesh,cut,pivot,mat));removed+=cut.length}
  }
  if(removed){c.cutGeometry??=new Map();if(!c.cutGeometry.has(mesh))c.cutGeometry.set(mesh,geo);const next=geo.clone();next.setIndex(remaining);next.clearGroups();for(const g of groups)next.addGroup(g.start,g.count,g.materialIndex);classifications.set(next,tag);if(geo!==c.cutGeometry.get(mesh))geo.dispose();mesh.geometry=next}
 });
 // Enemy hoods and the wrist-mounted sword are separate rigid meshes.
 const rigid=region==='head'?c.head:region==='right_arm'?c.sword:null;
 if(rigid?.visible){rigid.updateWorldMatrix(true,true);rigid.traverse(o=>{if(!o.isMesh||!o.visible)return;const idx=o.geometry.index;const indices=Array.from({length:idx?idx.count:o.geometry.attributes.position.count},(_,i)=>idx?idx.getX(i):i);group.add(bakedPiece(o,indices,pivot,o.material))});rigid.visible=false}
 if(!group.children.length)return null;
 c.severed.add(region);const cap=new T.Mesh(new T.SphereGeometry(1,12,8),new T.MeshStandardMaterial({color:c.boss?0x242a30:0x411e2b,roughness:.88}));cap.name='Closed cut surface';cap.scale.set(region==='head'?.068:.085,.023,region==='head'?.068:.085);c.bones[pivotBone[region]].add(cap);c.cutCaps??=[];c.cutCaps.push(cap);
 group.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(group),center=bounds.getCenter(V()),shift=center.clone().sub(pivot);
 for(const child of group.children)child.position.sub(shift);group.position.copy(center);
 const radius=Math.min(.26,bounds.getSize(V()).length()*.20);
 return {group,radius,region};
}
export function createImpactEffects(scene,world){
 const fragments=[],drops=[],stains=[],capacity=560;
 const droplets=new T.InstancedMesh(new T.IcosahedronGeometry(1,0),new T.MeshStandardMaterial({roughness:.5,metalness:.12}),capacity);droplets.instanceMatrix.setUsage(T.DynamicDrawUsage);droplets.count=0;droplets.frustumCulled=false;scene.add(droplets);
 const dummy=new T.Object3D(),color=new T.Color();
 function splash(point,direction,metal=false,large=false){
  const count=large?65:22;
  for(let i=0;i<count;i++){const speed=1.5+Math.random()*3.5;const v=direction.clone().multiplyScalar(speed).add(V((Math.random()-.5)*4,1+Math.random()*3,(Math.random()-.5)*4));drops.push({p:point.clone(),v,life:.45+Math.random()*.7,size:.014+Math.random()*.022,color:metal?(i%3?0xe9b562:0x5b6573):(i%3?0x9d233c:0x551526),metal})}
  if(drops.length>capacity)drops.splice(0,drops.length-capacity);
 }
 function stain(p,metal){
  if(stains.length>=40)disposeObject(stains.shift().mesh);
  const mesh=new T.Mesh(new T.CircleGeometry(.07+Math.random()*.09,7),new T.MeshBasicMaterial({color:metal?0x18252b:0x571b30,transparent:true,opacity:.58,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1}));mesh.rotation.set(-Math.PI/2,0,Math.random()*6);mesh.position.copy(p);mesh.position.y=world.floorAt(p.x,p.z)+.025;mesh.scale.x=1+Math.random();scene.add(mesh);stains.push({mesh,life:8});
 }
 function add(fragment,direction){
  if(!fragment)return;if(fragments.length>=12)disposeObject(fragments.shift().group);
  fragment.v=direction.clone().multiplyScalar(2.3).add(V(0,2.8,0));fragment.spin=V((Math.random()-.5)*8,(Math.random()-.5)*6,(Math.random()-.5)*8);fragment.life=10;scene.add(fragment.group);fragments.push(fragment);
 }
 function update(dt){
  for(let i=drops.length-1;i>=0;i--){const p=drops[i];p.life-=dt;p.v.y-=12*dt;p.p.addScaledVector(p.v,dt);const floor=world.floorAt(p.p.x,p.p.z)+.03;if(p.p.y<floor){if(i%5===0)stain(p.p,p.metal);p.life=0}if(p.life<=0)drops.splice(i,1)}
  for(let i=0;i<drops.length;i++){const p=drops[i];dummy.position.copy(p.p);dummy.quaternion.setFromUnitVectors(V(0,1,0),p.v.clone().normalize());dummy.scale.set(p.size*.75,p.size*(1+Math.min(2,p.v.length()*.15)),p.size*.75);dummy.updateMatrix();droplets.setMatrixAt(i,dummy.matrix);droplets.setColorAt(i,color.setHex(p.color))}droplets.count=drops.length;droplets.instanceMatrix.needsUpdate=true;if(droplets.instanceColor)droplets.instanceColor.needsUpdate=true;
  for(let i=fragments.length-1;i>=0;i--){const f=fragments[i];f.life-=dt;f.v.y-=12*dt;const old=f.group.position.clone(),next=old.clone().addScaledVector(f.v,dt);let blocked=false;
   for(const solid of world.solids){if(solid.broken)continue;if(segmentBox(old,next,solid.box,f.radius*.55)){blocked=true;break}}
   if(blocked){f.v.x*=-.25;f.v.z*=-.25;f.v.y=Math.max(0,f.v.y)*.35}else f.group.position.copy(next);
   f.group.updateMatrixWorld(true);const bottom=new T.Box3().setFromObject(f.group).min.y;const floor=world.floorAt(f.group.position.x,f.group.position.z)+f.group.position.y-bottom+.025;
   if(f.group.position.y<floor){f.group.position.y=floor;f.v.y=Math.abs(f.v.y)*.25;f.v.x*=.78;f.v.z*=.78;f.spin.multiplyScalar(.75)}
   f.group.rotation.x+=f.spin.x*dt;f.group.rotation.y+=f.spin.y*dt;f.group.rotation.z+=f.spin.z*dt;f.group.updateMatrixWorld(true);const low=new T.Box3().setFromObject(f.group).min.y,ground=world.floorAt(f.group.position.x,f.group.position.z)+.025;if(low<ground)f.group.position.y+=ground-low;if(f.life<1)f.group.scale.setScalar(Math.max(0,f.life));if(f.life<=0){disposeObject(f.group);fragments.splice(i,1)}
  }
  for(let i=stains.length-1;i>=0;i--){const s=stains[i];s.life-=dt;s.mesh.material.opacity=Math.min(.58,s.life*.3);if(s.life<=0){disposeObject(s.mesh);stains.splice(i,1)}}
 }
 function clear(){for(const f of fragments)disposeObject(f.group);for(const s of stains)disposeObject(s.mesh);fragments.length=drops.length=stains.length=0;droplets.count=0}
 return {splash,add,update,clear,get state(){return {fragments:fragments.length,droplets:drops.length,stains:stains.length,regions:fragments.map(f=>f.region)}}};
}
