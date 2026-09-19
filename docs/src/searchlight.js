import * as T from 'three';
import {V,segmentBox} from './physics.js';
import {createSearchlightTracking} from './searchlight-tracking.js';
import {poseArmTarget} from './ledge-climb.js';
export function createSearchlight(parent,{position,platformHeight=0,makeOperator,solids}){
 const root=new T.Group();root.name='Ninja-operated marine searchlight';parent.add(root);
 const metal=new T.MeshStandardMaterial({name:'Searchlight gunmetal enamel',color:0x26363d,metalness:.75,roughness:.32}),rim=new T.MeshStandardMaterial({color:0xb5b9a8,metalness:.75,roughness:.28}),black=new T.MeshStandardMaterial({color:0x111c20,roughness:.75}),lens=new T.MeshStandardMaterial({name:'Searchlight Fresnel glass',color:0xd8efff,emissive:0xd0edff,emissiveIntensity:2.5,roughness:.18,metalness:.1});
 function mesh(g,m,p,group=root){const o=new T.Mesh(g,m);o.position.copy(p);o.castShadow=m!==lens;o.receiveShadow=true;group.add(o);return o}
 const box=(p,s,m=metal,g=root)=>mesh(new T.BoxGeometry(...s),m,V(...p),g);
 function rod(a,b,r,m=metal,g=root){const d=b.clone().sub(a),o=mesh(new T.CylinderGeometry(r,r,d.length(),10),m,a.clone().add(b).multiplyScalar(.5),g);o.quaternion.setFromUnitVectors(V(0,1,0),d.normalize());return o}
 const deck=position.clone().add(V(0,platformHeight,0));
 // The raised harbour platform is bolted into the ship roof, with four braces and a ladder.
 if(platformHeight>0){for(const x of [-.9,.9])for(const z of [-.85,.85]){const base=position.clone().add(V(x,0,z)),top=deck.clone().add(V(x,0,z));rod(base,top,.065);rod(base,deck.clone().add(V(-x,0,z)),.038)}for(let i=0;i<platformHeight/.3;i++)rod(position.clone().add(V(-.95,i*.3,-.9)),position.clone().add(V(-.45,i*.3,-.9)),.027,rim)}
 box(deck.clone().add(V(0,.06,0)).toArray(),[2.65,.12,2.65]);
 for(const x of [-1.25,1.25])for(const z of [-1.25,1.25])rod(deck.clone().add(V(x,0,z)),deck.clone().add(V(x,.75,z)),.035,rim);
 for(const z of [-1.25,1.25])rod(deck.clone().add(V(-1.25,.75,z)),deck.clone().add(V(1.25,.75,z)),.03,rim);
 mesh(new T.CylinderGeometry(.48,.6,.15,24),rim,deck.clone().add(V(0,.2,0)));mesh(new T.CylinderGeometry(.15,.22,.95,20),metal,deck.clone().add(V(0,.69,0)));
 const yaw=new T.Group();yaw.position.copy(deck).add(V(0,1.4,0));root.add(yaw);
 for(const x of [-.67,.67]){box([x,-.18,0],[.11,.75,.15],metal,yaw);rod(V(x,0,-.12),V(x,0,.12),.17,rim,yaw)}box([0,-.54,0],[1.4,.1,.18],metal,yaw);
 const head=new T.Group();yaw.add(head);const shell=mesh(new T.CylinderGeometry(.53,.46,.82,32,1,true),metal,V(0,0,0),head);shell.rotation.x=Math.PI/2;
 for(const z of [-.42,.39]){const ring=mesh(new T.TorusGeometry(.53,.045,8,40),rim,V(0,0,z),head)}
 mesh(new T.CircleGeometry(.48,40),lens,V(0,0,.415),head);
 for(let i=1;i<6;i++)mesh(new T.TorusGeometry(i*.078,.005,4,40),rim,V(0,0,.422),head);
 const back=mesh(new T.CircleGeometry(.46,32),black,V(0,0,-.415),head);back.rotation.y=Math.PI;
 for(let i=0;i<8;i++){const a=i*Math.PI/4;mesh(new T.SphereGeometry(.027,6,4),black,V(.52*Math.cos(a),.52*Math.sin(a),.44),head)}
 for(const x of [-.52,.52])rod(V(x,-.2,-.36),V(x,-.2,-.70),.035,black,head);
 const operator=makeOperator();for(const o of [operator.root,operator.shadow,operator.bar]){o.removeFromParent();root.add(o)}operator.root.userData.noReflectionCapture=true;operator.sword.visible=false;operator.tell.visible=false;operator.bar.visible=false;operator.play('guard',0,.32);
 const origin=deck.clone().add(V(0,1.4,0)),tracking=createSearchlightTracking(origin,V(0,1,2));
 const light=new T.SpotLight(0xe1efff,3400,65,.18,.55,2);light.name='Rooftop tracking projector';light.castShadow=true;light.shadow.mapSize.set(512,512);light.shadow.camera.near=.6;light.shadow.camera.far=65;light.shadow.bias=-.0003;light.shadow.normalBias=.08;light.shadow.autoUpdate=true;light.shadow.needsUpdate=true;root.add(light,light.target);
 // Beam scattering is integrated against scene depth in SearchlightVolumePass.
 // Keep a transform-only handle for diagnostics; no luminous cone shell is drawn.
 const beam=new T.Object3D();beam.name='Projector volume bounds';root.add(beam);
 let beamLength=40;
 function update(dt,player,camera){tracking.step(dt,player,solids);const state=tracking.state;const dir=state.direction;yaw.rotation.y=state.yaw;head.rotation.x=-state.pitch;yaw.updateMatrixWorld(true);
  const source=head.localToWorld(V(0,0,.47));light.position.copy(source);light.target.position.copy(source).addScaledVector(dir,40);light.target.updateMatrixWorld();
  let length=55;const end=source.clone().addScaledVector(dir,length);for(const w of solids){if(w.broken||w.bamboo||w.searchlightTransparent)continue;const hit=segmentBox(source,end,w.box);if(hit)length=Math.min(length,source.distanceTo(hit))}if(dir.y<-.01)length=Math.min(length,Math.max(.5,-source.y/dir.y));beamLength=Math.max(.5,length);beam.position.copy(source);beam.quaternion.setFromUnitVectors(V(0,0,1),dir);beam.scale.set(Math.tan(light.angle)*beamLength,Math.tan(light.angle)*beamLength,beamLength);
  operator.pos.copy(deck).addScaledVector(V(Math.sin(state.yaw),0,Math.cos(state.yaw)),-.89).add(V(0,.12,0));operator.yaw=state.yaw;operator.visual(dt,camera);
  for(const side of ['left','right'])poseArmTarget(operator,side,head.localToWorld(V(side==='left'?.52:-.52,-.2,-.65)));operator.root.updateMatrixWorld(true);operator.tell.visible=false;operator.bar.visible=false;
 }
 return {root,light,beam,operator,update,reset(){tracking.reset();light.shadow.needsUpdate=true},get state(){const s=tracking.state;return{...s,aim:s.aim.toArray(),direction:s.direction.toArray(),position:origin.toArray(),beamLength,shadowSize:512,shadowUpdate:'every-frame',beamTriangles:0,volume:'depth-aware single scattering',volumeSamples:12,operator:operator.name}}};
}
