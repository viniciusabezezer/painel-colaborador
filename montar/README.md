# Montador de Provas da Malu

Ferramenta para o **professor montar a prova pronta para imprimir**. Ele escolhe
um modelo, escreve ou cola as questões (texto e imagens) e imprime — ou salva em
PDF — a prova já no formato da escola. A paginação, as colunas, o quadro de
instruções e o gabarito ficam por conta do app, que procura sempre **a prova
mais curta que continua fácil de ler**, porque papel e tinta são contados.

As **provas pessoais** rodam inteiras no navegador, **também sem internet**, e
não saem dele: se salvam sozinhas e os **últimos arquivos gerados** ficam
guardados no aparelho. As **provas da área**, montadas por vários professores,
ficam no servidor da escola (Supabase) — veja abaixo.

## Provas da área — montadas a várias mãos

Além das provas pessoais (que ficam só no navegador), o Montador tem as
**provas da área**: uma mesma prova — por exemplo, a Avaliação Bimestral de
Ciências da Natureza da 2ª série — montada por todos os professores da área,
cada um com o seu login.

**Papéis** (definidos pela gestão, na tela *Professores*):

| Papel | O que faz |
| --- | --- |
| **Gestão** | Cadastra, edita, desativa e exclui contas; vê e coordena todas as provas. |
| **PCA** | Cria as provas da sua área e distribui as seções; mexe no formato, nas instruções e no gabarito; escreve as suas questões; **edita qualquer questão** da área; **comenta, devolve e aprova** cada seção; **trava** a prova para impressão. |
| **Professor** | Escreve as questões das seções atribuídas a ele; vê a prova inteira (as seções dos colegas ficam só para leitura); comenta; marca a sua seção como **pronta para revisão**. |

**O caminho de uma prova da área**

1. O PCA clica em **+ Nova prova da área**: escolhe o modelo, a série, o
   bimestre e o prazo. As seções nascem das disciplinas da área, com o
   professor de cada disciplina já sugerido como responsável.
2. Cada professor entra, abre a prova e escreve (ou cola, ou traz do banco) as
   questões da sua seção. Tudo vai sozinho para o servidor; o selo ☁ na barra
   diz se está salvo. Terminando, **✔ Marcar como pronta**, com um recado.
3. O PCA acompanha no painel da prova (seção, responsável, questões, situação,
   prazo) e na prévia, que mostra a prova inteira em tempo real. Ele pode
   corrigir uma questão diretamente, **Devolver com comentário** (a seção volta
   ao professor, com o recado em destaque) ou **Aprovar**.
4. Com tudo aprovado, **🔒 Travar para impressão**: ninguém altera mais até o
   PCA destravar. A impressão, o gabarito do professor e a folha de respostas
   saem como nas provas pessoais.

**Detalhes que importam**

- As mudanças dos colegas chegam **em tempo real**; quem está digitando não
  perde o cursor (a prova se atualiza quando a pessoa para de digitar).
- **Sem internet**, o professor continua montando: as alterações ficam
  guardadas no aparelho (o selo mostra "Sem conexão (n)") e vão sozinhas quando
  a conexão volta.
- Cada questão guarda **quem criou e quem alterou por último**; cada seção tem
  o seu **histórico de comentários** (pronta, devolvida, aprovada).
- As **imagens** das questões vão para um armazenamento privado, numa pasta da
  prova: só quem pode ver a prova vê as imagens.
- Quem decide o que cada um pode fazer é o **banco** (regras RLS), não a tela:
  mesmo forçando pelo navegador, um professor não grava na seção do colega.

**Primeiro acesso e senhas.** Na primeira vez, em *Entrar*, aparece o
**Primeiro acesso da gestão**: quem o usa cria a primeira conta da gestão e,
com ela, cadastra os demais. Essa opção some assim que existe uma conta da
gestão. Esqueceu a senha? A gestão define uma nova em *Professores → Editar*;
cada um troca a própria em *Trocar senha*. Conta desativada não entra, mas as
questões dela continuam nas provas.

**Onde ficam os dados.** No projeto Supabase **MapaDeAulas** (o plano gratuito
só permite dois projetos ativos), em tabelas próprias com o prefixo
`montador_`, separadas de tudo o que é do MapaDeAulas. O esquema, as regras e
a função que cria as contas estão em `supabase/`:

