/* ===== R91b (add8.js): automatic scene-change detection + split (Effects tab, selected clip) ===== */
(function(){
  let busy=false,msg='';
  const seek=(el,tt)=>new Promise(res=>{let done=false;const f=()=>{if(done)return;done=true;el.removeEventListener('seeked',f);res()};el.addEventListener('seeked',f);setTimeout(f,2500);if(Math.abs(el.currentTime-tt)<.001)f();else el.currentTime=tt});
  async function scan(c,a){
    const el=a.el;try{el.pause()}catch(e){}if(P.playing)pause();
    const dur=c.out-c.in,step=Math.max(.1,dur/150),W=48,H=27,cv=document.createElement('canvas');cv.width=W;cv.height=H;const x=cv.getContext('2d',{willReadFrequently:true});
    const t0=el.currentTime;let prev=null;const d=[];
    for(let tt=0;tt<=dur+1e-6;tt+=step){
      await seek(el,Math.min(c.out-.001,c.in+tt));x.drawImage(el,0,0,W,H);const px=x.getImageData(0,0,W,H).data;
      const g=new Float32Array(W*H);for(let i=0;i<W*H;i++)g[i]=.3*px[i*4]+.59*px[i*4+1]+.11*px[i*4+2];
      if(prev){let s=0;for(let i=0;i<g.length;i++)s+=Math.abs(g[i]-prev[i]);d.push({t:tt,v:s/g.length})}
      prev=g;
    }
    try{el.currentTime=t0}catch(e){}
    if(!d.length)return [];
    const vs=d.map(o=>o.v),m=vs.reduce((p,q)=>p+q,0)/vs.length,sd=Math.sqrt(vs.reduce((p,q)=>p+(q-m)**2,0)/vs.length),th=Math.max(22,m+3*sd);
    const cuts=[];d.forEach((o,i)=>{if(o.v>th&&(i===0||o.v>=d[i-1].v)&&(i===d.length-1||o.v>=d[i+1].v)&&(!cuts.length||o.t-cuts[cuts.length-1]>.8))cuts.push(o.t-step*.1)});
    return cuts;
  }
  function splitTL(t){const i=clipAt(t);if(i<0)return false;const c=S.clips[i],lt=t-c._s;if(lt<.2||cdur(c)-lt<.2)return false;const s=srcTime(c,t),n={...c,id:uid(),in:s,fade:0};if(c.ramp)c.ramp=n.ramp=undefined;c.out=s;c.fade=0;S.clips.splice(i+1,0,n);layout();return true}
  window.__sceneScan=scan;
  window.__sceneCut=async function(c){
    const a=assets[c.aid];if(!a||a.type!=='video'||!a.el)return -1;
    busy=true;msg='بحلل المقطع...';renderPanel();
    try{
      const rel=await scan(c,a);layout();
      const T=rel.map(r=>c._s+r/(c.speed||1)).sort((p,q)=>q-p);
      const oc=commit;commit=function(){};let n=0;try{T.forEach(t=>{if(splitTL(t))n++})}finally{commit=oc}
      if(n){commit();refreshAll();seekTo(S.playhead)}
      msg=n?'اتقسم المقطع على '+n+' تغيير مشهد ✅ (Undo يرجّعه)':'مفيش تغيير مشهد واضح في المقطع ده';toast(msg);return n;
    }catch(e){console.error(e);msg='معرفتش أحلل المقطع';return -1}
    finally{busy=false;renderPanel()}
  };
  const r0=renderPanel;
  renderPanel=function(){
    const r=r0.apply(this,arguments);
    try{
      const B=document.getElementById('panel');if(!B||S.tab!=='fx')return r;
      const c=S.sel&&S.sel.k==='clip'?selObj():null;const a=c&&assets[c.aid];if(!c||!a||a.type!=='video')return r;
      const d=document.createElement('div');d.id='scBox2';d.style.cssText='padding:4px 12px 14px';
      d.innerHTML='<div class="h4">🎞 قص تلقائي عند تغيّر المشهد</div><p class="hint">بيدوّر على اللحظات اللي الصورة بتتغير فيها فجأة (قطع المونتاج) ويقسّم المقطع عندها. مفيد للفيديوهات الطويلة اللي فيها أكتر من لقطة.</p><button class="btn" id="scGo2" style="width:100%"'+(busy?' disabled':'')+'>'+(busy?'بحلل...':'🔍 دوّر وقسّم')+'</button>'+(msg?'<div class="hint" style="margin-top:6px">'+msg+'</div>':'');
      B.appendChild(d);d.querySelector('#scGo2').onclick=()=>window.__sceneCut(c);
    }catch(e){console.warn('R91b',e)}
    return r};
})();
