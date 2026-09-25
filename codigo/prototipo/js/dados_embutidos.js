/* Dados do protótipo (dados.json, gerado pelos preparar_*.py a partir das coletas de ../dados). Na página montada,
   o montar.py os embute num <script type="application/json" id="dados-prototipo">; na página de desenvolvimento (dev.html),
   a mesma marca é criada com o arquivo lido do servidor antes de os módulos carregarem. */
import { retiraAfluenteNegativa } from "./regras.js";

const D = JSON.parse(document.getElementById("dados-prototipo").textContent);

// vistas dos módulos: Nordeste e Semiárido (com valores vazios se o bloco faltar) e Outros Sistemas Hídricos
const NEd = D.ne || {
  faixas: [],
  estados: [],
  total: {},
  ce: { res: [] },
  serie: {},
  mapa: { w: 1, h: 1, ufs: [] },
  data: D.data,
  limiar_dias: 30,
  fontes: {},
  reservatorios: [],
  datas: [D.data],
  portal_por_data: {},
  serie_de: D.data,
  serie_min: D.data,
  serie_ate: D.data
};
const OS = D.outros || null,
  CAN = OS && OS.cantareira;

// volume acumulado de cada estado e do Nordeste calculado em cada dia pela regra da página, desde o ano inicial
// (preparar_serie_ne.py; Diego, 23/09/2026: no lugar da curva encadeada). Cada valor é o que a página mostra com a data
// de referência nesse dia. "Ao longo do ano": um ponto por mês, contado para trás a partir da data de referência (mesmo
// dia do mês anterior, ou o último dia do mês quando ele não tem esse dia); dois pontos seguidos não são ligados quando
// a capacidade dos reservatórios que entraram ou saíram da medição passa do limiar (parâmetro da área administrativa).
const SD = NEd.serie_direta || { inicio: null, series: {}, limiar_troca_pct: 15, ano_inicial: null, fonte: "" };

// conferência do SIN aplicada uma vez, ao carregar (regras.js, retiraAfluenteNegativa): a vazão afluente diária
// negativa sai da publicação, e a lista guarda os valores retirados para a fila de revisão da área administrativa
const AFL_RETIRADAS = retiraAfluenteNegativa(D);

export { AFL_RETIRADAS, CAN, D, NEd, OS, SD };
