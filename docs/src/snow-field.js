// Persistent shallow-snow heightfield. Only footprint neighbourhoods are updated.
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x)};
export function createSnowField({size=384,width=34,depth=33,coverage=.5,obstacles=[],blanket=false,edgeFade=0}={}){
 const base=new Float32Array(size*size),height=new Float32Array(size*size),packed=new Float32Array(size*size),allowed=new Uint8Array(size*size),scores=new Float32Array(size*size),data=new Uint8Array(size*size*4),samples=[];let revision=0,stamps=0,changed=0,totalRemoved=0;
 const dx=width/(size-1),dz=depth/(size-1),maxHeight=.26;
 for(let j=0;j<size;j++)for(let i=0;i<size;i++){
  const x=i*dx-width/2,z=j*dz-depth/2,k=j*size+i;
  if(Math.abs(x)>16.6||Math.abs(z)>16||obstacles.some(b=>x>b.minX-.06&&x<b.maxX+.06&&z>b.minZ-.06&&z<b.maxZ+.06))continue;
  allowed[k]=1;
  // Warped wind-scoured islands: broad banks with irregular edges, not a blanket.
  const u=x+.75*Math.sin(z*.73),v=z+.65*Math.sin(x*.61);
  scores[k]=.54*Math.sin(u*.53+v*.17)+.39*Math.cos(v*.62-u*.16)+.21*Math.sin(u*.94-v*.82)+.09*Math.sin(u*2.3+Math.cos(v*1.9));samples.push(scores[k]);
 }
 samples.sort((a,b)=>a-b);const threshold=samples[Math.floor(samples.length*(1-coverage))]||0;
 let covered=0;
 for(let j=0;j<size;j++)for(let i=0;i<size;i++){const k=j*size+i;if(!allowed[k])continue;const x=i*dx-width/2,z=j*dz-depth/2,s=blanket?1:smooth((scores[k]-threshold)/.22),edge=edgeFade?smooth(Math.min(width/2-Math.abs(x),depth/2-Math.abs(z))/edgeFade):1;base[k]=s*edge*(.085+.035*(.5+.5*Math.sin(x*.9+z*.7)));if(base[k]>.006)covered++}
 const coverageRatio=covered/Math.max(1,samples.length);
 function encode(k){data[k*4]=Math.round(clamp(height[k]/maxHeight)*255);data[k*4+1]=Math.round(clamp(packed[k])*255);data[k*4+2]=Math.round(clamp(base[k]/maxHeight)*255);data[k*4+3]=255}
 function reset(){height.set(base);packed.fill(0);stamps=changed=0;totalRemoved=0;for(let k=0;k<base.length;k++)encode(k);revision++}
 function sample(x,z,source=height){const fx=(x+width/2)/dx,fz=(z+depth/2)/dz;if(fx<0||fz<0||fx>size-1||fz>size-1)return 0;const i=Math.min(size-2,Math.floor(fx)),j=Math.min(size-2,Math.floor(fz)),u=fx-i,v=fz-j;return (source[j*size+i]*(1-u)+source[j*size+i+1]*u)*(1-v)+(source[(j+1)*size+i]*(1-u)+source[(j+1)*size+i+1]*u)*v}
 function stamp(x,z,{yaw=0,rx=.15,rz=.25,strength=1}={}){
  if(![x,z,yaw,rx,rz,strength].every(Number.isFinite)||rx<=0||rz<=0)return 0;
  const radius=Math.max(rx,rz)*1.55,minI=Math.max(0,Math.floor((x-radius+width/2)/dx)),maxI=Math.min(size-1,Math.ceil((x+radius+width/2)/dx)),minJ=Math.max(0,Math.floor((z-radius+depth/2)/dz)),maxJ=Math.min(size-1,Math.ceil((z+radius+depth/2)/dz)),cs=Math.cos(yaw),sn=Math.sin(yaw),rim=[],touched=new Set();let removed=0;
  for(let j=minJ;j<=maxJ;j++)for(let i=minI;i<=maxI;i++){
   const k=j*size+i;if(!allowed[k]||base[k]<.004)continue;const px=i*dx-width/2-x,pz=j*dz-depth/2-z,u=(px*cs-pz*sn)/rx,v=(px*sn+pz*cs)/rz,r=Math.hypot(u,v);
   if(r<1){const weight=1-smooth((r-.62)/.38),target=base[k]*(1-clamp(strength)*weight*.98),take=Math.max(0,height[k]-target);if(take>.0001){height[k]-=take;packed[k]=Math.max(packed[k],weight);removed+=take;touched.add(k)}}
   else if(r<1.5)rim.push([k,Math.sin((r-1)*Math.PI*2)]);
  }
  if(removed){const sum=rim.reduce((n,r)=>n+r[1],0)||1;for(const [k,w] of rim){height[k]=Math.min(base[k]+.035,height[k]+removed*.25*w/sum);touched.add(k)}for(const k of touched)encode(k);stamps++;changed+=touched.size;totalRemoved+=removed*dx*dz;revision++}
  return removed*dx*dz;
 }
 reset();return {base,height,packed,data,size,width,depth,maxHeight,dx,dz,sample,stamp,reset,get revision(){return revision},get state(){return {resolution:size,coverage:coverageRatio,stamps,changedCells:changed,compressedVolume:totalRemoved,revision}}};
}
