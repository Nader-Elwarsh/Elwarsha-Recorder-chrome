const fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'..');
const read=n=>fs.readFileSync(path.join(root,n),'utf8');
const htmlFiles=fs.readdirSync(root).filter(n=>n.endsWith('.html'));
assert(fs.existsSync(path.join(root,'PROJECT_STRUCTURE.md')),'project structure document is required');
assert(htmlFiles.includes('compcodes.html'),'compressor page must exist');
for(const name of htmlFiles){const s=read(name);if(name!=='compcodes.html')assert(!s.includes('compressor-db.js'),'compressor database must not load on unrelated pages')}
const comp=read('app-compressor-codes.js');
assert(comp.includes('_modelNorm'),'search records must precompute normalized model');
assert(comp.includes('searchCache'),'search cache must remain enabled');
assert(comp.includes('compressor-index.js')&&comp.includes('loadAllCompressorBrands'),'compressor database must load through index and lazy brand chunks');
assert(read('settings.html').includes('data-action="backup"')&&!read('settings.html').includes('onclick="backupAllData()"'),'settings static controls must use delegated actions');
assert(fs.existsSync(path.join(root,'tests','browser-smoke.sh')),'browser smoke test is required');
assert(fs.existsSync(path.join(root,'compressor-index.js')),'compressor index is required');
assert(fs.readdirSync(path.join(root,'compressor-brands')).filter(n=>n.endsWith('.js')).length>=50,'split compressor brand files are required');
console.log(`project-quality-check: PASS (${htmlFiles.length} HTML pages; lazy compressor DB verified)`);
