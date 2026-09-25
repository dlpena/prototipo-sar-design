/* Página do Sistema Cantareira (#outros/cantareira): situação com a régua das faixas da Resolução Conjunta
   ANA/DAEE nº 925/2017, reservatórios, balanço de vazões do dia, gráficos por ano e chuva e vazão natural do mês contra
   a média de longo termo informada pela SABESP. */
import { contexto } from "./contexto.js";
import { FAIXAS_OPERACAO_CAN, VIG_CAN } from "./regras.js";
import { CAN, OS } from "./dados_embutidos.js";
import {
  $,
  $$,
  barraBaixar,
  barraData,
  COR,
  dBR,
  diasNoMes,
  esc,
  fmt,
  ligarData,
  ligarIndice,
  mesesAte,
  rotuloMes,
  svgEl,
  toast
} from "./base.js";
import { baixarCSVGrafico, baixarPNG, LEG_ANOS, pdfSecao, salvarCSV } from "./exportacao.js";
import {
  botoesAnos,
  comoLer,
  graficoBarrasAnos,
  graficoCalendario,
  graficoMensalMLT,
  ler,
  MAX_ANOS,
  tintaFaixa
} from "./graficos.js";
import { detCan, diaEntre, entrarSis, isoMais, pctCan } from "./outros.js";
import { abrirFichaOS } from "./outros_sistemas.js";

// cores do balanço de vazões (paleta de dados, usada nos dois desenhos do balanço): marinho dos reservatórios, azul-médio
// da vazão natural (a mesma cor do "Afluente natural" na ficha do reservatório; o azul dos links, --ana-medio, não é
// usado para não parecer clicável), bronze da transferência do Paraíba do Sul, verde-azulado da descarga para jusante,
// cinza dos rótulos, da terra e das ligações sem vazão no dia. Os números ficam em cor de texto; a cor da vazão só no
// contorno da etiqueta, na linha e na seta.
const PAL_BALANCO = {
  MAR: COR.ana,
  NAT: COR.azulMedio,
  TRF: COR.bronzeEscuro,
  JUS: "#07777A",
  AP: COR.apagado,
  TERRA: "#8A97A8",
  PARADO: "#9AA8BC"
};
function paginaCantareira() {
  const pag = {}; // estado da página, passado às funções abaixo

  if (!CAN) {
    location.hash = "inicio";
    return;
  }
  pag.ult = CAN.ate;
  pag.min = isoMais(CAN.det_de, 366);
  entrarSis("cantareira", pag.ult);
  if (contexto.refOS < pag.min || contexto.refOS > pag.ult) contexto.refOS = pag.ult;
  $("#titulo-pag").innerHTML = tituloCantareira(pag);
  pag.secoes = [
    ["c-sit", "Situação"],
    ["c-res", "Reservatórios"],
    ["c-bal", "Balanço de vazões"],
    ["c-ano", "Ao longo do ano"],
    ["c-dia", "Mesmo dia em outros anos"],
    ["c-mes", "Chuva e afluência"]
  ];
  $("#conteudo").innerHTML = corpoCantareira(pag);
  ligarIndice();
  ligarData("dia-can", pag.min, pag.ult, iso => {
    contexto.refOS = iso;
    desenharCantareira();
  });
  contexto.redesenharOS = desenharCantareira;
  desenharCantareira();
  ligarDownloadsCantareira();
}

const tituloCantareira = pag =>
  `
    <p class="trilha"><a href="#inicio">Início</a><span class="sep">›</span><a href="#outros">Outros Sistemas Hídricos</a><span class="sep">›</span>Sistema Cantareira</p>
    <h1>Sistema Cantareira</h1>
    <p class="lead">Jaguari-Jacareí, Cachoeira, Atibainha e Paiva Castro, ligados por túneis, abastecem a Região Metropolitana de São Paulo pela Estação Elevatória Santa Inês e liberam água para as bacias dos rios Piracicaba, Capivari e Jundiaí (PCJ). A operação segue a Resolução Conjunta ANA/DAEE nº 925/2017.</p>
    <div class="carimbo"><span>Dados mais recentes <b>${dBR(pag.ult)}</b></span><span>Base diária</span><span><b>4</b> reservatórios · <b>${fmt(CAN.vu, 2)}</b> hm³ de volume útil</span><span>Série do sistema desde <b>${dBR(CAN.de)}</b></span></div>
    ${barraData("dia-can", contexto.refOS, pag.min, pag.ult, "Base diária. Situação, reservatórios e balanço seguem esta data.")}`;

