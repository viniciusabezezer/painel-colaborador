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

test('o cabeçalho marcado na prova fica exatamente onde foi marcado', () => {
    const altura = 29.7 * pdf.CM;
    const caixa = pdf.resolverCaixa(
        { xCm: 1, yCm: 0.6, larguraCm: 19, alturaCm: 2.5 },
        21 * pdf.CM, altura, { escala: 1, dx: 0, dy: 0 }
    );
    assert.ok(Math.abs(caixa.x / pdf.CM - 1) < 0.01);
    assert.ok(Math.abs((altura - caixa.y - caixa.altura) / pdf.CM - 0.6) < 0.01, 'a medida é do topo da folha');
    assert.ok(Math.abs(caixa.largura / pdf.CM - 19) < 0.01);
    assert.ok(Math.abs(caixa.altura / pdf.CM - 2.5) < 0.01);
});

test('cabeçalho marcado sobre a prova acompanha a redução dela', () => {
    const altura = 29.7 * pdf.CM;
    /* Faixa de 3,5 cm aberta no topo: a folha encolhe e desce. */
    const escala = (29.7 - 3.5) / 29.7;
    const caixa = pdf.resolverCaixa(
        { xCm: 2, yCm: 5, larguraCm: 10, alturaCm: 2.5 },
        21 * pdf.CM, altura,
        { escala: escala, dx: (21 * pdf.CM * (1 - escala)) / 2, dy: 0 }
    );
    const topo = (altura - caixa.y - caixa.altura) / pdf.CM;
    assert.ok(Math.abs(topo - (3.5 + 5 * escala)) < 0.03, 'cai em ' + topo.toFixed(2) + ' cm');
    assert.ok(Math.abs(caixa.largura / pdf.CM - 10 * escala) < 0.01, 'a largura encolhe junto');
});

test('cabeçalho na faixa que o app abriu não encolhe com a prova', () => {
    const altura = 29.7 * pdf.CM;
    const escala = (29.7 - 3.5) / 29.7;
    const caixa = pdf.resolverCaixa(
        { xCm: 1, yCm: 0.5, larguraCm: 19, alturaCm: 2.5, noEspacoAberto: true },
        21 * pdf.CM, altura, { escala: escala, dx: 0, dy: 0 }
    );
    assert.ok(Math.abs(caixa.largura / pdf.CM - 19) < 0.01, 'largura cheia na faixa nova');
    assert.ok(Math.abs((altura - caixa.y - caixa.altura) / pdf.CM - 0.5) < 0.01);
});

test('o cabeçalho fica dentro da folha mesmo se pedirem grande demais', () => {
    const caixa = pdf.resolverCaixa({ xCm: 30, yCm: 40, larguraCm: 40, alturaCm: 40 }, 21 * pdf.CM, 29.7 * pdf.CM, null);
    assert.ok(caixa.x >= 2 && caixa.y >= 2);
    assert.ok(caixa.largura <= 21 * pdf.CM && caixa.altura <= 29.7 * pdf.CM);
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
        cabecalho: { xCm: 1, yCm: 0.6, larguraCm: 19, alturaCm: 2.5 },
        serieNome: '1ª SÉRIE'
    });

    const conferido = await global.PDFLib.PDFDocument.load(gerado);
    assert.equal(conferido.getPageCount(), 3);
    const tamanho = conferido.getPage(0).getSize();
    assert.ok(Math.abs(tamanho.width - 21 * pdf.CM) < 0.5);
    assert.ok(Math.abs(tamanho.height - 29.7 * pdf.CM) < 0.5);
});

/* Página e fontes de mentirinha, para ler exatamente o que o cabeçalho
   escreve, sem precisar abrir o PDF de volta. */
function paginaDeTeste() {
    const textos = [];
    const retangulos = [];
    return {
        textos: textos,
        retangulos: retangulos,
        drawText: (texto, opcoes) => textos.push(Object.assign({ texto: texto }, opcoes)),
        drawRectangle: (opcoes) => retangulos.push(opcoes),
        drawLine: () => {},
        escrito: () => textos.map((t) => t.texto).join(' | ')
    };
}

