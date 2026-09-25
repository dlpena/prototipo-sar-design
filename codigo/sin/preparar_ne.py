# -*- coding: utf-8 -*-
"""Monta o bloco do módulo Nordeste e Semiárido dentro de dados_sin.json (chave "ne").

Entradas: ../dados/dados_ne.json (coleta_ne.py) e dados_sin.json (contornos de UF em lon/lat).
Regras das decisões (estrutura/decisoes.md, 17/09/2026): níveis NE > Estado > Reservatório; faixas do mapa de julho
(restrição < 20%, atenção 20 a 50%, normal > 50%); sem informação = sem medição há mais de 30 dias, fora do agregado.
"""
import json
import math
import sys
from datetime import date, timedelta
from pathlib import Path

AQUI = Path(__file__).parent
DADOS = AQUI.parent / "dados"
sys.path.insert(0, str(DADOS))
from critica_nivel import filtrar, filtrar_volume  # noqa: E402
NE = json.loads((DADOS / "dados_ne.json").read_text(encoding="utf-8"))
DT = json.loads((DADOS / "datas_ne.json").read_text(encoding="utf-8"))
HIST = json.loads((DADOS / "hist_ne.json").read_text(encoding="utf-8"))
SIN = json.loads((AQUI / "dados_sin.json").read_text(encoding="utf-8"))

UFS_NE = ["AL", "BA", "CE", "MA", "MG", "PB", "PE", "PI", "RN", "SE"]
LIMIAR_DIAS = 30          # acima disso: sem informação (Diego, 17/09/2026)
# restrição vai de -∞ (não de 0) a 20%: volume negativo é restrição, como em faixaPct (js/regras.js); corrigido em 22/09/2026
FAIXAS = [("restricao", "Restrição", -1e9, 20, "#C00000"), ("atencao", "Atenção", 20, 50, "#F2C80F"),
          ("normal", "Normal", 50, 1e9, "#107C10")]


def faixa(pct):
    if pct is None:
        return "sem"
    for k, _r, a, b, _c in FAIXAS:
        if a <= pct < b:
            return k
    return "normal"


# ---------------------------------------------------------------- reservatórios com faixa e situação de atualização
# A lista de medições do portal devolve 545 linhas, com CRISTALÂNDIA (BA) repetida quatro vezes: duas em Brumado e
# duas em Ituaçu, com capacidade, volume e data idênticos, e o mesmo código 12541 no cadastro do SAR legado.
# Linha exatamente repetida (estado, nome, município e capacidade) é descartada, e o descarte é declarado na página.
# A chave "ch" guarda a ocorrência do nome no estado, como na coleta por data (há homônimos: BOA VISTA/PE em
# Salgueiro e Itapetim, BREJINHO/PB em Juarez Távora e Triunfo).
res, vistos, repetidas = [], set(), []
vezes = {}
for r in NE["reservatorios"]:
    k = (r["uf"], r["nome"])
    vezes[k] = vezes.get(k, 0) + 1
    ch = f"{r['uf']}|{r['nome']}|{vezes[k]}"
    assinatura = (r["uf"], r["nome"], r["municipio"], r["capacidade_hm3"])
    if assinatura in vistos:
        repetidas.append(ch)
        continue
    vistos.add(assinatura)
    velho = r["dias"] is None or r["dias"] > LIMIAR_DIAS or r["volume_hm3"] is None
    res.append({**r, "ch": ch, "i": len(res), "faixa": "sem" if velho else faixa(r["volume_pct"]), "sem_info": velho})
print("linhas da API:", len(NE["reservatorios"]), "| descartadas por repetição exata:", repetidas, "| ficam:", len(res))

# ---------------------------------------------------------------- resumo por estado: oficial + contagens próprias
oficial = {e["estado"]: e for e in NE["estados"]}
NOME = {"AL": "Alagoas", "BA": "Bahia", "CE": "Ceará", "MA": "Maranhão", "MG": "Minas Gerais", "PB": "Paraíba",
        "PE": "Pernambuco", "PI": "Piauí", "RN": "Rio Grande do Norte", "SE": "Sergipe"}
