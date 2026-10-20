/* As regras do jogo. Tudo aqui é PADRÃO: a escola pode mudar valores,
   comportamentos, poderes e eventos na aba Escola, e o que ela mudou fica
   guardado junto com os dados (o código só entra quando não há escolha dela).

   A ideia é a do Classcraft, mas com três diferenças de princípio:
   - XP nunca é tirado. Erro custa Vida, que se recupera; o caminho de volta
     de quem cai é uma missão de reparação (justiça restaurativa), não um
     castigo sorteado.
   - As classes, os eventos e os chefes falam a língua do Ceará: jangada,
     renda de bilro, cordel, vento Aracati, cajueiro.
   - Os comportamentos mudam com o tipo de escola (EEMTI, EEEP, EEM). */
(function (global) {
    'use strict';

    const CLASSES = [
        {
            id: 'jangadeiro', nome: 'Jangadeiro(a)', icone: '⛵', vidaMax: 80, energiaMax: 30,
            papel: 'Protege a jangada: recebe o golpe no lugar de um colega.'
        },
        {
            id: 'rendeiro', nome: 'Rendeiro(a)', icone: '🧵', vidaMax: 60, energiaMax: 40,
            papel: 'Cuida da jangada: tece de volta a Vida dos colegas.'
        },
        {
            id: 'cordelista', nome: 'Cordelista', icone: '📜', vidaMax: 50, energiaMax: 50,
            papel: 'Anima a jangada: passa Energia para os colegas usarem seus poderes.'
        }
    ];

    /* efeito.tipo:
       - proteger:   usado na hora de um desconto; o protetor leva o golpe
                     com a redução indicada (0,3 = 30% a menos).
       - curar:      devolve Vida.            alvo: si | colega | jangada
       - energizar:  passa Energia.           alvo: colega | jangada
       - privilegio: um privilégio na vida real, combinado com a turma. */
    const PODERES = [
        { id: 'escudo', classe: 'jangadeiro', nivel: 1, custo: 10, nome: 'Escudo da jangada',
            descricao: 'Recebe um desconto no lugar de um colega da jangada, com 30% a menos de dano.',
            efeito: { tipo: 'proteger', reducao: 0.3 } },
        { id: 'remada', classe: 'jangadeiro', nivel: 2, custo: 15, nome: 'Remada extra',
            descricao: 'Entrega uma atividade um dia depois do prazo, sem perder nada.',
            efeito: { tipo: 'privilegio' } },
        { id: 'ancora', classe: 'jangadeiro', nivel: 3, custo: 15, nome: 'Âncora',
            descricao: 'Firma o pé: recupera 20 de Vida.',
            efeito: { tipo: 'curar', valor: 20, alvo: 'si' } },
        { id: 'capitao', classe: 'jangadeiro', nivel: 5, custo: 30, nome: 'Capitão da travessia',
            descricao: 'Escolhe o próprio lugar na sala por uma semana.',
            efeito: { tipo: 'privilegio' } },

        { id: 'ponto', classe: 'rendeiro', nivel: 1, custo: 10, nome: 'Ponto de cura',
            descricao: 'Devolve 15 de Vida a um colega da jangada.',
            efeito: { tipo: 'curar', valor: 15, alvo: 'colega' } },
        { id: 'bilro', classe: 'rendeiro', nivel: 2, custo: 15, nome: 'Bilro ligeiro',
            descricao: 'Ouve música no fone durante uma atividade individual.',
            efeito: { tipo: 'privilegio' } },
        { id: 'renda', classe: 'rendeiro', nivel: 3, custo: 30, nome: 'Renda coletiva',
            descricao: 'Devolve 10 de Vida a toda a jangada.',
            efeito: { tipo: 'curar', valor: 10, alvo: 'jangada' } },
        { id: 'mestra', classe: 'rendeiro', nivel: 5, custo: 30, nome: 'Mãos de mestre(a)',
            descricao: 'Tira uma dúvida com o professor durante uma avaliação.',
            efeito: { tipo: 'privilegio' } },

        { id: 'verso', classe: 'cordelista', nivel: 1, custo: 10, nome: 'Verso de ânimo',
            descricao: 'Passa 8 de Energia para um colega da jangada.',
            efeito: { tipo: 'energizar', valor: 8, alvo: 'colega' } },
        { id: 'rima', classe: 'cordelista', nivel: 2, custo: 15, nome: 'Rima de bolso',
            descricao: 'Troca uma questão de uma atividade por outra do mesmo assunto.',
            efeito: { tipo: 'privilegio' } },
        { id: 'peleja', classe: 'cordelista', nivel: 3, custo: 25, nome: 'Peleja',
            descricao: 'Passa 6 de Energia para cada colega da jangada.',
            efeito: { tipo: 'energizar', valor: 6, alvo: 'jangada' } },
        { id: 'folheto', classe: 'cordelista', nivel: 5, custo: 35, nome: 'Folheto premiado',
            descricao: 'Escolhe o tema de uma atividade da turma.',
            efeito: { tipo: 'privilegio' } }
    ];

    const COMPORTAMENTOS_BASE = [
        { id: 'participacao', nome: 'Participação ativa', tipo: 'positivo', xp: 20, icone: '🙋' },
        { id: 'ajudou', nome: 'Ajudou um colega', tipo: 'positivo', xp: 30, icone: '🤝' },
        { id: 'entregou', nome: 'Atividade no prazo', tipo: 'positivo', xp: 20, icone: '📬' },
        { id: 'superacao', nome: 'Superação (melhorou)', tipo: 'positivo', xp: 40, icone: '📈' },
        { id: 'pontual', nome: 'Chegou no horário', tipo: 'positivo', xp: 10, icone: '⏰' },
        { id: 'farda', nome: 'Fardamento completo', tipo: 'positivo', xp: 10, icone: '👕' },
        { id: 'lideranca', nome: 'Liderou a jangada', tipo: 'positivo', xp: 30, icone: '🧭' },
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
       reconhecimentos do dia vale mais), semDano (ninguém perde Vida hoje),
       desafio (só o texto: o professor decide se a turma conseguiu). */
    const EVENTOS = [
        { id: 'aracati', nome: 'Vento Aracati', icone: '🌬️',
            texto: 'O vento da tarde chegou mais cedo: todo reconhecimento de hoje vale o dobro de XP.',
            efeito: { tipo: 'multiplicador', valor: 2 } },
        { id: 'chuva', nome: 'Chuva no sertão', icone: '🌧️',
            texto: 'Choveu no sertão! Todos ganham 10 de Energia.',
            efeito: { tipo: 'energia', valor: 10 } },
        { id: 'cajueiro', nome: 'Sombra de cajueiro', icone: '🌳',
            texto: 'Descanso na sombra: todos recuperam 10 de Vida.',
            efeito: { tipo: 'vida', valor: 10 } },
        { id: 'estrelas', nome: 'Céu estrelado', icone: '✨',
            texto: 'Noite limpa no litoral: todos ganham 15 XP.',
            efeito: { tipo: 'xp', valor: 15 } },
        { id: 'calmaria', nome: 'Mar de calmaria', icone: '🌊',
            texto: 'Mar manso: hoje ninguém perde Vida. Aproveitem para ajustar as velas.',
            efeito: { tipo: 'semDano' } },
        { id: 'repente', nome: 'Hora do repente', icone: '🪕',
            texto: 'Desafio: um(a) estudante sorteado(a) improvisa uma rima sobre o conteúdo da aula. Se sair, todos ganham 20 XP.',
            efeito: { tipo: 'desafio', xp: 20 } },
        { id: 'mutirao', nome: 'Mutirão', icone: '🧺',
            texto: 'Desafio: a turma inteira entrega a atividade de hoje. Se conseguir, todos ganham 25 XP.',
            efeito: { tipo: 'desafio', xp: 25 } },
        { id: 'feira', nome: 'Dia de feira', icone: '🛒',
            texto: 'Quem ajudar um colega hoje ganha o reconhecimento em dobro.',
            efeito: { tipo: 'multiplicador', valor: 2, so: 'ajudou' } },
        { id: 'farol', nome: 'Luz do farol', icone: '🗼',
            texto: 'Dia de foco: nada de especial acontece. O farol só ilumina o caminho.',
            efeito: { tipo: 'nenhum' } }
    ];

    const CHEFES = [
        { id: 'redemoinho', nome: 'Redemoinho do Sertão', icone: '🌪️', vida: 8, xp: 40,
            texto: 'Gira a poeira e embaralha as ideias. Só cai com respostas certeiras.' },
        { id: 'mare', nome: 'Maré Braba', icone: '🌊', vida: 10, xp: 50,
            texto: 'Vira jangada desatenta. Remem juntos!' },
        { id: 'seca', nome: 'Seca Grande', icone: '☀️', vida: 12, xp: 60,
            texto: 'Racha a terra e cansa o povo. Cada acerto é uma gota de chuva.' },
        { id: 'labirinto', nome: 'Labirinto do Cordel', icone: '🌀', vida: 6, xp: 30,
            texto: 'Versos que se enrolam. Leia com calma e ache a saída.' }
    ];

    /* Missões de reparação: o caminho de volta de quem caiu. O estudante
       volta com metade da Vida quando a missão é concluída. */
    const REPARACOES = [
        { id: 'conversa', nome: 'Conversa restaurativa com o(a) PDT' },
        { id: 'ajuda', nome: 'Ajudar um colega numa atividade' },
        { id: 'carta', nome: 'Escrever uma reflexão sobre o que aconteceu' },
        { id: 'solucao', nome: 'Propor uma solução para o problema causado' },
        { id: 'cuidado', nome: 'Cuidar de um espaço da escola com a jangada' }
    ];

    const PADRAO = {
        versao: 1,
        energiaInicial: 10,
        energiaPorDia: 5,
        vidaPorDia: 2,
        bonusNivelEnergia: 10,
        voltaDaQueda: 0.5,       // fração da Vida máxima ao concluir a reparação
        solidariedade: 0,        // Vida que os colegas perdem quando alguém cai (0 = desligado)
        presenca: { bonusACada: 5, xp: 25 },
        moeda: { porNivel: 10 }, // moeda ganha a cada nível
        tamanhoJangada: 5
    };

    function copiar(x) { return JSON.parse(JSON.stringify(x)); }

    /* XP total para chegar ao nível L: 0, 100, 300, 600, 1000, 1500... */
    function xpParaNivel(nivel) { return 50 * (nivel - 1) * nivel; }

    function nivelPorXp(xp) {
        let nivel = 1;
        while (xp >= xpParaNivel(nivel + 1)) nivel++;
        return nivel;
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
        for (const chave of ['classes', 'poderes', 'comportamentos', 'eventos', 'chefes', 'reparacoes']) {
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
        for (const c of regras.comportamentos) {
            if (!['positivo', 'negativo'].includes(c.tipo)) erros.push(`Comportamento "${c.id}": tipo deve ser positivo ou negativo.`);
            if (c.tipo === 'positivo' && !(c.xp > 0)) erros.push(`Comportamento "${c.id}": precisa de XP maior que zero.`);
            if (c.tipo === 'negativo' && !(c.vida > 0)) erros.push(`Comportamento "${c.id}": precisa de Vida maior que zero.`);
        }
        for (const lista of ['classes', 'poderes', 'comportamentos', 'eventos', 'chefes', 'reparacoes']) {
            if (ids(regras[lista]).size !== regras[lista].length) erros.push(`Há ids repetidos em "${lista}".`);
        }
        return erros;
    }

    const api = {
        CLASSES, PODERES, EVENTOS, CHEFES, REPARACOES,
        xpParaNivel, nivelPorXp, comportamentosPadrao, regrasPadrao, validar, copiar
    };

    global.JangadaRegras = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
