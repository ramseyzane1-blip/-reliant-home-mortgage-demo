/* ---------- extra loan facts: [down payment, mortgage insurance, best for] ---------- */
const LX={
 'conventional-loans':['From 3% for some buyers','PMI under 20% down; can be removed later','Good credit and steady income'],
 'down-payment-assistance':['Helps cover your down payment','Depends on your first mortgage','First-time buyers with limited savings'],
 'fha-203k-loan':['From 3.5%','FHA mortgage insurance','Homes that need repairs'],
 'fha-loans':['From 3.5% with a 580+ score','Upfront and annual FHA premium','Building credit or a smaller down payment'],
 'fixed-rate-mortgage':['Depends on the program','Depends on the program','A steady payment for years'],
 'jumbo-loans':['Often 10% to 20%','Varies by lender','Higher-priced homes'],
 'non-qm-loan':['Often 10% or more','Varies by lender','Income that doesn\'t fit a W-2'],
 'self-employed-loan':['Often 10% or more','Varies by lender','Business owners and freelancers'],
 'usda-loan':['0% in eligible areas','Upfront and annual guarantee fee','Rural and small-town buyers'],
 'va-loans':['0% for eligible borrowers','None; one-time funding fee','Veterans and service members'],
 '2-1-buydown-loan':['Depends on the loan','Depends on the loan','Lower payments the first two years'],
 'adjustable-rate-mortgage':['Depends on the program','Depends on the program','Planning to move within several years'],
 'cash-out-refinance':['Typically keep about 20% equity','Depends on the loan','Tapping equity for big expenses'],
 'mortgage-refinance':['Based on your equity','Can drop PMI with 20% equity','Lowering your rate or changing term'],
 'reverse-mortgage':['Significant equity needed','FHA insurance on most reverse loans','Homeowners 62 and older'],
 'heloc':['Based on your equity','Typically none','Flexible cash for projects'],
 'construction-loans':['Often 10% to 20%','Varies','Building a new home'],
 'dscr-loan':['Often 20% to 25%','Varies','Rental property investors'],
 'land-loans':['Often 20% or more','Varies','Buying land to build later'],
 'doctor-loans':['Low or no down payment','Often no PMI','Physicians and medical professionals']};
const catName=c=>c==='Purchase'?'Buying':c==='Refinance'?'Refinancing':'Specialty';

/* ---------- demo modal ---------- */
let lastFocus=null;
function demo(title,body,data,btns){
  lastFocus=document.activeElement;$('modalTitle').textContent=title;$('modalBody').textContent=body;$('modalData').hidden=!data;$('modalData').textContent=data||'';
  $('modalBtns').innerHTML='';(btns||[]).forEach(b=>$('modalBtns').appendChild(b));
  const c=document.createElement('button');c.className='btn '+((btns&&btns.length)?'btn-line':'btn-primary');c.textContent='Got it';c.onclick=closeModal;$('modalBtns').appendChild(c);
  $('modal').hidden=false;c.focus();
}
function closeModal(){$('modal').hidden=true;if(lastFocus&&lastFocus.focus)lastFocus.focus();}
$('modal').addEventListener('click',e=>{if(e.target.id==='modal')closeModal();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!$('modal').hidden)closeModal();hidePop();}});
const DEMOS={call:["Call (513) 783-4018","On the live site, this starts a phone call to the Reliant office in Middletown."],email:["Email the team","On the live site, this opens an email to jenb@relianthomemtg.com."],intro:["Introduction requested","On the live site, this sends your request to the Reliant team, and they connect you with the partner by phone or email."]};
document.addEventListener('click',e=>{const b=e.target.closest('[data-demo]');if(!b)return;e.preventDefault();const d=DEMOS[b.dataset.demo];demo(d[0],d[1]);});
function extLink(label,url){const a=document.createElement('a');a.className='btn btn-primary';a.href=url;a.target='_blank';a.rel='noopener';a.textContent=label;return a;}
const savedNote=r=>r&&r.ok?'This is a demo. Your submission was saved to the demo database. On the live site, it goes straight to the Reliant team:':'This is a demo. On the live site, this goes straight to the Reliant team:';
document.querySelectorAll('form[data-form]').forEach(f=>f.addEventListener('submit',async e=>{
  e.preventDefault();const lines=[],fields={};f.querySelectorAll('input,select,textarea').forEach(el=>{if(!el.value)return;const lab=f.querySelector(`label[for="${el.id}"]`);const k=lab?lab.textContent.trim():el.id;fields[k]=el.value;lines.push(k+': '+el.value);});
  const btn=f.querySelector('[type=submit]');if(btn)btn.disabled=true;
  const r=await DB.insert('reliant_form_submissions',{form:f.dataset.form,fields});if(btn)btn.disabled=false;
  demo(f.dataset.form+' sent',savedNote(r),lines.join('\n')||'(No details entered)');}));

/* ---------- people ---------- */
const faceHTML=i=>`<span class="face" title="${TEAM[i].n}">${TEAM[i].i}</span>`;
const SIL='<svg viewBox="0 0 100 90" aria-hidden="true"><circle cx="50" cy="32" r="20"/><path d="M8 90c3-24 21-36 42-36s39 12 42 36z"/></svg>';
const portrait=i=>`<div class="portrait">${SIL}<b>${TEAM[i].i}</b><span class="slot-tag">Headshot</span></div>`;
document.querySelectorAll('[data-faces]').forEach(el=>el.innerHTML=TEAM.map((t,i)=>faceHTML(i)).join(''));
document.querySelectorAll('[data-people]').forEach(el=>el.innerHTML=TEAM.map((t,i)=>`<a href="#family" data-bio="${i}">${faceHTML(i)}<span>${t.n.replace('Wheeler-Wellman','W.-Wellman')}</span></a>`).join(''));
document.querySelectorAll('[data-team]').forEach(el=>el.innerHTML=TEAM.map((t,i)=>`<div class="person">${portrait(i)}<div class="pi"><b>${t.n}</b><span class="role num">Loan Officer · NMLS ${t.nmls}</span><button class="btn btn-primary" data-apply="${i}">Apply with ${t.n.split(' ')[0]}</button></div></div>`).join(''));
$('biosList').innerHTML=TEAM.map((t,i)=>`<article class="bio" id="bio-${i}">${portrait(i)}<div class="bt">
  <div><h3>${t.n}</h3><p class="muted num">Loan Officer · NMLS ${t.nmls}</p></div><p>${esc(t.bio)}</p>
  <div class="meta">${t.tags.map(x=>`<span>${x}</span>`).join('')}</div>
  ${t.quote?`<blockquote>"${esc(t.quote)}" <span class="fine">— ${t.qby}, Google review</span></blockquote>`:''}
  ${t.slot?`<p class="fine">Bio slot: add ${t.n.split(' ')[0]}'s years in lending, specialties and hometown.</p>`:''}
  <div class="btn-row"><a class="btn btn-primary" href="#start" data-lo="${i}">Get pre-qualified with ${t.n.split(' ')[0]}</a><button class="btn btn-line" data-apply="${i}">Apply</button></div></div></article>`).join('');
$('c-who').innerHTML='<option>Anyone on the team</option>'+TEAM.map(t=>`<option>${t.n}</option>`).join('');
let preferLO=null,pendingScroll=null;
document.addEventListener('click',e=>{
  const a=e.target.closest('[data-apply]');
  if(a){const t=TEAM[+a.dataset.apply];demo('Apply with '+t.n,`On the live site, this opens ${t.n.split(' ')[0]}'s secure online application. You can open the real application portal now.`,null,[extLink('Open real application',t.url)]);return;}
  const l=e.target.closest('[data-lo]');if(l)preferLO=+l.dataset.lo;
  const g=e.target.closest('[data-goal]');if(g)presetGoal(g.dataset.goal);
  const ls=e.target.closest('[data-lesson]');if(ls)curLesson=+ls.dataset.lesson;
  const b=e.target.closest('[data-bio]');if(b)pendingScroll='bio-'+b.dataset.bio;
  const sc=e.target.closest('[data-scroll]');if(sc)pendingScroll=sc.dataset.scroll;
  if(pendingScroll){const k=e.target.closest('a[href]');if(k&&k.getAttribute('href')===(location.hash||'#home')){e.preventDefault();route();}}
});

/* ---------- reviews ---------- */
let revFilter='';
function renderReviews(){document.querySelectorAll('[data-reviews]').forEach(el=>{let list=REVIEWS;if(el.dataset.reviews==='3')list=REVIEWS.slice(0,3);else if(revFilter==='agent')list=list.filter(r=>r.agent);else if(revFilter)list=list.filter(r=>r.who.includes(revFilter));
  el.innerHTML=list.map(r=>`<div class="rev"><span class="stars" aria-label="5 stars">★★★★★</span><q>${esc(r.q)}</q><small>${r.n} · ${r.role||'Client'} · ${r.d}</small></div>`).join('');});}
$('revfilter').addEventListener('click',e=>{const c=e.target.closest('.chip');if(!c)return;revFilter=c.dataset.f;$('revfilter').querySelectorAll('.chip').forEach(x=>x.setAttribute('aria-pressed',x===c));renderReviews();});
const GURL="https://search.google.com/local/reviews?placeid=ChIJEViXMQNdQIgRb8VN-N0-fS0";
$('starpick').innerHTML=[1,2,3,4,5].map(n=>`<button aria-label="${n} star${n>1?'s':''}" data-n="${n}">★</button>`).join('');
$('starpick').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const n=+b.dataset.n;$('starpick').querySelectorAll('button').forEach(x=>x.classList.toggle('on',+x.dataset.n<=n));$('starBtns').innerHTML='';
  if(n>=4){$('starMsg').textContent='Thank you! Would you share that on Google? It takes about a minute.';$('starBtns').appendChild(extLink('Review us on Google',GURL));}
  else{$('starMsg').textContent="We're sorry it wasn't a great experience. Tell us what happened and our team will follow up personally.";const a=document.createElement('a');a.className='btn btn-primary';a.href='#contact';a.textContent='Tell us what happened';$('starBtns').appendChild(a);}});
$('posts').innerHTML=POSTS.map(p=>`<article><span class="eyebrow" style="font-size:.68rem">${p[0]}</span><h4>${p[1]}</h4><p class="muted" style="font-size:.93rem">${p[2]}</p></article>`).join('');

/* ---------- loans ---------- */
function lrow(p,withCmp){const x=LX[p.s];return `<div class="lrow"><a class="lmain" href="#program-${p.s}"><b>${esc(p.n)}</b><span>${esc(p.sum)}</span></a><div class="lfact"><small>Down payment</small><span>${esc(x[0])}</span></div>${withCmp?`<label class="lcmp"><input type="checkbox" data-cmp="${p.s}" ${cmp.has(p.s)?'checked':''} ${!cmp.has(p.s)&&cmp.size>=3?'disabled':''}> Compare</label>`:'<span></span>'}</div>`;}
const cmp=new Set();let pCat='',pQ='';
function renderPrograms(){let html='';[['Purchase','Buying a home'],['Refinance','Refinancing'],['Specialty','Specialty loans']].forEach(([c,label])=>{if(pCat&&pCat!==c)return;const list=P.filter(p=>p.c===c&&(!pQ||(p.n+' '+p.sum).toLowerCase().includes(pQ)));if(list.length)html+=`<div class="lgroup"><h3>${label}</h3><div class="lrows">${list.map(p=>lrow(p,true)).join('')}</div></div>`;});
  $('plist').innerHTML=html||'<p class="muted">No loans match that search.</p>';}
