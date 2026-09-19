export async function resolve(specifier,context,next){
 if(specifier==='three')return {url:new URL('../docs/vendor/three/build/three.module.js',import.meta.url).href,shortCircuit:true};
 if(specifier.startsWith('three/addons/'))return {url:new URL('../docs/vendor/'+specifier,import.meta.url).href,shortCircuit:true};
 return next(specifier,context);
}
