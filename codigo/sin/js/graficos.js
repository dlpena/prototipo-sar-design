/* Componentes de gráfico, iguais em todas as páginas: linhas (série no período), calendário (anos no mesmo
   calendário), barras por ano (mesmo dia), mensal contra a média de longo termo, medições por ano, botões de ano, balão
   e o texto recolhível "Como ler este gráfico". Altura por família (alturaGraf); cores do objeto COR. */
import { COR, dBR, fData, fHora, fint, fmt, MESES, svgEl, toast } from "./base.js";
import { COL_UNID, guardaCSV } from "./exportacao.js";

// fundos claros escolhidos para se distinguirem entre si (diferença OKLab de 8,8 a 11,5 entre faixas vizinhas; com a cor
// da faixa a 16% de opacidade ficava entre 1,8 e 4,5, e Atenção, Alerta, Restrição e Especial se confundiam)
const tintaFaixa = f => f.fundo || f.cor;

const VAO_MAX = 40; // vão maior que isso não é ligado no gráfico (série do NE é irregular)

const MAX_ANOS = 10; // limite pedido pelo Diego em 17/09/2026; acima disso a leitura do gráfico se perde

// botão de ano: anos terminados antes da vigência da resolução ficam com contorno tracejado e o motivo no título
function chipAno(a, on, RA) {
  const antes = RA && RA.desde && `${a}-12-31` < RA.desde;
  return `<button type="button" class="chip-ano${on ? " on" : ""}${antes ? " antes" : ""}" data-a="${a}"${antes ? ` title="Anterior à vigência da resolução (desde ${dBR(RA.desde)}): as faixas não se aplicavam"` : ""}>${a}</button>`;
}

/* botões de ano dos gráficos "ao longo do ano": padrão, os cinco anos até o da data de referência, refeitos quando a
   data muda de ano; até MAX_ANOS ao mesmo tempo e ao menos um. estado = {sel, anoRef} guardado pela página.
   Devolve os anos marcados, em ordem crescente. */
function botoesAnos(caixa, nota, todos, estado, anoRef, aoMudar, RA) {
  const vis = todos.filter(a => a <= anoRef);
  if (!estado.sel || estado.anoRef !== anoRef) {
    estado.sel = new Set(vis.slice(-5));
    estado.anoRef = anoRef;
  }
  caixa.innerHTML = vis.map(a => chipAno(a, estado.sel.has(a), RA)).join("");
  const cheio = estado.sel.size >= MAX_ANOS;
  caixa.querySelectorAll(".chip-ano").forEach(b => {
    const a = +b.dataset.a;
    b.disabled = !estado.sel.has(a) && cheio;
    b.onclick = () => {
      if (estado.sel.has(a)) {
        if (estado.sel.size === 1) {
          toast("Deixe ao menos um ano selecionado.");
          return;
        }
        estado.sel.delete(a);
      } else {
        if (estado.sel.size >= MAX_ANOS) {
          toast(`Até ${MAX_ANOS} anos ao mesmo tempo: desmarque um para incluir outro.`);
          return;
        }
        estado.sel.add(a);
      }
      aoMudar();
    };
  });
  nota.textContent = `${estado.sel.size} de ${MAX_ANOS}`;
  return [...estado.sel].sort((a, b) => a - b);
}

/* altura padrão dos gráficos por família (Diego, 22/09/2026: sem aparência de achatado, igual em todas as páginas)
   principal: ao longo do ano / ano contra anos anteriores e o gráfico principal da série no período;
   barras: mesmo dia em outros anos e histórico do monitoramento;
   apoio: gráfico abaixo do principal, no mesmo eixo de tempo, e gráficos repetidos por reservatório (DF e RMBH).
   Segundo valor: celular (caixa com menos de 600 px). Um número passado no lugar da família vale como altura fixa. */
function alturaGraf(a, W) {
  const ALT = { principal: [380, 280], barras: [320, 260], apoio: [300, 240] };
  return typeof a === "number" ? a : ALT[a][W < 600 ? 1 : 0];
}
/* "Como ler este gráfico": texto recolhido, sempre o último elemento da seção do gráfico (Diego, 22/09/2026) */
function comoLer(...ps) {
  return `<details class="saiba como-ler"><summary>Como ler este gráfico</summary><div class="saiba-corpo">${ps
    .filter(Boolean)
    .map(p => `<p>${p}</p>`)
    .join("")}</div></details>`;
}
// parágrafos comuns, iguais entre módulos
function ler(k, x) {
  switch (k) {
    case "anos":
      return `<b>Anos.</b> Cada ano ocupa o mesmo calendário, de janeiro a dezembro. O ano da data de referência aparece em azul-escuro, com traço mais espesso; o anterior, em azul-médio; os demais, em cinza, com o ano escrito no fim de cada curva. A curva do ano da data de referência termina nela, marcada pela linha tracejada vermelha.`;
    case "cinco":
      return `<b>Período.</b> O gráfico mostra sempre os cinco anos até o da data de referência.`;
    case "selecao":
      return `<b>Seleção dos anos.</b> Ao abrir a página, e sempre que a data de referência passa para outro ano, ficam selecionados os cinco anos até o dela; os botões incluem ou retiram anos, até ${MAX_ANOS} ao mesmo tempo.`;
    case "cursor":
      return `<b>Valores.</b> Com o cursor sobre o gráfico, o balão mostra o valor do mesmo dia em cada ano.`;
    case "faixas":
      return `<b>Faixas de operação.</b> ${x} O botão do ano encerrado antes do início da vigência tem contorno tracejado.`;
    case "leituras":
      return `<b>Leituras.</b> A curva liga as leituras nas datas em que foram feitas; intervalo de mais de ${VAO_MAX} dias sem leitura interrompe a curva.`;
    case "dia":
      return `<b>Barras.</b> Cada barra é um ano, com o valor no mesmo dia e mês da data de referência; a do ano da data de referência aparece em azul-escuro, e a do ano anterior, em azul-médio. O valor está escrito junto de cada barra, quando há espaço, e aparece no balão com o cursor; o ano sem dado nessa data fica sem barra.`;
    case "escala":
      return `<b>Escala.</b> No volume em %, o eixo vertical vai de 0 a 100%; nas demais variáveis, não começa em zero, para que as diferenças entre os anos fiquem visíveis.`;
    case "mensal":
      return `<b>Barras e linha.</b> Cada barra é um mês, nos 12 meses até a data de referência; a linha com marcadores é a média de longo termo (MLT) de cada mês. O mês incompleto (o da data de referência, ou um mês com falha na série) aparece em azul-claro, com o número de dias com dado escrito sobre a barra, e deve ser comparado com cuidado com a MLT, que é do mês inteiro. Com o cursor sobre um mês, ele fica marcado no eixo, e os valores aparecem em etiquetas junto da barra e dos pontos.`;
  }
}

// rótulos de ano nas pontas das linhas: deslocados quando colidem, com fio fino ligando o rótulo ao fim da linha
function rotulosPonta(svg, fins, cor, destaque, baixo) {
  const passo = 14;
  fins.sort((a, b) => a.y - b.y);
  let ant = -Infinity;
  fins.forEach(f => {
    f.ly = Math.max(f.y, ant + passo);
    ant = f.ly;
  });
  const excesso = fins.length ? fins[fins.length - 1].ly - baixo : 0;
  if (excesso > 0) fins.forEach(f => (f.ly -= excesso));
  fins.forEach(f => {
    if (Math.abs(f.ly - f.y) > 1.5)
      svg.append(
        svgEl("path", {
          d: `M${(f.x + 2).toFixed(1)} ${f.y.toFixed(1)} L${(f.x + 8).toFixed(1)} ${f.ly.toFixed(1)}`,
          stroke: cor(f.a),
          "stroke-width": 1,
          fill: "none",
          opacity: 0.9
        })
      );
    if (f.a === destaque)
      svg.append(svgEl("circle", { cx: f.x, cy: f.y, r: 5, fill: COR.ana, stroke: COR.branco, "stroke-width": 2 }));
    const tx = svgEl("text", {
      x: f.x + 11,
      y: f.ly + 4,
      fill: f.a === destaque ? COR.ana : COR.tinta2,
      "font-size": 12,
      "font-weight": f.a === destaque ? 700 : 400,
      "font-family": "Arial"
    });
    tx.textContent = f.a;
    svg.append(tx);
  });
}

