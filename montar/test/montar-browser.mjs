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
const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png' };

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
const pagina = await navegador.newPage({ viewport: { width: 1400, height: 1000 } });
const erros = [];
const RUIDO = /fonts\.googleapis|ERR_CERT_AUTHORITY_INVALID/;
pagina.on('pageerror', (erro) => erros.push(String(erro)));
pagina.on('console', (msg) => { if (msg.type() === 'error' && !RUIDO.test(msg.text())) erros.push(msg.text()); });
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

    await pagina.click('#ed-colar');
    await pagina.fill('#colar-texto', await readFile(join(APP, 'test', 'questoes-exemplo.txt'), 'utf8'));
    await pagina.waitForSelector('#colar-acrescentar:not([disabled])');
    conferir((await pagina.textContent('#colar-resultado')).includes('11 questões'), 'a colagem reconhece 11 questões');
    await pagina.click('#colar-acrescentar');
    await pagina.waitForFunction(() => document.querySelectorAll('#secoes .questao').length === 11);
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
    conferir(Math.abs(info.faixaTopoCm - 1) < 0.05 && Math.abs(info.faixaAlturaCm - 3) < 0.05 && Math.abs(info.faixaLarguraCm - 19) < 0.05,
        'a faixa do Identificador fica a 1 cm do alto, com 19 × 3 cm (' + info.faixaTopoCm.toFixed(2) + ', ' + info.faixaLarguraCm.toFixed(2) + ' × ' + info.faixaAlturaCm.toFixed(2) + ')');
    conferir(info.gabarito, 'o gabarito abre a primeira coluna');
    conferir(info.instrucoes, 'a última instrução sai em negrito');
    conferir(!info.transbordou, 'nenhuma coluna transborda');
    conferir(info.secao === 'BIOLOGIA', 'o título da seção sai na folha');

    const svg = await pagina.$eval('#paginas .gabarito-svg', (s) => ({ bolhas: s.querySelectorAll('circle').length, texto: s.textContent }));
    conferir(svg.bolhas === 20 + 11 * 5, 'o gabarito tem as bolhas do número da lista e das 11 questões');
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
    conferir(chave.length === 11 && chave[0].startsWith('01D'), 'o gabarito do professor lista as respostas (' + chave[0] + ')');
    await pagina.emulateMedia({ media: 'screen' });
    await pagina.evaluate(() => window.dispatchEvent(new Event('afterprint')));

    /* edição: questão nova, discursiva, guardada */
    await pagina.click('.secao[data-s] >> nth=1 >> [data-acao="add-discursiva"]');
    await pagina.fill('.questao[open] textarea[data-campo="enunciado"]', 'Explique a **importância** do CO~2~ na fotossíntese.');
    await pagina.waitForTimeout(900);
    const html = await pagina.$eval('#paginas', (p) => p.innerHTML);
    conferir(html.includes('<strong>importância</strong>') && html.includes('CO<sub>2</sub>'), 'a marcação vira negrito e índice na folha');
    conferir(html.includes('q-linha'), 'a discursiva ganha as linhas de resposta');
    conferir((await pagina.textContent('#ed-status')).includes('Salvo'), 'a prova se salva sozinha');

    await pagina.screenshot({ path: join(SAIDA, 'editor.png') });

    /* recarrega e a prova continua lá */
    await pagina.reload();
    await pagina.waitForSelector('#tela-editor:not([hidden]) .folha');
    conferir(await pagina.$$eval('#secoes .questao', (n) => n.length) === 12, 'depois de recarregar, as 12 questões continuam');

    /* --- do zero: formato livre --- */
    await pagina.goto(`http://127.0.0.1:${PORTA}/montar/#/`);
    await pagina.waitForSelector('#tela-inicio:not([hidden]) .prova-linha');
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
    await pagina.goto(`http://127.0.0.1:${PORTA}/montar/#/`);
    await pagina.waitForSelector('#tela-inicio:not([hidden]) .cartao');
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
