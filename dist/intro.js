'use strict';
(() => {
 const intro=document.querySelector('#bubble-intro'),start=document.querySelector('#start-button');
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 let remaining=0,revealed=false;
 const timers=new Set();
 function later(fn,delay){const id=setTimeout(()=>{timers.delete(id);fn()},delay);timers.add(id);return id}
 function revealStart(){if(revealed)return;revealed=true;start.classList.remove('intro-pending');start.inert=false}
 window.bubbleIntro={revealStart};
 function removeLetter(letter){if(!letter.isConnected)return;letter.remove();remaining--;if(!remaining){revealStart();intro.remove()}}
 function pop(letter,event){
  if(letter.disabled)return;
  letter.disabled=true;letter.style.animationPlayState='paused';
  if(document.activeElement===letter){revealStart();start.focus({preventScroll:true})}
  const box=letter.getBoundingClientRect(),stage=document.querySelector('#experience');
  const px=event?.detail?event.clientX-box.left:box.width/2,py=event?.detail?event.clientY-box.top:box.height/2;
  if(!reduced){
   const reach=Math.hypot(box.width,box.height);
   for(let frame=0;frame<=12;frame++)later(()=>{
    const t=frame/12,hole=reach*t;
    const mask=`radial-gradient(circle at ${px}px ${py}px, transparent ${hole}px, #000 ${hole+1}px)`;
    letter.style.maskImage=mask;letter.style.webkitMaskImage=mask;letter.style.opacity=String(1-t*.6);
   },frame*12);
  }else letter.classList.add('popped');
  if(!reduced)for(let i=0;i<7;i++){
   const drop=document.createElement('i'),angle=(i+Math.random()*.7)/7*Math.PI*2;
   drop.className='intro-droplet';drop.setAttribute('aria-hidden','true');
   drop.style.left=box.left+box.width/2+Math.cos(angle)*box.width*.32+'px';drop.style.top=box.top+box.height/2+Math.sin(angle)*box.height*.32+'px';
   const size=.8+Math.random()*1.4;drop.style.width=size+'px';drop.style.height=size*1.3+'px';
   drop.style.setProperty('--dx',Math.cos(angle)*(12+Math.random()*16)+'px');drop.style.setProperty('--dy',(Math.sin(angle)*10+18+Math.random()*12)+'px');
   stage.append(drop);later(()=>drop.remove(),650);
  }
  revealStart();later(()=>removeLetter(letter),220);
 }
 let index=0;
 for(const word of ['Blow','a','Bubble']){
  const row=document.createElement('div');row.className='intro-word';
  for(const char of word){
   const letter=document.createElement('button');letter.type='button';letter.className='bubble-letter';letter.dataset.letter=char;letter.textContent=char;
   letter.setAttribute('aria-label','Pop letter '+char);
   const delay=1.5+index*.13,duration=10+(index%4)*.8;
   letter.style.setProperty('--delay',delay+'s');letter.style.setProperty('--duration',duration+'s');
   letter.style.setProperty('--sway',((index%2?1:-1)*(18+index*4))+'px');
   letter.style.setProperty('--tilt',((index%2?1:-1)*8)+'deg');
   letter.addEventListener('click',event=>pop(letter,event));
   letter.addEventListener('animationend',e=>{if(e.target===letter)removeLetter(letter)});
   row.append(letter);remaining++;index++;
   // A bounded lifetime also cleans up when CSS animation events are unavailable.
   later(()=>removeLetter(letter),reduced?8500:(delay+duration)*1000+300);
  }
  intro.append(row);
 }
 // Cache one curved-surface rendering per glyph after the local font and sky load.
 const sky=new Image();
 const skyReady=new Promise((resolve,reject)=>{sky.onload=resolve;sky.onerror=reject});sky.src='sky.jpg';
 Promise.all([document.fonts.load('220px Coiny'),skyReady]).then(()=>{
  if(!intro.isConnected)return;
  const type=new BubbleType(sky);
  intro.querySelectorAll('.bubble-letter').forEach(letter=>type.paint(letter));
 }).catch(()=>{}); // Keep accessible, styled text if canvas or the asset is unavailable.
 // Start becomes usable while most of the title is still floating on screen.
 later(revealStart,reduced?400:1600);
 addEventListener('pagehide',()=>{for(const id of timers)clearTimeout(id);timers.clear();revealStart();intro.remove();document.querySelectorAll('.intro-droplet').forEach(drop=>drop.remove())},{once:true});
})();
