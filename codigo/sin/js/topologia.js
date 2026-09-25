/* Topologia da cascata (Anexo I, 3.3, diagrama da cascata)
   O cadastro guarda, para cada usina, o rio e a usina imediatamente a jusante; para cada rio, o rio em que deságua, a
   primeira usina a jusante da confluência nesse rio (null = abaixo da última usina dele) e a ordem entre as
   confluências do mesmo trecho (1 = a mais a jusante). Rio sem usina entra só como ligação (afluente de afluente).
   O diagrama da página da bacia e a prévia da inclusão na área administrativa são desenhados daqui. */
import { D } from "./dados_embutidos.js";
import { caso, COR, fint, fmt, svgEl } from "./base.js";
import { ADM } from "./admin/admin_nucleo.js";

// topologia a partir dos dados embutidos (preparar_dados.py): {foz, rios: {nome: {...}}, nos: {id: {...}}}
// topologia publicada da bacia do Grande: a do cadastro (D.grande.topologia) até uma inclusão aprovada na área
// administrativa, que a substitui (ADM.topo, em js/admin/admin_nucleo.js; no protótipo a publicação é simulada no navegador)
const topoGrande = () => ADM.topo || (ADM.topo = topoDe(D.grande));
function topoDe(G) {
  const T = G.topologia,
    info = {};
  G.res.forEach(r => (info[r.nome] = r));
  const nos = {};
  T.usinas.forEach(
    u => (nos[u.id] = { id: u.id, nome: caso(u.id), tipo: (info[u.id] || {}).tipo, rio: u.rio, jusante: u.jusante })
  );
  return { foz: T.foz, rios: JSON.parse(JSON.stringify(T.rios)), nos };
}
const principalTopo = T => Object.keys(T.rios).find(r => !T.rios[r].desagua);
// usinas de um rio, de montante para jusante
function cadeiaRio(nos, rio) {
  const R = Object.values(nos).filter(n => n.rio === rio),
    topo = R.find(n => !R.some(m => m.jusante === n.id)),
    L = [];
  for (let n = topo; n && n.rio === rio && !L.includes(n); n = nos[n.jusante]) L.push(n);
  return L;
}
// primeira usina a jusante do fim de um rio (null = foz da bacia)
function jusanteDoFim(T, rio) {
  const x = T.rios[rio];
  return x.jusante || !x.desagua ? x.jusante || null : jusanteDoFim(T, x.desagua);
}
// refaz a usina a jusante da última usina de cada rio, depois de mudar rios ou confluências
function refazJusantes(T) {
  Object.keys(T.rios).forEach(rio => {
    const C = cadeiaRio(T.nos, rio);
    if (C.length) C[C.length - 1].jusante = jusanteDoFim(T, rio);
  });
  return T;
}
// afluentes que entram num rio logo acima de uma usina (ou abaixo da última, com jus = null), do mais a montante ao
// mais a jusante
const afluentesEm = (T, rio, jus) =>
  Object.keys(T.rios)
    .filter(r => T.rios[r].desagua === rio && (T.rios[r].jusante || null) === (jus || null))
    .sort((a, b) => (T.rios[b].ordem || 0) - (T.rios[a].ordem || 0));
// sequência da cabeceira à foz: cada usina com a profundidade do seu rio (0 = rio principal); o afluente entra logo
// antes da usina que recebe a sua água, e o afluente de afluente, dentro dele
function ordemTopo(T) {
  const L = [],
    R = {};
  const coloca = (rio, prof) => {
    const i0 = L.length;
    cadeiaRio(T.nos, rio).forEach(n => {
      afluentesEm(T, rio, n.id).forEach(r => coloca(r, prof + 1));
      L.push({ n, prof, rio });
    });
    afluentesEm(T, rio, null).forEach(r => coloca(r, prof + 1));
    R[rio] = { prof, i0, i1: L.length - 1 };
  };
  coloca(principalTopo(T), 0);
  return { L, R, maxP: Math.max(0, ...Object.values(R).map(r => r.prof)) };
}
// frase de cada confluência, para o subtítulo do diagrama e o efeito da inclusão
function trechoConfluencia(T, rio) {
  const x = T.rios[rio],
    C = cadeiaRio(T.nos, x.desagua),
    k = x.jusante ? C.findIndex(n => n.id === x.jusante) : C.length;
  return !C.length
    ? ""
    : k === 0
      ? `acima de ${C[0].nome}`
      : k < C.length
        ? `entre ${C[k - 1].nome} e ${C[k].nome}`
        : `abaixo de ${C[C.length - 1].nome}`;
}
const descreveConfluencias = T =>
  Object.keys(T.rios)
    .filter(r => T.rios[r].desagua)
    .map(r => {
      const t = trechoConfluencia(T, r);
      return `O ${r} deságua no ${T.rios[r].desagua}${t ? " " + t : ""}.`;
    })
    .join(" ");

