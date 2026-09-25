/* Ficha do reservatório de Outros Sistemas Hídricos (#outros/<sistema>/<código>): Cantareira, Distrito
   Federal e Paraopeba. */
import { contexto } from "./contexto.js";
import { CAN, OS } from "./dados_embutidos.js";
import { $, $$, barraBaixar, barraData, COR, dBR, esc, fint, fmt, ligarIndice } from "./base.js";
import { baixarCSVGrafico, baixarPNG, LEG_ANOS, salvarCSV } from "./exportacao.js";
import { botoesAnos, comoLer, graficoBarrasAnos, graficoCalendario, graficoLinhas, ler, MAX_ANOS } from "./graficos.js";
import { qtd } from "./ne_estados.js";
import { detCan, entrarSis, isoMais, NOME_SIS } from "./outros.js";
import {
  fimF,
  FOS,
  leituraF,
  ligarDataOS,
  mesmoDiaF,
  nomeRes,
  PAGINA_SIS,
  pontosCal,
  pontosF,
  soNivelF,
  valF
} from "./outros_sistemas.js";

// Cantareira: o que entra e o que sai de cada reservatório além da vazão natural e da descarga para jusante
// (topologia conferida pelo balanço de massa, estrutura/outros_sistemas.md)
const LIGA_CAN = {
  JaguariJacarei: { ent: [], sai: ["T7"] },
  Cachoeira: { ent: ["T7"], sai: ["T6"] },
  Atibainha: { ent: ["T6", "TransfParaibaDoSul"], sai: ["T5"] },
  PaivaCastro: { ent: ["T5"], sai: ["ESI"] }
};
const NOME_VAZ = {
  T5: "Túnel 5",
  T6: "Túnel 6",
  T7: "Túnel 7",
  TransfParaibaDoSul: "Transferência do Paraíba do Sul",
  ESI: "Santa Inês"
};
function paginaFichaOS(cod) {
  const pag = { cod }; // estado da página, passado às funções abaixo

  pag.F = FOS[pag.cod];
  if (!pag.F) {
    location.hash = "outros";
    return;
  }
  pag.ult = fimF(pag.F);
  pag.niv = soNivelF(pag.F);
  pag.campo = pag.niv ? "cota" : "pct";
  pag.can = pag.F.sis === "cantareira";
  pag.RC = pag.can ? CAN.res.find(r => r.k === pag.F.k) : null;
  pag.liga = pag.can ? LIGA_CAN[pag.F.k] : null;
  entrarSis(pag.F.sis, pag.ult);
  if (contexto.refOS > pag.ult || contexto.refOS < pag.F.de) contexto.refOS = pag.ult;
  pag.nome = nomeRes(pag.F);
  $("#titulo-pag").innerHTML = tituloFichaOS(pag);
  pag.secoes = [
    ["fo-sit", "Situação"],
    ["fo-graf", "Gráficos"],
    ["fo-dia", "Mesmo dia em outros anos"],
    ["fo-ano", "Ano contra anos anteriores"]
  ];
  pag.rot = pag.niv ? "Cota (m)" : "Volume (%)";
  $("#conteudo").innerHTML = corpoFichaOS(pag);
  ligarIndice();

  // 2. gráficos
  const presets = [
    ["1 ano", 365],
    ["5 anos", 1826],
    ["Tudo", 0]
  ];
  $("#fo-presets").innerHTML = presets
    .map(([r, n], i) => `<button type="button" class="preset${i === 0 ? " ativo" : ""}" data-n="${n}">${r}</button>`)
    .join("");
  ["fo-de", "fo-ate"].forEach(id => {
    $("#" + id).min = pag.F.de;
    $("#" + id).max = pag.ult;
  });
  $$("#fo-presets .preset").forEach(
    b =>
      (b.onclick = () => {
        $$("#fo-presets .preset").forEach(x => x.classList.toggle("ativo", x === b));
        aplicarFichaOS(pag, +b.dataset.n);
      })
  );
  $("#fo-de").onchange = $("#fo-ate").onchange = () => {
    $$("#fo-presets .preset").forEach(x => x.classList.remove("ativo"));
    graficos(pag);
  };
  // 4. ano contra anos anteriores
  const a1 = +pag.ult.slice(0, 4);
  pag.todosAnos = [];
  for (let a = +pag.F.de.slice(0, 4); a <= a1; a++) pag.todosAnos.push(a);
  pag.estAnos = {}; // botões de ano (botoesAnos: padrão, os cinco até a data de referência)
  ligarDataOS("dia-fos", pag.F.de, pag.ult, (...a) => tudo(pag, ...a));
  contexto.redesenharOS = () => {
    tudo(pag);
    graficos(pag);
  };
  tudo(pag);
  aplicarFichaOS(pag, 365);
  ligarDownloadsFichaOS(pag);
}

