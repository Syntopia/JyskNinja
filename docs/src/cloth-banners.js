import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createClothField} from './cloth-field.js';
import {V,boxAt} from './physics.js';
import {gardenSurface} from './garden-surfaces.js';

const textureCache=new Map();
function fabricTexture(file){if(!textureCache.has(file)){const map=new T.TextureLoader().load('./assets/textures/banners/'+file);map.colorSpace=T.SRGBColorSpace;map.anisotropy=8;textureCache.set(file,map)}return textureCache.get(file)}
export function createClothBanners(kind,parent,solids,cameraFade){
 const frozen=kind==='harbour',root=new T.Group();root.name='Interactive calligraphy banners';parent.add(root);const panels=[],staticParts=[],materials=[];let actorHistory=new WeakMap(),lastActorContacts=0;
 function makeFabric(art){
  const file=`${frozen?'indigo':'vermilion'}-${art}.png`;
  const cloth=new T.MeshPhysicalMaterial({name:`${frozen?'Indigo':'Vermilion'} ${art} woven cloth`,map:fabricTexture(file),color:0xffffff,roughness:.9,metalness:0,side:T.DoubleSide,sheen:.7,sheenColor:0xbbb3a2,sheenRoughness:.85});
  // Microscopic weave relief; image albedo stays free of baked folds or lighting.
  cloth.onBeforeCompile=s=>{s.fragmentShader=s.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\n roughnessFactor=clamp(roughnessFactor+.045*sin(vMapUv.x*1350.)*sin(vMapUv.y*1950.),.65,1.);');};cloth.customProgramCacheKey=()=> 'calligraphy-cotton-v1';
  cloth.userData.noCameraFade=true;materials.push(cloth);return cloth;
 }
 const artworks=['dragon','snake','wave','mountain','crane'];
 const fabrics=new Map(artworks.map(art=>[art,makeFabric(art)]));
 const timber=new T.MeshStandardMaterial({name:'Banner aged cedar frame',color:0xffffff,roughness:.77});gardenSurface(timber,'wood');
 const metal=new T.MeshStandardMaterial({name:'Banner bronze bindings',color:0x8c7751,metalness:.7,roughness:.45}),stone=new T.MeshStandardMaterial({name:'Banner footing stone',color:frozen?0x8c9cab:0x687477,roughness:.86}),snow=new T.MeshStandardMaterial({name:'Banner snow dust',color:0xdde6ee,roughness:1}),thread=new T.LineBasicMaterial({color:frozen?0x687b8d:0xaa5937});thread.userData.noCameraFade=true;materials.push(timber,metal,stone,snow,thread);
 function part(geometry,material,p,scale){const o=new T.Mesh(geometry,material);o.position.copy(p);if(scale)o.scale.copy(scale);o.castShadow=o.receiveShadow=true;root.add(o);staticParts.push(o);return o}
 const box=new T.BoxGeometry(1,1,1);
 function cuboid(p,s,m){return part(box,m,p,s)}
 function rod(a,b,r,m){const o=part(new T.CylinderGeometry(r,r,a.distanceTo(b),12),m,a.clone().add(b).multiplyScalar(.5));o.quaternion.setFromUnitVectors(V(0,1,0),b.clone().sub(a).normalize());return o}
 function addPanel({x,z,width=1.95,height=2.93,top=3.35,yaw=0,art=artworks[0]}){
  const id=panels.length,field=createClothField({x,z,width,height,top,yaw,wind:frozen?1.25:.85,seed:id*1.71}),g=new T.BufferGeometry(),indices=[],uv=[];
  g.setAttribute('position',new T.BufferAttribute(field.position,3).setUsage(T.DynamicDrawUsage));
  for(let j=0;j<=field.rows;j++)for(let i=0;i<=field.cols;i++){uv.push(i/field.cols,1-j/field.rows);if(i<field.cols&&j<field.rows){const a=j*(field.cols+1)+i,b=a+1,c=a+field.cols+1;indices.push(a,c,b,b,c,c+1)}}
  g.setIndex(new T.BufferAttribute(new Uint16Array(indices),1).setUsage(T.DynamicDrawUsage));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.computeVertexNormals();
  const mesh=new T.Mesh(g,fabrics.get(art));mesh.name=`${frozen?'Harbour':'Garden'} physical cloth ${id+1}`;mesh.castShadow=mesh.receiveShadow=true;mesh.frustumCulled=false;root.add(mesh);
  const hemIndices=[],nx=field.cols+1;for(let j=0;j<field.rows;j++)for(const i of [0,field.cols])hemIndices.push(j*nx+i,(j+1)*nx+i);for(let i=0;i<field.cols;i++)hemIndices.push(field.rows*nx+i,field.rows*nx+i+1);
  const hg=new T.BufferGeometry();hg.setAttribute('position',g.attributes.position);hg.setIndex(new T.BufferAttribute(new Uint16Array(indices.length*2),1).setUsage(T.DynamicDrawUsage));hg.index.array.set(hemIndices);hg.setDrawRange(0,hemIndices.length);const hem=new T.LineSegments(hg,thread);hem.frustumCulled=false;root.add(hem);
  // Brass suspension loops are fixed; the entire top seam is constrained to them.
  for(let i=0;i<5;i++){const u=(i/4-.5)*width,p=V(x+u*Math.cos(yaw),top+.07,z-u*Math.sin(yaw));const ring=part(new T.TorusGeometry(.062,.012,6,12),metal,p);ring.rotation.y=yaw;}
  panels.push({id,field,mesh,hem,revision:-1,x,z,width,height,top,yaw,art,actorContacts:0});
 }
 function gate(x,z,{width=4.7,top=3.35,clothHeight=2.93,arts=['dragon','crane']}={}){
  for(const sign of [-1,1]){const px=x+sign*width/2;
   cuboid(V(px,top/2,z),V(.20,top+.28,.20),timber);cuboid(V(px,.16,z),V(.53,.32,.57),stone);
   for(const y of [.45,top-.17])cuboid(V(px,y,z),V(.225,.095,.225),metal);
   const cap=part(new T.ConeGeometry(.23,.19,4),metal,V(px,top+.39,z));cap.rotation.y=Math.PI/4;
   solids.push({box:boxAt(px,top/2,z,.24,top+.3,.24),material:'wood'});solids.push({box:boxAt(px,.16,z,.53,.32,.57),material:'stone'});
   rod(V(px,top-.7,z),V(px-sign*.6,top+.05,z),.055,timber);
  }
  rod(V(x-width/2-.25,top+.13,z),V(x+width/2+.25,top+.13,z),.085,timber);
  if(frozen)cuboid(V(x,top+.225,z),V(width+.5,.045,.14),snow);
  const w=(width-.44)/2;
  for(const sign of [-1,1])addPanel({x:x+sign*(w/2+.065),z,width:w,height:clothHeight,top,art:arts[sign<0?0:1]});
 }
 if(frozen){
  // Five walk-through noren sets trace the main street, clear of the flanking cargo.
  for(const [i,z] of [9.1,3.7,-1.7,-7.1,-12.5].entries())
   gate(0,z,{width:i%2?5.4:5,top:i%2?3.9:3.65,clothHeight:i%2?3.42:3.22,arts:[artworks[i],artworks[(i+2)%artworks.length]]});
 }
 else{
  gate(0,5.1);
  // A second walk-through pair hangs directly below the existing torii beam.
  for(const sign of [-1,1])addPanel({x:sign*1.48,z:-7.66,width:2.72,height:2.92,top:3.29,art:sign<0?'wave':'mountain'});
  // A tall freestanding textile on each flank rewards moving around the arena.
  for(const [x,z] of [[-8.1,5.5],[8.2,-2.6]]){
   cuboid(V(x-.92,1.9,z),V(.18,3.8,.18),timber);cuboid(V(x-.92,.18,z),V(.5,.36,.52),stone);rod(V(x-1.05,3.6,z),V(x+.86,3.6,z),.07,timber);
   solids.push({box:boxAt(x-.92,1.9,z,.22,3.8,.22),material:'wood'});addPanel({x,z,width:1.6,height:3.1,top:3.49,art:x<0?'snake':'crane'});
  }
 }
 // Batch all rigid parts; only the actual cloth meshes update each frame.
 root.updateMatrixWorld(true);const batches=new Map();for(const o of staticParts){let g=o.geometry.clone().applyMatrix4(o.matrixWorld);if(g.index)g=g.toNonIndexed();if(!batches.has(o.material))batches.set(o.material,[]);batches.get(o.material).push(g);o.removeFromParent()}
 for(const [m,gs] of batches){const o=new T.Mesh(mergeGeometries(gs),m);o.name='Banner fittings • '+m.name;o.castShadow=o.receiveShadow=true;root.add(o);for(const g of gs)g.dispose()}
 cameraFade.add(materials);
 function upload(){for(const p of panels){
  const g=p.mesh.geometry,tear=p.field.tearing;
  if(p.revision!==tear.revision){
   // Keep fixed-capacity GPU buffers. Zero unused triangles so normal generation
   // cannot accidentally shade across removed faces or draw orphaned old hems.
   g.index.array.fill(0);g.index.array.set(tear.indices);g.index.needsUpdate=true;g.setDrawRange(0,tear.indices.length);
   const hg=p.hem.geometry;hg.index.array.fill(0);hg.index.array.set(tear.boundary);hg.index.needsUpdate=true;hg.setDrawRange(0,tear.boundary.length);p.revision=tear.revision;
  }
  g.attributes.position.needsUpdate=true;g.computeVertexNormals();
 }}
 function cutSegment(a,b){const hits=[],from=a.toArray(),to=b.toArray();
  for(const p of panels){const positions=p.field.position;let minX=Infinity,minY=Infinity,minZ=Infinity,maxX=-Infinity,maxY=-Infinity,maxZ=-Infinity;
   for(let i=0;i<positions.length;i+=3){minX=Math.min(minX,positions[i]);maxX=Math.max(maxX,positions[i]);minY=Math.min(minY,positions[i+1]);maxY=Math.max(maxY,positions[i+1]);minZ=Math.min(minZ,positions[i+2]);maxZ=Math.max(maxZ,positions[i+2])}
   const r=.028;if(Math.min(a.x,b.x)>maxX+r||Math.max(a.x,b.x)<minX-r||Math.min(a.y,b.y)>maxY+r||Math.max(a.y,b.y)<minY-r||Math.min(a.z,b.z)>maxZ+r||Math.max(a.z,b.z)<minZ-r)continue;
   const faces=p.field.cutSegment(from,to,r);if(faces)hits.push({panel:p,faces,point:V(...p.field.tearing.lastCutPoint)});
  }return hits;
 }
 function fixed(dt,actors=[]){
  lastActorContacts=0;
  for(const p of panels){
   const capsules=[];
   for(const a of actors){if(!a.alive||Math.abs(a.pos.x-p.x)>p.width/2+2.0||Math.abs(a.pos.z-p.z)>p.height+1||a.pos.y>p.top+.3)continue;
    const radius=Math.max(a.radius+.10,.37)*(a.state==='dodge'?1.10:1),height=Math.max(radius*2,a.height),old=actorHistory.get(a),dist=old?Math.hypot(a.pos.x-old.x,a.pos.y-old.y,a.pos.z-old.z):0;
    // Capsule radius also covers half a frame's travel to catch fast dodge contacts.
    capsules.push({a:[a.pos.x,a.pos.y+radius,a.pos.z],b:[a.pos.x,a.pos.y+height-radius,a.pos.z],r:radius+Math.min(.13,dist*.5)});
    // Animated forearms can sweep the fabric independently of the torso.
    if(a.capsules)for(const c of a.capsules())if(c.part==='arm')capsules.push({a:c.a.toArray(),b:c.b.toArray(),r:c.r+.055});
   }
   p.field.step(dt,capsules);const hits=p.field.lastContacts;p.actorContacts+=hits;lastActorContacts+=hits;
  }
  for(const a of actors)actorHistory.set(a,{x:a.pos.x,y:a.pos.y,z:a.pos.z});
 }
 return {root,panels,fixed,upload,cutSegment,reset(){actorHistory=new WeakMap();lastActorContacts=0;for(const p of panels){p.field.reset();p.actorContacts=0}upload()},get state(){return {kind,panels:panels.map(p=>({id:p.id,art:p.art,x:p.x,z:p.z,top:p.top,width:p.width,height:p.height,...p.field.state})),lastActorContacts}}};
}
