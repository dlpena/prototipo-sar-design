/* Área administrativa (#admin)
   conceito em estrutura/area_administrativa.md. Área interna, com login; tudo o que se faz aqui fica na memória da
   página (pedidos, trilha, correções) para o protótipo mostrar o fluxo entre as telas. */
import { D, NEd } from "../dados_embutidos.js";
import { $, $$, COR, dBR, esc, fint, fmt, normalizaBusca, semAc, toast } from "../base.js";
import { hojeBR, nCSV, salvarCSV } from "../exportacao.js";
import { alturaGraf } from "../graficos.js";
import { COR_MOD } from "../inicio.js";
import { diaEntre, isoMais } from "../outros.js";
import { CAT_VARS, entidadesDados, nomeVar, ROT_MOD, serieDados } from "../dados.js";
import {
  admAgrupamentos,
  admCobertura,
  admCodigos,
  admInclusao,
  admParametros,
  admPublicacao,
  admSuspeitos,
  cascataTopoSVG,
  intAdm,
  retiradoAdm,
  sitNEAdm,
  suspeitosAdm
} from "./admin_telas.js";
import { montarFaixa, rota } from "../rotas.js";

const ADM = {
  perfil: "editor",
  pedidos: [],
  trilha: [],
  manual: {},
  novos: {},
  apagados: {},
  modo: {},
  exec: [],
  seq: 1,
  ent: null,
  semeado: false,
  revisoes: [],
  avisos: [],
  textos: {},
  textosMeta: {},
  params: {},
  susp: {},
  excecoes: [],
  codigos: [],
  agrup: {},
  inclusoes: []
};
const LEV_ADM = ["Batimetria", "Topografia", "Estudo do órgão estadual", "Correção de cadastro"];
const ADM_USU = { leitura: "Usuário de leitura", editor: "Editor A", aprovador: "Aprovador B" };
const ADM_GRUPOS = [
  [
    "Acompanhamento",
    [
      ["", "Integrações"],
      ["cobertura", "Cobertura"],
      ["suspeitos", "Valores suspeitos"]
    ]
  ],
  [
    "Dados e cadastro",
    [
      ["serie", "Correção de série"],
      ["cadastro", "Cadastro e curva"],
      ["inclusao", "Inclusão"],
      ["codigos", "Códigos das fontes"],
      ["agrupamentos", "Agrupamentos"]
    ]
  ],
  [
    "Publicação",
    [
      ["publicacao", "Avisos e textos"],
      ["parametros", "Parâmetros"]
    ]
  ],
  [
    "Controle",
    [
      ["aprovacoes", "Aprovações"],
      ["trilha", "Registro das ações"]
    ]
  ]
];
// correção da série publicada: fica no registro interno da área administrativa (a seção pública "Revisões da série" saiu, 22/09/2026)
function revisaoAdm(e, texto, motivo) {
  if (e && e.id) ADM.revisoes.unshift({ id: e.id, nome: e.nome, cod: e.codigo, quando: hojeBR(), texto, motivo });
}
const agoraAdm = () => {
  const d = new Date();
  return `${hojeBR()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const numBR = s => {
  const x = String(s).trim().replace(/\./g, "").replace(",", ".");
  return x === "" || isNaN(x) ? null : Number(x);
};
const decVar = k =>
  k === "cota_m" || k === "volume_hm3" || k === "volume_pct" || k === "volume_util_pct" ? 2 : k === "chuva_mm" ? 1 : 2;
const podeEditar = () => ADM.perfil !== "leitura";
function trilhaAdm(op, e, detalhe, motivo, situacao, desfazer) {
  ADM.trilha.unshift({
    n: ADM.seq++,
    quando: agoraAdm(),
    quem: ADM_USU[ADM.perfil],
    op,
    res: e ? e.nome : "–",
    cod: e ? e.codigo : "",
    detalhe,
    motivo,
    situacao: situacao || "gravado",
    desfazer
  });
}
function pedidoAdm(tipo, e, efeito, motivo, aplicar) {
  ADM.pedidos.unshift({
    n: ADM.seq++,
    tipo,
    res: e.nome,
    cod: e.codigo,
    por: ADM_USU[ADM.perfil],
    quando: agoraAdm(),
    motivo,
    efeito,
    situacao: "aguardando",
    aplicar,
    e
  });
  trilhaAdm(
    tipo,
    e,
    efeito
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
    motivo,
    "aguardando aprovação"
  );
  toast("Pedido enviado para aprovação.");
  abasAdm();
}
// série do reservatório com o que a área administrativa mudou nesta sessão (correções, períodos gravados e apagados)
function serieAdm(e) {
  const M = new Map(serieDados(e, "dia", null, "9999-12-31").map(l => [l.t, { t: l.t, v: { ...l.v }, m: {} }]));
  (ADM.novos[e.id] || []).forEach(l => {
    const x = M.get(l.t) || { t: l.t, v: {}, m: {} };
    Object.entries(l.v).forEach(([k, val]) => {
      x.v[k] = val;
      x.m[k] = 1;
    });
    M.set(l.t, x);
  });
  Object.entries(ADM.manual[e.id] || {}).forEach(([ch, o]) => {
    const [t, k] = ch.split("|"),
      x = M.get(t);
    if (x) {
      x.v[k] = o.depois;
      x.m[k] = o;
    }
  });
  (ADM.apagados[e.id] || []).forEach(a =>
    M.forEach(x => {
      if (x.t >= a.de && x.t <= a.ate)
        a.vars.forEach(k => {
          x.v[k] = null;
          x.m[k] = 0;
        });
    })
  );
  return [...M.values()].sort((a, b) => (a.t < b.t ? -1 : 1));
}
function semearAdm() {
  if (ADM.semeado) return;
  ADM.semeado = true;
  const E = entidadesDados(),
    ex = c => E.find(e => String(e.codigo) === c && e.src === "ne");
  const NEs = E.filter(e => e.src === "ne" && !e.retirado),
    a = ex("12231") || NEs[0],
    b = NEs.find(e => e !== a && e.uf !== a.uf) || NEs[1];
  ADM.pedidos.push({
    n: ADM.seq++,
    tipo: "Modo de exibição",
    res: a.nome,
    cod: a.codigo,
    por: "Editor C",
    quando: agoraAdm(),
    motivo: "Exemplo do protótipo: reservatório sem leitura desde a desativação da régua.",
    exemplo: true,
    efeito:
      "<b>Com volume</b> → <b>retirado do acompanhamento</b>. Sai das tabelas, dos agregados e do mapa; segue na área de dados e na API, marcado como retirado.",
    situacao: "aguardando",
    e: a,
    aplicar: () => {
      ADM.modo[a.id] = "retirado";
    }
  });
  ADM.pedidos.push({
    n: ADM.seq++,
    tipo: "Apagar período",
    res: b.nome,
    cod: b.codigo,
    por: "Editor C",
    quando: agoraAdm(),
    motivo: "Exemplo do protótipo: leituras digitadas em duplicidade.",
    exemplo: true,
    efeito: "Período de exemplo · todas as variáveis. Os registros saem da série publicada e ficam guardados.",
    situacao: "aguardando",
    e: b,
    aplicar: () => {}
  });
}
function abasAdm() {
  const el = $("#abas-adm");
  if (!el) return;
  const h = decodeURIComponent(location.hash.slice(1)),
    sub = h === "admin" ? "" : h.slice(6),
    nAg = ADM.pedidos.filter(p => p.situacao === "aguardando").length;
  const nSus = typeof suspeitosAdm === "function" ? suspeitosAdm().filter(s => !ADM.susp[s.id]).length : 0;
  el.innerHTML = ADM_GRUPOS.map(
    ([g, L]) =>
      `<div class="abas-grupo"><span class="rot">${g}</span>${L.map(([k, r]) => `<a href="#admin${k ? "/" + k : ""}"${k === sub ? ' aria-current="page"' : ""}>${r}${k === "aprovacoes" && nAg ? `<i>${nAg}</i>` : k === "suspeitos" && nSus ? `<i>${nSus}</i>` : ""}</a>`).join("")}</div>`
  ).join("");
}
function tituloAdm(titulo, lead, chips) {
  $("#titulo-pag").innerHTML = `
    <p class="trilha"><a href="#inicio">Início</a><span class="sep">›</span>${titulo === "Integrações" ? "Administração" : `<a href="#admin">Administração</a><span class="sep">›</span>${titulo}`}</p>
    <h1>${titulo === "Integrações" ? "Administração" : titulo}</h1>
    <p class="lead">${lead}</p>
    <nav class="abas-adm" id="abas-adm" aria-label="Telas da administração"></nav>
    <div class="carimbo"><span class="adm-perfil">Perfil nesta sessão <span class="seg" role="group" aria-label="Perfil (simulação)">${Object.keys(
      ADM_USU
    )
      .map(k => `<button type="button" data-perfil="${k}" aria-pressed="${ADM.perfil === k}">${k}</button>`)
      .join(
        ""
      )}</span></span><span>Como <b>${ADM_USU[ADM.perfil]}</b></span>${chips || ""}<span>Área interna, com login</span></div>`;
  abasAdm();
  $$("[data-perfil]").forEach(
    b =>
      (b.onclick = () => {
        ADM.perfil = b.dataset.perfil;
        rota();
      })
  );
}
// seletor de reservatório: busca da área de dados (nome, código, município, estado, bacia, módulo)
function seletorAdm(host, filtro, aoEscolher) {
  const E = entidadesDados().filter(e => e.src !== "can" && (!filtro || filtro(e)));
  const desenha = () => {
    const e = ADM.ent;
    host.innerHTML = `<div class="adm-sel"><div class="busca-dados"><input type="search" placeholder="Buscar reservatório por nome, código, município ou estado" aria-label="Buscar reservatório" autocomplete="off"></div><div class="adm-sel-res" hidden></div>
      ${e ? `<p class="adm-atual"><span class="tag" style="background:${COR_MOD[e.mod]}">${ROT_MOD[e.mod]}</span><b>${esc(e.nome)}</b><span>${e.codigo ? "código " + esc(e.codigo) + " · " : ""}${esc([e.municipio, e.uf].filter(Boolean).join(", "))}${e.bacia ? " · " + esc(e.bacia) : ""}</span>${retiradoAdm(e) ? '<span class="ret">retirado do acompanhamento</span>' : ""}</p>` : ""}</div>`;
    const q = $("input", host),
      box = $(".adm-sel-res", host);
    q.oninput = () => {
      const termos = normalizaBusca(q.value).split(/\s+/).filter(Boolean);
      if (!termos.length) {
        box.hidden = true;
        return;
      }
      const L = E.filter(x => termos.every(tm => x.busca.includes(tm)))
        .map(x => ({
          x,
          s: termos.reduce((a, tm) => a + (x.nomeB.startsWith(tm) ? 3 : x.nomeB.includes(tm) ? 2 : 1), 0)
        }))
        .sort((a, b) => b.s - a.s || a.x.nome.localeCompare(b.x.nome, "pt-BR"))
        .slice(0, 8)
        .map(o => o.x);
      box.hidden = false;
      box.innerHTML = L.length
        ? L.map(
            x =>
              `<button type="button" class="res" data-id="${esc(x.id)}"><span class="n">${esc(x.nome)}</span><span class="d">${esc([x.municipio, x.uf].filter(Boolean).join(", "))}${x.codigo ? " · código " + esc(x.codigo) : ""}</span><span class="m">${ROT_MOD[x.mod]}</span></button>`
          ).join("")
        : '<p class="nota" style="padding:8px 12px;margin:0">Nenhum reservatório encontrado.</p>';
      $$("button", box).forEach(
        b =>
          (b.onclick = () => {
            ADM.ent = E.find(x => x.id === b.dataset.id);
            desenha();
            aoEscolher();
          })
      );
    };
  };
  if (!ADM.ent || (filtro && !filtro(ADM.ent)))
    ADM.ent = E.find(e => String(e.codigo) === "12112" && e.src === "ne") || E[0];
  desenha();
}
// gráfico de linha simples da tela administrativa: séries [{pts:[[x, y]], cor, tracejada}] e pontos marcados
function linhaAdm(host, series, marcas, rotX) {
  const W = Math.max(320, host.clientWidth || 700),
    H = alturaGraf("apoio", W),
    m = { e: 52, d: 12, t: 10, b: 24 };
  const P = series.flatMap(s => s.pts).filter(p => p[1] != null);
  if (P.length < 2) {
    host.innerHTML = '<p class="nota">Sem dados para o gráfico neste período.</p>';
    return;
  }
  const x0 = Math.min(...P.map(p => p[0])),
    x1 = Math.max(...P.map(p => p[0])),
    ya = Math.min(...P.map(p => p[1])),
    yb = Math.max(...P.map(p => p[1])),
    fol = (yb - ya) * 0.08 || 1;
  const y0 = ya >= 0 ? Math.max(0, ya - fol) : ya - fol,
    y1 = yb + fol,
    X = x => m.e + ((x - x0) / (x1 - x0 || 1)) * (W - m.e - m.d),
    Y = y => m.t + (1 - (y - y0) / (y1 - y0)) * (H - m.t - m.b);
  const grade = [0, 1, 2, 3].map(i => y0 + ((y1 - y0) * i) / 3);
  const cam = pts => {
    let d = "",
      sol = true;
    pts.forEach(p => {
      if (p[1] == null) {
        sol = true;
        return;
      }
      d += (sol ? "M" : "L") + X(p[0]).toFixed(1) + " " + Y(p[1]).toFixed(1);
      sol = false;
    });
    return d;
  };
  host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" role="img" aria-label="Gráfico da série">
    ${grade.map(g => `<line x1="${m.e}" x2="${W - m.d}" y1="${Y(g)}" y2="${Y(g)}" stroke="${COR.linha}"/><text x="${m.e - 8}" y="${Y(g) + 4}" text-anchor="end" font-size="11" fill="${COR.apagado}">${fmt(g, 2)}</text>`).join("")}
    ${series.map(s => `<path d="${cam(s.pts)}" fill="none" stroke="${s.cor}" stroke-width="2" stroke-linejoin="round"${s.tracejada ? ' stroke-dasharray="5 4"' : ""}/>`).join("")}
    ${(marcas || [])
      .filter(p => p[1] != null)
      .map(
        p =>
          `<circle cx="${X(p[0])}" cy="${Y(p[1])}" r="4.5" fill="${COR.branco}" stroke="${COR.bronze}" stroke-width="2"/>`
      )
      .join("")}
    <text x="${m.e}" y="${H - 6}" font-size="11" fill="${COR.apagado}">${esc(rotX[0])}</text><text x="${W - m.d}" y="${H - 6}" font-size="11" fill="${COR.apagado}" text-anchor="end">${esc(rotX[1])}</text></svg>`;
}
function paginaAdmin(sub) {
  semearAdm();
  (
    ({
      "": admIntegracoes,
      cobertura: admCobertura,
      suspeitos: admSuspeitos,
      serie: admSerie,
      cadastro: admCadastro,
      inclusao: admInclusao,
      codigos: admCodigos,
      agrupamentos: admAgrupamentos,
      publicacao: admPublicacao,
      parametros: admParametros,
      aprovacoes: admAprovacoes,
      trilha: admTrilha
    })[sub] || admIntegracoes
  )();
}

