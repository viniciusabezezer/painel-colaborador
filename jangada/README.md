# Jangada ⛵

A sala de aula como **jogo cooperativo**, inspirada no Classcraft e feita para
o **Ensino Médio cearense**: em português, gratuita, funciona **sem internet**
e se adapta a qualquer escola estadual do Ceará pela aba *Escola*. Vem
configurada para a **EEMTI Profa. Maria Luíza Saboia Ribeiro** (Paracuru,
CREDE 2) e conversa com o **MaluPix**.

Endereço: `/jangada/` no mesmo site do Painel do Colaborador.

## Como funciona o jogo

Cada estudante tem uma **classe** e rema numa **jangada** (equipe de 4 a 6):

| Classe | Papel | Vida | Energia |
| --- | --- | --- | --- |
| ⛵ **Jangadeiro(a)** | Protege: recebe o desconto no lugar de um colega, com 30% a menos | 80 | 30 |
| 🧵 **Rendeiro(a)** | Cuida: tece de volta a Vida dos colegas | 60 | 40 |
| 📜 **Cordelista** | Anima: passa Energia para os colegas usarem seus poderes | 50 | 50 |

- **Reconhecer** (participação, ajudou um colega, farda, simulado SPAECE/ENEM,
  NTPPS, Eletiva…) dá **XP**. XP sobe o **nível** (100, 300, 600, 1000…), e
  cada nível dá moeda (**MaluPix**) e Energia.
- Níveis liberam **poderes**: uns mexem no jogo (curar, passar Energia,
  proteger), outros são **privilégios reais** combinados com a turma (entregar
  um dia depois, ouvir música na atividade individual, tirar uma dúvida na
  prova, escolher o lugar na sala).
- **Descontar** (atraso, celular, atividade não entregue…) tira **Vida — nunca
  XP**. Quem chega a zero **cai** e volta por uma **missão de reparação**
  (conversa restaurativa com o PDT, ajudar um colega, propor uma solução…),
  com metade da Vida.
- **Começar o dia**: sorteia o **evento do dia** (🌬️ Vento Aracati — XP em
  dobro; 🌧️ Chuva no sertão — Energia para todos; 🌊 Mar de calmaria —
  ninguém perde Vida; 🪕 Hora do repente — desafio coletivo…), recarrega a
  Energia e faz a **chamada**. Presença seguida rende bônus.
- **Batalha**: revisão em forma de chefe (🌪️ Redemoinho do Sertão, 🌊 Maré
  Braba, ☀️ Seca Grande, 🌀 Labirinto do Cordel). Cada jangada que acerta dá um
  golpe; errar não tira nada.
- **Missões**: tarefas com recompensa ligadas a uma habilidade/descritor
  (SPAECE/SAEB, ENEM), com acompanhamento de quantos concluíram.
- **Telão**: para o projetor. Evento do dia, travessia das jangadas na semana,
  destaques e o **sorteio justo** de quem responde. Mostra **só conquistas**:
  Vida e descontos ficam na tela do professor.

## O que ela tem a mais que o Classcraft

1. **Em português e com a cara do Ceará** — classes, eventos e chefes falam
   de jangada, renda de bilro, cordel, vento Aracati, açude sangrando.
2. **Gratuita e sem internet** — roda no navegador do celular ou do notebook
   da sala; depois da primeira visita abre offline.
3. **Não punitiva por desenho** — XP nunca é tirado; a queda leva a uma
   reparação, não a um castigo sorteado; a "solidariedade" (a jangada perde
   Vida quando alguém cai) vem desligada; o Telão não expõe ninguém.
