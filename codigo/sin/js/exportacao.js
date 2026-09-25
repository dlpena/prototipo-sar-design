/* Exportações padronizadas: CSV (tabelas e dados de cada gráfico), PDF das tabelas, PNG dos gráficos e do
   diagrama, com título, fonte e data de geração, e KMZ dos mapas. As bibliotecas de PDF são carregadas sob demanda. */
import { D } from "./dados_embutidos.js";
import { $, caso, COR, dBR, fint, fmt, NS, toast, UNID_MINI } from "./base.js";

function baixarArquivo(blob, nome) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nome;
  document.body.append(a);
  a.click();
  a.remove();
}

const CDN_JSPDF = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
const CDN_AUTOTABLE = "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js";
const RODAPE = "SAR · protótipo para discussão interna. Não é o sistema em produção.";
function carregarScript(src) {
  return new Promise((ok, erro) => {
    if ([...document.scripts].some(s => s.src === src)) return ok();
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => ok();
    s.onerror = () => erro(new Error(src));
    document.head.append(s);
  });
}
// o SVG clonado perde o CSS da página: as regras que importam vão embutidas
function imagemDeSVG(svg) {
  const c = svg.cloneNode(true),
    vb = svg.viewBox.baseVal;
  const w = vb && vb.width ? vb.width : svg.clientWidth,
    h = vb && vb.height ? vb.height : svg.clientHeight;
  c.setAttribute("xmlns", NS);
  c.setAttribute("width", w);
  c.setAttribute("height", h);
  // estilo calculado de cada elemento embutido no clone (fill e stroke por classe CSS se perdiam e saíam pretos)
  const PROPS = [
    "fill",
    "fill-opacity",
    "stroke",
    "stroke-width",
    "stroke-opacity",
    "stroke-dasharray",
    "stroke-linecap",
    "stroke-linejoin",
    "opacity",
    "font-size",
    "font-weight",
    "font-family",
    "text-anchor",
    "dominant-baseline",
    "paint-order",
    "display",
    "visibility"
  ];
  const orig = [svg, ...svg.querySelectorAll("*")],
    copia = [c, ...c.querySelectorAll("*")];
  orig.forEach((el, i) => {
    const cs = getComputedStyle(el),
      alvo = copia[i];
    if (!alvo || !cs) return;
    alvo.setAttribute(
      "style",
      PROPS.map(p => `${p}:${cs.getPropertyValue(p).replace(/url\("?[^")]*?(#[^")]+)"?\)/g, "url($1)")}`).join(";") +
        ";" +
        (alvo.getAttribute("style") || "")
    );
  });
  const est = document.createElementNS(NS, "style");
  est.textContent =
    "text{font-family:Arial,Helvetica,sans-serif}.eixo text{fill:#5B6B80;font-size:11.5px}.no-diag text{font-family:Arial,Helvetica,sans-serif}";
  c.prepend(est);
  const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(c));
  return new Promise((ok, erro) => {
    const im = new Image();
    im.onload = () => ok(im);
    im.onerror = () => erro(new Error("svg"));
    im.src = url;
  });
}
// legenda do PNG: a da tela é HTML e não entra no SVG, então é redesenhada aqui
// item: {r rótulo, cor, tracejado, simbolo "res"|"fio", area true}
const LARG_SIMB = it => (it.simbolo ? 20 : it.area ? 22 : it.cor ? 24 : 0);
function disporLegenda(ctx, itens, x0, xMax) {
  ctx.font = "12.5px Arial";
  const linhas = [[]];
  let x = x0;
  itens.forEach(it => {
    const sw = LARG_SIMB(it),
      w = sw + ctx.measureText(it.r).width + 20;
    if (x > x0 && x + w > xMax) {
      linhas.push([]);
      x = x0;
    }
    linhas[linhas.length - 1].push({ it, x, sw });
    x += w;
  });
  return linhas;
}
function legendaPNG(ctx, linhas, y0) {
  ctx.font = "12.5px Arial";
  ctx.textBaseline = "middle";
  linhas.forEach((linha, i) => {
    const y = y0 + i * 18;
    linha.forEach(({ it, x, sw }) => {
      if (it.simbolo === "res") {
        ctx.fillStyle = it.cor || COR.ana;
        ctx.beginPath();
        ctx.moveTo(x + 7, y - 6);
        ctx.lineTo(x + 14, y + 5);
        ctx.lineTo(x, y + 5);
        ctx.closePath();
        ctx.fill();
      } else if (it.simbolo === "fio") {
        ctx.fillStyle = it.cor || COR.azulMedio;
        ctx.beginPath();
        ctx.arc(x + 7, y, 5.6, 0, 6.2832);
        ctx.fill();
      } else if (it.area) {
        ctx.fillStyle = it.cor;
        ctx.fillRect(x, y - 5, 16, 10);
        ctx.strokeStyle = COR.branco;
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y - 5, 16, 10);
      } else if (it.cor) {
        ctx.strokeStyle = it.cor;
        ctx.lineWidth = 3;
        ctx.setLineDash(it.tracejado ? [5, 4] : []);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 18, y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.fillStyle = COR.tinta2;
      ctx.fillText(it.r, x + sw, y);
    });
  });
}
const LEG_ANOS = (ano, rot = "ano da data de referência") => [
  { r: `${ano} (${rot})`, cor: COR.ana },
  { r: String(ano - 1), cor: COR.azulMedio },
  { r: "anos anteriores", cor: COR.cinzaAnos }
];

