/** Supabase's API row cap applies per request; fetch deterministic pages instead of truncating navigation/history. */
export async function readAll(client:any,table:string):Promise<any[]> {
  const result:any[]=[];
  for(let offset=0;;offset+=500){
    const key=table==='model_run_visibility'?'run_id':'id';
    const {data,error}=await client.from(table).select('*').order(key).range(offset,offset+499);
    if(error)throw error;
    result.push(...(data||[]));
    if(!data||data.length<500)return result;
  }
}
