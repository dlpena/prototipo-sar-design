/* Módulo Nordeste e Semiárido (#ne): volume acumulado pela regra da data de referência (medição mais próxima, até
   30 dias antes ou depois), mapa dos estados, mapa dos reservatórios, faixas e cobertura por estado, e o que as páginas
   dos estados e as fichas usam em comum. */
import { contexto } from "./contexto.js";
import { agregar, faixaPct, medicaoNaJanela } from "./regras.js";
import { NEd, SD } from "./dados_embutidos.js";
import {
  $,
  $$,
  barraBaixar,
  barraData,
  caso,
  COR,
  COR_NV,
  COR_NV_SEM,
  dBR,
  esc,
  fint,
  fmt,
  ligarData,
  ligarIndice,
  svgEl,
  toast
} from "./base.js";
import {
  AZUL,
  baixarArquivo,
  baixarCSVGrafico,
  baixarPNG,
  carregarScript,
  CDN_AUTOTABLE,
  CDN_JSPDF,
  CINZA,
  guardaCSV,
  hojeBR,
  LEG_ANOS,
  LINHA,
  montarKMZ,
  pdfSecao,
  rodapePDF,
  TINTA,
  xk
} from "./exportacao.js";
import { balao, comoLer, ler, posicionaBalao } from "./graficos.js";
import { contornoAceso } from "./sin.js";
import {
  desenharSerie,
  legendaNivel,
  LIM_EST,
  mapaResNE,
  mesmoDiaSerie,
  nivelNa,
  NOTA_SERIE,
  paginaEstado,
  sinal
} from "./ne_estados.js";

function barrasFaixas(host, linhas) {
  host.innerHTML = "";
  guardaCSV(
    host,
    ["estado", "acompanhados", "restricao", "atencao", "normal", "so_nivel_com_leitura_janela", "sem_informacao"],
    linhas.map(l => [l.rot, l.n, l.faixas.restricao, l.faixas.atencao, l.faixas.normal, l.nivel || 0, l.sem_info])
  );
  const chaves = ["restricao", "atencao", "normal", "nivel", "sem"];
  const corK = k => (k === "nivel" ? COR_NV : FX[k].cor),
    rotK = k => (k === "nivel" ? ROT_NV_FAIXA : ROT_FAIXA(k));
  const W = Math.max(300, host.clientWidth),
    alturaLinha = 26,
    m = { l: 150, r: 60, t: 34, b: 10 };
  const H = m.t + linhas.length * alturaLinha + m.b;
  const maxN = Math.max(...linhas.map(l => l.n));
  const svg = svgEl("svg", {
    viewBox: `0 0 ${W} ${H}`,
    role: "img",
    "aria-label": "Reservatórios por faixa de volume e sem informação, por estado"
  });
  const rot = svgEl("text", {
    x: 0,
    y: 14,
    "font-size": 13.5,
    fill: COR.ana,
    "font-weight": 700,
    "font-family": "Arial"
  });
  rot.textContent = "Reservatórios por situação na data";
  svg.append(rot);
  const larg = n => (n / maxN) * (W - m.l - m.r);
  const tip = balao(host);
  linhas.forEach((l, i) => {
    const y = m.t + i * alturaLinha;
    const nm = svgEl("text", {
      x: m.l - 10,
      y: y + 15,
      "text-anchor": "end",
      "font-size": 12.5,
      fill: COR.ana,
      "font-family": "Arial"
    });
    nm.textContent = l.rot;
    svg.append(nm);
    let x = m.l;
    chaves.forEach(k => {
      const n = k === "sem" ? l.sem_info : k === "nivel" ? l.nivel || 0 : l.faixas[k];
      if (!n) return;
      const w = larg(n);
      const r = svgEl("rect", { x, y: y + 4, width: w, height: 16, fill: corK(k), opacity: k === "sem" ? 0.55 : 0.9 });
      r.addEventListener("pointerenter", () => {
        tip.innerHTML = `<b>${l.rot}</b><div class="l"><span><i style="border-color:${corK(k)}"></i>${rotK(k)}</span><span class="num">${n}</span></div><div class="l"><span>acompanhados no estado</span><span class="num">${l.n}</span></div>`;
        tip.hidden = false;
        posicionaBalao(tip, svg, x + w / 2, W, (y / H) * svg.getBoundingClientRect().height);
      });
      r.addEventListener("pointerleave", () => (tip.hidden = true));
      svg.append(r);
      if (w > 22) {
        const nt = svgEl("text", {
          x: x + w / 2,
          y: y + 15.5,
          "text-anchor": "middle",
          "font-size": 10.5,
          "font-weight": 600,
          "font-family": "Arial",
          fill: k === "atencao" ? "#4A3B00" : COR.branco
        });
        nt.textContent = n;
        svg.append(nt);
      }
      x += w;
    });
    const tot = svgEl("text", { x: x + 8, y: y + 15, "font-size": 11.5, fill: COR.apagado, "font-family": "Arial" });
    tot.textContent = l.n ? l.n : W < 480 ? "nenhum" : "nenhum reservatório acompanhado";
    svg.append(tot);
  });
  host.append(svg);
}

const CT = NEd.contagens || {};
// modo de exibição de cada reservatório (área de administração): ocultos saem das contagens; só nível entram à parte
const NVE = (NEd.nivel && NEd.nivel.estados) || {};
const OCULTOS = new Set(Object.values(NVE).flatMap(e => (e.ocultos && e.ocultos.indices) || []));
const ESTACOES_NV = Object.entries(NVE).flatMap(([uf, e]) => e.nivel.map(st => ({ ...st, uf })));
// fora da lista de volume: os ocultos e os do cadastro que aparecem pela leitura de nível (não contam duas vezes)
const FORA_VOLUME = new Set([...OCULTOS, ...Object.values(NVE).flatMap(e => e.fora_do_volume || [])]);
const temPagina = uf => !!(NVE[uf] && NVE[uf].pagina);
const FX = {};
NEd.faixas.forEach(f => (FX[f.k] = f));
FX.sem = { k: "sem", rot: "Sem informação", cor: "#9E9E9E" };
const ROT_FAIXA = k =>
  FX[k].rot +
  (k === "sem"
    ? ` (mais de ${NEd.limiar_dias} dias)`
    : k === "restricao"
      ? " (abaixo de 20%)"
      : k === "atencao"
        ? " (20% a menos de 50%)"
        : " (50% ou mais)");
const round1 = v => (v == null ? null : Math.round(v * 10) / 10);
/* ---- data de referência: a medição mais próxima, até 30 dias antes ou depois (regra do portal) ----
   A série de cada reservatório está embutida (12 meses do SAR legado), então a regra roda aqui, para
   qualquer data escolhida. NEd.reservatorios[i].s = [[dia desde serie_de, volume %, volume hm³], ...] */
const DIA0 = Date.parse(NEd.serie_de + "T00:00:00Z"); // em UTC: o resultado não depende do fuso de quem abre a página
const diaDe = iso => Math.round((Date.parse(iso + "T00:00:00Z") - DIA0) / 864e5);
const isoDia = d => new Date(DIA0 + d * 864e5).toISOString().slice(0, 10);
contexto.dataRef = NEd.data;

