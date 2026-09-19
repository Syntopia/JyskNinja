// Shared with architecture and snow interaction: elevations are solid substrates.
export const HARBOUR_SNOW_SURFACES=[
 {id:'street',x:0,y:0,z:0,width:34,depth:33,size:384,segments:[256,256]},
 ...[[-7,1,5],[7,6,5],[6,-3,4]].map(([x,z,depth],i)=>({id:`container-${i+1}`,x,y:2.4,z,width:3,depth,size:96,segments:[64,96],blanket:true,edgeFade:.12})),
 ...[-14,14].map(x=>({id:x<0?'left-quay':'right-quay',x,y:.44,z:-1,width:5,depth:31,size:320,segments:[64,320],blanket:true,edgeFade:.2}))
];
export function snowSurfaceAt(x,z,y){
 return HARBOUR_SNOW_SURFACES.find(p=>Math.abs(y-p.y)<.22&&Math.abs(x-p.x)<=p.width/2&&Math.abs(z-p.z)<=p.depth/2);
}
// Strip the old caps only; retain warehouse snow, icicles, railings and scenery.
export function isReplacedSnow(x,y,z){
 return HARBOUR_SNOW_SURFACES.slice(1).some(p=>Math.abs(x-p.x)<p.width/2+.2&&Math.abs(z-p.z)<p.depth/2+.2&&y>p.y-.15&&y<p.y+.38);
}
