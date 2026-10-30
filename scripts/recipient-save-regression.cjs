const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require(process.argv[3] + '/typescript');
const tables = {};
for (const name of ['emailCampaigns','campaignRecipients','agentContacts','mortgageClients','leads','integrations']) {
 tables[name] = new Proxy({name}, {get: (t,k) => k === 'name' ? t.name : {table:name,key:k}});
}
let state, failInsert;
const eq = (col,value) => row => row[col.key] === value;
const and = (...predicates) => row => predicates.every(p=>p(row));
function sql(strings,...args) {
 const text=strings.join('?');
 if(text.includes('count(*)')) return {count:true};
 if(text.includes('JSON_CONTAINS')) return row => (row[args[0].key] || []).includes(JSON.parse(args[1]));
 if(text.includes('NOT EXISTS')) return row => !state.campaignRecipients.some(r=>r.leadId===row.id && r.status==='unsubscribed');
 return () => true;
}
const db = {
 select(fields) {
  let table, predicate=()=>true, maximum=Infinity;
  const q={from(t){table=t.name;return q},where(p){predicate=p||(()=>true);return q},limit(n){maximum=n;return q},for(){return q},
   then(resolve,reject){try {let rows=state[table].filter(predicate).slice(0,maximum);resolve(fields?.count ? [{count:rows.length}] : rows.map(r=> fields ? Object.fromEntries(Object.entries(fields).map(([k,c])=>[k,r[c.key]])) : structuredClone(r)));}catch(e){reject(e)}}};return q;
 },
 insert(table){return {values:async values=>{
  if(failInsert && table.name==='campaignRecipients')throw new Error('insert failed');
  const rows=Array.isArray(values)?values:[values]; let id;
  for(const value of rows){id=state[table.name].length+1;state[table.name].push({id,status:table.name==='emailCampaigns'?'draft':'pending',totalRecipients:0,totalSent:0,...structuredClone(value)})}return [{insertId:id}];
 }}},
 update(table){return {set(values){return {where:async predicate=>{for(const row of state[table.name])if(predicate(row))Object.assign(row,structuredClone(values));return [{affectedRows:1}];}}}}},
 delete(table){return {where:async predicate=>{state[table.name]=state[table.name].filter(r=>!predicate(r));}}},
 async transaction(fn){const before=structuredClone(state);try{return await fn(db)}catch(e){state=before;throw e}}
};
const procedure={input(){return procedure},query(fn){return fn},mutation(fn){return fn}};
const mocks={
 '../_core/trpc':{router:x=>x,protectedProcedure:procedure,publicProcedure:procedure},
 '../db':{getDb:async()=>db},
 '../unsubscribe':{unsubscribeByTrackingId:async()=>{}},
 '../bulkEmail':{getBulkEmailSettings:async()=>null,isUsable:()=>false,usesBulkSender:()=>false},
 '../../drizzle/schema':tables,
 'drizzle-orm':{eq,and,sql,desc:x=>x,or:(...ps)=>r=>ps.some(p=>p(r)),inArray:(c,vs)=>r=>vs.includes(r[c.key])},
 '../email':{sendEmail:()=>{throw new Error('Saving must not send mail')}}
};
const realRequire=require('node:module').createRequire(path.resolve(process.argv[3],'../package.json'));
const filename=process.argv[2];
const source=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const mod={exports:{}};
vm.runInNewContext('(function(require,module,exports){'+source+'})',{console,process,setTimeout})(id=>mocks[id]??realRequire(id),mod,mod.exports);
const api=mod.exports.campaignsRouter;
const base={audience:'re_agent',name:'Review',subject:'Home',bodyHtml:'<p>Hello</p>',fromName:'Scott',batchSize:50,batchDelayMinutes:15};
function reset(){failInsert=false;state={emailCampaigns:[],campaignRecipients:[],mortgageClients:[],leads:[],integrations:[],agentContacts:[
 {id:1,email:'a@example.test',firstName:'A',lastName:'One',city:'Plain City',optedOut:false,tags:['listing']},
 {id:2,email:'b@example.test',firstName:'B',lastName:'Two',city:'Ogden',optedOut:false,tags:[]},
 {id:3,email:'c@example.test',firstName:'C',lastName:'Three',city:'Plain City',optedOut:true,tags:['listing']}
 ]};}