estados = []
for uf in UFS_NE:
    L = [r for r in res if r["uf"] == uf]
    com = [r for r in L if not r["sem_info"]]
    cap_com = sum(r["capacidade_hm3"] or 0 for r in com)
    vol_com = sum(r["volume_hm3"] or 0 for r in com)
    o = oficial.get(NOME[uf], {})
    estados.append({"uf": uf, "estado": NOME[uf], "n": len(L), "com_dado": len(com), "sem_info": len(L) - len(com),
                    "capacidade_hm3": round(sum(r["capacidade_hm3"] or 0 for r in L), 2),
                    "capacidade_com_dado_hm3": round(cap_com, 2), "volume_hm3": round(vol_com, 2),
                    "volume_pct": round(vol_com / cap_com * 100, 2) if cap_com else None,
                    "volume_pct_portal": o.get("volume_pct"), "volume_hm3_portal": o.get("volume_hm3"),
                    "faixas": {k: sum(1 for r in com if r["faixa"] == k) for k, *_ in FAIXAS},
                    "mesmo_dia": NE["mesmo_dia"].get(uf, {})})

tot = oficial.get("Nordeste", {})
com_all = [r for r in res if not r["sem_info"]]
cap_all = sum(r["capacidade_hm3"] or 0 for r in com_all)
vol_all = sum(r["volume_hm3"] or 0 for r in com_all)
total = {"n": len(res), "com_dado": len(com_all), "sem_info": len(res) - len(com_all),
         "capacidade_hm3": round(sum(r["capacidade_hm3"] or 0 for r in res), 2),
         "capacidade_com_dado_hm3": round(cap_all, 2), "volume_hm3": round(vol_all, 2),
         "volume_pct": round(vol_all / cap_all * 100, 2) if cap_all else None,
         "volume_pct_portal": tot.get("volume_pct"), "volume_hm3_portal": tot.get("volume_hm3"),
         "faixas": {k: sum(1 for r in com_all if r["faixa"] == k) for k, *_ in FAIXAS},
         "mesmo_dia": NE["mesmo_dia"].get("NE", {})}

# ---------------------------------------------------------------- datas de referência (seletor de data)
# Regra do portal, em "Entendendo o Mapa, a Tabela e o Gráfico" (lido em 17/09/2026): para a data de referência,
# cada reservatório entra com a medição de data mais próxima, até 30 dias antes ou depois; fora dessa janela fica
# sem informação e sai do volume acumulado, e a capacidade equivalente soma só as capacidades de quem entrou.
def resumo(L):
    com = [x for x in L if not x["sem"]]
    cap = sum(x["cap"] or 0 for x in com)
    vol = sum(x["hm3"] or 0 for x in com)
    return {"n": len(L), "com_dado": len(com), "sem_info": len(L) - len(com),
            "capacidade_hm3": round(sum(x["cap"] or 0 for x in L), 2), "capacidade_com_dado_hm3": round(cap, 2),
            "volume_hm3": round(vol, 2), "volume_pct": round(vol / cap * 100, 2) if cap else None,
            "faixas": {k: sum(1 for x in com if faixa(x["pct"]) == k) for k, *_ in FAIXAS}}


# A série de cada reservatório vem do SAR legado (coleta_ne_hist.py) e permite aplicar a regra a QUALQUER data
# no próprio navegador: nada de coletar uma data por vez (pedido do Diego, 17/09/2026).
DE = date.fromisoformat(HIST["de"])
hist, vezes_h = {}, {}
for h in HIST["reservatorios"]:
    k = (h["uf"], h["nome"])
    vezes_h[k] = vezes_h.get(k, 0) + 1
    hist[f"{h['uf']}|{h['nome']}|{vezes_h[k]}"] = h

