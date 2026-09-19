const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x)};
export const INTRO_DURATION=32;
export function introBeat(t){
 t=((t%INTRO_DURATION)+INTRO_DURATION)%INTRO_DURATION;
 const index=t<9.3?0:t<18.6?1:2,local=t-index*9.3;
 return {index,phase:local<2?'anticipation':local<2.36?'slash':local<3.4?'hold':local<6.3||index===2?'walk':'dolly',cameraZ:-8*smooth((t-6.3)/3)-8*smooth((t-15.6)/3),veil:Math.max(1-smooth(t/.65),smooth((t-30.5)/1.3))};
}

// A narrow diagonal seam in a 30-row cloth grid, with flat suspension and hem.
export function introBannerRow(u,v){const line=.10+.46*u,j=v*30;if(j<=14)return j/14*(line-.003);if(j<=16)return line+(j-15)*.003;return line+.003+(j-16)/14*(1-line-.003)}

export function introForward(local){return -.38+Math.max(0,local-3.4)*1.35;}
