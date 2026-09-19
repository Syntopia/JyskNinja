import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {V,boxAt,segmentDistance} from './physics.js';
import {createBambooFall} from './bamboo-fall.js';
import {bambooLayout,bambooWind} from './bamboo-layout.js';
export function createBambooGrove(parent,solids){
 const root=new T.Group();root.name='Choppable garden bamboo groves';parent.add(root);const stems=[],up=V(0,1,0);let time=0,cuts=0;
 const wood=new T.MeshStandardMaterial({name:'Living bamboo waxy green skin',vertexColors:true,roughness:.48,metalness:0}),leaves=new T.MeshStandardMaterial({name:'Bamboo lanceolate leaves',vertexColors:true,roughness:.71,side:T.DoubleSide});
 const canvas=document.createElement('canvas');canvas.width=128;canvas.height=512;const ctx=canvas.getContext('2d'),im=ctx.createImageData(128,512);
 for(let y=0;y<512;y++)for(let x=0;x<128;x++){const k=(y*128+x)*4,v=218+Math.sin(x*2.3+Math.sin(y*.04)*.12)*15+Math.sin(x*.35)*12+Math.sin(y*.057+x*.32)*5;im.data[k]=v;im.data[k+1]=v;im.data[k+2]=v;im.data[k+3]=255}ctx.putImageData(im,0,0);wood.map=new T.CanvasTexture(canvas);wood.map.colorSpace=T.SRGBColorSpace;wood.map.anisotropy=4;
 const leafTime={value:0};leaves.onBeforeCompile=s=>{s.uniforms.bambooTime=leafTime;s.vertexShader='uniform float bambooTime;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n transformed.x+=sin(bambooTime*3.2+position.y*7.+position.z*9.)*.038;')};leaves.customProgramCacheKey=()=> 'bamboo-leaf-flutter-v2';
 function painted(g,color){if(g.index)g=g.toNonIndexed();const c=new T.Color(color),a=new Float32Array(g.attributes.position.count*3);for(let i=0;i<a.length;i+=3){a[i]=c.r;a[i+1]=c.g;a[i+2]=c.b}g.setAttribute('color',new T.BufferAttribute(a,3));return g}
 function segment(stem,lo,hi){const parts=[],r=stem.radius,len=hi-lo,shade=stem.id%3===0?0x859e42:stem.id%3===1?0x5b883b:0x709b4b;
  let g=new T.CylinderGeometry(r*.90,r,len,14,1,true);g.translate(0,len/2,0);parts.push(painted(g,shade));
  for(let y=Math.ceil((lo+.025)/.38)*.38;y<hi-.025;y+=.38){g=new T.CylinderGeometry(r*1.045,r*1.07,.031,14);g.translate(0,y-lo,0);parts.push(painted(g,0xadb775));g=new T.CylinderGeometry(r*1.03,r*1.03,.009,14);g.translate(0,y-lo-.024,0);parts.push(painted(g,0x405b2f))}
  // Hollow pale cut ends with a recessed dark interior, rather than solid plugs.
  for(const y of [0,len]){g=new T.RingGeometry(r*.67,r,14);g.rotateX(y? -Math.PI/2:Math.PI/2);g.translate(0,y,0);parts.push(painted(g,0xd4cf9a));g=new T.CylinderGeometry(r*.67,r*.67,.085,14,1,true);g.translate(0,y+(y?-.042:.042),0);parts.push(painted(g,0x3f5427))}
  const merged=mergeGeometries(parts);for(const p of parts)p.dispose();return merged;
 }
 function foliage(stem){const parts=[];for(let j=0;j<(stem.height>6?8:6);j++){
  const y=stem.height-.35-j*(stem.height>6?.34:.27),a=stem.id*2.399+j*2.2,d=V(Math.cos(a),.24,Math.sin(a)).normalize(),start=V(0,y,0),end=start.clone().addScaledVector(d,1.02+j*.055);
  let branch=new T.CylinderGeometry(.007,.014,start.distanceTo(end),6);branch.applyQuaternion(new T.Quaternion().setFromUnitVectors(up,d));branch.translate(...start.clone().add(end).multiplyScalar(.5).toArray());parts.push(painted(branch,0x5c7632));
  for(let k=0;k<8;k++){const base=start.clone().lerp(end,.2+k*.1),sign=k%2?1:-1,dir=V(Math.cos(a+sign*.7),-.12,Math.sin(a+sign*.7)),len=.38+(k%3)*.075,tip=base.clone().addScaledVector(dir,len),mid=base.clone().lerp(tip,.43),side=V(-dir.z,.12,dir.x).multiplyScalar(.060);
   const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute([...base.toArray(),...mid.clone().add(side).toArray(),...tip.toArray(),...base.toArray(),...tip.toArray(),...mid.clone().sub(side).toArray()],3));geo.setAttribute('uv',new T.Float32BufferAttribute([.5,0,0,.45,.5,1,.5,0,.5,1,1,.45],2));geo.computeVertexNormals();parts.push(painted(geo,k%3?0x48773a:0x789947));
  }
 }const g=mergeGeometries(parts);for(const p of parts)p.dispose();return g}
 const layout=bambooLayout(solids),clusterCount=new Set(layout.map(s=>s.cluster)).size;
 for(const {id,x,z,height,radius} of layout){
  const pivot=new T.Group();pivot.position.set(x,.025,z);root.add(pivot);const stem={id,x,z,height,radius,pivot,cut:false,phase:id*1.37,axis:up.clone(),base:V(x,.025,z)};
  stem.mesh=new T.Mesh(segment(stem,0,height),wood);stem.crown=new T.Mesh(foliage(stem),leaves);for(const m of [stem.mesh,stem.crown]){m.castShadow=m.receiveShadow=true;pivot.add(m)}
  stem.colliders=Array.from({length:Math.ceil(height/2.5)},()=>({box:boxAt(x,height/2,z,radius*2+.06,height,radius*2+.06),material:'wood',bamboo:stem}));stem.collider=stem.colliders[0];solids.push(...stem.colliders);stems.push(stem);
 }
 function bladeHits(a,b){const hits=[];for(const s of stems){if(s.cut)continue;const tip=s.base.clone().addScaledVector(s.axis,s.height),q=segmentDistance(a,b,s.base,tip);if(q.distance<s.radius+.025)hits.push({distance:q.point.distanceTo(a),p:q.other,bamboo:s})}return hits}
 function chop(s,point,direction){if(s.cut)return false;const h=T.MathUtils.clamp(point.clone().sub(s.base).dot(s.axis),.16,s.height-.14);s.cut=true;s.cutHeight=h;cuts++;
  s.mesh.geometry.dispose();s.mesh.geometry=segment(s,0,h);
  const top=new T.Group();root.add(top);const body=new T.Mesh(segment(s,h,s.height),wood);body.castShadow=body.receiveShadow=true;top.add(body);s.pivot.remove(s.crown);s.crown.position.y=-h;top.add(s.crown);s.fallen=top;
  const dir=direction.clone();dir.y=0;if(dir.lengthSq()<.001)dir.set(Math.sin(s.phase),0,Math.cos(s.phase));dir.normalize();s.fall=createBambooFall({x:point.x,z:point.z,y:point.y,length:s.height-h,radius:s.radius,dx:dir.x,dz:dir.z,tilt:.045});
  updateColliders(s,h);
  updateFallen(s);return true;
 }
 function updateFallen(s){const f=s.fall.state,axis=V(f.dx*Math.sin(f.angle),Math.cos(f.angle),f.dz*Math.sin(f.angle));s.fallen.quaternion.setFromUnitVectors(up,axis);s.fallen.position.set(f.x,f.y,f.z).addScaledVector(axis,-f.length/2)}
 function updateColliders(s,height){
  const n=s.cut?1:s.colliders.length;
  for(let i=0;i<s.colliders.length;i++){
   const c=s.colliders[i];c.broken=i>=n;if(c.broken)continue;
   const a=s.base.clone().addScaledVector(s.axis,height*i/n),b=s.base.clone().addScaledVector(s.axis,height*(i+1)/n);
   c.box.min.copy(a).min(b).addScalar(-s.radius);c.box.max.copy(a).max(b).addScalar(s.radius);c.box.min.y=Math.max(0,c.box.min.y);
  }
 }
 function fixed(dt){time+=dt;leafTime.value=time;for(const s of stems){if(s.cut){s.fall.step(dt);updateFallen(s);continue}const wind=bambooWind(time,s.phase,s.height);s.pivot.rotation.set(wind.x,0,wind.z);s.axis.copy(up).applyQuaternion(s.pivot.quaternion);
   // Short sections follow the lean without a canopy-wide invisible wall at foot level.
   updateColliders(s,s.height);
  }}
 function reset(){time=cuts=0;for(const s of stems){if(s.cut){s.mesh.geometry.dispose();s.mesh.geometry=segment(s,0,s.height);s.fallen.remove(s.crown);for(const o of s.fallen.children)o.geometry?.dispose();s.fallen.removeFromParent();s.pivot.add(s.crown);s.crown.position.y=0;s.fallen=s.fall=null}s.cut=false;s.cutHeight=null;s.pivot.rotation.set(0,0,0)}fixed(0)}
 fixed(0);return {root,stems,bladeHits,chop,fixed,reset,get state(){return {clusters:clusterCount,stalks:stems.length,cuts,stems:stems.map(s=>({id:s.id,x:s.x,z:s.z,height:s.height,cut:s.cut,cutHeight:s.cutHeight,axis:s.axis.toArray(),fall:s.fall?{...s.fall.state}:null}))}}};
}
