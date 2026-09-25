# -*- coding: utf-8 -*-
"""Prepara os dados do protótipo do SIN (página principal + bacia do Grande), já projetados para SVG.

Entradas (geradas antes em ../dados):
  mapa_sin.json         SAR retornaMedicoesSIN (17 bacias, último dia) + cadastro ONS + contornos IBGE/SNIRH projetados
  sin_diario.json       banco do SAR, série diária de 12 meses de cada usina (cota, afluente, defluente, volume útil)
  dados_mapa.json       sub-bacias DNAEE do SNIRH em lon/lat (para o recorte do Grande)
  equivalente_sin.json  SAR retornaVolumeEquivalenteSIN, 2022 a 2026
  dados_base.json       rios principais do SNIRH (opcional; o mapa funciona sem)
Regras das decisões (estrutura/decisoes.md): 22 bacias do ONS com o Paraná aberto; nada de agregado por bacia;
base diária (último dia fechado) em mapa, listas e tabela.
"""
import json
import math
import re
from pathlib import Path

import requests

AQUI = Path(__file__).parent
DADOS = AQUI.parent / "dados"
M = json.loads((DADOS / "mapa_sin.json").read_text(encoding="utf-8"))
G = json.loads((DADOS / "dados_mapa.json").read_text(encoding="utf-8"))
E = json.loads((DADOS / "equivalente_sin.json").read_text(encoding="utf-8"))
# a API devolve 0,0 para datas ainda sem carga (ex.: o dia corrente): fica só até o último dia fechado
E["serie"] = {k: v for k, v in E["serie"].items() if k <= E["ultimo_dia"]}
RIOS = json.loads((DADOS / "rios_sin.json").read_text(encoding="utf-8"))["trechos"]
BASE_NE = json.loads((DADOS / "rios_base_snirh.json").read_text(encoding="utf-8"))["trechos"]

# nome de exibição das 22 bacias (ONS com Paraná aberto)
NOME = {"GRANDE": "Grande", "PARANAIBA": "Paranaíba", "TIETE": "Tietê", "PARANAPANEMA": "Paranapanema", "IGUACU": "Iguaçu",
        "PARANA": "Paraná", "Amazonas": "Amazonas", "Araguari": "Araguari", "Capivari": "Capivari", "Doce": "Doce",
        "Itabapoana": "Itabapoana", "Itajaí": "Itajaí", "Jacuí": "Jacuí", "Jequitinhonha": "Jequitinhonha", "Mucuri": "Mucuri",
        "Paraguai": "Paraguai", "Paraguaçu": "Paraguaçu", "Paraíba do Sul": "Paraíba do Sul", "Parnaíba": "Parnaíba",
        "São Francisco": "São Francisco", "Tocantins": "Tocantins", "Uruguai": "Uruguai"}
# reservatórios do "Paraná" do SAR que o cadastro do ONS não traz: bacia pelos diagramas esquemáticos do SAR
EXTRA = {"PONTE NOVA": "TIETE", "GUARAPIRANGA": "TIETE", "BILLINGS": "TIETE", "EDGARD SOUZA": "TIETE", "JORDÃO": "IGUACU"}
SUB_PARANA = {60: "PARANAIBA", 61: "GRANDE", 62: "TIETE", 63: "PARANA", 64: "PARANAPANEMA", 65: "IGUACU"}


def bacia22(r):
    if r["bacia_sar"] != "Paraná":
        return r["bacia_sar"]
    return r["bacia_ons"] if r["bacia_ons"] else EXTRA[r["nome"]]


res = []
for i, r in enumerate(M["reservatorios"]):
    b = bacia22(r)
    res.append({"nome": r["nome"], "bacia": b, "ordem": i, "tipo": "fio" if r["tipo"] == "FIO DAGUA" else ("res" if r["tipo"] else "sem"),
                "vu": r["vu"], "cota": r["cota"], "afl": r["afl"], "defl": r["defl"], "lat": r["lat"], "lon": r["lon"],
                "x": r.get("x"), "y": r.get("y")})
