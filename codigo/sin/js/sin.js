/* Página do módulo SIN (#sin): bacias do ONS (mapa de navegação e tabela), reservatório equivalente, ao longo do ano,
   mesmo dia em outros anos e mapa das usinas. */
import { contexto } from "./contexto.js";
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
  DESKTOP,
  esc,
  fint,
  fmt,
  ligarData,
  ligarIndice,
  naSerieUsinas,
  NOME,
  ORDEM_BACIAS,
  POR_BACIA,
  RES,
  SERIE_USINAS,
  svgEl,
  TIPO,
  toast,
  usinaNoDia
} from "./base.js";
import {
  baixarCSVGrafico,
  baixarPNG,
  EST_USINAS,
  LEG_ANOS,
  LEG_USINAS,
  montarKMZ,
  pastaKML,
  pdfSecao,
  pontoKML,
  salvarCSV
} from "./exportacao.js";
import { botoesAnos, comoLer, graficoBarrasAnos, graficoCalendario, ler, MAX_ANOS } from "./graficos.js";
import { abrirFicha } from "./bacia.js";
import { ordenavel } from "./ne.js";

function paginaSIN() {
  const pag = {}; // estado da página, passado às funções abaixo

  pag.ult = D.equivalente.ultimo_dia;
  pag.S = D.equivalente.serie;
  pag.ini = Object.keys(pag.S).sort()[0];
  pag.nRes = RES.length;
  pag.nComCoord = RES.filter(r => r.x != null).length;
  $("#titulo-pag").innerHTML = tituloSIN(pag);
  const main = $("#conteudo");
  main.innerHTML = marcacaoSIN(pag);
  ligarIndice();
  pag.dia = pag.ult;
  pag.anosTodos = [...new Set(Object.keys(pag.S).map(k => +k.slice(0, 4)))].sort((a, b) => a - b);
  pag.estAnos = {};
  ligarData("dia-sin", pag.ini, pag.ult, iso => {
    contexto.refSIN = iso;
    if (pag.S[iso] != null) render(pag, iso);
  });
  const d0 = dataInicialSIN(pag.ini, pag.ult);
  $("#dia-sin").value = d0;
  render(pag, pag.S[d0] != null ? d0 : pag.ult);
  contexto.redesenharSIN = () => render(pag, pag.dia);
  mapaSIN($("#mapa-sin"));
  ligarDownloadsSIN(pag);
  listaBacias();
  pag.mp = mapaLeaflet();
  atualizarMapaSIN(pag.mp, pag.dia);
}

const diasAntesSIN = (iso, dias) => {
  const t = new Date(iso + "T12:00:00Z");
  t.setUTCDate(t.getUTCDate() - dias);
  return t.toISOString().slice(0, 10);
};

const dif = (a, b) => {
  if (a == null || b == null) return "–";
  const d = a - b;
  return `${d > 0 ? "+" : d < 0 ? "−" : ""}${fmt(Math.abs(d), 1)} p.p.`;
};

const tituloSIN = pag =>
  `
    <p class="trilha"><a href="#inicio">Início</a><span class="sep">›</span>Sistema Interligado Nacional</p>
    <h1>Sistema Interligado Nacional</h1>
    <div class="carimbo"><span>Dados do dia <b id="dia-carimbo-sin">${dBR(pag.ult)}</b></span><span>Base diária</span><span><b>${pag.nRes}</b> usinas em <b>${ORDEM_BACIAS.length}</b> bacias</span></div>
    ${barraData("dia-sin", pag.ult, pag.ini, pag.ult, "Base diária. O reservatório equivalente, os gráficos e o mapa das usinas mostram o dia escolhido.")}`;

