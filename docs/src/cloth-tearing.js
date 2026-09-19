// Triangle removal opens an actual cut through the sheet. Constraints crossing
// that opening are removed too, so disconnected pieces keep their own motion.
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],clamp=x=>Math.max(0,Math.min(1,x));
function segmentDistance(p,q,a,b){
 const d=sub(q,p),e=sub(b,a),r=sub(p,a),aa=dot(d,d),ee=dot(e,e),f=dot(e,r);let s=0,t=0;
 if(aa<1e-12&&ee<1e-12)return Math.hypot(...r);
 if(aa<1e-12)t=clamp(f/ee);else{const c=dot(d,r);if(ee<1e-12)s=clamp(-c/aa);else{const de=dot(d,e),den=aa*ee-de*de;s=den>1e-12?clamp((de*f-c*ee)/den):0;t=(de*s+f)/ee;if(t<0){t=0;s=clamp(-c/aa)}else if(t>1){t=1;s=clamp((de-c)/aa)}}}
 return Math.hypot(r[0]+d[0]*s-e[0]*t,r[1]+d[1]*s-e[1]*t,r[2]+d[2]*s-e[2]*t);
}
function inFace(p,a,u,v){const r=sub(p,a),uu=dot(u,u),uv=dot(u,v),vv=dot(v,v),ru=dot(r,u),rv=dot(r,v),den=uu*vv-uv*uv;if(den<1e-16)return false;const s=(ru*vv-rv*uv)/den,t=(rv*uu-ru*uv)/den;return s>=-1e-6&&t>=-1e-6&&s+t<=1.000001}
function hitsFace(p,q,a,b,c,radius){
 const u=sub(b,a),v=sub(c,a),n=cross(u,v),nn=dot(n,n);if(nn<1e-16)return false;
 const dp=dot(sub(p,a),n),dq=dot(sub(q,a),n);
 if(dp*dq<=0&&Math.abs(dp-dq)>1e-12){const t=dp/(dp-dq),at=p.map((x,i)=>x+(q[i]-x)*t);if(inFace(at,a,u,v))return true}
 for(const [point,d] of [[p,dp],[q,dq]])if(d*d<=radius*radius*nn){const projection=point.map((x,i)=>x-n[i]*d/nn);if(inFace(projection,a,u,v))return true}
 return segmentDistance(p,q,a,b)<=radius||segmentDistance(p,q,b,c)<=radius||segmentDistance(p,q,c,a)<=radius;
}
export function createClothTearing({position,rest,triangles,constraints,pinned,cols}){
 const count=pinned.length,nx=cols+1,alive=new Uint8Array(triangles.length/3).fill(1),active=new Uint8Array(count).fill(1),enabled=new Uint8Array(constraints.length/4).fill(1),normals=new Float32Array(position.length);
 let lastCutPoint=[0,0,0],revision=0,cutFaces=0,detachedVertices=0,indices=new Uint16Array(triangles),boundary=new Uint16Array();
 const key=(a,b)=>Math.min(a,b)*count+Math.max(a,b);
 function rebuild(){
  active.fill(0);const edgeCounts=new Map(),list=[],adj=Array.from({length:count},()=>[]);
  for(let f=0;f<alive.length;f++)if(alive[f]){const vs=triangles.slice(f*3,f*3+3);list.push(...vs);for(let j=0;j<3;j++){const a=vs[j],b=vs[(j+1)%3],k=key(a,b);active[a]=1;edgeCounts.set(k,(edgeCounts.get(k)||0)+1);adj[a].push(b);adj[b].push(a)}}
  indices=new Uint16Array(list);const edges=[];for(const [k,n] of edgeCounts)if(n===1)edges.push(Math.floor(k/count),k%count);boundary=new Uint16Array(edges);
  for(let i=0;i<enabled.length;i++){
   const a=constraints[i*4],b=constraints[i*4+1],dx=Math.abs(a%nx-b%nx),dy=Math.abs(Math.floor(a/nx)-Math.floor(b/nx));let keep=edgeCounts.has(key(a,b));
   if(dx===2&&dy===0||dx===0&&dy===2){const mid=(a+b)/2;keep=edgeCounts.has(key(a,mid))&&edgeCounts.has(key(mid,b))}
   else if(dx===1&&dy===1&&!keep){const x0=Math.min(a%nx,b%nx),y0=Math.min(Math.floor(a/nx),Math.floor(b/nx)),f=(y0*cols+x0)*2;keep=!!(alive[f]&&alive[f+1])}
   enabled[i]=active[a]&&active[b]&&keep?1:0;
  }
  const anchored=new Uint8Array(count),queue=[];for(let i=0;i<count;i++)if(pinned[i]&&active[i]){anchored[i]=1;queue.push(i)}
  for(let i=0;i<queue.length;i++)for(const b of adj[queue[i]])if(!anchored[b]){anchored[b]=1;queue.push(b)}
  detachedVertices=0;for(let i=0;i<count;i++)if(active[i]&&!anchored[i])detachedVertices++;
 }
 function cutSegment(p,q,radius=.028){
  if(![...p,...q,radius].every(Number.isFinite)||radius<0)return 0;
  let removed=0;const min=p.map((v,i)=>Math.min(v,q[i])-radius),max=p.map((v,i)=>Math.max(v,q[i])+radius);
  for(let f=0;f<alive.length;f++)if(alive[f]){
   const a=triangles[f*3]*3,b=triangles[f*3+1]*3,c=triangles[f*3+2]*3;
   if([0,1,2].some(i=>Math.max(position[a+i],position[b+i],position[c+i])<min[i]||Math.min(position[a+i],position[b+i],position[c+i])>max[i]))continue;
   if(hitsFace(p,q,Array.from(position.subarray(a,a+3)),Array.from(position.subarray(b,b+3)),Array.from(position.subarray(c,c+3)),radius)){alive[f]=0;removed++;lastCutPoint=[0,1,2].map(i=>(position[a+i]+position[b+i]+position[c+i])/3)}
  }
  if(removed){cutFaces+=removed;revision++;rebuild()}return removed;
 }
 function updateNormals(){normals.fill(0);for(let i=0;i<indices.length;i+=3){const a=indices[i]*3,b=indices[i+1]*3,c=indices[i+2]*3,ux=position[b]-position[a],uy=position[b+1]-position[a+1],uz=position[b+2]-position[a+2],vx=position[c]-position[a],vy=position[c+1]-position[a+1],vz=position[c+2]-position[a+2],x=uy*vz-uz*vy,y=uz*vx-ux*vz,z=ux*vy-uy*vx;for(const k of [a,b,c]){normals[k]+=x;normals[k+1]+=y;normals[k+2]+=z}}return normals}
 rebuild();
 return {active,enabled,cutSegment,updateNormals,get cutFaces(){return cutFaces},get lastCutPoint(){return lastCutPoint},get indices(){return indices},get boundary(){return boundary},get revision(){return revision},reset(){alive.fill(1);cutFaces=0;revision++;rebuild()},get state(){return {cutFaces,remainingFaces:indices.length/3,detachedVertices,activeVertices:active.reduce((a,b)=>a+b,0),brokenConstraints:enabled.length-enabled.reduce((a,b)=>a+b,0),revision}}};
}