// medição usada por um reservatório na data de referência
function resNa(i) {
  const base = NEd.reservatorios[i],
    alvo = diaDe(contexto.dataRef),
    s = base.s || [];
  const k = medicaoNaJanela(
      s,
      alvo,
      NEd.limiar_dias,
      x => x[0],
      x => x[2] != null
    ),
    melhor = k < 0 ? null : s[k];
  return {
    ...base,
    volume_pct: melhor ? melhor[1] : null,
    volume_hm3: melhor ? melhor[2] : null,
    cota: melhor ? (melhor[3] ?? null) : null,
    data: melhor ? isoDia(melhor[0]) : null,
    dias: melhor ? alvo - melhor[0] : null,
    sem_info: !melhor,
    faixa: melhor ? faixaPct(melhor[1]) : "sem"
  };
}

// tudo o que a página precisa numa data: reservatórios resolvidos, estados e total
function situacaoNE() {
  const lista = NEd.reservatorios.map((_, i) => resNa(i)).filter(r => !FORA_VOLUME.has(r.i));
  const niveis = ESTACOES_NV.map(st => nivelNa(st));
  // volume pelo agregado de sempre; o nível soma no total acompanhado e, sem leitura na janela, no sem informação
  const junta = (L, N) => {
    const A = agregar(L),
      semN = N.filter(r => r.sem_info).length;
    return {
      ...A,
      n_vol: A.n,
      n: A.n + N.length,
      nivel_n: N.length, // estações só com nível acompanhadas (com ou sem leitura na janela)
      nivel: N.length - semN, // estações só com nível com leitura na janela
      sem_info: A.sem_info + semN
    };
  };
  const estados = NEd.estados.map(e => ({
    uf: e.uf,
    estado: e.estado,
    ...junta(
      lista.filter(r => r.uf === e.uf),
      niveis.filter(r => r.uf === e.uf)
    ),
    ocultos: NVE[e.uf] ? NVE[e.uf].ocultos.n : 0,
    volume_pct_portal: (NEd.portal_por_data[dataColetada()] || {})[e.uf]
  }));
  const total = {
    ...junta(lista, niveis),
    ocultos: OCULTOS.size,
    volume_pct_portal: (NEd.portal_por_data[dataColetada()] || {}).NE
  };
  return { lista, niveis, estados, total };
}
let SIT = null; // situação corrente, recalculada a cada troca de data

// data coletada mais próxima, para as séries do portal (seções 3 e 4)
function dataColetada() {
  const alvo = diaDe(contexto.dataRef);
  return NEd.datas.reduce((m, d) => (Math.abs(diaDe(d) - alvo) < Math.abs(diaDe(m) - alvo) ? d : m), NEd.datas[0]);
}
const dDias = r =>
  r.dias == null
    ? "sem medição"
    : r.dias === 0
      ? "no dia"
      : r.dias === 1
        ? "1 dia antes"
        : r.dias === -1
          ? "1 dia depois"
          : r.dias > 0
            ? `${r.dias} dias antes`
            : `${-r.dias} dias depois`;

// escala neutra do volume acumulado por estado (o agregado estadual não recebe faixa de alerta)
const ESC_UF = [
  { de: 0, ate: 20, cor: "#E3EAF4" },
  { de: 20, ate: 40, cor: "#BDD0E6" },
  { de: 40, ate: 60, cor: "#8FAFD4" },
  { de: 60, ate: 80, cor: COR.azulMedio },
  { de: 80, ate: null, cor: COR.ana }
];
const SEM_COR = "#D8DBE0";
const corUF = p => (p == null ? SEM_COR : (ESC_UF.find(f => p < (f.ate == null ? 1e9 : f.ate)) || ESC_UF[4]).cor);
const rotEsc = f => (f.ate == null ? `${f.de}% ou mais` : f.de === 0 ? `menos de ${f.ate}%` : `${f.de} a ${f.ate}%`);
const SVG_HACHURA =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="11"><defs><pattern id="h" width="7" height="7" ' +
      'patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="7" stroke="#6B5B45" ' +
      'stroke-width="1" opacity="0.55"/></pattern></defs><rect width="22" height="11" fill="url(#h)" stroke="#6B5B45" ' +
      'stroke-opacity="0.75"/></svg>'
  );
const legendaEscalaUF = () =>
  `<div class="escala-uf"><b>Volume acumulado</b>` +
  ESC_UF.map(f => `<span><i style="background:${f.cor}"></i>${rotEsc(f)}</span>`).join("") +
  `<span><i style="background:${SEM_COR}"></i>sem volume na data</span>` +
  `<span class="semi"><i style="background-image:url('${SVG_HACHURA}')"></i>Semiárido</span></div>`;

function seletorData(id, min = NEd.serie_min, max = NEd.serie_ate) {
  return barraData(
    id,
    contexto.dataRef,
    min,
    max,
    `Cada reservatório entra com a medição mais próxima desta data, até ${NEd.limiar_dias} dias antes ou depois. Qualquer data de ${dBR(min)} a ${dBR(max)}.`
  );
}
function ligarSeletor(id, aplicar, min = NEd.serie_min, max = NEd.serie_ate) {
  ligarData(
    id,
    min,
    max,
    iso => {
      contexto.dataRef = iso;
      aplicar();
    },
    NEd.data
  );
}
// páginas do módulo trabalham só nos 12 meses embutidos: ao voltar da ficha com uma data antiga, volta à última
const dataNoModulo = () => {
  if (contexto.dataRef < NEd.serie_min || contexto.dataRef > NEd.serie_ate) contexto.dataRef = NEd.data;
};

// barras empilhadas por estado: faixas de volume e cobertura da informação
const ROT_NV_FAIXA = "Só nível (sem volume)";
// mesma ordem das barras: faixas, só nível, sem informação
const legendaFaixasNivel = () =>
  `<div class="legenda">${["restricao", "atencao", "normal"].map(k => `<span><i class="bola" style="background:${FX[k].cor}"></i>${ROT_FAIXA(k)}</span>`).join("")}` +
  `<span><i class="bola" style="background:${COR_NV}"></i>${ROT_NV_FAIXA}</span><span><i class="bola" style="background:${FX.sem.cor}"></i>${ROT_FAIXA("sem")}</span></div>`;

const legendaFaixas = () =>
  `<div class="legenda">${["restricao", "atencao", "normal", "sem"].map(k => `<span><i class="bola" style="background:${FX[k].cor}"></i>${ROT_FAIXA(k)}</span>`).join("")}</div>`;

// ordenação simples de tabela: clique no cabeçalho
function ordenavel(tab, linhas, desenhar) {
  $$("th[data-ord]", tab).forEach(th => {
    th.tabIndex = 0;
    const acionar = () => {
      const k = th.dataset.ord,
        num = th.dataset.tipo === "num";
      const asc = th.dataset.dir !== "asc";
      $$("th[data-ord]", tab).forEach(o => {
        o.dataset.dir = "";
        o.classList.remove("ord-asc", "ord-desc");
      });
      th.dataset.dir = asc ? "asc" : "desc";
      th.classList.add(asc ? "ord-asc" : "ord-desc");
      linhas.sort((a, b) => {
        const x = a[k],
          y = b[k];
        if (x == null && y == null) return 0;
        if (x == null) return 1;
        if (y == null) return -1;
        return (num ? x - y : String(x).localeCompare(String(y), "pt-BR")) * (asc ? 1 : -1);
      });
      desenhar();
    };
    th.onclick = acionar;
    th.onkeydown = e => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        acionar();
      }
    };
  });
}

