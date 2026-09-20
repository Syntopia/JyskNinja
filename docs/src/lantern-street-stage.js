import {prepareStreetGeometry} from './street-indexed-geometry.js';
import {civilianBladeHits} from './civilian-combat.js';
import {createStreetWetSurface} from './street-wet-surface.js';
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createStreetDynamics} from './street-dynamics.js';
import {createCivilianCrowd,loadCrowdAsset} from './civilian-crowd.js';
import {bridgeHeight,BRIDGE_Z} from './street-ambush.js';
import {V,boxAt} from './physics.js';

export async function loadLanternStreet(loader){
 const base='./assets/scenes/lantern-street/';
 const [gltf,response,sky,crowd]=await Promise.all([loader.loadAsync(base+'lantern-street.glb'),fetch(base+'manifest.json'),new T.TextureLoader().loadAsync(base+'textures/sunset-sky.png'),loadCrowdAsset()]);
 if(!response.ok)throw new Error('Lantern Street manifest unavailable');
 sky.colorSpace=T.SRGBColorSpace;sky.mapping=T.EquirectangularReflectionMapping;
 return {model:gltf.scene,metadata:await response.json(),sky,crowd};
}

export function buildLanternStreet(cameraFade,resources){
 const {model,metadata,sky}=resources,root=new T.Group();root.name='Lantern Street • playable scene';root.add(model);
 const dynamicCategories=new Set([...metadata.banners,...metadata.lights].map(s=>s.category));
 const batches=new Map(),remove=[];root.updateMatrixWorld(true);
 // Keep cloth and lantern nodes intact; batch static architecture by material.
 model.traverse(o=>{if(!o.isMesh)return;o.castShadow=true;o.receiveShadow=true;if(dynamicCategories.has(o.userData.category))return;
  const geometry=prepareStreetGeometry(o.geometry,o.matrixWorld);
  if(!batches.has(o.material))batches.set(o.material,[]);batches.get(o.material).push(geometry);remove.push(o);
 });
 for(const o of remove)o.removeFromParent();
 for(const [material,geometries] of batches){const mesh=new T.Mesh(mergeGeometries(geometries),material);mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);for(const g of geometries)g.dispose()}
 const dynamics=createStreetDynamics(root,metadata),crowd=createCivilianCrowd(resources.crowd,{count:96});root.add(crowd.mesh);
 const wetSurface=createStreetWetSurface(root,metadata);
 const materials=new Set();root.traverse(o=>{if(o.material&&!o.isInstancedMesh&&!o.isReflector)materials.add(o.material)});cameraFade.add([...materials]);
 const solids=metadata.colliders.map(c=>({box:new T.Box3(V(c.min[0],0,c.min[1]),V(c.max[0],11,c.max[1])),material:'wood'}));
 // Keep combat on the clear central street, away from decorative shop props.
 for(const x of [-4.2,4.2])solids.push({box:boxAt(x,1,-27,1.2,2,74),material:'stone',blocksBlade:false,navigationOnly:true});
 for(const z of [7.4,-61.6])solids.push({box:boxAt(0,1,z,8,2,.3),material:'stone',blocksBlade:false,navigationOnly:true});
 for(let i=0;i<16;i++){const x=-5.2+(i+.5)*10.4/16,y=bridgeHeight(x);solids.push({box:boxAt(x,y-.12,BRIDGE_Z,10.4/16,.24,2.25),material:'wood',bridge:true})}
 const points=Array.from({length:8},()=>{const light=new T.PointLight(0xffa64a,0,7,2);root.add(light);return light});
 let playerPosition=V(0,.08,5),lightClock=1;
 function lights(dt){lightClock+=dt;if(lightClock>.4){lightClock=0;const nearest=metadata.lights.map((spec,index)=>({spec,index,d:Math.hypot(spec.position[0]-playerPosition.x,spec.position[2]-playerPosition.z)})).sort((a,b)=>a.d-b.d);
  points.forEach((light,i)=>{const {spec,index}=nearest[i];light.userData.streetLightIndex=index;light.color.set(spec.color);light.distance=spec.distance})}
  points.forEach(light=>dynamics.updateLight(light));
 }
 lights(0);
 return {kind:'lantern-street',name:'Lantern Street',weather:'clear',root,background:sky,fog:new T.FogExp2(0x76606d,.010),solids,breakables:[],spawn:V(0,.08,5),water:new T.Group(),
  floorAt(x,z,fromY=0){if(Math.abs(x)<5.2&&Math.abs(z-BRIDGE_Z)<1.125&&fromY>=bridgeHeight(x)-.25)return bridgeHeight(x);return .08},
  fixed(dt,actors){playerPosition=actors[0].pos;crowd.fixed(dt,actors.filter(a=>a.alive).map(a=>({x:a.pos.x,y:a.pos.y,z:a.pos.z,radius:a.enemy?.8:1.05})))},
  civilianBladeHits(a,b){return civilianBladeHits(crowd.flock.agents,a,b)},hitCivilian(civilian){return crowd.kill(civilian)},
  velocity(c,v){return v},groundImpact(){return false},
  update(time,dt,camera,viewportHeight){wetSurface.update(time);dynamics.update(dt,playerPosition);crowd.update(playerPosition,camera,viewportHeight);lights(dt)},
  reset(){wetSurface.reset();crowd.reset();dynamics.reset();lightClock=1},
  get state(){return {kind:'lantern-street',crowd:crowd.stats,dynamics:dynamics.stats,wetSurface:wetSurface.stats}}
 };
}
