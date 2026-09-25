/* Página inicial (#inicio): busca comum aos três módulos, mapa com os reservatórios acompanhados e cartões com o
   dado mais recente de cada módulo. */
import { contexto } from "./contexto.js";
import { D, NEd, OS } from "./dados_embutidos.js";
import { $, $$, caso, COR, dBR, esc, fint, fmt, normalizaBusca, ORDEM_BACIAS, RES, toast } from "./base.js";
import { fichaDoNome, hashFicha } from "./ficha_sin.js";
import { situacaoNE } from "./ne.js";
import { COORD_OS } from "./outros.js";
import { FOS } from "./outros_sistemas.js";
import { entidadesDados } from "./dados.js";

const NE_UFS = new Set(["AL", "BA", "CE", "MA", "MG", "PB", "PE", "PI", "RN", "SE"]),
  OUTROS_UFS = new Set(["SP", "DF", "MG"]);
const COR_MOD = { SIN: COR.ana, NE: COR.verde, OUTROS: COR.bronze }; // marinho, verde-azulado e bronze: três matizes distintos e harmônicos, conferidos no validador de paleta (19/09/2026) // três cores bem distintas; laranja só como marca de dado, como nas linhas dos gráficos
// parágrafos do SAR atual com enumerações "(i) ...; (ii) ...; e (iii) ..." viram parágrafo de abertura + lista
function miniMapa(tipo) {
  const S = D.sin,
    W = S.w,
    H = S.h;
  let camadas = `<path d="${S.brasil}" fill="${COR.linha}" stroke="${COR.branco}" stroke-width="1.5"/>`;
  const cor = COR_MOD[tipo.toUpperCase()];
  if (tipo === "sin")
    camadas += S.bacias
      .map(b => `<path d="${b.d}" fill="${cor}" fill-opacity=".85" stroke="${COR.branco}" stroke-width="1.2"/>`)
      .join("");
  else
    camadas += S.ufs
      .filter(u => (tipo === "ne" ? NE_UFS : OUTROS_UFS).has(u.uf))
      .map(u => `<path d="${u.d}" fill="${cor}" fill-opacity=".85" stroke="${COR.branco}" stroke-width="1.2"/>`)
      .join("");
  return `<svg class="mini-mapa" viewBox="0 0 ${W} ${H}" aria-hidden="true">${camadas}</svg>`;
}
function paginaInicio() {
  const pag = {}; // estado da página, passado às funções abaixo

  pag.I = D.inicio;
  pag.ult = D.equivalente.ultimo_dia;
  const S = D.equivalente.serie;
  pag.vSIN = S[pag.ult];
  const salvaRef = contexto.dataRef;
  contexto.dataRef = NEd.data;
  pag.sNE = situacaoNE();
  contexto.dataRef = salvaRef; // o NE no dia da última medição, como na página do módulo
  // mapa e contagem pelas listas dos módulos: o total é a soma das contagens dos módulos (Diego, 19/09/2026)
  const aXY = (() => {
    const R = RES.filter(r => r.x != null && r.lat != null),
      n = R.length;
    const reg = (xs, ys) => {
      const mx = xs.reduce((a, b) => a + b, 0) / n,
        my = ys.reduce((a, b) => a + b, 0) / n;
      const b = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / xs.reduce((a, x) => a + (x - mx) ** 2, 0);
      return [b, my - b * mx];
    };
    const [bx, ax] = reg(
        R.map(r => r.lon),
        R.map(r => r.x)
      ),
      [by, ay] = reg(
        R.map(r => r.lat),
        R.map(r => r.y)
      );
    return (lat, lon) => [ax + bx * lon, ay + by * lat];
  })();
  pag.PM = {
    SIN: RES.map(r => (r.x != null ? [r.x, r.y] : r.lat != null ? aXY(r.lat, r.lon) : null)),
    NE: [...pag.sNE.lista, ...pag.sNE.niveis].map(r => (r.lat != null ? aXY(r.lat, r.lon) : null)),
    OUTROS: Object.keys(FOS).map(c => (COORD_OS[c] ? aXY(COORD_OS[c][0], COORD_OS[c][1]) : null))
  };
  pag.CT = {
    SIN: RES.length,
    NE: pag.sNE.total.n,
    OUTROS: OS ? 4 + OS.sistemas.df.res.length + OS.sistemas.rmbh.res.length : Object.keys(FOS).length
  };
  pag.CT.total = pag.CT.SIN + pag.CT.NE + pag.CT.OUTROS;
  pag.CT.fora = Object.values(pag.PM)
    .flat()
    .filter(p => !p).length;
  $("#titulo-pag").innerHTML = "";
  $("#conteudo").innerHTML = corpoInicio(pag);
  $$("#conteudo [data-rota]").forEach(
    b =>
      (b.onclick = () => {
        location.hash = b.dataset.rota;
      })
  );
  $$("#conteudo [data-fora]").forEach(
    b =>
      (b.onclick = () =>
        toast(`${b.dataset.fora}: fora desta rodada do protótipo. A estrutura desse módulo ainda vai ser definida.`))
  );
  montarBusca();
}

