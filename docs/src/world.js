import {buildLanternStreet} from './lantern-street-stage.js';
import {createBambooGrove} from './bamboo-grove.js';
import {createHarbourSnow} from './harbour-snow.js';
import {createClothBanners} from './cloth-banners.js';
import {gardenSurface,gardenUV} from './garden-surfaces.js';
import {buildShinkansen} from './shinkansen.js';
import {buildVoyage} from './voyage.js';
import {createBasin} from './basin.js';
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {V,boxAt} from './physics.js';
import {texture,pbr,wind,planarUV} from './surface.js';
import {createSceneryFade} from './camera.js';
function buildGarden(scene,cameraFade){
 let seed=823;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
 const root=new T.Group();scene.add(root);const solids=[],breakables=[],lanterns=[],lights=[],replacements=[];const windTime={value:0};const materials={};
 function mat(name,color,roughness=.85,extra={}){return materials[name]??=(new T.MeshStandardMaterial({name,color,roughness,...extra}))}
 const stone=mat('Midnight basalt',0x394950),stoneLight=mat('Silver stone',0x657378),wood=mat('Cedar',0x352c3e),red=mat('Vermilion lacquer',0x833e48),gold=mat('Weathered brass',0xa88958,.4,{metalness:.6}),roof=mat('Slate roof',0x243947),grass=mat('Moss',0x263e3b),bark=mat('Cherry bark',0x34333f),pink=mat('Cherry blossoms',0xb67391,.95,{flatShading:true}),pinkLight=mat('Pale cherry blossoms',0xd7a1b3,.92,{flatShading:true}),jade=mat('Bamboo',0x31524e),leaf=mat('Bamboo leaves',0x3f6960),glow=mat('Lantern paper',0xf7d7a0,.7,{emissive:0xffa345,emissiveIntensity:2.6});
 for(const m of [stone,stoneLight])gardenSurface(m,'stone',{light:m===stoneLight});
 const paver=mat('Worn courtyard basalt',0xffffff),paverLight=mat('Worn courtyard pale basalt',0xffffff);
 gardenSurface(paver,'stone',{paving:true});gardenSurface(paverLight,'stone',{paving:true,light:true});
 gardenSurface(wood,'wood');gardenSurface(red,'wood',{paint:true});
 pbr(bark,'cedar',.45);bark.color.setHex(0x9a8274);
 pbr(roof,'slate',.42);roof.color.setHex(0x879ca7);roof.roughness=.52;
 for(const m of [pink,pinkLight]){m.map=texture('sakura.png',true);m.color.setHex(0xffffff);m.alphaTest=.38;m.side=T.DoubleSide;m.flatShading=false;wind(m,windTime,.12)}
 leaf.side=T.DoubleSide;wind(leaf,windTime,.14);
 function replacement(name,start,x=0,y=0,z=0,scale=1,collider=null){
  const old=root.children.slice(start);for(const o of old)o.traverse(n=>{if(n.isMesh)n.userData.dynamic=true});
  replacements.push({name,old,position:V(x,y,z),scale,collider});
 }
 const boxGeo=new T.BoxGeometry(1,1,1),cylGeo=new T.CylinderGeometry(1,1,1,8),icoGeo=new T.IcosahedronGeometry(1,1);
 function mesh(g,m,pos,scale,rot){const o=new T.Mesh(g,m);if(pos)o.position.copy(pos);if(scale)o.scale.copy(scale);if(rot)o.rotation.set(...rot);o.castShadow=true;o.receiveShadow=true;root.add(o);return o}
 function box(x,y,z,w,h,d,m,solid=false){const o=mesh(boxGeo,m,V(x,y,z),V(w,h,d));if(solid)solids.push({box:boxAt(x,y,z,w,h,d),material:m===wood?'wood':'stone',mesh:o});return o}
 function pole(a,b,r,m){const o=mesh(cylGeo,m,a.clone().add(b).multiplyScalar(.5),V(r,a.distanceTo(b),r));o.quaternion.setFromUnitVectors(V(0,1,0),b.clone().sub(a).normalize());return o}
 function rock(x,z,s){const start=root.children.length;const o=mesh(icoGeo,stone,V(x,s*.45,z),V(s,s*.8,s*.9));o.rotation.set(rand(),rand()*6,rand());solids.push({box:boxAt(x,s*.42,z,s*1.4,s*.9,s*1.2),material:'stone'});box(x,s*.9,z,s*.95,.06,s*.65,grass);replacement('Rock',start,x,0,z,s);}
 // Leave a real opening beneath the displaced water, including wave troughs.
 box(-23.625,-.22,0,17.75,.4,65,grass);box(11.625,-.22,0,41.75,.4,65,grass);
 box(-12,-.22,-18.25,5.5,.4,28.5,grass);box(-12,-.22,19.25,5.5,.4,26.5,grass);
 // A broad paved court, with slightly irregular individual stone slabs.
 for(let x=-5;x<=5;x++)for(let z=-10;z<=11;z++){const h=.025+rand()*.018;const o=box(x*1.08,h/2,z*1.04,1.02,h,.98,rand()>.20?paver:paverLight);o.rotation.y=(rand()-.5)*.025}
 const ring=new T.Mesh(new T.RingGeometry(3.0,3.04,96),gold);ring.rotation.x=-Math.PI/2;ring.position.set(0,.055,-1);root.add(ring);
 for(let i=0;i<16;i++){const a=i/16*Math.PI*2;box(Math.sin(a)*3,.06,-1+Math.cos(a)*3,.06,.025,.30,gold).rotation.y=a}
 // Terraced shrine and climbable shallow steps.
 box(0,.30,-13,10,.60,6,stone,true);box(0,.64,-13,10.3,.08,6.3,stoneLight,true);
 for(let i=0;i<3;i++)box(0,.10+i*.10,-9.1-i*.50,5,.20+i*.20,.55,stone,true);
 function tiledRoof(x,y,z,w,d){
  // Curved eaves made from a pair of tapered roof wings.
  for(const sign of [-1,1]){
   const vs=[],fs=[];for(let i=0;i<=8;i++){const t=i/8,xx=sign*t*w/2,yy=y+(.65*(1-t)**1.4+.18*t**5);vs.push(xx,yy,-d/2,xx,yy,d/2)}
   for(let i=0;i<8;i++){const n=i*2;fs.push(n,n+1,n+2,n+1,n+3,n+2)}
   const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vs,3));g.setIndex(fs);g.computeVertexNormals();const m=roof;m.side=T.DoubleSide;mesh(g,m,V(x,0,z));
   for(let k=0;k<12;k++){const zz=z+(k/11-.5)*d;const pts=[];for(let i=0;i<=8;i++){const t=i/8;pts.push(V(x+sign*t*w/2,y+.65*(1-t)**1.4+.18*t**5+.015,zz))}mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts),16,.018,4,false),stone)}
  }pole(V(x,y+.68,z-d/2-.18),V(x,y+.68,z+d/2+.18),.08,gold)
 }
 const shrineStart=root.children.length;
 for(const x of [-3.7,3.7])for(const z of [-11.5,-14.9]){box(x,2.2,z,.28,3.1,.28,red,true);box(x,.78,z,.65,.25,.65,stoneLight,true)}
 box(0,2,-15,7.7,2.6,.22,wood,true);for(let x=-3.5;x<=3.6;x+=.5)box(x,2,-14.85,.055,2.5,.12,gold);
 box(0,3.66,-13.1,8.2,.22,4.5,red);tiledRoof(0,3.75,-13.1,10.2,6.3);
 replacement('Shrine',shrineStart,0,.68,-13.1);
 const toriiStart=root.children.length;
 // Torii marks the threshold, readable from the starting camera.
 for(const x of [-3.2,3.2]){box(x,2.2,-7.7,.36,4.4,.36,red,true);box(x,.22,-7.7,.60,.45,.60,stone,true);box(x,3.8,-7.7,.48,.18,.55,gold)}
 box(0,3.45,-7.7,7.4,.24,.3,red);box(0,4.38,-7.7,8.5,.32,.57,wood);box(-4.1,4.50,-7.7,.95,.20,.62,wood).rotation.z=-.15;box(4.1,4.5,-7.7,.95,.20,.62,wood).rotation.z=.15;box(0,3.92,-7.68,.7,.75,.10,gold);
 replacement('Torii',toriiStart,0,0,-7.7);
 // Walls define the physical arena; decorative roofs continue beyond it.
 for(const x of [-18,18]){box(x,.95,0,.5,1.9,36,stone,true);box(x,1.94,0,.75,.13,36,roof)}
 for(const z of [-18,17]){box(0,.95,z,36,1.9,.5,stone,true);box(0,1.94,z,36,.13,.75,roof)}
 for(let i=-18;i<=18;i+=3){for(const z of [-18,17])box(i,1.1,z,.5,2.2,.7,wood,true);for(const x of [-18,18])box(x,1.1,i,.7,2.2,.5,wood,true)}
 function lantern(x,z){const start=root.children.length;box(x,.18,z,.65,.36,.65,stone,true);box(x,.78,z,.21,1.1,.21,stoneLight,true);box(x,1.45,z,.65,.13,.65,wood);box(x,1.73,z,.42,.48,.42,glow);box(x,2.03,z,.8,.15,.8,roof);mesh(new T.ConeGeometry(.65,.35,4),roof,V(x,2.2,z),V(1,1,1),[0,Math.PI/4,0]);for(const a of [-1,1])for(const b of [-1,1])box(x+a*.23,1.73,z+b*.23,.035,.5,.035,wood);const halo=mesh(new T.CircleGeometry(1.6,32),new T.MeshBasicMaterial({color:0xf5aa64,transparent:true,opacity:.09,depthWrite:false}),V(x,.055,z),V(1,1,1),[-Math.PI/2,0,0]);halo.castShadow=false;lanterns.push({x,z});replacement('Lantern',start,x,0,z);}
 for(const x of [-6.6,6.6])for(const z of [9,1,-7,-14])lantern(x,z);
 for(const [x,z] of [[-6.6,1],[6.6,-7],[6.6,9]]){const l=new T.PointLight(0xffb568,5,7,2);l.position.set(x,1.8,z);scene.add(l);lights.push(l)}
 // Petal-heavy cherry trees, sculpted in broad low-poly clusters.
 function tree(x,z,scale){const base=V(x,0,z),top=V(x+.25*scale,3.5*scale,z);pole(base,top,.20*scale,bark);solids.push({box:boxAt(x,1.5*scale,z,.6*scale,3*scale,.6*scale),material:'wood'});
  for(let b=0;b<5;b++){const a=b*2.4,tip=top.clone().add(V(Math.sin(a)*1.65*scale,(.4+rand())*scale,Math.cos(a)*1.4*scale));pole(top.clone().add(V(0,-1,0)),tip,.085*scale,bark);for(let j=0;j<36;j++){const p=tip.clone().add(V((rand()-.5)*2.8,(rand()-.5)*1.6,(rand()-.5)*2.8).multiplyScalar(scale));const card=mesh(new T.PlaneGeometry(1,1),rand()>.4?pink:pinkLight,p,V(.75,.75,.75).multiplyScalar(scale*(.7+rand()*.7)),[rand()*Math.PI,rand()*Math.PI,rand()*6]);card.userData.foliageUV=true;card.castShadow=false;}}
 }
 for(const [x,z,s] of [[-9,7,1.25],[10,6,1.15],[-10,-6,1.25],[11,-10,1.1],[-14,13,1.1],[15,-2,.9]])tree(x,z,s);
 for(const [x,z,s] of [[-7.5,-3,1.2],[7.7,3,1.1],[13,11,1.4],[-14,-12,1.6],[9,-5,.8]])rock(x,z,s);
 // Shallow reflective pond with stepping stones. Its floor really is lower.
 const basin=createBasin(scene),water=basin.mesh;
 box(-12,-.46,1,5.5,.08,10,stone);
 for(const x of [-14.82,-9.18])box(x,-.17,1,.14,.45,10.28,stoneLight);
 for(const z of [-4.07,6.07])box(-12,-.17,z,5.5,.45,.14,stoneLight);
 for(let j=0;j<6;j++){const x=-12+Math.sin(j)*.6,z=-3+j*1.5;box(x,.16,z,1.1,.32,1.1,stoneLight,true).rotation.y=j*.23}
 // Destructible practice crates, solid before they break.
 function crate(x,z){const start=root.children.length;const g=new T.Group();root.add(g);const body=new T.Mesh(new T.BoxGeometry(.85,.85,.85),wood);body.position.y=.425;g.add(body);for(const yy of [.12,.73]){const band=new T.Mesh(new T.BoxGeometry(.88,.065,.88),gold);band.position.y=yy;g.add(band)}g.position.set(x,0,z);g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.userData.dynamic=true}});const c={box:boxAt(x,.43,z,.88,.86,.88),material:'wood',mesh:g,breakable:true,broken:false};solids.push(c);breakables.push(c);replacement('Crate',start,x,0,z,1,c)}
 for(const [x,z] of [[-3.8,5],[4.1,4.5],[4.8,5.5],[-7,11]])crate(x,z);
 // Cloth standards with a woven surface and a breeze that leaves the top tied.
 const bannerMat=mat('Indigo clan standards',0x294a58,.9,{side:T.DoubleSide});pbr(bannerMat,'cloth',.12);bannerMat.map=null;
 bannerMat.onBeforeCompile=shader=>{shader.uniforms.standardTime=windTime;shader.vertexShader='uniform float standardTime;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
 float loose=clamp((3.12-position.y)/1.55,0.0,1.0);transformed.z+=sin(position.y*3.8+standardTime*2.1+position.x)*.13*loose;`);shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 float edge=step(.43,abs(fract(vUv.x)-.5));float seal=1.0-smoothstep(.07,.085,abs(length((vUv-vec2(.5,.62))*vec2(1.,2.))- .23));diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.63,.43,.19),max(edge,seal)*.8);`);};bannerMat.defines={USE_UV:''};bannerMat.customProgramCacheKey=()=> 'woven-wind-standard-v1';
 for(const x of [-5.35,5.35]){pole(V(x,0,-9.9),V(x,3.24,-9.9),.045,gold);pole(V(x-.34,3.13,-9.9),V(x+.34,3.13,-9.9),.026,gold);const flag=mesh(new T.PlaneGeometry(.60,1.50,8,16),bannerMat,V(x,2.36,-9.9));flag.userData.foliageUV=true;}
 const leafShape=new T.Shape();leafShape.moveTo(-.55,0);leafShape.quadraticCurveTo(0,.17,.55,0);leafShape.quadraticCurveTo(0,-.12,-.55,0);const leafGeo=new T.ShapeGeometry(leafShape,5);
 // Bamboo backdrop, batched below along with the rest of the architecture.
 for(let i=0;i<130;i++){const side=rand()<.5?-1:1,x=side*(19+rand()*8),z=-20+rand()*42,h=3+rand()*6;pole(V(x,0,z),V(x+.3,h,z),.055,jade);for(let j=0;j<3;j++){const p=V(x+.3,h*.65+j*.7,z);for(let k=0;k<5;k++)mesh(leafGeo,leaf,p.clone().add(V((rand()-.5)*.7,(rand()-.5)*.25,(rand()-.5)*.7)),V(1,1,1),[rand()*2,rand()*6,rand()-.5])}}
 const meadow=mat('Fine garden grass',0x426457,.95,{side:T.DoubleSide});wind(meadow,windTime,.07);
 const blades=[],bladeIndices=[];
 for(let i=0;i<1500;i++){const x=(rand()-.5)*34,z=(rand()-.5)*32;if(Math.abs(x)<6||x>-15&&x<-9&&z>-4.5&&z<6.5)continue;
  const h=.08+rand()*.25,a=rand()*6.28,w=.012;const n=blades.length/3;blades.push(x-Math.cos(a)*w,0,z-Math.sin(a)*w,x+Math.cos(a)*w,0,z+Math.sin(a)*w,x+.05*Math.sin(a),h,z+.05*Math.cos(a));bladeIndices.push(n,n+1,n+2);
 }
 const bladesGeo=new T.BufferGeometry();bladesGeo.setAttribute('position',new T.Float32BufferAttribute(blades,3));bladesGeo.setIndex(bladeIndices);bladesGeo.computeVertexNormals();mesh(bladesGeo,meadow);
 // Windblown fallen petals and small moss tufts on the margins.
 for(let i=0;i<400;i++){const x=(rand()-.5)*32,z=(rand()-.5)*31;if(Math.abs(x)<5&&rand()>.18)continue;mesh(new T.CircleGeometry(.025+rand()*.035,5),rand()>.5?pink:pinkLight,V(x,.045,z),V(1,1,1),[-Math.PI/2,0,rand()*6])}
 // Layered continuous ridgelines replace the old repeated cone silhouettes.
 for(let layer=0;layer<3;layer++){
  const positions=[],indices=[],count=160,radius=48+layer*21;
  for(let i=0;i<=count;i++){
   const a=i/count*Math.PI*2;
   const h=5+layer*2+Math.pow(.5+.5*Math.sin(a*7+layer*2),3)*7+Math.sin(a*17+layer)*1.5+Math.sin(a*29)*.6;
   const x=Math.cos(a)*radius,z=Math.sin(a)*radius;
   positions.push(x,-3,z,x,h,z);
   if(i<count){const k=i*2;indices.push(k,k+1,k+2,k+1,k+3,k+2)}
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();
  mesh(g,new T.MeshBasicMaterial({color:[0x172c3e,0x223c50,0x2b465c][layer],side:T.DoubleSide}),V());
 }
 // Batch static scenery by material to keep draw calls low.
 root.updateMatrixWorld(true);const batches=new Map(),remove=[];
 root.traverse(o=>{if(!o.isMesh||o.userData.dynamic)return;const g=o.geometry.clone().applyMatrix4(o.matrixWorld);if(g.index)g.setIndex(g.index.clone());const flat=g.index?g.toNonIndexed():g;for(const key of Object.keys(flat.attributes))if(!['position','normal','uv'].includes(key))flat.deleteAttribute(key);if(!flat.attributes.normal)flat.computeVertexNormals();if(!o.userData.foliageUV)gardenUV(flat,o.material);if(!batches.has(o.material))batches.set(o.material,[]);batches.get(o.material).push(flat);remove.push(o)});
 for(const o of remove)o.removeFromParent();for(const [m,gs] of batches){const geo=mergeGeometries(gs,false);const o=new T.Mesh(geo,m);o.castShadow=m!==glow;o.receiveShadow=true;scene.add(o)}
 // Moon and sky stay beyond the fog, while the trees frame the composition.
 const sky=new T.Mesh(new T.SphereGeometry(180,24,16),new T.ShaderMaterial({side:T.BackSide,depthWrite:false,vertexShader:'varying vec3 v;void main(){v=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec3 v;void main(){float h=normalize(v).y;vec3 c=mix(vec3(.075,.13,.20),vec3(.018,.033,.085),smoothstep(-.1,.8,h));gl_FragColor=vec4(c,1.);}'}));scene.add(sky);
 const moon=new T.Mesh(new T.SphereGeometry(2.6,40,24),new T.MeshBasicMaterial({color:new T.Color(0xf0e6ce).multiplyScalar(1.25),fog:false}));moon.position.set(-12,16,-42);scene.add(moon);
 const starPos=[];for(let i=0;i<500;i++){const p=V((rand()-.5)*2,rand(),(rand()-.5)*2).normalize().multiplyScalar(130);if(p.y>18)starPos.push(...p.toArray())}const sg=new T.BufferGeometry();sg.setAttribute('position',new T.Float32BufferAttribute(starPos,3));scene.add(new T.Points(sg,new T.PointsMaterial({color:0xc7daed,size:.16,transparent:true,opacity:.65,fog:false})));
 const petalPositions=new Float32Array(160*3);for(let i=0;i<160;i++){petalPositions[i*3]=(rand()-.5)*30;petalPositions[i*3+1]=rand()*9;petalPositions[i*3+2]=(rand()-.5)*30}const pg=new T.BufferGeometry();pg.setAttribute('position',new T.BufferAttribute(petalPositions,3));const petals=new T.Points(pg,new T.PointsMaterial({color:0xe7aec5,size:.055,transparent:true,opacity:.7}));scene.add(petals);
 // Small warm lights among the reeds, animated without additional point lights.
 const fireflyPositions=new Float32Array(54*3),fireflyGeo=new T.BufferGeometry();fireflyGeo.setAttribute('position',new T.BufferAttribute(fireflyPositions,3));
 const fireflies=new T.Points(fireflyGeo,new T.PointsMaterial({color:0xffd987,size:.045,transparent:true,opacity:.85,blending:T.AdditiveBlending,depthWrite:false}));scene.add(fireflies);
 cameraFade.add(Object.values(materials));
 function installProps(kit){
  const prototype=new Map(),used=new Set();kit.updateMatrixWorld(true);
  for(const name of ['Torii','Shrine','Lantern','Crate','Rock']){
   const source=kit.getObjectByName(name);if(!source)throw new Error('Missing Blender prototype: '+name);
   const inverse=source.matrixWorld.clone().invert(),groups=new Map();
   source.traverse(o=>{if(!o.isMesh)return;const mat=o.material;used.add(mat);mat.envMapIntensity=.65;
    if(/cedar/i.test(mat.name))gardenSurface(mat,'wood');
    else if(/lacquer/i.test(mat.name))gardenSurface(mat,'wood',{paint:true});
    else if(/granite|slate/i.test(mat.name))gardenSurface(mat,'stone',{light:/granite/i.test(mat.name)});
    const g=o.geometry.clone().applyMatrix4(inverse.clone().multiply(o.matrixWorld));const flat=g.index?g.toNonIndexed():g;
    for(const k of Object.keys(flat.attributes))if(!['position','normal','uv'].includes(k))flat.deleteAttribute(k);
    if(mat.userData.gardenSurface)gardenUV(flat,mat);else if(!flat.attributes.uv)planarUV(flat);if(!groups.has(mat))groups.set(mat,[]);groups.get(mat).push(flat);
   });
   const group=new T.Group();for(const [mat,gs] of groups){const m=new T.Mesh(mergeGeometries(gs),mat);m.castShadow=mat.emissiveIntensity<=1;m.receiveShadow=true;group.add(m)}prototype.set(name,group);
  }
  const staticGroups=new Map();
  for(const item of replacements){
   const model=prototype.get(item.name).clone();model.name=item.name;model.position.copy(item.position);model.scale.setScalar(item.scale);root.add(model);model.updateMatrixWorld(true);
   for(const o of item.old)o.removeFromParent();
   if(item.collider){item.collider.mesh=model;continue}
   model.traverse(o=>{if(!o.isMesh)return;const g=o.geometry.clone().applyMatrix4(o.matrixWorld);if(!staticGroups.has(o.material))staticGroups.set(o.material,[]);staticGroups.get(o.material).push(g)});model.removeFromParent();
  }
  for(const [mat,gs] of staticGroups){const o=new T.Mesh(mergeGeometries(gs),mat);o.name='Blender architecture • '+mat.name;o.castShadow=mat.emissiveIntensity<=1;o.receiveShadow=true;scene.add(o)}
  cameraFade.add([...used]);
  return {prototypes:prototype.size,placements:replacements.length};
 }
 basin.setObstacles(solids);
 return {basin,cameraFade,installProps,solids,breakables,root,water,floorAt:(x,z)=>(x>-14.75&&x< -9.25&&z>-4&&z<6)?-.42:0,
  update(time,dt){windTime.value=time;basin.upload();
   for(let i=0;i<lights.length;i++)lights[i].intensity=5.8+Math.sin(time*4.7+i)*.22+Math.sin(time*9.3+i*2)*.14;
   for(let i=0;i<54;i++){fireflyPositions[i*3]=-13+Math.sin(i*19.7)*3+Math.sin(time*.3+i)*.4;fireflyPositions[i*3+1]=.5+(i%7)*.19+Math.sin(time*.7+i)*.2;fireflyPositions[i*3+2]=Math.cos(i*7.13)*7+Math.sin(time*.23+i)}fireflyGeo.attributes.position.needsUpdate=true;
   for(let i=0;i<160;i++){petalPositions[i*3]+=(.2+Math.sin(time*.5+i)*.12)*dt;petalPositions[i*3+1]-=(.13+i%5*.025)*dt;petalPositions[i*3+2]+=Math.cos(time*.4+i)*dt*.12;if(petalPositions[i*3+1]<.05){petalPositions[i*3+1]=8;petalPositions[i*3]=(i*7.19%30)-15}}pg.attributes.position.needsUpdate=true},
  reset(){basin.reset();for(const c of breakables){c.broken=false;c.mesh.visible=true}}};
}

