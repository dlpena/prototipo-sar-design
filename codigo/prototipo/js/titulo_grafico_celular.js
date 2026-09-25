/* Título de gráfico que não cabe na largura (celular): quebra em linhas, e o resto do desenho
   desce (19/09/2026). */
import { svgEl } from "./base.js";

function quebraRotuloSVG(svg) {
  if (svg.dataset.rotOk) return;
  svg.dataset.rotOk = "1";
  const vb = svg.viewBox && svg.viewBox.baseVal;
  if (!vb || !vb.width) return;
  const rot = [...svg.querySelectorAll("text")].find(
    e =>
      e.getAttribute("y") === "16" && e.getAttribute("font-weight") === "700" && e.getAttribute("font-size") === "13.5"
  );
  if (!rot || rot.querySelector("tspan")) return;
  const x = +rot.getAttribute("x"),
    larg = vb.width - x - 6,
    cw = 7.2,
    txt = rot.textContent;
  if (txt.length * cw <= larg) return;
  const L = [""];
  txt.split(" ").forEach(p => {
    const c = (L[L.length - 1] + " " + p).trim();
    if (c.length * cw > larg && L[L.length - 1]) L.push(p);
    else L[L.length - 1] = c;
  });
  const dy = 15 * (L.length - 1),
    g = svgEl("g", { transform: `translate(0,${dy})` });
  svg.append(rot);
  [...svg.childNodes].filter(n => n !== rot && n.nodeName !== "defs").forEach(n => g.append(n));
  svg.insertBefore(g, rot);
  rot.textContent = "";
  L.forEach((l, i) => {
    const s = svgEl("tspan", { x, dy: i ? 15 : 0 });
    s.textContent = l;
    rot.append(s);
  });
  svg.setAttribute("viewBox", `${vb.x} ${vb.y} ${vb.width} ${vb.height + dy}`);
}
new MutationObserver(ms =>
  ms.forEach(m =>
    m.addedNodes.forEach(n => {
      if (n.nodeType !== 1) return;
      (n.tagName === "svg" ? [n] : [...n.querySelectorAll("svg")]).forEach(s => {
        if (s.closest(".leaflet-container")) return;
        quebraRotuloSVG(s);
      });
    })
  )
).observe(document.getElementById("conteudo"), { childList: true, subtree: true });
