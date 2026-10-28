/* Panel Rustik · la barra de arriba: Calendario de contenido · Pauta · Presencia digital ·
   Pendientes, y las
   flechas para ir de mes en mes. Cada vista dibuja un solo mes (panel.js, pauta.js,
   presencia.js). La dirección guarda lo que se está viendo: #calendario/2026-11,
   #pauta/2026-10, #presencia/2026-10.
   Mes con que abre: el mes en que estamos; en su última semana, si ya está el calendario del
   mes siguiente, abre en ese (así a fin de octubre ya se ve noviembre). */
(function(){
  "use strict";
  const MESL = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  const VISTAS = {calendario: {nombre: "Calendario de contenido", mod: () => window.RK_calendario},
                  pauta: {nombre: "Pauta", mod: () => window.RK_pauta},
                  presencia: {nombre: "Presencia digital", mod: () => window.RK_presencia},
                  pendientes: {nombre: "Pendientes", mod: () => window.RK_pendientes}};
  const clave = d => d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0");
  const nombreMes = k => { const n = MESL[+k.slice(5)-1]; return n[0].toUpperCase() + n.slice(1) + " " + k.slice(0,4); };
  const vista = document.getElementById("vista"), tabs = document.getElementById("vistas");
  const ant = document.getElementById("mes-ant"), sig = document.getElementById("mes-sig"), rotulo = document.getElementById("mes-nombre");

  let meses = [], estado = {vista: "calendario", mes: null}, porDefecto = null;

  function mesInicial(calendario){
    const hoy = new Date(), actual = clave(hoy), siguiente = clave(new Date(hoy.getFullYear(), hoy.getMonth()+1, 1));
    const quedan = new Date(hoy.getFullYear(), hoy.getMonth()+1, 0).getDate() - hoy.getDate();
    if(quedan < 7 && calendario.includes(siguiente)) return siguiente;
    return actual;
  }

  function leerHash(){
    const [v, m] = location.hash.slice(1).split("/");
    return {vista: VISTAS[v] ? v : "calendario", mes: /^\d{4}-\d{2}$/.test(m||"") ? m : porDefecto};
  }

  let turno = 0;
  async function mostrar(){
    const t = ++turno;
    tabs.querySelectorAll("button").forEach(b => b.setAttribute("aria-selected", b.dataset.v === estado.vista ? "true" : "false"));
    const i = meses.indexOf(estado.mes);
    rotulo.textContent = nombreMes(estado.mes);
    ant.disabled = i <= 0; sig.disabled = i < 0 || i >= meses.length - 1;
    ant.title = i > 0 ? nombreMes(meses[i-1]) : ""; sig.title = i >= 0 && i < meses.length-1 ? nombreMes(meses[i+1]) : "";
    document.title = `Panel Rustik · ${VISTAS[estado.vista].nombre} · ${nombreMes(estado.mes)}`;
    vista.innerHTML = `<div class="cargando">Cargando…</div>`;
    const cont = document.createElement("div");
    try{ await VISTAS[estado.vista].mod().dibujar(cont, estado.mes); }
    catch(e){ cont.innerHTML = `<div class="aviso"><b>No se pudo cargar esta parte del panel.</b> Recarga la página. Si sigue igual, avísale a Fátima (${String(e.message||e).replace(/</g,"&lt;")}).</div>`; }
    if(t !== turno) return;
    vista.innerHTML = ""; vista.appendChild(cont);
  }
  function ir(v, m, reemplazar){
    estado = {vista: v, mes: m};
    const h = `#${v}/${m}`;
    if(location.hash !== h) (reemplazar ? history.replaceState : history.pushState).call(history, null, "", h);
    mostrar(); window.scrollTo(0, 0);
  }

  tabs.innerHTML = Object.entries(VISTAS).map(([k, x]) => `<button type="button" role="tab" data-v="${k}">${x.nombre}</button>`).join("");
  tabs.querySelectorAll("button").forEach(b => b.addEventListener("click", () => ir(b.dataset.v, estado.mes)));
  ant.addEventListener("click", () => { const i = meses.indexOf(estado.mes); if(i > 0) ir(estado.vista, meses[i-1]); });
  sig.addEventListener("click", () => { const i = meses.indexOf(estado.mes); if(i < meses.length-1) ir(estado.vista, meses[i+1]); });
  window.addEventListener("popstate", () => { estado = leerHash(); mostrar(); });

  Promise.all([RK_calendario.meses().catch(() => []), RK_pauta.meses(), RK_presencia.meses()]).then(([cal, pau, pre]) => {
    porDefecto = mesInicial(cal);
    meses = [...new Set([...cal, ...pau, ...pre, clave(new Date()), porDefecto])].sort();
    estado = leerHash();
    if(!meses.includes(estado.mes)) { meses.push(estado.mes); meses.sort(); }
    ir(estado.vista, estado.mes, true);
  });
})();
