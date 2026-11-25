/* Malu Gabaritos — quem é a folha. O QR da prova manda.

   Cada folha tem o QR do Identificador de Provas: ele diz de qual prova é, de
   qual turma e de qual número da lista. Por isso a correção é em dois passos,
   sempre na mesma ordem: primeiro o QR, depois o gabarito.

   - O QR vira a "identidade" da folha. Sem identidade, a leitura do gabarito
     nem começa.
   - A identidade vale para uma leitura só. Depois de registrar, ela é apagada:
     o QR de um aluno nunca vai parar na folha do aluno seguinte.
   - O QR tem de ser da prova que está aberta. QR de outra prova não vira
     identidade.
   - O número da lista marcado nas bolhas, quando existe, só confere: se não
     bate com o QR, a leitura vai para revisão e vale o QR.

   Nada aqui mexe na tela. A câmera e as telas ficam em app.js. */
(function (global) {
    'use strict';

    var Qr = global.MaluQrProva || (typeof require === 'function' ? require('./qrprova.js') : null);

    /* O QR é lido de novo a cada 0,7 s enquanto está no quadro. Passado este
       tempo sem aparecer, a identidade some e o QR tem de ser mostrado de novo. */
    var VALIDADE_QR_MS = 6000;
    var ESTAVEIS = 3;
    var NITIDEZ_MINIMA = 12;

    /* Uma leitura em que a maioria das bolhas saiu "dupla" não é uma folha: é o
       leitor tomando outra coisa por cartão (o QR de perto, por exemplo, tem
       quadradinhos que parecem as marcas). Folha de verdade quase não tem marca
       dupla. */
    var LIMITE_DUPLAS = 0.4;

    function leituraPlausivel(lido) {
        if (!lido || !lido.ok) return false;
        var grupos = Object.keys(lido.respostas || {}).map(function (q) { return lido.respostas[q].status; });
        if (lido.codigo && lido.codigo.posicoes) grupos = grupos.concat(lido.codigo.posicoes.map(function (c) { return c.status; }));
        if (!grupos.length) return true;
        var duplas = grupos.filter(function (s) { return s === 'dupla'; }).length;
        return duplas / grupos.length <= LIMITE_DUPLAS;
    }

    var COMPONENTES = {
        LIN: 'Linguagens e Códigos', NAT: 'Ciências da Natureza', HUM: 'Ciências Humanas',
        MAT: 'Matemática', RED: 'Redação'
    };

    function digitos(valor) { return String(valor == null ? '' : valor).replace(/\D/g, ''); }

    /* MLS-2026-B3-1A-007-LIN-DRYT → de que prova e de que turma o QR é. */
    function provaDoQr(qr) {
        var p = String(qr && qr.codigo || '').toUpperCase().split('-');
        if (p.length !== 7 || p[0] !== 'MLS') return null;
        return {
            ano: p[1], bimestre: digitos(p[2]), turma: p[3], numero: p[4],
            componente: p[5], serie: digitos(p[3]).charAt(0)
        };
    }

    function nomeComponente(sigla, nomeCompleto) {
        return nomeCompleto || COMPONENTES[sigla] || sigla || '?';
    }

    function descricao(componente, bimestre, ano, serie) {
        return componente + ', ' + (bimestre ? bimestre + 'º bimestre' : 'bimestre ?') + ' de ' + (ano || '?') +
            (serie ? ', ' + serie + 'ª série' : '');
    }

    /* Chave da prova no Montador: os 8 primeiros caracteres do id (uuid), em
       maiúsculas. Prova de demonstração ou só do navegador não tem. */
    function chaveDaProva(id) {
        var s = String(id || '');
        return /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(s) ? s.replace(/-/g, '').slice(0, 8).toUpperCase() : '';
    }

    /* Entre as provas, a do QR: a que tem a mesma chave. */
    function provaPeloQr(qr, provas) {
        if (!qr || !qr.chave) return null;
        return (provas || []).filter(function (p) { return (p.chave || chaveDaProva(p.id)) === qr.chave; })[0] || null;
    }

    /* O QR é da prova aberta?
       Com a chave dos dois lados, a chave decide: é a única coisa que separa duas
       provas com os mesmos ano, bimestre, série e componente (uma segunda chamada,
       por exemplo). Sem chave de um dos lados, compara ano, bimestre, componente
       e série (a série só quando a prova a informa); se a prova tem chave e o QR
       não, o QR é de antes da chave e fica marcado para revisão. */
    function conferirProva(qr, prova) {
        var d = provaDoQr(qr);
        if (!d) return { ok: false, motivo: 'Não entendi o código desse QR.' };
        if (!prova) return { ok: true };
        var esperada = {
            ano: String(prova.ano || ''), bimestre: digitos(prova.bimestre),
            componente: String(prova.componente || '').toUpperCase(), serie: digitos(prova.serie)
        };
        var chaveDaAberta = prova.chave || chaveDaProva(prova.id);
        if (qr.chave && chaveDaAberta) {
            if (qr.chave === chaveDaAberta) return { ok: true };
            return {
                ok: false,
                motivo: 'Este QR é de outra prova: ' +
                    descricao(nomeComponente(d.componente), d.bimestre, d.ano, d.serie) + ' (chave ' + qr.chave +
                    '). A prova aberta é ' +
                    descricao(nomeComponente(esperada.componente, prova.componenteNome), esperada.bimestre, esperada.ano, esperada.serie) +
                    ' (chave ' + chaveDaAberta + ').'
            };
        }
        var difere = (esperada.ano && esperada.ano !== d.ano) ||
            (esperada.bimestre && esperada.bimestre !== d.bimestre) ||
            (esperada.componente && esperada.componente !== d.componente) ||
            (esperada.serie && esperada.serie !== d.serie);
        if (!difere) return { ok: true, semChave: !!chaveDaAberta && !qr.chave };
        return {
            ok: false,
            motivo: 'Este QR é de outra prova: ' +
                descricao(nomeComponente(d.componente), d.bimestre, d.ano, d.serie) +
                '. A prova aberta é ' +
                descricao(nomeComponente(esperada.componente, prova.componenteNome), esperada.bimestre, esperada.ano, esperada.serie) + '.'
        };
    }

    /* O aluno do QR na lista desta prova. A turma do QR é obrigatória: o mesmo
       número existe em outra turma. */
    function alunoDoQr(alunos, qr) {
        var n = parseInt(qr.numero, 10);
        var curta = qr.turma ? Qr.turmaCurta(qr.turma) : '';
        return (alunos || []).filter(function (a) {
            return Number(a.lista) === n && (!curta || Qr.turmaCurta(a.turma) === curta);
        })[0] || null;
    }

    /* Quem é, qual é o número da lista e o que merece revisão.
       entrada: { qr, listaMarcada, alunos, exigirChave }
       exigirChave: a prova tem chave, então um QR sem chave é de antes dela. */
    function resolver(entrada) {
        var qr = entrada.qr;
        var marcada = entrada.listaMarcada;
        var temMarcada = marcada != null && marcada !== '';
        var alertas = [];
        var aluno = null;
        var lista = null;
        var origem = 'lista';
        if (qr) {
            origem = 'qr';
            lista = parseInt(qr.numero, 10);
            aluno = alunoDoQr(entrada.alunos, qr);
            if (!aluno) {
                alertas.push({ tipo: 'aluno', campo: 'lista', detalhe: 'O QR é de ' + qr.turma + ' nº ' + lista + ', que não está na lista desta prova.' });
            }
            if (temMarcada && Number(marcada) !== lista) {
                alertas.push({ tipo: 'lista', campo: 'lista', detalhe: 'O número da lista marcado no cartão (' + marcada + ') não bate com o QR (' + lista + '). Vale o QR.' });
            }
            if (entrada.exigirChave && !qr.chave) {
                alertas.push({ tipo: 'chave', campo: 'qr', detalhe: 'Este QR não tem a chave da prova (foi gerado antes dela existir, ou fora do Montador). Confira se a folha é desta prova.' });
            }
        } else {
            lista = temMarcada ? Number(marcada) : null;
            aluno = Qr.casarAluno(entrada.alunos, lista, null);
        }
        return { aluno: aluno, lista: lista, origem: origem, alertas: alertas, revisar: alertas.length > 0 };
    }

    /* O passo a passo da câmera. Recebe um quadro por vez e diz o que fazer.

       quadro({ agora, qrTexto, ler })
         agora    — hora em milissegundos
         qrTexto  — texto do QR lido neste instante ('' se não houve)
         ler()    — lê o cartão: { lido, nitido } (só é chamada quando o QR já
                    foi mostrado, para não gastar a câmera à toa)
       devolve { acao: 'esperar' | 'registrar', dica, aviso, identidade, lido, qrTexto } */
    function criarFluxo(opcoes) {
        opcoes = opcoes || {};
        var aceitar = opcoes.aceitar || function () { return { ok: true }; };
        var semQr = !!opcoes.semQr;
        var identidade = null;
        var lida = '';        /* QR da folha que acabou de ser registrada */
        var estavel = [];

        function resposta(acao, dica, extra) {
            return Object.assign({ acao: acao, dica: dica, aviso: '', identidade: identidade, lido: null, qrTexto: '' }, extra || {});
        }

        function entregarQr(texto, agora) {
            var qr = Qr.ler(texto);
            if (!qr) return '';
            if (texto === lida) return '';
            if (identidade && identidade.texto === texto) {
                identidade.vistoEm = agora;
                return '';
            }
            var conferido = aceitar(qr);
            if (!conferido.ok) {
                identidade = null;
                estavel = [];
                return conferido.motivo || 'Esse QR não é desta prova.';
            }
            identidade = { texto: texto, qr: qr, vistoEm: agora, nota: conferido.nota || '' };
            estavel = [];
            lida = '';
            return '';
        }

        return {
            semQr: function (valor) { if (valor !== undefined) semQr = !!valor; return semQr; },
            identidade: function () { return identidade; },
            quadro: function (e) {
                var aviso = e.qrTexto ? entregarQr(e.qrTexto, e.agora) : '';
                var folhaJaLida = !!e.qrTexto && e.qrTexto === lida;

                if (identidade && e.agora - identidade.vistoEm > VALIDADE_QR_MS) {
                    identidade = null;
                    estavel = [];
                    aviso = aviso || 'O QR saiu do quadro. Mostre o QR da folha de novo.';
                }

                if (!identidade && !semQr) {
                    estavel = [];
                    return resposta('esperar', folhaJaLida ? 'Folha lida. Mostre o QR da próxima.' : 'Mostre o QR da folha primeiro.', { aviso: aviso });
                }

                var leitura = e.ler();
                var lido = leitura.lido;
                if (!lido.ok || !leituraPlausivel(lido) || leitura.nitido < NITIDEZ_MINIMA) {
                    estavel = [];
                    var tremida = lido.ok && leituraPlausivel(lido);
                    return resposta('esperar', tremida ? 'Chegue mais perto: a foto está tremida.' : 'Enquadre o cartão inteiro, com as marcas pretas visíveis.', { aviso: aviso });
                }

                var chave = (lido.lista && lido.lista.numero) + '|' + (lido.codigo && lido.codigo.texto);
                estavel.push(chave);
                if (estavel.length > ESTAVEIS) estavel.shift();
                if (estavel.length < ESTAVEIS) return resposta('esperar', 'Segure firme…', { aviso: aviso });
                if (!estavel.every(function (x) { return x === chave; })) return resposta('esperar', 'Lendo…', { aviso: aviso });

                var quem = identidade;
                estavel = [];
                identidade = null;
                if (quem) lida = quem.texto;
                return resposta('registrar', 'Lido.', { identidade: quem, lido: lido, qrTexto: quem ? quem.texto : '' });
            }
        };
    }

    var api = {
        VALIDADE_QR_MS: VALIDADE_QR_MS,
        provaDoQr: provaDoQr,
        chaveDaProva: chaveDaProva,
        provaPeloQr: provaPeloQr,
        conferirProva: conferirProva,
        alunoDoQr: alunoDoQr,
        leituraPlausivel: leituraPlausivel,
        resolver: resolver,
        criarFluxo: criarFluxo
    };

    global.MaluIdentificar = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
