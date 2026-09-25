/* Rotas por hash (#inicio, #sin, #bacia/..., #ficha/..., #ne/..., #outros/..., #dados, #api, #componentes, #admin/...) e barra
   lateral: cada rota abre a sua página, e a barra lateral recebe o índice e o controle de data da página aberta. A
   partida (iniciar) é chamada por principal.js. */
import { contexto } from "./contexto.js";
import { D, NEd } from "./dados_embutidos.js";
import { $, $$, DESKTOP, esc } from "./base.js";
import { paginaSIN } from "./sin.js";
import { paginaGrande } from "./bacia.js";
import { abrirFichaRota, redesenharFicha } from "./ficha_sin.js";
import { paginaInicio } from "./inicio.js";
import { paginaEstadoNE, paginaNE } from "./ne.js";
import { paginaFichaNE } from "./ficha_ne.js";
import { paginaOutros } from "./outros.js";
import { paginaCantareira } from "./cantareira.js";
import { paginaSistemaOS } from "./outros_sistemas.js";
import { paginaFichaOS } from "./ficha_outros.js";
import { paginaDados } from "./dados.js";
import { paginaAPI } from "./api.js";
import { paginaGuia } from "./guia.js";
import { paginaAdmin } from "./admin/admin_nucleo.js";
import { extrasPublicos } from "./admin/admin_telas.js";

/* Barra lateral (desktop): recebe o índice da página (clonado do nav.indice que cada página monta), o contexto
   do nível abaixo do módulo e o controle de data da página. No celular tudo fica no lugar original. */
let obsSecoes = null;
function montarFaixa(novaPagina) {
  const ind = $(".indice"),
    lat = $(".lateral-indice"),
    pe = $(".lateral-pe");
  if (novaPagina) $$(".lateral-pe .barra-data").forEach(b => b.remove()); // controle da página anterior
  const barra = $("#titulo-pag .barra-data") || $(".barra-data");
  if (obsSecoes) {
    obsSecoes.disconnect();
    obsSecoes = null;
  }
  if (!DESKTOP()) {
    if (barra && barra.parentElement === pe) $("#titulo-pag").append(barra);
    lat.hidden = true;
    lat.innerHTML = "";
    return;
  }
  lat.innerHTML = "";
  if (!ind) {
    lat.hidden = true;
  } else {
    let ctx = "";
    const trilha = $("#titulo-pag .trilha");
    if (trilha) {
      const elos = $$("a", trilha),
        atual = (trilha.lastChild.textContent || "").trim();
      if (elos.length > 1 && atual) {
        // há nível abaixo do módulo (estado, bacia, ficha)
        const pai = elos[elos.length - 1];
        ctx = `<a class="voltar" href="${pai.getAttribute("href")}"><svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>Voltar para ${esc(pai.textContent)}</a>`;
      }
    }
    lat.innerHTML =
      `${ctx}<span class="rot">Nesta página</span>` +
      $$("a", ind)
        .map(
          (a, i) =>
            `<a href="${a.getAttribute("href")}" data-alvo="${a.dataset.alvo}"><i>${i + 1}</i>${esc(a.textContent)}</a>`
        )
        .join("");
    const elos = $$("a[data-alvo]", lat);
    elos.forEach(
      a =>
        (a.onclick = e => {
          e.preventDefault();
          const alvo = document.getElementById(a.dataset.alvo);
          if (alvo) alvo.scrollIntoView({ behavior: "smooth", block: "start" });
        })
    );
    lat.hidden = false;
    // seção visível marcada no índice
    const secoes = elos.map(a => document.getElementById(a.dataset.alvo)).filter(Boolean);
    if ("IntersectionObserver" in window && secoes.length) {
      const marcar = () => {
        const y = window.scrollY + 120;
        let atual = secoes[0];
        secoes.forEach(sec => {
          if (sec.offsetTop <= y) atual = sec;
        });
        elos.forEach(a => a.classList.toggle("ativo", a.dataset.alvo === atual.id));
      };
      obsSecoes = new IntersectionObserver(marcar, { rootMargin: "-30% 0px -60% 0px" });
      secoes.forEach(sec => obsSecoes.observe(sec));
      window.addEventListener("scroll", marcar, { passive: true });
      marcar();
    }
  }
  if (barra && barra.parentElement !== pe) pe.prepend(barra);
}

