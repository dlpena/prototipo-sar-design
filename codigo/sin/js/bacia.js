/* Página da bacia (#bacia/GRANDE): mapa com as usinas, tabela do dia com minigráficos, diagrama da cascata e
   exportações (KMZ, CSV, PDF e PNG). No protótipo, só a bacia do Grande está montada. */
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
  POR_BACIA,
  simbolo,
  TIPO,
  toast,
  UNID_MINI
} from "./base.js";
import {
  baixarArquivo,
  baixarPNG,
  EST_USINAS,
  LEG_USINAS,
  montarKMZ,
  pastaKML,
  pdfTabelaBacia,
  poligonoKML,
  pontoKML
} from "./exportacao.js";
import { descreveConfluencias, svgCascata, topoGrande } from "./topologia.js";
import { fichaDoNome, hashFicha } from "./ficha_sin.js";

function paginaGrande() {
  const B = "GRANDE",
    G = D.grande,
    lista = POR_BACIA(B);
  const nRes = lista.filter(r => r.tipo === "res").length,
    nFio = lista.filter(r => r.tipo === "fio").length;
  $("#titulo-pag").innerHTML = `
    <p class="trilha"><a href="#inicio">Início</a><span class="sep">›</span><a href="#sin">Sistema Interligado Nacional</a><span class="sep">›</span>Bacia do Grande</p>
    <div class="cab-bacia">
      <div>
        <h1>Bacia do Grande</h1>
        <p class="lead">Rio Grande e afluente Pardo, de Camargos a Água Vermelha, na divisa entre Minas Gerais e São Paulo.</p>
        <div class="carimbo"><span>Dados do dia <b id="dia-carimbo">${dBR(D.data)}</b></span><span>Base diária</span><span><b>${nRes}</b> com reservatório · <b>${nFio}</b> a fio d'água</span></div>
      </div>
    </div>
    ${barraData("dia-bacia", D.data, G.res[0].serie[0].data, D.data, "Base diária. Mapa, tabela e cascata mostram o dia escolhido.")}`;
  const main = $("#conteudo");
  main.innerHTML = `
    <nav class="indice" aria-label="Seções da página">
      <a href="#bacia/GRANDE" data-alvo="g-mapa">Mapa</a><a href="#bacia/GRANDE" data-alvo="g-tab">Usinas</a><a href="#bacia/GRANDE" data-alvo="g-diag">Cascata</a>
    </nav>
    <section class="cartao secao" id="g-mapa" aria-labelledby="t-mapa-g">
      ${barraBaixar([["baixar-kmz-bacia", "KMZ", "Baixar a bacia e as usinas em KMZ (Google Earth)"]])}
      <h2 id="t-mapa-g"><small>1</small>Mapa da bacia</h2>
      <p class="sub">Passe o mouse sobre uma usina para ler os valores do dia; clique para abrir a ficha. No controle de camadas: mapa ou satélite, contorno, hidrografia e divisão estadual.</p>
      <div class="legenda" style="margin-bottom:6px"><span>${simbolo("res", 14)}Com reservatório</span><span>${simbolo("fio", 14)}A fio d'água</span></div>
      <div id="mapa-grande" style="position:relative"></div>
    </section>
    <section class="cartao secao tabela-bacia" id="g-tab" aria-labelledby="t-tab-g">
      ${barraBaixar([
        ["baixar-csv", "CSV", "Baixar a tabela do dia em CSV"],
        ["baixar-pdf", "PDF", "Baixar a tabela do dia em PDF"]
      ])}
      <h2 id="t-tab-g"><small>2</small>Usinas em ${dBR(D.data)}</h2>
      <p class="sub">De montante para jusante. O minigráfico mostra os 30 dias até o dia escolhido, da variável selecionada, a mesma em todas as linhas.<span class="dica">Clique numa usina para abrir a ficha.</span></p>
      <p class="nota" id="aviso-dia" style="margin:0 0 8px"></p>
      <div class="tab-box"><table>
        <thead><tr><th>Usina</th><th class="r">Afluente</th><th class="r">Defluente</th><th class="r">Turbinada</th><th class="r">Vertida</th><th class="r">Nível</th><th class="r">Volume útil</th>
            <th class="mini-th"><label>Últimos 30 dias <select id="var-mini" aria-label="Variável do minigráfico"><option value="afl">afluente</option><option value="defl">defluente</option><option value="turb">turbinada</option><option value="vert">vertida</option><option value="cota" selected>nível</option><option value="vu">volume útil</option></select></label></th></tr>
          <tr class="unid"><th></th><th class="r">m³/s</th><th class="r">m³/s</th><th class="r">m³/s</th><th class="r">m³/s</th><th class="r">m</th><th class="r">%</th><th class="mini-th" id="mini-unid">m</th></tr></thead>
        <tbody id="tab-grande"></tbody></table></div>
    </section>
    <section class="cartao secao diagrama" id="g-diag" aria-labelledby="t-diag">
      ${barraBaixar([["baixar-diag", "PNG", "Baixar o diagrama como imagem"]])}
      <h2 id="t-diag"><small>3</small>Diagrama da cascata</h2>
      <p class="sub" id="sub-diag">Da cabeceira (direita) à foz no rio Paraná (esquerda), como no mapa.</p>
      <div class="legenda" style="margin-bottom:4px">
        <span>${simbolo("res", 14)}com reservatório: ponta voltada para montante, com o volume útil (VU)</span>
        <span>${simbolo("fio", 14)}a fio d'água</span><span>número: defluente do dia (m³/s)</span>
      </div>
      <div class="cx" id="diag-grande"></div>
    </section>`;
  ligarIndice();
  const mapa = mapaGrande($("#mapa-grande"), G);
  let doDia = [];
  function render(dia) {
    doDia = G.res.map(r => comDia(r, dia));
    $("#dia-carimbo").textContent = dBR(dia);
    $("#t-tab-g").innerHTML = `<small>2</small>Usinas em ${dBR(dia)}`;
    $("#tab-grande").innerHTML = "";
    tabelaGrande($("#tab-grande"), doDia);
    mapa.atualizar(doDia);
    $("#diag-grande").innerHTML = "";
    diagramaGrande($("#diag-grande"), doDia);
    const semDado = doDia.filter(r => r.cota == null).length;
    $("#aviso-dia").textContent = semDado ? `${semDado} usina(s) sem dado em ${dBR(dia)}.` : "";
  }
  ligarData("dia-bacia", G.res[0].serie[0].data, D.data, iso => {
    contexto.refSIN = iso;
    render(iso);
  });
  $("#var-mini").addEventListener("change", e => minigraficos(doDia, e.target.value));
  $("#baixar-csv").onclick = () => baixarCSV(doDia);
  $("#baixar-pdf").onclick = () =>
    pdfTabelaBacia(doDia, $("#var-mini").value, $("#var-mini").selectedOptions[0].textContent.trim());
  $("#baixar-diag").onclick = () =>
    baixarPNG(
      [$("#diag-grande svg")],
      `sar_grande_cascata_${doDia[0].dia}.png`,
      `Bacia do Grande · cascata · ${dBR(doDia[0].dia)}`,
      $("#diag-grande svg.vert")
        ? [
            { r: "com reservatório (volume útil ao lado do nome)", simbolo: "res" },
            { r: "a fio d'água", simbolo: "fio" },
            { r: "número ao lado do símbolo: defluente do dia, em m³/s" }
          ]
        : [
            { r: "com reservatório (volume útil abaixo do nome)", simbolo: "res" },
            { r: "a fio d'água", simbolo: "fio" },
            { r: "número acima do símbolo: defluente do dia, em m³/s" }
          ]
    );
  $("#baixar-kmz-bacia").onclick = () => baixarKMZ(doDia);
  const d0 = dataInicialSIN(G.res[0].serie[0].data, D.data);
  $("#dia-bacia").value = d0;
  render(d0);
}
// valores de uma usina num dia da série diária (sar0); sem registro, campos nulos
function comDia(r, dia) {
  const p = (r.serie || []).find(q => q.data === dia) || {};
  return {
    ...r,
    dia,
    vu: p.vu ?? null,
    cota: p.cota ?? null,
    afl: p.afl ?? null,
    defl: p.defl ?? null,
    turb: p.turb ?? null,
    vert: p.vert ?? null
  };
}
function baixarCSV(lista) {
  const n = v => (v == null ? "" : String(v).replace(".", ","));
  const linhas = [
    [
      "usina",
      "tipo",
      "data",
      "afluente_m3s",
      "defluente_m3s",
      "turbinada_m3s",
      "vertida_m3s",
      "cota_m",
      "volume_util_pct"
    ].join(";")
  ].concat(
    lista.map(r =>
      [
        caso(r.nome),
        TIPO[r.tipo],
        dBR(r.dia),
        n(r.afl),
        n(r.defl),
        n(r.turb),
        n(r.vert),
        n(r.cota),
        r.tipo === "fio" ? "" : n(r.vu)
      ].join(";")
    )
  );
  baixarArquivo(
    new Blob(["\ufeff" + linhas.join("\r\n")], { type: "text/csv;charset=utf-8" }),
    `sar_grande_${lista[0].dia}.csv`
  );
  toast(
    "CSV da tabela gerado. (Na página publicada no claude.ai o download é bloqueado; abra o arquivo local do protótipo.)"
  );
}
async function baixarKMZ(lista) {
  const dia = lista[0].dia,
    gb = D.geo.bacias.find(g => g.bacia === "GRANDE");
  const desc = r =>
    `<b>${r.tipo !== "fio" && r.vu != null ? `Volume útil: ${fmt(r.vu, 1)}%` : `Nível: ${fmt(r.cota, 2)} m`}</b><br/>Nível: ${fmt(r.cota, 2)} m<br/>Afluente: ${fint(r.afl)} m³/s<br/>Defluente: ${fint(r.defl)} m³/s<br/>Turbinada: ${fint(r.turb)} m³/s<br/>Vertida: ${fint(r.vert)} m³/s<br/>Estado: ${r.uf || "–"}<br/>Data do dado: ${dBR(dia)}`;
  const pasta = (nome, fio) =>
    pastaKML(
      nome,
      lista
        .filter(r => (r.tipo === "fio") === fio)
        .map(r => pontoKML(caso(r.nome), fio ? "fio" : "res", desc(r), r.lon, r.lat))
        .join("")
    );
  await montarKMZ({
    arquivo: `sar_grande_${dia}.kmz`,
    nome: `SAR · Bacia do Grande · ${dBR(dia)}`,
    n: lista.length,
    descricao: `Usinas da bacia do Grande acompanhadas pelo SAR, dados de ${dBR(dia)}, e o contorno da bacia.`,
    legenda: LEG_USINAS([{ r: "Contorno da bacia do Grande", cor: COR.ana, forma: "linha" }]),
    estilos: { ...EST_USINAS, bacia: { linha: COR.ana, largura: 2 } },
    corpo:
      `<Placemark><name>Contorno da bacia do Grande</name><styleUrl>#bacia</styleUrl>${poligonoKML(gb.aneis)}</Placemark>` +
      pasta("Usinas com reservatório", false) +
      pasta("Usinas a fio d'água", true)
  });
}
function destacaUsina(nome) {
  $$("[data-usina]").forEach(e => e.classList.toggle("acesa", e.dataset.usina === nome));
  $$("#mapa-grande .usina, #diag-grande .no-diag, #tab-grande tr").forEach(
    e => (e.style.opacity = !nome || e.dataset.usina === nome ? 1 : 0.3)
  );
}
const abrirFicha = r => {
  if (fichaDoNome(r.nome)) location.hash = hashFicha(r.nome);
  else
    toast(
      `Ficha de ${caso(r.nome)}: no protótipo há ficha só das usinas com condições de operação em resolução da ANA.`
    );
};
function tabelaGrande(tb, lista) {
  lista.forEach(r => {
    const tr = document.createElement("tr");
    tr.dataset.usina = r.nome;
    tr.tabIndex = 0;
    tr.innerHTML = `<td>${simbolo(r.tipo, 13)}<span class="nm">${esc(caso(r.nome))}</span></td>
      <td class="r num">${fint(r.afl)}</td><td class="r num">${fint(r.defl)}</td><td class="r num">${fint(r.turb)}</td><td class="r num">${fint(r.vert)}</td>
      <td class="r num">${fmt(r.cota, 2)}</td><td class="r num">${r.vu != null && r.tipo !== "fio" ? fmt(r.vu, 1) : "–"}</td>
      <td class="mini"><span class="mini-svg" data-mini="${esc(r.nome)}"></span></td>`;
    tr.addEventListener("pointerenter", () => destacaUsina(r.nome));
    tr.addEventListener("pointerleave", () => destacaUsina(null));
    tr.addEventListener("click", () => abrirFicha(r));
    tr.addEventListener("keydown", e => {
      if (e.key === "Enter") abrirFicha(r);
    });
    tb.append(tr);
  });
  minigraficos(lista, $("#var-mini").value);
}
// minigráfico: uma só variável para todas as linhas (30 dias), escala própria por linha, último ponto marcado
function minigraficos(lista, v) {
  $("#mini-unid").textContent = UNID_MINI[v];
  const W = 132,
    H = 30,
    m = 3;
  lista.forEach(r => {
    const host = $(`[data-mini="${CSS.escape(r.nome)}"]`);
    if (!host) return;
    const ate = (r.serie || []).filter(p => p.data <= r.dia).slice(-30);
    const s = ate.map(p => p[v]).filter(x => x != null);
    if (s.length < 2 || (v === "vu" && r.tipo === "fio")) {
      host.innerHTML = '<span class="sem">–</span>';
      host.title = "";
      return;
    }
    const lo = Math.min(...s),
      hi = Math.max(...s),
      k = hi > lo ? (H - 2 * m) / (hi - lo) : 0;
    const x = i => m + (i * (W - 2 * m)) / (s.length - 1),
      y = val => (hi > lo ? H - m - (val - lo) * k : H / 2);
    const d = s.map((val, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(val).toFixed(1)}`).join("");
    const dec = v === "cota" ? 2 : v === "vu" ? 1 : 0;
    // a linha estica na largura da célula (SVG interno sem proporção fixa); o ponto do último dado fica no SVG externo, em
    // pixels, com x em %, para continuar redondo em qualquer largura
    host.innerHTML = `<svg width="100%" height="${H}" aria-hidden="true"><svg width="100%" height="${H}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><path d="${d}" fill="none" stroke="${COR.ana}" stroke-width="1.4" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg><circle cx="${((100 * x(s.length - 1)) / W).toFixed(2)}%" cy="${y(s[s.length - 1]).toFixed(1)}" r="2.2" fill="${COR.ana}"/></svg>`;
    host.title = `${ate[0].data.slice(8, 10)}/${ate[0].data.slice(5, 7)} a ${dBR(r.dia)}: mínimo ${fmt(lo, dec)}, máximo ${fmt(hi, dec)} ${UNID_MINI[v]}`;
  });
}
function mapaGrande(host, G) {
  const mapa = L.map(host, { scrollWheelZoom: false, zoomSnap: 0.25 });
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
  });
  claro.addTo(mapa);
  const gb = D.geo.bacias.find(g => g.bacia === "GRANDE");
  const estilo = sat => ({ color: sat ? COR.branco : COR.ana, weight: 2.2, fill: false });
  const bacia = L.geoJSON(
    { type: "Feature", geometry: { type: "MultiPolygon", coordinates: gb.aneis.map(a => [a]) } },
    { style: estilo(false), interactive: false }
  ).addTo(mapa);
  const ufs = L.geoJSON(
    {
      type: "FeatureCollection",
      features: D.geo.ufs.map(g => ({
        type: "Feature",
        geometry: { type: "MultiPolygon", coordinates: g.aneis.map(a => [a]) }
      }))
    },
    { style: { color: COR.branco, weight: 0.8, opacity: 0.6, fill: false }, interactive: false }
  ).addTo(mapa);
  // hidrografia recortada à bacia (SNIRH + rios do cadastro ONS), mesma camada do mapa do SIN
  const rios = L.geoJSON(
    { type: "Feature", geometry: { type: "MultiLineString", coordinates: D.geo.rios_grande } },
    { style: { color: COR.rio, weight: 1.6, opacity: 0.95 }, interactive: false }
  ).addTo(mapa);
  bacia.bringToFront();
  mapa.fitBounds(bacia.getBounds(), { padding: [10, 10] });
  mapa.on("baselayerchange", e => {
    const sat = e.name === "Satélite";
    bacia.setStyle(estilo(sat));
    ufs.setStyle({ color: sat ? COR.branco : "#666" });
    rios.setStyle({ color: sat ? COR.rioSatelite : COR.rio });
    host.classList.toggle("sat", sat);
    bacia.bringToFront();
  });
  claro.on("tileerror", () => {
    if (!host.dataset.aviso) {
      host.dataset.aviso = 1;
      bacia.setStyle({ fill: true, fillColor: "#CFDDEC", fillOpacity: 0.6, color: COR.ana });
      host.insertAdjacentHTML(
        "afterend",
        '<p class="nota">Mapa-base não carregou neste ambiente: exibindo só o contorno da bacia.</p>'
      );
    }
  });

  const icone = tipo =>
    L.divIcon({
      className: "usina",
      iconSize: [18, 16],
      iconAnchor: [9, 8],
      html:
        tipo === "fio"
          ? `<svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6.5" fill="${COR.azulMedio}" stroke="${COR.branco}" stroke-width="1.4"/></svg>`
          : `<svg width="18" height="16" viewBox="0 0 18 16"><path d="M9 1 L17 15 L1 15 Z" fill="${COR.ana}" stroke="${COR.branco}" stroke-width="1.4"/></svg>`
    });
  const marc = {};
  G.res.forEach(r => {
    const m = L.marker([r.lat, r.lon], { icon: icone(r.tipo), zIndexOffset: r.tipo === "res" ? 500 : 0 }).addTo(mapa);
    m.getElement().dataset.usina = r.nome;
    m.bindTooltip("", { direction: "top", offset: [0, -8], opacity: 1 });
    const rot = L.marker([r.lat, r.lon], {
      icon: L.divIcon({ className: "rot-usina", iconAnchor: [-10, 8], html: "" }),
      interactive: false,
      zIndexOffset: -100
    }).addTo(mapa);
    m.on("mouseover", () => destacaUsina(r.nome));
    m.on("mouseout", () => destacaUsina(null));
    m.on("click", () => abrirFicha(r));
    marc[r.nome] = { m, rot };
  });
  L.control
    .layers(
      { "Mapa": claro, "Satélite": satelite },
      { "Contorno da bacia": bacia, "Hidrografia": rios, "Divisão estadual": ufs },
      { collapsed: !DESKTOP() }
    )
    .addTo(mapa);
  L.control.scale({ imperial: false }).addTo(mapa);
  return {
    atualizar(lista) {
      lista.forEach(r => {
        const html =
          `<div class="pop"><b>${esc(caso(r.nome))}</b><div class="l"><span>${TIPO[r.tipo]}</span></div>` +
          (r.tipo !== "fio"
            ? `<div class="l"><span>Volume útil</span><span class="num">${fmt(r.vu, 1)}%</span></div>`
            : "") +
          `<div class="l"><span>Nível</span><span class="num">${fmt(r.cota, 2)} m</span></div><div class="l"><span>Afluente</span><span class="num">${fint(r.afl)} m³/s</span></div><div class="l"><span>Defluente</span><span class="num">${fint(r.defl)} m³/s</span></div>` +
          `<div class="l"><span>Turbinada</span><span class="num">${fint(r.turb)} m³/s</span></div><div class="l"><span>Vertida</span><span class="num">${fint(r.vert)} m³/s</span></div><div class="l"><span>Data do dado</span><span>${dBR(r.dia)}</span></div></div>`;
        marc[r.nome].m.setTooltipContent(html);
        marc[r.nome].rot.setIcon(
          L.divIcon({
            className: "rot-usina",
            iconAnchor: [-10, 8],
            html: `<span>${esc(caso(r.nome))}${r.tipo !== "fio" ? ` ${fmt(r.vu, 0)}%` : ""}</span>`
          })
        );
      });
    }
  };
}
const DIAG_MIN = 980; // largura do diagrama horizontal; abaixo disso, vertical
// topologia vigente da bacia: a do cadastro embutido ou, depois de uma inclusão aprovada na área administrativa, a
// atualizada (o diagrama não é imagem: é desenhado do cadastro a cada vez)
function diagramaGrande(host, lista) {
  host._lista = lista;
  const T = topoGrande(),
    vert = !!(host.clientWidth && host.clientWidth < DIAG_MIN),
    sub = $("#sub-diag"),
    valores = {};
  lista.forEach(r => (valores[r.nome] = r));
  if (sub)
    sub.textContent =
      (vert
        ? `Da cabeceira (em cima) à foz no ${T.foz} (embaixo), com cada afluente numa coluna à direita. `
        : `Da cabeceira (direita) à foz no ${T.foz} (esquerda), como no mapa, com cada afluente numa faixa abaixo do rio em que deságua. `) +
      descreveConfluencias(T);
  const porId = id => lista.find(r => r.nome === id);
  host.append(
    svgCascata(T, {
      orient: vert ? "v" : "h",
      valores,
      dataTxt: `Dados de ${dBR(lista[0].dia || D.data)} · base diária`,
      rotulo: `Diagrama esquemático da cascata da bacia do Grande, gerado do cadastro (${vert ? "da cabeceira, em cima, à foz, embaixo" : "da cabeceira, à direita, à foz, à esquerda"})`,
      eventos: (g, id) => {
        g.addEventListener("pointerenter", () => destacaUsina(id));
        g.addEventListener("pointerleave", () => destacaUsina(null));
        g.addEventListener("click", () =>
          porId(id) ? abrirFicha(porId(id)) : toast("Usina incluída nesta sessão: ainda sem dados.")
        );
      }
    })
  );
}
// girar o celular ou redimensionar a janela: refaz o diagrama se a orientação tiver de mudar
window.addEventListener("resize", () => {
  const h = $("#diag-grande");
  if (!h || !h._lista) return;
  const vert = !!$("svg.vert", h),
    deve = h.clientWidth < DIAG_MIN;
  if (vert !== deve) {
    h.innerHTML = "";
    diagramaGrande(h, h._lista);
  }
});

export { abrirFicha, paginaGrande };