$('pchips').addEventListener('click',e=>{const c=e.target.closest('.chip');if(!c)return;pCat=c.dataset.cat;$('pchips').querySelectorAll('.chip').forEach(x=>x.setAttribute('aria-pressed',x===c));renderPrograms();});
$('psearch').addEventListener('input',e=>{pQ=e.target.value.trim().toLowerCase();renderPrograms();});
document.addEventListener('change',e=>{const c=e.target.closest('[data-cmp]');if(!c)return;if(c.checked)cmp.add(c.dataset.cmp);else cmp.delete(c.dataset.cmp);renderPrograms();updateCmp();});
function updateCmp(){const n=cmp.size;$('cmpbar').hidden=n<1||curPage!=='loans';$('cmpText').textContent=n===1?'1 loan selected. Pick one more.':`${n} loans selected`;$('cmpGo').disabled=n<2;$('cmpGo').style.opacity=n<2?.5:1;}
$('cmpClear').onclick=()=>{cmp.clear();$('cmpPanel').hidden=true;renderPrograms();updateCmp();};
$('cmpGo').onclick=()=>{const L=[...cmp].map(s=>PBY[s]);
  $('cmpPanel').innerHTML=`<div class="cmpwrap"><table class="cmp"><thead><tr><th></th>${L.map(p=>`<th>${esc(p.n)}</th>`).join('')}</tr></thead><tbody>
  <tr><th>Best for</th>${L.map(p=>`<td>${esc(LX[p.s][2])}</td>`).join('')}</tr>
  <tr><th>Down payment</th>${L.map(p=>`<td>${esc(LX[p.s][0])}</td>`).join('')}</tr>
  <tr><th>Mortgage insurance</th>${L.map(p=>`<td>${esc(LX[p.s][1])}</td>`).join('')}</tr>
  <tr><th>Good fit if</th>${L.map(p=>`<td>${esc(p.fit[0])}</td>`).join('')}</tr>
  <tr><th>Keep in mind</th>${L.map(p=>`<td>${esc(p.mind[0])}</td>`).join('')}</tr>
  <tr><th></th>${L.map(p=>`<td><a class="linkish" href="#program-${p.s}">Details →</a></td>`).join('')}</tr></tbody></table></div>`;
  $('cmpPanel').hidden=false;$('cmpPanel').scrollIntoView({behavior:smooth(),block:'start'});};
function renderProgram(s){const p=PBY[s];if(!p)return false;const x=LX[s];$('pd-crumb').textContent=p.n;$('pd-name').textContent=p.n;$('pd-name2').textContent=p.n;$('pd-cat').textContent=catName(p.c)+(p.c==='Specialty'?' loan':'');$('pd-sum').textContent=p.sum;
  $('pd-facts').innerHTML=`<div><small>Down payment</small><b>${esc(x[0])}</b></div><div><small>Mortgage insurance</small><b>${esc(x[1])}</b></div><div><small>Best for</small><b>${esc(x[2])}</b></div>`;
  $('pd-fit').innerHTML=p.fit.map(v=>`<li><span class="mk">✓</span>${esc(v)}</li>`).join('');$('pd-mind').innerHTML=p.mind.map(v=>`<li><span class="mk off">!</span>${esc(v)}</li>`).join('');
  $('pd-go').dataset.goal=p.c==='Refinance'?'refi':'buy';
  $('pd-related').innerHTML=P.filter(v=>v.c===p.c&&v.s!==s).slice(0,4).map(v=>lrow(v,false)).join('');document.querySelector('[data-page="program"]').dataset.title=p.n+' | Reliant Home Mortgage';return true;}
$('refiRows').innerHTML=P.filter(p=>p.c==='Refinance').map(p=>lrow(p,false)).join('');

/* loan finder (buy) */
const FQ=[
 {id:'mil',q:'Have you or your spouse served in the military?',o:['Yes','No']},
 {id:'down',q:'How much can you put down?',o:['Under 5%','5% to 19%','20% or more']},
 {id:'credit',q:'How would you describe your credit?',o:['Strong (680+)','Building (under 680)','Not sure']},
 {id:'extra',q:'Anything else? Pick any that apply.',o:['First home','Rural or small town','Home needs repairs','Self-employed','Medical professional','Higher-priced home'],multi:1}];
const F={mil:'No',down:'Under 5%',credit:'Not sure',extra:new Set(['First home'])};
$('finderQs').innerHTML=FQ.map(q=>`<div class="qgroup"><span class="flabel">${q.q}</span><div class="chips" data-fq="${q.id}">${q.o.map(o=>`<button class="chip" aria-pressed="${q.multi?F.extra.has(o):F[q.id]===o}">${o}</button>`).join('')}</div></div>`).join('')+'<p class="fine">Your answers stay on this page. Nothing is sent.</p>';
$('finderQs').addEventListener('click',e=>{const c=e.target.closest('.chip');if(!c)return;const g=c.parentElement,id=g.dataset.fq;
  if(id==='extra'){const v=c.textContent;F.extra.has(v)?F.extra.delete(v):F.extra.add(v);c.setAttribute('aria-pressed',F.extra.has(v));}
  else{F[id]=c.textContent;g.querySelectorAll('.chip').forEach(x=>x.setAttribute('aria-pressed',x===c));}
  renderFinder();});
function renderFinder(){
  const sc={},why={};const add=(s,p,w)=>{sc[s]=(sc[s]||0)+p;if(w&&(!why[s]||p>=why[s][1]))why[s]=[w,p];};
  if(F.mil==='Yes')add('va-loans',10,'You may be able to buy with no down payment and no monthly mortgage insurance.');
  if(F.down==='Under 5%'){add('fha-loans',6,'FHA allows 3.5% down with a 580+ credit score.');add('down-payment-assistance',4,'Assistance can cover part of your down payment and closing costs.');add('conventional-loans',2,'Some conventional programs allow 3% down.');}
  if(F.down==='5% to 19%'){add('conventional-loans',6,'With 5% or more down, conventional loans are often priced well.');add('fha-loans',2,'FHA is still an option if your credit is building.');}
  if(F.down==='20% or more'){add('conventional-loans',9,'With 20% down, you avoid private mortgage insurance.');add('fixed-rate-mortgage',3,'Lock one payment for the life of the loan.');}
  if(F.credit.startsWith('Building'))add('fha-loans',5,'FHA is more flexible with credit than conventional loans.');
  if(F.credit.startsWith('Strong'))add('conventional-loans',4,'Strong credit usually earns the best conventional pricing.');
  const x=F.extra;
  if(x.has('First home'))add('down-payment-assistance',3,'First-time buyers often qualify for state down payment help.');
  if(x.has('Rural or small town'))add('usda-loan',9,'Zero down in eligible rural and suburban areas.');
  if(x.has('Home needs repairs'))add('fha-203k-loan',9,'Finance the home and the repairs in one loan.');
  if(x.has('Self-employed'))add('self-employed-loan',9,'Qualify with bank statements instead of only tax returns.');
  if(x.has('Medical professional'))add('doctor-loans',9,'Low down payment options built for medical careers.');
  if(x.has('Higher-priced home'))add('jumbo-loans',9,'For loan amounts above the conforming limit.');
  if(!Object.keys(sc).length){add('conventional-loans',1,'The most common loan for buyers.');add('fha-loans',1,'Flexible credit and down payment rules.');}
  const top=Object.keys(sc).sort((a,b)=>sc[b]-sc[a]).slice(0,3);
  $('matches').innerHTML=`<p class="flabel" style="margin-bottom:2px">Your best matches</p>`+top.map((s,k)=>{const p=PBY[s],l=LX[s];return `<div class="mcard${k===0?' top':''}">${k===0?'<span class="pill">Best match</span>':''}<h3>${esc(p.n)}</h3><p class="why">${esc(why[s][0])}</p><div class="facts"><div><small>Down payment</small><span>${esc(l[0])}</span></div><div><small>Mortgage insurance</small><span>${esc(l[1])}</span></div></div><div class="btn-row"><a class="linkish" href="#program-${s}">How ${esc(p.n.replace(/s$/,''))} works →</a></div></div>`;}).join('')+
   `<div class="card" style="display:flex;justify-content:space-between;gap:14px;align-items:center;flex-wrap:wrap;background:var(--alt)"><p style="font-size:.95rem;max-width:26em">Want a loan officer to confirm and add your numbers?</p><a class="btn btn-primary" href="#start" data-goal="buy">Get pre-qualified</a></div>`;
  const rest=P.filter(p=>p.c==='Purchase'&&!top.includes(p.s));$('otherBuy').innerHTML=rest.map(p=>lrow(p,false)).join('');$('otherSum').textContent=`Other loans for buyers (${rest.length})`;
}

/* ---------- refinance break-even ---------- */
function breakeven(){
  const bal=+$('be-bal').value,cur=+$('be-cur').value,nw=+$('be-new').value,cost=+$('be-cost').value,stay=+$('be-stay').value;
  $('be-bal-o').textContent=usd(bal);$('be-cur-o').textContent=cur.toFixed(3)+'%';$('be-new-o').textContent=nw.toFixed(3)+'%';$('be-cost-o').textContent=usd(cost);$('be-stay-o').textContent=stay+(stay>1?' years':' year');
  const save=pmt(bal,cur,30)-pmt(bal,nw,30),months=save>0?Math.ceil(cost/save):Infinity,net=save*stay*12-cost;
  $('be-save').textContent=usd(save)+'/mo';$('be-costs').textContent=usd(cost);$('be-net').textContent=usd(net);
  const v=$('be-verdict');
  if(save<=0){$('be-months').textContent='No savings';v.className='pill bad';v.textContent='Not at this rate';}
  else{$('be-months').textContent=months<12?months+' months':(months/12).toFixed(1)+' years';
    if(months<=stay*12*0.5){v.className='pill good';v.textContent='Likely worth it';}else if(months<=stay*12){v.className='pill mid';v.textContent='Borderline';}else{v.className='pill bad';v.textContent='Probably not yet';}}
  // chart
  const W=600,H=210,pl=48,pr=12,pt=14,pb=30,N=stay*12;const vals=[];for(let m=0;m<=N;m++)vals.push(save*m-cost);
  const mn=Math.min(0,...vals),mx=Math.max(0,...vals),sy=v2=>pt+(mx-v2)/((mx-mn)||1)*(H-pt-pb),sx=m=>pl+m/N*(W-pl-pr);
  const pts=vals.map((y,m)=>`${sx(m).toFixed(1)},${sy(y).toFixed(1)}`).join(' ');
  let g=`<line x1="${pl}" x2="${W-pr}" y1="${sy(0)}" y2="${sy(0)}" style="stroke:var(--muted)" stroke-dasharray="4 4" stroke-width="1"/>`;
  g+=`<text x="${pl-6}" y="${sy(0)+4}" text-anchor="end">$0</text><text x="${pl-6}" y="${sy(mx)+4}" text-anchor="end">${mx>0?usd(mx):''}</text><text x="${pl-6}" y="${sy(mn)+4}" text-anchor="end">${usd(mn)}</text>`;
  g+=`<polyline points="${pts}" fill="none" style="stroke:var(--forest)" stroke-width="3" stroke-linejoin="round"/>`;
  for(let y=0;y<=stay;y+=Math.max(1,Math.round(stay/5)))g+=`<text x="${sx(y*12)}" y="${H-8}" text-anchor="middle">${y===0?'Now':'Yr '+y}</text>`;
  if(isFinite(months)&&months<=N)g+=`<circle cx="${sx(months)}" cy="${sy(0)}" r="6" style="fill:var(--forest);stroke:var(--surface)" stroke-width="3"/><text x="${sx(months)}" y="${sy(0)-12}" text-anchor="middle" style="fill:var(--ink);font-weight:700">Break-even</text>`;
  $('be-chart').innerHTML=g;
}
['be-bal','be-cur','be-new','be-cost','be-stay'].forEach(id=>$(id).addEventListener('input',breakeven));

