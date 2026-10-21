/* Pure pixel operations shared conceptually with the Processing adapter.
 * Stable effect IDs keep tracks attached when the stack is reordered.
 */
(function(root){
 'use strict';
 const TAU=Math.PI*2;
 function variation(pixels,w,h,x,y,cell){
   const center=(y*w+x)*4;let maximum=0;
   for(const [dx,dy] of [[-cell,0],[cell,0],[0,-cell],[0,cell]]){
     const i=(Math.max(0,Math.min(h-1,y+dy))*w+Math.max(0,Math.min(w-1,x+dx)))*4;
     for(let c=0;c<3;c++)maximum=Math.max(maximum,Math.abs(pixels[i+c]-pixels[center+c]));
   }
   return maximum;
 }
 function warp(data,w,h,p,phase){
   const out=new Uint8ClampedArray(data.length),spacing=Math.max(8,p.spacing??48),amount=p.amount??12,time=phase*TAU*(p.cycles??1);
   for(let y=0;y<h;y++)for(let x=0;x<w;x++){
     const a=y/spacing*TAU-time,b=x/spacing*TAU;
     const dx=p.type==='warp-dots'?amount*Math.sin(a)*Math.sin(b):amount*Math.sin(a);
     const dy=p.type==='warp-dots'?amount*Math.cos(a)*Math.cos(b):0;
     const sx=Math.max(0,Math.min(w-1,Math.floor(x+dx+.5))),sy=Math.max(0,Math.min(h-1,Math.floor(y+dy+.5))),i=(y*w+x)*4,j=(sy*w+sx)*4;
     for(let c=0;c<4;c++)out[i+c]=data[j+c];
   }
   return out;
 }
 // Separable box blur, clamped edges, intermediate rounded equally in Java/JS.
 function blur(data,w,h,radius){
   const r=Math.max(0,Math.min(30,Math.round(radius)));if(!r)return new Uint8ClampedArray(data);
   const tmp=new Uint8ClampedArray(data.length),out=new Uint8ClampedArray(data.length),n=2*r+1;
   for(let y=0;y<h;y++)for(let c=0;c<4;c++){
     let sum=0;for(let k=-r;k<=r;k++)sum+=data[(y*w+Math.max(0,Math.min(w-1,k)))*4+c];
     for(let x=0;x<w;x++){tmp[(y*w+x)*4+c]=Math.floor(sum/n+.5);sum+=data[(y*w+Math.min(w-1,x+r+1))*4+c]-data[(y*w+Math.max(0,x-r))*4+c];}
   }
   for(let x=0;x<w;x++)for(let c=0;c<4;c++){
     let sum=0;for(let k=-r;k<=r;k++)sum+=tmp[(Math.max(0,Math.min(h-1,k))*w+x)*4+c];
     for(let y=0;y<h;y++){out[(y*w+x)*4+c]=Math.floor(sum/n+.5);sum+=tmp[(Math.min(h-1,y+r+1)*w+x)*4+c]-tmp[(Math.max(0,y-r)*w+x)*4+c];}
   }
   return out;
 }
 function pixelate(data,w,h,size){const block=Math.max(1,Math.round(size||12)),out=new Uint8ClampedArray(data.length);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const sx=Math.min(w-1,Math.floor(x/block)*block+Math.floor(block/2)),sy=Math.min(h-1,Math.floor(y/block)*block+Math.floor(block/2)),i=(y*w+x)*4,j=(sy*w+sx)*4;for(let c=0;c<4;c++)out[i+c]=data[j+c];}return out;}
 function stages(p){const effects=p.effects||{};const order=p.effectOrder||['raster',...Object.keys(effects)];return order.map(id=>id==='raster'?{id,type:'raster',enabled:p.pattern!=='off' && p.rasterEnabled!==false}:{id,...effects[id]}).filter(s=>s.type && s.enabled!==false);}
 function coverage(luminance,p){return p.sizeMode==='uniform'?1:Math.max(0,Math.min(1,.5+(luminance-.5)*(p.dotContrast??1)));}
 const api={variation,warp,blur,pixelate,stages,coverage};root.ImageEffects=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
