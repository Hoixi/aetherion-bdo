import {notFound} from "next/navigation";
import {readFile} from "node:fs/promises";
import {CombatMapPreview} from "@/components/combat-map-preview";
export const dynamic="force-dynamic";
export default async function Page(){
  if(process.env.NODE_ENV!=="development"||process.env.ENABLE_COMBAT_BETA!=="1"||!process.env.COMBAT_PREVIEW_FILE)notFound();
  const text=await readFile(process.env.COMBAT_PREVIEW_FILE,"utf8");
  // The supplied document contains JSON followed by the user's field notes.
  const end=text.lastIndexOf('\n]');
  const records=JSON.parse(text.slice(0,end+2)) as Array<{time:string;fields:Array<{off:number;text:string}>;flags:{at196:string};tailHex:string}>;
  const events=records.map((r,i)=>{
    const field=(off:number)=>r.fields.find(f=>f.off===off)?.text??"?";
    const tail=Buffer.from(r.tailHex,"hex");
    if(tail.length!==34)throw new Error("Unexpected candidate tail");
    const xyz=[9,13,17].map(off=>tail.readFloatLE(off));
    if(!xyz.every(Number.isFinite))throw new Error("Invalid candidate coordinates");
    return {id:i,time:r.time,ours:field(201),opponent:field(263),guild:field(72),outcome:r.flags.at196.startsWith("01")?"kill":r.flags.at196.startsWith("00")?"death":"unknown",xyz};
  });
  return <CombatMapPreview events={events}/>;
}
