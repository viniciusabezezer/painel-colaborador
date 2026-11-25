/* Quem é a folha: o QR manda, o gabarito vem depois.
   Rode com:  node --test gabaritos/test/identificar.test.cjs */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const raiz = path.join(__dirname, '..', '..');
const Qr = require(path.join(raiz, 'gabaritos', 'js', 'qrprova.js'));
const Id = require(path.join(raiz, 'gabaritos', 'js', 'identificar.js'));
const jsQR = require(path.join(raiz, 'gabaritos', 'vendor', 'jsQR.js'));
const gerador = require(path.join(raiz, 'provas', 'js', 'qr.js'));

const codigo = (turma, numero, comp, bim) => 'MLS-2026-' + (bim || 'B3') + '-' + turma + '-' + numero + '-' + (comp || 'LIN') + '-DRYT';
const qrTexto = (turma, numero, nome, comp, bim) =>
    'MLSPROVA1|' + codigo(turma, numero, comp, bim) + '|' + turma + '|' + numero + '|' + (nome || 'ESTUDANTE+FICTICIO') + '|AVALIACAO+BIMESTRAL';

const A7 = qrTexto('1A', '007', 'ANA+FICTICIA');
const A8 = qrTexto('1A', '008', 'BIA+FICTICIA');
const PROVA = { ano: '2026', bimestre: 'B3', componente: 'LIN', serie: '1', componenteNome: 'Linguagens e Códigos' };
const ALUNOS = [
    { id: 'a7', nome: 'Lista 07', turma: '1º A', lista: 7, codigo: 'ACE345', copiaId: '1º A-07' },
    { id: 'a8', nome: 'Lista 08', turma: '1º A', lista: 8, codigo: 'PRC456', copiaId: '1º A-08' },
    { id: 'b7', nome: 'Lista 07', turma: '1º B', lista: 7, codigo: 'TFV678', copiaId: '1º B-07' }
];

/* ===== de que prova é o QR ===== */

test('o código do QR diz o ano, o bimestre, a série, a turma e o componente', () => {
    const d = Id.provaDoQr(Qr.ler(A7));
    assert.deepEqual(d, { ano: '2026', bimestre: '3', turma: '1A', numero: '007', componente: 'LIN', serie: '1' });
    assert.equal(Id.provaDoQr(Qr.ler('MLSPROVA1|XYZ|1A|007|NOME|T')), null);
});

test('o QR tem de ser da prova aberta; senão a mensagem diz de qual é', () => {
    assert.equal(Id.conferirProva(Qr.ler(A7), PROVA).ok, true);
    const outraArea = Id.conferirProva(Qr.ler(qrTexto('1A', '007', 'X', 'NAT')), PROVA);
    assert.equal(outraArea.ok, false);
    assert.match(outraArea.motivo, /Ciências da Natureza, 3º bimestre de 2026, 1ª série/);
    assert.match(outraArea.motivo, /prova aberta é Linguagens e Códigos, 3º bimestre de 2026, 1ª série/);
    assert.equal(Id.conferirProva(Qr.ler(qrTexto('1A', '007', 'X', 'LIN', 'B2')), PROVA).ok, false, 'outro bimestre');
    assert.equal(Id.conferirProva(Qr.ler(qrTexto('2A', '007', 'X')), PROVA).ok, false, 'outra série');
    assert.equal(Id.conferirProva(Qr.ler(A7), Object.assign({}, PROVA, { serie: '' })).ok, true, 'sem série na prova, a série não conta');
    assert.equal(Id.conferirProva(Qr.ler(A7), Object.assign({}, PROVA, { bimestre: '3' })).ok, true, 'B3 e 3 são o mesmo bimestre');
});

/* ===== a chave da prova ===== */

const ID_A = '8f3a2c1d-5b6e-4a77-9c10-aabbccddeeff';
const ID_B = '99aa88bb-1111-4222-8333-444455556666';
/* QR com a chave como oitavo campo (matrícula vazia no sétimo) */
const comChave = (texto, chave) => texto + '||' + chave;
const A7_A = comChave(A7, '8F3A2C1D');
const PROVA_A = Object.assign({}, PROVA, { id: ID_A, chave: '8F3A2C1D', titulo: 'Linguagens A' });
const PROVA_B = Object.assign({}, PROVA, { id: ID_B, chave: '99AA88BB', titulo: 'Linguagens B (2ª chamada)' });

