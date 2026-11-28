/* ===== R94 (add11.js): pitch shift for an audio item (keeps the length: resample + WSOLA time-stretch) ===== */
(function(){
  let busy=false,msg='',semi=4;
  function wav(x,sr){const n=x.length,b=new ArrayBuffer(44+n*2),v=new DataView(b),W=(o,t)=>{for(let i=0;i<t.length;i++)v.setUint8(o+i,t.charCodeAt(i))};W(0,'RIFF');v.setUint32(4,36+n*2,true);W(8,'WAVEfmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,sr,true);v.setUint32(28,sr*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);W(36,'data');v.setUint32(40,n*2,true);for(let i=0;i<n;i++)v.setInt16(44+i*2,Math.max(-1,Math.min(1,x[i]))*32767,true);return new Blob([b],{type:'audio/wav'})}
  function resample(x,r){const n=Math.floor(x.length/r),o=new Float32Array(n);for(let i=0;i<n;i++){const p=i*r,k=Math.floor(p),f=p-k;o[i]=(x[k]||0)*(1-f)+(x[k+1]||0)*f}return o}
  function wsola(x,s,sr){
    const N=Math.round(sr*.046/2)*2,H=N/2,tol=Math.round(sr*.006),outLen=Math.floor(x.length*s),o=new Float32Array(outLen+N),wsum=new Float32Array(outLen+N);
    const win=new Float32Array(N);for(let i=0;i<N;i++)win[i]=.5-.5*Math.cos(2*Math.PI*(i+.5)/N);
    const hopA=H/s;let pos=0,prevEnd=-1;
    for(let k=0,op=0;op<outLen;k++,op+=H){
      let a=Math.round(k*hopA);
      if(k>0&&prevEnd>=0){let best=-1e18,bi=a;const lo=Math.max(0,a-tol),hi=Math.min(x.length-N-1,a+tol);
        for(let c=lo;c<=hi;c+=2){let s2=0;for(let i=0;i<H;i+=4)s2+=x[c+i]*x[prevEnd+i];if(s2>best){best=s2;bi=c}}a=bi}
      if(a+N>=x.length)break;
      for(let i=0;i<N;i++){o[op+i]+=x[a+i]*win[i];wsum[op+i]+=win[i]}
      prevEnd=a+H;
    }
    const out=new Float32Array(outLen);for(let i=0;i<outLen;i++)out[i]=wsum[i]>1e-3?o[i]/wsum[i]:0;return out;
  }
  async function shiftAudio(file,i0s,i1s,st){
    const ac=new (window.AudioContext||window.webkitAudioContext)();const buf=await ac.decodeAudioData(await file.arrayBuffer());ac.close();
    const sr=buf.sampleRate,i0=Math.floor(i0s*sr),i1=Math.min(buf.length,Math.ceil(i1s*sr)),len=i1-i0;if(len<sr*.2)throw new Error('short');
    const m=new Float32Array(len);for(let ch=0;ch<buf.numberOfChannels;ch++){const d=buf.getChannelData(ch);for(let i=0;i<len;i++)m[i]+=d[i0+i]/buf.numberOfChannels}
    const r=Math.pow(2,st/12),y=wsola(resample(m,r),r,sr);
    return {blob:wav(y,sr),dur:y.length/sr};
  }
  window.__pitchShift=shiftAudio;
  async function apply(u,st){
    const a=assets[u.aid];if(!a||!a.file)return false;
    busy=true;msg='بشتغل على الصوت...';renderPanel();
    try{
      const r=await shiftAudio(a.file,u.in||0,u.out,st);
      const na=await loadAsset(new File([r.blob],'pitch'+(st>0?'+':'')+st+'.wav',{type:'audio/wav'}),'audio',r.dur);
      u.aid=na.id;u.in=0;u.out=Math.min(na.dur||r.dur,r.dur);commit();refreshAll();dirty=true;
      msg='اتغيّرت درجة الصوت '+(st>0?'+':'')+st+' نغمة ✅ (Undo يرجّعه)';toast(msg);return true;
    }catch(e){console.error('pitch',e);msg='معرفتش أغيّر الصوت ده';toast(msg);return false}
    finally{busy=false;renderPanel()}
  }
  window.__pitchApply=apply;
  const r0=renderPanel;
  renderPanel=function(){
    const r=r0.apply(this,arguments);
    try{
      const B=document.getElementById('panel');if(!B||S.tab!=='audio')return r;
      const u=S.sel&&S.sel.k==='audio'?selObj():null;
      const d=document.createElement('div');d.id='ptBox';d.style.cssText='padding:4px 12px 14px';
      d.innerHTML='<div class="h4">🎚 تغيير درجة الصوت (Pitch)</div><p class="hint">'+(u?'بيغيّر نغمة مقطع الصوت المحدد من غير ما يغيّر مدّته. (+ صوت أرفع/كرتوني، − صوت أتخن). بيعمل ملف جديد جوه المشروع.':'اختار مقطع صوت من الخط الزمني الأول.')+'</p>'+
        '<div class="fld"><label>النغمات <b>'+(semi>0?'+':'')+semi+'</b></label><input type="range" id="ptS" min="-12" max="12" value="'+semi+'"></div><div style="display:flex;gap:6px"><button class="btn" id="ptGo" style="flex:1"'+(!u||busy?' disabled':'')+'>'+(busy?'بشتغل...':'طبّق')+'</button><button class="btn" id="ptC" style="flex:1"'+(!u||busy?' disabled':'')+'>🐿 سنجاب (+7)</button><button class="btn" id="ptD" style="flex:1"'+(!u||busy?' disabled':'')+'>👹 تقيل (−6)</button></div>'+(msg?'<div class="hint" style="margin-top:6px">'+msg+'</div>':'');
      B.appendChild(d);
      const s=d.querySelector('#ptS');s.oninput=()=>{semi=+s.value;s.previousElementSibling.querySelector('b').textContent=(semi>0?'+':'')+semi};
      d.querySelector('#ptGo').onclick=()=>u&&apply(u,semi);d.querySelector('#ptC').onclick=()=>u&&apply(u,7);d.querySelector('#ptD').onclick=()=>u&&apply(u,-6);
    }catch(e){console.warn('R94',e)}
    return r};
})();