const tituloFichaOS = pag =>
  `
    <p class="trilha"><a href="#inicio">Início</a><span class="sep">›</span><a href="#outros">Outros Sistemas Hídricos</a><span class="sep">›</span><a href="#${PAGINA_SIS[pag.F.sis]}">${NOME_SIS[pag.F.sis]}</a><span class="sep">›</span>${esc(pag.nome)}</p>
    <h1>${esc(pag.nome)}</h1>
    <p class="lead">${pag.can ? `Reservatório do Sistema Cantareira (Resolução Conjunta ANA/DAEE nº 925/2017), com ${fmt(pag.F.cap, 2)} hm³ de volume útil operacional.` : pag.niv ? `Reservatório do ${NOME_SIS[pag.F.sis]}, acompanhado pela cota: sem capacidade cadastrada, não há volume.` : `Reservatório do ${pag.F.sis === "df" ? "Distrito Federal" : "Sistema Paraopeba"}, com ${fmt(pag.F.cap, 2)} hm³ de capacidade.`}</p>
    <div class="carimbo"><span>Código SAR <b>${pag.cod}</b></span><span>Dados mais recentes <b>${dBR(pag.ult)}</b></span><span>Base diária desde <b>${dBR(pag.F.de)}</b></span>${pag.can ? `<span>Fonte <b>SABESP</b></span>` : ""}</div>
    ${barraData("dia-fos", contexto.refOS, pag.F.de, pag.ult, "Base diária. Situação e mesmo dia em outros anos seguem esta data.")}`;