/* ---------- rate factors ---------- */
const RF=[
 {id:'credit',label:'Credit score',o:[['740+',-18],['680–739',-6],['620–679',10],['Below 620',22]],d:1,tip:{0:'Top-tier credit usually gets the best pricing.',1:'Good credit, close to the best pricing.',2:'Lenders price in more risk here.',3:'Fewer options, higher pricing. FHA can help.'}},
 {id:'equity',label:'Down payment or equity',o:[['20% or more',-10],['10% to 19%',-2],['Under 10%',7]],d:1},
 {id:'use',label:'Property',o:[['Primary home',0],['Second home',6],['Rental',16]],d:0},
 {id:'pts',label:'Discount points',o:[['None',0],['1 point',-8],['2 points',-15]],d:0}];
const RFs={credit:1,equity:1,use:0,pts:0};
$('rfQs').innerHTML=RF.map(f=>`<div class="qgroup"><span class="flabel">${f.label}</span><div class="chips" data-rf="${f.id}">${f.o.map((o,k)=>`<button class="chip" aria-pressed="${RFs[f.id]===k}" data-k="${k}">${o[0]}</button>`).join('')}</div></div>`).join('');
$('rfQs').addEventListener('click',e=>{const c=e.target.closest('.chip');if(!c)return;const g=c.parentElement;RFs[g.dataset.rf]=+c.dataset.k;g.querySelectorAll('.chip').forEach(x=>x.setAttribute('aria-pressed',x===c));rates();});
function rates(){let s=50;const parts=RF.map(f=>{const [name,v]=f.o[RFs[f.id]];s+=v;return [f.label,name,v];});s=Math.max(4,Math.min(96,s));
  $('rf-dot').style.left=s+'%';
  $('rf-head').textContent=s<35?'Toward the lower end of the range':s<60?'Around the middle of the range':'Toward the higher end of the range';
  $('rf-fx').innerHTML=parts.map(([l,n,v])=>{const w=Math.min(50,Math.abs(v)*2);return `<div><span>${l}</span><span class="bar"><span style="left:${v<0?50-w:50}%;width:${w}%;background:${v<0?'var(--good)':v>0?'var(--warn)':'var(--line)'}"></span></span><em style="color:${v<0?'var(--good)':v>0?'var(--warn)':'var(--muted)'}">${v<0?'Lower':v>0?'Higher':'Neutral'}</em></div>`;}).join('');}

/* ---------- glossary + inline terms ---------- */
/* glossary detail: example, why it matters, related terms, lesson */


const GMAP=Object.fromEntries(GLOSS);
let gLetter='',gQuery='',gSel=GSUG[0];
function hl(s){if(!gQuery)return esc(s);const i=s.toLowerCase().indexOf(gQuery);return i<0?esc(s):esc(s.slice(0,i))+'<mark>'+esc(s.slice(i,i+gQuery.length))+'</mark>'+esc(s.slice(i+gQuery.length));}
const shortName=k=>k.replace(/ \(([^)]+)\)$/,'');
function renderGloss(){const list=GLOSS.filter(([t,d])=>(!gLetter||t[0].toUpperCase()===gLetter)&&(!gQuery||t.toLowerCase().includes(gQuery)||d.toLowerCase().includes(gQuery)));
  $('glist').innerHTML=list.map(([t,d])=>`<button class="gterm" data-g="${esc(t)}" aria-pressed="${t===gSel}"><b>${hl(t)}</b><span>${hl(d)}</span></button>`).join('')||'<p class="muted">No match. Try another word, or ask our team.</p>';
  $('gcount').textContent=list.length+' of '+GLOSS.length+' terms';}
function renderGDetail(){const k=gSel,x=GX[k]||{};const L=x.l!==undefined?LESSONS[x.l]:null;
  $('gdetail').innerHTML=`<span class="pill cat">${esc(x.c||'Mortgage term')}</span><h3>${esc(k)}</h3><p class="def">${esc(GMAP[k]||'')}</p>
   ${x.ex?`<div class="ex"><h4>Example</h4><p>${esc(x.ex)}</p></div>`:''}${x.why?`<div><h4>Why it matters</h4><p>${esc(x.why)}</p></div>`:''}
   ${x.rel&&x.rel.length?`<div><h4>Related terms</h4><div class="chips">${x.rel.map(r=>`<button class="chip" data-g="${esc(r)}">${esc(shortName(r))}</button>`).join('')}</div></div>`:''}
   ${L?`<a class="linkish" href="#learn" data-lesson="${x.l}">Learn more in Homebuying 101: ${esc(L.t)} →</a>`:''}`;}
function selectTerm(k,scroll){if(!GMAP[k])return;gSel=k;renderGloss();renderGDetail();if(scroll&&innerWidth<960)$('gdetail').scrollIntoView({behavior:smooth(),block:'start'});}
$('gsug').innerHTML=GSUG.map(k=>`<button class="chip" data-g="${esc(k)}">${esc(shortName(k))}</button>`).join('');
document.addEventListener('click',e=>{const g=e.target.closest('[data-g]');if(!g)return;selectTerm(g.dataset.g,!g.closest('#gdetail'));});
const have=new Set(GLOSS.map(g=>g[0][0].toUpperCase()));
$('letters').innerHTML='<button aria-pressed="true" data-l="">All</button>'+'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(l=>`<button aria-pressed="false" data-l="${l}" ${have.has(l)?'':'disabled'}>${l}</button>`).join('');
$('letters').addEventListener('click',e=>{const b=e.target.closest('button');if(!b||b.disabled)return;gLetter=b.dataset.l;$('letters').querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',x===b));renderGloss();});
$('gsearch').addEventListener('input',e=>{gQuery=e.target.value.trim().toLowerCase();renderGloss();});
function hidePop(){$('pop').hidden=true;}
document.addEventListener('click',e=>{const m=e.target.closest('[data-gmore]');if(m){hidePop();selectTerm(m.dataset.gmore);location.hash='#glossary';return;}
  const t=e.target.closest('.term');if(!t){if(!e.target.closest('#pop'))hidePop();return;}
  const k=t.dataset.t,p=$('pop');p.innerHTML=`<b>${esc(k)}</b>${esc(GMAP[k]||'')}<br><button class="linkish" data-gmore="${esc(k)}" style="color:inherit;text-decoration:underline;margin-top:6px">More about this term →</button>`;p.hidden=false;const r=t.getBoundingClientRect();
  const x=Math.min(innerWidth-p.offsetWidth-12,Math.max(12,r.left));const y=r.bottom+8+p.offsetHeight>innerHeight?r.top-p.offsetHeight-8:r.bottom+8;p.style.left=x+'px';p.style.top=y+'px';});
addEventListener('scroll',hidePop,{passive:true});
const T=s=>s.replace(/\{([^|}]+)\|([^}]+)\}/g,(m,k,l)=>`<button class="term" data-t="${esc(k)}">${esc(l)}</button>`);

/* ---------- Homebuying 101 ---------- */
const LESSONS=[
 {t:'How much home can you afford?',min:4,
  body:['Lenders start with your {Debt-to-income ratio (DTI)|debt-to-income ratio}: the share of your gross monthly income that goes to debt payments, including the new house payment. It\'s the biggest factor in how much you can borrow.',
        'Many lenders like total debts to stay around 43% of income or less, though some programs allow more. The house payment includes principal, interest, taxes and insurance, often called {PITI|PITI}.',
        'What a lender approves and what feels comfortable aren\'t always the same. Leave room for savings, repairs and the rest of life.'],
  key:['DTI = monthly debt payments ÷ gross monthly income','Your new housing payment counts toward DTI','A comfortable budget can be lower than your approval'],
  try:'dti',q:['Which payments count toward your debt-to-income ratio?',['Only your credit cards','Your monthly debt payments plus the new house payment','Groceries and utilities'],1,'Right. Lenders add your monthly debt payments to the new housing payment and divide by your gross income.']},
 {t:'Credit and your rate',min:3,
  body:['Your credit score affects which loans you qualify for and the rate you\'re offered. Higher scores generally mean lower rates, but you don\'t need perfect credit to buy. {FHA loan|FHA loans}, for example, are more flexible.',
        'Lenders re-check credit before closing, so the goal is stability from the day you apply until the day you get your keys.'],
  key:['Check your reports for errors before you apply','Keep card balances low compared to their limits','No new credit or big financed purchases until after closing'],
  try:'credit',q:['You\'re under contract on a house. Is now a good time to finance new furniture?',['Yes, it won\'t matter','No, wait until after closing','Only if it\'s under $5,000'],1,'Right. New debt can change your debt-to-income ratio and credit score right before closing.']},
 {t:'Down payment: what you really need',min:4,
  body:['Twenty percent down isn\'t required. {VA loan|VA loans} and USDA loans can require nothing down for eligible buyers, FHA loans start at 3.5%, and some conventional loans start at 3%.',
        'Putting less than 20% down on a conventional loan usually adds {Private mortgage insurance (PMI)|private mortgage insurance}, which you can typically drop once you reach 20% equity. Gifts from family and state down payment programs can help cover the rest.'],
  key:['20% down avoids PMI but isn\'t required','Gift funds and assistance programs are common','Keep cash for closing costs and a cushion too'],
  try:'down',q:['What\'s the minimum down payment on an FHA loan with a 580+ credit score?',['3.5%','10%','20%'],0,'Right. FHA allows 3.5% down with a credit score of 580 or higher.']},
 {t:'Choosing a loan type',min:4,
  body:['A {Fixed-rate mortgage|fixed-rate mortgage} keeps the same rate and principal-and-interest payment for the life of the loan. An {Adjustable rate mortgage (ARM)|adjustable-rate mortgage} starts with a fixed period, often 5, 7 or 10 years, then adjusts with the market.',
        'The term matters too. A 15-year loan has a higher monthly payment than a 30-year, but you pay far less interest overall.'],
  key:['Fixed = predictable; ARM = lower start, more change later','Shorter terms cost more monthly and much less overall','Match the loan to how long you\'ll likely stay'],
  try:'term',q:['Who is an ARM usually best for?',['Someone who plans to stay 30 years','Someone likely to move or refinance before the fixed period ends','Anyone who wants a predictable payment'],1,'Right. An ARM can save money if you\'ll move or refinance before the rate starts adjusting.']},
 {t:'Rates, APR and points',min:3,
  body:['Your interest rate sets your monthly payment. The {Annual percentage rate (APR)|APR} adds certain fees spread over the loan, so it\'s the better number for comparing offers.',
        '{Discount points|Discount points} let you pay up front for a lower rate. One point costs 1% of your loan amount, and it only pays off if you keep the loan past the break-even point.',
        'Once you\'re under contract, a {Lock-in|rate lock} holds your rate while the loan closes.'],
  key:['Compare APRs, not just rates','1 point = 1% of the loan amount','Points pay off only if you keep the loan long enough'],
  try:'points',q:['On a $200,000 loan, what does one point cost?',['$200','$2,000','$20,000'],1,'Right. One point is 1% of the loan amount.']},
 {t:'Closing costs and closing day',min:4,
  body:['{Closing costs|Closing costs} usually run about 2% to 5% of the loan amount. They cover things like the appraisal, title insurance and lender fees. Some can be negotiated or paid by the seller.',
        'Within three business days of applying, you\'ll receive a Loan Estimate. At least three business days before closing, you\'ll receive a Closing Disclosure. Compare them line by line; your loan officer will walk you through any changes.',
        'Before you sign, do a final {Walk-through|walk-through} to make sure the home is in the agreed condition. Then sign, bring your funds to close, and get your keys.'],
  key:['Budget about 2% to 5% of the loan for closing costs','Loan Estimate within 3 business days of applying','Closing Disclosure at least 3 business days before closing'],
  try:'closing',q:['When should you receive your Closing Disclosure?',['At the closing table','At least three business days before closing','A month after closing'],1,'Right. You get at least three business days to review it before you sign.']}];
