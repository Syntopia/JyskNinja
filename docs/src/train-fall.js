import {V} from './physics.js';
// Train-local frame: the roofs are stationary and the landscape travels along +Z.
export function createTrainFall(layout,surface){
 return {
  isFatal(c){return !c.grounded&&c.vy<=0&&c.pos.y<-.45&&surface.floorAt(c.pos.x,c.pos.z,c.pos.y)<-3},
  surfaceAt(x,z,fromY){
   const roof=surface.floorAt(x,z,fromY);if(roof>-3)return{height:roof,velocity:V(),moving:false};
   const track=layout.lanes.some(l=>Math.abs(x-l.x)<1.9),height=track?-3.91:Math.abs(x)<10.5?-4.04:-4.25;
   return{height,velocity:V(0,0,layout.speed),moving:true};
  },maxSpeed:Math.max(24,layout.speed*1.25)
 };
}
