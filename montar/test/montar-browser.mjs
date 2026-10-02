/* Regressão de ponta a ponta do Montador de Provas, com Chromium de verdade:
   monta uma Avaliação Bimestral colando as questões de exemplo, confere a
   paginação, gera o PDF como a impressão do navegador gera e testa o editor
   de modelos e a prova do zero.
   Uso:  node montar/test/montar-browser.mjs
   Precisa do playwright instalado (global serve). Os arquivos ficam em
   montar/test/saida/ para inspeção. */
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';

const exigir = createRequire(import.meta.url);
function carregarPlaywright() {
    for (const nome of ['playwright', '/opt/node22/lib/node_modules/playwright', 'playwright-core']) {
        try { return exigir(nome); } catch (erro) { /* tenta o próximo */ }
    }
    throw new Error('Instale o playwright para rodar este teste: npm i -g playwright');
}
const { chromium } = carregarPlaywright();

const APP = resolve(import.meta.dirname, '..');
const RAIZ = resolve(APP, '..');
const SAIDA = join(APP, 'test', 'saida');
const PORTA = 8741;
const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };

function servir(raiz, porta) {
    const servidor = createServer(async (pedido, resposta) => {
        let arquivo = join(raiz, decodeURIComponent(pedido.url.split('?')[0]));
        if (existsSync(arquivo) && statSync(arquivo).isDirectory()) arquivo = join(arquivo, 'index.html');
        if (!arquivo.startsWith(raiz) || !existsSync(arquivo)) { resposta.writeHead(404).end('nao encontrado'); return; }
        resposta.writeHead(200, { 'Content-Type': TIPOS[extname(arquivo)] || 'application/octet-stream' });
        resposta.end(await readFile(arquivo));
    });
    return new Promise((ok) => servidor.listen(porta, () => ok(servidor)));
}

const feitos = [];
function conferir(certo, mensagem) {
    if (!certo) throw new Error('FALHOU: ' + mensagem);
    feitos.push(mensagem);
}

const servidor = await servir(RAIZ, PORTA);
const navegador = await chromium.launch();
const contexto = await navegador.newContext({ viewport: { width: 1400, height: 1000 } });
const pagina = await contexto.newPage();
const erros = [];
const RUIDO = /fonts\.googleapis|fonts\.gstatic|ERR_CERT_AUTHORITY_INVALID|ERR_INTERNET_DISCONNECTED/;
pagina.on('pageerror', (erro) => erros.push(String(erro)));
pagina.on('console', (msg) => { if (msg.type() === 'error' && !RUIDO.test(msg.text())) erros.push(msg.text()); });
pagina.on('requestfailed', (p) => { if (!RUIDO.test(p.url())) erros.push('pedido falhou: ' + p.url()); });
pagina.on('dialog', (d) => d.accept(d.type() === 'prompt' ? 'Modelo de teste' : undefined));