const corpoFichaOS = pag =>
  `
    <nav class="indice" aria-label="Seções da página">${pag.secoes.map(([id, r]) => `<a href="#outros/ficha/${pag.cod}" data-alvo="${id}">${r}</a>`).join("")}</nav>
    <section class="cartao secao" id="fo-sit" aria-labelledby="t-fo-sit">
      <h2 id="t-fo-sit"><small>1</small><span>Situação em <span id="fo-sit-dia"></span></span></h2>
      <p class="sub">Base diária, na data de referência (o padrão são os dados mais recentes).${pag.can ? " Vazões médias do dia, em m³/s." : ""}<span class="dica">Mude a data de referência para ver outro dia.</span></p>
      <div class="valores" id="fo-valores"></div>
    </section>
    <section class="cartao secao" id="fo-graf" aria-labelledby="t-fo-graf">
      ${barraBaixar([
        ["baixar-fo-csv", "CSV", "Baixar a série do período em CSV"],
        ["baixar-fo-png", "PNG", "Baixar os gráficos como imagem"]
      ])}
      <h2 id="t-fo-graf"><small>2</small>Gráficos</h2>
      <p class="sub">${pag.niv ? "Cota diária." : "Volume e nível no mesmo eixo de tempo."}${pag.can ? ` Abaixo, as vazões do reservatório (desde ${dBR(CAN.det_de)} no protótipo).` : ""}<span class="dica">Escolha o período; passe o mouse para ler os valores.</span></p>
      <div class="controles painel"><fieldset class="largo"><legend>Período</legend><span id="fo-presets" class="presets"></span><span class="datas"><label>de <input type="date" id="fo-de"></label><label>até <input type="date" id="fo-ate"></label></span></fieldset></div>
      <div class="graf" id="fo-g1"></div><div class="graf" id="fo-g2"></div><div class="legenda" id="fo-leg3" style="margin-top:18px"></div><div class="graf" id="fo-g3" style="margin-top:4px"></div>
      <p class="nota" id="fo-resumo" style="margin:12px 0 0"></p>
      ${comoLer(
        pag.niv
          ? "<b>Valores.</b> Com o cursor sobre o gráfico, o balão mostra a cota do dia."
          : "<b>Eixo do tempo.</b> O volume e o nível compartilham o eixo do tempo: com o cursor sobre um deles, a mesma data é marcada nos dois, e o balão mostra os valores. O volume é apresentado de 0 a 100%.",
        pag.can
          ? "<b>Vazões.</b> As vazões do reservatório ficam em gráfico próprio, abaixo, para que nenhum gráfico tenha dois eixos verticais."
          : ""
      )}
    </section>
    <section class="cartao secao" id="fo-dia" aria-labelledby="t-fo-dia">
      ${barraBaixar([
        ["baixar-fo-dia-csv", "CSV", "Baixar os dados do gráfico em CSV"],
        ["baixar-fo-dia", "PNG", "Baixar o gráfico como imagem"]
      ])}
      <h2 id="t-fo-dia"><small>3</small>Mesmo dia em outros anos</h2>
      <p class="sub">${pag.niv ? "Cota" : "Volume (%)"} no dia da data de referência, em cada ano da série diária.</p>
      <div class="graf" id="fo-g-dia"></div>
      ${comoLer(ler("dia"), pag.niv ? "<b>Escala.</b> Na cota, o eixo vertical não começa em zero, para que as diferenças entre os anos fiquem visíveis." : "<b>Escala.</b> O eixo vertical vai de 0 a 100%.")}
    </section>
    <section class="cartao secao" id="fo-ano" aria-labelledby="t-fo-ano">
      ${barraBaixar([
        ["baixar-fo-ano-csv", "CSV", "Baixar os dados do gráfico em CSV"],
        ["baixar-fo-ano", "PNG", "Baixar o gráfico como imagem"]
      ])}
      <h2 id="t-fo-ano"><small>4</small>Ano contra anos anteriores</h2>
      <p class="sub">A série diária de cada ano sobreposta no mesmo calendário, até a data de referência.<span class="dica">Selecione os anos a comparar, até ${MAX_ANOS} simultaneamente; posicione o cursor sobre o gráfico para ler o mesmo dia em cada ano.</span></p>
      <div class="controles"><fieldset class="anos"><legend>Anos <span class="nota" id="fo-nota-anos"></span></legend><span id="fo-chips"></span></fieldset></div>
      <div class="graf" id="fo-g-ano"></div>
      ${comoLer(ler("anos"), ler("selecao"), ler("cursor"))}
    </section>
    <p class="nota">Fontes: ${esc(pag.can ? OS.fontes.sabesp : OS.fontes.coletor)}${pag.can ? `; ${esc(OS.fontes.resolucao)}` : ""}. ${pag.niv ? "" : pag.can ? "Volume em % sobre o volume útil operacional do reservatório no quadro da resolução, como informado pela SABESP. " : "Volume em % calculado pelo SAR: volume ÷ capacidade do cadastro. "}Conferência das cotas antes de exibir (erro grosseiro, pico de um dia e degrau que volta, como no Nordeste): ${qtd(pag.F.desc[0], "leitura descartada", "leituras descartadas")} na série inteira; o volume do mesmo dia sai junto.</p>`;

