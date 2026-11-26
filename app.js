'use strict';
/* استوديو الفيديو - مونتاج في المتصفح. كل المعالجة على جهاز المستخدم. */
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const uid=()=>Math.random().toString(36).slice(2,9);
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const IS_MOBILE=/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)||innerWidth<820;
const ASPECTS={'16:9':[16,9],'9:16':[9,16],'1:1':[1,1],'4:5':[4,5],'4:3':[4,3]};
const FONT='Cairo,Tajawal,"Noto Sans Arabic",Arial,sans-serif';
const PRESETS={none:{n:'بدون'},bw:{n:'أبيض وأسود',g:100},sepia:{n:'سيبيا',sp:85},vivid:{n:'حيوي',s:150,c:115},cool:{n:'بارد',h:-20,s:115,b:102},warm:{n:'دافئ',h:14,s:115,sp:15},vintage:{n:'قديم',sp:45,c:90,b:105,s:80},fade:{n:'باهت',c:80,b:115,s:75},drama:{n:'درامي',c:145,s:110,b:88},noir:{n:'نوار',g:100,c:150,b:90},neon:{n:'نيون',h:-40,s:190,c:120},invert:{n:'معكوس',inv:100}};
const S={aspect:'16:9',clips:[],texts:[],subs:[],audios:[],subStyle:{size:5.4,color:'#ffffff',bg:true,pos:88,burn:true},playhead:0,sel:null,tab:'media',pps:50};
const assets={};
let total=0, dirty=true, quality=IS_MOBILE?540:720;
const cv=$('#cv'), cx=cv.getContext('2d');

/* ---------- helpers ---------- */
function fmt(t){t=Math.max(0,t||0);const m=Math.floor(t/60),s=t-m*60;return String(m).padStart(2,'0')+':'+s.toFixed(1).padStart(4,'0')}
function fmtS(t){const m=Math.floor(t/60),s=Math.floor(t%60);return m+':'+String(s).padStart(2,'0')}
function toast(m,ms=3200){const e=$('#toast');e.textContent=m;e.style.display='block';clearTimeout(toast.t);toast.t=setTimeout(()=>e.style.display='none',ms)}
function dims(short=quality){const [a,b]=ASPECTS[S.aspect];if(a>=b)return[Math.round(short*a/b/2)*2,short];return[short,Math.round(short*b/a/2)*2]}
function fitCanvas(){const wr=$('#cwrap'),W=wr.clientWidth-16,H=wr.clientHeight-16,[a,b]=ASPECTS[S.aspect];if(W<=0||H<=0)return;let w=W,h=W*b/a;if(h>H){h=H;w=H*a/b}cv.style.width=w+'px';cv.style.height=h+'px';cv.style.left=((wr.clientWidth-w)/2)+'px';cv.style.top=((wr.clientHeight-h)/2)+'px'}
function setCanvasSize(short){const[w,h]=dims(short);if(cv.width!==w||cv.height!==h){cv.width=w;cv.height=h}fitCanvas();dirty=true}
const cdur=c=>(c.out-c.in)/c.speed;
function layout(){let t=0;S.clips.forEach(c=>{c._s=t;t+=cdur(c)});total=t;return t}
function clipAt(t){for(let i=0;i<S.clips.length;i++){const c=S.clips[i];if(t<c._s+cdur(c)-1e-6)return i}return S.clips.length?S.clips.length-1:-1}
const findObj=(k,id)=>(k==='clip'?S.clips:k==='text'?S.texts:k==='sub'?S.subs:S.audios).find(o=>o.id===id);

/* ---------- history ---------- */
const H={a:[],i:-1};
const snap=()=>JSON.stringify({aspect:S.aspect,clips:S.clips,texts:S.texts,subs:S.subs,audios:S.audios,subStyle:S.subStyle});
function commit(){const s=snap();if(H.a[H.i]===s)return;H.a=H.a.slice(0,H.i+1);H.a.push(s);if(H.a.length>100)H.a.shift();H.i=H.a.length-1;updUndo()}
function restore(s){const o=JSON.parse(s);Object.assign(S,o);S.sel=null;layout();S.playhead=clamp(S.playhead,0,total);setCanvasSize(quality);refreshAll();seekTo(S.playhead)}
function undo(){if(H.i>0){H.i--;restore(H.a[H.i]);updUndo()}}
function redo(){if(H.i<H.a.length-1){H.i++;restore(H.a[H.i]);updUndo()}}
function updUndo(){$('#undo').disabled=H.i<=0;$('#redo').disabled=H.i>=H.a.length-1;$('#undo').style.opacity=H.i<=0?.4:1;$('#redo').style.opacity=H.i>=H.a.length-1?.4:1}

/* ---------- audio graph (preview + export) ---------- */
let AC=null,monitor=null,aDest=null;
function getAC(){if(!AC){AC=new (window.AudioContext||window.webkitAudioContext)();monitor=AC.createGain();monitor.connect(AC.destination);aDest=AC.createMediaStreamDestination()}return AC}
function route(el){try{const ac=getAC();const s=ac.createMediaElementSource(el);s.connect(monitor);s.connect(aDest)}catch(e){console.warn('route',e)}}

/* ---------- import ---------- */
function importFiles(files){
  const list=[...files];let n=0;
  list.forEach(f=>{
    const type=f.type.startsWith('video')?'video':f.type.startsWith('image')?'image':f.type.startsWith('audio')?'audio':null;
    if(!type){toast('نوع الملف مش مدعوم: '+f.name);return}
    n++;loadAsset(f,type).then(a=>{if(a){if(!S.clips.length&&type!=='audio'){addClip(a.id)}else renderPanel()}}).catch(e=>toast('الملف ده مش بيتفتح في المتصفح: '+f.name));
  });
  if(n)getAC();
}
function loadAsset(file,type,dur){
  return new Promise((res,rej)=>{
    const a={id:uid(),type,name:file.name||'ملف',file,url:URL.createObjectURL(file),dur:dur||0};
    if(type==='image'){
      const im=new Image();im.onload=()=>{a.img=im;a.w=im.naturalWidth;a.h=im.naturalHeight;a.thumb=a.url;assets[a.id]=a;res(a)};im.onerror=()=>rej();im.src=a.url;
    }else{
      const el=document.createElement(type==='video'?'video':'audio');el.preload='auto';el.playsInline=true;el.src=a.url;a.el=el;
      let done=false;const fail=setTimeout(()=>{if(!done)rej()},15000);
      el.onerror=()=>{clearTimeout(fail);rej()};
      el.onloadedmetadata=()=>{
        done=true;clearTimeout(fail);if(!a.dur)a.dur=isFinite(el.duration)?el.duration:0;a.w=el.videoWidth;a.h=el.videoHeight;assets[a.id]=a;route(el);
        if(type==='video'){
          let fin=false;
          const go=()=>{if(fin)return;fin=true;el.onseeked=null;try{const c=document.createElement('canvas');c.width=160;c.height=90;const x=c.getContext('2d');x.drawImage(el,0,0,160,90);a.thumb=c.toDataURL('image/jpeg',.6)}catch(e){}el.currentTime=0;res(a)};
          el.onseeked=go;el.currentTime=Math.min(1,a.dur/3);setTimeout(go,2500);
        }else{makeWave(a);res(a)}
      };
    }
  });
}
async function makeWave(a){
  try{if(a.file.size>40e6)return;const ac=new (window.OfflineAudioContext||window.webkitOfflineAudioContext)(1,1,44100);const buf=await ac.decodeAudioData(await a.file.arrayBuffer());
    const d=buf.getChannelData(0),N=400,step=Math.floor(d.length/N)||1;const c=document.createElement('canvas');c.width=N;c.height=40;const x=c.getContext('2d');x.fillStyle='rgba(255,255,255,.75)';
    for(let i=0;i<N;i++){let m=0;for(let j=0;j<step;j+=Math.max(1,step>>5))m=Math.max(m,Math.abs(d[i*step+j]||0));const h=Math.max(1,m*38);x.fillRect(i,20-h/2,1,h)}
    a.wave=c.toDataURL();renderTL()}catch(e){}
}
function defClip(aid){const a=assets[aid];return{id:uid(),aid,in:0,out:a.type==='image'?4:a.dur,speed:1,vol:100,mute:false,preset:'none',b:100,c:100,s:100,h:0,bl:0,vig:false,fit:'contain',bgblur:true,zoom:100,px:0,py:0,kb:0,fade:0}}
function addClip(aid,at){
  const c=defClip(aid);if(at==null)S.clips.push(c);else S.clips.splice(at,0,c);layout();S.sel={k:'clip',id:c.id};S.tab='fx';commit();refreshAll();dirty=true;seekTo(c._s);
  return c;
}

