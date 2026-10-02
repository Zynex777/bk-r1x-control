# BK-R1X Control

Configurador open-source e offline para o mouse **BK-R1X**, uma alternativa ao app web
oficial (bk-r1x.yjx2012.com).

**Site:** https://zynex777.github.io/bk-r1x-control/ · **Usar no navegador:** https://zynex777.github.io/bk-r1x-control/app/

- DPI (6 estágios), polling rate, lift-off distance, debounce, sensor e energia
- Remapeamento dos 8 botões: cliques, teclas e combinações, mídia ou macros
- Editor de macros com teclado visual (ABNT2), botões do mouse e gravação
- **Ciclos de macro com atalhos globais**: troque a macro de um botão sem sair do jogo
- **Perfis por programa**: ao abrir um jogo ou app, os botões recebem as macros dele; ao fechar, voltam ao padrão
- **5 temas**: Roxo Gótico, Escuro, Claro, Frutiger Aero e Jumpstyle
- Nome e ícone personalizáveis, que também viram o nome e o ícone do programa
- Funciona 100% offline

> [!NOTE]
> **Feito com auxílio de IA.** Este projeto foi desenvolvido com a ajuda de inteligência
> artificial (Claude, da Anthropic): a engenharia reversa do protocolo do mouse, o código e a
> documentação. Ele foi testado em um BK-R1X real, mas não tem nenhuma ligação com o fabricante.
> Use por sua conta e risco (veja a [licença](LICENSE)).

## Instalar

Baixe o `BK-R1X-Control-Setup-x.y.z.exe` na página de **Releases** e execute.

> [!WARNING]
> **O Windows vai mostrar um aviso do SmartScreen ("O Windows protegeu o computador").**
> Isso acontece porque o instalador não tem assinatura digital (um certificado pago), não
> porque haja algo errado com ele. Para continuar, clique em **Mais informações** e depois em
> **Executar assim mesmo**. Se preferir, confira o código-fonte aqui no repositório: o
> instalador da página de Releases é gerado automaticamente a partir dele pelo GitHub Actions.

Depois de instalado, o programa fica na bandeja do Windows (perto do relógio) ao fechar a
janela, para os atalhos de macro continuarem funcionando. Para sair de verdade, clique com
o botão direito no ícone da bandeja e escolha **Sair**.

## Desenvolver

```bash
npm install
npm run dev        # versão web em http://localhost:5173 (Chrome/Edge)
npm run desktop    # versão desktop (Electron) a partir do build
npm run dist       # gera o instalador em release/
npm run icon       # regenera o ícone padrão (build/icon.png)
```

### Publicar uma versão no GitHub

1. Atualize `"version"` no `package.json` e faça commit.
2. Crie e envie a tag: `git tag v1.0.0 && git push origin v1.0.0`
3. O workflow `.github/workflows/release.yml` gera o instalador e cria a Release sozinho.

## Estrutura

| Caminho | Conteúdo |
|---|---|
| `src/driver/protocol_docs.md` | Protocolo HID documentado (engenharia reversa) |
| `src/driver/protocol.ts` | `MouseDriver`: conexão, fila de comandos, config, botões, macros, eventos |
| `src/driver/keycodes.ts` | Tabelas de ações de botão, teclas HID e mídia |
| `src/components/` | Telas: DPI, desempenho, botões, macros, ciclos, dispositivo, teclado visual |
| `src/state/` | Macros, ciclos, perfis por programa, temas e backup (salvos no `localStorage`) |
| `src/hooks/useHotkeys.ts` | Atalhos: locais no navegador, globais no desktop |
| `src/desktop/` | Ponte com o Electron e conversão de atalhos para o Windows |
| `electron/main.cjs` | Janela, WebHID, bandeja, atalhos globais, detecção de programas abertos, nome/ícone nos atalhos do Windows |
| `build/` | Ícone padrão e script extra do instalador NSIS |
| `site/` | Página de apresentação (GitHub Pages; o configurador web vai em `/app/`) |

A pasta `src_web/` (cópia do site oficial, usada só como referência) não é publicada:
é código de terceiros e está no `.gitignore`.

## Depurar pacotes

Na versão web (`npm run dev`), abra o console do navegador e digite `bkr1x.debug = true`.
Todo pacote enviado (`TX`) e recebido (`RX`) passa a aparecer no console.

## Licença

[MIT](LICENSE). Projeto independente, sem ligação com o fabricante do BK-R1X.
