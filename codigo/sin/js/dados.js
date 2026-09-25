/* Área de dados (#dados): seleção de reservatórios de qualquer módulo, variáveis, período, prévia e arquivo (CSV ou
   XLSX, com dicionário de dados e leia-me). Conceito em estrutura/area_dados.md: catálogo único de variáveis, seleção
   entre módulos, base horária só do SIN. */
import { contexto } from "./contexto.js";
import { CAN, D, NEd, OS } from "./dados_embutidos.js";
import { $, $$, barraBaixar, caso, dBR, esc, fint, ligarIndice, NOME, normalizaBusca, RES, toast } from "./base.js";
import { baixarArquivo, carregarScript, hojeBR, nCSV, pdfSecao, salvarCSV } from "./exportacao.js";
import { COR_MOD } from "./inicio.js";
import { ESTACOES_NV, FORA_VOLUME, isoDia, OCULTOS } from "./ne.js";
import { detCan, diaEntre, isoMais, NOME_SIS } from "./outros.js";
import { fimF, FOS, nomeRes, soNivelF } from "./outros_sistemas.js";

const CAT_VARS = [
  {
    k: "cota_m",
    r: "Cota",
    u: "m",
    g: "Nível e volume",
    def: "Nível d'água do reservatório. Em reservatório sem curva cota-volume validada, vem sem volume."
  },
  {
    k: "volume_hm3",
    r: "Volume",
    u: "hm³",
    g: "Nível e volume",
    def: "Volume armazenado. No Cantareira, volume útil operacional."
  },
  {
    k: "volume_pct",
    r: "Volume",
    u: "%",
    g: "Nível e volume",
    def: "Volume armazenado em % da capacidade do reservatório."
  },
  {
    k: "volume_util_pct",
    r: "Volume útil",
    u: "%",
    g: "Nível e volume",
    def: "Volume útil armazenado em % do volume útil do reservatório. No Cantareira, do volume útil operacional do quadro da Resolução Conjunta ANA/DAEE nº 925/2017."
  },
  {
    k: "afluente_m3s",
    r: "Vazão afluente",
    u: "m³/s",
    g: "Vazões",
    def: "Vazão que chega ao reservatório. Na base horária, calculada por balanço hídrico: oscila, com negativos e picos que não são vazão real."
  },
  { k: "defluente_m3s", r: "Vazão defluente", u: "m³/s", g: "Vazões", def: "Vazão liberada pelo reservatório." },
  { k: "turbinada_m3s", r: "Vazão turbinada", u: "m³/s", g: "Vazões", def: "Vazão que passa pelas turbinas." },
  { k: "vertida_m3s", r: "Vazão vertida", u: "m³/s", g: "Vazões", def: "Vazão que passa pelo vertedouro." },
  { k: "vazao_natural_m3s", r: "Vazão natural", u: "m³/s", g: "Vazões", def: "Vazão natural afluente." },
  {
    k: "descarga_jusante_m3s",
    r: "Descarga para jusante",
    u: "m³/s",
    g: "Vazões",
    def: "Vazão liberada para o rio a jusante (Cantareira)."
  },
  {
    k: "retirada_santa_ines_m3s",
    r: "Retirada em Santa Inês",
    u: "m³/s",
    g: "Sistema Cantareira",
    def: "Vazão bombeada na Estação Elevatória Santa Inês para a Região Metropolitana de São Paulo."
  },
  {
    k: "tunel_7_m3s",
    r: "Túnel 7",
    u: "m³/s",
    g: "Sistema Cantareira",
    def: "Vazão do Jaguari-Jacareí para o Cachoeira."
  },
  { k: "tunel_6_m3s", r: "Túnel 6", u: "m³/s", g: "Sistema Cantareira", def: "Vazão do Cachoeira para o Atibainha." },
  {
    k: "tunel_5_m3s",
    r: "Túnel 5",
    u: "m³/s",
    g: "Sistema Cantareira",
    def: "Vazão do Atibainha para o Paiva Castro."
  },
  {
    k: "transferencia_paraiba_do_sul_m3s",
    r: "Transferência do Paraíba do Sul",
    u: "m³/s",
    g: "Sistema Cantareira",
    def: "Vazão transferida do reservatório Jaguari (bacia do Paraíba do Sul) para o Atibainha."
  },
  {
    k: "chuva_mm",
    r: "Chuva",
    u: "mm",
    g: "Sistema Cantareira",
    def: "Chuva diária sobre o sistema, informada pela SABESP."
  }
];
// fonte de cada variável, por módulo (dicionário de dados)
const FONTE_VAR = {
  cota_m:
    "SIN: ONS; Nordeste e Semiárido: órgãos estaduais e leitura de régua da rede hidrometeorológica da ANA; Sistema Cantareira: SABESP; Distrito Federal e Paraopeba: SAR",
  volume_hm3:
    "Nordeste e Semiárido: órgãos estaduais e SAR (cota convertida pela curva cota-volume); Sistema Cantareira: SABESP; Distrito Federal e Paraopeba: SAR",
  volume_pct: "calculado pelo SAR: volume ÷ capacidade do cadastro",
  volume_util_pct: "SIN: ONS; Sistema Cantareira: SABESP",
  vazao_natural_m3s: "SIN: ONS; Sistema Cantareira: SABESP"
};
const fonteVar = k =>
  FONTE_VAR[k] || (["afluente_m3s", "defluente_m3s", "turbinada_m3s", "vertida_m3s"].includes(k) ? "ONS" : "SABESP");
