// @ts-nocheck
/* The wardrobe planner (/wardrobe-planner), mounted by wardrobe-planner.tsx. Plain DOM + three.js, ported from the
   preview Raf approved on 14 Oct 2026 (Claude artifact "Raf Carpentry Wardrobe Planner"). The customer sets the space
   (width, ceiling, walls either side or freestanding, plinth, top infill, depth), picks units from standard carcass
   widths or a custom width ("Fill my wall" chooses standard sizes that leave 20 to 100 mm scribe fillers), doors,
   handles and a colour preview, sees it in 3D or as a dimensioned front drawing, and sends it with the same
   Send to Raf as Plan your project (POST /api/brief: a Quote job in ServiceM8 and an email to Raf).
   Sizes, colours and limits Raf may want to change are in CFG at the top. Nothing is stored on the website. */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export function mountPlanner(host: HTMLElement, endpoint = '/api/brief'): () => void {
  let raf = 0, sending = false;
  const t0 = performance.now();
  const observers: ResizeObserver[] = [];
  const offs: (() => void)[] = [];
  const on = (el, ev, fn, o?) => { if (!el) return; el.addEventListener(ev, fn, o); offs.push(() => el.removeEventListener(ev, fn, o)); };

/* ================= SETTINGS RAF CAN EDIT ================= */
const CFG={
  standardWidths:[300,400,450,500,600,800,900,1000],   // carcass widths, mm
  customMin:150, customMax:1200,                        // custom unit width range, mm
  scribe:{min:20,max:100},                              // filler at a wall, each end, mm
  endPanel:18,                                          // finished end panel at an open end, mm
  depth:{hinged:600,sliding:650,shallow:450,min:350,max:800},
  topSplit:2100, topMin:250,                            // top cupboards start at 2100 if at least 250 mm is left above
  plinths:[70,100,150], plinthMax:250,                  // plinth height choices, mm
  infills:[50,100,150], infillMax:400,                  // top infill (scribed to the ceiling) choices, mm
  freeHeight:2100,                                      // default height of a freestanding unit, mm
  layouts:{double:'Double hanging',long:'Long hanging',longdrw:'Long hanging + drawers',short:'Short hanging over shoes',drawers:'Drawers + shelves',shelves:'Shelves'},
  styles:{shaker:'Shaker',slab:'Flat slab',mirror:'Mirror'},
  handles:{brass:'Brass bar',black:'Black bar',knob:'Brass knob',push:'Push to open'},
  colours:[
    {k:'chalk',n:'Chalk',c:'#E6E0D3'},{k:'white',n:'Soft white',c:'#F1F0EA'},{k:'sage',n:'Sage',c:'#8C9C82'},
    {k:'pebble',n:'Pebble grey',c:'#A5A59D'},{k:'ink',n:'Inky blue',c:'#34465E'},{k:'green',n:'Deep green',c:'#3F5546'},
    {k:'clay',n:'Clay pink',c:'#C9A497'},{k:'charcoal',n:'Charcoal',c:'#3A3B3C'},{k:'mdf',n:'Unpainted MDF',c:'#B89C79'}],
  phone:'07792 860221', email:'info@rafcarpentry.com'
};
/* ========================================================== */

const $=s=>host.querySelector(s);
const MM=0.001, clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let uid=1;const mk=(w,layout)=>({id:'m'+(uid++),w,custom:!CFG.standardWidths.includes(w),layout});
const S={wall:2800,ceiling:2400,fit:'wall',plinth:100,plinthCustom:false,infill:50,infillCustom:false,freeH:CFG.freeHeight,depthMode:'std',depthCustom:600,height:'full',doors:'hinged',style:'shaker',handle:'brass',colour:'sage',
  modules:[mk(900,'double'),mk(900,'longdrw'),mk(900,'short')],sel:0,step:0,view:'3d',open:false,sent:false,
  contact:{name:'',email:'',phone:'',postcode:'',when:'',notes:'',company:''}};
const colour=()=>CFG.colours.find(c=>c.k===S.colour)||CFG.colours[0];
function depth(){if(S.depthMode==='custom')return clamp(S.depthCustom,CFG.depth.min,CFG.depth.max);if(S.depthMode==='shallow'&&S.doors==='hinged')return CFG.depth.shallow;return S.doors==='sliding'?CFG.depth.sliding:CFG.depth.hinged;}
const free=()=>S.fit==='free';
const infill=()=>free()?0:S.infill;
const topY=()=>free()?Math.min(S.freeH,S.ceiling-20):S.ceiling-infill();
const topOk=()=>topY()-CFG.topSplit>=CFG.topMin;
const mainH=()=>S.height==='top'&&topOk()?CFG.topSplit:topY();
function calc(){
  const fr=free(),ends=S.fit==='wall'?2:fr?0:1,panels=S.fit==='wall'?0:fr?2:1,mods=S.modules.reduce((a,m)=>a+m.w,0),run=mods+panels*CFG.endPanel,left=S.wall-run,f=ends?left/ends:0;
  let lv='ok',t,sub;
  if(!S.modules.length){lv='warn';t='Add a unit to start';}
  else if(fr){if(left<0){lv='bad';t=`Too wide by ${-left} mm`;}else t=`Fits · ${left} mm spare`;}
  else if(f<CFG.scribe.min){lv='bad';t=`Too wide by ${Math.ceil(CFG.scribe.min*ends-left)} mm`;}
  else if(f>CFG.scribe.max){lv='warn';t=`${Math.round(left)} mm gap to fill`;}
  else t=ends===2?`Fits · ${Math.round(f)} mm filler each end`:`Fits · ${Math.round(f)} mm filler at the wall`;
  sub=fr?`Units ${mods} + end panels 18 + 18 = ${run} of ${S.wall}`:`Units ${mods}${panels?' + end panel 18':''} + filler${ends===2?'s':''} ${ends===2?Math.round(f)+' / '+Math.round(f):Math.round(f)} = ${S.wall}`;
  // x positions (mm from the left of the space)
  let x0;if(S.fit==='wall'||S.fit==='openR')x0=Math.max(0,f);else x0=CFG.endPanel+Math.max(0,S.wall-run-f);
  if(S.fit==='openL')x0=Math.max(CFG.endPanel,S.wall-Math.max(0,f)-mods);
  if(fr)x0=CFG.endPanel+Math.max(0,left/2);
  const pos=[];let x=x0;for(const m of S.modules){pos.push(x);x+=m.w;}
  return{ends,panels,mods,run,left,f,lv,t,sub,x0,x1:x,pos};
}
function hingedCount(w){return w<=600?1:2;}
function slidingCount(run){return Math.max(2,Math.round(run/900),Math.ceil(run/1200));}

/* ---------- smart fill ---------- */
function layoutFor(w,i,n){if(w<450)return'shelves';if(w<=600)return i%2?'drawers':'short';const seq=['double','longdrw','long','double'];return seq[i%seq.length];}
function autoFill(){
  const fr=free(),ends=S.fit==='wall'?2:1,panels=S.fit==='wall'?0:fr?2:1,A=S.wall-panels*CFG.endPanel,W=CFG.standardWidths,minF=fr?0:CFG.scribe.min,maxF=fr?150:CFG.scribe.max;let best=null;
  for(let n=1;n<=12;n++)for(const w1 of W)for(const w2 of W){if(w2>w1)continue;for(let k=1;k<=n;k++){if(w1===w2&&k!==n)continue;
    const tot=k*w1+(n-k)*w2,f=(A-tot)/ends;if(f<minF||f>maxF)continue;
    const mixed=w1!==w2&&k<n,avg=tot/n;const sc=f*0.5+(mixed?45:0)+Math.abs(avg-850)*0.06+(w2<450?70:0)+n*6;
    if(!best||sc<best.sc)best={sc,n,w1,w2,k,f};}}
  let widths=[];
  if(best){const big=Array(best.k).fill(best.w1),small=Array(best.n-best.k).fill(best.w2);
    if(small.length){const h=Math.ceil(big.length/2);widths=[...big.slice(0,h),...small,...big.slice(h)];}else widths=big;}
  else{const n=Math.max(1,Math.round(A/900)),w=Math.floor(clamp((A-ends*40)/n,CFG.customMin,CFG.customMax));widths=Array(n).fill(w);}
  S.modules=widths.map((w,i)=>mk(w,layoutFor(w,i,widths.length)));S.sel=0;
  return best?(fr?`${widths.length} × standard units, ${Math.round(best.f)} mm spare`:`${widths.length} × standard units, ${Math.round(best.f)} mm filler${ends===2?' each end':''}`):`${widths.length} custom ${widths[0]} mm units`;
}

/* ---------- three.js ---------- */
const stage=$('#stage');let renderer=null,scene,cam,ctl,root,needs=true;const doors=[],picks=[];
const texCache=new Map(),matCache=new Map();
const lin=h=>new THREE.Color(h);
function shade(hex,f){const c=new THREE.Color(hex);c.lerp(new THREE.Color(f>0?'#ffffff':'#000000'),Math.abs(f));return'#'+c.getHexString();}
function rng(s){return()=>{s=(s*9301+49297)%233280;return s/233280;};}
function ctex(key,w,h,draw,rep){if(texCache.has(key))return texCache.get(key);const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;if(rep)t.wrapS=t.wrapT=THREE.RepeatWrapping;texCache.set(key,t);return t;}
function std(hex,r=0.8,m=0,x){const k=hex+r+m+(x?JSON.stringify(x):'');if(!matCache.has(k))matCache.set(k,new THREE.MeshStandardMaterial(Object.assign({color:lin(hex),roughness:r,metalness:m},x||{})));return matCache.get(k);}
const floorTex=()=>ctex('floor',512,512,(g,W,H)=>{const sh=['#D3A56C','#CB9D63','#D8AC74','#C6975E'],r=rng(3),n=7;for(let i=0;i<n;i++){const x0=i*W/n;g.fillStyle=sh[i%4];g.fillRect(x0,0,W/n,H);
  for(let j=0;j<18;j++){g.strokeStyle=shade(sh[i%4],-0.3);g.globalAlpha=0.1+r()*0.18;g.lineWidth=1;const x=x0+r()*W/n;g.beginPath();g.moveTo(x,0);g.lineTo(x+r()*4-2,H);g.stroke();}
  g.globalAlpha=1;g.fillStyle='#7A5A36';g.fillRect(x0,0,2,H);g.fillRect(x0,(r()*H)|0,W/n,2);}},true);
function faceMat(wm,hm){
  if(S.style==='mirror'){return matCache.get('mirror')||(matCache.set('mirror',new THREE.MeshStandardMaterial({roughness:0.12,metalness:0.15,map:ctex('mirrortex',128,512,(g,W,H)=>{const gr=g.createLinearGradient(0,0,W,H);gr.addColorStop(0,'#EEF3F6');gr.addColorStop(0.45,'#B9C6CF');gr.addColorStop(0.55,'#D9E2E8');gr.addColorStop(1,'#9FAFBA');g.fillStyle=gr;g.fillRect(0,0,W,H);g.fillStyle='rgba(255,255,255,.35)';g.beginPath();g.moveTo(W*0.2,0);g.lineTo(W*0.42,0);g.lineTo(W*0.02,H*0.6);g.lineTo(0,H*0.4);g.fill();})})),matCache.get('mirror'));}
  const c=colour().c,st=S.style,mid=st==='shaker'&&hm>1.6,key=['face',st,c,wm.toFixed(2),hm.toFixed(2)].join('|');
  if(matCache.has(key))return matCache.get(key);
  const t=ctex(key,clamp(Math.round(wm*170),32,512),clamp(Math.round(hm*170),32,1024),(g,W,H)=>{g.fillStyle=c;g.fillRect(0,0,W,H);
    if(st==='shaker'){const f=Math.max(6,Math.min(W,H)*0.13,12);const rs=mid&&H>W*1.6?[[f,f,W-2*f,H*0.46-f*1.5],[f,H*0.46+f*0.5,W-2*f,H*0.54-f*1.5]]:[[f,f,W-2*f,H-2*f]];
      for(const [x,y,w,h] of rs){if(w<4||h<4)continue;g.fillStyle=shade(c,-0.035);g.fillRect(x,y,w,h);g.strokeStyle=shade(c,-0.28);g.lineWidth=2.5;g.strokeRect(x,y,w,h);g.strokeStyle=shade(c,0.35);g.lineWidth=1.5;g.beginPath();g.moveTo(x+2,y+h+2);g.lineTo(x+w+2,y+h+2);g.lineTo(x+w+2,y+2);g.stroke();}}
    g.strokeStyle=shade(c,-0.22);g.lineWidth=2;g.strokeRect(1,1,W-2,H-2);});
  const m=new THREE.MeshStandardMaterial({map:t,roughness:0.55});matCache.set(key,m);return m;
}
const fin=()=>std(colour().c,0.58),inner=()=>std('#ECE9E2',0.7),brass=()=>std('#B8924F',0.32,0.85),black=()=>std('#222426',0.4,0.5),alu=()=>std('#B8BCBE',0.35,0.75);
const GAR=['#5B6E82','#C9B79A','#33404D','#9C5546','#E4DED2','#56634F','#7F6A8C','#C78F4A'];
function box(p,x0,y0,z0,x1,y1,z1,m){const w=Math.abs(x1-x0),h=Math.abs(y1-y0),d=Math.abs(z1-z0);if(w<0.0005||h<0.0005||d<0.0005)return null;const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set((x0+x1)/2,(y0+y1)/2,(z0+z1)/2);o.castShadow=o.receiveShadow=true;p.add(o);return o;}
function cyl(p,x,y,z,r,len,m,ax){const o=new THREE.Mesh(new THREE.CylinderGeometry(r,r,len,10),m);if(ax==='x')o.rotation.z=Math.PI/2;if(ax==='z')o.rotation.x=Math.PI/2;o.position.set(x,y,z);o.castShadow=true;p.add(o);return o;}
const ease=t=>t<0.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
const doorState=new Map();const rec=k=>{if(!doorState.has(k))doorState.set(k,{p:0,t:0});return doorState.get(k);};
function applyDoor(o){const e=ease(o.st.p);if(o.kind==='h')o.pivot.rotation.y=o.sign*1.72*e;else o.pivot.position.x=o.x0+o.dir*o.dist*e;}
function handle(par,x,y,z,tall){
  if(S.handle==='push')return;const m=S.handle==='black'?black():brass();
  if(S.handle==='knob'){const k=new THREE.Mesh(new THREE.SphereGeometry(0.017,12,10),m);k.position.set(x,y,z+0.02);par.add(k);return k;}
  const h=cyl(par,x,y,z+0.03,0.0065,tall?0.28:0.14,m,tall?null:'x');[-1,1].forEach(s=>{const p=new THREE.Mesh(new THREE.BoxGeometry(0.008,0.008,0.024),m);p.position.set(tall?x:x+s*0.06,tall?y+s*0.12:y,z+0.015);par.add(p);});return h;}
function hinged(par,key,x0,x1,y0,y1,z,n,firstLeft){
  const gap=0.003,dw=(x1-x0)/n,dh=y1-y0-2*gap,ww=dw-2*gap;if(ww<0.05||dh<0.05)return;const f=fin(),face=faceMat(ww,dh);
  for(let i=0;i<n;i++){const left=n===1?firstLeft:i%2===0;
    const pv=new THREE.Group();pv.position.set(left?x0+i*dw+gap:x0+(i+1)*dw-gap,y0+gap,z);par.add(pv);
    const m=new THREE.Mesh(new THREE.BoxGeometry(ww,dh,0.018),[f,f,f,f,face,f]);m.position.set(left?ww/2:-ww/2,dh/2,0.009);m.castShadow=m.receiveShadow=true;pv.add(m);
    const tall=dh>1.0,hy=tall?clamp(1.05-y0,0.3,dh-0.3):(y0>1.5?0.08:dh-0.08);
    const h=handle(pv,left?ww-0.045:-ww+0.045,hy,0.018,tall);
    const o={pivot:pv,kind:'h',sign:left?-1:1,st:rec(key+':'+i)};applyDoor(o);doors.push(o);m.userData.door=o;if(h)h.userData.door=o;picks.push(m);}
}
function sliding(par,x0,x1,y0,y1,zb,n){
  const ov=0.03,dw=((x1-x0)+ov*(n-1))/n,dh=y1-y0,f=fin(),face=faceMat(dw,dh);
  for(let i=0;i<n;i++){const tr=i%2,z=zb+(tr?0.038:0.006),x=x0+i*(dw-ov),dir=i<n-1?1:-1;
    const pv=new THREE.Group();pv.position.set(x,y0,z);par.add(pv);
    const m=new THREE.Mesh(new THREE.BoxGeometry(dw,dh,0.022),[alu(),alu(),alu(),alu(),face,f]);m.position.set(dw/2,dh/2,0.011);m.castShadow=m.receiveShadow=true;pv.add(m);
    if(S.handle!=='push'){const hm=S.handle==='black'?black():brass();box(pv,dir>0?0.03:dw-0.042,clamp(1.05-y0,0.4,dh-0.4)-0.25,0.022,dir>0?0.042:dw-0.03,clamp(1.05-y0,0.4,dh-0.4)+0.25,0.032,hm);}
    const o={pivot:pv,kind:'s',x0:x,dir,dist:dw-ov,st:rec('s'+n+':'+i)};applyDoor(o);doors.push(o);m.userData.door=o;picks.push(m);}
}
function interior(par,type,x0,x1,yb,yt,z0,z1){
  const im=inner(),zc=(z0+z1)/2,hz=Math.min(0.21,(z1-z0)/2-0.02),shallow=z1-z0<0.5;
  const shelf=(y,a=x0,b=x1)=>box(par,a,y,z0,b,y+0.018,z1,im);
  const hang=(y,a,b,len)=>{if(b-a<0.12)return;
    if(shallow){cyl(par,(a+b)/2,y,zc,0.0125,z1-z0-0.04,brass(),'z');const cnt=clamp(Math.floor((z1-z0)/0.07),2,5);for(let k=0;k<cnt;k++){const z=z0+0.04+k*((z1-z0-0.08)/Math.max(1,cnt-1));box(par,(a+b)/2-0.2,y-len,z-0.011,(a+b)/2+0.2,y-0.035,z+0.011,std(GAR[k%GAR.length],0.95));}return;}
    cyl(par,(a+b)/2,y,zc,0.0125,b-a-0.004,brass(),'x');const cnt=clamp(Math.floor((b-a)/0.085),1,9);
    for(let k=0;k<cnt;k++){const x=a+0.045+k*((b-a-0.09)/Math.max(1,cnt-1)),L=len*(0.82+((k*37)%10)/50);box(par,x-0.011,y-L,zc-hz,x+0.011,y-0.035,zc+hz,std(GAR[(k+Math.round(a*13))%GAR.length],0.95));}};
  const drawers=(a,b,yS,c)=>{for(let i=0;i<c;i++){const y=yS+i*0.2;box(par,a+0.004,y+0.004,z0+0.02,b-0.004,y+0.192,z1-0.03,im);box(par,a+0.004,y+0.004,z1-0.03,b-0.004,y+0.192,z1-0.012,std('#DEDAD2',0.6));cyl(par,(a+b)/2,y+0.13,z1-0.004,0.005,Math.min(0.12,(b-a)*0.4),brass(),'x');}return yS+c*0.2;};
  switch(type){
    case'double':hang(yt-0.07,x0,x1,0.82);hang(Math.min(1.08,(yb+yt)/2),x0,x1,0.76);break;
    case'long':hang(yt-0.07,x0,x1,1.28);shelf(yb+0.2);break;
    case'short':hang(yt-0.07,x0,x1,0.85);[0.16,0.36,0.56].forEach(o=>shelf(yb+o));break;
    case'drawers':{const y=drawers(x0,x1,yb,4);for(let yy=y+0.32;yy<yt-0.14;yy+=0.33)shelf(yy);break;}
    case'longdrw':{const m=(x0+x1)/2;box(par,m-0.009,yb,z0,m+0.009,yt,z1,im);hang(yt-0.07,x0,m-0.009,1.28);shelf(yb+0.2,x0,m-0.009);const y=drawers(m+0.009,x1,yb,4);for(let yy=y+0.32;yy<yt-0.14;yy+=0.33)shelf(yy,m+0.009,x1);break;}
    default:for(let yy=yb+0.33;yy<yt-0.14;yy+=0.33)shelf(yy);
  }
}
function carcass(par,x0,x1,h0,h1,d,zi){
  const T=0.018,f=fin(),im=inner();
  box(par,x0,h0,0,x0+T,h1,zi,f);box(par,x1-T,h0,0,x1,h1,zi,f);box(par,x0+T,h1-T,0,x1-T,h1,zi,f);box(par,x0+T,h0,0,x1-T,h0+T,zi,im);box(par,x0+T,h0+T,0,x1-T,h1-T,T,im);
}
function initGL(){
  try{renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:false});}catch(e){renderer=null;}
  if(!renderer){$('#nogl').hidden=false;return false;}
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.75));renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;stage.appendChild(renderer.domElement);
  on(renderer.domElement,'webglcontextlost',e=>{e.preventDefault();$('#nogl').hidden=false;});
  scene=new THREE.Scene();scene.background=new THREE.Color('#f1f2ef');
  cam=new THREE.PerspectiveCamera(45,1,0.05,60);
  ctl=new OrbitControls(cam,renderer.domElement);ctl.enableDamping=true;ctl.dampingFactor=0.09;ctl.enablePan=false;
  ctl.minAzimuthAngle=-1.0;ctl.maxAzimuthAngle=1.0;ctl.minPolarAngle=0.9;ctl.maxPolarAngle=1.72;ctl.minDistance=1.2;ctl.maxDistance=9;
  scene.add(new THREE.HemisphereLight(0xffffff,0xb7ae9e,0.62*Math.PI));scene.add(new THREE.AmbientLight(0xffffff,0.15*Math.PI));
  const sun=new THREE.DirectionalLight(0xfff3e2,0.8*Math.PI);sun.position.set(1.5,4,4);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.bias=-0.0004;sun.shadow.normalBias=0.025;
  const sc=sun.shadow.camera;sc.left=-4;sc.right=4;sc.top=4;sc.bottom=-4;sc.near=0.5;sc.far=12;scene.add(sun);
  const fill=new THREE.PointLight(0xfff0d8,2.5,0,2);fill.position.set(0,2.2,2.2);scene.add(fill);
  let down=null;
  on(renderer.domElement,'pointerdown',e=>{down={x:e.clientX,y:e.clientY,t:performance.now()};});
  on(renderer.domElement,'pointerup',e=>{if(!down)return;const d=Math.hypot(e.clientX-down.x,e.clientY-down.y),dt=performance.now()-down.t;down=null;if(d<8&&dt<450)tap(e);});
  const ro1=new ResizeObserver(resize);ro1.observe(stage);observers.push(ro1);resize();
  raf=requestAnimationFrame(loop);return true;
}
function resize(){if(!renderer)return;const r=stage.getBoundingClientRect();if(!r.width||!r.height)return;renderer.setSize(r.width,r.height);cam.aspect=r.width/r.height;cam.updateProjectionMatrix();needs=true;if(S.view==='draw')drawPlan();}
let lastFrameW=0;
function frameCam(force){const W=S.wall*MM,H=S.ceiling*MM;if(!force&&Math.abs(W-lastFrameW)<0.05)return;lastFrameW=W;
  const vf=cam.fov*Math.PI/180,hf=2*Math.atan(Math.tan(vf/2)*cam.aspect),need=1.1*Math.max((W/2+0.45)/Math.tan(hf/2),(H/2+0.4)/Math.tan(vf/2));
  ctl.target.set(0,H*0.48,0.3);const az=0.32;cam.position.set(Math.sin(az)*need,H*0.5+0.15,0.3+Math.cos(az)*need);ctl.update();needs=true;}