/* ---------------- 1. integrações e carga sob demanda */
// lista, horários e falhas ilustrativos: as integrações reais e os horários previstos serão levantados com a STI
const ADM_INT = [
  { k: "ons-dia", r: "ONS · base diária", fonte: "ONS", mod: "SIN", horas: [15, 18, 21], n: 162 },
  { k: "ons-hora", r: "ONS · base horária (dados abertos)", fonte: "ONS", mod: "SIN", horas: [6, 12, 18], n: 162 },
  { k: "sabesp", r: "SABESP · Sistema Cantareira", fonte: "SABESP", mod: "Outros Sistemas", horas: [10, 16], n: 4 },
  { k: "gdh", r: "GDH · Distrito Federal e Paraopeba", fonte: "GDH", mod: "Outros Sistemas", horas: [9, 15], n: 6 },
  {
    k: "hidro",
    r: "HidroInfoAna · nível dos açudes",
    fonte: "HidroInfoAna",
    mod: "Nordeste e Semiárido",
    horas: [7, 13, 19],
    n: 47,
    falha: { tipo: "nao", ult: 1 }
  },
  {
    k: "ce",
    r: "Ceará · FUNCEME e COGERH",
    fonte: "FUNCEME/COGERH",
    mod: "Nordeste e Semiárido",
    horas: [8, 14],
    n: 155
  },
  {
    k: "pb",
    r: "Paraíba · AESA",
    fonte: "AESA",
    mod: "Nordeste e Semiárido",
    horas: [8, 14],
    n: 120,
    falha: { tipo: "erro", ult: 2, msg: "Tempo esgotado ao consultar a fonte (sem resposta em 120 s)." }
  },
  { k: "pe", r: "Pernambuco · APAC", fonte: "APAC", mod: "Nordeste e Semiárido", horas: [8, 14], n: 80 },
  { k: "mapas", r: "Serviço de mapas do SNIRH", fonte: "SAR → SNIRH", mod: "todos", horas: [22], n: 0 }
];
function execucoesInt(I) {
  // execuções previstas dos últimos 3 dias até agora, da mais recente para a mais antiga
  const agora = new Date(),
    L = [];
  for (let d = 0; d < 3; d++)
    [...I.horas].reverse().forEach(h => {
      const q = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - d, h, 0);
      if (q <= agora) L.push(q);
    });
  return L.map((q, i) => {
    const f = I.falha && i < I.falha.ult ? I.falha : null;
    return {
      q,
      sit: f ? (f.tipo === "erro" ? "falhou" : "nao") : "ok",
      lidos: f ? 0 : I.n,
      gravados: f ? 0 : I.n,
      msg: f ? f.msg || "A execução prevista não aconteceu." : ""
    };
  });
}
const dhBR = q =>
  `${String(q.getDate()).padStart(2, "0")}/${String(q.getMonth() + 1).padStart(2, "0")} ${String(q.getHours()).padStart(2, "0")}:${String(q.getMinutes()).padStart(2, "0")}`;
const SIT_INT = { ok: ["em dia", "ok"], falhou: ["falhou", "erro"], nao: ["não executou no horário previsto", "erro"] };
function admIntegracoes() {
  const pag = {}; // estado da página, passado às funções abaixo

  // reservatórios por integração contados no cadastro do protótipo (SIN, estações só com nível, Outros Sistemas e NE por estado)
  const EN = entidadesDados(),
    nUF = uf => EN.filter(e => e.src === "ne" && !e.retirado && e.uf === uf).length;
  Object.assign(
    ADM_INT.find(I => I.k === "ce"),
    { n: nUF("CE") }
  );
  Object.assign(
    ADM_INT.find(I => I.k === "pb"),
    { n: nUF("PB") }
  );
  Object.assign(
    ADM_INT.find(I => I.k === "pe"),
    { n: nUF("PE") }
  );
  Object.assign(
    ADM_INT.find(I => I.k === "hidro"),
    { n: EN.filter(e => e.src === "nv").length }
  );
  Object.assign(
    ADM_INT.find(I => I.k === "gdh"),
    { n: EN.filter(e => e.src === "os" && e.sis !== "cantareira").length }
  );
  pag.L = ADM_INT.map(I => {
    const X = execucoesInt(I),
      forc = ADM.exec.find(x => x.k === I.k && x.sit === "ok");
    const sit = forc ? "ok" : X[0] ? X[0].sit : "ok",
      ok = X.find(x => x.sit === "ok");
    return { I, X, sit, ok, forc };
  });
  tituloAdm(
    "Integrações",
    "Gestão do SAR pela CORSH, sem chamado à TI: integrações, correção de série, cadastro e curva cota-área-volume, aprovações e registro das ações.",
    `<span><b>${cont(pag, "ok")}</b> de ${pag.L.length} integrações em dia</span>`
  );
  $("#conteudo").innerHTML = corpoIntegracoes(pag);
  $$(".adm-linha").forEach(tr => {
    const abre = () => {
      const d = $(`[data-det="${tr.dataset.k}"]`);
      d.hidden = !d.hidden;
      tr.classList.toggle("aberta", !d.hidden);
    };
    tr.onclick = ev => {
      if (!ev.target.closest("button")) abre();
    };
    tr.onkeydown = ev => {
      if (ev.key === "Enter") abre();
    };
  });
  $$(".adm-forcar").forEach(
    b =>
      (b.onclick = () => {
        $("#c-fonte").value = b.dataset.k;
        previa();
        $("#a-carga").scrollIntoView({ behavior: "smooth", block: "start" });
      })
  );
  pag.L.filter(l => l.sit !== "ok").forEach(l => {
    const d = $(`[data-det="${l.I.k}"]`);
    d.hidden = false;
  });
  ["c-fonte", "c-de", "c-ate", "c-res"].forEach(id => ($("#" + id).onchange = previa));
  $("#c-cod").oninput = previa;
  $("#c-ir").onclick = () => {
    const p = pedido();
    if (!p.dias) return;
    const conf = Object.entries(ADM.manual).reduce(
      (a, [id, o]) =>
        a +
        ((p.um && id !== ADM.ent.id) || (p.cods && !p.cods.some(c => id.endsWith(":" + c)))
          ? 0
          : Object.keys(o).filter(ch => ch.slice(0, 10) >= p.de && ch.slice(0, 10) <= p.ate).length),
      0
    );
    const x = {
      k: p.I.k,
      r: p.I.r,
      de: p.de,
      ate: p.ate,
      res: p.um ? ADM.ent.nome : p.cods ? p.cods.join(", ") : "todos (" + fint(p.nRes) + ")",
      quando: agoraAdm(),
      por: ADM_USU[ADM.perfil],
      sit: "fila",
      lidos: p.nRes * p.dias,
      gravados: p.nRes * p.dias - conf,
      conflitos: conf
    };
    ADM.exec.unshift(x);
    trilhaAdm("Carga sob demanda", null, `${p.I.r}, ${dBR(p.de)} a ${dBR(p.ate)}, ${x.res}`, "", "executado");
    listaIntegracoes();
    setTimeout(() => {
      x.sit = "exec";
      if ($("#c-lista")) listaIntegracoes();
    }, 900);
    setTimeout(() => {
      x.sit = "ok";
      if ($("#c-lista") && location.hash === "#admin") admIntegracoes();
    }, 2600);
  };
  previa();
  listaIntegracoes();
  if (ADM.forcarUm && ADM.ent) {
    ADM.forcarUm = false;
    const k = intAdm(ADM.ent);
    if (k) $("#c-fonte").value = k;
    $("#c-res").value = "um";
    previa();
    setTimeout(() => $("#a-carga").scrollIntoView({ block: "start" }), 60);
  }
}

