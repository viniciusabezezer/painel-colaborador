# ProvaShow Malu

Avaliação em tempo real com **cartões de papel**: o professor faz uma pergunta,
cada aluno gira o seu cartão para deixar em cima a letra que escolheu (A, B, C
ou D) e levanta; o professor passa a câmera do celular pela turma e as
respostas aparecem na hora no telão e ficam guardadas nos relatórios. Só o
professor usa aparelho.

É uma recriação, feita do zero, do fluxo de app + site que o Plickers
popularizou, com código, desenho de cartão e identidade próprios.

## As partes

| Endereço | O que é |
| --- | --- |
| `provashow/` | **Site**: apresentação, como funciona, recursos, cartões, dúvidas. |
| `provashow/app/` | **App do professor** (computador): Biblioteca de perguntas, Turmas, Aula ao vivo e Relatórios. |
| `provashow/scanner/?sala=CÓDIGO` | **Scanner** (celular): lê os cartões com a câmera e comanda o telão (gráfico, resposta, próxima). |
| `provashow/telao/?sala=CÓDIGO` | **Telão** (projetor/TV): pergunta, quem já respondeu, gráfico e resposta certa. |
| `provashow/cartoes/` | **Cartões para imprimir**: 63 cartões, 1, 2 ou 4 por folha A4, com ou sem os nomes da turma. |

## O caminho de uma aula

1. **Biblioteca** → *+ Novo conjunto*. Escreva as perguntas (2 a 4
   alternativas, verdadeiro/falso ou enquete sem resposta certa, com imagem se
   quiser) ou **cole várias de uma vez**: numere as perguntas, use `a)`…`d)` e
   marque a certa com `*` antes da letra ou uma linha `Resposta: B`.
2. **Turmas** → *+ Nova turma*. Cole a lista da chamada (um nome por linha):
   cada aluno ganha um número de cartão. Ponha conjuntos na **fila da turma**.
3. **Cartões** → imprima o jogo (o mesmo jogo serve para todas as turmas) ou os
   cartões da turma, com os nomes.
4. **Aula ao vivo** → escolha turma e conjunto. O app mostra um **código de 6
   letras** e um **QR code**: abra o scanner no celular por ele. *Abrir telão*
   abre a tela do projetor.
5. Os alunos levantam os cartões; o celular marca cada cartão lido (verde =
   registrado). *Mostrar gráfico* e *Revelar resposta* — no app ou no celular —
   mudam o telão. Dá para lançar ou trocar a resposta de um aluno à mão,
   tocando no nome dele.
6. **Relatórios**: placar da turma (aluno × pergunta, com ✓/✗), acerto de cada
   aluno e de cada pergunta, filtro por período e planilha CSV.

## Como funciona por dentro

- **Cartões** (`js/cartao.js`): quadrado 7×7 — moldura preta e um código 5×5.
  Os 63 códigos foram escolhidos para que as quatro posições de cada cartão (e
  de todos os cartões) difiram em pelo menos 6 casas: o leitor corrige até 2
  casas mal lidas e nunca troca um cartão ou uma letra por outro.
- **Leitor** (`js/leitor.js`): JavaScript puro, no aparelho, sem enviar
  imagem para lugar nenhum. Limiar adaptativo (aguenta luz desigual), manchas
  escuras, 4 cantos, perspectiva (homografia), leitura das casas e busca do
  código. Lê 30 cartões num quadro 640×480 em ~25 ms. O scanner só registra um
  cartão visto com a mesma letra em dois quadros seguidos, e ao passar para a
  próxima pergunta ignora os cartões que continuam no ar com a resposta
  anterior até o aluno baixá-los.
- **Canal da aula** (`js/canal.js`): duas vias com o código da aula —
  `BroadcastChannel` (janelas do mesmo computador: telão ao lado, scanner pela
  webcam) e **Supabase Realtime Broadcast** (celular e projetor em aparelhos
  diferentes). O app do professor é quem guarda tudo; pelo canal passam só a
  pergunta da vez, os números dos cartões e os nomes da turma. Nada é gravado no
  banco e não há tabelas do ProvaShow no Supabase. A chave em `js/config.js` é
  a publicável do projeto MapaDeAulas (a mesma do Montador). As imagens das
  perguntas só vão pela via local.
- **Dados** (`js/dados.js`): turmas, conjuntos e relatórios ficam no
  `localStorage` do navegador do professor. *⋯ → Baixar cópia de segurança*
  exporta tudo em JSON; *Restaurar* traz de volta (em outro computador, por
  exemplo).

> O canal da internet usa canais públicos do Realtime: quem souber o código da
> aula consegue entrar nele enquanto a aula durar. Por isso o código é
> aleatório e muda a cada aula, e o telão nunca mostra a letra de cada aluno.
> Se o Realtime do projeto estiver com canais públicos desligados, o app avisa
> "só neste computador" e continua funcionando pela via local.

## Testes

```bash
node --test provashow/test/provashow.test.cjs      # cartões, leitor (fotos sintéticas), contas
node provashow/test/provashow-browser.mjs          # ponta a ponta no Chromium (playwright)
```

O teste de navegador abre app, telão e scanner juntos; a câmera do scanner é
uma câmera falsa do Chromium mostrando cartões levantados (1 em pé = A, 2 girado
= B, 3 de cabeça para baixo = C, e um cartão sem aluno). Ele confere a leitura,
os comandos pelo celular, o telão, os relatórios, a planilha e a impressão dos
cartões. Capturas e o PDF dos cartões ficam em `provashow/test/saida/`.