const corpoCantareira = pag =>
  `
    <nav class="indice" aria-label="Seções da página">${pag.secoes.map(([id, r]) => `<a href="#outros/cantareira" data-alvo="${id}">${r}</a>`).join("")}</nav>
    <section class="cartao secao" id="c-sit" aria-labelledby="t-c-sit">
      <h2 id="t-c-sit"><small>1</small><span>Situação em <span id="c-sit-dia"></span></span></h2>
      <p class="sub">O volume útil armazenado nos quatro reservatórios, agregado e expresso em % do volume útil total do sistema, de ${fmt(CAN.vu, 2)} hm³, como define a Resolução Conjunta ANA/DAEE nº 925/2017 (Art. 1º, § 1º).</p>
      <div class="equiv">
        <div class="lado">
          <div class="valor num" id="c-valor"></div>
          <div class="quando" id="c-quando"></div>
          <div class="regua-faixas" aria-hidden="true">${FAIXAS_OPERACAO_CAN.slice()
            .reverse()
            .map(f => {
              const de = Math.max(0, f.de),
                ate = Math.min(100, f.ate);
              return `<span style="width:${ate - de}%;background:${f.cor}" title="${f.rot}"></span>`;
            })
            .join("")}</div>
          <div class="regua-rot" id="c-regua"></div>
          <p class="def">Posição do volume útil de <span id="c-regua-dia"></span> nas faixas de operação do art. 4º da resolução (cores como no gráfico Ao longo do ano). <span id="c-regua-vig"></span></p>
        </div>
        <ul class="comparacoes" id="c-comp"></ul>
      </div>
    </section>
    <section class="cartao secao tabela-bacia" id="c-res" aria-labelledby="t-c-res">
      ${barraBaixar([
        ["baixar-can-csv", "CSV", "Baixar a tabela do dia em CSV"],
        ["baixar-can-pdf", "PDF", "Baixar a tabela do dia em PDF"]
      ])}
      <h2 id="t-c-res"><small>2</small><span>Reservatórios em <span id="c-res-dia"></span></span></h2>
      <p class="sub">De montante para jusante, na ordem em que a água passa pelos túneis. O minigráfico mostra o volume útil (%) nos 12 meses até a data de referência.<span class="dica">Clique num reservatório para abrir a ficha.</span></p>
      <div class="tab-box"><table id="tab-can">
        <thead><tr><th>Reservatório</th><th class="r">Nível</th><th class="r">Volume útil</th><th class="r">Volume útil</th><th class="r">Volume útil máximo</th><th class="r">Afluente natural</th><th class="r">Para jusante</th><th class="mini-th">Últimos 12 meses</th></tr>
        <tr class="unid"><th></th><th class="r">m</th><th class="r">hm³</th><th class="r">%</th><th class="r">hm³</th><th class="r">m³/s</th><th class="r">m³/s</th><th></th></tr></thead>
        <tbody id="corpo-can"></tbody><tfoot id="pe-can"></tfoot></table></div>
    </section>
    <section class="cartao secao" id="c-bal" aria-labelledby="t-c-bal">
      ${barraBaixar([["baixar-bal-png", "PNG", "Baixar o diagrama como imagem"]])}
      <h2 id="t-c-bal"><small>3</small><span>Balanço de vazões em <span id="c-bal-dia"></span></span></h2>
      <p class="sub">Vazões médias do dia, em m³/s: a vazão natural que chega a cada reservatório, os túneis que levam a água de um para o outro, a transferência do Jaguari (bacia do Paraíba do Sul) para o Atibainha, a retirada em Santa Inês para a Região Metropolitana de São Paulo e as descargas para jusante. No desenho, cada reservatório aparece em corte, com a água no nível do seu volume útil.</p>
      <div class="balanco" id="c-balanco"></div>
      <div class="balanco-resumo" id="c-bal-resumo"></div>
    </section>
    <section class="cartao secao" id="c-ano" aria-labelledby="t-c-ano">
      ${barraBaixar([
        ["baixar-can-ano-csv", "CSV", "Baixar os dados do gráfico em CSV"],
        ["baixar-can-ano", "PNG", "Baixar o gráfico como imagem"]
      ])}
      <h2 id="t-c-ano"><small>4</small>Ao longo do ano</h2>
      <p class="sub">Volume útil do sistema (%) dia a dia, cada ano no mesmo calendário, até a data de referência. Ao fundo, as faixas de operação pelo volume útil acumulado, conforme o art. 4º da Resolução Conjunta ANA/DAEE nº 925/2017.<span class="dica">Selecione os anos a comparar, até ${MAX_ANOS} simultaneamente; posicione o cursor sobre o gráfico para ler o mesmo dia em cada ano.</span></p>
      <div class="controles"><fieldset class="anos"><legend>Anos <span class="nota" id="nota-anos-can"></span></legend><span id="anos-chips-can"></span></fieldset></div>
      <div class="graf" id="g-can-ano"></div>
      <div id="c-ano-faixas">${legendaFaixasCan()}
      <p class="nota" style="margin:8px 0 0">As faixas são referência e valem a partir de 30/05/2017, início da vigência da resolução (art. 9º). A faixa em vigor é estabelecida mensalmente pela ANA e pelo DAEE, até o último dia útil do mês anterior, e as faixas 4 e 5 podem ser estabelecidas a qualquer momento (art. 6º da resolução); por isso, pode diferir da indicada pelo volume do dia.</p></div>
      ${comoLer(ler("anos"), ler("selecao"), ler("cursor"), ler("faixas", "As faixas aparecem ao fundo apenas quando a data de referência está dentro da vigência da resolução; com data anterior, o gráfico é apresentado sem elas."))}
    </section>
    <section class="cartao secao" id="c-dia" aria-labelledby="t-c-dia">
      ${barraBaixar([
        ["baixar-can-dia-csv", "CSV", "Baixar os dados do gráfico em CSV"],
        ["baixar-can-dia", "PNG", "Baixar o gráfico como imagem"]
      ])}
      <h2 id="t-c-dia"><small>5</small>Mesmo dia em outros anos</h2>
      <p class="sub">Volume útil do sistema (%) no dia e mês da data de referência, em cada ano desde o início da série.</p>
      <div class="graf" id="g-can-dia"></div>
      <p class="nota" id="c-dia-nota" style="margin:8px 0 0"></p>
      ${comoLer(ler("dia"), "<b>Escala.</b> O eixo vertical vai de 0 a 100%.")}
    </section>
    <section class="cartao secao" id="c-mes" aria-labelledby="t-c-mes">
      ${barraBaixar([
        ["baixar-can-mes-csv", "CSV", "Baixar os dados dos gráficos em CSV"],
        ["baixar-can-mes", "PNG", "Baixar os gráficos como imagem"]
      ])}
      <h2 id="t-c-mes"><small>6</small>Chuva e afluência contra a média</h2>
      <p class="sub">Chuva acumulada e vazão natural média de cada mês, nos 12 meses até a data de referência, ao lado da média de longo termo do mês informada pela SABESP.</p>
      <div class="mensal-grade"><div class="graf" id="g-can-chuva"></div><div class="graf" id="g-can-qnat"></div></div>
      <p class="nota" id="c-mes-nota" style="margin:10px 0 0"></p>
      ${comoLer(ler("mensal"), "<b>Valores.</b> À esquerda, a chuva acumulada do mês, em mm; à direita, a vazão natural média do mês, em m³/s. A média de longo termo de cada mês é a informada pela SABESP, a do próprio ano.")}
    </section>
    <p class="nota">Fontes: ${esc(OS.fontes.sabesp)} (reservatórios, túneis, Santa Inês, transferência, chuva e médias de longo termo); ${esc(OS.fontes.resolucao)}. O volume útil do sistema é calculado pelo SAR com os quatro reservatórios da resolução; o percentual publicado pela SABESP inclui também o reservatório de Águas Claras e difere deste em até 0,05 ponto percentual.</p>`;

function desenharCantareira() {
  const ref = contexto.refOS,
    p0 = pctCan(ref),
    f0 = null; // faixa: só pelo ato mensal da ANA/DAEE, não calculada
  ["c-sit-dia", "c-res-dia", "c-bal-dia"].forEach(id => ($("#" + id).textContent = dBR(ref)));
  situacaoCan(ref, p0, f0);
  tabelaCan(ref);
  balancoCan(ref, f0);
  anoCan(ref);
  diaCan(ref);
  mesCan(ref);
}