const marcacaoSIN = pag =>
  `
    <section class="cartao intro" aria-label="Sobre o módulo">
      <p>O Sistema Interligado Nacional (SIN) reúne as usinas hidrelétricas operadas sob coordenação do Operador Nacional do Sistema Elétrico (ONS). Parte delas tem reservatório de regularização, cujo volume útil permite armazenar água no período úmido para uso no período seco; as demais operam a fio d'água, sem capacidade de regularização significativa, e dependem das afluências naturais e da operação dos reservatórios a montante. A operação desses reservatórios considera a geração de energia, o controle de cheias e os usos múltiplos da água.</p>
      <p>Esta página mostra o armazenamento agregado do sistema e a sua comparação com os anos anteriores. Cada bacia tem a sua página, com nível, afluência, defluência e volume útil de cada usina. São ${pag.nRes} usinas em ${ORDEM_BACIAS.length} bacias, com dados diários informados pelo ONS.</p>
    </section>

    <nav class="indice" aria-label="Seções da página">
      <a href="#sin" data-alvo="s-bacias">Bacias</a><a href="#sin" data-alvo="s-equiv">Reservatório equivalente</a><a href="#sin" data-alvo="s-ano">Ao longo do ano</a><a href="#sin" data-alvo="s-dia">Mesmo dia em outros anos</a><a href="#sin" data-alvo="s-usinas">Mapa das usinas</a>
    </nav>

    <section class="cartao secao" id="s-bacias" aria-labelledby="t-bacias">
      ${barraBaixar([
        ["baixar-bacias-csv", "CSV", "Baixar a tabela das bacias em CSV"],
        ["baixar-bacias-pdf", "PDF", "Baixar a tabela das bacias em PDF"]
      ])}
      <h2 id="t-bacias"><small>1</small>Bacias</h2>
      <p class="sub">As usinas estão agrupadas em ${ORDEM_BACIAS.length} bacias, segundo a divisão adotada pelo ONS.<span class="dica">Passe o mouse para destacar e clique para abrir a página da bacia.</span></p>
    <div class="explorar">
      <div class="mapa-caixa" style="padding:0">
        <div id="mapa-sin" style="position:relative"></div>
      </div>
      <div class="lista">
        <div class="cab">
          <p class="rotulo-sec" style="margin:0;font-size:15px">Bacias</p>
          <p class="nota">Com reservatório: usinas com volume útil de regularização, para as quais o SAR acompanha o armazenamento. A fio d'água: usinas sem capacidade de regularização significativa, para as quais o SAR acompanha nível e vazões.</p>
        </div>
        <div class="duas-tabelas">
          <div class="tab-box"><table id="tab-bacias">
          <thead><tr><th data-ord="nome">Bacia</th><th class="r" data-ord="comRes" data-tipo="num">Com reservatório</th><th class="r" data-ord="nFio" data-tipo="num">A fio d'água</th></tr>
          <tr class="unid"><th></th><th class="r">usinas</th><th class="r">usinas</th></tr></thead>
          <tbody id="corpo-bacias"></tbody>
        </table></div>
          <div class="tab-box"><table id="tab-bacias-2">
          <thead><tr><th data-ord="nome">Bacia</th><th class="r" data-ord="comRes" data-tipo="num">Com reservatório</th><th class="r" data-ord="nFio" data-tipo="num">A fio d'água</th></tr>
          <tr class="unid"><th></th><th class="r">usinas</th><th class="r">usinas</th></tr></thead>
          <tbody id="corpo-bacias-2"></tbody>
        </table></div>
        </div>
        <p class="nota" id="pe-bacias" style="padding:0 20px 14px;margin:0"></p>
      </div>
    </div>
    </section>

    <section class="cartao secao" id="s-equiv" aria-labelledby="t-equiv">
      <h2 id="t-equiv"><small>2</small>Reservatório equivalente do SIN</h2>
      <p class="sub">O volume útil das usinas com reservatório, agregado num único reservatório equivalente e expresso em % do volume útil total, conforme a definição adotada no SAR: indica o armazenamento do SIN como um todo.</p>
    <div class="equiv">
      <div class="lado">
        <div class="valor num" id="equiv-valor"></div>
        <div class="quando" id="equiv-quando"></div>
      </div>
      <ul class="comparacoes" id="equiv-comp"></ul>
    </div>
    </section>

    <section class="cartao secao" id="s-ano" aria-labelledby="t-ano">
      ${barraBaixar([
        ["baixar-equiv-csv", "CSV", "Baixar os dados do gráfico em CSV"],
        ["baixar-equiv-png", "PNG", "Baixar o gráfico como imagem"]
      ])}
      <h2 id="t-ano"><small>3</small>Ao longo do ano</h2>
      <p class="sub">O reservatório equivalente dia a dia, cada ano no mesmo calendário, até a data de referência: permite comparar o armazenamento com o da mesma época em outros anos e acompanhar o ritmo de enchimento e de deplecionamento.<span class="dica">Selecione os anos a comparar, até ${MAX_ANOS} simultaneamente; posicione o cursor sobre o gráfico para ler o mesmo dia em cada ano.</span></p>
      <div class="controles"><fieldset class="anos"><legend>Anos <span class="nota" id="nota-anos-sin"></span></legend><span id="anos-chips-sin"></span></fieldset></div>
      <div class="graf" id="g-equiv"></div>
      ${comoLer(ler("anos"), ler("selecao"), ler("cursor"))}
    </section>

    <section class="cartao secao" id="s-dia" aria-labelledby="t-dia">
      ${barraBaixar([
        ["baixar-barras-csv", "CSV", "Baixar os dados do gráfico em CSV"],
        ["baixar-barras-png", "PNG", "Baixar o gráfico como imagem"]
      ])}
      <h2 id="t-dia"><small>4</small>Mesmo dia em outros anos</h2>
      <p class="sub">O reservatório equivalente no dia e mês da data de referência, em cada ano desde 2000, início da série: comparação entre anos sem o efeito da sazonalidade.</p>
      <div class="graf" id="g-barras"></div>
      ${comoLer(ler("dia"), "<b>Escala.</b> O eixo vertical vai de 0 a 100%.")}
    </section>

    <section class="cartao secao" id="s-usinas" aria-labelledby="t-usinas">
      ${barraBaixar([["baixar-kmz", "KMZ", "Baixar as usinas visíveis em KMZ (Google Earth)"]])}
      <h2 id="t-usinas"><small>5</small>Mapa das usinas</h2>
      <p class="sub">Localização das usinas, com os dados da data de referência.<span class="dica">Passe o mouse sobre um símbolo para ler o valor e clique para abrir a ficha; use as camadas para escolher o mapa-base e os grupos.</span></p>
      <p class="resumo-filtros" id="resumo-filtros"></p>
      <div id="mapa-situacao"></div>
      <p class="nota" id="aviso-usinas-dia" style="margin:8px 0 0" hidden></p>
      <p class="nota" style="margin:8px 0 0">${pag.nRes - pag.nComCoord} das ${pag.nRes} usinas não têm coordenada no cadastro do ONS e não aparecem no mapa. Mapa-base e imagem de satélite vêm de serviços externos; onde a rede os bloqueia, ficam só as bacias.</p>
    </section>`;

