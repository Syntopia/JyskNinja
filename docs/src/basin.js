import * as T from 'three';
import {createWaveField} from './wave-field.js';
export function createBasin(scene){
 const field=createWaveField(),minX=-14.75,minZ=-4,level=.015,waveStrength=1.3;
 const geometry=new T.PlaneGeometry(field.width,field.depth,field.nx,field.nz);geometry.rotateX(-Math.PI/2);const pos=geometry.attributes.position,norm=geometry.attributes.normal;
 pos.setUsage(T.DynamicDrawUsage);norm.setUsage(T.DynamicDrawUsage);
 const color=new T.BufferAttribute(new Float32Array(pos.count*3).fill(1),3);geometry.setAttribute('color',color);
 const material=new T.MeshPhysicalMaterial({name:'Simulated basin water',color:0x2d6673,metalness:.35,roughness:.14,clearcoat:1,clearcoatRoughness:.12,envMapIntensity:1.25,vertexColors:true,side:T.DoubleSide});
 const mesh=new T.Mesh(geometry,material);mesh.name='Basin | simulated wave surface';mesh.position.set(-12,level,1);mesh.frustumCulled=false;mesh.receiveShadow=true;scene.add(mesh);
 let previous=new WeakMap(),dirty=true,cpuMs=0,solveCalls=0,entryCount=0,wakeCount=0,rainCount=0;
 const inBounds=(x,z)=>x>minX&&x<minX+field.width&&z>minZ&&z<minZ+field.depth;
 function wet(x,y,z){return inBounds(x,z)&&y<level+.018&&!field.solid[Math.round((z-minZ)/field.dz)*field.cols+Math.round((x-minX)/field.dx)]}
 function impulse(x,z,radius,strength){const did=field.impulse(x-minX,z-minZ,radius,strength*waveStrength);dirty||=did;return did}
 function interact(c,dt){
  const p=c.pos;let old=previous.get(c);if(!old){old={x:p.x,y:p.y,z:p.z,wet:false,distance:0};previous.set(c,old)}
  const immersed=c.alive&&wet(p.x,p.y,p.z),distance=Math.hypot(p.x-old.x,p.z-old.z),vertical=(old.y-p.y)/Math.max(dt,.001);
  if(immersed&&!old.wet){if(impulse(p.x,p.z,.37,Math.min(.11,.045+Math.max(0,vertical)*.009)))entryCount++;old.distance=0}
  else if(immersed&&old.wet){old.distance+=Math.min(distance,.4);if(old.distance>.16){old.distance=0;const speed=Math.min(7,distance/Math.max(dt,.001));if(impulse(p.x,p.z,.22,.009+speed*.004))wakeCount++}}
  else if(!immersed&&old.wet){impulse(old.x,old.z,.30,.035);old.distance=0}
  old.x=p.x;old.y=p.y;old.z=p.z;old.wet=immersed;
 }
 function setObstacles(solids){field.setMask((x,z)=>{x+=minX;z+=minZ;return solids.some(s=>!s.broken&&s.box.min.y<=level&&s.box.max.y>=level&&x>s.box.min.x&&x<s.box.max.x&&z>s.box.min.z&&z<s.box.max.z)});dirty=true}
 function step(dt){const start=performance.now();field.step(dt);cpuMs+=(performance.now()-start);solveCalls++;dirty=true}
 function upload(){if(!dirty)return;const start=performance.now(),h=field.height;
  for(let k=0;k<h.length;k++){
   pos.setY(k,h[k]);const sx=(h[field.right[k]]-h[field.left[k]])/(2*field.dx),sz=(h[field.down[k]]-h[field.up[k]])/(2*field.dz),length=Math.hypot(sx,1,sz);norm.setXYZ(k,-sx/length,1/length,-sz/length);
   const crest=Math.min(.65,Math.max(0,h[k]-.012)*5+Math.max(0,Math.hypot(sx,sz)-.12)*.7);color.setXYZ(k,1+crest*.75,1+crest*.55,1+crest*.35);
  }
  pos.needsUpdate=norm.needsUpdate=color.needsUpdate=true;dirty=false;cpuMs+=performance.now()-start;
 }
 function reset(){field.reset();previous=new WeakMap();entryCount=wakeCount=rainCount=0;cpuMs=solveCalls=0;dirty=true;upload()}
 return {mesh,field,step,upload,interact,setObstacles,impulse,reset,
  rain(x,z){if(inBounds(x,z)&&Math.random()<.40&&impulse(x,z,.10,.0018))rainCount++},
  get state(){return {...field.state,entryCount,wakeCount,rainCount,cpuMsPerPhysicsFrame:cpuMs/Math.max(1,solveCalls),vertices:pos.count,method:'CPU finite-difference height field; GPU shaded displaced mesh'}}};
}
