# ProvaShow Malu

Avaliação em tempo real com **cartões de papel**: o professor faz uma pergunta,
cada aluno gira o seu cartão para deixar em cima a letra que escolheu (A, B, C
ou D) e levanta; o professor passa a câmera do celular pela turma e as
respostas aparecem na hora no telão e ficam guardadas nos relatórios. Só o
professor usa aparelho (ou, numa aula remota/híbrida, os alunos de casa
respondem pelo próprio aparelho).

É uma recriação, feita do zero, do conjunto de funções do app e do site do
Plickers, com código, desenho de cartão e identidade próprios — e com melhorias
(marcadas com ★ abaixo).

## As partes

| Endereço | O que é |
| --- | --- |
| `provashow/` | **Site**: como funciona, recursos, no celular ou no computador, cartões, dúvidas. |
| `provashow/app/` | **App do professor** — computador **ou celular** (PWA instalável, funciona sem internet). |
| `provashow/scanner/?sala=CÓDIGO` | **Scanner**: outro celular lendo os cartões e comandando a aula aberta no computador. |
| `provashow/telao/?sala=CÓDIGO` | **Telão** (projetor/TV). |
| `provashow/aluno/?k=CHAVE` | **Modo aluno**: responder pelo próprio aparelho (aula remota/híbrida). |
| `provashow/cartoes/` | **Cartões para imprimir**. |
| `provashow/ajuda/` | **Central de ajuda**, com busca. |
| `provashow/nativo/` | **App nativo** Android/iOS (Capacitor), o mesmo app embalado — veja o README de lá. |

## Funções

**Biblioteca** — conjuntos de perguntas; pastas dentro de pastas; busca (sem
acento); lixeira de 30 dias e "Desfazer"; mover, duplicar; ★ pacotes exportados
em arquivo para levar a colegas ou outro computador; ★ Explorar, uma biblioteca
pública de pacotes prontos.

**Editor** — avaliada ou enquete; ★ mais de uma resposta certa; 2 a 4
alternativas; Verdadeiro/Falso; negrito, itálico, sublinhado, expoente, índice;
equações em LaTeX com assistente e prévia (KaTeX → MathML); imagem e gif, vídeo
do YouTube com início e fim, áudio gravado no microfone ou de arquivo; layout da
mídia (esquerda/centro/direita, caber/preencher); imagens nas alternativas;
★ embaralhar alternativas por aula; prévia do slide; imprimir perguntas;
atalhos de teclado; colar várias perguntas com prévia, escolha do número de
alternativas e "tirar este texto" — ★ também de planilha e com várias certas.

**Turmas** — até 63 alunos; colar a lista; trocar o número do cartão (troca com o
colega); arquivar aluno (sai da chamada, resultados ficam); cor; arquivar turma;
★ duplicar turma para o ano seguinte; fila do que será apresentado; aulas dadas;
links pessoais (com QR para imprimir) para o modo aluno.

**Cartões** — 63 cartões, 1/2/4/★9 por folha, padrão ou discreto (letras
pequenas), com ou sem os nomes da turma. Código 5×5 próprio com correção de até
2 casas.

**Aula ao vivo** — telão por código; ★ leitura pela câmera do próprio aparelho
do app (celular ou webcam) ou por outros celulares; ler/pausar; lanterna, zoom,
trocar câmera, ★ bipe e vibração; ★ cartões levantados desde a pergunta anterior
ficam em espera; gráfico e resposta certa (no app ou no celular); cronômetro ou
contagem regressiva no telão, ★ com encerramento automático das respostas;
★ travar respostas; lista de alunos no telão durante a leitura/sempre/nunca, com
ou sem as respostas individuais; resposta lançada à mão; ★ ler de novo (zera
também os scanners); atalhos de teclado; modo aluno simultâneo (híbrido);
ao encerrar, ★ tirar da fila e abrir o relatório.

**Telão** — pergunta com mídia, cronômetro, contagem, chamada, gráfico,
resposta; tela cheia; ampliar imagem; modo tela compartilhada.

**Relatórios** — placar aluno × pergunta por período (hoje/semana/mês/
bimestre/ano/tudo/datas), ordenado por nome, nota ou cartão; ★ tirar pergunta da
nota e corrigir o gabarito de uma aula; detalhe da pergunta com a resposta de
cada aluno e a origem (cartão, aparelho, à mão); imprimir; CSV; relatório de
cada aula; relatório do aluno imprimível, um ou a turma toda; ★ perguntas para
retomar.