function build(){
  if(!renderer)return;
  if(root){scene.remove(root);root.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.userData.own&&o.material)o.material.dispose();});}
  doors.length=0;picks.length=0;root=new THREE.Group();scene.add(root);
  const c=calc(),W=S.wall*MM,H=S.ceiling*MM,D=depth()*MM,X=mm=>-W/2+mm*MM,wallM=std('#E5E3DD',0.95),side=0.12,ext=S.fit==='wall'?0:1.2,fr=free();
  const fl=new THREE.Mesh(new THREE.PlaneGeometry(W+2*ext+0.4,2.6),new THREE.MeshStandardMaterial({map:(()=>{const t=floorTex();t.repeat.set((W+2*ext)/1.3,2);return t;})(),roughness:0.72}));
  fl.material.userData={};fl.userData.own=true;fl.rotation.x=-Math.PI/2;fl.position.set(0,0,1.3);fl.receiveShadow=true;root.add(fl);
  box(root,-W/2-side-(S.fit==='openL'||fr?ext:0),0,-0.1,W/2+side+(S.fit==='openR'||fr?ext:0),H+0.12,0,wallM);
  if(S.fit!=='openL'&&!fr)box(root,-W/2-side,0,0,-W/2,H+0.12,1.1,wallM);
  if(S.fit!=='openR'&&!fr)box(root,W/2,0,0,W/2+side,H+0.12,1.1,wallM);
  const ce=new THREE.Mesh(new THREE.PlaneGeometry(W+2*ext+0.3,1.1),std('#F6F5F2',0.95));ce.rotation.x=Math.PI/2;ce.position.set(0,H,0.55);root.add(ce);
  const hinge=S.doors==='hinged',zi=hinge?D-0.018:D-0.085,mh=mainH()*MM,TY=topY()*MM,top=mh<TY-0.01,P=Math.max(0,S.plinth*MM);
  // fillers + end panel
  const f=fin();
  if(S.modules.length){const fl=(a,b)=>{if(b-a>0.002)box(root,a,0,0,b,H,D,f);};
    if(S.fit==='wall'){fl(-W/2,X(c.x0));fl(X(c.x1),W/2);}
    if(S.fit==='openR'){fl(-W/2,X(c.x0));box(root,X(c.x1),0,0,X(c.x1)+0.018,H,D+0.002,f);}
    if(S.fit==='openL'){fl(X(c.x1),W/2);box(root,X(c.x0)-0.018,0,0,X(c.x0),H,D+0.002,f);}
    if(fr){box(root,X(c.x0)-0.018,0,0,X(c.x0),TY-0.018,D+0.002,f);box(root,X(c.x1),0,0,X(c.x1)+0.018,TY-0.018,D+0.002,f);box(root,X(c.x0)-0.018,TY-0.018,0,X(c.x1)+0.018,TY,D+0.004,f);}
    else if(infill()>0){const L=S.fit==='openL'?X(c.x0)-0.018:-W/2,R=S.fit==='openR'?X(c.x1)+0.018:W/2;box(root,L,TY,0,R,H,D+0.003,f);}
    if(P>0.002)box(root,X(c.x0),0,0,X(c.x1),P,zi-0.05,std(shade(colour().c,-0.3),0.7));}
  S.modules.forEach((m,i)=>{
    const a=X(c.pos[i]),b=a+m.w*MM,g=new THREE.Group();root.add(g);
    const cTop=fr&&!top?mh-0.018:mh;carcass(g,a,b,P,cTop,D,zi);
    interior(g,m.layout,a+0.018,b-0.018,P+0.018,mh>2.35?mh-0.33:cTop-0.018,0.018,zi-0.01);
    if(mh>2.35)box(g,a+0.018,mh-0.33,0.018,b-0.018,mh-0.312,zi-0.01,inner());
    if(hinge)hinged(g,m.id,a,b,P,cTop,zi,hingedCount(m.w),i%2===0);
    if(top){const tt=fr?TY-0.018:TY;carcass(g,a,b,mh,tt,D,D-0.018);hinged(g,m.id+'t',a,b,mh,tt,D-0.018,hingedCount(m.w),i%2===0);}
    g.traverse(o=>{if(o.isMesh){o.userData.mod=i;if(!o.userData.door)picks.push(o);}});
    if(i===S.sel){const bx=new THREE.Box3();g.traverse(o=>{if(o.isMesh&&!o.userData.door)bx.expandByObject(o);});bx.expandByScalar(0.01);const hp=new THREE.Box3Helper(bx,new THREE.Color('#2547d0'));hp.material.depthTest=false;hp.material.transparent=true;hp.material.toneMapped=false;hp.renderOrder=5;hp.userData.own=true;root.add(hp);}
  });
  if(!hinge&&S.modules.length){const a=X(c.x0),b=X(c.x1),n=slidingCount(c.mods),mt=fr&&!top?mh-0.018:mh;box(root,a,mt-0.045,zi,b,mt,D,alu());box(root,a,P,zi,b,P+0.012,D,alu());sliding(root,a,b,P+0.012,mt-0.045,zi,n);}
  frameCam(false);needs=true;
}
function tap(e){if(!renderer)return;const r=renderer.domElement.getBoundingClientRect(),v=new THREE.Vector2(((e.clientX-r.left)/r.width)*2-1,-((e.clientY-r.top)/r.height)*2+1),ray=new THREE.Raycaster();ray.setFromCamera(v,cam);
  const h=ray.intersectObjects(picks,false)[0];if(!h)return;
  if(h.object.userData.door){const o=h.object.userData.door,opening=o.st.t<0.5;if(opening&&o.kind==='s')doors.forEach(d=>{if(d!==o&&d.kind==='s')d.st.t=0;});o.st.t=opening?1:0;return;}
  if(h.object.userData.mod!=null){S.sel=h.object.userData.mod;S.step=1;build();render();}}
