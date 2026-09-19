// Damped 2-D wave equation, explicit finite differences on a small metre-scaled grid.
// Solid neighbors use a zero normal derivative: waves reflect at walls and islands.
export function createWaveField({nx=80,nz=144,width=5.5,depth=10,speed=2.1,damping=.95}={}){
 const cols=nx+1,rows=nz+1,n=cols*rows,dx=width/nx,dz=depth/nz;
 let h=new Float32Array(n),v=new Float32Array(n),next=new Float32Array(n),accumulator=0,time=0,steps=0,impulses=0;
 const solid=new Uint8Array(n),left=new Int32Array(n),right=new Int32Array(n),up=new Int32Array(n),down=new Int32Array(n);
 const fixed=1/120;
 if(speed*fixed*Math.sqrt(1/(dx*dx)+1/(dz*dz))>=1)throw Error('Wave grid violates the explicit solver stability limit');
 function boundaries(){for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const k=j*cols+i;left[k]=i>0&&!solid[k-1]?k-1:k;right[k]=i<nx&&!solid[k+1]?k+1:k;up[k]=j>0&&!solid[k-cols]?k-cols:k;down[k]=j<nz&&!solid[k+cols]?k+cols:k}}
 boundaries();
 function setMask(test){for(let j=0;j<rows;j++)for(let i=0;i<cols;i++)solid[j*cols+i]=test(i*dx,j*dz)?1:0;boundaries();reset()}
 function impulse(x,z,radius=.28,strength=.035){
  if(x<0||x>width||z<0||z>depth)return false;
  const ix=Math.round(x/dx),iz=Math.round(z/dz);if(solid[iz*cols+ix])return false;
  radius=Math.max(radius,Math.max(dx,dz)*1.3);const range=radius*2.4,r2=radius*radius;
  const x0=Math.max(0,Math.floor((x-range)/dx)),x1=Math.min(nx,Math.ceil((x+range)/dx)),z0=Math.max(0,Math.floor((z-range)/dz)),z1=Math.min(nz,Math.ceil((z+range)/dz));
  let sum=0,count=0;
  for(let j=z0;j<=z1;j++)for(let i=x0;i<=x1;i++){const k=j*cols+i,q=((i*dx-x)**2+(j*dz-z)**2)/r2;if(solid[k]||q>5.76)continue;sum+=strength*(q-1)*Math.exp(-q);count++}
  // Correct the truncated kernel near walls/islands so repeated wakes do not drain the basin.
  const mean=sum/Math.max(1,count);let changed=false;
  for(let j=z0;j<=z1;j++)for(let i=x0;i<=x1;i++){
   const k=j*cols+i,q=((i*dx-x)**2+(j*dz-z)**2)/r2;if(solid[k]||q>5.76)continue;
   h[k]=Math.max(-.16,Math.min(.16,h[k]+strength*(q-1)*Math.exp(-q)-mean));changed=true;
  }
  if(changed)impulses++;return changed;
 }
 function step(dt){
  accumulator+=Math.min(Math.max(dt,0),.1);const ax=speed*speed*fixed/(dx*dx),az=speed*speed*fixed/(dz*dz),decay=Math.exp(-damping*fixed);
  while(accumulator+1e-9>=fixed){
   for(let k=0;k<n;k++){
    if(solid[k]){v[k]=0;next[k]=0;continue}
    const c=h[k];v[k]=(v[k]+ax*(h[left[k]]+h[right[k]]-2*c)+az*(h[up[k]]+h[down[k]]-2*c))*decay;next[k]=c+v[k]*fixed;
   }
   [h,next]=[next,h];accumulator-=fixed;time+=fixed;steps++;
  }
 }
 function sample(x,z){const i=Math.max(0,Math.min(nx,Math.round(x/dx))),j=Math.max(0,Math.min(nz,Math.round(z/dz)));return h[j*cols+i]}
 function reset(){h.fill(0);v.fill(0);next.fill(0);accumulator=time=steps=impulses=0}
 return {nx,nz,cols,rows,dx,dz,width,depth,solid,left,right,up,down,get height(){return h},get velocity(){return v},step,impulse,sample,setMask,reset,get state(){let max=0,energy=0,finite=true;for(let i=0;i<n;i++){max=Math.max(max,Math.abs(h[i]));energy+=h[i]*h[i]+v[i]*v[i]*.01;if(!Number.isFinite(h[i])||!Number.isFinite(v[i]))finite=false}return {time,steps,impulses,cells:n,maxHeight:max,energy,finite,fixedStep:fixed,speed}}};
}
