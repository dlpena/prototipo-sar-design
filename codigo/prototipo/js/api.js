/* Documentação da API pública (#api): primeiros passos, consultas, respostas em JSON e em CSV, exemplos, limites e
   especificação OpenAPI. Endereço, limites, licença e contato são ilustrativos ou a definir com a STI; os exemplos saem
   das séries embutidas. */
import { D, SD } from "./dados_embutidos.js";
import { $, $$, barraBaixar, dBR, esc, ligarIndice, toast } from "./base.js";
import { baixarArquivo } from "./exportacao.js";
import { isoMais } from "./outros.js";
import { CAT_VARS, entidadesDados, serieDados } from "./dados.js";

const API_BASE = "https://endereco-do-sar/api/v1";
function paginaAPI() {
  const pag = {}; // estado da página, passado às funções abaixo

  exemploAPI(pag);
  // consultas: a mesma lista gera a tabela e o arquivo OpenAPI
  catalogoAPI(pag);
  $("#titulo-pag").innerHTML = tituloAPI();
  $("#conteudo").innerHTML = corpoAPI(pag);
  ligarIndice();
  ligarCopiarAPI(pag);
  // especificação OpenAPI gerada da mesma lista de consultas e parâmetros
  ligarOpenAPI(pag);
}

// exemplo de consulta e de resposta (Furnas, três últimos dias), em JSON e em CSV
function exemploAPI(pag) {
  const ENT = entidadesDados(),
    FUR = ENT.find(e => e.mod === "SIN" && String(e.codigo) === "19004");
  pag.ate = D.data;
  pag.de = isoMais(pag.ate, -2);
  const VX = ["cota_m", "volume_util_pct"];
  const UN = Object.fromEntries(CAT_VARS.map(v => [v.k, v.u]));
  const linhas = [];
  serieDados(FUR, "dia", pag.de, pag.ate).forEach(p =>
    VX.forEach(k => {
      if (p.v[k] != null) linhas.push({ reservatorio: 19004, data: p.t, variavel: k, valor: p.v[k], unidade: UN[k] });
    })
  );
  pag.qEx = `${API_BASE}/series?reservatorios=19004&variaveis=${VX.join(",")}&inicio=${pag.de}&fim=${pag.ate}`;
  pag.json =
    `{\n  "versao_dados": "${pag.ate}T00:00:00-03:00",\n  "consulta": {"reservatorios": [19004], "variaveis": ${JSON.stringify(VX).replace(/,/g, ", ")}, "inicio": "${pag.de}", "fim": "${pag.ate}", "base": "diaria"},\n` +
    `  "pagina": 1, "paginas": 1, "linhas": ${linhas.length},\n  "dados": [\n` +
    linhas.map(l => `    ${JSON.stringify(l).replace(/,"/g, ', "').replace(/":/g, '": ')}`).join(",\n") +
    `\n  ]\n}`;
  pag.csv = [
    "reservatorio,data,variavel,valor,unidade",
    ...linhas.map(l => [l.reservatorio, l.data, l.variavel, l.valor, l.unidade].join(","))
  ].join("\n");
}

