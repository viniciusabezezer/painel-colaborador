/* Testes do motor, do Conselheiro e do backup (tudo que não depende de
   navegador). Rode com:  node --test jangada/test/            */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const js = path.join(__dirname, '..', 'js');
const Regras = require(path.join(js, 'regras.js'));
const Escola = require(path.join(js, 'escola.js'));
const Motor = require(path.join(js, 'motor.js'));
const Conselheiro = require(path.join(js, 'conselheiro.js'));
const Armazem = require(path.join(js, 'armazem.js'));
const Questoes = require(path.join(js, 'questoes.js'));
const Demo = require(path.join(js, 'demo.js'));

const regras = Regras.regrasPadrao('EEMTI');
const comp = (id) => regras.comportamentos.find((c) => c.id === id);
const evento = (id) => regras.eventos.find((e) => e.id === id);

/* Fábrica de eventos com horário crescente e id previsível. */
function roteiro(inicio) {
    let t = new Date(inicio || '2026-10-19T10:00:00Z').getTime();
    let n = 0;
    const eventos = [];
    const add = (tipo, dados, opcoes) => {
        t += 60000;
        const ev = Motor.criarEvento(tipo, dados, Object.assign({ agora: t, id: `t${String(n++).padStart(4, '0')}`, autor: 'Prof. Teste' }, opcoes));
        eventos.push(ev);
        return ev;
    };
    return { eventos, add, estado: () => Motor.reproduzir(eventos, regras) };
}

function turmaBasica(r) {
    r.add('aluno.novo', { aluno: { id: 'jg', nome: 'Jangadeira', turma: '1ª A', classe: 'jangadeiro', jangada: 'J1' } });
    r.add('aluno.novo', { aluno: { id: 'rd', nome: 'Rendeiro', turma: '1ª A', classe: 'rendeiro', jangada: 'J1' } });
    r.add('aluno.novo', { aluno: { id: 'cd', nome: 'Cordelista', turma: '1ª A', classe: 'cordelista', jangada: 'J1' } });
    r.add('jangada.nova', { jangada: { id: 'J1', nome: 'Pedra Rachada', turma: '1ª A' } });
}

/* ===== regras ===== */

test('curva de níveis: 0, 100, 300, 600, 1000 XP', () => {
    assert.deepEqual([1, 2, 3, 4, 5].map(Regras.xpParaNivel), [0, 100, 300, 600, 1000]);
    assert.equal(Regras.nivelPorXp(0), 1);
    assert.equal(Regras.nivelPorXp(99), 1);
    assert.equal(Regras.nivelPorXp(100), 2);
    assert.equal(Regras.nivelPorXp(1000), 5);
});

test('regras padrão são válidas e mudam com o tipo de escola', () => {
    for (const tipo of ['EEMTI', 'EEEP', 'EEM']) assert.deepEqual(Regras.validar(Regras.regrasPadrao(tipo)), []);
    assert.ok(Regras.regrasPadrao('EEMTI').comportamentos.some((c) => c.id === 'ntpps'));
    assert.ok(Regras.regrasPadrao('EEEP').comportamentos.some((c) => c.id === 'estagio'));
    assert.ok(!Regras.regrasPadrao('EEM').comportamentos.some((c) => c.id === 'ntpps'));
});

test('validar aponta regras quebradas', () => {
    const r = Regras.regrasPadrao('EEM');
    r.poderes[0].classe = 'mago';
    r.comportamentos[0].xp = 0;
    const erros = Regras.validar(r);
    assert.ok(erros.some((e) => e.includes('mago')));
    assert.ok(erros.some((e) => e.includes('XP maior que zero')));
});

/* ===== escola ===== */

test('turmas digitadas de jeitos diferentes viram o mesmo nome', () => {
    assert.equal(Escola.normalizarTurma('1a a'), '1ª A');
    assert.equal(Escola.normalizarTurma('2º B'), '2ª B');
    assert.equal(Escola.normalizarTurma('3 série C'), '3ª C');
    assert.equal(Escola.normalizarTurma('Informática 1'), 'Informática 1');
    assert.deepEqual(Escola.lerTurmas('1ªA, 1a A; 2ª B\n3ºC'), ['1ª A', '2ª B', '3ª C']);
});

test('perfil da MALU é válido e traz os PDTs', () => {
    const p = Escola.perfilPadrao();
    assert.deepEqual(Escola.validar(p), []);
    assert.equal(p.turmas.length, 8);
    assert.equal(p.pdts['3ª B'], 'Talita');
    assert.equal(Escola.rotulo(p), 'MALU · Paracuru · CREDE 2');
});

/* ===== motor ===== */

