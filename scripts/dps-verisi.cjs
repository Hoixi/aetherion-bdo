#!/usr/bin/env node
/**
 * DPS sayfasının verisini Google Sheets'ten çeker.
 *
 *   node scripts/dps-verisi.cjs          → indir + ayrıştır + yaz
 *   node scripts/dps-verisi.cjs --cache  → daha önce indirilenleri yeniden kullan
 *
 * Kaynaklar:
 *   - Netherax'ın "DPS Summary" tablosu (canlı sekme + eski yama sekmeleri)
 *   - "Class Stats/Buffs" tablosu (AP, -DP, saldırı hızı, kritik)
 *   - Özet tablosunun "Sheet" sütunundaki her class'ın kendi DPS tablosu
 *     (kombolar ve beceri beceri hasar/kare/DPS dökümü)
 *
 * Çıktı:
 *   src/data/dps/ozet.json        → liste sayfası (statik import)
 *   public/veri/dps/<id>.json     → class detayı (istek anında yüklenir)
 *
 * Bağımlılık yok: xlsx bir zip, içindeki XML'i elle okuyoruz.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const zlib = require("zlib");

const DPS_ID = "1oP9pcp2EbS0ot48fhWJMbCI7S6pzBwl5v1j_UfnOT_I";
const DPS_GID = "1776846411";
const STATS_ID = "1G0M_wdsuBTxgmJ4wmtopuW0np7LyBzwcsma6tAE5Lb4";
const STATS_GID = "1033357356";

const ROOT = path.resolve(__dirname, "..");
const CACHE = path.join(os.tmpdir(), "aetherion-dps-cache");
const OUT_OZET = path.join(ROOT, "src", "data", "dps", "ozet.json");
const OUT_DETAY = path.join(ROOT, "public", "veri", "dps");
const useCache = process.argv.includes("--cache");

// ── xlsx okuyucu ─────────────────────────────────────────────────────────
function unzip(buf) {
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const files = {};
  for (let i = 0; i < count; i++) {
    const method = buf.readUInt16LE(p + 10);
    const csize = buf.readUInt32LE(p + 20);
    const nlen = buf.readUInt16LE(p + 28), xlen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32);
    const off = buf.readUInt32LE(p + 42);
    const name = buf.slice(p + 46, p + 46 + nlen).toString("utf8");
    const lnlen = buf.readUInt16LE(off + 26), lxlen = buf.readUInt16LE(off + 28);
    const data = buf.slice(off + 30 + lnlen + lxlen, off + 30 + lnlen + lxlen + csize);
    files[name] = () => (method === 0 ? data : zlib.inflateRawSync(data)).toString("utf8");
    p += 46 + nlen + xlen + clen;
  }
  return files;
}
const ent = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&amp;/g, "&");
const colNum = (c) => { let n = 0; for (const ch of c) n = n * 26 + (ch.charCodeAt(0) - 64); return n; };
const colName = (n) => { let s = ""; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };

function readXlsx(file) {
  const z = unzip(fs.readFileSync(file));
  const shared = [];
  if (z["xl/sharedStrings.xml"]) {
    for (const m of z["xl/sharedStrings.xml"]().matchAll(/<si>([\s\S]*?)<\/si>/g)) {
      shared.push(ent([...m[1].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join("")));
    }
  }
  const relMap = {};
  for (const m of z["xl/_rels/workbook.xml.rels"]().matchAll(/<Relationship ([^>]*)\/>/g)) {
    relMap[/Id="([^"]+)"/.exec(m[1])[1]] = /Target="([^"]+)"/.exec(m[1])[1].replace(/^\/?xl\//, "");
  }
  const sheets = [];
  for (const m of z["xl/workbook.xml"]().matchAll(/<sheet ([^>]*)\/>/g)) {
    const name = ent(/name="([^"]*)"/.exec(m[1])[1]);
    const state = (/state="([^"]+)"/.exec(m[1]) || [])[1];
    const file2 = "xl/" + relMap[/r:id="([^"]+)"/.exec(m[1])[1]];
    sheets.push({
      name, state,
      load() {
        const x = z[file2]();
        const rows = {};
        for (const c of x.matchAll(/<c r="([A-Z]+)(\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
          const [, col, row, attrs, inner] = c;
          if (!inner) continue;
          const t = (/t="([^"]+)"/.exec(attrs) || [])[1];
          let v = (/<v>([\s\S]*?)<\/v>/.exec(inner) || [])[1];
          if (t === "s") v = shared[+v];
          else if (t === "inlineStr") v = ent([...inner.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((q) => q[1]).join(""));
          else if (v !== undefined) v = ent(v);
          if (v === undefined) continue;
          const isText = t === "s" || t === "str" || t === "inlineStr" || t === "e" || t === "b";
          (rows[+row] ||= {})[col] = isText ? v : isNaN(+v) ? v : +v;
        }
        const links = {};
        const comments = {};
        const relFile = file2.replace(/worksheets\//, "worksheets/_rels/") + ".rels";
        if (z[relFile]) {
          const rm = {};
          for (const m2 of z[relFile]().matchAll(/<Relationship ([^>]*)\/>/g)) {
            const t = /Target="([^"]+)"/.exec(m2[1]);
            if (!t) continue;
            rm[/Id="([^"]+)"/.exec(m2[1])[1]] = ent(t[1]);
            // Hücre notları ("Comments (see notes)" sütunu bunlara atıf yapıyor)
            if (/\/comments"/.test(m2[1])) {
              const cf = "xl/" + t[1].replace(/^\.\.\//, "").replace(/^\/?xl\//, "");
              if (z[cf]) {
                for (const c of z[cf]().matchAll(/<comment [^>]*ref="([A-Z]+\d+)"[^>]*>([\s\S]*?)<\/comment>/g)) {
                  comments[c[1]] = ent([...c[2].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((q) => q[1]).join("")).trim();
                }
              }
            }
          }
          for (const h of x.matchAll(/<hyperlink ([^>]*)\/>/g)) {
            const rid = (/r:id="([^"]+)"/.exec(h[1]) || [])[1];
            if (rid && rm[rid]) links[/ref="([^"]+)"/.exec(h[1])[1]] = rm[rid];
          }
        }
        return { rows, links, comments };
      },
    });
  }
  return { sheets };
}

// ── indirme ──────────────────────────────────────────────────────────────
async function download(id) {
  const out = path.join(CACHE, id + ".xlsx");
  if (useCache && fs.existsSync(out)) return out;
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(`https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`, { redirect: "follow" });
      const ct = res.headers.get("content-type") || "";
      if (res.status === 401 || res.status === 403) return null; // paylaşıma kapalı
      if (res.ok && ct.includes("spreadsheet")) {
        fs.writeFileSync(out, Buffer.from(await res.arrayBuffer()));
        return out;
      }
    } catch { /* tekrar dene */ }
    await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
  }
  return fs.existsSync(out) ? out : null;
}

