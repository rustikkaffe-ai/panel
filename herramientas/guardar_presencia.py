#!/usr/bin/env python3
"""Guarda la presencia digital del mes en el panel. La usan la tarea de los viernes de la nube
y el kit.

    python3 herramientas/guardar_presencia.py /tmp/presencia.json

Este repositorio es público, así que antes de escribir se quita:
- los nombres de quienes dejaron reseñas en Google (van en «type» de cada reseña) y los de
  OCULTAR, en todos los textos (se cambian por «un cliente»),
- los enlaces internos de Google Business (business.google.com, piden sesión),
- cualquier monto en dólares (el dinero va solo en la pauta, cifrada).
Escribe datos/presencia/AAAA-MM.json (el mes de "updated"; la última foto de cada mes se
queda) y actualiza datos/presencia/indice.json. Sale con código 1 si queda algo privado.
"""
import json, os, re, sys

OCULTAR = ["Maddie Adams"]   # nombres que aparecieron en notas sin estar en las reseñas

if len(sys.argv) != 2: sys.exit(__doc__)
raiz = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
try:
    P = json.load(open(sys.argv[1], encoding="utf-8"))
except Exception as e:
    sys.exit(f"✗ La presencia no es un JSON válido: {e}")
if not isinstance(P.get("networks"), list): sys.exit("✗ Falta la lista «networks».")
mes = str(P.get("updated", ""))[:7]
if not re.fullmatch(r"\d{4}-\d{2}", mes): sys.exit("✗ Falta «updated» con formato AAAA-MM-DDTHH:MM.")

nombres = set(OCULTAR)
for n in P["networks"]:
    if n.get("id") == "gmb":
        for t in n.get("top", []):
            if t.get("type") and t["type"] != "Reseña en Google": nombres.add(t["type"].strip())
            t["type"] = "Reseña en Google"
            t.pop("url", None)
        n.pop("link_label", None)
partes = set()
for nm in nombres:
    partes.add(nm)
    if len(nm.split()[0]) > 2: partes.add(nm.split()[0])
patron = re.compile(r"\b(" + "|".join(re.escape(x) for x in sorted(partes, key=len, reverse=True)) + r")\b") if partes else None

def limpiar(x):
    if isinstance(x, dict): return {k: limpiar(v) for k, v in x.items() if not (k == "url" and "business.google.com" in str(v))}
    if isinstance(x, list): return [limpiar(v) for v in x]
    if isinstance(x, str):
        if patron: x = patron.sub("un cliente", x)
        return re.sub(r"\s*\(?(?:US)?\$\s?\d[\d,.]*\)?", "", x)
    return x

P = limpiar(P)
texto = json.dumps(P, ensure_ascii=False)
quedan = [x for x in partes if re.search(r"\b" + re.escape(x) + r"\b", texto)]
if quedan or re.search(r"\$\s?\d", texto) or "business.google.com" in texto:
    sys.exit(f"✗ Quedó algo privado, no se guarda: {quedan}")

carpeta = os.path.join(raiz, "datos", "presencia"); os.makedirs(carpeta, exist_ok=True)
salida = os.path.join(carpeta, f"{mes}.json")
if os.path.exists(salida) and json.load(open(salida, encoding="utf-8")).get("updated", "") > P["updated"]:
    sys.exit(f"✗ Ya hay una foto de {mes} más nueva; no se reemplaza.")
json.dump(P, open(salida, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
ix = os.path.join(carpeta, "indice.json")
meses = json.load(open(ix, encoding="utf-8")).get("meses", []) if os.path.exists(ix) else []
json.dump({"meses": sorted(set(meses + [mes]))}, open(ix, "w", encoding="utf-8"), ensure_ascii=False)
redes = ", ".join(n["name"] for n in P["networks"] if n.get("connected"))
print(f"✓ Presencia guardada en datos/presencia/{mes}.json: {redes}. Datos del {P['updated']}. Ocultados {len(nombres)} nombres.")