const ligarDownloadsCantareira = () => {
  $("#baixar-bal-png").onclick = () =>
    baixarPNG(
      [$("#c-balanco svg")],
      `sar_cantareira_balanco_${contexto.refOS}.png`,
      `Sistema Cantareira · balanço de vazões em ${dBR(contexto.refOS)} (m³/s)`,
      []
    );
  $("#baixar-can-ano").onclick = () =>
    baixarPNG(
      [$("#g-can-ano svg")],
      `sar_cantareira_ao_longo_do_ano_ate_${contexto.refOS}.png`,
      `Sistema Cantareira · volume útil ao longo do ano · até ${dBR(contexto.refOS)}`,
      [
        ...LEG_ANOS(+contexto.refOS.slice(0, 4)),
        ...(contexto.refOS >= VIG_CAN
          ? FAIXAS_OPERACAO_CAN.map(f => ({ r: f.rot, cor: tintaFaixa(f), area: true }))
          : [])
      ]
    );
  $("#baixar-can-dia").onclick = () =>
    baixarPNG(
      [$("#g-can-dia svg")],
      `sar_cantareira_mesmo_dia_${contexto.refOS}.png`,
      `Sistema Cantareira · volume útil em ${dBR(contexto.refOS).slice(0, 5)} de cada ano`,
      []
    );
  $("#baixar-can-mes").onclick = () =>
    baixarPNG(
      [$("#g-can-chuva svg"), $("#g-can-qnat svg")],
      `sar_cantareira_chuva_afluencia_${contexto.refOS}.png`,
      `Sistema Cantareira · chuva e vazão natural contra a média · até ${dBR(contexto.refOS)}`,
      []
    );
  $("#baixar-can-csv").onclick = () =>
    salvarCSV(
      [
        "reservatorio",
        "codigo",
        "data",
        "cota_m",
        "volume_hm3",
        "volume_util_pct",
        "vazao_natural_m3s",
        "descarga_jusante_m3s"
      ],
      CAN.res
        .map(r => [
          r.nome,
          r.codigo,
          dBR(contexto.refOS),
          detCan(r.cota, contexto.refOS),
          detCan(r.vol, contexto.refOS),
          detCan(r.pct, contexto.refOS),
          detCan(r.qnat, contexto.refOS),
          detCan(r.qjus, contexto.refOS)
        ])
        .concat([
          (() => {
            // linha do sistema, como no rodapé da tabela: soma dos quatro e volume útil do sistema
            const soma = k => {
              const v = CAN.res.reduce((a, r) => a + (detCan(r[k], contexto.refOS) ?? NaN), 0);
              return Number.isFinite(v) ? v : null;
            };
            return [
              "Sistema",
              "",
              dBR(contexto.refOS),
              null,
              soma("vol"),
              pctCan(contexto.refOS),
              soma("qnat"),
              soma("qjus")
            ];
          })()
        ]),
      `sar_cantareira_${contexto.refOS}.csv`
    );
  $("#baixar-can-pdf").onclick = () =>
    pdfSecao([$("#tab-can")], `sar_cantareira_${contexto.refOS}.pdf`, { data: contexto.refOS });
  $("#baixar-can-ano-csv").onclick = () =>
    baixarCSVGrafico([$("#g-can-ano")], `sar_cantareira_ao_longo_do_ano_ate_${contexto.refOS}.csv`);
  $("#baixar-can-dia-csv").onclick = () =>
    baixarCSVGrafico([$("#g-can-dia")], `sar_cantareira_mesmo_dia_${contexto.refOS}.csv`);
  $("#baixar-can-mes-csv").onclick = () => {
    const a = $("#g-can-chuva")._csv,
      b = $("#g-can-qnat")._csv;
    if (!a || !b) {
      toast("Nada para exportar nesta seção.");
      return;
    }
    salvarCSV(
      ["mes", ...a.cab.slice(1), ...b.cab.slice(1)],
      a.linhas.map((l, i) => [...l, ...b.linhas[i].slice(1)]),
      `sar_cantareira_chuva_afluencia_ate_${contexto.refOS}.csv`
    );
  };
};
function situacaoCan(ref, p0, f0) {
  const vol = CAN.res.reduce((a, r) => a + (detCan(r.vol, ref) ?? NaN), 0);
  const dif = (a, b) =>
    a == null || b == null ? "–" : `${a - b > 0 ? "+" : a - b < 0 ? "−" : ""}${fmt(Math.abs(a - b), 1)} p.p.`;
  const ant = `${+ref.slice(0, 4) - 1}${ref.slice(4)}`;
  $("#c-valor").innerHTML = `${fmt(p0, 1)}<small>%</small>`;
  $("#c-quando").textContent = `volume útil do sistema em ${dBR(ref)} · ${fmt(vol, 1)} de ${fmt(CAN.vu, 2)} hm³`;
  $("#c-regua").innerHTML =
    [0, 20, 30, 40, 60, 100].map(v => `<b style="left:${v}%">${v}</b>`).join("") +
    (p0 != null
      ? `<span class="regua-marca" style="left:${Math.max(0, Math.min(100, p0))}%" title="${fmt(p0, 1)}% em ${dBR(ref)}"></span>`
      : "");
  $("#c-regua-dia").textContent = dBR(ref);
  $("#c-regua-vig").textContent =
    ref < VIG_CAN
      ? `Em ${dBR(ref)} a resolução ainda não vigorava (vigência a partir de ${dBR(VIG_CAN)}, art. 9º): as faixas não se aplicavam nessa data.`
      : `As faixas valem a partir de ${dBR(VIG_CAN)}, início da vigência da resolução (art. 9º). A faixa em vigor é estabelecida mensalmente pela ANA e pelo DAEE, até o último dia útil do mês anterior, e as faixas 4 e 5 podem ser estabelecidas a qualquer momento (art. 6º); por isso, pode diferir da indicada pelo volume do dia.`;
  $("#c-comp").innerHTML = `<li><span>Em 7 dias</span><b class="num">${dif(p0, pctCan(isoMais(ref, -7)))}</b></li>
    <li><span>Em 30 dias</span><b class="num">${dif(p0, pctCan(isoMais(ref, -30)))}</b></li>
    <li><span>Mesmo dia de ${ant.slice(0, 4)}<small>${dif(p0, pctCan(ant))}</small></span><b class="num">${fmt(pctCan(ant), 1)}%</b></li>
    <li><span>Mesmo dia de ${+ref.slice(0, 4) - 5}<small>${dif(p0, pctCan(`${+ref.slice(0, 4) - 5}${ref.slice(4)}`))}</small></span><b class="num">${fmt(pctCan(`${+ref.slice(0, 4) - 5}${ref.slice(4)}`), 1)}%</b></li>`;
}
function miniOS(host, vals) {
  const W = Math.max(60, Math.round(host.getBoundingClientRect().width) || 132),
    H = 30,
    m = 3,
    P = vals.map((v, i) => [i, v]).filter(p => p[1] != null);
  if (!P.length) {
    host.innerHTML = '<span class="sem">–</span>';
    return;
  }
  const vs = P.map(p => p[1]),
    lo = Math.min(...vs),
    hi = Math.max(...vs),
    n = vals.length - 1;
  const x = i => m + (i / n) * (W - 2 * m),
    y = v => (hi > lo ? H - m - ((v - lo) * (H - 2 * m)) / (hi - lo) : H / 2);
  let d = "",
    ant = null;
  P.forEach(([i, v]) => {
    d += (ant == null || i - ant > 1 ? "M" : "L") + x(i).toFixed(1) + " " + y(v).toFixed(1);
    ant = i;
  });
  const u = P[P.length - 1];
  host.innerHTML = `<svg width="100%" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true"><path d="${d}" fill="none" stroke="${COR.ana}" stroke-width="1.4" stroke-linejoin="round"/><circle cx="${x(u[0]).toFixed(1)}" cy="${y(u[1]).toFixed(1)}" r="2.4" fill="${COR.vermelho}"/></svg>`;
  host.title = `12 meses: mínimo ${fmt(lo, 1)}% e máximo ${fmt(hi, 1)}%; em vermelho, a data de referência`;
}
function tabelaCan(ref) {
  const i1 = diaEntre(ref, CAN.det_de),
    i0 = Math.max(0, i1 - 365);
  $("#corpo-can").innerHTML = CAN.res
    .map(
      r => `<tr><td><span class="nm">${esc(r.nome)}</span><span class="rio">código ${r.codigo}</span></td>
    <td class="r num">${fmt(detCan(r.cota, ref), 2)}</td><td class="r num">${fmt(detCan(r.vol, ref), 1)}</td><td class="r num">${fmt(detCan(r.pct, ref), 1)}</td>
    <td class="r num">${fmt(r.vu, 2)}</td><td class="r num">${fmt(detCan(r.qnat, ref), 1)}</td><td class="r num">${fmt(detCan(r.qjus, ref), 2)}</td><td class="mini" data-k="${r.k}"></td></tr>`
    )
    .join("");
  const vol = CAN.res.reduce((a, r) => a + (detCan(r.vol, ref) ?? NaN), 0),
    qn = CAN.res.reduce((a, r) => a + (detCan(r.qnat, ref) ?? NaN), 0),
    qj = CAN.res.reduce((a, r) => a + (detCan(r.qjus, ref) ?? NaN), 0);
  $("#pe-can").innerHTML =
    `<tr><th>Sistema</th><th></th><th class="r">${fmt(vol, 1)}</th><th class="r">${fmt(pctCan(ref), 1)}</th><th class="r">${fmt(CAN.vu, 2)}</th><th class="r">${fmt(qn, 1)}</th><th class="r">${fmt(qj, 2)}</th><th></th></tr>`;
  $$("#corpo-can td.mini").forEach(td => {
    const r = CAN.res.find(x => x.k === td.dataset.k);
    miniOS(td, r.pct.slice(i0, i1 + 1));
  });
  $$("#corpo-can tr").forEach((tr, i) => (tr.onclick = () => abrirFichaOS(String(CAN.res[i].codigo))));
}
function balancoCan(ref, f0) {
  const bal = { ref }; // estado do desenho do balanço, passado às funções abaixo

  bal.R = Object.fromEntries(CAN.res.map(r => [r.k, r]));
  bal.V = k => detCan(CAN.vaz[k], bal.ref);
  bal.W = 1440;
  bal.H = 600;
  bal.BW = 230;
  bal.BH = 112;
  bal.BY = 250;
  bal.CX = [170, 500, 830, 1160];
  const { MAR, NAT, TRF, JUS, AP, TERRA, PARADO } = PAL_BALANCO;
  bal.MAR = MAR;
  bal.NAT = NAT;
  bal.TRF = TRF;
  bal.JUS = JUS;
  bal.TERRA = TERRA;
  bal.AP = AP;
  bal.PARADO = PARADO;
  bal.svg = svgEl("svg", {
    viewBox: `0 112 ${bal.W} ${bal.H - 126}`,
    role: "img",
    "aria-label": `Balanço de vazões do Sistema Cantareira em ${dBR(bal.ref)}`,
    "font-family": "Arial, Helvetica, sans-serif"
  });
  bal.ordem = ["JaguariJacarei", "Cachoeira", "Atibainha", "PaivaCastro"];
  bal.tuneis = ["T7", "T6", "T5"];
  bal.rios = {
    JaguariJacarei: "rio Jaguari",
    Cachoeira: "rio Atibaia (PCJ)",
    Atibainha: "rio Atibaia (PCJ)",
    PaivaCastro: "rio Juqueri"
  };
  reservatoriosBalancoCan(bal);
  // transferência do Jaguari (Paraíba do Sul) para o Atibainha
  transferenciaBalancoCan(bal);
  // Santa Inês
  santaInesBalancoCan(bal);
  // legenda
  legendaBalancoCan(bal);
  $("#c-balanco").innerHTML = "";
  $("#c-balanco").append(
    $("#c-balanco").clientWidth && $("#c-balanco").clientWidth < 640 ? balancoCanV(bal.ref, bal.R, bal.V) : bal.svg
  );
  // resumo: retirada do sistema (Art. 1º, § 2º), Santa Inês no mês e transferência, sem limites por faixa
  resumoBalancoCan(bal);
}