function paginaNE() {
  const pag = {}; // estado da página, passado às funções abaixo

  dataNoModulo();
  SIT = situacaoNE();
  pag.linhas = SIT.estados.map(e => ({ ...e }));
  $("#titulo-pag").innerHTML = tituloNE();
  $("#conteudo").innerHTML = corpoNE();
  ligarIndice();

  // tabela dos estados
  pag.corpo = $("#corpo-estados");
  ordenavel($("#tab-estados"), pag.linhas, (...a) => desenharNE(pag, ...a));
  pag.mapaUF = mapaNE($("#mapa-ne"));
  pag.mapaRes = mapaResNE($("#mapa-res-ne"), null, { semiarido: true, ajuste: true });
  pag.lista = [];

  ligarSeletor("data-ne", (...a) => aplicarNE(pag, ...a));
  aplicarNE(pag);

  ligarDownloadsNE(pag);
}

const tituloNE = () =>
  `
    <p class="trilha"><a href="#inicio">Início</a><span class="sep">›</span>Nordeste e Semiárido</p>
    <h1>Nordeste e Semiárido</h1>
    <p class="lead">Açudes dos nove estados do Nordeste e do semiárido de Minas Gerais: volume acumulado de cada estado e do conjunto, situação de cada reservatório e, onde ainda não há volume calculado, o nível.</p>
    <div class="carimbo"><span><b>${fint(SIT.total.n)}</b> reservatórios acompanhados em <b>${SIT.estados.filter(e => e.n).length}</b> dos ${SIT.estados.length} estados</span><span><b>${fint(SIT.total.n_vol)}</b> com volume</span><span><b>${fint(SIT.total.nivel_n)}</b> só com nível</span><span id="carimbo-com"></span></div>
    ${seletorData("data-ne")}`;

const corpoNE = () =>
  `
    <nav class="indice" aria-label="Seções da página">
      <a href="#ne" data-alvo="n-estados">Estados</a><a href="#ne" data-alvo="n-vol">Volume acumulado</a><a href="#ne" data-alvo="n-ano">Ao longo do ano</a><a href="#ne" data-alvo="n-dia">Mesmo dia em outros anos</a><a href="#ne" data-alvo="n-faixas">Faixas e cobertura</a><a href="#ne" data-alvo="n-mapa">Mapa dos reservatórios</a>
    </nav>
    <section class="cartao intro" aria-label="Sobre o módulo">
      <p>Os reservatórios do semiárido não são medidos todos os dias. Para a <b>data de referência</b>, cada um entra com a medição mais próxima, até ${NEd.limiar_dias} dias antes ou depois.</p>
      <details class="saiba"><summary>Como o volume acumulado é calculado</summary><div class="saiba-corpo">
        <p><b>Volume acumulado e capacidade equivalente.</b> O volume acumulado (hm³) reúne o volume dos reservatórios com medição na janela de ${NEd.limiar_dias} dias; a capacidade equivalente (hm³), a capacidade desses mesmos reservatórios. O volume acumulado (%) é a razão entre os dois. A conta é a mesma para cada estado e para o Nordeste.</p>
        <p><b>Sem informação.</b> O reservatório sem medição de volume na janela não entra em nenhuma das duas parcelas e é contado como sem informação; no mapa, aparece em cinza.</p>
        <p><b>Só nível.</b> Reservatório sem curva cota-volume validada: é acompanhado pelo nível, que mostra se ele subiu ou desceu, e não entra no volume acumulado.</p>
        <p><b>Retirados do acompanhamento.</b> Os ${fint(OCULTOS.size)} reservatórios cadastrados que a ANA retirou do acompanhamento não entram nas contagens desta página e seguem na área de dados.</p>
        <p><b>Séries e comparações.</b> Os gráficos ao longo do ano e do mesmo dia em outros anos e as comparações usam, em cada data, a mesma conta do valor do dia. A série começa em ${SD.ano_inicial}, primeiro ano em que as medições passaram a reunir a maior parte da capacidade dos reservatórios do Nordeste. No gráfico ao longo do ano, dois pontos seguidos não são ligados quando o conjunto de reservatórios medidos muda muito de um mês para o outro.</p>
      </div></details>
    </section>
    <section class="cartao secao" id="n-estados" aria-labelledby="t-n-estados">
      ${barraBaixar([
        ["baixar-ne-mapa", "PNG", "Baixar o mapa dos estados como imagem"],
        ["baixar-ne-csv", "CSV", "Baixar a tabela dos estados em CSV"],
        ["baixar-ne-pdf", "PDF", "Baixar a tabela dos estados em PDF"]
      ])}
      <h2 id="t-n-estados"><small>1</small>Estados</h2>
      <p class="sub">Volume acumulado de cada estado na data de referência. Com volume, só com nível e sem leitura somam os acompanhados; capacidade e volume reúnem só os reservatórios com volume medido.<span class="dica">Passe o mouse no mapa ou na tabela para ligar um ao outro; clique para abrir o estado.</span></p>
      <div class="grade-ne">
        <div class="col-mapa-ne">${legendaEscalaUF()}<div id="mapa-ne" style="position:relative"></div><p class="nota" style="margin:10px 0 0">A hachura marca o Semiárido, na delimitação do INSA. Em Minas Gerais o módulo acompanha só os reservatórios situados nele; nos nove estados do Nordeste, o estado todo. A delimitação alcança ainda parte do Espírito Santo, que não faz parte do módulo e não aparece no mapa.</p></div>
        <div class="tab-box"><table id="tab-estados">
          <thead><tr><th data-ord="estado">Estado</th><th class="r" data-ord="n" data-tipo="num">Reser&shy;va&shy;tórios</th><th class="r" data-ord="com_dado" data-tipo="num">Com volume</th><th class="r" data-ord="nivel" data-tipo="num">Só com nível</th><th class="r" data-ord="sem_info" data-tipo="num">Sem leitura</th><th class="r" data-ord="capacidade_com_dado_hm3" data-tipo="num">Capa&shy;cidade</th><th class="r" data-ord="volume_hm3" data-tipo="num">Volume</th><th class="r" data-ord="volume_pct" data-tipo="num">Volume</th></tr>
          <tr class="unid"><th></th><th class="r">acompa&shy;nhados</th><th class="r">na janela de ${NEd.limiar_dias} dias</th><th class="r">com leitura na janela</th><th class="r">na janela</th><th class="r">equiva&shy;lente, hm³</th><th class="r">hm³</th><th class="r">%</th></tr></thead>
          <tbody id="corpo-estados"></tbody>
          <tfoot id="pe-estados"></tfoot>
        </table></div>
      </div>
    </section>
    <section class="cartao secao" id="n-vol" aria-labelledby="t-n-vol">
      <h2 id="t-n-vol"><small>2</small>Volume acumulado do Nordeste</h2>
      <p class="sub" id="vol-sub"></p>
      <div class="equiv">
        <div class="lado">
          <div class="valor num" id="vol-valor"></div>
          <div class="quando" id="vol-quando"></div>
          <p class="nota" id="vol-nota"></p>
        </div>
        <ul class="comparacoes" id="comp-ne"></ul>
      </div>
    </section>
    <section class="cartao secao" id="n-ano" aria-labelledby="t-n-ano">
      ${barraBaixar([
        ["baixar-ne-ano-csv", "CSV", "Baixar os dados do gráfico em CSV"],
        ["baixar-ne-ano", "PNG", "Baixar o gráfico como imagem"]
      ])}
      <h2 id="t-n-ano"><small>3</small>Ao longo do ano</h2>
      <p class="sub">Volume acumulado dos reservatórios do Nordeste com medição, em % da capacidade deles, com um ponto por mês nos cinco anos até a data de referência.<span class="dica">Passe o mouse para comparar o mesmo dia nos cinco anos.</span></p>
      <div class="graf" id="g-ne-ano"></div>
      ${comoLer(ler("anos"), ler("cinco"), ler("cursor"), ...NOTA_SERIE)}
    </section>
    <section class="cartao secao" id="n-dia" aria-labelledby="t-n-dia">
      ${barraBaixar([
        ["baixar-ne-dia-csv", "CSV", "Baixar os dados do gráfico em CSV"],
        ["baixar-ne-dia", "PNG", "Baixar o gráfico como imagem"]
      ])}
      <h2 id="t-n-dia"><small>4</small>Mesmo dia em outros anos</h2>
      <p class="sub" id="sub-dia"></p>
      <div class="graf" id="g-ne-dia"></div>
      ${comoLer(ler("dia"), "<b>Escala.</b> O eixo vertical vai de 0 a 100%.")}
    </section>
    <section class="cartao secao" id="n-faixas" aria-labelledby="t-n-faixas">
      ${barraBaixar([
        ["baixar-ne-faixas-csv", "CSV", "Baixar os dados do gráfico em CSV"],
        ["baixar-ne-faixas", "PNG", "Baixar o gráfico como imagem"]
      ])}
      <h2 id="t-n-faixas"><small>5</small>Faixas e cobertura</h2>
      <p class="sub">Quantos reservatórios de cada estado estão em cada faixa de volume, quantos têm só leitura de nível e quantos estão sem informação na data.</p>
      ${legendaFaixasNivel()}
      <div class="graf" id="g-ne-faixas"></div>
      ${comoLer(
        "<b>Barras.</b> Cada linha é um estado, com uma barra dividida nas cores da legenda: faixas de volume, só nível e sem informação. A faixa descreve o reservatório, não o estado. Com o cursor sobre um trecho, o balão mostra a quantidade de reservatórios.",
        "<b>Comprimento.</b> A barra é proporcional ao número de reservatórios acompanhados no estado; o estado com mais reservatórios ocupa a largura toda. Os retirados do acompanhamento não entram."
      )}
    </section>
    <section class="cartao secao" id="n-mapa" aria-labelledby="t-n-mapa">
      ${barraBaixar([["baixar-ne-kmz", "KMZ", "Baixar os reservatórios em KMZ (Google Earth), com a legenda"]])}
      <h2 id="t-n-mapa"><small>6</small>Mapa dos reservatórios</h2>
      <p class="sub" id="sub-mapa"></p>
      ${legendaFaixas()}${legendaNivel()}
      <div id="mapa-res-ne"></div>
      <p class="nota" id="nota-mapa"></p>
    </section>
    <p class="nota fontes-inicio" id="fontes-ne"></p>`;

