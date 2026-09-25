/* Açudes só com nível (HidroInfoAna, sem curva cota-volume validada) ----
   Mesma regra do volume: a leitura mais próxima da data de referência, até 30 dias antes ou depois.
   Variação em 30 dias, igual no volume e no nível: contra a leitura mais próxima do dia 30 dias antes da usada,
   até FOLGA30 dias antes ou depois dele (Diego, 21/09/2026); a ficha mostra a data da leitura comparada ("desde dd/mm"). */
import { contexto } from "./contexto.js";
import { agregar, FOLGA30, medicaoNaJanela, mesAnterior, pontoLigado } from "./regras.js";
import { D, NEd, SD } from "./dados_embutidos.js";
import {
  $,
  barraBaixar,
  caso,
  COR,
  COR_NV,
  COR_NV_SEM,
  dBR,
  DESKTOP,
  esc,
  fint,
  fmt,
  ligarIndice,
  toast
} from "./base.js";
import { baixarArquivo, baixarCSVGrafico, baixarPNG, LEG_ANOS } from "./exportacao.js";
import { comoLer, graficoBarrasAnos, graficoCalendario, graficoMonitoramento, ler, VAO_MAX } from "./graficos.js";
import {
  dataColetada,
  dataNoModulo,
  dDias,
  diaDe,
  FX,
  isoDia,
  kmzEstadoNE,
  legendaFaixas,
  ligarSeletor,
  ordenavel,
  pdfTabelaEstado,
  resNa,
  ROT_FAIXA,
  seletorData
} from "./ne.js";
import { abrirFichaNE, diaAbs } from "./ficha_ne.js";

const LIM_EST = 0.05;
const ICO_NV = {
  sobe: "M7 1.5 L12.5 11.5 L1.5 11.5 Z",
  desce: "M1.5 2.5 L12.5 2.5 L7 12.5 Z",
  est: "M7 1.2 L12.8 7 L7 12.8 L1.2 7 Z",
  semcomp: "M7 1.2 L12.8 7 L7 12.8 L1.2 7 Z"
};
// "semcomp": leitura na janela sem leitura para comparar (nenhuma perto de 30 dias antes), losango vazado
const tracoNV = (tend, cor, borda) =>
  tend === "semcomp"
    ? `fill="${COR.branco}" stroke="${COR_NV}" stroke-width="1.6"`
    : `fill="${cor || COR_NV}" stroke="${COR.branco}" stroke-width="${borda}"`;
const icoNV = (tend, cor) =>
  `<svg class="nv-ico" viewBox="0 0 14 14" aria-hidden="true"><path d="${ICO_NV[tend]}" ${tracoNV(tend, cor, 1)}/></svg>`;
const icoDe = r => (r.sem_info ? icoNV("est", COR_NV_SEM) : icoNV(r.tend));
const sinal = (v, n = 2) => (v == null ? "–" : (v > 0 ? "+" : v < 0 ? "−" : "") + fmt(Math.abs(v), n));
const legendaNivel = () =>
  `<div class="legenda"><span>Só nível, variação em 30 dias:</span><span>${icoNV("sobe")}subiu</span><span>${icoNV("desce")}desceu</span>` +
  `<span>${icoNV("est")}estável (menos de ${fmt(LIM_EST * 100, 0)} cm)</span><span>${icoNV("semcomp")}sem comparação</span><span>${icoNV("est", COR_NV_SEM)}sem leitura na janela</span></div>`;
const PREP = {
  PI: ["no", "do"],
  AL: ["em", "de"],
  SE: ["em", "de"],
  CE: ["no", "do"],
  MA: ["no", "do"],
  PB: ["na", "da"],
  PE: ["em", "de"],
  RN: ["no", "do"],
  BA: ["na", "da"],
  MG: ["em", "de"]
};

function nivelNa(st) {
  const alvo = diaDe(contexto.dataRef),
    s = st.s;
  const k0 = medicaoNaJanela(s, alvo, NEd.limiar_dias, x => x[0]);
  const ultima = s.length ? isoDia(s[s.length - 1][0]) : null;
  if (k0 < 0)
    return {
      ...st,
      modo: "nivel",
      nivel_m: null,
      data: null,
      dias: null,
      sem_info: true,
      var30: null,
      tend: "est",
      ultima
    };
  const u = s[k0],
    alvo30 = u[0] - 30;
  let k1 = -1,
    d1 = 1e9;
  for (let k = 0; k < k0; k++) {
    const d = Math.abs(s[k][0] - alvo30);
    if (d <= FOLGA30 && d < d1) {
      d1 = d;
      k1 = k;
    }
  }
  const var30 = k1 < 0 ? null : (u[1] - s[k1][1]) / 100;
  const tend = var30 == null ? "semcomp" : var30 >= LIM_EST ? "sobe" : var30 <= -LIM_EST ? "desce" : "est";
  return {
    ...st,
    modo: "nivel",
    nivel_m: u[1] / 100,
    data: isoDia(u[0]),
    dias: alvo - u[0],
    sem_info: false,
    var30,
    tend,
    ultima
  };
}
function marcaNivel(r) {
  const ic = L.divIcon({
    className: "nv-marca",
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    html: `<svg viewBox="0 0 14 14" width="18" height="18"><path d="${ICO_NV[r.sem_info ? "est" : r.tend]}" ${tracoNV(r.sem_info ? "est" : r.tend, r.sem_info ? COR_NV_SEM : COR_NV, 1.2)}/></svg>`
  });
  return L.marker([r.lat, r.lon], { icon: ic }).bindTooltip(
    `<div class="pop"><b>${esc(caso(r.nome))}</b>` +
      `<div class="valor num">${r.nivel_m == null ? "sem leitura" : fmt(r.nivel_m, 2) + " <small>m de nível</small>"}</div>` +
      `<div class="l"><span>Em 30 dias</span><span class="num">${r.var30 == null ? (r.sem_info ? "–" : "sem comparação") : sinal(r.var30) + " m"}</span></div>` +
      `<div class="l"><span>Município</span><span>${esc(r.municipio || "–")}</span></div>` +
      `<div class="l"><span>Leitura usada</span><span>${r.data ? dBR(r.data) + " · " + dDias(r) : "última em " + (r.ultima ? dBR(r.ultima) : "–")}</span></div>` +
      `<div class="l"><span>Volume</span><span>sem curva cota-volume</span></div></div>`,
    { direction: "top", offset: [0, -8], opacity: 1 }
  );
}