const nomeVar = v => `${v.r} (${v.u})`; // Volume (hm³), Volume (%), Volume útil (%): o nome com a unidade distingue as três
const VAR_HORA = new Set([
  "cota_m",
  "afluente_m3s",
  "defluente_m3s",
  "turbinada_m3s",
  "vertida_m3s",
  "volume_util_pct"
]);
const ROT_MOD = { SIN: "SIN", NE: "Nordeste e Semiárido", OUTROS: "Outros Sistemas" };
// UF e município dos reservatórios de Outros Sistemas: SNIRH/ANA, serviço de mapas IG/SAR (camadas 2 a 4), consulta de 17/09/2026
const MUN_OS = {
  40001: ["DF", "Brasília"],
  40002: ["DF", "Brasília"],
  40003: ["DF", "Brasília"],
  29001: ["SP", "Vargem"],
  29002: ["SP", "Piracaia"],
  29003: ["SP", "Nazaré Paulista"],
  29004: ["SP", "Franco da Rocha"],
  50001: ["MG", "Brumadinho"],
  50002: ["MG", "Betim"],
  50003: ["MG", "Juatuba"]
};
const MAPA_SIN = {
  cota: "cota_m",
  nivel: "cota_m",
  afl: "afluente_m3s",
  defl: "defluente_m3s",
  turb: "turbinada_m3s",
  vert: "vertida_m3s",
  nat: "vazao_natural_m3s",
  vu: "volume_util_pct"
};
let ENT_D = null;
function entidadesDados() {
  if (ENT_D) return ENT_D;
  const L = [],
    SINV = ["cota_m", "afluente_m3s", "defluente_m3s", "turbinada_m3s", "vertida_m3s", "vazao_natural_m3s"];
  RES.forEach(r =>
    L.push({
      id: "SIN:" + r.codigo,
      codigo: r.codigo,
      nome: caso(r.nome),
      mod: "SIN",
      uf: r.uf || "",
      municipio: r.municipio || "",
      bacia: NOME[r.bacia] || caso(r.bacia || ""),
      tipo: r.tipo === "fio" ? "usina a fio d'água" : "usina com reservatório",
      vars: r.tipo === "fio" ? SINV : [...SINV, "volume_util_pct"],
      hora: true,
      src: "sin",
      r
    })
  );
  NEd.reservatorios.forEach((r, i) => {
    const ret = OCULTOS.has(i);
    if (FORA_VOLUME.has(i) && !ret) return;
    L.push({
      id: "NE:" + i,
      codigo: r.codigo,
      nome: caso(r.nome),
      mod: "NE",
      uf: r.uf,
      municipio: r.municipio || "",
      bacia: caso(r.bacia || ""),
      tipo: ret ? "com volume" : "com volume",
      retirado: ret,
      vars: ["cota_m", "volume_hm3", "volume_pct"],
      src: "ne",
      r
    });
  });
  ESTACOES_NV.forEach((st, k) =>
    L.push({
      id: "NV:" + k,
      codigo: st.codigo || "",
      nome: caso(st.nome),
      mod: "NE",
      uf: st.uf,
      municipio: st.municipio || "",
      bacia: "",
      tipo: "só nível",
      vars: ["cota_m"],
      src: "nv",
      st
    })
  );
  Object.entries(FOS).forEach(([cod, F]) => {
    const can = F.sis === "cantareira",
      niv = soNivelF(F),
      m = MUN_OS[cod] || ["", ""];
    L.push({
      id: "OS:" + cod,
      codigo: cod,
      nome: nomeRes(F),
      mod: "OUTROS",
      sis: F.sis,
      uf: m[0],
      municipio: m[1],
      bacia: NOME_SIS[F.sis],
      tipo: niv ? "só nível (sem capacidade cadastrada)" : "com volume",
      vars: niv
        ? ["cota_m"]
        : can
          ? ["cota_m", "volume_hm3", "volume_util_pct", "vazao_natural_m3s", "descarga_jusante_m3s"]
          : ["cota_m", "volume_hm3", "volume_pct"],
      src: "os",
      F
    });
  });
  if (CAN)
    L.push({
      id: "CAN",
      codigo: "",
      nome: "Sistema Cantareira (os quatro reservatórios)",
      mod: "OUTROS",
      sis: "cantareira",
      uf: "SP",
      municipio: "",
      bacia: NOME_SIS.cantareira,
      tipo: "sistema",
      vars: [
        "volume_util_pct",
        "volume_hm3",
        "vazao_natural_m3s",
        "descarga_jusante_m3s",
        "retirada_santa_ines_m3s",
        "tunel_7_m3s",
        "tunel_6_m3s",
        "tunel_5_m3s",
        "transferencia_paraiba_do_sul_m3s",
        "chuva_mm"
      ],
      src: "can"
    });
  const UFN = {};
  RES.forEach(r => {
    if (r.uf) UFN[r.uf] = r.estado;
  });
  NEd.estados.forEach(x => (UFN[x.uf] = x.estado));
  UFN.DF = "Distrito Federal";
  UFN.SP = UFN.SP || "São Paulo";
  L.forEach(e => {
    e.nomeB = normalizaBusca(e.nome);
    e.busca = normalizaBusca(
      `${e.nome} ${e.codigo} ${e.municipio} ${e.uf} ${UFN[e.uf] || ""} ${e.bacia} ${ROT_MOD[e.mod]} ${e.mod === "OUTROS" ? "Outros Sistemas Hídricos " + (NOME_SIS[e.sis] || "") : ""}`
    );
  });
  return (ENT_D = L);
}
// série embutida no protótipo de uma entidade: [{t (aaaa-mm-dd ou aaaa-mm-ddThh), v:{variável: valor}}]
function serieDados(e, base, de, ate) {
  const out = [],
    dentro = iso => (!de || iso.slice(0, 10) >= de) && iso.slice(0, 10) <= ate;
  const push = (t, v) => {
    if (dentro(t)) out.push({ t, v });
  };
  if (e.src === "sin") {
    if (base === "hora") {
      if (String(D.ficha.codigo) === String(e.codigo)) {
        const C = D.ficha.horario_colunas;
        D.ficha.horario.forEach(l => {
          const v = {};
          C.forEach((c, j) => {
            if (MAPA_SIN[c]) v[MAPA_SIN[c]] = l[j];
          });
          push(l[0], v);
        });
      }
      return out;
    }
    if (String(D.ficha.codigo) === String(e.codigo)) {
      const C = D.ficha.diario_colunas;
      D.ficha.diario.forEach(l => {
        const v = {};
        C.forEach((c, j) => {
          if (MAPA_SIN[c]) v[MAPA_SIN[c]] = l[j];
        });
        push(l[0], v);
      });
      return out;
    }
    const g = D.grande.res.find(x => String(x.codigo) === String(e.codigo));
    if (g && g.serie) {
      g.serie.forEach(o => {
        const v = {};
        Object.entries(o).forEach(([c, x]) => {
          if (MAPA_SIN[c]) v[MAPA_SIN[c]] = x;
        });
        push(o.data, v);
      });
      return out;
    }
    const r = e.r,
      v = {};
    ["cota", "afl", "defl", "turb", "vert", "vu"].forEach(c => {
      if (r[c] != null) v[MAPA_SIN[c]] = r[c];
    });
    push(D.data, v);
    return out;
  }
  if (base === "hora") return out;
  if (e.src === "ne") {
    const fi = NEd.fichas && NEd.fichas[e.codigo];
    if (fi && fi.serie) fi.serie.forEach(l => push(l[0], { cota_m: l[1], volume_hm3: l[2], volume_pct: l[3] }));
    else (e.r.s || []).forEach(l => push(isoDia(l[0]), { volume_pct: l[1], volume_hm3: l[2], cota_m: l[3] ?? null }));
    return out;
  }
  if (e.src === "nv") {
    (e.st.s || []).forEach(l => push(isoDia(l[0]), { cota_m: l[1] == null ? null : l[1] / 100 }));
    return out;
  }
  if (e.src === "os") {
    const F = e.F,
      can = F.sis === "cantareira",
      RC = can ? CAN.res.find(x => String(x.codigo) === String(e.codigo)) : null;
    const i0 = de ? Math.max(0, diaEntre(de, F.de)) : 0,
      i1 = Math.min(F.cota.length - 1, diaEntre(ate, F.de));
    for (let i = i0; i <= i1; i++) {
      const iso = isoMais(F.de, i),
        p = F.pct ? F.pct[i] : null,
        v = { cota_m: F.cota[i] };
      if (F.pct) {
        v[can ? "volume_util_pct" : "volume_pct"] = p;
        v.volume_hm3 = p == null ? null : Math.round(p * F.cap * 10) / 1000;
      }
      if (RC) {
        v.vazao_natural_m3s = detCan(RC.qnat, iso);
        v.descarga_jusante_m3s = detCan(RC.qjus, iso);
      }
      out.push({ t: iso, v });
    }
    return out;
  }
  if (e.src === "can") {
    const i0 = de ? Math.max(0, diaEntre(de, CAN.de)) : 0,
      i1 = Math.min(CAN.pct.length - 1, diaEntre(ate, CAN.de));
    const VZ = {
      ESI: "retirada_santa_ines_m3s",
      T7: "tunel_7_m3s",
      T6: "tunel_6_m3s",
      T5: "tunel_5_m3s",
      TransfParaibaDoSul: "transferencia_paraiba_do_sul_m3s",
      chuva: "chuva_mm",
      qnat: "vazao_natural_m3s",
      jus: "descarga_jusante_m3s"
    };
    for (let i = i0; i <= i1; i++) {
      const iso = isoMais(CAN.de, i),
        v = { volume_util_pct: CAN.pct[i] };
      if (iso >= CAN.det_de) {
        const vs = CAN.res.map(r => detCan(r.vol, iso));
        v.volume_hm3 = vs.some(x => x == null) ? null : Math.round(vs.reduce((a, b) => a + b, 0) * 1000) / 1000;
        Object.entries(VZ).forEach(([k, c]) => (v[c] = detCan(CAN.vaz[k], iso)));
      }
      out.push({ t: iso, v });
    }
    return out;
  }
  return out;
}
const INICIO_PROTO =
  "No protótipo o arquivo traz só o que está embutido na página: SIN, o dia mais recente (30 dias na bacia do Grande; série diária desde 2000 e horária desde 01/07/2026 em Furnas); " +
  "Nordeste e Semiárido, 12 meses (série desde 2006 nas três fichas de exemplo); Outros Sistemas, a série completa. No sistema, cada reservatório vem com a série inteira.";