test('reconhecimento dá XP, sobe de nível, rende moeda e Energia', () => {
    const r = roteiro();
    turmaBasica(r);
    for (let i = 0; i < 4; i++) r.add('comportamento', { alunoIds: ['cd'], comportamento: comp('ajudou') });
    const e = r.estado();
    const a = e.alunos.cd;
    assert.equal(a.xp, 120);
    assert.equal(a.nivel, 2);
    assert.equal(a.moeda, regras.moeda.porNivel);
    assert.equal(a.energia, regras.energiaInicial + regras.bonusNivelEnergia);
    assert.ok(e.registros.some((x) => x.tipo === 'nivel' && x.alunoId === 'cd'));
});

test('desconto tira Vida, nunca XP; em zero o estudante cai', () => {
    const r = roteiro();
    turmaBasica(r);
    r.add('comportamento', { alunoIds: ['cd'], comportamento: comp('participacao') });
    for (let i = 0; i < 2; i++) r.add('comportamento', { alunoIds: ['cd'], comportamento: comp('desrespeito') });
    let e = r.estado();
    assert.equal(e.alunos.cd.xp, 20);
    assert.equal(e.alunos.cd.vida, 0);
    assert.equal(e.alunos.cd.caido, true);
    // caído não usa poder
    assert.match(Motor.motivoPoder(e, regras, 'cd', 'verso', 'rd'), /reparação/);
    // reparação devolve metade da Vida
    r.add('reparacao', { alunoId: 'cd', reparacao: regras.reparacoes[0] });
    e = r.estado();
    assert.equal(e.alunos.cd.caido, false);
    assert.equal(e.alunos.cd.vida, 25);
});

test('Jangadeiro(a) protege colega: leva o golpe com 30% a menos e gasta Energia', () => {
    const r = roteiro();
    turmaBasica(r);
    r.add('comportamento', { alunoIds: ['rd'], comportamento: comp('celular'), protecoes: { rd: 'jg' } });
    const e = r.estado();
    assert.equal(e.alunos.rd.vida, 60);
    assert.equal(e.alunos.jg.vida, 80 - 7);
    assert.equal(e.alunos.jg.energia, regras.energiaInicial - 10);
    // o desconto continua no histórico de quem errou (o Conselheiro precisa ver)
    assert.ok(e.registros.some((x) => x.alunoId === 'rd' && x.tipo === 'negativo'));
});

test('proteção inválida (sem Energia) cai em quem errou', () => {
    const r = roteiro();
    turmaBasica(r);
    r.add('comportamento', { alunoIds: ['rd'], comportamento: comp('celular'), protecoes: { rd: 'jg' } });
    r.add('comportamento', { alunoIds: ['rd'], comportamento: comp('celular'), protecoes: { rd: 'jg' } });
    const e = r.estado();
    assert.equal(e.alunos.jg.energia, 0);
    assert.equal(e.alunos.rd.vida, 50);
});

test('poderes: cura de colega, Energia para a jangada e validações', () => {
    const r = roteiro();
    turmaBasica(r);
    r.add('comportamento', { alunoIds: ['jg'], comportamento: comp('desrespeito') });
    r.add('poder', { alunoId: 'rd', poderId: 'ponto', alvoId: 'jg' });
    let e = r.estado();
    assert.equal(e.alunos.jg.vida, 80 - 25 + 15);
    assert.equal(e.alunos.rd.energia, 0);
    // sem Energia o segundo uso é ignorado com motivo
    r.add('poder', { alunoId: 'rd', poderId: 'ponto', alvoId: 'jg' });
    e = r.estado();
    assert.equal(e.ignorados.length, 1);
    assert.match(e.ignorados[0].motivo, /Energia/);
    assert.match(Motor.motivoPoder(e, regras, 'cd', 'peleja'), /nível 3/);
    assert.match(Motor.motivoPoder(e, regras, 'cd', 'ponto', 'jg'), /não é um poder/);
});

test('começar o dia: Energia volta, evento vale e não repete no mesmo dia', () => {
    const r = roteiro();
    turmaBasica(r);
    r.add('novoDia', { turma: '1ª A', evento: evento('aracati') });
    r.add('comportamento', { alunoIds: ['jg'], comportamento: comp('participacao') });
    r.add('novoDia', { turma: '1ª A', evento: evento('estrelas') });
    const e = r.estado();
    assert.equal(e.alunos.jg.xp, 40);
    assert.equal(e.alunos.jg.energia, regras.energiaInicial + regras.energiaPorDia);
    assert.equal(e.ignorados.length, 1);
});

