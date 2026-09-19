import * as T from 'three';
import {RectAreaLightUniformsLib} from 'three/addons/lights/RectAreaLightUniformsLib.js';
import {createClothField} from './cloth-field.js';
import {poseArmTarget} from './ledge-climb.js';
import {introBeat,introBannerRow,introForward,INTRO_DURATION} from './intro-timeline.js';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z), smooth=x=>{x=T.MathUtils.clamp(x,0,1);return x*x*(3-2*x)};
function banner(parent,z,art){
 const scene=new T.Group();scene.name=art+' hanging banner';parent.add(scene);
 const cols=20,rows=30,width=2.5,top=3.15,height=3.05;
 // Concentrate two rows at the diagonal seam: cutting opens a fine, slanted
 // edge instead of deleting staircase-shaped chunks from a rectangular grid.
 const rowProfile=introBannerRow;
 const field=createClothField({cols,rows,width,height,top,z,wind:.055,seed:1,rowProfile});
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(field.position,3).setUsage(T.DynamicDrawUsage));
 const uv=[];for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++)uv.push(i/cols,1-rowProfile(i/cols,j/rows));
 geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex(new T.BufferAttribute(new Uint16Array(cols*rows*6),1));
 let resolveTexture,rejectTexture;const loaded=new Promise((resolve,reject)=>{resolveTexture=resolve;rejectTexture=reject});const map=new T.TextureLoader().load(`./assets/textures/banners/${art}.png`,resolveTexture,undefined,rejectTexture);map.colorSpace=T.SRGBColorSpace;map.anisotropy=8;
 const material=new T.MeshPhysicalMaterial({map,side:T.DoubleSide,roughness:.86,sheen:.65,sheenColor:0xe1b6a3,sheenRoughness:.8});
 const mesh=new T.Mesh(geometry,material);mesh.frustumCulled=false;mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);
 const brass=new T.MeshStandardMaterial({color:0x776047,metalness:.75,roughness:.38});
 const bar=new T.Mesh(new T.CylinderGeometry(.021,.021,2.76,12),brass);bar.rotation.z=Math.PI/2;bar.position.set(0,top+.07,z);scene.add(bar);
 for(const x of [-1.15,-.58,0,.58,1.15]){const ring=new T.Mesh(new T.TorusGeometry(.05,.009,6,16),brass);ring.position.set(x,top+.025,z);scene.add(ring)}
 for(const x of [-1.28,1.28]){const cord=new T.Mesh(new T.CylinderGeometry(.007,.007,10,6),brass);cord.position.set(x,top+5,z);scene.add(cord)}
 let revision=-1,cutProgress=0;
 function point(t){const u=t*cols,v=15,i=Math.min(cols-1,Math.floor(u)),j=Math.min(rows-1,Math.floor(v)),a=u-i,b=v-j,out=V();for(const [di,dj,w] of [[0,0,(1-a)*(1-b)],[1,0,a*(1-b)],[0,1,(1-a)*b],[1,1,a*b]])out.addScaledVector(V().fromArray(field.position,((j+dj)*(cols+1)+i+di)*3),w);return out.toArray()}
 function cut(to){for(let t=cutProgress;t<to-1e-6;t+=.02)field.cutSegment(point(t),point(Math.min(to,t+.02)),.002);cutProgress=Math.max(cutProgress,to)}
 function upload(){if(revision!==field.tearing.revision){revision=field.tearing.revision;geometry.index.array.fill(0);geometry.index.array.set(field.tearing.indices);geometry.index.needsUpdate=true;geometry.setDrawRange(0,field.tearing.indices.length)}geometry.attributes.position.needsUpdate=true;geometry.computeVertexNormals();}
 upload();return {group:scene,field,mesh,z,cut,upload,loaded,reset(){field.reset();cutProgress=0;upload()}};
}
// Menu actors live in an isolated scene and never enter the combat actor list.
export function createIntro(camera,storm,makeActor,playSound=()=>{}){
 const scene=new T.Scene();scene.name='Three banners · ink studio';scene.background=new T.Color(0xc9bfab);scene.fog=new T.Fog(0xc9bfab,8,24);
 RectAreaLightUniformsLib.init();scene.add(new T.HemisphereLight(0xffefdd,0x786557,2));
 const banners=[banner(scene,0,'vermilion-dragon'),banner(scene,-8,'indigo-crane'),banner(scene,-16,'vermilion-wave')];
 const cast=[makeActor(scene,'ninja'),makeActor(scene,'cyborg'),makeActor(scene,'hero')];cast[0].size=1.18;cast[0].root.scale.setScalar(1.18);
 for(let i=0;i<3;i++){
  const z=-i*8;
  for(const [color,power,p,w,h] of [[0xffe8d2,5,[-3,4,z+3],3,4],[0xdbe8f7,3,[3,3,z+1],2,4],[0xffe6c5,7,[1,3,z-2],2,3]]){const light=new T.RectAreaLight(color,power,w,h);light.position.fromArray(p);light.lookAt(0,1.4,z);scene.add(light)}
 }
 const floor=new T.Mesh(new T.PlaneGeometry(180,180),new T.MeshBasicMaterial({color:0xc9bfab}));floor.rotation.x=-Math.PI/2;floor.position.y=-.015;scene.add(floor);
 // A paper-coloured veil hides the loop reset without dimming the menu itself.
 const veil=document.createElement('div');veil.id='intro-veil';Object.assign(veil.style,{position:'fixed',inset:'0',background:'#c9bfab',pointerEvents:'none',opacity:'1'});document.getElementById('game').after(veil);
 const nameplate=document.createElement('div');nameplate.id='intro-name';nameplate.setAttribute('aria-hidden','true');document.getElementById('menu').append(nameplate);
 const castNames=['Akakage','Iron Ronin','Jysk Ninja'],nameAnchor=new T.Vector3();
 let elapsed=0,active=true,initialized=false,frozen=false,current=introBeat(0);
 storm.setPortraitMode(true);
 function pose(c,name,time,previous=null,blend=1,previousTime=0){if(c.activeClip!==name){c.mixer.stopAllAction();c.activeClip='';c.play(name,0)}c.action.time=Math.max(0,time)%c.action.getClip().duration;c.action.setEffectiveWeight(blend);if(previous){const a=c.actions[previous];if(blend<1){a.play().setEffectiveWeight(1-blend);a.time=Math.max(0,previousTime)%a.getClip().duration;}else a.stop();}c.visual(0,camera);c.tell.visible=false;c.bar.visible=false;c.shadow.material.color.setHex(0x514435);c.shadow.material.opacity=.15;}
 function slashPose(c,p){
  const s=c.size,z=c.pos.z;
  // Wind up behind the fabric; move the blade through only as the cut opens.
  const grip=V(T.MathUtils.lerp(-.23,.40,p)*s,T.MathUtils.lerp(1.56,.78,p)*s,z+T.MathUtils.lerp(-.18,.42*s,smooth(p)));
  poseArmTarget(c,'right',grip);poseArmTarget(c,'left',grip.clone().add(V(-.09,-.06,-.02).multiplyScalar(s)));
  const direction=V(T.MathUtils.lerp(-.65,.80,p),T.MathUtils.lerp(.9,-.7,p),.10).normalize();
  c.sword.quaternion.copy(c.bones.right_wrist.getWorldQuaternion(new T.Quaternion()).invert().multiply(new T.Quaternion().setFromUnitVectors(V(0,1,0),direction)));
  c.root.updateMatrixWorld(true);
 }
 function advance(dt){
  const previousElapsed=elapsed;elapsed+=dt;current=introBeat(elapsed);
  for(let i=0;i<3;i++){
   const c=cast[i],b=banners[i],local=elapsed-i*9.3,isHero=i===2;
   b.group.visible=isHero||local<9.3;
   c.root.visible=local>=1.5&&(i===2||local<10.5);c.shadow.visible=c.root.visible;
   c.pos.set(0,0,b.z+introForward(local));c.yaw=0;
   const slash=smooth((local-2)/.36);
   c.sword.visible=true;pose(c,local<3.4?'guard':'walk',local<3.4?.25:(local-3.4)*1.05);
   if(local>=1.5&&local<3.4)slashPose(c,slash);else c.sword.rotation.set(Math.PI/2,0,0);
   if(local>=2)b.cut(slash);
   if(!frozen){const start=i*9.3+2;if(previousElapsed<start&&elapsed>=start)playSound(i===1?'heavy':'slash',c.pos);if(previousElapsed<start+.14&&elapsed>=start+.14)playSound('cloth',c.pos);}
   const capsules=c.root.visible?c.capsules().map(p=>({a:p.a.toArray(),b:p.b.toArray(),r:p.r+.035})):[];
   b.field.step(dt,capsules);b.upload();
  }
  veil.style.opacity=String(current.veil);
 }
 function update(dt){if(!active||!initialized||frozen)return;let remain=Math.min(dt,.08);while(remain>1e-6){const h=Math.min(remain,1/60);if(elapsed+h>=INTRO_DURATION){elapsed=0;banners.forEach(b=>b.reset())}advance(h);remain-=h}if(dt===0)advance(0)}
 function frame(){if(!active)return;const mobile=camera.aspect<.85,distance=mobile?10.2:6.8;
  const push=current.cameraZ,d=distance;
  camera.fov=35;camera.updateProjectionMatrix();
  // Off-axis framing keeps all three panels collinear in the image as we dolly.
  // Moving the camera sideways would expose the next banner beside the first.
  const w=innerWidth,h=innerHeight;camera.setViewOffset(w,h,mobile?0:-w*.17,mobile?h*.08:0,w,h);
  const y=1.62;
  camera.position.set(0,y,push+d);camera.lookAt(0,y,push-2);camera.updateMatrixWorld(true);
  const index=current.index,c=cast[index],local=elapsed-index*9.3;
  // Screen-space caption follows the actor; keep it readable when feet crop out.
  const distanceToActor=camera.position.z-c.pos.z;
  const alpha=smooth((local-2.45)/.65)*smooth((distanceToActor-.9)/1.1)*(1-current.veil);
  nameplate.textContent=castNames[index];
  nameAnchor.copy(c.pos);nameAnchor.y=-.15;nameAnchor.project(camera);
  const menuTop=document.querySelector('.menu-copy').getBoundingClientRect().top;
  const bottom=mobile?Math.max(100,menuTop-54):h-75;
  nameplate.style.left=T.MathUtils.clamp((nameAnchor.x*.5+.5)*w,135,w-135)+'px';
  nameplate.style.top=T.MathUtils.clamp((-nameAnchor.y*.5+.5)*h+12,h*.56,bottom)+'px';
  nameplate.style.opacity=String(c.root.visible&&distanceToActor>.9?alpha:0);
 }
 function leave(){if(!active)return;active=false;veil.remove();nameplate.remove();cast.forEach(c=>{c.mixer.stopAllAction();c.root.visible=false});storm.setPortraitMode(false);camera.clearViewOffset();camera.fov=53;camera.updateProjectionMatrix()}
 return {scene,loaded:Promise.all(banners.map(b=>b.loaded)),update,frame,leave,start(){initialized=true;elapsed=0;update(0);frame()},get state(){return {active,elapsed,...current,actors:cast.map(c=>({visible:c.root.visible,clip:c.activeClip,pos:c.pos.toArray(),weights:Object.fromEntries(Object.entries(c.actions).filter(([,a])=>a.isRunning()&&a.getEffectiveWeight()>0).map(([n,a])=>[n,a.getEffectiveWeight()]))})),banners:banners.map(b=>b.field.state)}},seek(t){frozen=true;elapsed=0;banners.forEach(b=>b.reset());advance(0);for(let remaining=Math.max(0,t%INTRO_DURATION);remaining>1e-6;){const h=Math.min(1/60,remaining);advance(h);remaining-=h}frame();},play(){frozen=false}};
}
