/* Páginas do Distrito Federal e do Paraopeba (#outros/df, #outros/rmbh) e as séries longas por
   reservatório, usadas também pelas fichas. */
import { contexto } from "./contexto.js";
import { OS } from "./dados_embutidos.js";
import { $, $$, barraBaixar, barraData, caso, dBR, esc, fint, fmt, ligarData, ligarIndice } from "./base.js";
import { baixarCSVGrafico, baixarPNG, LEG_ANOS, pdfSecao, salvarCSV } from "./exportacao.js";
import { comoLer, graficoBarrasAnos, graficoCalendario, ler } from "./graficos.js";
import { diaEntre, entrarSis, isoMais, NOME_SIS } from "./outros.js";
import { miniOS } from "./cantareira.js";

const FOS = (OS && OS.fichas) || {};
const fimF = F => isoMais(F.de, F.cota.length - 1);
const valF = (F, campo, iso) => {
  const a = F[campo];
  if (!a) return null;
  const i = diaEntre(iso, F.de);
  return i >= 0 && i < a.length ? a[i] : null;
};
// leitura do dia; se faltar, a última até 7 dias antes, com a data (série diária com falhas pontuais)
function leituraF(F, campo, iso, lim = 7) {
  for (let k = 0; k <= lim; k++) {
    const d = isoMais(iso, -k),
      v = valF(F, campo, d);
    if (v != null) return { v, iso: d, dias: k };
  }
  return null;
}
const soNivelF = F => !F.pct;
const nomeRes = F => (F.sis === "cantareira" ? F.nome : caso(F.nome));
const PAGINA_SIS = { cantareira: "outros/cantareira", df: "outros/df", rmbh: "outros/rmbh" };
const abrirFichaOS = cod => {
  if (FOS[cod]) location.hash = "outros/ficha/" + cod;
};
function ligarDataOS(id, min, max, aplicar) {
  ligarData(id, min, max, iso => {
    contexto.refOS = iso;
    aplicar();
  });
}
// série diária de um campo num período, como pontos {t, v} para graficoLinhas
function pontosF(F, campos, de, ate) {
  const S = [],
    i0 = Math.max(0, diaEntre(de, F.de)),
    i1 = Math.min(F.cota.length - 1, diaEntre(ate, F.de));
  for (let i = i0; i <= i1; i++) {
    const o = { t: Date.parse(isoMais(F.de, i) + "T00:00:00Z") };
    campos.forEach(c => (o[c] = F[c] ? F[c][i] : null));
    S.push(o);
  }
  return S;
}
function pontosCal(F, campo, a0) {
  const o = {},
    i0 = Math.max(0, diaEntre(`${a0}-01-01`, F.de));
  for (let i = i0; i < F[campo].length; i++) o[isoMais(F.de, i)] = F[campo][i];
  return o;
}
function mesmoDiaF(F, campo, ref) {
  const mmdd = ref.slice(5) === "02-29" ? "02-28" : ref.slice(5),
    out = [];
  for (let a = +F.de.slice(0, 4); a <= +fimF(F).slice(0, 4); a++) {
    const iso = `${a}-${mmdd}`;
    if (iso < F.de || iso > fimF(F)) continue;
    out.push({ a, v: valF(F, campo, iso), rot: dBR(iso) });
  }
  return out;
}

