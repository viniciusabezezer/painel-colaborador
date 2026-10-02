/* Prova da área montada a várias mãos, de ponta a ponta, com Chromium:
   gestão cadastra, PCA cria a prova e distribui as seções, professores
   escrevem só nas suas, PCA revisa, devolve, aprova e trava; sem internet as
   alterações esperam e seguem quando a conexão volta.
   O servidor é um Supabase de mentira (supabase-falso.mjs) com as mesmas
   regras do banco; cada pessoa tem o seu navegador.
   Uso:  node montar/test/area-browser.mjs */
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { criarServidorFalso } from './supabase-falso.mjs';

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
const PORTA = 8751;
const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const falso = criarServidorFalso();

const servidor = createServer(async (pedido, resposta) => {
    if (pedido.method === 'POST' && pedido.url === '/__falso') {
        let corpo = '';
        for await (const parte of pedido) corpo += parte;
        resposta.writeHead(200, { 'Content-Type': 'application/json' });
        resposta.end(JSON.stringify(falso.tratar(JSON.parse(corpo || '{}'))));
        return;
    }
    let arquivo = join(RAIZ, decodeURIComponent(pedido.url.split('?')[0]));
    if (existsSync(arquivo) && statSync(arquivo).isDirectory()) arquivo = join(arquivo, 'index.html');
    if (!arquivo.startsWith(RAIZ) || !existsSync(arquivo)) { resposta.writeHead(404).end('nao encontrado'); return; }
    resposta.writeHead(200, { 'Content-Type': TIPOS[extname(arquivo)] || 'application/octet-stream' });
    resposta.end(await readFile(arquivo));
});
await new Promise((ok) => servidor.listen(PORTA, ok));

const feitos = [];
function conferir(certo, mensagem) {
    if (!certo) throw new Error('FALHOU: ' + mensagem);
    feitos.push(mensagem);
}

const navegador = await chromium.launch();
const erros = [];
const RUIDO = /fonts\.googleapis|fonts\.gstatic|ERR_CERT_AUTHORITY_INVALID|ERR_INTERNET_DISCONNECTED|Failed to fetch|net::ERR_FAILED/;
const respostas = {}; /* respostas para prompt() por pessoa */

async function pessoa(nome) {
    const contexto = await navegador.newContext({ viewport: { width: 1400, height: 1000 }, serviceWorkers: 'block' });
    await contexto.addInitScript({ path: join(APP, 'test', 'cliente-falso.js') });
    const pagina = await contexto.newPage();
    pagina.on('pageerror', (erro) => erros.push(nome + ': ' + erro));
    pagina.on('console', (msg) => { if (msg.type() === 'error' && !RUIDO.test(msg.text())) erros.push(nome + ': ' + msg.text()); });
    pagina.on('dialog', (d) => {
        if (d.type() === 'prompt') d.accept((respostas[nome] || []).shift() ?? '');
        else d.accept();
    });
    await pagina.goto(`http://127.0.0.1:${PORTA}/montar/`);
    return { contexto, pagina };
}

async function entrar(pagina, email, senha) {
    await pagina.goto(`http://127.0.0.1:${PORTA}/montar/#/entrar`);
    await pagina.fill('#entrar-email', email);
    await pagina.fill('#entrar-senha', senha);
    await pagina.click('#entrar-botao');
    await pagina.waitForSelector('#tela-inicio:not([hidden]) #bloco-area:not([hidden])');
}

async function cadastrar(pagina, d) {
    await pagina.fill('#prof-nome', d.nome);
    await pagina.fill('#prof-email', d.email);
    await pagina.selectOption('#prof-papel', d.papel);
    await pagina.selectOption('#prof-area', d.area);
    await pagina.fill('#prof-disciplinas', d.disciplinas || '');
    await pagina.fill('#prof-senha', d.senha);
    await pagina.click('#prof-salvar');
    await pagina.waitForFunction((n) => document.getElementById('prof-ok').textContent.includes(n), d.nome);
}

async function esperarServidor(condicao, mensagem, ms = 10000) {
    const fim = Date.now() + ms;
    while (Date.now() < fim) {
        if (condicao()) return true;
        await new Promise((ok) => setTimeout(ok, 150));
    }
    throw new Error('FALHOU (tempo esgotado): ' + mensagem);
}

const secaoPorTitulo = (titulo) => `#secoes .secao:has(input[data-campo="secao-titulo"][value="${titulo}"])`;