let last=performance.now();
function loop(now){raf=requestAnimationFrame(loop);const dt=Math.min(0.05,(now-last)/1000);last=now;let act=ctl.update();
  for(const o of doors){const s=o.st;if(s.p!==s.t){s.p=s.t>s.p?Math.min(s.t,s.p+dt*2.2):Math.max(s.t,s.p-dt*2.2);applyDoor(o);act=true;}}
  if((act||needs)&&S.view==='3d'){renderer.render(scene,cam);needs=false;}}
function toggleDoors(){
  const ss=doors.filter(o=>o.kind==='s');
  if(ss.length){const i=ss.findIndex(o=>o.st.t>0.5),nx=i+1;ss.forEach(o=>o.st.t=0);if(nx<ss.length){ss[nx].st.t=1;$('#openBtn').textContent=nx===ss.length-1?'Close doors':'Next door';}else $('#openBtn').textContent='Open doors';}
  else{const open=doors.some(o=>o.st.t<0.5);doors.forEach(o=>o.st.t=open?1:0);$('#openBtn').textContent=open?'Close doors':'Open doors';}
  if(S.view!=='3d')setView('3d');
}

/* ---------- elevation drawing ---------- */
function drawPlan(){
  const el=$('#drawing'),r=el.getBoundingClientRect();if(!r.width)return;
  const c=calc(),fr=free(),BW=r.width,BH=r.height,pl=64,pr=78,pt=112,pb=72,s=Math.min((BW-pl-pr)/S.wall,(BH-pt-pb)/S.ceiling);
  const ox=pl+((BW-pl-pr)-S.wall*s)/2,X=mm=>ox+mm*s,Y=mm=>pt+(S.ceiling-mm)*s,B='#2547d0',I='#14202E',M='#8994A2';
  const o=[],f1=n=>n.toFixed(1);
  const ln=(x1,y1,x2,y2,st='',sw=1,col=I)=>o.push(`<line x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(x2)}" y2="${f1(y2)}" stroke="${col}" stroke-width="${sw}" ${st}/>`);
  const rc=(x,y,w,h,fill='none',st='',sw=1.2,col=I)=>o.push(`<rect x="${f1(x)}" y="${f1(y)}" width="${f1(Math.max(0,w))}" height="${f1(Math.max(0,h))}" fill="${fill}" stroke="${col}" stroke-width="${sw}" ${st}/>`);
  const tx=(x,y,t,anchor='middle',col=B,size=11,rot)=>o.push(`<text x="${f1(x)}" y="${f1(y)}" text-anchor="${anchor}" fill="${col}" style="font-family:var(--font-mono),ui-monospace,monospace" font-size="${size}" font-weight="500"${rot?` transform="rotate(${rot} ${f1(x)} ${f1(y)})"`:''}>${esc(t)}</text>`);
  const tick=(x,y)=>ln(x-4,y+4,x+4,y-4,'',1.2,B);
  const dimH=(a,b,y,label)=>{const x1=X(a),x2=X(b);if(x2-x1<0.5)return;ln(x1,y,x2,y,'',1,B);[x1,x2].forEach(x=>{tick(x,y);ln(x,y-7,x,y+7,'',0.8,B);});tx((x1+x2)/2,y-6,label,'middle',B,x2-x1>26?11:9);};
  const dimV=(a,b,x,label,left)=>{const y1=Y(a),y2=Y(b);if(y1-y2<0.5)return;ln(x,y1,x,y2,'',1,B);[y1,y2].forEach(y=>{tick(x,y);ln(x-7,y,x+7,y,'',0.8,B);});
    if(y1-y2>30)tx(left?x-8:x+14,(y1+y2)/2,label,'middle',B,11,-90);else tx(left?x-10:x+10,(y1+y2)/2+3,label,left?'end':'start',B,9);};
  o.push(`<defs><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="${M}" stroke-width="1"/></pattern><pattern id="fill" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)"><line x1="0" y1="0" x2="0" y2="5" stroke="${B}" stroke-opacity=".35" stroke-width="1"/></pattern></defs>`);
  const leftWall=S.fit==='wall'||S.fit==='openR',rightWall=S.fit==='wall'||S.fit==='openL';
  if(leftWall)rc(X(0)-14,Y(S.ceiling)-10,14,S.ceiling*s+10,'url(#hatch)','',0.8,M);
  if(rightWall)rc(X(S.wall),Y(S.ceiling)-10,14,S.ceiling*s+10,'url(#hatch)','',0.8,M);
  ln(X(0)-30,Y(0),X(S.wall)+30,Y(0),'',2);ln(X(0)-20,Y(S.ceiling),X(S.wall)+20,Y(S.ceiling),'stroke-dasharray="6 4"',1,M);
  const P=S.plinth,mh=mainH(),ty=topY(),top=mh<ty-5,EP=CFG.endPanel,has=S.modules.length>0;
  if(has){
    // side fillers and end panels
    if(S.fit==='wall'){rc(X(0),Y(S.ceiling),c.x0*s,S.ceiling*s,'url(#fill)');rc(X(c.x1),Y(S.ceiling),(S.wall-c.x1)*s,S.ceiling*s,'url(#fill)');}
    if(S.fit==='openR'){rc(X(0),Y(S.ceiling),c.x0*s,S.ceiling*s,'url(#fill)');rc(X(c.x1),Y(S.ceiling),EP*s,S.ceiling*s,'#DDE3EA');}
    if(S.fit==='openL'){rc(X(c.x1),Y(S.ceiling),(S.wall-c.x1)*s,S.ceiling*s,'url(#fill)');rc(X(c.x0-EP),Y(S.ceiling),EP*s,S.ceiling*s,'#DDE3EA');}
    if(fr){rc(X(c.x0-EP),Y(ty),EP*s,ty*s,'#DDE3EA');rc(X(c.x1),Y(ty),EP*s,ty*s,'#DDE3EA');rc(X(c.x0-EP),Y(ty),(c.x1-c.x0+2*EP)*s,Math.max(2,EP*s),'#DDE3EA');}
    // top infill across the run
    if(!fr&&infill()>0){const a=S.fit==='openL'?c.x0-EP:0,b=S.fit==='openR'?c.x1+EP:S.wall;rc(X(a),Y(S.ceiling),(b-a)*s,infill()*s,'url(#fill)');}
    // plinth, set back
    if(P>0)rc(X(c.x0)+2,Y(P),(c.x1-c.x0)*s-4,P*s,'#E9EDF2','',0.8,M);
  }
  const tri=(x0,y0,x1,y1,hingeLeft)=>{const xh=hingeLeft?x0:x1,xo=hingeLeft?x1:x0;ln(xo,y0+3,xh+2,(y0+y1)/2,'stroke-dasharray="5 4"',0.9,M);ln(xo,y1-3,xh+2,(y0+y1)/2,'stroke-dasharray="5 4"',0.9,M);};
  const doorSet=(x0,x1,yTop,yBot,n,first,tall)=>{const dw=(x1-x0)/n;for(let k=0;k<n;k++){const left=n===1?first:k%2===0,dx0=x0+k*dw;rc(dx0+2,yTop+2,dw-4,yBot-yTop-4,'none','',0.9);tri(dx0+2,yTop+2,dx0+dw-2,yBot-2,left);
    if(S.handle!=='push'&&yBot-yTop>12){const hx=left?dx0+dw-8:dx0+8,hy=tall?Math.min(yBot-14,Math.max(yTop+14,Y(1050))):(yTop<Y(1500)?yBot-8:yTop+8);S.handle==='knob'?o.push(`<circle cx="${f1(hx)}" cy="${f1(hy)}" r="2.5" fill="${I}"/>`):(tall?ln(hx,hy-12,hx,hy+12,'',2.2):ln(hx-8,hy,hx+8,hy,'',2.2));}}};
  S.modules.forEach((m,i)=>{const a=c.pos[i],b=a+m.w,x0=X(a),x1=X(b),n=hingedCount(m.w);
    rc(x0,Y(mh),x1-x0,(mh-P)*s,i===S.sel?'#e9edfb':'#FFFFFF','',1.4);
    if(S.doors==='hinged')doorSet(x0,x1,Y(mh),Y(P),n,i%2===0,mh-P>1000);
    if(top){rc(x0,Y(ty),x1-x0,(ty-mh)*s,'#FFFFFF','',1.4);doorSet(x0,x1,Y(ty),Y(mh),n,i%2===0,ty-mh>1000);}
    if((mh-P)*s>40)tx((x0+x1)/2,Y((mh+P)/2),CFG.layouts[m.layout].split(' ')[0],'middle',M,10);
  });
  if(S.doors==='sliding'&&has){const n=slidingCount(c.mods),x0=X(c.x0),x1=X(c.x1),dw=(x1-x0)/n,yT=Y(mh)+4,yB=Y(P)-4;
    for(let k=0;k<n;k++){const a=x0+k*dw;rc(a+1,yT,dw-2,yB-yT,'none','',1);const yc=(yT+yB)/2;ln(a+dw*0.3,yc,a+dw*0.7,yc,'',1,M);[[0.3,1],[0.7,-1]].forEach(([p,d])=>{ln(a+dw*p,yc,a+dw*p+6*d,yc-4,'',1,M);ln(a+dw*p,yc,a+dw*p+6*d,yc+4,'',1,M);});}
    tx((x0+x1)/2,yT+14,`${n} sliding doors, ${Math.round(c.mods/n)} mm each`,'middle',M,10);}
  // dimensions across the top
  dimH(0,S.wall,Y(S.ceiling)-52,fr?`${S.wall} space`:`${S.wall}`);
  if(has){const segs=[];
    if(S.fit==='wall'||S.fit==='openR'){if(c.x0>0)segs.push([0,c.x0]);}else segs.push([c.x0-EP,c.x0]);
    S.modules.forEach((m,i)=>segs.push([c.pos[i],c.pos[i]+m.w]));
    if(S.fit==='wall'||S.fit==='openL'){if(c.x1<S.wall)segs.push([c.x1,S.wall]);}else segs.push([c.x1,c.x1+EP]);
    segs.forEach(([a,b])=>dimH(a,b,Y(S.ceiling)-24,String(Math.round(b-a))));}
  // heights on the right: plinth, doors, top cupboards, infill; overall on the left
  const xr=X(S.wall)+30;
  if(has){dimV(0,P,xr,`${P}`);dimV(P,mh,xr,`${mh-P}`);if(top)dimV(mh,ty,xr,`${ty-mh}`);if(!fr&&ty<S.ceiling)dimV(ty,S.ceiling,xr,`${S.ceiling-ty}`);}
  dimV(0,S.ceiling,X(0)-(leftWall?32:18),`${S.ceiling}`,true);
  if(fr&&has)dimV(0,ty,X(S.wall)+56,`${ty}`);
  tx(X(S.wall/2),Y(0)+24,`FRONT VIEW · DEPTH ${depth()} · PLINTH ${P} · ALL SIZES MM`,'middle',M,10);
  el.innerHTML=`<svg viewBox="0 0 ${BW} ${BH}" role="img" aria-label="Front elevation drawing with dimensions">${o.join('')}</svg>`;
}

