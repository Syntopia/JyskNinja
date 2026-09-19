import {INTRO_MODELS,LEVEL_MODELS,createResourceCache,restoreLevelEnergy,trackLoadingManager} from './level-loading.js';
import {createLoadingUI,loadingPaint} from './loading-ui.js';
import {createScreenshots} from './screenshot.js';
import {blocksSword} from './civilian-combat.js';
import {CAMPAIGN,CHAPTERS} from './campaign.js';
import {loadLanternStreet} from './lantern-street-stage.js';
import {createBridgeAmbush,AMBUSH_PERCHES} from './street-ambush.js';
import {createSceneTransition,transitionBeat,TRANSITION_SWITCH} from './scene-transition.js';
import {createCombatAudio} from './combat-audio.js';
import {nearestLadder,ladderRoute,beginLadder,cancelLadder,stepLadder} from './ladder-climb.js';
import {createSearchlight} from './searchlight.js';
import {SearchlightVolumePass} from './searchlight-volume.js';
import {findLedge,enemyClimbRoute,beginClimb,cancelClimb,stepClimb} from './ledge-climb.js';
import {createRagdoll,clearRagdoll} from './ragdoll.js';
import {createDeathCinematic} from './death-cinematic.js';
import {createCameraFX} from './camera-fx.js';
import {createImpactPost} from './impact-post.js';
import {createGraphics} from './graphics.js';
import {createMusic} from './music.js';
import {createAnnouncer} from './announcer.js';
import * as T from 'three';
import {createIntro} from './intro.js';
import {createStorm} from './storm.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {GLTFLoader} from './asset-loader.js';
import {detachRegion,restoreCharacter,createImpactEffects} from './severing.js';
import {profiles,chooseGait} from './enemy-motion.js';
import {buildWorld} from './world.js';
import {placeFollowCamera} from './camera.js';
import {createCharacter} from './character.js';
import {prepareArmedClips} from './warlord.js';
import {V,moveBody,separateBodies,segmentDistance,segmentBox,sweptBlade} from './physics.js';
const $=id=>document.getElementById(id),canvas=$('game');
const loading=createLoadingUI(),assetRequests=trackLoadingManager(T.DefaultLoadingManager),modelCache=createResourceCache(),levelCache=createResourceCache(),preparedLevels=new Set();
const modelPath=url=>url.replace(/^\.\//,'');
const loadModel=url=>modelCache.get(modelPath(url),()=>new GLTFLoader().loadAsync('./'+modelPath(url)));
async function readJSON(url){const response=await fetch(url);if(!response.ok)throw new Error(`Could not load ${url}: ${response.status}`);return response.json();}
// Fictional campaign setting; shared by travel cards and direct scene entries.
const sceneSettings={
 'lantern-street':{year:1820,location:'Kyoto · Castle Quarter'},
 garden:{year:1820,location:'Kyoto · Japan'},
 ferry:{year:2036,location:'Tsugaru Strait · Japan'},
 harbour:{year:2036,location:'Hakodate · Hokkaido'},
 shinkansen:{year:2036,location:'Shizuoka · Japan'}
};
const bridgeAmbush=createBridgeAmbush();
const requestedChapter=Math.max(1,CAMPAIGN.findIndex(s=>s.id===new URLSearchParams(location.search).get('scene'))+1);
const sceneSetting=kind=>`${sceneSettings[kind].year} — ${sceneSettings[kind].location}`;
const renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
const scene=new T.Scene();scene.fog=new T.FogExp2(0x2e4857,.026);const camera=new T.PerspectiveCamera(53,innerWidth/innerHeight,.08,220);
const ambientFill=new T.HemisphereLight(0xc6d7f1,0x465754,1.25);scene.add(ambientFill);const moonlight=new T.DirectionalLight(0xc6d8ff,2.3);moonlight.position.set(-16,25,-12);moonlight.castShadow=true;moonlight.shadow.mapSize.set(2048,2048);Object.assign(moonlight.shadow.camera,{left:-23,right:23,top:23,bottom:-23,near:.5,far:65});moonlight.shadow.bias=-.0002;moonlight.shadow.normalBias=.025;scene.add(moonlight,moonlight.target);const fill=new T.DirectionalLight(0xf6d2aa,.45);fill.position.set(8,9,16);scene.add(fill);
const composer=new EffectComposer(renderer);composer.setSize(innerWidth,innerHeight);
const loadingScene=new T.Scene();loadingScene.background=new T.Color(0xc9bfab);const renderPass=new RenderPass(loadingScene,camera);composer.addPass(renderPass);
const bloom=new UnrealBloomPass(new T.Vector2(innerWidth,innerHeight),.28,.55,1.15);composer.addPass(bloom);composer.addPass(new OutputPass());
// Camera FX configures the depth targets and switchable post-process AA below.
renderer.info.autoReset=false;
const world=buildWorld(scene),impactFX=createImpactEffects(scene,world),storm=createStorm(scene,camera,world),clock=new T.Clock();let intro;let mode='menu',ready=false,player,template,bossTemplate,warlordTemplate,warlordClips,warlordRig,samuraiTemplate,samuraiClips,samuraiRig,maskedTemplate,maskedClips,maskedRig,clips,enemies=[],actors=[],wave=0,kills=0,nextWave=-1,simTime=0,accumulator=0,camYaw=.3,camPitch=.29,camDistance=5.8,shake=0,hitStop=0,combo=0,lastHit=-10,muted=false,lastContact='',contactTime=0,bannerUntil=0;
composer.insertPass(storm.lensPass,2);
const impactPost=createImpactPost(camera);composer.insertPass(impactPost.pass,2);
const graphics=createGraphics(scene,renderer,world);
let travel=null,resumeMode='playing';const travelFX=createSceneTransition();
const music=createMusic();
const announcer=createAnnouncer(speaking=>music.setDucked(speaking));
function syncMusic(){announcer.setState(mode!=='paused'&&!document.hidden,muted);music.setState(mode!=='paused'&&!document.hidden,muted);combatAudio.setState(mode!=='paused'&&!document.hidden,muted)}
// Start sound only after a real user gesture, including the intro controls.
window.addEventListener('click',()=>{syncMusic();music.unlock();combatAudio.unlock()});
window.addEventListener('keydown',()=>{syncMusic();music.unlock();combatAudio.unlock()});
const keys=new Set(),pressed=new Set(),mouse={block:false},stats={civilianKills:0,swordHits:0,worldHits:0,blocks:0,parries:0,dodges:0,jumps:0,damageTaken:0,attacks:0,severs:0};
const searchlightVolume=new SearchlightVolumePass(camera);
const cameraFX=createCameraFX({renderer,composer,camera,world,bloom,storm,impactPost,searchlightVolume,clearInput(){keys.clear();pressed.clear();mouse.block=false}});
const screenshots=createScreenshots({renderer,composer,renderPass,cameraFX,ready:()=>ready,label:()=>showingIntro()?'intro':world.stage,onCaptured(){clock.getDelta();fpsStart=performance.now();fpsFrames=0;}});
const deathCinematic=createDeathCinematic(composer);let endTimer=null,deathCameraTarget=null;
const clan=[{name:'The Vermilion Clan',color:0x843e50,label:'Vermilion',count:3},{name:'The Jade Covenant',color:0x286d68,label:'Jade',count:4},{name:'The Violet Watch',color:0x655184,label:'Violet',count:5}];
const combatAudio=createCombatAudio(camera,context=>storm.unlockAudio(context));
function sound(kind,point=null,options){combatAudio.play(kind,point,options)}
const particles=[],debris=[];const pg=new T.BufferGeometry();const pp=new Float32Array(600*3),pc=new Float32Array(600*3);pg.setAttribute('position',new T.BufferAttribute(pp,3));pg.setAttribute('color',new T.BufferAttribute(pc,3));pg.setDrawRange(0,0);const sparks=new T.Points(pg,new T.PointsMaterial({size:.06,vertexColors:true,transparent:true,opacity:.9,depthWrite:false,blending:T.AdditiveBlending}));scene.add(sparks);
function burst(point,color=0xf3bc76,count=15){const col=new T.Color(color);for(let i=0;i<count;i++)particles.push({p:point.clone(),v:V((Math.random()-.5)*3,Math.random()*3+.4,(Math.random()-.5)*3),life:.35+Math.random()*.35,max:.7,col});if(particles.length>580)particles.splice(0,particles.length-580)}
function effects(dt){impactFX.update(dt);for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life-=dt;if(p.life<=0){particles.splice(i,1);continue}p.v.y-=7*dt;p.p.addScaledVector(p.v,dt)}for(let i=0;i<particles.length;i++){const p=particles[i];p.p.toArray(pp,i*3);p.col.clone().multiplyScalar(p.life/p.max).toArray(pc,i*3)}pg.attributes.position.needsUpdate=true;pg.attributes.color.needsUpdate=true;pg.setDrawRange(0,particles.length);for(let i=debris.length-1;i>=0;i--){const d=debris[i];d.life-=dt;d.v.y-=16*dt;d.o.position.addScaledVector(d.v,dt);d.o.rotation.x+=dt*3;d.o.rotation.z+=dt*2;if(d.o.position.y<.1){d.o.position.y=.1;d.v.y=Math.abs(d.v.y)*.35;d.v.x*=.94;d.v.z*=.94}if(d.life<.6)d.o.scale.multiplyScalar(Math.pow(.08,dt));if(d.life<=0){d.o.removeFromParent();d.o.geometry.dispose();d.o.material.dispose();debris.splice(i,1)}}}
function breakCrate(c,point){sound('break',point);c.broken=true;c.mesh.visible=false;burst(point,0xe7b87e,23);const center=c.box.getCenter(V());for(let i=0;i<5;i++){const o=new T.Mesh(new T.BoxGeometry(.32,.17,.26),new T.MeshStandardMaterial({color:0x65505b,roughness:.9}));o.position.copy(center);o.castShadow=true;scene.add(o);debris.push({o,v:V((Math.random()-.5)*4,2+Math.random()*2,(Math.random()-.5)*4),life:3})}}
function notify(text,seconds=1){lastContact=text;contactTime=simTime+seconds;$('contact').textContent=text}
function banner(title,small='',seconds=2.8){$('banner').classList.remove('scene-intro');$('banner-title').textContent=title;$('banner-small').textContent=small;bannerUntil=simTime+seconds;$('banner').style.opacity=1}
function yawToward(c,target){const d=target.clone().sub(c.pos);return Math.atan2(d.x,d.z)}
function turn(c,to,dt,rate=13){c.yaw+=Math.atan2(Math.sin(to-c.yaw),Math.cos(to-c.yaw))*Math.min(1,dt*rate)}
function forward(c){return V(Math.sin(c.yaw),0,Math.cos(c.yaw))}
function nearestTarget(limit=12,cone=false){let best=null,dmin=limit;for(const e of enemies){if(!e.alive)continue;const d=e.pos.clone().sub(player.pos),dist=d.length();if(cone&&d.normalize().dot(forward(player))<.35)continue;if(dist<dmin){best=e;dmin=dist}}return best}
function enter(c,state,duration=0){c.state=state;c.timer=0;c.duration=duration;c.queued=false}
function slash(c,heavy=false){if(!c.alive||['climb','ladder'].includes(c.state)||c.severed.has('right_arm')||c.state==='stun'||c.state==='dodge')return false;if(c.state==='attack'){if(c.timer>.23)c.queued=true;return false}const cost=heavy?28:14;if(c.stamina<cost){if(!c.enemy)notify('Recover your stamina');return false}c.stamina-=cost;c.regenDelay=.7;c.heavy=heavy;enter(c,'attack',heavy?1.02:.72);c.hitSet.clear();c.previousBlade=null;c.swingBlocked=false;c.play('sword',.055,clips.sword.duration/c.duration,true);if(!c.enemy){stats.attacks++;const target=nearestTarget(2.8,true);if(target)c.yaw=yawToward(c,target.pos)}c.swingSound=false;return true}
function dodge(c,dir){if(!c.alive||c.stamina<24||c.state==='stun'||c.state==='dodge'||!c.grounded)return false;c.stamina-=24;c.regenDelay=.6;enter(c,'dodge',.62);c.moveDir.copy(dir.lengthSq()>.01?dir:forward(c));c.yaw=Math.atan2(c.moveDir.x,c.moveDir.z);c.play('roll',.055,clips.roll.duration/.62,true);c.invuln=.39;c.previousBlade=null;if(!c.enemy)stats.dodges++;sound('dodge',c.pos);return true}
function jump(c){if(!c.grounded||!c.alive||['attack','stun','dodge'].includes(c.state))return;enter(c,'jump');c.vy=world.stage==='shinkansen'?9.2:8.2;c.grounded=false;c.play('jumpStart',.07,3.5,true);if(!c.enemy)stats.jumps++;sound('jump',c.pos)}
function killCharacter(c,{point=null,impulse=V(),reason='combat'}={}){
 if(!c.alive)return false;
 sound(c.boss?'mech-death':'death',point||c.pos,{gain:c.enemy?.95:1.2});
 cancelClimb(c);cancelLadder(c);c.alive=false;c.hp=0;c.block=false;c.previousBlade=null;c.queued=false;c.deadTime=0;c.deathReason=reason;enter(c,'dead');
 c.root.position.copy(c.pos);c.root.rotation.y=c.yaw;c.root.updateMatrixWorld(true);
 c.ragdoll=createRagdoll(c,world,{point,impulse});c.ragdoll.apply();trail(c,null);
 if(c.enemy){kills++;if(point)burst(point,0xfad795,20)}else endRun(false);
 return true;
}
function hurt(target,attacker,point,part,region=null){
 if(!target.alive||target.invuln>0||(target===player&&cameraFX.panelOpen))return 'evaded';const toward=attacker.pos.clone().sub(target.pos).normalize(),facing=toward.dot(forward(target));
 if(target.block&&facing>.1&&target.stamina>=12){const parry=target.blockTime<.23;target.stamina-=parry?3:17;target.regenDelay=.5;attacker.swingBlocked=true;burst(point,parry?0xf6edbf:0x9adee8,8);graphics.impact(point,toward,'metal');sound(parry?'parry':'block',point);if(parry){enter(attacker,'stun',.85);attacker.play('hit',.06,1,true);if(!target.enemy){stats.parries++;notify('PARRY · opening created');target.stamina=Math.min(100,target.stamina+13)}}else{if(!target.enemy){stats.blocks++;notify('STEEL BLOCK')}attacker.knock.addScaledVector(toward,-1.2);enter(attacker,'stun',.24);attacker.play('hit',.045,1.2,true)}shake=.06;return 'blocked'}
 const amount=(attacker.boss?(attacker.heavy?45:30):(attacker.heavy?44:26))*(part==='head'?1.2:1);target.hp=Math.max(0,target.hp-amount);target.invuln=.20;target.knock.addScaledVector(toward,-(attacker.heavy?3.4:1.8));impactFX.splash(point,toward.clone().negate(),target.boss);if(target.boss){burst(point,0xf2c89a,8);graphics.impact(point,toward,'metal');}sound(target.boss?'mech-hit':'hit',point,{gain:attacker.heavy?1.15:.9});shake=attacker.enemy?(attacker.heavy?.19:.09):0;hitStop=.035;
 if(!attacker.enemy){stats.swordHits++;combo=simTime-lastHit<2.5?combo+1:1;lastHit=simTime;notify(`${part==='head'?'HEAD':'BLADE'} CONTACT · ${Math.round(amount)}`);$('combo').textContent=combo>1?`${combo} hit chain`:''}
 if(!target.enemy){stats.damageTaken+=amount;$('damage').style.opacity=.65;setTimeout(()=>$('damage').style.opacity=0,180)}
 // Sever only the region touched by the blade, after guard and invulnerability checks.
 const canSever=region&&(attacker.heavy||target.hp<=0)&&(!target.boss||target.hp<=0);
 if(canSever){const fragment=detachRegion(target,region);if(fragment){sound(target.boss?'metal':'cloth',point);impactFX.add(fragment,toward.clone().negate());impactFX.splash(point,toward.clone().negate(),target.boss,true);if(!attacker.enemy){stats.severs++;announcer.say(region==='head'?'headchop':'armchop');}notify(region==='head'?'HEAD SEVERED':region==='right_arm'?'SWORD ARM SEVERED':'ARM SEVERED',1.5);if(region==='head'||(!target.enemy&&region==='right_arm'))target.hp=0;target.block=false;target.previousBlade=null;}}
 if(!attacker.enemy)impactPost.trigger(point,{heavy:attacker.heavy,lethal:target.hp<=0});
 if(target.hp<=0){killCharacter(target,{point,impulse:toward.clone().multiplyScalar(attacker.heavy?-3.2:-2.1).add(V(0,.8,0))})}else{enter(target,'stun',target.boss?(attacker.heavy?.28:.13):attacker.heavy?.5:.28);target.play(part==='head'?'hitHead':'hit',.035,1,true)}return 'hit';
}
function contact(c){
 if(c.severed.has('right_arm')){c.previousBlade=null;trail(c,null);return}const current=c.blade(),progress=c.timer/c.duration,active=c.state==='attack'&&progress>.18&&progress<.82&&!c.swingBlocked;
 if(active&&!c.swingSound){sound(c.heavy?'heavy':'slash',c.pos);c.swingSound=true;}
 if(!active){c.previousBlade=current;trail(c,null);return}
 // A grounded heavy swing transmits its impact through the planted foot into thin ice.
 if(!c.enemy&&c.heavy&&c.grounded&&progress>.55&&!c.hitSet.has('ice-ground')){const foot=c.bones.right_ankle.getWorldPosition(V()),floor=world.floorAt(foot.x,foot.z);if(foot.y-floor<.28&&world.groundImpact(foot,true)){c.hitSet.add('ice-ground');foot.y=floor+.025;burst(foot,0xc7efff,24);impactPost.trigger(foot,{heavy:true});sound('ice',c.pos);notify('ICE FRACTURED')}}
 const previous=c.previousBlade||current;const opponents=c.enemy?[player]:enemies;const targets=opponents.filter(e=>e.alive&&!c.hitSet.has(e)&&e.pos.distanceTo(c.pos)<3.7*Math.max(c.size,e.size)).map(e=>({e,parts:e.capsules()}));
 sweptBlade(previous,current,(a,b)=>{
  const hits=[];for(const w of world.solids){if(!blocksSword(w)||(w.bamboo&&(!w.bamboo.cut||c.hitSet.has(w.bamboo))))continue;const p=segmentBox(a,b,w.box,.02);if(p)hits.push({distance:p.distanceTo(a),p,w})}
  if(Math.min(a.y,b.y)<.035){const t=(a.y-.035)/(a.y-b.y);if(t>=0&&t<=1){const p=a.clone().lerp(b,t);hits.push({distance:p.distanceTo(a),p,w:{material:'stone',ground:true}})}}
  for(const {e,parts} of targets){if(c.hitSet.has(e))continue;for(const p of parts){const q=segmentDistance(a,b,p.a,p.b);if(q.distance<p.r+.022){hits.push({distance:q.point.distanceTo(a),p:q.point,e,part:p.part,region:p.region});}}}
  if(!c.enemy)hits.push(...world.civilianBladeHits(a,b).filter(h=>!c.hitSet.has(h.civilian)));
  if(world.bamboo)hits.push(...world.bamboo.bladeHits(a,b));
  hits.sort((a,b)=>a.distance-b.distance);
  // Fabric cuts use the same swept blade as combat, clipped at solid scenery.
  const wall=hits.find(h=>h.w),cutEnd=wall?wall.p:b;
  for(const h of world.cutCloth(a,cutEnd))if(!c.hitSet.has(h.panel)){c.hitSet.add(h.panel);sound('cloth',h.point);burst(h.point,0xecd5ae,5);if(!c.enemy)notify('CLOTH CUT')}

  for(const h of hits){if(h.civilian){if(!c.hitSet.has(h.civilian)&&world.hitCivilian(h.civilian)){c.hitSet.add(h.civilian);stats.civilianKills++;impactFX.splash(h.p,forward(c),false);sound('hit',h.p);sound('death',h.p,{gain:.65});notify('CIVILIAN DOWN')}continue}if(h.bamboo){if(!c.hitSet.has(h.bamboo)&&world.bamboo.chop(h.bamboo,h.p,forward(c))){c.hitSet.add(h.bamboo);sound('wood',h.p);burst(h.p,0xc8c78e,9);graphics.impact(h.p,forward(c),'wood');if(!c.enemy)notify('BAMBOO CUT')}continue}if(h.w){if(c.hitSet.has(h.w))continue;c.hitSet.add(h.w);burst(h.p,0xe7c294,5);graphics.impact(h.p,forward(c).negate(),h.w.material||'stone');sound(h.w.material==='wood'?'wood':h.w.material==='metal'?'metal':'stone',h.p);if(!c.enemy){stats.worldHits++;notify(h.w.breakable?'WOOD CONTACT · crate broken':'STONE CONTACT · blade stopped')}if(h.w.ground&&!c.enemy&&!c.hitSet.has('ice-ground')&&world.groundImpact(h.p,c.heavy)){c.hitSet.add('ice-ground');burst(h.p,0xc7efff,20);sound('ice',c.pos);notify('ICE FRACTURED')}if(h.w.breakable)breakCrate(h.w,h.p);else{c.swingBlocked=true;c.knock.addScaledVector(forward(c),-.7);enter(c,'stun',.24);c.play('hit',.045,1.2,true);return false}}else if(!c.hitSet.has(h.e)){c.hitSet.add(h.e);const result=hurt(h.e,c,h.p,h.part,h.region);if(result==='blocked')return false}}
  return true;
 });c.previousBlade=current;trail(c,current);
}
function trail(c,sample){
 if(!c.trail){const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(new Float32Array(9*18),3));g.setAttribute('color',new T.BufferAttribute(new Float32Array(9*18),3));g.setDrawRange(0,0);const mesh=new T.Mesh(g,new T.MeshBasicMaterial({color:c.enemy?0xf39d89:0xd0ebd8,transparent:true,opacity:.16,vertexColors:true,side:T.DoubleSide,depthWrite:false,blending:T.AdditiveBlending}));mesh.frustumCulled=false;scene.add(mesh);c.trail={mesh,samples:[]}}
 const tr=c.trail;if(sample)tr.samples.push(sample);else tr.samples.shift();while(tr.samples.length>6)tr.samples.shift();const array=tr.mesh.geometry.attributes.position.array;let at=0;
 for(let i=1;i<tr.samples.length;i++){const a=tr.samples[i-1],b=tr.samples[i],a0=a.a.clone().lerp(a.b,.82),b0=b.a.clone().lerp(b.b,.82);for(const p of [a0,a.b,b.b,a0,b.b,b0]){p.toArray(array,at);at+=3}}
 const colors=tr.mesh.geometry.attributes.color;for(let i=0;i<at/3;i++){const strength=Math.pow((Math.floor(i/6)+1)/Math.max(1,tr.samples.length-1),1.5);colors.setXYZ(i,strength,strength,strength)}colors.needsUpdate=true;tr.mesh.geometry.attributes.position.needsUpdate=true;tr.mesh.geometry.setDrawRange(0,at/3);
}
function inputDirection(){const f=V(-Math.sin(camYaw),0,-Math.cos(camYaw)),r=V(Math.cos(camYaw),0,-Math.sin(camYaw)),d=V();if(keys.has('KeyW'))d.add(f);if(keys.has('KeyS'))d.sub(f);if(keys.has('KeyD'))d.add(r);if(keys.has('KeyA'))d.sub(r);return d.normalize()}
function playerControl(dt){
 const c=player,dir=inputDirection();if(['climb','ladder'].includes(c.state))return V();const ladder=nearestLadder(c,world);if(ladder&&dir.z<-.25){beginLadder(c,ladder);return V()}if(pressed.has('KeyQ'))dodge(c,dir);if(pressed.has('Space'))jump(c);if(pressed.has('KeyF'))slash(c,true);if(pressed.has('KeyJ'))slash(c,false);
 const guard=mouse.block||keys.has('KeyK');c.block=!c.severed.has('right_arm')&&guard&&['idle','block'].includes(c.state)&&c.stamina>2&&c.grounded;
 if(c.block){if(c.state!=='block'){enter(c,'block');c.blockTime=0;c.play('guard',.10,.75)}c.blockTime+=dt}else if(c.state==='block')enter(c,'idle');
 let speed=0;c.moveDir.copy(c.state==='dodge'?c.moveDir:dir);
 if(['idle','block'].includes(c.state)){
  const sprint=keys.has('ShiftLeft')||keys.has('ShiftRight');speed=dir.lengthSq()?(c.block?1.2:sprint&&c.stamina>5?5.6:3.25):0;if(speed>4){c.stamina=Math.max(0,c.stamina-12*dt);c.regenDelay=.3}if(dir.lengthSq()){turn(c,Math.atan2(dir.x,dir.z),dt);c.play(c.block?'guard':speed>4?'sprint':'jog',.14,speed>4?1.05:1)}else{c.play('guard',.15)}
 }else if(c.state==='jump'){speed=world.stage==='shinkansen'?4.8:3.6;if(dir.lengthSq())turn(c,Math.atan2(dir.x,dir.z),dt);if(c.timer>.27)c.play('jump',.12)}
 else if(c.state==='dodge')speed=7.7*Math.max(.3,1-c.timer/c.duration*.5);
 else if(c.state==='attack'){c.moveDir.copy(forward(c));speed=c.timer>.13&&c.timer<.39?(c.heavy?2.1:1.4):0}
 return c.moveDir.clone().multiplyScalar(speed);
}
function bossControl(c,dt){
 c.cooldown-=dt;c.block=false;
 const d=player.pos.clone().sub(c.pos);d.y=0;const distance=d.length();d.normalize();
 if(!c.phase)c.phase=1;
 if(c.hp<=c.maxHp*.5&&c.phase===1&&!['attack','stun','dead'].includes(c.state)){
  c.phase=2;enter(c,'overdrive',.95);c.play('guard',.15,.65);c.invuln=.7;c.comboLeft=0;
  c.model.traverse(o=>{if(o.isMesh&&o.material?.name.includes('amber optics'))o.material.emissiveIntensity=8});
  burst(c.pos.clone().add(V(0,1.7,0)),0xffa04c,50);banner('KAGE-09 · Overdrive','FASTER STRIKES · PARRY TO CREATE AN OPENING',2.3);return V();
 }
 if(c.state==='overdrive'){if(c.timer>=c.duration){enter(c,'idle');c.cooldown=.2}return V()}
 if(c.state==='idle'){
  if(distance<3.3&&c.cooldown<=0&&player.alive&&enemies.filter(e=>e!==c&&e.alive&&['attack','windup'].includes(e.state)).length<2){
   c.moveNumber=((c.moveNumber||0)+1)%3;c.bossMove=['Reaping cut','Shadow rush','Charged cleave'][c.moveNumber];c.heavy=c.moveNumber===2;c.comboLeft=c.moveNumber===0?(c.phase===2?2:1):0;
   enter(c,'windup',(c.moveNumber===2?1.13:.85)*(c.phase===2?.78:1));c.play('guard',.14,.6);notify('KAGE-09 · '+c.bossMove.toUpperCase(),1.4);return V();
  }
  let vel=V();
  if(distance>2.15){vel.copy(world.stage==='shinkansen'&&Math.abs(player.pos.x-c.pos.x)>2.5?V(Math.sign(player.pos.x-c.pos.x),0,0):d);const side=V(d.z,0,-d.x),from=c.pos.clone().add(V(0,1,0)),to=from.clone().addScaledVector(d,1.2);if(world.solids.some(w=>!w.broken&&segmentBox(from,to,w.box,.5)))vel.lerp(side,.92).normalize();turn(c,Math.atan2(vel.x,vel.z),dt,5);c.gait=distance>6?'sprint':'walk';c.play(c.gait,.25,c.phase===2?1.10:.88);vel.multiplyScalar(distance>6?3.6:c.phase===2?2.1:1.65)}
  else{turn(c,yawToward(c,player.pos),dt,5);c.gait='guard';c.play('guard',.2,.8);if(c.cooldown>.6){c.block=true;c.blockTime=1}vel.set(d.z,0,-d.x).multiplyScalar(.38)}
  return vel;
 }
 if(c.state==='windup'){
  // Aim locks before the strike, leaving a readable dodge window.
  if(c.timer<c.duration*.65)turn(c,yawToward(c,player.pos),dt,5);
  if(c.timer>=c.duration){const heavy=c.heavy;enter(c,'idle');slash(c,heavy);c.duration=(heavy?1.30:.96)*(c.phase===2?.86:1);c.play('sword',.055,clips.sword.duration/c.duration,true);c.cooldown=c.phase===2?1.10:1.65}
  return V();
 }
 if(c.state==='attack')return forward(c).multiplyScalar(c.timer>.16&&c.timer<c.duration*.5?(c.moveNumber===1?4.1:1.0):0);
 return V();
}
function enemyControl(c,dt){
 if(!c.alive||c.aiHold||['climb','ladder'].includes(c.state))return V();
 if(c.ambush==='waiting'){c.play('guard',.1,.65);return V()}
 if(c.ambush==='leaping'){c.play('jump',.08);return c.ambushVelocity.clone()}
 const ladder=ladderRoute(c,player,world);if(ladder){const nearby=nearestLadder(c,world);if(nearby){beginLadder(c,nearby);return V()}const d=ladder.bottom.clone().sub(c.pos);d.y=0;d.normalize();turn(c,Math.atan2(d.x,d.z),dt);c.play('jog',.18,.9);return d.multiplyScalar(2.7)}
 if(c.state==='jump'&&c.climbApproach){c.play('jump',.1);return c.climbApproach.clone().multiplyScalar(3.2)}
 if(c.grounded&&c.state==='idle'&&player.alive){
  c.climbApproach=null;const route=enemyClimbRoute(c,player,world);
  if(route){const d=route.waypoint.clone().sub(c.pos);d.y=0;if(route.distance<.75){c.climbApproach=route.direction;c.yaw=Math.atan2(route.direction.x,route.direction.z);jump(c);return route.direction.clone().multiplyScalar(3.2)}d.normalize();turn(c,Math.atan2(d.x,d.z),dt);c.play('jog',.18,.9);return d.multiplyScalar(2.7)}
 }
 if(world.stage==='shinkansen'&&c.state==='jump'){c.play('jump',.1);return c.trainJumpDir?.clone().multiplyScalar(4.8)||V()}
 if(world.stage==='shinkansen'&&c.grounded&&c.state==='idle'&&Math.abs(player.pos.x-c.pos.x)>2.5){
  const dir=V(Math.sign(player.pos.x-c.pos.x),0,0),edge=c.pos.clone().addScaledVector(dir,.48),landing=c.pos.clone().addScaledVector(dir,3.6);
  if(world.floorAt(edge.x,edge.z)<-3&&world.floorAt(landing.x,landing.z)>-.6){c.trainJumpDir=dir;jump(c);return dir.clone().multiplyScalar(4.8)}
 }
 if(c.boarding>0){c.boarding-=dt;return V(-Math.sign(c.pos.x)*3,0,0)}
 if(c.severed.has('right_arm')){c.block=false;if(c.state!=='idle')return V();const away=c.pos.clone().sub(player.pos);away.y=0;away.normalize();turn(c,Math.atan2(away.x,away.z),dt,7);c.play('jog',.2,.9);return away.multiplyScalar(2.0)}
 if(c.boss)return bossControl(c,dt);
 const profile=profiles[c.index%profiles.length];c.profile=profile.name;
 const d=player.pos.clone().sub(c.pos);d.y=0;const distance=d.length();d.normalize();
 c.cooldown-=dt;c.evadeCooldown=Math.max(0,(c.evadeCooldown||0)-dt);c.block=false;
 if(c.state==='dodge')return c.moveDir.clone().multiplyScalar(7.7*Math.max(.3,1-c.timer/c.duration*.5));
 if(c.state==='idle'){
  const active=enemies.filter(e=>['attack','windup'].includes(e.state)).length;
  // Agile rivals react to a visible wind-up, with a long cooldown between rolls.
  if(profile.evade&&player.state==='attack'&&player.timer>.08&&player.timer<.20&&distance<2.65&&c.evadeCooldown<=0&&c.stamina>48){
   const side=V(d.z,0,-d.x).multiplyScalar(c.index%2?1:-1).addScaledVector(d,-.35).normalize();
   const from=c.pos.clone().add(V(0,.45,0)),to=from.clone().addScaledVector(side,2.8);
   if(!world.solids.some(w=>!w.broken&&segmentBox(from,to,w.box,.4))){dodge(c,side);c.evadeCooldown=5.5+c.index*.6;c.cooldown=.6;return side.multiplyScalar(6.8)}
  }
  if(distance<2&&c.cooldown<=0&&active<2&&player.alive){turn(c,yawToward(c,player.pos),dt,9);enter(c,'windup',profile.windup);c.play('guard',.12,.8);c.heavy=c.index%3===2;return V()}
  if(distance>1.65){
   const gait=chooseGait(c.index,distance);c.gait=gait.clip;c.play(gait.clip,.24,gait.cadence);
   // Fan out while approaching; ease into a direct approach near sword range.
   const side=V(d.z,0,-d.x).multiplyScalar(c.index%2?1:-1);
   let vel=world.stage==='shinkansen'&&Math.abs(player.pos.x-c.pos.x)>2.5?V(Math.sign(player.pos.x-c.pos.x),0,0):d.clone().addScaledVector(side,profile.flank*Math.min(1,Math.max(0,(distance-2)/4))).normalize();
   const from=c.pos.clone().add(V(0,.7,0)),probe=from.clone().addScaledVector(vel,1.0);
   if(world.solids.some(w=>!w.broken&&segmentBox(from,probe,w.box,.35)))vel.lerp(side,.92).normalize();
   turn(c,Math.atan2(vel.x,vel.z),dt,7);return vel.multiplyScalar(gait.speed);
  }
  turn(c,yawToward(c,player.pos),dt,7);c.gait='guard';c.play('guard',.2,.85);
  if(c.cooldown>.35&&(c.index%2===0||active>=2)){c.block=true;c.blockTime=1}
  return V(d.z,0,-d.x).multiplyScalar((c.index%2?1:-1)*.48);
 }
 if(c.state==='windup'){turn(c,yawToward(c,player.pos),dt,4);if(c.timer>=c.duration){const heavy=c.heavy;enter(c,'idle');slash(c,heavy);c.duration=heavy?1.25:1.04;c.play('sword',.06,clips.sword.duration/c.duration,true);c.cooldown=1.4+Math.random()*.8}return V()}
 if(c.state==='attack')return forward(c).multiplyScalar(c.timer>.2&&c.timer<.5?.8:0);return V();
}
function advanceState(c,dt){c.timer+=dt;c.invuln=Math.max(0,c.invuln-dt);c.regenDelay=Math.max(0,(c.regenDelay||0)-dt);if(c.regenDelay<=0&&!c.block)c.stamina=Math.min(100,c.stamina+23*dt);c.knock.multiplyScalar(Math.exp(-7*dt));
 if(c.alive&&['attack','stun','dodge','land'].includes(c.state)&&c.timer>=c.duration){const q=c.queued,chain=c.boss&&c.state==='attack'&&c.comboLeft>0;enter(c,'idle');if(chain){c.comboLeft--;c.heavy=false;enter(c,'windup',c.phase===2?.35:.46);c.play('guard',.10,.8)}else if(q&&!c.enemy)slash(c,false)}if(!c.alive){c.deadTime+=dt;if(c.enemy&&c.deadTime>20)c.root.visible=false}
}
function fixed(dt){
 simTime+=dt;if(!player)return;world.fixed(dt,actors);
 if(world.stage==='lantern-street')bridgeAmbush.step(dt,player,enemies,(e,launch)=>{e.vy=launch.vy;e.grounded=false;e.ambushVelocity=V(launch.x,0,launch.z);e.yaw=Math.atan2(launch.x,launch.z);enter(e,'jump');e.play('jumpStart',.05,2.5,true);sound('jump',e.pos);if(e.index===0)banner('Shadows on the bridge','AMBUSH · FOUR NINJAS DESCENDING',2.5)});
 for(const c of actors)advanceState(c,dt);
 const velocities=new Map();velocities.set(player,player.alive?playerControl(dt):V());for(const e of enemies)velocities.set(e,enemyControl(e,dt));
 for(const c of actors){if(!c.alive||c.ambush==='waiting')continue;if(c.ladder&&stepLadder(c,dt))continue;if(c.climb&&stepClimb(c,dt,world))continue;
  const intent=velocities.get(c).clone();intent.y=0;intent.normalize();const ledge=c.ambush==='leaping'?null:findLedge(c,intent,world);if(ledge){sound('cloth',c.pos,{gain:.6});beginClimb(c,ledge);stepClimb(c,dt,world);continue}const wasGrounded=c.grounded;c.height=(c.state==='dodge'?.8:1.72)*c.size;c.vy-=23*dt;const v=world.velocity(c,velocities.get(c),dt).add(c.knock);c.velocity.set(v.x,c.vy,v.z);moveBody(c,V(v.x*dt,c.vy*dt,v.z*dt),world);if(!wasGrounded&&c.grounded){sound('land',c.pos,{gain:c.enemy?.65:1});const surface=combatAudio.surface(c,world);if(surface==='water'||surface==='snow')sound('foot-'+surface,c.pos);}
  if(!wasGrounded&&c.grounded&&c.state==='jump'){if(c.ambush==='leaping'){c.ambush='active';c.cooldown=.6}enter(c,'land',.19);c.play('land',.05,4,true);burst(c.pos.clone().add(V(0,.07,0)),0x819798,8)}if(c.pos.y< -3||world.isFatalFall(c)){
   const protectedPreview=c===player&&cameraFX.panelOpen;
   if(world.stage==='shinkansen'&&!protectedPreview){if(c===player)stats.damageTaken+=c.hp;killCharacter(c,{reason:'train-fall',impulse:V(v.x*.25,-.4,v.z*.25)});continue;}
   c.pos.copy(world.spawn);c.vy=0;c.knock.set(0,0,0);
   if(protectedPreview&&world.stage==='shinkansen'&&c.lastTrainSafe)c.pos.copy(c.lastTrainSafe);
   if(!protectedPreview)c.hp=Math.max(0,c.hp-20);
   if(!c.enemy&&!protectedPreview){stats.damageTaken+=20;notify('BACK ABOARD · −20 HEALTH')}
   if(c.hp===0)killCharacter(c,{reason:'fall',impulse:V(0,.4,1.8)});
   else{if(!protectedPreview)c.invuln=.8;enter(c,'idle');c.play('guard',.1)}
  }}

 for(let i=0;i<actors.length;i++)for(let j=i+1;j<actors.length;j++)if(actors[i].alive&&actors[j].alive&&!actors[i].climb&&!actors[j].climb&&!actors[i].ladder&&!actors[j].ladder)separateBodies(actors[i],actors[j],world);
 if(world.stage==='shinkansen')for(const c of actors)if(c.alive&&c.grounded&&world.floorAt(c.pos.x,c.pos.z)>-.4)c.lastTrainSafe=c.pos.clone();
 for(const c of actors){if(c.ragdoll&&c.root.visible)c.ragdoll.step(dt);c.visual(dt,camera)}world.interactCloth(dt,actors);for(const c of actors)if(c.alive)world.basin.interact(c,dt);world.basin.step(dt);combatAudio.update(actors,world);for(const c of actors)if(c.alive)contact(c);else trail(c,null);
 if(player.alive&&['playing','paused'].includes(mode)&&enemies.length&&enemies.every(e=>!e.alive)&&nextWave<0){nextWave=simTime+3;player.hp=Math.min(100,player.hp+22);player.stamina=100;banner(world.stage==='shinkansen'?'The last express is yours.':world.stage==='harbour'?'The Iron Shogun has fallen.':world.stage==='lantern-street'?'The street is safe.':'A moment to breathe.',wave<CAMPAIGN.length?'WAVE CLEARED · VITALITY RESTORED':'ALL FIVE ENCOUNTERS CLEARED')}
 if(player.alive&&nextWave>0&&simTime>=nextWave){nextWave=-1;if(wave<CAMPAIGN.length){announcer.say('victory');beginTravel();}else endRun(true)}pressed.clear();
}
function disposeEnemy(e){
 clearRagdoll(e);restoreCharacter(e);e.mixer.stopAllAction();e.mixer.uncacheRoot(e.model);
 // Runtime accessories are owned by this actor; source character geometry/textures are shared.
 const shared=new Set(),geometries=new Set(),materials=new Set(),skeletons=new Set();
 for(const source of [template,bossTemplate,warlordTemplate,samuraiTemplate,maskedTemplate])source?.traverse(o=>{if(o.geometry)shared.add(o.geometry)});
 for(const root of [e.root,e.shadow,e.bar,e.trail?.mesh])if(root){root.removeFromParent();root.traverse(o=>{if(o.geometry&&!shared.has(o.geometry))geometries.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);if(o.skeleton)skeletons.add(o.skeleton)})}
 for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const skeleton of skeletons)skeleton.dispose();
}
const searchlights=new Map();
function prepareSearchlight(){
 if(world.stage!=='ferry')return;
 if(!searchlights.has('ferry'))searchlights.set('ferry',createSearchlight(world.root,{position:V(-1.8,7.88,-11),solids:world.solids,makeOperator:()=>{const c=createCharacter(warlordTemplate,warlordClips,scene,{enemy:true,rig:warlordRig,color:0x293b58,name:'Warlord searchlight operator',index:9});c.setFabricWetness(1);return c}}));
 searchlights.get('ferry').reset();searchlights.get('ferry').update(0,player,camera);
}
function spawnWave(){
 for(const e of enemies)disposeEnemy(e);enemies=[];wave++;restoreLevelEnergy(player);
 cancelClimb(player);cancelLadder(player);player.climbApproach=null;world.select(CAMPAIGN[wave-1].id);bridgeAmbush.reset();music.selectStage(world.stage);camPitch=world.stage==='ferry'?.015:world.stage==='harbour'?.16:world.stage==='shinkansen'?.24:world.stage==='lantern-street'?.16:.3;graphics.reset();storm.reset();impactFX.clear();impactPost.reset();player.pos.copy(world.spawn);if(world.stage==='shinkansen'){player.yaw=0;camYaw=Math.PI;camDistance=5.8;}else if(world.stage==='lantern-street'){player.yaw=Math.PI;camYaw=0;camDistance=4.8;}player.lastTrainSafe=null;player.vy=0;player.knock.set(0,0,0);player.grounded=true;player.previousBlade=null;player.invuln=1;enter(player,'idle');player.play('guard',mode==='transition'?0:.15);player.visual(0,camera);updateCamera(1);
 const count=world.stage==='shinkansen'?6:['ferry','lantern-street'].includes(world.stage)?4:3;
 for(let i=0;i<count;i++){
  const cfg=clan[(i+wave-1)%3],ferry=world.stage==='ferry',harbour=world.stage==='harbour',train=world.stage==='shinkansen';
  const enemyTemplate=ferry?warlordTemplate:harbour?samuraiTemplate:train?maskedTemplate:template,enemyClips=ferry?warlordClips:harbour?samuraiClips:train?maskedClips:clips,rig=ferry?warlordRig:harbour?samuraiRig:train?maskedRig:null;
  const e=createCharacter(enemyTemplate,enemyClips,scene,{enemy:true,rig,color:cfg.color,name:(rig?.name||cfg.label)+' '+['Scout','Blade','Sentinel','Shade','Ronin','Striker'][i],index:i});
  e.pos.set((i-(count-1)/2)*2.8,0,harbour?-2.8:-3.2-(i%2)*2.4);e.yaw=0;e.hp=e.maxHp=harbour?72:ferry?74:65;e.cooldown=1+i*.4;if(ferry){e.pos.set(i%2?7.9:-7.9,1.65,-4+i*2);e.vy=2.8;e.grounded=false;e.boarding=.9;enter(e,'jump');e.play('jumpStart',0,2.5,true)}if(train){const sp=[[-5.4,10],[-5.4,-17],[0,0],[0,-15],[5.4,18],[5.4,-4]][i];e.pos.set(sp[0],world.floorAt(...sp),sp[1]);e.hp=e.maxHp=82;e.cooldown=1.4+i*.3;e.lastTrainSafe=e.pos.clone()}if(world.stage==='lantern-street'){const perch=AMBUSH_PERCHES[i];e.pos.set(perch.x,perch.y,perch.z);e.ambush='waiting';e.grounded=true;e.name='Bridge shadow '+(i+1)}e.visual(0,camera);enemies.push(e);
 }
 if(world.stage==='harbour'){const boss=createCharacter(bossTemplate,clips,scene,{enemy:true,boss:true,color:0xc4a366,name:'KAGE-09 · Iron Shogun',index:4});boss.pos.copy(world.bossSpawn);boss.yaw=0;boss.hp=boss.maxHp=420;boss.cooldown=2;boss.phase=1;boss.visual(0,camera);enemies.push(boss)}
 if(world.stage==='shinkansen'){for(const [i,sp] of [[0,[0,-8]],[1,[5.4,7]]]){
  const cyborg=createCharacter(bossTemplate,clips,scene,{enemy:true,boss:true,color:0xc4a366,name:i?'KAGE-09 · Reaper':'KAGE-09 · Vanguard',index:6+i});
  cyborg.pos.set(sp[0],world.floorAt(...sp),sp[1]);cyborg.yaw=0;cyborg.hp=cyborg.maxHp=240;cyborg.cooldown=2.5+i*1.2;cyborg.phase=1;cyborg.moveNumber=i;cyborg.grounded=true;cyborg.lastTrainSafe=cyborg.pos.clone();cyborg.visual(0,camera);enemies.push(cyborg);
 }}
 actors=[player,...enemies];for(const c of actors)c.setFabricWetness(world.stage==='ferry'?1:world.stage==='garden'?.35:0);const title=world.stageName;
 prepareSearchlight();banner(title,sceneSetting(world.stage),4.5);$('banner').classList.toggle('scene-intro',mode!=='transition');$('wave-title').textContent=CHAPTERS[wave-1]+' · '+title;document.querySelectorAll('.wave-marks i').forEach((n,i)=>n.classList.toggle('active',i<wave));
}
function reset({duringTravel=false,startWave=requestedChapter}={}){if(!duringTravel&&!preparedLevels.has(CAMPAIGN[startWave-1]?.id))return beginTravel({targetWave:startWave,restart:true});announcer.reset();clearTimeout(endTimer);endTimer=null;deathCinematic.reset();deathCameraTarget=null;cancelClimb(player);cancelLadder(player);player.climbApproach=null;clearRagdoll(player);accumulator=0;hitStop=0;clock.getDelta();impactPost.reset();graphics.reset();intro?.leave();storm.reset();impactFX.clear();restoreCharacter(player);for(const e of enemies)disposeEnemy(e);enemies=[];actors=[player];if(!duringTravel){travel=null;travelFX.finish();$('travel').classList.add('hidden')}$('banner').classList.remove('scene-intro');player.setFabricWetness(.35);wave=startWave-1;kills=0;nextWave=-1;combo=0;lastHit=-10;simTime=0;world.reset();Object.keys(stats).forEach(k=>stats[k]=0);player.pos.set(0,0,8);player.yaw=Math.PI;player.vy=0;player.hp=100;player.stamina=100;player.alive=true;player.root.visible=true;player.invuln=1;player.knock.set(0,0,0);player.grounded=true;enter(player,'idle');player.play('guard',0);camYaw=.0;camPitch=.3;camDistance=5.8;mode=duringTravel?'transition':'playing';syncMusic();keys.clear();pressed.clear();mouse.block=false;$('menu').classList.add('hidden');$('pause-menu').classList.add('hidden');$('hud').classList.remove('hidden');$('combo').textContent='';if(!duringTravel&&matchMedia('(pointer:coarse)').matches)$('touch-controls').classList.remove('hidden');spawnWave();updateCamera(1)}
function skipScene(){
 if(!ready||!player.alive||travel||!['playing','paused'].includes(mode))return;
 announcer.reset();beginTravel({targetWave:wave%CAMPAIGN.length+1});
}
function showingIntro(){return mode==='menu'||!!(travel?.fromIntro&&!travel.switched)}
function beginTravel({targetWave=wave+1,restart=false}={}){
 const fromIntro=mode==='menu';
 if(!ready||travel||(!player?.alive&&!restart)||(!fromIntro&&!restart&&!['playing','paused'].includes(mode))||targetWave<1||targetWave>CAMPAIGN.length)return;
 const returnPaused=mode==='paused';
 travel={elapsed:0,switched:false,targetWave,returnPaused,fromIntro,restart,assetsReady:false,prepared:false,preparing:false,error:false};mode='transition';nextWave=-1;resumeMode='playing';
 keys.clear();pressed.clear();mouse.block=false;accumulator=0;hitStop=0;shake=0;
 $('menu').classList.add('hidden');$('pause-menu').classList.add('hidden');$('touch-controls').classList.add('hidden');
 $('banner').style.opacity=0;bannerUntil=0;
 const chapter=CAMPAIGN[targetWave-1],kind=chapter.id;
 $('travel-title').textContent=chapter.title;
 $('travel-setting').textContent=sceneSetting(kind);
 $('travel-copy').textContent=CHAPTERS[targetWave-1]+' · '+chapter.arrival;
 $('travel').classList.remove('hidden');$('travel').style.opacity=0;travelFX.begin(targetWave);syncMusic();
 const job=travel;assetRequests.clearErrors();loading.begin(`Loading ${chapter.title}`,preparedLevels.has(kind)?[]:LEVEL_MODELS[kind].filter(path=>!modelCache.has(path)));
 if(preparedLevels.has(kind))loading.prepare('Preparing scene');
 loadLevel(kind).then(()=>{if(travel===job)job.assetsReady=true}).catch(error=>{if(travel===job){job.error=true;loading.fail(error)}});
}
function loadLevel(kind){
 return levelCache.get(kind,async()=>{
  if(kind==='garden'){
   const kit=await loadModel('assets/environment-kit.glb');
   loading.prepare('Preparing garden textures');await loadingPaint();world.assetInfo=world.installProps(kit.scene);
  }else if(kind==='lantern-street'){
   const resources=await loadLanternStreet({loadAsync:loadModel});world.installStreet(resources);
  }else{
   const actor={ferry:'warlord',harbour:'samurai',shinkansen:'imported-ninja'}[kind];
   const file={ferry:'ferry-refined',harbour:'harbour-refined',shinkansen:'shinkansen'}[kind];
   const [kit,gltf,rig]=await Promise.all([loadModel(`assets/${file}.glb`),loadModel(`assets/${actor}/retargeted.glb`),readJSON(`./assets/${actor}/manifest.json`)]);
   const animation=prepareArmedClips(gltf.animations,rig);world.installVoyage({[kind]:kit.scene});
   if(kind==='ferry'){warlordTemplate=gltf.scene;warlordRig=rig;warlordClips=animation;}
   if(kind==='harbour'){samuraiTemplate=gltf.scene;samuraiRig=rig;samuraiClips=animation;}
   if(kind==='shinkansen'){maskedTemplate=gltf.scene;maskedRig=rig;maskedClips=animation;}
  }
 });
}
async function prepareLevelTransition(job){
 try{
  loading.prepare('Preparing scene and textures');await loadingPaint();if(travel!==job)return;
  job.switched=true;
  if(job.fromIntro||job.restart)reset({duringTravel:true,startWave:job.targetWave});else{wave=job.targetWave-1;spawnWave();}
  bannerUntil=0;$('banner').style.opacity=0;
  await assetRequests.wait();storm.wetScene();
  loading.prepare('Preparing lighting and shaders');await loadingPaint();
  updateCamera(1);updateStageLighting(true);await renderer.compileAsync(scene,camera);
  if(travel!==job)return;
  preparedLevels.add(CAMPAIGN[job.targetWave-1].id);job.prepared=true;loading.finish();travelFX.requestIncoming();
 }catch(error){if(travel===job){job.error=true;loading.fail(error)}}
}
function updateTravel(dt){
 if(!travel||document.hidden)return;
 if(travelFX.state.oldReady){travel.elapsed+=Math.min(dt,.1);if(!travel.prepared)travel.elapsed=Math.min(travel.elapsed,TRANSITION_SWITCH);}
 const beat=transitionBeat(travel.elapsed);$('travel').style.opacity=beat.text;
 if(beat.switchScene&&travel.assetsReady&&!travel.preparing&&!travel.error){travel.preparing=true;prepareLevelTransition(travel);}
 if(beat.done){
  const returnPaused=travel.returnPaused;travel=null;travelFX.finish();mode='playing';clock.getDelta();accumulator=0;
  $('travel').classList.add('hidden');player.invuln=Math.max(player.invuln,1);
  if(returnPaused)pause();else if(matchMedia('(pointer:coarse)').matches)$('touch-controls').classList.remove('hidden');
 }
}
function capture(){if(document.pointerLockElement!==canvas)try{const p=canvas.requestPointerLock();p?.catch(()=>{$('lock-tip').textContent='Drag to look · Arrow keys also rotate the camera'})}catch{}}
// Request pointer capture before fullscreen consumes the button's user activation.
// Fullscreen the whole page so the HUD, pause menu and FX controls stay available.
function enterPlayDisplay(){
 capture();
 if(document.fullscreenElement||document.webkitFullscreenElement)return;
 const root=document.documentElement,request=root.requestFullscreen||root.webkitRequestFullscreen;
 if(request)try{request.call(root)?.catch(()=>{})}catch{}
}
function pause(){if(loading.state.phase!=='ready'||!['playing','transition'].includes(mode))return;resumeMode=mode;mode='paused';if(travel)$('travel').classList.add('hidden');syncMusic();keys.clear();pressed.clear();mouse.block=false;if(document.pointerLockElement)document.exitPointerLock();$('pause-title').textContent='Paused';$('pause-copy').textContent='';$('resume').classList.remove('hidden');$('pause-menu').classList.remove('hidden');$('touch-controls').classList.add('hidden')}
function resume(){if(mode!=='paused')return;mode=resumeMode;if(travel)$('travel').classList.remove('hidden');clock.getDelta();syncMusic();$('pause-menu').classList.add('hidden');if(matchMedia('(pointer:coarse)').matches)$('touch-controls').classList.remove('hidden');enterPlayDisplay()}
function endRun(win){
 if(mode==='won'||mode==='dead')return;
 announcer.say(win?'victory':'defeated');mode=win?'won':'dead';clearTimeout(endTimer);
 if(!win){bannerUntil=0;contactTime=0;$('banner').style.opacity=0;$('combo').textContent='';deathCinematic.start();deathCameraTarget=player.pos.clone().add(V(0,1.22,0));nextWave=-1;cameraFX.show(false)}
 if(document.pointerLockElement)document.exitPointerLock();keys.clear();pressed.clear();mouse.block=false;
 endTimer=setTimeout(()=>{if(mode!==(win?'won':'dead'))return;$('pause-title').textContent=win?'Victory':'Defeated';$('pause-copy').textContent=win?`The united clans defeated. ${stats.swordHits} blade contacts · ${stats.parries} parries · ${stats.dodges} dodges.`:player.deathReason==='train-fall'?'Lost beneath the Last Express.':`${kills} rivals defeated. Watch the red wind-up, then parry or dodge.`;$('resume').classList.add('hidden');$('pause-menu').classList.remove('hidden');$('touch-controls').classList.add('hidden')},win?600:3300);
 if(win){player.play('dance',.2);banner('Jysk Ninja stands.','THE GARDEN IS YOURS',10)}
}

