// User-supplied ElevenLabs performances. One voice at a time, at natural speed.
export function createAnnouncer(onSpeaking=()=>{}){
 const priorities={armchop:1,headchop:2,victory:3,defeated:4},clips={};
 let active=true,muted=false,current=null,lastChop=-Infinity,serial=0,error=null;const counts={};
 for(const kind of Object.keys(priorities)){
  const audio=new Audio(new URL(`../assets/audio/announcer/${kind}.mp3`,import.meta.url).href);
  audio.preload='auto';audio.volume=.88;clips[kind]=audio;
  audio.addEventListener('ended',()=>{if(current===kind){current=null;onSpeaking(false);}});
  audio.addEventListener('error',()=>{error=`Could not load ${kind}.mp3`;console.error(error);if(current===kind)stop();});
 }
 function stop(){serial++;for(const audio of Object.values(clips)){audio.pause();audio.currentTime=0;}current=null;onSpeaking(false);}
 function say(kind){
  if(!clips[kind]||!active||muted)return false;
  const priority=priorities[kind],now=performance.now();
  if(current&&priority<=priorities[current])return false;
  if(priority<3&&now-lastChop<3000)return false;
  stop();const token=serial,audio=clips[kind];current=kind;if(priority<3)lastChop=now;onSpeaking(true);
  audio.play().then(()=>{if(token!==serial)return;counts[kind]=(counts[kind]||0)+1;}).catch(e=>{if(token!==serial)return;error=String(e);current=null;onSpeaking(false);});return true;
 }
 return {say,stop,reset(){stop();lastChop=-Infinity;},setState(nextActive,nextMuted){active=nextActive;muted=nextMuted;if(!active||muted)stop();},get state(){return {current,active,muted,error,counts:{...counts},clips:Object.fromEntries(Object.entries(clips).map(([k,a])=>[k,{duration:a.duration,readyState:a.readyState,playing:!a.paused,time:a.currentTime}]))}}};
}
