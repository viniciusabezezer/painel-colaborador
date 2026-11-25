/* Leitura óptica em imagem sintética: marcas, bolhas, lista e código.
   Rode com: node --test gabaritos/test/omr.test.cjs */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const Gabarito = require(path.join(__dirname, '../../montar/js/gabarito.js'));
const Codigo = require(path.join(__dirname, '../../montar/js/codigo.js'));
const OMR = require(path.join(__dirname, '../js/omr.js'));
const Analise = require(path.join(__dirname, '../js/analise.js'));

function raster(geo, preenchidas, op) {
    op = op || {};
    const dpi = op.dpi || 130;
    const mm = dpi / 25.4;
    const ox = 36;
    const oy = 36;
    const altura = op.comCodigo === false ? geo.altura_grade : geo.altura_svg;
    const W = Math.ceil(geo.largura * mm + ox * 2);
    const H = Math.ceil(altura * mm + oy * 2);
    const data = new Uint8ClampedArray(W * H * 4);
    data.fill(255);
    function pinta(x, y, v) {
        if (x < 0 || y < 0 || x >= W || y >= H) return;
        const i = (y * W + x) * 4;
        data[i] = data[i + 1] = data[i + 2] = v;
        data[i + 3] = 255;
    }
    function disco(cxMm, cyMm, rMm, v) {
        const cx = ox + cxMm * mm;
        const cy = oy + cyMm * mm;
        const r = rMm * mm;
        for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++) {
            for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
                const dx = x + 0.5 - cx;
                const dy = y + 0.5 - cy;
                if (dx * dx + dy * dy <= r * r) pinta(x, y, v);
            }
        }
    }
    function quadrado(cxMm, cyMm, lado) {
        const cx = ox + cxMm * mm;
        const cy = oy + cyMm * mm;
        const h = lado * mm / 2;
        for (let y = Math.floor(cy - h); y <= Math.ceil(cy + h); y++) {
            for (let x = Math.floor(cx - h); x <= Math.ceil(cx + h); x++) pinta(x, y, 0);
        }
    }
    geo.marcas_grade.forEach(function (m) { quadrado(m.cx, m.cy, geo.marca); });
    if (op.comCodigo !== false) geo.marcas_codigo.forEach(function (m) { quadrado(m.cx, m.cy, geo.marca); });
    preenchidas.forEach(function (b) { disco(b.cx, b.cy, geo.raio * 0.9, b.cinza == null ? 0 : b.cinza); });
    return { data: data, width: W, height: H };
}

function achar(lista, campo, valor) {
    return lista.filter(function (b) { return String(b[campo]) === String(valor); });
}

test('lê lista, respostas e código numa folha sintética com o código ligado', () => {
    const geo = Gabarito.geometria({ total: 10, alternativas: 5 });
    const gabarito = { 1: 'B', 2: 'C', 3: 'D', 4: 'C', 5: 'A', 6: 'D', 7: 'B', 8: 'B', 9: 'C', 10: 'C' };
    const preenchidas = [];
    Object.keys(gabarito).forEach(function (q) {
        preenchidas.push(geo.bolhas_questoes.filter(function (b) { return b.questao === Number(q) && b.valor === gabarito[q]; })[0]);
    });
    const codigo = 'PFE963';
    codigo.split('').forEach(function (ch, i) {
        const fonte = i < 3 ? geo.bolhas_letras : geo.bolhas_digitos;
        preenchidas.push(fonte.filter(function (b) { return b.posicao === i + 1 && b.valor === ch; })[0]);
    });
    const img = raster(geo, preenchidas, { comCodigo: true });
    const lido = OMR.ler(img, geo, { codigo: true });
    assert.equal(lido.ok, true, JSON.stringify(lido.alertas));
    assert.equal(lido.lista, undefined, 'a folha não tem mais o número da lista');
    Object.keys(gabarito).forEach(function (q) {
        assert.equal(lido.respostas[q].status, 'marcada', 'questão ' + q);
        assert.equal(lido.respostas[q].valor, gabarito[q]);
    });
    assert.equal(lido.codigo.texto, codigo);
    assert.equal(Codigo.conferir(codigo, lido.codigo), 'correto');
    const n = Codigo.notaDaProva({ acertos: 10, total: 10, comCodigo: true, statusCodigo: 'correto' });
    assert.equal(n.nota, 10);
});

