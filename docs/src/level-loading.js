export const INTRO_MODELS=['assets/ninja-game.glb','assets/mech-boss.glb'];
export const LEVEL_MODELS={
 garden:['assets/environment-kit.glb'],
 'lantern-street':['assets/scenes/lantern-street/lantern-street.glb','assets/craftsman/retargeted.glb','assets/female-worker/retargeted.glb'],
 ferry:['assets/ferry-refined.glb','assets/warlord/retargeted.glb'],
 harbour:['assets/harbour-refined.glb','assets/samurai/retargeted.glb'],
 shinkansen:['assets/shinkansen.glb','assets/imported-ninja/retargeted.glb'],
};

// Share in-flight requests and keep successfully decoded assets for revisits.
export function createResourceCache(){
 const entries=new Map();
 return {has:key=>entries.has(key),get(key,load){
  if(!entries.has(key))entries.set(key,Promise.resolve().then(load).catch(error=>{entries.delete(key);throw error}));
  return entries.get(key);
 }};
}
export function restoreLevelEnergy(hero){hero.hp=hero.maxHp??100;hero.stamina=100;hero.regenDelay=0;}

export function createProgressModel(sizes){
 let files=new Map(),phase='idle',title='',detail='',percent=0;
 return {
  begin(name,paths){title=name;phase='download';detail='Downloading models';percent=0;files=new Map(paths.map(path=>[path,{total:sizes[path]||1,loaded:0}]));},
  download(path,loaded){const file=files.get(path.replace(/^\.\//,''));if(!file||phase!=='download')return;file.loaded=Math.max(file.loaded,Math.min(file.total,Math.max(0,loaded)));let total=0,done=0;for(const f of files.values()){total+=f.total;done+=f.loaded}percent=total?Math.floor(done/total*100):100;if(percent===100){phase='prepare';detail='Preparing models and textures';}},
  prepare(message){phase='prepare';detail=message;},
  finish(){phase='ready';percent=100;},
  fail(){phase='error';detail='Could not finish loading. Check your connection, then reload to try again.';},
  get state(){return {phase,title,detail,percent,files:files.size}},
 };
}

// Texture requests can be started by scene construction, after the GLBs resolve.
export function trackLoadingManager(manager){
 let pending=0;const errors=[],waiters=[];
 const start=manager.itemStart.bind(manager),end=manager.itemEnd.bind(manager),error=manager.itemError.bind(manager);
 const settle=()=>{if(pending)return;for(const waiter of waiters.splice(0))errors.length?waiter.reject(new Error('Asset failed: '+errors[0])):waiter.resolve();};
 manager.itemStart=url=>{pending++;start(url)};
 manager.itemEnd=url=>{try{end(url)}finally{pending--;settle()}};
 manager.itemError=url=>{errors.push(url);error(url)};
 return {clearErrors(){errors.length=0},wait(){return new Promise((resolve,reject)=>{waiters.push({resolve,reject});settle()})},get pending(){return pending}};
}

let downloadListener=null;
export function onAssetDownload(listener){downloadListener=listener;}
export function assetDownloadProgress(url,loaded){downloadListener?.(url,loaded);}
