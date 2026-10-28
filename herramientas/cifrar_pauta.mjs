// Guarda la pauta del mes en el panel, CIFRADA. La usan la tarea diaria de la nube y el kit.
//
//   node herramientas/cifrar_pauta.mjs /tmp/pauta.json
//
// La pauta tiene dinero y este repositorio es público. Se cifra con la llave PÚBLICA de
// datos/pauta/llave.json (RSA-OAEP-SHA256 envuelve una clave AES-256-GCM nueva en cada foto):
// para cerrar el candado no hace falta la contraseña; para abrirlo sí (la llave privada va
// cifrada con la contraseña y solo se abre en el navegador de quien la sabe).
// Escribe datos/pauta/AAAA-MM.cifrada.json (el mes de "updated") y actualiza indice.json.
// El archivo sin cifrar NUNCA puede estar dentro del repositorio.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(raiz, "datos", "pauta");
const fallar = m => { console.error("✗ " + m); process.exit(1); };
const b64 = u => Buffer.from(u).toString("base64");

const entrada = process.argv[2];
if (!entrada) fallar("Falta el archivo de la pauta. Uso: node herramientas/cifrar_pauta.mjs /tmp/pauta.json");
if (path.resolve(entrada).startsWith(raiz + path.sep)) fallar("La pauta sin cifrar no puede estar dentro del repositorio: guárdala en /tmp.");
const plano = fs.readFileSync(entrada);
let D; try { D = JSON.parse(plano.toString("utf8")); } catch (e) { fallar("La pauta no es un JSON válido: " + e.message); }
if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(D.updated || "")) fallar("Falta «updated» con formato AAAA-MM-DDTHH:MM.");
if (!Array.isArray(D.campaigns)) fallar("Falta la lista «campaigns».");
const llavePath = path.join(dir, "llave.json");
if (!fs.existsSync(llavePath)) fallar("Falta datos/pauta/llave.json (se crea una sola vez en el kit, con la contraseña).");
const llave = JSON.parse(fs.readFileSync(llavePath, "utf8"));

const mes = D.updated.slice(0, 7), salida = path.join(dir, `${mes}.cifrada.json`);
if (fs.existsSync(salida) && (JSON.parse(fs.readFileSync(salida, "utf8")).actualizado || "") > D.updated)
  fallar(`Ya hay una foto de la pauta de ${mes} más nueva; no se reemplaza.`);

const s = globalThis.crypto.subtle;
const publica = await s.importKey("spki", Buffer.from(llave.publica, "base64"), { name: "RSA-OAEP", hash: "SHA-256" }, false, ["encrypt"]);
const k = await s.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt"]);
const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
const data = await s.encrypt({ name: "AES-GCM", iv }, k, plano);
const clave = await s.encrypt({ name: "RSA-OAEP" }, publica, await s.exportKey("raw", k));
const out = { v: 2, alg: "RSA-OAEP-SHA256 + AES-256-GCM", actualizado: D.updated, clave: b64(clave), iv: b64(iv), data: b64(data) };
const texto = JSON.stringify(out);
if (texto.includes("$") || texto.includes("campaigns")) fallar("El archivo cifrado trae texto legible; no se guarda.");
fs.writeFileSync(salida, texto);

const ix = path.join(dir, "indice.json");
const meses = fs.existsSync(ix) ? (JSON.parse(fs.readFileSync(ix, "utf8")).meses || []) : [];
fs.writeFileSync(ix, JSON.stringify({ meses: [...new Set([...meses, mes])].sort() }));
console.log(`✓ Pauta cifrada en datos/pauta/${mes}.cifrada.json: ${D.campaigns.length} campañas, datos del ${D.updated}.`);
