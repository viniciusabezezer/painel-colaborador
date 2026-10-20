# Saga ⚔️ — o RPG da sala de aula

Gamificação no estilo **RPG clássico** (a mesma ideia do Classcraft), feita
para o **Ensino Médio cearense**: em português, gratuita, funciona **sem
internet** e se adapta a qualquer escola estadual do Ceará pela aba *Escola*.
Vem configurada para a **EEMTI Profa. Maria Luíza Saboia Ribeiro** (Paracuru,
CREDE 2).

O vocabulário é o dos jogos que os estudantes já jogam — **classe, HP, Mana,
XP, nível, ouro, loja, guilda, quest, boss, crítico, K.O. e respawn** — e o
Ceará aparece nos nomes: guildas como *Dragões do Mar*, *Lobos da Caatinga* e
*Corsários de Jeri*, eventos como *Double XP — Vento Aracati*, o *Kraken da
Maré Braba* e o *Dragão da Seca*.

Endereço: `/saga/` no mesmo site do Painel do Colaborador.

## As classes

Cada estudante escolhe uma classe (e um visual) e entra numa **guilda** de 4 a 6:

| Classe | Função | HP | Mana | O que faz pela guilda |
| --- | --- | --- | --- | --- |
| 🛡️ **Guerreiro(a)** | Tanque | 80 | 30 | Recebe o dano no lugar de um colega, com 30% a menos |
| 🌿 **Curandeiro(a)** | Suporte | 60 | 40 | Devolve HP aos colegas (cura individual e em área) |
| 🔮 **Mago(a)** | Mana | 50 | 50 | Transfere Mana para os colegas usarem poderes |
| 🏹 **Arqueiro(a)** | Dano | 60 | 40 | No boss, o acerto da guilda vale **crítico** (dano dobrado) |

Cada classe tem uma **árvore de poderes** que libera com o nível (1, 2, 3 e
5). Uns mexem no jogo (escudo, cura, transferir mana); outros são
**privilégios reais** combinados com a turma: entregar um dia depois, ouvir
música na atividade individual, pedir uma dica, ser o primeiro da fila do
almoço.

## Como se joga

- **＋XP**: participação, ajudar um colega, farda, simulado SPAECE/ENEM,
  NTPPS, Eletiva… XP sobe o **nível** (100, 300, 600, 1000…) e o **título**
  (Aprendiz → Aventureiro → Veterano → Campeão → Herói → Lenda). Cada nível
  dá **ouro** e Mana.
- **−HP**: atraso, celular, atividade não entregue… O dano tira **HP, nunca
  XP**. Um Guerreiro da guilda pode tankar. Quem zera fica **K.O.** e volta
  por uma **missão de respawn** (conversa restaurativa com o PDT, ajudar um
  colega, propor uma solução…), com metade do HP.
- **Começar o dia**: o dado sorteia o **evento do dia** (Double XP, Chuva de
  mana, Fogueira de descanso, Zona segura, Raid da turma…), a Mana recarrega
  e se faz a **chamada**. Presença seguida dá XP e ouro.
- **🐉 Boss**: revisão em forma de raid. Cada guilda que acerta ataca; o HP
  do boss cresce com o número de guildas; vencendo, todo mundo leva o loot
  (XP e ouro). Errar não tira nada.
- **📜 Quests**: tarefas com XP e ouro, ligadas a uma habilidade/descritor
  (SPAECE/SAEB, ENEM), mostrando quanto da turma completou.
- **🛒 Loja**: o ouro compra poção de vida, elixir de mana e privilégios
  (lugar livre, fone liberado, passe de prazo, DJ do intervalo).
- **📺 Telão**: para o projetor — evento do dia, ranking das guildas, MVPs
  da semana e o dado de **quem responde** (sorteio justo). Mostra **só
  conquistas**: HP e danos ficam na tela do professor.

## O que ela tem a mais que o Classcraft

1. **Em português, gratuita e sem internet** — roda no navegador do celular
   ou do notebook da sala; depois da primeira visita abre offline.
