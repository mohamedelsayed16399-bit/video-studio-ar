/* ===== R93 (add10.js): video stabilization (global motion estimate + smoothed counter-shift keyframes) ===== */
(function(){
  let busy=false,msg='',strength=60;
  const seek=(el,tt)=>new Promise(res=>{let done=false;const f=()=>{if(done)return;done=true;el.removeEventListener('seeked',f);res()};el.addEventListener('seeked',f);setTimeout(f,2500);if(Math.abs(el.currentTime-tt)<.001)f();else el.currentTime=tt});
  const W=96,H=54,R=7;
  function gray(src,cv,x){x.drawImage(src,0,0,W,H);const p=x.getImageData(0,0,W,H).data,g=new Float32Array(W*H);for(let i=0;i<W*H;i++)g[i]=.3*p[i*4]+.59*p[i*4+1]+.11*p[i*4+2];return g}
  function shift(prev,cur){
    let best=1e18,bx=0,by=0;
    for(let sy=-R;sy<=R;sy++)for(let sx=-R;sx<=R;sx++){
      let s=0,n=0;for(let y=R;y<H-R;y+=1){const ro=y*W,po=(y-sy)*W;for(let x=R;x<W-R;x+=1){const d=cur[ro+x]-prev[po+x-sx];s+=d<0?-d:d;n++}}
      s/=n;if(s<best){best=s;bx=sx;by=sy}}
    return [bx,by];
  }
  async function estimate(drawAt,times){
    const cv=document.createElement('canvas');cv.width=W;cv.height=H;const x=cv.getContext('2d',{willReadFrequently:true});
    const path=[[0,0]];let prev=null;
    for(let i=0;i<times.length;i++){const src=await drawAt(times[i]);const g=gray(src,cv,x);if(prev){const [dx,dy]=shift(prev,g);const l=path[path.length-1];path.push([l[0]+dx/W,l[1]+dy/H])}prev=g}
    return path;
  }
  function smooth(path,win){const n=path.length,o=[];for(let i=0;i<n;i++){let sx=0,sy=0,c=0;for(let k=Math.max(0,i-win);k<=Math.min(n-1,i+win);k++){sx+=path[k][0];sy+=path[k][1];c++}o.push([sx/c,sy/c])}return o}
  async function run(c,a,st){
    const el=a.el;try{el.pause()}catch(e){}if(P.playing)pause();
    const dur=c.out-c.in,step=Math.max(.04,dur/400),times=[];for(let t=0;t<=dur+1e-6;t+=step)times.push(t);
    const t0=el.currentTime;
    const path=await estimate(async t=>{await seek(el,Math.min(c.out-.001,c.in+t));return el},times);
    try{el.currentTime=t0}catch(e){}
    const win=Math.max(2,Math.round((.3+st/100*1.4)/step)),sm=smooth(path,win);
    const kf=times.map((t,i)=>({t:t/(c.speed||1),px:(sm[i][0]-path[i][0])*100,py:(sm[i][1]-path[i][1])*100,zoom:(c.zoom||100)*(1+.05+st/100*.06),rot:0,op:100}));
    let mx=0,raw=0;path.forEach((p,i)=>{mx=Math.max(mx,Math.abs(sm[i][0]-p[0]),Math.abs(sm[i][1]-p[1]));raw=Math.max(raw,Math.abs(p[0]),Math.abs(p[1]))});
    return {kf,mx,raw,n:times.length};
  }
  window.__stabEst=estimate;
  window.__stabilize=async function(c,st){
    const a=assets[c.aid];if(!a||a.type!=='video'||!a.el)return -1;
    busy=true;msg='بحلل حركة الكاميرا...';renderPanel();
    try{
      const r=await run(c,a,st==null?strength:st);
      if(r.mx<.002){msg='الفيديو ثابت أصلاً تقريباً، مفيش تثبيت اتطبّق';toast(msg);return 0}
      c.kf=r.kf;c.kfe='lin';commit();refreshAll();dirty=true;seekTo(Math.max(S.playhead,c._s));
      msg='اتثبّت الفيديو ✅ (زووم خفيف عشان الحواف). Undo يرجّعه';toast(msg);return r.n;
    }catch(e){console.error('stab',e);msg='معرفتش أثبّت المقطع';return -1}
    finally{busy=false;renderPanel()}
  };
  const r0=renderPanel;
  renderPanel=function(){
    const r=r0.apply(this,arguments);
    try{
      const B=document.getElementById('panel');if(!B||S.tab!=='fx')return r;
      const c=S.sel&&S.sel.k==='clip'?selObj():null;const a=c&&assets[c.aid];if(!c||!a||a.type!=='video')return r;
      const d=document.createElement('div');d.id='stBox';d.style.cssText='padding:4px 12px 14px';
      d.innerHTML='<div class="h4">📐 تثبيت الفيديو (ضد الهزّة)</div><p class="hint">بيحلل حركة الكاميرا ويعوّضها بحركة عكسية ناعمة مع زووم خفيف. بيشتغل على الهزّة الخفيفة لمتوسطة (مش لقطات الجري العنيفة). بيستبدل أي كيفريمات على المقطع.</p><div class="fld"><label>القوة <b>'+strength+'</b></label><input type="range" id="stS" min="10" max="100" value="'+strength+'"></div><button class="btn" id="stGo" style="width:100%"'+(busy?' disabled':'')+'>'+(busy?'بحلل...':'📐 ثبّت المقطع')+'</button>'+(msg?'<div class="hint" style="margin-top:6px">'+msg+'</div>':'');
      B.appendChild(d);
      const s=d.querySelector('#stS');s.oninput=()=>{strength=+s.value;s.previousElementSibling.querySelector('b').textContent=strength};
      d.querySelector('#stGo').onclick=()=>window.__stabilize(c,strength);
    }catch(e){console.warn('R93',e)}
    return r};
})();
