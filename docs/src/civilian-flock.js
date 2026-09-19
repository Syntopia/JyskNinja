// Reusable planar pedestrian simulation. No dependency on combat or rendering.
export function createCivilianFlock({count=96,minX=-2.7,maxX=2.7,minZ=-63,maxZ=10,seed=731}={}){
 if(count<1||maxX-minX<3||maxZ<=minZ)throw new Error('Invalid crowd bounds');
 let rng=seed>>>0,recycles=0,deaths=0,time=0;
 const random=()=>((rng=(1664525*rng+1013904223)>>>0)/4294967296);
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),agents=[],grid=new Map(),cell=1.4;
 function lane(a){return (minX+maxX)/2+a.direction*(.65+random()*1.25)}
 function reset(){rng=seed>>>0;recycles=0;deaths=0;time=0;agents.length=0;
  for(let i=0;i<count;i++){const a={id:i,direction:i%2?1:-1,speed:.72+random()*.35,phase:random(),scale:.91+random()*.14,x:0,z:minZ+(i+.5)/count*(maxZ-minZ),vx:0,vz:0,cycles:0,alive:true,deathTime:0};a.lane=lane(a);a.x=a.lane+(random()-.5)*.5;a.vz=a.direction*a.speed;a.yaw=a.direction>0?0:Math.PI;agents.push(a)}
 }
 function recycle(a){a.z=a.direction>0?minZ+.01:maxZ-.01;a.lane=lane(a);a.x=a.lane;a.cycles++;recycles++;a.vx=0;a.vz=a.direction*a.speed;a.alive=true;a.deathTime=0}
 function kill(a){if(!a.alive||!agents.includes(a))return false;a.alive=false;a.deathTime=0;a.vx=a.vz=0;deaths++;return true}
 function step(dt,obstacles=[]){
  dt=clamp(dt,0,1/30);time+=dt;grid.clear();
  for(const a of agents){if(!a.alive){a.deathTime=Math.min(60,a.deathTime+dt);continue}const key=Math.floor(a.x/cell)+','+Math.floor(a.z/cell);if(!grid.has(key))grid.set(key,[]);grid.get(key).push(a)}
  // Compute all velocities from the previous state, independent of update order.
  for(const a of agents){if(!a.alive)continue;let fx=(a.lane-a.x)*.6,fz=0,alignX=0,alignZ=0,neighbors=0;
   const gx=Math.floor(a.x/cell),gz=Math.floor(a.z/cell);
   for(let x=gx-1;x<=gx+1;x++)for(let z=gz-1;z<=gz+1;z++)for(const b of grid.get(x+','+z)||[]){
    if(a===b)continue;let dx=a.x-b.x,dz=a.z-b.z;const d=Math.hypot(dx,dz);
    if(d<.85){if(d<.001)dx=a.id>b.id?.01:-.01;const w=(.85-d)*3.8/Math.max(d,.01);fx+=dx*w;fz+=dz*w}
    if(d<1.4&&a.direction===b.direction){alignX+=b.vx;alignZ+=b.vz;neighbors++}
   }
   if(neighbors){fx+=(alignX/neighbors-a.vx)*.15;fz+=(alignZ/neighbors-a.vz)*.15}
   for(const o of obstacles){if(Math.abs(o.y||0)>2.2)continue;const dx=a.x-o.x,dz=a.z-o.z,d=Math.hypot(dx,dz),r=o.radius??.95;
    if(d<r+1.5){const w=Math.pow(1-d/(r+1.5),2)*5;fx+=dx/Math.max(d,.01)*w;fz+=dz/Math.max(d,.01)*w;
     // Pass on a stable side even when approaching an obstacle head-on.
     if(dz*a.direction<0&&Math.abs(dx)<r+.3)fx+=(a.lane>=o.x?1:-1)*1.5*(1-d/(r+1.5));
    }
   }
   let vx=fx,vz=a.direction*a.speed+fz;const speed=Math.hypot(vx,vz),limit=a.speed*1.45;if(speed>limit){vx*=limit/speed;vz*=limit/speed}
   const blend=1-Math.exp(-5*dt);a.nextVX=a.vx+(vx-a.vx)*blend;a.nextVZ=a.vz+(vz-a.vz)*blend;
  }
  for(const a of agents){if(!a.alive)continue;a.vx=a.nextVX;a.vz=a.nextVZ;a.x+=a.vx*dt;a.z+=a.vz*dt;
   for(const o of obstacles){if(Math.abs(o.y||0)>2.2)continue;let dx=a.x-o.x,dz=a.z-o.z;const d=Math.hypot(dx,dz),r=o.radius??.95;if(d<r){if(d<.0001){dx=a.id%2?1:-1;dz=0}const n=Math.max(Math.hypot(dx,dz),.0001);a.x=o.x+dx/n*r;a.z=o.z+dz/n*r}}
   a.x=clamp(a.x,minX,maxX);
   if(a.z>maxZ||a.z<minZ)recycle(a);
   if(Math.hypot(a.vx,a.vz)>.08){const target=Math.atan2(a.vx,a.vz);a.yaw+=Math.atan2(Math.sin(target-a.yaw),Math.cos(target-a.yaw))*(1-Math.exp(-7*dt))}
   a.phase=(a.phase+Math.hypot(a.vx,a.vz)*dt/1.05/1.2)%1;
  }
 }
 reset();
 return {agents,step,reset,kill,bounds:{minX,maxX,minZ,maxZ},get stats(){return {count:agents.length,alive:agents.filter(a=>a.alive).length,dead:agents.filter(a=>!a.alive).length,deaths,recycles,time,finite:agents.every(a=>Number.isFinite(a.x+a.z+a.yaw+a.phase))}}};
}
