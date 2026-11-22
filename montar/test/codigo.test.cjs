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

test('a semente e o código da cópia A e da cópia B repetem o gerador de referência', () => {
    assert.equal(Codigo.semente(PROVA, 'A').toString(), '13349973345923128984');
    assert.equal(Codigo.semente(PROVA, 'B').toString(), '2238309648058794016');
    const a = Codigo.gerarCopia(PROVA, 'A', QUESTOES);
    const b = Codigo.gerarCopia(PROVA, 'B', QUESTOES);
    assert.equal(a.codigo, 'PFE963');
    assert.equal(b.codigo, 'CFA376');
    assert.notEqual(a.codigo, b.codigo);
    Codigo.verificar(a, QUESTOES);
    Codigo.verificar(b, QUESTOES);
    assert.deepEqual(Codigo.gerarCopia(PROVA, 'A', QUESTOES), a, 'a mesma cópia gera o mesmo código');
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

test('a nota soma 1 se o código está certo e tira 1 se deve, mesmo depois de recuperar', () => {
    const cheio = Codigo.notaDaProva({ acertos: 10, total: 10, comCodigo: true, statusCodigo: 'correto' });
    assert.equal(cheio.nota, 10);
    const oito = Codigo.notaDaProva({ acertos: 8, total: 10, comCodigo: true, statusCodigo: 'correto' });
    assert.equal(oito.nota, 9);
    const deve = Codigo.notaDaProva({ acertos: 8, total: 10, comCodigo: true, statusCodigo: 'incorreto' });
    assert.equal(deve.nota, 7);
    assert.equal(deve.ponto, -1);
    const branco = Codigo.notaDaProva({ acertos: 0, total: 10, comCodigo: true, statusCodigo: 'em_branco' });
    assert.equal(branco.nota, 0);
    const recuperou = Codigo.notaDaProva({ acertos: 8, total: 10, comCodigo: true, statusCodigo: 'incorreto', recuperada: true });
    assert.equal(recuperou.nota, 7, 'recuperar não altera a nota registrada');
    assert.equal(recuperou.ponto, -1);
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
    assert.equal(geo.bolhas_lista.length, 20);
    assert.ok(geo.bolhas_questoes.length > 0);
});
