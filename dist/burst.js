'use strict';
// A puncture opens from the contact point. The retracting rim sheds a few
// uneven droplets only as it reaches the outside of the original film.
class BubbleBurst {
 constructor(bubble,x,y,reduced=false){
  this.bubble={...bubble,motion:{...bubble.motion}};this.x=x;this.y=y;this.age=0;this.reduced=reduced;
  this.radius=bubble.screenR||bubble.r;
  this.reach=Math.hypot(x-bubble.x,y-bubble.y)+this.radius*1.25;
  this.duration=reduced?.12:Math.min(.21,.115+this.radius*.00045);
  this.drops=[];
  if(!reduced){
   const outline=bubbleOutlineRadius(bubble.type),scale=bubble.motion?.scale||[1,1,1];
   const total=Math.min(22,Math.max(9,Math.round(this.radius*.18)));
   for(let n=0;n<total;n++){
    const angle=(n+Math.random()*.8)/total*Math.PI*2,r=this.radius*outline(angle);
    const px=bubble.x+Math.cos(angle)*r*scale[0],py=bubble.y+Math.sin(angle)*r*scale[1];
    const outward=Math.atan2(py-y,px-x)+(Math.random()-.5)*.4;
    const speed=28+Math.random()*65;
    this.drops.push({x:px,y:py,vx:Math.cos(outward)*speed,vy:Math.sin(outward)*speed-12,
     delay:Math.hypot(px-x,py-y)/this.reach*this.duration,life:.22+Math.random()*.24,size:.45+Math.random()*1.05});
   }
  }
 }
 advance(dt){this.age+=dt;return this.age<this.duration+.55}
 surface(){
  if(this.age>=this.duration)return null;
  const b=this.bubble,t=this.age/this.duration;
  return{x:b.x,y:b.y,r:this.radius,seed:b.seed,type:b.type,
   alpha:this.reduced?1-t:1-t*.3,
   motion:{...b.motion,rupture:this.reduced?null:{x:this.x,y:this.y,r:this.reach*t}}};
 }
 drawDroplets(ctx){
  if(this.reduced)return;
  ctx.save();
  for(const d of this.drops){
   const t=this.age-d.delay;if(t<0||t>d.life)continue;
   const drag=(1-Math.exp(-t*4))/4,x=d.x+d.vx*drag,y=d.y+d.vy*drag+105*t*t;
   ctx.globalAlpha=.66*(1-t/d.life)**1.4;
   ctx.fillStyle='rgba(234,249,255,.85)';ctx.beginPath();
   ctx.ellipse(x,y,d.size*.7,d.size*(1+Math.min(.6,t*2)),Math.atan2(d.vy+210*t,d.vx)-Math.PI/2,0,Math.PI*2);ctx.fill();
   ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(x-.25,y-.35,Math.max(.25,d.size*.3),0,Math.PI*2);ctx.fill();
  }
  ctx.restore();
 }
}
