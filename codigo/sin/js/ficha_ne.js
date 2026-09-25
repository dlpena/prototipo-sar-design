/* Ficha do açude do Nordeste e Semiárido (#ne/ficha/<código>): situação na data com o mapa dos vizinhos, série
   no período, mesmo dia em outros anos e ano contra anos anteriores, em volume (%), volume (hm³) ou cota, com a
   capacidade e a cota máxima como linhas de referência. */
import { contexto } from "./contexto.js";
import { faixaPct, FOLGA30, medicaoNaJanela } from "./regras.js";
import { NEd } from "./dados_embutidos.js";
import { $, $$, barraBaixar, caso, COR, COR_NV, dBR, esc, fint, fmt, ligarIndice, svgEl, toast } from "./base.js";
import { baixarArquivo, baixarCSVGrafico, baixarPNG, LEG_ANOS } from "./exportacao.js";
import {
  botoesAnos,
  comoLer,
  graficoBarrasAnos,
  graficoCalendario,
  graficoLinhas,
  graficoMonitoramento,
  ler,
  MAX_ANOS,
  VAO_MAX
} from "./graficos.js";
import { dDias, ESTACOES_NV, FORA_VOLUME, FX, ligarSeletor, resNa, seletorData, temPagina } from "./ne.js";
import { icoNV, LIM_EST, mapaResNE, nivelNa, qtd, sinal } from "./ne_estados.js";

const VNE = {
  pct: { r: "Volume", u: "%", dec: 1, cor: COR.nivel },
  hm3: { r: "Volume", u: "hm³", dec: 1, cor: COR.nivel },
  cota: { r: "Cota", u: "m", dec: 2, cor: COR.nivel },
  nivel: { r: "Nível", u: "m", dec: 2, cor: COR_NV }
};
const diaAbs = iso => Math.round(Date.parse(iso + "T00:00:00Z") / 864e5);
const isoAbs = d => new Date(d * 864e5).toISOString().slice(0, 10);

// leitura mais próxima de uma data que tenha o valor k, até lim dias antes ou depois (regra do portal);
// no empate entre uma antes e outra depois, vale a anterior, como em resNa e nivelNa (Diego, 21/09/2026)
function leituraNa(A, k, iso, lim) {
  const alvo = diaAbs(iso),
    j = medicaoNaJanela(
      A,
      alvo,
      lim,
      x => x.d,
      x => x[k] != null
    );
  return j < 0 ? null : { ...A[j], v: A[j][k], dias: alvo - A[j].d };
}
function abrirFichaNE(r) {
  const cod = r && (r.codigo || (r._st && r._st.codigo));
  if (cod && NEd.fichas && NEd.fichas[cod]) location.hash = "ne/ficha/" + cod;
  else toast(`Ficha de ${caso(r.nome)}: no protótipo estão montadas as de Castanhão, Jenipapeiro (Buiu) e Salinas.`);
}

