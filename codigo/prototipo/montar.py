# -*- coding: utf-8 -*-
"""Monta o protótipo num arquivo só (prototipo.html), a partir do código dividido por responsabilidade:

  pagina.html        esqueleto da página, com os marcadores /*__CSS__*/, /*__DADOS__*/ e /*__JS__*/
  css/*.css          estilo, na ordem de CSS abaixo (a ordem é a da cascata: não trocar sem conferir a página)
  js/*.js            código em módulos ES (import e export explícitos); js/principal.js é o ponto de entrada e dá a
                     ordem de carga. Aqui os módulos são juntados nessa ordem, sem os import e export, dentro de uma
                     função (escopo próprio, modo estrito), e a partida (iniciar) vai no fim. A página de
                     desenvolvimento, dev.html, carrega os mesmos módulos direto, sem montagem.
  js/admin/*.js      área administrativa (simulação sem servidor)
  dados.json     dados embutidos (gerados pelos preparar_*.py a partir das coletas de ../dados)
  assets/            logotipo da ANA e CSS do Leaflet

Também copia as fichas das usinas com resolução da ANA (../dados/fichas_sin) para fichas/, que a página carrega
sob demanda, e preenche na área administrativa os textos originais das páginas (para a volta ao original) e a
correspondência de códigos das fontes do Nordeste (../dados/referencias/depara_ne.json).

Uso: py montar.py"""
import json, re, shutil
from pathlib import Path

AQUI = Path(__file__).parent
CSS = ["base.css", "faixa.css", "componentes.css", "dados.css", "api.css", "recolhiveis_e_mapa_lista.css", "inicio.css", "ne.css",
       "bacia_e_ficha.css", "geral_e_celular.css", "outros.css", "tema_b2.css", "inicio_sem_barra.css", "admin.css", "guia.css"]
# ordem de carga dos módulos: a de js/principal.js (import "./x.js" e, por último, o módulo que exporta iniciar)
PRINCIPAL = (AQUI / "js" / "principal.js").read_text(encoding="utf-8")
JS = re.findall(r'^import (?:\{ iniciar \} from )?"\./([\w/]+\.js)";', PRINCIPAL, flags=re.M)
IMPORT = re.compile(r'^import \{[^}]*\} from "[^"]+";\n', flags=re.M)
EXPORT = re.compile(r'^export \{[^}]*\};\n', flags=re.M)


def sem_modulo(f):
    """O arquivo sem os import e o export, para entrar no escopo único da página montada."""
    s = (AQUI / "js" / f).read_text(encoding="utf-8")
    s2 = EXPORT.sub("", IMPORT.sub("", s))
    assert not re.search(r"^(import|export)\b", s2, flags=re.M), f"{f}: import ou export fora do padrão"
    return s2


DECL = re.compile(r"^(?:(?:async )?function\*? (\w+)|(?:const|let|var|class) (\w+)|(?:const|let) \{([^}]*)\})", flags=re.M)


def nomes_unicos():
    """Na página montada todos os módulos dividem um escopo: nome de topo repetido entre arquivos quebraria a página
    (em módulos nativos ele passaria, cada arquivo tem o seu). Recusa a montagem se houver repetição."""
    dono = {}
    for f in JS:
        for fn, var, padrao in DECL.findall((AQUI / "js" / f).read_text(encoding="utf-8")):
            nomes = [fn or var] if fn or var else [p.split(":")[-1].strip() for p in padrao.split(",") if p.strip()]
            for n in nomes:
                assert n not in dono, f"nome de topo repetido: {n} em {dono[n]} e em {f} (renomear um deles)"
                dono[n] = f
    return len(dono)
# correspondência FUNCEME/AESA/APAC -> código do SAR: cópia da skill fontes-hidrologicas (references/depara_ne.json),
# guardada no repositório para o protótipo montar em qualquer máquina; atualizar a cópia quando a skill mudar
DEPARA = AQUI.parent / "dados" / "referencias" / "depara_ne.json"


def textos_originais(js):
    """Texto de apresentação de cada página, tirado do próprio código (a área administrativa mostra e restaura)."""
    pad = {}
    for k, pat in [("inicio", r'<p class="lead-hero">(Acompanhe.*?)</p>'),
                   ("sin", r'<section class="cartao intro" aria-label="Sobre o módulo">\s*<p>(O Sistema Interligado Nacional.*?)</p>'),
                   ("ne_lead", r'<p class="lead">(Açudes dos nove.*?)</p>'),
                   ("ne_intro", r'<p>(Os reservatórios do semiárido não são medidos.*?)</p>'),
                   ("outros", r'<section class="cartao intro" aria-label="Sobre o módulo"><p>(Três sistemas.*?)</p>'),
                   ("cantareira", r'<p class="lead">(Jaguari-Jacareí.*?)</p>'),
                   ("dados", r'<p class="lead">(Escolha os reservatórios.*?)</p>')]:
        m = re.findall(pat, js, flags=re.S)
        assert len(m) == 1, (k, len(m))
        pad[k] = m[0].replace("${NEd.limiar_dias}", "{janela_ne}")
        assert "${" not in pad[k], k
    return pad