function paginaDados() {
  const pag = {}; // estado da página, passado às funções abaixo

  pag.ENT = entidadesDados();
  pag.porId = Object.fromEntries(pag.ENT.map(e => [e.id, e]));
  const qInicial = contexto.buscaDados;
  contexto.buscaDados = "";
  estadoInicialDados(pag);
  pag.UF_NOME.SP = pag.UF_NOME.SP || "São Paulo";
  $("#titulo-pag").innerHTML = tituloDados(pag);
  $("#conteudo").innerHTML = corpoDados(pag);
  ligarIndice();

  ligarFiltrosDados(pag);
  pag.tBusca = undefined;
  ligarSelecaoDados(pag);

  ligarBaseDados(pag);
  ligarPeriodoDados(pag);

  pag.tPrev = undefined;
  ligarFormatoDados(pag);

  ligarArquivoDados(pag);
  if (qInicial) {
    pag.st.txt = qInicial;
    $("#d-busca").value = qInicial;
    $("#d-limpar-f").disabled = false;
  }
  opcoes(pag);
  desenharLista(pag);
  atualizarDados(pag);
}

// filtros, seleção e período iniciais (até a data mais recente de todos os módulos)
function estadoInicialDados(pag) {
  const datas = [D.data, NEd.serie_ate, CAN ? CAN.ate : D.data, ...Object.values(FOS).map(fimF)].filter(Boolean).sort();
  pag.ULT = datas[datas.length - 1];
  pag.FILT = {
    uf: { r: "Estado", todos: "Todos" },
    mun: { r: "Município", todos: "Todos" },
    bacia: { r: "Bacia ou sistema", todos: "Todas" }
  };
  pag.st = {
    sel: new Set(),
    txt: "",
    mod: new Set(),
    uf: new Set(),
    mun: new Set(),
    bacia: new Set(),
    soSel: false,
    mostrar: 12,
    base: "dia",
    vars: new Set(CAT_VARS.map(v => v.k)), // todas marcadas: valem as que os selecionados têm; quem quiser menos desmarca
    de: isoMais(pag.ULT, -365),
    ate: pag.ULT,
    preset: "12m",
    formato: "csv"
  };
  pag.UF_NOME = {};
  RES.forEach(r => {
    if (r.uf) pag.UF_NOME[r.uf] = r.estado;
  });
  NEd.estados.forEach(e => (pag.UF_NOME[e.uf] = e.estado));
  pag.UF_NOME.DF = "Distrito Federal";
}

// filtros por estado, município e bacia (listas com busca) e botão de limpar
function ligarFiltrosDados(pag) {
  pag.campoDe = { uf: "uf", mun: "municipio", bacia: "bacia" };
  $("#d-limpar-f").onclick = () => {
    ["mod", "uf", "mun", "bacia"].forEach(k => pag.st[k].clear());
    pag.st.txt = "";
    $("#d-busca").value = "";
    aplicarFiltros(pag);
  };
  ["uf", "mun", "bacia"].forEach(k => {
    const host = $(`#mf-${k}`),
      bt = host.querySelector(".mf-botao"),
      pop = host.querySelector(".mf-pop"),
      busca = host.querySelector(".mf-busca");
    bt.onclick = () => {
      const abre = pop.hidden;
      fechaFiltros(host);
      pop.hidden = !abre;
      host.classList.toggle("aberto", abre);
      bt.setAttribute("aria-expanded", abre);
      if (abre) {
        busca.value = "";
        listaFiltro(pag, k);
        busca.focus();
      }
    };
    busca.oninput = () => listaFiltro(pag, k);
    host.querySelector(".mf-limpar").onclick = () => {
      pag.st[k].clear();
      aplicarFiltros(pag);
    };
    host.addEventListener("keydown", ev => {
      if (ev.key === "Escape") {
        fechaFiltros();
        bt.focus();
      }
    });
  });
  document.addEventListener("click", ev => {
    if (!ev.target.closest(".mf")) fechaFiltros();
  });
}

// troca entre a base diária e a horária
function ligarBaseDados(pag) {
  $$("[data-base]").forEach(
    b =>
      (b.onclick = () => {
        if (b.disabled) return;
        pag.st.base = b.dataset.base;
        $$("[data-base]").forEach(x => x.setAttribute("aria-pressed", x === b));
        if (pag.st.base === "hora" && (!pag.st.de || diaEntre(pag.st.ate, pag.st.de) > 366)) {
          pag.st.de = isoMais(pag.st.ate, -30);
          pag.st.preset = "1m";
        }
        atualizarDados(pag);
      })
  );
}

// download do arquivo (CSV ou XLSX, com dicionário e leia-me)
function ligarArquivoDados(pag) {
  $("#p-baixar").onclick = async () => {
    const C = cab(pag),
      L = linhasDados(pag),
      nome = `sar_dados_${pag.st.base === "hora" ? "horaria_" : ""}${pag.st.de || "inicio"}_${pag.st.ate}`;
    if (pag.st.formato === "csv") {
      const csv = [C.join(";")].concat(L.map(r => r.map(nCSV).join(";"))).join("\r\n");
      const dic = dicionario(pag)
        .map(r => r.map(nCSV).join(";"))
        .join("\r\n");
      const zip = new JSZip();
      zip.file("dados.csv", "\uFEFF" + csv);
      zip.file("dicionario.csv", "\uFEFF" + dic);
      zip.file("leia-me.txt", "\uFEFF" + leiaMe(pag));
      baixarArquivo(await zip.generateAsync({ type: "blob", compression: "DEFLATE" }), nome + ".zip");
      toast(
        `ZIP com ${fint(L.length)} linhas gerado. (Na página publicada no claude.ai o download é bloqueado; abra o arquivo local.)`
      );
    } else {
      try {
        await carregarScript("https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js");
      } catch {
        toast("Não foi possível carregar a biblioteca de Excel (rede bloqueada neste ambiente).");
        return;
      }
      const XL = window.XLSX,
        wb = XL.utils.book_new();
      const conv = r => r.map((v, j) => (j >= 7 ? v : v));
      XL.utils.book_append_sheet(wb, XL.utils.aoa_to_sheet([C, ...L.map(conv)]), "dados");
      XL.utils.book_append_sheet(wb, XL.utils.aoa_to_sheet(dicionario(pag)), "dicionario");
      XL.utils.book_append_sheet(
        wb,
        XL.utils.aoa_to_sheet(
          leiaMe(pag)
            .split("\r\n")
            .map(l => [l])
        ),
        "leia-me"
      );
      baixarArquivo(
        new Blob([XL.write(wb, { type: "array", bookType: "xlsx" })], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        }),
        nome + ".xlsx"
      );
      toast(
        `Planilha com ${fint(L.length)} linhas gerada. (Na página publicada no claude.ai o download é bloqueado; abra o arquivo local.)`
      );
    }
  };
}