test('a chave é o começo do id da prova na nuvem; prova de demonstração não tem', () => {
    assert.equal(Id.chaveDaProva(ID_A), '8F3A2C1D');
    assert.equal(Id.chaveDaProva('demo-cn'), '');
    assert.equal(Id.chaveDaProva(''), '');
});

test('o leitor devolve a chave do QR e ignora o que não é uma chave', () => {
    assert.equal(Qr.ler(A7_A).chave, '8F3A2C1D');
    assert.equal(Qr.ler(A7).chave, '', 'QR sem chave');
    assert.equal(Qr.ler(comChave(A7, 'xyz')).chave, '', 'chave inválida');
    assert.equal(Qr.ler(comChave(A7, '8f3a2c1d')).chave, '8F3A2C1D', 'caixa baixa vira alta');
    const antigo = Qr.ler(codigo('1A', '007') + '\nANA FICTICIA');
    assert.equal(antigo.chave, '');
});

test('com a chave dos dois lados, a chave decide: duas provas com os mesmos dados não se misturam', () => {
    assert.equal(Id.conferirProva(Qr.ler(A7_A), PROVA_A).ok, true);
    const outra = Id.conferirProva(Qr.ler(A7_A), PROVA_B);
    assert.equal(outra.ok, false, 'mesmos ano, bimestre, série e componente, mas é a outra prova');
    assert.match(outra.motivo, /chave 8F3A2C1D/);
    assert.match(outra.motivo, /chave 99AA88BB/);
});

test('a chave vale mais que os dados do código', () => {
    const naoBate = Qr.ler(comChave(qrTexto('1A', '007', 'X', 'NAT'), '8F3A2C1D'));
    assert.equal(Id.conferirProva(naoBate, PROVA_A).ok, true, 'mesma chave: é a prova, mesmo que o código diga outro componente');
});

test('QR de antes da chave: vale pelos dados do código, mas fica marcado para revisão', () => {
    const r = Id.conferirProva(Qr.ler(A7), PROVA_A);
    assert.equal(r.ok, true);
    assert.equal(r.semChave, true);
    assert.equal(Id.conferirProva(Qr.ler(qrTexto('1A', '007', 'X', 'NAT')), PROVA_A).ok, false, 'e se os dados não batem, recusa');
    /* prova sem chave (demonstração): o QR com chave vale pelos dados */
    assert.equal(Id.conferirProva(Qr.ler(A7_A), PROVA).ok, true);
    assert.equal(Id.conferirProva(Qr.ler(A7_A), PROVA).semChave, false);
});

test('a chave do QR acha a prova entre as que o aparelho tem', () => {
    const provas = [PROVA_A, PROVA_B, Object.assign({}, PROVA, { id: 'demo-cn' })];
    assert.equal(Id.provaPeloQr(Qr.ler(A7_A), provas).id, ID_A);
    assert.equal(Id.provaPeloQr(Qr.ler(comChave(A7, '99AA88BB')), provas).id, ID_B);
    assert.equal(Id.provaPeloQr(Qr.ler(comChave(A7, 'DEADBEEF')), provas), null, 'chave que nenhuma prova tem');
    assert.equal(Id.provaPeloQr(Qr.ler(A7), provas), null, 'QR sem chave não escolhe prova');
    assert.equal(Id.provaPeloQr(Qr.ler(A7_A), [{ id: ID_A }]).id, ID_A, 'a chave sai do id quando a prova não a traz pronta');
});