const aoLongo = (pag, d) => {
  const anos = botoesAnos($("#anos-chips-sin"), $("#nota-anos-sin"), pag.anosTodos, pag.estAnos, +d.slice(0, 4), () =>
    aoLongo(pag, pag.dia)
  );
  const pts = {};
  Object.keys(pag.S).forEach(k => {
    if (k <= d && anos.includes(+k.slice(0, 4))) pts[k] = pag.S[k];
  });
  graficoCalendario($("#g-equiv"), pts, {
    colCSV: "volume_util_pct",
    anos,
    anoAtual: +d.slice(0, 4),
    dec: 1,
    unidade: "%",
    pct: true,
    marcaDia: d,
    rotulo: "Reservatório equivalente do SIN (%)",
    maxVao: 3,
    tol: 1
  });
};

// mesmo dia em cada ano da série, desde 2000, até o da data de referência (o gráfico de barras por ano comum)
const mesmoDiaSIN = (pag, d) => {
  const anoR = +d.slice(0, 4),
    dados = [];
  for (let a = pag.anosTodos[0]; a <= anoR; a++) {
    const iso = a + d.slice(4);
    if (pag.S[iso] != null) dados.push({ a, v: pag.S[iso], data: dBR(iso), rot: dBR(iso) });
  }
  graficoBarrasAnos($("#g-barras"), dados, {
    anoAtual: anoR,
    dec: 1,
    unidade: "%",
    pct: true,
    colCSV: "volume_util_pct",
    rotulo: `Reservatório equivalente do SIN em ${dBR(d).slice(0, 5)} de cada ano (%)`,
    legenda: "Reservatório equivalente"
  });
};

