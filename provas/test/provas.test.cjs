/* Testes da parte que não depende de navegador: resumo SHA-256, código único,
   leitura da lista colada, QR e posicionamento das marcas.
   Rode com:  node --test provas/test/            */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const app = path.join(__dirname, '..', 'js');
const sha256 = require(path.join(app, 'sha256.js'));
const identificacao = require(path.join(app, 'identificacao.js'));
const lista = require(path.join(app, 'lista.js'));
const qr = require(path.join(app, 'qr.js'));
const saida = require(path.join(app, 'saida.js'));
global.PDFLib = require(path.join(__dirname, '..', 'vendor', 'pdf-lib.min.js'));
const pdf = require(path.join(app, 'pdf.js'));

const CHAVE = 'malu-2026';

/* ===== SHA-256 ===== */

test('sha256 bate com os vetores oficiais', () => {
    assert.equal(sha256.hex(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    assert.equal(sha256.hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    assert.equal(sha256.hex('a'.repeat(1000)), '41edece42d63e8d9bf515a9ba6932e1c20cbc9f5a5d134645adb5db1b9737ea3');
});

test('sha256 trata acento como UTF-8, não como byte solto', () => {
    assert.equal(sha256.utf8Bytes('ç').length, 2);
    assert.notEqual(sha256.hex('JOSE'), sha256.hex('JOSÉ'));
});

/* ===== identificação ===== */

test('o código traz escola, ano, bimestre, turma, número, componente e verificador', () => {
    const prova = identificacao.identificar({
        ano: '2026', bimestre: 'B3', turma: '1A', numero: 7, componente: 'LIN',
        nome: 'josé ítalo gonçalves', chave: CHAVE
    });
    assert.match(prova.id, /^MLS-2026-B3-1A-007-LIN-[0-9A-HJKMNP-TV-Z]{4}$/);
    assert.equal(prova.numeroCurto, '07');
    assert.equal(prova.nome, 'JOSÉ ÍTALO GONÇALVES');
    assert.equal(prova.conteudoQr, prova.id + '\nJOSÉ ÍTALO GONÇALVES');
});

test('sem numeração, a ordem alfabética manda e o código não depende da ordem colada', () => {
    const alunos = ['Zilda Maria', 'ana beatriz', 'Ítalo Ferreira', 'Bruno Dias'];
    const primeira = identificacao.identificarTurma({ ano: '2026', bimestre: 'B3', turma: '3B', componente: 'MAT', alunos: alunos, chave: CHAVE });
    const segunda = identificacao.identificarTurma({ ano: '2026', bimestre: 'B3', turma: '3B', componente: 'MAT', alunos: alunos.slice().reverse(), chave: CHAVE });
    assert.deepEqual(primeira.map((p) => p.id), segunda.map((p) => p.id));
    assert.deepEqual(primeira.map((p) => p.nome), ['ANA BEATRIZ', 'BRUNO DIAS', 'ÍTALO FERREIRA', 'ZILDA MARIA']);
});

test('lista numerada usa o número da chamada e completa quem veio sem número', () => {
    const provas = identificacao.identificarTurma({
        ano: '2026', bimestre: 'B3', turma: '1A', componente: 'RED', chave: CHAVE,
        alunos: [{ nome: 'Zilda', numero: 7 }, { nome: 'Ana', numero: 3 }, { nome: 'Bruno' }]
    });
    assert.deepEqual(provas.map((p) => p.numeroCurto), ['01', '03', '07']);
    assert.deepEqual(provas.map((p) => p.nome), ['BRUNO', 'ANA', 'ZILDA']);
});

test('cada componente e cada turma dão códigos diferentes para o mesmo aluno', () => {
    const base = { ano: '2026', bimestre: 'B3', turma: '1A', numero: 7, nome: 'ANA', chave: CHAVE };
    const codigos = new Set(['RED', 'LIN', 'NAT', 'HUM', 'MAT'].map(function (componente) {
        return identificacao.identificar(Object.assign({}, base, { componente: componente })).id;
    }));
    assert.equal(codigos.size, 5);
    assert.notEqual(
        identificacao.identificar(Object.assign({}, base, { componente: 'MAT' })).verificador,
        identificacao.identificar(Object.assign({}, base, { componente: 'MAT', turma: '1B' })).verificador
    );
});

test('conferência aceita o código certo e recusa nome, turma e chave trocados', () => {
    const prova = identificacao.identificar({ ano: '2026', bimestre: 'B3', turma: '1A', numero: 7, componente: 'LIN', nome: 'Ana Beatriz', chave: CHAVE });

    assert.equal(identificacao.conferir(prova.conteudoQr, null, CHAVE).valido, true);
    assert.equal(identificacao.conferir(prova.id, 'ana  beatriz', CHAVE).valido, true, 'espaço sobrando não muda o resultado');
    assert.equal(identificacao.conferir(prova.id, 'Bruno Dias', CHAVE).valido, false);
    assert.equal(identificacao.conferir(prova.id.replace('-1A-', '-1B-'), 'Ana Beatriz', CHAVE).valido, false);
    assert.equal(identificacao.conferir(prova.conteudoQr, null, 'outra-chave').valido, false);
    assert.equal(identificacao.conferir('qualquer coisa', 'Ana', CHAVE).motivo, 'formato');
    assert.equal(identificacao.conferir(prova.id, '', CHAVE).motivo, 'sem-nome');
});

/* ===== leitura da lista ===== */

test('lote com título de turma, planilha e turma na linha', () => {
    const resultado = lista.lerLote([
        'TURMA 1A',
        '01 - Ana Beatriz Lima',
        '02 - Bruno Dias',
        'TURMA 1B',
        'Nº;NOME;TURMA',
        '7;CARLA MENDES;1B',
        '3B - JOSÉ CARLOS',
        '20250012,MARIA DE FÁTIMA,2C',
        'PEDRO ALVES - 3A'
    ].join('\n'));

    assert.deepEqual(resultado.turmas.map((t) => t.turma), ['1A', '1B', '2C', '3A', '3B']);
    assert.deepEqual(resultado.turmas[0].alunos, [
        { nome: 'Ana Beatriz Lima', numero: 1 },
        { nome: 'Bruno Dias', numero: 2 }
    ]);
    assert.deepEqual(resultado.turmas[1].alunos, [{ nome: 'CARLA MENDES', numero: 7 }]);
    assert.equal(resultado.total, 6);
    assert.deepEqual(resultado.ignoradas, ['Nº;NOME;TURMA']);
});

test('numeração da chamada não é confundida com turma', () => {
    const resultado = lista.lerLote('TURMA 2B\n1 - Ana Cláudia\n2 - Carlos Alberto');
    assert.deepEqual(resultado.turmas.map((t) => t.turma), ['2B']);
    assert.deepEqual(resultado.turmas[0].alunos.map((a) => a.nome), ['Ana Cláudia', 'Carlos Alberto']);
});

test('turma escrita de outros jeitos ainda é reconhecida', () => {
    ['3B', '3º B', '3-B', 'TURMA 3 B', '3ª SERIE B'].forEach(function (escrita) {
        assert.equal(lista.reconhecerTurma(escrita), '3B', escrita);
    });
});

test('aluno sem turma nenhuma fica separado em vez de entrar na turma errada', () => {
    const resultado = lista.lerLote('Ana Beatriz Lima\nBruno Dias');
    assert.equal(resultado.turmas.length, 0);
    assert.equal(resultado.semTurma.length, 2);
});

test('nome repetido na mesma turma é avisado, mas os dois recebem código', () => {
    const resultado = lista.lerLote('TURMA 1C\nAna Lima\nANA LIMA');
    assert.equal(resultado.repetidos.length, 1);
    const provas = identificacao.identificarTurma({ ano: '2026', bimestre: 'B3', turma: '1C', componente: 'MAT', alunos: resultado.turmas[0].alunos, chave: CHAVE });
    assert.notEqual(provas[0].id, provas[1].id);
});

/* ===== QR ===== */

test('o QR cobre exatamente os módulos escuros e grava acento', () => {
    const conteudo = 'MLS-2026-B3-1A-007-LIN-DRYT\nJOSÉ ÍTALO GONÇALVES';
    const matriz = qr.matriz(conteudo);
    const retangulos = qr.retangulos(conteudo);

    let escuros = 0;
    matriz.linhas.forEach((linha) => linha.forEach((celula) => { if (celula) escuros++; }));
    const cobertos = retangulos.formas.reduce((soma, forma) => soma + forma.largura, 0);

    assert.equal(cobertos, escuros);
    assert.ok(retangulos.formas.length < escuros, 'junta módulos vizinhos em vez de desenhar um por um');
    assert.equal(retangulos.tamanho, matriz.tamanho);
});

/* ===== posição das marcas ===== */

test('a marca colada na prova acompanha a redução do conteúdo', () => {
    const altura = 29.7 * pdf.CM;
    const semReducao = pdf.resolverCaixa({ tipo: 'linha', xCm: 5.2, yCm: 3, larguraCm: 8 }, 21 * pdf.CM, altura, { escala: 1, dx: 0, dy: 0 });
    assert.ok(Math.abs(semReducao.x / pdf.CM - 5.2) < 0.01);
    assert.ok(Math.abs((altura - semReducao.y) / pdf.CM - 3) < 0.01);

    /* Faixa de 3,7 cm aberta no topo: a folha encolhe e desce. */
    const escala = (29.7 - 3.7) / 29.7;
    const comReducao = pdf.resolverCaixa({ tipo: 'linha', xCm: 5.2, yCm: 3, larguraCm: 8 }, 21 * pdf.CM, altura, { escala: escala, dx: (21 * pdf.CM * (1 - escala)) / 2, dy: 0 });
    const topoFinal = (altura - comReducao.y) / pdf.CM;
    assert.ok(Math.abs(topoFinal - (3.7 + 3 * escala)) < 0.02, 'cai em ' + topoFinal.toFixed(2) + ' cm');
    assert.ok(Math.abs(comReducao.largura / pdf.CM - 8 * escala) < 0.01, 'a largura encolhe junto');
});

test('o quadrado fica dentro da folha mesmo se pedirem grande demais', () => {
    const caixa = pdf.resolverCaixa({ tipo: 'quadrado', ancora: 'topo-direita', ladoCm: 40 }, 21 * pdf.CM, 29.7 * pdf.CM);
    assert.ok(caixa.x >= 2 && caixa.y >= 2);
    assert.ok(caixa.largura <= 21 * pdf.CM);
});

test('o nome comprido encolhe até caber, sem cortar', () => {
    /* Fonte de mentirinha: cada caractere mede 5 pontos por tamanho 10. */
    const fonte = { widthOfTextAtSize: (texto, tamanho) => texto.length * tamanho * 0.5 };
    const nome = 'JOSÉ ÍTALO GONÇALVES DA CONCEIÇÃO FILHO NETO';
    const encaixado = pdf.encaixarNome(fonte, nome, 11, 120, 2, 5);
    assert.ok(encaixado.tamanho < 11, 'diminuiu a fonte');
    assert.equal(encaixado.linhas.join(' '), nome, 'não perdeu nenhum pedaço do nome');
    assert.ok(encaixado.linhas.length <= 2);
});

test('caractere fora do repertório do PDF vira equivalente simples', () => {
    /* Aspas curvas, travessão e reticências aparecem em cabeçalho copiado do
       Word e não existem no WinAnsi das fontes padrão do PDF. */
    assert.equal(pdf.textoSeguro('JOÃO “ZÉ” — 1ª… ok'), 'JOÃO "ZÉ" - 1ª... ok');
    assert.equal(pdf.textoSeguro('ANA 😀'), 'ANA  ');
    assert.equal(pdf.textoSeguro('JOSÉ ÍTALO GONÇALVES'), 'JOSÉ ÍTALO GONÇALVES', 'acento do português passa intacto');
});

/* ===== saída ===== */

test('o CSV sai com ponto e vírgula, BOM e as colunas da conferência', () => {
    const provas = identificacao.identificarTurma({ ano: '2026', bimestre: 'B3', turma: '1A', componente: 'LIN', alunos: ['Ana; Maria', 'Bruno'], chave: CHAVE });
    const csv = saida.montarCsv(provas, { serieNome: '1ª SÉRIE', bimestre: 'B3', ano: '2026' });
    const linhas = csv.split('\r\n');

    assert.ok(csv.startsWith('﻿'), 'o BOM faz o Excel abrir com acento certo');
    assert.equal(linhas[0].replace('﻿', ''), 'NUMERO;ALUNO;TURMA;SERIE;COMPONENTE;BIMESTRE;ANO;IDENTIFICACAO');
    assert.ok(linhas[1].includes('"ANA; MARIA"'), 'ponto e vírgula no nome sai entre aspas');
    assert.equal(linhas.length, 3);
});

test('o nome do arquivo identifica a turma e o componente', () => {
    assert.equal(
        saida.nomeArquivo('PROVA', { ano: '2026', bimestre: 'B3', turma: '1A', componente: 'LIN' }, 'pdf'),
        'PROVA-2026-B3-1A-LIN.pdf'
    );
});

/* ===== geração do PDF ===== */

test('sai uma página por aluno, com o tamanho da folha original', async () => {
    const original = await global.PDFLib.PDFDocument.create();
    const folha = original.addPage([21 * pdf.CM, 29.7 * pdf.CM]);
    folha.drawText('ALUNO (A):', { x: 60, y: 760, size: 11 });
    const bytes = await original.save();

    const provas = identificacao.identificarTurma({
        ano: '2026', bimestre: 'B3', turma: '1A', componente: 'LIN', chave: CHAVE,
        alunos: ['Ana Beatriz', 'Bruno Dias', 'Carla Mendes']
    });

    const gerado = await pdf.montarPrimeirasPaginas({
        arquivo: { bytes: bytes, tipo: 'pdf' },
        identificacoes: provas,
        espacoTopoCm: 3.7,
        marcas: [{ tipo: 'quadrado', ancora: 'topo-direita', ladoCm: 3.4 }, { tipo: 'linha', xCm: 5, yCm: 3, larguraCm: 8, campos: ['nome', 'numero'] }],
        serieNome: '1ª SÉRIE'
    });

    const conferido = await global.PDFLib.PDFDocument.load(gerado);
    assert.equal(conferido.getPageCount(), 3);
    const tamanho = conferido.getPage(0).getSize();
    assert.ok(Math.abs(tamanho.width - 21 * pdf.CM) < 0.5);
    assert.ok(Math.abs(tamanho.height - 29.7 * pdf.CM) < 0.5);
});

test('a folha de etiquetas quebra de 14 em 14', async () => {
    const alunos = [];
    for (let i = 1; i <= 15; i++) alunos.push({ nome: 'ALUNO ' + i, numero: i });
    const provas = identificacao.identificarTurma({ ano: '2026', bimestre: 'B3', turma: '2A', componente: 'MAT', alunos: alunos, chave: CHAVE });
    const bytes = await pdf.montarEtiquetas({ identificacoes: provas, colunas: 2, linhas: 7, incluirQr: true });
    const documento = await global.PDFLib.PDFDocument.load(bytes);
    assert.equal(documento.getPageCount(), 2);
});

test('folha em branco não derruba a geração: sai só a identificação', async () => {
    const original = await global.PDFLib.PDFDocument.create();
    original.addPage([21 * pdf.CM, 29.7 * pdf.CM]); /* página sem nada desenhado */
    const bytes = await original.save();
    const provas = identificacao.identificarTurma({ ano: '2026', bimestre: 'B3', turma: '1A', componente: 'LIN', alunos: ['Ana'], chave: CHAVE });

    const gerado = await pdf.montarPrimeirasPaginas({ arquivo: { bytes: bytes, tipo: 'pdf' }, identificacoes: provas });
    const documento = await global.PDFLib.PDFDocument.load(gerado);
    assert.equal(documento.getPageCount(), 1);
});

test('arquivo que não é prova nenhuma dá recado claro', async () => {
    const provas = identificacao.identificarTurma({ ano: '2026', bimestre: 'B3', turma: '1A', componente: 'LIN', alunos: ['Ana'], chave: CHAVE });
    await assert.rejects(
        () => pdf.montarPrimeirasPaginas({ arquivo: { bytes: new Uint8Array([1, 2, 3]), tipo: 'pdf' }, identificacoes: provas }),
        /não consegui abrir este pdf/i
    );
    await assert.rejects(
        () => pdf.montarPrimeirasPaginas({ arquivo: { bytes: new Uint8Array([1]), tipo: 'docx' }, identificacoes: provas }),
        /formato não reconhecido/i
    );
});
