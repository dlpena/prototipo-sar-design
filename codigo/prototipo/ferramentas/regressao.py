# -*- coding: utf-8 -*-
"""Teste de regressão do protótipo: registra o estado das 55 páginas e compara duas execuções.

  py regressao.py registrar <pasta>          # grava textos visíveis, arquivos exportados e capturas das páginas
  py regressao.py comparar <antes> <depois>  # aponta o que mudou entre dois registros

O protótipo tem de estar servido em http://127.0.0.1:8779/ junto com auditoria.html (que já percorre as rotas, lê o
texto de cada página e clica em todos os botões de download). As capturas são de página inteira, em 1366 e 390 px,
com o mapa-base escondido (as imagens do OpenStreetMap variam de uma carga para outra). Nas telas da área
administrativa, o painel de integrações depende da hora; diferenças ali são esperadas."""
import json, re, sys
from pathlib import Path
from PIL import Image, ImageChops
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8779/"
LARGURAS = (1366, 390)
ESCONDE = ".leaflet-tile-pane{visibility:hidden!important} *{animation:none!important;transition:none!important;caret-color:transparent!important}"


def rotas(pg):
    s = (Path(__file__).parent.parent / "auditoria.html").read_text(encoding="utf-8")
    js = s[s.index("const ROTAS = ["):s.index("];", s.index("const ROTAS = [")) + 2]
    return pg.evaluate("() => { " + js + " return ROTAS; }")


def registrar(pasta):
    pasta = Path(pasta); (pasta / "telas").mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch(channel="msedge")
        pg = b.new_page(viewport={"width": 1500, "height": 1000})
        if not (pasta / "auditoria.json").exists():
            pg.goto(BASE + "auditoria.html?w=1366&textos=1&baixar=1")
            pg.wait_for_function("window.RESULTADO", timeout=1_800_000, polling=2000)
            json.dump({"resultado": pg.evaluate("window.RESULTADO"), "textos": pg.evaluate("window.TEXTOS")},
                      open(pasta / "auditoria.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        if not (pasta / "auditoria390.json").exists():   # celular: estouro de largura e rolagem interna
            pg.goto(BASE + "auditoria.html?w=390")
            pg.wait_for_function("window.RESULTADO", timeout=1_800_000, polling=2000)
            json.dump(pg.evaluate("window.RESULTADO"), open(pasta / "auditoria390.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        R = rotas(pg); pg.close()
        for w in LARGURAS:
            pg = b.new_page(viewport={"width": w, "height": 900})
            pg.goto(BASE + "prototipo.html#inicio"); pg.wait_for_timeout(2500)
            for r in R:
                pg.goto(BASE + "prototipo.html#" + r); pg.reload(); pg.add_style_tag(content=ESCONDE); pg.wait_for_timeout(2600)
                pg.screenshot(path=str(pasta / "telas" / f"{w}_{r.replace('/', '__') or 'raiz'}.png"), full_page=True)
            pg.close()
        b.close()
    print("registrado em", pasta)


def comparar(a, b):
    a, b = Path(a), Path(b)
    A, B = json.load(open(a / "auditoria.json", encoding="utf-8")), json.load(open(b / "auditoria.json", encoding="utf-8"))
    print("auditoria 1366 antes:", A["resultado"]["ruins"] or "limpa", "| depois:", B["resultado"]["ruins"] or "limpa")
    if (b / "auditoria390.json").exists():
        print("auditoria 390 depois:", json.load(open(b / "auditoria390.json", encoding="utf-8"))["ruins"] or "limpa")
    for r in A["textos"]:
        if A["textos"][r] != B["textos"].get(r):
            la, lb = A["textos"][r].split("\n"), B["textos"].get(r, "").split("\n")
            so_a = [x for x in la if x not in lb][:4]; so_b = [x for x in lb if x not in la][:4]
            print(f"TEXTO {r}: saiu {so_a} | entrou {so_b}")
    fa, fb = A["resultado"]["arquivos"], B["resultado"]["arquivos"]
    tira = lambda L: [re.sub(r"\(\d+\)", "", x) for x in L]   # tamanho de PNG e PDF varia com a renderização
    for r in fa:
        if tira(fa[r]) != tira(fb.get(r, [])): print(f"ARQUIVOS {r}: {fa[r]} -> {fb.get(r)}")
        else:
            csv = [(x, y) for x, y in zip(fa[r], fb[r]) if ".csv" in x and x != y]
            if csv: print(f"CSV com outro tamanho {r}: {csv}")
    dif = []
    for fa_ in sorted((a / "telas").glob("*.png")):
        fb_ = b / "telas" / fa_.name
        if not fb_.exists(): dif.append((fa_.stem, "sem captura")); continue
        ia, ib = Image.open(fa_).convert("RGB"), Image.open(fb_).convert("RGB")
        if ia.size != ib.size: dif.append((fa_.stem, f"tamanho {ia.size} -> {ib.size}")); continue
        d = ImageChops.difference(ia, ib).convert("L").point(lambda v: 255 if v > 24 else 0)
        n = sum(d.histogram()[255:]); caixa = d.getbbox()
        if n: dif.append((fa_.stem, f"{n} px diferentes em {caixa}"))
    print("telas diferentes:", len(dif)); [print("  ", x) for x in dif]


if __name__ == "__main__":
    {"registrar": lambda: registrar(sys.argv[2]), "comparar": lambda: comparar(sys.argv[2], sys.argv[3])}[sys.argv[1]]()
