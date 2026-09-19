import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t)};
export function createDeathCinematic(composer){
 const pass=new ShaderPass({name:'Hero death • greyscale fade',uniforms:{tDiffuse:{value:null},amount:{value:0}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform sampler2D tDiffuse;uniform float amount;varying vec2 vUv;void main(){vec4 c=texture2D(tDiffuse,vUv);float grey=dot(c.rgb,vec3(.2126,.7152,.0722));gl_FragColor=vec4(mix(c.rgb,vec3(grey),amount),c.a);}'});
 pass.enabled=false;composer.addPass(pass);let active=false,elapsed=0;
 return {start(){active=true;elapsed=0;pass.enabled=true;pass.uniforms.amount.value=0},reset(){active=false;elapsed=0;pass.enabled=false;pass.uniforms.amount.value=0},update(dt){if(active){elapsed+=Math.min(dt,.1);pass.uniforms.amount.value=smooth(elapsed/1.8)}},get timeScale(){return active?1-.72*smooth(elapsed/.18):1},get state(){return {active,elapsed,timeScale:this.timeScale,greyscale:pass.uniforms.amount.value}}};
}
