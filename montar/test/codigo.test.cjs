/* Código de verificação: geração, conferência e geometria do bloco OMR.
   Rode com: node --test montar/test/codigo.test.cjs */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('path');

const Codigo = require('../js/codigo.js');
const Gabarito = require('../js/gabarito.js');
const Texto = require('../js/texto.js');

const QUESTOES = [
    { numero: 1, enunciado: 'Todo ser vivo é formado por uma ou mais células. Essa ideia faz parte da' },
    { numero: 2, enunciado: 'Uma bactéria é um ser formado por uma célula sem núcleo organizado. Esse tipo de célula se chama' },
    { numero: 3, enunciado: 'Qual organela é a principal responsável pela respiração celular, processo que libera energia para a célula?' },
    { numero: 4, enunciado: 'Em uma célula de folha, a fotossíntese acontece principalmente no' },
    { numero: 5, enunciado: 'A membrana plasmática envolve a célula e controla o que entra e o que sai. Essa função é chamada de' },
    { numero: 6, enunciado: 'O material genético (DNA) de uma célula eucariótica fica guardado, em especial, no' },
    { numero: 7, enunciado: 'A parede celular, firme e externa à membrana, é típica das células' },
    { numero: 8, enunciado: 'O vacúolo é uma estrutura de reserva, grande e cheia de líquido, bem visível na célula' },
    { numero: 9, enunciado: 'Os lisossomos, vesículas presentes no citoplasma, atuam principalmente na' },
    { numero: 10, enunciado: 'Uma diferença importante entre célula animal e célula vegetal é que somente a vegetal possui' }
];
const PROVA = 'MLS-2026-B1-BIO-1ANO-MODELO';

test('a semente e o sorteio repetem o random.Random do Python', () => {
    /* valores gerados com random.Random(semente): shuffle(1..10) e choice(3..9) */
    assert.equal(Codigo.semente(PROVA, 'A').toString(), '13349973345923128984');
    assert.equal(Codigo.semente(PROVA, 'B').toString(), '2238309648058794016');
    const dez = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const ra = Codigo.rngDaSemente(Codigo.semente(PROVA, 'A'));
    assert.deepEqual(ra.shuffle(dez.slice()), [3, 5, 6, 8, 10, 2, 4, 1, 9, 7]);
    assert.deepEqual([1, 2, 3, 4, 5].map(() => ra.choice(Codigo.DIGITOS_OK)), [3, 7, 5, 9, 7]);
    const rb = Codigo.rngDaSemente(Codigo.semente(PROVA, 'B'));
    assert.deepEqual(rb.shuffle(dez.slice()), [3, 4, 9, 10, 8, 2, 7, 6, 5, 1]);
    assert.deepEqual([1, 2, 3, 4, 5].map(() => rb.choice(Codigo.DIGITOS_OK)), [6, 8, 3, 7, 5]);
});

test('o código da cópia A e da cópia B é estável (valores de regressão do JS)', () => {
    const a = Codigo.gerarCopia(PROVA, 'A', QUESTOES);
    const b = Codigo.gerarCopia(PROVA, 'B', QUESTOES);
    assert.equal(a.codigo, 'CEP639');
    assert.equal(b.codigo, 'CFP568');
    assert.notEqual(a.codigo, b.codigo);
    Codigo.verificar(a, QUESTOES);
    Codigo.verificar(b, QUESTOES);
    assert.deepEqual(Codigo.gerarCopia(PROVA, 'A', QUESTOES), a, 'a mesma cópia gera o mesmo código');
});

/* Prova de n questões, todas com palavras que servem de letra e de soma. */
function prova(n) {
    const base = [
        'Todo ser vivo forma células, tecidos e órgãos. Essa ideia faz parte da',
        'Uma bactéria possui uma célula sem núcleo organizado. Esse tipo de célula se chama',
        'Qual organela realiza a respiração celular, processo que libera energia para a célula?',
        'A fotossíntese acontece principalmente nos cloroplastos das folhas verdes. Esse processo ocorre no',
        'A membrana plasmática controla tudo que entra e sai da célula. Essa função é chamada de',
        'O material genético fica guardado, em especial, no'
    ];
    const lista = [];
    for (let i = 0; i < n; i++) lista.push({ numero: i + 1, enunciado: base[i % base.length] });
    return lista;
}