CARGA_DEV = """<script type="module">
  // Página de desenvolvimento: os módulos de js/ carregados direto, sem montagem (servir a pasta mockups/prototipo com
  // py -m http.server e abrir dev.html). Os dados e o logotipo, que o montar.py embute na página publicada, são lidos
  // do servidor; o resto é o mesmo código de prototipo.html.
  const [dados, admin, logo] = await Promise.all(
    ["dados.json", "dados_admin.json", "assets/logo_ana_horizontal.svg"].map(u => fetch(u).then(r => r.text()))
  );
  for (const [id, texto] of [["dados-prototipo", dados], ["dados-admin", admin]]) {
    const marca = Object.assign(document.createElement("script"), { type: "application/json", id });
    marca.textContent = texto;
    document.body.append(marca);
  }
  document.querySelector(".marca .logo").innerHTML = logo.slice(logo.indexOf("<svg"));
  await import("./js/principal.js");
</script>"""


def pagina_dev(pag):
    """dev.html: o esqueleto com os CSS e os módulos ligados por endereço, sem nada embutido."""
    trocas = [("<style>/*__LEAFLET_CSS__*/</style>", '<link rel="stylesheet" href="assets/leaflet.min.css">'),
              ("<style>\n/*__CSS__*/\n</style>", "\n".join(f'<link rel="stylesheet" href="css/{f}">' for f in CSS)),
              ("/*__LOGO__*/", ""),
              ('<script type="application/json" id="dados-prototipo">/*__DADOS__*/</script>', ""),
              ('<script type="application/json" id="dados-admin">/*__ADMIN__*/</script>', ""),
              ("<script>\n/*__JS__*/\n</script>", CARGA_DEV)]
    for a, b in trocas:
        assert pag.count(a) == 1, a
        pag = pag.replace(a, b)
    (AQUI / "dev.html").write_text(pag, encoding="utf-8")


def montar():
    css = "".join((AQUI / "css" / f).read_text(encoding="utf-8") for f in CSS)
    # os arquivos são trechos de uma função só: escopo próprio (nada vai para window) e modo estrito
    nomes_unicos()
    js = '(function(){\n"use strict";\n' + "".join(sem_modulo(f) for f in JS) + "iniciar();\n})();\n"
    # dados da área administrativa (correspondência de códigos das fontes do NE e textos originais das páginas):
    # dados_admin.json, que a página publicada embute e a dev.html lê do servidor
    admin = json.dumps({"depara": json.loads(DEPARA.read_text(encoding="utf-8")), "textos": textos_originais(js)},
                       ensure_ascii=False)
    (AQUI / "dados_admin.json").write_text(admin, encoding="utf-8")
    logo = (AQUI / "assets" / "logo_ana_horizontal.svg").read_text(encoding="utf-8")
    logo = logo[logo.index("<svg"):]                      # sem a declaração XML e o comentário do Illustrator
    dados = (AQUI / "dados.json").read_text(encoding="utf-8").replace("</", "<\\/")
    pag = (AQUI / "pagina.html").read_text(encoding="utf-8")
    pagina_dev(pag)
    for marca, valor in (("/*__CSS__*/", css), ("/*__JS__*/", js)):
        assert pag.count(marca) == 1, marca
        pag = pag.replace(marca, valor)
    for marca, valor in (("/*__DADOS__*/", dados), ("/*__ADMIN__*/", admin.replace("</", "<\\/")), ("/*__LOGO__*/", logo),
                         ("/*__LEAFLET_CSS__*/", (AQUI / "assets" / "leaflet.min.css").read_text(encoding="utf-8"))):
        assert marca in pag, marca
        pag = pag.replace(marca, valor)
    saida = AQUI / "prototipo.html"; saida.write_text(pag, encoding="utf-8")
    print(saida.name, round(saida.stat().st_size / 1024), "KB")
    origem, destino = AQUI.parent / "dados" / "fichas_sin", AQUI / "fichas"; destino.mkdir(exist_ok=True)
    fichas = [f for f in origem.glob("*.json") if f.name != "indice.json"]
    for f in fichas: shutil.copy2(f, destino / f.name)
    print("fichas copiadas:", len(fichas))


if __name__ == "__main__":
    montar()
