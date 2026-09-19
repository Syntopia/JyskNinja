import * as T from 'three';
const loader=new T.TextureLoader(),cache=new Map();
export function texture(name,color=false){
 if(cache.has(name))return cache.get(name);
 const t=loader.load('./assets/textures/'+name);t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=4;if(color)t.colorSpace=T.SRGBColorSpace;cache.set(name,t);return t;
}
export function pbr(material,kind,strength=.4){
 material.map=texture(kind+'-color.jpg',true);material.normalMap=texture(kind+'-normal.png');material.roughnessMap=texture(kind+'-roughness.jpg');material.normalScale.setScalar(strength);material.needsUpdate=true;
}
export function wind(material,clock,strength=.08){
 material.onBeforeCompile=shader=>{shader.uniforms.gardenTime=clock;shader.vertexShader='uniform float gardenTime;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
 float heightWeight=smoothstep(0.2,4.0,position.y);
 transformed.x+=sin(gardenTime*1.3+position.z*.65+position.x*.3)*heightWeight*${strength.toFixed(3)};
 transformed.z+=cos(gardenTime*.85+position.x*.6)*heightWeight*${(strength*.5).toFixed(3)};`)};
 material.customProgramCacheKey=()=>`garden-wind-${strength}`;
}
// World-space projection gives slabs and walls consistent metre-scale texture.
export function planarUV(geometry){
 const p=geometry.attributes.position,n=geometry.attributes.normal,uv=new Float32Array(p.count*2);
 for(let i=0;i<p.count;i++){
  const a=Math.abs(n.getX(i)),b=Math.abs(n.getY(i)),c=Math.abs(n.getZ(i));
  uv[i*2]=(a>b&&a>c?p.getZ(i):p.getX(i))*.7;
  uv[i*2+1]=(b>a&&b>c?p.getZ(i):p.getY(i))*.7;
 }
 geometry.setAttribute('uv',new T.BufferAttribute(uv,2));return geometry;
}