// fonte curta do PNG, pelo módulo da página
function fontePNG() {
  const h = location.hash;
  if (h.startsWith("#outros/cantareira") || /^#outros\/ficha\/2900/.test(h))
    return "Fonte: SABESP, dados observados para a ANA; cálculos do SAR/ANA.";
  if (h.startsWith("#outros") || h.startsWith("#ne")) return "Fonte: SAR/ANA.";
  return "Fonte: SAR/ANA, com dados do ONS.";
}
const hojeBR = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};
// o texto da seção (subtítulo, sem a instrução de uso) entra no PNG e no PDF como subtítulo
function textoSecao(el) {
  const s = el && el.closest("section"),
    p = s && s.querySelector("p.sub");
  if (!p) return "";
  const c = p.cloneNode(true);
  c.querySelectorAll(".dica").forEach(d => d.remove());
  return c.textContent.replace(/\s+/g, " ").trim();
}
function tituloSecao(el) {
  const s = el && el.closest("section"),
    h = s && s.querySelector("h2");
  if (!h) return "";
  const c = h.cloneNode(true);
  c.querySelectorAll("small").forEach(d => d.remove());
  return c.textContent.replace(/\s+/g, " ").trim();
}
function quebrar(ctx, texto, larg) {
  const out = [];
  let l = "";
  texto.split(" ").forEach(w => {
    const t2 = l ? l + " " + w : w;
    if (ctx.measureText(t2).width > larg && l) {
      out.push(l);
      l = w;
    } else l = t2;
  });
  if (l) out.push(l);
  return out;
}
async function baixarPNG(svgs, nome, titulo, legenda, info = {}) {
  const lista = svgs.filter(Boolean);
  if (!lista.length) {
    toast("Nada para exportar nesta seção.");
    return;
  }
  const pagina = ($("#titulo-pag h1") || {}).textContent || "SAR";
  if (!titulo) titulo = `${pagina} · ${tituloSecao(lista[0])}`;
  const larg = lista.map(s => {
    const vb = s.viewBox.baseVal;
    return vb && vb.width ? vb.width : s.clientWidth;
  });
  const W = Math.max(...larg);
  const alt = lista.map((s, i) => {
    const vb = s.viewBox.baseVal;
    return ((vb && vb.height ? vb.height : s.clientHeight) * W) / larg[i];
  });
  const leg = (legenda || []).filter(Boolean);
  const linhasLeg = leg.length ? disporLegenda(document.createElement("canvas").getContext("2d"), leg, 14, W - 14) : [];
  const med = document.createElement("canvas").getContext("2d");
  med.font = "bold 16px Arial";
  const tit = quebrar(med, titulo, W - 28);
  med.font = "12.5px Arial";
  const sub = quebrar(med, info.sub ?? textoSecao(lista[0]), W - 28);
  med.font = "11px Arial";
  const rodTxt = quebrar(med, `${info.fonte || fontePNG()} Gerado em ${hojeBR()}. ${RODAPE}`, W - 28);
  const topo = 34 + (tit.length - 1) * 20 + sub.length * 17 + (sub.length ? 4 : 0),
    cab = topo + (linhasLeg.length ? linhasLeg.length * 18 + 6 : 2);
  const rod = 10 + rodTxt.length * 14,
    H = cab + alt.reduce((a, b) => a + b, 0) + rod,
    k = 2;
  const cv = document.createElement("canvas");
  cv.width = Math.round(W * k);
  cv.height = Math.round(H * k);
  const ctx = cv.getContext("2d");
  ctx.scale(k, k);
  ctx.fillStyle = COR.branco;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = COR.ana;
  ctx.font = "bold 16px Arial";
  ctx.textBaseline = "alphabetic";
  tit.forEach((l, i) => ctx.fillText(l, 14, 25 + i * 20));
  ctx.fillStyle = COR.tinta2;
  ctx.font = "12.5px Arial";
  sub.forEach((l, i) => ctx.fillText(l, 14, 44 + (tit.length - 1) * 20 + i * 17));
  if (linhasLeg.length) legendaPNG(ctx, linhasLeg, topo + 11);
  let y = cab;
  for (let i = 0; i < lista.length; i++) {
    const im = await imagemDeSVG(lista[i]);
    ctx.drawImage(im, 0, y, W, alt[i]);
    y += alt[i];
  }
  ctx.fillStyle = COR.apagado;
  ctx.font = "11px Arial";
  ctx.textBaseline = "alphabetic";
  rodTxt.forEach((l, i) => ctx.fillText(l, 14, H - rod + 16 + i * 14));
  cv.toBlob(b => {
    baixarArquivo(b, nome);
    toast("Imagem gerada. (Na página publicada no claude.ai o download é bloqueado; abra o arquivo local.)");
  }, "image/png");
}
const AZUL = [40, 51, 119],
  CINZA = [111, 117, 130],
  LINHA = [226, 228, 232],
  TINTA = [34, 38, 46];
