/* Regressão de ponta a ponta do app de provas, com Chromium de verdade.
   Uso:  node test/provas-browser.mjs            (serve a pasta e roda tudo)
   Precisa do playwright instalado na máquina (global serve). Gera os arquivos
   em test/saida/ para inspeção. */
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';

/* O playwright costuma estar instalado global nesta máquina, e módulo ESM não
   olha o NODE_PATH; o require do CommonJS olha. */
const exigir = createRequire(import.meta.url);
function carregarPlaywright() {
    const tentativas = ['playwright', '/opt/node22/lib/node_modules/playwright', 'playwright-core'];
    for (const nome of tentativas) {
        try { return exigir(nome); } catch (erro) { /* tenta o próximo */ }
    }
    throw new Error('Instale o playwright para rodar este teste: npm i -g playwright');
}
const { chromium } = carregarPlaywright();

const APP = resolve(import.meta.dirname, '..');
const RAIZ = resolve(APP, '..');
const SAIDA = join(APP, 'test', 'saida');
const PORTA = 8731;

const TIPOS = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.png': 'image/png',
    '.pdf': 'application/pdf'
};

function servir() {
    const servidor = createServer(async (pedido, resposta) => {
        const caminho = decodeURIComponent(pedido.url.split('?')[0]);
        const arquivo = join(RAIZ, caminho === '/' ? 'provas/index.html' : caminho);
        if (!arquivo.startsWith(RAIZ) || !existsSync(arquivo)) {
            resposta.writeHead(404).end('nao encontrado');
            return;
        }
        resposta.writeHead(200, { 'Content-Type': TIPOS[extname(arquivo)] || 'application/octet-stream' });
        resposta.end(await readFile(arquivo));
    });
    return new Promise((ok) => servidor.listen(PORTA, () => ok(servidor)));
}

const feitos = [];
function conferir(certo, mensagem) {
    if (!certo) throw new Error('FALHOU: ' + mensagem);
    feitos.push(mensagem);
}

const LOTE = `TURMA 1A
01 - Ana Beatriz Lima de Souza
02 - Bruno Dias
03 - José Ítalo Gonçalves da Conceição
TURMA 1B
01 - Carla Mendes
02 - Daniel Souza
TURMA 3A
1;Rafaela Gomes Nunes;3A
2;Pedro Henrique Alves;3A`;

const servidor = await servir();
const navegador = await chromium.launch();
const pagina = await navegador.newPage({ viewport: { width: 1280, height: 1000 } });

const erros = [];
pagina.on('pageerror', (erro) => erros.push(String(erro)));
const RUIDO = /fonts\.googleapis|ERR_CERT_AUTHORITY_INVALID/;
pagina.on('console', (msg) => { if (msg.type() === 'error' && !RUIDO.test(msg.text())) erros.push(msg.text()); });
pagina.on('requestfailed', (p) => { if (!RUIDO.test(p.url())) erros.push('pedido falhou: ' + p.url()); });

