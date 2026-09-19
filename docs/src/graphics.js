import * as T from 'three';
import {Reflector} from 'three/addons/objects/Reflector.js';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const noiseGLSL=`float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}`;
export function createGraphics(scene,renderer,world){
 const group=new T.Group();group.name='Rain atmosphere and contact effects';scene.add(group);group.visible=false;
 let time=0,enabled=false,paused=false,footCount=0,impactCount=0;
 // One reflection render serves the irregular puddles across the entire court.
 const shader={uniforms:{...T.UniformsUtils.clone(Reflector.ReflectorShader.uniforms),time:{value:0},ferry:{value:0},winter:{value:0}},vertexShader:`uniform mat4 textureMatrix;varying vec4 vReflection;varying vec2 vGround;void main(){vReflection=textureMatrix*vec4(position,1.);vGround=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`uniform sampler2D tDiffuse;uniform float time;uniform float ferry;uniform float winter;varying vec4 vReflection;varying vec2 vGround;${noiseGLSL}
 void main(){float field=noise(vGround*.63)+noise(vGround*1.7)*.24;float edge=mix(smoothstep(.59,.73,field),smoothstep(.45,.77,field)*.96+.04,ferry);float perimeter=smoothstep(0.,.45,5.4-abs(vGround.x))*smoothstep(0.,.5,11.5-abs(vGround.y));float alpha=mix(edge,.28+edge*.56,winter)*perimeter;if(alpha<.01)discard;vec2 uv=vReflection.xy/vReflection.w;vec2 ripple=vec2(sin(vGround.x*37.+time*3.)+sin(vGround.y*24.-time*2.),cos(vGround.y*41.+time*2.4))*.00065;vec2 q=uv+ripple*(1.-winter*.94)+ferry*(vec2(noise(vGround*13.2+time*.14),noise(vGround*17.3-time*.1))-.5)*.004;float blur=mix(.0018,.0036,ferry);vec3 c=texture2D(tDiffuse,q).rgb*.36;c+=texture2D(tDiffuse,q+vec2(blur,0.)).rgb*.16;c+=texture2D(tDiffuse,q-vec2(blur,0.)).rgb*.16;c+=texture2D(tDiffuse,q+vec2(0.,blur)).rgb*.16;c+=texture2D(tDiffuse,q-vec2(0.,blur)).rgb*.16;c*=mix(1.,.58+.65*noise(vGround*82.),max(ferry,winter));c=min(c,vec3(mix(2.,5.,ferry)))*mix(.60,.94,ferry);gl_FragColor=vec4(mix(vec3(.012,.022,.027),c,mix(.84,.96,ferry)),alpha*mix(mix(.32,.68,ferry),.44,winter));}`};
 const puddles=new Reflector(new T.PlaneGeometry(10.8,23),{textureWidth:768,textureHeight:512,clipBias:.002,multisample:0,shader});puddles.name='Irregular live-reflection puddles';puddles.rotation.x=-Math.PI/2;puddles.position.set(0,.048,.5);puddles.material.transparent=true;puddles.material.depthWrite=false;group.add(puddles);
 // Reflections use cached shadows and skip a redundant update when the game is paused.
 const reflect=puddles.onBeforeRender;let reflectedFrame=-1;
 puddles.onBeforeRender=function(r,s,c,...args){if(!enabled||(!this.userData.captureRefresh&&(paused||reflectedFrame===r.info.render.frame)))return;reflectedFrame=r.info.render.frame;const hidden=[];s.traverse(o=>{if(!o.visible)return;const m=o.material;if(o.isPoints||o.isLineSegments||(m&&!Array.isArray(m)&&/blossom|Bamboo leaves|Fine garden grass/.test(m.name))){hidden.push(o);o.visible=false}});try{reflect.call(this,r,s,c,...args)}finally{for(const o of hidden)o.visible=true}};
 const fogs=[];
 for(const [x,z,w,h,opacity] of [[-9,-2,10,2.4,.12],[9,-5,10,2.8,.12],[0,-17,35,4,.22],[0,-25,52,7,.26],[-10,10,9,1.5,.08],[11,12,9,1.8,.08]]){
  const m=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,uniforms:{time:{value:0},opacity:{value:opacity},tint:{value:new T.Color(0x74949e)}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`uniform float time;uniform float opacity;uniform vec3 tint;varying vec2 vUv;${noiseGLSL}void main(){float edge=sin(vUv.x*3.14159)*pow(sin(vUv.y*3.14159),2.);float n=noise(vUv*vec2(8.,3.)+vec2(time*.028,0.));gl_FragColor=vec4(tint,edge*opacity*(.25+n*.75));}`});
  const fog=new T.Mesh(new T.PlaneGeometry(w,h),m);fog.position.set(x,h*.40,z);group.add(fog);fogs.push(fog);
 }
 // Roof runoff starts at the modeled eaves rather than falling through the roof.
 const runoffPositions=new Float32Array(160*6),runoffGeo=new T.BufferGeometry();runoffGeo.setAttribute('position',new T.BufferAttribute(runoffPositions,3));const runoff=new T.LineSegments(runoffGeo,new T.LineBasicMaterial({color:0xa8d5e2,transparent:true,opacity:.28,depthWrite:false}));runoff.name='Roof eave runoff';group.add(runoff);
 const runoffDrops=Array.from({length:160},(_,i)=>({x:(i%2?1:-1)*(4.8+Math.random()*.25),z:-16+Math.random()*5.9,y:.7+Math.random()*3.35,speed:4+Math.random()*4}));
 const drops=[],dust=[];let stepTimes=new WeakMap();const dropMesh=new T.InstancedMesh(new T.IcosahedronGeometry(1,0),new T.MeshBasicMaterial({color:0xb8dbe1,transparent:true,opacity:.5,depthWrite:false}),240);dropMesh.count=0;dropMesh.frustumCulled=false;dropMesh.name='Footstep water droplets';group.add(dropMesh);const dummy=new T.Object3D();
 const sparkPos=new Float32Array(220*6),sparkCol=new Float32Array(220*6),sparkGeo=new T.BufferGeometry();sparkGeo.setAttribute('position',new T.BufferAttribute(sparkPos,3));sparkGeo.setAttribute('color',new T.BufferAttribute(sparkCol,3));sparkGeo.setDrawRange(0,0);const sparks=new T.LineSegments(sparkGeo,new T.LineBasicMaterial({vertexColors:true,transparent:true,opacity:.9,depthWrite:false,blending:T.AdditiveBlending}));sparks.name='Directional contact streaks';sparks.frustumCulled=false;group.add(sparks);
 const impactLight=new T.PointLight(0xffbb70,0,3,2);group.add(impactLight);let flash=0;
 function footstep(c,dt){
  if(!c.alive||!c.grounded||!['idle','block','dodge'].includes(c.state))return;
  let old=stepTimes.get(c);if(!old){old={pos:c.pos.clone(),at:time,side:0};stepTimes.set(c,old);return}
  const moved=old.pos.distanceTo(c.pos);if(moved<.26||time-old.at<.22)return;old.pos.copy(c.pos);old.at=time;old.side^=1;
  const p=c.bones[old.side?'left_ankle':'right_ankle'].getWorldPosition(V());
  if(Math.abs(p.x)>5.5&&!(p.x> -15&&p.x< -9&&p.z> -4&&p.z<6))return;
  p.y=Math.max(.05,world.floorAt(p.x,p.z)+.04);if(c.pos.y>.1)return;footCount++;
  for(let i=0;i<9;i++){const a=Math.random()*6.28,s=.35+Math.random();drops.push({p:p.clone(),v:V(Math.cos(a)*s,.5+Math.random(),Math.sin(a)*s),life:.28+Math.random()*.15})}if(drops.length>240)drops.splice(0,drops.length-240);
 }
 function impact(point,normal,kind='metal'){
  impactCount++;const metal=kind==='metal',stone=kind==='stone',color=new T.Color(metal?0xffbd69:stone?0xa1bfcb:0xad8051);const count=metal?28:stone?15:8;
  for(let i=0;i<count;i++){
   const v=normal.clone().multiplyScalar(1+Math.random()*3).add(V((Math.random()-.5)*3,Math.random()*2,(Math.random()-.5)*3));
   dust.push({p:point.clone(),v,life:metal?.15+Math.random()*.2:.2+Math.random()*.22,color:color.clone().multiplyScalar(metal?1.8:.7),metal});
  }
  if(dust.length>220)dust.splice(0,dust.length-220);impactLight.position.copy(point).addScaledVector(normal,.12);impactLight.color.set(metal?0xffbc75:0xb3d5e3);flash=metal?2.5:.55;
 }
 function update(dt,actors=[],mode='playing'){
  paused=mode==='paused';enabled=mode!=='menu';group.visible=enabled;puddles.visible=['garden','ferry','harbour'].includes(world.stage);runoff.visible=world.stage==='garden';if(!enabled)return;if(mode==='paused')return;
  time+=dt;puddles.material.uniforms.time.value=time;puddles.material.uniforms.ferry.value=world.stage==='ferry'?1:0;puddles.material.uniforms.winter.value=world.stage==='harbour'?1:0;puddles.scale.set(world.stage==='harbour'?3.18:world.stage==='ferry'?1.59:1,world.stage==='harbour'?1.45:world.stage==='ferry'?1.35:1,1);for(const f of fogs){f.visible=world.stage!=='shinkansen';f.material.uniforms.time.value=time};
  if(world.stage!=='shinkansen')for(const c of actors)footstep(c,dt);
  for(let i=0;i<runoffDrops.length;i++){const p=runoffDrops[i];p.y-=p.speed*dt;if(p.y<.7)p.y=4.03;runoffPositions.set([p.x,p.y,p.z,p.x+.018,p.y+.14,p.z],i*6)}runoffGeo.attributes.position.needsUpdate=true;
  for(let i=drops.length-1;i>=0;i--){const d=drops[i];d.life-=dt;d.v.y-=6*dt;d.p.addScaledVector(d.v,dt);if(d.life<=0||d.p.y<.046)drops.splice(i,1)}
  for(let i=0;i<drops.length;i++){const d=drops[i];dummy.position.copy(d.p);dummy.scale.set(.012,.025,.012);dummy.quaternion.setFromUnitVectors(V(0,1,0),d.v.clone().normalize());dummy.updateMatrix();dropMesh.setMatrixAt(i,dummy.matrix)}dropMesh.count=drops.length;dropMesh.instanceMatrix.needsUpdate=true;
  for(let i=dust.length-1;i>=0;i--){const d=dust[i];d.life-=dt;d.v.y-=8*dt;d.p.addScaledVector(d.v,dt);if(d.life<=0)dust.splice(i,1)}
  for(let i=0;i<dust.length;i++){const d=dust[i],tail=d.p.clone().addScaledVector(d.v,d.metal?-.024:-.009),col=d.color.clone().multiplyScalar(Math.min(1,d.life*7));d.p.toArray(sparkPos,i*6);tail.toArray(sparkPos,i*6+3);col.toArray(sparkCol,i*6);col.multiplyScalar(.15).toArray(sparkCol,i*6+3)}sparkGeo.attributes.position.needsUpdate=true;sparkGeo.attributes.color.needsUpdate=true;sparkGeo.setDrawRange(0,dust.length*2);flash*=Math.exp(-23*dt);impactLight.intensity=flash;
 }
 return {update,impact,puddles,reset(){stepTimes=new WeakMap();footCount=impactCount=0;drops.length=dust.length=0;dropMesh.count=0;sparkGeo.setDrawRange(0,0);flash=0;impactLight.intensity=0},get state(){return {enabled,puddleResolution:[768,512],mistLayers:fogs.length,roofStreams:runoffDrops.length,footstepSplashes:footCount,activeDrops:drops.length,impacts:impactCount,activeSparks:dust.length}}};
}
