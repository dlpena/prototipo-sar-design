/* Módulo Outros Sistemas Hídricos (#outros): página do módulo e o que os três sistemas usam em comum. Arquitetura
   em estrutura/outros_sistemas.md (Diego, 18/09/2026); Cantareira pela Resolução Conjunta ANA/DAEE nº 925/2017. */
import { contexto } from "./contexto.js";
import { CAN, D, OS } from "./dados_embutidos.js";
import { $, $$, caso, COR, dBR, esc, fmt, ligarIndice, svgEl } from "./base.js";
import { PAGINA_SIS } from "./outros_sistemas.js";

const diaEntre = (iso, de) => Math.round((Date.parse(iso + "T00:00:00Z") - Date.parse(de + "T00:00:00Z")) / 864e5);
const isoMais = (iso, n) => {
  const x = new Date(iso + "T00:00:00Z");
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};
const pctCan = iso => {
  const i = diaEntre(iso, CAN.de);
  return i >= 0 && i < CAN.pct.length ? CAN.pct[i] : null;
};
const detCan = (arr, iso) => {
  const i = diaEntre(iso, CAN.det_de);
  return i >= 0 && i < arr.length ? arr[i] : null;
};
const COR_SIS = { cantareira: COR.ana, df: COR.verde, rmbh: COR.bronze };
// coordenadas: SNIRH/ANA, serviço de mapas IG/SAR, camadas 2 a 4 (pontos_sar.json, consulta de 17/09/2026)
const COORD_OS = {
  40001: [-15.77842, -48.23186],
  40002: [-15.66811, -47.95398],
  40003: [-15.80009, -47.78495],
  29001: [-22.92461, -46.42703],
  29002: [-23.05106, -46.31999],
  29003: [-23.17574, -46.39364],
  29004: [-23.32999, -46.67953],
  50001: [-20.14532, -44.25647],
  50002: [-19.91847, -44.16969],
  50003: [-19.97256, -44.3436]
}; // mesmo trio dos módulos da página inicial (19/09/2026)
const NOME_SIS = { cantareira: "Sistema Cantareira", df: "Distrito Federal", rmbh: "Paraopeba" };
contexto.refOS = CAN ? CAN.ate : D.data;
// a data de referência vale dentro de um sistema; ao trocar de sistema volta ao último dia dele
const entrarSis = (sis, ult) => {
  if (contexto.sisOS !== sis) {
    contexto.refOS = ult;
    contexto.sisOS = sis;
  }
};

/* ---------- página geral do módulo ---------- */
function paginaOutros() {
  const pag = {}; // estado da página, passado às funções abaixo

  if (!OS) {
    location.hash = "inicio";
    return;
  }
  pag.ult = CAN.ate;
  pag.p0 = pctCan(pag.ult);
  pag.d30 = pag.p0 - pctCan(isoMais(pag.ult, -30));
  pag.anoAnt = `${+pag.ult.slice(0, 4) - 1}${pag.ult.slice(4)}`;
  pag.pAnt = pctCan(pag.anoAnt);
  const nRes = 4 + OS.sistemas.df.res.length + OS.sistemas.rmbh.res.length;
  $("#titulo-pag").innerHTML = `
    <p class="trilha"><a href="#inicio">Início</a><span class="sep">›</span>Outros Sistemas Hídricos</p>
    <h1>Outros Sistemas Hídricos</h1>
    <div class="carimbo"><span><b>3</b> sistemas de abastecimento</span><span><b>${nRes}</b> reservatórios</span><span>Base diária</span></div>`;
  $("#conteudo").innerHTML = corpoOutros(pag);
  ligarIndice();
  $$("[data-abrir]").forEach(b => (b.onclick = () => abrir(b.dataset.abrir)));
  // mapa: Brasil recortado no Sudeste e Centro-Oeste, pontos dos reservatórios por sistema
  pag.P = D.inicio.pontos
    .filter(q => q.m === "OUTROS")
    .map(q => ({ ...q, s: q.y < 450 ? "df" : q.x > 560 ? "rmbh" : "cantareira" }));
  const x0 = Math.min(...pag.P.map(q => q.x)) - 90,
    x1 = Math.max(...pag.P.map(q => q.x)) + 90,
    y0 = Math.min(...pag.P.map(q => q.y)) - 70,
    y1 = Math.max(...pag.P.map(q => q.y)) + 60;
  const svg = svgEl("svg", {
    viewBox: `${x0} ${y0} ${x1 - x0} ${y1 - y0}`,
    role: "img",
    "aria-label": "Localização dos três sistemas"
  });
  svg.append(svgEl("path", { d: D.sin.brasil, fill: COR.linha, stroke: COR.branco, "stroke-width": 1 }));
  D.sin.ufs.forEach(u => svg.append(svgEl("path", { d: u.d, fill: "none", stroke: COR.branco, "stroke-width": 0.9 })));
  D.sin.ufs.forEach(u => {
    if (!u.rx) return;
  });
  pag.grupos = {};
  ["cantareira", "df", "rmbh"].forEach(s => {
    const g = svgEl("g", { class: "os-ponto" });
    g.dataset.sis = s;
    const [gx, gy] = cx(pag, s);
    g.append(
      svgEl("circle", {
        cx: gx,
        cy: gy,
        r: 16,
        fill: COR_SIS[s],
        "fill-opacity": 0.12,
        stroke: COR_SIS[s],
        "stroke-width": 1
      })
    );
    pag.P.filter(q => q.s === s).forEach(q =>
      g.append(svgEl("circle", { cx: q.x, cy: q.y, r: 3.2, fill: COR_SIS[s], stroke: COR.branco, "stroke-width": 0.8 }))
    );
    const tx = svgEl("text", {
      x: gx + 20,
      y: gy + 4,
      "font-size": 11,
      "font-family": "Arial",
      "font-weight": 700,
      fill: COR_SIS[s],
      "paint-order": "stroke",
      stroke: COR.branco,
      "stroke-width": 3
    });
    tx.textContent = NOME_SIS[s].replace("Sistema ", "");
    g.append(tx);
    g.addEventListener("click", () => abrir(s));
    svg.append(g);
    pag.grupos[s] = g;
  });
  $("#os-mapa").append(svg);
  Object.entries(pag.grupos).forEach(([s, g]) => {
    g.addEventListener("pointerenter", () => acende(pag, s));
    g.addEventListener("pointerleave", () => acende(pag, null));
  });
  $$(".os-cartao").forEach(c => {
    c.addEventListener("pointerenter", () => acende(pag, c.dataset.sis));
    c.addEventListener("pointerleave", () => acende(pag, null));
  });
}

