import {Vector3,Box3} from '../vendor/three/build/three.module.js';
export const V=(x=0,y=0,z=0)=>new Vector3(x,y,z);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
// Closest points between two finite segments, including zero-length and parallel cases.
export function segmentDistance(a,b,c,d){
 const u=b.clone().sub(a),v=d.clone().sub(c),w=a.clone().sub(c),aa=u.dot(u),bb=u.dot(v),cc=v.dot(v),dd=u.dot(w),ee=v.dot(w);let s=0,t=0;
 if(aa<1e-12&&cc<1e-12)return {distance:a.distanceTo(c),point:a.clone(),other:c.clone()};
 if(aa<1e-12)t=clamp(ee/cc,0,1);else if(cc<1e-12)s=clamp(-dd/aa,0,1);else{const den=aa*cc-bb*bb;s=den>1e-12?clamp((bb*ee-cc*dd)/den,0,1):0;t=(bb*s+ee)/cc;if(t<0){t=0;s=clamp(-dd/aa,0,1)}else if(t>1){t=1;s=clamp((bb-dd)/aa,0,1)}}
 const p=a.clone().addScaledVector(u,s),q=c.clone().addScaledVector(v,t);return {distance:p.distanceTo(q),point:p,other:q};
}
export function segmentBox(a,b,box,radius=0){
 const delta=b.clone().sub(a);let low=0,high=1;
 for(const axis of ['x','y','z']){const min=box.min[axis]-radius,max=box.max[axis]+radius;if(Math.abs(delta[axis])<1e-10){if(a[axis]<min||a[axis]>max)return null;continue}let t0=(min-a[axis])/delta[axis],t1=(max-a[axis])/delta[axis];if(t0>t1)[t0,t1]=[t1,t0];low=Math.max(low,t0);high=Math.min(high,t1);if(low>high)return null}
 return a.clone().addScaledVector(delta,low);
}
export function boxAt(x,y,z,w,h,d){return new Box3(V(x-w/2,y-h/2,z-d/2),V(x+w/2,y+h/2,z+d/2))}
export function moveBody(body,delta,world){
 const count=Math.max(1,Math.ceil(delta.length()/.13)),step=delta.clone().divideScalar(count);body.grounded=false;
 for(let n=0;n<count;n++){
  const oldY=body.pos.y;body.pos.add(step);
  let floor=world.floorAt(body.pos.x,body.pos.z,oldY);
  for(const c of world.solids){if(c.broken)continue;const b=c.box,r=body.radius,p=body.pos;
   if(p.x+r<b.min.x||p.x-r>b.max.x||p.z+r<b.min.z||p.z-r>b.max.z)continue;
   const footInside=p.x>b.min.x-r*.35&&p.x<b.max.x+r*.35&&p.z>b.min.z-r*.35&&p.z<b.max.z+r*.35;
   if(footInside&&oldY>=b.max.y-.035&&step.y<=0){floor=Math.max(floor,b.max.y);continue}
   if(p.y>=b.max.y-.005||p.y+body.height<=b.min.y+.005)continue;
   if(oldY+body.height<=b.min.y+.04&&step.y>0){p.y=b.min.y-body.height;body.vy=Math.min(0,body.vy);step.y=0;continue}
   if(b.max.y-p.y<=.24&&b.max.y>=p.y&&body.vy<=0){floor=Math.max(floor,b.max.y);continue}
   const qx=clamp(p.x,b.min.x,b.max.x),qz=clamp(p.z,b.min.z,b.max.z),dx=p.x-qx,dz=p.z-qz,dist=Math.hypot(dx,dz);
   if(dist>1e-7&&dist<r){p.x+=dx/dist*(r-dist+.0001);p.z+=dz/dist*(r-dist+.0001)}else if(dist<=1e-7){const edges=[{v:Math.abs(p.x-(b.min.x-r)),axis:'x',to:b.min.x-r},{v:Math.abs(p.x-(b.max.x+r)),axis:'x',to:b.max.x+r},{v:Math.abs(p.z-(b.min.z-r)),axis:'z',to:b.min.z-r},{v:Math.abs(p.z-(b.max.z+r)),axis:'z',to:b.max.z+r}].sort((a,b)=>a.v-b.v);p[edges[0].axis]=edges[0].to}
  }
  if(body.pos.y<=floor+.006){body.pos.y=floor;if(body.vy<=0){body.vy=0;body.grounded=true}step.y=Math.max(0,step.y)}
 }
 return body;
}
export function separateBodies(a,b,world){
 if(Math.abs(a.pos.y-b.pos.y)>Math.max(a.height,b.height))return;
 const d=a.pos.clone().sub(b.pos);d.y=0;const len=d.length(),min=a.radius+b.radius;if(len>=min)return;
 if(len<.0001)d.set(1,0,0);else d.divideScalar(len);const push=d.multiplyScalar((min-len)/2+.0001);
 moveBody(a,push,world);moveBody(b,push.clone().negate(),world);
}
export function sweptBlade(previous,current,callback){
 const distance=Math.max(previous.a.distanceTo(current.a),previous.b.distanceTo(current.b));const steps=Math.max(1,Math.ceil(distance/.035));
 for(let i=0;i<=steps;i++){const t=i/steps;if(callback(previous.a.clone().lerp(current.a,t),previous.b.clone().lerp(current.b,t))===false)return false}return true;
}