assert all(x["bacia"] in NOME for x in res), {x["bacia"] for x in res} - set(NOME)
# série diária de 12 meses de cada usina (coleta_sin_diario.py, banco do SAR), para os mapas seguirem a data de
# referência; o valor do último dia vem dela também, uma fonte só (a API do portal, lida um dia antes, tinha vazões
# ainda provisórias: 44 de 558 valores revistos depois, conferência na própria coleta)
SDS = json.loads((DADOS / "sin_diario.json").read_text(encoding="utf-8"))
assert SDS["ate"] == M["data"], (SDS["ate"], M["data"])
sin_diario = {"de": SDS["de"], "ate": SDS["ate"], "fonte": SDS["fonte"], "usinas": {}}
for x in res:
    u = SDS["usinas"][x["nome"]]
    sin_diario["usinas"][x["nome"]] = {k: u[k] for k in ("cota", "afl", "defl", "vu")}
    x.update({k: u[k][-1] for k in ("cota", "afl", "defl", "vu")})
cont = {}
for x in res:
    cont[x["bacia"]] = cont.get(x["bacia"], 0) + 1
print("bacias:", len(cont), cont)

# contornos do SIN: sub-bacias DNAEE atribuídas às 22 bacias
subs = []
for s in M["sin"]["sub"]:
    dono = s["bacia_sar"]
    if dono == "Paraná":
        dono = SUB_PARANA.get(s["cod"])
    subs.append({"cod": s["cod"], "nome": s["nome"], "bacia": dono, "d": s["d"]})

# contornos unidos por bacia (22) e silhueta do Brasil, na mesma projeção do mapa do SIN (coleta_mapa.py)
from shapely.geometry import Polygon
from shapely.ops import unary_union

W0, H0, PAD = M["sin"]["w"], M["sin"]["h"], 10
LON0, LON1, LAT0, LAT1 = -74.2, -34.6, -34.0, 5.4
k0 = math.cos(math.radians((LAT0 + LAT1) / 2))
s0 = min((W0 - 2 * PAD) / ((LON1 - LON0) * k0), (H0 - 2 * PAD) / (LAT1 - LAT0))
ox0 = PAD + ((W0 - 2 * PAD) - (LON1 - LON0) * k0 * s0) / 2; oy0 = PAD + ((H0 - 2 * PAD) - (LAT1 - LAT0) * s0) / 2
P0 = lambda lo, la: (round(ox0 + (lo - LON0) * k0 * s0, 1), round(oy0 + (LAT1 - la) * s0, 1))


def geom_para_caminho(g, proj):
    polys = [g] if g.geom_type == "Polygon" else list(g.geoms)
    out = []
    for p in polys:
        for anel in [p.exterior, *p.interiors]:
            pts = [proj(x, y) for x, y in anel.coords]
            if len(pts) > 2:
                out.append("M" + "L".join(f"{x:g} {y:g}" for x, y in pts) + "Z")
    return "".join(out)


dono_sub = {s["cod"]: s["bacia"] for s in subs}
por_bacia = {}
for f in G["subbacias"]:
    b = dono_sub.get(f["sub"])
    if not b:
        continue
    for a in f["aneis"]:
        if len(a) > 3:
            por_bacia.setdefault(b, []).append(Polygon(a).buffer(0))
# buffer de ida e volta fecha as frestas entre sub-bacias, que apareciam como riscos dentro da bacia
bacias_geo = []
for b, ps in por_bacia.items():
    g = unary_union(ps).buffer(0.03).buffer(-0.03)
    rp = g.representative_point()
    bacias_geo.append({"bacia": b, "d": geom_para_caminho(g.simplify(0.01), P0), "rot": P0(rp.x, rp.y), "area": round(g.area, 2)})
brasil = unary_union([Polygon(a).buffer(0) for f in G["subbacias"] for a in f["aneis"] if len(a) > 3]).buffer(0.05).buffer(-0.05).simplify(0.02)
brasil_d = geom_para_caminho(brasil, P0)
print("contornos de bacia:", len(bacias_geo))

def anel_lonlat(g):
    polys = [g] if g.geom_type == "Polygon" else list(g.geoms)
    return [[[round(x, 3), round(y, 3)] for x, y in p.exterior.coords] for p in polys if p.area > 0.02]


geo_bacias = [{"bacia": b, "aneis": anel_lonlat(unary_union(ps).buffer(0.03).buffer(-0.03).simplify(0.02))} for b, ps in por_bacia.items()]
uf_raw = requests.get("https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR",
                      params={"formato": "application/vnd.geo+json", "qualidade": "minima", "intrarregiao": "UF"}, timeout=120).json()