function paginaFichaNE(cod) {
  const pag = { cod }; // estado da página, passado às funções abaixo

  pag.F = NEd.fichas && NEd.fichas[pag.cod];
  if (!pag.F) {
    location.hash = "ne";
    return;
  }
  pag.soNivel = pag.F.modo === "nivel";
  pag.LIM = NEd.limiar_dias;
  pag.anoFim = +NEd.serie_ate.slice(0, 4);
  pag.SR = pag.F.serie.map(([iso, cota, hm3, pct]) => ({ ...linhaDiaFichaNE(iso), cota, hm3, pct }));
  pag.SN = pag.soNivel ? pag.F.nivel.serie.map(([iso, v]) => ({ ...linhaDiaFichaNE(iso), nivel: v })) : [];
  pag.ultVol = [...pag.SR].reverse().find(o => o.pct != null);
  pag.inicio = [pag.SR[0] && pag.SR[0].iso, pag.SN[0] && pag.SN[0].iso].filter(Boolean).sort()[0];
  if (contexto.dataRef < pag.inicio) contexto.dataRef = pag.inicio;
  if (contexto.dataRef > NEd.serie_ate) contexto.dataRef = NEd.serie_ate;
  pag.nomeF = caso(pag.F.nome);
  pag.varsGraf = pag.soNivel ? [] : ["pct", "hm3", "cota"];
  pag.varsComp = pag.soNivel ? ["nivel", "pct"] : ["pct", "hm3", "cota"];
  $("#titulo-pag").innerHTML = tituloFichaNE(pag);
  $("#conteudo").innerHTML = corpoFichaNE(pag);
  ligarIndice();

  pag.MR = mapaResNE($("#mapa-ficha"), [pag.F.uf], { recolhido: true });
  pag.alvoMapa = L.circleMarker([pag.F.lat, pag.F.lon], {
    radius: 15,
    color: COR.ana,
    weight: 2.5,
    fill: false,
    interactive: false
  });
  const viz = mapaVizinhos(pag);
  pag.MR.mapa.fitBounds(L.latLngBounds(viz.map(r => [r.lat, r.lon]).concat([[pag.F.lat, pag.F.lon]])).pad(0.2), {
    maxZoom: 11
  });

  // 2. gráfico
  const presets = [
    ["1 ano", 365],
    ["5 anos", 1826],
    ["Tudo", 0]
  ];
  $("#presets").innerHTML = presets
    .map(([r, n], i) => `<button type="button" class="preset${i === 1 ? " ativo" : ""}" data-n="${n}">${r}</button>`)
    .join("");
  ["g-de", "g-ate"].forEach(id => {
    $("#" + id).min = pag.inicio;
    $("#" + id).max = NEd.serie_ate;
  });
  ligarControlesGraficoFichaNE(pag);
  const hist = {};
  for (let a = +pag.inicio.slice(0, 4); a <= pag.anoFim; a++)
    hist[a] = {
      sar: pag.SR.filter(o => o.iso.startsWith(String(a))).length,
      hidro: pag.soNivel ? pag.SN.filter(o => o.iso.startsWith(String(a))).length : null
    };
  graficoMonitoramento($("#g-med"), hist, "Medições por ano", {
    altura: "apoio",
    ate: NEd.data,
    rot: { sar: "leituras com volume", hidro: "leituras de nível" }
  });

  // 3. mesmo dia em outros anos (regra dos 30 dias em cada ano)
  $("#var-dia-f").onchange = (...a) => mesmoDiaFichaNE(pag, ...a);

  // 4. ano contra anos anteriores
  // botões de ano (botoesAnos: padrão, os cinco até a data de referência; a troca de variável volta ao padrão)
  pag.anosSel = new Set();
  pag.estAnos = {};
  $("#var-ano-f").onchange = () => {
    pag.estAnos = {}; // outra variável: volta ao padrão
    montarChips(pag);
    anoAnos(pag);
  };

  // fontes e conferência
  const Dc = pag.F.descartes,
    Ni = pag.F.nao_informados;
  $("#fontes-f").innerHTML =
    `Fontes: ${esc(NEd.fontes.ficha_sar)}${pag.soNivel ? "; " + esc(NEd.fontes.ficha_nivel) : ""}; ${esc(NEd.fontes.regra)}. ` +
    `Conferência das leituras antes de exibir: na cota, ${qtd(Dc.cota.length, "descartada", "descartadas")} e ${fint(Ni.cota)} sem cota informada (zero ou vazia); ` +
    `no volume, ${qtd(Dc.volume.length, "descartada", "descartadas")}` +
    `${pag.soNivel ? `; no nível, ${qtd(pag.F.nivel.descartes.length, "descartada", "descartadas")}` : ""}. Vizinhos no mapa: ${esc(NEd.fontes.medicoes)}.`;

  ligarSeletor("data-f", (...a) => aplicarFichaNE(pag, ...a), pag.inicio, NEd.serie_ate);
  situacaoFichaNE(pag);
  aplicarPresetFichaNE(pag, presets[1][1]);
  mesmoDiaFichaNE(pag);
  montarChips(pag);
  anoAnos(pag);

  pag.u = pag.F.nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "_");
  ligarDownloadsFichaNE(pag);
}

const linhaDiaFichaNE = iso => ({ iso, d: diaAbs(iso), t: Date.parse(iso + "T00:00:00Z") });

const serieDe = (pag, k) => (k === "nivel" ? pag.SN : pag.SR);

const rotVar = (pag, k) => (pag.soNivel && k === "pct" ? "Volume" : VNE[k].r);

// referências (Diego, 25/09/2026): capacidade no volume em hm³ e cota máxima na cota, esta só quando cadastrada
const refsDe = (pag, k) =>
  k === "hm3"
    ? [{ v: pag.F.capacidade_hm3, rot: "Capacidade" }]
    : k === "cota"
      ? [{ v: pag.F.cota_maxima_m ?? null, rot: "Cota máxima" }]
      : [];

const semCotaMax = (pag, k) =>
  k === "cota" && pag.F.cota_maxima_m == null
    ? " A cota máxima deste açude não está cadastrada no SAR: a linha aparece quando a CORSH cadastrar o valor."
    : "";

