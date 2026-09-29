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

/* ================= Walk: knock, the door opens, and one continuous camera walks you inside =================
   The camera follows the door (outside) and then the fireplace (inside). Each rendered image
   takes over as soon as it has enough resolution for the current distance, so the motion never
   jumps. Drawn with WebGL as depth reliefs, so the camera really moves through each shot. */
const Walk=(()=>{
const W1448=[1448,1086];
const SHOTS={
 approach:[
  {f:'images/approach-2.jpg',wh:W1448,a:[640,302,809,693]},
  {f:'images/approach-3.jpg',wh:W1448,a:[628,255,817,719]},
  {f:'images/approach-4.jpg',wh:W1448,a:[562,167,875,839],glass:[430,152,1010,760]},
  {f:'images/door.jpg',wh:[1350,1165],a:[503,97,899,969],glass:[330,120,1080,900]}],
 open:{f:'images/door-open.jpg',wh:W1448,door:[505,92,915,925],fire:[711,499,826,598]},
 inside:[
  {f:'images/door-open.jpg',wh:W1448,a:[711,499,826,598]},
  {f:'images/inside-1.jpg',wh:W1448,a:[721,369,849,479]},
  {f:'images/inside-2.jpg',wh:W1448,a:[696,431,852,565]},
  {f:'images/inside-3.jpg',wh:W1448,a:[729,457,919,620]},
  {f:'images/inside-4.jpg',wh:W1448,a:[660,461,853,627]}]};
const files=()=>{const s=new Set();SHOTS.approach.forEach(x=>s.add(x.f));SHOTS.inside.forEach(x=>s.add(x.f));s.add(SHOTS.open.f);return [...s];};
const cache={},imgs={};
/* ---- the knock and the door as a video clip (made with AI video, tools/knock_video.py) ----
   It starts and ends on frames of this walk (tools/knock_keyframes.py): at t0 the camera holds still at
   the door and the clip plays; at its end the walk carries on from the open door (T.xf1). The model
   frames the clip 2.07% tighter than the keyframes it was given (zoom about a point near the center,
   off = that zoom's offset in 1920x1080 pixels), so the walk leans in by the same amount before it.
   Times in the clip, in seconds: the raps, the light, the bolt, the latch, the swing (sounds and captions). */
const KNOCK={src:[], // [[min width in device pixels, file], ...]: empty until the clip is chosen (then the walk does its own knock)
 dur:6.04,t0:6.75,zoom:1.0207,off:[19.4,11.1],
 knock:[1.0,1.35,1.7],cues:[[1.0,'knock',0],[1.35,'knock',1],[1.7,'knock',2],[2.3,'light'],[2.55,'step',0],[2.8,'step',1],[3.05,'step',2],[3.25,'bolt'],[3.5,'latch'],[3.6,'swing'],[5.0,'inside']],swing:[3.6,4.6]};
let kv=null;
const kvOk=v=>!!v&&!v.error&&v.readyState>=3&&v.buffered.length>0&&v.buffered.end(v.buffered.length-1)>=(v.duration||KNOCK.dur)-.1;
function knockVideo(){ // fetched while the visitor fills in the pre-qualification; muted and inline, so it may play without a tap
 if(kv||typeof document==='undefined'||!KNOCK.src.length)return kv;const w=(innerWidth||1280)*Math.min(2,devicePixelRatio||1),v=document.createElement('video');
 v.muted=true;v.defaultMuted=true;v.playsInline=true;v.setAttribute('playsinline','');v.setAttribute('muted','');v.preload='auto';
 v.src=KNOCK.src.find(x=>w>=x[0])[1];v.load();return kv=v;}
function preload(){knockVideo();return Promise.all([depthLoad(),...files().map(f=>cache[f]||(cache[f]=new Promise(res=>{const i=new Image();i.decoding='async';i.onload=()=>{(i.decode?i.decode():Promise.resolve()).catch(()=>{}).then(()=>{imgs[f]=i;res(i);});};i.onerror=()=>{delete cache[f];res(null);};i.src=f;})))]).then(r=>r.slice(1));}
const cl=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),seg=(t,a,b)=>cl((t-a)/(b-a)),ss=x=>x*x*(3-2*x),eio=x=>x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2,lerp=(a,b,t)=>a+(b-a)*t;
const cx=r=>(r[0]+r[2])/2,cy=r=>(r[1]+r[3])/2,rw=r=>r[2]-r[0];
/* Someone switches the hall light on: a warm wash over the door glass. The mask keeps only the
   bright orange pixels (the lit glass), at half size. onLeaf picks the glass in the door leaf
   (it swings with the door) or the sidelights around it. */
function glowCanvas(s,onLeaf){const img=imgs[s.f];if(!img)return null;
 try{const k=.5,W=Math.round(s.wh[0]*k),H=Math.round(s.wh[1]*k),c=document.createElement('canvas');c.width=W;c.height=H;
  const g=c.getContext('2d');g.drawImage(img,0,0,W,H);const d=g.getImageData(0,0,W,H),p=d.data,r=s.a.map(v=>v*k),q=s.glass.map(v=>v*k);
  for(let y=0,i=0;y<H;y++)for(let x=0;x<W;x++,i+=4){const leaf=x>=r[0]&&x<r[2]&&y>=r[1]&&y<r[3],box=x>=q[0]&&x<q[2]&&y>=q[1]&&y<q[3];
   let m=0;if(box&&leaf===onLeaf){const R=p[i]/255,G=p[i+1]/255,B=p[i+2]/255;m=cl((R-B-.16)/.22)*cl(((R+G+B)/3-.33)/.3);}
   p[i]=255;p[i+1]=205;p[i+2]=140;p[i+3]=m*255;}
  g.putImageData(d,0,0);return c;}catch(e){return null;}}

/* ---- depth (made by tools/walk_depth.py) ----
   Each render has a depth map (Depth Anything V2), normalized so the shot's anchor (the door or the
   fireplace) is at depth 1, stored as 1/depth on a mesh grid. Walking forward is a real dolly
   through that relief and head motion is real parallax, so near things sweep past the far ones. */
const DEPTH={file:'images/walk-depth.bin',shots:{"approach-2":[0,161,121],"approach-3":[19481,161,121],"approach-4":[38962,161,121],"door":[58443,151,130],"door-open":[78073,161,121],"inside-1":[97554,161,121],"inside-2":[117035,161,121],"inside-3":[136516,161,121],"inside-4":[155997,161,121]}};
let depthBuf=null;
let depthData;const depthLoad=()=>depthBuf||(depthBuf=fetch(DEPTH.file).then(r=>r.ok?r.arrayBuffer():null).catch(()=>null).then(ab=>{if(!ab)depthBuf=null;return depthData=ab;})); // a failure is retried next time

/* ---- WebGL: every shot is a textured mesh on one canvas; the door leaf is a true perspective quad ---- */
/* A shot is photo-exact while uDolly is 0. uDolly moves the camera toward the anchor (depth 1):
   a point at depth Z then grows by g=Z(1-d)/(Z-d) around uE (where the anchor is on screen), so
   far things barely grow and near things rush out and pass. uHead is a sideways head offset in
   screen pixels: things at the anchor stay put, far things follow the head, near things move against it.
   uGmin keeps the far edges of the photo covering the screen. */
const VS_MESH=`attribute vec2 aUV;attribute float aInv;uniform vec2 uView,uSize,uE,uHead;uniform vec3 uPlace;uniform float uDolly,uGmin;varying highp vec2 vUV;varying float vNear;varying vec2 vQ;
void main(){vec2 p=uPlace.xy+uPlace.z*aUV*uSize;float Z=1./aInv,Zp=max((Z-uDolly)/(1.-uDolly),.03),g=clamp(Z/Zp,uGmin,4.);
 vec2 q=uE+(p-uE)*g+uHead*clamp(1.-1./Zp,-3.,1.);vec2 n=q/uView*2.-1.;gl_Position=vec4(n.x,-n.y,Zp/(Zp+1.)*2.-1.,1.);vUV=aUV;vQ=q;vNear=smoothstep(.1,.32,Zp);}`;
/* uWipe (m, feather, on): an incoming shot is revealed from its anchor outward, where it lines up
   best, instead of fading everywhere at once. */
/* The finishing look, applied inside every shader instead of as extra full-screen passes: a warm
   spill of light (screen), vignette + caption scrim, and the fade in from black (multiply). Both are
   affine in the color, so layers blended with alpha still come out exactly right. */
const POST=`uniform vec2 uRes,uPost;uniform float uRaw;
vec3 post(vec3 c){if(uRaw>.5)return c;vec2 s=gl_FragCoord.xy/uRes;s.y=1.-s.y;float r=length((s-.5)*2.)/1.4142;
 vec3 w=vec3(1.,.745,.431)*(.18*(1.-clamp(r/.6,0.,1.))*uPost.y);c=c+w-c*w;
 return c*(1.-.45*clamp((r-.58)/.42,0.,1.))*(1.-.42*clamp((s.y-.55)/.45,0.,1.))*uPost.x;}
float vig(){if(uRaw>.5)return 1.;vec2 s=gl_FragCoord.xy/uRes;s.y=1.-s.y;float r=length((s-.5)*2.)/1.4142;return (1.-.45*clamp((r-.58)/.42,0.,1.))*uPost.x;}`;
const FS_MESH=`#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D uTex;uniform float uA,uWR;uniform vec3 uWipe,uGain,uOff;uniform vec2 uWE;varying vec2 vUV;varying float vNear;varying vec2 vQ;
${POST}
void main(){if(vNear<.01)discard;float a=uWipe.z>.5?clamp((uWipe.x*(1.+uWipe.y)-length(vQ-uWE)/uWR)/uWipe.y,0.,1.):uA;gl_FragColor=vec4(post(texture2D(uTex,vUV).rgb*uGain+uOff),a*vNear);}`;
const VS_QUAD=`attribute vec4 aPos;attribute vec2 aUV;attribute vec2 aL;varying highp vec2 vUV;varying vec2 vL;
void main(){gl_Position=aPos;vUV=aUV;vL=aL;}`;
const FS_QUAD=`#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D uTex,uGlow;uniform int uMode;uniform float uA,uGlowA,uShade,uBright;uniform vec3 uGain,uOff;varying vec2 vUV;varying vec2 vL;
${POST}
void main(){
 if(uMode==0){vec4 c=texture2D(uTex,vUV);gl_FragColor=vec4(post((c.rgb*uGain+uOff)*uBright),c.a*uA);}
 else if(uMode==1){vec3 c=texture2D(uTex,vUV).rgb*uGain+uOff;vec4 g=texture2D(uGlow,vUV);c=mix(c,g.rgb,g.a*uGlowA);c*=1.-uShade*mix(.25,.75,vL.x);gl_FragColor=vec4(post(c),uA);}
 else if(uMode==2){gl_FragColor=vec4(post(mix(vec3(.047,.11,.07),vec3(.082,.16,.11),vL.x)),uA);}
 else if(uMode==3){float x=vL.x,k=x<.7?x/.7:(x-.7)/.3;float a=x<.7?.95*k:mix(.95,.4,k);vec3 c=x<.7?mix(vec3(1.,.84,.59),vec3(1.,.886,.706),k):mix(vec3(1.,.886,.706),vec3(1.,.84,.59),k);gl_FragColor=vec4(post(c),a*uA);}
 else{vec2 d=(vL-vec2(.5,0.))/vec2(.707,1.414);float a=.55*(1.-clamp(length(d)/.68,0.,1.))*uA*vig();gl_FragColor=vec4(vec3(1.,.77,.47)*a,1.);}

}`;
const ID=[[1,1,1],[0,0,0]];
function glView(canvas){
 // WebGL2 where there is one (all current browsers): it can mipmap the photos, which are not powers of two
 const o={alpha:false,antialias:false,depth:true,premultipliedAlpha:false,powerPreference:'high-performance'},gl=canvas.getContext('webgl2',o)||canvas.getContext('webgl',o);if(!gl)return null;
 const gl2=typeof WebGL2RenderingContext!=='undefined'&&gl instanceof WebGL2RenderingContext;
 const prog=(vs,fs)=>{const p=gl.createProgram();[[gl.VERTEX_SHADER,vs],[gl.FRAGMENT_SHADER,fs]].forEach(([k,src])=>{const sh=gl.createShader(k);gl.shaderSource(sh,src);gl.compileShader(sh);gl.attachShader(p,sh);});gl.linkProgram(p);
  if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));const u={},a={};
  for(let i=gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS);i--;){const n=gl.getActiveUniform(p,i).name;u[n]=gl.getUniformLocation(p,n);}
  for(let i=gl.getProgramParameter(p,gl.ACTIVE_ATTRIBUTES);i--;){const n=gl.getActiveAttrib(p,i).name;a[n]=gl.getAttribLocation(p,n);}return {p,u,a};};
 const M=prog(VS_MESH,FS_MESH),Q=prog(VS_QUAD,FS_QUAD);
 const buf=(data,type=gl.ARRAY_BUFFER,usage=gl.STATIC_DRAW)=>{const b=gl.createBuffer();gl.bindBuffer(type,b);gl.bufferData(type,data,usage);return b;};
 // one mesh per shot: a grid over the image with 1/depth per vertex (flat if the depth file is missing)
 const grids={},qB=gl.createBuffer(),qData=new Float32Array(4*8);
 function grid(gx,gy){const k=gx+'x'+gy;if(grids[k])return grids[k];const uv=new Float32Array(gx*gy*2),idx=new Uint16Array((gx-1)*(gy-1)*6);
  for(let y=0,i=0;y<gy;y++)for(let x=0;x<gx;x++){uv[i++]=x/(gx-1);uv[i++]=y/(gy-1);}
  for(let y=0,i=0;y<gy-1;y++)for(let x=0;x<gx-1;x++){const a=y*gx+x;idx.set([a,a+1,a+gx,a+1,a+gx+1,a+gx],i);i+=6;}
  // a coarse index set over the same vertices (every other row and column) for slow renderers
  const sel=g=>{const a=[];for(let i=0;i<g;i+=2)a.push(i);if(a[a.length-1]!==g-1)a.push(g-1);return a;},X=sel(gx),Y=sel(gy),c=[];
  for(let y=0;y<Y.length-1;y++)for(let x=0;x<X.length-1;x++){const a=Y[y]*gx+X[x],b=Y[y]*gx+X[x+1],d=Y[y+1]*gx+X[x],e=Y[y+1]*gx+X[x+1];c.push(a,b,d,b,e,d);}
  return grids[k]={uv:buf(uv),idx:buf(idx,gl.ELEMENT_ARRAY_BUFFER),n:idx.length,idx2:buf(new Uint16Array(c),gl.ELEMENT_ARRAY_BUFFER),n2:c.length};}
 const params=(mip)=>[[gl.TEXTURE_MIN_FILTER,mip?gl.LINEAR_MIPMAP_LINEAR:gl.LINEAR],[gl.TEXTURE_MAG_FILTER,gl.LINEAR],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]].forEach(([k,v])=>gl.texParameteri(gl.TEXTURE_2D,k,v));
 const tex=(src,mip)=>{mip=mip&&gl2;const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,src);if(mip)gl.generateMipmap(gl.TEXTURE_2D);params(mip);return t;};
 // for streaming: an empty texture, then horizontal bands, then (optionally) its mipmaps
 const alloc=(w,h)=>{const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);params(false);return t;};
 const band=(t,y,src)=>{gl.bindTexture(gl.TEXTURE_2D,t);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);gl.texSubImage2D(gl.TEXTURE_2D,0,0,y,gl.RGBA,gl.UNSIGNED_BYTE,src);};
 const finish=(t,mip)=>{if(mip&&gl2){gl.bindTexture(gl.TEXTURE_2D,t);gl.generateMipmap(gl.TEXTURE_2D);params(true);}};
 let W=1,H=1;
 const api={gl,post:[1,0],raw:0,coarse:false,
  tex,alloc,band,finish,gl2,drop:t=>gl.deleteTexture(t),
  read(t,pts){const fb=gl.createFramebuffer(),px=new Uint8Array(4),out=[];gl.bindFramebuffer(gl.FRAMEBUFFER,fb);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t,0);
   pts.forEach(([x,y])=>{gl.readPixels(x,y,1,1,gl.RGBA,gl.UNSIGNED_BYTE,px);out.push([...px].slice(0,3));});gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.deleteFramebuffer(fb);return out;}, // for tests
  video(t,v){if(!t){t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);params(false);}gl.bindTexture(gl.TEXTURE_2D,t);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
   gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,v);return t;},
  shape(inv,gx,gy){const g=grid(gx,gy);return {g,inv:buf(inv)};},
  resize(w,h,dpr){W=w;H=h;canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);gl.viewport(0,0,canvas.width,canvas.height);},
  clear(){gl.clearColor(.027,.039,.031,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);},
  mesh(t,size,sh,pl,alpha,e,dolly,gmin,head,wipe,cg){gl.useProgram(M.p);gl.bindBuffer(gl.ARRAY_BUFFER,sh.g.uv);gl.enableVertexAttribArray(M.a.aUV);gl.vertexAttribPointer(M.a.aUV,2,gl.FLOAT,false,0,0);
   gl.bindBuffer(gl.ARRAY_BUFFER,sh.inv);gl.enableVertexAttribArray(M.a.aInv);gl.vertexAttribPointer(M.a.aInv,1,gl.FLOAT,false,0,0);
   gl.uniform2f(M.u.uView,W,H);gl.uniform2f(M.u.uSize,size[0],size[1]);gl.uniform3f(M.u.uPlace,pl.ox,pl.oy,pl.sc);gl.uniform2f(M.u.uE,e[0],e[1]);gl.uniform2f(M.u.uHead,head[0],head[1]);
   gl.uniform2f(M.u.uRes,canvas.width,canvas.height);gl.uniform2f(M.u.uPost,api.post[0],api.post[1]);gl.uniform1f(M.u.uRaw,api.raw);gl.uniform1f(M.u.uDolly,dolly);gl.uniform1f(M.u.uGmin,gmin);gl.uniform1f(M.u.uA,alpha);gl.uniform3f(M.u.uWipe,alpha,.5,wipe?1:0);gl.uniform2f(M.u.uWE,e[0],e[1]);gl.uniform3fv(M.u.uGain,(cg||ID)[0]);gl.uniform3fv(M.u.uOff,(cg||ID)[1]);
   gl.uniform1f(M.u.uWR,Math.max(Math.hypot(e[0],e[1]),Math.hypot(W-e[0],e[1]),Math.hypot(e[0],H-e[1]),Math.hypot(W-e[0],H-e[1]),1));
   gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,t);gl.uniform1i(M.u.uTex,0);
   gl.clear(gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LESS); // the relief hides itself correctly; each shot blends over the last
   const co=api.coarse;gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,co?sh.g.idx2:sh.g.idx);gl.drawElements(gl.TRIANGLES,co?sh.g.n2:sh.g.n,gl.UNSIGNED_SHORT,0);gl.disable(gl.DEPTH_TEST);
   gl.disableVertexAttribArray(M.a.aUV);gl.disableVertexAttribArray(M.a.aInv);},
  /* corners: 4 x [screen x, screen y, w (perspective), u, v, lx, ly] in strip order TL, TR, BL, BR */
  quad(corners,mode,o){gl.useProgram(Q.p);corners.forEach((c,i)=>{const w=c[2]||1,nx=c[0]/W*2-1,ny=1-c[1]/H*2;qData.set([nx*w,ny*w,0,w,c[3],c[4],c[5],c[6]],i*8);});
   gl.bindBuffer(gl.ARRAY_BUFFER,qB);gl.bufferData(gl.ARRAY_BUFFER,qData,gl.STREAM_DRAW);
   gl.enableVertexAttribArray(Q.a.aPos);gl.vertexAttribPointer(Q.a.aPos,4,gl.FLOAT,false,32,0);gl.enableVertexAttribArray(Q.a.aUV);gl.vertexAttribPointer(Q.a.aUV,2,gl.FLOAT,false,32,16);gl.enableVertexAttribArray(Q.a.aL);gl.vertexAttribPointer(Q.a.aL,2,gl.FLOAT,false,32,24);
   gl.uniform2f(Q.u.uRes,canvas.width,canvas.height);gl.uniform2f(Q.u.uPost,api.post[0],api.post[1]);gl.uniform1f(Q.u.uRaw,api.raw);gl.uniform1i(Q.u.uMode,mode);gl.uniform1f(Q.u.uA,o.a);gl.uniform1f(Q.u.uGlowA,o.glowA||0);gl.uniform1f(Q.u.uShade,o.shade||0);gl.uniform1f(Q.u.uBright,o.bright||1);const cg=o.cg||ID;gl.uniform3fv(Q.u.uGain,cg[0]);gl.uniform3fv(Q.u.uOff,cg[1]);
   gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,o.tex||null);gl.uniform1i(Q.u.uTex,0);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,o.glow||o.tex||null);gl.uniform1i(Q.u.uGlow,1);
   if(mode===4)gl.blendFunc(gl.ONE_MINUS_DST_COLOR,gl.ONE); // screen
   gl.drawArrays(gl.TRIANGLE_STRIP,0,4);[Q.a.aPos,Q.a.aUV,Q.a.aL].forEach(l=>gl.disableVertexAttribArray(l));if(mode===4)gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.activeTexture(gl.TEXTURE0);}};
 return api;
}