const qtd = (n, um, varios) => `${fint(n)} ${n === 1 ? um : varios}`;

const SD_INI = SD.inicio ? Math.round(Date.parse(SD.inicio + "T00:00:00Z") / 864e5) : 0; // diaAbs vem depois (ficha_ne.js)
const ANOS_SERIE = 5; // anos sobrepostos em "Ao longo do ano" e barras do "Mesmo dia", como no SIN (Diego, 18/09/2026)
const temSerie = g => !!(SD.series[g] && SD.series[g].pct.some(v => v != null));
function serieNa(g, iso) {
  const S = SD.series[g],
    k = diaAbs(iso) - SD_INI;
  if (!S || k < 0 || k >= S.pct.length || S.pct[k] == null) return null;
  return { v: S.pct[k], n: S.n[k], cap: S.cap[k], troca: S.troca[k] };
}
// pontos mensais (mesAnterior e pontoLigado em regras.js); atual: o valor da página na data de referência ({v, n, cap}), para o último ponto ser o número da página
function pontosMensais(g, ref, anoMin, atual) {
  const pts = {},
    info = {},
    quebras = [];
  for (let iso = ref; +iso.slice(0, 4) >= anoMin; iso = mesAnterior(iso)) {
    const x = serieNa(g, iso),
      y = iso === ref && atual && atual.v != null ? { ...(x || {}), ...atual } : x;
    if (!y) continue;
    pts[iso] = y.v;
    info[iso] = y;
    if (!pontoLigado(y.troca, SD.limiar_troca_pct)) quebras.push(iso);
  }
  return { pts, info, quebras };
}
function desenharSerie(g, host, rotulo, atual) {
  const anoR = +contexto.dataRef.slice(0, 4),
    anoMin = Math.max(anoR - ANOS_SERIE + 1, SD.ano_inicial || anoR);
  const { pts, info, quebras } = pontosMensais(g, contexto.dataRef, anoMin, atual);
  const anos = [];
  for (let a = anoMin; a <= anoR; a++) if (Object.keys(pts).some(iso => +iso.slice(0, 4) === a)) anos.push(a);
  graficoCalendario(host, pts, {
    anos,
    anoAtual: anoR,
    dec: 1,
    unidade: "%",
    pct: true,
    marcaDia: contexto.dataRef,
    rotulo,
    maxVao: 35,
    tol: 16,
    quebras,
    csvExtra: {
      cols: ["reservatorios_medidos", "capacidade_equivalente_hm3", "troca_de_reservatorios_pct"],
      f: iso => [info[iso].n, Math.round(info[iso].cap), info[iso].troca == null ? "" : info[iso].troca]
    }
  });
  return anos;
}
// devolve todos os anos desde o ano inicial (para as comparações); o gráfico mostra os cinco anos até a data
function mesmoDiaSerie(g, host, rotulo, atual) {
  const mmdd = contexto.dataRef.slice(5) === "02-29" ? "02-28" : contexto.dataRef.slice(5),
    anoR = +contexto.dataRef.slice(0, 4),
    dados = [];
  for (let a = SD.ano_inicial || anoR; a <= anoR; a++) {
    const iso = a === anoR ? contexto.dataRef : `${a}-${mmdd}`;
    const x = a === anoR && atual && atual.v != null ? atual : serieNa(g, iso);
    dados.push({ a, v: x ? x.v : null, n: x ? x.n : null, cap: x ? Math.round(x.cap) : null, rot: dBR(iso) });
  }
  graficoBarrasAnos(
    host,
    dados.filter(d => d.a > anoR - ANOS_SERIE),
    {
      anoAtual: anoR,
      dec: 1,
      unidade: "%",
      pct: true,
      rotulo,
      legenda: "Volume acumulado",
      extras: [
        { campo: "n", col: "reservatorios_medidos", rot: "Reservatórios medidos" },
        { campo: "cap", col: "capacidade_equivalente_hm3", rot: "Capacidade equivalente", unidade: "hm³" }
      ]
    }
  );
  return dados;
}
// o que é cada ponto e por que a linha se interrompe, em linguagem simples (Diego, 23/09/2026)
const NOTA_SERIE = [
  `<b>Pontos.</b> Cada ponto é o volume acumulado de uma data, com a mesma conta do valor da página: o volume dos reservatórios medidos até ${NEd.limiar_dias} dias antes ou depois dela, em % da capacidade desses mesmos reservatórios. Há um ponto por mês, no mesmo dia do mês da data de referência. A série começa em ${SD.ano_inicial}, primeiro ano em que as medições passaram a reunir a maior parte da capacidade dos reservatórios do Nordeste.`,
  `<b>Linha interrompida.</b> Nem todos os reservatórios são medidos todos os meses. Quando o conjunto de reservatórios medidos muda muito de um mês para o outro (os que entram ou saem somam mais de ${SD.limiar_troca_pct}% da capacidade), os dois pontos não são ligados, para que a mudança não pareça ganho ou perda de água. O CSV do gráfico traz, para cada ponto, o número de reservatórios medidos e a capacidade equivalente.`
];

