/* Regressão de ponta a ponta do app de provas, com Chromium de verdade.
   Testa os dois modos de publicação: dentro do painel, em /provas/, e como
   site próprio, com a pasta do app na raiz do domínio.
   Uso:  node test/provas-browser.mjs            (serve a pasta e roda tudo)
   Precisa do playwright instalado na máquina (global serve). Gera os arquivos
   em test/saida/ para inspeção. */
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
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

function servir(raiz, porta, inicial) {
    const servidor = createServer(async (pedido, resposta) => {
        const caminho = decodeURIComponent(pedido.url.split('?')[0]);
        let arquivo = join(raiz, caminho === '/' ? inicial : caminho);
        /* Endereço de pasta cai no index.html dela, como a Vercel faz. Assim o
           teste abre /provas/ e prova que os caminhos relativos do app
           (vendor/, js/, ../logo.png) resolvem do mesmo jeito que em produção. */
        if (existsSync(arquivo) && statSync(arquivo).isDirectory()) {
            arquivo = join(arquivo, 'index.html');
        }
        if (!arquivo.startsWith(raiz) || !existsSync(arquivo)) {
            resposta.writeHead(404).end('nao encontrado');
            return;
        }
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

const servidor = await servir(RAIZ, PORTA, 'provas/index.html');
const navegador = await chromium.launch();
const pagina = await navegador.newPage({ viewport: { width: 1280, height: 1000 } });
/* O app só abre para a gestão: aqui entra um Supabase de mentira, já logado. */
const CLIENTE_FALSO = join(APP, 'test', 'cliente-falso.js');
await pagina.addInitScript(() => { window.ACESSO_SESSAO_INICIAL = 'gestao'; });
await pagina.addInitScript({ path: CLIENTE_FALSO });

const erros = [];
pagina.on('pageerror', (erro) => erros.push(String(erro)));
const RUIDO = /fonts\.googleapis|ERR_CERT_AUTHORITY_INVALID/;
pagina.on('console', (msg) => { if (msg.type() === 'error' && !RUIDO.test(msg.text())) erros.push(msg.text()); });
pagina.on('requestfailed', (p) => { if (!RUIDO.test(p.url())) erros.push('pedido falhou: ' + p.url()); });

try {
    await mkdir(SAIDA, { recursive: true });
    /* --- acesso: sem conta não entra; professor não entra; gestão entra --- */
    const porta = await navegador.newPage();
    await porta.addInitScript({ path: CLIENTE_FALSO });
    await porta.goto(`http://127.0.0.1:${PORTA}/provas/`);
    await porta.waitForSelector('#acesso-form', { state: 'visible' });
    conferir(!(await porta.isVisible('.wrap')), 'sem login, o app fica escondido atrás da tela de acesso');
    await porta.fill('#acesso-email', 'prof@teste.local');
    await porta.fill('#acesso-senha', 'senha-prof');
    await porta.click('#acesso-entrar');
    await porta.waitForSelector('#acesso-erro', { state: 'visible' });
    conferir((await porta.textContent('#acesso-erro')).includes('só da gestão') && !(await porta.isVisible('.wrap')),
        'conta de professor não entra no Identificador');
    await porta.fill('#acesso-email', 'gestao@teste.local');
    await porta.fill('#acesso-senha', 'errada');
    await porta.click('#acesso-entrar');
    await porta.waitForFunction(() => document.getElementById('acesso-erro').textContent.includes('incorretos'));
    conferir(!(await porta.isVisible('.wrap')), 'senha errada não entra');
    await porta.fill('#acesso-senha', 'senha-gestao');
    await porta.click('#acesso-entrar');
    await porta.waitForSelector('.wrap', { state: 'visible' });
    conferir((await porta.textContent('#conta-nome')).includes('Gestão Teste'), 'a gestão entra e vê o nome da conta');
    await porta.click('#conta-sair');
    await porta.waitForSelector('#acesso-form', { state: 'visible' });
    conferir(!(await porta.isVisible('.wrap')), 'ao sair, o app volta a ficar trancado');
    await porta.close();

    await pagina.goto(`http://127.0.0.1:${PORTA}/provas/`);
    await pagina.waitForSelector('.wrap', { state: 'visible' });

    conferir(await pagina.isVisible('#voltar-ao-painel'),
        'servido em /provas/, o link de volta ao painel aparece');

    /* --- passo 2: a lista --- */
    await pagina.fill('#lote', LOTE);
    await pagina.waitForFunction(() => document.querySelectorAll('.turma-chip').length === 3);
    const chips = await pagina.$$eval('.turma-chip', (nos) => nos.map((n) => n.textContent.trim()));
    conferir(chips.some((c) => c.startsWith('1A') && c.includes('3 alunos')), 'a turma 1A entra com 3 alunos');
    conferir(chips.some((c) => c.startsWith('3A') && c.includes('3ª SÉRIE')), 'a turma 3A é reconhecida como 3ª série');
    conferir((await pagina.textContent('#contagem-lote')).includes('7 alunos'), 'conta os 7 alunos colados');

    /* --- passo 3: os arquivos --- */
    const slots = await pagina.$$('#slots .slot-serie');
    conferir(slots.length === 2, 'aparecem os espaços das duas séries presentes');

    /* A prova de exemplo, com o título que o Montador grava ao imprimir uma
       prova da área: o nome do arquivo mais a chave da prova (-K + 8 caracteres). */
    const PDFLib = exigir('../vendor/pdf-lib.min.js');
    const prova = join(SAIDA, 'prova-com-chave.pdf');
    {
        const doc = await PDFLib.PDFDocument.load(await readFile(join(APP, 'test', 'prova-exemplo.pdf')));
        doc.setTitle('PROVA-2026-B3-1S-LIN-K8F3A2C1D');
        await writeFile(prova, await doc.save());
    }
    const gabaritoQuarto = join(APP, 'test', 'gabarito-exemplo.pdf');
    await pagina.setInputFiles('#slots .slot-serie >> nth=0 >> .slot >> nth=1 >> input[type=file]', prova);
    await pagina.waitForSelector('.slot.cheio');
    await pagina.waitForFunction(() => /prova 8F3A2C1D/.test(document.querySelector('.slot.cheio .slot-estado').textContent), null, { timeout: 10000 });
    conferir(!(await pagina.textContent('.slot.cheio .slot-estado')).includes('⚠'),
        'o espaço mostra a chave da prova lida do título do PDF, sem aviso quando o arquivo está no lugar certo');
    /* o mesmo arquivo no espaço de outro componente: aviso, e depois o espaço é esvaziado */
    const espacoNat = '#slots .slot-serie >> nth=0 >> .slot:has(label:text-is("Ciências da Natureza")) >> input[type=file]';
    await pagina.setInputFiles(espacoNat, prova);
    await pagina.waitForFunction(() => /⚠/.test(document.querySelector('.slot:has(label)')?.parentElement?.textContent || ''), null, { timeout: 10000 });
    const avisoEspaco = await pagina.$eval('#slots .slot-serie >> nth=0', (n) => Array.from(n.querySelectorAll('.slot-estado')).map((x) => x.textContent).join(' || '));
    conferir(/o arquivo é de Linguagens e Códigos, mas está no espaço de Ciências da Natureza/.test(avisoEspaco),
        'PDF de Linguagens solto no espaço de Ciências da Natureza gera aviso: ' + avisoEspaco);
    await pagina.setInputFiles(espacoNat, []);
    await pagina.waitForFunction(() => !/Ciências da Natureza/.test(Array.from(document.querySelectorAll('.slot.cheio')).map((n) => n.textContent).join('')), null, { timeout: 10000 });
    conferir(true, 'e o espaço errado é esvaziado de novo');
    conferir(await pagina.isVisible('#previa-canvas'), 'a prévia da página aparece na tela');
    await pagina.waitForFunction(() => document.getElementById('previa-canvas').width >= 400, null, { timeout: 20000 })
        .catch(() => { throw new Error('a prévia não desenhou: ' + document.title); });
    const medidas = await pagina.evaluate(() => {
        const c = document.getElementById('previa-canvas');
        return { largura: c.width, altura: c.height, recado: document.getElementById('previa-vazia').textContent };
    });
    conferir(medidas.largura > 380 && medidas.altura > medidas.largura,
        'a prévia sai em pé e no tamanho certo (' + medidas.largura + '×' + medidas.altura + ' ' + medidas.recado + ')');

    /* --- passo 4: clicar para posicionar o cabeçalho --- */
    const telaPrevia = await pagina.$('#previa-canvas');
    await telaPrevia.scrollIntoViewIfNeeded();
    const caixa = await telaPrevia.boundingBox();
    /* Clicar pelo elemento (e não pelo mouse em coordenada de viewport) garante
       que o playwright role a página até a prévia antes de clicar. */
    await telaPrevia.click({ position: { x: caixa.width * 0.3, y: caixa.height * 0.1 } });
    const x = parseFloat(await pagina.inputValue('#cab-x'));
    const y = parseFloat(await pagina.inputValue('#cab-y'));
    /* 30% de 21 cm = 6,3 cm; 10% de 29,7 cm = 2,97 cm. */
    conferir(Math.abs(x - 6.3) < 0.3, 'o clique vira centímetros na horizontal: ' + x + ' cm para 30% da folha');
    conferir(Math.abs(y - 2.97) < 0.3, 'o clique vira centímetros na vertical: ' + y + ' cm para 10% da folha');
    conferir(await pagina.isVisible('#marca-cabecalho'), 'o retângulo do cabeçalho aparece sobre a prévia');

    /* Volta o cabeçalho para a faixa em branco do alto da prova. */
    await pagina.fill('#cab-x', '1');
    await pagina.fill('#cab-y', '0.6');

    /* O modelo que abre espaço mostra a faixa e trava a posição. */
    await pagina.check('input[name="modelo"][value="abrir-espaco"]');
    await pagina.waitForSelector('#previa-faixa', { state: 'visible' });
    conferir(true, 'o modelo que abre espaço mostra a faixa na prévia');
    conferir(await pagina.isDisabled('#cab-x'), 'e a posição deixa de ser escolhida na prova');

    await pagina.check('input[name="modelo"][value="espaco-deixado"]');
    await pagina.waitForSelector('#previa-faixa', { state: 'hidden' });
    conferir(true, 'voltando ao espaço em branco, a faixa desaparece e a prova não é reduzida');

    /* --- passo 5: gerar --- */
    await pagina.click('#gerar');
    await pagina.waitForFunction(() => document.getElementById('estado-geracao').textContent.startsWith('pronto'), null, { timeout: 60000 });
    const cartoes = await pagina.$$eval('#resultados .resultado', (nos) => nos.map((n) => n.querySelector('.resultado-titulo').textContent));
    /* A faixa de códigos de cada turma, para conferir depois que o gabarito
       daquela turma recebe exatamente os mesmos códigos da prova. */
    const codigosDaProva = await pagina.$$eval('#resultados .resultado small', (nos) => nos.map((n) => n.textContent));
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

    /* O QR do PDF gerado, lido como o Malu Gabaritos lê (jsQR, página em escala 3),
       leva a chave da prova que veio no título do PDF. */
    await pagina.addScriptTag({ path: join(RAIZ, 'provas', 'vendor', 'pdf.min.js') });
    await pagina.addScriptTag({ path: join(RAIZ, 'gabaritos', 'vendor', 'jsQR.js') });
    const qrDoPdf = await pagina.evaluate(async (b64) => {
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/provas/vendor/pdf.worker.min.js';
        const pdf = await pdfjsLib.getDocument({ data: Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)) }).promise;
        const pg = await pdf.getPage(1);
        const vp = pg.getViewport({ scale: 3 });
        const c = document.createElement('canvas');
        c.width = vp.width; c.height = vp.height;
        await pg.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
        const img = c.getContext('2d').getImageData(0, 0, c.width, c.height);
        const r = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
        return r ? { texto: r.data, lido: ProvasQrProva.ler(r.data), comprimento: r.data.length } : null;
    }, (await readFile(caminhoPdf)).toString('base64'));
    conferir(qrDoPdf && qrDoPdf.lido, 'o QR impresso na primeira página do PDF gerado é lido pelo jsQR');
    conferir(qrDoPdf.lido.chave === '8F3A2C1D' && qrDoPdf.lido.turma === '1A' && qrDoPdf.lido.numero === '001',
        'e leva a chave da prova (' + qrDoPdf.lido.chave + ') junto com a turma e o número: ' + qrDoPdf.texto);
    conferir(qrDoPdf.comprimento <= 106, 'sem passar de 106 caracteres (' + qrDoPdf.comprimento + ')');

    const csv = await Promise.all([
        pagina.waitForEvent('download'),
        pagina.click('.resultado >> nth=0 >> button >> nth=3')
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

    /* --- aba opcional de gabaritos --- */
    await pagina.click('.aba[data-aba="gabaritos"]');
    conferir(await pagina.isVisible('#painel-gabaritos'), 'a aba de gabaritos abre');

    /* O envio não pode depender da lista de alunos: a folha de respostas é
       arquivo separado e pode ser carregada antes de qualquer coisa. */
    conferir(await pagina.isVisible('#gab-arquivo'), 'o campo de carregar o gabarito fica sempre à vista');
    conferir((await pagina.$$eval('#gab-serie option', (nos) => nos.length)) === 3,
        'as três séries são oferecidas na hora de carregar');

    await pagina.selectOption('#gab-serie', '1');
    await pagina.selectOption('#gab-componente', 'LIN');
    await pagina.setInputFiles('#gab-arquivo', gabaritoQuarto);
    await pagina.waitForSelector('.gabarito-carregado');
    const carregado = await pagina.textContent('.gabarito-carregado .qual');
    conferir(carregado.includes('1ª SÉRIE') && carregado.includes('Linguagens'),
        'o gabarito carregado aparece com a série e o componente');

    /* As medidas se ajustam sozinhas ao tamanho real da folha enviada. */
    await pagina.waitForFunction(() => document.getElementById('previa-gabarito-canvas').width >= 200, null, { timeout: 20000 });
    const largura = parseFloat(await pagina.inputValue('#gab-largura'));
    conferir(largura > 9 && largura < 10,
        'as medidas do cabeçalho se ajustam ao quarto de A4: ' + largura + ' cm de largura');

    /* O mesmo arquivo serve aos cinco componentes da série. */
    await pagina.click('.gabarito-carregado >> nth=0 >> button:has-text("Usar nos outros")');
    await pagina.waitForFunction(() => document.querySelectorAll('.gabarito-carregado').length === 5);
    conferir(true, 'o botão repete o gabarito nos cinco componentes da série');

    /* Volta a um componente só, para o teste não gerar dez conjuntos. */
    for (const componente of ['Redação', 'Ciências da Natureza', 'Ciências Humanas', 'Matemática']) {
        await pagina.click(`.gabarito-carregado:has-text("${componente}") >> button:has-text("Remover")`);
    }
    await pagina.waitForFunction(() => document.querySelectorAll('.gabarito-carregado').length === 1);

    conferir(await pagina.isChecked('#gab-quatro'), 'quatro por folha A4 vem marcado, que é o formato do gabarito');

    await pagina.click('#gerar-gabaritos');
    await pagina.waitForFunction(() => document.getElementById('estado-gabaritos').textContent.startsWith('pronto'), null, { timeout: 60000 });
    const cartoesGabarito = await pagina.$$eval('#resultados-gabaritos .resultado', (nos) => nos.map((n) => n.querySelector('.resultado-titulo').textContent));
    conferir(cartoesGabarito.length === 2, 'sai um conjunto de gabaritos por turma da série');
    conferir(cartoesGabarito.every((c) => c.startsWith('Gabarito ·')), 'os conjuntos vêm marcados como gabarito');

    const rotulos = await pagina.$$eval('#resultados-gabaritos .resultado >> nth=0 >> button', (nos) => nos.map((n) => n.textContent));
    conferir(rotulos[0].includes('quatro por folha A4') && !rotulos[0].includes('reduzido'),
        'o arquivo sai em quatro por folha, sem redução: ' + rotulos[0]);

    const codigosDoGabarito = await pagina.$$eval('#resultados-gabaritos .resultado small', (nos) => nos.map((n) => n.textContent));
    conferir(codigosDoGabarito.length === codigosDaProva.length && codigosDoGabarito.every((c, i) => c === codigosDaProva[i]),
        'o gabarito de cada turma leva os mesmos códigos da prova: ' + (codigosDoGabarito[0] || ''));

    const gabarito = await Promise.all([
        pagina.waitForEvent('download'),
        pagina.click('#resultados-gabaritos .resultado >> nth=0 >> button >> nth=0')
    ]);
    const caminhoGabarito = join(SAIDA, 'GABARITO-1A.pdf');
    await gabarito[0].saveAs(caminhoGabarito);
    conferir(gabarito[0].suggestedFilename().startsWith('GABARITO-'), 'o arquivo baixa com nome de gabarito: ' + gabarito[0].suggestedFilename());
    conferir((await readFile(caminhoGabarito)).length > 5000, 'e com conteúdo');

    await pagina.click('.aba[data-aba="gerar"]');

    /* --- importar do Montador: as provas travadas, as turmas escolhidas e os PDFs pela chave --- */
    const importa = await navegador.newPage({ viewport: { width: 1280, height: 1000 } });
    const errosImporta = [];
    importa.on('pageerror', (e) => errosImporta.push(String(e)));
    await importa.addInitScript(() => { window.ACESSO_SESSAO_INICIAL = 'gestao'; });
    await importa.addInitScript({ path: CLIENTE_FALSO });
    await importa.goto(`http://127.0.0.1:${PORTA}/provas/`);
    await importa.waitForSelector('.wrap', { state: 'visible' });

    await importa.click('#buscar-provas-montador');
    await importa.waitForSelector('.grupo-montador');
    const gruposMontador = await importa.$$eval('.grupo-montador h4', (n) => n.map((x) => x.textContent));
    conferir(gruposMontador.join(' | ') === '3º bimestre de 2026 | 2º bimestre de 2026',
        'as provas travadas do Montador vêm agrupadas por bimestre, a mais nova primeiro: ' + gruposMontador.join(' | '));
    const contagemMontador = await importa.textContent('#contagem-montador');
    conferir(contagemMontador.includes('4 prova(s) travada(s)') && contagemMontador.includes('1 de formato livre'),
        'a prova ainda aberta não vem e a de formato livre fica de fora: ' + contagemMontador);
    conferir((await importa.$$eval('.grupo-montador:nth-of-type(1) input[type=checkbox]', (n) => n.map((x) => x.checked))).join() === 'true,true,true' &&
        (await importa.$$eval('.grupo-montador:nth-of-type(2) input[type=checkbox]', (n) => n.map((x) => x.checked))).join() === 'false',
        'as provas do bimestre mais novo já vêm marcadas');

    /* marcar o bimestre velho junto com o novo não vale */
    await importa.check('.grupo-montador:nth-of-type(2) input[type=checkbox]');
    await importa.click('#provas-montador .btn--primary');
    conferir((await importa.textContent('#aviso-montador')).includes('bimestre só'), 'provas de bimestres diferentes não passam: ' + await importa.textContent('#aviso-montador'));
    await importa.uncheck('.grupo-montador:nth-of-type(2) input[type=checkbox]');

    await importa.click('#provas-montador .btn--primary');
    await importa.waitForSelector('.prova-importada');
    conferir(await importa.inputValue('#ano') === '2026' && await importa.inputValue('#bimestre') === 'B3',
        'o ano e o bimestre do passo 1 vêm das provas importadas');
    conferir(await importa.inputValue('#avaliacao') === 'Avaliação Bimestral de Linguagens e Códigos',
        'o nome da avaliação, vazio, é preenchido com o da prova');
    conferir(await importa.isVisible('#soltar-montador') && (await importa.$$('.prova-importada')).length === 3 &&
        (await importa.$$('.prova-importada.falta')).length === 3, 'aparecem as três provas importadas, todas esperando o PDF');

    /* as turmas: só as escolhidas, juntando às que já estão na lista */
    conferir((await importa.$$('#turmas-escolha .turma-escolha')).length === 12, 'as turmas para escolher são A a F das duas séries das provas (12)');
    conferir(await importa.isDisabled('#puxar-turmas-escolhidas'), 'sem turma marcada, o botão de puxar fica desligado');
    await importa.click('#turmas-escolha .turma-escolha:text-is("1A")');
    await importa.click('#turmas-escolha .turma-escolha:text-is("2A")');
    await importa.click('#puxar-turmas-escolhidas');
    await importa.waitForFunction(() => document.querySelectorAll('#resumo-turmas .turma-chip').length === 2);
    const pedidos1 = await importa.evaluate(() => window.PEDIDOS_AO_PRESENTE.map((p) => p.turma));
    conferir(pedidos1.join() === '1ºA,2ºA', 'só as turmas escolhidas foram pedidas ao Malu Presente: ' + pedidos1.join());
    conferir((await importa.textContent('#aviso-presente')).includes('Puxei 1A, 2A'), 'o aviso diz quais turmas vieram');
    await importa.fill('#lote', (await importa.inputValue('#lote')).replace('Bruno Dias', 'Bruno Dias Editado'));
    await importa.waitForTimeout(400);
    await importa.click('#turmas-escolha .turma-escolha:text-is("1A")');
    await importa.click('#turmas-escolha .turma-escolha:text-is("2A")');
    await importa.click('#turmas-escolha .turma-escolha:text-is("1B")');
    await importa.click('#puxar-turmas-escolhidas');
    await importa.waitForFunction(() => document.querySelectorAll('#resumo-turmas .turma-chip').length === 3);
    const pedidos2 = await importa.evaluate(() => window.PEDIDOS_AO_PRESENTE.map((p) => p.turma));
    conferir(pedidos2.join() === '1ºA,2ºA,1ºB', 'a segunda puxada pediu só a 1B: ' + pedidos2.join());
    conferir((await importa.inputValue('#lote')).includes('Bruno Dias Editado'), 'puxar mais uma turma não apaga a edição feita nas que já estavam');
    conferir((await importa.$$eval('#resumo-turmas .turma-chip', (n) => n.map((x) => x.textContent.slice(0, 2)))).sort().join() === '1A,1B,2A',
        'a lista fica com as três turmas, 1A, 1B e 2A');

    /* os PDFs soltos de uma vez, com nomes que não dizem nada: vale a chave do título */
    async function pdfComTitulo(nomeArquivo, titulo) {
        const doc = await PDFLib.PDFDocument.load(await readFile(join(APP, 'test', 'prova-exemplo.pdf')));
        doc.setTitle(titulo);
        const caminho = join(SAIDA, nomeArquivo);
        await writeFile(caminho, await doc.save());
        return caminho;
    }
    const soltos = [
        await pdfComTitulo('montador-1.pdf', 'PROVA-2026-B3-1S-LIN-K8F3A2C1D'),
        await pdfComTitulo('montador-2.pdf', 'PROVA-2026-B3-1S-LIN-K8F3A2C1D-GABARITO'),
        await pdfComTitulo('montador-3.pdf', 'PROVA-2026-B3-1S-NAT-K11112222'),
        await pdfComTitulo('montador-4.pdf', 'PROVA-2026-B3-1S-LIN'),
        await pdfComTitulo('montador-5.pdf', 'PROVA-2026-B3-1S-LIN-GABARITO-PROFESSOR'),
        await pdfComTitulo('montador-6.pdf', 'PROVA-2026-B3-1S-HUM-KDEADBEEF'),
        await pdfComTitulo('montador-7.pdf', 'PROVA-2026-B3-1S-LIN-K8F3A2C1D-GABARITOS-4-POR-FOLHA')
    ];
    await importa.setInputFiles('#pdfs-montador', soltos);
    await importa.waitForFunction(() => {
        const li = document.querySelectorAll('#resultado-pdfs-montador li');
        return li.length === 7 && !Array.from(li).some((x) => /lendo…$/.test(x.textContent));
    }, null, { timeout: 30000 });
    const resultadosPdf = await importa.$$eval('#resultado-pdfs-montador li', (n) => n.map((x) => ({ erro: x.classList.contains('erro'), texto: x.textContent })));
    conferir(resultadosPdf.filter((r) => !r.erro).length === 3 && resultadosPdf.filter((r) => r.erro).length === 4,
        'três PDFs foram reconhecidos pela chave e quatro foram recusados: ' + resultadosPdf.map((r) => (r.erro ? '✗' : '✓')).join(''));
    conferir(resultadosPdf[0].texto.includes('Prova de Linguagens e Códigos · 1ª série · 3º bimestre de 2026 (chave 8F3A2C1D)') &&
        resultadosPdf[1].texto.includes('Gabarito de Linguagens e Códigos') && resultadosPdf[2].texto.includes('Prova de Ciências da Natureza'),
        'cada PDF diz de qual prova é: ' + resultadosPdf[0].texto);
    conferir(resultadosPdf[3].texto.includes('não tem a chave da prova') && resultadosPdf[4].texto.includes('folha do professor') &&
        resultadosPdf[5].texto.includes('chave DEADBEEF não é de nenhuma') && resultadosPdf[6].texto.includes('4 gabaritos por folha'),
        'sem chave, folha do professor, prova que não foi importada e 4 por folha são recusados com o motivo');
    const espacosCheios = await importa.$$eval('#slots .slot.cheio', (n) => n.map((x) => x.textContent));
    conferir(espacosCheios.length === 2 && espacosCheios.some((t) => t.includes('Linguagens') && t.includes('montador-1.pdf')) &&
        espacosCheios.some((t) => t.includes('Natureza') && t.includes('montador-3.pdf')),
        'os PDFs foram sozinhos para os espaços de Linguagens e de Ciências da Natureza da 1ª série');
    conferir((await importa.$$('.prova-importada.falta')).length === 1 && (await importa.textContent('#provas-importadas')).includes('prova: ✔ montador-1.pdf'),
        'a lista das importadas mostra o que chegou e o que falta (a 2ª série)');
    await importa.click('.aba[data-aba="gabaritos"]');
    conferir((await importa.$$('#slots-gabarito .gabarito-carregado')).length === 1, 'o gabarito avulso foi para a aba de gabaritos');
    await importa.click('.aba[data-aba="gerar"]');

    /* um PDF sem a chave solto à mão no espaço de uma prova importada gera aviso */
    await importa.setInputFiles('#slots .slot-serie >> nth=1 >> .slot:has(label:text-is("Linguagens e Códigos")) >> input[type=file]', soltos[3]);
    await importa.waitForFunction(() => /não tem a chave da prova importada/.test(document.getElementById('slots').textContent), null, { timeout: 10000 });
    conferir(true, 'PDF sem chave solto à mão no espaço de uma prova importada avisa que o QR sairá sem chave');
    await importa.setInputFiles('#slots .slot-serie >> nth=1 >> .slot:has(label:text-is("Linguagens e Códigos")) >> input[type=file]', []);

    /* gerar: o QR do PDF leva a chave da prova que o PDF trouxe, sem escolha de espaço */
    await importa.click('#gerar');
    await importa.waitForFunction(() => document.getElementById('estado-geracao').textContent.startsWith('pronto'), null, { timeout: 90000 });
    const baixado = await Promise.all([importa.waitForEvent('download'), importa.click('.resultado >> nth=0 >> button >> nth=0')]);
    const caminhoImportado = join(SAIDA, 'PROVA-importada.pdf');
    await baixado[0].saveAs(caminhoImportado);
    await importa.addScriptTag({ path: join(RAIZ, 'provas', 'vendor', 'pdf.min.js') });
    await importa.addScriptTag({ path: join(RAIZ, 'gabaritos', 'vendor', 'jsQR.js') });
    const qrImportado = await importa.evaluate(async (b64) => {
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/provas/vendor/pdf.worker.min.js';
        const pdf = await pdfjsLib.getDocument({ data: Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)) }).promise;
        const pg = await pdf.getPage(1);
        const vp = pg.getViewport({ scale: 3 });
        const c = document.createElement('canvas');
        c.width = vp.width; c.height = vp.height;
        await pg.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
        const img = c.getContext('2d').getImageData(0, 0, c.width, c.height);
        const r = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
        return r ? ProvasQrProva.ler(r.data) : null;
    }, (await readFile(caminhoImportado)).toString('base64'));
    conferir(qrImportado && ['8F3A2C1D', '11112222'].includes(qrImportado.chave) && /^1[AB]$/.test(qrImportado.turma),
        'o QR do PDF gerado a partir da importação leva a chave da prova (' + (qrImportado && qrImportado.chave) + ') e a turma ' + (qrImportado && qrImportado.turma));
    conferir(errosImporta.length === 0, 'nenhum erro de JavaScript na importação' + (errosImporta.length ? ': ' + errosImporta.join(' | ') : ''));
    await importa.close();

    /* --- o mesmo app servido como site próprio (Root Directory = provas) --- */
    const servidorProprio = await servir(APP, PORTA + 1, 'index.html');
    try {
        const sozinho = await navegador.newPage();
        await sozinho.addInitScript(() => { window.ACESSO_SESSAO_INICIAL = 'gestao'; });
        await sozinho.addInitScript({ path: CLIENTE_FALSO });
        const errosSozinho = [];
        sozinho.on('pageerror', (erro) => errosSozinho.push(String(erro)));
        sozinho.on('requestfailed', (p) => { if (!RUIDO.test(p.url())) errosSozinho.push('pedido falhou: ' + p.url()); });

        await sozinho.goto(`http://127.0.0.1:${PORTA + 1}/`);
        await sozinho.waitForSelector('.wrap', { state: 'visible' });
        conferir(await sozinho.$('#voltar-ao-painel') === null,
            'em domínio próprio o link de volta ao painel sai de cena');
        conferir(await sozinho.evaluate(() => {
            const logo = document.querySelector('.masthead img');
            return logo.complete && logo.naturalWidth > 0;
        }), 'o logo carrega da própria pasta do app');

        /* Prova que o app continua inteiro com a pasta na raiz. */
        await sozinho.fill('#lote', 'TURMA 2B\n01 - Ana Lima\n02 - Bruno Dias');
        await sozinho.waitForFunction(() => document.querySelectorAll('.turma-chip').length === 1);
        conferir((await sozinho.textContent('#contagem-lote')).includes('2 alunos'), 'e a leitura da lista funciona igual');
        conferir(errosSozinho.length === 0,
            'nenhum erro de JavaScript como site próprio' + (errosSozinho.length ? ': ' + errosSozinho.join(' | ') : ''));
        await sozinho.close();
    } finally {
        servidorProprio.close();
    }

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
