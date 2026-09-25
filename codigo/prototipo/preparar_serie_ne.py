# -*- coding: utf-8 -*-
"""Série diária do volume acumulado direto de cada estado e do Nordeste (Diego, 23/09/2026), no lugar da curva
encadeada (preparar_curvas.py, retirado): cada valor é o que a página mostra se a data for escolhida como data de
referência, pela mesma regra; nada é calculado por encadeamento.

Rodar depois de preparar_ne.py (usa o cadastro do bloco "ne" de dados.json). Entrada:
../dados/serie_completa_ne.json (coleta_ne_completa.py, sar0/Medicao desde 2006).

Regras:
- mesma base das páginas: os reservatórios do cadastro do módulo, com a crítica de cota e volume (critica_nivel.py);
  reservatório hoje retirado do acompanhamento conta enquanto teve leitura;
- em cada dia, cada reservatório entra com a leitura mais próxima, até LIM dias antes ou depois (empate: a anterior);
- volume acumulado = soma dos volumes / soma das capacidades de quem entrou (capacidade equivalente), em %;
- ano inicial: o primeiro ano em que a média mensal da capacidade medida do Nordeste chega a COBERTURA_MIN% da
  capacidade cadastrada (Diego: "Pode seguir com 2013"; verificação em 23/09/2026: 2006-2011 entre 57% e 65%, com
  saltos de composição; 2012, 77%; 2013 em diante, 88% a 95%, sem salto acima de 5 p.p. no Nordeste);
- troca: para cada dia, a capacidade dos reservatórios que entraram mais a dos que saíram em relação ao mesmo dia do
  mês anterior (o ponto anterior da série mensal das páginas), em % da média das duas capacidades equivalentes. A
  página não liga dois pontos mensais seguidos quando a troca passa de LIMIAR_TROCA% (parâmetro da área administrativa).
  Calibração (23/09/2026, dia 15 de cada mês, 2013 a 2026, 1.466 pares de meses): acima de 15% a regra pega os 45
  saltos de composição de mais de 5 p.p. e interrompe 116 meses; acima de 10%, os mesmos 45, com 155 interrupções (../dados/confere_serie_ne.py).

Saída: bloco "serie_direta" do "ne" em dados.json: inicio, fim, ano_inicial, limiar_troca_pct, cobertura_min_pct e,
por grupo (UF e "NE"), listas diárias pct (3 casas, para o navegador arredondar como na página), n (reservatórios medidos), cap (capacidade equivalente, hm³) e
troca (%, inteiro; None quando falta um dos dois conjuntos)."""
import bisect
import json
import sys
from datetime import date, timedelta
from pathlib import Path

AQUI = Path(__file__).parent
DADOS = AQUI.parent / "dados"
sys.path.insert(0, str(DADOS))
from critica_nivel import filtrar, filtrar_volume  # noqa: E402

LIM, LIMIAR_TROCA, COBERTURA_MIN = 30, 15, 90
SIN = json.loads((AQUI / "dados.json").read_text(encoding="utf-8"))
NE = SIN["ne"]
FONTE = json.loads((DADOS / "serie_completa_ne.json").read_text(encoding="utf-8"))
SC = FONTE["reservatorios"]
FIM = date.fromisoformat(NE["serie_ate"])

# série criticada de cada linha do cadastro (CRISTALÂNDIA aparece duas vezes no cadastro das páginas com o mesmo
# código: entra duas vezes aqui também, para o valor bater com o da página)
res, desc = [], {"cota": 0, "volume": 0, "nao_inf": 0}
for r in NE["reservatorios"]:
    s = SC.get(r.get("codigo"), {}).get("s", [])
    if not s or not r["capacidade_hm3"]:
        res.append({"uf": r["uf"], "cap": r["capacidade_hm3"] or 0, "d": [], "v": []})
        continue
    dias = [x[0] for x in s]
    # crítica na série inteira e só depois o corte em FIM (a última leitura precisa da seguinte para ser julgada)
    _, fc = filtrar(dias, [round(x[1] * 100) if x[1] else 0 for x in s])
    _, fv = filtrar_volume(dias, [x[3] for x in s], [x[1] for x in s])
    sem_v = {i for i, _ in fv}
    desc["cota"] += sum(1 for _, g in fc if g != "cota não informada")
    desc["volume"] += sum(1 for _, g in fv if g != "volume não informado")
    desc["nao_inf"] += sum(1 for _, g in fv if g == "volume não informado")
    pts = [(date.fromisoformat(x[0]).toordinal(), x[2]) for i, x in enumerate(s)
           if i not in sem_v and x[2] is not None and x[0] <= FIM.isoformat()]
    res.append({"uf": r["uf"], "cap": r["capacidade_hm3"], "d": [p[0] for p in pts], "v": [p[1] for p in pts]})


def na(rr, alvo):
    """Volume (hm³) pela regra da data de referência, ou None."""
    D = rr["d"]
    if not D:
        return None
    k = bisect.bisect_left(D, alvo)
    melhor = None
    for j in (k - 1, k):
        if 0 <= j < len(D) and abs(D[j] - alvo) <= LIM and (melhor is None or abs(D[j] - alvo) < abs(D[melhor] - alvo)):
            melhor = j
    return None if melhor is None else rr["v"][melhor]