const legRefs = (pag, k) =>
  refsDe(pag, k)
    .filter(r => r.v != null)
    .map(r => ({ r: `${r.rot} (${fmt(r.v, VNE[k].dec)} ${VNE[k].u})`, cor: COR.tinta2, tracejado: true }));

const opcao = (pag, k) => `<option value="${k}">${rotVar(pag, k)} (${VNE[k].u})</option>`;

const tituloFichaNE = pag =>
  `
    <p class="trilha"><a href="#inicio">Início</a><span class="sep">›</span><a href="#ne">Nordeste e Semiárido</a><span class="sep">›</span>${temPagina(pag.F.uf) ? `<a href="#ne/${pag.F.uf}">${pag.F.estado}</a>` : pag.F.estado}<span class="sep">›</span>${pag.nomeF}</p>
    <h1>${pag.nomeF}</h1>
    <p class="lead">Açude em ${esc(caso(pag.F.municipio || "–"))}, bacia ${esc(caso(pag.F.bacia || "–"))}, ${pag.F.estado}.${pag.soNivel ? " Hoje tem só a leitura de nível: não há curva cota-volume validada para calcular o volume." : ""}</p>
    <div class="carimbo"><span>Código SAR <b>${pag.F.codigo}</b></span><span>Capacidade <b>${fmt(pag.F.capacidade_hm3, 1)} hm³</b></span>
      <span>${pag.soNivel ? "Volume" : "Medições"} de <b>${dBR(pag.SR[0].iso)}</b> a <b>${dBR(pag.SR[pag.SR.length - 1].iso)}</b> · ${fint(pag.F.linhas_sar)} medições</span>
      ${pag.soNivel ? `<span>Nível desde <b>${dBR(pag.SN[0].iso)}</b></span>` : ""}</div>
    ${seletorData("data-f", pag.inicio, NEd.serie_ate)}`;