// minigráfico de 12 meses: eixo de tempo real, vão longo sem ligar, ponto na leitura usada
function miniNE(host, pts, usado, dec, unid) {
  if (!host) return;
  const W = Math.max(60, Math.round(host.getBoundingClientRect().width) || 132),
    H = 30,
    m = 3,
    X1 = diaDe(NEd.serie_ate),
    P = pts.filter(p => p[1] != null);
  if (!P.length) {
    host.innerHTML = '<span class="sem">–</span>';
    host.title = "sem leitura nos 12 meses";
    return;
  }
  const vs = P.map(p => p[1]),
    lo = Math.min(...vs),
    hi = Math.max(...vs);
  const x = dd => m + (dd / X1) * (W - 2 * m),
    y = v => (hi > lo ? H - m - ((v - lo) * (H - 2 * m)) / (hi - lo) : H / 2);
  let d = "",
    ant = null;
  P.forEach(([dd, v]) => {
    d += (ant == null || dd - ant > VAO_MAX ? "M" : "L") + x(dd).toFixed(1) + " " + y(v).toFixed(1);
    ant = dd;
  });
  const soltos = P.filter(
    ([dd], i) => (!P[i - 1] || dd - P[i - 1][0] > VAO_MAX) && (!P[i + 1] || P[i + 1][0] - dd > VAO_MAX)
  );
  host.innerHTML =
    `<svg width="100%" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true"><path d="${d}" fill="none" stroke="${COR.ana}" stroke-width="1.4" stroke-linejoin="round"/>` +
    soltos
      .map(([dd, v]) => `<circle cx="${x(dd).toFixed(1)}" cy="${y(v).toFixed(1)}" r="1.5" fill="${COR.ana}"/>`)
      .join("") +
    (usado
      ? `<circle cx="${x(usado[0]).toFixed(1)}" cy="${y(usado[1]).toFixed(1)}" r="2.4" fill="${COR.vermelho}"/>`
      : "") +
    `</svg>`;
  host.title =
    `${dBR(NEd.serie_de)} a ${dBR(NEd.serie_ate)}: ${P.length} leituras, mínimo ${fmt(lo, dec)} e máximo ${fmt(hi, dec)} ${unid}` +
    (usado ? `; em vermelho, a leitura usada` : "");
}
function paginaEstado(uf) {
  const pag = { uf }; // estado da página, passado às funções abaixo

  dataNoModulo();
  const NV = NEd.nivel.estados[pag.uf];
  pag.estado = NEd.estados.find(e => e.uf === pag.uf).estado;
  const [em, de] = PREP[pag.uf] || ["em", "de"];
  pag.F = NEd.nivel.filtro;
  pag.de = de;
  pag.temVol = NV.volume.length > 0;
  pag.temNiv = NV.nivel.length > 0;
  pag.misto = pag.temVol && pag.temNiv;
  pag.vol = NV.volume.map(i => resNa(i));
  pag.niv = NV.nivel.map((st, k) => ({ _st: st, _k: k, ...nivelNa(st) }));
  pag.vol.sort((a, b) => (b.capacidade_hm3 || 0) - (a.capacidade_hm3 || 0));
  pag.niv.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  pag.oc = NV.ocultos;
  pag.n = pag.vol.length + pag.niv.length;
  pag.comSerie = pag.temVol && temSerie(pag.uf); // a série é do volume: estado só com nível não tem "Ao longo do ano"
  pag.temHidro = Object.values(NV.hist).some(h => h.hidro);
  const quando = !pag.oc.n
    ? ""
    : pag.oc.ultima_de === pag.oc.ultima_ate
      ? `em ${dBR(pag.oc.ultima_de)}`
      : `entre ${dBR(pag.oc.ultima_de)} e ${dBR(pag.oc.ultima_ate)}`;
  pag.descartadas = NV.nivel.reduce((a, s) => a + s.descartadas, 0);
  pag.secoes = [
    ["u-mapa", "Mapa"],
    ["u-tab", "Reservatórios"]
  ].concat(
    pag.comSerie
      ? [
          ["u-ano", "Ao longo do ano"],
          ["u-dia", "Mesmo dia em outros anos"]
        ]
      : [],
    [["u-hist", "Monitoramento"]]
  );
  pag.lead = pag.misto
    ? "Parte dos reservatórios tem volume calculado. Os demais ainda não têm curva cota-volume validada: para eles a página mostra o nível."
    : pag.temVol
      ? `Todos os reservatórios acompanhados ${em} ${pag.estado} têm volume calculado.`
      : `Nenhum reservatório ${pag.de} ${pag.estado} tem volume calculado hoje: sem curva cota-volume validada, a página mostra o nível.`;
  pag.aviso = [
    pag.temNiv
      ? `<p><b>Como ler o nível.</b> O nível mostra se o reservatório subiu ou desceu, não quanta água há: sem a curva cota-volume não há volume nem percentual, e esses reservatórios ficam fora do volume acumulado.</p>`
      : "",
    pag.oc.n
      ? `<p><b>${fint(pag.oc.n)} reservatórios</b> cadastrados ${em} ${pag.estado} foram retirados do acompanhamento (última leitura ${quando}): eles saem desta página e seguem na área de dados.</p>`
      : "",
    ...NV.a_verificar.map(
      x =>
        `<p><b>${esc(caso(x.nome))}</b> tem leitura, mas a série tem um salto de ${fmt(x.maior_salto_cm / 100, 1)} m entre duas leituras seguidas, que precisa ser conferido antes de entrar.</p>`
    )
  ].join("");
  $("#titulo-pag").innerHTML = tituloEstado(pag);
  pag.tabVol = `<div class="tab-box"><table id="tab-uf-vol">
        <thead><tr><th data-ord="nome">Reservatório</th><th data-ord="municipio">Município</th><th data-ord="bacia">Bacia</th><th class="r" data-ord="capacidade_hm3" data-tipo="num">Capacidade</th><th class="r" data-ord="cota" data-tipo="num">Cota</th><th class="r" data-ord="volume_hm3" data-tipo="num">Volume</th><th class="r" data-ord="volume_pct" data-tipo="num">Volume</th><th class="r" data-ord="dias" data-tipo="num">Medição usada</th>
          <th class="mini-th"><label>12 meses <select id="var-mini-uf" aria-label="Variável do minigráfico"><option value="pct" selected>volume</option><option value="cota">cota</option></select></label></th></tr>
        <tr class="unid"><th></th><th></th><th></th><th class="r">hm³</th><th class="r">m</th><th class="r">hm³</th><th class="r">%</th><th class="r">data · distância</th><th class="mini-th" id="mini-unid-uf">%</th></tr></thead>
        <tbody id="corpo-uf-vol"></tbody>
      </table></div>`;
  pag.tabNiv = `<div class="tab-box"><table id="tab-uf-niv">
        <thead><tr><th data-ord="nome">Reservatório</th><th data-ord="municipio">Município</th><th class="r" data-ord="nivel_m" data-tipo="num">Nível</th><th class="r" data-ord="var30" data-tipo="num">Em 30 dias</th><th class="r" data-ord="dias" data-tipo="num">Leitura usada</th><th class="mini-th">12 meses</th></tr>
        <tr class="unid"><th></th><th></th><th class="r">m</th><th class="r">m</th><th class="r">data · distância</th><th class="mini-th">nível, m</th></tr></thead>
        <tbody id="corpo-uf-niv"></tbody>
      </table></div>`;
  $("#conteudo").innerHTML = corpoEstado(pag);
  ligarIndice();

  pag.corpoVol = $("#corpo-uf-vol");
  pag.corpoNiv = $("#corpo-uf-niv");
  if (pag.corpoVol) ordenavel($("#tab-uf-vol"), pag.vol, (...a) => desenharVol(pag, ...a));
  if (pag.corpoNiv) ordenavel($("#tab-uf-niv"), pag.niv, (...a) => desenharNiv(pag, ...a));
  pag.mapa = mapaResNE($("#mapa-uf"), [pag.uf]);
  graficoMonitoramento($("#g-uf-hist"), NV.hist, `Reservatórios ${pag.de} ${pag.estado} com medição, por ano`, {
    ate: NEd.data
  });

  if (pag.corpoVol) $("#var-mini-uf").onchange = (...a) => minisVol(pag, ...a);

  ligarSeletor("data-uf", (...a) => aplicarEstado(pag, ...a));
  aplicarEstado(pag);

  pag.u = pag.uf.toLowerCase();
  if (pag.comSerie) {
    $("#baixar-uf-ano").onclick = () =>
      baixarPNG(
        [$("#g-uf-ano svg")],
        `sar_${pag.u}_ao_longo_do_ano_ate_${contexto.dataRef}.png`,
        `${pag.estado} · volume acumulado ao longo do ano`,
        LEG_ANOS(+contexto.dataRef.slice(0, 4))
      );
    $("#baixar-uf-dia").onclick = () =>
      baixarPNG(
        [$("#g-uf-dia svg")],
        `sar_${pag.u}_mesmo_dia_${contexto.dataRef}.png`,
        `${pag.estado} · volume acumulado em ${dBR(contexto.dataRef).slice(0, 5)} de cada ano`,
        LEG_ANOS(+contexto.dataRef.slice(0, 4))
      );
  }
  $("#baixar-uf-hist").onclick = () =>
    baixarPNG(
      [$("#g-uf-hist svg")],
      `sar_${pag.u}_historico_monitoramento.png`,
      `${pag.estado} · histórico do monitoramento`
    );
  $("#baixar-uf-hist-csv").onclick = () =>
    baixarCSVGrafico([$("#g-uf-hist")], `sar_${pag.u}_historico_monitoramento.csv`);
  if (pag.comSerie) {
    $("#baixar-uf-ano-csv").onclick = () =>
      baixarCSVGrafico([$("#g-uf-ano")], `sar_${pag.u}_ao_longo_do_ano_ate_${contexto.dataRef}.csv`);
    $("#baixar-uf-dia-csv").onclick = () =>
      baixarCSVGrafico([$("#g-uf-dia")], `sar_${pag.u}_mesmo_dia_${contexto.dataRef}.csv`);
  }
  ligarDownloadsEstado(pag);
}

