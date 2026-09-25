# Protótipo do novo SAR — leia-me

Protótipo navegável do novo Sistema de Acompanhamento de Reservatórios (SAR) da ANA, feito pela CORSH/SOE para
acompanhar a Nota Informativa à STI. O Anexo I da nota descreve o sistema página a página; o protótipo mostra o mesmo
comportamento com dados reais. É referência de telas, regras e fluxos: não é o código do sistema a construir, mas
boa parte dele (componentes de gráfico, exportações, regras de negócio, textos, especificação da API) pode ser
aproveitada diretamente.

## O que é real e o que é simulado

- **Dados reais**, lidos nas fontes (SAR, ONS, SNIRH, IBGE, INPE, INSA, SABESP, HidroInfoAna) com a data de cada
  leitura registrada. Veja `../dados/LEIA-ME.md`. Os dados vão embutidos na página (`dados.json`, cerca de 9 MB),
  com recortes para caber: série do Nordeste e Semiárido de 12 meses; base horária do ONS de julho a setembro de 2026;
  fichas completas só de 10 usinas do SIN (Furnas e as usinas com faixas de operação em resolução da ANA, carregadas
  sob demanda de `fichas/`), 3 açudes do Nordeste e 10 reservatórios de Outros Sistemas.
- **Simulado**: a área administrativa (`#admin`) guarda tudo na memória da página, sem servidor, e o que se altera nela
  não refaz as páginas públicas; a API pública (`#api`) está documentada, mas não existe (os endereços são ilustrativos).

## Montar e ver

```
py preparar.py      # refaz dados.json a partir das coletas de ../dados (só quando os dados mudam)
py montar.py        # junta pagina.html, css/, js/ e os dados em prototipo.html (um arquivo só) e gera dev.html
py -m http.server 8765 --directory .    # e abrir http://127.0.0.1:8765/prototipo.html
```

Para trabalhar no código, abra `http://127.0.0.1:8765/dev.html`: a mesma página, com os módulos de `js/` carregados
direto pelo navegador, sem montagem (basta recarregar depois de editar). O `montar.py` só é preciso para gerar o
arquivo publicado e quando mudam `pagina.html`, a lista de CSS ou os dados da área administrativa.

Pacotes Python: `../requirements.txt` (a montagem usa só a biblioteca padrão; a preparação pede `shapely` e `requests`).
Nenhum caminho depende da máquina: a correspondência de códigos do Nordeste que o `montar.py` embute está em
`../dados/referencias/depara_ne.json`.

`py preparar.py --comparar` refaz os dados numa cópia e aponta o que difere do `dados.json` atual, sem gravar.
O resultado publicado é o `prototipo.html` com a pasta `fichas/` ao lado. `py ferramentas/publicar.py <cópia do repositório>` copia
para o repositório publicado a página (`index.html`), as fichas e, em `codigo/`, o código que a gera (esta pasta, com
a mesma estrutura, e o que a montagem lê de `../dados`), para a página e o código irem juntos em cada publicação. As
coletas de `../dados` ficam fora do repositório público (acessam bases internas).

## Estrutura do código

`pagina.html` é o esqueleto (cabeçalho, barra lateral, marcadores). O JavaScript está em módulos ES: cada arquivo de
`js/` abre com um cabeçalho que diz o que faz, importa com `import` o que usa de outros e termina com a lista `export`
do que oferece. `js/principal.js` é o ponto de entrada: carrega os módulos numa ordem declarada e dá a partida
(`iniciar`, em `rotas.js`). A `dev.html` carrega esse ponto de entrada direto; o `montar.py` lê a mesma lista, junta os
arquivos sem os `import` e `export` numa função única (escopo próprio, modo estrito) e grava o arquivo publicado.

Camadas, de baixo para cima (quem está embaixo não importa de quem está em cima):

1. `contexto.js` (o que as páginas compartilham e alteram: datas de referência, sistema aberto, busca vinda da página
   inicial), `regras.js` (regras de negócio, sem nada da página) e `dados_embutidos.js` (os dados e as vistas de cada
   módulo: `D`, `NEd`, `SD`, `OS`, `CAN`);