// 1. situação
function situacaoFichaOS(pag) {
  const ref = contexto.refOS;
  $("#fo-sit-dia").textContent = dBR(ref);
  const c = leituraF(pag.F, "cota", ref),
    p = pag.niv ? null : leituraF(pag.F, "pct", ref);
  const dl = (a, b, n, u) => (a == null || b == null ? "–" : `${a - b >= 0 ? "+" : "−"}${fmt(Math.abs(a - b), n)}${u}`);
  const antes = (cp, n) => valF(pag.F, cp, isoMais(ref, -n)),
    ant = `${+ref.slice(0, 4) - 1}${ref.slice(4)}`;
  const quando = x => (x && x.dias ? `<div class="c"><span>leitura de ${dBR(x.iso)}</span></div>` : "");
  let h = pag.niv
    ? `<div class="v principal"><div class="r">Cota (só nível)</div><div class="n num">${fmt(c && c.v, 2)}<small>m</small></div>
          <div class="c"><span>há 7 dias <b class="num">${dl(c && c.v, antes("cota", 7), 2, " m")}</b></span><span>há 30 dias <b class="num">${dl(c && c.v, antes("cota", 30), 2, " m")}</b></span><span>mesmo dia de ${ant.slice(0, 4)} <b class="num">${fmt(valF(pag.F, "cota", ant), 2)} m</b></span></div>${quando(c)}</div>`
    : `<div class="v principal"><div class="r">Volume${pag.can ? " útil" : ""}</div><div class="n num">${fmt(p && p.v, 1)}<small>%</small></div>
          <div class="c"><span>há 7 dias <b class="num">${dl(p && p.v, antes("pct", 7), 1, " p.p.")}</b></span><span>há 30 dias <b class="num">${dl(p && p.v, antes("pct", 30), 1, " p.p.")}</b></span><span>mesmo dia de ${ant.slice(0, 4)} <b class="num">${fmt(valF(pag.F, "pct", ant), 1)}%</b></span></div>${quando(p)}</div>
         <div class="v"><div class="r">Nível</div><div class="n num">${fmt(c && c.v, 2)}<small>m</small></div><div class="c"><span>há 7 dias <b class="num">${dl(c && c.v, antes("cota", 7), 2, " m")}</b></span></div></div>
         <div class="v"><div class="r">Volume</div><div class="n num">${p ? fmt((p.v * pag.F.cap) / 100, 1) : "–"}<small>hm³</small></div><div class="c"><span>de ${fmt(pag.F.cap, 2)} hm³</span></div></div>`;
  if (pag.can && ref >= CAN.det_de) {
    const v = arr => detCan(arr, ref),
      soma = ks => ks.reduce((a, k) => a + (v(CAN.vaz[k]) ?? 0), 0);
    h += `<div class="v"><div class="r">Afluente natural</div><div class="n num">${fmt(v(pag.RC.qnat), 1)}<small>m³/s</small></div></div>
        <div class="v"><div class="r">Para jusante</div><div class="n num">${fmt(v(pag.RC.qjus), 2)}<small>m³/s</small></div></div>
        ${pag.liga.ent.length ? `<div class="v"><div class="r">Recebe</div><div class="n num">${fmt(soma(pag.liga.ent), 1)}<small>m³/s</small></div><div class="c"><span>${pag.liga.ent.map(k => `${NOME_VAZ[k]} ${fmt(v(CAN.vaz[k]), 1)}`).join(" · ")}</span></div></div>` : ""}
        <div class="v"><div class="r">Envia por</div><div class="n num">${fmt(soma(pag.liga.sai), 1)}<small>m³/s</small></div><div class="c"><span>${pag.liga.sai.map(k => NOME_VAZ[k]).join(", ")}${pag.F.k === "PaivaCastro" ? " (para a RMSP)" : ""}</span></div></div>`;
  }
  $("#fo-valores").innerHTML = h;
}

const aplicarFichaOS = (pag, n) => {
  $("#fo-ate").value = pag.ult;
  $("#fo-de").value = n ? (isoMais(pag.ult, -n + 1) < pag.F.de ? pag.F.de : isoMais(pag.ult, -n + 1)) : pag.F.de;
  graficos(pag);
};

