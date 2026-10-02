# Montador de Provas da Malu

Ferramenta para o **professor montar a prova pronta para imprimir**. Ele escolhe
um modelo, escreve ou cola as questões e imprime (ou salva em PDF) a prova já no
formato da escola. A paginação, as duas colunas, o quadro de instruções e o
gabarito ficam por conta do app.

Roda inteiro dentro do navegador: nada é enviado para servidor. As provas ficam
guardadas no próprio navegador (IndexedDB) e se salvam sozinhas a cada
alteração. Para levar uma prova a outro computador ou entregá-la à coordenação,
use **Exportar**, que gera um `.json`, e **Importar prova** do outro lado.

## Os modelos

O modelo decide o **formato**; o conteúdo é sempre do professor.

| Modelo | O que é |
| --- | --- |
| **Avaliação Bimestral Malu** 🔒 | O modelo **fixo**, no formato da prova bimestral da escola. Não se edita nem se apaga, e toda prova feita com ele segue a versão atual do app. |
| **Avaliação Parcial** | Modelo de exemplo, editável: cabeçalho completo (escola, aluno, professor, turma, data, nota), instruções curtas e duas colunas, sem gabarito. |
| **Modelos próprios** | Criados em *Criar modelo*, como *variação* do bimestral ou com *Salvar este formato como modelo* a partir de uma prova. Ficam guardados neste navegador. |
| **Prova do zero** | Formato livre e nenhuma seção pronta. |

A flexibilidade dentro do modelo fixo está no conteúdo: série, área, bimestre,
seções (que nascem com as disciplinas da área — Biologia, Física e Química em
Ciências da Natureza, por exemplo), questões objetivas e discursivas, fontes,
imagens. Se uma prova precisar de outro formato, **Fazer uma cópia com formato
livre** a desliga do modelo fixo, sem mexer na original.

Um modelo pode ajustar: cabeçalho (faixa para o Identificador, cabeçalho
completo ou nenhum), quadro de instruções e o texto dele, gabarito com bolhas,
uma ou duas colunas, linha entre as colunas, corpo da letra, quatro ou cinco
alternativas, estilo das letras (`a)`, `A)`, `(A)`), numeração (`01.`, `1.`,
`QUESTÃO 01`) e o número da página no pé. Também diz com que seções e com que
nome a prova nasce (`{componente}` e `{disciplina}` são trocados pelo nome).

## A Avaliação Bimestral e o Identificador de Provas

A prova bimestral sai do Montador para o [Identificador de Provas](../provas/),
que cola o cabeçalho com o nome do aluno, a turma e o QR. Por isso a primeira
página do modelo fixo traz, no alto, uma **faixa em branco** de 19 × 3 cm a 1 cm
da borda — exatamente onde o Identificador cola, por padrão, o cabeçalho de
19 × 2,8 cm. Na tela a faixa aparece hachurada, com um aviso; na impressão sai
em branco.

Logo abaixo vem o quadro de **Instruções**, da largura da faixa, e as duas
colunas. A primeira coluna abre com o **GABARITO (NÃO RASURE)**:

- o *Núm. da lista* com dois dígitos para marcar;
- o rótulo da série e da área (`2º Ano` / `C.N.`);
- as questões em blocos de cinco, com `A B C D E` em cima, de 1 a 14 na
  primeira coluna, de 15 a 40 na segunda e de 41 em diante na terceira, como na
  prova impressa da escola (até 65 questões);
- as marcas quadradas de alinhamento em quatro fileiras verticais, de cinco em
  cinco linhas.

A grade tem **sempre o mesmo tamanho e as marcas sempre no mesmo lugar**,
qualquer que seja o número de questões: só muda quantas linhas têm bolhas. A
questão discursiva aparece na grade com o número e a palavra *discursiva*, sem
bolhas.

O PDF sai com o nome `PROVA-2026-B3-2S-NAT.pdf` (ano, bimestre, série e área),
pronto para subir no Identificador.

## Escrevendo as questões

- Cada **linha** do enunciado é um parágrafo.
- Marcação sem botão: `**negrito**`, `*itálico*`, `H~2~O` (índice), `x^2^`
  (expoente). Um marcador sem par sai como foi digitado; `\*` é um asterisco.
