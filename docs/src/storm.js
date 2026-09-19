import * as T from 'three';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {V} from './physics.js';
export function createStorm(scene,camera,world){
 let time=0,nextStrike=5.5,flashAge=99,flash=0,thunderAt=-1,muted=false,active=true,audio=null,rainGain=null,master=null,rainSource=null,thunderCount=0,strikeCount=0;
 let lensEnabled=true,lensPreview=false;
 const count=6000,positions=new Float32Array(count*6),colors=new Float32Array(count*6),rain=[];
 const rainGeo=new T.BufferGeometry();rainGeo.setAttribute('position',new T.BufferAttribute(positions,3));rainGeo.setAttribute('color',new T.BufferAttribute(colors,3));rainGeo.attributes.position.setUsage(T.DynamicDrawUsage);
 const rainMat=new T.LineBasicMaterial({color:0xb7d9ec,transparent:true,opacity:.40,vertexColors:true,depthWrite:false});const rainMesh=new T.LineSegments(rainGeo,rainMat);rainMesh.name='Wind-driven storm rain';rainMesh.frustumCulled=false;scene.add(rainMesh);
 function surface(x,z){let y=world.floorAt(x,z);if(y<0)y=.015;for(const s of world.solids){if(!s.broken&&x>s.box.min.x&&x<s.box.max.x&&z>s.box.min.z&&z<s.box.max.z)y=Math.max(y,s.box.max.y)}
  if(world.stage==='garden'&&Math.abs(x)<5.2&&z> -16.35&&z< -9.85)y=Math.max(y,3.75+.8*Math.pow(Math.max(0,1-Math.abs(x)/5.1),1.4)+.3*Math.pow(Math.abs(x)/5.1,7));return y;
 }
 for(let i=0;i<count;i++){rain.push({x:(Math.random()-.5)*44,y:Math.random()*20+.2,z:(Math.random()-.5)*44,speed:12+Math.random()*7,length:.32+Math.random()*.55,floor:0});const shade=.25+Math.random()*.60;colors.set([shade*.30,shade*.35,shade*.4,shade*.7,shade*.86,shade],i*6)}
 const splashes=Array.from({length:240},()=>({age:1,p:V()}));let splashIndex=0;
 const splashMesh=new T.InstancedMesh(new T.RingGeometry(.044,.064,10),new T.MeshBasicMaterial({color:0xa3c6d2,transparent:true,opacity:.24,depthWrite:false,side:T.DoubleSide}),splashes.length);splashMesh.name='Rain impact ripples';splashMesh.frustumCulled=false;scene.add(splashMesh);const dummy=new T.Object3D();
 const light=new T.DirectionalLight(0xc5ddff,0);light.position.set(-20,30,-30);scene.add(light);
 const boltGeo=new T.BufferGeometry();const boltMat=new T.LineBasicMaterial({color:new T.Color(0xd4e6ff).multiplyScalar(3),transparent:true,opacity:0,depthWrite:false});const bolt=new T.LineSegments(boltGeo,boltMat);bolt.name='Distant forked lightning';bolt.frustumCulled=false;scene.add(bolt);
 // Normal-map stamps refract only the scene beneath each lens bead. HUD stays crisp.
 const lens=document.createElement('canvas');lens.width=512;lens.height=Math.max(200,Math.round(512/ (innerWidth/innerHeight)));const ctx=lens.getContext('2d');
 const stamp=document.createElement('canvas');stamp.width=stamp.height=64;const sc=stamp.getContext('2d'),pixels=sc.createImageData(64,64);
 for(let y=0;y<64;y++)for(let x=0;x<64;x++){const nx=(x-31.5)/30,ny=(y-31.5)/30,r=Math.hypot(nx,ny),at=(y*64+x)*4,alpha=Math.max(0,Math.min(1,(1-r)*10));pixels.data[at]=128+nx*100;pixels.data[at+1]=128-ny*100;pixels.data[at+2]=Math.round(Math.pow(Math.max(0,r),5)*150);pixels.data[at+3]=Math.round(alpha*220)}sc.putImageData(pixels,0,0);
 const lensTexture=new T.CanvasTexture(lens);lensTexture.minFilter=T.LinearFilter;lensTexture.magFilter=T.LinearFilter;
 const lensPass=new ShaderPass({uniforms:{tDiffuse:{value:null},lensMap:{value:lensTexture},lensAspect:{value:innerWidth/innerHeight},lensStrength:{value:1}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`uniform sampler2D tDiffuse;uniform sampler2D lensMap;uniform float lensAspect,lensStrength;varying vec2 vUv;
 void main(){vec4 bead=texture2D(lensMap,vUv);vec2 normal=(bead.rg-.5)*2.;vec2 offset=normal*vec2(.007/lensAspect,.007)*bead.a*lensStrength;vec3 color=texture2D(tDiffuse,clamp(vUv+offset,vec2(.001),vec2(.999))).rgb;float rim=bead.b*bead.a;float highlight=max(0.,normal.y-normal.x*.45)*rim; color=color*(1.-rim*.12)+vec3(.12,.17,.20)*highlight*.50*lensStrength;gl_FragColor=vec4(color,1.);}`});
 const beads=[];let beadAt=.2,lensClock=1;
 function bead(initial=false){let x=Math.random();const y=initial?Math.random():-.05; // Fewer drops over the central combat area.
  if(x>.32&&x<.68&&Math.random()<.75)x=Math.random()<.5?.12+Math.random()*.16:.74+Math.random()*.15;
  beads.push({x,y,r:2.4+Math.random()*3.8,speed:.012+Math.random()*.038,life:7+Math.random()*8,drift:Math.random()*6,trail:Math.random()>.35});if(beads.length>30)beads.shift();
 }
 for(let i=0;i<18;i++)bead(true);
 function drawLens(dt){lensClock+=dt;if(lensClock<1/30)return;lensClock=0;ctx.clearRect(0,0,lens.width,lens.height);
  for(const b of beads){const x=b.x*lens.width,y=b.y*lens.height,stretch=1+b.speed*8;ctx.globalAlpha=Math.min(1,b.life/2)*.92;if(b.trail){ctx.globalAlpha*=.22;ctx.drawImage(stamp,x-b.r*.28,y-b.r*5,b.r*.56,b.r*5);ctx.globalAlpha=Math.min(1,b.life/2)*.92}ctx.drawImage(stamp,x-b.r,y-b.r*stretch,b.r*2,b.r*2*stretch)}ctx.globalAlpha=1;lensTexture.needsUpdate=true;
 }
 function unlockAudio(context){if(audio)return;audio=context;master=audio.createGain();master.gain.value=muted||!active?0:1;master.connect(audio.destination);
  const buffer=audio.createBuffer(1,audio.sampleRate*3,audio.sampleRate),data=buffer.getChannelData(0);let smooth=0;for(let i=0;i<data.length;i++){smooth=.85*smooth+.15*(Math.random()*2-1);data[i]=smooth*.6+(Math.random()*2-1)*.25}
  rainSource=audio.createBufferSource();rainSource.buffer=buffer;rainSource.loop=true;const hp=audio.createBiquadFilter();hp.type='highpass';hp.frequency.value=650;const lp=audio.createBiquadFilter();lp.type='lowpass';lp.frequency.value=6200;rainGain=audio.createGain();rainGain.gain.value=.10;rainSource.connect(hp);hp.connect(lp);lp.connect(rainGain);rainGain.connect(master);rainSource.start();
 }
 function thunder(){if(!audio||muted||!active)return;thunderCount++;const duration=4.8,buffer=audio.createBuffer(1,audio.sampleRate*duration,audio.sampleRate),a=buffer.getChannelData(0);let low=0;
  for(let i=0;i<a.length;i++){const t=i/audio.sampleRate;low=.96*low+.04*(Math.random()*2-1);const envelope=Math.min(1,t*24)*Math.exp(-t*.85);a[i]=(low*4+(Math.random()*2-1)*Math.exp(-t*10)*.25)*envelope*(.7+.3*Math.sin(t*9)**2)}
  const source=audio.createBufferSource();source.buffer=buffer;const filter=audio.createBiquadFilter();filter.type='lowpass';filter.frequency.value=650;const gain=audio.createGain();gain.gain.value=.65;source.connect(filter);filter.connect(gain);gain.connect(master);source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect()};source.start();
 }
 function strike(){strikeCount++;flashAge=0;nextStrike=time+12+Math.random()*13;thunderAt=time+.85+Math.random()*1.3;
  const x=(Math.random()-.5)*58,z=-43-Math.random()*12,pts=[];let prev=V(x,31,z);for(let i=1;i<=12;i++){const next=V(x+(Math.random()-.5)*3.4,31-i*1.7,z+(Math.random()-.5));pts.push(...prev.toArray(),...next.toArray());if(i===4||i===7){const branch=next.clone().add(V(Math.random()>.5?4:-4,-3,1));pts.push(...next.toArray(),...branch.toArray())}prev=next}boltGeo.setAttribute('position',new T.Float32BufferAttribute(pts,3));light.position.set(x,30,z);
 }
 function wetScene(){scene.traverse(o=>{if(!o.isMesh)return;for(const m of Array.isArray(o.material)?o.material:[o.material])if(!m.userData.gardenSurface&&/basalt|stone|granite|slate|cedar|lacquer/i.test(m.name)){m.roughness=Math.min(m.roughness,.43);m.envMapIntensity=.9}})}
 function setMuted(value){muted=value;if(master)master.gain.setTargetAtTime(muted||!active?0:1,audio.currentTime,.08)}
 function setActive(value){value=value&&world.weather==='rain';if(value===active)return;active=value;if(master)master.gain.setTargetAtTime(muted||!active?0:1,audio.currentTime,.12)}
 function update(dt){const dry=world.weather!=='rain';if(dry){rainMesh.visible=false;splashMesh.visible=false;bolt.visible=false;lensPass.enabled=lensEnabled&&lensPreview;light.intensity=0;if(lensPreview)updateLens(dt);return}if(active){rainMesh.visible=true;splashMesh.visible=true;bolt.visible=true;lensPass.enabled=lensEnabled}if(!active){if(lensPreview)updateLens(dt);return;}const ferry=world.stage==='ferry',activeCount=ferry?count:1450;rainGeo.setDrawRange(0,activeCount*2);time+=dt;flashAge+=dt;if(time>=nextStrike)strike();if(thunderAt>=0&&time>=thunderAt){thunderAt=-1;thunder()}
  flash=Math.exp(-flashAge*24)+.65*Math.exp(-Math.pow((flashAge-.13)*32,2))+.22*Math.exp(-Math.pow((flashAge-.28)*23,2));light.intensity=flash*3.7;boltMat.opacity=Math.min(1,flash);rainMat.opacity=(ferry?.27:.40)+flash*.10;
  for(let i=0;i<activeCount;i++){const p=rain[i];p.y-=p.speed*dt*(ferry?1.2:1);p.x+=(ferry?4.2:1.3)*dt;p.z+=.35*dt;let wrap=false;const dx=p.x-camera.position.x,dz=p.z-camera.position.z;if(dx>22){p.x-=44;wrap=true}else if(dx< -22){p.x+=44;wrap=true}if(dz>22){p.z-=44;wrap=true}else if(dz< -22){p.z+=44;wrap=true}if(wrap)p.floor=surface(p.x,p.z);
   if(p.y<=p.floor){world.basin.rain(p.x,p.z);if(i%3===0){const s=splashes[splashIndex++%splashes.length];s.age=0;s.p.set(p.x,p.floor+.024,p.z)}p.y=15+Math.random()*6;p.floor=surface(p.x,p.z)}
   positions.set([p.x,p.y,p.z,p.x-(ferry?.18:.055),p.y+p.length*(ferry?.70:1),p.z-(ferry?.08:.018)],i*6);
  }rainGeo.attributes.position.needsUpdate=true;
  for(let i=0;i<splashes.length;i++){const s=splashes[i];s.age+=dt;dummy.position.copy(s.p);dummy.rotation.set(-Math.PI/2,0,0);dummy.scale.setScalar(s.age<.32?(.4+s.age*5)*(1-s.age/.32):0);dummy.updateMatrix();splashMesh.setMatrixAt(i,dummy.matrix)}splashMesh.instanceMatrix.needsUpdate=true;
  updateLens(dt);
 }
 function updateLens(dt){beadAt-=dt;if(beadAt<=0){bead();beadAt=.32+Math.random()*.38}for(let i=beads.length-1;i>=0;i--){const b=beads[i];b.y+=b.speed*dt;b.x+=Math.sin(time*.7+b.drift)*dt*.002;b.life-=dt;if(b.life<=0||b.y>1.08)beads.splice(i,1)}drawLens(dt);}
 function resize(w,h){lens.height=Math.max(200,Math.round(512/(w/h)));lensPass.uniforms.lensAspect.value=w/h;lensClock=1;drawLens(0)}
 function reset(){for(const p of rain)p.floor=surface(p.x,p.z);beads.length=0;for(let i=0;i<18;i++)bead(true);nextStrike=time+5.5;thunderAt=-1;flashAge=99;light.intensity=0;boltMat.opacity=0;lensClock=1;drawLens(0)}
 drawLens(0);
 return {setLensOptions({enabled=true,strength=1,preview=false}){lensEnabled=enabled;lensPreview=preview;lensPass.uniforms.lensStrength.value=strength;},setPortraitMode(value){rainMesh.visible=!value;splashMesh.visible=!value;bolt.visible=!value;lensPass.enabled=!value;if(value)light.intensity=0;},lensPass,update,resize,reset,wetScene,unlockAudio,setMuted,setActive,strike,get state(){return {time,rainCount:world.stage==='ferry'?count:1450,lensDrops:beads.length,flash,strikeCount,thunderCount,thunderPending:thunderAt>=0,muted,active,audioReady:!!audio,rainGain:master?master.gain.value:0}}};
}