let curLesson=0;const done=new Set(store.get('rhm-learn',[]));
function slider(id,label,min,max,step,val,fmt){return `<div class="field"><label for="${id}">${label} <output id="${id}-o" class="num"></output></label><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${val}" data-fmt="${fmt}"></div>`;}
const TRY={
 dti:{h:slider('ty-inc','Gross monthly income',2000,25000,100,6500,'usd')+slider('ty-debt','Monthly debt payments',0,4000,25,450,'usd')+slider('ty-house','Planned house payment',500,6000,25,1800,'usd')+'<div class="gauge"><span id="ty-bar"></span><i style="left:43%"></i></div><p id="ty-out" style="margin-top:10px"></p>',
  f:()=>{const inc=+$('ty-inc').value,d=+$('ty-debt').value,h=+$('ty-house').value,r=(d+h)/inc*100;$('ty-bar').style.width=Math.min(100,r)+'%';$('ty-bar').style.background=r<=36?'var(--good)':r<=43?'var(--star)':'var(--warn)';
   $('ty-out').innerHTML=`<b class="num">${r.toFixed(1)}% DTI.</b> `+(r<=36?'Comfortable range for most lenders.':r<=43?'Within many lenders\' limits, but tighter.':'Above many limits. A smaller payment or paying down debt would help.');}},
 credit:{h:['Pull your free reports at AnnualCreditReport.com','Dispute any errors you find','Pay every bill on time','Pay card balances down','Hold off on new credit until you close'].map((x,i)=>`<label class="toggle"><input type="checkbox" data-cc="${i}"><span>${x}</span></label>`).join('')+'<p id="ty-cc" class="fine" style="margin-top:6px"></p>',
  f:()=>{const n=document.querySelectorAll('[data-cc]:checked').length;$('ty-cc').textContent=`${n} of 5 done`+(n===5?'. You\'re in good shape to apply.':'');}},
 down:{h:slider('ty-price','Home price',80000,600000,5000,250000,'usd')+slider('ty-dp','Down payment',0,25,0.5,5,'pct')+'<ul class="opts-list" id="ty-dl"></ul>',
  f:()=>{const pr=+$('ty-price').value,dp=+$('ty-dp').value;$('ty-dp-o').textContent=dp+'% · '+usd(pr*dp/100);
   const L=[['VA loan (eligible veterans)',0],['USDA loan (eligible areas)',0],['Conventional (some programs)',3],['FHA loan',3.5],['Conventional without PMI',20]];
   $('ty-dl').innerHTML=L.map(([n,m])=>`<li><span class="mk${dp>=m?'':' off'}">${dp>=m?'✓':'–'}</span>${n} <span class="fine">· from ${m}%</span></li>`).join('');}},
 term:{h:slider('ty-amt','Loan amount',50000,700000,5000,220000,'usd')+slider('ty-r30','Example 30-year rate',3,9,0.125,6.5,'rate')+slider('ty-r15','Example 15-year rate',3,9,0.125,5.875,'rate')+'<div class="stats" id="ty-tt"></div>',
  f:()=>{const a=+$('ty-amt').value,p30=pmt(a,+$('ty-r30').value,30),p15=pmt(a,+$('ty-r15').value,15),i30=p30*360-a,i15=p15*180-a;
   $('ty-tt').innerHTML=`<div><small>30-year payment</small><b class="num">${usd(p30)}</b></div><div><small>15-year payment</small><b class="num">${usd(p15)}</b></div><div><small>Interest saved with 15</small><b class="num">${usd(i30-i15)}</b></div>`;}},
 points:{h:slider('ty-pa','Loan amount',50000,700000,5000,240000,'usd')+slider('ty-pp','Points',0,3,0.5,1,'num')+slider('ty-pr','Rate drop per point (example)',0.125,0.375,0.125,0.25,'rate')+'<div class="stats" id="ty-po"></div>',
  f:()=>{const a=+$('ty-pa').value,pp=+$('ty-pp').value,dr=+$('ty-pr').value,base=6.75,cost=a*pp/100,s=pmt(a,base,30)-pmt(a,base-pp*dr,30),be=s>0?Math.ceil(cost/s):0;
   $('ty-po').innerHTML=`<div><small>Cost up front</small><b class="num">${usd(cost)}</b></div><div><small>Monthly savings</small><b class="num">${usd(s)}</b></div><div><small>Break-even</small><b class="num">${pp?be+' months':'n/a'}</b></div>`;}},
 closing:{h:slider('ty-ca','Loan amount',50000,700000,5000,240000,'usd')+'<div class="big num" id="ty-co" style="font-size:2rem"></div><p class="fine">Typical range of about 2% to 5%. Your Loan Estimate shows your actual costs.</p>',
  f:()=>{const a=+$('ty-ca').value;$('ty-co').textContent=usd(a*.02)+' – '+usd(a*.05);}}};
const FMT={usd:v=>usd(v),pct:v=>v+'%',rate:v=>(+v).toFixed(3)+'%',num:v=>v};
function renderLessonNav(){$('lessonNav').innerHTML=`<p class="flabel">Homebuying 101</p><div class="prog"><span style="width:${done.size/LESSONS.length*100}%"></span></div><p class="fine" style="margin:-8px 0 8px">${done.size} of ${LESSONS.length} lessons complete</p>`+
  LESSONS.map((l,i)=>`<button data-go="${i}" aria-current="${i===curLesson}" class="${done.has(i)?'done':''}"><span class="dot">${done.has(i)?'✓':i+1}</span><span>${l.t}<small>${l.min} min</small></span></button>`).join('');}
function renderLesson(){
  const L=LESSONS[curLesson],tr=TRY[L.try];renderLessonNav();
  $('lesson').innerHTML=`<div><p class="eyebrow">Lesson ${curLesson+1} of ${LESSONS.length} · ${L.min} min</p><h2 style="margin-top:6px">${L.t}</h2></div>
   <div class="body">${L.body.map(p=>`<p>${T(esc(p).replace(/\{([^|}]+)\|([^}]+)\}/g,'{$1|$2}'))}</p>`).join('')}</div>
   <div class="box key"><h4>Key takeaways</h4><ul class="checks">${L.key.map(k=>`<li><span class="mk">✓</span>${esc(k)}</li>`).join('')}</ul></div>
   <div class="box"><h4>Try it</h4>${tr.h}</div>
   <div class="box"><h4>Check yourself</h4><p style="margin-bottom:12px">${esc(L.q[0])}</p><div class="quiz" id="quiz">${L.q[1].map((o,k)=>`<button data-k="${k}">${esc(o)}</button>`).join('')}<p class="fb" id="fb" aria-live="polite"></p></div></div>
   <div class="lnav"><button class="btn btn-line" data-go="${curLesson-1}" ${curLesson?'':'style="visibility:hidden"'}>← Previous</button>
   ${curLesson<LESSONS.length-1?`<button class="btn btn-primary" id="lessonDone">Mark complete and continue →</button>`:`<button class="btn btn-primary" id="lessonDone">Finish the course</button>`}</div>`;
  $('lesson').querySelectorAll('input[type=range]').forEach(r=>{const up=()=>{const o=$(r.id+'-o');if(o)o.textContent=FMT[r.dataset.fmt](+r.value);tr.f();};r.addEventListener('input',up);up();});
  $('lesson').querySelectorAll('[data-cc]').forEach(c=>c.addEventListener('change',tr.f));tr.f();
  $('quiz').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const k=+b.dataset.k,ok=k===L.q[2];$('quiz').querySelectorAll('button').forEach(x=>x.classList.remove('right','wrong'));b.classList.add(ok?'right':'wrong');$('fb').textContent=ok?L.q[3]:'Not quite. Try another answer.';});
  $('lessonDone').onclick=()=>{done.add(curLesson);store.set('rhm-learn',[...done]);if(curLesson<LESSONS.length-1){curLesson++;renderLesson();$('lesson').scrollIntoView({behavior:smooth(),block:'start'});}else{renderLessonNav();
    demoFinish();}};
}
function demoFinish(){const a=document.createElement('a');a.className='btn btn-primary';a.href='#start';a.textContent='Get pre-qualified';a.onclick=closeModal;demo('You finished Homebuying 101','Nice work. You know more about mortgages than most first-time buyers. When you\'re ready, the pre-qualification takes about two minutes.',null,[a]);}
document.addEventListener('click',e=>{const g=e.target.closest('#lessonNav [data-go], .lnav [data-go]');if(!g)return;curLesson=+g.dataset.go;renderLesson();});

