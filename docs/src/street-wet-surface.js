import * as T from 'three';
import {Reflector} from 'three/addons/objects/Reflector.js';

export function makePuddleMask(puddles,width=256,height=2048){
 const data=new Uint8Array(width*height),bounds={minX:-4.8,minZ:-64,width:9.6,length:74};
 for(const [x,,z,rx,rz] of puddles){
  const x0=Math.max(0,Math.floor((x-rx-bounds.minX)/bounds.width*width)),x1=Math.min(width-1,Math.ceil((x+rx-bounds.minX)/bounds.width*width));
  const y0=Math.max(0,Math.floor((z-rz-bounds.minZ)/bounds.length*height)),y1=Math.min(height-1,Math.ceil((z+rz-bounds.minZ)/bounds.length*height));
  for(let j=y0;j<=y1;j++)for(let i=x0;i<=x1;i++){
   const px=bounds.minX+(i+.5)/width*bounds.width,pz=bounds.minZ+(j+.5)/height*bounds.length,d=Math.hypot((px-x)/rx,(pz-z)/rz);
   const t=T.MathUtils.clamp((d-.62)/.38,0,1),value=Math.round(255*(1-t*t*(3-2*t)));
   data[j*width+i]=Math.max(data[j*width+i],value);
  }
 }
 return {data,width,height,bounds};
}

