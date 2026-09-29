/* Saves submissions to Supabase through its REST API. Insert-only: the browser can't read
   anything back. Failures never block the visitor; the demo notice says what happened. */
const DB=(()=>{
  const c=window.RELIANT_CONFIG||{};
  async function insert(table,row){
    if(!c.supabaseUrl||!c.supabaseKey)return {ok:false,reason:'not-configured'};
    try{
      const r=await fetch(`${c.supabaseUrl}/rest/v1/${table}`,{method:'POST',
        headers:{apikey:c.supabaseKey,'Content-Type':'application/json',Prefer:'return=minimal'},
        body:JSON.stringify(row)});
      return {ok:r.ok,status:r.status};
    }catch(e){return {ok:false,reason:'network'};}
  }
  return {insert};
})();
