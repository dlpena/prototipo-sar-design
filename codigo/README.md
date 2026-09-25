# Código do protótipo do novo SAR

Código-fonte da página publicada neste repositório (`index.html`), com a mesma estrutura de pastas do projeto:

- `prototipo/`: a página (módulos ES em `prototipo/js/`, estilo em `prototipo/css/`, esqueleto em `prototipo/pagina.html`), a montagem
  (`prototipo/montar.py`), a preparação dos dados embutidos (`prototipo/preparar*.py`), os testes das regras de negócio
  (`prototipo/testes/`) e as ferramentas de verificação (`prototipo/ferramentas/`). Visão geral, camadas e convenções em
  [`prototipo/LEIA-ME.md`](prototipo/LEIA-ME.md).
- `dados/`: o que a montagem lê além de `prototipo/` (correspondência de códigos das fontes do Nordeste e fichas das usinas).

Para trabalhar: `py -m http.server 8765 --directory codigo/prototipo` e abrir `http://127.0.0.1:8765/dev.html` (módulos
carregados direto). Para montar a página: `py codigo/prototipo/montar.py`, que grava `prototipo/prototipo.html` (a mesma
página do `index.html`). Verificação: `npm install` e `npm run verificar` em `codigo/prototipo`.

As coletas que alimentam `prototipo/preparar*.py` acessam bases internas da ANA e não estão aqui; os dados já preparados estão
em `prototipo/dados.json`. Esta pasta é refeita a cada publicação por `prototipo/ferramentas/publicar.py`.
