import {createProgressModel,onAssetDownload} from './level-loading.js';
import {modelSizes} from './model-sizes.js';
export function createLoadingUI(){
 const model=createProgressModel(modelSizes),panel=document.createElement('section');
 panel.id='asset-loading';panel.className='hidden';panel.setAttribute('aria-labelledby','asset-loading-title');
 panel.innerHTML='<span class="loading-mark" lang="ja">忍</span><h2 id="asset-loading-title"></h2><progress max="100" aria-label="Loading progress"></progress><p role="status" aria-live="polite"></p><button class="primary hidden" type="button">Reload and retry</button>';
 document.body.appendChild(panel);
 const title=panel.querySelector('h2'),bar=panel.querySelector('progress'),status=panel.querySelector('p'),retry=panel.querySelector('button');
 retry.onclick=()=>location.reload();
 function draw(){const state=model.state;panel.classList.toggle('hidden',state.phase==='ready'||state.phase==='idle');document.body.dataset.loading=String(!['ready','idle'].includes(state.phase));panel.dataset.phase=state.phase;panel.dataset.percent=state.percent;title.textContent=state.title;retry.classList.toggle('hidden',state.phase!=='error');
  if(state.phase==='download'){bar.value=state.percent;status.textContent=`${state.detail} · ${state.percent}%`;}else{bar.removeAttribute('value');status.textContent=state.detail;}
  bar.classList.toggle('hidden',state.phase==='error');
 }
 onAssetDownload((url,loaded)=>{model.download(url,loaded);draw()});
 return {begin(title,paths){model.begin(title,paths);draw()},prepare(message){model.prepare(message);draw()},finish(){model.finish();draw()},fail(error){console.error(error);model.fail();draw()},get state(){return model.state}};
}
// Let the progress overlay paint before synchronous scene assembly begins.
export const loadingPaint=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