const sisDF = s =>
  OS.sistemas[s].res
    .map(
      r =>
        `<div class="l"><span>${esc(caso(r.nome))}</span><span class="num">${r.pct != null ? fmt(r.pct, 1) + "%" : r.cota != null ? fmt(r.cota, 2) + ' m <small class="nota">só nível</small>' : "–"}</span></div>`
    )
    .join("");

const dataSis = s => {
  const ds = OS.sistemas[s].res
    .map(r => r.data)
    .filter(Boolean)
    .sort();
  return ds.length ? ds[ds.length - 1] : null;
};

const corpoOutros = pag =>
  `
    <section class="cartao intro" aria-label="Sobre o módulo"><p>Três sistemas de abastecimento público, com dados diários: o Sistema Cantareira, que abastece grande parte da Região Metropolitana de São Paulo; os reservatórios do Distrito Federal (Descoberto, Santa Maria e Lago Paranoá); e o Sistema Paraopeba (Rio Manso, Vargem das Flores e Serra Azul), que contribui para o abastecimento da Região Metropolitana de Belo Horizonte.</p></section>
    <nav class="indice" aria-label="Seções da página"><a href="#outros" data-alvo="o-sis">Sistemas</a></nav>
    <section class="cartao secao" id="o-sis" aria-labelledby="t-o-sis">
      <h2 id="t-o-sis"><small>1</small>Sistemas</h2>
      <p class="sub">Os três sistemas de abastecimento acompanhados pelo SAR, com o dado mais recente de cada um.<span class="dica">Passe o mouse no mapa ou nos cartões para ligar um ao outro; clique para abrir o sistema.</span></p>
      <div class="os-grade">
        <div class="os-mapa" id="os-mapa"></div>
        <div class="os-cartoes">
          <article class="os-cartao" data-sis="cantareira" style="border-left-color:${COR_SIS.cantareira}">
            <div class="corpo"><h3>Sistema Cantareira</h3>
              <div class="n num">${fmt(pag.p0, 1)}<small>%</small></div>
              <div class="r">do volume útil em ${dBR(pag.ult)}, pela Resolução Conjunta ANA/DAEE nº 925/2017</div>
              <div class="l" style="margin-top:8px"><span>Em 30 dias</span><span class="num">${pag.d30 > 0 ? "+" : pag.d30 < 0 ? "−" : ""}${fmt(Math.abs(pag.d30), 1)} p.p.</span></div>
              <div class="l"><span>Mesmo dia de ${pag.anoAnt.slice(0, 4)}</span><span class="num">${fmt(pag.pAnt, 1)}%</span></div></div>
            <button type="button" class="acao" data-abrir="cantareira">Abrir</button>
          </article>
          ${["df", "rmbh"]
            .map(
              s => `<article class="os-cartao" data-sis="${s}" style="border-left-color:${COR_SIS[s]}">
            <div class="corpo"><h3>${NOME_SIS[s]}</h3><div class="r" style="margin-bottom:4px">% da capacidade de cada reservatório em ${dBR(dataSis(s))}</div>${sisDF(s)}</div>
            <button type="button" class="acao" data-abrir="${s}">Abrir</button></article>`
            )
            .join("")}
        </div>
      </div>
      <p class="nota" style="margin:12px 0 0">Distrito Federal e Paraopeba não têm volume equivalente: cada reservatório é mostrado com o seu próprio volume. O Lago Paranoá tem só a cota (sem capacidade cadastrada) e aparece como só nível.</p>
    </section>
    <p class="nota">Fontes: ${esc(OS.fontes.sabesp)}; ${esc(OS.fontes.coletor)}; ${esc(OS.fontes.resolucao)}.</p>`;

const abrir = s => {
  location.hash = PAGINA_SIS[s];
};

const cx = (pag, s) => {
  const L = pag.P.filter(q => q.s === s);
  return [L.reduce((a, q) => a + q.x, 0) / L.length, L.reduce((a, q) => a + q.y, 0) / L.length];
};

const acende = (pag, s) => {
  $$(".os-cartao").forEach(c => c.classList.toggle("acesa", c.dataset.sis === s));
  Object.entries(pag.grupos).forEach(([k, g]) => g.setAttribute("opacity", !s || k === s ? 1 : 0.35));
};

export { COORD_OS, detCan, diaEntre, entrarSis, isoMais, NOME_SIS, paginaOutros, pctCan };
