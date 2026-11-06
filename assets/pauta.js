/* Panel Rustik · pauta en Meta, mes por mes y con contraseña.
   datos/pauta/indice.json lista las «fotos» guardadas (una por mes: la última de ese mes) y
   datos/pauta/AAAA-MM.cifrada.json es cada foto CIFRADA. El candado (abrir con la contraseña,
   recordarla, descifrar) está en assets/candado.js y es el mismo de la presencia.
   Para un mes se muestran las campañas y promociones que estuvieron activas ese mes (con la
   cifra más nueva que haya de cada una) y el análisis de la foto de ese mes.
   Lo pide assets/app.js con window.RK_pauta. */
(function(){
  "use strict";
  const MES = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  const MESL = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  const esc = s => String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  const money = v => v==null ? "—" : "$" + Number(v).toFixed(2);
  const num = v => v==null ? "—" : Number(v).toLocaleString("en-US");
  const dd = s => { const [y,m,d] = s.split("-").map(Number); return new Date(y, m-1, d); };
  const fmt = s => { const x = dd(s); return x.getDate()+" "+MES[x.getMonth()]; };
  const nombreMes = k => MESL[+k.slice(5)-1] + " " + k.slice(0,4);
  const fmtHora = s => { const u = new Date(s); return u.getDate()+" "+MES[u.getMonth()]+" "+String(u.getHours()).padStart(2,"0")+":"+String(u.getMinutes()).padStart(2,"0"); };
  const K = window.RK_candado;
  let abiertas = null, redibujar = null, fichas = null;
  K.alAbrir(() => { abiertas = null; });

  /* Fichas de cada anuncio (datos/pauta/anuncios.json, sin dinero): artes, botón, destino,
     textos y fotos de cómo se ve. Las cifras de cada anuncio vienen cifradas en la foto del
     mes (campaigns[].anuncios[], con sus «ubicaciones» tal como las da Meta). */
  const cargarFichas = () => fichas || (fichas = fetch("datos/pauta/anuncios.json", {cache:"no-store"}).then(r => r.ok ? r.json() : {}).then(x => x.anuncios || {}).catch(() => ({})));
  const PLAT = {facebook:"Facebook", instagram:"Instagram", whatsapp:"WhatsApp", threads:"Threads", messenger:"Messenger", audience_network:"Otras apps"};
  const LUGAR = {   // [nombre del lugar, formato que se ve ahí]
    feed:["Muro / feed","post"], facebook_profile_feed:["Perfil","post"], marketplace:["Marketplace","post"], search:["Búsqueda","post"],
    instream_video:["Dentro de videos","otro"], facebook_stories:["Historias","historia"], facebook_reels:["Reels","historia"],
    facebook_reels_overlay:["Franja sobre los reels","otro"], instagram_stories:["Historias","historia"], instagram_reels:["Reels","historia"],
    instagram_explore:["Explorar","post"], instagram_explore_grid_home:["Explorar","post"], instagram_search:["Búsqueda","post"],
    instagram_profile_feed:["Perfil","post"], status:["Estados","historia"], threads_feed:["Feed","post"]};
  const TIPO = {post:"Post 4:5", historia:"Historia / reel 9:16", otro:"Otro formato"};
  const lugar = u => { const l = LUGAR[u.pos] || [String(u.pos||"").replace(/_/g," "), "otro"]; return {plat: PLAT[u.p] || u.p, lugar: l[0], tipo: l[1]}; };
  const pct = (a, t) => t ? Math.round(a / t * 100) : 0;
  const sumar = (rows, clave) => { const o = {}; rows.forEach(u => { const k = clave(u); o[k] = o[k] || {impresiones:0, clics:0, gasto:0}; o[k].impresiones += u.impresiones||0; o[k].clics += u.clics||0; o[k].gasto += u.gasto||0; }); return o; };

  /* barra de reparto Facebook / Instagram / resto (por vistas), con los clics al lado */
  function repartoPlat(rows, titulo){
    const por = sumar(rows, u => lugar(u).plat), tot = Object.values(por).reduce((a,x)=>a+x.impresiones,0), totc = Object.values(por).reduce((a,x)=>a+x.clics,0);
    if(!tot) return "";
    const orden = Object.entries(por).sort((a,b) => b[1].impresiones - a[1].impresiones);
    const cls = n => n==="Facebook" ? "fb" : n==="Instagram" ? "ig" : "otro";
    return `<div class="reparto"><div class="rep-tit">${esc(titulo)} <b>${esc(orden[0][0])}</b> (${pct(orden[0][1].impresiones, tot)}% de las vistas)</div>
      <div class="rep-bar" role="img" aria-label="${esc(orden.map(([n,x])=>`${n} ${pct(x.impresiones,tot)}%`).join(", "))}">${orden.map(([n,x])=>`<i class="${cls(n)}" style="width:${Math.max(pct(x.impresiones,tot),1)}%"></i>`).join("")}</div>
      <div class="rep-ley">${orden.map(([n,x])=>`<span><i class="${cls(n)}"></i>${esc(n)}: ${pct(x.impresiones,tot)}% de las vistas · ${num(x.clics)} clic${x.clics===1?"":"s"}${totc?` (${pct(x.clics,totc)}%)`:""}</span>`).join("")}</div></div>`;
  }

  /* lo que se ve de cada anuncio: artes, botón, clics por historia y por post, fotos y textos */
  function fichaAnuncio(a, F){
    const f = F[a.id] || {}, rows = a.ubicaciones || [];
    const portipo = sumar(rows, u => lugar(u).tipo);
    const filas = rows.filter(u => (u.impresiones||0) > 0).map(u => Object.assign(lugar(u), u)).sort((x,y) => (y.clics||0)-(x.clics||0) || (y.impresiones||0)-(x.impresiones||0));
    const estado = a.estado === "ACTIVE" ? `<span class="pill on">Activo</span>` : `<span class="pill off">Terminó</span>`;
    const dest = f.destino ? (f.destino.url ? `<a href="${esc(f.destino.url)}" target="_blank" rel="noopener">${esc(f.destino.label)} ↗</a>` : esc(f.destino.label)) : "—";
    const arte = (src, t) => src ? `<figure class="arte ${t}"><a href="${esc(src)}" target="_blank" rel="noopener"><img src="${esc(src)}" alt="${t==="post"?"Arte del post 4:5":"Arte de la historia 9:16"}" loading="lazy"></a><figcaption>${t==="post"?"Post 4:5 · feeds":"Historia 9:16 · historias y reels"}</figcaption></figure>` : "";
    return `<article class="anuncio" id="ad-${esc(a.id)}">
      <div class="ad-head"><h4>${esc(f.producto||a.nombre)} <span class="ad-nom">${esc(a.nombre)}</span>${estado}</h4>
        <div class="ad-boton"><span class="chip">Botón «${esc(f.boton||"—")}»</span> lleva a ${dest}${f.boton_nota?` <span class="sub">(${esc(f.boton_nota)})</span>`:""}</div>
        ${f.formato?`<div class="meta">${esc(f.formato)}</div>`:""}</div>
      <div class="ad-cuerpo">
        <div class="ad-artes">${arte(f.artes&&f.artes.post,"post")}${arte(f.artes&&f.artes.historia,"historia")}${!f.artes?`<p class="meta">Falta la ficha de este anuncio (artes y textos): pídesela al kit.</p>`:""}</div>
        <div class="ad-datos">
          <div class="ad-kpis"><div><small>Clics al botón</small><b>${num(a.clics)}</b></div><div><small>Vistas</small><b>${num(a.impresiones)}</b></div><div><small>Personas</small><b>${num(a.alcance)}</b></div><div><small>Gastado</small><b>${money(a.gasto)}</b></div></div>
          <div class="ad-tipos">${["post","historia","otro"].filter(t=>portipo[t]&&portipo[t].impresiones).map(t=>`<div class="t-${t}"><small>${TIPO[t]}</small><b>${num(portipo[t].clics)} clic${portipo[t].clics===1?"":"s"}</b><span>${num(portipo[t].impresiones)} vistas · ${money(portipo[t].gasto)}</span></div>`).join("")}</div>
          ${repartoPlat(rows, "Se muestra más en")}
          ${filas.length?`<details class="ad-lugares"><summary>Clics por lugar (${filas.length})</summary><div class="bwrap"><table class="btable"><thead><tr><th>Dónde</th><th>Formato</th><th class="n">Clics</th><th class="n">Vistas</th><th class="n">Gastado</th></tr></thead><tbody>${filas.map(u=>`<tr><td>${esc(u.plat)} · ${esc(u.lugar)}</td><td>${esc(TIPO[u.tipo])}</td><td class="n">${num(u.clics||0)}</td><td class="n">${num(u.impresiones)}</td><td class="n">${money(u.gasto)}</td></tr>`).join("")}</tbody></table></div></details>`:""}
        </div>
      </div>
      ${(f.vistas||[]).length?`<div class="ad-vistas"><small>Así se ve en redes</small><div class="vistas-fila">${f.vistas.map(v=>`<figure><a href="${esc(v.img)}" target="_blank" rel="noopener"><img src="${esc(v.img)}" alt="Vista del anuncio en ${esc(v.lugar)}" loading="lazy"></a><figcaption>${esc(v.lugar)}</figcaption></figure>`).join("")}</div></div>`:""}
      ${(f.textos||[]).length||(f.titulos||[]).length?`<details class="ad-textos"><summary>Textos y títulos del anuncio (${(f.textos||[]).length} textos · ${(f.titulos||[]).length} títulos)</summary>
        ${(f.titulos||[]).length?`<p class="meta">Títulos (Meta va alternando entre ellos):</p><ul>${f.titulos.map(t=>`<li><b>${esc(t)}</b></li>`).join("")}</ul>`:""}
        ${(f.textos||[]).length?`<p class="meta">Textos principales:</p><ol>${f.textos.map(t=>`<li>${esc(t).replace(/\n/g,"<br>")}</li>`).join("")}</ol>`:""}</details>`:""}
    </article>`;
  }

  /* arriba de todo: qué está pautado este mes, para verlo de un vistazo */
  function vitrina(Cs, F, today){
    const ads = [];
    Cs.forEach(c => (c.anuncios||[]).forEach(a => ads.push({a, c})));
    if(!ads.length) return "";
    const vivo = ({a, c}) => a.estado === "ACTIVE" && dd(c.end) >= today;
    ads.sort((x, y) => (vivo(y) - vivo(x)) || ((y.a.clics||0) - (x.a.clics||0)));
    const n = ads.filter(vivo).length, rows = [].concat(...ads.map(x => x.a.ubicaciones||[]));
    return `<section class="vitrina"><h3>Lo que está pautado · ${n} anuncio${n===1?"":"s"} activo${n===1?"":"s"}</h3>
      <p class="meta">Toca un anuncio para ver sus artes, cómo se ve en Facebook e Instagram, a dónde lleva el botón y los clics de cada historia y cada post.</p>
      <div class="vit-grid">${ads.map(({a, c}) => { const f = F[a.id] || {}, img = f.artes && (f.artes.post || f.artes.historia);
        return `<a class="vit" href="#ad-${esc(a.id)}" data-ad="${esc(a.id)}">${img?`<img src="${esc(img)}" alt="" loading="lazy">`:`<span class="vit-sin">Sin arte</span>`}
          <span class="vit-txt"><b>${esc(f.producto||a.nombre)}</b>${vivo({a,c})?`<span class="pill on">Activo</span>`:`<span class="pill off">Terminó</span>`}<span class="vit-l"><span class="chip">«${esc(f.boton||"—")}»</span> → ${esc(f.destino?f.destino.label:"—")}</span><span class="vit-l"><b>${num(a.clics)}</b> clics al botón · ${esc(c.objective||"")}</span></span></a>`; }).join("")}</div>
      ${repartoPlat(rows, "En todo el mes, la pauta se muestra más en")}</section>`;
  }

  /* campañas y promociones que tocan el mes, con la cifra más nueva de cada una */
  function delMes(mes){
    const ini = dd(mes + "-01"), fin = new Date(ini.getFullYear(), ini.getMonth()+1, 0);
    const toca = (a, b) => a && b && dd(a) <= fin && dd(b) >= ini;
    const camps = {}, boosts = {};
    let meta = null;
    abiertas.forEach(({D}) => {        // de la foto más vieja a la más nueva: la más nueva gana
      (D.campaigns||[]).forEach(c => { if(toca(c.start, c.end)) camps[c.name || c.label] = Object.assign({}, c, {_upd: D.updated}); });
      ((D.boosts||{}).items||[]).forEach(x => { if(toca(x.start, x.end)) boosts[x.url || x.name] = x; });
      if(D.boosts) meta = D.boosts;
    });
    return { camps: Object.values(camps).sort((a,b) => a.start < b.start ? -1 : 1), boosts: Object.values(boosts), bmeta: meta };
  }

  function dibujarMes(sec, mes, F){
    const {camps: Cs, boosts: it, bmeta} = delMes(mes);
    const foto = abiertas.find(x => x.mes === mes);
    const ultima = abiertas[abiertas.length-1].D.updated;
    const upd = new Date(ultima), today = new Date(upd.getFullYear(), upd.getMonth(), upd.getDate());
    let h = `<div class="pauta-head"><h2>Pauta en Meta · ${esc(nombreMes(mes))}</h2><span class="pauta-upd">Datos del ${fmtHora(ultima)}</span></div>`;
    if(!Cs.length && !it.length){
      sec.innerHTML = h + `<div class="vacio-mes"><b>No hay campañas guardadas que hayan corrido en ${esc(nombreMes(mes))}.</b><span>Las fotos de la pauta empezaron a guardarse en octubre de 2026.</span></div>` + cerrar();
      return enlazarCerrar(sec);
    }
    const budget = Cs.reduce((a,c)=>a+(c.budget||0),0), spent = Cs.reduce((a,c)=>a+(c.spent||0),0), reach = Cs.reduce((a,c)=>a+(c.reach||0),0);
    const activas = Cs.filter(c => dd(c.start) <= today && dd(c.end) >= today).length;
    h += `<div class="kpis">`+
      `<div class="kpi"><small>Presupuesto</small><b>${money(budget)}</b><span>${Cs.length} campaña${Cs.length===1?"":"s"} que corrieron este mes</span></div>`+
      `<div class="kpi"><small>Gastado</small><b>${money(spent)}</b><span>${budget?Math.round(spent/budget*100):0}% del presupuesto</span></div>`+
      `<div class="kpi"><small>Queda</small><b>${money(budget-spent)}</b><span>por gastar</span></div>`+
      `<div class="kpi"><small>Alcance</small><b>${num(reach)}</b><span>cuentas · ${activas} activa${activas===1?"":"s"} al ${fmt(ultima.slice(0,10))}</span></div></div>
      <p class="pauta-note">Meta da las cifras por campaña completa: si una campaña empezó o terminó en otro mes, aquí aparece con todo lo que lleva.</p>`;
    const notaUpd = (abiertas[abiertas.length-1].D || {}).nota_actualizacion;
    if(notaUpd) h += `<p class="pauta-note">${esc(notaUpd)}</p>`;
    h += vitrina(Cs, F, today);
    h += `<div class="camps">` + Cs.map(c => {
      const s = dd(c.start), e = dd(c.end), total = Math.round((e-s)/864e5)+1;
      const el = Math.min(total, Math.max(0, Math.round((today-s)/864e5)+1));
      const started = today >= s, ended = today > e;
      const pill = ended ? `<span class="pill off">Terminó</span>` : started ? `<span class="pill on">Activa</span>` : `<span class="pill soon">Arranca ${fmt(c.start)}</span>`;
      const pct = c.budget ? Math.min(100, c.spent/c.budget*100) : 0, exp = started ? Math.min(100, el/total*100) : 0;
      return `<article class="camp"><div><h3>${esc(c.label)}${pill}</h3><div class="meta">${esc(c.objective)} · ${fmt(c.start)} – ${fmt(c.end)} · anuncio: ${esc((c.ads||[]).join(", "))}</div>
        <div class="gbar" role="img" aria-label="Gastado ${money(c.spent)} de ${money(c.budget)}"><i style="width:${pct}%"></i>${started&&!ended?`<em style="left:${exp}%"></em>`:""}</div>
        <div class="barlbl"><span>${money(c.spent)} de ${money(c.budget)}</span><span>${ended?`${total} días`:started?`día ${el} de ${total}`:`${total} días`}</span></div></div>
        <div class="mets"><div><small>Alcance</small><b>${num(c.reach)}</b></div><div><small>Impresiones</small><b>${num(c.impressions)}</b></div><div><small>Frecuencia</small><b>${c.frequency?Number(c.frequency).toFixed(2):"—"}</b></div>
        <div><small>Clics</small><b>${num(c.clicks)}</b></div><div><small>CTR</small><b>${c.ctr==null?"—":esc(c.ctr)+"%"}</b></div><div><small>${esc(c.cpr_label||"Costo por resultado")}</small><b>${money(c.cpr)}</b></div>
        <div><small>Seguidores nuevos</small><b>${c.follows_ig==null&&c.follows_fb==null?"—":num((c.follows_ig||0)+(c.follows_fb||0))}</b>${c.follows_ig!=null||c.follows_fb!=null?`<span class="sub">IG ${num(c.follows_ig||0)} · FB ${num(c.follows_fb||0)}</span>`:""}</div><div><small>Visitas al perfil</small><b>${num(c.profile_visits)}</b></div></div>${(c.anuncios||[]).length?`<div class="anuncios"><h4 class="anu-tit">Anuncios de esta campaña (${c.anuncios.length})</h4>${c.anuncios.length>1?repartoPlat([].concat(...c.anuncios.map(a=>a.ubicaciones||[])), "Esta campaña se muestra más en"):""}${c.anuncios.map(a => fichaAnuncio(a, F)).join("")}</div>`:""}</article>`;
    }).join("") + `</div>`;
    if(it.length){
      const sum = k => it.reduce((s,x)=>s+(x[k]||0),0), seg = sum("follows_ig")+sum("follows_fb");
      h += `<section class="boosts"><h3>${esc((bmeta&&bmeta.title)||"Promociones desde la app de Instagram")} · las que corrieron en ${esc(nombreMes(mes))}</h3>${bmeta&&bmeta.meta?`<p class="meta">${esc(bmeta.meta)}</p>`:""}
        <div class="kpis"><div class="kpi"><small>Gastado</small><b>${money(sum("spent"))}</b><span>${it.length} promociones</span></div><div class="kpi"><small>Seguidores en Instagram</small><b>+${num(sum("follows_ig"))}</b><span>atribuidos a los anuncios</span></div><div class="kpi"><small>Seguidores en Facebook</small><b>+${num(sum("follows_fb"))}</b><span>atribuidos a los anuncios</span></div><div class="kpi"><small>Costo por seguidor</small><b>${seg?money(sum("spent")/seg):"—"}</b><span>promedio</span></div></div>
        <div class="bwrap"><table class="btable"><thead><tr><th>Publicación</th><th>Fechas</th><th class="n">Gastado</th><th class="n">Alcance</th><th class="n">Seguidores IG</th><th class="n">Seguidores FB</th></tr></thead><tbody>${it.map(x=>`<tr><td>${x.url?`<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.name)}</a>`:esc(x.name)}</td><td>${x.start?fmt(x.start):""} – ${x.end?fmt(x.end):""}</td><td class="n">${money(x.spent)}</td><td class="n">${num(x.reach)}</td><td class="n">${num(x.follows_ig)}</td><td class="n">${num(x.follows_fb)}</td></tr>`).join("")}</tbody></table></div></section>`;
    }
    if(foto){ const D = foto.D;
      h += `<div class="analisis">${D.summary?`<h4>Cómo van (foto del ${fmtHora(D.updated)})</h4><p>${esc(D.summary)}</p>`:""}${(D.points||[]).length?`<ul>${D.points.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>`:""}${D.next?`<h4>Próximo paso (a esa fecha)</h4><p>${esc(D.next)}</p>`:""}</div>`;
    }
    sec.innerHTML = h + `<p class="pauta-note">La línea negra en cada barra marca cuánto se debería llevar gastado a hoy si el presupuesto se reparte parejo entre las fechas de la campaña. «Clics al botón» son los toques al botón o al enlace del anuncio; «vistas», las veces que apareció en pantalla. Datos de Meta Ads Manager.</p>` + cerrar();
    enlazarCerrar(sec);
    /* la vitrina baja al anuncio sin tocar la dirección (#pauta/AAAA-MM la usa el panel) */
    sec.querySelectorAll(".vit").forEach(x => x.addEventListener("click", e => {
      e.preventDefault();
      const el = sec.querySelector("#ad-" + CSS.escape(x.dataset.ad));
      if(el){ el.scrollIntoView({behavior:"smooth", block:"start"}); el.classList.add("resalta"); setTimeout(() => el.classList.remove("resalta"), 1600); }
    }));
  }
  const cerrar = () => `<p class="pauta-note"><button type="button" class="cerrar">Cerrar con candado en este equipo</button></p>`;
  function enlazarCerrar(sec){
    const b = sec.querySelector(".cerrar");
    if(b) b.addEventListener("click", async () => { await K.cerrar(); if(redibujar) redibujar(); });
  }

  window.RK_pauta = {
    async meses(){ return K.indice("pauta"); },
    async dibujar(cont, mes){
      cont.innerHTML = `<section class="pauta" id="pauta" aria-label="Pauta en Meta"></section>`;
      const sec = cont.firstChild, titulo = `<div class="pauta-head"><h2>Pauta en Meta · ${esc(nombreMes(mes))}</h2></div>`;
      redibujar = () => this.dibujar(cont, mes);
      const [ms, L] = [await K.indice("pauta"), await K.llave()];
      const vacio = (b, s) => { sec.innerHTML = titulo + `<div class="vacio-mes"><b>${b}</b><span>${s}</span></div>`; };
      if(!L) return vacio("La pauta todavía no está aquí: falta ponerle su contraseña.", "Se pone una sola vez desde el kit del calendario.");
      if(!ms.length) return vacio("Todavía no hay fotos de la pauta.", "La primera llega con la tarea diaria de las 7:00 am.");
      if(!K.abierto() && !(await K.recordada())) return K.formulario(sec, titulo, redibujar);
      if(!abiertas) abiertas = await K.todas("pauta");
      dibujarMes(sec, mes, await cargarFichas());
    }
  };
})();