function niceStep(bruto) {
  const p = Math.pow(10, Math.floor(Math.log10(bruto))),
    f = bruto / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
}

// eixos de tempo: marcas "bonitas" conforme o intervalo
function marcasTempo(t0, t1) {
  const span = t1 - t0,
    d = 864e5,
    out = [];
  const push = (t, txt) => {
    if (t >= t0 && t <= t1) out.push({ t, txt });
  };
  if (span <= 3 * d) {
    for (let t = Math.ceil(t0 / (6 * 36e5)) * 6 * 36e5; t <= t1; t += 6 * 36e5) {
      const h = new Date(t).getUTCHours();
      push(t, h === 0 ? fData(t).slice(0, 5) : `${h}h`);
    }
  } else if (span <= 45 * d) {
    const passo = span <= 12 * d ? 1 : span <= 25 * d ? 2 : 5;
    for (let t = Math.ceil(t0 / d) * d; t <= t1; t += passo * d) push(t, fData(t).slice(0, 5));
  } else if (span <= 400 * d) {
    const dt = new Date(t0);
    dt.setUTCDate(1);
    dt.setUTCHours(0, 0, 0, 0);
    for (let t = dt.getTime(); t <= t1;) {
      const x = new Date(t);
      push(t, `${MESES[x.getUTCMonth()]}${x.getUTCMonth() === 0 || out.length === 0 ? " " + x.getUTCFullYear() : ""}`);
      x.setUTCMonth(x.getUTCMonth() + 1);
      t = x.getTime();
    }
  } else {
    const a0 = new Date(t0).getUTCFullYear(),
      a1 = new Date(t1).getUTCFullYear(),
      passo = a1 - a0 > 14 ? 2 : 1;
    for (let a = a0; a <= a1; a += passo) push(Date.UTC(a, 0, 1), String(a));
  }
  return out;
}

// linhas de referência horizontais (Diego, 25/09/2026: capacidade no volume em hm³, cota máxima na cota): entram na
// escala e são desenhadas tracejadas, com o nome e o valor sobre a linha, à direita. refs: [{ v, rot }]; v nulo não desenha
const refsVals = refs => (refs || []).map(r => r.v).filter(v => v != null);
function desenhaRefs(svg, Y, x0, x1, refs, dec, unidade) {
  (refs || []).forEach(r => {
    if (r.v == null) return;
    const y = Y(r.v);
    svg.append(
      svgEl("line", {
        x1: x0,
        x2: x1,
        y1: y,
        y2: y,
        stroke: COR.tinta2,
        "stroke-width": 1.4,
        "stroke-dasharray": "8 4"
      })
    );
    const tx = svgEl("text", {
      x: x1 - 4,
      y: y - 5,
      "text-anchor": "end",
      "font-size": 12,
      fill: COR.tinta2,
      stroke: COR.branco,
      "stroke-width": 3,
      "paint-order": "stroke"
    });
    tx.textContent = `${r.rot}: ${fmt(r.v, dec ?? 1)}${unidade ? " " + unidade : ""}`;
    svg.append(tx);
  });
}

function graficoLinhas(host, S, series, o) {
  const graf = { S, series, o }; // estado do gráfico, passado às funções abaixo

  host.innerHTML = "";
  if (!graf.S.length || !graf.series.length) {
    host.innerHTML = `<p class="nota" style="padding:14px 0">${graf.series.length ? "Nenhum registro no período." : "Marque ao menos uma vazão."}</p>`;
    return;
  }
  graf.W = Math.max(300, host.clientWidth);
  const H = alturaGraf(graf.o.altura || "principal", graf.W);
  const m = { l: 62, r: 16, t: 36, b: 24 };
  const vals = graf.series.flatMap(s => graf.S.map(p => p[s.k]).filter(v => v != null));
  if (!vals.length) {
    host.innerHTML = `<p class="nota" style="padding:14px 0">Sem dados de ${graf.series.map(s => s.r.toLowerCase()).join(", ")} no período.</p>`;
    return;
  }
  const vr = vals.concat(refsVals(graf.o.refs));
  let lo = Math.min(...vr),
    hi = Math.max(...vr);
  if (hi === lo) {
    hi += 1;
    lo -= 1;
  }
  const pad = (hi - lo) * 0.06;
  lo -= pad;
  hi += pad;
  if (graf.o.unidade === "m³/s" && Math.min(...vals) >= 0 && lo < 0) lo = 0;
  if (graf.o.unidade === "m³/s" && lo > 0 && lo < (hi - lo) * 0.3) lo = 0;
  if (graf.series.length === 1 && graf.series[0].k === "vu") {
    lo = 0;
    hi = Math.max(100, Math.max(...vals));
  } // volume útil: escala fixa de 0 a 100%
  if (graf.o.escala) {
    lo = graf.o.escala[0];
    hi = Math.max(graf.o.escala[1], Math.max(...vr));
  } // escala pedida (volume %, hm³)
  const t0 = graf.o.t0 ?? graf.S[0].t,
    t1 = graf.o.t1 ?? graf.S[graf.S.length - 1].t; // período pedido, não só o dos dados
  graf.X = t => m.l + ((t - t0) / (t1 - t0 || 1)) * (graf.W - m.l - m.r);
  graf.Y = v => m.t + ((hi - v) / (hi - lo)) * (H - m.t - m.b);
  graf.svg = svgEl("svg", { viewBox: `0 0 ${graf.W} ${H}`, role: "img", "aria-label": graf.o.rotulo });
  if (graf.o.fundo) graf.o.fundo(graf.svg, graf.X, graf.Y, { lo, hi, m, W: graf.W, H, t0, t1 }); // faixas de referência atrás da grade e das linhas
  const eixo = svgEl("g", { class: "eixo" });
  const nY = 5,
    passoY = niceStep((hi - lo) / nY);
  for (let v = Math.ceil(lo / passoY) * passoY; v <= hi; v += passoY) {
    eixo.append(svgEl("line", { x1: m.l, x2: graf.W - m.r, y1: graf.Y(v), y2: graf.Y(v), stroke: COR.linha }));
    const tx = svgEl("text", { x: m.l - 8, y: graf.Y(v) + 4, "text-anchor": "end" });
    tx.textContent = fmt(Math.abs(v) < 1e-9 ? 0 : v, passoY < 1 ? 2 : 0);
    eixo.append(tx);
  }
  marcasTempo(t0, t1).forEach(mk => {
    eixo.append(
      svgEl("line", { x1: graf.X(mk.t), x2: graf.X(mk.t), y1: H - m.b, y2: H - m.b + 4, stroke: COR.linhaForte })
    );
    const tx = svgEl("text", { x: graf.X(mk.t), y: H - 7, "text-anchor": "middle" });
    tx.textContent = mk.txt;
    eixo.append(tx);
  });
  const rot = svgEl("text", {
    x: m.l,
    y: 16,
    "font-size": 13.5,
    fill: COR.ana,
    "font-weight": 700,
    "font-family": "Arial"
  });
  rot.textContent = graf.o.rotulo;
  eixo.append(rot);
  graf.svg.append(eixo);
  graf.series.forEach(s => {
    let d = "",
      pen = false;
    graf.S.forEach(p => {
      const v = p[s.k];
      if (v == null) {
        pen = false;
        return;
      }
      d += (pen ? "L" : "M") + graf.X(p.t).toFixed(1) + " " + graf.Y(v).toFixed(1);
      pen = true;
    });
    graf.svg.append(
      svgEl("path", {
        d,
        fill: "none",
        stroke: s.cor,
        "stroke-width": graf.series.length === 1 ? 2 : 1.6,
        "stroke-linejoin": "round",
        "stroke-dasharray": s.tracejado ? "5 4" : "0"
      })
    );
  });
  desenhaRefs(graf.svg, graf.Y, m.l, graf.W - m.r, graf.o.refs, graf.o.dec, graf.o.unidade);
  if (graf.o.depois) graf.o.depois(graf.svg, graf.X, graf.Y, { lo, hi, m, W: graf.W, H });
  graf.cruz = svgEl("line", { y1: m.t, y2: H - m.b, stroke: COR.linhaForte, visibility: "hidden" });
  graf.svg.append(graf.cruz);
  graf.pontos = graf.series.map(s =>
    svgEl("circle", { r: 3.5, fill: s.cor, stroke: COR.branco, "stroke-width": 1.5, visibility: "hidden" })
  );
  graf.pontos.forEach(c => graf.svg.append(c));
  const alvo = svgEl("rect", { x: m.l, y: 0, width: graf.W - m.l - m.r, height: H, fill: "transparent" });
  graf.svg.append(alvo);
  host.append(graf.svg);
  graf.tip = balao(host);
  graf.o.sync.cbs = graf.o.sync.cbs || [];
  graf.o.sync.cbs.push({ mostrar: (...a) => mostrar(graf, ...a), esconder: (...a) => esconder(graf, ...a) });
  alvo.addEventListener("pointermove", ev => {
    const r = graf.svg.getBoundingClientRect();
    const t = t0 + ((((ev.clientX - r.left) * graf.W) / r.width - m.l) / (graf.W - m.l - m.r)) * (t1 - t0);
    const i = idxDe(graf, Math.max(t0, Math.min(t1, t)));
    graf.o.sync.cbs.forEach(c => c.mostrar(i));
  });
  alvo.addEventListener("pointerleave", () => graf.o.sync.cbs.forEach(c => c.esconder()));
}

