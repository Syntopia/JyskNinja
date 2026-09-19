// Plant roots only in garden soil. The court tile edges extend to x=±5.92.
export const BAMBOO_CLUSTERS=[[-8,8.5],[-8.2,13],[-16,10],[-16,2],[-16,-6],[-8,-6],[-10.5,-10],[-8,-14],[-16,-15],[8.4,10.5],[11,13],[15,8],[15,3],[10,0],[8.7,-6.5],[14,-7],[14,-13]];
export function bambooSoil(x,z,r=.15){
 if(Math.abs(x)<7.15+r||Math.abs(x)>17-r||z< -16.5+r||z>15.8-r)return false;
 if(x> -15.3-r&&x< -8.7+r&&z> -4.6-r&&z<6.6+r)return false;
 // Leave the two freestanding cloth panels and their supports accessible.
 for(const [bx,bz] of [[-8.1,5.5],[8.2,-2.6]])if(Math.abs(x-bx)<1.3+r&&Math.abs(z-bz)<1.25+r)return false;
 return true;
}
export function bambooLayout(solids=[]){
 const stems=[];
 for(let cluster=0;cluster<BAMBOO_CLUSTERS.length;cluster++){
  const [cx,cz]=BAMBOO_CLUSTERS[cluster];
  for(let j=0;j<10;j++){
   const a=j*2.399963+cluster*.71,rr=j===0?0:.39*Math.sqrt(j),x=cx+Math.cos(a)*rr,z=cz+Math.sin(a)*rr;
   if(!bambooSoil(x,z))continue;
   if(solids.some(({box:b})=>b&&b.min.y<1&&b.max.y>.1&&x>b.min.x-.4&&x<b.max.x+.4&&z>b.min.z-.4&&z<b.max.z+.4))continue;
   const id=stems.length,tall=(j+cluster)%3===0;
   const height=tall?6.3+((cluster*11+j*19)%18)/10:3.3+((cluster*17+j*23)%25)/10;
   stems.push({id,cluster,x,z,height,radius:(tall?.105:.075)+(id%4)*.008});
  }
 }
 return stems;
}
export function bambooWind(time,phase,height){
 const gust=.72+.28*Math.sin(time*.39),strength=(.75+height/16)*gust;
 return {x:strength*(.075*Math.sin(time*.83+phase*.16)+.023*Math.sin(time*1.7+phase)),z:strength*(.063*Math.sin(time*.67+phase*.12)+.018*Math.sin(time*1.31+phase))};
}
