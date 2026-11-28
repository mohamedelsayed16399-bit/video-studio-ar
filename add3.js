/* ===== R86 (add3.js): beat detection + cut-to-the-beat ===== */
(function(){
  let busy=false,last=null;
  async function detect(u){
    const a=assets[u.aid];if(!a||!a.file)throw new Error('nofile');
    const ac=new (window.AudioContext||window.webkitAudioContext)();const buf=await ac.decodeAudioData(await a.file.arrayBuffer());ac.close();
    const sr=buf.sampleRate,d=buf.getChannelData(0),H=512,n=Math.floor(d.length/H),e=new Float32Array(n);
    for(let i=0;i<n;i++){let s=0;for(let j=0;j<H;j++){const v=d[i*H+j];s+=v*v}e[i]=Math.sqrt(s/H)}
    const fl=new Float32Array(n);for(let i=0;i<n;i++){let m=0,c=0;for(let k=Math.max(0,i-10);k<i;k++){m+=e[k];c++}m/=Math.max(1,c);fl[i]=Math.max(0,e[i]-m*1.15)}
    let mean=0,sd=0;for(let i=0;i<n;i++)mean+=fl[i];mean/=n;for(let i=0;i<n;i++)sd+=(fl[i]-mean)**2;sd=Math.sqrt(sd/n);
    const th=mean+sd*1.2,gap=Math.ceil(.22*sr/H),out=[];let lastI=-1e9;
    for(let i=0;i<n-1;i++){if(fl[i]>th&&fl[i]>=(i?fl[i-1]:0)&&fl[i]>=fl[i+1]&&i-lastI>=gap){out.push(i*H/sr);lastI=i}}
    return out;
  }
  function bpm(b){if(b.length<4)return 0;const iv=[];for(let i=1;i<b.length;i++)iv.push(b[i]-b[i-1]);iv.sort((x,y)=>x-y);const m=iv[iv.length>>1];let v=60/m;while(v<75)v*=2;while(v>180)v/=2;return Math.round(v)}
  function splitTL(t){const i=clipAt(t);if(i<0)return false;const c=S.clips[i],lt=t-c._s;if(lt<.2||cdur(c)-lt<.2)return false;const s=srcTime(c,t),n={...c,id:uid(),in:s,fade:0};if(c.ramp)c.ramp=n.ramp=undefined;c.out=s;c.fade=0;S.clips.splice(i+1,0,n);layout();return true}
  async function run(u){
    busy=true;renderPanel();
    try{const b=await detect(u);last={uid:u.id,beats:b,bpm:bpm(b)};toast(b.length?'لقيت '+b.length+' نبضة (~'+last.bpm+' BPM)':'مش لاقي إيقاع واضح في الصوت ده')}catch(e){console.error(e);toast('معرفتش أحلل الصوت ده');last=null}
    finally{busy=false;renderPanel()}
  }
  window.__beatDetect=detect;
  window.__beatCut=function(u,every,punch){
    const b=last&&last.uid===u.id?last.beats:null;if(!b)return -1;
    const T=b.filter((x,i)=>i%every===0).map(x=>u.start+x-(u.in||0)).filter(t=>t>.3&&t<total-.3).sort((p,q)=>q-p);
    const oc=commit;commit=function(){};let cuts=0;
    try{T.forEach(t=>{if(splitTL(t))cuts++});
      if(punch){layout();S.clips.forEach((c,i)=>{if(i%2===1){c.zoom=Math.max(c.zoom||100,112);c.kf=c.kf}})}}
    finally{commit=oc}
    layout();commit();refreshAll();seekTo(S.playhead);return cuts};
  const r0=renderPanel;
  renderPanel=function(){
    const r=r0.apply(this,arguments);
    try{
      const B=document.getElementById('panel');if(!B||S.tab!=='audio')return r;
      const u=S.sel&&S.sel.k==='audio'?selObj():(S.audios.find(x=>!(x.id&&String(x.id).length&&false))||null);
      const d=document.createElement('div');d.id='btBox';d.style.cssText='padding:4px 12px 14px';
      const has=last&&u&&last.uid===u.id;
      d.innerHTML='<div class="h4">🥁 قص على الإيقاع (Beat Sync)</div><p class="hint">'+(u?'بيحلل الصوت: '+(assets[u.aid]?assets[u.aid].name:'')+' (اختار مقطع صوت تاني من الخط الزمني لو عايز).':'ضيف مقطع صوت/موسيقى الأول.')+'</p><button class="btn" id="btDet"'+(!u||busy?' disabled':'')+' style="width:100%">'+(busy?'بحلل...':'🔍 حلّل الإيقاع')+'</button>'+
        (has&&last.beats.length?'<div style="margin-top:8px;font-size:13px">لقيت <b>'+last.beats.length+'</b> نبضة، تقريباً <b>'+last.bpm+'</b> BPM</div><div style="display:flex;gap:6px;align-items:center;margin-top:6px;flex-wrap:wrap"><label style="font-size:12px">قص كل <select id="btN"><option value="1">نبضة</option><option value="2">نبضتين</option><option value="4" selected>٤ نبضات</option></select></label><label style="font-size:12px"><input type="checkbox" id="btP" checked> تكبير خفيف كل مقطع تاني</label></div><button class="btn" id="btGo" style="width:100%;margin-top:6px;background:#7c5cff">✂ قص الفيديو على الإيقاع</button>':'');
      B.appendChild(d);
      const bd=d.querySelector('#btDet');if(bd)bd.onclick=()=>run(u);
      const g=d.querySelector('#btGo');if(g)g.onclick=()=>{const n=window.__beatCut(u,+d.querySelector('#btN').value,d.querySelector('#btP').checked);toast(n>0?'اتقطع '+n+' قطعة على الإيقاع ✅ (Undo يرجّعه)':'مفيش حاجة اتقطعت (الفيديو أقصر من الصوت؟)')};
    }catch(e){console.warn('R86',e)}
    return r};
})();