sem_hist = []
critica_n = {"cota": 0, "volume": 0, "volume_nao_informado": 0}
for r in res:
    # o cadastro do legado tem duas CRISTALÂNDIA (mesmo código) e a lista de medições tem quatro: quando a
    # ocorrência não existe no legado, cai na primeira do mesmo nome e estado
    h = hist.get(r["ch"]) or next((x for x in HIST["reservatorios"] if x["uf"] == r["uf"] and x["nome"] == r["nome"]), None)
    if h is None:
        sem_hist.append(r["ch"])
        r["s"] = []
        continue
    r["codigo"] = h["codigo"]
    # crítica das leituras (estrutura/criterios_ne.md, item 6), com status separado para cota e volume: valor
    # descartado vira ausente. Linhas de h["serie"]: [data, capacidade, cota, volume hm³, volume %]
    ser = h["serie"]
    dias = [x[0] for x in ser]
    _, fora_c = filtrar(dias, [round(x[2] * 100) if x[2] else 0 for x in ser])
    _, fora_v = filtrar_volume(dias, [x[4] for x in ser], [x[2] for x in ser])
    sem_c, sem_v = {i for i, _ in fora_c}, {i for i, _ in fora_v}
    critica_n["cota"] += sum(1 for _, rg in fora_c if rg != "cota não informada")
    critica_n["volume"] += sum(1 for _, rg in fora_v if rg != "volume não informado")
    critica_n["volume_nao_informado"] += sum(1 for _, rg in fora_v if rg == "volume não informado")
    # [dia desde DE, volume %, volume hm³, cota m]; linha sem volume e sem cota não entra
    r["s"] = []
    for i, x in enumerate(ser):
        pct = None if i in sem_v or x[4] is None else round(x[4], 1)
        hm3 = None if i in sem_v or x[3] is None else round(x[3], 1)
        cota = None if i in sem_c else x[2]
        if pct is None and hm3 is None and cota is None:
            continue
        r["s"].append([(date.fromisoformat(x[0]) - DE).days, pct, hm3, cota])
print("sem série no legado:", sem_hist or "nenhum",
      "| medições embutidas:", sum(len(r["s"]) for r in res), "| crítica:", critica_n)


def na_data(r, ref):
    """Medição usada na data de referência: a mais próxima, até LIMIAR_DIAS antes ou depois (regra do portal)."""
    alvo = (ref - DE).days
    melhor = None
    for d, pct, hm3, _cota in r["s"]:
        if hm3 is None:
            continue
        dist = abs(d - alvo)
        if dist <= LIMIAR_DIAS and (melhor is None or dist < melhor[0]):
            melhor = (dist, d, pct, hm3)
    return melhor


# --------- conferência: o mesmo cálculo pela série contra o que o portal devolveu nas 25 datas coletadas
print("conferência da regra (série do legado x lista de medições do portal x agregado do portal):")
print("  data         próprio  portal   dif    com medição próprio/portal")
difs = []
for iso in DT["datas"]:
    ref = date.fromisoformat(iso)
    bruto = DT["por_data"][iso]
    aux = []
    for r in res:
        m = na_data(r, ref)
        aux.append({"uf": r["uf"], "pct": m[2] if m else None, "hm3": m[3] if m else None,
                    "cap": r["capacidade_hm3"], "sem": m is None})
    meu = resumo(aux)
    # o mesmo pela lista de medições do portal, para ver se a regra bate
    com_portal = 0
    for r in res:
        v = bruto["res"].get(r["ch"]) or [None, None, None, None]
        dias = (ref - date.fromisoformat(v[3])).days if v[3] else None
        if not (dias is None or abs(dias) > LIMIAR_DIAS or v[1] is None):
            com_portal += 1
    pt = next((e["volume_pct"] for e in bruto["estados_portal"] if e["estado"] == "Nordeste"), None)
    difs.append(abs(meu["volume_pct"] - pt) if (pt and meu["volume_pct"]) else None)
    print(f"  {iso}   {meu['volume_pct']:6.2f}  {pt:6.2f}  {meu['volume_pct']-pt:+5.2f}   "
          f"{meu['com_dado']:3d}/{com_portal:3d}")
