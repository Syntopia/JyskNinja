import {register} from 'node:module';
register('./three-module-loader.mjs',import.meta.url);
import assert from 'node:assert/strict';import fs from 'node:fs';
globalThis.self=globalThis;globalThis.createImageBitmap=async()=>({width:2048,height:2048,close(){}});
const T=await import('three'),{GLTFLoader}=await import('../docs/src/asset-loader.js'),{addWorkerEyes,crowdEyeGeometry}=await import('../docs/src/worker-eyes.js'),{bakeCrowdWalk,createCivilianCrowd}=await import('../docs/src/civilian-crowd.js');
const assets=[];
for(const id of ['craftsman','female-worker']){
 const bytes=fs.readFileSync(new URL('../docs/assets/web/'+id+'/retargeted.glb',import.meta.url));
 const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');addWorkerEyes(gltf,id);addWorkerEyes(gltf,id);
 const head=gltf.scene.getObjectByName('head'),eyes=head.getObjectByName('Worker eyes');assert(eyes);assert.equal(head.children.filter(o=>o.userData.workerEyes).length,1);assert(eyes.material.roughness<.2);assert.equal(eyes.material.clearcoat,1);
 for(const clipName of ['walk','death']){
  const bake=bakeCrowdWalk(gltf,32,clipName),geometry=crowdEyeGeometry(id,bake.source),joint=bake.source.skeleton.bones.indexOf(head),mixer=new T.AnimationMixer(gltf.scene),clip=gltf.animations.find(c=>c.name===clipName),action=mixer.clipAction(clip);if(clipName==='death'){action.setLoop(T.LoopOnce,1);action.clampWhenFinished=true}action.play();
  for(const frame of [0,8,16,31]){
   mixer.setTime(frame/(clipName==='death'?31:32)*clip.duration);gltf.scene.updateMatrixWorld(true);
   const palette=new T.Matrix4().fromArray(bake.data,(frame*bake.bones+joint)*16);
   for(let i=0;i<geometry.attributes.position.count;i+=59){
    const actual=new T.Vector3().fromBufferAttribute(eyes.geometry.attributes.position,i).applyMatrix4(head.matrixWorld),crowd=new T.Vector3().fromBufferAttribute(geometry.attributes.position,i).applyMatrix4(palette);
    assert(actual.distanceTo(crowd)<1e-5,id+' eyes follow '+clipName+' head');
   }
  }
  mixer.stopAllAction();mixer.uncacheRoot(gltf.scene);geometry.dispose();bake.texture.dispose();
 }
 assets.push({id,gltf});
}
const crowd=createCivilianCrowd(assets,{count:96});assert.equal(crowd.stats.drawCalls,4);assert.equal(crowd.stats.carpenters,48);assert.equal(crowd.stats.femaleWorkers,48);
for(const eyes of crowd.mesh.children.filter(m=>m.userData.workerEyes)){
 const body=crowd.mesh.children.find(m=>!m.userData.workerEyes&&m.name.split(' ')[0]===eyes.name.split(' ')[0]);assert.equal(eyes.instanceMatrix,body.instanceMatrix);assert.equal(eyes.count,body.count);assert.equal(eyes.geometry.attributes.crowdFade,body.geometry.attributes.crowdFade);
}
crowd.dispose();console.log('Both worker eyes match head animation in walk/death; crowd remains four instanced draws for 96 workers.');