test('prova com chave e QR sem chave: o aluno sai do QR e a leitura vai para revisão', () => {
    const sem = Id.resolver({ qr: Qr.ler(A7), listaMarcada: 7, alunos: ALUNOS, exigirChave: true });
    assert.equal(sem.aluno.id, 'a7');
    assert.equal(sem.revisar, true);
    assert.equal(sem.alertas[0].tipo, 'chave');
    assert.match(sem.alertas[0].detalhe, /não tem a chave da prova/);
    const com = Id.resolver({ qr: Qr.ler(A7_A), listaMarcada: 7, alunos: ALUNOS, exigirChave: true });
    assert.equal(com.revisar, false);
    assert.equal(Id.resolver({ qr: Qr.ler(A7), listaMarcada: 7, alunos: ALUNOS, exigirChave: false }).revisar, false, 'prova sem chave não cobra chave');
});

test('trocar de prova pelo QR: a identidade leva o aviso da troca', () => {
    let aberta = PROVA_A;
    const fluxo = Id.criarFluxo({
        aceitar: (qr) => {
            const outra = Id.provaPeloQr(qr, [PROVA_A, PROVA_B]);
            if (outra && outra.id !== aberta.id) { aberta = outra; return { ok: true, nota: 'Prova trocada para ' + outra.titulo + '.' }; }
            return Id.conferirProva(qr, aberta);
        }
    });
    const cartao = { lido: { ok: true, lista: { numero: 7 }, codigo: { texto: 'X' }, respostas: {} }, nitido: 30 };
    fluxo.quadro({ agora: 1000, qrTexto: A7_A, ler: () => cartao });
    assert.equal(aberta.id, ID_A, 'o QR é da prova que já estava aberta: nada troca');
    assert.equal(fluxo.identidade().nota, '');
    fluxo.quadro({ agora: 1300, qrTexto: comChave(A8, '99AA88BB'), ler: () => cartao });
    assert.equal(aberta.id, ID_B, 'o QR é da outra prova: a tela troca sozinha');
    assert.match(fluxo.identidade().nota, /Prova trocada para Linguagens B/);
});

/* ===== quem é o aluno ===== */

test('com QR, o QR manda: o número marcado nas bolhas só confere', () => {
    const certo = Id.resolver({ qr: Qr.ler(A7), listaMarcada: 7, alunos: ALUNOS });
    assert.equal(certo.aluno.id, 'a7');
    assert.equal(certo.origem, 'qr');
    assert.equal(certo.revisar, false);

    const errado = Id.resolver({ qr: Qr.ler(A7), listaMarcada: 12, alunos: ALUNOS });
    assert.equal(errado.aluno.id, 'a7', 'vale o QR, não o que o aluno marcou');
    assert.equal(errado.lista, 7);
    assert.equal(errado.revisar, true);
    assert.match(errado.alertas[0].detalhe, /marcado no cartão \(12\) não bate com o QR \(7\)/);

    const semBolhas = Id.resolver({ qr: Qr.ler(A7), listaMarcada: null, alunos: ALUNOS });
    assert.equal(semBolhas.aluno.id, 'a7');
    assert.equal(semBolhas.revisar, false, 'sem o número marcado não há o que conferir');
});

test('a turma do QR é obrigatória: o mesmo número existe em outra turma', () => {
    const b7 = Id.resolver({ qr: Qr.ler(qrTexto('1B', '007', 'BETO')), listaMarcada: 7, alunos: ALUNOS });
    assert.equal(b7.aluno.id, 'b7');
    const semTurma = Id.resolver({ qr: Qr.ler(qrTexto('1C', '007', 'CAIO')), listaMarcada: 7, alunos: ALUNOS });
    assert.equal(semTurma.aluno, null, 'não cai no 7 de outra turma');
    assert.equal(semTurma.revisar, true);
    assert.match(semTurma.alertas[0].detalhe, /1C nº 7, que não está na lista desta prova/);
});

test('sem QR (ligado de propósito), o aluno sai do número marcado, como antes', () => {
    const r = Id.resolver({ qr: null, listaMarcada: 8, alunos: ALUNOS });
    assert.equal(r.aluno.id, 'a8');
    assert.equal(r.origem, 'lista');
    assert.equal(r.revisar, false);
    assert.equal(Id.resolver({ qr: null, listaMarcada: null, alunos: ALUNOS }).aluno, null);
});

