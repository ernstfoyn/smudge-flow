/* Final luminance raster pass. Off returns the original buffer without readback. */
(function(root){
 'use strict';
 class Compositor {
   process(source,target,properties,phase=0){
     const effects=root.ImageEffects || (typeof require!=='undefined'?require('./image-effects.js'):null);
     const stages=effects.stages(properties);
     if(!stages.length){this.raster(source,target,{...properties,pattern:'off'});return;}
     if(stages.length===1 && stages[0].type==='raster'){this.raster(source,target,properties);return;}
     if(!this.buffers)this.buffers=[document.createElement('canvas'),document.createElement('canvas')];
     const input=source.canvas||source;let current=input;
     stages.forEach((stage,index)=>{
       const next=index===stages.length-1?(target.canvas||target):this.buffers[index%2];
       if(next.width!==input.width || next.height!==input.height){next.width=input.width;next.height=input.height;}
       if(stage.type==='raster')this.raster(current,next,properties);
       else{
         const pixels=current.getContext('2d').getImageData(0,0,input.width,input.height);
         const result=stage.type==='pixelate'?effects.pixelate(pixels.data,input.width,input.height,stage.pixelSize):stage.type==='blur'?effects.blur(pixels.data,input.width,input.height,stage.radius):effects.warp(pixels.data,input.width,input.height,stage,phase);
         pixels.data.set(result);next.getContext('2d').putImageData(pixels,0,0);
       }
       current=next;
     });
   }
   raster(source,target,properties){
     const p={pattern:'off',cellSize:10,strength:100,ink:'#ffffff',paper:'#000000',invert:false,colorMode:'ink',sizeMode:'luminance',...properties};
     const src=source.canvas||source,dst=target.canvas||target,ctx=dst.getContext('2d'),w=src.width,h=src.height;
     ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.clearRect(0,0,w,h);
     if(p.pattern==='off'){ctx.drawImage(src,0,0);ctx.restore();return;}
     const pixels=src.getContext('2d').getImageData(0,0,w,h).data,cell=Math.max(3,Math.round(p.cellSize));
     ctx.fillStyle=p.paper;if(!p.isLayer)ctx.fillRect(0,0,w,h);ctx.fillStyle=p.ink;ctx.beginPath();
     for(let y=0;y<h;y+=cell)for(let x=0;x<w;x+=cell){
       const cx=Math.min(w-1,Math.floor(x+cell/2)),cy=Math.min(h-1,Math.floor(y+cell/2)),i=(cy*w+cx)*4;
       if(p.isLayer&&pixels[i+3]===0)continue;
       let luminance=Compositor.luminance(pixels[i],pixels[i+1],pixels[i+2]);if(p.invert)luminance=1-luminance;
       const coverage=(root.ImageEffects || require('./image-effects.js')).coverage(luminance,p);
       const effects=root.ImageEffects || (typeof require!=='undefined'?require('./image-effects.js'):null);
       const solid=p.sizeMode==='adaptive' && effects.variation(pixels,w,h,cx,cy,cell)<(p.flatThreshold??3);
       if(p.isLayer || p.colorMode==='source' || p.sizeMode==='adaptive'){ctx.fillStyle=p.colorMode==='source'?`rgb(${pixels[i]},${pixels[i+1]},${pixels[i+2]})`:p.ink;ctx.beginPath();}
       if(p.isLayer)ctx.globalAlpha=pixels[i+3]/255;
       const diameter=cell*.95*Math.sqrt(coverage),r=diameter/2;
       if(solid){ctx.rect(x,y,cell,cell);if(p.colorMode!=='source')ctx.fillStyle=`rgb(${pixels[i]},${pixels[i+1]},${pixels[i+2]})`;}
       else if(p.pattern==='lines')ctx.rect(x,y+(cell-cell*.95*coverage)/2,cell,cell*.95*coverage);
       else if(p.pattern==='diamonds'){ctx.moveTo(x+cell/2,y+cell/2-r);ctx.lineTo(x+cell/2+r,y+cell/2);ctx.lineTo(x+cell/2,y+cell/2+r);ctx.lineTo(x+cell/2-r,y+cell/2);ctx.closePath();}
       else {ctx.moveTo(x+cell/2+r,y+cell/2);ctx.arc(x+cell/2,y+cell/2,r,0,Math.PI*2);}
       if(p.isLayer || p.colorMode==='source' || p.sizeMode==='adaptive')ctx.fill();
     }
     if(!p.isLayer && p.colorMode!=='source' && p.sizeMode!=='adaptive')ctx.fill();
     if(p.strength<100){ctx.globalAlpha=1-Math.max(0,p.strength)/100;ctx.drawImage(src,0,0);}
     ctx.restore();
   }
   static luminance(r,g,b){return (.2126*r+.7152*g+.0722*b)/255;}
 }
 root.Compositor=Compositor;if(typeof module!=='undefined')module.exports=Compositor;
})(typeof window!=='undefined'?window:globalThis);