/* ============================================================ padrão de exportação (19/09/2026)
   mapas: KMZ; tabelas: CSV e PDF; gráficos: PNG e CSV */
// texto com ponto e vírgula, aspas ou quebra de linha vai entre aspas (senão quebra as colunas do CSV)
const nCSV = v =>
  v == null || v === "" || (typeof v === "number" && isNaN(v))
    ? ""
    : typeof v === "number"
      ? String(Math.round(v * 10000) / 10000).replace(".", ",")
      : /[;"\r\n]/.test(String(v))
        ? `"${String(v).replace(/"/g, '""')}"`
        : String(v);
function salvarCSV(cab, linhas, nome) {
  const l = [cab.join(";")].concat(linhas.map(r => r.map(nCSV).join(";")));
  baixarArquivo(new Blob(["\uFEFF" + l.join("\r\n")], { type: "text/csv;charset=utf-8" }), nome);
  toast(
    `CSV com ${linhas.length} linhas gerado. (Na página publicada no claude.ai o download é bloqueado; abra o arquivo local.)`
  );
}
const COL_UNID = { "%": "volume_pct", "m": "cota_m", "hm³": "volume_hm3", "m³/s": "vazao_m3s", "mm": "chuva_mm" };
// cada gráfico guarda no seu contêiner o que desenhou; o CSV da seção junta os gráficos dela
const guardaCSV = (host, cab, linhas, rot) => {
  if (host) host._csv = { cab, linhas, rot };
};
function baixarCSVGrafico(hosts, nome, rotCol) {
  const H = hosts.filter(h => h && h._csv);
  if (!H.length) {
    toast("Nada para exportar nesta seção.");
    return;
  }
  if (H.length === 1 && !rotCol) {
    salvarCSV(H[0]._csv.cab, H[0]._csv.linhas, nome);
    return;
  }
  const cols = [...new Set(H.flatMap(h => h._csv.cab))];
  salvarCSV(
    [rotCol || "serie", ...cols],
    H.flatMap(h =>
      h._csv.linhas.map(r => [
        h._csv.rot || "",
        ...cols.map(c => {
          const i = h._csv.cab.indexOf(c);
          return i < 0 ? "" : r[i];
        })
      ])
    ),
    nome
  );
}

// tabela da tela em PDF, no desenho do PDF da bacia do SIN: título, subtítulo com a fonte, cabeçalho em duas linhas
// (nome e unidade), primeira coluna em negrito, números à direita, minigráficos como imagem e linha de total
async function pdfTabelaDOM(tabelas, nome, titulo, sub, pe = []) {
  try {
    await carregarScript(CDN_JSPDF);
    await carregarScript(CDN_AUTOTABLE);
  } catch {
    toast("Não foi possível carregar a biblioteca de PDF (rede bloqueada neste ambiente).");
    return;
  }
  const T = tabelas.filter(Boolean),
    t0 = T[0];
  const ths = [...t0.tHead.rows[0].cells],
    un = t0.tHead.querySelector("tr.unid");
  const mini = ths.map(th => th.classList.contains("mini-th")),
    dir = ths.map(th => th.classList.contains("r"));
  const linhas = T.flatMap(t => [...t.tBodies].flatMap(b => [...b.rows])).filter(
    tr => tr.cells.length === ths.length && !tr.hidden
  );
  const pes = T.flatMap(t => (t.tFoot ? [...t.tFoot.rows] : [])).filter(tr => tr.cells.length === ths.length);
  const imgs = {};
  for (let i = 0; i < linhas.length; i++)
    for (let j = 0; j < ths.length; j++) {
      const svg = mini[j] && linhas[i].cells[j].querySelector("svg");
      if (!svg) continue;
      const im = await imagemDeSVG(svg),
        k = 3,
        cv = document.createElement("canvas");
      cv.width = 132 * k;
      cv.height = 30 * k;
      const ctx = cv.getContext("2d");
      ctx.scale(k, k);
      ctx.drawImage(im, 0, 0, 132, 30);
      imgs[i + "_" + j] = cv.toDataURL("image/png");
    }
  const doc = new window.jspdf.jsPDF({ orientation: "landscape", unit: "pt", format: "a4", compress: true });
  const larg = doc.internal.pageSize.getWidth();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...AZUL);
  doc.text(titulo, 40, 46);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...CINZA);
  const subL = doc.splitTextToSize(`${sub} ${fontePNG()} Gerado em ${hojeBR()}.`, larg - 80);
  doc.text(subL, 40, 61);
  doc.autoTable({
    startY: 70 + subL.length * 11,
    theme: "plain",
    margin: { left: 40, right: 40 },
    rowPageBreak: "avoid",
    head: [ths.map(txtTh), un ? [...un.cells].map(c => limpa(c.textContent)) : ths.map(() => "")],
    body: linhas.map(tr => [...tr.cells].map((td, j) => (mini[j] ? "" : txtTd(td)))),
    foot: pes.map(tr => [...tr.cells].map((td, j) => (mini[j] ? "" : txtTd(td)))).concat(pe),
    showFoot: "lastPage",
    styles: {
      font: "helvetica",
      fontSize: 9.5,
      textColor: TINTA,
      cellPadding: { top: 6, right: 6, bottom: 6, left: 6 },
      valign: "middle"
    },
    headStyles: { fontStyle: "bold", textColor: AZUL },
    footStyles: { fontStyle: "bold", textColor: AZUL },
    didParseCell: d => {
      const j = d.column.index;
      d.cell.styles.halign = dir[j] ? "right" : "left";
      if (j === 0 && d.section === "body") {
        d.cell.styles.fontStyle = "bold";
        d.cell.styles.textColor = AZUL;
      }
      if (mini[j]) d.cell.styles.cellWidth = 150;
      if (d.section === "head" && d.row.index === 0)
        d.cell.styles.cellPadding = { top: 6, right: 6, bottom: 1, left: 6 };
      if (d.section === "head" && d.row.index === 1) {
        d.cell.styles.fontStyle = "normal";
        d.cell.styles.fontSize = 8;
        d.cell.styles.textColor = CINZA;
        d.cell.styles.cellPadding = { top: 0, right: 6, bottom: 5, left: 6 };
      }
    },
    didDrawCell: d => {
      const { x, y, width, height } = d.cell;
      if (d.section === "head" && d.row.index === 1) {
        doc.setDrawColor(...AZUL);
        doc.setLineWidth(1.4);
        doc.line(x, y + height, x + width, y + height);
      }
      if (d.section === "foot" && d.row.index === 0) {
        doc.setDrawColor(...AZUL);
        doc.setLineWidth(1.4);
        doc.line(x, y, x + width, y);
      }
      if (d.section !== "body") return;
      doc.setDrawColor(...LINHA);
      doc.setLineWidth(0.6);
      doc.line(x, y + height, x + width, y + height);
      const im = imgs[d.row.index + "_" + d.column.index];
      if (im) doc.addImage(im, "PNG", x + 6, y + (height - 19) / 2, Math.min(width - 12, 138), 19, undefined, "FAST");
    }
  });
  rodapePDF(doc);
  doc.save(nome);
  toast("PDF gerado. (Na página publicada no claude.ai o download é bloqueado; abra o arquivo local.)");
}

