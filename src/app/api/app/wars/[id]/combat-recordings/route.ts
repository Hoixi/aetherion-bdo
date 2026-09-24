export const dynamic="force-dynamic";
export {OPTIONS} from "@/lib/app-gate";
import {NextResponse} from "next/server";
import {withApp,APP_HEADERS,appError} from "@/lib/app-gate";
import {prisma} from "@/lib/prisma";
import {canImportReports,reportWarScope} from "@/lib/bdo-report-import";
import {decodeCombatArchive} from "@/lib/combat-candidates";
import type {AppActor} from "@/lib/app-auth";
async function allowed(me:AppActor,id:number){
  if(!Number.isSafeInteger(id)||id<=0||!await canImportReports(me))return false;
  return !!await prisma.war.findFirst({where:{id,...await reportWarScope(me)},select:{id:true}});
}
export async function GET(req:Request,{params}:{params:{id:string}}){
  if(process.env.ENABLE_COMBAT_BETA!=="1")return appError("Deneysel kayıt kapalı.",404);
  return withApp(req,async me=>{
    const warId=Number(params.id);if(!await allowed(me,warId))return appError("Bu savaşı inceleme yetkiniz yok.",403);
    const recordingId=Number(new URL(req.url).searchParams.get("recordingId"));
    if(recordingId){
      if(!Number.isSafeInteger(recordingId)||recordingId<=0)return appError("Geçersiz kayıt.",400);
      const log=await prisma.combatLog.findFirst({where:{id:recordingId,warId,source:"companion-beta"},select:{id:true,title:true,allianceName:true,startedAt:true,endedAt:true,parserVersion:true,directionVerified:true,rawData:true}});
      if(!log)return appError("Kayıt bulunamadı.",404);
      const raw=log.rawData as {events?:Array<{receivedAtMs:number;firstFamily:string;secondFamily:string}>}|null;
      return NextResponse.json({...log,rawData:undefined,events:(raw?.events??[]).map(e=>({receivedAtMs:e.receivedAtMs,firstFamily:e.firstFamily,secondFamily:e.secondFamily}))},{headers:APP_HEADERS});
    }
    const logs=await prisma.combatLog.findMany({where:{warId,source:"companion-beta"},orderBy:{createdAt:"desc"},take:50,
      select:{id:true,title:true,allianceName:true,startedAt:true,endedAt:true,parserVersion:true,directionVerified:true}});
    return NextResponse.json({logs},{headers:APP_HEADERS});
  });
}
export async function POST(req:Request,{params}:{params:{id:string}}){
  if(process.env.ENABLE_COMBAT_BETA!=="1")return appError("Deneysel kayıt kapalı.",404);
  return withApp(req,async me=>{
    const warId=Number(params.id);if(!await allowed(me,warId))return appError("Bu savaşa yükleme yetkiniz yok.",403);
    let archive;
    try{
      const reader=req.body?.getReader();if(!reader)return appError("Dosya gerekli.",400);
      const parts:Uint8Array[]=[];let bytes=0;
      for(;;){const r=await reader.read();if(r.done)break;bytes+=r.value.length;if(bytes>8*1024*1024){await reader.cancel();return appError("Dosya 8 MB sınırını aşıyor.",413);}parts.push(r.value);}
      archive=decodeCombatArchive(JSON.parse(Buffer.concat(parts).toString("utf8")));
      if(archive.warId!==warId)return appError("Kayıt başka savaş için alınmış.",409);
    }catch(e){return appError(e instanceof Error?e.message:"Dosya okunamadı.",400);}
    const recordingKey=`${me.id}:${archive.id}`;
    try{
      // Serialize imports for this war; identical retries are idempotent.
      const result=await prisma.$transaction(async tx=>{
        await tx.$queryRaw`SELECT id FROM wars WHERE id = ${warId} FOR UPDATE`;
        const previous=await tx.combatLog.findUnique({where:{recordingKey},select:{id:true,warId:true,rawData:true}});
        if(previous){if(previous.warId!==warId||JSON.stringify(previous.rawData)!==JSON.stringify(archive)){
          // JSONB may reorder object keys: compare canonical fields after reparsing.
          const p=previous.rawData as unknown as typeof archive;
          if(previous.warId!==warId||!p||p.startedAtMs!==archive.startedAtMs||p.endedAtMs!==archive.endedAtMs||p.allianceName!==archive.allianceName||JSON.stringify(p.events?.map(e=>[e.receivedAtMs,e.rawBase64]))!==JSON.stringify(archive.events.map(e=>[e.receivedAtMs,e.rawBase64])))throw new Error("RECORDING_CONFLICT");
        }return {id:previous.id,reused:true};}
        const log=await tx.combatLog.create({data:{warId,title:`${archive.allianceName} · deneysel canlı kayıt`,source:"companion-beta",recordingKey,recordedGuildId:me.guildId,allianceName:archive.allianceName,parserVersion:archive.parserVersion,uploadedBy:me.id,startedAt:new Date(archive.startedAtMs),endedAt:new Date(archive.endedAtMs),rawData:archive,directionVerified:false},select:{id:true}});
        return {...log,reused:false};
      });
      return NextResponse.json({...result,candidates:archive.events.length,verifiedKills:0},{headers:APP_HEADERS});
    }catch(e){return appError(e instanceof Error&&e.message==="RECORDING_CONFLICT"?"Aynı kayıt kimliği farklı veri içeriyor.":"Kayıt saklanamadı; beta şemasını kontrol edin.",e instanceof Error&&e.message==="RECORDING_CONFLICT"?409:500);}
  });
}
