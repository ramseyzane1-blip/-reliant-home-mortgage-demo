/* ================= Turntable: drag the model home around 360 degrees =================
   The views are cut-outs (see tools/house_views.py), drawn on a transparent canvas so the house
   floats on the page. Between two neighboring views, each is drawn on a mesh displaced along
   precomputed optical flow (house-flow.bin) while they blend, so the house moves from one view
   into the next instead of dissolving. All textures load up front, one GPU upload per frame. */
const Turntable=(()=>{
const G=41,FS_=16384; /* flow grid and fixed-point scale; must match tools/house_views.py */
const VS=`attribute vec2 uv;attribute vec2 fl;uniform float k,asp;varying vec2 vu;
void main(){vu=uv;vec2 q=uv+fl*k;vec2 n=vec2(q.x*2.-1.,1.-q.y*2.);if(asp>=1.)n.x/=asp;else n.y*=asp;gl_Position=vec4(n,0.,1.);}`;
const FS=`precision mediump float;uniform sampler2D tex;uniform float w;varying vec2 vu;void main(){gl_FragColor=texture2D(tex,vu)*w;}`;
function create(box,canvas,views,opt){
 const gl=canvas.getContext('webgl',{alpha:true,premultipliedAlpha:true,antialias:false});if(!gl)return null;
 const sh=(t,s)=>{const x=gl.createShader(t);gl.shaderSource(x,s);gl.compileShader(x);if(!gl.getShaderParameter(x,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(x));return x;};
 const pr=gl.createProgram();gl.attachShader(pr,sh(gl.VERTEX_SHADER,VS));gl.attachShader(pr,sh(gl.FRAGMENT_SHADER,FS));gl.bindAttribLocation(pr,0,'uv');gl.bindAttribLocation(pr,1,'fl');gl.linkProgram(pr);
 if(!gl.getProgramParameter(pr,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(pr));
 const U={};['k','asp','tex','w'].forEach(k=>U[k]=gl.getUniformLocation(pr,k));
 const buf=(d,t)=>{const b=gl.createBuffer();gl.bindBuffer(t||gl.ARRAY_BUFFER,b);gl.bufferData(t||gl.ARRAY_BUFFER,d,gl.STATIC_DRAW);return b;};
 const UV=[];for(let j=0;j<G;j++)for(let i=0;i<G;i++)UV.push(i/(G-1),j/(G-1));
 const I=[];for(let j=0;j<G-1;j++)for(let i=0;i<G-1;i++){const a=j*G+i,b=a+1,c=a+G,d=c+1;I.push(a,c,b,b,c,d);}
 const bU=buf(new Float32Array(UV)),bI=buf(new Uint16Array(I),gl.ELEMENT_ARRAY_BUFFER),NI=I.length,n=views.length;
 /* flow: for each k, k→k+1 then k+1→k. Until it arrives (or if it fails) the views simply blend. */
 const zero=buf(new Float32Array(G*G*2));let flows=null,flowDone=!opt.flow;
 if(opt.flow)fetch(opt.flow).then(r=>r.ok?r.arrayBuffer():Promise.reject()).then(ab=>{const a=new Int16Array(ab),sz=G*G*2;if(a.length!==n*2*sz)return;
  flows=[];for(let m=0;m<n*2;m++){const f=new Float32Array(sz);for(let q=0;q<sz;q++)f[q]=a[m*sz+q]/FS_;flows.push(buf(f));}}).catch(()=>{}).finally(()=>{flowDone=true;dirty=true;});
 /* textures: fetch every view now, nearest to the front first; upload at most one per frame */
 const tex=views.map(()=>null),queue=[];let dirty=true;
 const order=[0];for(let s=1;order.length<n;s++){order.push(s%n);if(order.length<n)order.push((n-s)%n);}
 order.forEach(i=>{const im=new Image();im.decoding='async';im.src=views[i].f;(im.decode?im.decode():new Promise((ok,no)=>{im.onload=ok;im.onerror=no;})).then(()=>queue.push([i,im])).catch(()=>{});});
 function upload(){if(!queue.length)return;queue.sort((x,y)=>order.indexOf(x[0])-order.indexOf(y[0]));const [i,im]=queue.shift();
  const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,im);
  const pot=!(im.naturalWidth&(im.naturalWidth-1))&&!(im.naturalHeight&(im.naturalHeight-1));if(pot)gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,pot?gl.LINEAR_MIPMAP_LINEAR:gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  tex[i]=t;dirty=true;}
 const A=views.map(v=>v.a);
 function pair(th){th=((th%360)+360)%360;for(let k=0;k<n;k++){const a0=A[k],a1=k+1<n?A[k+1]:A[0]+360;let t=th;if(t<a0)t+=360;if(t>=a0&&t<a1)return [k,(k+1)%n,(t-a0)/(a1-a0)];}return [0,1,0];}
 const layer=(t,fl,k,w)=>{gl.bindTexture(gl.TEXTURE_2D,t);gl.bindBuffer(gl.ARRAY_BUFFER,fl);gl.vertexAttribPointer(1,2,gl.FLOAT,false,0,0);gl.uniform1f(U.k,k);gl.uniform1f(U.w,w);gl.drawElements(gl.TRIANGLES,NI,gl.UNSIGNED_SHORT,0);};
 /* returns true once the frame shows exactly what was asked for */
 function draw(th){
  const [k,j,f]=pair(th),ta=tex[k],tb=tex[j];if(!ta&&!tb)return false;
  gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.useProgram(pr);
  gl.uniform1f(U.asp,canvas.width/canvas.height);gl.uniform1i(U.tex,0);gl.activeTexture(gl.TEXTURE0);
  gl.bindBuffer(gl.ARRAY_BUFFER,bU);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);gl.enableVertexAttribArray(1);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,bI);gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE);
  if(ta&&tb){const s=f*f*(3-2*f);
   if(s<1)layer(ta,flows?flows[2*k]:zero,f,1-s);
   if(s>0)layer(tb,flows?flows[2*k+1]:zero,1-f,s);
   return true;}
  layer(ta||tb,zero,0,1);return false;
 }
 /* interaction */
 let th=0,target=0,vel=0,drag=null,idle=true,idleT=0,raf=0,vis=true,last=0,ready=false,t0=0;
 function size(){const dpr=Math.min(window.devicePixelRatio||1,2),r=box.getBoundingClientRect();canvas.width=Math.max(1,Math.round(r.width*dpr));canvas.height=Math.max(1,Math.round(r.height*dpr));dirty=true;}
 function frame(ts){const dt=Math.min(.05,(ts-(last||ts))/1000);last=ts;upload();
  if(ready&&!drag){if(Math.abs(vel)>.02){target+=vel*dt*60;vel*=.94;}else if(idle&&!opt.reduced()){target=Math.sin((ts-t0)/1000*.22)*34;}}
  /* follow the pointer closely; drift back into the idle sway gently */
  const prev=th;let step=(target-th)*Math.min(1,dt*(idle?1.6:7));if(idle)step=Math.max(-50*dt,Math.min(50*dt,step));th+=step;if(Math.abs(th-prev)>.001)dirty=true;
  if(dirty){const ok=draw(th);dirty=!ok;if(ok&&!ready&&tex[0]&&flowDone){ready=true;t0=ts;box.classList.add('ready');}}
  raf=vis?requestAnimationFrame(frame):0;}
 box.addEventListener('pointerdown',e=>{drag={x:e.clientX,t:target,px:e.clientX,pt:performance.now()};idle=false;vel=0;box.setPointerCapture(e.pointerId);box.classList.add('drag','used');});
 box.addEventListener('pointermove',e=>{if(!drag)return;const w=box.clientWidth||400;target=drag.t-(e.clientX-drag.x)/w*200;const now=performance.now();vel=-(e.clientX-drag.px)/w*200/Math.max(1,(now-drag.pt)/16.7);drag.px=e.clientX;drag.pt=now;});
 /* after a pause, resume the sway from wherever the house was left, the short way round */
 function rest(){clearTimeout(idleT);idleT=setTimeout(()=>{const w=360*Math.round(th/360);th-=w;target=th;vel=0;idle=true;t0=performance.now()-Math.asin(Math.max(-1,Math.min(1,th/34)))/.22*1000;},4500);}
 const up=()=>{if(!drag)return;drag=null;box.classList.remove('drag');rest();};
 box.addEventListener('pointerup',up);box.addEventListener('pointercancel',up);
 box.addEventListener('keydown',e=>{const k={ArrowLeft:-20,ArrowRight:20}[e.key];if(k===undefined)return;e.preventDefault();idle=false;box.classList.add('used');target+=k;rest();});
 new ResizeObserver(size).observe(box);size();
 new IntersectionObserver(es=>{vis=es[0].isIntersecting&&!document.hidden;if(vis&&!raf){last=0;raf=requestAnimationFrame(frame);}}).observe(box);
 document.addEventListener('visibilitychange',()=>{vis=!document.hidden;if(vis&&!raf){last=0;raf=requestAnimationFrame(frame);}});
 raf=requestAnimationFrame(frame);
 return {set(a){target=th=a;idle=false;dirty=true;draw(a);},draw,ready:()=>ready&&tex.every(Boolean)&&!!flows};
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
  {f:'images/approach-1.jpg',wh:W1448,a:[618,526,693,676]},
  {f:'images/approach-2.jpg',wh:W1448,a:[640,302,809,693]},
  {f:'images/approach-3.jpg',wh:W1448,a:[628,255,817,719]},
  {f:'images/approach-4.jpg',wh:W1448,a:[562,167,875,839]},
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
function preload(){return Promise.all([depthLoad(),...files().map(f=>cache[f]||(cache[f]=new Promise(res=>{const i=new Image();i.decoding='async';i.onload=()=>{(i.decode?i.decode():Promise.resolve()).catch(()=>{}).then(()=>{imgs[f]=i;res(i);});};i.onerror=()=>res(null);i.src=f;})))]).then(r=>r.slice(1));}
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
const DEPTH={file:'images/walk-depth.bin',shots:{"approach-1":[0,161,121],"approach-2":[19481,161,121],"approach-3":[38962,161,121],"approach-4":[58443,161,121],"door":[77924,151,130],"door-open":[97554,161,121],"inside-1":[117035,161,121],"inside-2":[136516,161,121],"inside-3":[155997,161,121],"inside-4":[175478,161,121]}};
let depthBuf=null;
const depthLoad=()=>depthBuf||(depthBuf=fetch(DEPTH.file).then(r=>r.ok?r.arrayBuffer():null).catch(()=>null));

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
const FS_MESH=`#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D uTex;uniform float uA,uWR;uniform vec3 uWipe,uGain,uOff;uniform vec2 uWE;varying vec2 vUV;varying float vNear;varying vec2 vQ;
void main(){if(vNear<.01)discard;float a=uWipe.z>.5?clamp((uWipe.x*(1.+uWipe.y)-length(vQ-uWE)/uWR)/uWipe.y,0.,1.):uA;gl_FragColor=vec4(texture2D(uTex,vUV).rgb*uGain+uOff,a*vNear);}`;
const VS_QUAD=`attribute vec4 aPos;attribute vec2 aUV;attribute vec2 aL;varying highp vec2 vUV;varying vec2 vL;
void main(){gl_Position=aPos;vUV=aUV;vL=aL;}`;
const FS_QUAD=`precision mediump float;uniform sampler2D uTex,uGlow;uniform int uMode;uniform float uA,uGlowA,uShade,uBright;uniform vec3 uGain,uOff;varying highp vec2 vUV;varying vec2 vL;
void main(){
 if(uMode==0){vec4 c=texture2D(uTex,vUV);gl_FragColor=vec4((c.rgb*uGain+uOff)*uBright,c.a*uA);}
 else if(uMode==1){vec3 c=texture2D(uTex,vUV).rgb*uGain+uOff;vec4 g=texture2D(uGlow,vUV);c=mix(c,g.rgb,g.a*uGlowA);c*=1.-uShade*mix(.25,.75,vL.x);gl_FragColor=vec4(c,uA);}
 else if(uMode==2){gl_FragColor=vec4(mix(vec3(.047,.11,.07),vec3(.082,.16,.11),vL.x),uA);}
 else if(uMode==3){float x=vL.x,k=x<.7?x/.7:(x-.7)/.3;float a=x<.7?.95*k:mix(.95,.4,k);vec3 c=x<.7?mix(vec3(1.,.84,.59),vec3(1.,.886,.706),k):mix(vec3(1.,.886,.706),vec3(1.,.84,.59),k);gl_FragColor=vec4(c,a*uA);}
 else{vec2 d=(vL-vec2(.5,0.))/vec2(.707,1.414);float a=.55*(1.-clamp(length(d)/.68,0.,1.))*uA;gl_FragColor=vec4(vec3(1.,.77,.47)*a,1.);}
}`;
const ID=[[1,1,1],[0,0,0]];
function glView(canvas){
 const gl=canvas.getContext('webgl',{alpha:false,antialias:false,depth:true,premultipliedAlpha:false,powerPreference:'high-performance'});if(!gl)return null;
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
  return grids[k]={uv:buf(uv),idx:buf(idx,gl.ELEMENT_ARRAY_BUFFER),n:idx.length};}
 const tex=src=>{const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,src);[[gl.TEXTURE_MIN_FILTER,gl.LINEAR],[gl.TEXTURE_MAG_FILTER,gl.LINEAR],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]].forEach(([k,v])=>gl.texParameteri(gl.TEXTURE_2D,k,v));return t;};
 let W=1,H=1;
 return {gl,
  tex,
  shape(inv,gx,gy){const g=grid(gx,gy);return {g,inv:buf(inv)};},
  resize(w,h,dpr){W=w;H=h;canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);gl.viewport(0,0,canvas.width,canvas.height);},
  clear(){gl.clearColor(.027,.039,.031,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);},
  mesh(t,size,sh,pl,alpha,e,dolly,gmin,head,wipe,cg){gl.useProgram(M.p);gl.bindBuffer(gl.ARRAY_BUFFER,sh.g.uv);gl.enableVertexAttribArray(M.a.aUV);gl.vertexAttribPointer(M.a.aUV,2,gl.FLOAT,false,0,0);
   gl.bindBuffer(gl.ARRAY_BUFFER,sh.inv);gl.enableVertexAttribArray(M.a.aInv);gl.vertexAttribPointer(M.a.aInv,1,gl.FLOAT,false,0,0);
   gl.uniform2f(M.u.uView,W,H);gl.uniform2f(M.u.uSize,size[0],size[1]);gl.uniform3f(M.u.uPlace,pl.ox,pl.oy,pl.sc);gl.uniform2f(M.u.uE,e[0],e[1]);gl.uniform2f(M.u.uHead,head[0],head[1]);
   gl.uniform1f(M.u.uDolly,dolly);gl.uniform1f(M.u.uGmin,gmin);gl.uniform1f(M.u.uA,alpha);gl.uniform3f(M.u.uWipe,alpha,.5,wipe?1:0);gl.uniform2f(M.u.uWE,e[0],e[1]);gl.uniform3fv(M.u.uGain,(cg||ID)[0]);gl.uniform3fv(M.u.uOff,(cg||ID)[1]);
   gl.uniform1f(M.u.uWR,Math.max(Math.hypot(e[0],e[1]),Math.hypot(W-e[0],e[1]),Math.hypot(e[0],H-e[1]),Math.hypot(W-e[0],H-e[1]),1));
   gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,t);gl.uniform1i(M.u.uTex,0);
   gl.clear(gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LESS); // the relief hides itself correctly; each shot blends over the last
   gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,sh.g.idx);gl.drawElements(gl.TRIANGLES,sh.g.n,gl.UNSIGNED_SHORT,0);gl.disable(gl.DEPTH_TEST);
   gl.disableVertexAttribArray(M.a.aUV);gl.disableVertexAttribArray(M.a.aInv);},
  /* corners: 4 x [screen x, screen y, w (perspective), u, v, lx, ly] in strip order TL, TR, BL, BR */
  quad(corners,mode,o){gl.useProgram(Q.p);corners.forEach((c,i)=>{const w=c[2]||1,nx=c[0]/W*2-1,ny=1-c[1]/H*2;qData.set([nx*w,ny*w,0,w,c[3],c[4],c[5],c[6]],i*8);});
   gl.bindBuffer(gl.ARRAY_BUFFER,qB);gl.bufferData(gl.ARRAY_BUFFER,qData,gl.STREAM_DRAW);
   gl.enableVertexAttribArray(Q.a.aPos);gl.vertexAttribPointer(Q.a.aPos,4,gl.FLOAT,false,32,0);gl.enableVertexAttribArray(Q.a.aUV);gl.vertexAttribPointer(Q.a.aUV,2,gl.FLOAT,false,32,16);gl.enableVertexAttribArray(Q.a.aL);gl.vertexAttribPointer(Q.a.aL,2,gl.FLOAT,false,32,24);
   gl.uniform1i(Q.u.uMode,mode);gl.uniform1f(Q.u.uA,o.a);gl.uniform1f(Q.u.uGlowA,o.glowA||0);gl.uniform1f(Q.u.uShade,o.shade||0);gl.uniform1f(Q.u.uBright,o.bright||1);const cg=o.cg||ID;gl.uniform3fv(Q.u.uGain,cg[0]);gl.uniform3fv(Q.u.uOff,cg[1]);
   gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,o.tex||null);gl.uniform1i(Q.u.uTex,0);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,o.glow||o.tex||null);gl.uniform1i(Q.u.uGlow,1);
   if(mode===4)gl.blendFunc(gl.ONE_MINUS_DST_COLOR,gl.ONE); // screen
   gl.drawArrays(gl.TRIANGLE_STRIP,0,4);[Q.a.aPos,Q.a.aUV,Q.a.aL].forEach(l=>gl.disableVertexAttribArray(l));if(mode===4)gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.activeTexture(gl.TEXTURE0);}};
}

