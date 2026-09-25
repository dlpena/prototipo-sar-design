/* Guia de componentes (#componentes): referência de estilo para o desenvolvimento, montada com o mesmo código das
   páginas. As cores e medidas são lidas das variáveis do CSS em uso; cada exemplo é uma função deste arquivo, desenhada
   ao vivo, e o código mostrado ao lado é o texto dessa mesma função: o guia não fica defasado em relação às páginas.
   Os exemplos usam dados embutidos reais (reservatório equivalente do SIN, Furnas). Não é página do público. */
import { D } from "./dados_embutidos.js";
import {
  $,
  $$,
  barraBaixar,
  barraData,
  COR,
  COR_NV_SEM,
  dBR,
  esc,
  fint,
  fmt,
  ligarData,
  ligarIndice,
  simbolo,
  toast
} from "./base.js";
import { FAIXAS_ANA, FAIXAS_OPERACAO_CAN } from "./regras.js";
import { baixarCSVGrafico, baixarPNG, LEG_ANOS, salvarCSV } from "./exportacao.js";
import { botoesAnos, comoLer, graficoBarrasAnos, graficoCalendario, graficoLinhas, ler, MAX_ANOS } from "./graficos.js";
import { FX, ordenavel } from "./ne.js";
import { bloco, cod, ligarCopiarAPI, tab } from "./api.js";

// para que serve cada variável de cor e de medida (a lista em si vem do CSS em uso, não daqui)
const USO_GUIA = {
  "--ana": "Marinho da ANA: títulos, navegação ativa, fio do cabeçalho de tabela, reservatório nos mapas.",
  "--ana-noite": "Fim do gradiente do bloco escuro (valor principal) e botão de ação sob o cursor.",
  "--ana-vivo": "Números de seção, símbolo % do valor principal, acentos gráficos. Não serve para texto sobre branco.",
  "--ana-claro":
    "Azul-claro do manual: detalhes gráficos (rótulo da bacia no mapa de navegação, traços do balanço do Cantareira).",
  "--ana-medio": "Só para links (o azul vivo não passa em contraste sobre branco).",
  "--ana-bruma": "Fundo de estado ativo e do botão secundário sob o cursor.",
  "--ana-gelo": "Fundo leve: código, linha aberta de tabela, item em foco.",
  "--tinta": "Texto principal.",
  "--tinta-2": "Texto de apoio (subtítulos, parágrafos explicativos).",
  "--apagado": "Texto secundário: notas, rótulos de eixo, unidades.",
  "--linha": "Fios e divisões.",
  "--linha-forte": "Contorno de campos e botões, marcas de eixo.",
  "--fundo": "Fundo da página.",
  "--branco": "Fundo dos painéis.",
  "--aviso": "Texto de aviso (área administrativa).",
  "--aviso-fundo": "Fundo de aviso (área administrativa e área de dados).",
  "--graf-azul-medio": "Ano anterior ao da data de referência nos gráficos, usina a fio d'água, açude só com nível.",
  "--graf-cinza-anos": "Demais anos nos gráficos de anos no mesmo calendário.",
  "--graf-vermelho": "Marca da data de referência nos gráficos e vazão vertida.",
  "--graf-nivel": "Nível e cota nas séries das fichas.",
  "--graf-verde": "Verde-azulado do Nordeste e do Distrito Federal.",
  "--graf-bronze": "Bronze de Outros Sistemas e da RMBH; usina nova na cascata.",
  "--graf-bronze-escuro": "Texto em bronze e transferência entre bacias no balanço do Cantareira.",
  "--mapa-rio": "Rios sobre o mapa-base.",
  "--mapa-rio-satelite": "Rios sobre a imagem de satélite.",
  "--sans": "Família do texto: Arial (manual da ANA, p. 10).",
  "--narrow": "Arial Narrow em textos compactos: rótulo da usina no mapa, nome do rio na tabela, diagrama da cascata.",
  "--cond": "Arial Narrow no título da página (h1) e no número das seções.",
  "--raio": "Canto dos painéis (seção).",
  "--sombra": "Sombra dos painéis.",
  "--lateral": "Largura da barra lateral no computador."
};