const limpa = s =>
  s
    .replace(/­/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();

const txtTh = th => {
  const c = th.cloneNode(true);
  c.querySelectorAll("select").forEach(s => s.remove());
  return limpa(c.textContent);
};

const txtTd = td =>
  limpa(
    (td.innerText || td.textContent)
      .split("\n")
      .map(s => s.trim())
      .filter(Boolean)
      .join("\n")
  );
// rodapé em todas as páginas do PDF, com a numeração
function rodapePDF(doc) {
  const n = doc.internal.getNumberOfPages(),
    larg = doc.internal.pageSize.getWidth(),
    alt = doc.internal.pageSize.getHeight();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...CINZA);
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.text(RODAPE, 40, alt - 22);
    doc.text(`Página ${i} de ${n}`, larg - 40, alt - 22, { align: "right" });
  }
}
// PDF da tabela de uma seção: título e subtítulo saem da página e da seção; a data de referência entra no título
// quando a tabela depende dela; `pe` são linhas de total que ficam fora da tabela na tela
const pdfSecao = (tabelas, nome, { data, pe } = {}) => {
  const t0 = tabelas.find(Boolean);
  return pdfTabelaDOM(
    tabelas,
    nome,
    `${($("#titulo-pag h1") || {}).textContent || "SAR"} · ${tituloSecao(t0)}${data ? " · " + dBR(data) : ""}`,
    textoSecao(t0),
    pe
  );
};