/* ---------- payment calculator + amortization ---------- */
let term=30;
document.querySelectorAll('#terms button').forEach(b=>b.addEventListener('click',()=>{term=+b.dataset.t;document.querySelectorAll('#terms button').forEach(x=>x.setAttribute('aria-checked',x===b));calc();}));
['price','down','rate'].forEach(id=>$(id).addEventListener('input',calc));
function calc(){const price=+$('price').value,dp=+$('down').value,rate=+$('rate').value,loan=price*(1-dp/100),tax=price*0.019/12;
  $('o-price').textContent=usd(price);$('o-down').textContent=dp+'% · '+usd(price*dp/100);$('o-rate').textContent=rate.toFixed(3)+'%';
  [30,20,15].forEach(t=>$('t'+t).textContent=usd(pmt(loan,rate,t)+tax));
  const pi=pmt(loan,rate,term);$('pay').textContent=usd(pi+tax)+'/mo';$('pp-pi').textContent=usd(pi);$('pp-ti').textContent=usd(tax);$('pp-int').textContent=usd(pi*term*12-loan);
  const yrs=[];let bal=loan,m=rate/100/12;for(let y=0;y<term;y++){let ip=0,pp=0;for(let k=0;k<12;k++){const i=bal*m;ip+=i;pp+=pi-i;bal-=pi-i;}yrs.push([pp,ip]);}
  const W=600,H=220,pl=46,pr=8,pt=10,pb=26,mx=pi*12,bw=(W-pl-pr)/term;
  let g=`<text x="${pl-6}" y="${pt+8}" text-anchor="end">${usd(mx)}</text><text x="${pl-6}" y="${H-pb}" text-anchor="end">$0</text>`;
  yrs.forEach(([pp,ip],y)=>{const x=pl+y*bw+1,hp=pp/mx*(H-pt-pb),hi=ip/mx*(H-pt-pb);g+=`<rect x="${x}" y="${H-pb-hp}" width="${bw-2}" height="${hp}" style="fill:var(--forest)"/><rect x="${x}" y="${H-pb-hp-hi}" width="${bw-2}" height="${hi}" style="fill:var(--sand)"/>`;});
  [1,Math.round(term/3),Math.round(term*2/3),term].forEach(y=>g+=`<text x="${pl+(y-.5)*bw}" y="${H-8}" text-anchor="middle">Yr ${y}</text>`);
  $('amort').innerHTML=g;const cross=yrs.findIndex(([pp,ip])=>pp>=ip);
  $('amortNote').textContent=`In year 1, ${Math.round(yrs[0][1]/(pi*12)*100)}% of your payments go to interest.`+(cross>0?` From year ${cross+1}, most of each payment pays down your loan.`:' Most of each payment pays down your loan from the start.');}
function afford(){const inc=+$('af-inc').value,debt=+$('af-debt').value,down=+$('af-down').value,rate=+$('af-rate').value;
  $('af-inc-o').textContent=usd(inc);$('af-debt-o').textContent=usd(debt)+'/mo';$('af-down-o').textContent=usd(down);$('af-rate-o').textContent=rate.toFixed(3)+'%';
  const M=Math.max(0,inc/12*0.43-debt),f=pmt(1,rate,30),price=Math.max(0,(M+f*down)/(f+0.019/12));const lo=Math.round(price*0.9/5000)*5000,hi=Math.round(price/5000)*5000;
  $('af-price').textContent=hi>0?usd(lo)+' – '+usd(hi):'$0';$('af-pay').textContent='Housing budget about '+usd(M)+'/mo including taxes and insurance.';}
['af-inc','af-debt','af-down','af-rate'].forEach(id=>$(id).addEventListener('input',afford));

/* ---------- local help ---------- */
const NEEDS={dpa:'Down payment help',edu:'Education',credit:'Credit',vets:'Veterans',rural:'Rural homes',prop:'Property & taxes',verify:'Check a lender'};
const STATES={OH:'Ohio',KY:'Kentucky',IN:'Indiana',US:'Nationwide'};
const DIR=[
 ['ohfa','Ohio Housing Finance Agency','https://ohiohome.org','OH',['dpa','edu'],'Ohio\'s first-time buyer loans, down payment assistance and homebuyer education.','First-time buyers in Ohio'],
 ['khc','Kentucky Housing Corporation','https://www.kyhousing.org','KY',['dpa','edu'],'Kentucky\'s homebuyer loan programs and down payment assistance.','First-time buyers in Kentucky'],
 ['ihcda','Indiana Housing & Community Development Authority','https://www.in.gov/ihcda','IN',['dpa'],'Indiana\'s homebuyer programs and down payment assistance.','Buyers in Indiana'],
 ['hud','HUD-approved housing counselors','https://www.hud.gov/findacounselor','US',['edu','credit'],'Find a free or low-cost housing counselor near you.','Homebuyer classes, budgeting and credit help'],
 ['cfpb','CFPB: Buying a house','https://www.consumerfinance.gov/owning-a-home/','US',['edu'],'The Consumer Financial Protection Bureau\'s step-by-step guide and tools.','Understanding your Loan Estimate'],
 ['fmac','Freddie Mac My Home','https://myhome.freddiemac.com','US',['edu','credit'],'Free homebuyer education and credit guides from Freddie Mac.','Learning at your own pace'],
 ['acr','AnnualCreditReport.com','https://www.annualcreditreport.com','US',['credit'],'The official site for free credit reports from all three bureaus.','Checking your credit before you apply'],
 ['va','VA home loans','https://www.va.gov/housing-assistance/home-loans/','US',['vets'],'Check eligibility and request your Certificate of Eligibility.','Veterans, service members and surviving spouses'],
 ['usda','USDA property eligibility map','https://eligibility.sc.egov.usda.gov','US',['rural'],'Check whether an address qualifies for a zero-down USDA loan.','Buying outside the city'],
 ['bca','Butler County Auditor','https://www.butlercountyauditor.org','OH',['prop'],'Property values, tax records and sales history for Middletown and Butler County.','Researching a home\'s taxes'],
 ['hca','Hamilton County Auditor','https://www.hamiltoncountyauditor.org','OH',['prop'],'Property values and tax records for Cincinnati and Hamilton County.','Researching homes in Cincinnati'],
 ['fema','FEMA flood maps','https://msc.fema.gov','US',['prop'],'Look up a home\'s flood zone before you make an offer.','Knowing if you\'ll need flood insurance'],
 ['nmls','NMLS Consumer Access','https://www.nmlsconsumeraccess.org','US',['verify'],'Check that any mortgage company or loan officer is licensed. You can look up Reliant here too.','Checking a lender before you share information']];
let dS='',dN='',dQ='';const saved=store.get('rhm-checklist',{});
$('dState').innerHTML='<button class="chip" aria-pressed="true" data-v="">All states</button>'+['OH','KY','IN'].map(s=>`<button class="chip" aria-pressed="false" data-v="${s}">${STATES[s]}</button>`).join('');
$('dNeed').innerHTML='<button class="chip" aria-pressed="true" data-v="">Everything</button>'+Object.entries(NEEDS).map(([k,v])=>`<button class="chip" aria-pressed="false" data-v="${k}">${v}</button>`).join('');
['dState','dNeed'].forEach(id=>$(id).addEventListener('click',e=>{const c=e.target.closest('.chip');if(!c)return;if(id==='dState')dS=c.dataset.v;else dN=c.dataset.v;$(id).querySelectorAll('.chip').forEach(x=>x.setAttribute('aria-pressed',x===c));renderDir();}));
$('dSearch').addEventListener('input',e=>{dQ=e.target.value.trim().toLowerCase();renderDir();});
function renderDir(){const list=DIR.filter(d=>(!dS||d[3]===dS||d[3]==='US')&&(!dN||d[4].includes(dN))&&(!dQ||(d[1]+' '+d[5]).toLowerCase().includes(dQ)));
  $('dCount').textContent=`${list.length} resource${list.length===1?'':'s'}`+(dS?` for ${STATES[dS]} buyers`:'');
  $('dList').innerHTML=list.map(d=>`<article class="dcard"><div class="tags"><span>${STATES[d[3]]}</span>${d[4].map(n=>`<span>${NEEDS[n]}</span>`).join('')}</div><h4>${esc(d[1])}</h4><p>${esc(d[5])}</p><p class="good"><b>Good for:</b> ${esc(d[6])}</p>
    <div class="acts"><a href="${d[2]}" target="_blank" rel="noopener">Visit site ↗</a><button class="save" data-save="${d[0]}" aria-pressed="${!!saved[d[0]]}">${saved[d[0]]?'Saved':'Save to checklist'}</button></div></article>`).join('')||'<p class="muted">Nothing matches. Try fewer filters.</p>';}
function renderChk(){const ids=Object.keys(saved),n=ids.filter(k=>saved[k]==='done').length;
  $('chkMeta').textContent=ids.length?`${n} of ${ids.length} done`:'Save resources and check them off as you go.';
  $('chkList').innerHTML=ids.map(k=>{const d=DIR.find(x=>x[0]===k);return d?`<li class="${saved[k]==='done'?'done':''}"><input type="checkbox" data-done="${k}" ${saved[k]==='done'?'checked':''} aria-label="Mark ${esc(d[1])} done"><span>${esc(d[1])}</span><button data-rm="${k}" aria-label="Remove">×</button></li>`:'';}).join('');}
document.addEventListener('click',e=>{const s=e.target.closest('[data-save]');if(s){const k=s.dataset.save;if(saved[k])delete saved[k];else saved[k]='todo';store.set('rhm-checklist',saved);renderDir();renderChk();}
  const r=e.target.closest('[data-rm]');if(r){delete saved[r.dataset.rm];store.set('rhm-checklist',saved);renderDir();renderChk();}});
document.addEventListener('change',e=>{const d=e.target.closest('[data-done]');if(!d)return;saved[d.dataset.done]=d.checked?'done':'todo';store.set('rhm-checklist',saved);renderChk();});
const PROS=[
 ['Real estate agents','Finds homes, writes your offer and negotiates the price.','Bring one in before you start touring. Your pre-qualification letter goes with your offer.'],
 ['Home inspectors','Checks the home\'s condition, from roof to furnace.','After your offer is accepted, during the inspection period in your contract.'],
 ['Homeowners insurance','Protects the home and is required for your loan.','Get quotes once you\'re under contract. We need proof before closing.'],
 ['Title & closing','Researches ownership records, provides title insurance and often hosts your closing.','Usually chosen when you go under contract.'],
 ['Real estate attorneys','Help with contracts, estates or anything unusual about a property.','Whenever something in the deal feels complicated.'],
 ['Contractors & movers','Handle repairs from the inspection and help you move in.','Between closing and move-in day.']];
let proK=0;
$('proCats').innerHTML=PROS.map((p,i)=>`<button class="chip" aria-pressed="${i===0}" data-pk="${i}">${p[0]}</button>`).join('');
$('proCats').addEventListener('click',e=>{const c=e.target.closest('.chip');if(!c)return;proK=+c.dataset.pk;$('proCats').querySelectorAll('.chip').forEach(x=>x.setAttribute('aria-pressed',x===c));renderPros();});
function renderPros(){const p=PROS[proK];$('proPanel').innerHTML=`<div class="grid2" style="margin-top:24px;align-items:start"><div class="card"><h3>${p[0]}</h3><p style="margin-top:10px"><b>What they do:</b> ${esc(p[1])}</p><p style="margin-top:8px"><b>When you'll need one:</b> ${esc(p[2])}</p><button class="btn btn-primary" style="margin-top:18px" data-demo="intro">Ask for an introduction</button></div>
  <div style="display:grid;gap:12px"><div class="slotp"><b>Partner name</b><br>Company · Phone · Area served</div><div class="slotp"><b>Partner name</b><br>Company · Phone · Area served</div><p class="fine">Demo layout. Reliant adds the partners they already refer clients to.</p></div></div>`;}

