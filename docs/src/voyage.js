import {isReplacedSnow} from './snow-surfaces.js';
import {voyageSurface,voyageUV,reliefGeometry} from './voyage-surfaces.js';
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {V,boxAt,moveBody} from './physics.js';
import {pbr,planarUV} from './surface.js';
import {winterIceTextures} from './winter-ice.js';
import {ferryOcean} from './ferry-ocean.js';

export function buildVoyage(kind,cameraFade,refinement){
 const frozen=kind==='harbour',root=new T.Group(),solids=[],breakables=[],cargo=[],materials=[],icePatches=[],lamps=[];
 root.name=frozen?'Frozen Harbour':'The Night Ferry';let time=0,slips=new WeakMap();
 const mat=(name,color,roughness=.5,metalness=0)=>{const m=new T.MeshStandardMaterial({name,color,roughness,metalness});materials.push(m);return m};
 const steel=mat('Salt-weathered steel',0x273e47,.36,.7),red=mat('Oxide red paint',0x7b302e,.51,.25),cream=mat('Ivory enamel',0xc5c6b7,.39,.4),brass=mat('Marine brass',0xbe9a59,.32,.72),rubber=mat('Rubber fenders',0x17212a,.9),wood=mat('Wet marine cedar',0x78614d,.45),snow=mat('Powder snow',0xd6e5e9,.94),ice=mat('Blue harbour ice',0x5e929d,.17,.22),window=mat('Warm wheelhouse glass',0xdab36c,.22,.2);
 voyageSurface(wood,kind);window.emissive.setHex(0xffb366);window.emissiveIntensity=1.6;
 const boxGeo=new T.BoxGeometry(1,1,1),staticMeshes=[];
 function mesh(g,m,x=0,y=0,z=0,parent=root){const o=new T.Mesh(g,m);o.position.set(x,y,z);o.castShadow=m!==window&&m!==ice;o.receiveShadow=true;parent.add(o);if(parent===root)staticMeshes.push(o);return o}
 function box(x,y,z,w,h,d,m,solid=false,parent=root){const o=mesh(boxGeo,m,x,y,z,parent);o.scale.set(w,h,d);if(solid)solids.push({box:boxAt(x,y,z,w,h,d),material:m===wood?'wood':'metal',mesh:o});return o}
 function rod(a,b,r,m=steel,parent=root){const d=b.clone().sub(a),o=mesh(new T.CylinderGeometry(r,r,d.length(),8),m,...a.clone().add(b).multiplyScalar(.5).toArray(),parent);o.quaternion.setFromUnitVectors(V(0,1,0),d.normalize());return o}
 function rope(points,r=.028,m=rubber,parent=root){return mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points),24,r,5,false),m,0,0,0,parent)}
 function batchCargo(group){
  const byMaterial=new Map();group.updateMatrixWorld(true);
  for(const o of [...group.children]){o.updateMatrix();let g=o.geometry.clone().applyMatrix4(o.matrix);if(g.index)g=g.toNonIndexed();voyageUV(g,o.material);if(!byMaterial.has(o.material))byMaterial.set(o.material,[]);byMaterial.get(o.material).push(g);o.removeFromParent()}
  for(const [m,parts] of byMaterial){const o=new T.Mesh(mergeGeometries(parts),m);o.castShadow=o.receiveShadow=true;group.add(o);for(const g of parts)g.dispose()}
 }
 function light(x,y,z){
  if(frozen){
   // Grounded fallback fixture; the detailed Blender asset replaces this geometry.
   box(x,.15,z,.66,.3,.66,steel,true);rod(V(x,.3,z),V(x,y-.3,z),.085);
   box(x,y,z,.43,.57,.43,window);for(const dy of [-.34,.34])box(x,y+dy,z,.6,.10,.6,steel);
   for(const dx of [-.245,.245])for(const dz of [-.245,.245])rod(V(x+dx,y-.3,z+dz),V(x+dx,y+.3,z+dz),.025);
   box(x,y+.45,z,.76,.1,.76,snow);
  }else{box(x,y,z,.30,.40,.30,window);rod(V(x,y-.2,z),V(x,y-1.2,z),.045)}
  const l=new T.PointLight(0xffbd80,frozen?34:38,12,2);l.position.set(x,y,z);root.add(l);lamps.push(l)}
 function container(x,z,w=3,d=5,col=red){box(x,1.2,z,w,2.4,d,col,true);for(let i=0;i<13;i++)for(const sign of [-1,1])box(x+sign*(w/2+.016),1.2,z-d/2+.2+i*(d-.4)/12,.055,2.22,.055,steel);for(const sign of [-1,1]){box(x+sign*w*.25,1.2,z+d/2+.025,w*.47,2.2,.045,col);rod(V(x+sign*w*.21,.2,z+d/2+.09),V(x+sign*w*.21,2.15,z+d/2+.09),.025,brass)}}
 function boat(x,z,scale=1){const g=new T.Group();g.userData.voyageBoat=true;root.add(g);g.position.set(x,-.7,z);g.scale.setScalar(scale);
 const shape=new T.Shape();shape.moveTo(-1.25,3);shape.lineTo(-1.4,-2);shape.quadraticCurveTo(0,-5,1.4,-2);shape.lineTo(1.25,3);shape.closePath();const hull=mesh(new T.ExtrudeGeometry(shape,{depth:1.1,bevelEnabled:true,bevelSize:.12,bevelThickness:.12,bevelSegments:2,steps:1}),red,0,0,0,g);hull.rotation.x=Math.PI/2;
 box(0,.10,0,2.45,.18,5.3,wood,false,g);box(0,.8,1,1.9,1.4,1.8,cream,false,g);box(0,.96,2,1.55,.6,.03,window,false,g);box(0,1.56,1,2.2,.16,2.1,frozen?snow:steel,false,g);rod(V(0,1.6,.6),V(0,4,.6),.04,steel,g);rod(V(-1.3,3.3,.6),V(1.3,3.3,.6),.035,steel,g);for(const sign of [-1,1])rope([V(sign*1.1,.25,2.6),V(sign*1.25,.4,0),V(sign*.5,.25,-2.5)],.025,brass,g);
 return g;
 }
 const iceRadius=(a,seed)=>2.7*(.88+.075*Math.sin(a*3+seed)+.045*Math.sin(a*7-seed));
 const onPatch=(p,x,z)=>Math.hypot(x-p.x,z-p.z)<iceRadius(Math.atan2(z-p.z,x-p.x),p.seed);
 // Wide ocean grid: actual displaced vertices with analytic slope normals.
 const waterTime={value:0},seaChop={value:1},seaMat=new T.MeshPhysicalMaterial({name:'North sea swells',color:frozen?0x345b6c:0x153a4a,roughness:.24,metalness:.35,clearcoat:1});
 seaMat.onBeforeCompile=shader=>{shader.uniforms.seaTime=waterTime;shader.uniforms.seaChop=seaChop;shader.vertexShader='uniform float seaTime;uniform float seaChop;varying float crest;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>',`#include <beginnormal_vertex>
 float stormGain=1.+(seaChop>1.1?smoothstep(9.,18.,abs(position.x))*1.3:0.);
 float a=position.x*.35+position.z*.23+seaTime*1.4,b=position.x*-.24+position.z*.48-seaTime*1.05;
 objectNormal=normalize(vec3((-.42*.35*cos(a)+.20*.24*cos(b))*seaChop*stormGain,1.,(-.42*.23*cos(a)-.20*.48*cos(b))*seaChop*stormGain));`);shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
 float wave=.42*sin(position.x*.35+position.z*.23+seaTime*1.4)+.20*sin(position.x*-.24+position.z*.48-seaTime*1.05);transformed.y+=wave*seaChop*stormGain;crest=wave;`);shader.fragmentShader='uniform float seaChop;varying float crest;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n diffuseColor.rgb=mix(diffuseColor.rgb,(seaChop>1.1?vec3(.55,.66,.69):vec3(.30,.49,.54)),smoothstep(seaChop>1.1?.30:.40,seaChop>1.1?.59:.62,crest)*(seaChop>1.1?.85:.45));')};
 const seaGeo=new T.PlaneGeometry(180,180,160,160);seaGeo.rotateX(-Math.PI/2);const ocean=frozen?{geometry:seaGeo,material:seaMat}:ferryOcean(waterTime);if(!frozen){seaGeo.dispose();seaMat.dispose()}const water=mesh(ocean.geometry,ocean.material,0,frozen?-1.2:-1.8,0);water.name=frozen?'Harbour offshore water':'Ferry continuous ocean and wake';staticMeshes.pop();water.castShadow=false;water.frustumCulled=false;
 const animBoats=[];
 if(frozen){
  const sky=new T.Mesh(new T.SphereGeometry(170,32,20),new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{time:waterTime},vertexShader:'varying vec3 skyDir;void main(){skyDir=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`uniform float time;varying vec3 skyDir;
  float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
  void main(){vec3 d=normalize(skyDir);vec2 p=d.xz/(abs(d.y)+.23)*3.+vec2(time*.009,0.);float n=noise(p)*.52+noise(p*2.1)*.28+noise(p*4.2)*.14+noise(p*8.3)*.06;vec3 c=mix(vec3(.075,.10,.16),vec3(.19,.23,.30),smoothstep(.2,.83,n));c+=vec3(.022,.027,.031)*exp(-abs(d.y)*7.);gl_FragColor=vec4(c,1.);}`}));sky.name='Winter port layered cloud sky';sky.renderOrder=-10;root.add(sky);
 }

 if(!frozen){
  const skyMat=new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{time:waterTime},vertexShader:'varying vec3 skyDirection;void main(){skyDirection=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`uniform float time;varying vec3 skyDirection;
  float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
  void main(){vec3 d=normalize(skyDirection);vec2 p=d.xz/(abs(d.y)+.22)*2.4+vec2(time*.012,0.);float n=noise(p)*.56+noise(p*2.1)*.28+noise(p*4.3)*.16;vec3 c=mix(vec3(.003,.006,.010),vec3(.018,.028,.040),smoothstep(.32,.79,n));c+=vec3(.012,.018,.023)*exp(-abs(d.y)*9.);gl_FragColor=vec4(c,1.);}`});
  const sky=new T.Mesh(new T.SphereGeometry(145,40,24),skyMat);sky.name='Layered storm cloud sky';sky.renderOrder=-10;root.add(sky);
  const lamp=new T.PointLight(0xffb66e,30,16,2);lamp.position.set(0,2.8,-9.2);root.add(lamp);
  const interior=new T.PointLight(0xffce98,9,7,2);interior.position.set(0,7.15,-12.4);root.add(interior);
 }

 if(!frozen){
  // The play space is a stable ship-local frame; the sea, loose cargo and inertial forces convey the roll.
  box(0,-.6,0,18,1.2,32,steel);box(0,-.035,0,17.7,.07,31.8,steel);
  for(let i=-8;i<=8;i++)box(i,-.002,0,.035,.016,30,brass);
  for(const x of [-5.1,5.1])for(let z=-13;z<14;z+=2)box(x,.012,z,.1,.024,1.1,cream);
  for(const x of [-8.75,8.75]){box(x,.24,0,.20,.5,32,cream,true);for(let z=-15;z<=15;z+=1.5)rod(V(x,.4,z),V(x,1.3,z),.045,cream);for(const y of [.8,1.25])rod(V(x,y,-15.5),V(x,y,15.5),.04,cream)}
  for(const z of [-15.7,15.7]){box(0,.3,z,17.5,.6,.2,cream,true);rod(V(-8.7,1.25,z),V(8.7,1.25,z),.05,cream)}
  box(0,1.7,-12.5,8,3.4,5.5,cream,true);box(0,3.5,-12.5,8.8,.25,6,steel);for(let x=-3;x<=3;x+=1.5)box(x,2.2,-9.72,1.2,.85,.04,window);
  box(0,4.45,-13,5.5,1.8,3.5,steel);for(let x=-1.8;x<=1.8;x+=1.2)box(x,4.6,-11.23,.9,.8,.035,window);box(0,5.5,-13,6.1,.24,4,cream);
  rod(V(0,5.6,-13),V(0,8.6,-13),.08);rod(V(-2.5,7.2,-13),V(2.5,7.2,-13),.065);for(const x of [-2,2])light(x,6.4,-9.3);
  for(const x of [-7.5,7.5]){light(x,2.8,7);light(x,2.8,-5);const ring=mesh(new T.TorusGeometry(.39,.09,8,24),red,x,1.4,10);ring.rotation.y=Math.PI/2}
  container(-5.6,-5,2.5,4.5);container(5.7,-5,2.5,4,cream);
  for(const [x,z] of [[-2,2],[2,6],[1,-4]]){const g=new T.Group();root.add(g);g.position.set(x,0,z);box(0,.55,0,1.25,1.1,1.25,wood,false,g);for(const yy of [.12,.97])box(0,yy,0,1.3,.08,1.3,steel,false,g);for(const side of [-1,1]){for(let j=0;j<5;j++){box(side*.64,.55,(j-2)*.24,.045,.86,.20,wood,false,g);box((j-2)*.24,.55,side*.64,.20,.86,.045,wood,false,g)}rod(V(-.51,.2,side*.67),V(.51,.88,side*.67),.032,steel,g)}batchCargo(g);const c={box:boxAt(x,.55,z,1.3,1.1,1.3),material:'wood',mesh:g,breakable:true,broken:false,vx:0,initial:V(x,0,z)};solids.push(c);breakables.push(c);cargo.push(c)}
  for(const sign of [-1,1]){const b=boat(sign*13,sign*4,.8);animBoats.push(b);for(const z of [-5,4])rope([V(sign*13,.3,z),V(sign*10,2,z),V(sign*8.7,1,z)],.035,brass)}
  // Wake foam is shaded on the displaced ocean; no solid trail meshes.
 }else{
  box(0,-.16,0,35,.32,34,ice);for(const x of [-17.2,17.2])box(x,.32,0,.5,.64,34,snow,true);for(const z of [-17,16.5])box(0,.32,z,34,.64,.5,snow,true);
  for(const x of [-14,14]){box(x,.22,-1,5,.44,31,steel,true);for(let z=-14;z<=13;z+=3){rod(V(x-1,.5,z),V(x-1,1.05,z),.07,brass);rod(V(x+1,.5,z),V(x+1,1.05,z),.07,brass)}}
  for(const x of [-11,11]){const side=Math.sign(x);box(x,2.5,-11.5,8,5,7,red,true);const roofGeo=new T.BufferGeometry();roofGeo.setAttribute('position',new T.Float32BufferAttribute([-4.5,0,-4,0,1.5,-4,0,1.5,4,-4.5,0,-4,0,1.5,4,-4.5,0,4,0,1.5,-4,4.5,0,-4,4.5,0,4,0,1.5,-4,4.5,0,4,0,1.5,4],3));const rp=roofGeo.attributes.position;for(let t=0;t<rp.count;t+=3){const a=V().fromBufferAttribute(rp,t+1),b=V().fromBufferAttribute(rp,t+2);rp.setXYZ(t+1,b.x,b.y,b.z);rp.setXYZ(t+2,a.x,a.y,a.z)}roofGeo.computeVertexNormals();mesh(roofGeo,snow,x,5.05,-11.5);const gable=new T.BufferGeometry();gable.setAttribute('position',new T.Float32BufferAttribute([-4,0,3.5,4,0,3.5,0,1.4,3.5,4,0,-3.5,-4,0,-3.5,0,1.4,-3.5],3));gable.computeVertexNormals();mesh(gable,red,x,5,-11.5);for(let z=-14;z<=-9;z+=.45)box(x-side*4.02,2.5,z,.035,4.8,.045,cream);box(x,1.6,-7.96,3,3.2,.08,steel);for(const dx of [-2.6,2.6])box(x+dx,3.5,-7.94,1,.9,.04,window)}
  container(-7,1,3,5);container(7,6,3,5,steel);container(6,-3,3,4,cream);
  for(const [x,z] of [[-3,-4],[3,5],[-4,10]]){const radius=2.7,seed=x*.7+z;const patchGeo=new T.CircleGeometry(radius,64);for(let j=1;j<patchGeo.attributes.position.count;j++){const v=patchGeo.attributes.position,a=Math.atan2(-v.getY(j),v.getX(j)),r=iceRadius(a,seed);v.setXY(j,Math.cos(a)*r,-Math.sin(a)*r)}const patch=mesh(patchGeo,new T.MeshPhysicalMaterial({name:'Thin ice',color:0x568899,roughness:.09,metalness:.35,clearcoat:1}),x,.017,z);patch.rotation.x=-Math.PI/2;staticMeshes.pop();
   const pts=[];for(let i=0;i<9;i++){const a=i*2.399;let last=V(x,.025,z);for(let j=1;j<=5;j++){const p=V(x+Math.sin(a+Math.sin(i*17+j*4.3)*.13)*radius*j/5,.025,z+Math.cos(a+Math.sin(i*17+j*4.3)*.13)*radius*j/5);pts.push(...last.toArray(),...p.toArray());last=p}}
   const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pts,3));const cracks=new T.LineSegments(g,new T.LineBasicMaterial({color:0xe4faff,transparent:true,opacity:.17}));root.add(cracks);icePatches.push({x,z,radius,seed,mesh:patch,cracks,hits:0});
  }
  // Shared fracture, micro-normal and frost-roughness maps, baked once on entry.
  const iceTextures=winterIceTextures(),map=iceTextures.map;Object.assign(ice,iceTextures);ice.normalScale.set(.5,.5);ice.roughness=.43;ice.metalness=.3;ice.color.setHex(0xd3e3f2);const fadeCanvas=document.createElement('canvas');fadeCanvas.width=fadeCanvas.height=128;const fc=fadeCanvas.getContext('2d'),fg=fc.createRadialGradient(64,64,38,64,64,64);fg.addColorStop(0,'white');fg.addColorStop(1,'black');fc.fillStyle=fg;fc.fillRect(0,0,128,128);const iceFade=new T.CanvasTexture(fadeCanvas);for(const p of icePatches){p.mesh.material.alphaMap=iceFade;p.mesh.material.transparent=true;p.mesh.material.depthWrite=false;const patchMap=map.clone();patchMap.repeat.set(.18,.18);p.mesh.material.map=patchMap;p.mesh.material.roughnessMap=patchMap;p.mesh.material.color.setHex(0x9ac3d5)}
  for(const sign of [-1,1]){boat(sign*22,-1,1.7);boat(sign*25,15,1.25);for(const z of [-4,9])light(sign*10,3.5,z)}
  // Harbour gantry and hanging hook frame the boss's arrival.
  for(const x of [-5,5]){box(x,4.5,-15,.55,9,.65,steel,true);rod(V(x,5,-15),V(x*.5,8.5,-15),.12,brass)}box(0,9,-15,11,.65,.65,brass);rod(V(0,8.8,-15),V(0,4.3,-15),.04);const hook=mesh(new T.TorusGeometry(.4,.09,7,16,Math.PI*1.6),steel,0,4,-15);
  for(let i=0;i<24;i++){const x=Math.sin(i*7.13)*36,z=-28-Math.cos(i*3.1)*8;const g=new T.ConeGeometry(3+Math.sin(i)*1.5,5+i%4,5);mesh(g,snow,x,-.7,z)}
 }
 // Batch static geometry by material, preserving independent colliders and movable objects.
 const batches=new Map();root.updateMatrixWorld(true);for(const o of staticMeshes){if(!o.parent)continue;let g=o.geometry.clone().applyMatrix4(o.matrixWorld);if(g.index)g=g.toNonIndexed();for(const name of Object.keys(g.attributes))if(!['position','normal','uv'].includes(name))g.deleteAttribute(name);planarUV(g);if(!batches.has(o.material))batches.set(o.material,[]);batches.get(o.material).push(g);o.removeFromParent()}
 for(const [m,gs] of batches){const o=new T.Mesh(mergeGeometries(gs),m);o.name="VoyageBase_"+m.name;o.castShadow=m!==window&&m!==ice;o.receiveShadow=true;root.add(o);for(const g of gs)g.dispose()}
 cameraFade.add(materials.filter(m=>m!==ice));
 const flakeCount=frozen?1600:800,flakesGeo=new T.BufferGeometry(),flakePos=new Float32Array(flakeCount*3);for(let i=0;i<flakeCount;i++)flakePos.set([Math.sin(i*127.1)*23,(i*.731)%16,Math.cos(i*311.7)*23],i*3);flakesGeo.setAttribute('position',new T.BufferAttribute(flakePos,3));const flakes=new T.Points(flakesGeo,new T.PointsMaterial({color:0xe8f6ff,size:.065,transparent:true,opacity:.72,depthWrite:false}));flakes.visible=frozen;root.add(flakes);
 const initialBoat=animBoats.map(b=>b.position.clone());
 function update(t,dt){time=t;waterTime.value=t;for(let i=0;i<animBoats.length;i++){const b=animBoats[i];b.position.y=initialBoat[i].y+Math.sin(t*1.5+i)*.17;b.rotation.z=Math.sin(t*1.1+i)*.07}for(let i=0;i<lamps.length;i++)lamps[i].intensity=(frozen?34:38)+Math.sin(t*3+i)*.6;
  if(frozen){for(let i=0;i<flakeCount;i++){flakePos[i*3]+=dt*(.6+Math.sin(t+i)*.2);flakePos[i*3+1]-=dt*(.6+i%4*.1);if(flakePos[i*3+1]<0)flakePos[i*3+1]=16;if(flakePos[i*3]>23)flakePos[i*3]=-23}flakesGeo.attributes.position.needsUpdate=true}
 }
 function fixed(dt,actors,world){if(frozen)return;for(const c of cargo){if(c.broken)continue;const old=c.mesh.position.x;c.vx=(c.vx+Math.sin(time*1.2)*2.8*dt)*Math.exp(-.35*dt);c.mesh.position.x=T.MathUtils.clamp(old+c.vx*dt,-6.4,6.4);if(Math.abs(c.mesh.position.x)>=6.4)c.vx*=-.45;
   for(const other of solids){if(other===c||other.broken)continue;const b=other.box;if(b.max.y<=0||b.min.y>=1.1||c.mesh.position.z+.65<=b.min.z||c.mesh.position.z-.65>=b.max.z)continue;
    if(c.vx>0&&old+.65<=b.min.x+.001&&c.mesh.position.x+.65>b.min.x){c.mesh.position.x=b.min.x-.651;c.vx*=-.35}
    else if(c.vx<0&&old-.65>=b.max.x-.001&&c.mesh.position.x-.65<b.max.x){c.mesh.position.x=b.max.x+.651;c.vx*=-.35}
   }
   for(const a of actors)if(a.alive&&Math.abs(a.pos.y-1.1)<.03&&Math.abs(a.pos.x-old)<.8&&Math.abs(a.pos.z-c.mesh.position.z)<.8)moveBody(a,V(c.mesh.position.x-old,0,0),world);
   c.box.copy(boxAt(c.mesh.position.x,.55,c.mesh.position.z,1.3,1.1,1.3));
   for(const a of actors){if(!a.alive)continue;const p=a.pos;if(p.y<1.1&&p.x>c.box.min.x-a.radius&&p.x<c.box.max.x+a.radius&&p.z>c.box.min.z-a.radius&&p.z<c.box.max.z+a.radius){const side=c.vx>=0?1:-1;moveBody(a,V(side*.08,0,0),world)}}
  }}
 function velocity(c,v,dt){if(!c.grounded||c.state==='dodge'){slips.delete(c);return v}if(!frozen){if(c.pos.y<.3)v.x+=Math.sin(time*1.2)*.45;return v}
  const icy=icePatches.some(p=>p.hits<3&&onPatch(p,c.pos.x,c.pos.z));if(!icy){slips.delete(c);return v}let drift=slips.get(c);if(!drift){drift=v.clone();slips.set(c,drift)}drift.lerp(v,1-Math.exp(-2.2*dt));v.x=drift.x;v.z=drift.z;return v;
 }
 function groundImpact(p,heavy){if(!frozen||!heavy)return false;const patch=icePatches.find(a=>a.hits<3&&onPatch(a,p.x,p.z));if(!patch)return false;patch.hits++;patch.cracks.material.opacity=.2+patch.hits*.25;if(patch.hits===3){patch.mesh.material.roughness=.7;patch.mesh.material.color.setHex(0x9fbac5)}return true}
 function reset(){slips=new WeakMap();for(const c of cargo){c.broken=false;c.mesh.visible=true;c.mesh.position.copy(c.initial);c.vx=0;c.box.copy(boxAt(c.initial.x,.55,c.initial.z,1.3,1.1,1.3))}for(const p of icePatches){p.hits=0;p.cracks.material.opacity=.17;p.mesh.material.roughness=.09;p.mesh.material.color.setHex(0x9ac3d5)}}
 let assetInfo={loaded:false};
 if(refinement){
  for(const o of root.children)if((o.name.startsWith('VoyageBase_')&&o.material!==ice)||o.userData.voyageBoat)o.visible=false;
  const imported=refinement.clone(true);imported.updateMatrixWorld(true);const used=new Set(),groups=new Map(),boats=[];let sourceMeshes=0,addedColliders=0;
  imported.traverse(o=>{if(o.name.startsWith('FishingBoat_'))boats.push(o);if(o.userData.collisionSize){const p=o.getWorldPosition(V()),s=o.userData.collisionSize;solids.push({box:boxAt(p.x,p.y,p.z,...s),material:o.userData.collisionMaterial||'metal'});addedColliders++}});
  function batch(source,target,relative){const grouped=new Map();source.traverse(o=>{if(!o.isMesh||o.name.includes('Blue_harbour_ice')||o.name.includes('Blue harbour ice'))return;
   const ancestor=boats.find(b=>{let p=o.parent;while(p){if(p===b)return true;p=p.parent}return false});if(source===imported&&ancestor)return;
   if(!frozen&&/^(Bridge_access_ladder_rung|Bridge access ladder rung|Ladder_stile|Ladder stile)/.test(o.name))return;
   // Open both ladder exits in the original full-width roof railing.
   if(!frozen&&/^(Balcony_safety_rail|Balcony safety rail|Rail_stanchion|Rail stanchion)/.test(o.name)){const p=o.getWorldPosition(V());if(p.y>7.85&&Math.abs(p.z+9.69)<.15)return;}
   sourceMeshes++;let m=o.material;voyageSurface(m,kind);m.envMapIntensity=.95;
   if(!frozen&&m.name==='Storm clear bridge glass'){m.transparent=true;m.opacity=.12;m.depthWrite=false;m.side=T.FrontSide;m.roughness=.09;m.metalness=0;m.emissive.setHex(0);m.emissiveIntensity=0;}
   if(m.name==='Storm Japanese flag'&&!m.userData.windInstalled){m.userData.windInstalled=true;m.side=T.DoubleSide;m.onBeforeCompile=shader=>{shader.uniforms.flagTime=waterTime;shader.vertexShader='uniform float flagTime;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n transformed.z+=sin(position.x*3.4+flagTime*4.2+position.y)*.22*clamp((position.x-.4)/3.5,0.,1.);')};m.customProgramCacheKey=()=> 'storm-flag-wind-v1'}
   for(const key of ['map','normalMap','roughnessMap'])if(m[key])m[key].anisotropy=4;let g=o.geometry.clone().applyMatrix4(relative.clone().multiply(o.matrixWorld));if(g.index)g=g.toNonIndexed();
   if(frozen&&/snow/i.test(m.name)){
    const a=g.attributes.position,keep=[];
    for(let i=0;i<a.count;i+=3){const x=(a.getX(i)+a.getX(i+1)+a.getX(i+2))/3,y=(a.getY(i)+a.getY(i+1)+a.getY(i+2))/3,z=(a.getZ(i)+a.getZ(i+1)+a.getZ(i+2))/3;if(!isReplacedSnow(x,y,z))keep.push(i,i+1,i+2);}
    const trimmed=new T.BufferGeometry();for(const [key,a] of Object.entries(g.attributes)){const data=new Float32Array(keep.length*a.itemSize);keep.forEach((idx,j)=>{for(let k=0;k<a.itemSize;k++)data[j*a.itemSize+k]=a.array[idx*a.itemSize+k]});trimmed.setAttribute(key,new T.BufferAttribute(data,a.itemSize));}g.dispose();g=trimmed;if(!keep.length){g.dispose();return;}
   }
   for(const key of Object.keys(g.attributes))if(!['position','normal','uv'].includes(key))g.deleteAttribute(key);if(!g.attributes.uv)planarUV(g);voyageUV(g,m);({g,m}=reliefGeometry(g,m,o.name));used.add(m);
   // Sort individual panes independently instead of merging opposite sides of
   // the bridge into one transparent draw object.
   if(m.name==='Storm clear bridge glass'){const pane=new T.Mesh(g,m);pane.name=o.name;pane.castShadow=false;target.add(pane);return}
   if(!grouped.has(m))grouped.set(m,[]);grouped.get(m).push(g);
  });for(const [m,gs] of grouped){const mesh=new T.Mesh(mergeGeometries(gs),m);mesh.name='Blender detail • '+m.name;mesh.castShadow=m.emissiveIntensity<1;mesh.receiveShadow=true;target.add(mesh);for(const g of gs)g.dispose()}}
  const details=new T.Group();details.name='Blender maritime architecture';root.add(details);batch(imported,details,new T.Matrix4());
  animBoats.length=initialBoat.length=0;
  for(const b of boats){const g=new T.Group();g.name=b.name;b.matrixWorld.decompose(g.position,g.quaternion,g.scale);root.add(g);batch(b,g,b.matrixWorld.clone().invert());if(!frozen){animBoats.push(g);initialBoat.push(g.position.clone())}}
  cameraFade.add([...used]);assetInfo={loaded:true,sourceMeshes,materials:used.size,boats:boats.length,addedColliders};
 }
 if(!frozen){
  const access=new T.Group();access.name='Climbable bridge ladders and open roof exits';root.add(access);
  // Match the visible ship: solid bridge, balcony, and roof support the dismount.
  for(const [p,size] of [[[0,2.25,-12.65],[10.3,4.5,5.5]],[[0,4.6,-12.55],[11.5,.25,6]],[[0,7.77,-12.5],[10.4,.22,5.7]],[[0,9,-13.2],[.8,2.4,.8]]])solids.push({box:boxAt(...p,...size),material:'metal'});
  // Replace the top front railing with a centre section and clear ladder openings.
  for(const y of [8.02,8.52,8.95])rod(V(-4.3,y,-9.69),V(4.3,y,-9.69),.032,steel,access);
  for(const x of [-4.3,-3,-1.5,0,1.5,3,4.3])rod(V(x,7.9,-9.69),V(x,9.02,-9.69),.027,steel,access);
  solids.push({box:boxAt(0,8.43,-9.69,8.6,1.1,.07),material:'metal',searchlightTransparent:true});
  for(const side of [-1,1]){
   const x=side*4.8;
   for(let y=.5;y<8;y+=.32)rod(V(x-.2,y,-9.15),V(x+.2,y,-9.15),.023,brass,access);
   for(const dx of [-.24,.24]){rod(V(x+dx,.2,-9.15),V(x+dx,8.8,-9.15),.032,steel,access);for(const y of [.6,3.6,6.2])rod(V(x+dx,y,-9.15),V(x+dx,y,-9.9),.027,steel,access);}
  }
  batchCargo(access);
 }
 return {root,water,solids,breakables,update,fixed,velocity,groundImpact,reset,floorAt:(x,z)=>Math.abs(x)>(frozen?17.5:9)||z<(frozen?-17.5:-16.2)||z>(frozen?17:16.2)?-20:0,spawn:V(0,0,10),bossSpawn:V(0,0,-11),name:root.name,kind,weather:frozen?'snow':'rain',get state(){return {kind,assetInfo,cargo:cargo.map(c=>({x:c.mesh.position.x,z:c.mesh.position.z,broken:c.broken,vx:c.vx})),ice:icePatches.map(p=>({x:p.x,z:p.z,hits:p.hits})),snow:flakes.visible}}};
}
