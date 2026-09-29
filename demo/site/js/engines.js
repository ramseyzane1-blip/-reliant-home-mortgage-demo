/* ================= Turntable: the model home, live in 3D, drag it all the way around =================
   The house is a real 3D model drawn live with three.js (js/vendor/three-hero.min.js, loaded only
   for the hero). It comes from the Blender scene (tools/blender/house_scene.py) through
   tools/blender/web_model.py, which bakes Blender's own lighting (Cycles: sun, sky, bounce light,
   soft shadows, the lit rooms) into textures, so the page only paints the baked result: close to
   the renders, cheap to draw, and smooth at any angle. The lighting turns with the house, like
   walking around a real house on a sunny afternoon; the ring stays still.
   Parts (images/model/): house.glb + house.webp (the house, trunks, crown cores; one baked atlas),
   ground.webp (the lawn disc, baked flat; alpha marks where grass grows, drawn as shells here),
   cards.glb + twigs.webp (every leafy twig as one card: baked light per corner x a photo of the twig),
   ring.glb + ring.webp, panes.glb (the window glass). */
const Turntable=(()=>{
/* the camera of the renders: 60 m from (0, 2.6, 0), 7 degrees up, 80mm lens on a 36mm sensor */
const EL=7*Math.PI/180,TAN=18/80,R=11.25;
/* opt: {reduced(), lib: url of the three.js bundle, base: model folder url, v: content version, lost(): WebGL went away} */
function create(box,canvas,opt){
 const probe=document.createElement('canvas');if(!(probe.getContext('webgl2')||probe.getContext('webgl')))return null;
 let T=null,rn=null,scene,cam,turn,loaded=false,ready=false,lost=false,asleep=false,started=false,dirty=true,raf=0,inView=false,vis=false,last=0,sleepT=0;
 const parts=[];   /* every mesh, for disposing when asleep */
 /* ---------- loading ---------- */
 const url=f=>opt.base+f+'?v='+opt.v;
 async function load(){
  T=await import(opt.lib);
  /* edge smoothing (MSAA) only on standard screens: on dense ones it is not needed and costs the most */
  rn=new T.WebGLRenderer({canvas,antialias:(window.devicePixelRatio||1)<1.5,alpha:true,premultipliedAlpha:true,powerPreference:'high-performance'});
  rn.outputColorSpace=T.SRGBColorSpace;rn.setClearColor(0,0);
  scene=new T.Scene();cam=new T.PerspectiveCamera(30,1,5,200);
  cam.position.set(0,60*Math.sin(EL)+2.6,60*Math.cos(EL));cam.lookAt(0,2.6,0);
  turn=new T.Group();scene.add(turn);
  const TL=new T.TextureLoader(),GL=new T.GLTFLoader();GL.setMeshoptDecoder(T.MeshoptDecoder);
  const aniso=Math.min(8,rn.capabilities.getMaxAnisotropy());
  const tex=async(f,flip)=>{const t=await TL.loadAsync(url(f));t.flipY=!!flip;t.colorSpace=T.SRGBColorSpace;t.anisotropy=aniso;return t;};
  const glb=async f=>(await GL.loadAsync(url(f))).scene;
  const add=(g,mat,parent)=>{g.traverse(o=>{if(o.isMesh){o.material=mat;parts.push(o);}});(parent||turn).add(g);};
  const [hT,hG,gT,cT,cG,rT,rG,pG]=await Promise.all([tex('house.webp'),glb('house.glb'),tex('ground.webp',true),tex('twigs.webp'),glb('cards.glb'),tex('ring.webp'),glb('ring.glb'),glb('panes.glb')]);
  /* the house: baked atlas, shown as is (the lighting and the renders' color look are in it) */
  add(hG,new T.MeshBasicMaterial({map:hT,toneMapped:false}));
  /* window glass: a faint warm reflection over the lit rooms */
  add(pG,new T.MeshBasicMaterial({color:new T.Color(1,.83,.66),transparent:true,opacity:.32,depthWrite:false,toneMapped:false}));
  /* the lawn: the baked disc, then shell grass: thin layers stacked above it, each keeping the
     blades that reach its height, so the lawn has depth at this low camera */
  const disc=new T.CircleGeometry(R,128);disc.rotateX(-Math.PI/2);
  const P=disc.attributes.position,UV=disc.attributes.uv;for(let i=0;i<P.count;i++)UV.setXY(i,P.getX(i)/(2*R)+.5,-P.getZ(i)/(2*R)+.5);
  const base=new T.Mesh(disc,new T.MeshBasicMaterial({map:gT,toneMapped:false}));base.position.y=.002;turn.add(base);parts.push(base);
  const SH=12,H=.15;
  for(let k=1;k<=SH;k++){const f=k/SH;
   const m=new T.ShaderMaterial({uniforms:{map:{value:gT},f:{value:f}},
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`uniform sampler2D map;uniform float f;varying vec2 vUv;
     float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
     void main(){vec2 c=vUv*${(2*R/.035).toFixed(1)};vec2 i=floor(c),g=fract(c)-.5;float n=h(i);
      if(n<f*.92||length(g)>(1.-f)*.55*(.6+.4*n))discard;vec4 col=texture2D(map,vUv);if(col.a<.5)discard;
      gl_FragColor=vec4(col.rgb*(.72+.36*f),1.);}`});
   const s=new T.Mesh(disc,m);s.position.y=.002+f*H;s.renderOrder=k;turn.add(s);parts.push(s);}
  /* trees and shrubs: cards; vertex color (baked light) x photo detail x 2 in display values (4.59
     in linear), times a grade matched to the renders' foliage (deeper and greener than the cards'
     flat light gives on its own) */
  add(cG,new T.MeshBasicMaterial({map:cT,vertexColors:true,color:new T.Color(2.43,2.57,1.10),alphaTest:.45,side:T.DoubleSide,toneMapped:false}));
  /* the ring does not turn */
  add(rG,new T.MeshBasicMaterial({map:rT,toneMapped:false}),scene);
  loaded=true;size();dirty=true;
 }
 /* ---------- motion (as before): drag with inertia, arrow keys, and the idle sway ---------- */
 let th=0,target=0,vel=0,drag=null,idle=true,calm=0,pinned=false;
 const MAXV=160;   /* degrees per second at most */
 const AMP=38,W=2*Math.PI/14;   /* the sway: +-38 degrees around the front, 14 s a full swing */
 let sc=0,sc0=0,sa=0,sph=0,st=0,sT=2;
 const ease=x=>x<=0?0:x>=1?1:x*x*(3-2*x);
 function enterIdle(){const w=360*Math.round(th/360);th-=w;target=th;vel=0;idle=true;calm=0;sc0=sc=th;sa=0;sph=0;st=0;sT=Math.max(2.5,Math.abs(th)/20);}
 function size(){if(!loaded||asleep)return;const r=box.getBoundingClientRect();if(r.width<=0)return;
  rn.setPixelRatio(pxr());rn.setSize(r.width,r.height,false);
  const asp=r.width/r.height;cam.aspect=asp;
  /* keep the renders' framing: the full square fits the box */
  cam.fov=2*Math.atan(TAN/Math.min(1,asp))*180/Math.PI;cam.updateProjectionMatrix();dirty=true;}
 /* drawing resolution: the screen's, capped at 2x; stepped down (not below 1x) if frames stay slow */
 let scale=1,slow=0;const pxr=()=>Math.max(1,Math.min(window.devicePixelRatio||1,2)*scale);
 function govern(dt,moving){if(!moving||dt<=0||dt>.2)return;slow=dt>.022?slow+dt:Math.max(0,slow-dt*.5);
  if(slow>1.5&&pxr()>1){scale*=.8;slow=0;size();}}
 function frame(ts){const raw=(ts-(last||ts))/1000,dt=Math.min(.05,raw);last=ts;
  if(loaded&&!asleep){   /* nothing is drawn (and the still picture stays) until every part is in */
   const prev=th;
   if(ready&&idle&&!opt.reduced()){st+=dt;sph+=W*dt;sa=AMP*ease(st/2.5);sc=sc0*(1-ease(st/sT));th=target=sc+sa*Math.sin(sph);}
   else{if(ready&&!drag&&Math.abs(vel)>.02){target+=vel*dt*60;vel*=Math.pow(.94,dt*60);}
    const cap=MAXV*dt;let step=(target-th)*Math.min(1,dt*9);step=Math.max(-cap,Math.min(cap,step));th+=step;
    if(ready&&!drag&&!idle&&!pinned&&Math.abs(vel)<=.02&&Math.abs(target-th)<1){calm+=dt;if(calm>.2)enterIdle();}else calm=0;}
   if(Math.abs(target-th)>60){const c=target-th-Math.sign(target-th)*60;target-=c;if(drag)drag.t-=c;}
   if(Math.abs(th-prev)>1e-4)dirty=true;
   govern(raw,dirty&&ready);
   if(dirty){turn.rotation.y=-th*Math.PI/180;rn.render(scene,cam);dirty=false;
    if(!ready){ready=true;enterIdle();box.classList.add('ready');}}}
  raf=vis&&!lost?requestAnimationFrame(frame):0;}
 const run=()=>{vis=inView&&!document.hidden;if(vis)wake();if(vis&&!raf&&!lost){last=0;raf=requestAnimationFrame(frame);}};
 /* ---------- out of view: give the GPU memory back; it is uploaded again on return ---------- */
 function sleep(){if(asleep||!rn||lost)return;asleep=true;
  for(const o of parts){o.geometry.dispose();const m=o.material;if(m.map)m.map.dispose();if(m.uniforms&&m.uniforms.map)m.uniforms.map.value.dispose();m.dispose();}
  rn.renderLists.dispose();}
 function wake(){if(!asleep)return;asleep=false;size();dirty=true;}
 function start(){if(started)return;started=true;load().then(run).catch(e=>{lost=true;if(opt.lost)opt.lost();console.warn('3D model not loaded',e);});}
 /* ---------- input ---------- */
 box.addEventListener('pointerdown',e=>{wake();pinned=false;target=th;drag={x:e.clientX,t:target,px:e.clientX,pt:performance.now()};idle=false;vel=0;box.setPointerCapture(e.pointerId);box.classList.add('drag','used');});
 box.addEventListener('pointermove',e=>{if(!drag)return;const w=box.clientWidth||400;target=drag.t-(e.clientX-drag.x)/w*200;const now=performance.now();vel=-(e.clientX-drag.px)/w*200/Math.max(1,(now-drag.pt)/16.7);drag.px=e.clientX;drag.pt=now;});
 const up=()=>{if(!drag)return;drag=null;calm=0;box.classList.remove('drag');};
 box.addEventListener('pointerup',up);box.addEventListener('pointercancel',up);
 box.addEventListener('keydown',e=>{const k={ArrowLeft:-20,ArrowRight:20}[e.key];if(k===undefined)return;wake();e.preventDefault();if(idle)target=th;idle=false;pinned=false;calm=-1.5;box.classList.add('used');target+=k;});
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;box.classList.remove('ready');if(opt.lost)opt.lost();});
 new ResizeObserver(size).observe(box);
 new IntersectionObserver(es=>{inView=es[0].isIntersecting;run();}).observe(box);
 new IntersectionObserver(es=>{clearTimeout(sleepT);if(es[0].isIntersecting){wake();start();}else sleepT=setTimeout(sleep,1000);},{rootMargin:'400px 0px'}).observe(box);
 document.addEventListener('visibilitychange',run);
 return {set(a){target=th=a;idle=false;pinned=true;vel=0;dirty=true;if(loaded&&!asleep){turn.rotation.y=-a*Math.PI/180;rn.render(scene,cam);dirty=false;}},
  ready:()=>ready,angle:()=>th,sleep(){clearTimeout(sleepT);sleep();},asleep:()=>asleep,
  info:()=>rn?{calls:rn.info.render.calls,triangles:rn.info.render.triangles,textures:rn.info.memory.textures,geometries:rn.info.memory.geometries}:null,
  draw(a){if(!loaded||asleep)return false;turn.rotation.y=-a*Math.PI/180;rn.render(scene,cam);return true;}};
}
return {create};
})();

