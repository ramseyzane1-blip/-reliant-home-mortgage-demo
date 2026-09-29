/* ================= Turntable: drag the model home around 360 degrees =================
   A 3D model of the house (tools/blender/house_scene.py) rendered as a 360-degree turn (144 frames, 2.5 degrees apart),
   with a transparent background so the house floats on the page. Each frame comes with its depth
   (images/turn/depth-*.bin, from Blender), so it is drawn as a relief and turned in 3D to any angle
   between frames: things move with their real parallax (a tree trunk in front of a wall) and
   nothing is shown twice, so the turn does not flicker. The nearest frame is drawn on top; the
   other one fills in only where the nearest has no picture (the wall a moving trunk uncovers),
   and they cross over in a short window halfway. */
const Turntable=(()=>{
const VS=`attribute vec2 uv;attribute vec2 fl;uniform float k,asp;varying vec2 vu;
void main(){vu=uv;vec2 q=uv+fl*k;vec2 n=vec2(q.x*2.-1.,1.-q.y*2.);if(asp>=1.)n.x/=asp;else n.y*=asp;gl_Position=vec4(n,0.,1.);}`;
const FS=`precision mediump float;uniform sampler2D tex;uniform float w;varying vec2 vu;void main(){gl_FragColor=texture2D(tex,vu)*w;}`;
/* relief: a vertex at frame position uv with depth z (meters along the camera axis) is put back
   in 3D, turned about the house's axis (R, T: the turn in camera space) and projected again. The
   camera matches house_scene.py: 80mm lens on a 36mm sensor (tan of half the view = .225). zc.y:
   how much the vertex can be trusted (0 next to a depth jump, where the mesh stretches), plus 2
   on the ring, which stays where it is. */
const VR=`attribute vec2 uv;attribute vec2 zc;uniform mat3 R;uniform vec3 T;uniform float asp;varying vec2 vu;varying float c;
void main(){vu=uv;float st=step(1.5,zc.y);c=zc.y-2.*st;float z=zc.x;vec3 q=vec3((uv.x*2.-1.)*.225*z,(1.-uv.y*2.)*.225*z,-z),p=mix(R*q+T,q,st);
vec2 n=p.xy/(-p.z*.225);if(asp>=1.)n.x/=asp;else n.y*=asp;gl_Position=vec4(n,clamp((-p.z-30.)/60.,0.,1.)*2.-1.,1.);}`;
/* cf 1: only the stretched parts (next to a depth jump), for marking them in the stencil */
const FR=`precision mediump float;uniform sampler2D tex;uniform float w,cf;varying vec2 vu;varying float c;
void main(){if(cf>.5&&c>.5)discard;gl_FragColor=texture2D(tex,vu)*w;}`;
/* views: [{f: 960px url, s: 768px url, a: degrees}]; opt: {reduced(), depth: {front, rest} urls, fixed: {f, s} (the
   parts that never move: most of the ring, the front of the plinth), front: the fallback <img> (its
   choice of copy is reused), lost(): WebGL went away} */
function create(box,canvas,views,opt){
 const gl=canvas.getContext('webgl',{alpha:true,premultipliedAlpha:true,antialias:false,depth:true,stencil:true});if(!gl)return null;
 const sh=(t,s)=>{const x=gl.createShader(t);gl.shaderSource(x,s);gl.compileShader(x);if(!gl.getShaderParameter(x,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(x));return x;};
 const pr=gl.createProgram();gl.attachShader(pr,sh(gl.VERTEX_SHADER,VS));gl.attachShader(pr,sh(gl.FRAGMENT_SHADER,FS));gl.bindAttribLocation(pr,0,'uv');gl.bindAttribLocation(pr,1,'fl');gl.linkProgram(pr);
 if(!gl.getProgramParameter(pr,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(pr));
 const U={};['k','asp','tex','w'].forEach(k=>U[k]=gl.getUniformLocation(pr,k));
 const p3=gl.createProgram();gl.attachShader(p3,sh(gl.VERTEX_SHADER,VR));gl.attachShader(p3,sh(gl.FRAGMENT_SHADER,FR));gl.bindAttribLocation(p3,0,'uv');gl.bindAttribLocation(p3,1,'zc');gl.linkProgram(p3);
 if(!gl.getProgramParameter(p3,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p3));
 const U3={};['R','T','asp','tex','w','cf'].forEach(k=>U3[k]=gl.getUniformLocation(p3,k));
 const buf=(d,t)=>{const b=gl.createBuffer();gl.bindBuffer(t||gl.ARRAY_BUFFER,b);gl.bufferData(t||gl.ARRAY_BUFFER,d,gl.STATIC_DRAW);return b;};
 /* the relief mesh: a G x G grid over the frame, built at the depth file's grid size */
 const n=views.length;let bU,bI,NI=0;
 function mesh(G){const UV=[];for(let j=0;j<G;j++)for(let i=0;i<G;i++)UV.push(i/(G-1),j/(G-1));
  const I=[];for(let j=0;j<G-1;j++)for(let i=0;i<G-1;i++){const a=j*G+i,b=a+1,c=a+G,d=c+1;I.push(a,c,b,b,c,d);}
  bU=buf(new Float32Array(UV));bI=buf(new Uint16Array(I),gl.ELEMENT_ARRAY_BUFFER);NI=I.length;}
 /* one plain quad for a frame shown as is */
 const qU=buf(new Float32Array([0,0,1,0,0,1,1,1])),qI=buf(new Uint16Array([0,2,1,1,2,3]),gl.ELEMENT_ARRAY_BUFFER),qZ=buf(new Float32Array(8));
 /* the same quad showing an offscreen picture (stored upside down): k=1 moves each corner to where it belongs */
 const qF=buf(new Float32Array([0,1,0,1,0,-1,0,-1]));
 /* two offscreen pictures the size of the canvas (color + depth/stencil), for mixing two turned frames */
 let fb=null;
 function freeFb(){if(!fb)return;[fb.a,fb.b].forEach(x=>{if(!x)return;gl.deleteFramebuffer(x.f);gl.deleteTexture(x.t);gl.deleteRenderbuffer(x.rb);});fb=null;}
 function fbs(){const w=canvas.width,h=canvas.height;if(fb&&fb.w===w&&fb.h===h)return fb.a&&fb.b?fb:null;freeFb();
  const mk=()=>{const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
   const rb=gl.createRenderbuffer();gl.bindRenderbuffer(gl.RENDERBUFFER,rb);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_STENCIL,w,h);
   const f=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,f);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t,0);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_STENCIL_ATTACHMENT,gl.RENDERBUFFER,rb);
   const ok=gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE;gl.bindFramebuffer(gl.FRAMEBUFFER,null);
   if(!ok){gl.deleteFramebuffer(f);gl.deleteTexture(t);gl.deleteRenderbuffer(rb);return null;}return {f,t,rb};};
  fb={w,h,a:mk(),b:mk()};return fb.a&&fb.b?fb:null;}
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
 /* depth (tools/house_views.py), in two files: the views the idle sway and a first drag use (front,
    fetched with the front frames) and the rest (fetched once those are in or the visitor starts
    turning). Each: 'DEP1', uint16 view count, uint16 grid, per view uint16 index + float32 near and
    far (meters), then uint8 per vertex per view (255: the ring, which stays still). A pair of frames without depth simply blends; a
    depth that lands while its frame is on screen waits until the turn moves on, so nothing pops. */
 const deps=views.map(()=>null),pend=[];let G0=0,depFront=!opt.depth,depRest=!opt.depth;
 const JUMP=1.5;   /* meters: a step in depth bigger than this is an edge (a trunk in front of a wall). Measured on
    1/depth, which changes linearly across any flat surface on screen, so a lawn seen at a low angle is not an edge */
 const fetchDepth=(u,done)=>fetch(u).then(r=>r.ok?r.arrayBuffer():Promise.reject()).then(ab=>{const dv=new DataView(ab);
  if(ab.byteLength<8||dv.getUint32(0)!==0x44455031)return;const nv=dv.getUint16(4,true),G=dv.getUint16(6,true),sz=G*G,d=8+nv*10;
  if(ab.byteLength!==d+nv*sz||(G0&&G!==G0))return;if(!G0){G0=G;mesh(G);}const q=new Uint8Array(ab,d);
  /* unpacked a few views per animation frame (in frame()), so a file landing mid-drag costs no hitch */
  for(let v=0;v<nv;v++){const i=dv.getUint16(8+v*10,true),lo=dv.getFloat32(10+v*10,true),hi=dv.getFloat32(14+v*10,true);if(i>=n)continue;
   pend.push([i,()=>{const z=new Float32Array(sz),st=new Uint8Array(sz),o=new Float32Array(sz*2);for(let m=0;m<sz;m++){const b=q[v*sz+m];st[m]=b===255;z[m]=lo+(hi-lo)*Math.min(b,254)/254;}
    for(let y=0;y<G;y++)for(let x=0;x<G;x++){const m=y*G+x,w=1/z[m];let jmp=0;
     for(const [dx,dy] of [[1,0],[0,1]]){const a=x-dx,b=y-dy,c=x+dx,d=y+dy;if(a<0||b<0||c>=G||d>=G)continue;const e=b*G+a,f=d*G+c;
      jmp=Math.max(jmp,st[e]!==st[m]||st[f]!==st[m]?1e3:st[m]?0:Math.abs(1/z[e]+1/z[f]-2*w)*z[m]*z[m]);}
     o[m*2]=z[m];o[m*2+1]=(jmp>JUMP?0:1)+2*st[m];}
    return buf(o);}]);}
 }).catch(()=>{}).finally(()=>{done();dirty=true;});
 /* the turn in camera space for frame i shown at angle th: camera 60m from (0,0,2.6), 7 degrees up */
 const EL=7*Math.PI/180,CE=Math.cos(EL),SE=Math.sin(EL),LOC=[0,-CE*60,SE*60+2.6];
 const RC=[[1,0,0],[0,SE,-CE],[0,CE,SE]];   /* camera to world (rotation about x by 90-7 degrees) */
 function turn(i,th){const d=(A[i]-th)*Math.PI/180,c=Math.cos(d),s=Math.sin(d),Rz=[[c,-s,0],[s,c,0],[0,0,1]];
  const mul=(a,b)=>a.map((r,x)=>b[0].map((_,y)=>r[0]*b[0][y]+r[1]*b[1][y]+r[2]*b[2][y])),tr=a=>a[0].map((_,x)=>a.map(r=>r[x]));
  const R=mul(tr(RC),mul(Rz,RC)),L2=Rz.map(r=>r[0]*LOC[0]+r[1]*LOC[1]+r[2]*LOC[2]-0),dL=[L2[0]-LOC[0],L2[1]-LOC[1],L2[2]-LOC[2]];
  const T=tr(RC).map(r=>r[0]*dL[0]+r[1]*dL[1]+r[2]*dL[2]);
  return [new Float32Array([R[0][0],R[1][0],R[2][0],R[0][1],R[1][1],R[2][1],R[0][2],R[1][2],R[2][2]]),T];}   /* column-major for GL */
 /* Frames. Nothing downloads until the hero is about to scroll into view; then the depth and the
    two frames next to the front, then the rest the idle sway uses (+-40 degrees), then the others
    once those are in or the visitor starts turning. Each frame is decoded off the main thread at the canvas's pixel size
    (texSize) and uploaded one per animation frame, never during a drag unless the frame on screen
    is missing; the decoded copy is released right after upload. A frame that fails to load is
    retried with backoff. About a
    second after the hero is well out of view (scrolled away, another page, the walk-through) it
    sleeps: every texture and its drawing buffer are released and the still <img>s show again; it
    wakes and re-uploads from the HTTP cache as it comes back. */
 const N=n,all=views;
 const tex=all.map(()=>null),gen=all.map(()=>0),dec=all.map(()=>null),busy=all.map(()=>false),fails=all.map(()=>0),retry=all.map(()=>0);
 let dirty=true,cur=0,texSize=0,texGen=1,started=false,allFetched=false,lost=false,asleep=false,sleepT=0;
 /* every frame stays on the GPU (a spin that has to wait for a frame shows as a jump); phones decode
    them a little smaller so all of them fit: 672px x 55 frames = 95 MB, 512px = 55 MB on devices
    reporting under 4 GB */
 const low=navigator.deviceMemory&&navigator.deviceMemory<4,touch=matchMedia('(pointer: coarse)').matches;
 const TEXMAX=low?512:touch?672:960,BUDGET=(low?50:touch?90:160)*1048576;
 /* the frames kept on the GPU: as many of the nearest as fit the budget (at 960px about 43, at
    672px about 50); a frame not in yet is covered by the nearest one that is, turned in 3D */
 const pool=()=>Math.max(12,Math.min(n,Math.floor(BUDGET/(4*(texSize||TEXMAX)**2))));
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
  if(opt.depth&&!depRest){depRest=true;fetchDepth(opt.depth.rest,()=>{});}
  /* frames beyond the pool only go into the HTTP cache, so turning to them later needs no network */
  if(!warmed&&pool()<n){warmed=true;byDist(cur).slice(pool()).forEach(i=>fetch(url(i),{priority:'low'}).then(r=>r.blob()).catch(()=>{}));}}
 function startFetch(){if(started||!texSize)return;started=true;if(opt.depth)fetchDepth(opt.depth.front,()=>{depFront=true;});want();}
 /* keep asking for what the current view needs, nearest first (covers evicted frames and failed
    downloads): until the hero is ready only the front and its two neighbors */
 function want(){if(!started||asleep)return;fetchFixed();const R=ready?40:3,P=pool();let live=0;for(let i=0;i<n;i++)if(tex[i]||busy[i]||dec[i])live++;
  for(const i of nearFirst()){if(adist(i,cur)<=R||(!ready&&(i===1%n||i===n-1))||(allFetched&&(tex[i]||live<P))){if(!tex[i]&&!busy[i]&&!dec[i])live++;fetchImg(i);}}}
 function sleep(){if(asleep||lost||!started)return;asleep=true;texGen++;ready=false;box.classList.remove('ready');
  for(let i=0;i<N;i++){if(tex[i])gl.deleteTexture(tex[i]);tex[i]=null;gen[i]=0;if(dec[i]&&dec[i].close)dec[i].close();dec[i]=null;}
  if(fx)gl.deleteTexture(fx);fx=null;fxGen=0;allFetched=false;freeFb();th=target=vel=0;idle=true;drag=null;box.classList.remove('drag');
  canvas.width=canvas.height=1;}
 function wake(){if(!asleep)return;asleep=false;size();dirty=true;want();}
 function upload(needed){
  let best=-1;for(let i=0;i<N;i++)if(dec[i]&&(best<0||adist(i,cur)<adist(best,cur)))best=i;
  if(best<0||(drag&&needed.indexOf(best)<0&&adist(best,cur)>6))return;   /* while dragging, only frames about to be needed */
  let t=tex[best];
  if(!t){const live=[];for(let i=0;i<n;i++)if(tex[i])live.push(i);
   if(live.length>=pool()){const far=live.reduce((a,b)=>adist(b,cur)>adist(a,cur)?b:a);
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
 const still=(t,w)=>{bind(qU,qI);gl.bindTexture(gl.TEXTURE_2D,t);gl.bindBuffer(gl.ARRAY_BUFFER,qZ);gl.vertexAttribPointer(1,2,gl.FLOAT,false,0,0);gl.uniform1f(U.k,0);gl.uniform1f(U.w,w);gl.drawElements(gl.TRIANGLES,6,gl.UNSIGNED_SHORT,0);};
 /* returns true once the frame shows exactly what was asked for */
 function draw(th){
  if(lost||asleep)return false;
  const [k,j,f]=pair(th),ta=tex[k],tb=tex[j];
  /* a frame of the pair is not in yet (turned faster than frames load): the nearest frames that
     are, turned in 3D to this angle (or, without depth, held) */
  const ok=i=>!!(tex[i]&&deps[i]);let near=-1,n2=-1;
  if(!(ta&&tb)){for(let i=0;i<n;i++)if(ok(i)){if(near<0||adist(i,th)<adist(near,th)){n2=near;near=i;}else if(n2<0||adist(i,th)<adist(n2,th))n2=i;}
   if(near<0&&!ta&&!tb){for(let i=0;i<n;i++)if(tex[i]&&(near<0||adist(i,th)<adist(near,th)))near=i;if(near<0)return false;}}
  gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.useProgram(pr);
  gl.uniform1f(U.asp,canvas.width/canvas.height);gl.uniform1i(U.tex,0);gl.activeTexture(gl.TEXTURE0);
  gl.enableVertexAttribArray(0);gl.enableVertexAttribArray(1);gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE);
  /* in 3D (both frames have depth): each frame's picture turned to this angle, mixed over the
     step (they line up, so the mix does not ghost); without depth, a plain blend */
  const rel=deps[k]&&deps[j],sm=f*f*(3-2*f);let exact=false;
  /* One frame turned to th: in full, then, where its visible picture sits next to a depth jump
     (its mesh stretches there, smearing the edge across what the turn uncovers), the other
     frame over it. That fill fades in over the first 2 degrees of turning (at its own angle a
     frame is exact). Stencil marks the stretched parts that are in view. */
  const relief=(top,bot)=>{gl.useProgram(p3);gl.uniform1f(U3.asp,canvas.width/canvas.height);gl.uniform1i(U3.tex,0);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
   gl.enable(gl.DEPTH_TEST);bind(bU,bI);gl.clearStencil(0);gl.clear(gl.DEPTH_BUFFER_BIT|gl.STENCIL_BUFFER_BIT);
   const go=(i,w,cf)=>{const [R,T]=turn(i,th);gl.uniformMatrix3fv(U3.R,false,R);gl.uniform3fv(U3.T,T);gl.uniform1f(U3.w,w);gl.uniform1f(U3.cf,cf);
    gl.bindTexture(gl.TEXTURE_2D,tex[i]);gl.bindBuffer(gl.ARRAY_BUFFER,deps[i]);gl.vertexAttribPointer(1,2,gl.FLOAT,false,0,0);gl.drawElements(gl.TRIANGLES,NI,gl.UNSIGNED_SHORT,0);};
   const fw=bot>=0?Math.min(1,adist(top,th)/2):0;gl.depthFunc(gl.LESS);go(top,1,0);
   if(fw>0){gl.enable(gl.STENCIL_TEST);gl.colorMask(false,false,false,false);gl.depthFunc(gl.LEQUAL);gl.stencilFunc(gl.ALWAYS,1,255);gl.stencilOp(gl.KEEP,gl.KEEP,gl.REPLACE);go(top,1,1);
    gl.colorMask(true,true,true,true);gl.clear(gl.DEPTH_BUFFER_BIT);gl.depthFunc(gl.LESS);gl.stencilFunc(gl.EQUAL,1,255);gl.stencilOp(gl.KEEP,gl.KEEP,gl.KEEP);go(bot,fw,0);
    gl.disable(gl.STENCIL_TEST);}
   gl.disable(gl.DEPTH_TEST);gl.useProgram(pr);gl.uniform1f(U.asp,canvas.width/canvas.height);};
  /* between two frames: each turned picture drawn offscreen, then mixed */
  const mix2=(a,b,t)=>{const F=fbs();if(!F){relief(t<.5?a:b,t<.5?b:a);return;}
   for(const [x,i,o] of [[F.a,a,b],[F.b,b,a]]){gl.bindFramebuffer(gl.FRAMEBUFFER,x.f);gl.viewport(0,0,F.w,F.h);gl.clear(gl.COLOR_BUFFER_BIT);relief(i,o);}
   gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,canvas.width,canvas.height);gl.blendFunc(gl.ONE,gl.ONE);gl.uniform1f(U.asp,1);
   for(const [x,w] of [[F.a,1-t],[F.b,t]]){bind(qU,qI);gl.bindTexture(gl.TEXTURE_2D,x.t);gl.bindBuffer(gl.ARRAY_BUFFER,qF);gl.vertexAttribPointer(1,2,gl.FLOAT,false,0,0);gl.uniform1f(U.k,1);gl.uniform1f(U.w,w);gl.drawElements(gl.TRIANGLES,6,gl.UNSIGNED_SHORT,0);}
   gl.uniform1f(U.asp,canvas.width/canvas.height);};
  /* mixed across the middle half of the step (smoothly, so nothing pops); nearer an end, the nearer frame alone (half the drawing) */
  if(ta&&tb&&rel){const m=Math.max(0,Math.min(1,(f-.25)*2)),ms=m*m*(3-2*m);if(ms<=0)relief(k,j);else if(ms>=1)relief(j,k);else mix2(k,j,ms);exact=true;}
  else if(near>=0&&ok(near))relief(near,n2);
  else if(near>=0)still(tex[near],1);
  else if(ta&&tb&&sm>0&&sm<1){still(ta,1-sm);still(tb,sm);exact=true;}
  else if(ta&&tb){still(sm>=1?tb:ta,1);exact=true;}
  else still(ta||tb,1);
  if(fx){gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);bind(fxU,fxI);gl.bindTexture(gl.TEXTURE_2D,fx);gl.bindBuffer(gl.ARRAY_BUFFER,fxZ);gl.vertexAttribPointer(1,2,gl.FLOAT,false,0,0);
   gl.uniform1f(U.k,0);gl.uniform1f(U.w,1);gl.drawElements(gl.TRIANGLES,fxN,gl.UNSIGNED_SHORT,0);}
  return exact&&(!opt.fixed||!!fx);
 }
 /* interaction */
 let th=0,target=0,vel=0,drag=null,idle=true,idleT=0,raf=0,inView=false,vis=false,last=0,ready=false,t0=0;
 const MAXV=110;   /* degrees per second: the house never turns faster than this, however hard it is flicked */
 function size(){if(asleep)return;const dpr=Math.min(window.devicePixelRatio||1,2),r=box.getBoundingClientRect();canvas.width=Math.max(1,Math.round(r.width*dpr));canvas.height=Math.max(1,Math.round(r.height*dpr));dirty=true;
  if(r.width<=0)return;const want_=Math.max(256,Math.min(TEXMAX,canvas.width));
  if(!texSize)texSize=want_;
  else if(want_>texSize*1.25){texSize=want_;texGen++;for(let i=0;i<N;i++){if(dec[i]&&dec[i].close)dec[i].close();dec[i]=null;}}}   /* grew a lot (rotation, wider window): re-decode, nearest first */
 function frame(ts){const dt=Math.min(.05,(ts-(last||ts))/1000);last=ts;cur=th;const pr_=pair(th);want();upload([pr_[0],pr_[1]]);
  for(let x=pend.length-1,m=ready?4:99;x>=0&&m>0;x--){const i=pend[x][0];if(!ready||(i!==pr_[0]&&i!==pr_[1])){deps[i]=pend[x][1]();pend.splice(x,1);dirty=true;m--;}}
  if(ready&&!allFetched&&A.every((a,i)=>tex[i]||adist(i,0)>40))fetchRest();
  if(ready&&!drag){if(Math.abs(vel)>.02){target+=vel*dt*60;vel*=Math.pow(.94,dt*60);}else if(idle&&!opt.reduced()){target=Math.sin((ts-t0)/1000*.22)*34;}}
  /* follow the pointer closely; drift back into the idle sway gently */
  const prev=th,cap=(idle?50:MAXV)*dt;let step=(target-th)*Math.min(1,dt*(idle?1.6:7));step=Math.max(-cap,Math.min(cap,step));th+=step;if(Math.abs(th-prev)>.001)dirty=true;
  if(Math.abs(target-th)>60){const c=target-th-Math.sign(target-th)*60;target-=c;if(drag)drag.t-=c;}   /* a hard flick does not wind up: the house stays within 60 degrees of where it is headed */
  if(dirty){const ok=draw(th);dirty=!ok;if(ok&&!ready&&tex[0]&&tex[1%n]&&tex[n-1]&&depFront){ready=true;t0=ts;box.classList.add('ready');}}
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
  sleep(){clearTimeout(sleepT);sleep();},asleep:()=>asleep,depths:()=>deps.filter(Boolean).length};
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
