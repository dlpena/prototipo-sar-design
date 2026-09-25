/* Ficha da usina do SIN (#ficha/<usina>): situação na data, gráficos nas bases diária e horária, mesmo dia em
   outros anos, ano contra anos anteriores e vazão natural contra a média de longo termo. Furnas vem embutida; as demais
   usinas com condições de operação em resolução da ANA, de fichas/<código>.json, sob demanda. */
import { contexto } from "./contexto.js";
import { FAIXAS_ANA, faixasNaData } from "./regras.js";
import { D } from "./dados_embutidos.js";
import {
  $,
  $$,
  barraBaixar,
  barraData,
  caso,
  COR,
  dataInicialSIN,
  dBR,
  diasNoMes,
  esc,
  fData,
  fHora,
  fint,
  fmt,
  ligarData,
  ligarIndice,
  mesesAte,
  naSerieUsinas,
  NOME,
  rotuloMes,
  SERIE_USINAS,
  simbolo,
  svgEl,
  TIPO,
  toast,
  usinaNoDia
} from "./base.js";
import { baixarArquivo, baixarCSVGrafico, baixarPNG, COL_UNID, LEG_ANOS } from "./exportacao.js";
import {
  botoesAnos,
  comoLer,
  graficoBarrasAnos,
  graficoCalendario,
  graficoLinhas,
  graficoMensalMLT,
  ler,
  MAX_ANOS
} from "./graficos.js";
import { abrirFicha } from "./bacia.js";
import { paginaInicio } from "./inicio.js";
import { extrasPublicos } from "./admin/admin_telas.js";
import { montarFaixa } from "./rotas.js";

// usinas com ficha no protótipo: Furnas (embutida) e as de fichas/<codigo>.json (usinas com condições de operação em resolução da ANA)
const FICHAS_SIN = [
  { nome: D.ficha.nome, codigo: D.ficha.codigo, bacia: D.ficha.bacia, arquivo: null },
  ...(D.fichas_idx || [])
];
const slugFicha = n =>
  n
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
const fichaDoNome = nome => FICHAS_SIN.find(f => f.nome === nome);
const hashFicha = nome => "ficha/" + slugFicha(nome);
let FICHA = D.ficha;
const CACHE_FICHAS = { [D.ficha.nome]: D.ficha };
function abrirFichaRota(slug) {
  const it = FICHAS_SIN.find(f => slugFicha(f.nome) === slug);
  if (!it) {
    paginaInicio();
    toast("Ficha não encontrada no protótipo.");
    return;
  }
  if (CACHE_FICHAS[it.nome]) {
    FICHA = CACHE_FICHAS[it.nome];
    paginaFicha();
    return;
  }
  $("#titulo-pag").innerHTML =
    `<p class="trilha"><a href="#inicio">Início</a><span class="sep">›</span><a href="#sin">Sistema Interligado Nacional</a></p><h1>${caso(it.nome)}</h1>`;
  $("#conteudo").innerHTML = '<p class="nota" style="padding:20px 0">Carregando a ficha…</p>';
  fetch(it.arquivo)
    .then(r => {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    })
    .then(j => {
      CACHE_FICHAS[it.nome] = j;
      if (location.hash.slice(1) === hashFicha(it.nome)) {
        FICHA = j;
        paginaFicha();
        extrasPublicos(hashFicha(it.nome));
        montarFaixa(true);
      }
    })
    .catch(() => {
      $("#conteudo").innerHTML =
        `<p class="nota" style="padding:20px 0">Não foi possível carregar a ficha de ${esc(caso(it.nome))} (arquivo ${esc(it.arquivo)}). Abra o protótipo publicado ou sirva a pasta com as fichas.</p>`;
    });
}
const VARS = {
  afl: { r: "Afluente", u: "m³/s", cor: COR.ana, dec: 0 },
  defl: { r: "Defluente", u: "m³/s", cor: "#D9822B", dec: 0 },
  turb: { r: "Turbinada", u: "m³/s", cor: "#2E9E6B", dec: 0 },
  vert: { r: "Vertida", u: "m³/s", cor: COR.vermelho, dec: 0 },
  nat: { r: "Vazão natural", u: "m³/s", cor: "#7B8794", dec: 0, tracejado: true },
  cota: { r: "Nível", u: "m", cor: COR.nivel, dec: 2 },
  vu: { r: "Volume útil", u: "%", cor: COR.nivel, dec: 1 }
};
let fichaEstado = null;

function serieDiaria() {
  // objetos por dia, ordenados
  const F = FICHA,
    c = F.diario_colunas;
  return F.diario.map(l => {
    const o = {};
    c.forEach((k, i) => (o[k] = l[i]));
    o.t = Date.UTC(+o.data.slice(0, 4), +o.data.slice(5, 7) - 1, +o.data.slice(8, 10));
    return o;
  });
}
function serieHoraria() {
  const F = FICHA,
    c = F.horario_colunas;
  return F.horario.map(l => {
    const o = {};
    c.forEach((k, i) => (o[k] = l[i]));
    o.cota = o.nivel;
    o.t = Date.UTC(+l[0].slice(0, 4), +l[0].slice(5, 7) - 1, +l[0].slice(8, 10), +l[0].slice(11, 13));
    return o;
  });
}
const isoDe = t => new Date(t).toISOString().slice(0, 10);

