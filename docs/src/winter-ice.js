import * as T from 'three';

// Bake a warped cellular fracture field once; the frame loop only samples textures.
export function winterIceTextures(){
 const size=2048,cells=34,step=size/cells;
 const hash=(x,y)=>{const n=Math.sin(x*127.1+y*311.7)*43758.5453;return n-Math.floor(n)};
 const grid=cells+4,seeds=new Float32Array(grid*grid*2);
 for(let j=-2;j<cells+2;j++)for(let i=-2;i<cells+2;i++){const k=((j+2)*grid+i+2)*2;seeds[k]=(i+.18+hash(i,j)*.64)*step;seeds[k+1]=(j+.18+hash(i+83,j)*.64)*step}
 const field=new Float32Array(size*size),shade=new Float32Array(size*size);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const wx=x+7*Math.sin(y*.031)+3*Math.sin(y*.092),wy=y+6*Math.sin(x*.021)+3*Math.sin(x*.074),gx=Math.floor(wx/step),gy=Math.floor(wy/step);let first=1e9,second=1e9;
  for(let j=gy-1;j<=gy+1;j++)for(let i=gx-1;i<=gx+1;i++){
   const k=((j+2)*grid+i+2)*2,dx=wx-seeds[k],dy=wy-seeds[k+1],d=dx*dx+dy*dy;
   if(d<first){second=first;first=d}else if(d<second)second=d;
  }
  const edge=Math.sqrt(second)-Math.sqrt(first),grain=hash(x*.73,y*.91),cloud=(Math.sin(x*.015+Math.sin(y*.008)*3)+Math.sin(y*.013+Math.cos(x*.009)*4))*.25+.5;
  const fine=Math.exp(-edge*1.8)*(.2+.8*cloud),frost=Math.exp(-edge*.38)*(.25+grain*.75);
  field[y*size+x]=fine*.7+frost*.3;shade[y*size+x]=Math.min(1,.12+cloud*.30+frost*.35+fine*.23+grain*.12+Math.max(0,Math.sin(x*.045+4*Math.sin(y*.024))*Math.sin(y*.058+3*Math.sin(x*.017)))*.14);
 }
 const make=(kind)=>{
  const canvas=document.createElement('canvas');canvas.width=canvas.height=size;const ctx=canvas.getContext('2d'),im=ctx.createImageData(size,size);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
   const i=y*size+x,k=i*4,s=shade[i];
   if(kind==='normal'){
    const dx=field[y*size+Math.min(size-1,x+1)]-field[y*size+Math.max(0,x-1)],dy=field[Math.min(size-1,y+1)*size+x]-field[Math.max(0,y-1)*size+x];
    const nx=-dx*.45,ny=-dy*.45,length=Math.hypot(nx,ny,1);im.data[k]=(nx/length*.5+.5)*255;im.data[k+1]=(ny/length*.5+.5)*255;im.data[k+2]=(1/length*.5+.5)*255;
   }else if(kind==='roughness'){im.data[k]=im.data[k+1]=im.data[k+2]=75+s*140}
   else{im.data[k]=49+s*152;im.data[k+1]=77+s*144;im.data[k+2]=102+s*131}
   im.data[k+3]=255;
  }
  ctx.putImageData(im,0,0);
  if(kind==='color'){
   ctx.strokeStyle='rgba(201,222,234,.18)';ctx.lineWidth=.8;
   for(let i=0;i<950;i++){let x=hash(i,2)*size,y=hash(i,9)*size;const a=hash(i,5)*6.28;ctx.beginPath();ctx.moveTo(x,y);for(let j=0;j<5;j++){const turn=a+(hash(i,j+20)-.5)*1.1;x+=Math.cos(turn)*(6+hash(i,j)*15);y+=Math.sin(turn)*(6+hash(i+2,j)*15);ctx.lineTo(x,y)}ctx.stroke()}
  }
  const t=new T.CanvasTexture(canvas);t.name='Winter ice '+kind;t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(.042,.042);t.anisotropy=4;if(kind==='color')t.colorSpace=T.SRGBColorSpace;return t;
 };
 return {map:make('color'),normalMap:make('normal'),roughnessMap:make('roughness')};
}
