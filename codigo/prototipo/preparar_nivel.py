# -*- coding: utf-8 -*-
"""Acrescenta a dados.json (chave ne.nivel) os estados com página no modelo único: CE (só volume), PI (misto),
AL e SE (só nível). O tipo da página sai do dado: volume, misto ou nível.

Rodar depois de preparar_ne.py. Entradas: ../dados/nivel_ne.json (coleta_nivel_ne.py, HidroInfoAna) e
../dados/fases_ne.json (coleta_ne_fases.py, histórico do SAR desde 2006).

Modo de exibição de cada açude, como seria gravado na área de administração (Diego, 18/09/2026):
  volume  — açude do SAR com medição de volume nos 12 meses da série do módulo;
  nível   — leitura de régua no HidroInfoAna e nenhum volume no SAR no período (sem CAV validada), esteja
            ou não no cadastro do SAR;
  oculto  — açude do SAR sem volume e sem leitura de nível no período (acompanhamento interrompido). Sai da
            página do estado, continua na área de dados.
Estação com série "a verificar" (salto de mais de 3 m que o filtro não explica) não entra e é declarada; se for
de reservatório do cadastro, ele não conta como oculto (tem leitura), e sim como "a verificar".

Estação fora do cadastro do SAR só entra se o nome indicar o próprio açude (começa por AÇUDE, ACUDE, BARRAGEM ou
RESERVATÓRIO) e não trouxer MONTANTE: régua a montante mede o rio que chega, não o nível do reservatório; nomes de
lagoa, ponte, fazenda ou localidade podem ser réguas de rio. Estação do cadastro entra sempre (o código é o do
reservatório). Todos os dez estados entram nos dados; tem página o estado com algum reservatório acompanhado.
"""
import re
import json
from datetime import date
from pathlib import Path

AQUI = Path(__file__).parent
DADOS = AQUI.parent / "dados"
SIN = json.loads((AQUI / "dados.json").read_text(encoding="utf-8"))
NIV = json.loads((DADOS / "nivel_ne.json").read_text(encoding="utf-8"))
FAS = json.loads((DADOS / "fases_ne.json").read_text(encoding="utf-8"))
NE = SIN["ne"]
D0 = date.fromisoformat(NE["serie_de"])
dia = lambda iso: (date.fromisoformat(iso) - D0).days


def limpa_nome(n):
    for p in ("AÇUDE ", "ACUDE "):
        if n.upper().startswith(p):
            return n[len(p):].strip()
    return n.strip()


ultima_sar = {r["codigo"]: r["ate"] for r in FAS["reservatorios"]}
estados = {}
COLETADOS = {e["uf"] for e in NIV["estacoes"]} | set(NIV["estacoes_por_ano"])   # UFs com estações levantadas
NOME_ACUDE = re.compile(r"^(AÇUDE|ACUDE|BARRAGEM|RESERVATÓRIO|RESERVATORIO)\b")
descartes = {"montante": [], "nome": []}
for uf in ("AL", "BA", "CE", "MA", "MG", "PB", "PE", "PI", "RN", "SE"):
    res_uf = [r for r in NE["reservatorios"] if r["uf"] == uf]
    volume = [r["i"] for r in res_uf if r["s"]]
    cod_volume = {r["codigo"] for r in res_uf if r["s"]}
    nivel, a_verificar, cobertos = [], [], set()
    for e in NIV["estacoes"]:
        if e["uf"] != uf:
            continue
        cod_sar = e["sar"]["codigo"] if e["sar"] else None
        if cod_sar in cod_volume:
            continue                      # já aparece com volume
        if cod_sar is None:
            if "MONTANTE" in e["nome"].upper():
                descartes["montante"].append(f'{uf} {e["nome"]}'); continue
            if not NOME_ACUDE.match(e["nome"].upper().strip()):
                descartes["nome"].append(f'{uf} {e["nome"]}'); continue
        if cod_sar:
            cobertos.add(cod_sar)         # tem leitura: não é oculto, mesmo que a série esteja a verificar
        if e["a_verificar"]:
            a_verificar.append({"nome": limpa_nome(e["nome"]), "maior_salto_cm": e["maior_salto_cm"], "no_sar": cod_sar is not None})
            continue
        nivel.append({"nome": limpa_nome(e["nome"]), "municipio": e["municipio"], "lat": e["lat"], "lon": e["lon"],
                      "codigo": cod_sar,
                      "no_sar": cod_sar is not None, "desde": min(e["anos"]) if e["anos"] else None,
                      "descartadas": len(e["descartadas"]), "s": [[dia(d), cm] for d, cm in e["s"]]})
    ocultos = [r for r in res_uf if r["codigo"] not in cod_volume and r["codigo"] not in cobertos]
    fins = sorted(ultima_sar.get(r["codigo"]) for r in ocultos if ultima_sar.get(r["codigo"]))
    hist = {}
    for a in range(2006, 2027):
        a = str(a)
        hist[a] = {"sar": sum(1 for r in FAS["reservatorios"] if r["uf"] == uf and r["anos"].get(a)),
                   # só onde as estações foram levantadas; nos demais o SAR não tem essa série (None, não zero)
                   "hidro": NIV["estacoes_por_ano"].get(uf, {}).get(a, 0) if uf in COLETADOS else None}
    modo = "misto" if volume and nivel else "volume" if volume else "nivel"
    # reservatórios do cadastro sem volume no ano que aparecem pela leitura de nível (ou estão a verificar): saem da
    # lista de volume da página do NE, para não contarem duas vezes
    fora_do_volume = [r["i"] for r in res_uf if r["codigo"] in cobertos]
    # página: todo estado com algum reservatório acompanhado
    estados[uf] = {"modo": modo, "pagina": bool(volume or nivel), "volume": volume, "nivel": nivel, "fora_do_volume": fora_do_volume,
                   "ocultos": {"n": len(ocultos), "indices": [r["i"] for r in ocultos], "ultima_de": fins[0] if fins else None, "ultima_ate": fins[-1] if fins else None},
                   "a_verificar": a_verificar, "cadastro_sar": len(res_uf), "hist": hist}
    print(f"{uf}: {len(volume)} com volume, {len(nivel)} só nível ({sum(1 for n in nivel if n['no_sar'])} do cadastro do SAR), "
          f"{len(ocultos)} ocultos (última medição de {fins[0] if fins else '-'} a {fins[-1] if fins else '-'}), "
          f"{len(a_verificar)} a verificar {[x['nome'] for x in a_verificar]}")

print("fora do cadastro e descartadas: montante", len(descartes["montante"]), "| nome sem açude", len(descartes["nome"]), descartes["nome"])
NE["nivel"] = {"estados": estados, "filtro": NIV["filtro"], "fonte": NIV["fonte"], "fonte_hist": FAS["fonte"],
               "descartes": {k: len(v) for k, v in descartes.items()}}
(AQUI / "dados.json").write_text(json.dumps(SIN, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print("dados.json atualizado")