function paginaFicha() {
  const pag = {}; // estado da página, passado às funções abaixo

  pag.F = FICHA;
  pag.DI = serieDiaria();
  pag.HO = serieHoraria();
  pag.H = hashFicha(pag.F.nome);
  pag.arq = slugFicha(pag.F.nome).toLowerCase();
  pag.NB = NOME[pag.F.bacia] || pag.F.bacia;
  pag.VN = D.vazao_natural_mlt.usinas[pag.F.nome];
  pag.ult = pag.DI[pag.DI.length - 1];
  $("#titulo-pag").innerHTML = tituloFicha(pag);
  $("#conteudo").innerHTML = corpoFicha(pag);
  ligarIndice();

  pag.mapaF = mapaFicha($("#mapa-ficha"), pag.F);
  ligarData("dia-sit", pag.DI[0].data, pag.ult.data, iso => {
    contexto.refSIN = iso;
    situacaoFicha(pag, iso);
    graficoMesmoDia();
    anosDaReferencia(pag, iso);
    graficoAnos();
    graficoNatural();
  });
  const d0 = dataInicialSIN(pag.DI[0].data, pag.ult.data);
  $("#dia-sit").value = d0;
  situacaoFicha(pag, d0);

  // 2. gráficos
  fichaEstado = { DI: pag.DI, HO: pag.HO, ult: pag.ult };
  pag.presets = {
    dia: [
      ["30 dias", 30],
      ["90 dias", 90],
      ["1 ano", 365],
      ["5 anos", 1826],
      ["Tudo", 0]
    ],
    hora: [
      ["2 dias", 2],
      ["7 dias", 7],
      ["30 dias", 30],
      ["Tudo", 0]
    ]
  };
  ligarControlesGraficoFicha(pag);
  montarPresets(pag);

  ligarComparacaoFicha(pag);
  graficoMesmoDia();

  // 4. ano contra anos
  pag.anos = [...new Set(pag.DI.map(o => +o.data.slice(0, 4)))].sort((a, b) => a - b);
  // botões de ano (botoesAnos): padrão, os cinco anos até o da data de referência, refeitos quando ela muda de ano
  pag.estAnos = {};
  anosDaReferencia(pag, $("#dia-sit").value || pag.ult.data);
  $("#var-ano").onchange = graficoAnos;
  $("#baixar-ano-png").onclick = () =>
    baixarPNG(
      [$("#g-ano svg")],
      `sar_${pag.arq}_ano_contra_anos_${$("#dia-sit").value}.png`,
      `${caso(pag.F.nome)} · ${VARS[$("#var-ano").value].r} ao longo do ano`,
      [
        ...LEG_ANOS(+$("#dia-sit").value.slice(0, 4)),
        ...($("#var-ano").value === "vu" && FAIXAS_ANA[FICHA.nome] && !$("#f-ano-faixas")?.hidden
          ? faixasLegenda(FAIXAS_ANA[FICHA.nome]).map(f => ({ r: f.rot, cor: f.fundo, area: true }))
          : [])
      ]
    );
  graficoAnos();

  // 5. vazão natural contra a MLT do ONS
  if (pag.VN) {
    $("#baixar-nat-csv").onclick = () =>
      baixarCSVGrafico([$("#g-nat")], `sar_${pag.arq}_vazao_natural_mensal_ate_${$("#dia-sit").value}.csv`);
    $("#baixar-nat-png").onclick = () =>
      baixarPNG(
        [$("#g-nat svg")],
        `sar_${pag.arq}_vazao_natural_mensal_ate_${$("#dia-sit").value}.png`,
        `${caso(pag.F.nome)} · vazão natural mensal contra a média de longo termo · até ${dBR($("#dia-sit").value)}`,
        [],
        {
          fonte: `Fonte: vazão natural diária, SAR/ANA (Dados históricos SIN); média de longo termo, mínima e máxima, ${D.vazao_natural_mlt.fonte}.`
        }
      );
  }
  graficoNatural();
}

const tituloFicha = pag =>
  `
    <p class="trilha"><a href="#inicio">Início</a><span class="sep">›</span><a href="#sin">Sistema Interligado Nacional</a><span class="sep">›</span>${pag.F.bacia === "GRANDE" ? `<a href="#bacia/GRANDE">Bacia do Grande</a>` : `Bacia do ${esc(pag.NB)}`}<span class="sep">›</span>${caso(pag.F.nome)}</p>
    <div class="cab-bacia">
      <div>
        <h1>${simbolo("res", 22)}${caso(pag.F.nome)}</h1>
        <p class="lead">Usina com reservatório no rio ${esc(pag.F.rio)}, bacia do ${esc(pag.NB)}${pag.F.municipio ? `, em ${esc(pag.F.municipio)}` : ""}${pag.F.uf ? `, ${(D.reservatorios.find(r => r.nome === pag.F.nome) || {}).estado || pag.F.uf}` : ""}.</p>
        <div class="carimbo"><span>Código SAR <b>${pag.F.codigo}</b></span><span>Dados diários mais recentes <b>${dBR(pag.ult.data)}</b></span><span>Base diária desde <b>${dBR(pag.DI[0].data)}</b></span><span>Base horária desde <b>${fHora(pag.HO[0].t)}</b>, última <b>${fHora(pag.HO[pag.HO.length - 1].t)}</b></span></div>
      </div>
    </div>
    ${barraData("dia-sit", pag.ult.data, pag.DI[0].data, pag.ult.data, `Base diária. Situação, mesmo dia em outros anos${pag.VN ? ", ano contra anos anteriores e vazão natural" : " e ano contra anos anteriores"} seguem esta data.`)}`;