2. `base.js` (utilitários) e os componentes: `exportacao.js` e `graficos.js`;
3. as páginas (`sin.js`, `bacia.js`, `ne.js`…), que podem usar umas às outras (por exemplo, a ficha do açude usa
   funções do módulo do Nordeste), e `rotas.js`, que abre cada página.

Um módulo ES não pode reatribuir a variável que importou de outro: o que mais de uma página altera fica em `contexto`
(`contexto.dataRef = iso`). Os dados que o código lê ao carregar vêm só das camadas 1 e 2, para os módulos carregarem
em qualquer ordem no navegador.

Dentro de cada página, a função que a abre (`paginaGrande`, `paginaFichaNE`, `admSerie`…) é curta: cria um objeto com o estado
da página e chama, na ordem da tela, uma função por seção ou por tarefa (montar o HTML, desenhar um gráfico, ligar os
controles, preparar os downloads), todas no topo do módulo, com um comentário que diz o que fazem. O objeto de estado
é o primeiro parâmetro de cada uma e leva um nome fixo pelo tipo do que se desenha: `pag` (página), `graf` (gráfico),
`diag` (diagrama da cascata), `mp` (mapa), `pdf` (documento PDF) e `bal` (diagrama do balanço do Cantareira). Nenhuma
função passa de 120 linhas, salvo duas que ficaram um pouco acima (`cav` na área administrativa e
`reservatoriosBalancoCan`), por serem uma sequência de passos de um mesmo desenho.

Nomes de topo são únicos entre todos os arquivos de `js/`, e não só dentro de cada um: na página montada todos dividem
o mesmo escopo. Por isso as funções levam o nome da página no fim quando o assunto se repete (`situacaoFichaNE`,
`situacaoFichaOS`, `aplicarPresetDados`). O `montar.py` recusa a montagem e diz os dois arquivos se achar um nome
repetido.

| Arquivo | O que tem | Anexo I |
|---|---|---|
| `js/principal.js` | ponto de entrada: ordem de carga dos módulos e partida | — |
| `js/contexto.js` | o que as páginas compartilham e alteram (datas de referência, sistema aberto, busca) | 1 |
| `js/dados_embutidos.js` | dados do protótipo (`dados.json`) e vistas de cada módulo; aplica a retirada da afluência negativa do SIN | — |
| `js/base.js` | formatação de números e datas (`fmt`, `dBR`, `fData`, `fHora`), meses (`MESES`, `mesesAte`, `rotuloMes`, `diasNoMes`), SVG, aviso (toast), `COR` (cores lidas do CSS, e `COR_NV` do nível), `DESKTOP`, cadastro do SIN (`RES`, `NOME`, `POR_BACIA`, `UNID_MINI`), índice da página (`ligarIndice`), controle da data de referência (`barraData`, `ligarData`) | 1 |
| `js/regras.js` | regras de negócio que decidem números publicados (ver abaixo) | 3, 4 e 5 |
| `js/exportacao.js` | PNG dos gráficos e diagramas, PDF das tabelas, CSV, KMZ e legendas | 1 |
| `js/graficos.js` | componentes de gráfico comuns a todas as páginas (ver abaixo) | 1 |
| `js/inicio.js` | página inicial e busca | 2 |
| `js/sin.js`, `js/bacia.js`, `js/ficha_sin.js` | módulo SIN: página do módulo, página da bacia, ficha da usina | 3 |
| `js/topologia.js` | topologia da cascata (usina a jusante; rio receptor, trecho e ordem da confluência; rio sem usina como ligação) e desenho do diagrama nas duas orientações, usado pela página da bacia e pela inclusão de reservatório | 3 e 8 |
| `js/ne.js`, `js/ne_estados.js`, `js/ficha_ne.js` | módulo Nordeste e Semiárido: página do módulo, páginas de estado (volume, volume e nível, só nível), ficha do açude | 4 |
| `js/outros.js`, `js/cantareira.js`, `js/outros_sistemas.js`, `js/ficha_outros.js` | Outros Sistemas Hídricos: página do módulo, Sistema Cantareira, Distrito Federal e RMBH, ficha do reservatório | 5 |
| `js/dados.js` | área de dados (seleção, variáveis, período, prévia e arquivo) | 6 |
| `js/api.js` | documentação da API pública e especificação OpenAPI | 7 |
| `js/guia.js`, `css/guia.css` | guia de componentes (`#componentes`): cores e medidas lidas do CSS em uso, paletas dos dados e cada componente com o exemplo ao vivo e o código que o desenha | — |
| `js/admin/` | área administrativa (simulação) | 8 |
| `js/titulo_grafico_celular.js` | quebra em linhas do título do gráfico que não cabe no celular | 1 |
| `js/rotas.js` | rotas por hash (`#sin`, `#ne/CE`, `#ficha/FURNAS`…), montagem da barra lateral | 1 |
| `css/base.css` | variáveis de cor e fonte (`:root`, identidade visual da ANA) e regras de base | 1 |
| demais `css/*.css` | componentes, páginas e ajustes para celular, na ordem da cascata | — |

