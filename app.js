'use strict';
/* استوديو الفيديو - مونتاج في المتصفح. كل المعالجة على جهاز المستخدم. */
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const uid=()=>Math.random().toString(36).slice(2,9);
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const IS_MOBILE=/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)||innerWidth<820;
const ASPECTS={'16:9':[16,9],'9:16':[9,16],'1:1':[1,1],'4:5':[4,5],'4:3':[4,3]};
const FONT='Cairo,Tajawal,"Noto Sans Arabic",Arial,sans-serif';
const PRESETS={none:{n:'بدون'},bw:{n:'أبيض وأسود',g:100},sepia:{n:'سيبيا',sp:85},vivid:{n:'حيوي',s:150,c:115},cool:{n:'بارد',h:-20,s:115,b:102},warm:{n:'دافئ',h:14,s:115,sp:15},vintage:{n:'قديم',sp:45,c:90,b:105,s:80},fade:{n:'باهت',c:80,b:115,s:75},drama:{n:'درامي',c:145,s:110,b:88},noir:{n:'نوار',g:100,c:150,b:90},neon:{n:'نيون',h:-40,s:190,c:120},invert:{n:'معكوس',inv:100},teal:{n:'تيل وبرتقاني',h:-8,s:135,c:115,tc:'#00a3b8',ta:.35},pastel:{n:'باستيل',s:70,b:112,c:85},cyber:{n:'سايبر',h:55,s:175,c:125,tc:'#ff00aa',ta:.3},golden:{n:'ساعة ذهبية',h:18,s:130,sp:25,b:106,tc:'#ffb347',ta:.35},moody:{n:'كئيب',c:130,s:75,b:84,tc:'#2b4a6b',ta:.4},hdr:{n:'HDR',c:140,s:145,b:104},chrome:{n:'كروم',g:35,c:145,b:106},dream:{n:'حلم',b:115,c:88,s:125,tc:'#ffd1f0',ta:.3},matrix:{n:'ماتريكس',h:60,s:140,c:130,b:92,tc:'#00ff55',ta:.35}};
const S={aspect:'16:9',clips:[],texts:[],subs:[],audios:[],overlays:[],subStyle:{size:5.4,color:'#ffffff',bg:true,pos:88,burn:true,kar:false,khc:'#ffe14d'},playhead:0,sel:null,tab:'media',pps:50};
const assets={};
const SIL0=0,SIL={th:-38,min:.5},BEAT={n:2,mus:''},CARD={t:'عنوان الفيديو',s:'اكتب العنوان الفرعي هنا',st:0,d:3};let keyPick=false;
let total=0, dirty=true, quality=IS_MOBILE?540:720;
const cv=$('#cv'), cx=cv.getContext('2d');

/* ---------- helpers ---------- */
function fmt(t){t=Math.max(0,t||0);const m=Math.floor(t/60),s=t-m*60;return String(m).padStart(2,'0')+':'+s.toFixed(1).padStart(4,'0')}
function fmtS(t){const m=Math.floor(t/60),s=Math.floor(t%60);return m+':'+String(s).padStart(2,'0')}
function toast(m,ms=3200){const e=$('#toast');e.textContent=m;e.style.display='block';clearTimeout(toast.t);toast.t=setTimeout(()=>e.style.display='none',ms)}
function dims(short=quality){const [a,b]=ASPECTS[S.aspect];if(a>=b)return[Math.round(short*a/b/2)*2,short];return[short,Math.round(short*b/a/2)*2]}
function fitCanvas(){const wr=$('#cwrap'),W=wr.clientWidth-16,H=wr.clientHeight-16,[a,b]=ASPECTS[S.aspect];if(W<=0||H<=0)return;let w=W,h=W*b/a;if(h>H){h=H;w=H*a/b}cv.style.width=w+'px';cv.style.height=h+'px';cv.style.left=((wr.clientWidth-w)/2)+'px';cv.style.top=((wr.clientHeight-h)/2)+'px'}
function setCanvasSize(short){const[w,h]=dims(short);if(cv.width!==w||cv.height!==h){cv.width=w;cv.height=h}fitCanvas();dirty=true}
const RAMPS={slowmid:f=>1-.8*Math.pow(Math.sin(Math.PI*f),2),burst:f=>.25+1.75*Math.pow(Math.cos(Math.PI*f),2)*0+.25*0+ (1.6-1.35*Math.pow(Math.sin(Math.PI*f),2)),up:f=>.3+2.2*f*f,down:f=>2.5-2.2*Math.sqrt(f),pulse:f=>1+.9*Math.sin(f*Math.PI*4)};
function rampTab(c){const key=c.ramp+'|'+c.in+'|'+c.out+'|'+c.speed;if(c._rk===key)return c._rt;const N=120,span=c.out-c.in,fn=RAMPS[c.ramp],T=[0],F=[0];
  for(let i=0;i<N;i++){const f=(i+.5)/N,v=Math.max(.05,fn(f))*c.speed;T.push(T[i]+span/N/v)}
  c._rk=key;c._rt=T;return T}
function rampSpeedAt(c,t){const T=rampTab(c),N=T.length-1,lt=clamp(t-c._s,0,T[N]);let lo=0,hi=N;while(hi-lo>1){const m=(lo+hi)>>1;if(T[m]<=lt)lo=m;else hi=m}return Math.max(.05,RAMPS[c.ramp]((lo+.5)/N))*c.speed}
const cdur=c=>{if(c.ramp&&RAMPS[c.ramp]){const T=rampTab(c);return T[T.length-1]}return (c.out-c.in)/c.speed};
function layout(){let t=0;S.clips.forEach(c=>{c._s=t;t+=cdur(c)});total=t;return t}
function clipAt(t){for(let i=0;i<S.clips.length;i++){const c=S.clips[i];if(t<c._s+cdur(c)-1e-6)return i}return S.clips.length?S.clips.length-1:-1}
const arrOf=k=>k==='clip'?S.clips:k==='text'?S.texts:k==='sub'?S.subs:k==='ov'?S.overlays:S.audios;
const findObj=(k,id)=>arrOf(k).find(o=>o.id===id);

/* ---------- history ---------- */
const H={a:[],i:-1};
const snap=()=>JSON.stringify({aspect:S.aspect,clips:S.clips,texts:S.texts,subs:S.subs,audios:S.audios,overlays:S.overlays,subStyle:S.subStyle});
function commit(){setTimeout(autosave,0);const s=snap();if(H.a[H.i]===s)return;H.a=H.a.slice(0,H.i+1);H.a.push(s);if(H.a.length>100)H.a.shift();H.i=H.a.length-1;updUndo()}
function restore(s){const o=JSON.parse(s);Object.assign(S,{overlays:[]},o);S.sel=null;layout();S.playhead=clamp(S.playhead,0,total);setCanvasSize(quality);refreshAll();seekTo(S.playhead)}
function undo(){if(H.i>0){H.i--;restore(H.a[H.i]);updUndo()}}
function redo(){if(H.i<H.a.length-1){H.i++;restore(H.a[H.i]);updUndo()}}
function updUndo(){$('#undo').disabled=H.i<=0;$('#redo').disabled=H.i>=H.a.length-1;$('#undo').style.opacity=H.i<=0?.4:1;$('#redo').style.opacity=H.i>=H.a.length-1?.4:1}

