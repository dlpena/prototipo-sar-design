# Código do protótipo do novo SAR

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
