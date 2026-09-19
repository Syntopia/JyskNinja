import * as T from 'three';
import {texture,planarUV} from './surface.js';

// Image-generated albedo; the colour-derived relief is deliberately shallow.
// It approximates grain and pores, rather than pretending to be measured height.
const sets=new Map();
function maps(kind){
 if(sets.has(kind))return sets.get(kind);
 const stem=kind==='wood'?'aged-cedar':'worn-basalt';
 const color=texture('garden/'+stem+'-color.png',true);color.anisotropy=8;
 const relief=new T.TextureLoader().load('./assets/textures/garden/'+stem+'-color.png');
 relief.wrapS=relief.wrapT=T.RepeatWrapping;relief.anisotropy=8;
 const result={color,relief};sets.set(kind,result);return result;
}
export function gardenSurface(m,kind,{paving=false,paint=false,light=false}={}){
 if(m.userData.gardenSurface)return;
 const s=maps(kind);m.map=s.color;m.normalMap=null;m.roughnessMap=s.relief;m.bumpMap=s.relief;
 m.bumpScale=kind==='wood'?.018:.014;m.metalness=0;
 m.roughness=kind==='wood'?.95:1;m.envMapIntensity=.65;
 m.color.setHex(paint?0xc5593f:kind==='wood'?0xd6bca1:light?0xb1bdc0:0x899caa);
 m.userData.gardenSurface={kind,paving,paint};
 const oldCompile=m.onBeforeCompile;
 m.onBeforeCompile=shader=>{
  oldCompile.call(m,shader);
  // Preserve dry pores between wet high spots; map luminance is only a mask.
  shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
   roughnessFactor=clamp(.28+roughnessFactor*.85,.3,.93);`);
  if(paving){
   shader.vertexShader='varying vec3 vGardenWorld;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
    vGardenWorld=(modelMatrix*vec4(position,1.)).xyz;`);
   shader.fragmentShader='varying vec3 vGardenWorld;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    vec2 cell=fract((vGardenWorld.xz+vec2(.54,.52))/vec2(1.08,1.04));
    float rim=1.-smoothstep(.025,.12,min(min(cell.x,1.-cell.x),min(cell.y,1.-cell.y)));
    vec2 tileID=floor((vGardenWorld.xz+vec2(.54,.52))/vec2(1.08,1.04));
    float variation=fract(sin(dot(tileID,vec2(12.9898,78.233)))*43758.5453);
    float dirt=.62+.38*sin(vGardenWorld.x*13.+sin(vGardenWorld.z*19.));
    diffuseColor.rgb*=mix(vec3(.88+variation*.24),vec3(.39,.43,.28),rim*dirt*.55);`);
  }
 };
 m.customProgramCacheKey=()=>`garden-generated-v1-${kind}-${paving}-${paint}`;m.needsUpdate=true;
}

// Assign physical-scale grain along each authored timber's long axis before
// batching. Cube unwraps otherwise stretch or turn the grain across the beam.
export function gardenUV(g,m){
 if(m.userData.gardenSurface?.kind!=='wood')return planarUV(g);
 g.computeBoundingBox();const size=g.boundingBox.getSize(new T.Vector3());
 const along=size.x>size.y&&size.x>size.z?0:size.z>size.y?2:1;
 const p=g.attributes.position,n=g.attributes.normal,uv=new Float32Array(p.count*2);
 const get=(a,i)=>a===0?p.getX(i):a===1?p.getY(i):p.getZ(i);
 for(let i=0;i<p.count;i++){
  const normals=[Math.abs(n.getX(i)),Math.abs(n.getY(i)),Math.abs(n.getZ(i))];
  const candidates=[0,1,2].filter(a=>a!==along),across=normals[candidates[0]]<normals[candidates[1]]?candidates[0]:candidates[1];
  uv[i*2]=get(across,i)*1.6;uv[i*2+1]=get(along,i)*.85;
 }
 g.setAttribute('uv',new T.BufferAttribute(uv,2));return g;
}
