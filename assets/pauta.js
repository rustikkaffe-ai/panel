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
  let abiertas = null, redibujar = null;
  K.alAbrir(() => { abiertas = null; });

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

  function dibujarMes(sec, mes){
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
        <div><small>Seguidores nuevos</small><b>${c.follows_ig==null&&c.follows_fb==null?"—":num((c.follows_ig||0)+(c.follows_fb||0))}</b>${c.follows_ig!=null||c.follows_fb!=null?`<span class="sub">IG ${num(c.follows_ig||0)} · FB ${num(c.follows_fb||0)}</span>`:""}</div><div><small>Visitas al perfil</small><b>${num(c.profile_visits)}</b></div></div></article>`;
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
    sec.innerHTML = h + `<p class="pauta-note">La línea negra en cada barra marca cuánto se debería llevar gastado a hoy si el presupuesto se reparte parejo entre las fechas de la campaña. Datos de Meta Ads Manager.</p>` + cerrar();
    enlazarCerrar(sec);
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
      dibujarMes(sec, mes);
    }
  };
})();