const render = (pag, d) => {
  pag.dia = d;
  const v0 = pag.S[d],
    v7 = pag.S[diasAntesSIN(d, 7)],
    v30 = pag.S[diasAntesSIN(d, 30)],
    vAno = pag.S[+d.slice(0, 4) - 1 + d.slice(4)];
  $("#dia-carimbo-sin").textContent = dBR(d);
  $("#equiv-valor").innerHTML = v0 == null ? "–" : `${fmt(v0, 1)}<small>%</small>`;
  $("#equiv-quando").textContent = v0 == null ? `sem dado em ${dBR(d)}` : `volume útil armazenado em ${dBR(d)}`;
  $("#equiv-comp").innerHTML =
    `<li><span>Em 7 dias</span><b class="num">${dif(v0, v7)}</b></li><li><span>Em 30 dias</span><b class="num">${dif(v0, v30)}</b></li>` +
    `<li><span>Mesmo dia de ${+d.slice(0, 4) - 1}</span><b class="num">${vAno == null ? "–" : fmt(vAno, 1) + "%"}</b></li>`;
  aoLongo(pag, d);
  mesmoDiaSIN(pag, d);
  if (pag.mp) atualizarMapaSIN(pag.mp, d);
};

const basesBacias = () =>
  ORDEM_BACIAS.map(b => {
    const l = POR_BACIA(b);
    return {
      b,
      nome: NOME[b],
      comRes: l.filter(r => r.tipo !== "fio").length,
      nFio: l.filter(r => r.tipo === "fio").length
    };
  });

const ligarDownloadsSIN = pag => {
  $("#baixar-bacias-csv").onclick = () =>
    salvarCSV(
      ["bacia", "usinas_com_reservatorio", "usinas_a_fio_dagua"],
      basesBacias().map(x => [x.nome, x.comRes, x.nFio]),
      "sar_sin_bacias.csv"
    );
  $("#baixar-bacias-pdf").onclick = () => {
    const l = basesBacias();
    pdfSecao([$("#tab-bacias"), $("#tab-bacias-2")], "sar_sin_bacias.pdf", {
      pe: [[`Total: ${l.length} bacias`, l.reduce((a, x) => a + x.comRes, 0), l.reduce((a, x) => a + x.nFio, 0)]]
    });
  };
  $("#baixar-equiv-csv").onclick = () =>
    baixarCSVGrafico([$("#g-equiv")], `sar_sin_equivalente_ao_longo_do_ano_ate_${pag.dia}.csv`);
  $("#baixar-barras-csv").onclick = () =>
    baixarCSVGrafico([$("#g-barras")], `sar_sin_equivalente_mesmo_dia_${pag.dia}.csv`);
  $("#baixar-equiv-png").onclick = () =>
    baixarPNG(
      [$("#g-equiv svg")],
      `sar_sin_equivalente_ao_longo_do_ano_ate_${pag.dia}.png`,
      `Reservatório equivalente do SIN ao longo do ano · até ${dBR(pag.dia)}`,
      LEG_ANOS(+pag.dia.slice(0, 4))
    );
  $("#baixar-barras-png").onclick = () =>
    baixarPNG(
      [$("#g-barras svg")],
      `sar_sin_equivalente_mesmo_dia_${pag.dia}.png`,
      `Reservatório equivalente do SIN em ${dBR(pag.dia)} de cada ano`,
      LEG_ANOS(+pag.dia.slice(0, 4))
    );
};