const corpoFichaNE = pag =>
  `
    <nav class="indice" aria-label="Seções da página">${[
      ["fn-sit", "Situação"],
      ["fn-graf", "Gráfico"],
      ["fn-dia", "Mesmo dia em outros anos"],
      ["fn-ano", "Ano contra anos anteriores"]
    ]
      .map(([id, r]) => `<a href="#ne/ficha/${pag.cod}" data-alvo="${id}">${r}</a>`)
      .join("")}</nav>
    ${pag.soNivel ? `<div class="aviso-nivel"><p><b>Como ler.</b> O nível mostra se o açude subiu ou desceu, não quanta água há. O volume que aparece à parte é o que foi publicado até ${dBR(pag.ultVol.iso)}, quando o acompanhamento de volume parou. As duas séries vêm de fontes diferentes e não são emendadas.</p></div>` : ""}
    <section class="cartao secao" id="fn-sit" aria-labelledby="t-fn-sit">
      <h2 id="t-fn-sit"><small>1</small><span>Situação em <span id="fn-dia-txt"></span></span></h2>
      <p class="sub">Cada valor é a leitura mais próxima da data de referência, até ${pag.LIM} dias antes ou depois, com a data da leitura. Ao lado, o açude (círculo azul) e os vizinhos da bacia ${esc(caso(pag.F.bacia || ""))}.<span class="dica">Clique num vizinho para abrir a ficha dele.</span></p>
      <p class="nota" id="aviso-sit-ne"></p>
      <div class="sit-grid"><div class="valores" id="valores-ficha"></div><div id="mapa-ficha"></div></div>
    </section>
    <section class="cartao secao" id="fn-graf" aria-labelledby="t-fn-graf">
      ${barraBaixar([
        ["baixar-f-csv", "CSV", "Baixar a série do período em CSV"],
        ["baixar-f-png", "PNG", "Baixar os gráficos da seção como imagem"]
      ])}
      <h2 id="t-fn-graf"><small>2</small>Gráfico</h2>
      <p class="sub">${pag.soNivel ? "Nível e, abaixo, o volume publicado até o fim do acompanhamento de volume, no mesmo período. " : ""}${pag.soNivel ? "" : 'Leituras do reservatório no período escolhido.<span class="dica">Escolha o período e a variável.</span>'}</p>
      <div class="controles painel">
        <fieldset class="largo"><legend>Período</legend><span id="presets" class="presets"></span><span class="datas"><label>de <input type="date" id="g-de"></label><label>até <input type="date" id="g-ate"></label></span></fieldset>
        ${pag.varsGraf.length ? `<fieldset><legend>Variável</legend>${pag.varsGraf.map((k, i) => `<label><input type="radio" name="var-f" value="${k}"${i === 0 ? " checked" : ""}> <i class="sw" style="border-color:${VNE[k].cor}"></i>${VNE[k].r} (${VNE[k].u})</label>`).join("")}</fieldset>` : ""}
      </div>
      <div class="graf" id="g-f1"></div>
      ${pag.soNivel ? '<div class="graf" id="g-f2"></div>' : ""}
      <p class="nota" id="resumo-f" style="margin:12px 0 0"></p>
      <h3 class="sub-bloco">Medições por ano<small>quando o acompanhamento foi regular, esparso ou parou</small></h3>
      <div class="graf" id="g-med"></div>
      ${comoLer(
        `<b>Leituras.</b> A linha liga as leituras nas datas em que foram feitas; intervalo de mais de ${VAO_MAX} dias sem leitura não é ligado, e a leitura isolada aparece como ponto. A linha tracejada vermelha marca a data de referência. Com o cursor sobre o gráfico, o balão mostra a leitura mais próxima.`,
        "<b>Referências.</b> No volume em hm³, a linha tracejada cinza marca a capacidade; na cota, a cota máxima do açude, quando cadastrada.",
        `<b>Medições por ano.</b> As barras contam as leituras de cada ano${pag.soNivel ? ", com volume e de nível," : ""} e mostram quando o acompanhamento foi regular, esparso ou parou.`
      )}
    </section>
    <section class="cartao secao" id="fn-dia" aria-labelledby="t-fn-dia">
      ${barraBaixar([
        ["baixar-f-dia-csv", "CSV", "Baixar os dados do gráfico em CSV"],
        ["baixar-f-dia", "PNG", "Baixar o gráfico como imagem"]
      ])}
      <h2 id="t-fn-dia"><small>3</small>Mesmo dia em outros anos</h2>
      <p class="sub" id="sub-f-dia"></p>
      <div class="controles"><fieldset><legend>Variável</legend><select id="var-dia-f" aria-label="Variável">${pag.varsComp.map((...a) => opcao(pag, ...a)).join("")}</select></fieldset></div>
      <div class="graf" id="g-f-dia"></div>
      <p class="nota" id="nota-ref-dia" style="margin:10px 0 0"></p>
      ${comoLer(ler("dia"), ler("escala"), "<b>Referências.</b> No volume em hm³, a linha tracejada cinza marca a capacidade; na cota, a cota máxima do açude, quando cadastrada.")}
    </section>
    <section class="cartao secao" id="fn-ano" aria-labelledby="t-fn-ano">
      ${barraBaixar([
        ["baixar-f-ano-csv", "CSV", "Baixar os dados do gráfico em CSV"],
        ["baixar-f-ano", "PNG", "Baixar o gráfico como imagem"]
      ])}
      <h2 id="t-fn-ano"><small>4</small>Ano contra anos anteriores</h2>
      <p class="sub">As leituras de cada ano sobrepostas no mesmo calendário, nas datas reais, até a data de referência.<span class="dica">Selecione os anos a comparar, até ${MAX_ANOS} simultaneamente; posicione o cursor sobre o gráfico para ler o mesmo dia em cada ano.</span></p>
      <div class="controles"><fieldset><legend>Variável</legend><select id="var-ano-f" aria-label="Variável">${pag.varsComp.map((...a) => opcao(pag, ...a)).join("")}</select></fieldset>
        <fieldset class="anos"><legend>Anos <span class="nota" id="nota-anos-f"></span></legend><span id="anos-chips-f"></span></fieldset></div>
      <div class="graf" id="g-f-ano"></div>
      <p class="nota" id="nota-ref-ano" style="margin:10px 0 0"></p>
      ${comoLer(ler("anos"), ler("leituras"), ler("selecao"), ler("cursor"), "<b>Referências.</b> No volume em hm³, a linha tracejada cinza marca a capacidade; na cota, a cota máxima do açude, quando cadastrada.")}
    </section>
    <p class="nota fontes-inicio" id="fontes-f"></p>`;

// 1. situação
const diasAntesFichaNE = (iso, n) => isoAbs(diaAbs(iso) - n);

const anoAnt = iso => `${+iso.slice(0, 4) - 1}${iso.slice(4)}`.replace(/-02-29$/, "-02-28");

const caixa = (r, n, u, c) =>
  `<div class="v"><div class="r">${r}</div><div class="n num${n === "–" ? " vazio" : ""}">${n}${u && n !== "–" ? `<small>${u}</small>` : ""}</div>${c ? `<div class="c"><span>${c}</span></div>` : ""}</div>`;

const quando = l => `leitura de <b class="num">${dBR(l.iso)}</b> · ${dDias(l)}`;

