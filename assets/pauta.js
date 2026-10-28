/* Panel Rustik · pauta en Meta, mes por mes y con contraseña.
   datos/pauta/indice.json lista las «fotos» guardadas (una por mes: la última de ese mes) y
   datos/pauta/AAAA-MM.cifrada.json es cada foto CIFRADA (AES-GCM, clave sacada de la
   contraseña con PBKDF2-SHA256; la cifra bin/actualizar_pauta.py). Sin la contraseña no se
   puede leer: el archivo público es ruido. Todas las fotos usan la misma sal, así una sola
   contraseña (o la clave recordada en el equipo) abre todos los meses.
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
  const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const a64 = u => btoa(String.fromCharCode(...new Uint8Array(u)));
  const RECUERDO = "rk-pauta-clave";

  let indice = null, cifradas = {}, abiertas = null, llave = null, redibujar = null;
  const cargarIndice = () => indice || (indice = fetch("datos/pauta/indice.json", {cache:"no-store"}).then(r => r.ok ? r.json() : {meses:[]}).then(x => x.meses || []).catch(() => []));
  const cifrada = mm => cifradas[mm] || (cifradas[mm] = fetch(`datos/pauta/${mm}.cifrada.json`, {cache:"no-store"}).then(r => r.json()));

  async function derivar(pass, C){
    const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pass), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey({name:"PBKDF2", hash:"SHA-256", salt:b64(C.salt), iterations:C.iter}, base, {name:"AES-GCM", length:256}, true, ["decrypt"]);
  }
  async function descifrar(key, C){
    return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:"AES-GCM", iv:b64(C.iv)}, key, b64(C.data))));
  }
  async function abrirTodas(key){
    const ms = await cargarIndice(), out = [];
    for(const mm of ms) out.push({mes: mm, D: await descifrar(key, await cifrada(mm))});
    abiertas = out; llave = key;
  }

  function candado(sec, mes, ms, error){
    sec.innerHTML = `<div class="pauta-head"><h2>Pauta en Meta · ${esc(nombreMes(mes))}</h2></div><form class="candado" autocomplete="on">
      <p><b>La pauta tiene dinero, por eso va con contraseña.</b> Escríbela para verla (Fátima y Sergio la tienen).</p>
      <label for="pauta-clave">Contraseña</label>
      <div class="fila"><input id="pauta-clave" type="password" autocomplete="current-password" required><button type="submit">Ver la pauta</button></div>
      <label class="rec"><input type="checkbox" id="pauta-rec"> Recordarla en este equipo</label>
      <p class="err" role="alert">${error?esc(error):""}</p></form>`;
    const f = sec.querySelector("form");
    f.addEventListener("submit", async e => {
      e.preventDefault();
      const btn = f.querySelector("button"); btn.disabled = true; btn.textContent = "Abriendo…";
      try{
        const key = await derivar(f.querySelector("#pauta-clave").value, await cifrada(ms[ms.length-1]));
        await abrirTodas(key);
        if(f.querySelector("#pauta-rec").checked) localStorage.setItem(RECUERDO, a64(await crypto.subtle.exportKey("raw", key)));
        if(redibujar) redibujar();
      }catch(err){ candado(sec, mes, ms, "Esa contraseña no abre la pauta. Revísala y vuelve a intentar."); }
    });
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
  const cerrar = () => `<p class="pauta-note"><button type="button" class="cerrar">Cerrar la pauta en este equipo</button></p>`;
  function enlazarCerrar(sec){
    const b = sec.querySelector(".cerrar");
    if(b) b.addEventListener("click", () => { localStorage.removeItem(RECUERDO); abiertas = null; llave = null; if(redibujar) redibujar(); });
  }

  window.RK_pauta = {
    async meses(){ return cargarIndice(); },
    async dibujar(cont, mes){
      cont.innerHTML = `<section class="pauta" id="pauta" aria-label="Pauta en Meta"></section>`;
      const sec = cont.firstChild;
      redibujar = () => this.dibujar(cont, mes);
      const ms = await cargarIndice();
      if(!ms.length){
        sec.innerHTML = `<div class="pauta-head"><h2>Pauta en Meta · ${esc(nombreMes(mes))}</h2></div><div class="vacio-mes"><b>La pauta todavía no está aquí: falta ponerle su contraseña.</b><span>Mientras tanto se ve en <a href="https://claude.ai/artifact/3jVTCK7Z64dvVErGiF5coQ#pauta" target="_blank" rel="noopener">la página de Claude ↗</a>.</span></div>`;
        return;
      }
      if(!abiertas){
        const g = localStorage.getItem(RECUERDO);
        if(g){
          try{ await abrirTodas(await crypto.subtle.importKey("raw", b64(g), "AES-GCM", true, ["decrypt"])); }
          catch(e){ localStorage.removeItem(RECUERDO); abiertas = null; }
        }
      }
      if(!abiertas) return candado(sec, mes, ms);
      dibujarMes(sec, mes);
    }
  };
  /* para la prueba del kit: abre la pauta sin escribir en la pantalla */
  window.abrirPautaPrueba = async pass => { const ms = await cargarIndice(); await abrirTodas(await derivar(pass, await cifrada(ms[ms.length-1]))); if(redibujar) await redibujar(); };
})();
