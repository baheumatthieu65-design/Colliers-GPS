const OWNER = process.env.GITHUB_REPO_OWNER || 'baheumatthieu65-design';
const REPO = process.env.GITHUB_REPO_NAME || 'Colliers-GPS';
const BRANCH = process.env.GITHUB_BRANCH || 'main';
const PATH = 'config/collars.json';

function headers() {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${process.env.GITHUB_TOKEN || ''}`,
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };
}
function url() {
  return `https://api.github.com/repos/${OWNER}/${REPO}/contents/${PATH}?ref=${encodeURIComponent(BRANCH)}`;
}
function json(res:any, code:number, body:any) { res.setHeader('Access-Control-Allow-Origin','*'); res.setHeader('Cache-Control','no-store'); return res.status(code).json(body); }

async function readConfig() {
  const r = await fetch(url(), { headers: headers(), cache: 'no-store' });
  if (!r.ok) throw new Error(`Lecture GitHub impossible (${r.status})`);
  const p:any = await r.json();
  const raw = Buffer.from(String(p.content || '').replace(/\n/g,''), 'base64').toString('utf8');
  return { sha: p.sha, data: JSON.parse(raw) };
}

export default async function handler(req:any,res:any) {
  if (req.method === 'OPTIONS') return json(res,204,{});
  if (!process.env.GITHUB_TOKEN) return json(res,503,{ok:false,error:'GITHUB_TOKEN manquant sur Vercel.'});
  try {
    const collarNumber = String(req.query?.collarNumber || req.body?.collarNumber || '').trim();
    const id = String(req.query?.id || req.body?.id || '').trim();
    if (!collarNumber && !id) return json(res,400,{ok:false,error:'collarNumber ou id requis.'});
    const cfg = await readConfig();
    const collar = (cfg.data.collars || []).find((c:any) => (id && c.id === id) || (collarNumber && c.collarNumber === collarNumber));
    if (!collar) return json(res,404,{ok:false,error:'Collier introuvable.'});
    if (req.method === 'GET') return json(res,200,{ok:true,collarId:collar.id,collarNumber:collar.collarNumber,dangerActive:collar.dangerActive === true});
    if (req.method !== 'PUT') return json(res,405,{ok:false,error:'Méthode non autorisée.'});
    collar.dangerActive = Boolean(req.body?.dangerActive);
    const content = Buffer.from(`${JSON.stringify(cfg.data,null,2)}\n`,'utf8').toString('base64');
    const write = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${PATH}`, {
      method:'PUT', headers:headers(), body:JSON.stringify({message:`feat: paramétrage danger ${collar.collarNumber}`,content,branch:BRANCH,sha:cfg.sha})
    });
    if (!write.ok) { const text=await write.text(); throw new Error(`Écriture GitHub impossible (${write.status}) : ${text.slice(0,300)}`); }
    return json(res,200,{ok:true,collarId:collar.id,collarNumber:collar.collarNumber,dangerActive:collar.dangerActive});
  } catch (e:any) { return json(res,500,{ok:false,error:e?.message || 'Erreur paramétrage Danger.'}); }
}
