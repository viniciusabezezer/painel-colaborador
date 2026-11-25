/* Importar do Montador: as provas travadas, a seleção, o pareamento dos PDFs.
   Rode com:  node --test provas/test/importar.test.cjs */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const raiz = path.join(__dirname, '..', '..');
const Importar = require(path.join(raiz, 'provas', 'js', 'importar.js'));
const Chave = require(path.join(raiz, 'provas', 'js', 'chaveprova.js'));
const Modelos = require(path.join(raiz, 'montar', 'js', 'modelos.js'));
const Gabaritos = require(path.join(raiz, 'gabaritos', 'js', 'identificar.js'));

const linha = (id, extra) => Object.assign({
    id, titulo: 'Avaliação Bimestral', componente: 'LIN', serie: '1', bimestre: 'B3', ano: '2026', situacao: 'travada'
}, extra || {});

const ID_LIN1 = '8f3a2c1d-5b6e-4a77-9c10-aabbccddeeff';
const ID_NAT1 = '11112222-5b6e-4a77-9c10-aabbccddeeff';
const ID_LIN2 = '33334444-5b6e-4a77-9c10-aabbccddeeff';
const ID_B2 = '55556666-5b6e-4a77-9c10-aabbccddeeff';

const PROVAS = Importar.normalizarTodas([
    linha(ID_LIN1),
    linha(ID_NAT1, { componente: 'NAT', titulo: 'Avaliação de Ciências da Natureza' }),
    linha(ID_LIN2, { serie: '2' }),
    linha(ID_B2, { bimestre: 'B2' })
]).provas;
const lin1 = PROVAS[0], nat1 = PROVAS[1], lin2 = PROVAS[2], b2 = PROVAS[3];

/* ===== a chave é a mesma nos três programas ===== */

test('o Montador, o Identificador e o Gabaritos tiram a mesma chave do mesmo id', () => {
    [ID_LIN1, ID_NAT1, '00000000-0000-4000-8000-000000000000', 'ABCDEF12-0000-4000-8000-000000000000'].forEach((id) => {
        const doMontador = Modelos.chaveDaProva({ nuvem: { id } });
        assert.equal(Importar.chaveDoId(id), doMontador);
        assert.equal(Gabaritos.chaveDaProva(id), doMontador);
        assert.match(doMontador, /^[0-9A-F]{8}$/);
    });
    assert.equal(Importar.chaveDoId('demo-cn'), '');
});

/* ===== as provas do banco ===== */

test('uma linha do banco vira a prova do Identificador, com a chave', () => {
    assert.deepEqual(lin1, { id: ID_LIN1, chave: '8F3A2C1D', titulo: 'Avaliação Bimestral', componente: 'LIN', serie: '1', bimestre: 'B3', ano: '2026' });
    assert.equal(Importar.rotulo(lin1), 'Linguagens e Códigos · 1ª série · 3º bimestre de 2026');
    assert.equal(Importar.chaveSlot(lin1), '1|LIN');
});

test('prova de formato livre, sem série ou sem componente da escola, fica de fora', () => {
    const r = Importar.normalizarTodas([
        linha(ID_LIN1),
        linha(ID_NAT1, { serie: null }),
        linha(ID_LIN2, { serie: '' }),
        linha(ID_B2, { componente: 'XYZ' }),
        linha('demo-cn'),
        linha(ID_LIN1, { bimestre: 'B9' }),
        linha(ID_LIN1, { ano: '26' })
    ]);
    assert.equal(r.provas.length, 1);
    assert.equal(r.descartadas, 6);
    assert.equal(Importar.normalizar(null), null);
});

test('agrupa por bimestre (o mais novo primeiro) e ordena por série e componente', () => {
    const g = Importar.agrupar(PROVAS);
    assert.deepEqual(g.map((x) => x.rotulo), ['3º bimestre de 2026', '2º bimestre de 2026']);
    assert.deepEqual(g[0].provas.map((p) => p.chave), [lin1.chave, nat1.chave, lin2.chave], '1ª série: LIN, NAT; depois a 2ª');
    assert.deepEqual(g[1].provas.map((p) => p.chave), [b2.chave]);
});

/* ===== a seleção ===== */

test('a seleção tem de ser de um bimestre só, e uma prova por série e componente', () => {
    const ok = Importar.validarSelecao([lin1, nat1, lin2]);
    assert.equal(ok.ok, true);
    assert.equal(ok.ano, '2026');
    assert.equal(ok.bimestre, 'B3');
    assert.equal(ok.titulo, 'Avaliação Bimestral');

    const misturou = Importar.validarSelecao([lin1, b2]);
    assert.equal(misturou.ok, false);
    assert.match(misturou.erro, /bimestre só: há 3º bimestre de 2026 e 2º bimestre de 2026/);

    const segundaChamada = Importar.normalizar(linha('77778888-5b6e-4a77-9c10-aabbccddeeff', { titulo: 'Segunda chamada' }));
    const dupla = Importar.validarSelecao([lin1, segundaChamada]);
    assert.equal(dupla.ok, false);
    assert.match(dupla.erro, /duas provas para Linguagens e Códigos da 1ª série/);

    assert.equal(Importar.validarSelecao([]).ok, false);
});