const FONTES_DE_TESTE = (function () {
    const fonte = (fator) => ({ widthOfTextAtSize: (texto, tamanho) => texto.length * tamanho * fator });
    return { normal: fonte(0.5), negrito: fonte(0.55), mono: fonte(0.6) };
})();

test('o cabeçalho escreve nome, série, turma, número e código — e nada do que a prova já diz', () => {
    const prova = identificacao.identificar({
        ano: '2026', bimestre: 'B3', turma: '1A', numero: 3, componente: 'LIN',
        nome: 'José Ítalo Gonçalves', chave: CHAVE
    });
    const pagina = paginaDeTeste();
    pdf.desenharCabecalho(pagina, FONTES_DE_TESTE, prova, { x: 28, y: 700, largura: 19 * pdf.CM, altura: 2.5 * pdf.CM }, { serieNome: '1ª SÉRIE' });

    const escrito = pagina.escrito();
    assert.match(escrito, /ALUNO\(A\)/);
    assert.match(escrito, /JOSÉ ÍTALO GONÇALVES/);
    assert.match(escrito, /1ª SÉRIE {3}· {3}TURMA 1A {3}· {3}Nº 03/);
    assert.ok(escrito.includes(prova.id), 'o código sai legível ao lado dos dados');
    assert.ok(!/LINGUAGENS/i.test(escrito), 'não repete o componente, que o cabeçalho da prova já traz');
    assert.ok(!/SABOIA|BIMESTRE/i.test(escrito), 'não repete escola nem bimestre');
});

test('o nome é o maior elemento do cabeçalho', () => {
    const prova = identificacao.identificar({ ano: '2026', bimestre: 'B3', turma: '1A', numero: 3, componente: 'LIN', nome: 'Ana Lima', chave: CHAVE });
    const pagina = paginaDeTeste();
    pdf.desenharCabecalho(pagina, FONTES_DE_TESTE, prova, { x: 28, y: 700, largura: 19 * pdf.CM, altura: 2.5 * pdf.CM }, { serieNome: '1ª SÉRIE' });

    const doNome = pagina.textos.filter((t) => t.texto === 'ANA LIMA')[0];
    const maiorDosOutros = Math.max.apply(null, pagina.textos.filter((t) => t.texto !== 'ANA LIMA').map((t) => t.size));
    assert.ok(doNome.size > maiorDosOutros, 'nome em ' + doNome.size + 'pt contra ' + maiorDosOutros + 'pt');
});

test('sem QR, o código continua saindo; o QR encaixa na altura do bloco', () => {
    const prova = identificacao.identificar({ ano: '2026', bimestre: 'B3', turma: '1A', numero: 3, componente: 'LIN', nome: 'Ana Lima', chave: CHAVE });
    const caixa = { x: 28, y: 700, largura: 19 * pdf.CM, altura: 2.5 * pdf.CM };

    const semQr = paginaDeTeste();
    pdf.desenharCabecalho(semQr, FONTES_DE_TESTE, prova, caixa, { serieNome: '1ª SÉRIE', incluirQr: false });
    assert.ok(semQr.escrito().includes(prova.id));
    /* Sem QR sobram só a moldura e o fundo; com QR vêm centenas de módulos. */
    assert.ok(semQr.retangulos.length < 5, 'nenhum módulo de QR desenhado');

    const comQr = paginaDeTeste();
    pdf.desenharCabecalho(comQr, FONTES_DE_TESTE, prova, caixa, { serieNome: '1ª SÉRIE' });
    assert.ok(comQr.retangulos.length > 100, 'o QR sai desenhado em retângulos');

    const fundoQr = comQr.retangulos.filter((r) => r.width === r.height && r.width > 40)[0];
    assert.ok(fundoQr, 'o QR é quadrado');
    assert.ok(fundoQr.width <= caixa.altura, 'e cabe na altura do cabeçalho');
    assert.ok(fundoQr.x + fundoQr.width <= caixa.x + caixa.largura, 'e dentro da largura');
});