function paginaGuia() {
  const pag = { anos: {} }; // estado da página, passado às funções abaixo

  pag.S = D.equivalente.serie;
  pag.ini = Object.keys(pag.S).sort()[0];
  pag.ult = D.equivalente.ultimo_dia;
  pag.dia = pag.ult;
  pag.anosTodos = [...new Set(Object.keys(pag.S).map(k => +k.slice(0, 4)))].sort((a, b) => a - b);
  pag.tokens = tokensGuia();
  $("#titulo-pag").innerHTML = tituloGuia(pag);
  $("#conteudo").innerHTML = corpoGuia(pag);
  ligarIndice();
  ligarCopiarAPI(pag);
  exemplosGuia(pag);
  ligarData("dia-guia", pag.ini, pag.ult, iso => {
    if (pag.S[iso] == null) return;
    pag.dia = iso;
    exemploEquiv(pag);
    exemploGraficos(pag);
  });
}

// variáveis declaradas em :root nas folhas de estilo da página, com o valor e o número de usos no CSS
function tokensGuia() {
  const regras = [];
  for (const f of document.styleSheets) {
    try {
      regras.push(...f.cssRules);
    } catch {
      // folha de outra origem: não é lida
    }
  }
  const raiz = regras.filter(r => r.selectorText === ":root");
  const nomes = [...new Set(raiz.flatMap(r => [...r.style].filter(p => p.startsWith("--"))))];
  const texto = regras.map(r => r.cssText).join("\n");
  const css = getComputedStyle(document.documentElement);
  return nomes.map(n => ({
    n,
    v: css.getPropertyValue(n).trim(),
    usos: texto.split(`var(${n})`).length - 1,
    js: Object.entries(COR).find(([, c]) => c === css.getPropertyValue(n).trim())?.[0]
  }));
}