function situacaoFichaNE(pag) {
  $("#fn-dia-txt").textContent = dBR(contexto.dataRef);
  let h = "";
  if (!pag.soNivel) {
    const u = leituraNa(pag.SR, "pct", contexto.dataRef, pag.LIM),
      c = leituraNa(pag.SR, "cota", contexto.dataRef, pag.LIM);
    if (u) {
      const p30 = leituraNa(pag.SR, "pct", diasAntesFichaNE(u.iso, 30), FOLGA30),
        a1 = leituraNa(pag.SR, "pct", anoAnt(contexto.dataRef), pag.LIM),
        fx = FX[faixaPct(u.v)];
      const ok30 = p30 && p30.iso !== u.iso;
      h += `<div class="v principal"><div class="r">Volume<span class="faixa-tag"><i class="bola" style="background:${fx.cor}"></i>${fx.rot}</span></div><div class="n num">${fmt(u.v, 1)}<small>%</small></div>
          <div class="c"><span>${quando(u)}</span><span>em 30 dias <b class="num">${ok30 ? sinal(u.v - p30.v, 1) + " p.p." : "–"}</b>${ok30 ? ` <small>desde ${dBR(p30.iso)}</small>` : " <small>sem leitura perto de 30 dias antes</small>"}</span><span>mesmo dia de ${+contexto.dataRef.slice(0, 4) - 1} <b class="num">${a1 ? fmt(a1.v, 1) + "%" : "–"}</b></span></div></div>`;
    } else {
      const ant = [...pag.SR].reverse().find(o => o.pct != null && o.iso <= contexto.dataRef);
      h += `<div class="v principal"><div class="r">Volume<span class="faixa-tag"><i class="bola" style="background:${FX.sem.cor}"></i>Sem informação</span></div><div class="n num vazio">sem medição na janela</div>
          <div class="c"><span>nenhuma leitura de ${dBR(diasAntesFichaNE(contexto.dataRef, pag.LIM))} a ${dBR(diasAntesFichaNE(contexto.dataRef, -pag.LIM))}</span>${ant ? `<span>última antes: <b class="num">${fmt(ant.pct, 1)}%</b> em ${dBR(ant.iso)}</span>` : ""}</div></div>`;
    }
    h += caixa("Volume", u && u.hm3 != null ? fmt(u.hm3, 1) : "–", "hm³", u ? `em ${dBR(u.iso)}` : "");
    h += caixa("Cota", c ? fmt(c.v, 2) : "–", "m", c ? `em ${dBR(c.iso)}` : "sem cota informada na janela");
    h += caixa("Capacidade", fmt(pag.F.capacidade_hm3, 1), "hm³", "");
  } else {
    const n = leituraNa(pag.SN, "nivel", contexto.dataRef, pag.LIM);
    if (n) {
      const p30 = leituraNa(pag.SN, "nivel", diasAntesFichaNE(n.iso, 30), FOLGA30),
        a1 = leituraNa(pag.SN, "nivel", anoAnt(contexto.dataRef), pag.LIM);
      const d30 = p30 && p30.iso !== n.iso ? n.v - p30.v : null,
        tend = d30 == null ? "semcomp" : d30 >= LIM_EST ? "sobe" : d30 <= -LIM_EST ? "desce" : "est";
      const rotT = d30 == null ? "sem comparação" : tend === "sobe" ? "subiu" : tend === "desce" ? "desceu" : "estável";
      h += `<div class="v principal"><div class="r">Nível<span class="faixa-tag">${icoNV(tend)}${rotT} em 30 dias</span></div><div class="n num">${fmt(n.v, 2)}<small>m</small></div>
          <div class="c"><span>${quando(n)}</span><span>em 30 dias <b class="num">${d30 == null ? "–" : sinal(d30) + " m"}</b>${d30 == null ? " <small>sem leitura perto de 30 dias antes</small>" : ` <small>desde ${dBR(p30.iso)}</small>`}</span><span>mesmo dia de ${+contexto.dataRef.slice(0, 4) - 1} <b class="num">${a1 ? fmt(a1.v, 2) + " m" : "–"}</b></span></div></div>`;
    } else
      h += `<div class="v principal"><div class="r">Nível</div><div class="n num vazio">sem leitura na janela</div><div class="c"><span>a leitura de nível começa em ${dBR(pag.SN[0].iso)}</span></div></div>`;
    const vSar = leituraNa(pag.SR, "pct", contexto.dataRef, pag.LIM);
    h += caixa("Volume", "–", "", "sem curva cota-volume validada");
    h += vSar
      ? caixa("Volume", fmt(vSar.v, 1), "%", `em ${dBR(vSar.iso)}`)
      : caixa("Volume", fmt(pag.ultVol.pct, 1), "%", `última leitura, ${dBR(pag.ultVol.iso)}`);
    h += caixa("Capacidade", fmt(pag.F.capacidade_hm3, 1), "hm³", "");
  }
  $("#valores-ficha").innerHTML = h;
}