const cont = (pag, s) => pag.L.filter(l => (s === "ok" ? l.sit === "ok" : l.sit === s)).length;

const corpoIntegracoes = pag =>
  `
    <nav class="indice" aria-label="Seções da página"><a href="#admin" data-alvo="a-int">Situação das integrações</a><a href="#admin" data-alvo="a-carga">Carga sob demanda</a><a href="#admin" data-alvo="a-exec">Cargas sob demanda</a></nav>
    <section class="cartao secao" id="a-int" aria-labelledby="t-a-int">
      <h2 id="t-a-int"><small>1</small>Situação das integrações</h2>
      <p class="sub">Cada integração roda algumas vezes por dia. Não há tolerância: toda execução que falha, ou que não acontece no horário previsto, aparece aqui, e a linha só volta a "em dia" com uma execução bem-sucedida depois dela.<span class="dica">Clique numa linha para ver o erro e as últimas execuções.</span></p>
      <div class="adm-cards">
        <div class="card fixo"><div class="r">Em dia</div><div class="v">${cont(pag, "ok")}</div><div class="n">última execução com sucesso</div></div>
        <div class="card fixo${cont(pag, "falhou") ? " alerta" : ""}"><div class="r">Falhou</div><div class="v">${cont(pag, "falhou")}</div><div class="n">a última execução terminou com erro</div></div>
        <div class="card fixo${cont(pag, "nao") ? " alerta" : ""}"><div class="r">Não executou</div><div class="v">${cont(pag, "nao")}</div><div class="n">a execução prevista não aconteceu</div></div>
      </div>
      <div class="tab-box adm-tab"><table>
        <thead><tr><th>Integração</th><th>Módulo</th><th>Situação</th><th>Horários previstos</th><th>Última execução</th><th>Último sucesso</th><th class="r">Lidos · gravados</th><th></th></tr></thead>
        <tbody>${pag.L.map(
          ({ I, X, sit, ok, forc }) => `<tr class="adm-linha" data-k="${I.k}" tabindex="0">
          <td><span class="nm">${esc(I.r)}</span></td><td>${esc(I.mod)}</td><td><span class="adm-sit ${SIT_INT[sit][1]}">${SIT_INT[sit][0]}</span></td>
          <td>${I.horas.map(h => String(h).padStart(2, "0") + ":00").join(" · ")}</td><td>${forc ? esc(forc.quando) + " (sob demanda)" : X[0] ? dhBR(X[0].q) : "–"}</td><td>${forc ? esc(forc.quando) : ok ? dhBR(ok.q) : "–"}</td>
          <td class="r num">${forc ? fint(forc.lidos) + " · " + fint(forc.gravados) : X[0] && X[0].sit === "ok" ? fint(X[0].lidos) + " · " + fint(X[0].gravados) : "–"}</td>
          <td class="r"><button type="button" class="acao sec adm-forcar" data-k="${I.k}"${podeEditar() && I.k !== "mapas" ? "" : " disabled"}>Forçar carga</button></td></tr>
          <tr class="adm-det" data-det="${I.k}" hidden><td colspan="8">${sit !== "ok" ? `<p class="adm-erro"><b>${sit === "nao" ? "Não executou no horário previsto" : "Falhou"} em ${dhBR(X[0].q)}.</b> ${esc(X[0].msg)}</p>` : ""}
            <p class="adm-hist"><b>Últimas execuções</b>${X.slice(0, 8)
              .map(
                x =>
                  `<span class="${x.sit === "ok" ? "ok" : "erro"}" title="${esc(x.msg || "concluída")}">${dhBR(x.q)}${x.sit === "ok" ? `–${dhBR(new Date(+x.q + 2 * 60000)).slice(6)} · ${fint(x.lidos)} lidos, ${fint(x.gravados)} gravados, 0 rejeitados` : " · " + SIT_INT[x.sit][0]}</span>`
              )
              .join("")}</p></td></tr>`
        ).join("")}</tbody></table></div>
      <p class="nota">Lista de integrações, horários previstos e falhas são ilustrativos: as integrações reais e os horários de cada uma serão levantados com a STI. No sistema, cada falha também gera um aviso por e-mail ao perfil editor.</p>
    </section>
    <section class="cartao secao" id="a-carga" aria-labelledby="t-a-carga">
      <h2 id="t-a-carga"><small>2</small>Carga sob demanda</h2>
      <p class="sub">Busca de novo, na fonte, os dados de um período. A carga sob demanda não passa por cima de correção manual: o valor corrigido fica, e a diferença entra na lista de conflitos do resultado.</p>
      <div class="adm-form">
        <label>Fonte<select id="c-fonte">${ADM_INT.filter(I => I.k !== "mapas")
          .map(I => `<option value="${I.k}">${esc(I.r)}</option>`)
          .join("")}</select></label>
        <label>De<input type="date" id="c-de" value="${isoMais(D.data, -6)}"></label><label>Até<input type="date" id="c-ate" value="${D.data}"></label>
        <label>Reservatórios<select id="c-res"><option value="">Todos os da fonte</option><option value="um">Só ${ADM.ent ? esc(ADM.ent.nome) : "o reservatório escolhido"}</option><option value="lista">Lista de reservatórios</option></select></label>
        <label class="largo" id="c-cod-l" style="display:none">Códigos, separados por vírgula<input type="text" id="c-cod" placeholder="Ex.: 12112, 12231, 12391"></label>
        <button type="button" class="acao" id="c-ir"${podeEditar() ? "" : " disabled"}>Colocar na fila</button>
      </div>
      <p class="nota" id="c-previa"></p>
    </section>
    <section class="cartao secao" id="a-exec" aria-labelledby="t-a-exec">
      <h2 id="t-a-exec"><small>3</small>Cargas sob demanda</h2>
      <p class="sub">Cada carga sob demanda fica registrada como qualquer execução, com quem pediu e o resultado.</p>
      <div id="c-lista"></div>
    </section>`;

const pedido = () => {
  const I = ADM_INT.find(x => x.k === $("#c-fonte").value),
    de = $("#c-de").value,
    ate = $("#c-ate").value,
    dias = de && ate && ate >= de ? diaEntre(ate, de) + 1 : 0;
  const um = $("#c-res").value === "um" && ADM.ent,
    cods =
      $("#c-res").value === "lista"
        ? [
            ...new Set(
              $("#c-cod")
                .value.split(/[\s,;]+/)
                .filter(Boolean)
            )
          ]
        : null;
  $("#c-cod-l").style.display = cods ? "" : "none";
  return { I, de, ate, dias: cods && !cods.length ? 0 : dias, um, cods, nRes: um ? 1 : cods ? cods.length : I.n };
};

function previa() {
  const p = pedido();
  $("#c-previa").textContent = !p.dias
    ? p.cods && !p.cods.length
      ? "Informe os códigos dos reservatórios."
      : "Informe um período válido."
    : `${p.I.r}: ${p.um ? ADM.ent.nome : fint(p.nRes) + (p.nRes === 1 ? " reservatório" : " reservatórios")}, ${fint(p.dias)} ${p.dias === 1 ? "dia" : "dias"} (${dBR(p.de)} a ${dBR(p.ate)}).`;
  $("#c-ir").disabled = !p.dias || !podeEditar();
}

function listaIntegracoes() {
  $("#c-lista").innerHTML = ADM.exec.length
    ? `<div class="tab-box"><table><thead><tr><th>Pedida em</th><th>Por</th><th>Fonte</th><th>Período</th><th>Reservatórios</th><th>Situação</th><th class="r">Lidos</th><th class="r">Gravados</th><th class="r">Rejeitados</th><th class="r">Mantidos (correção manual)</th><th>Erro</th></tr></thead>
      <tbody>${ADM.exec
        .map(
          x => `<tr><td>${esc(x.quando)}</td><td>${esc(x.por)}</td><td><span class="nm">${esc(x.r)}</span></td><td>${dBR(x.de)} a ${dBR(x.ate)}</td><td>${esc(x.res)}</td>
        <td><span class="adm-sit ${x.sit === "ok" ? "ok" : "fila"}">${x.sit === "ok" ? "concluída" : x.sit === "exec" ? "executando" : "na fila"}</span></td><td class="r num">${x.sit === "ok" ? fint(x.lidos) : "–"}</td><td class="r num">${x.sit === "ok" ? fint(x.gravados) : "–"}</td><td class="r num">${x.sit === "ok" ? "0" : "–"}</td><td class="r num">${x.sit === "ok" ? fint(x.conflitos) : "–"}</td><td>${x.sit === "ok" ? "nenhum" : "–"}</td></tr>`
        )
        .join("")}</tbody></table></div>
      <p class="nota">Resultado simulado: um registro por reservatório e dia do período. "Mantidos" são os valores com correção manual nesta sessão dentro do período.</p>`
    : '<p class="nota">Nenhuma carga sob demanda nesta sessão.</p>';
}