const mostrar = (graf, i) => {
  const p = graf.S[i];
  if (!p) {
    esconder(graf);
    return;
  }
  graf.cruz.setAttribute("x1", graf.X(p.t));
  graf.cruz.setAttribute("x2", graf.X(p.t));
  graf.cruz.setAttribute("visibility", "visible");
  graf.series.forEach((s, k) => {
    const v = p[s.k];
    if (v == null) {
      graf.pontos[k].setAttribute("visibility", "hidden");
      return;
    }
    graf.pontos[k].setAttribute("cx", graf.X(p.t));
    graf.pontos[k].setAttribute("cy", graf.Y(v));
    graf.pontos[k].setAttribute("visibility", "visible");
  });
  graf.tip.innerHTML =
    `<b>${graf.o.base === "dia" ? fData(p.t) : fHora(p.t)}</b>` +
    graf.series
      .map(
        s =>
          `<div class="l"><span><i style="border-color:${s.cor}"></i>${s.r}</span><span class="num">${fmt(p[s.k], s.dec)} ${s.u}</span></div>`
      )
      .join("");
  graf.tip.hidden = false;
  posicionaBalao(graf.tip, graf.svg, graf.X(p.t), graf.W);
};

const esconder = graf => {
  graf.cruz.setAttribute("visibility", "hidden");
  graf.pontos.forEach(c => c.setAttribute("visibility", "hidden"));
  graf.tip.hidden = true;
};

const idxDe = (graf, t) => {
  let a = 0,
    b = graf.S.length - 1;
  while (a < b) {
    const k = (a + b) >> 1;
    if (graf.S[k].t < t) a = k + 1;
    else b = k;
  }
  return a > 0 && Math.abs(graf.S[a - 1].t - t) < Math.abs(graf.S[a].t - t) ? a - 1 : a;
};

// série {iso: valor} sobreposta por ano no mesmo calendário (agregados do NE e Cantareira)
// Os pontos de um mesmo ano são ligados enquanto o vão couber em o.maxVao dias; o.quebras (lista de datas) interrompe a
// linha antes do ponto dessa data (NE: o conjunto de reservatórios medidos mudou demais em relação ao ponto anterior).
// o.csvExtra = {cols, f: iso => [valores]}: colunas a mais no CSV.
function graficoCalendario(host, pontos, o) {
  const graf = { o, host, pontos }; // estado do gráfico, passado às funções abaixo

  serieCalendario(graf);
  graf.host.innerHTML = "";
  graf.W = Math.max(300, graf.host.clientWidth);
  graf.H = alturaGraf(graf.o.altura || "principal", graf.W);
  graf.m = { l: 52, r: 56, t: 36, b: 26 };
  graf.vals = graf.anos.flatMap(a => graf.serie[a].filter(v => v != null));
  if (!graf.vals.length) {
    graf.host.innerHTML = '<p class="nota" style="padding:14px 0">Sem série no período.</p>';
    return;
  }
  escalaCalendario(graf);
  graf.svg = svgEl("svg", { viewBox: `0 0 ${graf.W} ${graf.H}`, role: "img", "aria-label": graf.o.rotulo });
  fundoCalendario(graf);
  eixosCalendario(graf); // limites das faixas por cima da grade
  linhasCalendario(graf);
  curvasCalendario(graf);
  cursorCalendario(graf);
}

// série de cada ano no mesmo calendário (365 dias), com as quebras, e CSV do gráfico
function serieCalendario(graf) {
  graf.anos = graf.o.anos.slice().sort();
  graf.maxVao = graf.o.maxVao || 40;
  graf.tol = graf.o.tol || 8;
  graf.serie = {};
  graf.quebra = {};
  graf.anos.forEach(a => (graf.serie[a] = Array(365).fill(null)));
  Object.entries(graf.pontos).forEach(([iso, v]) => {
    const a = +iso.slice(0, 4);
    if (graf.serie[a] && iso.slice(5) !== "02-29" && v != null) graf.serie[a][idx(iso)] = v;
  });
  (graf.o.quebras || []).forEach(iso =>
    (graf.quebra[+iso.slice(0, 4)] = graf.quebra[+iso.slice(0, 4)] || new Set()).add(idx(iso))
  );
  const extra = graf.o.csvExtra || { cols: [], f: () => [] };
  guardaCSV(
    graf.host,
    ["data", graf.o.colCSV || COL_UNID[graf.o.unidade] || "valor", ...extra.cols],
    Object.keys(graf.pontos)
      .filter(iso => graf.anos.includes(+iso.slice(0, 4)) && graf.pontos[iso] != null)
      .sort()
      .map(iso => [dBR(iso), graf.pontos[iso], ...extra.f(iso)]),
    graf.o.rotCSV
  );
}

// escala: valores e linhas de referência (0 a 100% no percentual) e os 365 dias
function escalaCalendario(graf) {
  const vr = graf.vals.concat(refsVals(graf.o.refs));
  graf.lo = Math.min(...vr);
  graf.hi = Math.max(...vr);
  if (graf.o.pct) {
    graf.lo = Math.min(0, Math.floor(graf.lo / 10) * 10);
    graf.hi = Math.max(100, graf.hi);
  } else {
    const p = (graf.hi - graf.lo) * 0.06 || 1;
    graf.lo -= p;
    graf.hi += p;
  } // % abaixo de zero (Cantareira na reserva técnica, 2014-2015) abre o eixo
  graf.X = i => graf.m.l + (i * (graf.W - graf.m.l - graf.m.r)) / 364;
  graf.Y = v => graf.m.t + ((graf.hi - v) / (graf.hi - graf.lo)) * (graf.H - graf.m.t - graf.m.b);
}