function mapaVizinhos(pag) {
  const salva = contexto.dataRef,
    fora = contexto.dataRef < NEd.serie_min || contexto.dataRef > NEd.serie_ate;
  if (fora) contexto.dataRef = NEd.data; // a série dos vizinhos embutida no protótipo cobre só os 12 meses do módulo
  const naBacia = NEd.reservatorios.filter(r => r.uf === pag.F.uf && r.bacia === pag.F.bacia);
  const cods = new Set(naBacia.map(r => r.codigo));
  const lista = naBacia
    .filter(r => !FORA_VOLUME.has(r.i))
    .map(r => resNa(r.i))
    .concat(ESTACOES_NV.filter(st => st.uf === pag.F.uf && st.codigo && cods.has(st.codigo)).map(st => nivelNa(st)))
    .filter(r => r.lat != null);
  contexto.dataRef = salva;
  pag.MR.atualizar(lista);
  pag.alvoMapa.addTo(pag.MR.mapa);
  $("#aviso-sit-ne").textContent = fora
    ? `No mapa, os vizinhos seguem em ${dBR(NEd.data)}: no protótipo a série dos demais açudes vai de ${dBR(NEd.serie_min)} a ${dBR(NEd.serie_ate)}.`
    : "";
  return lista;
}

const aplicarPresetFichaNE = (pag, n) => {
  $("#g-ate").value = NEd.serie_ate;
  $("#g-de").value = n ? isoAbs(Math.max(diaAbs(pag.inicio), diaAbs(NEd.serie_ate) - n + 1)) : pag.inicio;
  desenharFichaNE(pag);
};

const ligarControlesGraficoFichaNE = pag => {
  $$("#presets .preset").forEach(
    b =>
      (b.onclick = () => {
        $$("#presets .preset").forEach(x => x.classList.toggle("ativo", x === b));
        aplicarPresetFichaNE(pag, +b.dataset.n);
      })
  );
  $("#g-de").onchange = $("#g-ate").onchange = () => {
    $$("#presets .preset").forEach(x => x.classList.remove("ativo"));
    desenharFichaNE(pag);
  };
  $$("input[name=var-f]").forEach(i => (i.onchange = (...a) => desenharFichaNE(pag, ...a)));
};

const periodo = pag => {
  let de = $("#g-de").value || pag.inicio,
    ate = $("#g-ate").value || NEd.serie_ate;
  if (de > ate) [de, ate] = [ate, de];
  return [de, ate];
};

// pontos da variável no período, com quebra da linha nos vãos longos
const pontosDe = (pag, k, de, ate) => {
  const out = [];
  let ant = null;
  serieDe(pag, k).forEach(o => {
    if (o.iso < de || o.iso > ate || o[k] == null) return;
    if (ant && o.d - ant.d > VAO_MAX) out.push({ t: (ant.t + o.t) / 2, [k]: null });
    out.push(o);
    ant = o;
  });
  return out;
};

const porCima = (pag, k, de, ate) => (svg, X, Y, g) => {
  const P = serieDe(pag, k).filter(o => o.iso >= de && o.iso <= ate && o[k] != null);
  P.forEach((o, i) => {
    const a = P[i - 1],
      b = P[i + 1];
    if ((!a || o.d - a.d > VAO_MAX) && (!b || b.d - o.d > VAO_MAX))
      svg.append(svgEl("circle", { cx: X(o.t), cy: Y(o[k]), r: 2.6, fill: VNE[k].cor }));
  });
  if (contexto.dataRef >= de && contexto.dataRef <= ate) {
    const x = X(Date.parse(contexto.dataRef + "T00:00:00Z"));
    svg.append(
      svgEl("line", {
        x1: x,
        x2: x,
        y1: g.m.t,
        y2: g.H - g.m.b,
        stroke: COR.vermelho,
        "stroke-width": 1,
        "stroke-dasharray": "3 3",
        opacity: 0.7
      })
    );
  }
};

// hm³: de zero a um pouco acima da capacidade, para a linha da capacidade não colar no topo do eixo
const escalaDe = (pag, k) => (k === "pct" ? [0, 100] : k === "hm3" ? [0, pag.F.capacidade_hm3 * 1.08] : null);

