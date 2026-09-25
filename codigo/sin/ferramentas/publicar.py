# -*- coding: utf-8 -*-
"""Copia a página montada e o código que a gera para a cópia local do repositório publicado (GitHub Pages).

  py ferramentas/publicar.py <pasta do repositório>

No repositório: index.html (prototipo-sin.html) e fichas/ na raiz, servidos pelo Pages; em codigo/, o código-fonte com
a mesma estrutura de pastas do projeto (codigo/sin = mockups/sin; codigo/dados só com o que a montagem lê), para a
página e o código que a gerou irem juntos em cada publicação. A pasta codigo/ é refeita a cada cópia. Ficam fora as
coletas (mockups/dados/coleta_*.py, que acessam bancos internos) e os JSON das coletas; vão no pacote à parte.
Depois: git add, commit e push na pasta do repositório."""
import shutil
import sys
from pathlib import Path

SIN = Path(__file__).resolve().parent.parent
DADOS = SIN.parent / "dados"
# o que vai para codigo/sin (arquivos e pastas, relativos a mockups/sin)
CODIGO = ["js", "css", "testes", "pagina.html", "dev.html", "auditoria.html", "montar.py", "preparar.py", "preparar_dados.py",
          "preparar_fichas.py", "preparar_ne.py", "preparar_nivel.py", "preparar_outros.py", "preparar_serie_ne.py",
          "dados_sin.json", "dados_admin.json", "assets/leaflet.min.css", "assets/logo_ana_horizontal.svg",
          "ferramentas/publicar.py", "ferramentas/regressao.py", "ferramentas/mesma_ast.mjs", "ferramentas/mover.py",
          "ferramentas/troca_funcao.py", "eslint.config.mjs", "package.json", ".prettierrc.json", "LEIA-ME.md"]
# o que a montagem lê de mockups/dados
DADOS_MONTAGEM = ["referencias/depara_ne.json", "fichas_sin"]
IGNORA = shutil.ignore_patterns("__pycache__", "*.pyc", "node_modules")

LEIA = """# Código do protótipo do novo SAR

Código-fonte da página publicada neste repositório (`index.html`), com a mesma estrutura de pastas do projeto:

- `sin/`: a página (módulos ES em `sin/js/`, estilo em `sin/css/`, esqueleto em `sin/pagina.html`), a montagem
  (`sin/montar.py`), a preparação dos dados embutidos (`sin/preparar*.py`), os testes das regras de negócio
  (`sin/testes/`) e as ferramentas de verificação (`sin/ferramentas/`). Visão geral, camadas e convenções em
  [`sin/LEIA-ME.md`](sin/LEIA-ME.md).
- `dados/`: o que a montagem lê além de `sin/` (correspondência de códigos das fontes do Nordeste e fichas das usinas).

Para trabalhar: `py -m http.server 8765 --directory codigo/sin` e abrir `http://127.0.0.1:8765/dev.html` (módulos
carregados direto). Para montar a página: `py codigo/sin/montar.py`, que grava `sin/prototipo-sin.html` (a mesma
página do `index.html`). Verificação: `npm install` e `npm run verificar` em `codigo/sin`.

As coletas que alimentam `sin/preparar*.py` acessam bases internas da ANA e não estão aqui; os dados já preparados estão
em `sin/dados_sin.json`. Esta pasta é refeita a cada publicação por `sin/ferramentas/publicar.py`.
"""


def copia(orig, dest):
    dest.parent.mkdir(parents=True, exist_ok=True)
    if orig.is_dir():
        shutil.copytree(orig, dest, ignore=IGNORA)
    else:
        shutil.copy2(orig, dest)


def publicar(repo):
    repo = Path(repo)
    assert (repo / ".git").exists(), f"{repo} não é um repositório git"
    shutil.copy2(SIN / "prototipo-sin.html", repo / "index.html")
    (repo / "fichas").mkdir(exist_ok=True)
    for f in (SIN / "fichas").glob("*.json"):
        shutil.copy2(f, repo / "fichas" / f.name)
    cod = repo / "codigo"
    if cod.exists():
        shutil.rmtree(cod)
    for x in CODIGO:
        copia(SIN / x, cod / "sin" / x)
    for x in DADOS_MONTAGEM:
        copia(DADOS / x, cod / "dados" / x)
    (cod / "README.md").write_text(LEIA, encoding="utf-8")
    (cod / ".gitignore").write_text("sin/prototipo-sin.html\nsin/fichas/\nnode_modules/\n__pycache__/\n", encoding="utf-8")
    n = sum(1 for p in cod.rglob("*") if p.is_file())
    print(f"index.html, fichas/ e codigo/ ({n} arquivos) copiados para {repo}")


if __name__ == "__main__":
    publicar(sys.argv[1])
