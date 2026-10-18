/* Os dados do ProvaShow Malu e as contas em cima deles (sem tela, sem
   navegador: tudo aqui roda também no Node, nos testes).

   Um único objeto, guardado pelo Armazem (IndexedDB) no aparelho do professor:
     pastas:    [{ id, nome, paiId, alterado, removido }]
     conjuntos: [{ id, titulo, pastaId, embaralhar, questoes: [Questao], alterado, removido }]
     pacotes:   [{ id, nome, descricao, imagem, conjuntos: [id], alterado, removido }]
     turmas:    [{ id, nome, cor, arquivada, alunos: [Aluno], fila: [conjuntoId], alterado, removido }]
     aulas:     [{ id, turmaId, conjuntoId, titulo, inicio, fim, alterado }]
     sessoes:   [{ id, aulaId, turmaId, conjuntoId, questaoId, questao: {cópia}, respostas: { cartao: letra },
                   origem: { cartao: 'cartao'|'aparelho'|'manual' }, ignorada, data, alterado }]
     config:    { telao: { lista, esconderRespostas }, cronometro: { modo, segundos }, leitura: { som } }
   Questao: { id, tipo: 'avaliada'|'enquete', enunciado, midia: null | { tipo, src, inicio, fim, ajuste },
              layout: 'centro'|'esquerda'|'direita', opcoes: [{ texto, imagem }], corretas: ['B', ...] }
   Aluno:   { id, nome, cartao, arquivado, chave }

   "removido" é a lixeira: o item some das listas, mas volta em até 30 dias.
   "alterado" é o relógio da sincronização entre aparelhos (vence o mais novo).
   A sessão (uma pergunta apresentada a uma turma) guarda uma cópia da
   questão: editar o conjunto depois não muda o que a turma respondeu. */