function graficos(pag) {
  let de = $("#fo-de").value || pag.F.de,
    ate = $("#fo-ate").value || pag.ult;
  if (de > ate) [de, ate] = [ate, de];
  const t0 = Date.parse(de + "T00:00:00Z"),
    t1 = Date.parse(ate + "T00:00:00Z"),
    sync = {};
  const S = pontosF(pag.F, pag.niv ? ["cota"] : ["pct", "cota"], de, ate);
  if (pag.niv) {
    graficoLinhas($("#fo-g1"), S, [{ k: "cota", r: "Cota", cor: COR.nivel, u: "m", dec: 2 }], {
      base: "dia",
      unidade: "m",
      altura: "principal",
      sync,
      t0,
      t1,
      rotulo: "Cota (m)"
    });
    $("#fo-g2").innerHTML = "";
  } else {
    graficoLinhas($("#fo-g1"), S, [{ k: "pct", r: "Volume", cor: COR.ana, u: "%", dec: 1 }], {
      base: "dia",
      unidade: "%",
      altura: "principal",
      sync,
      t0,
      t1,
      escala: [0, 100],
      rotulo: "Volume (%)"
    });
    graficoLinhas($("#fo-g2"), S, [{ k: "cota", r: "Nível", cor: COR.nivel, u: "m", dec: 2 }], {
      base: "dia",
      unidade: "m",
      altura: "apoio",
      sync,
      t0,
      t1,
      rotulo: "Nível (m)"
    });
  }
  if (pag.can) {
    const d0 = de < CAN.det_de ? CAN.det_de : de,
      V = [];
    for (let iso = d0; iso <= ate; iso = isoMais(iso, 1)) {
      const o = { t: Date.parse(iso + "T00:00:00Z"), nat: detCan(pag.RC.qnat, iso), jus: detCan(pag.RC.qjus, iso) };
      o.ent = pag.liga.ent.length ? pag.liga.ent.reduce((a, k) => a + (detCan(CAN.vaz[k], iso) ?? 0), 0) : null;
      o.sai = pag.liga.sai.reduce((a, k) => a + (detCan(CAN.vaz[k], iso) ?? 0), 0);
      V.push(o);
    }
    const SV = [
      { k: "nat", r: "Afluente natural", cor: COR.azulMedio, u: "m³/s", dec: 1 },
      ...(pag.liga.ent.length
        ? [
            {
              k: "ent",
              r: `Recebe (${pag.liga.ent.map(k => NOME_VAZ[k]).join(" + ")})`,
              cor: "#8A6A2E",
              u: "m³/s",
              dec: 1
            }
          ]
        : []),
      { k: "sai", r: `Envia (${pag.liga.sai.map(k => NOME_VAZ[k]).join(" + ")})`, cor: COR.ana, u: "m³/s", dec: 1 },
      { k: "jus", r: "Para jusante", cor: COR.nivel, u: "m³/s", dec: 2, tracejado: true }
    ];
    $("#fo-leg3").innerHTML = SV.map(
      s =>
        `<span><svg width="22" height="8" aria-hidden="true"><line x1="0" x2="22" y1="4" y2="4" stroke="${s.cor}" stroke-width="2"${s.tracejado ? ' stroke-dasharray="5 4"' : ""}/></svg>${esc(s.r)}</span>`
    ).join("");
    graficoLinhas($("#fo-g3"), V, SV, {
      base: "dia",
      unidade: "m³/s",
      altura: "apoio",
      sync: {},
      t0: Date.parse(d0 + "T00:00:00Z"),
      t1,
      rotulo: "Vazões do reservatório (m³/s)"
    });
  } else {
    $("#fo-g3").innerHTML = "";
    $("#fo-leg3").innerHTML = "";
  }
  const n = S.filter(o => o.cota != null).length;
  $("#fo-resumo").textContent = `${fint(n)} dias com ${pag.niv ? "cota" : "nível"} de ${dBR(de)} a ${dBR(ate)}.`;
}

// 3. mesmo dia
function mesmoDiaFichaOS(pag) {
  graficoBarrasAnos($("#fo-g-dia"), mesmoDiaF(pag.F, pag.campo, contexto.refOS), {
    anoAtual: +contexto.refOS.slice(0, 4),
    dec: pag.niv ? 2 : 1,
    unidade: pag.niv ? "m" : "%",
    pct: !pag.niv,
    relativo: pag.niv,
    legenda: pag.niv ? "Cota" : "Volume",
    rotulo: `${pag.nome} em ${dBR(contexto.refOS).slice(0, 5)} de cada ano (${pag.niv ? "cota, m" : "volume, %"})`
  });
}