const desenharNE = pag => {
  pag.corpo.innerHTML = "";
  pag.linhas.forEach(e => {
    const tr = document.createElement("tr");
    tr.dataset.uf = e.uf;
    tr.tabIndex = 0;
    const obs = [e.uf === "MG" ? "só o semiárido" : "", e.n ? "" : "nenhum reservatório acompanhado"].filter(Boolean);
    tr.innerHTML = `<td><i class="bola" style="background:${corUF(e.volume_pct)}"></i><span class="nm">${e.estado}</span>${obs.map(o => `<small class="obs">${o}</small>`).join("")}</td>
        <td class="r num">${fint(e.n)}</td><td class="r num">${fint(e.com_dado)}</td><td class="r num">${fint(e.nivel)}</td><td class="r num">${fint(e.sem_info)}</td><td class="r num">${e.capacidade_com_dado_hm3 ? fint(e.capacidade_com_dado_hm3) : "–"}</td><td class="r num">${e.volume_hm3 ? fint(e.volume_hm3) : "–"}</td><td class="r num">${e.volume_pct == null ? "–" : fmt(e.volume_pct, 1)}</td>`;
    tr.addEventListener("pointerenter", () => acenderUF(e.uf));
    tr.addEventListener("pointerleave", () => acenderUF(null));
    tr.addEventListener("click", () => abrirEstado(e.uf));
    tr.addEventListener("keydown", ev => {
      if (ev.key === "Enter") abrirEstado(e.uf);
    });
    pag.corpo.append(tr);
  });
};

