/* ===== R88 (add5.js): zoom pulse on every beat (keyframes), uses the beats found by R86 ===== */
(function(){
  window.__beatPulse=function(u,amt,every){
    const L=window.__beatLast&&window.__beatLast();if(!L||L.uid!==u.id||!L.beats.length)return -1;
    const T=L.beats.filter((x,i)=>i%every===0).map(x=>u.start+x-(u.in||0));
    const oc=commit;commit=function(){};let n=0;
    try{layout();S.clips.forEach(c=>{
      const a=assets[c.aid];if(!a||a.type==='audio')return;const d=cdur(c),z0=c.zoom||100,kf=[];
      T.filter(t=>t>=c._s&&t<c._s+d-.05).forEach(t=>{const lt=t-c._s;kf.push({t:Math.max(0,lt-.06),px:c.px||0,py:c.py||0,zoom:z0,rot:0,op:100},{t:lt,px:c.px||0,py:c.py||0,zoom:z0+amt,rot:0,op:100},{t:Math.min(d,lt+.24),px:c.px||0,py:c.py||0,zoom:z0,rot:0,op:100});n++});
      if(kf.length){kf.sort((p,q)=>p.t-q.t);const o=[];kf.forEach(k=>{if(!o.length||k.t>o[o.length-1].t+1e-4)o.push(k)});c.kf=o;c.kfe='ease'}
    })}finally{commit=oc}
    commit();refreshAll();seekTo(S.playhead);return n};
  const r0=renderPanel;
  renderPanel=function(){
    const r=r0.apply(this,arguments);
    try{
      const B=document.getElementById('panel');if(!B||S.tab!=='audio')return r;
      const bt=document.getElementById('btBox');if(!bt||!bt.querySelector('#btGo'))return r;
      const u=S.sel&&S.sel.k==='audio'?selObj():S.audios[0];if(!u)return r;
      const d=document.createElement('div');d.style.cssText='margin-top:10px;border-top:1px solid #2b3350;padding-top:8px';
      d.innerHTML='<div class="h4" style="font-size:13px">💓 نبضة زووم على كل ضربة</div><div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap"><label style="font-size:12px">القوة <input type="range" id="bpA" min="3" max="25" value="10"></label><label style="font-size:12px">كل <select id="bpN"><option value="1">نبضة</option><option value="2">نبضتين</option></select></label></div><button class="btn" id="bpGo" style="width:100%;margin-top:6px">💓 ضيف نبضات الزووم</button>';
      bt.appendChild(d);
      d.querySelector('#bpGo').onclick=()=>{const n=window.__beatPulse(u,+d.querySelector('#bpA').value,+d.querySelector('#bpN').value);toast(n>0?'اتضافت '+n+' نبضة زووم ✅ (Undo يرجّعها)':'حلّل الإيقاع الأول')};
    }catch(e){console.warn('R88',e)}
    return r};
})();
