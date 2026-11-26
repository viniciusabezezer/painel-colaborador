/* A chave da prova: do PDF do Montador para o QR de cada aluno.
   Rode com:  node --test provas/test/chaveprova.test.cjs */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const raiz = path.join(__dirname, '..', '..');
const Chave = require(path.join(raiz, 'provas', 'js', 'chaveprova.js'));
const Qr = require(path.join(raiz, 'provas', 'js', 'qrprova.js'));
const Leitor = require(path.join(raiz, 'gabaritos', 'js', 'qrprova.js'));
const Identificacao = require(path.join(raiz, 'provas', 'js', 'identificacao.js'));
const Modelos = require(path.join(raiz, 'montar', 'js', 'modelos.js'));
const PDFLib = require(path.join(raiz, 'provas', 'vendor', 'pdf-lib.min.js'));
const gerador = require(path.join(raiz, 'provas', 'js', 'qr.js'));

const ID = '8f3a2c1d-5b6e-4a77-9c10-aabbccddeeff';

/* ===== o Montador dá a chave ao PDF ===== */

test('a chave são os 8 primeiros caracteres do id da prova na nuvem, em maiúsculas', () => {
    assert.equal(Modelos.chaveDaProva({ nuvem: { id: ID } }), '8F3A2C1D');
    assert.equal(Modelos.chaveDaProva({ nuvem: { id: 'demo-cn' } }), '', 'id que não é da nuvem não tem chave');
    assert.equal(Modelos.chaveDaProva({}), '', 'prova só do navegador não tem chave');
});

test('o nome do PDF que vai para o Identificador leva a chave; sem chave, é o de sempre', () => {
    const prova = { ano: '2026', bimestre: 'B3', serie: '1', fixo: true, componente: 'LIN', nuvem: { id: ID } };
    assert.equal(Modelos.nomeArquivo(prova), 'PROVA-2026-B3-1S-LIN');
    assert.equal(Modelos.nomeParaImpressao(prova), 'PROVA-2026-B3-1S-LIN-K8F3A2C1D');
    const local = Object.assign({}, prova); delete local.nuvem;
    assert.equal(Modelos.nomeParaImpressao(local), 'PROVA-2026-B3-1S-LIN');
});

/* ===== o Identificador lê a chave ===== */

test('lê a chave, o ano, o bimestre, a série e o componente do nome e do título', () => {
    assert.deepEqual(Chave.doTexto('PROVA-2026-B3-1S-LIN-K8F3A2C1D'),
        { chave: '8F3A2C1D', ano: '2026', bimestre: 'B3', serie: '1', componente: 'LIN', tipo: 'prova' });
    assert.equal(Chave.doTexto('PROVA-2026-B3-1S-LIN-K8F3A2C1D.pdf').chave, '8F3A2C1D', 'com a extensão');
    assert.equal(Chave.doTexto('prova-2026-b3-1s-lin-k8f3a2c1d-gabarito').chave, '8F3A2C1D', 'caixa baixa e sufixo');
    const semChave = Chave.doTexto('PROVA-2026-B3-2S-NAT');
    assert.equal(semChave.chave, '');
    assert.equal(semChave.componente, 'NAT');
    assert.equal(Chave.doTexto('minha prova qualquer.pdf'), null);
    assert.equal(Chave.doTexto('PROVA-2026-B3-1S-LIN-KZZZZZZZZ').chave, '', 'só vale 8 caracteres de 0-9 e A-F');
});

async function pdfComTitulo(titulo) {
    const doc = await PDFLib.PDFDocument.create();
    doc.addPage([200, 200]);
    if (titulo != null) doc.setTitle(titulo);
    return await doc.save();
}

test('lê a chave do título gravado no PDF, que sobrevive a renomear o arquivo', async () => {
    const bytes = await pdfComTitulo('PROVA-2026-B3-1S-LIN-K8F3A2C1D');
    const info = await Chave.doArquivo({ nome: 'qualquer coisa.pdf', tipo: 'pdf', bytes });
    assert.equal(info.chave, '8F3A2C1D');
    assert.equal(info.componente, 'LIN');
});

test('sem chave no título, usa a do nome do arquivo; sem nenhuma, não tem chave', async () => {
    const semTitulo = await pdfComTitulo(null);
    assert.equal((await Chave.doArquivo({ nome: 'PROVA-2026-B3-1S-LIN-K11112222.pdf', tipo: 'pdf', bytes: semTitulo })).chave, '11112222');
    assert.equal(await Chave.doArquivo({ nome: 'prova.pdf', tipo: 'pdf', bytes: semTitulo }), null);
    assert.equal((await Chave.doArquivo({ nome: 'PROVA-2026-B3-1S-LIN.pdf', tipo: 'pdf', bytes: semTitulo })).chave, '');
    assert.equal((await Chave.doArquivo({ nome: 'foto.png', tipo: 'png', bytes: new Uint8Array([1, 2, 3]) })), null, 'imagem não tem título');
    assert.equal(await Chave.doArquivo({ nome: 'quebrado.pdf', tipo: 'pdf', bytes: new Uint8Array([1, 2, 3]) }), null, 'PDF que não abre não derruba nada');
});

