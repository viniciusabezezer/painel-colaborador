const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.join(__dirname, '..', '..');
global.MontarCodigo = require(path.join(raiz, 'montar', 'js', 'codigo.js'));
const Presente = require(path.join(raiz, 'gabaritos', 'js', 'presente.js'));

const PROVA = '11111111-1111-4111-8111-111111111111';
const pca = { id: 'p1', nome: 'Coordenadora Fictícia', papel: 'pca', area: 'NAT', ativo: true };
const gestao = { id: 'g1', nome: 'Gestão Fictícia', papel: 'gestao', area: null, ativo: true };
const professor = { id: 'r1', nome: 'Professor Fictício', papel: 'professor', area: 'NAT', ativo: true };
const outroPca = { id: 'p2', nome: 'PCA de Matemática', papel: 'pca', area: 'MAT', ativo: true };

function prova(extra) {
    return Object.assign({
        id: PROVA,
        titulo: 'Avaliação Bimestral de Ciências da Natureza',
        componente: 'NAT',
        componenteNome: 'Ciências da Natureza',
        ano: '2026',
        bimestre: 'B4',
        situacao: 'travada',
        codigoVerificacao: true,
        prazoNotas: '2026-12-05',
        aplicadaEm: '2026-12-01',
        gabarito: { 1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'A' }
    }, extra);
}

function leitura(parcial) {
    const gabarito = prova().gabarito;
    const respostas = {};
    Object.keys(gabarito).forEach(function (q, i) {
        respostas[q] = { valor: i < 4 ? gabarito[q] : 'E', status: 'marcada' };
    });
    return Object.assign({
        id: 'lei-1',
        turma: '1º A',
        lista: 7,
        respostas: respostas,
        statusCodigo: 'incorreto',
        alertas: [],
        revisar: false
    }, parcial);
}

test('só o PCA ativo da área pode enviar', function () {
    const p = prova();
    assert.equal(Presente.podeEnviar(pca, p), true);
    assert.equal(Presente.podeEnviar(gestao, p), false);
    assert.equal(Presente.podeEnviar(professor, p), false);
    assert.equal(Presente.podeEnviar(outroPca, p), false);
    assert.equal(Presente.podeEnviar(Object.assign({}, pca, { ativo: false }), p), false);
    assert.match(Presente.mensagemRecusa(gestao, p), /gestão não envia/i);
    assert.match(Presente.mensagemRecusa(professor, p), /Só o PCA da área/);
});

test('o corpo segue o contrato e não leva nome, resposta, código nem foto', function () {
    const l = leitura();
    l.nome = 'Estudante Fictício 07';
    l.codigo = 'PFE963';
    l.respostas[1].valor = 'A';
    const corpo = Presente.montarCorpo({
        prova: prova(),
        leituras: [l],
        loteId: '22222222-2222-4222-8222-222222222222',
        nome: pca.nome
    });
    assert.deepEqual(Object.keys(corpo).sort(), ['enviado_por', 'lote_id', 'notas', 'prova']);
    assert.equal(corpo.lote_id, '22222222-2222-4222-8222-222222222222');
    assert.equal(corpo.enviado_por, 'Coordenadora Fictícia');
    assert.deepEqual(corpo.prova, {
        id: PROVA,
        titulo: 'Avaliação Bimestral de Ciências da Natureza',
        area: 'Ciências da Natureza',
        ano: '2026',
        bimestre: '4',
        aplicada_em: '2026-12-01'
    });
    assert.equal(corpo.notas.length, 1);
    assert.deepEqual(Object.keys(corpo.notas[0]).sort(), [
        'lista', 'nota', 'ponto_pendente', 'prazo_recuperacao', 'recuperacao', 'status_codigo', 'turma'
    ]);
    assert.equal(corpo.notas[0].turma, '1º A');
    assert.equal(corpo.notas[0].lista, 7);
    assert.equal(typeof corpo.notas[0].nota, 'number');
    assert.ok(corpo.notas[0].nota >= 0 && corpo.notas[0].nota <= 10);
    assert.equal(corpo.notas[0].nota, 8, 'código errado não tira ponto: a nota é a das questões');
    assert.equal(corpo.notas[0].status_codigo, 'incorreto');
    assert.equal(corpo.notas[0].ponto_pendente, false);
    assert.equal(corpo.notas[0].recuperacao, null);
    assert.equal(corpo.notas[0].prazo_recuperacao, null);
    const texto = JSON.stringify(corpo);
    assert.equal(texto.includes('Estudante Fictício'), false);
    assert.equal(texto.includes('PFE963'), false);
    assert.equal(texto.includes('respostas'), false);
    assert.equal(texto.includes('foto'), false);
    assert.equal(texto.includes('imagem'), false);
});

test('código em branco ou errado não tira ponto nem deixa pendência', function () {
    ['incorreto', 'em_branco'].forEach(function (situacao) {
        const nota = Presente.montarCorpo({
            prova: prova(), leituras: [leitura({ statusCodigo: situacao })], loteId: 'a', nome: pca.nome
        }).notas[0];
        assert.equal(nota.nota, 8, situacao + ': a nota é só a das questões');
        assert.equal(nota.status_codigo, situacao);
        assert.equal(nota.ponto_pendente, false);
        assert.equal(nota.recuperacao, null);
        assert.equal(nota.prazo_recuperacao, null);
    });
    const zero = leitura({ statusCodigo: 'em_branco', respostas: {} });
    const semAcerto = Presente.montarCorpo({ prova: prova(), leituras: [zero], loteId: 'b', nome: pca.nome }).notas[0];
    assert.equal(semAcerto.nota, 0);
});

