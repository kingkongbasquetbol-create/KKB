const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = __dirname;
const DATA = path.join(ROOT, 'data', 'store.json');
const PORT = Number(process.env.PORT || 3000);
const envFile = path.join(ROOT, '.env');
if (fs.existsSync(envFile)) for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
}
const email = process.env.ADMIN_EMAIL || 'admin@kingkongbasketball.mx';
const password = process.env.ADMIN_PASSWORD || '';
const passwordHash = process.env.ADMIN_PASSWORD_HASH || '';
const secret = process.env.SESSION_SECRET || 'development-only-change-this-secret';
const initial = {
  settings: { name: 'KING KONG BASKETBALL', tagline: 'MÁS QUE UN EQUIPO. UNA FAMILIA QUE JUEGA PARA GANAR.', description: 'King Kong Basketball representa pasión, disciplina, fuerza y compañerismo dentro y fuera de la cancha. Cada partido es una oportunidad para demostrar nuestro trabajo y nuestra identidad.', email: 'hola@kingkongbasketball.mx', instagram: '', facebook: '', tiktok: '', youtube: '', whatsapp: '', mascotImage: '' },
  players: [{ id:'demo-player-1', demo:true, number:'23', firstName:'Jugador', lastName:'Demo', position:'BASE', height:'1.82 m', age:'22', bio:'Perfil de demostración. Sustituye esta información desde administración.', points:12.4, rebounds:4.1, assists:5.3, steals:1.4, blocks:0.3, threes:2.1, image:'' }],
  games: [{ id:'demo-game-1', demo:true, opponent:'Equipo Rival', date:'2026-10-18', time:'19:00', venue:'Por confirmar', season:'2026', competition:'Partido de demostración', status:'PRÓXIMO', homeScore:'', awayScore:'' }],
  news: [{ id:'demo-news-1', demo:true, title:'Una nueva temporada comienza', date:'2026-09-01', category:'EQUIPO', excerpt:'Noticia de ejemplo. Pronto compartiremos las novedades de King Kong Basketball.', body:'Esta noticia es contenido de demostración.', image:'' }],
  staff: [], gallery: [], videos: [], sponsors: [], timeline: [{id:'tl-1',year:'2024',title:'Fundación',description:'Completa aquí la historia oficial del equipo.'},{id:'tl-2',year:'2025',title:'Crecimiento',description:'Añade los hitos reales de esta temporada.'},{id:'tl-3',year:'2026',title:'Nueva etapa',description:'Un nuevo capítulo para King Kong Basketball.'}], standings: [], awards: [], messages: [], activities: [], stats: {games:12,wins:8,losses:4,ppg:72.4}, seasons:['2026'], competitions:['Liga','Torneo','Copa','Amistoso','Playoffs']
};
fs.mkdirSync(path.dirname(DATA), {recursive:true});
if (!fs.existsSync(DATA)) fs.writeFileSync(DATA, JSON.stringify(initial, null, 2));
let db = JSON.parse(fs.readFileSync(DATA, 'utf8'));
function save(){ fs.writeFileSync(DATA, JSON.stringify(db, null, 2)); }
function safeEqual(a,b){const aa=Buffer.from(a),bb=Buffer.from(b);return aa.length===bb.length&&crypto.timingSafeEqual(aa,bb)}
function sign(value){return crypto.createHmac('sha256',secret).update(value).digest('base64url')}
function isAdmin(req){const c=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('kk_session='));if(!c)return false;const token=c.slice(11).split('.');return token.length===2&&safeEqual(token[1],sign(token[0]))&&Number(token[0])>Date.now()}
const protectedCollections = new Set(['players','games','news','staff','gallery','videos','sponsors','timeline','standings','awards','settings','stats','seasons','competitions']);
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon'};
function json(res,status,obj,headers={}){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers});res.end(JSON.stringify(obj));}
function readBody(req){return new Promise((resolve,reject)=>{let s='';req.on('data',c=>{s+=c;if(s.length>3_000_000)reject(new Error('El archivo es demasiado grande (máximo 3 MB).'));});req.on('end',()=>{try{resolve(JSON.parse(s||'{}'))}catch{reject(new Error('JSON no válido.'))}});req.on('error',reject)})}
function clean(v){if(typeof v==='string')return v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').slice(0,200000);if(Array.isArray(v))return v.slice(0,300).map(clean);if(v&&typeof v==='object'&&Object.getPrototypeOf(v)===Object.prototype){const out={};for(const [k,x] of Object.entries(v).slice(0,100))if(!['__proto__','constructor','prototype'].includes(k))out[k]=clean(x);return out}return v}
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname.startsWith('/api/')){
    try{
      if(url.pathname==='/api/health'&&req.method==='GET')return json(res,200,{ok:true});
      if(url.pathname==='/api/login'&&req.method==='POST'){
        if(!password&&!passwordHash)return json(res,503,{error:'Configura ADMIN_PASSWORD_HASH en .env antes de habilitar el acceso.'});
        const b=await readBody(req);let passwordOK=false;
        if(passwordHash){const [salt,digest]=passwordHash.split(':');if(salt&&digest){const candidate=crypto.scryptSync(String(b.password||''),salt,Buffer.from(digest,'hex').length);passwordOK=safeEqual(candidate,Buffer.from(digest,'hex'));}}
        else passwordOK=safeEqual(String(b.password||''),password);
        if(!safeEqual(String(b.email||''),email)||!passwordOK)return json(res,401,{error:'Correo o contraseña incorrectos.'});
        const token=String(Date.now()+8*60*60*1000);return json(res,200,{ok:true},{'Set-Cookie':`kk_session=${token}.${sign(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${process.env.NODE_ENV==='production'?'; Secure':''}`});
      }
      if(url.pathname==='/api/logout'&&req.method==='POST')return json(res,200,{ok:true},{'Set-Cookie':'kk_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'});
      if(url.pathname==='/api/session'&&req.method==='GET')return json(res,200,{authenticated:isAdmin(req)});
      const m=url.pathname.match(/^\/api\/([a-z]+)(?:\/([\w-]+))?$/);
      if(m){const [,key,id]=m;if(!(key in db))return json(res,404,{error:'Recurso no encontrado.'});if(key==='messages'&&!isAdmin(req)&&!(req.method==='POST'&&!id))return json(res,401,{error:'Inicia sesión para continuar.'});if(protectedCollections.has(key)&&!isAdmin(req)&&!(req.method==='GET'&&!id))return json(res,401,{error:'Inicia sesión para continuar.'});
        if(key==='messages'&&req.method==='POST'){const b=clean(await readBody(req));if(!b.name||!b.email||!b.message)return json(res,400,{error:'Completa nombre, correo y mensaje.'});db.messages.unshift({id:crypto.randomUUID(),...b,status:'NO LEÍDO',date:new Date().toISOString()});save();return json(res,201,{ok:true});}
        if(req.method==='GET')return json(res,200,id?(db[key].find(x=>x.id===id)||null):db[key]);
        if(!isAdmin(req))return json(res,401,{error:'Inicia sesión para continuar.'});
        if(req.method==='POST'){const b=clean(await readBody(req));const item={...b,id:crypto.randomUUID()};if(Array.isArray(db[key]))db[key].unshift(item);else db[key]=item;db.activities.unshift({text:`Se agregó contenido en ${key}.`,date:new Date().toISOString()});save();return json(res,201,item);}
        if(req.method==='PUT'){const b=clean(await readBody(req));if(Array.isArray(db[key])){const i=db[key].findIndex(x=>x.id===id);if(i<0)return json(res,404,{error:'Elemento no encontrado.'});db[key][i]={...db[key][i],...b,id};}else db[key]={...db[key],...b};save();return json(res,200,Array.isArray(db[key])?db[key].find(x=>x.id===id):db[key]);}
        if(req.method==='DELETE'){if(!Array.isArray(db[key]))return json(res,400,{error:'No se puede eliminar esta configuración.'});db[key]=db[key].filter(x=>x.id!==id);save();return json(res,200,{ok:true});}
      }
      return json(res,404,{error:'Ruta no encontrada.'});
    }catch(e){return json(res,400,{error:e.message||'No se pudo procesar la solicitud.'})}
  }
  let file=path.resolve(ROOT,'public',decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname).replace(/^[/\\]+/,''));const relative=path.relative(path.join(ROOT,'public'),file);if(relative.startsWith('..')||path.isAbsolute(relative))return json(res,403,{error:'Prohibido'});
  fs.readFile(file,(err,data)=>{if(err){fs.readFile(path.join(ROOT,'public','index.html'),(e,d)=>{if(e){res.writeHead(404);res.end('No encontrado')}else{res.writeHead(200,{'Content-Type':mime['.html']});res.end(d)}});return}res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(data)});
});
server.listen(PORT,()=>console.log(`King Kong Basketball disponible en http://localhost:${PORT}`));
