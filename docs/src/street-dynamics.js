import * as T from 'three';
import {createClothField} from './cloth-field.js';
import {streetWind,createLanternPendulum,createFixedClock} from './street-motion.js';

export function createStreetDynamics(root,metadata){
 const cloths=[],lamps=[],clock=createFixedClock(),timeUniform={value:0},windUniform={value:1};
 const categories=new Map();root.updateMatrixWorld(true);
 root.traverse(o=>{if(o.isMesh){const k=o.userData.category;if(!categories.has(k))categories.set(k,[]);categories.get(k).push(o);}});
 const hemMaterial=new T.LineBasicMaterial({color:0xbfa97e,transparent:true,opacity:.52});
 for(const spec of metadata.banners||[]){
  const mesh=categories.get(spec.category)?.[0];if(!mesh)continue;
  const field=createClothField({...spec,wind:.55}),nx=spec.cols+1,geometry=new T.BufferGeometry(),uvs=[],indices=[],hem=[];
  for(let j=0;j<=spec.rows;j++)for(let i=0;i<=spec.cols;i++){
   uvs.push(spec.art*.25+.003+i/spec.cols*.244,j/spec.rows);
   const a=j*nx+i;
   if(j<spec.rows&&i<spec.cols)indices.push(a,a+nx,a+1,a+1,a+nx,a+nx+1);
   if(j===spec.rows&&i<spec.cols)hem.push(a,a+1);
   if((i===0||i===spec.cols)&&j<spec.rows)hem.push(a,a+nx);
  }
  geometry.setAttribute('position',new T.BufferAttribute(field.position,3).setUsage(T.DynamicDrawUsage));
  geometry.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();
  // glTF geometry is in Blender coordinates under a conversion node. Runtime
  // fields are already Y-up world coordinates, so give them an identity parent.
  mesh.removeFromParent();mesh.geometry.dispose();mesh.geometry=geometry;
  mesh.position.set(0,0,0);mesh.quaternion.identity();mesh.scale.set(1,1,1);root.add(mesh);
  mesh.material.side=T.DoubleSide;mesh.material.roughness=.91;
  mesh.frustumCulled=false;
  const hemGeometry=new T.BufferGeometry();hemGeometry.setAttribute('position',geometry.attributes.position);hemGeometry.setIndex(hem);
  const seams=new T.LineSegments(hemGeometry,hemMaterial);seams.frustumCulled=false;root.add(seams);
  cloths.push({field,mesh,spec});
 }
 for(const [index,spec] of (metadata.lights||[]).entries()){
  const nodes=categories.get(spec.category);if(!nodes?.length||!spec.pivot)continue;
  const pivot=new T.Group();pivot.name=spec.category+' suspension';pivot.position.fromArray(spec.pivot);root.add(pivot);pivot.updateMatrixWorld(true);
  for(const node of nodes)pivot.attach(node);
  lamps.push({index,spec,pivot,pendulum:createLanternPendulum(spec.length),offset:new T.Vector3(...spec.position).sub(pivot.position),position:new T.Vector3(...spec.position)});
 }
 // Small surface motion catches the breeze without moving trunks or branches.
 const materials=new Set();root.traverse(o=>{if(o.material)for(const m of(Array.isArray(o.material)?o.material:[o.material]))materials.add(m);});
 for(const material of materials){
  if(material.name.includes('Pine bough cards')){
   material.onBeforeCompile=shader=>{
    shader.uniforms.streetTime=timeUniform;shader.uniforms.streetWind=windUniform;
    shader.vertexShader='uniform float streetTime; uniform float streetWind;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
     float tip=sin(uv.x*3.14159)*sin(uv.y*3.14159);
     transformed.x+=tip*.055*streetWind*sin(streetTime*1.3+position.y*.45+position.x);
     transformed.z+=tip*.035*streetWind*sin(streetTime*1.8+position.x*.9);`);
   };material.customProgramCacheKey=()=> 'street-pine-wind-v1';material.needsUpdate=true;
  }
  if(material.name.includes('Japanese woven banners')){
   material.onBeforeCompile=shader=>{
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
     float weave=sin(vMapUv.x*1800.)*sin(vMapUv.y*2300.);
     roughnessFactor=clamp(roughnessFactor+weave*.035,0.,1.);`);
   };material.customProgramCacheKey=()=> 'street-woven-cotton-v1';material.needsUpdate=true;
  }
 }
 let strength=1,paused=false;
 function upload(){for(const {field,mesh}of cloths){mesh.geometry.attributes.position.needsUpdate=true;mesh.geometry.computeVertexNormals();}}
 function placeLamps(){for(const lamp of lamps){lamp.pivot.rotation.set(lamp.pendulum.angle[0],0,lamp.pendulum.angle[1]);lamp.position.copy(lamp.offset).applyEuler(lamp.pivot.rotation).add(lamp.pivot.position);}}
 return {
  timeUniform,windUniform,
  setWind(value){strength=T.MathUtils.clamp(value,0,2);windUniform.value=strength;},
  setPaused(value){paused=Boolean(value);},
  reset(){clock.reset();timeUniform.value=0;for(const c of cloths)c.field.reset();for(const l of lamps)l.pendulum.reset();upload();placeLamps();},
  update(dt,player){
   if(paused)return;
   const capsules=player?[{a:[player.x,.35,player.z],b:[player.x,1.4,player.z],r:.32}]:[];
   let stepped=false;
   clock.advance(dt,(h,time)=>{
    stepped=true;timeUniform.value=time;
    for(const {field,spec}of cloths){field.setWind(strength*.55*(.9+.1*Math.sin(time*.27+spec.z*.015)));field.step(h,capsules);}
    for(const lamp of lamps)lamp.pendulum.step(h,streetWind(time,lamp.spec.pivot[0],lamp.spec.pivot[2],strength));
   });
   if(stepped){upload();placeLamps();}
  },
  updateLight(point){
   const index=point.userData.streetLightIndex;if(index===undefined)return;
   const spec=metadata.lights[index],lamp=lamps.find(l=>l.index===index),t=clock.time;
   if(lamp)point.position.copy(lamp.position);else point.position.fromArray(spec.position);
   // Restrained flame fluctuation; never a strobe and independent of wind strength.
   point.intensity=spec.intensity*(.97+.018*Math.sin(t*5.1+index)+.012*Math.sin(t*8.7+index*2));
  },
  get stats(){let displacement=0,pinnedError=0,stretch=1,finite=true,angle=0;
   for(const c of cloths){const s=c.field.state;displacement=Math.max(displacement,s.maxDisplacement);pinnedError=Math.max(pinnedError,s.pinnedError);stretch=Math.max(stretch,s.maxStretch);finite&&=s.finite;}
   for(const l of lamps)angle=Math.max(angle,...l.pendulum.angle.map(Math.abs));
   return {cloths:cloths.length,lanterns:lamps.length,time:clock.time,displacement,pinnedError,stretch,finite,angle};
  },
  dispose(){hemMaterial.dispose();}
 };
}