/* ---------- drawing ---------- */
function filterStr(c,w){
  const p=PRESETS[c.preset]||{};const k=w/1280;
  const b=(p.b||100)*c.b/100,ct=(p.c||100)*c.c/100,s=(p.s||100)*c.s/100,h=(p.h||0)+c.h,bl=c.bl*k;
  let f=`brightness(${b}%) contrast(${ct}%) saturate(${s}%)`;
  if(h)f+=` hue-rotate(${h}deg)`;if(bl>0.05)f+=` blur(${bl.toFixed(1)}px)`;if(p.g)f+=` grayscale(${p.g}%)`;if(p.sp)f+=` sepia(${p.sp}%)`;if(p.inv)f+=` invert(${p.inv}%)`;
  return f==='brightness(100%) contrast(100%) saturate(100%)'?'none':f;
}
function wrapText(ctx,text,maxW){
  const out=[];String(text).split('\n').forEach(par=>{const words=par.split(' ');let line='';words.forEach(w=>{const t=line?line+' '+w:w;if(ctx.measureText(t).width>maxW&&line){out.push(line);line=w}else line=t});out.push(line)});return out;
}
function rrect(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath()}
function drawCaption(ctx,w,h,text,cx0,cy0,sizePct,color,bgColor,o={}){
  const fs=Math.max(8,Math.round(sizePct/100*h));ctx.save();
  ctx.font=`${o.weight||700} ${fs}px ${FONT}`;ctx.direction=/[\u0600-\u06FF]/.test(text)?'rtl':'ltr';ctx.textAlign='center';ctx.textBaseline='middle';
  const lines=wrapText(ctx,text,w*0.88),lh=fs*1.38,bw=Math.max(...lines.map(l=>ctx.measureText(l).width)),bh=lines.length*lh;
  let cy=cy0;if(o.clamp)cy=Math.min(cy,h-bh/2-fs*.45);
  ctx.globalAlpha*=o.alpha==null?1:o.alpha;ctx.translate(cx0,cy+(o.dy||0));if(o.sc&&o.sc!==1)ctx.scale(o.sc,o.sc);
  if(bgColor){ctx.fillStyle=bgColor;rrect(ctx,-bw/2-fs*.45,-bh/2-fs*.12,bw+fs*.9,bh+fs*.24,fs*.32);ctx.fill()}
  ctx.lineJoin='round';ctx.lineWidth=fs*.14;ctx.strokeStyle='rgba(0,0,0,.9)';ctx.fillStyle=color;
  lines.forEach((l,i)=>{const y=(i-(lines.length-1)/2)*lh;if(!bgColor&&o.stroke!==false)ctx.strokeText(l,0,y);ctx.fillText(l,0,y)});
  ctx.restore();return{w:bw,h:bh};
}
const easeOut=k=>1-Math.pow(1-k,3), easeBack=k=>{const c=1.70158+1;return 1+c*Math.pow(k-1,3)+1.70158*Math.pow(k-1,2)};
const bgc=document.createElement('canvas');
function drawFrame(ctx,w,h,t,opt={}){
  ctx.save();ctx.fillStyle='#000';ctx.fillRect(0,0,w,h);
  const ci=clipAt(t);
  if(ci>=0){
    const c=S.clips[ci],a=assets[c.aid];
    if(a){const isImg=a.type==='image',src=isImg?a.img:a.el;
      if(src&&(isImg||a.el.readyState>=2)){
        const sw=isImg?a.w:a.el.videoWidth,sh=isImg?a.h:a.el.videoHeight;
        if(sw&&sh){
          const lt=clamp(t-c._s,0,cdur(c)),d=cdur(c);
          let fa=1;if(c.fade>0){fa=Math.min(1,lt/c.fade,(d-lt)/c.fade)}
          const cover=Math.max(w/sw,h/sh);let sc=c.fit==='cover'?cover:Math.min(w/sw,h/sh);
          if(c.fit!=='cover'&&c.bgblur&&Math.abs(sc-cover)>0.01){
            const bw=Math.max(16,w>>4),bh=Math.max(16,h>>4);bgc.width=bw;bgc.height=bh;const bx=bgc.getContext('2d'),s2=Math.max(bw/sw,bh/sh);bx.drawImage(src,(bw-sw*s2)/2,(bh-sh*s2)/2,sw*s2,sh*s2);
            ctx.globalAlpha=fa;ctx.imageSmoothingQuality='high';ctx.filter='brightness(55%)';ctx.drawImage(bgc,0,0,w,h);ctx.filter='none';ctx.globalAlpha=1;
          }
          let z=(c.zoom||100)/100;if(c.kb)z*=1+(c.kb/100)*(lt/d);sc*=z;const dw=sw*sc,dh=sh*sc;
          ctx.globalAlpha=fa;ctx.filter=filterStr(c,w);
          ctx.drawImage(src,(w-dw)/2+(c.px||0)/100*w,(h-dh)/2+(c.py||0)/100*h,dw,dh);
          ctx.filter='none';
          if(c.vig){const g=ctx.createRadialGradient(w/2,h/2,Math.min(w,h)*.3,w/2,h/2,Math.max(w,h)*.75);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(0,0,0,.75)');ctx.fillStyle=g;ctx.fillRect(0,0,w,h)}
          ctx.globalAlpha=1;
        }}}
  }
  S.texts.forEach(tx=>{
    if(t<tx.start||t>tx.end)return;const lt=t-tx.start,d=Math.max(.1,tx.end-tx.start);let alpha=1,sc=1,dy=0,txt=tx.text;
    if(tx.anim==='fade')alpha=Math.min(1,lt/.4,(d-lt)/.4);
    else if(tx.anim==='pop'){sc=.55+.45*easeBack(Math.min(1,lt/.35));alpha=Math.min(1,lt/.12,(d-lt)/.25)}
    else if(tx.anim==='slide'){dy=(1-easeOut(Math.min(1,lt/.45)))*h*.1;alpha=Math.min(1,lt/.3,(d-lt)/.3)}
    else if(tx.anim==='type'){txt=[...tx.text].slice(0,Math.ceil([...tx.text].length*Math.min(1,lt/(d*.55)))).join('')}
    if(!txt)return;
    drawCaption(ctx,w,h,txt,tx.x*w,tx.y*h,tx.size,tx.color,tx.bgOn?tx.bg:null,{alpha,sc,dy,weight:tx.weight});
  });
  if(opt.subs!==false&&S.subStyle.burn){
    const sub=S.subs.find(s=>t>=s.s&&t<=s.e);
    if(sub&&sub.t)drawCaption(ctx,w,h,sub.t,w/2,S.subStyle.pos/100*h,S.subStyle.size,S.subStyle.color,S.subStyle.bg?'rgba(0,0,0,.62)':null,{clamp:true,weight:700});
  }
  ctx.restore();
}
function render(){drawFrame(cx,cv.width,cv.height,S.playhead);$('#empty').classList.toggle('hide',S.clips.length>0)}

/* ---------- player ---------- */
const P={playing:false,t0:0,w0:0,active:-2,exporting:false,onEnd:null};
function stopMedia(){Object.values(assets).forEach(a=>{if(a.el&&!a.el.paused)a.el.pause()})}
function srcTime(c,t){return c.in+(t-c._s)*c.speed}
function startClip(i,t){
  const c=S.clips[i],a=c&&assets[c.aid];if(!a||a.type!=='video')return;const el=a.el;
  el.playbackRate=clamp(c.speed,.0625,16);el.volume=c.mute?0:clamp(c.vol/100,0,1);
  const want=srcTime(c,t);if(Math.abs(el.currentTime-want)>.05)el.currentTime=want;
  if(P.playing)el.play().catch(()=>{});
}
function syncMedia(t){
  const ci=clipAt(t);
  if(ci!==P.active){P.active=ci;const cur=ci>=0&&assets[S.clips[ci].aid];Object.values(assets).forEach(a=>{if(a.type==='video'&&a!==cur&&a.el&&!a.el.paused)a.el.pause()});if(ci>=0)startClip(ci,t)}
  else if(ci>=0){const c=S.clips[ci],a=assets[c.aid];if(a&&a.type==='video'){const want=srcTime(c,t);if(Math.abs(a.el.currentTime-want)>.4&&!a.el.seeking){a.el.currentTime=want}if(a.el.paused&&P.playing&&!a.el.seeking)a.el.play().catch(()=>{})}}
  S.audios.forEach(u=>{const a=assets[u.aid];if(!a||!a.el)return;const d=u.out-u.in,inr=t>=u.start&&t<u.start+d;
    if(inr&&P.playing){a.el.volume=clamp(u.vol/100,0,1);const want=u.in+(t-u.start);if(a.el.paused){a.el.currentTime=want;a.el.play().catch(()=>{})}else if(Math.abs(a.el.currentTime-want)>.4)a.el.currentTime=want}
    else if(!a.el.paused)a.el.pause()});
}
function play(){
  if(!S.clips.length)return;getAC();if(AC.state==='suspended')AC.resume();
  if(S.playhead>=total-.02)S.playhead=0;
  P.playing=true;P.t0=S.playhead;P.w0=performance.now();P.active=-2;$('#bPlay').textContent='⏸';
}
function pause(){P.playing=false;stopMedia();P.active=-2;$('#bPlay').textContent='▶';}
function seekTo(t){
  S.playhead=clamp(t,0,Math.max(0,total));
  if(P.playing){P.t0=S.playhead;P.w0=performance.now();P.active=-2}
  else{stopMedia();const ci=clipAt(S.playhead);if(ci>=0){const c=S.clips[ci],a=assets[c.aid];if(a&&a.type==='video'){a.el.onseeked=()=>{dirty=true};try{a.el.currentTime=srcTime(c,S.playhead)}catch(e){}}}}
  dirty=true;updTC();
}
function updTC(){$('#tc').textContent=fmt(S.playhead)+' / '+fmt(total);$('#playhead').style.left=(S.playhead*S.pps)+'px'}
function tick(){
  if(P.playing){
    let t=P.t0+(performance.now()-P.w0)/1000;
    if(t>=total){t=total;S.playhead=t;pause();dirty=true;if(P.onEnd){const f=P.onEnd;P.onEnd=null;f()}}
    else{S.playhead=t;syncMedia(t)}
    dirty=true;updTC();
    const sc=$('#tlScroll'),x=S.playhead*S.pps;if(x>sc.scrollLeft+sc.clientWidth-30||x<sc.scrollLeft)sc.scrollLeft=Math.max(0,x-60);
  }
  if(dirty){dirty=false;render()}
  requestAnimationFrame(tick);
}

/* ---------- editing ops ---------- */
function select(k,id){S.sel=k?{k,id}:null;if(k){S.tab={clip:'fx',text:'text',sub:'subs',audio:'audio'}[k]||S.tab}refreshAll()}
function selObj(){return S.sel?findObj(S.sel.k,S.sel.id):null}
function splitAt(){
  const t=S.playhead;
  if(S.sel&&S.sel.k==='text'){const x=selObj();if(x&&t>x.start+.2&&t<x.end-.2){const y={...x,id:uid(),start:t};x.end=t;S.texts.push(y);commit();refreshAll();return}}
  const i=clipAt(t);if(i<0)return;const c=S.clips[i];const lt=t-c._s;
  if(lt<.15||cdur(c)-lt<.15){toast('حرّك المؤشر لنقطة جوه المقطع');return}
  const s=c.in+lt*c.speed;const n={...c,id:uid(),in:s,fade:0};c.out=s;c.fade=0;S.clips.splice(i+1,0,n);layout();S.sel={k:'clip',id:n.id};commit();refreshAll();seekTo(t);
}
function delSel(){
  if(!S.sel)return;const{k,id}=S.sel;const arr=k==='clip'?S.clips:k==='text'?S.texts:k==='sub'?S.subs:S.audios;const i=arr.findIndex(o=>o.id===id);if(i<0)return;
  arr.splice(i,1);S.sel=null;layout();S.playhead=clamp(S.playhead,0,total);commit();refreshAll();seekTo(S.playhead);
}
function dupSel(){
  const o=selObj();if(!o)return;const{k}=S.sel;const n={...o,id:uid()};
  if(k==='clip'){S.clips.splice(S.clips.indexOf(o)+1,0,n);layout()}else if(k==='text'){const d=o.end-o.start;n.start=o.end;n.end=o.end+d;S.texts.push(n)}else if(k==='audio'){n.start=o.start+(o.out-o.in);S.audios.push(n)}else if(k==='sub'){const d=o.e-o.s;n.s=o.e;n.e=o.e+d;S.subs.push(n);S.subs.sort((a,b)=>a.s-b.s)}
  S.sel={k,id:n.id};commit();refreshAll();
}
function addText(txt){
  const t=S.playhead,tx={id:uid(),text:txt||'اكتب النص هنا',start:t,end:t+3,x:.5,y:.5,size:9,color:'#ffffff',bgOn:false,bg:'#000000',anim:'pop',weight:900};
  S.texts.push(tx);S.sel={k:'text',id:tx.id};S.tab='text';commit();refreshAll();return tx;
}
function addSub(){const t=S.playhead,s={id:uid(),s:t,e:t+2.5,t:'سطر ترجمة جديد'};S.subs.push(s);S.subs.sort((a,b)=>a.s-b.s);S.sel={k:'sub',id:s.id};S.tab='subs';commit();refreshAll()}
function addAudioClip(aid){const a=assets[aid];S.audios.push({id:uid(),aid,start:S.playhead,in:0,out:a.dur,vol:100});S.sel={k:'audio',id:S.audios[S.audios.length-1].id};S.tab='audio';commit();refreshAll()}

/* ---------- timeline ---------- */
const inner=$('#tlInner');
function renderTL(){
  layout();const pps=S.pps,W=Math.max((total+8)*pps,$('#tlScroll').clientWidth-2);inner.style.width=W+'px';
  const step=pps>=100?1:pps>=50?2:pps>=25?5:pps>=12?10:30;let rh='';for(let t=0;t*pps<W;t+=step)rh+=`<i style="left:${t*pps}px">${fmtS(t)}</i>`;$('#ruler').innerHTML=rh;
  const sel=(k,id)=>S.sel&&S.sel.k===k&&S.sel.id===id?' sel':'';
  $('#trV').innerHTML=S.clips.map(c=>{const a=assets[c.aid]||{};return`<div class="blk clip${a.type==='image'?' img':''}${sel('clip',c.id)}" data-k="clip" data-id="${c.id}" style="left:${c._s*pps}px;width:${Math.max(6,cdur(c)*pps)}px;${a.thumb?`background-image:url(${a.thumb})`:''}"><b class="h l"></b><span>${esc(a.name||'')} · ${cdur(c).toFixed(1)}s${c.speed!==1?' ×'+c.speed:''}</span><b class="h r"></b></div>`}).join('');
  $('#trT').innerHTML=S.texts.map(x=>`<div class="blk txt${sel('text',x.id)}" data-k="text" data-id="${x.id}" style="left:${x.start*pps}px;width:${Math.max(6,(x.end-x.start)*pps)}px"><b class="h l"></b><span>${esc(x.text)}</span><b class="h r"></b></div>`).join('');
  $('#trS').innerHTML=S.subs.map(x=>`<div class="blk sub${sel('sub',x.id)}" data-k="sub" data-id="${x.id}" style="left:${x.s*pps}px;width:${Math.max(6,(x.e-x.s)*pps)}px"><b class="h l"></b><span>${esc(x.t)}</span><b class="h r"></b></div>`).join('');
  $('#trA').innerHTML=S.audios.map(u=>{const a=assets[u.aid]||{};return`<div class="blk aud${sel('audio',u.id)}" data-k="audio" data-id="${u.id}" style="left:${u.start*pps}px;width:${Math.max(6,(u.out-u.in)*pps)}px;${a.wave?`background-image:url(${a.wave})`:''}"><b class="h l"></b><span>${esc(a.name||'')}</span><b class="h r"></b></div>`}).join('');
  updTC();
}
function timeAt(e){const r=inner.getBoundingClientRect();return Math.max(0,(e.clientX-r.left)/S.pps)}
inner.addEventListener('pointerdown',e=>{
  const b=e.target.closest('.blk');
  if(!b){
    if(P.playing)pause();seekTo(Math.min(timeAt(e),total));
    const mv=ev=>seekTo(Math.min(timeAt(ev),total)),up=()=>{removeEventListener('pointermove',mv);removeEventListener('pointerup',up)};
    addEventListener('pointermove',mv);addEventListener('pointerup',up);
    if(S.sel){S.sel=null;renderTL();renderPanel()}
    return;
  }
  const k=b.dataset.k,o=findObj(k,b.dataset.id);if(!o)return;
  const prevSel=S.sel&&S.sel.id===o.id;S.sel={k,id:o.id};
  const mode=e.target.classList.contains('l')?'l':e.target.classList.contains('r')?'r':'m';
  const x0=e.clientX,o0={...o},pps=S.pps;let moved=false;
  const clickT=timeAt(e);
  const mv=ev=>{
    const dx=(ev.clientX-x0)/pps;if(Math.abs(ev.clientX-x0)>3)moved=true;if(!moved)return;
    if(k==='clip'){const a=assets[o.aid],mx=a.type==='image'?120:a.dur;
      if(mode==='l'){o.in=clamp(o0.in+dx*o.speed,0,o0.out-.2)}
      else if(mode==='r'){o.out=clamp(o0.out+dx*o.speed,o0.in+.2,mx)}
      else{const des=o0._s+dx+cdur(o)/2;const others=S.clips.filter(c=>c!==o);let cum=0,idx=others.length;for(let j=0;j<others.length;j++){const d=cdur(others[j]);if(des<cum+d/2){idx=j;break}cum+=d}others.splice(idx,0,o);S.clips=others}
      layout();
    }else if(k==='audio'){
      if(mode==='m')o.start=Math.max(0,o0.start+dx);
      else if(mode==='r')o.out=clamp(o0.out+dx,o0.in+.2,assets[o.aid].dur);
      else{const nin=clamp(o0.in+dx,0,o0.out-.2);o.start=Math.max(0,o0.start+(nin-o0.in));o.in=nin}
    }else{const a=k==='sub'?'s':'start',b2=k==='sub'?'e':'end',d=o0[b2]-o0[a];
      if(mode==='m'){o[a]=Math.max(0,o0[a]+dx);o[b2]=o[a]+d}
      else if(mode==='l')o[a]=clamp(o0[a]+dx,0,o0[b2]-.2);
      else o[b2]=Math.max(o0[a]+.2,o0[b2]+dx)}
    renderTL();dirty=true;
  };
  const up=()=>{removeEventListener('pointermove',mv);removeEventListener('pointerup',up);
    if(moved){if(k==='sub')S.subs.sort((a,b)=>a.s-b.s);layout();commit();refreshAll();seekTo(Math.min(S.playhead,total))}
    else{select(k,o.id);seekTo(Math.min(clickT,total))}};
  addEventListener('pointermove',mv);addEventListener('pointerup',up);
  e.preventDefault();
});
$('#zoom').oninput=e=>{S.pps=+e.target.value;renderTL()};

let cdrag=null;
cv.addEventListener('pointerdown',e=>{
  if(!S.sel||S.sel.k!=='text')return;const tx=selObj();if(!tx||S.playhead<tx.start||S.playhead>tx.end)return;
  cdrag={tx,r:cv.getBoundingClientRect()};cv.setPointerCapture(e.pointerId);e.preventDefault();
});
cv.addEventListener('pointermove',e=>{if(!cdrag)return;const r=cdrag.r;cdrag.tx.x=+clamp((e.clientX-r.left)/r.width,0,1).toFixed(3);cdrag.tx.y=+clamp((e.clientY-r.top)/r.height,0,1).toFixed(3);dirty=true;const a=$('[data-k="x"]'),b=$('[data-k="y"]');if(a&&b){a.value=cdrag.tx.x;b.value=cdrag.tx.y}});
cv.addEventListener('pointerup',()=>{if(cdrag){cdrag=null;commit()}});

/* ---------- panel ---------- */
const TABS=[['media','📁 الوسائط'],['text','🔤 نص'],['subs','💬 ترجمة'],['fx','✨ مؤثرات'],['audio','🎵 صوت'],['export','⬇ تصدير']];
function renderTabs(){$('#tabs').innerHTML=TABS.map(([k,n])=>`<button data-t="${k}" class="${S.tab===k?'on':''}">${n}</button>`).join('')}
$('#tabs').onclick=e=>{const b=e.target.closest('button');if(!b)return;S.tab=b.dataset.t;renderTabs();renderPanel()};
const obName=o=>o===S.subStyle?'sty':S.sel&&S.sel.k||'';
function sld(o,k,label,min,max,step,unit=''){return`<div class="fld"><label>${label}<b>${o[k]}${unit}</b></label><input type="range" data-o="${obName(o)}" data-k="${k}" min="${min}" max="${max}" step="${step}" value="${o[k]}" data-u="${unit}"></div>`}
function sel_(o,k,label,opts){return`<div class="fld"><label>${label}</label><select data-o="${obName(o)}" data-k="${k}">${opts.map(([v,n])=>`<option value="${v}" ${String(o[k])===String(v)?'selected':''}>${n}</option>`).join('')}</select></div>`}
function chk(o,k,label){return`<label class="chk"><input type="checkbox" data-o="${obName(o)}" data-k="${k}" ${o[k]?'checked':''}> ${label}</label>`}
function clr(o,k,label){return`<div class="fld"><label>${label}</label><input type="color" data-o="${obName(o)}" data-k="${k}" value="${o[k]}"></div>`}
function renderPanel(){
  const B=$('#tabBody'),st=B.scrollTop;let h='';
  if(S.tab==='media')h=panelMedia();else if(S.tab==='text')h=panelText();else if(S.tab==='subs')h=panelSubs();else if(S.tab==='fx')h=panelFx();else if(S.tab==='audio')h=panelAudio();else h=panelExport();
  B.innerHTML=h;wirePanel(B);B.scrollTop=st;
  if(S.tab==='fx')drawPresetThumbs();
}
function panelMedia(){
  const list=Object.values(assets);
  return`<div class="row"><button class="primary" data-act="add">+ إضافة ملفات</button><button data-act="demo">مثال جاهز</button></div>
  <p class="hint">فيديو، صور، أو صوت. اضغط "+ للمقاطع" لإضافة الملف في الخط الزمني.</p>
  <div class="assets">${list.map(a=>`<div class="asset"><div class="th" style="${a.thumb?`background-image:url(${a.thumb})`:''}">${a.thumb?'':'🎵'}</div><div class="nm" title="${esc(a.name)}">${esc(a.name)}${a.type!=='image'?' · '+fmtS(a.dur):''}</div>${a.type==='audio'?`<button data-act="aud" data-id="${a.id}">+ كصوت</button>`:`<button data-act="clip" data-id="${a.id}">+ للمقاطع</button>`}</div>`).join('')||'<p class="hint">لسه مفيش ملفات.</p>'}</div>
  <div class="h4">اختصارات</div><p class="hint">مسافة: تشغيل · S: قص · Delete: حذف · ←/→: إطار · Ctrl+Z: تراجع</p>`;
}
function panelText(){
  const tx=S.sel&&S.sel.k==='text'?selObj():null;
  let h=`<div class="row"><button class="primary" data-act="addtext">+ نص جديد عند المؤشر</button></div>`;
  h+=`<div class="row">${[['عنوان كبير',12],['نص عادي',7],['اسم / تعريف',5]].map(([n,s])=>`<button data-act="preset" data-s="${s}" data-n="${n}">${n}</button>`).join('')}</div>`;
  if(!tx)return h+`<p class="hint">اختار نص من الخط الزمني أو اضغط "نص جديد". تقدر تسحب النص على الشاشة مباشرة.</p>`;
  h+=`<div class="fld"><label>النص</label><textarea data-o="text" data-k="text">${esc(tx.text)}</textarea></div>`;
  h+=`<div class="r2"><div class="fld"><label>يبدأ (ثانية)</label><input type="number" step="0.1" min="0" data-o="text" data-k="start" value="${tx.start.toFixed(1)}"></div><div class="fld"><label>ينتهي (ثانية)</label><input type="number" step="0.1" min="0" data-o="text" data-k="end" value="${tx.end.toFixed(1)}"></div></div>`;
  h+=sld(tx,'size','الحجم',2,30,.5,'%')+sld(tx,'x','أفقي',0,1,.01)+sld(tx,'y','رأسي',0,1,.01);
  h+=`<div class="r3">${clr(tx,'color','لون النص')}${clr(tx,'bg','لون الخلفية')}${chk(tx,'bgOn','خلفية')}</div>`;
  h+=sel_(tx,'anim','الحركة',[['none','بدون'],['fade','ظهور تدريجي'],['pop','بوب'],['slide','انزلاق'],['type','كتابة']]);
  h+=sel_(tx,'weight','السُمك',[[400,'عادي'],[700,'عريض'],[900,'عريض جداً']]);
  return h;
}
function panelSubs(){
  const tiny=IS_MOBILE;
  let h=`<div class="h4">ترجمة تلقائية (ذكاء اصطناعي على جهازك)</div>
  <div class="r2"><div class="fld"><label>اللغة</label><select id="asrLang"><option value="arabic">عربي</option><option value="english">English</option><option value="french">Français</option><option value="spanish">Español</option><option value="german">Deutsch</option><option value="turkish">Türkçe</option><option value="">كشف تلقائي</option></select></div>
  <div class="fld"><label>الجودة</label><select id="asrModel"><option value="Xenova/whisper-tiny" ${tiny?'selected':''}>سريع (~40MB)</option><option value="Xenova/whisper-base" ${tiny?'':'selected'}>متوازن (~80MB)</option><option value="Xenova/whisper-small">دقيق (~250MB)</option></select></div></div>
  <button class="primary" id="asrGo" style="width:100%">🎙 ولّد الترجمة من كلام الفيديو</button>
  <div class="bar"><i id="asrBar"></i></div><div class="status" id="asrSt">أول مرة بينزل الموديل من الإنترنت ويتحفظ في الجهاز.</div>
  <div class="h4">أسلوب الترجمة</div>
  ${chk(S.subStyle,'burn','اظهر الترجمة على الفيديو (وتتحرق في التصدير)')}
  ${sld(S.subStyle,'size','الحجم',2,10,.2,'%')}${sld(S.subStyle,'pos','الموضع (من الأعلى)',10,96,1,'%')}
  <div class="r3">${clr(S.subStyle,'color','اللون')}${chk(S.subStyle,'bg','خلفية سوداء')}</div>
  <div class="row"><button data-act="addsub">+ سطر عند المؤشر</button><button data-act="srtin">استيراد SRT</button><button data-act="srtout">تصدير SRT</button></div>
  <div class="h4">السطور (${S.subs.length})</div>`;
  h+=S.subs.map(s=>`<div class="subitem ${S.sel&&S.sel.id===s.id?'on':''}"><div class="tm"><input type="number" step="0.1" data-sid="${s.id}" data-f="s" value="${s.s.toFixed(1)}"><input type="number" step="0.1" data-sid="${s.id}" data-f="e" value="${s.e.toFixed(1)}"><button data-act="subdel" data-id="${s.id}" class="danger">🗑</button></div><textarea data-sid="${s.id}" data-f="t" rows="2">${esc(s.t)}</textarea></div>`).join('')||'<p class="hint">مفيش ترجمة لسه.</p>';
  return h;
}
function panelFx(){
  const c=S.sel&&S.sel.k==='clip'?selObj():null;
  if(!c)return`<p class="hint">اختار مقطع من الخط الزمني عشان تعدل المؤثرات والسرعة والصوت.</p>`;
  const a=assets[c.aid]||{};
  let h=`<div class="h4">فلاتر</div><div class="presets">${Object.entries(PRESETS).map(([k,p])=>`<button data-act="preset-fx" data-p="${k}" class="${c.preset===k?'on':''}"><canvas width="96" height="60" data-pp="${k}"></canvas>${p.n}</button>`).join('')}</div>`;
  h+=`<div class="h4">ضبط الصورة</div>${sld(c,'b','السطوع',30,200,1,'%')}${sld(c,'c','التباين',30,200,1,'%')}${sld(c,'s','التشبع',0,250,1,'%')}${sld(c,'h','تدرج اللون',-180,180,1,'°')}${sld(c,'bl','تمويه',0,20,.5,'px')}${chk(c,'vig','تعتيم الأطراف')}`;
  h+=`<div class="h4">الحركة والإطار</div>${sel_(c,'fit','ملء الشاشة',[['contain','احتواء'],['cover','قص وملء']])}${chk(c,'bgblur','خلفية ضبابية لو فيه فراغ')}${sld(c,'zoom','تكبير',100,300,1,'%')}${sld(c,'kb','تكبير تدريجي (Ken Burns)',0,60,1,'%')}${sld(c,'px','إزاحة أفقية',-50,50,1,'%')}${sld(c,'py','إزاحة رأسية',-50,50,1,'%')}${sld(c,'fade','دخول/خروج تدريجي من الأسود',0,2,.1,'s')}`;
  if(a.type==='video')h+=`<div class="h4">سرعة وصوت</div>${sld(c,'speed','السرعة',.25,4,.05,'×')}${sld(c,'vol','مستوى الصوت',0,100,1,'%')}${chk(c,'mute','كتم صوت المقطع')}`;
  else h+=`<div class="h4">المدة</div><div class="fld"><label>مدة الصورة (ثانية)</label><input type="number" step="0.5" min="0.5" max="120" data-o="clip" data-k="out" value="${c.out}"></div>`;
  h+=`<div class="row"><button data-act="clipl">◀ حرّك للبداية</button><button data-act="clipr">حرّك للنهاية ▶</button></div><div class="row"><button data-act="applyall">طبّق الفلتر على كل المقاطع</button></div>`;
  return h;
}
function panelAudio(){
  const u=S.sel&&S.sel.k==='audio'?selObj():null;
  const auds=Object.values(assets).filter(a=>a.type==='audio');
  let h=`<div class="row"><button class="primary" data-act="add">+ ملف صوت / موسيقى</button><button id="recBtn">${rec.on?'⏹ إيقاف التسجيل':'🎤 تسجيل تعليق صوتي'}</button></div>`;
  h+=`<p class="hint">التعليق الصوتي بيتسجل من الميكروفون وبيتحط عند مكان المؤشر.</p>`;
  h+=auds.map(a=>`<div class="subitem"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><span>🎵 ${esc(a.name)} · ${fmtS(a.dur)}</span><button data-act="aud" data-id="${a.id}">+ عند المؤشر</button></div></div>`).join('');
  if(u){const a=assets[u.aid]||{};h+=`<div class="h4">${esc(a.name||'')}</div>${sld(u,'vol','مستوى الصوت',0,100,1,'%')}<div class="fld"><label>يبدأ عند (ث)</label><input type="number" step="0.1" min="0" data-o="audio" data-k="start" value="${u.start.toFixed(1)}"></div>`}
  else h+=`<p class="hint">اختار مقطع صوت من الخط الزمني عشان تعدل مستواه.</p>`;
  return h;
}
const exp={short:IS_MOBILE?480:720,fps:30,fmt:'auto',result:null,busy:false,pct:0};
function bestMime(f){
  const c=f==='webm'?['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm']:f==='mp4'?['video/mp4;codecs=avc1.42E01E,mp4a.40.2','video/mp4']:['video/mp4;codecs=avc1.42E01E,mp4a.40.2','video/mp4','video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'];
  return c.find(m=>window.MediaRecorder&&MediaRecorder.isTypeSupported(m))||'';
}
function panelExport(){
  const mp4=bestMime('mp4');
  return`<div class="fld"><label>أبعاد الفيديو</label><select data-o="proj" data-k="aspect">${Object.keys(ASPECTS).map(k=>`<option value="${k}" ${S.aspect===k?'selected':''}>${k}${{'16:9':' (يوتيوب)','9:16':' (ريلز / تيك توك)','1:1':' (مربع)','4:5':' (إنستجرام)','4:3':''}[k]}</option>`).join('')}</select></div>
  <div class="r2"><div class="fld"><label>الجودة</label><select data-o="exp" data-k="short">${[[480,'480p خفيف'],[720,'720p HD'],[1080,'1080p Full HD']].map(([v,n])=>`<option value="${v}" ${exp.short===v?'selected':''}>${n}</option>`).join('')}</select></div>
  <div class="fld"><label>الإطارات</label><select data-o="exp" data-k="fps">${[24,30,60].map(v=>`<option value="${v}" ${exp.fps===v?'selected':''}>${v} إطار/ث</option>`).join('')}</select></div></div>
  <div class="fld"><label>الصيغة</label><select data-o="exp" data-k="fmt"><option value="auto" ${exp.fmt==='auto'?'selected':''}>تلقائي ${mp4?'(MP4)':'(WebM)'}</option><option value="webm" ${exp.fmt==='webm'?'selected':''}>WebM</option>${mp4?`<option value="mp4" ${exp.fmt==='mp4'?'selected':''}>MP4</option>`:''}</select></div>
  ${chk(S.subStyle,'burn','احرق الترجمة في الفيديو')}
  <button class="primary" id="expGo" style="width:100%" ${exp.busy?'disabled':''}>${exp.busy?'جاري التصدير...':'ابدأ التصدير'}</button>
  <div class="bar"><i id="expBar" style="width:${exp.pct}%"></i></div><div class="status" id="expSt">التصدير بيتم بسرعة التشغيل العادية (مدة الفيديو = مدة التصدير). سيب الصفحة مفتوحة وقدّامك.</div>
  <div id="expRes"></div>
  <div class="row"><button id="snapBtn">📷 احفظ الإطار الحالي كصورة</button></div>`;
}
function wirePanel(B){
  $$('[data-k]',B).forEach(el=>{
    const ob=el.dataset.o,k=el.dataset.k;
    const target=()=>ob==='sty'?S.subStyle:ob==='proj'?S:ob==='exp'?exp:findObj(ob,S.sel&&S.sel.id);
    const val=()=>el.type==='checkbox'?el.checked:(el.type==='range'||el.type==='number')?parseFloat(el.value):(k==='weight'||k==='short'||k==='fps')?+el.value:el.value;
    el.addEventListener('input',()=>{const o=target();if(!o||ob==='proj'||ob==='exp')return;
      o[k]=val();if(el.type==='range'){const b=el.previousElementSibling&&$('b',el.previousElementSibling);if(b)b.textContent=o[k]+(el.dataset.u||'')}
      if(ob==='clip'){layout();renderTL()}else if(['text','audio'].includes(ob))renderTL();dirty=true});
    el.addEventListener('change',()=>{const o=target();if(!o)return;
      if(ob==='proj'){S.aspect=el.value;setCanvasSize(quality);commit();dirty=true;return}
      if(ob==='exp'){o[k]=val();return}
      o[k]=val();if(ob==='text'&&(k==='start'||k==='end')){if(o.end<o.start+.1)o.end=o.start+.1}
      if(ob==='clip'&&k==='out')o.out=clamp(o.out,.5,120);
      commit();renderTL();dirty=true;if(el.type==='checkbox'||el.tagName==='SELECT'||k==='out'||k==='start'||k==='end')renderPanel()});
  });
  B.onclick=e=>{
    const b=e.target.closest('[data-act]');if(!b)return;const act=b.dataset.act,id=b.dataset.id;
    if(act==='add')$('#fileIn').click();
    else if(act==='demo')demo();
    else if(act==='clip'){addClip(id);S.tab='media';renderTabs();renderPanel()}
    else if(act==='aud')addAudioClip(id);
    else if(act==='addtext')addText();
    else if(act==='preset'){const n=b.dataset.n,x=addText();x.size=+b.dataset.s;x.text=n==='عنوان كبير'?'العنوان هنا':n==='اسم / تعريف'?'الاسم · الوظيفة':'نص عادي';x.y=n==='اسم / تعريف'?.86:.5;commit();refreshAll()}
    else if(act==='addsub')addSub();
    else if(act==='subdel'){const i=S.subs.findIndex(s=>s.id===id);if(i>=0){S.subs.splice(i,1);commit();refreshAll()}}
    else if(act==='srtin')$('#srtIn').click();
    else if(act==='srtout')exportSRT();
    else if(act==='preset-fx'){const c=selObj();c.preset=b.dataset.p;commit();renderPanel();dirty=true}
    else if(act==='applyall'){const c=selObj();S.clips.forEach(o=>{['preset','b','c','s','h','bl','vig'].forEach(k=>o[k]=c[k])});commit();dirty=true;toast('اتطبق على كل المقاطع')}
    else if(act==='clipl'||act==='clipr'){const c=selObj(),i=S.clips.indexOf(c),j=act==='clipl'?i-1:i+1;if(j>=0&&j<S.clips.length){S.clips.splice(i,1);S.clips.splice(j,0,c);layout();commit();refreshAll();seekTo(c._s)}}
  };
  $$('[data-sid]',B).forEach(el=>{
    el.addEventListener('input',()=>{const s=S.subs.find(x=>x.id===el.dataset.sid);if(!s)return;const f=el.dataset.f;s[f]=f==='t'?el.value:parseFloat(el.value)||0;renderTL();dirty=true});
    el.addEventListener('change',()=>{S.subs.sort((a,b)=>a.s-b.s);commit();renderTL()});
    el.addEventListener('focus',()=>{const s=S.subs.find(x=>x.id===el.dataset.sid);if(s){S.sel={k:'sub',id:s.id};seekTo(s.s+.05);renderTL()}});
  });
  if(S.tab==='subs')$('#asrGo',B).onclick=runASR;
  if(S.tab==='audio')$('#recBtn',B).onclick=toggleRec;
  if(S.tab==='export'){$('#expGo',B).onclick=runExport;$('#snapBtn',B).onclick=snapshotPNG;showResult()}
}
function drawPresetThumbs(){
  const c0=selObj();const a=c0&&assets[c0.aid];
  $$('canvas[data-pp]').forEach(c=>{const x=c.getContext('2d');
    const fake={preset:c.dataset.pp,b:100,c:100,s:100,h:0,bl:0};
    const paint=img=>{x.filter='none';if(img)x.drawImage(img,0,0,96,60);else{const g=x.createLinearGradient(0,0,96,60);g.addColorStop(0,'#ff7a59');g.addColorStop(.5,'#ffd25a');g.addColorStop(1,'#2f7bff');x.fillStyle=g;x.fillRect(0,0,96,60)}};
    x.fillStyle='#222';x.fillRect(0,0,96,60);x.filter=filterStr(fake,1280);
    if(a&&a.thumb){const im=new Image();im.onload=()=>{x.filter=filterStr(fake,1280);x.drawImage(im,0,0,96,60);x.filter='none'};im.src=a.thumb}
    else{const g=x.createLinearGradient(0,0,96,60);g.addColorStop(0,'#ff7a59');g.addColorStop(.5,'#ffd25a');g.addColorStop(1,'#2f7bff');x.fillStyle=g;x.fillRect(0,0,96,60);x.filter='none'}
  });
}
function refreshAll(){layout();renderTabs();renderTL();renderPanel();dirty=true;updTC()}

/* ---------- subtitles: SRT ---------- */
function srtTime(t){const ms=Math.round(t*1000),h=Math.floor(ms/3600000),m=Math.floor(ms%3600000/60000),s=Math.floor(ms%60000/1000),x=ms%1000;const p=(n,l=2)=>String(n).padStart(l,'0');return`${p(h)}:${p(m)}:${p(s)},${p(x,3)}`}
function exportSRT(){if(!S.subs.length){toast('مفيش ترجمة تتصدّر');return}const txt=S.subs.map((s,i)=>`${i+1}\n${srtTime(s.s)} --> ${srtTime(s.e)}\n${s.t}\n`).join('\n');download(new Blob(['\ufeff'+txt],{type:'text/plain;charset=utf-8'}),'subtitles.srt')}
function parseTime(s){const m=s.trim().replace(',','.').match(/(?:(\d+):)?(\d+):(\d+)(?:\.(\d+))?/);if(!m)return 0;return(+m[1]||0)*3600+(+m[2])*60+(+m[3])+(m[4]?+('0.'+m[4]):0)}
function importSRT(txt){
  const out=[];txt.replace(/\r/g,'').split(/\n\s*\n/).forEach(b=>{const L=b.trim().split('\n');const i=L.findIndex(l=>l.includes('-->'));if(i<0)return;const[a,c]=L[i].split('-->');out.push({id:uid(),s:parseTime(a),e:parseTime(c),t:L.slice(i+1).join('\n').replace(/<[^>]+>/g,'')})});
  if(!out.length){toast('الملف مش بصيغة SRT/VTT');return}S.subs=out;commit();refreshAll();toast('اتضاف '+out.length+' سطر');
}
$('#srtIn').onchange=e=>{const f=e.target.files[0];if(f)f.text().then(importSRT);e.target.value=''};
function download(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{a.remove();URL.revokeObjectURL(a.href)},4000)}