const nMod = (pag, m) => pag.ENT.filter(e => e.mod === m).length;

// linhas do dicionário: colunas fixas e o catálogo, com os módulos que têm cada variável e a base horária
const DIC_LINHAS = pag => [
  ["codigo", "Código", "", "Código do reservatório no SAR.", "", ""],
  ["reservatorio", "Reservatório", "", "Nome do reservatório.", "", ""],
  ["modulo", "Módulo", "", "Módulo do SAR: SIN, Nordeste e Semiárido ou Outros Sistemas (com o sistema).", "", ""],
  ["uf", "UF", "", "Unidade da Federação.", "", ""],
  ["municipio", "Município", "", "Município do reservatório.", "", ""],
  [
    "bacia",
    "Bacia ou sistema",
    "",
    "SIN: bacia na divisão do ONS; Nordeste e Semiárido: bacia do cadastro; Outros Sistemas: o sistema.",
    "",
    ""
  ],
  [
    "data",
    "Data",
    "",
    "Data da leitura (dd/mm/aaaa). No Nordeste e Semiárido, a data real da leitura, sem preenchimento nem interpolação.",
    "",
    "não"
  ],
  ["data_hora", "Data e hora", "", "Data e hora da leitura (dd/mm/aaaa hh:mm), só na base horária.", "SIN", "sim"],
  ...CAT_VARS.map(v => [
    v.k,
    nomeVar(v),
    v.u,
    v.def,
    [...new Set(pag.ENT.filter(e => e.vars.includes(v.k)).map(e => ROT_MOD[e.mod]))].join(", "),
    VAR_HORA.has(v.k) ? "sim (SIN)" : "não",
    fonteVar(v.k)
  ])
];

const tituloDados = pag =>
  `
    <p class="trilha"><a href="#inicio">Início</a><span class="sep">›</span>Área de dados</p>
    <h1>Área de dados</h1>
    <p class="lead">Escolha os reservatórios, as variáveis e o período e baixe a série no formato do SAR, com o dicionário das variáveis e as fontes. Reservatórios de módulos diferentes podem ir no mesmo arquivo.</p>
    <div class="carimbo"><span><b>${fint(pag.ENT.length)}</b> reservatórios e estações</span><span><b>${fint(nMod(pag, "SIN"))}</b> SIN · <b>${fint(nMod(pag, "NE"))}</b> Nordeste e Semiárido · <b>${fint(nMod(pag, "OUTROS"))}</b> Outros Sistemas</span><span>Base diária; horária no SIN</span></div>`;

const corpoDados = pag =>
  `
    <nav class="indice" aria-label="Seções da página"><a href="#dados" data-alvo="d-res">Reservatórios</a><a href="#dados" data-alvo="d-var">Variáveis e período</a><a href="#dados" data-alvo="d-prev">Prévia e arquivo</a><a href="#dados" data-alvo="d-dic">Dicionário de dados</a></nav>
    <div class="dados-grade">
      <div class="fluxo">
        <section class="cartao secao" id="d-res" aria-labelledby="t-d-res">
          <h2 id="t-d-res"><small>1</small>Reservatórios</h2>
          <p class="sub">Busque pelo nome, pelo código ou pelo município, ou filtre por módulo, estado, município e bacia. A seleção se mantém quando você muda a busca ou os filtros.<span class="dica">Clique numa linha para marcar ou desmarcar.</span></p>
          <div class="busca-dados"><input type="search" id="d-busca" placeholder="Ex.: Sobradinho, 12112, Quixadá" aria-label="Buscar reservatório por nome, código ou município" autocomplete="off"></div>
          <div class="filtros-dados">
            <span class="seg" role="group" aria-label="Módulo (escolha um ou mais)">${[
              ["", "Todos"],
              ["SIN", "SIN"],
              ["NE", "Nordeste e Semiárido"],
              ["OUTROS", "Outros Sistemas"]
            ]
              .map(
                ([v, r]) =>
                  `<button type="button" data-mod="${v}" aria-pressed="${v === "" ? "true" : "false"}">${r}</button>`
              )
              .join("")}</span>
            ${["uf", "mun", "bacia"]
              .map(
                k => `<div class="mf" id="mf-${k}"><button type="button" class="mf-botao" aria-haspopup="true" aria-expanded="false"><span class="mf-rot">${pag.FILT[k].r}</span><span class="mf-val"></span><svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
              <div class="mf-pop" hidden><input type="search" class="mf-busca" placeholder="Buscar ${pag.FILT[k].r.toLowerCase()}" aria-label="Buscar ${pag.FILT[k].r.toLowerCase()}" autocomplete="off"><div class="mf-lista" role="group" aria-label="${pag.FILT[k].r}"></div><div class="mf-pe"><span class="mf-cont"></span><button type="button" class="mf-limpar">Limpar</button></div></div></div>`
              )
              .join("")}
            <button type="button" class="acao sec" id="d-limpar-f" disabled>Limpar filtros</button>
          </div>
          <div class="chips-filtro" id="d-chips"></div>
          <div class="barra-res"><span id="d-nres"></span><span class="acoes"><button type="button" class="acao sec" id="d-todos"></button><button type="button" class="acao sec" id="d-sosel" aria-pressed="false">Ver só os selecionados</button></span></div>
          <div class="tab-box lista-res"><table>
            <thead><tr><th class="ck"><span class="sr-only">Selecionar</span></th><th>Reservatório</th><th>Módulo</th><th>UF</th><th>Município</th><th>Bacia ou sistema</th></tr></thead>
            <tbody id="d-corpo"></tbody></table></div>
          <p class="mais-res" id="d-mais"></p>
        </section>
        <section class="cartao secao" id="d-var" aria-labelledby="t-d-var">
          <h2 id="t-d-var"><small>2</small>Variáveis e período</h2>
          <p class="sub">Cada variável tem um nome e uma definição únicos em todos os módulos; a barra mostra quantos dos reservatórios selecionados a têm. Volume (%) é o volume em % da capacidade; Volume útil (%), o volume útil em % do volume útil: são grandezas diferentes e vêm em colunas separadas.<span class="dica">Passe o mouse numa variável para ler a definição; o <a href="#dados" data-alvo="d-dic">dicionário de dados</a> tem todas.</span></p>
          <div class="linha-base"><b>Base</b><span class="seg" role="group" aria-label="Base de tempo"><button type="button" data-base="dia" aria-pressed="true">Diária</button><button type="button" data-base="hora" aria-pressed="false">Horária</button></span><span id="d-base-nota"></span></div>
          <div class="vars-grade" id="d-vars"></div>
          <div class="periodo"><b>Período</b><span class="presets">${[
            ["1m", "Último mês"],
            ["12m", "12 meses"],
            ["5a", "5 anos"],
            ["tudo", "Série completa"]
          ]
            .map(([k, r]) => `<button type="button" class="preset" data-p="${k}">${r}</button>`)
            .join("")}</span>
            <span class="datas"><label>de <input type="date" id="d-de"></label><label>até <input type="date" id="d-ate" max="${pag.ULT}"></label></span></div>
          <div id="d-aviso"></div>
        </section>
        <section class="cartao secao" id="d-prev" aria-labelledby="t-d-prev">
          <h2 id="t-d-prev"><small>3</small>Prévia e arquivo</h2>
          <p class="sub" id="d-prev-sub">Uma linha por reservatório e data, uma coluna por variável. Célula vazia: a variável não existe para aquele reservatório ou não há leitura naquela data.</p>
          <div class="previa-box tab-box" id="d-previa"></div>
          <div class="pacote">
            <div><h3>O que vem no arquivo</h3><ul id="d-arquivos"></ul></div>
            <div><h3>Consulta equivalente na API pública</h3><div class="api-box"><code id="d-api"></code><button type="button" id="d-api-copiar">Copiar</button></div>
              <p class="nota" style="margin:6px 0 0">Endereço ilustrativo: a API pública ainda será criada (solicitação à STI). A mesma consulta devolverá os mesmos dados, com a data da versão. <a href="#api">Documentação da API</a>.</p></div>
          </div>
          <p class="nota" style="margin:14px 0 0">${INICIO_PROTO}</p>
        </section>
        <section class="cartao secao tabela-bacia" id="d-dic" aria-labelledby="t-d-dic">
          ${barraBaixar([
            ["baixar-dic-csv", "CSV", "Baixar o dicionário de dados em CSV"],
            ["baixar-dic-pdf", "PDF", "Baixar o dicionário de dados em PDF"]
          ])}
          <h2 id="t-d-dic"><small>4</small>Dicionário de dados</h2>
          <p class="sub">Todas as colunas que o arquivo pode ter, com o nome, a unidade, a definição, a fonte, os módulos em que existem e se há base horária. Cada download traz a parte do dicionário das colunas pedidas.</p>
          <div class="tab-box"><table id="tab-dic">
            <colgroup><col style="width:22%"><col style="width:18%"><col><col style="width:16%"><col style="width:10%"></colgroup>
            <thead><tr><th>Coluna</th><th>Nome (unidade)</th><th>Definição e fonte</th><th>Módulos</th><th>Base horária</th></tr></thead>
            <tbody>${DIC_LINHAS(pag)
              .map(
                l =>
                  `<tr><td><code>${esc(l[0]).replace(/_/g, "_<wbr>")}</code></td><td><span class="nm">${esc(l[1])}</span></td><td>${esc(l[3])}${l[6] ? `<span class="nota" style="display:block">Fonte: ${esc(l[6])}.</span>` : ""}</td><td>${esc(l[4] || "todos")}</td><td>${esc(l[5])}</td></tr>`
              )
              .join("")}</tbody></table></div>
        </section>
      </div>
      <aside class="pedido" aria-labelledby="t-pedido">
        <h2 id="t-pedido">Seu pedido</h2>
        <dl>
          <div><dt>Reservatórios</dt><dd><span class="n" id="p-n">0</span>selecionados<div class="mods" id="p-mods"></div><button type="button" class="limpar" id="p-limpar" hidden>Limpar seleção</button></dd></div>
          <div><dt>Variáveis</dt><dd id="p-vars">–</dd></div>
          <div><dt>Período</dt><dd id="p-per">–</dd></div>
          <div><dt>Arquivo</dt><dd id="p-linhas">–</dd></div>
        </dl>
        <div class="formato"><span class="seg" role="group" aria-label="Formato"><button type="button" data-fmt="csv" aria-pressed="true">CSV</button><button type="button" data-fmt="xlsx" aria-pressed="false">Excel (XLSX)</button></span></div>
        <button type="button" class="acao" id="p-baixar" disabled>Baixar dados</button>
        <p class="motivo" id="p-motivo"></p>
      </aside>
    </div>`;

