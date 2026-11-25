# Identificador de Provas da Malu

Ferramenta para a coordenação **identificar cada prova bimestral com o aluno**:
o app cola na faixa em branco do alto da primeira página um **cabeçalho de
identificação** com o nome do aluno, a série, a turma, o número da lista e um
**código único com QR Code**, de modo que a prova de um não sirva para outro.

O cabeçalho é a única identificação da prova. O campo `ALUNO (A):` e o
`SÉRIE / TURMA` do cabeçalho do professor **saem da prova**; no lugar deles fica
uma faixa em branco de uns 3 cm no alto da folha, que é onde o app escreve.

## Publicação

O app se sustenta sozinho (o login vem de `vendor/supabase.js`, cópia própria), então roda de dois jeitos sem mudar nada:

- **Dentro do Painel do Colaborador**, em `/provas/` — é o card 🔖 do painel. O
  `vercel.json` da raiz do repositório dá `no-cache` a `/provas` e `/provas/`,
  porque endereço de pasta não casa com a regra `/(.*).html` e a página podia
  ser servida do cache da CDN depois de um deploy novo.
- **Como site próprio, em domínio separado** — na Vercel, um projeto novo
  apontando para este mesmo repositório com **Root Directory = `provas`**,
  *Framework Preset* em **Other**. Aí valem o `provas/vercel.json` e o
  `provas/.vercelignore` (que deixa `test/` e o README fora do deploy).

Na segunda forma a pasta do app é a raiz do domínio, e o link "Voltar ao
Painel" sai de cena sozinho: um script de duas linhas no `index.html` remove o
link quando o endereço é a raiz. O logo é uma cópia própria em `provas/logo.png`
(192 px, 78 kB, contra os 2,25 MB do original do painel), justamente para o app
não depender de arquivo de fora.

Roda inteiro dentro do navegador: o PDF enviado, os nomes colados e os arquivos
gerados **não saem do computador**. A lista colada some ao fechar a aba; os
**60 últimos arquivos gerados** ficam guardados no próprio navegador
(IndexedDB, `js/historico.js`), na aba *Arquivos recentes*, para baixar de novo.
Quando entra um novo, o mais antigo sai; dá para apagar um a um ou todos.

## Acesso (só a gestão)

O app abre trancado e pede **e-mail e senha**. Entram apenas as contas do
**Montador de Provas** (projeto Supabase "MapaDeAulas", tabela
`montador_perfis`) que estejam **ativas** e com papel **`gestao`**. Professor e
PCA recebem o aviso de que o acesso é só da gestão. Para dar ou tirar acesso,
a gestão cadastra a pessoa (ou muda o papel) pelo próprio Montador; os papéis
aceitos ficam em `js/config.js`.

- `js/acesso.js` confere a sessão antes de tirar a classe `trancado` do
  `<html>`; o botão **Sair** tranca de novo.
- A sessão usa a mesma chave do Montador, então em `/provas/` do painel quem já
  entrou no Montador entra direto. Sem internet, vale o perfil conferido na
  última vez.
- É uma trava na página: como tudo roda no navegador e nada vai para um
  servidor, ela impede o uso por quem não tem conta, mas o código do app
  continua público como qualquer site estático.

## O caminho

A prova pode vir pronta do **Montador de Provas** (`/montar/`): a Avaliação
Bimestral Malu sai de lá com um espaço em branco de 2,5 cm exatamente onde
este app cola o cabeçalho com os valores padrão da tela (19 × 2,5 cm, a 0,6 cm
do alto e 1 cm da esquerda), então basta subir o PDF.

1. **A avaliação** — bimestre, ano e a *chave da escola*. Aqui também dá para
   **Trazer as provas do Montador**: o app busca as provas que o PCA já travou
   para impressão, agrupadas por bimestre (o mais novo já vem marcado), e a
   gestão marca as que quer usar. O bimestre, o ano e o nome da avaliação são
   preenchidos. Tem de ser um bimestre só e uma prova por série e componente;
   prova de formato livre não entra. Sem importar, tudo segue como sempre.
