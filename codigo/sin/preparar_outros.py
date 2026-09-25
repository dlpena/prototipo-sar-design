# -*- coding: utf-8 -*-
"""Bloco "outros" de dados_sin.json: módulo Outros Sistemas Hídricos (Diego, 18/09/2026; estrutura/outros_sistemas.md).

Entradas: ../dados/sabesp_cantareira.json (coleta_sabesp_cantareira.py, API da SABESP para a ANA) e
../dados/outros_coletor.json (coleta_outros_coletor.py, Coletor do SAR para DF e RMBH).

Cantareira pela Resolução Conjunta ANA/DAEE nº 925/2017: sistema = Jaguari-Jacareí, Cachoeira, Atibainha e Paiva
Castro; volume útil 981,56 hm³ (Art. 1º § 1º); % do sistema = soma dos volumes operacionais dos quatro ÷ 981,56.
Águas Claras fica fora (Diego). Série do % desde que os quatro têm dado; detalhe diário dos últimos anos.
Rodar depois de preparar_serie_ne.py e antes de montar.py.
"""
import json
from datetime import date, timedelta
from pathlib import Path

AQUI = Path(__file__).parent
DADOS = AQUI.parent / "dados"
SIN = json.loads((AQUI / "dados_sin.json").read_text(encoding="utf-8"))
SAB = json.loads((DADOS / "sabesp_cantareira.json").read_text(encoding="utf-8"))
COL = json.loads((DADOS / "outros_coletor.json").read_text(encoding="utf-8"))
C = SAB["componentes"]

VU = 981.56
RES = [("JaguariJacarei", 29001, "Jaguari-Jacareí", 808.04), ("Cachoeira", 29002, "Cachoeira", 69.65),
       ("Atibainha", 29003, "Atibainha", 96.26), ("PaivaCastro", 29004, "Paiva Castro", 7.61)]
assert abs(sum(r[3] for r in RES) - VU) < 1e-9
ANOS_DETALHE = 6          # 5 anos de "Ao longo do ano" + margem para 12 meses antes da data mais antiga


def tab(comp):
    c = C[comp]
    return {l[0]: dict(zip(c["campos"], l[1:])) for l in c["linhas"]}


R = {k: tab(k) for k, *_ in RES}
S = tab("Cantareira")
V = {k: {d: v.get("Vazao_m3s") for d, v in tab(k).items()} for k in ("ESI", "T5", "T6", "T7", "TransfParaibaDoSul")}
P = {k: tab(k) for k in ("PostoAtibaiaValinhos", "PostoAtibaiaAtibaia", "PostoJaguariBuenopolis")}

dias = sorted(set.intersection(*[set(d for d, v in R[k].items() if v.get("VolumeOperacional_hm3") is not None) for k in R]))
d_ini, d_fim = dias[0], dias[-1]
todos = [(date.fromisoformat(d_ini) + timedelta(n)).isoformat() for n in range((date.fromisoformat(d_fim) - date.fromisoformat(d_ini)).days + 1)]


def r2(v, n=2):
    return None if v is None else round(v, n)


# % do sistema pela resolução, série completa
pct = []
for d in todos:
    if all(d in R[k] and R[k][d].get("VolumeOperacional_hm3") is not None for k in R):
        pct.append(r2(sum(R[k][d]["VolumeOperacional_hm3"] for k in R) / VU * 100))
    else:
        pct.append(None)
dif = [pct[i] - S[d]["VolumePorcentagem"] for i, d in enumerate(todos) if pct[i] is not None and d in S and d >= "2017-06-01"]
print(f"Cantareira: % pela resolução {d_ini} a {d_fim}; diferença para o % da SABESP desde jun/2017: {min(dif):+.3f} a {max(dif):+.3f} p.p.")

# detalhe diário dos últimos anos
det0 = date(int(d_fim[:4]) - ANOS_DETALHE, 1, 1).isoformat()
det = [d for d in todos if d >= det0]
res = []
for k, cod, nome, cap in RES:
    s = R[k]
    g = lambda campo, n=2: [r2(s.get(d, {}).get(campo), n) for d in det]
    res.append({"k": k, "codigo": cod, "nome": nome, "vu": cap, "cota": g("Nivel_m"), "vol": g("VolumeOperacional_hm3"),
                "pct": g("VolumePorcentagem"), "qnat": g("QNat_m3s"), "qjus": g("QJus_m3s")})
vaz = {k: [r2(V[k].get(d)) for d in det] for k in V}
vaz["chuva"] = [r2(S.get(d, {}).get("Precipitacao"), 1) for d in det]
vaz["qnat"] = [r2(S.get(d, {}).get("VazaoNatural")) for d in det]
vaz["jus"] = [r2(S.get(d, {}).get("VazaoJusante")) for d in det]

# médias de longo termo por mês (a API repete o valor do mês em cada dia); confere se mudam entre anos
mlt = {"pmlt": {}, "qmlt": {}}
for campo, chave in (("PMLTMensal", "pmlt"), ("QMLTMensal", "qmlt")):
    por_mes = {}
    for d in det:
        v = S.get(d, {}).get(campo)
        if v is not None:
            por_mes.setdefault(d[:7], set()).add(round(v, 3))
    mlt[chave] = {m: sorted(v)[-1] for m, v in por_mes.items()}
    variam = {m[5:]: sorted({mlt[chave][x] for x in mlt[chave] if x[5:] == m[5:]}) for m in mlt[chave]}
    print(campo, "por mês (valores distintos entre anos):", {m: v for m, v in sorted(variam.items()) if len(v) > 1} or "iguais em todos os anos")