const doDia = pag => {
  pag.vol.forEach(l => Object.assign(l, resNa(l.i)));
  pag.niv.forEach(l => Object.assign(l, nivelNa(l._st)));
};

const num = (pag, id) => pag.secoes.findIndex(s => s[0] === id) + 1;

const tituloEstado = pag =>
  `
    <p class="trilha"><a href="#inicio">Início</a><span class="sep">›</span><a href="#ne">Nordeste e Semiárido</a><span class="sep">›</span>${pag.estado}</p>
    <h1>${pag.estado}</h1>
    <p class="lead">${pag.lead}</p>
    <div class="carimbo"><span><b>${fint(pag.n)}</b> reservatórios</span>${pag.misto ? `<span><b>${fint(pag.vol.length)}</b> com volume</span><span><b>${fint(pag.niv.length)}</b> só com nível</span>` : ""}<span id="carimbo-uf"></span></div>
    ${seletorData("data-uf")}`;

const corpoEstado = pag =>
  `
    <nav class="indice" aria-label="Seções da página">${pag.secoes.map(([id, r]) => `<a href="#ne/${pag.uf}" data-alvo="${id}">${r}</a>`).join("")}</nav>
    ${pag.aviso ? `<div class="aviso-nivel">${pag.aviso}</div>` : ""}
    <section class="cartao secao" id="u-mapa" aria-labelledby="t-u-mapa">
      ${barraBaixar([["baixar-uf-kmz", "KMZ", "Baixar os reservatórios em KMZ (Google Earth), com a legenda"]])}
      <h2 id="t-u-mapa"><small>${num(pag, "u-mapa")}</small>Mapa dos reservatórios</h2>
      <p class="sub" id="sub-u-mapa"></p>
      ${pag.temVol ? legendaFaixas() : ""}${pag.temNiv ? legendaNivel() : ""}
      <div id="mapa-uf" style="position:relative"></div>
    </section>
    <section class="cartao secao tabela-bacia" id="u-tab" aria-labelledby="t-u-tab">
      ${barraBaixar([
        ["baixar-uf-csv", "CSV", "Baixar a tabela em CSV"],
        ["baixar-uf-pdf", "PDF", "Baixar a tabela em PDF"]
      ])}
      <h2 id="t-u-tab"><small>${num(pag, "u-tab")}</small>Reservatórios</h2>
      <p class="sub">${pag.temVol ? "Da maior para a menor capacidade. " : ""}Cada reservatório entra com a leitura mais próxima da data de referência, até ${NEd.limiar_dias} dias antes ou depois, com a data e a distância. O minigráfico mostra os 12 meses da série de cada um, na escala própria da linha, com a leitura usada em vermelho; o detalhe fica na ficha.<span class="dica">Clique no cabeçalho para ordenar.</span></p>
      ${pag.temVol ? (pag.misto ? `<h3 class="sub-bloco">Com volume<small>${fint(pag.vol.length)} reservatórios · entram no volume acumulado</small></h3>` : "") + pag.tabVol : ""}
      ${pag.temNiv ? (pag.misto ? `<h3 class="sub-bloco">Só com nível<small>${fint(pag.niv.length)} reservatórios · sem curva cota-volume validada</small></h3>` : "") + pag.tabNiv : ""}
    </section>
    ${
      pag.comSerie
        ? `<section class="cartao secao" id="u-ano" aria-labelledby="t-u-ano">
      ${barraBaixar([
        ["baixar-uf-ano-csv", "CSV", "Baixar os dados do gráfico em CSV"],
        ["baixar-uf-ano", "PNG", "Baixar o gráfico como imagem"]
      ])}
      <h2 id="t-u-ano"><small>${num(pag, "u-ano")}</small>Ao longo do ano</h2>
      <p class="sub">Volume acumulado dos reservatórios ${pag.de} ${pag.estado} com medição, em % da capacidade deles${pag.misto ? " (só os que têm volume; os só com nível não entram)" : ""}, com um ponto por mês nos cinco anos até a data de referência.<span class="dica">Passe o mouse para comparar o mesmo dia nos cinco anos.</span></p>
      <div class="graf" id="g-uf-ano"></div>
      ${comoLer(ler("anos"), ler("cinco"), ler("cursor"), ...NOTA_SERIE)}
    </section>`
        : ""
    }
    ${
      pag.comSerie
        ? `<section class="cartao secao" id="u-dia" aria-labelledby="t-u-dia">
      ${barraBaixar([
        ["baixar-uf-dia-csv", "CSV", "Baixar os dados do gráfico em CSV"],
        ["baixar-uf-dia", "PNG", "Baixar o gráfico como imagem"]
      ])}
      <h2 id="t-u-dia"><small>${num(pag, "u-dia")}</small>Mesmo dia em outros anos</h2>
      <p class="sub" id="sub-u-dia"></p>
      <div class="graf" id="g-uf-dia"></div>
      ${comoLer(ler("dia"), "<b>Escala.</b> O eixo vertical vai de 0 a 100%.")}
    </section>`
        : ""
    }
    <section class="cartao secao" id="u-hist" aria-labelledby="t-u-hist">
      ${barraBaixar([
        ["baixar-uf-hist-csv", "CSV", "Baixar os dados do gráfico em CSV"],
        ["baixar-uf-hist", "PNG", "Baixar o gráfico como imagem"]
      ])}
      <h2 id="t-u-hist"><small>${num(pag, "u-hist")}</small>Histórico do monitoramento</h2>
      <p class="sub">Reservatórios ${pag.de} ${pag.estado} com pelo menos uma medição em cada ano: com volume${pag.temHidro ? " e só com nível" : ""}. Mostra quando o acompanhamento começou, parou ou passou a ter só o nível.</p>
      <div class="graf" id="g-uf-hist"></div>
      ${comoLer(`<b>Barras.</b> Para cada ano, a barra azul-escura conta os reservatórios com ao menos uma medição de volume${pag.temHidro ? ", e a azul-clara, os que só têm leitura de nível" : ""}. A queda de um ano para o outro indica que parte dos reservatórios deixou de ser medida, e não variação do volume armazenado.`)}
    </section>
    <p class="nota fontes-inicio" id="fontes-uf"></p>`;

