# Partiu ENEM — o jogo de tabuleiro das regras do Enem

Jogo de **estratégia em fases** para os **2º e 3º anos** treinarem tudo o que
precisam saber para os **dois domingos do Enem**. O estudante anda casa por
casa num tabuleiro e só avança respondendo certo.

Endereço: `/enem/` no mesmo site do Painel do Colaborador
(<https://painel-colaborador.vercel.app/enem/>). Funciona no celular e no
computador, sem login: o progresso fica salvo no próprio aparelho.

## Como se joga

Cada fase é um tabuleiro com casas de **pergunta** (múltipla escolha), uma
**bifurcação** e um **desafio final**. Antes de andar, o estudante lê as regras
da fase. Depois, administra três recursos:

- **❤ Energia (3):** cada erro custa 1. Sem energia, a fase recomeça.
- **⏱ Relógio:** cada passo, erro e consulta às regras gasta minutos do
  enredo. Se passar do limite (por exemplo, o portão que fecha às 13h), perde.
- **🧑‍🏫 Professor (1 vez por fase):** elimina 2 alternativas ou resolve 2 itens
  de um desafio.

Na bifurcação, o **atalho** economiza um passo, mas traz um desafio especial;
o **caminho longo** tem 2 perguntas comuns. No caminho aparecem **cartas** de
imprevisto ou de boa escolha (ônibus atrasado, local visitado antes...), que
tiram ou dão minutos e ensinam um cuidado.

Os desafios especiais são de três tipos: **classificar** (levar ou deixar em
casa, mesa ou envelope, zera ou não zera a redação), **verdadeiro ou falso** e
**ordenar** (linha do tempo do domingo). Errar mostra a regra certa e entra na
lista "Para revisar" do fim da fase. Três estrelas = fase sem nenhum erro.

| Fase | Momento | O que treina |
| --- | --- | --- |
| 1. Mochila pronta | Sábado, véspera | Documentos aceitos e recusados, caneta preta transparente, itens proibidos |
| 2. Rumo ao local de prova | Domingo de manhã | Portões 12h–13h, início 13h30, horário de Brasília |
| 3. Entrando na sala | 12h–13h30 | Envelope porta-objetos, celular desligado, banheiro, cor do caderno, frase em letra cursiva |
| 4. Dia 1 | 13h30–19h | Linguagens + Humanas + Redação, o que zera a redação, saída após 2h, caderno nos últimos 30 min |
| 5. Recarga para o 2º dia | Sábado, véspera | Conteúdo e duração do 2º dia, mochila sem calculadora, descanso |
| 6. Dia 2 | 13h30–18h30 | Natureza + Matemática, Cartão-Resposta, 3 últimos saem juntos |
| 7. E depois? | Resultados | Gabarito oficial, Página do Participante, golpes, SiSU/Prouni/Fies |

No fim: **certificado** com nome, estrelas e "Os 10 mandamentos do Enem". O
botão **Revisão** reúne todas as regras.

## Editar o conteúdo

Tudo fica em `index.html`, no objeto `FASES` (regras, perguntas, desafios e
cartas de cada fase) e em `MANDAMENTOS`. As regras seguem os editais recentes
do Enem; revise a cada ano conforme o edital publicado pelo Inep.
