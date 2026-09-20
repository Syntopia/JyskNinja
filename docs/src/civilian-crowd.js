import * as T from 'three';
import {crowdEyeGeometry,workerEyeMaterial} from './worker-eyes.js?v=3';
import {GLTFLoader} from './asset-loader.js';
import {createCivilianFlock} from './civilian-flock.js';
import {bakeCrowdBounds,createCrowdPassList} from './crowd-culling.js';

export async function loadCrowdAsset(){
 const loader=new GLTFLoader();
 return Promise.all(['craftsman','female-worker'].map(async id=>{
  const base='./assets/'+id+'/';const [gltf,response]=await Promise.all([loader.loadAsync('./assets/crowd-lod/'+id+'.glb'),fetch(base+'manifest.json')]);
  if(!response.ok)throw new Error('Civilian manifest unavailable: '+id);
  return {id,gltf,metadata:await response.json()};
 }));
}

// Bake the shared rig once per motion; every LOD uses the same bind-space palette.
export function bakeCrowdWalk(gltf,frames=32,clipName='walk'){
 const root=gltf.scene,parts=[];root.traverse(o=>{if(o.isSkinnedMesh)parts.push(o)});
 if(parts.length>1){const base=parts.find(o=>o.userData.crowdLOD===0);parts.length=0;if(base)parts.push(base)}
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


// Pixel thresholds match the approved standalone prototype. Keep the previous
// level inside the hysteresis band, including when a worker crosses a boundary.
export function selectCrowdLOD(pixels,current=0){
 if(current===0&&pixels<280*.88)current=1;
 if(current===1&&pixels>280*1.12)current=0;
 if(current===1&&pixels<120*.88)current=2;
 if(current===2&&pixels>120*1.12)current=1;
 if(current===1&&pixels>280*1.12)current=0;
 return current;
}
export function createCivilianCrowd(assets,options={}){
 const workerType=a=>(a.id^(a.id>>1))&1;
 const flock=createCivilianFlock(options),root=new T.Group();root.name='LOD Carpenter and female worker crowd • 50 / 50';root.userData.noReflectionCapture=true;
 const matrix=new T.Matrix4(),rotation=new T.Quaternion(),axis=new T.Vector3(0,1,0),position=new T.Vector3(),scale=new T.Vector3();
 const poseMatrix=new T.Matrix4(),poseBounds=new T.Box3();
 const selected=new Uint8Array(flock.agents.length);let lodEnabled=options.lod!==false,cullingEnabled=options.culling!==false;
 const batches=assets.map((asset,type)=>{
  const walk=bakeCrowdWalk(asset.gltf),death=bakeCrowdWalk(asset.gltf,40,'death');
  const sources=[];asset.gltf.scene.traverse(o=>{if(o.isSkinnedMesh)sources.push(o)});sources.sort((a,b)=>(a.userData.crowdLOD||0)-(b.userData.crowdLOD||0));
  asset.gltf.scene.updateMatrixWorld(true);
  const bounds=new T.Box3().setFromBufferAttribute(walk.source.geometry.attributes.position).applyMatrix4(walk.source.matrixWorld),height=bounds.max.y-bounds.min.y;
  const capacity=Math.max(1,flock.agents.filter(a=>workerType(a)===type).length);
  const paletteData=new Float32Array(capacity*walk.bones*16),palette=new T.DataTexture(paletteData,walk.bones*4,capacity,T.RGBAFormat,T.FloatType);palette.needsUpdate=true;
  const uniforms={crowdBones:{value:palette}},spheres=Array.from({length:capacity},()=>new T.Sphere()),fades=new Float32Array(capacity),rows=[];
  function connectPasses(mesh,list,eligible,shadowRows=null){
   const counts={main:0,reflection:0,shadow:0};
   function select(camera,pass,selectedRows){
    mesh.count=list.update(selectedRows,spheres,fades,camera,root.matrixWorld,cullingEnabled);
    counts[pass]=mesh.count;
   }
   mesh.onBeforeRender=(renderer,scene,camera)=>select(camera,camera===viewCamera?'main':'reflection',eligible);
   mesh.onAfterRender=()=>{mesh.count=eligible.length};
   if(shadowRows){mesh.onBeforeShadow=(renderer,object,camera,shadowCamera)=>select(shadowCamera,'shadow',shadowRows);mesh.onAfterShadow=()=>{mesh.count=eligible.length}}
   return counts;
  }
  const declarations=`#undef USE_INSTANCING
 uniform sampler2D crowdBones; uniform sampler2D crowdRows;
 attribute vec4 skinIndex; attribute vec4 skinWeight;
 float crowdPaletteRow; varying float crowdVisibility;
 mat4 crowdBone(float joint){float x=joint*4.;float y=(crowdPaletteRow+.5)/${capacity}.0;
  return mat4(texture2D(crowdBones,vec2((x+.5)/${walk.bones*4}.0,y)),texture2D(crowdBones,vec2((x+1.5)/${walk.bones*4}.0,y)),texture2D(crowdBones,vec2((x+2.5)/${walk.bones*4}.0,y)),texture2D(crowdBones,vec2((x+3.5)/${walk.bones*4}.0,y)));}
 `;
  function animate(material,list){material.onBeforeCompile=shader=>{
   Object.assign(shader.uniforms,uniforms,{crowdRows:{value:list.texture}});shader.vertexShader=declarations+shader.vertexShader;
   // MeshDepthMaterial also has skinbase_vertex, so shadows use the same pose.
   shader.vertexShader=shader.vertexShader.replace('#include <skinbase_vertex>',`vec2 crowdEntry=texture2D(crowdRows,vec2((float(gl_InstanceID)+.5)/${capacity}.0,.5)).rg; crowdPaletteRow=crowdEntry.x;crowdVisibility=crowdEntry.y;
    mat4 crowdSkin=skinWeight.x*crowdBone(skinIndex.x)+skinWeight.y*crowdBone(skinIndex.y)+skinWeight.z*crowdBone(skinIndex.z)+skinWeight.w*crowdBone(skinIndex.w);`);
   shader.vertexShader=shader.vertexShader.replace('#include <skinnormal_vertex>',`objectNormal=mat3(crowdSkin)*objectNormal;
#ifdef USE_TANGENT
objectTangent=mat3(crowdSkin)*objectTangent;
#endif`);
   shader.vertexShader=shader.vertexShader.replace('#include <skinning_vertex>','transformed=(crowdSkin*vec4(transformed,1.)).xyz;');
   shader.fragmentShader='varying float crowdVisibility;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
    if(fract(sin(dot(floor(gl_FragCoord.xy),vec2(12.9898,78.233)))*43758.5453)>crowdVisibility)discard;`);
  };material.customProgramCacheKey=()=> 'full-worker-pass-culling-v4-'+asset.id+'-'+capacity+'-'+walk.bones+'-'+material.type;return material}

  const levels=sources.map((source,index)=>{
   // Share the base vertex buffers; only the index stream and instance attributes
   // vary by LOD. No duplicate rigs, textures, or per-frame bone calculations.
   const geometry=new T.BufferGeometry();geometry.setIndex(source.geometry.index);
   for(const [name,attribute] of Object.entries(walk.source.geometry.attributes))geometry.setAttribute(name,attribute);
   const phase=new T.InstancedBufferAttribute(new Float32Array(capacity),1).setUsage(T.DynamicDrawUsage),fade=phase.clone();
   geometry.setAttribute('crowdRow',phase);geometry.setAttribute('crowdFade',fade);
   // Each material binds its own compact row list. Updating a texture in the
   // render hook also works for reflection/shadow passes within the same frame.
   const list=createCrowdPassList(capacity),material=animate(walk.source.material.clone(),list),depthMaterial=animate(new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking}),list);
   const mesh=new T.InstancedMesh(geometry,material,capacity);mesh.name=asset.id+' • LOD '+index;mesh.userData.crowdLOD=index;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.frustumCulled=false;mesh.castShadow=true;mesh.receiveShadow=true;mesh.customDepthMaterial=depthMaterial;root.add(mesh);
   const level={index,mesh,phase,fade,list,rows:[],shadowRows:[],triangles:geometry.index.count/3,visible:0,shadowCount:0};
   level.passes=connectPasses(mesh,list,level.rows,level.shadowRows);
   return level;
  });
  const eyePhase=new T.InstancedBufferAttribute(new Float32Array(capacity),1).setUsage(T.DynamicDrawUsage),eyeFade=eyePhase.clone();
  const eyeGeometry=crowdEyeGeometry(asset.id,walk.source);eyeGeometry.setAttribute('crowdRow',eyePhase);eyeGeometry.setAttribute('crowdFade',eyeFade);
  const eyeList=createCrowdPassList(capacity);
  const eyes=new T.InstancedMesh(eyeGeometry,animate(workerEyeMaterial(asset.id),eyeList),capacity);eyes.name=asset.id+' • eyes';eyes.userData.workerEyes=true;eyes.instanceMatrix.setUsage(T.DynamicDrawUsage);eyes.frustumCulled=false;root.add(eyes);
  const eyePasses=connectPasses(eyes,eyeList,rows);
  bakeCrowdBounds([walk.source.geometry,eyeGeometry],[walk,death]);
  return {asset,type,walk,death,levels,height,eyes,eyePhase,eyeFade,eyeList,eyePasses,palette,paletteData,spheres,fades,rows,visible:0,shadowCount:0};
 });
 let viewer={x:0,z:5},viewCamera=null,viewHeight=720;
 function upload(focus=viewer,camera=viewCamera,viewportHeight=viewHeight){
  viewer=focus;viewCamera=camera;viewHeight=viewportHeight;
  for(const batch of batches){let count=0,shadowCount=0;for(const level of batch.levels){level.visible=0;level.shadowCount=0;level.rows.length=0;level.shadowRows.length=0}batch.rows.length=0;
   const agents=flock.agents.filter(a=>workerType(a)===batch.type).map(a=>({a,d:Math.hypot(a.x-focus.x,a.z-focus.z)})).sort((a,b)=>a.d-b.d);
   for(const {a,d}of agents){if(d>48)continue;if(d<16)shadowCount++;
    const distance=camera?Math.hypot(a.x-camera.position.x,.08+batch.height*a.scale*.5-camera.position.y,a.z-camera.position.z):Math.max(d,1);
    const fov=camera?.getEffectiveFOV?.()??50;
    const pixels=batch.height*a.scale*viewportHeight/(2*Math.max(distance,.1)*Math.tan(T.MathUtils.degToRad(fov/2)));
    const index=lodEnabled?Math.min(batch.levels.length-1,selectCrowdLOD(pixels,selected[a.id])):0;selected[a.id]=index;
    const level=batch.levels[index],slot=level.visible++;if(d<16)level.shadowCount++;
    rotation.setFromAxisAngle(axis,a.yaw);position.set(a.x,.08,a.z);scale.setScalar(a.scale);matrix.compose(position,rotation,scale);level.mesh.setMatrixAt(slot,matrix);batch.eyes.setMatrixAt(count,matrix);
    const f=a.phase*batch.walk.frames,frame=Math.floor(f),blend=f-frame,stride=batch.walk.bones*16,offsetA=frame*stride,offsetB=((frame+1)%batch.walk.frames)*stride;
    const deathFrame=Math.min(a.deathTime/batch.death.duration,1)*(batch.death.frames-1),deathIndex=Math.floor(deathFrame),deathBlend=deathFrame-deathIndex,deathA=deathIndex*stride,deathB=Math.min(deathIndex+1,batch.death.frames-1)*stride,fallBlend=a.alive?0:Math.min(a.deathTime/.16,1);
    for(let j=0;j<stride;j++){const walking=batch.walk.data[offsetA+j]*(1-blend)+batch.walk.data[offsetB+j]*blend,dying=batch.death.data[deathA+j]*(1-deathBlend)+batch.death.data[deathB+j]*deathBlend;batch.paletteData[count*stride+j]=walking*(1-fallBlend)+dying*fallBlend;}
    // Store the instance transform in the palette, so all passes can compact
    // their row lists without re-uploading instance vertex attributes mid-frame.
    for(let joint=0;joint<batch.walk.bones;joint++){const offset=count*stride+joint*16;poseMatrix.fromArray(batch.paletteData,offset).premultiply(matrix).toArray(batch.paletteData,offset)}
    poseBounds.makeEmpty();
    if(fallBlend<1)poseBounds.copy(batch.walk.bounds[frame]).union(batch.walk.bounds[(frame+1)%batch.walk.frames]);
    if(fallBlend>0)poseBounds.union(batch.death.bounds[deathIndex]).union(batch.death.bounds[Math.min(deathIndex+1,batch.death.frames-1)]);
    poseBounds.getBoundingSphere(batch.spheres[count]).applyMatrix4(matrix);
    level.rows.push(count);if(d<16)level.shadowRows.push(count);batch.rows.push(count);
    const fade=Math.min(1,a.alive?(a.z-flock.bounds.minZ)/2:1,a.alive?(flock.bounds.maxZ-a.z)/2:1,(48-d)/5);
    batch.fades[count]=fade;level.phase.setX(slot,count);level.fade.setX(slot,fade);batch.eyePhase.setX(count,count);batch.eyeFade.setX(count,fade);count++;
   }
   for(const level of batch.levels){level.mesh.count=level.visible;level.mesh.instanceMatrix.needsUpdate=true;level.phase.needsUpdate=true;level.fade.needsUpdate=true}
   batch.visible=count;batch.shadowCount=shadowCount;batch.eyes.count=count;batch.eyes.instanceMatrix.needsUpdate=true;batch.eyePhase.needsUpdate=true;batch.eyeFade.needsUpdate=true;batch.palette.needsUpdate=true;
  }
 }
 upload();
 return {mesh:root,flock,kill:flock.kill,fixed(dt,obstacles){flock.step(dt,obstacles)},update:upload,
  setCullingEnabled(value){cullingEnabled=!!value},
  setLODEnabled(value){lodEnabled=!!value;selected.fill(0);upload()},
  reset(){flock.reset();selected.fill(0);upload()},
  get stats(){return {...flock.stats,lodEnabled,cullingEnabled,
   passes:Object.fromEntries(['main','reflection','shadow'].map(pass=>[pass,{
    bodies:batches.reduce((n,b)=>n+b.levels.reduce((sum,l)=>sum+l.passes[pass],0),0),
    triangles:batches.reduce((n,b)=>n+b.levels.reduce((sum,l)=>sum+l.passes[pass]*l.triangles,0)+b.eyePasses[pass]*b.eyes.geometry.index.count/3,0)
   }])),drawCalls:batches.reduce((n,b)=>n+b.levels.filter(l=>l.visible>0).length+(b.visible>0?1:0),0),carpenters:flock.agents.filter(a=>workerType(a)===0).length,femaleWorkers:flock.agents.filter(a=>workerType(a)===1).length,
   models:batches.map(b=>({id:b.asset.id,triangles:b.walk.triangles,visible:b.visible,shadowCount:b.shadowCount,originalGeometry:b.levels.slice(1).every(l=>l.visible===0),lods:b.levels.map(l=>({level:l.index,triangles:l.triangles,visible:l.visible,shadowCount:l.shadowCount}))})),
   originalRenderedTriangles:batches.reduce((n,b)=>n+b.visible*(b.walk.triangles+b.eyes.geometry.index.count/3),0),
   renderedTriangles:batches.reduce((n,b)=>n+b.levels.reduce((sum,l)=>sum+l.visible*l.triangles,0)+b.visible*b.eyes.geometry.index.count/3,0)}},
  dispose(){for(const b of batches){for(const l of b.levels){l.mesh.dispose();l.mesh.geometry.dispose();l.mesh.material.dispose();l.mesh.customDepthMaterial.dispose();l.list.dispose()}b.eyes.dispose();b.eyes.geometry.dispose();b.eyes.material.map.dispose();b.eyes.material.dispose();b.eyeList.dispose();b.walk.texture.dispose();b.death.texture.dispose();b.palette.dispose()}root.removeFromParent()}
 };
}