/* ---------- páginas de DF e Paraopeba ---------- */
const TEXTO_SIS = {
  df: "Reservatórios que abastecem o Distrito Federal: Descoberto e Santa Maria, acompanhados pelo volume, e o Lago Paranoá, acompanhado pela cota.",
  rmbh: "Sistema Paraopeba: Rio Manso, Vargem das Flores e Serra Azul, que contribuem para o abastecimento da Região Metropolitana de Belo Horizonte."
};
function paginaSistemaOS(sis) {
  const pag = { sis }; // estado da página, passado às funções abaixo

  if (!OS) {
    location.hash = "inicio";
    return;
  }
  pag.L = Object.entries(FOS)
    .filter(([, F]) => F.sis === pag.sis)
    .map(([cod, F]) => ({ cod, F }));
  pag.ult = pag.L.map(x => fimF(x.F))
    .sort()
    .pop();
  pag.min = isoMais(pag.L.map(x => x.F.de).sort()[0], 366);
  entrarSis(pag.sis, pag.ult);
  if (contexto.refOS > pag.ult || contexto.refOS < pag.min) contexto.refOS = pag.ult;
  pag.comVol = pag.L.filter(x => !soNivelF(x.F));
  pag.soNiv = pag.L.filter(x => soNivelF(x.F));
  $("#titulo-pag").innerHTML = tituloSistemaOS(pag);
  $("#conteudo").innerHTML = corpoSistemaOS(pag);
  ligarIndice();
  ligarDataOS("dia-sis", pag.min, pag.ult, (...a) => desenharSistemaOS(pag, ...a));
  contexto.redesenharOS = (...a) => desenharSistemaOS(pag, ...a);
  desenharSistemaOS(pag);
  $("#baixar-sis-csv").onclick = () => {
    const ref = contexto.refOS;
    salvarCSV(
      ["reservatorio", "codigo", "data", "cota_m", "volume_hm3", "volume_pct", "capacidade_hm3"],
      pag.L.map(({ cod, F }) => {
        const c = leituraF(F, "cota", ref),
          p = soNivelF(F) ? null : leituraF(F, "pct", ref);
        return [nomeRes(F), cod, dBR(c ? c.iso : ref), c && c.v, p ? (p.v * F.cap) / 100 : null, p && p.v, F.cap];
      }),
      `sar_${pag.sis}_${ref}.csv`
    );
  };
  $("#baixar-sis-pdf").onclick = () =>
    pdfSecao([$("#tab-sis")], `sar_${pag.sis}_${contexto.refOS}.pdf`, { data: contexto.refOS });
  pag.nomeSis = NOME_SIS[pag.sis];
  ligarDownloadsSistemaOS(pag);
}

const tituloSistemaOS = pag =>
  `
    <p class="trilha"><a href="#inicio">Início</a><span class="sep">›</span><a href="#outros">Outros Sistemas Hídricos</a><span class="sep">›</span>${NOME_SIS[pag.sis]}</p>
    <h1>${NOME_SIS[pag.sis]}</h1>
    <p class="lead">${TEXTO_SIS[pag.sis]}</p>
    <div class="carimbo"><span>Dados mais recentes <b>${dBR(pag.ult)}</b></span><span>Base diária</span><span><b>${pag.comVol.length}</b> reservatórios com volume${pag.soNiv.length ? ` · <b>${pag.soNiv.length}</b> só com nível` : ""}</span><span>Série desde <b>${dBR(pag.L.map(x => x.F.de).sort()[0])}</b></span></div>
    ${barraData("dia-sis", contexto.refOS, pag.min, pag.ult, "Base diária. Tabela e gráficos seguem esta data.")}`;