const corpoFicha = pag =>
  `
    <nav class="indice" aria-label="Seções da página">
      <a href="#${pag.H}" data-alvo="f-sit">Situação</a><a href="#${pag.H}" data-alvo="f-graf">Gráficos</a><a href="#${pag.H}" data-alvo="f-dia">Mesmo dia em outros anos</a><a href="#${pag.H}" data-alvo="f-ano">Ano contra anos anteriores</a>${pag.VN ? `<a href="#${pag.H}" data-alvo="f-nat">Vazão natural</a>` : ""}
    </nav>
    <section class="cartao secao" id="f-sit" aria-labelledby="t-sit">
      <h2 id="t-sit"><small>1</small><span>Situação em <span id="dia-sit-txt">${dBR(pag.ult.data)}</span></span></h2>
      <p class="sub">Base diária, na data de referência (o padrão são os dados mais recentes). Ao lado, a usina e as demais usinas da bacia do ${esc(pag.NB)}.<span class="dica">Mude a data de referência para ver outro dia.</span></p>
      <p class="nota" id="aviso-sit" style="margin:0 0 8px"></p>
      <div class="sit-grid">
        <div class="valores" id="valores-ficha"></div>
        <div id="mapa-ficha"></div>
      </div>
    </section>
    <section class="cartao secao" id="f-graf" aria-labelledby="t-graf">
      ${barraBaixar([
        ["baixar-serie", "CSV", "Baixar a série do período em CSV"],
        ["baixar-graf-png", "PNG", "Baixar os dois gráficos como imagem"]
      ])}
      <h2 id="t-graf"><small>2</small>Gráficos</h2>
      <p class="sub">Vazões no gráfico de cima; nível ou volume útil no de baixo, no mesmo eixo de tempo.<span class="dica">Escolha a base, o período e as variáveis; passe o mouse para ler os valores nos dois gráficos.</span></p>
      <div class="controles painel">
        <fieldset><legend>Base</legend><label><input type="radio" name="base" value="dia" checked> Diária</label><label><input type="radio" name="base" value="hora"> Horária</label></fieldset>
        <fieldset class="largo"><legend>Período</legend><span id="presets" class="presets"></span><span class="datas"><label>de <input type="date" id="g-de"></label><label>até <input type="date" id="g-ate"></label></span></fieldset>
        <fieldset><legend>Gráfico de cima: vazões</legend>${["afl", "defl", "turb", "vert", "nat"].map(k => `<label><input type="checkbox" name="vaz" value="${k}"${k === "afl" || k === "defl" ? " checked" : ""}> <i class="sw" style="border-color:${VARS[k].cor}${VARS[k].tracejado ? ";border-style:dashed" : ""}"></i>${VARS[k].r}</label>`).join("")}</fieldset>
        <fieldset><legend>Gráfico de baixo</legend>${["vu", "cota"].map((k, i) => `<label><input type="radio" name="seg" value="${k}"${i === 0 ? " checked" : ""}> <i class="sw" style="border-color:${VARS[k].cor}"></i>${VARS[k].r}</label>`).join("")}</fieldset>
      </div>
      <p class="nota aviso-afl" id="aviso-afl" hidden><b>Atenção:</b> na base horária a afluência é calculada por balanço hídrico (variação de volume mais defluência) e oscila, com valores negativos e picos que não são vazão real. Use a base diária para afluência.</p>
      <div class="graf" id="g-vazoes"></div>
      <div class="graf" id="g-segundo"></div>
      <div id="f-graf-faixas" hidden></div>
      <p class="nota" id="resumo-graf" style="margin:12px 0 0"></p>
      ${comoLer(
        "<b>Eixo do tempo.</b> Os dois gráficos compartilham o eixo do tempo: com o cursor sobre qualquer um deles, a mesma data (ou hora, na base horária) é marcada nos dois, e o balão mostra os valores.",
        "<b>Escalas.</b> As vazões ficam num gráfico e o nível ou o volume útil no outro, para que nenhum gráfico tenha dois eixos verticais. O volume útil é apresentado de 0 a 100%.",
        "<b>Base horária.</b> Dados abertos do ONS, não consistidos pelo ONS. A afluência horária é calculada por balanço hídrico e oscila; quando ela está marcada, o aviso aparece acima dos gráficos.",
        ...(FAIXAS_ANA[pag.F.nome]
          ? [
              "<b>Faixas.</b> Com o volume útil no gráfico de baixo, as faixas de operação da resolução da ANA aparecem ao fundo, como referência, só no trecho do período em que a resolução vale; a faixa em vigor é a definida conforme o próprio ato."
            ]
          : [])
      )}
    </section>
    <section class="cartao secao" id="f-dia" aria-labelledby="t-dia">
      ${barraBaixar([
        ["baixar-dia-csv", "CSV", "Baixar os dados do gráfico em CSV"],
        ["baixar-dia-png", "PNG", "Baixar o gráfico como imagem"]
      ])}
      <h2 id="t-dia"><small>3</small>Mesmo dia em outros anos</h2>
      <p class="sub">O valor na data de referência em cada ano da série diária.<span class="dica">Escolha a variável.</span></p>
      <div class="controles"><fieldset><legend>Variável</legend><select id="var-dia" aria-label="Variável">${["vu", "cota"].map(k => `<option value="${k}">${VARS[k].r} (${VARS[k].u})</option>`).join("")}</select></fieldset></div>
      <div class="graf" id="g-dia"></div>
      ${comoLer(ler("dia"), ler("escala"))}
    </section>
    <section class="cartao secao" id="f-ano" aria-labelledby="t-ano">
      ${barraBaixar([
        ["baixar-ano-csv", "CSV", "Baixar os dados do gráfico em CSV"],
        ["baixar-ano-png", "PNG", "Baixar o gráfico como imagem"]
      ])}
      <h2 id="t-ano"><small>4</small>Ano contra anos anteriores</h2>
      <p class="sub">A série diária de cada ano sobreposta no mesmo calendário, até a data de referência.<span class="dica">Selecione os anos a comparar, até ${MAX_ANOS} simultaneamente; posicione o cursor sobre o gráfico para ler o mesmo dia em cada ano.</span></p>
      <div class="controles"><fieldset><legend>Variável</legend><select id="var-ano" aria-label="Variável">${["vu", "cota"].map(k => `<option value="${k}">${VARS[k].r}${k === "vu" ? " (%)" : " (m)"}</option>`).join("")}</select></fieldset>
        <fieldset class="anos"><legend>Anos <span class="nota" id="nota-anos"></span></legend><span id="anos-chips"></span></fieldset></div>
      <div class="graf" id="g-ano"></div>
      ${notaFaixasAno(pag.F.nome)}
      ${comoLer(ler("anos"), ler("selecao"), ler("cursor"), FAIXAS_ANA[pag.F.nome] && ler("faixas", "No volume útil, as faixas de operação da resolução aparecem ao fundo apenas quando a data de referência está dentro da vigência da resolução; com data anterior, o gráfico é apresentado sem elas."))}
    </section>${
      pag.VN
        ? `
    <section class="cartao secao" id="f-nat" aria-labelledby="t-nat">
      ${barraBaixar([
        ["baixar-nat-csv", "CSV", "Baixar os dados do gráfico em CSV"],
        ["baixar-nat-png", "PNG", "Baixar o gráfico como imagem"]
      ])}
      <h2 id="t-nat"><small>5</small>Vazão natural contra a média de longo termo</h2>
      <p class="sub">Vazão natural média de cada mês, nos 12 meses até a data de referência, contra a média de longo termo, a mínima e a máxima do mês na série histórica de vazões naturais do ONS.</p>
      <div class="graf" id="g-nat"></div>
      <p class="nota" id="nat-nota" style="margin:10px 0 0"></p>
      ${comoLer(
        ler("mensal"),
        "<b>Vazão natural.</b> A vazão que chegaria à usina sem o efeito dos reservatórios e dos usos a montante. O valor do mês é a média da vazão natural diária da base diária desta ficha.",
        `<b>Média de longo termo.</b> Média de cada mês de ${D.vazao_natural_mlt.periodo[0]} a ${D.vazao_natural_mlt.periodo[1]} na série de vazões médias mensais do ONS para a usina. A série do ONS é consistida e pode diferir da vazão natural diária de operação em alguns meses.`,
        `<b>Mínima e máxima.</b> A faixa ao fundo vai da menor à maior vazão média de cada mês na mesma série; com o cursor, as duas aparecem com o ano em que ocorreram. O mês abaixo da mínima ou acima da máxima é apontado na nota abaixo do gráfico. A escala vertical vai até a máxima, e por isso as barras dos meses secos ficam baixas.`
      )}
    </section>`
        : ""
    }`;

