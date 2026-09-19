// Matches the Blender loft. Gaps have no floor, and roofs cannot be landed on from below.
export function trainSurface(layout){
 function locate(x,z){
  for(let lane=0;lane<layout.lanes.length;lane++){
   const l=layout.lanes[lane],dx=x-l.x,local=z-l.offset;
   for(const car of layout.cars){
    if(local<car.start||local>car.end)continue;
    const u=car.nose?Math.max(0,Math.min(1,(local-car.start)/layout.noseLength)):1;
    const w=.045+(layout.width/2-.045)*Math.sin(u*Math.PI/2)**.65;
    if(Math.abs(dx)>w-.025)continue;
    const top=-2.3*(1-u)**1.8,bottom=-2.65-.75*u;
    return {lane,car,y:(top+bottom)/2+(top-bottom)/2*Math.max(0,1-(dx/w)**4)**.25};
   }
  }
  return null;
 }
 return {locate,floorAt(x,z,fromY){const y=locate(x,z)?.y??-40;return fromY!==undefined&&y>fromY+.24?-40:y}};
}