### Componentes comuns (use estes, não crie outros)

Todos aparecem, com exemplo e código, no guia de componentes (`#componentes`), montado pelo mesmo código das páginas.

- Gráficos (`js/graficos.js`): `graficoCalendario` (cada ano no mesmo calendário, com faixas de referência, também mês a
  mês), `graficoBarrasAnos` (mesmo dia em outros anos), `graficoLinhas` (série no período, eixos de tempo e cursor
  sincronizados entre gráficos), `graficoMonitoramento`, `graficoMensalMLT` (12 meses até a data contra a média de
  longo termo, com a faixa mínima–máxima opcional: Cantareira e vazão natural da ficha; as opções estão no comentário
  da função); `botoesAnos` (seleção de anos), `balao`/`posicionaBalao` (balão de informação), `alturaGraf` (altura por
  tipo de gráfico), `comoLer`/`ler` (texto "Como ler este gráfico", sempre o último elemento da seção). Os gráficos de
  linhas, calendário e barras aceitam `refs`, linhas de referência horizontais (capacidade, cota máxima) que entram na
  escala.
- Data de referência (`js/base.js`): `barraData` e `ligarData`, em todas as páginas que têm data.
- Cores: as da identidade visual e as de dados que se repetem entre arquivos (nível, verde-azulado e bronze dos módulos)
  ficam só no CSS (`css/base.css`, `:root`); o JavaScript as lê em `COR`, sem hexadecimal solto. As paletas de uso
  único (faixas de operação, variáveis de uma ficha, balanço do Cantareira) ficam num lugar só cada uma, junto de quem
  as usa.
- Textos: todo texto explicativo das páginas públicas é editável pela área administrativa; os textos originais vêm do
  próprio código: o `montar.py` os extrai, junto com a correspondência de códigos das fontes do Nordeste, para
  `dados_admin.json`, que a página publicada embute e a `dev.html` lê do servidor.

## Regras de negócio e testes

`js/regras.js` reúne o que decide números publicados, cada regra com a parte do Anexo I que a descreve:
a regra da data de referência do Nordeste (`medicaoNaJanela`, a medição mais próxima até 30 dias, com a anterior no
empate), a faixa de volume (`faixaPct`), o volume acumulado (`agregar`), as faixas de operação das resoluções da ANA
(`FAIXAS_ANA`, `faixasNaData`), as do Cantareira (`FAIXAS_OPERACAO_CAN`) e, na série do volume acumulado dos estados
e do Nordeste, o ponto mensal anterior (`mesAnterior`) e a interrupção da linha quando a troca de reservatórios medidos
passa do limiar (`pontoLigado`), a folga da variação em 30 dias (`FOLGA30`) e, no SIN, a retirada da vazão afluente
diária negativa da publicação (`retiraAfluenteNegativa`). A série é calculada na preparação dos dados (`preparar_serie_ne.py`: o valor de cada
dia pela regra da página, desde o ano inicial, com o número de reservatórios medidos, a capacidade equivalente e a
troca em relação ao mesmo dia do mês anterior); os dois critérios (ano inicial e limiar) são conferidos em
`../dados/confere_serie_ne.py`.

