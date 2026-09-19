import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Socket centres measured on the original faces, in each head bone's rest space.
const sockets={
 craftsman:{points:[[-.00210,.06705,.06839],[-.03617,.06297,.05895]],forward:[-.25,0,1]},
 'female-worker':{points:[[-.00767,.05383,.05865],[.02923,.05351,.04392]],forward:[.3,0,1]}
};
export function workerEyeMaterial(id){
 const forward=new T.Vector3(...sockets[id].forward).normalize(),width=256,height=128,data=new Uint8Array(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const phi=(x+.5)/width*Math.PI*2,theta=(1-(y+.5)/height)*Math.PI;
  const nx=-Math.cos(phi)*Math.sin(theta),ny=Math.cos(theta),nz=Math.sin(phi)*Math.sin(theta),front=nx*forward.x+nz*forward.z;
  const radial=Math.hypot(nx*forward.z-nz*forward.x,ny*.5),iris=front>0?1-T.MathUtils.smoothstep(radial,.31,.35):0,pupil=front>0?1-T.MathUtils.smoothstep(radial,.14,.18):0;
  for(let c=0;c<3;c++)data[(y*width+x)*4+c]=T.MathUtils.lerp(T.MathUtils.lerp([238,232,220][c],[73,48,36][c],iris),[8,6,4][c],pupil);
  data[(y*width+x)*4+3]=255;
 }
 const map=new T.DataTexture(data,width,height);map.colorSpace=T.SRGBColorSpace;map.magFilter=T.LinearFilter;map.minFilter=T.LinearMipmapLinearFilter;map.generateMipmaps=true;map.needsUpdate=true;
 return new T.MeshPhysicalMaterial({map,roughness:.13,metalness:0,clearcoat:1,clearcoatRoughness:.06,ior:1.38,envMapIntensity:1.2});
}
export function workerEyeGeometry(id){
 const config=sockets[id];if(!config)return null;
 const parts=config.points.map(point=>{
  const g=new T.SphereGeometry(.0085,32,20);g.scale(1,.5,1);g.translate(...point);return g;
 });
 const result=mergeGeometries(parts);for(const p of parts)p.dispose();return result;
}
export function addWorkerEyes(gltf,id){
 if(!sockets[id])return gltf;
 const head=gltf.scene.getObjectByName('head');if(!head||head.getObjectByName('Worker eyes'))return gltf;
 const eyes=new T.Mesh(workerEyeGeometry(id),workerEyeMaterial(id));eyes.name='Worker eyes';eyes.userData.workerEyes=true;head.add(eyes);return gltf;
}
// The instanced crowd uses the body's bind-space palette; give each eye vertex
// full head weight so it follows both walking and death poses without extra rigs.
export function crowdEyeGeometry(id,source){
 const geometry=workerEyeGeometry(id);if(!geometry)return null;
 const joint=source.skeleton.bones.findIndex(b=>b.name==='head');if(joint<0)throw new Error('Worker head bone missing: '+id);
 const toBind=source.bindMatrix.clone().invert().multiply(source.skeleton.boneInverses[joint].clone().invert());geometry.applyMatrix4(toBind);
 const count=geometry.attributes.position.count,indices=new Uint16Array(count*4),weights=new Float32Array(count*4);
 for(let i=0;i<count;i++){indices[i*4]=joint;weights[i*4]=1}
 geometry.setAttribute('skinIndex',new T.BufferAttribute(indices,4));geometry.setAttribute('skinWeight',new T.BufferAttribute(weights,4));return geometry;
}
