/* Dados fictícios para o professor experimentar sem aluno real e sem gravar no servidor. */
(function (global) {
    'use strict';

    const ENUNCIADOS = [
        'Todo ser vivo é formado por uma ou mais células. Essa ideia faz parte da',
        'Uma bactéria é um ser formado por uma célula sem núcleo organizado. Esse tipo de célula se chama',
        'Qual organela é a principal responsável pela respiração celular, processo que libera energia para a célula?',
        'Em uma célula de folha, a fotossíntese acontece principalmente no',
        'A membrana plasmática envolve a célula e controla o que entra e o que sai. Essa função é chamada de',
        'O material genético (DNA) de uma célula eucariótica fica guardado, em especial, no',
        'A parede celular, firme e externa à membrana, é típica das células',
        'O vacúolo é uma estrutura de reserva, grande e cheia de líquido, bem visível na célula',
        'Os lisossomos, vesículas presentes no citoplasma, atuam principalmente na',
        'Uma diferença importante entre célula animal e célula vegetal é que somente a vegetal possui'
    ];
    const GAB_CN = ['B', 'C', 'D', 'C', 'A', 'D', 'B', 'B', 'C', 'C'];
    const NOMES = [
        'Estudante Fictício 01', 'Estudante Fictício 02', 'Estudante Fictício 03',
        'Estudante Fictício 04', 'Estudante Fictício 05', 'Estudante Fictício 06'
    ];

    function gabaritoDe(letras) {
        const g = {};
        letras.forEach(function (L, i) { g[i + 1] = L; });
        return g;
    }

    function respostasDe(gabarito, certas, troca) {
        const r = {};
        Object.keys(gabarito).forEach(function (q, i) {
            const valor = i < certas ? gabarito[q] : (troca || 'A');
            r[q] = { valor: valor === gabarito[q] && i >= certas ? 'E' : valor, status: 'marcada' };
            if (r[q].valor === gabarito[q] && i >= certas) r[q].valor = gabarito[q] === 'A' ? 'B' : 'A';
        });
        return r;
    }

    function montar() {
        const Codigo = global.MontarCodigo;
        const cn = {
            id: 'demo-cn',
            titulo: 'Avaliação Bimestral de Ciências da Natureza',
            componente: 'NAT',
            componenteNome: 'Ciências da Natureza',
            serie: '1',
            bimestre: 'B1',
            ano: '2026',
            situacao: 'travada',
            codigoVerificacao: true,
            prazoNotas: '2026-11-25',
            alternativas: 5,
            gabarito: gabaritoDe(GAB_CN),
            secoes: [{ id: 's-bio', titulo: 'BIOLOGIA', responsavel: 'prof-demo' }],
            turmasCodigo: [
                { turma: '1º A', sala: '12', quantidade: 4 },
                { turma: '1º B', sala: '14', quantidade: 2 }
            ]
        };
        const pacote = Codigo.gerarPacote(cn, ENUNCIADOS.map(function (en, i) {
            return { numero: i + 1, questao: { tipo: 'objetiva', enunciado: en } };
        }));
        cn.codigos = pacote.copias;
        cn.alunos = pacote.copias.map(function (c, i) {
            return {
                id: 'al-' + c.copiaId,
                nome: NOMES[i] || ('Estudante Fictício ' + String(i + 1).padStart(2, '0')),
                turma: c.turma,
                sala: c.sala,
                lista: c.lista,
                copiaId: c.copiaId,
                codigo: c.codigo
            };
        });

        const mat = {
            id: 'demo-mat',
            titulo: 'Avaliação Bimestral de Matemática',
            componente: 'MAT',
            componenteNome: 'Matemática',
            serie: '1',
            bimestre: 'B1',
            ano: '2026',
            situacao: 'travada',
            codigoVerificacao: false,
            prazoNotas: '2026-11-25',
            alternativas: 5,
            gabarito: gabaritoDe(['C', 'A', 'B', 'D', 'E', 'A', 'C', 'B']),
            secoes: [{ id: 's-mat', titulo: 'MATEMÁTICA', responsavel: 'prof-demo' }],
            turmasCodigo: [{ turma: '1º A', sala: '12', quantidade: 3 }],
            codigos: [],
            alunos: [1, 2, 3].map(function (n) {
                return {
                    id: 'al-mat-' + n,
                    nome: 'Estudante Fictício ' + String(n).padStart(2, '0'),
                    turma: '1º A', sala: '12', lista: n, copiaId: '1º A-' + String(n).padStart(2, '0'), codigo: null
                };
            })
        };

        const a = cn.alunos;
        const leituras = [
            leitura(cn, a[0], respostasDe(cn.gabarito, 10), a[0].codigo, 'correto'),
            leitura(cn, a[1], respostasDe(cn.gabarito, 7), 'AAAAAA', 'incorreto'),
            leitura(cn, a[2], respostasDe(cn.gabarito, 6), '______', 'em_branco'),
            (function () {
                const r = respostasDe(cn.gabarito, 8);
                r[3] = { valor: 'D', status: 'ambigua', duvidosas: ['D', 'C'] };
                const l = leitura(cn, a[3], r, a[3].codigo, 'correto');
                l.alertas.push({ tipo: 'fraca', campo: 'q3', detalhe: 'Marca fraca na questão 3.' });
                l.revisar = true;
                return l;
            })(),
            leitura(mat, mat.alunos[0], respostasDe(mat.gabarito, 8), null, null),
            leitura(mat, mat.alunos[1], respostasDe(mat.gabarito, 5), null, null)
        ];
        const recuperacoes = {};
        recuperacoes[leituras[1].id] = {
            leituraId: leituras[1].id, provaId: cn.id, status: 'recuperada',
            modalidade: 'a_tarefa', prazo: cn.prazoNotas, obs: 'Tarefa fictícia entregue. A nota do app continua com o −1.'
        };
        recuperacoes[leituras[2].id] = { leituraId: leituras[2].id, provaId: cn.id, status: 'aberta', modalidade: null, prazo: cn.prazoNotas, obs: '' };

        return {
            professor: { id: 'prof-demo', nome: 'Professora Fictícia', primeiro: 'Professora', papel: 'professor', area: 'NAT' },
            provas: [cn, mat],
            leituras: leituras,
            recuperacoes: recuperacoes
        };
    }

    function leitura(prova, aluno, respostas, codigoLido, status) {
        return {
            id: 'lei-' + prova.id + '-' + aluno.lista + '-' + aluno.turma,
            provaId: prova.id,
            alunoId: aluno.id,
            nome: aluno.nome,
            turma: aluno.turma,
            sala: aluno.sala,
            lista: aluno.lista,
            copiaId: aluno.copiaId,
            respostas: respostas,
            codigoLido: codigoLido,
            statusCodigo: status,
            alertas: [],
            revisar: false,
            lidoEm: '2026-11-20T10:00:00',
            imagemExpira: null,
            confianca: 0.9
        };
    }

    global.MaluDemo = { montar: montar };
})(typeof globalThis !== 'undefined' ? globalThis : this);