/* ---------------- 2. correção de série */
function admSerie() {
  const pag = {}; // estado da página, passado às funções abaixo

  tituloAdm(
    "Correção de série",
    "Ver e corrigir um valor, apagar um período e gravar ou substituir um período por planilha. Toda correção leva a marca de alteração manual, que a carga automática respeita."
  );
  $("#conteudo").innerHTML = corpoSerie();
  pag.st = { de: "", ate: "", mostrar: 31, pend: new Map(), plan: null };
  pag.e = undefined;
  pag.S = undefined;
  pag.V = undefined;
  $("#ap-de").onchange = $("#ap-ate").onchange = (...a) => previaApagar(pag, ...a);
  $("#ap-ir").onclick = () => {
    const p = previaApagar(pag),
      mot = $("#ap-motivo").value.trim(),
      alvo = pag.e;
    if (!mot) {
      toast("Informe o motivo.");
      $("#ap-motivo").focus();
      return;
    }
    pedidoAdm(
      "Apagar período",
      alvo,
      `<b>${fint(p.n)}</b> valores em ${fint(p.datas)} datas, de ${dBR(p.de)} a ${dBR(p.ate)} (${p.vs.join(", ")}), saem da série publicada e ficam guardados.`,
      mot,
      () => {
        (ADM.apagados[alvo.id] = ADM.apagados[alvo.id] || []).push({ de: p.de, ate: p.ate, vars: p.vs });
        revisaoAdm(
          alvo,
          `Leituras de ${dBR(p.de)} a ${dBR(p.ate)} retiradas da série publicada (${p.vs.map(k => nomeVar(CAT_VARS.find(v => v.k === k))).join(", ")})`,
          mot
        );
      }
    );
    $("#ap-motivo").value = "";
  };
  ligarControlesSerie(pag);
  seletorAdm($("#s-sel"), null, () => {
    $("#ap-de").value = "";
    $("#ap-ate").value = "";
    carregarSerie(pag, false);
  });
  carregarSerie(pag, false);
}

const corpoSerie = () =>
  `
    <nav class="indice" aria-label="Seções da página"><a href="#admin/serie" data-alvo="s-res">Reservatório e período</a><a href="#admin/serie" data-alvo="s-tab">Ver e editar</a><a href="#admin/serie" data-alvo="s-apagar">Apagar período</a><a href="#admin/serie" data-alvo="s-plan">Gravar por planilha</a></nav>
    <section class="cartao secao" id="s-res" aria-labelledby="t-s-res"><h2 id="t-s-res"><small>1</small>Reservatório e período</h2>
      <p class="sub">Reservatório de qualquer módulo. O período vale para a tabela, para o gráfico e para a planilha-modelo.</p>
      <div id="s-sel"></div>
      <div class="periodo"><b>Período</b><span class="presets">${[
        ["30", "30 dias"],
        ["90", "90 dias"],
        ["365", "12 meses"]
      ]
        .map(([k, r]) => `<button type="button" class="preset" data-p="${k}">${r}</button>`)
        .join("")}</span>
        <span class="datas"><label>de <input type="date" id="s-de"></label><label>até <input type="date" id="s-ate"></label></span></div>
    </section>
    <section class="cartao secao" id="s-tab" aria-labelledby="t-s-tab"><h2 id="t-s-tab"><small>2</small>Ver e editar</h2>
      <p class="sub">Edite o valor na própria célula. A edição pontual não passa por aprovação: pede o motivo, grava a marca de alteração manual e fica no registro das ações, de onde pode ser desfeita.<span class="dica">Célula com ponto laranja: valor alterado manualmente; passe o mouse para ver o valor anterior.</span></p>
      <div class="adm-graf-cab"><label>Variável do gráfico <select id="s-var"></select></label></div><div id="s-graf"></div>
      <div class="adm-pend" id="s-pend" hidden></div>
      <div class="tab-box adm-serie"><table><thead id="s-cab"></thead><tbody id="s-corpo"></tbody></table></div><p class="mais-res" id="s-mais"></p>
    </section>
    <section class="cartao secao" id="s-apagar" aria-labelledby="t-s-apagar"><h2 id="t-s-apagar"><small>3</small>Apagar período</h2>
      <p class="sub">Tira um período da série publicada. Nada é apagado de verdade: os registros ficam guardados, com o motivo, e podem voltar. Passa por aprovação.</p>
      <div class="adm-form"><label>De<input type="date" id="ap-de"></label><label>Até<input type="date" id="ap-ate"></label><label class="largo">Motivo<input type="text" id="ap-motivo" placeholder="Ex.: leituras de régua deslocada"></label></div>
      <div class="adm-vars" id="ap-vars"></div>
      <p class="adm-efeito" id="ap-previa"></p>
      <button type="button" class="acao" id="ap-ir">Enviar para aprovação</button>
    </section>
    <section class="cartao secao" id="s-plan" aria-labelledby="t-s-plan"><h2 id="t-s-plan"><small>4</small>Gravar ou substituir período por planilha</h2>
      <p class="sub">Baixe a planilha-modelo do reservatório (já vem com o período escolhido), altere ou acrescente linhas e envie. O sistema confere o formato e mostra o que entra, o que muda e o que é rejeitado antes de gravar. Passa por aprovação.</p>
      <div class="adm-form"><button type="button" class="acao sec" id="pl-modelo">Baixar planilha-modelo (CSV)</button><label class="arquivo acao sec">Enviar planilha<input type="file" id="pl-arq" accept=".csv,text/csv" hidden></label><button type="button" class="acao sec" id="pl-ex">Usar um exemplo</button></div>
      <div id="pl-previa"></div>
    </section>`;

const noPeriodo = pag => pag.S.filter(l => l.t >= pag.st.de && l.t <= pag.st.ate);

function carregarSerie(pag, manterPeriodo) {
  pag.e = ADM.ent;
  pag.S = serieAdm(pag.e);
  pag.V = CAT_VARS.filter(v => pag.e.vars.includes(v.k));
  const ult = pag.S.length ? pag.S[pag.S.length - 1].t : D.data;
  if (!manterPeriodo) {
    pag.st.ate = ult;
    pag.st.de = isoMais(ult, -29);
    pag.st.pend.clear();
    pag.st.plan = null;
    $("#pl-previa").innerHTML = "";
  }
  $("#s-de").value = pag.st.de;
  $("#s-ate").value = pag.st.ate;
  $("#ap-de").value = $("#ap-de").value || isoMais(ult, -6);
  $("#ap-ate").value = $("#ap-ate").value || ult;
  $("#s-var").innerHTML = pag.V.map(v => `<option value="${v.k}">${esc(nomeVar(v))}</option>`).join("");
  $("#ap-vars").innerHTML =
    `<b>Variáveis</b>` +
    pag.V.map(v => `<label><input type="checkbox" value="${v.k}" checked> ${esc(nomeVar(v))}</label>`).join("");
  $$("#ap-vars input").forEach(c => (c.onchange = (...a) => previaApagar(pag, ...a)));
  desenharSerieAdm(pag);
  previaApagar(pag);
}

function desenharSerieAdm(pag) {
  const L = noPeriodo(pag),
    k = $("#s-var").value || pag.V[0].k,
    dias = diaEntre(pag.st.ate, pag.st.de) + 1;
  $$("#s-res .preset").forEach(b => b.classList.toggle("ativo", Number(b.dataset.p) === dias));
  linhaAdm(
    $("#s-graf"),
    [{ pts: L.map(l => [Date.parse(l.t), l.v[k] ?? null]), cor: COR.ana }],
    L.filter(l => l.m[k]).map(l => [Date.parse(l.t), l.v[k]]),
    [L.length ? dBR(L[0].t) : "", L.length ? dBR(L[L.length - 1].t) : ""]
  );
  $("#s-cab").innerHTML = `<tr><th>Data</th>${pag.V.map(v => `<th class="r">${esc(nomeVar(v))}</th>`).join("")}</tr>`;
  const R = [...L].reverse(),
    vis = R.slice(0, pag.st.mostrar);
  $("#s-corpo").innerHTML = vis.length
    ? vis
        .map(
          l =>
            `<tr><td class="dt">${dBR(l.t)}</td>${pag.V.map(v => {
              const ch = l.t + "|" + v.k,
                p = pag.st.pend.get(ch),
                m = l.m[v.k],
                val = p ? p.depois : l.v[v.k];
              return `<td class="r${m ? " manual" : ""}${p ? " mudou" : ""}"${m && m.antes !== undefined ? ` title="Alterado manualmente. Valor anterior: ${fmt(m.antes, decVar(v.k))}"` : m ? ' title="Gravado por planilha"' : ""}><input class="adm-cel" inputmode="decimal" data-ch="${ch}" value="${val == null ? "" : fmt(val, decVar(v.k)).replace(/\./g, "")}" aria-label="${esc(nomeVar(v))} em ${dBR(l.t)}"${podeEditar() ? "" : " disabled"}></td>`;
            }).join("")}</tr>`
        )
        .join("")
    : `<tr><td colspan="${pag.V.length + 1}" class="nota">Sem leituras no período. No protótipo, a maioria das usinas do SIN traz só o dia mais recente.</td></tr>`;
  $("#s-mais").innerHTML =
    R.length > vis.length
      ? `<button type="button" class="acao sec">Mostrar mais (${fint(R.length - vis.length)} restantes)</button>`
      : "";
  if ($("#s-mais button"))
    $("#s-mais button").onclick = () => {
      pag.st.mostrar += 62;
      desenharSerieAdm(pag);
    };
  $$(".adm-cel").forEach(
    inp =>
      (inp.onchange = () => {
        const [t, kk] = inp.dataset.ch.split("|"),
          l = pag.S.find(x => x.t === t),
          novo = numBR(inp.value),
          antes = l.v[kk] ?? null;
        if (inp.value.trim() !== "" && novo == null) {
          toast("Valor inválido: use número com vírgula decimal.");
          inp.value = antes == null ? "" : fmt(antes, decVar(kk)).replace(/\./g, "");
          return;
        }
        if (novo === antes || (novo != null && antes != null && Math.abs(novo - antes) < 1e-9))
          pag.st.pend.delete(inp.dataset.ch);
        else pag.st.pend.set(inp.dataset.ch, { antes, depois: novo });
        inp.parentElement.classList.toggle("mudou", pag.st.pend.has(inp.dataset.ch));
        pendentes(pag);
      })
  );
  pendentes(pag);
}

