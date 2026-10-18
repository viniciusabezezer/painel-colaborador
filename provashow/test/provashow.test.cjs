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
const Texto = require(path.join(js, 'texto.js'));
const Midia = require(path.join(js, 'midia.js'));
const Explorar = require(path.join(js, 'explorar.js'));

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

const ses = (id, correta, opcoes, respostas, data, extra) => Object.assign({
    id, turmaId: 't1', questao: { enunciado: id, opcoes, corretas: correta ? [].concat(correta) : [], tipo: correta ? 'avaliada' : 'enquete' },
    respostas, data
}, extra);

test('nota do aluno numa sessão e resumo da turma', () => {
    const turma = { id: 't1', alunos: [{ id: 'a1', nome: 'Ana', cartao: 1 }, { id: 'a2', nome: 'Bia', cartao: 2 }, { id: 'a3', nome: 'Caio', cartao: 3 }] };
    const sessoes = [
        ses('s1', 'B', ['x', 'y', 'z', 'w'], { 1: 'B', 2: 'A' }, '2026-10-18T10:00:00Z'),
        ses('s2', 'C', ['x', 'y', 'z'], { 1: 'C', 2: 'C', 3: 'A' }, '2026-10-18T10:05:00Z'),
        ses('s3', null, ['sim', 'não'], { 1: 'A' }, '2026-10-18T10:07:00Z')
    ];
    const r = Dados.relatorioTurma(turma, sessoes);
    assert.equal(r.alunos.find((a) => a.nome === 'Ana').percentual, 100);
    assert.equal(r.alunos.find((a) => a.nome === 'Bia').percentual, 50);
    assert.equal(r.alunos.find((a) => a.nome === 'Caio').percentual, 0);
    assert.equal(r.alunos.find((a) => a.nome === 'Caio').respondidas, 1);
    assert.equal(r.sessoes[0].percentual, 50);
    assert.equal(r.sessoes[2].percentual, null);
    assert.equal(r.media, 50);
    assert.deepEqual(Dados.contagem(sessoes[1]), { A: 1, B: 0, C: 2 });
    assert.deepEqual(Dados.relatorioTurma(turma, sessoes, { ordenar: 'nota' }).alunos.map((a) => a.nome), ['Ana', 'Bia', 'Caio']);
});

test('várias respostas certas e pergunta fora da nota', () => {
    const turma = { id: 't1', alunos: [{ id: 'a1', nome: 'Ana', cartao: 1 }, { id: 'a2', nome: 'Bia', cartao: 2 }] };
    const sessoes = [
        ses('s1', ['A', 'C'], ['x', 'y', 'z'], { 1: 'A', 2: 'C' }, '2026-10-18T10:00:00Z'),
        ses('s2', 'B', ['x', 'y'], { 1: 'A', 2: 'A' }, '2026-10-18T10:01:00Z', { ignorada: true })
    ];
    const r = Dados.relatorioTurma(turma, sessoes);
    assert.equal(r.alunos[0].percentual, 100);
    assert.equal(r.alunos[1].percentual, 100);
    assert.equal(r.sessoes[0].percentual, 100);
});

test('respostas: só alunos ativos, letra dentro das alternativas, origem guardada', () => {
    const turma = { alunos: [{ id: 'a1', nome: 'Ana', cartao: 4 }, { id: 'a2', nome: 'Rui', cartao: 5, arquivado: true }] };
    const sessao = { questao: { opcoes: ['a', 'b'] }, respostas: {} };
    assert.equal(Dados.registrarResposta(sessao, turma, 4, 'B', 'aparelho'), true);
    assert.equal(Dados.registrarResposta(sessao, turma, 9, 'B'), false);
    assert.equal(Dados.registrarResposta(sessao, turma, 5, 'A'), false, 'aluno arquivado');
    assert.equal(Dados.registrarResposta(sessao, turma, 4, 'C'), false, 'só 2 alternativas');
    assert.deepEqual(sessao.respostas, { 4: 'B' });
    assert.equal(sessao.origem[4], 'aparelho');
});

