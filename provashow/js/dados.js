/* Os dados do ProvaShow Malu e as contas em cima deles.

   Tudo fica no navegador do professor (localStorage), num único objeto:
     conjuntos: [{ id, titulo, questoes: [{ id, enunciado, imagem, opcoes: [..], correta: 'A'|null }] }]
     turmas:    [{ id, nome, alunos: [{ id, nome, cartao }], fila: [conjuntoId, ...] }]
     sessoes:   [{ id, turmaId, conjuntoId, questaoId, questao: {cópia}, respostas: { cartao: letra }, data }]
   A sessão guarda uma cópia da questão: editar o conjunto depois não muda o
   que a turma respondeu naquele dia. */
(function (global) {
    'use strict';

    const CHAVE = 'provashow-malu-v1';
    const LETRAS = ['A', 'B', 'C', 'D'];

    function novoId() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    }

    function vazio() {
        return { versao: 1, conjuntos: [], turmas: [], sessoes: [] };
    }

    function exemplo() {
        const e = vazio();
        const conjunto = {
            id: novoId(), titulo: 'Exemplo — aquecimento', questoes: [
                { id: novoId(), enunciado: 'Qual é a capital do Ceará?', imagem: '', opcoes: ['Recife', 'Fortaleza', 'Natal', 'Teresina'], correta: 'B' },
                { id: novoId(), enunciado: 'A água ferve a 100 °C ao nível do mar.', imagem: '', opcoes: ['Verdadeiro', 'Falso'], correta: 'A' },
                { id: novoId(), enunciado: 'Como você está se sentindo com o conteúdo de hoje?', imagem: '', opcoes: ['Entendi tudo', 'Entendi quase tudo', 'Tenho dúvidas', 'Não entendi'], correta: null }
            ]
        };
        e.conjuntos.push(conjunto);
        e.turmas.push({
            id: novoId(), nome: 'Turma de exemplo', fila: [conjunto.id],
            alunos: ['Ana', 'Bruno', 'Carla', 'Davi', 'Eva'].map((nome, i) => ({ id: novoId(), nome, cartao: i + 1 }))
        });
        return e;
    }

    function carregar() {
        try {
            const bruto = global.localStorage && global.localStorage.getItem(CHAVE);
            if (bruto) {
                const d = JSON.parse(bruto);
                if (d && Array.isArray(d.conjuntos)) return Object.assign(vazio(), d);
            }
        } catch (erro) { /* sem armazenamento: começa do exemplo */ }
        return exemplo();
    }

    function salvar(d) {
        try {
            global.localStorage.setItem(CHAVE, JSON.stringify(d));
            return true;
        } catch (erro) {
            return false;
        }
    }

    /* ----- respostas ----- */

    function letraValida(sessao, letra) {
        const i = LETRAS.indexOf(letra);
        if (i < 0) return false;
        return !sessao.questao || i < sessao.questao.opcoes.length;
    }

    /* Só valem cartões de alunos da turma; a última leitura do cartão vale. */
    function registrarResposta(sessao, turma, cartao, letra) {
        const n = Number(cartao);
        if (!turma.alunos.some((a) => a.cartao === n)) return false;
        if (!letraValida(sessao, letra)) return false;
        sessao.respostas[n] = letra;
        return true;
    }

    function contagem(sessao) {
        const n = sessao.questao ? sessao.questao.opcoes.length : 4;
        const c = {};
        LETRAS.slice(0, n).forEach((l) => { c[l] = 0; });
        for (const l of Object.values(sessao.respostas)) if (l in c) c[l]++;
        return c;
    }

    function percentual(a, b) {
        return b ? Math.round(a / b * 100) : null;
    }

    /* Desempenho de cada aluno e de cada pergunta numa lista de sessões. */
    function relatorioTurma(turma, sessoes) {
        const daTurma = sessoes.filter((s) => !turma.id || s.turmaId === turma.id);
        const alunos = turma.alunos.map((a) => {
            let respondidas = 0, avaliadas = 0, acertos = 0;
            for (const s of daTurma) {
                const r = s.respostas[a.cartao];
                if (!r) continue;
                respondidas++;
                if (s.questao.correta) {
                    avaliadas++;
                    if (r === s.questao.correta) acertos++;
                }
            }
            return { id: a.id, nome: a.nome, cartao: a.cartao, respondidas, acertos, avaliadas, percentual: percentual(acertos, avaliadas) };
        });
        const lista = daTurma.map((s) => {
            const respostas = Object.values(s.respostas);
            const acertos = s.questao.correta ? respostas.filter((r) => r === s.questao.correta).length : 0;
            return {
                id: s.id, data: s.data, questao: s.questao, respostas: s.respostas, responderam: respostas.length,
                acertos, percentual: s.questao.correta ? percentual(acertos, respostas.length) : null
            };
        });
        return { alunos, sessoes: lista };
    }

    /* ----- importar texto colado ----- */

    function proximoCartao(usados) {
        let n = 1;
        while (usados.has(n)) n++;
        return n;
    }

    function lerListaAlunos(texto, existentes) {
        const usados = new Set((existentes || []).map((a) => a.cartao));
        const novos = [];
        for (const linha of String(texto).split(/\r?\n/)) {
            const nome = linha.replace(/^\s*\d+\s*[-.)–:]?\s+/, '').replace(/\s+/g, ' ').trim();
            if (!nome) continue;
            const cartao = proximoCartao(usados);
            if (cartao > 63) break;
            usados.add(cartao);
            novos.push({ id: novoId(), nome, cartao });
        }
        return novos;
    }

    function lerQuestoesColadas(texto) {
        const linhas = String(texto).split(/\r?\n/);
        const comNumero = linhas.some((l) => /^\s*\d+\s*[).\-–]\s*\S/.test(l));
        const questoes = [];
        let atual = null;
        const fechar = () => {
            if (atual && atual.enunciado.trim()) {
                atual.enunciado = atual.enunciado.trim();
                if (atual.opcoes.length < 2) atual.opcoes = ['Verdadeiro', 'Falso'].slice(0, Math.max(2, atual.opcoes.length));
                questoes.push(atual);
            }
            atual = null;
        };
        for (const bruta of linhas) {
            const linha = bruta.trim();
            if (!linha) {
                if (!comNumero && atual && atual.opcoes.length) fechar();
                continue;
            }
            const numero = linha.match(/^\d+\s*[).\-–]\s*(.*)$/);
            const opcao = linha.match(/^(\*?)\s*\(?([a-dA-D])\s*[).\-–]\s*(.*)$/);
            const gabarito = linha.match(/^(?:resposta|gabarito|correta)\s*[:=-]\s*\(?([a-dA-D])\b/i);
            if (gabarito && atual) {
                atual.correta = gabarito[1].toUpperCase();
            } else if (opcao && atual && atual.enunciado) {
                if (atual.opcoes.length < 4) {
                    atual.opcoes.push(opcao[3].trim());
                    if (opcao[1]) atual.correta = LETRAS[atual.opcoes.length - 1];
                }
            } else if (numero && comNumero) {
                fechar();
                atual = { id: novoId(), enunciado: numero[1], imagem: '', opcoes: [], correta: null };
            } else {
                if (!atual) atual = { id: novoId(), enunciado: '', imagem: '', opcoes: [], correta: null };
                if (atual.opcoes.length) atual.opcoes[atual.opcoes.length - 1] += ' ' + linha;
                else atual.enunciado += (atual.enunciado ? ' ' : '') + linha;
            }
        }
        fechar();
        return questoes;
    }

    /* Planilha (CSV com ;) do relatório, para abrir no Excel/Planilhas. */
    function csvRelatorio(turma, relatorio) {
        const c = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
        const cab = ['Cartão', 'Aluno', 'Respondidas', 'Acertos', 'Valendo nota', '% de acerto']
            .concat(relatorio.sessoes.map((s, i) => `Q${i + 1}`));
        const linhas = [cab.map(c).join(';')];
        for (const a of relatorio.alunos) {
            const porSessao = relatorio.sessoes.map((s) => {
                const r = s.respostas[a.cartao];
                if (!r) return '';
                return s.questao.correta ? r + (r === s.questao.correta ? ' ✓' : ' ✗') : r;
            });
            linhas.push([a.cartao, a.nome, a.respondidas, a.acertos, a.avaliadas, a.percentual == null ? '' : a.percentual].concat(porSessao).map(c).join(';'));
        }
        return '﻿' + linhas.join('\r\n');
    }

    const Dados = {
        CHAVE, LETRAS, novoId, vazio, exemplo, carregar, salvar,
        registrarResposta, contagem, relatorioTurma, lerListaAlunos, lerQuestoesColadas, csvRelatorio
    };

    if (typeof module === 'object' && module.exports) module.exports = Dados;
    else global.Dados = Dados;
})(typeof self !== 'undefined' ? self : this);