4. **O Conselheiro** (aba 💡), que lê o histórico e aponta:
   - quem caiu, está com pouca Vida ou acumula 3+ descontos na semana;
   - **Busca Ativa**: 3+ faltas seguidas;
   - **os invisíveis**: quem ninguém reconhece há 10 dias;
   - se a turma recebe menos de 3 reconhecimentos por desconto;
   - se o XP está concentrado em 20% da turma;
   - jangadas desequilibradas — e **propõe jangadas novas** com as três
     classes em cada e XP parecido;
   - destaques da semana e quem **virou o jogo** (com certificado para imprimir);
   - o **resumo da turma para o PDT**, pronto para o WhatsApp ou o Conselho
     de Classe;
   - a **visão da escola**, com todas as turmas lado a lado (coordenação).
5. **Adaptável a qualquer escola** — perfil (nome, município, CREDE/SEFOR,
   tipo EEMTI/EEEP/EEM, turmas, PDTs, áreas e PCAs, moeda) e regras
   (comportamentos, ritmo, e em JSON: classes, poderes, eventos, chefes).
   Os comportamentos sugeridos mudam com o tipo de escola.
6. **Ligada ao MaluPix** — cada estudante pode ter o código do MaluPix; a moeda
   ganha na Jangada sai numa planilha (`;`, abre no Excel) para o caixa lançar,
   e o que já saiu não sai de novo.
7. **Vários professores, sem servidor** — cada um usa no seu aparelho; o
   backup de um colega entra com **Juntar** e nada se perde nem duplica.

## Por dentro

Tudo é estático (HTML, CSS e JavaScript puro), como os outros apps da Malu.

| Arquivo | O quê |
| --- | --- |
| `js/regras.js` | Classes, poderes, comportamentos (por tipo de escola), eventos, chefes, reparações e a curva de níveis |
| `js/escola.js` | Perfil da escola: modelo da MALU, CREDEs, tipos, leitura de turmas |
| `js/motor.js` | O motor do jogo |
| `js/conselheiro.js` | Alertas, saúde da turma, jangadas equilibradas, sorteio justo, resumo do PDT |
| `js/questoes.js` | Banco de questões de exemplo e leitura de questões coladas |
| `js/armazem.js` | localStorage, backup e planilha da moeda |
| `js/demo.js` | Turma de demonstração (nomes inventados, duas semanas simuladas) |
| `js/app.js` | A interface |
| `sw.js` | Funcionamento sem internet (suba `VERSAO` ao mudar arquivos) |

**O motor guarda eventos, não o placar.** Cada ação (reconheceu, descontou,
usou poder, começou o dia, chamada…) vira um evento com id, horário e autor; o
estado é refeito aplicando os eventos em ordem. Por isso *desfazer* é marcar
um evento como desfeito, *juntar* dois aparelhos é unir duas listas, e o
histórico de cada estudante sai pronto. Cada evento leva uma cópia do que
valia na hora (XP do comportamento, dados do chefe), então mudar as regras
depois não reescreve o passado. Um evento que não pode valer (poder sem
Energia, chamada repetida) é ignorado com o motivo, sem quebrar nada.

## Privacidade (LGPD)

Os dados ficam **só no aparelho** de quem usa — nada vai para servidor. Mesmo
assim, prefira **apelido ou primeiro nome** e não cadastre dado sensível. O
backup é um arquivo com os nomes: guarde-o como guardaria a caderneta.

## Testes

```bash
node --test jangada/test/            # motor, Conselheiro, backup, questões
node jangada/test/jangada-browser.mjs  # ponta a ponta no Chromium (precisa do playwright)
```

O teste de navegador roda no computador e no celular (390 px) e guarda as
capturas em `jangada/test/saida/`.

## Próximos passos possíveis

- **Nuvem da escola** (Supabase, como no Montador de Provas e no MaluPix): os
  eventos já têm id e autor, então sincronizar é enviar a lista — e o
  estudante poderia ver a própria ficha com o mesmo código + PIN do MaluPix.
- **Lançamento direto no MaluPix**, em vez da planilha.
- **Missões ligadas aos resultados do SPAECE/SAME**, sugeridas pelo
  Conselheiro a partir dos descritores com menor acerto.