// ---- KMZ no padrão do projeto mapa-reservatorios (github.com/dlpena/mapa-reservatorios): legenda.png fixa no canto
// da tela (ScreenOverlay) e a mesma legenda na descrição do documento; ícones PNG com a forma e a cor do mapa da página.
// A legenda é a de cada mapa: {titulo, grupos:[{titulo, itens:[{r, cor, forma}]}]}; forma: circulo, triangulo, sobe,
// desce, est (losango), vazio (losango vazado: contorno na cor, miolo branco), area, linha
const xk = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const abgr = (c, a = "ff") => a + c.slice(5, 7) + c.slice(3, 5) + c.slice(1, 3);
const FORMA_KMZ = {
  triangulo: "M7 1.2 L13 12.4 L1 12.4 Z",
  sobe: ICO_NV_K("sobe"),
  desce: ICO_NV_K("desce"),
  est: ICO_NV_K("est"),
  vazio: ICO_NV_K("est")
};
function ICO_NV_K(k) {
  return {
    sobe: "M7 1.5 L12.5 11.5 L1.5 11.5 Z",
    desce: "M1.5 2.5 L12.5 2.5 L7 12.5 Z",
    est: "M7 1.2 L12.8 7 L7 12.8 L1.2 7 Z"
  }[k];
}
function desenhaForma(ctx, forma, cor, x, y, tam) {
  // (x, y) canto superior esquerdo de uma caixa tam × tam
  const s = tam / 14;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = cor;
  ctx.strokeStyle = "rgba(255,255,255,.95)";
  if (forma === "circulo") {
    ctx.beginPath();
    ctx.arc(tam / 2, tam / 2, tam / 2 - 1.2 * s, 0, 6.2832);
    ctx.lineWidth = 1.4 * s;
    ctx.fill();
    ctx.stroke();
  } else if (forma === "area") {
    ctx.fillRect(1, 2, tam - 2, tam - 4);
    ctx.strokeStyle = "#8A97A8";
    ctx.lineWidth = 1;
    ctx.strokeRect(1, 2, tam - 2, tam - 4);
  } else if (forma === "linha") {
    ctx.strokeStyle = cor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, tam / 2);
    ctx.lineTo(tam, tam / 2);
    ctx.stroke();
  } else if (forma === "vazio") {
    ctx.scale(s, s);
    const p = new Path2D(FORMA_KMZ.vazio);
    ctx.fillStyle = COR.branco;
    ctx.strokeStyle = cor;
    ctx.lineWidth = 1.6;
    ctx.fill(p);
    ctx.stroke(p);
  } else {
    ctx.scale(s, s);
    const p = new Path2D(FORMA_KMZ[forma]);
    ctx.lineWidth = 1.2;
    ctx.fill(p);
    ctx.stroke(p);
  }
  ctx.restore();
}
const blobDe = cv => new Promise(ok => cv.toBlob(ok, "image/png"));
async function iconeKMZ(forma, cor) {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 32;
  desenhaForma(cv.getContext("2d"), forma, cor, 2, 2, 28);
  return blobDe(cv);
}
async function legendaKMZ(leg) {
  const F = '"Segoe UI", Arial, sans-serif',
    pad = 12,
    lh = 19,
    e = 2,
    med = document.createElement("canvas").getContext("2d");
  med.font = "bold 13px " + F;
  let w = Math.max(
    med.measureText(leg.titulo).width,
    ...leg.grupos.map(g => (g.titulo ? med.measureText(g.titulo).width : 0))
  );
  med.font = "12px " + F;
  leg.grupos.forEach(g =>
    g.itens.forEach(it => {
      w = Math.max(w, 20 + med.measureText(it.r).width);
    })
  );
  const W = Math.ceil(w + pad * 2),
    H = pad + 18 + leg.grupos.reduce((a, g) => a + (g.titulo ? 22 : 6) + g.itens.length * lh, 0) + 4;
  const cv = document.createElement("canvas");
  cv.width = W * e;
  cv.height = H * e;
  const ctx = cv.getContext("2d");
  ctx.scale(e, e);
  ctx.fillStyle = "rgba(255,255,255,.95)";
  ctx.strokeStyle = "#999";
  ctx.beginPath();
  ctx.roundRect(0.5, 0.5, W - 1, H - 1, 8);
  ctx.fill();
  ctx.stroke();
  ctx.textBaseline = "alphabetic";
  let y = pad + 12;
  ctx.fillStyle = COR.ana;
  ctx.font = "bold 13px " + F;
  ctx.fillText(leg.titulo, pad, y);
  y += 6;
  leg.grupos.forEach(g => {
    if (g.titulo) {
      y += 20;
      ctx.fillStyle = "#111";
      ctx.font = "bold 12px " + F;
      ctx.fillText(g.titulo, pad, y);
    }
    ctx.font = "12px " + F;
    g.itens.forEach((it, i) => {
      y += i || g.titulo ? lh : lh - 2;
      desenhaForma(ctx, it.forma, it.cor, pad, y - 11, 13);
      ctx.fillStyle = "#111";
      ctx.fillText(it.r, pad + 20, y);
    });
  });
  return { blob: await blobDe(cv), w: W, h: H };
}
const legendaHTMLKMZ = leg =>
  `<b>${xk(leg.titulo)}</b>` +
  leg.grupos
    .map(
      g =>
        (g.titulo ? `<br/><b>${xk(g.titulo)}</b>` : "") +
        g.itens
          .map(
            it =>
              `<div style="margin:2px 0"><span style="display:inline-block;width:12px;height:12px;background:${it.cor};border:1px solid #888;margin-right:6px"></span>${xk(it.r)}</div>`
          )
          .join("")
    )
    .join("");
