"""
Genera supabase/sencilla/esquema.sql: TODAS las tablas, funciones y permisos de
Campo (migraciones 0001 en adelante) SIN los datos de las fincas de la familia.
Sirve para montar Campo «versión sencilla» en el Supabase de otra persona.

Se quitan: INSERT / UPDATE / DELETE sobre public.*, los bloques DO que meten
datos y las consultas de comprobación (SELECT). Se dejan: tablas, columnas,
funciones, políticas, disparadores y los cajones de Storage.

Uso (desde la raíz del repositorio):  python supabase/sencilla/generar.py
Vuelve a ejecutarlo cada vez que haya una migración nueva.
"""
import glob, re, sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent

CABECERA = """-- =====================================================================
-- CAMPO · Versión sencilla · Esquema completo SIN datos
-- Generado con supabase/sencilla/generar.py a partir de supabase/migrations.
-- NO lo edites a mano: cambia la migración y vuelve a generarlo.
--
-- Cómo aplicarlo en un Supabase NUEVO (vacío):
--   SQL Editor → pegar el archivo completo → Run. Solo una vez.
-- Después: supabase/sencilla/LEEME.md (OAuth, primer usuario, datos de la finca).
-- =====================================================================

"""

# Textos de los comentarios que nombran a la familia
CAMBIOS = {
    "(Chelo, una comunidad de bienes y sus comuneros)": "(por ejemplo, una comunidad de bienes y sus comuneros)",
    " false = solo es socio o comunero (Chelo).": " false = solo es socio o comunero.",
}

def trocear(sql):
    """Parte un archivo SQL en sentencias de primer nivel (respeta $$, comillas y comentarios)."""
    out, cur, i, n = [], [], 0, len(sql)
    dolar = None; comilla = False
    while i < n:
        c = sql[i]
        if dolar:
            if sql.startswith(dolar, i):
                cur.append(dolar); i += len(dolar); dolar = None; continue
            cur.append(c); i += 1; continue
        if comilla:
            cur.append(c); i += 1
            if c == "'":
                if i < n and sql[i] == "'": cur.append("'"); i += 1
                else: comilla = False
            continue
        if sql.startswith('--', i):
            j = sql.find('\n', i); j = n if j < 0 else j
            cur.append(sql[i:j]); i = j; continue
        m = re.match(r'\$[A-Za-z_]*\$', sql[i:])
        if m: dolar = m.group(0); cur.append(dolar); i += len(dolar); continue
        if c == "'": comilla = True; cur.append(c); i += 1; continue
        if c == ';':
            cur.append(c); out.append(''.join(cur)); cur = []; i += 1; continue
        cur.append(c); i += 1
    resto = ''.join(cur)
    if resto.strip(): out.append(resto)
    return out
def codigo(st):
    """La sentencia sin comentarios, para clasificarla."""
    return '\n'.join(l for l in st.split('\n') if not l.strip().startswith('--')).strip()

DATOS = re.compile(r'^\s*(insert\s+into|update|delete\s+from)\s+public\.', re.I)
DML_DENTRO = re.compile(r'(insert\s+into|update|delete\s+from)\s+public\.', re.I)
salida, quitadas = [], []
for f in sorted(glob.glob(str(RAIZ / 'migrations' / '*.sql'))):
    nombre = f.split('/')[-1]
    trozos = []
    for st in trocear(open(f, encoding='utf-8').read()):
        c = codigo(st)
        cl = c.lower()
        if not c:
            continue
        quitar = (DATOS.match(c) or cl.startswith('select ') or cl.startswith('with ')
                  or (cl.startswith('do ') and DML_DENTRO.search(cl)))
        if quitar:
            quitadas.append((nombre, ' '.join(c.split())[:90]))
            continue
        trozos.append(c)
    if trozos:
        salida.append(f'-- ---------------------------------------------------------------------\n-- Migración {nombre[:4]}\n-- ---------------------------------------------------------------------\n' + '\n\n'.join(trozos))
texto = '\n\n'.join(salida) + '\n'
for viejo, nuevo in CAMBIOS.items():
    texto = texto.replace(viejo, nuevo)
open(RAIZ / 'sencilla' / 'esquema.sql', 'w', encoding='utf-8').write(CABECERA + texto)
print(f'esquema.sql generado: {len(salida)} migraciones, {len(quitadas)} sentencias de datos quitadas')