/* ===== o passo a passo da câmera ===== */

function cena(opcoes) {
    opcoes = opcoes || {};
    const lidas = { n: 0 };
    let t = 0;
    const fluxo = Id.criarFluxo({
        semQr: !!opcoes.semQr,
        aceitar: (qr) => Id.conferirProva(qr, PROVA)
    });
    const cartao = { lido: { ok: true, lista: { numero: 7 }, codigo: { texto: 'ACE345' }, respostas: {} }, nitido: 30 };
    return {
        lidas,
        fluxo,
        cartao,
        /* um quadro: texto do QR visto agora ('' se nenhum) e o cartão que a câmera enxerga */
        quadro(qr, cartaoAgora) {
            t += 300;
            return fluxo.quadro({
                agora: t, qrTexto: qr || '',
                ler: () => { lidas.n++; return cartaoAgora || cartao; }
            });
        },
        pular(ms) { t += ms; }
    };
}

/* Passa `vezes` quadros iguais. Devolve o primeiro que registrou (se algum
   registrou) ou o último. Assim "ate(...).acao === 'esperar'" prova que nenhum
   dos quadros registrou. */
function ate(c, qr, vezes, cartao) {
    let ultimo;
    for (let i = 0; i < vezes; i++) {
        ultimo = c.quadro(qr, cartao);
        if (ultimo.acao === 'registrar') return ultimo;
    }
    return ultimo;
}

test('sem o QR a leitura do gabarito nem começa', () => {
    const c = cena();
    const r = ate(c, '', 8);
    assert.equal(r.acao, 'esperar');
    assert.equal(r.dica, 'Mostre o QR da folha primeiro.');
    assert.equal(c.lidas.n, 0, 'nem gasta a câmera lendo o cartão');
});

test('QR primeiro, depois o gabarito: registra uma vez, com a identidade do QR', () => {
    const c = cena();
    assert.equal(c.quadro(A7).acao, 'esperar', 'só o QR ainda não registra');
    assert.equal(c.fluxo.identidade().qr.numero, '007');
    const r = ate(c, '', 4);
    assert.equal(r.acao, 'registrar');
    assert.equal(r.qrTexto, A7);
    assert.equal(r.identidade.qr.nome, 'ANA FICTICIA');
    assert.equal(r.lido.lista.numero, 7);
    assert.equal(c.fluxo.identidade(), null, 'a identidade some ao registrar');
});

test('o QR de uma folha nunca vai parar na folha seguinte', () => {
    const c = cena();
    c.quadro(A7);
    assert.equal(ate(c, '', 4).acao, 'registrar');
    /* a folha seguinte aparece, mas o QR dela não foi lido */
    const sem = ate(c, '', 10);
    assert.equal(sem.acao, 'esperar');
    assert.equal(sem.identidade, null);
    assert.equal(sem.dica, 'Mostre o QR da folha primeiro.');
    const lidasAntes = c.lidas.n;
    ate(c, '', 5);
    assert.equal(c.lidas.n, lidasAntes, 'sem identidade, não lê o cartão');
});

test('a folha que acabou de ser lida não é registrada de novo enquanto está no quadro', () => {
    const c = cena();
    c.quadro(A7);
    assert.equal(ate(c, '', 4).acao, 'registrar');
    const r = ate(c, A7, 8);
    assert.equal(r.acao, 'esperar');
    assert.equal(r.dica, 'Folha lida. Mostre o QR da próxima.');
});

test('o QR da folha seguinte vira a nova identidade', () => {
    const c = cena();
    c.quadro(A7);
    ate(c, '', 4);
    c.quadro(A8);
    assert.equal(c.fluxo.identidade().qr.numero, '008');
    const r = ate(c, '', 4);
    assert.equal(r.acao, 'registrar');
    assert.equal(r.qrTexto, A8);
});

test('trocar de folha antes de registrar troca a identidade', () => {
    const c = cena();
    c.quadro(A7);
    c.quadro('', { lido: { ok: false }, nitido: 30 });
    c.quadro(A8);
    assert.equal(c.fluxo.identidade().qr.numero, '008');
    assert.equal(ate(c, '', 4).qrTexto, A8);
});