// os quatro reservatórios, os túneis entre eles, a vazão natural afluente e a descarga para jusante
function reservatoriosBalancoCan(bal) {
  bal.ordem.forEach((k, i) => {
    const r = bal.R[k],
      cx = bal.CX[i],
      x = cx - bal.BW / 2,
      y0 = bal.BY,
      y1 = bal.BY + bal.BH,
      p = detCan(r.pct, bal.ref);
    // reservatório em corte: encosta à esquerda, barragem à direita, água até o nível do %
    const ex = y => x + 4 + (34 * (y - (y0 + 10))) / (y1 - (y0 + 10)),
      px = y => x + bal.BW - 52 - (26 * (y - y0)) / bal.BH;
    const cheio = Math.max(0, Math.min(1, (p ?? 0) / 100)),
      yn = y1 - (bal.BH - 14) * cheio,
      ym = y1 - (bal.BH - 14);
    const pts = P => P.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(" ");
    if (p != null) {
      bal.svg.append(
        svgEl("polygon", {
          points: pts([
            [ex(yn), yn],
            [px(yn), yn],
            [px(y1), y1],
            [ex(y1), y1]
          ]),
          fill: "#DCE8F5"
        })
      );
      bal.svg.append(
        svgEl("line", {
          x1: ex(yn),
          x2: px(yn),
          y1: yn,
          y2: yn,
          stroke: bal.NAT,
          "stroke-width": 2,
          "stroke-linecap": "round"
        })
      );
    }
    bal.svg.append(
      svgEl("line", {
        x1: ex(ym),
        x2: px(ym),
        y1: ym,
        y2: ym,
        stroke: COR.claro,
        "stroke-width": 1.2,
        "stroke-dasharray": "4 4"
      })
    );
    bal.svg.append(
      svgEl("path", {
        d: `M${x - 8} ${y0 + 10}L${x + 4} ${y0 + 10}L${ex(y1)} ${y1}L${px(y1)} ${y1}`,
        fill: "none",
        stroke: bal.TERRA,
        "stroke-width": 2,
        "stroke-linecap": "round",
        "stroke-linejoin": "round"
      })
    );
    bal.svg.append(
      svgEl("polygon", {
        points: pts([
          [x + bal.BW - 52, y0],
          [x + bal.BW - 34, y0],
          [x + bal.BW - 6, y1],
          [px(y1), y1]
        ]),
        fill: bal.MAR,
        stroke: bal.MAR,
        "stroke-width": 1.5,
        "stroke-linejoin": "round"
      })
    );
    bal.svg.append(
      svgEl("line", {
        x1: x + bal.BW - 6,
        x2: x + bal.BW + 8,
        y1,
        y2: y1,
        stroke: bal.TERRA,
        "stroke-width": 2,
        "stroke-linecap": "round"
      })
    );
    const cm = x + (bal.BW - 60) / 2 + 8;
    txtBalancoCan(bal, cm, y0 + 40, r.nome, { fs: 14, cor: bal.MAR, b: true });
    const n = txtBalancoCan(bal, cm, y0 + 72, p == null ? "–" : fmt(p, 1), { fs: 25, b: true });
    if (p != null) {
      const s = svgEl("tspan", { "font-size": 14, fill: COR.vivo, dx: 2 }); // símbolo %, como no valor principal
      s.textContent = "%";
      n.append(s);
    }
    txtBalancoCan(bal, cm, y0 + 94, `${fmt(detCan(r.vol, bal.ref), 1)} hm³`, { cor: COR.tinta2 });
    // vazão natural, por cima
    // setas de cima e de baixo com o mesmo comprimento (L) e centradas na figura; no Atibainha, o par é centrado
    const L = 92,
      qn = detCan(r.qnat, bal.ref),
      xn = cx - (i === 2 ? 45 : 0);
    linhaBalancoCan(bal, xn, bal.BY + 2 - L, xn, bal.BY + 2, bal.NAT, qn);
    rotBalancoCan(bal, xn, bal.BY - L - 12, "VAZÃO NATURAL");
    etiquetaBalancoCan(bal, xn, bal.BY + 2 - L / 2, qBalancoCan(qn), bal.NAT, qn);
    // descarga para jusante, pelo pé da barragem
    const qj = detCan(r.qjus, bal.ref),
      xd = cx;
    linhaBalancoCan(bal, xd, y1 + 8, xd, y1 + 8 + L, bal.JUS, qj);
    etiquetaBalancoCan(bal, xd, y1 + 8 + L / 2, qBalancoCan(qj), bal.JUS, qj);
    txtBalancoCan(bal, xd, y1 + L + 32, `para jusante · ${bal.rios[k]}`, { cor: bal.AP });
    // túnel para o próximo
    if (i < 3) {
      const tq = bal.V(bal.tuneis[i]),
        x1 = cx + bal.BW / 2 + 2,
        x2 = bal.CX[i + 1] - bal.BW / 2 + 6,
        y = bal.BY + bal.BH / 2 + 8,
        xm = (x1 + x2) / 2 - 3;
      linhaBalancoCan(bal, x1, y, x2, y, bal.MAR, tq);
      etiquetaBalancoCan(bal, xm, y, qBalancoCan(tq), bal.MAR, tq);
      rotBalancoCan(bal, xm, y - 26, `TÚNEL ${bal.tuneis[i].slice(1)}`);
    }
  });
}