2. **Os alunos** — cola-se tudo de uma vez, todas as turmas juntas. A turma pode
   vir como título de bloco (`TURMA 3B`) ou na própria linha (`3B; João da
   Silva`, `7;CARLA MENDES;1B`, `PEDRO ALVES - 3A`). Se a lista já vier
   numerada, é **esse** número que vale: é o mesmo que o aluno preenche em
   “Núm. da lista” na folha de respostas. Sem numeração, a ordem alfabética
   manda — e aí a mesma turma gera sempre os mesmos códigos. Além de **Puxar do
   Malu Presente** (todas as turmas do ano), dá para **escolher só as turmas que
   se quer puxar agora**: A a F das séries das provas importadas. Cada puxada
   pede ao Malu Presente só as turmas marcadas e **junta** o resultado à lista,
   no lugar das turmas de mesmo nome, sem apagar as outras nem as edições feitas
   nelas.
3. **As provas** — cada prova em PDF, uma por série e componente, e a escolha
   do que cada aluno recebe: **só a capa e o verso** (as duas primeiras
   páginas; o resto sai no xerox em massa) ou **a prova inteira**, pronta para
   imprimir completa. JPG ou PNG servem, mas aí sai só a capa. Com provas
   importadas, dá para **soltar todos os PDFs de uma vez**: cada um é reconhecido
   pela chave da prova (gravada no título do PDF pelo Montador) e vai sozinho
   para o espaço dele, prova ou gabarito avulso, sem importar o nome do arquivo.
   Ficam de fora, com o motivo na tela: PDF sem chave (use o espaço, mais
   abaixo), a folha do professor, o PDF com 4 gabaritos por folha (o de 1 por
   página é o que o Identificador recebe) e PDF de prova que não foi importada.
4. **O cabeçalho de identificação** — clica-se na prévia da própria prova para
   encostar ali o canto de cima do cabeçalho, e ajusta-se largura e altura até
   o retângulo cobrir a faixa deixada em branco.
5. **Gerar** — sai um conjunto por turma e componente.

## O que sai no fim

- **Provas identificadas** (`PROVA-2026-B3-1A-LIN.pdf`): para cada aluno, na
  ordem da chamada, a capa com o cabeçalho e, logo atrás, sem cabeçalho, o
  verso ou o resto da prova, conforme a escolha do passo 3. Impresso frente e
  verso, cada aluno fica com as suas folhas. Sempre que a prova tiver
  número ímpar de páginas (inclusive uma só) entra uma página em branco no
  fim de cada aluno, para a
  capa do seguinte não cair no verso da última folha.
- **Prova reserva** (`PROVA-RESERVA-2026-B3-1A-LIN.pdf`): uma por turma e
  componente, com as mesmas páginas das identificadas, sem identificação: o cabeçalho traz o logo, a
  avaliação, a série e a turma, e linhas em branco para o nome e o número, sem
  QR nem código. É para substituir a prova de alguém na hora da aplicação.
- **Folha de conferência** (PDF e CSV): a lista que liga cada código ao aluno,
  com espaço para assinatura. É o único lugar em que nome e código aparecem
  juntos fora da prova.
- **Etiquetas**: o mesmo cabeçalho em grade (14 por folha), para recortar e
  colar quando a prova é impressa direto do Word. Aqui o componente aparece,
  porque a etiqueta anda solta antes de ser colada.

## O código

```
MLS-2026-B3-1A-007-LIN-DRYT
 │    │   │  │   │   │   └── verificador de 4 caracteres
 │    │   │  │   │   └────── componente
 │    │   │  │   └────────── número da lista
 │    │   │  └────────────── turma
 │    │   └───────────────── bimestre
 │    └───────────────────── ano
 └────────────────────────── escola
```

O verificador sai de um SHA-256 do próprio conteúdo somado à **chave da
escola**, então trocar o nome ou a turma na caneta derruba a conferência. A aba
**Conferir um código** recalcula e diz se aquele código pertence mesmo àquele
aluno. O código continua impresso em letra legível, do mesmo jeito de antes.

## Contrato do QR da prova

O QR impresso na prova e no gabarito identificado é um texto só, para o leitor
do Malu Presente e para o Malu Gabaritos. **Não é o QR do cartão de entrada**
do Malu Presente: não leva credencial, token, segredo nem qualquer campo
daquele cartão.

Versão `MLSPROVA1`, campos separados por `|`:

```
MLSPROVA1|<codigo>|<turma>|<numero>|<nome>|<titulo>
MLSPROVA1|<codigo>|<turma>|<numero>|<nome>|<titulo>|<matricula>
MLSPROVA1|<codigo>|<turma>|<numero>|<nome>|<titulo>|<matricula>|<chave>
```