// desenho: o.orient "h" (cabeceira à direita, foz à esquerda, afluentes em faixas abaixo) ou "v" (cabeceira em cima,
// afluentes em colunas à direita); o.valores {id: registro do dia} escreve defluente e volume útil; o.destaque marca a
// usina nova; o.eventos(g, id) liga destaque e clique
function svgCascata(T, o = {}) {
  const diag = { o, T }; // estado do diagrama, passado às funções abaixo

  Object.assign(diag, ordemTopo(diag.T)); // L, R e maxP
  diag.princ = principalTopo(diag.T);
  diag.N = diag.L.length;
  diag.V = diag.o.valores || null;
  diag.svg = svgEl("svg", { role: "img", "aria-label": diag.o.rotulo || "Diagrama esquemático da cascata da bacia" });
  const dataTxt = diag.o.dataTxt ? tSvgCascata(diag, 8, 18, diag.o.dataTxt, { fill: COR.apagado }) : null;

  if (diag.o.orient === "v") return cascataVertical(diag);

  // horizontal: o rio principal numa linha, da cabeceira (direita) à foz (esquerda); cada afluente numa faixa abaixo do
  // rio que o recebe, saindo da confluência para montante (direita). As faixas são alocadas sem sobreposição e sem que a
  // ligação vertical de um afluente atravesse outro.
  disposicaoCascata(diag);
  riosCascata(diag);
  usinasCascata(diag);
  if (dataTxt) diag.svg.append(dataTxt);
  return diag.svg;
}

// disposição horizontal: o rio principal numa linha e cada afluente numa faixa abaixo, na ordem das confluências
function disposicaoCascata(diag) {
  diag.mE = 130;
  const mD = 60;
  diag.yR = 92;
  const rowH = 104;
  const C0 = cadeiaRio(diag.T.nos, diag.princ);
  const m = C0.length;
  const passo = Math.max(80, m > 1 ? (1180 - diag.mE - 120) / (m - 1) : 80);
  diag.X = {};
  const fila = { [diag.princ]: 0 };
  diag.ini = {};
  diag.jun = {};
  const faixas = [];
  const largNome = s => s.length * 6.6 + 12;
  C0.forEach((n, k) => (diag.X[n.id] = diag.mE + (m - 1 - k) * passo));
  diag.ini[diag.princ] = m ? diag.X[C0[0].id] : diag.mE;
  diag.ordemBFS = [diag.princ];
  for (let q = 0; q < diag.ordemBFS.length; q++) {
    const pai = diag.ordemBFS[q],
      Cp = cadeiaRio(diag.T.nos, pai);
    [...Cp.map(n => n.id), null].forEach(jus => {
      const fil = afluentesEm(diag.T, pai, jus).reverse(); // da confluência mais a jusante à mais a montante
      fil.forEach((r, k) => {
        const f = (k + 1) / (fil.length + 1);
        const xj = !Cp.length
          ? diag.jun[pai] + passo * 0.45 * (k + 1)
          : jus
            ? diag.X[jus] + passo * f
            : diag.X[Cp[Cp.length - 1].id] - passo * (1 - f);
        diag.jun[r] = xj;
        diag.ini[pai] = Math.max(diag.ini[pai], xj);
        const Cr = cadeiaRio(diag.T.nos, r),
          nFilhos = Object.keys(diag.T.rios).filter(z => diag.T.rios[z].desagua === r).length;
        Cr.forEach((n, i) => (diag.X[n.id] = xj + passo * (0.7 + (Cr.length - 1 - i))));
        diag.ini[r] = Cr.length ? diag.X[Cr[0].id] : xj + passo * 0.45 * (nFilhos + 1);
        // faixa: a primeira abaixo do rio receptor livre no intervalo e sem outra faixa no caminho da ligação vertical
        const a = xj - 16,
          b = diag.ini[r] + 44 + largNome(r);
        let lin = fila[pai] + 1;
        const ocupa = (l, x0, x1) => faixas.some(z => z.l === l && z.a < x1 && x0 < z.b);
        while (
          ocupa(lin, a, b) ||
          [...Array(lin - fila[pai] - 1)].some((_, d) => ocupa(fila[pai] + 1 + d, xj - 8, xj + 8))
        )
          lin++;
        fila[r] = lin;
        faixas.push({ l: lin, a, b });
        diag.ordemBFS.push(r);
      });
    });
  }
  const maxL = Math.max(0, ...Object.values(fila));
  const W = Math.max(1180, ...faixas.map(z => z.b + 10), diag.ini[diag.princ] + 36 + mD);
  const H = diag.yR + maxL * rowH + 70;
  diag.y = rio => diag.yR + fila[rio] * rowH;
  diag.svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
}