test('mar de calmaria: ninguém perde Vida no dia, mas o registro fica', () => {
    const r = roteiro();
    turmaBasica(r);
    r.add('novoDia', { turma: '1ª A', evento: evento('calmaria') });
    r.add('comportamento', { alunoIds: ['cd'], comportamento: comp('atraso') });
    const e = r.estado();
    assert.equal(e.alunos.cd.vida, 50);
    assert.ok(e.registros.some((x) => x.tipo === 'negativo' && /calmaria/.test(x.texto)));
});

test('chamada: sequência de presença dá bônus e faltas seguidas são contadas', () => {
    const r = roteiro();
    turmaBasica(r);
    for (let d = 0; d < 5; d++) {
        r.add('presenca', { turma: '1ª A', ausentes: ['cd'] }, { agora: Date.UTC(2026, 9, 20 + d, 10) });
    }
    const e = r.estado();
    assert.equal(e.alunos.jg.xp, regras.presenca.xp);
    assert.equal(e.alunos.cd.faltasSeq, 5);
    assert.equal(e.alunos.cd.xp, 0);
});

test('desfazer remove o efeito e o evento some do estado', () => {
    const r = roteiro();
    turmaBasica(r);
    const ev = r.add('comportamento', { alunoIds: ['jg', 'rd'], comportamento: comp('ajudou') });
    r.add('desfazer', { alvo: ev.id });
    const e = r.estado();
    assert.equal(e.alunos.jg.xp, 0);
    assert.equal(e.registros.filter((x) => x.tipo === 'positivo').length, 0);
});

test('juntar dois aparelhos: une por id, sem duplicar, em ordem de horário', () => {
    const a = roteiro('2026-10-19T10:00:00Z');
    turmaBasica(a);
    const b = { eventos: a.eventos.slice() };
    a.add('comportamento', { alunoIds: ['jg'], comportamento: comp('ajudou') }, { id: 'celular-1' });
    b.eventos.push(Motor.criarEvento('comportamento', { alunoIds: ['rd'], comportamento: comp('ajudou') }, { agora: '2026-10-19T09:00:00Z', id: 'celular-2' }));
    const juntos = Motor.juntar(a.eventos, b.eventos);
    assert.equal(juntos.length, a.eventos.length + 1);
    const e = Motor.reproduzir(juntos, regras);
    assert.equal(e.alunos.jg.xp, 30);
    // o reconhecimento do celular 2 é anterior ao cadastro: ignorado com motivo, sem quebrar
    assert.equal(e.alunos.rd.xp, 0);
    assert.equal(e.ignorados.length, 1);
});

test('missão: XP e moeda uma vez por estudante, e moeda fica pendente para exportar', () => {
    const r = roteiro();
    turmaBasica(r);
    r.add('missao.nova', { missao: { id: 'm1', titulo: 'Fato ou opinião', xp: 50, moeda: 5, turmas: ['1ª A'] } });
    r.add('missao.concluir', { missaoId: 'm1', alunoIds: ['jg', 'rd'] });
    r.add('missao.concluir', { missaoId: 'm1', alunoIds: ['jg'] });
    let e = r.estado();
    assert.equal(e.alunos.jg.xp, 50);
    assert.equal(e.alunos.jg.moeda, 5);
    const pendente = Motor.moedaPendente(e);
    assert.equal(pendente.length, 2);
    r.add('moeda.exportar', { ids: pendente.map((p) => p.id) });
    e = r.estado();
    assert.equal(Motor.moedaPendente(e).length, 0);
});

test('batalha vencida dá o XP do chefe aos participantes', () => {
    const r = roteiro();
    turmaBasica(r);
    const chefe = regras.chefes[0];
    r.add('batalha', { turma: '1ª A', chefe, vitoria: true, participantes: ['jg', 'cd'] });
    const e = r.estado();
    assert.equal(e.alunos.jg.xp, chefe.xp);
    assert.equal(e.alunos.rd.xp, 0);
});

/* ===== conselheiro ===== */

test('formar jangadas: tamanhos parecidos e as três classes em cada uma', () => {
    const classes = ['jangadeiro', 'rendeiro', 'cordelista'];
    const alunos = Array.from({ length: 30 }, (_, i) => ({ id: `a${i}`, nome: `A${i}`, classe: classes[i % 3], xp: i * 37 % 500 }));
    const s = Conselheiro.formarJangadas(alunos, 5);
    assert.equal(s.jangadas.length, 6);
    for (const j of s.jangadas) {
        const m = alunos.filter((a) => s.membros[a.id] === j.id);
        assert.equal(m.length, 5);
        assert.equal(new Set(m.map((a) => a.classe)).size, 3);
    }
    // determinístico
    assert.deepEqual(Conselheiro.formarJangadas(alunos, 5), s);
});

