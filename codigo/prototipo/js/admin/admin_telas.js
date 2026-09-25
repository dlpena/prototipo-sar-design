/* Área administrativa, telas de acompanhamento, dados e publicação: cobertura, valores suspeitos (fila
   de revisão), inclusão de reservatório, códigos das fontes, agrupamentos, avisos e textos das páginas e parâmetros. O
   núcleo (perfis, abas, integrações, correção de série, cadastro e curva, aprovações e registro das ações) está em
   admin_nucleo.js. */
import { contexto } from "../contexto.js";
import { FOLGA30 } from "../regras.js";
import { AFL_RETIRADAS, CAN, D, NEd, SD } from "../dados_embutidos.js";
import { $, $$, caso, COR, dBR, esc, fint, fmt, normalizaBusca, semAc, toast } from "../base.js";
import { salvarCSV } from "../exportacao.js";
import { afluentesEm, cadeiaRio, refazJusantes, svgCascata, topoGrande, trechoConfluencia } from "../topologia.js";
import { COR_MOD } from "../inicio.js";
import { isoDia, NVE, situacaoNE } from "../ne.js";
import { COORD_OS, diaEntre, isoMais, NOME_SIS } from "../outros.js";
import { FOS } from "../outros_sistemas.js";
import { CAT_VARS, entidadesDados, nomeVar, ROT_MOD } from "../dados.js";
import {
  abasAdm,
  ADM,
  ADM_INT,
  ADM_USU,
  agoraAdm,
  numBR,
  pedidoAdm,
  podeEditar,
  revisaoAdm,
  tituloAdm,
  trilhaAdm
} from "./admin_nucleo.js";

// correspondência de códigos das fontes do NE (Verificação NE SAR, CORSH, ago/2026, extraída em 12/09/2026) e textos
// originais das páginas, tirados do próprio código ({janela_ne} = parâmetro da janela do NE): dados_admin.json, gerado
// pelo montar.py, embutido na página publicada e lido do servidor pela dev.html
const { depara: DEPARA_NE, textos: TEXTOS_PAD } = JSON.parse(document.getElementById("dados-admin").textContent);
// páginas com textos editáveis; bacia, estado e fichas são modelos: o texto vale para todas as páginas do modelo
const PAGS_TX = [
  { k: "inicio", r: "Página inicial", ir: "inicio", casa: h => h === "" || h === "inicio" },
  { k: "sin", r: "Sistema Interligado Nacional", ir: "sin", casa: h => h === "sin" },
  { k: "bacia", r: "Bacia do SIN (modelo de todas as bacias)", ir: "bacia/GRANDE", casa: h => h.startsWith("bacia/") },
  { k: "ficha", r: "Ficha de usina do SIN (modelo)", ir: "ficha/FURNAS", casa: h => h.startsWith("ficha/") },
  { k: "ne", r: "Nordeste e Semiárido", ir: "ne", casa: h => h === "ne" },
  {
    k: "ne_estado",
    r: "Estado do Nordeste (modelo de todos os estados)",
    ir: "ne/PI",
    casa: h => /^ne\/[A-Z]{2}$/.test(h)
  },
  {
    k: "ne_ficha",
    r: "Ficha de açude do Nordeste (modelo)",
    ir: "ne/ficha/12112",
    casa: h => h.startsWith("ne/ficha/")
  },
  { k: "outros", r: "Outros Sistemas Hídricos", ir: "outros", casa: h => h === "outros" },
  { k: "cantareira", r: "Sistema Cantareira", ir: "outros/cantareira", casa: h => h === "outros/cantareira" },
  {
    k: "os_sistema",
    r: "Distrito Federal e Paraopeba (modelo)",
    ir: "outros/df",
    casa: h => h === "outros/df" || h === "outros/rmbh"
  },
  {
    k: "os_ficha",
    r: "Ficha de reservatório de Outros Sistemas (modelo)",
    ir: "outros/ficha/29001",
    casa: h => h.startsWith("outros/ficha/")
  },
  { k: "dados", r: "Área de dados", ir: "dados", casa: h => h === "dados" },
  { k: "api", r: "API pública", ir: "api", casa: h => h === "api" }
];
// fora da edição de texto: tabelas, mapas, legendas, controles, carimbo, avisos e códigos
const TX_FORA =
  "table,.leaflet-container,.carimbo,.baixar,svg,.legenda,.aviso-pub,.avisos-pub,nav,label,.pedido,.adm-form,.mf,.chips-filtro,.api-box,.previa-box,.trilha";