/* ---------- auto subtitles (Whisper via transformers.js) ---------- */
const CDN='https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';
let asr=null,asrKey='';
async function loadASR(model,cb){
  if(asr&&asrKey===model)return asr;
  const T=await import(CDN);T.env.allowLocalModels=false;T.env.useBrowserCache=true;
  asr=await T.pipeline('automatic-speech-recognition',model,{progress_callback:cb});asrKey=model;return asr;
}
async function clipPCM(c){
  const a=assets[c.aid];if(a.type!=='video')return null;
  if(!a.pcm){const ac=new (window.AudioContext||window.webkitAudioContext)({sampleRate:16000});const buf=await ac.decodeAudioData(await a.file.arrayBuffer());const n=buf.length,m=new Float32Array(n);
    for(let ch=0;ch<buf.numberOfChannels;ch++){const d=buf.getChannelData(ch);for(let i=0;i<n;i++)m[i]+=d[i]/buf.numberOfChannels}a.pcm=m;ac.close()}
  return a.pcm.subarray(Math.floor(c.in*16000),Math.min(a.pcm.length,Math.ceil(c.out*16000)));
}
function splitLong(s,max=42){
  if(s.t.length<=max)return[s];const words=s.t.split(/\s+/),parts=[];let cur='';words.forEach(w=>{if((cur+' '+w).trim().length>max&&cur){parts.push(cur);cur=w}else cur=(cur+' '+w).trim()});if(cur)parts.push(cur);
  const tot=parts.reduce((n,p)=>n+p.length,0);let t=s.s;return parts.map(p=>{const d=(s.e-s.s)*p.length/tot;const o={id:uid(),s:t,e:t+d,t:p};t+=d;return o});
}
let asrBusy=false;
async function runASR(){
  if(asrBusy)return;const vids=S.clips.filter(c=>assets[c.aid]&&assets[c.aid].type==='video'&&!c.mute);
  if(!vids.length){toast('ضيف مقطع فيديو فيه كلام الأول');return}
  const st=$('#asrSt'),bar=$('#asrBar'),btn=$('#asrGo');asrBusy=true;btn.disabled=true;
  const lang=$('#asrLang').value,model=$('#asrModel').value;let msg='';
  try{
    const files={};st.textContent='بحمّل الموديل...';
    await loadASR(model,p=>{if(p.status==='progress'){files[p.file]=p.progress;const v=Object.values(files),avg=v.reduce((a,b)=>a+b,0)/v.length;bar.style.width=avg+'%';st.textContent='تنزيل الموديل '+Math.round(avg)+'%'}});
    bar.style.width='0%';const all=[];
    for(let i=0;i<vids.length;i++){
      const c=vids[i];st.textContent=`بحلل الصوت (${i+1}/${vids.length})...`;bar.style.width=(i/vids.length*100)+'%';
      const pcm=await clipPCM(c);if(!pcm||pcm.length<1600)continue;
      await new Promise(r=>setTimeout(r,30));
      const opt={task:'transcribe',chunk_length_s:30,stride_length_s:5,return_timestamps:true};if(lang)opt.language=lang;
      const out=await asr(pcm,opt);
      const d=cdur(c);(out.chunks||[]).forEach(ch=>{const t0=(ch.timestamp[0]||0)/c.speed,t1=ch.timestamp[1]==null?d:ch.timestamp[1]/c.speed;const tx=(ch.text||'').trim();if(!tx||/^[.\s…]+$/.test(tx))return;
        splitLong({id:uid(),s:c._s+t0,e:c._s+Math.min(d,Math.max(t1,t0+.4)),t:tx}).forEach(x=>all.push(x))});
    }
    const lo=Math.min(...vids.map(c=>c._s)),hi=Math.max(...vids.map(c=>c._s+cdur(c)));
    S.subs=S.subs.filter(s=>s.e<=lo||s.s>=hi).concat(all).sort((a,b)=>a.s-b.s);
    bar.style.width='100%';msg=all.length?`تمام: ${all.length} سطر. راجعهم وعدّل أي كلمة.`:'مسمعتش كلام واضح في المقطع.';
    commit();S.sel=null;renderTL();dirty=true;window.__asrDone=all.length;
  }catch(e){console.error(e);msg='حصل خطأ: '+(e.message||e)+' (لازم نت لتنزيل الموديل أول مرة)';window.__asrErr=String(e.message||e)}
  finally{asrBusy=false;if(S.tab==='subs'){renderPanel();const s2=$('#asrSt');if(s2)s2.textContent=msg;const b2=$('#asrBar');if(b2&&!window.__asrErr)b2.style.width='100%'}}
}