try {
    await mkdir(SAIDA, { recursive: true });
    await pagina.goto(`http://127.0.0.1:${PORTA}/montar/`);

    const cartoes = await pagina.$$eval('#lista-modelos .cartao h3', (n) => n.map((x) => x.textContent));
    conferir(cartoes[0] === 'Avaliação Bimestral Malu', 'o modelo fixo vem primeiro');
    conferir(cartoes.includes('Avaliação Parcial') && cartoes.includes('Prova do zero'), 'parcial e prova do zero aparecem');
    conferir(!(await pagina.$('#lista-modelos .cartao--fixo [data-apagar-modelo]')), 'o modelo fixo não tem botão de apagar');

    /* --- a bimestral --- */
    await pagina.click('[data-usar="bimestral-malu"]');
    await pagina.waitForSelector('#tela-editor:not([hidden]) .folha');
    await pagina.selectOption('[data-p="serie"]', '2');
    await pagina.selectOption('[data-p="componente"]', 'NAT');
    const secoes = await pagina.$$eval('[data-campo="secao-titulo"]', (n) => n.map((x) => x.value));
    conferir(secoes.join('|') === 'BIOLOGIA|FÍSICA|QUÍMICA', 'nasce com Biologia, Física e Química');
    conferir(await pagina.$eval('[data-p="titulo"]', (n) => n.value) === 'Avaliação Bimestral de Ciências da Natureza', 'o nome acompanha a área');
    conferir(await pagina.$('#formato .formato-travado') !== null, 'o formato aparece travado');

    await pagina.click('#add-colar');
    await pagina.fill('#colar-texto', await readFile(join(APP, 'test', 'questoes-exemplo.txt'), 'utf8') +
        '12. Quanto vale 2 + 2?\na) 1\nb) 2\nc) 3\nd) 4\ne) 5\nGabarito: D\n');
    await pagina.waitForSelector('#colar-acrescentar:not([disabled])');
    conferir((await pagina.textContent('#colar-resultado')).includes('12 questões'), 'a colagem reconhece 12 questões');
    await pagina.click('#colar-acrescentar');
    await pagina.waitForFunction(() => document.querySelectorAll('#secoes .questao').length === 12);
    await pagina.waitForTimeout(400);

    const info = await pagina.evaluate(() => {
        const folhas = [...document.querySelectorAll('#paginas .folha')];
        const f1 = folhas[0];
        const faixa = f1.querySelector('.faixa').getBoundingClientRect();
        const folha = f1.getBoundingClientRect();
        const escala = folha.width / f1.offsetWidth;
        const cm = (px) => px / escala / (96 / 2.54);
        const colunas = [...document.querySelectorAll('#paginas .coluna')];
        return {
            folhas: folhas.length,
            rodape: f1.querySelector('.rodape').textContent,
            faixaTopoCm: cm(faixa.top - folha.top),
            faixaEsquerdaCm: cm(faixa.left - folha.left),
            instrucoesCm: (() => { const r = f1.querySelector('.instrucoes').getBoundingClientRect(); return [cm(r.left - folha.left), cm(r.width)]; })(),
            colunasCm: (() => { const r = f1.querySelector('.colunas').getBoundingClientRect(); return [cm(r.left - folha.left), cm(r.width)]; })(),
            faixaAlturaCm: cm(faixa.height),
            faixaLarguraCm: cm(faixa.width),
            gabarito: !!f1.querySelector('.coluna .bloco-gabarito'),
            instrucoes: f1.querySelector('.instrucoes li:last-child strong') !== null,
            transbordou: colunas.some((c) => { const u = c.lastElementChild; return u && u.offsetTop + u.offsetHeight > c.clientHeight + 1; }),
            partidos: document.querySelectorAll('#paginas .partido').length,
            primeiraColuna2: f1.querySelectorAll('.coluna')[1].firstElementChild.textContent.slice(0, 40),
            secao: f1.querySelector('.secao-titulo').textContent
        };
    });
    conferir(info.folhas >= 2, 'a prova tem ' + info.folhas + ' folhas');
    conferir(info.rodape === '1/' + info.folhas, 'o pé da página traz 1/' + info.folhas);
    conferir(Math.abs(info.faixaTopoCm - 0.6) < 0.05 && Math.abs(info.faixaAlturaCm - 2.5) < 0.05 && Math.abs(info.faixaLarguraCm - 19) < 0.05,
        'o espaço da identificação tem 19 × 2,5 cm, a 0,6 cm do alto, como no Identificador (' + info.faixaTopoCm.toFixed(2) + ', ' + info.faixaLarguraCm.toFixed(2) + ' × ' + info.faixaAlturaCm.toFixed(2) + ')');
    conferir(Math.abs(info.faixaEsquerdaCm - 1) < 0.05, 'a faixa começa a 1 cm da esquerda (' + info.faixaEsquerdaCm.toFixed(2) + ')');
    conferir(Math.abs(info.instrucoesCm[0] - 1) < 0.05 && Math.abs(info.instrucoesCm[1] - 19) < 0.05, 'o quadro de instruções fica alinhado à faixa');
    conferir(Math.abs(info.colunasCm[0] - 0.5) < 0.05 && Math.abs(info.colunasCm[1] - 20) < 0.05, 'margens mínimas de 0,5 cm: as colunas ocupam 20 cm da folha (' + info.colunasCm.map((v) => v.toFixed(2)).join(' / ') + ')');
    conferir(info.gabarito, 'o gabarito abre a primeira coluna');
    conferir(info.instrucoes, 'a última instrução sai em negrito');
    conferir(!info.transbordou, 'nenhuma coluna transborda');
    conferir(info.secao === 'BIOLOGIA', 'o título da seção sai na folha');

    const svg = await pagina.$eval('#paginas .gabarito-svg', (s) => ({ bolhas: s.querySelectorAll('circle').length, texto: s.textContent }));
    conferir(svg.bolhas === 20 + 12 * 5, 'o gabarito tem as bolhas do número da lista e das 12 questões');

    const aparencia = await pagina.evaluate(() => {
        const f = document.querySelector('#paginas .folha');
        const p = f.querySelector('.q-par');
        return {
            fonte: getComputedStyle(p).fontFamily,
            corpo: getComputedStyle(p).fontSize,
            icone: !!f.querySelector('.secao-titulo svg.icone-disc'),
            brasao: !!f.querySelector('.faixa .faixa-brasao'),
            linha: !!document.querySelector('#paginas .alt-grade'),
            celulas: [...document.querySelectorAll('#paginas .alt-grade')].map((g) => g.children.length)
        };
    });
    conferir(/Times New Roman/.test(aparencia.fonte) && aparencia.corpo === '13.3333px', 'Times New Roman 10 é o padrão (' + aparencia.fonte.split(',')[0] + ', ' + aparencia.corpo + ')');
    conferir(aparencia.icone, 'o título BIOLOGIA sai com o ícone da disciplina');
    conferir(aparencia.brasao, 'a faixa mostra, na tela, o cabeçalho do Identificador com o brasão');
    conferir(aparencia.celulas.includes(5), 'alternativas curtas (1, 2, 3…) vão todas numa linha só');
    const dispQ12 = await pagina.evaluate(() => window.MontadorProvas.resultado().disposicoes);
    conferir(Object.values(dispQ12).includes('lista'), 'alternativas longas continuam uma por linha');

    /* o gabarito é opcional, também no modelo fixo */
    await pagina.uncheck('[data-a="gabarito"]');
    await pagina.waitForFunction(() => !document.querySelector('#paginas .bloco-gabarito'));
    conferir(true, 'desmarcando, o gabarito sai da prova');
    await pagina.check('[data-a="gabarito"]');
    await pagina.waitForFunction(() => !!document.querySelector('#paginas .bloco-gabarito'));

    /* a fonte e o tamanho mudam */
    await pagina.selectOption('[data-a="fonte"]', 'arial');
    await pagina.selectOption('[data-a="corpoPt"]', '11');
    await pagina.waitForFunction(() => /Arial/.test(getComputedStyle(document.querySelector('#paginas .q-par')).fontFamily));
    conferir(true, 'a fonte e o tamanho mudam na prévia');
    /* instruções: editáveis também na bimestral fixa */
    conferir((await pagina.inputValue('#ins-texto')).startsWith('Esta avaliação deverá ser feita individual'), 'as instruções da escola vêm preenchidas para editar');
    await pagina.fill('#ins-texto', 'Esta avaliação deverá ser feita individual e sem consulta;\n**Boa prova!**');
    await pagina.click('#ins-sugestoes [data-sugestao="1"]');
    await pagina.waitForFunction(() => document.querySelectorAll('#paginas .instrucoes li').length === 3);
    const instrucoes = await pagina.$$eval('#paginas .instrucoes li', (n) => n.map((x) => x.innerHTML));
    conferir(instrucoes[1].includes('calculadora') && instrucoes[2].replace(/<\/strong> <strong>/g, ' ') === '<strong>Boa prova!</strong>', 'o professor muda as instruções e a sugestão entra antes da linha final em negrito');
    conferir(await pagina.$('#ins-sugestoes [data-sugestao="1"][disabled]') !== null, 'sugestão já usada fica apagada');
    await pagina.uncheck('#ins-ligado');
    await pagina.waitForFunction(() => !document.querySelector('#paginas .instrucoes'));
    conferir(true, 'o quadro de instruções pode sair da prova');
    await pagina.check('#ins-ligado');
    await pagina.click('#ins-restaurar');
    await pagina.waitForFunction(() => document.querySelectorAll('#paginas .instrucoes li').length === 5);
    conferir((await pagina.inputValue('#ins-texto')).includes('O Gabarito deverá estar preenchido'), '"Voltar às instruções do modelo" traz as da escola de volta');

    /* margem maior: o texto encolhe, a faixa fica no lugar do Identificador */
    await pagina.selectOption('[data-a="margemCm"]', '1.5');
    await pagina.waitForFunction(() => getComputedStyle(document.querySelector('#paginas .folha')).getPropertyValue('--margem').trim() === '1.5cm');
    await pagina.waitForTimeout(400);
    const comMargem = await pagina.evaluate(() => {
        const f = document.querySelector('#paginas .folha');
        const esc = f.getBoundingClientRect().width / f.offsetWidth;
        const cm = (px) => px / esc / (96 / 2.54);
        const a = f.getBoundingClientRect();
        const fx = f.querySelector('.faixa').getBoundingClientRect();
        const col = f.querySelector('.colunas').getBoundingClientRect();
        return { faixa: [cm(fx.left - a.left), cm(fx.top - a.top), cm(fx.width)], colunas: cm(col.left - a.left) };
    });
    conferir(Math.abs(comMargem.faixa[0] - 1) < 0.05 && Math.abs(comMargem.faixa[1] - 0.6) < 0.05 && Math.abs(comMargem.faixa[2] - 19) < 0.05 && Math.abs(comMargem.colunas - 1.5) < 0.05,
        'com margem de 1,5 cm, o texto recua e a faixa continua em 1 × 0,6 cm, 19 cm de largura');
    await pagina.selectOption('[data-a="margemCm"]', '0.5');
    await pagina.waitForTimeout(400);

    /* linha entre as colunas, por padrão */
    conferir(await pagina.$('#paginas .colunas.com-linha') !== null, 'a linha entre as colunas vem por padrão');

    /* gabarito como imagem, na prova */
    await pagina.selectOption('[data-a="gabaritoOrigem"]', 'imagem');
    const [escolhaGab] = await Promise.all([pagina.waitForEvent('filechooser'), pagina.click('#gab-escolher')]);
    await escolhaGab.setFiles(join(APP, 'logo.png'));
    await pagina.waitForSelector('#paginas .bloco-gabarito img.gabarito-imagem');
    conferir(!(await pagina.$('#paginas .bloco-gabarito svg')), 'o gabarito pode ser uma imagem enviada pelo professor, no lugar do gerado');

    /* gabarito à parte, 4 por folha */
    await pagina.selectOption('[data-a="gabaritoLocal"]', 'separado');
    await pagina.waitForFunction(() => !document.querySelector('#paginas .bloco-gabarito') && document.querySelectorAll('#paginas-gabaritos .quarto').length === 4);
    conferir(await pagina.isVisible('#previa-gabaritos'), 'em folha à parte, o gabarito sai da prova e aparece 4 por folha na prévia');
    conferir(/de gabarito/.test(await pagina.textContent('#folhas-total')), 'a conta de folhas inclui as de gabarito: ' + await pagina.textContent('#folhas-total'));
    await pagina.selectOption('[data-a="gabaritoOrigem"]', 'gerado');
    await pagina.waitForFunction(() => document.querySelectorAll('#paginas-gabaritos .quarto .gabarito-svg').length === 4);
    await pagina.evaluate(() => { window.print = () => {}; });
    await pagina.click('#gab-imprimir4');
    await pagina.emulateMedia({ media: 'print' });
    const estadoImpressao = await pagina.evaluate(() => document.body.className + ' / ' + getComputedStyle(document.getElementById('tela-editor')).display);
    conferir(/none$/.test(estadoImpressao), 'na impressão dos gabaritos a prova não sai junto (' + estadoImpressao + ')');
    const pdf4 = await pagina.pdf({ preferCSSPageSize: true, printBackground: true });
    await writeFile(join(SAIDA, 'gabaritos-4-por-folha.pdf'), pdf4);
    conferir((pdf4.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length === 1, 'os 4 gabaritos saem numa folha só');
    await pagina.emulateMedia({ media: 'screen' });
    await pagina.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    await pagina.click('#gab-imprimir1');
    await pagina.emulateMedia({ media: 'print' });
    const larguraGrade = await pagina.evaluate(() => {
        const svg = document.querySelector('#gabaritos-impressao .gabarito-svg');
        return svg.getBoundingClientRect().width / (96 / 25.4);
    });
    conferir(Math.abs(larguraGrade - 86.6) < 0.5, 'a grade sai no tamanho real, sem encolher (' + larguraGrade.toFixed(1) + ' mm)');
    const pdf1 = await pagina.pdf({ preferCSSPageSize: true, printBackground: true });
    await writeFile(join(SAIDA, 'gabarito-1-por-pagina.pdf'), pdf1);
    const caixa = /\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/.exec(pdf1.toString('latin1'));
    conferir(caixa && Math.abs(caixa[1] - 297.6) < 2 && Math.abs(caixa[2] - 420.9) < 2, 'um por página sai em 10,5 × 14,85 cm, para o Identificador (' + (caixa ? caixa[1] + '×' + caixa[2] : '?') + ' pt)');
    await pagina.emulateMedia({ media: 'screen' });
    await pagina.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    conferir(!(await pagina.$('#pagina-quarto')), 'depois de imprimir, a página volta ao A4');
    await pagina.selectOption('[data-a="gabaritoLocal"]', 'prova');
    await pagina.waitForSelector('#paginas .bloco-gabarito svg');

    await pagina.selectOption('[data-a="fonte"]', 'times');
    await pagina.selectOption('[data-a="corpoPt"]', '10');
    await pagina.waitForFunction(() => /Times/.test(getComputedStyle(document.querySelector('#paginas .q-par')).fontFamily) &&
        document.querySelectorAll('#paginas .folha').length === Number(document.querySelector('#paginas .rodape').textContent.split('/')[1]));
    await pagina.waitForTimeout(400);
    info.folhas = await pagina.$$eval('#paginas .folha', (n) => n.length);
    conferir(svg.texto.includes('2º Ano') && svg.texto.includes('C.N.'), 'o rótulo do gabarito traz a série e a área');

    const prova = await pagina.evaluate(() => window.MontadorProvas.estado());
    conferir(prova.secoes[0].questoes[0].correta === 'D', 'a resposta marcada na colagem foi guardada');

    /* a prova vai para a folha, sem a dica da faixa */
    await pagina.emulateMedia({ media: 'print' });
    conferir(!(await pagina.isVisible('.faixa-dica')), 'a dica da faixa não sai na impressão');
    conferir(!(await pagina.isVisible('#editor')), 'o editor não sai na impressão');
    const pdf = await pagina.pdf({ preferCSSPageSize: true, printBackground: true });
    await writeFile(join(SAIDA, 'bimestral.pdf'), pdf);
    const paginasPdf = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
    conferir(paginasPdf === info.folhas, 'o PDF sai com as mesmas ' + info.folhas + ' folhas da prévia (' + paginasPdf + ')');
    await pagina.emulateMedia({ media: 'screen' });

    /* gabarito do professor */
    await pagina.evaluate(() => {
        window.print = () => {};
    });
    await pagina.click('#ed-chave');
    await pagina.emulateMedia({ media: 'print' });
    const pdfChave = await pagina.pdf({ preferCSSPageSize: true });
    await writeFile(join(SAIDA, 'gabarito-professor.pdf'), pdfChave);
    const chave = await pagina.$$eval('#chave .chave-item', (n) => n.map((x) => x.textContent));
    conferir(chave.length === 12 && chave[0].startsWith('01D'), 'o gabarito do professor lista as respostas (' + chave[0] + ')');
    await pagina.emulateMedia({ media: 'screen' });
    await pagina.evaluate(() => window.dispatchEvent(new Event('afterprint')));

    /* colar texto formatado do Word: vira marcação */
    await pagina.click('#abrir-todas');
    const colado = await pagina.evaluate(() => {
        const ta = document.querySelector('.questao[data-q] textarea[data-campo="enunciado"]');
        ta.value = '';
        ta.focus();
        const dt = new DataTransfer();
        dt.setData('text/html', '<p class=MsoNormal>Leia o <b>texto</b> e veja o <i>Homo sapiens</i> e o H<sub>2</sub>O.</p><p>Segundo parágrafo.</p>');
        dt.setData('text/plain', 'Leia o texto');
        ta.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
        return ta.value;
    });
    conferir(colado === 'Leia o **texto** e veja o *Homo sapiens* e o H~2~O.\nSegundo parágrafo.', 'colar do Word mantém negrito, itálico e índice: ' + JSON.stringify(colado));

    /* botões de formatação */
    await pagina.evaluate(() => {
        const ta = document.querySelector('.questao[data-q] textarea[data-campo="enunciado"]');
        ta.focus();
        ta.setSelectionRange(0, 4);
    });
    await pagina.click('.questao[data-q] [data-fmt="b"]');
    conferir((await pagina.$eval('.questao[data-q] textarea[data-campo="enunciado"]', (t) => t.value)).startsWith('**Leia**'), 'o botão N põe a seleção em negrito');

    /* imagem: escolher, tamanho e posição */
    const [seletor] = await Promise.all([
        pagina.waitForEvent('filechooser'),
        pagina.click('.questao[data-q] [data-acao="img-escolher"]')
    ]);
    await seletor.setFiles(join(APP, 'logo.png'));
    await pagina.waitForSelector('#paginas .q-img img.q-foto');
    conferir(true, 'a imagem escolhida entra na prova');
    await pagina.$eval('.img-item input[type=range]', (r) => { r.value = '30'; r.dispatchEvent(new Event('input', { bubbles: true })); });
    await pagina.waitForTimeout(400);
    const larguraImg = await pagina.evaluate(() => {
        const img = document.querySelector('#paginas .q-img img');
        return img.offsetWidth / img.closest('.coluna').clientWidth;
    });
    conferir(Math.abs(larguraImg - 0.3) < 0.02, 'o controle de tamanho deixa a imagem com 30% da coluna (' + larguraImg.toFixed(2) + ')');
    conferir(await pagina.evaluate(() => getComputedStyle(document.querySelector('#paginas .q-foto')).filter.includes('grayscale')), 'a imagem sai em tons de cinza para poupar tinta');
    await pagina.selectOption('.img-item select[data-campo="img-posicao"]', 'lado');
    await pagina.waitForSelector('#paginas .q-lado .q-foto-lado');
    conferir(true, 'a imagem pode ir ao lado do texto');

    /* imagem colada na zona de colar */
    const comImagem = await pagina.evaluate(async () => {
        const bytes = await (await fetch('logo.png')).blob();
        const zona = document.querySelectorAll('.questao[data-q] [data-zona]')[1];
        const dt = new DataTransfer();
        dt.items.add(new File([bytes], 'print.png', { type: 'image/png' }));
        zona.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
        await new Promise((r) => setTimeout(r, 600));
        return window.MontadorProvas.estado().secoes[0].questoes[1].imagens.length;
    });
    conferir(comImagem === 1, 'colar um print na zona da questão põe a imagem nela');

    /* texto de apoio: sem número, sem gabarito */
    await pagina.click('.secao[data-s] >> nth=0 >> [data-acao="add-texto"]');
    await pagina.fill('.questao--texto textarea[data-campo="enunciado"]', 'TEXTO I\nUm texto de apoio para as próximas questões.');
    await pagina.waitForTimeout(500);
    conferir(await pagina.$$eval('#paginas .texto-apoio', (n) => n.length) === 2, 'o texto de apoio sai na prova');
    conferir(await pagina.$eval('#paginas .gabarito-svg', (s) => s.querySelectorAll('circle').length) === 20 + 12 * 5, 'o texto de apoio não entra no gabarito');

    /* desfazer */
    const antesDeApagar = await pagina.$$eval('#secoes .questao', (n) => n.length);
    await pagina.click('.questao--texto [data-acao="q-apagar"]');
    conferir(await pagina.$$eval('#secoes .questao', (n) => n.length) === antesDeApagar - 1, 'apagar tira a questão');
    await pagina.click('#ed-desfazer');
    conferir(await pagina.$$eval('#secoes .questao', (n) => n.length) === antesDeApagar, 'desfazer traz de volta');

    /* economia de papel */
    await pagina.fill('#copias', '40');
    await pagina.click('#economizar');
    await pagina.waitForSelector('#proposta:not([hidden])');
    conferir((await pagina.textContent('#proposta')).length > 20, 'economizar papel dá uma resposta: ' + (await pagina.textContent('#proposta')).slice(0, 90));
    conferir(/\d+ folhas/.test(await pagina.textContent('#folhas-total')), 'mostra o total de folhas para a turma: ' + await pagina.textContent('#folhas-total'));
    if (await pagina.$('#aplicar-proposta')) await pagina.click('#aplicar-proposta');
    else await pagina.click('#fechar-proposta');

    /* edição: questão nova, discursiva, guardada */
    await pagina.click('.secao[data-s] >> nth=1 >> [data-acao="add-discursiva"]');
    await pagina.fill('.secao[data-s] >> nth=1 >> .questao[open] textarea[data-campo="enunciado"]', 'Explique a **importância** do CO~2~ na fotossíntese.');
    await pagina.waitForTimeout(900);
    const html = await pagina.$eval('#paginas', (p) => p.innerHTML);
    conferir(html.includes('<strong>importância</strong>') && html.includes('CO<sub>2</sub>'), 'a marcação vira negrito e índice na folha');
    conferir(html.includes('q-linha'), 'a discursiva ganha as linhas de resposta');
    conferir((await pagina.textContent('#ed-status')).includes('Salvo'), 'a prova se salva sozinha');

    await pagina.screenshot({ path: join(SAIDA, 'editor.png') });

    /* recarrega e a prova continua lá */
    await pagina.reload();
    await pagina.waitForSelector('#tela-editor:not([hidden]) .folha');
    conferir(await pagina.$$eval('#secoes .questao', (n) => n.length) === 14, 'depois de recarregar, as 13 questões e o texto de apoio continuam');

    /* imprimir guarda a versão em "últimos arquivos" */
    await pagina.evaluate(() => { window.print = () => {}; });
    await pagina.click('#ed-imprimir');
    await pagina.waitForTimeout(300);

    /* versão B */
    await pagina.click('#ed-versaob');
    await pagina.waitForFunction(() => /Tipo B/.test(document.getElementById('ed-titulo').textContent));
    const b = await pagina.evaluate(() => window.MontadorProvas.estado().secoes[0].questoes.find((q) => q.fonte === 'Uece'));
    conferir(b.alternativas[0] !== 'Possuem ciclo de vida assexuado e sexuado.' || b.correta !== 'D', 'a versão B abre com as alternativas em outra ordem');
    conferir(b.alternativas['ABCDE'.indexOf(b.correta)].startsWith('Não possuem células'), 'na versão B a resposta certa acompanha a alternativa');

    /* --- do zero: formato livre --- */
    await pagina.goto(`http://127.0.0.1:${PORTA}/montar/#/`);
    await pagina.waitForSelector('#tela-inicio:not([hidden]) .prova-linha');
    const arquivos = await pagina.$$eval('#lista-arquivos .prova-linha strong', (n) => n.map((x) => x.textContent));
    conferir(arquivos.includes('PROVA-2026-B3-2S-NAT') && arquivos.includes('PROVA-2026-B3-2S-NAT-GABARITO-PROFESSOR'), 'a prova e o gabarito impressos ficam em "Últimos arquivos gerados"');
    await pagina.click('[data-usar="do-zero"]');
    await pagina.waitForSelector('#tela-editor:not([hidden]) #formato select[data-l="cabecalho"]');
    await pagina.selectOption('#formato [data-l="colunas"]', '1');
    await pagina.fill('[data-p="professor"]', 'Maria Teste');
    await pagina.fill('.questao[open] textarea[data-campo="enunciado"]', 'Quanto é 2 + 2?');
    await pagina.waitForTimeout(500);
    const zero = await pagina.evaluate(() => ({
        colunas: document.querySelectorAll('#paginas .folha:first-child .coluna').length,
        cabecalho: !!document.querySelector('#paginas .cab-completo'),
        professor: document.querySelector('#paginas .cab-completo').textContent.includes('Maria Teste')
    }));
    conferir(zero.colunas === 1 && zero.cabecalho && zero.professor, 'a prova do zero sai com o cabeçalho completo e uma coluna');
    await pagina.emulateMedia({ media: 'print' });
    await writeFile(join(SAIDA, 'do-zero.pdf'), await pagina.pdf({ preferCSSPageSize: true }));
    await pagina.emulateMedia({ media: 'screen' });
    await pagina.click('#formato .acoes-lista button');
    await pagina.waitForTimeout(100);

    /* --- modelos --- */
    /* o domínio do Montador servindo o repositório inteiro: o app fica em /montar/,
       mas se comporta como site próprio (o Chromium leva *.localhost à máquina) */
    await pagina.goto(`http://montador-provas-malu.localhost:${PORTA}/montar/`);
    await pagina.waitForSelector('#tela-inicio:not([hidden]) .cartao');
    conferir(!(await pagina.$('#voltar-ao-painel')) && !(await pagina.$('a[href="../provas/"]')),
        'no domínio do Montador, mesmo em /montar/, não há link para o painel');
    await pagina.goto(`http://127.0.0.1:${PORTA}/montar/#/`);
    await pagina.waitForSelector('#tela-inicio:not([hidden]) .cartao');
    conferir(await pagina.$('#voltar-ao-painel') !== null, 'dentro do painel o link de volta continua');
    const comNovo = await pagina.$$eval('#lista-modelos .cartao h3', (n) => n.map((x) => x.textContent));
    conferir(comNovo.includes('Modelo de teste'), '"Salvar este formato como modelo" cria o modelo');

    await pagina.click('#lista-modelos .cartao--fixo a');
    await pagina.waitForSelector('#tela-modelo:not([hidden]) #mo-paginas .folha');
    conferir((await pagina.inputValue('#mo-nome')).includes('variação'), 'variação do fixo abre como modelo novo');
    await pagina.fill('#mo-nome', 'Simulado');
    await pagina.selectOption('#mo-formato [data-l="alternativas"]', '4');
    await pagina.waitForTimeout(400);
    conferir(await pagina.$$eval('#mo-paginas .q-alt', (n) => n.length) > 0, 'a prévia do modelo mostra questões de exemplo');
    await pagina.click('#mo-salvar');
    await pagina.waitForSelector('#tela-inicio:not([hidden])');
    const fim = await pagina.$$eval('#lista-modelos .cartao h3', (n) => n.map((x) => x.textContent));
    conferir(fim.includes('Simulado') && fim[0] === 'Avaliação Bimestral Malu', 'o modelo novo entra e o fixo continua igual');

    /* --- sem internet --- */
    await pagina.goto(`http://127.0.0.1:${PORTA}/montar/`);
    await pagina.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 15000 })
        .catch(async () => { await pagina.reload(); await pagina.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 15000 }); });
    await contexto.setOffline(true);
    await pagina.reload();
    await pagina.waitForSelector('#tela-inicio:not([hidden]) .prova-linha', { timeout: 15000 });
    conferir(await pagina.isVisible('#selo-offline'), 'sem internet o app abre, com as provas guardadas');
    await pagina.click('#lista-provas .prova-linha a');
    await pagina.waitForSelector('#tela-editor:not([hidden]) .folha');
    conferir(true, 'sem internet a prova abre e a prévia é montada');
    await contexto.setOffline(false);

    /* --- endereço próprio: a pasta montar é a raiz (montador-provas-malu.vercel.app) --- */
    const proprio = await servir(APP, PORTA + 1);
    try {
        await pagina.goto(`http://127.0.0.1:${PORTA + 1}/`);
        await pagina.waitForSelector('#tela-inicio:not([hidden]) .cartao');
        conferir(!(await pagina.$('#voltar-ao-painel')), 'no endereço próprio o link de volta ao painel some');
        conferir(!(await pagina.$('a[href="../provas/"]')), 'no endereço próprio o link do Identificador vira texto, sem levar a página que não existe');
        await pagina.click('[data-usar="bimestral-malu"]');
        await pagina.waitForSelector('#tela-editor:not([hidden]) .folha .faixa-brasao');
        conferir(await pagina.$eval('.folha .faixa-brasao', (i) => i.naturalWidth > 0), 'no endereço próprio o brasão carrega');
    } finally {
        proprio.close();
    }
    await pagina.goto(`http://127.0.0.1:${PORTA}/montar/#/`);
    await pagina.waitForSelector('#tela-inicio:not([hidden]) .cartao');

    /* --- celular --- */
    await pagina.setViewportSize({ width: 390, height: 844 });
    const larguraPagina = await pagina.evaluate(() => document.documentElement.scrollWidth);
    conferir(larguraPagina <= 391, 'no celular o início não rola de lado (' + larguraPagina + ')');

    conferir(erros.length === 0, 'nenhum erro no console: ' + erros.join(' | '));
    console.log(feitos.map((f) => '✓ ' + f).join('\n'));
    console.log('\n' + feitos.length + ' verificações passaram.');
} catch (erro) {
    console.log(feitos.map((f) => '✓ ' + f).join('\n'));
    console.error('\n' + erro.message);
    if (erros.length) console.error('Erros da página: ' + erros.join('\n'));
    await pagina.screenshot({ path: join(SAIDA, 'falha.png') }).catch(() => {});
    process.exitCode = 1;
} finally {
    await navegador.close();
    servidor.close();
}
