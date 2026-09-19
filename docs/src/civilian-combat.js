import {V,segmentDistance} from './physics.js';

// Instanced pedestrians participate in the same swept-blade collision ordering
// as combat actors, but never join the enemy AI or encounter victory count.
export function civilianBladeHits(agents,a,b){
 const hits=[];
 for(const civilian of agents){
  if(!civilian.alive)continue;
  const s=civilian.scale,r=.31*s;
  if(civilian.x<Math.min(a.x,b.x)-r||civilian.x>Math.max(a.x,b.x)+r||civilian.z<Math.min(a.z,b.z)-r||civilian.z>Math.max(a.z,b.z)+r)continue;
  const low=V(civilian.x,.08+.27*s,civilian.z),high=V(civilian.x,.08+1.48*s,civilian.z),q=segmentDistance(a,b,low,high);
  if(q.distance<r+.022)hits.push({civilian,p:q.point,distance:q.point.distanceTo(a)});
 }
 return hits;
}

export const blocksSword=solid=>!solid.broken&&solid.blocksBlade!==false;
