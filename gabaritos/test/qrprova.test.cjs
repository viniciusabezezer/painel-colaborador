/* O Malu Gabaritos lê o QR novo da prova e o QR antigo, de duas linhas.
   Rode com:  node --test gabaritos/test/qrprova.test.cjs */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const leitor = require(path.join(__dirname, '..', 'js', 'qrprova.js'));
const contrato = require(path.join(__dirname, '..', '..', 'provas', 'js', 'qrprova.js'));

const CODIGO = 'MLS-2026-B3-1A-007-LIN-DRYT';
const NOVO = 'MLSPROVA1|' + CODIGO + '|1A|007|ESTUDANTE+FICTICIO+07|AVALIACAO+BIMESTRAL|20260007';
const ANTIGO = CODIGO + '\nESTUDANTE FICTÍCIO 07';

test('o leitor do Gabaritos é o mesmo contrato do Identificador', () => {
    [NOVO, ANTIGO, CODIGO, 'MLSPRESENTE|credencial|abc', ''].forEach(function (texto) {
        assert.deepEqual(leitor.ler(texto), contrato.ler(texto));
    });
});

test('lê o QR novo e devolve o código que o Gabaritos já usa', () => {
    const lido = leitor.ler(NOVO);
    assert.equal(lido.formato, 'MLSPROVA1');
    assert.equal(lido.codigo, CODIGO);
    assert.equal(lido.turma, '1A');
    assert.equal(lido.numero, '007');
    assert.equal(lido.nome, 'ESTUDANTE FICTICIO 07');
    assert.equal(lido.titulo, 'AVALIACAO BIMESTRAL');
    assert.equal(lido.matricula, '20260007');
    assert.ok(!/credencial|token|segredo/i.test(JSON.stringify(lido)));
});

test('lê o QR antigo das provas já impressas e ignora o que não é prova', () => {
    const lido = leitor.ler(ANTIGO);
    assert.equal(lido.formato, 'antigo');
    assert.equal(lido.codigo, CODIGO);
    assert.equal(lido.turma, '1A');
    assert.equal(lido.numero, '007');
    assert.equal(lido.nome, 'ESTUDANTE FICTÍCIO 07');
    assert.equal(lido.matricula, '');
    assert.equal(leitor.ler('MLSPRESENTE|credencial|abc'), null);
    assert.equal(leitor.ler('TOKEN-DO-CARTAO-QUE-NAO-PODE'), null);
});

test('a turma do QR desempata o mesmo número de lista', () => {
    const alunos = [
        { nome: 'Estudante Fictício 07', turma: '1º A', lista: 7, codigo: 'AAA' },
        { nome: 'Outra Pessoa', turma: '1º B', lista: 7, codigo: 'BBB' }
    ];
    const novo = leitor.ler(NOVO);
    const antigo = leitor.ler(ANTIGO);
    assert.equal(leitor.casarAluno(alunos, 7, novo).codigo, 'AAA');
    assert.equal(leitor.casarAluno(alunos, 7, antigo).codigo, 'AAA');
    assert.equal(leitor.casarAluno(alunos, 7, null).codigo, 'AAA');
    assert.equal(leitor.escolher('', ANTIGO), ANTIGO);
    assert.equal(leitor.escolher(NOVO, ANTIGO), NOVO);
    assert.equal(leitor.escolher('credencial-do-cartao', ''), '');
});