const txSemDica = el => {
  const c = el.cloneNode(true);
  c.querySelectorAll(".dica").forEach(d => d.remove());
  return c.innerHTML.trim();
};
const txPlano = h => {
  const d = document.createElement("div");
  d.innerHTML = h;
  return d.textContent.replace(/\s+/g, " ").trim();
};
const txNorm = h => {
  const d = document.createElement("div");
  d.innerHTML = h;
  return d.innerHTML.trim();
};
// os textos de uma página, na ordem da tela; a chave (grupo|tipo|ordem) não depende do conteúdo, para valer depois de editado
function textosDe(doc) {
  const out = [],
    cont = {};
  doc.querySelectorAll("#titulo-pag p.lead, #conteudo p, #conteudo p.sub > span.dica").forEach(el => {
    if (el.closest(TX_FORA) || el.querySelector("button,input,select")) return;
    const sec = el.closest("section[id]"),
      intro = el.closest(".intro"),
      saiba = el.closest("details.saiba");
    const tipo = el.matches("span.dica")
      ? "instrução"
      : el.matches("#titulo-pag p.lead, .lead-hero")
        ? "subtítulo"
        : saiba
          ? saiba.classList.contains("como-ler")
            ? "como ler"
            : "saiba mais"
          : intro
            ? "apresentação"
            : el.matches("p.sub")
              ? "texto da seção"
              : el.matches("[class*='fontes']")
                ? "linha de fontes"
                : el.matches(".nota")
                  ? "nota"
                  : "texto";
    const html = tipo === "texto da seção" ? txSemDica(el) : el.innerHTML.trim(),
      t = txPlano(html);
    if (!t) return;
    const grupo = sec ? sec.id : intro ? "intro" : el.closest("#titulo-pag") ? "titulo" : "pagina",
      ck = grupo + "|" + tipo,
      n = (cont[ck] = (cont[ck] ?? -1) + 1);
    const h2 = sec && sec.querySelector("h2"),
      num = h2 && h2.querySelector("small") ? h2.querySelector("small").textContent.trim() : "";
    const titulo =
      sec && h2
        ? `${num ? "Seção " + num + " · " : ""}${h2.textContent.trim().slice(num.length).trim()}`
        : intro
          ? "Apresentação"
          : grupo === "titulo"
            ? "Título da página"
            : "Página";
    const outras = (html.match(/<([a-z0-9]+)/gi) || [])
      .map(x => x.slice(1).toLowerCase())
      .filter(x => !["a", "b", "strong", "code", "br", "wbr"].includes(x));
    out.push({
      id: `${ck}|${n}`,
      el,
      titulo,
      tipo,
      html,
      t,
      fixo: outras.length
        ? "formatacao"
        : /\d/.test(txPlano(html.replace(/<code[^>]*>.*?<\/code>/g, "")))
          ? "valores"
          : ""
    });
  });
  // os textos que têm marcador no código (janela do Nordeste): editáveis, com o marcador no original
  Object.values(TEXTOS_PAD).forEach(pad => {
    const t = txPlano(textoHTML(pad));
    out.forEach(x => {
      if (x.t === t) {
        x.pad = pad;
        x.fixo = "";
      }
    });
  });
  return out;
}
// editor: **negrito**, [texto](#endereço), `código`; quebra de linha vira <br>
const txEd = h =>
  h
    .replace(/<wbr>/g, "")
    .replace(/<br\s*\/?>/g, "\n")
    .replace(/<a [^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/g, "[$2]($1)")
    .replace(/<code[^>]*>(.*?)<\/code>/g, "`$1`")
    .replace(/<(b|strong)>(.*?)<\/\1>/g, "**$2**")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
const txHTML = s =>
  txNorm(
    esc(s.trim())
      .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
      .replace(/\[([^\]]+)\]\((#[^)\s]*)\)/g, '<a href="$2">$1</a>')
      .replace(/`([^`]+)`/g, '<code class="in">$1</code>')
      .replace(/\n/g, "<br>")
  );
// páginas públicas: põe o texto editado no lugar e reaplica quando a página se redesenha
let TX_APLICANDO = false,
  txTimer = null;
function aplicarTextos() {
  const h = decodeURIComponent(location.hash.slice(1));
  if (h.startsWith("admin")) return;
  const Pg = PAGS_TX.find(p => p.casa(h));
  if (!Pg) return;
  const K = Object.keys(ADM.textos).filter(k => k.startsWith(Pg.k + "::"));
  if (!K.length) return;
  TX_APLICANDO = true;
  try {
    const L = textosDe(document);
    K.forEach(k => {
      const x = L.find(y => Pg.k + "::" + y.id === k);
      if (!x) return;
      const novo = txNorm(textoHTML(ADM.textos[k]));
      if (x.tipo === "texto da seção") {
        if (txSemDica(x.el) !== novo) {
          const d = x.el.querySelector(".dica");
          x.el.innerHTML = novo;
          if (d) x.el.append(d);
        }
      } else if (x.el.innerHTML.trim() !== novo) x.el.innerHTML = novo;
    });
  } finally {
    setTimeout(() => {
      TX_APLICANDO = false;
    }, 0);
  }
}
["conteudo", "titulo-pag"].forEach(id =>
  new MutationObserver(() => {
    if (TX_APLICANDO) return;
    clearTimeout(txTimer);
    txTimer = setTimeout(aplicarTextos, 60);
  }).observe(document.getElementById(id), { childList: true, subtree: true })
);
// o original de cada página é lido da própria página, aberta num quadro oculto (uma vez por página)
const TX_CACHE = {};
function carregarTextosPag(Pg, pronto) {
  if (TX_CACHE[Pg.k]) return pronto(TX_CACHE[Pg.k]);
  const velho = document.getElementById("tx-quadro");
  if (velho) velho.remove();
  const f = document.createElement("iframe");
  f.id = "tx-quadro";
  f.setAttribute("aria-hidden", "true");
  f.tabIndex = -1;
  f.style.cssText = "position:absolute;left:-12000px;top:0;width:1366px;height:900px;border:0;visibility:hidden";
  f.onload = () =>
    setTimeout(() => {
      let L = null;
      try {
        L = textosDe(f.contentDocument).map(({ el, ...x }) => x);
        TX_CACHE[Pg.k] = L;
      } catch {
        L = null;
      }
      f.remove();
      pronto(L);
    }, 900);
  f.src = location.href.split("#")[0] + "#" + Pg.ir;
  document.body.append(f);
}
const FCRIT = (NEd.nivel && NEd.nivel.filtro) || {
  grosso_cm: 2000,
  pico_cm: 50,
  degrau_cm: 150,
  volta_dias: 20,
  suspeito_cm: 300
};
const PARAM_ADM = [
  {
    k: "janela_ne",
    g: "Nordeste e Semiárido",
    r: "Janela da medição mais próxima da data de referência",
    v: NEd.limiar_dias,
    u: "dias",
    dec: 0,
    apr: true,
    onde: "Volume acumulado, faixas, mapa e tabelas do Nordeste e Semiárido",
    fonte: "SAR, Entendendo o Mapa, a Tabela e o Gráfico"
  },
  {
    k: "tol_30d",
    g: "Nordeste e Semiárido",
    r: "Variação em 30 dias: tolerância em torno do dia de comparação",
    v: FOLGA30,
    u: "dias",
    dec: 0,
    apr: true,
    onde: "Variação em 30 dias do volume e do nível (tabelas, mapa e fichas do Nordeste e Semiárido)",
    fonte: "Critério da CORSH (21/09/2026)"
  },
  {
    k: "inicio_serie_ne",
    g: "Nordeste e Semiárido",
    r: "Ano inicial da série do volume acumulado dos estados e do Nordeste",
    v: SD.ano_inicial,
    u: "",
    dec: 0,
    apr: true,
    onde: "Ao longo do ano, mesmo dia em outros anos e comparações do Nordeste e dos estados; área de dados e API",
    fonte: `Critério da CORSH (23/09/2026): primeiro ano em que a capacidade com medição no Nordeste chega a ${SD.cobertura_min_pct}% da capacidade cadastrada`
  },
  {
    k: "troca_serie_ne",
    g: "Nordeste e Semiárido",
    r: "Troca de reservatórios medidos que interrompe a linha mensal do volume acumulado",
    v: SD.limiar_troca_pct,
    u: "% da capacidade equivalente",
    dec: 0,
    apr: true,
    onde: "Ao longo do ano do Nordeste e dos estados",
    fonte:
      "Critério da CORSH (23/09/2026): acima de 15%, a regra identifica todas as variações de mais de 5 pontos percentuais causadas pela troca de reservatórios desde 2013"
  },
  {
    k: "faixa_restr",
    g: "Nordeste e Semiárido",
    r: "Faixa de volume: restrição abaixo de",
    v: 20,
    u: "%",
    dec: 0,
    apr: true,
    onde: "Faixas do Nordeste e Semiárido (mapas, tabelas, faixas e cobertura)",
    fonte: "SAR atual"
  },
  {
    k: "faixa_aten",
    g: "Nordeste e Semiárido",
    r: "Faixa de volume: atenção abaixo de (normal a partir deste valor)",
    v: 50,
    u: "%",
    dec: 0,
    apr: true,
    onde: "Faixas do Nordeste e Semiárido (mapas, tabelas, faixas e cobertura)",
    fonte: "SAR atual"
  },
  {
    k: "crit_grosso",
    g: "Conferência da cota",
    r: "Erro grosseiro: distância da mediana do ano da estação",
    v: FCRIT.grosso_cm / 100,
    u: "m",
    dec: 1,
    apr: true,
    onde: "Série aceita (todas as páginas, área de dados e API)",
    fonte: "Regras de conferência do protótipo"
  },
  {
    k: "crit_pico",
    g: "Conferência da cota",
    r: "Pico de um dia: diferença para as duas leituras vizinhas, no mesmo sentido",
    v: FCRIT.pico_cm,
    u: "cm",
    dec: 0,
    apr: true,
    onde: "Série aceita",
    fonte: "Regras de conferência do protótipo"
  },
  {
    k: "crit_degrau",
    g: "Conferência da cota",
    r: "Degrau que volta: salto mínimo",
    v: FCRIT.degrau_cm / 100,
    u: "m",
    dec: 1,
    apr: true,
    onde: "Série aceita",
    fonte: "Regras de conferência do protótipo"
  },
  {
    k: "crit_volta",
    g: "Conferência da cota",
    r: "Degrau que volta: prazo para o salto ser desfeito",
    v: FCRIT.volta_dias,
    u: "dias",
    dec: 0,
    apr: true,
    onde: "Série aceita",
    fonte: "Regras de conferência do protótipo"
  },
  {
    k: "crit_suspeito",
    g: "Conferência da cota",
    r: "Salto a verificar: salto entre leituras que as regras acima não explicam",
    v: FCRIT.suspeito_cm / 100,
    u: "m",
    dec: 1,
    apr: true,
    onde: "Estações só com nível (saem das contagens até a conferência)",
    fonte: "Regras de conferência do protótipo"
  },
  {
    k: "crit_vol",
    g: "Conferência do volume",
    r: "Pico de um dia e degrau que volta no volume: limite",
    v: 5,
    u: "p.p.",
    dec: 0,
    apr: true,
    onde: "Série aceita (volume do Nordeste e Semiárido)",
    fonte: "Regras de conferência do protótipo"
  },
  {
    k: "hora_limite",
    g: "Área de dados",
    r: "Período máximo por pedido na base horária",
    v: 1,
    u: "ano",
    dec: 0,
    apr: false,
    onde: "Área de dados (base horária do SIN)",
    fonte: "Proposta; valor a definir (estrutura/area_dados.md)"
  },
  {
    k: "cob_sin",
    g: "Cobertura",
    r: "Prazo de alerta sem dado: SIN",
    v: 1,
    u: "dias",
    dec: 0,
    apr: false,
    onde: "Painel de cobertura",
    fonte: "Valor inicial ilustrativo; a CORSH define"
  },
  {
    k: "cob_ne",
    g: "Cobertura",
    r: "Prazo de alerta sem dado: Nordeste e Semiárido",
    v: NEd.limiar_dias,
    u: "dias",
    dec: 0,
    apr: false,
    onde: "Painel de cobertura",
    fonte: "Valor inicial ilustrativo (igual à janela); a CORSH define"
  },
  {
    k: "cob_os",
    g: "Cobertura",
    r: "Prazo de alerta sem dado: Outros Sistemas",
    v: 3,
    u: "dias",
    dec: 0,
    apr: false,
    onde: "Painel de cobertura",
    fonte: "Valor inicial ilustrativo; a CORSH define"
  }
];
const parAdm = k => {
  const p = PARAM_ADM.find(x => x.k === k);
  return ADM.params[k] ?? p.v;
};
const textoHTML = s => s.replace(/\{janela_ne\}/g, fint(NEd.limiar_dias)); // a janela em vigor nas páginas

// escolha de reservatório independente da seleção da correção de série
function escolherRes(host, filtro, atual, aoEscolher, ph) {
  const E = entidadesDados().filter(e => !filtro || filtro(e));
  host.innerHTML = `<div class="adm-sel"><div class="busca-dados"><input type="search" placeholder="${ph || "Buscar reservatório por nome, código, município ou estado"}" aria-label="Buscar reservatório" autocomplete="off"></div><div class="adm-sel-res" hidden></div>
    ${atual ? `<p class="adm-atual"><span class="tag" style="background:${COR_MOD[atual.mod]}">${ROT_MOD[atual.mod]}</span><b>${esc(atual.nome)}</b><span>${atual.codigo ? "código " + esc(atual.codigo) + " · " : ""}${esc([atual.municipio, atual.uf].filter(Boolean).join(", "))}</span></p>` : ""}</div>`;
  const q = $("input", host),
    box = $(".adm-sel-res", host);
  q.oninput = () => {
    const termos = normalizaBusca(q.value).split(/\s+/).filter(Boolean);
    if (!termos.length) {
      box.hidden = true;
      return;
    }
    const R = E.filter(x => termos.every(tm => x.busca.includes(tm)))
      .map(x => ({
        x,
        s: termos.reduce((a, tm) => a + (x.nomeB.startsWith(tm) ? 3 : x.nomeB.includes(tm) ? 2 : 1), 0)
      }))
      .sort((a, b) => b.s - a.s || a.x.nome.localeCompare(b.x.nome, "pt-BR"))
      .slice(0, 8)
      .map(o => o.x);
    box.hidden = false;
    box.innerHTML = R.length
      ? R.map(
          x =>
            `<button type="button" class="res" data-id="${esc(x.id)}"><span class="n">${esc(x.nome)}</span><span class="d">${esc([x.municipio, x.uf].filter(Boolean).join(", "))}${x.codigo ? " · código " + esc(x.codigo) : ""}</span><span class="m">${ROT_MOD[x.mod]}</span></button>`
        ).join("")
      : '<p class="nota" style="padding:8px 12px;margin:0">Nenhum reservatório encontrado.</p>';
    $$("button", box).forEach(b => (b.onclick = () => aoEscolher(E.find(x => x.id === b.dataset.id))));
  };
}
const coordEnt = e =>
  e.src === "sin" || e.src === "ne"
    ? e.r.lat != null
      ? [e.r.lat, e.r.lon]
      : null
    : e.src === "nv"
      ? e.st.lat != null
        ? [e.st.lat, e.st.lon]
        : null
      : e.src === "os"
        ? COORD_OS[e.codigo] || null
        : e.src === "novo"
          ? e.coord
          : null;
const distKm = (a, b) => {
  const R = 6371,
    r = x => (x * Math.PI) / 180,
    dLa = r(b[0] - a[0]),
    dLo = r(b[1] - a[1]);
  return (
    2 *
    R *
    Math.asin(Math.sqrt(Math.sin(dLa / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(dLo / 2) ** 2))
  );
};
const retiradoAdm = e => (ADM.modo[e.id] ? ADM.modo[e.id] === "retirado" : !!e.retirado);
function intAdm(e) {
  if (e.src === "sin") return "ons-dia";
  if (e.src === "nv") return "hidro";
  if (e.src === "os" || e.src === "can") return e.sis === "cantareira" ? "sabesp" : "gdh";
  return { CE: "ce", PB: "pb", PE: "pe" }[e.uf] || "";
}

/* ---------------- cobertura por reservatório */
function ultimaLeitura(e) {
  if (e.src === "sin") {
    const r = e.r;
    return ["cota", "afl", "defl", "vu"].some(c => r[c] != null) ? D.data : null;
  }
  if (e.src === "ne") {
    const fi = NEd.fichas && NEd.fichas[e.codigo];
    if (fi && fi.serie) {
      for (let i = fi.serie.length - 1; i >= 0; i--)
        if (fi.serie[i][1] != null || fi.serie[i][2] != null) return fi.serie[i][0];
      return null;
    }
    const s = e.r.s || [];
    for (let i = s.length - 1; i >= 0; i--)
      if (s[i][1] != null || s[i][2] != null || s[i][3] != null) return isoDia(s[i][0]);
    return null;
  }
  if (e.src === "nv") {
    const s = e.st.s || [];
    for (let i = s.length - 1; i >= 0; i--) if (s[i][1] != null) return isoDia(s[i][0]);
    return null;
  }
  if (e.src === "os") {
    const c = e.F.cota;
    for (let i = c.length - 1; i >= 0; i--) if (c[i] != null) return isoMais(e.F.de, i);
    return null;
  }
  if (e.src === "can") return CAN.ate;
  return null;
}
let COB = null;
function coberturaAdm() {
  if (!COB) {
    const E = entidadesDados().filter(e => e.src !== "can"); // o Sistema Cantareira como conjunto não é reservatório
    COB = E.map(e => ({ e, ult: ultimaLeitura(e) }));
    COB.ref = {};
    ["SIN", "NE", "OUTROS"].forEach(m => {
      const ds = COB.filter(c => c.e.mod === m && c.ult)
        .map(c => c.ult)
        .sort();
      COB.ref[m] = ds[ds.length - 1];
    });
  }
  const prazo = { SIN: parAdm("cob_sin"), NE: parAdm("cob_ne"), OUTROS: parAdm("cob_os") };
  COB.forEach(c => {
    c.dias = c.ult ? diaEntre(COB.ref[c.e.mod], c.ult) : null;
    c.sit = retiradoAdm(c.e)
      ? "ret"
      : c.e.src === "novo"
        ? "novo"
        : c.ult == null
          ? "sem"
          : c.dias > prazo[c.e.mod]
            ? "atr"
            : "ok";
  });
  COB.prazo = prazo;
  return COB;
}
// conferência do cadastro (N-11): sem coordenada e nome repetido no mesmo módulo e estado, entre os acompanhados
function coordAdm(e) {
  if (e.src === "os") return COORD_OS[e.codigo] || null;
  const o = e.src === "nv" ? e.st : e.r;
  return o && o.lat != null ? [o.lat, o.lon] : o && o.x != null ? [o.y, o.x] : null;
}
function cadastroAdm(C) {
  const A = C.filter(c => c.sit !== "ret").map(c => c.e),
    semC = A.filter(e => !coordAdm(e)),
    grupos = {};
  A.forEach(e => {
    const k = `${e.mod}|${e.uf}|${semAc(e.nome)}`;
    (grupos[k] = grupos[k] || []).push(e);
  });
  const rep = Object.values(grupos).filter(g => g.length > 1);
  const ex = L =>
    L.slice(0, 6)
      .map(e => esc(e.nome) + (e.uf ? "/" + e.uf : ""))
      .join(", ") + (L.length > 6 ? ` e mais ${fint(L.length - 6)}` : "");
  return `<div class="tab-box"><table><thead><tr><th>Conferência</th><th class="r">Reservatórios</th><th>Exemplos</th></tr></thead><tbody>
    <tr><td><span class="nm">Sem coordenada</span></td><td class="r num">${fint(semC.length)}</td><td>${semC.length ? ex(semC) : "–"}</td></tr>
    <tr><td><span class="nm">Nome repetido no mesmo módulo e estado</span></td><td class="r num">${fint(rep.flat().length)}</td><td>${rep.length ? ex(rep.map(g => g[0])) + ` (${fint(rep.length)} nomes)` : "–"}</td></tr>
    <tr><td><span class="nm">Sem leitura em 12 meses</span></td><td class="r num">${fint(C.filter(c => c.sit === "sem").length)}</td><td>na lista acima, situação "sem leitura em 12 meses"</td></tr></tbody></table></div>
    <p class="nota">Protótipo: conferido nos dados embutidos. No sistema, a conferência inclui município, estado e bacia vazios e o reservatório cadastrado em duas fontes.</p>`;
}
const SIT_COB = {
  ok: ["em dia", "ok"],
  atr: ["atrasado", "erro"],
  sem: ["sem leitura em 12 meses", "erro"],
  ret: ["retirado do acompanhamento", "cinza"],
  novo: ["aguardando a primeira carga", "fila"]
};
function admCobertura() {
  const pag = {}; // estado da página, passado às funções abaixo

  pag.C = coberturaAdm();
  pag.mods = [
    ["SIN", "SIN"],
    ["NE", "Nordeste e Semiárido"],
    ["OUTROS", "Outros Sistemas"]
  ];
  const nAlerta = pag.C.filter(c => c.sit === "atr" || c.sit === "sem").length;
  tituloAdm(
    "Cobertura",
    "Reservatório por reservatório: quando chegou a última leitura e quem está sem dado além do prazo do módulo.",
    `<span><b>${fint(nAlerta)}</b> reservatórios em alerta</span>`
  );
  pag.st = { mod: "", sit: "alerta", uf: "", txt: "", mostrar: 25 };
  pag.ufs = [...new Set(pag.C.map(c => c.e.uf).filter(Boolean))].sort();
  $("#conteudo").innerHTML = corpoCobertura(pag);
  ligarFiltrosCobertura(pag);
  listaCobertura(pag);
}

const corpoCobertura = pag =>
  `
    <nav class="indice" aria-label="Seções da página"><a href="#admin/cobertura" data-alvo="cb-res">Por módulo</a><a href="#admin/cobertura" data-alvo="cb-lista">Por reservatório</a><a href="#admin/cobertura" data-alvo="cb-cad">Cadastro</a></nav>
    <section class="cartao secao" id="cb-res" aria-labelledby="t-cb-res"><h2 id="t-cb-res"><small>1</small>Por módulo</h2>
      <p class="sub">Dias sem dado contados até o dado mais recente de cada módulo no protótipo. O prazo de alerta de cada módulo fica em <a href="#admin/parametros">Parâmetros</a>. Os retirados do acompanhamento não entram no alerta.</p>
      <div class="tab-box"><table><thead><tr><th>Módulo</th><th class="r">Acompanhados</th><th class="r">Em dia</th><th class="r">Atrasados</th><th class="r">Sem leitura em 12 meses</th><th class="r">Retirados</th><th>Dado mais recente</th><th class="r">Prazo de alerta</th></tr></thead>
      <tbody>${pag.mods
        .map(([m, r]) => {
          const X = pag.C.filter(c => c.e.mod === m),
            n = s => X.filter(c => c.sit === s).length;
          return `<tr><td><span class="nm">${r}</span></td><td class="r num">${fint(X.length - n("ret"))}</td><td class="r num">${fint(n("ok"))}</td><td class="r num">${n("atr") ? `<span class="adm-sit erro">${fint(n("atr"))}</span>` : "0"}</td><td class="r num">${n("sem") ? `<span class="adm-sit erro">${fint(n("sem"))}</span>` : "0"}</td><td class="r num">${fint(n("ret"))}</td><td>${pag.C.ref[m] ? dBR(pag.C.ref[m]) : "–"}</td><td class="r num">${fint(pag.C.prazo[m])} ${pag.C.prazo[m] === 1 ? "dia" : "dias"}</td></tr>`;
        })
        .join("")}</tbody></table></div>
      <p class="nota">Protótipo: o SIN traz só o dia mais recente de cada usina; o Nordeste, 12 meses (série longa nas três fichas de exemplo); Outros Sistemas, a série completa. No sistema, a última leitura vem do banco, com a série inteira.</p>
    </section>
    <section class="cartao secao" id="cb-lista" aria-labelledby="t-cb-lista"><h2 id="t-cb-lista"><small>2</small>Por reservatório</h2>
      <div class="baixar"><button type="button" id="cb-csv"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2v8m0 0L5 7m3 3 3-3M3 13h10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>CSV</button></div>
      <p class="sub">Do maior atraso para o menor. Da linha sai a carga sob demanda da fonte do reservatório.</p>
      <div class="adm-form"><span class="seg" role="group" aria-label="Módulo">${[["", "Todos"], ...pag.mods].map(([v, r]) => `<button type="button" data-m="${v}" aria-pressed="${v === ""}">${r}</button>`).join("")}</span>
        <label>Situação<select id="cb-sit"><option value="alerta">Atrasados e sem leitura</option><option value="">Todas</option><option value="ok">Em dia</option><option value="ret">Retirados do acompanhamento</option><option value="novo">Aguardando a primeira carga</option></select></label>
        <label>UF<select id="cb-uf"><option value="">Todas</option>${pag.ufs.map(u => `<option>${u}</option>`).join("")}</select></label>
        <label class="largo">Busca<input type="text" id="cb-busca" placeholder="Nome, código ou município"></label></div>
      <p class="nota" id="cb-n"></p>
      <div class="tab-box adm-tab"><table><thead><tr><th>Reservatório</th><th>Módulo</th><th>UF</th><th>Última leitura</th><th class="r">Dias sem dado</th><th>Situação</th><th></th></tr></thead><tbody id="cb-corpo"></tbody></table></div>
      <p class="mais-res" id="cb-mais"></p></section>
    <section class="cartao secao" id="cb-cad" aria-labelledby="t-cb-cad"><h2 id="t-cb-cad"><small>3</small>Cadastro</h2>
      <p class="sub">Conferência do cadastro dos reservatórios acompanhados: o que falta ou se repete aparece aqui até ser corrigido em <a href="#admin/cadastro">Cadastro e curva</a>.</p>
      ${cadastroAdm(pag.C)}</section>`;

const filtradaCobertura = pag => {
  const tm = normalizaBusca(pag.st.txt).split(/\s+/).filter(Boolean);
  return pag.C.filter(
    c =>
      (!pag.st.mod || c.e.mod === pag.st.mod) &&
      (!pag.st.uf || c.e.uf === pag.st.uf) &&
      (!pag.st.sit || (pag.st.sit === "alerta" ? c.sit === "atr" || c.sit === "sem" : c.sit === pag.st.sit)) &&
      tm.every(t => c.e.busca.includes(t))
  ).sort((a, b) => (b.dias ?? 1e9) - (a.dias ?? 1e9) || a.e.nome.localeCompare(b.e.nome, "pt-BR"));
};

function listaCobertura(pag) {
  const L = filtradaCobertura(pag),
    vis = L.slice(0, pag.st.mostrar);
  $("#cb-n").textContent = `${fint(L.length)} ${L.length === 1 ? "reservatório" : "reservatórios"}.`;
  $("#cb-corpo").innerHTML =
    vis
      .map(
        c => `<tr><td><span class="nm">${esc(c.e.nome)}</span>${c.e.codigo ? `<span class="rio">código ${esc(c.e.codigo)}</span>` : ""}</td><td>${ROT_MOD[c.e.mod]}</td><td>${esc(c.e.uf || "–")}</td>
      <td>${c.ult ? dBR(c.ult) : "–"}</td><td class="r num">${c.dias == null ? "–" : fint(c.dias)}</td><td><span class="adm-sit ${SIT_COB[c.sit][1]}">${SIT_COB[c.sit][0]}</span></td>
      <td class="r">${intAdm(c.e) && c.sit !== "ret" ? `<button type="button" class="acao sec adm-forcar" data-id="${esc(c.e.id)}"${podeEditar() ? "" : " disabled"}>Forçar carga</button>` : ""}</td></tr>`
      )
      .join("") || `<tr><td colspan="7" class="nota">Nenhum reservatório com esse filtro.</td></tr>`;
  $("#cb-mais").innerHTML =
    L.length > vis.length
      ? `<button type="button" class="acao sec">Mostrar mais (${fint(L.length - vis.length)} restantes)</button>`
      : "";
  if ($("#cb-mais button"))
    $("#cb-mais button").onclick = () => {
      pag.st.mostrar += 50;
      listaCobertura(pag);
    };
  $$("#cb-corpo .adm-forcar").forEach(
    b =>
      (b.onclick = () => {
        ADM.ent = pag.C.find(c => c.e.id === b.dataset.id).e;
        ADM.forcarUm = true;
        location.hash = "admin";
      })
  );
}

const ligarFiltrosCobertura = pag => {
  $$("#cb-lista .seg button").forEach(
    b =>
      (b.onclick = () => {
        pag.st.mod = b.dataset.m;
        $$("#cb-lista .seg button").forEach(x => x.setAttribute("aria-pressed", x === b));
        pag.st.mostrar = 25;
        listaCobertura(pag);
      })
  );
  $("#cb-sit").onchange = e => {
    pag.st.sit = e.target.value;
    pag.st.mostrar = 25;
    listaCobertura(pag);
  };
  $("#cb-uf").onchange = e => {
    pag.st.uf = e.target.value;
    pag.st.mostrar = 25;
    listaCobertura(pag);
  };
  $("#cb-busca").oninput = e => {
    pag.st.txt = e.target.value;
    pag.st.mostrar = 25;
    listaCobertura(pag);
  };
  $("#cb-csv").onclick = () =>
    salvarCSV(
      ["codigo", "reservatorio", "modulo", "uf", "ultima_leitura", "dias_sem_dado", "situacao"],
      filtradaCobertura(pag).map(c => [
        c.e.codigo,
        c.e.nome,
        ROT_MOD[c.e.mod],
        c.e.uf,
        c.ult ? dBR(c.ult) : "",
        c.dias,
        SIT_COB[c.sit][0]
      ]),
      "sar_cobertura.csv"
    );
};

/* ---------------- fila de valores suspeitos */
let SUSP = null;
function suspeitosAdm() {
  if (SUSP) return SUSP;
  const L = [],
    E = entidadesDados();
  // valores que as regras de conferência barraram nas fichas do Nordeste (séries desde 2006)
  Object.values(NEd.fichas || {}).forEach(F => {
    const e = E.find(x => (x.src === "ne" || x.src === "nv") && String(x.codigo) === String(F.codigo));
    if (!e) return;
    Object.entries(F.descartes || {}).forEach(([vv, lista]) =>
      (lista || []).forEach(([t, v, regra]) => {
        const j = vv === "cota" ? 1 : 3,
          k = vv === "cota" ? "cota_m" : "volume_pct";
        let a = null,
          b = null;
        for (const l of F.serie) {
          if (l[j] == null) continue;
          if (l[0] < t) a = l;
          else if (l[0] > t) {
            b = l;
            break;
          }
        }
        L.push({
          id: `d|${F.codigo}|${k}|${t}`,
          tipo: "descarte",
          e,
          t,
          k,
          v,
          regra,
          ant: a && [a[0], a[j]],
          seg: b && [b[0], b[j]]
        });
      })
    );
  });
  // estações só com nível com salto que as regras não explicam: fora das contagens até a conferência
  Object.entries(NVE).forEach(([uf, x]) =>
    (x.a_verificar || []).forEach(s =>
      L.push({
        id: `v|${uf}|${s.nome}`,
        tipo: "estacao",
        e: { nome: caso(s.nome), codigo: "", uf, mod: "NE", id: "EST:" + uf + ":" + s.nome },
        t: null,
        k: "cota_m",
        v: s.maior_salto_cm / 100,
        regra: "salto a verificar",
        no_sar: s.no_sar
      })
    )
  );
  // SIN: vazão afluente diária negativa, já retirada da publicação ao carregar (AFL_RETIRADAS, js/regras.js): Furnas
  // desde 2000; nas demais usinas, o dia mais recente
  const Dd = D.ficha.diario,
    ia = D.ficha.diario_colunas.indexOf("afl"),
    vizinho = (i, passo) => {
      for (let k = i + passo; k >= 0 && k < Dd.length; k += passo) if (Dd[k][ia] != null) return [Dd[k][0], Dd[k][ia]];
      return null;
    };
  AFL_RETIRADAS.forEach(x => {
    const e = E.find(y => y.src === "sin" && String(y.codigo) === String(x.codigo));
    if (!e) return;
    const i = String(x.codigo) === String(D.ficha.codigo) ? Dd.findIndex(l => l[0] === x.data) : -1;
    L.push({
      id: `s|${x.codigo}|${x.data}`,
      tipo: "sin",
      e,
      t: x.data,
      k: "afluente_m3s",
      v: x.v,
      regra: "vazão afluente diária negativa",
      ant: i >= 0 ? vizinho(i, -1) : null,
      seg: i >= 0 ? vizinho(i, 1) : null
    });
  });
  // erro evidente (Diego, 24/09/2026: "Erro evidente deveria ser marcado para revisão"): sai da publicação e vai para a
  // fila; o valor improvável fica publicado e também vai. Todo caso da fila espera a decisão da CORSH
  L.forEach(s => (s.retirado = REGRAS_RETIRA.has(s.regra)));
  return (SUSP = L);
}
const REGRAS_RETIRA = new Set([
  "erro grosseiro",
  "pico de um dia",
  "degrau que volta",
  "vazão afluente diária negativa"
]);
const REGRAS_SUSP = () => [
  [
    "erro grosseiro",
    `Cota a mais de ${fmt(parAdm("crit_grosso"), 1)} m da mediana do ano da estação.`,
    "Cota do Nordeste e Semiárido e de Outros Sistemas Hídricos",
    "retira da publicação e vai para a fila"
  ],
  [
    "pico de um dia",
    `Leitura a mais de ${fint(parAdm("crit_pico"))} cm (na cota) ou ${fint(parAdm("crit_vol"))} pontos percentuais (no volume) das duas vizinhas, no mesmo sentido.`,
    "Cota e volume do Nordeste e Semiárido; cota de Outros Sistemas Hídricos",
    "retira da publicação e vai para a fila"
  ],
  [
    "degrau que volta",
    `Salto de mais de ${fmt(parAdm("crit_degrau"), 1)} m (na cota) ou ${fint(parAdm("crit_vol"))} pontos percentuais (no volume) desfeito em até ${fint(parAdm("crit_volta"))} dias.`,
    "Cota e volume do Nordeste e Semiárido; cota de Outros Sistemas Hídricos",
    "retira da publicação e vai para a fila"
  ],
  [
    "salto a verificar",
    `Salto de mais de ${fmt(parAdm("crit_suspeito"), 1)} m entre duas leituras que as regras acima não explicam.`,
    "Estações só com nível",
    "tira a estação das contagens e vai para a fila"
  ],
  [
    "vazão afluente diária negativa",
    "Vazão afluente diária abaixo de zero, que não corresponde a vazão real. Na base horária, os negativos do balanço hídrico continuam publicados, com aviso.",
    "SIN, base diária",
    "retira da publicação e vai para a fila"
  ],
  [
    "volume acima da capacidade",
    "Volume maior que a capacidade vigente na data.",
    "Volume do Nordeste e Semiárido",
    "mantém publicado e vai para a fila"
  ],
  [
    "queda a zero no fim de um trecho",
    "Volume que cai a zero na última leitura de um trecho, com cota informada (há açudes que secam).",
    "Volume do Nordeste e Semiárido",
    "mantém publicado e vai para a fila"
  ]
];
// ações por item: todo caso da fila pede decisão; o valor retirado pode ser confirmado fora ou devolvido à série
const acoesSusp = s =>
  s.retirado
    ? [
        ["confirmar", "Confirmar a retirada"],
        ["devolver", "Devolver à série"]
      ]
    : s.tipo === "estacao"
      ? [
          ["manter", "Manter fora"],
          ["liberar", "Liberar a série"]
        ]
      : [
          ["confirmar", "Descartar"],
          ["manter", "Manter na série"]
        ];
function admSuspeitos() {
  const pag = {}; // estado da página, passado às funções abaixo

  pag.S = suspeitosAdm();
  pag.pend = pag.S.filter(s => !ADM.susp[s.id]);
  tituloAdm(
    "Valores suspeitos",
    "O que as regras de conferência encontraram nas leituras. O erro evidente sai da publicação na hora e o valor improvável fica publicado; os dois esperam aqui a revisão da CORSH. A leitura que passa nas regras é publicada sem intervenção.",
    `<span><b>${fint(pag.pend.length)}</b> de ${fint(pag.S.length)} aguardando decisão</span>`
  );
  pag.st = { regra: "", sit: "pend", txt: "", mostrar: 20 };
  $("#conteudo").innerHTML = corpoSuspeitos(pag);
  pag.alvo = null;
  selSuspeitos(pag);
  excs();
  $("#su-exc-ir").onclick = () => {
    const lim = numBR($("#su-lim").value),
      mot = $("#su-mot").value.trim(),
      regra = $("#su-regra").value;
    if (!pag.alvo || lim == null || !mot) {
      toast("Escolha o reservatório e informe o limite e o motivo.");
      return;
    }
    const x = { nome: pag.alvo.nome, regra, lim: fmt(lim, 1), mot, sit: "aguardando aprovação" };
    ADM.excecoes.unshift(x);
    pedidoAdm(
      "Exceção de conferência",
      pag.alvo,
      `Regra <b>${esc(regra)}</b> com limite próprio de <b>${fmt(lim, 1)}</b> para este reservatório.`,
      mot,
      () => {
        x.sit = "vigente";
      }
    );
    excs();
  };
  ligarFiltrosSuspeitos(pag);
  listaSuspeitos(pag);
}

const corpoSuspeitos = pag =>
  `
    <nav class="indice" aria-label="Seções da página"><a href="#admin/suspeitos" data-alvo="su-regras">Regras de conferência</a><a href="#admin/suspeitos" data-alvo="su-exc">Exceções por reservatório</a><a href="#admin/suspeitos" data-alvo="su-fila">Fila</a></nav>
    <section class="cartao secao" id="su-regras" aria-labelledby="t-su-regras"><h2 id="t-su-regras"><small>1</small>Regras de conferência</h2>
      <p class="sub">Uma regra única, aplicada antes de publicar, vale para as páginas, a área de dados e a API. Os limites ficam em <a href="#admin/parametros">Parâmetros</a> e mudam só com aprovação.</p>
      <div class="tab-box"><table><thead><tr><th>Regra</th><th>Quando se aplica</th><th>Onde</th><th>Efeito</th><th class="r">Valores</th><th class="r">Aguardando</th></tr></thead>
        <tbody>${REGRAS_SUSP()
          .map(
            ([k, d, o, ef]) =>
              `<tr><td><span class="nm">${k[0].toUpperCase() + k.slice(1)}</span></td><td>${esc(d)}</td><td>${o}</td><td>${ef}</td><td class="r num">${fint(pag.S.filter(s => s.regra === k).length)}</td><td class="r num">${fint(pag.pend.filter(s => s.regra === k).length)}</td></tr>`
          )
          .join("")}</tbody></table></div>
      <p class="nota">Protótipo: a lista traz o que as regras encontraram nas séries embutidas: os valores barrados pelas regras nas três fichas de exemplo do Nordeste (desde 2006), as estações só com nível com série a verificar e as vazões afluentes diárias negativas do SIN (Furnas desde 2000; nas demais usinas, o dia mais recente).</p></section>
    <section class="cartao secao" id="su-exc" aria-labelledby="t-su-exc"><h2 id="t-su-exc"><small>2</small>Exceções por reservatório</h2>
      <p class="sub">Limite próprio de uma regra para um reservatório (por exemplo, açude que enche vários metros num dia de cheia). A exceção passa por aprovação, porque muda o que é publicado.</p>
      <div id="su-sel"></div>
      <div class="adm-form"><label>Regra<select id="su-regra">${REGRAS_SUSP()
        .slice(0, 4)
        .map(([k]) => `<option>${k}</option>`)
        .join(
          ""
        )}</select></label><label>Limite próprio<input type="text" id="su-lim" inputmode="decimal" placeholder="Ex.: 3,0"></label>
        <label class="largo">Motivo<input type="text" id="su-mot" placeholder="Ex.: açude de enchimento rápido"></label><button type="button" class="acao" id="su-exc-ir"${podeEditar() ? "" : " disabled"}>Enviar para aprovação</button></div>
      <div id="su-exc-lista"></div></section>
    <section class="cartao secao" id="su-fila" aria-labelledby="t-su-fila"><h2 id="t-su-fila"><small>3</small>Fila de revisão</h2>
      <p class="sub">Enquanto espera a decisão, o valor retirado fica fora da publicação, o valor improvável continua publicado e a estação a verificar fica fora das contagens. Decisão sobre um valor vale como edição pontual: sem aprovação, com motivo e registro das ações. Com uma regra escolhida no filtro, os valores retirados podem ser confirmados de uma vez, com um só motivo. Liberar a série inteira de uma estação passa por aprovação, porque ela entra nas contagens.</p>
      <div class="adm-form"><label>Regra<select id="su-f-regra"><option value="">Todas</option>${REGRAS_SUSP()
        .map(([k]) => `<option>${k}</option>`)
        .join("")}</select></label>
        <label>Situação<select id="su-f-sit"><option value="pend">Aguardando decisão</option><option value="ret">Retirados, aguardando decisão</option><option value="dec">Decididos ou revertidos</option><option value="">Todos</option></select></label>
        <label class="largo">Busca<input type="text" id="su-f-busca" placeholder="Reservatório ou estação"></label></div>
      <p class="nota" id="su-n"></p><div class="adm-form" id="su-lote"></div><div id="su-lista"></div><p class="mais-res" id="su-mais"></p></section>`;

const selSuspeitos = pag =>
  escolherRes(
    $("#su-sel"),
    e => e.mod === "NE",
    pag.alvo,
    e => {
      pag.alvo = e;
      selSuspeitos(pag);
    }
  );

const excs = () => {
  $("#su-exc-lista").innerHTML = ADM.excecoes.length
    ? `<div class="tab-box"><table><thead><tr><th>Reservatório</th><th>Regra</th><th class="r">Limite próprio</th><th>Motivo</th><th>Situação</th></tr></thead><tbody>${ADM.excecoes.map(x => `<tr><td><span class="nm">${esc(x.nome)}</span></td><td>${esc(x.regra)}</td><td class="r num">${esc(x.lim)}</td><td>${esc(x.mot)}</td><td>${esc(x.sit)}</td></tr>`).join("")}</tbody></table></div>`
    : '<p class="nota">Nenhuma exceção nesta sessão. No protótipo, a fila não é recalculada com as exceções.</p>';
};

const nomeK = k => nomeVar(CAT_VARS.find(v => v.k === k));

const filtrada = pag => {
  const tm = normalizaBusca(pag.st.txt).split(/\s+/).filter(Boolean);
  return pag.S.filter(
    s =>
      (!pag.st.regra || s.regra === pag.st.regra) &&
      (!pag.st.sit ||
        (pag.st.sit === "pend"
          ? !ADM.susp[s.id]
          : pag.st.sit === "ret"
            ? s.retirado && !ADM.susp[s.id]
            : !!ADM.susp[s.id])) &&
      tm.every(t => normalizaBusca(s.e.nome + " " + s.e.codigo + " " + s.e.uf).includes(t))
  );
};

function listaSuspeitos(pag) {
  const L = filtrada(pag),
    vis = L.slice(0, pag.st.mostrar);
  $("#su-n").textContent = `${fint(L.length)} ${L.length === 1 ? "valor" : "valores"}.`;
  // retirados de uma mesma regra, confirmados de uma vez (com a regra escolhida no filtro)
  const lote = pag.st.regra ? L.filter(s => s.retirado && !ADM.susp[s.id]) : [];
  $("#su-lote").innerHTML =
    lote.length > 1 && podeEditar()
      ? `<label class="largo">Motivo<input type="text" id="su-lote-mot" value="Conferido: não são leituras reais"></label><button type="button" class="acao" id="su-lote-ir">Confirmar a retirada dos ${fint(lote.length)} valores</button>`
      : "";
  if ($("#su-lote-ir"))
    $("#su-lote-ir").onclick = () => {
      const mot = $("#su-lote-mot").value.trim();
      if (!mot) {
        toast("Informe o motivo.");
        return;
      }
      lote.forEach(s => decidir(pag, s, "confirmar", "Confirmar a retirada", mot));
      toast(`${fint(lote.length)} retiradas confirmadas.`);
    };
  $("#su-lista").innerHTML = vis.length
    ? `<div class="tab-box adm-tab"><table><thead><tr><th>Reservatório</th><th>Data</th><th>Variável</th><th class="r">Valor</th><th>Vizinhos</th><th>Regra</th><th>Decisão</th></tr></thead><tbody>${vis
        .map(s => {
          const d = ADM.susp[s.id],
            dec = (k, v) => (k === "afluente_m3s" ? (Number.isInteger(v) ? 0 : 1) : 2);
          return `<tr><td><span class="nm">${esc(s.e.nome)}</span><span class="rio">${esc([s.e.codigo ? "código " + s.e.codigo : "", s.e.uf, s.tipo === "estacao" && !s.no_sar ? "fora do cadastro do SAR" : ""].filter(Boolean).join(" · "))}</span></td>
        <td>${s.t ? dBR(s.t) : "série"}</td><td>${s.tipo === "estacao" ? "Maior salto (m)" : esc(nomeK(s.k))}</td><td class="r num">${fmt(s.v, dec(s.k, s.v))}</td>
        <td class="viz">${s.ant ? `${fmt(s.ant[1], dec(s.k, s.ant[1]))} em ${dBR(s.ant[0])}` : "–"}<br>${s.seg ? `${fmt(s.seg[1], dec(s.k, s.seg[1]))} em ${dBR(s.seg[0])}` : "–"}</td><td>${esc(s.regra)}</td>
        <td>${
          d
            ? `<span class="adm-sit ${d.acao === "devolver" || d.acao === "liberar" || d.acao === "retirar" ? "fila" : "ok"}">${esc(d.rot)}</span><span class="rio">${esc(d.quem)}, ${esc(d.quando)}</span>`
            : pag.st.dec && pag.st.dec.id === s.id
              ? `<span class="adm-dec"><b>${esc(pag.st.dec.rot)}</b><input type="text" class="su-mot" value="${esc(pag.st.dec.pad)}" aria-label="Motivo"><button type="button" class="acao su-ok">Confirmar</button><button type="button" class="acao sec su-canc">Cancelar</button></span>`
              : podeEditar()
                ? `${s.retirado ? '<span class="rio">retirado da publicação</span>' : s.tipo === "estacao" ? '<span class="rio">fora das contagens</span>' : '<span class="rio">publicado até a decisão</span>'}<span class="adm-acoes">${acoesSusp(
                    s
                  )
                    .map(
                      ([a, r]) =>
                        `<button type="button" class="acao sec" data-id="${esc(s.id)}" data-a="${a}">${r}</button>`
                    )
                    .join("")}</span>`
                : '<span class="nota">só editor ou aprovador</span>'
        }</td></tr>`;
        })
        .join("")}</tbody></table></div>`
    : '<p class="nota">Nenhum valor com esse filtro.</p>';
  $("#su-mais").innerHTML =
    L.length > vis.length
      ? `<button type="button" class="acao sec">Mostrar mais (${fint(L.length - vis.length)} restantes)</button>`
      : "";
  if ($("#su-mais button"))
    $("#su-mais button").onclick = () => {
      pag.st.mostrar += 40;
      listaSuspeitos(pag);
    };
  $$("#su-lista [data-a]").forEach(
    b =>
      (b.onclick = () => {
        const s = pag.S.find(x => x.id === b.dataset.id),
          a = b.dataset.a;
        pag.st.dec = {
          id: s.id,
          a,
          rot: b.textContent,
          pad:
            a === "confirmar"
              ? s.tipo === "sin"
                ? "Conferido: vazão negativa, não é vazão real"
                : "Conferido: não é leitura real"
              : a === "manter"
                ? s.tipo === "descarte"
                  ? "Conferido: o valor corresponde à leitura real"
                  : "Conferido: série ainda inconsistente"
                : ""
        };
        listaSuspeitos(pag);
        const i = $("#su-lista .su-mot");
        if (i) {
          i.focus();
          i.select();
        }
      })
  );
  if ($("#su-lista .su-canc"))
    $("#su-lista .su-canc").onclick = () => {
      pag.st.dec = null;
      listaSuspeitos(pag);
    };
  if ($("#su-lista .su-ok"))
    $("#su-lista .su-ok").onclick = () => {
      const mot = $("#su-lista .su-mot").value,
        d = pag.st.dec;
      if (!mot.trim()) {
        toast("Informe o motivo.");
        return;
      }
      pag.st.dec = null;
      decidir(
        pag,
        pag.S.find(x => x.id === d.id),
        d.a,
        d.rot,
        mot
      );
    };
}

function decidir(pag, s, a, rot, mot) {
  const reg = { acao: a, rot, quem: ADM_USU[ADM.perfil], quando: agoraAdm(), mot };
  const txt = `${s.t ? dBR(s.t) + " · " : ""}${s.tipo === "estacao" ? "maior salto " + fmt(s.v, 2) + " m" : nomeK(s.k) + " " + fmt(s.v, 2)} (${s.regra})`;
  if (a === "liberar") {
    reg.rot = "liberação aguardando aprovação";
    ADM.susp[s.id] = reg;
    pedidoAdm(
      "Liberar série de estação",
      s.e,
      `A estação volta às contagens do Nordeste e Semiárido. Maior salto da série: <b>${fmt(s.v, 2)} m</b> (${esc(s.regra)}).`,
      mot,
      () => {
        reg.rot = "série liberada";
      }
    );
    admSuspeitos();
    return;
  }
  ADM.susp[s.id] = reg;
  if (a === "devolver") {
    (ADM.novos[s.e.id] = ADM.novos[s.e.id] || []).push({ t: s.t, v: { [s.k]: s.v } });
    revisaoAdm(s.e, `Valor de ${dBR(s.t)} (${nomeK(s.k)}) devolvido à série depois de conferido`, mot.trim());
  }
  if (a === "retirar") {
    (ADM.apagados[s.e.id] = ADM.apagados[s.e.id] || []).push({ de: s.t, ate: s.t, vars: [s.k] });
    revisaoAdm(s.e, `Valor de ${dBR(s.t)} (${nomeK(s.k)}) retirado da série publicada`, mot.trim());
  }
  trilhaAdm(
    "Valor suspeito: " + rot.toLowerCase(),
    s.e.id ? s.e : { nome: s.e.nome, codigo: "" },
    txt,
    mot.trim(),
    "gravado"
  );
  toast(`${rot}: incluído no registro das ações.`);
  listaSuspeitos(pag);
  abasAdm();
}

const ligarFiltrosSuspeitos = pag => {
  $("#su-f-regra").onchange = e => {
    pag.st.regra = e.target.value;
    pag.st.mostrar = 20;
    listaSuspeitos(pag);
  };
  $("#su-f-sit").onchange = e => {
    pag.st.sit = e.target.value;
    pag.st.mostrar = 20;
    listaSuspeitos(pag);
  };
  $("#su-f-busca").oninput = e => {
    pag.st.txt = e.target.value;
    pag.st.mostrar = 20;
    listaSuspeitos(pag);
  };
};

/* ---------------- topologia da cascata (js/topologia.js): usinas com o rio e a usina a jusante; rios com o rio em que
   deságuam, o trecho da confluência e a ordem entre confluências do mesmo trecho. No protótipo, só a bacia do Grande. */
const nomeUsina = (T, id) => (id ? T.nos[id].nome : `a foz no ${T.foz}`);
// aplica a posição escolhida: devolve a topologia nova (T), o texto do efeito e, quando cabe, os afluentes que entravam
// no trecho em que a usina nova entra (para dizer se ficam acima ou abaixo dela)
function aplicaTopo(base, tp, novo) {
  if (!tp || !tp.rio) return { erro: "Escolha o rio e a posição da usina na cascata." };
  const T = JSON.parse(JSON.stringify(base));
  return tp.rio === "__novo" ? aplicaTopoRioNovo(T, tp, novo) : aplicaTopoRioExistente(T, base, tp, novo);
}
// usina num afluente novo (tp.rio "__novo"), que deságua num rio da cascata ou num rio sem usina (tp.desagua "__inter")
function aplicaTopoRioNovo(T, tp, novo) {
  const rios = T.rios,
    existe = nome => Object.keys(rios).some(r => semAc(r) === semAc(nome) || semAc(r) === semAc("rio " + nome));
  const nomeRio = (tp.nomeRio || "").trim(),
    inter = tp.desagua === "__inter" ? (tp.inter || "").trim() : null;
  if (!nomeRio) return { erro: "Informe no campo Rio o nome do afluente novo." };
  if (existe(nomeRio)) return { erro: `O ${nomeRio} já está na cascata: escolha-o na lista.` };
  if (tp.desagua === "__inter" && !inter)
    return { erro: "Informe o nome do rio sem usina em que o afluente novo deságua." };
  if (inter && (existe(inter) || semAc(inter) === semAc(nomeRio)))
    return { erro: `O ${inter} já está na cascata ou repete o nome do afluente: escolha-o na lista.` };
  const rec = inter ? tp.interDesagua : tp.desagua;
  if (!rec || tp.pos === "" || tp.pos == null)
    return { erro: "Escolha em que rio e em que trecho o afluente deságua." };
  const C = cadeiaRio(T.nos, rec),
    k = +tp.pos,
    jus = k < C.length ? C[k].id : null,
    quem = inter || nomeRio,
    mesmo = afluentesEm(T, rec, jus).reverse(), // confluências do trecho, de jusante para montante
    p = tp.ordem === "" || tp.ordem == null ? mesmo.length : Math.min(+tp.ordem, mesmo.length);
  mesmo.splice(p, 0, quem);
  rios[quem] = { desagua: rec, jusante: jus, ordem: 0 };
  mesmo.forEach((r, i) => (rios[r].ordem = i + 1));
  if (inter) rios[nomeRio] = { desagua: inter, jusante: null, ordem: 1 };
  T.nos[novo.id] = { ...novo, rio: nomeRio, jusante: null };
  refazJusantes(T);
  const tr = trechoConfluencia(T, quem);
  return {
    T,
    efeito:
      `${novo.nome} fica no ${nomeRio}, afluente novo${inter ? `, que deságua no ${inter}, rio sem usina que entra no diagrama só como ligação` : ""}; ` +
      `o ${quem} deságua no ${rec}${tr ? " " + tr : ""}` +
      (mesmo.length > 1
        ? `, e as confluências desse trecho ficam, de jusante para montante: ${mesmo.join(", ")}`
        : "") +
      `; a usina a jusante de ${novo.nome} é ${nomeUsina(T, T.nos[novo.id].jusante)}.`
  };
}
// usina num rio que já está na cascata, na posição tp.pos (0 = acima da primeira usina); os afluentes que entravam no
// trecho ficam acima ou abaixo da usina nova conforme tp.afl
function aplicaTopoRioExistente(T, base, tp, novo) {
  const rios = T.rios,
    C = cadeiaRio(T.nos, tp.rio);
  if (tp.pos === "" || tp.pos == null) return { erro: "Escolha a posição da usina no rio." };
  const kk = +tp.pos,
    jusAntes = kk < C.length ? C[kk].id : null,
    mon = kk > 0 ? T.nos[C[kk - 1].id] : null;
  T.nos[novo.id] = { ...novo, rio: tp.rio, jusante: jusAntes };
  if (mon) mon.jusante = novo.id;
  // afluentes que entravam logo acima da usina de baixo (ou abaixo da última): ficam acima ou abaixo da nova
  const afl = afluentesEm(base, tp.rio, jusAntes);
  const partes = [
    `${novo.nome} entra no ${tp.rio} ${!C.length ? "(rio sem usina até agora)" : kk === 0 ? `acima de ${C[0].nome} (nova cabeceira)` : kk < C.length ? `entre ${C[kk - 1].nome} e ${C[kk].nome}` : `abaixo de ${C[C.length - 1].nome}`}`
  ];
  if (mon) partes.push(`${mon.nome} passa a descarregar em ${novo.nome}`);
  afl.forEach(r => {
    if ((tp.afl || {})[r] === "acima") {
      rios[r].jusante = novo.id;
      partes.push(`o ${r} passa a desaguar acima de ${novo.nome}`);
    } else partes.push(`o ${r} continua desaguando abaixo de ${novo.nome}`);
  });
  refazJusantes(T);
  partes.push(`a usina a jusante de ${novo.nome} é ${nomeUsina(T, T.nos[novo.id].jusante)}`);
  return { T, efeito: partes.join("; ") + ".", afl };
}
// prévia da cascata com a usina nova em destaque (vertical, como no celular)
const cascataTopoSVG = (T, destaque) =>
  svgCascata(T, { orient: "v", destaque, rotulo: "Prévia da cascata da bacia com a usina nova, gerada do cadastro" });

/* ---------------- inclusão de reservatório: rascunho → revisão → publicação */
const FONTES_INC = [
  "ONS",
  "FUNCEME",
  "AESA",
  "APAC",
  "COGERH",
  "HidroInfoAna (observador)",
  "SABESP",
  "GDH/Coletor",
  "Operador do reservatório",
  "Outra"
];
const UF_TODAS = [
  "AC",
  "AL",
  "AM",
  "AP",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MG",
  "MS",
  "MT",
  "PA",
  "PB",
  "PE",
  "PI",
  "PR",
  "RJ",
  "RN",
  "RO",
  "RR",
  "RS",
  "SC",
  "SE",
  "SP",
  "TO"
];
function admInclusao() {
  const pag = {}; // estado da página, passado às funções abaixo

  tituloAdm(
    "Inclusão de reservatório",
    "Nos três módulos, em três passos: rascunho, revisão por outra pessoa e publicação. O sistema confere nome, posição e código na fonte contra o cadastro antes de enviar.",
    `<span><b>${ADM.inclusoes.filter(x => x.sit === "em revisão").length}</b> em revisão</span>`
  );
  $("#conteudo").innerHTML = corpoInclusao();
  pag.f = ADM.incAtual || vazio();
  ADM.incAtual = pag.f;
  pag.mapa = null;
  pag.marca = null;
  ligarBotoesInclusao(pag);
  campos(pag);
  iniciarMapa(pag);
  itens(pag);
}

const corpoInclusao = () =>
  `
    <nav class="indice" aria-label="Seções da página"><a href="#admin/inclusao" data-alvo="in-form">Dados do reservatório</a><a href="#admin/inclusao" data-alvo="in-conf">Conferência</a><a href="#admin/inclusao" data-alvo="in-lista">Inclusões</a></nav>
    <section class="cartao secao" id="in-form" aria-labelledby="t-in-form"><h2 id="t-in-form"><small>1</small>Dados do reservatório</h2>
      <p class="sub">O código do SAR é atribuído na publicação. Clique no mapa para marcar a posição, ou digite as coordenadas.<span class="dica">Os pontos cinza são os reservatórios já cadastrados.</span></p>
      <div class="adm-form grade" id="in-campos"></div>
      <div class="adm-vars" id="in-vars"></div>
      <div class="adm-mapa" id="in-mapa"></div>
      <div id="in-topo"></div>
    </section>
    <section class="cartao secao" id="in-conf" aria-labelledby="t-in-conf"><h2 id="t-in-conf"><small>2</small>Conferência</h2>
      <p class="sub">Campos obrigatórios, nome parecido no mesmo estado, reservatório a menos de 2 km e código na fonte já usado por outro reservatório.</p>
      <div id="in-checks"></div>
      <div class="adm-form"><label class="largo">Motivo da inclusão<input type="text" id="in-mot" placeholder="Ex.: açude novo acompanhado pela FUNCEME"></label>
        <button type="button" class="acao sec" id="in-rasc"${podeEditar() ? "" : " disabled"}>Salvar rascunho</button><button type="button" class="acao" id="in-env"${podeEditar() ? "" : " disabled"}>Enviar para revisão</button><button type="button" class="acao sec" id="in-ex"${podeEditar() ? "" : " disabled"}>Exemplo no Nordeste</button><button type="button" class="acao sec" id="in-ex-sin"${podeEditar() ? "" : " disabled"}>Exemplo no SIN</button><button type="button" class="acao sec" id="in-ex-afl"${podeEditar() ? "" : " disabled"}>Exemplo em afluente de afluente</button></div></section>
    <section class="cartao secao" id="in-lista" aria-labelledby="t-in-lista"><h2 id="t-in-lista"><small>3</small>Inclusões</h2>
      <p class="sub">Rascunho, em revisão, devolvido ou publicado. O publicado entra na busca da página inicial e na área de dados e aparece na cobertura aguardando a primeira carga.</p><div id="in-itens"></div></section>`;

const vazio = () => ({
  n: null,
  mod: "NE",
  sis: "",
  nome: "",
  rio: "",
  municipio: "",
  uf: "CE",
  bacia: "",
  lat: "",
  lon: "",
  fonte: "FUNCEME",
  codfonte: "",
  tipo: "reservatorio",
  cap: "",
  vars: null,
  sit: "novo",
  topo: { rio: "", pos: "", desagua: "", afl: {} }
});

const ehGrande = pag => pag.f.mod === "SIN" && semAc(pag.f.bacia).trim() === "grande";

const novoNo = pag => ({
  id: "__nova",
  nome: (pag.f.nome || "Usina nova").trim(),
  tipo: pag.f.tipo === "fio" ? "fio" : "res"
});

const calcTopo = pag => aplicaTopo(topoGrande(), { ...pag.f.topo, nomeRio: pag.f.rio }, novoNo(pag));

// posição na cascata (SIN): rio e entre quais usinas, ou afluente novo e onde deságua; prévia da cascata da bacia
function topoForm(pag) {
  const el = $("#in-topo");
  if (!el) return;
  if (pag.f.mod !== "SIN") {
    el.innerHTML = "";
    return;
  }
  if (!pag.f.topo) pag.f.topo = { rio: "", pos: "", desagua: "", afl: {} };
  if (!ehGrande(pag)) {
    el.innerHTML = `<div class="adm-topo"><h3>Posição na cascata</h3><p class="nota">Escolha a bacia. No protótipo, só a bacia do Grande tem a topologia montada; no sistema, cada bacia do SIN tem a sua, e o diagrama da página da bacia é gerado dela.</p></div>`;
    return;
  }
  const T = topoGrande(),
    rios = Object.keys(T.rios),
    tp = pag.f.topo,
    nov = tp.rio === "__novo",
    inter = nov && tp.desagua === "__inter",
    rec = nov ? (inter ? tp.interDesagua : tp.desagua) : tp.rio,
    C = rec ? cadeiaRio(T.nos, rec) : [];
  const opPos = !rec
    ? []
    : C.length
      ? [
          [0, `Acima de ${C[0].nome} (${nov ? "trecho mais a montante" : "nova cabeceira"})`],
          ...C.slice(1).map((n, i) => [i + 1, `Entre ${C[i].nome} e ${n.nome}`]),
          [C.length, `Abaixo de ${C[C.length - 1].nome}`]
        ]
      : [[0, "No rio (ainda sem usina)"]];
  // afluente novo num trecho que já recebe outros: posição da confluência entre eles
  const jusSel = tp.pos === "" || tp.pos == null ? undefined : +tp.pos < C.length ? C[+tp.pos].id : null,
    mesmo = nov && jusSel !== undefined ? afluentesEm(T, rec, jusSel).reverse() : [],
    opOrd = mesmo.length
      ? [
          [0, `Abaixo da confluência do ${mesmo[0]}`],
          ...mesmo.slice(1).map((x, i) => [i + 1, `Entre as confluências do ${mesmo[i]} e do ${x}`]),
          [mesmo.length, `Acima da confluência do ${mesmo[mesmo.length - 1]}`]
        ]
      : [];
  const r = calcTopo(pag);
  const opts = (lista, atual) => lista.map(x => `<option${atual === x ? " selected" : ""}>${esc(x)}</option>`).join("");
  el.innerHTML = `<div class="adm-topo"><h3>Posição na cascata</h3>
      <p class="nota">O diagrama da bacia é gerado do cadastro: cada usina guarda o rio e a usina imediatamente a jusante, e cada rio guarda em que rio deságua, em que trecho e em que ordem entre as confluências do mesmo trecho. Um rio sem usina pode entrar só como ligação, para a usina de um afluente de afluente. Escolha onde a usina nova entra; a prévia mostra a cascata como vai ficar.</p>
      <div class="adm-form">
        <label>Rio<select id="tp-rio"><option value="">Escolha</option>${opts(rios, tp.rio)}<option value="__novo"${nov ? " selected" : ""}>Afluente novo (o do campo Rio)</option></select></label>
        ${nov ? `<label>Deságua no<select id="tp-des"><option value="">Escolha</option>${opts(rios, tp.desagua)}<option value="__inter"${inter ? " selected" : ""}>Rio sem usina (informe o nome)</option></select></label>` : ""}
        ${inter ? `<label>Rio sem usina<input type="text" id="tp-inter" value="${esc(tp.inter || "")}" placeholder="Ex.: ribeirão Tal"></label><label>que deságua no<select id="tp-intdes"><option value="">Escolha</option>${opts(rios, tp.interDesagua)}</select></label>` : ""}
        ${rec ? `<label class="largo">${nov ? "Trecho da confluência" : "Posição no rio"}<select id="tp-pos"><option value="">Escolha</option>${opPos.map(([k, x]) => `<option value="${k}"${String(tp.pos) === String(k) ? " selected" : ""}>${esc(x)}</option>`).join("")}</select></label>` : ""}
        ${opOrd.length ? `<label class="largo">Entre as confluências do trecho<select id="tp-ord">${opOrd.map(([k, x]) => `<option value="${k}"${String(tp.ordem === "" || tp.ordem == null ? mesmo.length : tp.ordem) === String(k) ? " selected" : ""}>${esc(x)}</option>`).join("")}</select></label>` : ""}
        ${(r.afl || []).map(rio => `<label class="largo">O ${esc(rio)} deságua<select data-afl="${esc(rio)}"><option value="abaixo"${(tp.afl || {})[rio] !== "acima" ? " selected" : ""}>abaixo da usina nova</option><option value="acima"${(tp.afl || {})[rio] === "acima" ? " selected" : ""}>acima da usina nova</option></select></label>`).join("")}
      </div>
      ${r.erro ? `<p class="adm-efeito">${esc(r.erro)}</p>` : `<p class="adm-efeito"><b>Efeito na cascata.</b> ${esc(r.efeito)} O diagrama da página da bacia, a tabela, o mapa e o KMZ passam a mostrar a usina quando a inclusão for aprovada.</p><div class="adm-cascata" id="tp-prev"></div>`}</div>`;
  if (!r.erro) $("#tp-prev").append(cascataTopoSVG(r.T, "__nova"));
  const sel = (id, fn) => {
    const s = $("#" + id);
    if (s)
      s.onchange = () => {
        fn(s.value);
        topoForm(pag);
        conferir(pag);
      };
  };
  sel("tp-rio", v => {
    tp.rio = v;
    tp.pos = "";
    tp.ordem = "";
    tp.afl = {};
  });
  sel("tp-des", v => {
    tp.desagua = v;
    tp.pos = "";
    tp.ordem = "";
  });
  sel("tp-inter", v => (tp.inter = v));
  sel("tp-intdes", v => {
    tp.interDesagua = v;
    tp.pos = "";
    tp.ordem = "";
  });
  sel("tp-pos", v => {
    tp.pos = v;
    tp.ordem = "";
    tp.afl = {};
  });
  sel("tp-ord", v => (tp.ordem = v));
  $$("#in-topo [data-afl]").forEach(
    s =>
      (s.onchange = () => {
        tp.afl = { ...tp.afl, [s.dataset.afl]: s.value };
        topoForm(pag);
        conferir(pag);
      })
  );
}

const varsMod = m =>
  m === "SIN"
    ? [
        "cota_m",
        "afluente_m3s",
        "defluente_m3s",
        "turbinada_m3s",
        "vertida_m3s",
        "vazao_natural_m3s",
        "volume_util_pct"
      ]
    : m === "NE"
      ? ["cota_m", "volume_hm3", "volume_pct"]
      : ["cota_m", "volume_hm3", "volume_pct", "volume_util_pct"];

function campos(pag) {
  if (!pag.f.vars) pag.f.vars = varsMod(pag.f.mod);
  $("#in-campos").innerHTML = `
      <label>Módulo<select data-f="mod">${[
        ["SIN", "SIN"],
        ["NE", "Nordeste e Semiárido"],
        ["OUTROS", "Outros Sistemas"]
      ]
        .map(([v, r]) => `<option value="${v}"${pag.f.mod === v ? " selected" : ""}>${r}</option>`)
        .join("")}</select></label>
      ${
        pag.f.mod === "OUTROS"
          ? `<label>Sistema<select data-f="sis">${Object.entries(NOME_SIS)
              .map(([k, r]) => `<option value="${k}"${pag.f.sis === k ? " selected" : ""}>${r}</option>`)
              .join(
                ""
              )}<option value="novo"${pag.f.sis === "novo" ? " selected" : ""}>Sistema novo</option></select></label>`
          : ""
      }
      ${pag.f.mod === "SIN" ? `<label>Tipo<select data-f="tipo"><option value="reservatorio"${pag.f.tipo === "reservatorio" ? " selected" : ""}>Usina com reservatório</option><option value="fio"${pag.f.tipo === "fio" ? " selected" : ""}>Usina a fio d'água</option></select></label>` : ""}
      <label>Nome<input type="text" data-f="nome" value="${esc(pag.f.nome)}"></label><label>Rio<input type="text" data-f="rio" value="${esc(pag.f.rio)}"></label>
      <label>Município<input type="text" data-f="municipio" value="${esc(pag.f.municipio)}"></label><label>UF<select data-f="uf">${UF_TODAS.map(u => `<option${pag.f.uf === u ? " selected" : ""}>${u}</option>`).join("")}</select></label>
      <label>${pag.f.mod === "SIN" ? "Bacia (divisão do ONS)" : "Bacia"}<input type="text" data-f="bacia" value="${esc(pag.f.bacia)}"${pag.f.mod === "SIN" ? ' list="in-bacias"' : ""}></label>${
        pag.f.mod === "SIN"
          ? `<datalist id="in-bacias">${[
              ...new Set(
                entidadesDados()
                  .filter(e => e.mod === "SIN")
                  .map(e => e.bacia)
              )
            ]
              .sort()
              .map(b => `<option value="${esc(b)}">`)
              .join("")}</datalist>`
          : ""
      }
      <label>Latitude<input type="text" data-f="lat" inputmode="decimal" value="${esc(pag.f.lat)}" placeholder="-5,48996"></label><label>Longitude<input type="text" data-f="lon" inputmode="decimal" value="${esc(pag.f.lon)}" placeholder="-38,45106"></label>
      <label>Fonte do dado<select data-f="fonte">${FONTES_INC.map(x => `<option${pag.f.fonte === x ? " selected" : ""}>${x}</option>`).join("")}</select></label><label>Código ou nome na fonte<input type="text" data-f="codfonte" value="${esc(pag.f.codfonte)}"></label>
      ${pag.f.mod !== "SIN" ? `<label>Capacidade (hm³)<input type="text" data-f="cap" inputmode="decimal" value="${esc(pag.f.cap)}" placeholder="sem curva: só nível"></label>` : ""}`;
  $("#in-vars").innerHTML =
    `<b>Variáveis</b>` +
    CAT_VARS.filter(v => varsMod(pag.f.mod).includes(v.k))
      .map(
        v =>
          `<label><input type="checkbox" value="${v.k}"${pag.f.vars.includes(v.k) ? " checked" : ""}> ${esc(nomeVar(v))}</label>`
      )
      .join("") +
    (pag.f.mod !== "SIN"
      ? `<span class="nota">Sem capacidade e sem curva cota-volume, o reservatório entra só com o nível; a curva se envia depois, em Cadastro e curva.</span>`
      : "");
  topoForm(pag);
  $$("#in-campos [data-f]").forEach(
    i =>
      (i.oninput = i.onchange =
        () => {
          const k = i.dataset.f;
          pag.f[k] = i.value;
          if (k === "mod") {
            pag.f.vars = varsMod(pag.f.mod);
            if (pag.f.mod === "OUTROS" && !pag.f.sis) pag.f.sis = "df";
            pag.f.fonte = pag.f.mod === "SIN" ? "ONS" : pag.f.mod === "OUTROS" ? "GDH/Coletor" : "FUNCEME";
            campos(pag);
          }
          if (k === "lat" || k === "lon") ponto(pag);
          if (["bacia", "rio", "nome", "tipo"].includes(k)) topoForm(pag);
          conferir(pag);
        })
  );
  $$("#in-vars input").forEach(
    c =>
      (c.onchange = () => {
        pag.f.vars = $$("#in-vars input:checked").map(x => x.value);
        conferir(pag);
      })
  );
  conferir(pag);
}

function ponto(pag) {
  const la = numBR(pag.f.lat),
    lo = numBR(pag.f.lon);
  if (!pag.mapa) return;
  if (la == null || lo == null || Math.abs(la) > 90 || Math.abs(lo) > 180) {
    if (pag.marca) {
      pag.marca.remove();
      pag.marca = null;
    }
    return;
  }
  if (!pag.marca) pag.marca = window.L.marker([la, lo]).addTo(pag.mapa);
  else pag.marca.setLatLng([la, lo]);
}

function iniciarMapa(pag) {
  if (!window.L) {
    $("#in-mapa").innerHTML = '<p class="nota">Mapa indisponível (biblioteca de mapas não carregou).</p>';
    return;
  }
  pag.mapa = window.L.map($("#in-mapa"), { zoomControl: true }).setView([-9.5, -44], 4);
  window.L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap",
    maxZoom: 18,
    opacity: 0.85
  }).addTo(pag.mapa);
  entidadesDados().forEach(e => {
    const c = coordEnt(e);
    if (c)
      window.L.circleMarker(c, { radius: 3, color: COR.apagado, weight: 1, fillColor: "#9AA8BC", fillOpacity: 0.8 })
        .bindTooltip(esc(e.nome))
        .addTo(pag.mapa);
  });
  pag.mapa.on("click", ev => {
    pag.f.lat = String(Math.round(ev.latlng.lat * 1e5) / 1e5).replace(".", ",");
    pag.f.lon = String(Math.round(ev.latlng.lng * 1e5) / 1e5).replace(".", ",");
    $('[data-f="lat"]').value = pag.f.lat;
    $('[data-f="lon"]').value = pag.f.lon;
    ponto(pag);
    conferir(pag);
  });
  ponto(pag);
  setTimeout(() => pag.mapa.invalidateSize(), 60);
}

function checks(pag) {
  const E = entidadesDados(),
    R = [],
    nB = normalizaBusca(pag.f.nome),
    la = numBR(pag.f.lat),
    lo = numBR(pag.f.lon);
  const falta = [
    ["nome", "Nome"],
    ["municipio", "Município"],
    ["uf", "UF"],
    ["lat", "Latitude"],
    ["lon", "Longitude"],
    ["fonte", "Fonte"],
    ["codfonte", "Código na fonte"]
  ]
    .filter(([k]) => !String(pag.f[k] || "").trim())
    .map(x => x[1]);
  if (falta.length) R.push(["erro", `Falta preencher: ${falta.join(", ")}.`]);
  if ((la != null && (la < -34 || la > 6)) || (lo != null && (lo < -74 || lo > -34)))
    R.push(["erro", "As coordenadas estão fora do Brasil."]);
  if (!pag.f.vars.length) R.push(["erro", "Escolha ao menos uma variável."]);
  if (nB.length >= 3) {
    const par = E.filter(
      e =>
        e.uf === pag.f.uf &&
        e.src !== "can" &&
        (e.nomeB === nB || (nB.length >= 5 && (e.nomeB.includes(nB) || nB.includes(e.nomeB))))
    );
    par
      .slice(0, 5)
      .forEach(e =>
        R.push([
          "aviso",
          `Nome parecido no mesmo estado: ${e.nome}${e.codigo ? " (código " + e.codigo + ")" : ""}, ${ROT_MOD[e.mod]}${e.municipio ? ", " + e.municipio : ""}.`
        ])
      );
  }
  if (la != null && lo != null) {
    const perto = E.map(e => ({ e, c: coordEnt(e) }))
      .filter(x => x.c)
      .map(x => ({ e: x.e, d: distKm([la, lo], x.c) }))
      .filter(x => x.d < 2)
      .sort((a, b) => a.d - b.d);
    perto
      .slice(0, 3)
      .forEach(x =>
        R.push([
          "aviso",
          `A ${fmt(x.d, 2)} km de ${x.e.nome}${x.e.codigo ? " (código " + x.e.codigo + ")" : ""}: confira se não é o mesmo reservatório.`
        ])
      );
  }
  const cf = String(pag.f.codfonte || "").trim();
  if (cf) {
    const m =
      pag.f.fonte === "FUNCEME"
        ? DEPARA_NE.funceme_id_para_res_id
        : pag.f.fonte === "AESA"
          ? DEPARA_NE.aesa_nome_para_res_id
          : pag.f.fonte === "APAC"
            ? DEPARA_NE.apac_nome_para_res_id
            : null;
    const usado = m ? Object.entries(m).find(([k]) => semAc(k) === semAc(cf)) : null,
      extra = ADM.codigos.find(x => x.fonte === pag.f.fonte && semAc(x.cf) === semAc(cf));
    const cod = usado ? usado[1] : extra ? extra.sar : null;
    if (cod != null) {
      const e = E.find(x => String(x.codigo) === String(cod));
      R.push([
        "erro",
        `O código ${cf} da ${pag.f.fonte} já corresponde ao código SAR ${cod}${e ? " (" + e.nome + ")" : ""}.`
      ]);
    }
  }
  if (pag.f.mod === "SIN") {
    if (!String(pag.f.bacia || "").trim()) R.push(["erro", "Falta a bacia (divisão do ONS)."]);
    else if (ehGrande(pag)) {
      const tr = calcTopo(pag);
      if (tr.erro) R.push(["erro", "Cascata: " + tr.erro]);
    } else
      R.push(["aviso", "Bacia sem topologia montada no protótipo: a posição na cascata será definida no sistema."]);
  }
  if (!R.some(r => r[0] === "erro") && !R.length)
    R.push([
      "ok",
      "Nada a apontar: nenhum nome parecido no estado, nenhum reservatório a menos de 2 km e código na fonte livre."
    ]);
  return R;
}

function conferir(pag) {
  const R = checks(pag);
  $("#in-checks").innerHTML =
    `<ul class="adm-checks">${R.map(([t, m]) => `<li class="${t}">${esc(m)}</li>`).join("")}</ul>`;
  $("#in-env").disabled = !podeEditar() || R.some(r => r[0] === "erro");
  return R;
}

function salvar(pag, sit) {
  const mot = $("#in-mot").value.trim();
  if (sit === "em revisão" && !mot) {
    toast("Informe o motivo da inclusão.");
    $("#in-mot").focus();
    return;
  }
  const novo = pag.f.n == null;
  if (novo) {
    pag.f.n = ADM.seq++;
    ADM.inclusoes.unshift(pag.f);
  }
  pag.f.sit = sit;
  pag.f.mot = mot;
  pag.f.quando = agoraAdm();
  pag.f.por = ADM_USU[ADM.perfil];
  const alvo = { nome: pag.f.nome, codigo: "", id: null };
  if (sit === "rascunho") {
    trilhaAdm("Inclusão: rascunho", alvo, `${ROT_MOD[pag.f.mod]}, ${pag.f.municipio}/${pag.f.uf}`, mot, "rascunho");
    toast("Rascunho salvo.");
  } else {
    const R = checks(pag).filter(r => r[0] === "aviso"),
      g = pag.f;
    pedidoAdm(
      "Incluir reservatório",
      alvo,
      `<b>${esc(pag.f.nome)}</b> · ${ROT_MOD[pag.f.mod]}${pag.f.mod === "OUTROS" ? " (" + esc(NOME_SIS[pag.f.sis] || "sistema novo") + ")" : ""} · ${esc(pag.f.municipio)}/${pag.f.uf} · ${esc(pag.f.lat)}, ${esc(pag.f.lon)} · fonte ${esc(pag.f.fonte)} (${esc(pag.f.codfonte)}) · ${pag.f.vars.length} variáveis${pag.f.mod === "SIN" ? "" : pag.f.cap ? " · capacidade " + esc(pag.f.cap) + " hm³" : " · só nível"}.${pag.f.mod === "SIN" && ehGrande(pag) ? " <b>Cascata:</b> " + esc(calcTopo(pag).efeito) : ""}${R.length ? " Avisos da conferência: " + R.map(r => esc(r[1])).join(" ") : ""}`,
      mot,
      () => publicar(g)
    );
    const p = ADM.pedidos[0];
    p.devolver = () => {
      g.sit = "devolvido";
      g.coment = p.decisao;
    };
    if (pag.f.mod === "SIN" && ehGrande(pag)) {
      const tr = calcTopo(pag);
      if (!tr.erro) p.cascata = tr.T;
    }
  }
  ADM.incAtual = vazio();
  pag.f = ADM.incAtual;
  $("#in-mot").value = "";
  campos(pag);
  ponto(pag);
  itens(pag);
}

function publicar(g) {
  const nInc = ADM.inclusoes.filter(x => x.sit === "publicado").length + 1;
  g.sit = "publicado";
  g.codigo = "P-" + String(nInc).padStart(3, "0");
  const la = numBR(g.lat),
    lo = numBR(g.lon),
    e = {
      id: "NOVO:" + g.codigo,
      codigo: g.codigo,
      nome: g.nome,
      mod: g.mod,
      sis: g.mod === "OUTROS" ? g.sis : undefined,
      uf: g.uf,
      municipio: g.municipio,
      bacia: g.mod === "OUTROS" ? NOME_SIS[g.sis] || g.bacia : g.bacia,
      tipo: "incluído, aguardando a primeira carga",
      vars: g.vars,
      hora: g.mod === "SIN",
      src: "novo",
      coord: la != null && lo != null ? [la, lo] : null,
      r: { nome: g.nome.toUpperCase(), bacia: "" }
    };
  e.nomeB = normalizaBusca(e.nome);
  e.busca = normalizaBusca(`${e.nome} ${e.codigo} ${e.municipio} ${e.uf} ${e.bacia} ${ROT_MOD[e.mod]}`);
  entidadesDados().push(e);
  COB = null;
  // SIN: a topologia da bacia passa a ter a usina, com o código provisório (as próximas inclusões já a veem)
  if (g.mod === "SIN" && semAc(g.bacia).trim() === "grande") {
    const tr = aplicaTopo(
      topoGrande(),
      { ...g.topo, nomeRio: g.rio },
      { id: g.codigo, nome: g.nome.trim(), tipo: g.tipo === "fio" ? "fio" : "res" }
    );
    if (!tr.erro) ADM.topo = tr.T;
  }
  if (g.codfonte)
    ADM.codigos.unshift({
      fonte: g.fonte,
      cf: g.codfonte,
      sar: g.codigo,
      nome: g.nome,
      uf: g.uf,
      vig: new Date().toISOString().slice(0, 10),
      mot: "inclusão do reservatório",
      sit: "nova"
    });
}

function itens(pag) {
  const L = ADM.inclusoes;
  $("#in-itens").innerHTML = L.length
    ? `<div class="tab-box"><table><thead><tr><th>Reservatório</th><th>Módulo</th><th>Município</th><th>Fonte</th><th>Situação</th><th>Por</th><th></th></tr></thead><tbody>${L.map(
        x => `<tr><td><span class="nm">${esc(x.nome || "(sem nome)")}</span>${x.codigo ? `<span class="rio">código ${esc(x.codigo)} (provisório do protótipo)</span>` : ""}</td><td>${ROT_MOD[x.mod]}</td><td>${esc(x.municipio)}/${x.uf}</td><td>${esc(x.fonte)} · ${esc(x.codfonte)}</td>
      <td><span class="adm-sit ${x.sit === "publicado" ? "ok" : x.sit === "devolvido" ? "erro" : "fila"}">${x.sit}</span>${x.coment ? `<span class="rio">${esc(x.coment)}</span>` : ""}</td><td>${esc(x.por || "")}<span class="rio">${esc(x.quando || "")}</span></td>
      <td class="r">${x.sit === "rascunho" || x.sit === "devolvido" ? `<button type="button" class="acao sec" data-n="${x.n}"${podeEditar() ? "" : " disabled"}>Abrir</button>` : ""}</td></tr>`
      ).join("")}</tbody></table></div>`
    : '<p class="nota">Nenhuma inclusão nesta sessão.</p>';
  $$("#in-itens [data-n]").forEach(
    b =>
      (b.onclick = () => {
        pag.f = ADM.incAtual = ADM.inclusoes.find(x => x.n === Number(b.dataset.n));
        $("#in-mot").value = pag.f.mot || "";
        campos(pag);
        ponto(pag);
        $("#in-form").scrollIntoView({ behavior: "smooth", block: "start" });
      })
  );
}

const ligarBotoesInclusao = pag => {
  $("#in-rasc").onclick = () => salvar(pag, "rascunho");
  $("#in-env").onclick = () => salvar(pag, "em revisão");
  $("#in-ex-sin").onclick = () => {
    const G = D.grande.res,
      a = G.find(r => r.nome === "P. COLOMBIA"),
      b = G.find(r => r.nome === "MARIMBONDO");
    const la = Math.round(((a.lat + b.lat) / 2) * 1e4) / 1e4,
      lo = Math.round(((a.lon + b.lon) / 2) * 1e4) / 1e4;
    Object.assign(pag.f, {
      mod: "SIN",
      nome: "UHE Exemplo",
      rio: "rio Grande",
      municipio: "Exemplo",
      uf: "MG",
      bacia: "Grande",
      lat: String(la).replace(".", ","),
      lon: String(lo).replace(".", ","),
      fonte: "ONS",
      codfonte: "EXEMPLO-1",
      tipo: "fio",
      cap: "",
      vars: null,
      topo: { rio: "rio Grande", pos: "", desagua: "", afl: {} }
    });
    const C = cadeiaRio(topoGrande().nos, "rio Grande");
    pag.f.topo.pos = String(C.findIndex(n => n.id === "MARIMBONDO"));
    $("#in-mot").value = "Exemplo do protótipo: usina fictícia entre Porto Colômbia e Marimbondo";
    campos(pag);
    ponto(pag);
    if (pag.mapa) pag.mapa.setView([la, lo], 8);
  };
  // usina fictícia num afluente novo que deságua num rio sem usina, afluente do Pardo entre Euclides da Cunha e Limoeiro
  $("#in-ex-afl").onclick = () => {
    const G = D.grande.res,
      a = G.find(x => x.nome === "E. DA CUNHA"),
      b = G.find(x => x.nome === "LIMOEIRO");
    const la = Math.round(((a.lat + b.lat) / 2 - 0.12) * 1e4) / 1e4,
      lo = Math.round(((a.lon + b.lon) / 2) * 1e4) / 1e4;
    Object.assign(pag.f, {
      mod: "SIN",
      nome: "PCH Exemplo",
      rio: "rio Exemplo",
      municipio: "Exemplo",
      uf: "SP",
      bacia: "Grande",
      lat: String(la).replace(".", ","),
      lon: String(lo).replace(".", ","),
      fonte: "ONS",
      codfonte: "EXEMPLO-2",
      tipo: "fio",
      cap: "",
      vars: null,
      topo: {
        rio: "__novo",
        desagua: "__inter",
        inter: "ribeirão Intermediário",
        interDesagua: "rio Pardo",
        pos: "",
        ordem: "",
        afl: {}
      }
    });
    pag.f.topo.pos = String(cadeiaRio(topoGrande().nos, "rio Pardo").findIndex(n => n.id === "LIMOEIRO"));
    $("#in-mot").value =
      "Exemplo do protótipo: usina fictícia num afluente novo que deságua num rio sem usina, afluente do Pardo entre Euclides da Cunha e Limoeiro";
    campos(pag);
    ponto(pag);
    if (pag.mapa) pag.mapa.setView([la, lo], 9);
  };
  $("#in-ex").onclick = () => {
    Object.assign(pag.f, {
      mod: "NE",
      nome: "Açude Exemplo",
      rio: "Riacho Exemplo",
      municipio: "Quixadá",
      uf: "CE",
      bacia: "Banabuiú",
      lat: "-4,97",
      lon: "-39,02",
      fonte: "FUNCEME",
      codfonte: "99999",
      cap: "",
      vars: ["cota_m"],
      tipo: "reservatorio"
    });
    $("#in-mot").value = "Exemplo do protótipo: nome e posição fictícios";
    campos(pag);
    ponto(pag);
    if (pag.mapa) pag.mapa.setView([-4.97, -39.02], 10);
  };
};

/* ---------------- correspondência de códigos das fontes */
function admCodigos() {
  const pag = {}; // estado da página, passado às funções abaixo

  const E = entidadesDados();
  pag.porCod = {};
  E.forEach(e => {
    if (e.codigo && !pag.porCod[e.codigo]) pag.porCod[e.codigo] = e;
  });
  pag.base = [];
  [
    ["FUNCEME", "funceme_id_para_res_id", "id"],
    ["AESA", "aesa_nome_para_res_id", "nome"],
    ["APAC", "apac_nome_para_res_id", "nome"]
  ].forEach(([fo, k, tipo]) =>
    Object.entries(DEPARA_NE[k] || {}).forEach(([cf, sar]) =>
      pag.base.push({ fonte: fo, cf, tipo, sar: String(sar), vig: "", sit: "" })
    )
  );
  Object.values(FOS)
    .filter(F => F.sis === "cantareira" && F.k)
    .forEach(F => {
      const c = Object.keys(FOS).find(x => FOS[x] === F);
      pag.base.push({ fonte: "SABESP", cf: F.k, tipo: "chave", sar: String(c), vig: "", sit: "" });
    });
  pag.cadastroNE = E.filter(e => e.src === "ne" && !retiradoAdm(e));
  tituloAdm(
    "Códigos das fontes",
    "Qual código ou nome de cada fonte corresponde a cada reservatório do SAR. É por essa tabela que a carga automática sabe onde gravar o dado.",
    `<span><b>${fint(pag.base.length)}</b> correspondências</span>`
  );
  pag.st = { fonte: "", txt: "", so: "", mostrar: 25 };
  $("#conteudo").innerHTML = corpoCodigos();
  ligarFiltrosCodigos(pag);
  pag.alvo = null;
  selCodigos(pag);
  ["co-f", "co-cf", "co-vig"].forEach(id => ($("#" + id).oninput = $("#" + id).onchange = (...a) => prev(pag, ...a)));
  $("#co-ir").onclick = () => {
    const mot = $("#co-mot").value.trim();
    if (!mot) {
      toast("Informe o motivo.");
      $("#co-mot").focus();
      return;
    }
    const fo = $("#co-f").value,
      cf = $("#co-cf").value.trim();
    ADM.codigos.unshift({ fonte: fo, cf, sar: String(pag.alvo.codigo), vig: $("#co-vig").value, mot });
    trilhaAdm(
      "Código da fonte",
      pag.alvo,
      `${fo} ${cf} → código SAR ${pag.alvo.codigo}, vigência ${dBR($("#co-vig").value)}`,
      mot,
      "gravado"
    );
    toast("Correspondência gravada.");
    $("#co-cf").value = "";
    $("#co-mot").value = "";
    pag.alvo = null;
    selCodigos(pag);
    prev(pag);
    pag.st.so = "mud";
    $("#co-so").value = "mud";
    listaCodigos(pag);
  };
  listaCodigos(pag);
}

const todas = pag => {
  const L = pag.base.map(x => ({ ...x }));
  ADM.codigos.forEach(n => {
    const i = L.findIndex(x => x.fonte === n.fonte && semAc(x.cf) === semAc(n.cf));
    if (i >= 0) L[i] = { ...L[i], ...n, sit: "alterada" };
    else L.unshift({ ...n, sit: n.sit || "nova" });
  });
  return L;
};

const corpoCodigos = () =>
  `
    <nav class="indice" aria-label="Seções da página"><a href="#admin/codigos" data-alvo="co-res">Situação</a><a href="#admin/codigos" data-alvo="co-lista">Correspondências</a><a href="#admin/codigos" data-alvo="co-nova">Nova ou alterada</a></nav>
    <section class="cartao secao" id="co-res" aria-labelledby="t-co-res"><h2 id="t-co-res"><small>1</small>Situação</h2>
      <p class="sub">Conferências feitas na hora: código da fonte ligado a dois reservatórios, código SAR que não existe no cadastro e reservatório do Nordeste sem correspondência em nenhuma fonte.</p>
      <div class="adm-cards" id="co-cards"></div>
      <p class="nota">Correspondências do Nordeste: Verificação NE SAR (CORSH, ago/2026), extraídas em ${dBR(DEPARA_NE._meta.extraido_em)}; ${esc(DEPARA_NE._meta.validacao)}. SABESP: chaves da API de dados observados usadas no protótipo. As demais fontes (ONS, GDH, HidroInfoAna) ainda serão levantadas.</p></section>
    <section class="cartao secao" id="co-lista" aria-labelledby="t-co-lista"><h2 id="t-co-lista"><small>2</small>Correspondências</h2>
      <div class="baixar"><button type="button" id="co-csv"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2v8m0 0L5 7m3 3 3-3M3 13h10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>CSV</button></div>
      <div class="adm-form"><span class="seg" role="group" aria-label="Fonte">${["", "FUNCEME", "AESA", "APAC", "SABESP"].map(v => `<button type="button" data-fo="${v}" aria-pressed="${v === ""}">${v || "Todas"}</button>`).join("")}</span>
        <label>Mostrar<select id="co-so"><option value="">Todas</option><option value="prob">Só com problema</option><option value="sem">Reservatórios do NE sem correspondência</option><option value="mud">Novas ou alteradas nesta sessão</option></select></label>
        <label class="largo">Busca<input type="text" id="co-busca" placeholder="Código, nome na fonte ou reservatório"></label></div>
      <p class="nota" id="co-n"></p><div id="co-tab"></div><p class="mais-res" id="co-mais"></p></section>
    <section class="cartao secao" id="co-nova" aria-labelledby="t-co-nova"><h2 id="t-co-nova"><small>3</small>Nova ou alterada</h2>
      <p class="sub">Gravada na hora, com vigência e motivo no registro das ações. Se o código da fonte já estiver ligado a outro reservatório, a tela avisa e a nova correspondência substitui a anterior a partir da vigência.</p>
      <div class="adm-form"><label>Fonte<select id="co-f">${["FUNCEME", "AESA", "APAC", "SABESP", "ONS", "COGERH", "HidroInfoAna", "GDH"].map(x => `<option>${x}</option>`).join("")}</select></label><label>Código ou nome na fonte<input type="text" id="co-cf"></label><label>Vigência<input type="date" id="co-vig" value="${new Date().toISOString().slice(0, 10)}"></label></div>
      <div id="co-sel"></div><p class="adm-efeito" id="co-prev">Escolha a fonte, o código e o reservatório do SAR.</p>
      <div class="adm-form"><label class="largo">Motivo<input type="text" id="co-mot" placeholder="Ex.: estação nova da FUNCEME para o açude"></label><button type="button" class="acao" id="co-ir" disabled>Gravar</button></div></section>`;

function avaliar(pag, L) {
  const cont = {};
  L.forEach(x => {
    const k = x.fonte + "|" + semAc(x.cf);
    cont[k] = (cont[k] || 0) + 1;
  });
  L.forEach(x => {
    x.e = pag.porCod[x.sar];
    x.prob = !x.e
      ? "código SAR fora do cadastro"
      : cont[x.fonte + "|" + semAc(x.cf)] > 1
        ? "código da fonte repetido"
        : "";
  });
  return L;
}

function cardsCodigos(pag, L) {
  const ligados = new Set(L.map(x => x.sar)),
    sem = pag.cadastroNE.filter(e => !ligados.has(String(e.codigo)));
  $("#co-cards").innerHTML = [
    ["Correspondências", L.length, "entre fontes e códigos do SAR"],
    ["Com problema", L.filter(x => x.prob).length, "código repetido ou fora do cadastro"],
    ["NE sem correspondência", sem.length, `de ${fint(pag.cadastroNE.length)} reservatórios do Nordeste acompanhados`],
    ["Nesta sessão", ADM.codigos.length, "novas ou alteradas"]
  ]
    .map(
      ([r, v, n], i) =>
        `<div class="card fixo${(i === 1 || i === 2) && v ? " alerta" : ""}"><div class="r">${r}</div><div class="v">${fint(v)}</div><div class="n">${n}</div></div>`
    )
    .join("");
  return sem;
}

function listaCodigos(pag) {
  const L = avaliar(pag, todas(pag)),
    sem = cardsCodigos(pag, L),
    tm = normalizaBusca(pag.st.txt).split(/\s+/).filter(Boolean);
  if (pag.st.so === "sem") {
    const X = sem.filter(e => tm.every(t => e.busca.includes(t)));
    $("#co-n").textContent =
      `${fint(X.length)} reservatórios do Nordeste sem correspondência em nenhuma fonte levantada.`;
    $("#co-tab").innerHTML =
      `<div class="tab-box adm-tab"><table><thead><tr><th>Reservatório</th><th>Código SAR</th><th>UF</th><th>Município</th></tr></thead><tbody>${X.slice(
        0,
        pag.st.mostrar
      )
        .map(
          e =>
            `<tr><td><span class="nm">${esc(e.nome)}</span></td><td>${esc(e.codigo)}</td><td>${e.uf}</td><td>${esc(e.municipio)}</td></tr>`
        )
        .join("")}</tbody></table></div>`;
    $("#co-mais").innerHTML =
      X.length > pag.st.mostrar
        ? `<button type="button" class="acao sec">Mostrar mais (${fint(X.length - pag.st.mostrar)} restantes)</button>`
        : "";
  } else {
    const X = L.filter(
      x =>
        (!pag.st.fonte || x.fonte === pag.st.fonte) &&
        (!pag.st.so || (pag.st.so === "prob" ? x.prob : x.sit)) &&
        tm.every(t => normalizaBusca(`${x.cf} ${x.sar} ${x.e ? x.e.nome + " " + x.e.municipio : ""}`).includes(t))
    );
    $("#co-n").textContent = `${fint(X.length)} ${X.length === 1 ? "correspondência" : "correspondências"}.`;
    $("#co-tab").innerHTML = X.length
      ? `<div class="tab-box adm-tab"><table><thead><tr><th>Fonte</th><th>Código ou nome na fonte</th><th>Código SAR</th><th>Reservatório no SAR</th><th>UF</th><th>Vigente desde</th><th>Situação</th></tr></thead><tbody>${X.slice(
          0,
          pag.st.mostrar
        )
          .map(
            x => `<tr><td>${x.fonte}</td><td>${esc(x.cf)}</td><td>${esc(x.sar)}</td><td>${x.e ? `<span class="nm">${esc(x.e.nome)}</span>` : "–"}</td><td>${x.e ? x.e.uf : "–"}</td><td>${x.vig ? dBR(x.vig) : "levantamento"}</td>
        <td>${x.prob ? `<span class="adm-sit erro">${x.prob}</span>` : x.sit ? `<span class="adm-sit fila">${x.sit}</span>` : '<span class="adm-sit ok">ok</span>'}</td></tr>`
          )
          .join("")}</tbody></table></div>`
      : '<p class="nota">Nenhuma correspondência com esse filtro.</p>';
    $("#co-mais").innerHTML =
      X.length > pag.st.mostrar
        ? `<button type="button" class="acao sec">Mostrar mais (${fint(X.length - pag.st.mostrar)} restantes)</button>`
        : "";
  }
  if ($("#co-mais button"))
    $("#co-mais button").onclick = () => {
      pag.st.mostrar += 50;
      listaCodigos(pag);
    };
}

const ligarFiltrosCodigos = pag => {
  $$("#co-lista .seg button").forEach(
    b =>
      (b.onclick = () => {
        pag.st.fonte = b.dataset.fo;
        $$("#co-lista .seg button").forEach(x => x.setAttribute("aria-pressed", x === b));
        pag.st.mostrar = 25;
        listaCodigos(pag);
      })
  );
  $("#co-so").onchange = e => {
    pag.st.so = e.target.value;
    pag.st.mostrar = 25;
    listaCodigos(pag);
  };
  $("#co-busca").oninput = e => {
    pag.st.txt = e.target.value;
    pag.st.mostrar = 25;
    listaCodigos(pag);
  };
  $("#co-csv").onclick = () =>
    salvarCSV(
      ["fonte", "codigo_na_fonte", "codigo_sar", "reservatorio", "uf", "vigencia", "situacao"],
      avaliar(pag, todas(pag)).map(x => [
        x.fonte,
        x.cf,
        x.sar,
        x.e ? x.e.nome : "",
        x.e ? x.e.uf : "",
        x.vig ? dBR(x.vig) : "",
        x.prob || x.sit || "ok"
      ]),
      "sar_codigos_fontes.csv"
    );
};

const prev = pag => {
  const fo = $("#co-f").value,
    cf = $("#co-cf").value.trim(),
    L = avaliar(pag, todas(pag)),
    ja = L.find(x => x.fonte === fo && semAc(x.cf) === semAc(cf));
  const ok = cf && pag.alvo && podeEditar();
  $("#co-ir").disabled = !ok;
  $("#co-prev").innerHTML =
    !cf || !pag.alvo
      ? "Escolha a fonte, o código e o reservatório do SAR."
      : ja && ja.sar === String(pag.alvo.codigo)
        ? `Essa correspondência já existe: ${esc(fo)} ${esc(cf)} → ${esc(pag.alvo.nome)}.`
        : ja
          ? `<b>Atenção.</b> ${esc(fo)} ${esc(cf)} hoje corresponde a <b>${esc(ja.e ? ja.e.nome : ja.sar)}</b> (código ${esc(ja.sar)}). A partir de ${dBR($("#co-vig").value)}, passa a corresponder a <b>${esc(pag.alvo.nome)}</b> (código ${esc(pag.alvo.codigo)}).`
          : `${esc(fo)} <b>${esc(cf)}</b> → <b>${esc(pag.alvo.nome)}</b> (código ${esc(pag.alvo.codigo)}), a partir de ${dBR($("#co-vig").value)}.`;
};

const selCodigos = pag =>
  escolherRes(
    $("#co-sel"),
    e => !!e.codigo,
    pag.alvo,
    e => {
      pag.alvo = e;
      selCodigos(pag);
      prev(pag);
    },
    "Reservatório do SAR"
  );

/* ---------------- composição dos agrupamentos */
// o Nordeste na data dos dados mais recentes, pelo mesmo cálculo da página do módulo (medição mais próxima na janela)
function sitNEAdm() {
  const s = contexto.dataRef;
  contexto.dataRef = NEd.data;
  const S = situacaoNE();
  contexto.dataRef = s;
  const R = {};
  S.lista.forEach(r => (R[r.i] = r));
  return { S, R };
}
function admAgrupamentos() {
  const pag = {}; // estado da página, passado às funções abaixo

  pag.E = entidadesDados();
  pag.dt = NEd.data;
  pag.G = [
    ...NEd.estados.map(x => ({
      k: "NE:" + x.uf,
      tipo: "ne",
      r: `Nordeste e Semiárido · ${x.estado}`,
      uf: x.uf,
      est: x
    })),
    // SIN: só o reservatório equivalente do SIN inteiro; não há valor agregado por bacia, e a bacia de cada usina é
    // atributo do cadastro (tela Cadastro e curva)
    { k: "SIN:equivalente", tipo: "sin", r: "SIN · Reservatório equivalente" },
    ...Object.entries(NOME_SIS).map(([s, r]) => ({ k: "OS:" + s, tipo: "os", r: `Outros Sistemas · ${r}`, sis: s }))
  ];
  tituloAdm(
    "Agrupamentos",
    "Quais reservatórios entram em cada agregado: o volume acumulado de cada estado do Nordeste, o reservatório equivalente do SIN e a lista de reservatórios de cada sistema de Outros. Mudança de composição tem vigência, mostra o efeito e passa por aprovação."
  );
  pag.g = pag.G.find(x => x.k === "NE:CE");
  pag.tent = new Set(fora(pag.g));
  pag.todos = false;
  $("#conteudo").innerHTML = corpoAgrupamentos();
  pag.NE = sitNEAdm();
  pag.naJ = e => pag.NE.R[e.r.i]; // valor do reservatório na janela; vazio se retirado ou fora do volume
  cardsG(pag);
  comp(pag);
}

// equivalente: usinas com reservatório e reservatórios, acrescidos de Itaipu, cadastrada a fio d'água (mesma regra do SAR atual)
const noEquiv = e => e.r.tipo !== "fio" || e.r.nome === "ITAIPU";

const membros = (pag, g) =>
  g.tipo === "ne"
    ? pag.E.filter(e => e.src === "ne" && e.uf === g.uf)
    : g.tipo === "sin"
      ? pag.E.filter(e => e.src === "sin" && noEquiv(e))
      : pag.E.filter(e => e.src === "os" && e.sis === g.sis);

const fora = g => ADM.agrup[g.k] || new Set();

const corpoAgrupamentos = () =>
  `
    <nav class="indice" aria-label="Seções da página"><a href="#admin/agrupamentos" data-alvo="ag-lista">Agregados</a><a href="#admin/agrupamentos" data-alvo="ag-comp">Composição</a></nav>
    <section class="cartao secao" id="ag-lista" aria-labelledby="t-ag-lista"><h2 id="t-ag-lista"><small>1</small>Agregados</h2>
      <p class="sub">Escolha um agregado para ver e mudar a composição.</p><div class="adm-agr" id="ag-cards"></div></section>
    <section class="cartao secao" id="ag-comp" aria-labelledby="t-ag-comp"><h2 id="t-ag-comp"><small>2</small>Composição</h2><div id="ag-corpo"></div></section>`;

const totNE = pag => ({ V: pag.NE.S.total.volume_hm3, C: pag.NE.S.total.capacidade_com_dado_hm3 });

const agr = (pag, L, excl) => {
  let V = 0,
    C = 0;
  L.forEach(e => {
    const r = pag.naJ(e);
    if (excl.has(e.id) || !r || r.sem_info) return;
    V += r.volume_hm3;
    C += r.capacidade_hm3;
  });
  return { V, C };
};

function cardsG(pag) {
  const grupo = t => pag.G.filter(x => x.tipo === t);
  $("#ag-cards").innerHTML = [
    ["ne", "Nordeste e Semiárido (volume acumulado por estado)"],
    ["sin", "SIN (sem valor por bacia)"],
    ["os", "Outros Sistemas"]
  ]
    .map(
      ([t, r]) =>
        `<div class="adm-agr-g"><b>${r}</b><div>${grupo(t)
          .map(x => {
            const n = membros(pag, x).length - fora(x).size;
            return `<button type="button" class="preset${x.k === pag.g.k ? " ativo" : ""}" data-k="${esc(x.k)}">${esc(x.r.split(" · ")[1])} <span>${fint(n)}</span></button>`;
          })
          .join("")}</div></div>`
    )
    .join("");
  $$("#ag-cards [data-k]").forEach(
    b =>
      (b.onclick = () => {
        pag.g = pag.G.find(x => x.k === b.dataset.k);
        pag.tent = new Set(fora(pag.g));
        pag.todos = false;
        cardsG(pag);
        comp(pag);
      })
  );
}

function comp(pag) {
  const Mt = membros(pag, pag.g).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    dis = podeEditar() ? "" : " disabled",
    hoje = new Date().toISOString().slice(0, 10);
  let efeito = "",
    tabela = "";
  // a tabela abre com 25 linhas (os que saem primeiro); o efeito conta todos
  const M = pag.todos
    ? Mt
    : Mt.filter(e => pag.tent.has(e.id))
        .concat(Mt.filter(e => !pag.tent.has(e.id)))
        .slice(0, 25);
  if (pag.g.tipo === "ne") {
    const a = agr(pag, Mt, fora(pag.g)),
      b = agr(pag, Mt, pag.tent),
      T = totNE(pag),
      Tb = { V: T.V - (a.V - b.V), C: T.C - (a.C - b.C) };
    const pc = x => (x.C ? fmt((x.V / x.C) * 100, 2) + "%" : "–");
    efeito = `Em ${dBR(pag.dt)}: volume acumulado ${esc(pag.g.est.estado)} ${pc(a)} → <b>${pc(b)}</b> (${fmt(b.V, 2)} de ${fmt(b.C, 2)} hm³) · conjunto do Nordeste e Semiárido ${pc(T)} → <b>${pc(Tb)}</b>.`;
    tabela = `<thead><tr><th class="ck">Entra</th><th>Reservatório</th><th>Município</th><th class="r">Capacidade (hm³)</th><th>Medição usada</th><th class="r">Volume (hm³)</th><th class="r">Volume (%)</th></tr></thead><tbody>${M.map(
      e => {
        const r = pag.naJ(e);
        return `<tr${pag.tent.has(e.id) ? ' class="fora"' : ""}><td class="ck"><input type="checkbox" data-id="${esc(e.id)}"${pag.tent.has(e.id) ? "" : " checked"}${dis} aria-label="${esc(e.nome)} entra no agregado"></td><td><span class="nm">${esc(e.nome)}</span>${retiradoAdm(e) ? '<span class="ret">retirado do acompanhamento</span>' : ""}<span class="rio">código ${esc(e.codigo)}</span></td><td>${esc(e.municipio)}</td>
        <td class="r num">${fmt(e.r.capacidade_hm3, 2)}</td><td>${!r ? "não entra (retirado)" : r.sem_info ? "sem medição na janela" : dBR(r.data)}</td><td class="r num">${r && !r.sem_info ? fmt(r.volume_hm3, 2) : "–"}</td><td class="r num">${r && !r.sem_info ? fmt(r.volume_pct, 2) : "–"}</td></tr>`;
      }
    ).join("")}</tbody>`;
  } else if (pag.g.tipo === "sin") {
    // o protótipo não tem o volume útil total de cada usina: o efeito no percentual fica para o sistema
    const n = Mt.length - pag.tent.size;
    efeito = `Reservatório equivalente do SIN: ${fint(Mt.length - fora(pag.g).size)} → <b>${fint(n)}</b> usinas. No sistema, o efeito mostra também o equivalente na data antes e depois da mudança, com o volume útil total de cada usina; a usina incluída no cadastro entra a partir da data de vigência, sem alterar os valores anteriores.`;
    tabela = `<thead><tr><th class="ck">Entra</th><th>Usina</th><th>Tipo</th><th>UF</th><th>Bacia</th><th class="r">Volume útil (%)</th></tr></thead><tbody>${M.map(
      e =>
        `<tr${pag.tent.has(e.id) ? ' class="fora"' : ""}><td class="ck"><input type="checkbox" data-id="${esc(e.id)}"${pag.tent.has(e.id) ? "" : " checked"}${dis} aria-label="${esc(e.nome)} entra no reservatório equivalente"></td><td><span class="nm">${esc(e.nome)}</span><span class="rio">código ${esc(e.codigo)}</span></td><td>${e.r.tipo === "fio" ? "usina a fio d'água (entra por regra)" : esc(e.tipo)}</td><td>${e.uf}</td><td>${esc(e.bacia)}</td><td class="r num">${e.r.vu == null ? "–" : fmt(e.r.vu, 2)}</td></tr>`
    ).join("")}</tbody>`;
  } else {
    // Cantareira: composição fixada pela Resolução Conjunta ANA/DAEE nº 925/2017; DF e Paraopeba: sem valor agregado,
    // a composição só diz quais reservatórios aparecem na página do sistema
    const fixo = pag.g.sis === "cantareira",
      disOS = fixo ? " disabled" : dis;
    efeito = fixo
      ? "A composição do Sistema Cantareira é a da Resolução Conjunta ANA/DAEE nº 925/2017 (Jaguari-Jacareí, Cachoeira, Atibainha e Paiva Castro) e não é editável aqui."
      : `Página do sistema: ${fint(Mt.length - pag.tent.size)} de ${fint(Mt.length)} reservatórios. O sistema não tem valor agregado; muda só a lista da página.`;
    tabela = `<thead><tr><th class="ck">Entra</th><th>Reservatório</th><th>Município</th></tr></thead><tbody>${M.map(e => `<tr${pag.tent.has(e.id) ? ' class="fora"' : ""}><td class="ck"><input type="checkbox" data-id="${esc(e.id)}"${pag.tent.has(e.id) ? "" : " checked"}${disOS} aria-label="${esc(e.nome)} entra no sistema"></td><td><span class="nm">${esc(e.nome)}</span><span class="rio">código ${esc(e.codigo)}</span></td><td>${esc(e.municipio)}</td></tr>`).join("")}</tbody>`;
  }
  const mudou =
    [...pag.tent].filter(x => !fora(pag.g).has(x)).length + [...fora(pag.g)].filter(x => !pag.tent.has(x)).length;
  $("#ag-corpo").innerHTML =
    `<p class="sub"><b>${esc(pag.g.r)}</b> · ${fint(Mt.length)} ${pag.g.tipo === "sin" ? "usinas" : "reservatórios"}${pag.g.tipo === "ne" ? `, ${fint(Mt.filter(e => pag.naJ(e) && !pag.naJ(e).sem_info).length)} com medição na janela de ${fint(NEd.limiar_dias)} dias em torno de ${dBR(pag.dt)}` : ""}.${pag.g.tipo === "ne" ? " Só entra no volume acumulado quem tem medição na janela; quem sai da composição deixa de entrar mesmo com medição." : ""}</p>
      <p class="adm-efeito"><b>Efeito.</b> ${efeito}</p>
      <div class="adm-form"><label>Vigência<input type="date" id="ag-vig" value="${hoje}"${dis}></label><label class="largo">Motivo<input type="text" id="ag-mot" placeholder="${pag.g.tipo === "sin" ? "Ex.: usina desativada" : pag.g.tipo === "ne" ? "Ex.: reservatório de outro estado" : "Ex.: reservatório de outro sistema de abastecimento"}"${dis}></label>
        <button type="button" class="acao" id="ag-ir"${mudou && podeEditar() ? "" : " disabled"}>Enviar para aprovação</button><button type="button" class="acao sec" id="ag-desf"${mudou ? "" : " disabled"}>Desfazer as mudanças</button></div>
      <div class="tab-box adm-tab adm-comp"><table>${tabela}</table></div>
      ${Mt.length > M.length ? `<p class="mais-res"><button type="button" class="acao sec" id="ag-todos">Mostrar todos (${fint(Mt.length - M.length)} restantes)</button></p>` : ""}
      ${pag.g.tipo === "ne" ? `<p class="nota">Mesmo cálculo da página do Nordeste e Semiárido: cada reservatório com a medição mais próxima de ${dBR(pag.dt)}, até ${fint(NEd.limiar_dias)} dias antes ou depois; o valor de partida é o volume acumulado que a página mostra.</p>` : ""}`;
  $$("#ag-corpo [data-id]").forEach(
    c =>
      (c.onchange = () => {
        if (c.checked) pag.tent.delete(c.dataset.id);
        else pag.tent.add(c.dataset.id);
        comp(pag);
      })
  );
  $("#ag-desf").onclick = () => {
    pag.tent = new Set(fora(pag.g));
    comp(pag);
  };
  if ($("#ag-todos"))
    $("#ag-todos").onclick = () => {
      pag.todos = true;
      comp(pag);
    };
  $("#ag-ir").onclick = () => {
    const mot = $("#ag-mot").value.trim();
    if (!mot) {
      toast("Informe o motivo.");
      $("#ag-mot").focus();
      return;
    }
    const gg = pag.g,
      novo = new Set(pag.tent),
      vig = $("#ag-vig").value || hoje,
      ent = { nome: gg.r, codigo: "", id: null };
    const det = [...novo]
      .filter(x => !fora(gg).has(x))
      .map(id => "sai " + pag.E.find(e => e.id === id).nome)
      .concat([...fora(gg)].filter(x => !novo.has(x)).map(id => "volta " + pag.E.find(e => e.id === id).nome))
      .join("; ");
    pedidoAdm("Composição de agregado", ent, `${esc(det)}. ${efeito} Vigência: ${dBR(vig)}.`, mot, () => {
      ADM.agrup[gg.k] = novo;
    });
    comp(pag);
  };
}

/* ---------------- avisos e textos */
function admPublicacao() {
  const pag = {}; // estado da página, passado às funções abaixo

  pag.hoje = new Date().toISOString().slice(0, 10);
  tituloAdm(
    "Avisos e textos",
    "Avisos com início e fim, gerais, por módulo ou por reservatório, e todos os textos explicativos das páginas, sem nova versão do sistema.",
    `<span><b>${ADM.avisos.filter(a => !a.removido && sitAv(pag, a) === "no ar").length}</b> avisos no ar</span>`
  );
  pag.ONDE = [
    ["geral", "Todas as páginas públicas"],
    ["SIN", "Módulo SIN"],
    ["NE", "Módulo Nordeste e Semiárido"],
    ["OUTROS", "Módulo Outros Sistemas"],
    ["dados", "Área de dados"],
    ["res", "Um reservatório (ficha)"]
  ];
  $("#conteudo").innerHTML = corpoPublicacao(pag);
  pag.alvo = null;
  selPublicacao(pag);
  ["av-onde", "av-tipo", "av-txt"].forEach(id => ($("#" + id).oninput = $("#" + id).onchange = prevAv));
  prevAv();
  $("#av-ex").onclick = () => {
    $("#av-onde").value = "SIN";
    $("#av-tipo").value = "atencao";
    $("#av-txt").value =
      "Exemplo do protótipo: os dados do SIN de hoje ainda não foram carregados; a página mostra o dia anterior.";
    $("#av-fim").value = isoMais(pag.hoje, 1);
    prevAv();
  };
  $("#av-ir").onclick = () => {
    const txt = $("#av-txt").value.trim(),
      onde = $("#av-onde").value,
      ini = $("#av-ini").value || pag.hoje,
      fim = $("#av-fim").value;
    if (!txt) {
      toast("Escreva o texto do aviso.");
      return;
    }
    if (onde === "res" && !pag.alvo) {
      toast("Escolha o reservatório.");
      return;
    }
    if (fim && fim < ini) {
      toast("O fim vem antes do início.");
      return;
    }
    const ondeR = onde === "res" ? pag.alvo.nome : pag.ONDE.find(x => x[0] === onde)[1],
      ir =
        onde === "res"
          ? fichaDe(pag.alvo)
          : { geral: "inicio", SIN: "sin", NE: "ne", OUTROS: "outros", dados: "dados" }[onde];
    ADM.avisos.unshift({
      n: ADM.seq++,
      tipo: $("#av-tipo").value,
      txt,
      onde: onde === "res" ? pag.alvo.id : onde,
      ondeR,
      ini,
      fim,
      ir
    });
    trilhaAdm(
      "Aviso publicado",
      onde === "res" ? pag.alvo : null,
      `${ondeR}: ${txt} (${dBR(ini)}${fim ? " a " + dBR(fim) : ", sem fim"})`,
      "",
      "gravado"
    );
    toast("Aviso publicado.");
    admPublicacao();
  };
  listaPublicacao(pag);
  pag.LT = [];
  pag.chave = x => PT().k + "::" + x.id;
  pag.orig = x => x.pad ?? x.html;
  pag.atual = x => ADM.textos[pag.chave(x)] ?? pag.orig(x);
  ligarEditorTextos(pag);
  listaAlt(pag);
  escolherPag(pag);
}

const sitAv = (pag, a) => (a.fim && a.fim < pag.hoje ? "encerrado" : a.ini > pag.hoje ? "programado" : "no ar");

const corpoPublicacao = pag =>
  `
    <nav class="indice" aria-label="Seções da página"><a href="#admin/publicacao" data-alvo="pu-av">Novo aviso</a><a href="#admin/publicacao" data-alvo="pu-lista">Avisos</a><a href="#admin/publicacao" data-alvo="pu-tx">Textos das páginas</a><a href="#admin/publicacao" data-alvo="pu-alt">Textos alterados</a></nav>
    <section class="cartao secao" id="pu-av" aria-labelledby="t-pu-av"><h2 id="t-pu-av"><small>1</small>Novo aviso</h2>
      <p class="sub">O aviso aparece no alto das páginas escolhidas enquanto estiver no período. Publicado na hora e incluído no registro das ações.</p>
      <div class="adm-form"><label>Onde<select id="av-onde">${pag.ONDE.map(([v, r]) => `<option value="${v}">${r}</option>`).join("")}</select></label>
        <label>Tipo<select id="av-tipo"><option value="info">Informativo</option><option value="atencao">Atenção</option></select></label>
        <label>Início<input type="date" id="av-ini" value="${pag.hoje}"></label><label>Fim<input type="date" id="av-fim"></label></div>
      <div id="av-res" hidden></div>
      <div class="adm-form"><label class="largo">Texto<textarea id="av-txt" rows="3" placeholder="Ex.: Os dados do SIN de hoje ainda não foram carregados."></textarea></label></div>
      <p class="nota">Prévia:</p><div id="av-prev"></div>
      <div class="adm-form"><button type="button" class="acao" id="av-ir"${podeEditar() ? "" : " disabled"}>Publicar aviso</button><button type="button" class="acao sec" id="av-ex"${podeEditar() ? "" : " disabled"}>Usar um exemplo</button></div></section>
    <section class="cartao secao" id="pu-lista" aria-labelledby="t-pu-lista"><h2 id="t-pu-lista"><small>2</small>Avisos</h2><div id="av-lista"></div></section>
    <section class="cartao secao" id="pu-tx" aria-labelledby="t-pu-tx"><h2 id="t-pu-tx"><small>3</small>Textos das páginas</h2>
      <p class="sub">Todo texto explicativo das páginas públicas se edita aqui, sem nova versão do sistema: subtítulo, apresentação, texto e instrução de cada seção, "saiba mais", notas e linha de fontes. Nas páginas que seguem um modelo (bacia, estado e fichas), o texto vale para todas as páginas do modelo.<span class="dica">Negrito com **dois asteriscos**; link com [texto](#endereço); {janela_ne} é trocado pela janela do Nordeste em vigor.</span></p>
      <div class="adm-form"><label>Página<select id="tx-pag">${PAGS_TX.map(Pg => `<option value="${Pg.k}">${esc(Pg.r)}</option>`).join("")}</select></label>
        <label class="largo">Texto<select id="tx-sel" disabled><option>Carregando os textos da página…</option></select></label><a class="acao sec" id="tx-ver" href="#inicio">Abrir a página</a></div>
      <p class="nota" id="tx-info"></p>
      <p class="aviso-dados" id="tx-fixo" hidden></p>
      <div class="adm-tx"><label>Texto<textarea id="tx-ed" rows="7" disabled></textarea></label><div><span class="rot">Prévia</span><div class="adm-tx-prev" id="tx-prev"></div></div></div>
      <div class="adm-form"><label class="largo">Motivo<input type="text" id="tx-mot" placeholder="Ex.: texto revisado pela comunicação"${podeEditar() ? "" : " disabled"}></label><button type="button" class="acao" id="tx-ir" disabled>Publicar texto</button><button type="button" class="acao sec" id="tx-orig" disabled>Voltar ao texto original</button></div></section>
    <section class="cartao secao" id="pu-alt" aria-labelledby="t-pu-alt"><h2 id="t-pu-alt"><small>4</small>Textos alterados</h2>
      <p class="sub">Textos que estão diferentes do original, em todas as páginas, com quem alterou, quando e por quê.</p><div id="tx-alt"></div></section>`;

const avHTML = a =>
  `<div class="aviso-pub ${a.tipo}" role="note"><b>${a.tipo === "atencao" ? "Atenção." : "Aviso."}</b> ${esc(a.txt)}</div>`;

const prevAv = () => {
  const txt = $("#av-txt").value.trim();
  $("#av-prev").innerHTML = txt
    ? avHTML({ tipo: $("#av-tipo").value, txt })
    : '<p class="nota">Escreva o texto do aviso.</p>';
  $("#av-res").hidden = $("#av-onde").value !== "res";
};

const selPublicacao = pag =>
  escolherRes(
    $("#av-res"),
    e => fichaDe(e) != null,
    pag.alvo,
    e => {
      pag.alvo = e;
      selPublicacao(pag);
    },
    "Reservatório com ficha"
  );

function listaPublicacao(pag) {
  const L = ADM.avisos.filter(a => !a.removido);
  $("#av-lista").innerHTML = L.length
    ? `<div class="tab-box adm-tab"><table><thead><tr><th>Aviso</th><th>Onde</th><th>Período</th><th>Situação</th><th></th></tr></thead><tbody>${L.map(
        a => `<tr><td>${avHTML(a)}</td><td>${esc(a.ondeR)}</td><td>${dBR(a.ini)}${a.fim ? " a " + dBR(a.fim) : ", sem fim"}</td>
      <td><span class="adm-sit ${sitAv(pag, a) === "no ar" ? "ok" : sitAv(pag, a) === "programado" ? "fila" : "cinza"}">${sitAv(pag, a)}</span></td><td class="r">${sitAv(pag, a) !== "encerrado" && podeEditar() ? `<button type="button" class="acao sec" data-n="${a.n}">Encerrar agora</button>` : ""}${a.ir ? `<a class="acao sec" href="#${a.ir}">Ver na página</a>` : ""}</td></tr>`
      ).join("")}</tbody></table></div>`
    : '<p class="nota">Nenhum aviso nesta sessão.</p>';
  $$("#av-lista [data-n]").forEach(
    b =>
      (b.onclick = () => {
        const a = ADM.avisos.find(x => x.n === Number(b.dataset.n));
        a.fim = isoMais(pag.hoje, -1);
        trilhaAdm("Aviso encerrado", null, a.txt, "", "gravado");
        admPublicacao();
      })
  );
}

// textos das páginas
const PT = () => {
  const s = $("#tx-pag");
  return s ? PAGS_TX.find(Pg => Pg.k === s.value) : null;
}; // null quando a tela já foi trocada

const XPublicacao = pag => pag.LT.find(x => x.id === $("#tx-sel").value);

const rotTx = (pag, x) => {
  const M = pag.LT.filter(y => y.titulo === x.titulo && y.tipo === x.tipo);
  return `${x.tipo[0].toUpperCase() + x.tipo.slice(1)}${M.length > 1 ? " " + (M.indexOf(x) + 1) : ""}: ${x.t.slice(0, 60)}${x.t.length > 60 ? "…" : ""}`;
};

function opcoesTx(pag) {
  const selTx = $("#tx-sel").value,
    G = [...new Set(pag.LT.map(x => x.titulo))];
  $("#tx-sel").innerHTML = G.map(
    g =>
      `<optgroup label="${esc(g)}">${pag.LT.filter(x => x.titulo === g)
        .map(
          x =>
            `<option value="${esc(x.id)}">${esc(rotTx(pag, x))}${ADM.textos[pag.chave(x)] != null ? " (alterado)" : ""}${x.fixo ? " (só leitura no protótipo)" : ""}</option>`
        )
        .join("")}</optgroup>`
  ).join("");
  if (selTx && pag.LT.some(x => x.id === selTx)) $("#tx-sel").value = selTx;
  const nf = pag.LT.filter(x => x.fixo).length,
    na = pag.LT.filter(x => ADM.textos[pag.chave(x)] != null).length;
  $("#tx-info").textContent =
    `${fint(pag.LT.length)} textos nesta página${na ? `, ${fint(na)} ${na === 1 ? "alterado" : "alterados"}` : ""}${nf ? `; ${fint(nf)} com números do dia ou formatação especial ficam só para leitura no protótipo` : ""}.`;
}

function escolherPag(pag) {
  const Pg = PT();
  $("#tx-ver").href = "#" + Pg.ir;
  pag.LT = [];
  $("#tx-sel").disabled = true;
  $("#tx-sel").innerHTML = "<option>Carregando os textos da página…</option>";
  $("#tx-info").textContent = "";
  $("#tx-ed").value = "";
  $("#tx-ed").disabled = true;
  $("#tx-prev").innerHTML = "";
  $("#tx-fixo").hidden = true;
  $("#tx-ir").disabled = true;
  $("#tx-orig").disabled = true;
  carregarTextosPag(Pg, L => {
    if (PT() !== Pg) return;
    if (!L) {
      $("#tx-info").textContent = "Não foi possível ler os textos desta página.";
      return;
    }
    pag.LT = L;
    opcoesTx(pag);
    $("#tx-sel").disabled = false;
    carregarTextoPublicacao(pag);
  });
}

function carregarTextoPublicacao(pag) {
  const x = XPublicacao(pag);
  if (!x) return;
  $("#tx-ed").value = txEd(pag.atual(x));
  $("#tx-ed").disabled = !podeEditar() || !!x.fixo;
  $("#tx-orig").disabled = !podeEditar() || !!x.fixo;
  $("#tx-fixo").hidden = !x.fixo;
  $("#tx-fixo").textContent =
    x.fixo === "valores"
      ? "Este texto traz números que vêm do dado ou de parâmetros (contagens, datas, janelas). No sistema, cada número entra por marcador, como {janela_ne}, e o resto do texto é editável; no protótipo, fica só para leitura."
      : x.fixo
        ? "Este texto tem formatação que o editor do protótipo não reproduz (ícones, destaques). No sistema, é editável como os demais; no protótipo, fica só para leitura."
        : "";
  prevTx(pag);
}

function prevTx(pag) {
  const x = XPublicacao(pag);
  if (!x) return;
  const novo = txHTML($("#tx-ed").value);
  $("#tx-prev").innerHTML = textoHTML(x.fixo ? pag.atual(x) : novo) || '<span class="nota">(vazio)</span>';
  $("#tx-ir").disabled = !podeEditar() || !!x.fixo || !$("#tx-ed").value.trim() || novo === txHTML(txEd(pag.atual(x)));
}

function listaAlt(pag) {
  const K = Object.keys(ADM.textos).filter(k => ADM.textosMeta[k]);
  $("#tx-alt").innerHTML = K.length
    ? `<div class="tab-box adm-tab"><table><thead><tr><th>Página</th><th>Texto</th><th>Quando</th><th>Motivo</th><th></th></tr></thead><tbody>${K.map(
        k => {
          const m = ADM.textosMeta[k];
          return `<tr><td>${esc(m.pag)}</td><td>${esc(m.onde)}<br><span class="nota">${esc(txPlano(ADM.textos[k]).slice(0, 140))}</span></td><td>${esc(m.quando)}<br><span class="nota">${esc(m.quem)}</span></td><td>${esc(m.motivo)}</td>
        <td class="r"><a class="acao sec" href="#${esc(m.ir)}">Ver na página</a>${podeEditar() ? `<button type="button" class="acao sec" data-tx="${esc(k)}">Voltar ao original</button>` : ""}</td></tr>`;
        }
      ).join("")}</tbody></table></div>`
    : '<p class="nota">Nenhum texto alterado. Todas as páginas estão com o texto original.</p>';
  $$("#tx-alt [data-tx]").forEach(
    b =>
      (b.onclick = () => {
        const k = b.dataset.tx,
          m = ADM.textosMeta[k],
          antes = ADM.textos[k];
        delete ADM.textos[k];
        trilhaAdm("Texto da página", null, `${m.pag} · ${m.onde}: volta ao texto original`, "", "gravado", () => {
          ADM.textos[k] = antes;
        });
        toast("Texto original de volta.");
        listaAlt(pag);
        if (pag.LT.length) {
          opcoesTx(pag);
          carregarTextoPublicacao(pag);
        }
      })
  );
}

const ligarEditorTextos = pag => {
  $("#tx-pag").onchange = (...a) => escolherPag(pag, ...a);
  $("#tx-sel").onchange = (...a) => carregarTextoPublicacao(pag, ...a);
  $("#tx-ed").oninput = (...a) => prevTx(pag, ...a);
  $("#tx-ir").onclick = () => {
    const x = XPublicacao(pag),
      k = pag.chave(x),
      mot = $("#tx-mot").value.trim();
    if (!mot) {
      toast("Informe o motivo.");
      $("#tx-mot").focus();
      return;
    }
    const antes = ADM.textos[k],
      novo = txHTML($("#tx-ed").value),
      onde = `${x.titulo} · ${x.tipo}`;
    if (novo === txHTML(txEd(pag.orig(x)))) delete ADM.textos[k];
    else ADM.textos[k] = novo;
    ADM.textosMeta[k] = { pag: PT().r, onde, ir: PT().ir, quando: agoraAdm(), quem: ADM_USU[ADM.perfil], motivo: mot };
    trilhaAdm(
      "Texto da página",
      null,
      `${PT().r} · ${onde}: ${$("#tx-ed").value.trim().slice(0, 160)}`,
      mot,
      "gravado",
      () => {
        if (antes === undefined) delete ADM.textos[k];
        else ADM.textos[k] = antes;
      }
    );
    toast("Texto publicado. Abra a página para ver.");
    $("#tx-mot").value = "";
    opcoesTx(pag);
    carregarTextoPublicacao(pag);
    listaAlt(pag);
  };
  $("#tx-orig").onclick = () => {
    const x = XPublicacao(pag);
    if (!x) return;
    $("#tx-ed").value = txEd(pag.orig(x));
    prevTx(pag);
  };
};

/* ---------------- parâmetros */
function admParametros() {
  tituloAdm(
    "Parâmetros",
    "Valores que hoje estão escritos no código. O que muda número publicado passa por aprovação; o resto vale na hora."
  );
  const pend = {};
  $("#conteudo").innerHTML = `
    <nav class="indice" aria-label="Seções da página"><a href="#admin/parametros" data-alvo="pa-lista">Parâmetros</a><a href="#admin/parametros" data-alvo="pa-hor">Horários das integrações</a></nav>
    <section class="cartao secao" id="pa-lista" aria-labelledby="t-pa-lista"><h2 id="t-pa-lista"><small>1</small>Parâmetros</h2>
      <p class="sub">Altere o valor na própria linha. A coluna "Aprovação" diz se a mudança espera um segundo olhar.</p>
      <div class="adm-pend" id="pa-pend" hidden></div>
      <div class="tab-box adm-tab"><table><thead><tr><th>Grupo</th><th>Parâmetro</th><th class="r">Valor</th><th>Unidade</th><th>Onde vale</th><th>Origem do valor</th><th>Aprovação</th></tr></thead>
        <tbody>${PARAM_ADM.map(
          p => `<tr><td>${esc(p.g)}</td><td><span class="nm">${esc(p.r)}</span>${ADM.params[p.k] != null ? `<span class="rio">alterado; original ${fmt(p.v, p.dec)}</span>` : ""}</td>
          <td class="r"><input class="adm-cel" data-k="${p.k}" inputmode="decimal" aria-label="${esc(p.r)}" value="${fmt(parAdm(p.k), p.dec).replace(/\./g, "")}"${podeEditar() ? "" : " disabled"}></td><td>${esc(p.u)}</td><td>${esc(p.onde)}</td><td>${esc(p.fonte)}</td><td>${p.apr ? "sim" : "não"}</td></tr>`
        ).join("")}</tbody></table></div>
      <p class="nota">No protótipo, só o painel de cobertura usa o valor gravado; as páginas públicas e a conferência não são recalculadas com ele.</p></section>
    <section class="cartao secao" id="pa-hor" aria-labelledby="t-pa-hor"><h2 id="t-pa-hor"><small>2</small>Horários das integrações</h2>
      <p class="sub">Horários previstos de cada execução. O painel de integrações marca como "não executou" a execução prevista que não aconteceu. Os horários abaixo são ilustrativos: os reais serão levantados com a STI.</p>
      <div class="tab-box"><table><thead><tr><th>Integração</th><th>Horários previstos</th></tr></thead><tbody>${ADM_INT.map(I => `<tr><td><span class="nm">${esc(I.r)}</span></td><td>${I.horas.map(h => String(h).padStart(2, "0") + ":00").join(" · ")}</td></tr>`).join("")}</tbody></table></div></section>`;
  function barra() {
    const n = Object.keys(pend).length,
      el = $("#pa-pend");
    el.hidden = !n;
    if (!n) return;
    const apr = Object.keys(pend).filter(k => PARAM_ADM.find(p => p.k === k).apr).length;
    el.innerHTML = `<span><b>${n}</b> ${n === 1 ? "alteração" : "alterações"}${apr ? `, ${apr} com aprovação` : ""}</span><input type="text" id="pa-mot" placeholder="Motivo (obrigatório)" aria-label="Motivo"><button type="button" class="acao" id="pa-ir">Gravar</button><button type="button" class="acao sec" id="pa-desc">Descartar</button>`;
    $("#pa-desc").onclick = () => admParametros();
    $("#pa-ir").onclick = () => {
      const mot = $("#pa-mot").value.trim();
      if (!mot) {
        toast("Informe o motivo.");
        $("#pa-mot").focus();
        return;
      }
      Object.entries(pend).forEach(([k, v]) => {
        const p = PARAM_ADM.find(x => x.k === k),
          antes = parAdm(k),
          det = `${p.r}: ${fmt(antes, p.dec)} → ${fmt(v, p.dec)} ${p.u}`;
        if (p.apr)
          pedidoAdm(
            "Parâmetro",
            { nome: p.g, codigo: "", id: null },
            `${esc(p.r)}: ${fmt(antes, p.dec)} → <b>${fmt(v, p.dec)} ${esc(p.u)}</b>. Vale em: ${esc(p.onde)}.`,
            mot,
            () => {
              ADM.params[k] = v;
              COB = null;
            }
          );
        else {
          ADM.params[k] = v;
          COB = null;
          trilhaAdm("Parâmetro", null, det, mot, "gravado", () => {
            ADM.params[k] = antes;
            COB = null;
          });
        }
      });
      toast("Parâmetros gravados; os que pedem aprovação foram para a fila.");
      admParametros();
    };
  }
  $$("#pa-lista [data-k]").forEach(
    i =>
      (i.onchange = () => {
        const p = PARAM_ADM.find(x => x.k === i.dataset.k),
          v = numBR(i.value);
        if (v == null || v <= 0) {
          toast("Valor inválido.");
          i.value = fmt(parAdm(p.k), p.dec).replace(/\./g, "");
          return;
        }
        if (Math.abs(v - parAdm(p.k)) < 1e-9) delete pend[p.k];
        else pend[p.k] = v;
        i.parentElement.classList.toggle("mudou", p.k in pend);
        barra();
      })
  );
}

/* ---------------- páginas públicas: avisos e textos */
function fichaDe(e) {
  if (!e) return null;
  if (e.src === "sin" && String(e.codigo) === String(D.ficha.codigo)) return "ficha/FURNAS";
  if ((e.src === "ne" || e.src === "nv") && NEd.fichas && NEd.fichas[e.codigo]) return "ne/ficha/" + e.codigo;
  if (e.src === "os") return "outros/ficha/" + e.codigo;
  return null;
}
function entDaRota(h) {
  const E = entidadesDados();
  if (h === "ficha/FURNAS") return E.find(e => e.src === "sin" && String(e.codigo) === String(D.ficha.codigo));
  if (h.startsWith("ne/ficha/")) {
    const c = h.slice(9);
    return E.find(e => (e.src === "ne" || e.src === "nv") && String(e.codigo) === c);
  }
  if (h.startsWith("outros/ficha/")) return E.find(e => e.id === "OS:" + h.slice(13));
  return null;
}
function extrasPublicos(h) {
  $("#conteudo").classList.toggle("admin", h.startsWith("admin")); // tabelas da administração quebram linha (sem rolagem interna)
  if (h.startsWith("admin")) return;
  aplicarTextos();
  const hoje = new Date().toISOString().slice(0, 10),
    mod =
      h === "" || h === "inicio"
        ? "inicio"
        : h === "dados"
          ? "dados"
          : h.startsWith("ne")
            ? "NE"
            : h.startsWith("outros")
              ? "OUTROS"
              : "SIN",
    e = entDaRota(h);
  const A = ADM.avisos.filter(
    a =>
      !a.removido &&
      a.ini <= hoje &&
      (!a.fim || a.fim >= hoje) &&
      (a.onde === "geral" || a.onde === mod || (e && a.onde === e.id))
  );
  if (A.length) {
    const box = document.createElement("div");
    box.className = "avisos-pub";
    box.innerHTML = A.map(
      a =>
        `<div class="aviso-pub ${a.tipo}" role="note"><b>${a.tipo === "atencao" ? "Atenção." : "Aviso."}</b> ${esc(a.txt)}</div>`
    ).join("");
    const c = $("#conteudo"),
      ac = $(".acesso-adm", c);
    if (ac) ac.after(box);
    else c.prepend(box);
  }
}
// celular: cada célula das tabelas da administração leva o nome da coluna (vira cartão no CSS)
function rotulaTabelasAdm(raiz) {
  raiz.querySelectorAll(".tab-box table").forEach(tb => {
    const ths = [...(tb.querySelector("thead tr") || { children: [] }).children].map(th => th.textContent.trim());
    tb.querySelectorAll("tbody tr").forEach(tr => {
      let c = 0;
      [...tr.children].forEach(td => {
        if (!td.hasAttribute("data-rotulo") && !td.hasAttribute("colspan"))
          td.setAttribute("data-rotulo", ths[c] || "");
        c += +(td.getAttribute("colspan") || 1);
      });
    });
  });
}
new MutationObserver(() => {
  const c = document.getElementById("conteudo");
  if (c.classList.contains("admin")) rotulaTabelasAdm(c);
}).observe(document.getElementById("conteudo"), { childList: true, subtree: true });

export {
  admAgrupamentos,
  admCobertura,
  admCodigos,
  admInclusao,
  admParametros,
  admPublicacao,
  admSuspeitos,
  cascataTopoSVG,
  extrasPublicos,
  intAdm,
  retiradoAdm,
  sitNEAdm,
  suspeitosAdm
};
