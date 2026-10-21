/* O Conselheiro: a parte "inteligente". Lê o histórico e aponta o que um
   professor com 8 turmas e 300 estudantes não consegue enxergar sozinho:
   - quem está caindo, faltando ou acumulando descontos (risco);
   - quem ninguém reconhece há dias (os "invisíveis");
   - se a turma recebe mais desconto do que reconhecimento;
   - se o XP está concentrado em poucos;
   - se as guildas estão desequilibradas — e propõe guildas novas.
   Também sorteia quem responde de forma justa (quem participou menos tem
   mais chance) e escreve o resumo da turma para o PDT.
   Tudo é regra simples e explicável, calculada no próprio aparelho. */
(function (global) {
    'use strict';

    const Motor = (typeof module !== 'undefined' && module.exports)
        ? require('./motor.js') : global.SagaMotor;

    /* Nomes de guilda: RPG com sotaque cearense. */
    const NOMES_GUILDAS = [
        'Dragões do Mar', 'Lobos da Caatinga', 'Fênix do Sertão', 'Corsários de Jeri',
        'Tubarões de Paracuru', 'Falcões do Cariri', 'Guardiões da Ibiapaba', 'Onças do Sertão',
        'Arraias do Mucuripe', 'Cavaleiros do Aracati', 'Corujas da Serra', 'Serpentes do Jaguaribe',
        'Carcarás do Pecém', 'Lendas da Taíba', 'Titãs de Quixadá', 'Piratas da Pedra Rachada'
    ];

    const RECONHECIMENTOS = new Set(['positivo', 'missao', 'batalha']);

    function diasEntre(de, ate) {
        const [a, b] = [de, ate].map((d) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)));
        return Math.round((b - a) / 86400000);
    }

    function recentes(estado, turma, hoje, dias) {
        return estado.registros.filter((r) => r.turma === turma && diasEntre(r.data, hoje) < dias && diasEntre(r.data, hoje) >= 0);
    }

    function porAluno(registros) {
        const mapa = new Map();
        for (const r of registros) {
            if (!mapa.has(r.alunoId)) mapa.set(r.alunoId, []);
            mapa.get(r.alunoId).push(r);
        }
        return mapa;
    }

    /* ===== saúde da turma ===== */

    function saude(estado, regras, turma, hoje) {
        const alunos = Motor.alunosDaTurma(estado, turma);
        const janela = recentes(estado, turma, hoje, 14);
        const positivos = janela.filter((r) => r.tipo === 'positivo').length;
        const negativos = janela.filter((r) => r.tipo === 'negativo').length;
        const xpPor = alunos.map((a) => janela.filter((r) => r.alunoId === a.id && RECONHECIMENTOS.has(r.tipo))
            .reduce((s, r) => s + r.xp, 0)).sort((x, y) => y - x);
        const total = xpPor.reduce((s, x) => s + x, 0);
        const topo = Math.max(1, Math.ceil(alunos.length * 0.2));
        const concentracao = total > 0 ? xpPor.slice(0, topo).reduce((s, x) => s + x, 0) / total : 0;
        const reconhecidos = alunos.filter((a) => janela.some((r) => r.alunoId === a.id && RECONHECIMENTOS.has(r.tipo))).length;
        const vidaMedia = alunos.length
            ? alunos.reduce((s, a) => s + a.vida / Motor.vidaMax(regras, a), 0) / alunos.length : 1;
        return {
            alunos: alunos.length,
            positivos, negativos,
            proporcao: negativos ? positivos / negativos : (positivos ? Infinity : null),
            concentracao,
            alcance: alunos.length ? reconhecidos / alunos.length : 0,
            vidaMedia,
            caidos: alunos.filter((a) => a.caido).length,
            xpSemana: recentes(estado, turma, hoje, 7).reduce((s, r) => s + r.xp, 0)
        };
    }

    /* ===== alertas ===== */

    const PESO = { alta: 0, media: 1, info: 2 };

    function alertas(estado, regras, turma, hoje, perfil) {
        const lista = [];
        const alunos = Motor.alunosDaTurma(estado, turma);
        const semana = porAluno(recentes(estado, turma, hoje, 7));
        const dezDias = porAluno(recentes(estado, turma, hoje, 10));
        const quinzena = porAluno(recentes(estado, turma, hoje, 14));
        const pdt = perfil && perfil.pdts && perfil.pdts[turma];
        const comPdt = pdt ? ` com o(a) PDT ${pdt}` : ' com o(a) PDT';
        const oPdt = pdt ? ` o(a) PDT ${pdt}` : ' o(a) PDT';
        const energiaParada = [];

        for (const a of alunos) {
            const max = Motor.vidaMax(regras, a);
            const descontos = (semana.get(a.id) || []).filter((r) => r.tipo === 'negativo').length;
            if (a.caido) {
                lista.push({ nivel: 'alta', tipo: 'queda', alunoId: a.id, titulo: `${a.nome} está K.O.`,
                    detalhe: 'Combine uma missão de respawn. Ao concluir, volta com metade do HP.', acao: 'reparar' });
            } else if (a.vida / max <= 0.3) {
                lista.push({ nivel: 'media', tipo: 'vida', alunoId: a.id, titulo: `${a.nome} está com pouco HP (${a.vida}/${max})`,
                    detalhe: 'Um(a) Curandeiro(a) da guilda pode curar, ou uma poção da loja resolve. Vale uma conversa antes do próximo desconto.' });
            }
            if (descontos >= 3) {
                lista.push({ nivel: 'alta', tipo: 'padrao', alunoId: a.id, titulo: `${a.nome}: ${descontos} descontos em 7 dias`,
                    detalhe: `Padrão que se repete pede escuta, não mais desconto. Converse${comPdt}.` });
            }
            if (a.faltasSeq >= 3) {
                lista.push({ nivel: 'alta', tipo: 'faltas', alunoId: a.id, titulo: `${a.nome}: ${a.faltasSeq} faltas seguidas`,
                    detalhe: `Caso de Busca Ativa. Avise${oPdt} e a coordenação.` });
            }
            const cadastradoHa = a.criadoEm ? diasEntre(a.criadoEm, hoje) : 0;
            const reconhecido = (dezDias.get(a.id) || []).some((r) => RECONHECIMENTOS.has(r.tipo));
            if (cadastradoHa >= 10 && !reconhecido && !a.caido && a.faltasSeq < 3) {
                lista.push({ nivel: 'media', tipo: 'invisivel', alunoId: a.id, titulo: `${a.nome} não é reconhecido(a) há 10 dias`,
                    detalhe: 'Procure algo para reconhecer — pontualidade, farda, ajuda a um colega. Quem não é visto se afasta.' });
            }
            const usaveis = Motor.poderesDe(regras, a).filter((p) => p.efeito.tipo !== 'proteger' && a.nivel >= p.nivel && a.energia >= p.custo);
            const usouPoder = (quinzena.get(a.id) || []).some((r) => r.tipo === 'poder' || r.tipo === 'protecao');
            if (!a.caido && usaveis.length && a.energia >= Motor.energiaMax(regras, a) && !usouPoder) energiaParada.push(a);
        }
        if (energiaParada.length) {
            const nomes = energiaParada.map((a) => a.nome);
            lista.push({ nivel: 'info', tipo: 'energia', titulo: `${nomes.length} com Mana cheia e poderes parados`,
                detalhe: `${nomes.slice(0, 6).join(', ')}${nomes.length > 6 ? ' e outros' : ''}. Lembre a turma: poder parado é privilégio desperdiçado.` });
        }

        const s = saude(estado, regras, turma, hoje);
        if (s.negativos >= 3 && s.proporcao !== null && s.proporcao < 3) {
            lista.push({ nivel: 'media', tipo: 'proporcao', titulo: `Turma ${turma}: ${s.positivos} reconhecimentos para ${s.negativos} descontos`,
                detalhe: 'Nas últimas duas semanas. Procure ao menos 3 reconhecimentos para cada desconto: o jogo é para motivar.' });
        }
        if (s.alunos >= 5 && s.concentracao > 0.5) {
            lista.push({ nivel: 'media', tipo: 'concentracao', titulo: `XP concentrado na ${turma}`,
                detalhe: `${Math.round(s.concentracao * 100)}% do XP das últimas duas semanas foi para 20% da turma.` });
        }
        const eq = equilibrio(estado, regras, turma);
        if (eq.desequilibrada) {
            lista.push({ nivel: 'info', tipo: 'guildas', titulo: `Guildas desequilibradas na ${turma}`,
                detalhe: eq.motivo, acao: 'formar' });
        }
        return lista.sort((x, y) => PESO[x.nivel] - PESO[y.nivel]);
    }

    /* ===== guildas ===== */

    /* Distribui os estudantes em guildas parecidas entre si: cada uma com
       todas as classes quando possível e com XP total próximo. Classe mais
       rara primeiro; dentro dela, do maior XP para o menor, cada um vai
       para a guilda que menos tem daquela classe, depois a menor, depois
       a de menor XP. Determinístico: mesma turma, mesma sugestão. */
    function formarGuildas(alunos, tamanho, opcoes) {
        const o = opcoes || {};
        const n = alunos.length;
        const k = Math.max(1, Math.round(n / Math.max(2, tamanho || 5)));
        const usados = new Set(o.nomesEmUso || []);
        const nomes = NOMES_GUILDAS.filter((x) => !usados.has(x)).concat(NOMES_GUILDAS.filter((x) => usados.has(x)));
        const prefixo = o.prefixoId || 'j';
        const guildas = Array.from({ length: k }, (_, i) => ({
            id: `${prefixo}${i}`, nome: nomes[i % nomes.length] + (i >= nomes.length ? ` ${Math.floor(i / nomes.length) + 1}` : ''),
            xp: 0, total: 0, classes: {}
        }));
        const porClasse = new Map();
        for (const a of alunos) {
            if (!porClasse.has(a.classe)) porClasse.set(a.classe, []);
            porClasse.get(a.classe).push(a);
        }
        const grupos = Array.from(porClasse.entries()).sort((x, y) => x[1].length - y[1].length || (x[0] < y[0] ? -1 : 1));
        const membros = {};
        for (const [classe, lista] of grupos) {
            lista.sort((x, y) => y.xp - x.xp || x.nome.localeCompare(y.nome, 'pt-BR'));
            for (const a of lista) {
                const alvo = guildas.slice().sort((x, y) =>
                    (x.classes[classe] || 0) - (y.classes[classe] || 0) || x.total - y.total || x.xp - y.xp || (x.id < y.id ? -1 : 1))[0];
                alvo.classes[classe] = (alvo.classes[classe] || 0) + 1;
                alvo.total += 1;
                alvo.xp += a.xp;
                membros[a.id] = alvo.id;
            }
        }
        return { guildas: guildas.map((j) => ({ id: j.id, nome: j.nome })), membros };
    }

    function equilibrio(estado, regras, turma) {
        const guildas = Motor.guildasDaTurma(estado, turma).map((j) => {
            const m = Motor.membros(estado, j.id);
            return {
                id: j.id, nome: j.nome, membros: m.length,
                xp: m.reduce((s, a) => s + a.xp, 0),
                xpMedio: m.length ? m.reduce((s, a) => s + a.xp, 0) / m.length : 0,
                classes: new Set(m.map((a) => a.classe)).size
            };
        });
        const semGuilda = Motor.alunosDaTurma(estado, turma).filter((a) => !a.guilda).length;
        const r = { guildas, semGuilda, desequilibrada: false, motivo: '' };
        if (semGuilda >= 2) {
            r.desequilibrada = true;
            r.motivo = `${semGuilda} estudantes ainda sem guilda.`;
            return r;
        }
        if (guildas.length < 2) return r;
        const medios = guildas.map((j) => j.xpMedio);
        const maior = Math.max(...medios);
        const menor = Math.min(...medios);
        const tamanhos = guildas.map((j) => j.membros);
        const faltaClasse = guildas.filter((j) => j.membros >= regras.classes.length && j.classes < regras.classes.length);
        if (maior >= 200 && menor < maior * 0.5) {
            r.desequilibrada = true;
            r.motivo = `A guilda mais forte tem o dobro de XP médio da mais fraca (${Math.round(maior)} × ${Math.round(menor)}).`;
        } else if (Math.max(...tamanhos) - Math.min(...tamanhos) >= 3) {
            r.desequilibrada = true;
            r.motivo = `Há guildas com ${Math.max(...tamanhos)} e com ${Math.min(...tamanhos)} estudantes.`;
        } else if (faltaClasse.length) {
            r.desequilibrada = true;
            r.motivo = `${faltaClasse.map((j) => j.nome).join(', ')}: falta alguma classe (sem tanque, suporte, mana ou dano).`;
        }
        return r;
    }

    /* ===== sorteio justo ===== */

    /* Quem participou menos na semana tem mais chance; quem faltou hoje
       (pela chamada) não entra. aleatorio: função 0..1 (para testes). */
    function sortear(estado, turma, hoje, aleatorio, excluir) {
        const rnd = aleatorio || Math.random;
        const ausentes = new Set(estado.chamadas[`${turma}|${hoje}`] || []);
        const fora = new Set(excluir || []);
        const candidatos = Motor.alunosDaTurma(estado, turma).filter((a) => !ausentes.has(a.id) && !fora.has(a.id));
        if (!candidatos.length) return null;
        const semana = porAluno(recentes(estado, turma, hoje, 7));
        const pesos = candidatos.map((a) => 1 / (1 + (semana.get(a.id) || []).filter((r) => r.tipo === 'positivo').length));
        const soma = pesos.reduce((s, p) => s + p, 0);
        let alvo = rnd() * soma;
        for (let i = 0; i < candidatos.length; i++) {
            alvo -= pesos[i];
            if (alvo < 0) return candidatos[i];
        }
        return candidatos[candidatos.length - 1];
    }

    /* ===== destaques e resumo ===== */

    function destaques(estado, turma, hoje) {
        const semana = porAluno(recentes(estado, turma, hoje, 7));
        const anterior = porAluno(recentes(estado, turma, hoje, 14).filter((r) => diasEntre(r.data, hoje) >= 7));
        const alunos = Motor.alunosDaTurma(estado, turma);
        const xpDe = (mapa, a) => (mapa.get(a.id) || []).filter((r) => RECONHECIMENTOS.has(r.tipo)).reduce((s, r) => s + r.xp, 0);
        const negDe = (mapa, a) => (mapa.get(a.id) || []).filter((r) => r.tipo === 'negativo').length;
        const semanaTop = alunos.map((a) => ({ aluno: a, xp: xpDe(semana, a) }))
            .filter((x) => x.xp > 0).sort((x, y) => y.xp - x.xp).slice(0, 3);
        const viradas = alunos
            .filter((a) => negDe(anterior, a) >= 2 && negDe(semana, a) === 0 && xpDe(semana, a) > 0)
            .map((a) => ({ aluno: a, antes: negDe(anterior, a), xp: xpDe(semana, a) }));
        return { semana: semanaTop, viradas };
    }

    function resumoPDT(estado, regras, perfil, turma, hoje) {
        const s = saude(estado, regras, turma, hoje);
        const d = destaques(estado, turma, hoje);
        const al = alertas(estado, regras, turma, hoje, perfil).filter((a) => a.nivel !== 'info');
        const pdt = perfil.pdts && perfil.pdts[turma];
        const linhas = [];
        linhas.push(`Saga — resumo da ${turma} (${perfil.sigla || perfil.nome}) em ${hoje.split('-').reverse().join('/')}`);
        if (pdt) linhas.push(`Para: PDT ${pdt}`);
        linhas.push('');
        linhas.push(`Últimas duas semanas: ${s.positivos} reconhecimentos e ${s.negativos} descontos.`);
        linhas.push(`Estudantes reconhecidos ao menos uma vez: ${Math.round(s.alcance * 100)}% da turma.`);
        if (s.caidos) linhas.push(`Nocauteados aguardando respawn: ${s.caidos}.`);
        if (d.semana.length) {
            linhas.push('');
            linhas.push('Destaques da semana:');
            for (const x of d.semana) linhas.push(`- ${x.aluno.nome} (+${x.xp} XP)`);
        }
        if (d.viradas.length) {
            linhas.push('');
            linhas.push('Viraram o jogo (tinham descontos e agora só reconhecimentos):');
            for (const x of d.viradas) linhas.push(`- ${x.aluno.nome}`);
        }
        if (al.length) {
            linhas.push('');
            linhas.push('Pedem atenção:');
            for (const a of al) linhas.push(`- ${a.titulo}. ${a.detalhe}`);
        }
        return linhas.join('\n');
    }

    const api = { NOMES_GUILDAS, diasEntre, saude, alertas, formarGuildas, equilibrio, sortear, destaques, resumoPDT };

    global.SagaConselheiro = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