// rios: traçado e nomes, do principal aos afluentes, e a foz
function riosCascata(diag) {
  diag.ordemBFS.forEach(rio => {
    if (rio === diag.princ) {
      linhaCascata(diag, `M${diag.ini[diag.princ] + 36} ${diag.yR} H${diag.mE - 44}`, 7);
      tSvgCascata(diag, diag.ini[diag.princ] + 36, diag.yR - 46, rio, {
        "text-anchor": "end",
        fill: COR.ana,
        "font-size": 13,
        "font-style": "italic"
      });
    } else {
      const yy = diag.y(rio),
        yp = diag.y(diag.T.rios[rio].desagua),
        xs = diag.ini[rio] + 40,
        xj = diag.jun[rio];
      linhaCascata(diag, `M${xs} ${yy} H${xj + 26} Q${xj} ${yy} ${xj} ${yy - 26} V${yp}`, 5);
      tSvgCascata(diag, xs + 4, yy + 4, rio, { fill: COR.ana, "font-size": 13, "font-style": "italic" });
    }
    const C = cadeiaRio(diag.T.nos, rio);
    for (let i = 0; i < C.length - 1; i++) {
      if (afluentesEm(diag.T, rio, C[i + 1].id).length) continue; // trecho com confluência: sem seta, para não encostar nela
      const xm = (diag.X[C[i].id] + diag.X[C[i + 1].id]) / 2,
        yy = diag.y(rio);
      seta(diag, `M${xm + 4} ${yy - 4} L${xm - 3} ${yy} L${xm + 4} ${yy + 4}`);
    }
  });
  tSvgCascata(diag, 8, diag.yR - 14, diag.T.foz, { fill: COR.apagado, "font-style": "italic" });
}

// usinas: símbolo, nome, volume útil e defluente do dia
function usinasCascata(diag) {
  diag.L.forEach(({ n }) => {
    if (diag.X[n.id] == null) return;
    const xx = diag.X[n.id],
      yy = diag.y(n.rio),
      v = val(diag, n),
      nova = n.id === diag.o.destaque;
    no(diag, n, xx, yy, false);
    if (v)
      tSvgCascata(diag, xx, yy - 22, fint(v.defl), {
        "text-anchor": "middle",
        fill: COR.tinta,
        "font-family": "Arial"
      });
    tSvgCascata(diag, xx, yy + 30, n.nome, {
      "text-anchor": "middle",
      fill: nova ? COR.bronzeEscuro : COR.ana,
      "font-weight": 700
    });
    if (v && n.tipo !== "fio")
      tSvgCascata(diag, xx, yy + 45, `VU ${v.vu == null ? "–" : fmt(v.vu, 0)}%`, {
        "text-anchor": "middle",
        fill: COR.azulMedio,
        "font-weight": 700
      });
    if (nova)
      tSvgCascata(diag, xx, yy + 45, "usina nova", {
        "text-anchor": "middle",
        fill: COR.bronzeEscuro,
        "font-size": 11
      });
  });
}

