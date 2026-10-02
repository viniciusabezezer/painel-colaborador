/* Testes da parte que não depende de navegador: marcação do texto, modelos,
   grade do gabarito e leitura das questões coladas.
   Rode com:  node --test montar/test/            */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const js = path.join(__dirname, '..', 'js');
const Texto = require(path.join(js, 'texto.js'));
const Modelos = require(path.join(js, 'modelos.js'));
const Gabarito = require(path.join(js, 'gabarito.js'));
const Importar = require(path.join(js, 'importar.js'));
const Icones = require(path.join(js, 'icones.js'));

/* ===== texto ===== */

test('negrito, itálico, índice e expoente viram as tags certas', () => {
    assert.equal(Texto.html('a **forte** e *leve*'), 'a <strong>forte</strong> e <em>leve</em>');
    assert.equal(Texto.html('H~2~O e x^2^'), 'H<sub>2</sub>O e x<sup>2</sup>');
    assert.equal(Texto.html('**negrito com *itálico* dentro**'),
        '<strong>negrito</strong> <strong>com</strong> <em><strong>itálico</strong></em> <strong>dentro</strong>');
});

test('marcador sem par sai como foi digitado, e \\* é asterisco', () => {
    assert.equal(Texto.html('cerca de ~5 cm'), 'cerca de ~5 cm');
    assert.equal(Texto.html('nota 5\\* e 6\\*'), 'nota 5* e 6*');
    assert.equal(Texto.html('2 * 3 = 6'), '2 * 3 = 6');
});

test('o texto é escapado: nada de HTML do professor entra na folha', () => {
    assert.equal(Texto.html('<b>x</b> & y'), '&lt;b&gt;x&lt;/b&gt; &amp; y');
});

test('palavras dividem por espaço e uma fatia junta de novo', () => {
    const p = Texto.palavras('um *dois três* quatro');
    assert.equal(p.length, 4);
    assert.equal(Texto.palavrasHtml(p, 1, 3), '<em>dois</em> <em>três</em>');
    assert.equal(Texto.semMarcas('**A** b'), 'A b');
    assert.deepEqual(Texto.paragrafos('linha 1\n\n  linha 2  \n'), ['linha 1', 'linha 2']);
});

/* ===== modelos ===== */

test('o modelo bimestral é fixo, vem primeiro e não se altera', () => {
    const lista = Modelos.listar();
    assert.equal(lista[0].id, Modelos.FIXO_ID);
    assert.equal(lista[0].fixo, true);
    assert.equal(lista[0].layout.cabecalho, 'faixa');
    assert.equal(lista[0].layout.gabarito, true);
    assert.equal(lista[0].layout.colunas, 2);
    assert.throws(() => Modelos.salvar(lista[0]));
    assert.throws(() => Modelos.apagar(Modelos.FIXO_ID));
});

test('a Avaliação Parcial vem de exemplo e é editável', () => {
    const parcial = Modelos.obter('parcial');
    assert.ok(parcial);
    assert.ok(!parcial.fixo);
    parcial.layout.colunas = 1;
    Modelos.salvar(parcial);
    assert.equal(Modelos.obter('parcial').layout.colunas, 1);
});

test('modelo novo, salvo e apagado', () => {
    const salvo = Modelos.salvar({ nome: 'Recuperação', secoesIniciais: ['PARTE I'], layout: { colunas: 1 } });
    assert.equal(Modelos.obter(salvo.id).nome, 'Recuperação');
    assert.equal(Modelos.obter(salvo.id).layout.alternativas, 5, 'campo não dito vem do padrão');
    Modelos.apagar(salvo.id);
    assert.equal(Modelos.obter(salvo.id), null);
});

test('prova bimestral nasce com as disciplinas da área e o nome da avaliação', () => {
    const p = Modelos.criarProva(Modelos.obter(Modelos.FIXO_ID), { serie: '2', componente: 'NAT' });
    assert.deepEqual(p.secoes.map((s) => s.titulo), ['BIOLOGIA', 'FÍSICA', 'QUÍMICA']);
    assert.equal(p.titulo, 'Avaliação Bimestral de Ciências da Natureza');
    assert.equal(p.fixo, true);
});

