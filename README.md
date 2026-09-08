# Status Bar: Relógios & Pomodoro

Extensão para Google Chrome (Manifest V3) que injeta uma barrinha cinza fixa
no canto inferior direito de qualquer página, com:

- **Dois relógios** configuráveis por fuso horário (clique no horário para trocar).
- **Cronômetro Pomodoro** com ciclos de 25 min de foco / 5 min de pausa,
  sincronizado entre todas as abas abertas.
- **Idioma** da interface configurável (English / Portuguese (Brazil)),
  com **inglês como padrão**.
- **Aparência** configurável: cor de fundo (qualquer cor), 6 níveis de
  transparência (0/20/40/60/80/100%) e cor da fonte (branco ou preto).

A barra usa `position: fixed`, então permanece no canto inferior direito
mesmo com o scroll da página.

## Instalar localmente

1. Abra `chrome://extensions` no Chrome.
2. Ative o **Modo desenvolvedor** (canto superior direito).
3. Clique em **Carregar sem compactação** e selecione a pasta deste repositório.
4. A barra aparece automaticamente em qualquer página aberta/recarregada.

Clique no ícone da extensão na barra de ferramentas para mostrar/ocultar a
barra (ela também pode ser fechada pelo "✕" na própria barra).

## Estrutura

- `manifest.json` — configuração da extensão (Manifest V3).
- `content.js` — content script injetado em todas as páginas; desenha a
  barra dentro de uma Shadow DOM (isolada do CSS da página) e renderiza
  os relógios e o cronômetro a partir do estado salvo em `chrome.storage.local`.
- `background.js` — service worker responsável pelo estado do Pomodoro
  (start/pause/reset via `chrome.alarms`, com notificação ao trocar de
  fase) e por alternar a visibilidade da barra ao clicar no ícone.
- `icons/` — ícones da extensão (16/32/48/128px).

## Configurar os fusos horários

Clique em cima do horário exibido para abrir um seletor com a lista de
fusos horários IANA (ex.: `America/Sao_Paulo`, `Asia/Tokyo`). A escolha é
salva automaticamente e vale para todas as abas.

## Pomodoro

- **▶ / ⏸** inicia ou pausa o ciclo atual (foco ou pausa).
- **⟲** reinicia para um novo ciclo de foco (25:00).
- Ao terminar um ciclo, a extensão dispara uma notificação do sistema e
  alterna automaticamente entre "Foco" e "Pausa" (o próximo ciclo fica
  pronto para iniciar, sem começar sozinho).

## Idioma

Clique no seletor de idioma (mostra "EN" ou "PT-BR") para escolher entre
**English** (padrão) e **Portuguese (Brazil)**. A escolha é salva e afeta
todos os textos da barra (rótulos, placeholders, notificações do Pomodoro)
em todas as abas.

## Aparência

Clique no ícone de controles deslizantes (⚙) para abrir o painel de
aparência:

- **Cor da barra** — qualquer cor, via seletor nativo do navegador.
- **Transparência** — 6 níveis fixos (0%, 20%, 40%, 60%, 80%, 100%).
- **Cor da fonte** — branco ou preto, para manter contraste com a cor
  escolhida.

Tudo é salvo em `chrome.storage.local` e aplicado instantaneamente em
todas as abas abertas.