// contraste (WCAG 2.1) entre duas cores em hexadecimal
function contrasteGuia(a, b) {
  const lum = h => {
    const c = h
      .replace("#", "")
      .match(/../g)
      .map(x => parseInt(x, 16) / 255)
      .map(x => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

const tituloGuia = pag =>
  `
    <p class="trilha"><a href="#inicio">Início</a><span class="sep">›</span>Guia de componentes</p>
    <h1>Guia de componentes</h1>
    <p class="lead">Referência de estilo para o desenvolvimento do novo SAR: cores, fontes e componentes das páginas, cada um com o exemplo ao vivo, o código que o desenha e quando usar.</p>
    <div class="carimbo"><span><b>${pag.tokens.length}</b> variáveis no CSS</span><span>Exemplos com dados reais do SIN</span><span>Uso interno (desenvolvimento)</span></div>
    ${barraData("dia-guia", pag.ult, pag.ini, pag.ult, "Controle de data de referência: aqui ele muda os exemplos do valor principal e dos gráficos, como nas páginas.")}`;

const secaoGuia = (id, n, titulo, sub, corpo, baixar = "") =>
  `<section class="cartao secao" id="${id}" aria-labelledby="t-${id}">${baixar}
      <h2 id="t-${id}"><small${n > 9 ? ' class="n2"' : ""}>${n}</small>${titulo}</h2>
      <p class="sub">${sub}</p>${corpo}</section>`;

// um exemplo: o componente desenhado, o código que o desenha e a regra de uso
const exemploGuia = (id, fn, uso, rot = "Código") =>
  `<div class="api-bloco"><h3>Exemplo</h3><div class="guia-exemplo" id="${id}"></div></div>
   <div class="api-bloco"><h3>${rot}</h3>${bloco(fn.toString(), "o código do exemplo")}</div>
   <div class="api-bloco"><h3>Quando usar</h3><p class="api-txt" style="margin:0">${uso}</p></div>`;

const SECOES_GUIA = [
  ["g-uso", "Como usar"],
  ["g-cores", "Cores da identidade"],
  ["g-dados", "Cores dos dados"],
  ["g-fontes", "Fontes e medidas"],
  ["g-pagina", "Estrutura da página"],
  ["g-equiv", "Valor principal"],
  ["g-valores", "Cartões de valor"],
  ["g-controles", "Botões e controles"],
  ["g-tabela", "Tabelas"],
  ["g-graficos", "Gráficos"],
  ["g-mapas", "Símbolos dos mapas"],
  ["g-msg", "Mensagens"],
  ["g-export", "Exportação"]
];

const corpoGuia = pag =>
  `
    <section class="cartao intro" aria-label="Sobre o guia"><p>Este guia é montado pelo mesmo código das páginas do protótipo. As cores e medidas são lidas do CSS em uso, e o código mostrado em cada exemplo é o que desenhou o exemplo. Mudou o componente, muda o guia. Os arquivos estão em ${cod("mockups/prototipo/css/")} e ${cod("mockups/prototipo/js/")}; a visão geral do código, no ${cod("LEIA-ME.md")}.</p></section>
    <nav class="indice" aria-label="Seções da página">${SECOES_GUIA.map(([id, r]) => `<a href="#componentes" data-alvo="${id}">${r}</a>`).join("")}</nav>
    ${secaoGuia("g-uso", 1, "Como usar", "Regras que valem para todas as páginas, conferidas pela auditoria automática e pela regressão.", principiosGuia())}
    ${secaoGuia("g-cores", 2, "Cores da identidade", "Cores do Manual de Identidade Visual da ANA (2020) e as derivadas delas, como variáveis do CSS. O contraste é calculado sobre o branco dos painéis (texto comum pede 4,5 ou mais; texto grande e elementos gráficos, 3 ou mais).", coresGuia(pag))}
    ${secaoGuia("g-dados", 3, "Cores dos dados", "Paletas que codificam o dado: anos nos gráficos, faixas de volume do Nordeste, faixas de operação das resoluções da ANA e do Sistema Cantareira. Cada paleta fica num lugar só do código, junto da regra que a usa.", paletasGuia())}
    ${secaoGuia("g-fontes", 4, "Fontes e medidas", "Arial no texto e Arial Narrow no título e nos números de tabela, com algarismos de mesma largura. Nada de fonte externa ou embutida.", fontesGuia(pag))}
    ${secaoGuia("g-pagina", 5, "Estrutura da página", "Toda página escreve o título (trilha, h1 e carimbo com os dados do dia) e o conteúdo (índice e seções numeradas). No computador, o índice e o controle de data vão para a barra lateral; no celular, ficam no alto do conteúdo.", exemploGuia("ex-pagina", exemploPagina, 'Em toda página. O número da seção vem de <code class="in">h2 &gt; small</code> (o CSS acrescenta o zero; da 10ª seção em diante, <code class="in">small.n2</code>, sem o zero); o índice lista as seções na mesma ordem; o texto de apresentação (<code class="in">.intro</code>) fica sem cartão, na largura toda.'))}
    ${secaoGuia("g-equiv", 6, "Valor principal", 'O número que resume a página, com a data e as comparações. A seção que tem o <code class="in">.equiv</code> como filho direto fica em azul-marinho automaticamente (<code class="in">.secao:has(&gt; .equiv)</code>): é o único bloco escuro da página.', exemploGuia("ex-equiv", exemploEquiv, "Uma vez por página, só para o valor que a página existe para mostrar (reservatório equivalente, volume acumulado do estado). Muda com a data de referência."))}
    ${secaoGuia("g-valores", 7, "Cartões de valor", "Valores de um reservatório num dia, lado a lado, o primeiro em destaque.", exemploGuia("ex-valores", exemploValores, "Na situação da ficha do reservatório. As comparações vão na linha de baixo de cada cartão, com o período escrito."))}
    ${secaoGuia("g-controles", 8, "Botões e controles", "Botão de ação, botões de período, botões de ano e controle de data de referência.", exemploGuia("ex-controles", exemploControles, `Botão de ação (<code class="in">.acao</code>) para o passo principal da tela, e <code class="in">.acao.sec</code> para os secundários; botões de período (<code class="in">.preset</code>) para intervalos prontos; botões de ano (<code class="in">botoesAnos</code>) nos gráficos de anos, até ${MAX_ANOS} ao mesmo tempo. O controle de data (<code class="in">barraData</code> e <code class="in">ligarData</code>) fica no título da página: o desta página está lá.`))}
    ${secaoGuia("g-tabela", 9, "Tabelas", "Cabeçalho em versalete cinza com fio marinho, linha de unidades, números à direita em Arial Narrow e nome em marinho. Clique no cabeçalho ordena.", exemploGuia("ex-tabela", exemploTabela, 'Em toda lista de reservatórios. Unidade sempre na linha própria (<code class="in">tr.unid</code>), nunca no cabeçalho; a tabela exporta em CSV e em PDF.'), barraBaixar([["guia-tab-csv", "CSV", "Baixar a tabela em CSV"]]))}
    ${secaoGuia(
      "g-graficos",
      10,
      "Gráficos",
      'Um componente por tipo, com altura por família (<code class="in">alturaGraf</code>) e o texto "Como ler este gráfico" sempre no fim da seção.',
      graficosGuia(),
      barraBaixar([
        ["guia-graf-csv", "CSV", "Baixar os dados do gráfico em CSV"],
        ["guia-graf-png", "PNG", "Baixar o gráfico como imagem"]
      ])
    )}
    ${secaoGuia("g-mapas", 11, "Símbolos dos mapas", "Símbolo pelo tipo do reservatório, não pelo valor, nos mapas do SIN e de Outros Sistemas; no Nordeste, a cor é a faixa de volume.", exemploGuia("ex-mapas", exemploMapas, "Triângulo marinho para reservatório, círculo azul-médio para usina a fio d'água; no Nordeste, círculo na cor da faixa (tamanho pela capacidade) e seta de tendência para o açude só com nível. Mapa com mapa-base tem canto de 10 px e exporta em KMZ, menos nas fichas."))}
    ${secaoGuia("g-msg", 12, "Mensagens", "Aviso passageiro, nota e ausência de dado.", exemploGuia("ex-msg", exemploMensagens, 'Aviso passageiro (<code class="in">toast</code>) para confirmar uma ação ou explicar por que ela não foi feita; nota (<code class="in">.nota</code>) para fonte, cobertura e limitação; ausência de dado escrita por extenso, com a data, nunca célula vazia.'))}
    ${secaoGuia("g-export", 13, "Exportação", 'Formato por tipo de elemento, sempre no canto superior direito da seção (<code class="in">barraBaixar</code>), nunca no título da página.', exportGuia())}
    <p class="nota fontes-inicio">Fontes dos exemplos: ${esc(D.fontes.equivalente)}; ${esc(D.fontes.medicoes)}.</p>`;

const principiosGuia = () =>
  `<ul class="api-passos">
      <li><b>Um componente por tipo.</b> Componente novo copia a marcação e as classes de um equivalente que já existe; não se cria outro.</li>
      <li><b>Cor só das variáveis.</b> No CSS, <code class="in">var(--nome)</code>; no JavaScript, o objeto <code class="in">COR</code>, que lê as mesmas variáveis. Nada de cor nova: deriva-se das existentes.</li>
      <li><b>Estilo que se repete vai para o CSS</b>, não para a marcação da página.</li>
      <li><b>Computador e celular.</b> Conferir em 1366 e em 390 px de largura; nenhuma área com barra de rolagem interna.</li>
      <li><b>Texto explicativo</b> na largura toda, com a instrução de uso em linha própria (<code class="in">.dica</code>) e o método em "Como ler este gráfico" ou "Saiba mais".</li>
      <li><b>Número publicado</b> com a regra em <code class="in">js/regras.js</code>, coberta por teste.</li></ul>`;

function coresGuia(pag) {
  const cores = pag.tokens.filter(t => /^#[0-9a-f]{6}$/i.test(t.v));
  return tab(
    ["7%", "22%", "12%", "12%", ""],
    ["Cor", "Variável", "Valor", "Contraste", "Uso"],
    cores.map(t => {
      const k = contrasteGuia(t.v, COR.branco);
      return [
        `<span class="guia-amostra" style="background:var(${t.n})"></span>`,
        `<code class="in">${t.n}</code>${t.js ? `<br><span class="nota">COR.${t.js}</span>` : ""}`,
        `<span class="num">${t.v.toUpperCase()}</span>`,
        `<span class="num">${fmt(k, 1)}</span>${k < 3 ? '<br><span class="nota">só fundo ou fio</span>' : k < 4.5 ? '<br><span class="nota">texto grande ou gráfico</span>' : ""}`,
        `${esc(USO_GUIA[t.n] || "Sem descrição neste guia.")}${t.usos || t.js ? "" : ' <span class="nota">(sem uso no CSS)</span>'}`
      ];
    })
  );
}

const legendaGuia = itens =>
  `<div class="legenda">${itens
    .map(
      ([cor, rot]) =>
        `<span>${[cor]
          .flat()
          .map(c => `<i class="bola" style="background:${c}"></i>`)
          .join("")}${esc(rot)}</span>`
    )
    .join("")}</div>`;

// faixas de operação (objetos com cor, fundo e rótulo) em qualquer nível da estrutura das resoluções, uma por cor
function faixasGuia(x, achadas = new Map()) {
  if (Array.isArray(x)) x.forEach(y => faixasGuia(y, achadas));
  else if (x && typeof x === "object") {
    if (x.cor && x.fundo && x.rot && !achadas.has(x.cor)) achadas.set(x.cor, x);
    Object.values(x).forEach(y => faixasGuia(y, achadas));
  }
  return [...achadas.values()];
}

const ORDEM_FAIXAS = ["Normal", "Atenção", "Alerta", "Restrição"];

const paletasGuia = () =>
  `<div class="api-bloco"><h3>Anos nos gráficos</h3>${legendaGuia([
    [COR.ana, "Ano da data de referência"],
    [COR.azulMedio, "Ano anterior"],
    [COR.cinzaAnos, "Demais anos"],
    [COR.vermelho, "Marca da data de referência"]
  ])}</div>
    <div class="api-bloco"><h3>Faixas de volume do Nordeste e Semiárido</h3>${legendaGuia(Object.values(FX).map(f => [f.cor, f.rot]))}</div>
    <div class="api-bloco"><h3>Açude só com nível</h3>${legendaGuia([
      [COR.azulMedio, "Com leitura na janela"],
      [COR_NV_SEM, "Sem leitura na janela"]
    ])}</div>
    <div class="api-bloco"><h3>Faixas de operação das resoluções da ANA (linha e fundo)</h3>${legendaGuia(
      faixasGuia(FAIXAS_ANA)
        .sort((a, b) => ORDEM_FAIXAS.findIndex(k => a.rot.includes(k)) - ORDEM_FAIXAS.findIndex(k => b.rot.includes(k)))
        .map(f => [[f.cor, f.fundo], f.rot.replace(/ \(.*/, "")])
    )}</div>
    <div class="api-bloco"><h3>Faixas de operação do Sistema Cantareira</h3>${legendaGuia(FAIXAS_OPERACAO_CAN.map(f => [f.cor, f.rot]))}</div>
    <p class="nota" style="margin:10px 0 0">As resoluções da ANA usam as mesmas quatro cores, e o Sistema Cantareira as repete, com a Faixa 5 a mais; o fundo claro de cada faixa é o que aparece atrás das curvas.</p>`;

const fontesGuia = pag =>
  `${tab(
    ["22%", "22%", ""],
    ["Variável", "Valor", "Uso"],
    pag.tokens
      .filter(t => !/^#[0-9a-f]{6}$/i.test(t.v) && t.n !== "color-scheme")
      .map(t => [
        `<code class="in">${t.n}</code>`,
        `<code class="in">${esc(t.v)}</code>`,
        esc(USO_GUIA[t.n] || "Sem descrição neste guia.")
      ])
  )}
    <div class="api-bloco"><h3>Hierarquia do texto</h3><div class="guia-exemplo">
      <h1 style="margin:0 0 6px">Título da página (h1)</h1>
      <h2 style="margin:0 0 4px"><small>1</small>Título de seção (h2)</h2>
      <p class="sub" style="margin:0">Subtítulo da seção (.sub), com o que a seção mostra.<span class="dica">Instrução de uso (.dica), em linha própria.</span></p>
      <p class="nota" style="margin:8px 0 0">Nota (.nota): fonte, cobertura e limitação.</p></div></div>`;

const graficosGuia = () =>
  `<div class="api-bloco"><h3>Anos no mesmo calendário (graficoCalendario)</h3>
      <div class="controles"><fieldset class="anos"><legend>Anos <span class="nota" id="nota-anos-guia"></span></legend><span id="anos-chips-guia"></span></fieldset></div>
      <div class="graf" id="g-guia-cal"></div></div>
    <div class="api-bloco"><h3>Mesmo dia em outros anos (graficoBarrasAnos)</h3><div class="graf" id="g-guia-barras"></div></div>
    <div class="api-bloco"><h3>Série no período (graficoLinhas): Furnas, volume útil nos 12 meses até a data</h3><div class="graf" id="g-guia-linhas"></div></div>
    <div class="api-bloco"><h3>Código</h3>${bloco(exemploGraficos.toString(), "o código dos gráficos")}</div>
    <div class="api-bloco"><h3>Quando usar</h3><p class="api-txt" style="margin:0">Calendário para comparar o ano com os anteriores (altura principal); barras para o mesmo dia em cada ano; linhas para a série no período, com eixo de tempo e cursor sincronizados entre os gráficos da seção. As linhas de referência (capacidade, cota máxima) entram pela opção <code class="in">refs</code>, e a escala se ajusta para mostrá-las. Os três gráficos exportam em CSV e em PNG.</p></div>
    ${comoLer(ler("anos"), ler("selecao"), ler("cursor"), ler("dia"))}`;

const exportGuia = () =>
  tab(
    ["22%", "18%", "30%", ""],
    ["Elemento", "Formato", "Função", "Conteúdo"],
    [
      [
        "Tabela",
        "CSV e PDF",
        "salvarCSV, pdfSecao, pdfTabelaDOM",
        "CSV com BOM, ponto e vírgula, vírgula decimal e data dd/mm/aaaa; PDF com título, fonte e data de geração."
      ],
      [
        "Gráfico",
        "CSV e PNG",
        "guardaCSV (no gráfico), baixarCSVGrafico, baixarPNG",
        "PNG com título, texto da seção, legenda, fonte e data de geração."
      ],
      ["Diagrama (cascata, balanço)", "PNG", "baixarPNG", "Mesmo desenho da página."],
      [
        "Mapa com mapa-base",
        "KMZ",
        "montarKMZ",
        "Pastas por grupo, legenda do próprio mapa (legenda.png) e ícones com a forma e a cor da página. Os mapas desenhados, de navegação, e os das fichas não exportam."
      ]
    ].map(l => [esc(l[0]), esc(l[1]), l[2].split(", ").map(cod).join(", "), esc(l[3])])
  ) +
  `<p class="nota" style="margin:10px 0 0">Nome do arquivo: ${cod("sar_<página>_<conteúdo>_<data>.<formato>")}, com a data de referência quando o conteúdo depende dela.</p>`;

// ---------------------------------------------------------------- exemplos (o código mostrado é o destas funções)

function exemplosGuia(pag) {
  exemploPagina();
  exemploEquiv(pag);
  exemploValores();
  exemploControles();
  exemploTabela();
  exemploGraficos(pag);
  exemploMapas();
  exemploMensagens();
}

function exemploPagina() {
  $("#ex-pagina").innerHTML = `
    <p class="trilha"><a href="#inicio">Início</a><span class="sep">›</span><a href="#sin">Módulo</a><span class="sep">›</span>Página</p>
    <h1 style="margin:0 0 6px">Nome da página</h1>
    <div class="carimbo"><span>Dados do dia <b>${dBR(D.data)}</b></span><span>Base diária</span></div>
    <section class="cartao secao" style="margin:14px 0 0">
      <h2><small>1</small>Título da seção</h2>
      <p class="sub">O que a seção mostra.<span class="dica">Como usar a seção.</span></p>
    </section>`;
}

function exemploEquiv(pag) {
  const d = pag.dia,
    v = pag.S[d],
    v30 = pag.S[new Date(Date.parse(d) - 30 * 864e5).toISOString().slice(0, 10)],
    vAno = pag.S[+d.slice(0, 4) - 1 + d.slice(4)];
  const dif = (a, b) => (a == null || b == null ? "–" : `${a - b >= 0 ? "+" : "−"}${fmt(Math.abs(a - b), 1)} p.p.`);
  // .equiv como filho direto da seção: é o que deixa a seção em azul-marinho (.secao:has(> .equiv))
  $("#ex-equiv").innerHTML = `
    <div class="cartao secao" style="margin:0">
      <h2><small>2</small>Reservatório equivalente do SIN</h2>
      <p class="sub">O volume útil das usinas com reservatório, agregado num único reservatório equivalente.</p>
      <div class="equiv">
        <div class="lado">
          <div class="valor num">${fmt(v, 1)}<small>%</small></div>
          <div class="quando">volume útil armazenado em ${dBR(d)}</div>
        </div>
        <ul class="comparacoes">
          <li><span>Em 30 dias</span><b class="num">${dif(v, v30)}</b></li>
          <li><span>Mesmo dia de ${+d.slice(0, 4) - 1}</span><b class="num">${vAno == null ? "–" : fmt(vAno, 1) + "%"}</b></li>
        </ul>
      </div>
    </div>`;
}

function exemploValores() {
  const [data, cota, afl, defl, , , , vu] = D.ficha.diario[D.ficha.diario.length - 1];
  $("#ex-valores").innerHTML = `
    <div class="valores">
      <div class="v principal"><div class="r">Volume útil</div><div class="n num">${fmt(vu, 1)}<small>%</small></div>
        <div class="c"><span>Furnas em ${dBR(data)}</span></div></div>
      <div class="v"><div class="r">Nível</div><div class="n num">${fmt(cota, 2)}<small>m</small></div></div>
      <div class="v"><div class="r">Afluente</div><div class="n num">${fint(afl)}<small>m³/s</small></div></div>
      <div class="v"><div class="r">Defluente</div><div class="n num">${fint(defl)}<small>m³/s</small></div></div>
    </div>`;
}

function exemploControles() {
  $("#ex-controles").innerHTML = `
    <p style="display:flex;gap:8px;flex-wrap:wrap;margin:0 0 12px">
      <button type="button" class="acao" id="guia-acao">Baixar dados</button>
      <button type="button" class="acao sec">Limpar filtros</button>
      <button type="button" class="acao" disabled>Indisponível</button></p>
    <p class="presets" style="margin:0 0 12px">${["30 dias", "12 meses", "5 anos"]
      .map((r, i) => `<button type="button" class="preset${i === 1 ? " ativo" : ""}">${r}</button>`)
      .join("")}</p>
    <div class="controles"><fieldset class="anos"><legend>Anos <span class="nota" id="nota-anos-ex"></span></legend><span id="anos-ex"></span></fieldset></div>`;
  $("#guia-acao").onclick = () => toast("Ação principal acionada.");
  $$("#ex-controles .preset").forEach(
    b =>
      (b.onclick = () => {
        $$("#ex-controles .preset").forEach(x => x.classList.toggle("ativo", x === b));
      })
  );
  const est = {};
  const anos = [2022, 2023, 2024, 2025, 2026];
  const desenhar = () => botoesAnos($("#anos-ex"), $("#nota-anos-ex"), anos, est, 2026, desenhar);
  desenhar();
}

function exemploTabela() {
  const linhas = D.grande.res.slice(0, 6).map(r => {
    const p = r.serie[r.serie.length - 1];
    return { nome: r.nome, tipo: r.tipo, cota: p.cota, defl: p.defl, vu: r.tipo === "fio" ? null : p.vu, data: p.data };
  });
  $("#ex-tabela").innerHTML = `<div class="tab-box"><table id="tab-guia">
      <thead><tr><th data-ord="nome">Usina</th><th class="r" data-ord="cota" data-tipo="num">Nível</th><th class="r" data-ord="defl" data-tipo="num">Defluente</th><th class="r" data-ord="vu" data-tipo="num">Volume útil</th></tr>
      <tr class="unid"><th></th><th class="r">m</th><th class="r">m³/s</th><th class="r">%</th></tr></thead>
      <tbody id="corpo-guia"></tbody></table></div>
    <p class="nota" style="margin:8px 0 0">Seis usinas da bacia do Grande em ${dBR(linhas[0].data)}.</p>`;
  const desenhar = L =>
    ($("#corpo-guia").innerHTML = L.map(
      r =>
        `<tr><td><span class="nm">${esc(r.nome)}</span></td><td class="r num">${fmt(r.cota, 2)}</td><td class="r num">${fint(r.defl)}</td><td class="r num">${r.vu == null ? "–" : fmt(r.vu, 1)}</td></tr>`
    ).join(""));
  ordenavel($("#tab-guia"), linhas, desenhar);
  desenhar(linhas);
  $("#guia-tab-csv").onclick = () =>
    salvarCSV(
      ["usina", "data", "nivel_m", "defluente_m3s", "volume_util_pct"],
      linhas.map(r => [r.nome, dBR(r.data), r.cota, r.defl, r.vu]),
      "sar_guia_tabela.csv"
    );
}

function exemploGraficos(pag) {
  const d = pag.dia,
    anoR = +d.slice(0, 4);
  // anos no mesmo calendário: os anos selecionados até a data de referência
  const anos = botoesAnos($("#anos-chips-guia"), $("#nota-anos-guia"), pag.anosTodos, pag.anos, anoR, () =>
    exemploGraficos(pag)
  );
  const pts = {};
  Object.keys(pag.S).forEach(k => {
    if (k <= d && anos.includes(+k.slice(0, 4))) pts[k] = pag.S[k];
  });
  graficoCalendario($("#g-guia-cal"), pts, {
    colCSV: "volume_util_pct",
    anos,
    anoAtual: anoR,
    dec: 1,
    unidade: "%",
    pct: true,
    marcaDia: d,
    rotulo: "Reservatório equivalente do SIN (%)",
    maxVao: 3,
    tol: 1
  });
  // mesmo dia em cada ano
  const barras = pag.anosTodos
    .filter(a => a <= anoR && pag.S[a + d.slice(4)] != null)
    .map(a => ({ a, v: pag.S[a + d.slice(4)], data: dBR(a + d.slice(4)), rot: dBR(a + d.slice(4)) }));
  graficoBarrasAnos($("#g-guia-barras"), barras, {
    anoAtual: anoR,
    dec: 1,
    unidade: "%",
    pct: true,
    colCSV: "volume_util_pct",
    rotulo: `Reservatório equivalente do SIN em ${dBR(d).slice(0, 5)} de cada ano (%)`,
    legenda: "Reservatório equivalente"
  });
  // série no período: Furnas, 12 meses até a data de referência
  const t1 = Date.parse(d + "T00:00:00Z"),
    t0 = t1 - 365 * 864e5;
  const S = D.ficha.diario
    .map(l => ({ t: Date.parse(l[0] + "T00:00:00Z"), vu: l[7] }))
    .filter(p => p.t >= t0 && p.t <= t1);
  graficoLinhas($("#g-guia-linhas"), S, [{ k: "vu", r: "Volume útil", cor: COR.ana, u: "%", dec: 1 }], {
    base: "dia",
    unidade: "%",
    altura: "apoio",
    sync: {}, // eixo de tempo e cursor comuns aos gráficos da seção (aqui, um só)
    escala: [0, 100],
    t0,
    t1,
    rotulo: "Furnas, volume útil (%)"
  });
  $("#guia-graf-csv").onclick = () => baixarCSVGrafico([$("#g-guia-cal")], `sar_guia_ao_longo_do_ano_ate_${d}.csv`);
  $("#guia-graf-png").onclick = () =>
    baixarPNG(
      [$("#g-guia-cal svg")],
      `sar_guia_ao_longo_do_ano_ate_${d}.png`,
      `Reservatório equivalente do SIN ao longo do ano · até ${dBR(d)}`,
      LEG_ANOS(anoR)
    );
}

function exemploMapas() {
  const nivel = cor =>
    `<svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2 L14 12 L2 12 Z" fill="${cor}" stroke="${COR.branco}" stroke-width="1.4"/></svg>`;
  $("#ex-mapas").innerHTML = `<div class="legenda">
      <span>${simbolo("res", 14)}Usina ou reservatório com volume</span>
      <span>${simbolo("fio", 14)}Usina a fio d'água</span>
      ${Object.values(FX)
        .map(f => `<span><i class="bola" style="background:${f.cor}"></i>Açude: ${esc(f.rot)}</span>`)
        .join("")}
      <span>${nivel(COR.azulMedio)}Açude só com nível (seta da tendência)</span>
    </div>`;
}

function exemploMensagens() {
  $("#ex-msg").innerHTML = `
    <p style="margin:0 0 10px"><button type="button" class="acao sec" id="guia-toast">Mostrar aviso passageiro</button></p>
    <p class="nota" style="margin:0 0 6px">Fonte: ONS, dados diários, até ${dBR(D.data)}.</p>
    <p class="api-txt" style="margin:0">Sem registro na base diária em dd/mm/aaaa.</p>`;
  $("#guia-toast").onclick = () => toast("Copiado.");
}

export { paginaGuia };