// ---------- 1. seleção
const filtrados = pag => {
  const termos = normalizaBusca(pag.st.txt).split(/\s+/).filter(Boolean); // várias palavras: todas têm de bater
  return pag.ENT.filter(
    e =>
      (!pag.st.soSel || pag.st.sel.has(e.id)) &&
      (!pag.st.mod.size || pag.st.mod.has(e.mod)) &&
      (!pag.st.uf.size || pag.st.uf.has(e.uf)) &&
      (!pag.st.mun.size || pag.st.mun.has(e.municipio)) &&
      (!pag.st.bacia.size || pag.st.bacia.has(e.bacia)) &&
      termos.every(tm => e.busca.includes(tm))
  );
};

// filtros com busca e escolha múltipla: estado depende do módulo; município e bacia, do módulo e do estado
const rotOpc = (pag, k, v) => (k === "uf" ? pag.UF_NOME[v] || v : v);

const opcoesDe = (pag, k) => {
  const L = pag.ENT.filter(
      e => (!pag.st.mod.size || pag.st.mod.has(e.mod)) && (k === "uf" || !pag.st.uf.size || pag.st.uf.has(e.uf))
    ),
    n = {};
  L.forEach(e => {
    const v = e[pag.campoDe[k]];
    if (v) n[v] = (n[v] || 0) + 1;
  });
  return Object.entries(n)
    .map(([v, c]) => ({ v, n: c }))
    .sort((x, y) => rotOpc(pag, k, x.v).localeCompare(rotOpc(pag, k, y.v), "pt-BR"));
};

const listaFiltro = (pag, k) => {
  const host = $(`#mf-${k}`),
    q = normalizaBusca(host.querySelector(".mf-busca").value);
  const O = opcoesDe(pag, k).filter(o => !q || normalizaBusca(rotOpc(pag, k, o.v)).includes(q));
  host.querySelector(".mf-lista").innerHTML = O.length
    ? O.map(
        o =>
          `<label class="mf-op"><input type="checkbox" value="${esc(o.v)}"${pag.st[k].has(o.v) ? " checked" : ""}><span>${esc(rotOpc(pag, k, o.v))}</span><small>${fint(o.n)}</small></label>`
      ).join("")
    : `<p class="nota" style="margin:6px">Nada encontrado.</p>`;
  host.querySelectorAll(".mf-op input").forEach(
    c =>
      (c.onchange = () => {
        c.checked ? pag.st[k].add(c.value) : pag.st[k].delete(c.value);
        aplicarFiltros(pag);
      })
  );
  host.querySelector(".mf-cont").textContent = pag.st[k].size
    ? `${pag.st[k].size} ${pag.st[k].size === 1 ? "escolhido" : "escolhidos"}`
    : "nenhum escolhido";
};

