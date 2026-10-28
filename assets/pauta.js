/* Panel Rustik · pauta en Meta (con contraseña).
   datos/pauta.cifrada.json trae la pauta cifrada (AES-GCM, clave sacada de la contraseña con
   PBKDF2-SHA256). La cifra bin/actualizar_pauta.py; aquí solo se descifra en el navegador.
   Sin la contraseña no se puede leer: el archivo público es ruido. El dibujo es el mismo de la
   sección «Pauta en Meta» de la página de Claude. */
(function(){
  "use strict";
  const sec = document.getElementById("pauta");
  if(!sec) return;
  const MES = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  const esc = s => String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  const money = v => v==null ? "—" : "$" + Number(v).toFixed(2);
  const num = v => v==null ? "—" : Number(v).toLocaleString("en-US");
  const dd = s => { const [y,m,d] = s.split("-").map(Number); return new Date(y, m-1, d); };
  const fmt = s => { const x = dd(s); return x.getDate()+" "+MES[x.getMonth()]; };
  const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const a64 = u => btoa(String.fromCharCode(...new Uint8Array(u)));
  const cab = `<div class="pauta-head"><h2>Pauta en Meta</h2><span class="pauta-upd" id="pauta-upd"></span></div>`;

  async function clave(pass, C){
    const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pass), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey({name:"PBKDF2", hash:"SHA-256", salt:b64(C.salt), iterations:C.iter}, base, {name:"AES-GCM", length:256}, true, ["decrypt"]);
  }
  async function descifrar(key, C){
    const plano = await crypto.subtle.decrypt({name:"AES-GCM", iv:b64(C.iv)}, key, b64(C.data));
    return JSON.parse(new TextDecoder().decode(plano));
  }
  const guardada = C => "rk-pauta-" + C.salt;

  function candado(C, error){
    sec.innerHTML = cab + `<form class="candado" autocomplete="on">
      <p><b>La pauta tiene dinero, por eso va con contraseña.</b> Escríbela para verla (Fátima y Sergio la tienen).</p>
      <label for="pauta-clave">Contraseña</label>
      <div class="fila"><input id="pauta-clave" type="password" autocomplete="current-password" required><button type="submit">Ver la pauta</button></div>
      <label class="rec"><input type="checkbox" id="pauta-rec"> Recordarla en este equipo</label>
      <p class="err" role="alert">${error?esc(error):""}</p></form>`;
    sec.querySelector("#pauta-upd").textContent = C.actualizado ? "Datos del " + fmtHora(C.actualizado) : "";
    const f = sec.querySelector("form");
    f.addEventListener("submit", async e => {
      e.preventDefault();
      const btn = f.querySelector("button"); btn.disabled = true; btn.textContent = "Abriendo…";
      try{
        const key = await clave(f.querySelector("#pauta-clave").value, C);
        const D = await descifrar(key, C);
        if(f.querySelector("#pauta-rec").checked) localStorage.setItem(guardada(C), a64(await crypto.subtle.exportKey("raw", key)));
        dibujar(D, C);
      }catch(err){ candado(C, "Esa contraseña no abre la pauta. Revísala y vuelve a intentar."); }
    });
  }
  const fmtHora = s => { const u = new Date(s); return u.getDate()+" "+MES[u.getMonth()]+" "+String(u.getHours()).padStart(2,"0")+":"+String(u.getMinutes()).padStart(2,"0"); };

  function dibujar(D, C){
    const upd = new Date(D.updated), today = new Date(upd.getFullYear(), upd.getMonth(), upd.getDate());
    const Cs = D.campaigns || [];
    const budget = Cs.reduce((a,c)=>a+(c.budget||0),0), spent = Cs.reduce((a,c)=>a+(c.spent||0),0), reach = Cs.reduce((a,c)=>a+(c.reach||0),0);
    const live = Cs.filter(c => dd(c.start) <= today).length;
    let h = cab + `<div class="kpis">`+
      `<div class="kpi"><small>Presupuesto total</small><b>${money(budget)}</b><span>${Cs.length} campaña${Cs.length===1?"":"s"}</span></div>`+
      `<div class="kpi"><small>Gastado</small><b>${money(spent)}</b><span>${budget?Math.round(spent/budget*100):0}% del total</span></div>`+
      `<div class="kpi"><small>Queda</small><b>${money(budget-spent)}</b><span>por gastar</span></div>`+
      `<div class="kpi"><small>Alcance</small><b>${num(reach)}</b><span>cuentas · ${live} en circulación</span></div></div>`;
    h += `<div class="camps">` + Cs.map(c => {
      const s = dd(c.start), e = dd(c.end), total = Math.round((e-s)/864e5)+1;
      const el = Math.min(total, Math.max(0, Math.round((today-s)/864e5)+1));
      const started = today >= s, ended = today > e;
      const pill = ended ? `<span class="pill off">Terminó</span>` : started ? `<span class="pill on">Activa</span>` : `<span class="pill soon">Arranca ${fmt(c.start)}</span>`;
      const pct = c.budget ? Math.min(100, c.spent/c.budget*100) : 0, exp = started ? Math.min(100, el/total*100) : 0;
      return `<article class="camp"><div><h3>${esc(c.label)}${pill}</h3><div class="meta">${esc(c.objective)} · ${fmt(c.start)} – ${fmt(c.end)} · anuncio: ${esc((c.ads||[]).join(", "))}</div>
        <div class="gbar" role="img" aria-label="Gastado ${money(c.spent)} de ${money(c.budget)}"><i style="width:${pct}%"></i>${started?`<em style="left:${exp}%"></em>`:""}</div>
        <div class="barlbl"><span>${money(c.spent)} de ${money(c.budget)}</span><span>${started?`día ${el} de ${total}`:`${total} días`}</span></div></div>
        <div class="mets"><div><small>Alcance</small><b>${num(c.reach)}</b></div><div><small>Impresiones</small><b>${num(c.impressions)}</b></div><div><small>Frecuencia</small><b>${c.frequency?Number(c.frequency).toFixed(2):"—"}</b></div>
        <div><small>Clics</small><b>${num(c.clicks)}</b></div><div><small>CTR</small><b>${c.ctr==null?"—":esc(c.ctr)+"%"}</b></div><div><small>${esc(c.cpr_label||"Costo por resultado")}</small><b>${money(c.cpr)}</b></div>
        <div><small>Seguidores nuevos</small><b>${c.follows_ig==null&&c.follows_fb==null?"—":num((c.follows_ig||0)+(c.follows_fb||0))}</b>${c.follows_ig!=null||c.follows_fb!=null?`<span class="sub">IG ${num(c.follows_ig||0)} · FB ${num(c.follows_fb||0)}</span>`:""}</div><div><small>Visitas al perfil</small><b>${num(c.profile_visits)}</b></div></div></article>`;
    }).join("") + `</div>`;
    const B = D.boosts;
    if(B && (B.items||[]).length){
      const it = B.items, sum = k => it.reduce((s,x)=>s+(x[k]||0),0), seg = sum("follows_ig")+sum("follows_fb");
      h += `<section class="boosts"><h3>${esc(B.title||"Promociones desde la app de Instagram")}</h3>${B.meta?`<p class="meta">${esc(B.meta)}</p>`:""}
        <div class="kpis"><div class="kpi"><small>Gastado</small><b>${money(sum("spent"))}</b><span>${it.length} promociones</span></div><div class="kpi"><small>Seguidores en Instagram</small><b>+${num(sum("follows_ig"))}</b><span>atribuidos a los anuncios</span></div><div class="kpi"><small>Seguidores en Facebook</small><b>+${num(sum("follows_fb"))}</b><span>atribuidos a los anuncios</span></div><div class="kpi"><small>Costo por seguidor</small><b>${seg?money(sum("spent")/seg):"—"}</b><span>promedio</span></div></div>
        <div class="bwrap"><table class="btable"><thead><tr><th>Publicación</th><th>Fechas</th><th class="n">Gastado</th><th class="n">Alcance</th><th class="n">Seguidores IG</th><th class="n">Seguidores FB</th></tr></thead><tbody>${it.map(x=>`<tr><td>${x.url?`<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.name)}</a>`:esc(x.name)}</td><td>${x.start?fmt(x.start):""} – ${x.end?fmt(x.end):""}</td><td class="n">${money(x.spent)}</td><td class="n">${num(x.reach)}</td><td class="n">${num(x.follows_ig)}</td><td class="n">${num(x.follows_fb)}</td></tr>`).join("")}</tbody></table></div>
        ${B.note?`<p class="pauta-note">${esc(B.note)}</p>`:""}</section>`;
    }
    h += `<div class="analisis">${D.summary?`<h4>Cómo van</h4><p>${esc(D.summary)}</p>`:""}${(D.points||[]).length?`<ul>${D.points.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>`:""}${D.next?`<h4>Próximo paso</h4><p>${esc(D.next)}</p>`:""}</div>
      <p class="pauta-note">La línea negra en cada barra marca cuánto se debería llevar gastado a hoy si el presupuesto se reparte parejo entre las fechas de la campaña. Datos de Meta Ads Manager. <button type="button" class="cerrar">Cerrar la pauta en este equipo</button></p>`;
    sec.innerHTML = h;
    sec.querySelector("#pauta-upd").textContent = "Datos del " + fmtHora(D.updated);
    sec.querySelector(".cerrar").addEventListener("click", () => { localStorage.removeItem(guardada(C)); candado(C); });
  }

  /* para probar el descifrado sin escribir en la pantalla (lo usa la prueba del kit) */
  window.abrirPautaPrueba = async pass => { const C = await (await fetch("datos/pauta.cifrada.json", {cache:"no-store"})).json(); dibujar(await descifrar(await clave(pass, C), C), C); };

  fetch("datos/pauta.cifrada.json", {cache:"no-store"}).then(r => { if(!r.ok) throw new Error("sin pauta"); return r.json(); }).then(async C => {
    const g = localStorage.getItem(guardada(C));
    if(g){
      try{ const key = await crypto.subtle.importKey("raw", b64(g), "AES-GCM", false, ["decrypt"]); return dibujar(await descifrar(key, C), C); }
      catch(e){ localStorage.removeItem(guardada(C)); }
    }
    candado(C);
  }).catch(() => {
    sec.innerHTML = cab + `<p class="pauta-note">La pauta todavía no está aquí: falta ponerle su contraseña. Mientras tanto se ve en <a href="https://claude.ai/artifact/3jVTCK7Z64dvVErGiF5coQ#pauta" target="_blank" rel="noopener">la página de Claude ↗</a>.</p>`;
  });
})();