const corpoSistemaOS = pag =>
  `
    <nav class="indice" aria-label="Seções da página">${[
      ["s-res", "Reservatórios"],
      ["s-ano", "Ao longo do ano"],
      ["s-dia", "Mesmo dia em outros anos"]
    ]
      .map(([id, r]) => `<a href="#${PAGINA_SIS[pag.sis]}" data-alvo="${id}">${r}</a>`)
      .join("")}</nav>
    <section class="cartao secao tabela-bacia" id="s-res" aria-labelledby="t-s-res">
      ${barraBaixar([
        ["baixar-sis-csv", "CSV", "Baixar a tabela do dia em CSV"],
        ["baixar-sis-pdf", "PDF", "Baixar a tabela do dia em PDF"]
      ])}
      <h2 id="t-s-res"><small>1</small><span>Reservatórios em <span id="s-res-dia"></span></span></h2>
      <p class="sub">Cada reservatório com o seu volume, sem volume equivalente do sistema.${pag.soNiv.length ? " O Lago Paranoá não tem capacidade cadastrada e aparece pela cota (só nível)." : ""} O minigráfico mostra os 12 meses até a data de referência.<span class="dica">Clique num reservatório para abrir a ficha.</span></p>
      <div class="tab-box"><table id="tab-sis">
        <thead><tr><th>Reservatório</th><th class="r">Nível</th><th class="r">Volume</th><th class="r">Volume</th><th class="r">Capacidade</th><th class="r">Em 30 dias</th><th class="mini-th">Últimos 12 meses</th></tr>
        <tr class="unid"><th></th><th class="r">m</th><th class="r">hm³</th><th class="r">%</th><th class="r">hm³</th><th class="r">p.p. ou m</th><th></th></tr></thead>
        <tbody id="corpo-sis"></tbody></table></div>
    </section>
    <section class="cartao secao" id="s-ano" aria-labelledby="t-s-ano">
      ${barraBaixar([
        ["baixar-sis-ano-csv", "CSV", "Baixar os dados dos gráficos em CSV"],
        ["baixar-sis-ano", "PNG", "Baixar os gráficos como imagem"]
      ])}
      <h2 id="t-s-ano"><small>2</small>Ao longo do ano</h2>
      <p class="sub">Volume (%) de cada reservatório dia a dia, nos cinco anos até a data de referência${pag.soNiv.length ? "; no Lago Paranoá, a cota (m)" : ""}.<span class="dica">Passe o mouse para comparar o mesmo dia nos cinco anos.</span></p>
      <div id="s-ano-graf"></div>
      ${comoLer("<b>Um gráfico por reservatório.</b> Cada reservatório tem o seu gráfico, com a mesma leitura.", ler("anos"), ler("cinco"), ler("cursor"))}
    </section>
    <section class="cartao secao" id="s-dia" aria-labelledby="t-s-dia">
      ${barraBaixar([
        ["baixar-sis-dia-csv", "CSV", "Baixar os dados dos gráficos em CSV"],
        ["baixar-sis-dia", "PNG", "Baixar os gráficos como imagem"]
      ])}
      <h2 id="t-s-dia"><small>3</small>Mesmo dia em outros anos</h2>
      <p class="sub">O valor de cada reservatório no dia da data de referência, em cada um dos cinco anos até ela.</p>
      <div id="s-dia-graf"></div>
      ${comoLer(ler("dia"), pag.soNiv.length ? "<b>Escala.</b> No volume em %, o eixo vertical vai de 0 a 100%; na cota, não começa em zero, para que as diferenças entre os anos fiquem visíveis." : "<b>Escala.</b> O eixo vertical vai de 0 a 100%.")}
    </section>
    <p class="nota">Fontes: ${esc(OS.fontes.coletor)}. Volume em % calculado pelo SAR: volume ÷ capacidade do cadastro. Conferência das cotas antes de exibir (erro grosseiro, pico de um dia e degrau que volta, como no Nordeste): ${pag.L.map(x => `${nomeRes(x.F)} ${fint(x.F.desc[0])}`).join(", ")} leituras descartadas na série inteira; o volume do mesmo dia sai junto.</p>`;