SIGLA = {"11": "RO", "12": "AC", "13": "AM", "14": "RR", "15": "PA", "16": "AP", "17": "TO", "21": "MA", "22": "PI", "23": "CE", "24": "RN",
         "25": "PB", "26": "PE", "27": "AL", "28": "SE", "29": "BA", "31": "MG", "32": "ES", "33": "RJ", "35": "SP", "41": "PR", "42": "SC",
         "43": "RS", "50": "MS", "51": "MT", "52": "GO", "53": "DF"}
from shapely.geometry import shape, Point
geo_ufs, uf_polys = [], []
for f in uf_raw["features"]:
    sig = SIGLA.get(f["properties"]["codarea"])
    gg = shape(f["geometry"]).buffer(0)
    uf_polys.append((sig, gg))
    geo_ufs.append({"uf": sig, "aneis": anel_lonlat(gg.simplify(0.02))})
for x in res:
    x["uf"] = None
    if x["lon"] is not None:
        pt = Point(x["lon"], x["lat"])
        x["uf"] = next((s for s, gg in uf_polys if gg.contains(pt)), None)
print("sem UF:", [x["nome"] for x in res if x["lon"] is not None and not x["uf"]])
# estados projetados no quadro do mapa do SIN (miniaturas da página inicial)
ufs_sin = [{"uf": s, "d": geom_para_caminho(gg.simplify(0.03), P0)} for s, gg in uf_polys]

# página inicial: textos do SAR atual, resumo do NE, Cantareira e lista para a busca (coleta_inicio.py, textos_sar.json)
INI = json.loads((DADOS / "dados_inicio.json").read_text(encoding="utf-8"))
TXT = json.loads((DADOS / "textos_sar.json").read_text(encoding="utf-8"))
_lim = lambda s: re.sub(r"\s+([,;.)])", lambda m: m.group(1), re.sub(r"\(\s+", "(", re.sub(r"\s+", " ", s))).strip()
# pontos de todos os módulos (SNIRH IG/SAR) projetados no quadro do SIN; enriquecem a busca com código, estado e município
PTS = json.loads((DADOS / "pontos_sar.json").read_text(encoding="utf-8"))
import unicodedata
_norm = lambda s: re.sub(r"[^A-Z0-9]", "", unicodedata.normalize("NFKD", str(s).upper()).encode("ascii", "ignore").decode())
pontos_ini = []
for q in PTS["pontos"]:
    x, y = P0(q["lon"], q["lat"])
    pontos_ini.append({"m": q["modulo"], "x": x, "y": y})
_sin_pts = {_norm(q["nome"]): q for q in PTS["pontos"] if q["modulo"] == "SIN"}
_por_cod = {q["codigo"]: q for q in PTS["pontos"]}
for x in res:
    q = _sin_pts.get(_norm(x["nome"]))
    x["codigo"] = q["codigo"] if q else None
    x["estado"] = q["estado"] if q else None
    x["municipio"] = q["municipio"] if q else None
print("SIN sem código no SNIRH:", [x["nome"] for x in res if x["codigo"] is None])
for r in INI["ne_lista"]:
    q = _por_cod.get(r["codigo"])
    r["municipio"] = q["municipio"] if q else None
inicio = {"data": INI["data"], "textos": {k: [_lim(x) for x in v["paragrafos"]] for k, v in TXT.items()}, "textos_url": {k: v["url"] for k, v in TXT.items()},
          "ne": {"estados": [e for e in INI["ne_estados"] if e["estado"] != "Nordeste"], "total": next(e for e in INI["ne_estados"] if e["estado"] == "Nordeste"), "fonte": INI["fonte_ne"]},
          "pontos": pontos_ini, "fonte_pontos": PTS["fonte"],
          "ne_lista": [{**r, "nome": re.sub(r"\s*\([A-Za-z]{2}\)\s*$", "", re.sub(r"\s+", " ", r["nome"])).strip()} for r in INI["ne_lista"]], "cantareira": INI["cantareira"], "fonte_cantareira": INI["fonte_cantareira"]}

