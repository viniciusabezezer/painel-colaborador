/* Regressão de ponta a ponta da Jangada, com Chromium de verdade: entra,
   carrega a demonstração, reconhece, desconta com proteção, usa poder,
   começa o dia, sorteia no Telão, vence uma batalha, cria e conclui
   missão, cadastra uma turma nova e forma as jangadas.
   Uso:  node jangada/test/jangada-browser.mjs
   Precisa do playwright. As capturas ficam em jangada/test/saida/. */
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
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
const PORTA = 8752;
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
function confere(condicao, mensagem) {
    if (!condicao) throw new Error(`FALHOU: ${mensagem}`);
    feitos.push(mensagem);
}

await mkdir(SAIDA, { recursive: true });
const servidor = await servir(RAIZ, PORTA);
const navegador = await chromium.launch(existsSync('/opt/pw-browsers/chromium') ? {} : {});
const erros = [];
try {
    for (const [largura, altura, nome] of [[1280, 860, 'computador'], [390, 844, 'celular']]) {
        const pagina = await navegador.newPage({ viewport: { width: largura, height: altura } });
        pagina.on('pageerror', (e) => erros.push(`${nome}: ${e.message}`));
        pagina.on('console', (m) => { if (m.type() === 'error' && !/fonts\.googleapis|ERR_/.test(m.text())) erros.push(`${nome}: ${m.text()}`); });
        pagina.on('dialog', (d) => d.accept());
        await pagina.goto(`http://localhost:${PORTA}/jangada/`);

        const estado = () => pagina.evaluate(() => {
            const E = window.JangadaApp.estado();
            return { alunos: Object.values(E.alunos), ignorados: E.ignorados, registros: E.registros.length, missoes: Object.values(E.missoes) };
        });

        // boas-vindas → demonstração
        await pagina.fill('#nome-professor', 'Prof. Teste');
        await pagina.click('[data-depois="demo"]');
        await pagina.waitForSelector('.cartao-aluno');
        let s = await estado();
        confere(s.alunos.length === 22, `${nome}: demonstração com 22 estudantes`);
        confere(s.ignorados.length === 0, `${nome}: nenhum evento da demonstração ignorado`);
        await pagina.screenshot({ path: join(SAIDA, `${nome}-turma.png`), fullPage: true });

        // começar o dia
        await pagina.click('[data-acao="comecar-dia"]');
        await pagina.waitForSelector('#btn-confirmar-dia:not([disabled])', { timeout: 5000 });
        await pagina.check('input[name="ausente"][value="demo-a10"]');
        await pagina.click('#btn-confirmar-dia');
        await pagina.waitForSelector('.faixa-dia--evento');
        confere(true, `${nome}: dia começou com evento sorteado`);

        // reconhecer dois (estado relido: o evento do dia pode ter mexido no XP)
        s = await estado();
        const primeiro = s.alunos.find((a) => a.nome === 'Ana Clara');
        const segundo = s.alunos.find((a) => a.nome === 'Bruno');
        await pagina.click(`[data-acao="selecionar"][data-id="${primeiro.id}"]`);
        await pagina.click(`[data-acao="selecionar"][data-id="${segundo.id}"]`);
        await pagina.waitForSelector('#barra-selecao:not([hidden])');
        await pagina.click('#barra-selecao [data-acao="reconhecer"]');
        await pagina.click('[data-acao="aplicar-comportamento"][data-comp="ajudou"]');
        s = await estado();
        const ana = s.alunos.find((a) => a.id === primeiro.id);
        confere(ana.xp > primeiro.xp, `${nome}: reconhecimento deu XP (${primeiro.xp} → ${ana.xp})`);

        // desfazer pelo aviso
        await pagina.click('.aviso-flutuante [data-acao="desfazer"]');
        s = await estado();
        confere(s.alunos.find((a) => a.id === primeiro.id).xp === primeiro.xp, `${nome}: desfazer devolveu o XP`);

        // desconto com proteção de um(a) Jangadeiro(a) da mesma jangada
        const protegido = s.alunos.find((a) => a.classe !== 'jangadeiro' && !a.caido
            && s.alunos.some((b) => b.jangada === a.jangada && b.classe === 'jangadeiro' && b.energia >= 10 && !b.caido));
        await pagina.click(`[data-acao="selecionar"][data-id="${protegido.id}"]`);
        await pagina.click('#barra-selecao [data-acao="descontar"]');
        await pagina.click('[data-acao="escolher-desconto"][data-comp="celular"]');
        const opcoes = await pagina.$$eval(`[data-protegido="${protegido.id}"] option`, (os) => os.map((o) => o.value).filter(Boolean));
        const energiaProtetor = s.alunos.find((a) => a.id === opcoes[0]).energia;
        await pagina.selectOption(`[data-protegido="${protegido.id}"]`, opcoes[0]);
        await pagina.click('.painel-escolha [data-acao="aplicar-comportamento"]');
        s = await estado();
        const depois = s.alunos.find((a) => a.id === protegido.id);
        const dia = await pagina.evaluate((t) => window.JangadaApp.estado().dias[t], 'Demonstração');
        if (!dia.semDano) confere(depois.vida === protegido.vida, `${nome}: protegido(a) não perdeu Vida`);
        if (!dia.semDano) confere(s.alunos.find((a) => a.id === opcoes[0]).energia === energiaProtetor - 10, `${nome}: protetor gastou 10 de Energia`);

        // ficha + poder de cura (Rendeiro(a) com Energia e colega ferido)
        const rendeiro = s.alunos.find((a) => a.classe === 'rendeiro' && a.energia >= 10 && !a.caido
            && s.alunos.some((b) => b.jangada === a.jangada && b.id !== a.id && !b.caido));
        await pagina.click(`[data-acao="ficha"][data-id="${rendeiro.id}"]`);
        await pagina.waitForSelector('.lista-poderes');
        await pagina.click(`[data-acao="usar-poder"][data-poder="ponto"]`);
        s = await estado();
        confere(s.alunos.find((a) => a.id === rendeiro.id).energia === rendeiro.energia - 10, `${nome}: poder gastou Energia`);
        await pagina.screenshot({ path: join(SAIDA, `${nome}-ficha.png`), fullPage: false });
        await pagina.click('[data-acao="fechar-modal"]');

        // Telão
        await pagina.click('.aba[data-aba="telao"]');
        await pagina.click('[data-acao="sortear"]');
        await pagina.waitForSelector('.sorteado--pronto', { timeout: 5000 });
        confere(true, `${nome}: Telão sorteou alguém`);
        await pagina.screenshot({ path: join(SAIDA, `${nome}-telao.png`), fullPage: true });

        // Conselheiro
        await pagina.click('.aba[data-aba="conselheiro"]');
        const textoAlertas = await pagina.textContent('.alertas');
        confere(/não é reconhecido/.test(textoAlertas), `${nome}: Conselheiro aponta o invisível`);
        confere(/faltas seguidas/.test(textoAlertas), `${nome}: Conselheiro aponta a Busca Ativa`);
        confere(/PDT/.test(await pagina.inputValue('#resumo-pdt')), `${nome}: resumo para o PDT`);
        await pagina.screenshot({ path: join(SAIDA, `${nome}-conselheiro.png`), fullPage: true });

        // Batalha: acerta tudo até vencer
        await pagina.click('.aba[data-aba="batalha"]');
        await pagina.click('[data-acao="iniciar-batalha"]');
        for (let i = 0; i < 20 && await pagina.$('[data-acao="golpear"]'); i++) {
            await pagina.click('[data-acao="mostrar-resposta"]').catch(() => {});
            const grupos = await pagina.$$eval('[data-acao="marcar-acerto"]', (bs) => bs.length);
            for (let g = 0; g < grupos; g++) await pagina.click(`[data-acao="marcar-acerto"] >> nth=${g}`);
            await pagina.click('[data-acao="golpear"]');
        }
        await pagina.screenshot({ path: join(SAIDA, `${nome}-batalha.png`), fullPage: true });
        const antesBatalha = (await estado()).alunos.reduce((t, a) => t + a.xp, 0);
        await pagina.click('[data-acao="registrar-batalha"]');
        confere((await estado()).alunos.reduce((t, a) => t + a.xp, 0) > antesBatalha, `${nome}: vitória na batalha deu XP`);

        // Missão
        await pagina.click('.aba[data-aba="missoes"]');
        await pagina.click('[data-acao="modelo-missao"][data-i="1"]');
        await pagina.click('[data-acao="criar-missao"]');
        await pagina.click('.missao [data-acao="concluir-missao"] >> nth=0');
        await pagina.click('[data-acao="marcar-todos"]');
        await pagina.click('[data-acao="confirmar-missao"]');
        s = await estado();
        confere(s.missoes.some((m) => Object.keys(m.concluidas).length >= 20), `${nome}: missão concluída pela turma`);

        // Cadastro de turma real + jangadas automáticas
        await pagina.selectOption('#turma-atual', '2ª B');
        await pagina.click('.aba[data-aba="cadastro"]');
        await pagina.fill('#novos-alunos', Array.from({ length: 12 }, (_, i) => `Estudante ${i + 1}${i === 0 ? ' ; MALU-0001' : ''}`).join('\n'));
        await pagina.click('[data-acao="adicionar-alunos"]');
        s = await estado();
        const novos = s.alunos.filter((a) => a.turma === '2ª B');
        confere(novos.length === 12 && new Set(novos.map((a) => a.classe)).size === 3, `${nome}: 12 cadastrados com as três classes`);
        confere(novos.find((a) => a.nome === 'Estudante 1').codigo === 'MALU-0001', `${nome}: código do MaluPix guardado`);
        await pagina.click('.passo [data-acao="sugerir-jangadas"]');
        await pagina.click('[data-acao="aplicar-jangadas"]');
        s = await estado();
        confere(s.alunos.filter((a) => a.turma === '2ª B').every((a) => a.jangada), `${nome}: jangadas formadas`);
        await pagina.screenshot({ path: join(SAIDA, `${nome}-cadastro.png`), fullPage: true });

        // Escola: aba abre, backup baixa
        await pagina.click('.aba[data-aba="escola"]');
        const [download] = await Promise.all([pagina.waitForEvent('download'), pagina.click('[data-acao="exportar"]')]);
        confere(/jangada-backup-malu/.test(download.suggestedFilename()), `${nome}: backup baixado`);
        await pagina.screenshot({ path: join(SAIDA, `${nome}-escola.png`), fullPage: true });

        // recarrega: tudo continua
        await pagina.reload();
        await pagina.waitForSelector('.cartao-aluno');
        confere((await estado()).alunos.length === 34, `${nome}: dados sobrevivem ao recarregar`);
        const largo = await pagina.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
        confere(!largo, `${nome}: sem rolagem horizontal`);
        await pagina.close();
    }
    if (erros.length) throw new Error(`Erros no console:\n${erros.join('\n')}`);
    console.log(feitos.map((f) => `ok - ${f}`).join('\n'));
    console.log(`\n${feitos.length} verificações passaram.`);
} finally {
    await navegador.close();
    servidor.close();
}
