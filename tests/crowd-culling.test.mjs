import {register} from 'node:module';register('./three-module-loader.mjs',import.meta.url);
import assert from 'node:assert/strict';import fs from 'node:fs';
globalThis.self=globalThis;globalThis.createImageBitmap=async()=>({width:2048,height:2048,close(){}});
const T=await import('three'),{GLTFLoader}=await import('../docs/src/asset-loader.js'),{bakeCrowdWalk,createCivilianCrowd}=await import('../docs/src/civilian-crowd.js'),{bakeCrowdBounds,createCrowdPassList}=await import('../docs/src/crowd-culling.js'),{crowdEyeGeometry}=await import('../docs/src/worker-eyes.js?v=3');
const assets=[];let samples=0;
for(const id of ['craftsman','female-worker']){
 const bytes=fs.readFileSync(new URL('../docs/assets/crowd-lod/'+id+'.glb',import.meta.url)),gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const walk=bakeCrowdWalk(gltf),death=bakeCrowdWalk(gltf,40,'death'),eyes=crowdEyeGeometry(id,walk.source),geometries=[walk.source.geometry,eyes];bakeCrowdBounds(geometries,[walk,death]);
 const base=new T.Vector3(),vertex=new T.Vector3(),part=new T.Vector3(),matrix=new T.Matrix4();
 for(const palette of [walk,death])for(let frame=0;frame<palette.frames;frame++)for(const geometry of geometries){const {position,skinIndex,skinWeight}=geometry.attributes;
  for(let i=0;i<position.count;i+=Math.max(1,Math.floor(position.count/400))){base.fromBufferAttribute(position,i);vertex.set(0,0,0);for(let k=0;k<4;k++){matrix.fromArray(palette.data,(frame*palette.bones+skinIndex.getComponent(i,k))*16);vertex.addScaledVector(part.copy(base).applyMatrix4(matrix),skinWeight.getComponent(i,k))}assert(palette.bounds[frame].containsPoint(vertex),'Animated body/eye vertex inside conservative bounds');samples++}
 }
 walk.texture.dispose();death.texture.dispose();eyes.dispose();assets.push({id,gltf});
}
// Each pass selects independently; an offscreen main-view agent can still be
// inside the reflection or shadow camera. Parent transforms are respected.
const front=new T.PerspectiveCamera(60,1,.1,30),back=new T.PerspectiveCamera(60,1,.1,30);front.updateMatrixWorld(true);back.rotation.y=Math.PI;back.updateMatrixWorld(true);
const spheres=[new T.Sphere(new T.Vector3(0,0,-5),1),new T.Sphere(new T.Vector3(0,0,5),1)],fades=[.4,.9],list=createCrowdPassList(2),identity=new T.Matrix4();
assert.equal(list.update([0,1],spheres,fades,front,identity),1);assert.equal(list.data[0],0);
assert.equal(list.update([0,1],spheres,fades,back,identity),1);assert.equal(list.data[0],1);assert(Math.abs(list.data[1]-.9)<1e-6);
assert.equal(list.update([0,1],spheres,fades,front,new T.Matrix4().makeTranslation(0,0,-12)),2);
assert.equal(list.update([0,1],spheres,fades,front,identity,false),2);list.dispose();
const crowd=createCivilianCrowd(assets,{count:96});front.position.set(0,2,5);front.updateMatrixWorld(true);crowd.update({x:0,z:5},front,720);crowd.mesh.updateMatrixWorld(true);
function checkPasses(){for(const mesh of crowd.mesh.children){const visible=mesh.count,shader={uniforms:{},vertexShader:'#include <skinbase_vertex>\n#include <skinnormal_vertex>\n#include <skinning_vertex>',fragmentShader:'#include <clipping_planes_fragment>'};mesh.material.onBeforeCompile(shader);assert(shader.vertexShader.includes('#undef USE_INSTANCING'));assert(shader.vertexShader.includes('gl_InstanceID'));const rows=shader.uniforms.crowdRows.value.image.data;
 const eligible=Array.from({length:visible},(_,i)=>mesh.geometry.attributes.crowdRow.getX(i));
 for(const camera of [front,back]){mesh.onBeforeRender(null,null,camera);assert(mesh.count<=visible);for(let i=0;i<mesh.count;i++)assert(eligible.includes(rows[i*4]));mesh.onAfterRender();assert.equal(mesh.count,visible)}
 if(mesh.castShadow){mesh.onBeforeShadow(null,null,front,back);assert(mesh.count<=visible);mesh.onAfterShadow();assert.equal(mesh.count,visible)}
 crowd.setCullingEnabled(false);mesh.onBeforeRender(null,null,front);assert.equal(mesh.count,visible);mesh.onAfterRender();crowd.setCullingEnabled(true);
}}
checkPasses();const agent=crowd.flock.agents[0];crowd.kill(agent);for(let f=0;f<65;f++){crowd.fixed(1/60,[]);crowd.update({x:0,z:5},front,720);if(f%10===0)checkPasses()}assert.equal(crowd.stats.count,96);assert(crowd.stats.finite);crowd.dispose();
console.log('Crowd culling: '+samples+' posed body/eye samples bounded; independent main/reflection/shadow lists, parent transforms, pass restoration and falling poses passed.');
