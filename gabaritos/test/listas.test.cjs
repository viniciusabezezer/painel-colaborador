const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.join(__dirname, '..', '..');
const Listas = require(path.join(raiz, 'gabaritos', 'js', 'listas.js'));
const Codigo = require(path.join(raiz, 'montar', 'js', 'codigo.js'));
const ProvasLista = require(path.join(raiz, 'provas', 'js', 'lista.js'));

const gestao = { nome: 'Gestão Fictícia', papel: 'gestao', ativo: true };
const pca = { nome: 'Coordenadora Fictícia', papel: 'pca', area: 'NAT', ativo: true };
const professor = { nome: 'Professor Fictício', papel: 'professor', area: 'NAT', ativo: true };

test('gestão, PCA e professor ativo podem pedir a lista; conta inativa não', function () {
    assert.equal(Listas.podePedir(gestao), true);
    assert.equal(Listas.podePedir(pca), true);
    assert.equal(Listas.podePedir(professor), true);
    assert.equal(Listas.podePedir(Object.assign({}, professor, { ativo: false })), false);
    assert.match(Listas.mensagemRecusa({ papel: 'aluno', ativo: true }), /gestão, o PCA ou um professor/);
});

test('o texto puxado é o mesmo formato do colar e ignora quem está inativo', function () {
    const resposta = Listas.simular({ ano: '2026', turma: '1ºA' });
    const texto = Listas.textoDaLista(resposta);
    assert.match(texto, /^TURMA 1A\n07 - Estudante Fictício 07\n08 - Estudante Fictício 08$/);
    assert.equal(texto.includes('Fictício 09'), false);
    const lote = ProvasLista.lerLote(texto);
    assert.equal(lote.turmas.length, 1);
    assert.equal(lote.turmas[0].turma, '1A');
    assert.deepEqual(lote.turmas[0].alunos.map(function (a) { return a.numero; }), [7, 8]);
    assert.equal(lote.turmas[0].alunos[0].nome, 'Estudante Fictício 07');
});

test('incluir, remover, renumerar, corrigir o nome e remanejar', function () {
    const oficial = Listas.pacoteAtivo(Listas.simular({ ano: '2026' }));
    const atual = {
        turmas: [
            { turma: '1A', alunos: [
                { numero: 7, nome: 'Estudante Fictício 07' },
                { numero: 4, nome: 'Estudante Fictício 02' },
                { numero: 10, nome: 'Estudante Fictício 10' }
            ] },
            { turma: '1B', alunos: [
                { numero: 1, nome: 'Estudante Fictício Um' }
            ] }
        ]
    };
    const tipos = Listas.diferencas(oficial, atual).map(function (m) { return m.tipo + ':' + m.nome; }).sort();
    assert.deepEqual(tipos, [
        'corrigir_nome:Estudante Fictício Um',
        'incluir:Estudante Fictício 10',
        'remanejar:Estudante Fictício 02',
        'remover:Estudante Fictício 08'
    ]);
    const ida = Listas.diferencas(oficial, atual).filter(function (m) { return m.tipo === 'remanejar'; })[0];
    assert.equal(ida.turma, '1ºB');
    assert.equal(ida.turma_destino, '1ºA');
    assert.equal(ida.matricula, '20260012');
    const grupos = Listas.agrupar('2026', Listas.diferencas(oficial, atual));
    assert.equal(Listas.mudancasValidas(grupos[0].mudancas), true);
});

test('renumerar o mesmo aluno não muda o nome', function () {
    const oficial = { turmas: [{ turma: '1A', alunos: [{ numero: 7, nome: 'Estudante Fictício 07', matricula: '20260007' }] }] };
    const atual = { turmas: [{ turma: '1A', alunos: [{ numero: 12, nome: 'Estudante Fictício 07' }] }] };
    const m = Listas.diferencas(oficial, atual);
    assert.equal(m.length, 1);
    assert.equal(m[0].tipo, 'renumerar');
    assert.equal(m[0].numero, 12);
    assert.equal(m[0].matricula, '20260007');
    assert.match(m[0].obs, /7/);
});

test('o que vai para o servidor não leva nome nem matrícula', function () {
    const guardado = Listas.turmasParaGuardar([{
        turma: '1ºA', sala: '12', quantidade: 30,
        alunos: [{ numero: 7, nome: 'Estudante Fictício 07', matricula: '20260007' }]
    }]);
    const texto = JSON.stringify(guardado);
    assert.equal(texto.includes('Fictício'), false);
    assert.equal(texto.includes('20260007'), false);
    assert.deepEqual(guardado[0].numeros, [7]);
    assert.equal(guardado[0].quantidade, 1);
});