const desenharSistemaOS = pag => {
  const ref = contexto.refOS;
  $("#s-res-dia").textContent = dBR(ref);
  $("#corpo-sis").innerHTML = pag.L.map(({ cod, F }) => {
    const c = leituraF(F, "cota", ref),
      p = soNivelF(F) ? null : leituraF(F, "pct", ref);
    const c30 = valF(F, "cota", isoMais(ref, -30)),
      p30 = soNivelF(F) ? null : valF(F, "pct", isoMais(ref, -30));
    const d30 = soNivelF(F)
      ? c && c30 != null
        ? `${c.v - c30 >= 0 ? "+" : "−"}${fmt(Math.abs(c.v - c30), 2)} m`
        : "–"
      : p && p30 != null
        ? `${p.v - p30 >= 0 ? "+" : "−"}${fmt(Math.abs(p.v - p30), 1)} p.p.`
        : "–";
    const quando = c && c.dias ? `<span class="dias">leitura de ${dBR(c.iso)}</span>` : "";
    return `<tr data-cod="${cod}"><td><span class="nm">${esc(nomeRes(F))}</span><span class="rio">código ${cod}${soNivelF(F) ? " · só nível" : ""}</span>${quando}</td>
        <td class="r num">${fmt(c && c.v, 2)}</td><td class="r num">${p ? fmt((p.v * F.cap) / 100, 1) : "–"}</td><td class="r num">${p ? fmt(p.v, 1) : "–"}</td>
        <td class="r num">${F.cap ? fmt(F.cap, 2) : "–"}</td><td class="r num">${d30}</td><td class="mini" data-cod="${cod}"></td></tr>`;
  }).join("");
  $$("#corpo-sis td.mini").forEach(td => {
    const F = FOS[td.dataset.cod],
      campo = soNivelF(F) ? "cota" : "pct",
      i1 = diaEntre(ref, F.de);
    miniOS(td, (F[campo] || []).slice(Math.max(0, i1 - 365), i1 + 1));
    if (soNivelF(F)) td.title = "12 meses de cota (m); em vermelho, a data de referência";
  });
  $$("#corpo-sis tr").forEach(tr => (tr.onclick = () => abrirFichaOS(tr.dataset.cod)));
  const a1 = +ref.slice(0, 4),
    anos = [a1 - 4, a1 - 3, a1 - 2, a1 - 1, a1];
  const ate = o => Object.fromEntries(Object.entries(o).filter(([iso]) => iso <= ref)); // curva até a data de referência
  const hostA = $("#s-ano-graf"),
    hostD = $("#s-dia-graf");
  hostA.innerHTML = "";
  hostD.innerHTML = "";
  pag.L.forEach(({ F }) => {
    const campo = soNivelF(F) ? "cota" : "pct",
      u = soNivelF(F) ? "m" : "%";
    const g1 = document.createElement("div");
    g1.className = "graf";
    hostA.append(g1);
    graficoCalendario(g1, ate(pontosCal(F, campo, a1 - 4)), {
      rotCSV: nomeRes(F),
      anos,
      anoAtual: a1,
      dec: u === "m" ? 2 : 1,
      unidade: u,
      pct: u === "%",
      marcaDia: ref,
      altura: "apoio",
      maxVao: 3,
      tol: 2,
      rotulo: `${nomeRes(F)} · ${u === "%" ? "volume (%)" : "cota (m), só nível"}`
    });
    const g2 = document.createElement("div");
    g2.className = "graf";
    hostD.append(g2);
    graficoBarrasAnos(
      g2,
      mesmoDiaF(F, campo, ref).filter(d => d.a > a1 - 5 && d.a <= a1),
      {
        rotCSV: nomeRes(F),
        anoAtual: +ref.slice(0, 4),
        dec: u === "m" ? 2 : 1,
        unidade: u,
        pct: u === "%",
        relativo: u === "m",
        altura: "apoio",
        rotulo: `${nomeRes(F)} em ${dBR(ref).slice(0, 5)} de cada ano (${u === "%" ? "volume, %" : "cota, m"})`,
        legenda: u === "%" ? "Volume" : "Cota"
      }
    );
  });
};

const ligarDownloadsSistemaOS = pag => {
  $("#baixar-sis-ano").onclick = () =>
    baixarPNG(
      $$("#s-ano-graf svg"),
      `sar_${pag.sis}_ao_longo_do_ano_ate_${contexto.refOS}.png`,
      `${pag.nomeSis} · ao longo do ano · até ${dBR(contexto.refOS)}`,
      LEG_ANOS(+contexto.refOS.slice(0, 4))
    );
  $("#baixar-sis-dia").onclick = () =>
    baixarPNG(
      $$("#s-dia-graf svg"),
      `sar_${pag.sis}_mesmo_dia_${contexto.refOS}.png`,
      `${pag.nomeSis} · ${dBR(contexto.refOS).slice(0, 5)} de cada ano`,
      []
    );
  $("#baixar-sis-ano-csv").onclick = () =>
    baixarCSVGrafico(
      $$("#s-ano-graf .graf"),
      `sar_${pag.sis}_ao_longo_do_ano_ate_${contexto.refOS}.csv`,
      "reservatorio"
    );
  $("#baixar-sis-dia-csv").onclick = () =>
    baixarCSVGrafico($$("#s-dia-graf .graf"), `sar_${pag.sis}_mesmo_dia_${contexto.refOS}.csv`, "reservatorio");
};

export {
  abrirFichaOS,
  fimF,
  FOS,
  leituraF,
  ligarDataOS,
  mesmoDiaF,
  nomeRes,
  PAGINA_SIS,
  paginaSistemaOS,
  pontosCal,
  pontosF,
  soNivelF,
  valF
};