const tests=[
 ['create loads recipients and count without sending',async()=>{await api.create({input:base,ctx:{user:{id:1}}});assert.equal(state.emailCampaigns[0].totalRecipients,2);assert.deepEqual(state.campaignRecipients.map(r=>r.agentContactId),[1,2]);assert.equal(state.emailCampaigns[0].status,'draft');assert.equal(state.emailCampaigns[0].totalSent,0);assert.ok(state.campaignRecipients.every(r=>r.status==='pending'));}],
 ['save applies edited filters and replaces prior loaded list',async()=>{state.emailCampaigns=[{id:1,status:'draft',...base,totalRecipients:2,totalSent:0}];state.campaignRecipients=[{campaignId:1,agentContactId:2,status:'pending'}];await api.update({input:{id:1,filterCity:'Plain City'}});assert.equal(state.emailCampaigns[0].totalRecipients,1);assert.deepEqual(state.campaignRecipients.map(r=>r.agentContactId),[1]);assert.equal(state.emailCampaigns[0].status,'draft');}],
 ['content-only save refreshes newly opted-out recipients',async()=>{state.emailCampaigns=[{id:1,status:'draft',...base,totalRecipients:2}];state.agentContacts[1].optedOut=true;await api.update({input:{id:1,subject:'Updated'}});assert.equal(state.emailCampaigns[0].totalRecipients,1);}],
 ['save with no matches clears old list and shows zero',async()=>{state.emailCampaigns=[{id:1,status:'draft',...base,totalRecipients:2}];state.campaignRecipients=[{campaignId:1,agentContactId:1,status:'pending'}];await api.update({input:{id:1,filterCity:'No matches'}});assert.equal(state.emailCampaigns[0].totalRecipients,0);assert.equal(state.campaignRecipients.length,0);}],
 ['paused content save preserves sent history and recipient count',async()=>{state.emailCampaigns=[{id:1,...base,status:'paused',totalRecipients:2,totalSent:1}];state.campaignRecipients=[{campaignId:1,agentContactId:1,status:'sent'},{campaignId:1,agentContactId:2,status:'pending'}];const before=structuredClone(state.campaignRecipients);await api.update({input:{id:1,subject:'Corrected'}});assert.deepEqual(state.campaignRecipients,before);assert.equal(state.emailCampaigns[0].totalRecipients,2);assert.equal(state.emailCampaigns[0].totalSent,1);}],
 ['failed recipient load rolls back the saved content and list',async()=>{state.emailCampaigns=[{id:1,status:'draft',...base,totalRecipients:1}];state.campaignRecipients=[{campaignId:1,agentContactId:2,status:'pending'}];const before=structuredClone(state);failInsert=true;await assert.rejects(api.update({input:{id:1,subject:'Must roll back'}}),/insert failed/);assert.deepEqual(state,before);}]
];

 tests.push(['saving one draft leaves other campaign recipients untouched',async()=>{state.emailCampaigns=[{id:1,status:'draft',...base,totalRecipients:0}];state.campaignRecipients=[{campaignId:99,agentContactId:3,status:'sent'}];await api.update({input:{id:1,subject:'Updated'}});assert.deepEqual(state.campaignRecipients.filter(r=>r.campaignId===99),[{campaignId:99,agentContactId:3,status:'sent'}]);assert.equal(state.emailCampaigns[0].totalRecipients,2);}]);
 tests.push(['tag filter loads only eligible tagged agents',async()=>{await api.create({input:{...base,filterTags:['listing']},ctx:{user:{id:1}}});assert.deepEqual(state.campaignRecipients.map(r=>r.agentContactId),[1]);assert.equal(state.emailCampaigns[0].totalRecipients,1);}]);
 tests.push(['recipient insert failure rolls back new campaign creation',async()=>{failInsert=true;await assert.rejects(api.create({input:base,ctx:{user:{id:1}}}),/insert failed/);assert.equal(state.emailCampaigns.length,0);assert.equal(state.campaignRecipients.length,0);}]);
 tests.push(['saving more than one batch loads every recipient',async()=>{state.agentContacts=Array.from({length:205},(_,i)=>({id:i+1,email:'agent'+i+'@example.test',firstName:'Agent',lastName:'Test',optedOut:false}));await api.create({input:base,ctx:{user:{id:1}}});assert.equal(state.emailCampaigns[0].totalRecipients,205);assert.equal(state.campaignRecipients.length,205);assert.equal(new Set(state.campaignRecipients.map(r=>r.trackingId)).size,205);}]);

tests.push(['send refuses an unloaded draft instead of silently loading its audience',async()=>{state.emailCampaigns=[{id:1,status:'draft',...base,totalRecipients:0,totalSent:0}];state.integrations=[{provider:'gmail',accessToken:'test-only',accountEmail:'sender@example.test'}];await assert.rejects(api.send({input:{id:1}}),/Edit and save/);assert.equal(state.emailCampaigns[0].status,'draft');assert.equal(state.campaignRecipients.length,0);}]);
(async()=>{let failed=0;for(const [name,test] of tests){reset();try{await test();console.log('PASS '+name)}catch(e){failed++;console.log('FAIL '+name+': '+e.message)}}process.exitCode=failed?1:0;})();
