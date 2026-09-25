# -*- coding: utf-8 -*-
"""Gera testes/fixture_janela.json: a medição que a regra da data de referência do Nordeste escolhe, pela função Python
original (na_data, lida direto de preparar_ne.py, sem rodar o resto do script), para cada reservatório do Nordeste e
uma data a cada 5 dias da série embutida. O teste de JavaScript (regras.test.mjs) confere que a regra do navegador
(medicaoNaJanela) escolhe a mesma medição em todos os casos. Rodar de novo quando preparar_ne.py ou os dados mudarem."""
import ast, json
from datetime import date, timedelta
from pathlib import Path

AQUI = Path(__file__).parent
fonte = (AQUI.parent / "preparar_ne.py").read_text(encoding="utf-8")
arv = ast.parse(fonte)
func = next(n for n in arv.body if isinstance(n, ast.FunctionDef) and n.name == "na_data")
limiar = next(n.value.value for n in arv.body if isinstance(n, ast.Assign) and getattr(n.targets[0], "id", "") == "LIMIAR_DIAS")
NE = json.loads((AQUI.parent / "dados.json").read_text(encoding="utf-8"))["ne"]
DE = date.fromisoformat(NE["serie_de"])
ctx = {"LIMIAR_DIAS": limiar, "DE": DE}
exec(compile(ast.Module(body=[func], type_ignores=[]), "preparar_ne.py:na_data", "exec"), ctx)
na_data = ctx["na_data"]

casos, d, fim = [], date.fromisoformat(NE["serie_min"]), date.fromisoformat(NE["serie_ate"])
while d <= fim:
    alvo = (d - DE).days
    for r in NE["reservatorios"]:
        if not r["s"]: continue
        m = na_data(r, d)
        casos.append([r["i"], alvo, None if m is None else m[1]])
    d += timedelta(days=5)
(AQUI / "fixture_janela.json").write_text(json.dumps({"limiar": limiar, "serie_de": NE["serie_de"], "casos": casos}, separators=(",", ":")), encoding="utf-8")
print(len(casos), "casos; com medição:", sum(1 for c in casos if c[2] is not None))