// consultas, parâmetros, limites e mensagens de erro: a mesma lista gera a página e o arquivo OpenAPI
function catalogoAPI(pag) {
  pag.CONS = [
    {
      p: "/reservatorios",
      r: "Reservatórios",
      d: "Lista de reservatórios e estações: código, nome, módulo (e sistema), UF, município, bacia ou sistema, tipo, modo de exibição (com volume, só nível ou retirado do acompanhamento), coordenadas, capacidade vigente, variáveis que tem, início da série e data da última leitura.",
      q: [
        ["modulo", "sin, nordeste ou outros"],
        ["uf", "sigla do estado"],
        ["bacia", "nome da bacia ou do sistema"],
        ["busca", "parte do nome, do código ou do município, sem acento"]
      ]
    },
    {
      p: "/reservatorios/{codigo}",
      r: "Um reservatório",
      d: "O cadastro de um reservatório com o histórico do que tem vigência: capacidade, curva cota-volume, modo de exibição e composição de agrupamento, cada um com a data de início.",
      q: []
    },
    {
      p: "/variaveis",
      r: "Variáveis",
      d: "O catálogo de variáveis: nome da coluna, nome, unidade, definição, módulos em que existe e se há base horária. É o mesmo dicionário da área de dados.",
      q: []
    },
    {
      p: "/series",
      r: "Séries",
      d: "A série de um ou mais reservatórios, no formato longo: uma linha por reservatório, data e variável.",
      q: []
    },
    {
      p: "/agregados",
      r: "Agregados",
      d: `As séries que as páginas publicam como número do conjunto: reservatório equivalente do SIN (volume útil, em %); volume acumulado do Nordeste e Semiárido e de cada estado (calculado em cada data pela regra da página, desde ${SD.ano_inicial}, com o número de reservatórios medidos e a capacidade equivalente de cada data); volume útil do Sistema Cantareira.`,
      q: [
        ["indicador", "sin_equivalente, ne_acumulado ou cantareira"],
        ["uf", "estado, no volume acumulado (sem uf, o Nordeste)"],
        ["inicio", "data inicial"],
        ["fim", "data final"],
        ["formato", "json ou csv"]
      ]
    }
  ];
  pag.PARS = [
    [
      "reservatorios",
      "Códigos dos reservatórios, separados por vírgula (os mesmos da ficha e da área de dados).",
      "19004,12112",
      "obrigatório"
    ],
    [
      "variaveis",
      "Nomes das colunas do catálogo, separados por vírgula.",
      "cota_m,volume_util_pct",
      "todas as que cada reservatório tem"
    ],
    ["inicio", "Data inicial (aaaa-mm-dd).", pag.de, "início da série"],
    ["fim", "Data final (aaaa-mm-dd).", pag.ate, "dado mais recente"],
    [
      "base",
      "diaria ou horaria. A horária existe só para as usinas do SIN, desde 01/01/2010, até 1 ano por consulta.",
      "horaria",
      "diaria"
    ],
    ["formato", "json ou csv.", "csv", "json"],
    ["pagina", "Página da resposta, quando a consulta passa do limite de linhas por página.", "2", "1"],
    [
      "versao",
      "Versão dos dados (data e hora de uma carga anterior): devolve a série como estava naquela versão.",
      `${pag.ate}T00:00:00-03:00`,
      "a versão em vigor"
    ]
  ];
  pag.LIM = [
    ["Linhas por página", "a definir com a STI"],
    ["Consultas por minuto, por endereço de origem", "a definir com a STI"],
    ["Período por consulta na base horária", "1 ano"]
  ];
  pag.ERR = [
    ["400", "Parâmetro inválido ou fora da regra.", 'A variável "volume" não existe. Os nomes estão em /v1/variaveis.'],
    ["404", "Reservatório, consulta ou versão inexistente.", "Reservatório 99999 não encontrado."],
    ["429", "Limite de consultas por minuto atingido.", "Limite de consultas atingido. Tente de novo em 30 segundos."],
    ["503", "Serviço fora do ar ou em manutenção.", "Serviço em manutenção. Tente de novo em alguns minutos."]
  ];
}

// botões de copiar dos blocos de exemplo
function ligarCopiarAPI(pag) {
  $$("[data-copiar]").forEach(
    b =>
      (b.onclick = () => {
        const t = b.parentElement.querySelector("code").textContent;
        navigator.clipboard &&
          navigator.clipboard.writeText(t).then(
            () => toast("Copiado."),
            () => toast("Não foi possível copiar.")
          );
      })
  );
}

