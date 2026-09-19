import * as T from 'three';

// Game movement owns horizontal translation. Keep the sword grip closed through
// locomotion and combat crossfades without altering the previewer's source clips.
// Rigs without a grip override retain their authored hand pose.
export function prepareArmedClips(animations,rig){
 const grip=rig.swordGrip,offset=grip?new T.Quaternion().fromArray(grip.wristOffset):null,q=new T.Quaternion();
 const fingers=new Map((grip?.fingers||[]).map(f=>[f.name+'.quaternion',f.closed]));
 return Object.fromEntries(animations.map(source=>{
  const clip=source.clone();
  for(const track of clip.tracks){
   if(track.name==='pelvis.position')for(let i=0;i<track.values.length;i+=3){track.values[i]=track.values[0];track.values[i+2]=track.values[2]}
   if(grip&&track.name==='right_wrist.quaternion'&&!grip.clips.includes(clip.name)){
    for(let i=0;i<track.values.length;i+=4)q.fromArray(track.values,i).multiply(offset).normalize().toArray(track.values,i);
   }
  }
  clip.tracks=clip.tracks.filter(t=>!fingers.has(t.name));
  for(const [name,closed] of fingers)clip.tracks.push(new T.QuaternionKeyframeTrack(name,[0,clip.duration],[...closed,...closed]));
  return [clip.name,clip];
 }));
}

// Retain the existing warlord test/tool entry point.
export {prepareArmedClips as prepareWarlordClips};
