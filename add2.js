/* ===== R85 (add2.js): main video inside a collage cell ===== */
(function(){
  const MAIN=[['جنب بعض (يسار)',[0,0,.5,1]],['فوق وتحت (فوق)',[0,0,1,.5]],['٢×٢ (أعلى يسار)',[0,0,.5,.5]],['٣ أعمدة (أول عمود)',[0,0,1/3,1]],['كبير + صغيرين (الكبير)',[0,0,.66,1]]];
  const o0=drawClipLayer;
  drawClipLayer=function(ctx,c,a,w,h,t){
    if(!c.cell)return o0.apply(this,arguments);
    const cx=c.cell[0]*w,cy=c.cell[1]*h,cw=c.cell[2]*w,ch=c.cell[3]*h,k=Math.max(cw/w,ch/h);
    ctx.save();ctx.beginPath();ctx.rect(cx,cy,cw,ch);ctx.clip();ctx.translate(cx+(cw-w*k)/2,cy+(ch-h*k)/2);ctx.scale(k,k);
    try{o0.call(this,ctx,c,a,w,h,t)}finally{ctx.restore()}
    if(window.__clGap){ctx.save();ctx.strokeStyle='#fff';ctx.lineWidth=Math.max(2,w/400);ctx.strokeRect(cx,cy,cw,ch);ctx.restore()}
  };
  Object.keys(o0).forEach(k=>{try{drawClipLayer[k]=o0[k]}catch(e){}});
  Object.defineProperty(drawClipLayer,'raw',{get(){return o0.raw},set(v){o0.raw=v}});
  window.__mainCell=function(i){const sel=S.sel&&S.sel.k==='clip'?selObj():null;const L=sel?[sel]:S.clips;const oc=commit;commit=function(){};try{L.forEach(c=>{c.cell=i<0?undefined:MAIN[i][1].slice();if(i<0)delete c.cell})}finally{commit=oc}commit();refreshAll();seekTo(S.playhead);return L.length};
  const r0=renderPanel;
  renderPanel=function(){
    const r=r0.apply(this,arguments);
    try{
      const B=document.getElementById('panel');if(!B||S.tab!=='ov')return r;
      const d=document.createElement('div');d.id='mcBox';d.style.cssText='padding:4px 12px 14px';
      d.innerHTML='<div class="h4">🎬 حط الفيديو الأساسي في خلية</div><p class="hint">كمّل الكولاج: الفيديو الأساسي ياخد الخلية الفاضية (للمقطع المحدد، أو كل المقاطع لو مفيش محدد).</p><div style="display:flex;flex-wrap:wrap;gap:6px">'+MAIN.map((m,i)=>'<button class="btn" data-mc="'+i+'" style="padding:4px 8px;font-size:12px">'+m[0]+'</button>').join('')+'<button class="btn" data-mc="-1" style="padding:4px 8px;font-size:12px">ملء الشاشة</button></div>';
      B.appendChild(d);d.querySelectorAll('[data-mc]').forEach(b=>b.onclick=()=>window.__mainCell(+b.dataset.mc));
    }catch(e){console.warn('R85',e)}
    return r};
})();
