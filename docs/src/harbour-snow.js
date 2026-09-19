import * as T from 'three';
import {createSnowField} from './snow-field.js';
import {HARBOUR_SNOW_SURFACES,snowSurfaceAt} from './snow-surfaces.js';
export function createHarbourSnow(root,solids){
 const patches=HARBOUR_SNOW_SURFACES.map(spec=>{
 const obstacles=solids.filter(s=>!s.broken&&s.box.min.y<spec.y+.4&&s.box.max.y>spec.y+.3).map(s=>({minX:s.box.min.x-spec.x,maxX:s.box.max.x-spec.x,minZ:s.box.min.z-spec.z,maxZ:s.box.max.z-spec.z}));
 const field=createSnowField({...spec,obstacles}),map=new T.DataTexture(field.data,field.size,field.size,T.RGBAFormat);map.minFilter=map.magFilter=T.LinearFilter;map.generateMipmaps=false;map.needsUpdate=true;map.name='Snow height and compaction • '+spec.id;
 const material=new T.MeshPhysicalMaterial({name:'Crystalline deformable snow • '+spec.id,color:0xe4eef5,roughness:.79,metalness:0,ior:1.31,clearcoat:.22,clearcoatRoughness:.25,envMapIntensity:.85});material.userData.noCameraFade=true;
 material.onBeforeCompile=s=>{
  s.uniforms.snowMap={value:map};s.uniforms.snowTexel={value:1/field.size};s.uniforms.snowSpan={value:new T.Vector2(field.width,field.depth)};
  const common='uniform sampler2D snowMap;uniform float snowTexel;uniform vec2 snowSpan;varying vec2 snowUV;\n';
  s.vertexShader=common+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
   snowUV=vec2(position.x/snowSpan.x+.5,position.z/snowSpan.y+.5);
   transformed.y=.012+texture2D(snowMap,snowUV).r*.26;`);
  s.fragmentShader=common+`float snowHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  `+s.fragmentShader;
  s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   vec4 snowSample=texture2D(snowMap,snowUV);float h=snowSample.r*.26;
   vec2 snowMeters=snowUV*snowSpan, crystalGrid=snowMeters*60.;
   float fleck=snowHash(floor(crystalGrid));
   if(h<.004+fleck*.003)discard;
   // Stable grains fade below a pixel: no time-driven flashing or emissive glitter.
   float grainAA=1.-smoothstep(.6,2.2,max(fwidth(crystalGrid.x),fwidth(crystalGrid.y)));
   float crystal=step(.92,fleck)*grainAA;
   diffuseColor.rgb*=mix(vec3(.98,1.,1.),vec3(.68,.79,.88),snowSample.g*.6);
   diffuseColor.rgb*=.97+fleck*.03*grainAA;`);
  s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
   float hx=(texture2D(snowMap,snowUV+vec2(snowTexel,0.)).r-texture2D(snowMap,snowUV-vec2(snowTexel,0.)).r)*.26/(2.*snowTexel*snowSpan.x);
   float hz=(texture2D(snowMap,snowUV+vec2(0.,snowTexel)).r-texture2D(snowMap,snowUV-vec2(0.,snowTexel)).r)*.26/(2.*snowTexel*snowSpan.y);
   vec2 micro=vec2(fleck-.5,snowHash(floor(crystalGrid)+vec2(7.,19.))-.5)*grainAA;
   // These microfacets use the real scene lighting and its shadow visibility.
   normal=normalize(mat3(viewMatrix)*vec3(-hx+micro.x*.48,1.,-hz+micro.y*.48));`);
  s.fragmentShader=s.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
   vec2 grainGrid=snowUV*snowSpan*60.;
   float resolved=1.-smoothstep(.6,2.2,max(fwidth(grainGrid.x),fwidth(grainGrid.y)));
   float glint=step(.92,snowHash(floor(grainGrid)))*resolved;
   roughnessFactor=mix(mix(.79,.36,texture2D(snowMap,snowUV).g),.12,glint);`);
  s.fragmentShader=s.fragmentShader.replace('#include <lights_physical_fragment>',`#include <lights_physical_fragment>
   material.clearcoat=mix(.12+.22*snowSample.g,.8,crystal);
   material.clearcoatRoughness=mix(.3,.075,crystal);`);
  s.fragmentShader=s.fragmentShader.replace('#include <clearcoat_normal_fragment_maps>',`#include <clearcoat_normal_fragment_maps>
   clearcoatNormal=normal;`);
 };material.customProgramCacheKey=()=> 'harbour-snow-crystals-v2';
 const geometry=new T.PlaneGeometry(field.width,field.depth,...spec.segments);geometry.rotateX(-Math.PI/2);const mesh=new T.Mesh(geometry,material);mesh.name='Interactive snow • '+spec.id;mesh.position.set(spec.x,spec.y,spec.z);mesh.receiveShadow=true;mesh.castShadow=false;mesh.frustumCulled=false;root.add(mesh);
 return {...spec,field,map,mesh,uploaded:-1};
 });
 const {field,mesh}=patches[0];
 function patchAt(x,z,y){const spec=snowSurfaceAt(x,z,y);return spec&&patches.find(p=>p.id===spec.id)}
 function sample(x,z,y=0){const p=patchAt(x,z,y);return p?p.field.sample(x-p.x,z-p.z):0}
 // Small powder puffs use a fixed particle pool; no allocations or new draw calls per step.
 const count=180,pos=new Float32Array(count*3),velocity=new Float32Array(count*3),life=new Float32Array(count),pg=new T.BufferGeometry();pos.fill(-100);pg.setAttribute('position',new T.BufferAttribute(pos,3).setUsage(T.DynamicDrawUsage));
 const particles=new T.Points(pg,new T.PointsMaterial({color:0xe7f2ff,size:.055,transparent:true,opacity:.62,depthWrite:false}));particles.name='Kicked-up powder';particles.frustumCulled=false;root.add(particles);let cursor=0,history=new WeakMap(),foot=new T.Vector3();
 function puff(x,z,y){for(let j=0;j<5;j++){const i=cursor++%count,k=i*3,a=cursor*2.399;pos.set([x,.08+y,z],k);velocity.set([Math.cos(a)*.45,.6+(j%3)*.22,Math.sin(a)*.45],k);life[i]=.3+j*.035}}
 function fixed(dt,actors){
  for(const c of actors){let old=history.get(c);if(!old){old={x:c.pos.x,z:c.pos.z,grounded:c.grounded,feet:[null,null]};history.set(c,old)}
   const patch=patchAt(c.pos.x,c.pos.z,c.pos.y);
   if(c.alive&&c.grounded&&patch){
    const field=patch.field,px=c.pos.x-patch.x,pz=c.pos.z-patch.z;
    if(old.patch!==patch){old.feet=[null,null];old.patch=patch;}
    const moved=Math.hypot(c.pos.x-old.x,c.pos.z-old.z),landing=!old.grounded;
    if(landing){const amount=field.stamp(px,pz,{rx:.42*c.size,rz:.43*c.size,yaw:c.yaw});if(amount)puff(c.pos.x,c.pos.z,patch.y+.10)}
    if(c.state==='dodge'&&moved>.005){field.stamp(px,pz,{rx:.30*c.size,rz:.45*c.size,yaw:c.yaw});}
    for(let side=0;side<2;side++){
     const bone=c.bones[side?'right_foot':'left_foot']||c.bones[side?'right_ankle':'left_ankle'];if(!bone)continue;bone.getWorldPosition(foot);
     if(foot.y-c.pos.y>.34*c.size)continue;const last=old.feet[side];if(last&&Math.hypot(foot.x-last.x,foot.z-last.z)<.065&&!landing)continue;
     const amount=field.stamp(foot.x-patch.x,foot.z-patch.z,{yaw:c.yaw,rx:.15*c.size,rz:.25*c.size,strength:1});old.feet[side]={x:foot.x,z:foot.z};if(amount>.000025&&moved>.005)puff(foot.x,foot.z,patch.y+field.sample(foot.x-patch.x,foot.z-patch.z));
    }
   }
   old.x=c.pos.x;old.z=c.pos.z;old.grounded=c.grounded;
  }
  for(let i=0;i<count;i++)if(life[i]>0){const k=i*3;life[i]-=dt;if(life[i]<=0){pos[k+1]=-100;continue}velocity[k+1]-=2.7*dt;for(let a=0;a<3;a++)pos[k+a]+=velocity[k+a]*dt;}pg.attributes.position.needsUpdate=true;
 }
 function upload(){for(const p of patches)if(p.uploaded!==p.field.revision){p.map.needsUpdate=true;p.uploaded=p.field.revision}}
 return {field,mesh,patches,sample,patchAt,fixed,upload,reset(){for(const p of patches)p.field.reset();history=new WeakMap();life.fill(0);pos.fill(-100);pg.attributes.position.needsUpdate=true;upload()},get state(){return {...field.state,patches:patches.map(p=>({id:p.id,elevation:p.y,...p.field.state})),totalStamps:patches.reduce((n,p)=>n+p.field.state.stamps,0)}}};
}