const opcoes = pag => {
  ["mun", "bacia"].forEach(k => {
    const ok = new Set(opcoesDe(pag, k).map(o => o.v));
    [...pag.st[k]].forEach(v => {
      if (!ok.has(v)) pag.st[k].delete(v);
    });
  });
  ["uf", "mun", "bacia"].forEach(k => {
    const host = $(`#mf-${k}`),
      S = pag.st[k];
    host.querySelector(".mf-val").textContent = !S.size
      ? pag.FILT[k].todos
      : S.size === 1
        ? rotOpc(pag, k, [...S][0])
        : `${S.size} escolhidos`;
    host.classList.toggle("ativo", S.size > 0);
    if (host.classList.contains("aberto")) listaFiltro(pag, k);
  });
  $$("[data-mod]").forEach(x =>
    x.setAttribute("aria-pressed", x.dataset.mod ? pag.st.mod.has(x.dataset.mod) : !pag.st.mod.size)
  );
  const ch = [
    ...[...pag.st.mod].map(v => ["mod", v, ROT_MOD[v]]),
    ...["uf", "mun", "bacia"].flatMap(k => [...pag.st[k]].map(v => [k, v, rotOpc(pag, k, v)]))
  ];
  $("#d-chips").innerHTML = ch
    .map(
      ([k, v, r]) =>
        `<button type="button" class="chip-f" data-k="${k}" data-v="${esc(v)}" aria-label="Tirar o filtro ${esc(r)}">${esc(r)}<span class="x" aria-hidden="true">×</span></button>`
    )
    .join("");
  $$("#d-chips .chip-f").forEach(
    c =>
      (c.onclick = () => {
        pag.st[c.dataset.k].delete(c.dataset.v);
        aplicarFiltros(pag);
      })
  );
  $("#d-limpar-f").disabled = !ch.length && !pag.st.txt.trim();
};

const aplicarFiltros = pag => {
  pag.st.mostrar = 12;
  opcoes(pag);
  desenharLista(pag);
};

const fechaFiltros = exceto =>
  $$(".mf.aberto").forEach(m => {
    if (m !== exceto) {
      m.classList.remove("aberto");
      m.querySelector(".mf-pop").hidden = true;
      m.querySelector(".mf-botao").setAttribute("aria-expanded", "false");
    }
  });

const desenharLista = pag => {
  const F = filtrados(pag),
    vis = F.slice(0, pag.st.mostrar),
    nSelF = F.filter(e => pag.st.sel.has(e.id)).length;
  $("#d-nres").innerHTML =
    `<b>${fint(F.length)}</b> ${F.length === 1 ? "resultado" : "resultados"}${nSelF ? ` · ${fint(nSelF)} selecionados` : ""}`;
  const todos = F.length && nSelF === F.length;
  $("#d-todos").textContent =
    F.length === 1
      ? todos
        ? "Tirar da seleção"
        : "Selecionar o resultado"
      : todos
        ? `Tirar os ${fint(F.length)} da seleção`
        : `Selecionar os ${fint(F.length)} resultados`;
  $("#d-todos").disabled = !F.length;
  $("#d-corpo").innerHTML =
    vis
      .map(
        e => `<tr data-id="${e.id}"${pag.st.sel.has(e.id) ? ' class="sel"' : ""}>
      <td class="ck"><input type="checkbox" ${pag.st.sel.has(e.id) ? "checked" : ""} aria-label="Selecionar ${esc(e.nome)}" tabindex="-1"></td>
      <td><span class="nm">${esc(e.nome)}</span>${e.retirado ? '<span class="ret">retirado do acompanhamento</span>' : ""}<span class="rio">${e.codigo ? `código ${esc(e.codigo)} · ` : ""}${esc(e.tipo)}</span></td>
      <td><span class="tag" style="background:${COR_MOD[e.mod]}" title="${ROT_MOD[e.mod]}">${e.mod === "NE" ? "Nordeste" : e.mod === "OUTROS" ? "Outros" : "SIN"}</span></td><td>${esc(e.uf)}</td><td>${esc(e.municipio || "–")}</td><td>${esc(e.bacia || "–")}</td></tr>`
      )
      .join("") ||
    `<tr><td colspan="6" class="nota" style="padding:18px 8px">${pag.st.soSel ? "Nenhum reservatório selecionado ainda." : "Nada encontrado. Tente outro nome ou limpe os filtros."}</td></tr>`;
  $$("#d-corpo tr[data-id]").forEach(tr => {
    tr.tabIndex = 0;
    const alterna = () => {
      const id = tr.dataset.id;
      pag.st.sel.has(id) ? pag.st.sel.delete(id) : pag.st.sel.add(id);
      tr.classList.toggle("sel");
      tr.querySelector("input").checked = pag.st.sel.has(id);
      atualizarDados(pag, false);
    };
    tr.onclick = alterna;
    tr.onkeydown = ev => {
      if (ev.key === " " || ev.key === "Enter") {
        ev.preventDefault();
        alterna();
      }
    };
  });
  $("#d-mais").innerHTML =
    F.length > vis.length
      ? `<button type="button" class="acao sec" id="d-mais-b">Mostrar mais ${fint(Math.min(30, F.length - vis.length))} (faltam ${fint(F.length - vis.length)})</button>`
      : "";
  if ($("#d-mais-b"))
    $("#d-mais-b").onclick = () => {
      pag.st.mostrar += 30;
      desenharLista(pag);
    };
};

const ligarSelecaoDados = pag => {
  $("#d-busca").oninput = ev => {
    clearTimeout(pag.tBusca);
    pag.tBusca = setTimeout(() => {
      pag.st.txt = ev.target.value;
      pag.st.mostrar = 12;
      desenharLista(pag);
      $("#d-limpar-f").disabled = !pag.st.txt.trim() && !$("#d-chips").children.length;
    }, 120);
  };
  $$("[data-mod]").forEach(
    b =>
      (b.onclick = () => {
        const m = b.dataset.mod;
        if (!m) pag.st.mod.clear();
        else pag.st.mod.has(m) ? pag.st.mod.delete(m) : pag.st.mod.add(m);
        aplicarFiltros(pag);
      })
  );
  $("#d-todos").onclick = () => {
    const F = filtrados(pag),
      todos = F.every(e => pag.st.sel.has(e.id));
    F.forEach(e => (todos ? pag.st.sel.delete(e.id) : pag.st.sel.add(e.id)));
    desenharLista(pag);
    atualizarDados(pag, false);
  };
  $("#d-sosel").onclick = ev => {
    pag.st.soSel = !pag.st.soSel;
    ev.target.setAttribute("aria-pressed", pag.st.soSel);
    ev.target.textContent = pag.st.soSel ? "Ver todos" : "Ver só os selecionados";
    pag.st.mostrar = 12;
    desenharLista(pag);
  };
  $("#p-limpar").onclick = () => {
    pag.st.sel.clear();
    desenharLista(pag);
    atualizarDados(pag, false);
  };
};

// ---------- 2. variáveis, base e período
const selEnt = pag => [...pag.st.sel].map(id => pag.porId[id]).filter(Boolean);

const temVar = (pag, e, k) => e.vars.includes(k) && (pag.st.base === "dia" || (e.hora && VAR_HORA.has(k)));