// download da especificação OpenAPI, gerada da mesma lista de consultas e parâmetros
function ligarOpenAPI(pag) {
  $("#baixar-openapi").onclick = () => {
    const par = (n, d, obr) => ({ name: n, in: "query", required: !!obr, description: d, schema: { type: "string" } });
    const LINHA_API = {
      type: "object",
      properties: {
        reservatorio: { type: "integer" },
        data: { type: "string", description: "aaaa-mm-dd; na base horária, data_hora aaaa-mm-ddThh:mm" },
        variavel: { type: "string" },
        valor: { type: "number" },
        unidade: { type: "string" }
      }
    };
    const paths = {};
    pag.CONS.forEach(c => {
      const params =
        c.p === "/series" ? pag.PARS.map(p => par(p[0], p[1], p[3] === "obrigatório")) : c.q.map(([k, t]) => par(k, t));
      if (c.p.includes("{codigo}"))
        params.push({
          name: "codigo",
          in: "path",
          required: true,
          description: "Código do reservatório no SAR.",
          schema: { type: "integer" }
        });
      paths[c.p] = {
        get: {
          summary: c.r,
          description: c.d,
          parameters: params,
          responses: {
            "200": {
              description: "Consulta atendida.",
              content: {
                "application/json": {
                  schema:
                    c.p === "/series"
                      ? {
                          type: "object",
                          properties: {
                            versao_dados: { type: "string" },
                            pagina: { type: "integer" },
                            paginas: { type: "integer" },
                            linhas: { type: "integer" },
                            dados: { type: "array", items: LINHA_API }
                          }
                        }
                      : { type: "object" }
                },
                "text/csv": { schema: { type: "string" } }
              }
            },
            ...Object.fromEntries(pag.ERR.map(e => [e[0], { description: e[1] }]))
          }
        }
      };
    });
    const spec = {
      openapi: "3.0.3",
      info: {
        title: "SAR – API pública",
        version: "1.0.0",
        description:
          "Séries do Sistema de Acompanhamento de Reservatórios (ANA). Acesso aberto, sem cadastro. Protótipo: endereço e limites ilustrativos."
      },
      servers: [{ url: API_BASE, description: "endereço ilustrativo" }],
      paths
    };
    baixarArquivo(new Blob([JSON.stringify(spec, null, 2)], { type: "application/json" }), "sar_api_v1_openapi.json");
    toast("Especificação gerada. (Na página publicada no claude.ai o download é bloqueado; abra o arquivo local.)");
  };
}

const bloco = (txt, rot) =>
  `<div class="api-box bloco"><code>${esc(txt)}</code><button type="button" data-copiar aria-label="Copiar ${rot}">Copiar</button></div>`;

const cod = t => `<code class="in">${esc(t)}</code>`;