# ---------------------------------------------------------------- recorte da bacia do Grande (lon/lat -> px)
sub61 = next(f for f in G["subbacias"] if f["sub"] == 61)
lons = [x for a in sub61["aneis"] for x, _ in a]; lats = [y for a in sub61["aneis"] for _, y in a]
lon0, lon1, lat0, lat1 = min(lons) - 0.6, max(lons) + 0.6, min(lats) - 0.5, max(lats) + 0.5
W2, H2 = 760, 460
k = math.cos(math.radians((lat0 + lat1) / 2))
s = min((W2 - 20) / ((lon1 - lon0) * k), (H2 - 20) / (lat1 - lat0))
ox = 10 + ((W2 - 20) - (lon1 - lon0) * k * s) / 2; oy = 10 + ((H2 - 20) - (lat1 - lat0) * s) / 2
P = lambda lo, la: (round(ox + (lo - lon0) * k * s, 1), round(oy + (lat1 - la) * s, 1))


def caminho(aneis):
    out = []
    for a in aneis:
        pts = [P(x, y) for x, y in a]
        if len(pts) > 2:
            out.append("M" + "L".join(f"{x:g} {y:g}" for x, y in pts) + "Z")
    return "".join(out)


vizinhas = [{"cod": f["sub"], "nome": f["nome"], "d": caminho(f["aneis"])} for f in G["subbacias"]
            if any(lon0 - 3 < x < lon1 + 3 and lat0 - 3 < y < lat1 + 3 for a in f["aneis"] for x, y in a[::5])]
uf = requests.get("https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR",
                  params={"formato": "application/vnd.geo+json", "qualidade": "minima", "intrarregiao": "UF"}, timeout=120).json()
SIG = {"11": "RO", "12": "AC", "13": "AM", "14": "RR", "15": "PA", "16": "AP", "17": "TO", "21": "MA", "22": "PI", "23": "CE", "24": "RN",
       "25": "PB", "26": "PE", "27": "AL", "28": "SE", "29": "BA", "31": "MG", "32": "ES", "33": "RJ", "35": "SP", "41": "PR", "42": "SC",
       "43": "RS", "50": "MS", "51": "MT", "52": "GO", "53": "DF"}
ufs_g = []
for f in uf["features"]:
    g = f["geometry"]
    aneis = g["coordinates"] if g["type"] == "Polygon" else [a for p in g["coordinates"] for a in p]
    xs = [x for a in aneis for x, _ in a]; ys = [y for a in aneis for _, y in a]
    if max(xs) < lon0 or min(xs) > lon1 or max(ys) < lat0 or min(ys) > lat1:
        continue
    # rótulo no centro da parte visível
    vis = [(x, y) for a in aneis for x, y in a if lon0 < x < lon1 and lat0 < y < lat1]
    cx = sum(x for x, _ in vis) / len(vis) if vis else None; cy = sum(y for _, y in vis) / len(vis) if vis else None
    ufs_g.append({"uf": SIG.get(f["properties"]["codarea"]), "d": caminho(aneis), "rot": P(cx, cy) if vis else None})
grande = []
for x in res:
    if x["bacia"] == "GRANDE":
        gx, gy = P(x["lon"], x["lat"]) if x["lon"] is not None else (None, None)
        grande.append({**x, "gx": gx, "gy": gy})
# rios: SIN (simplificado) e recorte do Grande
from shapely.geometry import LineString

def linha_para_caminho(pts, proj):
    return "M" + "L".join(f"{x:g} {y:g}" for x, y in (proj(a, b) for a, b in pts))

bacia_de_rio = {}
for r in res:
    pass
# hidrografia: base Natural Earth + cursos dos rios com usina (SNIRH), numa camada só, recortada às bacias do SIN
poligono_bacia = {b: unary_union(ps).buffer(0.03).buffer(-0.03) for b, ps in por_bacia.items()}
sub61_poly = Polygon(max(sub61["aneis"], key=len)).buffer(0)
NE = json.loads((DADOS / "rios_base_ne.json").read_text(encoding="utf-8"))["trechos"]
foz = []
for tr in NE:
    if "amazon" in (tr["nome"] or "").lower():
        pts = [(x, y) for x, y in tr["linha"] if x > -51.5]
        if len(pts) > 1:
            foz.append(LineString(pts))
todas_linhas = [LineString(tr["linha"]) for tr in BASE_NE] + [LineString(tr["linha"]) for tr in RIOS] + foz
linhas_unidas = todas_linhas  # cada trecho recortado por si: sem linemerge, que fragmentava nos cruzamentos