test('lista colada: números de cartão em ordem; trocar cartão troca com o colega', () => {
    const alunos = Dados.lerListaAlunos('  Ana Clara\n\n2 - Bruno Lima\n3. Carla\nDavi\t9\n', []);
    assert.deepEqual(alunos.map((a) => [a.nome, a.cartao]), [['Ana Clara', 1], ['Bruno Lima', 2], ['Carla', 3], ['Davi', 4]]);
    assert.ok(alunos.every((a) => a.chave && a.chave.length === 10));
    const mais = Dados.lerListaAlunos('Eva', [{ cartao: 1 }, { cartao: 3 }]);
    assert.equal(mais[0].cartao, 2);
    const turma = { alunos };
    Dados.trocarCartao(turma, alunos[0], 3);
    assert.equal(alunos[0].cartao, 3);
    assert.equal(alunos[2].cartao, 1);
    Dados.arquivarAluno(turma, alunos[1], true);
    assert.equal(Dados.lerListaAlunos('Fábio', alunos)[0].cartao, 2, 'cartão do arquivado fica livre');
});

test('perguntas coladas: numeração variada, * na certa, várias certas, V/F', () => {
    const texto = `Questão 1: Qual é a capital do Ceará?
a) Recife
*b) Fortaleza
c) Natal

2. A água ferve a 100 °C ao nível do mar.
(A) Verdadeiro
(B) Falso
Resposta: A

3) Quais são números primos?
A. 2
B. 4
C. 3
D. 9
Gabarito: A, C

Q4 - Pergunta sem alternativas
Resposta: F`;
    const q = Dados.lerQuestoesColadas(texto);
    assert.equal(q.length, 4);
    assert.equal(q[0].enunciado, 'Qual é a capital do Ceará?');
    assert.deepEqual(q[0].opcoes.map((o) => o.texto), ['Recife', 'Fortaleza', 'Natal']);
    assert.deepEqual(q[0].corretas, ['B']);
    assert.deepEqual(q[1].corretas, ['A']);
    assert.deepEqual(q[2].corretas, ['A', 'C']);
    assert.deepEqual(q[3].opcoes.map((o) => o.texto), ['Verdadeiro', 'Falso']);
    assert.deepEqual(q[3].corretas, ['B']);
    const limpo = Dados.lerQuestoesColadas('1) [ENEM 2020] Pergunta?\na) x\nb) y', { remover: '[ENEM 2020] ' });
    assert.equal(limpo[0].enunciado, 'Pergunta?');
});

test('perguntas coladas de planilha (colunas com tabulação)', () => {
    const q = Dados.lerQuestoesColadas('Pergunta\tA\tB\tC\tD\tCerta\n2+2?\t3\t4\t5\t\tB\nCéu é azul?\tSim\tNão\t\t\t');
    assert.equal(q.length, 2);
    assert.deepEqual(q[0].opcoes.map((o) => o.texto), ['3', '4', '5']);
    assert.deepEqual(q[0].corretas, ['B']);
    assert.equal(q[1].tipo, 'enquete');
});

test('embaralhar mantém a certa acompanhando e não mexe em verdadeiro/falso', () => {
    const base = Dados.novaQuestao({ opcoes: ['um', 'dois', 'três', 'quatro'].map((texto) => ({ texto })), corretas: ['C'] });
    const e = Dados.embaralhar(base, 'semente-1');
    assert.equal(e.opcoes[Dados.LETRAS.indexOf(e.corretas[0])].texto, 'três');
    assert.deepEqual([...e.opcoes.map((o) => o.texto)].sort(), ['dois', 'quatro', 'três', 'um']);
    assert.deepEqual(Dados.embaralhar(base, 'semente-1').ordem, e.ordem, 'mesma semente, mesma ordem');
    const vf = Dados.novaQuestao({ opcoes: [{ texto: 'Verdadeiro' }, { texto: 'Falso' }], corretas: ['A'] });
    assert.deepEqual(Dados.embaralhar(vf, 'x').ordem, [0, 1]);
});