try {
    await mkdir(SAIDA, { recursive: true });

    /* ===== gestão: primeiro acesso e cadastro ===== */
    const gestao = await pessoa('gestao');
    let p = gestao.pagina;
    conferir(await p.isVisible('#conta a[href="#/entrar"]'), 'sem login, o início oferece "Entrar" e as provas pessoais continuam lá');
    conferir(!(await p.isVisible('#bloco-area')), 'sem login, não há provas da área');
    await p.goto(`http://127.0.0.1:${PORTA}/montar/#/entrar`);
    await p.waitForSelector('#form-primeiro:not([hidden])');
    conferir(true, 'sem nenhuma gestão, aparece o primeiro acesso');
    await p.fill('#primeiro-nome', 'Ana Gestão');
    await p.fill('#primeiro-email', 'ana@escola.test');
    await p.fill('#primeiro-senha', 'senha-da-ana');
    await p.fill('#primeiro-senha2', 'senha-da-ana');
    await p.click('#primeiro-botao');
    await p.waitForSelector('#tela-admin:not([hidden])');
    conferir(true, 'o primeiro acesso cria a gestão e abre a tela de professores');

    await cadastrar(p, { nome: 'Paula PCA', email: 'paula@escola.test', papel: 'pca', area: 'NAT', disciplinas: 'Química', senha: 'senha-da-paula' });
    await cadastrar(p, { nome: 'Bruno Biologia', email: 'bruno@escola.test', papel: 'professor', area: 'NAT', disciplinas: 'Biologia', senha: 'senha-do-bruno' });
    await cadastrar(p, { nome: 'Fábio Física', email: 'fabio@escola.test', papel: 'professor', area: 'NAT', disciplinas: 'Física', senha: 'senha-do-fabio' });
    await cadastrar(p, { nome: 'Helena História', email: 'helena@escola.test', papel: 'professor', area: 'HUM', disciplinas: 'História', senha: 'senha-da-helena' });
    conferir(await p.$$eval('#lista-prof .prova-linha', (n) => n.length) === 5, 'a gestão cadastra PCA e professores (5 na lista)');
    await p.screenshot({ path: join(SAIDA, 'area-admin.png'), fullPage: true });
    await p.fill('#prof-nome', 'Sem Área');
    await p.fill('#prof-email', 'semarea@escola.test');
    await p.selectOption('#prof-papel', 'professor');
    await p.selectOption('#prof-area', '');
    await p.fill('#prof-senha', 'senha-qualquer');
    await p.click('#prof-salvar');
    await p.waitForSelector('#prof-erro:not([hidden])');
    conferir((await p.textContent('#prof-erro')).includes('área'), 'professor sem área é recusado com explicação');
    await p.click('#prof-cancelar').catch(() => {});

    /* outra pessoa não vê mais o primeiro acesso */
    const curioso = await pessoa('curioso');
    await curioso.pagina.goto(`http://127.0.0.1:${PORTA}/montar/#/entrar`);
    await curioso.pagina.waitForTimeout(500);
    conferir(!(await curioso.pagina.isVisible('#form-primeiro')), 'com a gestão criada, o primeiro acesso some para os outros');
    await curioso.contexto.close();

    /* ===== PCA cria a prova da área ===== */
    const pca = await pessoa('pca');
    p = pca.pagina;
    await entrar(p, 'paula@escola.test', 'senha-da-paula');
    conferir((await p.textContent('#conta')).includes('Paula PCA') && (await p.textContent('#conta')).includes('PCA'), 'a PCA entra e vê o nome e o papel');
    await p.click('#nova-prova-area');
    await p.waitForSelector('#dialogo-area[open]');
    conferir(await p.$eval('#area-componente', (s) => s.disabled && s.value === 'NAT'), 'a PCA só cria prova da própria área');
    const sugeridos = await p.$$eval('#area-secoes .area-secao', (linhas) => linhas.map((l) => l.querySelector('input').value + '=' + l.querySelector('select').selectedOptions[0].textContent));
    conferir(sugeridos[0].startsWith('BIOLOGIA=Bruno') && sugeridos[1].startsWith('FÍSICA=Fábio') && sugeridos[2].startsWith('QUÍMICA=Paula'),
        'as seções nascem das disciplinas da área, com o professor certo sugerido: ' + sugeridos.join(' | '));
    await p.selectOption('#area-serie', '2');
    await p.fill('#area-prazo', '2026-10-20');
    await p.click('#area-criar');
    await p.waitForSelector('#tela-editor:not([hidden]) .folha');
    await p.waitForFunction(() => document.querySelectorAll('#secoes .secao').length === 3);
    conferir(!(await p.$eval('#editor fieldset.passo', (f) => f.disabled)), 'a PCA altera o formato da prova');
    conferir(await p.isVisible('#ed-travar'), 'a PCA tem o botão de travar para impressão');
    conferir((await p.textContent('#area-painel')).includes('Prazo: 20/10'), 'o painel da área mostra o prazo');
    /* a PCA escreve a sua questão de Química */
    await p.click(secaoPorTitulo('QUÍMICA') + ' [data-acao="add-objetiva"]');
    await p.fill(secaoPorTitulo('QUÍMICA') + ' .questao[open] textarea[data-campo="enunciado"]', 'Qual é a fórmula da água?');
    for (const [i, t] of ['H2O', 'CO2', 'O2', 'NaCl', 'CH4'].entries()) {
        await p.fill(secaoPorTitulo('QUÍMICA') + ` .questao[open] textarea[data-campo="alt"][data-i="${i}"]`, t);
    }
    await p.check(secaoPorTitulo('QUÍMICA') + ' .questao[open] input[value="A"]');
    await esperarServidor(() => falso.db.montador_questoes.length === 1 && falso.db.montador_questoes[0].dados.correta === 'A', 'a questão da PCA chega ao servidor');
    conferir(true, 'a questão da PCA chega ao servidor');
    await p.waitForFunction(() => /Tudo salvo/.test(document.getElementById('ed-nuvem').title), null, { timeout: 8000 });
    conferir(true, 'e o selo mostra "☁ Salvo" (tudo salvo no servidor)');
    const provaId = falso.db.montador_provas[0].id;

    /* ===== professor de Biologia ===== */
    const bruno = await pessoa('bruno');
    p = bruno.pagina;
    await entrar(p, 'bruno@escola.test', 'senha-do-bruno');
    conferir(!(await p.isVisible('#nova-prova-area')), 'o professor não cria prova da área');
    await p.waitForSelector('#lista-area .prova-linha');
    conferir((await p.textContent('#lista-area')).includes('BIOLOGIA: 0 questões'), 'o professor vê a prova e a seção dele no início');
    await p.click('#lista-area .prova-linha a');
    await p.waitForSelector('#tela-editor:not([hidden]) .folha');
    await p.waitForFunction(() => document.querySelectorAll('#secoes .secao').length === 3);
    conferir(await p.$eval('#editor fieldset.passo', (f) => f.disabled), 'para o professor, o formato da prova fica travado');
    conferir(await p.$eval('#editor fieldset.passo .trava-aviso', (n) => n.textContent.includes('PCA')), 'e explica que só o PCA altera');
    conferir(await p.$eval(secaoPorTitulo('FÍSICA'), (s) => s.classList.contains('secao--leitura') && !s.querySelector('[data-acao="add-objetiva"]')),
        'a seção de Física fica só para leitura para o professor de Biologia');
    conferir(await p.$eval(secaoPorTitulo('QUÍMICA'), (s) => s.querySelector('fieldset[disabled] textarea') !== null),
        'ele lê a questão da PCA, mas a caixa vem desabilitada');
    conferir(await p.isHidden('#add-secao'), 'o professor não cria seções');
    conferir((await p.textContent('#paginas')).includes('Qual é a fórmula da água?'), 'a prévia mostra a prova inteira, com as questões dos colegas');

    await p.click(secaoPorTitulo('BIOLOGIA') + ' [data-acao="add-objetiva"]');
    await p.fill(secaoPorTitulo('BIOLOGIA') + ' .questao[open] textarea[data-campo="enunciado"]', 'Qual organela faz a fotossíntese?');
    for (const [i, t] of ['Cloroplasto', 'Mitocôndria', 'Ribossomo', 'Núcleo', 'Lisossomo'].entries()) {
        await p.fill(secaoPorTitulo('BIOLOGIA') + ` .questao[open] textarea[data-campo="alt"][data-i="${i}"]`, t);
    }
    await p.check(secaoPorTitulo('BIOLOGIA') + ' .questao[open] input[value="A"]');
    /* imagem na questão: vai para o storage, não para o banco */
    const [seletor] = await Promise.all([p.waitForEvent('filechooser'), p.click(secaoPorTitulo('BIOLOGIA') + ' .questao[open] [data-acao="img-escolher"]')]);
    await seletor.setFiles(join(APP, 'logo.png'));
    await p.waitForSelector('#paginas .q-img img');
    await esperarServidor(() => falso.db.montador_questoes.some((q) => q.dados.enunciado === 'Qual organela faz a fotossíntese?' && q.dados.correta === 'A' && (q.dados.imagens || []).length === 1), 'a questão do Bruno chega ao servidor');
    const qBio = falso.db.montador_questoes.find((q) => q.dados.enunciado === 'Qual organela faz a fotossíntese?');
    conferir(!!qBio && qBio.criada_por === falso.db.montador_perfis.find((x) => x.email === 'bruno@escola.test').id, 'a questão do Bruno chega ao servidor com a autoria dele');
    conferir(qBio.dados.imagens.length === 1 && qBio.dados.imagens[0].path && !qBio.dados.imagens[0].src && Object.keys(falso.db.storage).length === 1,
        'a imagem vai para o storage, na pasta da prova; no banco fica só o caminho');

    respostas.bruno = ['Terminei Biologia, pode revisar.'];
    await p.click(secaoPorTitulo('BIOLOGIA') + ' [data-acao="nv-pronta"]');
    await p.waitForFunction(() => /pronta para revisão/.test(document.querySelector('#secoes').textContent), null, { timeout: 8000 });
    conferir(falso.db.montador_secoes.find((s) => s.titulo === 'BIOLOGIA').situacao === 'pronta', 'o Bruno marca a seção como pronta, com recado ao PCA');

    /* ===== a PCA vê, edita e devolve ===== */
    p = pca.pagina;
    await p.waitForFunction(() => document.getElementById('paginas').textContent.includes('Qual organela faz a fotossíntese?'), null, { timeout: 10000 });
    conferir(true, 'a questão do Bruno aparece sozinha na prova aberta da PCA (tempo real)');
    await p.waitForFunction(() => /Terminei Biologia/.test(document.getElementById('secoes').textContent), null, { timeout: 8000 });
    conferir(true, 'o recado do Bruno aparece nos comentários da seção');
    conferir(await p.$eval('#paginas .q-img img', (i) => i.src.startsWith('data:image')), 'a imagem do Bruno chega à PCA pelo storage');
    await p.click('#abrir-todas');
    await p.fill(secaoPorTitulo('BIOLOGIA') + ' textarea[data-campo="enunciado"]', 'Qual organela realiza a fotossíntese?');
    await esperarServidor(() => falso.db.montador_questoes.find((q) => q.id === qBio.id).dados.enunciado === 'Qual organela realiza a fotossíntese?', 'a PCA edita a questão do professor');
    conferir(true, 'a PCA edita a questão do professor');
    respostas.pca = ['Troque a alternativa E, ficou fácil demais.'];
    await p.click(secaoPorTitulo('BIOLOGIA') + ' [data-acao="nv-devolver"]');
    await p.waitForFunction(() => /devolvida/.test(document.getElementById('secoes').textContent), null, { timeout: 8000 });
    conferir(falso.db.montador_secoes.find((s) => s.titulo === 'BIOLOGIA').situacao === 'devolvida', 'a PCA devolve a seção com comentário');

    /* ===== o Bruno ajusta ===== */
    p = bruno.pagina;
    await p.waitForFunction(() => /Troque a alternativa E/.test(document.getElementById('secoes').textContent), null, { timeout: 10000 });
    conferir(true, 'o Bruno recebe a devolução e o comentário');
    await p.waitForFunction(() => /realiza a fotossíntese/.test(document.getElementById('paginas').textContent), null, { timeout: 10000 });
    conferir(true, 'e vê a correção que a PCA fez na questão dele');
    await p.click('#abrir-todas');
    await p.fill(secaoPorTitulo('BIOLOGIA') + ' textarea[data-campo="alt"][data-i="4"]', 'Complexo de Golgi');
    await esperarServidor(() => falso.db.montador_questoes.find((q) => q.id === qBio.id).dados.alternativas[4] === 'Complexo de Golgi', 'a alteração do Bruno chega');
    conferir(falso.db.montador_secoes.find((s) => s.titulo === 'BIOLOGIA').situacao === 'rascunho', 'ao mexer na seção devolvida, ela volta a "em andamento"');

    /* ===== sem internet ===== */
    await bruno.contexto.setOffline(true);
    await p.evaluate(() => window.dispatchEvent(new Event('offline')));
    await p.click(secaoPorTitulo('BIOLOGIA') + ' [data-acao="add-discursiva"]');
    await p.locator(secaoPorTitulo('BIOLOGIA') + ' details.questao').last().locator('textarea[data-campo="enunciado"]').fill('Explique a respiração celular.');
    await p.waitForFunction(() => /Sem conexão/.test(document.getElementById('ed-nuvem').textContent), null, { timeout: 8000 });
    conferir(true, 'sem internet, o chip avisa que as alterações estão guardadas no aparelho');
    conferir(!falso.db.montador_questoes.some((q) => q.dados.enunciado === 'Explique a respiração celular.'), 'e nada chega ao servidor enquanto isso');
    await bruno.contexto.setOffline(false);
    await p.evaluate(() => window.dispatchEvent(new Event('online')));
    await esperarServidor(() => falso.db.montador_questoes.some((q) => q.dados.enunciado === 'Explique a respiração celular.'), 'a questão offline chega');
    await p.waitForFunction(() => /Tudo salvo/.test(document.getElementById('ed-nuvem').title), null, { timeout: 10000 });
    conferir(falso.db.montador_questoes.some((q) => q.dados.enunciado === 'Explique a respiração celular.' && q.dados.tipo === 'discursiva'), 'a conexão volta e a questão feita offline é enviada');
    conferir(falso.db.montador_questoes.find((q) => q.id === qBio.id).dados.enunciado === 'Qual organela realiza a fotossíntese?', 'e a questão anterior do Bruno continua intacta');

    /* ===== Física: o Fábio escreve a dele, sem ver as alterações dos outros sumirem ===== */
    const fabio = await pessoa('fabio');
    p = fabio.pagina;
    await entrar(p, 'fabio@escola.test', 'senha-do-fabio');
    await p.click('#lista-area .prova-linha a');
    await p.waitForFunction(() => document.querySelectorAll('#secoes .secao').length === 3);
    conferir(await p.$eval(secaoPorTitulo('BIOLOGIA'), (s) => s.classList.contains('secao--leitura')), 'para o Fábio, Biologia é só leitura');
    await p.click(secaoPorTitulo('FÍSICA') + ' [data-acao="add-objetiva"]');
    await p.fill(secaoPorTitulo('FÍSICA') + ' .questao[open] textarea[data-campo="enunciado"]', 'Qual a unidade de força no SI?');
    await esperarServidor(() => falso.db.montador_questoes.length === 4, 'a questão do Fábio chega');
    conferir(falso.db.montador_questoes.length === 4, 'as questões dos três professores convivem na mesma prova (4 no servidor)');

    /* o banco recusa o que a tela esconde */
    const recusa = await p.evaluate(async (id) => {
        const secaoBio = window.MontadorProvas.estado().secoes.find((s) => s.titulo === 'BIOLOGIA').id;
        const r = await window.MONTADOR_CLIENTE_FALSO.from('montador_questoes').insert({ id: 'q-invasora', prova_id: id, secao_id: secaoBio, dados: {} });
        return r.error && r.error.message;
    }, provaId);
    conferir(/row-level security/.test(recusa || ''), 'mesmo forçando, o Fábio não consegue pôr questão na seção de Biologia');

    /* ===== a PCA aprova e trava ===== */
    p = pca.pagina;
    await p.waitForFunction(() => document.getElementById('paginas').textContent.includes('Qual a unidade de força no SI?'), null, { timeout: 10000 });
    await p.waitForFunction(() => document.getElementById('paginas').textContent.includes('Explique a respiração celular.'), null, { timeout: 10000 });
    conferir(true, 'a PCA vê na prévia a prova montada pelos três');
    conferir((await p.textContent('#paginas')).includes('Complexo de Golgi'), 'com a alteração do Bruno depois da devolução');
    conferir(await p.$$eval('#secoes .questao', (n) => n.length) === 4 && (await p.textContent('#paginas')).includes('realiza a fotossíntese'), 'as 4 questões estão no editor e na prévia da PCA');
    for (const t of ['BIOLOGIA', 'FÍSICA', 'QUÍMICA']) {
        await p.click(secaoPorTitulo(t) + ' [data-acao="nv-aprovar"]');
        await p.waitForFunction((titulo) => {
            const s = [...document.querySelectorAll('#secoes .secao')].find((x) => x.querySelector('input[data-campo="secao-titulo"]').value === titulo);
            return s && /aprovada/.test(s.querySelector('.secao-dono').textContent);
        }, t, { timeout: 8000 });
    }
    conferir(falso.db.montador_secoes.every((s) => s.situacao === 'aprovada'), 'a PCA aprova as três seções');
    await p.click('#ed-travar');
    await p.waitForFunction(() => /Destravar/.test(document.getElementById('ed-travar').textContent), null, { timeout: 8000 });
    conferir(falso.db.montador_provas[0].situacao === 'travada', 'a PCA trava a prova para impressão');
    conferir(Object.keys(await p.evaluate(() => window.MontadorProvas.resultado())).length > 0 && (await p.$$eval('#paginas .folha', (f) => f.length)) >= 1, 'a prova travada continua imprimível');
    await p.screenshot({ path: join(SAIDA, 'area-pca.png') });

    p = bruno.pagina;
    await p.waitForFunction(() => /travada para impressão/.test(document.getElementById('secoes').textContent), null, { timeout: 10000 });
    conferir(await p.$eval(secaoPorTitulo('BIOLOGIA'), (s) => s.classList.contains('secao--leitura')), 'com a prova travada, o Bruno não edita mais nem a dele');
    await p.screenshot({ path: join(SAIDA, 'area-professor.png') });

    await pca.pagina.goto(`http://127.0.0.1:${PORTA}/montar/#/`);
    await pca.pagina.waitForSelector('#lista-area .prova-linha');
    await pca.pagina.screenshot({ path: join(SAIDA, 'area-inicio.png') });

    /* ===== outra área não vê ===== */
    const helena = await pessoa('helena');
    await entrar(helena.pagina, 'helena@escola.test', 'senha-da-helena');
    await helena.pagina.waitForTimeout(600);
    conferir(await helena.pagina.$$eval('#lista-area .prova-linha', (n) => n.length) === 0, 'a professora de História não vê a prova de Ciências da Natureza');

    /* ===== a gestão desativa e o acesso some ===== */
    p = gestao.pagina;
    await p.goto(`http://127.0.0.1:${PORTA}/montar/#/admin`);
    await p.waitForSelector('#lista-prof .prova-linha');
    const idHelena = falso.db.montador_perfis.find((x) => x.email === 'helena@escola.test').id;
    await p.click(`[data-prof-ativo="${idHelena}"]`);
    await p.waitForFunction(() => /desativado/.test(document.getElementById('lista-prof').textContent));
    const helena2 = await pessoa('helena2');
    await helena2.pagina.goto(`http://127.0.0.1:${PORTA}/montar/#/entrar`);
    await helena2.pagina.fill('#entrar-email', 'helena@escola.test');
    await helena2.pagina.fill('#entrar-senha', 'senha-da-helena');
    await helena2.pagina.click('#entrar-botao');
    await helena2.pagina.waitForSelector('#entrar-erro:not([hidden])');
    conferir((await helena2.pagina.textContent('#entrar-erro')).includes('desativada'), 'professor desativado não entra, com explicação');

    /* ===== a prova pessoal continua como era ===== */
    p = gestao.pagina;
    await p.goto(`http://127.0.0.1:${PORTA}/montar/#/`);
    await p.click('[data-usar="bimestral-malu"]');
    await p.waitForSelector('#tela-editor:not([hidden]) .folha');
    conferir(!(await p.$eval('#editor fieldset.passo', (f) => f.disabled)) && await p.isHidden('#ed-nuvem') && await p.isHidden('#area-painel'),
        'a prova pessoal abre como antes, sem nada da nuvem');

    conferir(erros.length === 0, 'nenhum erro no console: ' + erros.join(' | '));
    console.log(feitos.map((f) => '✓ ' + f).join('\n'));
    console.log('\n' + feitos.length + ' verificações passaram.');
} catch (erro) {
    console.log(feitos.map((f) => '✓ ' + f).join('\n'));
    console.error('\n' + erro.message);
    if (erros.length) console.error('Erros da página: ' + erros.join('\n'));
    process.exitCode = 1;
} finally {
    await navegador.close();
    servidor.close();
}
