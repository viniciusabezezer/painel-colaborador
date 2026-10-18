/* Testes do ProvaShow Malu que não dependem de navegador: o código dos
   cartões, o leitor de imagem (com fotos sintéticas: giro, perspectiva,
   ruído, luz desigual) e as contas dos relatórios.
   Rode com:  node --test provashow/test/provashow.test.cjs*/
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const js = path.join(__dirname, '..', 'js');
const Cartao = require(path.join(js, 'cartao.js'));
const Leitor = require(path.join(js, 'leitor.js'));
const Dados = require(path.join(js, 'dados.js'));

/* ===== código dos cartões ===== */

test('63 cartões, com todas as posições a 6 casas ou mais umas das outras', () => {
    assert.equal(Cartao.CODIGOS.length, 63);
    const todas = [];
    for (const c of Cartao.CODIGOS) {
        let r = c;
        for (let k = 0; k < 4; k++) { todas.push(r); r = Cartao.girar(r); }
        assert.equal(r, c, 'quatro giros voltam ao início');
    }
    let menor = Infinity;
    for (let i = 0; i < todas.length; i++) {
        for (let j = i + 1; j < todas.length; j++) menor = Math.min(menor, Cartao.contarBits(todas[i] ^ todas[j]));
    }
    assert.ok(menor >= Cartao.DISTANCIA_MINIMA, `distância mínima ${menor}`);
});

test('identificar acha cartão e giro, mesmo com 2 casas trocadas, e recusa 3', () => {
    const c = Cartao.CODIGOS[40];
    const g2 = Cartao.girar(Cartao.girar(c));
    assert.deepEqual(Cartao.identificar(g2), { cartao: 41, giro: 2, erros: 0 });
    assert.equal(Cartao.identificar(g2 ^ 0b101).cartao, 41);
    assert.equal(Cartao.identificar(g2 ^ 0b101).erros, 2);
    const tres = Cartao.identificar(g2 ^ 0b10101);
    assert.ok(!tres || tres.cartao !== 41 || tres.erros <= 2);
});

test('o SVG do cartão tem as quatro letras e o número', () => {
    const s = Cartao.svg(7, { nome: 'Ana <Clara>' });
    for (const l of ['>A<', '>B<', '>C<', '>D<']) assert.ok(s.includes(l), l);
    assert.ok(s.includes('7 · Ana &lt;Clara&gt;'));
    assert.ok(!s.includes('<Clara>'));
});

/* ===== leitor, com fotos sintéticas ===== */

/* Desenha cartões numa imagem cinza: cada cartão vai para os 4 cantos dados
   (em sentido horário, começando pelo canto de cima-esquerda do cartão em pé). */