const corpoInicio = pag =>
  `
    <p class="acesso-adm"><a href="#admin"><svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><rect x="3" y="7" width="10" height="7" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>Acesso restrito · Administração</a></p>
    <section class="hero cartao" aria-labelledby="t-hero">
      <div class="hero-txt">
        <div class="hero-marca"><span class="logo" role="img" aria-label="ANA - Agência Nacional de Águas e Saneamento Básico">${$("header .logo").innerHTML}</span><span class="selo">Protótipo</span></div>
        <h1 id="t-hero">Sistema de Acompanhamento de Reservatórios</h1>
        <p class="lead-hero">Acompanhe, dia a dia, a operação dos principais reservatórios do Brasil.</p>
        <form class="busca" role="search" id="busca" autocomplete="off">
          <label class="sr" for="q">Buscar reservatório</label>
          <input id="q" type="search" placeholder="Buscar por nome, município, estado, bacia ou código" spellcheck="false">
          <button type="submit" class="acao">Buscar</button>
          <div class="resultados" id="resultados" hidden></div>
        </form>
        <p class="nota">A busca cobre os três módulos.</p>
      </div>
      <div class="hero-mapa" aria-hidden="true">
        <svg viewBox="0 0 ${D.sin.w} ${D.sin.h}">
          <path d="${D.sin.brasil}" fill="#E1E5EA"/>
          ${D.sin.ufs.map(u => `<path d="${u.d}" fill="none" stroke="${COR.branco}" stroke-width="1.1"/>`).join("")}
          ${["NE", "OUTROS", "SIN"]
            .map(m =>
              pag.PM[m]
                .filter(Boolean)
                .map(
                  ([x, y]) =>
                    `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${m === "SIN" ? 4.2 : 3.4}" fill="${COR_MOD[m]}" stroke="${COR.branco}" stroke-width="1"/>`
                )
                .join("")
            )
            .join("")}
        </svg>
        <div class="legenda-hero"><b>${fint(pag.CT.total)} reservatórios acompanhados</b><span><i style="background:${COR_MOD.SIN}"></i>Sistema Interligado Nacional (${fint(pag.CT.SIN)})</span><span><i style="background:${COR_MOD.NE}"></i>Nordeste e Semiárido (${fint(pag.CT.NE)})</span><span><i style="background:${COR_MOD.OUTROS}"></i>Outros Sistemas Hídricos (${fint(pag.CT.OUTROS)})</span>${pag.CT.fora ? `<span class="fora">${fint(pag.CT.fora)} sem coordenada no cadastro ficam fora do mapa</span>` : ""}</div>
      </div>
    </section>

    <div class="modulos-grid">
      <article class="cartao modulo" aria-labelledby="m-sin" style="--cor-mod:${COR_MOD.SIN}">
        ${miniMapa("sin")}
        <h2 id="m-sin">Sistema Interligado Nacional</h2>
        <div class="dado"><div class="n num">${fmt(pag.vSIN, 1)}<small>%</small></div><div class="r">reservatório equivalente em ${dBR(pag.ult)}</div></div>
        <div class="fatos"><span><b class="num">${RES.length}</b> usinas</span><span><b class="num">${ORDEM_BACIAS.length}</b> bacias</span><span>dados diários e horários</span></div>
        <div class="txt"><p>Usinas hidrelétricas operadas sob coordenação do ONS: nível, vazões e volume útil, bacia a bacia.</p></div>
        <button type="button" class="acao" data-rota="sin">Entrar no módulo</button>
      </article>
      <article class="cartao modulo" aria-labelledby="m-ne" style="--cor-mod:${COR_MOD.NE}">
        ${miniMapa("ne")}
        <h2 id="m-ne">Nordeste e Semiárido</h2>
        <div class="dado"><div class="n num">${fmt(pag.sNE.total.volume_pct, 1)}<small>%</small></div><div class="r">volume acumulado em ${dBR(D.ne.data)}</div></div>
        <div class="fatos"><span><b class="num">${fint(pag.sNE.total.n)}</b> reservatórios</span><span><b class="num">${pag.sNE.estados.filter(e => e.n).length}</b> estados</span><span>medições do último mês</span></div>
        <div class="txt"><p>Açudes do Nordeste e do semiárido mineiro: volume armazenado, nível e situação de cada estado.</p></div>
        <button type="button" class="acao" data-rota="ne">Entrar no módulo</button>
      </article>
      <article class="cartao modulo" aria-labelledby="m-outros" style="--cor-mod:${COR_MOD.OUTROS}">
        ${miniMapa("outros")}
        <h2 id="m-outros">Outros Sistemas Hídricos</h2>
        <div class="dado sistemas">
          <div class="sis"><b>Cantareira</b><span class="nota">${D.outros ? dBR(D.outros.cantareira.ate) : dBR(pag.I.cantareira[0].data)}</span>
            ${D.outros ? `<div class="l"><span>Sistema (4 reservatórios)</span><span class="num">${fmt(D.outros.cantareira.pct[D.outros.cantareira.pct.length - 1], 1)}%</span></div>` : ""}
            ${D.outros ? D.outros.cantareira.res.map(r => `<div class="l"><span>${esc(r.nome)}</span><span class="num">${fmt(r.pct[r.pct.length - 1], 1)}%</span></div>`).join("") : pag.I.cantareira.map(c => `<div class="l"><span>${esc(caso(c.nome))}</span><span class="num">${fmt(c.vu_pct, 1)}%</span></div>`).join("")}</div>
          ${
            D.outros
              ? ["df", "rmbh"]
                  .map(s => {
                    const Sis = D.outros.sistemas[s];
                    return `<div class="sis"><b>${s === "df" ? "Distrito Federal" : "Paraopeba"}</b><span class="nota">${dBR(
                      Sis.res
                        .map(r => r.data)
                        .sort()
                        .pop()
                    )}</span>
            ${Sis.res.map(r => `<div class="l"><span>${esc(caso(r.nome))}</span><span class="num">${r.pct != null ? fmt(r.pct, 1) + "%" : fmt(r.cota, 2) + " m"}</span></div>`).join("")}</div>`;
                  })
                  .join("")
              : `<div class="sis apagado"><b>Distrito Federal</b><span class="nota">Santa Maria, Descoberto e Paranoá</span></div>
          <div class="sis apagado"><b>Paraopeba</b><span class="nota">Rio Manso, Vargem das Flores e Serra Azul</span></div>`
          }
        </div>
        <div class="txt"><p>Sistemas que abastecem São Paulo, o Distrito Federal e Belo Horizonte.</p></div>
        <button type="button" class="acao" data-rota="outros">Entrar no módulo</button>
      </article>
    </div>
    <section class="cartao faixa-dados" aria-labelledby="t-dados">
      <div>
        <h2 id="t-dados">Área de dados</h2>
        <p>Baixe as séries de vários reservatórios de uma vez, no período e no formato que escolher, ou acesse por <a href="#api">API</a>.</p>
      </div>
      <button type="button" class="acao" data-rota="dados">Entrar na área de dados</button>
    </section>
    <section class="sobre-sar" aria-labelledby="t-sobre">
      <h2 id="t-sobre">Sobre o SAR</h2>
      <p>O Sistema de Acompanhamento de Reservatórios (SAR) reúne e organiza os dados de operação dos principais reservatórios do Brasil. Foi criado pela Agência Nacional de Águas e Saneamento Básico (ANA) em 2013 e lançado em 2014.</p>
    </section>
    <p class="nota fontes-inicio">Fontes: ${esc(D.fontes.equivalente)}; ${esc(NEd.fontes.medicoes)}, com a regra da página do módulo; ${D.outros ? esc(D.outros.fontes.sabesp) + "; " + esc(D.outros.fontes.coletor) : esc(pag.I.fonte_cantareira)}. Criação e lançamento do SAR: página Sobre o SAR (gov.br/ana/sar), lida em 17/09/2026.</p>`;
function montarBusca() {
  // mesma lista e mesmos campos da área de dados, para os totais baterem
  const ROT_MOD_I = { SIN: "SIN", NE: "Nordeste e Semiárido", OUTROS: "Outros Sistemas Hídricos" };
  const indice = entidadesDados().map(e => ({
    nome: e.nome,
    cod: e.codigo,
    e,
    r: e.r,
    mod: ROT_MOD_I[e.mod],
    chave: normalizaBusca(e.busca),
    det: `${e.bacia ? e.bacia + " · " : ""}${e.municipio ? e.municipio + ", " : ""}${e.uf}${e.codigo ? " · código " + e.codigo : ""}${e.tipo === "só nível" ? " · só nível" : ""}${e.retirado ? " · retirado do acompanhamento" : ""}`
  }));
  const q = $("#q"),
    box = $("#resultados");
  const abrir = it => {
    if (it.mod === "Nordeste e Semiárido" && NEd.fichas && NEd.fichas[it.cod]) {
      location.hash = "ne/ficha/" + it.cod;
      return;
    }
    if (it.mod === "Outros Sistemas Hídricos" && D.outros && it.cod) {
      location.hash = "outros/ficha/" + it.cod;
      return;
    }
    if (it.e && it.e.src === "can") {
      location.hash = "outros/cantareira";
      return;
    }
    if (it.mod !== "SIN") {
      toast(`${it.nome} (${it.mod}): a ficha desse módulo fica para a próxima rodada.`);
      return;
    }
    if (fichaDoNome(it.r.nome)) location.hash = hashFicha(it.r.nome);
    else if (it.r.bacia === "GRANDE") location.hash = "bacia/GRANDE";
    else
      toast(
        `${it.nome}: no protótipo há ficha só das usinas com condições de operação em resolução da ANA, e página só da bacia do Grande.`
      );
  };
  const buscar = () => {
    const termos = normalizaBusca(q.value).split(/\s+/).filter(Boolean);
    if (!termos.length) {
      box.hidden = true;
      return;
    }
    // relevância: nome começa com o termo > nome contém o termo > termo em outro campo (estado, bacia, município)
    const nota = it => {
      const n = normalizaBusca(it.nome);
      return termos.reduce((a, tm) => a + (n.startsWith(tm) ? 3 : n.includes(tm) ? 2 : 1), 0);
    };
    const todos = indice
      .filter(it => termos.every(tm => it.chave.includes(tm)))
      .map(it => ({ it, s: nota(it) }))
      .sort((a, b) => b.s - a.s || a.it.nome.localeCompare(b.it.nome, "pt-BR"))
      .map(x => x.it);
    const achados = todos.slice(0, 30);
    box.innerHTML =
      (todos.length
        ? `<p class="res-total">${fint(todos.length)} ${todos.length === 1 ? "resultado" : "resultados"}${todos.length > achados.length ? `, mostrando ${achados.length}` : ""} · <a href="#dados" id="res-dados">ver todos na área de dados</a></p>`
        : "") +
      (achados.length
        ? achados
            .map(
              (it, i) =>
                `<button type="button" class="res" data-i="${i}"><span class="n">${esc(it.nome)}</span><span class="d">${esc(it.det)}</span><span class="m">${it.mod}</span></button>`
            )
            .join("")
        : '<p class="nota" style="padding:8px 12px;margin:0">Nenhum reservatório encontrado.</p>');
    if ($("#res-dados"))
      $("#res-dados").onclick = ev => {
        ev.preventDefault();
        contexto.buscaDados = q.value.trim();
        location.hash = "dados";
      };
    $$(".res", box).forEach(b => (b.onclick = () => abrir(achados[+b.dataset.i])));
    box.hidden = false;
  };
  q.addEventListener("input", buscar);
  $("#busca").addEventListener("submit", e => {
    e.preventDefault();
    buscar();
    const p = $(".res", box);
    if (p) p.focus();
  });
  document.addEventListener("click", e => {
    if (!e.target.closest("#busca")) box.hidden = true;
  });
}

export { COR_MOD, paginaInicio };