/* ---------- hero: the model home, turnable ---------- */
const HOUSE_VIEWS=Array.from({length:36},(_,i)=>{const p=String(i).padStart(3,'0');return {f:`images/turn/turn-${p}.webp`,s:`images/turn/sm/turn-${p}.webp`,a:i*10};});
(()=>{const box=$('hphoto');try{const tt=Turntable.create(box,$('hcanvas'),HOUSE_VIEWS,{reduced,flow:'images/turn/flow.bin'});if(!tt)box.classList.add('static');window.__turntable=tt;}catch(e){box.classList.add('static');}})();

/* ---------- knock, the door opens, walk inside ---------- */
let soundOn=true;
/* The sound of the door, all synthesized: evening air on the porch, three knuckle raps on a solid
   wood door, footsteps inside, the deadbolt and latch, air moving as the door swings, then the fire.
   doorAudio(ctx) also runs in an OfflineAudioContext, so it can be rendered to a file and checked. */
function doorAudio(ac){
  const sr=ac.sampleRate,out=ac.createGain();out.gain.value=soundOn?1:0;
  const comp=ac.createDynamicsCompressor();comp.threshold.value=-12;comp.ratio.value=4;out.connect(comp).connect(ac.destination);
  const buf=(sec,fill)=>{const n=Math.floor(sr*sec),b=ac.createBuffer(1,n,sr);fill(b.getChannelData(0),n);return b;};
  const white=buf(2,(d,n)=>{for(let i=0;i<n;i++)d[i]=Math.random()*2-1;});
  // a small porch: a short cloud of soft reflections
  const verb=ac.createConvolver();verb.buffer=(()=>{const n=Math.floor(sr*.5),b=ac.createBuffer(2,n,sr);for(let c=0;c<2;c++){const d=b.getChannelData(c);let lp=0;for(let i=0;i<n;i++){lp+=(Math.random()*2-1-lp)*.3;d[i]=lp*Math.exp(-i/sr/.07);}}return b;})();
  const wet=ac.createGain();wet.gain.value=.5;verb.connect(wet).connect(out);
  const bus=(level,rev,lp)=>{const g=ac.createGain();g.gain.value=level;let head=g;if(lp){head=ac.createBiquadFilter();head.type='lowpass';head.frequency.value=lp;head.connect(g);}
    g.connect(out);if(rev){const s=ac.createGain();s.gain.value=rev;g.connect(s).connect(verb);}return head;};
  function tone(t,f,tau,amp,dest,f2){const o=ac.createOscillator(),g=ac.createGain();o.frequency.setValueAtTime(f,t);if(f2)o.frequency.exponentialRampToValueAtTime(f2,t+tau*3);
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(amp,t+.0012);g.gain.setTargetAtTime(0,t+.0012,tau);o.connect(g).connect(dest);o.start(t);o.stop(t+tau*8+.02);}
  function burst(t,tau,amp,dest,type,f,q){const s=ac.createBufferSource(),fl=ac.createBiquadFilter(),g=ac.createGain();s.buffer=white;fl.type=type;fl.frequency.value=f;fl.Q.value=q||.7;
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(amp,t+.0008);g.gain.setTargetAtTime(0,t+.0008,tau);s.connect(fl).connect(g).connect(dest);s.start(t,Math.random()*1.5);s.stop(t+tau*8+.02);}
  // a solid painted door: a few low panel modes that die fast, a dull knuckle click, the weight of the hand
  const MODES=[[98,.05,1],[174,.036,.75],[251,.028,.6],[372,.02,.42],[528,.014,.3],[742,.009,.2],[1060,.006,.12]];
  function knock(t,i){const v=[1,.84,.92][i]||.9,d=1+(Math.random()-.5)*.05,g=bus(.34*v,.55);
    MODES.forEach(([f,tau,a])=>tone(t,f*d,tau*(.9+Math.random()*.2),a*.42,g));
    tone(t,130*d,.022,.8,g,62);burst(t,.0035,.9,g,'bandpass',1700*d,.9);burst(t,.012,.55,g,'lowpass',380);}
  // footsteps on a wood floor, heard through the door: heel, then toe, getting closer
  const inside=bus(.55,.35,420);
  function step(t,i){const v=[.3,.5,.75][i]||.6;tone(t,72,.028,.45*v,inside,46);burst(t,.012,.8*v,inside,'lowpass',650);burst(t+.075,.009,.4*v,inside,'lowpass',950);}
  // small brass parts: a couple of inharmonic partials over a sharp click
  function metal(t,f,amp,dest){[[1,.018],[2.71,.01],[5.2,.006]].forEach(([m,tau])=>tone(t,f*m,tau,amp/Math.sqrt(m),dest));burst(t,.0025,amp*1.1,dest,'bandpass',f*1.4,1.5);}
  function bolt(t){const g=bus(.2,.4,3400);burst(t,.008,.45,g,'bandpass',850,1.1);metal(t+.1,1780,.55,g);burst(t+.1,.006,.6,g,'lowpass',480);}
  function latch(t){const g=bus(.22,.35);metal(t,2250,.45,g);metal(t+.05,2600,.3,g);burst(t,.004,.35,g,'lowpass',650);}
  // the weatherstrip lets go, then air moves with the door (the same spring the picture uses)
  function swing(t){tone(t,82,.03,.12,bus(1,.2));const s=ac.createBufferSource(),f=ac.createBiquadFilter(),g=ac.createGain();s.buffer=white;s.loop=true;f.type='bandpass';f.Q.value=.5;
    const dur=1.8,N=90,c=new Float32Array(N);let mx=0;for(let k=0;k<N;k++){const u=k/(N-1)*dur;c[k]=Math.exp(-3.36*u)*Math.sin(2.52*u);mx=Math.max(mx,c[k]);}for(let k=0;k<N;k++)c[k]=c[k]/mx*.06;
    g.gain.setValueCurveAtTime(c,t,dur);f.frequency.setValueAtTime(260,t);f.frequency.linearRampToValueAtTime(620,t+.3);f.frequency.linearRampToValueAtTime(300,t+dur);
    s.connect(f).connect(g).connect(bus(1,.3));s.start(t);s.stop(t+dur+.05);}
  // beds: evening air outside, the fire inside (a low roar plus sparse crackles)
  const loop=(b,type,f,level,dest)=>{const s=ac.createBufferSource(),fl=ac.createBiquadFilter(),g=ac.createGain();s.buffer=b;s.loop=true;fl.type=type;fl.frequency.value=f;g.gain.value=level;s.connect(fl).connect(g).connect(dest);s.start(0,Math.random());};
  const air=ac.createGain(),room=ac.createGain();air.gain.value=0;room.gain.value=0;air.connect(out);room.connect(out);
  const airBand=ac.createBiquadFilter();airBand.type='highpass';airBand.frequency.value=90;airBand.connect(air);loop(white,'lowpass',650,.1,airBand);
  const crackle=buf(6,(d,n)=>{for(let x=.05;x<5.9;x+=-Math.log(1-Math.random())/6){const a=Math.pow(Math.random(),2.4),len=Math.floor(sr*(.002+Math.random()*.01)),s0=Math.floor(x*sr);for(let k=0;k<len&&s0+k<n;k++)d[s0+k]+=(Math.random()*2-1)*a*Math.exp(-k/(len/4));}});
  loop(white,'lowpass',170,.45,room);loop(crackle,'highpass',700,.28,room);
  const to=(p,v,tau)=>p.setTargetAtTime(v,ac.currentTime,tau);
  return {
    cue(name,i,delay){const t=ac.currentTime+(delay||0);
      if(name==='start')to(air.gain,1,.6);
      else if(name==='knock')knock(t,i);else if(name==='step')step(t,i);else if(name==='bolt')bolt(t);else if(name==='latch')latch(t);
      else if(name==='swing'){swing(t);air.gain.setTargetAtTime(.5,t,.5);room.gain.setTargetAtTime(.45,t,.5);}
      else if(name==='inside'){air.gain.setTargetAtTime(0,t,.8);room.gain.setTargetAtTime(.8,t,.8);}},
    mute(m){to(out.gain,m?0:1,.05);},
    stop(){to(out.gain,0,.15);if(ac.close)setTimeout(()=>ac.close().catch(()=>{}),1000);}};
}
function playDoor(name,done){
  if(reduced()){done();return;}
  let snd=null;try{const ac=new (window.AudioContext||window.webkitAudioContext)();ac.resume();snd=doorAudio(ac);}catch(e){snd=null;}
  const ds=document.createElement('div');ds.className='ds';ds.setAttribute('role','dialog');ds.setAttribute('aria-modal','true');ds.setAttribute('aria-label','Welcome home');ds.tabIndex=-1;
  ds.innerHTML=`<div class="ds-view"></div><i class="ds-vig"></i><p class="ds-load" aria-live="polite">Opening the door…</p>
   <div class="ds-ui"><p class="ds-cap"></p><div class="ds-actions"><button class="btn btn-white btn-lg" data-ds="go">See my results →</button><p class="ds-hint">Move or drag to look around</p></div></div>
   <div class="ds-top"><button data-ds="sound">Sound on</button><button data-ds="go">Skip</button></div>`;
  document.body.appendChild(ds);requestAnimationFrame(()=>ds.classList.add('on'));ds.focus({preventScroll:true});
  const q=x=>ds.querySelector(x);let P=null,stopped=false;
  function finish(){if(stopped)return;stopped=true;if(P)P.stop();if(snd)snd.stop();ds.classList.add('out');done();setTimeout(()=>ds.remove(),900);}
  ds.addEventListener('click',e=>{const b=e.target.closest('[data-ds]');if(!b)return;if(b.dataset.ds==='go')finish();if(b.dataset.ds==='sound'){soundOn=!soundOn;b.textContent=soundOn?'Sound on':'Sound off';if(snd)snd.mute(!soundOn);}});
  ds.addEventListener('keydown',e=>{if(e.key==='Escape')finish();});
  Promise.race([Walk.preload().then(a=>a.every(Boolean)),new Promise(r=>setTimeout(()=>r(false),7000))]).then(ok=>{
    if(stopped)return;if(!ok){finish();return;}q('.ds-load').remove();
    P=Walk.play(q('.ds-view'),{cap:q('.ds-cap'),capA:'<small>Your results are ready</small><span class="kk">Knock,</span> <span class="kk">knock.</span>',capB:`<small>Reliant Home Mortgage</small>Welcome home${name?', '+esc(name):''}.`,cue:snd?snd.cue:null,
      onExplore(){q('.ds-actions').classList.add('show');setTimeout(()=>{const g=q('.ds-actions button');if(g&&!stopped)g.focus({preventScroll:true});},60);}});
    if(!P){finish();return;}window.__walk=P;P.start();});
}