test('a instrução fica na primeira questão e todas as pistas vêm depois dela', () => {
    [7, 8, 10, 13, 20, 31, 45].forEach((n) => {
        const qs = prova(n);
        for (let i = 1; i <= 60; i++) {
            const c = Codigo.gerarCopia('PROVA-X', 'T-' + i, qs);
            assert.deepEqual(c.instrucao, { questao: 1 });
            assert.ok(c.instrucao.questao <= Math.max(1, Math.floor(n / 2)), 'na primeira metade da prova');
            c.letras.concat(c.contas).forEach((m) => assert.ok(m.questao > c.instrucao.questao, 'pista depois da instrução'));
            Codigo.verificar(c, qs);
        }
    });
});

test('as pistas ficam espalhadas: uma em cada sexto do que vem depois da instrução', () => {
    [7, 10, 13, 20, 31, 45].forEach((n) => {
        const qs = prova(n);
        const depois = qs.slice(1).map((q) => q.numero);
        const faixas = [];
        for (let i = 0; i < 6; i++) faixas.push(depois.slice(Math.floor(i * depois.length / 6), Math.floor((i + 1) * depois.length / 6)));
        for (let i = 1; i <= 60; i++) {
            const c = Codigo.gerarCopia('PROVA-X', 'T-' + i, qs);
            const pistas = c.letras.concat(c.contas).map((m) => m.questao);
            faixas.forEach((f) => {
                assert.equal(pistas.filter((q) => f.includes(q)).length, 1, 'uma pista por faixa (n=' + n + ')');
            });
        }
    });
});

test('se as palavras não permitem as faixas, as pistas ainda ficam depois da instrução', () => {
    /* só as questões 2, 3 e 4 têm palavras que servem de letra (C, E, P) */
    const sem = 'Isso aqui nada mais traz, nem uma sigla que sirva de marca';
    const qs = [
        { numero: 1, enunciado: sem }, { numero: 2, enunciado: 'Cada elemento participa' },
        { numero: 3, enunciado: 'Existe produção constante' }, { numero: 4, enunciado: 'Papel traz resultado' },
        { numero: 5, enunciado: sem }, { numero: 6, enunciado: sem }, { numero: 7, enunciado: sem },
        { numero: 8, enunciado: sem }, { numero: 9, enunciado: sem }, { numero: 10, enunciado: sem }
    ];
    const c = Codigo.gerarCopia('PROVA-Y', 'T-1', qs);
    assert.match(c.codigo, /^[ACEFPRTV]{3}[3-9]{3}$/);
    Codigo.verificar(c, qs);
    c.letras.concat(c.contas).forEach((m) => assert.ok(m.questao > 1));
});

test('a prova precisa de 7 questões: uma para a instrução e seis para as pistas', () => {
    assert.equal(Codigo.MIN_QUESTOES, 7);
    assert.throws(() => Codigo.gerarCopia('PROVA-X', 'T-1', prova(6)), /pelo menos 7 questões/);
    assert.doesNotThrow(() => Codigo.gerarCopia('PROVA-X', 'T-1', prova(7)));
});

test('a cópia impressa leva a instrução no enunciado da questão 1, sem sublinhado nem soma ali', () => {
    const qs = QUESTOES;
    const c = Codigo.gerarCopia(PROVA, 'A', qs);
    const base = { secoes: [{ titulo: '', questoes: qs.map((q) => ({ tipo: 'objetiva', enunciado: q.enunciado, alternativas: ['a', 'b', 'c', 'd', 'e'] })) }] };
    const impressa = Codigo.aplicar(base, c);
    const primeira = impressa.secoes[0].questoes[0].enunciado;
    const [instrucao, ...resto] = primeira.split('\n');
    assert.equal(instrucao, Codigo.textoInstrucao(1));
    assert.equal(Codigo.ehInstrucao(instrucao), true);
    assert.equal(resto.join('\n'), qs[0].enunciado, 'o enunciado da questão segue inteiro, depois da instrução');
    assert.equal(primeira.includes('{{u:'), false, 'a questão da instrução não leva pista de letra');
    assert.equal(impressa.copiaImpressa.instrucaoNoEnunciado, true);
    /* a instrução aparece uma só vez na prova */
    const todas = impressa.secoes[0].questoes.map((q) => q.enunciado).join('\n');
    assert.equal(todas.split(Codigo.textoInstrucao(1)).length - 1, 1);
    /* a prova guardada não muda */
    assert.equal(base.secoes[0].questoes[0].enunciado, qs[0].enunciado);
    /* as pistas continuam nas questões da cópia */
    assert.equal((todas.match(/\{\{u:.\}\}/g) || []).length, 3);
});

