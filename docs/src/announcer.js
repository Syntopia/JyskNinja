import {CAMPAIGN} from './campaign.js';
// Creator-selected Qwen3-TTS voice, always at its natural pitch and tempo.
export function createAnnouncer(onSpeaking=()=>{}){
 const priorities={armchop:1,headchop:2,victory:3,defeated:4},clips={};
 const levels=new Set(CAMPAIGN.map(chapter=>'level-'+chapter.id));
 let active=true,muted=false,current=null,pendingLevel=null,lastChop=-Infinity,serial=0,error=null;const counts={};
 function getClip(kind){
  if(clips[kind])return clips[kind];
  const file=levels.has(kind)?`${kind}-qwen-v1.mp3`:`${kind}-qwen-natural-v2.mp3`;
  const audio=new Audio(new URL('../assets/audio/announcer/'+file,import.meta.url).href);
  audio.preload=levels.has(kind)?'none':'auto';audio.volume=.88;clips[kind]=audio;
  audio.addEventListener('ended',()=>{if(current!==kind)return;current=null;onSpeaking(false);const next=pendingLevel;pendingLevel=null;if(next&&active&&!muted)play(next);});
  audio.addEventListener('error',()=>{error=`Could not load ${file}`;console.error(error);if(current===kind){const next=pendingLevel;stop();if(next&&next!==kind&&active&&!muted)play(next);}});
  return audio;
 }
 for(const kind of Object.keys(priorities))getClip(kind);
 function stop(){serial++;pendingLevel=null;for(const audio of Object.values(clips)){audio.pause();audio.currentTime=0;}current=null;onSpeaking(false);}
 function play(kind){
  stop();const token=serial,audio=getClip(kind);current=kind;error=null;onSpeaking(true);
  audio.play().then(()=>{if(token!==serial)return;counts[kind]=(counts[kind]||0)+1;}).catch(e=>{if(token!==serial)return;const next=pendingLevel;error=String(e);stop();if(next&&next!==kind&&active&&!muted)play(next);});return true;
 }
 function say(kind){
  if(!Object.hasOwn(priorities,kind)||!active||muted)return false;
  const priority=priorities[kind],now=performance.now();
  if(current&&priority<=(levels.has(current)?2.5:priorities[current]))return false;
  if(priority<3&&now-lastChop<3000)return false;
  if(priority<3)lastChop=now;
  return play(kind);
 }
 function announceLevel(id){
  const kind='level-'+id;if(!levels.has(kind)||!active||muted)return false;
  if(current==='victory'){pendingLevel=kind;const audio=getClip(kind);audio.preload='auto';audio.load();return true;}
  return play(kind);
 }
 return {say,announceLevel,stop,reset({preserveLevel=false}={}){if(!preserveLevel||(!levels.has(current)&&!pendingLevel))stop();lastChop=-Infinity;},setState(nextActive,nextMuted){active=nextActive;muted=nextMuted;if(!active||muted)stop();},get state(){return {current,pendingLevel,active,muted,error,counts:{...counts},clips:Object.fromEntries(Object.entries(clips).map(([k,a])=>[k,{duration:a.duration,readyState:a.readyState,playing:!a.paused,time:a.currentTime}]))}}};
}
