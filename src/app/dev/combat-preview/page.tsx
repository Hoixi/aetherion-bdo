import {notFound} from "next/navigation";
import {CombatAnalysisDesk} from "@/components/combat-analysis-desk";
export default function Preview(){
  if(process.env.NODE_ENV!=="development"||process.env.ENABLE_COMBAT_BETA!=="1")notFound();
  return <CombatAnalysisDesk warId={77} preview={{id:1,title:"Örnek kayıt",allianceName:"GoldAether (örnek)",startedAt:"2026-09-24T17:00:00Z",endedAt:"2026-09-24T17:05:00Z",directionVerified:false,events:[{receivedAtMs:Date.parse("2026-09-24T17:01:10Z"),firstFamily:"ÖrnekOyuncuA",secondFamily:"ÖrnekRakipB"},{receivedAtMs:Date.parse("2026-09-24T17:02:20Z"),firstFamily:"ÖrnekRakipC",secondFamily:"ÖrnekOyuncuD"}]}}/>;
}