validas = [d for d in difs if d is not None]
print(f"  diferença média para o agregado do portal: {sum(validas)/len(validas):.2f} p.p.; "
      f"máxima {max(validas):.2f} p.p.")

# valores do portal por data, só para citar na tela (o cálculo da página é sobre a série)
portal_por_data = {}
for iso in DT["datas"]:
    b = DT["por_data"][iso]
    portal_por_data[iso] = {"NE": next((e["volume_pct"] for e in b["estados_portal"] if e["estado"] == "Nordeste"), None),
                            **{uf: next((e["volume_pct"] for e in b["estados_portal"] if e["estado"] == NOME[uf]), None)
                               for uf in UFS_NE},
                            "mesmo_dia": b["mesmo_dia"]}

# ---------------------------------------------------------------- mapa dos estados (projeção própria do recorte NE)
geo = {g["uf"]: g["aneis"] for g in SIN["geo"]["ufs"] if g["uf"] in UFS_NE}
lons = [x for a in geo.values() for anel in a for x, _ in anel]
lats = [y for a in geo.values() for anel in a for _, y in anel]
LON0, LON1, LAT0, LAT1 = min(lons), max(lons), min(lats), max(lats)
W, H, PAD = 760, 720, 12
k = math.cos(math.radians((LAT0 + LAT1) / 2))
s = min((W - 2 * PAD) / ((LON1 - LON0) * k), (H - 2 * PAD) / (LAT1 - LAT0))
ox = PAD + ((W - 2 * PAD) - (LON1 - LON0) * k * s) / 2
oy = PAD + ((H - 2 * PAD) - (LAT1 - LAT0) * s) / 2
P = lambda lo, la: (round(ox + (lo - LON0) * k * s, 1), round(oy + (LAT1 - la) * s, 1))


def caminho(aneis):
    out = []
    for a in aneis:
        pts = [P(x, y) for x, y in a]
        if len(pts) > 2:
            out.append("M" + "L".join(f"{x:g} {y:g}" for x, y in pts) + "Z")
    return "".join(out)


# contorno do Semiárido (INSA) projetado no mesmo sistema do mapa dos estados
SEMI = json.loads((DADOS / "semiarido.json").read_text(encoding="utf-8"))
semi_aneis = [a for e in SEMI["estados"] if e["uf"] in UFS_NE for a in e["aneis"]]
semi_d = caminho(semi_aneis)
fora = [e["uf"] for e in SEMI["estados"] if e["uf"] not in UFS_NE]

# o mesmo contorno em lon/lat, com os pedaços de cada estado unidos, para a camada do mapa Leaflet (Diego, 18/09/2026)
from shapely.geometry import Polygon  # noqa: E402
from shapely.ops import unary_union  # noqa: E402
_uniao = unary_union([Polygon(a).buffer(0) for a in semi_aneis]).buffer(0.001, join_style=2).buffer(-0.001, join_style=2).simplify(0.008)
semi_geo = [[[round(x, 4), round(y, 4)] for x, y in g.exterior.coords]
            for g in (_uniao.geoms if hasattr(_uniao, "geoms") else [_uniao]) if g.area > 0.002]
print("semiárido unido:", len(semi_geo), "polígonos,", sum(len(a) for a in semi_geo), "pontos")
print("semiárido:", len(semi_aneis), "anéis nos estados do módulo;",
      sum(len(a) for a in semi_aneis), "pontos; fora do módulo:", fora or "nenhum")

def ponto_interno(anel, linhas=41):
    """Ponto dentro do polígono, no meio da maior corda horizontal (o "point on surface" dos SIG).

    A média dos vértices cai fora quando o polígono é recortado e concavo, como Minas Gerais no semiárido.
    """
    ys = [y for _, y in anel]
    y0, y1 = min(ys), max(ys)
    melhor = None
    for i in range(1, linhas):
        y = y0 + (y1 - y0) * i / linhas
        xs = []
        for j in range(len(anel)):
            xa, ya = anel[j]
            xb, yb = anel[(j + 1) % len(anel)]
            if (ya > y) != (yb > y):
                xs.append(xa + (y - ya) * (xb - xa) / (yb - ya))
        xs.sort()
        for k in range(0, len(xs) - 1, 2):       # pares de cruzamentos: trechos dentro do polígono
            larg = xs[k + 1] - xs[k]
            if melhor is None or larg > melhor[0]:
                melhor = (larg, (xs[k] + xs[k + 1]) / 2, y)
    if melhor is None:
        return sum(x for x, _ in anel) / len(anel), sum(ys) / len(ys)
    return melhor[1], melhor[2]


