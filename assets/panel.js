/* Panel Rustik · calendario de contenido.
   Lee datos/meses/indice.json y un archivo por mes (datos/meses/AAAA-MM.json). Dibuja UN mes
   a la vez: lo pide assets/app.js (la barra de Calendario · Pauta · Presencia y las flechas
   de mes) con window.RK_calendario. Un mes puede traer "tema": "rojo" (encabezado rojo) e
   "ilustracion": "nombre" (assets/ilustraciones/nombre.svg). */
(function(){
  "use strict";
  const MES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  const DN = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];
  const TIPO = {video:"Video · atención (no vende)", post:"Post · venta", hist:"Historia", fecha:"Fecha / evento"};
  const COLOR = {video:"var(--verde)", post:"var(--vino)", hist:"var(--ochre)", fecha:"var(--ayote)",
                 vino:"var(--vino)", ochre:"var(--ochre)", ayote:"var(--ayote)", verde:"var(--verde)"};
  const ICONO = {video:"micro", post:"sobre", hist:"lapida", fecha:"fiesta"};

  const esc = s => String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  const neg = s => esc(s).replace(/\*\*(.+?)\*\*/g,"<b>$1</b>");
  const parrafos = s => String(s||"").split(/\n{2,}/).filter(x=>x.trim()).map(p=>`<p>${neg(p).replace(/\n/g,"<br>")}</p>`).join("");
  const fecha = k => { const [y,m,d] = k.split("-").map(Number); return new Date(y,m-1,d); };
  const clave = dt => dt.getFullYear()+"-"+String(dt.getMonth()+1).padStart(2,"0")+"-"+String(dt.getDate()).padStart(2,"0");
  const hoy = new Date();
  const mesActual = hoy.getFullYear()+"-"+String(hoy.getMonth()+1).padStart(2,"0");


  /* ---------- Panel lateral ---------- */
  const panel = document.getElementById("panel"), scrim = document.getElementById("scrim");
  const pT = document.getElementById("p-title"), pM = document.getElementById("p-meta"), pB = document.getElementById("p-body"), pI = document.getElementById("p-ill");
  let ultimo = null;
  function mostrar(titulo, meta, icono, color, html, desde){
    ultimo = desde || document.activeElement;
    pT.textContent = titulo; pM.textContent = meta; pB.innerHTML = html;
    pI.innerHTML = `<use href="#i-${icono}"/>`; pI.style.color = color;
    panel.hidden = false; scrim.hidden = false; pB.scrollTop = 0;
    document.getElementById("p-close").focus();
    pB.querySelectorAll("button[data-copiar]").forEach(b => b.addEventListener("click", () => copiar(b)));
  }
  function ocultar(){ panel.hidden = true; scrim.hidden = true; if(ultimo) ultimo.focus(); }
  document.getElementById("p-close").addEventListener("click", ocultar);
  scrim.addEventListener("click", ocultar);
  document.addEventListener("keydown", e => { if(e.key === "Escape" && !panel.hidden) ocultar(); });

  function copiar(b){
    const caja = document.getElementById(b.dataset.copiar), nota = b.parentElement.querySelector(".dlnote");
    const seleccionar = () => { const r = document.createRange(); r.selectNodeContents(caja); const s = getSelection(); s.removeAllRanges(); s.addRange(r); nota.textContent = "Texto seleccionado: cópialo con Ctrl+C o Cmd+C."; };
    try{ navigator.clipboard.writeText(caja.textContent).then(() => { nota.textContent = "Copiado."; }, seleccionar); }catch(e){ seleccionar(); }
  }

  /* ---------- Material HD ---------- */
  function tarjeta(x, cls){
    const mini = `<div class="mthumb"><img src="${esc(x.miniatura)}" alt="${esc(x.etiqueta)}" loading="lazy">${x.n?`<span class="n">${esc(x.n)}</span>`:""}${x.video?`<span class="play" aria-hidden="true"><span></span></span>`:""}</div>`;
    const datos = [x.medidas, x.duracion, x.peso].filter(Boolean).join(" · ");
    const boton = x.hd ? `<a class="dl" href="${esc(x.hd)}" download>Descargar HD</a>` : `<span class="vacio">Original pendiente de subir</span>`;
    const tip = x.texto ? `<span class="tip"><em>${esc(x.cuando||"Texto sugerido")}</em>${neg(x.texto)}</span>` : "";
    if(cls === "story") return `<div class="story">${mini}<div class="info"><b>${esc(x.etiqueta)}</b><small>${esc(datos)}</small>${tip}${boton}</div></div>`;
    return `<div class="mcard">${mini}<b>${esc(x.etiqueta)}</b><small>${esc(datos)}</small>${tip}${boton}</div>`;
  }
  function material(m){
    if(!m) return "";
    let h = m.intro ? `<p>${neg(m.intro)}</p>` : "";
    (m.grupos||[]).forEach(g => {
      h += `<h4>${esc(g.titulo)}</h4>`;
      if(g.tipo === "historia" && g.items.length === 1) h += tarjeta(g.items[0], "story");
      else h += `<div class="media-grid${g.tipo==="historias"?" three st":""}${g.columnas===3?" three":""}">${g.items.map(x => tarjeta(x)).join("")}</div>`;
    });
    return h;
  }
  function cajas(lista, clase, titulo){
    return (lista||[]).map(t => `<div class="box${clase?" "+clase:""}"><b>${esc(titulo)}</b> ${neg(t)}</div>`).join("");
  }

  /* ---------- Una pieza ---------- */
  function abrirPieza(m, p, desde){
    const base = p.tipo;
    const dt = fecha(p.fecha);
    const meta = `${DN[dt.getDay()]} ${dt.getDate()} de ${MES[dt.getMonth()]}${p.hora?" · "+p.hora:""} · ${TIPO[base]}`;
    let h = "";
    if(p.gancho) h += `<p class="hook">"${esc(p.gancho)}"</p>`;
    if(p.detalle_html) h += p.detalle_html; else h += parrafos(p.detalle);
    h += material(p.material);
    if(p.copy){
      const id = "copy-" + p.id;
      h += `<h4>Copy para subir</h4><pre class="copybox" id="${id}">${esc(p.copy)}</pre><div class="copyrow"><button class="dl alt" type="button" data-copiar="${id}">Copiar copy</button><span class="dlnote"></span></div>`;
    }
    h += (p.notas_html||"") + cajas(p.notas, "pend", "Antes de publicar:") + cajas(p.pendientes, "pend", "Pendiente:");
    if(!h) h = `<p>${esc(TIPO[base])} de apoyo. Amplifica lo que se publica ese día.</p>`;
    const titulo = (p.material && p.material.titulo) || p.titulo.replace(/^(Post|Historia): /,"");
    mostrar(titulo, (p.material && p.material.meta) || meta, p.icono || ICONO[base], COLOR[base], h, desde);
  }
  function abrirFecha(m, f, desde){
    let h = f.html || "";
    if(!f.html){
      if(f.decision) h += `<p><b>Decisión:</b> ${neg(f.decision)}</p>`;
      (f.secciones||[]).forEach(s => {
        h += `<h4>${esc(s.titulo)}</h4>`;
        if(s.texto) h += parrafos(s.texto);
        if(s.puntos) h += `<ul class="bullets">${s.puntos.map(x => `<li>${neg(x)}</li>`).join("")}</ul>`;
        if(s.copy) h += `<div class="invite"><small>${esc(s.copy_cuando||"")}</small>${esc(s.copy).replace(/\n/g,"<br>")}</div>`;
      });
      h += cajas(f.listo, "", "Listo:") + cajas(f.pendientes, "pend", "Pendiente:");
    }
    mostrar(f.titulo, f.meta||"", f.icono||"fiesta", COLOR[f.color]||COLOR.ayote, h, desde);
  }

  /* ---------- Un mes ---------- */
  function resumen(m){
    const P = m.piezas || [], n = t => P.filter(p => p.tipo === t).length;
    const conHD = P.filter(p => p.material && (p.material.grupos||[]).some(g => (g.items||[]).some(x => x.hd))).length;
    const k = (t, v, s) => `<div class="kpi"><small>${t}</small><b>${v}</b><span>${s}</span></div>`;
    return `<section class="resumen-mes" aria-label="El mes en números"><div class="kpis">`+
      k("Videos", n("video"), "de atención (no venden)") + k("Posts y carruseles", n("post"), "de venta") +
      k("Historias y fechas", n("hist") + n("fecha"), `${(m.fechas_grandes||[]).length} fechas grandes`) +
      k("Material HD", conHD, `de ${P.length} piezas ya tienen original`) +
      `</div><p class="pres-note">Los pendientes del mes están <a href="#" class="ir-pend">abajo del calendario</a>: ahí se agregan, se editan y se borran.</p></section>`;
  }

  function dibujarMes(m){
    const [y, mm] = m.mes.split("-").map(Number);
    const abierto = true;
    const sec = document.createElement("section");
    sec.className = "mes principal" + (m.tema ? " tema-" + m.tema : ""); sec.id = "mes-" + m.mes;
    const estado = m.mes === mesActual ? "Este mes" : (m.mes > mesActual ? "Próximo" : "Anterior");
    const titulo = m.campana_em ? `${esc(m.campana)} <em>${esc(m.campana_em)}</em>` : esc(m.campana);
    let h = `<span class="mes-tag${abierto?" actual":""}">${estado} · ${esc(m.titulo_mes)}</span>
      <header class="hero${m.ilustracion?" con-ilus":""}"><div><div class="eyebrow">${esc(m.eyebrow||"")}</div><h1>${titulo}</h1>${m.intro?`<p>${neg(m.intro)}</p>`:""}</div>${m.ilustracion?`<div class="hero-ilus"><img src="assets/ilustraciones/${esc(m.ilustracion)}.svg" alt="" width="580" height="400"></div>`:""}</header>`;
    h += resumen(m);
    if((m.momentos||[]).length) h += `<section class="moments" aria-label="Las partes del mes">${m.momentos.map(x => `<div class="moment" style="--c:${COLOR[x.color]||COLOR.vino}"><span>${esc(x.fechas)}</span><b>${esc(x.titulo)}</b><p>${neg(x.texto)}</p></div>`).join("")}</section>`;
    h += `<div class="rule"><p>${neg(m.regla||"")}</p><div class="legend" aria-label="Leyenda"><span class="chip-key k-video"><i></i>Video · atención</span><span class="chip-key k-post"><i></i>Post · venta</span><span class="chip-key k-hist"><i></i>Historia</span><span class="chip-key k-fecha"><i></i>Fecha / evento</span></div></div>`;
    h += `<div class="cal-head" aria-hidden="true"><div>Lun</div><div>Mar</div><div>Mié</div><div>Jue</div><div>Vie</div><div>Sáb</div><div>Dom</div></div><div class="cal"></div>`;
    if(m.nota) h += `<p class="note">${neg(m.nota)}</p>`;
    if((m.fechas_grandes||[]).length) h += `<section class="opts"><div class="eyebrow">Para Sergio</div><h2>Lo que haremos en cada fecha grande</h2><div class="opt-buttons">${m.fechas_grandes.map(f => `<button class="big-btn" type="button" data-fg="${esc(f.id)}" style="--c:${COLOR[f.color]||COLOR.ayote}"><svg><use href="#i-${esc(f.icono||"fiesta")}"/></svg><span><b>${esc(f.boton||f.titulo)}</b><small>${esc(f.resumen||"")}</small></span></button>`).join("")}</div></section>`;
    h += `<div class="pend-slot"></div>`;
    if(m.pie) h += `<p class="note">${neg(m.pie)}</p>`;
    sec.innerHTML = h;

    /* calendario: del lunes de la semana del día 1 al domingo de la semana del último día */
    const cal = sec.querySelector(".cal");
    const primero = new Date(y, mm-1, 1), ultimoDia = new Date(y, mm, 0);
    /* si hay piezas antes del día 1 o después del último (lanzamientos adelantados), el calendario las incluye */
    const fechas = (m.piezas||[]).map(p => fecha(p.fecha));
    const desde = new Date(Math.min(primero, ...fechas)), hasta = new Date(Math.max(ultimoDia, ...fechas));
    const inicio = new Date(desde); inicio.setDate(desde.getDate() - ((desde.getDay()+6)%7));
    const fin = new Date(hasta); fin.setDate(hasta.getDate() + (6 - ((hasta.getDay()+6)%7)));
    const porDia = {};
    (m.piezas||[]).forEach(p => (porDia[p.fecha] = porDia[p.fecha] || []).push(p));
    const fg = {}; (m.fechas_grandes||[]).forEach(f => fg[f.id] = f);
    const etiquetas = m.etiquetas_dia || {};
    for(let dt = new Date(inicio); dt <= fin; dt.setDate(dt.getDate()+1)){
      const k = clave(dt), piezas = porDia[k] || [], otro = dt.getMonth() !== mm-1;
      const celda = document.createElement("div");
      celda.className = "day" + (otro?" other":"") + (etiquetas[k]?" key":"") + (piezas.length?"":" empty");
      celda.innerHTML = `<div class="top"><span class="num">${dt.getDate()}<span class="dname">${DN[dt.getDay()]}${otro?" · "+MES[dt.getMonth()]:""}</span></span>${etiquetas[k]?`<span class="tag">${esc(etiquetas[k])}</span>`:""}</div>`;
      piezas.forEach(p => {
        const b = document.createElement("button"); b.type = "button";
        b.className = "item " + p.tipo + (p.grande?" big":"");
        const hd = p.material ? `<span class="hd">HD</span>` : (p.abre ? `<span class="has-opt">ver</span>` : "");
        b.innerHTML = `<svg aria-hidden="true"><use href="#i-${esc(p.icono||ICONO[p.tipo])}"/></svg><span>${esc(p.titulo)}${p.hora?` <span style="font-weight:500;opacity:.8">· ${esc(p.hora)}</span>`:""}</span>${hd}`;
        b.addEventListener("click", () => p.abre && fg[p.abre] && !p.material && !p.gancho && !p.detalle && !p.detalle_html ? abrirFecha(m, fg[p.abre], b) : abrirPieza(m, p, b));
        celda.appendChild(b);
      });
      cal.appendChild(celda);
    }
    sec.querySelectorAll("[data-fg]").forEach(b => b.addEventListener("click", () => abrirFecha(m, fg[b.dataset.fg], b)));
    return sec;
  }

  /* ---------- Para app.js ---------- */
  let cache = null;
  window.RK_calendario = {
    cargar(){
      if(!cache) cache = fetch("datos/meses/indice.json", {cache:"no-store"}).then(r => r.json()).then(lista => Promise.all(
        lista.meses.map(mm => fetch(`datos/meses/${mm}.json`, {cache:"no-store"}).then(r => { if(!r.ok) throw new Error(mm); return r.json(); }))));
      return cache;
    },
    async meses(){ return (await this.cargar()).map(m => m.mes); },
    async dibujar(cont, mes){
      const m = (await this.cargar()).find(x => x.mes === mes);
      if(!m) cont.innerHTML = `<div class="vacio-mes"><b>No hay calendario de ${esc(nombreMes(mes))}.</b><span>Se arma con el brief y la reunión con Sergio: dile a Claude «armemos ${esc(MES[+mes.slice(5)-1])}».</span></div><div class="pend-slot"></div>`;
      else { cont.innerHTML = ""; cont.appendChild(dibujarMes(m)); }
      /* los pendientes del mes van aquí mismo, abajo del calendario */
      const slot = cont.querySelector(".pend-slot");
      cont.querySelectorAll(".ir-pend").forEach(a => a.addEventListener("click", e => { e.preventDefault(); slot.scrollIntoView({behavior: "smooth"}); }));
      if(slot && window.RK_pendientes) await window.RK_pendientes.dibujar(slot, mes);
    }
  };
  const nombreMes = k => MES[+k.slice(5)-1] + " " + k.slice(0,4);
})();