postos = []
for k, cod, nome, rio in (("PostoAtibaiaValinhos", "3D-007T", "Captação de Valinhos", "rio Atibaia"),
                          ("PostoAtibaiaAtibaia", "3E-063T", "Atibaia", "rio Atibaia"),
                          ("PostoJaguariBuenopolis", "3D-009T", "Buenópolis", "rio Jaguari")):
    postos.append({"k": k, "codigo": cod, "nome": nome, "rio": rio, "nome_sabesp": C[k]["nome"],
                   "q": [r2(P[k].get(d, {}).get("Vazao_m3s"), 3) for d in det]})

# DF e RMBH (Coletor): última leitura de cada reservatório, para os cartões da página geral
sis_out = {}
for sis, nome in (("df", "Distrito Federal"), ("rmbh", "Paraopeba")):
    lista = []
    for rid, r in COL["sistemas"][sis].items():
        ult = next((l for l in reversed(r["serie"]) if l[2] is not None or l[1] is not None), None)
        cap = r["capacidade"]
        lista.append({"codigo": int(rid), "nome": r["nome"], "capacidade": cap, "data": ult[0] if ult else None,
                      "cota": ult[1] if ult else None, "volume": ult[2] if ult else None,
                      "pct": r2(ult[2] / cap * 100, 1) if ult and ult[2] is not None and cap else None})
    sis_out[sis] = {"nome": nome, "res": lista}
    print(sis, [(x["nome"], x["data"], x["pct"]) for x in lista])

# séries longas por reservatório, para as fichas e as páginas de DF e RMBH, com a crítica do NE
# (estrutura/criterios_ne.md, item 6: cota com erro grosseiro, pico de um dia e degrau que volta). O valor descartado vira ausente; a contagem vai para a nota de fontes da ficha.
import sys  # noqa: E402
sys.path.insert(0, str(DADOS))
from critica_nivel import filtrar  # noqa: E402


def serie_criticada(dias_s, cota, pct):
    cm = [round(c * 100) if c is not None else 0 for c in cota]
    _, fc = filtrar(dias_s, cm)
    fc = [(i, r) for i, r in fc if r != "cota não informada"]
    # volume: sai no mesmo dia da cota descartada. A regra de 5 p.p. do NE não serve para reservatório operado dia a
    # dia: em Paiva Castro (7,61 hm³) ela descartava 2.553 volumes que são a operação normal (18/09/2026)
    fv = [(i, r) for i, r in fc if pct[i] is not None]
    cota = cota[:]; pct = pct[:]
    for i, _ in fc: cota[i] = None
    for i, _ in fv: pct[i] = None
    return cota, pct, len(fc), len(fv)


fichas = {}
for k, cod, nome, cap in RES:
    ds = sorted(d for d, v in R[k].items() if v.get("VolumeOperacional_hm3") is not None or v.get("Nivel_m") is not None)
    ds_all = [(date.fromisoformat(ds[0]) + timedelta(n)).isoformat() for n in range((date.fromisoformat(d_fim) - date.fromisoformat(ds[0])).days + 1)]
    cota = [R[k].get(d, {}).get("Nivel_m") for d in ds_all]
    pct_r = [R[k].get(d, {}).get("VolumePorcentagem") for d in ds_all]
    cota, pct_r, nc, nv = serie_criticada(ds_all, cota, pct_r)
    fichas[str(cod)] = {"sis": "cantareira", "k": k, "nome": nome, "cap": cap, "de": ds_all[0], "cota": [r2(c) for c in cota],
                        "pct": [r2(v) for v in pct_r], "desc": [nc, nv]}
    print(f"ficha {cod} {nome}: {ds_all[0]} a {ds_all[-1]}, descartes cota {nc}, volume {nv}")
for sis in ("df", "rmbh"):
    for rid, r in COL["sistemas"][sis].items():
        S2 = {l[0]: l for l in r["serie"]}
        ds = sorted(S2)
        ds_all = [(date.fromisoformat(ds[0]) + timedelta(n)).isoformat() for n in range((date.fromisoformat(ds[-1]) - date.fromisoformat(ds[0])).days + 1)]
        cap = r["capacidade"]
        cota = [S2[d][1] if d in S2 else None for d in ds_all]
        pct_r = [S2[d][2] / cap * 100 if d in S2 and S2[d][2] is not None and cap else None for d in ds_all]
        cota, pct_r, nc, nv = serie_criticada(ds_all, cota, pct_r)
        fichas[rid] = {"sis": sis, "nome": r["nome"], "cap": cap, "de": ds_all[0], "cota": [r2(c) for c in cota],
                       "pct": [r2(v) for v in pct_r] if cap else None, "desc": [nc, nv]}
        print(f"ficha {rid} {r['nome']}: {ds_all[0]} a {ds_all[-1]}, descartes cota {nc}, volume {nv}")

SIN["outros"] = {
    "cantareira": {"vu": VU, "de": d_ini, "ate": d_fim, "pct": pct, "det_de": det0, "res": res, "vaz": vaz,
                   "mlt": mlt, "postos": postos},
    "sistemas": sis_out,
    "fichas": fichas,
    "fontes": {"sabesp": SAB["meta"]["fonte"], "coletor": COL["fonte"],
               "resolucao": "Resolução Conjunta ANA/DAEE nº 925, de 29/05/2017 (DOU 102, Seção 1, p. 92, de 30/05/2017), "
                            "texto em gov.br/ana, lido em 18/09/2026"},
}
(AQUI / "dados_sin.json").write_text(json.dumps(SIN, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print(f"outros: {len(pct)} dias no %, detalhe desde {det0} ({len(det)} dias); gravado")
