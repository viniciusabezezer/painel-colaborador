/* Regressão de ponta a ponta do ProvaShow Malu, com Chromium de verdade.
   O app do professor, o telão e o scanner abrem na mesma janela do
   navegador e conversam pelo canal local (a internet do Supabase fica
   bloqueada no teste). A câmera do scanner é uma câmera falsa do Chromium
   que mostra uma foto sintética da turma levantando os cartões.

   Confere: biblioteca (colar perguntas), turma (colar alunos), aula ao vivo
   (código, leitura pela câmera, gráfico e resposta comandados pelo celular,
   próxima pergunta), telão, relatórios, cartões para imprimir e o site.
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
const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };

function servir(raiz, porta) {
    const servidor = createServer(async (pedido, resposta) => {
        let caminho = decodeURIComponent(new URL(pedido.url, 'http://x').pathname);
        let arquivo = join(raiz, caminho);
        if (!arquivo.startsWith(raiz)) { resposta.writeHead(403).end(); return; }
        if (existsSync(arquivo) && statSync(arquivo).isDirectory()) arquivo = join(arquivo, 'index.html');
        if (!existsSync(arquivo)) { resposta.writeHead(404).end('não achei'); return; }
        resposta.writeHead(200, { 'Content-Type': TIPOS[extname(arquivo)] || 'application/octet-stream' });
        resposta.end(await readFile(arquivo));
    });
    return new Promise((ok) => servidor.listen(porta, '127.0.0.1', () => ok(servidor)));
}

/* ---- a câmera falsa: um vídeo Y4M com 3 cartões levantados ---- */
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

await mkdir(SAIDA, { recursive: true });
/* Turma de exemplo: Ana 1, Bruno 2, Carla 3, Davi 4, Eva 5. Pergunta 1: certa B.
   Cartão 1 em pé (A), cartão 2 girado 90° anti-horário (B), cartão 3 de cabeça para baixo (C),
   cartão 9 (sem aluno) para mostrar que fica de fora. */
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
const contexto = await navegador.newContext({ viewport: { width: 1360, height: 900 }, permissions: ['camera'] });
await contexto.route(/supabase\.co/, (r) => r.abort());
await contexto.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
const erros = [];
const base = `http://127.0.0.1:${PORTA}/provashow/`;