// transferência do Jaguari (Paraíba do Sul) para o Atibainha
function transferenciaBalancoCan(bal) {
  bal.tr = bal.V("TransfParaibaDoSul");
  const xt = bal.CX[2] + 45;
  const Lt = 92;
  linhaBalancoCan(bal, xt, bal.BY + 2 - Lt, xt, bal.BY + 2, bal.TRF, bal.tr);
  rotBalancoCan(bal, xt - 8, bal.BY - Lt - 25, "TRANSFERÊNCIA DO JAGUARI", "start");
  rotBalancoCan(bal, xt - 8, bal.BY - Lt - 12, "(PARAÍBA DO SUL)", "start");
  etiquetaBalancoCan(bal, xt, bal.BY + 2 - Lt / 2, qBalancoCan(bal.tr), bal.TRF, bal.tr);
}

// Santa Inês: retirada para a Região Metropolitana de São Paulo
function santaInesBalancoCan(bal) {
  bal.esi = bal.V("ESI");
  const xe = bal.CX[3] + bal.BW / 2 + 2;
  const ye = bal.BY + bal.BH / 2 + 8;
  const xme = (xe + bal.W - 40) / 2 - 4;
  linhaBalancoCan(bal, xe, ye, bal.W - 40, ye, bal.MAR, bal.esi);
  etiquetaBalancoCan(bal, xme, ye, qBalancoCan(bal.esi), bal.MAR, bal.esi);
  rotBalancoCan(bal, xme, ye - 26, "SANTA INÊS");
  txtBalancoCan(bal, xme, ye + 36, "retirada para a RMSP", { cor: bal.AP });
}

// legenda do diagrama
function legendaBalancoCan(bal) {
  let xl = 40;
  [
    [bal.NAT, "Vazão natural afluente"],
    [bal.TRF, "Transferência do Paraíba do Sul"],
    [bal.MAR, "Túneis e retirada em Santa Inês"],
    [bal.JUS, "Descarga para jusante"]
  ].forEach(([c, s]) => {
    bal.svg.append(svgEl("rect", { x: xl, y: bal.H - 42, width: 18, height: 6, rx: 3, fill: c }));
    txtBalancoCan(bal, xl + 26, bal.H - 35, s, { cor: bal.AP, a: "start" });
    xl += s.length * 6.6 + 70;
  });
  bal.svg.append(
    svgEl("line", {
      x1: xl,
      x2: xl + 22,
      y1: bal.H - 39,
      y2: bal.H - 39,
      stroke: COR.claro,
      "stroke-width": 1.2,
      "stroke-dasharray": "4 4"
    })
  );
  txtBalancoCan(bal, xl + 30, bal.H - 35, "volume útil máximo", { cor: bal.AP, a: "start" });
  txtBalancoCan(bal, bal.W - 40, bal.H - 35, "Valores em m³/s, média do dia.", { cor: bal.AP, a: "end" });
}

