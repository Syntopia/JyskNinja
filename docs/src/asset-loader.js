import * as T from 'three';
import {GLTFLoader as ThreeGLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from '../vendor/meshopt/meshopt_decoder.mjs';
import {optimizedAssets} from './asset-map.js';

const rootURL=new URL('../',import.meta.url);
export function resolveAssetURL(url){
 if(/^(blob:|data:)/i.test(url))return url;
 const absolute=new URL(url,rootURL);
 if(absolute.origin!==rootURL.origin||!absolute.pathname.startsWith(rootURL.pathname))return url;
 const relative=decodeURIComponent(absolute.pathname.slice(rootURL.pathname.length));
 const mapped=optimizedAssets[relative];
 if(!mapped)return url;
 const destination=new URL(mapped,rootURL);destination.search=absolute.search;destination.hash=absolute.hash;
 return destination.href;
}

// Shared by GLTFLoader and the game's existing TextureLoaders. A project-site
// prefix is derived from this module, so deployment works in a GitHub subfolder.
T.DefaultLoadingManager.setURLModifier(resolveAssetURL);

export function prepareRuntimeGeometry(gltf){
 const converted=new Set();
 function attribute(a){
  if(!a.normalized&&!a.isInterleavedBufferAttribute)return a;
  const values=new Float32Array(a.count*a.itemSize);
  for(let i=0;i<a.count;i++)for(let c=0;c<a.itemSize;c++)values[i*a.itemSize+c]=a.getComponent(i,c);
  const result=new T.BufferAttribute(values,a.itemSize);result.name=a.name;result.setUsage(a.usage??a.data?.usage??T.StaticDrawUsage);
  return result;
 }
 for(const scene of gltf.scenes||[gltf.scene])scene.traverse(object=>{
  const geometry=object.geometry;if(!geometry||converted.has(geometry))return;converted.add(geometry);
  // CPU batching, severing and cloth code expect unpacked floating-point values.
  // The glTF decoder retains the quantization transforms and corrected bind matrices.
  for(const [name,a] of Object.entries(geometry.attributes))geometry.setAttribute(name,attribute(a));
  for(const [name,list] of Object.entries(geometry.morphAttributes))geometry.morphAttributes[name]=list.map(attribute);
 });
 return gltf;
}

export class GLTFLoader extends ThreeGLTFLoader{
 constructor(manager){super(manager);this.setMeshoptDecoder(MeshoptDecoder);}
 parse(data,path,onLoad,onError){
  return super.parse(data,path,gltf=>{
   try{onLoad(prepareRuntimeGeometry(gltf));}catch(error){if(onError)onError(error);else throw error;}
  },onError);
 }
}
