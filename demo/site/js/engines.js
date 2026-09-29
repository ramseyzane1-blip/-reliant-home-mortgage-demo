/* ================= Turntable: drag the model home around 360 degrees =================
   A 3D model of the house (tools/blender/house_scene.py) rendered as a 360-degree turn, one frame
   every 10 degrees, with a transparent background so the house floats on the page. Between two
   neighboring frames, each is drawn on a mesh displaced along precomputed optical flow
   (images/turn/flow-*.bin) while they blend, so the turn is continuous at any angle. */
const Turntable=(()=>{
const VS=`attribute vec2 uv;attribute vec2 fl;uniform float k,asp;varying vec2 vu;
void main(){vu=uv;vec2 q=uv+fl*k;vec2 n=vec2(q.x*2.-1.,1.-q.y*2.);if(asp>=1.)n.x/=asp;else n.y*=asp;gl_Position=vec4(n,0.,1.);}`;
const FS=`precision mediump float;uniform sampler2D tex;uniform float w;varying vec2 vu;void main(){gl_FragColor=texture2D(tex,vu)*w;}`;
/* views: [{f: 960px url, s: 768px url, a: degrees}]; opt: {reduced(), flow: {front, rest} urls, fixed: {f, s} (the
   parts that never move: most of the ring, the front of the plinth), front: the fallback <img> (its
   choice of copy is reused), lost(): WebGL went away} */
function create(box,canvas,views,opt){
 const gl=canvas.getContext('webgl',{alpha:true,premultipliedAlpha:true,antialias:false});if(!gl)return null;
 const sh=(t,s)=>{const x=gl.createShader(t);gl.shaderSource(x,s);gl.compileShader(x);if(!gl.getShaderParameter(x,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(x));return x;};
 const pr=gl.createProgram();gl.attachShader(pr,sh(gl.VERTEX_SHADER,VS));gl.attachShader(pr,sh(gl.FRAGMENT_SHADER,FS));gl.bindAttribLocation(pr,0,'uv');gl.bindAttribLocation(pr,1,'fl');gl.linkProgram(pr);
 if(!gl.getProgramParameter(pr,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(pr));
 const U={};['k','asp','tex','w'].forEach(k=>U[k]=gl.getUniformLocation(pr,k));
 const buf=(d,t)=>{const b=gl.createBuffer();gl.bindBuffer(t||gl.ARRAY_BUFFER,b);gl.bufferData(t||gl.ARRAY_BUFFER,d,gl.STATIC_DRAW);return b;};
 /* a G x G grid mesh over the frame; rebuilt at the flow file's grid size when that arrives */
 const n=views.length;let bU,bI,NI,zero;
 function mesh(G){const UV=[];for(let j=0;j<G;j++)for(let i=0;i<G;i++)UV.push(i/(G-1),j/(G-1));
  const I=[];for(let j=0;j<G-1;j++)for(let i=0;i<G-1;i++){const a=j*G+i,b=a+1,c=a+G,d=c+1;I.push(a,c,b,b,c,d);}
  bU=buf(new Float32Array(UV));bI=buf(new Uint16Array(I),gl.ELEMENT_ARRAY_BUFFER);NI=I.length;zero=buf(new Float32Array(G*G*2));}
 mesh(2);
 /* one plain quad for a frame shown as is */
 const qU=buf(new Float32Array([0,0,1,0,0,1,1,1])),qI=buf(new Uint16Array([0,2,1,1,2,3]),gl.ELEMENT_ARRAY_BUFFER),qZ=buf(new Float32Array(8));
 /* the fixed layer goes on top, still, drawn only over the 32x32 tiles where it has content (a
    third of the area), so it costs little fill. Its tiles come from a tiny copy of its alpha. */
 let fx=null,fxU,fxI,fxZ,fxN=0,fxBusy=false,fxGen=0;
 function fetchFixed(){if(!opt.fixed||fxBusy||(fx&&fxGen===texGen))return;fxBusy=true;const g=texGen,S=texSize||960;
  const src=opt.fixed.s&&small()?opt.fixed.s:opt.fixed.f;
  const viaImg_=()=>new Promise((ok,no)=>{const im=new Image();im.onload=()=>ok(im);im.onerror=no;im.src=src;});
  (window.createImageBitmap?fetch(src).then(r=>r.ok?r.blob():Promise.reject()).then(b=>createImageBitmap(b,{premultiplyAlpha:'premultiply',resizeWidth:S,resizeHeight:S,resizeQuality:'high'})).catch(viaImg_):viaImg_()).then(im=>{
   fxBusy=false;if(g!==texGen||lost){if(im.close)im.close();return;}
   const T=32,c=document.createElement('canvas');c.width=c.height=T;const x=c.getContext('2d');x.drawImage(im,0,0,T,T);const a=x.getImageData(0,0,T,T).data;
   const UV=[],I=[];for(let j=0;j<T;j++)for(let i=0;i<T;i++){let on=false;for(let dj=-1;dj<=1&&!on;dj++)for(let di=-1;di<=1&&!on;di++){const y=j+dj,z=i+di;if(y>=0&&y<T&&z>=0&&z<T&&a[(y*T+z)*4+3]>0)on=true;}
    if(!on)continue;const v=UV.length/2;UV.push(i/T,j/T,(i+1)/T,j/T,i/T,(j+1)/T,(i+1)/T,(j+1)/T);I.push(v,v+2,v+1,v+1,v+2,v+3);}
   if(fxU)[fxU,fxI,fxZ].forEach(b=>gl.deleteBuffer(b));fxU=buf(new Float32Array(UV));fxI=buf(new Uint16Array(I),gl.ELEMENT_ARRAY_BUFFER);fxZ=buf(new Float32Array(UV.length));fxN=I.length;
   const t=fx||gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,im instanceof HTMLImageElement);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,im);if(im.close)im.close();
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
   fx=t;fxGen=g;dirty=true;}).catch(()=>{fxBusy=false;setTimeout(fetchFixed,3000);});}
 /* flow (tools/house_views.py), in two files: the pairs the idle sway and a first drag use (front,
    fetched with the front frames) and the rest (fetched once the hero is ready or the visitor starts
    turning). Each: 'FLW2', uint16 pair count, uint16 grid, uint16 pair index k (frames k and k+1)
    per pair, float32 scale per field, int8 values; per pair, fields k→k+1 then k+1→k. A pair
    without its flow simply blends; a flow that lands while its pair is on screen waits until the
    turn moves on to another pair, so nothing pops. */
 const flows=views.map(()=>null),pend=[];let G0=0,flowFront=!opt.flow,flowRest=!opt.flow;
 const fetchFlow=(u,done)=>fetch(u).then(r=>r.ok?r.arrayBuffer():Promise.reject()).then(ab=>{const dv=new DataView(ab);
  if(ab.byteLength<8||dv.getUint32(0)!==0x464c5732)return;const np=dv.getUint16(4,true),G=dv.getUint16(6,true),sz=G*G*2,o=8+np*2,d=o+np*8;
  if(ab.byteLength!==d+np*2*sz||(G0&&G!==G0))return;if(!G0){G0=G;mesh(G);}const q=new Int8Array(ab,d);
  /* unpacked and uploaded a few pairs per animation frame (in frame()), so a file landing mid-drag costs no hitch */
  for(let p=0;p<np;p++){const k=dv.getUint16(8+p*2,true);if(k>=n)continue;
   pend.push([k,()=>[0,1].map(e=>{const m=2*p+e,sc=dv.getFloat32(o+m*4,true),f=new Float32Array(sz);for(let i=0;i<sz;i++)f[i]=q[m*sz+i]*sc;return buf(f);})]);}
 }).catch(()=>{}).finally(()=>{done();dirty=true;});
 /* Frames. Nothing downloads until the hero is about to scroll into view; then the flow and the
    two frames next to the front, then the rest the idle sway uses (+-40 degrees), then the others
    once those are in or the visitor starts turning. Each frame is decoded off the main thread at the canvas's pixel size
    (texSize) and uploaded one per animation frame, never during a drag unless the frame on screen
    is missing; the decoded copy is released right after upload. Phones and devices reporting under
    4 GB keep only the POOL nearest frames on the GPU (the others are fetched into the HTTP cache
    and decoded again when needed). A frame that fails to load is retried with backoff. About a
    second after the hero is well out of view (scrolled away, another page, the walk-through) it
    sleeps: every texture and its drawing buffer are released and the still <img>s show again; it
    wakes and re-uploads from the HTTP cache as it comes back. */
 const N=n,all=views;
 const tex=all.map(()=>null),gen=all.map(()=>0),dec=all.map(()=>null),busy=all.map(()=>false),fails=all.map(()=>0),retry=all.map(()=>0);
 let dirty=true,cur=0,texSize=0,texGen=1,started=false,allFetched=false,lost=false,asleep=false,sleepT=0;
 const POOL=Math.min(n,(navigator.deviceMemory&&navigator.deviceMemory<4)||matchMedia('(pointer: coarse)').matches?16:n);   /* phones: at most ~33 MB of frames on the GPU */
 const A=views.map(v=>v.a),adist=(i,th)=>Math.abs(((A[i]-th)%360+540)%360-180);
 /* use the copy the fallback <img> already loaded (so frame 0 is not fetched twice); before it has chosen, pick by size: phones get the 768px copies */
 const small=()=>{const s=opt.front&&opt.front.currentSrc;return s?s.indexOf('/sm/')>=0&&texSize<=768:texSize<=768;};
 const url=i=>small()&&all[i].s?all[i].s:all[i].f;
 const viaImg=i=>new Promise((ok,no)=>{const im=new Image();im.decoding='async';im.onload=()=>ok(im);im.onerror=no;im.src=url(i);});
 function fetchImg(i){if(busy[i]||dec[i]||(tex[i]&&gen[i]===texGen)||performance.now()<retry[i])return;busy[i]=true;
  const S=texSize||960,g=texGen;
  (window.createImageBitmap?fetch(url(i)).then(r=>r.ok?r.blob():Promise.reject()).then(b=>createImageBitmap(b,{premultiplyAlpha:'premultiply',resizeWidth:S,resizeHeight:S,resizeQuality:'high'})).catch(()=>viaImg(i)):viaImg(i))
   .then(im=>{busy[i]=false;if(g!==texGen){if(im.close)im.close();return;}dec[i]=im;fails[i]=0;dirty=true;})
   .catch(()=>{busy[i]=false;fails[i]++;retry[i]=performance.now()+Math.min(30000,1000*2**fails[i]);dirty=true;});}
 const byDist=th=>A.map((_,i)=>i).sort((a,b)=>adist(a,th)-adist(b,th));
 let ordAt=1e9,ord=null;const nearFirst=()=>{if(Math.abs(cur-ordAt)>3){ordAt=cur;ord=byDist(cur);}return ord;};   /* re-sorted only when the view moves */
 let warmed=false;
 function fetchRest(){if(allFetched||asleep)return;allFetched=true;
  if(opt.flow&&!flowRest){flowRest=true;fetchFlow(opt.flow.rest,()=>{});}
  /* frames beyond the pool only go into the HTTP cache, so turning to them later needs no network */
  if(!warmed&&POOL<n){warmed=true;byDist(cur).slice(POOL).forEach(i=>fetch(url(i),{priority:'low'}).then(r=>r.blob()).catch(()=>{}));}}
 function startFetch(){if(started||!texSize)return;started=true;if(opt.flow)fetchFlow(opt.flow.front,()=>{flowFront=true;});want();}
 /* keep asking for what the current view needs, nearest first (covers evicted frames and failed
    downloads): until the hero is ready only the front and its two neighbors */
 function want(){if(!started||asleep)return;fetchFixed();const R=ready?40:12;let live=0;for(let i=0;i<n;i++)if(tex[i]||busy[i]||dec[i])live++;
  for(const i of nearFirst()){if(adist(i,cur)<=R||(allFetched&&(tex[i]||live<POOL))){if(!tex[i]&&!busy[i]&&!dec[i])live++;fetchImg(i);}}}
 function sleep(){if(asleep||lost||!started)return;asleep=true;texGen++;ready=false;box.classList.remove('ready');
  for(let i=0;i<N;i++){if(tex[i])gl.deleteTexture(tex[i]);tex[i]=null;gen[i]=0;if(dec[i]&&dec[i].close)dec[i].close();dec[i]=null;}
  if(fx)gl.deleteTexture(fx);fx=null;fxGen=0;allFetched=false;th=target=vel=0;idle=true;drag=null;box.classList.remove('drag');
  canvas.width=canvas.height=1;}
 function wake(){if(!asleep)return;asleep=false;size();dirty=true;want();}
 function upload(needed){
  let best=-1;for(let i=0;i<N;i++)if(dec[i]&&(best<0||adist(i,cur)<adist(best,cur)))best=i;
  if(best<0||(drag&&needed.indexOf(best)<0))return;
  let t=tex[best];
  if(!t){const live=[];for(let i=0;i<n;i++)if(tex[i])live.push(i);
   if(live.length>=POOL){const far=live.reduce((a,b)=>adist(b,cur)>adist(a,cur)?b:a);
    if(adist(far,cur)<=adist(best,cur)){if(dec[best].close)dec[best].close();dec[best]=null;return;}
    t=tex[far];tex[far]=null;gen[far]=0;}
   else t=gl.createTexture();}
  const im=dec[best],bmp=!(im instanceof HTMLImageElement);gl.bindTexture(gl.TEXTURE_2D,t);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!bmp);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,im);
  const w=im.width||im.naturalWidth,h=im.height||im.naturalHeight,pot=!(w&(w-1))&&!(h&(h-1));if(pot)gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,pot?gl.LINEAR_MIPMAP_LINEAR:gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  if(im.close)im.close();dec[best]=null;tex[best]=t;gen[best]=texGen;dirty=true;}
 function pair(th){th=((th%360)+360)%360;for(let k=0;k<n;k++){const a0=A[k],a1=k+1<n?A[k+1]:A[0]+360;let t=th;if(t<a0)t+=360;if(t>=a0&&t<a1)return [k,(k+1)%n,(t-a0)/(a1-a0)];}return [0,1,0];}
 const bind=(u,i)=>{gl.bindBuffer(gl.ARRAY_BUFFER,u);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,i);};
 const layer=(t,fl,k,w)=>{gl.bindTexture(gl.TEXTURE_2D,t);gl.bindBuffer(gl.ARRAY_BUFFER,fl);gl.vertexAttribPointer(1,2,gl.FLOAT,false,0,0);gl.uniform1f(U.k,k);gl.uniform1f(U.w,w);gl.drawElements(gl.TRIANGLES,NI,gl.UNSIGNED_SHORT,0);};
 const still=(t,w)=>{bind(qU,qI);gl.bindTexture(gl.TEXTURE_2D,t);gl.bindBuffer(gl.ARRAY_BUFFER,qZ);gl.vertexAttribPointer(1,2,gl.FLOAT,false,0,0);gl.uniform1f(U.k,0);gl.uniform1f(U.w,w);gl.drawElements(gl.TRIANGLES,6,gl.UNSIGNED_SHORT,0);};
 /* returns true once the frame shows exactly what was asked for */
 function draw(th){
  if(lost||asleep)return false;
  const [k,j,f]=pair(th),ta=tex[k],tb=tex[j];
  /* spun faster than uploads: hold on the nearest frame that is ready */
  let near=-1;if(!ta&&!tb){for(let i=0;i<n;i++)if(tex[i]&&(near<0||adist(i,th)<adist(near,th)))near=i;if(near<0)return false;}
  gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.useProgram(pr);
  gl.uniform1f(U.asp,canvas.width/canvas.height);gl.uniform1i(U.tex,0);gl.activeTexture(gl.TEXTURE0);
  gl.enableVertexAttribArray(0);gl.enableVertexAttribArray(1);gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE);
  let exact=false;const s=f*f*(3-2*f);
  if(near>=0)still(tex[near],1);
  else if(ta&&tb&&s>0&&s<1){bind(bU,bI);
   const F=flows[k];layer(ta,F?F[0]:zero,f,1-s);layer(tb,F?F[1]:zero,1-f,s);exact=true;}
  else if(ta&&tb){still(s>=1?tb:ta,1);exact=true;}
  else still(ta||tb,1);
  if(fx){gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);bind(fxU,fxI);gl.bindTexture(gl.TEXTURE_2D,fx);gl.bindBuffer(gl.ARRAY_BUFFER,fxZ);gl.vertexAttribPointer(1,2,gl.FLOAT,false,0,0);
   gl.uniform1f(U.k,0);gl.uniform1f(U.w,1);gl.drawElements(gl.TRIANGLES,fxN,gl.UNSIGNED_SHORT,0);}
  return exact&&(!opt.fixed||!!fx);
 }
 /* interaction */
 let th=0,target=0,vel=0,drag=null,idle=true,idleT=0,raf=0,inView=false,vis=false,last=0,ready=false,t0=0;
 function size(){if(asleep)return;const dpr=Math.min(window.devicePixelRatio||1,2),r=box.getBoundingClientRect();canvas.width=Math.max(1,Math.round(r.width*dpr));canvas.height=Math.max(1,Math.round(r.height*dpr));dirty=true;
  if(r.width<=0)return;const want_=Math.max(256,Math.min(960,canvas.width));
  if(!texSize)texSize=want_;
  else if(want_>texSize*1.25){texSize=want_;texGen++;for(let i=0;i<N;i++){if(dec[i]&&dec[i].close)dec[i].close();dec[i]=null;}}}   /* grew a lot (rotation, wider window): re-decode, nearest first */
 function frame(ts){const dt=Math.min(.05,(ts-(last||ts))/1000);last=ts;cur=th;const pr_=pair(th);want();upload([pr_[0],pr_[1]]);
  for(let x=pend.length-1,m=ready?4:99;x>=0&&m>0;x--){const k=pend[x][0];if(!ready||k!==pr_[0]||pr_[2]<1e-3){flows[k]=pend[x][1]();pend.splice(x,1);dirty=true;m--;}}
  if(ready&&!allFetched&&A.every((a,i)=>tex[i]||adist(i,0)>40))fetchRest();
  if(ready&&!drag){if(Math.abs(vel)>.02){target+=vel*dt*60;vel*=Math.pow(.94,dt*60);}else if(idle&&!opt.reduced()){target=Math.sin((ts-t0)/1000*.22)*34;}}
  /* follow the pointer closely; drift back into the idle sway gently */
  const prev=th;let step=(target-th)*Math.min(1,dt*(idle?1.6:7));if(idle)step=Math.max(-50*dt,Math.min(50*dt,step));th+=step;if(Math.abs(th-prev)>.001)dirty=true;
  if(dirty){const ok=draw(th);dirty=!ok;if(ok&&!ready&&tex[0]&&tex[1%n]&&tex[n-1]&&flowFront){ready=true;t0=ts;box.classList.add('ready');}}
  raf=vis&&!lost?requestAnimationFrame(frame):0;}
 const run=()=>{vis=inView&&!document.hidden;if(vis)wake();if(vis&&!raf&&!lost){last=0;raf=requestAnimationFrame(frame);}};
 box.addEventListener('pointerdown',e=>{clearTimeout(idleT);wake();fetchRest();drag={x:e.clientX,t:target,px:e.clientX,pt:performance.now()};idle=false;vel=0;box.setPointerCapture(e.pointerId);box.classList.add('drag','used');});
 box.addEventListener('pointermove',e=>{if(!drag)return;const w=box.clientWidth||400;target=drag.t-(e.clientX-drag.x)/w*200;const now=performance.now();vel=-(e.clientX-drag.px)/w*200/Math.max(1,(now-drag.pt)/16.7);drag.px=e.clientX;drag.pt=now;});
 /* after a pause, resume the sway from wherever the house was left, the short way round */
 function rest(){clearTimeout(idleT);idleT=setTimeout(()=>{if(drag)return;const w=360*Math.round(th/360);th-=w;target=th;vel=0;idle=true;t0=performance.now()-Math.asin(Math.max(-1,Math.min(1,th/34)))/.22*1000;},4500);}
 const up=()=>{if(!drag)return;drag=null;box.classList.remove('drag');rest();};
 box.addEventListener('pointerup',up);box.addEventListener('pointercancel',up);
 box.addEventListener('keydown',e=>{const k={ArrowLeft:-20,ArrowRight:20}[e.key];if(k===undefined)return;wake();fetchRest();e.preventDefault();idle=false;box.classList.add('used');target+=k;rest();});
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;box.classList.remove('ready');if(opt.lost)opt.lost();});
 new ResizeObserver(size).observe(box);size();
 new IntersectionObserver(es=>{inView=es[0].isIntersecting;run();}).observe(box);
 new IntersectionObserver(es=>{clearTimeout(sleepT);if(es[0].isIntersecting){wake();size();startFetch();}else sleepT=setTimeout(sleep,1000);},{rootMargin:'400px 0px'}).observe(box);
 document.addEventListener('visibilitychange',run);
 return {set(a){target=th=a;idle=false;dirty=true;draw(a);},draw,ready:()=>ready,angle:()=>th,
  sleep(){clearTimeout(sleepT);sleep();},asleep:()=>asleep,flows:()=>flows.filter(Boolean).length};
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