// faixas de referência ao fundo, fixas ou mês a mês
function fundoCalendario(graf) {
  (graf.o.faixas || []).forEach((f, k) => {
    // faixas de referência ao fundo (ex.: faixas de operação do Cantareira)
    const y0 = graf.Y(Math.min(graf.hi, f.ate)),
      y1 = graf.Y(Math.max(graf.lo, f.de));
    graf.svg.append(
      svgEl("rect", {
        x: graf.m.l,
        y: y0,
        width: graf.W - graf.m.l - graf.m.r,
        height: y1 - y0,
        fill: f.cor ? tintaFaixa(f) : k % 2 ? COR.branco : COR.gelo
      })
    );
    if (!f.cor) f._t = { x: graf.m.l + 6, y: (y0 + y1) / 2 + 4, rot: f.rot }; // sem cor: rótulo no gráfico, depois das curvas, com halo
    if (f.de > graf.lo)
      (graf.o._limites = graf.o._limites || []).push(
        svgEl("line", {
          x1: graf.m.l,
          x2: graf.W - graf.m.r,
          y1: y1,
          y2: y1,
          stroke: f.cor || COR.linhaForte,
          "stroke-width": 1,
          "stroke-dasharray": "5 4",
          opacity: 0.8
        })
      );
  });
  // faixas que mudam com o mês (fundoMes(q) devolve as faixas do mês q, de 0 a 11): fundo e limites mês a mês
  if (graf.o.fundoMes)
    for (let q = 0; q < 12; q++) {
      const i0 = idx(`2025-${String(q + 1).padStart(2, "0")}-01`),
        i1 = q === 11 ? 364 : idx(`2025-${String(q + 2).padStart(2, "0")}-01`);
      graf.o.fundoMes(q).forEach(f => {
        const y0 = graf.Y(Math.min(graf.hi, f.ate)),
          y1 = graf.Y(Math.max(graf.lo, f.de));
        graf.svg.append(
          svgEl("rect", {
            x: graf.X(i0),
            y: y0,
            width: graf.X(i1) - graf.X(i0) + 0.6,
            height: y1 - y0,
            fill: tintaFaixa(f)
          })
        );
        if (f.de > graf.lo)
          (graf.o._limites = graf.o._limites || []).push(
            svgEl("line", {
              x1: graf.X(i0),
              x2: graf.X(i1),
              y1: y1,
              y2: y1,
              stroke: f.cor,
              "stroke-width": 1,
              "stroke-dasharray": "5 4",
              opacity: 0.8
            })
          );
      });
    }
}

// grade, valores do eixo, meses, título e limites das faixas por cima da grade
function eixosCalendario(graf) {
  const eixo = svgEl("g", { class: "eixo" }),
    passoY = niceStep((graf.hi - graf.lo) / 5);
  for (let v = Math.ceil(graf.lo / passoY) * passoY; v <= graf.hi; v += passoY) {
    eixo.append(
      svgEl("line", { x1: graf.m.l, x2: graf.W - graf.m.r, y1: graf.Y(v), y2: graf.Y(v), stroke: COR.linha })
    );
    const tx = svgEl("text", { x: graf.m.l - 8, y: graf.Y(v) + 4, "text-anchor": "end" });
    tx.textContent = fmt(Math.abs(v) < 1e-9 ? 0 : v, passoY < 1 ? 2 : 0);
    eixo.append(tx);
  }
  MESES.forEach((mm, q) => {
    const tx = svgEl("text", {
      x: graf.X(idx(`2025-${String(q + 1).padStart(2, "0")}-15`)),
      y: graf.H - 8,
      "text-anchor": "middle"
    });
    tx.textContent = graf.W < 480 && q % 2 ? "" : mm;
    eixo.append(tx);
  });
  const rot = svgEl("text", {
    x: graf.m.l,
    y: 16,
    "font-size": 13.5,
    fill: COR.ana,
    "font-weight": 700,
    "font-family": "Arial"
  });
  rot.textContent = graf.o.rotulo;
  eixo.append(rot);
  graf.svg.append(eixo);
  (graf.o._limites || []).forEach(l => graf.svg.append(l));
  graf.o._limites = null;
}

// limites horizontais, linhas de referência e linha da data de referência
function linhasCalendario(graf) {
  (graf.o.linhas || []).forEach(l => {
    // limites horizontais (ex.: faixas de operação do Cantareira)
    graf.svg.append(
      svgEl("line", {
        x1: graf.m.l,
        x2: graf.W - graf.m.r,
        y1: graf.Y(l.v),
        y2: graf.Y(l.v),
        stroke: l.cor,
        "stroke-width": 1,
        "stroke-dasharray": "5 4",
        opacity: 0.9
      })
    );
  });
  desenhaRefs(graf.svg, graf.Y, graf.m.l, graf.W - graf.m.r, graf.o.refs, graf.o.dec, graf.o.unidade);
  if (graf.o.marcaDia) {
    const xd = graf.X(idx(graf.o.marcaDia));
    graf.svg.append(
      svgEl("line", {
        x1: xd,
        x2: xd,
        y1: graf.m.t,
        y2: graf.H - graf.m.b,
        stroke: COR.vermelho,
        "stroke-width": 1,
        "stroke-dasharray": "3 3",
        opacity: 0.7
      })
    );
    const md = svgEl("text", {
      x: xd,
      y: graf.m.t - 6,
      "text-anchor": "middle",
      "font-size": 10.5,
      "font-family": "Arial",
      fill: COR.vermelho
    });
    md.textContent = "data de referência";
    graf.svg.append(md);
  }
}

// uma curva por ano (o ano em destaque por último), rótulos das faixas e das pontas
function curvasCalendario(graf) {
  const ordem = graf.anos
    .slice()
    .sort(
      (a, b) =>
        (a === graf.o.anoAtual) - (b === graf.o.anoAtual) || (a === graf.o.anoAtual - 1) - (b === graf.o.anoAtual - 1)
    );
  const fins = [];
  ordem.forEach(a => {
    const pts = [];
    graf.serie[a].forEach((v, i) => {
      if (v != null) pts.push([i, v]);
    });
    if (!pts.length) return;
    let d = "",
      ant = null;
    const trechos = [];
    pts.forEach(([i, v]) => {
      const novo = ant == null || i - ant > graf.maxVao || (graf.quebra[a] && graf.quebra[a].has(i));
      d += (novo ? "M" : "L") + graf.X(i).toFixed(1) + " " + graf.Y(v).toFixed(1);
      if (novo) trechos.push([]);
      trechos[trechos.length - 1].push([i, v]);
      ant = i;
    });
    // ponto isolado (entre duas interrupções) não tem linha: marcador, para não sumir do gráfico
    if (a !== graf.o.anoAtual)
      trechos
        .filter(t => t.length === 1)
        .forEach(([[i, v]]) =>
          graf.svg.append(
            svgEl("circle", { cx: graf.X(i), cy: graf.Y(v), r: 2.2, fill: corGraficoCalendario(graf, a) })
          )
        );
    graf.svg.append(
      svgEl("path", {
        d,
        fill: "none",
        stroke: corGraficoCalendario(graf, a),
        "stroke-width": a === graf.o.anoAtual ? 3 : a === graf.o.anoAtual - 1 ? 2 : 1.3,
        "stroke-linejoin": "round",
        "stroke-linecap": "round"
      })
    );
    if (a === graf.o.anoAtual)
      pts.forEach(([i, v]) =>
        graf.svg.append(svgEl("circle", { cx: graf.X(i), cy: graf.Y(v), r: 2.6, fill: corGraficoCalendario(graf, a) }))
      );
    const fim = pts[pts.length - 1];
    fins.push({ a, x: graf.X(fim[0]), y: graf.Y(fim[1]) });
  });
  (graf.o.faixas || []).forEach(f => {
    if (!f._t) return;
    const t = svgEl("text", {
      x: f._t.x,
      y: f._t.y,
      "font-size": 10.5,
      "font-family": "Arial",
      fill: COR.apagado,
      stroke: COR.branco,
      "stroke-width": 3,
      "paint-order": "stroke",
      "stroke-linejoin": "round"
    });
    t.textContent = f._t.rot;
    graf.svg.append(t);
  });
  if (!graf.o.semRotulos)
    rotulosPonta(graf.svg, fins, (...a) => corGraficoCalendario(graf, ...a), graf.o.anoAtual, graf.H - graf.m.b - 4);
}