// 1. situação: dia escolhido pelo usuário (padrão, último dia fechado)
const em = (pag, iso) => pag.DI.find(o => o.data === iso);

function situacaoFicha(pag, dia) {
  const o = em(pag, dia);
  $("#dia-sit-txt").textContent = dBR(dia);
  if (!o) {
    $("#valores-ficha").innerHTML = `<p class="nota">Sem registro na base diária em ${dBR(dia)}.</p>`;
    $("#aviso-sit").textContent = "";
    return;
  }
  const i0 = pag.DI.indexOf(o);
  const atras = n => em(pag, isoDe(o.t - n * 864e5));
  const a7 = atras(7),
    a30 = atras(30),
    anoPassado = em(pag, `${+dia.slice(0, 4) - 1}${dia.slice(4)}`);
  const delta = (k, p, dec) =>
    p && p[k] != null && o[k] != null ? `${o[k] - p[k] >= 0 ? "+" : "−"}${fmt(Math.abs(o[k] - p[k]), dec)}` : "–";
  const media = (k, n) => {
    const v = pag.DI.slice(Math.max(0, i0 - n + 1), i0 + 1)
      .map(x => x[k])
      .filter(x => x != null);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };
  $("#valores-ficha").innerHTML = `
      <div class="v principal"><div class="r">Volume útil</div><div class="n num">${fmt(o.vu, 1)}<small>%</small></div>
        <div class="c"><span>há 7 dias <b class="num">${delta("vu", a7, 1)}</b></span><span>há 30 dias <b class="num">${delta("vu", a30, 1)}</b></span><span>mesmo dia de ${+dia.slice(0, 4) - 1} <b class="num">${anoPassado && anoPassado.vu != null ? fmt(anoPassado.vu, 1) + "%" : "–"}</b></span></div>${reguaFicha(pag.F.nome, o.vu, dia)}</div>
      <div class="v"><div class="r">Nível</div><div class="n num">${fmt(o.cota, 2)}<small>m</small></div><div class="c"><span>há 7 dias <b class="num">${delta("cota", a7, 2)} m</b></span></div></div>
      <div class="v"><div class="r">Afluente</div><div class="n num">${fint(o.afl)}<small>m³/s</small></div><div class="c"><span>média de 7 dias <b class="num">${fint(media("afl", 7))}</b></span></div></div>
      <div class="v"><div class="r">Defluente</div><div class="n num">${fint(o.defl)}<small>m³/s</small></div><div class="c"><span>média de 7 dias <b class="num">${fint(media("defl", 7))}</b></span></div></div>
      <div class="v"><div class="r">Turbinada</div><div class="n num">${fint(o.turb)}<small>m³/s</small></div><div class="c"><span>média de 7 dias <b class="num">${fint(media("turb", 7))}</b></span></div></div>
      <div class="v"><div class="r">Vertida</div><div class="n num">${fint(o.vert)}<small>m³/s</small></div><div class="c"><span>média de 7 dias <b class="num">${fint(media("vert", 7))}</b></span></div></div>`;
  // o mapa segue a data de referência; as vizinhas têm dado no período da série diária das usinas
  pag.mapaF.atualizar(dia);
  $("#aviso-sit").textContent = naSerieUsinas(dia)
    ? ""
    : `No mapa, as demais usinas têm dado de ${dBR(SERIE_USINAS.de)} a ${dBR(SERIE_USINAS.ate)}: em ${dBR(dia)}, aparecem sem valor.`;
}

function montarPresets(pag) {
  const base = $("input[name=base]:checked").value,
    S = base === "dia" ? pag.DI : pag.HO;
  $("#presets").innerHTML = pag.presets[base]
    .map(([r, n], i) => `<button type="button" class="preset${i === 0 ? " ativo" : ""}" data-n="${n}">${r}</button>`)
    .join("");
  $$("#presets .preset").forEach(
    b =>
      (b.onclick = () => {
        $$("#presets .preset").forEach(x => x.classList.toggle("ativo", x === b));
        aplicarPresetFicha(pag, +b.dataset.n);
      })
  );
  $("#g-de").min = isoDe(S[0].t);
  $("#g-de").max = isoDe(S[S.length - 1].t);
  $("#g-ate").min = $("#g-de").min;
  $("#g-ate").max = $("#g-de").max;
  $("input[name=vaz][value=nat]").disabled = base === "hora";
  if (base === "hora") $("input[name=vaz][value=nat]").checked = false;
  $("#aviso-afl").hidden = base !== "hora";
  aplicarPresetFicha(pag, pag.presets[base][0][1]);
}