// resumo: retirada do sistema, Santa Inês no mês e transferência
function resumoBalancoCan(bal) {
  const jus = CAN.res.reduce((a, r) => a + (detCan(r.qjus, bal.ref) ?? NaN), 0);
  const i1 = diaEntre(bal.ref, CAN.det_de),
    i0 = diaEntre(bal.ref.slice(0, 8) + "01", CAN.det_de),
    mes = CAN.vaz.ESI.slice(i0, i1 + 1).filter(v => v != null);
  const esiMes = mes.length ? mes.reduce((a, b) => a + b, 0) / mes.length : null;
  $("#c-bal-resumo").innerHTML = `
    <div class="v"><div class="r">Retirada do sistema no dia</div><div class="n num">${fmt(bal.esi + jus, 1)}<small>m³/s</small></div><div class="c">Santa Inês ${fmt(bal.esi, 1)} + descargas para jusante ${fmt(jus, 2)}, como define a resolução (Art. 1º, § 2º)</div></div>
    <div class="v"><div class="r">Santa Inês, média do mês até ${dBR(bal.ref).slice(0, 5)}</div><div class="n num">${fmt(esiMes, 1)}<small>m³/s</small></div><div class="c">média das vazões diárias do mês, até a data de referência</div></div>
    <div class="v"><div class="r">Transferência do Paraíba do Sul, no dia</div><div class="n num">${fmt(bal.tr, 2)}<small>m³/s</small></div><div class="c">do reservatório Jaguari, na bacia do Paraíba do Sul, para o Atibainha</div></div>`;
}

const txtBalancoCan = (bal, x, y, s, o = {}) => {
  const e = svgEl("text", {
    x,
    y,
    "text-anchor": o.a || "middle",
    "font-size": o.fs || 12,
    fill: o.cor || COR.tinta,
    "font-weight": o.b ? 700 : 400
  });
  if (o.ls) e.setAttribute("letter-spacing", o.ls);
  e.textContent = s;
  bal.svg.append(e);
  return e;
};

const rotBalancoCan = (bal, x, y, s, a) => txtBalancoCan(bal, x, y, s, { fs: 10.5, cor: bal.AP, ls: ".06em", a });

const qBalancoCan = v => (v == null ? "–" : fmt(v, v < 10 ? 2 : 1));

// linha de 2 px com ponta aberta; vazão nula ou sem dado fica pontilhada e cinza
const linhaBalancoCan = (bal, x1, y1, x2, y2, cor, v) => {
  const parado = !(v > 0),
    c = parado ? bal.PARADO : cor;
  const l = svgEl("line", { x1, y1, x2, y2, stroke: c, "stroke-width": 2, "stroke-linecap": "round" });
  if (parado) l.setAttribute("stroke-dasharray", "3 5");
  bal.svg.append(l);
  bal.svg.append(
    svgEl("path", {
      d:
        y1 === y2
          ? `M${x2 - 9} ${y2 - 6}L${x2} ${y2}L${x2 - 9} ${y2 + 6}`
          : `M${x2 - 6} ${y2 - 9}L${x2} ${y2}L${x2 + 6} ${y2 - 9}`,
      fill: "none",
      stroke: c,
      "stroke-width": 2,
      "stroke-linecap": "round",
      "stroke-linejoin": "round"
    })
  );
};

const etiquetaBalancoCan = (bal, x, y, s, cor, v) => {
  const c = v > 0 ? cor : bal.AP,
    w = s.length * 9 + 22;
  bal.svg.append(
    svgEl("rect", {
      x: x - w / 2,
      y: y - 13,
      width: w,
      height: 26,
      rx: 13,
      fill: COR.branco,
      stroke: c,
      "stroke-width": 1.5
    })
  );
  txtBalancoCan(bal, x, y + 5, s, { fs: 14, cor: v > 0 ? COR.tinta : bal.AP, b: true });
};
// balanço em tela estreita: os quatro reservatórios empilhados, de montante para jusante (celular, 19/09/2026)
function balancoCanV(ref, R, V) {
  const bal = { ref, R, V }; // estado do desenho do balanço, passado às funções abaixo

  bal.W = 360;
  bal.BW = 150;
  bal.BH = 92;
  bal.PASSO = 214;
  bal.TOPO = 40;
  bal.cx = 196;
  bal.x = bal.cx - bal.BW / 2;
  const { MAR, NAT, TRF, JUS, AP, TERRA, PARADO } = PAL_BALANCO;
  bal.MAR = MAR;
  bal.NAT = NAT;
  bal.TRF = TRF;
  bal.JUS = JUS;
  bal.TERRA = TERRA;
  bal.AP = AP;
  bal.PARADO = PARADO;
  const H = bal.TOPO + 4 * bal.PASSO + 20 + 5 * 20 + 30;
  bal.svg = svgEl("svg", {
    viewBox: `0 0 ${bal.W} ${H}`,
    role: "img",
    "aria-label": `Balanço de vazões do Sistema Cantareira em ${dBR(bal.ref)}`,
    "font-family": "Arial, Helvetica, sans-serif",
    class: "vert"
  });
  bal.ordem = ["JaguariJacarei", "Cachoeira", "Atibainha", "PaivaCastro"];
  bal.tuneis = ["T7", "T6", "T5"];
  bal.rios = {
    JaguariJacarei: "rio Jaguari",
    Cachoeira: "rio Atibaia",
    Atibainha: "rio Atibaia",
    PaivaCastro: "rio Juqueri"
  };
  reservatoriosBalancoCanV(bal);
  legendaBalancoCanV(bal);
  return bal.svg;
}

