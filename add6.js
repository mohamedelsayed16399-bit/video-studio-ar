/* ===== R89 (add6.js): flash / shake on every beat (drawn on top of the final frame, exports too) ===== */
(function(){
  const od=drawFrame;
  const rnd=(a,b)=>{const x=Math.sin(a*127.1+b*311.7)*43758.5453;return x-Math.floor(x)};
  drawFrame=function(ctx,w,h,t,opt){
    const F=S.subStyle&&S.subStyle.bfx;if(!F||!F.t||!F.t.length||!F.k||F.k==='none')return od.apply(this,arguments);
    let age=1e9,bi=-1;for(let i=0;i<F.t.length;i++){const d=t-F.t[i];if(d>=0&&d<age){age=d;bi=i}}
    const dur=F.k==='shake'?.22:.18;
    if(bi<0||age>dur)return od.apply(this,arguments);
    const k=1-age/dur,a=(F.s||60)/100;
    if(F.k==='shake'){const m=k*a*.022*w,dx=(rnd(bi,Math.floor(age*60))-.5)*2*m,dy=(rnd(bi+9,Math.floor(age*60))-.5)*2*m,sc=1+.05*a;ctx.save();ctx.translate(w/2+dx,h/2+dy);ctx.scale(sc,sc);ctx.translate(-w/2,-h/2);const r=od.apply(this,arguments);ctx.restore();return r}
    const r=od.apply(this,arguments);
    ctx.save();ctx.globalAlpha=Math.min(1,k*k*a*1.1);ctx.fillStyle=F.k==='flashb'?'#000':'#fff';ctx.fillRect(0,0,w,h);ctx.restore();return r};
  Object.keys(od).forEach(k=>{try{drawFrame[k]=od[k]}catch(e){}});
  window.__beatFx=function(u,k,s,every){
    const L=window.__beatLast&&window.__beatLast();if(!L||L.uid!==u.id||!L.beats.length)return -1;
    const T=L.beats.filter((x,i)=>i%every===0).map(x=>+(u.start+x-(u.in||0)).toFixed(3));
    if(k==='none'){delete S.subStyle.bfx}else S.subStyle.bfx={t:T,k,s};
    commit();refreshAll();dirty=true;seekTo(S.playhead);return T.length};
  const r0=renderPanel;
  renderPanel=function(){
    const r=r0.apply(this,arguments);
    try{
      const B=document.getElementById('panel');if(!B||S.tab!=='audio')return r;
      const bt=document.getElementById('btBox');if(!bt||!bt.querySelector('#btGo'))return r;
      const u=S.sel&&S.sel.k==='audio'?selObj():S.audios[0];if(!u)return r;
      const cur=S.subStyle.bfx;
      const d=document.createElement('div');d.style.cssText='margin-top:10px;border-top:1px solid #2b3350;padding-top:8px';
      d.innerHTML='<div class="h4" style="font-size:13px">⚡ فلاش / اهتزاز على الإيقاع</div><div style="display:flex;gap:6px;flex-wrap:wrap">'+[['flash','⚪ فلاش أبيض'],['flashb','⚫ فلاش أسود'],['shake','📳 اهتزاز'],['none','⛔ بدون']].map(([k,n])=>'<button class="btn'+((cur&&cur.k===k)||(!cur&&k==='none')?' primary':'')+'" data-bf="'+k+'" style="padding:4px 8px;font-size:12px">'+n+'</button>').join('')+'</div><label style="font-size:12px;display:block;margin-top:6px">القوة <input type="range" id="bfS" min="20" max="100" value="'+(cur&&cur.s||60)+'"></label>';
      bt.appendChild(d);
      d.querySelectorAll('[data-bf]').forEach(b=>b.onclick=()=>{const n=window.__beatFx(u,b.dataset.bf,+d.querySelector('#bfS').value,1);if(n<0)toast('حلّل الإيقاع الأول')});
    }catch(e){console.warn('R89',e)}
    return r};
})();