| Campo | O que é |
| --- | --- |
| `codigo` | O mesmo código impresso em letra legível, `MLS-2026-B3-1A-007-LIN-DRYT` |
| `turma` | Série e turma juntas, no formato curto `1A` (1ª série, turma A) |
| `numero` | Número da lista com 3 dígitos, o mesmo do código (`007`) |
| `nome` | Nome sem acento, em maiúsculas. Espaço vira `+`. No máximo 28 caracteres, cortado no fim de uma palavra |
| `titulo` | Nome da avaliação, com as mesmas regras, no máximo 19 caracteres. O campo fica presente mesmo vazio |
| `matricula` | Só dígitos, de 4 a 12, e só quando a lista traz matrícula. Sem matrícula, este campo não aparece (a não ser que haja `chave`: aí fica vazio, para a chave continuar no oitavo lugar) |
| `chave` | A chave da prova no Montador: 8 caracteres de `0-9` e `A-F` (`8F3A2C1D`), os primeiros do id da prova na nuvem. Só aparece em prova da área que veio do Montador com a chave. Quem não conhece o campo lê o resto normalmente |

Exemplo com dados fictícios. Os quatro caracteres finais ilustram o verificador; na prova gerada eles saem do cálculo com o nome e a chave da escola:

```
MLSPROVA1|MLS-2026-B3-1A-007-LIN-DRYT|1A|007|ESTUDANTE+FICTICIO+07|AVALIACAO+BIMESTRAL|20260007
```

Quem lê troca cada `+` por espaço. Fora o `|`, o texto só tem letras, dígitos, `+` e `-`. Para colocar num endereço, troque cada `|` por `%7C`.

A matrícula entra quando a lista tem o campo `matricula` — é o caso de **Puxar do Malu Presente**, que traz `numero`, `nome`, `matricula` e `ativo`. Na caixa de alunos ela aparece no fim de cada linha, depois de um traço (`07 - Estudante Fictício 07 - 20260007`), e é daí que chega ao QR; só o Identificador a mostra, o Montador e o Malu Gabaritos continuam com `07 - Nome`. Aluno com `ativo: false` não recebe prova. Coluna de 4 a 12 dígitos na lista colada também vale como matrícula. Um valor que não seja só dígitos nesse tamanho é ignorado, para a credencial do cartão não caber nesse campo.

Provas já impressas usam o formato antigo, em duas linhas, e continuam válidas:

```
MLS-2026-B3-1A-007-LIN-DRYT
NOME DO ALUNO
```

A aba Conferir e o Malu Gabaritos leem os dois. O verificador do código usa o nome inteiro da lista; se o nome no QR tiver sido cortado no limite de 28 caracteres, a conferência pede o nome completo no campo ao lado. O texto todo fica em até 106 caracteres, que é um QR versão 6: no quadrado de 2 cm da prova ele continua legível.

Guarde a chave: sem ela nem a conferência funciona, nem os mesmos alunos geram
os mesmos códigos numa segunda rodada.

### De onde vem a chave da prova

A chave liga a prova ao QR de cada aluno sem ninguém escolher nada:

1. **Montador.** Ao imprimir uma prova da área, o PDF recebe o nome
   `PROVA-2026-B3-1S-LIN-K8F3A2C1D` (o de sempre mais `-K` e a chave). O
   navegador grava o mesmo nome como título do PDF. Prova só do navegador não
   tem chave e sai com o nome de sempre.
2. **Identificador.** Ao receber o PDF (prova ou gabarito), lê a chave do título
   do PDF e, se o título faltar, do nome do arquivo. O título vale mais porque
   sobrevive a quem renomeia o arquivo. A chave vai para o QR de cada aluno. O
   Identificador também compara o que o nome diz (série, componente, bimestre,
   ano) com o espaço em que o arquivo foi solto e avisa se não bate. JPG, PNG e
   PDF de outra origem não têm chave e seguem como sempre.
3. **Malu Gabaritos.** Acha a prova pela chave do QR (ver abaixo).

### Como o Malu Gabaritos usa o QR

O QR é o que diz de quem é a folha. Na correção, em cada folha, primeiro o QR e
depois o gabarito:

