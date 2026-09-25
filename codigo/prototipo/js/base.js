/* Utilitários comuns às páginas: seletores ($, $$), formatação de números e datas, cores lidas das variáveis do CSS
   (COR), cadastro do SIN pronto para uso (RES, NOME, ORDEM_BACIAS, POR_BACIA) e valores de cada usina num dia
   (usinaNoDia), símbolos, avisos (toast), índice da
   página, controle da data de referência e botões de download. */
import { contexto } from "./contexto.js";
import { D } from "./dados_embutidos.js";

const UNID_MINI = { afl: "m³/s", defl: "m³/s", turb: "m³/s", vert: "m³/s", cota: "m", vu: "%" };

const fHora = t => {
  const d = new Date(t);
  return `${fData(t)} ${String(d.getUTCHours()).padStart(2, "0")}h`;
};

const fData = t => {
  const d = new Date(t);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
};

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const NS = "http://www.w3.org/2000/svg";
// cores para o desenho feito em JavaScript (SVG, canvas, mapas): lidas das variáveis do CSS (css/base.css, :root),
// que são a fonte única da identidade visual. As cores de dados que se repetem entre arquivos (nível, módulos, usina nova)
// também vêm de lá; as paletas de uso único (faixas, variáveis de uma página) ficam onde são definidas.
const COR = (() => {
  const v = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  return {
    ana: v("--ana"),
    vivo: v("--ana-vivo"),
    claro: v("--ana-claro"),
    tinta: v("--tinta"),
    tinta2: v("--tinta-2"),
    apagado: v("--apagado"),
    linha: v("--linha"),
    linhaForte: v("--linha-forte"),
    gelo: v("--ana-gelo"),
    branco: v("--branco"),
    azulMedio: v("--graf-azul-medio"),
    cinzaAnos: v("--graf-cinza-anos"),
    vermelho: v("--graf-vermelho"),
    nivel: v("--graf-nivel"),
    verde: v("--graf-verde"),
    bronze: v("--graf-bronze"),
    bronzeEscuro: v("--graf-bronze-escuro"),
    rio: v("--mapa-rio"),
    rioSatelite: v("--mapa-rio-satelite")
  };
})();
// açudes só com nível: azul-médio no símbolo e na linha; cinza quando não há leitura na janela
const COR_NV = COR.azulMedio,
  COR_NV_SEM = "#9E9E9E";
