import {readFileSync,writeFileSync} from 'node:fs';
import {decodePng,inkBitmap} from '../../scripts/centerline/png.mjs';
import {thin} from '../../scripts/centerline/thin.mjs';
import {chamfer} from '../../scripts/centerline/raster.mjs';
import {buildGraph,pruneSpurs,dropDust,smoothChains} from '../../scripts/centerline/graph.mjs';
import {route} from '../../scripts/centerline/route.mjs';
const dir=new URL('./',import.meta.url);
for(const name of ['graph','hands']) {
const source=readFileSync(new URL(`../../svg/${name}.png`,import.meta.url)); const img=decodePng(source), scale=Math.min(2,1700/Math.max(img.w,img.h));
const bmp=inkBitmap(img,{scale}), dt=chamfer(bmp), skel=thin(bmp); let sum=0,n=0;for(let i=0;i<skel.data.length;i++)if(skel.data[i]){sum+=dt[i]/3;n++}const half=sum/n;
const raw=buildGraph(skel); const rawCounts={nodes:raw.nodes.length,edges:raw.edges.length};let g=pruneSpurs(raw,Math.max(3,half*1.6));g=dropDust(g,Math.max(7,half*2));smoothChains(g,2);
const adj=new Map(g.nodes.map(n=>[n.id,[]])),deg=new Map(g.nodes.map(n=>[n.id,0]));g.edges.forEach((e,i)=>{adj.get(e.a).push(i);adj.get(e.b).push(i);deg.set(e.a,deg.get(e.a)+1);deg.set(e.b,deg.get(e.b)+1)});
const comps=[], seen=new Set();for(const node of g.nodes){if(seen.has(node.id))continue;const ids=[],q=[node.id];seen.add(node.id);while(q.length){const id=q.pop();ids.push(id);for(const ei of adj.get(id)){const e=g.edges[ei],o=e.a===id?e.b:e.a;if(!seen.has(o)){seen.add(o);q.push(o)}}}const idsS=new Set(ids),edges=g.edges.filter(e=>idsS.has(e.a));comps.push({ids,nodes:ids.length,edges:edges.length,length:edges.reduce((a,e)=>a+e.len,0),odd:ids.filter(id=>deg.get(id)%2),cycleRank:edges.length-ids.length+1});}
const hints=name==='graph'?[[.95,.2],[.005,.783]]:[[.608,.105],[.46,.846]];const hintsPx=hints.map(p=>[p[0]*bmp.w,p[1]*bmp.h]);const old=route(g,...hintsPx,{dirWin:Math.max(4,half*1.5)});
const report={name,w:img.w,h:img.h,scale,meanHalf:half,rawCounts,nodes:g.nodes.length,edges:g.edges.length,components:comps,odd:g.nodes.filter(n=>deg.get(n.id)%2).map(n=>({...n,degree:deg.get(n.id)})),oldRoute:old.stats};
writeFileSync(new URL(`${name}.json`,dir),JSON.stringify({report,g,hintsPx},null,2));console.log(JSON.stringify(report,null,2));
}
