import {register} from 'node:module';register('./three-module-loader.mjs',import.meta.url);
import assert from 'node:assert/strict';import fs from 'node:fs';
globalThis.self=globalThis;globalThis.createImageBitmap=async()=>({width:2048,height:2048,close(){}});
const T=await import('three'),{GLTFLoader}=await import('../docs/src/asset-loader.js');
const {bakeCrowdWalk,createCivilianCrowd,selectCrowdLOD}=await import('../docs/src/civilian-crowd.js');
const manifest=JSON.parse(fs.readFileSync(new URL('../docs/assets/crowd-lod/manifest.json',import.meta.url))),assets=[],report={passed:false,models:[]};
for(const model of manifest.assets){
 const bytes=fs.readFileSync(new URL('../docs/'+model.file,import.meta.url)),gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const parts=[];gltf.scene.traverse(o=>{if(o.isSkinnedMesh)parts.push(o)});parts.sort((a,b)=>a.userData.crowdLOD-b.userData.crowdLOD);
 assert.equal(parts.length,3);assert.deepEqual(parts.map(o=>o.geometry.index.count/3),model.levels.map(l=>l.triangles));
 assert.deepEqual(gltf.animations.map(c=>c.name),model.clips);assert.equal(gltf.animations.length,18);
 for(const mesh of parts){
  assert.equal(mesh.skeleton.bones.length,model.joints);assert.equal(mesh.material.map,parts[0].material.map);
  for(const key of ['position','normal','uv','skinIndex','skinWeight'])assert.deepEqual(mesh.geometry.attributes[key].array,parts[0].geometry.attributes[key].array,'Shared vertex pool must match');
  for(const index of mesh.geometry.index.array)assert(index<mesh.geometry.attributes.position.count);
 }
 let maxError=0,samples=0;
 for(const clip of gltf.animations){
  const baked=bakeCrowdWalk(gltf,32,clip.name),mixer=new T.AnimationMixer(gltf.scene),action=mixer.clipAction(clip);
  if(clip.name==='death'){action.setLoop(T.LoopOnce,1);action.clampWhenFinished=true}action.play();
  for(const frame of [0,4,8,12,16,20,24,31]){
   mixer.setTime(frame/(clip.name==='death'?31:32)*clip.duration);gltf.scene.updateMatrixWorld(true);parts.forEach(o=>o.skeleton.update());
   for(const mesh of parts){const pos=mesh.geometry.attributes.position,indices=mesh.geometry.index;
    for(let j=0;j<indices.count;j+=Math.max(1,Math.floor(indices.count/180))){
     const i=indices.getX(j),base=new T.Vector3().fromBufferAttribute(pos,i),actual=mesh.applyBoneTransform(i,base.clone()).applyMatrix4(mesh.matrixWorld),gpu=new T.Vector3();
     for(let k=0;k<4;k++){const joint=mesh.geometry.attributes.skinIndex.getComponent(i,k),weight=mesh.geometry.attributes.skinWeight.getComponent(i,k);gpu.addScaledVector(base.clone().applyMatrix4(new T.Matrix4().fromArray(baked.data,(frame*baked.bones+joint)*16)),weight)}
     assert(actual.toArray().every(Number.isFinite));maxError=Math.max(maxError,gpu.distanceTo(actual));samples++;
    }
   }
  }
  assert(maxError<.00001);mixer.stopAllAction();mixer.uncacheRoot(gltf.scene);baked.texture.dispose();
 }
 assets.push({id:model.id,gltf,metadata:JSON.parse(fs.readFileSync(new URL('../docs/assets/'+model.id+'/manifest.json',import.meta.url)))});
 report.models.push({id:model.id,triangles:model.levels.map(l=>l.triangles),clipsChecked:18,posesPerLevel:144,posedVerticesCompared:samples,maxPaletteErrorMetres:maxError});
}
// Stable boundaries and direct jumps in both directions.
assert.equal(selectCrowdLOD(270,0),0);assert.equal(selectCrowdLOD(270,1),1);assert.equal(selectCrowdLOD(240,0),1);
assert.equal(selectCrowdLOD(118,1),1);assert.equal(selectCrowdLOD(118,2),2);assert.equal(selectCrowdLOD(90,0),2);assert.equal(selectCrowdLOD(400,2),0);
const crowd=createCivilianCrowd(assets,{count:96}),camera=new T.PerspectiveCamera(50,1,.05,150);camera.position.set(0,2,5);crowd.update({x:0,z:5},camera,720);
assert.equal(crowd.stats.carpenters,48);assert.equal(crowd.stats.femaleWorkers,48);assert(crowd.stats.renderedTriangles<crowd.stats.originalRenderedTriangles*.6);
report.entrance=crowd.stats;
function checkUploads(){for(const model of crowd.stats.models){assert.equal(model.visible,model.lods.reduce((n,l)=>n+l.visible,0));const body=crowd.mesh.children.filter(m=>m.name.startsWith(model.id)&&!m.userData.workerEyes),eyes=crowd.mesh.children.find(m=>m.name===model.id+' • eyes');
 for(const mesh of body){assert.equal(mesh.geometry.attributes.position,body[0].geometry.attributes.position);assert.equal(mesh.material.map,body[0].material.map);
  for(let i=0;i<mesh.count;i++){const row=mesh.geometry.attributes.crowdRow.getX(i);assert(row>=0&&row<eyes.count);const a=new T.Matrix4(),b=new T.Matrix4();mesh.getMatrixAt(i,a);eyes.getMatrixAt(row,b);assert.deepEqual(a.elements,b.elements,'Body/eye transforms must stay paired across LOD batches')}
  const count=mesh.count;mesh.onBeforeShadow();assert(mesh.count<=count);mesh.onAfterShadow();assert.equal(mesh.count,count);
 }
}}
checkUploads();
const agent=crowd.flock.agents[0];assert(crowd.kill(agent));for(let i=0;i<60;i++)crowd.fixed(1/60,[]);camera.position.set(0,2,-20);crowd.update({x:0,z:-20},camera,720);checkUploads();assert(crowd.stats.dead>0);assert(crowd.stats.finite);
crowd.setLODEnabled(false);assert.equal(crowd.stats.renderedTriangles,crowd.stats.originalRenderedTriangles);assert(crowd.stats.models.every(m=>m.lods.slice(1).every(l=>l.visible===0)));checkUploads();
crowd.setLODEnabled(true);crowd.reset();assert.equal(crowd.stats.dead,0);assert.equal(crowd.stats.count,96);checkUploads();crowd.dispose();assert.equal(crowd.mesh.parent,null);
report.passed=true;console.log(JSON.stringify(report));