// borda azul do item em destaque, por cima das divisas vizinhas e abaixo dos rótulos. É uma cópia só de contorno:
// mover o próprio polígono sob o mouse fazia o clique se perder
function contornoAceso(svg, alvo, antesDe) {
  if (!svg) return;
  svg.querySelectorAll(".contorno-aceso").forEach(e => e.remove());
  if (!alvo) return;
  const c = svgEl("path", {
    d: alvo.getAttribute("d"),
    class: "contorno-aceso",
    fill: "none",
    stroke: COR.ana,
    "stroke-width": 1.6,
    "stroke-linejoin": "round",
    "pointer-events": "none"
  });
  const ref = antesDe && svg.querySelector(antesDe);
  if (ref && ref.parentNode === svg) svg.insertBefore(c, ref);
  else svg.append(c);
}
function acender(b) {
  $$(".sub-bacia.sin").forEach(p => {
    const ativa = !!b && p.dataset.bacia === b;
    p.classList.toggle("acesa", ativa);
    p.classList.toggle("apagada", !!b && p.dataset.bacia !== b);
  });
  contornoAceso($(".sub-bacia.sin")?.ownerSVGElement, b && $(`.sub-bacia.sin[data-bacia="${b}"]`), ".rotulos");
  $$(".usina").forEach(u => u.classList.toggle("apagada", !!b && u.dataset.bacia !== b));

  $$("#corpo-bacias tr, #corpo-bacias-2 tr").forEach(tr => tr.classList.toggle("acesa", tr.dataset.bacia === b));
}
function abrirBacia(b) {
  if (b === "GRANDE") location.hash = "bacia/GRANDE";
  else toast(`Bacia ${NOME[b]}: no protótipo, só a página da bacia do Grande está desenhada.`);
}

function mapaSIN(host) {
  const M = D.sin;
  const svg = svgEl("svg", {
    viewBox: `0 0 ${M.w} ${M.h}`,
    role: "img",
    "aria-label": "Mapa das bacias do SIN com as usinas"
  });
  const gSub = svgEl("g"),
    gUf = svgEl("g");
  gUf.append(svgEl("path", { d: M.brasil, class: "brasil" }));
  const gRot = svgEl("g", { class: "rotulos" });
  M.bacias.forEach(s => {
    const p = svgEl("path", { d: s.d, class: "sub-bacia sin" });
    p.dataset.bacia = s.bacia;
    p.addEventListener("pointerenter", () => acender(s.bacia));
    p.addEventListener("click", () => abrirBacia(s.bacia));
    gSub.append(p);
  });
  const rot = document.createElement("div");
  rot.className = "rotulo-bacia";
  rot.hidden = true;
  const tip = document.createElement("div");
  tip.className = "tip";
  tip.hidden = true;
  svg.append(gUf, gSub, gRot);
  svg.addEventListener("pointerleave", () => {
    acender(null);
    rot.hidden = true;
  });
  gSub.addEventListener("pointermove", ev => {
    const p = ev.target.closest(".sub-bacia.sin");
    if (!p) {
      rot.hidden = true;
      return;
    }
    const b = p.dataset.bacia,
      lista = POR_BACIA(b);
    rot.innerHTML = `Bacia ${NOME[b]}<small>${lista.length} usina${lista.length > 1 ? "s" : ""}</small>`;
    rot.hidden = false;
    posiciona(rot, ev, -34);
  });
  host.append(svg, rot);
  function posiciona(el, ev, dy = 12) {
    const r = host.getBoundingClientRect();
    let x = ev.clientX - r.left + 14,
      y = ev.clientY - r.top + dy;
    if (x + el.offsetWidth > r.width) x = ev.clientX - r.left - el.offsetWidth - 14;
    if (y + el.offsetHeight > r.height) y = r.height - el.offsetHeight - 4;
    el.style.left = Math.max(0, x) + "px";
    el.style.top = Math.max(0, y) + "px";
  }
}

function mapaLeaflet() {
  const mp = {}; // estado do mapa, passado às funções abaixo

  camadasMapaSIN(mp);

  marcadoresMapaSIN(mp);
  controlesMapaSIN(mp);
  cardsMapaSIN(mp);

  // KMZ dos pontos visíveis: pastas por grupo, mesmo conteúdo do popup na descrição
  ligarKmzMapaSIN(mp);
  return mp;
}