test('a prova do modelo fixo segue o formato atual, mesmo com layout velho guardado', () => {
    const p = Modelos.criarProva(Modelos.obter(Modelos.FIXO_ID));
    p.layout.colunas = 1;
    assert.equal(Modelos.layoutDaProva(p).colunas, 2);
    Modelos.tornarLivre(p);
    p.layout.colunas = 1;
    assert.equal(Modelos.layoutDaProva(p).colunas, 1);
});

test('numeração, letras e nome do arquivo', () => {
    assert.equal(Modelos.numero(1, '01.'), '01.');
    assert.equal(Modelos.numero(12, '1.'), '12.');
    assert.equal(Modelos.numero(3, 'QUESTÃO 01'), 'QUESTÃO 03');
    assert.equal(Modelos.letra(0, 'a)'), 'a)');
    assert.equal(Modelos.letra(4, '(A)'), '(E)');
    const p = Modelos.criarProva(Modelos.obter(Modelos.FIXO_ID), { serie: '2', componente: 'NAT', ano: '2026', bimestre: 'B3' });
    assert.equal(Modelos.nomeArquivo(p), 'PROVA-2026-B3-2S-NAT');
});

test('pendências apontam alternativa vazia e resposta não marcada', () => {
    const p = Modelos.criarProva(Modelos.obter(Modelos.FIXO_ID));
    const q = Modelos.novaQuestao('objetiva', 5);
    q.enunciado = 'Pergunta';
    q.alternativas = ['a', 'b', '', 'd', 'e'];
    p.secoes[0].questoes.push(q);
    const avisos = Modelos.pendencias(p);
    assert.ok(avisos.some((a) => /01: 1 alternativa vazia/.test(a)));
    assert.ok(avisos.some((a) => /01 sem a resposta certa/.test(a)));
});

/* ===== gabarito ===== */

test('a grade repete o desenho da prova bimestral: 1 a 14, 15 a 40, 41 em diante', () => {
    const g = Gabarito.distribuir(45);
    assert.ok(g.cabeu);
    const coluna = (n) => g.questoes[n - 1].coluna;
    assert.equal(coluna(14), 0);
    assert.equal(coluna(15), 1);
    assert.equal(coluna(40), 1);
    assert.equal(coluna(41), 2);
    /* cabeçalho no topo de cada coluna e a cada bloco de cinco */
    assert.ok(g.cabecalhos.some((c) => c.coluna === 1 && c.linha === 0));
    assert.equal(g.questoes[14].linha, 1, 'a 15 vem logo abaixo do cabeçalho da coluna');
    assert.equal(g.questoes[19].linha, 6, 'de 15 a 20 sob um cabeçalho só, como na prova da escola');
    assert.equal(g.questoes[39].linha, 30, 'a 40 fecha a segunda coluna');
});

test('nenhuma linha passa do fim da coluna e a capacidade é respeitada', () => {
    const cap = Gabarito.capacidade();
    assert.ok(cap >= 60, 'cabe uma prova grande: ' + cap);
    const g = Gabarito.distribuir(cap);
    assert.ok(g.cabeu);
    g.questoes.forEach((q) => assert.ok(q.linha < 31));
    assert.equal(Gabarito.distribuir(cap + 1).cabeu, false);
});

test('o SVG tem as marcas, as bolhas e o rótulo, em milímetros', () => {
    const svg = Gabarito.svg({ total: 10, alternativas: 5, rotulo: ['2º Ano', 'C.N.'], discursivas: [10] });
    assert.match(svg, /width="86.6mm"/);
    assert.equal((svg.match(/class="marca"/g) || []).length, 4 * 7, 'quatro fileiras de sete marcas');
    /* 20 bolhas do número da lista + 9 questões × 5 */
    assert.equal((svg.match(/<circle/g) || []).length, 20 + 9 * 5);
    assert.match(svg, />C\.N\.</);
    assert.match(svg, />discursiva</);
    assert.ok(Gabarito.LARGURA_MM <= 87, 'cabe numa coluna de 8,7 cm');
});