test('bolha fraca vai para revisão, dupla marcação é dupla, código em branco fica em branco', () => {
    const geo = Gabarito.geometria({ total: 5, alternativas: 5 });
    const certa = geo.bolhas_questoes.filter(function (b) { return b.questao === 1 && b.valor === 'A'; })[0];
    const fraca = Object.assign({}, certa, { cinza: 150 });
    const imgFraca = raster(geo, [fraca], { comCodigo: true });
    const lidaFraca = OMR.ler(imgFraca, geo, { codigo: true });
    assert.equal(lidaFraca.ok, true);
    assert.equal(lidaFraca.respostas[1].status, 'ambigua');
    assert.equal(lidaFraca.codigo.status, 'em_branco');
    assert.equal(Codigo.conferir('ACE345', lidaFraca.codigo), 'em_branco');

    const a = geo.bolhas_questoes.filter(function (b) { return b.questao === 2 && b.valor === 'A'; })[0];
    const b = geo.bolhas_questoes.filter(function (b) { return b.questao === 2 && b.valor === 'C'; })[0];
    const imgDupla = raster(geo, [a, b], { comCodigo: true });
    const lidaDupla = OMR.ler(imgDupla, geo, { codigo: true });
    assert.equal(lidaDupla.respostas[2].status, 'dupla');
});

test('prova sem código ignora a faixa de baixo e não devolve código', () => {
    const geo = Gabarito.geometria({ total: 5, alternativas: 5 });
    const marcada = geo.bolhas_questoes.filter(function (b) { return b.questao === 1 && b.valor === 'E'; })[0];
    const img = raster(geo, [marcada], { comCodigo: false });
    const lido = OMR.ler(img, geo, { codigo: false });
    assert.equal(lido.ok, true, JSON.stringify(lido.alertas));
    assert.equal(lido.codigo, null);
    assert.equal(lido.respostas[1].valor, 'E');
    const n = Codigo.notaDaProva({ acertos: 1, total: 5, comCodigo: false });
    assert.equal(n.nota, 2);
    assert.equal(n.ponto, null);
});

test('análise de item marca discriminação negativa e o CSV usa ponto e vírgula', () => {
    const gabarito = { 1: 'A', 2: 'B' };
    const leituras = [
        { respostas: { 1: { valor: 'A', status: 'marcada' }, 2: { valor: 'B', status: 'marcada' } } },
        { respostas: { 1: { valor: 'A', status: 'marcada' }, 2: { valor: 'B', status: 'marcada' } } },
        { respostas: { 1: { valor: 'A', status: 'marcada' }, 2: { valor: 'C', status: 'marcada' } } },
        { respostas: { 1: { valor: 'C', status: 'marcada' }, 2: { valor: 'A', status: 'marcada' } } }
    ];
    const itens = Analise.itens(leituras, gabarito);
    assert.equal(itens[0].gabarito, 'A');
    assert.equal(itens[0].proporcao, 0.75);
    assert.equal(typeof itens[0].discriminacao, 'number');
    const texto = Analise.csv([
        ['turma', 'lista', 'nota'],
        ['1º A', '01', '8,5']
    ]);
    assert.match(texto, /1º A;01;8,5/);
    const rec = Analise.recuperacaoEfetiva({ status: 'aberta', prazo: '2026-11-01' }, '2026-11-22');
    assert.equal(rec.status, 'nao_recuperada');
    assert.equal(Analise.diasAte('2026-11-25', '2026-11-22'), 3);
});