// mapa-base (mapa ou satélite), bacias e estados; se o mapa-base não carregar, as bacias viram o fundo
function camadasMapaSIN(mp) {
  const el = $("#mapa-situacao");
  mp.mapa = L.map(el, { scrollWheelZoom: false, zoomSnap: 0.25 });
  mp.claro = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap",
    maxZoom: 18,
    opacity: 0.85
  });
  mp.satelite = L.layerGroup([
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      attribution: "Esri World Imagery",
      maxZoom: 18
    }),
    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 18 }
    )
  ]);
  mp.claro.addTo(mp.mapa);
  // bacias do SIN sempre presentes: são o fundo quando o mapa-base não carrega
  mp.bacias = L.geoJSON(
    {
      type: "FeatureCollection",
      features: D.geo.bacias.map(g => ({
        type: "Feature",
        properties: { bacia: g.bacia },
        geometry: { type: "MultiPolygon", coordinates: g.aneis.map(a => [a]) }
      }))
    },
    { style: { color: "#3F5F8F", weight: 1.8, fillColor: "#CFDDEC", fillOpacity: 0.35 }, interactive: false }
  );
  mp.ufs = L.geoJSON(
    {
      type: "FeatureCollection",
      features: D.geo.ufs.map(g => ({
        type: "Feature",
        properties: { uf: g.uf },
        geometry: { type: "MultiPolygon", coordinates: g.aneis.map(a => [a]) }
      }))
    },
    { style: { color: "#666", weight: 0.8, opacity: 0.55, fill: false }, interactive: false }
  ).addTo(mp.mapa);
  mp.bacias.addTo(mp.mapa); // depois das UFs: o limite de bacia fica por cima do estadual
  mp.mapa.on("overlayadd", () => mp.bacias.bringToFront());
  mp.mapa.on("baselayerchange", e =>
    mp.ufs.setStyle({ color: e.name === "Satélite" ? COR.branco : "#666", opacity: e.name === "Satélite" ? 0.5 : 0.55 })
  );
  let tileFalhou = false;
  mp.claro.on("tileerror", () => {
    if (!tileFalhou) {
      tileFalhou = true;
      mp.bacias.setStyle({ fillOpacity: 0.7 });
      $("#mapa-situacao").insertAdjacentHTML(
        "beforebegin",
        '<p class="nota" id="aviso-tiles">Mapa-base não carregou neste ambiente: exibindo só as bacias do SIN.</p>'
      );
    }
  });
}

// um marcador por usina, nos grupos com reservatório e a fio d'água; o conteúdo do balão é o do dia (atualizarMapaSIN)
function marcadoresMapaSIN(mp) {
  mp.grupos = { res: L.layerGroup(), fio: L.layerGroup() };
  mp.marcadores = [];
  RES.filter(r => r.x != null).forEach(r => {
    const tipo = r.tipo === "fio" ? "fio" : "res";
    const m = L.marker([r.lat, r.lon], { icon: icone(tipo), zIndexOffset: tipo === "res" ? 500 : 0 })
      .bindTooltip("", { direction: "top", offset: [0, -6], opacity: 1 })
      .bindPopup("");
    m.on("click", () => abrirFicha(r));
    mp.grupos[tipo].addLayer(m);
    mp.marcadores.push({ tipo, r, m });
  });
}

// valores de cada usina na data de referência: balão, popup e o que o KMZ leva
function atualizarMapaSIN(mp, dia) {
  mp.dia = dia;
  mp.marcadores.forEach(x => {
    x.v = usinaNoDia(x.r, dia);
    const html = balaoUsinaSIN(x.tipo, x.v);
    x.m.setTooltipContent(html).setPopupContent(html);
    x.m.setOpacity(x.v.cota == null && x.v.vu == null ? 0.45 : 1);
  });
  const av = $("#aviso-usinas-dia");
  av.hidden = naSerieUsinas(dia);
  av.textContent = `O mapa tem o dado de cada usina de ${dBR(SERIE_USINAS.de)} a ${dBR(SERIE_USINAS.ate)}: em ${dBR(dia)}, as usinas aparecem sem valor.`;
}