// orientação vertical (celular): rios em colunas, usinas de cima para baixo
function cascataVertical(diag) {
  const passo = diag.V ? 50 : 46,
    topo = diag.V ? 70 : 58,
    xc = p => 30 + p * 44,
    xt = xc(diag.maxP) + 24,
    Y = [];
  // folga antes de cada afluente, para o nome do rio não encostar na usina de cima; um degrau por nível, quando o
  // afluente de afluente começa na mesma linha (rio sem usina)
  diag.L.forEach((l, i) =>
    Y.push(
      i ? Y[i - 1] + passo + 24 * Math.max(0, l.prof - diag.L[i - 1].prof) : topo + 24 * (diag.N ? diag.L[0].prof : 0)
    )
  );
  const H = (Y[diag.N - 1] || topo) + 62,
    W = Math.max(340, xt + 220);
  diag.svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  diag.svg.setAttribute("class", "vert cascata-topo");
  Object.entries(diag.R).forEach(([rio, r]) => {
    if (r.i1 < r.i0) return;
    const x = xc(r.prof),
      y0 = Y[r.i0] - 22 - 24 * (diag.L[r.i0].prof - r.prof);
    if (rio === diag.princ) {
      linhaCascata(diag, `M${x} ${y0} V${H - 26}`, 7);
      tSvgCascata(diag, x, y0 - 12, rio, {
        "text-anchor": "middle",
        fill: COR.ana,
        "font-size": 13,
        "font-style": "italic"
      });
    } else {
      const xp = xc(diag.R[diag.T.rios[rio].desagua].prof),
        yj = r.i1 + 1 < diag.N ? (Y[r.i1] + Y[r.i1 + 1]) / 2 : H - 40;
      linhaCascata(diag, `M${x} ${y0} V${yj - 14} Q${x} ${yj} ${x - 14} ${yj} H${xp}`, 5);
      tSvgCascata(diag, x + 12, y0 - 4, rio, { fill: COR.ana, "font-size": 13, "font-style": "italic" });
    }
  });
  tSvgCascata(diag, xc(0), H - 6, diag.T.foz, { "text-anchor": "middle", fill: COR.apagado, "font-style": "italic" });
  for (let i = 0; i < diag.N - 1; i++)
    if (diag.L[i].rio === diag.L[i + 1].rio && Y[i + 1] - Y[i] === passo) {
      const x = xc(diag.L[i].prof),
        ym = (Y[i] + Y[i + 1]) / 2;
      seta(diag, `M${x - 4} ${ym - 3} L${x} ${ym + 4} L${x + 4} ${ym - 3}`);
    }
  diag.L.forEach(({ n, prof }, i) => {
    no(diag, n, xc(prof), Y[i], true);
    const v = val(diag, n),
      nova = n.id === diag.o.destaque;
    tSvgCascata(diag, xt, Y[i] + (v ? -2 : 4), n.nome, {
      fill: nova ? COR.bronzeEscuro : COR.ana,
      "font-weight": 700,
      "font-size": 13.5
    });
    if (v)
      tSvgCascata(
        diag,
        xt,
        Y[i] + 14,
        (n.tipo !== "fio" ? `VU ${v.vu == null ? "–" : fmt(v.vu, 0)}% · ` : "") + `defluente ${fint(v.defl)} m³/s`,
        {
          fill: COR.tinta2,
          "font-family": "Arial",
          "font-size": 11.5
        }
      );
    if (nova) tSvgCascata(diag, xt, Y[i] + 18, "usina nova", { fill: COR.bronzeEscuro, "font-size": 11 });
  });
  return diag.svg;
}

const tSvgCascata = (diag, x, y, txt, at = {}) => {
  const e = svgEl("text", { x, y, "font-family": "Arial Narrow, Arial", "font-size": 12.5, fill: COR.tinta2, ...at });
  e.textContent = txt;
  diag.svg.append(e);
  return e;
};

const linhaCascata = (diag, d, w) =>
  diag.svg.append(svgEl("path", { d, stroke: "#C3CFDD", "stroke-width": w, "stroke-linecap": "round", fill: "none" }));

const seta = (diag, d) =>
  diag.svg.append(svgEl("path", { d, stroke: COR.ana, "stroke-width": 1.4, fill: "none", opacity: 0.55 }));

const val = (diag, n) => (diag.V ? diag.V[n.id] || {} : null);

const no = (diag, n, x, y, vert) => {
  const nova = n.id === diag.o.destaque,
    cor = nova ? COR.bronze : null;
  if (nova)
    diag.svg.append(svgEl("circle", { cx: x, cy: y, r: 18, fill: "none", stroke: COR.bronze, "stroke-width": 2.5 }));
  const g = svgEl("g", { class: "no-diag", transform: `translate(${x} ${y})` });
  g.dataset.usina = n.id;
  if (n.tipo === "fio")
    g.append(svgEl("circle", { r: 10, fill: cor || COR.azulMedio, stroke: COR.branco, "stroke-width": 2 }));
  else
    g.append(
      svgEl("path", {
        d: vert ? "M0 -14 L-13 10 L13 10 Z" : "M14 0 L-10 -13 L-10 13 Z", // ponta para montante
        fill: cor || COR.ana,
        stroke: COR.branco,
        "stroke-width": 2,
        "stroke-linejoin": "round"
      })
    );
  diag.svg.append(g);
  if (diag.o.eventos) diag.o.eventos(g, n.id);
};

export { afluentesEm, cadeiaRio, descreveConfluencias, refazJusantes, svgCascata, topoGrande, trechoConfluencia };
