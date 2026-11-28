/* ===== R90 (add7.js): RGB-split glitch on every beat (adds a 4th beat effect next to flash/shake) ===== */
(function(){
  const od=drawFrame,T=document.createElement('canvas');
  drawFrame=function(ctx,w,h,t,opt){
    const F=S.subStyle&&S.subStyle.bfx;if(!F||F.k!=='glitch'||!F.t||!F.t.length)return od.apply(this,arguments);
    let age=1e9;for(const b of F.t){const d=t-b;if(d>=0&&d<age)age=d}
    const dur=.22;if(age>dur)return od.apply(this,arguments);
    S.subStyle.bfx=null;let r;try{r=od.apply(this,arguments)}finally{S.subStyle.bfx=F}
    const k=1-age/dur,a=(F.s||60)/100,sh=Math.max(2,Math.round(w*.03*k*a));
    if(T.width!==w||T.height!==h){T.width=w;T.height=h}
    const x=T.getContext('2d',{willReadFrequently:true});x.setTransform(1,0,0,1,0,0);x.globalCompositeOperation='source-over';x.clearRect(0,0,w,h);x.drawImage(ctx.canvas===undefined?T:ctx.canvas,0,0,w,h);
    try{
      const src=x.getImageData(0,0,w,h),dst=ctx.getImageData(0,0,w,h),s=src.data,d=dst.data;
      for(let y=0;y<h;y++){const jit=(Math.sin(y*.37+age*90)>.86)?Math.round(sh*1.5):0,row=y*w*4;
        for(let X=0;X<w;X++){const i=row+X*4,xr=Math.min(w-1,X+sh+jit),xb=Math.max(0,X-sh-jit);d[i]=s[row+xr*4];d[i+2]=s[row+xb*4+2]}}
      ctx.putImageData(dst,0,0);
    }catch(e){}
    return r};
  Object.keys(od).forEach(k=>{try{drawFrame[k]=od[k]}catch(e){}});
  const r0=renderPanel;
  renderPanel=function(){
    const r=r0.apply(this,arguments);
    try{
      const row=document.querySelector('[data-bf="none"]');if(!row||document.querySelector('[data-bf="glitch"]'))return r;
      const bt=document.getElementById('btBox');const u=S.sel&&S.sel.k==='audio'?selObj():S.audios[0];if(!bt||!u)return r;
      const b=document.createElement('button');b.className='btn'+(S.subStyle.bfx&&S.subStyle.bfx.k==='glitch'?' primary':'');b.dataset.bf='glitch';b.style.cssText='padding:4px 8px;font-size:12px';b.textContent='📺 جليتش RGB';
      b.onclick=()=>{const n=window.__beatFx(u,'glitch',+(bt.querySelector('#bfS')||{value:60}).value,1);if(n<0)toast('حلّل الإيقاع الأول')};
      row.parentNode.insertBefore(b,row);
    }catch(e){console.warn('R90',e)}
    return r};
})();
