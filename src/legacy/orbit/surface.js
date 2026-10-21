/* Periodic material sampler and renderer adapters. Time is always loop phase. */
(function(root){
  'use strict';
  const GradientRamp=root.GradientRamp||(typeof require==='function'?require('./gradient.js'):null);
  function sample(p,phase){
    const s={effect:'off',amount:60,cycles:1,direction:1,density:2,...p.surface},f=phase*Math.PI*2*s.cycles*s.direction,a=s.amount/100;
    const mix=s.effect==='pulse'?(1-Math.cos(f))*.5*a:0;
    const blend=(x,y,t)=>{const n=parseInt(x.slice(1),16),m=parseInt(y.slice(1),16);return '#'+[16,8,0].map(k=>Math.round(((n>>k)&255)*(1-t)+((m>>k)&255)*t).toString(16).padStart(2,'0')).join('');};
    const result={space:s.space||'local',extent:s.extent||600,origin:s.origin||{x:0,y:0,z:0},animated:s.effect!=='off',colorA:blend(p.colorA,p.colorB,mix),colorB:blend(p.colorB,p.colorA,mix),focusX:s.effect==='rotate'?Math.cos(f)*.2*a:0,focusY:s.effect==='rotate'?Math.sin(f)*.2*a:0,travel:['drift','wave'].includes(s.effect),time:f,amount:a,density:s.effect==='drift'?1:s.density,angle:Math.PI/4+(s.effect==='rotate'?f:s.effect==='flow'?Math.sin(f)*Math.PI*a:0),shift:s.effect==='flow'?Math.cos(f)*.3*a:0,fill:p.fill};
    const baseStops=GradientRamp.stops(p);result.stops=baseStops.map(stop=>({...stop,color:blend(stop.color,GradientRamp.color(baseStops,1-stop.position),mix)}));
    result.paintStops=GradientRamp.paint(result.stops,result);
    return result;
  }
  const fragment=`
#ifdef GL_ES
precision mediump float;
#endif
varying vec3 vPosition;
varying vec3 vNormal;
uniform vec3 uOrigin;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec4 uStops[8];
uniform float uSoftness[8];
uniform int uStopCount;
uniform float uMode;
uniform float uAngle;
uniform float uShift;
uniform float uExtent;
uniform vec2 uFocus;
uniform float uTravel;
uniform float uTime;
uniform float uAmount;
uniform float uDensity;
uniform float uAlpha;
uniform float uAmbient;
uniform float uLight;
uniform vec3 uDirection;
void main(){
 vec3 p=(vPosition-uOrigin)/max(uExtent,0.0001);
 float t=0.0;
 if(uMode>1.5)t=clamp(length(p.xy-(uFocus+vec2(uShift,0.0)))/0.7,0.0,1.0);
 else if(uMode>0.5)t=clamp(dot(p.xy,vec2(cos(uAngle),sin(uAngle)))/1.41421356+0.5-uShift,0.0,1.0);
 if(uTravel>0.5 && uMode>0.5)t=mix(t,0.5+0.5*cos(6.2831853*t*uDensity-uTime),uAmount);
 float lighting=clamp(uAmbient+uLight*max(0.0,dot(normalize(vNormal),-normalize(uDirection))),0.0,1.4);
 vec3 c=uStops[0].rgb;
 for(int i=1;i<8;i++){
   if(i<uStopCount){vec4 a=uStops[i-1];vec4 b=uStops[i];
   if(t>=a.a){float x=clamp((t-a.a)/max(b.a-a.a,0.000001),0.0,1.0);float soft=uSoftness[i-1];float v=soft<0.000001?step(0.5,x):clamp((x-0.5)/soft+0.5,0.0,1.0);c=mix(a.rgb,b.rgb,v);}
   }
 }
 if(uMode<0.5)c=uColorA;
 gl_FragColor=vec4(c*lighting,uAlpha);
}`;
  const p5Vertex=`precision mediump float;
attribute vec3 aPosition;
attribute vec3 aNormal;
uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;
uniform mat3 uNormalMatrix;
uniform mat4 uGroupMatrix;
uniform float uCoordinateMode;
varying vec3 vPosition;
varying vec3 vNormal;
void main(){vPosition=uCoordinateMode>0.5?(uGroupMatrix*vec4(aPosition,1.0)).xyz:aPosition;vNormal=uNormalMatrix*aNormal;gl_Position=uProjectionMatrix*uModelViewMatrix*vec4(aPosition,1.0);}`;
  const processingVertex=`#define PROCESSING_COLOR_SHADER
uniform mat4 transform;
uniform mat3 normalMatrix;
attribute vec4 vertex;
attribute vec3 normal;
uniform mat4 uGroupMatrix;
uniform float uCoordinateMode;
varying vec3 vPosition;
varying vec3 vNormal;
void main(){vPosition=uCoordinateMode>0.5?(uGroupMatrix*vertex).xyz:vertex.xyz;vNormal=normalMatrix*normal;gl_Position=transform*vertex;}`;
  const api={sample,fragment,p5Vertex,processingVertex};root.SurfaceMaterial=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
