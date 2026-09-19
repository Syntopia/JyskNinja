import {Vector3} from '../vendor/three/build/three.module.js';
// Keep the orbit relative to the current focus point. World-position damping
// changes the apparent distance during knockback, stopping, and height changes.
export function placeFollowCamera(camera,target,yaw,pitch,distance,shake=0){
 camera.position.set(
  target.x+Math.sin(yaw)*Math.cos(pitch)*distance,
  target.y+Math.sin(pitch)*distance,
  target.z+Math.cos(yaw)*Math.cos(pitch)*distance
 );
 const aim=target.clone();
 // Impact feedback changes aim only; it never changes the follow distance.
 if(shake>0){const side=new Vector3(Math.cos(yaw),0,-Math.sin(yaw));aim.addScaledVector(side,(Math.random()-.5)*shake);aim.y+=(Math.random()-.5)*shake}
 camera.lookAt(aim);
}
// Cut a softly dithered sightline through obstructing scenery. This applies only
// to world materials, leaving characters, weapons and physics shapes untouched.
export function createSceneryFade(materials){
 const uniforms={followEye:{value:new Vector3()},followFocus:{value:new Vector3()},followFadeEnabled:{value:0}};
 const registered=new WeakSet();
 function add(list){for(const material of list){
  // Cloth must occlude naturally even when it crosses the camera sightline.
  if(material.userData.noCameraFade||/woven|cloth|fabric|flag|ensign/i.test(material.name))continue;
  if(registered.has(material))continue;registered.add(material);
  const previous=material.onBeforeCompile,previousKey=material.customProgramCacheKey();
  material.onBeforeCompile=shader=>{
   previous.call(material,shader);
   Object.assign(shader.uniforms,uniforms);
   shader.vertexShader='varying vec3 followWorldPosition;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
    followWorldPosition=(modelMatrix*vec4(transformed,1.0)).xyz;`);
   shader.fragmentShader=`uniform vec3 followEye;
    uniform vec3 followFocus;
    uniform float followFadeEnabled;
    varying vec3 followWorldPosition;\n`+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
    if(followFadeEnabled>0.5){
     vec3 sight=followFocus-followEye;
     float sightLength=length(sight);
     vec3 axis=sight/max(sightLength,0.001);
     vec3 relative=followWorldPosition-followEye;
     float along=dot(relative,axis);
     float coverage=0.0;
     if(along>0.02 && along<sightLength-0.12){
      float radial=length(relative-axis*along);
      coverage=1.0-smoothstep(0.60,1.25,radial);
     }
     coverage=max(coverage,1.0-smoothstep(0.18,0.45,length(relative)));
     float threshold=fract(52.9829189*fract(dot(floor(gl_FragCoord.xy),vec2(0.06711056,0.00583715))));
     if(coverage>threshold)discard;
    }`);
  };
  material.customProgramCacheKey=()=> previousKey+'-jysk-ninja-scenery-sightline-v2';
  material.needsUpdate=true;
 }
 }
 add(materials);
 return {add,update(eye,focus,enabled=true){uniforms.followEye.value.copy(eye);uniforms.followFocus.value.copy(focus);uniforms.followFadeEnabled.value=enabled?1:0}};
}