let modRota = null;
function rota() {
  const h = decodeURIComponent(location.hash.slice(1));
  // a data de referência vale dentro do módulo; ao sair dele, volta ao padrão (Anexo I, 1, "Data de referência")
  const modH = h.startsWith("ne")
    ? "ne"
    : h.startsWith("outros")
      ? "outros"
      : h === "sin" || h.startsWith("bacia/") || h.startsWith("ficha/")
        ? "sin"
        : "fora";
  if (modH !== modRota) {
    contexto.refSIN = null;
    contexto.dataRef = NEd.data;
    contexto.sisOS = null;
    modRota = modH;
  }
  if (h === "bacia/GRANDE") paginaGrande();
  else if (h.startsWith("ficha/")) abrirFichaRota(h.slice(6));
  else if (h === "ne") paginaNE();
  else if (h.startsWith("ne/ficha/")) paginaFichaNE(h.slice(9));
  else if (h.startsWith("ne/")) paginaEstadoNE(h.slice(3));
  else if (h === "sin") paginaSIN();
  else if (h === "outros") paginaOutros();
  else if (h === "outros/cantareira") paginaCantareira();
  else if (h === "outros/df" || h === "outros/rmbh") paginaSistemaOS(h.slice(7));
  else if (h.startsWith("outros/ficha/")) paginaFichaOS(h.slice(13));
  else if (h === "dados") paginaDados();
  else if (h === "api") paginaAPI();
  else if (h === "componentes") paginaGuia();
  else if (h === "admin" || h.startsWith("admin/")) paginaAdmin(h.slice(6));
  else paginaInicio();
  extrasPublicos(h);
  const mod =
    h === "" || h === "inicio"
      ? "inicio"
      : h === "componentes"
        ? "guia" // página de desenvolvimento: nenhum módulo marcado
        : h === "dados" || h === "api"
          ? "dados"
          : h.startsWith("admin")
            ? "admin"
            : h.startsWith("ne")
              ? "ne"
              : h.startsWith("outros")
                ? "outros"
                : "sin";
  $$(".modulos button").forEach(b => {
    if (b.dataset.rota === mod) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  });
  document.body.classList.toggle("na-inicio", mod === "inicio");
  window.scrollTo(0, 0);
  document.body.classList.remove("rolado");
  montarFaixa(true);
}
// partida da aplicação, chamada por principal.js depois que todos os módulos carregaram: eventos da janela, botões
// dos módulos, fontes do rodapé e a primeira página
function iniciar() {
  window.addEventListener("scroll", () => document.body.classList.toggle("rolado", window.scrollY > 8), {
    passive: true
  });
  window.addEventListener("resize", () => montarFaixa());
  $$("[data-rota]").forEach(
    b =>
      (b.onclick = () => {
        location.hash = b.dataset.rota;
      })
  );
  $("#rodape-fontes").textContent =
    `Fontes: ${D.fontes.medicoes}; ${D.fontes.equivalente}; ${D.fontes.cadastro}; ${D.fontes.contornos}.`;
  window.addEventListener("hashchange", rota);
  // largura mudou: refaz os gráficos da página aberta, 200 ms depois do último evento
  let rz;
  window.addEventListener("resize", () => {
    clearTimeout(rz);
    rz = setTimeout(() => {
      if (location.hash.startsWith("#outros/") && contexto.redesenharOS) {
        contexto.redesenharOS();
        return;
      }
      if (location.hash.includes("ficha")) {
        redesenharFicha();
        return;
      }
      if (!location.hash.includes("bacia") && $("#g-equiv") && contexto.redesenharSIN) contexto.redesenharSIN();
    }, 200);
  });
  rota();
}

export { iniciar, montarFaixa, rota };