test('QR de outra prova não vira identidade e avisa', () => {
    const c = cena();
    const r = c.quadro(qrTexto('1A', '007', 'X', 'NAT'));
    assert.equal(r.identidade, null);
    assert.match(r.aviso, /outra prova: Ciências da Natureza/);
    const depois = ate(c, '', 6);
    assert.equal(depois.acao, 'esperar');
    assert.equal(c.lidas.n, 0);
});

test('QR de outra prova no meio da leitura derruba a identidade anterior', () => {
    const c = cena();
    c.quadro(A7);
    const r = c.quadro(qrTexto('1A', '009', 'X', 'NAT'));
    assert.equal(r.identidade, null);
    assert.equal(ate(c, '', 5).acao, 'esperar');
});

test('o QR que saiu do quadro há muito tempo não vale mais', () => {
    const c = cena();
    c.quadro(A7);
    c.pular(Id.VALIDADE_QR_MS + 500);
    const primeiro = c.quadro('');
    assert.equal(primeiro.acao, 'esperar');
    assert.equal(primeiro.identidade, null);
    assert.match(primeiro.aviso, /O QR saiu do quadro/);
    assert.equal(ate(c, '', 4).acao, 'esperar', 'sem o QR de novo, nada é registrado');
    /* mostrar o QR de novo, mesmo depois de um tempo, recomeça normalmente */
    c.quadro(A7);
    assert.equal(ate(c, '', 4).acao, 'registrar');
});

test('enquanto o QR segue aparecendo, a identidade não expira', () => {
    const c = cena();
    c.quadro(A7);
    for (let i = 0; i < 10; i++) { c.pular(1000); c.quadro(A7, { lido: { ok: false }, nitido: 30 }); }
    assert.equal(c.fluxo.identidade().qr.numero, '007');
});

test('leitura instável (o cartão muda de um quadro para o outro) não registra', () => {
    const c = cena();
    c.quadro(A7);
    const variacoes = [7, 8, 7, 9, 7, 8];
    let acao = 'esperar';
    variacoes.forEach((n) => {
        acao = c.quadro('', { lido: { ok: true, lista: { numero: n }, codigo: { texto: 'ACE345' } }, nitido: 30 }).acao;
    });
    assert.equal(acao, 'esperar');
    assert.equal(ate(c, '', 3).acao, 'registrar', 'firme de novo, registra');
});

test('foto tremida ou sem as marcas não registra e a dica diz o que fazer', () => {
    const c = cena();
    c.quadro(A7);
    assert.equal(c.quadro('', { lido: { ok: true, lista: { numero: 7 } }, nitido: 3 }).dica, 'Chegue mais perto: a foto está tremida.');
    assert.equal(c.quadro('', { lido: { ok: false }, nitido: 30 }).dica, 'Enquadre o cartão inteiro, com as marcas pretas visíveis.');
});

/* O que o leitor devolveu, no navegador, para o QR de perto: achou "marcas" (os
   quadradinhos do QR), mas 8 das 10 respostas e os 6 caracteres do código saíram duplos. */
const lixoDoQr = (() => {
    const respostas = {};
    for (let q = 1; q <= 10; q++) respostas[q] = { status: q <= 8 ? 'dupla' : (q === 9 ? 'ambigua' : 'marcada') };
    return {
        ok: true, erroPx: 3.09, lista: { numero: null }, respostas,
        codigo: { texto: '??????', status: 'ilegivel', posicoes: [1, 2, 3, 4, 5, 6].map(() => ({ status: 'dupla' })) }
    };
})();

