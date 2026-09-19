import * as T from 'three';
import {GLTFLoader} from './asset-loader.js';
import {createCivilianFlock} from './civilian-flock.js';

export async function loadCrowdAsset(){
 const loader=new GLTFLoader();
 return Promise.all(['craftsman','female-worker'].map(async id=>{
  const base='./assets/'+id+'/';const [gltf,response]=await Promise.all([loader.loadAsync(base+'retargeted.glb'),fetch(base+'manifest.json')]);
  if(!response.ok)throw new Error('Civilian manifest unavailable: '+id);
  return {id,gltf,metadata:await response.json()};
 }));
}

// Sample only the walk's bone transforms. Original vertices, indices, UVs and
// embedded materials remain untouched, shared by all instances of each worker.
export function bakeCrowdWalk(gltf,frames=32,clipName='walk'){
 const root=gltf.scene,parts=[];root.traverse(o=>{if(o.isSkinnedMesh)parts.push(o)});
 const clip=gltf.animations.find(c=>c.name===clipName);if(!clip||parts.length!==1)throw new Error('Expected one skinned worker mesh and '+clipName+' clip');
 const source=parts[0],mixer=new T.AnimationMixer(root),action=mixer.clipAction(clip);if(clipName==='death'){action.setLoop(T.LoopOnce,1);action.clampWhenFinished=true}action.play();
 const bones=source.skeleton.bones.length,width=bones*4,data=new Float32Array(width*frames*4),matrix=new T.Matrix4(),prefix=new T.Matrix4();
 for(let frame=0;frame<frames;frame++){
  mixer.setTime(frame/(clipName==='death'?frames-1:frames)*clip.duration);root.updateMatrixWorld(true);source.skeleton.update();
  prefix.multiplyMatrices(source.matrixWorld,source.bindMatrixInverse);
  for(let joint=0;joint<bones;joint++){
   matrix.fromArray(source.skeleton.boneMatrices,joint*16).premultiply(prefix).multiply(source.bindMatrix);
   matrix.toArray(data,(frame*bones+joint)*16);
  }
 }
 mixer.stopAllAction();mixer.uncacheRoot(root);
 const texture=new T.DataTexture(data,width,frames,T.RGBAFormat,T.FloatType);texture.needsUpdate=true;
 return {source,texture,data,bones,frames,duration:clip.duration,triangles:source.geometry.index.count/3};
}