// os quatro reservatórios de cima para baixo, com túneis, vazão natural e descarga para jusante
function reservatoriosBalancoCanV(bal) {
  bal.ordem.forEach((k, i) => {
    const r = bal.R[k],
      y0 = bal.TOPO + i * bal.PASSO,
      y1 = y0 + bal.BH,
      p = detCan(r.pct, bal.ref);
    const ex = y => bal.x + 4 + (26 * (y - (y0 + 8))) / (y1 - (y0 + 8)),
      px = y => bal.x + bal.BW - 40 - (20 * (y - y0)) / bal.BH;
    const cheio = Math.max(0, Math.min(1, (p ?? 0) / 100)),
      yn = y1 - (bal.BH - 12) * cheio,
      ym = y1 - (bal.BH - 12);
    if (p != null) {
      bal.svg.append(
        svgEl("polygon", {
          points: ptsBalancoCanV([
            [ex(yn), yn],
            [px(yn), yn],
            [px(y1), y1],
            [ex(y1), y1]
          ]),
          fill: "#DCE8F5"
        })
      );
      bal.svg.append(
        svgEl("line", {
          x1: ex(yn),
          x2: px(yn),
          y1: yn,
          y2: yn,
          stroke: bal.NAT,
          "stroke-width": 2,
          "stroke-linecap": "round"
        })
      );
    }
    bal.svg.append(
      svgEl("line", {
        x1: ex(ym),
        x2: px(ym),
        y1: ym,
        y2: ym,
        stroke: COR.claro,
        "stroke-width": 1.2,
        "stroke-dasharray": "4 4"
      })
    );
    bal.svg.append(
      svgEl("path", {
        d: `M${bal.x - 6} ${y0 + 8}L${bal.x + 4} ${y0 + 8}L${ex(y1)} ${y1}L${px(y1)} ${y1}`,
        fill: "none",
        stroke: bal.TERRA,
        "stroke-width": 2,
        "stroke-linecap": "round",
        "stroke-linejoin": "round"
      })
    );
    bal.svg.append(
      svgEl("polygon", {
        points: ptsBalancoCanV([
          [bal.x + bal.BW - 40, y0],
          [bal.x + bal.BW - 26, y0],
          [bal.x + bal.BW - 4, y1],
          [px(y1), y1]
        ]),
        fill: bal.MAR,
        stroke: bal.MAR,
        "stroke-width": 1.5,
        "stroke-linejoin": "round"
      })
    );
    const cm = bal.x + (bal.BW - 44) / 2 + 6;
    txtBalancoCanV(bal, bal.x - 6, y0 - 6, r.nome, { fs: 12, cor: bal.MAR, b: true, a: "start" });
    const n = txtBalancoCanV(bal, cm, y0 + 54, p == null ? "–" : fmt(p, 1), { fs: 22, b: true });
    if (p != null) {
      const s = svgEl("tspan", { "font-size": 12.5, fill: COR.vivo, dx: 2 }); // símbolo %, como no valor principal
      s.textContent = "%";
      n.append(s);
    }
    txtBalancoCanV(bal, cm, y0 + 73, `${fmt(detCan(r.vol, bal.ref), 1)} hm³`, { cor: COR.tinta2 });
    // vazão natural (e, no Atibainha, a transferência) entram pela esquerda
    const qn = detCan(r.qnat, bal.ref),
      yN = y0 + (i === 2 ? 22 : 40);
    linhaBalancoCanV(bal, 8, yN, bal.x - 8, yN, bal.NAT, qn);
    rotBalancoCanV(bal, 8, yN - 16, "VAZÃO NATURAL", "start");
    etiquetaBalancoCanV(bal, 58, yN, q(qn), bal.NAT, qn);
    if (i === 2) {
      const tr = bal.V("TransfParaibaDoSul"),
        yT = y0 + 78;
      linhaBalancoCanV(bal, 8, yT, bal.x - 4, yT, bal.TRF, tr);
      rotBalancoCanV(bal, 8, yT - 16, "TRANSF. DO JAGUARI", "start");
      etiquetaBalancoCanV(bal, 58, yT, q(tr), bal.TRF, tr);
    }
    // descarga para jusante sai pela direita, do pé da barragem
    const qj = detCan(r.qjus, bal.ref),
      yJ = y1 - 12;
    linhaBalancoCanV(bal, bal.x + bal.BW + 2, yJ, bal.W - 6, yJ, bal.JUS, qj);
    etiquetaBalancoCanV(bal, bal.W - 36, yJ - 22, q(qj), bal.JUS, qj);
    txtBalancoCanV(bal, bal.W - 4, yJ + 17, "para jusante", { fs: 10.5, cor: bal.AP, a: "end" });
    txtBalancoCanV(bal, bal.W - 4, yJ + 30, bal.rios[k], { fs: 10.5, cor: bal.AP, a: "end" });
    // túnel (ou Santa Inês, no último) desce até o próximo
    const xt = bal.cx - 24,
      ya = y1 + 6,
      yb = y0 + bal.PASSO - 6;
    const v = i < 3 ? bal.V(bal.tuneis[i]) : bal.V("ESI");
    linhaBalancoCanV(bal, xt, ya, xt, yb, bal.MAR, v);
    etiquetaBalancoCanV(bal, xt, (ya + yb) / 2, q(v), bal.MAR, v);
    rotBalancoCanV(bal, xt + 34, (ya + yb) / 2 - 4, i < 3 ? `TÚNEL ${bal.tuneis[i].slice(1)}` : "SANTA INÊS", "start");
    if (i === 3)
      txtBalancoCanV(bal, xt + 34, (ya + yb) / 2 + 11, "retirada para a RMSP", { fs: 10.5, cor: bal.AP, a: "start" });
  });
}

// legenda do diagrama
function legendaBalancoCanV(bal) {
  let yl = bal.TOPO + 4 * bal.PASSO + 16;
  [
    [bal.NAT, "Vazão natural afluente"],
    [bal.TRF, "Transferência do Paraíba do Sul"],
    [bal.MAR, "Túneis e retirada em Santa Inês"],
    [bal.JUS, "Descarga para jusante"]
  ].forEach(([c, s]) => {
    bal.svg.append(svgEl("rect", { x: 8, y: yl - 6, width: 16, height: 5, rx: 2.5, fill: c }));
    txtBalancoCanV(bal, 32, yl, s, { cor: bal.AP, a: "start" });
    yl += 20;
  });
  bal.svg.append(
    svgEl("line", {
      x1: 8,
      x2: 24,
      y1: yl - 3,
      y2: yl - 3,
      stroke: COR.claro,
      "stroke-width": 1.2,
      "stroke-dasharray": "4 4"
    })
  );
  txtBalancoCanV(bal, 32, yl, "volume útil máximo", { cor: bal.AP, a: "start" });
  txtBalancoCanV(bal, 8, yl + 26, "Valores em m³/s, média do dia.", { cor: bal.AP, a: "start" });
}

const txtBalancoCanV = (bal, tx, y, s, o = {}) => {
  const e = svgEl("text", {
    x: tx,
    y,
    "text-anchor": o.a || "middle",
    "font-size": o.fs || 11,
    fill: o.cor || COR.tinta,
    "font-weight": o.b ? 700 : 400
  });
  if (o.ls) e.setAttribute("letter-spacing", o.ls);
  e.textContent = s;
  bal.svg.append(e);
  return e;
};

const rotBalancoCanV = (bal, tx, y, s, a) => txtBalancoCanV(bal, tx, y, s, { fs: 10.5, cor: bal.AP, ls: ".04em", a });

const q = v => (v == null ? "–" : fmt(v, v < 10 ? 2 : 1));

const linhaBalancoCanV = (bal, x1, y1, x2, y2, cor, v) => {
  const parado = !(v > 0),
    c = parado ? bal.PARADO : cor;
  const l = svgEl("line", { x1, y1, x2, y2, stroke: c, "stroke-width": 2, "stroke-linecap": "round" });
  if (parado) l.setAttribute("stroke-dasharray", "3 5");
  bal.svg.append(l);
  bal.svg.append(
    svgEl("path", {
      d:
        y1 === y2
          ? `M${x2 - 8} ${y2 - 5}L${x2} ${y2}L${x2 - 8} ${y2 + 5}`
          : `M${x2 - 5} ${y2 - 8}L${x2} ${y2}L${x2 + 5} ${y2 - 8}`,
      fill: "none",
      stroke: c,
      "stroke-width": 2,
      "stroke-linecap": "round",
      "stroke-linejoin": "round"
    })
  );
};

