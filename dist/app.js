'use strict';
const canvas=document.querySelector('#bubbles'),ctx=canvas.getContext('2d');
const bubble3D=new BubbleRenderer(document.querySelector('#bubble-depth'),'sky.jpg');
const $=s=>document.querySelector(s);
let width=innerWidth,height=innerHeight,active=null,bubbles=[],bursts=[],count=0,last=0,manual=false,breath=false,level=0,micStream=null,audioContext=null,analyser=null,samples=null,noiseFloor=.012,calibrationUntil=0,blowSince=0,quietSince=0,noticeTimer,requestVersion=0;
const wands={round:{label:'Round',color:'#ef8e86'},heart:{label:'Heart',color:'#df86a0'},star:{label:'Star',color:'#dda949'},double:{label:'Double ring',color:'#839bd5'}};
let selectedWand='round',filmSeed=Math.random()*6,started=false,micPending=false;
let flow=0,soundLevel=0,soundTime=0,manualAge=0,caption='';
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
const ease=n=>{n=clamp(n);return n*n*(3-2*n)};
const approach=(value,target,dt,tau)=>target+(value-target)*Math.exp(-dt/tau);
function setCaption(text){if(text!==caption){caption=text;$('#scene-caption').textContent=text}}
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
function resize(){const box=canvas.getBoundingClientRect();width=box.width;height=box.height;canvas.width=width*Math.min(devicePixelRatio,2);canvas.height=height*Math.min(devicePixelRatio,2);ctx.setTransform(Math.min(devicePixelRatio,2),0,0,Math.min(devicePixelRatio,2),0,0)}
addEventListener('resize',resize);resize();
function origin(){return{x:width/2,y:height*(width<=600?.70:.74),r:Math.min(width*.095,height*.105,100)}}
// Shared contours keep the selected wand and its bubbles in sync.
function contour(type,r){
 ctx.beginPath();
 if(type==='heart'){
  ctx.moveTo(0,r);ctx.bezierCurveTo(-.35*r,.68*r,-1.2*r,.02*r,-.94*r,-.57*r);
  ctx.bezierCurveTo(-.72*r,-1.13*r,-.2*r,-1.05*r,0,-.58*r);
  ctx.bezierCurveTo(.2*r,-1.05*r,.72*r,-1.13*r,.94*r,-.57*r);
  ctx.bezierCurveTo(1.2*r,.02*r,.35*r,.68*r,0,r);ctx.closePath();
 }else if(type==='star'){
  for(let i=0;i<10;i++){const angle=-Math.PI/2+i*Math.PI/5,rad=i%2?r*.51:r;const x=Math.cos(angle)*rad,y=Math.sin(angle)*rad;i?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.closePath();
 }else{ctx.arc(0,0,r,0,Math.PI*2)}
}
function bubble(x,y,r,seed=0,alpha=1,type='round',motion={}){
 if(type==='double'){
  const spacing=motion.spacing??r*.6;
  for(const side of [-1,1]){
   const child={...motion};
   if(motion.attachment){const a=motion.attachment;child.attachment={...a,y:a.y+side*a.r*.67,r:a.r*.66}}
   bubble(x,y+side*spacing,r*.61,seed+(side+1)/2,alpha,'round',child);
  }
  return;
 }
 if(bubble3D.ready){bubble3D.add(x,y,r,seed,alpha,type,motion);return}
 if(motion.film){paintMembrane(x,y,r,seed,alpha*motion.film,type,motion);if(motion.film>=.999)return;alpha*=1-motion.film}
 ctx.save();
 if(motion.rupture){const hole=motion.rupture;ctx.beginPath();ctx.rect(0,0,width,height);ctx.moveTo(hole.x+hole.r,hole.y);ctx.arc(hole.x,hole.y,hole.r,0,Math.PI*2);ctx.clip('evenodd')}
 ctx.globalAlpha=alpha;ctx.translate(x,y);if(motion.scale)ctx.scale(motion.scale[0],motion.scale[1]);
 const wash=ctx.createRadialGradient(-r*.4,-r*.4,r*.05,0,0,r);wash.addColorStop(0,'rgba(255,255,255,.015)');wash.addColorStop(.72,'rgba(233,251,255,.045)');wash.addColorStop(.91,'rgba(237,224,255,.09)');wash.addColorStop(.975,'rgba(238,252,255,.42)');wash.addColorStop(1,'rgba(255,255,255,.12)');ctx.fillStyle=wash;contour(type,r);ctx.fill();
 const ring=ctx.createConicGradient(seed,0,0);[['#fff9',0],['#f9b9dbcc',.14],['#c5b5f7bb',.28],['#95ecfacb',.43],['#fff5b5cd',.6],['#f5abc6d0',.75],['#e4faff',.91],['#fff9',1]].forEach(([c,p])=>ring.addColorStop(p,c));ctx.lineWidth=Math.max(1.5,r*.015);ctx.strokeStyle=ring;ctx.lineJoin='round';contour(type,r);ctx.stroke();
 if(type==='round'){
  ctx.lineWidth=r*.05;ctx.strokeStyle='rgba(255,255,255,.48)';ctx.lineCap='round';ctx.beginPath();ctx.arc(0,0,r*.91,3.72,4.25);ctx.stroke();ctx.lineWidth=r*.017;ctx.strokeStyle='rgba(255,255,255,.6)';ctx.beginPath();ctx.arc(0,0,r*.86,3.7,4.32);ctx.stroke();ctx.lineWidth=r*.023;ctx.strokeStyle='rgba(255,235,247,.46)';ctx.beginPath();ctx.arc(0,0,r*.95,.45,.96);ctx.stroke();
 }else{
  ctx.save();contour(type,r*.99);ctx.clip();ctx.strokeStyle='rgba(255,255,255,.4)';ctx.lineWidth=r*.025;ctx.translate(-r*.025,-r*.02);contour(type,r*.94);ctx.stroke();ctx.restore();
 }
 ctx.restore();
}
function paintMembrane(x,y,r,time,alpha,type,motion){
 ctx.save();
 if(motion.rupture){const hole=motion.rupture;ctx.beginPath();ctx.rect(0,0,width,height);ctx.moveTo(hole.x+hole.r,hole.y);ctx.arc(hole.x,hole.y,hole.r,0,Math.PI*2);ctx.clip('evenodd')}
 ctx.translate(x,y);ctx.globalAlpha=alpha;
 if(motion.scale)ctx.scale(motion.scale[0],motion.scale[1]);
 contour(type,r);ctx.clip();
 const shift=Math.sin(time*.42)*r*.08;
 const sheen=ctx.createLinearGradient(-r*.3,-r+shift,r*.45,r+shift);
 [[0,'rgba(189,220,255,.12)'],[.22,'rgba(228,195,247,.22)'],[.43,'rgba(255,219,194,.19)'],[.64,'rgba(197,246,233,.19)'],[.82,'rgba(170,217,255,.22)'],[1,'rgba(235,199,248,.25)']].forEach(([stop,color])=>sheen.addColorStop(stop,color));
 ctx.fillStyle=sheen;ctx.fillRect(-r*1.1,-r*1.1,r*2.2,r*2.2);
 ctx.strokeStyle='rgba(255,255,255,.13)';ctx.lineWidth=r*.04;
 ctx.beginPath();ctx.moveTo(-r*.82,-r*.35+shift);ctx.bezierCurveTo(-r*.3,-r*.65+shift,r*.3,-r*.17+shift,r*.82,-r*.38+shift);ctx.stroke();
 const wet=ctx.createLinearGradient(0,-r,0,r);wet.addColorStop(0,'rgba(231,245,255,.28)');wet.addColorStop(.5,'rgba(237,210,255,.35)');wet.addColorStop(1,'rgba(214,249,255,.58)');
 ctx.strokeStyle=wet;ctx.lineWidth=2.5;contour(type,r*.985);ctx.stroke();ctx.restore();
}
function makeBubble(r){
 const p=origin(),base=selectedWand==='double'?(p.r*.66-.6)/.61:p.r-.6;
 return{x:p.x,y:p.y,r:r??base,base,type:selectedWand,seed:filmSeed,vx:0,vy:0,age:0,freeAge:0,air:0,inflation:0,anchor:{...p},phase:'attached',motion:{scale:[1,1,.045],tilt:0,film:1,spacing:p.r*.67,attachment:{...p,growth:0,amount:1,pinch:0}}};
}
function release(immediate=false){
 if(!active)return;
 const source=active;active=null;filmSeed=Math.random()*6;
 if(!immediate&&source.air<source.base**3*.015)return;
 const parts=source.type==='double'?[-1,1].map(side=>({...source,type:'round',y:source.y+side*(source.motion.spacing??source.r*.6),r:source.r*.61,anchor:{x:source.anchor.x,y:source.anchor.y+side*source.anchor.r*.67,r:source.anchor.r*.66},vx:side*(3+flow*5),seed:source.seed+(side+1)/2})):[source];
 for(const b of parts){
  b.phase=immediate?'free':'pinching';b.detachAge=0;b.freeAge=0;b.launch=flow;b.vy=2+flow*7;
  b.releaseInflation=immediate?undefined:source.inflation;
  b.releaseFilm=immediate?0:(source.motion?.film||0);
  b.releaseScale=[...(source.motion?.scale||[1,1,1])];b.anchor={...b.anchor};
  if(immediate){b.releaseScale=[1,1,1];b.motion={scale:[1,1,1],tilt:1}}
  if(!immediate)b.motion={...b.motion,attachment:{...b.anchor,growth:b.inflation,amount:1,pinch:0}};
  bubbles.push(b);
 }
 // One pop per completed breath, including a paired release from the double wand.
 if(!immediate)window.bubbleSound?.pop(parts[0].r);
 count+=parts.length;$('#count').textContent=String(count).padStart(2,'0');$('#count-label').textContent=count>=2?'bubbles':'bubble';setCaption('Release gently and let the bubble drift away.');
}
function inflate(dt,time){
 if(!active)active=makeBubble();
 const b=active,p=origin();b.anchor={...p};
 const limit=Math.min(width*(b.type==='double'?.29:.37),height*.27,245);
 // Air adds volume, so an already-large bubble grows more slowly.
 b.air=Math.min(b.air+flow*1200000*dt,Math.max(0,limit**3-b.base**3));
 const target=Math.cbrt(b.base**3+b.air);b.r=approach(b.r,target,dt,.15);
 b.inflation=ease((b.r-b.base)/(b.base*.95));
 const t=b.inflation,wiggle=reduced?0:Math.sin(time*.005+b.seed)*.018*flow*t;
 const stretch=1+.065*flow*t+wiggle;
 b.motion={scale:[1/Math.sqrt(stretch),stretch,.045+.955*t],tilt:t*.35,film:1-ease(t/.45),spacing:p.r*.67*(1-t)+b.r*.6*t,attachment:{...p,growth:t,amount:1,pinch:0}};
 const visualR=b.r*(b.type==='double'?.61:1);
 b.x=p.x+(reduced?0:Math.sin(time*.0018+b.seed)*p.r*.13*flow*t);
 b.y=p.y-(visualR*stretch+p.r*.25)*t;
 setCaption(flow>.68?'A steady breath gently inflates the bubble.':'Blow gently and watch the bubble grow.');
}
function drift(b,dt,time){
 b.age+=dt;
 if(b.phase==='pinching'){
  b.detachAge+=dt;b.y-=dt*(5+b.launch*10);b.x+=b.vx*dt;
  if(b.detachAge>=.42){b.phase='free';b.freeAge=0}
 }else{
  b.freeAge=(b.freeAge??b.age)+dt;
  const rise=34+44/Math.sqrt(Math.max(.5,b.r/35));
  const wind=Math.sin(time*.00023+b.y*.0017)*9+Math.sin(time*.00051+b.seed)*3;
  b.vy=approach(b.vy,rise,dt,.60);b.vx=approach(b.vx,wind,dt,1.8);
  b.y-=b.vy*dt;b.x+=b.vx*dt;
 }
 const since=(b.detachAge||0)+(b.freeAge||0),relax=ease(since/.62),initial=b.releaseScale||[1,1,1];
 const wobble=reduced?0:Math.sin(since*10+b.seed)*(.055*Math.exp(-since*1.7)+.008);
 b.motion={scale:[(initial[0]+(1-initial[0])*relax)*(1-wobble*.5),(initial[1]+(1-initial[1])*relax)*(1+wobble),Math.max(.045,initial[2]+(1-initial[2])*relax)],tilt:relax,film:(b.releaseFilm||0)*(1-relax)};
 if(b.releaseInflation!==undefined&&since<.72){
  b.motion.attachment={...b.anchor,growth:b.releaseInflation+(1-b.releaseInflation)*relax,pinch:ease(since/.42),amount:1-ease((since-.32)/.40)};
 }
 b.screenR=b.r/(1+(b.freeAge||0)*.006);
}
function drawNeck(b){
 if(bubble3D.ready||!b.anchor||(b.phase!=='attached'&&b.phase!=='pinching'))return;
 if(b.type==='double'){
  for(const side of [-1,1])drawNeck({...b,type:'round',y:b.y+side*(b.motion?.spacing??b.r*.6),r:b.r*.61,anchor:{x:b.anchor.x,y:b.anchor.y+side*b.anchor.r*.67,r:b.anchor.r*.66}});
  return;
 }
 const pinch=b.phase==='pinching'?ease(b.detachAge/.42):0;
 const a=b.anchor,sy=b.motion?.scale[1]||1,top=b.y+b.r*sy*.78,bottom=a.y-a.r*.16;
 if(top>=bottom||pinch>=1)return;
 const neck=a.r*.60*(1-pinch),shoulder=b.r*.39*(1-pinch*.5),middle=(top+bottom)/2;
 ctx.save();const gradient=ctx.createLinearGradient(b.x,top,a.x,bottom);
 gradient.addColorStop(0,'rgba(219,246,255,.015)');gradient.addColorStop(.55,'rgba(235,209,253,.10)');gradient.addColorStop(1,'rgba(202,243,255,.19)');
 ctx.fillStyle=gradient;ctx.strokeStyle=`rgba(246,246,255,${.36*(1-pinch)})`;ctx.lineWidth=.85;
 ctx.beginPath();ctx.moveTo(b.x-shoulder,top);ctx.bezierCurveTo(b.x-shoulder*.7,middle,a.x-neck,middle,a.x-neck,bottom);
 ctx.quadraticCurveTo(a.x,bottom+a.r*.12,a.x+neck,bottom);ctx.bezierCurveTo(a.x+neck,middle,b.x+shoulder*.7,middle,b.x+shoulder,top);
 ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
}
function drawFilm(time){
 const p=origin(),film={scale:[1,1,.045],tilt:0,film:1,spacing:p.r*.67};
 const radius=selectedWand==='double'?(p.r*.66-.6)/.61:p.r-.6;
 bubble(p.x,p.y,radius,filmSeed+(reduced?0:time/6500),1,selectedWand,film);
}
function selectWand(type){
 if(!Object.hasOwn(wands,type))throw new Error('Unknown wand');
 if(selectedWand===type)return;
 release(true);selectedWand=type;filmSeed=Math.random()*6;
 $('#previous-wand').setAttribute('aria-label','Previous wand. Current: '+wands[type].label);
 $('#next-wand').setAttribute('aria-label','Next wand. Current: '+wands[type].label);
 setCaption(type==='double'?'Double ring: release two bubbles together.':wands[type].label+' wand, ready for your next breath.');
}
function drawWand(){
 const p=origin();drawRealisticWand(ctx,p,selectedWand,wands[selectedWand].color,width<760,Math.min(devicePixelRatio,2),Math.max(90,height-p.y-p.r*(selectedWand==='double'?1.33:1)+20));
}
function setManual(on){if(on)window.bubbleSound?.unlock();if(on&&!manual)manualAge=0;manual=on;if(!on&&!breath)release()}
function notify(text){$('#notice').textContent=text;$('#notice').hidden=false;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('#notice').hidden=true,5200)}
function enterExperience(){window.bubbleIntro?.revealStart();started=true;$('#start-button').hidden=true}
function stopMic(){requestVersion++;micStream?.getTracks().forEach(t=>t.stop());micStream=null;analyser=null;samples=null;audioContext?.close().catch(()=>{});audioContext=null;breath=false;level=0;soundLevel=0;soundTime=0;blowSince=quietSince=0;if(!manual)release();document.body.classList.remove('listening');$('#mic-status').textContent='Microphone off.';}
async function startExperience(){
 window.bubbleSound?.play('bubble-pop-m',.65);
 enterExperience();if(micStream||micPending)return;
 micPending=true;const version=++requestVersion;
 try{
  if(!navigator.mediaDevices?.getUserMedia)throw new Error('unsupported');
  const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:false,autoGainControl:false},video:false});
  if(version!==requestVersion){stream.getTracks().forEach(t=>t.stop());return}
  micStream=stream;audioContext=new (window.AudioContext||window.webkitAudioContext)();await audioContext.resume();
  if(version!==requestVersion)return;
  analyser=audioContext.createAnalyser();analyser.fftSize=1024;audioContext.createMediaStreamSource(stream).connect(analyser);samples=new Float32Array(analyser.fftSize);noiseFloor=.008;calibrationUntil=performance.now()+1400;
  $('#mic-status').textContent='Stay quiet for a moment while the microphone calibrates…';document.body.classList.add('listening');
  stream.getAudioTracks()[0].addEventListener('ended',()=>{if(micStream===stream){stopMic();$('#start-button').hidden=false;notify('Microphone disconnected. Select Start to retry, or hold Space.')}});
 }catch(e){if(version===requestVersion){stopMic();notify('Microphone unavailable. Hold Space or the wand, then release to let the bubble float.')}}finally{micPending=false}
}
function sampleBreath(time){
 if(!analyser)return;
 if(!breath&&performance.now()<(window.bubbleSound?.suppressUntil||0)){blowSince=0;return}
 const dt=clamp((time-soundTime)/1000,.001,.06);soundTime=time;
 analyser.getFloatTimeDomainData(samples);
 let mean=0;for(const s of samples)mean+=s;mean/=samples.length;
 let sum=0;for(const s of samples)sum+=(s-mean)**2;
 const rms=Math.sqrt(sum/samples.length);
 soundLevel=approach(soundLevel,rms,dt,rms>soundLevel?.055:.12);
 if(time<calibrationUntil){noiseFloor=approach(noiseFloor,rms,dt,.3);level=0;return}
 const onset=Math.max(.014,noiseFloor*2.4),offset=Math.max(.008,noiseFloor*1.5);
 // Separate onset/offset thresholds and a brief grace period allow natural pauses.
 if(breath?soundLevel>offset:(rms>onset&&soundLevel>onset*.75)){
  quietSince=0;
  if(!blowSince)blowSince=time;
  if(time-blowSince>=120)breath=true;
 }else{
  blowSince=0;
  if(!quietSince)quietSince=time;
  if(breath&&time-quietSince>240){breath=false;if(!manual)release()}
  if(!breath)noiseFloor=approach(noiseFloor,Math.min(rms,.06),dt,8);
 }
 const target=breath?clamp((soundLevel-offset)/Math.max(.055,onset*2.2)):0;
 level=approach(level,target,dt,target>level?.08:.16);
 $('#mic-status').textContent=breath?'Breath detected. Keep blowing gently.':'Microphone ready. Blow gently.';
}
function frame(time){
 bubble3D.begin(width,height);
 const dt=clamp((time-last)/1000||0,0,.04);last=time;sampleBreath(time);
 const blowing=manual||breath;
 if(manual)manualAge+=dt;
 const target=manual?.52+(reduced?0:Math.sin(manualAge*2.1)*.025):breath?level:0;
 flow=approach(flow,target,dt,target>flow?.13:.22);
 document.body.classList.toggle('blowing',blowing);
 if(blowing)inflate(dt,time);
 window.bubbleSound?.setBreath(blowing,flow,!!micStream&&!manual);

 ctx.clearRect(0,0,width,height);
 bubbles.sort((a,b)=>b.age-a.age);
 for(const b of bubbles){drift(b,dt,time);bubble(b.x,b.y,b.screenR,b.seed+(reduced?0:time/6500),1,b.type,b.motion)}
 bubbles=bubbles.filter(b=>b.y+b.r>-50&&b.x+b.r>-100&&b.x-b.r<width+100).slice(-45);
 if(active)bubble(active.x,active.y,active.r,active.seed+(reduced?0:time/6500),1,active.type,active.motion);
 else if(!bubbles.some(b=>b.phase==='pinching'&&b.anchor&&Math.abs(b.anchor.x-origin().x)<1&&(selectedWand==='double'?[-1,1].some(side=>Math.abs(b.anchor.y-origin().y-side*origin().r*.67)<1):Math.abs(b.anchor.y-origin().y)<1)))drawFilm(time);
 for(const burst of bursts){burst.advance(dt);const s=burst.surface();if(s)bubble(s.x,s.y,s.r,s.seed,s.alpha,s.type,s.motion)}
 bubble3D.render();
 for(const b of bubbles)drawNeck(b);
 if(active)drawNeck(active);
 drawWand();
 for(const burst of bursts)burst.drawDroplets(ctx);
 bursts=bursts.filter(b=>b.age<b.duration+.55);requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
$('#start-button').addEventListener('click',startExperience);
function cycleWand(direction){window.bubbleSound?.play('change',.45);const types=Object.keys(wands);selectWand(types[(types.indexOf(selectedWand)+direction+types.length)%types.length])}
$('#previous-wand').addEventListener('click',()=>cycleWand(-1));
$('#next-wand').addEventListener('click',()=>cycleWand(1));
addEventListener('keydown',e=>{if(e.code==='Space'&&!['INPUT','TEXTAREA'].includes(document.activeElement.tagName)){e.preventDefault();if(!e.repeat){enterExperience();setManual(true)}}});
addEventListener('keyup',e=>{if(e.code==='Space'){e.preventDefault();setManual(false)}});
addEventListener('blur',()=>{manual=false;breath=false;release()});
document.addEventListener('visibilitychange',()=>{if(document.hidden){stopMic();setManual(false);$('#start-button').hidden=false}});
function popBubbleAt(x,y){
 const i=bubbles.findLastIndex(b=>{
  const r=b.screenR||b.r,scale=b.motion?.scale||[1,1,1],dx=(x-b.x)/scale[0],dy=(y-b.y)/scale[1];
  return Math.hypot(dx,dy)<r*bubbleOutlineRadius(b.type)(Math.atan2(dy,dx));
 });
 if(i<0)return false;
 const b=bubbles.splice(i,1)[0];window.bubbleSound?.pop(b.screenR||b.r);bursts.push(new BubbleBurst(b,x,y,reduced));bursts=bursts.slice(-20);return true;
}
canvas.addEventListener('pointerdown',e=>{
 if(e.button!==0)return;
 const rect=canvas.getBoundingClientRect(),p=origin(),x=e.clientX-rect.left,y=e.clientY-rect.top;
 // Popping a bubble over the wand must not also start a new breath.
 if(popBubbleAt(x,y))return;
 if(Math.abs(x-p.x)>p.r*1.5||y<p.y-p.r*1.5)return;
 enterExperience();canvas.setPointerCapture(e.pointerId);setManual(true);
});
for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,()=>setManual(false));
canvas.addEventListener('contextmenu',e=>e.preventDefault());
addEventListener('pagehide',stopMic);
if(document.modelContext?.registerTool){try{Promise.resolve(document.modelContext.registerTool({name:'release_bubble',title:'Blow a Bubble',description:'Create and release a bubble into the sky.',inputSchema:{type:'object',properties:{size:{type:'number',minimum:40,maximum:200}},required:['size'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){if(!input||typeof input.size!=='number'||!Number.isFinite(input.size)||input.size<40||input.size>200||Object.keys(input).some(k=>k!=='size'))throw new Error('size must be between 40 and 200');if(manual||breath)throw new Error('Finish your current breath first.');active=makeBubble(Math.min(input.size,width*.37));active.y=origin().y-active.r;release(true);return{released:true,count}}})).catch(()=>{})}catch{}}