try {
    await mkdir(SAIDA, { recursive: true });
    await pagina.goto(`http://127.0.0.1:${PORTA}/provas/index.html`);

    /* --- passo 2: a lista --- */
    await pagina.fill('#lote', LOTE);
    await pagina.waitForFunction(() => document.querySelectorAll('.turma-chip').length === 3);
    const chips = await pagina.$$eval('.turma-chip', (nos) => nos.map((n) => n.textContent.trim()));
    conferir(chips.some((c) => c.startsWith('1A') && c.includes('3 alunos')), 'a turma 1A entra com 3 alunos');
    conferir(chips.some((c) => c.startsWith('3A') && c.includes('3ª SÉRIE')), 'a turma 3A é reconhecida como 3ª série');
    conferir((await pagina.textContent('#contagem-lote')).includes('7 alunos'), 'conta os 7 alunos colados');

    /* --- passo 3: os arquivos --- */
    const slots = await pagina.$$('.slot-serie');
    conferir(slots.length === 2, 'aparecem os espaços das duas séries presentes');

    const prova = join(APP, 'test', 'prova-exemplo.pdf');
    await pagina.setInputFiles('.slot-serie >> nth=0 >> .slot >> nth=1 >> input[type=file]', prova);
    await pagina.waitForSelector('.slot.cheio');
    conferir(await pagina.isVisible('#previa-canvas'), 'a prévia da página aparece na tela');
    await pagina.waitForFunction(() => document.getElementById('previa-canvas').width >= 400, null, { timeout: 20000 })
        .catch(() => { throw new Error('a prévia não desenhou: ' + document.title); });
    const medidas = await pagina.evaluate(() => {
        const c = document.getElementById('previa-canvas');
        return { largura: c.width, altura: c.height, recado: document.getElementById('previa-vazia').textContent };
    });
    conferir(medidas.largura > 380 && medidas.altura > medidas.largura,
        'a prévia sai em pé e no tamanho certo (' + medidas.largura + '×' + medidas.altura + ' ' + medidas.recado + ')');

    /* --- passo 4: clicar para posicionar o nome --- */
    const telaPrevia = await pagina.$('#previa-canvas');
    await telaPrevia.scrollIntoViewIfNeeded();
    const caixa = await telaPrevia.boundingBox();
    /* Clicar pelo elemento (e não pelo mouse em coordenada de viewport) garante
       que o playwright role a página até a prévia antes de clicar. */
    await telaPrevia.click({ position: { x: caixa.width * 0.3, y: caixa.height * 0.1 } });
    const x = parseFloat(await pagina.inputValue('#linha-x'));
    const y = parseFloat(await pagina.inputValue('#linha-y'));
    /* 30% de 21 cm = 6,3 cm; 10% de 29,7 cm = 2,97 cm. */
    conferir(Math.abs(x - 6.3) < 0.3, 'o clique vira centímetros na horizontal: ' + x + ' cm para 30% da folha');
    conferir(Math.abs(y - 2.97) < 0.3, 'o clique vira centímetros na vertical: ' + y + ' cm para 10% da folha');
    conferir(await pagina.isVisible('#marca-linha'), 'a marca do nome aparece sobre a prévia');

    /* --- passo 5: gerar --- */
    await pagina.click('#gerar');
    await pagina.waitForFunction(() => document.getElementById('estado-geracao').textContent.startsWith('pronto'), null, { timeout: 60000 });
    const cartoes = await pagina.$$eval('.resultado', (nos) => nos.map((n) => n.querySelector('.resultado-titulo').textContent));
    conferir(cartoes.length === 2, 'gera um conjunto por turma da série da prova enviada');
    conferir(cartoes[0].includes('1A') && cartoes[1].includes('1B'), 'os conjuntos saem para 1A e 1B');

    /* --- os arquivos, baixados e abertos --- */
    const download = await Promise.all([
        pagina.waitForEvent('download'),
        pagina.click('.resultado >> nth=0 >> button >> nth=0')
    ]);
    const caminhoPdf = join(SAIDA, 'PROVA-1A.pdf');
    await download[0].saveAs(caminhoPdf);
    const tamanho = (await readFile(caminhoPdf)).length;
    conferir(tamanho > 5000, 'o PDF das primeiras páginas baixa com conteúdo (' + tamanho + ' bytes)');

    const csv = await Promise.all([
        pagina.waitForEvent('download'),
        pagina.click('.resultado >> nth=0 >> button >> nth=2')
    ]);
    const caminhoCsv = join(SAIDA, 'CONFERENCIA-1A.csv');
    await csv[0].saveAs(caminhoCsv);
    const textoCsv = await readFile(caminhoCsv, 'utf8');
    conferir(textoCsv.includes('ANA BEATRIZ LIMA DE SOUZA') && textoCsv.split('\r\n').length === 4,
        'o CSV de conferência traz o cabeçalho e os três alunos da 1A');
    conferir(/MLS-2026-B3-1A-001-LIN-[0-9A-Z]{4}/.test(textoCsv), 'o código sai no formato combinado');

    /* --- aba de conferência --- */
    const codigo = textoCsv.split('\r\n')[1].split(';').pop();
    await pagina.click('.aba[data-aba="conferir"]');
    await pagina.fill('#conferir-entrada', codigo);
    await pagina.fill('#conferir-nome', 'Ana Beatriz Lima de Souza');
    await pagina.click('#conferir');
    conferir(await pagina.isVisible('.conferencia-cartao.valida'), 'o código gerado é reconhecido como autêntico');

    await pagina.fill('#conferir-nome', 'Bruno Dias');
    await pagina.click('#conferir');
    conferir(await pagina.isVisible('.conferencia-cartao.invalida'), 'o mesmo código com outro nome é recusado');

    conferir(erros.length === 0, 'nenhum erro de JavaScript no caminho todo' + (erros.length ? ': ' + erros.join(' | ') : ''));

    console.log('\n' + feitos.length + ' verificações passaram:');
    feitos.forEach((f) => console.log('  ok  ' + f));
} catch (erro) {
    console.error('\n' + erro.message);
    if (erros.length) console.error('erros do navegador:\n  ' + erros.join('\n  '));
    await pagina.screenshot({ path: join(SAIDA, 'falha.png'), fullPage: true }).catch(() => {});
    process.exitCode = 1;
} finally {
    await navegador.close();
    servidor.close();
}