/* ===== colar questões ===== */

const exemplo = fs.readFileSync(path.join(__dirname, 'questoes-exemplo.txt'), 'utf8');

test('lê as questões da prova de exemplo, com seção, fonte e alternativas', () => {
    const r = Importar.ler(exemplo, { alternativas: 5 });
    assert.equal(r.total, 11);
    assert.equal(r.secoes.length, 1);
    assert.equal(r.secoes[0].titulo, 'BIOLOGIA');
    const q1 = r.secoes[0].questoes[0];
    assert.equal(q1.fonte, 'Uece');
    assert.match(q1.enunciado, /^Dentre as características/);
    assert.equal(q1.alternativas.length, 5);
    assert.equal(q1.correta, 'D');
    assert.deepEqual(r.avisos, []);
});

test('a lista "1. 2. 3." e as letras a) b) do enunciado não viram questão nem alternativa', () => {
    const q5 = Importar.ler(exemplo).secoes[0].questoes[4];
    assert.equal(q5.fonte, 'PUCC-SP');
    assert.match(q5.enunciado, /1\. esquistossomose;/);
    assert.match(q5.enunciado, /\nb\) ingestão de cisticercos;/);
    assert.match(q5.enunciado, /A associação correta entre I e II é:$/);
    assert.equal(q5.alternativas[0], '1-d; 2-b; 3-a; 4-c.');
    assert.equal(q5.alternativas.length, 5);
});

test('linha quebrada pelo PDF é emendada; alternativas numa linha só são separadas', () => {
    const r = Importar.ler('1. O texto começa aqui e\ncontinua aqui.\na) um b) dois c) três d) quatro e) cinco');
    const q = r.secoes[0].questoes[0];
    assert.equal(q.enunciado, 'O texto começa aqui e continua aqui.');
    assert.deepEqual(q.alternativas, ['um', 'dois', 'três', 'quatro', 'cinco']);
});

test('questão sem alternativas vira discursiva; texto-base antes da questão entra nela', () => {
    const r = Importar.ler('TEXTO I\nUm texto de apoio.\n1. Explique o texto.\n2. (Autoral) Qual a ideia?\na) x\nb) y');
    const [q1, q2] = r.secoes[0].questoes;
    assert.equal(q1.tipo, 'discursiva');
    assert.match(q1.enunciado, /^TEXTO I\nUm texto de apoio\.\nExplique o texto\.$/);
    assert.equal(q2.fonte, 'Autoral');
    assert.equal(q2.tipo, 'objetiva');
});

/* ===== aparência, ícones, versão B, texto de apoio ===== */

test('Times New Roman 10 é o padrão, inclusive no modelo fixo', () => {
    const fixo = Modelos.obter(Modelos.FIXO_ID);
    assert.equal(fixo.layout.fonte, 'times');
    assert.equal(fixo.layout.corpoPt, 10);
    assert.equal(Modelos.completarLayout({}).fonte, 'times');
    assert.equal(Modelos.completarLayout({}).corpoPt, 10);
    assert.equal(Modelos.completarLayout({ fonte: 'comic' }).fonte, 'times', 'fonte desconhecida volta ao padrão');
});

test('no modelo fixo a fonte, o tamanho e o gabarito se ajustam; o resto não', () => {
    const p = Modelos.criarProva(Modelos.obter(Modelos.FIXO_ID));
    p.ajustes.fonte = 'arial';
    p.ajustes.corpoPt = 11;
    p.ajustes.gabarito = false;
    p.ajustes.colunas = 1; /* não é ajustável: ignorado */
    const l = Modelos.layoutDaProva(p);
    assert.equal(l.fonte, 'arial');
    assert.equal(l.corpoPt, 11);
    assert.equal(l.gabarito, false);
    assert.equal(l.colunas, 2);
});