function play(root,opts){
 const canvas=document.createElement('canvas');canvas.className='wk-canvas';root.appendChild(canvas);
 let V;try{V=glView(canvas);}catch(e){V=null;}
 if(!V){canvas.remove();return null;}
 const warm=document.createElement('i');warm.className='wk-warm';root.appendChild(warm);
 const name=f=>f.split('/').pop().replace('.jpg','');
 const T0={};const texOf=f=>T0[f]||(T0[f]=V.tex(imgs[f]));
 const mk=s=>({s,key:name(s.f),tex:texOf(s.f),st:{ox:0,oy:0,sc:1,a:0},sc0:0,shape:null,extra:0});
 const app=SHOTS.approach.map(mk),ins=SHOTS.inside.map(mk),layers=[...app,...ins];
 const door=SHOTS.approach[4],opn=SHOTS.open,gSide=glowCanvas(door,false),gLeaf=glowCanvas(door,true);
 const texSide=gSide&&V.tex(gSide),texLeaf=gLeaf&&V.tex(gLeaf),texOpen=texOf(opn.f);
 // the relief of each shot
 const flatInv=new Float32Array(4).fill(1);
 depthLoad().then(ab=>{const all=ab&&new Uint8Array(ab);layers.forEach(L=>{const d=DEPTH.shots[L.key];
  if(all&&d&&d[0]+d[1]*d[2]<=all.length){const inv=new Float32Array(d[1]*d[2]);for(let i=0;i<inv.length;i++)inv[i]=Math.max(all[d[0]+i],4)/40;L.shape=V.shape(inv,d[1],d[2]);}
  else L.shape=V.shape(flatInv,2,2);});});
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
  const A=list[top],B=list[top+1],st=list.steer||(list.steer={x:0,y:0,t});let tx=0,ty=0;st.gap=0;
  if(B){ // where each shot can put its anchor at this zoom; aim for where both can
   const rng=(L,v,i)=>{const sc=W/rw(L.s.a),c=i?cy(L.s.a):cx(L.s.a);return [v-sc*(L.s.wh[i]-c),sc*c];};
   const fit=(v,i,size)=>{const a=rng(A,size,i),b=rng(B,size,i),lo=Math.max(a[0],b[0]),hi=Math.min(a[1],b[1]);st.gap=Math.max(st.gap,lo-hi);
    return lo<=hi?cl(v,lo,hi):(lo+hi)/2;};
   tx=fit(x,0,vw)-x;ty=fit(y,1,vh)-y;}
  const dt=t-st.t;st.t=t;if(dt<0||dt>1){st.x=tx;st.y=ty;}else{const e=1-Math.exp(-dt/.16);st.x+=(tx-st.x)*e;st.y+=(ty-st.y)*e;}st.err=Math.hypot(tx-st.x,ty-st.y);if(B&&al[top+1]>0){st.x=tx;st.y=ty;} // once it shows, hold it exactly
  x+=st.x;y+=st.y;
  list.forEach((L,i)=>{if(i<top||al[i]<=0){L.st.a=0;return;}place(L,W/rw(L.s.a),x,y,L.s.a,al[i]);if(i>top&&al[i]<1){through(list[i-1],L,al[i]);L.wipe=true;}});}
 /* During a handoff the outgoing shot keeps walking forward (the anchor holds its size, near things
    sweep past) to the dolly where its relief best matches the incoming shot, and the incoming one
    starts the same distance behind. Targets: the fraction of SIFT matches between the pair that land
    within 12px after the dolly, maximized (keyed by the incoming shot). */
 const THRU={'approach-2':.3,'approach-3':.4,'approach-4':.45,door:.21,'inside-1':.3,'inside-2':.12,'inside-3':.3,'inside-4':.26};
 function through(A,B,m){const base=A.sc0?DOLLY*(1-A.sc0/A.st.sc):0,d=Math.max(0,(THRU[B.key]??.25)-base),k=ss(m);A.extra=d*k;B.extra=-d*(1-k);}
 function hide(list){list.forEach(L=>{L.st.a=0;});}
 /* Handoffs: each shot waits until it is sharp enough (zoom alpha a >= .5), the one before it has
    finished, and the camera has lined it up (or the current shot is getting soft, or 1.2s have
    passed); then it fades in over a fixed time. */
 function gate(list,H,fade,t,soft=.22){return (i,a,over)=>{let h=H[i];if(h&&t<h.r-1){H.length=i;h=undefined;} // time went backwards (tests)
  if(!h){if(over<0||(i>1&&!(H[i-1]&&H[i-1].s!==undefined)))return 0;h=H[i]={r:t,s:undefined};}
  if(h.s===undefined){const ok=list.steer&&list.steer.err<=5&&list.steer.gap<=2;if(t>=(i>1?H[i-1].s+fade:-1e9)&&(ok||over>soft||t>h.r+1.2))h.s=t;else return 0;}
  return ss(seg(t,h.s,h.s+fade));};}

 /* ---- timeline (seconds) ---- */
 /* arrive, three raps, the hall light comes on, footsteps, the lock turns, the door cracks open,
    a beat, then someone swings it wide */
 const T={app0:.5,app1:6.4,knock:[7.2,7.41,7.6],light:7.95,steps:[8.25,8.6,8.92],bolt:9.18,crack:9.5,swing:9.85,open1:11.4,xf0:11.45,xf1:12.2,in1:17.4,cap:16.8,done:17.8};
 const cues=[[0,'start'],...T.knock.map((k,i)=>[k,'knock',i]),[T.light,'light'],...T.steps.map((k,i)=>[k,'step',i]),[T.bolt,'bolt'],[T.crack-.03,'latch'],[T.swing,'swing'],[T.xf0,'inside']],fired=new Set();
 const OPEN=72,CRACK=6,FADE=.85,DOLLY=.55,PUSH=Math.log(1.1); // DOLLY: how much of each zoom-in becomes walking forward (the rest stays a zoom)
 function doorAngle(t){if(t<T.crack)return 0;const c=CRACK*(1-Math.pow(1-seg(t,T.crack,T.crack+.16),3));if(t<T.swing)return c;
  // a hand on the door: speeds up, then eases out with a slight settle (an underdamped spring from rest)
  const u=t-T.swing,w=4.2,z=.8,wd=w*Math.sqrt(1-z*z);return OPEN-(OPEN-CRACK)*Math.exp(-z*w*u)*(Math.cos(wd*u)+z*w/wd*Math.sin(wd*u));}
 function rap(t){let j=0;T.knock.forEach(k=>{if(t>=k){const d=t-k;j+=Math.exp(-d*30)*Math.cos(d*55);}});return j;} // each knock nudges the camera and the door, then settles
 let head=[0,0];const hApp=[],hIns=[],D={th:0,shade:0,spill:0,gap:0,lit:0};
 let A0,A1,I1,stopped=false,explore=false,capState='',p=0,pt=0,py=0,pty=0,lastMove=0,drag=null;
 function layout(){vw=root.clientWidth||innerWidth;vh=root.clientHeight||innerHeight;V.resize(vw,vh,Math.min(2,devicePixelRatio||1));
  A0=natural(SHOTS.approach[0],SHOTS.approach[0].a,1);A1=natural(SHOTS.approach[4],SHOTS.approach[4].a,1);const J=SHOTS.inside[4];I1=natural(J,J.a,1.05);}
 layout();addEventListener('resize',layout);

 /* ---- drawing ---- */
 const P=1600,rad=Math.PI/180;
 function drawDoor(L){const st=L.st,a=st.a,r=door.a,w=rw(r),h=r[3]-r[1],S=(x,y)=>[st.ox+st.sc*x,st.oy+st.sc*y];
  const rect=(x0,y0,x1,y1,u0,v0,u1,v1)=>[[...S(x0,y0),1,u0,v0,0,0],[...S(x1,y0),1,u1,v0,1,0],[...S(x0,y1),1,u0,v1,0,1],[...S(x1,y1),1,u1,v1,1,1]];
  const th=D.th*rad,open=D.open;
  if(D.lit>0&&texSide)V.quad(rect(0,0,door.wh[0],door.wh[1],0,0,1,1),0,{tex:texSide,a:a*D.lit*.55});
  if(open){const o=opn.door,W1=opn.wh[0],H1=opn.wh[1];V.quad(rect(r[0],r[1],r[2],r[3],o[0]/W1,o[1]/H1,o[2]/W1,o[3]/H1),0,{tex:texOpen,a,bright:.92,cg:ins[0].cg});}
  if(D.gap>0)V.quad(rect(r[2]-30,r[1],r[2]+10,r[3],0,0,1,1),3,{a:a*D.gap});
  if(open||D.lit>0){ // the leaf, hinged on the left, seen with the same 1600px perspective the render was matched to
   const pt=(u,v,z)=>{const X=u*Math.cos(th)+z*Math.sin(th),Z=-u*Math.sin(th)+z*Math.cos(th),f=P/(P-Z);return [...S(r[0]+X*f,r[1]+h/2+(v-h/2)*f),1/f];};
   const Wd=door.wh[0],Hd=door.wh[1],u0=r[0]/Wd,u1=r[2]/Wd,v0=r[1]/Hd,v1=r[3]/Hd;
   V.quad([[...pt(0,0,0),u0,v0,0,0],[...pt(w,0,0),u1,v0,1,0],[...pt(0,h,0),u0,v1,0,1],[...pt(w,h,0),u1,v1,1,1]],1,{tex:L.tex,glow:texLeaf,glowA:D.lit*.55,shade:D.shade,a,cg:L.cg});
   if(open)V.quad([[...pt(w,0,22),0,0,0,0],[...pt(w,0,0),0,0,1,0],[...pt(w,h,22),0,0,0,1],[...pt(w,h,0),0,0,1,1]],2,{a});}
  if(D.spill>0)V.quad(rect(r[0]-w*.35,r[3]-6,r[0]+w*1.35,r[3]-6+h*.3,0,0,1,1),4,{a:a*D.spill});}
 /* Exposure, like one camera: each space has one grade (NATIVE, chained from CORR, the
    per-channel gain and offset that fits each shot to the one before it over their shared area).
    Outside is chained from the opening wide shot, inside from the last room, and the two are met
    halfway at the threshold, so the whole walk has one grade. A shot enters matched to what is on
    screen and settles into its grade over about 1.5s, which only shows where two renders disagree. */
 const CORR={"approach-2":[1.076,1.13,1.046,0.085,0.031,0.048],"approach-3":[1.058,0.945,0.944,-0.059,0.004,-0.003],"approach-4":[0.944,1.012,0.886,-0.038,-0.029,0.029],"door":[1.138,1.023,0.982,0.059,0.035,-0.002],"door-open":[0.984,0.983,0.961,0.008,0.015,-0.001],"inside-1":[1.072,1.222,1.337,-0.053,-0.058,-0.001],"inside-2":[0.953,1.055,1.243,0.019,-0.017,-0.039],"inside-3":[0.986,0.915,0.794,-0.039,-0.019,-0.017],"inside-4":[0.938,0.982,0.993,0.073,0.027,0.018]};
 const NATIVE={"approach-1":[0.938,0.891,0.961,-0.024,0.008,-0.011],"approach-2":[1.009,1.007,1.006,0.056,0.035,0.035],"approach-3":[1.068,0.952,0.949,-0.004,0.039,0.032],"approach-4":[1.008,0.963,0.841,-0.044,0.012,0.06],"door":[1.147,0.985,0.826,0.015,0.046,0.058],"door-open":[1.129,0.969,0.794,0.024,0.06,0.057],"inside-4":[1.066,1.122,1.04,0.026,-0.009,0.011],"inside-3":[1.137,1.143,1.047,-0.057,-0.04,-0.007],"inside-2":[1.153,1.249,1.3,-0.013,-0.016,0.015],"inside-1":[1.21,1.184,1.061,-0.035,0.004,0.056]};
 function exposure(t){let g=[1,1,1],o=[0,0,0];layers.forEach(L=>{const c=CORR[L.key],n=NATIVE[L.key]||[1,1,1,0,0,0];
   const mg=c?g.map((v,i)=>v*c[i]):n.slice(0,3),mo=c?o.map((v,i)=>g[i]*c[3+i]+v):n.slice(3);
   const w=L.t0==null?1:1-ss(seg(t,L.t0+.5,L.t0+2));g=mg.map((v,i)=>lerp(n[i],v,w));o=mo.map((v,i)=>lerp(n[3+i],v,w));L.cg=[g,o];});}
 /* A shot enters exactly as rendered (sc0 = its scale when it appears); from there, zooming in is
    turned into walking forward through its relief. */
 function draw(t){exposure(t);V.clear();layers.forEach(L=>{const st=L.st;if(L.t0!=null&&t<L.t0-.5)L.t0=null;if(st.a<=0||!L.shape){L.sc0=0;return;}if(!L.sc0)L.sc0=st.sc;if(L.t0==null)L.t0=t; // t0: when it first appeared (kept after it hands off)
  const w=L.s.wh[0]*st.sc,h=L.s.wh[1]*st.sc,ex=st.ox+st.sc*cx(L.s.a),ey=st.oy+st.sc*cy(L.s.a),hx=Math.abs(head[0])+1,hy=Math.abs(head[1])+1;
  // the least a far point may shrink toward the anchor and still cover the screen
  const gmin=Math.max(ex>st.ox+.5?(ex+hx)/(ex-st.ox):0,st.ox+w-ex>.5?(vw-ex+hx)/(st.ox+w-ex):0,ey>st.oy+.5?(ey+hy)/(ey-st.oy):0,st.oy+h-ey>.5?(vh-ey+hy)/(st.oy+h-ey):0);
  V.mesh(L.tex,L.s.wh,L.shape,st,st.a,[ex,ey],cl(DOLLY*(1-L.sc0/st.sc)+L.extra,-1,.9),Math.min(gmin,1.2),head,L.wipe&&st.a<1,L.cg);if(L===app[4])drawDoor(L);});}

 function render(t){
  layers.forEach(L=>{L.extra=0;L.wipe=false;});
  const bob=Math.sin(t*Math.PI*2*.9)*2.2,sway=Math.sin(t*Math.PI*.9)*1.6,br=Math.sin(t*.8)*1.2+Math.sin(t*1.9)*.6;
  // approach + door
  if(t<T.xf1){
   const u0=seg(t,T.app0,T.app1),u=lerp(u0,eio(u0),.45),walkAmt=Math.sin(Math.PI*seg(t,T.app0,T.app1)),j=rap(t);
   const lean=.014*ss(seg(t,T.knock[0]-.4,T.knock[0]-.05))-.01*ss(seg(t,T.knock[2]+.25,T.knock[2]+1));
   const push=(1+.025*ss(seg(t,T.app1,T.crack))+lean)*Math.exp(PUSH*Math.pow(seg(t,T.swing+.35,T.xf1),2))*(1+.0035*j); // into the doorway, still speeding up at the threshold
   const W=Math.exp(lerp(Math.log(A0.w),Math.log(A1.w*1.13),u))*push;
   const x=lerp(A0.x,A1.x,u)-.8*j,y=lerp(A0.y,A1.y,u)+1.6*j;head=[sway*walkAmt*5+br*2.2,bob*walkAmt*3.5+br*1.4+2*j]; // the head moves, the anchor stays put
   chain(app,W,x,y,Math.log(1.12),1.005,gate(app,hApp,.55,t,.1),t);
   const th=doorAngle(t),op=th/OPEN;D.th=th+.35*j;D.open=th>.01;
   D.shade=.42*(1-Math.cos(th*rad))/(1-Math.cos(OPEN*rad));D.spill=.9*Math.min(1,Math.sin(th*rad)/Math.sin(OPEN*rad));warm.style.opacity=(op*.35).toFixed(3);
   D.gap=ss(seg(th,.2,CRACK))*(1-ss(seg(th,14,40)));D.lit=ss(seg(t,T.light,T.light+.16));
   const fx=ss(seg(t,T.xf0,T.xf1));
   if(fx>0){const Lo=ins[0];const Wd=W*(rw(opn.door)/rw(door.a));const scO=Wd/rw(opn.door);
    // place the open-door image on its doorway so it lines up with the door we just opened
    const r=place(Lo,scO,x,y,opn.door,fx);Lo._t=r;Lo.wipe=true;}
   else hide([ins[0]]);
   hide(ins.slice(1));
   if(fx>=1)hide(app);
  }
  // inside
  if(t>=T.xf1){
   hide(app);if(!ins[0]._start){const r=ins[0]._t||place(ins[0],cover(ins[0].s)*1.05,vw/2,vh/2,opn.door,1);ins[0]._start={w:rw(opn.fire)*r.sc,x:r.ox+r.sc*cx(opn.fire),y:r.oy+r.sc*cy(opn.fire)};}
   const inGate=gate(ins,hIns,FADE,t);
   // keep walking at the speed we crossed the threshold with, then ease to a stop (a Hermite curve in log size)
   const S=ins[0]._start,s1=seg(t,T.xf1,T.in1),u=eio(s1),walkAmt=Math.sin(Math.PI*s1),Dur=T.in1-T.xf1,L0=Math.log(S.w),L1=Math.log(I1.w);
   const m0=Math.min(2*PUSH/(T.xf1-T.swing-.35)*Dur,3*Math.max(L1-L0,0)),s2=s1*s1,s3=s2*s1;
   let W=Math.exp((2*s3-3*s2+1)*L0+(s3-2*s2+s1)*m0+(3*s2-2*s3)*L1),x=lerp(S.x,I1.x,u),y=lerp(S.y,I1.y,u);head=[sway*walkAmt*4+br*2.2,bob*walkAmt*3+br*1.4];
   if(t>=T.in1){ // look around
    if(!explore){explore=true;root.classList.add('explore');opts.onExplore&&opts.onExplore();}
    if(performance.now()-lastMove>3000&&!drag){pt=Math.sin((t-T.in1)*.28)*.3;pty=Math.sin((t-T.in1)*.21)*.15;}
    const dt=cl(t-(render.lt??t),0,.1);render.lt=t;const e=1-Math.exp(-dt/.22);p+=(pt-p)*e;py+=(pty-py)*e;
    // a real 3D look within the room: the camera turns (the view pans) and your head moves (parallax)
    W=I1.w*Math.exp(Math.log(1.16)*ss(seg(t,T.in1,T.in1+2.6)));x=I1.x-p*vw*.1;y=I1.y-py*vh*.06;head=[p*34+br*2.2,py*24+br*1.4];
   }
   chain(ins,W,x,y,Math.log(1.07),1,inGate,t);
   warm.style.opacity=(.35*(1-seg(t,T.xf1,T.in1))).toFixed(3);
  }
  draw(t);
  // sounds: each cue is handed over a moment early with its exact delay, so it lands on the frame it belongs to
  cues.forEach((c,i)=>{if(t>=c[0]-.06&&!fired.has(i)){fired.add(i);opts.cue&&opts.cue(c[1],c[2]||0,Math.max(0,c[0]-t));}});
  // captions: "Knock," and "knock." land on the first two knocks
  if(t<T.open1){setCap('a',opts.capA);opts.cap.style.opacity=(seg(t,T.app1-.4,T.app1+.3)*(1-seg(t,T.crack+.3,T.crack+1))).toFixed(3);
   opts.cap.querySelectorAll('.kk').forEach((w,i)=>{const v=ss(seg(t,T.knock[i]-.02,T.knock[i]+.22));w.style.opacity=v.toFixed(3);w.style.transform=`translateY(${((1-v)*6).toFixed(2)}px)`;});}
  else{setCap('b',opts.capB);opts.cap.style.opacity=seg(t,T.cap,T.cap+.9).toFixed(3);}
  if(t>=T.done&&!render.shown){render.shown=1;opts.onDone&&opts.onDone();}
 }
 function setCap(k,h){if(capState!==k){capState=k;opts.cap.innerHTML=h;}}
 let clock=0,lastTs=0;
 function loop(ts){if(stopped)return;clock+=lastTs?Math.min(.1,(ts-lastTs)/1000):0;lastTs=ts;render(clock);requestAnimationFrame(loop);} // capped steps: a hidden tab or a slow frame pauses, never skips
 root.addEventListener('pointermove',e=>{if(!explore)return;lastMove=performance.now();if(drag){pt=cl(drag.p-(e.clientX-drag.x)/vw*2.2,-1,1);pty=cl(drag.py-(e.clientY-drag.y)/vh*1.2,-.4,.4);}else if(e.pointerType==='mouse'){pt=cl((e.clientX/vw-.5)*2.2,-1,1);pty=cl((e.clientY/vh-.5)*.8,-.4,.4);}});
 root.addEventListener('pointerdown',e=>{if(!explore||e.target.closest('button,a'))return;drag={x:e.clientX,y:e.clientY,p:pt,py:pty};root.classList.add('drag');lastMove=performance.now();});
 const up=()=>{drag=null;root.classList.remove('drag');};root.addEventListener('pointerup',up);root.addEventListener('pointercancel',up);
 (root.closest('[role=dialog]')||root).addEventListener('keydown',e=>{if(!explore)return;const k={ArrowLeft:[-.2,0],ArrowRight:[.2,0],ArrowUp:[0,-.1],ArrowDown:[0,.1]}[e.key];if(k){pt=cl(pt+k[0],-1,1);pty=cl(pty+k[1],-.4,.4);lastMove=performance.now();e.preventDefault();}});
 render(0); // first frame now, so there is no blank canvas before the loop starts
 return {start(){requestAnimationFrame(loop);},stop(){stopped=true;removeEventListener('resize',layout);const x=V.gl.getExtension('WEBGL_lose_context');setTimeout(()=>{if(x&&!canvas.isConnected)x.loseContext();},1500);},render,T,
  shots:()=>layers.filter(L=>L.st.a>0).map(L=>L.key+':'+L.st.a.toFixed(2)+'@'+(L.sc0?(1-L.sc0/L.st.sc).toFixed(2):'-')).join(' ')};
}
return {preload,play,SHOTS};
})();
