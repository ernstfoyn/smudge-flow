/* Column-major matrices match Canvas/WebGL's T · Rx · Ry · Rz · S order.
 * Geometry coordinates are normalized by ONE shared bounds volume, never per clone.
 */
(function(root){
 'use strict';
 const identity=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
 function multiply(a,b){const c=Array(16).fill(0);for(let col=0;col<4;col++)for(let row=0;row<4;row++)for(let k=0;k<4;k++)c[col*4+row]+=a[k*4+row]*b[col*4+k];return c;}
 function transform(t){
   let m=identity();m[12]=t.position.x;m[13]=t.position.y;m[14]=t.position.z;
   for(const axis of ['x','y','z']){const r=identity(),a=t.rotation[axis]*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
     if(axis==='x'){r[5]=c;r[6]=s;r[9]=-s;r[10]=c;}
     if(axis==='y'){r[0]=c;r[2]=-s;r[8]=s;r[10]=c;}
     if(axis==='z'){r[0]=c;r[1]=s;r[4]=-s;r[5]=c;}
     m=multiply(m,r);
   }
   const scale=identity();scale[0]=t.scale.x;scale[5]=t.scale.y;scale[10]=t.scale.z;return multiply(m,scale);
 }
 class GroupShader {
   static matrix(object,instance,adapter='p5'){
     const space=object.properties.surface?.space||'local';
     let m=transform(instance);
     if(space==='world'){m=multiply(transform(object.transform),m);for(const parent of [...(object._parents||[])].reverse())m=multiply(transform(parent),m);}
     // p5 box/sphere meshes have unit coordinates. Processing primitives already
     // contain size; imported OBJ coordinates are normalized in both adapters.
     const geometry=identity(),size=adapter==='p5'?(object.type==='sphere'?object.properties.size/2:object.properties.size):(['obj','text3d'].includes(object.type)?object.properties.size:1);
     geometry[0]=geometry[5]=geometry[10]=size;if(object.type==='text3d')geometry[10]=object.properties.depth??40;return multiply(m,geometry);
   }
   static point(matrix,p){return [0,1,2].map(row=>matrix[row]*p[0]+matrix[4+row]*p[1]+matrix[8+row]*p[2]+matrix[12+row]);}
 }
 const api={GroupShader,identity,multiply,transform};root.GroupShader=GroupShader;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
