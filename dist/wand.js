'use strict';

const wandSprites = new Map();
function wandColor(hex, amount) {
  const target = amount < 0 ? 0 : 255, weight = Math.abs(amount);
  return `rgb(${[1,3,5].map(at => Math.round(parseInt(hex.slice(at,at+2),16)*(1-weight)+target*weight)).join(',')})`;
}
function wandContour(type, radius) {
  const outline = bubbleOutlineRadius(type), points = [];
  for(let i=0;i<256;i++) {
    const angle=i/256*Math.PI*2,r=outline(angle)*radius;
    points.push({x:Math.cos(angle)*r,y:Math.sin(angle)*r});
  }
  return points;
}
function traceWandRing(c,points) {
  c.beginPath();points.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();
}
function wandRidges(points,spacing) {
  const ridges=[];let carried=0;
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length],dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);
    if(length<.0001)continue;
    let distance=spacing-carried;
    while(distance<=length){
      ridges.push({x:a.x+dx*distance/length,y:a.y+dy*distance/length,nx:dy/length,ny:-dx/length});distance+=spacing;
    }
    carried=length-(distance-spacing);
  }
  return ridges;
}
function paintWandRing(c,type,r,color,thickness) {
  const points=wandContour(type,r);
  c.save();c.lineJoin='round';c.lineCap='round';
  // The darker rear wall supplies real visual thickness without moving the aperture.
  c.save();c.translate(1.2,2.1);c.shadowColor='rgba(39,62,81,.18)';c.shadowBlur=3;c.shadowOffsetY=1;
  c.strokeStyle=wandColor(color,-.38);c.lineWidth=thickness+.8;traceWandRing(c,points);c.stroke();c.restore();
  const plastic=c.createLinearGradient(-r,-r,r,r);
  [[0,.45],[.22,.16],[.52,0],[.82,-.15],[1,-.30]].forEach(([at,tint])=>plastic.addColorStop(at,wandColor(color,tint)));
  c.lineWidth=thickness;c.strokeStyle=plastic;traceWandRing(c,points);c.stroke();
  // Crosswise molding ribs retain the soap solution around the entire opening.
  for(const ridge of wandRidges(points,4.1)) {
    const {x,y,nx,ny}=ridge;
    c.lineWidth=.7;c.strokeStyle=wandColor(color,-.28);
    c.beginPath();c.moveTo(x-nx*thickness*.32,y-ny*thickness*.32);c.lineTo(x+nx*thickness*.40,y+ny*thickness*.40);c.stroke();
    c.lineWidth=.55;c.strokeStyle=wandColor(color,.53);
    c.beginPath();c.moveTo(x-nx*thickness*.27-.65,y-ny*thickness*.27-.45);c.lineTo(x+nx*thickness*.29-.65,y+ny*thickness*.29-.45);c.stroke();
  }
  // Fine mold seam and a soft highlight follow the curved tube, not the screen edge.
  c.save();c.translate(-.85,-1.15);c.strokeStyle='rgba(255,244,235,.57)';c.lineWidth=1.15;
  traceWandRing(c,points);c.stroke();c.restore();
  c.save();c.translate(.9,1.1);c.strokeStyle=wandColor(color,-.2);c.lineWidth=.6;
  traceWandRing(c,points);c.stroke();c.restore();
  // Small beads collect on the underside of the wet rim.
  for(const index of [38,65]){
    const a=points[index],b=points[(index+1)%points.length],length=Math.hypot(b.x-a.x,b.y-a.y);
    const x=a.x+(b.y-a.y)/length*(thickness*.5+.6),y=a.y-(b.x-a.x)/length*(thickness*.5+.6);
    c.save();c.translate(x,y);
    const wet=c.createRadialGradient(-.5,-1,.1,0,0,3.1);wet.addColorStop(0,'rgba(255,255,255,.8)');wet.addColorStop(.38,'rgba(220,246,255,.25)');wet.addColorStop(1,'rgba(62,120,147,.43)');
    c.fillStyle=wet;c.beginPath();c.ellipse(0,.6,1.55,2.45,0,0,Math.PI*2);c.fill();
    c.fillStyle='rgba(255,255,255,.8)';c.beginPath();c.ellipse(-.4,-.4,.45,.7,0,0,Math.PI*2);c.fill();c.restore();
  }
  c.restore();
}
function traceWandHandle(c,r,join,end) {
  c.beginPath();c.moveTo(-3.3,join);c.lineTo(-3.7,r+13);
  c.bezierCurveTo(-3.9,r+19,-8.1,r+20,-8.1,r+27);
  c.bezierCurveTo(-8.1,r+40,-7.0,end-22,-8.3,end-12);
  c.bezierCurveTo(-10.3,end+4,10.3,end+4,8.3,end-12);
  c.bezierCurveTo(7.0,end-22,8.1,r+40,8.1,r+27);
  c.bezierCurveTo(8.1,r+20,3.9,r+19,3.7,r+13);c.lineTo(3.3,join);c.closePath();
  // A real cut-through hanging hole in the rounded end of the handle.
  c.moveTo(2.2,end-7);c.ellipse(0,end-7,2.2,3.1,0,0,Math.PI*2);c.closePath();
}
function paintWandHandle(c,r,type,color,short,handleLength) {
  if(type==='double')r*=1.33;
  const end=r+(handleLength??(short?65:90)),join=r*(type==='star'?.50:.96);
  c.save();c.lineJoin='round';c.lineCap='round';
  c.save();c.translate(1.2,1.8);c.fillStyle=wandColor(color,-.42);c.shadowColor='rgba(51,72,88,.18)';c.shadowBlur=4;c.shadowOffsetY=1;
  traceWandHandle(c,r,join,end);c.fill('evenodd');c.restore();
  const plastic=c.createLinearGradient(-9,0,9,0);
  [[0,-.2],[.18,.18],[.32,.40],[.53,.10],[.8,-.10],[1,-.35]].forEach(([at,tint])=>plastic.addColorStop(at,wandColor(color,tint)));
  c.fillStyle=plastic;traceWandHandle(c,r,join,end);c.fill('evenodd');
  c.save();traceWandHandle(c,r,join,end);c.clip('evenodd');
  // Shallow ribs on the grip provide a tangible injection-molded finish.
  for(let y=r+30;y<end-17;y+=5){
    c.strokeStyle=wandColor(color,-.27);c.lineWidth=.7;c.beginPath();c.moveTo(-6.2,y);c.quadraticCurveTo(0,y+1.5,6.2,y);c.stroke();
    c.strokeStyle=wandColor(color,.38);c.lineWidth=.65;c.beginPath();c.moveTo(-5.8,y-.9);c.quadraticCurveTo(0,y+.3,5.8,y-.9);c.stroke();
  }
  c.strokeStyle='rgba(255,247,239,.52)';c.lineWidth=.75;c.beginPath();c.moveTo(-1.7,join+2);c.lineTo(-2,r+13);c.stroke();
  c.restore();
  // A small collar strengthens the narrow stem-to-grip joint.
  c.fillStyle=wandColor(color,-.20);c.beginPath();c.roundRect(-4.7,r+10,9.4,4,1.5);c.fill();
  c.fillStyle=wandColor(color,.35);c.beginPath();c.roundRect(-4.0,r+10.2,7.7,1.1,.5);c.fill();
  c.strokeStyle=wandColor(color,-.3);c.lineWidth=.65;c.beginPath();c.ellipse(0,end-7,2.6,3.5,0,0,Math.PI*2);c.stroke();
  c.restore();
}
function drawRealisticWand(c,p,type,color,short,dpr,handleLength) {
  const key=[type,p.r,color,short,dpr,handleLength].join(':');
  if(!wandSprites.has(key)){
    const extent=p.r*(type==='double'?1.33:1);
    const left=Math.ceil(p.r*1.4+18),top=extent+18,w=left*2,h=Math.ceil(extent*2+(handleLength??(short?65:90))+36);
    const sprite=document.createElement('canvas');sprite.width=Math.ceil(w*dpr);sprite.height=Math.ceil(h*dpr);
    const paint=sprite.getContext('2d');paint.setTransform(dpr,0,0,dpr,0,0);paint.translate(left,top);
    paintWandHandle(paint,p.r,type,color,short,handleLength);
    const thickness=short?7.5:8.5;
    if(type==='double')for(const side of [-1,1]){paint.save();paint.translate(0,side*p.r*.67);paintWandRing(paint,'round',p.r*.66,color,thickness);paint.restore()}
    else paintWandRing(paint,type,p.r,color,thickness);
    wandSprites.set(key,{sprite,left,top,w,h});
    // Retain only the handful of active viewport/shape variants.
    if(wandSprites.size>12)wandSprites.delete(wandSprites.keys().next().value);
  }
  const cached=wandSprites.get(key);c.drawImage(cached.sprite,p.x-cached.left,p.y-cached.top,cached.w,cached.h);
}