// ── yardımcılar ──────────────────────────────────────────────────────────
const num = (v) => (typeof v === "number" && isFinite(v) ? v : null);
const str = (v) => (v === undefined || v === null ? "" : String(v).trim());
const r2 = (v) => (v === null ? null : Math.round(v * 100) / 100);

const CLASS_MAP = {
  warrior: "savasci", ranger: "okcu", sorceress: "sahire", berserker: "vahsi", tamer: "avci",
  musa: "musa", maehwa: "maehwa", valkyrie: "valkyrie", kunoichi: "kunoichi", ninja: "ninja",
  wizard: "buyucu", witch: "cadi", "dark knight": "kara_sovalye", striker: "striker", mystic: "mistik",
  lahn: "lahn", archer: "archer", shai: "shai", guardian: "guardian", hashashin: "hashashin",
  nova: "nova", sage: "sage", corsair: "corsair", drakania: "drakania", woosa: "woosa",
  maegu: "maegu", scholar: "bilge", dosa: "dosa", deadeye: "deadeye", wukong: "wukong",
  seraph: "seraph", agent: "agent",
};

function parseSpec(label) {
  const m = /^(.*?)\s+(Awakening|Succession)$/i.exec(label);
  const cls = (m ? m[1] : label).trim();
  const spec = m ? m[2].toLowerCase() : null;
  const classId = CLASS_MAP[cls.toLowerCase()] ?? null;
  const slug = (cls + (spec ? "-" + (spec === "awakening" ? "awk" : "succ") : "")).toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return { className: cls, classId, spec, slug };
}

/** "17926" → "17/9/26", "2426" → "2/4/26", "pre-28825" → "28/8/25 öncesi" */
function tabLabel(name) {
  const pre = /^pre-?/i.test(name);
  const d = name.replace(/^pre-?/i, "").trim();
  if (!/^\d{4,6}$/.test(d)) return name;
  const y = d.slice(-2), rest = d.slice(0, -2);
  const [dd, mm] = rest.length === 2 ? [rest[0], rest[1]] : rest.length === 3 ? [rest.slice(0, 2), rest[2]] : [rest.slice(0, 2), rest.slice(2)];
  return `${+dd}/${+mm}/${y}` + (pre ? " öncesi" : "");
}

