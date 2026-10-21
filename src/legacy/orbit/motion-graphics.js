/* Deterministic local geometry for graphic loops. Shared by preview and export. */
(function(root){
  'use strict';
  const modes=['dotfield','tiles','fan','stripes','lozenges'];
  function sample(p,phase,w,h){
    const count=Math.max(1,Math.min(100,Math.round(p.count))),cols=Math.max(1,Math.round(p.columns||8)),rows=Math.ceil(count/cols);
    const unit=Math.min(w,h)/960,spacing=(p.spacing||70)*unit*p.spread/100;
    const amplitude=p.amplitude/100,theta=phase*Math.PI*2*p.speed;
    return Array.from({length:count},(_,i)=>{
      const col=i%cols,row=Math.floor(i/cols),f=theta+(col+row)*(p.phaseOffset??.12)*Math.PI*2;
      const pulse=1+p.scale/100*Math.sin(f);
      const item={x:w*p.centerX/100+(col-(cols-1)/2)*spacing,y:h*p.centerY/100+(row-(rows-1)/2)*spacing,size:p.size*unit,rotation:0,sx:1,sy:1,shape:'circle'};
      if(p.motion==='dotfield'){
        item.size*=pulse*(.35+.65*(1+Math.sin(f))/2);item.y+=Math.sin(f)*spacing*.3*amplitude;
      }else if(p.motion==='tiles'){
        item.shape='rectangle';item.size*=pulse;item.x+=Math.sin(f)*spacing*.4*amplitude;item.y+=Math.cos(f)*spacing*.2*amplitude;item.rotation=Math.sin(f)*p.rotation/100*Math.PI/2;
      }else if(p.motion==='fan'){
        const angle=(i/(Math.max(1,count-1))-.5)*Math.PI*(.1+.8*(1+Math.sin(theta))/2)*amplitude;
        const length=p.size*unit*4;
        item.shape='rectangle';item.size=length;item.sx=Math.max(.006,(p.lineWidth||3)/Math.max(1,p.size*4));item.sy=1;item.rotation=angle;
        item.x=w*p.centerX/100+Math.sin(angle)*length/2;item.y=h*p.centerY/100-Math.cos(angle)*length/2;
      }else if(p.motion==='stripes'){
        item.shape='rectangle';item.x=w*p.centerX/100+Math.sin(theta+i*.25)*spacing*.35*amplitude;
        item.y=h*p.centerY/100+(i-(count-1)/2)*(p.lineWidth||3)*unit*3;
        item.size*=3*pulse;item.sy=Math.max(.008,(p.lineWidth||3)/Math.max(1,p.size*3));
      }else if(p.motion==='lozenges'){
        item.shape='circle';item.sx=pulse;item.sy=.15+.85*(1+Math.sin(f))/2;
        item.y+=Math.sin(f)*spacing*.25*amplitude;item.rotation=Math.sin(f)*p.rotation/100*Math.PI/2;
      }
      return item;
    });
  }
  const api={modes,sample};root.MotionGraphics=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