const balaoUsinaSIN = (tipo, v) => {
  const valor =
    tipo === "res" && v.vu != null
      ? `${fmt(v.vu, 1)} <small>% do volume útil</small>`
      : v.cota != null
        ? `${fmt(v.cota, 2)} <small>m de nível</small>`
        : "sem dado";
  const num = (x, f, u) => (x == null ? "–" : `${f(x)} ${u}`);
  return (
    `<div class="pop"><b>${esc(caso(v.nome))}</b><div class="valor num">${valor}</div>` +
    `<div class="l"><span>${TIPO[v.tipo]}</span></div>` +
    `<div class="l"><span>Nível</span><span class="num">${num(v.cota, x => fmt(x, 2), "m")}</span></div><div class="l"><span>Afluente</span><span class="num">${num(v.afl, fint, "m³/s")}</span></div><div class="l"><span>Defluente</span><span class="num">${num(v.defl, fint, "m³/s")}</span></div>` +
    `<div class="l"><span>Bacia</span><span>${NOME[v.bacia]}</span></div><div class="l"><span>Estado</span><span>${v.uf || "–"}</span></div><div class="l"><span>Data do dado</span><span>${dBR(v.dia)}</span></div></div>`
  );
};

// controle de camadas, escala, enquadramento e cartões das bacias
function controlesMapaSIN(mp) {
  mp.grupos.res.addTo(mp.mapa);
  mp.grupos.fio.addTo(mp.mapa);
  L.control
    .layers(
      { "Mapa": mp.claro, "Satélite": mp.satelite },
      {
        "Usinas com reservatório": mp.grupos.res,
        "Usinas a fio d'água": mp.grupos.fio,
        "Bacias do SIN": mp.bacias,
        "Divisão estadual": mp.ufs
      },
      { collapsed: !DESKTOP() || false }
    )
    .addTo(mp.mapa);
  L.control.scale({ imperial: false }).addTo(mp.mapa);
  const pontos = mp.marcadores.map(m => [m.r.lat, m.r.lon]);
  mp.mapa.fitBounds(L.latLngBounds(pontos), { padding: [12, 12] });

  mp.mapa.on("overlayadd overlayremove", (...a) => cardsMapaSIN(mp, ...a));
}

// download em KMZ dos pontos visíveis, com pastas por grupo
function ligarKmzMapaSIN(mp) {
  $("#baixar-kmz").onclick = async () => {
    const vis = mp.marcadores.filter(m => mp.mapa.hasLayer(mp.grupos[m.tipo])),
      dia = mp.dia;
    const desc = r =>
      `<b>${r.tipo !== "fio" && r.vu != null ? `Volume útil: ${fmt(r.vu, 1)}%` : r.cota != null ? `Nível: ${fmt(r.cota, 2)} m` : "Sem dado"}</b><br/>Nível: ${r.cota == null ? "–" : fmt(r.cota, 2) + " m"}<br/>Afluente: ${r.afl == null ? "–" : fint(r.afl) + " m³/s"}<br/>Defluente: ${r.defl == null ? "–" : fint(r.defl) + " m³/s"}<br/>Bacia: ${NOME[r.bacia]}<br/>Estado: ${r.uf || "–"}<br/>Data do dado: ${dBR(dia)}`;
    const pasta = (nome, k) =>
      pastaKML(
        nome,
        vis
          .filter(m => m.tipo === k)
          .map(m => pontoKML(caso(m.r.nome), k, desc(m.v), m.r.lon, m.r.lat))
          .join("")
      );
    await montarKMZ({
      arquivo: `sar_sin_${dia}.kmz`,
      nome: `SAR · Usinas do SIN · ${dBR(dia)}`,
      n: vis.length,
      descricao: `Usinas do SIN acompanhadas pelo SAR, dados de ${dBR(dia)}.`,
      legenda: LEG_USINAS(),
      estilos: EST_USINAS,
      corpo: pasta("Usinas com reservatório", "res") + pasta("Usinas a fio d'água", "fio")
    });
  };
}