/* ---------- voice over ---------- */
const rec={on:false,mr:null,chunks:[],t0:0,at:0};
async function toggleRec(){
  if(rec.on){rec.mr.stop();return}
  try{const st=await navigator.mediaDevices.getUserMedia({audio:true});rec.chunks=[];rec.mr=new MediaRecorder(st);rec.t0=performance.now();rec.at=S.playhead;
    rec.mr.ondataavailable=e=>rec.chunks.push(e.data);
    rec.mr.onstop=async()=>{st.getTracks().forEach(t=>t.stop());rec.on=false;const dur=(performance.now()-rec.t0)/1000;const f=new File(rec.chunks,'تعليق صوتي.webm',{type:rec.mr.mimeType||'audio/webm'});
      try{const a=await loadAsset(f,'audio',dur);a.dur=dur;S.playhead=rec.at;addAudioClip(a.id)}catch(e){toast('فشل حفظ التسجيل');renderPanel()}};
    rec.mr.start();rec.on=true;renderPanel();toast('بيسجّل... اضغط إيقاف لما تخلص')
  }catch(e){toast('محتاج إذن الميكروفون')}
}

/* ---------- export ---------- */
function showResult(){
  const el=$('#expRes');if(!el||!exp.result)return;
  el.innerHTML=`<video class="res" controls playsinline src="${exp.result.url}"></video><div class="row" style="margin-top:8px"><button class="primary" id="dl">⬇ تحميل ${exp.result.ext.toUpperCase()} (${(exp.result.size/1048576).toFixed(1)} MB)</button></div>`;
  $('#dl').onclick=()=>download(exp.result.blob,'video.'+exp.result.ext);
}
async function runExport(){
  if(exp.busy)return;if(!S.clips.length){toast('ضيف مقاطع الأول');return}
  const mime=bestMime(exp.fmt);if(!mime){toast('المتصفح ده مش بيدعم تسجيل الفيديو');return}
  exp.busy=true;exp.pct=0;exp.result=null;pause();getAC();await AC.resume();monitor.gain.value=0;
  const prevQ=quality;quality=exp.short;setCanvasSize(exp.short);
  const fps=exp.fps,stream=cv.captureStream(fps);aDest.stream.getAudioTracks().forEach(t=>stream.addTrack(t));
  const pixels=cv.width*cv.height,vbps=Math.round(clamp(pixels*fps*0.09,1.5e6,16e6));
  const chunks=[];let mr;try{mr=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:vbps,audioBitsPerSecond:128000})}catch(e){mr=new MediaRecorder(stream)}
  mr.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
  const ui=setInterval(()=>{exp.pct=Math.round(S.playhead/Math.max(.1,total)*100);const b=$('#expBar');if(b)b.style.width=exp.pct+'%';const s=$('#expSt');if(s&&exp.busy)s.textContent=`بيصدّر... ${exp.pct}%`},300);
  const stopped=new Promise(r=>mr.onstop=r);
  seekTo(0);renderPanel();await new Promise(r=>setTimeout(r,600));
  mr.start(500);P.exporting=true;
  await new Promise(r=>{P.onEnd=r;play()});
  await new Promise(r=>setTimeout(r,400));mr.stop();await stopped;clearInterval(ui);
  const ext=mime.startsWith('video/mp4')?'mp4':'webm',blob=new Blob(chunks,{type:mime.split(';')[0]});
  exp.result={blob,url:URL.createObjectURL(blob),ext,size:blob.size};exp.busy=false;exp.pct=100;P.exporting=false;monitor.gain.value=1;quality=prevQ;setCanvasSize(quality);seekTo(0);
  renderPanel();toast('التصدير خلص ✅');window.__exportDone=true;
}
function snapshotPNG(){const[w,h]=dims(Math.max(quality,720));const c=document.createElement('canvas');c.width=w;c.height=h;drawFrame(c.getContext('2d'),w,h,S.playhead);c.toBlob(b=>download(b,'frame.png'))}