// cursor: linha vertical e balão com o valor de cada ano no dia
function cursorCalendario(graf) {
  const cruz = svgEl("line", { y1: graf.m.t, y2: graf.H - graf.m.b, stroke: COR.linhaForte, visibility: "hidden" });
  graf.svg.append(cruz);
  const alvo = svgEl("rect", {
    x: graf.m.l,
    y: 0,
    width: graf.W - graf.m.l - graf.m.r,
    height: graf.H,
    fill: "transparent"
  });
  graf.svg.append(alvo);
  graf.host.append(graf.svg);
  const tip = balao(graf.host);
  alvo.addEventListener("pointermove", ev => {
    const r = graf.svg.getBoundingClientRect(),
      px = ((ev.clientX - r.left) * graf.W) / r.width,
      i = Math.max(0, Math.min(364, Math.round(((px - graf.m.l) / (graf.W - graf.m.l - graf.m.r)) * 364)));
    cruz.setAttribute("x1", graf.X(i));
    cruz.setAttribute("x2", graf.X(i));
    cruz.setAttribute("visibility", "visible");
    const dt = new Date(Date.UTC(2025, 0, 1) + i * 864e5);
    const perto = a => {
      const s = graf.serie[a];
      for (let k = 0; k <= graf.tol; k++) {
        if (s[i - k] != null) return s[i - k];
        if (s[i + k] != null) return s[i + k];
      }
      return null;
    };
    tip.innerHTML =
      `<b>${String(dt.getUTCDate()).padStart(2, "0")}/${String(dt.getUTCMonth() + 1).padStart(2, "0")}</b>` +
      graf.anos
        .slice()
        .reverse()
        .map(a => {
          const v = perto(a);
          return `<div class="l"><span><i style="border-color:${corGraficoCalendario(graf, a)}"></i>${a}</span><span class="num">${v == null ? "–" : fmt(v, graf.o.dec) + " " + graf.o.unidade}</span></div>`;
        })
        .join("");
    tip.hidden = false;
    posicionaBalao(tip, graf.svg, graf.X(i), graf.W);
  });
  alvo.addEventListener("pointerleave", () => {
    cruz.setAttribute("visibility", "hidden");
    tip.hidden = true;
  });
}

const idx = iso => Math.round((Date.UTC(2025, +iso.slice(5, 7) - 1, +iso.slice(8, 10)) - Date.UTC(2025, 0, 1)) / 864e5);

const corGraficoCalendario = (graf, a) =>
  a === graf.o.anoAtual ? COR.ana : a === graf.o.anoAtual - 1 ? COR.azulMedio : COR.cinzaAnos;

// balão de uma barra por ano: o valor e as grandezas de apoio (o.extras) que a barra tiver
const balaoBarraAno = (d, o, extras) =>
  `<b>${d.rot || d.a}</b><div class="l"><span>${o.legenda || o.rotulo}</span><span class="num">${fmt(d.v, o.dec)} ${o.unidade}</span></div>` +
  extras
    .filter(x => d[x.campo] != null)
    .map(
      x =>
        `<div class="l"><span>${x.rot}</span><span class="num">${fint(d[x.campo])}${x.unidade ? " " + x.unidade : ""}</span></div>`
    )
    .join("");
// barras por ano com o valor escrito (mesma leitura da ficha)
// o.extras: grandezas de apoio de cada barra, no balão e em colunas do CSV ({campo, col, rot, unidade})
function graficoBarrasAnos(host, dados, o) {
  host.innerHTML = "";
  const comLeitura = dados.some(d => d.leitura != null); // ficha do NE: data pedida e data da leitura usada
  const extras = o.extras || [];
  guardaCSV(
    host,
    [
      "ano",
      "data",
      ...(comLeitura ? ["leitura_usada"] : []),
      o.colCSV || COL_UNID[o.unidade] || "valor",
      ...extras.map(x => x.col)
    ],
    dados.map(d => [
      d.a,
      d.data || d.rot || "",
      ...(comLeitura ? [d.leitura || ""] : []),
      d.v,
      ...extras.map(x => (d[x.campo] == null ? "" : d[x.campo]))
    ]),
    o.rotCSV
  );
  const W = Math.max(300, host.clientWidth),
    H = alturaGraf(o.altura || "barras", W),
    m = { l: 52, r: 16, t: 36, b: 26 };
  const vals = dados.map(d => d.v).filter(v => v != null);
  if (!vals.length) {
    host.innerHTML = '<p class="nota" style="padding:14px 0">Sem dados.</p>';
    return;
  }
  const vr = vals.concat(refsVals(o.refs)); // a escala inclui as linhas de referência
  let lo = 0,
    hi = o.pct ? Math.max(100, Math.max(...vr)) : Math.max(...vr) * 1.06;
  if (o.relativo) {
    const a = Math.min(...vr),
      b = Math.max(...vr),
      p = (b - a) * 0.12 || 1;
    lo = a - p;
    hi = b + p;
  }
  const faixa = (W - m.l - m.r) / dados.length,
    bw = Math.min(30, faixa * 0.62);
  const X = i => m.l + faixa * i + (faixa - bw) / 2,
    Y = v => m.t + ((hi - v) / (hi - lo)) * (H - m.t - m.b);
  const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": o.rotulo });
  const eixo = svgEl("g", { class: "eixo" }),
    passoY = niceStep((hi - lo) / 5);
  for (let v = Math.ceil(lo / passoY) * passoY; v <= hi; v += passoY) {
    eixo.append(svgEl("line", { x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v), stroke: COR.linha }));
    const tx = svgEl("text", { x: m.l - 8, y: Y(v) + 4, "text-anchor": "end" });
    tx.textContent = fmt(v, passoY < 1 ? 1 : 0);
    eixo.append(tx);
  }
  // rótulos dos anos com ao menos 30 px entre eles (1, 2, 5 ou 10 anos); valor sobre a barra só com espaço para ele
  const passoAno = [1, 2, 5, 10].find(p => p * faixa >= 30) || 10,
    comValor = faixa >= 12;
  dados.forEach((d, i) => {
    if (d.a % passoAno === 0 || (passoAno === 1 && dados.length <= 14)) {
      const tx = svgEl("text", { x: X(i) + bw / 2, y: H - 8, "text-anchor": "middle" });
      tx.textContent = d.a;
      eixo.append(tx);
    }
  });
  const rot = svgEl("text", {
    x: m.l,
    y: 16,
    "font-size": 13.5,
    fill: COR.ana,
    "font-weight": 700,
    "font-family": "Arial"
  });
  rot.textContent = o.rotulo;
  eixo.append(rot);
  svg.append(eixo);
  const tip = balao(host);
  dados.forEach((d, i) => {
    if (d.v == null) return;
    const x = X(i),
      escura = d.a === o.anoAtual || d.a === o.anoAtual - 1;
    const r = svgEl("rect", {
      x,
      y: Y(d.v),
      width: bw,
      height: Math.max(0, Y(lo) - Y(d.v)),
      rx: 1,
      fill: d.a === o.anoAtual ? COR.ana : d.a === o.anoAtual - 1 ? COR.azulMedio : COR.cinzaAnos
    });
    r.addEventListener("pointerenter", () => {
      tip.innerHTML = balaoBarraAno(d, o, extras);
      tip.hidden = false;
      posicionaBalao(tip, svg, x + bw / 2, W);
    });
    r.addEventListener("pointerleave", () => (tip.hidden = true));
    svg.append(r);
    const hb = Y(lo) - Y(d.v),
      cx = x + bw / 2,
      dentro = hb > 56,
      cy = dentro ? Y(d.v) + 6 : Math.min(Y(d.v), Y(lo)) - 6;
    const vt = svgEl("text", {
      x: cx,
      y: cy,
      "text-anchor": dentro ? "end" : "start",
      "dominant-baseline": "middle",
      "font-size": 10.5,
      "font-family": "Arial",
      "font-weight": 600,
      "letter-spacing": 0.6,
      fill: dentro ? (escura ? COR.branco : COR.tinta2) : COR.tinta2,
      transform: `rotate(-90 ${cx} ${cy})`
    });
    vt.textContent = fmt(d.v, o.dec);
    if (comValor) svg.append(vt);
  });
  desenhaRefs(svg, Y, m.l, W - m.r, o.refs, o.dec, o.unidade); // por cima das barras
  host.append(svg);
}

