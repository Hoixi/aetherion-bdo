import {notFound} from "next/navigation";
import {WarAtlas} from "@/components/war-atlas";
export default function Page(){if(process.env.NODE_ENV!=="development"||process.env.ENABLE_COMBAT_BETA!=="1")notFound();return <WarAtlas/>;}