// estilos: {id: {forma, cor}} para pontos; {id: {linha, preench, opac}} para polígonos e linhas
async function montarKMZ({ arquivo, nome, descricao, legenda, estilos, corpo, n }) {
  const zip = new JSZip(),
    leg = await legendaKMZ(legenda);
  let est = "";
  for (const [id, s] of Object.entries(estilos)) {
    if (s.forma) {
      zip.file(`icone_${id}.png`, await iconeKMZ(s.forma, s.cor));
      est += `<Style id="${id}"><IconStyle><scale>${s.escala || 0.8}</scale><Icon><href>icone_${id}.png</href></Icon><hotSpot x="0.5" y="0.5" xunits="fraction" yunits="fraction"/></IconStyle><LabelStyle><scale>0</scale></LabelStyle></Style>`;
    } else
      est += `<Style id="${id}"><LineStyle><color>${abgr(s.linha || COR.ana)}</color><width>${s.largura || 1.5}</width></LineStyle><PolyStyle>${s.preench ? `<color>${abgr(s.preench, s.opac || "b3")}</color>` : "<fill>0</fill>"}</PolyStyle></Style>`;
  }
  const overlay =
    `<ScreenOverlay><name>Legenda</name><Icon><href>legenda.png</href></Icon><overlayXY x="0" y="0" xunits="fraction" yunits="fraction"/>` +
    `<screenXY x="0.01" y="0.02" xunits="fraction" yunits="fraction"/><size x="${leg.w}" y="${leg.h}" xunits="pixels" yunits="pixels"/></ScreenOverlay>`;
  const kml =
    `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${xk(nome)}</name>` +
    `<description><![CDATA[${descricao}<br/><br/>${legendaHTMLKMZ(legenda)}<br/><br/>${fontePNG()} Gerado em ${hojeBR()}.]]></description>${est}${overlay}${corpo}</Document></kml>`;
  zip.file("doc.kml", kml);
  zip.file("legenda.png", leg.blob);
  baixarArquivo(await zip.generateAsync({ type: "blob", mimeType: "application/vnd.google-earth.kmz" }), arquivo);
  toast(
    `KMZ${n ? ` com ${n} elementos` : ""} gerado, com a legenda. (Na página publicada no claude.ai o download é bloqueado; abra o arquivo local.)`
  );
}
const poligonoKML = aneis =>
  `<MultiGeometry>${aneis.map(a => `<Polygon><outerBoundaryIs><LinearRing><coordinates>${a.map(p => `${p[0]},${p[1]},0`).join(" ")}</coordinates></LinearRing></outerBoundaryIs></Polygon>`).join("")}</MultiGeometry>`;
