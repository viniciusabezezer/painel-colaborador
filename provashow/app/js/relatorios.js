/* Relatórios:
   - Placar da turma (aluno × pergunta), por período (hoje, semana, mês,
     bimestre, ano, tudo ou datas escolhidas), ordenado por nome, nota ou
     cartão; tirar uma pergunta da nota; imprimir; planilha CSV;
   - Aulas dadas: o relatório de cada conjunto apresentado;
   - Relatório do aluno (imprimível; um ou a turma inteira);
   - Perguntas para retomar (as que a turma mais errou). */
(function () {
    'use strict';
    const { esc } = PS;
    const L = Dados.LETRAS;
    const f = { turma: '', periodo: 'tudo', de: '', ate: '', ordenar: 'nome' };

    function sessoesDa(t) {
        return PS.d.sessoes.filter((s) => s.turmaId === t.id && Dados.dentroDoPeriodo(s, f.de, f.ate)).sort((a, b) => a.data.localeCompare(b.data));
    }

    const classePct = (p) => (p == null ? '' : p >= 70 ? 'bom' : p >= 50 ? 'medio' : 'baixo');

    PS.telas.relatorios = function (turmaId) {
        const turmas = Dados.ativos(PS.d.turmas);
        if (turmaId) f.turma = turmaId;
        const t = PS.turma(f.turma) || turmas.find((x) => !x.arquivada) || turmas[0];
        if (!t) { PS.$('#conteudo').innerHTML = '<h1>Relatórios</h1><p class="vazio">Sem turmas ainda.</p>'; return; }
        f.turma = t.id;
        const sessoes = sessoesDa(t);
        const r = Dados.relatorioTurma(t, sessoes, { ordenar: f.ordenar });
        const retomar = Dados.maisErradas(r, 5);
        const periodos = [['dia', 'Hoje'], ['semana', 'Semana'], ['mes', 'Mês'], ['bimestre', 'Bimestre'], ['ano', 'Ano'], ['tudo', 'Tudo']];
        PS.$('#conteudo').innerHTML = `
            <div class="cabeca">
                <div><h1>Relatórios</h1><p class="sub">Cada pergunta apresentada fica registrada com a resposta de cada aluno.</p></div>
                <div class="botoes">
                    <a class="btn" href="#aulas/${t.id}">📊 Aulas dadas</a>
                    <button class="btn" data-acao="imprimir-placar" ${sessoes.length ? '' : 'disabled'}>🖨 Imprimir</button>
                    <button class="btn" data-acao="baixar-planilha" ${sessoes.length ? '' : 'disabled'}>⬇ CSV</button>
                    <button class="btn" data-acao="relatorios-alunos" ${sessoes.length ? '' : 'disabled'}>📄 Relatórios dos alunos</button>
                </div>
            </div>
            <div class="filtros cartao-painel">
                <div><label for="filtro-turma">Turma</label><select id="filtro-turma">${turmas.map((x) => `<option value="${x.id}" ${x === t ? 'selected' : ''}>${esc(x.nome)}${x.arquivada ? ' (arquivada)' : ''}</option>`).join('')}</select></div>
                <div class="periodos" role="group" aria-label="Período">${periodos.map(([v, n]) => `<button class="btn btn-p ${f.periodo === v ? 'btn-principal' : ''}" data-acao="periodo" data-periodo="${v}">${n}</button>`).join('')}</div>
                <div class="datas"><label>De <input type="date" id="filtro-de" value="${f.de}"></label><label>Até <input type="date" id="filtro-ate" value="${f.ate}"></label></div>
                <div><label for="filtro-ordem">Ordenar</label><select id="filtro-ordem"><option value="nome">Nome</option><option value="nota">Nota (maior primeiro)</option><option value="cartao">Cartão</option></select></div>
            </div>
            ${!sessoes.length ? '<p class="vazio">Nenhuma pergunta apresentada nesse período.</p>' : `
            <div class="resumo-turma">
                <div class="cartao-painel numero-grande"><strong>${r.media == null ? '—' : r.media + '%'}</strong><span>média da turma</span></div>
                <div class="cartao-painel numero-grande"><strong>${sessoes.length}</strong><span>perguntas</span></div>
                <div class="cartao-painel numero-grande"><strong>${new Set(sessoes.map((s) => s.aulaId)).size}</strong><span>aulas</span></div>
                <div class="cartao-painel numero-grande"><strong>${r.alunos.filter((a) => a.percentual != null && a.percentual < 50).length}</strong><span>alunos abaixo de 50%</span></div>
            </div>
            <div class="cartao-painel rolagem area-impressao">
                <h2 class="so-impressao">${esc(t.nome)} — placar ${f.de || f.ate ? `(${f.de ? PS.dataCurta(f.de + 'T12:00') : '…'} a ${f.ate ? PS.dataCurta(f.ate + 'T12:00') : '…'})` : ''}</h2>
                <table class="placar">
                    <thead><tr><th class="fixa">Aluno</th><th>%</th>${r.sessoes.map((s, i) => `<th class="${s.ignorada ? 'ignorada' : ''}"><button class="cabeca-q" data-acao="ver-sessao" data-sessao="${s.id}" title="${esc(PS.simples(s.questao.enunciado))}"><span class="q">Q${i + 1}</span><small>${PS.dataCurta(s.data).slice(0, 5)}</small></button></th>`).join('')}</tr></thead>
                    <tbody>${r.alunos.map((a) => `<tr class="${a.arquivado ? 'arquivado' : ''}">
                        <td class="fixa"><a href="#relatorio-aluno/${t.id}/${a.id}"><span class="n">${a.cartao}</span> ${esc(a.nome)}${a.arquivado ? ' <small>(arquivado)</small>' : ''}</a></td>
                        <td class="pct ${classePct(a.percentual)}">${a.percentual == null ? '—' : a.percentual + '%'}</td>
                        ${r.sessoes.map((s) => {
                            const resp = s.respostas[a.cartao];
                            const classe = !resp ? 'sem' : !Dados.avaliada(s.questao) ? 'enquete' : Dados.acertou(s.questao, resp) ? 'certo' : 'errado';
                            return `<td class="cel ${classe} ${s.ignorada ? 'ignorada' : ''}">${resp || '·'}</td>`;
                        }).join('')}
                    </tr>`).join('')}</tbody>
                    <tfoot><tr><td class="fixa">Acerto da turma</td><td></td>${r.sessoes.map((s) => `<td class="pct ${classePct(s.percentual)}">${s.percentual == null ? '—' : s.percentual + '%'}</td>`).join('')}</tr></tfoot>
                </table>
                <p class="sub legenda"><span class="cel certo">B</span> certo · <span class="cel errado">C</span> errado · <span class="cel enquete">A</span> enquete · <span class="cel sem">·</span> sem resposta · colunas apagadas estão fora da nota · clique no Q para ver a pergunta</p>
            </div>
            ${retomar.length ? `<h2 class="titulo-secao">Para retomar em aula</h2><div class="lista-retomar">${retomar.map((s) => `<button class="cartao-painel retomar" data-acao="ver-sessao" data-sessao="${s.id}">
                <span class="pct ${classePct(s.percentual)}">${s.percentual}%</span><span>${PS.html(s.questao.enunciado)}</span><small>${PS.dataCurta(s.data)}</small></button>`).join('')}</div>` : ''}`}`;
        PS.$('#filtro-ordem').value = f.ordenar;
        PS.$('#filtro-turma').onchange = (e) => { f.turma = e.target.value; PS.telas.relatorios(); };
        PS.$('#filtro-ordem').onchange = (e) => { f.ordenar = e.target.value; PS.telas.relatorios(); };
        PS.$('#filtro-de').onchange = PS.$('#filtro-ate').onchange = () => { f.de = PS.$('#filtro-de').value; f.ate = PS.$('#filtro-ate').value; f.periodo = ''; PS.telas.relatorios(); };
    };

    function verSessao(id) {
        const s = PS.d.sessoes.find((x) => x.id === id);
        if (!s) return;
        const t = PS.turma(s.turmaId);
        const cont = Dados.contagem(s);
        const total = Math.max(1, Object.keys(s.respostas).length);
        const alunos = t.alunos.slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
        PS.dialogo(`<p class="sub">${esc(s.conjuntoTitulo || '')} · ${PS.dataCurta(s.data)} às ${PS.horaCurta(s.data)}</p>
            <h2>${PS.html(s.questao.enunciado)}</h2>
            ${s.questao.opcoes.map((o, k) => `<div class="mini-barra ${Dados.corretasDe(s.questao).includes(L[k]) ? 'certa' : ''}"><span class="letra letra-${L[k]}">${L[k]}</span><span class="texto">${PS.html(o)}</span><span class="barra"><i class="letra-${L[k]}" style="width:${Math.round(cont[L[k]] / total * 100)}%"></i></span><span>${cont[L[k]]}</span></div>`).join('')}
            <div class="respostas-alunos">${alunos.filter((a) => s.respostas[a.cartao] || !a.arquivado).map((a) => {
                const r = s.respostas[a.cartao];
                const c = !r ? 'sem' : !Dados.avaliada(s.questao) ? 'enquete' : Dados.acertou(s.questao, r) ? 'certo' : 'errado';
                const o = (s.origem || {})[a.cartao];
                return `<span class="${c}">${esc(a.nome)}: <b>${r || '—'}</b>${o === 'aparelho' ? ' 📱' : o === 'manual' ? ' ✋' : ''}</span>`;
            }).join('')}</div>
            <label class="interruptor"><input type="checkbox" id="ignorar" ${s.ignorada ? 'checked' : ''}> Fora da nota (a pergunta continua no relatório, mas não conta no %)</label>
            ${Dados.avaliada(s.questao) ? `<label for="trocar-certa">Corrigir o gabarito desta aula</label><select id="trocar-certa">${s.questao.opcoes.map((o, k) => `<option value="${L[k]}" ${Dados.corretasDe(s.questao).join() === L[k] ? 'selected' : ''}>${L[k]}</option>`).join('')}<option value="" ${Dados.corretasDe(s.questao).length > 1 ? 'selected' : ''}>(manter como está)</option></select>` : ''}`,
        (dlg) => {
            s.ignorada = dlg.querySelector('#ignorar').checked;
            const tc = dlg.querySelector('#trocar-certa');
            if (tc && tc.value) s.questao.corretas = [tc.value];
            s.alterado = new Date().toISOString();
            PS.salvar(); PS.desenhar();
        }, {
            largo: true, confirmar: 'Salvar',
            aoAbrir: (dlg) => {
                const b = document.createElement('button');
                b.type = 'button'; b.className = 'btn btn-perigo'; b.textContent = 'Apagar este registro';
                b.onclick = () => { dlg.close(); PS.confirmar('Apagar o registro desta pergunta?', () => { PS.d.sessoes = PS.d.sessoes.filter((x) => x !== s); PS.salvar(); PS.desenhar(); }); };
                dlg.querySelector('.dialogo-botoes').prepend(b);
            }
        });
    }

    /* ----- aulas dadas ----- */
    PS.telas.aulas = function (turmaId) {
        const t = PS.turma(turmaId || f.turma);
        const aulas = PS.d.aulas.filter((a) => !t || a.turmaId === t.id).sort((a, b) => b.inicio.localeCompare(a.inicio));
        PS.$('#conteudo').innerHTML = `
            <a class="voltar" href="#relatorios">&larr; Relatórios</a>
            <div class="cabeca"><div><h1>Aulas dadas${t ? ' — ' + esc(t.nome) : ''}</h1><p class="sub">Cada conjunto apresentado gera um relatório.</p></div></div>
            <div class="lista-itens">${aulas.map((a) => {
                const ss = PS.d.sessoes.filter((s) => s.aulaId === a.id);
                const tm = PS.turma(a.turmaId);
                const r = tm ? Dados.relatorioTurma(tm, ss) : null;
                return `<a class="linha-item linha-principal" href="#relatorio-aula/${a.id}"><span class="icone-item">📊</span>
                    <span class="linha-texto"><strong>${esc(a.titulo)}</strong><small>${PS.dataCurta(a.inicio)} às ${PS.horaCurta(a.inicio)} · ${tm ? esc(tm.nome) : ''} · ${PS.plural(ss.length, 'pergunta')}${r && r.media != null ? ' · média ' + r.media + '%' : ''}</small></span></a>`;
            }).join('') || '<p class="vazio">Nenhuma aula dada ainda.</p>'}</div>`;
    };

    PS.telas['relatorio-aula'] = function (id) {
        const a = PS.aula(id);
        if (!a) { PS.ir('aulas'); return; }
        const t = PS.turma(a.turmaId);
        const ss = PS.d.sessoes.filter((s) => s.aulaId === a.id).sort((x, y) => x.data.localeCompare(y.data));
        const r = Dados.relatorioTurma(t, ss, { ordenar: 'nome' });
        PS.$('#conteudo').innerHTML = `
            <a class="voltar" href="#aulas/${t.id}">&larr; Aulas dadas</a>
            <div class="cabeca"><div><span class="selo" style="--cor:${t.cor}">${esc(t.nome)}</span><h1>${esc(a.titulo)}</h1><p class="sub">${PS.dataCurta(a.inicio)}, das ${PS.horaCurta(a.inicio)}${a.fim ? ' às ' + PS.horaCurta(a.fim) : ''} · média ${r.media == null ? '—' : r.media + '%'}</p></div>
            <div class="botoes"><button class="btn" onclick="print()">🖨 Imprimir</button><button class="btn" data-acao="reapresentar" data-turma="${t.id}" data-conjunto="${a.conjuntoId}" ${PS.conjunto(a.conjuntoId) && !PS.conjunto(a.conjuntoId).removido ? '' : 'disabled'}>▶ Apresentar de novo</button></div></div>
            <div class="lista-sessoes area-impressao">${ss.map((s, i) => {
                const rs = r.sessoes[i];
                const cont = Dados.contagem(s);
                const total = Math.max(1, rs.responderam);
                return `<article class="cartao-painel sessao">
                    <div class="secao-topo"><span class="selo">Q${i + 1}</span><small>${rs.responderam} responderam${rs.percentual == null ? ' · enquete' : ` · ${rs.percentual}% de acerto`}${s.ignorada ? ' · fora da nota' : ''}</small>
                    <button class="btn btn-p" data-acao="ver-sessao" data-sessao="${s.id}">Detalhes</button></div>
                    <h3>${PS.html(s.questao.enunciado)}</h3>
                    ${s.questao.opcoes.map((o, k) => `<div class="mini-barra ${Dados.corretasDe(s.questao).includes(L[k]) ? 'certa' : ''}"><span class="letra letra-${L[k]}">${L[k]}</span><span class="texto">${PS.html(o)}</span><span class="barra"><i class="letra-${L[k]}" style="width:${Math.round(cont[L[k]] / total * 100)}%"></i></span><span>${cont[L[k]]}</span></div>`).join('')}
                </article>`;
            }).join('')}</div>`;
    };

    /* ----- relatório do aluno ----- */
    function htmlRelatorioAluno(t, a) {
        const ss = sessoesDa(t);
        const r = Dados.relatorioAluno(t, a, ss);
        return `<article class="relatorio-aluno">
            <header><div><h2>${esc(a.nome)}</h2><p>${esc(t.nome)} · cartão ${a.cartao}${f.de || f.ate ? ` · ${f.de ? PS.dataCurta(f.de + 'T12:00') : 'início'} a ${f.ate ? PS.dataCurta(f.ate + 'T12:00') : 'hoje'}` : ''}</p></div>
            <div class="nota-aluno ${classePct(r.resumo.percentual)}"><strong>${r.resumo.percentual == null ? '—' : r.resumo.percentual + '%'}</strong><small>${r.resumo.acertos} de ${r.resumo.avaliadas} certas · turma: ${r.mediaTurma == null ? '—' : r.mediaTurma + '%'}</small></div></header>
            <table><thead><tr><th>Data</th><th>Pergunta</th><th>Resposta</th><th>Certa</th></tr></thead><tbody>
            ${r.itens.map((i) => `<tr class="${i.situacao}${i.ignorada ? ' ignorada' : ''}"><td>${PS.dataCurta(i.data)}</td><td>${PS.html(i.enunciado)}</td>
                <td>${i.resposta ? `${i.resposta}) ${PS.html(i.opcoes[L.indexOf(i.resposta)] || '')}` : '—'}</td>
                <td>${i.situacao === 'enquete' ? 'enquete' : i.corretas.join(', ')}${i.situacao === 'certo' ? ' ✔' : i.situacao === 'errado' ? ' ✗' : ''}</td></tr>`).join('')}
            </tbody></table></article>`;
    }

    PS.telas['relatorio-aluno'] = function (turmaId, alunoId) {
        const t = PS.turma(turmaId);
        const a = t && t.alunos.find((x) => x.id === alunoId);
        if (!a) { PS.ir('relatorios'); return; }
        f.turma = t.id;
        PS.$('#conteudo').innerHTML = `
            <a class="voltar" href="#relatorios/${t.id}">&larr; Placar da turma</a>
            <div class="cabeca nao-imprimir"><h1>Relatório do aluno</h1><button class="btn btn-principal" onclick="print()">🖨 Imprimir / salvar PDF</button></div>
            <p class="sub nao-imprimir">Período do placar: ${f.de || f.ate ? `${f.de || 'início'} a ${f.ate || 'hoje'}` : 'tudo'} (mude no placar).</p>
            <div class="area-impressao">${htmlRelatorioAluno(t, a)}</div>`;
    };

    Object.assign(PS.acoes, {
        'periodo': (e, b) => { f.periodo = b.dataset.periodo; Object.assign(f, Dados.periodo(f.periodo)); PS.telas.relatorios(); },
        'ver-sessao': (e, b) => verSessao(b.dataset.sessao),
        'imprimir-placar': () => print(),
        'baixar-planilha': () => {
            const t = PS.turma(f.turma);
            PS.baixar(`provashow-${PS.nomeArquivo(t.nome)}.csv`, Dados.csvRelatorio(t, Dados.relatorioTurma(t, sessoesDa(t), { ordenar: f.ordenar })), 'text/csv;charset=utf-8');
        },
        'relatorios-alunos': () => {
            const t = PS.turma(f.turma);
            const w = window.open('', '_blank');
            if (!w) { PS.avisar('Permita janelas deste site para imprimir.'); return; }
            const alunos = t.alunos.filter((a) => !a.arquivado).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
            w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatórios — ${esc(t.nome)}</title><link rel="stylesheet" href="${new URL('../estilo.css', location.href)}"><link rel="stylesheet" href="${new URL('app.css', location.href)}"></head>
                <body class="pagina-relatorios">${alunos.map((a) => htmlRelatorioAluno(t, a)).join('')}<script>onload=()=>setTimeout(print,300)<\/script></body></html>`);
            w.document.close();
        },
        'reapresentar': (e, b) => PS.comecarAula(b.dataset.turma, b.dataset.conjunto)
    });
})();