const desenharVars = pag => {
  const S = selEnt(pag),
    grupos = [...new Set(CAT_VARS.map(v => v.g))];
  $("#d-vars").innerHTML =
    (S.length
      ? ""
      : `<p class="aviso-dados" style="grid-column:1/-1;margin:0">Selecione reservatórios no passo 1: aqui ficam habilitadas só as variáveis que eles têm, já marcadas. Desmarque as que não quiser.</p>`) +
    grupos
      .map(g => {
        const VG = CAT_VARS.filter(v => v.g === g);
        if (S.length && !VG.some(v => S.some(e => temVar(pag, e, v.k))))
          // grupo que nenhum selecionado tem: uma linha só
          return `<div class="var-grupo vazio"><h3>${g}</h3><p class="nota" style="margin:0 0 6px">${VG.length} variáveis (${VG.map(v => nomeVar(v).toLowerCase()).join(", ")}): nenhum dos selecionados tem${pag.st.base === "hora" ? " na base horária" : ""}.</p></div>`;
        return `<div class="var-grupo"><h3>${g}</h3>${VG.map(v => {
          const n = S.filter(e => temVar(pag, e, v.k)).length,
            ind = !S.length || !n,
            pct = S.length ? (n / S.length) * 100 : 0;
          return `<label class="var-item${ind ? " indisp" : ""}" title="${esc(v.def)}"><input type="checkbox" data-var="${v.k}" ${pag.st.vars.has(v.k) && !ind ? "checked" : ""}${ind ? " disabled" : ""}>
        <span class="nm">${nomeVar(v)}</span>
        <span class="disp">${S.length ? `<i><b style="width:${pct}%"></b></i>${n ? `${fint(n)} de ${fint(S.length)}` : pag.st.base === "hora" && !VAR_HORA.has(v.k) ? "sem base horária" : "nenhum selecionado tem"}` : ""}</span></label>`;
        }).join("")}</div>`;
      })
      .join("");
  $$("#d-vars input[data-var]").forEach(
    c =>
      (c.onchange = () => {
        c.checked ? pag.st.vars.add(c.dataset.var) : pag.st.vars.delete(c.dataset.var);
        atualizarDados(pag, false);
      })
  );
  const temSIN = S.some(e => e.mod === "SIN"),
    bh = $('[data-base="hora"]');
  bh.disabled = !temSIN && pag.st.base !== "hora";
  bh.title = temSIN
    ? "Base horária: só reservatórios do SIN, até 1 ano por pedido"
    : "A base horária existe só para o SIN: selecione ao menos uma usina do SIN";
  $("#d-base-nota").textContent =
    pag.st.base === "hora"
      ? "Só os reservatórios do SIN entram; até 1 ano por pedido; desde 01/01/2010."
      : temSIN
        ? "Horária: só SIN, até 1 ano por pedido."
        : "";
};

const aplicarPresetDados = (pag, k) => {
  pag.st.preset = k;
  pag.st.ate = pag.ULT;
  pag.st.de =
    k === "1m"
      ? isoMais(pag.ULT, -30)
      : k === "12m"
        ? isoMais(pag.ULT, -365)
        : k === "5a"
          ? isoMais(pag.ULT, -5 * 365 - 1)
          : null;
  atualizarDados(pag);
};

const ligarPeriodoDados = pag => {
  $$("[data-p]").forEach(b => (b.onclick = () => aplicarPresetDados(pag, b.dataset.p)));
  $("#d-de").onchange = ev => {
    pag.st.de = ev.target.value || null;
    pag.st.preset = "";
    atualizarDados(pag);
  };
  $("#d-ate").onchange = ev => {
    pag.st.ate = ev.target.value || pag.ULT;
    pag.st.preset = "";
    atualizarDados(pag);
  };
};

// ---------- 3. prévia, arquivo e pedido
const varsEf = pag => {
  const S = selEnt(pag);
  return CAT_VARS.filter(v => pag.st.vars.has(v.k) && S.some(e => temVar(pag, e, v.k)));
};

const linhasDados = (pag, limite) => {
  const V = varsEf(pag),
    L = [];
  for (const e of selEnt(pag)) {
    if (pag.st.base === "hora" && e.mod !== "SIN") continue;
    const Ve = V.filter(v => temVar(pag, e, v.k));
    if (!Ve.length) continue;
    for (const p of serieDados(e, pag.st.base, pag.st.de, pag.st.ate)) {
      if (!Ve.some(v => p.v[v.k] != null)) continue;
      const dt = pag.st.base === "hora" ? `${dBR(p.t.slice(0, 10))} ${p.t.slice(11, 13)}:00` : dBR(p.t);
      L.push([
        e.codigo,
        e.nome,
        e.mod === "OUTROS" ? `Outros Sistemas · ${NOME_SIS[e.sis]}` : ROT_MOD[e.mod],
        e.uf,
        e.municipio,
        e.bacia,
        dt,
        ...V.map(v => (Ve.includes(v) ? (p.v[v.k] ?? null) : null))
      ]);
      if (limite && L.length >= limite) return L;
    }
  }
  return L;
};

const cab = pag => [
  "codigo",
  "reservatorio",
  "modulo",
  "uf",
  "municipio",
  "bacia",
  pag.st.base === "hora" ? "data_hora" : "data",
  ...varsEf(pag).map(v => v.k)
];

const urlAPI = pag => {
  const S = selEnt(pag);
  const ids = S.map(e => e.codigo || (e.src === "can" ? "CANTAREIRA" : "")).filter(Boolean);
  return `GET /v1/series?reservatorios=${ids.slice(0, 6).join(",")}${ids.length > 6 ? `,…(${ids.length})` : ""}&variaveis=${varsEf(
    pag
  )
    .map(v => v.k)
    .join(
      ","
    )}&inicio=${pag.st.de || "inicio"}&fim=${pag.st.ate}&base=${pag.st.base === "hora" ? "horaria" : "diaria"}&formato=${pag.st.formato}`;
};