// ── özet tablosu ─────────────────────────────────────────────────────────
function readSummary(wb) {
  const live = wb.sheets[0].load();
  const specs = [];
  const seen = {};
  for (let r = 4; r <= 80; r++) {
    const row = live.rows[r];
    if (!row || !row.A || row.A === "Class/Spec") continue;
    const p = parseSpec(str(row.A));
    seen[p.slug] = (seen[p.slug] || 0) + 1;
    specs.push({
      id: seen[p.slug] > 1 ? `${p.slug}-${seen[p.slug]}` : p.slug,
      label: str(row.A),
      ...p,
      author: str(row.B) || null,
      sheet: str(row.C) || null,
      link: live.links["C" + r] || null,
      completeness: str(row.D) || null,
      sequence: str(row.E) || null,
      _tab: row.F !== undefined ? str(row.F) : null,
      _nameCol: str(row.G) || null,
      _importCols: str(row.H) || null,
      damage: r2(num(row.I)),
      frames: num(row.J),
      time: r2(num(row.K)),
      dps: r2(num(row.L)),
      dpsBefore: r2(num(row.M)),
      change: num(row.N),
      comment: str(row.P) || null,
      atkSpeedBuff: num(row.Q),
      aoe: str(row.R) || null,
      critDmg: num(row.S),
      notes: Object.fromEntries(
        [["spec", "A"], ["author", "B"], ["sheet", "C"], ["sequence", "E"], ["dps", "L"], ["comment", "P"], ["atkSpeed", "Q"], ["aoe", "R"]]
          .map(([k, c]) => [k, live.comments[c + r]]).filter(([, v]) => v)),
    });
  }
  // Sağdaki açıklama sütunu: başlık + (varsa) hücre notu
  const notes = [];
  for (let r = 1; r <= 80; r++) {
    const u = str(live.rows[r]?.U);
    if (!u || /^IMPORTRANGE|^\d|formula in the cell|^Template$|^DPS Sheet Template$|^Class Stats|^Current Expected|^Base Crit|^DISCLAIMER$/i.test(u)) continue;
    const note = live.comments["U" + r] || null;
    notes.push({ title: u, note });
  }
  const meta = {
    tab: tabLabel(wb.sheets[0].name),
    banner: str(live.rows[1]?.A).replace(/^\[Live\]\s*/i, ""),
    comparingTo: str(live.rows[1]?.N) || null,
    maintainer: str(live.rows[1]?.P) || null,
    discord: str(live.rows[2]?.R) || null,
    notes,
  };
  return { specs, meta };
}

function readHistory(wb, specs) {
  const tabs = [];
  const values = Object.fromEntries(specs.map((s) => [s.id, []]));
  const hist = wb.sheets.slice(1).filter((s) => s.name !== "Exports" && !/^BSR/i.test(s.name));
  // En eskiden en yeniye
  for (const s of hist.reverse()) {
    const d = s.load();
    const hk = Object.keys(d.rows).find((k) => d.rows[k].A === "Class/Spec");
    if (!hk) continue;
    const hdr = d.rows[hk];
    const col = (l) => Object.keys(hdr).find((c) => str(hdr[c]) === l);
    const cSeq = col("Sequence to get"), cDps = col("DPS");
    const rows = [];
    for (const k of Object.keys(d.rows).map(Number).filter((k) => k > +hk)) {
      const r = d.rows[k];
      if (r.A && num(r[cDps]) !== null) rows.push({ label: str(r.A), seq: str(r[cSeq]), dps: num(r[cDps]) });
    }
    const note = str(d.rows[1]?.A).split("\n")[0].replace(/^\[?outdated\]?\s*/i, "").replace(/^\(|\)$/g, "");
    tabs.push({ key: s.name, label: /summer/i.test(s.name) ? "Yaz Dengesi '26" : tabLabel(s.name), note: note && note !== "Class/Spec" ? note : null });
    for (const sp of specs) {
      const hit = rows.find((x) => x.label === sp.label && x.seq === sp.sequence)
        ?? (specs.filter((o) => o.label === sp.label).length === 1 ? rows.find((x) => x.label === sp.label) : undefined);
      values[sp.id].push(hit ? r2(hit.dps) : null);
    }
  }
  tabs.push({ key: wb.sheets[0].name, label: tabLabel(wb.sheets[0].name), note: "Canlı" });
  for (const sp of specs) values[sp.id].push(sp.dps);
  return { tabs, values };
}