export function createCivilianCrowd(assets,options={}){
 const workerType=a=>(a.id^(a.id>>1))&1;
 const flock=createCivilianFlock(options),root=new T.Group();root.name='Full Carpenter and female worker crowd • 50 / 50';root.userData.noReflectionCapture=true;
 const matrix=new T.Matrix4(),rotation=new T.Quaternion(),axis=new T.Vector3(0,1,0),position=new T.Vector3(),scale=new T.Vector3();
 const batches=assets.map((asset,type)=>{
  const walk=bakeCrowdWalk(asset.gltf),death=bakeCrowdWalk(asset.gltf,40,'death'),geometry=walk.source.geometry.clone(),capacity=Math.ceil(flock.agents.length/2);
  const phase=new T.InstancedBufferAttribute(new Float32Array(capacity),1).setUsage(T.DynamicDrawUsage),fade=phase.clone();
  geometry.setAttribute('crowdRow',phase);geometry.setAttribute('crowdFade',fade);
  const paletteData=new Float32Array(capacity*walk.bones*16),palette=new T.DataTexture(paletteData,walk.bones*4,capacity,T.RGBAFormat,T.FloatType);palette.needsUpdate=true;
  const uniforms={crowdBones:{value:palette}};
  const declarations=`uniform sampler2D crowdBones;
 attribute vec4 skinIndex; attribute vec4 skinWeight;
 attribute float crowdRow; attribute float crowdFade; varying float crowdVisibility;
 mat4 crowdBone(float joint){float x=joint*4.;float y=(crowdRow+.5)/${capacity}.0;
  return mat4(texture2D(crowdBones,vec2((x+.5)/${walk.bones*4}.0,y)),texture2D(crowdBones,vec2((x+1.5)/${walk.bones*4}.0,y)),texture2D(crowdBones,vec2((x+2.5)/${walk.bones*4}.0,y)),texture2D(crowdBones,vec2((x+3.5)/${walk.bones*4}.0,y)));}
 `;
  function animate(material){material.onBeforeCompile=shader=>{
   Object.assign(shader.uniforms,uniforms);shader.vertexShader=declarations+shader.vertexShader;
   // MeshDepthMaterial also has skinbase_vertex, so shadows use the same pose.
   shader.vertexShader=shader.vertexShader.replace('#include <skinbase_vertex>',`mat4 crowdSkin=skinWeight.x*crowdBone(skinIndex.x)+skinWeight.y*crowdBone(skinIndex.y)+skinWeight.z*crowdBone(skinIndex.z)+skinWeight.w*crowdBone(skinIndex.w);`);
   shader.vertexShader=shader.vertexShader.replace('#include <skinnormal_vertex>',`objectNormal=mat3(crowdSkin)*objectNormal;
#ifdef USE_TANGENT
objectTangent=mat3(crowdSkin)*objectTangent;
#endif`);
   shader.vertexShader=shader.vertexShader.replace('#include <skinning_vertex>','transformed=(crowdSkin*vec4(transformed,1.)).xyz;crowdVisibility=crowdFade;');
   shader.fragmentShader='varying float crowdVisibility;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
    if(fract(sin(dot(floor(gl_FragCoord.xy),vec2(12.9898,78.233)))*43758.5453)>crowdVisibility)discard;`);
  };material.customProgramCacheKey=()=> 'full-worker-instanced-walk-v3-'+asset.id+'-'+capacity+'-'+walk.bones+'-'+material.type;return material}
  const material=animate(walk.source.material.clone());
  const mesh=new T.InstancedMesh(geometry,material,capacity);mesh.name=asset.id+' • original geometry and textures';mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.frustumCulled=false;mesh.castShadow=true;mesh.receiveShadow=true;
  mesh.customDepthMaterial=animate(new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking}));root.add(mesh);
  const batch={asset,type,walk,death,mesh,phase,fade,palette,paletteData,visible:0,shadowCount:0};
  // Keep full geometry for all visible workers. Limit expensive dynamic shadows
  // to the nearby crowd; instances are sorted by distance before uploading.
  mesh.onBeforeShadow=()=>{mesh.count=batch.shadowCount};mesh.onAfterShadow=()=>{mesh.count=batch.visible};
  return batch;
 });
 let viewer={x:0,z:5};
 function upload(focus=viewer){viewer=focus;
  for(const batch of batches){let count=0,shadowCount=0;
   const agents=flock.agents.filter(a=>workerType(a)===batch.type).map(a=>({a,d:Math.hypot(a.x-focus.x,a.z-focus.z)})).sort((a,b)=>a.d-b.d);
   for(const {a,d}of agents){if(d>48)continue;if(d<16)shadowCount++;
    rotation.setFromAxisAngle(axis,a.yaw);position.set(a.x,.08,a.z);scale.setScalar(a.scale);matrix.compose(position,rotation,scale);batch.mesh.setMatrixAt(count,matrix);
    const f=a.phase*batch.walk.frames,frame=Math.floor(f),blend=f-frame,stride=batch.walk.bones*16,offsetA=frame*stride,offsetB=((frame+1)%batch.walk.frames)*stride;
    const deathFrame=Math.min(a.deathTime/batch.death.duration,1)*(batch.death.frames-1),deathIndex=Math.floor(deathFrame),deathBlend=deathFrame-deathIndex,deathA=deathIndex*stride,deathB=Math.min(deathIndex+1,batch.death.frames-1)*stride,fallBlend=a.alive?0:Math.min(a.deathTime/.16,1);
    for(let j=0;j<stride;j++){const walking=batch.walk.data[offsetA+j]*(1-blend)+batch.walk.data[offsetB+j]*blend,dying=batch.death.data[deathA+j]*(1-deathBlend)+batch.death.data[deathB+j]*deathBlend;batch.paletteData[count*stride+j]=walking*(1-fallBlend)+dying*fallBlend;}
    batch.phase.setX(count,count);batch.fade.setX(count,Math.min(1,a.alive?(a.z-flock.bounds.minZ)/2:1,a.alive?(flock.bounds.maxZ-a.z)/2:1,(48-d)/5));count++;
   }
   batch.visible=count;batch.shadowCount=shadowCount;batch.mesh.count=count;batch.mesh.instanceMatrix.needsUpdate=true;batch.phase.needsUpdate=true;batch.fade.needsUpdate=true;batch.palette.needsUpdate=true;
  }
 }
 upload();
 return {mesh:root,flock,kill:flock.kill,fixed(dt,obstacles){flock.step(dt,obstacles)},update:upload,reset(){flock.reset();upload()},get stats(){return {...flock.stats,drawCalls:batches.length,carpenters:flock.agents.filter(a=>workerType(a)===0).length,femaleWorkers:flock.agents.filter(a=>workerType(a)===1).length,models:batches.map(b=>({id:b.asset.id,triangles:b.walk.triangles,visible:b.visible,shadowCount:b.shadowCount,originalGeometry:true})),renderedTriangles:batches.reduce((n,b)=>n+b.visible*b.walk.triangles,0)}},dispose(){for(const b of batches){b.mesh.geometry.dispose();b.mesh.material.dispose();b.mesh.customDepthMaterial.dispose();b.walk.texture.dispose();b.death.texture.dispose();b.palette.dispose()}root.removeFromParent()}};
}