def pedacos(g):
    if g.is_empty:
        return []
    if g.geom_type == "LineString":
        return [g]
    return [x for x in g.geoms if x.geom_type == "LineString"]


rios_sin = []
for b, poly in poligono_bacia.items():
    for ln in linhas_unidas:
        if not ln.intersects(poly):
            continue
        for pc in pedacos(ln.intersection(poly)):
            pc = pc.simplify(0.015)
            if pc.length >= 0.01:
                rios_sin.append({"bacia": b, "d": linha_para_caminho(list(pc.coords), P0)})
from collections import defaultdict as _dd
_por = _dd(list)
for r in rios_sin:
    _por[r["bacia"]].append(r["d"])
rios_sin = [{"bacia": b, "d": "".join(ds)} for b, ds in _por.items()]
rios_g, rios_g_geo = [], []
for ln in linhas_unidas:
    if ln.intersects(sub61_poly):
        for pc in pedacos(ln.intersection(sub61_poly)):
            if pc.length >= 0.005:
                rios_g.append({"d": linha_para_caminho(list(pc.coords), P)})
                rios_g_geo.append([[round(x, 4), round(y, 4)] for x, y in pc.simplify(0.002).coords])
rios_g = [{"d": "".join(r["d"] for r in rios_g)}] if rios_g else []
base_g = []

# série diária do sar0 (coleta_grande.py): turbinada e vertida do dia + últimos 30 dias fechados para o minigráfico da tabela
SG = json.loads((DADOS / "serie_grande.json").read_text(encoding="utf-8"))
COL = SG["colunas"]  # data, cota, afl, defl, vert, turb, nat, vu
for x in grande:
    ser = [l for l in SG["usinas"][x["nome"]]["serie"] if l[0] <= M["data"]]
    dia = ser[-1]
    assert dia[0] == M["data"], (x["nome"], dia[0])
    x["turb"], x["vert"] = dia[COL.index("turb")], dia[COL.index("vert")]
    x["serie"] = [{"data": l[0], "afl": l[2], "defl": l[3], "vert": l[4], "turb": l[5], "cota": l[1], "vu": l[7]} for l in ser]

# ficha de exemplo: Furnas. Diário do sar0 desde 2000 (coleta.py) e horário do ONS jul-set/2026 (coleta_ficha.py)
PROTO = json.loads((DADOS / "dados_prototipo.json").read_text(encoding="utf-8"))
HF = json.loads((DADOS / "horario_furnas.json").read_text(encoding="utf-8"))
_fur = next(r for r in PROTO["reservatorios"] if r["nome"] == "FURNAS")
# topologia da bacia do Grande como o cadastro do novo SAR a guardaria (Anexo I, 3.3, diagrama da cascata), de onde o
# diagrama da página e a prévia da inclusão são desenhados:
# - usinas: rio (cadastro do ONS, nom_rio) e usina imediatamente a jusante (ordem do SAR, de montante para jusante);
# - rios: rio em que deságua, primeira usina a jusante da confluência nele (None = abaixo da última usina desse rio) e
#   ordem entre as confluências do mesmo trecho (1 = a mais a jusante). A do Pardo vem do diagrama esquemático do SAR
#   atual: entra no Grande entre Porto Colômbia e Marimbondo.
RIO_ONS = {r["nome"]: "rio " + str(r.get("rio")).title() for r in PROTO["reservatorios"]}
topo_rios = {"rio Grande": {"desagua": None, "jusante": None, "ordem": 1},
             "rio Pardo": {"desagua": "rio Grande", "jusante": "MARIMBONDO", "ordem": 1,
                           "fonte": "diagrama esquemático da bacia do Grande no SAR atual"}}


def _jus_fim(rio):  # primeira usina a jusante do fim de um rio
    x = topo_rios[rio]
    return x["jusante"] if x["jusante"] or not x["desagua"] else _jus_fim(x["desagua"])


_g = sorted(grande, key=lambda r: r["ordem"])
assert all(RIO_ONS[r["nome"]] in topo_rios for r in _g), "rio sem cadastro na topologia"
topologia_g = {"foz": "rio Paraná", "rios": topo_rios, "usinas": [
    {"id": r["nome"], "rio": RIO_ONS[r["nome"]],
     "jusante": next((q["nome"] for q in _g if q["ordem"] > r["ordem"] and RIO_ONS[q["nome"]] == RIO_ONS[r["nome"]]), None) or _jus_fim(RIO_ONS[r["nome"]])}
    for r in _g]}
