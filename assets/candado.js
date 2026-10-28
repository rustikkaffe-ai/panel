/* Panel Rustik · el candado de la pauta y la presencia (una sola contraseña para las dos).
   datos/pauta/llave.json: llave pública RSA-OAEP (con ella las tareas de la nube cierran el
   candado sin saber la contraseña) y llave privada cifrada con la contraseña
   (PBKDF2-SHA256 → AES-GCM). datos/<tipo>/AAAA-MM.cifrada.json: cada foto del mes, con su
   clave AES-256-GCM envuelta con la llave pública (la escribe herramientas/cifrar.mjs).
   Todo se descifra aquí, en el navegador, y solo con la contraseña. */
(function(){
  "use strict";
  const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const a64 = u => btoa(String.fromCharCode(...new Uint8Array(u)));
  const RSA = {name:"RSA-OAEP", hash:"SHA-256"};
  const esc = s => String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  let llaveP = null, privada = null, indices = {}, fotos = {};
  const oyentes = [];

  const llave = () => llaveP || (llaveP = fetch("datos/pauta/llave.json", {cache:"no-store"}).then(r => r.ok ? r.json() : null).catch(() => null));
  const recuerdo = L => "rk-candado-" + L.salt;
  async function derivar(pass, L){
    const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pass), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey({name:"PBKDF2", hash:"SHA-256", salt:b64(L.salt), iterations:L.iter}, base, {name:"AES-GCM", length:256}, true, ["decrypt"]);
  }
  async function conClaveAES(aes){
    const L = await llave();
    const pkcs8 = await crypto.subtle.decrypt({name:"AES-GCM", iv:b64(L.iv)}, aes, b64(L.privada));
    privada = await crypto.subtle.importKey("pkcs8", pkcs8, RSA, false, ["decrypt"]);
    oyentes.forEach(f => f());
  }

  const C = window.RK_candado = {
    llave,
    abierto: () => !!privada,
    alAbrir(f){ oyentes.push(f); },
    async indice(tipo){
      return indices[tipo] || (indices[tipo] = fetch(`datos/${tipo}/indice.json`, {cache:"no-store"}).then(r => r.ok ? r.json() : {meses:[]}).then(x => x.meses || []).catch(() => []));
    },
    async abrir(pass, recordar){
      const L = await llave(), aes = await derivar(pass, L);
      await conClaveAES(aes);
      if(recordar) localStorage.setItem(recuerdo(L), a64(await crypto.subtle.exportKey("raw", aes)));
    },
    async recordada(){
      if(privada) return true;
      const L = await llave(); if(!L) return false;
      const g = localStorage.getItem(recuerdo(L)); if(!g) return false;
      try{ await conClaveAES(await crypto.subtle.importKey("raw", b64(g), "AES-GCM", true, ["decrypt"])); return true; }
      catch(e){ localStorage.removeItem(recuerdo(L)); return false; }
    },
    async cerrar(){ const L = await llave(); if(L) localStorage.removeItem(recuerdo(L)); privada = null; fotos = {}; oyentes.forEach(f => f()); },
    async foto(tipo, mes){
      const k = tipo + "/" + mes;
      if(!fotos[k]) fotos[k] = (async () => {
        const F = await (await fetch(`datos/${tipo}/${mes}.cifrada.json`, {cache:"no-store"})).json();
        const aes = await crypto.subtle.importKey("raw", await crypto.subtle.decrypt({name:"RSA-OAEP"}, privada, b64(F.clave)), "AES-GCM", false, ["decrypt"]);
        return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:"AES-GCM", iv:b64(F.iv)}, aes, b64(F.data))));
      })();
      return fotos[k];
    },
    async todas(tipo){
      const ms = await C.indice(tipo), out = [];
      for(const m of ms) out.push({mes: m, D: await C.foto(tipo, m)});
      return out;
    },
    /* el formulario de la contraseña, dentro de sec; al abrir llama a listo() */
    formulario(sec, titulo, listo, error){
      sec.innerHTML = `${titulo}<form class="candado" autocomplete="on">
        <p><b>La pauta y la presencia traen datos reales (también el dinero), por eso van con contraseña.</b> Escríbela para verlas (Fátima y Sergio la tienen). Una vez abierta, sirve para las dos.</p>
        <label for="rk-clave">Contraseña</label>
        <div class="fila"><input id="rk-clave" type="password" autocomplete="current-password" required><button type="submit">Abrir</button></div>
        <label class="rec"><input type="checkbox" id="rk-rec"> Recordarla en este equipo</label>
        <p class="err" role="alert">${error?esc(error):""}</p></form>`;
      const f = sec.querySelector("form");
      f.addEventListener("submit", async e => {
        e.preventDefault();
        const btn = f.querySelector("button"); btn.disabled = true; btn.textContent = "Abriendo…";
        try{ await C.abrir(f.querySelector("#rk-clave").value, f.querySelector("#rk-rec").checked); listo(); }
        catch(err){ C.formulario(sec, titulo, listo, "Esa contraseña no abre. Revísala y vuelve a intentar."); }
      });
    }
  };
  /* para la prueba del kit: abre sin escribir en la pantalla */
  window.abrirCandadoPrueba = pass => C.abrir(pass, false);
})();