function aplicarPresetFicha(pag, n) {
  const base = $("input[name=base]:checked").value,
    S = base === "dia" ? pag.DI : pag.HO,
    fim = S[S.length - 1].t;
  $("#g-ate").value = isoDe(fim);
  $("#g-de").value = n ? isoDe(Math.max(S[0].t, fim - (n - 1) * 864e5)) : isoDe(S[0].t);
  desenharGraficos();
}

const ligarControlesGraficoFicha = pag => {
  $$("input[name=base]").forEach(i => (i.onchange = (...a) => montarPresets(pag, ...a)));
  $$("input[name=vaz], input[name=seg]").forEach(i => (i.onchange = desenharGraficos));
  $("#g-de").onchange = $("#g-ate").onchange = () => {
    $$("#presets .preset").forEach(x => x.classList.remove("ativo"));
    desenharGraficos();
  };
  $("#baixar-serie").onclick = baixarSerie;
  $("#baixar-graf-png").onclick = () => {
    const seg = $("input[name=seg]:checked").value;
    const leg = $$("input[name=vaz]:checked")
      .map(i => ({ r: VARS[i.value].r, cor: VARS[i.value].cor, tracejado: VARS[i.value].tracejado }))
      .concat([{ r: VARS[seg].r, cor: VARS[seg].cor }])
      .concat(
        $("#f-graf-faixas").hidden
          ? []
          : faixasLegenda(FAIXAS_ANA[FICHA.nome]).map(f => ({ r: f.rot, cor: f.fundo, area: true }))
      );
    baixarPNG(
      [$("#g-vazoes svg"), $("#g-segundo svg")],
      `sar_${pag.arq}_graficos_${$("#g-de").value}_${$("#g-ate").value}.png`,
      `${caso(pag.F.nome)} · ${$("input[name=base]:checked").value === "dia" ? "base diária" : "base horária"} · ${dBR($("#g-de").value)} a ${dBR($("#g-ate").value)}`,
      leg
    );
  };
};

// 3. mesmo dia
const ligarComparacaoFicha = pag => {
  $("#var-dia").onchange = graficoMesmoDia;
  $("#baixar-dia-csv").onclick = () =>
    baixarCSVGrafico([$("#g-dia")], `sar_${pag.arq}_mesmo_dia_${$("#dia-sit").value}.csv`);
  $("#baixar-ano-csv").onclick = () =>
    baixarCSVGrafico([$("#g-ano")], `sar_${pag.arq}_ano_contra_anos_${$("#dia-sit").value}.csv`);
  $("#baixar-dia-png").onclick = () =>
    baixarPNG(
      [$("#g-dia svg")],
      `sar_${pag.arq}_mesmo_dia_${$("#dia-sit").value}.png`,
      `${caso(pag.F.nome)} · ${VARS[$("#var-dia").value].r} em ${dBR($("#dia-sit").value).slice(0, 5)} de cada ano`,
      LEG_ANOS(+$("#dia-sit").value.slice(0, 4))
    );
};

function anosDaReferencia(pag, iso) {
  const aoMudar = () => {
    anosDaReferencia(pag, $("#dia-sit").value || pag.ult.data);
    graficoAnos();
  };
  fichaEstado.anosSel = new Set(
    botoesAnos(
      $("#anos-chips"),
      $("#nota-anos"),
      pag.anos,
      pag.estAnos,
      +iso.slice(0, 4),
      aoMudar,
      FAIXAS_ANA[FICHA.nome]
    )
  );
}
function redesenharFicha() {
  if (!fichaEstado) return;
  desenharGraficos();
  graficoMesmoDia();
  graficoAnos();
  graficoNatural();
}
// vazão natural média de cada mês (média dos dias com dado da base diária), 12 meses até a data de referência, contra a
// MLT, a mínima e a máxima do mês da usina na série de vazões médias mensais do ONS (D.vazao_natural_mlt)
function graficoNatural() {
  const VN = D.vazao_natural_mlt.usinas[FICHA.nome];
  if (!VN || !$("#g-nat")) return;
  const ref = $("#dia-sit").value || fichaEstado.ult.data,
    meses = mesesAte(ref);
  const por = {};
  fichaEstado.DI.forEach(o => {
    if (o.nat != null && o.data <= ref && o.data.slice(0, 7) >= meses[0]) (por[o.data.slice(0, 7)] ||= []).push(o.nat);
  });
  const dados = meses.map(mi => {
    const v = por[mi] || [],
      k = +mi.slice(5, 7) - 1;
    return {
      rot: rotuloMes(mi),
      v: v.length ? v.reduce((a, b) => a + b, 0) / v.length : null,
      mlt: VN.mlt[k],
      min: VN.min[k][0],
      anoMin: VN.min[k][1],
      max: VN.max[k][0],
      anoMax: VN.max[k][1],
      dias: v.length,
      parcial: v.length < diasNoMes(mi)
    };
  });
  const P = D.vazao_natural_mlt.periodo;
  graficoMensalMLT($("#g-nat"), dados, {
    rotulo: "Vazão natural média do mês (m³/s)",
    eixo: "m³/s",
    legV: "vazão natural no mês",
    nomeV: "vazão",
    legMlt: `MLT ${P.join("–")}`,
    legFaixa: `mínima–máxima ${P.join("–")}`,
    unidade: "m³/s",
    dec: 0,
    csv: ["vazao_natural_m3s", "vazao_natural_media_longo_termo_m3s"],
    csvDias: true,
    csvFaixa: ["vazao_natural_minima_m3s", "ano_minima", "vazao_natural_maxima_m3s", "ano_maxima"],
    cheia: true
  });
  // meses fora da faixa da série: abaixo da mínima ou acima da máxima do período da série do ONS
  const fora = dados
    .filter(d => d.v != null && (d.v < d.min || d.v > d.max))
    .map(
      d =>
        `${d.rot}${d.parcial ? ` (${d.dias} ${d.dias === 1 ? "dia" : "dias"})` : ""}, ${fint(d.v)} m³/s, ${d.v < d.min ? `abaixo da mínima (${fint(d.min)} m³/s em ${d.anoMin})` : `acima da máxima (${fint(d.max)} m³/s em ${d.anoMax})`}`
    );
  const u = dados[11];
  $("#nat-nota").textContent =
    `No mês da data de referência, até ${dBR(ref)}: ${fint(u.v)} m³/s, ${u.v == null ? "–" : fmt((u.v / u.mlt) * 100, 0) + "%"} da média de longo termo do mês (${fint(u.mlt)} m³/s). ` +
    (fora.length ? `Fora da faixa de ${P[0]} a ${P[1]}: ${fora.join("; ")}. ` : "") +
    `Fonte: vazão natural diária, SAR/ANA (Dados históricos SIN); média de longo termo, mínima e máxima, ${D.vazao_natural_mlt.fonte}.`;
}

