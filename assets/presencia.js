/* Panel Rustik · presencia digital.
   Lee datos/presencia.json (copia limpia de la presencia de la página de Claude, la escribe
   bin/actualizar_presencia.py) y la dibuja igual que allá: una pestaña por red, sus cifras,
   la gráfica de seguidores nuevos por día, las listas y lo que mejor funcionó. */
(function(){
  "use strict";
  const sec = document.getElementById("presencia");
  if(!sec) return;
  const MES = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  const num = v => v==null ? "—" : Number(v).toLocaleString("en-US");
  const pd = s => { const [y,m,dd] = s.split("-").map(Number); return new Date(y, m-1, dd); };
  const fmt = s => { const x = pd(s); return x.getDate()+" "+MES[x.getMonth()]; };
  const esc = s => String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");

  fetch("datos/presencia.json", {cache:"no-store"}).then(r => { if(!r.ok) throw new Error("presencia"); return r.json(); }).then(P => {
    const N = P.networks || [];
    const upd = new Date(P.updated);
    sec.innerHTML = `<div class="pres-head"><h2>Presencia digital</h2><span class="pres-upd">${esc(P.period ? P.period+" · " : "")}Datos del ${upd.getDate()} ${MES[upd.getMonth()]} ${String(upd.getHours()).padStart(2,"0")}:${String(upd.getMinutes()).padStart(2,"0")}</span></div>
      <div class="nets" role="tablist" aria-label="Redes"></div>
      <div class="netbody" role="tabpanel"></div>
      <div class="analisis"></div>
      <p class="pres-note">Datos de Meta (Facebook e Instagram), TikTok, Google Analytics (página web) y Google Business. Es una copia de la presencia que se actualiza a diario en la página de Claude; para traer lo último, dile a Claude «actualiza la presencia». Las reseñas de Google van sin el nombre de quien las dejó.</p>`;
    const nets = sec.querySelector(".nets"), body = sec.querySelector(".netbody");
    nets.innerHTML = N.map((n,i)=> n.connected
      ? `<button class="net" role="tab" type="button" data-i="${i}"><span class="nn">${esc(n.name)}</span><b>${typeof n.main==="string"?esc(n.main):num(n.main!=null?n.main:n.followers)}</b><span>${esc(n.main_label||"seguidores")}${(n.delta!=null?n.delta:n.new_followers)!=null?` · <span class="up">+${num(n.delta!=null?n.delta:n.new_followers)}</span>`:""}</span></button>`
      : `<button class="net off" role="tab" type="button" data-i="${i}"><span class="nn">${esc(n.name)}</span><b>Por conectar</b><span>sin datos todavía</span></button>`).join("");

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
    let cur = null, rt;
    function render(i){
      const n = N[i];
      nets.querySelectorAll(".net").forEach(b=>b.setAttribute("aria-selected", b.dataset.i==i ? "true" : "false"));
      if(!n.connected){ body.innerHTML = `<p>${esc(n.name)} todavía no está conectado.</p>`; cur = null; return; }
      body.innerHTML = `<div class="nb-head"><h3>${esc(n.name)}</h3>${n.handle?`<span>${esc(n.handle)}</span>`:""}</div>
        ${(n.kpis||[]).length?`<div class="kpis">${n.kpis.map(k=>`<div class="kpi"><small>${esc(k.label)}</small><b>${k.plus&&k.value>0?"+":""}${typeof k.value==="number"?num(k.value):esc(k.value)}</b><span>${esc(k.sub||"")}</span></div>`).join("")}</div>`:""}
        ${n.series?chart(n.series):""}
        ${(n.lists||[]).length?`<div class="two">${n.lists.map(hlist).join("")}</div>`:""}
        ${(n.top||[]).length?`<div><p class="ptitle">${esc(n.top_label||"Lo que mejor funcionó")}</p><div class="tops">${n.top.map((t,j)=>`<article class="topc"><span class="rk">${j+1}</span><h4>${esc(t.title)}</h4><small>${t.date?fmt(t.date):""}${t.type?" · "+esc(t.type):""}</small>${t.paid!=null?`<span class="pill ${t.paid===true?"soon":"off"}">${t.paid===true?"Con pauta":t.paid===false?"Sin pauta":esc(t.paid)}</span>`:""}${t.paid_note?`<span class="pn">${esc(t.paid_note)}</span>`:""}<dl>${(t.stats||[]).map(s=>`<div><dt>${esc(s.label)}</dt><dd>${num(s.value)}</dd></div>`).join("")}</dl>${t.url?`<a href="${esc(t.url)}" target="_blank" rel="noopener">Ver publicación ↗</a>`:""}</article>`).join("")}</div></div>`:""}
        ${n.note?`<p class="pres-note" style="margin:0">${esc(n.note)}</p>`:""}`;
      const box = body.querySelector(".chart"); cur = {box, s:n.series};
      if(box) draw(box, n.series);
    }
    window.addEventListener("resize",()=>{ clearTimeout(rt); rt = setTimeout(()=>{ if(cur && cur.box && cur.box.isConnected) draw(cur.box, cur.s); }, 150); });
    nets.querySelectorAll(".net").forEach(b=>b.addEventListener("click",()=>render(+b.dataset.i)));
    const first = N.findIndex(n=>n.connected);
    render(first<0?0:first);
    sec.querySelector(".analisis").innerHTML = (P.summary?`<h4>Cómo vamos</h4><p>${esc(P.summary)}</p>`:"")+
      ((P.points||[]).length?`<ul>${P.points.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>`:"")+
      (P.next?`<h4>Próximo paso</h4><p>${esc(P.next)}</p>`:"");
  }).catch(() => { sec.innerHTML = `<h2>Presencia digital</h2><p class="pres-note">Todavía no hay datos de presencia en el panel.</p>`; });
})();
