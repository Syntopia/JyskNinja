import {Vector2} from 'three';

export function isScreenshotKey(event){
 return event.code==='KeyP'&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!event.target?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"])');
}

// Render again at native 2× dimensions; never upscale a normal frame or capture DOM UI.
export function captureFrame({renderer,composer,scene,cameraFX,createCanvas=()=>document.createElement('canvas')}){
 const size=renderer.getSize(new Vector2()),buffer=renderer.getDrawingBufferSize(new Vector2());
 const width=buffer.x*2,height=buffer.y*2,gl=renderer.getContext();
 const viewport=gl.getParameter(gl.MAX_VIEWPORT_DIMS),limit=Math.min(renderer.capabilities.maxTextureSize,gl.getParameter(gl.MAX_RENDERBUFFER_SIZE));
 if(width>Math.min(limit,viewport[0])||height>Math.min(limit,viewport[1]))throw new Error(`2× capture (${width} × ${height}) exceeds this GPU’s image limit. Make the window smaller and try again.`);
 const output=createCanvas();output.width=width;output.height=height;
 const context=output.getContext('2d');if(!context)throw new Error('Could not allocate the screenshot image.');
 const ratio=renderer.getPixelRatio(),composerRatio=composer._pixelRatio,composerWidth=composer._width,composerHeight=composer._height;
 const reflections=[],shadows=[],textures=new Map(),shadowUpdate=renderer.shadowMap.needsUpdate;
 let restoreFX=()=>{};
 try{
  scene.traverseVisible(object=>{
   if(object.isReflector){const target=object.getRenderTarget();reflections.push({object,target,width:target.width,height:target.height,refresh:object.userData.captureRefresh});object.userData.captureRefresh=true;target.setSize(width,height);}
   if(object.isLight&&object.castShadow&&object.shadow){
    const shadow=object.shadow;shadows.push({shadow,size:shadow.mapSize.clone(),map:shadow.map,mapPass:shadow.mapPass,needsUpdate:shadow.needsUpdate});
    shadow.map=null;shadow.mapPass=null;shadow.mapSize.set(Math.min(limit,Math.max(4096,shadow.mapSize.x)),Math.min(limit,Math.max(4096,shadow.mapSize.y)));shadow.needsUpdate=true;
   }
   for(const material of (Array.isArray(object.material)?object.material:[object.material]))if(material)for(const value of Object.values(material))if(value?.isTexture&&!value.isRenderTargetTexture&&!textures.has(value)){
    textures.set(value,value.anisotropy);value.anisotropy=renderer.capabilities.getMaxAnisotropy();value.needsUpdate=true;
   }
  });
  restoreFX=cameraFX.captureQuality();renderer.shadowMap.needsUpdate=true;
  // Pixel ratio 1 makes odd CSS sizes / fractional device ratios exactly 2× too.
  renderer.setDrawingBufferSize(width,height,1);composer.setPixelRatio(1);composer.setSize(width,height);cameraFX.resize();
  composer.render(0);
  context.drawImage(renderer.domElement,0,0);
  return {canvas:output,width,height};
 }finally{
  for(const [texture,anisotropy] of textures){texture.anisotropy=anisotropy;texture.needsUpdate=true;}
  for(const saved of shadows){const s=saved.shadow;s.map?.dispose();s.mapPass?.dispose();s.map=saved.map;s.mapPass=saved.mapPass;s.mapSize.copy(saved.size);s.needsUpdate=saved.needsUpdate;}
  for(const saved of reflections)saved.target.setSize(saved.width,saved.height);
  renderer.shadowMap.needsUpdate=shadowUpdate;
  renderer.setDrawingBufferSize(size.x,size.y,ratio);composer.setPixelRatio(composerRatio);composer.setSize(composerWidth,composerHeight);cameraFX.resize();restoreFX();
  // Refill resized reflection targets even while paused; leave a normal-size frame onscreen.
  try{composer.render(0)}finally{for(const saved of reflections){if(saved.refresh===undefined)delete saved.object.userData.captureRefresh;else saved.object.userData.captureRefresh=saved.refresh;}}
 }
}

export function createScreenshots({renderer,composer,renderPass,cameraFX,ready,label,onCaptured}){
 const canvas=renderer.domElement;let pending=false,busy=false,timer;
 const status=document.createElement('div');status.id='screenshot-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 Object.assign(status.style,{position:'fixed',bottom:'24px',left:'50%',transform:'translateX(-50%)',zIndex:'10000',padding:'10px 16px',background:'#111d',color:'#fff',borderRadius:'6px',font:'13px system-ui',pointerEvents:'none',display:'none'});document.body.append(status);
 function report(message,state,details={}){status.textContent=message;status.style.display='block';clearTimeout(timer);timer=setTimeout(()=>status.style.display='none',5000);canvas.dataset.screenshot=JSON.stringify({state,...details});}
 window.addEventListener('keydown',event=>{
  if(!isScreenshotKey(event))return;event.preventDefault();event.stopImmediatePropagation();
  if(event.repeat||busy||pending)return;
  if(!ready()){report('Screenshot available once loading finishes.','loading');return;}
  pending=true;report('Creating 2× screenshot…','pending');
 },true);
 return {afterFrame(){
  if(!pending||busy)return;pending=false;busy=true;
  try{
   const shot=captureFrame({renderer,composer,scene:renderPass.scene,cameraFX});
   const filename=`ninja-${label()}-${new Date().toISOString().replace(/[:.]/g,'-')}-${shot.width}x${shot.height}.png`;
   shot.canvas.toBlob(blob=>{
    try{
     if(!blob)throw new Error('PNG encoding failed.');
     const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=filename;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
     const details={width:shot.width,height:shot.height,filename};report(`Screenshot downloaded · ${shot.width} × ${shot.height}`,'saved',details);
     canvas.dispatchEvent(new CustomEvent('screenshot-saved',{detail:{...details,blob}}));
    }catch(error){report(`Screenshot failed: ${error.message}`,'error');console.error(error)}finally{shot.canvas.width=shot.canvas.height=1;busy=false;}
   },'image/png');
  }catch(error){busy=false;report(`Screenshot failed: ${error.message}`,'error');console.error(error)}finally{onCaptured();}
 }};
}
