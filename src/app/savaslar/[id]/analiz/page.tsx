import {notFound,redirect} from "next/navigation";
import {getServerSession} from "next-auth";
import {authOptions} from "@/lib/auth";
import {CombatAnalysisDesk} from "@/components/combat-analysis-desk";
export const dynamic="force-dynamic";
export default async function CombatAnalysisPage({params}:{params:{id:string}}){
  if(process.env.ENABLE_COMBAT_BETA!=="1")notFound();
  const session=await getServerSession(authOptions);
  if(!session)redirect("/");
  if(!session.user.isAdmin&&!session.user.isGuildAdmin)notFound();
  const warId=Number(params.id);if(!Number.isSafeInteger(warId)||warId<=0)notFound();
  return <CombatAnalysisDesk warId={warId}/>;
}