def ponto_rotulo(aneis_px, sigla, fonte=13.0, halo=3.0, passos=120):
    """Posição da sigla dentro do estado, em pixels do mapa (Diego, 18/09/2026: PB, AL e SE sobre a divisa).

    Polo de inacessibilidade na forma do rótulo: o ponto de dentro mais afastado da divisa, com o eixo x comprimido
    pela razão altura/largura da sigla (um rótulo largo precisa de folga maior dos lados que em cima e embaixo).
    Devolve a linha de base do texto: o SVG posiciona o texto pela base, e o centro das maiúsculas fica ~0,36 da
    fonte acima dela.
    """
    larg, alt = 0.72 * fonte * len(sigla) + 2 * halo, fonte + 2 * halo
    k = alt / larg
    arestas = [(anel[i - 1], anel[i]) for anel in aneis_px for i in range(len(anel))]

    def dentro(x, y):
        c = False
        for (xa, ya), (xb, yb) in arestas:
            if (ya > y) != (yb > y) and x < xa + (y - ya) * (xb - xa) / (yb - ya):
                c = not c
        return c

    def folga(x, y):
        m = 1e9
        for (xa, ya), (xb, yb) in arestas:
            ax, bx, px = xa * k, xb * k, x * k
            dx, dy = bx - ax, yb - ya
            s = max(0.0, min(1.0, ((px - ax) * dx + (y - ya) * dy) / (dx * dx + dy * dy or 1)))
            m = min(m, math.hypot(px - ax - s * dx, y - ya - s * dy))
        return m

    xs = [x for a in aneis_px for x, _ in a]
    ys = [y for a in aneis_px for _, y in a]
    passo = max(1.0, (max(xs) - min(xs)) / passos)
    melhor = (-1.0, None)
    y = min(ys)
    while y <= max(ys):
        x = min(xs)
        while x <= max(xs):
            if dentro(x, y):
                f = folga(x, y)
                if f > melhor[0]:
                    melhor = (f, (x, y))
            x += passo
        y += passo
    (cx, cy), f = melhor[1], melhor[0]
    assert f >= alt / 2, f"sigla {sigla} não cabe no estado: folga {f:.1f} px, precisa {alt / 2:.1f}"
    return round(cx, 1), round(cy + 0.36 * fonte, 1)


semi_por_uf = {e["uf"]: e["aneis"] for e in SEMI["estados"]}
mapa = []
for uf in UFS_NE:
    aneis = geo[uf]
    # Em Minas Gerais o módulo acompanha só o que está no semiárido: a área pintada é o recorte do INSA e o
    # restante do estado entra apenas como contorno (pedido do Diego, 17/09/2026).
    pintar = semi_por_uf[uf] if uf == "MG" else aneis
    maior = max(pintar, key=len)
    if uf == "MG":      # recorte do semiárido com a observação abaixo da sigla: posição já aprovada, pela maior corda
        cx, cy = ponto_interno(maior)
        rot = P(cx, cy)
    else:
        rot = ponto_rotulo([[P(lo, la) for lo, la in anel] for anel in pintar], uf)
    item = {"uf": uf, "d": caminho(pintar), "rot": rot}
    if uf == "MG":
        item["contorno"] = caminho(aneis)
        item["parcial"] = True
    mapa.append(item)

