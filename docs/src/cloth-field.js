import {createClothTearing} from './cloth-tearing.js';
// Position-based cloth: Verlet prediction, distance/shear/bending constraints,
// pinned attachments, capsule contacts and a ground plane. No render dependency.
// Method: Müller et al., Position Based Dynamics (2006).
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function createClothField({width=1.95,height=2.93,cols=12,rows=20,x=0,top=3.35,z=0,yaw=0,wind=1,seed=0,ground=.055,rowProfile=(u,v)=>v}={}){
 const nx=cols+1,count=nx*(rows+1),position=new Float32Array(count*3),previous=new Float32Array(count*3),rest=new Float32Array(count*3),pinned=new Uint8Array(count),edges=[];
 const cs=Math.cos(yaw),sn=Math.sin(yaw),normal=[sn,0,cs];let time=0,contacts=0,lastContacts=0,steps=0;
 for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
  const k=(j*nx+i)*3,u=(i/cols-.5)*width,v=rowProfile(i/cols,j/rows),pleat=Math.sin(i/cols*Math.PI*6)*.035*v;
  rest[k]=x+u*cs+pleat*sn;rest[k+1]=top-v*height;rest[k+2]=z-u*sn+pleat*cs;pinned[j*nx+i]=j===0?1:0;
 }
 function edge(a,b,stiffness){const i=a*3,j=b*3;edges.push(a,b,Math.hypot(rest[i]-rest[j],rest[i+1]-rest[j+1],rest[i+2]-rest[j+2]),stiffness)}
 for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){const a=j*nx+i;if(i<cols)edge(a,a+1,1);if(j<rows)edge(a,a+nx,1);if(i<cols&&j<rows){edge(a,a+nx+1,.8);edge(a+1,a+nx,.8)}if(i<cols-1)edge(a,a+2,.15);if(j<rows-1)edge(a,a+nx*2,.12)}
 const constraints=new Float32Array(edges);position.set(rest);previous.set(rest);
 const triangles=[];for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const a=j*nx+i,b=a+1,c=a+nx;triangles.push(a,c,b,b,c,c+1)}
 const tearing=createClothTearing({position,rest,triangles,constraints,pinned,cols});
 function collide(capsules){let touched=0;
  for(let i=nx;i<count;i++){
   if(!tearing.active[i])continue;
   const k=i*3;
   if(position[k+1]<ground){position[k+1]=ground;previous[k]=position[k]-(position[k]-previous[k])*.6;previous[k+2]=position[k+2]-(position[k+2]-previous[k+2])*.6;}
   for(const c of capsules){
    const ax=c.a[0],ay=c.a[1],az=c.a[2],vx=c.b[0]-ax,vy=c.b[1]-ay,vz=c.b[2]-az,den=vx*vx+vy*vy+vz*vz;
    const t=den>1e-9?clamp(((position[k]-ax)*vx+(position[k+1]-ay)*vy+(position[k+2]-az)*vz)/den,0,1):0;
    let dx=position[k]-ax-vx*t,dy=position[k+1]-ay-vy*t,dz=position[k+2]-az-vz*t,d2=dx*dx+dy*dy+dz*dz;
    if(d2>=c.r*c.r)continue;
    if(d2<1e-12){dx=normal[0];dy=0;dz=normal[2];d2=1;const sign=(previous[k]-ax)*dx+(previous[k+2]-az)*dz<0?-1:1;dx*=sign*c.r;dz*=sign*c.r;}
    else{const q=c.r/Math.sqrt(d2)-1;dx*=q;dy*=q;dz*=q;}
    position[k]+=dx;position[k+1]+=dy;position[k+2]+=dz;
    // Transfer contact impulse, but dissipate most correction energy.
    previous[k]+=dx*.65;previous[k+1]+=dy*.65;previous[k+2]+=dz*.65;touched++;
   }
  }return touched;
 }
 function substep(h,capsules){
  time+=h;const hh=h*h,drag=Math.exp(-1.45*h),gust=wind*(3.1+1.6*Math.sin(time*.83+seed)+.9*Math.sin(time*2.03+seed*3));
  const tornNormals=tearing.cutFaces?tearing.updateNormals():null;
  for(let j=1;j<=rows;j++)for(let i=0;i<=cols;i++){
   if(!tearing.active[j*nx+i])continue;
   const v=j*nx+i,k=v*3,l=(j*nx+Math.max(0,i-1))*3,r=(j*nx+Math.min(cols,i+1))*3,up=((j-1)*nx+i)*3,dn=(Math.min(rows,j+1)*nx+i)*3;
   const ax=position[r]-position[l],ay=position[r+1]-position[l+1],az=position[r+2]-position[l+2],bx=position[dn]-position[up],by=position[dn+1]-position[up+1],bz=position[dn+2]-position[up+2];
   let xx=tornNormals?tornNormals[k]:ay*bz-az*by,yy=tornNormals?tornNormals[k+1]:az*bx-ax*bz,zz=tornNormals?tornNormals[k+2]:ax*by-ay*bx;const n=Math.hypot(xx,yy,zz)||1;xx/=n;yy/=n;zz/=n;
   const wx=wind*(1.0+.65*Math.sin(time*.61+seed)),wz=gust+.8*wind*Math.sin(time*3.2+rest[k]*2+rest[k+1]*2.1);
   const pressure=(xx*wx+zz*wz)*1.45;
   const forces=[xx*pressure+wx*.12,yy*pressure-9.81,zz*pressure+wz*.12];
   for(let a=0;a<3;a++){const p=position[k+a],velocity=clamp((p-previous[k+a])*drag,-h*10,h*10);position[k+a]=p+velocity+forces[a]*hh;previous[k+a]=p;}
  }
  for(let iteration=0;iteration<7;iteration++){
   // Alternate constraint order to avoid an accumulating directional bias.
   for(let n=0;n<constraints.length;n+=4){const e=iteration%2?constraints.length-4-n:n,ia=constraints[e],ib=constraints[e+1],wa=1-pinned[ia],wb=1-pinned[ib];if(!tearing.enabled[e/4]||!wa&&!wb)continue;
    const a=ia*3,b=ib*3,dx=position[b]-position[a],dy=position[b+1]-position[a+1],dz=position[b+2]-position[a+2],d=Math.hypot(dx,dy,dz);if(d<1e-8)continue;
    const f=(d-constraints[e+2])/d*constraints[e+3]/(wa+wb);
    position[a]+=dx*f*wa;position[a+1]+=dy*f*wa;position[a+2]+=dz*f*wa;position[b]-=dx*f*wb;position[b+1]-=dy*f*wb;position[b+2]-=dz*f*wb;
   }
   lastContacts+=collide(capsules);
  }
  steps++;
 }
 return {position,rest,pinned,cols,rows,width,height,normal,tearing,cutSegment:tearing.cutSegment,get lastContacts(){return lastContacts},
  setWind(value){if(Number.isFinite(value))wind=clamp(value,0,2);},
  step(dt,capsules=[]){if(!Number.isFinite(dt)||dt<=0)return;lastContacts=0;const duration=Math.min(dt,1/30),n=Math.ceil(duration/(1/120));for(let i=0;i<n;i++)substep(duration/n,capsules);contacts+=lastContacts;},
  reset(){position.set(rest);previous.set(rest);tearing.reset();time=0;contacts=lastContacts=steps=0;},
  get state(){let displacement=0,pinnedError=0,stretch=1,finite=true;for(let i=0;i<count;i++){const k=i*3,d=Math.hypot(position[k]-rest[k],position[k+1]-rest[k+1],position[k+2]-rest[k+2]);finite&&=Number.isFinite(d);displacement=Math.max(displacement,d);if(pinned[i])pinnedError=Math.max(pinnedError,d)}for(let e=0;e<constraints.length;e+=4){if(!tearing.enabled[e/4]||constraints[e+3]<.9)continue;const a=constraints[e]*3,b=constraints[e+1]*3;stretch=Math.max(stretch,Math.hypot(position[a]-position[b],position[a+1]-position[b+1],position[a+2]-position[b+2])/constraints[e+2]);}return {...tearing.state,vertices:count,steps,contacts,lastContacts,maxDisplacement:displacement,maxStretch:stretch,pinnedError,finite};}
 };
}
