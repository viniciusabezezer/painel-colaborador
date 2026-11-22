/* Mapa de salas exportado pelo Randomizador (formato malu-mapa-salas, versão 1).
   Casa cada lugar com a lista colada, por turma e número, e devolve a ordem
   de impressão. Nome diferente vira aviso e não impede o casamento.
   Nada daqui sai do navegador: a função recebe o texto do arquivo e a lista
   que já estão na memória. */
(function (global) {
    'use strict';

    const identificacao = global.ProvasIdentificacao || (typeof require === 'function' ? require('./identificacao.js') : null);
    const lista = global.ProvasLista || (typeof require === 'function' ? require('./lista.js') : null);

    function turmaCurta(texto) {
        return lista.reconhecerTurma(texto);
    }

    function ler(entrada) {
        let dados = entrada;
        if (typeof entrada === 'string') {
            try {
                dados = JSON.parse(entrada);
            } catch (erro) {
                return { ok: false, motivo: 'json', mensagem: 'Este arquivo não é um JSON válido.' };
            }
        }
        if (!dados || typeof dados !== 'object' || Array.isArray(dados)) {
            return { ok: false, motivo: 'formato', mensagem: 'Este arquivo não é um mapa de salas.' };
        }
        if (dados.formato !== 'malu-mapa-salas') {
            return { ok: false, motivo: 'formato', mensagem: 'Este arquivo não é um mapa de salas do Randomizador.' };
        }
        if (Number(dados.versao) !== 1) {
            return { ok: false, motivo: 'versao', mensagem: 'Este mapa é de uma versão que o Identificador ainda não lê. Peça o arquivo na versão 1.' };
        }
        if (!Array.isArray(dados.salas)) {
            return { ok: false, motivo: 'salas', mensagem: 'O mapa não traz a lista de salas.' };
        }

        const ignorados = [];
        const salas = dados.salas.map(function (sala, indiceSala) {
            const ordemLida = parseInt(sala && sala.ordem, 10);
            const alunos = [];
            const brutos = sala && Array.isArray(sala.alunos) ? sala.alunos : [];
            brutos.forEach(function (aluno, indiceAluno) {
                const curta = turmaCurta(aluno && aluno.turma);
                const numero = parseInt(aluno && aluno.numero, 10);
                const posicao = parseInt(aluno && aluno.posicao, 10);
                if (!curta || !numero || numero < 1) {
                    ignorados.push((sala && sala.sala ? sala.sala : 'Sala ' + (indiceSala + 1)) + ', lugar ' + (indiceAluno + 1));
                    return;
                }
                alunos.push({
                    posicao: isNaN(posicao) ? indiceAluno + 1 : posicao,
                    turma: String((aluno && aluno.turma) || curta).replace(/\s+/g, ' ').trim(),
                    turmaCurta: curta,
                    serie: curta.charAt(0),
                    numero: numero,
                    nome: String((aluno && aluno.nome) || '').replace(/\s+/g, ' ').trim()
                });
            });
            alunos.sort(function (a, b) {
                return a.posicao - b.posicao || a.numero - b.numero;
            });
            return {
                sala: String((sala && sala.sala) || ('Sala ' + (indiceSala + 1))).replace(/\s+/g, ' ').trim(),
                ordem: isNaN(ordemLida) ? indiceSala + 1 : ordemLida,
                alunos: alunos
            };
        });
        salas.sort(function (a, b) {
            return a.ordem - b.ordem || a.sala.localeCompare(b.sala, 'pt');
        });

        const periodo = dados.periodo && typeof dados.periodo === 'object' ? {
            inicio: String(dados.periodo.inicio || ''),
            fim: String(dados.periodo.fim || '')
        } : null;

        return {
            ok: true,
            avaliacao: String(dados.avaliacao || '').replace(/\s+/g, ' ').trim(),
            periodo: periodo,
            geradoEm: String(dados.gerado_em || ''),
            salas: salas,
            ignorados: ignorados
        };
    }

    /* Casa o mapa com a lista já lida (a mesma estrutura de Lista.lerLote).
       A chave é turma curta + número. O nome da lista é o que vai para a prova;
       se o mapa escreveu outro, o aluno continua casado e o aviso fica à parte. */
    function casar(lote, mapa) {
        const grupos = Object.create(null);
        ((lote && lote.turmas) || []).forEach(function (turma) {
            const curta = turmaCurta(turma.turma);
            if (!curta) return;
            (turma.alunos || []).forEach(function (aluno) {
                const numero = parseInt(aluno.numero, 10);
                if (!numero || numero < 1) return;
                const chave = curta + '|' + numero;
                if (!grupos[chave]) grupos[chave] = [];
                grupos[chave].push({
                    turma: turma.turma,
                    turmaCurta: curta,
                    serie: String(turma.serie || curta.charAt(0)),
                    numero: numero,
                    nome: aluno.nome,
                    usado: false
                });
            });
        });

        function pegar(chave) {
            const fila = grupos[chave] || [];
            for (let i = 0; i < fila.length; i++) {
                if (!fila[i].usado) {
                    fila[i].usado = true;
                    return fila[i];
                }
            }
            return null;
        }

        const avisosNome = [];
        const semProva = [];
        const salas = (mapa.salas || []).map(function (sala) {
            const alunos = sala.alunos.map(function (aluno) {
                const daLista = pegar(aluno.turmaCurta + '|' + aluno.numero);
                const avisoNome = !!(daLista && identificacao.normalizarNome(aluno.nome) !== identificacao.normalizarNome(daLista.nome));
                if (avisoNome) {
                    avisosNome.push({
                        sala: sala.sala,
                        ordem: sala.ordem,
                        posicao: aluno.posicao,
                        turma: aluno.turma,
                        numero: aluno.numero,
                        nomeMapa: aluno.nome,
                        nomeLista: daLista.nome
                    });
                }
                if (!daLista) {
                    semProva.push({
                        sala: sala.sala,
                        ordem: sala.ordem,
                        posicao: aluno.posicao,
                        turma: aluno.turma,
                        turmaCurta: aluno.turmaCurta,
                        numero: aluno.numero,
                        nome: aluno.nome
                    });
                }
                return {
                    posicao: aluno.posicao,
                    turma: daLista ? daLista.turma : aluno.turma,
                    turmaMapa: aluno.turma,
                    turmaCurta: aluno.turmaCurta,
                    serie: aluno.serie,
                    numero: aluno.numero,
                    nome: daLista ? daLista.nome : aluno.nome,
                    nomeMapa: aluno.nome,
                    casado: !!daLista,
                    avisoNome: avisoNome
                };
            });
            return { sala: sala.sala, ordem: sala.ordem, alunos: alunos };
        });

        const semSala = [];
        Object.keys(grupos).forEach(function (chave) {
            grupos[chave].forEach(function (aluno) {
                if (!aluno.usado) semSala.push(aluno);
            });
        });
        semSala.sort(function (a, b) {
            if (a.turmaCurta < b.turmaCurta) return -1;
            if (a.turmaCurta > b.turmaCurta) return 1;
            return a.numero - b.numero;
        });

        const casados = salas.reduce(function (soma, sala) {
            return soma + sala.alunos.filter(function (aluno) { return aluno.casado; }).length;
        }, 0);

        return {
            avaliacao: mapa.avaliacao || '',
            periodo: mapa.periodo || null,
            salas: salas,
            semSala: semSala,
            semProva: semProva,
            avisosNome: avisosNome,
            casados: casados
        };
    }

    /* Ordem de impressão: salas pela `ordem`, alunos pela `posicao`.
       Cada aluno recebe os componentes cuja série tem arquivo (`chaves`,
       no formato "1|NAT"). Sala misturada intercala as provas certas.
       A reserva de cada série/componente presente fica no fim da sala. */
    function plano(casamento, chaves) {
        const tem = Object.create(null);
        (chaves || []).forEach(function (chave) { tem[chave] = true; });
        const ordemComponente = Object.create(null);
        identificacao.COMPONENTES.forEach(function (componente, indice) {
            ordemComponente[componente.codigo] = indice;
        });
        const semArquivo = [];
        const salas = [];

        (casamento.salas || []).forEach(function (sala) {
            const vias = [];
            const series = Object.create(null);
            sala.alunos.forEach(function (aluno) {
                if (!aluno.casado) return;
                const comps = identificacao.COMPONENTES
                    .map(function (componente) { return componente.codigo; })
                    .filter(function (codigo) { return tem[aluno.serie + '|' + codigo]; });
                if (!comps.length) {
                    if ((chaves || []).length) {
                        semArquivo.push({
                            sala: sala.sala,
                            posicao: aluno.posicao,
                            turma: aluno.turmaMapa || aluno.turma,
                            numero: aluno.numero,
                            nome: aluno.nome,
                            serie: aluno.serie
                        });
                    }
                    return;
                }
                comps.forEach(function (codigo) {
                    series[aluno.serie + '|' + codigo] = true;
                    vias.push({
                        posicao: aluno.posicao,
                        turma: aluno.turmaMapa || aluno.turma,
                        turmaCurta: aluno.turmaCurta,
                        serie: aluno.serie,
                        numero: aluno.numero,
                        nome: aluno.nome,
                        componente: codigo,
                        chave: aluno.serie + '|' + codigo
                    });
                });
            });
            const reservas = Object.keys(series).map(function (chave) {
                const partes = chave.split('|');
                return { serie: partes[0], componente: partes[1], chave: chave };
            }).sort(function (a, b) {
                return Number(a.serie) - Number(b.serie) || ordemComponente[a.componente] - ordemComponente[b.componente];
            });
            if (!vias.length) return;
            salas.push({
                sala: sala.sala,
                ordem: sala.ordem,
                vias: vias,
                reservas: reservas,
                provas: vias.length
            });
        });

        return {
            salas: salas,
            provas: salas.reduce(function (soma, sala) { return soma + sala.provas; }, 0),
            semArquivo: semArquivo
        };
    }

    const api = {
        ler: ler,
        casar: casar,
        plano: plano,
        turmaCurta: turmaCurta
    };

    global.ProvasMapa = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