/* ---------- demo ---------- */
async function demo(){
  const mk=(txt,c1,c2,emoji)=>new Promise(r=>{const c=document.createElement('canvas');c.width=1280;c.height=720;const x=c.getContext('2d');const g=x.createLinearGradient(0,0,1280,720);g.addColorStop(0,c1);g.addColorStop(1,c2);x.fillStyle=g;x.fillRect(0,0,1280,720);
    x.globalAlpha=.18;for(let i=0;i<14;i++){x.beginPath();x.arc(Math.random()*1280,Math.random()*720,40+Math.random()*140,0,7);x.fillStyle='#fff';x.fill()}x.globalAlpha=1;
    x.font='200px serif';x.textAlign='center';x.fillText(emoji,640,400);c.toBlob(b=>r(new File([b],txt+'.png',{type:'image/png'})))});
  const fl=await Promise.all([mk('مشهد ١','#ff6a3d','#7c3aed','🌅'),mk('مشهد ٢','#0ea5e9','#22d3b6','🌊'),mk('مشهد ٣','#f59e0b','#ef4444','🏜️')]);
  for(let i=0;i<fl.length;i++){const a=await loadAsset(fl[i],'image');const c=defClip(a.id);c.out=3;c.preset=['none','vivid','warm'][i];c.kb=[20,0,25][i];c.fade=.3;S.clips.push(c)}
  layout();
  S.texts.push({id:uid(),text:'مرحبًا بيك في استوديو الفيديو',start:.3,end:3.2,x:.5,y:.45,size:9,color:'#ffffff',bgOn:false,bg:'#000000',anim:'pop',weight:900});
  S.texts.push({id:uid(),text:'مونتاج وترجمة وتصدير على جهازك',start:3.4,end:6,x:.5,y:.5,size:7,color:'#ffe27a',bgOn:true,bg:'#00000099',anim:'slide',weight:700});
  S.subs=[{id:uid(),s:.5,e:3,t:'ده مثال للترجمة التلقائية'},{id:uid(),s:3.2,e:6,t:'تقدر تعدّل أي سطر بسهولة'},{id:uid(),s:6.2,e:9,t:'وتصدّر الفيديو كامل بضغطة'}];
  S.sel=null;S.tab='media';commit();refreshAll();seekTo(1);
}

