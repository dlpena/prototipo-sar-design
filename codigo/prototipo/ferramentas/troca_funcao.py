# -*- coding: utf-8 -*-
"""Troca (ou apaga) uma função de topo de um arquivo de js/ pelo texto de outro arquivo.

  py troca_funcao.py <arquivo.js> <nome> <novo.js | --apagar>

Mesma regra do mover.py: a função começa em "function nome(" na coluna 0 e termina na primeira linha "}"; os
comentários logo acima vão junto (e são substituídos pelos do texto novo)."""
import sys
from pathlib import Path
from mover import extrai

arq, nome, novo = Path(sys.argv[1]), sys.argv[2], sys.argv[3]
L = arq.read_text(encoding="utf-8").split("\n"); a, b = extrai(L, nome)
L[a:b] = [] if novo == "--apagar" else Path(novo).read_text(encoding="utf-8").rstrip("\n").split("\n")
arq.write_text("\n".join(L), encoding="utf-8"); print(("apagada " if novo == "--apagar" else "trocada ") + nome + " em " + arq.name)