export function buildWorld(scene){
 const cameraFade=createSceneryFade([]),gardenNodes=new Set(),cache=new Map(),voyageKits={},clothSystems=new Map();
 const empty={root:new T.Group(),water:new T.Group(),solids:[],breakables:[]};
 let garden=null,bamboo=null,streetResources=null,harbourSnow=null,stage=null;
 const originalBackground=scene.background,originalFog=scene.fog?.clone();
 function prepareGarden(){
  if(garden)return;
  const before=new Set(scene.children);garden=buildGarden(scene,cameraFade);
  for(const node of scene.children)if(!before.has(node))gardenNodes.add(node);
  bamboo=createBambooGrove(garden.root,garden.solids);
  clothSystems.set('garden',createClothBanners('garden',garden.root,garden.solids,cameraFade));
 }
 const basin=new Proxy({}, {get(_target,key){return (...args)=>{if(garden&&(!stage||key==='reset'))return garden.basin[key]?.(...args)}}});
 const world={basin,cameraFade,
  installStreet(resources){streetResources=resources},
  installVoyage(kits){Object.assign(voyageKits,kits)},
  installProps(kit){prepareGarden();const before=new Set(scene.children),result=garden.installProps(kit);for(const o of scene.children)if(!before.has(o))gardenNodes.add(o);return result},
  select(kind='garden'){if(kind==='garden'){prepareGarden();stage=null;bamboo.reset()}else{if(!cache.has(kind)){const next=kind==='lantern-street'?buildLanternStreet(cameraFade,streetResources):kind==='shinkansen'?buildShinkansen(cameraFade,voyageKits[kind]):buildVoyage(kind,cameraFade,voyageKits[kind]);cache.set(kind,next);scene.add(next.root);if(kind==='harbour'){clothSystems.set(kind,createClothBanners(kind,next.root,next.solids,cameraFade));harbourSnow=createHarbourSnow(next.root,next.solids)}}stage=cache.get(kind);stage.reset()}
   clothSystems.get(kind)?.reset();if(kind==='harbour')harbourSnow?.reset();
   for(const o of gardenNodes)o.visible=!stage;for(const s of cache.values())s.root.visible=s===stage;
   scene.background=stage?.background||(stage?new T.Color(stage.kind==='shinkansen'?0x9aa9b4:stage.kind==='harbour'?0x596e8c:0x0b141d):originalBackground);scene.fog=stage?.fog||(stage?new T.FogExp2(stage.kind==='shinkansen'?0x9aa9b4:stage.kind==='harbour'?0x8294b0:0x182733,stage.kind==='shinkansen'?.0032:stage.kind==='harbour'?.0075:.015):originalFog?.clone());
  },
  get stage(){return stage?.kind||'garden'},get stageName(){return stage?.name||'The Rain Garden'},get weather(){return stage?.weather||'rain'},get stageState(){return {...(stage?.state||{kind:'garden'}),cloth:clothSystems.get(stage?.kind||'garden')?.state}},get bamboo(){return stage?null:bamboo},get snow(){return stage?.kind==='harbour'?harbourSnow:null},get cloth(){return clothSystems.get(stage?.kind||'garden')},
  get root(){return stage?.root||garden?.root||empty.root},get water(){return stage?.water||garden?.water||empty.water},get solids(){return stage?.solids||garden?.solids||empty.solids},get breakables(){return stage?.breakables||garden?.breakables||empty.breakables},
  get spawn(){return stage?.spawn||V(0,0,8)},get bossSpawn(){return stage?.bossSpawn||V(0,.68,-12)},
  floorAt(x,z,fromY){return stage?stage.floorAt(x,z,fromY):(garden?.floorAt(x,z)??0)},
  isFatalFall(c){return stage?.isFatalFall?.(c)||false},ragdollSurfaceAt(x,z,fromY){return stage?.ragdollSurfaceAt?.(x,z,fromY)||null},get ragdollMaxSpeed(){return stage?.ragdollMaxSpeed||24},
  civilianBladeHits(a,b){return stage?.civilianBladeHits?.(a,b)||[]},hitCivilian(civilian){return stage?.hitCivilian?.(civilian)||false},
  cutCloth(a,b){return clothSystems.get(stage?.kind||'garden')?.cutSegment(a,b)||[]},
  interactCloth(dt,actors){clothSystems.get(stage?.kind||'garden')?.fixed(dt,actors);if(stage?.kind==='harbour')harbourSnow?.fixed(dt,actors)},
  fixed(dt,actors){stage?.fixed(dt,actors,world);if(!stage)bamboo?.fixed(dt)},velocity(c,v,dt){const result=stage?stage.velocity(c,v,dt):v;if(stage?.kind==='harbour'&&c.grounded&&harbourSnow?.sample(c.pos.x,c.pos.z,c.pos.y)>.035)result.multiplyScalar(.91);return result},groundImpact(p,heavy){return stage?.groundImpact(p,heavy)||false},
  update(time,dt){if(stage)stage.update(time,dt);else garden?.update(time,dt);clothSystems.get(stage?.kind||'garden')?.upload();if(stage?.kind==='harbour')harbourSnow?.upload()},
  reset(){garden?.reset();bamboo?.reset();harbourSnow?.reset();for(const s of cache.values())s.reset();for(const c of clothSystems.values())c.reset()}
 };return world;
}
