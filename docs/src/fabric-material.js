import * as T from 'three';
import {texture} from './surface.js';
// Art-directed wet wool approximation: absorption and compressed fibres, without
// treating the whole garment as a smooth water-coated dielectric.
export function makeWoolMaterial({name,color,side=T.FrontSide},wetness){
 const m=new T.MeshPhysicalMaterial({name,color,side,metalness:0,roughness:.9,clearcoat:0,sheen:.4,sheenRoughness:.95,specularIntensity:.32,envMapIntensity:.4});
 m.sheenColor.copy(m.color).lerp(new T.Color(0xb3b9b8),.25);
 m.roughnessMap=texture('cloth-roughness.jpg');m.normalMap=texture('cloth-normal.png');m.normalScale.set(.30,.30);m.userData.fabric='wet-wool';
 m.onBeforeCompile=shader=>{
  shader.uniforms.clothWetness=wetness;
  shader.vertexShader='varying vec3 vFabricRest;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n vFabricRest=position;');
  shader.fragmentShader='varying vec3 vFabricRest;\nuniform float clothWetness;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   // Object-rest coordinates keep moisture and fibres attached to animated cloth.
   float woolPatch=.5+.25*sin(dot(vFabricRest,vec3(9.,4.,7.)))+.25*sin(dot(vFabricRest,vec3(-5.,13.,11.)));
   float woolWet=clamp(clothWetness*(.72+.28*woolPatch),0.,1.);
   vec2 yarn=(vFabricRest.xy+vFabricRest.zy*.37)*vec2(1800.,1400.);
   vec2 yarnAA=1.-smoothstep(vec2(.6),vec2(2.5),fwidth(yarn));
   float fibre=dot(sin(yarn)*yarnAA,vec2(.5));
   diffuseColor.rgb*=(1.-.22*woolWet)*(.985+.015*fibre);
  `);
  shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
   // A high floor prevents the roughness texture from producing latex-like lobes.
   roughnessFactor=clamp(mix(.89,.77,woolWet)+(roughnessFactor-.75)*.16+.018*(woolPatch-.5),.72,.96);
  `);
 };
 m.customProgramCacheKey=()=> 'absorptive-woven-wool-v1';return m;
}
