/* Panel Rustik · presencia digital, mes por mes.
   datos/presencia/indice.json lista las «fotos» guardadas (una por mes: la última que se tomó
   ese mes) y datos/presencia/AAAA-MM.json es cada foto: la copia limpia de la presencia de la
   página de Claude (la escribe bin/actualizar_presencia.py). Para un mes se muestran:
   - las cifras de la foto de ese mes (son de los 30 días antes de la foto),
   - la gráfica de seguidores nuevos con los días de ese mes (juntando todas las fotos),
   - las publicaciones que mejor funcionaron y que salieron ese mes.
   Lo pide assets/app.js con window.RK_presencia. */
(function(){
  "use strict";
  const MES = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  const MESL = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  const num = v => v==null ? "—" : Number(v).toLocaleString("en-US");
  const pd = s => { const [y,m,dd] = s.split("-").map(Number); return new Date(y, m-1, dd); };
  const fmt = s => { const x = pd(s); return x.getDate()+" "+MES[x.getMonth()]; };
  const esc = s => String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  const nombreMes = k => MESL[+k.slice(5)-1] + " " + k.slice(0,4);
  const fmtHora = s => { const u = new Date(s); return u.getDate()+" "+MES[u.getMonth()]+" "+String(u.getHours()).padStart(2,"0")+":"+String(u.getMinutes()).padStart(2,"0"); };

  let cache = null;
  function cargar(){
    if(!cache) cache = fetch("datos/presencia/indice.json", {cache:"no-store"}).then(r => r.ok ? r.json() : {meses:[]}).then(ix => Promise.all(
      (ix.meses||[]).map(mm => fetch(`datos/presencia/${mm}.json`, {cache:"no-store"}).then(r => r.json()).then(P => ({mes:mm, P})))
    )).catch(() => []);
    return cache;
  }

  function weeksHTML(pts){
    const wk = []; pts.forEach(p=>{ const x = pd(p.d); const dow = (x.getDay()+6)%7; const mon = new Date(x); mon.setDate(x.getDate()-dow); const k = mon.toDateString(); let w = wk.find(z=>z.k===k); if(!w){ w={k,from:p.d,to:p.d,sum:0,n:0}; wk.push(w); } w.to=p.d; w.sum+=p.v; w.n++; });
    return `<div class="weeks">${wk.map(w=>`<div>${w.from===w.to?fmt(w.from):fmt(w.from)+" – "+fmt(w.to)}${w.n<7?" (semana incompleta)":""}<b>${w.sum>0?"+":""}${num(w.sum)}</b></div>`).join("")}</div>`;
  }
  function chart(s){
    if(!(s.points||[]).length) return "";
    return `<div><p class="ptitle">${esc(s.label)}</p><div class="chart" role="img" aria-label="${esc(s.label)}"><svg></svg><div class="tip" hidden></div></div>${weeksHTML(s.points)}</div>`;
  }
  function draw(box, s){
    const pts = s.points, svg = box.querySelector("svg"), tip = box.querySelector(".tip");
    const W = Math.max(240, box.clientWidth - 24), H = 190, L = 34, B = 22, T = 8;
    const max = Math.max(...pts.map(p=>p.v), 1), min = Math.min(...pts.map(p=>p.v), 0);
    const step = Math.pow(10, Math.floor(Math.log10(max))); const top = Math.ceil(max/step)*step;
    const span = top - min, y = v => T + (H-T-B)*((top - v)/span), bw = (W-L)/pts.length;
    let g = "";
    [min, 0, top/2, top].filter((t,i,a)=>a.indexOf(t)===i).forEach(t=>{ g += `<line class="grid" x1="${L}" x2="${W}" y1="${y(t)}" y2="${y(t)}"/><text class="ax" x="${L-6}" y="${y(t)+4}" text-anchor="end">${num(t)}</text>`; });
    pts.forEach((p,i)=>{
      const x = L + i*bw, w = Math.max(2, bw-2), y0 = y(0), yv = y(p.v), h = Math.abs(y0-yv);
      g += `<g data-t="${esc(fmt(p.d))}: ${num(p.v)}" data-x="${x+bw/2}" data-y="${Math.min(y0,yv)}"><rect class="hit" x="${x}" y="${T}" width="${bw}" height="${H-T-B}"/>${h>0?`<rect class="bar" x="${x+1}" y="${Math.min(y0,yv)}" width="${w}" height="${h}" rx="2"/>`:""}</g>`;
    });
    [0, Math.floor(pts.length/2), pts.length-1].forEach(i=>{ g += `<text class="ax" x="${L+i*bw+bw/2}" y="${H-6}" text-anchor="${i===0?"start":i===pts.length-1?"end":"middle"}">${fmt(pts[i].d)}</text>`; });
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.innerHTML = g;
    svg.querySelectorAll("g[data-t]").forEach(el=>{
      el.addEventListener("mouseenter",()=>{ el.classList.add("on"); tip.textContent = el.dataset.t; tip.style.left = (12 + +el.dataset.x)+"px"; tip.style.top = (12 + +el.dataset.y - 6)+"px"; tip.hidden = false; });
      el.addEventListener("mouseleave",()=>{ el.classList.remove("on"); tip.hidden = true; });
    });
  }
  function hlist(l){
    const tot = l.total || l.items.reduce((a,x)=>a+x.value,0), max = Math.max(...l.items.map(x=>x.value),1);
    return `<div><p class="ptitle">${esc(l.title)}</p><ul class="hlist">${l.items.map(x=>`<li><span>${esc(x.name)}</span><span class="tr"><i style="width:${x.value/max*100}%"></i></span><em>${num(x.value)}${l.total?` · ${(x.value/tot*100).toFixed(x.value/tot<.1?1:0)}%`:""}</em></li>`).join("")}</ul></div>`;
  }

  /* Junta lo de todas las fotos para un mes: días de la gráfica y publicaciones de ese mes */
  function delMes(fotos, mes, red){
    const puntos = {}, tops = {};
    fotos.forEach(f => {   // de la más vieja a la más nueva: la más nueva gana
      const n = (f.P.networks||[]).find(x => x.id === red); if(!n) return;
      ((n.series||{}).points||[]).forEach(p => { if(p.d.startsWith(mes)) puntos[p.d] = p; });
      (n.top||[]).forEach(t => { if(t.date && t.date.startsWith(mes)) tops[t.url || t.title] = t; });
    });
    return { puntos: Object.values(puntos).sort((a,b) => a.d < b.d ? -1 : 1),
             tops: Object.values(tops).sort((a,b) => ((b.stats||[])[0]||{}).value - ((a.stats||[])[0]||{}).value) };
  }

  function dibujarFoto(sec, fotos, foto, mes){
    const P = foto.P, N = P.networks || [];
    sec.innerHTML = `<div class="pres-head"><h2>Presencia digital · ${esc(nombreMes(mes))}</h2><span class="pres-upd">Foto del ${fmtHora(P.updated)}${P.period?" · cifras de "+esc(P.period.toLowerCase()):""}</span></div>
      <div class="nets" role="tablist" aria-label="Redes"></div>
      <div class="netbody" role="tabpanel"></div>
      <div class="analisis"></div>
      <p class="pres-note">Datos de Meta (Facebook e Instagram), TikTok, Google Analytics (página web) y Google Business. Las cifras grandes son de los 30 días antes de la foto; la gráfica y las publicaciones son solo de ${esc(nombreMes(mes))}. Las reseñas de Google van sin el nombre de quien las dejó. Para traer lo último, dile a Claude «actualiza la pauta y la presencia».</p>`;
    const nets = sec.querySelector(".nets"), body = sec.querySelector(".netbody");
    nets.innerHTML = N.map((n,i)=> n.connected
      ? `<button class="net" role="tab" type="button" data-i="${i}"><span class="nn">${esc(n.name)}</span><b>${typeof n.main==="string"?esc(n.main):num(n.main!=null?n.main:n.followers)}</b><span>${esc(n.main_label||"seguidores")}${(n.delta!=null?n.delta:n.new_followers)!=null?` · <span class="up">+${num(n.delta!=null?n.delta:n.new_followers)}</span>`:""}</span></button>`
      : `<button class="net off" role="tab" type="button" data-i="${i}"><span class="nn">${esc(n.name)}</span><b>Por conectar</b><span>sin datos todavía</span></button>`).join("");
    let cur = null;
    function render(i){
      const n = N[i];
      nets.querySelectorAll(".net").forEach(b=>b.setAttribute("aria-selected", b.dataset.i==i ? "true" : "false"));
      if(!n.connected){ body.innerHTML = `<p>${esc(n.name)} todavía no está conectado.</p>`; cur = null; return; }
      const dm = delMes(fotos, mes, n.id);
      const serie = n.series && dm.puntos.length ? {label: n.series.label + " · " + nombreMes(mes), points: dm.puntos} : null;
      body.innerHTML = `<div class="nb-head"><h3>${esc(n.name)}</h3>${n.handle?`<span>${esc(n.handle)}</span>`:""}</div>
        ${(n.kpis||[]).length?`<div class="kpis">${n.kpis.map(k=>`<div class="kpi"><small>${esc(k.label)}</small><b>${k.plus&&k.value>0?"+":""}${typeof k.value==="number"?num(k.value):esc(k.value)}</b><span>${esc(k.sub||"")}</span></div>`).join("")}</div>`:""}
        ${serie?chart(serie):(n.series?`<p class="pres-note">No hay datos diarios de ${esc(nombreMes(mes))} en las fotos guardadas.</p>`:"")}
        ${(n.lists||[]).length?`<div class="two">${n.lists.map(hlist).join("")}</div>`:""}
        ${dm.tops.length?`<div><p class="ptitle">${esc((n.top_label||"Lo que mejor funcionó").replace(/^Las \d+ /,"Las "))} · ${esc(nombreMes(mes))}</p><div class="tops">${dm.tops.map((t,j)=>`<article class="topc"><span class="rk">${j+1}</span><h4>${esc(t.title)}</h4><small>${t.date?fmt(t.date):""}${t.type?" · "+esc(t.type):""}</small>${t.paid!=null?`<span class="pill ${t.paid===true?"soon":"off"}">${t.paid===true?"Con pauta":t.paid===false?"Sin pauta":esc(t.paid)}</span>`:""}${t.paid_note?`<span class="pn">${esc(t.paid_note)}</span>`:""}<dl>${(t.stats||[]).map(s=>`<div><dt>${esc(s.label)}</dt><dd>${num(s.value)}</dd></div>`).join("")}</dl>${t.url?`<a href="${esc(t.url)}" target="_blank" rel="noopener">Ver publicación ↗</a>`:""}</article>`).join("")}</div></div>`:`<p class="pres-note">Ninguna de las publicaciones destacadas de ${esc(n.name)} salió en ${esc(nombreMes(mes))}.</p>`}
        ${n.note?`<p class="pres-note" style="margin:0">${esc(n.note)}</p>`:""}`;
      const box = body.querySelector(".chart"); cur = {box, s:serie};
      if(box) draw(box, serie);
    }
    window.addEventListener("resize", () => { if(cur && cur.box && cur.box.isConnected) draw(cur.box, cur.s); });
    nets.querySelectorAll(".net").forEach(b=>b.addEventListener("click",()=>render(+b.dataset.i)));
    const first = N.findIndex(n=>n.connected);
    render(first<0?0:first);
    sec.querySelector(".analisis").innerHTML = (P.summary?`<h4>Cómo vamos</h4><p>${esc(P.summary)}</p>`:"")+
      ((P.points||[]).length?`<ul>${P.points.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>`:"")+
      (P.next?`<h4>Próximo paso (a la fecha de la foto)</h4><p>${esc(P.next)}</p>`:"");
  }

  window.RK_presencia = {
    async meses(){ return (await cargar()).map(f => f.mes); },
    async dibujar(cont, mes){
      const fotos = await cargar();
      const foto = fotos.find(f => f.mes === mes);
      cont.innerHTML = `<section class="presencia" id="presencia" aria-label="Presencia digital"></section>`;
      const sec = cont.firstChild;
      if(!foto){
        sec.innerHTML = `<div class="pres-head"><h2>Presencia digital · ${esc(nombreMes(mes))}</h2></div><div class="vacio-mes"><b>Todavía no hay una foto de la presencia de ${esc(nombreMes(mes))}.</b><span>${fotos.length?"Se guarda una cada vez que se actualiza durante el mes. Dile a Claude «actualiza la pauta y la presencia».":"Dile a Claude «actualiza la pauta y la presencia»."}</span></div>`;
        return;
      }
      dibujarFoto(sec, fotos, foto, mes);
    }
  };
})();
