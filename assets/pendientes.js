/* Panel Rustik · pendientes editables (Fátima y Sergio los agregan, editan y borran aquí).
   La lista vive en datos/pendientes/lista.cifrada.json, cerrada con el candado (assets/candado.js).
   Para GUARDAR, la página usa un permiso de GitHub que solo puede tocar el repositorio del panel;
   ese permiso también va cerrado con el candado (datos/pendientes/acceso.cifrado.json), así que
   solo funciona después de escribir la contraseña. Cada cambio es un commit en GitHub (queda el
   historial de quién cambió qué). Va abajo del calendario de cada mes: lo pide assets/panel.js
   con window.RK_pendientes. */
(function(){
  "use strict";
  const K = window.RK_candado;
  const MESL = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  const MES = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  const esc = s => String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  const nombreMes = k => MESL[+k.slice(5)-1] + " " + k.slice(0,4);
  const fechaCorta = s => { if(!s) return ""; const [y,m,d] = s.slice(0,10).split("-").map(Number); return d + " " + MES[m-1]; };
  const ahora = () => { const d = new Date(), p = n => String(n).padStart(2,"0"); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
  const QUIEN = ["Sergio", "Fátima", "Sergio y Fátima", "Ventas", "Visual"];
  const ESTADOS = {pendiente: "Por decidir", decidido: "Decidido", descartado: "Descartado"};
  const RUTA = "datos/pendientes/lista.cifrada.json";
  const b64utf8 = s => { const b = new TextEncoder().encode(s); let o = ""; for(let i = 0; i < b.length; i += 8192) o += String.fromCharCode(...b.subarray(i, i + 8192)); return btoa(o); };

  let acceso, redibujar = null, aviso = "";
  K.alAbrir(() => { acceso = undefined; });

  async function cargarAcceso(){
    if(acceso !== undefined) return acceso;
    try{ const r = await fetch("datos/pendientes/acceso.cifrado.json", {cache:"no-store"}); acceso = r.ok ? await K.descifrar(await r.json()) : null; }
    catch(e){ acceso = null; }
    return acceso;
  }
  const api = (a, metodo, cuerpo) => fetch(`https://api.github.com/repos/${a.repo}/contents/${RUTA}${metodo === "GET" ? "?ref=" + encodeURIComponent(a.rama) + "&v=" + Date.now() : ""}`, {
    method: metodo, cache: "no-store",
    headers: {"Authorization": "Bearer " + a.token, "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"},
    body: cuerpo ? JSON.stringify(cuerpo) : undefined});

  /* lee la lista: con permiso, directo de GitHub (lo más nuevo, sin esperar al panel); sin él, del panel */
  async function leer(){
    const a = await cargarAcceso();
    if(a){
      const r = await api(a, "GET");
      if(r.status === 404) return {lista: {items: []}, sha: null};
      if(!r.ok) throw new Error("GitHub respondió " + r.status);
      const j = await r.json();
      return {lista: await K.descifrar(JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(j.content.replace(/\n/g, "")), c => c.charCodeAt(0))))), sha: j.sha};
    }
    const r = await fetch(RUTA, {cache:"no-store"});
    return {lista: r.ok ? await K.descifrar(await r.json()) : {items: []}, sha: null};
  }
  /* guarda un cambio; si otra persona guardó al mismo tiempo, vuelve a leer y lo aplica otra vez */
  async function guardar(cambio, mensaje){
    const a = await cargarAcceso();
    if(!a) throw new Error("La edición todavía no está activada.");
    for(let intento = 0; intento < 4; intento++){
      const {lista, sha} = await leer();
      cambio(lista.items = lista.items || []);
      lista.actualizado = ahora();
      const cuerpo = {message: mensaje, content: b64utf8(JSON.stringify(await K.cifrar(lista))), branch: a.rama};
      if(sha) cuerpo.sha = sha;
      const r = await api(a, "PUT", cuerpo);
      if(r.ok) return;
      if(r.status !== 409 && r.status !== 422) throw new Error(r.status === 401 || r.status === 403 ? "el permiso de GitHub venció o no alcanza (avísale a Fátima)" : "GitHub respondió " + r.status);
    }
    throw new Error("No se pudo guardar por cambios al mismo tiempo. Vuelve a intentar.");
  }
  function quienSoy(){
    let q = localStorage.getItem("rk-quien");
    if(!q){ q = (prompt("¿Quién está editando? (por ejemplo: Sergio o Fátima)") || "").trim().slice(0, 40); if(q) localStorage.setItem("rk-quien", q); }
    return q || "Alguien";
  }

  function tarjeta(x, puede){
    const chips = [`<span class="chip est-${esc(x.estado)}">${esc(ESTADOS[x.estado] || x.estado)}</span>`,
      x.quien ? `<span class="chip">${esc(x.quien)}</span>` : "",
      x.fecha_limite ? `<span class="chip">Para el ${esc(fechaCorta(x.fecha_limite))}</span>` : "",
      x.mes ? `<span class="chip suave">${esc(nombreMes(x.mes))}</span>` : ""].join("");
    return `<article class="pend" data-id="${esc(x.id)}"><div class="pend-top"><b>${esc(x.que)}</b><div class="chips">${chips}</div></div>
      ${x.decision ? `<p class="pend-dec">${esc(x.decision).replace(/\n/g, "<br>")}</p>` : ""}
      <p class="pend-meta">${x.actualizado ? `Último cambio: ${esc(fechaCorta(x.actualizado))}${x.por ? " · " + esc(x.por) : ""}` : ""}</p>
      ${puede ? `<div class="pend-btns">${x.estado === "pendiente" ? `<button type="button" data-acc="decidir">Ya se decidió</button>` : ""}<button type="button" data-acc="editar">Editar</button><button type="button" data-acc="borrar" class="peligro">Borrar</button></div>` : ""}</article>`;
  }
  function formulario(x, mes){
    x = x || {estado: "pendiente", mes};
    const quienes = QUIEN.includes(x.quien) || !x.quien ? QUIEN : [...QUIEN, x.quien];
    return `<form class="pend-form" data-id="${esc(x.id || "")}">
      <label>Qué hay que decidir o hacer<input name="que" required maxlength="200" value="${esc(x.que || "")}"></label>
      <div class="fila2"><label>Quién<select name="quien">${quienes.map(q => `<option${q === x.quien ? " selected" : ""}>${esc(q)}</option>`).join("")}</select></label>
      <label>Estado<select name="estado">${Object.entries(ESTADOS).map(([k, v]) => `<option value="${k}"${k === x.estado ? " selected" : ""}>${v}</option>`).join("")}</select></label>
      <label>Para cuándo<input type="date" name="fecha_limite" value="${esc(x.fecha_limite || "")}"></label>
      <label>Mes<input type="month" name="mes" value="${esc(x.mes || mes)}" required></label></div>
      <label>Lo que se decidió o notas (nombres, precios, fechas…)<textarea name="decision" rows="3" maxlength="2000">${esc(x.decision || "")}</textarea></label>
      <div class="pend-btns"><button type="submit" class="prim">Guardar</button><button type="button" data-acc="cancelar">Cancelar</button></div></form>`;
  }

  async function dibujar(cont, mes){
    cont.innerHTML = `<section class="pendientes" id="pendientes" aria-label="Pendientes"></section>`;
    const sec = cont.firstChild, titulo = `<div class="pauta-head"><h2>Pendientes del mes</h2><span class="pauta-upd">${esc(nombreMes(mes))}</span></div>`;
    redibujar = () => dibujar(cont, mes);
    const L = await K.llave();
    if(!L){ sec.innerHTML = titulo + `<div class="vacio-mes"><b>Los pendientes todavía no están activados.</b></div>`; return; }
    if(!K.abierto() && !(await K.recordada())) return K.formulario(sec, titulo, redibujar);
    sec.innerHTML = titulo + `<div class="cargando">Cargando los pendientes…</div>`;
    let lista, puede;
    try{ ({lista} = await leer()); puede = !!(await cargarAcceso()); }
    catch(e){ sec.innerHTML = titulo + `<div class="aviso"><b>No se pudieron cargar los pendientes.</b> ${esc(e.message)}. Recarga la página.</div>`; return; }
    const items = lista.items || [];
    const delMes = items.filter(x => x.mes === mes);
    const arrastrados = items.filter(x => x.mes < mes && x.estado === "pendiente");
    const grupo = (t, xs, nota) => xs.length ? `<h3 class="pend-h">${t} <small>${xs.length}</small></h3>${nota ? `<p class="pres-note">${nota}</p>` : ""}<div class="pend-lista">${xs.map(x => tarjeta(x, puede)).join("")}</div>` : "";
    sec.innerHTML = titulo +
      `<p class="pend-intro">Aquí van las cosas por decidir o por hacer del mes, y lo que vaya surgiendo. ${puede ? "Cualquiera con la contraseña puede agregar, editar o borrar; se guarda al momento y queda registro de quién cambió qué." : "<b>La edición todavía no está activada</b> (falta el permiso de GitHub); por ahora solo se pueden ver."}</p>
      ${aviso ? `<p class="pend-aviso" role="status">${aviso}</p>` : ""}
      ${puede ? `<div class="pend-nuevo"><button type="button" class="prim" data-acc="nuevo">+ Nuevo pendiente</button></div>` : ""}
      ${grupo("Por decidir", delMes.filter(x => x.estado === "pendiente"))}
      ${grupo("Todavía abiertos de meses anteriores", arrastrados, "Siguen por decidir. Al editarlos puedes pasarlos a este mes.")}
      ${grupo("Decididos", delMes.filter(x => x.estado === "decidido"))}
      ${grupo("Descartados", delMes.filter(x => x.estado === "descartado"))}
      ${!delMes.length && !arrastrados.length ? `<div class="vacio-mes"><b>No hay pendientes en ${esc(nombreMes(mes))}.</b>${puede ? "<span>Agrega el primero con «Nuevo pendiente».</span>" : ""}</div>` : ""}`;
    aviso = "";
    if(!puede) return;

    const hecho = msg => { aviso = msg; redibujar(); };
    const fallo = e => { aviso = "⚠ No se guardó: " + esc(e.message); redibujar(); };
    function abrirForm(lugar, x){
      lugar.insertAdjacentHTML("afterend", formulario(x, mes));
      const f = lugar.nextElementSibling; lugar.hidden = true;
      f.querySelector("[name=que]").focus();
      f.querySelector("[data-acc=cancelar]").addEventListener("click", () => { f.remove(); lugar.hidden = false; });
      f.addEventListener("submit", async e => {
        e.preventDefault();
        const d = Object.fromEntries(new FormData(f)), por = quienSoy();
        f.querySelector("button[type=submit]").disabled = true; f.querySelector("button[type=submit]").textContent = "Guardando…";
        const id = x && x.id ? x.id : "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        const nuevo = {id, que: d.que.trim(), quien: d.quien, estado: d.estado, decision: d.decision.trim(), fecha_limite: d.fecha_limite || "", mes: d.mes, actualizado: ahora(), por, creado: (x && x.creado) || ahora()};
        try{
          await guardar(items => { const i = items.findIndex(y => y.id === id); if(i >= 0) items[i] = nuevo; else items.push(nuevo); },
            `Pendientes: ${x && x.id ? "editado" : "nuevo"} «${nuevo.que.slice(0, 60)}» (${por})`);
          hecho("✓ Guardado. Los demás lo ven al recargar el panel.");
        }catch(err){ fallo(err); }
      });
    }
    sec.querySelector("[data-acc=nuevo]").addEventListener("click", e => abrirForm(e.target.parentElement, null));
    sec.querySelectorAll(".pend").forEach(card => {
      const x = items.find(y => y.id === card.dataset.id);
      card.querySelectorAll("[data-acc]").forEach(b => b.addEventListener("click", async () => {
        if(b.dataset.acc === "editar") return abrirForm(card, x);
        if(b.dataset.acc === "decidir") return abrirForm(card, Object.assign({}, x, {estado: "decidido", mes: x.mes < mes ? mes : x.mes}));
        if(b.dataset.acc === "borrar"){
          if(!confirm(`¿Borrar «${x.que}»? Si solo ya no va, mejor márcalo como «Descartado» para que quede el registro.`)) return;
          const por = quienSoy(); b.disabled = true; b.textContent = "Borrando…";
          try{ await guardar(items => { const i = items.findIndex(y => y.id === x.id); if(i >= 0) items.splice(i, 1); }, `Pendientes: borrado «${x.que.slice(0, 60)}» (${por})`); hecho("✓ Borrado."); }
          catch(err){ fallo(err); }
        }
      }));
    });
  }

  window.RK_pendientes = {
    async meses(){ return []; },
    dibujar
  };
})();