function recorte() {
  const base = $("input[name=base]:checked").value,
    S = base === "dia" ? fichaEstado.DI : fichaEstado.HO;
  const de = Date.parse($("#g-de").value + "T00:00:00Z"),
    ate = Date.parse($("#g-ate").value + "T23:59:59Z");
  return { base, S: S.filter(o => o.t >= de && o.t <= ate) };
}
function desenharGraficos() {
  const { base, S } = recorte();
  const vaz = $$("input[name=vaz]:checked").map(i => i.value),
    seg = $("input[name=seg]:checked").value;
  const sync = {};
  graficoLinhas(
    $("#g-vazoes"),
    S,
    vaz.map(k => ({ k, ...VARS[k] })),
    { base, unidade: "m³/s", dec: 0, altura: "principal", sync, rotulo: "Vazões (m³/s)" }
  );
  // volume útil das usinas com faixas em resolução da ANA: as faixas ao fundo, só a partir da vigência
  const RA = seg === "vu" ? FAIXAS_ANA[FICHA.nome] : null,
    inicioFx = RA && (RA.desde || "1900-01-01"),
    comFx = !!(RA && S.length && S[S.length - 1].t >= Date.parse(inicioFx + "T00:00:00Z"));
  graficoLinhas($("#g-segundo"), S, [{ k: seg, ...VARS[seg] }], {
    base,
    unidade: VARS[seg].u,
    dec: VARS[seg].dec,
    altura: "apoio",
    sync,
    rotulo: `${VARS[seg].r} (${VARS[seg].u})`,
    fundo: comFx ? fundoFaixasSerie(RA, inicioFx) : null
  });
  $("#f-graf-faixas").hidden = !comFx;
  if (comFx) $("#f-graf-faixas").innerHTML = notaFaixasSerie(FICHA.nome, S[0].t < Date.parse(inicioFx + "T00:00:00Z"));
  $("#resumo-graf").textContent = S.length
    ? `${S.length} ${base === "dia" ? "dias" : "horas"}, de ${base === "dia" ? fData(S[0].t) : fHora(S[0].t)} a ${base === "dia" ? fData(S[S.length - 1].t) : fHora(S[S.length - 1].t)}.`
    : "Nenhum registro no período.";
}
function baixarSerie() {
  const { base, S } = recorte();
  if (!S.length) {
    toast("Nenhum registro no período.");
    return;
  }
  const cols =
    base === "dia"
      ? ["data", "afl", "defl", "turb", "vert", "nat", "cota", "vu"]
      : ["instante", "afl", "defl", "turb", "vert", "cota", "vu"];
  const cab = {
    data: "data",
    instante: "instante",
    afl: "afluente_m3s",
    defl: "defluente_m3s",
    turb: "turbinada_m3s",
    vert: "vertida_m3s",
    nat: "vazao_natural_m3s",
    cota: "cota_m",
    vu: "volume_util_pct"
  };
  const n = v => (v == null ? "" : String(v).replace(".", ","));
  const linhas = [cols.map(c => cab[c]).join(";")].concat(
    S.map(o => cols.map(c => (c === "data" ? dBR(o.data) : c === "instante" ? fHora(o.t) : n(o[c]))).join(";"))
  );
  baixarArquivo(
    new Blob(["\uFEFF" + linhas.join("\r\n")], { type: "text/csv;charset=utf-8" }),
    `sar_${slugFicha(FICHA.nome).toLowerCase()}_${base === "dia" ? "diario" : "horario"}_${$("#g-de").value}_${$("#g-ate").value}.csv`
  );
  toast(
    `CSV com ${S.length} registros gerado. (Na página publicada no claude.ai o download é bloqueado; abra o arquivo local.)`
  );
}

// 3. barras: valor do mesmo dia em cada ano (o gráfico de barras por ano comum)
function graficoMesmoDia() {
  const DI = fichaEstado.DI,
    k = $("#var-dia").value,
    V = VARS[k],
    ref = $("#dia-sit").value || fichaEstado.ult.data;
  const mmdd = ref.slice(5),
    anos = [...new Set(DI.map(o => +o.data.slice(0, 4)))];
  const dados = anos.map(a => {
    const iso = `${a}-${mmdd}`;
    return { a, v: (DI.find(o => o.data === iso) || {})[k] ?? null, data: dBR(iso), rot: dBR(iso) };
  });
  graficoBarrasAnos($("#g-dia"), dados, {
    anoAtual: +ref.slice(0, 4),
    dec: V.dec,
    unidade: V.u,
    pct: k === "vu",
    relativo: k === "cota",
    colCSV: colunaCSV(V),
    rotulo: `${V.r} (${V.u}) em ${dBR(ref).slice(0, 5)}`,
    legenda: V.r
  });
}
// nome da coluna do CSV a partir da variável da ficha (ex.: volume_util_pct, cota_m)
function colunaCSV(V) {
  return (
    V.r.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/\W+/g, "_") +
    "_" +
    (COL_UNID[V.u] || "").split("_").pop()
  );
}

