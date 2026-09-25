# -*- coding: utf-8 -*-
"""Refaz os dados embutidos no protótipo (dados_sin.json) a partir das coletas guardadas em ../dados, na ordem certa.

  py preparar.py              # roda as etapas e grava dados_sin.json
  py preparar.py --comparar   # roda sobre uma cópia e compara com o dados_sin.json atual (não grava nada)

Etapas (cada uma lê o dados_sin.json da anterior):
  1. preparar_dados.py    SIN: usinas, bacias, reservatório equivalente, bacia do Grande, mapas
                          (baixa as malhas de país e estados do IBGE)
  2. preparar_ne.py       Nordeste e Semiárido: reservatórios, séries de 12 meses, resumo por estado (refaz o bloco "ne")
  3. preparar_serie_ne.py série diária do volume acumulado direto de cada estado e do Nordeste, desde o ano inicial
  4. preparar_fichas.py   fichas de exemplo do Nordeste
  5. preparar_nivel.py    estados com leitura de nível (páginas de estado)
  6. preparar_outros.py   Outros Sistemas Hídricos (Cantareira, Distrito Federal, RMBH)
As coletas (../dados/coleta_*.py) buscam os dados nas fontes e não rodam aqui: ver ../dados/LEIA-ME.md."""
import json, shutil, subprocess, sys
from pathlib import Path

AQUI = Path(__file__).parent
ETAPAS = ["preparar_dados.py", "preparar_ne.py", "preparar_serie_ne.py", "preparar_fichas.py", "preparar_nivel.py", "preparar_outros.py"]


def rodar():
    for e in ETAPAS:
        print(f"--- {e}", flush=True)
        subprocess.run([sys.executable, str(AQUI / e)], cwd=AQUI, check=True)


def diferencas(a, b, cam="", out=None, lim=30):
    out = [] if out is None else out
    if len(out) >= lim: return out
    if isinstance(a, dict) and isinstance(b, dict):
        for k in sorted(set(a) | set(b)):
            if k not in a or k not in b: out.append(f"{cam}.{k}: só {'no atual' if k in a else 'no refeito'}")
            else: diferencas(a[k], b[k], f"{cam}.{k}", out, lim)
    elif isinstance(a, list) and isinstance(b, list):
        if len(a) != len(b): out.append(f"{cam}: {len(a)} itens no atual, {len(b)} no refeito")
        else:
            for i, (x, y) in enumerate(zip(a, b)): diferencas(x, y, f"{cam}[{i}]", out, lim)
    elif a != b and not (isinstance(a, float) and isinstance(b, float) and abs(a - b) < 1e-9):
        out.append(f"{cam}: {str(a)[:60]} -> {str(b)[:60]}")
    return out


if __name__ == "__main__":
    if "--comparar" in sys.argv:
        atual = AQUI / "dados_sin.json"; guarda = AQUI / "dados_sin.json.atual"
        shutil.copy2(atual, guarda)
        try:
            rodar()
            A, B = json.loads(guarda.read_text(encoding="utf-8")), json.loads(atual.read_text(encoding="utf-8"))
            dif = diferencas(A, B)
            print("\nigual ao atual" if not dif else f"\n{len(dif)} diferença(s) (até 30):\n  " + "\n  ".join(dif))
        finally:
            shutil.move(str(guarda), str(atual))     # o atual volta: --comparar não grava nada
    else:
        rodar()