/* ---------- pre-qualification ---------- */
const money=v=>usd(v);
const Q=[
  {id:'goal',lab:'Looking to',type:'choice',big:1,q:'What can we help you with?',opts:[['Buying a home','First home, next home or relocating'],['Refinancing','Lower payment, cash out or a shorter term']]},
  {id:'stage',lab:'Where you are',when:a=>a.goal==='Buying a home',type:'choice',q:'Where are you in the process?',opts:[['Just exploring',"Seeing what's possible"],['Looking at homes','Touring and comparing'],['Ready to make an offer','Found the one'],['Under contract','Need financing now']]},
  {id:'first',lab:'First home',when:a=>a.goal==='Buying a home',type:'choice',q:'Is this your first home?',opts:[['Yes, first home'],["No, I've owned before"]]},
  {id:'price',lab:'Price range',when:a=>a.goal==='Buying a home',type:'range',q:'What price range are you considering?',min:80000,max:900000,step:5000,value:250000,fmt:money},
  {id:'down',lab:'Down payment',when:a=>a.goal==='Buying a home',type:'range',q:'How much could you put down?',help:'Include savings and any gift funds from family.',min:0,max:100000,step:1000,value:12000,fmt:money},
  {id:'rgoal',lab:'Refinance goal',when:a=>a.goal==='Refinancing',type:'choice',q:'What would you like your refinance to do?',opts:[['Lower my payment'],['Pay off my home sooner'],['Take cash out'],['Consolidate debt'],['Drop mortgage insurance'],['Switch from an ARM to fixed']]},
  {id:'value',lab:'Home value',when:a=>a.goal==='Refinancing',type:'range',q:'About what is your home worth today?',min:80000,max:900000,step:5000,value:275000,fmt:money},
  {id:'bal',lab:'Loan balance',when:a=>a.goal==='Refinancing',type:'range',q:'What do you still owe on your mortgage?',min:0,max:800000,step:5000,value:180000,fmt:money},
  {id:'rate',lab:'Current rate',when:a=>a.goal==='Refinancing',type:'range',q:'What is your current interest rate?',min:2.5,max:10,step:0.125,value:7.25,fmt:v=>v.toFixed(3)+'%'},
  {id:'cash',lab:'Cash out',when:a=>a.goal==='Refinancing'&&(a.rgoal==='Take cash out'||a.rgoal==='Consolidate debt'),type:'range',q:'How much cash would you like?',min:5000,max:200000,step:2500,value:30000,fmt:money},
  {id:'credit',lab:'Credit',type:'choice',q:'How would you describe your credit?',opts:[['Excellent','740 or higher'],['Good','680 to 739'],['Fair','620 to 679'],['Rebuilding','Below 620'],['Not sure',"That's fine"]]},
  {id:'mil',lab:'Military service',type:'choice',q:'Have you served in the military?',help:'Veterans, active duty and some surviving spouses may qualify for VA loans.',opts:[['Yes'],['No']]},
  {id:'work',lab:'Income',when:a=>a.goal==='Buying a home',type:'choice',q:'How do you earn your income?',opts:[['Employed (W-2)'],['Self-employed'],['Retired or fixed income'],['Medical professional']]},
  {id:'area',lab:'Where',when:a=>a.goal==='Buying a home',type:'choice',q:'Where are you hoping to buy?',opts:[['In town','Middletown, Hamilton, suburbs'],['Rural or small town','Outside city limits'],['Not sure yet']]},
  {id:'age',lab:'62 or older',when:a=>a.goal==='Refinancing',type:'choice',q:'Is any borrower 62 or older?',opts:[['Yes'],['No']]},
  {id:'contact',type:'contact',q:'Where should we send your results?'},
  {id:'review',type:'review',q:'Check your answers'}];
const ans={quote:true};Q.forEach(s=>{if(s.type==='range')ans[s.id]=s.value;});
let qi=0,busy=false,wantQuote=false,editing=false;
const vis=()=>Q.filter(s=>!s.when||s.when(ans));
const nQs=()=>vis().filter(s=>s.type==='choice'||s.type==='range').length;
function presetGoal(g){if(!$('pqResults').hidden)return;if(g==='rates'){wantQuote=true;ans.quote=true;return;}ans.goal=g==='refi'?'Refinancing':'Buying a home';qi=1;}
const GROUPS=[['Your plans',['goal','stage','first','rgoal']],['Your home and loan',['price','down','value','bal','rate','cash','area']],['About you',['credit','mil','work','age']]];
const fmtAns=s=>s.type==='range'?s.fmt(ans[s.id]):(ans[s.id]||'Not answered');
function contactRows(){return [['Name',ans.name],['Phone',ans.phone],['Email',ans.email],['Loan officer',ans.lo?TEAM[+ans.lo].n:'First available'],['Personal rate quote',ans.quote?'Yes, include one':'No thanks']].filter(x=>x[1]);}
function reviewHTML(ed){const byId=Object.fromEntries(vis().map(s=>[s.id,s]));let h='<div class="rv">';
  for(const [g,ids] of GROUPS){const rows=ids.filter(i=>byId[i]);if(!rows.length)continue;
    h+=`<section><h4>${g}</h4><dl>${rows.map(i=>{const s=byId[i];return `<div class="r"><dt>${s.lab}</dt><dd>${esc(fmtAns(s))}</dd>${ed?`<button class="ed" data-edit="${i}" aria-label="Edit ${esc(s.lab)}">Edit</button>`:'<span></span>'}</div>`;}).join('')}</dl></section>`;}
  h+=`<section><h4>How we'll reach you</h4><dl>${contactRows().map(([k,v])=>`<div class="r"><dt>${k}</dt><dd>${esc(v)}</dd>${ed?`<button class="ed" data-edit="contact" aria-label="Edit ${k}">Edit</button>`:'<span></span>'}</div>`).join('')}</dl></section></div>`;return h;}
function drawQ(){
  const V=vis();if(qi>=V.length)qi=V.length-1;const s=V[qi];const W=$('wiz');let body='',step='';
  const qn=V.slice(0,qi+1).filter(x=>x.type==='choice'||x.type==='range').length;
  if(s.type==='choice'){step=`Question ${qn} of ${nQs()}`;body=`<div class="opts${s.big?' big':''}">${s.opts.map(o=>`<button class="opt" aria-pressed="${ans[s.id]===o[0]}" data-v="${esc(o[0])}"><b>${esc(o[0])}</b>${o[1]?`<small>${esc(o[1])}</small>`:''}</button>`).join('')}</div>`;}
  else if(s.type==='range'){step=`Question ${qn} of ${nQs()}`;body=`<div class="wiz-range"><output class="num"></output><input type="range" min="${s.min}" max="${s.max}" step="${s.step}" value="${ans[s.id]}" aria-label="${esc(s.q)}"><div class="fine" style="display:flex;justify-content:space-between;margin-top:6px"><span>${s.fmt(s.min)}</span><span>${s.fmt(s.max)}</span></div></div>`;}
  else if(s.type==='contact'){step='Almost done';body=`<form novalidate><div class="row2"><div class="field"><label for="pq-name">First name</label><input class="in" id="pq-name" autocomplete="given-name" value="${esc(ans.name||'')}"></div>
      <div class="field"><label for="pq-phone">Phone</label><input class="in" id="pq-phone" type="tel" autocomplete="tel" value="${esc(ans.phone||'')}"></div></div>
      <div class="field"><label for="pq-email">Email</label><input class="in" id="pq-email" type="email" autocomplete="email" value="${esc(ans.email||'')}"></div>
      <div class="field"><label for="pq-lo">Who would you like to work with?</label><select class="in" id="pq-lo"><option value="">Whoever's available first</option>${TEAM.map((t,i)=>`<option value="${i}" ${(ans.lo===String(i)||(ans.lo===undefined&&preferLO===i))?'selected':''}>${t.n}</option>`).join('')}</select></div>
      <label class="quote" for="pq-quote"><input type="checkbox" id="pq-quote" ${ans.quote?'checked':''}><span><b>Include a personal rate quote</b><br><span class="fine">Your loan officer will quote today's rate for your situation.</span></span></label>
      <p class="err" id="pqErr" hidden></p><p class="fine">We'll only use this to send your results and follow up about your loan. No credit check.</p></form>`;}
  else {step='Last step';body=`<p class="muted" style="margin:-10px 0 18px">Make sure everything looks right. Tap Edit to change an answer.</p>${reviewHTML(true)}`;}
  const pct=Math.round(qi/(V.length-1)*100);
  const nav=s.type==='range'?`<button class="btn btn-primary" data-w="next">${editing?'Save and review →':'Continue →'}</button>`:s.type==='contact'?`<button class="btn btn-primary" data-w="toreview">Review my answers →</button>`:s.type==='review'?`<button class="btn btn-primary btn-lg" data-w="submit">See my results →</button>`:'<span class="fine">Pick one to continue</span>';
  W.innerHTML=`<div class="wiz-prog"><span style="width:${pct}%"></span></div><div class="wiz-body"><p class="wiz-step">${step}</p><h2 class="wiz-q">${esc(s.q)}</h2>${s.help?`<p class="muted" style="margin:-12px 0 18px">${esc(s.help)}</p>`:''}${body}
    <div class="wiz-nav"><button class="btn btn-line" data-w="back" ${qi?'':'style="visibility:hidden"'}>← Back</button>${nav}</div></div>`;
  if(s.type==='range'){const r=W.querySelector('input[type=range]'),o=W.querySelector('output');const up=()=>{ans[s.id]=+r.value;o.textContent=s.fmt(+r.value);};r.addEventListener('input',up);up();}
  if(s.type==='contact')W.querySelector('form').addEventListener('submit',e=>{e.preventDefault();toReview();});
}
const idxOf=id=>vis().findIndex(s=>s.id===id);
function nextQ(){const V=vis();if(editing){const r=idxOf('review');const nx=V[qi+1];
    // a changed answer can reveal a new question (like cash out); ask it before returning to review
    if(nx&&(nx.type==='choice'||nx.type==='range')&&ans[nx.id]===undefined){qi++;drawQ();return;}
    editing=false;qi=r;drawQ();return;}
  if(qi<V.length-1){qi++;drawQ();}}
function toReview(){saveContact();if(!ans.name){showErr('Please add your first name so your loan officer knows who to ask for.');return;}
  if(!ans.phone&&!ans.email){showErr('Please add a phone number or email so we can send your results.');return;}editing=false;qi=idxOf('review');drawQ();$('wiz').scrollIntoView({behavior:smooth(),block:'start'});}
$('wiz').addEventListener('click',e=>{
  const o=e.target.closest('.opt');if(o){if(busy)return;busy=true;const s=vis()[qi];ans[s.id]=o.dataset.v;$('wiz').querySelectorAll('.opt').forEach(x=>x.setAttribute('aria-pressed',x===o));setTimeout(()=>{busy=false;nextQ();},170);return;}
  const ed=e.target.closest('[data-edit]');if(ed){editing=ed.dataset.edit!=='contact';qi=idxOf(ed.dataset.edit);drawQ();return;}
  const w=e.target.closest('[data-w]');if(!w)return;
  if(w.dataset.w==='back'&&qi>0){saveContact();editing=false;qi--;drawQ();}else if(w.dataset.w==='next')nextQ();else if(w.dataset.w==='toreview')toReview();else if(w.dataset.w==='submit')submitPQ();});
