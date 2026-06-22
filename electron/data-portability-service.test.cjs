const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { createDataPortabilityService, sanitizeFileName } = require('./data-portability-service.cjs');

test('exports markdown, JSON, attachments, and a restorable backup', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'memo-port-'));
  const data = path.join(root, 'data'); const output = path.join(root, 'out');
  await fs.mkdir(path.join(data, 'attachments', 'n1'), { recursive: true });
  await fs.writeFile(path.join(data, 'attachments', 'n1', 'a.png'), 'image');
  const payload = { schemaVersion: 2, notes: [{ id:'n1', title:'A:B', content:'body', categoryId:'c1', tagIds:['t1'], stockName:'股', stockCode:'1', attachmentIds:['a1'], createdAt:'2026-01-01T00:00:00Z', updatedAt:'2026-01-02T00:00:00Z' }], categories:[{id:'c1',name:'分类'}], tags:[{id:'t1',name:'标签'}], attachments:[{id:'a1',noteId:'n1',fileName:'a.png',filePath:path.join(data,'attachments','n1','a.png'),type:'image/png'}] };
  await fs.mkdir(data, { recursive:true }); await fs.writeFile(path.join(data,'notes.json'), JSON.stringify(payload)); await fs.writeFile(path.join(data,'settings.json'), JSON.stringify({schemaVersion:1,theme:'dark'}));
  const service = createDataPortabilityService({ dataDirectory:data, now:()=>new Date('2026-06-22T01:02:03Z') });
  const md = await service.exportMarkdown(output, payload);
  const markdown = await fs.readFile(path.join(md,'notes','2026-01-01-A_B.md'),'utf8');
  assert.match(markdown, /分类/); assert.match(markdown, /\.\.\/attachments\/note_n1\/a\.png/);
  const jsonDir = await service.exportJson(output, payload, {schemaVersion:1,theme:'dark'});
  assert.equal(JSON.parse(await fs.readFile(path.join(jsonDir,'data.json'),'utf8')).notes.length, 1);
  const backup = await service.backup(output); assert.equal(await fs.readFile(path.join(backup,'attachments','n1','a.png'),'utf8'),'image');
  const backupData = JSON.parse(await fs.readFile(path.join(backup,'notes.json'),'utf8'));
  assert.equal(backupData.attachments[0].filePath, 'attachments/n1/a.png');
  await fs.writeFile(path.join(data,'notes.json'), JSON.stringify({...payload,notes:[]}));
  const restored = await service.restore(backup);
  assert.equal(JSON.parse(await fs.readFile(path.join(data,'notes.json'),'utf8')).notes.length,1);
  assert.match(restored.safetyBackupPath,/backup-/);
  assert.equal(sanitizeFileName('A:B*?'),'A_B_');
});

test('rejects incomplete backups before touching live data', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'memo-invalid-'));
  const data = path.join(root,'data'); const backup = path.join(root,'backup');
  await fs.mkdir(path.join(data,'attachments'),{recursive:true}); await fs.mkdir(path.join(backup,'attachments'),{recursive:true});
  const live={schemaVersion:2,notes:[],categories:[],tags:[],attachments:[]};
  await fs.writeFile(path.join(data,'notes.json'),JSON.stringify(live)); await fs.writeFile(path.join(data,'settings.json'),JSON.stringify({schemaVersion:1,theme:'light'}));
  await fs.writeFile(path.join(backup,'notes.json'),JSON.stringify({schemaVersion:2,notes:[],categories:[],attachments:[]}));
  await fs.writeFile(path.join(backup,'settings.json'),JSON.stringify({schemaVersion:1}));
  const service=createDataPortabilityService({dataDirectory:data});
  await assert.rejects(()=>service.restore(backup),/备份格式不正确/);
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(data,'notes.json'),'utf8')),live);
});

test('rebases attachment paths when restoring a moved backup', async () => {
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'memo-move-')); const source=path.join(root,'source'); const target=path.join(root,'target'); const out=path.join(root,'out');
  for(const dir of [source,target]) await fs.mkdir(path.join(dir,'attachments'),{recursive:true});
  await fs.mkdir(path.join(source,'attachments','folder'),{recursive:true}); await fs.writeFile(path.join(source,'attachments','folder','a.png'),'image');
  const payload={schemaVersion:2,notes:[{id:'n',categoryId:null,tagIds:[],attachmentIds:['a']}],categories:[],tags:[],attachments:[{id:'a',noteId:'n',fileName:'a.png',filePath:path.join(source,'attachments','folder','a.png')}]};
  await fs.writeFile(path.join(source,'notes.json'),JSON.stringify(payload)); await fs.writeFile(path.join(source,'settings.json'),JSON.stringify({schemaVersion:1,theme:'light'}));
  await fs.writeFile(path.join(target,'notes.json'),JSON.stringify({...payload,notes:[],attachments:[]})); await fs.writeFile(path.join(target,'settings.json'),JSON.stringify({schemaVersion:1,theme:'dark'}));
  const backup=await createDataPortabilityService({dataDirectory:source}).backup(out);
  await createDataPortabilityService({dataDirectory:target}).restore(backup);
  const restored=JSON.parse(await fs.readFile(path.join(target,'notes.json'),'utf8'));
  assert.equal(restored.attachments[0].filePath,path.join(target,'attachments','folder','a.png'));
});

test('restores the original directory when the atomic switch fails', async () => {
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'memo-rollback-')); const data=path.join(root,'data'); const out=path.join(root,'out');
  await fs.mkdir(path.join(data,'attachments'),{recursive:true});
  const original={schemaVersion:2,notes:[],categories:[],tags:[],attachments:[]};
  await fs.writeFile(path.join(data,'notes.json'),JSON.stringify(original)); await fs.writeFile(path.join(data,'settings.json'),JSON.stringify({schemaVersion:1,theme:'light'}));
  const backup=await createDataPortabilityService({dataDirectory:data}).backup(out);
  const failingFs=Object.create(fs); failingFs.rename=async(source,target)=>{if(source.includes('.restore-')&&target===data) throw new Error('switch failed'); return fs.rename(source,target);};
  await assert.rejects(()=>createDataPortabilityService({dataDirectory:data,fileSystem:failingFs}).restore(backup),/原数据已保留/);
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(data,'notes.json'),'utf8')),original);
});

test('rejects broken note relationships before restoring', async () => {
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'memo-links-')); const data=path.join(root,'data'); const out=path.join(root,'out');
  await fs.mkdir(path.join(data,'attachments'),{recursive:true});
  const live={schemaVersion:2,notes:[],categories:[],tags:[],attachments:[]};
  await fs.writeFile(path.join(data,'notes.json'),JSON.stringify(live)); await fs.writeFile(path.join(data,'settings.json'),JSON.stringify({schemaVersion:1,theme:'light'}));
  const service=createDataPortabilityService({dataDirectory:data}); const backup=await service.backup(out);
  await fs.writeFile(path.join(backup,'notes.json'),JSON.stringify({
    schemaVersion:2, categories:[], tags:[], attachments:[],
    notes:[{id:'n1',categoryId:'missing',tagIds:[],attachmentIds:[]}],
  }));
  await assert.rejects(()=>service.restore(backup),/备份格式不正确/);
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(data,'notes.json'),'utf8')),live);
});