const etiquetaBalancoCanV = (bal, tx, y, s, cor, v) => {
  const c = v > 0 ? cor : bal.AP,
    w = s.length * 8 + 18;
  bal.svg.append(
    svgEl("rect", {
      x: tx - w / 2,
      y: y - 11,
      width: w,
      height: 22,
      rx: 11,
      fill: COR.branco,
      stroke: c,
      "stroke-width": 1.5
    })
  );
  txtBalancoCanV(bal, tx, y + 4.5, s, { fs: 12.5, cor: v > 0 ? COR.tinta : bal.AP, b: true });
};

const ptsBalancoCanV = P => P.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(" ");
const legendaFaixasCan = () =>
  `<div class="legenda" style="margin-top:8px">${FAIXAS_OPERACAO_CAN.map(f => `<span><i class="area" style="background:${tintaFaixa(f)};box-shadow:inset 0 0 0 1px ${f.cor}"></i>${f.rot}</span>`).join("")}</div>`;
let estAnosCan = {}; // anos marcados no gráfico ao longo do ano (botoesAnos: padrão, os cinco até a data de referência)
function anoCan(ref) {
  const a1 = +ref.slice(0, 4),
    a0 = +CAN.de.slice(0, 4),
    todos = [];
  for (let a = a0; a <= a1; a++) todos.push(a);
  const anos = botoesAnos($("#anos-chips-can"), $("#nota-anos-can"), todos, estAnosCan, a1, () => anoCan(ref), {
    desde: VIG_CAN
  });
  const pts = {};
  const i0 = diaEntre(`${anos[0]}-01-01`, CAN.de),
    i1 = Math.min(CAN.pct.length - 1, diaEntre(ref, CAN.de));
  for (let i = Math.max(0, i0); i <= i1; i++) pts[isoMais(CAN.de, i)] = CAN.pct[i];
  graficoCalendario($("#g-can-ano"), pts, {
    colCSV: "volume_util_pct",
    anos,
    anoAtual: a1,
    dec: 1,
    unidade: "%",
    pct: true,
    marcaDia: ref,
    rotulo: "Volume útil do Sistema Cantareira (%)",
    maxVao: 3,
    tol: 1,
    faixas: ref >= VIG_CAN ? FAIXAS_OPERACAO_CAN : null
  });
  if ($("#c-ano-faixas")) $("#c-ano-faixas").hidden = ref < VIG_CAN; // legenda e nota só na vigência, como o fundo
}
function diaCan(ref) {
  const mmdd = ref.slice(5) === "02-29" ? "02-28" : ref.slice(5),
    a1 = +ref.slice(0, 4),
    dados = [];
  for (let a = +CAN.de.slice(0, 4); a <= a1; a++) {
    const iso = a === a1 ? ref : `${a}-${mmdd}`;
    dados.push({ a, v: pctCan(iso), rot: dBR(iso) });
  }
  graficoBarrasAnos($("#g-can-dia"), dados, {
    colCSV: "volume_util_pct",
    anoAtual: +ref.slice(0, 4),
    dec: 1,
    unidade: "%",
    pct: true,
    rotulo: `Volume útil do Sistema Cantareira em ${dBR(ref).slice(0, 5)} de cada ano (%)`,
    legenda: "Volume útil"
  });
  const neg = dados.filter(d => d.v != null && d.v < 0);
  $("#c-dia-nota").textContent = neg.length
    ? `Valores negativos (${neg.map(d => d.a).join(", ")}): volume abaixo do mínimo operacional da resolução, com uso da reserva técnica; aparecem como barra vazia com o número escrito.`
    : "";
}
// chuva acumulada e vazão natural média de cada um dos 12 meses até a data, contra a média de longo termo da SABESP
// (a do próprio ano); mês incompleto (o da data ou falha na série) com o número de dias com dado
function mesCan(ref) {
  const i1 = diaEntre(ref, CAN.det_de);
  // soma (chuva) ou média (vazão) dos dias com dado do mês, até a data de referência
  const agr = (arr, mesIso, soma) => {
    const i0 = diaEntre(mesIso + "-01", CAN.det_de),
      fim = Math.min(i1, i0 + diasNoMes(mesIso) - 1);
    const v = arr.slice(Math.max(0, i0), fim + 1).filter(x => x != null);
    return {
      v: v.length ? (soma ? v.reduce((a, b) => a + b, 0) : v.reduce((a, b) => a + b, 0) / v.length) : null,
      dias: v.length
    };
  };
  const mensal = (arr, mlt, soma) =>
    mesesAte(ref).map(mi => {
      const a = agr(arr, mi, soma);
      return { rot: rotuloMes(mi), ...a, mlt: mlt[mi] ?? null, parcial: a.dias < diasNoMes(mi) };
    });
  const chuva = mensal(CAN.vaz.chuva, CAN.mlt.pmlt, true),
    qnat = mensal(CAN.vaz.qnat, CAN.mlt.qmlt, false);
  graficoMensalMLT($("#g-can-chuva"), chuva, {
    rotulo: "Chuva acumulada no mês (mm)",
    eixo: "mm por mês",
    legV: "chuva no mês",
    nomeV: "chuva",
    legMlt: "MLT (SABESP)",
    unidade: "mm",
    dec: 1,
    csv: ["chuva_mm", "chuva_media_longo_termo_mm"],
    csvDias: "dias_chuva"
  });
  graficoMensalMLT($("#g-can-qnat"), qnat, {
    rotulo: "Vazão natural média do mês (m³/s)",
    eixo: "m³/s",
    legV: "vazão natural no mês",
    nomeV: "vazão",
    legMlt: "MLT (SABESP)",
    unidade: "m³/s",
    dec: 1,
    csv: ["vazao_natural_m3s", "vazao_natural_media_longo_termo_m3s"],
    csvDias: "dias_vazao"
  });
  const c = chuva[11],
    qn = qnat[11],
    pc = (a, b) => (a == null || !b ? "–" : fmt((a / b) * 100, 0) + "%");
  $("#c-mes-nota").innerHTML =
    `No mês da data de referência, até ${dBR(ref)}: chuva de ${fmt(c.v, 0)} mm, ${pc(c.v, c.mlt)} da média de longo termo do mês inteiro (${fmt(c.mlt, 0)} mm); vazão natural média de ${fmt(qn.v, 1)} m³/s, ${pc(qn.v, qn.mlt)} da média de longo termo do mês (${fmt(qn.mlt, 1)} m³/s). A SABESP atualiza as médias de longo termo a cada ano; cada mês usa a do próprio ano.`;
}

export { miniOS, paginaCantareira };
