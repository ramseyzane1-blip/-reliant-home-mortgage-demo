/* ================= Turntable: drag the model home around 360 degrees =================
   Each rendered view is draped over a simple depth model (house plane, lawn sloping toward
   the viewer) so turning between views has real parallax. Neighboring views cross-dissolve. */
const Turntable=(()=>{
const VS=`attribute vec3 p;attribute vec2 uv;attribute float e;attribute float rw;uniform float ang,piv,D,tanH,asp;varying vec2 vu;varying float ve;
void main(){vu=uv;ve=e;float c=cos(ang*rw),s=sin(ang*rw);float z=p.z+piv;vec3 q=vec3(c*p.x+s*z,p.y,-s*p.x+c*z-piv);
 float w=D-q.z;vec2 n=q.xy*D/w/(tanH*D);if(asp>=1.)n.x/=asp;else n.y*=asp;gl_Position=vec4(n,0.,1.);}`;
const FS=`precision mediump float;uniform sampler2D tex;uniform float alpha;uniform vec3 bg;varying vec2 vu;varying float ve;
void main(){vec3 c=texture2D(tex,vu).rgb;c=mix(bg,c,ve);gl_FragColor=vec4(c*alpha,alpha);}`;
function create(box,canvas,views,opt){
 const gl=canvas.getContext('webgl',{antialias:true,alpha:false,premultipliedAlpha:true});if(!gl)return null;
 const sh=(t,s)=>{const x=gl.createShader(t);gl.shaderSource(x,s);gl.compileShader(x);if(!gl.getShaderParameter(x,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(x));return x;};
 const pr=gl.createProgram();gl.attachShader(pr,sh(gl.VERTEX_SHADER,VS));gl.attachShader(pr,sh(gl.FRAGMENT_SHADER,FS));['p','uv','e','rw'].forEach((a,i)=>gl.bindAttribLocation(pr,i,a));gl.linkProgram(pr);
 if(!gl.getProgramParameter(pr,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(pr));
 const U={};['ang','piv','D','tanH','asp','tex','alpha','bg'].forEach(k=>U[k]=gl.getUniformLocation(pr,k));
 /* mesh: square image spanning x,y in [-1,1]; back-projected along camera rays so angle 0 reproduces the image exactly */
 const D=5,N=90,vb=.555,vr=.665,Zr=.62,piv=.34,over=1.05;
 const P=[],UV=[],E=[],RW=[];for(let j=0;j<=N;j++)for(let i=0;i<=N;i++){const u=i/N,v=j/N,x=(u-.5)*2,y=(.5-v)*2;
  const ramp=Math.min(1,Math.max(0,(v-vb)/(vr-vb))),ell=Math.sqrt(Math.max(0,1-Math.pow((u-.5)/.49,2)));const z=Zr*ramp*(v>vr?1:ell*.85+.15*ramp);
  const k=(D-z)/D;P.push(x*k,y*k,z);UV.push(u,v);const ed=Math.min(u,1-u,v,1-v);E.push(Math.min(1,ed/.05));
  const inx=1-Math.min(1,Math.max(0,(Math.abs(u-.5)-.43)/.06)),iny=1-Math.min(1,Math.max(0,(v-.69)/.12)),top=Math.min(1,Math.max(0,(v-.1)/.08));RW.push(Math.max(0,inx*iny*top));}
 const I=[];for(let j=0;j<N;j++)for(let i=0;i<N;i++){const a=j*(N+1)+i,b=a+1,c=a+N+1,d=c+1;I.push(a,c,b,b,c,d);}
 const buf=(d,t)=>{const b=gl.createBuffer();gl.bindBuffer(t||gl.ARRAY_BUFFER,b);gl.bufferData(t||gl.ARRAY_BUFFER,d,gl.STATIC_DRAW);return b;};
 const bP=buf(new Float32Array(P)),bU=buf(new Float32Array(UV)),bE=buf(new Float32Array(E)),bR=buf(new Float32Array(RW)),bI=buf(new Uint16Array(I),gl.ELEMENT_ARRAY_BUFFER),NI=I.length;
 /* textures: load lazily, keep a few in GPU memory */
 const imgs=views.map(()=>null),tex=new Map();
 function img(i){if(!imgs[i]){const im=new Image();im.decoding='async';im.src=views[i].f;imgs[i]=im;im.onload=()=>{dirty=true;};}return imgs[i];}
 function texture(i){if(tex.has(i)){const t=tex.get(i);tex.delete(i);tex.set(i,t);return t;}const im=img(i);if(!im.complete||!im.naturalWidth)return null;
  const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,im);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  tex.set(i,t);if(tex.size>5){const k=tex.keys().next().value;gl.deleteTexture(tex.get(k));tex.delete(k);}return t;}
 const A=views.map(v=>v.a),n=views.length;
 function pair(th){th=((th%360)+360)%360;for(let k=0;k<n;k++){const a0=A[k],a1=k+1<n?A[k+1]:A[0]+360;let t=th;if(t<a0)t+=360;if(t>=a0&&t<a1)return [k,(k+1)%n,a0,a1,t];}return [0,1,A[0],A[1],th];}
 const bg=opt.bg||[.949,.918,.882];let dirty=true;
 function draw(th){
  const [i0,i1,a0,a1,t]=pair(th),f=(t-a0)/(a1-a0),w=f<.5?0:1,mix=Math.min(1,Math.max(0,(f-.4)/.2)),m=mix*mix*(3-2*mix);
  // preload neighbors
  img(i0);img(i1);img((i1+1)%n);img((i0-1+n)%n);
  const t0=texture(i0),t1=texture(i1);
  gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(bg[0],bg[1],bg[2],1);gl.clear(gl.COLOR_BUFFER_BIT);gl.useProgram(pr);
  gl.uniform1f(U.piv,piv);gl.uniform1f(U.D,D);gl.uniform1f(U.tanH,1/(D*over));gl.uniform1f(U.asp,canvas.width/canvas.height);gl.uniform3fv(U.bg,bg);gl.uniform1i(U.tex,0);
  gl.bindBuffer(gl.ARRAY_BUFFER,bP);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,0,0);
  gl.bindBuffer(gl.ARRAY_BUFFER,bU);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,2,gl.FLOAT,false,0,0);
  gl.bindBuffer(gl.ARRAY_BUFFER,bE);gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2,1,gl.FLOAT,false,0,0);gl.bindBuffer(gl.ARRAY_BUFFER,bR);gl.enableVertexAttribArray(3);gl.vertexAttribPointer(3,1,gl.FLOAT,false,0,0);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,bI);gl.activeTexture(gl.TEXTURE0);
  const lim=17*Math.PI/180,rad=d=>Math.max(-lim,Math.min(lim,d*Math.PI/180));
  const layers=[[t0,-(t-a0),1],[t1,(a1-t),m]];
  if(!t1)layers[1][2]=0;if(!t0){layers[0][2]=0;layers[1][2]=t1?1:0;}
  gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
  for(const [tx,d,al] of layers){if(!tx||al<=0)continue;gl.bindTexture(gl.TEXTURE_2D,tx);gl.uniform1f(U.ang,rad(d));gl.uniform1f(U.alpha,al);gl.drawElements(gl.TRIANGLES,NI,gl.UNSIGNED_SHORT,0);}
  return !!(t0&&t1);
 }
 /* interaction */
 let th=0,target=0,vel=0,drag=null,idle=true,idleT=0,raf=0,vis=true,last=0,ready=false;const t0=performance.now();
 function size(){const dpr=Math.min(window.devicePixelRatio||1,2),r=box.getBoundingClientRect();canvas.width=Math.max(1,Math.round(r.width*dpr));canvas.height=Math.max(1,Math.round(r.height*dpr));dirty=true;}
 function frame(ts){const t=(ts-t0)/1000,dt=Math.min(.05,(ts-(last||ts))/1000);last=ts;
  if(!drag){if(Math.abs(vel)>.02){target+=vel*dt*60;vel*=.94;}else if(idle&&!opt.reduced()){target=Math.sin(t*.22)*34;}}
  const prev=th;th+=(target-th)*Math.min(1,dt*6);if(Math.abs(th-prev)>.001)dirty=true;
  if(dirty){const ok=draw(th);dirty=!ok;if(ok&&!ready){ready=true;box.classList.add('ready');}}
  raf=vis?requestAnimationFrame(frame):0;}
 box.addEventListener('pointerdown',e=>{drag={x:e.clientX,t:target,px:e.clientX,pt:performance.now()};idle=false;vel=0;box.setPointerCapture(e.pointerId);box.classList.add('drag','used');});
 box.addEventListener('pointermove',e=>{if(!drag)return;const w=box.clientWidth||400;target=drag.t-(e.clientX-drag.x)/w*200;const now=performance.now();vel=-(e.clientX-drag.px)/w*200/Math.max(1,(now-drag.pt)/16.7);drag.px=e.clientX;drag.pt=now;});
 const up=()=>{if(!drag)return;drag=null;box.classList.remove('drag');clearTimeout(idleT);idleT=setTimeout(()=>{idle=true;vel=0;},4500);};
 box.addEventListener('pointerup',up);box.addEventListener('pointercancel',up);
 box.addEventListener('keydown',e=>{const k={ArrowLeft:-20,ArrowRight:20}[e.key];if(k===undefined)return;e.preventDefault();idle=false;box.classList.add('used');target+=k;clearTimeout(idleT);idleT=setTimeout(()=>idle=true,4500);});
 new ResizeObserver(size).observe(box);size();
 new IntersectionObserver(es=>{vis=es[0].isIntersecting&&!document.hidden;if(vis&&!raf){last=0;raf=requestAnimationFrame(frame);}}).observe(box);
 document.addEventListener('visibilitychange',()=>{vis=!document.hidden;if(vis&&!raf){last=0;raf=requestAnimationFrame(frame);}});
 raf=requestAnimationFrame(frame);
 return {set(a){target=th=a;idle=false;dirty=true;draw(a);},draw};
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
  {f:'images/door.jpg',wh:[1350,1165],a:[503,97,899,969],glass:[330,120,1080,900]}],
 open:{f:'images/door-open.jpg',wh:W1448,door:[505,92,915,925],fire:[711,499,826,598]},
 inside:[
  {f:'images/door-open.jpg',wh:W1448,a:[711,499,826,598]},
  {f:'images/inside-1.jpg',wh:W1448,a:[721,369,849,479]},
  {f:'images/inside-2.jpg',wh:W1448,a:[696,431,852,565]},
  {f:'images/inside-3.jpg',wh:W1448,a:[729,457,919,620]},
  {f:'images/inside-4.jpg',wh:W1448,a:[660,461,853,627]}],
 left:{f:'images/look-left.jpg',wh:W1448,a:[1046,448,1256,602]},
 right:{f:'images/look-right.jpg',wh:W1448,a:[304,458,498,630]}};
