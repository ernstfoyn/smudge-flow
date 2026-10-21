/* Extrude a font mask into a closed mesh. Scanline runs preserve counters
 * (holes in A/O/B), Unicode and locally uploaded fonts without font parsing.
 * XY is normalized to the text block; Z is normalized to the depth slider.
 */
(function(root){
  'use strict';
  function extrude(alpha,width,height,threshold=128){
    const vertices=[],triangles=[],normals=[];
    const filled=(x,y)=>x>=0&&y>=0&&x<width&&y<height&&alpha[y*width+x]>=threshold;
    const point=(x,y,z)=>[x/width-.5,y/height-.5,z];
    function quad(points,normal){const start=vertices.length;vertices.push(...points);triangles.push([start,start+1,start+2],[start,start+2,start+3]);normals.push(normal,normal);}
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      if(!filled(x,y))continue;
      const start=x;while(x+1<width&&filled(x+1,y))x++;
      const end=x+1;
      quad([point(start,y,.5),point(end,y,.5),point(end,y+1,.5),point(start,y+1,.5)],[0,0,1]);
      quad([point(start,y,-.5),point(start,y+1,-.5),point(end,y+1,-.5),point(end,y,-.5)],[0,0,-1]);
      for(let col=start;col<end;col++){
        if(!filled(col,y-1))quad([point(col,y,-.5),point(col+1,y,-.5),point(col+1,y,.5),point(col,y,.5)],[0,-1,0]);
        if(!filled(col,y+1))quad([point(col,y+1,.5),point(col+1,y+1,.5),point(col+1,y+1,-.5),point(col,y+1,-.5)],[0,1,0]);
      }
      quad([point(start,y,.5),point(start,y+1,.5),point(start,y+1,-.5),point(start,y,-.5)],[-1,0,0]);
      quad([point(end,y,-.5),point(end,y+1,-.5),point(end,y+1,.5),point(end,y,.5)],[1,0,0]);
    }
    const portableOBJ=vertices.map(v=>'v '+v.join(' ')).concat(normals.map(n=>'vn '+n.join(' ')),triangles.map((t,i)=>'f '+t.map(index=>`${index+1}//${i+1}`).join(' '))).join('\n');
    return {format:'obj',vertices,triangles,normals,portableOBJ};
  }
  root.TextMesh={extrude};if(typeof module!=='undefined')module.exports={extrude};
})(typeof window!=='undefined'?window:globalThis);