test('migração da primeira versão', () => {
    const v1 = { conjuntos: [{ id: 'c', titulo: 'T', questoes: [{ id: 'q', enunciado: 'E', imagem: 'data:image/jpeg;base64,AA', opcoes: ['a', 'b'], correta: 'B' }, { id: 'q2', enunciado: 'P', opcoes: ['s', 'n'], correta: null }] }],
        turmas: [{ id: 't', nome: 'T', alunos: [{ id: 'a', nome: 'A', cartao: 1 }], fila: ['c'] }],
        sessoes: [{ id: 's', turmaId: 't', questao: { enunciado: 'E', opcoes: ['a', 'b'], correta: 'B' }, respostas: { 1: 'B' }, data: '2026-10-01T10:00:00Z' }] };
    const d = Dados.migrar(v1);
    assert.equal(d.versao, 2);
    const q = d.conjuntos[0].questoes[0];
    assert.deepEqual(q.corretas, ['B']);
    assert.deepEqual(q.opcoes[1], { texto: 'b', imagem: '' });
    assert.equal(q.midia.tipo, 'imagem');
    assert.equal(d.conjuntos[0].questoes[1].tipo, 'enquete');
    assert.deepEqual(d.sessoes[0].questao.corretas, ['B']);
    assert.ok(d.turmas[0].alunos[0].chave);
    assert.equal(Dados.relatorioTurma(d.turmas[0], d.sessoes).alunos[0].percentual, 100);
});

test('lixeira, pastas e busca', () => {
    const d = Dados.vazio();
    const p1 = { id: 'p1', nome: 'Ciências', paiId: null }, p2 = { id: 'p2', nome: 'Química', paiId: 'p1' }, p3 = { id: 'p3', nome: 'Orgânica', paiId: 'p2' };
    d.pastas.push(p1, p2, p3);
    assert.deepEqual([...Dados.descendentes(d, 'p1')].sort(), ['p1', 'p2', 'p3']);
    assert.deepEqual(Dados.caminhoPasta(d, 'p3').map((p) => p.nome), ['Ciências', 'Química', 'Orgânica']);
    d.conjuntos.push({ id: 'c1', titulo: 'Revisão', questoes: [Dados.novaQuestao({ enunciado: 'Qual é a fórmula da água?' })] });
    assert.equal(Dados.buscar(d, 'FORMULA').length, 1, 'busca sem acento e sem caixa');
    Dados.remover(d.conjuntos[0]);
    assert.equal(Dados.buscar(d, 'formula').length, 0);
    Dados.limparLixeira(d, Date.now() + 31 * 864e5);
    assert.equal(d.conjuntos.length, 0);
});

test('pacote: exportar e importar como cópia nova', () => {
    const d = Dados.exemplo();
    const pacote = { nome: 'Meu pacote', descricao: 'd', conjuntos: [d.conjuntos[0].id] };
    const arquivo = JSON.parse(JSON.stringify(Dados.exportarPacote(d, pacote)));
    const outro = Dados.vazio();
    const novo = Dados.importarPacote(outro, arquivo);
    assert.equal(outro.conjuntos.length, 1);
    assert.notEqual(outro.conjuntos[0].id, d.conjuntos[0].id);
    assert.equal(outro.conjuntos[0].questoes.length, d.conjuntos[0].questoes.length);
    assert.equal(novo.nome, 'Meu pacote');
    assert.throws(() => Dados.importarPacote(outro, { tipo: 'outro' }));
    for (const p of Explorar.PACOTES) {
        const alvo = Dados.vazio();
        Dados.importarPacote(alvo, p);
        assert.ok(alvo.conjuntos[0].questoes.length >= 4, p.pacote.nome);
        for (const x of alvo.conjuntos[0].questoes) assert.ok(x.tipo === 'enquete' || x.corretas.length, x.enunciado);
    }
});

test('sincronizar: vence o mais novo, exclusões viajam, sessões se somam', () => {
    const a = Dados.vazio(), b = Dados.vazio();
    a.conjuntos.push({ id: 'c1', titulo: 'velho', questoes: [], alterado: '2026-10-01T00:00:00Z' });
    b.conjuntos.push({ id: 'c1', titulo: 'novo', questoes: [], alterado: '2026-10-02T00:00:00Z' });
    b.conjuntos.push({ id: 'c2', titulo: 'só no b', questoes: [], alterado: '2026-10-02T00:00:00Z', removido: '2026-10-02T00:00:00Z' });
    a.sessoes.push({ id: 's1', questao: { opcoes: ['a'] }, respostas: {}, alterado: '1' });
    b.sessoes.push({ id: 's2', questao: { opcoes: ['a'] }, respostas: {}, alterado: '1' });
    const n = Dados.mesclar(a, JSON.parse(JSON.stringify(b)));
    assert.equal(n, 3);
    assert.equal(a.conjuntos.find((c) => c.id === 'c1').titulo, 'novo');
    assert.ok(a.conjuntos.find((c) => c.id === 'c2').removido);
    assert.equal(a.sessoes.length, 2);
    assert.equal(Dados.mesclar(a, JSON.parse(JSON.stringify(b))), 0, 'repetir não muda nada');
    assert.equal(Dados.fatiar('x'.repeat(130001), 60000).length, 3);
});