// faixas que valem numa data (Serra da Mesa muda com o período do ano)
// legenda: todas as faixas da usina, sem repetir (nos períodos, a união)
const faixasLegenda = RA => {
  const v = new Map();
  (RA.periodos ? RA.periodos.flatMap(p => p.faixas) : RA.faixas || []).forEach(f => v.set(f.rot, f));
  return [...v.values()];
};
function notaVigencia(RA, dia, qual) {
  if (!RA.desde) return `${RA.desdeTxt} ${RA.vig}`;
  if (dia && dia < RA.desde)
    return `Em ${dBR(dia)} a resolução ainda não vigorava (vigência a partir de ${dBR(RA.desde)}, ${RA.artVig}): ${qual} não se aplicavam nessa data.`;
  return `${qual[0].toUpperCase() + qual.slice(1)} valem a partir de ${dBR(RA.desde)}, início da vigência da resolução (${RA.artVig}). ${RA.vig}`;
}
// régua das faixas de operação no cartão do volume útil da ficha (só usinas com faixas em resolução da ANA)
function reguaFicha(nome, vu, dia) {
  const RA = FAIXAS_ANA[nome];
  if (!RA) return "";
  const marca =
    vu != null
      ? `<span class="regua-marca" style="left:${Math.max(0, Math.min(100, vu))}%" title="${fmt(vu, 1)}% em ${dBR(dia)}"></span>`
      : "";
  const FX = faixasNaData(RA, dia),
    cortes = [
      0,
      ...FX.map(f => f.de)
        .filter(v => v > 0)
        .sort((a, b) => a - b),
      100
    ];
  return `<div class="regua-faixas" aria-hidden="true">${FX.slice()
    .reverse()
    .map(f => {
      const de = Math.max(0, f.de),
        ate = Math.min(100, f.ate);
      return `<span style="width:${ate - de}%;background:${f.cor}" title="${f.rot}"></span>`;
    })
    .join("")}</div>
    <div class="regua-rot">${cortes.map(v => `<b style="left:${v}%">${v}</b>`).join("")}${marca}</div>
    <p class="regua-nota">Faixas de operação de ${caso(nome)} (${RA.art} da ${RA.ato})${RA.periodos ? `, no ${RA.periodos.find(p => p.meses.includes(+dia.slice(5, 7))).rot}` : ""}, como referência. ${notaVigencia(RA, dia, "as faixas")}${RA.obs ? " " + RA.obs : ""}</p>`;
}
// faixas da resolução ao fundo do gráfico do volume útil no período (graficoLinhas, opção fundo): um retângulo por
// faixa em cada trecho de dias com os mesmos limites (em Serra da Mesa mudam com o período úmido ou seco), a partir de
// `desde` (vigência, ou a data da resolução quando a vigência não é conhecida)
function fundoFaixasSerie(RA, desde) {
  return (svg, X, Y, { lo, hi, t0, t1 }) => {
    const dia = 864e5,
      ini = Math.max(t0, Date.parse(desde + "T00:00:00Z")),
      iso = t => new Date(t).toISOString().slice(0, 10);
    const trechos = [];
    for (let t = ini; t <= t1; t += dia) {
      const F = faixasNaData(RA, iso(t)),
        u = trechos[trechos.length - 1];
      if (u && u.F === F) u.b = Math.min(t + dia, t1);
      else trechos.push({ a: t, b: Math.min(t + dia, t1), F });
    }
    trechos.forEach(({ a, b, F }) =>
      F.forEach(f => {
        const y0 = Y(Math.min(hi, f.ate)),
          y1 = Y(Math.max(lo, f.de));
        if (y1 > y0)
          svg.append(
            svgEl("rect", { x: X(a), y: y0, width: Math.max(0, X(b) - X(a)), height: y1 - y0, fill: f.fundo })
          );
      })
    );
  };
}
function notaFaixasSerie(nome, cortada) {
  const RA = FAIXAS_ANA[nome];
  const vig = RA.desde
    ? `Aparecem a partir de ${dBR(RA.desde)}, início da vigência da resolução (${RA.artVig})${cortada ? "; antes dessa data, o gráfico fica sem elas" : ""}.`
    : `${RA.desdeTxt || ""}`;
  return `<div class="legenda" style="margin-top:8px">${faixasLegenda(RA)
    .map(
      f => `<span><i class="area" style="background:${f.fundo};box-shadow:inset 0 0 0 1px ${f.cor}"></i>${f.rot}</span>`
    )
    .join("")}</div>
      <p class="nota" style="margin:8px 0 0">No volume útil, ao fundo, as faixas de operação de ${caso(nome)} (${RA.art} da ${RA.ato})${RA.periodos ? `, que mudam com o período: ${RA.periodos.map(p => p.rot).join("; ")}` : ""}, como referência. ${vig} ${RA.vig}</p>`;
}
// legenda e nota das faixas (ou dos estágios) abaixo do gráfico ano contra anos
function notaFaixasAno(nome) {
  const RA = FAIXAS_ANA[nome];
  if (!RA) return "";
  const vig = RA.desde
    ? `Valem a partir de ${dBR(RA.desde)}, início da vigência da resolução (${RA.artVig}); antes dessa data não se aplicavam. ${RA.vig}`
    : `${RA.desdeTxt} ${RA.vig}`;
  return `<div id="f-ano-faixas"><div class="legenda" style="margin-top:8px">${faixasLegenda(RA)
    .map(
      f => `<span><i class="area" style="background:${f.fundo};box-shadow:inset 0 0 0 1px ${f.cor}"></i>${f.rot}</span>`
    )
    .join("")}</div>
      <p class="nota" style="margin:8px 0 0">No volume útil, ao fundo, as faixas de operação de ${caso(nome)} (${RA.art} da ${RA.ato})${RA.periodos ? `, que mudam com o período: ${RA.periodos.map(p => p.rot).join("; ")}` : ""}, como referência. ${vig}${RA.obs ? " " + RA.obs : ""}</p></div>`;
}
// 4. ano contra anos anteriores: o gráfico por ano comum (graficoCalendario), com as faixas da resolução ao fundo
function graficoAnos() {
  const DI = fichaEstado.DI,
    k = $("#var-ano").value,
    V = VARS[k];
  const ref = ($("#dia-sit") || {}).value || fichaEstado.ult.data; // o gráfico segue a data de referência
  const anos = [...fichaEstado.anosSel].sort();
  // faixas só no volume útil e só quando a data de referência está na vigência da resolução
  const RAu = k === "vu" ? FAIXAS_ANA[FICHA.nome] : null,
    RA = RAu && (!RAu.desde || ref >= RAu.desde) ? RAu : null;
  if ($("#f-ano-faixas")) $("#f-ano-faixas").hidden = !RA;
  const pontos = {};
  DI.forEach(o => {
    if (anos.includes(+o.data.slice(0, 4)) && o[k] != null && o.data <= ref) pontos[o.data] = o[k];
  });
  graficoCalendario($("#g-ano"), pontos, {
    anos,
    anoAtual: +ref.slice(0, 4),
    dec: V.dec,
    unidade: V.u,
    pct: k === "vu",
    marcaDia: ref,
    maxVao: 3,
    tol: 1,
    rotulo: `${V.r} (${V.u})`,
    colCSV: colunaCSV(V),
    // em Serra da Mesa as faixas mudam com o período (úmido e seco): fundo mês a mês
    fundoMes: RA ? q => faixasNaData(RA, `2025-${String(q + 1).padStart(2, "0")}-15`) : null
  });
}