_res = next(r for r in res if r["nome"] == "FURNAS")
ficha = {"nome": "FURNAS", "codigo": PROTO["furnas"]["codigo"], "rio": _fur["rio"].title(), "bacia": "GRANDE", "uf": _res["uf"], "lat": _fur["lat"], "lon": _fur["lon"],
         "tipo": "res", "entrada": _fur["entrada"],
         "diario_colunas": ["data", "cota", "afl", "defl", "vert", "turb", "nat", "vu"],
         "diario": [l for l in PROTO["furnas"]["diario"] if l[0] <= M["data"]],
         "horario_colunas": HF["colunas"], "horario": HF["serie"],
         "fontes": {"diario": f"SAR/ANA, Dados históricos SIN (sar0), Furnas {PROTO['furnas']['diario'][0][0]} a {M['data']}",
                    "horario": HF["fonte"]}}

# a chuva do MERGE (INPE) saiu da página da bacia em 24/09/2026 (decisão do Diego): as coletas ficam em ../dados, sem uso

# MLT mensal da vazão natural das usinas com ficha (coleta_vazao_natural_mlt.py): série de vazões médias mensais do
# ONS, 1931 a 2024, pelo posto de cada usina; o mês observado é a média da vazão natural diária da ficha
VN = json.loads((DADOS / "vazao_natural_mlt.json").read_text(encoding="utf-8"))
vazao_natural_mlt = {"fonte": VN["fonte"], "periodo": VN["periodo"],
                     "usinas": {k: {"posto": v["posto"], "mlt": v["mlt"], "min": v["min"], "max": v["max"]}
                                for k, v in VN["usinas"].items()}}

out = {"data": M["data"], "consulta": M["consulta"], "nome_bacia": NOME,
       "vazao_natural_mlt": vazao_natural_mlt,
       "sin": {"w": M["sin"]["w"], "h": M["sin"]["h"], "bacias": bacias_geo, "brasil": brasil_d, "rios": rios_sin, "ufs": ufs_sin},
       "inicio": inicio,
       "reservatorios": res, "sin_diario": sin_diario, "equivalente": E, "geo": {"bacias": geo_bacias, "ufs": geo_ufs, "rios_grande": rios_g_geo},
       "ficha": ficha,
       # fichas das demais usinas com resolução da ANA (coleta_fichas_sin.py), carregadas sob demanda de fichas/<codigo>.json
       "fichas_idx": [{k: x[k] for k in ("nome", "codigo", "bacia", "rio", "uf", "arquivo")} for x in json.loads((DADOS / "fichas_sin" / "indice.json").read_text(encoding="utf-8"))["fichas"]],
       "grande": {"w": W2, "h": H2, "sub": caminho(sub61["aneis"]), "vizinhas": vizinhas, "uf": ufs_g, "rios": rios_g, "res": grande, "topologia": topologia_g},
       "fontes": {
           "medicoes": f"SAR/ANA, banco do SAR (medições diárias das usinas do SIN), {SDS['de'][8:]}/{SDS['de'][5:7]}/{SDS['de'][:4]} a {M['data'][8:]}/{M['data'][5:7]}/{M['data'][:4]}, consulta {SDS['consulta'][:10]}",
           "equivalente": E["fonte"],
           "cadastro": "ONS Dados Abertos, cadastro de reservatórios (RESERVATORIOS.csv): tipo e coordenadas",
           "contornos": "SNIRH/ANA, sub-bacias DNAEE; IBGE, malha de UFs",
           "sar0": f"SAR/ANA, Dados históricos SIN (sar0), turbinada e vertida e série de 30 dias das usinas do Grande, consulta {SG['consulta'][:10]}",
           "rios": "SNIRH/ANA, Cursos d'Água (SNIRH2016), rios do cadastro ONS perto dos reservatórios; base: SNIRH >= 3.000 km²"}}
(AQUI / "dados_sin.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print("Grande:", len(grande), "reservatórios;", len(rios_g), "trechos de rio; SIN:", len(rios_sin), "trechos;", "KB", round((AQUI / "dados_sin.json").stat().st_size / 1024))