/* ---------- panel ---------- */
const body=$('#body');
function numRow(id,label,val,hint,step=10){return `<div class="num"><label for="${id}">${esc(label)}${hint?`<small>${esc(hint)}</small>`:''}</label><div class="nctl"><button type="button" class="st" data-bump="${id}" data-d="-${step}" aria-label="${esc(label)} down ${step} mm">−</button><input id="${id}" data-num="${id}" type="number" inputmode="numeric" value="${Math.round(val)}" step="${step}"><span class="u">mm</span><button type="button" class="st" data-bump="${id}" data-d="${step}" aria-label="${esc(label)} up ${step} mm">+</button></div></div>`;}
const chip=(act,v,inner,on,dis)=>`<button type="button" class="chip" data-act="${act}" data-v="${esc(v)}" aria-pressed="${!!on}" ${dis?'disabled':''}>${inner}</button>`;
const ICON={free:'<svg viewBox="0 0 34 26"><path d="M8 6h18v16H8z"/><path d="M3 4v20M31 4v20" stroke-dasharray="2 3"/></svg>',wall:'<svg viewBox="0 0 34 26"><path d="M3 2v22M31 2v22M7 6h20v16H7z"/></svg>',openL:'<svg viewBox="0 0 34 26"><path d="M31 2v22M5 6h22v16H5z" /><path d="M3 4v20" stroke-dasharray="2 3"/></svg>',openR:'<svg viewBox="0 0 34 26"><path d="M3 2v22M7 6h22v16H7z"/><path d="M31 4v20" stroke-dasharray="2 3"/></svg>'};
function stepSpace(){const fr=free();
  const pick=(act,list,cur,isCustom)=>list.map(v=>chip(act,v,`<span class="mono">${v}</span>`,!isCustom&&cur===v)).join('')+chip(act+'-c','1','Custom',isCustom);
  return `<div><h2>Your space</h2><p class="lede">${S.example?'Example sizes are filled in. Change them to yours.':'Sizes in millimetres.'}</p></div>
  <div class="grp">${numRow('wall',fr?'Space available':'Width of the space',S.wall,fr?'How much wall the unit can take.':'Measure at the top, middle and bottom. Use the smallest.')}${numRow('ceiling','Ceiling height',S.ceiling,'Floor to ceiling where the wardrobe goes.')}</div>
  <div class="grp"><h3>Walls either side</h3><div class="chips">${chip('fit','wall',ICON.wall+'<span>Wall both sides<small>Alcove or full wall</small></span>',S.fit==='wall')}${chip('fit','openL',ICON.openL+'<span>Open on the left<small>Finished end panel</small></span>',S.fit==='openL')}${chip('fit','openR',ICON.openR+'<span>Open on the right<small>Finished end panel</small></span>',S.fit==='openR')}${chip('fit','free',ICON.free+'<span>Freestanding<small>Finished both ends and top</small></span>',fr)}</div>
    ${fr?numRow('freeh','Unit height',S.freeH,`Up to ${S.ceiling-20} mm with this ceiling.`):''}</div>
  <div class="grp"><h3>Plinth</h3><div class="chips">${pick('plinth',CFG.plinths,S.plinth,S.plinthCustom)}</div>
    ${S.plinthCustom?numRow('plinthc','Plinth height',S.plinth,`0 to ${CFG.plinthMax} mm. Set back under the doors.`):'<p class="note">The kick board along the floor, set back under the doors.</p>'}</div>
  ${fr?'':`<div class="grp"><h3>Top infill</h3><div class="chips">${pick('infill',CFG.infills,S.infill,S.infillCustom)}</div>
    ${S.infillCustom?numRow('infillc','Top infill',S.infill,`0 to ${CFG.infillMax} mm. 0 runs the doors to the ceiling.`):'<p class="note">A panel above the doors, scribed to the ceiling so it hides any slope.</p>'}</div>`}
  <div class="grp"><h3>Depth</h3><div class="chips">${chip('depth','std',`<span>Standard<small>${S.doors==='sliding'?CFG.depth.sliding:CFG.depth.hinged} mm, hangers fit</small></span>`,S.depthMode==='std')}${chip('depth','shallow',`<span>Shallow<small>${CFG.depth.shallow} mm, pull-out rails</small></span>`,S.depthMode==='shallow',S.doors==='sliding')}${chip('depth','custom','<span>Custom<small>Your size</small></span>',S.depthMode==='custom')}</div>
    ${S.depthMode==='custom'?numRow('depthc','Depth including doors',S.depthCustom,`${CFG.depth.min}–${CFG.depth.max} mm`):''}
    ${S.depthMode==='custom'&&S.depthCustom<560&&S.modules.some(m=>m.layout!=='shelves'&&m.layout!=='drawers')?'<p class="hint">Under 560 mm, hangers turn to face you on pull-out rails.</p>':''}</div>`;}