const files=()=>{const s=new Set();SHOTS.approach.forEach(x=>s.add(x.f));SHOTS.inside.forEach(x=>s.add(x.f));[SHOTS.open,SHOTS.left,SHOTS.right].forEach(x=>s.add(x.f));return [...s];};
const cache={},imgs={};
function preload(){return Promise.all(files().map(f=>cache[f]||(cache[f]=new Promise(res=>{const i=new Image();i.decoding='async';i.onload=()=>{(i.decode?i.decode():Promise.resolve()).catch(()=>{}).then(()=>{imgs[f]=i;res(i);});};i.onerror=()=>res(null);i.src=f;}))));}
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

function play(root,opts){
 /* ---- DOM ---- */
 const stage=document.createElement('div');stage.className='wk-stage';root.appendChild(stage);
 function layer(shot,extra){const d=document.createElement('div');d.className='wk-l';d.style.width=shot.wh[0]+'px';d.style.height=shot.wh[1]+'px';
  const im=document.createElement('img');im.src=shot.f;im.alt='';im.width=shot.wh[0];im.height=shot.wh[1];d.appendChild(im);if(extra)extra(d);stage.appendChild(d);d.style.opacity=0;return d;}
 let leaf,shade,spill,gap,glowLeaf,glowSide;
 function doorRig(d){const s=SHOTS.approach[4],o=SHOTS.open,r=s.a,w=rw(r),h=r[3]-r[1];
  const beyond=document.createElement('div');beyond.className='wk-beyond';Object.assign(beyond.style,{left:r[0]+'px',top:r[1]+'px',width:w+'px',height:h+'px'});
  const sx=w/rw(o.door),sy=h/(o.door[3]-o.door[1]);Object.assign(beyond.style,{backgroundImage:`url(${o.f})`,backgroundSize:`${o.wh[0]*sx}px ${o.wh[1]*sy}px`,backgroundPosition:`${-o.door[0]*sx}px ${-o.door[1]*sy}px`});
  const pers=document.createElement('div');pers.className='wk-pers';Object.assign(pers.style,{left:r[0]+'px',top:r[1]+'px',width:w+'px',height:h+'px'});
  leaf=document.createElement('div');leaf.className='wk-leaf';Object.assign(leaf.style,{backgroundImage:`url(${s.f})`,backgroundSize:`${s.wh[0]}px ${s.wh[1]}px`,backgroundPosition:`${-r[0]}px ${-r[1]}px`});
  const lg=glowCanvas(s,true);if(lg){glowLeaf=document.createElement('i');glowLeaf.className='wk-glow';Object.assign(glowLeaf.style,{backgroundImage:`url(${lg.toDataURL()})`,backgroundSize:`${s.wh[0]}px ${s.wh[1]}px`,backgroundPosition:`${-r[0]}px ${-r[1]}px`});leaf.appendChild(glowLeaf);}
  shade=document.createElement('i');shade.className='wk-shade';leaf.appendChild(shade);const edge=document.createElement('i');edge.className='wk-edge';leaf.appendChild(edge);pers.appendChild(leaf);
  glowSide=glowCanvas(s,false);if(glowSide){glowSide.className='wk-glow';Object.assign(glowSide.style,{width:s.wh[0]+'px',height:s.wh[1]+'px'});d.appendChild(glowSide);}
  spill=document.createElement('i');spill.className='wk-spill';Object.assign(spill.style,{left:(r[0]-w*.35)+'px',top:(r[3]-6)+'px',width:(w*1.7)+'px',height:(h*.3)+'px'});
  gap=document.createElement('i');gap.className='wk-gap';Object.assign(gap.style,{left:(r[2]-30)+'px',top:r[1]+'px',width:'40px',height:h+'px'}); // warm light in the crack along the latch side
  d.appendChild(beyond);d.appendChild(gap);d.appendChild(pers);d.appendChild(spill);}
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
 function chain(list,W,x,y,fadeLn,k=1.005,gate){let top=-1;const lnW=Math.log(W);
  const al=list.map((L,i)=>{if(i===0)return 1;const need=Math.log(rw(L.s.a)*cover(L.s)*k);const a=ss(seg(lnW,need,need+fadeLn));return gate?gate(i,a):a;});
  for(let i=list.length-1;i>=0;i--)if(al[i]>=1){top=i;break;}if(top<0)top=0;
  list.forEach((L,i)=>{if(i<top||al[i]<=0){L.el.style.opacity=0;L.el.style.visibility='hidden';return;}place(L,W/rw(L.s.a),x,y,L.s.a,al[i]);});}
 function hide(list){list.forEach(L=>{L.el.style.opacity=0;L.el.style.visibility='hidden';});}

 /* ---- timeline (seconds) ---- */
 /* arrive, three raps, the hall light comes on, footsteps, the lock turns, the door cracks open,
    a beat, then someone swings it wide */
 const T={app0:.5,app1:6.4,knock:[7.2,7.41,7.6],light:7.95,steps:[8.25,8.6,8.92],bolt:9.18,crack:9.5,swing:9.85,open1:11.4,xf0:11.45,xf1:12.2,in1:16.5,cap:15.9,done:16.9};
 const cues=[[0,'start'],...T.knock.map((k,i)=>[k,'knock',i]),[T.light,'light'],...T.steps.map((k,i)=>[k,'step',i]),[T.bolt,'bolt'],[T.crack-.03,'latch'],[T.swing,'swing'],[T.xf0,'inside']],fired=new Set();
 const OPEN=72,CRACK=6;
 function doorAngle(t){if(t<T.crack)return 0;const c=CRACK*(1-Math.pow(1-seg(t,T.crack,T.crack+.16),3));if(t<T.swing)return c;
  // a hand on the door: speeds up, then eases out with a slight settle (an underdamped spring from rest)
  const u=t-T.swing,w=4.2,z=.8,wd=w*Math.sqrt(1-z*z);return OPEN-(OPEN-CRACK)*Math.exp(-z*w*u)*(Math.cos(wd*u)+z*w/wd*Math.sin(wd*u));}
 function rap(t){let j=0;T.knock.forEach(k=>{if(t>=k){const d=t-k;j+=Math.exp(-d*30)*Math.cos(d*55);}});return j;} // each knock nudges the camera and the door, then settles
 const look={a:0,on:false,side:null,t:null},handoff=[];
 let A0,A1,I1,t0=0,stopped=false,explore=false,capState='',p=0,pt=0,py=0,pty=0,lastMove=0,drag=null;
 function layout(){vw=root.clientWidth;vh=root.clientHeight;A0=natural(SHOTS.approach[0],SHOTS.approach[0].a,1);A1=natural(SHOTS.approach[4],SHOTS.approach[4].a,1);
  const J=SHOTS.inside[4];I1=natural(J,J.a,1.05);}
 layout();addEventListener('resize',layout);
 function render(t){
  const bob=Math.sin(t*Math.PI*2*.9)*2.2,sway=Math.sin(t*Math.PI*.9)*1.6,br=Math.sin(t*.8)*1.2+Math.sin(t*1.9)*.6;
  // approach + door
  if(t<T.xf1){
   const u=eio(seg(t,T.app0,T.app1)),walkAmt=Math.sin(Math.PI*seg(t,T.app0,T.app1)),j=rap(t);
   const lean=.014*ss(seg(t,T.knock[0]-.4,T.knock[0]-.05))-.01*ss(seg(t,T.knock[2]+.25,T.knock[2]+1));
   const push=(1+.025*ss(seg(t,T.app1,T.crack))+lean+.07*eio(seg(t,T.swing+.35,T.xf1)))*(1+.0035*j);
   const W=Math.exp(lerp(Math.log(A0.w),Math.log(A1.w*1.13),u))*push;
   const x=lerp(A0.x,A1.x,u)+sway*walkAmt+br*.4-.8*j,y=lerp(A0.y,A1.y,u)+bob*walkAmt+br*.3+1.6*j;
   chain(app,W,x,y,Math.log(1.12));
   const th=doorAngle(t),op=th/OPEN;leaf.style.transform=`rotateY(${(th+.35*j).toFixed(3)}deg)`;
   shade.style.opacity=(.42*(1-Math.cos(th*Math.PI/180))/(1-Math.cos(OPEN*Math.PI/180))).toFixed(3);
   spill.style.opacity=(.9*Math.min(1,Math.sin(th*Math.PI/180)/Math.sin(OPEN*Math.PI/180))).toFixed(3);warm.style.opacity=(op*.35).toFixed(3);
   gap.style.opacity=(ss(seg(th,.2,CRACK))*(1-ss(seg(th,14,40)))).toFixed(3);
   const lit=ss(seg(t,T.light,T.light+.16));if(glowSide)glowSide.style.opacity=(lit*.55).toFixed(3);if(glowLeaf)glowLeaf.style.opacity=(lit*.55).toFixed(3);
   const fx=ss(seg(t,T.xf0,T.xf1));
   if(fx>0){const o=SHOTS.open,Lo=ins[0];const Wd=W*(rw(o.door)/rw(app[4].s.a));const scO=Wd/rw(o.door);
    // place the open-door image on its doorway so it lines up with the door we just opened
    const r=place(Lo,scO,x,y,o.door,fx);Lo._t=r;}
   else hide([ins[0]]);
   hide(ins.slice(1));hide([lookL,lookR]);
   if(fx>=1)hide(app);
  }
  // inside
  if(t>=T.xf1){
   hide(app);if(!ins[0]._start){const o=SHOTS.open,r=ins[0]._t||place(ins[0],cover(ins[0].s)*1.05,vw/2,vh/2,o.door,1);ins[0]._start={w:rw(o.fire)*r.sc,x:r.ox+r.sc*cx(o.fire),y:r.oy+r.sc*cy(o.fire)};}
   // Inside, each shot waits until it is sharp enough, then fades in over a fixed .6s, one at a time,
   // so a pair is never left half-blended while the camera creeps (the neighbors differ in parallax).
   const inGate=(i,a)=>{let s=handoff[i];if(s!==undefined&&t<s-1){handoff.length=i;s=undefined;} // time went backwards (tests)
    if(s===undefined){if(a<.5||(i>1&&handoff[i-1]===undefined))return 0;s=handoff[i]=Math.max(t,i>1?handoff[i-1]+.6:t);}
    return ss(seg(t,s,s+.6));};
   const S=ins[0]._start,u=eio(seg(t,T.xf1,T.in1)),walkAmt=Math.sin(Math.PI*seg(t,T.xf1,T.in1));
   let W=Math.exp(lerp(Math.log(S.w),Math.log(I1.w),u)),x=lerp(S.x,I1.x,u)+sway*walkAmt*.8+br*.5,y=lerp(S.y,I1.y,u)+bob*walkAmt*.8+br*.4;
   if(t>=T.in1){ // look around
    if(!explore){explore=true;root.classList.add('explore');opts.onExplore&&opts.onExplore();}
    if(performance.now()-lastMove>3000&&!drag){pt=Math.sin((t-T.in1)*.28)*.26;pty=Math.sin((t-T.in1)*.21)*.12;}
    p+=(pt-p)*.05;py+=(pty-py)*.05;
    const side=p<0?lookL:lookR,k=Math.abs(p),N=natural(side.s,side.s.a,1.05);
    W=Math.exp(lerp(Math.log(I1.w),Math.log(N.w),k));x=lerp(I1.x,N.x,k)+br*.5;y=lerp(I1.y,N.y,k)-py*vh*.08+br*.4;
    chain(ins,W,x,y,Math.log(1.07),1,inGate);
    // The side views are turned too far to line up with the center view, so never rest half-blended:
    // once you have turned far enough, the side view takes over with a short fade (and hands back the same way).
    const dt=cl(t-(look.t??t),0,.1);look.t=t;if(look.a<.01)look.side=side;
    const want=look.side===side&&k>(look.on?.3:.42);look.on=want;look.a+=((want?1:0)-look.a)*(1-Math.exp(-dt/.12));
    place(look.side,W/rw(look.side.s.a),x,y,look.side.s.a,ss(look.a));hide([look.side===lookL?lookR:lookL]);
   }else{chain(ins,W,x,y,Math.log(1.07),1,inGate);hide([lookL,lookR]);}
   warm.style.opacity=(.35*(1-seg(t,T.xf1,T.in1))).toFixed(3);
  }
  // sounds: each cue is handed over a moment early with its exact delay, so it lands on the frame it belongs to
  cues.forEach((c,i)=>{if(t>=c[0]-.06&&!fired.has(i)){fired.add(i);opts.cue&&opts.cue(c[1],c[2]||0,Math.max(0,c[0]-t));}});
  // captions: "Knock," and "knock." land on the first two knocks
  if(t<T.open1){setCap('a',opts.capA);opts.cap.style.opacity=(seg(t,T.app1-.4,T.app1+.3)*(1-seg(t,T.crack+.3,T.crack+1))).toFixed(3);
   opts.cap.querySelectorAll('.kk').forEach((w,i)=>{const v=ss(seg(t,T.knock[i]-.02,T.knock[i]+.22));w.style.opacity=v.toFixed(3);w.style.transform=`translateY(${((1-v)*6).toFixed(2)}px)`;});}
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