test('períodos do placar e relatório do aluno', () => {
    const hoje = new Date(2026, 9, 21); /* quarta, 21/10/2026 */
    assert.deepEqual(Dados.periodo('dia', hoje), { de: '2026-10-21', ate: '2026-10-21' });
    assert.deepEqual(Dados.periodo('semana', hoje), { de: '2026-10-19', ate: '2026-10-21' });
    assert.deepEqual(Dados.periodo('mes', hoje), { de: '2026-10-01', ate: '2026-10-21' });
    assert.deepEqual(Dados.periodo('bimestre', hoje), { de: '2026-09-01', ate: '2026-10-21' });
    const turma = { id: 't1', alunos: [{ id: 'a1', nome: 'Ana', cartao: 1 }] };
    const r = Dados.relatorioAluno(turma, turma.alunos[0], [ses('s1', 'B', ['x', 'y'], { 1: 'A' }, '2026-10-18T10:00:00Z'), ses('s2', null, ['x', 'y'], {}, '2026-10-18T10:00:00Z')]);
    assert.deepEqual(r.itens.map((i) => i.situacao), ['errado', 'sem']);
    assert.equal(r.resumo.percentual, 0);
});

test('planilha CSV com respostas, marcas e lista de perguntas', () => {
    const turma = { id: 't1', alunos: [{ id: 'a1', nome: 'Ana', cartao: 1 }] };
    const r = Dados.relatorioTurma(turma, [ses('s1', 'B', ['x', 'y'], { 1: 'B' }, '2026-10-18T10:00:00Z')]);
    const csv = Dados.csvRelatorio(turma, r);
    assert.ok(csv.includes('"Ana"') && csv.includes('"B ✓"') && csv.includes('"Perguntas"'));
});

/* ===== texto e mídia ===== */

test('marcação do texto: negrito, itálico, índices, equação e nada de HTML', () => {
    assert.equal(Texto.html('a **forte** e *leve* e __sub__'), 'a <strong>forte</strong> e <em>leve</em> e <u>sub</u>');
    assert.equal(Texto.html('H~2~O e x^2^'), 'H<sub>2</sub>O e x<sup>2</sup>');
    assert.ok(Texto.html('$\\frac{1}{2}$').includes('<math'));
    assert.equal(Texto.html('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;');
    assert.equal(Texto.html('custa R\\$ 5'), 'custa R$ 5');
    assert.ok(!Texto.html('$<script>$').includes('<script>'));
    assert.equal(Texto.simples('**a** $x^2$'), 'a x2');
    const negritoEquacao = Texto.html('**$x^2$** e x^2^');
    assert.ok(negritoEquacao.startsWith('<strong><span class="katex">') && negritoEquacao.endsWith('e x<sup>2</sup>'), 'negrito em volta da equação');
});

test('mídia: link do YouTube, tempos e endereços seguros', () => {
    assert.equal(Midia.idYoutube('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10'), 'dQw4w9WgXcQ');
    assert.equal(Midia.idYoutube('https://youtu.be/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
    assert.equal(Midia.idYoutube('https://youtube.com/shorts/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
    assert.equal(Midia.idYoutube('https://vimeo.com/1'), null);
    assert.equal(Midia.segundos('1:30'), 90);
    assert.equal(Midia.tempo(90), '1:30');
    const v = Midia.html({ tipo: 'video', src: 'https://youtu.be/dQw4w9WgXcQ', inicio: 5, fim: 20 });
    assert.ok(v.includes('youtube-nocookie.com/embed/dQw4w9WgXcQ?') && v.includes('start=5') && v.includes('end=20'));
    assert.equal(Midia.html({ tipo: 'imagem', src: 'javascript:alert(1)' }), '');
    assert.ok(Midia.html({ tipo: 'imagem', src: 'data:image/png;base64,AA' }).startsWith('<img'));
});
