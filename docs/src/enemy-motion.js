// Speeds are metres per second; cadence follows each source clip's stride.
export const profiles = [
 {name:'Scout',pace:1.08,flank:.42,evade:true,windup:.59},
 {name:'Blade',pace:1,flank:.18,evade:false,windup:.64},
 {name:'Sentinel',pace:.86,flank:.10,evade:false,windup:.76},
 {name:'Shade',pace:.96,flank:.65,evade:true,windup:.68},
 {name:'Captain',pace:1.05,flank:.32,evade:true,windup:.62}
];
export function chooseGait(index,distance){
 const p=profiles[index%profiles.length];
 let clip,speed;
 if(index%5===3&&distance<7){clip='sneak';speed=1.3}
 else if(distance>8&&index%5!==2){clip='sprint';speed=4.3}
 else if(distance>4.2){clip='jog';speed=2.7}
 else{clip='walk';speed=1.4}
 speed*=p.pace;
 return {clip,speed,cadence:speed/({sprint:4.4,jog:2.8,walk:1.45,sneak:1.35}[clip])};
}
