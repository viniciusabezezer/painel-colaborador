/* O motor do jogo. Nada é guardado "pronto": o que se guarda é a lista de
   EVENTOS (reconheceu, descontou, usou poder, começou o dia...) e o estado
   é refeito do zero aplicando um a um, em ordem de horário.

   Por que assim:
   - Desfazer é só marcar o evento como desfeito e refazer o estado.
   - Dois professores, dois celulares: juntar o trabalho dos dois é unir as
     duas listas de eventos (cada evento tem id próprio) — sem conflito.
   - O histórico de cada estudante sai de graça, com quem fez e quando.
   - Cada evento leva uma cópia do que valia na hora (XP do comportamento,
     dados do chefe), então mudar as regras depois não reescreve o passado.

   Evento que não pode ser aplicado (poder sem Energia, chamada repetida)
   não quebra nada: vai para estado.ignorados com o motivo. */
(function (global) {
    'use strict';

    const Regras = (typeof module !== 'undefined' && module.exports)
        ? require('./regras.js') : global.JangadaRegras;

    function novoEstado() {
        return {
            alunos: {}, jangadas: {}, missoes: {}, questoes: {},
            dias: {},        // turma -> { data, evento, multiplicador, so, semDano }
            chamadas: {},    // "turma|data" -> lista de ausentes
            exportados: {},  // id do registro de moeda -> true
            registros: [],
            ignorados: []
        };
    }

    /* ===== datas e ids ===== */

    function dataLocal(quando) {
        const d = quando ? new Date(quando) : new Date();
        const p = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    }

    function novoId(prefixo) {
        const aleatorio = Math.random().toString(36).slice(2, 8);
        return `${prefixo || 'e'}${Date.now().toString(36)}${aleatorio}`;
    }

    function criarEvento(tipo, dados, opcoes) {
        const o = opcoes || {};
        const t = o.agora ? new Date(o.agora).toISOString() : new Date().toISOString();
        return Object.assign({ id: o.id || novoId('e'), t, data: dataLocal(t), tipo, autor: o.autor || '' }, dados);
    }

    function ordenar(eventos) {
        return eventos.slice().sort((a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    }

    /* Junta duas listas de eventos (este aparelho + o de um colega). */
    function juntar(a, b) {
        const porId = new Map();
        for (const ev of a.concat(b)) if (ev && ev.id && !porId.has(ev.id)) porId.set(ev.id, ev);
        return ordenar(Array.from(porId.values()));
    }

    /* ===== consultas ===== */

    function classeDe(regras, id) {
        return regras.classes.find((c) => c.id === id) || regras.classes[0];
    }

    function vidaMax(regras, aluno) { return classeDe(regras, aluno.classe).vidaMax; }
    function energiaMax(regras, aluno) { return classeDe(regras, aluno.classe).energiaMax; }

    function alunosDaTurma(estado, turma) {
        return Object.values(estado.alunos)
            .filter((a) => a.ativo && a.turma === turma)
            .sort((x, y) => x.nome.localeCompare(y.nome, 'pt-BR'));
    }

    function membros(estado, jangadaId) {
        if (!jangadaId) return [];
        return Object.values(estado.alunos).filter((a) => a.ativo && a.jangada === jangadaId);
    }

    function jangadasDaTurma(estado, turma) {
        return Object.values(estado.jangadas)
            .filter((j) => j.turma === turma)
            .sort((x, y) => x.nome.localeCompare(y.nome, 'pt-BR'));
    }

    function poderDe(regras, id) { return regras.poderes.find((p) => p.id === id); }

    function poderesDe(regras, aluno) {
        return regras.poderes.filter((p) => p.classe === aluno.classe);
    }

    function mesmaJangada(a, b) { return !!(a && b && a.jangada && a.jangada === b.jangada && a.id !== b.id); }

    /* Por que este estudante não pode usar este poder agora? null = pode. */
    function motivoPoder(estado, regras, alunoId, poderId, alvoId) {
        const aluno = estado.alunos[alunoId];
        const poder = poderDe(regras, poderId);
        if (!aluno || !aluno.ativo) return 'Estudante não encontrado.';
        if (!poder) return 'Poder não encontrado.';
        if (poder.classe !== aluno.classe) return `${poder.nome} não é um poder de ${classeDe(regras, aluno.classe).nome}.`;
        if (aluno.caido) return 'Quem caiu precisa concluir a missão de reparação antes de usar poderes.';
        if (aluno.nivel < poder.nivel) return `Libera no nível ${poder.nivel}.`;
        if (aluno.energia < poder.custo) return `Precisa de ${poder.custo} de Energia (tem ${aluno.energia}).`;
        if (poder.efeito.tipo === 'proteger') return 'Este poder é usado na hora de um desconto, para proteger um colega.';
        if (poder.efeito.alvo === 'colega') {
            const alvo = estado.alunos[alvoId];
            if (!alvo || !alvo.ativo) return 'Escolha o colega.';
            if (!mesmaJangada(aluno, alvo)) return 'O colega precisa ser da mesma jangada.';
            if (alvo.caido) return `${alvo.nome} caiu: primeiro a missão de reparação.`;
        }
        if (poder.efeito.alvo === 'jangada' && !aluno.jangada) return 'Precisa estar numa jangada.';
        return null;
    }

    /* Quem da jangada pode receber o desconto no lugar deste estudante. */
    function protetores(estado, regras, alunoId) {
        const aluno = estado.alunos[alunoId];
        if (!aluno) return [];
        const escudos = regras.poderes.filter((p) => p.efeito.tipo === 'proteger');
        const lista = [];
        for (const colega of membros(estado, aluno.jangada)) {
            if (colega.id === aluno.id || colega.caido) continue;
            const poder = escudos.find((p) => p.classe === colega.classe && colega.nivel >= p.nivel && colega.energia >= p.custo);
            if (poder) lista.push({ aluno: colega, poder });
        }
        return lista;
    }

    /* ===== efeitos básicos ===== */

    function registrar(estado, ev, aluno, tipo, deltas, texto) {
        const r = Object.assign({
            id: `${ev.id}#${estado.registros.length}`,
            ev: ev.id, t: ev.t, data: ev.data, autor: ev.autor || '',
            alunoId: aluno.id, turma: aluno.turma, tipo, texto: texto || '',
            xp: 0, vida: 0, energia: 0, moeda: 0
        }, deltas);
        estado.registros.push(r);
        return r;
    }

    function limitar(valor, min, max) { return Math.max(min, Math.min(max, valor)); }

    function mudarEnergia(estado, regras, aluno, delta) {
        const antes = aluno.energia;
        aluno.energia = limitar(aluno.energia + delta, 0, energiaMax(regras, aluno));
        return aluno.energia - antes;
    }

    function ganharXp(estado, regras, ev, aluno, xp, tipo, texto) {
        const antes = aluno.nivel;
        aluno.xp += xp;
        aluno.nivel = Regras.nivelPorXp(aluno.xp);
        registrar(estado, ev, aluno, tipo, { xp }, texto);
        if (aluno.nivel > antes) {
            const subiu = aluno.nivel - antes;
            const moeda = (regras.moeda && regras.moeda.porNivel || 0) * subiu;
            aluno.moeda += moeda;
            const energia = mudarEnergia(estado, regras, aluno, (regras.bonusNivelEnergia || 0) * subiu);
            registrar(estado, ev, aluno, 'nivel', { moeda, energia }, `Subiu para o nível ${aluno.nivel}!`);
        }
    }

    function cair(estado, regras, ev, aluno, cascata) {
        aluno.caido = true;
        registrar(estado, ev, aluno, 'queda', {}, 'Caiu: precisa de uma missão de reparação.');
        const s = regras.solidariedade || 0;
        if (!cascata || s <= 0) return;
        for (const colega of membros(estado, aluno.jangada)) {
            if (colega.id === aluno.id || colega.caido) continue;
            mudarVida(estado, regras, ev, colega, -s, 'solidariedade', `${aluno.nome} caiu e a jangada sentiu.`, false);
        }
    }

    function mudarVida(estado, regras, ev, aluno, delta, tipo, texto, cascata) {
        if (aluno.caido && delta > 0) return 0;
        const antes = aluno.vida;
        aluno.vida = limitar(aluno.vida + delta, 0, vidaMax(regras, aluno));
        const efetivo = aluno.vida - antes;
        if (tipo) registrar(estado, ev, aluno, tipo, { vida: efetivo }, texto);
        if (antes > 0 && aluno.vida === 0) cair(estado, regras, ev, aluno, cascata !== false);
        return efetivo;
    }

    function ignorar(estado, ev, motivo) {
        estado.ignorados.push({ id: ev.id, tipo: ev.tipo, t: ev.t, motivo });
    }

    function multiplicadorDoDia(estado, turma, data, comportamentoId) {
        const dia = estado.dias[turma];
        if (!dia || dia.data !== data || !dia.multiplicador) return 1;
        if (dia.so && dia.so !== comportamentoId) return 1;
        return dia.multiplicador;
    }

    /* ===== aplicação de cada tipo de evento ===== */

    const APLICAR = {
        'aluno.novo'(estado, regras, ev) {
            const d = ev.aluno;
            if (!d || !d.id || !String(d.nome || '').trim()) return 'Estudante sem nome.';
            if (estado.alunos[d.id]) return 'Estudante já cadastrado.';
            const classe = classeDe(regras, d.classe);
            estado.alunos[d.id] = {
                id: d.id, nome: String(d.nome).trim(), turma: d.turma, classe: classe.id,
                jangada: d.jangada || null, codigo: d.codigo || '', ativo: true, criadoEm: ev.data,
                xp: 0, nivel: 1, vida: classe.vidaMax,
                energia: Math.min(regras.energiaInicial || 0, classe.energiaMax),
                moeda: 0, caido: false, seqPresenca: 0, faltasSeq: 0
            };
        },

        'aluno.editar'(estado, regras, ev) {
            const aluno = estado.alunos[ev.alunoId];
            if (!aluno) return 'Estudante não encontrado.';
            const c = ev.campos || {};
            for (const campo of ['nome', 'turma', 'codigo']) if (c[campo] !== undefined) aluno[campo] = String(c[campo]).trim();
            if (c.jangada !== undefined) aluno.jangada = c.jangada || null;
            if (c.classe !== undefined && c.classe !== aluno.classe) {
                aluno.classe = classeDe(regras, c.classe).id;
                aluno.vida = Math.min(aluno.vida, vidaMax(regras, aluno));
                aluno.energia = Math.min(aluno.energia, energiaMax(regras, aluno));
            }
            if (c.turma !== undefined && aluno.jangada && estado.jangadas[aluno.jangada]
                && estado.jangadas[aluno.jangada].turma !== aluno.turma) aluno.jangada = null;
        },

        'aluno.remover'(estado, regras, ev) {
            const aluno = estado.alunos[ev.alunoId];
            if (!aluno) return 'Estudante não encontrado.';
            aluno.ativo = false;
            aluno.jangada = null;
        },

        'jangada.nova'(estado, regras, ev) {
            const j = ev.jangada;
            if (!j || !j.id || !String(j.nome || '').trim()) return 'Jangada sem nome.';
            estado.jangadas[j.id] = { id: j.id, nome: String(j.nome).trim(), turma: j.turma };
        },

        'jangada.editar'(estado, regras, ev) {
            const j = estado.jangadas[ev.jangadaId];
            if (!j) return 'Jangada não encontrada.';
            if (ev.nome) j.nome = String(ev.nome).trim();
        },

        'jangada.remover'(estado, regras, ev) {
            if (!estado.jangadas[ev.jangadaId]) return 'Jangada não encontrada.';
            for (const a of membros(estado, ev.jangadaId)) a.jangada = null;
            delete estado.jangadas[ev.jangadaId];
        },

        /* Refaz as jangadas de uma turma de uma vez (sugestão do Conselheiro). */
        'jangadas.formar'(estado, regras, ev) {
            for (const j of jangadasDaTurma(estado, ev.turma)) {
                for (const a of membros(estado, j.id)) a.jangada = null;
                delete estado.jangadas[j.id];
            }
            for (const j of ev.jangadas || []) estado.jangadas[j.id] = { id: j.id, nome: j.nome, turma: ev.turma };
            for (const [alunoId, jangadaId] of Object.entries(ev.membros || {})) {
                const a = estado.alunos[alunoId];
                if (a && a.ativo && a.turma === ev.turma && estado.jangadas[jangadaId]) a.jangada = jangadaId;
            }
        },

        comportamento(estado, regras, ev) {
            const c = ev.comportamento;
            if (!c || !['positivo', 'negativo'].includes(c.tipo)) return 'Comportamento inválido.';
            const alvos = (ev.alunoIds || []).map((id) => estado.alunos[id]).filter((a) => a && a.ativo);
            if (!alvos.length) return 'Nenhum estudante.';
            const nota = ev.nota ? ` — ${ev.nota}` : '';
            for (const aluno of alvos) {
                if (c.tipo === 'positivo') {
                    const mult = multiplicadorDoDia(estado, aluno.turma, ev.data, c.id);
                    const xp = Math.round(c.xp * mult);
                    ganharXp(estado, regras, ev, aluno, xp, 'positivo', `${c.nome}${mult > 1 ? ` (×${mult})` : ''}${nota}`);
                    continue;
                }
                const dia = estado.dias[aluno.turma];
                if (dia && dia.data === ev.data && dia.semDano) {
                    registrar(estado, ev, aluno, 'negativo', {}, `${c.nome} (mar de calmaria: sem dano)${nota}`);
                    continue;
                }
                if (aluno.caido) {
                    registrar(estado, ev, aluno, 'negativo', {}, `${c.nome}${nota}`);
                    continue;
                }
                const protetor = estado.alunos[(ev.protecoes || {})[aluno.id]];
                const escudo = protetor && protetores(estado, regras, aluno.id).find((p) => p.aluno.id === protetor.id);
                if (escudo) {
                    registrar(estado, ev, aluno, 'negativo', {}, `${c.nome} — protegido(a) por ${protetor.nome}${nota}`);
                    const dano = Math.round(c.vida * (1 - (escudo.poder.efeito.reducao || 0)));
                    const energia = mudarEnergia(estado, regras, protetor, -escudo.poder.custo);
                    const vida = mudarVida(estado, regras, ev, protetor, -dano, null, null, true);
                    registrar(estado, ev, protetor, 'protecao', { vida, energia }, `${escudo.poder.nome}: protegeu ${aluno.nome}`);
                    continue;
                }
                mudarVida(estado, regras, ev, aluno, -c.vida, 'negativo', `${c.nome}${nota}`, true);
            }
        },

        poder(estado, regras, ev) {
            const motivo = motivoPoder(estado, regras, ev.alunoId, ev.poderId, ev.alvoId);
            if (motivo) return motivo;
            const aluno = estado.alunos[ev.alunoId];
            const poder = poderDe(regras, ev.poderId);
            const ef = poder.efeito;
            mudarEnergia(estado, regras, aluno, -poder.custo);
            registrar(estado, ev, aluno, 'poder', { energia: -poder.custo }, `Usou ${poder.nome}: ${poder.descricao}`);
            let alvos = [];
            if (ef.alvo === 'si') alvos = [aluno];
            else if (ef.alvo === 'colega') alvos = [estado.alunos[ev.alvoId]];
            else if (ef.alvo === 'jangada') {
                alvos = membros(estado, aluno.jangada).filter((a) => !a.caido && (ef.tipo === 'curar' || a.id !== aluno.id));
            }
            for (const alvo of alvos) {
                if (ef.tipo === 'curar') {
                    mudarVida(estado, regras, ev, alvo, ef.valor, 'cura', `${poder.nome} de ${aluno.nome}`);
                } else if (ef.tipo === 'energizar') {
                    const energia = mudarEnergia(estado, regras, alvo, ef.valor);
                    registrar(estado, ev, alvo, 'energia', { energia }, `${poder.nome} de ${aluno.nome}`);
                }
            }
        },

        novoDia(estado, regras, ev) {
            const dia = estado.dias[ev.turma];
            if (dia && dia.data === ev.data) return `O dia ${ev.data} da ${ev.turma} já começou.`;
            const e = ev.evento || { efeito: { tipo: 'nenhum' } };
            const ef = e.efeito || { tipo: 'nenhum' };
            estado.dias[ev.turma] = {
                data: ev.data, evento: e,
                multiplicador: ef.tipo === 'multiplicador' ? ef.valor : 1,
                so: ef.tipo === 'multiplicador' ? ef.so || null : null,
                semDano: ef.tipo === 'semDano'
            };
            for (const aluno of alunosDaTurma(estado, ev.turma)) {
                mudarEnergia(estado, regras, aluno, regras.energiaPorDia || 0);
                if (!aluno.caido) mudarVida(estado, regras, ev, aluno, regras.vidaPorDia || 0);
                const texto = `${e.nome}: ${e.texto}`;
                if (ef.tipo === 'xp') ganharXp(estado, regras, ev, aluno, ef.valor, 'evento', texto);
                if (ef.tipo === 'vida' && !aluno.caido) {
                    const vida = mudarVida(estado, regras, ev, aluno, ef.valor);
                    if (vida) registrar(estado, ev, aluno, 'evento', { vida }, texto);
                }
                if (ef.tipo === 'energia') {
                    const energia = mudarEnergia(estado, regras, aluno, ef.valor);
                    if (energia) registrar(estado, ev, aluno, 'evento', { energia }, texto);
                }
            }
        },

        /* Desafio cumprido, prêmio coletivo, gincana: XP para uma lista. */
        bonus(estado, regras, ev) {
            const alvos = (ev.alunoIds || []).map((id) => estado.alunos[id]).filter((a) => a && a.ativo);
            if (!alvos.length || !(ev.xp > 0)) return 'Bônus vazio.';
            for (const aluno of alvos) ganharXp(estado, regras, ev, aluno, ev.xp, 'evento', ev.motivo || 'Bônus');
        },

        presenca(estado, regras, ev) {
            const chave = `${ev.turma}|${ev.data}`;
            if (estado.chamadas[chave]) return `A chamada da ${ev.turma} em ${ev.data} já foi feita.`;
            const ausentes = new Set(ev.ausentes || []);
            estado.chamadas[chave] = Array.from(ausentes);
            const p = regras.presenca || {};
            for (const aluno of alunosDaTurma(estado, ev.turma)) {
                if (ausentes.has(aluno.id)) {
                    aluno.faltasSeq += 1;
                    aluno.seqPresenca = 0;
                    registrar(estado, ev, aluno, 'falta', {}, `Faltou (${aluno.faltasSeq} seguida${aluno.faltasSeq > 1 ? 's' : ''})`);
                    continue;
                }
                aluno.faltasSeq = 0;
                aluno.seqPresenca += 1;
                if (p.bonusACada > 0 && p.xp > 0 && aluno.seqPresenca % p.bonusACada === 0) {
                    ganharXp(estado, regras, ev, aluno, p.xp, 'presenca', `${aluno.seqPresenca} dias seguidos presente!`);
                }
            }
        },

        'missao.nova'(estado, regras, ev) {
            const m = ev.missao;
            if (!m || !m.id || !String(m.titulo || '').trim()) return 'Missão sem título.';
            estado.missoes[m.id] = Object.assign({ ativa: true, concluidas: {} }, m, { concluidas: {}, criadaEm: ev.data, autor: ev.autor || '' });
        },

        'missao.arquivar'(estado, regras, ev) {
            const m = estado.missoes[ev.missaoId];
            if (!m) return 'Missão não encontrada.';
            m.ativa = false;
        },

        'missao.concluir'(estado, regras, ev) {
            const m = estado.missoes[ev.missaoId];
            if (!m) return 'Missão não encontrada.';
            for (const id of ev.alunoIds || []) {
                const aluno = estado.alunos[id];
                if (!aluno || !aluno.ativo || m.concluidas[id]) continue;
                m.concluidas[id] = ev.data;
                if (m.moeda > 0) aluno.moeda += m.moeda;
                ganharXp(estado, regras, ev, aluno, m.xp || 0, 'missao', `Missão: ${m.titulo}`);
                if (m.moeda > 0) registrar(estado, ev, aluno, 'moeda', { moeda: m.moeda }, `Missão: ${m.titulo}`);
            }
        },

        reparacao(estado, regras, ev) {
            const aluno = estado.alunos[ev.alunoId];
            if (!aluno) return 'Estudante não encontrado.';
            if (!aluno.caido) return `${aluno.nome} não está caído(a).`;
            aluno.caido = false;
            aluno.vida = Math.max(1, Math.round(vidaMax(regras, aluno) * (regras.voltaDaQueda || 0.5)));
            const r = ev.reparacao || {};
            registrar(estado, ev, aluno, 'reparacao', { vida: aluno.vida }, `Voltou à jangada: ${r.nome || 'missão de reparação'}${ev.nota ? ` — ${ev.nota}` : ''}`);
        },

        batalha(estado, regras, ev) {
            const chefe = ev.chefe || {};
            const participantes = (ev.participantes || []).map((id) => estado.alunos[id]).filter((a) => a && a.ativo);
            if (!participantes.length) return 'Batalha sem participantes.';
            for (const aluno of participantes) {
                if (ev.vitoria) ganharXp(estado, regras, ev, aluno, chefe.xp || 0, 'batalha', `Venceu ${chefe.nome}!`);
                else registrar(estado, ev, aluno, 'batalha', {}, `Enfrentou ${chefe.nome} (fica para a próxima)`);
            }
        },

        'questao.nova'(estado, regras, ev) {
            const q = ev.questao;
            if (!q || !q.id || !String(q.enunciado || '').trim()) return 'Questão sem enunciado.';
            estado.questoes[q.id] = Object.assign({}, q);
        },

        'questao.remover'(estado, regras, ev) {
            if (!estado.questoes[ev.questaoId]) return 'Questão não encontrada.';
            delete estado.questoes[ev.questaoId];
        },

        'moeda.exportar'(estado, regras, ev) {
            for (const id of ev.ids || []) estado.exportados[id] = ev.data;
        }
    };

    function aplicar(estado, regras, ev) {
        const fn = APLICAR[ev.tipo];
        if (!fn) { ignorar(estado, ev, `Tipo de evento desconhecido: ${ev.tipo}`); return; }
        const motivo = fn(estado, regras, ev);
        if (motivo) ignorar(estado, ev, motivo);
    }

    /* O que pode ser desfeito pelo botão "Desfazer" (cadastro não entra:
       apagar um estudante é "remover", que guarda o histórico). */
    const DESFAZIVEIS = new Set(['comportamento', 'poder', 'novoDia', 'bonus', 'presenca', 'missao.concluir', 'reparacao', 'batalha']);

    function reproduzir(eventos, regras) {
        const desfeitos = new Set();
        for (const ev of eventos) if (ev.tipo === 'desfazer') desfeitos.add(ev.alvo);
        const estado = novoEstado();
        for (const ev of ordenar(eventos)) {
            if (ev.tipo === 'desfazer' || desfeitos.has(ev.id)) continue;
            aplicar(estado, regras, ev);
        }
        estado.desfeitos = desfeitos;
        return estado;
    }

    /* Moeda ganha e ainda não levada ao MaluPix (ou à moeda da escola). */
    function moedaPendente(estado) {
        return estado.registros.filter((r) => r.moeda > 0 && !estado.exportados[r.id]);
    }

    const api = {
        novoEstado, dataLocal, novoId, criarEvento, ordenar, juntar, reproduzir, aplicar,
        classeDe, vidaMax, energiaMax, alunosDaTurma, membros, jangadasDaTurma, poderDe, poderesDe,
        motivoPoder, protetores, moedaPendente, DESFAZIVEIS
    };

    global.JangadaMotor = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