| Arquivo | O que é |
| --- | --- |
| `supabase/001_montador.sql` | tabelas, regras de acesso (RLS), gatilhos, armazenamento das imagens, tempo real |
| `supabase/002_funcoes_privadas.sql` | as funções das regras fora da API |
| `supabase/003_ver_prova_pela_linha.sql` | ajuste da regra de leitura das provas |
| `supabase/functions/montador-usuarios/` | a função que cria e altera contas (só a gestão a usa) |
| `supabase/teste_permissoes.sql` | 25 verificações das regras, para rodar no SQL Editor (não grava nada) |

O endereço e a chave publicável do Supabase estão em `js/config.js` — a chave
publicável é feita para ir no navegador; os dados ficam protegidos pelas regras.

## Os modelos

O modelo decide o **formato**; o conteúdo é sempre do professor.

| Modelo | O que é |
| --- | --- |
| **Avaliação Bimestral Malu** 🔒 | O modelo **fixo**, no formato da prova bimestral da escola. Não se edita nem se apaga, e toda prova feita com ele segue a versão atual do app. |
| **Avaliação Parcial** | Modelo de exemplo, editável: cabeçalho completo com o brasão (escola, aluno, professor, turma, data, nota), instruções curtas e duas colunas, sem gabarito. |
| **Modelos próprios** | Criados em *Criar modelo*, como *variação* do bimestral ou com *Salvar este formato como modelo* a partir de uma prova. Ficam guardados neste navegador. |
| **Prova do zero** | Formato livre e nenhuma seção pronta. |

Em **toda** prova, inclusive na do modelo fixo, o professor escolhe no passo
*Aparência*:

- **fonte** — Times New Roman (padrão), Arial, Calibri, Cambria ou Georgia;
- **tamanho** — de 8 a 14 pt, **10 pt** por padrão;
- **espaçamento** — compacto, normal (padrão) ou amplo;
- **margens** — **0,5 cm** por padrão, a mais estreita que as impressoras
  costumam aceitar (a área que elas não alcançam fica em torno de 4 mm); 0,8,
  1 ou 1,5 cm se alguma impressora cortar a borda. A faixa da identificação e o
  quadro de instruções ficam sempre no retângulo do Identificador (1 cm de cada
  lado), qualquer que seja a margem;
- **gabarito** — a folha de respostas do aluno entra ou não, e como (veja
  abaixo);
- **linha entre as colunas** — ligada por padrão;
- **ícones das disciplinas** nos títulos das seções (ligados por padrão);
- **imagens em tons de cinza**, para gastar menos tinta (ligado por padrão).

O **quadro de instruções** também é do professor, em qualquer modelo (passo
*Instruções*): ligar ou desligar, escrever uma instrução por linha (com
negrito e itálico), acrescentar com um clique as mais comuns (duração,
calculadora, celular…) e voltar às instruções do modelo quando quiser. A
prova bimestral nasce com as cinco instruções da escola.

O resto do formato (cabeçalho, colunas, letras, numeração) é do modelo. No modelo fixo ele não muda; se uma prova precisar de outro formato,
**Fazer uma cópia com formato livre** a desliga do modelo fixo, sem mexer na
original.

## A Avaliação Bimestral e o Identificador de Provas

A prova bimestral sai do Montador para o [Identificador de Provas](../provas/),
que cola o cabeçalho com o **brasão da escola**, o nome do aluno, a turma e o
QR. Por isso a primeira página do modelo fixo traz, no alto, um **espaço em
branco de 2,5 cm** (19 × 2,5 cm, a 0,6 cm da borda de cima e 1 cm da esquerda)
— exatamente o retângulo em que o Identificador cola, por padrão, o cabeçalho
da identificação, que a gestão acrescenta depois. Na tela, a faixa mostra uma
**simulação desse cabeçalho, com o brasão**, para o professor ver como a prova
vai ficar; na impressão sai em branco. (No Identificador o brasão é padrão e
está embutido no app, para sair sempre, até sem internet.)

Logo abaixo vem o quadro de **Instruções** e as duas colunas. Com o gabarito
ligado, a primeira coluna abre com o **GABARITO (NÃO RASURE)**:

- o *Núm. da lista* com dois dígitos para marcar;
- o rótulo da série e da área (`2º Ano` / `C.N.`);
- as questões em blocos de cinco, com `A B C D E` em cima, de 1 a 14 na
  primeira coluna, de 15 a 40 na segunda e de 41 em diante na terceira, como na
  prova impressa da escola (até 65 questões);
- as marcas quadradas de alinhamento em quatro fileiras verticais, de cinco em
  cinco linhas, sempre no mesmo lugar, qualquer que seja o número de questões.

### O gabarito: gerado ou imagem, na prova ou à parte

- **Como**: *gerado pelo app* (a grade acima, com o número de questões da
  prova) ou *imagem enviada por mim* — foto, print ou digitalização da folha de
  respostas que o professor já usa (escolher, colar com Ctrl+V ou arrastar).
- **Onde**: *na 1ª página da prova* (abrindo a primeira coluna) ou *em folha à
  parte, 4 por folha A4*. À parte, a prova fica sem o gabarito e:
  - **Imprimir gabaritos (4 por folha)** sai uma folha A4 com quatro
    gabaritos, cada um num quarto da folha, com marcas de corte curtas nas
    bordas do meio — o mesmo formato da aba *Gabaritos* do Identificador;
  - **Salvar 1 por página (para o Identificador)** sai um PDF de
    10,5 × 14,85 cm, que se sobe na aba *Gabaritos* do Identificador: ele cola
    em cada um o cabeçalho com o brasão, o nome e o mesmo QR da prova do aluno,
    e monta 4 por folha.
  O gabarito avulso gerado traz no alto as linhas *Nome / Nº / Turma / Data*
  para quem imprime direto; elas ficam exatamente sob o cabeçalho do
  Identificador (0,3 a 1,9 cm do alto), que as cobre.
- A conta de folhas da prévia soma as de gabarito (uma folha para cada quatro
  alunos).

O PDF sai com o nome `PROVA-2026-B3-2S-NAT.pdf` (ano, bimestre, série e área),
pronto para subir no Identificador.

## Escrevendo as questões

- **Três tipos**: objetiva, discursiva (com linhas para a resposta) e **texto de
  apoio** — o texto, tirinha, gráfico ou tabela que serve a várias questões, sem
  número e fora do gabarito.
- **Colar texto**: do Word, de um PDF ou de um site, o texto entra com
  **negrito, itálico, índices e expoentes**; cores, fontes e tamanhos de lá
  ficam de fora — o formato é o da prova.
- **Formatação** sem decorar nada: botões **N**, *I*, x₂ e x² sobre o
  enunciado, ou Ctrl+B / Ctrl+I. Por baixo é uma marcação simples, que também
  se digita: `**negrito**`, `*itálico*`, `H~2~O`, `x^2^` (`\*` é asterisco).
- **Imagens**: cole um print (Ctrl+V) na área de colar da questão ou no
  enunciado, arraste o arquivo para a questão ou use *Escolher imagem…*. Uma
  questão pode ter várias. Cada uma tem:
  - **posição** — abaixo do texto, acima do texto ou **ao lado do texto** (o
    texto contorna a figura, que economiza muito espaço);
  - **tamanho** — de 15% a 100% da largura da coluna, num controle deslizante.
  Imagem pequena não estica: ela entra no tamanho em que fica nítida.
- **Imagens nas alternativas**: o botão 🖼 ao lado de cada alternativa (ou
  arrastar a imagem para ela). Alternativa só com imagem: deixe o texto vazio.
- **Organização das alternativas**: *automática* (padrão), *uma por linha*,
  *duas por linha* ou *todas numa linha*. Na automática o app mede as
  alternativas e escolhe a forma mais compacta em que nenhuma quebra de linha —
  "a) 12  b) 15  c) 18…" numa linha só, frases médias em duas colunas, frases
  longas uma por linha — e mostra no editor o que escolheu.
- A bolinha ao lado da alternativa marca a **resposta certa**: vai para o
  **Gabarito do professor**, uma folha à parte, nunca para a prova.
- **Ícone da disciplina**: sai sozinho pelo título da seção (Biologia, Física,
  Química, História, Geografia, Filosofia, Sociologia, Língua Portuguesa,
  Língua estrangeira, Arte, Educação Física, Matemática, Redação); dá para
  trocar ou tirar em cada seção. Traço fino, quase sem tinta.
