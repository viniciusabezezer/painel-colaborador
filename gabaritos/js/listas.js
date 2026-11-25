/* Lista oficial de alunos, vinda do Malu Presente.

   Este arquivo não fala com a rede e não conhece segredo. Quem confere a
   pessoa e chama o portal é a função no servidor. Os nomes só atravessam:
   não há tabela para eles. */
(function (global) {
    'use strict';

    var TIPOS = { incluir: 1, remover: 1, renumerar: 1, corrigir_nome: 1, remanejar: 1 };

    function semAcento(texto) {
        return String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }

    function normalizar(nome) {
        return semAcento(nome).toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    }

    function turmaCurta(turma) {
        var limpo = semAcento(turma).toUpperCase().replace(/[^A-Z0-9]/g, '');
        var casou = limpo.match(/^([123])(?:ANO|SERIE)?([A-F])$/);
        return casou ? casou[1] + casou[2] : String(turma || '').trim();
    }

    function turmaPresente(turma) {
        var curta = turmaCurta(turma);
        if (/^[123][A-F]$/.test(curta)) return curta.charAt(0) + 'º' + curta.charAt(1);
        return String(turma || '').trim();
    }

    function rotuloPapel(papel) {
        if (papel === 'gestao') return 'Gestão';
        if (papel === 'pca') return 'PCA';
        if (papel === 'professor') return 'Professor';
        return '';
    }

    function podePedir(perfil) {
        if (!perfil || perfil.ativo === false) return false;
        return perfil.papel === 'gestao' || perfil.papel === 'pca' || perfil.papel === 'professor';
    }

    function mensagemRecusa(perfil) {
        if (!perfil) return 'Entre com a sua conta.';
        if (perfil.ativo === false) return 'Sua conta está desativada.';
        return 'Só a gestão, o PCA ou um professor ativo puxa a lista.';
    }

    function solicitanteDe(perfil) {
        return String((perfil && perfil.nome) || 'Sem nome').trim() + ' · ' + rotuloPapel(perfil && perfil.papel);
    }

    function alunosAtivos(alunos) {
        return (alunos || []).filter(function (a) { return a && a.ativo !== false && String(a.nome || '').trim(); });
    }

    function pacoteAtivo(resposta) {
        return {
            ano: resposta && resposta.ano,
            turmas: (resposta && resposta.turmas || []).map(function (t) {
                return {
                    turma: turmaCurta(t.turma),
                    alunos: alunosAtivos(t.alunos).map(function (a) {
                        return { numero: Number(a.numero), nome: String(a.nome).trim(), matricula: a.matricula || null };
                    })
                };
            }).filter(function (t) { return t.alunos.length; })
        };
    }

    /* O texto da caixa de alunos: "NN - Nome". Com opcoes.matricula, quem tem
       matrícula de 4 a 12 dígitos leva "NN - Nome - MATRICULA" (é o que o
       Identificador pede, para a matrícula chegar ao QR; as outras telas não a
       mostram). */
    function textoDaLista(resposta, filtro, opcoes) {
        var comMatricula = !!(opcoes && opcoes.matricula);
        var quer = (filtro || []).map(turmaCurta).filter(Boolean);
        var linhas = [];
        (resposta && resposta.turmas || []).forEach(function (t) {
            var curta = turmaCurta(t.turma);
            if (quer.length && quer.indexOf(curta) === -1) return;
            var ativos = alunosAtivos(t.alunos).slice().sort(function (a, b) { return Number(a.numero) - Number(b.numero); });
            if (!ativos.length) return;
            linhas.push('TURMA ' + curta);
            ativos.forEach(function (a) {
                var linha = String(a.numero).padStart(2, '0') + ' - ' + String(a.nome).trim();
                var matricula = String(a.matricula == null ? '' : a.matricula).trim();
                if (comMatricula && /^\d{4,12}$/.test(matricula)) linha += ' - ' + matricula;
                linhas.push(linha);
            });
            linhas.push('');
        });
        return linhas.join('\n').replace(/\n+$/, '');
    }

    function lerTexto(texto) {
        var turmas = [];
        var atual = null;
        String(texto || '').split(/[\r\n]+/).forEach(function (bruta) {
            var linha = bruta.trim();
            if (!linha) return;
            var titulo = semAcento(linha).toUpperCase().match(/^(?:TURMA|SERIE)\s+(.+)$/);
            if (titulo && turmaCurta(titulo[1])) {
                var curta = turmaCurta(titulo[1]);
                atual = turmas.filter(function (t) { return t.turma === curta; })[0];
                if (!atual) {
                    atual = { turma: curta, alunos: [] };
                    turmas.push(atual);
                }
                return;
            }
            var aluno = linha.match(/^(\d{1,3})\s*[-–—.]\s*(.+)$/);
            if (!aluno || !atual) return;
            var nome = aluno[2].trim();
            /* "07 - Ana Lima - 20260007": a matrícula (4 a 12 dígitos, depois de um traço) */
            var matricula = null;
            var fim = nome.match(/^(.*\S)\s*[-–—]\s*(\d{4,12})$/);
            if (fim && normalizar(fim[1]).length >= 3) {
                nome = fim[1].trim();
                matricula = fim[2];
            }
            if (normalizar(nome).length < 3) return;
            var item = { numero: parseInt(aluno[1], 10), nome: nome };
            if (matricula) item.matricula = matricula;
            atual.alunos.push(item);
        });
        return { turmas: turmas.filter(function (t) { return t.alunos.length; }) };
    }

    function achatar(pacote) {
        var lista = [];
        (pacote && pacote.turmas || []).forEach(function (t) {
            (t.alunos || []).forEach(function (a) {
                if (!a || !String(a.nome || '').trim()) return;
                lista.push({
                    turma: turmaCurta(t.turma),
                    numero: a.numero == null || a.numero === '' ? null : Number(a.numero),
                    nome: String(a.nome).trim(),
                    chave: normalizar(a.nome),
                    matricula: a.matricula || null
                });
            });
        });
        return lista;
    }

    function diferencas(oficial, atual) {
        var antes = achatar(oficial);
        var agora = achatar(atual);
        var usados = {};
        var mudancas = [];

        function achar(pred) {
            for (var i = 0; i < antes.length; i++) {
                if (usados[i]) continue;
                if (pred(antes[i])) return i;
            }
            return -1;
        }

        agora.forEach(function (a) {
            var i = achar(function (b) { return b.turma === a.turma && b.chave === a.chave; });
            if (i === -1) i = achar(function (b) { return b.chave === a.chave; });
            if (i === -1 && a.numero != null) i = achar(function (b) { return b.turma === a.turma && b.numero === a.numero; });
            if (i === -1) {
                mudancas.push({ turma: turmaPresente(a.turma), tipo: 'incluir', numero: a.numero, nome: a.nome });
                return;
            }
            usados[i] = true;
            var b = antes[i];
            var matricula = a.matricula || b.matricula || null;
            if (b.turma !== a.turma) {
                mudancas.push({
                    turma: turmaPresente(b.turma), tipo: 'remanejar', numero: a.numero, nome: a.nome,
                    matricula: matricula, turma_destino: turmaPresente(a.turma)
                });
                return;
            }
            if (b.chave !== a.chave) {
                mudancas.push({
                    turma: turmaPresente(a.turma), tipo: 'corrigir_nome', numero: a.numero, nome: a.nome,
                    matricula: matricula, obs: 'O nome era ' + b.nome + '.'
                });
                return;
            }
            if (b.numero !== a.numero) {
                mudancas.push({
                    turma: turmaPresente(a.turma), tipo: 'renumerar', numero: a.numero, nome: a.nome,
                    matricula: matricula, obs: 'Antes era o número ' + b.numero + '.'
                });
            }
        });
        antes.forEach(function (b, i) {
            if (usados[i]) return;
            mudancas.push({
                turma: turmaPresente(b.turma), tipo: 'remover', numero: b.numero, nome: b.nome, matricula: b.matricula
            });
        });
        return mudancas;
    }

    function agrupar(ano, mudancas) {
        var ordem = [];
        var mapa = {};
        (mudancas || []).forEach(function (m) {
            if (!mapa[m.turma]) {
                mapa[m.turma] = [];
                ordem.push(m.turma);
            }
            var item = { tipo: m.tipo, numero: m.numero, nome: m.nome };
            if (m.matricula) item.matricula = String(m.matricula);
            if (m.turma_destino) item.turma_destino = m.turma_destino;
            if (m.obs) item.obs = m.obs;
            mapa[m.turma].push(item);
        });
        return ordem.map(function (turma) {
            return { turma: turma, ano: String(ano || ''), mudancas: mapa[turma] };
        });
    }

    function mudancasValidas(lista) {
        if (!Array.isArray(lista) || !lista.length || lista.length > 300) return false;
        return lista.every(function (m) {
            if (!m || !TIPOS[m.tipo]) return false;
            if (!String(m.nome || '').trim()) return false;
            if (m.numero != null && m.numero !== '' && !isFinite(Number(m.numero))) return false;
            if (m.tipo === 'remanejar' && !String(m.turma_destino || '').trim()) return false;
            return true;
        });
    }

    function turmasParaGuardar(turmas) {
        return (turmas || []).map(function (t) {
            var numeros = Array.isArray(t.numeros) ? t.numeros.map(Number).filter(function (n) { return n > 0; })
                : (Array.isArray(t.alunos) ? t.alunos.map(function (a) { return Number(a.numero); }).filter(function (n) { return n > 0; }) : []);
            var item = {
                turma: t.turma || '',
                sala: t.sala || '',
                quantidade: numeros.length ? numeros.length : Math.max(0, t.quantidade | 0)
            };
            if (t.professorId) item.professorId = t.professorId;
            if (numeros.length) item.numeros = numeros;
            return item;
        });
    }

    function numerosDaTurma(turma) {
        if (Array.isArray(turma.numeros) && turma.numeros.length) return turma.numeros.map(Number).filter(function (n) { return n > 0; });
        if (Array.isArray(turma.alunos) && turma.alunos.length) {
            return turma.alunos.map(function (a) { return Number(a.numero); }).filter(function (n) { return n > 0; });
        }
        var qtd = Math.max(0, turma.quantidade | 0);
        var seq = [];
        for (var i = 1; i <= qtd; i++) seq.push(i);
        return seq;
    }

    function urlListas(base, ano, turma) {
        var u = String(base || '').replace(/\/+$/, '') + '/api/integracao/listas?ano=' + encodeURIComponent(ano);
        if (turma) u += '&turma=' + encodeURIComponent(turma);
        return u;
    }

    function urlSugestoes(base) {
        return String(base || '').replace(/\/+$/, '') + '/api/integracao/listas/sugestoes';
    }

    function semSegredo(valor, segredo) {
        if (segredo && JSON.stringify(valor).indexOf(segredo) !== -1) {
            return { erro: 'A resposta ao navegador não pode levar o segredo.' };
        }
        return valor;
    }

    async function buscar(op) {
        op = op || {};
        if (!podePedir(op.perfil)) return { status: 403, body: { erro: mensagemRecusa(op.perfil) } };
        var env = op.env || {};
        if (!env.url || !env.token) return { status: 500, body: { erro: 'O Malu Presente ainda não foi configurado no servidor.' } };
        if (!/^\d{4}$/.test(String(op.ano || ''))) return { status: 400, body: { erro: 'Informe o ano com 4 dígitos.' } };
        try {
            var resp = await op.fetch(urlListas(env.url, op.ano, op.turma || ''), {
                method: 'GET',
                headers: { Authorization: 'Bearer ' + env.token, 'X-Solicitante': solicitanteDe(op.perfil) }
            });
            var json = await resp.json();
            if (!resp.ok) return { status: 502, body: semSegredo({ erro: (json && json.erro) || 'O Malu Presente não devolveu a lista.' }, env.token) };
            return { status: 200, body: semSegredo(json, env.token) };
        } catch (e) {
            return { status: 502, body: { erro: 'Não consegui falar com o Malu Presente.' } };
        }
    }

    async function sugerir(op) {
        op = op || {};
        if (!podePedir(op.perfil)) return { status: 403, body: { erro: mensagemRecusa(op.perfil) } };
        var env = op.env || {};
        if (!env.url || !env.token) return { status: 500, body: { erro: 'O Malu Presente ainda não foi configurado no servidor.' } };
        var grupos = op.grupos || [];
        if (!grupos.length) return { status: 400, body: { erro: 'Não há mudança para sugerir.' } };
        var enviadas = 0;
        for (var i = 0; i < grupos.length; i++) {
            var g = grupos[i];
            if (!mudancasValidas(g.mudancas) || !/^\d{4}$/.test(String(g.ano || op.ano || ''))) {
                return { status: 400, body: { erro: 'A sugestão está incompleta.' } };
            }
            var corpo = {
                solicitante: solicitanteDe(op.perfil),
                turma: g.turma,
                ano: String(g.ano || op.ano),
                mudancas: g.mudancas
            };
            try {
                var resp = await op.fetch(urlSugestoes(env.url), {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer ' + env.token,
                        'X-Solicitante': solicitanteDe(op.perfil)
                    },
                    body: JSON.stringify(corpo)
                });
                var json = await resp.json().catch(function () { return {}; });
                if (!resp.ok) return { status: 502, body: semSegredo({ erro: (json && json.erro) || 'O Malu Presente não aceitou a sugestão.' }, env.token) };
                enviadas += g.mudancas.length;
            } catch (e) {
                return { status: 502, body: { erro: 'Não consegui falar com o Malu Presente.' } };
            }
        }
        return { status: 200, body: { ok: true, enviadas: enviadas } };
    }

    function simular(op) {
        op = op || {};
        var todas = [
            { turma: '1ºA', alunos: [
                { numero: 7, nome: 'Estudante Fictício 07', matricula: '20260007', ativo: true },
                { numero: 8, nome: 'Estudante Fictício 08', matricula: '20260008', ativo: true },
                { numero: 9, nome: 'Estudante Fictício 09', matricula: '20260009', ativo: false }
            ] },
            { turma: '1ºB', alunos: [
                { numero: 1, nome: 'Estudante Fictício 01', matricula: '20260011', ativo: true },
                { numero: 2, nome: 'Estudante Fictício 02', matricula: '20260012', ativo: true }
            ] }
        ];
        var curta = op.turma ? turmaCurta(op.turma) : '';
        return {
            ano: String(op.ano || '2026'),
            atualizado_em: '2026-11-20T12:00:00.000Z',
            turmas: curta ? todas.filter(function (t) { return turmaCurta(t.turma) === curta; }) : todas
        };
    }

    var api = {
        podePedir: podePedir,
        mensagemRecusa: mensagemRecusa,
        solicitanteDe: solicitanteDe,
        turmaCurta: turmaCurta,
        turmaPresente: turmaPresente,
        normalizar: normalizar,
        pacoteAtivo: pacoteAtivo,
        textoDaLista: textoDaLista,
        lerTexto: lerTexto,
        diferencas: diferencas,
        agrupar: agrupar,
        mudancasValidas: mudancasValidas,
        turmasParaGuardar: turmasParaGuardar,
        numerosDaTurma: numerosDaTurma,
        urlListas: urlListas,
        urlSugestoes: urlSugestoes,
        buscar: buscar,
        sugerir: sugerir,
        simular: simular
    };

    global.MaluListas = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
