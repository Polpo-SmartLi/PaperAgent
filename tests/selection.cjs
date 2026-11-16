const assert=require('node:assert/strict');
const S=require('../web/selection.js');
const words=[];
for(let line=0;line<6;line++){
  for(let col=0;col<2;col++){
    for(let i=0;i<5;i++)words.push([40+col*300+i*38,100+line*20,73+col*300+i*38,114+line*20,`${col?'R':'L'}${line}${i}`,col*10+Math.floor(line/2),line%2,i]);
  }
}
const layout=S.layout(words,600);assert.equal(layout.twoColumns,true);
let start=S.begin(layout,85,105);let chosen=S.extend(start,170,125);
assert.deepEqual(chosen.map(w=>w.text),['L01','L02','L03','L04','L10','L11','L12','L13']);
assert(chosen.every(w=>w.text.startsWith('L')));
assert.equal(S.text(chosen),'L01 L02 L03 L04\nL10 L11 L12 L13');
// Moving across the gutter keeps the anchor column, rather than selecting both columns.
chosen=S.extend(start,460,125);assert(chosen.every(w=>w.text.startsWith('L')));assert(chosen.length<words.length/2);
start=S.begin(layout,420,145);chosen=S.extend(start,340,105);assert(chosen.every(w=>w.text.startsWith('R')));assert(chosen.some(w=>w.text==='R00'));
assert.equal(S.begin(layout,2,2),null);
const one=S.layout(words.filter(w=>w[4].startsWith('L')),600);assert.equal(one.twoColumns,false);
// Geometry in PDF coordinates produces the same result under 150% zoom.
const x=85*1.5,y=105*1.5;start=S.begin(layout,x/1.5,y/1.5);assert.equal(start.ordered[start.anchor].text,'L01');
console.log('PASS: precise range, reverse drag, gutter isolation, blank start, single column, zoom coordinates, copied text');

// A single column with alternating short/indented lines must remain selectable across lines.
const alternating=[];
for(let n=0;n<8;n++)for(let i=0;i<3;i++){const x=n%2?330:40;alternating.push([x+i*35,100+n*20,x+i*35+30,114+n*20,`A${n}${i}`,n,0,i])}
const single=S.layout(alternating,600);assert.equal(single.twoColumns,false);
start=S.begin(single,45,105);chosen=S.extend(start,370,125);assert(chosen.some(w=>w.text==='A11'));
// Full-width heading lines on a two-column page can span multiple lines of their block.
const headers=[[40,40,280,54,'Heading',100,0,0],[290,40,550,54,'part1',100,0,1],[40,60,280,74,'Heading',100,1,0],[290,60,550,74,'part2',100,1,1]];
const mixed=S.layout([...headers,...words],600);assert.equal(mixed.twoColumns,true);
start=S.begin(mixed,80,45);chosen=S.extend(start,350,65);assert(chosen.some(w=>w.text==='part2'));assert.equal(chosen.length,4);
console.log('PASS: multiline headings and indented single-column text');
