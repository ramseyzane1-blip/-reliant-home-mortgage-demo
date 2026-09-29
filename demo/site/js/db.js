/* Saves submissions to Supabase through its REST API. Insert-only: the browser can't read
   anything back. Failures never block the visitor; the demo notice says what happened. */
const DB=(()=>{
  const c=window.RELIANT_CONFIG||{};
  // gives up after 10 seconds so a slow connection can't leave the visitor waiting on nothing
  async function insert(table,row,ms=10000){
    if(!c.supabaseUrl||!c.supabaseKey)return {ok:false,reason:'not-configured'};
    const ac=window.AbortController?new AbortController():null,t=ac&&setTimeout(()=>ac.abort(),ms);
    try{
      const r=await fetch(`${c.supabaseUrl}/rest/v1/${table}`,{method:'POST',
        headers:{apikey:c.supabaseKey,'Content-Type':'application/json',Prefer:'return=minimal'},
        body:JSON.stringify(row),signal:ac?ac.signal:undefined});
      return {ok:r.ok,status:r.status,reason:r.ok?'':'http'};
    }catch(e){return {ok:false,reason:ac&&ac.signal.aborted?'timeout':'network'};}
    finally{clearTimeout(t);}
  }
  return {insert};
})();