- **Colar várias questões** de uma vez: `01. (Uece) …`, alternativas `a)` a
  `e)` (inclusive todas numa linha só), um título em maiúsculas (`BIOLOGIA`)
  abre uma seção e `Gabarito: C` marca a resposta. Uma lista "1. 2. 3." ou
  "a) b)" dentro do enunciado não se parte em questões.
- **Trazer de outra prova**: escolhe questões das provas guardadas (com busca
  por palavra) e elas entram na seção de mesmo nome — um banco de questões.
- **Desfazer** (↶, ou Ctrl+Z fora das caixas de texto) volta as últimas 30
  alterações: questão apagada, colagem, mudança de formato.

Antes de imprimir, o painel *Antes de imprimir, confira* aponta questões sem
enunciado, alternativas vazias e respostas não marcadas.

## Economia de papel e tinta

- O padrão (Times New Roman 10, espaçamento normal, margens de 0,5 cm, duas
  colunas de 9,7 cm, alternativas automáticas) já é a forma mais enxuta que a
  escola considera legível.
- Acima da prévia: **páginas, folhas por aluno** (frente e verso) e o **total
  de folhas para a turma** (o número de alunos fica guardado).
- **Economizar papel** experimenta, fora da vista, espaçamento compacto e letra
  até 1 pt menor (nunca abaixo de 9 pt) e propõe a combinação **mais legível**
  entre as que dão menos páginas, dizendo quantas folhas a turma economiza. Só
  aplica se o professor clicar. Também aponta imagens grandes demais e
  alternativas presas em "uma por linha".
- Quando a última página fica quase vazia, o app avisa.
- Imagens em tons de cinza por padrão; ícones de traço fino; nada de fundo,
  moldura ou cor que não seja necessária. O gabarito mantém o preto sólido das
  marcas de alinhamento, que a leitura óptica precisa.

## Outras funções

- **Versão B**: cópia da prova com as alternativas em outra ordem (a resposta
  certa acompanha, e o gabarito do professor da versão B sai certo), para
  turmas grandes. Questões com "todas as anteriores", "nenhuma das
  alternativas", "a e b" ficam na ordem original — o app avisa quais.
- **Gabarito do professor**: uma folha com a resposta de cada questão.
- **Exportar / Importar** (`.json`): leva a prova a outro computador ou à
  coordenação.
- **Busca** na lista de provas, quando ela cresce.

## Sem internet e arquivos guardados

- Na primeira visita com internet, o **service worker** (`sw.js`) guarda o app
  inteiro no aparelho; daí em diante ele abre, monta e imprime sem conexão. O
  início mostra "✓ Pronto para usar sem internet neste aparelho". No celular e
  no computador dá para **instalar** o app pelo navegador (manifesto em
  `manifest.webmanifest`).
- As provas ficam no **IndexedDB** do navegador e se salvam sozinhas.
- **Últimos arquivos gerados**: cada vez que uma prova (ou o gabarito do
  professor) é impressa ou salva em PDF, a versão daquele momento fica
  guardada — as 40 últimas. *Abrir esta versão* cria uma cópia editável, para
  imprimir de novo exatamente o que foi para a gráfica.
- O app pede ao navegador **armazenamento persistente**, para nada ser apagado
  sozinho quando o disco aperta. Mesmo assim, limpar os dados do navegador
  apaga tudo: exporte as provas importantes.
- Ao mudar arquivos do app, suba `VERSAO` no `sw.js` para os aparelhos
  pegarem a versão nova.

## A paginação

A prova vira uma fila de blocos (título de seção, parágrafos, imagens,
alternativas, linhas de resposta) e cada bloco entra na coluna da vez. Quem
mede é o próprio navegador — o bloco é posto na coluna e, se passou do fim,
sai —, então a prévia é exatamente o que sai na impressora. Como na prova da
escola, um parágrafo longo pode começar no pé de uma coluna e continuar na
seguinte (quebra por palavra, com a última linha justificada e pelo menos duas
linhas de cada lado), e um título de seção ou o começo de uma questão nunca fica
sozinho no fim da coluna.

A impressão usa o próprio navegador: **Imprimir / salvar PDF** abre a janela de
impressão já em A4, sem margens do navegador (as margens são da folha). Para
gerar o arquivo, escolha *Salvar como PDF*. A fonte escolhida precisa estar
instalada no computador que imprime; no Linux e no Android entram as
equivalentes de mesma medida (Liberation, Tinos, Arimo, Carlito, Caladea).

