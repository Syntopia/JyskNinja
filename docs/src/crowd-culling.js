import * as T from 'three';

// An influence box contains every vertex affected by a joint. Positive weighted
// skinning is a convex combination of transformed boxes, so their union safely
// contains the complete posed surface, including interpolated walk/death frames.
export function bakeCrowdBounds(geometries,palettes){
 const count=palettes[0].bones,boxes=Array.from({length:count},()=>new T.Box3()),point=new T.Vector3();
 for(const geometry of geometries){const {position,skinIndex,skinWeight}=geometry.attributes;
  for(let i=0;i<position.count;i++){point.fromBufferAttribute(position,i);for(let k=0;k<4;k++)if(skinWeight.getComponent(i,k)>0)boxes[skinIndex.getComponent(i,k)].expandByPoint(point)}
 }
 const matrix=new T.Matrix4(),transformed=new T.Box3();
 for(const palette of palettes)palette.bounds=Array.from({length:palette.frames},(_,frame)=>{
  const box=new T.Box3();for(let joint=0;joint<count;joint++)if(!boxes[joint].isEmpty()){matrix.fromArray(palette.data,(frame*count+joint)*16);box.union(transformed.copy(boxes[joint]).applyMatrix4(matrix))}
  return box.expandByScalar(.01); // Covers floating-point/skin-weight roundoff.
 });
}

export function createCrowdPassList(capacity){
 const data=new Float32Array(capacity*4),texture=new T.DataTexture(data,capacity,1,T.RGBAFormat,T.FloatType);
 const frustum=new T.Frustum(),vp=new T.Matrix4(),sphere=new T.Sphere();texture.needsUpdate=true;
 return {texture,data,count:0,
  update(rows,spheres,fades,camera,worldMatrix,enabled=true){
   if(camera){vp.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);frustum.setFromProjectionMatrix(vp)}
   let count=0;
   for(const row of rows){
    if(enabled&&camera&&!frustum.intersectsSphere(sphere.copy(spheres[row]).applyMatrix4(worldMatrix)))continue;
    data[count*4]=row;data[count*4+1]=fades[row];count++;
   }
   texture.needsUpdate=true;this.count=count;return count;
  },dispose(){texture.dispose()}
 };
}