const tab = (
  cols,
  cab,
  L
) => `<div class="tab-box"><table class="tab-api"><colgroup>${cols.map(w => `<col${w ? ` style="width:${w}"` : ""}>`).join("")}</colgroup>
    <thead><tr>${cab.map(c => `<th>${c}</th>`).join("")}</tr></thead>
    <tbody>${L.map(l => `<tr>${l.map((c, i) => `<td${i ? ` data-r="${cab[i]}"` : ""}>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;

const tituloAPI = () =>
  `
    <p class="trilha"><a href="#inicio">Início</a><span class="sep">›</span><a href="#dados">Área de dados</a><span class="sep">›</span>API pública</p>
    <h1>API pública</h1>
    <p class="lead">Acesso por programa às mesmas séries da área de dados, para quem precisa de volume grande ou de atualização automática. Aberta: não pede cadastro nem chave.</p>
    <div class="carimbo"><span>Versão em vigor <b>v1</b></span><span>Acesso aberto, sem cadastro</span><span>JSON e CSV</span><span>Base diária; horária no SIN</span></div>`;

const corpoAPI = pag =>
  `
    <section class="cartao intro" aria-label="Sobre a API"><p>A API devolve as mesmas séries que a área de dados entrega em arquivo: os mesmos reservatórios, o mesmo catálogo de variáveis e a mesma série conferida, com as correções da área técnica. Cada resposta traz a data da versão dos dados, e a mesma consulta, na mesma versão, devolve sempre os mesmos dados. Para baixar uma planilha sem programar, use a <a href="#dados">área de dados</a>, que mostra a consulta equivalente de cada pedido.</p></section>
    <nav class="indice" aria-label="Seções da página"><a href="#api" data-alvo="a-passos">Primeiros passos</a><a href="#api" data-alvo="a-cons">Consultas</a><a href="#api" data-alvo="a-serie">Parâmetros da série</a><a href="#api" data-alvo="a-resp">Resposta</a><a href="#api" data-alvo="a-ex">Exemplos</a><a href="#api" data-alvo="a-lim">Limites, versões e erros</a><a href="#api" data-alvo="a-esp">Especificação e uso</a></nav>
    <section class="cartao secao" id="a-passos" aria-labelledby="t-a-passos">
      <h2 id="t-a-passos"><small>1</small>Primeiros passos</h2>
      <p class="sub">Três consultas resolvem a maior parte dos usos: achar o código do reservatório, ver o nome das variáveis e pedir a série. O endereço funciona direto no navegador; com ${cod("formato=csv")}, o resultado abre na planilha.</p>
      <ol class="api-passos">
        <li>Ache o código do reservatório em ${cod("/v1/reservatorios?busca=furnas")}. O código também aparece na ficha de cada reservatório e na área de dados.</li>
        <li>Veja o nome das variáveis em ${cod("/v1/variaveis")}: ${cod("cota_m")}, ${cod("volume_util_pct")}, ${cod("afluente_m3s")} e as demais do catálogo.</li>
        <li>Peça a série em ${cod("/v1/series")}, com os reservatórios, as variáveis e o período.</li></ol>
      <div class="api-bloco"><h3>Endereço da API</h3>${bloco(API_BASE, "o endereço da API")}</div>
      <div class="api-bloco"><h3>Consulta de exemplo: Furnas, cota e volume útil nos três últimos dias</h3>${bloco(pag.qEx, "a consulta de exemplo")}</div>
      <p class="nota" style="margin:10px 0 0">Endereço ilustrativo: a API ainda será criada (solicitação à STI).</p>
    </section>
    <section class="cartao secao" id="a-cons" aria-labelledby="t-a-cons">
      <h2 id="t-a-cons"><small>2</small>Consultas</h2>
      <p class="sub">Todas as consultas são de leitura (método GET) e respondem em JSON, o padrão, ou em CSV. Todas usam o mesmo cadastro e o mesmo catálogo das páginas.</p>
      ${tab(
        ["22%", "26%", ""],
        ["Consulta", "Endereço", "O que devolve"],
        pag.CONS.map(c => [
          `<span class="nm">${c.r}</span>`,
          cod("/v1" + c.p),
          esc(c.d) +
            (c.q.length
              ? `<br><span class="nota">Filtros: ${c.q.map(([k, t]) => `${cod(k)} (${esc(t)})`).join("; ")}.</span>`
              : "")
        ])
      )}
    </section>
    <section class="cartao secao" id="a-serie" aria-labelledby="t-a-serie">
      <h2 id="t-a-serie"><small>3</small>Parâmetros da série</h2>
      <p class="sub">Parâmetros da consulta ${cod("/v1/series")}. Só o primeiro é obrigatório; os demais têm um valor padrão.</p>
      ${tab(
        ["18%", "", "22%", "20%"],
        ["Parâmetro", "O que é", "Exemplo", "Se omitido"],
        pag.PARS.map(p => [cod(p[0]), esc(p[1]), cod(p[2]), esc(p[3])])
      )}
      <p class="api-txt">Vale a mesma série das páginas e da área de dados: só o que passou pela conferência, com as correções da área técnica. No Nordeste e Semiárido vem a data real de cada leitura, sem preenchimento nem interpolação. O reservatório retirado do acompanhamento continua na API, com o modo de exibição informado em ${cod("/v1/reservatorios")}.</p>
    </section>
    <section class="cartao secao" id="a-resp" aria-labelledby="t-a-resp">
      <h2 id="t-a-resp"><small>4</small>Resposta</h2>
      <p class="sub">Formato longo: uma linha por reservatório, data e variável, com o valor e a unidade. No JSON, o cabeçalho traz a versão dos dados, a consulta como foi entendida e a paginação; no CSV, essas informações vêm no cabeçalho da resposta HTTP.</p>
      <div class="api-bloco"><h3>JSON</h3>${bloco(pag.json, "a resposta em JSON")}</div>
      <div class="api-bloco"><h3>CSV</h3>${bloco(pag.csv, "a resposta em CSV")}</div>
      <p class="api-txt">No CSV da API, a vírgula separa as colunas, o ponto separa os decimais e a data vem como aaaa-mm-dd, o padrão dos programas. O arquivo da área de dados segue o padrão das planilhas em português (ponto e vírgula, vírgula decimal, dd/mm/aaaa). Na base horária, a coluna ${cod("data")} dá lugar a ${cod("data_hora")} (aaaa-mm-ddThh:mm).</p>
      <p class="nota" style="margin:10px 0 0">Exemplo montado com a série de Furnas embutida no protótipo, de ${dBR(pag.de)} a ${dBR(pag.ate)}; a versão dos dados é ilustrativa.</p>
    </section>
    <section class="cartao secao" id="a-ex" aria-labelledby="t-a-ex">
      <h2 id="t-a-ex"><small>5</small>Exemplos</h2>
      <p class="sub">A mesma consulta, em CSV, em quatro ferramentas.</p>
      <div class="api-bloco"><h3>Navegador</h3><p class="api-txt" style="margin:0 0 8px">Cole o endereço na barra do navegador: o arquivo é baixado.</p>${bloco(pag.qEx + "&formato=csv", "o endereço")}</div>
      <div class="api-bloco"><h3>Planilha</h3><p class="api-txt" style="margin:0 0 8px">No Excel, Dados › Obter Dados › Da Web, e cole o endereço. A planilha pode ser atualizada depois com um clique.</p>${bloco(pag.qEx + "&formato=csv", "o endereço")}</div>
      <div class="api-bloco"><h3>Python</h3>${bloco(`import pandas as pd\n\nurl = ("${API_BASE}/series?reservatorios=19004"\n       "&variaveis=cota_m,volume_util_pct&inicio=2026-01-01&formato=csv")\ndados = pd.read_csv(url, parse_dates=["data"])`, "o código em Python")}</div>
      <div class="api-bloco"><h3>R</h3>${bloco(`url <- paste0("${API_BASE}/series?reservatorios=19004",\n              "&variaveis=cota_m,volume_util_pct&inicio=2026-01-01&formato=csv")\ndados <- read.csv(url)`, "o código em R")}</div>
    </section>
    <section class="cartao secao" id="a-lim" aria-labelledby="t-a-lim">
      <h2 id="t-a-lim"><small>6</small>Limites, versões e erros</h2>
      <p class="sub">Regras de uso, para que a API continue disponível para todos, e o que acontece quando algo dá errado.</p>
      <div class="api-bloco"><h3>Limites</h3>${tab(
        ["50%", ""],
        ["Limite", "Valor"],
        pag.LIM.map(l => [esc(l[0]), esc(l[1])])
      )}
        <p class="api-txt">A consulta que passa do limite de linhas vem dividida em páginas, com o endereço da página seguinte na resposta. Quem passa do limite de consultas recebe o erro 429, com o tempo de espera.</p></div>
      <div class="api-bloco"><h3>Versões</h3><p class="api-txt" style="margin:0">A versão vem no endereço (${cod("/v1/")}). Mudança que quebra programas existentes, como nome de campo, formato ou regra, só entra numa versão nova; a anterior continua no ar pelo prazo anunciado nesta página. Acréscimo de reservatório, de variável ou de campo não muda a versão. Cada mudança fica registrada aqui, com a data.</p></div>
      <div class="api-bloco"><h3>Erros</h3>${tab(
        ["12%", "38%", ""],
        ["Código", "Quando", "Mensagem (exemplo)"],
        pag.ERR.map(e => [cod(e[0]), esc(e[1]), esc(e[2])])
      )}
        <p class="api-txt">Toda mensagem de erro vem em português, com o código, o texto e o parâmetro que causou o erro, quando for o caso.</p></div>
    </section>
    <section class="cartao secao" id="a-esp" aria-labelledby="t-a-esp">
      ${barraBaixar([["baixar-openapi", "OpenAPI", "Baixar a especificação da API no padrão OpenAPI (JSON)"]])}
      <h2 id="t-a-esp"><small>7</small>Especificação e uso</h2>
      <p class="sub">A especificação completa, no padrão OpenAPI, serve para gerar clientes e testar a API em ferramentas próprias. Abaixo, as condições de uso e a forma de citar.</p>
      <div class="api-bloco"><h3>Licença</h3><p class="api-txt" style="margin:0">A definir com a área de dados abertos da ANA.</p></div>
      <div class="api-bloco"><h3>Como citar</h3>${bloco(`Agência Nacional de Águas e Saneamento Básico (ANA). Sistema de Acompanhamento de Reservatórios (SAR), API pública v1. Dados obtidos em dd/mm/aaaa, versão dos dados aaaa-mm-ddThh:mm.`, "a forma de citar")}</div>
      <div class="api-bloco"><h3>Contato</h3><p class="api-txt" style="margin:0">Canal a definir, para dúvidas e para avisar de erro nos dados.</p></div>
    </section>
    <p class="nota fontes-inicio">Fontes: as mesmas das páginas de cada módulo (ONS, SABESP, órgãos estaduais e rede da ANA), com a conferência e as correções do SAR.</p>`;

export { paginaAPI };
