// Pure decoder and transactional store contract tests. No network, credentials or real DB.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, mocks = {}) {
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  const fn = vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename: file });
  fn(name => name in mocks ? mocks[name] : require(name), module, module.exports);
  return module.exports;
}
const { parseCombatBatch, decodeCombatFrame, readCombatBody } = load('src/lib/combat-ingest.ts');
function frame(kill = true) {
  const b = Buffer.alloc(359); Buffer.from([0x67, 1, 0, 0xe1, 0x11]).copy(b);
  for (const [off, s] of [[5,'BizKarakter'],[72,'KAWGADAOLUR'],[134,'RakipKarakter'],[201,'Xiuu'],[263,'ENTRØPY']]) b.write(s,off,'utf16le');
  b[196] = +kill; b.writeFloatLE(-5150.311,334); b.writeFloatLE(-1950.630,338); b.writeFloatLE(48224.359,342);
  return b;
}
const raw = frame().toString('base64'), at = Date.now() - 10000;
function body(seq = 1, extra = {}) { return { id:'test-session-001',warId:12,allianceName:'GoldAether',parserVersion:'bdo-nodewar-11e1-v2',startedAtMs:at,endedAtMs:null,phase:'listening',throughSeq:seq,final:false,events:[{seq,receivedAtMs:at+seq,rawBase64:raw}],...extra }; }
const actor = { id:7, guildId:3, isAdmin:true, isGuildAdmin:false };
let sessions = new Map(), events = new Map();
const key = (s, seq) => `${s}/${seq}`;
const tx = {
  $queryRaw: async () => [],
  combatSession: {
    findUnique: async ({where}) => sessions.get(where.id) ?? null,
    create: async ({data}) => { const s = {...data,lastSeq:0,endedAt:null,phase:'listening'};sessions.set(s.id,s);return s; },
    update: async ({where,data}) => { const s = {...sessions.get(where.id),...data};sessions.set(s.id,s);return s; },
  },
  combatEvent: {
    findMany: async ({where}) => [...events.values()].filter(e => e.sessionId === where.sessionId && e.seq >= where.seq.gte && e.seq <= where.seq.lte),
    createMany: async ({data}) => { for (const e of data) { assert(!events.has(key(e.sessionId,e.seq)));events.set(key(e.sessionId,e.seq),e); } },
    aggregate: async ({where}) => ({_max:{receivedAt:[...events.values()].filter(e=>e.sessionId===where.sessionId).map(e=>e.receivedAt).sort((a,b)=>b-a)[0] ?? null}}),
  },
};
const prisma = { $transaction: async fn => {
  const savedSessions = structuredClone(sessions), savedEvents = structuredClone(events);
  try { return await fn(tx); } catch (e) { sessions = savedSessions;events = savedEvents;throw e; }
}, war:{findFirst:async ({where})=>where.id===12?{id:12}:null} };
const {storeCombatBatch,canAccessCombat} = load('src/lib/combat-session-store.ts', {
  '@/lib/prisma':{prisma},
  '@/lib/bdo-report-import':{canImportReports:async me=>me.isAdmin||(me.isGuildAdmin&&me.guildId!==null),reportWarScope:async()=>({})},
});
(async () => {
  assert.equal(decodeCombatFrame(raw).killerFamily,'Xiuu');
  assert.equal(decodeCombatFrame(frame(false).toString('base64')).killerFamily,'ENTRØPY');
  assert.equal(decodeCombatFrame(raw).positionVerified,false);
  for (const mutate of [b=>b[196]=2,b=>b.writeFloatLE(NaN,334),b=>b[0]=0]) { const b=frame();mutate(b);assert.throws(()=>decodeCombatFrame(b.toString('base64'))); }
  assert.throws(()=>parseCombatBatch(body(1,{parserVersion:'v1'})));
  assert.throws(()=>parseCombatBatch(body(2,{throughSeq:1})));
  assert.throws(()=>parseCombatBatch(body(1,{events:Array(101).fill(body().events[0])})));
  assert.throws(()=>parseCombatBatch(body(1,{events:[{...body().events[0],receivedAtMs:at-120000}]})));
  await assert.rejects(readCombatBody(new Request('https://test',{method:'POST',body:' '.repeat(129*1024)})));
  const ack = await storeCombatBatch(actor,parseCombatBatch(body()));
  assert.equal(ack.throughSeq,1);assert.equal(events.size,1);
  await storeCombatBatch(actor,parseCombatBatch(body()));assert.equal(events.size,1);
  await assert.rejects(storeCombatBatch(actor,parseCombatBatch(body(1,{events:[{seq:1,receivedAtMs:at+1,rawBase64:frame(false).toString('base64')}]}))));
  await assert.rejects(storeCombatBatch(actor,parseCombatBatch(body(3))));
  await assert.rejects(storeCombatBatch(actor,parseCombatBatch(body(2,{warId:13}))));
  assert.equal(events.size,1);
  await storeCombatBatch({...actor,id:8,guildId:4},parseCombatBatch(body()));
  assert.equal(sessions.size,2);assert.equal(events.size,2); // Ally session never replaces ours.
  const close = parseCombatBatch(body(1,{final:true,phase:'stopped',endedAtMs:at+5000,events:[]}));
  await storeCombatBatch(actor,close);await storeCombatBatch(actor,close);
  await assert.rejects(storeCombatBatch(actor,parseCombatBatch(body(2))));
  await assert.rejects(storeCombatBatch(actor,{...close,endedAtMs:at+6000}));
  assert.equal(events.size,2);
  await storeCombatBatch(actor,parseCombatBatch(body(0,{id:'empty-session-001',events:[],final:true,phase:'error',endedAtMs:at})));
  assert.equal(sessions.size,3);
  assert.equal(await canAccessCombat({...actor,isAdmin:false},12),false);
  assert.equal(await canAccessCombat(actor,0),false);
  assert.equal(await canAccessCombat(actor,13),false);
  assert.equal(await canAccessCombat(actor,12),true);
  console.log('PASS: decoder/limits, replay/conflicts, gaps, finalization, ally preservation, authorization contract (mock DB).');
})().catch(e=>{console.error(e);process.exitCode=1;});
