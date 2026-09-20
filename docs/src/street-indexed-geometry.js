import * as T from 'three';

// Retain the source's exact vertex attributes and triangle order. Unindexed
// inputs get identity indices so they can be merged with indexed inputs.
export function prepareStreetGeometry(source,matrixWorld){
 let geometry=source.clone().applyMatrix4(matrixWorld);
 for(const key of Object.keys(geometry.attributes))if(!['position','normal','uv'].includes(key))geometry.deleteAttribute(key);
 if(!geometry.attributes.uv)geometry.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count*2),2));
 if(!geometry.attributes.normal){
  // Match the old batching path's face normals rather than introducing smoothing.
  if(geometry.index){const indexed=geometry;geometry=indexed.toNonIndexed();indexed.dispose()}
  geometry.computeVertexNormals();
 }
 if(!geometry.index){const count=geometry.attributes.position.count,indices=count>65535?new Uint32Array(count):new Uint16Array(count);for(let i=0;i<count;i++)indices[i]=i;geometry.setIndex(new T.BufferAttribute(indices,1))}
 return geometry;
}