function pendentes(pag) {
  const el = $("#s-pend"),
    n = pag.st.pend.size;
  el.hidden = !n;
  if (!n) return;
  el.innerHTML = `<span><b>${n}</b> ${n === 1 ? "alteração" : "alterações"} por gravar</span><input type="text" id="s-motivo" placeholder="Motivo (obrigatório)" aria-label="Motivo da alteração"><button type="button" class="acao" id="s-gravar">Gravar</button><button type="button" class="acao sec" id="s-desc">Descartar</button>`;
  $("#s-desc").onclick = () => {
    pag.st.pend.clear();
    desenharSerieAdm(pag);
  };
  $("#s-gravar").onclick = () => {
    const mot = $("#s-motivo").value.trim();
    if (!mot) {
      toast("Informe o motivo da alteração.");
      $("#s-motivo").focus();
      return;
    }
    const alvo = pag.e,
      itens = [...pag.st.pend.entries()];
    ADM.manual[alvo.id] = ADM.manual[alvo.id] || {};
    itens.forEach(([ch, o]) => {
      const ja = ADM.manual[alvo.id][ch];
      ADM.manual[alvo.id][ch] = { antes: ja ? ja.antes : o.antes, depois: o.depois };
    });
    revisaoAdm(
      alvo,
      "Valor corrigido: " +
        itens
          .map(([ch]) => {
            const [t, kk] = ch.split("|");
            return `${nomeVar(CAT_VARS.find(v => v.k === kk))} de ${dBR(t)}`;
          })
          .join("; "),
      mot
    );
    trilhaAdm(
      "Edição de valor",
      alvo,
      itens
        .map(([ch, o]) => {
          const [t, kk] = ch.split("|");
          return `${dBR(t)} ${kk}: ${fmt(o.antes, decVar(kk))} → ${fmt(o.depois, decVar(kk))}`;
        })
        .join("; "),
      mot,
      "gravado, com marca de alteração manual",
      () => itens.forEach(([ch]) => delete ADM.manual[alvo.id][ch])
    );
    pag.st.pend.clear();
    toast(
      `${itens.length} ${itens.length === 1 ? "valor gravado" : "valores gravados"} com marca de alteração manual.`
    );
    carregarSerie(pag, true);
  };
}

function previaApagar(pag) {
  const de = $("#ap-de").value,
    ate = $("#ap-ate").value,
    vs = $$("#ap-vars input:checked").map(c => c.value),
    ok = de && ate && ate >= de && vs.length;
  const L = ok ? pag.S.filter(l => l.t >= de && l.t <= ate) : [],
    n = L.reduce((a, l) => a + vs.filter(k => l.v[k] != null).length, 0);
  $("#ap-previa").innerHTML = !ok
    ? "Informe o período e ao menos uma variável."
    : `<b>${fint(n)}</b> ${n === 1 ? "valor" : "valores"} em <b>${fint(L.length)}</b> ${L.length === 1 ? "data" : "datas"} saem da série publicada de ${esc(pag.e.nome)} (${dBR(de)} a ${dBR(ate)}).`;
  $("#ap-ir").disabled = !ok || !n || !podeEditar();
  return { de, ate, vs, n, datas: L.length };
}

// planilha: CSV do SAR (;, vírgula decimal, dd/mm/aaaa), colunas data e as variáveis do reservatório
function lerPlanilha(pag, txt) {
  const linhas = txt
      .replace(/^\uFEFF/, "")
      .split(/\r?\n/)
      .filter(x => x.trim()),
    cab = (linhas.shift() || "").split(";").map(x => x.trim()),
    rej = [],
    ent = [],
    mud = [];
  let iguais = 0;
  const cols = cab.map(c => pag.V.find(v => v.k === c)),
    porT = new Map(pag.S.map(l => [l.t, l]));
  if (cab[0] !== "data" || !cols.slice(1).some(Boolean)) {
    rej.push([
      "cabeçalho",
      "A primeira coluna tem de ser data e as demais, variáveis do reservatório: " + pag.V.map(v => v.k).join(", ")
    ]);
    return { rej, ent, mud, iguais, novos: [] };
  }
  const novos = [];
  linhas.forEach((ln, i) => {
    const c = ln.split(";"),
      mt = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec((c[0] || "").trim());
    const dt = mt && new Date(Date.UTC(+mt[3], +mt[2] - 1, +mt[1])); // 31/02 não existe: o dia e o mês têm de voltar iguais
    if (!mt || dt.getUTCDate() !== +mt[1] || dt.getUTCMonth() !== +mt[2] - 1) {
      rej.push([`linha ${i + 2}`, `data inválida: "${c[0]}" (a data não existe ou não está em dd/mm/aaaa)`]);
      return;
    }
    const t = `${mt[3]}-${mt[2]}-${mt[1]}`,
      atual = porT.get(t),
      v = {};
    if (t > isoMais(D.data, 1)) {
      rej.push([`linha ${i + 2}`, `data futura: ${c[0]}`]);
      return;
    }
    for (let j = 1; j < cab.length; j++) {
      if (!cols[j]) continue;
      const bruto = (c[j] || "").trim();
      if (bruto === "") continue;
      const x = numBR(bruto);
      if (x == null) {
        rej.push([`linha ${i + 2}`, `${cab[j]}: "${bruto}" não é número`]);
        continue;
      }
      const a = atual ? (atual.v[cab[j]] ?? null) : null;
      if (a != null && Math.abs(a - x) < 1e-9) {
        iguais++;
        continue;
      }
      v[cab[j]] = x;
      (atual && a != null ? mud : ent).push([t, cab[j], a, x]);
    }
    if (Object.keys(v).length) novos.push({ t, v });
  });
  return { rej, ent, mud, iguais, novos };
}

function previaPlanilha(pag, nome, txt) {
  const p = lerPlanilha(pag, txt),
    alvo = pag.e,
    tudo = [...p.mud, ...p.ent];
  pag.st.plan = p;
  $("#pl-previa").innerHTML = `<div class="adm-cards">
        <div class="card fixo"><div class="r">Entram</div><div class="v">${fint(p.ent.length)}</div><div class="n">valores em data ou variável sem dado</div></div>
        <div class="card fixo"><div class="r">Mudam</div><div class="v">${fint(p.mud.length)}</div><div class="n">valores diferentes dos publicados</div></div>
        <div class="card fixo"><div class="r">Iguais</div><div class="v">${fint(p.iguais)}</div><div class="n">não são regravados</div></div>
        <div class="card fixo${p.rej.length ? " alerta" : ""}"><div class="r">Rejeitados</div><div class="v">${fint(p.rej.length)}</div><div class="n">não entram; corrija e reenvie</div></div></div>
      <p class="nota">Arquivo: ${esc(nome)} · reservatório: ${esc(alvo.nome)}.</p>
      ${
        p.rej.length
          ? `<p class="adm-erro"><b>Rejeitados.</b> ${p.rej
              .slice(0, 6)
              .map(r => esc(r[0] + ", " + r[1]))
              .join("; ")}${p.rej.length > 6 ? "; e mais " + (p.rej.length - 6) : ""}.</p>`
          : ""
      }
      ${
        tudo.length
          ? `<div class="tab-box"><table><thead><tr><th>Data</th><th>Variável</th><th class="r">Publicado</th><th class="r">Planilha</th><th>O que acontece</th></tr></thead><tbody>${tudo
              .slice(0, 12)
              .map(
                ([t, k, a, x]) =>
                  `<tr><td class="dt">${dBR(t)}</td><td><code>${k}</code></td><td class="r num">${fmt(a, decVar(k))}</td><td class="r num">${fmt(x, decVar(k))}</td><td>${a == null ? "entra" : "substitui"}</td></tr>`
              )
              .join(
                ""
              )}</tbody></table></div>${tudo.length > 12 ? `<p class="nota">Mostrando 12 de ${fint(tudo.length)}.</p>` : ""}
      <div class="adm-form"><label class="largo">Motivo<input type="text" id="pl-motivo" placeholder="Ex.: série consistida enviada pelo operador"></label><button type="button" class="acao" id="pl-ir"${podeEditar() ? "" : " disabled"}>Enviar para aprovação</button></div>`
          : '<p class="nota">Nada a gravar: a planilha não tem valor novo nem diferente do publicado.</p>'
      }`;
  if ($("#pl-ir"))
    $("#pl-ir").onclick = () => {
      const mot = $("#pl-motivo").value.trim();
      if (!mot) {
        toast("Informe o motivo.");
        $("#pl-motivo").focus();
        return;
      }
      const datas = tudo.map(x => x[0]).sort();
      pedidoAdm(
        "Gravar período por planilha",
        alvo,
        `<b>${fint(p.ent.length)}</b> valores entram e <b>${fint(p.mud.length)}</b> substituem o publicado, de ${dBR(datas[0])} a ${dBR(datas[datas.length - 1])}; ${fint(p.rej.length)} rejeitados ficam de fora.`,
        mot,
        () => {
          (ADM.novos[alvo.id] = ADM.novos[alvo.id] || []).push(...p.novos);
          revisaoAdm(
            alvo,
            `${fint(p.ent.length + p.mud.length)} valores gravados ou substituídos por planilha, de ${dBR(datas[0])} a ${dBR(datas[datas.length - 1])}`,
            mot
          );
        }
      );
      $("#pl-previa").innerHTML = "";
    };
}

const paraCSV = (pag, L) =>
  [["data", ...pag.V.map(v => v.k)].join(";")]
    .concat(L.map(l => [dBR(l.t), ...pag.V.map(v => nCSV(l.v[v.k]))].join(";")))
    .join("\r\n");

const ligarControlesSerie = pag => {
  $("#pl-modelo").onclick = () =>
    salvarCSV(
      ["data", ...pag.V.map(v => v.k)],
      noPeriodo(pag).map(l => [dBR(l.t), ...pag.V.map(v => l.v[v.k])]),
      `sar_planilha_${semAc(pag.e.nome).replace(/[^a-z0-9]+/g, "_")}.csv`
    );
  $("#pl-arq").onchange = ev => {
    const f = ev.target.files[0];
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => previaPlanilha(pag, f.name, String(rd.result));
    rd.readAsText(f, "utf-8");
    ev.target.value = "";
  };
  $("#pl-ex").onclick = () => {
    const L = noPeriodo(pag)
        .slice(-8)
        .map(l => ({ t: l.t, v: { ...l.v } })),
      k = pag.V[0].k; // exemplo: três valores alterados, um dia novo e uma linha com data errada
    L.slice(0, 3).forEach(l => {
      if (l.v[k] != null) l.v[k] = Math.round((l.v[k] + 0.05) * 100) / 100;
    });
    if (L.length) L.push({ t: isoMais(L[L.length - 1].t, 1), v: { [k]: L[L.length - 1].v[k] } });
    previaPlanilha(pag, "exemplo do protótipo", paraCSV(pag, L) + "\r\n31/02/2026;1,00");
  };
  $$("#s-res .preset").forEach(
    b =>
      (b.onclick = () => {
        pag.st.de = isoMais(pag.st.ate, -(Number(b.dataset.p) - 1));
        pag.st.mostrar = 31;
        carregarSerie(pag, true);
      })
  );
  $("#s-de").onchange = $("#s-ate").onchange = () => {
    if ($("#s-de").value && $("#s-ate").value && $("#s-ate").value >= $("#s-de").value) {
      pag.st.de = $("#s-de").value;
      pag.st.ate = $("#s-ate").value;
      pag.st.mostrar = 31;
      desenharSerieAdm(pag);
    }
  };
  $("#s-var").onchange = (...a) => desenharSerieAdm(pag, ...a);
};

