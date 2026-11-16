/* Geometry-based word selection. Independent of browser DOM text order. */
(function(root){
  function layout(words,width){
    const map=new Map();
    words.forEach((w,i)=>{const key=w[5]+':'+w[6];if(!map.has(key))map.set(key,{key,words:[],x0:Infinity,y0:Infinity,x1:-Infinity,y1:-Infinity});const l=map.get(key);l.words.push({box:w,index:i,text:w[4]});l.x0=Math.min(l.x0,w[0]);l.y0=Math.min(l.y0,w[1]);l.x1=Math.max(l.x1,w[2]);l.y1=Math.max(l.y1,w[3])});
    const lines=[...map.values()].sort((a,b)=>a.y0-b.y0||a.x0-b.x0);lines.forEach(l=>l.words.sort((a,b)=>a.box[0]-b.box[0]));
    // Require repeated side-by-side lines: short lines in a single-column
    // paragraph do not, by themselves, prove a two-column layout.
    const gaps=[];
    for(let i=0;i<lines.length;i++)for(let j=i+1;j<lines.length;j++){
      const a=lines[i],b=lines[j];
      if(b.y0>a.y1+2)break;
      const overlap=Math.min(a.y1,b.y1)-Math.max(a.y0,b.y0);
      if(overlap<Math.min(a.y1-a.y0,b.y1-b.y0)*.4)continue;
      const left=a.x0<b.x0?a:b,right=left===a?b:a;
      if(right.x0-left.x1>=Math.max(12,width*.02)&&left.words.length>=2&&right.words.length>=2&&left.x1>width*.2&&right.x0<width*.8)gaps.push([left.x1,right.x0]);
    }
    let mid=width/2,support=0;
    for(const gap of gaps){const candidate=(gap[0]+gap[1])/2,n=gaps.filter(g=>g[0]<=candidate&&g[1]>=candidate).length;if(n>support){support=n;mid=candidate}}
    return {lines,width,mid,twoColumns:support>=3};
  }

  function distance(value,lo,hi){return Math.max(lo-value,0,value-hi)}
  function nearest(lines,x,y){
    if(!lines.length)return null;
    const line=lines.reduce((best,l)=>{const score=distance(y,l.y0,l.y1)*1000+Math.abs(y-(l.y0+l.y1)/2)*2+distance(x,l.x0,l.x1)*.01;return !best||score<best.score?{line:l,score}:best},null).line;
    return line.words.reduce((best,w)=>{const score=distance(x,w.box[0],w.box[2]);return !best||score<best.score?{word:w,score}:best},null).word;
  }
  function begin(data,x,y){
    const word=nearest(data.lines,x,y);if(!word)return null;
    const box=word.box;if(distance(x,box[0],box[2])>8||distance(y,box[1],box[3])>8)return null;
    const anchorLine=data.lines.find(l=>l.words.includes(word));let lines=data.lines;
    if(data.twoColumns){if(anchorLine.x1<data.mid+3)lines=lines.filter(l=>l.x1<data.mid+3);else if(anchorLine.x0>data.mid-3)lines=lines.filter(l=>l.x0>data.mid-3);else lines=lines.filter(l=>(l.x0<data.mid&&l.x1>data.mid)||l.words.some(w=>w.box[5]===word.box[5]))}
    const ordered=lines.flatMap(l=>l.words);return {lines,ordered,anchor:ordered.indexOf(word)};
  }
  function extend(selection,x,y){
    const end=nearest(selection.lines,x,y);if(!end)return [];
    const endIndex=selection.ordered.indexOf(end);return selection.ordered.slice(Math.min(selection.anchor,endIndex),Math.max(selection.anchor,endIndex)+1);
  }
  function text(words){let result='',previous=null;for(const w of words){if(previous){result+=previous.box[5]===w.box[5]&&previous.box[6]===w.box[6]?' ':'\n'}result+=w.text;previous=w}return result}
  root.PaperSelection={layout,begin,extend,text};
  if(typeof module!=='undefined')module.exports=root.PaperSelection;
})(typeof window!=='undefined'?window:globalThis);