test('o arquivo no espaço errado, ou fora do bimestre e do ano, gera um aviso', () => {
    const info = Chave.doTexto('PROVA-2026-B3-1S-LIN-K8F3A2C1D');
    assert.equal(Chave.conferir(info, { ano: '2026', bimestre: 'B3', serie: '1', componente: 'LIN' }), '');
    assert.match(Chave.conferir(info, { ano: '2026', bimestre: 'B3', serie: '1', componente: 'NAT' }), /de Linguagens e Códigos, mas está no espaço de Ciências da Natureza/);
    assert.match(Chave.conferir(info, { ano: '2026', bimestre: 'B3', serie: '2', componente: 'LIN' }), /da 1ª série, mas está no espaço da 2ª série/);
    assert.match(Chave.conferir(info, { ano: '2026', bimestre: 'B2', serie: '1', componente: 'LIN' }), /do 3º bimestre, mas o passo 1 diz 2º/);
    assert.match(Chave.conferir(info, { ano: '2025', bimestre: 'B3', serie: '1', componente: 'LIN' }), /de 2026, mas o passo 1 diz 2025/);
    assert.equal(Chave.conferir(null, { componente: 'NAT' }), '', 'arquivo que não diz nada não é acusado');
});

/* ===== o QR leva a chave ===== */

const dadosDoAluno = (extra) => Object.assign({
    ano: '2026', bimestre: 'B3', turma: '1A', numero: 7, componente: 'LIN',
    nome: 'Estudante Fictício 07', chave: 'malu-2026', titulo: 'Avaliação Bimestral', matricula: '20260007'
}, extra || {});

test('o QR leva a chave como oitavo campo e o leitor a devolve', () => {
    const id = Identificacao.identificar(dadosDoAluno({ chaveProva: '8f3a2c1d' }));
    const campos = id.conteudoQr.split('|');
    assert.equal(campos.length, 8);
    assert.equal(campos[6], '20260007');
    assert.equal(campos[7], '8F3A2C1D');
    const lido = Qr.ler(id.conteudoQr);
    assert.equal(lido.chave, '8F3A2C1D');
    assert.equal(lido.matricula, '20260007');
    assert.equal(lido.turma, '1A');
    assert.deepEqual(Leitor.ler(id.conteudoQr), lido, 'o Gabaritos lê igual');
});

test('sem matrícula, o campo fica vazio e a chave continua no oitavo lugar', () => {
    const id = Identificacao.identificar(dadosDoAluno({ chaveProva: '8F3A2C1D', matricula: '' }));
    const campos = id.conteudoQr.split('|');
    assert.equal(campos.length, 8);
    assert.equal(campos[6], '');
    assert.equal(Leitor.ler(id.conteudoQr).chave, '8F3A2C1D');
    assert.equal(Leitor.ler(id.conteudoQr).matricula, '');
});

test('sem chave da prova, o QR é exatamente o de antes', () => {
    const sem = Identificacao.identificar(dadosDoAluno());
    assert.equal(sem.conteudoQr.split('|').length, 7);
    assert.equal(Qr.ler(sem.conteudoQr).chave, '');
    const semMat = Identificacao.identificar(dadosDoAluno({ matricula: '' }));
    assert.equal(semMat.conteudoQr.split('|').length, 6);
    /* chave inválida é ignorada, como se não existisse */
    assert.equal(Identificacao.identificar(dadosDoAluno({ chaveProva: 'xyz' })).conteudoQr, sem.conteudoQr);
});

test('com a chave, o QR continua cabendo no versão 6 (106 caracteres), até no pior caso', () => {
    const pior = Identificacao.identificar(dadosDoAluno({
        chaveProva: '8F3A2C1D', nome: 'Maria Aparecida Fernandes de Albuquerque Sobrinho', titulo: 'Avaliação Bimestral de Linguagens e Códigos', matricula: '202600070001'
    }));
    assert.ok(pior.conteudoQr.length <= 106, 'tem ' + pior.conteudoQr.length + ' caracteres');
    assert.equal(gerador.matriz(pior.conteudoQr, 'M').tamanho, 41, 'QR versão 6: 41 módulos');
    const lido = Leitor.ler(pior.conteudoQr);
    assert.equal(lido.chave, '8F3A2C1D', 'a chave e a matrícula nunca são cortadas');
    assert.equal(lido.matricula, '202600070001');
    assert.equal(lido.turma, '1A');
    assert.ok(lido.nome.length >= 8);
});

test('o QR com a chave continua legível para quem só conhece o formato de antes', () => {
    const id = Identificacao.identificar(dadosDoAluno({ chaveProva: '8F3A2C1D' }));
    /* leitor "antigo": usa só os 7 primeiros campos, como o MLSPROVA1 original */
    const campos = id.conteudoQr.split('|');
    assert.equal(campos[0], 'MLSPROVA1');
    assert.equal(campos[1], id.id);
    assert.equal(campos[6], '20260007');
});