test('o texto da instrução explica o código sozinho', () => {
    const t = Codigo.textoInstrucao(1);
    assert.match(t, /6 caracteres/);
    assert.match(t, /a partir da questão 2/, 'diz onde procurar as pistas');
    assert.match(Codigo.textoInstrucao(3), /a partir da questão 4/);
    assert.match(t, /sublinhada/);
    assert.match(t, /A, C, E, F, P, R, T e V/);
    assert.match(t, /soma de dois números/);
    assert.match(t, /de 3 a 9/);
    assert.match(t, /siga a ordem das questões/);
    assert.match(t, /Código de verificação do cartão-resposta/);
    assert.equal(/[*_~^]|\{\{|\d\s*\+\s*\d/.test(t), false, 'sem marcação, sem soma escondida no texto da instrução');
});

test('cópia gerada antes (sem instrução) continua válida e sai como antes', () => {
    const c = Codigo.gerarCopia(PROVA, 'A', QUESTOES);
    const antiga = Object.assign({}, c);
    delete antiga.instrucao;
    assert.doesNotThrow(() => Codigo.verificar(antiga, QUESTOES));
    const base = { secoes: [{ titulo: '', questoes: QUESTOES.map((q) => ({ tipo: 'objetiva', enunciado: q.enunciado, alternativas: [] })) }] };
    const impressa = Codigo.aplicar(base, antiga);
    assert.equal(impressa.secoes[0].questoes[0].enunciado, QUESTOES[0].enunciado, 'não ganha instrução no enunciado');
    assert.equal(impressa.copiaImpressa.instrucaoNoEnunciado, false);
});

test('verificar recusa pista antes da instrução ou instrução fora da primeira metade', () => {
    const c = Codigo.gerarCopia(PROVA, 'A', QUESTOES);
    const antes = JSON.parse(JSON.stringify(c));
    antes.instrucao = { questao: 4 };
    assert.throws(() => Codigo.verificar(antes, QUESTOES), /pista antes da instrução/);
    const longe = JSON.parse(JSON.stringify(c));
    longe.instrucao = { questao: 9 };
    assert.throws(() => Codigo.verificar(longe, QUESTOES), /primeira metade/);
    const inexistente = JSON.parse(JSON.stringify(c));
    inexistente.instrucao = { questao: 99 };
    assert.throws(() => Codigo.verificar(inexistente, QUESTOES), /não existe/);
});

test('letras distintas do conjunto e somas de 3 a 9, em questões diferentes', () => {
    const c = Codigo.gerarCopia(PROVA, '1º A-07', QUESTOES);
    assert.match(c.codigo, /^[ACEFPRTV]{3}[3-9]{3}$/);
    assert.equal(new Set(c.codigo.slice(0, 3)).size, 3);
    const qs = c.letras.map((m) => m.questao).concat(c.contas.map((m) => m.questao));
    assert.equal(new Set(qs).size, 6);
    c.contas.forEach((m) => {
        assert.equal(Codigo.avaliarConta(m.expressao), m.resultado);
        assert.ok(m.resultado >= 3 && m.resultado <= 9);
    });
    const ordemLetras = c.letras.map((m) => m.questao);
    const ordemContas = c.contas.map((m) => m.questao);
    assert.deepEqual(ordemLetras, ordemLetras.slice().sort((x, y) => x - y));
    assert.deepEqual(ordemContas, ordemContas.slice().sort((x, y) => x - y));
});

test('a pista sublinha só a inicial e a soma entra no meio da frase, sem marca', () => {
    const c = Codigo.gerarCopia(PROVA, 'A', QUESTOES);
    const letra = c.letras[0];
    const marcado = Codigo.sublinhar(QUESTOES[letra.questao - 1].enunciado, letra);
    assert.match(marcado, /\{\{u:.\}\}/);
    const html = Texto.html(marcado.split('\n')[0]);
    assert.match(html, /<span class="cod-letra">/);
    assert.equal((html.match(/cod-letra/g) || []).length, 1);
    const conta = c.contas[0];
    const comSoma = Codigo.inserirSoma(QUESTOES[conta.questao - 1].enunciado, conta.expressao);
    assert.ok(comSoma.includes(conta.expressao));
    assert.equal(comSoma.includes('{{u:'), false);
    assert.equal(comSoma.includes('cod-letra'), false);
});

test('conferir o código lido: certo, em branco, errado e ambíguo', () => {
    assert.equal(Codigo.conferir('PFE963', 'PFE963'), 'correto');
    assert.equal(Codigo.conferir('PFE963', '______'), 'em_branco');
    assert.equal(Codigo.conferir('PFE963', { status: 'em_branco', texto: '______' }), 'em_branco');
    assert.equal(Codigo.conferir('PFE963', 'PFE964'), 'incorreto');
    assert.equal(Codigo.conferir('PFE963', 'PFE96_'), 'incorreto');
    assert.equal(Codigo.conferir('PFE963', 'PFE96?'), 'ambiguo');
    assert.equal(Codigo.conferir('PFE963', { texto: 'P?E963' }), 'ambiguo');
});

test('a nota soma 1 se o código está certo; em branco ou errado não tira nada', () => {
    const cheio = Codigo.notaDaProva({ acertos: 10, total: 10, comCodigo: true, statusCodigo: 'correto' });
    assert.equal(cheio.nota, 10);
    const oito = Codigo.notaDaProva({ acertos: 8, total: 10, comCodigo: true, statusCodigo: 'correto' });
    assert.equal(oito.nota, 9);
    const errou = Codigo.notaDaProva({ acertos: 8, total: 10, comCodigo: true, statusCodigo: 'incorreto' });
    assert.equal(errou.nota, 8, 'código errado não tira ponto');
    assert.equal(errou.ponto, null);
    const branco = Codigo.notaDaProva({ acertos: 8, total: 10, comCodigo: true, statusCodigo: 'em_branco' });
    assert.equal(branco.nota, 8, 'código em branco não tira ponto');
    const zero = Codigo.notaDaProva({ acertos: 0, total: 10, comCodigo: true, statusCodigo: 'em_branco' });
    assert.equal(zero.nota, 0, 'e a nota nunca fica abaixo do que as questões deram');
    const sem = Codigo.notaDaProva({ acertos: 8, total: 10, comCodigo: false });
    assert.equal(sem.nota, 8);
    assert.equal(sem.ponto, null);
    const duvida = Codigo.notaDaProva({ acertos: 8, total: 10, comCodigo: true, statusCodigo: 'ambiguo' });
    assert.equal(duvida.nota, null);
});

test('sem o código, o SVG do gabarito continua o de antes', () => {
    const svg = Gabarito.svg({ total: 10, alternativas: 5, rotulo: ['2º Ano', 'C.N.'] });
    assert.match(svg, /height="108.95mm"/);
    assert.equal((svg.match(/class="marca"/g) || []).length, 28);
    assert.equal(svg.includes('Código de verificação'), false);
});

test('com o código, o bloco fica abaixo das 28 marcas, que não se movem', () => {
    const sem = Gabarito.svg({ total: 10, alternativas: 5 });
    const com = Gabarito.svg({ total: 10, alternativas: 5, codigo: true });
    assert.match(com, /height="147.83mm"/);
    assert.equal((com.match(/class="marca"/g) || []).length, 28, 'as 28 marcas da grade não ganham classe extra');
    assert.equal((com.match(/marca-codigo/g) || []).length, 4);
    assert.match(com, /Código de verificação/);
    assert.equal((com.match(/data-pos="1"/g) || []).length, 8);
    assert.equal((com.match(/data-pos="4"/g) || []).length, 7);
    const marcasSem = sem.match(/class="marca" x="[^"]+" y="[^"]+"/g);
    const marcasCom = com.match(/class="marca" x="[^"]+" y="[^"]+"/g);
    assert.deepEqual(marcasCom.slice(0, 28), marcasSem);
});

test('a geometria exportada é a mesma da referência do bloco de código', () => {
    const geo = Gabarito.geometria({ total: 10, alternativas: 5 });
    const ref = JSON.parse(fs.readFileSync(path.join(__dirname, 'geometria-codigo-ref.json'), 'utf8'));
    assert.equal(geo.altura_svg, ref.altura_svg);
    assert.equal(geo.y0_codigo, ref.y0_codigo);
    assert.deepEqual(geo.marcas_grade, ref.marcas_grade);
    assert.deepEqual(geo.marcas_codigo, ref.marcas_codigo);
    assert.deepEqual(geo.bolhas_letras, ref.bolhas_letras);
    assert.deepEqual(geo.bolhas_digitos, ref.bolhas_digitos);
    assert.equal(geo.bolhas_lista, undefined, 'o número da lista não existe mais na folha');
    assert.ok(geo.bolhas_questoes.length > 0);
});