/* ---------------- 3. cadastro, modo de exibição e CAV */
function admCadastro() {
  tituloAdm(
    "Cadastro e curva",
    "Dados cadastrais, modo de exibição e curva cota-área-volume. Mudança que altera número publicado tem data de vigência, mostra o efeito antes e passa por aprovação."
  );
  $("#conteudo").innerHTML = corpoCadastro();
  seletorAdm($("#k-sel"), null, tudoCadastro);
  tudoCadastro();
}

const corpoCadastro = () =>
  `
    <nav class="indice" aria-label="Seções da página"><a href="#admin/cadastro" data-alvo="k-res">Reservatório</a><a href="#admin/cadastro" data-alvo="k-cad">Dados cadastrais</a><a href="#admin/cadastro" data-alvo="k-modo">Modo de exibição</a><a href="#admin/cadastro" data-alvo="k-cav">Curva cota-área-volume</a></nav>
    <section class="cartao secao" id="k-res" aria-labelledby="t-k-res"><h2 id="t-k-res"><small>1</small>Reservatório</h2><p class="sub">Reservatório de qualquer módulo.</p><div id="k-sel"></div></section>
    <section class="cartao secao" id="k-cad" aria-labelledby="t-k-cad"><h2 id="t-k-cad"><small>2</small>Dados cadastrais</h2>
      <p class="sub">A capacidade muda o Volume (%) do reservatório e o volume acumulado do estado: tem vigência e passa por aprovação. A vigência pode ser a data do levantamento, no passado: as leituras desde ela passam a usar a capacidade nova, e as anteriores continuam com a antiga. Os demais campos são gravados na hora e ficam no registro das ações.</p><div id="k-form"></div></section>
    <section class="cartao secao" id="k-modo" aria-labelledby="t-k-modo"><h2 id="t-k-modo"><small>3</small>Modo de exibição</h2>
      <p class="sub">Só nos reservatórios do Nordeste e Semiárido. Definido pela área técnica, com data e motivo. Vale em todo o sistema de uma vez: tabelas, agregados, mapa, API e área de dados, onde o reservatório retirado segue disponível, marcado.</p><div id="k-modo-form"></div></section>
    <section class="cartao secao" id="k-cav" aria-labelledby="t-k-cav"><h2 id="t-k-cav"><small>4</small>Curva cota-área-volume</h2>
      <p class="sub">Só nos reservatórios do Nordeste e Semiárido com volume: no SIN, o volume útil vem do ONS, e em Outros Sistemas Hídricos, das fontes de cada sistema. A curva nova vale da data de vigência em diante: o volume é recalculado só a partir dela, e o histórico anterior fica como foi publicado. A vigência pode ser a data do levantamento, no passado. Se o levantamento também muda a capacidade, as duas entram juntas, com a mesma vigência.</p><div id="k-cav-form"></div></section>`;

function tudoCadastro() {
  const pag = {}; // estado da página, passado às funções abaixo

  pag.e = ADM.ent;
  const r = pag.e.r || {};
  pag.cap = pag.e.src === "ne" ? r.capacidade_hm3 : pag.e.src === "os" ? pag.e.F.cap : null;
  const lat = r.lat ?? null;
  const lon = r.lon ?? null;
  pag.S = serieAdm(pag.e);
  pag.ult = [...pag.S].reverse().find(l => l.v.volume_hm3 != null);
  pag.hoje = new Date().toISOString().slice(0, 10);
  pag.dis = podeEditar() ? "" : " disabled";
  pag.C = [
    ["nome", "Nome", pag.e.nome],
    ["municipio", "Município", pag.e.municipio],
    ["uf", "UF", pag.e.uf],
    ["bacia", "Bacia ou sistema", pag.e.bacia],
    ["lat", "Latitude", lat == null ? "" : String(lat).replace(".", ",")],
    ["lon", "Longitude", lon == null ? "" : String(lon).replace(".", ",")],
    // cota máxima (Diego, 25/09/2026): referência no gráfico da cota da ficha do açude; não altera número publicado
    ...(pag.e.src === "ne"
      ? [["cota_max", "Cota máxima (m)", r.cota_maxima_m == null ? "" : String(r.cota_maxima_m).replace(".", ",")]]
      : [])
  ];
  $("#k-form").innerHTML = marcacaoTudoCadastro(pag);
  $$("#k-form input, #k-form select").forEach(i => (i.oninput = i.onchange = (...a) => efeitoTudoCadastro(pag, ...a)));
  efeitoTudoCadastro(pag);
  $("#k-ir").onclick = () => {
    const x = efeitoTudoCadastro(pag),
      mot = $("#k-motivo").value.trim();
    if (!mot) {
      toast("Informe o motivo.");
      $("#k-motivo").focus();
      return;
    }
    if (x.mudaCap && !$("#k-lev-data").value) {
      toast("Informe a data do levantamento.");
      $("#k-lev-data").focus();
      return;
    }
    const capN = numBR($("#k-cap").value),
      vigK = $("#k-vig").value || pag.hoje,
      doc = $("#k-doc").value.trim();
    const lev = `${$("#k-lev").value} de ${dBR($("#k-lev-data").value)}${doc ? "; documento: " + doc : ""}`;
    if (x.mudaCap)
      pedidoAdm(
        "Dados cadastrais",
        pag.e,
        x.h.join(" · ") + `. Vigência: ${dBR(vigK)}. Levantamento: ${esc(lev)}.`,
        mot,
        () =>
          revisaoAdm(
            pag.e,
            `Capacidade alterada de ${fmt(pag.cap, 2)} para ${fmt(capN, 2)} hm³ (${lev}), vigente desde ${dBR(vigK)}: o Volume (%) é recalculado dessa data em diante, e o anterior fica com a capacidade antiga`,
            mot
          )
      );
    else {
      trilhaAdm("Dados cadastrais", pag.e, x.h.join("; ").replace(/<[^>]+>/g, ""), mot);
      toast("Cadastro gravado. No protótipo as páginas públicas não mudam.");
    }
    tudoCadastro();
  };
  // modo de exibição: com volume, só com nível ou retirado do acompanhamento (Anexo I, 4.1). Regra só do Nordeste e
  // Semiárido (Diego, 24/09/2026): no SIN e em Outros Sistemas a seção informa que não se aplica.
  if (pag.e.mod !== "NE")
    $("#k-modo-form").innerHTML =
      `<p class="nota">Não se aplica: o modo de exibição (com volume, só com nível ou retirado do acompanhamento) é regra do módulo Nordeste e Semiárido.</p>`;
  else {
    const MODOS = { volume: "com volume", nivel: "só com nível", retirado: "retirado do acompanhamento" };
    const modo =
      ADM.modo[pag.e.id] ||
      (pag.e.retirado ? "retirado" : pag.e.src === "nv" || /só nível/.test(pag.e.tipo) ? "nivel" : "volume");
    $("#k-modo-form").innerHTML = `<p class="adm-efeito">Hoje: <b>${MODOS[modo]}</b>.</p>
      <div class="adm-form"><label>Novo modo<select id="m-modo">${Object.entries(MODOS)
        .filter(([k]) => k !== modo)
        .map(([k, rot]) => `<option value="${k}">${rot[0].toUpperCase() + rot.slice(1)}</option>`)
        .join("")}</select></label><label>Data<input type="date" id="m-data" value="${pag.hoje}"${pag.dis}></label>
        <label>Decisão de<input type="text" id="m-quem" placeholder="Área técnica responsável"${pag.dis}></label><label class="largo">Motivo<input type="text" id="m-motivo" placeholder="Ex.: régua desativada; reservatório rompido; curva cota-volume em revisão"${pag.dis}></label>
        <button type="button" class="acao" id="m-ir"${pag.dis}>Enviar para aprovação</button></div>
      <p class="nota">Só com nível: o reservatório aparece com o nível e sai do volume acumulado. Retirado do acompanhamento: sai das tabelas, dos gráficos, dos mapas e dos totais e segue na área de dados e na API, marcado.</p>`;
    $("#m-ir").onclick = () => {
      const mot = $("#m-motivo").value.trim(),
        quem = $("#m-quem").value.trim(),
        novo = $("#m-modo").value;
      if (!mot || !quem) {
        toast("Informe o motivo e de quem é a decisão.");
        return;
      }
      pedidoAdm(
        "Modo de exibição",
        pag.e,
        `<b>${MODOS[modo][0].toUpperCase() + MODOS[modo].slice(1)}</b> → <b>${MODOS[novo]}</b> em ${dBR($("#m-data").value || pag.hoje)}. Decisão de: ${esc(quem)}.`,
        mot,
        () => {
          ADM.modo[pag.e.id] = novo;
        }
      );
      tudoCadastro();
    };
  }
  // CAV
  const pares = new Map();
  pag.S.forEach(l => {
    if (l.v.cota_m != null && l.v.volume_hm3 != null) pares.set(l.v.cota_m, l.v.volume_hm3);
  });
  pag.vig = [...pares.entries()].sort((a, b) => a[0] - b[0]);
  if (pag.e.src !== "ne" || pag.vig.length < 5) {
    $("#k-cav-form").innerHTML =
      `<p class="nota">${pag.e.src === "ne" ? "O protótipo não traz pares de cota e volume suficientes deste reservatório para mostrar a curva." : "A atualização da CAV está prevista para os reservatórios do Nordeste e Semiárido com volume. Escolha um deles (por exemplo, Castanhão)."}</p>`;
    return;
  }
  pag.st = { nova: null, nome: "", lev: LEV_ADM[0], levData: "", doc: "", mot: "", mudaCap: false, capN: pag.cap };
  cav(pag);
}

const marcacaoTudoCadastro = pag =>
  `<div class="adm-form grade">
        <label>Código<input type="text" value="${esc(pag.e.codigo)}" disabled></label>${pag.C.map(([k, rot, v]) => `<label>${rot}<input type="text" data-c="${k}" value="${esc(v ?? "")}"${pag.dis}></label>`).join("")}
        <label>Capacidade (hm³)<input type="text" inputmode="decimal" id="k-cap" value="${pag.cap == null ? "" : fmt(pag.cap, 2).replace(/\./g, "")}"${pag.cap == null ? " disabled" : pag.dis}></label>
        <label>Vigência<input type="date" id="k-vig" value="${pag.hoje}"${pag.dis}></label><label>Levantamento<select id="k-lev"${pag.dis}>${LEV_ADM.map(x => `<option>${x}</option>`).join("")}</select></label><label>Data do levantamento<input type="date" id="k-lev-data"${pag.dis}></label><label class="largo">Documento de referência<input type="text" id="k-doc" placeholder="Ex.: relatório da batimetria; processo SEI nº"${pag.dis}></label><label class="largo">Motivo<input type="text" id="k-motivo" placeholder="Ex.: batimetria de 2026"${pag.dis}></label></div>
      ${pag.cap == null ? `<p class="nota">${pag.e.mod === "SIN" ? "No SIN o SAR publica o volume útil em % informado pelo ONS: não há capacidade no cadastro." : "Reservatório sem capacidade cadastrada: é acompanhado só pelo nível."}</p>` : ""}
      <p class="adm-efeito" id="k-efeito"></p><button type="button" class="acao" id="k-ir" disabled>Gravar</button>`;