// Ferry-style planar capture, shared by stone and puddle materials. Applying it
// to the actual stone faces preserves their height, gaps and bevels.
export function createStreetWetSurface(root,metadata){
 const mask=makePuddleMask(metadata.puddles||[]),maskTexture=new T.DataTexture(mask.data,mask.width,mask.height,T.RedFormat);
 maskTexture.minFilter=maskTexture.magFilter=T.LinearFilter;maskTexture.needsUpdate=true;
 const reflector=new Reflector(new T.PlaneGeometry(9.6,74),{textureWidth:768,textureHeight:512,clipBias:.002,multisample:0});
 reflector.name='Street wet-surface capture • shared ferry reflection';reflector.rotation.x=-Math.PI/2;reflector.position.set(0,.08,-27);
 reflector.material.colorWrite=false;reflector.material.depthWrite=false;reflector.material.depthTest=false;reflector.renderOrder=-10000;reflector.frustumCulled=false;root.add(reflector);
 const uniforms={streetWetTexture:{value:null},streetPuddleMask:{value:maskTexture},streetWetMatrix:{value:new T.Matrix4()},streetWetTime:{value:0},streetWetReady:{value:0},streetWetCapture:{value:0}};
 const materials=new Set();root.traverse(o=>{if(o.isMesh&&o!==reflector&&o.material?.name&&/Rain-dark basalt|Rain puddles/.test(o.material.name))materials.add(o.material)});
 for(const material of materials){
  const puddle=material.name==='Rain puddles',previous=material.onBeforeCompile,previousKey=material.customProgramCacheKey();
  material.roughness=puddle?.07:.24;material.metalness=puddle?.05:.06;
  if(puddle){material.opacity=.72;material.depthWrite=false}
  material.onBeforeCompile=shader=>{
   previous.call(material,shader);Object.assign(shader.uniforms,uniforms);
   shader.vertexShader='varying vec3 vStreetWetWorld;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nvStreetWetWorld=(modelMatrix*vec4(transformed,1.)).xyz;');
   shader.fragmentShader=`varying vec3 vStreetWetWorld;
    uniform sampler2D streetWetTexture;uniform sampler2D streetPuddleMask;uniform mat4 streetWetMatrix;
    uniform float streetWetTime;uniform float streetWetReady;uniform float streetWetCapture;
    float streetHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float streetNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(streetHash(i),streetHash(i+vec2(1.,0.)),f.x),mix(streetHash(i+vec2(0.,1.)),streetHash(i+1.),f.x),f.y);}
    float streetPuddle(){return ${puddle?'1.':'texture2D(streetPuddleMask,(vStreetWetWorld.xz-vec2(-4.8,-64.))/vec2(9.6,74.)).r'};}
   `+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
    if(streetWetCapture>.5&&vStreetWetWorld.y<.65&&abs(vStreetWetWorld.x)<4.8)discard;`);
   shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
    if(vStreetWetWorld.y<.65)roughnessFactor=mix(.23+.10*streetNoise(vStreetWetWorld.xz*17.),.075,streetPuddle());`);
   shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
    if(streetWetReady>.5&&vStreetWetWorld.y<.65&&abs(vStreetWetWorld.x)<4.8){
     vec3 worldN=inverseTransformDirection(normal,viewMatrix);
     float upward=smoothstep(.5,.92,worldN.y);
     float pool=streetPuddle();vec2 ground=vStreetWetWorld.xz;
     vec4 reflected=streetWetMatrix*vec4(vStreetWetWorld,1.);vec2 uv=reflected.xy/reflected.w;
     vec2 ripple=vec2(sin(ground.x*37.+streetWetTime*3.)+sin(ground.y*24.-streetWetTime*2.),cos(ground.y*41.+streetWetTime*2.4))*.00065;
     vec2 surface=(vec2(streetNoise(ground*13.2+streetWetTime*.14),streetNoise(ground*17.3-streetWetTime*.1))-.5)*.004;
     vec2 q=uv+mix(surface*.65,ripple+surface*.45,pool);
     float blur=mix(.009,.0018,pool);
     vec3 reflectedColor=texture2D(streetWetTexture,q).rgb*.36;
     reflectedColor+=texture2D(streetWetTexture,q+vec2(blur,0.)).rgb*.16;
     reflectedColor+=texture2D(streetWetTexture,q-vec2(blur,0.)).rgb*.16;
     reflectedColor+=texture2D(streetWetTexture,q+vec2(0.,blur)).rgb*.16;
     reflectedColor+=texture2D(streetWetTexture,q-vec2(0.,blur)).rgb*.16;
     reflectedColor=min(reflectedColor,vec3(5.))*(.82+.18*streetNoise(ground*82.));
     float grazing=pow(1.-clamp(dot(normal,normalize(vViewPosition)),0.,1.),3.);
     float strength=mix(.17+.24*grazing,.63+.22*grazing,pool)*upward;
     strength*=smoothstep(0.,.025,q.x)*smoothstep(0.,.025,q.y)*smoothstep(0.,.025,1.-q.x)*smoothstep(0.,.025,1.-q.y);
     outgoingLight=mix(outgoingLight,reflectedColor,strength);
    }
    #include <opaque_fragment>`);
  };
  material.customProgramCacheKey=()=>previousKey+'-street-wet-ferry-v1-'+puddle;material.needsUpdate=true;
 }
 const reflect=reflector.onBeforeRender,inverse=new T.Matrix4(),lastCamera=new T.Matrix4();let lastTime=-1,captures=0,capturing=false;
 reflector.onBeforeRender=function(renderer,scene,camera,...args){
  if(capturing||(!this.userData.captureRefresh&&lastTime===uniforms.streetWetTime.value&&lastCamera.equals(camera.matrixWorld)))return;
  capturing=true;const hidden=[];
  scene.traverse(o=>{if(o.visible&&(o.isPoints||o.isLineSegments||(o.isReflector&&o!==reflector))){hidden.push(o);o.visible=false}});
  // Unbind the target while rendering into it: suppressing the blend alone
  // still creates an illegal WebGL texture feedback loop.
  uniforms.streetWetTexture.value=null;uniforms.streetWetReady.value=0;uniforms.streetWetCapture.value=1;
  try{reflect.call(this,renderer,scene,camera,...args);uniforms.streetWetMatrix.value.multiplyMatrices(reflector.material.uniforms.textureMatrix.value,inverse.copy(reflector.matrixWorld).invert());lastCamera.copy(camera.matrixWorld);lastTime=uniforms.streetWetTime.value;captures++;}
  finally{uniforms.streetWetTexture.value=reflector.getRenderTarget().texture;uniforms.streetWetReady.value=1;uniforms.streetWetCapture.value=0;for(const o of hidden)o.visible=true;capturing=false}
 };
 return {reflector,update(time){uniforms.streetWetTime.value=time},reset(){lastTime=-1},get stats(){return {capturePasses:1,resolution:[768,512],captures,stoneRoughness:.24,puddleRoughness:.075,puddleCount:metadata.puddles.length}},dispose(){maskTexture.dispose();reflector.geometry.dispose();reflector.dispose();reflector.removeFromParent()}};
}
