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
   jumps. */
const Walk=(()=>{
const W1448=[1448,1086];
const SHOTS={
 approach:[
  {f:'images/approach-1.jpg',wh:W1448,a:[618,526,693,676]},
  {f:'images/approach-2.jpg',wh:W1448,a:[640,302,809,693]},
  {f:'images/approach-3.jpg',wh:W1448,a:[628,255,817,719]},
  {f:'images/approach-4.jpg',wh:W1448,a:[562,167,875,839]},
  {f:'images/door.jpg',wh:[1350,1165],a:[503,97,899,969]}],
 open:{f:'images/door-open.jpg',wh:W1448,door:[505,92,915,925],fire:[711,499,826,598]},
 inside:[
  {f:'images/door-open.jpg',wh:W1448,a:[711,499,826,598]},
  {f:'images/inside-1.jpg',wh:W1448,a:[718,371,847,507]},
  {f:'images/inside-2.jpg',wh:W1448,a:[693,431,851,607]},
  {f:'images/inside-3.jpg',wh:W1448,a:[721,452,899,608]},
  {f:'images/inside-4.jpg',wh:W1448,a:[655,451,850,617]}],
 left:{f:'images/look-left.jpg',wh:W1448,a:[1046,448,1256,602]},
 right:{f:'images/look-right.jpg',wh:W1448,a:[304,458,498,630]}};
const files=()=>{const s=new Set();SHOTS.approach.forEach(x=>s.add(x.f));SHOTS.inside.forEach(x=>s.add(x.f));[SHOTS.open,SHOTS.left,SHOTS.right].forEach(x=>s.add(x.f));return [...s];};
const cache={};
function preload(){return Promise.all(files().map(f=>cache[f]||(cache[f]=new Promise(res=>{const i=new Image();i.decoding='async';i.onload=()=>{(i.decode?i.decode():Promise.resolve()).catch(()=>{}).then(()=>res(i));};i.onerror=()=>res(null);i.src=f;}))));}
const cl=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),seg=(t,a,b)=>cl((t-a)/(b-a)),ss=x=>x*x*(3-2*x),eio=x=>x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2,lerp=(a,b,t)=>a+(b-a)*t;
const cx=r=>(r[0]+r[2])/2,cy=r=>(r[1]+r[3])/2,rw=r=>r[2]-r[0];

function play(root,opts){
 /* ---- DOM ---- */
 const stage=document.createElement('div');stage.className='wk-stage';root.appendChild(stage);
 function layer(shot,extra){const d=document.createElement('div');d.className='wk-l';d.style.width=shot.wh[0]+'px';d.style.height=shot.wh[1]+'px';
  const im=document.createElement('img');im.src=shot.f;im.alt='';im.width=shot.wh[0];im.height=shot.wh[1];d.appendChild(im);if(extra)extra(d);stage.appendChild(d);d.style.opacity=0;return d;}
 let leaf,shade,spill;
 function doorRig(d){const s=SHOTS.approach[4],o=SHOTS.open,r=s.a,w=rw(r),h=r[3]-r[1];
  const beyond=document.createElement('div');beyond.className='wk-beyond';Object.assign(beyond.style,{left:r[0]+'px',top:r[1]+'px',width:w+'px',height:h+'px'});
  const sx=w/rw(o.door),sy=h/(o.door[3]-o.door[1]);Object.assign(beyond.style,{backgroundImage:`url(${o.f})`,backgroundSize:`${o.wh[0]*sx}px ${o.wh[1]*sy}px`,backgroundPosition:`${-o.door[0]*sx}px ${-o.door[1]*sy}px`});
  const pers=document.createElement('div');pers.className='wk-pers';Object.assign(pers.style,{left:r[0]+'px',top:r[1]+'px',width:w+'px',height:h+'px'});
  leaf=document.createElement('div');leaf.className='wk-leaf';Object.assign(leaf.style,{backgroundImage:`url(${s.f})`,backgroundSize:`${s.wh[0]}px ${s.wh[1]}px`,backgroundPosition:`${-r[0]}px ${-r[1]}px`});
  shade=document.createElement('i');shade.className='wk-shade';leaf.appendChild(shade);const edge=document.createElement('i');edge.className='wk-edge';leaf.appendChild(edge);pers.appendChild(leaf);
  spill=document.createElement('i');spill.className='wk-spill';Object.assign(spill.style,{left:(r[0]-w*.35)+'px',top:(r[3]-6)+'px',width:(w*1.7)+'px',height:(h*.3)+'px'});
  d.appendChild(beyond);d.appendChild(pers);d.appendChild(spill);}
 const warm=document.createElement('i');warm.className='wk-warm';root.appendChild(warm);
 const app=SHOTS.approach.map((s,i)=>({s,el:layer(s,i===4?doorRig:null)}));
 const ins=SHOTS.inside.map(s=>({s,el:layer(s)}));
 const lookL={s:SHOTS.left,el:layer(SHOTS.left)},lookR={s:SHOTS.right,el:layer(SHOTS.right)};

 /* ---- camera math ---- */
 let vw=1,vh=1;const cover=s=>Math.max(vw/s.wh[0],vh/s.wh[1]);
 function place(L,sc,ax,ay,anchor,alpha){ // anchor rect center lands at (ax,ay), scale sc; clamped so the image always covers the screen
  const s=L.s;let ox=ax-sc*cx(anchor),oy=ay-sc*cy(anchor);ox=cl(ox,vw-sc*s.wh[0],0);oy=cl(oy,vh-sc*s.wh[1],0);
  L.el.style.transform=`translate3d(${ox}px,${oy}px,0) scale(${sc})`;L.el.style.opacity=alpha;L.el.style.visibility=alpha>0?'visible':'hidden';return {ox,oy,sc};}
 function natural(s,anchor,z){const c=cover(s)*(z||1);return {w:rw(anchor)*c,x:vw/2+(cx(anchor)-s.wh[0]/2)*c,y:vh/2+(cy(anchor)-s.wh[1]/2)*c};}
 /* run a chain of images that share one anchor object; camera = anchor width W and center (x,y) */
 function chain(list,W,x,y,fadeLn){let top=-1;const lnW=Math.log(W);
  const al=list.map((L,i)=>{if(i===0)return 1;const need=Math.log(rw(L.s.a)*cover(L.s)*1.005);return ss(seg(lnW,need,need+fadeLn));});
  for(let i=list.length-1;i>=0;i--)if(al[i]>=1){top=i;break;}if(top<0)top=0;
  list.forEach((L,i)=>{if(i<top||al[i]<=0){L.el.style.opacity=0;L.el.style.visibility='hidden';return;}place(L,W/rw(L.s.a),x,y,L.s.a,al[i]);});}
 function hide(list){list.forEach(L=>{L.el.style.opacity=0;L.el.style.visibility='hidden';});}

 /* ---- timeline (seconds) ---- */
 const T={app0:.5,app1:6.4,knock:[7.1,7.55],open0:8.3,open1:10.7,xf0:10.2,xf1:11.4,in0:11.2,in1:15.4,cap:14.9,done:15.8};
 let A0,A1,I1,t0=0,stopped=false,explore=false,capState='',p=0,pt=0,py=0,pty=0,lastMove=0,drag=null;
 function layout(){vw=root.clientWidth;vh=root.clientHeight;A0=natural(SHOTS.approach[0],SHOTS.approach[0].a,1);A1=natural(SHOTS.approach[4],SHOTS.approach[4].a,1);
  const J=SHOTS.inside[4];I1=natural(J,J.a,1.05);}
 layout();addEventListener('resize',layout);
 let doorOut=null;
 function render(t){
  const bob=Math.sin(t*Math.PI*2*.9)*2.2,sway=Math.sin(t*Math.PI*.9)*1.6,br=Math.sin(t*.8)*1.2+Math.sin(t*1.9)*.6;
  // approach + door
  if(t<T.xf1){
   const u=eio(seg(t,T.app0,T.app1)),walkAmt=Math.sin(Math.PI*seg(t,T.app0,T.app1));
   const push=1+.05*ss(seg(t,T.app1,T.open1))+.07*eio(seg(t,T.open0+.8,T.xf1));
   const W=Math.exp(lerp(Math.log(A0.w),Math.log(A1.w*1.13),u))*push;
   const x=lerp(A0.x,A1.x,u)+sway*walkAmt+br*.4,y=lerp(A0.y,A1.y,u)+bob*walkAmt+br*.3;
   chain(app,W,x,y,Math.log(1.12));
   const Ld=app[4];const sc=W/rw(Ld.s.a);doorOut={W,x,y,sc};
   const op=eio(seg(t,T.open0,T.open1));leaf.style.transform=`rotateY(${op*72}deg)`;shade.style.opacity=(op*.62).toFixed(3);spill.style.opacity=(op*.9).toFixed(3);
   warm.style.opacity=(op*.35).toFixed(3);
   const fx=ss(seg(t,T.xf0,T.xf1));
   if(fx>0){const o=SHOTS.open,Lo=ins[0];const Wd=W*(rw(o.door)/rw(Ld.s.a));const scO=Wd/rw(o.door);
    // place the open-door image on its doorway so it lines up with the door we just opened
    const r=place(Lo,scO,x,y,o.door,fx);Lo._t=r;}
   else hide([ins[0]]);
   hide(ins.slice(1));hide([lookL,lookR]);
   if(fx>=1)hide(app);
  }
  // inside
  if(t>=T.xf1||(t>=T.in0&&t<T.xf1)){
   hide(app);if(!ins[0]._start){const o=SHOTS.open,r=ins[0]._t||place(ins[0],cover(ins[0].s)*1.05,vw/2,vh/2,o.door,1);ins[0]._start={w:rw(o.fire)*r.sc,x:r.ox+r.sc*cx(o.fire),y:r.oy+r.sc*cy(o.fire)};}
   const S=ins[0]._start,u=eio(seg(t,T.xf1,T.in1)),walkAmt=Math.sin(Math.PI*seg(t,T.xf1,T.in1));
   let W=Math.exp(lerp(Math.log(S.w),Math.log(I1.w),u)),x=lerp(S.x,I1.x,u)+sway*walkAmt*.8+br*.5,y=lerp(S.y,I1.y,u)+bob*walkAmt*.8+br*.4;
   if(t>=T.in1){ // look around
    if(!explore){explore=true;root.classList.add('explore');opts.onExplore&&opts.onExplore();}
    if(performance.now()-lastMove>3000&&!drag){pt=Math.sin((t-T.in1)*.28)*.55;pty=Math.sin((t-T.in1)*.21)*.12;}
    p+=(pt-p)*.05;py+=(pty-py)*.05;
    const side=p<0?lookL:lookR,k=Math.abs(p),N=natural(side.s,side.s.a,1.05),m=ss(seg(k,.28,.78));
    W=Math.exp(lerp(Math.log(I1.w),Math.log(N.w),k));x=lerp(I1.x,N.x,k)+br*.5;y=lerp(I1.y,N.y,k)-py*vh*.08+br*.4;
    chain(ins,W,x,y,Math.log(1.1));
    place(side,W/rw(side.s.a),x,y,side.s.a,m);hide([side===lookL?lookR:lookL]);
   }else{chain(ins,W,x,y,Math.log(1.1));hide([lookL,lookR]);}
   warm.style.opacity=(.35*(1-seg(t,T.xf1,T.in1))).toFixed(3);
  }
  // knocks
  T.knock.forEach((k,i)=>{if(t>=k&&!render['k'+i]){render['k'+i]=1;opts.knock&&opts.knock();}});
  // captions
  if(t<T.open1){setCap('a',opts.capA);opts.cap.style.opacity=(seg(t,T.app1-.4,T.app1+.3)*(1-seg(t,T.open0+.6,T.open0+1.3))).toFixed(3);}
  else{setCap('b',opts.capB);opts.cap.style.opacity=seg(t,T.cap,T.cap+.9).toFixed(3);}
  if(t>=T.done&&!render.shown){render.shown=1;opts.onDone&&opts.onDone();}
 }
 function setCap(k,h){if(capState!==k){capState=k;opts.cap.innerHTML=h;}}
 function loop(ts){if(stopped)return;if(!t0)t0=ts;render((ts-t0)/1000);requestAnimationFrame(loop);}
 root.addEventListener('pointermove',e=>{if(!explore)return;lastMove=performance.now();if(drag){pt=cl(drag.p-(e.clientX-drag.x)/vw*2.2,-1,1);pty=cl(drag.py-(e.clientY-drag.y)/vh*1.2,-.4,.4);}else if(e.pointerType==='mouse'){pt=cl((e.clientX/vw-.5)*2.2,-1,1);pty=cl((e.clientY/vh-.5)*.8,-.4,.4);}});
 root.addEventListener('pointerdown',e=>{if(!explore||e.target.closest('button,a'))return;drag={x:e.clientX,y:e.clientY,p:pt,py:pty};root.classList.add('drag');lastMove=performance.now();});
 const up=()=>{drag=null;root.classList.remove('drag');};root.addEventListener('pointerup',up);root.addEventListener('pointercancel',up);
 root.addEventListener('keydown',e=>{if(!explore)return;const k={ArrowLeft:-.2,ArrowRight:.2}[e.key];if(k){pt=cl(pt+k,-1,1);lastMove=performance.now();e.preventDefault();}});
 return {start(){requestAnimationFrame(loop);},stop(){stopped=true;removeEventListener('resize',layout);},render,T};
}
return {preload,play,SHOTS};
})();
