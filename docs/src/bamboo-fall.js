// Lightweight planar rigid-rod fall, released from the cut with angular momentum.
export function createBambooFall({x,z,y,length,radius=.08,dx=1,dz=0,tilt=.025}){
 const n=Math.hypot(dx,dz)||1;dx/=n;dz/=n;
 const s={x,z,y:y+length*.5*Math.cos(tilt),angle:tilt,omega:1.1,vx:dx*.28,vz:dz*.28,vy:0,length,radius,dx,dz,age:0,sleeping:false};
 return {state:s,step(dt){if(s.sleeping||!Number.isFinite(dt)||dt<=0)return;const h=Math.min(dt,1/30);s.age+=h;s.vy-=9.81*h;s.x+=s.vx*h;s.z+=s.vz*h;s.y+=s.vy*h;s.angle+=s.omega*h;
  const low=s.y-Math.abs(Math.cos(s.angle))*length*.5;
  if(low<radius+.04){s.landed=true;s.y+=radius+.04-low;s.vy=Math.max(0,-s.vy*.08);s.vx*=Math.exp(-5*h);s.vz*=Math.exp(-5*h);
   // Ground contact rotates the rod toward lying flat, dissipating its bounce.
   s.angle+=(Math.PI*.5-s.angle)*(1-Math.exp(-7*h));s.omega*=Math.exp(-5*h);
   s.y=Math.max(s.y,radius+.04+Math.abs(Math.cos(s.angle))*length*.5);
  }else if(!s.landed)s.omega+=Math.sin(s.angle)*h*1.5;else s.omega*=Math.exp(-2*h);
  if(s.age>2.5&&Math.abs(s.angle-Math.PI/2)<.025&&Math.abs(s.vy)<.12){s.angle=Math.PI/2;s.y=radius+.04;s.omega=s.vx=s.vy=s.vz=0;s.sleeping=true}
 }};
}