**Dados e login** — ★ entrada com a conta do Montador de Provas (Supabase Auth;
só quem tem perfil ativo em `montador_perfis` entra; a gestão cria as contas e
redefine senhas); "Lembrar neste aparelho" opcional; trocar senha pedindo a
atual. ★ Tudo vai para a nuvem da escola (`provashow_itens`) e fica também no
aparelho (IndexedDB, uma cópia por conta) para funcionar sem internet: o app
baixa, junta (vence a alteração mais nova) e envia o que falta a cada mudança,
a cada 45 s e ao voltar a conexão. ★ Nada se apaga na nuvem: não existe DELETE
(nem política nem permissão), apagar no app só marca `removido`, e toda versão
anterior de turma, aula e sessão vai para `provashow_versoes`. ★ A gestão vê os
relatórios de todos os professores em Mais → "Relatórios da escola". Sair pode
apagar a cópia do aparelho (computador compartilhado). Cópia de segurança em
arquivo continua (juntar ou substituir).

## Webapp no celular ou app nativo?

As duas possibilidades estão prontas:

1. **Webapp (PWA)** — `provashow/app/` funciona inteiro no celular: biblioteca,
   turmas, aula ao vivo com a câmera do próprio celular e relatórios. "Adicionar à
   tela inicial" (Android/iPhone) instala; depois da primeira abertura funciona
   sem internet (`sw.js`). O telão, num computador ligado ao projetor, recebe tudo
   pelo código da aula.
2. **Nativo (Capacitor)** — `provashow/nativo/` embala o mesmo app para Android e
   iOS; `.github/workflows/provashow-android.yml` gera o APK no GitHub.

## Como funciona por dentro

- `js/cartao.js` — os 63 códigos (quatro posições de cada cartão a ≥ 6 casas
  umas das outras) e o SVG para imprimir.
- `js/leitor.js` — leitura no aparelho: limiar adaptativo, manchas, cantos,
  homografia, leitura das casas; ~25 ms para 30 cartões num quadro 640×480.
- `js/camera.js` — câmera, confirmação em dois quadros, espera de cartões da
  pergunta anterior, lanterna/zoom, marcas na tela. Usado pelo app e pelo scanner.
- `js/canal.js` — o canal da aula: `BroadcastChannel` (mesmo aparelho) + Supabase
  Realtime Broadcast (aparelhos diferentes), sem tabelas, nada gravado. Pelo
  canal vão a pergunta da vez, os números dos cartões, o primeiro nome e a inicial
  do sobrenome; a resposta certa só depois de revelada e a letra de cada aluno só
  depois do gráfico. Imagens e áudios só pela via local.
- `js/dados.js` — modelo (pastas, conjuntos, pacotes, turmas, aulas, sessões),
  migração da versão 1, relatórios, períodos, colar perguntas, embaralhar,
  pacotes, junção para a sincronização.
- `js/nuvem.js` — login e sincronização com o Supabase; `supabase/001_provashow.sql`
  — tabelas, gatilhos (versão mais velha não sobrescreve a nova; histórico) e RLS.
- `js/armazem.js` (IndexedDB), `js/texto.js` (marcação + LaTeX), `js/midia.js`,
  `js/slide.js` (o slide comum ao telão, à prévia e à aula), `js/explorar.js`.
- `app/js/` — núcleo, biblioteca, editor, turmas, aula, relatórios, ajustes,
  conta (login, selo da nuvem, relatórios da escola).

> O canal pela internet usa canais públicos do Realtime: quem souber o código
> entra enquanto a aula durar; o código é aleatório e muda a cada aula. As
> respostas pelo aparelho exigem a chave pessoal do aluno, que só o professor
> distribui.

## Testes

```bash
node --test provashow/test/provashow.test.cjs   # cartões, leitor, dados, relatórios, texto, mídia
node provashow/test/provashow-browser.mjs       # ponta a ponta no Chromium (playwright)
```

O teste de navegador usa uma câmera falsa do Chromium com cartões levantados e
percorre site, ajuda, biblioteca, editor, turma, aula ao vivo (telão + scanner +
aluno pelo aparelho), relatórios, cartões e a aula feita só no celular.
Capturas e o PDF dos cartões ficam em `provashow/test/saida/`.