2. **Não punitiva por desenho** — XP nunca é tirado; o K.O. leva a uma
   reparação, não a um castigo sorteado; o dano em grupo vem desligado; o
   Telão não expõe ninguém.
3. **O Oráculo** (aba 🦉, só para o professor), que lê o histórico e aponta:
   - quem está K.O., com pouco HP ou tomando dano 3+ vezes na semana;
   - **Busca Ativa**: 3+ faltas seguidas;
   - **os invisíveis**: quem ninguém reconhece há 10 dias;
   - se a turma recebe menos de 3 reconhecimentos por dano;
   - se o XP está concentrado em 20% da turma;
   - guildas desequilibradas — e **propõe guildas novas** com as quatro
     funções em cada e XP parecido;
   - MVPs e quem **virou o jogo** (com certificado para imprimir);
   - o **resumo da turma para o PDT**, pronto para o WhatsApp ou o Conselho
     de Classe, e a **visão da escola** com todas as turmas.
4. **Adaptável a qualquer escola** — perfil (nome, município, CREDE/SEFOR,
   tipo EEMTI/EEEP/EEM, turmas, PDTs, áreas e PCAs, nome da moeda) e regras
   (comportamentos, ritmo e, em JSON, classes, poderes, loja, eventos e
   bosses). Os comportamentos sugeridos mudam com o tipo de escola.
5. **Vários professores, sem servidor** — cada um no seu aparelho; o backup
   de um colega entra com **Juntar** e nada se perde nem duplica.

## Por dentro

Tudo é estático (HTML, CSS e JavaScript puro), como os outros apps da Malu.

| Arquivo | O quê |
| --- | --- |
| `js/regras.js` | Classes, poderes, loja, comportamentos (por tipo de escola), eventos, bosses, respawn, níveis e títulos |
| `js/escola.js` | Perfil da escola: modelo da MALU, CREDEs, tipos, leitura de turmas |
| `js/motor.js` | O motor do jogo |
| `js/conselheiro.js` | O Oráculo: alertas, saúde da turma, guildas equilibradas, sorteio justo, resumo do PDT |
| `js/questoes.js` | Banco de questões de exemplo e leitura de questões coladas |
| `js/armazem.js` | localStorage e backup |
| `js/demo.js` | Turma de demonstração (nomes inventados, duas semanas simuladas) |
| `js/app.js` | A interface |
| `sw.js` | Funcionamento sem internet (suba `VERSAO` ao mudar arquivos) |

No código, HP é `vida` e Mana é `energia`; na tela, sempre HP e Mana.

**O motor guarda eventos, não o placar.** Cada ação (XP, dano, poder,
compra, começo do dia, chamada…) vira um evento com id, horário e autor; o
estado é refeito aplicando os eventos em ordem. Por isso *desfazer* é marcar
um evento como desfeito, *juntar* dois aparelhos é unir duas listas, e o
histórico de cada estudante sai pronto. Cada evento leva uma cópia do que
valia na hora (XP do comportamento, preço do item, dados do boss), então
mudar as regras depois não reescreve o passado. Um evento que não pode valer
(poder sem Mana, compra sem ouro, chamada repetida) é ignorado com o motivo.

## Privacidade (LGPD)

Os dados ficam **só no aparelho** de quem usa — nada vai para servidor. Mesmo
assim, prefira **apelido ou primeiro nome** e não cadastre dado sensível. O
backup é um arquivo com os nomes: guarde-o como guardaria a caderneta.

## Testes

```bash
node --test saga/test/              # motor, Oráculo, loja, backup, questões
node saga/test/saga-browser.mjs     # ponta a ponta no Chromium (precisa do playwright)
```

O teste de navegador roda no computador e no celular (390 px) e guarda as
capturas em `saga/test/saida/`.

## Próximos passos possíveis

- **Tela do estudante**: com uma nuvem da escola (Supabase, como no Montador
  de Provas), cada estudante veria a própria ficha, a árvore de poderes e a
  loja no celular. Os eventos já têm id e autor, então sincronizar é enviar a
  lista.
- **Quests sugeridas pelo Oráculo** a partir dos descritores do SPAECE/SAME
  com menor acerto.
