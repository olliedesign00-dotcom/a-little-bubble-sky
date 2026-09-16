'use strict';
// Render the font as inflated curved surfaces. The distance field supplies
// surface depth and normals; Fresnel reflections keep the thin film transparent.
class BubbleType {
 constructor(image){
  this.cache=new Map();
  const env=document.createElement('canvas');env.width=128;env.height=64;
  const c=env.getContext('2d',{willReadFrequently:true});c.drawImage(image,0,0,128,64);
  this.environment=c.getImageData(0,0,128,64).data;
 }
 glyph(char){
  if(this.cache.has(char))return this.cache.get(char);
  const canvas=document.createElement('canvas'),c=canvas.getContext('2d',{willReadFrequently:true}),size=220;
  c.font=`${size}px Coiny`;const metrics=c.measureText(char);
  canvas.width=Math.ceil(metrics.width)+16;canvas.height=260;
  c.font=`${size}px Coiny`;c.fillStyle='#fff';
  c.fillText(char,8,(canvas.height+metrics.actualBoundingBoxAscent-metrics.actualBoundingBoxDescent)/2);
  const w=canvas.width,h=canvas.height,mask=c.getImageData(0,0,w,h),distance=new Float32Array(w*h),sqrt2=Math.SQRT2;
  for(let i=0;i<distance.length;i++)distance[i]=mask.data[i*4+3]>127?1000:0;
  for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
   const i=y*w+x;if(distance[i])distance[i]=Math.min(distance[i],distance[i-1]+1,distance[i-w]+1,distance[i-w-1]+sqrt2,distance[i-w+1]+sqrt2);
  }
  for(let y=h-2;y>0;y--)for(let x=w-2;x>0;x--){
   const i=y*w+x;if(distance[i])distance[i]=Math.min(distance[i],distance[i+1]+1,distance[i+w]+1,distance[i+w+1]+sqrt2,distance[i+w-1]+sqrt2);
  }
  let radius=1;for(const d of distance)radius=Math.max(radius,d);radius*=1.12;
  const depth=new Float32Array(w*h);
  for(let i=0;i<depth.length;i++){const d=Math.min(radius,distance[i]);depth[i]=Math.sqrt(Math.max(0,2*radius*d-d*d))}
  // Smooth medial-axis creases before lighting the inflated surface.
  for(let pass=0;pass<3;pass++){
   const old=depth.slice();
   for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const i=y*w+x;if(distance[i]>1)depth[i]=(old[i]*4+old[i-1]+old[i+1]+old[i-w]+old[i+w])/8}
  }
  const out=c.createImageData(w,h),env=this.environment;
  for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
   const i=y*w+x,coverage=mask.data[i*4+3]/255;if(!coverage)continue;
   let nx=-(depth[i+1]-depth[i-1])*.5,ny=-(depth[i+w]-depth[i-w])*.5,nz=1;
   const length=Math.hypot(nx,ny,nz);nx/=length;ny/=length;nz/=length;
   const fresnel=.035+.965*(1-nz)**2.5;
   // Curved sky reflection and two broad outdoor highlights, rather than a flat gradient.
   const ex=Math.round(Math.max(0,Math.min(127,(.5+nx*nz*.46)*127))),ey=Math.round(Math.max(0,Math.min(63,(.5+ny*nz*.46)*63))),ei=(ey*128+ex)*4;
   const light=Math.max(0,-nx*.48-ny*.58+nz*.66);
   const highlight=Math.exp(-((nx+.34)**2/.015+(ny+.43)**2/.055))*.95;
   const rim=Math.exp(-(((distance[i]-1.1)/1.1)**2));
   const lowerGlint=Math.exp(-((nx-.48)**2/.02+(ny-.48)**2/.10))*.32;
   const phase=distance[i]*.22+ny*2.4+nx*1.6+y/h*.9;
   const alpha=Math.min(.96,.16+fresnel*.56+highlight*.72+lowerGlint*.5+rim*.5);
   for(let channel=0;channel<3;channel++){
    const interference=190+65*Math.cos(phase+[0,2.1,4.2][channel]);
    const filmMix=.13+fresnel*.5+rim*.25;
    let color=env[ei+channel]*(1-filmMix)+interference*filmMix;
    color*=.78+.22*light;
    const white=Math.min(.95,highlight+lowerGlint+rim*.42);
    out.data[i*4+channel]=color*(1-white)+255*white;
   }
   out.data[i*4+3]=255*alpha*coverage;
  }
  c.putImageData(out,0,0);this.cache.set(char,canvas);return canvas;
 }
 paint(letter){
  const source=this.glyph(letter.dataset.letter),canvas=document.createElement('canvas');
  canvas.width=source.width;canvas.height=source.height;canvas.getContext('2d').drawImage(source,0,0);
  canvas.setAttribute('aria-hidden','true');canvas.className='bubble-glyph';
  letter.append(canvas);letter.classList.add('rendered');
 }
}
