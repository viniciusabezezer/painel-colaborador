# Provas Identificadas

Ferramenta para a coordenação **identificar cada prova bimestral com o aluno**:
o app cola na faixa em branco do alto da primeira página um **cabeçalho de
identificação** com o nome do aluno, a série, a turma, o número da lista e um
**código único com QR Code**, de modo que a prova de um não sirva para outro.

O cabeçalho é a única identificação da prova. O campo `ALUNO (A):` e o
`SÉRIE / TURMA` do cabeçalho do professor **saem da prova**; no lugar deles fica
uma faixa em branco de uns 3 cm no alto da folha, que é onde o app escreve.

## Publicação

O app se sustenta sozinho, então roda de dois jeitos sem mudar nada:

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
gerados **não saem do computador** e não ficam guardados em lugar nenhum. Ao
fechar a aba, tudo desaparece — por isso baixe a folha de conferência antes de
sair.

## O caminho

1. **A avaliação** — bimestre, ano e a *chave da escola*.
2. **Os alunos** — cola-se tudo de uma vez, todas as turmas juntas. A turma pode
   vir como título de bloco (`TURMA 3B`) ou na própria linha (`3B; João da
   Silva`, `7;CARLA MENDES;1B`, `PEDRO ALVES - 3A`). Se a lista já vier
   numerada, é **esse** número que vale: é o mesmo que o aluno preenche em
   “Núm. da lista” na folha de respostas. Sem numeração, a ordem alfabética
   manda — e aí a mesma turma gera sempre os mesmos códigos.
3. **As provas** — cada prova em PDF, uma por série e componente, e a escolha
   do que cada aluno recebe: **só a capa e o verso** (as duas primeiras
   páginas; o resto sai no xerox em massa) ou **a prova inteira**, pronta para
   imprimir completa. JPG ou PNG servem, mas aí sai só a capa.
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
aluno. O QR Code leva o código e o nome, em duas linhas.

Guarde a chave: sem ela nem a conferência funciona, nem os mesmos alunos geram
os mesmos códigos numa segunda rodada.

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
node --test provas/test/provas.test.cjs   # 28 verificações: código, lista, QR, posição e PDF
node provas/test/provas-browser.mjs       # 25 verificações na tela, com Chromium
```

O teste de navegador precisa do `playwright` instalado (global serve), sobe um
servidor local, cola uma lista, envia `test/prova-exemplo.pdf` — uma prova de
mentirinha no formato da escola, com a faixa em branco no alto e sem o campo
`ALUNO (A):` —, clica na prévia, gera os arquivos e confere o CSV e a aba de
conferência. Depois ele repete o essencial servindo a pasta do app na raiz, que
é o modo de domínio próprio, e confere que o logo carrega e que o link de volta
desaparece. Os arquivos ficam em `test/saida/` para inspeção.
