// Screen-space optical-printer style edit. Only two still frames are retained.
export const TRANSITION_DURATION=4.8,TRANSITION_SWITCH=1.5,SLICE_COUNT=10;
const clamp=t=>Math.max(0,Math.min(1,t));
const ease=t=>{t=clamp(t);return t*t*(3-2*t)};
export function sliceProgress(time,index,incoming=false){
 const order=incoming?SLICE_COUNT-1-index:index;
 return ease((time-(incoming?2.05:.10)-order*.055)/(incoming?.8:.7));
}
export function transitionBeat(time){return {
 switchScene:time>=TRANSITION_SWITCH,done:time>=TRANSITION_DURATION,
 text:ease((time-.08)/.5)*(1-ease((time-4.05)/.75)),
 outgoing:time<TRANSITION_SWITCH,incoming:time>=2.05,
 // Reduced-motion uses the same safe, fully covered cut with gentle dissolves.
 oldOpacity:1-ease((time-.1)/1.15),newOpacity:ease((time-2.05)/1.3)
};}
export function createSceneTransition(){
 const overlay=document.createElement('canvas');overlay.id='travel-fx';overlay.setAttribute('aria-hidden','true');overlay.className='hidden';document.body.appendChild(overlay);
 const ctx=overlay.getContext('2d',{alpha:false}),old=document.createElement('canvas'),next=document.createElement('canvas');
 const oldCtx=old.getContext('2d',{alpha:false}),nextCtx=next.getContext('2d',{alpha:false});
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');let active=false,oldReady=false,nextReady=false,wantNext=false,direction=1,w=0,h=0,ratio=1;
 function resize(){w=innerWidth;h=innerHeight;ratio=Math.min(devicePixelRatio||1,1.25);overlay.width=Math.round(w*ratio);overlay.height=Math.round(h*ratio)}
 function save(source,dest,context){dest.width=overlay.width;dest.height=overlay.height;context.drawImage(source,0,0,dest.width,dest.height)}
 function image(source){const scale=Math.max(w/source.width,h/source.height),sw=source.width*scale,sh=source.height*scale;ctx.drawImage(source,(w-sw)/2,(h-sh)/2,sw,sh)}
 function slices(source,time,incoming){
  const tilt=.28*direction,lean=Math.abs(tilt)*h,step=(w+lean)/SLICE_COUNT;
  for(let i=0;i<SLICE_COUNT;i++){
   const p=sliceProgress(time,i,incoming),move=incoming?1-p:p;if(move>=1)continue;
   const sign=(i%2?1:-1)*(incoming?-1:1),dy=sign*(h+80)*move,dx=tilt*dy;
   const x=-lean+i*step,top=direction>0?x:x+lean,bottom=top+tilt*h;
   ctx.save();ctx.translate(dx,dy);ctx.beginPath();ctx.moveTo(top,0);ctx.lineTo(top+step+1,0);ctx.lineTo(bottom+step+1,h);ctx.lineTo(bottom,h);ctx.closePath();ctx.clip();image(source);
   if(move>0&&move<1){ctx.globalAlpha=Math.sin(move*Math.PI)*.7;ctx.strokeStyle=i%2?'#d38459':'#d8c8a8';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(top+step,0);ctx.lineTo(bottom+step,h);ctx.stroke()}
   ctx.restore();
  }
 }
 function frame(source,time,visible){
  if(!active)return;overlay.classList.toggle('hidden',!visible);if(!visible)return;
  if(w!==innerWidth||h!==innerHeight||ratio!==Math.min(devicePixelRatio||1,1.25))resize();
  // Called immediately after composer.render, before WebGL discards its backbuffer.
  if(!oldReady){save(source,old,oldCtx);oldReady=true}
  if(wantNext&&!nextReady){save(source,next,nextCtx);nextReady=true}
  const beat=transitionBeat(time);ctx.setTransform(ratio,0,0,ratio,0,0);ctx.globalAlpha=1;ctx.fillStyle='#101923';ctx.fillRect(0,0,w,h);
  if(reduced.matches){
   if(beat.outgoing){ctx.globalAlpha=beat.oldOpacity;image(old)}
   if(beat.incoming&&nextReady){ctx.globalAlpha=beat.newOpacity;image(next)}
   ctx.globalAlpha=1;
  }else{
   if(beat.outgoing)slices(old,time,false);
   if(beat.incoming&&nextReady)slices(next,time,true);
   // Subtle analogue scanlines, static and confined to the interstitial.
   ctx.fillStyle='rgba(2,6,12,.06)';for(let y=0;y<h;y+=4)ctx.fillRect(0,y,w,1);
  }
 }
 return {
  begin(index=0){active=true;oldReady=false;nextReady=false;wantNext=false;direction=index%2?-1:1;resize();overlay.classList.remove('hidden')},
  requestIncoming(){wantNext=true},frame,
  finish(){active=false;overlay.classList.add('hidden');old.width=old.height=next.width=next.height=1},
  get state(){return {active,oldReady,nextReady,reducedMotion:reduced.matches,width:overlay.width,height:overlay.height}},
 };
}
