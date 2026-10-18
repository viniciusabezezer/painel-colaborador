/* Turmas: alunos com número de cartão (trocar troca com o colega),
   alunos arquivados (saem da chamada, mas os resultados ficam), cor da
   turma, turma arquivada, fila do que vai ser apresentado, últimas aulas e
   os links pessoais para quem responde pelo próprio aparelho (modo aluno). */
(function () {
    'use strict';
    const { esc } = PS;
    const vista = { arquivadas: false, aba: 'fila' };

    const ultimaAula = (t) => PS.d.aulas.filter((a) => a.turmaId === t.id).sort((a, b) => b.inicio.localeCompare(a.inicio))[0];

    PS.telas.turmas = function () {
        const turmas = Dados.ativos(PS.d.turmas).filter((t) => !!t.arquivada === vista.arquivadas);
        const nArquivadas = Dados.ativos(PS.d.turmas).filter((t) => t.arquivada).length;
        PS.$('#conteudo').innerHTML = `
            <div class="cabeca">
                <div><h1>${vista.arquivadas ? 'Turmas arquivadas' : 'Turmas'}</h1>
                <p class="sub">Até 63 alunos por turma, cada um com o seu número de cartão. O mesmo jogo de cartões serve para todas as turmas.</p></div>
                <div class="botoes">
                    ${nArquivadas || vista.arquivadas ? `<button class="btn" data-acao="ver-arquivadas">${vista.arquivadas ? '← Turmas ativas' : `🗄 Arquivadas (${nArquivadas})`}</button>` : ''}
                    ${vista.arquivadas ? '' : '<button class="btn btn-principal" data-acao="nova-turma">+ Nova turma</button>'}
                </div>
            </div>
            <div class="grade-cartoes">
                ${turmas.map((t) => {
                    const u = ultimaAula(t);
                    return `<a class="cartao-painel item-turma" href="#turma/${t.id}" style="--cor:${t.cor}">
                        <h3>${esc(t.nome)}</h3>
                        <p>${PS.plural(PS.alunosAtivos(t).length, 'aluno')} · ${t.fila.filter((id) => PS.conjunto(id) && !PS.conjunto(id).removido).length} na fila</p>
                        <small>${u ? 'Última aula: ' + PS.dataCurta(u.inicio) : 'Nenhuma aula ainda'}</small>
                    </a>`;
                }).join('') || `<p class="vazio">${vista.arquivadas ? 'Nenhuma turma arquivada.' : 'Nenhuma turma ainda.'}</p>`}
            </div>`;
    };

    PS.novaTurma = function (nome) {
        const usadas = new Set(PS.d.turmas.map((t) => t.cor));
        const t = {
            id: Dados.novoId(), nome: nome || 'Nova turma', cor: Dados.CORES.find((c) => !usadas.has(c)) || Dados.CORES[PS.d.turmas.length % Dados.CORES.length],
            arquivada: false, alunos: [], fila: [], alterado: new Date().toISOString(), removido: null
        };
        PS.d.turmas.push(t);
        PS.salvar();
        return t;
    };

    PS.telas.turma = function (id, aba) {
        const t = PS.turma(id);
        if (!t || t.removido) { PS.ir('turmas'); return; }
        if (aba) vista.aba = aba;
        const conteudo = PS.$('#conteudo');
        conteudo.dataset.turma = t.id;
        const ativos = PS.alunosAtivos(t).sort((a, b) => a.cartao - b.cartao);
        const arquivados = t.alunos.filter((a) => a.arquivado);
        const fila = t.fila.map(PS.conjunto).filter((c) => c && !c.removido);
        const aulas = PS.d.aulas.filter((a) => a.turmaId === t.id).sort((a, b) => b.inicio.localeCompare(a.inicio)).slice(0, 12);
        conteudo.innerHTML = `
            <a class="voltar" href="#turmas">&larr; Turmas</a>
            <div class="cabeca cabeca-turma" style="--cor:${t.cor}">
                <div class="cabeca-texto">
                    <input class="titulo-editavel" type="text" value="${esc(t.nome)}" data-campo="nome-turma" aria-label="Nome da turma" maxlength="80">
                    <div class="cores" role="radiogroup" aria-label="Cor da turma">${Dados.CORES.map((c) => `<button class="cor ${c === t.cor ? 'ativa' : ''}" style="--cor:${c}" data-acao="cor-turma" data-cor="${c}" aria-label="Cor ${c}" role="radio" aria-checked="${c === t.cor}"></button>`).join('')}</div>
                    ${t.arquivada ? '<span class="selo selo-cinza">Turma arquivada</span>' : ''}
                </div>
                <div class="botoes">
                    ${fila.length && !t.arquivada ? `<button class="btn btn-verde" data-acao="apresentar-fila" data-conjunto="${fila[0].id}">▶ Apresentar “${esc(fila[0].titulo)}”</button>` : ''}
                    <a class="btn" href="../cartoes/?turma=${encodeURIComponent(t.id)}" target="_blank" rel="noopener">🖨 Cartões com nomes</a>
                    <button class="btn btn-p btn-icone" data-acao="menu-turma" aria-label="Mais opções da turma">⋯</button>
                </div>
            </div>
            <div class="abas-internas" role="tablist">
                <button role="tab" class="${vista.aba === 'fila' ? 'ativa' : ''}" data-acao="aba-turma" data-aba-interna="fila">Fila (${fila.length})</button>
                <button role="tab" class="${vista.aba === 'alunos' ? 'ativa' : ''}" data-acao="aba-turma" data-aba-interna="alunos">Alunos (${ativos.length})</button>
                <button role="tab" class="${vista.aba === 'aulas' ? 'ativa' : ''}" data-acao="aba-turma" data-aba-interna="aulas">Aulas dadas (${PS.d.aulas.filter((a) => a.turmaId === t.id).length})</button>
            </div>
            ${vista.aba === 'fila' ? `<section class="cartao-painel">
                <p class="sub">O que vai ser apresentado nesta turma, na ordem. Ao terminar um conjunto na aula, ele sai da fila sozinho.</p>
                <ol class="fila">${fila.map((c, i) => `<li data-fila="${c.id}">
                    <div><strong>${esc(c.titulo)}</strong><small>${PS.plural(c.questoes.length, 'pergunta')}</small></div>
                    <div class="botoes">
                        <button class="btn btn-p btn-verde" data-acao="apresentar-fila" data-conjunto="${c.id}" ${t.arquivada ? 'disabled' : ''}>▶ Apresentar</button>
                        <button class="btn btn-p btn-icone" data-acao="fila-subir" ${i === 0 ? 'disabled' : ''} title="Subir">↑</button>
                        <button class="btn btn-p btn-icone btn-perigo" data-acao="fila-tirar" title="Tirar da fila">✕</button>
                    </div></li>`).join('') || '<li class="vazio">A fila está vazia.</li>'}</ol>
                <button class="btn btn-p" data-acao="fila-adicionar">+ Pôr conjuntos na fila</button>
            </section>` : ''}
            ${vista.aba === 'alunos' ? `<section class="cartao-painel">
                <div class="secao-topo">
                    <p class="sub">Mudar o número de um cartão para um que já é de outro aluno faz os dois trocarem.</p>
                    <div class="botoes">
                        <button class="btn btn-p" data-acao="links-alunos">📱 Links para responder pelo aparelho</button>
                        <button class="btn btn-p" data-acao="colar-alunos">📋 Colar lista</button>
                        <button class="btn btn-p btn-principal" data-acao="novo-aluno">+ Aluno</button>
                    </div>
                </div>
                ${ativos.length ? `<table class="tabela-alunos"><thead><tr><th>Cartão</th><th>Nome</th><th></th></tr></thead><tbody>
                    ${ativos.map((a) => `<tr data-aluno="${a.id}">
                        <td><input type="number" min="1" max="63" value="${a.cartao}" data-campo="cartao-aluno" aria-label="Cartão de ${esc(a.nome)}"></td>
                        <td><input type="text" value="${esc(a.nome)}" data-campo="nome-aluno" aria-label="Nome do aluno" maxlength="80"></td>
                        <td class="acoes-aluno">
                            <a class="btn btn-p btn-icone" href="#relatorio-aluno/${t.id}/${a.id}" title="Relatório do aluno">📄</a>
                            <button class="btn btn-p btn-icone" data-acao="arquivar-aluno" title="Arquivar (sai da chamada, os resultados ficam)">🗄</button>
                            <button class="btn btn-p btn-icone btn-perigo" data-acao="excluir-aluno" title="Excluir aluno">✕</button>
                        </td></tr>`).join('')}</tbody></table>` : '<p class="vazio">Nenhum aluno. Cole a lista da chamada ou adicione um por um.</p>'}
                ${arquivados.length ? `<details class="arquivados"><summary>Alunos arquivados (${arquivados.length})</summary>
                    <ul>${arquivados.map((a) => `<li data-aluno="${a.id}"><span>${esc(a.nome)} <small>(era o cartão ${a.cartao})</small></span>
                    <button class="btn btn-p" data-acao="reativar-aluno">↺ Voltar para a turma</button>
                    <button class="btn btn-p btn-perigo" data-acao="excluir-aluno">Excluir</button></li>`).join('')}</ul></details>` : ''}
            </section>` : ''}
            ${vista.aba === 'aulas' ? `<section class="cartao-painel">
                <div class="lista-itens">${aulas.map((a) => {
                    const s = PS.d.sessoes.filter((x) => x.aulaId === a.id);
                    return `<a class="linha-item linha-principal" href="#relatorio-aula/${a.id}"><span class="icone-item">📊</span>
                    <span class="linha-texto"><strong>${esc(a.titulo)}</strong><small>${PS.dataCurta(a.inicio)} às ${PS.horaCurta(a.inicio)} · ${PS.plural(s.length, 'pergunta')}</small></span></a>`;
                }).join('') || '<p class="vazio">Nenhuma aula dada ainda.</p>'}</div>
                <a class="btn btn-p" href="#relatorios/${t.id}">Ver o placar da turma →</a>
            </section>` : ''}`;
    };

    function editarTurma(e) {
        const t = PS.turma(PS.$('#conteudo').dataset.turma);
        if (!t) return;
        const campo = e.target.dataset.campo;
        if (campo === 'nome-turma') t.nome = e.target.value;
        const linha = e.target.closest('[data-aluno]');
        const a = linha && t.alunos.find((x) => x.id === linha.dataset.aluno);
        if (a && campo === 'nome-aluno') a.nome = e.target.value;
        PS.tocar(t);
    }
    document.addEventListener('input', (e) => { if (PS.rota().nome === 'turma' && e.target.dataset.campo && e.target.dataset.campo !== 'cartao-aluno') editarTurma(e); });
    document.addEventListener('change', (e) => {
        if (PS.rota().nome !== 'turma' || e.target.dataset.campo !== 'cartao-aluno') return;
        const t = PS.turma(PS.$('#conteudo').dataset.turma);
        const a = t.alunos.find((x) => x.id === e.target.closest('[data-aluno]').dataset.aluno);
        const n = parseInt(e.target.value, 10);
        const dono = t.alunos.find((x) => x.cartao === n && x !== a && !x.arquivado);
        if (Dados.trocarCartao(t, a, n)) {
            PS.salvar();
            if (dono) PS.avisar(`${dono.nome || 'O colega'} ficou com o cartão ${dono.cartao}.`);
        } else PS.avisar('Use um número de 1 a 63.');
        PS.telas.turma(t.id);
    });

    const turmaAtual = () => PS.turma(PS.$('#conteudo').dataset.turma);
    const alunoDo = (e) => { const t = turmaAtual(); return { t, a: t.alunos.find((x) => x.id === e.target.closest('[data-aluno]').dataset.aluno) }; };

    PS.linkAluno = (a) => new URL('../aluno/?k=' + a.chave, location.href).href;

    Object.assign(PS.acoes, {
        'ver-arquivadas': () => { vista.arquivadas = !vista.arquivadas; PS.telas.turmas(); },
        'nova-turma': () => PS.perguntar('Nome da turma', '', (nome) => { const t = PS.novaTurma(nome); vista.aba = 'alunos'; PS.ir('turma/' + t.id); }),
        'aba-turma': (e, b) => { vista.aba = b.dataset.abaInterna; PS.telas.turma(turmaAtual().id); },
        'cor-turma': (e, b) => { const t = turmaAtual(); t.cor = b.dataset.cor; PS.tocar(t); PS.telas.turma(t.id); },
        'menu-turma': (e, b) => {
            const t = turmaAtual();
            const itens = [
                [t.arquivada ? '↺ Desarquivar turma' : '🗄 Arquivar turma (fim do ano)', () => { t.arquivada = !t.arquivada; PS.tocar(t); PS.telas.turma(t.id); }],
                ['⧉ Duplicar turma (mesmos alunos)', () => {
                    const n = PS.novaTurma(t.nome + ' (cópia)');
                    n.alunos = PS.alunosAtivos(t).map((a) => ({ id: Dados.novoId(), nome: a.nome, cartao: a.cartao, arquivado: false, chave: Dados.novaChave() }));
                    PS.salvar(); PS.ir('turma/' + n.id);
                }],
                ['📊 Placar da turma', () => PS.ir('relatorios/' + t.id)],
                ['🗑 Excluir turma', () => { Dados.remover(t); PS.salvar(); PS.ir('turmas'); PS.avisar(`Turma “${t.nome}” na lixeira.`, () => { Dados.restaurar(t); PS.salvar(); PS.desenhar(); }); }]
            ];
            const m = document.createElement('div');
            m.className = 'menu menu-flutuante';
            m.innerHTML = itens.map(([x], k) => `<button data-k="${k}" class="${k === itens.length - 1 ? 'btn-perigo' : ''}">${x}</button>`).join('');
            document.body.appendChild(m);
            const r = b.getBoundingClientRect();
            m.style.top = (window.scrollY + r.bottom + 4) + 'px';
            m.style.left = Math.max(8, r.right - m.offsetWidth) + 'px';
            m.onclick = (ev) => { const x = ev.target.closest('[data-k]'); if (x) { m.remove(); itens[+x.dataset.k][1](); } };
            setTimeout(() => document.addEventListener('click', function fora(ev) { if (!m.contains(ev.target)) { m.remove(); document.removeEventListener('click', fora); } }), 0);
        },
        'novo-aluno': () => {
            const t = turmaAtual();
            const n = Dados.proximoCartao(new Set(PS.alunosAtivos(t).map((a) => a.cartao)));
            if (n > 63) { PS.avisar('Os 63 cartões já estão em uso nesta turma.'); return; }
            const a = { id: Dados.novoId(), nome: '', cartao: n, arquivado: false, chave: Dados.novaChave() };
            t.alunos.push(a);
            PS.tocar(t); PS.telas.turma(t.id);
            const campo = PS.$(`[data-aluno="${a.id}"] input[type=text]`);
            if (campo) campo.focus();
        },
        'arquivar-aluno': (e) => { const { t, a } = alunoDo(e); Dados.arquivarAluno(t, a, true); PS.salvar(); PS.telas.turma(t.id); PS.avisar(`${a.nome || 'Aluno'} arquivado. O cartão ${a.cartao} ficou livre.`); },
        'reativar-aluno': (e) => { const { t, a } = alunoDo(e); Dados.arquivarAluno(t, a, false); PS.salvar(); PS.telas.turma(t.id); PS.avisar(`${a.nome} voltou com o cartão ${a.cartao}.`); },
        'excluir-aluno': (e) => {
            const { t, a } = alunoDo(e);
            const temResultados = PS.d.sessoes.some((s) => s.turmaId === t.id && s.respostas[a.cartao]);
            const fazer = () => { t.alunos = t.alunos.filter((x) => x !== a); PS.tocar(t); PS.telas.turma(t.id); };
            if (temResultados) PS.confirmar(`Excluir ${a.nome}?`, fazer, 'Este aluno tem respostas nos relatórios. Para guardar os resultados, use Arquivar.');
            else fazer();
        },
        'colar-alunos': () => PS.dialogo(`<h2>Colar a lista de alunos</h2>
            <p class="sub">Um nome por linha (da chamada ou de uma planilha). Os cartões são numerados na ordem, a partir do primeiro livre.</p>
            <textarea rows="12" placeholder="Ana Clara&#10;Bruno Lima&#10;…" autofocus></textarea>`, (dlg) => {
            const t = turmaAtual();
            const novos = Dados.lerListaAlunos(dlg.querySelector('textarea').value, t.alunos);
            t.alunos.push(...novos);
            PS.tocar(t); PS.telas.turma(t.id);
            PS.avisar(`${PS.plural(novos.length, 'aluno adicionado', 'alunos adicionados')}.`);
        }),
        'fila-adicionar': () => {
            const t = turmaAtual();
            const todos = Dados.ativos(PS.d.conjuntos).sort((a, b) => (b.alterado || '').localeCompare(a.alterado || ''));
            PS.dialogo(`<h2>Pôr na fila de ${esc(t.nome)}</h2><input type="search" id="filtro-fila" placeholder="Filtrar…">
                <div class="lista-marcar rolar">${todos.map((c) => `<label data-titulo="${esc(Dados.semAcento(c.titulo))}"><input type="checkbox" value="${c.id}" ${t.fila.includes(c.id) ? 'checked' : ''}> ${esc(c.titulo)} <small>(${c.questoes.length})</small></label>`).join('') || '<p class="vazio">A biblioteca está vazia.</p>'}</div>`, (dlg) => {
                const marcados = Array.from(dlg.querySelectorAll('input[type=checkbox]:checked')).map((x) => x.value);
                t.fila = t.fila.filter((id) => marcados.includes(id)).concat(marcados.filter((id) => !t.fila.includes(id)));
                PS.tocar(t); PS.telas.turma(t.id);
            }, { aoAbrir: (dlg) => { dlg.querySelector('#filtro-fila').oninput = (e) => { const f = Dados.semAcento(e.target.value); dlg.querySelectorAll('[data-titulo]').forEach((l) => { l.hidden = !l.dataset.titulo.includes(f); }); }; } });
        },
        'fila-subir': (e) => {
            const t = turmaAtual();
            const id = e.target.closest('[data-fila]').dataset.fila;
            const i = t.fila.indexOf(id);
            if (i > 0) [t.fila[i - 1], t.fila[i]] = [t.fila[i], t.fila[i - 1]];
            PS.tocar(t); PS.telas.turma(t.id);
        },
        'fila-tirar': (e) => { const t = turmaAtual(); const id = e.target.closest('[data-fila]').dataset.fila; t.fila = t.fila.filter((x) => x !== id); PS.tocar(t); PS.telas.turma(t.id); },
        'apresentar-fila': (e, b) => PS.comecarAula(turmaAtual().id, b.dataset.conjunto),
        'links-alunos': () => {
            const t = turmaAtual();
            const alunos = PS.alunosAtivos(t).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
            PS.dialogo(`<h2>Responder pelo próprio aparelho</h2>
                <p class="sub">Para alunos que estão em casa (aula remota ou híbrida) ou que preferem o celular/Chromebook: cada um abre o seu link pessoal uma vez; nas aulas, digita o código que aparece no telão. As respostas entram na mesma pergunta que os cartões lidos na sala. Não pede conta nem senha.</p>
                <div class="botoes margem"><button type="button" class="btn btn-p" id="copiar-todos">📋 Copiar todos os links</button><button type="button" class="btn btn-p" id="imprimir-links">🖨 Imprimir com QR code</button></div>
                <div class="lista-links rolar">${alunos.map((a) => `<div><span>${a.cartao}. ${esc(a.nome)}</span><input type="text" readonly value="${esc(PS.linkAluno(a))}" onclick="this.select()"><button type="button" class="btn btn-p" data-chave="${a.id}">Novo link</button></div>`).join('')}</div>`, null, {
                largo: true, confirmar: 'Fechar', semCancelar: true,
                aoAbrir: (dlg) => {
                    dlg.querySelector('#copiar-todos').onclick = async () => {
                        const texto = alunos.map((a) => `${a.nome}: ${PS.linkAluno(a)}`).join('\n');
                        try { await navigator.clipboard.writeText(texto); PS.avisar('Links copiados.'); } catch (erro) { PS.avisar('Não consegui copiar.'); }
                    };
                    dlg.querySelector('#imprimir-links').onclick = () => imprimirLinks(t, alunos);
                    dlg.querySelectorAll('[data-chave]').forEach((b) => b.onclick = () => {
                        const a = t.alunos.find((x) => x.id === b.dataset.chave);
                        a.chave = Dados.novaChave(); PS.tocar(t);
                        b.previousElementSibling.value = PS.linkAluno(a);
                        PS.avisar(`Link de ${a.nome} trocado: o antigo deixa de valer.`);
                    });
                }
            });
        }
    });

    function imprimirLinks(t, alunos) {
        const w = window.open('', '_blank');
        if (!w) { PS.avisar('Permita janelas deste site para imprimir.'); return; }
        const qr = (texto) => { try { const q = qrcode(0, 'M'); q.addData(texto); q.make(); return q.createSvgTag({ cellSize: 3, margin: 1, scalable: true }); } catch (e) { return ''; } };
        w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Links — ${esc(t.nome)}</title>
            <style>body{font-family:system-ui,sans-serif;margin:16px}.g{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.c{border:1px dashed #999;padding:10px;break-inside:avoid;text-align:center;font-size:12px}
            .c svg{width:120px;height:120px}.c b{display:block;font-size:15px;margin-bottom:4px}.u{word-break:break-all;color:#555}</style></head><body>
            <h2>${esc(t.nome)} — responder pelo aparelho</h2><div class="g">${alunos.map((a) => `<div class="c"><b>${esc(a.nome)}</b>${qr(PS.linkAluno(a))}<div class="u">${esc(PS.linkAluno(a))}</div></div>`).join('')}</div>
            <script>onload=()=>print()<\/script></body></html>`);
        w.document.close();
    }
})();
