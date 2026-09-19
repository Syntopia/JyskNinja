import * as T from 'three';

// A small directional spectrum: long swell carries shorter wind waves. Every
// slope comes from the same height function; no position-dependent height gain.
const spectrum=`
uniform float oceanTime;
void oceanWave(vec2 p, vec2 direction, float wavelength, float amplitude, float phase,
               inout float height, inout vec2 slope) {
 float k=6.28318530718/wavelength;
 float a=dot(direction,p)*k-sqrt(9.81*k)*oceanTime+phase;
 height+=amplitude*sin(a);slope+=amplitude*k*cos(a)*direction;
}
void oceanSurface(vec2 p,out float height,out vec2 slope){
 height=0.;slope=vec2(0.);
 oceanWave(p,normalize(vec2(.80,.60)),37.,.46,.7,height,slope);
 oceanWave(p,normalize(vec2(.43,.90)),23.3,.26,2.3,height,slope);
 oceanWave(p,normalize(vec2(.95,.31)),14.7,.15,4.1,height,slope);
 oceanWave(p,normalize(vec2(-.12,.99)),9.1,.080,1.3,height,slope);
 oceanWave(p,normalize(vec2(.68,.73)),5.3,.038,5.7,height,slope);
 oceanWave(p,normalize(vec2(-.58,.81)),3.7,.018,3.4,height,slope);
}`;
const noise=`
float oceanHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float oceanNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(oceanHash(i),oceanHash(i+vec2(1,0)),f.x),mix(oceanHash(i+vec2(0,1)),oceanHash(i+1.),f.x),f.y);}
`;
export function ferryOcean(time){
 const material=new T.MeshPhysicalMaterial({name:'Ferry directional ocean',color:0x17323b,roughness:.27,metalness:0,ior:1.333,clearcoat:.45,clearcoatRoughness:.22,envMapIntensity:1.1});
 material.onBeforeCompile=s=>{
  s.uniforms.oceanTime=time;
  s.vertexShader=spectrum+'\nvarying vec2 oceanXZ;varying vec2 oceanSlope;varying float oceanHeight;\n'+s.vertexShader;
  s.vertexShader=s.vertexShader.replace('#include <beginnormal_vertex>',`#include <beginnormal_vertex>
   float oceanH;vec2 oceanD; oceanSurface(position.xz,oceanH,oceanD);
   objectNormal=normalize(vec3(-oceanD.x,1.,-oceanD.y));`);
  s.vertexShader=s.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
   transformed.y+=oceanH;oceanXZ=position.xz;oceanSlope=oceanD;oceanHeight=oceanH;`);
  s.fragmentShader='uniform float oceanTime;varying vec2 oceanXZ;varying vec2 oceanSlope;varying float oceanHeight;\n'+noise+s.fragmentShader;
  s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   // Broken patches travel with the surface. Wake is broad turbulent water,
   // not floating geometry, and fades gradually behind the stern.
   vec2 drift=oceanXZ-vec2(.7,1.3)*oceanTime;
   float breakup=oceanNoise(drift*.7)*.4+oceanNoise(drift*2.1)*.4+oceanNoise(drift*6.3)*.2;
   float crestFoam=smoothstep(.53,.82,oceanHeight)*smoothstep(.51,.73,breakup)*.38;
   float stern=max(0.,oceanXZ.y-15.5);
   float wakeWidth=5.6+stern*.18;
   float wakeEdge=1.-smoothstep(wakeWidth*.45,wakeWidth,abs(oceanXZ.x)+(breakup-.5)*3.);
   float wakeLife=smoothstep(0.,4.,stern)*exp(-stern*.057);
   float wash=oceanNoise(vec2(oceanXZ.x*.47,(oceanXZ.y-oceanTime*3.1)*.35));
   float wakeFoam=wakeEdge*wakeLife*smoothstep(.42,.74,breakup+wash*.19)*.42;
   float hullBand=(1.-smoothstep(.2,1.5,abs(abs(oceanXZ.x)-9.1)))*(1.-smoothstep(12.,17.,abs(oceanXZ.y)));
   float hullFoam=hullBand*smoothstep(.49,.70,breakup)*.16;
   float oceanFoam=max(crestFoam,max(wakeFoam,hullFoam));
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.44,.52,.53),oceanFoam);
  `);
  s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_begin>',`#include <normal_fragment_begin>
   // Fine wind ripples fade at subpixel scale rather than sparkling at distance.
   vec2 rp=oceanXZ*vec2(4.1,5.3)+vec2(-2.1,1.5)*oceanTime;
   vec2 micro=.055*cos(rp)*clamp(vec2(1.)-fwidth(rp)*.6,vec2(0.),vec2(1.));
   normal=normalize(mat3(viewMatrix)*vec3(-oceanSlope.x-micro.x,1.,-oceanSlope.y-micro.y));
  `);
  s.fragmentShader=s.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\n roughnessFactor=mix(roughnessFactor,.65,oceanFoam);');
 };
 material.customProgramCacheKey=()=> 'ferry-directional-ocean-v1';
 // Concentrate vertices near the ship, with a continuous skirt to the horizon.
 const geometry=new T.PlaneGeometry(2,2,256,256);geometry.rotateX(-Math.PI/2);
 const pos=geometry.attributes.position;
 const spread=v=>v*60+v*v*v*340;
 for(let i=0;i<pos.count;i++)pos.setXYZ(i,spread(pos.getX(i)),0,spread(pos.getZ(i)));
 geometry.computeBoundingBox();geometry.computeBoundingSphere();
 return {material,geometry};
}