// açudes com medição em cada ano: volume no SAR e nível no HidroInfoAna
const MESES_NOME = "janeiro fevereiro março abril maio junho julho agosto setembro outubro novembro dezembro".split(
  " "
);
// op.ate: data do dado mais recente (o ano em curso aparece como "até" o mês dela)
function graficoMonitoramento(host, hist, rotulo, op = {}) {
  host.innerHTML = "";
  const anos = Object.keys(hist)
    .map(Number)
    .sort((a, b) => a - b);
  const W = Math.max(300, host.clientWidth),
    H = alturaGraf(op.altura || "barras", W),
    m = { l: 44, r: 12, t: 58, b: 26 };
  const series = ["sar", "hidro"].filter(k => anos.some(a => hist[a][k]));
  const rotS = k =>
    (op.rot && op.rot[k]) || (k === "sar" ? "reservatorios com volume" : "reservatorios com leitura de nivel");
  guardaCSV(
    host,
    ["ano", ...series.map(k => rotS(k).normalize("NFD").replace(/\p{M}/gu, "").replace(/\W+/g, "_"))],
    anos.map(a => [a, ...series.map(k => hist[a][k] || 0)])
  );
  const topo = Math.max(4, ...anos.flatMap(a => series.map(k => hist[a][k] || 0)));
  const passo = niceStep(topo / 4),
    hi = Math.ceil(topo / passo) * passo;
  const faixa = (W - m.l - m.r) / anos.length,
    bw = Math.min(12, faixa * 0.36);
  const Y = v => m.t + ((hi - v) / hi) * (H - m.t - m.b);
  const CORES = { sar: COR.ana, hidro: "#8FAFD4" },
    ROT = op.rot || { sar: "com volume", hidro: "com leitura de nível" };
  const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": rotulo });
  const eixo = svgEl("g", { class: "eixo" });
  for (let v = 0; v <= hi + 1e-9; v += passo) {
    eixo.append(svgEl("line", { x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v), stroke: COR.linha }));
    const tx = svgEl("text", { x: m.l - 8, y: Y(v) + 4, "text-anchor": "end" });
    tx.textContent = fint(v);
    eixo.append(tx);
  }
  anos.forEach((a, i) => {
    if (anos.length <= 14 || a % 2 === 0) {
      const tx = svgEl("text", { x: m.l + faixa * i + faixa / 2, y: H - 8, "text-anchor": "middle" });
      tx.textContent = a;
      eixo.append(tx);
    }
  });
  svg.append(eixo);
  const rt = svgEl("text", {
    x: m.l,
    y: 16,
    "font-size": 13.5,
    fill: COR.ana,
    "font-weight": 700,
    "font-family": "Arial"
  });
  rt.textContent = rotulo;
  svg.append(rt);
  let lx = m.l;
  series.forEach(k => {
    svg.append(svgEl("rect", { x: lx, y: 31, width: 12, height: 10, rx: 1, fill: CORES[k] }));
    const tx = svgEl("text", { x: lx + 17, y: 40, "font-size": 12, fill: COR.tinta2, "font-family": "Arial" });
    tx.textContent = ROT[k];
    svg.append(tx);
    lx += 17 + ROT[k].length * 6.1 + 22;
  });
  const tip = balao(host);
  anos.forEach((a, i) => {
    const cx = m.l + faixa * i + faixa / 2;
    const pos = series.length > 1 ? { sar: cx - bw - 1, hidro: cx + 1 } : { [series[0]]: cx - bw / 2 };
    series.forEach(k => {
      const v = hist[a][k];
      if (v) svg.append(svgEl("rect", { x: pos[k], y: Y(v), width: bw, height: Y(0) - Y(v), rx: 1, fill: CORES[k] }));
    });
    const alvo = svgEl("rect", {
      x: m.l + faixa * i,
      y: m.t,
      width: faixa,
      height: H - m.t - m.b,
      fill: "transparent"
    });
    alvo.addEventListener("pointerenter", () => {
      tip.innerHTML =
        `<b>${a}${a === anos[anos.length - 1] && op.ate ? ` (até ${MESES_NOME[+op.ate.slice(5, 7) - 1]})` : ""}</b>` +
        series
          .map(
            k =>
              `<div class="l"><span><i style="border-color:${CORES[k]}"></i>${ROT[k]}</span><span class="num">${hist[a][k] || 0}</span></div>`
          )
          .join("");
      tip.hidden = false;
      posicionaBalao(tip, svg, cx, W);
    });
    alvo.addEventListener("pointerleave", () => (tip.hidden = true));
    svg.append(alvo);
  });
  host.append(svg);
}

// Gráfico mensal contra a média de longo termo (Diego, 23/09/2026): barra com o valor de cada mês e a média de longo
// termo (MLT) do mês em linha com marcadores; mês incompleto em azul-claro, com o número de dias com dado sobre a barra.
// Com o cursor sobre um mês: o mês marcado no eixo e os valores em etiquetas junto da barra e dos pontos. Usado no
// Sistema Cantareira (cantareira.js) e na vazão natural da ficha (ficha_sin.js).
// dados: [{ rot, v, mlt, parcial, dias, min?, anoMin?, max?, anoMax? }]; com min e max, a faixa da mínima à máxima de
// cada mês ao fundo e, no cursor, as duas com o ano.
// o: rotulo (título no gráfico), eixo (título do eixo vertical), legV, legMlt e legFaixa (legenda), nomeV (nome do valor
// na etiqueta do cursor), unidade, dec, csv (nomes das colunas do valor e da MLT), csvDias (true ou o nome da coluna dos
// dias com dado), csvFaixa (nomes das colunas da mínima e da máxima), cheia (largura toda da seção)
const LARGURA_ESTREITA = 480, // abaixo disso o gráfico ocupa a largura da caixa e o eixo mostra meses alternados
  LARGURA_LADO_A_LADO = 560; // largura fixa de desenho quando dois gráficos ficam lado a lado (Cantareira)