function stepUnits(){const c=calc();
  return `<div><h2>Units</h2><p class="lede">Pick a standard width for each unit, or type your own. Units run left to right.</p></div>
  <div class="fitbar ${c.lv==='ok'?'':c.lv}" role="status"><b>${esc(c.t)}</b><span>${esc(c.sub)}</span></div>
  <button type="button" class="wbtn primary wide" data-act="fill">Fill my wall with standard sizes</button>
  <div class="mods">${S.modules.map((m,i)=>{const narrow=m.w<400&&m.layout!=='shelves';return `<div class="mod" data-act="sel" data-v="${i}" aria-current="${i===S.sel}">
    <div class="modhead"><b>Unit ${i+1}</b><span class="w">${m.w}</span><span class="sp"></span>
      <button type="button" class="ib" data-act="left" data-v="${i}" aria-label="Move unit ${i+1} left" ${i===0?'disabled':''}><svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg></button>
      <button type="button" class="ib" data-act="right" data-v="${i}" aria-label="Move unit ${i+1} right" ${i===S.modules.length-1?'disabled':''}><svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></button>
      <button type="button" class="ib" data-act="del" data-v="${i}" aria-label="Remove unit ${i+1}"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>
    <div class="wchips" role="group" aria-label="Unit ${i+1} width">${CFG.standardWidths.map(w=>chip('w',i+':'+w,String(w),!m.custom&&m.w===w)).join('')}${chip('custom',i,'Custom',m.custom)}</div>
    ${m.custom?numRow('cw'+i,'Custom width',m.w,`${CFG.customMin}–${CFG.customMax} mm`,1):''}
    <select aria-label="Unit ${i+1} inside" data-layout="${i}">${Object.keys(CFG.layouts).map(k=>`<option value="${k}" ${k===m.layout?'selected':''}>${CFG.layouts[k]}</option>`).join('')}</select>
    ${narrow?'<p class="hint">Too narrow for hanging. Shelves work best under 400 mm.</p>':''}
    ${S.doors==='hinged'?`<p class="note">${hingedCount(m.w)===1?'One door':'Pair of doors'}${S.height==='top'&&topOk()?' plus a top cupboard':''}.</p>`:''}</div>`;}).join('')}</div>
  <button type="button" class="wbtn ghost wide" data-act="add" ${S.modules.length>=12?'disabled':''}>Add a unit</button>`;}