/* ===== cada PDF vai para a prova dele ===== */

const infoDe = (nome) => Chave.doTexto(nome);

test('o PDF é pareado pela chave com a prova importada, seja prova ou gabarito', () => {
    const prova = Importar.parear(infoDe('PROVA-2026-B3-1S-LIN-K8F3A2C1D.pdf'), PROVAS);
    assert.equal(prova.prova.id, ID_LIN1);
    assert.equal(prova.tipo, 'prova');
    const gabarito = Importar.parear(infoDe('PROVA-2026-B3-1S-LIN-K8F3A2C1D-GABARITO.pdf'), PROVAS);
    assert.equal(gabarito.prova.id, ID_LIN1);
    assert.equal(gabarito.tipo, 'gabarito');
    assert.equal(Importar.parear(infoDe('PROVA-2026-B3-1S-NAT-K11112222'), PROVAS).prova.id, ID_NAT1);
});

test('a chave decide, não o nome: arquivo de nome trocado vai para a prova da chave', () => {
    /* o nome diz Linguagens, mas a chave é a da prova de Ciências */
    const r = Importar.parear(infoDe('PROVA-2026-B3-1S-LIN-K11112222'), PROVAS);
    assert.equal(r.prova.id, ID_NAT1);
});

test('o que não pode entrar não é pareado e a mensagem diz por quê', () => {
    const professor = Importar.parear(infoDe('PROVA-2026-B3-1S-LIN-GABARITO-PROFESSOR.pdf'), PROVAS);
    assert.equal(professor.prova, null);
    assert.match(Importar.mensagem(professor), /folha do professor/);

    const info4 = infoDe('PROVA-2026-B3-1S-LIN-K8F3A2C1D-GABARITOS-4-POR-FOLHA.pdf');
    const quatro = Importar.parear(info4, PROVAS);
    assert.equal(quatro.motivo, 'quatro');
    assert.match(Importar.mensagem(quatro), /4 gabaritos por folha/);

    const infoOutra = infoDe('PROVA-2026-B3-1S-HUM-KDEADBEEF.pdf');
    const desconhecida = Importar.parear(infoOutra, PROVAS);
    assert.equal(desconhecida.motivo, 'desconhecida');
    assert.match(Importar.mensagem(desconhecida, infoOutra), /chave DEADBEEF não é de nenhuma das provas importadas/);

    const semChave = Importar.parear(infoDe('PROVA-2026-B3-1S-LIN.pdf'), PROVAS);
    assert.equal(semChave.motivo, 'sem-chave');
    assert.match(Importar.mensagem(semChave), /não tem a chave da prova/);
    assert.equal(Importar.parear(null, PROVAS).motivo, 'sem-chave', 'PDF que não diz nada');
});

test('a mensagem de um PDF pareado diz de qual prova ele é', () => {
    const r = Importar.parear(infoDe('PROVA-2026-B3-1S-LIN-K8F3A2C1D-GABARITO.pdf'), PROVAS);
    assert.equal(Importar.mensagem(r), 'Gabarito de Linguagens e Códigos · 1ª série · 3º bimestre de 2026 (chave 8F3A2C1D).');
});

/* ===== as turmas ===== */

test('as turmas para escolher são A a F de cada série das provas importadas', () => {
    assert.deepEqual(Importar.turmasDasSeries([lin1, nat1]), ['1A', '1B', '1C', '1D', '1E', '1F']);
    assert.deepEqual(Importar.turmasDasSeries([lin2, lin1]).slice(0, 7), ['1A', '1B', '1C', '1D', '1E', '1F', '2A']);
    assert.equal(Importar.turmasDasSeries([]).length, 18, 'sem prova importada, as três séries');
});

test('turmas novas entram no lugar das de mesmo nome e as outras ficam, com as edições', () => {
    const atuais = [{ turma: '1A', alunos: [{ numero: 1, nome: 'Ana editada' }] }, { turma: '2A', alunos: [{ numero: 1, nome: 'Eva' }] }];
    const novas = [{ turma: '1A', alunos: [{ numero: 1, nome: 'Ana oficial' }, { numero: 2, nome: 'Bia' }] }, { turma: '1B', alunos: [{ numero: 1, nome: 'Caio' }] }];
    const juntas = Importar.juntarTurmas(atuais, novas);
    assert.deepEqual(juntas.map((t) => t.turma), ['1A', '1B', '2A']);
    assert.equal(juntas[0].alunos[0].nome, 'Ana oficial', 'a turma puxada de novo vale a oficial');
    assert.equal(juntas[2].alunos[0].nome, 'Eva', 'a que não foi puxada fica como está');
    assert.deepEqual(Importar.juntarTurmas([], novas).map((t) => t.turma), ['1A', '1B']);
});
