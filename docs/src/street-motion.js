// Shared, deterministic street breeze. Positions are metres, time is seconds.
export function streetWind(time,x=0,z=0,strength=1){
 const phase=time*.83+z*.022+x*.035;
 const gust=3.1+1.6*Math.sin(phase)+.9*Math.sin(time*2.03+z*.014);
 return {x:strength*(1+.65*Math.sin(time*.61+z*.01)),z:strength*gust};
}
export function createLanternPendulum(length=.66){
 const angle=[0,0],velocity=[0,0];length=Math.max(.25,length);
 return {angle,velocity,
  step(dt,wind){
   if(!Number.isFinite(dt)||dt<=0)return;
   const h=Math.min(dt,1/60),forces=[-wind.z*.15,wind.x*.15];
   for(let axis=0;axis<2;axis++){
    velocity[axis]+=(forces[axis]/length-9.81/length*Math.sin(angle[axis])-1.05*velocity[axis])*h;
    angle[axis]+=velocity[axis]*h;
    if(Math.abs(angle[axis])>.28){angle[axis]=Math.sign(angle[axis])*.28;velocity[axis]*=.25;}
   }
  },
  reset(){angle.fill(0);velocity.fill(0);}
 };
}
export function createFixedClock(step=1/60){
 let accumulated=0,time=0;
 return {get time(){return time;},advance(dt,update){
  if(!Number.isFinite(dt)||dt<=0)return;
  accumulated+=Math.min(dt,.05);
  while(accumulated+1e-10>=step){time+=step;update(step,time);accumulated-=step;}
 },reset(){accumulated=0;time=0;}};
}