function play(root,opts){
 const canvas=document.createElement('canvas');canvas.className='wk-canvas';root.appendChild(canvas);
 let V;try{V=glView(canvas);}catch(e){V=null;}
 if(!V){canvas.remove();return null;}
 const name=f=>f.split('/').pop().replace('.jpg','');
 /* Textures (graphics memory). Mipmaps only on a software renderer, which draws at a reduced scale
    and minifies; at full scale on a GPU the photos are never shown small enough to need them.
    The shots on the way to the door are uploaded now; the rooms stream in during the knock, one
    band per frame (decoded off the main thread); shots behind you are freed. Any texture needed
    before it has fully arrived is uploaded on the spot, so drawing never depends on timing. */
 const SOFT=(()=>{const i=V.gl.getExtension('WEBGL_debug_renderer_info'),r=i?String(V.gl.getParameter(i.UNMASKED_RENDERER_WEBGL)):'';return /swiftshader|llvmpipe|softpipe|software|basic render/i.test(r);})();
 const TX={},mem={now:0,peak:0},MIP=SOFT;
 const account=d=>{mem.now+=d;mem.peak=Math.max(mem.peak,mem.now);};
 const size=(w,h,mip)=>w*h*4*(mip&&V.gl2?4/3:1);
 const SRC={};
 function upload(f,src){src=src||SRC[f]||imgs[f];drop(f);const t=V.tex(src,MIP),b=size(src.naturalWidth||src.width,src.naturalHeight||src.height,MIP);TX[f]={t,b,ready:true};account(b);return t;}
 function tx(f){const e=TX[f];return e&&e.ready?e.t:upload(f);}
 function drop(f){const e=TX[f];if(!e)return;V.drop(e.t);account(-e.b);delete TX[f];}
 const mk=s=>({s,key:name(s.f),st:{ox:0,oy:0,sc:1,a:0},sc0:0,shape:null,extra:0});
 /* On a tall screen the door close-up can only be shown so large (it must cover the height) that
    the door fills the width, so there the approach ends on the porch shot and the door opens on it. */
 const tall=(root.clientHeight||innerHeight)>(root.clientWidth||innerWidth)*1.1,appShots=tall?SHOTS.approach.slice(0,-1):SHOTS.approach;
 const app=appShots.map(mk),ins=SHOTS.inside.map(mk),layers=[...app,...ins],appDoor=app[app.length-1];
 const door=appShots[appShots.length-1],opn=SHOTS.open,gSide=glowCanvas(door,false),gLeaf=glowCanvas(door,true);
 if(gSide)upload('glow-side',SRC['glow-side']=gSide);if(gLeaf)upload('glow-leaf',SRC['glow-leaf']=gLeaf);
 [...app.map(L=>L.s.f),opn.f].forEach(f=>tx(f)); // the way to the door, and the view through it
 const STREAM=SHOTS.inside.slice(1).map(s=>s.f),BANDS=4,bands={};
 // decode the bands from the file's bytes (HTTP cache): createImageBitmap on a Blob decodes off
 // the main thread, whereas cropping an <img> copies its pixels on the main thread
 let decoding=false;const decode=()=>{if(decoding||!window.createImageBitmap)return;decoding=true;STREAM.forEach(f=>{const im=imgs[f],w=im.naturalWidth,H=im.naturalHeight,h=Math.ceil(H/BANDS);bands[f]=[];
  fetch(f).then(r=>r.blob()).then(bl=>{for(let i=0;i<BANDS;i++)createImageBitmap(bl,0,i*h,w,Math.min(h,H-i*h)).then(b=>{if(stopped)b.close&&b.close();else bands[f][i]=b;}).catch(()=>{});}).catch(()=>{});});};
 function stream(){for(const f of STREAM){const e=TX[f];if(e&&e.ready)continue;const B=bands[f];if(!B)return;const im=imgs[f],h=Math.ceil(im.naturalHeight/BANDS);
   if(!e){const b=size(im.naturalWidth,im.naturalHeight,MIP);TX[f]={t:V.alloc(im.naturalWidth,im.naturalHeight),b,ready:false,next:0};account(b);return;}
   const bm=B[e.next];if(!bm)return;V.band(e.t,e.next*h,bm);bm.close&&bm.close();B[e.next]=null;
   if(++e.next===BANDS){V.finish(e.t,MIP);e.ready=true;}return;}} // at most one step per frame
 // the relief of each shot
 const flatInv=new Float32Array(4).fill(1);
 const attach=ab=>{const all=ab&&new Uint8Array(ab);layers.forEach(L=>{if(L.shape)return;const d=DEPTH.shots[L.key];
  if(all&&d&&d[0]+d[1]*d[2]<=all.length){const inv=new Float32Array(d[1]*d[2]);for(let i=0;i<inv.length;i++)inv[i]=Math.max(all[d[0]+i],4)/40;L.shape=V.shape(inv,d[1],d[2]);}
  else L.shape=V.shape(flatInv,2,2);});};
 if(depthData!==undefined)attach(depthData);else depthLoad().then(ab=>{if(!stopped)attach(ab);}); // loaded by preload: attach now, so the first frame is complete
 /* ---- camera math ---- */
 let vw=1,vh=1;const cover=s=>Math.max(vw/s.wh[0],vh/s.wh[1]);
 function place(L,sc,ax,ay,anchor,alpha){ // anchor rect center lands at (ax,ay), scale sc; clamped so the image always covers the screen
  const s=L.s;let ox=ax-sc*cx(anchor),oy=ay-sc*cy(anchor);ox=cl(ox,vw-sc*s.wh[0],0);oy=cl(oy,vh-sc*s.wh[1],0);
  L.st.ox=ox;L.st.oy=oy;L.st.sc=sc;L.st.a=alpha;return {ox,oy,sc};}
 function natural(s,anchor,z){const c=cover(s)*(z||1);return {w:rw(anchor)*c,x:vw/2+(cx(anchor)-s.wh[0]/2)*c,y:vh/2+(cy(anchor)-s.wh[1]/2)*c};}
 /* run a chain of images that share one anchor object; camera = anchor width W and center (x,y) */
 function chain(list,W,x,y,fadeLn,k=1.005,gate,t){let top=-1;const lnW=Math.log(W);
  const al=list.map((L,i)=>{if(i===0)return 1;const need=Math.log(rw(L.s.a)*cover(L.s)*k);const a=ss(seg(lnW,need,need+fadeLn));return gate?gate(i,a,lnW-need):a;});
  for(let i=list.length-1;i>=0;i--)if(al[i]>=1){top=i;break;}if(top<0)top=0;
  /* Steer: on narrow screens the next shot may not be able to put its anchor where the camera
     wants it without showing its edge. Ease the camera to where it can, before it appears, so
     both shots agree during the handoff. */
  const A=list[top],B=list[top+1],st=list.steer||(list.steer={x:0,y:0,t:resume?t-2:t});let tx=0,ty=0;st.gap=0;
  if(B){ // where each shot can put its anchor at this zoom; aim for where both can
   const rng=(L,v,i)=>{const sc=W/rw(L.s.a),c=i?cy(L.s.a):cx(L.s.a);return [v-sc*(L.s.wh[i]-c),sc*c];};
   const fit=(v,i,size)=>{const a=rng(A,size,i),b=rng(B,size,i),lo=Math.max(a[0],b[0]),hi=Math.min(a[1],b[1]);st.gap=Math.max(st.gap,lo-hi);
    return lo<=hi?cl(v,lo,hi):(lo+hi)/2;};
   tx=fit(x,0,vw)-x;ty=fit(y,1,vh)-y;}
  const dt=t-st.t;st.t=t;if(dt<0||dt>1){st.x=tx;st.y=ty;st.vx=st.vy=0;}else{const w=9,h=Math.min(dt,.05); // a critically damped spring: starts from rest, no jerk
   st.vx=(st.vx||0)+(w*w*(tx-st.x)-2*w*(st.vx||0))*h;st.vy=(st.vy||0)+(w*w*(ty-st.y)-2*w*(st.vy||0))*h;st.x+=st.vx*h;st.y+=st.vy*h;}st.err=Math.hypot(tx-st.x,ty-st.y);if(B&&al[top+1]>0){st.x=tx;st.y=ty;st.vx=st.vy=0;} // once it shows, hold it exactly
  x+=st.x;y+=st.y;
  list.forEach((L,i)=>{if(i<top||al[i]<=0){L.st.a=0;return;}place(L,W/rw(L.s.a),x,y,L.s.a,al[i]);if(i>top&&al[i]<1){through(list[i-1],L,al[i]);L.wipe=true;}});}
 /* During a handoff the outgoing shot keeps walking forward (the anchor holds its size, near things
    sweep past) to the dolly where its relief best matches the incoming shot, and the incoming one
    starts the same distance behind. Targets: the fraction of SIFT matches between the pair that land
    within 12px after the dolly, maximized (keyed by the incoming shot). */
 const THRU={'approach-3':.4,'approach-4':.45,door:.21,'inside-1':.3,'inside-2':.12,'inside-3':.3,'inside-4':.26};
 function through(A,B,m){const base=A.sc0?DOLLY*(1-A.sc0/A.st.sc):0,d=Math.max(0,(THRU[B.key]??.25)-base),k=ss(m);A.extra=d*k;B.extra=-d*(1-k);}
 function hide(list){list.forEach(L=>{L.st.a=0;});}
 /* Handoffs: each shot waits until it is sharp enough (zoom alpha a >= .5), the one before it has
    finished, and the camera has lined it up (or the current shot is getting soft, or 1.2s have
    passed); then it fades in over a fixed time. */
 function gate(list,H,fade,t,soft=.22){return (i,a,over)=>{let h=H[i];if(h&&t<h.r-1){H.length=i;h=undefined;} // time went backwards (tests)
  if(!h){if(over<0||(i>1&&!(H[i-1]&&H[i-1].s!==undefined)))return 0;h=H[i]={r:t,s:resume?-1e9:undefined};} // resumed: what is already sharp is already shown
  if(h.s===undefined){const ok=list.steer&&list.steer.err<=5&&list.steer.gap<=2;if(t>=(i>1?H[i-1].s+fade:-1e9)&&(ok||over>soft||t>h.r+1.2))h.s=t;else return 0;}
  return ss(seg(t,h.s,h.s+fade));};}

 /* ---- timeline (seconds) ---- */
 /* arrive, three raps, the hall light comes on, footsteps, the lock turns, the door cracks open,
    a beat, then someone swings it wide */
 const T={app0:1.1,app1:6.4,knock:[7.2,7.41,7.6],light:7.95,steps:[8.25,8.6,8.92],bolt:9.18,crack:9.5,swing:9.85,open1:11.4,xf0:11.45,xf1:12.2,in1:17.4,cap:16.8,done:17.8};
 const cues=[[0,'start'],...T.knock.map((k,i)=>[k,'knock',i]),[T.light,'light'],...T.steps.map((k,i)=>[k,'step',i]),[T.bolt,'bolt'],[T.crack-.03,'latch'],[T.swing,'swing'],[T.xf0,'inside']],fired=new Set();
 const resumeAt=opts.startAt||0;let resume=resumeAt>0; // rebuilt mid-walk (the phone turned)
 cues.forEach((c,i)=>{if(resume&&c[0]-.06<=resumeAt)fired.add('w'+i);});
 const clipCues=[[0,'start'],...KNOCK.cues.map(c=>[KNOCK.t0+c[0],c[1],c[2]])];if(fired.has('w0'))fired.add('c0'); // what already sounded stays done (render fires a cue from c[0]-.06)
 const OPEN=72,CRACK=6,FADE=.85,DOLLY=.55,PUSH=Math.log(1.1); // DOLLY: how much of each zoom-in becomes walking forward (the rest stays a zoom)
 function doorAngle(t){if(t<T.crack)return 0;const c=CRACK*(1-Math.pow(1-seg(t,T.crack,T.crack+.16),3));if(t<T.swing)return c;
  // a hand on the door: speeds up, then eases out with a slight settle (an underdamped spring from rest)
  const u=t-T.swing,w=4.2,z=.8,wd=w*Math.sqrt(1-z*z);return OPEN-(OPEN-CRACK)*Math.exp(-z*w*u)*(Math.cos(wd*u)+z*w/wd*Math.sin(wd*u));}
 /* The knock clip (AI video) starts and ends on frames of this walk: the head settles before it and
    picks up again after, so both ends are still frames. */
 /* The knock clip: decided 2s before it (the video must be fully buffered by then), only on screens at least
    1.16 times as wide as tall (there the walk's framing scales with the width, like the 16:9 keyframes).
    clip: undefined (not decided), null (the walk's own knock), or {state: wait, play, done}. */
 const C0=KNOCK.t0,C1=T.xf1,CD=KNOCK.dur,DEC=C0-2;
 if(kv){kv.className='wk-video';root.insertBefore(kv,canvas);} // in the page, under the canvas: a detached or hidden video may not be decoded
 let clip=(opts.startAt||0)>DEC-.5?null:undefined,clipMode=false,capture=false,abortAt=null,vt=null,vtT=-1,vFrame=false,vStall=0;
 const eligible=()=>!tall&&vw>=vh*1.16&&opts.knock!==false;
 function decide(t){if(clip!==undefined||t<DEC)return;clip=!capture&&eligible()&&kvOk(kv)?{state:'wait'}:null;clipMode=!!clip;
  if(clip&&kv.requestVideoFrameCallback){const f=()=>{vFrame=true;if(clip&&clip.state!=='done'&&!stopped)kv.requestVideoFrameCallback(f);};kv.requestVideoFrameCallback(f);}}
 // walk time (the timeline T) from clock time: the clip stands in for C0..C1 of the walk
 const te=c=>!clipMode?c:c<C0?c:c<C0+CD?C0+(c-C0)*(C1-C0)/CD:c-(C0+CD-C1);
 const inClip=c=>clipMode&&c>=C0&&c<C0+CD;
 // the head settles before the clip and picks up again after it (both ends are still frames)
 const calm=t=>abortAt!=null?ss(seg(t,abortAt,abortAt+1.5)):clipMode||capture?Math.max(1-ss(seg(t,C0-1.2,C0)),ss(seg(t,C1,C1+1.5))):1;
 /* Where the clip goes on this screen: the walk maps the 1920x1080 keyframe onto the screen by the width
    (k, b); the clip is drawn to cover the screen (kz, bz); the walk leans in by Z about P so that, at C0,
    it shows exactly what the clip's first frame shows. */
 let CK={};
 function clipFit(){const k=vw/1920,b=[vw/2-k*960,vh/2-k*540],kz=Math.max(vw/1920,vh/1080),Z=kz*KNOCK.zoom/k,bz=[(vw-kz*1920)/2,(vh-kz*1080)/2];
  CK={kz,bz,Z,P:[0,1].map(i=>(bz[i]-kz*KNOCK.off[i]-Z*b[i])/(1-Z))};}
 const leanIn=t=>clipMode||abortAt!=null?1+(CK.Z-1)*ss(seg(t,C0-1.75,C0)):1;
 function rap(t){let j=0;T.knock.forEach(k=>{if(t>=k){const d=t-k;j+=Math.exp(-d*30)*Math.cos(d*55);}});return j;} // each knock nudges the camera and the door, then settles
 let head=[0,0];const hApp=[],hIns=[],D={th:0,shade:0,spill:0,gap:0,lit:0,warm:0};
 let A0,A1,I1,stopped=false,explore=false,capState='',p=0,pt=0,py=0,pty=0,lastMove=0,drag=null;
 /* Render scale: full resolution on a GPU. A software renderer (no GPU, or a blocklisted one) draws
    at .3 with the coarse mesh; its pixels are what cost there. */
 let rs=SOFT?.3:1;V.coarse=SOFT;
 function layout(){vw=root.clientWidth||innerWidth;vh=root.clientHeight||innerHeight;V.resize(vw,vh,Math.min(2,devicePixelRatio||1)*rs);
  clipFit();A0=natural(SHOTS.approach[0],SHOTS.approach[0].a,1);A1=natural(door,door.a,1);const J=SHOTS.inside[SHOTS.inside.length-1];I1=natural(J,J.a,1.05);}
 layout();addEventListener('resize',layout);

 /* ---- drawing ---- */
 const K=rw(door.a)/396,P=1600*K,rad=Math.PI/180; // rig constants were tuned on the close-up (door 396px wide)
 function drawDoor(L){const st=L.st,a=st.a,r=door.a,w=rw(r),h=r[3]-r[1],S=(x,y)=>[st.ox+st.sc*x,st.oy+st.sc*y];
  const rect=(x0,y0,x1,y1,u0,v0,u1,v1)=>[[...S(x0,y0),1,u0,v0,0,0],[...S(x1,y0),1,u1,v0,1,0],[...S(x0,y1),1,u0,v1,0,1],[...S(x1,y1),1,u1,v1,1,1]];
  const th=D.th*rad,open=D.open;
  const q=door.glass;if(D.lit>0&&gSide)V.quad(rect(q[0],q[1],q[2],q[3],q[0]/door.wh[0],q[1]/door.wh[1],q[2]/door.wh[0],q[3]/door.wh[1]),0,{tex:tx('glow-side'),a:a*D.lit*.55});
  if(open){const o=opn.door,W1=opn.wh[0],H1=opn.wh[1];V.quad(rect(r[0],r[1],r[2],r[3],o[0]/W1,o[1]/H1,o[2]/W1,o[3]/H1),0,{tex:tx(opn.f),a,bright:.92,cg:ins[0].cg});}
  if(D.gap>0)V.quad(rect(r[2]-30*K,r[1],r[2]+10*K,r[3],0,0,1,1),3,{a:a*D.gap});
  if(open||D.lit>0){ // the leaf, hinged on the left, seen with the same 1600px perspective the render was matched to
   const pt=(u,v,z)=>{const X=u*Math.cos(th)+z*Math.sin(th),Z=-u*Math.sin(th)+z*Math.cos(th),f=P/(P-Z);return [...S(r[0]+X*f,r[1]+h/2+(v-h/2)*f),1/f];};
   const Wd=door.wh[0],Hd=door.wh[1],u0=r[0]/Wd,u1=r[2]/Wd,v0=r[1]/Hd,v1=r[3]/Hd;
   V.quad([[...pt(0,0,0),u0,v0,0,0],[...pt(w,0,0),u1,v0,1,0],[...pt(0,h,0),u0,v1,0,1],[...pt(w,h,0),u1,v1,1,1]],1,{tex:tx(L.s.f),glow:gLeaf&&tx('glow-leaf'),glowA:D.lit*.55,shade:D.shade,a,cg:L.cg});
   if(open)V.quad([[...pt(w,0,22*K),0,0,0,0],[...pt(w,0,0),0,0,1,0],[...pt(w,h,22*K),0,0,0,1],[...pt(w,h,0),0,0,1,1]],2,{a});}
  if(D.spill>0)V.quad(rect(r[0]-w*.35,r[3]-6,r[0]+w*1.35,r[3]-6+h*.3,0,0,1,1),4,{a:a*D.spill});}
 /* Exposure, like one camera: each space has one grade (NATIVE, chained from CORR, the
    per-channel gain and offset that fits each shot to the one before it over their shared area).
    Outside is chained from the first approach shot, inside from the last room, and the two are met
    halfway at the threshold, so the whole walk has one grade. A shot enters matched to what is on
    screen and settles into its grade over about 1.5s, which only shows where two renders disagree. */
 const CORR={"approach-3":[1.058,0.945,0.944,-0.059,0.004,-0.003],"approach-4":[0.944,1.012,0.886,-0.038,-0.029,0.029],"door":[1.138,1.023,0.982,0.059,0.035,-0.002],"door-open":[0.984,0.983,0.961,0.008,0.015,-0.001],"inside-1":[1.072,1.222,1.337,-0.053,-0.058,-0.001],"inside-2":[0.953,1.055,1.243,0.019,-0.017,-0.039],"inside-3":[0.986,0.915,0.794,-0.039,-0.019,-0.017],"inside-4":[0.938,0.982,0.993,0.073,0.027,0.018]};
 const NATIVE={"approach-2":[0.973,0.947,0.983,0.014,0.021,0.011],"approach-3":[1.029,0.895,0.928,-0.043,0.025,0.008],"approach-4":[0.972,0.906,0.823,-0.083,-0.001,0.036],"door":[1.106,0.927,0.808,-0.025,0.03,0.034],"door-open":[1.089,0.911,0.776,-0.016,0.044,0.033],"inside-4":[1.028,1.056,1.017,-0.014,-0.022,-0.011],"inside-3":[1.096,1.075,1.024,-0.094,-0.051,-0.03],"inside-2":[1.111,1.175,1.29,-0.051,-0.029,-0.008],"inside-1":[1.167,1.113,1.038,-0.074,-0.009,0.033]};
 const chainKeys=[...SHOTS.approach,...SHOTS.inside].map(s=>name(s.f)),byKey=Object.fromEntries(layers.map(L=>[L.key,L]));
 function exposure(t){let g=[1,1,1],o=[0,0,0];chainKeys.forEach(k=>{const L=byKey[k]||{key:k,t0:null},c=CORR[L.key],n=NATIVE[L.key]||[1,1,1,0,0,0];
   const mg=c?g.map((v,i)=>v*c[i]):n.slice(0,3),mo=c?o.map((v,i)=>g[i]*c[3+i]+v):n.slice(3);
   const w=L.t0==null?1:1-ss(seg(t,L.t0+.5,L.t0+2));g=mg.map((v,i)=>lerp(n[i],v,w));o=mo.map((v,i)=>lerp(n[3+i],v,w));L.cg=[g,o];});}
 /* A shot enters exactly as rendered (sc0 = its scale when it appears); from there, zooming in is
    turned into walking forward through its relief. */
 function drawClip(tw){ // the clip's current frame, over the whole screen, with the same finishing look
  if(kv.readyState>=2&&(vFrame||kv.currentTime!==vtT||!vt)){vt=V.video(vt,kv);vtT=kv.currentTime;vFrame=false;}
  V.post=[1,.35*ss(seg(tw,C0+KNOCK.swing[0],C0+KNOCK.swing[1]))];V.clear();if(!vt)return;
  const {kz,bz}=CK,X0=bz[0],Y0=bz[1],X1=bz[0]+kz*1920,Y1=bz[1]+kz*1080;
  V.quad([[X0,Y0,1,0,0,0,0],[X1,Y0,1,1,0,1,0],[X0,Y1,1,0,1,0,1],[X1,Y1,1,1,1,1,1]],0,{tex:vt,a:1});}
 function clipDone(){if(!clip||clip.state==='done')return;clip.state='done';try{kv.pause();}catch(e){}if(vt){V.drop(vt);vt=null;}}
 function draw(t,tw){if(inClip(tw)){drawClip(tw);return;}if(clipMode&&tw>=C0+CD)clipDone();exposure(t);V.post=[ss(seg(t,0,.6)),D.warm];V.clear();layers.forEach(L=>{const st=L.st;if(L.t0!=null&&t<L.t0-.5)L.t0=null;if(st.a<=0||!L.shape){L.sc0=0;return;}if(!L.sc0)L.sc0=st.sc;if(L.t0==null)L.t0=t; // t0: when it first appeared (kept after it hands off)
  const w=L.s.wh[0]*st.sc,h=L.s.wh[1]*st.sc,ex=st.ox+st.sc*cx(L.s.a),ey=st.oy+st.sc*cy(L.s.a),hx=Math.abs(head[0])+1,hy=Math.abs(head[1])+1;
  // the least a far point may shrink toward the anchor and still cover the screen
  const gmin=Math.max(ex>st.ox+.5?(ex+hx)/(ex-st.ox):0,st.ox+w-ex>.5?(vw-ex+hx)/(st.ox+w-ex):0,ey>st.oy+.5?(ey+hy)/(ey-st.oy):0,st.oy+h-ey>.5?(vh-ey+hy)/(st.oy+h-ey):0);
  V.mesh(tx(L.s.f),L.s.wh,L.shape,st,st.a,[ex,ey],cl(DOLLY*(1-L.sc0/st.sc)+L.extra,-1,.9),Math.min(gmin,1.2),head,L.wipe&&st.a<1,L.cg);if(L===appDoor)drawDoor(L);});
  // free what is behind you: each shot once the next one has fully taken over, and the door once inside
  [app,ins].forEach(list=>{let top=-1;list.forEach((L,i)=>{if(L.st.a>=1)top=i;});for(let i=0;i<top;i++)if(list[i].st.a<=0)drop(list[i].s.f);});
  if(t>T.xf1+.3){drop(appDoor.s.f);drop('glow-side');drop('glow-leaf');}
}

 function render(tw){decide(tw);const t=te(tw);
  layers.forEach(L=>{L.extra=0;L.wipe=false;});
  const bob=Math.sin(t*Math.PI*2*.9)*2.2,sway=Math.sin(t*Math.PI*.9)*1.6,br=Math.sin(t*.8)*1.2+Math.sin(t*1.9)*.6;
  // approach + door
  if(t<T.xf1){
   const u0=seg(t,T.app0,T.app1),u=lerp(u0,eio(u0),.45),walkAmt=Math.sin(Math.PI*seg(t,T.app0,T.app1)),j=rap(t);
   const lean=.014*ss(seg(t,T.knock[0]-.4,T.knock[0]-.05))-.01*ss(seg(t,T.knock[2]+.25,T.knock[2]+1));
   const push=(1+.025*ss(seg(t,T.app1,T.crack))+lean)*Math.exp(PUSH*Math.pow(seg(t,T.swing+.35,T.xf1),2))*(1+.0035*j); // into the doorway, still speeding up at the threshold
   let W=Math.exp(lerp(Math.log(A0.w),Math.log(A1.w*(tall?1.06:1.13)),u))*push*(tall?Math.exp(Math.log(1.24)*ss(seg(t,T.light,T.bolt+.1))):1); // tall: step up while someone comes to the door
   let x=lerp(A0.x,A1.x,u)-.8*j,y=lerp(A0.y,A1.y,u)+1.6*j;head=[sway*walkAmt*5+br*2.2,bob*walkAmt*3.5+br*1.4+2*j].map(v=>v*calm(t)); // the head moves, the anchor stays put
   if(clip!==null){const z=leanIn(t);W*=z;x=CK.P[0]+z*(x-CK.P[0]);y=CK.P[1]+z*(y-CK.P[1]);}
   chain(app,W,x,y,Math.log(1.12),1.005,gate(app,hApp,.55,t,.1),t);
   const th=doorAngle(t),op=th/OPEN;D.th=th+.35*j;D.open=th>.01;
   D.shade=.42*(1-Math.cos(th*rad))/(1-Math.cos(OPEN*rad));D.spill=.9*Math.min(1,Math.sin(th*rad)/Math.sin(OPEN*rad));D.warm=op*.35;
   D.gap=ss(seg(th,.2,CRACK))*(1-ss(seg(th,14,40)));D.lit=ss(seg(t,T.light,T.light+.16));
   const fx=ss(seg(t,T.xf0,T.xf1));
   if(fx>0){const Lo=ins[0];const Wd=W*(rw(opn.door)/rw(SHOTS.approach[SHOTS.approach.length-1].a));const scO=Wd/rw(opn.door); // doorway / door slab
    // place the open-door image on its doorway so it lines up with the door we just opened
    const r=place(Lo,scO,x,y,opn.door,fx);Lo._t=r;Lo.wipe=true;}
   else hide([ins[0]]);
   hide(ins.slice(1));
   if(fx>=1)hide(app);
  }
  // inside
  if(t>=T.xf1){
   hide(app);if(!ins[0]._start){const r=ins[0]._t||place(ins[0],cover(ins[0].s)*1.05,vw/2,vh/2,opn.door,1);ins[0]._start={w:rw(opn.fire)*r.sc/I1.w,x:(r.ox+r.sc*cx(opn.fire)-I1.x)/vw,y:(r.oy+r.sc*cy(opn.fire)-I1.y)/vh};} // relative to the end framing
   const inGate=gate(ins,hIns,FADE,t);
   // keep walking at the speed we crossed the threshold with, then ease to a stop (a Hermite curve in log size)
   const S0=ins[0]._start,S={w:S0.w*I1.w,x:I1.x+S0.x*vw,y:I1.y+S0.y*vh},s1=seg(t,T.xf1,T.in1),u=eio(s1),walkAmt=Math.sin(Math.PI*s1),Dur=T.in1-T.xf1,L0=Math.log(S.w),L1=Math.log(I1.w);
   const m0=Math.min(2*PUSH/(T.xf1-T.swing-.35)*Dur,3*Math.max(L1-L0,0)),s2=s1*s1,s3=s2*s1;
   let W=Math.exp((2*s3-3*s2+1)*L0+(s3-2*s2+s1)*m0+(3*s2-2*s3)*L1),x=lerp(S.x,I1.x,u),y=lerp(S.y,I1.y,u);head=[sway*walkAmt*4+br*2.2,bob*walkAmt*3+br*1.4].map(v=>v*calm(t));
   if(t>=T.in1){ // look around
    if(!explore){explore=true;root.classList.add('explore');opts.onExplore&&opts.onExplore();}
    if(performance.now()-lastMove>3000&&!drag){pt=Math.sin((t-T.in1)*.28)*.3;pty=Math.sin((t-T.in1)*.21)*.15;}
    const dt=cl(t-(render.lt??t),0,.1);render.lt=t;const e=1-Math.exp(-dt/.22);p+=(pt-p)*e;py+=(pty-py)*e;
    // a real 3D look within the room: the camera turns (the view pans) and your head moves (parallax)
    W=I1.w*Math.exp(Math.log(1.16)*ss(seg(t,T.in1,T.in1+2.6)));x=I1.x-p*vw*.1;y=I1.y-py*vh*.06;head=[p*34+br*2.2,py*24+br*1.4];
   }
   chain(ins,W,x,y,Math.log(1.07),1,inGate,t);
   D.warm=.35*(1-seg(t,T.xf1,T.in1));
  }
  draw(t,tw);
  // sounds: each cue is handed over a moment early with its exact delay, so it lands on the frame it belongs to
  (clipMode?clipCues:cues).forEach((c,i)=>{const k=(clipMode?'c':'w')+i,x=clipMode?tw:t;if(x>=c[0]-.06&&!fired.has(k)){fired.add(k);opts.cue&&opts.cue(c[1],c[2]||0,Math.max(0,c[0]-x));}});
  // captions: "Knock," and "knock." land on the first two knocks
  if(t<T.open1){setCap('a',opts.capA);opts.cap.style.opacity=(seg(t,T.app1-.4,T.app1+.3)*(1-seg(t,T.crack+.3,T.crack+1))).toFixed(3);
   opts.cap.querySelectorAll('.kk').forEach((w,i)=>{const kt=clipMode?C0+KNOCK.knock[i]:T.knock[i],v=ss(seg(clipMode?tw:t,kt-.02,kt+.22));w.style.opacity=v.toFixed(3);w.style.transform=`translateY(${((1-v)*6).toFixed(2)}px)`;});}
  else{setCap('b',opts.capB);opts.cap.style.opacity=seg(t,T.cap,T.cap+.9).toFixed(3);}
  if(t>=T.done&&!render.shown){render.shown=1;opts.onDone&&opts.onDone();}
  if(t>=resumeAt)resume=false;
 }
 function setCap(k,h){if(capState!==k){capState=k;opts.cap.innerHTML=h;}}
 let clock=opts.startAt||0,lastTs=0,started=false;
 /* The clock: capped steps (a hidden tab or a slow frame pauses, never skips). While the clip plays it
    follows the video, so a video that stalls holds the picture instead of running ahead of it. If the
    clip cannot start, the walk does its own knock from the same moment; if it stalls for good, the walk
    picks up at the open door. */
 function abort(){if(!clip||clip.state==='done')return;if(clip.state==='play'){clock=Math.max(clock,C0+CD);clipDone();return;}
  try{kv.pause();}catch(e){}clip=null;clipMode=false;abortAt=clock;}
 function tick(dt){
  if(!clip||clip.state==='done'||clock+dt<C0){clock+=dt;return;}
  if(clip.state==='wait'){clip.state='start';clock=C0;vStall=0;try{kv.currentTime=0;const pr=kv.play();if(pr&&pr.then)pr.then(()=>{if(clip&&clip.state==='start')clip.state='play';},abort);else clip.state='play';}catch(e){abort();}return;}
  if(clip.state==='start'){if((vStall+=dt)>2)abort();return;}
  if(kv.ended||kv.currentTime>=CD-.02){clock=C0+CD;clipDone();return;}
  const c=C0+kv.currentTime;if(c>clock+1e-4){clock=c;vStall=0;}else if((vStall+=dt)>3)abort();}
 function loop(ts){if(stopped)return;const dt=lastTs?Math.min(.1,(ts-lastTs)/1000):0;lastTs=ts;tick(dt);const w=te(clock);
  if(clock>2)decode();if(w>T.app1&&(w<T.crack||resumeAt>=T.crack))stream();render(clock);requestAnimationFrame(loop);}
 const onMove=e=>{if(!explore)return;lastMove=performance.now();if(drag){pt=cl(drag.p-(e.clientX-drag.x)/vw*2.2,-1,1);pty=cl(drag.py-(e.clientY-drag.y)/vh*1.2,-.4,.4);}else if(e.pointerType==='mouse'){pt=cl((e.clientX/vw-.5)*2.2,-1,1);pty=cl((e.clientY/vh-.5)*.8,-.4,.4);}};
 const onDown=e=>{if(!explore||e.target.closest('button,a'))return;drag={x:e.clientX,y:e.clientY,p:pt,py:pty};root.classList.add('drag');lastMove=performance.now();};
 const up=()=>{drag=null;root.classList.remove('drag');};
 const keyEl=root.closest('[role=dialog]')||root,onKey=e=>{if(!explore)return;const k={ArrowLeft:[-.2,0],ArrowRight:[.2,0],ArrowUp:[0,-.1],ArrowDown:[0,.1]}[e.key];if(k){pt=cl(pt+k[0],-1,1);pty=cl(pty+k[1],-.4,.4);lastMove=performance.now();e.preventDefault();}};
 const onLost=e=>{e.preventDefault();if(!stopped&&opts.onLost)opts.onLost();}; // the GPU dropped the context (a phone in the background, memory pressure): end the walk
 const on=[[canvas,'webglcontextlost',onLost],[root,'pointermove',onMove],[root,'pointerdown',onDown],[root,'pointerup',up],[root,'pointercancel',up],[keyEl,'keydown',onKey]];
 on.forEach(([el,ev,f])=>el.addEventListener(ev,f));
 /* Warm up behind the loading overlay: draw every shot and every door piece once (textures, mipmaps
    and shader paths get their first use now, not in the middle of the walk), then reset. */
 (function prewarm(){const d={...D};Object.assign(D,{th:30,open:true,lit:1,gap:.5,spill:.5,shade:.3,warm:.2});
  layers.forEach(L=>{Object.assign(L.st,{ox:0,oy:0,sc:cover(L.s)*1.01,a:TX[L.s.f]?.01:0});L.wipe=L!==app[0];});draw(1);V.gl.finish();
  Object.assign(D,d);layers.forEach(L=>{L.st.a=0;L.sc0=0;L.t0=null;L.wipe=false;});})();
 render(resumeAt); // first frame now, so there is no blank canvas before the loop starts
 return {tall,get started(){return started;},start(){started=true;requestAnimationFrame(loop);},stop(){stopped=true;if(kv){try{kv.pause();}catch(e){}if(kv.parentNode===root)kv.remove();}if(vt){V.drop(vt);vt=null;}removeEventListener('resize',layout);on.forEach(([el,ev,f])=>el.removeEventListener(ev,f));Object.values(bands).forEach(B=>B.forEach(b=>b&&b.close&&b.close()));Object.keys(TX).forEach(drop);const x=V.gl.getExtension('WEBGL_lose_context');setTimeout(()=>{if(x&&!canvas.isConnected)x.loseContext();},1500);},render,T,
  mem:()=>({now:mem.now,peak:mem.peak,textures:Object.keys(TX).length}),look:()=>({p,py}),probe:(f,pts)=>TX[f]&&TX[f].ready?V.read(TX[f].t,pts):null,time:()=>te(clock),clock:()=>clock,raw:v=>{V.raw=v?1:0;},keyframes:v=>{capture=!!v;},
  // tests: clip(true) plays the knock clip regardless of timing; seek(c) shows clock time c, with the clip's frame when it is on screen
  clip:v=>{clip=v&&kv?{state:'wait'}:null;clipMode=!!clip;return clipMode;},clipInfo:()=>({mode:clipMode,state:clip&&clip.state,t0:C0,dur:CD,xf1:C1,Z:CK.Z}),
  seek:c=>!inClip(c)?Promise.resolve(render(c)):new Promise(res=>{const go=()=>{vFrame=true;render(c);res();};const want=Math.min(c-C0,CD-.01);
   if(Math.abs(kv.currentTime-want)<1e-3&&kv.readyState>=2)go();else{kv.addEventListener('seeked',()=>kv.requestVideoFrameCallback?kv.requestVideoFrameCallback(go):go(),{once:true});kv.currentTime=want;}}),scale:v=>{if(v){rs=v;V.resize(vw,vh,Math.min(2,devicePixelRatio||1)*rs);}return rs;}, // the walk clock and render scale, for tools/walk_perf.py
  shots:()=>layers.filter(L=>L.st.a>0).map(L=>L.key+':'+L.st.a.toFixed(2)+'@'+(L.sc0?(1-L.sc0/L.st.sc).toFixed(2):'-')).join(' ')};
}
return {preload,play,SHOTS};
})();