function foto(largura, altura, cartoes, opcoes = {}) {
    const g = new Uint8Array(largura * altura);
    let semente = opcoes.semente || 7;
    const sorte = () => ((semente = (semente * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    for (let y = 0; y < altura; y++) {
        for (let x = 0; x < largura; x++) {
            /* fundo: parede com gradiente de luz e uma faixa escura (roupa) */
            let v = 150 + 60 * (x / largura) - 40 * (y / altura);
            if (opcoes.faixa && y > altura * 0.8) v = 45;
            g[y * largura + x] = v;
        }
    }
    const folga = 1.6, L = Cartao.LADO + folga * 2;
    for (const c of cartoes) {
        const grade = Cartao.grade(c.numero);
        /* do retângulo do cartão (0..L) para a imagem, e de volta */
        const ida = Leitor.homografia(c.cantos, L);
        const pts = c.cantos;
        const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
        /* inversa por busca: amostra densa do cartão */
        const passo = 1 / Math.max(4, (Math.max(...xs) - Math.min(...xs)) / L * 1.5);
        for (let v = 0; v < L; v += passo) {
            for (let u = 0; u < L; u += passo) {
                const [x, y] = ida(u, v);
                const xi = Math.round(x), yi = Math.round(y);
                if (xi < 0 || yi < 0 || xi >= largura || yi >= altura) continue;
                const gx = Math.floor(u - folga), gy = Math.floor(v - folga);
                const preta = gx >= 0 && gy >= 0 && gx < Cartao.LADO && gy < Cartao.LADO && grade[gy][gx];
                const luz = c.luz || 1;
                g[yi * largura + xi] = preta ? 25 : Math.min(255, 235 * luz);
            }
        }
    }
    if (opcoes.ruido) {
        for (let i = 0; i < g.length; i++) g[i] = Math.max(0, Math.min(255, g[i] + (sorte() - 0.5) * opcoes.ruido));
    }
    return { data: g, width: largura, height: altura };
}

/* Cantos de um cartão de lado `t` centrado em (cx, cy), girado `graus` no
   sentido horário, com um pouco de perspectiva (`inclina`). */
function posicao(cx, cy, t, graus, inclina = 0) {
    const a = graus * Math.PI / 180;
    const base = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    return base.map(([x, y]) => {
        const esc = 1 + inclina * y;           /* parte de baixo maior: câmera de cima */
        const px = x * t / 2 * esc, py = y * t / 2;
        return [cx + px * Math.cos(a) - py * Math.sin(a), cy + px * Math.sin(a) + py * Math.cos(a)];
    });
}

test('lê um cartão em pé: resposta A', () => {
    const img = foto(320, 240, [{ numero: 5, cantos: posicao(160, 120, 120, 0) }]);
    const r = Leitor.lerQuadro(img);
    assert.equal(r.length, 1);
    assert.equal(r[0].cartao, 5);
    assert.equal(r[0].letra, 'A');
});

test('o giro do cartão vira a letra: 90° horário = D, 180° = C, 270° = B', () => {
    const esperado = { 0: 'A', 90: 'D', 180: 'C', 270: 'B', 20: 'A', 70: 'D', 200: 'C', 300: 'B' };
    for (const [graus, letra] of Object.entries(esperado)) {
        const img = foto(320, 240, [{ numero: 12, cantos: posicao(160, 120, 110, +graus) }]);
        const r = Leitor.lerQuadro(img);
        assert.equal(r.length, 1, `giro ${graus}`);
        assert.equal(r[0].cartao, 12);
        assert.equal(r[0].letra, letra, `giro ${graus}`);
    }
});

test('uma turma inteira de longe: 30 cartões pequenos, giros, perspectiva, ruído e luz desigual', () => {
    const cartoes = [];
    const letraDe = ['A', 'D', 'C', 'B'];
    for (let i = 0; i < 30; i++) {
        const linha = Math.floor(i / 6), coluna = i % 6;
        const k = (i * 7) % 4;
        const graus = k * 90 + ((i * 13) % 21) - 10;
        cartoes.push({
            numero: i * 2 + 1,
            cantos: posicao(70 + coluna * 120, 60 + linha * 100, 44 + linha * 3, graus, 0.08),
            luz: 0.75 + (i % 3) * 0.1,
            letra: letraDe[k]
        });
    }
    const img = foto(780, 560, cartoes, { ruido: 30, faixa: true });
    const r = Leitor.lerQuadro(img);
    const porCartao = new Map(r.map((x) => [x.cartao, x.letra]));
    let certos = 0;
    for (const c of cartoes) if (porCartao.get(c.numero) === c.letra) certos++;
    for (const x of r) assert.ok(cartoes.some((c) => c.numero === x.cartao && c.letra === x.letra), `leitura errada: ${x.cartao}${x.letra}`);
    assert.ok(certos >= 28, `leu ${certos} de 30`);
});

test('sem cartão na imagem, não inventa leitura', () => {
    const img = foto(400, 300, [], { ruido: 60, faixa: true });
    assert.deepEqual(Leitor.lerQuadro(img), []);
});

/* ===== dados e relatórios ===== */

test('nota do aluno numa sessão e resumo da turma', () => {
    const turma = { id: 't1', alunos: [{ id: 'a1', nome: 'Ana', cartao: 1 }, { id: 'a2', nome: 'Bia', cartao: 2 }, { id: 'a3', nome: 'Caio', cartao: 3 }] };
    const sessoes = [
        { id: 's1', turmaId: 't1', questao: { correta: 'B', opcoes: ['x', 'y', 'z', 'w'] }, respostas: { 1: 'B', 2: 'A' }, data: '2026-10-18T10:00:00Z' },
        { id: 's2', turmaId: 't1', questao: { correta: 'C', opcoes: ['x', 'y', 'z'] }, respostas: { 1: 'C', 2: 'C', 3: 'A' }, data: '2026-10-18T10:05:00Z' },
        { id: 's3', turmaId: 't1', questao: { correta: null, opcoes: ['sim', 'não'] }, respostas: { 1: 'A' }, data: '2026-10-18T10:07:00Z' }
    ];
    const r = Dados.relatorioTurma(turma, sessoes);
    assert.equal(r.alunos.find((a) => a.nome === 'Ana').percentual, 100);
    assert.equal(r.alunos.find((a) => a.nome === 'Bia').percentual, 50);
    assert.equal(r.alunos.find((a) => a.nome === 'Caio').percentual, 0);
    assert.equal(r.alunos.find((a) => a.nome === 'Caio').respondidas, 1);
    assert.equal(r.sessoes[0].percentual, 50);   /* 1 de 2 que responderam */
    assert.equal(r.sessoes[2].percentual, null); /* enquete: sem certo/errado */
    const contagem = Dados.contagem(sessoes[1]);
    assert.deepEqual(contagem, { A: 1, B: 0, C: 2 });
});

test('respostas de cartões sem aluno não entram na sessão', () => {
    const turma = { alunos: [{ id: 'a1', nome: 'Ana', cartao: 4 }] };
    const sessao = { respostas: {} };
    assert.equal(Dados.registrarResposta(sessao, turma, 4, 'B'), true);
    assert.equal(Dados.registrarResposta(sessao, turma, 9, 'B'), false);
    assert.equal(Dados.registrarResposta(sessao, turma, 4, 'E'), false);
    assert.deepEqual(sessao.respostas, { 4: 'B' });
});

test('importar lista de alunos colada: um por linha, números de cartão em ordem', () => {
    const alunos = Dados.lerListaAlunos('  Ana Clara\n\n2 - Bruno Lima\n3. Carla\nDavi\t\n', []);
    assert.deepEqual(alunos.map((a) => [a.nome, a.cartao]), [['Ana Clara', 1], ['Bruno Lima', 2], ['Carla', 3], ['Davi', 4]]);
    const mais = Dados.lerListaAlunos('Eva', [{ cartao: 1 }, { cartao: 3 }]);
    assert.equal(mais[0].cartao, 2);
});

test('questões coladas viram questões com alternativas e gabarito', () => {
    const texto = `1) Qual é a capital do Ceará?
a) Recife
*b) Fortaleza
c) Natal

2. A água ferve a 100 °C ao nível do mar.
(A) Verdadeiro
(B) Falso
Resposta: A`;
    const q = Dados.lerQuestoesColadas(texto);
    assert.equal(q.length, 2);
    assert.equal(q[0].enunciado, 'Qual é a capital do Ceará?');
    assert.deepEqual(q[0].opcoes, ['Recife', 'Fortaleza', 'Natal']);
    assert.equal(q[0].correta, 'B');
    assert.deepEqual(q[1].opcoes, ['Verdadeiro', 'Falso']);
    assert.equal(q[1].correta, 'A');
});