const efeitoTudoCadastro = pag => {
  const mud = pag.C.filter(([k, , v]) => $(`[data-c="${k}"]`).value.trim() !== String(v ?? "")).map(([k, rot, v]) => [
    rot,
    v ?? "–",
    $(`[data-c="${k}"]`).value.trim()
  ]);
  const nova = pag.cap == null ? null : numBR($("#k-cap").value),
    mudaCap = nova != null && nova > 0 && Math.abs(nova - pag.cap) > 1e-9;
  let h = mud.map(m => `${m[0]}: ${esc(m[1])} → <b>${esc(m[2])}</b>`);
  if (mudaCap) {
    h.push(`Capacidade: ${fmt(pag.cap, 2)} → <b>${fmt(nova, 2)} hm³</b>`);
    if (pag.ult) {
      h.push(
        `Volume (%) em ${dBR(pag.ult.t)}: ${fmt((pag.ult.v.volume_hm3 / pag.cap) * 100, 2)}% → <b>${fmt((pag.ult.v.volume_hm3 / nova) * 100, 2)}%</b> (${fmt(pag.ult.v.volume_hm3, 2)} hm³)`
      );
    }
    const vgK = $("#k-vig").value || pag.hoje,
      nDesde = pag.S.filter(l => l.t >= vgK && l.v.volume_hm3 != null).length;
    h.push(
      `${fint(nDesde)} ${nDesde === 1 ? "leitura passa" : "leituras passam"} a usar a capacidade nova de ${dBR(vgK)} em diante; as anteriores continuam com a antiga`
    );
    // volume acumulado do estado pelo cálculo da página do NE: só muda se o reservatório tem medição na janela
    const NE = pag.e.src === "ne" ? sitNEAdm() : null,
      rj = NE && NE.R[pag.e.r.i],
      est = NE && NE.S.estados.find(x => x.uf === pag.e.uf);
    if (rj && !rj.sem_info && est && est.capacidade_com_dado_hm3)
      h.push(
        `Volume acumulado ${esc(est.estado)} em ${dBR(NEd.data)}: ${fmt(est.volume_pct, 2)}% → <b>${fmt((est.volume_hm3 / (est.capacidade_com_dado_hm3 + nova - pag.cap)) * 100, 2)}%</b>`
      );
  }
  $("#k-efeito").innerHTML = h.length
    ? `<b>Efeito${mudaCap ? " a partir de " + dBR($("#k-vig").value || pag.hoje) : ""}.</b> ` + h.join(" · ")
    : "Nenhuma alteração.";
  $("#k-ir").textContent = mudaCap ? "Enviar para aprovação" : "Gravar";
  $("#k-ir").disabled = !h.length || !podeEditar();
  return { h, mudaCap };
};

const interp = (T, c) => {
  if (c <= T[0][0]) return T[0][1];
  for (let i = 1; i < T.length; i++)
    if (c <= T[i][0]) return T[i - 1][1] + ((T[i][1] - T[i - 1][1]) * (c - T[i - 1][0])) / (T[i][0] - T[i - 1][0]);
  return T[T.length - 1][1];
};

function cav(pag) {
  const N = pag.st.nova,
    vg = $("#v-vig") ? $("#v-vig").value : isoMais(D.data, -14),
    desde = pag.S.filter(l => l.t >= vg && l.v.cota_m != null),
    u = desde[desde.length - 1];
  $("#k-cav-form").innerHTML =
    `<p class="nota">Curva vigente: ${fint(pag.vig.length)} pares de cota e volume lidos da própria série publicada (de ${fmt(pag.vig[0][0], 2)} a ${fmt(pag.vig[pag.vig.length - 1][0], 2)} m). No sistema, a tabela cota-área-volume do cadastro.</p>
        <div class="adm-form"><button type="button" class="acao sec" id="v-modelo">Baixar a curva vigente (CSV)</button><label class="arquivo acao sec">Enviar curva nova<input type="file" id="v-arq" accept=".csv,text/csv" hidden${pag.dis}></label><button type="button" class="acao sec" id="v-ex"${pag.dis}>Usar um exemplo</button></div>
        <div id="v-graf"></div>
        ${
          N
            ? `<p class="adm-leg"><span><i style="background:${COR.ana}"></i>vigente</span><span><i class="trac"></i>nova (${esc(pag.st.nome)}, ${fint(N.length)} pontos)</span></p>
          <div class="adm-form grade"><label>Vigência<input type="date" id="v-vig" value="${vg}"></label><label>Levantamento<select id="v-lev">${LEV_ADM.map(x => `<option${x === pag.st.lev ? " selected" : ""}>${x}</option>`).join("")}</select></label>
            <label>Data do levantamento<input type="date" id="v-lev-data" value="${pag.st.levData}"></label><label class="largo">Documento de referência<input type="text" id="v-doc" value="${esc(pag.st.doc)}" placeholder="Ex.: relatório da batimetria; processo SEI nº"></label>
            <label class="largo">Motivo<input type="text" id="v-motivo" value="${esc(pag.st.mot)}" placeholder="Ex.: batimetria de 2026"></label></div>
          <div class="adm-vars"><label><input type="checkbox" id="v-cap-ck"${pag.st.mudaCap ? " checked" : ""}> O levantamento também muda a capacidade, com a mesma vigência</label></div>
          <div class="adm-form">${pag.st.mudaCap ? `<label>Capacidade nova (hm³)<input type="text" inputmode="decimal" id="v-cap" value="${fmt(pag.st.capN, 2).replace(/\./g, "")}"></label>` : ""}<button type="button" class="acao" id="v-ir">Enviar para aprovação</button></div>
          <p class="adm-efeito">${u ? `<b>Efeito.</b> ${fint(desde.length)} ${desde.length === 1 ? "leitura é recalculada" : "leituras são recalculadas"} de ${dBR(vg)} em diante. Em ${dBR(u.t)}, cota ${fmt(u.v.cota_m, 2)} m: volume ${fmt(u.v.volume_hm3, 2)} → <b>${fmt(interp(N, u.v.cota_m), 2)} hm³</b>${pag.st.mudaCap && pag.cap ? `; volume (%) ${fmt((u.v.volume_hm3 / pag.cap) * 100, 1)}% → <b>${fmt((interp(N, u.v.cota_m) / pag.st.capN) * 100, 1)}%</b>, com a capacidade de ${fmt(pag.cap, 2)} → <b>${fmt(pag.st.capN, 2)} hm³</b> na mesma vigência` : ""}. O histórico anterior a ${dBR(vg)} não muda.` : "Nenhuma leitura da vigência em diante."}</p>`
            : ""
        }`;
  linhaAdm(
    $("#v-graf"),
    [{ pts: pag.vig, cor: COR.ana }].concat(N ? [{ pts: N, cor: COR.bronze, tracejada: true }] : []),
    [],
    [fmt(pag.vig[0][0], 2) + " m (cota)", fmt(pag.vig[pag.vig.length - 1][0], 2) + " m · volume em hm³"]
  );
  $("#v-modelo").onclick = () => salvarCSV(["cota_m", "volume_hm3"], pag.vig, `sar_cav_${pag.e.codigo}.csv`);
  $("#v-ex").onclick = () => {
    const passo = Math.max(1, Math.floor(pag.vig.length / 24));
    pag.st.nova = pag.vig
      .filter((_, i) => i % passo === 0 || i === pag.vig.length - 1)
      .map(([c, v]) => [c, Math.round(v * 0.97 * 100) / 100]);
    pag.st.nome = "exemplo ilustrativo: volume 3% menor";
    cav(pag);
  };
  $("#v-arq").onchange = ev => {
    const f = ev.target.files[0];
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      const L = String(rd.result)
          .replace(/^\uFEFF/, "")
          .split(/\r?\n/)
          .filter(x => x.trim()),
        cab = L.shift()
          .split(";")
          .map(x => x.trim()),
        ic = cab.indexOf("cota_m"),
        iv = cab.indexOf("volume_hm3");
      const T =
        ic < 0 || iv < 0
          ? []
          : L.map(x => x.split(";"))
              .map(c => [numBR(c[ic] || ""), numBR(c[iv] || "")])
              .filter(p => p[0] != null && p[1] != null)
              .sort((a, b) => a[0] - b[0]);
      const cresce = T.every((p, i) => !i || (p[0] > T[i - 1][0] && p[1] >= T[i - 1][1]));
      if (T.length < 3 || !cresce) {
        toast(
          T.length < 3
            ? "Curva rejeitada: o arquivo precisa das colunas cota_m e volume_hm3 e de ao menos 3 pontos."
            : "Curva rejeitada: cota e volume têm de crescer juntos."
        );
        return;
      }
      pag.st.nova = T;
      pag.st.nome = f.name;
      cav(pag);
    };
    rd.readAsText(f, "utf-8");
  };
  const guarda = () => {
    if (!$("#v-motivo")) return;
    pag.st.lev = $("#v-lev").value;
    pag.st.levData = $("#v-lev-data").value;
    pag.st.doc = $("#v-doc").value;
    pag.st.mot = $("#v-motivo").value;
    pag.st.mudaCap = $("#v-cap-ck").checked;
    if ($("#v-cap")) pag.st.capN = numBR($("#v-cap").value) || pag.st.capN;
  };
  if ($("#v-vig")) {
    ["v-lev", "v-lev-data", "v-doc", "v-motivo"].forEach(id => ($("#" + id).oninput = $("#" + id).onchange = guarda));
    $("#v-vig").onchange = () => {
      guarda();
      cav(pag);
    };
    $("#v-cap-ck").onchange = () => {
      guarda();
      cav(pag);
    };
    if ($("#v-cap"))
      $("#v-cap").onchange = () => {
        guarda();
        cav(pag);
      };
  }
  if ($("#v-ir"))
    $("#v-ir").onclick = () => {
      guarda();
      const mot = pag.st.mot.trim();
      if (!mot) {
        toast("Informe o motivo.");
        $("#v-motivo").focus();
        return;
      }
      if (!pag.st.levData) {
        toast("Informe a data do levantamento.");
        $("#v-lev-data").focus();
        return;
      }
      const lev = `${pag.st.lev} de ${dBR(pag.st.levData)}${pag.st.doc.trim() ? "; documento: " + pag.st.doc.trim() : ""}`,
        capTxt =
          pag.st.mudaCap && pag.cap
            ? `; capacidade ${fmt(pag.cap, 2)} → ${fmt(pag.st.capN, 2)} hm³, na mesma vigência`
            : "";
      pedidoAdm(
        pag.st.mudaCap ? "Atualizar CAV e capacidade" : "Atualizar CAV",
        pag.e,
        `Curva nova (${esc(pag.st.nome)}, ${fint(N.length)} pontos), vigência ${dBR(vg)}: ${fint(desde.length)} leituras recalculadas${u ? `; em ${dBR(u.t)}, ${fmt(u.v.volume_hm3, 2)} → <b>${fmt(interp(N, u.v.cota_m), 2)} hm³</b>` : ""}${capTxt}. Levantamento: ${esc(lev)}. Histórico anterior mantido.`,
        mot,
        () =>
          revisaoAdm(
            pag.e,
            `Curva cota-área-volume${pag.st.mudaCap ? " e capacidade" : ""} atualizadas (${lev}), vigentes desde ${dBR(vg)}: o volume${pag.st.mudaCap ? " e o volume (%)" : ""} são recalculados dessa data em diante`,
            mot
          )
      );
      Object.assign(pag.st, { nova: null, levData: "", doc: "", mot: "", mudaCap: false, capN: pag.cap });
      cav(pag);
    };
}

