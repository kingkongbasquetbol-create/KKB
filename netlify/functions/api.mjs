import { getStore } from '@netlify/blobs';
import { randomUUID, createHmac, timingSafeEqual, scryptSync } from 'node:crypto';
import seed from '../../data/seed.json' with { type: 'json' };

const store = getStore({ name: 'king-kong-content', consistency: 'strong' });
const key = 'site-data';
const email = process.env.ADMIN_EMAIL || '';
const passwordHash = process.env.ADMIN_PASSWORD_HASH || '';
const secret = process.env.SESSION_SECRET || '';
const protectedCollections = new Set(['players','games','news','staff','gallery','videos','sponsors','timeline','standings','awards','settings','stats','seasons','competitions']);
const json = (body, status=200, headers={}) => new Response(JSON.stringify(body), { status, headers: { 'content-type':'application/json; charset=utf-8', 'cache-control':'no-store', ...headers } });
const equal = (a,b) => { const x=Buffer.from(a), y=Buffer.from(b); return x.length===y.length && timingSafeEqual(x,y); };
const sign = value => createHmac('sha256', secret).update(value).digest('base64url');
const clean = v => { if(typeof v==='string')return v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').slice(0,200000); if(Array.isArray(v))return v.slice(0,300).map(clean); if(v&&typeof v==='object'&&Object.getPrototypeOf(v)===Object.prototype){const o={};for(const [k,x] of Object.entries(v).slice(0,100))if(!['__proto__','constructor','prototype'].includes(k))o[k]=clean(x);return o;}return v; };
function authenticated(req){ if(!secret)return false;const c=(req.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('kk_session='));if(!c)return false;const p=c.slice(11).split('.');return p.length===2&&Number(p[0])>Date.now()&&equal(p[1],sign(p[0])); }
async function read(){return await store.get(key,{type:'json'})||structuredClone(seed);}
async function write(db){await store.setJSON(key,db);}
export default async function handler(req){
 try{
  const url=new URL(req.url);let route=url.pathname.replace(/^\/.netlify\/functions\/api/,'/api');
  if(route==='/api/health'&&req.method==='GET')return json({ok:true});
  if(route==='/api/login'&&req.method==='POST'){
   if(!email||!passwordHash||!secret)return json({error:'Configura ADMIN_EMAIL, ADMIN_PASSWORD_HASH y SESSION_SECRET en Netlify.'},503);
   const b=await req.json();const [salt,digest]=passwordHash.split(':');if(!salt||!digest)return json({error:'Configuración de acceso no válida.'},503);
   let pass=false;try{pass=equal(scryptSync(String(b.password||''),salt,Buffer.from(digest,'hex').length),Buffer.from(digest,'hex'));}catch{}
   if(!equal(String(b.email||''),email)||!pass)return json({error:'Correo o contraseña incorrectos.'},401);
   const token=String(Date.now()+8*60*60*1000),secure=process.env.CONTEXT==='production'?'; Secure':'';
   return json({ok:true},200,{'set-cookie':`kk_session=${token}.${sign(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${secure}`});
  }
  if(route==='/api/logout'&&req.method==='POST')return json({ok:true},200,{'set-cookie':'kk_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'});
  if(route==='/api/session'&&req.method==='GET')return json({authenticated:authenticated(req)});
  const m=route.match(/^\/api\/([a-z]+)(?:\/([\w-]+))?$/);if(!m)return json({error:'Ruta no encontrada.'},404);
  const [,collection,id]=m;const db=await read();if(!(collection in db))return json({error:'Recurso no encontrado.'},404);
  const admin=authenticated(req);
  if(collection==='messages'&&!admin&&!(req.method==='POST'&&!id))return json({error:'Inicia sesión para continuar.'},401);
  if(protectedCollections.has(collection)&&!admin&&!(req.method==='GET'&&!id))return json({error:'Inicia sesión para continuar.'},401);
  if(collection==='messages'&&req.method==='POST'){
   const b=clean(await req.json());if(!b.name||!b.email||!b.message)return json({error:'Completa nombre, correo y mensaje.'},400);
   db.messages.unshift({id:randomUUID(),...b,status:'NO LEÍDO',date:new Date().toISOString()});await write(db);return json({ok:true},201);
  }
  if(req.method==='GET')return json(id?(db[collection].find(x=>x.id===id)||null):db[collection]);
  if(!admin)return json({error:'Inicia sesión para continuar.'},401);
  if(req.method==='POST'){
   const b=clean(await req.json()),item={...b,id:randomUUID()};if(Array.isArray(db[collection]))db[collection].unshift(item);else db[collection]=item;
   db.activities.unshift({text:`Se agregó contenido en ${collection}.`,date:new Date().toISOString()});await write(db);return json(item,201);
  }
  if(req.method==='PUT'){
   const b=clean(await req.json());if(Array.isArray(db[collection])){const i=db[collection].findIndex(x=>x.id===id);if(i<0)return json({error:'Elemento no encontrado.'},404);db[collection][i]={...db[collection][i],...b,id};}else db[collection]={...db[collection],...b};
   await write(db);return json(Array.isArray(db[collection])?db[collection].find(x=>x.id===id):db[collection]);
  }
  if(req.method==='DELETE'){
   if(!Array.isArray(db[collection]))return json({error:'No se puede eliminar esta configuración.'},400);db[collection]=db[collection].filter(x=>x.id!==id);await write(db);return json({ok:true});
  }
  return json({error:'Método no permitido.'},405);
 }catch(e){return json({error:e.message||'No se pudo procesar la solicitud.'},400)}
}