```
node --test testes/regras.test.mjs        # em mockups/prototipo
py testes/gera_fixture_janela.py          # quando preparar_ne.py ou os dados do Nordeste mudarem
```

Os testes importam o próprio módulo `js/regras.js`. Um deles compara, em mais de 30 mil casos (todos os reservatórios do
Nordeste, uma data a cada 5 dias), a medição escolhida pela página com a da função Python original (`na_data`, em
`preparar_ne.py`); outro reproduz o volume acumulado do Piauí na saída de Jenipapo da janela (junho de 2026) e confere
que a série mensal interrompe a linha nesse ponto; outro confere o ano inicial da série embutida.

A conferência das leituras de cota e nível (erro grosseiro, pico de um dia, degrau que volta) roda na preparação dos
dados, em Python (`../dados/critica_nivel.py`), e não na página.

## Verificação de mudanças

- `npm run verificar` (em `mockups/prototipo`, depois de `npm install`): formato pelo Prettier, sintaxe de cada arquivo de
  `js/`, ESLint e testes das regras. O ESLint (`eslint.config.mjs`) confere cada módulo sozinho: nome usado sem `import`
  é erro. Avisos esperados (oito em 25/09/2026): as duas funções um pouco acima de 120 linhas e seis com complexidade
  entre 26 e 29 (a escolha da rota, a série da área de dados, a situação da ficha do açude e três telas da área
  administrativa); os demais devem ficar em zero. Como a pasta está no OneDrive, convém instalar os
  pacotes do Node fora dela ou excluir `node_modules/` da sincronização.
- `auditoria.html` (servida junto com o protótipo): percorre as 56 páginas numa largura pedida (`?w=1366`, `?w=390`) e
  aponta erro no console, estouro de largura, rolagem interna, "undefined/NaN", numeração de seções e links quebrados;
  `&baixar=1` clica todos os botões de download.
- `ferramentas/regressao.py registrar <pasta>` e `comparar <antes> <depois>`: textos visíveis, arquivos baixados,
  auditoria em 1366 e 390 px e capturas das 56 páginas comparadas pixel a pixel.
- `ferramentas/mesma_ast.mjs <antes> <depois>`: confere que dois conjuntos de arquivos JS têm a mesma árvore sintática
  (depois de formatar com o Prettier, `.prettierrc.json`, largura 120).
- `ferramentas/mover.py` e `ferramentas/troca_funcao.py`: movem ou trocam funções entre arquivos sem reescrevê-las; depois
  de mover, acerte os `import` e `export` (o ESLint aponta o nome que ficou sem `import`).

## Dependências (carregadas de CDN)

Leaflet 1.9.4 (mapas), JSZip 3.10.2 (ZIP e KMZ), SheetJS 0.20.3 (XLSX, do CDN do próprio projeto; a 0.18.5 do cdnjs
tem falhas conhecidas na leitura de planilhas), jsPDF 2.5.1 e jsPDF-AutoTable 3.8.2 (PDF). Para o sistema, usar as
versões atuais do jsPDF (4.x) e do AutoTable (5.x): mudaram a forma de chamar e não foram trocadas no protótipo.

## Limitações do protótipo (não do sistema)

- O volume em hm³ do Nordeste vai embutido com uma casa decimal; o volume acumulado pode diferir em 0,1 ponto
  percentual do calculado com a série completa (Piauí, 28/05/2026: 67,7% na página, 67,8% no Anexo I). O sistema deve
  guardar e calcular com a precisão da fonte.
- A série do reservatório equivalente do SIN é a oficial do SAR desde 2000, publicada como está: tem degraus na virada
  de alguns anos e quedas de um ou dois dias (registrados em `estrutura/decisoes.md`, 22/09/2026).
- `historico/` guarda os scripts que construíram o protótipo por remendos (até 22/09/2026) e as cópias anteriores do
  código; são registro, não rodam mais.
