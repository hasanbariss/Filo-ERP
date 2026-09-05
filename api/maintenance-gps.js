'use strict';
const {createClient}=require('@supabase/supabase-js');
const provider=require('./infomobil');
const {config,validateUser,getMobiles,getDistance}=provider._server;
const {normalizePlate,plateCandidates}=provider._internals;
const CHUNK=7*86400000;
const iso=ms=>new Date(ms).toISOString();
const infoTime=ms=>new Date(ms+10800000).toISOString().slice(0,16).replace('T',' ');
async function checked(query){const r=await query;if(r.error)throw r.error;return r.data||[];}
async function all(db,table){let rows=[];for(let n=0;;n+=1000){const batch=await checked(db.from(table).select('*').range(n,n+999));rows.push(...batch);if(batch.length<1000)return rows;}}
async function syncReference(db,settings,ref,mobile,until,history=false){
 const begin=Date.parse(ref.olcum_zamani);let cursor=begin,total=Number(ref.km),calls=0;
 if(!Number.isFinite(until)||until<begin||until>Date.now())throw new Error('Referans öncesi veya gelecekteki tarih hesaplanamaz.');
 const existing=await checked(db.from('arac_gps_mesafeleri').select('*').eq('referans_id',ref.id).order('baslangic'));
 const cache=new Map(existing.map(row=>[Date.parse(row.baslangic),row]));
 while(cursor<until){
  const end=Math.min(cursor+CHUNK,until),cached=cache.get(cursor);
  // Refresh the latest week; finalized old windows are reused.
  const reuse=cached&&Date.parse(cached.bitis)===end&&(history||end<until-CHUNK);
  let distance;
  if(reuse)distance=Number(cached.km);
  else {
   if(calls>=4)return {durum:'pending',km:null,hesaplanan_an:null,hata:history?'Önce Şimdi güncelle ile GPS geçmişini tamamlayın.':'Geçmiş mesafeler hazırlanıyor. Yeniden güncelleyin.'};
   distance=await getDistance(settings,mobile,infoTime(cursor),infoTime(end),false);calls++;
   if(distance>(end-cursor)/3600000*200)throw new Error('GPS mesafesi olağandışı; referans ve cihaz eşleşmesini kontrol edin.');
   if(!history)await checked(db.from('arac_gps_mesafeleri').upsert({referans_id:ref.id,baslangic:iso(cursor),bitis:iso(end),km:distance,updated_at:iso(Date.now())},{onConflict:'referans_id,baslangic'}));
  }
  total+=distance;cursor=end;
 }
 return {durum:'ready',km:total,hesaplanan_an:iso(until),hata:null};
}
async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(!['GET','POST'].includes(req.method))return res.status(405).json({error:'Yöntem desteklenmiyor.'});
 const settings=config(),cron=req.method==='GET';
 if(cron){if(!process.env.CRON_SECRET||req.headers.authorization!=='Bearer '+process.env.CRON_SECRET)return res.status(401).json({error:'Yetkisiz istek.'});}
 else if(!await validateUser(req,settings))return res.status(401).json({error:'Geçerli oturum gerekli.'});
 if(!process.env.SUPABASE_SERVICE_ROLE_KEY)return res.status(503).json({error:'GPS arka plan ayarı eksik.'});
 const db=createClient(settings.supabaseUrl,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 try{
  const mobiles=await getMobiles(settings,false),body=req.body||{};
  if(!cron&&body.action==='devices')return res.status(200).json({devices:mobiles.filter(m=>m.mobile!=null).map(m=>({id:String(m.mobile),name:String(m.alias||'')}))});
  let refs=await checked(db.from('arac_km_referanslari').select('*, araclar(plaka)').eq('aktif',true));
  if(!cron&&body.vehicleId)refs=refs.filter(r=>r.arac_id===body.vehicleId);
  if(!cron&&!body.vehicleId)return res.status(400).json({error:'Araç seçin.'});
  const states=await all(db,'arac_gps_durumlari');
  const attempts=new Map(states.map(s=>[s.referans_id,Date.parse(s.son_deneme)]));
  refs.sort((a,b)=>(attempts.get(a.id)||0)-(attempts.get(b.id)||0));
  const deadline=Date.now()+230000,results=[];
  let next=0;
  async function worker(){while(next<refs.length&&Date.now()<deadline){const ref=refs[next++];let result;
   try{
    const matches=mobiles.filter(m=>plateCandidates(m.alias).includes(normalizePlate(ref.araclar?.plaka)));
    if(matches.length!==1||String(matches[0].mobile)!==ref.mobile_id)throw new Error('GPS cihazı / plaka eşleşmesi değişmiş veya belirsiz. Referansı kontrol edin.');
    const until=!cron&&body.at?Math.floor(Date.parse(body.at)/60000)*60000:Math.floor(Date.now()/60000)*60000;
    result=await syncReference(db,settings,ref,ref.mobile_id,until,Boolean(!cron&&body.at));
   }catch(e){result={durum:'error',km:null,hesaplanan_an:null,hata:e.message||'GPS alınamadı.'};}
   if(!body.at){
    if(result.durum==='ready')await checked(db.rpc('kaydet_dogrulanmis_gps',{p_referans:ref.id,p_km:result.km,p_an:result.hesaplanan_an}));
    else { // Keep the last verified reading while exposing stale/error status.
     await checked(db.from('arac_gps_durumlari').upsert({referans_id:ref.id,durum:result.durum,hata:result.hata,son_deneme:iso(Date.now())},{onConflict:'referans_id',ignoreDuplicates:true}));
     await checked(db.from('arac_gps_durumlari').update({durum:result.durum,hata:result.hata,son_deneme:iso(Date.now())}).eq('referans_id',ref.id));
    }
   }
   results.push({vehicleId:ref.arac_id,...result});
  }}
  await Promise.all(Array.from({length:Math.min(4,refs.length)},worker));
  return res.status(200).json({results,remaining:refs.length-results.length});
 }catch(e){console.error('[Maintenance GPS]',e.message);return res.status(502).json({error:'GPS eşitleme tamamlanamadı.'});}
}
module.exports=handler;
module.exports._internals={syncReference,infoTime};
