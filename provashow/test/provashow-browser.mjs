/* Regressão de ponta a ponta do ProvaShow Malu, com Chromium de verdade.
   App do professor, telão, scanner e modo aluno abrem no mesmo navegador e
   conversam pelo canal local (a internet do Supabase fica bloqueada no
   teste). A câmera é uma câmera falsa do Chromium que mostra uma foto
   sintética da turma levantando os cartões.

   Confere: site e ajuda; biblioteca (pastas, colar com prévia, editor com
   formatação, equação e várias certas, prévia, lixeira, busca, Explorar,
   pacotes); turma (colar alunos, trocar cartão, arquivar, links); aula ao
   vivo no computador (telão, scanner lendo pela câmera, aluno pelo
   aparelho, cronômetro, gráfico e resposta comandados pelo celular,
   resposta à mão, travar, próxima pergunta); relatórios (placar, fora da
   nota, CSV, relatório do aluno, relatório da aula); a aula inteira só no
   celular, com a câmera do próprio app; cartões para imprimir.
   Uso:  node provashow/test/provashow-browser.mjs
   Precisa do playwright (global serve). Capturas em provashow/test/saida/. */
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
const Cartao = exigir('../js/cartao.js');
const Leitor = exigir('../js/leitor.js');

const APP = resolve(import.meta.dirname, '..');
const RAIZ = resolve(APP, '..');
const SAIDA = join(APP, 'test', 'saida');
const PORTA = 8752;
const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };

function servir(raiz, porta) {
    const servidor = createServer(async (pedido, resposta) => {
        const caminho = decodeURIComponent(new URL(pedido.url, 'http://x').pathname);
        let arquivo = join(raiz, caminho);
        if (!arquivo.startsWith(raiz)) { resposta.writeHead(403).end(); return; }
        if (existsSync(arquivo) && statSync(arquivo).isDirectory()) arquivo = join(arquivo, 'index.html');
        if (!existsSync(arquivo)) { resposta.writeHead(404).end('não achei'); return; }
        resposta.writeHead(200, { 'Content-Type': TIPOS[extname(arquivo)] || 'application/octet-stream' });
        resposta.end(await readFile(arquivo));
    });
    return new Promise((ok) => servidor.listen(porta, '127.0.0.1', () => ok(servidor)));
}

/* ---- a câmera falsa: um vídeo Y4M com cartões levantados ---- */
function desenharCartoes(largura, altura, cartoes) {
    const g = new Uint8Array(largura * altura);
    for (let y = 0; y < altura; y++) for (let x = 0; x < largura; x++) g[y * largura + x] = 170 + 40 * (x / largura) - 50 * (y / altura);
    const folga = 1.6, L = Cartao.LADO + folga * 2;
    for (const c of cartoes) {
        const grade = Cartao.grade(c.numero);
        const a = c.graus * Math.PI / 180;
        const cantos = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => {
            const px = x * c.lado / 2, py = y * c.lado / 2;
            return [c.x + px * Math.cos(a) - py * Math.sin(a), c.y + px * Math.sin(a) + py * Math.cos(a)];
        });
        const ida = Leitor.homografia(cantos, L);
        const passo = L / (c.lado * 2);
        for (let v = 0; v < L; v += passo) for (let u = 0; u < L; u += passo) {
            const [x, y] = ida(u, v).map(Math.round);
            if (x < 0 || y < 0 || x >= largura || y >= altura) continue;
            const gx = Math.floor(u - folga), gy = Math.floor(v - folga);
            const preta = gx >= 0 && gy >= 0 && gx < Cartao.LADO && gy < Cartao.LADO && grade[gy][gx];
            g[y * largura + x] = preta ? 30 : 235;
        }
    }
    return g;
}

async function videoFalso(caminho, cartoes) {
    const w = 640, h = 480;
    const y = desenharCartoes(w, h, cartoes);
    const uv = Buffer.alloc(w * h / 2, 128);
    const partes = [Buffer.from(`YUV4MPEG2 W${w} H${h} F10:1 Ip A1:1 C420jpeg\n`)];
    for (let i = 0; i < 10; i++) partes.push(Buffer.from('FRAME\n'), Buffer.from(y), uv);
    await writeFile(caminho, Buffer.concat(partes));
}

let falhas = 0;
function confere(condicao, texto) {
    console.log((condicao ? '  ✔ ' : '  ✘ ') + texto);
    if (!condicao) falhas++;
}
const espera = (pagina, f, arg, ms) => pagina.waitForFunction(f, arg, { timeout: ms || 8000 });