const icone = tipo =>
  L.divIcon({
    className: "",
    iconSize: [12, 11],
    iconAnchor: [6, 6],
    html:
      tipo === "fio"
        ? `<svg width="10" height="10" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6.5" fill="${COR.azulMedio}" stroke="rgba(255,255,255,.8)" stroke-width="1.4"/></svg>`
        : `<svg width="12" height="11" viewBox="0 0 18 16"><path d="M9 1 L17 15 L1 15 Z" fill="${COR.ana}" stroke="rgba(255,255,255,.8)" stroke-width="1.4"/></svg>`
  });

function cardsMapaSIN(mp) {
  const ligado = k => mp.mapa.hasLayer(mp.grupos[k]);
  const ativos = ["res", "fio"]
    .filter(ligado)
    .map(k => (k === "res" ? "usinas com reservatório" : "usinas a fio d'água"));
  $("#resumo-filtros").textContent =
    ativos.length === 2
      ? `Mostrando as ${mp.marcadores.length} usinas com coordenada.`
      : ativos.length
        ? `Mostrando só ${ativos[0]}.`
        : "Nenhum grupo ligado.";
}

// mesma tabela das outras páginas: cabeçalho em duas linhas, ordenação por clique, hover ligado ao mapa
function listaBacias() {
  const linhas = ORDEM_BACIAS.map(b => {
    const lista = POR_BACIA(b);
    return {
      b,
      nome: NOME[b],
      comRes: lista.filter(r => r.tipo !== "fio").length,
      nFio: lista.filter(r => r.tipo === "fio").length
    };
  });
  const corpos = [$("#corpo-bacias"), $("#corpo-bacias-2")];
  const meio = Math.ceil(linhas.length / 2);
  const desenhar = () => {
    corpos.forEach(c => (c.innerHTML = ""));
    linhas.forEach((l, i) => {
      const tr = document.createElement("tr");
      tr.dataset.bacia = l.b;
      tr.tabIndex = 0;
      tr.innerHTML =
        `<td><span class="nm">${NOME[l.b]}</span></td>` +
        `<td class="r num${l.comRes ? "" : " zero"}">${l.comRes || "–"}</td>` +
        `<td class="r num${l.nFio ? "" : " zero"}">${l.nFio || "–"}</td>`;
      tr.setAttribute("aria-label", `${NOME[l.b]}: ${l.comRes} com reservatório, ${l.nFio} a fio d'água`);
      tr.addEventListener("pointerenter", () => acender(l.b));
      tr.addEventListener("pointerleave", () => acender(null));
      tr.addEventListener("focus", () => acender(l.b));
      tr.addEventListener("click", () => abrirBacia(l.b));
      tr.addEventListener("keydown", e => {
        if (e.key === "Enter") abrirBacia(l.b);
      });
      corpos[i < meio ? 0 : 1].append(tr);
    });
    espelharOrdem();
  };
  // a ordenação vale para as 22 bacias: a seta do cabeçalho aparece nas duas tabelas
  function espelharOrdem() {
    const th = $(
      "#tab-bacias th.ord-asc, #tab-bacias th.ord-desc, #tab-bacias-2 th.ord-asc, #tab-bacias-2 th.ord-desc"
    );
    $$("#tab-bacias th[data-ord], #tab-bacias-2 th[data-ord]").forEach(o => o.classList.remove("ord-asc", "ord-desc"));
    if (!th) return;
    const classe = th.classList.contains("ord-asc") ? "ord-asc" : "ord-desc";
    $$(`#tab-bacias th[data-ord="${th.dataset.ord}"], #tab-bacias-2 th[data-ord="${th.dataset.ord}"]`).forEach(o =>
      o.classList.add(classe)
    );
  }
  ordenavel($("#tab-bacias"), linhas, desenhar);
  ordenavel($("#tab-bacias-2"), linhas, desenhar);
  desenhar();
  const somaR = linhas.reduce((a, l) => a + l.comRes, 0),
    somaF = linhas.reduce((a, l) => a + l.nFio, 0);
  $("#pe-bacias").textContent = `${linhas.length} bacias · ${somaR} usinas com reservatório · ${somaF} a fio d'água`;
}

export { contornoAceso, paginaSIN };