function stepDoors(){const c=calc();
  return `<div><h2>Doors</h2><p class="lede">Tap any door in the 3D view to open it.</p></div>
  <div class="grp"><h3>Type</h3><div class="chips">${chip('doors','hinged','<span>Hinged<small>Up to 600 mm wide is one door, wider is a pair</small></span>',S.doors==='hinged')}${chip('doors','sliding',`<span>Sliding<small>${S.modules.length?slidingCount(c.mods)+' doors':'Saves space in front'}, needs ${CFG.depth.sliding} mm depth</small></span>`,S.doors==='sliding')}</div></div>
  <div class="grp"><h3>Style</h3><div class="chips">${Object.keys(CFG.styles).map(k=>chip('style',k,CFG.styles[k],S.style===k)).join('')}</div></div>
  <div class="grp"><h3>${S.doors==='sliding'?'Pulls':'Handles'}</h3><div class="chips">${Object.keys(CFG.handles).map(k=>chip('handle',k,CFG.handles[k],S.handle===k)).join('')}</div></div>
  <div class="grp"><h3>Height</h3><div class="chips">${chip('height','full',`<span>${free()?'Full-height doors':'One tall door'}<small>${free()?`To ${topY()} mm`:infill()?`Up to the ${infill()} mm infill`:'To the ceiling'}</small></span>`,S.height==='full'||!topOk())}${chip('height','top',`<span>With top cupboards<small>${topOk()?`Main doors ${CFG.topSplit}, top ${topY()-CFG.topSplit}`:`Needs ${CFG.topSplit+CFG.topMin} mm to the top`}</small></span>`,S.height==='top'&&topOk(),!topOk())}</div></div>`;}
