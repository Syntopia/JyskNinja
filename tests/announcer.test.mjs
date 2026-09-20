import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {CAMPAIGN} from '../docs/src/campaign.js';
const audio=[];let rejectNext=false;
globalThis.Audio=class{
 constructor(src){assert(existsSync(new URL(src)),`Missing audio: ${src}`);this.src=src;this.listeners={};this.paused=true;this.currentTime=0;this.playbackRate=1;this.loads=0;this.plays=0;audio.push(this);}
 addEventListener(event,fn){this.listeners[event]=fn;}
 load(){this.loads++;}
 play(){this.paused=false;this.plays++;if(rejectNext){rejectNext=false;return Promise.reject(new Error('Playback unavailable'));}return Promise.resolve();}
 pause(){this.paused=true;}
 end(){this.paused=true;this.listeners.ended();}
};
const {createAnnouncer}=await import('../docs/src/announcer.js');
const duck=[];const a=createAnnouncer(value=>duck.push(value));
const clip=kind=>audio.find(c=>c.src.includes('/'+kind+'-qwen-'));
assert.equal(audio.length,4,'Chapter audio must not preload with intro assets');
assert(a.announceLevel('garden'));assert.equal(audio.length,5);assert.equal(clip('level-garden').preload,'none');assert.equal(clip('level-garden').playbackRate,1);
assert.equal(a.say('armchop'),false,'Combat must not interrupt a chapter sentence');
a.reset({preserveLevel:true});assert.equal(a.state.current,'level-garden','Scene installation must preserve the loading announcement');
clip('level-garden').end();assert.equal(a.state.current,null);assert.equal(duck.at(-1),false);
assert(a.say('victory'));assert(a.announceLevel('lantern-street'));assert.equal(a.state.current,'victory');assert.equal(a.state.pendingLevel,'level-lantern-street');
a.reset({preserveLevel:true});assert.equal(a.state.pendingLevel,'level-lantern-street');clip('victory').end();assert.equal(a.state.current,'level-lantern-street');assert.equal(clip('level-lantern-street').plays,1);assert.equal(a.state.pendingLevel,null);
a.setState(true,true);assert.equal(a.state.current,null);assert.equal(duck.at(-1),false);assert.equal(a.announceLevel('ferry'),false);
a.setState(true,false);a.say('victory');a.announceLevel('ferry');a.setState(false,false);clip('victory').end();assert.equal(a.state.current,null);assert.equal(a.state.pendingLevel,null,'Hiding or pausing cancels queued speech');
a.setState(true,false);a.announceLevel('harbour');a.reset();assert.equal(a.state.current,null);
assert.equal(a.announceLevel('unknown'),false);assert.equal(a.say('unknown'),false);
rejectNext=true;a.announceLevel('shinkansen');await new Promise(resolve=>setImmediate(resolve));assert.equal(a.state.current,null);assert.equal(duck.at(-1),false,'Playback rejection must restore soundtrack volume');
for(const chapter of CAMPAIGN){assert(chapter.announcement);a.announceLevel(chapter.id);assert(clip('level-'+chapter.id));a.reset();}
assert.deepEqual(CAMPAIGN.map(c=>c.year),[1820,1820,2036,2036,2036]);
console.log('Chapter narration: lazy audio, natural rate, transition reset, victory queue, mute/hide, playback failure and five chapter mappings passed.');

const provenance=JSON.parse(readFileSync(new URL('../docs/assets/audio/announcer/level-provenance.json',import.meta.url)));
for(const chapter of CAMPAIGN)assert.equal(provenance.clips.find(c=>c.id===chapter.id).text,chapter.announcement,'Spoken script must match campaign metadata');