function saveContact(){if(!$('pq-name'))return;ans.name=$('pq-name').value.trim();ans.phone=$('pq-phone').value.trim();ans.email=$('pq-email').value.trim();ans.lo=$('pq-lo').value;ans.quote=$('pq-quote').checked;}
let pqSave=null;
function submitPQ(){
  renderResults();
  const byId=Object.fromEntries(vis().map(s=>[s.id,s])),answers={};vis().forEach(s=>{if(s.type==='choice'||s.type==='range')answers[s.lab]=fmtAns(s);});
  pqSave=DB.insert('reliant_prequal',{goal:ans.goal||null,answers,first_name:ans.name||null,phone:ans.phone||null,email:ans.email||null,loan_officer:ans.lo?TEAM[+ans.lo].n:null,wants_quote:!!ans.quote});
  playDoor(ans.name,()=>{$('pqHead').hidden=true;$('pqForm').hidden=true;$('pqResults').hidden=false;window.scrollTo(0,0);
    const h=$('results').querySelector('h1');if(h){h.tabIndex=-1;h.focus({preventScroll:true});}
    setTimeout(async()=>{const r=await pqSave;demo('Pre-qualification sent',r&&r.ok?'This is a demo. Your answers were saved to the demo database. On the live site, your loan officer receives:':'This is a demo. On the live site, your loan officer receives:',summaryLines().join('\n'));},1300);});}
function showErr(m){const e=$('pqErr');e.textContent=m;e.hidden=false;}
function summaryLines(){const byId=Object.fromEntries(vis().map(s=>[s.id,s]));const out=[];
  for(const [g,ids] of GROUPS){const rows=ids.filter(i=>byId[i]);if(!rows.length)continue;out.push(g.toUpperCase());rows.forEach(i=>out.push('  '+byId[i].lab+': '+fmtAns(byId[i])));out.push('');}
  out.push("HOW WE'LL REACH YOU");contactRows().forEach(([k,v])=>out.push('  '+k+': '+v));return out;}
function renderResults(){
  const a=ans,buy=a.goal==='Buying a home',r=[];let big,sub,note;
  if(buy){const dp=a.down/a.price*100,loan=Math.max(0,a.price-a.down),pay=pmt(loan,6.5,30)+a.price*0.019/12;
    if(a.mil==='Yes')r.push('va-loans');if(a.area==='Rural or small town')r.push('usda-loan');if(a.credit==='Rebuilding'||a.credit==='Fair'||dp<5)r.push('fha-loans');
    if(a.first==='Yes, first home'&&dp<10)r.push('down-payment-assistance');if(a.work==='Self-employed')r.push('self-employed-loan');if(a.work==='Medical professional')r.push('doctor-loans');
    if(a.price>800000)r.push('jumbo-loans');if(a.credit==='Excellent'||a.credit==='Good')r.push('conventional-loans');if(!r.length)r.push('conventional-loans','fha-loans');
    big=usd(pay)+'<span style="font-size:1.1rem">/mo</span>';sub='Estimated payment';note=`On a ${usd(a.price)} home with ${usd(a.down)} down (${dp.toFixed(1)}%), a 30-year fixed at an example 6.5% rate, including taxes and insurance.`;}
  else{const cash=a.cash&&(a.rgoal==='Take cash out'||a.rgoal==='Consolidate debt')?a.cash:0,newLoan=a.bal+cash,ltv=a.value?newLoan/a.value*100:0,now=pmt(a.bal,a.rate,30),ex=Math.max(3,a.rate-1),nw=pmt(newLoan,ex,a.rgoal==='Pay off my home sooner'?15:30),d=nw-now;
    if(['Lower my payment','Pay off my home sooner','Drop mortgage insurance'].includes(a.rgoal))r.push('mortgage-refinance');if(a.rgoal==='Switch from an ARM to fixed')r.push('fixed-rate-mortgage','mortgage-refinance');
    if(cash)r.push('cash-out-refinance','heloc');if(a.mil==='Yes')r.push('va-loans');if(a.age==='Yes')r.push('reverse-mortgage');if(!r.length)r.push('mortgage-refinance');
    big=(d<=0?'↓ ':'↑ ')+usd(Math.abs(d))+'<span style="font-size:1.1rem">/mo</span>';sub='Estimated monthly change';note=`New loan of ${usd(newLoan)} (${ltv.toFixed(0)}% of your home's value) at an example ${ex.toFixed(3)}%, about 1% under your current rate. Principal and interest only.`+(ltv>80&&cash?' Most cash-out programs cap near 80% of value, so a HELOC may fit better.':'');}
  const recs=[...new Set(r)].slice(0,3),lo=ans.lo?[+ans.lo]:[];
  $('results').innerHTML=`<div class="res-hero"><p class="eyebrow">Pre-qualification complete</p><h1>Welcome home, ${esc(a.name)}.</h1><p class="muted" style="max-width:34em;font-size:1.08rem">Here's where you stand. ${lo.length===1?esc(TEAM[lo[0]].n.split(' ')[0])+' will':'A loan officer from our Middletown office will'} reach out to go over your numbers${wantQuote?' and your personal rate quote':' and today\'s rates'}.</p></div>
    <div class="grid2" style="align-items:start"><div style="display:grid;gap:18px">
      <div class="est"><span class="eyebrow">${sub}</span><div class="big num">${big}</div><p>${esc(note)}</p></div>
      <div class="card"><p class="flabel" style="margin-bottom:10px">Loans worth talking about</p><div class="rec">${recs.map((s,k)=>{const p=PBY[s];return `<div class="recitem" data-open="${k===0}"><button aria-expanded="${k===0}"><span><b>${esc(p.n)}</b><small>${esc(p.sum)}</small></span><span aria-hidden="true">＋</span></button><div class="more" ${k===0?'':'hidden'}><ul class="checks">${p.fit.map(x=>`<li><span class="mk">✓</span>${esc(x)}</li>`).join('')}</ul><a class="linkish" href="#program-${s}">More about ${esc(p.n)} →</a></div></div>`;}).join('')}</div></div></div>
    <div style="display:grid;gap:18px">
      <div class="card">${lo.length?`<p class="flabel">Your loan officer</p><div class="lo" style="margin-top:12px">${faceHTML(lo[0])}<div><h3>${TEAM[lo[0]].n}</h3><p class="fine num">NMLS ${TEAM[lo[0]].nmls}</p></div></div>
        <div class="btn-row" style="margin-top:20px"><button class="btn btn-primary" data-apply="${lo[0]}">Apply with ${TEAM[lo[0]].n.split(' ')[0]}</button><button class="btn btn-line num" data-demo="call">Call (513) 783-4018</button></div>`:`<p class="flabel">Your loan officer</p><p style="margin-top:10px">The first available licensed loan officer in our Middletown office will review your answers.</p>
        <div class="btn-row" style="margin-top:18px"><a class="btn btn-primary" href="#apply">Choose a loan officer</a><button class="btn btn-line num" data-demo="call">Call (513) 783-4018</button></div>`}</div>
      <div class="card"><p class="flabel">What happens next</p><ol class="next3" style="margin-top:12px"><li><span>1</span><p>Your loan officer reviews your answers and calls you.</p></li><li><span>2</span><p>You talk through programs and today's rates together.</p></li><li><span>3</span><p>When you're ready, apply online and we'll take it to closing.</p></li></ol>
        <p style="margin-top:16px"><a class="linkish" href="#learn">Take Homebuying 101 while you wait →</a></p></div>
      <details class="card"><summary class="flabel" style="cursor:pointer">Your answers</summary><div style="margin-top:14px">${reviewHTML(false)}</div><p style="margin-top:14px"><button class="linkish" id="redo">Change my answers</button></p></details></div></div>
    <p class="fine" style="text-align:center;margin-top:24px">Estimates only. Not a loan offer, approval or commitment to lend.</p>`;
  $('results').querySelectorAll('.recitem>button').forEach(b=>b.addEventListener('click',()=>{const it=b.parentElement,o=it.dataset.open!=='true';it.dataset.open=o;b.setAttribute('aria-expanded',o);it.querySelector('.more').hidden=!o;}));
  $('redo').onclick=()=>{$('pqHead').hidden=false;$('pqForm').hidden=false;$('pqResults').hidden=true;qi=0;drawQ();window.scrollTo(0,0);};
}

/* ---------- router ---------- */
const TABS={learn:'course',course:'course',rates:'rates',calculator:'calculator',glossary:'glossary'};
const ALIAS={purchase:'buy',programs:'loans',rates:'learn',calculator:'learn',glossary:'learn',course:'learn','local-resources':'local-help',professionals:'local-help',pros:'local-help',blog:'about',newsletter:'about',letter:'about',team:'about',family:'about',reviews:'about','review-us':'about'};
const SCROLL={professionals:'pros',pros:'pros',blog:'letter',newsletter:'letter',letter:'letter',reviews:'reviewsSec','review-us':'reviewUs'};
let curPage='home';
function route(){
  let h=decodeURIComponent(location.hash.slice(1))||'home',page=ALIAS[h]||h;
  if(h.startsWith('program-'))page=renderProgram(h.slice(8))?'program':'loans';
  if(LEGAL[h]){page='legal';$('legal-title').textContent=LEGAL[h][0];$('legal-crumb').textContent=LEGAL[h][0];$('legal-body').textContent=LEGAL[h][1];}
  let sec=document.querySelector(`.page[data-page="${page}"]`);if(!sec){sec=document.querySelector('.page[data-page="home"]');page='home';}
  curPage=page;document.querySelectorAll('.page').forEach(p=>p.hidden=p!==sec);
  if(page==='learn'){const tab=TABS[h]||'course';document.querySelectorAll('[data-tabpanel]').forEach(p=>p.hidden=p.dataset.tabpanel!==tab);document.querySelectorAll('.tabs a').forEach(a=>a.classList.toggle('on',a.dataset.tab===tab));if(tab==='course')renderLesson();if(tab==='glossary'){renderGloss();renderGDetail();}}
  if(page==='start')Walk.preload();
  if(page==='start'&&$('pqResults').hidden){drawQ();$('pqLede').textContent=wantQuote?'A few quick questions, then your results and a personal rate quote from your loan officer.':'A few quick questions, then your results. No Social Security number and no credit check.';}
  document.title=sec.dataset.title;
  const nav={program:'',loans:'',start:'',contact:'',apply:''}[page]??page;document.querySelectorAll('.mainnav a').forEach(a=>a.classList.toggle('on',a.dataset.nav===nav));
  $('ctaband').hidden=['start','contact','apply'].includes(page);updateCmp();hidePop();
  $('drawer').hidden=true;$('burger').setAttribute('aria-expanded','false');
  if(SCROLL[h])pendingScroll=SCROLL[h];
  const target=pendingScroll;pendingScroll=null;
  if(target&&$(target))requestAnimationFrame(()=>$(target).scrollIntoView({block:'start'}));else window.scrollTo(0,0);
}
addEventListener('hashchange',route);
$('burger').addEventListener('click',()=>{const o=$('drawer').hidden;$('drawer').hidden=!o;$('burger').setAttribute('aria-expanded',o);});

renderReviews();renderPrograms();renderFinder();breakeven();rates();renderGloss();renderGDetail();calc();afford();renderDir();renderChk();renderPros();
route();