const aplicarNE = pag => {
  SIT = situacaoNE();
  const P = SIT,
    tot = P.total,
    ref = dBR(contexto.dataRef),
    coletada = dataColetada();
  pag.lista = P.lista;
  const comCoord = pag.lista.filter(r => r.lat != null);
  $("#carimbo-com").innerHTML = `<b>${fint(tot.com_dado)}</b> com volume medido na janela de ${NEd.limiar_dias} dias`;
  pag.linhas.forEach(l =>
    Object.assign(
      l,
      P.estados.find(e => e.uf === l.uf)
    )
  );
  desenharNE(pag);
  $("#pe-estados").innerHTML =
    `<tr><th>Nordeste</th><th class="r num">${fint(tot.n)}</th><th class="r num">${fint(tot.com_dado)}</th><th class="r num">${fint(tot.nivel)}</th><th class="r num">${fint(tot.sem_info)}</th><th class="r num">${fint(tot.capacidade_com_dado_hm3)}</th><th class="r num">${fint(tot.volume_hm3)}</th><th class="r num">${fmt(tot.volume_pct, 1)}</th></tr>`;
  pag.mapaUF.atualizar();

  $("#vol-sub").textContent =
    `Volume acumulado dos ${fint(tot.com_dado)} reservatórios com medição na janela de ${NEd.limiar_dias} dias em torno de ${ref}, em % da capacidade equivalente, que reúne a capacidade desses mesmos reservatórios.`;
  $("#vol-valor").innerHTML = `${fmt(tot.volume_pct, 1)}<small>%</small>`;
  $("#vol-quando").textContent = `volume acumulado em ${ref}`;
  $("#vol-nota").textContent =
    `${fint(tot.volume_hm3)} de ${fint(tot.capacidade_com_dado_hm3)} hm³ de capacidade equivalente · capacidade de todos os reservatórios com volume, medidos ou não: ${fint(tot.capacidade_hm3)} hm³`;
  const md = {},
    atual = { v: tot.volume_pct, n: tot.com_dado, cap: tot.capacidade_com_dado_hm3 };
  mesmoDiaSerie("NE", $("#g-ne-dia"), `Volume acumulado (%) em ${ref.slice(0, 5)}`, atual).forEach(x => {
    if (x.v != null) md[x.a] = x.v;
  });
  const anos = Object.keys(md).map(Number).sort(),
    ano = +contexto.dataRef.slice(0, 4);
  const v0 = md[ano],
    vAnt = md[ano - 1],
    v5 = md[ano - 5];
  const dif = (a, b) => (a == null || b == null ? "–" : `${a - b >= 0 ? "+" : "−"}${fmt(Math.abs(a - b), 1)} p.p.`);
  const menor = anos.reduce((m, a) => (md[a] < md[m] ? a : m), anos[0]);
  $("#comp-ne").innerHTML = `
      <li><span>Mesmo dia de ${ano - 1}<small>${dif(v0, vAnt)}</small></span><b class="num">${vAnt == null ? "–" : fmt(vAnt, 1) + "%"}</b></li>
      <li><span>Mesmo dia de ${ano - 5}<small>${dif(v0, v5)}</small></span><b class="num">${v5 == null ? "–" : fmt(v5, 1) + "%"}</b></li>
      <li><span>Menor valor em ${ref.slice(0, 5)}<small>${anos[0]} a ${ano}, em ${menor}</small></span><b class="num">${fmt(md[menor], 1)}%</b></li>
      <li><span>Sem informação<small>de ${fint(tot.n)} acompanhados, sem leitura na janela</small></span><b class="num">${fint(tot.sem_info)}</b></li>`;

  desenharSerie(
    "NE",
    $("#g-ne-ano"),
    "Volume acumulado do Nordeste (% da capacidade dos reservatórios medidos)",
    atual
  );
  $("#sub-dia").textContent =
    `Volume acumulado do Nordeste em ${ref.slice(0, 5)} de cada um dos cinco anos até a data de referência, com a mesma conta do valor da página e o número de reservatórios medidos em cada ano.`;
  barrasFaixas(
    $("#g-ne-faixas"),
    P.estados.map(e => ({ rot: e.estado, n: e.n, sem_info: e.sem_info, faixas: e.faixas, nivel: e.nivel }))
  );

  $("#sub-mapa").innerHTML =
    `Cada reservatório com volume pela faixa do seu volume em ${ref}, e os só com nível pela variação em 30 dias. Os sem informação aparecem em cinza. O tamanho do círculo acompanha a capacidade.<span class="dica">Passe o mouse para ler o valor e a data da leitura.</span>`;
  pag.mapaRes.atualizar(comCoord.concat(P.niveis.filter(r => r.lat != null)));
  $("#nota-mapa").textContent =
    (pag.lista.length > comCoord.length
      ? `${fint(pag.lista.length - comCoord.length)} dos ${fint(pag.lista.length)} reservatórios do módulo não têm coordenada no cadastro e não aparecem no mapa. `
      : "") +
    `Mapa-base e imagem de satélite vêm de serviços externos; onde a rede os bloqueia, ficam só os pontos e os contornos.`;
  $("#fontes-ne").innerHTML =
    `Fontes: ${esc(NEd.fontes.medicoes)}; ${esc(NEd.fontes.resumo)}; ${esc(NEd.fontes.equivalente)}; ${esc(NEd.fontes.coordenadas)}; ${esc(NEd.fontes.regra)}; contorno do Semiárido: ${esc(NEd.mapa.semiarido_fonte || "INSA")}. ` +
    `${esc(NEd.nivel.fonte)}; conferência das leituras de nível com as regras descritas nas páginas de estado. Só entram estações que medem o nível de reservatório; em Minas Gerais, só as dentro do Semiárido. ` +
    `Não entram nas contagens os ${fint(OCULTOS.size)} reservatórios do cadastro retirados do acompanhamento. No protótipo, a lista dos reservatórios retirados do acompanhamento é simulada pelos que não têm nenhuma leitura nos últimos 12 meses; no sistema, a retirada é decisão da área técnica, com data e motivo registrados. Também não entram as ${fint(Object.values(NVE).reduce((a, e) => a + e.a_verificar.length, 0))} estações com série a verificar (salto de mais de ${fint(NEd.nivel.filtro.suspeito_cm)} cm entre duas leituras que a conferência não explica). ` +
    `Volume acumulado do módulo pelo serviço de volume equivalente do portal em ${dBR(coletada)}${coletada === contexto.dataRef ? "" : ", a data coletada mais próxima"}: ${tot.volume_pct_portal == null ? "–" : fmt(tot.volume_pct_portal, 1) + "%"} (o portal inclui também reservatórios com medição fora da janela de ${NEd.limiar_dias} dias). ` +
    `<br>A data de referência é livre, de ${dBR(NEd.serie_min)} a ${dBR(NEd.serie_ate)}: a série de 12 meses de cada reservatório está embutida na página e a regra dos ${NEd.limiar_dias} dias é aplicada no navegador. ` +
    `As seções 3 e 4 e as comparações usam o volume acumulado calculado em cada data pela mesma regra, desde ${SD.ano_inicial} (${esc(SD.fonte)}); o valor do portal fica acima só para comparação.` +
    `<br>Contagem: a lista de medições do portal devolve ${fint(CT.api_linhas)} linhas para o módulo, com CRISTALÂNDIA (BA) repetida quatro vezes (duas em Brumado e duas em Ituaçu, com capacidade, volume e data idênticos); ` +
    `esta página conta ${fint(CT.listados)}, sem as ${CT.descartadas} linhas repetidas. O resumo por estado do portal totaliza ${fint(CT.resumo_soma)} e a sua própria linha do Nordeste diz ${fint(CT.resumo_nordeste)}: ` +
    `a Paraíba aparece no resumo com uma entidade a mais que na lista, CUREMA/MÃE D'ÁGUA, que não tem medição própria. Verificado em 17/09/2026.`;
};