await mkdir(SAIDA, { recursive: true });
/* Turma de exemplo: Ana 1, Bruno 2, Carla 3, Davi 4, Eva 5. Pergunta 1: certa B.
   Cartão 1 em pé (A), 2 girado 90° anti-horário (B), 3 de cabeça para baixo (C), 9 sem aluno. */
const Y4M = join(SAIDA, 'camera.y4m');
await videoFalso(Y4M, [
    { numero: 1, x: 130, y: 200, lado: 150, graus: 4 },
    { numero: 2, x: 320, y: 230, lado: 140, graus: -88 },
    { numero: 3, x: 510, y: 210, lado: 145, graus: 178 },
    { numero: 9, x: 320, y: 400, lado: 90, graus: 0 }
]);

const servidor = await servir(RAIZ, PORTA);
const navegador = await chromium.launch({
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${Y4M}`]
});
const erros = [];
const base = `http://127.0.0.1:${PORTA}/provashow/`;

async function novoContexto(opcoes) {
    const c = await navegador.newContext(Object.assign({ viewport: { width: 1360, height: 900 }, permissions: ['camera'], acceptDownloads: true }, opcoes));
    await c.route(/supabase\.co|fonts\.(googleapis|gstatic)\.com|youtube/, (r) => r.abort());
    return c;
}
function vigiar(pagina, nome) {
    pagina.on('pageerror', (e) => erros.push(nome + ': ' + e.message));
    pagina.on('dialog', (d) => d.accept());
}
async function confirmarDialogo(pagina) { await pagina.click('#dialogo button[value="sim"]'); }

const contexto = await novoContexto();

try {
    /* ===== site e ajuda ===== */
    console.log('Site e ajuda');
    const site = await contexto.newPage();
    vigiar(site, 'site');
    await site.goto(base);
    confere((await site.locator('h1').innerText()).includes('A turma inteira responde'), 'título do site');
    confere(await site.locator('#celular .modos article').count() === 3, 'seção “no celular, no computador ou nos dois”');
    confere(await site.locator('#gratis').count() === 1, 'seção sem plano pago');
    await site.screenshot({ path: join(SAIDA, 'site.png'), fullPage: true });
    await site.setViewportSize({ width: 390, height: 844 });
    const larguraCelular = await site.evaluate(() => document.documentElement.scrollWidth);
    confere(larguraCelular <= 390, `site sem rolagem lateral no celular (${larguraCelular}px)`);
    await site.goto(base + 'ajuda/');
    await site.fill('#busca', 'baixe o cartão');
    const visiveis = await site.locator('.ajuda details:not([hidden])').count();
    confere(visiveis >= 1 && visiveis <= 3, `busca da ajuda filtra (${visiveis} artigos)`);
    await site.close();

    /* ===== app: biblioteca ===== */
    console.log('Biblioteca');
    const app = await contexto.newPage();
    vigiar(app, 'app');
    await app.goto(base + 'app/');
    await espera(app, () => window.PS && PS.d);
    confere((await app.locator('h1').innerText()).includes('Olá'), 'tela inicial');
    await app.goto(base + 'app/#biblioteca');
    await app.click('[data-acao="nova-pasta"]');
    await app.fill('#dialogo input', 'Ciências');
    await confirmarDialogo(app);
    await app.click('.linha-item a[href^="#biblioteca/"]');
    await espera(app, () => document.querySelector('h1').textContent.includes('Ciências'));
    confere(true, 'entrou na pasta');
    await app.click('[data-acao="novo-conjunto"]');
    await app.fill('.titulo-editavel', 'Ciências — revisão');
    await app.click('[data-acao="colar-questoes"]');
    await app.fill('#texto-colado', 'Questão 1: Qual planeta é o maior do Sistema Solar?\na) Terra\n*b) Júpiter\nc) Marte\nd) Vênus\n\n2) Quais são gases nobres?\nA. Hélio\nB. Oxigênio\nC. Neônio\nGabarito: A, C\n\n3) O Sol é uma estrela.\nResposta: V');
    await espera(app, () => document.querySelectorAll('.previa-q').length === 3);
    confere(true, 'prévia mostra 3 perguntas antes de importar');
    await confirmarDialogo(app);
    await espera(app, () => document.querySelectorAll('.questao').length === 3);
    confere(true, 'colou 3 perguntas (e tirou a pergunta vazia)');
    confere(await app.locator('.questao').nth(1).locator('.opcao.certa').count() === 2, 'duas certas na pergunta 2');
    confere(await app.locator('.questao').nth(2).locator('.opcao').count() === 2, 'V/F sem alternativas vira Verdadeiro/Falso');
    /* formatação e equação */
    const primeiro = app.locator('.questao').first();
    await primeiro.locator('textarea').fill('Qual planeta é o maior?');
    await primeiro.locator('textarea').evaluate((t) => t.setSelectionRange(5, 12));
    await primeiro.locator('[data-acao="formatar"][data-marca="**"]').click();
    confere((await primeiro.locator('textarea').inputValue()).includes('**planeta**'), 'botão de negrito marca o texto');
    await primeiro.locator('[data-acao="equacao"]').click();
    await app.fill('#tex', 'x^{2}');
    confere(await app.locator('#previa-tex math').count() === 1, 'prévia da equação em MathML');
    await confirmarDialogo(app);
    confere((await primeiro.locator('textarea').inputValue()).includes('$x^{2}$') && await primeiro.locator('.previa-texto math').count() === 1, 'equação inserida e desenhada');
    await primeiro.locator('[data-acao="tipo"][data-tipo="enquete"]').click();
    confere(await app.locator('.questao').first().locator('.opcao.certa').count() === 0, 'virou enquete');
    await app.locator('.questao').first().locator('[data-acao="tipo"][data-tipo="avaliada"]').click();
    await app.click('input[data-campo="embaralhar"]');
    await app.click('[data-acao="previa"]');
    confere(await app.locator('#pv-slide .slide-opcao').count() === 4, 'prévia do slide');
    await confirmarDialogo(app);
    await app.screenshot({ path: join(SAIDA, 'app-editor.png'), fullPage: true });
    const conjuntoNovo = await app.evaluate(() => PS.d.conjuntos.find((c) => c.titulo === 'Ciências — revisão'));
    confere(conjuntoNovo.embaralhar && !!conjuntoNovo.pastaId, 'conjunto na pasta, com embaralhar ligado');
    /* busca, lixeira */
    await app.goto(base + 'app/#busca/' + encodeURIComponent('jupiter'));
    confere(await app.locator('.linha-item').count() === 1, 'busca acha “jupiter” sem acento');
    await app.evaluate((id) => { PS.excluirConjunto(PS.conjunto(id)); }, conjuntoNovo.id);
    await app.goto(base + 'app/#lixeira');
    confere(await app.locator('[data-acao="restaurar"]').count() === 1, 'conjunto na lixeira');
    await app.click('[data-acao="restaurar"]');
    confere(!(await app.evaluate((id) => PS.conjunto(id).removido, conjuntoNovo.id)), 'restaurado da lixeira');
    /* explorar e pacotes */
    await app.goto(base + 'app/#explorar');
    confere(await app.locator('.item-pacote').count() >= 6, 'biblioteca pública com pacotes prontos');
    await app.locator('[data-acao="explorar-trazer"]').nth(1).click();
    confere(await app.evaluate(() => PS.d.pacotes.length === 1 && PS.d.conjuntos.some((c) => c.titulo.startsWith('Frações'))), 'pacote trazido para a biblioteca');
    await app.goto(base + 'app/#pacotes');
    await app.click('.item-pacote');
    const baixando = app.waitForEvent('download');
    await app.click('[data-acao="pacote-exportar"]');
    const pacoteJson = JSON.parse(await readFile(await (await baixando).path(), 'utf8'));
    confere(pacoteJson.tipo === 'provashow-pacote' && pacoteJson.conjuntos.length === 1, 'pacote exportado em arquivo');

    /* ===== turma ===== */
    console.log('Turma');
    await app.goto(base + 'app/#turmas');
    await app.click('[data-acao="nova-turma"]');
    await app.fill('#dialogo input', '2º ano A');
    await confirmarDialogo(app);
    await app.click('[data-acao="colar-alunos"]');
    await app.fill('#dialogo textarea', 'Ana Beatriz\nBruno Lima\nCarla Souza');
    await confirmarDialogo(app);
    confere(await app.locator('.tabela-alunos tbody tr').count() === 3, 'colou 3 alunos');
    await app.locator('input[data-campo="cartao-aluno"]').first().fill('3');
    await app.locator('input[data-campo="cartao-aluno"]').first().dispatchEvent('change');
    const cartoesTurma = await app.evaluate(() => Object.fromEntries(PS.d.turmas.find((t) => t.nome === '2º ano A').alunos.map((a) => [a.nome, a.cartao])));
    confere(cartoesTurma['Ana Beatriz'] === 3 && cartoesTurma['Carla Souza'] === 1, 'trocar o cartão troca com a colega');
    await app.locator('[data-acao="arquivar-aluno"]').last().click();
    confere(await app.locator('.arquivados li').count() === 1, 'aluno arquivado');
    await app.click('[data-acao="links-alunos"]');
    confere(await app.locator('.lista-links input').count() === 2 && (await app.locator('.lista-links input').first().inputValue()).includes('/aluno/?k='), 'links pessoais para responder pelo aparelho');
    await confirmarDialogo(app);
    await app.screenshot({ path: join(SAIDA, 'app-turma.png'), fullPage: true });

    /* ===== aula ao vivo (computador + telão + scanner + aluno) ===== */
    console.log('Aula ao vivo');
    const turmaEx = await app.evaluate(() => PS.d.turmas.find((t) => t.nome === 'Turma de exemplo'));
    const conjuntoEx = await app.evaluate(() => PS.d.conjuntos.find((c) => c.titulo.startsWith('Exemplo')).id);
    await app.evaluate(([t, c]) => PS.comecarAula(t, c), [turmaEx.id, conjuntoEx]);
    await app.waitForSelector('.codigo-aula');
    const codigo = (await app.locator('.codigo-aula').innerText()).trim();
    confere(/^[A-Z0-9]{6}$/.test(codigo), `código da aula: ${codigo}`);

    const telao = await contexto.newPage();
    vigiar(telao, 'telão');
    await telao.setViewportSize({ width: 1280, height: 720 });
    await telao.goto(base + 'telao/?sala=' + codigo);
    await telao.waitForSelector('#palco:not([hidden])', { timeout: 8000 });
    confere((await telao.locator('.slide-enunciado').innerText()) === 'Qual é a capital do Ceará?', 'telão mostra a pergunta');
    confere(await telao.locator('#t-chamada').isHidden(), 'chamada escondida enquanto ninguém lê os cartões');

    const scanner = await contexto.newPage();
    vigiar(scanner, 'scanner');
    await scanner.setViewportSize({ width: 390, height: 844 });
    await scanner.goto(base + 'scanner/?sala=' + codigo);
    await espera(scanner, () => window.ProvaShowScanner && window.ProvaShowScanner.estado());
    confere((await scanner.locator('#info-turma').innerText()) === 'Turma de exemplo', 'scanner recebeu a turma');
    await scanner.click('#ligar-camera');
    await espera(scanner, () => Object.keys(window.ProvaShowScanner.confirmadas()).length >= 3, null, 15000);
    const lidas = await scanner.evaluate(() => window.ProvaShowScanner.confirmadas());
    confere(lidas[1] === 'A' && lidas[2] === 'B' && lidas[3] === 'C', `câmera do scanner leu 1A 2B 3C (${JSON.stringify(lidas)})`);
    confere(!lidas[9], 'cartão 9 (sem aluno) não entrou');
    await espera(app, () => document.querySelector('#contagem-aula')?.textContent.includes('3 de 5'));
    confere(true, 'app recebeu as 3 respostas');
    await espera(telao, () => document.querySelector('#t-n').textContent === '3');
    await espera(telao, () => !document.querySelector('#t-chamada').hidden);
    confere(await telao.locator('.chip.feito').count() === 3, 'telão: chamada aparece durante a leitura, com quem respondeu');
    confere(await telao.locator('.slide-barra').count() === 0, 'telão sem gráfico antes da hora');
    await scanner.screenshot({ path: join(SAIDA, 'scanner.png') });

    /* aluno pelo aparelho: Eva (cartão 5) */
    const chaveEva = turmaEx.alunos.find((a) => a.nome === 'Eva').chave;
    const aluno = await contexto.newPage();
    vigiar(aluno, 'aluno');
    await aluno.setViewportSize({ width: 390, height: 760 });
    await aluno.goto(base + `aluno/?k=${chaveEva}&sala=${codigo}`);
    await aluno.waitForSelector('#pergunta:not([hidden])', { timeout: 8000 });
    await espera(aluno, () => document.querySelector('#quem').textContent === 'Eva');
    confere(true, 'aluno reconhecido pelo link pessoal');
    await aluno.click('[data-letra="B"]');
    await espera(app, () => document.querySelector('#contagem-aula')?.textContent.includes('4 de 5'));
    confere((await app.locator('.aluno', { hasText: 'Eva' }).innerText()).includes('📱'), 'resposta do aparelho entra marcada com 📱');
    await espera(aluno, () => document.querySelector('#situacao').textContent.includes('recebida'));
    confere(true, 'aluno vê “resposta recebida”');
    await aluno.screenshot({ path: join(SAIDA, 'aluno.png') });

    /* cronômetro */
    await app.click('[data-acao="aula-cronometro"]');
    await espera(telao, () => !document.querySelector('#t-relogio').hidden);
    confere(true, 'cronômetro aparece no telão');
    await app.click('[data-acao="aula-cronometro"]');

    /* comandos pelo celular */
    await scanner.click('[data-comando="grafico"]');
    await telao.waitForSelector('.slide-barra', { timeout: 5000 });
    confere(true, 'gráfico aberto pelo celular aparece no telão');
    await scanner.click('[data-comando="revelar"]');
    await telao.waitForSelector('.slide-opcao.certa', { timeout: 5000 });
    confere((await telao.locator('.slide-opcao.certa .slide-opcao-texto').innerText()) === 'Fortaleza', 'resposta certa revelada no telão');
    confere(await telao.locator('.chip .letra').count() === 0, 'respostas individuais continuam escondidas no telão');
    await espera(aluno, () => document.querySelector('#situacao').textContent.includes('acertou'));
    confere(true, 'aluno vê que acertou');
    await telao.screenshot({ path: join(SAIDA, 'telao.png') });

    /* resposta à mão: Davi (cartão 4) responde B */
    await app.click('[data-acao="aula-resposta-manual"][data-cartao="4"]');
    await app.check('#dialogo input[value="B"]');
    await confirmarDialogo(app);
    await espera(telao, () => document.querySelector('#t-n').textContent === '5');
    confere(true, 'resposta lançada à mão chega ao telão');
    await app.screenshot({ path: join(SAIDA, 'app-aula.png'), fullPage: true });

    /* travar */
    await app.click('[data-acao="aula-travar"]');
    await espera(telao, () => !document.querySelector('#t-faixa').hidden);
    confere(true, 'respostas encerradas aparecem no telão');

    await scanner.click('[data-comando="proxima"]');
    await espera(telao, () => document.querySelector('.slide-enunciado').textContent.startsWith('A água'));
    confere(await telao.locator('.slide-opcao').count() === 2, 'próxima pergunta pelo celular (V/F)');
    await scanner.waitForTimeout(1500);
    confere((await telao.locator('#t-n').innerText()) === '0', 'cartões ainda no ar com a resposta anterior não contam na pergunta nova');
    confere(await aluno.locator('.resposta:not([disabled])').count() === 2, 'aluno pode responder a nova pergunta (destravou)');

    /* pergunta 3: equação no telão */
    await app.click('[data-acao="aula-ir"][data-indice="2"]');
    await espera(telao, () => document.querySelectorAll('.slide-enunciado math').length === 1);
    confere(true, 'equação desenhada no telão');

    /* encerrar */
    await app.click('[data-acao="aula-encerrar"]');
    await confirmarDialogo(app);
    await scanner.waitForSelector('#tela-fim:not([hidden])', { timeout: 5000 });
    confere(true, 'scanner avisa que a aula acabou');
    await app.waitForSelector('.lista-sessoes');
    confere(app.url().includes('#relatorio-aula/'), 'ao encerrar, abre o relatório da aula');

    /* ===== relatórios ===== */
    console.log('Relatórios');
    await app.goto(base + 'app/#relatorios/' + turmaEx.id);
    const linhas = await app.locator('.placar tbody tr').allInnerTexts();
    const de = (nome) => linhas.find((l) => l.includes(nome)) || '';
    confere(de('Ana').includes('0%') && de('Bruno').includes('100%') && de('Carla').includes('0%') && de('Davi').includes('100%') && de('Eva').includes('100%'),
        'placar: Ana 0%, Bruno 100%, Carla 0%, Davi 100%, Eva 100%');
    await app.click('[data-acao="periodo"][data-periodo="dia"]');
    confere(await app.locator('.placar tbody tr').count() === 5, 'filtro “hoje” mantém a aula de hoje');
    const download = app.waitForEvent('download');
    await app.click('[data-acao="baixar-planilha"]');
    const csv = await readFile(await (await download).path(), 'utf8');
    confere(csv.includes('"Bruno"') && csv.includes('B ✓') && csv.includes('"Perguntas"'), 'planilha CSV com as respostas e as perguntas');
    await app.screenshot({ path: join(SAIDA, 'app-relatorios.png'), fullPage: true });
    await app.locator('[data-acao="ver-sessao"]').first().click();
    confere(await app.locator('.respostas-alunos span').count() === 5, 'detalhe da pergunta com a resposta de cada aluno');
    await app.check('#ignorar');
    await confirmarDialogo(app);
    confere((await app.locator('.placar tbody tr', { hasText: 'Ana' }).innerText()).includes('—'), 'pergunta fora da nota sai do %');
    await app.click('.placar .fixa a >> text=Bruno');
    confere((await app.locator('.relatorio-aluno h2').innerText()) === 'Bruno', 'relatório do aluno');

    /* ===== cartões ===== */
    console.log('Cartões');
    const cartoes = await contexto.newPage();
    vigiar(cartoes, 'cartões');
    await cartoes.goto(base + 'cartoes/');
    confere(await cartoes.locator('.folha').count() === 32, '63 cartões em 32 folhas (2 por folha)');
    await cartoes.selectOption('#tamanho', '9');
    confere(await cartoes.locator('.folha').count() === 7, '9 por folha: 7 folhas');
    await cartoes.selectOption('#estilo', 'discreto');
    confere((await cartoes.content()).includes('font-size="0.32"'), 'modelo discreto (letras pequenas)');
    await espera(cartoes, () => document.querySelectorAll('#turma option').length > 1);
    await cartoes.selectOption('#turma', { label: '2º ano A' });
    confere(await cartoes.locator('.cartao-svg').count() === 2 && (await cartoes.content()).includes('Bruno Lima'), 'cartões da turma com os nomes (sem o arquivado)');
    await cartoes.selectOption('#tamanho', '2');
    await cartoes.selectOption('#estilo', 'padrao');
    await cartoes.screenshot({ path: join(SAIDA, 'cartoes.png') });
    const pdf = await cartoes.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
    await writeFile(join(SAIDA, 'cartoes.pdf'), pdf);
    confere(pdf.length > 5000, 'PDF dos cartões gerado');
} catch (erro) {
    falhas++;
    console.error(erro);
}

/* ===== tudo pelo celular: app + câmera do próprio celular ===== */
try {
    console.log('Só o celular');
    const celular = await novoContexto({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const cel = await celular.newPage();
    vigiar(cel, 'celular');
    await cel.goto(base + 'app/');
    await espera(cel, () => window.PS && PS.d);
    confere(await cel.locator('.abas-baixo').isVisible(), 'abas embaixo, como app de celular');
    const [t, c] = await cel.evaluate(() => [PS.d.turmas[0].id, PS.d.conjuntos[0].id]);
    await cel.evaluate(([x, y]) => PS.comecarAula(x, y), [t, c]);
    await cel.waitForSelector('.codigo-aula');
    const codigoCel = (await cel.locator('.codigo-aula').innerText()).trim();
    const telaoCel = await celular.newPage();
    vigiar(telaoCel, 'telão do celular');
    await telaoCel.goto(base + 'telao/?sala=' + codigoCel);
    await telaoCel.waitForSelector('#palco:not([hidden])', { timeout: 8000 });
    await cel.bringToFront();
    await cel.click('[data-acao="aula-ler"]');
    await espera(cel, () => document.querySelector('#contagem-aula')?.textContent.includes('3 de 5'), null, 15000);
    confere(true, 'a câmera do próprio celular leu os cartões e registrou 3 respostas');
    await espera(telaoCel, () => document.querySelector('#t-n').textContent === '3');
    confere(true, 'o telão recebeu as respostas lidas pelo celular');
    await cel.waitForTimeout(500);
    await cel.screenshot({ path: join(SAIDA, 'celular-aula.png'), fullPage: true });
    await cel.keyboard.press('g');
    await telaoCel.waitForSelector('.slide-barra', { timeout: 5000 });
    confere(true, 'atalho G abre o gráfico');
    await celular.close();
} catch (erro) {
    falhas++;
    console.error(erro);
} finally {
    await navegador.close();
    servidor.close();
}

for (const e of erros) console.log('  ✘ erro na página: ' + e);
falhas += erros.length;
console.log(falhas ? `\n${falhas} falha(s)` : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
