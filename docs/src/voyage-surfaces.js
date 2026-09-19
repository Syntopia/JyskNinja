import * as T from 'three';
import {texture,planarUV} from './surface.js';

const cache=new Map(),displaced=new WeakMap();
function maps(kind){
 if(cache.has(kind))return cache.get(kind);
 const stem={metal:'container-paint',wood:'warehouse-cedar',enamel:'train-enamel',plaster:'village-plaster'}[kind];
 const map=texture(`voyage-generated/${stem}-color.png`,true);map.anisotropy=8;
 const hasHeight=['metal','wood'].includes(kind);
 const height=hasHeight?texture(`voyage-generated/${stem}-height.png`):new T.TextureLoader().load(`./assets/textures/voyage-generated/${stem}-color.png`);
 height.wrapS=height.wrapT=T.RepeatWrapping;height.anisotropy=8;
 const value={map,height,hasHeight};cache.set(kind,value);return value;
}

export function voyageSurface(m,stage){
 if(m.userData.generatedVoyage)return true;
 let kind,tint;
 if(/charred cedar siding|Oiled dock timber|Wet marine cedar|Weathered cedar timber/.test(m.name)){kind='wood';tint=/charred/.test(m.name)?0xb8b7b2:0xd8bba2}
 else if(m.name==='Pearl white aluminium'){kind='enamel';tint=0xf3f6fa}
 else if(m.name==='Warm village plaster'){kind='plaster';tint=0xeee1cb}
 else if(/^(Refined (Oxide red paint|Salt-weathered steel|Ivory enamel)|Storm bridge weathered enamel|Warm ivory enamel|Graphite powder-coated steel)$/.test(m.name)){
  kind='metal';tint=/Oxide red/.test(m.name)?0xa95945:/Graphite/.test(m.name)?0x66747a:/steel/.test(m.name)?0x638496:0xd1d3c5;
 }else return false;
 const s=maps(kind);m.map=s.map;m.normalMap=null;m.bumpMap=s.height;
 m.bumpScale=kind==='wood'?.016:kind==='metal'?.011:kind==='enamel'?.0015:.008;
 m.roughnessMap=s.height;m.roughness=1;m.metalness=kind==='metal'?.28:kind==='enamel'?.38:0;m.envMapIntensity=.85;m.color.setHex(tint);
 m.userData.generatedVoyage={kind,stage,generatedHeight:s.hasHeight};
 const previous=m.onBeforeCompile;
 m.onBeforeCompile=shader=>{
  previous.call(m,shader);
  if(kind==='metal'){
   // Tint intact neutral paint, but retain orange-brown rust on every clan colour.
   shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
    #ifdef USE_MAP
     vec4 paint=texture2D(map,vMapUv);
     float rust=smoothstep(.035,.16,paint.r-paint.b)*smoothstep(.05,.22,paint.r);
     diffuseColor.rgb=mix(diffuseColor.rgb*paint.rgb,paint.rgb*.66,rust*.85);
     diffuseColor.a*=paint.a;
    #endif`);
  }
  const floor=kind==='enamel'?.18:kind==='metal'?.29:kind==='wood'?.46:.57;
  const gain=kind==='enamel'?.2:kind==='metal'?.65:kind==='wood'?.43:.36;
  shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
   roughnessFactor=clamp(${floor}+roughnessFactor*${gain},.16,.95);`);
 };
 m.customProgramCacheKey=()=>`voyage-generated-v1-${kind}`;m.needsUpdate=true;return true;
}

// Metre-scale UV projection in prototype coordinates, before batching/instancing.
export function voyageUV(g,m){
 const kind=m.userData.generatedVoyage?.kind;if(!kind)return g;
 if(kind==='enamel')return g; // Authored train UVs follow the curved body.
 const p=g.attributes.position,n=g.attributes.normal,uv=new Float32Array(p.count*2);
 g.computeBoundingBox();const size=g.boundingBox.getSize(new T.Vector3());
 const along=kind==='wood'?(size.x>size.y&&size.x>size.z?0:size.z>size.y?2:1):1;
 const coords=(i)=>[p.getX(i),p.getY(i),p.getZ(i)];
 for(let i=0;i<p.count;i++){
  const c=coords(i),ns=[Math.abs(n.getX(i)),Math.abs(n.getY(i)),Math.abs(n.getZ(i))];
  if(ns[along]>.8){const a=[0,1,2].filter(j=>j!==along);uv[i*2]=c[a[0]]*.65;uv[i*2+1]=c[a[1]]*.65}
  else{const a=[0,1,2].filter(j=>j!==along),across=ns[a[0]]<ns[a[1]]?a[0]:a[1];uv[i*2]=c[across]*(kind==='wood'?1.1:.55);uv[i*2+1]=c[along]*(kind==='wood'?.8:.55)}
 }
 g.setAttribute('uv',new T.BufferAttribute(uv,2));return g;
}

// Subdivide only selected static surfaces. Fine relief uses bump everywhere;
// 6–10 mm total vertex displacement is reserved for the close architecture.
export function reliefGeometry(g,m,name){
 const info=m.userData.generatedVoyage;
 const label=name.replaceAll('_',' ');
 if(!info?.generatedHeight||!(/Individual cedar facade board|Tall ferry superstructure|Bridge central face|VoyageBase Oxide red paint/.test(label)))return {g,m};
 let variant=displaced.get(m);
 if(!variant){variant=m.clone();variant.name=m.name+' • shallow displacement';variant.onBeforeCompile=m.onBeforeCompile;variant.customProgramCacheKey=()=>m.customProgramCacheKey()+'-displaced';variant.displacementMap=m.bumpMap;variant.displacementScale=info.kind==='wood'?.010:.006;variant.displacementBias=-variant.displacementScale*.5;variant.userData.generatedVoyage={...info,vertexDisplacement:true};displaced.set(m,variant)}
 const p=g.attributes.position,n=g.attributes.normal,u=g.attributes.uv,out=[];
 const vertex=i=>[p.getX(i),p.getY(i),p.getZ(i),n.getX(i),n.getY(i),n.getZ(i),u.getX(i),u.getY(i)];
 const distance=(a,b)=>(a[0]-b[0])**2+(a[1]-b[1])**2+(a[2]-b[2])**2;
 function split(a,b,c,depth=0){
  const ab=distance(a,b),bc=distance(b,c),ca=distance(c,a),longest=Math.max(ab,bc,ca);
  const x=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],y=[c[0]-a[0],c[1]-a[1],c[2]-a[2]];
  const area=.5*Math.hypot(x[1]*y[2]-x[2]*y[1],x[2]*y[0]-x[0]*y[2],x[0]*y[1]-x[1]*y[0]);
  // Long, narrow bevel triangles don't need dense displacement sampling.
  if(area<.014||longest<.30**2||depth>=9){out.push(...a,...b,...c);return}
  if(ab<bc||ab<ca){if(bc>=ca)split(b,c,a,depth);else split(c,a,b,depth);return}
  const mid=a.map((v,i)=>(v+b[i])*.5);split(a,mid,c,depth+1);split(mid,b,c,depth+1);
 }
 for(let i=0;i<p.count;i+=3)split(vertex(i),vertex(i+1),vertex(i+2));
 const count=out.length/8,positions=new Float32Array(count*3),normals=new Float32Array(count*3),uvs=new Float32Array(count*2);
 for(let i=0;i<count;i++){positions.set(out.slice(i*8,i*8+3),i*3);normals.set(out.slice(i*8+3,i*8+6),i*3);uvs.set(out.slice(i*8+6,i*8+8),i*2)}
 const result=new T.BufferGeometry();result.setAttribute('position',new T.BufferAttribute(positions,3));result.setAttribute('normal',new T.BufferAttribute(normals,3));result.setAttribute('uv',new T.BufferAttribute(uvs,2));g.dispose();return {g:result,m:variant};
}