// downloads (leem a data e a lista do momento do clique)
const ligarDownloadsNE = pag => {
  $("#baixar-ne-mapa").onclick = () =>
    baixarPNG(
      [$("#mapa-ne svg")],
      `sar_ne_estados_${contexto.dataRef}.png`,
      `Nordeste e Semiárido · volume acumulado por estado · ${dBR(contexto.dataRef)}`,
      ESC_UF.map(f => ({ r: `Volume acumulado ${rotEsc(f)}`, cor: f.cor, area: true })).concat([
        { r: "Sem volume na data (sem medição de volume na janela de 30 dias)", cor: SEM_COR, area: true },
        { r: "Semiárido, em hachura (delimitação do INSA)", cor: "#6B5B45", tracejado: true }
      ]),
      {
        sub: "Volume acumulado de cada estado: volume dos reservatórios com medição na janela de 30 dias, em % da capacidade equivalente desses mesmos reservatórios. Em Minas Gerais, só os reservatórios do Semiárido."
      }
    );
  $("#baixar-ne-pdf").onclick = () =>
    pdfSecao([$("#tab-estados")], `sar_ne_estados_${contexto.dataRef}.pdf`, { data: contexto.dataRef });
  $("#baixar-ne-ano-csv").onclick = () =>
    baixarCSVGrafico([$("#g-ne-ano")], `sar_ne_ao_longo_do_ano_ate_${contexto.dataRef}.csv`);
  $("#baixar-ne-dia-csv").onclick = () =>
    baixarCSVGrafico([$("#g-ne-dia")], `sar_ne_mesmo_dia_${contexto.dataRef}.csv`);
  $("#baixar-ne-faixas-csv").onclick = () =>
    baixarCSVGrafico([$("#g-ne-faixas")], `sar_ne_faixas_${contexto.dataRef}.csv`);
  $("#baixar-ne-ano").onclick = () =>
    baixarPNG(
      [$("#g-ne-ano svg")],
      `sar_ne_ao_longo_do_ano_ate_${contexto.dataRef}.png`,
      "Nordeste · volume acumulado ao longo do ano",
      LEG_ANOS(+contexto.dataRef.slice(0, 4))
    );
  $("#baixar-ne-dia").onclick = () =>
    baixarPNG(
      [$("#g-ne-dia svg")],
      `sar_ne_mesmo_dia_${contexto.dataRef}.png`,
      `Nordeste · volume acumulado em ${dBR(contexto.dataRef).slice(0, 5)} de cada ano`,
      LEG_ANOS(+contexto.dataRef.slice(0, 4))
    );
  $("#baixar-ne-faixas").onclick = () =>
    baixarPNG(
      [$("#g-ne-faixas svg")],
      `sar_ne_faixas_${contexto.dataRef}.png`,
      `Nordeste · reservatórios por faixa de volume · ${dBR(contexto.dataRef)}`,
      ["restricao", "atencao", "normal"]
        .map(k => ({ r: ROT_FAIXA(k), cor: FX[k].cor, area: true }))
        .concat([
          { r: ROT_NV_FAIXA, cor: COR_NV, area: true },
          { r: ROT_FAIXA("sem"), cor: FX.sem.cor, area: true }
        ])
    );
  $("#baixar-ne-kmz").onclick = () => kmzEstadoNE(pag.lista.concat(SIT.niveis), "Nordeste e Semiárido");
  $("#baixar-ne-csv").onclick = () => {
    const n = v => (v == null ? "" : String(v).replace(".", ","));
    const l = [
      [
        "estado",
        "acompanhados",
        "com_volume",
        "so_nivel",
        "so_nivel_com_leitura_janela",
        "com_volume_medido_janela",
        "sem_informacao",
        "retirados_do_acompanhamento",
        "capacidade_total_hm3",
        "capacidade_equivalente_hm3",
        "volume_hm3",
        "volume_pct",
        "restricao",
        "atencao",
        "normal"
      ].join(";")
    ].concat(
      SIT.estados.map(e =>
        [
          e.estado,
          e.n,
          e.n_vol,
          e.nivel_n,
          e.nivel,
          e.com_dado,
          e.sem_info,
          e.ocultos,
          n(round1(e.capacidade_hm3)),
          n(round1(e.capacidade_com_dado_hm3)),
          n(round1(e.volume_hm3)),
          n(round1(e.volume_pct)),
          e.faixas.restricao,
          e.faixas.atencao,
          e.faixas.normal
        ].join(";")
      )
    );
    baixarArquivo(
      new Blob(["\uFEFF" + l.join("\r\n")], { type: "text/csv;charset=utf-8" }),
      `sar_ne_estados_${contexto.dataRef}.csv`
    );
    toast("CSV gerado. (Na página publicada no claude.ai o download é bloqueado; abra o arquivo local.)");
  };
};
const abrirEstado = uf => {
  if (temPagina(uf)) location.hash = "ne/" + uf;
  else toast(`${NEd.estados.find(e => e.uf === uf).estado}: nenhum reservatório acompanhado, sem página de estado.`);
};
function acenderUF(uf) {
  $$("#mapa-ne .uf-ne").forEach(g => {
    const ativa = !!uf && g.dataset.uf === uf;
    g.classList.toggle("acesa", ativa);
    g.classList.toggle("apagada", !!uf && !ativa); // mesma leitura do mapa do SIN
  });
  contornoAceso($("#mapa-ne svg"), uf && $(`#mapa-ne .uf-ne[data-uf="${uf}"]`), ".rot-uf");
  $$("#corpo-estados tr").forEach(tr => tr.classList.toggle("acesa", tr.dataset.uf === uf));
}
function mapaNE(host) {
  const mp = {}; // estado do mapa, passado às funções abaixo

  const M = NEd.mapa;
  const svg = svgEl("svg", {
    viewBox: `0 0 ${M.w} ${M.h}`,
    role: "img",
    "aria-label": "Estados do módulo Nordeste e Semiárido pelo volume acumulado, com o contorno do Semiárido"
  });
  const defs = svgEl("defs");
  const pat = svgEl("pattern", {
    id: "hachura-semi",
    width: 7,
    height: 7,
    patternUnits: "userSpaceOnUse",
    patternTransform: "rotate(45)"
  });
  pat.append(svgEl("line", { x1: 0, y1: 0, x2: 0, y2: 7, stroke: "#6B5B45", "stroke-width": 1, opacity: 0.55 }));
  defs.append(pat);
  svg.append(defs);
  mp.areas = {};
  M.ufs.forEach(u => {
    // parte do estado fora do módulo: só contorno, sem cor
    if (u.contorno)
      svg.append(
        svgEl("path", {
          d: u.contorno,
          fill: "none",
          stroke: COR.linhaForte,
          "stroke-width": 1.2,
          "stroke-dasharray": "4 3",
          "pointer-events": "none"
        })
      );
  });
  M.ufs.forEach(u => {
    const p = svgEl("path", {
      d: u.d,
      stroke: COR.branco,
      "stroke-width": 2.2,
      "stroke-linejoin": "round",
      class: "uf-ne"
    });
    p.dataset.uf = u.uf;
    p.style.cursor = "pointer";
    mp.areas[u.uf] = p;
    p.addEventListener("pointerenter", () => acenderUF(u.uf));
    p.addEventListener("pointerleave", () => acenderUF(null));
    p.addEventListener("click", () => abrirEstado(u.uf));
    svg.append(p);
  });
  // as siglas ficam num grupo à parte: o estado aceso é movido para logo antes dele, para o traço da borda
  // não ser coberto pelo vizinho desenhado depois
  const gRot = svgEl("g", { class: "rot-uf" });
  M.ufs.forEach(u => {
    const tx = svgEl("text", {
      x: u.rot[0],
      y: u.rot[1],
      "text-anchor": "middle",
      "font-size": 13,
      "font-weight": 700,
      "font-family": "Arial",
      fill: COR.tinta,
      "paint-order": "stroke",
      stroke: COR.branco,
      "stroke-width": 3,
      "pointer-events": "none"
    });
    tx.textContent = u.uf;
    gRot.append(tx);
    if (u.uf === "MG") {
      // em MG o módulo acompanha só o que está no semiárido
      const obs = svgEl("text", {
        x: u.rot[0],
        y: u.rot[1] + 15,
        "text-anchor": "middle",
        "font-size": 10.5,
        "font-family": "Arial",
        fill: COR.tinta2,
        "paint-order": "stroke",
        stroke: COR.branco,
        "stroke-width": 3,
        "pointer-events": "none"
      });
      obs.textContent = "só o semiárido";
      gRot.append(obs);
    }
  });
  if (M.semiarido) {
    // delimitação do Semiárido por cima dos estados, antes das siglas
    svg.append(
      svgEl("path", {
        d: M.semiarido,
        fill: "url(#hachura-semi)",
        stroke: "#6B5B45",
        "stroke-width": 1,
        "stroke-opacity": 0.75,
        "pointer-events": "none",
        class: "semi-ne"
      })
    );
  }
  svg.append(gRot);
  svg.addEventListener("pointerleave", () => acenderUF(null)); // como no mapa das bacias do SIN
  host.innerHTML = "";
  host.append(svg);
  // viewBox justo ao desenho (o quadro de origem tem margem larga dos lados)
  try {
    const b = svg.getBBox(),
      f = 8;
    if (b.width > 0) svg.setAttribute("viewBox", `${b.x - f} ${b.y - f} ${b.width + 2 * f} ${b.height + 2 * f}`);
  } catch {
    /* sem getBBox (svg ainda fora da tela): fica o viewBox original */
  }
  atualizarNE(mp);
  return { atualizar: (...a) => atualizarNE(mp, ...a) };
}