test('os códigos da prova usam o número oficial, não uma sequência nova', function () {
    const pacote = Codigo.gerarPacote({
        id: 'prova-ficticia',
        turmasCodigo: [{ turma: '1ºA', sala: '12', numeros: [7, 8] }]
    }, [{ numero: 1, questao: { tipo: 'objetiva', enunciado: 'A célula é a unidade da vida e todo ser vivo possui ao menos uma.' } },
        { numero: 2, questao: { tipo: 'objetiva', enunciado: 'A fotossíntese acontece no cloroplasto da célula vegetal.' } },
        { numero: 3, questao: { tipo: 'objetiva', enunciado: 'A respiração celular libera energia para a célula.' } },
        { numero: 4, questao: { tipo: 'objetiva', enunciado: 'A parede celular é típica da célula vegetal.' } },
        { numero: 5, questao: { tipo: 'objetiva', enunciado: 'O vacúolo guarda líquido na célula vegetal.' } },
        { numero: 6, questao: { tipo: 'objetiva', enunciado: 'A membrana controla o que entra na célula.' } },
        { numero: 7, questao: { tipo: 'objetiva', enunciado: 'O ribossomo produz proteínas para a célula.' } }]);
    assert.deepEqual(pacote.copias.map(function (c) { return c.lista; }), [7, 8]);
    assert.equal(JSON.stringify(pacote.copias).includes('Fictício'), false);
});

test('a função manda o token só ao Malu Presente e devolve a lista sem o segredo', async function () {
    const segredo = 'segredo-que-nao-volta';
    let pedido;
    const resultado = await Listas.buscar({
        perfil: professor,
        ano: '2026',
        turma: '1ºA',
        env: { url: 'https://presente.exemplo/', token: segredo },
        fetch: async function (url, init) {
            pedido = { url: url, init: init };
            return { ok: true, json: async function () { return Listas.simular({ ano: '2026', turma: '1ºA' }); } };
        }
    });
    assert.equal(pedido.url, Listas.urlListas('https://presente.exemplo/', '2026', '1ºA'));
    assert.equal(pedido.init.method, 'GET');
    assert.equal(pedido.init.headers.Authorization, 'Bearer ' + segredo);
    assert.equal(pedido.init.headers['X-Solicitante'], 'Professor Fictício · Professor');
    assert.equal(resultado.status, 200);
    assert.equal(resultado.body.turmas[0].alunos[0].nome, 'Estudante Fictício 07');
    assert.equal(JSON.stringify(resultado.body).includes(segredo), false);
});

test('a sugestão sai com o nome de quem pediu e a resposta não traz o segredo nem os nomes de volta', async function () {
    const segredo = 'segredo-que-nao-volta';
    let pedido;
    const resultado = await Listas.sugerir({
        perfil: gestao,
        ano: '2026',
        grupos: Listas.agrupar('2026', [{ tipo: 'incluir', turma: '1ºA', numero: 10, nome: 'Estudante Fictício 10' }]),
        env: { url: 'https://presente.exemplo', token: segredo },
        fetch: async function (url, init) {
            pedido = { url: url, init: init };
            return { ok: true, json: async function () { return { ok: true }; } };
        }
    });
    assert.equal(pedido.url, 'https://presente.exemplo/api/integracao/listas/sugestoes');
    const corpo = JSON.parse(pedido.init.body);
    assert.equal(corpo.solicitante, 'Gestão Fictícia · Gestão');
    assert.equal(corpo.turma, '1ºA');
    assert.equal(corpo.ano, '2026');
    assert.equal(corpo.mudancas[0].tipo, 'incluir');
    assert.equal(pedido.init.headers.Authorization, 'Bearer ' + segredo);
    assert.equal(resultado.body.enviadas, 1);
    assert.equal(JSON.stringify(resultado.body).includes(segredo), false);
    assert.equal(JSON.stringify(resultado.body).includes('Fictício'), false);
});

test('o navegador não recebe o nome dos segredos e as cópias do módulo são iguais', function () {
    const copias = [
        'gabaritos/js/listas.js',
        'montar/js/listas.js',
        'provas/js/listas.js',
        'montar/supabase/functions/presente-listas/listas.js'
    ].map(function (p) { return fs.readFileSync(path.join(raiz, p), 'utf8'); });
    copias.forEach(function (texto) { assert.equal(texto, copias[0]); });
    const funcao = fs.readFileSync(path.join(raiz, 'montar/supabase/functions/presente-listas/index.ts'), 'utf8');
    assert.equal(funcao.includes("Deno.env.get('MALU_PRESENTE_URL')"), true);
    assert.equal(funcao.includes("Deno.env.get('MALU_PRESENTE_TOKEN')"), true);
    ['gabaritos', 'montar/js', 'provas/js'].forEach(function (pasta) {
        const cheio = path.join(raiz, pasta, pasta.endsWith('js') ? 'listas.js' : 'js/listas.js');
        assert.equal(fs.readFileSync(cheio, 'utf8').includes('MALU_PRESENTE_TOKEN'), false);
    });
});