1. **O QR vira a identidade.** Sem QR lido, a leitura do gabarito nem começa. A
   chave do QR acha a prova: se a folha é de outra prova que a pessoa corrige, a
   tela troca de prova sozinha (nas fotos enviadas, cada folha vai para a prova
   dela). Chave que nenhuma prova do aparelho tem, ou prova que a pessoa não
   corrige, o app avisa e não registra. A chave é o que separa duas provas com os
   mesmos ano, bimestre, série e componente (uma segunda chamada, por exemplo).
   QR sem chave (de antes dela) vale pelo ano, bimestre, série e componente do
   código `MLS-2026-B3-1A-007-LIN-…`, mas, se a prova tem chave, a leitura fica
   marcada para revisão.
2. **A identidade vale para uma leitura só.** Ao registrar, ela é apagada, então
   o QR de um aluno nunca vai parar na folha do seguinte. Sem o QR aparecer por
   6 segundos, ela também some.
3. **O aluno sai da turma e do número do QR.** O número da lista marcado nas
   bolhas, se existir, só confere: se não bate com o QR, a leitura vai para
   revisão e vale o QR.
4. **Folhas sem QR** (prova que não passou pelo Identificador, folha antiga): a
   pessoa liga "Folhas sem QR" e o aluno sai do número marcado, como antes.

O QR é lido pelo navegador (BarcodeDetector, no Chrome do Android e do
computador) e, onde ele não existe, pelo leitor embutido jsQR
(`gabaritos/vendor/`, Apache-2.0). É o caso do Safari e do Chrome no iPhone. O QR
precisa de pelo menos 3 pixels por módulo: com a câmera, mostre o QR de perto
antes do gabarito; nas fotos enviadas, vale a foto inteira do celular, não uma
imagem reduzida.

```bash
node --test gabaritos/test/identificar.test.cjs   # o passo do QR primeiro, a conferência da prova, o jsQR com o QR real
```

Componentes: `RED` redação, `LIN` linguagens e códigos, `NAT` ciências da
natureza, `HUM` ciências humanas, `MAT` matemática.

## O cabeçalho

```
┌────────────────────────────────────────────────────┬────────┐
│ ALUNO(A)                                           │ ▓▓▓▓▓▓ │
│ JOSÉ ÍTALO GONÇALVES DA CONCEIÇÃO                  │ ▓ QR ▓ │
│ 1ª SÉRIE · TURMA 1A · Nº 03    MLS-2026-B3-1A-003… │ ▓▓▓▓▓▓ │
└────────────────────────────────────────────────────┴────────┘
```

O **brasão da escola** é padrão e sai sempre, à esquerda (ou do lado oposto ao
QR). Ele é lido do `logo.png`; se o arquivo não vier — pasta aberta direto do
computador, sem internet —, vale a cópia embutida em `js/brasao.js`, gerada do
mesmo `logo.png`. Trocando o logo, gere de novo o `brasao.js`.

O nome é o maior elemento, porque é ele que impede a prova de rodar de carteira
em carteira, e nunca sai cortado: a fonte diminui até o nome inteiro caber. O QR
fica encaixado na altura do bloco, à direita ou à esquerda. Escola, componente e
bimestre **não** aparecem — isso a prova já diz, e repetir só polui a folha.

Três modelos:

- **No espaço em branco da prova** (padrão) — a prova sai em tamanho original e o
  cabeçalho é colado na faixa que o professor deixou. Nada é redimensionado, o
  que importa quando a primeira página traz a **folha de respostas com as marcas
  quadradas de alinhamento**: elas ficam exatamente onde estavam.
- **Abrir o espaço** — para prova que ainda não tem a faixa: a prova desce e
  encolhe o necessário, e o cabeçalho entra na faixa nova.
- **Só etiquetas** — não mexe na prova.

Medidas em centímetros, contadas da borda superior esquerda, como se mede numa
folha impressa. Se a prova tiver sido reduzida para abrir espaço, uma marca
colada sobre ela passa pela mesma redução sozinha.

## Gabaritos identificados (aba própria, opcional)

Para quando a folha de respostas vem separada da prova. O gabarito recebe a
**mesma identificação** da prova daquele aluno — inclusive o **mesmo código e o
mesmo QR** —, de modo que as duas folhas se cruzem e nenhuma sirva para outro
aluno. Sai uma via por aluno, com **todas as páginas** do arquivo enviado e o
cabeçalho na primeira, mais um gabarito reserva sem identificação.

