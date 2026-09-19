// CC0 source recordings and processing details live beside the WAV files.
export const recordedKinds={slash:['slash',.82,1],heavy:['heavy',1,.89],hit:['hit',1,1],block:['clash',.8,.94],parry:['clash',1.05,1.05],metal:['clash',.75,.97],'mech-hit':['clash',.95,.82],body:['body',.9,.88],'train-body':['body',1.2,.78]};

export function createVariantPicker(random=Math.random){
 const bags=new Map(),previous=new Map();
 return (key,count)=>{
  let bag=bags.get(key);
  if(!bag?.length){
   bag=Array.from({length:count},(_,i)=>i);
   for(let i=count-1;i>0;i--){const j=Math.floor(random()*(i+1));[bag[i],bag[j]]=[bag[j],bag[i]];}
   if(count>1&&bag.at(-1)===previous.get(key))[bag[0],bag[count-1]]=[bag[count-1],bag[0]];
   bags.set(key,bag);
  }
  const index=bag.pop();previous.set(key,index);return index;
 };
}

export function createRecordedFoley(){
 const banks=new Map(),pick=createVariantPicker();let error=null,manifest=null,last=null;
 const base=new URL('../assets/audio/combat/',import.meta.url);
 const loaded=(async()=>{
  const request=await fetch(new URL('manifest.json',base));if(!request.ok)throw Error(`Foley manifest: ${request.status}`);
  manifest=await request.json();
  // Decode before the first interaction, without starting audible playback.
  const Decoder=window.OfflineAudioContext||window.webkitOfflineAudioContext;
  const decoder=new Decoder(1,1,44100);
  await Promise.all(Object.entries(manifest.banks).map(async([kind,names])=>{
   const buffers=await Promise.all(names.map(async name=>{const response=await fetch(new URL(name,base));if(!response.ok)throw Error(`Foley ${name}: ${response.status}`);return decoder.decodeAudioData(await response.arrayBuffer());}));
   banks.set(kind,buffers);
  }));return true;
 })().catch(e=>{error=String(e);console.error('Recorded combat audio could not load:',e);return false;});
 function select(kind){
  const recipe=recordedKinds[kind];if(!recipe)return null;
  const [bank,gain,rate]=recipe,buffers=banks.get(bank);if(!buffers?.length)return null;
  const index=pick(bank,buffers.length);last={kind,bank,index,file:manifest.banks[bank][index]};
  return {buffer:buffers[index],gain,rate};
 }
 return {loaded,select,get state(){return {ready:banks.size===5,error,banks:Object.fromEntries([...banks].map(([k,v])=>[k,v.length])),last}}};
}
