import * as T from 'three';
import {Reflector} from 'three/addons/objects/Reflector.js';

const noise=`float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}`;

export function trainAtmosphere(root,layout){
 const clock={value:0};
 const sky=new T.Mesh(new T.SphereGeometry(365,36,24),new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{time:clock},vertexShader:'varying vec3 direction;void main(){direction=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`uniform float time;varying vec3 direction;${noise}
 void main(){vec3 d=normalize(direction);vec2 p=d.xz/(abs(d.y)+.23)*3.2+vec2(time*.006,0.);float n=noise(p)*.53+noise(p*2.15)*.27+noise(p*4.4)*.14+noise(p*9.)*.06;float sun=max(0.,dot(d,normalize(vec3(.52,.43,-1.))));vec3 c=mix(vec3(.105,.13,.17),vec3(.34,.36,.37),smoothstep(.20,.80,n));c+=vec3(.70,.54,.32)*pow(sun,35.)*.5;c+=vec3(5.,4.35,3.4)*pow(sun,720.)*(.35+n*.65);c=mix(c,vec3(.27,.31,.34),exp(-abs(d.y)*14.)*.38);gl_FragColor=vec4(c,1.);}`}));sky.name='Sun breaking through train corridor clouds';sky.renderOrder=-10;root.add(sky);
 // A single reflection render, masked to the real coach roofs and their gaps.
 const roofMask=layout.lanes.map(l=>`{float z=vWorld.z-(${l.offset.toFixed(2)});float edge=1.-smoothstep(.76,1.30,abs(vWorld.x-(${l.x.toFixed(2)})));${layout.cars.map(c=>`if(z>${(c.start+(c.nose?10:0)).toFixed(2)}&&z<${c.end.toFixed(2)})mask=max(mask,edge);`).join('')}}`).join('\n');
 const shader={uniforms:T.UniformsUtils.clone(Reflector.ReflectorShader.uniforms),vertexShader:'uniform mat4 textureMatrix;varying vec4 reflection;varying vec3 vWorld;void main(){vWorld=(modelMatrix*vec4(position,1.)).xyz;reflection=textureMatrix*vec4(position,1.);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`uniform sampler2D tDiffuse;varying vec4 reflection;varying vec3 vWorld;${noise}
 void main(){float mask=0.;${roofMask}if(mask<.01)discard;vec2 uv=reflection.xy/reflection.w;vec2 q=uv+(vec2(noise(vWorld.xz*19.),noise(vWorld.xz*31.))-.5)*.0011;vec3 c=texture2D(tDiffuse,q).rgb*.5;c+=texture2D(tDiffuse,q+vec2(.0012,.0005)).rgb*.25;c+=texture2D(tDiffuse,q-vec2(.0012,.0005)).rgb*.25;float wet=.4+.6*noise(vWorld.xz*2.7);gl_FragColor=vec4(min(c,vec3(4.)),mask*wet*.26);}`};
 const reflection=new Reflector(new T.PlaneGeometry(16,116),{textureWidth:768,textureHeight:768,clipBias:.002,multisample:0,shader});reflection.name='Wet enamel roof reflections';reflection.rotation.x=-Math.PI/2;reflection.position.set(0,.018,8);reflection.material.transparent=true;reflection.material.depthWrite=false;root.add(reflection);
 const draw=reflection.onBeforeRender;let last=-1;
 reflection.onBeforeRender=function(...args){
  if(!this.userData.captureRefresh&&last===clock.value)return;last=clock.value;
  // Distant foliage is already present in the rough environment reflections.
  // Keep this sharper pass for fighters, coaches and passing overhead steelwork.
  const hidden=[],scenery=root.getObjectByName('Recycled high-speed scenery');
  for(const o of scenery?.children||[])if(o.visible&&o.name!=='Passing catenary gantries'){hidden.push(o);o.visible=false}
  try{draw.apply(this,args)}finally{for(const o of hidden)o.visible=true}
 };
 for(const [x,y,z,width,height,opacity] of [[-48,1,-65,75,7,.17],[42,2,-105,95,10,.18],[-30,6,-170,200,13,.23]]){
  const mist=new T.Mesh(new T.PlaneGeometry(width,height),new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,uniforms:{time:clock},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`uniform float time;varying vec2 vUv;${noise}void main(){float feather=sin(vUv.x*3.14159)*pow(sin(vUv.y*3.14159),2.);float n=noise(vUv*vec2(9.,3.)+vec2(time*.018,0.));gl_FragColor=vec4(.53,.60,.63,feather*(.2+n*.8)*${opacity.toFixed(2)});}`}));mist.position.set(x,y,z);mist.name='Forest valley mist';root.add(mist);
 }
 return {reflection,update(t){clock.value=t},reset(){last=-1;clock.value=0}};
}