// ── class statları ───────────────────────────────────────────────────────
function readStats(wb) {
  const d = wb.sheets[0].load();
  const out = {};
  const pct = (v) => (num(v) === null ? 0 : r2(num(v) * 100));
  for (const k of Object.keys(d.rows).map(Number).filter((k) => k > 1)) {
    const r = d.rows[k];
    if (!r.A) continue;
    out[str(r.A)] = {
      baseAp: num(r.D), passive: num(r.E) ?? 0, selfbuff: num(r.F) ?? 0, selfbuffType: str(r.G) || null,
      total: num(r.H), eBuff: num(r.J) ?? 0, eBuffType: str(r.K) || null, totalE: num(r.L),
      dp: num(r.N) ?? 0, dpType: str(r.O) || null, totalDp: num(r.P), totalEDp: num(r.Q),
      atkSpeed: [pct(r.S), pct(r.T), pct(r.U)],
      critDmg: [pct(r.W), pct(r.X), pct(r.Y)],
      critRate: [pct(r.AA), pct(r.AB), pct(r.AC)],
      extra: str(r.AE) || str(r.AD) || null,
    };
  }
  return out;
}

// ── class'ın kendi DPS tablosu ───────────────────────────────────────────
function pickTab(x, tab) {
  const norm = (t) => t.replace(/\//g, "").trim().toLowerCase();
  if (!tab) return null;
  return x.sheets.find((s) => norm(s.name) === norm(tab)) || x.sheets.find((s) => norm(s.name).startsWith(norm(tab)));
}

function extractDetail(spec, file) {
  const x = readXlsx(file);
  const sh = pickTab(x, spec._tab);
  if (!sh || !spec._nameCol || !spec._importCols) return null;
  const d = sh.load();
  const nc = spec._nameCol;
  const base = colNum(spec._importCols.split(":")[0]);
  const cD = colName(base), cF = colName(base + 1), cT = colName(base + 2), cP = colName(base + 3);
  const keys = Object.keys(d.rows).map(Number).sort((a, b) => a - b);
  const sections = [];
  const used = new Set();
  let cur = null, last = -1;

  const mkRow = (r, sec) => {
    const frames = num(r[cF]);
    let t = num(r[cT]);
    if (t !== null && t > 40) t /= 1000; // bazı tablolar süreyi ms yazıyor
    if (t === null && frames) t = frames / 60;
    const o = {
      name: str(r[nc]),
      damage: r2(num(r[cD])),
      frames: frames === null ? null : r2(frames),
      time: t === null ? null : Math.round(t * 1000) / 1000,
      dps: r2(num(r[cP])),
    };
    if (sec?.typeCol && str(r[sec.typeCol])) o.type = str(r[sec.typeCol]);
    if (sec?.inputCol && str(r[sec.inputCol]) && str(r[sec.inputCol]) !== "Read Note") o.input = str(r[sec.inputCol]);
    if (sec?.bsrCol && num(r[sec.bsrCol]) !== null) o.bsrDps = r2(num(r[sec.bsrCol]));
    if (sec?.critCol && num(r[sec.critCol]) !== null) o.crit = num(r[sec.critCol]);
    return o;
  };

  for (const k of keys) {
    const r = d.rows[k];
    const name = str(r[nc]);
    if (typeof r[cD] === "string" && /damage/i.test(r[cD])) {
      const cols = {};
      for (const [c, v] of Object.entries(r)) cols[str(v).toLowerCase()] ??= c;
      cur = { title: name, typeCol: cols.type, inputCol: cols.input, bsrCol: cols["bsr dps"], critCol: cols["crit rate"], rows: [] };
      sections.push(cur);
      last = k;
      continue;
    }
    if (!cur) continue;
    if (k - last > 2 && cur.rows.length) { cur = null; continue; }
    if (!name || num(r[cP]) === null) continue;
    if (/^mathblock$/i.test(name)) continue;
    last = k;
    used.add(k);
    cur.rows.push(mkRow(r, cur));
  }

  const combos = [], skills = [];
  const pushCombo = (c) => { if (!combos.some((o) => o.name === c.name)) combos.push(c); };
  const isComboName = (n) => n === spec.sequence || /combo|rotation|rota\b|priority/i.test(n);

  for (const s of sections.filter((s) => s.rows.length)) {
    const rows = s.rows;
    const lastR = rows[rows.length - 1];
    const sumPrev = rows.slice(0, -1).reduce((a, b) => a + (b.damage || 0), 0);
    // Menzies düzeni: bölümün son satırı, üstündeki becerilerin toplamı olan kombo
    if (rows.length >= 3 && lastR.damage && Math.abs(sumPrev - lastR.damage) / lastR.damage < 0.03) {
      pushCombo({ ...lastR, steps: rows.slice(0, -1).map(({ name, damage, time, dps }) => ({ name, damage, time, dps })) });
      continue;
    }
    if (/combo/i.test(s.title) || (rows.length <= 10 && rows.every((r) => !r.type) && rows.some((r) => r.name === spec.sequence))) {
      rows.forEach(pushCombo);
      continue;
    }
    for (const r of rows) {
      if (isComboName(r.name) && (r.time ?? 0) > 3 && !r.input) pushCombo(r);
      // Aynı beceri ikinci bir blokta (ör. farklı mermi türü) tekrar ediyorsa ilki kalsın
      else if (!skills.some((o) => o.name === r.name)) skills.push(r);
    }
  }
  // Bölüm dışında kalan kombo satırları (ör. Deadeye'nin alttaki özet bloğu)
  for (const k of keys) {
    if (used.has(k)) continue;
    const r = d.rows[k];
    const name = str(r[nc]);
    if (name && num(r[cP]) !== null && num(r[cD]) !== null && isComboName(name)) pushCombo(mkRow(r, null));
  }
  if (!combos.length && !skills.length) return null;
  skills.sort((a, b) => (b.dps ?? 0) - (a.dps ?? 0));
  combos.forEach((c) => { if (c.name === spec.sequence) c.summary = true; });
  return { tab: sh.name, combos, skills };
}

// ── ana akış ─────────────────────────────────────────────────────────────
(async () => {
  fs.mkdirSync(CACHE, { recursive: true });
  fs.mkdirSync(path.dirname(OUT_OZET), { recursive: true });
  fs.mkdirSync(OUT_DETAY, { recursive: true });

  console.log("özet ve stat tabloları indiriliyor…");
  const [dpsFile, statsFile] = await Promise.all([download(DPS_ID), download(STATS_ID)]);
  if (!dpsFile || !statsFile) throw new Error("Ana tablolar indirilemedi");
  const dpsWb = readXlsx(dpsFile);
  const { specs, meta } = readSummary(dpsWb);
  const history = readHistory(dpsWb, specs);
  const stats = readStats(readXlsx(statsFile));

  const ids = [...new Set(specs.map((s) => s.link && /\/d\/([\w-]+)/.exec(s.link)?.[1]).filter(Boolean))];
  console.log(`${ids.length} class tablosu indiriliyor…`);
  const files = {};
  for (let i = 0; i < ids.length; i += 8) {
    await Promise.all(ids.slice(i, i + 8).map(async (id) => { files[id] = await download(id); }));
  }

  for (const f of fs.readdirSync(OUT_DETAY)) fs.unlinkSync(path.join(OUT_DETAY, f));
  let ok = 0;
  for (const s of specs) {
    const id = s.link && /\/d\/([\w-]+)/.exec(s.link)?.[1];
    s.detail = false;
    s.private = false;
    if (!id) continue;
    if (!files[id]) { s.private = true; continue; }
    try {
      const det = extractDetail(s, files[id]);
      if (det) {
        fs.writeFileSync(path.join(OUT_DETAY, s.id + ".json"), JSON.stringify(det));
        s.detail = true;
        s.comboCount = det.combos.length;
        s.skillCount = det.skills.length;
        ok++;
      }
    } catch (e) { console.warn("  ayrıştırılamadı:", s.label, e.message); }
  }

  const ranked = specs.filter((s) => s.dps !== null).sort((a, b) => b.dps - a.dps);
  ranked.forEach((s, i) => { s.rank = i + 1; });
  const out = {
    generatedAt: new Date().toISOString(),
    sources: {
      dps: `https://docs.google.com/spreadsheets/d/${DPS_ID}/edit?gid=${DPS_GID}`,
      stats: `https://docs.google.com/spreadsheets/d/${STATS_ID}/edit?gid=${STATS_GID}`,
    },
    meta,
    history,
    specs: specs.map(({ _tab, _nameCol, _importCols, ...s }) => ({ ...s, stats: stats[s.label] ?? null })),
    statsOnly: Object.entries(stats)
      .filter(([label]) => !specs.some((s) => s.label === label))
      .map(([label, st]) => ({ label, ...parseSpec(label), stats: st })),
  };
  fs.writeFileSync(OUT_OZET, JSON.stringify(out, null, 1));
  console.log(`tamam: ${specs.length} satır, ${ranked.length} sıralı, ${ok} detay → ${path.relative(ROOT, OUT_OZET)}`);
})().catch((e) => { console.error(e); process.exit(1); });