const fichaToast = r => abrirFichaNE(r);

const desenharVol = pag => {
  if (!pag.corpoVol) return;
  pag.corpoVol.innerHTML = "";
  pag.vol.forEach(r => {
    const tr = document.createElement("tr");
    tr.dataset.res = r.nome;
    tr.tabIndex = 0;
    tr.innerHTML = `<td><i class="bola" style="background:${FX[r.faixa].cor}"></i><span class="nm">${esc(caso(r.nome))}</span></td>
        <td>${esc(r.municipio || "–")}</td><td>${esc(caso(r.bacia || "–"))}</td>
        <td class="r num">${r.capacidade_hm3 == null ? "–" : fmt(r.capacidade_hm3, 1)}</td>
        <td class="r num">${r.cota == null ? "–" : fmt(r.cota, 2)}</td>
        <td class="r num">${r.volume_hm3 == null ? "–" : fmt(r.volume_hm3, 1)}</td>
        <td class="r num">${r.volume_pct == null ? "–" : fmt(r.volume_pct, 1)}</td>
        <td class="r"><span class="num">${r.data ? dBR(r.data) : "–"}</span><small class="dias${r.sem_info ? " velho" : ""}"> ${dDias(r)}</small></td>
        <td class="mini"><span class="mini-svg" data-mini-ne="${r.i}"></span></td>`;
    tr.addEventListener("click", () => fichaToast(r));
    pag.corpoVol.append(tr);
  });
  minisVol(pag);
};