/* ---------- audio graph (preview + export) ---------- */
let AC=null,monitor=null,aDest=null;const VIZ={on:false,st:'bars',color:'#19d3c5',pos:88,size:14},VZB=new Uint8Array(128),ENHN={},ENH={on:false,vol:100},DUCK={on:false,lvl:25};
function applyEnh(){if(!ENHN.hp)return;const o=ENH.on;ENHN.hp.frequency.value=o?90:10;ENHN.cmp.threshold.value=o?-30:0;ENHN.cmp.ratio.value=o?5:1;ENHN.cmp.knee.value=o?12:0;ENHN.mk.gain.value=(o?2.0:1)*ENH.vol/100}
function getAC(){if(!AC){AC=new (window.AudioContext||window.webkitAudioContext)();monitor=AC.createGain();monitor.connect(AC.destination);aDest=AC.createMediaStreamDestination();ENHN.in=AC.createGain();ENHN.hp=AC.createBiquadFilter();ENHN.hp.type='highpass';ENHN.cmp=AC.createDynamicsCompressor();ENHN.mk=AC.createGain();ENHN.in.connect(ENHN.hp);ENHN.hp.connect(ENHN.cmp);ENHN.cmp.connect(ENHN.mk);ENHN.mk.connect(monitor);ENHN.mk.connect(aDest);ENHN.an=AC.createAnalyser();ENHN.an.fftSize=256;ENHN.an.smoothingTimeConstant=.7;ENHN.mk.connect(ENHN.an);applyEnh();try{const o=AC.createOscillator(),g=AC.createGain();g.gain.value=0.0001;o.connect(g);g.connect(aDest);o.start()}catch(e){}}return AC}
function route(el){try{const ac=getAC();const s=ac.createMediaElementSource(el);s.connect(ENHN.in)}catch(e){console.warn('route',e)}}

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
function loadAsset(file,type,dur,fid){
  return new Promise((res,rej)=>{
    const a={id:fid||uid(),type,name:file.name||'ملف',file,url:URL.createObjectURL(file),dur:dur||0};
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
function defClip(aid){const a=assets[aid];return{id:uid(),aid,in:0,out:a.type==='image'?4:a.dur,speed:1,vol:100,mute:false,preset:'none',b:100,c:100,s:100,h:0,bl:0,vig:false,fit:'contain',bgblur:true,zoom:100,px:0,py:0,kb:0,fade:0,trans:'none',transD:.6,rot:0,flip:false,cl:0,cr:0,ct:0,cb:0,temp:0,tint:0,key:false,keyc:'#00b140',keyt:35,keys:14,keybg:'color',keybgc:'#1b1b3a',keyaid:''}}
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
  ctx.lineJoin='round';ctx.lineWidth=fs*.14*(o.stw==null?1:o.stw);ctx.strokeStyle=o.stc||'rgba(0,0,0,.9)';ctx.fillStyle=color;if(o.glow){ctx.shadowColor=o.glow;ctx.shadowBlur=fs*.5}
  if(o.kar){
    const rtl=ctx.direction==='rtl',allW=lines.join(' ').replace(/\s+/g,'').length||1;let acc=0;const cur=o.kar.p*allW;
    ctx.textAlign=rtl?'right':'left';const sp=ctx.measureText(' ').width;
    lines.forEach((l,i)=>{const y=(i-(lines.length-1)/2)*lh,ws=l.split(' ').filter(Boolean),wd=ws.map(x=>ctx.measureText(x).width),tw=wd.reduce((a,b)=>a+b,0)+sp*(ws.length-1);
      let x=rtl?tw/2:-tw/2;
      ws.forEach((wv,j)=>{const n=wv.length,act=cur>=acc&&cur<acc+n||(i===lines.length-1&&j===ws.length-1&&cur>=allW);acc+=n;
        ctx.fillStyle=act?o.kar.hc:(cur>=acc?o.kar.hc+'':color);if(cur>=acc&&!act)ctx.fillStyle=color;
        if(act){ctx.save();ctx.translate(rtl?x-wd[j]/2:x+wd[j]/2,y);ctx.scale(1.12,1.12);if(!bgColor){ctx.strokeStyle='rgba(0,0,0,.9)';ctx.lineWidth=fs*.14;ctx.strokeText(wv,rtl?wd[j]/2:-wd[j]/2,0)}ctx.fillText(wv,rtl?wd[j]/2:-wd[j]/2,0);ctx.restore()}
        else{if(!bgColor&&o.stroke!==false)ctx.strokeText(wv,x,y);ctx.fillText(wv,x,y)}
        x+=rtl?-(wd[j]+sp):(wd[j]+sp)})});
  }else
  lines.forEach((l,i)=>{const y=(i-(lines.length-1)/2)*lh;if(!bgColor&&o.stroke!==false)ctx.strokeText(l,0,y);ctx.fillText(l,0,y)});
  ctx.restore();return{w:bw,h:bh};
}
const easeOut=k=>1-Math.pow(1-k,3), easeBack=k=>{const c=1.70158+1;return 1+c*Math.pow(k-1,3)+1.70158*Math.pow(k-1,2)};
const bgc=document.createElement('canvas');
const snapC=document.createElement('canvas'),tmpC=document.createElement('canvas');let snapInfo={ci:-9,w:0};
const FXS={none:'بدون',shake:'اهتزاز',pulse:'نبض',glitch:'جليتش',vhs:'VHS قديم',grain:'حُبيبات فيلم',bars:'شريط سينمائي',flash:'وميض',rgb:'فصل RGB',bloom:'توهج',mirror:'مراية',zblur:'زووم بلر',strobe:'ستروب',scan:'شاشة CRT',flick:'فلاش قديم',vpulse:'فينييت نابض',quad:'4 مرايا'};
const rnd=(a,b)=>{const x=Math.sin(a*127.1+b*311.7)*43758.5453;return x-Math.floor(x)};
let grainC=null,_fxC=null;
function fxCopy(ctx,w,h){if(!_fxC)_fxC=document.createElement('canvas');if(_fxC.width!==w||_fxC.height!==h){_fxC.width=w;_fxC.height=h}const x=_fxC.getContext('2d');x.clearRect(0,0,w,h);x.drawImage(ctx.canvas,0,0);return _fxC}
function postFx(ctx,c,w,h,lt){
  const f=c.fx;if(!f||f==='none')return;const fr=Math.floor(lt*24),k=(c.fxs==null?60:c.fxs)/100;
  if(f==='glitch'){
    const on=rnd(fr>>1,3)<.45*k+.1;if(!on)return;const cp=fxCopy(ctx,w,h);
    const n=3+Math.floor(rnd(fr,1)*5);for(let i=0;i<n;i++){const y=rnd(fr,i)*h,bh=h*(.02+rnd(fr,i+9)*.08),dx=(rnd(fr,i+5)-.5)*w*.12*k*2;ctx.drawImage(cp,0,y,w,bh,dx,y,w,bh)}
    ctx.save();ctx.globalCompositeOperation='screen';ctx.globalAlpha=.55;const o=w*.012*(.5+k);ctx.drawImage(cp,o,0);ctx.fillStyle='rgba(255,0,60,.0)';ctx.restore();
    ctx.save();ctx.globalCompositeOperation='lighter';ctx.globalAlpha=.25;ctx.drawImage(cp,-o,0);ctx.restore();
  }else if(f==='vhs'){
    ctx.save();ctx.fillStyle='rgba(0,0,0,'+(.1+.15*k)+')';for(let y=0;y<h;y+=Math.max(3,h/180|0)*2)ctx.fillRect(0,y,w,Math.max(1.5,h/360));
    const by=((lt*.25)%1)*h;ctx.fillStyle='rgba(255,255,255,.07)';ctx.fillRect(0,by,w,h*.06);
    ctx.globalCompositeOperation='screen';ctx.fillStyle='rgba(60,0,90,.12)';ctx.fillRect(0,0,w,h);ctx.restore();
    const cp=fxCopy(ctx,w,h);ctx.save();ctx.globalAlpha=.4;ctx.drawImage(cp,w*.004*(1+k)+rnd(fr,2)*w*.004,0);ctx.restore();
  }else if(f==='grain'){
    if(!grainC){grainC=document.createElement('canvas');grainC.width=grainC.height=160;const g=grainC.getContext('2d'),im=g.createImageData(160,160);for(let i=0;i<im.data.length;i+=4){const v=Math.random()*255;im.data[i]=im.data[i+1]=im.data[i+2]=v;im.data[i+3]=255}g.putImageData(im,0,0)}
    ctx.save();ctx.globalAlpha=.08+.22*k;ctx.globalCompositeOperation='overlay';const ox=-rnd(fr,4)*160,oy=-rnd(fr,5)*160,sc=Math.max(1,w/640);for(let x=ox;x<w;x+=160*sc)for(let y=oy;y<h;y+=160*sc)ctx.drawImage(grainC,x,y,160*sc,160*sc);ctx.restore();
  }else if(f==='bars'){ctx.save();ctx.fillStyle='#000';const bh=h*.07+h*.08*k;ctx.fillRect(0,0,w,bh);ctx.fillRect(0,h-bh,w,bh);ctx.restore()}
  else if(f==='rgb'){const cp=fxCopy(ctx,w,h),o=w*.008*(.4+k*1.6)*(1+.5*Math.sin(lt*6));ctx.save();ctx.globalCompositeOperation='source-over';ctx.fillStyle='#000';ctx.fillRect(0,0,w,h);ctx.globalCompositeOperation='lighter';if(!window._rgbC)window._rgbC=document.createElement('canvas');const t=window._rgbC;if(t.width!==w||t.height!==h){t.width=w;t.height=h}const x=t.getContext('2d');const ch=(col,dx)=>{x.globalCompositeOperation='source-over';x.clearRect(0,0,w,h);x.drawImage(cp,0,0);x.globalCompositeOperation='multiply';x.fillStyle=col;x.fillRect(0,0,w,h);ctx.drawImage(t,dx,0)};ch('#ff0000',-o);ch('#00ff00',0);ch('#0000ff',o);ctx.restore()}
  else if(f==='bloom'){const cp=fxCopy(ctx,w,h);ctx.save();ctx.globalCompositeOperation='screen';ctx.globalAlpha=.25+.5*k;if(!window._blC)window._blC=document.createElement('canvas');const bc=window._blC,bw=Math.max(16,w>>2),bh2=Math.max(9,h>>2);if(bc.width!==bw||bc.height!==bh2){bc.width=bw;bc.height=bh2}const bx=bc.getContext('2d');bx.clearRect(0,0,bw,bh2);bx.filter=NOFILT()?'none':'blur('+Math.max(1,Math.round(bw*.012))+'px) brightness(1.25)';bx.drawImage(cp,0,0,bw,bh2);bx.filter='none';ctx.imageSmoothingEnabled=true;ctx.drawImage(bc,0,0,w,h);ctx.restore()}
  else if(f==='mirror'){const cp=fxCopy(ctx,w,h);ctx.save();ctx.translate(w,0);ctx.scale(-1,1);ctx.beginPath();ctx.rect(0,0,w/2,h);ctx.clip();ctx.drawImage(cp,0,0);ctx.restore()}
  else if(f==='zblur'){const cp=fxCopy(ctx,w,h);ctx.save();ctx.globalAlpha=.18;const n=5;for(let i=1;i<=n;i++){const s2=1+(.012+.03*k)*i;ctx.drawImage(cp,w/2-w*s2/2,h/2-h*s2/2,w*s2,h*s2)}ctx.restore()}
  else if(f==='strobe'){const on=Math.floor(lt*(6+8*k))%2===0;if(on){ctx.save();ctx.globalCompositeOperation='difference';ctx.fillStyle='#fff';ctx.globalAlpha=.9;ctx.fillRect(0,0,w,h);ctx.restore()}}
  else if(f==='scan'){ctx.save();const st=Math.max(2,Math.round(h/180));ctx.fillStyle='rgba(0,0,0,'+(.15+.35*k)+')';for(let y=0;y<h;y+=st*2)ctx.fillRect(0,y,w,st);const by=((lt*.25)%1)*h;const g=ctx.createLinearGradient(0,by-h*.08,0,by+h*.08);g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(.5,'rgba(255,255,255,'+(.06+.1*k)+')');g.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=g;ctx.fillRect(0,by-h*.08,w,h*.16);ctx.restore()}
  else if(f==='flick'){const a=(rnd(fr,11)-.5)*.5*k;ctx.save();ctx.fillStyle=a>0?'rgba(255,255,255,'+a+')':'rgba(0,0,0,'+(-a)+')';ctx.fillRect(0,0,w,h);if(rnd(fr,12)>.8){ctx.fillStyle='rgba(255,255,255,.5)';ctx.fillRect(rnd(fr,13)*w,0,Math.max(1,w*.002),h)}ctx.restore()}
  else if(f==='vpulse'){const a=(.35+.4*k)*(.6+.4*Math.sin(lt*4));const g=ctx.createRadialGradient(w/2,h/2,Math.min(w,h)*.25,w/2,h/2,Math.max(w,h)*.7);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(0,0,0,'+a+')');ctx.save();ctx.fillStyle=g;ctx.fillRect(0,0,w,h);ctx.restore()}
  else if(f==='quad'){const cp=fxCopy(ctx,w,h);ctx.save();ctx.beginPath();ctx.rect(0,0,w/2,h/2);ctx.clip();ctx.drawImage(cp,0,0);ctx.restore();ctx.save();ctx.translate(w,0);ctx.scale(-1,1);ctx.beginPath();ctx.rect(0,0,w/2,h/2);ctx.clip();ctx.drawImage(cp,0,0);ctx.restore();ctx.save();ctx.translate(0,h);ctx.scale(1,-1);ctx.beginPath();ctx.rect(0,0,w/2,h/2);ctx.clip();ctx.drawImage(cp,0,0);ctx.restore();ctx.save();ctx.translate(w,h);ctx.scale(-1,-1);ctx.beginPath();ctx.rect(0,0,w/2,h/2);ctx.clip();ctx.drawImage(cp,0,0);ctx.restore()}
  else if(f==='flash'){const ph=(lt%1.2)/1.2;const a=Math.max(0,1-ph*6)*.7*k+0;if(a>0.01){ctx.save();ctx.fillStyle='rgba(255,255,255,'+a+')';ctx.fillRect(0,0,w,h);ctx.restore()}}
}
function drawViz(ctx,w,h){
  const an=ENHN.an;an.getByteFrequencyData(VZB);const n=48,hh=h*VIZ.size/100,y0=h*VIZ.pos/100;ctx.save();ctx.fillStyle=VIZ.color;ctx.strokeStyle=VIZ.color;
  const lv=i=>{let v=0;const a=Math.floor(i*VZB.length*.7/n),b=Math.max(a+1,Math.floor((i+1)*VZB.length*.7/n));for(let k=a;k<b;k++)v=Math.max(v,VZB[k]);return v/255};
  if(VIZ.st==='bars'){const bw=w*.7/n;for(let i=0;i<n;i++){const v=Math.max(.04,lv(i)),bh=v*hh;rrect(ctx,w*.15+i*bw+bw*.12,y0-bh,bw*.76,bh,bw*.3);ctx.fill()}}
  else if(VIZ.st==='wave'){ctx.lineWidth=Math.max(2,h*.006);ctx.lineCap='round';ctx.beginPath();for(let i=0;i<n;i++){const x=w*.15+i*w*.7/(n-1),y=y0-Math.max(.03,lv(i))*hh*(i%2?1:-.6);i?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.stroke()}
  else{const cx0=w/2,cy0=y0-hh*.3,r=Math.min(w,h)*.12,m=64;for(let i=0;i<m;i++){const v=Math.max(.04,lv(i%n)),a=i/m*Math.PI*2,l=v*hh*.8;ctx.lineWidth=Math.max(2,w*.004);ctx.beginPath();ctx.moveTo(cx0+Math.cos(a)*r,cy0+Math.sin(a)*r);ctx.lineTo(cx0+Math.cos(a)*(r+l),cy0+Math.sin(a)*(r+l));ctx.stroke()}}
  ctx.restore();
}
const keyC=document.createElement('canvas'),mC=document.createElement('canvas');
function keyRGB(hex){return[parseInt(hex.slice(1,3),16),parseInt(hex.slice(3,5),16),parseInt(hex.slice(5,7),16)]}
function drawKeyed(ctx,c,a,w,h,t){
  if(keyC.width!==w||keyC.height!==h){keyC.width=w;keyC.height=h}const kx=keyC.getContext('2d');kx.clearRect(0,0,w,h);
  drawClipLayer(kx,Object.assign({},c,{key:false,bgblur:false,fade:0}),a,w,h,t);
  const mw=Math.min(w,640),mh=Math.max(1,Math.round(h*mw/w));if(mC.width!==mw||mC.height!==mh){mC.width=mw;mC.height=mh}const mx=mC.getContext('2d',{willReadFrequently:true});mx.clearRect(0,0,mw,mh);mx.drawImage(keyC,0,0,mw,mh);
  const im=mx.getImageData(0,0,mw,mh),d=im.data,[kr,kg,kb]=keyRGB(c.keyc||'#00b140');
  const kcb=-.169*kr-.331*kg+.5*kb,kcr=.5*kr-.419*kg-.081*kb,tol=(c.keyt==null?35:c.keyt),soft=Math.max(1,c.keys==null?14:c.keys),t2=tol*tol,e2=(tol+soft)*(tol+soft);
  for(let i=0;i<d.length;i+=4){
    const a0=d[i+3];if(a0===0)continue;const r=d[i],g=d[i+1],bl=d[i+2];
    const cb=-.169*r-.331*g+.5*bl-kcb,cr=.5*r-.419*g-.081*bl-kcr,q=cb*cb+cr*cr;
    let al=q<=t2?0:q>=e2?1:(Math.sqrt(q)-tol)/soft;
    d[i]=d[i+1]=d[i+2]=0;d[i+3]=a0*al;
  }
  mx.putImageData(im,0,0);kx.save();kx.globalCompositeOperation='destination-in';kx.imageSmoothingEnabled=true;kx.imageSmoothingQuality='medium';kx.drawImage(mC,0,0,w,h);kx.restore();
  const bga=c.keybg==='image'&&assets[c.keyaid];
  if(bga&&bga.img){const k=Math.max(w/bga.w,h/bga.h);ctx.drawImage(bga.img,(w-bga.w*k)/2,(h-bga.h*k)/2,bga.w*k,bga.h*k)}
  else if(c.keybg==='grad'){const g=ctx.createLinearGradient(0,0,w,h);g.addColorStop(0,'#7c5cff');g.addColorStop(1,'#19d3c5');ctx.fillStyle=g;ctx.fillRect(0,0,w,h)}
  else{ctx.fillStyle=c.keybgc||'#1b1b3a';ctx.fillRect(0,0,w,h)}
  const lt=clamp(t-c._s,0,cdur(c)),dd=cdur(c);let fa=1;if(c.fade>0)fa=Math.min(1,lt/c.fade,(dd-lt)/c.fade);
  ctx.globalAlpha=fa;ctx.drawImage(keyC,0,0);ctx.globalAlpha=1;
}

/* ===== R46: canvas filter fallback for browsers without ctx.filter (iOS Safari) ===== */
let _nof=null;function NOFILT(){if(window.__forceNoFilter)return true;if(_nof===null){try{const x=document.createElement('canvas').getContext('2d');_nof=!('filter' in x)}catch(e){_nof=false}}return _nof}
let _tl=null;function tmpLayer(w,h){if(!_tl)_tl=document.createElement('canvas');if(_tl.width!==w||_tl.height!==h){_tl.width=w;_tl.height=h}const x=_tl.getContext('2d');x.setTransform(1,0,0,1,0,0);x.globalAlpha=1;x.globalCompositeOperation='source-over';x.clearRect(0,0,w,h);return x}
let _bl=null;
function pixFilter(ctx,f,w,h){
  const ops=[];f.replace(/([a-z-]+)\(([-\d.]+)(%|px|deg)?\)/g,(m,n,v,u)=>{ops.push([n,+v,u])});
  const bl=ops.find(o=>o[0]==='blur');
  if(bl&&bl[1]>0){const sc=Math.max(.05,1/(1+bl[1]*.6));if(!_bl)_bl=document.createElement('canvas');const bw=Math.max(8,Math.round(w*sc)),bh=Math.max(8,Math.round(h*sc));_bl.width=bw;_bl.height=bh;const bx=_bl.getContext('2d');bx.imageSmoothingQuality='high';bx.clearRect(0,0,bw,bh);bx.drawImage(ctx.canvas,0,0,bw,bh);ctx.clearRect(0,0,w,h);ctx.imageSmoothingQuality='high';ctx.drawImage(_bl,0,0,w,h)}
  const px=ops.filter(o=>o[0]!=='blur');if(!px.length)return;
  const im=ctx.getImageData(0,0,w,h),d=im.data;
  for(let i=0;i<d.length;i+=4){if(!d[i+3])continue;let r=d[i]/255,g=d[i+1]/255,b=d[i+2]/255;
    for(const [n,v,u] of px){const p=u==='%'?v/100:v;
      if(n==='brightness'){r*=p;g*=p;b*=p}
      else if(n==='contrast'){r=(r-.5)*p+.5;g=(g-.5)*p+.5;b=(b-.5)*p+.5}
      else if(n==='saturate'){const l=.2126*r+.7152*g+.0722*b;r=l+(r-l)*p;g=l+(g-l)*p;b=l+(b-l)*p}
      else if(n==='grayscale'){const l=.2126*r+.7152*g+.0722*b,q=Math.min(1,p);r+=(l-r)*q;g+=(l-g)*q;b+=(l-b)*q}
      else if(n==='sepia'){const q=Math.min(1,p),R=.393*r+.769*g+.189*b,G=.349*r+.686*g+.168*b,B=.272*r+.534*g+.131*b;r+=(R-r)*q;g+=(G-g)*q;b+=(B-b)*q}
      else if(n==='invert'){const q=Math.min(1,p);r+=((1-r)-r)*q;g+=((1-g)-g)*q;b+=((1-b)-b)*q}
      else if(n==='hue-rotate'){const a=v*Math.PI/180,co=Math.cos(a),si=Math.sin(a);const R=r*(.213+co*.787-si*.213)+g*(.715-co*.715-si*.715)+b*(.072-co*.072+si*.928),G=r*(.213-co*.213+si*.143)+g*(.715+co*.285+si*.140)+b*(.072-co*.072-si*.283),B=r*(.213-co*.213-si*.787)+g*(.715-co*.715+si*.715)+b*(.072+co*.928+si*.072);r=R;g=G;b=B}
      r=r<0?0:r>1?1:r;g=g<0?0:g>1?1:g;b=b<0?0:b>1?1:b}
    d[i]=r*255;d[i+1]=g*255;d[i+2]=b*255}
  ctx.putImageData(im,0,0)}
function drawClipLayer(ctx,c,a,w,h,t){
  if(c.key&&a.type!=='audio'&&!drawClipLayer.raw){drawKeyed(ctx,c,a,w,h,t);return}
  const isImg=a.type==='image',src=isImg?a.img:a.el;
  if(!src||(!isImg&&a.el.readyState<2))return;
  const sw0=isImg?a.w:a.el.videoWidth,sh0=isImg?a.h:a.el.videoHeight;if(!sw0||!sh0)return;
  const cl=(c.cl||0)/100,cr_=(c.cr||0)/100,ct=(c.ct||0)/100,cb_=(c.cb||0)/100,csx=sw0*cl,csy=sh0*ct,csw=Math.max(8,sw0*(1-cl-cr_)),csh=Math.max(8,sh0*(1-ct-cb_));
  const odd=(c.rot||0)%2===1,sw=odd?csh:csw,sh=odd?csw:csh;
  const lt=clamp(t-c._s,0,cdur(c)),d=cdur(c);
  let fa=1;if(c.fade>0){fa=Math.min(1,lt/c.fade,(d-lt)/c.fade)}
  const cover=Math.max(w/sw,h/sh);let sc=c.fit==='cover'?cover:Math.min(w/sw,h/sh);
  const rot=(c.rot||0)*Math.PI/2,fl=c.flip?-1:1;
  if(c.fit!=='cover'&&c.bgblur&&Math.abs(sc-cover)>0.01){
    const bw=Math.max(16,w>>4),bh=Math.max(16,h>>4);bgc.width=bw;bgc.height=bh;const bx=bgc.getContext('2d'),s2=Math.max(bw/sw,bh/sh);
    bx.translate(bw/2,bh/2);bx.rotate(rot);bx.scale(fl,1);bx.drawImage(src,-sw0*s2/2,-sh0*s2/2,sw0*s2,sh0*s2);
    ctx.globalAlpha=fa;ctx.imageSmoothingQuality='high';if(NOFILT()){ctx.drawImage(bgc,0,0,w,h);ctx.fillStyle='rgba(0,0,0,.45)';ctx.fillRect(0,0,w,h)}else{ctx.filter='brightness(55%)';ctx.drawImage(bgc,0,0,w,h);ctx.filter='none'}ctx.globalAlpha=1;
  }
  let z=(c.zoom||100)/100;if(c.kb)z*=1+(c.kb/100)*(lt/d);if(c.pz){const pi=c.pi||3,sg=Math.floor(lt/pi),ph=lt-sg*pi,tgt=sg%2,e=easeOut(Math.min(1,ph/.18));z*=1+c.pz/100*(sg===0?(tgt?e:0):(tgt?e:1-e))}let shx=0,shy=0;if(c.fx==='pulse'){const ph=(lt*2)%1;z*=1+.06*((c.fxs==null?60:c.fxs)/60)*Math.exp(-ph*5)}else if(c.fx==='shake'){const fr=Math.floor(lt*30),m=(c.fxs==null?60:c.fxs)/100;shx=(rnd(fr,1)-.5)*w*.025*m;shy=(rnd(fr,2)-.5)*h*.025*m;z*=1+.03*m}sc*=z;
  const _f=filterStr(c,w);let _real=null;if(NOFILT()&&_f!=='none'){_real=ctx;ctx=tmpLayer(w,h)}
  ctx.save();ctx.globalAlpha=fa;ctx.filter=_real?'none':_f;
  if(c.mask&&c.mask!=='none'){const m=Math.min(w,h)*(c.msz==null?80:c.msz)/100,mx=w/2+(c.mx||0)/100*w,my=h/2+(c.my||0)/100*h;ctx.beginPath();
    if(c.mask==='circle')ctx.arc(mx,my,m/2,0,7);else if(c.mask==='square')rrect(ctx,mx-m/2,my-m/2,m,m,m*.12);else if(c.mask==='wide')rrect(ctx,mx-m*.8,my-m*.45,m*1.6,m*.9,m*.1);else if(c.mask==='diamond'){ctx.moveTo(mx,my-m/2);ctx.lineTo(mx+m/2,my);ctx.lineTo(mx,my+m/2);ctx.lineTo(mx-m/2,my);ctx.closePath()}
    else if(c.mask==='heart'){const r=m/2;ctx.moveTo(mx,my+r*.9);ctx.bezierCurveTo(mx-r*1.5,my+r*.1,mx-r*.9,my-r*.9,mx,my-r*.35);ctx.bezierCurveTo(mx+r*.9,my-r*.9,mx+r*1.5,my+r*.1,mx,my+r*.9)}
    ctx.clip()}
  ctx.translate(w/2+(c.px||0)/100*w+shx,h/2+(c.py||0)/100*h+shy);ctx.rotate(rot);ctx.scale(fl,1);
  ctx.drawImage(src,csx,csy,csw,csh,-csw*sc/2,-csh*sc/2,csw*sc,csh*sc);ctx.restore();ctx.filter='none';
  if(_real){pixFilter(ctx,_f,w,h,fa);_real.drawImage(ctx.canvas,0,0);ctx=_real}
  {const pp=PRESETS[c.preset];if(pp&&pp.tc){ctx.save();ctx.globalCompositeOperation='soft-light';ctx.globalAlpha=pp.ta||.3;ctx.fillStyle=pp.tc;ctx.fillRect(0,0,w,h);ctx.restore()}}
  if(c.temp||c.tint){ctx.save();ctx.globalCompositeOperation='soft-light';if(c.temp){ctx.globalAlpha=Math.min(1,Math.abs(c.temp)/100*.9);ctx.fillStyle=c.temp>0?'#ff9a1f':'#1f8bff';ctx.fillRect(0,0,w,h)}if(c.tint){ctx.globalAlpha=Math.min(1,Math.abs(c.tint)/100*.8);ctx.fillStyle=c.tint>0?'#ff2fb4':'#22e07a';ctx.fillRect(0,0,w,h)}ctx.restore()}
  postFx(ctx,c,w,h,lt);
  if(c.vig){const g=ctx.createRadialGradient(w/2,h/2,Math.min(w,h)*.3,w/2,h/2,Math.max(w,h)*.75);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(0,0,0,.75)');ctx.fillStyle=g;ctx.fillRect(0,0,w,h)}
  ctx.globalAlpha=1;
}
function drawFrame(ctx,w,h,t,opt={}){
  ctx.save();ctx.fillStyle='#000';ctx.fillRect(0,0,w,h);
  const ci=clipAt(t);
  if(ci>=0){
    const c=S.clips[ci],a=assets[c.aid];
    if(a){
      const lt=clamp(t-c._s,0,cdur(c)),d=cdur(c);
      const tr=c.trans&&c.trans!=='none'&&ci>0&&lt<c.transD&&snapInfo.ci===ci-1&&snapInfo.w===w&&snapC.width===w;
      if(!tr)drawClipLayer(ctx,c,a,w,h,t);
      else{
        tmpC.width=w;tmpC.height=h;const tx=tmpC.getContext('2d');tx.fillStyle='#000';tx.fillRect(0,0,w,h);drawClipLayer(tx,c,a,w,h,t);
        const k=easeOut(lt/c.transD);ctx.drawImage(snapC,0,0);
        if(c.trans==='fade'){ctx.globalAlpha=k;ctx.drawImage(tmpC,0,0);ctx.globalAlpha=1}
        else if(c.trans==='dip'){ctx.globalAlpha=1;if(k<.5){ctx.globalAlpha=1-k*2;ctx.fillStyle='#000';ctx.globalAlpha=k*2;ctx.fillRect(0,0,w,h);ctx.globalAlpha=1}else{ctx.fillStyle='#000';ctx.fillRect(0,0,w,h);ctx.globalAlpha=(k-.5)*2;ctx.drawImage(tmpC,0,0);ctx.globalAlpha=1}}
        else if(c.trans==='slide'){ctx.drawImage(tmpC,w*(1-k),0)}
        else if(c.trans==='wipe'){ctx.save();ctx.beginPath();ctx.rect(0,0,w*k,h);ctx.clip();ctx.drawImage(tmpC,0,0);ctx.restore();ctx.fillStyle='#fff';ctx.fillRect(w*k-2,0,4,h)}
        else if(c.trans==='circle'){ctx.save();ctx.beginPath();ctx.arc(w/2,h/2,Math.hypot(w,h)/2*k,0,7);ctx.clip();ctx.drawImage(tmpC,0,0);ctx.restore()}
        else if(c.trans==='blinds'){ctx.save();ctx.beginPath();const n=8,bw=w/n;for(let i=0;i<n;i++)ctx.rect(i*bw,0,bw*k,h);ctx.clip();ctx.drawImage(tmpC,0,0);ctx.restore()}
        else if(c.trans==='pixel'){const f=Math.max(2,Math.round(60*(1-Math.abs(k*2-1))+2));const sw=Math.max(1,Math.round(w/f)),sh=Math.max(1,Math.round(h/f));const pc=document.createElement('canvas');pc.width=sw;pc.height=sh;const px=pc.getContext('2d');px.drawImage(k<.5?snapC:tmpC,0,0,sw,sh);ctx.imageSmoothingEnabled=false;ctx.drawImage(pc,0,0,w,h);ctx.imageSmoothingEnabled=true}
        else if(c.trans==='spin'){ctx.globalAlpha=k;ctx.save();ctx.translate(w/2,h/2);ctx.rotate((1-k)*1.2);const s2=.6+.4*k;ctx.scale(s2,s2);ctx.drawImage(tmpC,-w/2,-h/2);ctx.restore();ctx.globalAlpha=1}
        else if(c.trans==='flashw'){const a2=1-Math.abs(k*2-1);if(k<.5){}else{ctx.drawImage(tmpC,0,0)}ctx.fillStyle='#fff';ctx.globalAlpha=Math.min(1,a2*1.3);ctx.fillRect(0,0,w,h);ctx.globalAlpha=1}
        else if(c.trans==='diag'){ctx.save();ctx.beginPath();const o=(w+h)*k;ctx.moveTo(0,0);ctx.lineTo(o,0);ctx.lineTo(o-h,h);ctx.lineTo(0,h);ctx.closePath();ctx.clip();ctx.drawImage(tmpC,0,0);ctx.restore()}
        else if(c.trans==='split'){ctx.save();ctx.beginPath();ctx.rect(0,h/2-h*k/2,w,h*k);ctx.clip();ctx.drawImage(tmpC,0,0);ctx.restore()}
        else if(c.trans==='zout'){ctx.globalAlpha=k;const s=.6+.4*k;ctx.drawImage(tmpC,w/2-w*s/2,h/2-h*s/2,w*s,h*s);ctx.globalAlpha=1}
        else if(c.trans==='glitcht'){const n=10;for(let i=0;i<n;i++){const y0=i*h/n,use=rnd(i+Math.floor(k*12),21)<k;ctx.drawImage(use?tmpC:snapC,0,y0,w,h/n,(rnd(i,Math.floor(k*9))-.5)*w*.08*(1-k),y0,w,h/n)}}
        else if(c.trans==='push'){ctx.drawImage(snapC,0,-h*k);ctx.drawImage(tmpC,0,h*(1-k))}
        else if(c.trans==='zoom'){ctx.globalAlpha=k;const s=1.5-.5*k;ctx.drawImage(tmpC,w/2-w*s/2,h/2-h*s/2,w*s,h*s);ctx.globalAlpha=1}
        else ctx.drawImage(tmpC,0,0);
      }
      if(!opt.nosnap&&d-lt<.35){snapC.width=w;snapC.height=h;snapC.getContext('2d').drawImage(ctx.canvas,0,0);snapInfo={ci,w}}
    }
  }
  S.overlays.forEach(ov=>{
    if(t<ov.start||t>ov.end)return;const a=assets[ov.aid];if(!a||(!a.img&&a.type!=='video'))return;const vel=a.type==='video'?ovEl(ov):null;if(a.type==='video'&&(!vel||vel.readyState<2))return;const lt=t-ov.start,d=Math.max(.1,ov.end-ov.start);
    let al=ov.opacity/100,sc=1;if(ov.anim==='fade')al*=Math.min(1,lt/.4,(d-lt)/.4);else if(ov.anim==='pop'){sc=.5+.5*easeBack(Math.min(1,lt/.35));al*=Math.min(1,lt/.1,(d-lt)/.2)}else if(ov.anim==='float')sc=1+Math.sin(lt*3)*.04;
    const dw=w*ov.size/100*sc,dh=dw*a.h/a.w;ctx.save();ctx.globalAlpha=clamp(al,0,1);ctx.translate(ov.x*w,ov.y*h);ctx.rotate((ov.rot||0)*Math.PI/180);if(ov.rad){rrect(ctx,-dw/2,-dh/2,dw,dh,Math.min(dw,dh)*ov.rad/100);ctx.save();ctx.clip()}ctx.drawImage(vel||a.img,-dw/2,-dh/2,dw,dh);if(ov.rad)ctx.restore();if(ov.bd){ctx.lineWidth=Math.max(1,dw*ov.bd/200);ctx.strokeStyle='#fff';if(ov.rad)rrect(ctx,-dw/2,-dh/2,dw,dh,Math.min(dw,dh)*ov.rad/100);else{ctx.beginPath();ctx.rect(-dw/2,-dh/2,dw,dh)}ctx.stroke()}ctx.restore();
  });
  if(VIZ.on&&ENHN.an)drawViz(ctx,w,h);
  S.texts.forEach(tx=>{
    if(t<tx.start||t>tx.end)return;const lt=t-tx.start,d=Math.max(.1,tx.end-tx.start);let alpha=1,sc=1,dy=0,xo=0,txt=tx.text;
    if(tx.anim==='fade')alpha=Math.min(1,lt/.4,(d-lt)/.4);
    else if(tx.anim==='pop'){sc=.55+.45*easeBack(Math.min(1,lt/.35));alpha=Math.min(1,lt/.12,(d-lt)/.25)}
    else if(tx.anim==='slide'){dy=(1-easeOut(Math.min(1,lt/.45)))*h*.1;alpha=Math.min(1,lt/.3,(d-lt)/.3)}
    else if(tx.anim==='words'){const ws=tx.text.split(' ');txt=ws.slice(0,Math.max(1,Math.ceil(ws.length*Math.min(1,lt/(d*.6))))).join(' ');alpha=Math.min(1,(d-lt)/.25)}
    else if(tx.anim==='zoom'){const k=easeOut(Math.min(1,lt/.5));sc=2.2-1.2*k;alpha=Math.min(k*1.5,1,(d-lt)/.25)}
    else if(tx.anim==='bounce'){const k=Math.min(1,lt/.7);dy=-Math.abs(Math.sin(k*Math.PI*3))*(1-k)*h*.14;alpha=Math.min(1,lt/.1,(d-lt)/.25)}
    else if(tx.anim==='float'){dy=Math.sin(lt*2.4)*h*.012;alpha=Math.min(1,lt/.3,(d-lt)/.3)}
    else if(tx.anim==='marquee'){xo=w*(.95-1.9*Math.min(1,lt/d));alpha=1}
    else if(tx.anim==='rise'){const k=easeOut(Math.min(1,lt/.6));dy=(1-k)*h*.18;alpha=Math.min(k,(d-lt)/.25)}
    else if(tx.anim==='shake'){const fr=Math.floor(lt*28);xo=(rnd(fr,7)-.5)*w*.012;dy=(rnd(fr,8)-.5)*h*.012;alpha=Math.min(1,lt/.1,(d-lt)/.2)}
    else if(tx.anim==='blink'){alpha=Math.floor(lt*2.5)%2===0?1:.15;alpha=Math.min(alpha,(d-lt)/.2+.0)}
    else if(tx.anim==='drop'){const k=Math.min(1,lt/.55);dy=-(1-k)*(1-k)*h*.4;alpha=Math.min(1,lt/.1,(d-lt)/.25);if(k>.85&&k<1)sc=1+.08*Math.sin((k-.85)/.15*Math.PI)}
    else if(tx.anim==='type'){txt=[...tx.text].slice(0,Math.ceil([...tx.text].length*Math.min(1,lt/(d*.55)))).join('')}
    if(!txt)return;
    drawCaption(ctx,w,h,txt,tx.x*w+xo,tx.y*h,tx.size,tx.color,tx.bgOn?tx.bg:null,{alpha,sc,dy,weight:tx.weight,stc:tx.stc,stw:tx.stw,glow:tx.glow});
  });
  if(opt.subs!==false&&S.subStyle.burn){
    const sub=S.subs.find(s=>t>=s.s&&t<=s.e);
    if(sub&&sub.t)drawCaption(ctx,w,h,sub.t,w/2,S.subStyle.pos/100*h,S.subStyle.size,S.subStyle.color,S.subStyle.bg?'rgba(0,0,0,.62)':null,{clamp:true,weight:700,stc:S.subStyle.stc,stw:S.subStyle.stw,glow:S.subStyle.glow,kar:S.subStyle.kar?{p:clamp((t-sub.s)/Math.max(.2,sub.e-sub.s),0,1),hc:S.subStyle.khc||'#ffe14d'}:null});
  }
  ctx.restore();
}
let _jit=0;
function render(){drawFrame(cx,cv.width,cv.height,S.playhead);if(P.exporting){_jit^=1;cx.fillStyle=_jit?'rgba(0,0,0,.02)':'rgba(255,255,255,.02)';cx.fillRect(0,0,2,2)}$('#empty').classList.toggle('hide',S.clips.length>0)}

/* ---------- player ---------- */
const P={playing:false,t0:0,w0:0,active:-2,exporting:false,onEnd:null};
function stopMedia(){OVEL.forEach(e=>{if(!e.paused)e.pause()});Object.values(assets).forEach(a=>{if(a.el&&!a.el.paused)a.el.pause()})}
function srcTime(c,t){if(c.ramp&&RAMPS[c.ramp]){const T=rampTab(c),N=T.length-1,lt=clamp(t-c._s,0,T[N]);let lo=0,hi=N;while(hi-lo>1){const m=(lo+hi)>>1;if(T[m]<=lt)lo=m;else hi=m}const fr=(lt-T[lo])/Math.max(1e-9,T[lo+1]-T[lo]);return c.in+(c.out-c.in)*(lo+fr)/N}return c.in+(t-c._s)*c.speed}
function startClip(i,t){
  const c=S.clips[i],a=c&&assets[c.aid];if(!a||a.type!=='video')return;const el=a.el;
  el.playbackRate=clamp(c.ramp&&RAMPS[c.ramp]?rampSpeedAt(c,t):c.speed,.0625,16);el.volume=c.mute?0:clamp(c.vol/100,0,1);
  const want=srcTime(c,t);if(Math.abs(el.currentTime-want)>.05)el.currentTime=want;
  if(P.playing)el.play().catch(()=>{});
}
function syncMedia(t){
  const ci=clipAt(t);
  if(ci!==P.active){P.active=ci;const cur=ci>=0&&assets[S.clips[ci].aid];Object.values(assets).forEach(a=>{if(a.type==='video'&&a!==cur&&a.el&&!a.el.paused)a.el.pause()});if(ci>=0)startClip(ci,t)}
  else if(ci>=0){const c=S.clips[ci],a=assets[c.aid];if(a&&a.type==='video'){const want=srcTime(c,t);if(c.ramp&&RAMPS[c.ramp])a.el.playbackRate=clamp(rampSpeedAt(c,t),.0625,16);if(Math.abs(a.el.currentTime-want)>(c.ramp?.25:.4)&&!a.el.seeking){a.el.currentTime=want}if(a.el.paused&&P.playing&&!a.el.seeking)a.el.play().catch(()=>{})}}
  S.overlays.forEach(ov=>{const e=ovEl(ov);if(!e)return;const inr=t>=ov.start&&t<=ov.end,want=(ov.in||0)+(t-ov.start);
    if(inr&&P.playing){if(e.paused){try{e.currentTime=want}catch(x){}e.play().catch(()=>{})}else if(Math.abs(e.currentTime-want)>.4)e.currentTime=want}else if(!e.paused)e.pause()});
  S.audios.forEach(u=>{const a=assets[u.aid];if(!a||!a.el)return;const d=u.out-u.in,inr=t>=u.start&&t<u.start+d;
    if(inr&&P.playing){const lt=t-u.start;let f=1;if(u.fi>0)f=Math.min(f,lt/u.fi);if(u.fo>0)f=Math.min(f,(d-lt)/u.fo);if(DUCK.on&&ci>=0&&u.aid!==S.clips[ci].aid){const cc=S.clips[ci],ca=assets[cc.aid];if(ca&&ca.type==='video'&&!cc.mute&&cc.vol>5)f*=DUCK.lvl/100}a.el.volume=clamp(u.vol/100*clamp(f,0,1),0,1);const want=u.in+(t-u.start);if(a.el.paused){a.el.currentTime=want;a.el.play().catch(()=>{})}else if(Math.abs(a.el.currentTime-want)>.4)a.el.currentTime=want}
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
  S.overlays.forEach(ov=>{const e=ovEl(ov);if(e&&!P.playing&&S.playhead>=ov.start&&S.playhead<=ov.end){e.onseeked=()=>{dirty=true};try{e.currentTime=(ov.in||0)+S.playhead-ov.start}catch(x){}}});
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
function select(k,id){S.sel=k?{k,id}:null;if(k){S.tab={clip:'fx',text:'text',sub:'subs',audio:'audio',ov:'ov'}[k]||S.tab}refreshAll()}
function selObj(){return S.sel?findObj(S.sel.k,S.sel.id):null}
function splitAt(){
  const t=S.playhead;
  if(S.sel&&S.sel.k==='text'){const x=selObj();if(x&&t>x.start+.2&&t<x.end-.2){const y={...x,id:uid(),start:t};x.end=t;S.texts.push(y);commit();refreshAll();return}}
  const i=clipAt(t);if(i<0)return;const c=S.clips[i];const lt=t-c._s;
  if(lt<.15||cdur(c)-lt<.15){toast('حرّك المؤشر لنقطة جوه المقطع');return}
  const s=srcTime(c,t);const rp=c.ramp;const n={...c,id:uid(),in:s,fade:0};c.out=s;if(rp){c.ramp=n.ramp=undefined;toast('اتشالت السرعة المتغيرة من القطعتين بعد القص')}c.fade=0;S.clips.splice(i+1,0,n);layout();S.sel={k:'clip',id:n.id};commit();refreshAll();seekTo(t);
}
function delSel(){
  if(!S.sel)return;const{k,id}=S.sel;const arr=arrOf(k);const i=arr.findIndex(o=>o.id===id);if(i<0)return;
  arr.splice(i,1);S.sel=null;layout();S.playhead=clamp(S.playhead,0,total);commit();refreshAll();seekTo(S.playhead);
}
function dupSel(){
  const o=selObj();if(!o)return;const{k}=S.sel;const n={...o,id:uid()};
  if(k==='clip'){S.clips.splice(S.clips.indexOf(o)+1,0,n);layout()}else if(k==='text'){const d=o.end-o.start;n.start=o.end;n.end=o.end+d;S.texts.push(n)}else if(k==='audio'){n.start=o.start+(o.out-o.in);S.audios.push(n)}else if(k==='ov'){const d=o.end-o.start;n.start=o.end;n.end=o.end+d;S.overlays.push(n)}else if(k==='sub'){const d=o.e-o.s;n.s=o.e;n.e=o.e+d;S.subs.push(n);S.subs.sort((a,b)=>a.s-b.s)}
  S.sel={k,id:n.id};commit();refreshAll();
}
function addText(txt){
  const t=S.playhead,tx={id:uid(),text:txt||'اكتب النص هنا',start:t,end:t+3,x:.5,y:.5,size:9,color:'#ffffff',bgOn:false,bg:'#000000',anim:'pop',weight:900};
  S.texts.push(tx);S.sel={k:'text',id:tx.id};S.tab='text';commit();refreshAll();return tx;
}
const OVEL=new Map();
function ovEl(ov){const a=assets[ov.aid];if(!a||a.type!=='video')return null;let e=OVEL.get(ov.id);if(!e||e.src!==a.url){e=document.createElement('video');e.muted=true;e.playsInline=true;e.preload='auto';e.src=a.url;OVEL.set(ov.id,e)}return e}
function addOverlay(aid){const A=assets[aid],t=S.playhead,vid=A&&A.type==='video',o={id:uid(),aid,start:t,end:t+(vid?Math.min(A.dur,10):4),x:vid?.8:.85,y:vid?.7:.15,size:vid?32:18,opacity:100,anim:vid?'fade':'pop',rot:0,in:0,rad:vid?10:0,bd:vid?3:0};S.overlays.push(o);S.sel={k:'ov',id:o.id};S.tab='ov';commit();refreshAll()}
function addSub(){const t=S.playhead,s={id:uid(),s:t,e:t+2.5,t:'سطر ترجمة جديد'};S.subs.push(s);S.subs.sort((a,b)=>a.s-b.s);S.sel={k:'sub',id:s.id};S.tab='subs';commit();refreshAll()}
function addAudioClip(aid){const a=assets[aid];S.audios.push({id:uid(),aid,start:S.playhead,in:0,out:a.dur,vol:100,fi:0,fo:0});S.sel={k:'audio',id:S.audios[S.audios.length-1].id};S.tab='audio';commit();refreshAll()}

/* ---------- timeline ---------- */
const inner=$('#tlInner');
function renderTL(){
  layout();const pps=S.pps,W=Math.max((total+8)*pps,$('#tlScroll').clientWidth-2);inner.style.width=W+'px';
  const step=pps>=100?1:pps>=50?2:pps>=25?5:pps>=12?10:30;let rh='';for(let t=0;t*pps<W;t+=step)rh+=`<i style="left:${t*pps}px">${fmtS(t)}</i>`;$('#ruler').innerHTML=rh;
  const sel=(k,id)=>S.sel&&S.sel.k===k&&S.sel.id===id?' sel':'';
  $('#trV').innerHTML=S.clips.map(c=>{const a=assets[c.aid]||{};return`<div class="blk clip${a.type==='image'?' img':''}${sel('clip',c.id)}" data-k="clip" data-id="${c.id}" style="left:${c._s*pps}px;width:${Math.max(6,cdur(c)*pps)}px;${a.thumb?`background-image:url(${a.thumb})`:''}"><b class="h l"></b><span>${esc(a.name||'')} · ${cdur(c).toFixed(1)}s${c.speed!==1?' ×'+c.speed:''}</span><b class="h r"></b></div>`}).join('');
  $('#trT').innerHTML=S.texts.map(x=>`<div class="blk txt${sel('text',x.id)}" data-k="text" data-id="${x.id}" style="left:${x.start*pps}px;width:${Math.max(6,(x.end-x.start)*pps)}px"><b class="h l"></b><span>${esc(x.text)}</span><b class="h r"></b></div>`).join('');
  $('#trS').innerHTML=S.subs.map(x=>`<div class="blk sub${sel('sub',x.id)}" data-k="sub" data-id="${x.id}" style="left:${x.s*pps}px;width:${Math.max(6,(x.e-x.s)*pps)}px"><b class="h l"></b><span>${esc(x.t)}</span><b class="h r"></b></div>`).join('');
  $('#trO').innerHTML=S.overlays.map(x=>{const a=assets[x.aid]||{};return`<div class="blk ovl${sel('ov',x.id)}" data-k="ov" data-id="${x.id}" style="left:${x.start*pps}px;width:${Math.max(6,(x.end-x.start)*pps)}px;${a.thumb?`background-image:url(${a.thumb})`:''}"><b class="h l"></b><span>${esc(a.name||'')}</span><b class="h r"></b></div>`}).join('');
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
  if(!S.sel||(S.sel.k!=='text'&&S.sel.k!=='ov'))return;const tx=selObj();if(!tx||S.playhead<tx.start||S.playhead>tx.end)return;
  cdrag={tx,r:cv.getBoundingClientRect()};cv.setPointerCapture(e.pointerId);e.preventDefault();
});
cv.addEventListener('pointermove',e=>{if(!cdrag)return;const r=cdrag.r;cdrag.tx.x=+clamp((e.clientX-r.left)/r.width,0,1).toFixed(3);cdrag.tx.y=+clamp((e.clientY-r.top)/r.height,0,1).toFixed(3);dirty=true;const a=$('[data-k="x"]'),b=$('[data-k="y"]');if(a&&b){a.value=cdrag.tx.x;b.value=cdrag.tx.y}});
cv.addEventListener('pointerup',()=>{if(cdrag){cdrag=null;commit()}});

/* ---------- panel ---------- */
const TABS=[['media','📁 الوسائط'],['text','🔤 نص'],['subs','💬 ترجمة'],['fx','✨ مؤثرات'],['ov','🖼 ستيكر'],['audio','🎵 صوت'],['export','⬇ تصدير']];
function renderTabs(){$('#tabs').innerHTML=TABS.map(([k,n])=>`<button data-t="${k}" class="${S.tab===k?'on':''}">${n}</button>`).join('')}
$('#tabs').onclick=e=>{const b=e.target.closest('button');if(!b)return;S.tab=b.dataset.t;renderTabs();renderPanel()};
const obName=o=>o===VIZ?'viz':o===DUCK?'duck':o===ENH?'enh':o===CARD?'card':o===BEAT?'beat':o===SIL?'sil':o===S.subStyle?'sty':S.sel&&S.sel.k||'';
function sld(o,k,label,min,max,step,unit=''){return`<div class="fld"><label>${label}<b>${o[k]}${unit}</b></label><input type="range" data-o="${obName(o)}" data-k="${k}" min="${min}" max="${max}" step="${step}" value="${o[k]}" data-u="${unit}"></div>`}
function sel_(o,k,label,opts){return`<div class="fld"><label>${label}</label><select data-o="${obName(o)}" data-k="${k}">${opts.map(([v,n])=>`<option value="${v}" ${String(o[k])===String(v)?'selected':''}>${n}</option>`).join('')}</select></div>`}
function chk(o,k,label){return`<label class="chk"><input type="checkbox" data-o="${obName(o)}" data-k="${k}" ${o[k]?'checked':''}> ${label}</label>`}
function clr(o,k,label){return`<div class="fld"><label>${label}</label><input type="color" data-o="${obName(o)}" data-k="${k}" value="${o[k]}"></div>`}
function renderPanel(){
  const B=$('#tabBody'),st=B.scrollTop;let h='';
  if(S.tab==='media')h=panelMedia();else if(S.tab==='text')h=panelText();else if(S.tab==='subs')h=panelSubs();else if(S.tab==='fx')h=panelFx();else if(S.tab==='ov')h=panelOv();else if(S.tab==='audio')h=panelAudio();else h=panelExport();
  B.innerHTML=h;wirePanel(B);B.scrollTop=st;
  if(S.tab==='fx')drawPresetThumbs();
}
function panelMedia(){
  const list=Object.values(assets);
  return`<div class="row"><button class="primary" data-act="add">+ إضافة ملفات</button><button data-act="demo">مثال جاهز</button></div>
  <p class="hint">فيديو، صور، أو صوت. اضغط "+ للمقاطع" لإضافة الملف في الخط الزمني.</p>
  <div class="assets">${list.map(a=>`<div class="asset"><div class="th" style="${a.thumb?`background-image:url(${a.thumb})`:''}">${a.thumb?'':'🎵'}</div><div class="nm" title="${esc(a.name)}">${esc(a.name)}${a.type!=='image'?' · '+fmtS(a.dur):''}</div>${a.type==='audio'?`<button data-act="aud" data-id="${a.id}">+ كصوت</button>`:`<button data-act="clip" data-id="${a.id}">+ للمقاطع</button><button data-act="ov" data-id="${a.id}">${a.type==='image'?'+ ستيكر/لوجو':'+ PIP'}</button>`}</div>`).join('')||'<p class="hint">لسه مفيش ملفات.</p>'}</div>
  <div class="row" style="margin-top:8px"><button data-act="recvid" data-src="cam" class="${RV.on&&RV.src==='cam'?'on':''}">${RV.on&&RV.src==='cam'?'⏹ إيقاف التسجيل':'🎥 تسجيل بالكاميرا'}</button>${navigator.mediaDevices&&navigator.mediaDevices.getDisplayMedia&&!IS_MOBILE?`<button data-act="recvid" data-src="screen" class="${RV.on&&RV.src==='screen'?'on':''}">${RV.on&&RV.src==='screen'?'⏹ إيقاف التسجيل':'🖥 تسجيل الشاشة'}</button>`:''}</div>
  <div class="h4">⚡ ستايلات جاهزة بضغطة (على كل المقاطع)</div><div class="row" style="display:grid;grid-template-columns:1fr 1fr">${PACKS.map((k,i)=>`<button data-act="pack" data-i="${i}">${k.n}</button>`).join('')}</div><p class="hint">بتغيّر الفلتر والمؤثرات والمقاس والترجمة مرة واحدة. تقدر تتراجع بـ Ctrl+Z.</p>
  <div class="h4">اختصارات</div><p class="hint">مسافة: تشغيل · S: قص · Delete: حذف · ←/→: إطار · Ctrl+Z: تراجع</p>`;
}
function panelText(){
  const tx=S.sel&&S.sel.k==='text'?selObj():null;
  let h=`<div class="row"><button class="primary" data-act="addtext">+ نص جديد عند المؤشر</button></div>`;
  h+=`<div class="h4">🎬 كروت مقدمة / ختام</div><div class="fld"><label>العنوان</label><input type="text" data-o="card" data-k="t" value="${esc(CARD.t)}"></div><div class="fld"><label>سطر فرعي</label><input type="text" data-o="card" data-k="s" value="${esc(CARD.s)}"></div><div class="fld"><label>الستايل</label><select data-o="card" data-k="st">${CARDS.map((c,i)=>`<option value="${i}" ${CARD.st===i?'selected':''}>${c.n}</option>`).join('')}</select></div><div class="row"><button class="primary" data-act="card" data-w="start">+ كارت في البداية</button><button data-act="card" data-w="end">+ كارت في النهاية</button></div>`;
  h+=`<div class="h4">قوالب جاهزة</div><div class="row" style="display:grid;grid-template-columns:1fr 1fr">${TPLS.map((t,i)=>`<button data-act="tpl" data-i="${i}">${t[0]}</button>`).join('')}</div><div class="h4">إيموجي</div><div class="row emo">${['😂','🔥','❤️','👍','⭐','🎉','😍','✅'].map(e=>`<button data-act="emoji">${e}</button>`).join('')}</div>`;
  if(!tx)return h+`<p class="hint">اختار نص من الخط الزمني أو اضغط "نص جديد". تقدر تسحب النص على الشاشة مباشرة.</p>`;
  h+=`<div class="fld"><label>النص</label><textarea data-o="text" data-k="text">${esc(tx.text)}</textarea></div>`;
  h+=`<div class="r2"><div class="fld"><label>يبدأ (ثانية)</label><input type="number" step="0.1" min="0" data-o="text" data-k="start" value="${tx.start.toFixed(1)}"></div><div class="fld"><label>ينتهي (ثانية)</label><input type="number" step="0.1" min="0" data-o="text" data-k="end" value="${tx.end.toFixed(1)}"></div></div>`;
  h+=sld(tx,'size','الحجم',2,30,.5,'%')+sld(tx,'x','أفقي',0,1,.01)+sld(tx,'y','رأسي',0,1,.01);
  h+=`<div class="r3">${clr(tx,'color','لون النص')}${clr(tx,'bg','لون الخلفية')}${chk(tx,'bgOn','خلفية')}</div>`;
  h+=sel_(tx,'anim','الحركة',[['none','بدون'],['fade','ظهور تدريجي'],['pop','بوب'],['slide','انزلاق'],['type','كتابة'],['words','كلمة كلمة'],['zoom','زووم داخل'],['bounce','نطّ'],['float','طفو'],['marquee','شريط متحرك'],['rise','طلوع'],['shake','اهتزاز'],['blink','وميض'],['drop','سقوط']]);
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
  <div class="h4">أسلوب الترجمة</div><div class="row" style="display:grid;grid-template-columns:1fr 1fr">${SUBPRE.map((s,i)=>`<button data-act="subpre" data-i="${i}">${s[0]}</button>`).join('')}</div>
  ${chk(S.subStyle,'burn','اظهر الترجمة على الفيديو (وتتحرق في التصدير)')}
  ${sld(S.subStyle,'size','الحجم',2,10,.2,'%')}${sld(S.subStyle,'pos','الموضع (من الأعلى)',10,96,1,'%')}
  <div class="r3">${clr(S.subStyle,'color','اللون')}${chk(S.subStyle,'bg','خلفية سوداء')}</div>
  ${chk(S.subStyle,'kar','✨ تمييز الكلمة الحالية (كاريوكي)')}${S.subStyle.kar?clr(S.subStyle,'khc','لون الكلمة المميزة'):''}
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
  h+=`<div class="h4">ضبط الصورة</div>${sld(c,'b','السطوع',30,200,1,'%')}${sld(c,'c','التباين',30,200,1,'%')}${sld(c,'s','التشبع',0,250,1,'%')}${sld(c,'h','تدرج اللون',-180,180,1,'°')}${sld(c,'temp','حرارة اللون (بارد ↔ دافئ)',-100,100,1)}${sld(c,'tint','تينت (أخضر ↔ وردي)',-100,100,1)}${sld(c,'bl','تمويه',0,20,.5,'px')}${chk(c,'vig','تعتيم الأطراف')}`;
  h+=`<div class="h4">⭕ شكل القناع</div><div class="presets" style="grid-template-columns:repeat(3,1fr)">${[['none','بدون'],['circle','دايرة'],['square','مربع مدوّر'],['wide','مستطيل'],['diamond','معيّن'],['heart','قلب']].map(([v,n])=>`<button data-act="mask" data-v="${v}" class="${(c.mask||'none')===v?'on':''}" style="padding:9px 2px;font-size:12px">${n}</button>`).join('')}</div>${c.mask&&c.mask!=='none'?sld(c,'msz','حجم القناع',20,140,1,'%')+sld(c,'mx','إزاحة القناع أفقي',-50,50,1,'%')+sld(c,'my','إزاحة القناع رأسي',-50,50,1,'%'):''}`;
  h+=`<div class="h4">✨ مؤثرات بصرية</div><div class="presets" style="grid-template-columns:repeat(4,1fr)">${Object.entries(FXS).map(([v,n])=>`<button data-act="fx" data-v="${v}" class="${(c.fx||'none')===v?'on':''}" style="padding:9px 2px;font-size:12px">${n}</button>`).join('')}</div>${c.fx&&c.fx!=='none'?sld(c,'fxs','شدة المؤثر',10,100,1,'%'):''}`;
  h+=`<div class="h4">🟩 إزالة الخلفية الخضراء (Chroma Key)</div>${chk(c,'key','فعّل إزالة الخلفية')}<div class="row"><button data-act="pickkey" id="pickKeyBtn">🎯 اختار اللون من الشاشة</button></div>${clr(c,'keyc','لون الخلفية اللي هتتشال')}${sld(c,'keyt','قوة الإزالة',5,90,1)}${sld(c,'keys','نعومة الحواف',1,40,1)}${sel_(c,'keybg','الخلفية البديلة',[['color','لون ثابت'],['grad','تدرج'],['image','صورة من الوسائط']])}${c.keybg==='color'||!c.keybg?clr(c,'keybgc','لون الخلفية البديلة'):''}${c.keybg==='image'?sel_(c,'keyaid','الصورة',[['','— اختار —']].concat(Object.values(assets).filter(x=>x.type==='image').map(x=>[x.id,x.name]))):''}<p class="hint">صوّر قدام ستارة خضراء، فعّل الخيار، واضغط "اختار اللون" وبعدين اضغط على الأخضر في الشاشة.</p>`;
  if(a.type==='video')h+=`<div class="h4">✂ حذف الصمت تلقائي</div><p class="hint">بيقطع الفترات الساكتة من المقطع ويسيب الكلام بس.</p>${sld(SIL,'th','حساسية الصوت (dB)',-60,-20,1)}${sld(SIL,'min','أقل مدة صمت تتحذف',.2,2,.05,'s')}<div class="row"><button class="primary" data-act="unsilence" id="silBtn">✂ احذف الصمت</button></div>`;
  if(a.type==='video')h+=`<div class="row" style="margin-top:10px"><button data-act="freeze">❄ تجميد اللقطة عند المؤشر (٢ث)</button></div>`;
  h+=`<div class="h4">انتقال عند بداية المقطع</div><div class="presets" style="grid-template-columns:repeat(3,1fr)">${[['none','بدون'],['fade','تلاشي'],['dip','عبر الأسود'],['slide','انزلاق'],['wipe','مسح'],['zoom','زووم'],['circle','دايرة'],['blinds','ستاير'],['pixel','بكسل'],['spin','دوران'],['push','دفع'],['flashw','وميض أبيض'],['diag','قُطري'],['split','انفتاح'],['zout','زووم آوت'],['glitcht','جليتش']].map(([v,n])=>`<button data-act="trans" data-v="${v}" class="${(c.trans||'none')===v?'on':''}" style="padding:10px 4px">${n}</button>`).join('')}</div>${c.trans&&c.trans!=='none'?sld(c,'transD','مدة الانتقال',.2,1.5,.1,'s'):''}<p class="hint">الانتقال بيظهر بين المقطع ده والمقطع اللي قبله.</p><div class="h4">الحركة والإطار</div><div class="row"><button data-act="rot">⟳ لف ٩٠°</button><button data-act="flip" class="${c.flip?'on':''}">⇋ قلب</button></div>${sel_(c,'fit','ملء الشاشة',[['contain','احتواء'],['cover','قص وملء']])}${chk(c,'bgblur','خلفية ضبابية لو فيه فراغ')}${sld(c,'zoom','تكبير',100,300,1,'%')}${sld(c,'cl','قص من اليسار',0,60,1,'%')}${sld(c,'cr','قص من اليمين',0,60,1,'%')}${sld(c,'ct','قص من فوق',0,60,1,'%')}${sld(c,'cb','قص من تحت',0,60,1,'%')}${sld(c,'kb','تكبير تدريجي (Ken Burns)',0,60,1,'%')}${sld(c,'px','إزاحة أفقية',-50,50,1,'%')}${sld(c,'py','إزاحة رأسية',-50,50,1,'%')}${sld(c,'fade','دخول/خروج تدريجي من الأسود',0,2,.1,'s')}`;
  if(a.type==='video')h+=`<div class="h4">سرعة وصوت</div>${sld(c,'speed','السرعة',.25,4,.05,'×')}<div class="h4">سرعة متغيرة (Speed Ramp)</div><div class="presets" style="grid-template-columns:repeat(3,1fr)">${[['','ثابتة'],['slowmid','سلو-مو في النص'],['burst','سريع-بطيء-سريع'],['up','تسارع'],['down','تباطؤ'],['pulse','نبض']].map(([v,n])=>`<button data-act="ramp" data-v="${v}" class="${(c.ramp||'')===v?'on':''}" style="padding:10px 4px">${n}</button>`).join('')}</div>${sld(c,'vol','مستوى الصوت',0,100,1,'%')}${chk(c,'mute','كتم صوت المقطع')}<div class="h4">قفزات زووم (Punch-in)</div>${sld(c,'pz','قوة الزووم',0,40,1,'%')}${sld(c,'pi','كل كام ثانية',1,8,.5,'s')}`;
  else h+=`<div class="h4">المدة</div><div class="fld"><label>مدة الصورة (ثانية)</label><input type="number" step="0.5" min="0.5" max="120" data-o="clip" data-k="out" value="${c.out}"></div>`;
  h+=`<div class="row"><button data-act="clipl">◀ حرّك للبداية</button><button data-act="clipr">حرّك للنهاية ▶</button></div><div class="row"><button data-act="applyall">طبّق الفلتر على كل المقاطع</button></div>`;
  return h;
}
function panelOv(){
  const o=S.sel&&S.sel.k==='ov'?selObj():null;const imgs=Object.values(assets).filter(a=>a.type==='image'||a.type==='video');
  let h=`<p class="hint">ستيكر أو لوجو أو فيديو صغير (صورة داخل صورة PIP) فوق الفيديو. ضيف الملف من تبويب الوسائط وبعدين اضغط "+ عند المؤشر".</p>`+imgs.map(a=>`<div class="subitem"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><span>${a.type==='video'?'🎞':'🖼'} ${esc(a.name)}</span><button data-act="ov" data-id="${a.id}">+ عند المؤشر</button></div></div>`).join('');
  if(!o)return h+(imgs.length?'<p class="hint">اختار ستيكر من الخط الزمني للتعديل.</p>':'');
  return h+`<div class="h4">تخطيط سريع</div><div class="presets" style="grid-template-columns:repeat(4,1fr)">${OVL.map(([n,sz,x,y],i)=>`<button data-act="ovlay" data-i="${i}" style="padding:10px 2px;font-size:12px">${n}</button>`).join('')}</div><div class="h4">تعديل الستيكر</div>${sld(o,'size','الحجم (% من العرض)',3,100,1,'%')}${sld(o,'x','أفقي',0,1,.01)}${sld(o,'y','رأسي',0,1,.01)}${sld(o,'rot','دوران',-180,180,1,'°')}${sld(o,'opacity','الشفافية',10,100,1,'%')}${sld(o,'rad','تدوير الحواف',0,50,1,'%')}${sld(o,'bd','إطار أبيض',0,10,1)}${assets[o.aid]&&assets[o.aid].type==='video'?`<div class="fld"><label>يبدأ الفيديو من (ث)</label><input type="number" step="0.1" min="0" data-o="ov" data-k="in" value="${(o.in||0).toFixed(1)}"></div>`:''}${sel_(o,'anim','الحركة',[['none','بدون'],['fade','ظهور تدريجي'],['pop','بوب'],['float','طفو']])}
  <div class="r2"><div class="fld"><label>يبدأ (ث)</label><input type="number" step="0.1" min="0" data-o="ov" data-k="start" value="${o.start.toFixed(1)}"></div><div class="fld"><label>ينتهي (ث)</label><input type="number" step="0.1" min="0" data-o="ov" data-k="end" value="${o.end.toFixed(1)}"></div></div><p class="hint">تقدر تسحب الستيكر على الشاشة.</p>`;
}
const OVL=[['↖ ركن',28,.17,.2],['↗ ركن',28,.83,.2],['↙ ركن',28,.17,.8],['↘ ركن',28,.83,.8],['◀ نص شمال',50,.25,.5,0],['نص يمين ▶',50,.75,.5,0],['وسط كبير',70,.5,.5],['ملء الشاشة',100,.5,.5,0]];
const TPLS=[
 ['عنوان سينمائي',{text:'العنوان هنا',size:12,weight:900,anim:'fade',y:.5,color:'#ffffff',bgOn:false}],
 ['ثلث سفلي',{text:'الاسم · الوظيفة',size:5.5,weight:700,anim:'slide',y:.82,x:.5,color:'#ffffff',bgOn:true,bg:'#7c5cffdd'}],
 ['نيون أصفر',{text:'نص نيون',size:9,weight:900,anim:'pop',y:.5,color:'#ffe14d',bgOn:false}],
 ['شريط أخبار',{text:'عاجل: اكتب الخبر هنا',size:5,weight:700,anim:'slide',y:.92,color:'#ffffff',bgOn:true,bg:'#d11a2add'}],
 ['كتابة آلة',{text:'اكتب هنا...',size:8,weight:700,anim:'type',y:.5,color:'#7CFFB2',bgOn:true,bg:'#000000aa'}],
 ['اقتباس',{text:'"اكتب الاقتباس هنا"',size:7,weight:400,anim:'fade',y:.5,color:'#ffffff',bgOn:true,bg:'#00000088'}]];
function applyTpl(i){const x=addText();Object.assign(x,TPLS[i][1]);commit();refreshAll()}
const SUBPRE=[['كلاسيك',{color:'#ffffff',bg:true,size:5.4,pos:88}],['أصفر بارز',{color:'#ffe14d',bg:false,size:6.2,pos:86}],['سينمائي',{color:'#ffffff',bg:false,size:4.6,pos:90}],['كبير للموبايل',{color:'#ffffff',bg:true,size:7.2,pos:80}],['كاريوكي أصفر',{color:'#ffffff',bg:false,size:7,pos:82,kar:true,khc:'#ffe14d'}],['كاريوكي نيون',{color:'#ffffff',bg:true,size:6.4,pos:84,kar:true,khc:'#19d3c5'}]];
function applySubPre(i){Object.assign(S.subStyle,SUBPRE[i][1]);commit();renderPanel();dirty=true}
function panelAudio(){
  const u=S.sel&&S.sel.k==='audio'?selObj():null;
  const auds=Object.values(assets).filter(a=>a.type==='audio');
  let h=`<div class="row"><button class="primary" data-act="add">+ ملف صوت / موسيقى</button><button id="recBtn">${rec.on?'⏹ إيقاف التسجيل':'🎤 تسجيل تعليق صوتي'}</button></div>`;
  h+=`<p class="hint">التعليق الصوتي بيتسجل من الميكروفون وبيتحط عند مكان المؤشر.</p><div class="h4">🎚 تحسين الصوت</div>${chk(ENH,'on','تحسين الكلام (قص الدندنة + ضغط + رفع الصوت)')}${sld(ENH,'vol','مستوى الصوت الكلي',20,200,1,'%')}<div class="h4">📊 مرئي الصوت (Visualizer)</div>${chk(VIZ,'on','اظهر موجات الصوت فوق الفيديو (وتتصدّر)')}${VIZ.on?sel_(VIZ,'st','الشكل',[['bars','أعمدة'],['wave','موجة'],['circle','دايرة']])+clr(VIZ,'color','اللون')+sld(VIZ,'pos','الموضع',20,98,1,'%')+sld(VIZ,'size','الحجم',5,40,1,'%'):''}${chk(DUCK,'on','🎙 خفض الموسيقى تلقائي لما الفيديو فيه كلام')}${DUCK.on?sld(DUCK,'lvl','مستوى الموسيقى أثناء الكلام',5,80,1,'%'):''}`;
  h+=auds.map(a=>`<div class="subitem"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><span>🎵 ${esc(a.name)} · ${fmtS(a.dur)}</span><button data-act="aud" data-id="${a.id}">+ عند المؤشر</button></div></div>`).join('');
  if(auds.length){if(!BEAT.mus||!assets[BEAT.mus])BEAT.mus=auds[0].id;
    h+=`<div class="h4">🥁 مونتاج تلقائي على إيقاع الموسيقى</div><p class="hint">بيحلل إيقاع الموسيقى ويقطّع مقاطعك (اللي في الخط الزمني) ويرتبها على الضرب. تقدر تتراجع بـ Ctrl+Z.</p>${sel_(BEAT,'mus','الموسيقى',auds.map(a=>[a.id,a.name]))}${sel_(BEAT,'n','القطع كل',[[1,'ضربة'],[2,'ضربتين'],[4,'٤ ضربات'],[8,'٨ ضربات']])}<div class="row"><button class="primary" data-act="beatedit" id="beatBtn">🥁 ابدأ المونتاج التلقائي</button></div>`}
  if(u){const a=assets[u.aid]||{};h+=`<div class="h4">${esc(a.name||'')}</div>${sld(u,'vol','مستوى الصوت',0,100,1,'%')}${sld(u,'fi','دخول تدريجي',0,5,.1,'s')}${sld(u,'fo','خروج تدريجي',0,5,.1,'s')}<div class="fld"><label>يبدأ عند (ث)</label><input type="number" step="0.1" min="0" data-o="audio" data-k="start" value="${u.start.toFixed(1)}"></div>`}
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
  return`<div class="fld"><label>جودة المعاينة (قلّلها لو الجهاز بطيء)</label><select data-o="pv" data-k="q">${[[360,'خفيفة 360p'],[540,'متوسطة 540p'],[720,'عالية 720p']].map(([v,n])=>`<option value="${v}" ${quality===v?'selected':''}>${n}</option>`).join('')}</select></div><div class="fld"><label>أبعاد الفيديو</label><select data-o="proj" data-k="aspect">${Object.keys(ASPECTS).map(k=>`<option value="${k}" ${S.aspect===k?'selected':''}>${k}${{'16:9':' (يوتيوب)','9:16':' (ريلز / تيك توك)','1:1':' (مربع)','4:5':' (إنستجرام)','4:3':''}[k]}</option>`).join('')}</select></div>
  <div class="r2"><div class="fld"><label>الجودة</label><select data-o="exp" data-k="short">${[[480,'480p خفيف'],[720,'720p HD'],[1080,'1080p Full HD']].map(([v,n])=>`<option value="${v}" ${exp.short===v?'selected':''}>${n}</option>`).join('')}</select></div>
  <div class="fld"><label>الإطارات</label><select data-o="exp" data-k="fps">${[24,30,60].map(v=>`<option value="${v}" ${exp.fps===v?'selected':''}>${v} إطار/ث</option>`).join('')}</select></div></div>
  <div class="fld"><label>الصيغة</label><select data-o="exp" data-k="fmt"><option value="auto" ${exp.fmt==='auto'?'selected':''}>تلقائي ${mp4?'(MP4)':'(WebM)'}</option><option value="webm" ${exp.fmt==='webm'?'selected':''}>WebM</option>${mp4?`<option value="mp4" ${exp.fmt==='mp4'?'selected':''}>MP4</option>`:''}</select></div>
  ${chk(S.subStyle,'burn','احرق الترجمة في الفيديو')}
  <button class="primary" id="expGo" style="width:100%" ${exp.busy?'disabled':''}>${exp.busy?'جاري التصدير...':'ابدأ التصدير'}</button>${exp.busy?'<button id="expCancel" style="width:100%;margin-top:8px;border-color:#ff5d6c;color:#ff5d6c">⏹ إلغاء التصدير</button>':''}
  <div class="bar"><i id="expBar" style="width:${exp.pct}%"></i></div><div class="status" id="expSt">التصدير بيتم بسرعة التشغيل العادية (مدة الفيديو = مدة التصدير). سيب الصفحة مفتوحة وقدّامك.</div>
  <div id="expRes"></div>
  <div class="row"><button id="snapBtn">📷 احفظ الإطار الحالي كصورة</button></div>`;
}
function wirePanel(B){
  $$('[data-k]',B).forEach(el=>{
    const ob=el.dataset.o,k=el.dataset.k;if(ob==='sil'){el.addEventListener('input',()=>{SIL[k]=parseFloat(el.value);const b=el.previousElementSibling&&$('b',el.previousElementSibling);if(b)b.textContent=SIL[k]+(el.dataset.u||'')});return}
    if(ob==='pv'){el.addEventListener('change',()=>{quality=+el.value;setCanvasSize(quality);dirty=true;toast('جودة المعاينة '+quality+'p')});return}
    if(ob==='viz'){const h=()=>{VIZ[k]=el.type==='checkbox'?el.checked:el.type==='range'?parseFloat(el.value):el.value;dirty=true};el.addEventListener('input',h);el.addEventListener('change',()=>{h();if(el.tagName==='SELECT'||el.type==='checkbox')renderPanel()});return}
    if(ob==='duck'){const h=()=>{DUCK[k]=el.type==='checkbox'?el.checked:parseFloat(el.value);const b=el.previousElementSibling&&$('b',el.previousElementSibling);if(b&&el.type==='range')b.textContent=DUCK[k]+'%'};el.addEventListener('input',h);el.addEventListener('change',h);return}
    if(ob==='enh'){el.addEventListener('input',()=>{ENH[k]=el.type==='checkbox'?el.checked:parseFloat(el.value);applyEnh();const b=el.previousElementSibling&&$('b',el.previousElementSibling);if(b&&el.type==='range')b.textContent=ENH[k]+'%'});el.addEventListener('change',()=>{ENH[k]=el.type==='checkbox'?el.checked:parseFloat(el.value);applyEnh()});return}
    if(ob==='card'){el.addEventListener('input',()=>{CARD[k]=el.type==='number'||k==='st'?+el.value:el.value});return}
    if(ob==='beat'){el.addEventListener('change',()=>{BEAT[k]=k==='n'?+el.value:el.value});return}
    const target=()=>ob==='sil'?SIL:ob==='sty'?S.subStyle:ob==='proj'?S:ob==='exp'?exp:findObj(ob,S.sel&&S.sel.id);
    const val=()=>el.type==='checkbox'?el.checked:(el.type==='range'||el.type==='number')?parseFloat(el.value):(k==='weight'||k==='short'||k==='fps')?+el.value:el.value;
    el.addEventListener('input',()=>{const o=target();if(!o||ob==='proj'||ob==='exp')return;
      o[k]=val();if(el.type==='range'){const b=el.previousElementSibling&&$('b',el.previousElementSibling);if(b)b.textContent=o[k]+(el.dataset.u||'')}
      if(ob==='clip'){layout();renderTL()}else if(['text','audio','ov'].includes(ob))renderTL();dirty=true});
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
    else if(act==='ov')addOverlay(id);
    else if(act==='tpl')applyTpl(+b.dataset.i);
    else if(act==='emoji'){const x=addText(b.textContent);x.size=22;x.anim='pop';commit();refreshAll()}
    else if(act==='subpre')applySubPre(+b.dataset.i);
    else if(act==='rot'){const c=selObj();c.rot=((c.rot||0)+1)%4;commit();dirty=true}
    else if(act==='flip'){const c=selObj();c.flip=!c.flip;commit();renderPanel();dirty=true}
    else if(act==='ramp'){const c=selObj();c.ramp=b.dataset.v||undefined;layout();commit();renderPanel();refreshAll();seekTo(S.playhead)}
    else if(act==='ovlay'){const o=selObj();const L=OVL[+b.dataset.i];o.size=L[1];o.x=L[2];o.y=L[3];if(L[4]!=null)o.rad=L[4];commit();renderPanel();dirty=true}
    else if(act==='trans'){const c=selObj();c.trans=b.dataset.v;commit();renderPanel();dirty=true}
    else if(act==='pickkey'){keyPick=true;b.textContent='👆 دوس على اللون الأخضر في الشاشة...';b.classList.add('on');toast('دوس على الخلفية الخضراء في معاينة الفيديو')}
    else if(act==='pack')applyPack(+b.dataset.i);
    else if(act==='recvid')toggleRecVid(b.dataset.src);
    else if(act==='mask'){const c=selObj();c.mask=b.dataset.v;if(c.msz==null)c.msz=80;if(c.mx==null)c.mx=0;if(c.my==null)c.my=0;commit();renderPanel();dirty=true}
    else if(act==='fx'){const c=selObj();c.fx=b.dataset.v;if(c.fxs==null)c.fxs=60;commit();renderPanel();dirty=true}
    else if(act==='unsilence')removeSilence();
    else if(act==='beatedit')beatEdit();
    else if(act==='card')addCard(b.dataset.w);
    else if(act==='freeze')freezeFrame();
    else if(act==='addtext')addText();
    else if(act==='preset'){const n=b.dataset.n,x=addText();x.size=+b.dataset.s;x.text=n==='عنوان كبير'?'العنوان هنا':n==='اسم / تعريف'?'الاسم · الوظيفة':'نص عادي';x.y=n==='اسم / تعريف'?.86:.5;commit();refreshAll()}
    else if(act==='addsub')addSub();
    else if(act==='subdel'){const i=S.subs.findIndex(s=>s.id===id);if(i>=0){S.subs.splice(i,1);commit();refreshAll()}}
    else if(act==='srtin')$('#srtIn').click();
    else if(act==='srtout')exportSRT();
    else if(act==='preset-fx'){const c=selObj();c.preset=b.dataset.p;commit();renderPanel();dirty=true}
    else if(act==='applyall'){const c=selObj();S.clips.forEach(o=>{['preset','b','c','s','h','bl','vig','temp','tint','fx','fxs'].forEach(k=>o[k]=c[k])});commit();dirty=true;toast('اتطبق على كل المقاطع')}
    else if(act==='clipl'||act==='clipr'){const c=selObj(),i=S.clips.indexOf(c),j=act==='clipl'?i-1:i+1;if(j>=0&&j<S.clips.length){S.clips.splice(i,1);S.clips.splice(j,0,c);layout();commit();refreshAll();seekTo(c._s)}}
  };
  $$('[data-sid]',B).forEach(el=>{
    el.addEventListener('input',()=>{const s=S.subs.find(x=>x.id===el.dataset.sid);if(!s)return;const f=el.dataset.f;s[f]=f==='t'?el.value:parseFloat(el.value)||0;renderTL();dirty=true});
    el.addEventListener('change',()=>{S.subs.sort((a,b)=>a.s-b.s);commit();renderTL()});
    el.addEventListener('focus',()=>{const s=S.subs.find(x=>x.id===el.dataset.sid);if(s){S.sel={k:'sub',id:s.id};seekTo(s.s+.05);renderTL()}});
  });
  if(S.tab==='subs')$('#asrGo',B).onclick=runASR;
  if(S.tab==='audio')$('#recBtn',B).onclick=toggleRec;
  if(S.tab==='export'){$('#expGo',B).onclick=runExport;const ec=$('#expCancel',B);if(ec)ec.onclick=()=>{exp.cancel=true;if(P.onEnd){const f=P.onEnd;P.onEnd=null;pause();f()}};$('#snapBtn',B).onclick=snapshotPNG;showResult()}
}
function drawPresetThumbs(){
  const c0=selObj();const a=c0&&assets[c0.aid];
  $$('canvas[data-pp]').forEach(c=>{const x=c.getContext('2d');
    const fake={preset:c.dataset.pp,b:100,c:100,s:100,h:0,bl:0};
    const paint=img=>{x.filter='none';if(img)x.drawImage(img,0,0,96,60);else{const g=x.createLinearGradient(0,0,96,60);g.addColorStop(0,'#ff7a59');g.addColorStop(.5,'#ffd25a');g.addColorStop(1,'#2f7bff');x.fillStyle=g;x.fillRect(0,0,96,60)}};
    x.fillStyle='#222';x.fillRect(0,0,96,60);x.filter=filterStr(fake,1280);
    if(a&&a.thumb){const im=new Image();im.onload=()=>{x.filter=filterStr(fake,1280);x.drawImage(im,0,0,96,60);x.filter='none';const pp=PRESETS[fake.preset];if(pp&&pp.tc){x.save();x.globalCompositeOperation='soft-light';x.globalAlpha=pp.ta||.3;x.fillStyle=pp.tc;x.fillRect(0,0,96,60);x.restore()}};im.src=a.thumb}
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

const RV={on:false,src:'',mr:null};
async function toggleRecVid(src){
  if(RV.on){RV.mr.stop();return}
  try{
    const st=src==='screen'?await navigator.mediaDevices.getDisplayMedia({video:true,audio:true}):await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:1280},height:{ideal:720}},audio:true});
    const chunks=[],mime=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm','video/mp4'].find(m=>MediaRecorder.isTypeSupported(m))||'';
    RV.mr=new MediaRecorder(st,mime?{mimeType:mime}:undefined);RV.src=src;const t0=performance.now();
    RV.mr.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
    st.getVideoTracks()[0].addEventListener('ended',()=>{if(RV.on&&RV.mr.state!=='inactive')RV.mr.stop()});
    RV.mr.onstop=async()=>{st.getTracks().forEach(t=>t.stop());RV.on=false;const dur=(performance.now()-t0)/1000;
      const ext=(RV.mr.mimeType||mime).includes('mp4')?'mp4':'webm';const f=new File(chunks,(src==='screen'?'تسجيل شاشة':'تسجيل كاميرا')+'.'+ext,{type:RV.mr.mimeType||mime||'video/webm'});
      try{const a=await loadAsset(f,'video',dur);a.dur=dur;addClip(a.id);S.tab='media';renderTabs();renderPanel();toast('اتضاف التسجيل للمقاطع ✅')}catch(e){toast('فشل حفظ التسجيل');renderPanel()}};
    RV.mr.start(1000);RV.on=true;renderPanel();toast('بيسجّل... اضغط إيقاف لما تخلص',4000);
  }catch(e){toast(src==='screen'?'مفيش إذن لتسجيل الشاشة':'محتاج إذن الكاميرا والميكروفون')}
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
  if(exp.cancel){exp.cancel=false;exp.busy=false;P.exporting=false;monitor.gain.value=1;quality=prevQ;setCanvasSize(quality);seekTo(0);renderPanel();toast('اتلغى التصدير');window.__exportCancelled=true;return}
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

const PACKS=[
 {n:'📱 ريلز / تيك توك',aspect:'9:16',clip:{fit:'cover',preset:'vivid',fx:'none',zoom:105,kb:8},sub:{kar:true,khc:'#ffe14d',color:'#ffffff',bg:false,size:7,pos:76}},
 {n:'🎞 سينمائي',aspect:'16:9',clip:{fit:'cover',preset:'drama',fx:'bars',fxs:55,temp:12,kb:6},sub:{kar:false,color:'#ffffff',bg:false,size:4.6,pos:88}},
 {n:'📼 ريترو VHS',aspect:'4:3',clip:{fit:'cover',preset:'vintage',fx:'vhs',fxs:70,temp:20},sub:{kar:false,color:'#ffe14d',bg:false,size:5.2,pos:88}},
 {n:'✨ نظيف ومشرق',aspect:'16:9',clip:{fit:'contain',preset:'vivid',fx:'none',b:105,c:105,temp:0},sub:{kar:false,color:'#ffffff',bg:true,size:5.4,pos:88}},
 {n:'🔥 ديناميك',aspect:'9:16',clip:{fit:'cover',preset:'neon',fx:'pulse',fxs:50,kb:0},sub:{kar:true,khc:'#19d3c5',color:'#ffffff',bg:true,size:6.4,pos:80}},
 {n:'⚪ إلغاء الستايل',aspect:null,clip:{preset:'none',fx:'none',temp:0,tint:0,b:100,c:100,s:100,h:0,bl:0,kb:0,zoom:100,vig:false},sub:{kar:false}}];
function applyPack(i){const k=PACKS[i];if(!k)return;if(k.aspect){S.aspect=k.aspect;setCanvasSize(quality)}S.clips.forEach(c=>Object.assign(c,k.clip));Object.assign(S.subStyle,k.sub);commit();refreshAll();toast('اتطبق ستايل '+k.n.replace(/^\S+\s/,'')+' ✅')}
/* ---------- title cards ---------- */
const CARDS=[{n:'بنفسجي مضيء',a:'#7c5cff',b:'#19d3c5',sh:'circles'},{n:'غروب',a:'#ff512f',b:'#f09819',sh:'bars'},{n:'ليلي أنيق',a:'#0f0c29',b:'#302b63',sh:'lines',c:'#ffe14d'},{n:'أخضر طبيعة',a:'#11998e',b:'#38ef7d',sh:'circles'},{n:'أحمر درامي',a:'#cb2d3e',b:'#1d1d1d',sh:'bars'},{n:'أبيض بسيط',a:'#f5f5f7',b:'#dcdce6',sh:'lines',c:'#222233',dark:true}];
async function addCard(where){
  const st=CARDS[CARD.st]||CARDS[0],[w,h]=dims(Math.max(quality,720)),cvs=document.createElement('canvas');cvs.width=w;cvs.height=h;const x=cvs.getContext('2d');
  const g=x.createLinearGradient(0,0,w,h);g.addColorStop(0,st.a);g.addColorStop(1,st.b);x.fillStyle=g;x.fillRect(0,0,w,h);
  x.save();x.globalAlpha=.16;x.fillStyle='#fff';
  if(st.sh==='circles'){[[.15,.2,.22],[.85,.8,.3],[.7,.15,.12],[.3,.9,.15]].forEach(([a,b,r])=>{x.beginPath();x.arc(w*a,h*b,Math.min(w,h)*r,0,7);x.fill()})}
  else if(st.sh==='bars'){for(let i=0;i<7;i++)x.fillRect(w*(.05+i*.15),0,w*.04,h)}
  else{x.globalAlpha=.5;x.fillStyle=st.c||'#fff';x.fillRect(w*.3,h*.43,w*.4,Math.max(2,h*.006));x.fillRect(w*.3,h*.64,w*.4,Math.max(2,h*.006))}
  x.restore();
  const col=st.dark?'#222233':'#ffffff';
  x.save();x.shadowColor='rgba(0,0,0,.35)';x.shadowBlur=h*.03;
  drawCaption(x,w,h,CARD.t||' ',w/2,h*.46,Math.min(14,160/Math.max(8,(CARD.t||'').length)*1.6+3),st.c&&!st.dark?st.c:col,null,{weight:900,stroke:false});
  x.restore();
  if(CARD.s)drawCaption(x,w,h,CARD.s,w/2,h*.64,4.6,col,null,{weight:600,stroke:false,alpha:.9});
  const blob=await new Promise(r=>cvs.toBlob(r,'image/png')),f=new File([blob],'card-'+(CARD.t||'').slice(0,12)+'.png',{type:'image/png'});
  const ia=await loadAsset(f,'image'),c=Object.assign(defClip(ia.id),{out:CARD.d||3,fit:'cover',bgblur:false,fade:.4});
  if(where==='start')S.clips.unshift(c);else S.clips.push(c);
  S.sel={k:'clip',id:c.id};layout();commit();refreshAll();seekTo(c._s+.1);toast('اتضاف كارت ✅');
}

/* ---------- beat sync + freeze frame ---------- */
async function detectBeats(a){
  const ac=new (window.OfflineAudioContext||window.webkitOfflineAudioContext)(1,1,22050);
  const buf=await ac.decodeAudioData(await a.file.arrayBuffer());const d=buf.getChannelData(0),sr=buf.sampleRate,hop=512,nf=Math.floor(d.length/hop);
  const e=new Float32Array(nf);for(let i=0;i<nf;i++){let x=0;for(let j=0;j<hop;j++){const v=d[i*hop+j];x+=v*v}e[i]=Math.sqrt(x/hop)}
  const on=new Float32Array(nf);for(let i=1;i<nf;i++){let m=0,c=0;for(let k=Math.max(0,i-8);k<i;k++){m+=e[k];c++}on[i]=Math.max(0,e[i]-m/Math.max(1,c))}
  const fps=sr/hop,lo=Math.round(fps*60/190),hi=Math.round(fps*60/70);let bl=lo,bs=-1;
  const ac2=L=>{let sc=0;for(let i=L;i<nf;i++)sc+=on[i]*on[i-L];return sc/Math.sqrt(L/lo)};
  for(let L=lo;L<=hi;L++){const sc=ac2(L);if(sc>bs){bs=sc;bl=L}}
  let Lf=bl;if(bl>lo&&bl<hi){const y0=ac2(bl-1),y1=bs,y2=ac2(bl+1),dn=y0-2*y1+y2;if(dn<0)Lf=bl+.5*(y0-y2)/dn}
  const grid=(p,k)=>p+k*Lf,sumAt=p=>{let sc=0;for(let k=0;grid(p,k)<nf-1;k++){const x=grid(p,k),i=Math.floor(x),f=x-i;sc+=on[i]*(1-f)+on[i+1]*f}return sc};
  let bp=0,bps=-1;for(let p=0;p<Lf;p+=.5){const sc=sumAt(p);if(sc>bps){bps=sc;bp=p}}
  const beats=[];for(let k=0;grid(bp,k)<nf;k++)beats.push(grid(bp,k)/fps);
  return{bpm:60*fps/Lf,beats,dur:buf.duration};
}
async function beatEdit(){
  const mus=assets[BEAT.mus];if(!mus){toast('ضيف موسيقى الأول');return}
  const pool=S.clips.filter(c=>assets[c.aid]);if(!pool.length){toast('ضيف مقاطع أو صور الأول');return}
  const btn=$('#beatBtn');if(btn){btn.disabled=true;btn.textContent='بحلل الإيقاع...'}
  try{
    const r=await detectBeats(mus);const n=BEAT.n||2;
    if(r.beats.length<n+2)throw new Error('few');
    const cuts=[];for(let i=0;i<r.beats.length;i+=n)cuts.push(r.beats[i]);
    const end=Math.min(r.dur,Math.max(cuts[cuts.length-1],r.dur));cuts[0]=0;cuts.push(end);
    const used=pool.map(()=>0),out=[];
    for(let i=0;i<cuts.length-1;i++){
      const dur=cuts[i+1]-cuts[i];if(dur<.25)continue;const k=i%pool.length,src=pool[k],a=assets[src.aid];
      const nc=Object.assign({},src,{id:uid(),trans:'none',fade:0});
      if(a.type==='video'){const span=src.out-src.in,room=Math.max(0,span-dur*src.speed);const off=room>0?(used[k]%Math.ceil(span/(dur*src.speed)))*dur*src.speed%Math.max(.01,room+.01):0;
        nc.in=src.in+Math.min(room,off);nc.out=Math.min(src.out,nc.in+dur*src.speed)}
      else{nc.in=0;nc.out=dur}
      used[k]++;out.push(nc);
    }
    S.clips=out;S.audios=S.audios.filter(u=>u.aid!==mus.id);S.audios.push({id:uid(),aid:mus.id,start:0,in:0,out:Math.min(mus.dur,end),vol:100,fi:0,fo:0});
    S.sel=null;layout();commit();refreshAll();seekTo(0);
    toast('اتعمل مونتاج: '+Math.round(r.bpm)+' BPM، '+out.length+' قطعة ✅',5000);
  }catch(e){toast('معرفتش أحلل إيقاع الملف ده')}
  const b2=$('#beatBtn');if(b2){b2.disabled=false;b2.textContent='🥁 ابدأ المونتاج التلقائي'}
}
async function freezeFrame(){
  const c=selObj(),i=S.clips.indexOf(c),a=c&&assets[c.aid];if(!a||a.type!=='video')return;
  const t=S.playhead;if(clipAt(t)!==i){toast('حط المؤشر على المقطع المحدد');return}
  const [w,h]=dims(Math.max(quality,720)),cvs=document.createElement('canvas');cvs.width=w;cvs.height=h;const x=cvs.getContext('2d');x.fillStyle='#000';x.fillRect(0,0,w,h);
  drawClipLayer(x,Object.assign({},c,{fade:0}),a,w,h,t);
  const blob=await new Promise(r=>cvs.toBlob(r,'image/png'));const f=new File([blob],'freeze-'+fmt(t)+'.png',{type:'image/png'});
  const ia=await loadAsset(f,'image');const lt=t-c._s,sp=srcTime(c,t);if(c.ramp){c.ramp=undefined}
  const fr=Object.assign(defClip(ia.id),{out:2,fit:'contain',bgblur:false,vol:0,preset:c.preset,b:c.b,c:c.c,s:c.s,h:c.h});
  if(lt>.1&&cdur(c)-lt>.1){const n=Object.assign({},c,{id:uid(),in:sp,fade:0,trans:'none'});c.out=sp;S.clips.splice(i+1,0,fr,n)}else S.clips.splice(lt<=.1?i:i+1,0,fr);
  S.sel={k:'clip',id:fr.id};layout();commit();refreshAll();seekTo(fr._s+.1);toast('اتجمّدت اللقطة ❄️');
}

/* ---------- silence removal ---------- */
async function removeSilence(){
  const c=selObj();if(!c||!assets[c.aid]||assets[c.aid].type!=='video'){toast('اختار مقطع فيديو');return}
  const btn=$('#silBtn');if(btn){btn.disabled=true;btn.textContent='بحلل الصوت...'}
  try{
    const pcm=await clipPCM(c);if(!pcm||!pcm.length)throw 0;
    const F=320,n=Math.floor(pcm.length/F),th=SIL.th,voiced=[];
    for(let i=0;i<n;i++){let e=0;for(let j=0;j<F;j++){const v=pcm[i*F+j];e+=v*v}voiced.push(10*Math.log10(e/F+1e-12)>th)}
    const fs=F/16000,minF=Math.round(SIL.min/fs),pad=Math.round(.12/fs);
    let segs=[],st=-1;for(let i=0;i<=n;i++){if(i<n&&voiced[i]){if(st<0)st=i}else if(st>=0){segs.push([st,i]);st=-1}}
    const merged=[];segs.forEach(sg=>{const l=merged[merged.length-1];if(l&&sg[0]-l[1]<minF)l[1]=sg[1];else merged.push([sg[0],sg[1]])});
    const rng=merged.map(([a,b])=>[Math.max(0,a-pad)*fs,Math.min(n,b+pad)*fs]).filter(r=>r[1]-r[0]>.15);
    if(!rng.length){toast('الصوت كله هادي، مفيش كلام اتلقى. جرّب حساسية أقل');return}
    const removed=(c.out-c.in)-rng.reduce((t,r)=>t+r[1]-r[0],0);
    if(removed<.3){toast('مفيش فترات صمت كفاية تتحذف');return}
    const i=S.clips.indexOf(c),nc=rng.map((r,k)=>Object.assign({},c,{id:k?uid():c.id,in:c.in+r[0],out:Math.min(c.out,c.in+r[1]),trans:k?'none':c.trans}));
    S.clips.splice(i,1,...nc);S.sel={k:'clip',id:nc[0].id};layout();commit();refreshAll();seekTo(nc[0]._s);
    toast('اتحذف '+removed.toFixed(1)+' ثانية صمت وطلع '+nc.length+' مقطع ✅',4500);
  }catch(e){toast('معرفتش أحلل صوت المقطع ده (يمكن من غير صوت)')}
  const b2=$('#silBtn');if(b2){b2.disabled=false;b2.textContent='✂ احذف الصمت'}
}
cv.addEventListener('pointerdown',e=>{
  if(!keyPick)return;e.stopImmediatePropagation();e.preventDefault();keyPick=false;
  const c=selObj();if(!c||c.key===undefined)return;
  const r=cv.getBoundingClientRect(),x=Math.floor((e.clientX-r.left)/r.width*cv.width),y=Math.floor((e.clientY-r.top)/r.height*cv.height);
  const t2=document.createElement('canvas');t2.width=cv.width;t2.height=cv.height;const tx=t2.getContext('2d',{willReadFrequently:true});
  drawClipLayer.raw=true;try{drawFrame(tx,t2.width,t2.height,S.playhead,{nosnap:true,subs:false})}finally{drawClipLayer.raw=false}
  const px=tx.getImageData(clamp(x,0,t2.width-1),clamp(y,0,t2.height-1),1,1).data;
  c.keyc='#'+[px[0],px[1],px[2]].map(v=>v.toString(16).padStart(2,'0')).join('');c.key=true;commit();renderPanel();dirty=true;toast('اتحدد اللون '+c.keyc);
},true);

/* ---------- autosave (IndexedDB, on this device only) ---------- */
const DB={db:null,open(){return this.db||(this.db=new Promise((res,rej)=>{try{const r=indexedDB.open('video-studio-ar',1);r.onupgradeneeded=()=>{r.result.createObjectStore('p');r.result.createObjectStore('a')};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)}catch(e){rej(e)}}))},
  async put(st,k,v){const d=await this.open();return new Promise((res,rej)=>{const t=d.transaction(st,'readwrite');t.objectStore(st).put(v,k);t.oncomplete=res;t.onerror=()=>rej(t.error)})},
  async get(st,k){const d=await this.open();return new Promise((res,rej)=>{const r=d.transaction(st).objectStore(st).get(k);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})},
  async clear(){const d=await this.open();return new Promise(res=>{const t=d.transaction(['p','a'],'readwrite');t.objectStore('p').clear();t.objectStore('a').clear();t.oncomplete=res})}};
let _asT=0,restoring=false;
function autosave(){
  if(restoring)return;clearTimeout(_asT);
  _asT=setTimeout(async()=>{try{
    if(!S.clips.length&&!S.audios.length)return;
    const used=new Set();S.clips.forEach(c=>{used.add(c.aid);if(c.keyaid)used.add(c.keyaid)});S.audios.forEach(u=>used.add(u.aid));S.overlays.forEach(o=>used.add(o.aid));
    const list=[];for(const id of used){const a=assets[id];if(!a)continue;if(!a.saved){await DB.put('a',id,{id,type:a.type,name:a.name,dur:a.dur,blob:a.file});a.saved=true}list.push(id)}
    await DB.put('p','cur',{state:snap(),aids:list,ts:Date.now(),playhead:S.playhead});
    window.__saved=Date.now();const el=$('#saveMark');if(el){el.textContent='✓ اتحفظ تلقائي';clearTimeout(el._t);el._t=setTimeout(()=>el.textContent='',2500)}
  }catch(e){console.warn('autosave',e)}},1800);
}
async function checkSaved(){
  try{const p=await DB.get('p','cur');if(!p||!p.aids||!p.aids.length)return;
    const st=JSON.parse(p.state);if(!st.clips||!st.clips.length)return;
    const box=$('#empty'),b=document.createElement('button');b.className='primary';b.id='emptyRestore';b.style.marginTop='10px';
    b.textContent='↻ كمّل آخر مشروع ('+st.clips.length+' مقطع)';b.onclick=()=>restoreProject(p);
    const x=document.createElement('button');x.textContent='🗑 امسح المحفوظ';x.style.marginTop='10px';x.onclick=async()=>{await DB.clear();b.remove();x.remove()};
    const sm=box.querySelector('small');box.insertBefore(b,sm);box.insertBefore(x,sm)}catch(e){}
}
async function restoreProject(p){
  restoring=true;toast('برجّع المشروع...');
  try{
    for(const id of p.aids){const r=await DB.get('a',id);if(!r)continue;const f=new File([r.blob],r.name,{type:r.blob.type});const a=await loadAsset(f,r.type,r.dur,r.id);a.saved=true}
    const o=JSON.parse(p.state);Object.assign(S,{overlays:[]},o);S.sel=null;layout();S.playhead=0;setCanvasSize(quality);commit();refreshAll();seekTo(0);toast('اتسترجع المشروع ✅');
  }catch(e){toast('معرفتش أسترجع المشروع')}
  restoring=false;
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
window.__S=S;window.__assets=assets;window.__app={drawFrame,play,pause,seekTo,addText,splitAt,runExport,runASR,importFiles,demo};
setCanvasSize(quality);commit();refreshAll();requestAnimationFrame(tick);checkSaved();

/* ===== R19: project file export/import ===== */
(function(){
  function usedIds(){const u=new Set();S.clips.forEach(c=>{u.add(c.aid);if(c.keyaid)u.add(c.keyaid)});S.audios.forEach(x=>u.add(x.aid));S.overlays.forEach(o=>u.add(o.aid));return [...u].filter(i=>assets[i])}
  async function exportProj(){
    if(!S.clips.length&&!S.audios.length){toast('مفيش مشروع تحفظه');return}
    const ids=usedIds(),meta=[],parts=[];
    for(const id of ids){const a=assets[id];meta.push({id,type:a.type,name:a.name,dur:a.dur,size:a.file.size,mime:a.file.type});parts.push(a.file)}
    const head=new TextEncoder().encode(JSON.stringify({v:1,state:snap(),assets:meta}));
    const len=new Uint8Array(4);new DataView(len.buffer).setUint32(0,head.length);
    const blob=new Blob([new TextEncoder().encode('VSP1'),len,head,...parts],{type:'application/octet-stream'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='project.vsproj';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000);
    toast('اتحفظ ملف المشروع 💾');
  }
  async function importProj(file){
    try{
      const buf=await file.slice(0,8).arrayBuffer();
      if(new TextDecoder().decode(buf.slice(0,4))!=='VSP1'){toast('ده مش ملف مشروع');return}
      const hl=new DataView(buf).getUint32(4);
      const head=JSON.parse(await file.slice(8,8+hl).text());
      restoring=true;toast('برجّع المشروع...');
      let off=8+hl;
      for(const m of head.assets){const f=new File([file.slice(off,off+m.size,m.mime)],m.name,{type:m.mime});off+=m.size;await loadAsset(f,m.type,m.dur,m.id)}
      const o=JSON.parse(head.state);Object.assign(S,{overlays:[]},o);S.sel=null;layout();S.playhead=0;setCanvasSize(quality);commit();refreshAll();seekTo(0);
      restoring=false;autosave();toast('اتفتح المشروع ✅');
    }catch(e){restoring=false;console.warn(e);toast('معرفتش أفتح الملف')}
  }
  const top=document.getElementById('top'),ex=document.getElementById('btnExport');
  const bs=document.createElement('button');bs.className='ib';bs.id='projSave';bs.title='احفظ المشروع كملف';bs.textContent='💾';bs.onclick=exportProj;
  const bo=document.createElement('button');bo.className='ib';bo.id='projOpen';bo.title='افتح ملف مشروع';bo.textContent='📂';
  const fi=document.createElement('input');fi.type='file';fi.accept='.vsproj';fi.id='projIn';fi.hidden=true;fi.onchange=()=>{if(fi.files[0])importProj(fi.files[0]);fi.value=''};
  bo.onclick=()=>fi.click();
  top.insertBefore(bs,ex);top.insertBefore(bo,ex);top.appendChild(fi);
  window.__proj={exportProj,importProj};
})();

/* ===== R20: shortcuts help + extra keys ===== */
(function(){
  const rows=[['Space','تشغيل / إيقاف'],['S','قص عند المؤشر'],['Delete','حذف المحدد'],['← / →','خطوة 0.1 ث (مع Shift: ثانية)'],['Home / End','أول / آخر المشروع'],['J / K','رجوع / تقدم 5 ثواني'],['Ctrl+Z / Y','تراجع / إعادة'],['?','الصفحة دي']];
  function show(){
    let d=document.getElementById('helpBox');if(d){d.remove();return}
    d=document.createElement('div');d.id='helpBox';d.dir='rtl';
    d.style.cssText='position:fixed;inset:0;background:#000a;z-index:99;display:flex;align-items:center;justify-content:center;padding:16px';
    d.innerHTML='<div style="background:#1a1c26;border:1px solid #333;border-radius:14px;padding:18px 22px;max-width:420px;width:100%;color:#eee;font-family:inherit"><h3 style="margin:0 0 10px">اختصارات الكيبورد</h3>'+rows.map(r=>'<div style="display:flex;justify-content:space-between;gap:12px;padding:6px 0;border-bottom:1px solid #2a2d3a"><b dir="ltr" style="color:#7ee">'+r[0]+'</b><span>'+r[1]+'</span></div>').join('')+'<p style="margin:12px 0 0;font-size:13px;opacity:.7">كل حاجة بتشتغل على جهازك ومفيش رفع. المشروع بيتحفظ تلقائي، و💾 بتحفظه كملف.</p><button class="primary" style="margin-top:10px;width:100%" id="helpClose">تمام</button></div>';
    d.onclick=e=>{if(e.target===d||e.target.id==='helpClose')d.remove()};document.body.appendChild(d);
  }
  const top=document.getElementById('top'),ex=document.getElementById('btnExport');
  const b=document.createElement('button');b.className='ib';b.id='helpBtn';b.title='اختصارات ومساعدة (?)';b.textContent='❓';b.onclick=show;top.insertBefore(b,document.getElementById('undo'));
  addEventListener('keydown',e=>{
    const ae=document.activeElement;if(/INPUT|TEXTAREA|SELECT/.test(ae.tagName)&&ae.type!=='range'&&ae.type!=='checkbox')return;
    if(e.key==='?'){show()}
    else if(e.key==='Escape'){const d=document.getElementById('helpBox');if(d)d.remove()}
    else if(e.key==='Home'){e.preventDefault();seekTo(0)}
    else if(e.key==='End'){e.preventDefault();seekTo(total)}
    else if(e.key==='j'||e.key==='J'){seekTo(S.playhead-5)}
    else if(e.key==='k'||e.key==='K'){seekTo(S.playhead+5)}
  });
})();
(function(){const st=document.createElement('style');st.textContent='@media(max-width:560px){#top{gap:4px;padding-left:6px;padding-right:6px}#top .brand{font-size:13px;white-space:nowrap}#top .brand .logo{display:none}#top .ib{min-width:34px;width:34px;padding:0}#btnExport{padding:8px 10px;white-space:nowrap;font-size:13px}}';document.head.appendChild(st)})();
window.__ramp={srcTime,cdur,rampSpeedAt};

/* ===== R24: first-run welcome tour ===== */
(function(){
  try{if(localStorage.getItem('vs_tour'))return}catch(e){return}
  const steps=[['🎬 أهلاً في استوديو الفيديو','كل حاجة بتشتغل على جهازك. مفيش رفع ولا حساب.'],['1) ضيف ملفاتك','اضغط "اختار ملفات" أو اسحبها. وبعدين "+ للمقاطع" عشان تنزل على الخط الزمني. وفيه "مثال جاهز" لو عايز تجرّب.'],['2) عدّل وزوّق','قص بـ S، انتقالات، فلاتر، كروما، سرعة متغيرة، عناوين وستيكرز، وستايلات جاهزة بضغطة.'],['3) ترجمة تلقائية وتصدير','تبويب "ترجمة" بيطلّع الكلام بالعربي لوحده. بعدين "تصدير". والمشروع بيتحفظ تلقائي، و💾 بيحفظه كملف. اضغط ؟ للاختصارات.']];
  let i=0;const d=document.createElement('div');d.id='tourBox';d.dir='rtl';d.style.cssText='position:fixed;inset:0;background:#000b;z-index:98;display:flex;align-items:center;justify-content:center;padding:16px';
  function draw(){const [h,t]=steps[i];d.innerHTML='<div style="background:#1a1c26;border:1px solid #3a3d52;border-radius:16px;padding:20px 22px;max-width:400px;width:100%;color:#eee"><h3 style="margin:0 0 8px">'+h+'</h3><p style="line-height:1.7;margin:0 0 14px">'+t+'</p><div style="display:flex;gap:8px;align-items:center"><button class="primary" id="tourNext" style="flex:1">'+(i<steps.length-1?'التالي':'يلا نبدأ')+'</button><button id="tourSkip">تخطي</button></div><div style="text-align:center;margin-top:10px;opacity:.6;font-size:13px">'+(i+1)+' / '+steps.length+'</div></div>';
    d.querySelector('#tourNext').onclick=()=>{if(i<steps.length-1){i++;draw()}else end()};d.querySelector('#tourSkip').onclick=end}
  function end(){try{localStorage.setItem('vs_tour','1')}catch(e){}d.remove()}
  setTimeout(()=>{if(window.__noTour)return;draw();document.body.appendChild(d)},900);
})();

/* ===== R26: GIF export (own encoder, offline frame stepping) ===== */
(function(){
  function gifEncode(frames,w,h,delayCs){
    const out=[];const B=n=>out.push(n&255),W=n=>{B(n);B(n>>8)};
    ['G','I','F','8','9','a'].forEach(c=>B(c.charCodeAt(0)));W(w);W(h);B(0xF7);B(0);B(0);
    for(let i=0;i<256;i++){B(((i>>5)&7)*255/7|0);B(((i>>2)&7)*255/7|0);B((i&3)*255/3|0)}
    B(0x21);B(0xFF);B(11);'NETSCAPE2.0'.split('').forEach(c=>B(c.charCodeAt(0)));B(3);B(1);W(0);B(0);
    const bayer=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
    for(const px of frames){
      B(0x21);B(0xF9);B(4);B(0);W(delayCs);B(0);B(0);
      B(0x2C);W(0);W(0);W(w);W(h);B(0);
      const idx=new Uint8Array(w*h);
      for(let y=0,p=0;y<h;y++)for(let x=0;x<w;x++,p++){const o=p*4,t=(bayer[(y&3)*4+(x&3)]-7.5)*3;
        const r=Math.max(0,Math.min(255,px[o]+t)),g=Math.max(0,Math.min(255,px[o+1]+t)),b=Math.max(0,Math.min(255,px[o+2]+t));
        idx[p]=((r>>5)<<5)|((g>>5)<<2)|(b>>6)}
      // LZW, min code size 8
      const mc=8,clear=256,eoi=257;let bits=0,nb=0,cs=mc+1,next=258,dict=new Map();const bytes=[];
      const put=(c)=>{bits|=c<<nb;nb+=cs;while(nb>=8){bytes.push(bits&255);bits>>=8;nb-=8}};
      put(clear);let cur=idx[0];
      for(let i=1;i<idx.length;i++){const k=idx[i],key=cur*256+k,v=dict.get(key);
        if(v!==undefined){cur=v}else{put(cur);
          if(next<4096){dict.set(key,next++);if(next>(1<<cs)&&cs<12)cs++}
          else{put(clear);dict.clear();next=258;cs=mc+1}
          cur=k}}
      put(cur);put(eoi);if(nb>0)bytes.push(bits&255);
      B(mc);for(let i=0;i<bytes.length;i+=255){const n=Math.min(255,bytes.length-i);B(n);for(let j=0;j<n;j++)out.push(bytes[i+j])}B(0);
    }
    B(0x3B);return new Blob([new Uint8Array(out)],{type:'image/gif'});
  }
  const waitSeek=el=>new Promise(r=>{if(!el.seeking)return r();const f=()=>{el.removeEventListener('seeked',f);r()};el.addEventListener('seeked',f);setTimeout(r,1500)});
  async function exportGif(btn){
    if(!S.clips.length){toast('ضيف مقاطع الأول');return}
    pause();const fps=10,wid=480,[w0,h0]=dims(720);const w=wid,h=Math.round(wid*h0/w0/2)*2;
    const dur=Math.min(total,15),n=Math.max(1,Math.floor(dur*fps));
    const cv=document.createElement('canvas');cv.width=w;cv.height=h;const x=cv.getContext('2d',{willReadFrequently:true});
    const frames=[],old=S.playhead;btn.disabled=true;
    try{
      for(let i=0;i<n;i++){
        const t=i/fps,ci=clipAt(t),c=S.clips[ci],a=c&&assets[c.aid];
        if(a&&a.type==='video'){a.el.pause();a.el.currentTime=srcTime(c,t);await waitSeek(a.el);await new Promise(r=>requestAnimationFrame(r))}
        drawFrame(x,w,h,t);frames.push(new Uint8ClampedArray(x.getImageData(0,0,w,h).data));
        if(i%3==0){btn.textContent='جاري عمل GIF... '+Math.round(i/n*100)+'%';await new Promise(r=>setTimeout(r,0))}
      }
      const blob=gifEncode(frames,w,h,Math.round(100/fps));
      download(blob,'video.gif');toast('اتعمل GIF ('+(blob.size/1048576).toFixed(1)+' ميجا'+(total>15?'، أول 15 ثانية':'')+') ✅');window.__gifSize=blob.size;window.__gifBlob=blob;
    }catch(e){console.warn(e);toast('معرفتش أعمل GIF')}
    btn.disabled=false;btn.textContent='🎞 صدّر GIF';seekTo(old);
  }
  const orig=renderPanel;
  renderPanel=function(){orig.apply(this,arguments);
    if(S.tab==='export'){const sn=document.getElementById('snapBtn');if(sn&&!document.getElementById('gifBtn')){const b=document.createElement('button');b.id='gifBtn';b.textContent='🎞 صدّر GIF';b.style.cssText='width:100%;margin-top:8px';b.onclick=()=>exportGif(b);sn.after(b)}}};
  window.__exportGif=exportGif;
})();

/* ===== R28: built-in music + sound effects generator (WebAudio, free, offline) ===== */
(function(){
  const SR=44100;
  const STY={
    chill:{n:'🌙 هادي',bpm:80,chords:[[57,60,64],[53,57,60],[48,52,55],[55,59,62]],drum:'soft',lead:true,wave:'sine'},
    upbeat:{n:'☀️ حماسي',bpm:120,chords:[[60,64,67],[67,71,74],[69,72,76],[65,69,72]],drum:'four',lead:true,wave:'triangle'},
    epic:{n:'🔥 ملحمي',bpm:100,chords:[[57,60,64],[55,59,62],[53,57,60],[52,55,59]],drum:'epic',lead:false,wave:'sawtooth'},
    lofi:{n:'☕ لوفاي',bpm:70,chords:[[62,65,69,72],[58,62,65,69],[55,58,62,65],[57,61,64,67]],drum:'lofi',lead:true,wave:'triangle'}
  };
  const mf=m=>440*Math.pow(2,(m-69)/12);
  function toWav(buf){const ch=buf.numberOfChannels,n=buf.length,ab=new ArrayBuffer(44+n*ch*2),v=new DataView(ab);const ws=(o,s)=>{for(let i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i))};
    ws(0,'RIFF');v.setUint32(4,36+n*ch*2,true);ws(8,'WAVEfmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,ch,true);v.setUint32(24,buf.sampleRate,true);v.setUint32(28,buf.sampleRate*ch*2,true);v.setUint16(32,ch*2,true);v.setUint16(34,16,true);ws(36,'data');v.setUint32(40,n*ch*2,true);
    const d=[];for(let c=0;c<ch;c++)d.push(buf.getChannelData(c));let o=44;for(let i=0;i<n;i++)for(let c=0;c<ch;c++){const s=Math.max(-1,Math.min(1,d[c][i]));v.setInt16(o,s<0?s*32768:s*32767,true);o+=2}
    return new Blob([ab],{type:'audio/wav'})}
  function noiseBuf(ctx,dur){const b=ctx.createBuffer(1,Math.ceil(dur*SR),SR),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;return b}
  function env(g,t,a,d,pk,end){g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(pk,t+a);g.gain.exponentialRampToValueAtTime(0.0001,t+a+d)}
  async function makeMusic(key,secs){
    const st=STY[key],ctx=new OfflineAudioContext(2,SR*secs,SR),beat=60/st.bpm,bar=beat*4,master=ctx.createGain();master.gain.value=.7;master.connect(ctx.destination);
    const nb=noiseBuf(ctx,.5);
    const kick=t=>{const o=ctx.createOscillator(),g=ctx.createGain();o.frequency.setValueAtTime(150,t);o.frequency.exponentialRampToValueAtTime(40,t+.12);env(g,t,.002,.25,.9);o.connect(g);g.connect(master);o.start(t);o.stop(t+.3)};
    const hat=(t,v=.15)=>{const s=ctx.createBufferSource();s.buffer=nb;const f=ctx.createBiquadFilter();f.type='highpass';f.frequency.value=7000;const g=ctx.createGain();env(g,t,.001,.05,v);s.connect(f);f.connect(g);g.connect(master);s.start(t);s.stop(t+.08)};
    const snare=(t,v=.4)=>{const s=ctx.createBufferSource();s.buffer=nb;const f=ctx.createBiquadFilter();f.type='bandpass';f.frequency.value=1800;const g=ctx.createGain();env(g,t,.001,.16,v);s.connect(f);f.connect(g);g.connect(master);s.start(t);s.stop(t+.2)};
    const note=(m,t,dur,vol,wave,lp)=>{const o=ctx.createOscillator();o.type=wave;o.frequency.value=mf(m);const f=ctx.createBiquadFilter();f.type='lowpass';f.frequency.value=lp||2200;const g=ctx.createGain();g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(vol,t+.04);g.gain.setValueAtTime(vol,t+dur-.12);g.gain.linearRampToValueAtTime(.0001,t+dur);o.connect(f);f.connect(g);g.connect(master);o.start(t);o.stop(t+dur+.02)};
    const nBars=Math.floor(secs/bar);
    for(let b=0;b<nBars;b++){
      const t0=b*bar,ch=st.chords[b%st.chords.length];
      ch.forEach(m=>note(m,t0,bar,.09,st.wave,1800));
      note(ch[0]-24,t0,beat*2,.28,'sine',400);note(ch[0]-24,t0+beat*2,beat*2,.24,'sine',400);
      if(st.lead){const sc=[0,3,5,7,10,12];for(let i=0;i<4;i++){if(Math.random()<.7){const m=ch[0]+12+sc[Math.floor(Math.random()*sc.length)];note(m,t0+i*beat+(Math.random()<.3?beat/2:0),beat*.9,.06,'sine',3000)}}}
      for(let i=0;i<4;i++){const t=t0+i*beat;
        if(st.drum==='four'){kick(t);hat(t+beat/2,.18);if(i%2)snare(t)}
        else if(st.drum==='soft'){if(i==0||i==2)kick(t);hat(t+beat/2,.08);if(i==3)snare(t,.15)}
        else if(st.drum==='epic'){if(i==0||i==2)kick(t);if(i==1||i==3)snare(t,.5);hat(t,.1)}
        else{if(i==0)kick(t);if(i==2){kick(t+beat/2);}if(i%2)snare(t,.22);hat(t,.1);hat(t+beat/2,.06)}}
    }
    const buf=await ctx.startRendering();
    // fade out
    const fo=Math.floor(SR*1.5);for(let c=0;c<buf.numberOfChannels;c++){const d=buf.getChannelData(c);for(let i=0;i<fo;i++)d[d.length-1-i]*=i/fo}
    return toWav(buf)}
  const SFX={
    whoosh:{n:'💨 ووش',d:1.1,f(ctx,m){const s=ctx.createBufferSource();s.buffer=noiseBuf(ctx,1.1);const f=ctx.createBiquadFilter();f.type='bandpass';f.Q.value=1.2;f.frequency.setValueAtTime(300,0);f.frequency.exponentialRampToValueAtTime(4000,.55);f.frequency.exponentialRampToValueAtTime(400,1.05);const g=ctx.createGain();g.gain.setValueAtTime(.0001,0);g.gain.linearRampToValueAtTime(.9,.5);g.gain.linearRampToValueAtTime(.0001,1.05);s.connect(f);f.connect(g);g.connect(m);s.start(0)}},
    pop:{n:'🫧 بوب',d:.3,f(ctx,m){const o=ctx.createOscillator(),g=ctx.createGain();o.frequency.setValueAtTime(700,0);o.frequency.exponentialRampToValueAtTime(180,.12);env(g,0,.003,.15,.9);o.connect(g);g.connect(m);o.start(0);o.stop(.3)}},
    riser:{n:'📈 رايزر',d:3,f(ctx,m){const o=ctx.createOscillator();o.type='sawtooth';o.frequency.setValueAtTime(100,0);o.frequency.exponentialRampToValueAtTime(1600,2.8);const f=ctx.createBiquadFilter();f.type='lowpass';f.frequency.setValueAtTime(300,0);f.frequency.exponentialRampToValueAtTime(5000,2.8);const g=ctx.createGain();g.gain.setValueAtTime(.0001,0);g.gain.linearRampToValueAtTime(.5,2.8);g.gain.linearRampToValueAtTime(.0001,3);o.connect(f);f.connect(g);g.connect(m);o.start(0);o.stop(3)}},
    ding:{n:'🔔 دينج',d:1.6,f(ctx,m){[880,1320,1760].forEach((fq,i)=>{const o=ctx.createOscillator(),g=ctx.createGain();o.frequency.value=fq;env(g,0,.005,1.4-i*.3,.4/(i+1));o.connect(g);g.connect(m);o.start(0);o.stop(1.6)})}},
    boom:{n:'💥 بوم',d:1.6,f(ctx,m){const o=ctx.createOscillator(),g=ctx.createGain();o.frequency.setValueAtTime(120,0);o.frequency.exponentialRampToValueAtTime(28,.9);env(g,0,.003,1.4,1);o.connect(g);g.connect(m);o.start(0);o.stop(1.6);const s=ctx.createBufferSource();s.buffer=noiseBuf(ctx,.6);const lp=ctx.createBiquadFilter();lp.frequency.value=900;const g2=ctx.createGain();env(g2,0,.002,.5,.6);s.connect(lp);lp.connect(g2);g2.connect(m);s.start(0)}},
    click:{n:'🖱 كليك',d:.15,f(ctx,m){const s=ctx.createBufferSource();s.buffer=noiseBuf(ctx,.05);const f=ctx.createBiquadFilter();f.type='highpass';f.frequency.value=2000;const g=ctx.createGain();env(g,0,.001,.04,.8);s.connect(f);f.connect(g);g.connect(m);s.start(0)}}
  };
  async function makeSfx(k){const d=SFX[k].d,ctx=new OfflineAudioContext(1,Math.ceil(SR*d),SR),m=ctx.createGain();m.gain.value=.9;m.connect(ctx.destination);SFX[k].f(ctx,m);return toWav(await ctx.startRendering())}
  async function addGen(blob,name,dur){
    try{const f=new File([blob],name+'.wav',{type:'audio/wav'});const a=await loadAsset(f,'audio',dur);if(a&&dur)a.dur=dur;addAudioClip(a.id);toast('اتضاف: '+name+' ✅')}catch(e){console.warn(e);toast('معرفتش أضيف الصوت')}}
  const orig=renderPanel;
  renderPanel=function(){orig.apply(this,arguments);
    if(S.tab!=='audio')return;const B=document.getElementById('panel');if(!B||B.querySelector('#genBox'))return;
    const d=document.createElement('div');d.id='genBox';d.style.cssText='padding:0 12px 18px';
    d.innerHTML='<div class="h4">🎼 موسيقى جاهزة (بتتولّد على جهازك)</div><div class="presets" style="grid-template-columns:repeat(2,1fr)">'+Object.entries(STY).map(([k,s])=>'<button data-gm="'+k+'">'+s.n+'</button>').join('')+'</div><div class="fld" style="margin-top:6px"><label>طول الموسيقى (ث)</label><input type="number" id="genLen" min="8" max="120" value="'+Math.min(60,Math.max(10,Math.round(total||30)))+'"></div><div class="h4">🔊 مؤثرات صوتية</div><div class="presets" style="grid-template-columns:repeat(3,1fr)">'+Object.entries(SFX).map(([k,s])=>'<button data-gs="'+k+'" style="padding:10px 2px">'+s.n+'</button>').join('')+'</div>';
    B.appendChild(d);
    d.querySelectorAll('[data-gm]').forEach(b=>b.onclick=async()=>{const secs=Math.max(8,Math.min(120,+d.querySelector('#genLen').value||30));b.disabled=true;toast('بولّد الموسيقى...');const bl=await makeMusic(b.dataset.gm,secs);b.disabled=false;await addGen(bl,'موسيقى-'+b.dataset.gm,secs)});
    d.querySelectorAll('[data-gs]').forEach(b=>b.onclick=async()=>{const k=b.dataset.gs;const bl=await makeSfx(k);await addGen(bl,SFX[k].n.replace(/^\S+\s/,''),SFX[k].d)});
  };
  window.__gen={makeMusic,makeSfx};
})();

/* ===== R30: platform export presets ===== */
(function(){
  const PL=[['📱 تيك توك / ريلز / شورتس','9:16',1080,30,true],['▶️ يوتيوب','16:9',1080,30,false],['📷 إنستجرام بوست','4:5',1080,30,true],['⬛ مربع (فيسبوك/تويتر)','1:1',720,30,true],['💬 ستاتس واتساب (خفيف)','9:16',720,30,true],['🖥 عرض 4:3','4:3',720,30,false]];
  const orig=renderPanel;
  renderPanel=function(){orig.apply(this,arguments);
    if(S.tab!=='export')return;const B=document.getElementById('panel');if(!B||B.querySelector('#platBox'))return;
    const d=document.createElement('div');d.id='platBox';d.style.cssText='padding:12px 12px 4px';
    d.innerHTML='<div class="h4" style="margin-top:0">⚡ إعدادات جاهزة للمنصات</div><div class="presets" style="grid-template-columns:repeat(2,1fr)">'+PL.map((p,i)=>'<button data-pl="'+i+'" style="padding:10px 6px;font-size:12px">'+p[0]+'</button>').join('')+'</div><p class="hint" style="margin:6px 0 0">بتظبط الأبعاد والجودة، ولو الأبعاد غير 16:9 بتملّى الإطار بالمقاطع (بدون أشرطة سودا).</p>';
    const f1=B.querySelector('.fld');if(f1&&f1.parentNode)f1.parentNode.insertBefore(d,f1);else B.appendChild(d);
    d.querySelectorAll('[data-pl]').forEach(b=>b.onclick=()=>{const p=PL[+b.dataset.pl];S.aspect=p[1];exp.short=p[2];exp.fps=p[3];if(p[4])S.clips.forEach(c=>{c.fit='cover'});else S.clips.forEach(c=>{c.fit='contain'});setCanvasSize(quality);commit();refreshAll();toast('اتظبط: '+p[0].replace(/^\S+\s/,''));renderPanel()});
  };
})();

/* ===== R31: progress bar + watermark overlays ===== */
(function(){
  const o=drawFrame;
  drawFrame=function(ctx,w,h,t,opt){o.apply(this,arguments);
    const P=S.subStyle&&S.subStyle.deco;if(!P)return;
    if(P.bar&&total>0){const th=Math.max(2,Math.round(h*(P.bth||1.2)/100)),y=P.bpos==='top'?0:h-th;ctx.save();ctx.fillStyle='rgba(255,255,255,.18)';ctx.fillRect(0,y,w,th);ctx.fillStyle=P.bcol||'#7c5cff';ctx.fillRect(0,y,w*Math.min(1,t/total),th);ctx.restore()}
    if(P.wm&&P.wmt){const fs=Math.round(h*.035);ctx.save();ctx.font='700 '+fs+'px Cairo, sans-serif';ctx.globalAlpha=(P.wmo||60)/100;ctx.fillStyle='#fff';ctx.shadowColor='rgba(0,0,0,.6)';ctx.shadowBlur=fs*.3;ctx.textBaseline='middle';ctx.direction=/[\u0600-\u06FF]/.test(P.wmt)?'rtl':'ltr';const m=h*.03,tw=ctx.measureText(P.wmt).width;const pos=P.wmp||'br';ctx.textAlign='left';const x=pos.includes('l')?m:w-m-tw,y=pos.includes('t')?m+fs/2+(P.bar&&P.bpos==='top'?h*.015:0):h-m-fs/2-(P.bar&&P.bpos!=='top'?h*.015:0);ctx.fillText(P.wmt,x,y);ctx.restore()}
  };
  const orig=renderPanel;
  renderPanel=function(){orig.apply(this,arguments);
    if(S.tab!=='export')return;const B=document.getElementById('panel');if(!B||B.querySelector('#decoBox'))return;
    const P=S.subStyle.deco||(S.subStyle.deco={bar:false,bcol:'#7c5cff',bpos:'bottom',bth:1.2,wm:false,wmt:'',wmp:'br',wmo:60});
    const d=document.createElement('div');d.id='decoBox';d.style.cssText='padding:4px 12px 14px';
    const sel=(k,opts)=>'<select data-dk="'+k+'">'+opts.map(([v,n])=>'<option value="'+v+'"'+(P[k]===v?' selected':'')+'>'+n+'</option>').join('')+'</select>';
    d.innerHTML='<div class="h4">🎚 شريط تقدم وعلامة مائية</div><label class="chk"><input type="checkbox" data-dk="bar" '+(P.bar?'checked':'')+'> شريط تقدم الفيديو</label><div class="r2"><div class="fld"><label>مكانه</label>'+sel('bpos',[['bottom','تحت'],['top','فوق']])+'</div><div class="fld"><label>لونه</label><input type="color" data-dk="bcol" value="'+P.bcol+'"></div></div><label class="chk"><input type="checkbox" data-dk="wm" '+(P.wm?'checked':'')+'> علامة مائية (نص)</label><div class="fld"><label>النص (اسمك أو قناتك)</label><input type="text" data-dk="wmt" value="'+(P.wmt||'').replace(/"/g,'&quot;')+'" placeholder="@اسمك"></div><div class="fld"><label>مكانها</label>'+sel('wmp',[['br','تحت يمين'],['bl','تحت شمال'],['tr','فوق يمين'],['tl','فوق شمال']])+'</div>';
    const last=B.lastElementChild;B.appendChild(d);
    d.querySelectorAll('[data-dk]').forEach(el=>{const k=el.dataset.dk;el.addEventListener('input',()=>{P[k]=el.type==='checkbox'?el.checked:el.value;dirty=true;commit()})});
  };
})();

/* ===== R32: auto slideshow maker ===== */
(function(){
  const TR=['fade','slide','zoom','circle','wipe','push','blinds','spin'];
  function make(dur,style){
    const imgs=Object.values(assets).filter(a=>a.type==='image');
    if(!imgs.length){toast('ضيف صور الأول من "اختار ملفات"');return}
    const fast=style==='fast';let i=0;if(S.clips.length&&S.clips.every(c=>assets[c.aid]&&assets[c.aid].type==='image'))S.clips=[];
    imgs.forEach(a=>{
      const c=defClip(a.id);c.out=dur;c.fit='cover';c.kb=fast?6:12+Math.round(Math.random()*10);
      c.px=0;c.py=0;
      if(S.clips.length||i>0){c.trans=fast?TR[(i*3)%TR.length]:(i%2?'fade':'zoom');c.transD=fast?.35:.8}
      if(style==='cine'){c.preset=['teal','golden','moody','drama'][i%4];c.vig=true}
      S.clips.push(c);i++});
    layout();commit();refreshAll();dirty=true;seekTo(0);toast('اتعمل سلايد شو من '+imgs.length+' صورة ✅ (دوس تشغيل)')}
  const orig=renderPanel;
  renderPanel=function(){orig.apply(this,arguments);
    if(S.tab!=='media')return;const B=document.getElementById('panel');if(!B||B.querySelector('#ssBox'))return;
    const n=Object.values(assets).filter(a=>a.type==='image').length;if(n<2)return;
    const d=document.createElement('div');d.id='ssBox';d.style.cssText='padding:4px 12px 14px';
    d.innerHTML='<div class="h4">🖼 سلايد شو تلقائي ('+n+' صور)</div><div class="fld"><label>مدة كل صورة (ث)</label><input type="number" id="ssDur" min="1" max="10" step="0.5" value="3"></div><div class="presets" style="grid-template-columns:repeat(3,1fr)"><button data-ss="soft">هادي</button><button data-ss="fast">سريع</button><button data-ss="cine">سينمائي</button></div>';
    B.appendChild(d);d.querySelectorAll('[data-ss]').forEach(b=>b.onclick=()=>make(Math.max(1,Math.min(10,+d.querySelector('#ssDur').value||3)),b.dataset.ss));
  };
  window.__slideshow=make;
})();

/* ===== R36: caption style presets ===== */
(function(){
  const CP=[
    {n:'🎬 سينمائي',s:{size:4.6,color:'#ffffff',bg:false,pos:90,kar:false}},
    {n:'🔥 تيك توك',s:{size:7,color:'#ffffff',bg:false,pos:70,kar:true,khc:'#ffe14d'}},
    {n:'🟨 أصفر كلاسيك',s:{size:5.6,color:'#ffe14d',bg:true,pos:88,kar:false}},
    {n:'⬛ صندوق',s:{size:5.4,color:'#ffffff',bg:true,pos:86,kar:false}},
    {n:'💚 نيون',s:{size:6,color:'#39ff88',bg:false,pos:80,kar:true,khc:'#ff3df2'}},
    {n:'📰 أخبار',s:{size:4.8,color:'#ffffff',bg:true,pos:93,kar:false}},
    {n:'💜 بنفسجي ستوري',s:{size:6.4,color:'#ffffff',bg:false,pos:72,kar:true,khc:'#c77dff',stc:'#3c096c',stw:1.6,glow:'#c77dff'}},
    {n:'🧡 برتقالي',s:{size:6,color:'#ffffff',bg:false,pos:84,kar:true,khc:'#ff9f1c',stc:'#7a3e00',stw:1.4,glow:null}},
    {n:'🌊 أزرق هادي',s:{size:5.2,color:'#e0fbfc',bg:false,pos:88,kar:false,stc:'#0b3954',stw:1.5,glow:'#19d3c5'}},
    {n:'⚪ بسيط نضيف',s:{size:4.6,color:'#ffffff',bg:false,pos:92,kar:false,stc:'#000000',stw:.8,glow:null}}
  ];
  const orig=renderPanel;
  renderPanel=function(){orig.apply(this,arguments);
    if(S.tab!=='subs')return;const B=document.getElementById('panel');if(!B||B.querySelector('#cpBox'))return;
    const d=document.createElement('div');d.id='cpBox';d.style.cssText='padding:4px 12px 14px';
    d.innerHTML='<div class="h4">✨ ستايلات جاهزة للترجمة</div><div style="display:flex;flex-wrap:wrap;gap:6px">'+CP.map((c,i)=>'<button class="btn" data-cp="'+i+'">'+c.n+'</button>').join('')+'</div>';
    B.appendChild(d);
    d.querySelectorAll('[data-cp]').forEach(b=>b.onclick=()=>{Object.assign(S.subStyle,{stc:null,stw:null,glow:null},CP[+b.dataset.cp].s);dirty=true;commit();refreshAll();toast('اتطبق ستايل الترجمة ✅')});
  };
})();

/* ===== R37: one-click reframe ===== */
(function(){
  const RF=[['16:9','🖥 16:9 يوتيوب'],['9:16','📱 9:16 ريلز'],['1:1','⬜ 1:1 مربع'],['4:5','📷 4:5 انستجرام']];
  const orig=renderPanel;
  renderPanel=function(){orig.apply(this,arguments);
    if(S.tab!=='media'||!S.clips.length)return;const B=document.getElementById('panel');if(!B||B.querySelector('#rfBox'))return;
    const d=document.createElement('div');d.id='rfBox';d.style.cssText='padding:4px 12px 14px';
    d.innerHTML='<div class="h4">📐 إعادة تأطير بضغطة (يملا الكادر)</div><div style="display:flex;flex-wrap:wrap;gap:6px">'+RF.map(r=>'<button class="btn" data-rf="'+r[0]+'">'+r[1]+'</button>').join('')+'</div>';
    B.appendChild(d);
    d.querySelectorAll('[data-rf]').forEach(b=>b.onclick=()=>{S.aspect=b.dataset.rf;setCanvasSize(quality);S.clips.forEach(c=>{c.fit='cover';c.px=0;c.py=0});dirty=true;commit();refreshAll();toast('اتعمل تأطير '+S.aspect+' ✅')});
  };
})();

/* ===== R38: text templates ===== */
(function(){
  const TT=[
    {n:'🎬 عنوان كبير',t:'عنوان الفيديو',o:{y:.45,size:12,anim:'pop',color:'#ffffff'}},
    {n:'📛 اسم تحت الشاشة',t:'الاسم | الوظيفة',o:{x:.3,y:.82,size:5,anim:'rise',bgOn:true,bg:'#1565c0',color:'#ffffff'}},
    {n:'🔔 اشترك',t:'اشترك في القناة 🔔',o:{y:.9,size:6,anim:'blink',bgOn:true,bg:'#e53935',color:'#ffffff'}},
    {n:'📰 شريط أخبار',t:'عاجل: اكتب الخبر هنا',o:{y:.92,size:5,anim:'marquee',bgOn:true,bg:'#b71c1c',color:'#ffffff'}},
    {n:'✨ اقتباس',t:'"اكتب الاقتباس هنا"',o:{y:.5,size:7,anim:'drop',color:'#ffe14d'}},
    {n:'🔢 العد التنازلي',t:'3',o:{y:.5,size:22,anim:'pop',color:'#ffffff'}}
  ];
  const orig=renderPanel;
  renderPanel=function(){orig.apply(this,arguments);
    if(S.tab!=='text')return;const B=document.getElementById('panel');if(!B||B.querySelector('#ttBox'))return;
    const d=document.createElement('div');d.id='ttBox';d.style.cssText='padding:4px 12px 14px';
    d.innerHTML='<div class="h4">🧩 قوالب نصوص جاهزة</div><div style="display:flex;flex-wrap:wrap;gap:6px">'+TT.map((r,i)=>'<button class="btn" data-tt="'+i+'">'+r.n+'</button>').join('')+'</div>';
    B.appendChild(d);
    d.querySelectorAll('[data-tt]').forEach(b=>b.onclick=()=>{const r=TT[+b.dataset.tt],x=addText(r.t);Object.assign(x,r.o);commit();refreshAll();toast('اتضاف القالب ✅')});
  };
})();

/* ===== R40: emoji stickers ===== */
(function(){
  const EM=['😂','🔥','❤️','👍','😍','😎','🎉','💯','⭐','👀','😱','🙏','💪','🚀','✅','❌','👑','🎵','💥','🤩'];
  const orig=renderPanel;
  renderPanel=function(){orig.apply(this,arguments);
    if(S.tab!=='text')return;const B=document.getElementById('panel');if(!B||B.querySelector('#emBox'))return;
    const d=document.createElement('div');d.id='emBox';d.style.cssText='padding:4px 12px 14px';
    d.innerHTML='<div class="h4">😀 ملصقات إيموجي</div><div style="display:flex;flex-wrap:wrap;gap:4px">'+EM.map(e=>'<button class="btn" data-em="'+e+'" style="font-size:20px;padding:4px 8px">'+e+'</button>').join('')+'</div>';
    B.appendChild(d);
    d.querySelectorAll('[data-em]').forEach(b=>b.onclick=()=>{const x=addText(b.dataset.em);x.size=18;x.x=.2+Math.random()*.6;x.y=.25+Math.random()*.5;x.anim='pop';x.end=x.start+2.5;commit();refreshAll()});
  };
})();

/* ===== R41: fade from/to black for the whole project ===== */
(function(){
  const o=drawFrame;
  drawFrame=function(ctx,w,h,t,opt){o.apply(this,arguments);
    const F=S.subStyle&&S.subStyle.fio;if(!F||!(total>0))return;let a=0;
    if(F.i>0&&t<F.i)a=Math.max(a,1-t/F.i);
    if(F.o>0&&t>total-F.o)a=Math.max(a,1-(total-t)/F.o);
    if(a>0){ctx.save();ctx.globalAlpha=Math.min(1,a);ctx.fillStyle=F.c==='w'?'#fff':'#000';ctx.fillRect(0,0,w,h);ctx.restore()}
  };
  const orig=renderPanel;
  renderPanel=function(){orig.apply(this,arguments);
    if(S.tab!=='export')return;const B=document.getElementById('panel');if(!B||B.querySelector('#fioBox'))return;
    const F=S.subStyle.fio||(S.subStyle.fio={i:0,o:0,c:'b'});
    const d=document.createElement('div');d.id='fioBox';d.style.cssText='padding:4px 12px 14px';
    d.innerHTML='<div class="h4">🌑 فيد بداية ونهاية الفيديو</div><div class="fld"><label>فيد في البداية (ث)</label><input type="number" data-fio="i" min="0" max="5" step="0.1" value="'+F.i+'"></div><div class="fld"><label>فيد في النهاية (ث)</label><input type="number" data-fio="o" min="0" max="5" step="0.1" value="'+F.o+'"></div><div class="fld"><label>اللون</label><select data-fio="c"><option value="b"'+(F.c==='b'?' selected':'')+'>أسود</option><option value="w"'+(F.c==='w'?' selected':'')+'>أبيض</option></select></div>';
    B.appendChild(d);
    d.querySelectorAll('[data-fio]').forEach(el=>el.addEventListener('input',()=>{const k=el.dataset.fio;F[k]=k==='c'?el.value:Math.max(0,Math.min(5,+el.value||0));dirty=true;commit()}));
  };
})();

/* ===== R43: text outline color/width + glow ===== */
(function(){
  const orig=renderPanel;
  renderPanel=function(){orig.apply(this,arguments);
    if(S.tab!=='text')return;const B=document.getElementById('panel');if(!B)return;
    const tx=S.sel&&S.sel.k==='text'&&S.texts.find(t=>t.id===S.sel.id);if(!tx||B.querySelector('#tsBox'))return;
    const d=document.createElement('div');d.id='tsBox';d.style.cssText='padding:4px 12px 14px';
    d.innerHTML='<div class="h4">🖍 حدود وتوهج النص</div><div class="fld"><label>لون الحد</label><input type="color" data-ts="stc" value="'+(tx.stc||'#000000')+'"></div><div class="fld"><label>سمك الحد</label><input type="range" data-ts="stw" min="0" max="3" step="0.1" value="'+(tx.stw==null?1:tx.stw)+'"></div><div class="fld"><label>لون التوهج</label><input type="color" data-ts="glow" value="'+(tx.glow||'#ffffff')+'"> <label class="chk"><input type="checkbox" data-ts="gon" '+(tx.glow?'checked':'')+'> تشغيل التوهج</label></div>';
    B.appendChild(d);
    d.querySelectorAll('[data-ts]').forEach(el=>el.addEventListener('input',()=>{const k=el.dataset.ts;
      if(k==='stw')tx.stw=+el.value;else if(k==='stc')tx.stc=el.value;
      else{const gc=d.querySelector('[data-ts="glow"]').value,on=d.querySelector('[data-ts="gon"]').checked;tx.glow=on?gc:null}
      dirty=true;commit()}));
  };
})();

/* ===== R44: subtitle outline + glow ===== */
(function(){
  const orig=renderPanel;
  renderPanel=function(){orig.apply(this,arguments);
    if(S.tab!=='subs')return;const B=document.getElementById('panel');if(!B||B.querySelector('#ssoBox'))return;
    const Y=S.subStyle;
    const d=document.createElement('div');d.id='ssoBox';d.style.cssText='padding:4px 12px 14px';
    d.innerHTML='<div class="h4">🖍 حدود وتوهج الترجمة</div><div class="fld"><label>لون الحد</label><input type="color" data-so="stc" value="'+(Y.stc||'#000000')+'"></div><div class="fld"><label>سمك الحد</label><input type="range" data-so="stw" min="0" max="3" step="0.1" value="'+(Y.stw==null?1:Y.stw)+'"></div><div class="fld"><label>لون التوهج</label><input type="color" data-so="glow" value="'+(Y.glow||'#19d3c5')+'"> <label class="chk"><input type="checkbox" data-so="gon" '+(Y.glow?'checked':'')+'> تشغيل التوهج</label></div>';
    B.appendChild(d);
    d.querySelectorAll('[data-so]').forEach(el=>el.addEventListener('input',()=>{const k=el.dataset.so;
      if(k==='stw')Y.stw=+el.value;else if(k==='stc')Y.stc=el.value;
      else{const gc=d.querySelector('[data-so="glow"]').value,on=d.querySelector('[data-so="gon"]').checked;Y.glow=on?gc:null}
      dirty=true;commit()}));
  };
})();

/* ===== R45: bulk subtitle tools (shift time, auto-gap fix, clear) ===== */
(function(){
  const orig=renderPanel;
  renderPanel=function(){orig.apply(this,arguments);
    if(S.tab!=='subs'||!S.subs.length)return;const B=document.getElementById('panel');if(!B||B.querySelector('#sbBox'))return;
    const d=document.createElement('div');d.id='sbBox';d.style.cssText='padding:4px 12px 14px';
    d.innerHTML='<div class="h4">🛠 أدوات الترجمة الجماعية</div><div class="fld"><label>إزاحة كل الترجمة (ثانية، سالب = أبكر)</label><input type="number" id="sbShift" step="0.1" value="0.5"></div><div style="display:flex;flex-wrap:wrap;gap:6px"><button class="btn" id="sbGo">⏱ طبّق الإزاحة</button><button class="btn" id="sbGap">🧹 سد الفراغات الصغيرة</button><button class="btn" id="sbTrim">✂ تنضيف المسافات</button></div>';
    B.appendChild(d);
    d.querySelector('#sbGo').onclick=()=>{const v=+d.querySelector('#sbShift').value||0;S.subs.forEach(s=>{const dur=s.e-s.s;s.s=Math.max(0,s.s+v);s.e=s.s+dur});S.subs.sort((a,b)=>a.s-b.s);dirty=true;commit();refreshAll();toast('اتزاحت الترجمة '+v+' ثانية ✅')};
    d.querySelector('#sbGap').onclick=()=>{let n=0;S.subs.sort((a,b)=>a.s-b.s);for(let i=0;i<S.subs.length-1;i++){const g=S.subs[i+1].s-S.subs[i].e;if(g>0&&g<.6){S.subs[i].e=S.subs[i+1].s;n++}}dirty=true;commit();refreshAll();toast('اتسدّ '+n+' فراغ ✅')};
    d.querySelector('#sbTrim').onclick=()=>{S.subs.forEach(s=>{s.t=String(s.t).replace(/[ \t]+/g,' ').replace(/\n{2,}/g,'\n').trim()});dirty=true;commit();refreshAll();toast('اتنضفت الترجمة ✅')};
  };
})();

/* ===== R51: keyframe animation (position, zoom, rotation, opacity over time) ===== */
(function(){
  const ease=x=>x*x*(3-2*x);
  function kfAt(c,lt){
    const k=c.kf;if(!k||!k.length)return null;const L=k;
    if(lt<=L[0].t)return L[0];if(lt>=L[L.length-1].t)return L[L.length-1];
    let i=0;while(i<L.length-1&&L[i+1].t<lt)i++;
    const a=L[i],b=L[i+1],u0=(lt-a.t)/Math.max(1e-6,b.t-a.t),u=c.kfe==='lin'?u0:ease(u0);
    const m=(x,y)=>x+(y-x)*u;
    return{px:m(a.px,b.px),py:m(a.py,b.py),zoom:m(a.zoom,b.zoom),rot:m(a.rot,b.rot),op:m(a.op,b.op)};
  }
  let kfC=null;
  const orig=drawClipLayer;
  drawClipLayer=function(ctx,c,a,w,h,t){
    if(!c.kf||!c.kf.length)return orig.apply(this,arguments);
    const lt=clamp(t-c._s,0,cdur(c)),v=kfAt(c,lt);
    const cc=Object.assign({},c,{px:v.px,py:v.py,zoom:v.zoom,rot:(c.rot||0)+v.rot/90});
    if(v.op>=99.5)return orig.call(this,ctx,cc,a,w,h,t);
    if(!kfC)kfC=document.createElement('canvas');if(kfC.width!==w||kfC.height!==h){kfC.width=w;kfC.height=h}
    const x=kfC.getContext('2d');x.setTransform(1,0,0,1,0,0);x.globalAlpha=1;x.globalCompositeOperation='source-over';x.clearRect(0,0,w,h);
    orig.call(this,x,cc,a,w,h,t);
    ctx.save();ctx.globalAlpha=Math.max(0,v.op/100);ctx.drawImage(kfC,0,0);ctx.restore();
  };
  window.__kfAt=kfAt;
  let sel=0;
  const origP=renderPanel;
  renderPanel=function(){origP.apply(this,arguments);
    if(S.tab!=='fx')return;const c=S.sel&&S.sel.k==='clip'?selObj():null;if(!c)return;
    const B=document.getElementById('panel');if(!B)return;{const o=B.querySelector('#kfBox');if(o)o.remove()}
    const L=c.kf||(c.kf=[]);if(sel>=L.length)sel=Math.max(0,L.length-1);
    const lt=clamp(S.playhead-c._s,0,cdur(c));
    const d=document.createElement('div');d.id='kfBox';d.style.cssText='padding:4px 12px 14px';
    const cur=L[sel];
    const row=(k,lab,min,max,step,u)=>cur?'<div class="fld"><label>'+lab+' <b>'+(+cur[k]).toFixed(k==='zoom'||k==='op'||k==='rot'?0:1)+u+'</b></label><input type="range" data-kv="'+k+'" min="'+min+'" max="'+max+'" step="'+step+'" value="'+cur[k]+'"></div>':'';
    d.innerHTML='<div class="h4">🎬 كي فريم (حركة على المقطع)</div><p class="hint">ضيف نقطة عند أي وقت وغيّر الموضع والزووم والدوران والشفافية، والمقطع بيتحرك بينهم لوحده. لما تضيف كي فريم، سلايدرات الموضع والزووم العادية بتتجاهل.</p>'+
      '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px"><button class="btn" id="kfAdd">＋ كي فريم عند المؤشر</button>'+(L.length?'<button class="btn" id="kfDel">🗑 احذف المحدد</button><button class="btn" id="kfClr">مسح الكل</button>':'')+'</div>'+
      (L.length?'<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px">'+L.map((k,i)=>'<button class="btn'+(i===sel?' on':'')+'" data-kfi="'+i+'" style="'+(i===sel?'outline:2px solid #7c5cff':'')+'">'+k.t.toFixed(1)+'ث</button>').join('')+'</div>':'')+
      row('px','أفقي',-100,100,1,'%')+row('py','رأسي',-100,100,1,'%')+row('zoom','زووم',20,400,1,'%')+row('rot','دوران',-180,180,1,'°')+row('op','شفافية',0,100,1,'%')+
      (L.length>1?'<div class="fld"><label>نعومة الحركة</label><select id="kfE"><option value="ease"'+(c.kfe!=='lin'?' selected':'')+'>ناعمة</option><option value="lin"'+(c.kfe==='lin'?' selected':'')+'>خطية</option></select></div>':'');
    B.appendChild(d);
    d.querySelector('#kfAdd').onclick=()=>{const lt=clamp(S.playhead-c._s,0,cdur(c));const v=kfAt(c,lt)||{px:c.px||0,py:c.py||0,zoom:c.zoom||100,rot:0,op:100};const t=+lt.toFixed(2);const ex=L.findIndex(k=>Math.abs(k.t-t)<.05);
      if(ex>=0){sel=ex}else{L.push({t,px:v.px,py:v.py,zoom:v.zoom,rot:v.rot,op:v.op});L.sort((a,b)=>a.t-b.t);sel=L.findIndex(k=>k.t===t)}
      dirty=true;commit();refreshAll()};
    const del=d.querySelector('#kfDel');if(del)del.onclick=()=>{L.splice(sel,1);sel=0;dirty=true;commit();refreshAll()};
    const clr=d.querySelector('#kfClr');if(clr)clr.onclick=()=>{c.kf=[];sel=0;dirty=true;commit();refreshAll()};
    d.querySelectorAll('[data-kfi]').forEach(b=>b.onclick=()=>{sel=+b.dataset.kfi;seekTo(c._s+L[sel].t);renderPanel()});
    d.querySelectorAll('[data-kv]').forEach(el=>el.addEventListener('input',()=>{cur[el.dataset.kv]=+el.value;el.previousElementSibling.querySelector('b').textContent=el.value+(el.dataset.kv==='rot'?'°':'%');dirty=true;commit()}));
    const e=d.querySelector('#kfE');if(e)e.onchange=()=>{c.kfe=e.value;dirty=true;commit();refreshAll()};
  };
})();