function updateCamera(dt){
 if(showingIntro()){world.cameraFade.update(camera.position,V(),false);intro?.frame(dt);return}
 if(!player)return;const inspecting=cameraFX.panelOpen&&player.alive&&['playing','paused'].includes(mode);if(inspecting&&cameraFX.autoOrbit&&!document.hidden)camYaw+=Math.min(dt,.05)*.10;if(!inspecting){if(keys.has('ArrowLeft'))camYaw+=dt*1.6;if(keys.has('ArrowRight'))camYaw-=dt*1.6;if(keys.has('ArrowUp'))camPitch=Math.min(.85,camPitch+dt);if(keys.has('ArrowDown'))camPitch=Math.max(-.1,camPitch-dt);}
 const target=player.pos.clone().add(V(0,1.22,0));if(mode==='dead'&&player.ragdoll){const focus=player.ragdoll.focus;focus.y=Math.max(-5,focus.y+.2);deathCameraTarget.lerp(focus,1-Math.exp(-4*dt));target.copy(deathCameraTarget)}
 const sway=world.stage==='ferry'&&!matchMedia('(prefers-reduced-motion: reduce)').matches;const seaYaw=sway?Math.sin(simTime*.63)*.022:0,seaPitch=sway?Math.sin(simTime*.92)*.026+Math.sin(simTime*.41)*.009:0;
 placeFollowCamera(camera,target,camYaw+seaYaw,camPitch+seaPitch,camDistance,shake);if(sway)camera.rotateZ(Math.sin(simTime*.72)*.024+Math.sin(simTime*1.13)*.009);
 shake*=Math.exp(-14*dt);
 world.cameraFade.update(camera.position,target);

}
function hud(){if(!player)return;$('stage-label').textContent=world.stageName;const boss=enemies.filter(e=>e.boss&&e.alive).sort((a,b)=>a.pos.distanceToSquared(player.pos)-b.pos.distanceToSquared(player.pos))[0];$('boss-hud').classList.toggle('hidden',!boss?.alive);if(boss?.alive){document.querySelector('#boss-hud > strong').textContent=boss.name;$('boss-health').style.width=boss.hp/boss.maxHp*100+'%';$('boss-phase').textContent=boss.phase===2?'II · OVERDRIVE':'I';$('boss-value').textContent=Math.ceil(boss.hp)+' / '+boss.maxHp;}$('hp').style.width=player.hp+'%';$('hp-text').textContent=Math.ceil(player.hp);$('stamina').style.width=player.stamina+'%';$('remaining').textContent=`${enemies.filter(e=>e.alive).length} rivals`;$('kills').textContent=`${kills} DEFEATED`;$('stance').textContent=player.state==='attack'?(player.heavy?'HEAVY SLASH':'SLASH'):player.state==='block'?'GUARD':player.state.toUpperCase();if(simTime>contactTime)$('contact').textContent='';if(simTime>bannerUntil)$('banner').style.opacity=0;if(simTime-lastHit>2.5)$('combo').textContent='';}

