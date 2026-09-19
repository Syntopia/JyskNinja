import * as T from 'three';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
// Intersect each view ray with the finite light cone, stop at scene depth, then
// integrate only that interval. A surface cone cannot represent an inside view.
export class SearchlightVolumePass extends ShaderPass{
 constructor(camera){super({name:'Depth-aware projector scattering',uniforms:{tDiffuse:{value:null},tDepth:{value:null},tShadow:{value:null},inverseVP:{value:new T.Matrix4()},shadowMatrix:{value:new T.Matrix4()},eye:{value:new T.Vector3()},source:{value:new T.Vector3()},axis:{value:new T.Vector3(0,0,1)},color:{value:new T.Color(0xe1efff)},cosOuter:{value:Math.cos(.18)},cosInner:{value:Math.cos(.081)},range:{value:55},density:{value:.045},time:{value:0},hasShadow:{value:0}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`
 #include <packing>
 uniform sampler2D tDiffuse,tDepth,tShadow;
 uniform mat4 inverseVP,shadowMatrix;uniform vec3 eye,source,axis,color;
 uniform float cosOuter,cosInner,range,density,time,hasShadow;varying vec2 vUv;
 bool interval(vec3 ray,float limit,out float lo,out float hi){
  vec3 o=eye-source;float ca=dot(o,axis),da=dot(ray,axis);lo=0.;hi=limit;
  if(abs(da)<.000001){if(ca<0.||ca>range)return false;}
  else{float a=-ca/da,b=(range-ca)/da;lo=max(lo,min(a,b));hi=min(hi,max(a,b));}
  if(hi<=lo)return false;
  float k=cosOuter*cosOuter,A=da*da-k,B=2.*(da*ca-k*dot(ray,o)),C=ca*ca-k*dot(o,o);
  if(abs(A)<.000001){if(abs(B)<.000001){if(C<0.)return false;}else if(B>0.)lo=max(lo,-C/B);else hi=min(hi,-C/B);}
  else{float D=B*B-4.*A*C;if(D<0.){if(A<0.)return false;}else{
   float s=sqrt(D),a=(-B-s)/(2.*A),b=(-B+s)/(2.*A),r0=min(a,b),r1=max(a,b);
   if(A<0.){lo=max(lo,r0);hi=min(hi,r1);}else if(lo<r0){hi=min(hi,r0);}else{lo=max(lo,r1);}
  }}return hi>lo;
 }
 float visibility(vec3 p){if(hasShadow<.5)return 1.;vec4 q=shadowMatrix*vec4(p,1.);vec3 uv=q.xyz/q.w;
  if(q.w<=0.||any(lessThan(uv,vec3(0.)))||any(greaterThan(uv,vec3(1.))))return 0.;
  float depth=unpackRGBAToDepth(texture2D(tShadow,uv.xy));return smoothstep(uv.z-.0012,uv.z+.0002,depth);
 }
 void main(){
  float depth=texture2D(tDepth,vUv).r;vec3 base=texture2D(tDiffuse,vUv).rgb;
  // Preserve scene depth for the following camera-motion pass.
  gl_FragDepth=depth;
  vec4 w=inverseVP*vec4(vUv*2.-1.,depth*2.-1.,1.);w/=w.w;
  vec3 delta=w.xyz-eye;float limit=length(delta);vec3 ray=delta/max(limit,.00001);float lo,hi;
  if(!interval(ray,limit,lo,hi)){gl_FragColor=vec4(base,1.);return;}
  float stepLength=(hi-lo)/12.,sum=0.;
  for(int i=0;i<12;i++){
   float t=lo+(float(i)+.5)*stepLength;vec3 p=eye+ray*t,d=p-source;float distanceToLight=length(d);
   float edge=smoothstep(cosOuter,cosInner,dot(d,axis)/max(distanceToLight,.0001));
   float extinction=64./(64.+distanceToLight*distanceToLight);
   float noise=.94+.06*sin(p.x*.9+p.y*1.7+p.z*.35-time*.55);
   float nearFade=smoothstep(.05,.55,t),surfaceFade=smoothstep(0.,.20,limit-t);
   sum+=edge*extinction*noise*nearFade*surfaceFade*visibility(p)*stepLength;
  }
  // Bounded, subtle single scattering: retain the lit deck and dark silhouettes.
  float phase=.65+.35*pow(max(0.,dot(ray,-axis)),3.);
  float scatter=.075*(1.-exp(-sum*density*phase/.075));
  gl_FragColor=vec4(base+color*scatter,1.);
 }`});this.camera=camera;this.projector=null;this.enabled=false;this.material.depthTest=true;this.material.depthWrite=true;this.material.depthFunc=T.AlwaysDepth;this.material.toneMapped=false;}
 configure(projector,active){this.projector=projector;this.enabled=!!projector&&active;}
 render(renderer,write,read,dt,mask){const light=this.projector.light,u=this.uniforms;this.camera.updateMatrixWorld();u.inverseVP.value.multiplyMatrices(this.camera.projectionMatrix,this.camera.matrixWorldInverse).invert();this.camera.getWorldPosition(u.eye.value);light.getWorldPosition(u.source.value);light.target.getWorldPosition(u.axis.value).sub(u.source.value).normalize();u.cosOuter.value=Math.cos(light.angle);u.cosInner.value=Math.cos(light.angle*(1-light.penumbra));u.color.value.copy(light.color);u.time.value=this.projector.state.time;u.tDepth.value=read.depthTexture;u.hasShadow.value=light.shadow.map?1:0;u.tShadow.value=light.shadow.map?.texture||read.texture;u.shadowMatrix.value.copy(light.shadow.matrix);super.render(renderer,write,read,dt,mask);}
}
