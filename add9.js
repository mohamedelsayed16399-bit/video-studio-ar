/* ===== R92 (add9.js): voice effects for a clip's audio (robot, echo, radio, underwater, cave) rendered offline on the device ===== */
(function(){
  let busy=false,msg='';
  const FX=[['robot','🤖 روبوت'],['echo','🔁 صدى'],['radio','📻 راديو قديم'],['water','🌊 تحت الماء'],['cave','🏔 كهف (ريفيرب)']];
  function wav(chs,sr){const n=chs[0].length,nc=chs.length,buf=new ArrayBuffer(44+n*nc*2),v=new DataView(buf);const W=(o,s)=>{for(let i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i))};W(0,'RIFF');v.setUint32(4,36+n*nc*2,true);W(8,'WAVEfmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,nc,true);v.setUint32(24,sr,true);v.setUint32(28,sr*nc*2,true);v.setUint16(32,nc*2,true);v.setUint16(34,16,true);W(36,'data');v.setUint32(40,n*nc*2,true);let o=44;for(let i=0;i<n;i++)for(let ch=0;ch<nc;ch++){const x=Math.max(-1,Math.min(1,chs[ch][i]));v.setInt16(o,x<0?x*32768:x*32767,true);o+=2}return new Blob([buf],{type:'audio/wav'})}
  function impulse(oc,sec){const n=Math.floor(oc.sampleRate*sec),b=oc.createBuffer(2,n,oc.sampleRate);for(let ch=0;ch<2;ch++){const d=b.getChannelData(ch);for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/n,2.5)}return b}
  async function render(buf,i0,i1,kind){
    const sr=buf.sampleRate,len=i1-i0,nc=Math.min(2,buf.numberOfChannels),oc=new OfflineAudioContext(nc,len,sr);
    const seg=oc.createBuffer(nc,len,sr);for(let ch=0;ch<nc;ch++)seg.getChannelData(ch).set(buf.getChannelData(ch).subarray(i0,i1));
    const src=oc.createBufferSource();src.buffer=seg;let last=src;
    const chain=n=>{last.connect(n);last=n};
    if(kind==='robot'){const g=oc.createGain();g.gain.value=0;const o=oc.createOscillator();o.frequency.value=55;o.type='sine';o.connect(g.gain);chain(g);o.start();
      const d=oc.createDelay(.05);d.delayTime.value=.012;const fb=oc.createGain();fb.gain.value=.5;d.connect(fb);fb.connect(d);const mix=oc.createGain();last.connect(d);d.connect(mix);last.connect(mix);last=mix}
    else if(kind==='echo'){const d=oc.createDelay(1);d.delayTime.value=.28;const fb=oc.createGain();fb.gain.value=.45;d.connect(fb);fb.connect(d);const mix=oc.createGain();last.connect(mix);last.connect(d);d.connect(mix);last=mix}
    else if(kind==='radio'){const hp=oc.createBiquadFilter();hp.type='highpass';hp.frequency.value=500;const lp=oc.createBiquadFilter();lp.type='lowpass';lp.frequency.value=3200;const ws=oc.createWaveShaper();const c=new Float32Array(256);for(let i=0;i<256;i++){const x=i/128-1;c[i]=Math.tanh(x*3)}ws.curve=c;chain(hp);chain(lp);chain(ws)}
    else if(kind==='water'){const lp=oc.createBiquadFilter();lp.type='lowpass';lp.frequency.value=420;lp.Q.value=4;chain(lp);const g=oc.createGain();g.gain.value=1.8;chain(g)}
    else if(kind==='cave'){const cv=oc.createConvolver();cv.buffer=impulse(oc,2.2);const dry=oc.createGain();dry.gain.value=.7;const wet=oc.createGain();wet.gain.value=.9;const mix=oc.createGain();last.connect(dry);dry.connect(mix);last.connect(cv);cv.connect(wet);wet.connect(mix);last=mix}
    last.connect(oc.destination);src.start();
    const out=await oc.startRendering();const chs=[];let pk=0;for(let ch=0;ch<out.numberOfChannels;ch++){const d=out.getChannelData(ch);for(let i=0;i<d.length;i++)pk=Math.max(pk,Math.abs(d[i]));chs.push(d)}
    const g=pk>.95?.95/pk:1;if(g!==1)chs.forEach(d=>{for(let i=0;i<d.length;i++)d[i]*=g});
    return {blob:wav(chs,sr),dur:len/sr};
  }
  async function apply(c,kind){
    const a=assets[c.aid];if(!a||!a.file)return false;
    busy=true;msg='بشتغل على الصوت...';renderPanel();
    try{
      const ac=new (window.AudioContext||window.webkitAudioContext)();const buf=await ac.decodeAudioData(await a.file.arrayBuffer());ac.close();
      const sr=buf.sampleRate,i0=Math.floor(c.in*sr),i1=Math.min(buf.length,Math.ceil(c.out*sr));if(i1-i0<sr*.1)throw new Error('short');
      const r=await render(buf,i0,i1,kind);
      const na=await loadAsset(new File([r.blob],'voice-'+kind+'.wav',{type:'audio/wav'}),'audio',r.dur);
      layout();S.audios.push({id:uid(),aid:na.id,start:c._s,in:0,out:Math.min(na.dur||r.dur,cdur(c)),vol:Math.max(20,c.vol||100),fi:0,fo:0,_vfx:c.id});
      c.mute=true;commit();refreshAll();dirty=true;msg='اتطبّق التأثير ✅ (صوت المقطع الأصلي اتكتم، والصوت الجديد على مسار الصوت. Undo يرجّع كله)';toast(msg,4500);return true;
    }catch(e){console.error('vfx',e);msg='معرفتش أطبّق التأثير (المقطع ممكن ملوش صوت)';toast(msg);return false}
    finally{busy=false;renderPanel()}
  }
  window.__voiceFx=apply;window.__voiceRender=render;
  const r0=renderPanel;
  renderPanel=function(){
    const r=r0.apply(this,arguments);
    try{
      const B=document.getElementById('panel');if(!B||S.tab!=='fx')return r;
      const c=S.sel&&S.sel.k==='clip'?selObj():null;const a=c&&assets[c.aid];if(!c||!a||a.type!=='video')return r;
      const d=document.createElement('div');d.id='vfBox';d.style.cssText='padding:4px 12px 14px';
      d.innerHTML='<div class="h4">🎙 تأثيرات صوت</div><p class="hint">بيطبّق التأثير على صوت المقطع المحدد (بيتعمل على جهازك). الصوت الأصلي بيتكتم والجديد بيتضاف على مسار الصوت.</p><div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">'+FX.map(([k,n])=>'<button class="btn" data-vf="'+k+'"'+(busy?' disabled':'')+'>'+n+'</button>').join('')+'</div>'+(msg?'<div class="hint" style="margin-top:6px">'+msg+'</div>':'');
      B.appendChild(d);d.querySelectorAll('[data-vf]').forEach(b=>b.onclick=()=>apply(c,b.dataset.vf));
    }catch(e){console.warn('R92',e)}
    return r};
})();
