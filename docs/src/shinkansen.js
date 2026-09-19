import {createTrainFall} from './train-fall.js';
import {voyageSurface,voyageUV} from './voyage-surfaces.js';
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {V,boxAt} from './physics.js';
import {trainSurface} from './train-surface.js';
import {trainAtmosphere} from './train-atmosphere.js';
export function buildShinkansen(cameraFade,asset){
 const root=new T.Group();root.name='The Last Express';const solids=[],breakables=[];let layout;
 asset.traverse(o=>{if(o.userData.trainLayout)layout=o.userData.trainLayout});if(!layout)throw Error('Shinkansen layout metadata missing');
 const atmosphere=trainAtmosphere(root,layout);
 const surface=trainSurface(layout),fallPhysics=createTrainFall(layout,surface),trainRoot=new T.Group();trainRoot.name='Stationary Shinkansen trains';root.add(trainRoot);const mats=new Set(),proto={},tmp=new T.Object3D();asset.updateMatrixWorld(true);
 function batches(source,relative){const out=new Map();source.traverse(o=>{if(!o.isMesh)return;const m=o.material;voyageSurface(m,'shinkansen');mats.add(m);m.envMapIntensity=.8;if(m.name==='Fine cedar needle sprays'){m.alphaTest=.42;m.transparent=false;m.depthWrite=true;m.side=T.DoubleSide;}for(const key of ['map','normalMap','roughnessMap'])if(m[key])m[key].anisotropy=4;let g=o.geometry.clone().applyMatrix4(relative.clone().multiply(o.matrixWorld));if(g.index)g=g.toNonIndexed();for(const key of Object.keys(g.attributes))if(!['position','normal','uv'].includes(key))g.deleteAttribute(key);voyageUV(g,m);if(!out.has(m))out.set(m,[]);out.get(m).push(g)});return [...out].map(([material,parts])=>{const geometry=mergeGeometries(parts);for(const p of parts)p.dispose();return {material,geometry}})}
 asset.traverse(o=>{if(o.name==='Shinkansen_Set'){for(const b of batches(o,new T.Matrix4())){const m=new T.Mesh(b.geometry,b.material);m.castShadow=m.receiveShadow=true;trainRoot.add(m)}}if(o.name.startsWith('Prototype_'))proto[o.name.slice(10)]=batches(o,o.matrixWorld.clone().invert());if(o.userData.collisionSize){const p=o.getWorldPosition(V());solids.push({box:boxAt(...p.toArray(),...o.userData.collisionSize),material:'metal'})}});
 cameraFade.add([...mats]);
 // The train never translates. Recycled scenery and sleepers stream toward the rear.
 const scenery=new T.Group();scenery.name='Recycled high-speed scenery';root.add(scenery);const movers=[];let distance=0,time=0;
 function instances(name,parts,placements,speed=1){const meshes=parts.map(b=>{const m=new T.InstancedMesh(b.geometry,b.material,placements.length);m.name=name;m.castShadow=name==='Village';m.receiveShadow=true;m.frustumCulled=false;scenery.add(m);return m});movers.push({name,meshes,placements,speed});}
 let placements=[];
 for(let side of [-1,1])for(let i=0;i<120;i++)placements.push({x:side*(16+(i*7.13%52)),y:-4.5,z:(i*17.7%330)-200,s:.85+(i%6)*.23,rot:i*.73});
 instances('Trackside cedar groves',proto.Cedar,placements);
 placements=[];for(let side of [-1,1])for(let i=0;i<19;i++)placements.push({x:side*(24+i%3*12),y:-4.5,z:i*18.5-200,s:.9+i%4*.18,rot:side<0?Math.PI:0});instances('Village',proto.House,placements);
 instances('Passing catenary gantries',proto.Gantry,Array.from({length:16},(_,i)=>({x:0,y:-4.05,z:i*20.625-200,s:1,rot:0})));
 if(proto.Pagoda)instances('Passing hillside pagoda',proto.Pagoda,[{x:-42,y:-4.3,z:-145,s:1.15,rot:.15}],.12);
 if(proto.Fuji){const landmark=new T.Group();landmark.name='Snow-capped Fuji landmark';landmark.position.set(-95,-12,-230);for(const p of proto.Fuji){const mesh=new T.Mesh(p.geometry,p.material);mesh.receiveShadow=true;landmark.add(mesh)}root.add(landmark)}
 const concrete=new T.MeshStandardMaterial({color:0x8797a0,roughness:.88}),ballast=new T.MeshStandardMaterial({color:0x47515b,roughness:.96}),railMat=new T.MeshStandardMaterial({color:0x6b7b8b,metalness:.85,roughness:.29}),grass=new T.MeshStandardMaterial({color:0x354c35,roughness:1});
 function box(p,s,m){const o=new T.Mesh(new T.BoxGeometry(...s),m);o.position.set(...p);o.receiveShadow=true;root.add(o);return o}
 box([0,-4.75,-20],[400,1,460],grass);box([0,-4.29,-20],[21,.5,460],concrete);
 for(const lane of layout.lanes){box([lane.x,-4.02,-20],[3.8,.22,460],ballast);for(const x of [-.73,.73]){box([lane.x+x,-3.82,-20],[.075,.17,460],railMat);box([lane.x+x,4.16,-20],[.013,.013,460],railMat)}}
 placements=[];for(const lane of layout.lanes)for(let i=0;i<200;i++)placements.push({x:lane.x,y:-3.91,z:-200+i*1.65,s:1,rot:0});instances('Track sleeper motion',[{geometry:new T.BoxGeometry(2.65,.13,.23),material:concrete}],placements);
 // Rice fields and embankment rails sweep past close to the train.
 for(let side of [-1,1]){
  const plots=[];for(let i=0;i<35;i++)plots.push({x:side*(18+i%2*9),y:-4.22,z:i*11-200,s:1,rot:0});
  instances('Passing rice paddies',[{geometry:new T.BoxGeometry(7.5,.045,9),material:new T.MeshStandardMaterial({color:side<0?0x5a663c:0x4b603c,roughness:.84})}],plots);
  for(let y of [-2.65,-2.3])box([side*10.05,y,-20],[.07,.06,460],railMat);
 }
 // Distant layered terrain moves more slowly to create parallax.
 const hillParts=[];const hillGeo=new T.SphereGeometry(1,18,10);hillGeo.scale(18,10,25);const hv=hillGeo.attributes.position;for(let i=0;i<hv.count;i++){const x=hv.getX(i),y=hv.getY(i),z=hv.getZ(i);hv.setY(i,y*(1+.17*Math.sin(x*.42)*Math.cos(z*.3)))}hillGeo.computeVertexNormals();hillParts.push({geometry:hillGeo,material:new T.MeshStandardMaterial({color:0x354d45,roughness:1})});
 placements=[];for(let side of [-1,1])for(let i=0;i<12;i++)placements.push({x:side*(72+i%3*18),y:-7,z:i*30-200,s:1+i%3*.4,rot:i});instances('Distant mountain parallax',hillParts,placements,.20);
 // Fine wind streaks, kept outside the playable roofs.
 const streakGeo=new T.BufferGeometry(),sp=new Float32Array(100*6);streakGeo.setAttribute('position',new T.BufferAttribute(sp,3));const streaks=new T.LineSegments(streakGeo,new T.LineBasicMaterial({color:0xe3efff,transparent:true,opacity:.10,depthWrite:false}));streaks.name='Slipstream';root.add(streaks);
 const water=new T.Group();water.visible=false;root.add(water);
 function update(t,dt){time+=dt;atmosphere.update(time);distance+=layout.speed*dt;const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;streaks.visible=!reduced;
  for(const m of movers){for(let i=0;i<m.placements.length;i++){const p=m.placements[i];tmp.position.set(p.x,p.y,((p.z+200+distance*m.speed)%330+330)%330-200);tmp.rotation.set(0,p.rot,0);tmp.scale.setScalar(p.s);tmp.updateMatrix();for(const mesh of m.meshes)mesh.setMatrixAt(i,tmp.matrix)}for(const mesh of m.meshes)mesh.instanceMatrix.needsUpdate=true}
  for(let i=0;i<100;i++){const side=i%2?1:-1,x=side*(10+i%19*.9),y=.3+i%13*.23,z=((i*17.7+distance*1.5)%140)-85;sp.set([x,y,z,x,y,z+2.3+i%4],i*6)}streakGeo.attributes.position.needsUpdate=true;
 }
 function velocity(c,v,dt){if(c.enemy&&c.grounded&&['idle','block','dodge','attack'].includes(c.state)&&surface.floorAt(c.pos.x+v.x*.20,c.pos.z+v.z*.20)<-3)v.set(0,0,0);return v}
 // Start just behind the narrow tip, with capsule clearance on the sloping nose.
 const leadLane=layout.lanes.reduce((a,b)=>Math.abs(a.x)<Math.abs(b.x)?a:b);
 const nose=layout.cars.find(car=>car.nose),spawnZ=leadLane.offset+nose.start+1.2;
 const spawn=V(leadLane.x,surface.floorAt(leadLane.x,spawnZ),spawnZ);
 function reset(){distance=time=0;atmosphere.reset();update(0,0)}reset();
 return {root,water,solids,breakables,floorAt:surface.floorAt,isFatalFall:fallPhysics.isFatal,ragdollSurfaceAt:fallPhysics.surfaceAt,ragdollMaxSpeed:fallPhysics.maxSpeed,locate:surface.locate,velocity,fixed(){},groundImpact(){return false},update,reset,spawn,bossSpawn:V(0,0,-12),name:'The Last Express',kind:'shinkansen',weather:'clear',get state(){return {kind:'shinkansen',speed:layout.speed,distance,time,stationaryTrains:true,wetRoofReflections:true,gantries:16,cedars:240,pagoda:!!proto.Pagoda,fuji:!!proto.Fuji,lanes:layout.lanes,assetInfo:{loaded:true,trainBatches:trainRoot.children.length,sceneryBatches:movers.reduce((n,m)=>n+m.meshes.length,0),colliders:solids.length},propSample:movers[0].meshes[0].instanceMatrix.array[14]}}};
}
