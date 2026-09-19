import {Vector2,Vector4} from 'three';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';

// This pass warps the rendered image, never the camera, world, or DOM HUD.
export function createImpactPost(camera){
 const pulses=Array.from({length:3},()=>new Vector4(.5,.5,10,0));
 const pass=new ShaderPass({name:'Sword contact shockwave',uniforms:{tDiffuse:{value:null},aspect:{value:innerWidth/innerHeight},pulses:{value:pulses},jolt:{value:new Vector2()},roll:{value:0},flash:{value:0}},
 vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
 fragmentShader:`uniform sampler2D tDiffuse;uniform float aspect;uniform vec4 pulses[3];uniform vec2 jolt;uniform float roll;uniform float flash;varying vec2 vUv;
 void main(){
  vec2 pixelAspect=vec2(aspect,1.);vec2 center=(vUv-.5)*pixelAspect;float c=cos(roll),s=sin(roll);vec2 uv=(mat2(c,-s,s,c)*center)/pixelAspect+.5+jolt;
  vec2 bend=vec2(0.);float fringe=0.;
  for(int i=0;i<3;i++){
   vec4 p=pulses[i];float t=p.z;if(t<.58&&p.w>0.){
    vec2 delta=(vUv-p.xy)*pixelAspect;float dist=length(delta);float radius=.035+t*2.5;float ring=exp(-pow((dist-radius)/.075,2.));float envelope=pow(max(0.,1.-t/.58),2.);
    vec2 direction=delta/max(dist,.001);float ripple=sin((dist-radius)*44.)*ring*envelope*p.w;
    bend+=direction/pixelAspect*ripple*.021;fringe+=ring*envelope*p.w*.0013;
   }
  }
  // Clamp sampling at the edge so a jolt cannot expose black borders.
  uv=clamp(uv+bend,vec2(.002),vec2(.998));vec2 split=vec2(fringe/aspect,0.);
  vec3 color; color.r=texture2D(tDiffuse,clamp(uv+split,vec2(.002),vec2(.998))).r;color.g=texture2D(tDiffuse,uv).g;color.b=texture2D(tDiffuse,clamp(uv-split,vec2(.002),vec2(.998))).b;
  color+=vec3(.07,.045,.018)*flash;gl_FragColor=vec4(color,1.);
 }`});
 pass.enabled=false;
 // ShaderPass clones uniforms, so update its own vectors rather than the seed array.
 const slots=pass.uniforms.pulses.value,reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let cursor=0,count=0,quakeAge=10,quakePower=0,last=null;
 function trigger(point,{heavy=false,lethal=false}={}){
  camera.updateMatrixWorld();const projected=point.clone().project(camera);
  if(projected.z< -1||projected.z>1||Math.abs(projected.x)>1.1||Math.abs(projected.y)>1.1)return false;
  const power=Math.min(1.2,(heavy?1:.62)+(lethal?.2:0))*(reduced.matches?.18:1);
  const uv=new Vector2(projected.x*.5+.5,projected.y*.5+.5);slots[cursor].set(uv.x,uv.y,0,power);cursor=(cursor+1)%slots.length;
  quakeAge=0;quakePower=power;count++;last={center:uv.toArray(),heavy,lethal,power};pass.enabled=true;return true;
 }
 function update(dt,mode){
  if(mode==='menu'){reset();return}if(mode==='paused'){pass.enabled=false;return}
  quakeAge+=dt;let alive=false;for(const p of slots){p.z+=dt;if(p.z<.58&&p.w>0)alive=true}
  const envelope=Math.pow(Math.max(0,1-quakeAge/.22),2)*quakePower;
  pass.uniforms.jolt.value.set(Math.sin(quakeAge*123)*.007*envelope/camera.aspect,Math.sin(quakeAge*97+.8)*.004*envelope);
  pass.uniforms.roll.value=Math.sin(quakeAge*86)*.004*envelope;
  pass.uniforms.flash.value=Math.exp(-quakeAge*45)*quakePower;
  pass.uniforms.aspect.value=camera.aspect;pass.enabled=alive;
 }
 function reset(){for(const p of slots){p.z=10;p.w=0}quakeAge=10;quakePower=0;pass.enabled=false;pass.uniforms.jolt.value.set(0,0);pass.uniforms.roll.value=pass.uniforms.flash.value=0;last=null}
 return {pass,trigger,update,reset,get state(){return {enabled:pass.enabled,count,last,activePulses:slots.filter(p=>p.z<.58&&p.w>0).length,ages:slots.map(p=>p.z),jolt:pass.uniforms.jolt.value.toArray(),aspect:pass.uniforms.aspect.value,reducedMotion:reduced.matches}}};
}