/* ---------------- 4. aprovações */
function admAprovacoes() {
  const ag = ADM.pedidos.filter(p => p.situacao === "aguardando");
  tituloAdm(
    "Aprovações",
    "Operações destrutivas ou de efeito amplo esperam um segundo olhar: apagar ou gravar período, capacidade, curva cota-área-volume, modo de exibição, inclusão de reservatório e composição de agregado. Quem pede não aprova o próprio pedido.",
    `<span><b>${ag.length}</b> ${ag.length === 1 ? "pedido aguardando" : "pedidos aguardando"}</span>`
  );
  const cartao = p => {
    const meu = p.por === ADM_USU[ADM.perfil],
      pode = ADM.perfil === "aprovador" && !meu && p.situacao === "aguardando";
    return `<article class="adm-pedido ${p.situacao === "aguardando" ? "" : "fechado"}" data-n="${p.n}"><header><span class="adm-tipo">${esc(p.tipo)}</span><b>${esc(p.res)}</b>${p.cod ? `<span class="cod">código ${esc(p.cod)}</span>` : ""}${p.exemplo ? '<span class="ret">exemplo</span>' : ""}<span class="adm-sit ${p.situacao === "aprovado" ? "ok" : p.situacao === "devolvido" ? "erro" : "fila"}">${p.situacao}</span></header>
      <p class="quem">Pedido por <b>${esc(p.por)}</b> em ${esc(p.quando)}${p.decisao ? ` · ${esc(p.decisao)}` : ""}</p><p class="efeito">${p.efeito}</p>${p.cascata ? `<div class="adm-cascata" data-casc="${p.n}"></div>` : ""}<p class="motivo"><b>Motivo.</b> ${esc(p.motivo)}</p>
      ${
        p.situacao === "aguardando"
          ? `<div class="adm-form"><label class="largo">Comentário<input type="text" class="coment" placeholder="Obrigatório para devolver"${pode ? "" : " disabled"}></label><button type="button" class="acao ap"${pode ? "" : " disabled"}>Aprovar</button><button type="button" class="acao sec dv"${pode ? "" : " disabled"}>Devolver</button></div>
        ${pode ? "" : `<p class="nota">${ADM.perfil !== "aprovador" ? "Só o perfil aprovador decide. Troque o perfil no alto da página para simular." : "Quem pede não aprova o próprio pedido."}</p>`}`
          : ""
      }</article>`;
  };
  const fech = ADM.pedidos.filter(p => p.situacao !== "aguardando");
  $("#conteudo").innerHTML = `
    <nav class="indice" aria-label="Seções da página"><a href="#admin/aprovacoes" data-alvo="p-ag">Aguardando</a><a href="#admin/aprovacoes" data-alvo="p-fe">Decididos</a></nav>
    <section class="cartao secao" id="p-ag" aria-labelledby="t-p-ag"><h2 id="t-p-ag"><small>1</small>Aguardando</h2><p class="sub">Cada pedido traz o efeito calculado quando foi feito. Aprovado, vale em todo o sistema; devolvido, volta a quem pediu com o comentário.</p>
      ${ag.length ? ag.map(cartao).join("") : '<p class="nota">Nenhum pedido aguardando.</p>'}</section>
    <section class="cartao secao" id="p-fe" aria-labelledby="t-p-fe"><h2 id="t-p-fe"><small>2</small>Decididos</h2><p class="sub">Pedidos aprovados ou devolvidos nesta sessão.</p>${fech.length ? fech.map(cartao).join("") : '<p class="nota">Nenhum pedido decidido nesta sessão.</p>'}</section>`;
  ADM.pedidos
    .filter(p => p.cascata)
    .forEach(p => {
      const h = $(`[data-casc="${p.n}"]`);
      if (h) h.append(cascataTopoSVG(p.cascata, "__nova"));
    });
  $$(".adm-pedido").forEach(el => {
    const p = ADM.pedidos.find(x => x.n === Number(el.dataset.n)),
      decide = sit => {
        const c = $(".coment", el).value.trim();
        if (sit === "devolvido" && !c) {
          toast("Escreva o comentário para devolver.");
          $(".coment", el).focus();
          return;
        }
        const quem = ADM_USU[ADM.perfil];
        p.situacao = sit;
        p.decisao = `${sit} por ${quem} em ${agoraAdm()}${c ? ": " + c : ""}`;
        if (sit === "aprovado" && p.aplicar) p.aplicar();
        if (sit === "devolvido" && p.devolver) p.devolver();
        trilhaAdm(p.tipo, p.e, `Pedido nº ${p.n} ${sit}${c ? " (" + c + ")" : ""}`, p.motivo, sit);
        admAprovacoes();
        montarFaixa(true);
      };
    if ($(".ap", el)) $(".ap", el).onclick = () => decide("aprovado");
    if ($(".dv", el)) $(".dv", el).onclick = () => decide("devolvido");
  });
}

/* ---------------- 5. trilha de auditoria */
function admTrilha() {
  tituloAdm(
    "Registro das ações",
    "Tudo o que foi feito na área administrativa: quem, quando, o quê, o valor anterior e o novo, e o motivo. A edição pontual pode ser desfeita daqui.",
    `<span><b>${ADM.trilha.length}</b> registros nesta sessão</span>`
  );
  $("#conteudo").innerHTML = `
    <nav class="indice" aria-label="Seções da página"><a href="#admin/trilha" data-alvo="t-reg">Registros</a></nav>
    <section class="cartao secao" id="t-reg" aria-labelledby="t-t-reg"><h2 id="t-t-reg"><small>1</small>Registros</h2>
      <div class="baixar"><button type="button" id="t-csv"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2v8m0 0L5 7m3 3 3-3M3 13h10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>CSV</button></div>
      <p class="sub">No protótipo o registro das ações guarda o que foi feito nesta sessão e se perde ao recarregar a página. No sistema é permanente.</p>
      <div class="busca-dados"><input type="search" id="t-busca" placeholder="Filtrar por reservatório, operação, pessoa ou motivo" aria-label="Filtrar o registro das ações" autocomplete="off"></div>
      <div id="t-lista"></div></section>`;
  const filtrada = () => {
    const tm = normalizaBusca($("#t-busca").value).split(/\s+/).filter(Boolean);
    return ADM.trilha.filter(x =>
      tm.every(t =>
        normalizaBusca(`${x.op} ${x.res} ${x.cod} ${x.quem} ${x.motivo} ${x.detalhe} ${x.situacao}`).includes(t)
      )
    );
  };
  function lista() {
    const L = filtrada();
    $("#t-lista").innerHTML = L.length
      ? `<div class="tab-box adm-trilha"><table><colgroup><col style="width:12%"><col style="width:11%"><col style="width:14%"><col style="width:14%"><col><col style="width:16%"><col style="width:11%"></colgroup>
      <thead><tr><th>Quando</th><th>Quem</th><th>Operação</th><th>Reservatório</th><th>Detalhe</th><th>Motivo</th><th>Situação</th></tr></thead>
      <tbody>${L.map(
        x => `<tr><td>${esc(x.quando)}</td><td>${esc(x.quem)}</td><td><span class="nm">${esc(x.op)}</span></td><td>${esc(x.res)}${x.cod ? `<span class="rio">código ${esc(x.cod)}</span>` : ""}</td><td>${esc(x.detalhe)}</td><td>${esc(x.motivo || "–")}</td>
        <td>${esc(x.situacao)}${x.desfazer && !x.desfeito && podeEditar() ? `<button type="button" class="adm-desf" data-n="${x.n}">Desfazer</button>` : ""}</td></tr>`
      ).join("")}</tbody></table></div>`
      : `<p class="nota">${ADM.trilha.length ? "Nenhum registro com esse filtro." : "Nenhum registro ainda. Faça uma correção de série, force uma carga ou envie um pedido para ver o registro se formar."}</p>`;
    $$(".adm-desf").forEach(
      b =>
        (b.onclick = () => {
          const x = ADM.trilha.find(y => y.n === Number(b.dataset.n));
          x.desfazer();
          x.desfeito = true;
          x.situacao = "desfeito";
          trilhaAdm(
            "Desfazer",
            { nome: x.res, codigo: x.cod },
            `Desfeito o registro nº ${x.n}: ${x.detalhe}`,
            "",
            "gravado"
          );
          toast("Alteração desfeita: voltam os valores anteriores.");
          admTrilha();
          montarFaixa(true);
        })
    );
  }
  $("#t-busca").oninput = lista;
  $("#t-csv").onclick = () =>
    salvarCSV(
      ["numero", "quando", "quem", "operacao", "reservatorio", "codigo", "detalhe", "motivo", "situacao"],
      filtrada().map(x => [x.n, x.quando, x.quem, x.op, x.res, x.cod, x.detalhe, x.motivo, x.situacao]),
      "sar_registro_das_acoes.csv"
    );
  lista();
}

export {
  abasAdm,
  ADM,
  ADM_INT,
  ADM_USU,
  agoraAdm,
  numBR,
  paginaAdmin,
  pedidoAdm,
  podeEditar,
  revisaoAdm,
  tituloAdm,
  trilhaAdm
};