# recorte do Ceará: contorno próprio e reservatórios projetados
ce = geo["CE"]
lons_c = [x for a in ce for x, _ in a]; lats_c = [y for a in ce for _, y in a]
W2, H2, PAD2 = 760, 470, 14
LON0c, LON1c, LAT0c, LAT1c = min(lons_c), max(lons_c), min(lats_c), max(lats_c)
k2 = math.cos(math.radians((LAT0c + LAT1c) / 2))
s2 = min((W2 - 2 * PAD2) / ((LON1c - LON0c) * k2), (H2 - 2 * PAD2) / (LAT1c - LAT0c))
ox2 = PAD2 + ((W2 - 2 * PAD2) - (LON1c - LON0c) * k2 * s2) / 2
oy2 = PAD2 + ((H2 - 2 * PAD2) - (LAT1c - LAT0c) * s2) / 2
P2 = lambda lo, la: (round(ox2 + (lo - LON0c) * k2 * s2, 1), round(oy2 + (LAT1c - la) * s2, 1))
ce_d = "".join("M" + "L".join(f"{x:g} {y:g}" for x, y in [P2(a, b) for a, b in anel]) + "Z" for anel in ce if len(anel) > 2)
ce_res = []
for r in [x for x in res if x["uf"] == "CE"]:
    gx, gy = P2(r["lon"], r["lat"]) if r["lon"] is not None else (None, None)
    ce_res.append({**r, "gx": gx, "gy": gy})

contagens = {"api_linhas": len(NE["reservatorios"]), "descartadas": len(repetidas), "listados": len(res),
             "resumo_soma": sum(oficial[NOME[uf]]["reservatorios"] for uf in UFS_NE),
             "resumo_nordeste": oficial["Nordeste"]["reservatorios"]}
print("contagens:", contagens)

out = {"data": NE["data"], "limiar_dias": LIMIAR_DIAS, "passo_serie_dias": NE["passo_serie_dias"],
       "contagens": contagens,
       "serie_de": HIST["de"], "serie_ate": HIST["ate"],
       # antes de serie_min a janela de ±30 dias ficaria incompleta (a série embutida começa em serie_de)
       "serie_min": (DE + timedelta(days=LIMIAR_DIAS)).isoformat(),
       "datas": DT["datas"], "passo_datas": DT["passo_dias"], "portal_por_data": portal_por_data,
       "faixas": [{"k": k_, "rot": r_, "de": max(a_, 0), "ate": (None if b_ > 1e8 else b_), "cor": c_} for k_, r_, a_, b_, c_ in FAIXAS],
       "estados": estados, "total": total, "reservatorios": res,
       "mapa": {"w": W, "h": H, "ufs": mapa, "semiarido": semi_d, "semiarido_geo": semi_geo, "semiarido_fonte": SEMI["fonte"]},
       "ce": {"w": W2, "h": H2, "d": ce_d, "res": ce_res},
       "serie": NE["serie"], "fontes": {**NE["fontes"], "medicoes": HIST["fonte"],
                                        "resumo": DT["fontes"]["resumo"], "regra": DT["fontes"]["regra"],
                                        "lista": DT["fontes"]["medicoes"]}}

SIN["ne"] = out
(AQUI / "dados_sin.json").write_text(json.dumps(SIN, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print("NE:", total["n"], "reservatórios;", total["com_dado"], "com dado nos últimos", LIMIAR_DIAS, "dias;",
      total["sem_info"], "sem informação")
print("agregado próprio:", total["volume_pct"], "% | portal:", total["volume_pct_portal"], "%")
print("faixas:", total["faixas"])
print("CE:", len(ce_res), "reservatórios;", sum(1 for r in ce_res if r["gx"] is None), "sem coordenada")
print("série embutida de", HIST["de"], "a", HIST["ate"], "| data de referência livre a partir de",
      (DE + timedelta(days=LIMIAR_DIAS)).isoformat(), "(antes disso a janela de ±30 dias ficaria incompleta)")
print("séries do portal (seções 3 e 4) nas", len(DT["datas"]), "datas coletadas, de", DT["datas"][-1], "a", DT["datas"][0])
print("KB", round((AQUI / "dados_sin.json").stat().st_size / 1024))
