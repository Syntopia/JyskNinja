import * as T from 'three';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {Pass,FullScreenQuad} from 'three/addons/postprocessing/Pass.js';
const vertexShader='varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}';

// Current-frame depth reprojection: no accumulated frames or persistent ghosts.
// This captures camera motion; animated limbs do not have object velocity buffers.
export class CameraMotionPass extends ShaderPass{
 constructor(){super({name:'Depth-aware camera motion blur',uniforms:{tDiffuse:{value:null},tDepth:{value:null},inverseVP:{value:new T.Matrix4()},previousVP:{value:new T.Matrix4()},strength:{value:0},pixels:{value:new T.Vector2(1,1)}},vertexShader,fragmentShader:`
 uniform sampler2D tDiffuse,tDepth;uniform mat4 inverseVP,previousVP;uniform float strength;uniform vec2 pixels;varying vec2 vUv;
 void main(){float depth=texture2D(tDepth,vUv).r;vec4 world=inverseVP*vec4(vUv*2.-1.,depth*2.-1.,1.);world/=world.w;
 vec4 old=previousVP*world;vec2 velocity=(vUv-(old.xy/max(old.w,.001)*.5+.5))*strength;
 float speed=length(velocity*pixels);velocity*=min(1.,12./max(speed,.001));
 vec3 sum=texture2D(tDiffuse,vUv).rgb;float weight=1.;
 if(depth<.99999&&old.w>0.&&speed>.25){for(int i=1;i<=6;i++){float t=float(i)/6.;vec2 q=clamp(vUv-velocity*t,vec2(.001),vec2(.999));float other=texture2D(tDepth,q).r;
 float w=(1.-t*.45)*step(abs(other-depth),max(.00015,(1.-depth)*.12));sum+=texture2D(tDiffuse,q).rgb*w;weight+=w;}}
 gl_FragColor=vec4(sum/weight,1.);}`});this.material.depthWrite=false;this.material.depthTest=false}
 render(renderer,write,read,dt,mask){this.uniforms.tDepth.value=read.depthTexture;super.render(renderer,write,read,dt,mask)}
 setSize(w,h){this.uniforms.pixels.value.set(w,h)}
}

export class LightStreakPass extends Pass{
 constructor(){super();const options={type:T.HalfFloatType,depthBuffer:false};this.bright=new T.WebGLRenderTarget(1,1,options);this.blur=new T.WebGLRenderTarget(1,1,options);this.strength=.18;
  const mat=(uniforms,fragmentShader)=>new T.ShaderMaterial({uniforms,vertexShader,fragmentShader,depthTest:false,depthWrite:false});
  this.extract=mat({source:{value:null},pixel:{value:new T.Vector2()}},`uniform sampler2D source;uniform vec2 pixel;varying vec2 vUv;
  void main(){vec3 c=vec3(0.);for(int i=0;i<4;i++){vec2 offset=vec2(mod(float(i),2.)-.5,floor(float(i)/2.)-.5)*pixel;vec3 s=texture2D(source,vUv+offset).rgb;float b=max(s.r,max(s.g,s.b));c+=s*smoothstep(1.6,3.2,b)*.25;}gl_FragColor=vec4(min(c,vec3(8.)),1.);}`);
  this.horizontal=mat({source:{value:null},stretch:{value:.12}},`uniform sampler2D source;uniform float stretch;varying vec2 vUv;
  void main(){vec3 c=vec3(0.);float total=0.;for(int i=-16;i<=16;i++){float x=float(i)/16.;float w=exp(-x*x*3.5);c+=texture2D(source,clamp(vUv+vec2(x*stretch,0.),vec2(.001),vec2(.999))).rgb*w;total+=w;}gl_FragColor=vec4(c/total,1.);}`);
  this.combine=mat({source:{value:null},streak:{value:null},strength:{value:.18}},`uniform sampler2D source,streak;uniform float strength;varying vec2 vUv;void main(){vec3 c=texture2D(source,vUv).rgb;vec3 s=texture2D(streak,vUv).rgb;gl_FragColor=vec4(c+s*vec3(.70,.85,1.)*strength,1.);}`);
  this.quad=new FullScreenQuad(this.extract);
 }
 setSize(w,h){this.bright.setSize(Math.max(1,Math.ceil(w/8)),Math.max(1,Math.ceil(h/4)));this.blur.setSize(this.bright.width,this.bright.height);this.extract.uniforms.pixel.value.set(1/w,1/h)}
 render(r,write,read){this.extract.uniforms.source.value=read.texture;this.quad.material=this.extract;r.setRenderTarget(this.bright);this.quad.render(r);this.horizontal.uniforms.source.value=this.bright.texture;this.quad.material=this.horizontal;r.setRenderTarget(this.blur);this.quad.render(r);this.combine.uniforms.source.value=read.texture;this.combine.uniforms.streak.value=this.blur.texture;this.combine.uniforms.strength.value=this.strength;this.quad.material=this.combine;r.setRenderTarget(this.renderToScreen?null:write);this.quad.render(r)}
 dispose(){this.bright.dispose();this.blur.dispose();this.extract.dispose();this.horizontal.dispose();this.combine.dispose();this.quad.dispose()}
}

export function gradePass(){return new ShaderPass({name:'Gentle cinematic colour grade',uniforms:{tDiffuse:{value:null},amount:{value:.25},saturation:{value:1.03}},vertexShader,fragmentShader:`uniform sampler2D tDiffuse;uniform float amount,saturation;varying vec2 vUv;
 void main(){vec3 c=texture2D(tDiffuse,vUv).rgb;float lum=dot(c,vec3(.2126,.7152,.0722));vec3 tint=mix(vec3(.92,1.005,1.055),vec3(1.05,1.015,.96),smoothstep(.08,1.3,lum));c=mix(c,c*tint,amount);c=mix(vec3(dot(c,vec3(.2126,.7152,.0722))),c,saturation);gl_FragColor=vec4(max(c,0.),1.);}`})}
export function filmPass(){return new ShaderPass({name:'Lens vignette and fine film grain',uniforms:{tDiffuse:{value:null},vignette:{value:.18},grain:{value:.022},time:{value:0},pixels:{value:new T.Vector2(1,1)}},vertexShader,fragmentShader:`uniform sampler2D tDiffuse;uniform float vignette,grain,time;uniform vec2 pixels;varying vec2 vUv;
 float hash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
 void main(){vec3 c=texture2D(tDiffuse,vUv).rgb;vec2 p=(vUv-.5)*vec2(1.,.84);float edge=smoothstep(.20,.67,length(p));c*=1.-edge*vignette;
 float noise=(hash(floor(vUv*pixels)+vec2(mod(floor(time*24.),127.),17.))- .5);float lum=dot(c,vec3(.2126,.7152,.0722));c+=noise*grain*(.6+.4*(1.-lum));gl_FragColor=vec4(clamp(c,0.,1.),1.);}`})}