/* ---------- wiring ---------- */
$('#fileIn').onchange=e=>{importFiles(e.target.files);e.target.value=''};
$('#emptyAdd').onclick=()=>$('#fileIn').click();$('#emptyDemo').onclick=demo;
$('#bPlay').onclick=()=>P.playing?pause():play();
$('#bStart').onclick=()=>seekTo(0);$('#bEnd').onclick=()=>seekTo(total);
$('#bSplit').onclick=splitAt;$('#bDel').onclick=delSel;$('#bDup').onclick=dupSel;
$('#undo').onclick=undo;$('#redo').onclick=redo;
$('#btnExport').onclick=()=>{S.tab='export';renderTabs();renderPanel();$('#panel').scrollIntoView({behavior:'smooth'})};
addEventListener('keydown',e=>{
  const ae=document.activeElement;if(/INPUT|TEXTAREA|SELECT/.test(ae.tagName)&&ae.type!=='range'&&ae.type!=='checkbox')return;
  if(e.code==='Space'){e.preventDefault();P.playing?pause():play()}
  else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo()}
  else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();redo()}
  else if(e.key==='s'||e.key==='S'){splitAt()}
  else if(e.key==='Delete'||e.key==='Backspace'){delSel()}
  else if(e.key==='ArrowLeft'){seekTo(S.playhead-(e.shiftKey?1:.1))}
  else if(e.key==='ArrowRight'){seekTo(S.playhead+(e.shiftKey?1:.1))}
});
['dragenter','dragover'].forEach(ev=>addEventListener(ev,e=>{e.preventDefault();$('#drop').classList.add('on')}));
['dragleave','drop'].forEach(ev=>addEventListener(ev,e=>{e.preventDefault();$('#drop').classList.remove('on')}));
addEventListener('drop',e=>{if(e.dataTransfer&&e.dataTransfer.files.length)importFiles(e.dataTransfer.files)});
addEventListener('resize',()=>{renderTL();fitCanvas()});if(window.ResizeObserver)new ResizeObserver(fitCanvas).observe($('#cwrap'));
if(document.fonts)document.fonts.load('700 20px Cairo').then(()=>{dirty=true}).catch(()=>{});
window.__S=S;window.__assets=assets;window.__app={play,pause,seekTo,addText,splitAt,runExport,runASR,importFiles,demo};
setCanvasSize(quality);commit();refreshAll();requestAnimationFrame(tick);