const atualizarDados = (pag, redesenhaVars = true) => {
  const S = selEnt(pag),
    V = varsEf(pag),
    sinH = S.filter(e => e.mod === "SIN").length;
  if (pag.st.base === "hora" && !sinH) {
    pag.st.base = "dia";
    $$("[data-base]").forEach(x => x.setAttribute("aria-pressed", x.dataset.base === "dia"));
  }
  desenharVars(pag);
  $$("[data-p]").forEach(b => b.classList.toggle("ativo", b.dataset.p === pag.st.preset));
  $("#d-de").value = pag.st.de || "";
  $("#d-ate").value = pag.st.ate;
  const dias = pag.st.de ? diaEntre(pag.st.ate, pag.st.de) : Infinity,
    excede = pag.st.base === "hora" && dias > 366;
  const avisos = [];
  if (pag.st.base === "hora")
    avisos.push(
      `<b>Base horária:</b> dados abertos do ONS, não consistidos pelo ONS: são de responsabilidade dos agentes de geração, podem ter lacunas e ser alterados. A afluência horária é calculada por balanço e oscila.${S.length > sinH ? ` ${fint(S.length - sinH)} reservatórios selecionados fora do SIN não entram no arquivo horário.` : ""}`
    );
  if (excede) avisos.push(`<b>O pedido horário vai até 1 ano.</b> Reduza o período (hoje, ${fint(dias)} dias).`);
  $("#d-aviso").innerHTML = avisos.map(a => `<p class="aviso-dados">${a}</p>`).join("");
  // painel do pedido
  const cont = m => S.filter(e => e.mod === m).length;
  $("#p-n").textContent = fint(S.length);
  $("#p-mods").innerHTML = ["SIN", "NE", "OUTROS"]
    .filter(m => cont(m))
    .map(m => `<span><i style="background:${COR_MOD[m]}"></i>${ROT_MOD[m]} ${fint(cont(m))}</span>`)
    .join("");
  $("#p-limpar").hidden = !S.length;
  $("#p-vars").textContent = V.length ? V.map(nomeVar).join(", ") : "–";
  $("#p-per").textContent =
    `${pag.st.de ? dBR(pag.st.de) : "início da série"} a ${dBR(pag.st.ate)} · base ${pag.st.base === "hora" ? "horária" : "diária"}`;
  $("#d-api").textContent = urlAPI(pag);
  $("#d-arquivos").innerHTML =
    pag.st.formato === "csv"
      ? `<li><b>dados.csv</b>: a série, no formato do SAR (ponto e vírgula, vírgula decimal, data dd/mm/aaaa)</li><li><b>dicionario.csv</b>: definição, unidade, módulos e fonte de cada coluna</li><li><b>leia-me.txt</b>: seleção, período, data da versão dos dados, fontes, regras de conferência e a consulta na API</li>`
      : `<li><b>Um arquivo .xlsx com três abas</b>: dados, dicionário e leia-me, com o mesmo conteúdo do CSV</li>`;
  const motivo = !S.length
    ? "Selecione ao menos um reservatório."
    : !V.length
      ? "Escolha ao menos uma variável que os selecionados tenham."
      : pag.st.de && pag.st.de > pag.st.ate
        ? "A data inicial é posterior à final."
        : excede
          ? "Reduza o período: o pedido horário vai até 1 ano."
          : "";
  $("#p-baixar").disabled = !!motivo;
  $("#p-motivo").textContent = motivo;
  clearTimeout(pag.tPrev);
  pag.tPrev = setTimeout(() => {
    if (motivo && !S.length) {
      $("#d-previa").innerHTML =
        `<p class="nota" style="padding:14px 0">A prévia aparece quando houver reservatórios e variáveis escolhidos.</p>`;
      $("#p-linhas").textContent = "–";
      return;
    }
    const todas = linhasDados(pag),
      C = cab(pag);
    $("#p-linhas").innerHTML =
      `<b>${fint(todas.length)}</b> linhas × ${C.length} colunas${pag.st.formato === "csv" ? " · ZIP com CSV, dicionário e leia-me" : " · XLSX com três abas"}<br><span class="nota">no protótipo, com os dados embutidos</span>`;
    $("#d-previa").innerHTML = todas.length
      ? `<table><thead><tr>${C.map(c => `<th${/_(m|m3s|pct|hm3|mm)$/.test(c) ? ' class="r"' : ""}>${c.replace(/_/g, "_<wbr>")}</th>`).join("")}</tr></thead><tbody>${todas
          .slice(0, 10)
          .map(
            l =>
              `<tr>${l.map((v, j) => `<td${j >= 7 ? ' class="r num"' : j === 6 ? ' class="dt"' : ""}>${v == null ? "" : j >= 7 ? esc(nCSV(v)) : esc(v)}</td>`).join("")}</tr>`
          )
          .join("")}</tbody></table>
        <p class="nota" style="margin:8px 0 0">Prévia das 10 primeiras de ${fint(todas.length)} linhas.</p>`
      : `<p class="nota" style="padding:14px 0">Nenhuma leitura no período para os reservatórios e variáveis escolhidos (no protótipo, veja o período coberto abaixo).</p>`;
  }, 150);
};

const ligarFormatoDados = pag => {
  $$("[data-fmt]").forEach(
    b =>
      (b.onclick = () => {
        pag.st.formato = b.dataset.fmt;
        $$("[data-fmt]").forEach(x => x.setAttribute("aria-pressed", x === b));
        atualizarDados(pag, false);
      })
  );
  $("#baixar-dic-csv").onclick = () =>
    salvarCSV(
      ["coluna", "nome", "unidade", "definicao", "modulos", "base_horaria", "fonte"],
      DIC_LINHAS(pag),
      "sar_dicionario_de_dados.csv"
    );
  $("#baixar-dic-pdf").onclick = () => pdfSecao([$("#tab-dic")], "sar_dicionario_de_dados.pdf");
  $$('#conteudo a[data-alvo="d-dic"]').forEach(
    a =>
      (a.onclick = ev => {
        ev.preventDefault();
        $("#d-dic").scrollIntoView({ behavior: "smooth", block: "start" });
      })
  );
  $("#d-api-copiar").onclick = () => {
    navigator.clipboard &&
      navigator.clipboard.writeText($("#d-api").textContent).then(
        () => toast("Consulta copiada."),
        () => toast("Não foi possível copiar neste navegador.")
      );
  };
};

// ---------- download
const dicionario = pag => [
  ["coluna", "descricao", "unidade", "modulos", "fonte"],
  ["codigo", "Código do reservatório no SAR", "", "", ""],
  ["reservatorio", "Nome do reservatório", "", "", ""],
  ["modulo", "Módulo do SAR (SIN; Nordeste e Semiárido; Outros Sistemas)", "", "", ""],
  ["uf", "Unidade da Federação", "", "", ""],
  ["municipio", "Município", "", "", ""],
  ["bacia", "Bacia (SIN, na divisão do ONS; NE, a do cadastro) ou sistema (Outros)", "", "", ""],
  [
    pag.st.base === "hora" ? "data_hora" : "data",
    pag.st.base === "hora"
      ? "Data e hora da leitura (dd/mm/aaaa hh:mm)"
      : "Data da leitura (dd/mm/aaaa). No NE, a data real da leitura, sem preenchimento",
    "",
    "",
    ""
  ],
  ...varsEf(pag).map(v => [
    v.k,
    v.def,
    v.u,
    [...new Set(pag.ENT.filter(e => e.vars.includes(v.k)).map(e => ROT_MOD[e.mod]))].join("; "),
    fonteVar(v.k)
  ])
];

const leiaMe = pag => {
  const S = selEnt(pag),
    cont = m => S.filter(e => e.mod === m).length;
  return [
    `SAR · Sistema de Acompanhamento de Reservatórios · Área de dados`,
    `Gerado em ${hojeBR()}. Versão dos dados: carga de ${dBR(D.data)} (no sistema, a data e a hora da versão, que a API aceita no parâmetro versao).`,
    ``,
    `Seleção: ${S.length} reservatórios (SIN ${cont("SIN")}; Nordeste e Semiárido ${cont("NE")}; Outros Sistemas ${cont("OUTROS")}).`,
    `Variáveis: ${varsEf(pag)
      .map(v => `${v.k} (${v.u})`)
      .join(", ")}.`,
    `Período: ${pag.st.de ? dBR(pag.st.de) : "início da série"} a ${dBR(pag.st.ate)}, base ${pag.st.base === "hora" ? "horária" : "diária"}.`,
    ``,
    `Série: só as leituras aceitas pela conferência. Regras de cota: erro grosseiro, pico de um dia e degrau que volta (descritas nas páginas de estado do Nordeste); o volume do mesmo dia sai junto com a cota descartada.`,
    `Nordeste e Semiárido: data da leitura real, sem preenchimento nem interpolação. Reservatório sem curva cota-volume validada vem com a cota e sem volume.`,
    ...(pag.st.base === "hora"
      ? [
          `Base horária: dados abertos do ONS (Dados Hidráulicos por Reservatório – Base horária), não consistidos pelo ONS: são de responsabilidade dos agentes de geração, podem ter lacunas e ser alterados. A afluência horária é calculada por balanço e oscila, com negativos e picos que não são vazão real.`
        ]
      : []),
    ``,
    `Fontes: ${D.fontes.medicoes}; ${NEd.fontes.medicoes}; ${NEd.nivel ? NEd.nivel.fonte : ""}; ${OS ? OS.fontes.sabesp + "; " + OS.fontes.coletor : ""}.`,
    ``,
    `Consulta equivalente na API pública (endereço ilustrativo; API a ser criada): ${urlAPI(pag)}`,
    ``,
    INICIO_PROTO
  ].join("\r\n");
};

export { CAT_VARS, entidadesDados, nomeVar, paginaDados, ROT_MOD, serieDados };
