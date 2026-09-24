/** Experimental observer-format identities. No inferred killer order or coordinates. */
export const COMBAT_VERSION = "bdo-observer-candidate-v1";
const SIGNATURE=Buffer.from("2e0301000301020000a70000ae1c","hex");
const MARKER=Buffer.from("a70000ae1c","hex");
export type CombatCandidate={receivedAtMs:number;firstFamily:string;secondFamily:string;rawBase64:string};
function name(b:Buffer){
  const s=b.toString("utf16le").split("\0")[0];
  if(!b.includes(Buffer.from([0,0]))||Array.from(s).length<2||Array.from(s).length>27||!new RegExp("^[\\p{L}\\p{N}_]+$","u").test(s))throw new Error("Oyuncu adı çözülemedi.");
  return s;
}
export function decodeCandidate(raw:unknown,receivedAtMs:number):CombatCandidate{
  if(typeof raw!=="string"||raw.length>1072)throw new Error("Aday paket boyutu geçersiz.");
  const b=Buffer.from(raw,"base64");
  if(b.toString("base64")!==raw||b.length<263||b.length>800||!b.subarray(0,14).equals(SIGNATURE))throw new Error("Aday paket imzası geçersiz.");
  const second=b.indexOf(MARKER,136),next=b.indexOf(SIGNATURE,14);
  if(second<136||second+127!==b.length||(next>=0&&next<second+127))throw new Error("İkinci oyuncu bloğu geçersiz.");
  const firstFamily=name(b.subarray(80,136)),secondFamily=name(b.subarray(second+71,second+127));
  if(firstFamily===secondFamily)throw new Error("Aynı oyunculu olay geçersiz.");
  return {receivedAtMs,firstFamily,secondFamily,rawBase64:raw};
}
export function decodeCombatArchive(input:unknown){
  if(!input||typeof input!=="object")throw new Error("Kayıt gerekli.");
  const b=input as Record<string,unknown>;
  if(b.parserVersion!==COMBAT_VERSION||typeof b.id!=="string"||!/^[-a-zA-Z0-9]{8,80}$/.test(b.id))throw new Error("Kayıt sürümü/kimliği geçersiz.");
  if(!Number.isSafeInteger(b.warId)||Number(b.warId)<=0||typeof b.allianceName!=="string"||!b.allianceName.trim()||b.allianceName.length>60)throw new Error("Savaş/ittifak bilgisi geçersiz.");
  const start=Number(b.startedAtMs),end=Number(b.endedAtMs);
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<1577836800000||end<start||end-start>4*3600_000+60_000||end>Date.now()+300_000||!["stopped","error"].includes(String(b.phase)))throw new Error("Kayıt önce durdurulmalı; zaman aralığı geçerli olmalı.");
  if(!Array.isArray(b.events)||b.events.length>5000)throw new Error("En fazla 5.000 aday olay kabul edilir.");
  const events=b.events.map((raw:unknown)=>{
    if(!raw||typeof raw!=="object")throw new Error("Geçersiz aday olay.");
    const r=raw as Record<string,unknown>,time=Number(r.receivedAtMs);
    if(!Number.isSafeInteger(time)||time<start-2000||time>end+2000)throw new Error("Olay kayıt aralığı dışında.");
    return decodeCandidate(r.rawBase64,time);
  });
  // Do not persist archivePath or any other client-supplied metadata/claims.
  return {id:b.id,warId:Number(b.warId),allianceName:b.allianceName.trim(),parserVersion:COMBAT_VERSION,startedAtMs:start,endedAtMs:end,events};
}