- A **fonte** (Enem, Uece…) vai num campo próprio e sai entre parênteses depois
  do número.
- **Imagem**: botão da questão ou Ctrl+V no enunciado. Entra reduzida a até
  1600 px e pode ocupar a coluna toda, 80, 60 ou 40% dela.
- A bolinha ao lado da alternativa marca a **resposta certa**. Ela nunca vai
  para a prova; vai para o **Gabarito do professor**, uma folha à parte com a
  resposta de cada questão.
- **Colar questões** lê de uma vez o que vem do Word, de um PDF ou de um banco
  de questões: `01. (Uece) …`, alternativas `a)` a `e)` (inclusive todas numa
  linha só), um título em maiúsculas (`BIOLOGIA`) abre uma seção e
  `Gabarito: C` marca a resposta. Uma questão nova só começa no número
  seguinte ao da anterior, e um `a)` que reaparece devolve as "alternativas"
  anteriores ao enunciado — assim listas como `1. esquistossomose; 2. teníase`
  ou `a) ingestão de ovos` dentro do enunciado não se partem em questões.
  Linha quebrada pelo PDF é emendada na anterior.

Antes de imprimir, o painel *Antes de imprimir, confira* aponta questões sem
enunciado, alternativas vazias e respostas não marcadas.

## A paginação

A prova vira uma fila de blocos (título de seção, parágrafos, imagem,
alternativas, linhas de resposta) e cada bloco entra na coluna da vez. Quem
mede é o próprio navegador — o bloco é posto na coluna e, se passou do fim,
sai —, então a prévia é exatamente o que sai na impressora. Como na prova da
escola, um parágrafo longo pode começar no pé de uma coluna e continuar na
seguinte (quebra por palavra, com a última linha justificada e pelo menos duas
linhas de cada lado), e um título de seção ou o começo de uma questão nunca fica
sozinho no fim da coluna. A prévia avisa se a prova fica com número ímpar de
páginas.

A impressão usa o próprio navegador: **Imprimir / salvar PDF** abre a janela de
impressão já em A4, sem margens do navegador (as margens são da folha). Para
gerar o arquivo, escolha *Salvar como PDF*. A letra é Arial (ou Liberation Sans
/ Arimo, de mesma medida, onde não houver Arial).

## Publicação

Como o Identificador, roda de dois jeitos sem mudar nada:

- **Dentro do Painel do Colaborador**, em `/montar/` — o card 📝 do painel. O
  `vercel.json` da raiz dá `no-cache` a `/montar` e `/montar/`.
- **Como site próprio** — projeto na Vercel apontando para este repositório com
  **Root Directory = `montar`** e *Framework Preset* **Other**. Valem o
  `montar/vercel.json` e o `montar/.vercelignore`. Na raiz do domínio o link
  "Voltar ao Painel" some sozinho.

## Como está feito

HTML, CSS e JavaScript sem framework, sem build e sem biblioteca de fora.

| Arquivo | Para que |
| --- | --- |
| `js/texto.js` | marcação (negrito, itálico, índice, expoente) e divisão em palavras |
| `js/modelos.js` | modelo fixo, modelos guardados (localStorage), criação da prova, numeração |
| `js/gabarito.js` | a grade de respostas em SVG, em milímetros |
| `js/importar.js` | leitura das questões coladas |
| `js/paginar.js` | as folhas A4: blocos, colunas, quebra de parágrafo, folha de correção |
| `js/armazem.js` | as provas guardadas (IndexedDB) |
| `js/app.js` | as telas |
| `folha.css` | a folha impressa |
| `app.css` | a interface |

## Testes

```bash
node --test montar/test/montar.test.cjs   # 18 testes: marcação, modelos, gabarito, colagem
node montar/test/montar-browser.mjs        # 32 verificações na tela, com Chromium
```

O teste de navegador precisa do `playwright` (global serve). Ele monta uma
Avaliação Bimestral colando `test/questoes-exemplo.txt` (as questões de
Biologia da prova de exemplo), confere a posição e o tamanho da faixa, o
gabarito, as colunas e o salvamento, gera o PDF como a impressão do navegador
gera e testa a prova do zero e o editor de modelos. Os PDFs e uma captura da
tela ficam em `test/saida/`.