function grafico(pag, host, k, de, ate, rotulo, alt = "principal") {
  const S = pontosDe(pag, k, de, ate);
  if (!S.some(o => o[k] != null)) {
    host.innerHTML = `<p class="nota" style="padding:10px 0">${rotulo}: nenhuma leitura de ${dBR(de)} a ${dBR(ate)}.</p>`;
    return 0;
  }
  graficoLinhas(host, S, [{ k, ...VNE[k], r: rotVar(pag, k) }], {
    base: "dia",
    unidade: VNE[k].u,
    dec: VNE[k].dec,
    altura: alt,
    sync: {},
    rotulo,
    escala: escalaDe(pag, k),
    refs: refsDe(pag, k),
    t0: Date.parse(de + "T00:00:00Z"),
    t1: Date.parse(ate + "T00:00:00Z"),
    depois: porCima(pag, k, de, ate)
  });
  return S.filter(o => o[k] != null).length;
}

function desenharFichaNE(pag) {
  const [de, ate] = periodo(pag);
  if (!pag.soNivel) {
    const k = $("input[name=var-f]:checked").value;
    const n = grafico(pag, $("#g-f1"), k, de, ate, `${VNE[k].r} (${VNE[k].u})`);
    $("#resumo-f").textContent =
      `${fint(n)} leituras de ${VNE[k].r.toLowerCase()} de ${dBR(de)} a ${dBR(ate)}.${semCotaMax(pag, k)}`;
  } else {
    const n1 = grafico(pag, $("#g-f1"), "nivel", de, ate, "Nível (m)");
    const n2 = grafico(
      pag,
      $("#g-f2"),
      "pct",
      de,
      ate,
      `Volume (%) · acompanhamento até ${dBR(pag.ultVol.iso)}`,
      "apoio"
    );
    $("#resumo-f").textContent = `${fint(n1)} leituras de nível e ${fint(n2)} de volume de ${dBR(de)} a ${dBR(ate)}.`;
  }
}

function mesmoDiaFichaNE(pag) {
  const k = $("#var-dia-f").value,
    A = serieDe(pag, k),
    V = VNE[k],
    mmdd = contexto.dataRef.slice(5) === "02-29" ? "02-28" : contexto.dataRef.slice(5);
  const anos = A.filter(o => o[k] != null).map(o => +o.iso.slice(0, 4)),
    dados = [];
  for (let a = Math.min(...anos); a <= pag.anoFim; a++) {
    const alvo = `${a}-${mmdd}`,
      l = leituraNa(A, k, alvo, pag.LIM);
    dados.push({
      a,
      v: l ? l.v : null,
      rot: l ? `${dBR(alvo)} · leitura de ${dBR(l.iso)}` : dBR(alvo),
      data: dBR(alvo),
      leitura: l ? dBR(l.iso) : ""
    });
  }
  $("#sub-f-dia").textContent =
    `${rotVar(pag, k)} em ${dBR(contexto.dataRef).slice(0, 5)} de cada ano, pela leitura mais próxima até ${pag.LIM} dias antes ou depois; ano sem leitura na janela fica sem barra.`;
  graficoBarrasAnos($("#g-f-dia"), dados, {
    anoAtual: +contexto.dataRef.slice(0, 4),
    dec: V.dec,
    unidade: V.u,
    pct: k === "pct",
    relativo: k === "cota" || k === "nivel", // volume (% e hm³) desde zero; cota e nível, escala relativa
    rotulo: `${rotVar(pag, k)} (${V.u}) em ${dBR(contexto.dataRef).slice(0, 5)}`,
    legenda: rotVar(pag, k),
    refs: refsDe(pag, k)
  });
  $("#nota-ref-dia").textContent = semCotaMax(pag, k).trim();
}

const anosDe = (pag, k) =>
  [
    ...new Set(
      serieDe(pag, k)
        .filter(o => o[k] != null)
        .map(o => +o.iso.slice(0, 4))
    )
  ].sort();

function montarChips(pag) {
  const aoMudar = () => {
    montarChips(pag);
    anoAnos(pag);
  };
  pag.anosSel = new Set(
    botoesAnos(
      $("#anos-chips-f"),
      $("#nota-anos-f"),
      anosDe(pag, $("#var-ano-f").value),
      pag.estAnos,
      +contexto.dataRef.slice(0, 4),
      aoMudar
    )
  );
}

function anoAnos(pag) {
  const k = $("#var-ano-f").value,
    V = VNE[k],
    pontos = {};
  serieDe(pag, k).forEach(o => {
    if (o[k] != null && o.iso <= contexto.dataRef) pontos[o.iso] = o[k];
  }); // a curva termina na data de referência
  graficoCalendario($("#g-f-ano"), pontos, {
    anos: [...pag.anosSel].sort(),
    anoAtual: +contexto.dataRef.slice(0, 4),
    dec: V.dec,
    unidade: V.u,
    pct: k === "pct",
    marcaDia: contexto.dataRef,
    rotulo: `${rotVar(pag, k)} (${V.u})`,
    maxVao: VAO_MAX,
    refs: refsDe(pag, k)
  });
  $("#nota-ref-ano").textContent = semCotaMax(pag, k).trim();
}