try {
    /* ===== site ===== */
    console.log('Site');
    const site = await contexto.newPage();
    site.on('pageerror', (e) => erros.push('site: ' + e.message));
    await site.goto(base);
    confere(await site.locator('h1').innerText().then((t) => t.includes('A turma inteira responde')), 'título do site');
    confere(await site.locator('#cartao-exemplo svg').count() === 1, 'cartão de exemplo desenhado');
    confere(await site.locator('a[href="app/"]').count() >= 2, 'chamadas para o app');
    await site.screenshot({ path: join(SAIDA, 'site.png'), fullPage: true });
    await site.setViewportSize({ width: 390, height: 844 });
    const larguraCelular = await site.evaluate(() => document.documentElement.scrollWidth);
    confere(larguraCelular <= 390, `site sem rolagem lateral no celular (${larguraCelular}px)`);
    await site.screenshot({ path: join(SAIDA, 'site-celular.png'), fullPage: true });
    await site.close();

    /* ===== biblioteca ===== */
    console.log('Biblioteca');
    const app = await contexto.newPage();
    app.on('pageerror', (e) => erros.push('app: ' + e.message));
    app.on('dialog', (d) => d.accept());
    await app.goto(base + 'app/');
    confere(await app.locator('.item-conjunto').count() === 1, 'começa com o conjunto de exemplo');
    await app.click('[data-acao="novo-conjunto"]');
    await app.fill('.titulo-editavel', 'Ciências — revisão');
    await app.click('[data-acao="colar-questoes"]');
    await app.fill('#dialogo textarea', '1) Qual planeta é o maior do Sistema Solar?\na) Terra\n*b) Júpiter\nc) Marte\nd) Vênus\n\n2) O Sol é uma estrela.\na) Verdadeiro\nb) Falso\nResposta: A');
    await app.click('#dialogo button[value="sim"]');
    confere(await app.locator('.questao').count() === 2, 'colou 2 perguntas (e tirou a pergunta vazia)');
    confere(await app.locator('.questao').first().locator('.opcao.certa input[type=text]').inputValue() === 'Júpiter', 'gabarito marcado pelo asterisco');
    await app.screenshot({ path: join(SAIDA, 'app-conjunto.png'), fullPage: true });

    /* ===== turma ===== */
    console.log('Turma');
    await app.goto(base + 'app/#turmas');
    await app.click('[data-acao="nova-turma"]');
    await app.fill('.titulo-editavel', '2º ano A');
    await app.click('[data-acao="colar-alunos"]');
    await app.fill('#dialogo textarea', 'Ana Beatriz\nBruno Lima\nCarla Souza');
    await app.click('#dialogo button[value="sim"]');
    confere(await app.locator('.tabela-alunos tbody tr').count() === 3, 'colou 3 alunos');
    await app.click('[data-acao="fila-adicionar"]');
    confere(await app.locator('.fila li[data-fila]').count() === 1, 'conjunto na fila da turma');
    await app.screenshot({ path: join(SAIDA, 'app-turma.png'), fullPage: true });

    /* ===== aula ao vivo, com a turma de exemplo ===== */
    console.log('Aula ao vivo');
    await app.goto(base + 'app/#aula');
    const turmaExemplo = await app.evaluate(() => window.ProvaShowApp.dados().turmas.find((t) => t.nome === 'Turma de exemplo').id);
    await app.selectOption('#aula-turma', turmaExemplo);
    await app.locator('.lista-comecar').first().locator('[data-acao="comecar-aula"]').click();
    const codigo = (await app.locator('.codigo-aula').innerText()).trim();
    confere(/^[A-Z0-9]{6}$/.test(codigo), `código da aula: ${codigo}`);
    confere(await app.locator('.qr svg').count() === 1, 'QR code do scanner');

    const telao = await contexto.newPage();
    telao.on('pageerror', (e) => erros.push('telão: ' + e.message));
    await telao.setViewportSize({ width: 1280, height: 720 });
    await telao.goto(base + 'telao/?sala=' + codigo);
    await telao.waitForSelector('#palco:not([hidden])', { timeout: 8000 });
    confere((await telao.locator('#t-enunciado').innerText()) === 'Qual é a capital do Ceará?', 'telão mostra a pergunta');
    confere(await telao.locator('#t-chamada .chip').count() === 5, 'telão mostra a chamada da turma');

    const scanner = await contexto.newPage();
    scanner.on('pageerror', (e) => erros.push('scanner: ' + e.message));
    await scanner.setViewportSize({ width: 390, height: 844 });
    await scanner.goto(base + 'scanner/?sala=' + codigo);
    await scanner.waitForFunction(() => window.ProvaShowScanner && window.ProvaShowScanner.estado(), null, { timeout: 8000 });
    confere((await scanner.locator('#info-turma').innerText()) === 'Turma de exemplo', 'scanner recebeu a turma');
    await scanner.click('#ligar-camera');
    await scanner.waitForFunction(() => Object.keys(window.ProvaShowScanner.confirmadas()).length >= 3, null, { timeout: 15000 });
    const lidas = await scanner.evaluate(() => window.ProvaShowScanner.confirmadas());
    confere(lidas[1] === 'A' && lidas[2] === 'B' && lidas[3] === 'C', `câmera leu 1A 2B 3C (${JSON.stringify(lidas)})`);
    confere(!lidas[9], 'cartão 9 (sem aluno) não entrou');
    await scanner.waitForTimeout(400);
    await scanner.screenshot({ path: join(SAIDA, 'scanner.png') });

    await app.waitForFunction(() => document.querySelector('#contagem-aula')?.textContent.includes('3 de 5'), null, { timeout: 5000 });
    confere(true, 'app recebeu as 3 respostas');
    await telao.waitForFunction(() => document.querySelector('#t-n').textContent === '3', null, { timeout: 5000 });
    confere(await telao.locator('.chip.feito').count() === 3, 'telão marca quem respondeu');
    confere(await telao.locator('.opcao .barra').count() === 0, 'telão sem gráfico antes da hora');

    /* comandos pelo celular */
    await scanner.click('[data-comando="grafico"]');
    await telao.waitForSelector('.opcao .barra', { timeout: 5000 });
    confere(true, 'gráfico aberto pelo celular aparece no telão');
    await scanner.click('[data-comando="revelar"]');
    await telao.waitForSelector('.opcao.certa', { timeout: 5000 });
    confere((await telao.locator('.opcao.certa .texto').innerText()) === 'Fortaleza', 'resposta certa revelada no telão');
    await telao.screenshot({ path: join(SAIDA, 'telao.png') });
    await app.screenshot({ path: join(SAIDA, 'app-aula.png'), fullPage: true });

    /* resposta à mão: Davi (cartão 4) responde B */
    await app.click('[data-acao="aula-resposta-manual"][data-cartao="4"]');
    await app.click('[data-acao="aula-resposta-manual"][data-cartao="4"]');
    await telao.waitForFunction(() => document.querySelector('#t-n').textContent === '4', null, { timeout: 5000 });
    confere(true, 'resposta lançada à mão chega ao telão');

    await scanner.click('[data-comando="proxima"]');
    await telao.waitForFunction(() => document.querySelector('#t-enunciado').textContent.startsWith('A água'), null, { timeout: 5000 });
    confere(true, 'próxima pergunta pelo celular');
    confere(await telao.locator('.opcao').count() === 2, 'verdadeiro/falso com 2 alternativas');
    await scanner.waitForTimeout(1500);
    confere((await telao.locator('#t-n').innerText()) === '0', 'cartões ainda no ar com a resposta anterior não contam na pergunta nova');

    /* encerrar */
    await app.click('[data-acao="aula-encerrar"]');
    await app.click('#dialogo button[value="sim"]');
    await scanner.waitForSelector('#tela-fim:not([hidden])', { timeout: 5000 });
    confere(true, 'scanner avisa que a aula acabou');

    /* ===== relatórios ===== */
    console.log('Relatórios');
    await app.goto(base + 'app/#relatorios');
    await app.selectOption('#filtro-turma', turmaExemplo);
    const linhas = await app.locator('.placar tbody tr').allInnerTexts();
    const de = (nome) => linhas.find((l) => l.includes(nome)) || '';
    confere(de('Ana').includes('0%') && de('Bruno').includes('100%') && de('Carla').includes('0%') && de('Davi').includes('100%'), 'placar: Ana 0%, Bruno 100%, Carla 0%, Davi 100%');
    confere(de('Eva').includes('—'), 'Eva sem resposta fica com —');
    const download = app.waitForEvent('download');
    await app.click('[data-acao="baixar-planilha"]');
    const csv = await readFile(await (await download).path(), 'utf8');
    confere(csv.includes('"Bruno"') && csv.includes('B ✓'), 'planilha CSV com as respostas');
    await app.screenshot({ path: join(SAIDA, 'app-relatorios.png'), fullPage: true });

    /* ===== cartões ===== */
    console.log('Cartões');
    const cartoes = await contexto.newPage();
    cartoes.on('pageerror', (e) => erros.push('cartões: ' + e.message));
    await cartoes.goto(base + 'cartoes/');
    confere(await cartoes.locator('.folha').count() === 32, '63 cartões em 32 folhas (2 por folha)');
    await cartoes.selectOption('#tamanho', '4');
    confere(await cartoes.locator('.folha').count() === 16, '4 por folha: 16 folhas');
    await cartoes.selectOption('#turma', { label: '2º ano A' });
    confere(await cartoes.locator('.cartao-svg').count() === 3 && (await cartoes.content()).includes('2 · Bruno Lima'), 'cartões da turma com os nomes');
    await cartoes.screenshot({ path: join(SAIDA, 'cartoes.png') });
    const pdf = await cartoes.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
    await writeFile(join(SAIDA, 'cartoes.pdf'), pdf);
    confere(pdf.length > 5000, 'PDF dos cartões gerado');
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
