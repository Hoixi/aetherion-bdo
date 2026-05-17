export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { BDO_CLASSES } from "@/lib/classes";

const CATEGORY_TAGS = [
  { name: "Node War",  slug: "node-war",  color: "#e74c3c" },
  { name: "Siege",     slug: "siege",     color: "#c0392b" },
  { name: "PvP",       slug: "pvp",       color: "#e67e22" },
  { name: "PvE",       slug: "pve",       color: "#27ae60" },
  { name: "Grind",     slug: "grind",     color: "#2ecc71" },
  { name: "Build",     slug: "build",     color: "#3498db" },
  { name: "Ekonomi",   slug: "ekonomi",   color: "#f1c40f" },
  { name: "Genel",     slug: "genel",     color: "#95a5a6" },
  { name: "Duyuru",    slug: "duyuru",    color: "#d4a853" },
];

// İlk çağrıda tagları oluştur (seed)
async function ensureTags() {
  const existing = await prisma.forumTag.count();
  if (existing > 0) return;

  const categoryData = CATEGORY_TAGS.map((t) => ({
    name: t.name, slug: t.slug, type: "CATEGORY" as const, color: t.color,
  }));

  const classData = BDO_CLASSES.map((c) => ({
    name: c.name,
    slug: `class-${c.id}`,
    type: "CLASS" as const,
    color: "#7c6f9f",
  }));

  await prisma.forumTag.createMany({ data: [...categoryData, ...classData], skipDuplicates: true });
}

export async function GET() {
  await ensureTags();
  const tags = await prisma.forumTag.findMany({ orderBy: [{ type: "asc" }, { name: "asc" }] });
  return NextResponse.json(tags);
}