grupos = {uf: [i for i, rr in enumerate(res) if rr["uf"] == uf] for uf in sorted({rr["uf"] for rr in res})}
grupos["NE"] = list(range(len(res)))
cap_cad = sum(rr["cap"] for rr in res)

# ---- ano inicial: primeiro ano com média mensal (dia 15) da capacidade medida do Nordeste >= COBERTURA_MIN%
cob_ano = {}
for a in range(2006, FIM.year + 1):
    vals = []
    for m in range(1, 13):
        d = date(a, m, 15)
        if d > FIM:
            break
        vals.append(sum(rr["cap"] for rr in res if na(rr, d.toordinal()) is not None) / cap_cad * 100)
    cob_ano[a] = sum(vals) / len(vals)
ANO_INICIAL = next(a for a in sorted(cob_ano) if cob_ano[a] >= COBERTURA_MIN)
print("capacidade medida do Nordeste, média mensal por ano (%):",
      " ".join(f"{a}:{v:.0f}" for a, v in cob_ano.items()), "| ano inicial:", ANO_INICIAL)
assert ANO_INICIAL == 2013, "o ano inicial mudou com os dados: rever com a área técnica antes de publicar"


def mes_anterior(d):
    """Mesmo dia do mês anterior; se o mês anterior não tem o dia, o último dia dele."""
    a, m = (d.year, d.month - 1) if d.month > 1 else (d.year - 1, 12)
    ult = (date(a + (m == 12), m % 12 + 1, 1) - timedelta(days=1)).day
    return date(a, m, min(d.day, ult))


INI = date(ANO_INICIAL, 1, 1)
PRE = mes_anterior(INI)                       # dias anteriores ao início, só para a troca de janeiro
n_dias = (FIM - PRE).days + 1
dias = [PRE + timedelta(days=k) for k in range(n_dias)]
V = [[na(rr, d.toordinal()) for d in dias] for rr in res]
pos = {d: k for k, d in enumerate(dias)}

series = {}
for g, idx in grupos.items():
    S = {"pct": [], "n": [], "cap": [], "troca": []}
    for d in dias[pos[INI]:]:
        k, kp = pos[d], pos[mes_anterior(d)]
        B = [i for i in idx if V[i][k] is not None]
        A = {i for i in idx if V[i][kp] is not None}
        capB = sum(res[i]["cap"] for i in B)
        capA = sum(res[i]["cap"] for i in A)
        S["pct"].append(round(sum(V[i][k] for i in B) / capB * 100, 3) if capB else None)  # 3 casas: a página arredonda
        S["n"].append(len(B))
        S["cap"].append(round(capB) if capB else 0)
        if capA and capB:
            Bs = set(B)
            troca = (sum(res[i]["cap"] for i in Bs - A) + sum(res[i]["cap"] for i in A - Bs)) / ((capA + capB) / 2) * 100
            S["troca"].append(round(troca))
        else:
            S["troca"].append(None)
    series[g] = S

# conferência: interrupções por grupo no passo mensal (dia 15) e contra a série do portal (CE e NE)
print(f"{len(series['NE']['pct'])} dias de {INI} a {FIM} | crítica: {desc}")
for g in sorted(series, key=lambda x: (x != "NE", x)):
    S = series[g]
    k15 = [k for k, d in enumerate(dias[pos[INI]:]) if d.day == 15 and S["pct"][k] is not None]
    q = sum(1 for k in k15 if S["troca"][k] is not None and S["troca"][k] > LIMIAR_TROCA)
    print(f"  {g}: último {S['pct'][-1]}% ({S['n'][-1]} medidos, {S['cap'][-1]} hm³) | meses {len(k15)}, "
          f"linha interrompida em {q}")
for g in ("CE", "NE"):
    port = NE["serie"].get(g, {})
    dif = [abs(v - series[g]["pct"][(date.fromisoformat(x) - INI).days]) for x, v in port.items()
           if date.fromisoformat(x) >= INI and series[g]["pct"][(date.fromisoformat(x) - INI).days] is not None]
    if dif:
        print(f"  {g} contra o portal ({len(dif)} datas): {sum(dif)/len(dif):.2f} p.p. em média (máx {max(dif):.1f}); "
              "o portal inclui reservatórios com medição fora da janela")

NE.pop("curvas", None)
NE["serie_direta"] = {"inicio": INI.isoformat(), "fim": FIM.isoformat(), "ano_inicial": ANO_INICIAL,
                      "limiar_troca_pct": LIMIAR_TROCA, "cobertura_min_pct": COBERTURA_MIN,
                      "cobertura_ano": {a: round(v, 1) for a, v in cob_ano.items()},
                      "series": series, "critica": desc, "fonte": FONTE["fonte"]}
(AQUI / "dados.json").write_text(json.dumps(SIN, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print("dados.json atualizado (ne.serie_direta)")
