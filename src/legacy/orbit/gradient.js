/* Shared multi-stop sampler. Softness is the blended fraction of each interval. */
(function(root){
  const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
  function blend(a,b,t){const x=rgb(a),y=rgb(b);return '#'+x.map((v,i)=>Math.round(v+(y[i]-v)*t).toString(16).padStart(2,'0')).join('');}
  function stops(p){return (p.gradient?Object.values(p.gradient.stops):[{position:0,color:p.colorA,softness:1},{position:1,color:p.colorB,softness:1}]).map(s=>({...s,position:Math.max(0,Math.min(1,s.position)),softness:s.softness??1})).sort((a,b)=>a.position-b.position).slice(0,8);}
  function color(list,t){let result=list[0].color;for(let i=1;i<list.length;i++){const a=list[i-1],b=list[i];if(t<a.position)break;const span=b.position-a.position;const x=span?Math.max(0,Math.min(1,(t-a.position)/span)):1;const soft=Math.max(0,Math.min(1,a.softness));const mix=soft?Math.max(0,Math.min(1,(x-.5)/soft+.5)):(x>=.5?1:0);result=blend(a.color,b.color,mix);if(t<b.position)break;}return result;}
  function paint(list,m){const xs=new Set([0,1]);for(let i=0;i<=256;i++)xs.add(i/256);if(!m.travel)for(let i=1;i<list.length;i++){const a=list[i-1],b=list[i],mid=(a.position+b.position)/2,width=(b.position-a.position)*a.softness/2;xs.add(Math.max(0,mid-width-0.000001));xs.add(Math.min(1,mid+width+0.000001));}return [...xs].sort((a,b)=>a-b).map(x=>({position:x,color:color(list,m.travel?x*(1-m.amount)+(0.5+0.5*Math.cos(Math.PI*2*x*m.density-m.time))*m.amount:x)}));}
  const api={stops,color,blend,paint};root.GradientRamp=api;if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
