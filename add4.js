/* ===== R87 (add4.js): text BEHIND the person (uses the free on-device selfie segmenter from R80) ===== */
(function(){
  const T=document.createElement('canvas');
  const od=drawClipLayer;
  drawClipLayer=function(ctx,c,a,w,h,t){
    if(c.bgm!=='tbs'||!a||a.type==='audio'){return od.apply(this,arguments)}
    const SEG=window.__SEG;if(window.__segInit&&SEG&&SEG.st===0)window.__segInit();
    if(!SEG||SEG.st!==2){return od.call(this,ctx,Object.assign({},c,{bgm:'none'}),a,w,h,t)}
    // 1) full frame
    od.call(this,ctx,Object.assign({},c,{bgm:'none'}),a,w,h,t);
    // 2) the big text between background and person
    const txt=(c.tbt||'').trim();
    if(txt){ctx.save();const sz=c.tbz==null?22:c.tbz;
      try{drawCaption(ctx,w,h,txt,w/2,(c.tby==null?45:c.tby)/100*h,sz,c.tbc||'#ffffff',null,{weight:900,clamp:true,stc:'#000000',stw:0})}catch(e){}
      ctx.restore()}
    // 3) person cut-out on top (bgm 'tbs' makes R80 draw only the person over a transparent background)
    if(T.width!==w||T.height!==h){T.width=w;T.height=h}
    const x=T.getContext('2d');x.setTransform(1,0,0,1,0,0);x.globalAlpha=1;x.globalCompositeOperation='source-over';x.clearRect(0,0,w,h);
    od.call(this,x,c,a,w,h,t);
    ctx.drawImage(T,0,0);
  };
  Object.keys(od).forEach(k=>{try{drawClipLayer[k]=od[k]}catch(e){}});
  Object.defineProperty(drawClipLayer,'raw',{get(){return od.raw},set(v){od.raw=v}});
  const r0=renderPanel;
  renderPanel=function(){
    const r=r0.apply(this,arguments);
    try{
      const B=document.getElementById('panel');if(!B||S.tab!=='fx')return r;
      const c=S.sel&&S.sel.k==='clip'?selObj():null;const a=c&&assets[c.aid];if(!c||!a||a.type==='audio')return r;
      const on=c.bgm==='tbs';
      const d=document.createElement('div');d.id='tbBox';d.style.cssText='padding:4px 12px 14px';
      d.innerHTML='<div class="h4">🔠 نص ورا الشخص (مؤثر تيك توك)</div><p class="hint">بيكتب نص كبير ويحطه ورا الشخص (الشخص قدام النص). بيستخدم نفس نموذج فصل الخلفية المجاني. الأفضل مع شخص واضح.</p>'+
        '<button class="btn'+(on?' primary':'')+'" id="tbOn" style="width:100%">'+(on?'✓ شغّال (اضغط للإلغاء)':'شغّل النص ورا الشخص')+'</button>'+
        (on?'<div class="fld"><label>النص</label><input type="text" id="tbT" value="'+String(c.tbt||'').replace(/"/g,'&quot;')+'" placeholder="اكتب النص هنا" style="width:100%"></div><div class="fld"><label>الحجم <b>'+(c.tbz==null?22:c.tbz)+'</b></label><input type="range" id="tbZ" min="6" max="60" value="'+(c.tbz==null?22:c.tbz)+'"></div><div class="fld"><label>الموضع (من الأعلى) <b>'+(c.tby==null?45:c.tby)+'</b></label><input type="range" id="tbY" min="10" max="90" value="'+(c.tby==null?45:c.tby)+'"></div><div class="fld"><label>اللون</label><input type="color" id="tbC" value="'+(c.tbc||'#ffffff')+'"></div>':'');
      B.appendChild(d);
      d.querySelector('#tbOn').onclick=()=>{if(on){delete c.bgm}else{c.bgm='tbs';if(!c.tbt)c.tbt='اكتب هنا';if(window.__segInit)window.__segInit()}commit();refreshAll();dirty=true;seekTo(S.playhead)};
      const bind=(id,k,num)=>{const e=d.querySelector(id);if(!e)return;e.oninput=()=>{c[k]=num?+e.value:e.value;const b=e.previousElementSibling&&e.previousElementSibling.querySelector('b');if(b)b.textContent=e.value;if(window.__SEG)window.__SEG.key='';dirty=true;seekTo(S.playhead)};e.onchange=()=>commit()};
      bind('#tbT','tbt',false);bind('#tbZ','tbz',true);bind('#tbY','tby',true);bind('#tbC','tbc',false);
    }catch(e){console.warn('R87',e)}
    return r};
})();