(function (global) {
    'use strict';

    const LETRAS = ['A', 'B', 'C', 'D'];
    const VERSAO = 2;
    const DIAS_LIXEIRA = 30;
    const CORES = ['#4c2a85', '#2e86de', '#17a589', '#e4572e', '#f5a623', '#c0398b', '#5d6d7e', '#2d8a4e'];

    function agora() { return new Date().toISOString(); }

    function novoId() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    }

    function novaChave() {
        const letras = 'abcdefghjkmnpqrstuvwxyz23456789';
        let c = '';
        for (let i = 0; i < 10; i++) c += letras[Math.floor(Math.random() * letras.length)];
        return c;
    }

    function configPadrao() {
        return {
            telao: { lista: 'leitura', esconderRespostas: true },
            cronometro: { modo: 'livre', segundos: 30 },
            leitura: { som: true }
        };
    }

    function vazio() {
        return { versao: VERSAO, pastas: [], conjuntos: [], pacotes: [], turmas: [], aulas: [], sessoes: [], config: configPadrao() };
    }

    function novaQuestao(campos) {
        return Object.assign({
            id: novoId(), tipo: 'avaliada', enunciado: '', midia: null, layout: 'centro',
            opcoes: [{ texto: '', imagem: '' }, { texto: '', imagem: '' }, { texto: '', imagem: '' }, { texto: '', imagem: '' }],
            corretas: ['A']
        }, campos || {});
    }

    function q(enunciado, opcoes, corretas, extra) {
        return novaQuestao(Object.assign({
            enunciado,
            opcoes: opcoes.map((texto) => ({ texto, imagem: '' })),
            corretas: corretas ? [].concat(corretas) : [],
            tipo: corretas ? 'avaliada' : 'enquete'
        }, extra));
    }

    function exemplo() {
        const e = vazio();
        const t = agora();
        const conjunto = {
            id: novoId(), titulo: 'Exemplo — aquecimento', pastaId: null, embaralhar: false, alterado: t, removido: null, questoes: [
                q('Qual é a capital do Ceará?', ['Recife', 'Fortaleza', 'Natal', 'Teresina'], 'B'),
                q('A água ferve a 100 °C ao nível do mar.', ['Verdadeiro', 'Falso'], 'A'),
                q('Quanto vale $\\frac{3}{4} + \\frac{1}{4}$?', ['$\\frac{4}{8}$', '$1$', '$\\frac{3}{16}$', '$2$'], 'B'),
                q('Como você está se sentindo com o conteúdo de hoje?', ['Entendi tudo', 'Entendi quase tudo', 'Tenho dúvidas', 'Não entendi'], null)
            ]
        };
        e.conjuntos.push(conjunto);
        e.turmas.push({
            id: novoId(), nome: 'Turma de exemplo', cor: CORES[0], arquivada: false, fila: [conjunto.id], alterado: t, removido: null,
            alunos: ['Ana', 'Bruno', 'Carla', 'Davi', 'Eva'].map((nome, i) => ({ id: novoId(), nome, cartao: i + 1, arquivado: false, chave: novaChave() }))
        });
        return e;
    }

    /* ----- versão 1 -> 2 ----- */

    function migrarQuestao(x) {
        if (!x) return x;
        const opcoes = (x.opcoes || []).map((o) => (typeof o === 'string' ? { texto: o, imagem: '' } : Object.assign({ texto: '', imagem: '' }, o)));
        let corretas = Array.isArray(x.corretas) ? x.corretas.slice() : (x.correta ? [x.correta] : []);
        corretas = corretas.filter((l) => LETRAS.indexOf(l) >= 0 && LETRAS.indexOf(l) < opcoes.length);
        const midia = x.midia !== undefined ? x.midia : (x.imagem ? { tipo: 'imagem', src: x.imagem, ajuste: 'fit' } : null);
        const r = Object.assign({}, x, {
            tipo: x.tipo || (corretas.length ? 'avaliada' : 'enquete'),
            opcoes, corretas, midia, layout: x.layout || 'centro'
        });
        delete r.correta;
        delete r.imagem;
        return r;
    }

    function migrarCopia(x) {
        /* a cópia guardada na sessão: só textos */
        const m = migrarQuestao(x);
        return Object.assign({}, m, { opcoes: m.opcoes.map((o) => (typeof o === 'string' ? o : o.texto)) });
    }

    function migrar(d) {
        const e = Object.assign(vazio(), d || {});
        e.config = Object.assign(configPadrao(), e.config || {});
        e.config.telao = Object.assign(configPadrao().telao, e.config.telao || {});
        e.config.cronometro = Object.assign(configPadrao().cronometro, e.config.cronometro || {});
        e.config.leitura = Object.assign(configPadrao().leitura, e.config.leitura || {});
        const t = agora();
        e.conjuntos = e.conjuntos.map((c) => Object.assign({ pastaId: null, embaralhar: false, removido: null, alterado: c.alterado || t }, c, {
            questoes: (c.questoes || []).map(migrarQuestao)
        }));
        e.turmas = e.turmas.map((tm, i) => Object.assign({ cor: CORES[i % CORES.length], arquivada: false, removido: null, alterado: t, fila: [] }, tm, {
            alunos: (tm.alunos || []).map((a) => Object.assign({ arquivado: false, chave: novaChave() }, a))
        }));
        e.sessoes = e.sessoes.map((s) => Object.assign({ origem: {}, ignorada: false, aulaId: null, alterado: s.data || t }, s, {
            questao: migrarCopia(s.questao)
        }));
        e.versao = VERSAO;
        return e;
    }

    /* ----- lixeira ----- */

    const ativos = (lista) => lista.filter((x) => !x.removido);

    function remover(item) { item.removido = agora(); item.alterado = agora(); }
    function restaurar(item) { item.removido = null; item.alterado = agora(); }

    function limparLixeira(d, quando) {
        const limite = new Date(quando || Date.now()).getTime() - DIAS_LIXEIRA * 864e5;
        const velho = (x) => x.removido && new Date(x.removido).getTime() < limite;
        for (const nome of ['pastas', 'conjuntos', 'pacotes', 'turmas']) d[nome] = d[nome].filter((x) => !velho(x));
    }

    /* pasta e as de dentro dela (para não mover uma pasta para dentro dela mesma) */
    function descendentes(d, pastaId) {
        const r = new Set([pastaId]);
        let mudou = true;
        while (mudou) {
            mudou = false;
            for (const p of d.pastas) if (p.paiId && r.has(p.paiId) && !r.has(p.id)) { r.add(p.id); mudou = true; }
        }
        return r;
    }

    function caminhoPasta(d, pastaId) {
        const r = [];
        let p = d.pastas.find((x) => x.id === pastaId);
        const vistos = new Set();
        while (p && !vistos.has(p.id)) { vistos.add(p.id); r.unshift(p); p = d.pastas.find((x) => x.id === p.paiId); }
        return r;
    }

    function semAcento(t) {
        return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    }

    function buscar(d, termo) {
        const t = semAcento(termo).trim();
        if (!t) return [];
        return ativos(d.conjuntos).filter((c) => semAcento(c.titulo).includes(t) ||
            c.questoes.some((x) => semAcento(x.enunciado).includes(t) || x.opcoes.some((o) => semAcento(o.texto).includes(t))));
    }

    /* ----- respostas ----- */

    function letraValida(sessao, letra) {
        const i = LETRAS.indexOf(letra);
        if (i < 0) return false;
        return !sessao.questao || i < sessao.questao.opcoes.length;
    }

    /* Só valem cartões de alunos ativos da turma; a última leitura vale. */
    function registrarResposta(sessao, turma, cartao, letra, origem) {
        const n = Number(cartao);
        if (!turma.alunos.some((a) => a.cartao === n && !a.arquivado)) return false;
        if (!letraValida(sessao, letra)) return false;
        sessao.respostas[n] = letra;
        if (!sessao.origem) sessao.origem = {};
        sessao.origem[n] = origem || 'cartao';
        sessao.alterado = agora();
        return true;
    }

    function apagarResposta(sessao, cartao) {
        delete sessao.respostas[cartao];
        if (sessao.origem) delete sessao.origem[cartao];
        sessao.alterado = agora();
    }

    const corretasDe = (questao) => (questao && questao.tipo !== 'enquete' && questao.corretas) ? questao.corretas : [];
    const avaliada = (questao) => corretasDe(questao).length > 0;
    const acertou = (questao, letra) => corretasDe(questao).includes(letra);

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

    /* ----- embaralhar as alternativas na hora de apresentar ----- */

    function sorteio(semente) {
        let s = 0;
        for (const ch of String(semente)) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
        return () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296);
    }

    /* Devolve a questão com as alternativas noutra ordem e as certas
       acompanhando. Verdadeiro/Falso e "todas/nenhuma das anteriores" ficam. */
    function embaralhar(questao, semente) {
        const n = questao.opcoes.length;
        const ordem = [...Array(n).keys()];
        const fixas = questao.opcoes.some((o) => /(todas|nenhuma|ambas) as (anteriores|alternativas)|^verdadeiro$|^falso$/i.test(semAcento(o.texto || o).trim()));
        if (!fixas) {
            const r = sorteio(semente);
            for (let i = n - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [ordem[i], ordem[j]] = [ordem[j], ordem[i]]; }
        }
        return Object.assign({}, questao, {
            opcoes: ordem.map((i) => questao.opcoes[i]),
            corretas: questao.corretas.map((l) => LETRAS[ordem.indexOf(LETRAS.indexOf(l))]).sort(),
            ordem
        });
    }

    /* ----- relatórios ----- */

    function relatorioTurma(turma, sessoes, opcoes) {
        const o = opcoes || {};
        const daTurma = sessoes.filter((s) => !turma.id || s.turmaId === turma.id);
        const contam = daTurma.filter((s) => !s.ignorada);
        const comResposta = new Set(daTurma.flatMap((s) => Object.keys(s.respostas).map(Number)));
        const alunos = turma.alunos.filter((a) => !a.arquivado || comResposta.has(a.cartao) || o.arquivados).map((a) => {
            let respondidas = 0, avaliadas = 0, acertos = 0;
            for (const s of contam) {
                const r = s.respostas[a.cartao];
                if (!r) continue;
                respondidas++;
                if (avaliada(s.questao)) {
                    avaliadas++;
                    if (acertou(s.questao, r)) acertos++;
                }
            }
            return { id: a.id, nome: a.nome, cartao: a.cartao, arquivado: !!a.arquivado, respondidas, acertos, avaliadas, percentual: percentual(acertos, avaliadas) };
        });
        const lista = daTurma.map((s) => {
            const respostas = Object.values(s.respostas);
            const acertos = respostas.filter((r) => acertou(s.questao, r)).length;
            return {
                id: s.id, aulaId: s.aulaId, data: s.data, questao: s.questao, respostas: s.respostas, origem: s.origem || {},
                ignorada: !!s.ignorada, responderam: respostas.length, acertos,
                percentual: avaliada(s.questao) ? percentual(acertos, respostas.length) : null
            };
        });
        const ordenar = {
            nome: (a, b) => a.nome.localeCompare(b.nome, 'pt-BR'),
            cartao: (a, b) => a.cartao - b.cartao,
            nota: (a, b) => (b.percentual == null ? -1 : b.percentual) - (a.percentual == null ? -1 : a.percentual) || a.nome.localeCompare(b.nome, 'pt-BR')
        }[o.ordenar || 'nome'];
        alunos.sort(ordenar);
        const comNota = alunos.filter((a) => a.percentual != null);
        const media = comNota.length ? Math.round(comNota.reduce((s, a) => s + a.percentual, 0) / comNota.length) : null;
        return { alunos, sessoes: lista, media };
    }

    function relatorioAluno(turma, aluno, sessoes) {
        const r = relatorioTurma(turma, sessoes, { arquivados: true });
        const resumo = r.alunos.find((a) => a.id === aluno.id) || { respondidas: 0, acertos: 0, avaliadas: 0, percentual: null };
        const itens = r.sessoes.map((s) => {
            const resposta = s.respostas[aluno.cartao] || null;
            return {
                data: s.data, enunciado: s.questao.enunciado, opcoes: s.questao.opcoes, corretas: corretasDe(s.questao),
                resposta, ignorada: s.ignorada,
                situacao: !resposta ? 'sem' : !avaliada(s.questao) ? 'enquete' : acertou(s.questao, resposta) ? 'certo' : 'errado'
            };
        });
        return { aluno, resumo, itens, mediaTurma: r.media };
    }

    function inicioDoDia(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
    function iso(d) {
        const x = new Date(d);
        return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
    }

    /* Períodos do placar: { de, ate } em AAAA-MM-DD (horário local). */
    function periodo(nome, hoje) {
        const h = inicioDoDia(hoje || new Date());
        const ate = iso(h);
        if (nome === 'dia') return { de: ate, ate };
        if (nome === 'semana') { const x = new Date(h); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return { de: iso(x), ate }; }
        if (nome === 'mes') return { de: iso(new Date(h.getFullYear(), h.getMonth(), 1)), ate };
        if (nome === 'bimestre') { const m = h.getMonth() - (h.getMonth() % 2); return { de: iso(new Date(h.getFullYear(), m, 1)), ate }; }
        if (nome === 'ano') return { de: iso(new Date(h.getFullYear(), 0, 1)), ate };
        return { de: '', ate: '' };
    }

    function dentroDoPeriodo(s, de, ate) {
        const dia = iso(s.data);
        return (!de || dia >= de) && (!ate || dia <= ate);
    }

    /* As perguntas que a turma mais errou (para retomar em aula). */
    function maisErradas(relatorio, quantas) {
        return relatorio.sessoes
            .filter((s) => s.percentual != null && !s.ignorada && s.responderam)
            .sort((a, b) => a.percentual - b.percentual)
            .slice(0, quantas || 5);
    }

    /* ----- turma ----- */

    function proximoCartao(usados) {
        let n = 1;
        while (usados.has(n)) n++;
        return n;
    }

    function lerListaAlunos(texto, existentes) {
        const usados = new Set((existentes || []).filter((a) => !a.arquivado).map((a) => a.cartao));
        const novos = [];
        for (const linha of String(texto).split(/\r?\n/)) {
            const nome = linha.split('\t')[0].replace(/^\s*\d+\s*[-.)–:]?\s+/, '').replace(/\s+/g, ' ').trim();
            if (!nome) continue;
            const cartao = proximoCartao(usados);
            if (cartao > 63) break;
            usados.add(cartao);
            novos.push({ id: novoId(), nome, cartao, arquivado: false, chave: novaChave() });
        }
        return novos;
    }

    /* Troca o cartão do aluno; se outro aluno ativo tinha esse número, os dois trocam. */
    function trocarCartao(turma, aluno, numero) {
        const n = Number(numero);
        if (!(n >= 1 && n <= 63)) return false;
        const dono = turma.alunos.find((a) => a.cartao === n && a !== aluno && !a.arquivado);
        if (dono) dono.cartao = aluno.cartao;
        aluno.cartao = n;
        turma.alterado = agora();
        return true;
    }

    function arquivarAluno(turma, aluno, arquivar) {
        if (!arquivar) {
            const ocupado = turma.alunos.some((a) => a !== aluno && !a.arquivado && a.cartao === aluno.cartao);
            if (ocupado) aluno.cartao = proximoCartao(new Set(turma.alunos.filter((a) => !a.arquivado).map((a) => a.cartao)));
        }
        aluno.arquivado = !!arquivar;
        turma.alterado = agora();
    }

    /* ----- importar perguntas coladas ----- */

    /* Aceita: perguntas numeradas ("1)", "1.", "Questão 1:", "Q1 -") com
       alternativas a) b) c) d) / (A) / A. ; certa marcada com * ou com uma
       linha "Resposta: B" (várias: "Resposta: A, C"); e também planilha colada
       (colunas separadas por tabulação: pergunta, A, B, C, D, certa). */
    function lerQuestoesColadas(texto, opcoes) {
        const o = Object.assign({ remover: '', alternativas: 0 }, opcoes);
        let limpo = String(texto || '');
        if (o.remover) limpo = limpo.split(o.remover).join('');
        const linhas = limpo.split(/\r?\n/);
        if (linhas.filter((l) => l.includes('\t')).length >= Math.max(1, linhas.filter((l) => l.trim()).length * 0.6)) return lerPlanilha(linhas);
        const reNumero = /^(?:quest[aã]o|pergunta|q)?\s*\d+\s*(?:[).:\-–]|\s(?=\S))\s*(.*)$/i;
        const reOpcao = /^(\*?)\s*\(?([a-dA-D])\s*[).\-–:]\s*(.*?)\s*(\*?)$/;
        const reGabarito = /^(?:resposta|gabarito|correta|certa)s?\s*[:=\-]\s*(.+)$/i;
        const comNumero = linhas.some((l) => reNumero.test(l.trim()) && !reOpcao.test(l.trim()));
        const questoes = [];
        let atual = null;
        const fechar = () => {
            if (atual && atual.enunciado.trim()) {
                atual.enunciado = atual.enunciado.trim();
                if (o.alternativas) atual.opcoes = atual.opcoes.slice(0, o.alternativas);
                if (atual.opcoes.length < 2) {
                    atual.opcoes = [{ texto: 'Verdadeiro', imagem: '' }, { texto: 'Falso', imagem: '' }];
                }
                atual.corretas = atual.corretas.filter((l) => LETRAS.indexOf(l) < atual.opcoes.length);
                atual.tipo = atual.corretas.length ? 'avaliada' : 'enquete';
                questoes.push(atual);
            }
            atual = null;
        };
        const nova = (enunciado) => novaQuestao({ enunciado, opcoes: [], corretas: [] });
        for (const bruta of linhas) {
            const linha = bruta.trim();
            if (!linha) {
                if (!comNumero && atual && atual.opcoes.length) fechar();
                continue;
            }
            const gabarito = linha.match(reGabarito);
            const opcao = linha.match(reOpcao);
            const numero = !opcao && linha.match(reNumero);
            if (gabarito && atual) {
                const ls = (gabarito[1].toUpperCase().match(/\b[A-D]\b/g) || []);
                const vf = /^\s*(v|verdadeiro|true)\s*$/i.test(gabarito[1]) ? ['A'] : /^\s*(f|falso|false)\s*$/i.test(gabarito[1]) ? ['B'] : [];
                atual.corretas = [...new Set(ls.length ? ls : vf)];
            } else if (opcao && atual && atual.enunciado) {
                if (atual.opcoes.length < 4) {
                    atual.opcoes.push({ texto: opcao[3].trim(), imagem: '' });
                    if (opcao[1] || opcao[4]) atual.corretas.push(LETRAS[atual.opcoes.length - 1]);
                }
            } else if (numero && comNumero) {
                fechar();
                atual = nova(numero[1]);
            } else {
                if (!atual) atual = nova('');
                if (atual.opcoes.length) atual.opcoes[atual.opcoes.length - 1].texto += ' ' + linha;
                else atual.enunciado += (atual.enunciado ? ' ' : '') + linha;
            }
        }
        fechar();
        return questoes;
    }

    function lerPlanilha(linhas) {
        const r = [];
        for (const l of linhas) {
            const c = l.split('\t').map((x) => x.trim());
            if (!c[0] || /^(pergunta|enunciado|quest[aã]o)$/i.test(c[0])) continue;
            const textos = c.slice(1, 5).filter(Boolean);
            const certa = (c[5] || '').toUpperCase();
            const corretas = (certa.match(/\b[A-D]\b/g) || []).filter((x) => LETRAS.indexOf(x) < textos.length);
            r.push(novaQuestao({
                enunciado: c[0], opcoes: (textos.length >= 2 ? textos : ['Verdadeiro', 'Falso']).map((texto) => ({ texto, imagem: '' })),
                corretas, tipo: corretas.length ? 'avaliada' : 'enquete'
            }));
        }
        return r;
    }

    /* ----- pacotes: levar conjuntos para outro professor ----- */

    function exportarPacote(d, pacote) {
        return {
            tipo: 'provashow-pacote', versao: VERSAO,
            pacote: { nome: pacote.nome, descricao: pacote.descricao || '', imagem: pacote.imagem || '' },
            conjuntos: pacote.conjuntos.map((id) => d.conjuntos.find((c) => c.id === id)).filter((c) => c && !c.removido)
                .map((c) => ({ titulo: c.titulo, embaralhar: !!c.embaralhar, questoes: c.questoes }))
        };
    }

    /* Traz um pacote (de arquivo, da biblioteca pública ou de outro professor)
       como cópias novas: nada do que já existe é sobrescrito. */
    function importarPacote(d, arquivo, pastaId) {
        if (!arquivo || arquivo.tipo !== 'provashow-pacote' || !Array.isArray(arquivo.conjuntos)) throw new Error('Isto não é um pacote do ProvaShow.');
        const t = agora();
        const ids = [];
        for (const c of arquivo.conjuntos) {
            const novo = {
                id: novoId(), titulo: c.titulo || 'Sem título', pastaId: pastaId || null, embaralhar: !!c.embaralhar, alterado: t, removido: null,
                questoes: (c.questoes || []).map((x) => Object.assign(migrarQuestao(x), { id: novoId() }))
            };
            d.conjuntos.push(novo);
            ids.push(novo.id);
        }
        const p = arquivo.pacote || {};
        const pacote = { id: novoId(), nome: p.nome || 'Pacote importado', descricao: p.descricao || '', imagem: p.imagem || '', conjuntos: ids, alterado: t, removido: null };
        d.pacotes.push(pacote);
        return pacote;
    }

    /* ----- sincronização entre aparelhos (computador <-> celular) ----- */

    /* Junta o que veio do outro aparelho: item a item, vence o "alterado" mais
       novo (inclusive para exclusões, que são só "removido"). Sessões e aulas
       se somam. Devolve quantos itens mudaram. */
    function mesclar(local, remoto) {
        const r = migrar(remoto);
        let mudou = 0;
        for (const nome of ['pastas', 'conjuntos', 'pacotes', 'turmas', 'aulas', 'sessoes']) {
            const porId = new Map(local[nome].map((x) => [x.id, x]));
            for (const x of r[nome]) {
                const meu = porId.get(x.id);
                if (!meu) { local[nome].push(x); mudou++; } else if ((x.alterado || '') > (meu.alterado || '')) {
                    local[nome][local[nome].indexOf(meu)] = x;
                    mudou++;
                }
            }
        }
        return mudou;
    }

    /* Corta o texto em pedaços para mandar pelo canal (que tem limite por mensagem). */
    function fatiar(texto, tamanho) {
        const t = tamanho || 60000;
        const r = [];
        for (let i = 0; i < texto.length; i += t) r.push(texto.slice(i, i + t));
        return r.length ? r : [''];
    }

    /* ----- planilha ----- */

    function csvRelatorio(turma, relatorio) {
        const c = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
        const cab = ['Cartão', 'Aluno', 'Respondidas', 'Acertos', 'Valendo nota', '% de acerto']
            .concat(relatorio.sessoes.map((s, i) => `Q${i + 1}${s.ignorada ? ' (fora da nota)' : ''}`));
        const linhas = [cab.map(c).join(';')];
        for (const a of relatorio.alunos) {
            const porSessao = relatorio.sessoes.map((s) => {
                const r = s.respostas[a.cartao];
                if (!r) return '';
                return avaliada(s.questao) ? r + (acertou(s.questao, r) ? ' ✓' : ' ✗') : r;
            });
            linhas.push([a.cartao, a.nome, a.respondidas, a.acertos, a.avaliadas, a.percentual == null ? '' : a.percentual].concat(porSessao).map(c).join(';'));
        }
        linhas.push(['', 'Perguntas'].map(c).join(';'));
        relatorio.sessoes.forEach((s, i) => {
            linhas.push([`Q${i + 1}`, s.questao.enunciado, iso(s.data), s.responderam, corretasDe(s.questao).join(', ') || 'enquete', s.percentual == null ? '' : s.percentual].map(c).join(';'));
        });
        return '﻿' + linhas.join('\r\n');
    }

    const Dados = {
        LETRAS, VERSAO, CORES, DIAS_LIXEIRA, novoId, novaChave, vazio, exemplo, novaQuestao, migrar, migrarQuestao, configPadrao,
        ativos, remover, restaurar, limparLixeira, descendentes, caminhoPasta, buscar, semAcento,
        registrarResposta, apagarResposta, contagem, corretasDe, avaliada, acertou, embaralhar,
        relatorioTurma, relatorioAluno, periodo, dentroDoPeriodo, maisErradas, iso,
        lerListaAlunos, trocarCartao, arquivarAluno, proximoCartao, lerQuestoesColadas,
        exportarPacote, importarPacote, mesclar, fatiar, csvRelatorio
    };

    if (typeof module === 'object' && module.exports) module.exports = Dados;
    else global.Dados = Dados;
})(typeof self !== 'undefined' ? self : this);
