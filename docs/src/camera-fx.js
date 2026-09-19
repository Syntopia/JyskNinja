import * as T from 'three';
import {SMAAPass} from 'three/addons/postprocessing/SMAAPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {createSketchPass} from './sketch-pass.js';
import {FXAAShader} from 'three/addons/shaders/FXAAShader.js';
import {CameraMotionPass,LightStreakPass,gradePass,filmPass} from './cinematic-passes.js';

const defaults={enabled:true,sketch:false,sketchAmount:1,sketchWeight:1,sketchHatching:.7,sketchPaper:.35,sketchColour:0,motion:true,motionAmount:.35,vignette:true,vignetteAmount:.5,grain:true,grainAmount:.022,grade:true,gradeAmount:.25,saturation:1.03,streaks:true,streakAmount:.22,streakLength:.12,rain:true,rainAmount:1,forceRain:false,bloom:true,shock:true,aa:'smaa',tone:'aces',exposure:1};
const ranges={sketchAmount:[0,1],sketchWeight:[.5,2],sketchHatching:[0,1.4],sketchPaper:[0,1],sketchColour:[0,1],motionAmount:[0,1],vignetteAmount:[0,.6],grainAmount:[0,.09],gradeAmount:[0,1],saturation:[.5,1.5],streakAmount:[0,1.5],streakLength:[0,.3],rainAmount:[0,2.5],exposure:[.65,1.5]};
const choices={aa:['smaa','fxaa','off'],tone:['aces','agx','neutral','none']};
const storageKey='jysk-ninja-camera-fx-v1';
export function createCameraFX({renderer,composer,camera,world,bloom,storm,impactPost,searchlightVolume,clearInput}){
 const settings={...defaults},reduced=matchMedia('(prefers-reduced-motion: reduce)');
 function accept(values){for(const [key,value] of Object.entries(values)){if(!(key in defaults))continue;if(ranges[key]){if(Number.isFinite(+value))settings[key]=T.MathUtils.clamp(+value,...ranges[key])}else if(choices[key]){if(choices[key].includes(value))settings[key]=value}else if(typeof value==='boolean')settings[key]=value}}
 try{
  const saved=JSON.parse(localStorage.getItem(storageKey)||'{}');
  // Upgrade the old default once, retaining deliberately customized FX values.
  if((saved._defaultsRevision||1)<2&&saved.vignetteAmount===.18)delete saved.vignetteAmount;
  accept(saved);
 }catch{}
 const motion=new CameraMotionPass(),streaks=new LightStreakPass(),grade=gradePass(),film=filmPass(),smaa=new SMAAPass(),fxaa=new ShaderPass(FXAAShader);
 const sketch=createSketchPass(),sketchAA=new ShaderPass(FXAAShader);sketchAA.material.name='Pencil stroke antialiasing';
 const renderPass=composer.passes[0],output=composer.passes.find(p=>p.constructor.name==='OutputPass');
 // SMAA consumes linear colour; FXAA consumes sRGB. Grain follows both.
 composer.passes=[renderPass,searchlightVolume,motion,bloom,streaks,impactPost.pass,storm.lensPass,grade,smaa,output,fxaa,film,sketch,sketchAA];
 for(const target of [composer.renderTarget1,composer.renderTarget2]){target.samples=0;target.depthTexture=new T.DepthTexture(target.width,target.height,T.UnsignedIntType)}
 let time=0,lastStage=null,lastMode=null,history=false,open=false,lastMotion=false;
 const previousVP=new T.Matrix4(),currentVP=new T.Matrix4(),lastPosition=new T.Vector3(),lastQuaternion=new T.Quaternion(),size=new T.Vector2();
 function resize(){renderer.getDrawingBufferSize(size);for(const pass of [motion,streaks,smaa])pass.setSize(size.x,size.y);fxaa.uniforms.resolution.value.set(1/size.x,1/size.y);film.uniforms.pixels.value.copy(size);sketch.uniforms.pixels.value.copy(size);sketch.uniforms.pixelRatio.value=renderer.getPixelRatio();sketchAA.uniforms.resolution.value.set(1/size.x,1/size.y);history=false}
 resize();
 function save(){try{localStorage.setItem(storageKey,JSON.stringify({...settings,_defaultsRevision:2}))}catch{}}
 function set(values){accept(values);syncUI();save();history=false}
 function update(dt,mode){
  const on=settings.enabled,still=(mode==='paused'&&!open)||mode==='transition';if(!still)time+=Math.min(dt,.05);
  camera.updateMatrixWorld();currentVP.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
  const useMotion=on&&settings.motion&&!reduced.matches&&!still&&mode!=='menu';
  const cut=!history||lastStage!==world.stage||lastMode!==mode||dt>.12||lastMotion!==useMotion||camera.position.distanceTo(lastPosition)>3||Math.abs(camera.quaternion.dot(lastQuaternion))<.95;
  motion.uniforms.inverseVP.value.copy(currentVP).invert();motion.uniforms.previousVP.value.copy(cut?currentVP:previousVP);
  motion.uniforms.strength.value=cut?0:settings.motionAmount*Math.min(2,(1/60)/Math.max(dt,.008));motion.enabled=useMotion&&!cut&&(camera.position.distanceToSquared(lastPosition)>1e-10||Math.abs(camera.quaternion.dot(lastQuaternion))<.999999999);
  previousVP.copy(currentVP);lastPosition.copy(camera.position);lastQuaternion.copy(camera.quaternion);lastMode=mode;lastStage=world.stage;lastMotion=useMotion;history=true;
  sketch.enabled=on&&settings.sketch&&settings.sketchAmount>0;
  sketchAA.enabled=sketch.enabled&&settings.aa!=='off';
  for(const [uniform,key] of Object.entries({amount:'sketchAmount',weight:'sketchWeight',hatching:'sketchHatching',paper:'sketchPaper',colour:'sketchColour'}))sketch.uniforms[uniform].value=settings[key];
  bloom.enabled=on&&settings.bloom;streaks.enabled=on&&settings.streaks;streaks.strength=settings.streakAmount;streaks.horizontal.uniforms.stretch.value=settings.streakLength;
  impactPost.pass.enabled=impactPost.pass.enabled&&on&&settings.shock;
  storm.setLensOptions({enabled:on&&settings.rain,strength:settings.rainAmount,preview:on&&settings.rain&&settings.forceRain});
  storm.lensPass.enabled=on&&settings.rain&&(settings.forceRain||(world.weather==='rain'&&mode!=='menu'&&mode!=='transition'));
  grade.enabled=on&&settings.grade;grade.uniforms.amount.value=settings.gradeAmount;grade.uniforms.saturation.value=settings.saturation;
  const mapping={aces:T.ACESFilmicToneMapping,agx:T.AgXToneMapping,neutral:T.NeutralToneMapping,none:T.NoToneMapping};
  renderer.toneMapping=on&&settings.grade?mapping[settings.tone]:T.ACESFilmicToneMapping;
  // updateStageLighting supplies a fresh baseline immediately before this call.
  renderer.toneMappingExposure*=on&&settings.grade?settings.exposure:1;
  smaa.enabled=on&&settings.aa==='smaa';fxaa.enabled=on&&settings.aa==='fxaa';
  film.enabled=on&&(settings.vignette||settings.grain);film.uniforms.vignette.value=settings.vignette?settings.vignetteAmount:0;film.uniforms.grain.value=settings.grain?settings.grainAmount:0;film.uniforms.time.value=reduced.matches?0:time;
 }
 const launch=document.createElement('button');launch.id='fx-toggle';launch.textContent='FX';launch.title='Camera effects · F2';launch.setAttribute('aria-label','Camera effects debug panel');launch.setAttribute('aria-expanded','false');document.body.append(launch);
 const panel=document.createElement('aside');panel.id='fx-panel';panel.hidden=true;panel.setAttribute('aria-label','Camera effects debug panel');
 panel.innerHTML=`<div class="fx-heading"><strong>CAMERA / FX</strong><button type="button" id="fx-close" aria-label="Close camera effects">×</button></div><p class="fx-note">Safe preview · invulnerable · slow orbit · F2 closes</p><div id="fx-fields"></div><button type="button" id="fx-reset">Reset to subtle defaults</button><p class="fx-note">Settings saved on this browser. Rain preview also works in dry scenes.</p>`;
 document.body.append(panel);const fields=panel.querySelector('#fx-fields'),controls=new Map();
 function toggle(key,label){const row=document.createElement('label');row.className='fx-row';row.innerHTML=`<span>${label}</span><input type="checkbox" data-fx="${key}">`;const input=row.querySelector('input');input.addEventListener('change',()=>set({[key]:input.checked}));controls.set(key,input);fields.append(row)}
 function slider(key,label,step){const row=document.createElement('label');row.className='fx-slider';row.innerHTML=`<span>${label}<output></output></span><input type="range" data-fx="${key}" min="${ranges[key][0]}" max="${ranges[key][1]}" step="${step}">`;const input=row.querySelector('input');input.addEventListener('input',()=>set({[key]:+input.value}));controls.set(key,input);fields.append(row)}
 function select(key,label,labels){const row=document.createElement('label');row.className='fx-row';row.innerHTML=`<span>${label}</span><select data-fx="${key}">${choices[key].map((v,i)=>`<option value="${v}">${labels[i]}</option>`).join('')}</select>`;const input=row.querySelector('select');input.addEventListener('change',()=>set({[key]:input.value}));controls.set(key,input);fields.append(row)}
 toggle('enabled','All camera FX');toggle('sketch','Pencil / sketch');slider('sketchAmount','Sketch blend',.05);slider('sketchWeight','Pencil weight',.05);slider('sketchHatching','Crosshatching',.05);slider('sketchPaper','Paper texture',.05);slider('sketchColour','Coloured pencil',.05);select('aa','Anti-aliasing',['SMAA · quality','FXAA · fast','Off']);
 toggle('motion','Motion blur');slider('motionAmount','Shutter strength',.05);
 toggle('vignette','Vignette');slider('vignetteAmount','Edge shading',.01);
 toggle('grain','Film grain');slider('grainAmount','Grain strength',.002);
 toggle('grade','Colour mapping');select('tone','Tone mapper',['ACES Filmic','AgX','Neutral','None']);slider('gradeAmount','Warm/cool balance',.05);slider('saturation','Saturation',.01);slider('exposure','Exposure multiplier',.01);
 toggle('streaks','Anamorphic light streaks');slider('streakAmount','Streak strength',.02);slider('streakLength','Streak length',.01);
 toggle('rain','Lens rain droplets');slider('rainAmount','Drop refraction',.1);toggle('forceRain','Preview rain in every scene');
 toggle('bloom','Bloom');toggle('shock','Hit ripples / quakes');
 function syncUI(){for(const [key,input] of controls){if(input.type==='checkbox')input.checked=settings[key];else input.value=settings[key];if(input.type==='range')input.previousElementSibling.querySelector('output').value=Number(settings[key]).toFixed(key==='grainAmount'?3:2)}}
 function show(value){open=value;panel.hidden=!value;launch.setAttribute('aria-expanded',String(value));clearInput();if(value){if(document.pointerLockElement)document.exitPointerLock();panel.querySelector('#fx-close').focus()}else document.querySelector('#game').focus()}
 launch.addEventListener('click',()=>show(!open));panel.querySelector('#fx-close').addEventListener('click',()=>show(false));panel.querySelector('#fx-reset').addEventListener('click',()=>set(defaults));
 // UI events never leak into sword, movement, camera-orbit or scene-skip input.
 for(const event of ['pointerdown','mousedown','mouseup','mousemove','wheel','keyup'])panel.addEventListener(event,e=>e.stopPropagation());
 panel.addEventListener('keydown',e=>{if(e.code==='F2'||e.code==='Escape'){e.preventDefault();show(false)}e.stopPropagation()});
 window.addEventListener('keydown',e=>{if(e.code==='F2'||(e.code==='Escape'&&open)){e.preventDefault();e.stopImmediatePropagation();if(!e.repeat)show(e.code==='Escape'?false:!open)}},true);
 syncUI();save();document.querySelector('#game').tabIndex=0;document.querySelector('#vignette').style.display='none';
 function captureQuality(){
  const passes=[motion,smaa,fxaa,sketchAA],enabled=passes.map(pass=>pass.enabled);
  motion.enabled=false;smaa.enabled=true;fxaa.enabled=false;sketchAA.enabled=sketch.enabled;
  return ()=>passes.forEach((pass,index)=>pass.enabled=enabled[index]);
 }
 return {captureQuality,settings,set,update,resize,show,get panelOpen(){return open},get autoOrbit(){return open&&!reduced.matches},get state(){return {settings:{...settings},panelOpen:open,stage:lastStage,motionStrength:motion.uniforms.strength.value,reducedMotion:reduced.matches,aaSize:[size.x,size.y],passes:composer.passes.map(p=>({name:p.constructor.name==='ShaderPass'?p.material.name:p.constructor.name,enabled:p.enabled})),streakSize:[streaks.bright.width,streaks.bright.height]}}};
}