test('código certo soma 1, prova sem código não manda situação de código', function () {
    const certa = leitura({ statusCodigo: 'correto' });
    Object.keys(prova().gabarito).forEach(function (q) {
        certa.respostas[q] = { valor: prova().gabarito[q], status: 'marcada' };
    });
    const notaCerta = Presente.montarCorpo({
        prova: prova(), leituras: [certa], loteId: 'c', nome: pca.nome
    }).notas[0];
    assert.equal(notaCerta.nota, 10);
    assert.equal(notaCerta.status_codigo, 'correto');
    assert.equal(notaCerta.recuperacao, null);
    assert.equal(notaCerta.ponto_pendente, false);

    const sem = Presente.montarCorpo({
        prova: prova({ codigoVerificacao: false }),
        leituras: [leitura({ statusCodigo: null })],
        loteId: 'd', nome: pca.nome
    }).notas[0];
    assert.equal(sem.status_codigo, 'sem_codigo');
    assert.equal(sem.recuperacao, null);
    assert.equal(sem.nota, 8);
});

test('leitura na revisão bloqueia o envio inteiro', async function () {
    let chamou = false;
    const resultado = await Presente.enviarLote({
        perfil: pca,
        prova: prova(),
        leituras: [leitura(), leitura({ id: 'lei-2', lista: 8, statusCodigo: 'ambiguo', revisar: true })],
        hoje: '2026-12-02',
        loteId: '33333333-3333-4333-8333-333333333333',
        env: { url: 'https://presente.exemplo', token: 'segredo-que-nao-volta' },
        fetch: async function () { chamou = true; throw new Error('não devia chamar'); }
    });
    assert.equal(chamou, false);
    assert.equal(resultado.status, 409);
    assert.match(resultado.body.erro, /revisão/);
});

test('a função manda o token só ao Malu Presente e não devolve o segredo', async function () {
    const segredo = 'segredo-que-nao-volta';
    let pedido;
    const gravados = [];
    const resultado = await Presente.enviarLote({
        perfil: pca,
        prova: prova(),
        leituras: [leitura()],
        loteId: '44444444-4444-4444-8444-444444444444',
        env: { url: 'https://presente.exemplo/', token: segredo },
        fetch: async function (url, init) {
            pedido = { url: url, init: init };
            return {
                ok: true,
                json: async function () {
                    return {
                        lote_id: '44444444-4444-4444-8444-444444444444',
                        recebidas: 1,
                        sem_correspondencia: [{ turma: '1º A', lista: 9 }]
                    };
                }
            };
        },
        gravar: async function (registro) { gravados.push(registro); }
    });
    assert.equal(pedido.url, 'https://presente.exemplo/api/integracao/notas-bimestrais');
    assert.equal(pedido.init.method, 'POST');
    assert.equal(pedido.init.headers.Authorization, 'Bearer ' + segredo);
    const corpo = JSON.parse(pedido.init.body);
    assert.equal(corpo.prova.bimestre, '4');
    assert.equal(corpo.notas[0].lista, 7);
    assert.equal(resultado.status, 200);
    assert.equal(resultado.body.recebidas, 1);
    assert.deepEqual(resultado.body.sem_correspondencia, [{ turma: '1º A', lista: 9 }]);
    assert.equal(JSON.stringify(resultado.body).includes(segredo), false);
    assert.equal(JSON.stringify(gravados).includes(segredo), false);
});

test('gestão não dispara o envio', async function () {
    let chamou = false;
    const resultado = await Presente.enviarLote({
        perfil: gestao,
        prova: prova(),
        leituras: [leitura()],
        loteId: '55555555-5555-4555-8555-555555555555',
        env: { url: 'https://presente.exemplo', token: 'segredo-que-nao-volta' },
        fetch: async function () { chamou = true; }
    });
    assert.equal(chamou, false);
    assert.equal(resultado.status, 403);
});

test('o navegador não recebe o nome dos segredos', function () {
    const pasta = path.join(raiz, 'gabaritos');
    const arquivos = [];
    (function andar(dir) {
        fs.readdirSync(dir).forEach(function (nome) {
            const cheio = path.join(dir, nome);
            if (fs.statSync(cheio).isDirectory()) andar(cheio);
            else if (/\.(js|html|css|webmanifest|json)$/.test(nome)) arquivos.push(cheio);
        });
    })(pasta);
    const texto = arquivos.map(function (a) { return fs.readFileSync(a, 'utf8'); }).join('\n');
    assert.equal(texto.includes('MALU_PRESENTE_TOKEN'), false);
    assert.equal(texto.includes('MALU_PRESENTE_URL'), false);
    const funcao = fs.readFileSync(path.join(raiz, 'montar/supabase/functions/gabaritos-enviar-presente/index.ts'), 'utf8');
    assert.equal(funcao.includes("Deno.env.get('MALU_PRESENTE_URL')"), true);
    assert.equal(funcao.includes("Deno.env.get('MALU_PRESENTE_TOKEN')"), true);
    const lote = fs.readFileSync(path.join(raiz, 'montar/supabase/functions/gabaritos-enviar-presente/lote.js'), 'utf8');
    assert.equal(lote, fs.readFileSync(path.join(raiz, 'gabaritos/js/presente.js'), 'utf8'));
});
