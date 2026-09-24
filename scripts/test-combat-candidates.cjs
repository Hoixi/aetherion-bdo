const assert=require('node:assert/strict');const fs=require('node:fs');const ts=require('typescript');
function load(file,mocks={}){const m={exports:{}};const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;new Function('require','module','exports',js)(n=>n in mocks?mocks[n]:require(n),m,m.exports);return m.exports;}
const decoder=load('src/lib/combat-candidates.ts');
function fixture(){const b=Buffer.alloc(344);Buffer.from('2e0301000301020000a70000ae1c','hex').copy(b);Buffer.from('a70000ae1c','hex').copy(b,217);Buffer.from('ÖrnekA\0','utf16le').copy(b,80);Buffer.from('ÖrnekB\0','utf16le').copy(b,288);return b.toString('base64');}
const raw=fixture(),start=Date.now()-10000;
const archive={id:'test-recording-123',warId:77,allianceName:'GoldAether',parserVersion:decoder.COMBAT_VERSION,startedAtMs:start,endedAtMs:start+5000,phase:'stopped',archivePath:'PRIVATE_LOCAL_PATH',events:[{receivedAtMs:start+1000,firstFamily:'forged',gameX:123,rawBase64:raw}]};
const result=decoder.decodeCombatArchive(archive);
assert.equal(result.events[0].firstFamily,'ÖrnekA');assert.equal(result.events[0].secondFamily,'ÖrnekB');assert.equal(result.events[0].gameX,undefined);assert.equal(result.archivePath,undefined);
assert.throws(()=>decoder.decodeCombatArchive({...archive,phase:'listening'}));
assert.throws(()=>decoder.decodeCombatArchive({...archive,events:[{receivedAtMs:start-9999,rawBase64:raw}]}));
assert.throws(()=>decoder.decodeCandidate(Buffer.alloc(344).toString('base64'),start));
assert.throws(()=>decoder.decodeCandidate(raw.slice(0,-4),start));
assert.throws(()=>decoder.decodeCombatArchive({...archive,events:Array(5001).fill(archive.events[0])}));
let actor={id:1,isAdmin:false,isGuildAdmin:false,guildId:1};
const gate={withApp:async(req,fn)=>actor?fn(actor):new Response('',{status:401}),APP_HEADERS:{},appError:(error,status)=>Response.json({error},{status})};
const routes=load('src/app/api/app/wars/[id]/combat-recordings/route.ts',{'next/server':{NextResponse:Response},'@/lib/app-gate':gate,'@/lib/prisma':{prisma:{war:{findFirst:async()=>({id:77})}}},'@/lib/bdo-report-import':{canImportReports:async me=>me.isAdmin||me.isGuildAdmin,reportWarScope:async()=>({})},'@/lib/combat-candidates':decoder});
(async()=>{
  const req=()=>new Request('http://local/api/app/wars/77/combat-recordings',{method:'POST',body:JSON.stringify(archive)}),params={params:{id:'77'}};
  delete process.env.ENABLE_COMBAT_BETA;assert.equal((await routes.POST(req(),params)).status,404);
  process.env.ENABLE_COMBAT_BETA='1';actor=null;assert.equal((await routes.POST(req(),params)).status,401);
  actor={id:1,isAdmin:false,isGuildAdmin:false,guildId:1};assert.equal((await routes.POST(req(),params)).status,403);
  actor.isAdmin=true;assert.equal((await routes.POST(new Request('http://local',{method:'POST',body:JSON.stringify({...archive,warId:76})}),params)).status,409);
  console.log('PASS: raw decoding, Unicode, bounds, untrusted-field removal, stopped-only archives, beta gate, auth, war mismatch; no live DB writes');
})().catch(e=>{console.error(e);process.exitCode=1;});