test('prova guardada por versão antiga ganha os campos novos', () => {
    const antiga = { fixo: true, modeloId: Modelos.FIXO_ID, secoes: [{ titulo: 'BIOLOGIA', questoes: [{ id: 'q1', tipo: 'objetiva', enunciado: 'x', alternativas: ['a'], imagem: { src: 'data:image/png;base64,AA', w: 10, h: 5, largura: 60 } }] }] };
    Modelos.normalizarProva(antiga);
    const q = antiga.secoes[0].questoes[0];
    assert.equal(q.imagens.length, 1);
    assert.equal(q.imagens[0].largura, 60);
    assert.equal(q.imagens[0].posicao, 'abaixo');
    assert.equal(q.imagem, undefined);
    assert.equal(q.disposicao, 'auto');
    assert.equal(antiga.secoes[0].icone, 'auto');
    assert.equal(antiga.ajustes.fonte, 'times');
});

test('texto de apoio não leva número nem entra na contagem', () => {
    const p = Modelos.criarProva(Modelos.obter(Modelos.FIXO_ID));
    const t = Modelos.novaQuestao('texto');
    t.enunciado = 'TEXTO I';
    const q = Modelos.novaQuestao('objetiva', 5);
    q.enunciado = 'Pergunta';
    p.secoes[0].questoes.push(t, q);
    const lista = Modelos.questoesNumeradas(p);
    assert.equal(lista.length, 1);
    assert.equal(lista[0].questao, q);
    assert.equal(lista[0].numero, 1);
});

test('ícone da disciplina sai do título da seção', () => {
    assert.equal(Icones.detectar('BIOLOGIA'), 'biologia');
    assert.equal(Icones.detectar('Física'), 'fisica');
    assert.equal(Icones.detectar('EDUCAÇÃO FÍSICA'), 'edfisica');
    assert.equal(Icones.detectar('LÍNGUA PORTUGUESA'), 'portugues');
    assert.equal(Icones.detectar('Língua Inglesa'), 'linguas');
    assert.equal(Icones.detectar('PARTE I'), null, 'PARTE não é ARTE');
    assert.equal(Icones.resolver('nenhum', 'BIOLOGIA'), null);
    assert.equal(Icones.resolver('quimica', 'BIOLOGIA'), 'quimica');
    assert.match(Icones.svg('biologia'), /^<svg[^>]+viewBox="0 0 24 24"/);
    Object.keys(Modelos.COMPONENTES).forEach((c) => Modelos.COMPONENTES[c].secoes.forEach((s) => {
        assert.ok(Icones.detectar(s), 'toda disciplina da escola tem ícone: ' + s);
    }));
});

test('versão B troca a ordem das alternativas e leva a resposta certa junto', () => {
    const p = Modelos.criarProva(Modelos.obter(Modelos.FIXO_ID));
    const q = Modelos.novaQuestao('objetiva', 5);
    q.alternativas = ['um', 'dois', 'três', 'quatro', 'cinco'];
    q.correta = 'C';
    const presa = Modelos.novaQuestao('objetiva', 5);
    presa.alternativas = ['x', 'y', 'z', 'w', 'todas as anteriores'];
    p.secoes[0].questoes.push(q, presa);
    let semente = 7;
    const r = Modelos.versaoEmbaralhada(p, 'B', () => ((semente = (semente * 9301 + 49297) % 233280) / 233280));
    const q2 = r.prova.secoes[0].questoes[0];
    assert.notDeepEqual(q2.alternativas, q.alternativas);
    assert.deepEqual([...q2.alternativas].sort(), [...q.alternativas].sort());
    assert.equal(q2.alternativas['ABCDE'.indexOf(q2.correta)], 'três');
    assert.deepEqual(r.prova.secoes[0].questoes[1].alternativas, presa.alternativas, '"todas as anteriores" fica na ordem');
    assert.deepEqual(r.presas, [2]);
    assert.match(r.prova.titulo, /Tipo B$/);
    assert.notEqual(r.prova.id, p.id);
    assert.deepEqual(q.alternativas, ['um', 'dois', 'três', 'quatro', 'cinco'], 'a original não muda');
});
