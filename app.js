'use strict';
let DATA = null;
let PERIOD = '3y';
let charts = [];
const $ = (id) => document.getElementById(id);
const format = (v, digits=0) => (typeof v === 'number' ? v.toLocaleString('ko-KR', {minimumFractionDigits:digits,maximumFractionDigits:digits}) : '—');
const fmtDate = (d) => d ? d.replaceAll('-', '.') : '—';
const dayMs = 86400000;
const parseDate = (s) => Date.parse(`${s}T00:00:00Z`);
const clr = {ndx:'#4cc8f5',oas:'#ffb36b',ma20:'#3bdaa3',ma60:'#a396ff',risk:'#fe7180',grid:'#26394f',label:'#819ab5'};
const riskNames = ['안정','주의','경계','위험'];
const riskColors = ['#3bdaa3','#f7c75e','#ffb36b','#fe7180'];

function renderMetrics(d){
  const m=d.metrics;
  $('oasValue').textContent=format(m.oas_bp,0);
  $('ndxValue').textContent=format(m.nasdaq,2);
  $('ma20Value').textContent=format(m.ma20_bp,2);
  $('ma60Value').textContent=format(m.ma60_bp,2);
  $('oasNote').textContent=`${fmtDate(d.meta.oas_asof)} · 20거래일 변화 ${m.oas_change20_bp > 0 ? '+' : ''}${format(m.oas_change20_bp,1)}bp`;
  const val=m.nasdaq_change20_pct;
  $('ndxNote').textContent=`${fmtDate(d.meta.nasdaq_asof)} · 20거래일 수익률 ${val > 0 ? '+' : ''}${format(val,2)}%`;
  $('maNote').textContent=(m.trend_rising?'⚠ 단기 상승 추세 · 위험 프리미엄 확대':'단기·중기 이동평균 비교');
  $('riskLabel').textContent=riskNames[m.risk_level];
  $('riskLabel').style.color=riskColors[m.risk_level];
  $('riskOrb').style.color=riskColors[m.risk_level];
  $('riskOrb').style.background=riskColors[m.risk_level]+'22';
  $('riskPctl').textContent=`상위 ${format(100-m.percentile,1)}% · ${format(m.percentile,1)}백분위`;
  $('riskNote').textContent=`최근 3년 유효 ${format(d.meta.oas_observations)}일 관측치`;
  $('metaDate').textContent=`OAS ${fmtDate(d.meta.oas_asof)} / 나스닥 ${fmtDate(d.meta.nasdaq_asof)}`;
  const build=new Date(d.meta.generated_at_utc);
  $('updatedAt').textContent=`최종 수집 ${Number.isNaN(build.getTime()) ? '—' : build.toLocaleString('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})} KST`;
  const age=Math.max((Date.now()-parseDate(d.meta.oas_asof))/dayMs, (Date.now()-parseDate(d.meta.nasdaq_asof))/dayMs);
  $('freshness').textContent=age > 7?'⚠ 최근 원자료 지연':'● 최신 저장 데이터 연결됨';
  $('freshness').classList.toggle('stale',age>7);
  $('trendFlag').textContent=m.trend_rising?'▲ 20일 > 60일 · 확대 경계':'● 확대 추세 미확인';
  $('trendFlag').classList.toggle('good',!m.trend_rising);
}
function renderRisk(d){
  const m=d.metrics;
  $('gaugeMarker').style.left=`${Math.max(2,Math.min(98,m.percentile))}%`;
  const limits=[`≤ ${format(m.q50_bp,1)}bp`,`${format(m.q50_bp,1)} ~ ${format(m.q75_bp,1)}bp`,`${format(m.q75_bp,1)} ~ ${format(m.q90_bp,1)}bp`,`> ${format(m.q90_bp,1)}bp`];
  const ranges=['0~50 백분위','50~75 백분위','75~90 백분위','90~100 백분위'];
  $('riskTiers').innerHTML = riskNames.map((name,i)=> `<div class="tier-row ${i===m.risk_level?'selected':''}"><div><i class="tier-dot" style="background:${riskColors[i]}"></i><b>${name}</b> <small style="color:#718cab;margin-left:5px">${ranges[i]}</small></div><span>${limits[i]}</span></div>`).join('');
}
function renderSignals(d){
  const m=d.metrics;
  const near=m.oas_bp>m.ma20_bp;
  const cross=m.ma20_bp>m.ma60_bp;
  const up=m.oas_change20_bp>0;
  const overall=(m.risk_level>=2 || (near && cross && up))?'신용시장 위험 프리미엄 확대 — 경계 필요':'신용시장 위험 단계 안정 또는 제한적';
  const status=$('signalStatus');
  status.textContent=`${m.risk_level>=2?'🟠':m.trend_rising?'🟡':'🟢'}  ${overall}`;
  status.classList.toggle('good',m.risk_level===0&&!m.trend_rising);
  const arr = [
    [near?'▲':'▼',`현재 OAS / 20일 평균`,`${format(m.oas_bp,1)}bp ${near?'>':'≤'} ${format(m.ma20_bp,1)}bp`],
    [cross?'▲':'▼','20일 / 60일 이동평균',`${format(m.ma20_bp,1)}bp ${cross?'>':'≤'} ${format(m.ma60_bp,1)}bp`],
    [up?'▲':'▼','20일 OAS 변화',`${m.oas_change20_bp>0?'+':''}${format(m.oas_change20_bp,1)}bp`],
    [m.divergence?'⚠':'●','나스닥·OAS 상승 괴리',m.divergence?'최근 20거래일 두 지표 동반 상승':'최근 20거래일 동반 상승 조건 아님'],
  ];
  $('signalLines').innerHTML=arr.map(([icon,title,note])=>`<div class="signal-row"><span class="signal-mark" style="color:${icon==='▲'||icon==='⚠'?'#f7c75e':'#3bdaa3'}">${icon}</span><div><b>${title}</b><br>${note}</div></div>`).join('');
}
function tickLabel(d){const date=new Date(parseDate(d));return `${date.getUTCFullYear()}.${String(date.getUTCMonth()+1).padStart(2,'0')}`;}
function linePath(rows, x, y, min, max){let s='',prevDate=null;for(const [ds,v] of rows){const t=parseDate(ds);if(t<min||t>max)continue;const xx=x(t), yy=y(v);s+=`${s?' L':'M'}${xx.toFixed(2)},${yy.toFixed(2)}`;prevDate=t;}return s;}
function nice(v){return Number(v.toFixed(2));}
function drawLineChart(svgId, tooltipId, d, kind){
  const svg=$(svgId), tip=$(tooltipId);
  const W=1120,H=320;
  const pad={left:69,right:kind==='price'?78:68,top:22,bottom:39};
  const plotW=W-pad.left-pad.right, plotH=H-pad.top-pad.bottom;
  const series=d.series;
  const fullEnd=parseDate(d.meta.window_end);
  const fullStart=parseDate(d.meta.window_start);
  const lo= PERIOD==='3y'?fullStart:fullEnd-(PERIOD==='1y'?365:183)*dayMs;
  const hi=fullEnd;
  const selected=(key)=>series[key].filter(([s])=>parseDate(s)>=lo&&parseDate(s)<=hi);
  const oas=selected('oas'), ndx=selected('nasdaq'), ma20=selected('ma20'),ma60=selected('ma60');
  const x=t=>pad.left+(t-lo)/(hi-lo)*plotW;
  const yrange=(values, extra=[])=>{
    const list=values.concat(extra).filter(v=>Number.isFinite(v));
    const mn=Math.min(...list),mx=Math.max(...list),delta=(mx-mn)||1;
    return [mn-delta*.12,mx+delta*.12];
  };
  let yl,yr;
  if(kind==='price'){
    yl=yrange(ndx.map(r=>r[1]));
    yr=yrange(oas.map(r=>r[1]));
  }else{
    const all=oas.concat(ma20,ma60).map(r=>r[1]);
    yl=yrange(all,[d.metrics.q75_bp,d.metrics.q90_bp]);
  }
  const py=(v,range)=>pad.top+(range[1]-v)/(range[1]-range[0])*plotH;
  const yL=v=>py(v,yl),yR=v=>py(v,yr);
  const parts=[];
  // grid and value labels
  for(let i=0;i<=4;i++){
    const yy=pad.top+i/4*plotH;
    parts.push(`<line x1="${pad.left}" x2="${W-pad.right}" y1="${yy}" y2="${yy}" stroke="${clr.grid}" stroke-width="1" stroke-dasharray="4 6"/>`);
    const lv=yl[1]-(yl[1]-yl[0])*i/4;
    parts.push(`<text x="${pad.left-12}" y="${yy+4}" text-anchor="end" font-size="12" fill="${clr.label}">${format(lv,kind==='price'?0:1)}</text>`);
    if(kind==='price'){
      const rv=yr[1]-(yr[1]-yr[0])*i/4;
      parts.push(`<text x="${W-pad.right+12}" y="${yy+4}" text-anchor="start" font-size="12" fill="${clr.label}">${format(rv,0)}</text>`);
    }
  }
  for(let i=0;i<=5;i++){
    const t=lo+(hi-lo)*i/5,xx=x(t),stamp=new Date(t).toISOString().slice(0,10);
    parts.push(`<text x="${xx}" y="${H-10}" text-anchor="${i===0?'start':i===5?'end':'middle'}" font-size="11" fill="${clr.label}">${tickLabel(stamp)}</text>`);
  }
  if(kind==='price'){
    parts.push(`<text x="${pad.left}" y="12" fill="${clr.ndx}" font-size="11" font-weight="bold">NASDAQ100 (pt)</text>`);
    parts.push(`<text x="${W-pad.right}" y="12" fill="${clr.oas}" text-anchor="end" font-size="11" font-weight="bold">OAS (bp)</text>`);
    parts.push(`<path d="${linePath(ndx,x,yL,lo,hi)}" stroke="${clr.ndx}" stroke-width="2.3" fill="none" stroke-linejoin="round" stroke-linecap="round"/>`);
    parts.push(`<path d="${linePath(oas,x,yR,lo,hi)}" stroke="${clr.oas}" stroke-width="2.2" fill="none" stroke-linejoin="round" stroke-linecap="round"/>`);
  }else{
    // Risk zone bands are colored using fixed 3y OAS quantiles.
    const [q50,q75,q90]=[d.metrics.q50_bp,d.metrics.q75_bp,d.metrics.q90_bp];
    const bands=[[q50,q75,'#f7c75e'],[q75,q90,'#ffb36b'],[q90,yl[1],'#fe7180']];
    for(const [from,to,c] of bands){const a=Math.max(yl[0],from),b=Math.min(yl[1],to);if(b>a){parts.push(`<rect x="${pad.left}" y="${yL(b)}" width="${plotW}" height="${yL(a)-yL(b)}" fill="${c}" opacity=".045"/>`);}}
    [q75,q90].forEach((value,i)=>{const yy=yL(value);if(yy>=pad.top&&yy<=H-pad.bottom){parts.push(`<line x1="${pad.left}" x2="${W-pad.right}" y1="${yy}" y2="${yy}" stroke="${i?'#fe7180':'#e6b76b'}" stroke-width="1.25" stroke-dasharray="7 6" opacity=".75"/>`);parts.push(`<text x="${W-pad.right-3}" y="${yy-6}" fill="${i?'#fe7180':'#e6b76b'}" font-size="10" text-anchor="end">${i?'90':'75'}백분위 ${format(value,1)}bp</text>`);}});
    parts.push(`<path d="${linePath(ma60,x,yL,lo,hi)}" stroke="${clr.ma60}" stroke-width="2.1" fill="none" opacity=".85"/>`);
    parts.push(`<path d="${linePath(ma20,x,yL,lo,hi)}" stroke="${clr.ma20}" stroke-width="2.3" fill="none" opacity=".95"/>`);
    parts.push(`<path d="${linePath(oas,x,yL,lo,hi)}" stroke="${clr.oas}" stroke-width="2.0" fill="none" opacity=".8"/>`);
    parts.push(`<text x="${pad.left}" y="12" fill="${clr.oas}" font-size="11" font-weight="bold">OAS (bp)</text>`);
  }
  parts.push(`<g id="${svgId}-hover" visibility="hidden"><line id="${svgId}-cross" stroke="#a0b8cc" stroke-width="1" stroke-dasharray="3 3" x1="0" x2="0" y1="${pad.top}" y2="${H-pad.bottom}" opacity=".8"/></g>`);
  parts.push(`<rect x="${pad.left}" y="${pad.top}" width="${plotW}" height="${plotH}" fill="transparent" style="cursor:crosshair" id="${svgId}-hit"/>`);
  svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
  svg.innerHTML=parts.join('');
  const hoverGroup=document.getElementById(`${svgId}-hover`),cross=document.getElementById(`${svgId}-cross`);
  const base=oas.length?oas:ndx;
  const baseT=base.map(r=>parseDate(r[0]));
  const lookup=(rows)=>new Map(rows);
  const ndxMap=lookup(ndx),oMap=lookup(oas),m20Map=lookup(ma20),m60Map=lookup(ma60);
  const seriesForHover=[{key:'ndx',map:ndxMap,color:clr.ndx,label:'나스닥100',fmt:2},{key:'oas',map:oMap,color:clr.oas,label:'OAS (bp)',fmt:1},{key:'ma20',map:m20Map,color:clr.ma20,label:'MA20 (bp)',fmt:2},{key:'ma60',map:m60Map,color:clr.ma60,label:'MA60 (bp)',fmt:2}];
  const hit=document.getElementById(`${svgId}-hit`);
  hit.addEventListener('pointermove',(ev)=>{
    const rect=svg.getBoundingClientRect(), px=((ev.clientX-rect.left)/rect.width)*W;
    const t=lo+(Math.min(W-pad.right,Math.max(pad.left,px))-pad.left)/plotW*(hi-lo);
    let left=0,right=baseT.length;
    while(left<right){const mid=(left+right)>>1;if(baseT[mid]<t)left=mid+1;else right=mid;}
    const i=Math.max(0,Math.min(baseT.length-1,left>0&&Math.abs(baseT[left-1]-t)<Math.abs((baseT[left]??Infinity)-t)?left-1:left));
    const [dt]=base[i];
    const xx=x(baseT[i]);cross.setAttribute('x1',xx);cross.setAttribute('x2',xx);hoverGroup.setAttribute('visibility','visible');
    const rows=kind==='price'?seriesForHover.slice(0,2):seriesForHover.slice(1);
    let html=`<div class="tooltip-date"><strong>${dt}</strong></div>`;
    for(const item of rows){const v=item.map.get(dt);if(v!==undefined){html+=`<div><span style="color:${item.color}">●</span> ${item.label} <b>${format(v,item.fmt)}</b></div>`;}}
    tip.innerHTML=html;
    tip.hidden=false;
    const fx=xx/W*rect.width, fy=Math.max(8,((ev.clientY-rect.top)/rect.height)*rect.height-58);
    const tw=tip.offsetWidth;
    tip.style.left=`${Math.max(5,Math.min(rect.width-tw-5,fx+12))}px`;
    tip.style.top=`${Math.max(3,Math.min(rect.height-100,fy))}px`;
  });
  hit.addEventListener('pointerleave',()=>{hoverGroup.setAttribute('visibility','hidden');tip.hidden=true;});
}
function render(d){DATA=d;renderMetrics(d);renderRisk(d);renderSignals(d);drawLineChart('priceChart','priceTooltip',d,'price');drawLineChart('maChart','maTooltip',d,'ma');}
async function refresh(manual=false){
  const btn=$('refreshBtn');btn.disabled=true;
  try{
    const r=await fetch(`./data/latest.json?ts=${Date.now()}`,{cache:'no-store'});
    if(!r.ok)throw new Error(`HTTP ${r.status}`);
    const d=await r.json();
    if(!d.metrics||!d.series||!d.meta||!Array.isArray(d.series.oas))throw new Error('잘못된 데이터 형식');
    render(d);
    if(manual){$('freshness').textContent='✓ 저장된 최신 데이터 확인 완료';setTimeout(()=>{if(DATA===d)renderMetrics(d);},2500);}
  }catch(err){
    console.error(err);
    $('freshness').textContent='⚠ 데이터 연결 실패';$('freshness').classList.add('stale');
    if(!DATA){$('signalStatus').textContent='데이터를 불러오지 못했습니다. 로컬 미리보기는 python -m http.server 8000으로 실행하세요.';}
  }finally{btn.disabled=false;}
}
document.querySelectorAll('[data-period]').forEach(btn=>btn.addEventListener('click',()=>{PERIOD=btn.dataset.period;document.querySelectorAll('[data-period]').forEach(b=>b.classList.toggle('active',b===btn));if(DATA){drawLineChart('priceChart','priceTooltip',DATA,'price');drawLineChart('maChart','maTooltip',DATA,'ma');}}));
$('refreshBtn').addEventListener('click',()=>refresh(true));
refresh();
// Open tabs check for newer published data every 15 minutes. Upstream FRED observations are daily, not tick-level.
setInterval(()=>refresh(false),15*60*1000);