function syncIntroFullscreen(){
 const full=!!(document.fullscreenElement||document.webkitFullscreenElement),button=$('intro-fullscreen');
 button.setAttribute('aria-pressed',String(full));button.setAttribute('aria-label',full?'Exit fullscreen':'Fullscreen intro and start music');button.title=full?'Exit fullscreen':'Fullscreen intro · start music';
 const immersive=$('intro-immersive');immersive.classList.toggle('is-active',full&&!muted);immersive.title=full&&!muted?'Fullscreen and audio are on':'Enter fullscreen and start the intro music';
 button.querySelector('path').setAttribute('d',full?'M3 8h5V3M21 8h-5V3M8 21v-5H3M16 21v-5h5':'M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5');
}
function enableIntroDisplay(){
 // Unlock playback within this click, before fullscreen consumes user activation.
 muted=false;storm.setMuted(false);$('sound').classList.remove('muted');$('sound').setAttribute('aria-label','Mute sound');$('sound').setAttribute('aria-pressed','false');syncMusic();music.unlock();combatAudio.unlock();syncIntroFullscreen();
 if(document.fullscreenElement||document.webkitFullscreenElement)return;
 const root=document.documentElement,request=root.requestFullscreen||root.webkitRequestFullscreen;
 const failed=()=>{$('load-status').textContent='Fullscreen is unavailable in this browser.'};
 if(request)try{request.call(root)?.catch(failed)}catch{failed()}else failed();
};
$('intro-immersive').onclick=enableIntroDisplay;
$('intro-fullscreen').onclick=()=>{
 if(document.fullscreenElement||document.webkitFullscreenElement){const exit=document.exitFullscreen||document.webkitExitFullscreen;try{exit?.call(document)?.catch(()=>{})}catch{}return;}
 enableIntroDisplay();
};
for(const event of ['fullscreenchange','webkitfullscreenchange'])document.addEventListener(event,syncIntroFullscreen);
syncIntroFullscreen();
$('credits-button').onclick=()=>{if(['playing','transition'].includes(mode))pause();$('credits-dialog').showModal();};$('close-credits').onclick=()=>$('credits-dialog').close();
$('intro-help').onclick=()=>$('controls-dialog').showModal();$('close-controls').onclick=()=>$('controls-dialog').close();
$('start').onclick=()=>{combatAudio.unlock();beginTravel({targetWave:requestedChapter});enterPlayDisplay()};$('pause').onclick=pause;$('resume').onclick=resume;$('restart').onclick=()=>{reset();enterPlayDisplay()};$('help').onclick=pause;$('sound').onclick=()=>{muted=!muted;storm.setMuted(muted);syncMusic();if(!muted)combatAudio.unlock();$('sound').classList.toggle('muted',muted);$('sound').setAttribute('aria-label',muted?'Unmute sound':'Mute sound');$('sound').setAttribute('aria-pressed',String(muted));syncIntroFullscreen()};
window.addEventListener('keydown',e=>{if(document.querySelector('dialog[open]')||cameraFX.panelOpen||e.target.closest?.('#fx-panel,#fx-toggle'))return;if(e.code==='KeyN'&&!e.ctrlKey&&!e.metaKey&&!e.altKey){e.preventDefault();if(!e.repeat)skipScene();return}if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab'].includes(e.code))e.preventDefault();if(e.code==='Escape'){if(mode==='playing'||mode==='transition')pause();else if(mode==='paused')resume();return}if(mode==='playing'){if(!keys.has(e.code))pressed.add(e.code);keys.add(e.code)}});window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',pause);document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();syncMusic()});document.addEventListener('pointerlockchange',()=>{$('lock-tip').style.display=document.pointerLockElement?'none':'block';if(!document.pointerLockElement&&mode==='playing'&&!cameraFX.panelOpen&&!matchMedia('(pointer:coarse)').matches)pause()});
canvas.addEventListener('contextmenu',e=>e.preventDefault());canvas.addEventListener('mousedown',e=>{if(mode!=='playing'||cameraFX.panelOpen)return;if(e.button===0){capture();pressed.add('KeyJ')}if(e.button===2)mouse.block=true});window.addEventListener('mouseup',e=>{if(e.button===2)mouse.block=false});window.addEventListener('mousemove',e=>{if(mode!=='playing'||cameraFX.panelOpen)return;if(document.pointerLockElement===canvas||(e.buttons&3)!==0){camYaw-=e.movementX*.0025;camPitch=Math.max(-.12,Math.min(.88,camPitch+e.movementY*.002))}});canvas.addEventListener('wheel',e=>{e.preventDefault();if(mode!=='playing'||cameraFX.panelOpen)return;camDistance=Math.max(2.6,Math.min(8,camDistance+e.deltaY*.005))},{passive:false});
for(const b of document.querySelectorAll('[data-key]')){b.addEventListener('pointerdown',e=>{e.preventDefault();if(cameraFX.panelOpen)return;b.setPointerCapture(e.pointerId);keys.add(b.dataset.key);pressed.add(b.dataset.key)});for(const type of ['pointerup','pointercancel'])b.addEventListener(type,()=>keys.delete(b.dataset.key))}
let touchLast=null;canvas.addEventListener('touchstart',e=>{touchLast={x:e.touches[0].clientX,y:e.touches[0].clientY}},{passive:true});canvas.addEventListener('touchmove',e=>{if(!touchLast)return;const t=e.touches[0];camYaw-=(t.clientX-touchLast.x)*.006;camPitch=Math.max(-.1,Math.min(.85,camPitch+(t.clientY-touchLast.y)*.004));touchLast={x:t.clientX,y:t.clientY}},{passive:true});canvas.addEventListener('touchend',()=>touchLast=null);
window.addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight);composer.setSize(innerWidth,innerHeight);storm.resize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();cameraFX.resize()});renderer.setSize(innerWidth,innerHeight);cameraFX.resize();
// Each location gets its own reflection capture and warm/cool lighting balance.
const stageEnvironments=new Map();let litStage=null;
function updateStageLighting(force=false){
 if(showingIntro()){renderer.toneMappingExposure=1.05;return;}
 const stage=world.stage,menu=showingIntro(),harbour=stage==='harbour',ferry=stage==='ferry',train=stage==='shinkansen',street=stage==='lantern-street';
 renderer.toneMappingExposure=menu?1.05:street?1.15:train?1.05:harbour?1.16:ferry?1.16:1.22;
 ambientFill.intensity=menu?1.25:street?1.1:train?1.25:harbour?1.12:ferry?.62:2.15;
 ambientFill.color.setHex(street?0xd6b5bc:harbour?0xb9d7f2:0xc6d7f1);ambientFill.groundColor.setHex(harbour?0x536676:0x465754);
 moonlight.color.setHex(street?0xffb575:train?0xffedcf:harbour?0xc4d3f1:0xc6d8ff);moonlight.intensity=menu?2.3:street?1.9:train?3.7:harbour?1.9:ferry?1.65:2.65;
 fill.color.setHex(harbour?0xa4caff:0xf6d2aa);fill.intensity=menu?.45:street?.4:harbour?.85:ferry?.72:1.0;
 scene.environmentIntensity=menu?.4:train?.65:harbour?.48:ferry?.30:.52;
 if((train||street)&&player){moonlight.position.set(player.pos.x+(street?-16:18),25,player.pos.z-(street?12:28));moonlight.target.position.set(player.pos.x,0,player.pos.z);moonlight.target.updateMatrixWorld()}else if(litStage!==stage){moonlight.target.position.set(0,0,0);moonlight.target.updateMatrixWorld()}
 if(!ready||(!force&&loading.state.phase!=='ready')||litStage===stage)return;litStage=stage;camera.far=train?460:220;camera.updateProjectionMatrix();moonlight.position.set(train?18:harbour?-18:-16,train?25:harbour?22:25,train?-28:harbour?9:-12);
 if(stageEnvironments.has(stage)){scene.environment=stageEnvironments.get(stage);return}
 const hidden=[];scene.traverse(o=>{if(o.visible&&(o.isPoints||o.isReflector||o===world.water||o.userData.noReflectionCapture)){hidden.push(o);o.visible=false}});
 for(const a of actors)if(a.root.visible){hidden.push(a.root);a.root.visible=false}
 const target=new T.WebGLCubeRenderTarget(128,{type:T.HalfFloatType}),probe=new T.CubeCamera(.15,train?460:180,target),pmrem=new T.PMREMGenerator(renderer);
 const previous=scene.environment;scene.environment=null;probe.position.set(0,3,street?-15:0);
 try{probe.update(renderer,scene);const env=pmrem.fromCubemap(target.texture).texture;env.name=stage+' local reflections';stageEnvironments.set(stage,env);scene.environment=env}
 finally{for(const o of hidden)o.visible=true;target.dispose();pmrem.dispose();if(!scene.environment)scene.environment=previous}
}
async function init(){try{
loading.begin('Loading intro',INTRO_MODELS);await loadingPaint();
const [g,data,mech]=await Promise.all([loadModel('assets/ninja-game.glb'),readJSON('./assets/motions.json'),loadModel('assets/mech-boss.glb')]);bossTemplate=mech.scene;
loading.prepare('Preparing intro and audio');await loadingPaint();
template=g.scene;clips={};for(const dataClip of data.clips){const c=T.AnimationClip.parse(dataClip);for(const tr of c.tracks)if(tr.name==='pelvis.position'){for(let i=0;i<tr.values.length;i+=3){tr.values[i]=tr.values[0];tr.values[i+2]=tr.values[2]}}clips[c.name]=c}player=createCharacter(template,clips,scene);player.pos.set(0,0,8);player.yaw=0;actors=[player];intro=createIntro(camera,storm,(studio,kind)=>createCharacter(kind==='cyborg'?bossTemplate:template,clips,studio,{enemy:kind!=='hero',boss:kind==='cyborg',color:0x253d37,name:'Intro '+kind}),sound);await intro.loaded;await combatAudio.loaded;await assetRequests.wait();loading.prepare('Preparing intro lighting and shaders');await loadingPaint();await renderer.compileAsync(intro.scene,camera);intro.start();ready=true;loading.finish();$('start').disabled=false;$('start').innerHTML=(requestedChapter===2?'Play Lantern Street':'Play')+' <span>↗</span>';$('load-status').textContent='';window.gameDebug={get loading(){return {...loading.state,pending:assetRequests.pending,preparedLevels:[...preparedLevels]}},announcer,combatAudio,searchlightVolume,get searchlight(){return searchlights.get(world.stage)},get deathCinematic(){return deathCinematic.state},get intro(){return intro},get ready(){return ready},get mode(){return mode},get player(){return player},get enemies(){return enemies},world,camera,renderer,scene,cameraFX,stats,impactFX,storm,music,graphics,impactPost,slash,dodge,jump,pause,resume,reset,setKeys:codes=>{keys.clear();codes.forEach(k=>keys.add(k))},press:code=>pressed.add(code),step:dt=>fixed(dt),spawnWave,beginTravel,get transition(){return travel?{...travel,...travelFX.state}:null},get state(){return {mode,stage:world.stage,wave,kills,health:player.hp,stamina:player.stamina,position:player.pos.toArray(),state:player.state,grounded:player.grounded,enemies:enemies.map(e=>({name:e.name,boss:e.boss,phase:e.phase,bossMove:e.bossMove,severed:[...e.severed],profile:e.profile,gait:e.gait,hp:e.hp,state:e.state,position:e.pos.toArray(),alive:e.alive})),stats:{...stats},drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles}},setPose(x,y,z,yaw=Math.PI){player.pos.set(x,y,z);player.yaw=yaw;player.visual(0,camera)},holdEnemies(value=true){for(const e of enemies)e.aiHold=value},attack:heavy=>slash(player,heavy)};}catch(e){loading.fail(e);$('load-status').textContent='Could not load the intro. Reload to try again.';$('start').textContent='Load failed';window.gameDebug={ready:false,error:String(e)}}}
let fpsFrames=0,fpsStart=performance.now();document.addEventListener('visibilitychange',()=>{fpsStart=performance.now();fpsFrames=0});
renderer.setAnimationLoop(()=>{const now=performance.now();fpsFrames++;if(now-fpsStart>=500){$('fps').textContent=Math.round(fpsFrames*1000/(now-fpsStart))+' FPS';fpsFrames=0;fpsStart=now;canvas.dataset.gameState=JSON.stringify({mode,stage:world.stage,wave,position:player?.pos.toArray(),enemies:enemies.map(e=>({ambush:e.ambush,alive:e.alive,y:e.pos.y,state:e.state})),ambush:bridgeAmbush.stats,street:world.stage==='lantern-street'?world.stageState:null,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles})}const realDt=clock.getDelta();music.update(realDt);deathCinematic.update(document.hidden?0:realDt);let dt=Math.min(realDt,.08)*deathCinematic.timeScale;if(mode==='playing'||mode==='dead'){if(hitStop>0){hitStop-=dt;dt*=.18}accumulator+=dt;while(accumulator>=1/60&&(mode==='playing'||mode==='dead')){fixed(1/60);accumulator-=1/60}effects(dt);world.update(simTime,dt);}else if(mode==='transition'){updateTravel(realDt);}else if(mode==='menu'){intro?.update(dt)}else if(mode==='won'){for(const c of actors){if(c.ragdoll&&c.root.visible)c.ragdoll.step(dt);c.visual(dt,camera)}effects(dt)}if(mode==='playing'||mode==='dead')for(const c of actors)if(c.ragdoll&&c.root.visible)c.ragdoll.apply(Math.min(1,accumulator*60));updateCamera(dt);if(world.stage==='ferry')searchlights.get('ferry')?.update(['playing','dead'].includes(mode)?dt:0,player,camera);updateStageLighting();impactPost.update(dt,mode);document.body.dataset.mode=mode;storm.setActive(mode!=='menu'&&mode!=='paused'&&mode!=='transition'&&!document.hidden);storm.update(mode==='paused'||mode==='transition'?0:dt);graphics.update(dt,actors,mode==='transition'?'paused':mode);hud();cameraFX.update(Math.min(realDt,.25),mode);renderPass.scene=showingIntro()?(intro?.scene||loadingScene):scene;searchlightVolume.configure(searchlights.get('ferry'),world.stage==='ferry'&&mode!=='menu'&&mode!=='transition');renderer.info.reset();composer.render(dt);travelFX.frame(canvas,travel?.elapsed||0,mode==='transition');screenshots.afterFrame()});init();
