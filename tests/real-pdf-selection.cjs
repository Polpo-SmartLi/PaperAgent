const path=require('node:path');
const fs=require('node:fs'),assert=require('node:assert/strict'),S=require('../web/selection.js');
if(!fs.existsSync(path.join(__dirname,'../tmp/selection-fixture.json'))){console.log('SKIP: optional public-PDF fixture is not installed');process.exit(0)}
const pages=JSON.parse(fs.readFileSync(path.join(__dirname,'../tmp/selection-fixture.json'),'utf8'));let tested=0,columns=0;
for(const page of pages){const d=S.layout(page.words,page.width);if(d.twoColumns)columns++;
 for(const line of d.lines){if(line.words.length<4)continue;const first=line.words[1],last=line.words[3];const a=first.box,b=last.box;const start=S.begin(d,(a[0]+a[2])/2,(a[1]+a[3])/2);if(!start)continue;
 const range=S.extend(start,(b[0]+b[2])/2,(b[1]+b[3])/2);assert.deepEqual(range.map(w=>w.text),line.words.slice(1,4).map(w=>w.text));tested++;
 }}
assert(tested>100);console.log('PASS:',tested,'real-PDF line selections across',pages.length,'pages;',columns,'pages detected with two columns');