/* ================= Walk: a short step inside, then a welcome =================
   After the pre-qualification: a slow push into the front door, a quick dissolve to the living room with
   the fireplace (as if the door had opened and you stepped in), then "Welcome home" with a house outline
   drawing itself and a soft sweep of light, then "See my results". About 4 seconds.
   Two photos, CSS transforms and opacity only (the Web Animations API runs them on the compositor), so it
   stays smooth on any phone. The timeline can be seeked for tests (window.__walk.seek(t)). */
const Walk=(()=>{
const SHOTS={door:{f:'images/door.jpg',wh:[1350,1165],a:[503,97,899,969]},    // a: the door
             room:{f:'images/inside-2.jpg',wh:[1448,1086],a:[696,431,852,565]}}; // a: the fireplace
const cache={};
function preload(){return Promise.all(Object.values(SHOTS).map(s=>cache[s.f]||(cache[s.f]=new Promise(res=>{const i=new Image();i.decoding='async';
 i.onload=()=>{(i.decode?i.decode():Promise.resolve()).catch(()=>{}).then(()=>res(i));};i.onerror=()=>{delete cache[s.f];res(null);};i.src=s.f;}))));}

/* the timeline, in seconds */
const T={push:[0,1.75],room:[1.05,1.7],roomPush:[1.05,5],house:[1.9,3.1],cap:[2.35,3.05],sweep:[2.6,3.8],actions:3.5,
 cues:[[0,'start'],[.7,'latch'],[.85,'swing'],[1.35,'inside']]};
const HOUSE=`<svg class="wk-house" viewBox="0 0 100 92" aria-hidden="true" focusable="false"><path pathLength="1" d="M8 46 50 10l42 36"/><path pathLength="1" d="M68 26V14h9v20"/>
 <path pathLength="1" d="M18 38v50h64V38"/><path pathLength="1" d="M42 88V64h16v24"/><path pathLength="1" d="M26 50h10v10H26zM64 50h10v10H64z"/></svg>`;

function play(root,opts){
 const el=(t,c,h)=>{const e=document.createElement(t);if(c)e.className=c;if(h)e.innerHTML=h;return e;};
 const scene=el('div','wk'),door=el('img','wk-img'),room=el('img','wk-img'),scrim=el('div','wk-scrim'),sweep=el('div','wk-sweep');
 door.src=SHOTS.door.f;room.src=SHOTS.room.f;door.alt=room.alt='';
 scene.append(door,room,scrim,sweep);root.appendChild(scene);
 const cap=opts.cap;cap.innerHTML=HOUSE+opts.capB;const house=cap.querySelector('.wk-house'),lines=[...house.querySelectorAll('path')];
 // each photo covers the screen, its anchor as close to the center as covering allows; it scales about the anchor
 function fit(img,s){const W=root.clientWidth||innerWidth,H=root.clientHeight||innerHeight,k=Math.max(W/s.wh[0],H/s.wh[1]),w=s.wh[0]*k,h=s.wh[1]*k,
   ax=(s.a[0]+s.a[2])/2*k,ay=(s.a[1]+s.a[3])/2*k,x=Math.min(0,Math.max(W-w,W/2-ax)),y=Math.min(0,Math.max(H-h,H/2-ay));
  Object.assign(img.style,{width:w+'px',height:h+'px',left:x+'px',top:y+'px',transformOrigin:`${ax}px ${ay}px`});}
 const layout=()=>{fit(door,SHOTS.door);fit(room,SHOTS.room);};layout();addEventListener('resize',layout);
 const ms=s=>s*1000,A=(e,k,[a,b],easing='ease-in-out')=>e.animate(k,{delay:ms(a),duration:ms(b-a),easing,fill:'both'});
 const anims=[
  // the push, then the door brightens into the warm light of the room as it fades (one animation: they share filter)
  A(door,[{transform:'scale(1)',filter:'brightness(1)',easing:'cubic-bezier(.45,0,.6,1)'},{transform:'scale(1.4)',filter:'brightness(1.1)',offset:T.room[0]/T.push[1]},
   {transform:'scale(1.55)',filter:'brightness(1.7)'}],T.push,'linear'),
  A(room,[{opacity:0},{opacity:1}],T.room),
  A(room,[{transform:'scale(1.1)'},{transform:'scale(1)'}],T.roomPush,'cubic-bezier(.2,.6,.3,1)'),
  A(scrim,[{opacity:0},{opacity:1}],[T.house[0],T.cap[1]]),
  ...lines.map((p,i)=>A(p,[{strokeDashoffset:1},{strokeDashoffset:0}],[T.house[0]+i*.12,T.house[1]-(lines.length-1-i)*.08])),
  A(cap,[{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'none'}],[T.house[0]-.1,T.cap[1]]),
  A(sweep,[{transform:'translateX(-120%) skewX(-18deg)',opacity:0},{opacity:1,offset:.3},{opacity:1,offset:.7},{transform:'translateX(120%) skewX(-18deg)',opacity:0}],T.sweep)];
 anims.forEach(a=>a.pause());
 let t0=null,held=null,stopped=false,raf=0,shown=false;const fired=new Set();
 // its own clock (a finished animation's time stops at its end); held: the time a test seeked to
 const time=()=>held!=null?held:t0==null?0:(performance.now()-t0)/1000;
 function tick(){if(stopped)return;const t=time();
  T.cues.forEach((c,i)=>{if(t>=c[0]-.05&&!fired.has(i)){fired.add(i);opts.cue&&opts.cue(c[1],0,Math.max(0,c[0]-t));}});
  if(t>=T.actions&&!shown){shown=true;opts.onExplore&&opts.onExplore();}
  if(t<T.roomPush[1]&&held==null)raf=requestAnimationFrame(tick);}
 const api={T,get started(){return t0!==null;},
  start(){t0=performance.now();anims.forEach(a=>a.play());raf=requestAnimationFrame(tick);},
  stop(){stopped=true;cancelAnimationFrame(raf);removeEventListener('resize',layout);anims.forEach(a=>a.cancel());scene.remove();},
  time,
  seek(t){cancelAnimationFrame(raf);held=t;anims.forEach(a=>{a.pause();a.currentTime=ms(t);});tick();return Promise.resolve();}, // tests: show the frame at t (seconds)
  render(t){api.seek(t);}};
 return api;
}
return {preload,play,SHOTS,T};
})();