const desenharNiv = pag => {
  if (!pag.corpoNiv) return;
  pag.corpoNiv.innerHTML = "";
  pag.niv.forEach(r => {
    const tr = document.createElement("tr");
    tr.dataset.res = r.nome;
    tr.tabIndex = 0;
    tr.innerHTML = `<td>${icoDe(r)}<span class="nm">${esc(caso(r.nome))}</span></td>
        <td>${esc(r.municipio || "–")}</td>
        <td class="r num">${r.nivel_m == null ? "–" : fmt(r.nivel_m, 2)}</td>
        <td class="r num">${sinal(r.var30)}</td>
        <td class="r"><span class="num">${r.data ? dBR(r.data) : "–"}</span><small class="dias${r.sem_info ? " velho" : ""}"> ${r.sem_info ? "última em " + (r.ultima ? dBR(r.ultima) : "–") : dDias(r)}</small></td>
        <td class="mini"><span class="mini-svg" data-mini-niv="${r._k}"></span></td>`;
    tr.addEventListener("click", () => fichaToast(r));
    pag.corpoNiv.append(tr);
  });
  minisNiv(pag);
};

// minigráficos: redesenhados a cada ordenação e a cada troca de data ou de variável
const minisVol = pag => {
  if (!pag.corpoVol) return;
  const k = $("#var-mini-uf").value,
    col = k === "cota" ? 3 : 1,
    dec = k === "cota" ? 2 : 1,
    un = k === "cota" ? "m" : "%";
  $("#mini-unid-uf").textContent = un;
  pag.vol.forEach(r => {
    const pts = NEd.reservatorios[r.i].s.map(p => [p[0], p[col]]);
    const u = r.data ? pts.find(p => p[0] === diaDe(r.data) && p[1] != null) : null;
    miniNE($(`[data-mini-ne="${r.i}"]`), pts, u, dec, un);
  });
};

const minisNiv = pag =>
  pag.niv.forEach(r =>
    miniNE(
      $(`[data-mini-niv="${r._k}"]`),
      r._st.s.map(p => [p[0], p[1] / 100]),
      r.data ? [diaDe(r.data), r.nivel_m] : null,
      2,
      "m"
    )
  );

const aplicarEstado = pag => {
  doDia(pag);
  desenharVol(pag);
  desenharNiv(pag);
  const ref = dBR(contexto.dataRef),
    coletada = dataColetada();
  const partes = [];
  if (pag.temVol) {
    const E = agregar(pag.vol);
    partes.push(
      pag.misto
        ? `volume acumulado dos <b>${fint(E.com_dado)}</b> com volume na janela <b>${E.volume_pct == null ? "–" : fmt(E.volume_pct, 1) + "%"}</b>`
        : `<b>${fint(E.com_dado)}</b> com medição na janela de ${NEd.limiar_dias} dias · volume acumulado <b>${E.volume_pct == null ? "–" : fmt(E.volume_pct, 1) + "%"}</b>`
    );
  }
  if (pag.temNiv) {
    const com = pag.niv.filter(r => !r.sem_info);
    partes.push(
      `<b>${fint(com.length)}</b> de ${fint(pag.niv.length)} com leitura de nível na janela · ${qtd(com.filter(r => r.tend === "sobe").length, "subiu", "subiram")} e ${qtd(com.filter(r => r.tend === "desce").length, "desceu", "desceram")} em 30 dias`
    );
  }
  $("#carimbo-uf").innerHTML = partes.join(" · ");
  $("#sub-u-mapa").innerHTML =
    (pag.temVol && !pag.temNiv
      ? `Cada reservatório pela faixa do seu volume em ${ref}. Os sem informação aparecem em cinza.`
      : `${pag.temVol ? "Reservatórios com volume pela faixa do volume; reservatórios" : "Reservatórios"} só com nível pela variação em 30 dias até a leitura usada, na data de referência de ${ref}.`) +
    '<span class="dica">Passe o mouse para ler os valores.</span>';
  pag.mapa.atualizar([...pag.vol, ...pag.niv].filter(r => r.lat != null));
  if (pag.comSerie) {
    const E = agregar(pag.vol),
      atual = { v: E.volume_pct, n: E.com_dado, cap: E.capacidade_com_dado_hm3 };
    desenharSerie(
      pag.uf,
      $("#g-uf-ano"),
      `Volume acumulado ${pag.de} ${pag.estado} (% da capacidade dos reservatórios medidos)`,
      atual
    );
    $("#sub-u-dia").textContent =
      `Volume acumulado ${pag.de} ${pag.estado} em ${ref.slice(0, 5)} de cada um dos cinco anos até a data de referência, com a mesma conta do valor da página e o número de reservatórios medidos em cada ano.`;
    mesmoDiaSerie(pag.uf, $("#g-uf-dia"), `Volume acumulado ${pag.de} ${pag.estado} (%) em ${ref.slice(0, 5)}`, atual);
  }
  const fontes = [];
  if (pag.temVol) fontes.push(esc(NEd.fontes.medicoes));
  if (pag.comSerie) fontes.push(esc(SD.fonte) + ` (volume acumulado em cada data, desde ${SD.ano_inicial})`);
  if (pag.temVol) fontes.push(esc(NEd.fontes.coordenadas));
  fontes.push(esc(NEd.fontes.regra));
  if (pag.temNiv) fontes.push(esc(NEd.nivel.fonte));
  fontes.push(esc(NEd.nivel.fonte_hist));
  const portal = (NEd.portal_por_data[coletada] || {})[pag.uf];
  $("#fontes-uf").innerHTML =
    `Fontes: ${fontes.join("; ")}.` +
    (pag.oc.n
      ? ` No protótipo, a lista dos reservatórios retirados do acompanhamento é simulada pelos que não têm nenhuma leitura nos últimos 12 meses; no sistema, a retirada é decisão da área técnica, com data e motivo registrados.`
      : "") +
    (pag.temVol && portal != null
      ? ` Para comparação, o serviço de volume equivalente do portal dá ${fmt(portal, 1)}% em ${dBR(coletada)}${coletada === contexto.dataRef ? "" : ", a data coletada mais próxima"} (o portal inclui também reservatórios com medição fora da janela de ${NEd.limiar_dias} dias).`
      : "") +
    (pag.temNiv
      ? ` Conferência das leituras de nível antes de exibir: ${fint(pag.descartadas)} leituras descartadas neste estado, por três regras — erro grosseiro ` +
        `(mais de ${fint(pag.F.grosso_cm / 100)} m da mediana do ano da estação), pico de um dia (mais de ${fint(pag.F.pico_cm)} cm das duas leituras vizinhas, no mesmo sentido) ` +
        `e degrau que volta (salto de mais de ${fmt(pag.F.degrau_cm / 100, 1)} m desfeito em até ${fint(pag.F.volta_dias)} dias).`
      : "");
};