const pontoKML = (nome, estilo, desc, lon, lat) =>
  `<Placemark><name>${xk(nome)}</name><styleUrl>#${estilo}</styleUrl><description><![CDATA[${desc}]]></description><Point><coordinates>${lon},${lat},0</coordinates></Point></Placemark>`;
const pastaKML = (nome, conteudo) => (conteudo ? `<Folder><name>${xk(nome)}</name>${conteudo}</Folder>` : "");
// legendas dos mapas do SIN
const LEG_USINAS = extra => ({
  titulo: "Usinas do SIN",
  grupos: [
    {
      itens: [
        { r: "Usina com reservatório: volume útil (%)", cor: COR.ana, forma: "triangulo" },
        { r: "Usina a fio d'água: nível (m)", cor: COR.azulMedio, forma: "circulo" },
        ...(extra || [])
      ]
    }
  ]
});
const EST_USINAS = {
  res: { forma: "triangulo", cor: COR.ana, escala: 0.9 },
  fio: { forma: "circulo", cor: COR.azulMedio, escala: 0.75 }
};

function simboloPDF(doc, tipo, cx, cy) {
  if (tipo === "fio") {
    doc.setFillColor(74, 127, 176);
    doc.circle(cx, cy, 3.6, "F");
  } else {
    doc.setFillColor(...AZUL);
    doc.triangle(cx, cy - 4.4, cx + 4.6, cy + 3.4, cx - 4.6, cy + 3.4, "F");
  }
}
// PNG de cada minigráfico que está na tela, para entrar na célula do PDF
async function minisPNG(lista) {
  const out = {};
  for (const r of lista) {
    const svg = $(`[data-mini="${CSS.escape(r.nome)}"] svg`);
    if (!svg) continue;
    const im = await imagemDeSVG(svg),
      k = 3;
    const cv = document.createElement("canvas");
    cv.width = 132 * k;
    cv.height = 30 * k;
    const ctx = cv.getContext("2d");
    ctx.scale(k, k);
    ctx.drawImage(im, 0, 0, 132, 30);
    out[r.nome] = cv.toDataURL("image/png");
  }
  return out;
}
// tabela da bacia em PDF com o mesmo desenho da tela (sem o seletor: a variável do minigráfico entra no título da coluna)
async function pdfTabelaBacia(lista, kMini, rotMini) {
  try {
    await carregarScript(CDN_JSPDF);
    await carregarScript(CDN_AUTOTABLE);
  } catch {
    toast("Não foi possível carregar a biblioteca de PDF (rede bloqueada neste ambiente).");
    return;
  }
  const dia = lista[0].dia,
    minis = await minisPNG(lista);
  const doc = new window.jspdf.jsPDF({ orientation: "landscape", unit: "pt", format: "a4", compress: true });
  const larg = doc.internal.pageSize.getWidth();
  const nRes = lista.filter(r => r.tipo !== "fio").length,
    nFio = lista.length - nRes;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...AZUL);
  doc.text(`Bacia do Grande · usinas em ${dBR(dia)}`, 40, 46);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...CINZA);
  doc.text(
    doc.splitTextToSize(
      `Base diária, de montante para jusante · ${nRes} usinas com reservatório e ${nFio} a fio d'água · minigráfico: 30 dias de ${rotMini} até ${dBR(dia)}.` +
        ` Fontes: ${D.fontes.medicoes}; ${D.fontes.sar0}. Gerado em ${hojeBR()}.`,
      larg - 80
    ),
    40,
    61
  );
  doc.autoTable({
    startY: 88,
    theme: "plain",
    margin: { left: 40, right: 40 },
    rowPageBreak: "avoid",
    head: [
      [
        "Usina",
        "Afluente",
        "Defluente",
        "Turbinada",
        "Vertida",
        "Nível",
        "Volume útil",
        `Últimos 30 dias — ${rotMini}`
      ],
      ["", "m³/s", "m³/s", "m³/s", "m³/s", "m", "%", UNID_MINI[kMini]]
    ],
    body: lista.map(r => [
      caso(r.nome),
      fint(r.afl),
      fint(r.defl),
      fint(r.turb),
      fint(r.vert),
      fmt(r.cota, 2),
      r.tipo === "fio" ? "–" : fmt(r.vu, 1),
      ""
    ]),
    styles: {
      font: "helvetica",
      fontSize: 9.5,
      textColor: TINTA,
      cellPadding: { top: 6, right: 6, bottom: 6, left: 6 },
      valign: "middle"
    },
    headStyles: { fontStyle: "bold", textColor: AZUL, halign: "right" },
    columnStyles: {
      0: {
        halign: "left",
        fontStyle: "bold",
        textColor: AZUL,
        cellWidth: 132,
        cellPadding: { top: 6, right: 6, bottom: 6, left: 24 }
      },
      1: { halign: "right", cellWidth: 74 },
      2: { halign: "right", cellWidth: 74 },
      3: { halign: "right", cellWidth: 74 },
      4: { halign: "right", cellWidth: 74 },
      5: { halign: "right", cellWidth: 74 },
      6: { halign: "right", cellWidth: 76 },
      7: { halign: "left" }
    },
    didParseCell: d => {
      if (d.column.index === 7) d.cell.styles.halign = "left";
      if (d.section === "head" && d.column.index === 0) d.cell.styles.halign = "left";
      const pl = d.column.index === 0 ? 24 : 6;
      if (d.section === "head" && d.row.index === 0)
        d.cell.styles.cellPadding = { top: 6, right: 6, bottom: 1, left: pl };
      if (d.section === "head" && d.row.index === 1) {
        d.cell.styles.fontStyle = "normal";
        d.cell.styles.fontSize = 8;
        d.cell.styles.textColor = CINZA;
        d.cell.styles.cellPadding = { top: 0, right: 6, bottom: 5, left: pl };
      }
    },
    didDrawCell: d => {
      const { x, y, width, height } = d.cell;
      if (d.section === "head" && d.row.index === 1) {
        doc.setDrawColor(...AZUL);
        doc.setLineWidth(1.4);
        doc.line(x, y + height, x + width, y + height);
      }
      if (d.section !== "body") return;
      doc.setDrawColor(...LINHA);
      doc.setLineWidth(0.6);
      doc.line(x, y + height, x + width, y + height);
      const r = lista[d.row.index];
      if (!r) return;
      if (d.column.index === 0) simboloPDF(doc, r.tipo, x + 13, y + height / 2);
      if (d.column.index === 7 && minis[r.nome]) {
        const w = Math.min(width - 14, 152),
          h = 19;
        doc.addImage(minis[r.nome], "PNG", x + 7, y + (height - h) / 2, w, h, r.nome, "FAST");
      }
    }
  });
  rodapePDF(doc);
  doc.save(`sar_grande_${dia}.pdf`);
  toast("PDF gerado. (Na página publicada no claude.ai o download é bloqueado; abra o arquivo local.)");
}

export {
  AZUL,
  baixarArquivo,
  baixarCSVGrafico,
  baixarPNG,
  carregarScript,
  CDN_AUTOTABLE,
  CDN_JSPDF,
  CINZA,
  COL_UNID,
  EST_USINAS,
  guardaCSV,
  hojeBR,
  LEG_ANOS,
  LEG_USINAS,
  LINHA,
  montarKMZ,
  nCSV,
  pastaKML,
  pdfSecao,
  pdfTabelaBacia,
  poligonoKML,
  pontoKML,
  rodapePDF,
  salvarCSV,
  TINTA,
  xk
};