// mapa pequeno: a usina e as vizinhas da cascata
function mapaFicha(host, F) {
  const mapa = L.map(host, { scrollWheelZoom: false, zoomSnap: 0.25, zoomControl: false });
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
  const claro = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap",
    maxZoom: 18
  }).addTo(mapa);
  const grande = F.bacia === "GRANDE",
    gb = D.geo.bacias.find(g => g.bacia === F.bacia);
  const bacia = gb
    ? L.geoJSON(
        { type: "Feature", geometry: { type: "MultiPolygon", coordinates: gb.aneis.map(a => [a]) } },
        { style: { color: COR.ana, weight: 1.6, fill: false }, interactive: false }
      ).addTo(mapa)
    : null;
  const rios = grande
    ? L.geoJSON(
        { type: "Feature", geometry: { type: "MultiLineString", coordinates: D.geo.rios_grande } },
        { style: { color: COR.rio, weight: 1.4, opacity: 0.95 }, interactive: false }
      ).addTo(mapa)
    : null;
  mapa.on("baselayerchange", e => {
    const sat = e.name === "Satélite";
    if (bacia) bacia.setStyle({ color: sat ? COR.branco : COR.ana });
    if (rios) rios.setStyle({ color: sat ? COR.rioSatelite : COR.rio });
    host.classList.toggle("sat", sat);
  });
  // usinas: no Grande, as da cascata; nas demais bacias, as usinas da bacia com coordenada
  const lista = grande ? D.grande.res : D.reservatorios.filter(r => r.bacia === F.bacia && r.lat != null);
  if (!lista.some(r => r.nome === F.nome)) lista.push({ nome: F.nome, tipo: "res", lat: F.lat, lon: F.lon });
  if (bacia) mapa.fitBounds(bacia.getBounds(), { padding: [6, 6] });
  else mapa.fitBounds(L.latLngBounds(lista.map(r => [r.lat, r.lon])).pad(0.2));
  const marc = {};
  lista.forEach(r => {
    const eu = r.nome === F.nome;
    const ic = L.divIcon({
      className: "usina",
      iconSize: [18, 16],
      iconAnchor: [9, 8],
      html:
        r.tipo === "fio"
          ? `<svg width="12" height="12" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6.5" fill="${eu ? COR.branco : COR.azulMedio}" stroke="${COR.branco}" stroke-width="1.4"/></svg>`
          : `<svg width="${eu ? 26 : 16}" height="${eu ? 24 : 14}" viewBox="0 0 18 16"><path d="M9 1 L17 15 L1 15 Z" fill="${eu ? COR.ana : COR.azulMedio}" stroke="${COR.branco}" stroke-width="${eu ? 1.8 : 1.2}"/></svg>`
    });
    const m = L.marker([r.lat, r.lon], { icon: ic, zIndexOffset: eu ? 1000 : 0 }).addTo(mapa);
    m.bindTooltip("", { direction: "top", offset: [0, -8], opacity: 1 });
    if (!eu) m.on("click", () => abrirFicha(r));
    L.marker([r.lat, r.lon], {
      icon: L.divIcon({
        className: "rot-usina" + (eu ? " eu" : ""),
        iconAnchor: [eu ? -14 : -8, 8],
        html: `<span>${esc(caso(r.nome))}</span>`
      }),
      interactive: false,
      zIndexOffset: -100
    }).addTo(mapa);
    marc[r.nome] = m;
  });
  L.control.layers({ "Mapa": claro, "Satélite": satelite }, null, { collapsed: true }).addTo(mapa);
  L.control.zoom({ position: "bottomright" }).addTo(mapa);
  return {
    atualizar(dia) {
      lista.forEach(x => {
        const r = usinaNoDia(x, dia);
        marc[r.nome].setTooltipContent(
          `<div class="pop"><b>${esc(caso(r.nome))}</b><div class="l"><span>${TIPO[r.tipo] || ""}</span></div>` +
            (r.tipo !== "fio" && r.vu != null
              ? `<div class="l"><span>Volume útil</span><span class="num">${fmt(r.vu, 1)}%</span></div>`
              : "") +
            (r.cota != null
              ? `<div class="l"><span>Nível</span><span class="num">${fmt(r.cota, 2)} m</span></div>`
              : "") +
            (r.defl != null
              ? `<div class="l"><span>Defluente</span><span class="num">${fint(r.defl)} m³/s</span></div>`
              : "") +
            `<div class="l"><span>Data do dado</span><span>${dBR(dia)}</span></div>` +
            (fichaDoNome(r.nome) && r.nome !== F.nome
              ? `<div class="l"><span>Clique para abrir a ficha</span></div>`
              : "") +
            `</div>`
        );
      });
    }
  };
}

export { abrirFichaRota, fichaDoNome, hashFicha, redesenharFicha };