const ligarDownloadsEstado = pag => {
  $("#baixar-uf-kmz").onclick = () => kmzEstadoNE([...pag.vol, ...pag.niv], pag.estado);
  $("#baixar-uf-pdf").onclick = () => pdfTabelaEstado(pag.vol, pag.niv, pag.estado, pag.uf);
  $("#baixar-uf-csv").onclick = () => {
    const nn = v => (v == null ? "" : String(v).replace(".", ","));
    const l = [
      [
        "reservatorio",
        "municipio",
        "bacia",
        "modo",
        "capacidade_hm3",
        "cota_m",
        "volume_hm3",
        "volume_pct",
        "variacao_30d_m",
        "leitura_usada",
        "dias_da_referencia",
        "situacao"
      ].join(";")
    ]
      .concat(
        pag.vol.map(r =>
          [
            caso(r.nome),
            r.municipio,
            caso(r.bacia || ""),
            "volume",
            nn(r.capacidade_hm3),
            nn(r.cota),
            nn(r.volume_hm3),
            nn(r.volume_pct),
            "",
            r.data ? dBR(r.data) : "",
            r.dias ?? "",
            r.sem_info ? "sem informação" : FX[r.faixa].rot
          ].join(";")
        )
      )
      .concat(
        pag.niv.map(r =>
          [
            caso(r.nome),
            r.municipio,
            "",
            "só nível",
            "",
            nn(r.nivel_m),
            "",
            "",
            nn(r.var30 == null ? null : Math.round(r.var30 * 100) / 100),
            r.data ? dBR(r.data) : "",
            r.dias ?? "",
            r.sem_info ? "sem leitura na janela" : ""
          ].join(";")
        )
      );
    baixarArquivo(
      new Blob(["\uFEFF" + l.join("\r\n")], { type: "text/csv;charset=utf-8" }),
      `sar_${pag.u}_${contexto.dataRef}.csv`
    );
    toast("CSV gerado. (Na página publicada no claude.ai o download é bloqueado; abra o arquivo local.)");
  };
};

