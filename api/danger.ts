import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OWNER = process.env.GITHUB_REPO_OWNER || 'baheumatthieu65-design';
const REPO = process.env.GITHUB_REPO_NAME || 'Colliers-GPS';
const BRANCH = process.env.GITHUB_BRANCH || 'main';

function out(res:any, code:number, body:any) { res.setHeader('Access-Control-Allow-Origin','*'); res.setHeader('Cache-Control','no-store'); return res.status(code).json(body); }
async function collarsConfig() {
  const r = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/config/collars.json?ref=${encodeURIComponent(BRANCH)}`, { headers:{Accept:'application/vnd.github+json','Authorization':`Bearer ${process.env.GITHUB_TOKEN || ''}`,'X-GitHub-Api-Version':'2022-11-28'}, cache:'no-store' });
  if (!r.ok) throw new Error(`Lecture configuration colliers impossible (${r.status})`);
  const p:any=await r.json(); return JSON.parse(Buffer.from(String(p.content||'').replace(/\n/g,''),'base64').toString('utf8'));
}
function dangerValue(row:any) { return row?.DANGER ?? row?.danger ?? row?.Danger ?? ''; }
export default async function handler(req:any,res:any) {
  if (req.method === 'OPTIONS') return out(res,204,{});
  if (req.method !== 'GET') return out(res,405,{ok:false,error:'Méthode non autorisée.'});
  if (!supabaseUrl || !serviceKey) return out(res,503,{ok:false,error:'Supabase non configuré sur Vercel.'});
  try {
    const supabase=createClient(supabaseUrl,serviceKey,{auth:{autoRefreshToken:false,persistSession:false}});
    const {data,error}=await supabase.from('positions').select('*').order('recorded_at',{ascending:false}).limit(100);
    if(error) throw new Error(error.message);
    const cfg=await collarsConfig();
    const byId=new Map((cfg.collars||[]).map((c:any)=>[c.id,c]));
    const rows=(data||[]).map((row:any)=>{
      const danger=dangerValue(row); const c=byId.get(row.collar_id);
      return { id:row.id, collarId:row.collar_id, danger, dangerActive:c?.dangerActive===true, sheepName:c?.sheepName||'', collarNumber:c?.collarNumber||'', recordedAt:row.recorded_at||row.created_at||null };
    }).filter((r:any)=>String(r.danger ?? '').trim() !== '' && r.dangerActive);
    return out(res,200,{ok:true,rows});
  } catch(e:any) { return out(res,500,{ok:false,error:e?.message||'Erreur lecture DANGER.'}); }
}
