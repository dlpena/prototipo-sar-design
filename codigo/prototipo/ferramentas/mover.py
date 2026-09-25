# -*- coding: utf-8 -*-
"""Move funções de topo entre arquivos de js/ (com os comentários logo acima), para reorganizar o código sem reescrever.

  py mover.py <origem.js> <destino.js> nome1 [nome2 ...]

Só move declarações `function nome(...) {...}` (içadas pelo JavaScript: a posição no arquivo não muda o comportamento).
Supõe o código formatado pelo Prettier: a função de topo começa em "function nome(" na coluna 0 e termina na primeira
linha que é só "}". As funções entram no fim do destino, na ordem pedida."""
import re, sys
from pathlib import Path


def extrai(linhas, nome):
    ini = next((i for i, l in enumerate(linhas) if re.match(rf"(async )?function {re.escape(nome)}\(", l)), None)
    assert ini is not None, f"função {nome} não encontrada"
    fim = next(i for i in range(ini, len(linhas)) if linhas[i] == "}")
    com = ini
    while com > 0 and (linhas[com - 1].startswith("//") or linhas[com - 1].startswith("/*") or linhas[com - 1].startswith(" *")
                       or (linhas[com - 1].endswith("*/") and not linhas[com - 1].startswith(" "))):
        com -= 1
    return com, fim + 1


def mover(origem, destino, nomes):
    o, d = Path(origem), Path(destino)
    lo = o.read_text(encoding="utf-8").split("\n")
    blocos = []
    for n in nomes:
        a, b = extrai(lo, n); blocos.append("\n".join(lo[a:b])); del lo[a:b]
        while a < len(lo) and a > 0 and lo[a] == "" and lo[a - 1] == "": del lo[a]
    o.write_text("\n".join(lo), encoding="utf-8")
    ld = d.read_text(encoding="utf-8").rstrip("\n") if d.exists() else ""
    d.write_text((ld + "\n\n" if ld else "") + "\n\n".join(blocos) + "\n", encoding="utf-8")
    print(f"{len(nomes)} função(ões) de {o.name} para {d.name}: {', '.join(nomes)}")


if __name__ == "__main__":
    mover(sys.argv[1], sys.argv[2], sys.argv[3:])
