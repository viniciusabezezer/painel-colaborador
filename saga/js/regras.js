/* As regras do jogo. Tudo aqui é PADRÃO: a escola pode mudar valores,
   comportamentos, poderes, itens da loja e eventos na aba Escola, e o que
   ela mudou fica guardado junto com os dados.

   É um RPG de sala de aula, com o vocabulário que os estudantes já
   conhecem dos jogos: classes, HP, Mana, XP, níveis, ouro, guildas, quests,
   boss, K.O. e respawn. O Ceará aparece nos nomes (guildas, eventos), e três
   princípios guiam as regras:
   - XP nunca é tirado. Erro custa HP, que se recupera; quem é nocauteado
     volta por uma missão de respawn (justiça restaurativa), não por castigo.
   - Cada classe só brilha em equipe: um tanque protege, um curandeiro cura,
     um mago passa mana, um arqueiro decide o boss.
   - Os comportamentos mudam com o tipo de escola (EEMTI, EEEP, EEM). */
(function (global) {
    'use strict';

    const CLASSES = [
        {
            id: 'guerreiro', nome: 'Guerreiro(a)', funcao: 'Tanque', icone: '🛡️', vidaMax: 80, energiaMax: 30,
            avatares: ['🛡️', '⚔️', '🪓', '🤺', '🦁', '🐻'],
            papel: 'Tanque da guilda: recebe o dano no lugar de um colega.'
        },
        {
            id: 'curandeiro', nome: 'Curandeiro(a)', funcao: 'Suporte', icone: '🌿', vidaMax: 60, energiaMax: 40,
            avatares: ['🌿', '🧝', '🧚', '💖', '🦉', '🕊️'],
            papel: 'Suporte da guilda: devolve HP aos colegas.'
        },
        {
            id: 'mago', nome: 'Mago(a)', funcao: 'Mana', icone: '🔮', vidaMax: 50, energiaMax: 50,
            avatares: ['🔮', '🧙', '🧙‍♀️', '🪄', '🐉', '🦊'],
            papel: 'Fonte de mana da guilda: transfere Mana para os colegas usarem poderes.'
        },
        {
            id: 'arqueiro', nome: 'Arqueiro(a)', funcao: 'Dano', icone: '🏹', vidaMax: 60, energiaMax: 40,
            avatares: ['🏹', '🥷', '🦅', '🎯', '🐺', '🐆'],
            papel: 'Dano da guilda: no boss, o acerto de uma guilda com arqueiro vale golpe crítico (dano dobrado).',
            critico: true
        }
    ];

    /* Títulos que aparecem ao lado do nível. */
    const TITULOS = [
        [1, 'Aprendiz'], [2, 'Aventureiro(a)'], [4, 'Veterano(a)'],
        [6, 'Campeão(ã)'], [8, 'Herói(na)'], [10, 'Lenda']
    ];

    /* efeito.tipo:
       - proteger:   usado na hora de um desconto; o protetor leva o dano
                     com a redução indicada (0,3 = 30% a menos).
       - curar:      devolve HP.             alvo: si | colega | guilda
       - energizar:  transfere Mana.         alvo: colega | guilda
       - privilegio: um privilégio na vida real, combinado com a turma. */
    const PODERES = [
        { id: 'escudo', classe: 'guerreiro', nivel: 1, custo: 10, nome: 'Escudo',
            descricao: 'Recebe um desconto no lugar de um colega da guilda, com 30% a menos de dano.',
            efeito: { tipo: 'proteger', reducao: 0.3 } },
        { id: 'grito', classe: 'guerreiro', nivel: 2, custo: 15, nome: 'Grito de guerra',
            descricao: 'Entrega uma atividade um dia depois do prazo, sem perder nada.',
            efeito: { tipo: 'privilegio' } },
        { id: 'folego', classe: 'guerreiro', nivel: 3, custo: 15, nome: 'Fôlego de aço',
            descricao: 'Recupera 20 de HP.',
            efeito: { tipo: 'curar', valor: 20, alvo: 'si' } },
        { id: 'lider', classe: 'guerreiro', nivel: 5, custo: 30, nome: 'Líder da guilda',
            descricao: 'Escolhe o próprio lugar na sala por uma semana.',
            efeito: { tipo: 'privilegio' } },

        { id: 'cura', classe: 'curandeiro', nivel: 1, custo: 10, nome: 'Cura',
            descricao: 'Devolve 15 de HP a um colega da guilda.',
            efeito: { tipo: 'curar', valor: 15, alvo: 'colega' } },
        { id: 'bencao', classe: 'curandeiro', nivel: 2, custo: 15, nome: 'Bênção da calma',
            descricao: 'Ouve música no fone durante uma atividade individual.',
            efeito: { tipo: 'privilegio' } },
        { id: 'curaarea', classe: 'curandeiro', nivel: 3, custo: 30, nome: 'Cura em área',
            descricao: 'Devolve 10 de HP a toda a guilda.',
            efeito: { tipo: 'curar', valor: 10, alvo: 'guilda' } },
        { id: 'sabedoria', classe: 'curandeiro', nivel: 5, custo: 30, nome: 'Sabedoria anciã',
            descricao: 'Tira uma dúvida com o professor durante uma avaliação.',
            efeito: { tipo: 'privilegio' } },

        { id: 'transferir', classe: 'mago', nivel: 1, custo: 10, nome: 'Transferir mana',
            descricao: 'Passa 8 de Mana para um colega da guilda.',
            efeito: { tipo: 'energizar', valor: 8, alvo: 'colega' } },
        { id: 'teleporte', classe: 'mago', nivel: 2, custo: 15, nome: 'Teleporte',
            descricao: 'Troca uma questão de uma atividade por outra do mesmo assunto.',
            efeito: { tipo: 'privilegio' } },
        { id: 'aura', classe: 'mago', nivel: 3, custo: 25, nome: 'Aura arcana',
            descricao: 'Passa 6 de Mana para cada colega da guilda.',
            efeito: { tipo: 'energizar', valor: 6, alvo: 'guilda' } },
        { id: 'tempo', classe: 'mago', nivel: 5, custo: 35, nome: 'Parar o tempo',
            descricao: 'Ganha 10 minutos a mais numa atividade (não vale para avaliação).',
            efeito: { tipo: 'privilegio' } },

        { id: 'aguia', classe: 'arqueiro', nivel: 1, custo: 10, nome: 'Olho de águia',
            descricao: 'Pede uma dica ao professor numa atividade.',
            efeito: { tipo: 'privilegio' } },
        { id: 'rastrear', classe: 'arqueiro', nivel: 2, custo: 15, nome: 'Rastrear',
            descricao: 'Fica sabendo o tema da próxima atividade antes da turma.',
            efeito: { tipo: 'privilegio' } },
        { id: 'mira', classe: 'arqueiro', nivel: 3, custo: 15, nome: 'Mira do caçador',
            descricao: 'Respira fundo: recupera 15 de HP.',
            efeito: { tipo: 'curar', valor: 15, alvo: 'si' } },
        { id: 'cacada', classe: 'arqueiro', nivel: 5, custo: 30, nome: 'Caçada',
            descricao: 'Primeiro(a) da fila do almoço por uma semana.',
            efeito: { tipo: 'privilegio' } }
    ];

    /* A loja: o ouro ganho vira item. Poções mexem no jogo; o resto é
       privilégio real, combinado com a turma. */
    const LOJA = [
        { id: 'pocao', nome: 'Poção de vida', icone: '🧪', preco: 15, descricao: '+20 de HP.', efeito: { tipo: 'vida', valor: 20 } },
        { id: 'elixir', nome: 'Elixir de mana', icone: '💧', preco: 15, descricao: '+15 de Mana.', efeito: { tipo: 'energia', valor: 15 } },
        { id: 'lugar', nome: 'Lugar livre', icone: '🪑', preco: 25, descricao: 'Senta onde quiser numa aula.', efeito: { tipo: 'privilegio' } },
        { id: 'fone', nome: 'Fone liberado', icone: '🎧', preco: 30, descricao: 'Ouve música numa atividade individual.', efeito: { tipo: 'privilegio' } },
        { id: 'prazo', nome: 'Passe de prazo', icone: '🎟️', preco: 40, descricao: 'Entrega uma atividade um dia depois.', efeito: { tipo: 'privilegio' } },
        { id: 'dj', nome: 'DJ do intervalo', icone: '🎵', preco: 50, descricao: 'Escolhe a música da sala num intervalo.', efeito: { tipo: 'privilegio' } }
    ];

    const COMPORTAMENTOS_BASE = [
        { id: 'participacao', nome: 'Participação ativa', tipo: 'positivo', xp: 20, icone: '🙋' },
        { id: 'ajudou', nome: 'Ajudou um colega', tipo: 'positivo', xp: 30, icone: '🤝' },
        { id: 'entregou', nome: 'Atividade no prazo', tipo: 'positivo', xp: 20, icone: '📬' },
        { id: 'superacao', nome: 'Superação (melhorou)', tipo: 'positivo', xp: 40, icone: '📈' },
        { id: 'pontual', nome: 'Chegou no horário', tipo: 'positivo', xp: 10, icone: '⏰' },
        { id: 'farda', nome: 'Fardamento completo', tipo: 'positivo', xp: 10, icone: '👕' },
        { id: 'lideranca', nome: 'Liderou a guilda', tipo: 'positivo', xp: 30, icone: '🧭' },
        { id: 'simulado', nome: 'Fez simulado (SPAECE/ENEM)', tipo: 'positivo', xp: 40, icone: '📝' },
        { id: 'leitura', nome: 'Leitura concluída', tipo: 'positivo', xp: 30, icone: '📚' },

        { id: 'atraso', nome: 'Atraso', tipo: 'negativo', vida: 5, icone: '🐢' },
        { id: 'semfarda', nome: 'Sem fardamento', tipo: 'negativo', vida: 5, icone: '🚫' },
        { id: 'celular', nome: 'Celular fora de hora', tipo: 'negativo', vida: 10, icone: '📵' },
        { id: 'naoentregou', nome: 'Atividade não entregue', tipo: 'negativo', vida: 10, icone: '📭' },
        { id: 'atrapalhou', nome: 'Atrapalhou a aula', tipo: 'negativo', vida: 10, icone: '🔊' },
        { id: 'desrespeito', nome: 'Desrespeito', tipo: 'negativo', vida: 25, icone: '⚠️', ocorrencia: true },
        { id: 'saiu', nome: 'Saiu sem autorização', tipo: 'negativo', vida: 20, icone: '🚪', ocorrencia: true }
    ];

    const COMPORTAMENTOS_POR_TIPO = {
        EEMTI: [
            { id: 'eletiva', nome: 'Destaque na Eletiva/Clube', tipo: 'positivo', xp: 30, icone: '🎭' },
            { id: 'ntpps', nome: 'Etapa do NTPPS entregue', tipo: 'positivo', xp: 30, icone: '🔬' },
            { id: 'estudo', nome: 'Estudo orientado bem usado', tipo: 'positivo', xp: 20, icone: '🧠' }
        ],
        EEEP: [
            { id: 'pratica', nome: 'Prática do curso técnico', tipo: 'positivo', xp: 30, icone: '🛠️' },
            { id: 'estagio', nome: 'Relatório de estágio entregue', tipo: 'positivo', xp: 40, icone: '💼' },
            { id: 'epi', nome: 'Sem EPI no laboratório', tipo: 'negativo', vida: 15, icone: '🥽' }
        ],
        EEM: [
            { id: 'projeto', nome: 'Projeto de vida em dia', tipo: 'positivo', xp: 30, icone: '🧭' }
        ]
    };

    /* Sorteado no começo do dia de cada turma. efeito.tipo:
       xp | vida | energia (para todos da turma), multiplicador (o XP dos
       reconhecimentos do dia vale mais), semDano (ninguém perde HP hoje),
       desafio (só o texto: o professor decide se a turma conseguiu). */
    const EVENTOS = [
        { id: 'aracati', nome: 'Double XP — Vento Aracati', icone: '🌬️',
            texto: 'O vento chegou mais cedo: todo XP de reconhecimento vale o dobro hoje.',
            efeito: { tipo: 'multiplicador', valor: 2 } },
        { id: 'chuva', nome: 'Chuva de mana', icone: '🌧️',
            texto: 'Choveu no sertão! Todos recuperam 10 de Mana.',
            efeito: { tipo: 'energia', valor: 10 } },
        { id: 'fogueira', nome: 'Fogueira de descanso', icone: '🔥',
            texto: 'Ponto de descanso: todos recuperam 10 de HP.',
            efeito: { tipo: 'vida', valor: 10 } },
        { id: 'estrelas', nome: 'Chuva de estrelas', icone: '✨',
            texto: 'XP grátis caindo do céu: todos ganham 15 XP.',
            efeito: { tipo: 'xp', valor: 15 } },
        { id: 'zona', nome: 'Zona segura', icone: '🛡️',
            texto: 'Hoje ninguém perde HP. Aproveitem para arriscar.',
            efeito: { tipo: 'semDano' } },
        { id: 'relampago', nome: 'Missão relâmpago', icone: '⚡',
            texto: 'Um(a) estudante sorteado(a) explica o conteúdo da aula em 1 minuto (em rima de repente, se tiver coragem). Se mandar bem, todos ganham 20 XP.',
            efeito: { tipo: 'desafio', xp: 20 } },
        { id: 'raid', nome: 'Raid da turma', icone: '⚔️',
            texto: 'A turma inteira entrega a atividade de hoje. Se conseguir, todos ganham 25 XP.',
            efeito: { tipo: 'desafio', xp: 25 } },
        { id: 'suporte', nome: 'Dia do suporte', icone: '🤝',
            texto: 'Quem ajudar um colega hoje ganha o XP em dobro.',
            efeito: { tipo: 'multiplicador', valor: 2, so: 'ajudou' } },
        { id: 'calmo', nome: 'Mapa tranquilo', icone: '🗺️',
            texto: 'Nenhum evento hoje. Bom dia para farmar XP.',
            efeito: { tipo: 'nenhum' } }
    ];

    const CHEFES = [
        { id: 'hidra', nome: 'Hidra das Distrações', icone: '🐍', vida: 6, xp: 30, ouro: 10,
            texto: 'Corte uma cabeça e nascem duas notificações. Foco na questão!' },
        { id: 'kraken', nome: 'Kraken da Maré Braba', icone: '🐙', vida: 8, xp: 40, ouro: 10,
            texto: 'Saiu do fundo do mar de Paracuru para afundar quem não estudou.' },
        { id: 'dragao', nome: 'Dragão da Seca', icone: '🐉', vida: 10, xp: 50, ouro: 15,
            texto: 'Seca a vontade de estudar. Cada acerto é uma gota de chuva.' },
        { id: 'golem', nome: 'Golem da Preguiça', icone: '🗿', vida: 12, xp: 60, ouro: 20,
            texto: 'Lento, pesado e teimoso. Só cai com a guilda inteira atacando.' }
    ];

    /* Missões de respawn: o caminho de volta de quem foi nocauteado. O
       estudante volta com metade do HP quando a missão é concluída. */
    const REPARACOES = [
        { id: 'conversa', nome: 'Conversa restaurativa com o(a) PDT' },
        { id: 'ajuda', nome: 'Ajudar um colega numa atividade' },
        { id: 'carta', nome: 'Escrever uma reflexão sobre o que aconteceu' },
        { id: 'solucao', nome: 'Propor uma solução para o problema causado' },
        { id: 'cuidado', nome: 'Cuidar de um espaço da escola com a guilda' }
    ];

    const PADRAO = {
        versao: 2,
        energiaInicial: 10,
        energiaPorDia: 5,
        vidaPorDia: 2,
        bonusNivelEnergia: 10,
        voltaDaQueda: 0.5,       // fração do HP máximo ao concluir o respawn
        solidariedade: 0,        // HP que os colegas perdem quando alguém é nocauteado (0 = desligado)
        presenca: { bonusACada: 5, xp: 25, ouro: 5 },
        moeda: { porNivel: 10 }, // ouro ganho a cada nível
        tamanhoGuilda: 5
    };

    function copiar(x) { return JSON.parse(JSON.stringify(x)); }

    /* XP total para chegar ao nível L: 0, 100, 300, 600, 1000, 1500... */
    function xpParaNivel(nivel) { return 50 * (nivel - 1) * nivel; }

    function nivelPorXp(xp) {
        let nivel = 1;
        while (xp >= xpParaNivel(nivel + 1)) nivel++;
        return nivel;
    }

    function titulo(nivel) {
        let t = TITULOS[0][1];
        for (const [n, nome] of TITULOS) if (nivel >= n) t = nome;
        return t;
    }

    function comportamentosPadrao(tipoEscola) {
        const extras = COMPORTAMENTOS_POR_TIPO[tipoEscola] || [];
        const positivos = COMPORTAMENTOS_BASE.filter((c) => c.tipo === 'positivo');
        const negativos = COMPORTAMENTOS_BASE.filter((c) => c.tipo === 'negativo');
        return copiar([
            ...positivos, ...extras.filter((c) => c.tipo === 'positivo'),
            ...negativos, ...extras.filter((c) => c.tipo === 'negativo')
        ]);
    }

    function regrasPadrao(tipoEscola) {
        return Object.assign(copiar(PADRAO), {
            classes: copiar(CLASSES),
            poderes: copiar(PODERES),
            loja: copiar(LOJA),
            comportamentos: comportamentosPadrao(tipoEscola || 'EEMTI'),
            eventos: copiar(EVENTOS),
            chefes: copiar(CHEFES),
            reparacoes: copiar(REPARACOES)
        });
    }

    /* Confere regras vindas da escola (editadas à mão ou importadas).
       Devolve a lista de problemas; vazia quer dizer que dá para usar. */
    function validar(regras) {
        const erros = [];
        if (!regras || typeof regras !== 'object') return ['As regras não são um objeto.'];
        const listas = ['classes', 'poderes', 'loja', 'comportamentos', 'eventos', 'chefes', 'reparacoes'];
        for (const chave of listas) {
            if (!Array.isArray(regras[chave]) || !regras[chave].length) erros.push(`Falta a lista "${chave}".`);
        }
        if (erros.length) return erros;
        const ids = (lista) => new Set(lista.map((x) => x.id));
        const classes = ids(regras.classes);
        for (const c of regras.classes) {
            if (!(c.vidaMax > 0) || !(c.energiaMax > 0)) erros.push(`Classe "${c.id}": vidaMax e energiaMax precisam ser positivos.`);
        }
        for (const p of regras.poderes) {
            if (!classes.has(p.classe)) erros.push(`Poder "${p.id}": classe "${p.classe}" não existe.`);
            if (!p.efeito || !['proteger', 'curar', 'energizar', 'privilegio'].includes(p.efeito.tipo)) erros.push(`Poder "${p.id}": efeito desconhecido.`);
            if (!(p.custo >= 0) || !(p.nivel >= 1)) erros.push(`Poder "${p.id}": custo e nível inválidos.`);
        }
        for (const i of regras.loja) {
            if (!(i.preco > 0)) erros.push(`Item "${i.id}": preço precisa ser maior que zero.`);
            if (!i.efeito || !['vida', 'energia', 'privilegio'].includes(i.efeito.tipo)) erros.push(`Item "${i.id}": efeito desconhecido.`);
        }
        for (const c of regras.comportamentos) {
            if (!['positivo', 'negativo'].includes(c.tipo)) erros.push(`Comportamento "${c.id}": tipo deve ser positivo ou negativo.`);
            if (c.tipo === 'positivo' && !(c.xp > 0)) erros.push(`Comportamento "${c.id}": precisa de XP maior que zero.`);
            if (c.tipo === 'negativo' && !(c.vida > 0)) erros.push(`Comportamento "${c.id}": precisa de HP maior que zero.`);
        }
        for (const lista of listas) {
            if (ids(regras[lista]).size !== regras[lista].length) erros.push(`Há ids repetidos em "${lista}".`);
        }
        return erros;
    }

    const api = {
        CLASSES, PODERES, LOJA, EVENTOS, CHEFES, REPARACOES,
        xpParaNivel, nivelPorXp, titulo, comportamentosPadrao, regrasPadrao, validar, copiar
    };

    global.SagaRegras = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
