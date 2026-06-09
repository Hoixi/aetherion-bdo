export const dynamic = "force-dynamic";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN!;
const APPLICATION_ID = process.env.DISCORD_APPLICATION_ID!;

const COMMANDS = [
  {
    name: "gs-güncelle",
    description: "GS bilgilerini kaydet veya güncelle",
    options: [
      { type: 3, name: "aile", description: "Aile ismin", required: true },
      { type: 10, name: "ap", description: "AP değerin", required: true },
      { type: 10, name: "dp", description: "DP değerin", required: true },
      { type: 3, name: "class1", description: "Sınıfın (1. grup: Savaşçı → Büyücü)", required: false, choices: [
        { name: "Savaşçı", value: "savasci" }, { name: "Hashashin", value: "hashashin" },
        { name: "Sage", value: "sage" }, { name: "Wukong", value: "wukong" },
        { name: "Okçu", value: "okcu" }, { name: "Guardian", value: "guardian" },
        { name: "Bilge", value: "bilge" }, { name: "Drakania", value: "drakania" },
        { name: "Sahire", value: "sahire" }, { name: "Nova", value: "nova" },
        { name: "Corsair", value: "corsair" }, { name: "Lahn", value: "lahn" },
        { name: "Vahşi", value: "vahsi" }, { name: "Maegu", value: "maegu" },
        { name: "Avcı", value: "avci" }, { name: "Shai", value: "shai" },
        { name: "Musa", value: "musa" }, { name: "Striker", value: "striker" },
        { name: "Maehwa", value: "maehwa" }, { name: "Mistik", value: "mistik" },
        { name: "Valkyrie", value: "valkyrie" }, { name: "Kunoichi", value: "kunoichi" },
        { name: "Ninja", value: "ninja" }, { name: "Kara Şövalye", value: "kara_sovalye" },
        { name: "Büyücü", value: "buyucu" },
      ]},
      { type: 3, name: "class2", description: "Sınıfın (2. grup: Archer → Deadeye)", required: false, choices: [
        { name: "Archer", value: "archer" }, { name: "Cadı", value: "cadi" },
        { name: "Woosa", value: "woosa" }, { name: "Seraph", value: "seraph" },
        { name: "Dosa", value: "dosa" }, { name: "Deadeye", value: "deadeye" },
      ]},
    ],
  },
  {
    name: "gs",
    description: "Kendi veya bir üyenin GS bilgisini göster",
    options: [
      { type: 6, name: "üye", description: "GS'ini görmek istediğin üye", required: false },
    ],
  },
  {
    name: "profil",
    description: "Detaylı profil görüntüle",
    options: [
      { type: 6, name: "üye", description: "Profili görmek istediğin üye", required: false },
      { type: 3, name: "aile", description: "Aile ismine göre ara", required: false },
    ],
  },
  {
    name: "sıralama",
    description: "GS sıralamasını göster (Top 20)",
  },
  {
    name: "klan",
    description: "Klan genel istatistiklerini göster",
  },
  {
    name: "savaş",
    description: "Yaklaşan savaşları listele",
  },
  {
    name: "savaşlar",
    description: "Tüm savaş geçmişini göster",
  },
  {
    name: "katılım",
    description: "Kendi katılım istatistiklerini göster",
  },
  {
    name: "katılım-liste",
    description: "Bir savaşın katılım listesini göster",
    options: [
      { type: 3, name: "savaş", description: "Savaş başlığından ara (boş bırakırsan son savaş)", required: false },
    ],
  },
  {
    name: "login",
    description: "Siteye giris icin tek kullanimlik linki DM olarak gonder",
  },
  {
    name: "partiboss",
    description: "Boss partisi oluştur",
    options: [
      { type: 3, name: "boss", description: "Boss adı", required: false },
    ],
  },
  {
    name: "etkinlikler",
    description: "Aktif etkinlikleri listele",
  },
  {
    name: "etkinlik-olustur",
    description: "Yeni bir etkinlik oluştur (oluşturan otomatik katılır, 2 saat sonra silinir)",
    options: [
      {
        type: 3,
        name: "tip",
        description: "Etkinlik tipi",
        required: true,
        choices: [
          { name: "🏰 Kara Tapınak (5 kişi)", value: "kara_tapinak" },
          { name: "🩸 Kan Altarı (3 kişi)", value: "kan_altari" },
          { name: "⚔️ Parti Slotları", value: "parti_slotlari" },
        ],
      },
      {
        type: 4,
        name: "boyut",
        description: "Parti büyüklüğü (sadece Parti Slotları için): 3 veya 5",
        required: false,
        choices: [
          { name: "3 kişi", value: 3 },
          { name: "5 kişi", value: 5 },
        ],
      },
    ],
  },
  {
    name: "savaş-aç",
    description: "[Admin] Yeni savaş oluştur ve duyur",
    options: [
      { type: 3, name: "başlık", description: "Savaş başlığı", required: true },
      { type: 3, name: "tarih", description: "Tarih (GG.AA.YYYY SS:DD)", required: true },
      { type: 3, name: "tür", description: "Savaş türü", required: false, choices: [
        { name: "Node War", value: "NODE_WAR" },
        { name: "Siege", value: "SIEGE" },
      ]},
      { type: 4, name: "max", description: "Maks katılımcı sayısı", required: false },
    ],
  },
  {
    name: "gear-eksik",
    description: "[Admin] GS girmeyenleri listele",
    options: [
      { type: 5, name: "dm", description: "Eksik GS üyelerine DM at?", required: false },
    ],
  },
  {
    name: "yardım",
    description: "Tüm bot komutlarını listele",
  },
];

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (!APPLICATION_ID) return NextResponse.json({ error: "DISCORD_APPLICATION_ID not set" }, { status: 500 });

  const res = await fetch(`https://discord.com/api/v10/applications/${APPLICATION_ID}/commands`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bot ${BOT_TOKEN}`,
    },
    body: JSON.stringify(COMMANDS),
  });

  const data = await res.json();
  if (!res.ok) return NextResponse.json({ error: data }, { status: res.status });

  return NextResponse.json({ ok: true, registered: (data as unknown[]).length });
}
