'use strict';
class BubbleSound {
 constructor(){
  this.context=null;this.buffers={};this.voices=new Set();this.breath=null;this.suppressUntil=0;
  try{this.muted=localStorage.getItem('bubble-muted')==='true'}catch{this.muted=false}
 }
 unlock(){
  if(!this.context){
   const AudioEngine=window.AudioContext||window.webkitAudioContext;if(!AudioEngine)return;
   this.context=new AudioEngine();this.master=this.context.createGain();this.master.gain.value=this.muted?0:.65;this.master.connect(this.context.destination);
   for(const name of ['blow','bubble-pop-s','bubble-pop-m','bubble-pop-l','change']){
    fetch(`assets/audio/${name}.mp3`).then(r=>{if(!r.ok)throw Error('Audio unavailable');return r.arrayBuffer()}).then(data=>this.context.decodeAudioData(data)).then(buffer=>{this.buffers[name]=buffer}).catch(()=>{});
   }
  }
  if(this.context.state==='suspended')this.context.resume().catch(()=>{});
 }
 toggle(){this.unlock();this.muted=!this.muted;if(this.master)this.master.gain.setTargetAtTime(this.muted?0:.65,this.context.currentTime,.02);try{localStorage.setItem('bubble-muted',String(this.muted))}catch{}return this.muted}
 play(name,volume=.6){
  this.unlock();const started=performance.now();
  const attempt=()=>{
   if(this.muted||document.hidden||!this.context)return;
   if(!this.buffers[name]){if(performance.now()-started<1500)setTimeout(attempt,40);return}
   if(this.voices.size>=6)return;
   const source=this.context.createBufferSource(),gain=this.context.createGain();source.buffer=this.buffers[name];gain.gain.value=volume;source.connect(gain);gain.connect(this.master);
   this.voices.add(source);source.onended=()=>{this.voices.delete(source);source.disconnect();gain.disconnect()};
   this.suppressUntil=Math.max(this.suppressUntil,performance.now()+source.buffer.duration*1000+180);source.start();
  };attempt();
 }
 pop(radius){this.play(radius<65?'bubble-pop-s':radius<115?'bubble-pop-m':'bubble-pop-l',.65)}
 setBreath(active,strength,microphone){
  // Keep microphone playback quieter; echo cancellation reduces speaker feedback.
  const audible=active&&!this.muted&&!document.hidden;
  if(!this.context||!this.buffers.blow)return;
  if(audible&&!this.breath){
   const source=this.context.createBufferSource(),gain=this.context.createGain();source.buffer=this.buffers.blow;source.loop=true;gain.gain.value=0;source.connect(gain);gain.connect(this.master);source.start();this.breath={source,gain};
  }
  if(this.breath){const {source,gain}=this.breath;const volume=microphone ? .16+Math.min(1,strength)*.12 : .42+Math.min(1,strength)*.30;gain.gain.setTargetAtTime(audible?volume:0,this.context.currentTime,.04);
   if(!audible){source.stop(this.context.currentTime+.16);source.onended=()=>{source.disconnect();gain.disconnect()};this.breath=null}
  }
 }
 stop(){if(this.breath){this.breath.source.stop();this.breath.source.disconnect();this.breath.gain.disconnect();this.breath=null}for(const voice of this.voices)voice.stop();this.voices.clear()}
}
window.bubbleSound=new BubbleSound();
const soundButton=document.querySelector('#sound-toggle');
function updateSoundButton(){const muted=window.bubbleSound.muted;soundButton.textContent=muted?'Sound off':'Sound on';soundButton.setAttribute('aria-pressed',String(!muted));soundButton.setAttribute('aria-label',muted?'Enable sound effects':'Mute sound effects')}
soundButton.addEventListener('click',()=>{window.bubbleSound.toggle();updateSoundButton()});updateSoundButton();
addEventListener('pointerdown',()=>window.bubbleSound.unlock(),{capture:true});
addEventListener('keydown',e=>{if(e.code==='Space'||e.code==='Enter')window.bubbleSound.unlock()},{capture:true});
addEventListener('blur',()=>window.bubbleSound.setBreath(false,0,false));
addEventListener('pagehide',()=>window.bubbleSound.stop());
document.addEventListener('visibilitychange',()=>{if(document.hidden)window.bubbleSound.stop()});
