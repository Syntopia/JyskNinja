// Creator-supplied Suno music. One streaming element prevents overlapping tracks.
export const STAGE_MUSIC={
 'lantern-street':{file:'kage-no-yaiba.mp3',title:'影の刃'},
 garden:{file:'kage-no-yaiba.mp3',title:'影の刃'},
 ferry:{file:'tosen-no-kodo.mp3',title:'凍戦の鼓動'},
 harbour:{file:'kage-no-kodo.mp3',title:'影の鼓動'},
 shinkansen:{file:'kage-no-yaiba.mp3',title:'影の刃'},
};
export function createMusic() {
 let stage='garden',selection=STAGE_MUSIC.garden;
 const url=file=>new URL('../assets/audio/'+file,import.meta.url).href;
 const track=new Audio(url(selection.file));
 track.preload='metadata';track.loop=true;track.volume=.30;
 let unlocked=false,active=true,muted=false,pending=false,ducked=false,generation=0,fade=1,level=.30;
 function sync(){
  if(!unlocked||!active||muted){track.pause();return}
  if(!track.paused||pending)return;
  const request=generation;pending=true;
  track.play().then(()=>{if(request!==generation)return;if(!active||muted)track.pause()}).catch(e=>{
   if(request!==generation)return;
   // Intentional source changes/pause can abort play without revoking activation.
   if(e.name==='NotAllowedError')unlocked=false;
  }).finally(()=>{if(request===generation)pending=false});
 }
 return {
  selectStage(nextStage){
   const next=STAGE_MUSIC[nextStage];if(!next)return;stage=nextStage;
   if(selection.file===next.file)return;
   generation++;pending=false;track.pause();selection=next;fade=0;track.volume=0;
   track.src=url(next.file);track.load();sync();
  },
  setDucked(value){ducked=value},
  update(dt){const step=Math.min(dt,.1),target=ducked?.095:.30;level+=(target-level)*(1-Math.exp(-step*(ducked?14:3)));if(active&&!muted&&!track.paused)fade=Math.min(1,fade+step/0.65);track.volume=level*fade;},
  unlock(){unlocked=true;sync()},
  setState(nextActive,nextMuted){if(active===nextActive&&muted===nextMuted)return;active=nextActive;muted=nextMuted;track.muted=muted;sync()},
  get state(){return {stage,track:selection.file,title:selection.title,playing:!track.paused,active,muted,unlocked,loop:track.loop,volume:track.volume,time:track.currentTime,duration:track.duration,readyState:track.readyState,error:track.error?.message||null}},
 };
}