test('sorteio justo: quem participou menos tem mais chance e ausente não sai', () => {
    const r = roteiro();
    turmaBasica(r);
    for (let i = 0; i < 6; i++) r.add('comportamento', { alunoIds: ['jg'], comportamento: comp('participacao') });
    r.add('presenca', { turma: '1ª A', ausentes: ['cd'] });
    const e = r.estado();
    const hoje = r.eventos[r.eventos.length - 1].data;
    const contagem = { jg: 0, rd: 0, cd: 0 };
    for (let i = 0; i < 100; i++) contagem[Conselheiro.sortear(e, '1ª A', hoje, () => i / 100).id]++;
    assert.equal(contagem.cd, 0);
    assert.ok(contagem.rd > contagem.jg * 5, JSON.stringify(contagem));
});

test('demonstração: o Conselheiro acha o invisível, o padrão de descontos e a Busca Ativa', () => {
    const hoje = '2026-10-20T12:00:00';
    const eventos = Demo.gerar(regras, '1ª A', hoje);
    const e = Motor.reproduzir(eventos, regras);
    assert.equal(e.ignorados.length, 0, JSON.stringify(e.ignorados.slice(0, 3)));
    const al = Conselheiro.alertas(e, regras, '1ª A', Motor.dataLocal(hoje), Escola.perfilPadrao());
    const tipos = (id) => al.filter((a) => a.alunoId === id).map((a) => a.tipo);
    assert.ok(tipos('demo-a7').includes('invisivel'), JSON.stringify(al.map((a) => a.titulo)));
    assert.ok(tipos('demo-a3').includes('padrao') || tipos('demo-a3').includes('queda'), JSON.stringify(tipos('demo-a3')));
    assert.ok(tipos('demo-a10').includes('faltas'));
    const resumo = Conselheiro.resumoPDT(e, regras, Escola.perfilPadrao(), '1ª A', Motor.dataLocal(hoje));
    assert.match(resumo, /PDT Simone B/);
    assert.match(resumo, /Pedem atenção/);
});

test('jangadas desequilibradas são apontadas', () => {
    const r = roteiro();
    turmaBasica(r);
    r.add('aluno.novo', { aluno: { id: 'x1', nome: 'Sem barco 1', turma: '1ª A', classe: 'rendeiro' } });
    r.add('aluno.novo', { aluno: { id: 'x2', nome: 'Sem barco 2', turma: '1ª A', classe: 'cordelista' } });
    const eq = Conselheiro.equilibrio(r.estado(), regras, '1ª A');
    assert.equal(eq.desequilibrada, true);
    assert.match(eq.motivo, /sem jangada/);
});

/* ===== backup e questões ===== */

test('backup vai e volta; arquivo estranho é recusado', () => {
    const dados = Object.assign(Armazem.vazio(), { perfil: Escola.perfilPadrao(), regras, eventos: [{ id: 'x', t: 't', tipo: 'bonus' }] });
    const texto = JSON.stringify(Armazem.paraBackup(dados));
    assert.deepEqual(Armazem.lerBackup(texto).backup.eventos, dados.eventos);
    assert.ok(Armazem.lerBackup('{"a":1}').erro);
    assert.ok(Armazem.lerBackup('não é json').erro);
});

test('salvar e carregar num armazenamento falso', () => {
    const mem = new Map();
    const ls = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, v) };
    assert.equal(Armazem.salvar({ professor: 'Ana', eventos: [] }, ls), null);
    assert.equal(Armazem.carregar(ls).professor, 'Ana');
    const cheio = { getItem: () => null, setItem: () => { throw new Error('QuotaExceeded'); } };
    assert.match(Armazem.salvar({}, cheio), /espaço/);
});

test('CSV da moeda sai com ; e aspas onde precisa', () => {
    const csv = Armazem.csvMoeda([{ alunoId: 'a', turma: '1ª A', moeda: 10, texto: 'Missão: "ler"; resumir', data: '2026-10-20' }], { a: { nome: 'Ana', codigo: 'MALU-123' } });
    assert.match(csv, /^﻿codigo;estudante;turma;valor;motivo;data\n/);
    assert.match(csv, /MALU-123;Ana;1ª A;10;"Missão: ""ler""; resumir";20\/10\/2026/);
});

test('questões coladas: várias de uma vez, com erros apontados', () => {
    const { questoes, erros } = Questoes.lerColadas(`Quanto é 2 + 2?
A) 3
B) 4
C) 5
Resposta: B

Sem alternativas
Resposta: A`);
    assert.equal(questoes.length, 1);
    assert.equal(questoes[0].correta, 1);
    assert.deepEqual(questoes[0].alternativas, ['3', '4', '5']);
    assert.equal(erros.length, 1);
    for (const q of Questoes.EXEMPLOS) assert.ok(q.correta < q.alternativas.length);
});