function anos(pag) {
  const aR = +contexto.refOS.slice(0, 4),
    sel = botoesAnos($("#fo-chips"), $("#fo-nota-anos"), pag.todosAnos, pag.estAnos, aR, (...a) => anos(pag, ...a));
  const pts = Object.fromEntries(
    Object.entries(pontosCal(pag.F, pag.campo, sel[0])).filter(([iso]) => iso <= contexto.refOS)
  ); // a curva termina na data de referência
  graficoCalendario($("#fo-g-ano"), pts, {
    anos: sel,
    anoAtual: aR,
    dec: pag.niv ? 2 : 1,
    unidade: pag.niv ? "m" : "%",
    pct: !pag.niv,
    marcaDia: contexto.refOS,
    maxVao: 3,
    tol: 2,
    rotulo: `${pag.nome} · ${pag.rot}`
  });
}

const tudo = pag => {
  situacaoFichaOS(pag);
  mesmoDiaFichaOS(pag);
  anos(pag);
};

const ligarDownloadsFichaOS = pag => {
  $("#baixar-fo-png").onclick = () =>
    baixarPNG(
      [...$$("#fo-graf .graf svg")],
      `sar_${pag.cod}_graficos.png`,
      `${pag.nome} · ${dBR($("#fo-de").value)} a ${dBR($("#fo-ate").value)}`,
      []
    );
  $("#baixar-fo-dia-csv").onclick = () =>
    baixarCSVGrafico([$("#fo-g-dia")], `sar_${pag.cod}_mesmo_dia_${contexto.refOS}.csv`);
  $("#baixar-fo-ano").onclick = () =>
    baixarPNG(
      [$("#fo-g-ano svg")],
      `sar_${pag.cod}_ano_contra_anos_${contexto.refOS}.png`,
      `${pag.nome} · ${pag.niv ? "cota" : "volume"} ao longo do ano`,
      []
    );
  $("#baixar-fo-ano-csv").onclick = () =>
    baixarCSVGrafico([$("#fo-g-ano")], `sar_${pag.cod}_ano_contra_anos_${contexto.refOS}.csv`);
  $("#baixar-fo-dia").onclick = () =>
    baixarPNG(
      [$("#fo-g-dia svg")],
      `sar_${pag.cod}_mesmo_dia_${contexto.refOS}.png`,
      `${pag.nome} em ${dBR(contexto.refOS).slice(0, 5)} de cada ano`,
      LEG_ANOS(+contexto.refOS.slice(0, 4))
    );
  $("#baixar-fo-csv").onclick = () => {
    const de = $("#fo-de").value || pag.F.de,
      ate = $("#fo-ate").value || pag.ult,
      S = pontosF(pag.F, pag.niv ? ["cota"] : ["pct", "cota"], de, ate);
    // no Cantareira, também as vazões do gráfico: natural, para jusante e as ligações do reservatório (catálogo de variáveis)
    const COL_VAZ = {
      T5: "tunel_5_m3s",
      T6: "tunel_6_m3s",
      T7: "tunel_7_m3s",
      TransfParaibaDoSul: "transferencia_paraiba_do_sul_m3s",
      ESI: "retirada_santa_ines_m3s"
    };
    const lig = pag.can ? [...pag.liga.ent, ...pag.liga.sai] : [];
    salvarCSV(
      pag.niv
        ? ["data", "cota_m"]
        : [
            "data",
            "volume_pct",
            "volume_hm3",
            "cota_m",
            ...(pag.can ? ["vazao_natural_m3s", "descarga_jusante_m3s", ...lig.map(k => COL_VAZ[k])] : [])
          ],
      S.map(o => {
        const iso = new Date(o.t).toISOString().slice(0, 10),
          d = dBR(iso);
        if (pag.niv) return [d, o.cota];
        const l = [d, o.pct, o.pct == null ? null : (o.pct * pag.F.cap) / 100, o.cota];
        return pag.can
          ? l.concat([detCan(pag.RC.qnat, iso), detCan(pag.RC.qjus, iso), ...lig.map(k => detCan(CAN.vaz[k], iso))])
          : l;
      }),
      `sar_${pag.cod}_${de}_${ate}.csv`
    );
  };
};

export { paginaFichaOS };