function mapaResNE(host, ufs, op = {}) {
  const mp = {}; // estado do mapa, passado às funções abaixo

  mp.mapa = L.map(host, { scrollWheelZoom: false, zoomSnap: 0.25 });
  const claro = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap",
    maxZoom: 18
  }).addTo(mp.mapa);
  const satelite = L.layerGroup([
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      attribution: "Esri World Imagery",
      maxZoom: 18
    }),
    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 18 }
    )
  ]);
  mp.lista = ufs || NEd.estados.map(e => e.uf);
  const feicoes = D.geo.ufs
    .filter(g => mp.lista.includes(g.uf))
    .map(g => ({
      type: "Feature",
      properties: { uf: g.uf },
      geometry: { type: "MultiPolygon", coordinates: g.aneis.map(a => [a]) }
    }));
  mp.contorno = L.geoJSON(
    { type: "FeatureCollection", features: feicoes },
    { style: { color: COR.ana, weight: mp.lista.length > 1 ? 1.2 : 2, fill: false }, interactive: false }
  ).addTo(mp.mapa);
  mp.mapa.fitBounds(mp.contorno.getBounds(), { padding: [10, 10] });
  // delimitação do Semiárido (INSA), por baixo dos pontos
  mp.semi =
    op.semiarido && NEd.mapa.semiarido_geo
      ? L.polygon(
          NEd.mapa.semiarido_geo.map(a => a.map(([x, y]) => [y, x])),
          { color: "#8A6A2E", weight: 2, dashArray: "6 4", fillColor: "#C9A45C", fillOpacity: 0.14, interactive: false }
        ).addTo(mp.mapa)
      : null;
  mp.ajustado = !op.ajuste;
  mp.grupos = {};
  mp.chaves = ["restricao", "atencao", "normal", "sem"];
  mp.chaves.forEach(k => {
    mp.grupos[k] = L.layerGroup();
    mp.grupos[k].addTo(mp.mapa);
  });
  mp.controle = L.control
    .layers({ "Mapa": claro, "Satélite": satelite }, {}, { collapsed: !!op.recolhido || !DESKTOP() })
    .addTo(mp.mapa);
  L.control.scale({ imperial: false }).addTo(mp.mapa);
  mp.camadas = [];
  mp.grupos.nivel = L.layerGroup();
  mp.grupos.nivel.addTo(mp.mapa);
  claro.on("tileerror", () => {
    if (!host.dataset.aviso) {
      host.dataset.aviso = 1;
      host.insertAdjacentHTML(
        "afterend",
        '<p class="nota">Mapa-base não carregou neste ambiente: ficam só os pontos e o contorno.</p>'
      );
    }
  });
  return { atualizar: (...a) => atualizarMapaResNE(mp, ...a), mapa: mp.mapa };
}

function atualizarMapaResNE(mp, dados) {
  mp.chaves.forEach(k => mp.grupos[k].clearLayers());
  mp.grupos.nivel.clearLayers();
  dados.forEach(r => {
    if (r.modo === "nivel") {
      marcaNivel(r)
        .on("click", () => abrirFichaNE(r))
        .addTo(mp.grupos.nivel);
      return;
    }
    const c = FX[r.faixa].cor,
      raio = 4 + Math.min(8, Math.sqrt(r.capacidade_hm3 || 1) / 9);
    const m = L.circleMarker([r.lat, r.lon], {
      radius: mp.lista.length > 1 ? raio * 0.85 : raio,
      color: COR.branco,
      weight: 1.2,
      fillColor: c,
      fillOpacity: r.sem_info ? 0.5 : 0.9
    });
    m.bindTooltip(
      `<div class="pop"><b>${esc(caso(r.nome))}</b>` +
        (mp.lista.length > 1 ? `<div class="l"><span>Estado</span><span>${esc(r.estado)}</span></div>` : "") +
        `<div class="valor num">${r.volume_pct == null ? "sem informação" : fmt(r.volume_pct, 1) + " <small>% do volume</small>"}</div>` +
        `<div class="l"><span><i class="bola" style="background:${c}"></i>${r.sem_info ? "Sem informação" : FX[r.faixa].rot}</span></div>` +
        `<div class="l"><span>Capacidade</span><span class="num">${r.capacidade_hm3 == null ? "–" : fmt(r.capacidade_hm3, 1)} hm³</span></div>` +
        `<div class="l"><span>Cota</span><span class="num">${r.cota == null ? "–" : fmt(r.cota, 2)} m</span></div>` +
        `<div class="l"><span>Volume</span><span class="num">${r.volume_hm3 == null ? "–" : fmt(r.volume_hm3, 1)} hm³</span></div>` +
        `<div class="l"><span>Município</span><span>${esc(r.municipio || "–")}</span></div>` +
        `<div class="l"><span>Bacia</span><span>${esc(caso(r.bacia || "–"))}</span></div>` +
        `<div class="l"><span>Medição usada</span><span>${r.data ? dBR(r.data) : "–"} · ${dDias(r)}</span></div></div>`,
      { direction: "top", offset: [0, -6], opacity: 1 }
    );
    m.on("click", () => abrirFichaNE(r));
    m.addTo(mp.grupos[r.faixa]);
  });
  mp.camadas.forEach(n => mp.controle.removeLayer(n));
  mp.camadas = [];
  mp.chaves.forEach(k => {
    const n = mp.grupos[k],
      q = dados.filter(r => r.modo !== "nivel" && r.faixa === k).length;
    if (!q && dados.some(r => r.modo === "nivel")) return; // página com nível: só as faixas que existem
    mp.controle.addOverlay(n, `${ROT_FAIXA(k)} (${q})`);
    mp.camadas.push(n);
  });
  const qn = dados.filter(r => r.modo === "nivel").length;
  if (qn) {
    mp.controle.addOverlay(mp.grupos.nivel, `Só nível (${qn})`);
    mp.camadas.push(mp.grupos.nivel);
  }
  mp.controle.addOverlay(mp.contorno, mp.lista.length > 1 ? "Contorno dos estados" : "Contorno do estado");
  mp.camadas.push(mp.contorno);
  if (mp.semi) {
    mp.controle.addOverlay(mp.semi, "Semiárido (INSA)");
    mp.camadas.push(mp.semi);
  }
  // enquadra pelos reservatórios, não pelos estados (só na primeira vez: mudar a data não mexe no zoom)
  const pts = dados.filter(r => r.lat != null).map(r => [r.lat, r.lon]);
  if (!mp.ajustado && pts.length) {
    mp.mapa.fitBounds(L.latLngBounds(pts), { paddingTopLeft: [14, 14], paddingBottomRight: [14, 14], maxZoom: 9 });
    mp.ajustado = true;
  }
}

export {
  desenharSerie,
  icoNV,
  legendaNivel,
  LIM_EST,
  mapaResNE,
  mesmoDiaSerie,
  nivelNa,
  NOTA_SERIE,
  paginaEstado,
  qtd,
  sinal
};
