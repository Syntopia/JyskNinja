import {Vector2} from 'three';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';

// Display-space pencil illustration: Sobel contours + nested tonal hatch layers.
// Screen-anchored paper/strokes intentionally have no animated noise or history.
export function createSketchPass(){
 const pass=new ShaderPass({name:'Graphite pencil sketch',uniforms:{tDiffuse:{value:null},pixels:{value:new Vector2(1,1)},pixelRatio:{value:1},amount:{value:1},weight:{value:1},hatching:{value:.7},paper:{value:.35},colour:{value:0}},
 vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
 fragmentShader:`
 uniform sampler2D tDiffuse;uniform vec2 pixels;uniform float pixelRatio,amount,weight,hatching,paper,colour;varying vec2 vUv;
 float pencilLuma(vec3 c){return dot(c,vec3(.2126,.7152,.0722));}
 float sampleL(vec2 offset){return pencilLuma(texture2D(tDiffuse,clamp(vUv+offset,vec2(0.),vec2(1.))).rgb);}
 float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float hatch(vec2 p,vec2 direction,float spacing,float seed){
  float along=dot(p,vec2(-direction.y,direction.x));
  float across=dot(p,direction)+.24*sin(along*.075+seed)+.13*sin(along*.23+seed*4.);
  float cell=floor(across/spacing),distance=abs(fract(across/spacing)-.5)*spacing;
  float width=(.30+.13*hash(vec2(cell,seed)))*weight;
  float aa=max(fwidth(across)*.65,.32);
  float stroke=1.-smoothstep(max(0.,width-aa),width+aa,distance);
  // Gently broken graphite, without flickering random seeds every frame.
  float tooth=.72+.28*hash(floor(p*.85)+seed);
  float pressure=.8+.2*sin(along*.042+cell*2.3);
  float run=fract((along+hash(vec2(cell,seed))*41.)/31.);
  float taper=smoothstep(.02,.14,run)*(1.-smoothstep(.65,.96,run));
  return stroke*tooth*pressure*(.25+.75*taper);
 }
 void main(){
  vec4 original=texture2D(tDiffuse,vUv);vec2 stepUV=vec2(max(.8,weight)*pixelRatio)/pixels;
  float tl=sampleL(stepUV*vec2(-1.,1.)),tc=sampleL(stepUV*vec2(0.,1.)),tr=sampleL(stepUV);
  float ml=sampleL(stepUV*vec2(-1.,0.)),mr=sampleL(stepUV*vec2(1.,0.));
  float bl=sampleL(-stepUV),bc=sampleL(stepUV*vec2(0.,-1.)),br=sampleL(stepUV*vec2(1.,-1.));
  float center=pencilLuma(original.rgb),tone=(center*4.+tc+bc+ml+mr)/8.;
  float gx=-tl-2.*ml-bl+tr+2.*mr+br,gy=tl+2.*tc+tr-bl-2.*bc-br;
  float edge=smoothstep(.10,.72,length(vec2(gx,gy)))*.65;
  float shade=clamp(1.-pow(max(tone,0.),.52),0.,1.);
  vec2 p=vUv*pixels/max(pixelRatio,1.);
  float a=hatch(p,vec2(.7071,.7071),4.8,1.);
  float b=hatch(p,vec2(-.7071,.7071),5.3,7.);
  float c=hatch(p,vec2(.2588,.9659),4.6,13.);
  float ink=a*smoothstep(.12,.42,shade)+b*smoothstep(.38,.70,shade)+c*smoothstep(.66,.94,shade);
  float grain=hash(floor(p*1.35))-.5;
  float fibres=sin(p.x*.7+sin(p.y*.12))*sin(p.y*1.9)*.5;
  vec3 sheet=vec3(.965,.948,.902)+(grain*.045+fibres*.016)*paper;
  float graphite=clamp(shade*.60+ink*hatching*.34+edge*(.7+.3*weight),0.,.94);
  graphite*=.95+grain*.10*paper;
  vec3 drawing=mix(sheet,vec3(.095,.088,.079),graphite);
  vec3 pigment=clamp(original.rgb/(center+.08),vec3(.35),vec3(1.45));
  drawing*=mix(vec3(1.),mix(vec3(1.),pigment,.48),colour);
  gl_FragColor=vec4(mix(original.rgb,clamp(drawing,0.,1.),amount),original.a);
 }`});
 pass.material.depthTest=false;pass.material.depthWrite=false;pass.enabled=false;
 return pass;
}
