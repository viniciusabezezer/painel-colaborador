/* Monta o lote de notas que vai para o Malu Presente.

   Não fala com a rede e não conhece segredo. Quem confere o PCA e
   chama o portal é a função no servidor. */
(function (global) {
    'use strict';

    var AREAS = {
        LIN: 'Linguagens',
        NAT: 'Ciências da Natureza',
        HUM: 'Ciências Humanas',
        MAT: 'Matemática',
        RED: 'Redação'
    };
    var STATUS_OK = { correto: 1, em_branco: 1, incorreto: 1, sem_codigo: 1 };

    function arred(n) { return Math.round(n * 10) / 10; }

    function notaRegistrada(op) {
        if (global.MontarCodigo && global.MontarCodigo.notaDaProva) return global.MontarCodigo.notaDaProva(op);
        op = op || {};
        var total = op.total || 0;
        var base = total ? (op.acertos || 0) / total * 10 : 0;
        if (!op.comCodigo) return { nota: arred(base), ponto: null, base: arred(base) };
        if (op.statusCodigo === 'correto') return { nota: arred(Math.min(10, base + 1)), ponto: 1, base: arred(base) };
        if (op.statusCodigo === 'ambiguo' || !op.statusCodigo) return { nota: null, ponto: null, base: arred(base), pendente: true };
        return { nota: arred(base), ponto: null, base: arred(base) };
    }

    function acertosDe(respostas, gabarito) {
        var acertos = 0;
        var total = 0;
        Object.keys(gabarito || {}).forEach(function (q) {
            total++;
            var r = respostas[q];
            var valor = r && typeof r === 'object' ? r.valor : r;
            var status = r && typeof r === 'object' ? r.status : (valor ? 'marcada' : 'branca');
            if (status === 'marcada' && valor === gabarito[q]) acertos++;
        });
        return { acertos: acertos, total: total };
    }

    function emRevisao(l) {
        if (!l) return false;
        if (l.revisar) return true;
        if (l.alertas && l.alertas.length) return true;
        if (l.statusCodigo === 'ambiguo') return true;
        var resp = l.respostas || {};
        return Object.keys(resp).some(function (q) {
            var r = resp[q];
            return r && (r.status === 'ambigua' || r.status === 'dupla');
        });
    }

    function bloqueia(prova, leitura) {
        if (emRevisao(leitura)) return true;
        if (prova.codigoVerificacao && !STATUS_OK[leitura.statusCodigo]) return true;
        if (leitura.lista == null || leitura.lista === '' || !isFinite(Number(leitura.lista))) return true;
        if (!String(leitura.turma || '').trim()) return true;
        return false;
    }

    function bimestreNumero(v) {
        var n = String(v == null ? '' : v).replace(/\D/g, '');
        return n;
    }

    function dataAplicacao(linha) {
        linha = linha || {};
        var dados = linha.dados || {};
        var marcada = dados.aplicadaEm || dados.aplicada_em || linha.aplicadaEm || linha.aplicada_em || '';
        if (/^\d{4}-\d{2}-\d{2}/.test(String(marcada))) return String(marcada).slice(0, 10);
        var carimbo = linha.atualizada_em || linha.criada_em || '';
        if (/^\d{4}-\d{2}-\d{2}/.test(String(carimbo))) return String(carimbo).slice(0, 10);
        return '';
    }

    /* O código só soma (+1 se certo). Em branco ou errado não tira nada, então
       não há ponto a recuperar: o Malu Presente recebe sempre sem pendência. */
    function notaDoAluno(prova, leitura) {
        var contagem = acertosDe(leitura.respostas || {}, prova.gabarito || {});
        var status = prova.codigoVerificacao ? leitura.statusCodigo : 'sem_codigo';
        var calc = notaRegistrada({
            acertos: contagem.acertos,
            total: contagem.total,
            comCodigo: !!prova.codigoVerificacao,
            statusCodigo: leitura.statusCodigo
        });
        return {
            turma: String(leitura.turma || '').trim(),
            lista: Number(leitura.lista),
            nota: calc.nota,
            status_codigo: status,
            ponto_pendente: false,
            recuperacao: null,
            prazo_recuperacao: null
        };
    }

    function podeEnviar(perfil, prova) {
        if (!perfil || !prova) return false;
        if (perfil.ativo === false) return false;
        return perfil.papel === 'pca' && perfil.area === prova.componente;
    }

    function mensagemRecusa(perfil, prova) {
        if (!perfil) return 'Entre com a sua conta.';
        if (perfil.ativo === false) return 'Sua conta está desativada.';
        if (perfil.papel === 'gestao') return 'A gestão não envia notas. Quem envia é o PCA da área.';
        if (!prova) return 'Prova não encontrada.';
        return 'Só o PCA da área desta prova envia as notas.';
    }

    function resumo(prova, leituras) {
        var lista = leituras || [];
        var bloqueadas = lista.filter(function (l) { return bloqueia(prova, l); });
        var notas = lista.filter(function (l) { return !bloqueia(prova, l); }).map(function (l) {
            return notaDoAluno(prova, l);
        }).filter(function (n) { return n.nota != null && STATUS_OK[n.status_codigo]; });
        notas.sort(function (a, b) {
            if (a.turma < b.turma) return -1;
            if (a.turma > b.turma) return 1;
            return a.lista - b.lista;
        });
        var turmas = {};
        notas.forEach(function (n) {
            if (!turmas[n.turma]) turmas[n.turma] = 0;
            turmas[n.turma]++;
        });
        return {
            bloqueado: bloqueadas.length > 0,
            pendentes: bloqueadas.length,
            quantidade: notas.length,
            turmas: Object.keys(turmas).sort().map(function (nome) { return { turma: nome, notas: turmas[nome] }; }),
            notas: notas
        };
    }

    function montarCorpo(op) {
        op = op || {};
        var prova = op.prova || {};
        var pacote = resumo(prova, op.leituras);
        var area = prova.componenteNome || AREAS[prova.componente] || prova.componente || '';
        return {
            lote_id: op.loteId,
            enviado_por: op.nome || '',
            prova: {
                id: prova.id,
                titulo: prova.titulo || '',
                area: area,
                ano: String(prova.ano == null ? '' : prova.ano),
                bimestre: bimestreNumero(prova.bimestre),
                aplicada_em: dataAplicacao(prova)
            },
            notas: pacote.notas
        };
    }

    function assinatura(notas) {
        return JSON.stringify(notas || []);
    }

    function motivoReenvio(assinaturaAnterior, notas) {
        var agora = assinatura(notas);
        if (!assinaturaAnterior) return 'primeiro';
        if (assinaturaAnterior === agora) return null;
        return 'correcoes';
    }

    function urlNotas(base) {
        return String(base || '').replace(/\/+$/, '') + '/api/integracao/notas-bimestrais';
    }

    function semSegredo(valor, segredo) {
        if (!segredo) return valor;
        var texto = JSON.stringify(valor);
        if (texto.indexOf(segredo) !== -1) {
            return { erro: 'A resposta ao navegador não pode levar o segredo.' };
        }
        return valor;
    }

    async function enviarLote(op) {
        op = op || {};
        var perfil = op.perfil;
        var prova = op.prova;
        if (!podeEnviar(perfil, prova)) {
            return { status: 403, body: { erro: mensagemRecusa(perfil, prova) } };
        }
        if (!prova || prova.situacao !== 'travada') {
            return { status: 409, body: { erro: 'A prova precisa estar fechada no Montador.' } };
        }
        var pacote = resumo(prova, op.leituras);
        if (pacote.bloqueado) {
            return {
                status: 409,
                body: {
                    erro: 'Ainda há ' + pacote.pendentes + (pacote.pendentes === 1 ? ' leitura' : ' leituras') + ' na revisão. Resolva antes de enviar.',
                    pendentes: pacote.pendentes
                }
            };
        }
        if (!pacote.notas.length) {
            return { status: 400, body: { erro: 'Não há nota pronta para enviar.' } };
        }
        var env = op.env || {};
        if (!env.url || !env.token) {
            return { status: 500, body: { erro: 'O envio ao Malu Presente ainda não foi configurado no servidor.' } };
        }
        var loteId = op.loteId;
        var payload = montarCorpo({
            prova: prova,
            leituras: op.leituras,
            loteId: loteId,
            nome: perfil.nome
        });
        var respostaRemota = null;
        var ok = false;
        var erro = null;
        try {
            var resp = await op.fetch(urlNotas(env.url), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: 'Bearer ' + env.token
                },
                body: JSON.stringify(payload)
            });
            respostaRemota = await resp.json();
            ok = !!resp.ok;
            if (!ok) erro = (respostaRemota && respostaRemota.erro) || 'O Malu Presente não aceitou o envio.';
        } catch (e) {
            erro = 'Não consegui falar com o Malu Presente.';
        }
        var sem = (respostaRemota && respostaRemota.sem_correspondencia) || [];
        var registro = {
            lote_id: (respostaRemota && respostaRemota.lote_id) || loteId,
            recebidas: respostaRemota && respostaRemota.recebidas != null ? respostaRemota.recebidas : 0,
            sem_correspondencia: sem,
            assinatura: assinatura(payload.notas),
            ok: ok,
            erro: erro
        };
        if (op.gravar) await op.gravar(registro);
        var saida = {
            lote_id: registro.lote_id,
            recebidas: registro.recebidas,
            sem_correspondencia: registro.sem_correspondencia,
            assinatura: registro.assinatura,
            erro: erro
        };
        return { status: ok ? 200 : 502, body: semSegredo(saida, env.token) };
    }

    function prepararEnvio(bruto) {
        bruto = bruto || {};
        var linha = bruto.prova || {};
        var dados = linha.dados || {};
        var secoes = (bruto.secoes || []).slice().sort(function (a, b) { return a.ordem - b.ordem; });
        var gabarito = {};
        var n = 0;
        secoes.forEach(function (s) {
            (bruto.questoes || []).filter(function (q) { return q.secao_id === s.id; })
                .sort(function (a, b) { return a.ordem - b.ordem; })
                .forEach(function (q) {
                    var tipo = (q.dados && q.dados.tipo) || 'objetiva';
                    if (tipo === 'texto') return;
                    n++;
                    var letra = q.dados && q.dados.correta;
                    if (tipo !== 'discursiva' && letra) gabarito[n] = letra;
                });
        });
        var prova = {
            id: linha.id,
            titulo: linha.titulo || '',
            componente: linha.componente,
            componenteNome: AREAS[linha.componente] || linha.componente,
            ano: linha.ano,
            bimestre: linha.bimestre,
            situacao: linha.situacao,
            codigoVerificacao: !!dados.codigoVerificacao,
            prazoNotas: dados.prazoNotas || bruto.prazoTabela || '',
            aplicadaEm: dataAplicacao(linha),
            dados: dados,
            atualizada_em: linha.atualizada_em,
            criada_em: linha.criada_em,
            gabarito: gabarito
        };
        var leituras = (bruto.leituras || []).map(function (row) {
            return {
                id: row.id,
                turma: row.turma,
                lista: row.lista,
                respostas: row.respostas || {},
                statusCodigo: row.status_codigo,
                alertas: row.alertas || [],
                revisar: (row.alertas || []).length > 0 || row.status_codigo === 'ambiguo'
            };
        });
        return { prova: prova, leituras: leituras };
    }

    /* A demonstração não chama o Malu Presente e não usa segredo. */
    function simular(pacote, loteId) {
        var notas = (pacote && pacote.notas) || [];
        var fora = notas.length ? [notas[notas.length - 1]] : [];
        return {
            status: 200,
            body: {
                lote_id: loteId,
                recebidas: notas.length - fora.length,
                sem_correspondencia: fora.map(function (n) { return { turma: n.turma, lista: n.lista }; }),
                assinatura: assinatura(notas),
                erro: null
            }
        };
    }

    var api = {
        AREAS: AREAS,
        notaRegistrada: notaRegistrada,
        emRevisao: emRevisao,
        podeEnviar: podeEnviar,
        mensagemRecusa: mensagemRecusa,
        resumo: resumo,
        montarCorpo: montarCorpo,
        assinatura: assinatura,
        motivoReenvio: motivoReenvio,
        urlNotas: urlNotas,
        enviarLote: enviarLote,
        prepararEnvio: prepararEnvio,
        simular: simular,
        bimestreNumero: bimestreNumero
    };

    global.MaluPresente = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