test('uma leitura em que a maioria das bolhas saiu dupla não é uma folha', () => {
    assert.equal(Id.leituraPlausivel(lixoDoQr), false);
    const boa = { ok: true, respostas: { 1: { status: 'marcada' }, 2: { status: 'marcada' } }, codigo: { posicoes: [{ status: 'branca' }] } };
    assert.equal(Id.leituraPlausivel(boa), true);
    const emBranco = { ok: true, respostas: { 1: { status: 'branca' }, 2: { status: 'branca' } }, codigo: { posicoes: [{ status: 'branca' }] } };
    assert.equal(Id.leituraPlausivel(emBranco), true, 'folha em branco é folha');
    const umaDupla = { ok: true, respostas: { 1: { status: 'dupla' }, 2: { status: 'marcada' }, 3: { status: 'marcada' }, 4: { status: 'marcada' } }, codigo: null };
    assert.equal(Id.leituraPlausivel(umaDupla), true, 'um aluno que marcou duas é revisão, não lixo');
    assert.equal(Id.leituraPlausivel({ ok: false }), false);
});

test('com o QR lido, o QR de perto no quadro não é registrado como se fosse a folha', () => {
    const c = cena();
    c.quadro(A7);
    const r = ate(c, '', 8, { lido: lixoDoQr, nitido: 40 });
    assert.equal(r.acao, 'esperar');
    assert.equal(r.dica, 'Enquadre o cartão inteiro, com as marcas pretas visíveis.');
    assert.equal(c.fluxo.identidade().qr.numero, '007', 'a identidade continua esperando o gabarito');
    assert.equal(ate(c, '', 4).acao, 'registrar', 'quando o cartão de verdade aparece, registra');
});

test('"Folhas sem QR" ligado: lê o cartão sem identidade, como antes', () => {
    const c = cena({ semQr: true });
    const r = ate(c, '', 4);
    assert.equal(r.acao, 'registrar');
    assert.equal(r.identidade, null);
    assert.equal(r.qrTexto, '');
    /* e, se o QR aparecer, ele continua valendo */
    c.quadro(A8);
    assert.equal(ate(c, '', 4).qrTexto, A8);
    c.fluxo.semQr(false);
    assert.equal(ate(c, '', 6).acao, 'esperar', 'desligado, volta a exigir o QR');
});

/* ===== ler o QR de verdade ===== */

/* QR real da prova, com zona de silêncio de 4 módulos, `px` pixels por módulo
   e um desfoque leve de impressão/câmera. */
function imagemDoQr(texto, px, desfoques) {
    const m = gerador.matriz(texto, 'M');
    const quiet = 4;
    const lado = (m.tamanho + quiet * 2) * px + 30;
    let g = new Float32Array(lado * lado).fill(255);
    const ini = 15 + quiet * px;
    for (let l = 0; l < m.tamanho; l++) for (let c = 0; c < m.tamanho; c++) {
        if (!m.linhas[l][c]) continue;
        for (let y = 0; y < px; y++) for (let x = 0; x < px; x++) g[(ini + l * px + y) * lado + ini + c * px + x] = 25;
    }
    for (let r = 0; r < (desfoques || 0); r++) {
        const n = new Float32Array(lado * lado).fill(255);
        for (let y = 1; y < lado - 1; y++) for (let x = 1; x < lado - 1; x++) {
            let s = 0;
            for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) s += g[(y + j) * lado + x + i];
            n[y * lado + x] = s / 9;
        }
        g = n;
    }
    const data = new Uint8ClampedArray(lado * lado * 4);
    for (let i = 0; i < lado * lado; i++) { data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = g[i]; data[i * 4 + 3] = 255; }
    return { data, width: lado, height: lado };
}

test('o leitor embutido lê o QR real da prova (o do iPhone, sem BarcodeDetector)', () => {
    const texto = qrTexto('1A', '007', 'ESTUDANTE+FICTICIO+07') + '|20260007';
    assert.ok(texto.length <= 106);
    [[3, 0], [3, 1], [3, 2], [4, 1], [6, 2]].forEach(([px, desfoque]) => {
        const img = imagemDoQr(texto, px, desfoque);
        const lido = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
        assert.ok(lido, 'leu com ' + px + ' px por módulo e desfoque ' + desfoque);
        assert.equal(lido.data, texto);
        const qr = Qr.ler(lido.data);
        assert.equal(qr.turma, '1A');
        assert.equal(qr.numero, '007');
        assert.equal(qr.matricula, '20260007');
    });
});