## Publicação

Endereço próprio: **https://montador-provas-malu.vercel.app** (projeto
`montador-provas-malu` na Vercel, Root Directory = `montar`). Se esse projeto
estiver publicando a raiz do repositório por engano, o `vercel.json` da raiz
manda esse domínio para `/montar/` (e não para o InstaPensa), e o app se
comporta como site próprio também ali. Também roda dentro
do painel, em `/montar/` do projeto `instapensa`.

Como o Identificador, roda de dois jeitos sem mudar nada:

- **Dentro do Painel do Colaborador**, em `/montar/` — o card 📝 do painel. O
  `vercel.json` da raiz dá `no-cache` a `/montar` e `/montar/`.
- **Como site próprio** — projeto na Vercel apontando para este repositório com
  **Root Directory = `montar`** e *Framework Preset* **Other**. Valem o
  `montar/vercel.json` e o `montar/.vercelignore`. Na raiz do domínio o link
  "Voltar ao Painel" some sozinho.

Aberto direto do computador (`file://`) também funciona; aí não há service
worker, mas nem precisa — os arquivos já estão no computador.

## Como está feito

HTML, CSS e JavaScript sem framework, sem build e sem biblioteca de fora.

| Arquivo | Para que |
| --- | --- |
| `js/texto.js` | marcação (negrito, itálico, índice, expoente) e divisão em palavras |
| `js/modelos.js` | modelo fixo, modelos guardados (localStorage), fontes, prova, versão B |
| `js/icones.js` | ícones das disciplinas (SVG de traço) e detecção pelo título |
| `js/gabarito.js` | a grade de respostas em SVG, em milímetros |
| `js/importar.js` | leitura das várias questões coladas |
| `js/colar.js` | texto formatado e imagens da área de transferência |
| `js/paginar.js` | as folhas A4: blocos, colunas, quebras, alternativas, folha de correção |
| `js/armazem.js` | provas, últimos arquivos gerados e imagens das provas da área (IndexedDB) |
| `js/nuvem.js` | login, cadastro e provas da área: envio por diferença, mudanças dos colegas, imagens, comentários |
| `js/config.js` | endereço e chave publicável do Supabase |
| `vendor/supabase.js` | cliente do Supabase (MIT), servido do próprio site |
| `js/app.js` | as telas |
| `sw.js`, `manifest.webmanifest` | funcionamento sem internet e instalação |
| `folha.css` | a folha impressa |
| `app.css` | a interface |

## Testes

```bash
node --test montar/test/montar.test.cjs   # 24 testes: marcação, modelos, ícones, versão B, gabarito, colagem
node montar/test/montar-browser.mjs        # 80 verificações na tela, com Chromium
node montar/test/area-browser.mjs          # 52 verificações da prova da área, com cinco navegadores
```

O teste de navegador precisa do `playwright` (global serve). Ele monta uma
Avaliação Bimestral colando `test/questoes-exemplo.txt`, confere a faixa, o
gabarito (e tirá-lo), a fonte padrão, os ícones, as alternativas lado a lado, a
gabarito como imagem e à parte (4 por folha e 1 por página, no tamanho real),
a linha entre as colunas, colagem de texto do Word e de imagem, tamanho e posição de imagem, texto de
apoio, desfazer, economia de papel, versão B, os últimos arquivos gerados, gera
o PDF como a impressão do navegador gera e, por fim, **corta a internet e abre
o app de novo**. Os PDFs e uma captura da tela ficam em `test/saida/`.

O teste da prova da área (`area-browser.mjs`) abre um navegador para cada
pessoa — gestão, PCA, professores de Biologia, Física e História — sobre um
Supabase de mentira (`test/supabase-falso.mjs` e `test/cliente-falso.js`) que
aplica as mesmas regras do banco. Ele percorre o caminho inteiro: primeiro
acesso, cadastro, criação da prova, seções só para leitura, imagem no storage,
pronta, edição e devolução pelo PCA, ajuste, trabalho sem internet, tentativa
de gravar na seção do colega, aprovação, trava, professor de outra área e conta
desativada. As regras do banco de verdade são conferidas à parte por
`supabase/teste_permissoes.sql`.