test('o logotipo da escola entra no cabeçalho, do lado oposto ao QR, sem invadir o texto', () => {
    const prova = identificacao.identificar({ ano: '2026', bimestre: 'B3', turma: '1A', numero: 3, componente: 'LIN', nome: 'Ana Lima', chave: CHAVE });
    const caixa = { x: 28, y: 700, largura: 19 * pdf.CM, altura: 2.5 * pdf.CM };
    const imagens = [];
    const pagina = paginaDeTeste();
    pagina.drawImage = (imagem, opcoes) => imagens.push(opcoes);
    const fontes = Object.assign({ logo: { width: 192, height: 192 } }, FONTES_DE_TESTE);
    pdf.desenharCabecalho(pagina, fontes, prova, caixa, { serieNome: '1ª SÉRIE' });

    assert.equal(imagens.length, 1, 'o logo é desenhado uma vez');
    const logo = imagens[0];
    assert.ok(logo.x >= caixa.x && logo.x + logo.width < caixa.x + caixa.largura / 2, 'o logo fica à esquerda');
    assert.ok(logo.height <= caixa.altura && logo.y >= caixa.y, 'e cabe na altura do cabeçalho');
    const textoMaisAEsquerda = Math.min.apply(null, pagina.textos.map((t) => t.x));
    assert.ok(textoMaisAEsquerda > logo.x + logo.width, 'o texto começa depois do logo');
});

test('as primeiras páginas saem com o logo.png embutido', async () => {
    const fs = require('node:fs');
    const original = await global.PDFLib.PDFDocument.create();
    original.addPage([21 * pdf.CM, 29.7 * pdf.CM]).drawText('PROVA', { x: 60, y: 700, size: 11 });
    const provas = identificacao.identificarTurma({
        ano: '2026', bimestre: 'B3', turma: '1A', componente: 'LIN', chave: CHAVE, alunos: ['Ana Beatriz']
    });
    const gerado = await pdf.montarPrimeirasPaginas({
        arquivo: { bytes: await original.save(), tipo: 'pdf' },
        identificacoes: provas,
        logo: new Uint8Array(fs.readFileSync(path.join(__dirname, '..', 'logo.png')))
    });
    const conferido = await global.PDFLib.PDFDocument.load(gerado);
    const recursos = conferido.getPage(0).node.Resources().toString();
    assert.match(recursos, /XObject/, 'a página traz a imagem do logo');
});

test('com prova de várias páginas, cada aluno leva a capa com cabeçalho e o verso sem cabeçalho', async () => {
    const original = await global.PDFLib.PDFDocument.create();
    ['CAPA', 'VERSO', 'TERCEIRA'].forEach((texto) => {
        original.addPage([21 * pdf.CM, 29.7 * pdf.CM]).drawText(texto, { x: 60, y: 700, size: 11 });
    });
    const provas = identificacao.identificarTurma({
        ano: '2026', bimestre: 'B3', turma: '1A', componente: 'LIN', chave: CHAVE,
        alunos: ['Ana Beatriz', 'Bruno Dias', 'Carla Mendes']
    });
    const gerado = await pdf.montarPrimeirasPaginas({
        arquivo: { bytes: await original.save(), tipo: 'pdf' }, identificacoes: provas
    });
    const conferido = await global.PDFLib.PDFDocument.load(gerado);
    assert.equal(conferido.getPageCount(), 6, 'duas páginas por aluno; a terceira página não entra');

    /* A capa recebe o cabeçalho (fontes e desenho próprios); o verso só
       carrega a página original, incorporada como um único objeto. */
    const fontesDa = (i) => {
        const fontes = conferido.getPage(i).node.Resources().lookup(global.PDFLib.PDFName.of('Font'));
        return fontes ? fontes.keys().length : 0;
    };
    for (let aluno = 0; aluno < 3; aluno++) {
        assert.ok(fontesDa(aluno * 2) > 0, 'a capa do aluno ' + (aluno + 1) + ' traz o cabeçalho');
        assert.equal(fontesDa(aluno * 2 + 1), 0, 'o verso do aluno ' + (aluno + 1) + ' sai sem cabeçalho');
    }
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