function stepColour(){return `<div><h2>Colour</h2><p class="lede">Built in MDF and left ready for your decorator to paint. Pick a colour to see how it will look. Want birch ply or oak instead? Say so in the last step.</p></div>
  <div class="colours" role="group" aria-label="Colour">${CFG.colours.map(k=>chip('colour',k.k,`<span class="sw" style="background:${k.c}"></span><span>${esc(k.n)}</span>`,S.colour===k.k)).join('')}</div>`;}
function specRows(){const c=calc(),d=depth();return[
  ['Space',`${S.wall} wide × ${S.ceiling} high, ${S.fit==='wall'?'wall both sides':S.fit==='openL'?'open on the left':S.fit==='openR'?'open on the right':'freestanding'}`],
  ['Units',S.modules.map(m=>m.w+(m.custom?' (custom)':'')).join(' | ')+` = ${c.mods}`],
  ['Fit',c.t],
  ['Inside',S.modules.map((m,i)=>`${i+1}. ${CFG.layouts[m.layout]}`).join(' · ')],
  ['Depth',`${d} mm overall`],
  ['Doors',`${S.doors==='sliding'?slidingCount(c.mods)+' sliding':'Hinged'} · ${CFG.styles[S.style].toLowerCase()} · ${CFG.handles[S.handle].toLowerCase()}`],
  ['Height',(S.height==='top'&&topOk()?`Main doors to ${CFG.topSplit} + top cupboards ${topY()-CFG.topSplit}`:`Doors to ${topY()}`)+(free()?`, unit ${topY()} high`:'')],
  ['Plinth',`${S.plinth} mm`],
  ['Top',free()?'Finished top panel':infill()?`${infill()} mm infill scribed to the ceiling`:'No infill, doors to the ceiling'],
  ['Colour',`${colour().n} (preview, unpainted)`]];}