A aba anda sozinha: o campo de carregar o arquivo fica sempre à vista — escolhe-se
a série e o componente e envia-se o PDF, sem precisar de prova nenhuma nem de
lista colada. A lista de alunos do **passo 2** só faz falta na hora de gerar,
porque é dela que sai a identificação.

Sai **quatro gabaritos por folha A4**, cada um ocupando um quarto da folha, em
pé, para recortar — é o formato usual da folha de respostas da escola. Marcas de
corte curtas nas bordas do meio mostram onde cortar, sem passar por cima de
nada impresso. Uma folha de até um quarto de A4 entra em **tamanho original**;
maior que isso, é reduzida para caber, e o rótulo do arquivo diz em quanto
ficou, porque redução mexe com a leitura óptica. Desmarcando a opção, sai um
gabarito por página, no tamanho do arquivo enviado.

O cabeçalho do gabarito tem **medidas próprias**, porque a folha de respostas
costuma ser bem menor que a prova — um quarto de uma folha A4, por exemplo, onde
o bloco de 19 cm da capa não caberia. Quando um arquivo é enviado, largura,
altura e posição se ajustam sozinhas ao tamanho real da folha, até a coordenação
mexer nelas. Nesse formato reduzido o cabeçalho dispensa os quadros de acertos e
pontos e a linha da data, que são da capa da prova, e o QR encolhe junto com o
bloco.

O gabarito **nunca é redimensionado**: ele é copiado em tamanho original e o
cabeçalho é sobreposto, para as marcas quadradas de alinhamento da leitura
óptica ficarem exatamente onde estavam. Por isso vale conferir na prévia que o
retângulo não cobre nenhuma marca nem as bolhas; não havendo espaço livre, o
caminho é deixar uma faixa em branco no gabarito antes de subir o arquivo.

Um botão em cada arquivo enviado repete aquele gabarito nos cinco componentes da
série, que é o caso comum de uma folha de respostas servir para todas as provas.

## Prova no Word

O app precisa da página já desenhada, e um `.docx` só ganha desenho quando o
Word o pagina. Duas saídas:

1. Abrir no Word e usar **Arquivo → Salvar como → PDF** (um clique, mantém o
   layout igual) — é o caminho recomendado.
2. Gerar a **folha de etiquetas** e colar nas provas impressas.

## Como está feito

HTML, CSS e JavaScript sem framework e sem build, como o InstaPensa. As
bibliotecas estão em `vendor/`, servidas do próprio site, para o app funcionar
sem internet:

| Arquivo | Para que |
| --- | --- |
| `vendor/pdf-lib.min.js` | montar o PDF de saída (MIT) |
| `vendor/pdf.min.js` + `pdf.worker.min.js` | desenhar a prévia na tela (Apache 2.0, carregado só quando a prévia é pedida) |
| `vendor/qrcode.js` | gerar o QR Code (MIT) |

O QR é desenhado como **vetor** (um retângulo por sequência de módulos
escuros), não como imagem: sai nítido em qualquer impressora e o arquivo fica
leve. O SHA-256 é implementação própria em `js/sha256.js`, porque o
`crypto.subtle` não existe quando a pasta é aberta direto do computador
(`file://`).

## Testes

```bash
node --test provas/test/provas.test.cjs   # código, lista, QR MLSPROVA1, posição e PDF
node --test provas/test/chaveprova.test.cjs provas/test/importar.test.cjs  # a chave no PDF e no QR; a importação do Montador
node --test gabaritos/test/qrprova.test.cjs  # o Gabaritos lê o QR novo e o antigo
node provas/test/provas-browser.mjs       # 72 verificações na tela, com Chromium (inclui a importação do Montador)
```

O teste de navegador precisa do `playwright` instalado (global serve), sobe um
servidor local, cola uma lista, envia `test/prova-exemplo.pdf` — uma prova de
mentirinha no formato da escola, com a faixa em branco no alto e sem o campo
`ALUNO (A):` —, clica na prévia, gera os arquivos e confere o CSV e a aba de
conferência. Depois ele repete o essencial servindo a pasta do app na raiz, que
é o modo de domínio próprio, e confere que o logo carrega e que o link de volta
desaparece. Os arquivos ficam em `test/saida/` para inspeção.
