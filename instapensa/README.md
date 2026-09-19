# InstaPensa

Ferramenta para o professor montar um **feed fictício de rede social** (com a
cara do Instagram), projetar em sala e conduzir a leitura das publicações com
texto de apoio e perguntas amarrados a cada post.

Abre pelo Painel do Colaborador (card **📱 InstaPensa**) ou direto em
`/instapensa/`.

## A dinâmica

1. O professor separa de 8 a 10 publicações (imagens e/ou vídeos) e monta o feed.
2. Em cada post ele escreve o **material da aula**: um texto de apoio, as
   perguntas para a turma e links de leitura.
3. Em sala, no modo **Apresentar**, o feed aparece dentro de uma moldura de
   celular e rola post por post pelas setas do teclado. A turma observa, comenta
   e "curte" em voz alta.
4. O professor abre o painel lateral (tecla `M`) e revela as perguntas uma a uma
   (tecla `N`) — ou amplia o material sobre o feed (tecla `A`) para a turma ler.

## Atalhos do modo aula

Cada postagem tem um botão de cérebro que abre sua janela de reflexão, tanto
na prévia do editor quanto na apresentação. A janela mostra o texto e os links
do post e permite revelar as perguntas uma a uma (`N`), mostrar todas (`T`) ou
escondê-las. **Fechar** ou `Esc` retorna à postagem, sem sair da apresentação.

| Tecla | O que faz |
| --- | --- |
| `↓` `→` `Espaço` | próximo post |
| `↑` `←` | post anterior |
| `1`…`9` | vai direto para um post |
| `M` | mostra/esconde o painel da aula |
| `N` | revela a próxima pergunta |
| `T` | mostra todas as perguntas |
| `A` | amplia o material em cima do feed |
| `+` `-` | aumenta/diminui o celular (5 tamanhos) |
| `F` | tela cheia |
| `Esc` | fecha a ampliação ou sai da apresentação |

## Onde os dados ficam

Tudo no navegador do professor, em **IndexedDB** — não há servidor, login nem
envio de dados. As imagens sobem do computador dele e são reduzidas para no
máximo 1600px antes de guardar; vídeos ficam como vieram. Também é possível usar
o endereço de uma imagem/vídeo da internet em vez de subir arquivo.

Para levar um feed de uma máquina para outra (preparou em casa, vai apresentar
na sala) ou passar para outro professor: **Exportar** gera um `.json` com as
mídias embutidas, e **Importar arquivo** lê esse mesmo `.json` na outra máquina.

Ao excluir um feed, as mídias que nenhum outro feed usa são apagadas junto.

## Arquivos

| Arquivo | Papel |
| --- | --- |
| `index.html` | as três telas: biblioteca, editor e modo aula |
| `app.css` | casca do aplicativo (identidade da escola) |
| `feed.css` | aparência do feed imitando o Instagram + moldura de celular |
| `js/db.js` | IndexedDB: feeds, mídias e limpeza de mídias órfãs |
| `js/model.js` | formato dos dados e migração de feeds importados |
| `js/media.js` | entrada de arquivos, redução de imagens, exportar/importar |
| `js/feed.js` | desenho do feed (usado no editor e na projeção) |
| `js/editor.js` | edição dos posts e do material da aula |
| `js/present.js` | modo aula: teclado, painel e navegação |
| `js/demo.js` | feed de exemplo, com imagens desenhadas em SVG |

Sem build e sem dependências: são scripts soltos (`window.FeedAula.*`) na ordem
em que o `index.html` os carrega. As únicas requisições externas são as fontes
do Google (Outfit e Grand Hotel); sem internet, o navegador cai nas fontes do
sistema e o resto continua funcionando.

## Sobre a imitação da interface

É apenas casca visual, para a turma reconhecer o ambiente que já conhece:
não há login, não há conexão com o Instagram e nada é publicado em rede social.
O nome exibido no topo do app é um campo editável do feed (**Perfil e
aparência → Nome no topo do app**), então dá para trocar por outro rótulo,
inclusive um nome inventado para a aula.

## Publicação na Vercel

O projeto Vercel se chama `instapensa` e publica a raiz deste repositório como
site estático, sem build, servidor de aplicação ou variáveis de ambiente.
O `vercel.json` direciona a página inicial para `/instapensa/`; o painel continua
acessível em `/index.html`. As aulas e mídias permanecem no navegador.

A pasta se chama `instapensa/`, mas o nome do banco local (`feed-aula`), as
chaves de preferência e o formato `feed-aula/v1` foram preservados de propósito:
assim as aulas já salvas no navegador e os arquivos exportados pela primeira
versão continuam valendo.

## Verificação

Sirva a raiz do repositório com `python3 -m http.server 8765` e abra
`http://localhost:8765/instapensa/` em uma sessão de navegador de teste.
O arquivo `test/instapensa-browser.js` pode ser executado com
`agent-browser eval --stdin < test/instapensa-browser.js` nessa sessão.
Ele cria aulas de teste e verifica saída imediata do editor, persistência,
imagem local, exportação/importação e apresentação com perguntas e teclado.