function stepSend(){
  const C=S.contact;
  if(S.sent)return `<div class="done"><h2>Sent. Thanks${C.name?', '+esc(C.name.trim().split(' ')[0]):''}</h2><p class="lede">Your design is with me. I reply within 24 hours${C.email?`, and a thank-you email is on its way to ${esc(C.email)}`:''}.</p><pre>${esc(specText())}</pre><div class="contact"><span>Call <span class="mono">${CFG.phone}</span></span><span>Email <span class="mono">${CFG.email}</span></span></div><button type="button" class="wbtn" data-act="again">Change the design</button></div>`;
  const c=calc();
  return `<div><h2>Send to Raf</h2><p class="lede">I reply within 24 hours with a price and a free visit to measure up.</p></div>
  <dl class="spec">${specRows().map(([k,v])=>`<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
  ${c.lv!=='ok'?`<p class="err">${esc(c.t)}. You can still send it; I'll sort the sizes on site.</p>`:''}
  <form class="grp" id="form" novalidate>
    <div class="field"><label for="c-name">Your name</label><input id="c-name" data-c="name" autocomplete="name" value="${esc(C.name)}"><small class="priv">Only sent to me. Nothing is kept on this website.</small></div>
    <div class="row2"><div class="field"><label for="c-phone">Mobile</label><input id="c-phone" data-c="phone" type="tel" autocomplete="tel" inputmode="tel" value="${esc(C.phone)}"></div>
      <div class="field"><label for="c-email">Email</label><input id="c-email" data-c="email" type="email" autocomplete="email" value="${esc(C.email)}"></div></div>
    <div class="row2"><div class="field"><label for="c-post">Postcode</label><input id="c-post" data-c="postcode" autocomplete="postal-code" value="${esc(C.postcode)}"></div>
      <div class="field"><label for="c-when">When</label><select id="c-when" data-c="when"><option value="">Choose</option>${['As soon as possible','In 1 to 3 months','In 3 to 6 months','Just getting a price'].map(w=>`<option ${C.when===w?'selected':''}>${w}</option>`).join('')}</select></div></div>
    <div class="field"><label for="c-notes">Anything else</label><textarea id="c-notes" data-c="notes" placeholder="Material, sloping ceiling, skirting, sockets, a mirror inside a door">${esc(C.notes)}</textarea></div>
    <div class="hp" aria-hidden="true"><label for="c-company">Company</label><input id="c-company" data-c="company" tabindex="-1" autocomplete="off"></div>
    <p class="err" id="formErr" role="alert" hidden></p>
    <button type="submit" class="wbtn primary wide" id="sendBtn">Send to Raf</button>
    <p class="note">Needs your mobile or email so I can reply.</p>
  </form>
  <div class="contact"><span>Or call <span class="mono">${CFG.phone}</span></span><span>Email <span class="mono">${CFG.email}</span></span></div>`;}
function briefMessage(){const C=S.contact;return [
  `Hi Raf, this is ${C.name.trim()}. Here is my brief from your website.`,
  'What: Fitted wardrobe',
  `Finish: ${S.colour==='mdf'?'MDF only, no paint':'Ready for my decorator to paint'}`,
  `Rough size: ${S.wall} wide x ${S.ceiling} high, ${depth()} deep`,
  C.when?`When: ${C.when}`:null,
  '',
  'Designed in the wardrobe planner:',
  ...specRows().map(([k,v])=>`${k}: ${v}`),
  C.notes?'':null, C.notes?`Notes: ${C.notes.trim()}`:null,
].filter(l=>l!==null).join('\n').replace(/×/g,'x').replace(/[–—]/g,'-').replace(/ · /g,', ');}
function specText(){const C=S.contact;return['Fitted wardrobe enquiry','',...specRows().map(([k,v])=>`${k}: ${v}`),'',`Name: ${C.name}`,C.email?`Email: ${C.email}`:null,C.phone?`Phone: ${C.phone}`:null,C.postcode?`Postcode: ${C.postcode}`:null,`When: ${C.when||'not said'}`,C.notes?`Notes: ${C.notes}`:null].filter(l=>l!==null).join('\n');}
const STEPS=[stepSpace,stepUnits,stepDoors,stepColour,stepSend],NEXT=['Next: Units','Next: Doors','Next: Colour','Next: Send',''];
function render(){
  host.querySelectorAll('.steps button').forEach(b=>b.setAttribute('aria-selected',String(Number(b.dataset.step)===S.step)));
  const keep=body.dataset.cur===String(S.step)?body.scrollTop:0;body.innerHTML=STEPS[S.step]();body.dataset.cur=S.step;body.scrollTop=keep;
  $('#backBtn').style.visibility=S.step===0?'hidden':'visible';$('#nextBtn').hidden=S.step===4;$('#nextBtn').textContent=NEXT[S.step];
  chips();
}
function chips(){const c=calc();$('#fitText').textContent=c.t;$('#fitChip').className='fit'+(c.lv==='ok'?'':' '+c.lv);$('#dimsChip').textContent=`${S.wall} × ${S.ceiling} · ${S.modules.length} unit${S.modules.length===1?'':'s'}`;}
function changed(rebuildPanel=true,keepCam=true){S.example=false;S.sent=false;build();if(S.view==='draw')drawPlan();if(rebuildPanel)render();else chips();}
function numVal(id){return id==='wall'?S.wall:id==='ceiling'?S.ceiling:id==='depthc'?S.depthCustom:id==='plinthc'?S.plinth:id==='infillc'?S.infill:id==='freeh'?S.freeH:(S.modules[Number(id.slice(2))]||{}).w;}
function setNum(id,v){v=Number(v);if(!isFinite(v))return;
  if(id==='wall'){S.wall=clamp(Math.round(v),500,8000);}
  else if(id==='ceiling'){S.ceiling=clamp(Math.round(v),1800,3600);S.freeH=Math.min(S.freeH,S.ceiling-20);}
  else if(id==='plinthc'){S.plinth=clamp(Math.round(v),0,CFG.plinthMax);}
  else if(id==='infillc'){S.infill=clamp(Math.round(v),0,CFG.infillMax);}
  else if(id==='freeh'){S.freeH=clamp(Math.round(v),600,S.ceiling-20);}
  else if(id==='depthc'){S.depthCustom=clamp(Math.round(v),CFG.depth.min,CFG.depth.max);}
  else if(id.startsWith('cw')){const m=S.modules[Number(id.slice(2))];if(m)m.w=clamp(Math.round(v),CFG.customMin,CFG.customMax);}
  changed(false);syncInputs();if(S.step===1||S.step===0)refreshSoft();if(id==='ceiling'||id==='freeh'){const f=body.querySelector('#freeh');if(f&&f.closest('.num'))f.closest('.num').querySelector('small').textContent=`Up to ${S.ceiling-20} mm with this ceiling.`;}}
function refreshSoft(){const fb=body.querySelector('.fitbar');if(fb){const c=calc();fb.className='fitbar'+(c.lv==='ok'?'':' '+c.lv);fb.innerHTML=`<b>${esc(c.t)}</b><span>${esc(c.sub)}</span>`;}
  body.querySelectorAll('.modhead .w').forEach((el,i)=>{if(S.modules[i])el.textContent=S.modules[i].w;});}
function syncInputs(){body.querySelectorAll('input[data-num]').forEach(el=>{if(el===document.activeElement)return;const id=el.dataset.num;
  el.value=numVal(id);});}
on(host,'click',e=>{
  const t=e.target.closest('[data-act],.steps [data-step],[data-view],[data-bump]');if(!t)return;
  if(t.dataset.step!=null){S.step=Number(t.dataset.step);render();return;}
  if(t.dataset.view){setView(t.dataset.view);return;}
  if(t.dataset.bump){const id=t.dataset.bump;setNum(id,numVal(id)+Number(t.dataset.d));return;}
  const a=t.dataset.act,v=t.dataset.v;
  if(a!=='sel')e.stopPropagation();
  switch(a){
    case'fit':S.fit=v;changed();break;
    case'plinth':S.plinth=Number(v);S.plinthCustom=false;changed();break;
    case'plinth-c':S.plinthCustom=true;changed();break;
    case'infill':S.infill=Number(v);S.infillCustom=false;changed();break;
    case'infill-c':S.infillCustom=true;changed();break;
    case'depth':S.depthMode=v;if(v==='custom')S.depthCustom=depth();changed();break;
    case'fill':{const msg=autoFill();changed();flash(msg);break;}
    case'sel':if(S.sel!==Number(v)){S.sel=Number(v);build();if(S.view==='draw')drawPlan();body.querySelectorAll('.mod').forEach((el,i)=>el.setAttribute('aria-current',String(i===S.sel)));}break;
    case'w':{const [i,w]=v.split(':').map(Number);const m=S.modules[i];if(m){m.w=w;m.custom=false;S.sel=i;changed();}break;}
    case'custom':{const m=S.modules[Number(v)];if(m){m.custom=true;S.sel=Number(v);changed();}break;}
    case'left':case'right':{const i=Number(v),j=a==='left'?i-1:i+1;if(j>=0&&j<S.modules.length){[S.modules[i],S.modules[j]]=[S.modules[j],S.modules[i]];S.sel=j;changed();}break;}
    case'del':{S.modules.splice(Number(v),1);S.sel=clamp(S.sel,0,Math.max(0,S.modules.length-1));changed();break;}
    case'add':{const c=calc(),room=S.wall-c.run-(S.fit==='wall'?2:1)*CFG.scribe.min;const w=[...CFG.standardWidths].reverse().find(x=>x<=room)||600;S.modules.push(mk(w,layoutFor(w,S.modules.length)));S.sel=S.modules.length-1;changed();break;}
    case'doors':S.doors=v;if(v==='sliding'&&S.depthMode==='shallow')S.depthMode='std';doorState.clear();$('#openBtn').textContent='Open doors';changed();break;
    case'style':S.style=v;changed();break;
    case'handle':S.handle=v;changed();break;
    case'height':S.height=v;changed();break;
    case'colour':S.colour=v;changed();break;
    case'again':S.sent=false;S.step=1;render();break;
  }
});
let flashT=0;function flash(m){const el=$('#fitText');el.textContent=m;clearTimeout(flashT);flashT=setTimeout(chips,2600);}
on(body,'input',e=>{const el=e.target;
  if(el.dataset.num){clearTimeout(el._t);el._t=setTimeout(()=>setNum(el.dataset.num,el.value),450);return;}
  if(el.dataset.c){S.contact[el.dataset.c]=el.type==='checkbox'?el.checked:el.value;}});
on(body,'change',e=>{const el=e.target;
  if(el.dataset.num){clearTimeout(el._t);setNum(el.dataset.num,el.value);return;}
  if(el.dataset.layout!=null){const m=S.modules[Number(el.dataset.layout)];if(m){m.layout=el.value;S.sel=Number(el.dataset.layout);changed();}return;}
  if(el.dataset.c){S.contact[el.dataset.c]=el.type==='checkbox'?el.checked:el.value;}});
on(body,'keydown',e=>{if(e.key==='Enter'&&e.target.dataset.num)e.target.blur();});
on(body,'submit',async e=>{e.preventDefault();if(sending)return;const C=S.contact,err=$('#formErr');
  const okMobile=(C.phone||'').replace(/\D/g,'').length>=10,okEmail=/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test((C.email||'').trim());
  const msg=C.name.trim().length<2?'Add your name.':!okMobile&&!okEmail?'Add your mobile or email so I can reply.':(C.email.trim()&&!okEmail)?'That email address looks incomplete.':'';
  if(msg){err.textContent=msg;err.hidden=false;return;}
  sending=true;const btn=$('#sendBtn');btn.disabled=true;btn.textContent='Sending...';err.hidden=true;
  const payload={name:C.name.trim(),mobile:okMobile?C.phone.trim():'',email:okEmail?C.email.trim():'',address:C.postcode.trim(),message:briefMessage(),photos:0,company:C.company||'',ms:Math.round(performance.now()-t0),choices:{what:['Fitted wardrobe'],room:[],uses:[],material:[]}};
  const post=()=>fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  const wait=()=>new Promise(r=>setTimeout(r,1500));
  let res=null;try{res=await post();if(res.status>=500){await wait();res=await post();}}catch(_){try{await wait();res=await post();}catch(__){res=null;}}
  sending=false;
  if(res&&res.ok){S.sent=true;render();body.scrollTop=0;return;}
  let code='';try{code=res?((await res.json()).error||''):'';}catch(_){}
  err.textContent=code==='name'?'Add your name.':code==='contact'?'Add your mobile or email so I can reply.':code==='busy'?'That has been sent a few times already. Wait a few minutes or call me.':`It did not send. Try again, or call ${CFG.phone}.`;
  err.hidden=false;btn.disabled=false;btn.textContent='Send to Raf';});
on($('#backBtn'),'click',()=>{S.step=Math.max(0,S.step-1);render();});
on($('#nextBtn'),'click',()=>{S.step=Math.min(4,S.step+1);render();});
on($('#openBtn'),'click',toggleDoors);
function setView(v){S.view=v;host.querySelectorAll('.seg button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===v)));
  $('#drawing').hidden=v!=='draw';stage.style.visibility=v==='3d'?'visible':'hidden';if(v==='draw')drawPlan();else needs=true;}
{const ro2=new ResizeObserver(()=>{if(S.view==='draw')drawPlan();});ro2.observe($('#drawing'));observers.push(ro2);}

/* ---------- boot ---------- */
S.example=true;
const gl=initGL();
render();
if(gl){build();frameCam(true);}else setView('draw');
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>{if(S.view==='draw')drawPlan();});

  return () => {
    cancelAnimationFrame(raf);
    observers.forEach((o) => o.disconnect());
    offs.forEach((f) => f());
    if (renderer) { renderer.dispose(); renderer.domElement.remove(); }
    texCache.forEach((t) => t.dispose());
    matCache.forEach((m) => m.dispose());
  };
}
