import {V} from './physics.js';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
// Position-based articulated body. Distances preserve limb lengths; inequality
// links limit folding. Contacts are sphere/capsule proxies against the scene.
export function createRagdollSolver({points,links,selfPairs=[]}){
 const nodes=points.map(p=>({...p,p:p.p.clone(),old:p.p.clone(),v:p.v?.clone()||V(),normal:V(),w:1/(p.mass||1)}));
 const constraints=links.map(l=>({...l,min:l.min??nodes[l.a].p.distanceTo(nodes[l.b].p),max:l.max??nodes[l.a].p.distanceTo(nodes[l.b].p)}));
 const capsules=constraints.filter(l=>l.capsule),temp=V(),normal=V();let age=0,quiet=0,sleeping=false,contacts=0,movingGroundImpacts=0,impactVelocity=V();
 function distance(a,b,min,max,stiff=1){temp.subVectors(b.p,a.p);const d=temp.length();if(d<1e-8)return;const error=d-clamp(d,min,max);if(Math.abs(error)<1e-8)return;const t=error/(d*(a.w+b.w))*stiff;a.p.addScaledVector(temp,t*a.w);b.p.addScaledVector(temp,-t*b.w)}
 function project(p,r,oldY,world,solids){
  const correction=V(),start=p.clone();let touched=false;
  const surface=world.ragdollSurfaceAt?.(p.x,p.z,oldY-r+.02),floor=surface?.height??world.floorAt(p.x,p.z,oldY-r+.02);
  if(Number.isFinite(floor)&&p.y<floor+r){p.y=floor+r;touched=true;correction.surface=surface}
  for(const s of solids){const b=s.box;if(p.x+r<b.min.x||p.x-r>b.max.x||p.y+r<b.min.y||p.y-r>b.max.y||p.z+r<b.min.z||p.z-r>b.max.z)continue;
   const q=V(clamp(p.x,b.min.x,b.max.x),clamp(p.y,b.min.y,b.max.y),clamp(p.z,b.min.z,b.max.z));normal.subVectors(p,q);let d=normal.length();
   if(d>1e-8){if(d>=r)continue;p.addScaledVector(normal,(r-d)/d)}else{
    let best=Infinity,axis='y',dest=0;
    for(const k of ['x','y','z'])for(const side of [-1,1]){const boundary=side<0?b.min[k]-r:b.max[k]+r,delta=Math.abs(boundary-p[k]);if(delta<best){best=delta;axis=k;dest=boundary}}
    p[axis]=dest;
   }touched=true;
  }
  if(touched){correction.subVectors(p,start);contacts++}return correction;
 }
 function step(dt,world){
  if(sleeping||dt<=0||!Number.isFinite(dt))return;dt=Math.min(dt,1/30);const maxSpeed=world.ragdollMaxSpeed||24,currentSpeed=Math.max(...nodes.map(n=>n.v.length())),count=Math.min(16,Math.max(1,Math.ceil(dt/(1/180)),Math.ceil(currentSpeed*dt/.15))),h=dt/count;age+=dt;
  const min=V(Infinity,Infinity,Infinity),max=V(-Infinity,-Infinity,-Infinity);for(const n of nodes){min.min(n.p);max.max(n.p)}const padding=Math.max(.6,currentSpeed*dt+.2);min.addScalar(-padding);max.addScalar(padding);
  const solids=world.solids.filter(s=>!s.broken&&s.box.min.x<max.x&&s.box.max.x>min.x&&s.box.min.y<max.y&&s.box.max.y>min.y&&s.box.min.z<max.z&&s.box.max.z>min.z);
  contacts=0;
  for(let sub=0;sub<count;sub++){
   for(const n of nodes){n.old.copy(n.p);n.normal.set(0,0,0);n.surface=null;n.v.y-=15*h;n.v.multiplyScalar(Math.exp(-.55*h));n.v.clampLength(0,maxSpeed);n.p.addScaledVector(n.v,h)}
   for(let iteration=0;iteration<9;iteration++){
    for(const l of constraints)distance(nodes[l.a],nodes[l.b],l.min,l.max,l.stiff??1);
    for(const [ia,ib] of selfPairs){const a=nodes[ia],b=nodes[ib];distance(a,b,(a.radius+b.radius)*.86,Infinity,.85)}
    for(const n of nodes){const delta=project(n.p,n.radius,n.old.y,world,solids);n.normal.add(delta);if(delta.surface)n.surface=delta.surface}
    // Intermediate samples keep the middle of a limb out of walls and floors.
    for(const l of capsules){const a=nodes[l.a],b=nodes[l.b],r=l.radius??Math.min(a.radius,b.radius);
     for(const t of [.33,.67]){const q=a.p.clone().lerp(b.p,t),delta=project(q,r,a.old.y*(1-t)+b.old.y*t,world,solids);if(delta.lengthSq()<1e-12)continue;
      const w=a.w*(1-t)**2+b.w*t*t;a.p.addScaledVector(delta,a.w*(1-t)/w);b.p.addScaledVector(delta,b.w*t/w);a.normal.add(delta);b.normal.add(delta);if(delta.surface){a.surface=delta.surface;b.surface=delta.surface}
     }
    }
   }
   for(const n of nodes){n.v.subVectors(n.p,n.old).divideScalar(h);if(n.normal.lengthSq()>1e-12){n.normal.normalize();const ground=n.surface?.velocity||V();n.v.sub(ground);const vn=n.v.dot(n.normal);if(vn<0)n.v.addScaledVector(n.normal,-vn);n.v.multiplyScalar(Math.exp(-18*h)).add(ground)}n.v.clampLength(0,maxSpeed)}
   // The first high-speed ground collision transfers momentum to the connected
   // body and tips it into a tumble. Never apply this while the body is airborne.
   const hit=nodes.find(n=>n.surface?.moving&&n.surface.velocity.length()>8);
   if(hit&&!movingGroundImpacts){movingGroundImpacts++;const mean=V(),center=V();for(const n of nodes){mean.add(n.v);center.add(n.p)}mean.divideScalar(nodes.length);center.divideScalar(nodes.length);impactVelocity.copy(hit.surface.velocity).sub(mean);impactVelocity.y=0;impactVelocity.multiplyScalar(.70);
    for(const n of nodes){n.v.add(impactVelocity);n.v.y=Math.max(n.v.y,2.2+(n.p.z-center.z)*2.1);n.v.x+=(n.p.y-center.y)*3.5;n.v.clampLength(0,maxSpeed)}
   }
  }
  const speed=nodes.reduce((sum,n)=>sum+n.v.lengthSq(),0)/nodes.length;
  quiet=contacts&&speed<.0036?quiet+dt:0;if((age>1.2&&quiet>.65)||nodes.every(n=>n.p.y<-45)){sleeping=true;for(const n of nodes)n.v.set(0,0,0)}
 }
 return {nodes,constraints,step,get sleeping(){return sleeping},get state(){return {age,sleeping,contacts,movingGroundImpacts,impactVelocity:impactVelocity.toArray(),maxSpeed:Math.max(...nodes.map(n=>n.v.length())),maxLengthError:Math.max(0,...constraints.filter(l=>l.min===l.max).map(l=>Math.abs(nodes[l.a].p.distanceTo(nodes[l.b].p)-l.min))),positions:nodes.map(n=>({name:n.name,p:n.p.toArray(),radius:n.radius}))}}};
}
