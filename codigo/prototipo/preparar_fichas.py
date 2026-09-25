# -*- coding: utf-8 -*-
"""Acrescenta a dados.json (chave ne.fichas) as três fichas de exemplo do NE (Diego, 18/09/2026).

Rodar depois de preparar_ne.py e preparar_nivel.py. Entrada: ../dados/fichas_ne.json (coleta_fichas_ne.py).

Crítica (estrutura/criterios_ne.md, item 6), com status separado para cota e volume:
- cota: cota não informada (zero ou vazia), erro grosseiro contra a mediana do ano civil, pico de um dia, degrau que volta;
- volume: volume não informado (zero com cota informada), pico de um dia e degrau que volta de 5 p.p.
Valor descartado vira ausente na série; os descartes por erro ficam listados para aparecer no gráfico como leitura
descartada. "Não informado" não é leitura: só conta.
"""
import json
import sys
from pathlib import Path

AQUI = Path(__file__).parent
DADOS = AQUI.parent / "dados"
sys.path.insert(0, str(DADOS))
from critica_nivel import filtrar, filtrar_volume  # noqa: E402

SIN = json.loads((AQUI / "dados.json").read_text(encoding="utf-8"))
NE = SIN["ne"]
FI = json.loads((DADOS / "fichas_ne.json").read_text(encoding="utf-8"))
ATE = NE["serie_ate"]
NAO_INF = ("cota não informada", "volume não informado")

fichas = {}
for cod, f in FI["fichas"].items():
    base = next(r for r in NE["reservatorios"] if r["codigo"] == cod)
    s = f["serie"]                     # crítica na série inteira; o corte em ATE vem depois (a última leitura precisa do vizinho)
    dias = [l[0] for l in s]
    _, fora_c = filtrar(dias, [round(l[1] * 100) if l[1] else 0 for l in s])
    _, fora_v = filtrar_volume(dias, [l[3] for l in s], [l[1] for l in s])
    sem_cota = {i for i, _ in fora_c}
    sem_vol = {i for i, _ in fora_v}
    serie = []
    for i, (d, cota, hm3, pct) in enumerate(s):
        if d > ATE:
            continue
        c = None if i in sem_cota else cota
        h, p = (None, None) if i in sem_vol else (hm3, pct)
        if c is None and p is None:
            continue
        serie.append([d, c, h, p])
    desc = {"cota": [[s[i][0], s[i][1], r] for i, r in fora_c if r not in NAO_INF and s[i][0] <= ATE],
            "volume": [[s[i][0], s[i][3], r] for i, r in fora_v if r not in NAO_INF and s[i][0] <= ATE]}
    nao_inf = {"cota": sum(1 for _, r in fora_c if r in NAO_INF), "volume": sum(1 for _, r in fora_v if r in NAO_INF)}
    item = {"codigo": cod, "i": base["i"], "nome": base["nome"], "uf": base["uf"], "estado": base["estado"],
            "municipio": base["municipio"], "bacia": base["bacia"], "capacidade_hm3": base["capacidade_hm3"],
            "lat": base["lat"], "lon": base["lon"], "modo": "nivel" if "nivel" in f else "volume",
            "serie": serie, "descartes": desc, "nao_informados": nao_inf, "linhas_sar": sum(1 for l in s if l[0] <= ATE)}
    if "nivel" in f:
        n = f["nivel"]
        item["nivel"] = {"estacao": n["estacao"], "serie": [[d, cm / 100] for d, cm in n["serie"] if d <= ATE],
                         "descartes": [[d, cm / 100, r] for d, cm, r in n["descartadas"] if d <= ATE and r not in NAO_INF]}
    fichas[cod] = item
    print(f"{cod} {base['nome']}: {len(serie)} linhas | cota descartada {len(desc['cota'])} (+{nao_inf['cota']} não informadas)"
          f" | volume descartado {len(desc['volume'])} (+{nao_inf['volume']} não informados)"
          + (f" | nível {len(item['nivel']['serie'])} leituras, {len(item['nivel']['descartes'])} descartadas" if "nivel" in item else ""))

NE["fichas"] = fichas
NE["fontes"]["ficha_sar"] = FI["fonte_sar"]
NE["fontes"]["ficha_nivel"] = FI["fonte_nivel"]
(AQUI / "dados.json").write_text(json.dumps(SIN, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print("dados.json atualizado")
