export const BRIDGE_Z=-32;
export const bridgeHeight=x=>5.4+.9*Math.sin((x+5.2)/10.4*Math.PI);
export const AMBUSH_PERCHES=[-2.7,-.9,.9,2.7].map(x=>({x,y:bridgeHeight(x)+.08,z:BRIDGE_Z+.8}));
// One trigger per encounter; landing uses the game's ordinary gravity/collisions.
export function createBridgeAmbush(){
 let triggered=false,elapsed=0,launched=0;
 return {
  reset(){triggered=false;elapsed=0;launched=0},
  step(dt,player,enemies,launch){
   if(!triggered&&player.alive&&Math.abs(player.pos.x)<4&&Math.abs(player.pos.z-BRIDGE_Z)<12&&player.pos.y<3)triggered=true;
   if(!triggered)return;elapsed+=dt;
   for(const e of enemies){if(!e.alive||e.ambush!=='waiting'||elapsed<e.index*.28)continue;
    const side=player.pos.z>=BRIDGE_Z?1:-1,landingZ=BRIDGE_Z+side*(5.5+(e.index%2)*1.5),landingX=(e.index-1.5)*1.1;
    const vy=2.8,t=(vy+Math.sqrt(vy*vy+46*(e.pos.y-.08)))/23;
    e.ambush='leaping';launched++;launch(e,{x:(landingX-e.pos.x)/t,z:(landingZ-e.pos.z)/t,vy});
   }
  },
  get stats(){return {triggered,elapsed,launched}}
 };
}