const atualizarNE = mp =>
  SIT.estados.forEach(e => {
    const p = mp.areas[e.uf];
    p.setAttribute("fill", corUF(e.volume_pct));
    p.setAttribute("fill-opacity", e.volume_pct == null ? 0.75 : 0.95);
  });
function paginaEstadoNE(uf) {
  if (temPagina(uf)) return paginaEstado(uf);
  location.hash = "ne";
}
async function kmzEstadoNE(lista, estado) {
  const x = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const com = lista.filter(r => r.lat != null && r.modo !== "nivel"),
    niv = lista.filter(r => r.lat != null && r.modo === "nivel");
  const pasta = k => {
    const L = com.filter(r => r.faixa === k);
    return L.length
      ? `<Folder><name>${x(ROT_FAIXA(k))}</name>${L.map(
          r =>
            `<Placemark><name>${x(caso(r.nome))}</name><styleUrl>#${k}</styleUrl><description><![CDATA[<b>${r.volume_pct == null ? "sem informação" : fmt(r.volume_pct, 1) + "% do volume · " + FX[k].rot.toLowerCase()}</b><br>Estado: ${x((NEd.estados.find(e => e.uf === r.uf) || {}).estado || estado || "–")}<br>Capacidade: ${r.capacidade_hm3 == null ? "–" : fmt(r.capacidade_hm3, 1)} hm³<br>Cota: ${r.cota == null ? "–" : fmt(r.cota, 2)} m<br>Volume: ${r.volume_hm3 == null ? "–" : fmt(r.volume_hm3, 1)} hm³<br>Município: ${x(r.municipio || "–")}<br>Bacia: ${x(caso(r.bacia || "–"))}<br>Medição usada: ${r.data ? dBR(r.data) : "–"} (${dDias(r)})]]></description><Point><coordinates>${r.lon},${r.lat},0</coordinates></Point></Placemark>`
        ).join("")}</Folder>`
      : "";
  };
  const pastaNivel = () =>
    niv.length
      ? `<Folder><name>Só nível (sem curva cota-volume)</name>${niv
          .map(
            r =>
              `<Placemark><name>${x(caso(r.nome))}</name><styleUrl>#nv_${r.sem_info ? "sem" : r.tend}</styleUrl><description><![CDATA[<b>${r.nivel_m == null ? "sem leitura na janela" : fmt(r.nivel_m, 2) + " m de nível"}</b><br>Em 30 dias: ${r.var30 == null ? (r.sem_info ? "–" : "sem comparação") : sinal(r.var30) + " m"}<br>Município: ${x(r.municipio || "–")}<br>Leitura usada: ${r.data ? dBR(r.data) + " (" + dDias(r) + ")" : "última em " + (r.ultima ? dBR(r.ultima) : "–")}<br>Leitura do observador, não validada; sem volume por falta de curva cota-volume.]]></description><Point><coordinates>${r.lon},${r.lat},0</coordinates></Point></Placemark>`
          )
          .join("")}</Folder>`
      : "";
  const estilos = {};
  ["restricao", "atencao", "normal", "sem"].forEach(
    k => (estilos[k] = { forma: "circulo", cor: FX[k].cor, escala: 0.7 })
  );
  if (niv.length)
    Object.assign(estilos, {
      nv_sobe: { forma: "sobe", cor: COR_NV },
      nv_desce: { forma: "desce", cor: COR_NV },
      nv_est: { forma: "est", cor: COR_NV },
      nv_semcomp: { forma: "vazio", cor: COR_NV },
      nv_sem: { forma: "est", cor: COR_NV_SEM }
    });
  const grupos = [
    {
      titulo: "Reservatório com volume, pela faixa",
      itens: ["restricao", "atencao", "normal", "sem"].map(k => ({ r: ROT_FAIXA(k), cor: FX[k].cor, forma: "circulo" }))
    }
  ];
  if (niv.length)
    grupos.push({
      titulo: "Só nível, variação em 30 dias",
      itens: [
        { r: "subiu", cor: COR_NV, forma: "sobe" },
        { r: "desceu", cor: COR_NV, forma: "desce" },
        { r: `estável (menos de ${fmt(LIM_EST * 100, 0)} cm)`, cor: COR_NV, forma: "est" },
        { r: "sem comparação (sem leitura perto de 30 dias antes)", cor: COR_NV, forma: "vazio" },
        { r: "sem leitura na janela", cor: COR_NV_SEM, forma: "est" }
      ]
    });
  const kml = ["restricao", "atencao", "normal", "sem"].map(pasta).join("") + pastaNivel();
  await montarKMZ({
    arquivo: `sar_${estado.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/\s+/g, "_")}_${contexto.dataRef}.kmz`,
    nome: `SAR · ${estado} · data de referência ${dBR(contexto.dataRef)}`,
    n: com.length + niv.length,
    descricao:
      `Reservatórios do módulo Nordeste e Semiárido: ${xk(estado)}, na data de referência ${dBR(contexto.dataRef)}. Cada reservatório entra com a medição mais próxima, até ${NEd.limiar_dias} dias antes ou depois.` +
      (niv.length ? ` Só nível: reservatório sem curva cota-volume validada, acompanhado pelo nível, sem volume.` : ""),
    legenda: { titulo: `${estado} · ${dBR(contexto.dataRef)}`, grupos },
    estilos,
    corpo: kml
  });
}
async function pdfTabelaEstado(lista, niv, estado, uf) {
  const pdf = { lista, niv, estado }; // estado do documento, passado às funções abaixo

  try {
    await carregarScript(CDN_JSPDF);
    await carregarScript(CDN_AUTOTABLE);
  } catch {
    toast("Não foi possível carregar a biblioteca de PDF (rede bloqueada neste ambiente).");
    return;
  }
  pdf.doc = new window.jspdf.jsPDF({ orientation: "landscape", unit: "pt", format: "a4", compress: true });
  cabecalhoPdfEstado(pdf);
  tabelasPdfEstado(pdf);
  rodapePDF(pdf.doc);
  pdf.doc.save(`sar_${uf.toLowerCase()}_${contexto.dataRef}.pdf`);
  toast("PDF gerado. (Na página publicada no claude.ai o download é bloqueado; abra o arquivo local.)");
}

// título e texto de apresentação do PDF
function cabecalhoPdfEstado(pdf) {
  const larg = pdf.doc.internal.pageSize.getWidth();
  pdf.doc.setFont("helvetica", "bold");
  pdf.doc.setFontSize(15);
  pdf.doc.setTextColor(...AZUL);
  pdf.doc.text(`${pdf.estado} · reservatórios · data de referência ${dBR(contexto.dataRef)}`, 40, 46);
  pdf.doc.setFont("helvetica", "normal");
  pdf.doc.setFontSize(8.5);
  pdf.doc.setTextColor(...CINZA);
  pdf.doc.text(
    pdf.doc.splitTextToSize(
      `${pdf.lista.length + pdf.niv.length} reservatórios, na ordem das tabelas em tela · cada um com a leitura de data mais próxima de ${dBR(contexto.dataRef)}, até ${NEd.limiar_dias} dias antes ou depois; fora dessa janela, sem informação e fora do volume acumulado.` +
        (pdf.niv.length
          ? ` Só nível: reservatório sem curva cota-volume validada, acompanhado pelo nível, sem volume.`
          : "") +
        ` Fonte: ${NEd.fontes.medicoes}. Gerado em ${hojeBR()}.`,
      larg - 80
    ),
    40,
    61
  );
}

// tabelas dos reservatórios com volume e dos acompanhados só pelo nível
function tabelasPdfEstado(pdf) {
  const estilos = {
    styles: {
      font: "helvetica",
      fontSize: 8.5,
      textColor: TINTA,
      cellPadding: { top: 4, right: 6, bottom: 4, left: 6 },
      valign: "middle"
    },
    headStyles: { fontStyle: "bold", textColor: AZUL, halign: "right" },
    theme: "plain",
    margin: { left: 40, right: 40 },
    rowPageBreak: "avoid"
  };
  pdf.y0 = 88;
  if (pdf.lista.length) {
    if (pdf.niv.length) subtitulo(pdf, `Com volume · ${pdf.lista.length} reservatórios`);
    pdf.doc.autoTable({
      ...estilos,
      startY: pdf.y0,
      head: [
        ["Reservatório", "Município", "Bacia", "Capacidade", "Cota", "Volume", "Volume", "Medição usada", "Situação"],
        ["", "", "", "hm³", "m", "hm³", "%", "data · distância", ""]
      ],
      body: pdf.lista.map(r => [
        caso(r.nome),
        r.municipio || "–",
        caso(r.bacia || "–"),
        r.capacidade_hm3 == null ? "–" : fmt(r.capacidade_hm3, 1),
        r.cota == null ? "–" : fmt(r.cota, 2),
        r.volume_hm3 == null ? "–" : fmt(r.volume_hm3, 1),
        r.volume_pct == null ? "–" : fmt(r.volume_pct, 1),
        `${r.data ? dBR(r.data) : "–"} · ${dDias(r)}`,
        r.sem_info ? "Sem informação" : FX[r.faixa].rot
      ]),
      columnStyles: {
        0: {
          halign: "left",
          fontStyle: "bold",
          textColor: AZUL,
          cellWidth: 150,
          cellPadding: { top: 4, right: 6, bottom: 4, left: 20 }
        },
        1: { halign: "left", cellWidth: 96 },
        2: { halign: "left", cellWidth: 96 },
        3: { halign: "right", cellWidth: 62 },
        4: { halign: "right", cellWidth: 56 },
        5: { halign: "right", cellWidth: 62 },
        6: { halign: "right", cellWidth: 52 },
        7: { halign: "left", cellWidth: 110 },
        8: { halign: "left" }
      },
      didParseCell: d => cabecalho(d, [0, 1, 2, 7, 8]),
      didDrawCell: d => fios(pdf, d, i => FX[pdf.lista[i].faixa].cor)
    });
    pdf.y0 = pdf.doc.lastAutoTable.finalY + 26;
  }
  if (pdf.niv.length) {
    if (pdf.lista.length)
      subtitulo(pdf, `Só com nível · ${pdf.niv.length} reservatórios · sem curva cota-volume validada`);
    pdf.doc.autoTable({
      ...estilos,
      startY: pdf.y0,
      head: [
        ["Reservatório", "Município", "Nível", "Em 30 dias", "Leitura usada"],
        ["", "", "m", "m", "data · distância"]
      ],
      body: pdf.niv.map(r => [
        caso(r.nome),
        r.municipio || "–",
        r.nivel_m == null ? "–" : fmt(r.nivel_m, 2),
        sinal(r.var30),
        r.data ? `${dBR(r.data)} · ${dDias(r)}` : `última em ${r.ultima ? dBR(r.ultima) : "–"}`
      ]),
      columnStyles: {
        0: {
          halign: "left",
          fontStyle: "bold",
          textColor: AZUL,
          cellWidth: 180,
          cellPadding: { top: 4, right: 6, bottom: 4, left: 20 }
        },
        1: { halign: "left", cellWidth: 160 },
        2: { halign: "right", cellWidth: 90 },
        3: { halign: "right", cellWidth: 90 },
        4: { halign: "left" }
      },
      didParseCell: d => cabecalho(d, [0, 1, 4]),
      didDrawCell: d => fios(pdf, d, i => (pdf.niv[i].sem_info ? COR_NV_SEM : COR_NV))
    });
  }
}

const cabecalho = (d, esq) => {
  if (esq.includes(d.column.index)) d.cell.styles.halign = "left";
  const pl = d.column.index === 0 ? 20 : 6;
  if (d.section === "head" && d.row.index === 0) d.cell.styles.cellPadding = { top: 6, right: 6, bottom: 1, left: pl };
  if (d.section === "head" && d.row.index === 1) {
    d.cell.styles.fontStyle = "normal";
    d.cell.styles.fontSize = 7.5;
    d.cell.styles.textColor = CINZA;
    d.cell.styles.cellPadding = { top: 0, right: 6, bottom: 5, left: pl };
  }
};

const fios = (pdf, d, cor) => {
  const { x, y, width, height } = d.cell;
  if (d.section === "head" && d.row.index === 1) {
    pdf.doc.setDrawColor(...AZUL);
    pdf.doc.setLineWidth(1.4);
    pdf.doc.line(x, y + height, x + width, y + height);
  }
  if (d.section !== "body") return;
  pdf.doc.setDrawColor(...LINHA);
  pdf.doc.setLineWidth(0.5);
  pdf.doc.line(x, y + height, x + width, y + height);
  if (d.column.index === 0 && cor && d.row.index >= 0) {
    const c = cor(d.row.index);
    pdf.doc.setFillColor(parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16));
    pdf.doc.circle(x + 11, y + height / 2, 3.4, "F");
  }
};

const subtitulo = (pdf, txt) => {
  pdf.doc.setFont("helvetica", "bold");
  pdf.doc.setFontSize(10.5);
  pdf.doc.setTextColor(...AZUL);
  pdf.doc.text(txt, 40, pdf.y0);
  pdf.y0 += 8;
};

export {
  dataColetada,
  dataNoModulo,
  dDias,
  diaDe,
  ESTACOES_NV,
  FORA_VOLUME,
  FX,
  isoDia,
  kmzEstadoNE,
  legendaFaixas,
  ligarSeletor,
  NVE,
  OCULTOS,
  ordenavel,
  paginaEstadoNE,
  paginaNE,
  pdfTabelaEstado,
  resNa,
  ROT_FAIXA,
  seletorData,
  situacaoNE,
  temPagina
};
