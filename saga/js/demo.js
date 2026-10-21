/* Turma de demonstração, para conhecer o jogo sem cadastrar ninguém. Os
   nomes são inventados (nenhum é de estudante real) e duas semanas de
   aula são simuladas para o Conselheiro ter o que mostrar. */
(function (global) {
    'use strict';

    const node = typeof module !== 'undefined' && module.exports;
    const Motor = node ? require('./motor.js') : global.SagaMotor;
    const Conselheiro = node ? require('./conselheiro.js') : global.SagaConselheiro;

    const NOMES = [
        'Ana Clara', 'Bruno', 'Cauã', 'Davi Lucas', 'Emanuelly', 'Francisco', 'Gabriela', 'Heitor',
        'Iara', 'João Pedro', 'Kaylane', 'Luana', 'Marcos Vinícius', 'Nicole', 'Otávio', 'Pietra',
        'Rafael', 'Samara', 'Thiago', 'Vitória', 'Wesley', 'Yasmin'
    ];

    /* Gerador com semente: a demonstração sai sempre igual. */
    function sementeira(semente) {
        let s = semente >>> 0;
        return function () {
            s = (s * 1664525 + 1013904223) >>> 0;
            return s / 4294967296;
        };
    }

    function gerar(regras, turma, hojeISO, professor) {
        const rnd = sementeira(2018);
        const eventos = [];
        const hoje = new Date(hojeISO || Date.now());
        const quando = (diasAtras, hora, minuto) => {
            const d = new Date(hoje);
            d.setDate(d.getDate() - diasAtras);
            d.setHours(hora, minuto || 0, 0, 0);
            return d.toISOString();
        };
        let seq = 0;
        const ev = (tipo, dados, t) => {
            eventos.push(Motor.criarEvento(tipo, dados, { agora: t, autor: professor || 'Demonstração', id: `demo-${String(seq++).padStart(4, '0')}` }));
        };

        const classes = regras.classes.map((c) => c.id);
        const alunos = NOMES.map((nome, i) => ({ id: `demo-a${i}`, nome, turma, classe: classes[i % classes.length], xp: 0 }));
        const inicio = quando(15, 7, 0);
        for (const a of alunos) ev('aluno.novo', { aluno: { id: a.id, nome: a.nome, turma, classe: a.classe } }, inicio);
        const sugestao = Conselheiro.formarGuildas(alunos, regras.tamanhoGuilda, { prefixoId: 'demo-j' });
        ev('guildas.formar', { turma, guildas: sugestao.guildas, membros: sugestao.membros }, quando(15, 7, 1));

        const positivos = regras.comportamentos.filter((c) => c.tipo === 'positivo');
        const negativos = regras.comportamentos.filter((c) => c.tipo === 'negativo' && !c.ocorrencia);
        const sorteio = (lista) => lista[Math.floor(rnd() * lista.length)];
        const quieto = 'demo-a7';     // ninguém reconhece: o Conselheiro aponta
        const dificil = 'demo-a3';    // acumula descontos na semana atual
        const faltoso = 'demo-a10';   // falta os últimos dias

        const letivos = [];
        for (let dias = 14; dias >= 1; dias--) {
            const dia = new Date(quando(dias, 7));
            if (dia.getDay() !== 0 && dia.getDay() !== 6) letivos.push(dias);
        }
        const ultimos = new Set(letivos.slice(-3));
        const semana = new Set(letivos.slice(-5));
        for (const dias of letivos) {
            ev('novoDia', { turma, evento: sorteio(regras.eventos) }, quando(dias, 7, 5));
            const ausentes = alunos.filter((a) => (a.id === faltoso && ultimos.has(dias)) || (a.id !== faltoso && rnd() < 0.06)).map((a) => a.id);
            ev('presenca', { turma, ausentes }, quando(dias, 7, 10));
            for (let k = 0; k < 7; k++) {
                const a = sorteio(alunos.filter((x) => x.id !== quieto && !ausentes.includes(x.id)));
                ev('comportamento', { alunoIds: [a.id], comportamento: sorteio(positivos) }, quando(dias, 8 + k, 10));
            }
            if (rnd() < 0.5) {
                const a = sorteio(alunos.filter((x) => x.id !== quieto && x.id !== dificil && !ausentes.includes(x.id)));
                ev('comportamento', { alunoIds: [a.id], comportamento: sorteio(negativos) }, quando(dias, 10, 40));
            }
            if (semana.has(dias)) ev('comportamento', { alunoIds: [dificil], comportamento: sorteio(negativos) }, quando(dias, 11, 15));
        }
        ev('missao.nova', {
            missao: {
                id: 'demo-m1', titulo: 'Desafio de leitura: fato ou opinião?', area: 'Linguagens e Códigos',
                habilidade: 'D14 — Distinguir um fato da opinião relativa a esse fato', xp: 50, moeda: 5,
                turmas: [turma], prazo: '', descricao: 'Ler a notícia e marcar o que é fato e o que é opinião.'
            }
        }, quando(6, 9));
        ev('missao.concluir', { missaoId: 'demo-m1', alunoIds: alunos.filter((a) => a.id !== quieto).slice(0, 9).map((a) => a.id) }, quando(3, 15));
        return eventos;
    }

    const api = { gerar, NOMES };
    global.SagaDemo = api;
    if (node) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
