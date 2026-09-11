/* NIRAMAY demo server. Deliberately dependency-free for an offline SIH setup. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ENV_FILE = path.join(__dirname, '.env');
if (fs.existsSync(ENV_FILE)) {
  fs.readFileSync(ENV_FILE, 'utf8').split(/\r?\n/).forEach(line => {
    const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  });
}
const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const STORE_FILE = path.join(DATA_DIR, 'niramay-demo.json');
const sessions = new Map();
const roles = {
  patient: ['patient:read:self'],
  registration_operator: ['patient:create','patient:read','queue:create'],
  operator: ['patient:create','patient:read','queue:create'],
  nurse: ['patient:read','vitals:create','queue:read','queue:update'],
  doctor: ['patient:read','consultation:create','prescription:create','investigation:create','queue:read','queue:update'],
  pharmacist: ['prescription:read','dispense:create'],
  lab_technician: ['investigation:read','lab:update'],
  lab: ['investigation:read','lab:update'],
  hospital_admin: ['*'],
  district_admin: ['analytics:read','facility:read'],
  state_admin: ['analytics:read','facility:read'],
  super_admin: ['*']
};
function seed() { return {
  meta: { demoMode: true, generatedAt: new Date().toISOString(), schemaVersion: 1 },
  facilities: [{id:'DH-KOT-042',name:'District Hospital Kota',type:'District Hospital',district:'Kota',state:'Rajasthan'}, {id:'CHC-RAM-011',name:'CHC Ramganj Mandi',type:'CHC',district:'Kota',state:'Rajasthan'}, {id:'PHC-LAD-008',name:'PHC Ladpura',type:'PHC',district:'Kota',state:'Rajasthan'}],
  users: [{id:'USR-001',name:'Dr. Ananya Sharma',role:'doctor',department:'General Medicine',registrationNo:'RMC-43521',email:'doctor@niramay.demo',password:'Demo@123'}, {id:'USR-002',name:'Ravi Kumar',role:'operator',department:'OPD Registration',email:'operator@niramay.demo',password:'Demo@123'}, {id:'USR-003',name:'Neha Singh',role:'pharmacist',department:'Central Pharmacy',email:'pharmacy@niramay.demo',password:'Demo@123'}, {id:'USR-004',name:'S. Meena',role:'hospital_admin',department:'Administration',email:'admin@niramay.demo',password:'Demo@123'}],
  patients: [
   {id:'PAT-001',niramayId:'NIR-RJ-2026-002184',name:'Meera Kulkarni',dob:'1984-08-14',gender:'Female',bloodGroup:'B+',mobile:'9876543210',maskedAadhaar:'XXXX-XXXX-8421',abha:'91-8923-1234-4567',janAadhaar:'JAN-RJ-*****762',address:'Mahaveer Nagar, Kota',emergencyContact:'Vivek Kulkarni · 98765 43110',allergies:['Penicillin'],conditions:['Type 2 Diabetes'],facilityId:'DH-KOT-042',createdAt:'2026-09-10T09:54:00Z'},
   {id:'PAT-002',niramayId:'NIR-RJ-2026-001097',name:'Ramesh Iyer',dob:'1968-01-18',gender:'Male',bloodGroup:'O+',mobile:'9821155342',maskedAadhaar:'XXXX-XXXX-4011',abha:'',janAadhaar:'',address:'Ramganj Mandi, Kota',emergencyContact:'Anita Iyer · 98211 55344',allergies:[],conditions:['Hypertension'],facilityId:'CHC-RAM-011',createdAt:'2026-09-10T09:41:00Z'},
   {id:'PAT-003',niramayId:'NIR-RJ-2026-002106',name:'Farah Khan',dob:'1997-03-22',gender:'Female',bloodGroup:'A+',mobile:'9987120119',maskedAadhaar:'XXXX-XXXX-9012',abha:'',janAadhaar:'JAN-RJ-*****378',address:'Dadabari, Kota',emergencyContact:'Salim Khan · 99871 20118',allergies:[],conditions:[],facilityId:'DH-KOT-042',createdAt:'2026-09-10T09:36:00Z'}],
  queueTokens: [{id:'Q-001',token:'GM-12',patientId:'PAT-001',department:'General Medicine',doctorId:'USR-001',priority:'HIGH',status:'IN_CONSULTATION',createdAt:'2026-09-10T09:54:00Z'}, {id:'Q-002',token:'GM-13',patientId:'PAT-002',department:'General Medicine',doctorId:'USR-001',priority:'SENIOR',status:'WAITING',createdAt:'2026-09-10T09:41:00Z'}, {id:'Q-003',token:'GM-14',patientId:'PAT-003',department:'General Medicine',doctorId:'USR-001',priority:'ROUTINE',status:'WAITING',createdAt:'2026-09-10T09:36:00Z'}],
  consultations: [{id:'CON-001',patientId:'PAT-001',doctorId:'USR-001',chiefComplaint:'Fever and sore throat for three days',vitals:{bp:'138/86',pulse:92,temp:100.4,spo2:98},diagnosis:'Acute upper respiratory infection',followupDate:'2026-09-17',createdAt:'2026-09-10T10:22:00Z'}],
  investigations: [{id:'INV-001',patientId:'PAT-001',consultationId:'CON-001',test:'CBC',status:'PROCESSING',orderedAt:'2026-09-10T10:24:00Z'}],
  prescriptions: [{id:'RX-001',patientId:'PAT-001',doctorId:'USR-001',diagnosis:'Acute upper respiratory infection',items:[{medicine:'Paracetamol',strength:'500 mg',dose:'1 tablet',frequency:'Every 6 hours, if needed',duration:'3 days',quantity:12}],status:'PENDING',followupDate:'2026-09-17',createdAt:'2026-09-10T10:25:00Z'}],
  auditLogs: [], notifications: []
}; }
function load(){ if(!fs.existsSync(STORE_FILE)){fs.mkdirSync(DATA_DIR,{recursive:true});fs.writeFileSync(STORE_FILE,JSON.stringify(seed(),null,2));} return JSON.parse(fs.readFileSync(STORE_FILE,'utf8')); }
function save(db){ fs.writeFileSync(STORE_FILE,JSON.stringify(db,null,2)); }
function reply(res,status,data){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
function body(req){return new Promise((resolve,reject)=>{let b='';let size=0;req.on('data',c=>{size+=c.length;if(size>1024*1024){reject(new Error('Payload too large'));req.destroy();}else b+=c;});req.on('end',()=>{try{resolve(b?JSON.parse(b):{});}catch(e){reject(new Error('Invalid JSON payload'));}});});}
function audit(db,user,action,patientRef,status='SUCCESS'){db.auditLogs.unshift({id:'AUD-'+crypto.randomUUID().slice(0,8),user:user?.name||'System',role:user?.role||'system',action,patientRef,timestamp:new Date().toISOString(),device:'DEMO-WEB',status});}
function userFor(req,db){const token=(req.headers.authorization||'').replace('Bearer ','');return sessions.get(token) && db.users.find(u=>u.id===sessions.get(token));}
function has(user,permission){return user && (roles[user.role]||[]).some(p=>p==='*'||p===permission);}
function findPatient(db,key){const q=String(key||'').toLowerCase();return db.patients.find(p=>[p.id,p.niramayId,p.name,p.mobile].some(v=>String(v).toLowerCase().includes(q)));}
function nextNiramay(db){return `NIR-RJ-${new Date().getFullYear()}-${String(2184+db.patients.length+1).padStart(6,'0')}`;}
function enrichQueue(db,q){const p=db.patients.find(x=>x.id===q.patientId);return {...q,patient:p?{id:p.id,niramayId:p.niramayId,name:p.name,gender:p.gender,dob:p.dob,allergies:p.allergies}:null};}
async function api(req,res,url){const db=load(), method=req.method, route=url.pathname, actor=userFor(req,db);
 if(method==='POST'&&route==='/api/auth/login'){const b=await body(req);if(typeof b.email!=='string'||typeof b.password!=='string')return reply(res,400,{error:'Email and password are required'});const user=db.users.find(u=>u.email===b.email&&u.password===b.password);if(!user)return reply(res,401,{error:'Invalid demo credentials'});const token=crypto.randomBytes(32).toString('hex');sessions.set(token,user.id);audit(db,user,'Logged in','—');save(db);return reply(res,200,{token,user:{id:user.id,name:user.name,role:user.role,department:user.department},demoMode:true});}
 if(method==='GET'&&route==='/api/health')return reply(res,200,{status:'ONLINE',demoMode:true,time:new Date().toISOString()});
 if(!actor)return reply(res,401,{error:'Authentication required'});
 if(method==='GET'&&route==='/api/dashboard'){const today=db.queueTokens;return reply(res,200,{facility:db.facilities[0],metrics:{opd:248,waiting:today.filter(x=>x.status==='WAITING').length,inConsultation:today.filter(x=>x.status==='IN_CONSULTATION').length,completed:162,emergency:8,pharmacyPending:db.prescriptions.filter(x=>x.status==='PENDING').length,investigationsPending:db.investigations.filter(x=>x.status!=='COMPLETED').length,followupsDue:18},queue:today.map(q=>enrichQueue(db,q))});}
 if(method==='GET'&&route==='/api/patients'){if(!has(actor,'patient:read'))return reply(res,403,{error:'Not authorized'});const q=url.searchParams.get('q')||'';const list=q?db.patients.filter(p=>JSON.stringify(p).toLowerCase().includes(q.toLowerCase())):db.patients;return reply(res,200,{data:list,demoMode:true});}
 if(method==='POST'&&route==='/api/patients'){if(!has(actor,'patient:create'))return reply(res,403,{error:'Not authorized'});const b=await body(req);if(typeof b.name!=='string'||b.name.trim().length<2)return reply(res,400,{error:'Patient name is required'});const p={id:'PAT-'+crypto.randomUUID().slice(0,8),niramayId:nextNiramay(db),name:b.name.trim(),dob:b.dob||'',gender:b.gender||'Not recorded',bloodGroup:b.bloodGroup||'Not recorded',mobile:b.mobile||'',maskedAadhaar:b.maskedAadhaar||'',abha:b.abha||'',janAadhaar:b.janAadhaar||'',address:b.address||'',emergencyContact:b.emergencyContact||'',allergies:Array.isArray(b.allergies)?b.allergies:[],conditions:Array.isArray(b.conditions)?b.conditions:[],facilityId:b.facilityId||'DH-KOT-042',createdAt:new Date().toISOString()};db.patients.push(p);audit(db,actor,'Created patient record',p.niramayId);save(db);return reply(res,201,{data:p,cardRef:'CARD-'+crypto.randomUUID().slice(0,8)});}
 const patientMatch=route.match(/^\/api\/patients\/([^/]+)$/);if(method==='GET'&&patientMatch){const p=findPatient(db,decodeURIComponent(patientMatch[1]));if(!p)return reply(res,404,{error:'Patient not found'});audit(db,actor,'Viewed patient record',p.niramayId);save(db);return reply(res,200,{data:{...p,consultations:db.consultations.filter(x=>x.patientId===p.id),prescriptions:db.prescriptions.filter(x=>x.patientId===p.id),investigations:db.investigations.filter(x=>x.patientId===p.id),timeline:[...db.consultations.filter(x=>x.patientId===p.id),...db.prescriptions.filter(x=>x.patientId===p.id)]}});}
 if(method==='POST'&&route==='/api/queue'){if(!has(actor,'queue:create'))return reply(res,403,{error:'Not authorized'});const b=await body(req);const p=findPatient(db,b.patientId);if(!p)return reply(res,404,{error:'Patient not found'});const token={id:'Q-'+crypto.randomUUID().slice(0,8),token:`${b.departmentCode||'GM'}-${String(db.queueTokens.length+12).padStart(2,'0')}`,patientId:p.id,department:b.department||'General Medicine',doctorId:b.doctorId||'USR-001',priority:b.priority||'ROUTINE',status:'WAITING',createdAt:new Date().toISOString()};db.queueTokens.push(token);audit(db,actor,'Generated OPD token',p.niramayId);save(db);return reply(res,201,{data:enrichQueue(db,token)});}
 if(method==='GET'&&route==='/api/queue')return reply(res,200,{data:db.queueTokens.map(q=>enrichQueue(db,q))});
 if(method==='POST'&&route==='/api/consultations'){if(!has(actor,'consultation:create'))return reply(res,403,{error:'Not authorized'});const b=await body(req),p=findPatient(db,b.patientId);if(!p)return reply(res,404,{error:'Patient not found'});const c={id:'CON-'+crypto.randomUUID().slice(0,8),patientId:p.id,doctorId:actor.id,chiefComplaint:b.chiefComplaint||'',vitals:b.vitals||{},diagnosis:b.diagnosis||'',followupDate:b.followupDate||'',createdAt:new Date().toISOString()};db.consultations.push(c);db.queueTokens.filter(q=>q.patientId===p.id&&q.status==='IN_CONSULTATION').forEach(q=>q.status='COMPLETED');audit(db,actor,'Completed consultation',p.niramayId);save(db);return reply(res,201,{data:c});}
 if(method==='GET'&&route==='/api/prescriptions')return reply(res,200,{data:db.prescriptions.map(rx=>({...rx,patient:db.patients.find(p=>p.id===rx.patientId)}))});
 if(method==='POST'&&route==='/api/prescriptions'){if(!has(actor,'prescription:create'))return reply(res,403,{error:'Not authorized'});const b=await body(req),p=findPatient(db,b.patientId);if(!p)return reply(res,404,{error:'Patient not found'});const rx={id:'RX-'+crypto.randomUUID().slice(0,8),patientId:p.id,doctorId:actor.id,diagnosis:b.diagnosis||'',items:b.items||[],status:'PENDING',followupDate:b.followupDate||'',createdAt:new Date().toISOString()};db.prescriptions.push(rx);audit(db,actor,'Created digital prescription',p.niramayId);save(db);return reply(res,201,{data:rx,verificationRef:'RXV-'+crypto.randomUUID().slice(0,8)});}
 const dispenseMatch=route.match(/^\/api\/prescriptions\/([^/]+)\/dispense$/);if(method==='POST'&&dispenseMatch){if(!has(actor,'dispense:create'))return reply(res,403,{error:'Not authorized'});const rx=db.prescriptions.find(x=>x.id===dispenseMatch[1]);if(!rx)return reply(res,404,{error:'Prescription not found'});rx.status='DISPENSED';rx.dispensedBy=actor.id;rx.dispensedAt=new Date().toISOString();const p=db.patients.find(x=>x.id===rx.patientId);audit(db,actor,'Dispensed prescription',p.niramayId);save(db);return reply(res,200,{data:rx,receiptId:'REC-'+crypto.randomUUID().slice(0,8)});}
 if(method==='GET'&&route==='/api/audit-logs'){if(!has(actor,'*'))return reply(res,403,{error:'Administrator access required'});return reply(res,200,{data:db.auditLogs});}
 return reply(res,404,{error:'API route not found'});
}
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json'};
const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,`http://${req.headers.host}`);if(url.pathname.startsWith('/api/'))return await api(req,res,url);let file=url.pathname==='/'?'index.html':url.pathname.replace(/^\//,'');file=path.normalize(file);const full=path.join(ROOT,file);if(!full.startsWith(ROOT)||!fs.existsSync(full))return reply(res,404,{error:'Not found'});res.writeHead(200,{'Content-Type':mime[path.extname(full)]||'application/octet-stream'});fs.createReadStream(full).pipe(res);}catch(e){console.error(e);reply(res,e.message==='Invalid JSON payload'||e.message==='Payload too large'?400:500,{error:e.message==='Invalid JSON payload'||e.message==='Payload too large'?e.message:'Server error'});}});
if(process.argv.includes('--seed')){fs.mkdirSync(DATA_DIR,{recursive:true});fs.writeFileSync(STORE_FILE,JSON.stringify(seed(),null,2));console.log('NIRAMAY demo database seeded.');}else server.listen(PORT,()=>console.log(`NIRAMAY running at http://localhost:${PORT}`));
