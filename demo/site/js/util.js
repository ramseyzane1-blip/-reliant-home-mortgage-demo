/* Shared helpers */
const $=id=>document.getElementById(id);
const usd=n=>(n<0?'-':'')+'$'+Math.round(Math.abs(n)).toLocaleString('en-US');
const pmt=(P,r,y)=>{const m=r/100/12,n=y*12;return m?P*m/(1-Math.pow(1+m,-n)):P/n};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const smooth=()=>reduced()?'auto':'smooth';
const store={get(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d;}catch(e){return d;}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}};