// tela de computador (barra lateral fixa); abaixo disso, leiaute de celular
const DESKTOP = () => window.matchMedia("(min-width:1024px)").matches;
// texto sem acento e em minúsculas: para comparar códigos e nomes (identidade), sem mexer na pontuação
const semAc = s =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
// texto de busca (o digitado e o índice passam pela mesma função): sem acento, em minúsculas, sem apóstrofo e sem ponto
// ("Mãe D'Água" -> "mae dagua", "M. Moraes" -> "m moraes") e com a demais pontuação trocada por espaço
// ("Jaguari-Jacareí" -> "jaguari jacarei"); a busca exige que cada palavra digitada apareça no índice
const normalizaBusca = s =>
  semAc(s)
    .replace(/['’`´.]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
// dias do mês "aaaa-mm"
const diasNoMes = mes => new Date(Date.UTC(+mes.slice(0, 4), +mes.slice(5, 7), 0)).getUTCDate();
// os n meses ("aaaa-mm") até o da data iso, do mais antigo ao da data: janela dos gráficos mensais
function mesesAte(iso, n = 12) {
  const out = [];
  let y = +iso.slice(0, 4),
    m = +iso.slice(5, 7);
  for (let k = 0; k < n; k++) {
    out.unshift(`${y}-${String(m).padStart(2, "0")}`);
    if (!--m) {
      m = 12;
      y--;
    }
  }
  return out;
}
// nomes curtos dos meses e rótulo do mês "aaaa-mm" ("set/26")
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const rotuloMes = mi => `${MESES[+mi.slice(5, 7) - 1]}/${mi.slice(2, 4)}`;
const fmt = (v, n = 1) =>
  v == null || isNaN(v)
    ? "–"
    : Number(v).toLocaleString("pt-BR", { minimumFractionDigits: n, maximumFractionDigits: n });
const fint = v => (v == null || isNaN(v) ? "–" : Math.round(v).toLocaleString("pt-BR"));
const dBR = iso => iso.slice(8, 10) + "/" + iso.slice(5, 7) + "/" + iso.slice(0, 4);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const MIN = new Set(["DA", "DE", "DO", "DOS", "DAS", "E"]),
  SIG = new Set(["I", "II", "III", "IV", "CS", "CM", "PR", "MG", "JR"]);
const caso = s =>
  s
    .split(/(\s+|-)/)
    .map((w, i) =>
      !w.trim() || w === "-"
        ? w
        : SIG.has(w.toUpperCase())
          ? w.toUpperCase()
          : MIN.has(w.toUpperCase()) && i
            ? w.toLowerCase()
            : w.replace(/^([("']?)(.)(.*)$/s, (_, p, a, b) => p + a.toUpperCase() + b.toLowerCase())
    )
    .join("");
const svgEl = (tag, at = {}) => {
  const e = document.createElementNS(NS, tag);
  for (const k in at) e.setAttribute(k, at[k]);
  return e;
};

const NOME = D.nome_bacia;
const RES = D.reservatorios;
const ORDEM_BACIAS = Object.keys(NOME).sort((a, b) => NOME[a].localeCompare(NOME[b], "pt-BR"));
const POR_BACIA = b => RES.filter(r => r.bacia === b).sort((x, y) => x.ordem - y.ordem);
const TIPO = { res: "Usina com reservatório", fio: "Usina a fio d'água", sem: "Sem cadastro ONS" };
// valores de uma usina do SIN num dia: série diária embutida (12 meses até a data dos dados); fora dela, sem valor
const SERIE_USINAS = D.sin_diario;
const naSerieUsinas = iso => iso >= SERIE_USINAS.de && iso <= SERIE_USINAS.ate;
function usinaNoDia(r, iso) {
  const s = SERIE_USINAS.usinas[r.nome],
    k = naSerieUsinas(iso) ? Math.round((Date.parse(iso) - Date.parse(SERIE_USINAS.de)) / 864e5) : -1;
  const v = c => (s && k >= 0 ? s[c][k] : null);
  return { ...r, dia: iso, cota: v("cota"), afl: v("afl"), defl: v("defl"), vu: v("vu") };
}

const ICO_BAIXAR =
  '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2.2v7.3M4.8 6.6 8 9.8l3.2-3.2M3.2 13.4h9.6"/></svg>';
// barra de download da seção: sempre no alto à direita, rótulo curto, peso visual de nota
const barraBaixar = itens =>
  `<div class="baixar">${itens.map(([id, r, t]) => `<button type="button" id="${id}" title="${t}">${ICO_BAIXAR}${r}</button>`).join("")}</div>`;

function simbolo(tipo, tam = 14, cor) {
  const c = cor || (tipo === "fio" ? COR.azulMedio : COR.ana);
  if (tipo === "fio")
    return `<svg class="simb" width="${tam * 0.9}" height="${tam * 0.9}" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.3" fill="${c}" stroke="${COR.branco}" stroke-width="1.6"/></svg>`;
  return `<svg class="simb" width="${tam}" height="${(tam * 16) / 18}" viewBox="0 0 18 16" aria-hidden="true"><path d="M9 1.2 L17 14.8 L1 14.8 Z" fill="${c}" stroke="${COR.branco}" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
}
function toast(msg) {
  const t = document.createElement("div");
  t.className = "toast";
  t.setAttribute("role", "status");
  t.textContent = msg;
  document.body.append(t);
  setTimeout(() => t.remove(), 3400);
}
$$("[data-fora]").forEach(
  b =>
    (b.onclick = () =>
      toast(`${b.dataset.fora}: fora desta rodada do protótipo. A estrutura desse módulo ainda vai ser definida.`))
);

// índice da página (nav.indice): cada link rola até a sua seção, sem mudar o endereço
function ligarIndice() {
  $$(".indice a").forEach(
    a =>
      (a.onclick = e => {
        e.preventDefault();
        document.getElementById(a.dataset.alvo).scrollIntoView({ behavior: "smooth", block: "start" });
      })
  );
}

// controle da data de referência: campo de data, botão "Dados mais recentes" e a instrução (dica)
function barraData(id, valor, min, max, dica) {
  return `<div class="barra-data"><label class="data-ref" for="${id}"><b>Data de referência</b></label><input type="date" id="${id}" value="${valor}" min="${min}" max="${max}" aria-label="Data de referência"><button class="hoje" id="${id}-hoje" title="Voltar para os dados mais recentes">Dados mais recentes</button><span class="dica">${dica}</span></div>`;
}
// liga o controle: a data fora do intervalo vai para o limite; o botão volta à data mais recente (recente)
// data de referência do SIN: vale para as páginas do módulo (a do Nordeste é dataRef; a de Outros Sistemas, refOS) e
// volta ao padrão ao sair do módulo (rotas.js); fora do intervalo da página, a página abre no dado mais recente
const dataInicialSIN = (min, max) =>
  contexto.refSIN && contexto.refSIN >= min && contexto.refSIN <= max ? contexto.refSIN : max;
function ligarData(id, min, max, aoMudar, recente = max) {
  const e = $("#" + id),
    ir = iso => {
      iso = iso < min ? min : iso > max ? max : iso;
      e.value = iso;
      aoMudar(iso);
    };
  e.onchange = () => ir(e.value || recente);
  $("#" + id + "-hoje").onclick = () => ir(recente);
}

export {
  $,
  $$,
  barraBaixar,
  barraData,
  caso,
  COR,
  COR_NV,
  COR_NV_SEM,
  dataInicialSIN,
  dBR,
  DESKTOP,
  diasNoMes,
  esc,
  fData,
  fHora,
  fint,
  fmt,
  ligarData,
  ligarIndice,
  MESES,
  mesesAte,
  naSerieUsinas,
  NOME,
  normalizaBusca,
  NS,
  ORDEM_BACIAS,
  POR_BACIA,
  RES,
  rotuloMes,
  SERIE_USINAS,
  semAc,
  simbolo,
  svgEl,
  TIPO,
  toast,
  UNID_MINI,
  usinaNoDia
};