const aplicarFichaNE = pag => {
  situacaoFichaNE(pag);
  mapaVizinhos(pag);
  desenharFichaNE(pag);
  mesmoDiaFichaNE(pag);
  montarChips(pag); // botoesAnos refaz a seleção só quando a data muda de ano
  anoAnos(pag);
};

const ligarDownloadsFichaNE = pag => {
  $("#baixar-f-png").onclick = () => {
    const [de, ate] = periodo(pag);
    const k = pag.soNivel ? "nivel" : ($("input[name=var-f]:checked") || {}).value || pag.varsGraf[0];
    // a imagem leva a série do período e, embaixo, as medições por ano, com a legenda das duas
    baixarPNG(
      [$("#g-f1 svg"), pag.soNivel ? $("#g-f2 svg") : null, $("#g-med svg")].filter(Boolean),
      `sar_${pag.u}_${de}_${ate}.png`,
      `${pag.nomeF} · ${dBR(de)} a ${dBR(ate)}`,
      [
        { r: `${VNE[k].r} (${VNE[k].u})`, cor: VNE[k].cor },
        ...(pag.soNivel ? [] : legRefs(pag, k)),
        ...(pag.soNivel ? [{ r: "Volume (%) publicado até o fim do acompanhamento", cor: VNE.pct.cor }] : []),
        { r: "data de referência", cor: COR.vermelho, tracejado: true }
      ]
    );
  };
  $("#baixar-f-dia").onclick = () =>
    baixarPNG(
      [$("#g-f-dia svg")],
      `sar_${pag.u}_mesmo_dia_${contexto.dataRef}.png`,
      `${pag.nomeF} · ${rotVar(pag, $("#var-dia-f").value)} em ${dBR(contexto.dataRef).slice(0, 5)} de cada ano`,
      LEG_ANOS(+contexto.dataRef.slice(0, 4)).concat(legRefs(pag, $("#var-dia-f").value))
    );
  $("#baixar-f-ano").onclick = () =>
    baixarPNG(
      [$("#g-f-ano svg")],
      `sar_${pag.u}_ano_contra_anos_${contexto.dataRef}.png`,
      `${pag.nomeF} · ${rotVar(pag, $("#var-ano-f").value)} ao longo do ano`,
      LEG_ANOS(+contexto.dataRef.slice(0, 4)).concat(legRefs(pag, $("#var-ano-f").value))
    );
  $("#baixar-f-dia-csv").onclick = () =>
    baixarCSVGrafico([$("#g-f-dia")], `sar_${pag.u}_mesmo_dia_${contexto.dataRef}.csv`);
  $("#baixar-f-ano-csv").onclick = () =>
    baixarCSVGrafico([$("#g-f-ano")], `sar_${pag.u}_ano_contra_anos_${contexto.dataRef}.csv`);
  $("#baixar-f-csv").onclick = () => {
    const [de, ate] = periodo(pag),
      nn = v => (v == null ? "" : String(v).replace(".", ","));
    const linhas = pag.soNivel
      ? [["data", "cota_m", "volume_pct"].join(";")].concat(
          [...new Set(pag.SN.concat(pag.SR).map(o => o.iso))]
            .filter(i => i >= de && i <= ate)
            .sort()
            .map(i =>
              [
                dBR(i),
                nn((pag.SN.find(o => o.iso === i) || {}).nivel),
                nn((pag.SR.find(o => o.iso === i) || {}).pct)
              ].join(";")
            )
        )
      : [["data", "cota_m", "volume_hm3", "volume_pct"].join(";")].concat(
          pag.SR.filter(o => o.iso >= de && o.iso <= ate).map(o =>
            [dBR(o.iso), nn(o.cota), nn(o.hm3), nn(o.pct)].join(";")
          )
        );
    baixarArquivo(
      new Blob(["\uFEFF" + linhas.join("\r\n")], { type: "text/csv;charset=utf-8" }),
      `sar_${pag.u}_${de}_${ate}.csv`
    );
    toast(
      `CSV com ${linhas.length - 1} linhas gerado. (Na página publicada no claude.ai o download é bloqueado; abra o arquivo local.)`
    );
  };
};

export { abrirFichaNE, diaAbs, paginaFichaNE };