function graficoMensalMLT(host, dados, o) {
  host.innerHTML = "";
  const temFaixa = dados.some(d => d.min != null);
  csvMensal(host, dados, o, temFaixa);
  const vals = dados.flatMap(d => [d.v, d.mlt, d.max]).filter(v => v != null);
  if (!vals.length) {
    host.insertAdjacentHTML(
      "beforeend",
      '<p class="nota" style="padding:14px 0">Sem dados nos 12 meses até a data.</p>'
    );
    return;
  }
  const estreito = host.clientWidth && host.clientWidth < LARGURA_ESTREITA,
    W = o.cheia || estreito ? Math.max(300, host.clientWidth) : LARGURA_LADO_A_LADO,
    // com a faixa mínima–máxima, a altura dos gráficos principais: a escala vai até a máxima
    H = o.cheia ? alturaGraf(temFaixa ? "principal" : "barras", W) : 290,
    // margens: título e legenda em cima (a legenda com a faixa passa a duas linhas abaixo de 700 px), eixo embaixo
    m = { l: 58, r: 12, t: temFaixa && W < 700 ? 70 : 54, b: 28 },
    hi = Math.max(...vals) * 1.1; // 10% de folga acima do maior valor, para as etiquetas
  const faixa = (W - m.l - m.r) / dados.length,
    bw = faixa * 0.8, // a barra ocupa 80% da faixa do mês
    X = i => m.l + faixa * i + (faixa - bw) / 2,
    CX = i => m.l + faixa * i + faixa / 2,
    Y = v => m.t + ((hi - v) / hi) * (H - m.t - m.b);
  const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": o.rotulo }),
    txt = textoSVG;
  const eixo = svgEl("g", { class: "eixo" }),
    passo = niceStep(hi / 5);
  for (let v = 0; v <= hi; v += passo) {
    eixo.append(svgEl("line", { x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v), stroke: COR.linha }));
    eixo.append(txt({ x: m.l - 6, y: Y(v) + 4, "text-anchor": "end" }, fmt(v, passo < 1 ? 1 : 0)));
  }
  eixo.append(svgEl("line", { x1: m.l, x2: W - m.r, y1: Y(0), y2: Y(0), stroke: COR.linhaForte }));
  const rotMes = dados.map((d, i) => {
    const t = txt(
      { x: CX(i), y: H - 9, "text-anchor": "middle" },
      W < LARGURA_ESTREITA && (dados.length - 1 - i) % 2 ? "" : d.rot
    );
    eixo.append(t);
    return t;
  });
  const yEixo = (m.t + H - m.b) / 2;
  eixo.append(
    txt({ x: 14, y: yEixo, "text-anchor": "middle", transform: `rotate(-90 14 ${yEixo})`, fill: COR.tinta2 }, o.eixo)
  );
  svg.append(eixo);
  svg.append(txt({ x: m.l, y: 16, "font-size": 13.5, fill: COR.ana, "font-weight": 700 }, o.rotulo));
  svg.append(legendaBarraLinha(m.l, o.legV, o.legMlt, temFaixa && o.legFaixa, W));
  // fundo do mês sob o cursor, atrás das barras
  const marca = svgEl("rect", { y: m.t, width: faixa, height: H - m.t - m.b, fill: COR.gelo, visibility: "hidden" });
  svg.append(marca);
  if (temFaixa)
    faixaMinMax(
      svg,
      dados.map((d, i) => d.min != null && d.max != null && [CX(i), Y(d.min), Y(d.max)])
    );
  dados.forEach((d, i) => {
    if (d.v == null) return;
    svg.append(
      svgEl("rect", {
        x: X(i),
        y: Math.min(Y(d.v), Y(0) - 1),
        width: bw,
        height: Math.max(1, Y(0) - Y(d.v)),
        rx: 1.5,
        fill: d.parcial ? COR.claro : COR.vivo
      })
    );
    if (d.parcial && d.dias)
      svg.append(
        txt(
          { x: CX(i), y: Y(d.v) - 5, "text-anchor": "middle", "font-size": 10.5, fill: COR.tinta2 },
          `${d.dias} ${d.dias === 1 ? "dia" : "dias"}`
        )
      );
  });
  linhaMarcadores(
    svg,
    dados.map((d, i) => (d.mlt != null ? [CX(i), Y(d.mlt)] : null)),
    COR.ana
  );
  // etiquetas do cursor: nome da série + caixa com o valor, à esquerda do mês (à direita quando não cabe)
  const cam = svgEl("g", { visibility: "hidden", "pointer-events": "none", "font-family": "Arial" });
  svg.append(cam);
  const mostra = i => {
    const d = dados[i];
    marca.setAttribute("x", m.l + faixa * i);
    marca.setAttribute("visibility", "visible");
    cam.innerHTML = "";
    const itens = itensCursorMensal(d, o, Y);
    separaEtiquetas(itens, m.t - 6, Y(0) - 8);
    const larg = Math.max(...itens.map(e => largTexto(e.valor, 12, true) + 12 + largTexto(e.nome, 12) + 18)),
      lado = X(i) - larg < m.l ? 1 : -1,
      x0 = lado < 0 ? X(i) : X(i) + bw;
    itens.forEach(e => cam.append(etiquetaValor(e.nome, e.valor, e.y, lado, x0, e.estilo)));
    // mês marcado no eixo
    const wm = largTexto(d.rot, 12, true) + 14;
    cam.append(svgEl("rect", { x: CX(i) - wm / 2, y: H - 23, width: wm, height: 19, rx: 2, fill: COR.tinta }));
    cam.append(
      txt({ x: CX(i), y: H - 9, "text-anchor": "middle", "font-size": 12, "font-weight": 700, fill: COR.branco }, d.rot)
    );
    rotMes.forEach((t, k) => t.setAttribute("visibility", k === i ? "hidden" : "visible"));
    cam.setAttribute("visibility", "visible");
  };
  const esconde = () => {
    marca.setAttribute("visibility", "hidden");
    cam.setAttribute("visibility", "hidden");
    rotMes.forEach(t => t.setAttribute("visibility", "visible"));
  };
  dados.forEach((d, i) => {
    const alvo = svgEl("rect", { x: m.l + faixa * i, y: m.t, width: faixa, height: H - m.t, fill: "transparent" });
    alvo.addEventListener("pointerenter", () => mostra(i));
    alvo.addEventListener("pointerleave", esconde);
    svg.append(alvo);
  });
  host.append(svg);
}
// legenda do gráfico mensal: barra do mês, linha com marcador da MLT e, com legFaixa, a faixa mínima–máxima, a partir
// de x (a faixa passa para a linha de baixo quando não cabe na largura W)
function legendaBarraLinha(x, legV, legMlt, legFaixa, W) {
  const leg = svgEl("g", { "font-size": 11.5, fill: COR.tinta2 }),
    x2 = x + 17 + largTexto(legV, 11.5) + 20;
  leg.append(svgEl("rect", { x, y: 28, width: 12, height: 10, fill: COR.vivo }));
  leg.append(textoSVG({ x: x + 17, y: 37 }, legV));
  leg.append(svgEl("line", { x1: x2, x2: x2 + 20, y1: 33, y2: 33, stroke: COR.ana, "stroke-width": 2 }));
  leg.append(svgEl("circle", { cx: x2 + 10, cy: 33, r: 3.5, fill: COR.ana }));
  leg.append(textoSVG({ x: x2 + 26, y: 37 }, legMlt));
  if (legFaixa) {
    let x3 = x2 + 26 + largTexto(legMlt, 11.5) + 20,
      y3 = 0;
    if (W && x3 + 21 + largTexto(legFaixa, 11.5) > W) {
      x3 = x;
      y3 = 16;
    }
    leg.append(
      svgEl("rect", {
        x: x3,
        y: 27 + y3,
        width: 16,
        height: 12,
        fill: COR.claro,
        "fill-opacity": 0.3,
        stroke: COR.claro
      })
    );
    leg.append(textoSVG({ x: x3 + 21, y: 37 + y3 }, legFaixa));
  }
  return leg;
}
// trechos contínuos de uma lista de pontos: um valor falso (null, false) interrompe o trecho; trechos de um ponto só
// ficam de fora (não formam linha nem faixa)
function trechosContinuos(pts) {
  const out = [];
  let t = [];
  pts.forEach(p => {
    if (p) t.push(p);
    else {
      if (t.length > 1) out.push(t);
      t = [];
    }
  });
  if (t.length > 1) out.push(t);
  return out;
}
// faixa da mínima à máxima de cada mês: pts = [x, y da mínima, y da máxima] ou falso (interrompe a faixa)
function faixaMinMax(svg, pts) {
  trechosContinuos(pts).forEach(tr => {
    const sup = tr.map(p => `${p[0]},${p[2]}`),
      inf = tr.map(p => `${p[0]},${p[1]}`);
    svg.append(
      svgEl("polygon", { points: [...sup, ...inf.reverse()].join(" "), fill: COR.claro, "fill-opacity": 0.3 })
    );
    [sup, inf].forEach(l =>
      svg.append(svgEl("polyline", { points: l.join(" "), fill: "none", stroke: COR.claro, "stroke-width": 1 }))
    );
  });
}
// CSV do gráfico mensal: mês, valor, MLT e, conforme o caso, dias com dado e mínima e máxima com o ano
function csvMensal(host, dados, o, temFaixa) {
  guardaCSV(
    host,
    [
      "mes",
      ...(o.csv || ["valor", "media_longo_termo"]),
      ...(o.csvDias ? [o.csvDias === true ? "dias_com_dado" : o.csvDias] : []),
      ...(temFaixa ? o.csvFaixa || ["minima", "ano_minima", "maxima", "ano_maxima"] : [])
    ],
    dados.map(d => [
      d.rot,
      d.v,
      d.mlt,
      ...(o.csvDias ? [d.dias ?? null] : []),
      ...(temFaixa ? [d.min, d.anoMin, d.max, d.anoMax] : [])
    ])
  );
}
// etiquetas do cursor de um mês do gráfico mensal: valor do mês, MLT e, com a faixa, máxima e mínima com o ano
function itensCursorMensal(d, o, Y) {
  const u = o.unidade === "%" ? "%" : " " + o.unidade,
    item = (nome, v, estilo) => ({ nome, valor: fmt(v, o.dec) + u, y: Y(v), estilo });
  return [
    d.v != null && item(d.parcial && d.dias ? `${o.nomeV} (${d.dias} d)` : o.nomeV, d.v, "v"),
    d.mlt != null && item("MLT", d.mlt, "mlt"),
    d.max != null && item(`máx. ${d.anoMax}`, d.max, "faixa"),
    d.min != null && item(`mín. ${d.anoMin}`, d.min, "faixa")
  ].filter(Boolean);
}
// afasta as etiquetas do cursor para que não se sobreponham (22 px entre elas), dentro de [topo, base]
function separaEtiquetas(itens, topo, base) {
  itens.sort((a, b) => a.y - b.y);
  itens.forEach((e, k) => {
    e.y = Math.max(e.y, topo, k ? itens[k - 1].y + 22 : -Infinity);
  });
  const excesso = itens.length ? itens[itens.length - 1].y - base : 0;
  if (excesso > 0) itens.forEach(e => (e.y -= excesso));
}
// largura aproximada de um texto em Arial (px), para posicionar legendas e etiquetas sem medir o SVG no DOM: meia letra
// por caractere no corpo normal, um pouco mais no negrito
const largTexto = (s, corpo, negrito = false) => String(s).length * corpo * (negrito ? 0.55 : 0.52);
// texto SVG em Arial com os atributos dados
function textoSVG(a, s) {
  const t = svgEl("text", { "font-family": "Arial", ...a });
  t.textContent = s;
  return t;
}
// linha contínua entre os pontos com valor ([x, y] ou null, que interrompe a linha) e marcador em cada ponto, com anel
// branco para destacar da barra
function linhaMarcadores(svg, pts, cor) {
  trechosContinuos(pts).forEach(tr =>
    svg.append(
      svgEl("polyline", {
        points: tr.map(p => p.join(",")).join(" "),
        fill: "none",
        stroke: cor,
        "stroke-width": 2,
        "pointer-events": "none"
      })
    )
  );
  pts.forEach(
    p =>
      p &&
      svg.append(
        svgEl("circle", {
          cx: p[0],
          cy: p[1],
          r: 4,
          fill: cor,
          stroke: COR.branco,
          "stroke-width": 1.5,
          "pointer-events": "none"
        })
      )
  );
}
// etiqueta de valor do cursor: seta no ponto (x0, y), caixa com o valor e o nome da série do lado de fora; lado < 0
// põe a etiqueta à esquerda do ponto. estilo: "mlt", caixa marinho com texto branco; "faixa", caixa branca com contorno
// azul-claro (mínima e máxima); "v", azul-claro com texto escuro (valor do mês)
function etiquetaValor(nome, valor, y, lado, x0, estilo) {
  const g = svgEl("g"),
    escura = estilo === "mlt",
    borda = estilo === "faixa",
    wv = largTexto(valor, 12, true) + 12,
    s = lado < 0 ? -1 : 1,
    xb = s < 0 ? x0 - 6 - wv : x0 + 6,
    fundo = escura ? COR.ana : borda ? COR.branco : COR.claro;
  g.append(svgEl("path", { d: `M${x0},${y} l${s * 7},-5 v10 z`, fill: borda ? COR.claro : fundo }));
  g.append(
    svgEl("rect", { x: xb, y: y - 10, width: wv, height: 20, rx: 2, fill: fundo, stroke: borda ? COR.claro : "none" })
  );
  const a = { y: y + 4.5, "font-size": 12 };
  g.append(
    textoSVG(
      { ...a, x: xb + wv / 2, "text-anchor": "middle", "font-weight": 700, fill: escura ? COR.branco : COR.tinta },
      valor
    )
  );
  g.append(
    textoSVG(
      {
        ...a,
        x: s < 0 ? xb - 5 : xb + wv + 5,
        "text-anchor": s < 0 ? "end" : "start",
        fill: COR.tinta2,
        stroke: COR.branco,
        "stroke-width": 3,
        "paint-order": "stroke"
      },
      nome
    )
  );
  return g;
}

// balão de informação dos gráficos: vazio e escondido, dentro da caixa do gráfico (posição absoluta pelo CSS .tip)
function balao(host) {
  const tip = document.createElement("div");
  tip.className = "tip";
  tip.hidden = true;
  host.append(tip);
  return tip;
}
// põe o balão ao lado do ponto x (em unidades do desenho, de 0 a W): à direita, ou à esquerda quando não cabe
function posicionaBalao(tip, svg, x, W, topo = 6) {
  const r = svg.getBoundingClientRect(),
    hx = (x / W) * r.width,
    tw = tip.offsetWidth;
  tip.style.left = (hx + 14 + tw > r.width ? Math.max(0, hx - tw - 14) : hx + 14) + "px";
  tip.style.top = topo + "px";
}

export {
  alturaGraf,
  balao,
  botoesAnos,
  comoLer,
  graficoBarrasAnos,
  graficoCalendario,
  graficoLinhas,
  graficoMensalMLT,
  graficoMonitoramento,
  ler,
  MAX_ANOS,
  posicionaBalao,
  tintaFaixa,
  VAO_MAX
};
