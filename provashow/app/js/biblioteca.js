/* Biblioteca: pastas (umas dentro das outras), conjuntos de perguntas,
   busca, lixeira, pacotes (para organizar e levar a outros professores) e
   a biblioteca pública (Explorar). */
(function () {
    'use strict';
    const { esc } = PS;
    const ordem = { modo: 'recentes' };

    function contarDentro(pastaId) {
        const ids = Dados.descendentes(PS.d, pastaId);
        return Dados.ativos(PS.d.conjuntos).filter((c) => ids.has(c.pastaId)).length;
    }

    function filasDe(c) {
        return Dados.ativos(PS.d.turmas).filter((t) => t.fila.includes(c.id));
    }

    function linhaConjunto(c, comPasta) {
        const pasta = comPasta && c.pastaId ? Dados.caminhoPasta(PS.d, c.pastaId).map((p) => p.nome).join(' / ') : '';
        return `<div class="linha-item" data-conjunto="${c.id}">
            <a class="linha-principal" href="#conjunto/${c.id}">
                <span class="icone-item conjunto-icone" aria-hidden="true">${c.questoes.length}</span>
                <span class="linha-texto"><strong>${esc(c.titulo || 'Sem título')}</strong>
                <small>${PS.plural(c.questoes.length, 'pergunta')} · ${PS.dataCurta(c.alterado || new Date())}${pasta ? ' · 📁 ' + esc(pasta) : ''}${c.embaralhar ? ' · 🔀' : ''}</small></span>
            </a>
            <span class="linha-selos">${filasDe(c).map((t) => `<span class="selo" style="--cor:${t.cor}">${esc(t.nome)}</span>`).join('')}</span>
            <button class="btn btn-p btn-icone" data-acao="menu-conjunto" data-id="${c.id}" aria-label="Opções de ${esc(c.titulo)}">⋯</button>
        </div>`;
    }

    PS.telas.biblioteca = function (pastaId) {
        const pasta = pastaId ? PS.pasta(pastaId) : null;
        if (pastaId && (!pasta || pasta.removido)) { PS.ir('biblioteca'); return; }
        const atual = pasta ? pasta.id : null;
        const pastas = Dados.ativos(PS.d.pastas).filter((p) => (p.paiId || null) === atual).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
        let conjuntos = Dados.ativos(PS.d.conjuntos).filter((c) => (c.pastaId || null) === atual);
        conjuntos.sort(ordem.modo === 'nome' ? (a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR') : (a, b) => (b.alterado || '').localeCompare(a.alterado || ''));
        const trilha = pasta ? Dados.caminhoPasta(PS.d, pasta.id) : [];
        PS.$('#conteudo').innerHTML = `
            <div class="cabeca">
                <div>
                    <nav class="trilha" aria-label="Pastas"><a href="#biblioteca">Biblioteca</a>${trilha.map((p) => ` / <a href="#biblioteca/${p.id}">${esc(p.nome)}</a>`).join('')}</nav>
                    <h1>${pasta ? '📁 ' + esc(pasta.nome) : 'Biblioteca'}</h1>
                </div>
                <div class="botoes">
                    <button class="btn" data-acao="nova-pasta">+ Pasta</button>
                    <button class="btn btn-principal" data-acao="novo-conjunto">+ Conjunto</button>
                </div>
            </div>
            <div class="barra-biblioteca">
                <form class="busca" data-acao-form="buscar"><input type="search" id="campo-busca" placeholder="Buscar perguntas e conjuntos…" aria-label="Buscar"></form>
                <div class="botoes">
                    <a class="btn btn-p" href="#pacotes">📦 Pacotes</a>
                    <a class="btn btn-p" href="#explorar">🌐 Explorar</a>
                    <a class="btn btn-p" href="#lixeira">🗑 Lixeira</a>
                    <select id="ordem-biblioteca" aria-label="Ordenar"><option value="recentes" ${ordem.modo === 'recentes' ? 'selected' : ''}>Mais recentes</option><option value="nome" ${ordem.modo === 'nome' ? 'selected' : ''}>Por nome</option></select>
                </div>
            </div>
            <div class="lista-itens">
                ${pasta ? `<a class="linha-item linha-voltar" href="#biblioteca${pasta.paiId ? '/' + pasta.paiId : ''}"><span class="icone-item">↩</span><span>Voltar</span></a>` : ''}
                ${pastas.map((p) => `<div class="linha-item">
                    <a class="linha-principal" href="#biblioteca/${p.id}"><span class="icone-item pasta-icone" aria-hidden="true">📁</span>
                    <span class="linha-texto"><strong>${esc(p.nome)}</strong><small>${PS.plural(contarDentro(p.id), 'conjunto')}</small></span></a>
                    <button class="btn btn-p btn-icone" data-acao="menu-pasta" data-id="${p.id}" aria-label="Opções da pasta ${esc(p.nome)}">⋯</button>
                </div>`).join('')}
                ${conjuntos.map((c) => linhaConjunto(c)).join('')}
                ${!pastas.length && !conjuntos.length ? `<p class="vazio">${pasta ? 'Pasta vazia.' : 'Nada por aqui ainda. Crie um conjunto, cole perguntas prontas ou traga um pacote do <a href="#explorar">Explorar</a>.'}</p>` : ''}
            </div>`;
        PS.$('#ordem-biblioteca').onchange = (e) => { ordem.modo = e.target.value; PS.telas.biblioteca(pastaId); };
        PS.$('.busca').onsubmit = (e) => { e.preventDefault(); const t = PS.$('#campo-busca').value.trim(); if (t) PS.ir('busca/' + encodeURIComponent(t)); };
        PS.$('#conteudo').dataset.pasta = atual || '';
    };

    PS.telas.busca = function (termo) {
        const achados = Dados.buscar(PS.d, termo || '');
        PS.$('#conteudo').innerHTML = `
            <a class="voltar" href="#biblioteca">&larr; Biblioteca</a>
            <div class="cabeca"><h1>Busca: “${esc(termo)}”</h1></div>
            <form class="busca busca-grande"><input type="search" id="campo-busca" value="${esc(termo)}" aria-label="Buscar"></form>
            <div class="lista-itens">${achados.map((c) => linhaConjunto(c, true)).join('') || '<p class="vazio">Nada encontrado.</p>'}</div>`;
        PS.$('.busca').onsubmit = (e) => { e.preventDefault(); PS.ir('busca/' + encodeURIComponent(PS.$('#campo-busca').value.trim())); };
    };

    /* ----- criar, mover, excluir ----- */

    PS.novoConjunto = function (pastaId, questoes, titulo) {
        const c = {
            id: Dados.novoId(), titulo: titulo || 'Novo conjunto', pastaId: pastaId || null, embaralhar: false,
            questoes: questoes || [Dados.novaQuestao()], alterado: new Date().toISOString(), removido: null
        };
        PS.d.conjuntos.push(c);
        PS.salvar();
        return c;
    };

    function opcoesPastas(evitar) {
        const proibidas = evitar ? Dados.descendentes(PS.d, evitar) : new Set();
        const linhas = ['<option value="">Biblioteca (raiz)</option>'];
        const andar = (pai, nivel) => {
            Dados.ativos(PS.d.pastas).filter((p) => (p.paiId || null) === pai && !proibidas.has(p.id))
                .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
                .forEach((p) => { linhas.push(`<option value="${p.id}">${'— '.repeat(nivel)}${esc(p.nome)}</option>`); andar(p.id, nivel + 1); });
        };
        andar(null, 1);
        return linhas.join('');
    }

    function moverPara(titulo, atual, evitar, aoEscolher) {
        PS.dialogo(`<h2>${esc(titulo)}</h2><label for="destino">Para a pasta</label><select id="destino">${opcoesPastas(evitar)}</select>`, (dlg) => {
            aoEscolher(dlg.querySelector('#destino').value || null);
        }, { aoAbrir: (dlg) => { dlg.querySelector('#destino').value = atual || ''; }, confirmar: 'Mover' });
    }

    function removerPasta(p) {
        const t = new Date().toISOString();
        const ids = Dados.descendentes(PS.d, p.id);
        PS.d.pastas.forEach((x) => { if (ids.has(x.id) && !x.removido) { x.removido = t; x.alterado = t; } });
        PS.d.conjuntos.forEach((c) => { if (ids.has(c.pastaId) && !c.removido) { c.removido = t; c.alterado = t; } });
        PS.salvar();
        return t;
    }

    function restaurarPasta(p) {
        const marca = p.removido;
        const ids = Dados.descendentes(PS.d, p.id);
        PS.d.pastas.forEach((x) => { if (ids.has(x.id) && x.removido === marca) Dados.restaurar(x); });
        PS.d.conjuntos.forEach((c) => { if (ids.has(c.pastaId) && c.removido === marca) Dados.restaurar(c); });
        if (p.paiId && PS.pasta(p.paiId) && PS.pasta(p.paiId).removido) { p.paiId = null; }
        PS.salvar();
    }

    PS.duplicarConjunto = function (c) {
        const copia = JSON.parse(JSON.stringify(c));
        copia.id = Dados.novoId();
        copia.titulo = c.titulo + ' (cópia)';
        copia.questoes.forEach((x) => { x.id = Dados.novoId(); });
        copia.alterado = new Date().toISOString();
        copia.removido = null;
        PS.d.conjuntos.push(copia);
        PS.salvar();
        return copia;
    };

    PS.porNaFila = function (c) {
        const turmas = Dados.ativos(PS.d.turmas).filter((t) => !t.arquivada);
        if (!turmas.length) { PS.avisar('Crie uma turma primeiro.'); return; }
        PS.dialogo(`<h2>Pôr “${esc(c.titulo)}” na fila de:</h2>
            <div class="lista-marcar">${turmas.map((t) => `<label><input type="checkbox" value="${t.id}" ${t.fila.includes(c.id) ? 'checked' : ''}> <span class="bolinha" style="--cor:${t.cor}"></span> ${esc(t.nome)}</label>`).join('')}</div>`, (dlg) => {
            dlg.querySelectorAll('input[type=checkbox]').forEach((cx) => {
                const t = PS.turma(cx.value);
                const tem = t.fila.includes(c.id);
                if (cx.checked && !tem) t.fila.push(c.id);
                if (!cx.checked && tem) t.fila = t.fila.filter((id) => id !== c.id);
                if (cx.checked !== tem) PS.tocar(t);
            });
            PS.avisar('Filas atualizadas.');
            PS.desenhar();
        });
    };

    PS.excluirConjunto = function (c) {
        Dados.remover(c);
        PS.salvar();
        PS.avisar(`“${c.titulo}” foi para a lixeira.`, () => { Dados.restaurar(c); PS.salvar(); PS.desenhar(); });
    };

    function menu(botao, itens) {
        const velho = PS.$('.menu-flutuante');
        if (velho) velho.remove();
        const m = document.createElement('div');
        m.className = 'menu menu-flutuante';
        m.innerHTML = itens.map((i, k) => `<button data-k="${k}" class="${i.perigo ? 'btn-perigo' : ''}">${i.texto}</button>`).join('');
        document.body.appendChild(m);
        const r = botao.getBoundingClientRect();
        m.style.top = (window.scrollY + r.bottom + 4) + 'px';
        m.style.left = Math.max(8, Math.min(window.innerWidth - m.offsetWidth - 8, r.right - m.offsetWidth)) + 'px';
        m.addEventListener('click', (e) => { const b = e.target.closest('[data-k]'); if (b) { m.remove(); itens[+b.dataset.k].f(); } });
        setTimeout(() => document.addEventListener('click', function fora(e) { if (!m.contains(e.target)) { m.remove(); document.removeEventListener('click', fora); } }), 0);
    }

    Object.assign(PS.acoes, {
        'novo-conjunto': () => { const c = PS.novoConjunto(PS.$('#conteudo').dataset.pasta || null); PS.ir('conjunto/' + c.id); },
        'nova-pasta': () => PS.perguntar('Nome da nova pasta', '', (nome) => {
            PS.d.pastas.push({ id: Dados.novoId(), nome, paiId: PS.$('#conteudo').dataset.pasta || null, alterado: new Date().toISOString(), removido: null });
            PS.salvar(); PS.desenhar();
        }),
        'menu-pasta': (e, b) => {
            const p = PS.pasta(b.dataset.id);
            menu(b, [
                { texto: '✏️ Renomear', f: () => PS.perguntar('Renomear pasta', p.nome, (nome) => { p.nome = nome; PS.tocar(p); PS.desenhar(); }) },
                { texto: '📁 Mover para…', f: () => moverPara('Mover a pasta “' + p.nome + '”', p.paiId, p.id, (destino) => { p.paiId = destino; PS.tocar(p); PS.desenhar(); }) },
                { texto: '🗑 Excluir', perigo: true, f: () => { removerPasta(p); PS.desenhar(); PS.avisar(`Pasta “${p.nome}” foi para a lixeira.`, () => { restaurarPasta(p); PS.desenhar(); }); } }
            ]);
        },
        'menu-conjunto': (e, b) => {
            const c = PS.conjunto(b.dataset.id);
            menu(b, [
                { texto: '✏️ Editar', f: () => PS.ir('conjunto/' + c.id) },
                { texto: '▶ Apresentar…', f: () => PS.escolherTurmaParaApresentar(c) },
                { texto: '➜ Pôr na fila…', f: () => PS.porNaFila(c) },
                { texto: '📁 Mover para…', f: () => moverPara('Mover “' + c.titulo + '”', c.pastaId, null, (destino) => { c.pastaId = destino; PS.tocar(c); PS.desenhar(); }) },
                { texto: '⧉ Duplicar', f: () => { PS.duplicarConjunto(c); PS.desenhar(); PS.avisar('Cópia criada.'); } },
                { texto: '🗑 Excluir', perigo: true, f: () => { PS.excluirConjunto(c); PS.desenhar(); } }
            ]);
        }
    });
    PS.moverPara = moverPara;

    /* ----- lixeira ----- */

    PS.telas.lixeira = function () {
        const itens = [
            ...PS.d.pastas.filter((p) => p.removido && !(p.paiId && PS.pasta(p.paiId) && PS.pasta(p.paiId).removido === p.removido)).map((x) => ({ tipo: 'pasta', x, nome: '📁 ' + x.nome })),
            ...PS.d.conjuntos.filter((c) => c.removido && !(c.pastaId && PS.pasta(c.pastaId) && PS.pasta(c.pastaId).removido === c.removido)).map((x) => ({ tipo: 'conjunto', x, nome: x.titulo })),
            ...PS.d.pacotes.filter((p) => p.removido).map((x) => ({ tipo: 'pacote', x, nome: '📦 ' + x.nome })),
            ...PS.d.turmas.filter((t) => t.removido).map((x) => ({ tipo: 'turma', x, nome: '👥 ' + x.nome }))
        ].sort((a, b) => b.x.removido.localeCompare(a.x.removido));
        PS.$('#conteudo').innerHTML = `
            <a class="voltar" href="#biblioteca">&larr; Biblioteca</a>
            <div class="cabeca"><div><h1>🗑 Lixeira</h1><p class="sub">O que foi excluído fica aqui por ${Dados.DIAS_LIXEIRA} dias e depois some de vez.</p></div>
            ${itens.length ? '<button class="btn btn-perigo" data-acao="esvaziar-lixeira">Esvaziar lixeira</button>' : ''}</div>
            <div class="lista-itens">${itens.map((i) => `<div class="linha-item">
                <span class="linha-texto"><strong>${esc(i.nome)}</strong><small>excluído em ${PS.dataCurta(i.x.removido)}</small></span>
                <button class="btn btn-p" data-acao="restaurar" data-tipo="${i.tipo}" data-id="${i.x.id}">↺ Restaurar</button>
                <button class="btn btn-p btn-perigo" data-acao="apagar-de-vez" data-tipo="${i.tipo}" data-id="${i.x.id}">Apagar de vez</button>
            </div>`).join('') || '<p class="vazio">A lixeira está vazia.</p>'}</div>`;
    };

    const listaDoTipo = { pasta: 'pastas', conjunto: 'conjuntos', pacote: 'pacotes', turma: 'turmas' };
    Object.assign(PS.acoes, {
        'restaurar': (e, b) => {
            const x = PS.d[listaDoTipo[b.dataset.tipo]].find((i) => i.id === b.dataset.id);
            if (b.dataset.tipo === 'pasta') restaurarPasta(x);
            else {
                if (b.dataset.tipo === 'conjunto' && x.pastaId && (!PS.pasta(x.pastaId) || PS.pasta(x.pastaId).removido)) x.pastaId = null;
                Dados.restaurar(x); PS.salvar();
            }
            PS.desenhar(); PS.avisar('Restaurado.');
        },
        'apagar-de-vez': (e, b) => PS.confirmar('Apagar de vez? Não dá para desfazer.', () => {
            const nome = listaDoTipo[b.dataset.tipo];
            if (b.dataset.tipo === 'pasta') {
                const ids = Dados.descendentes(PS.d, b.dataset.id);
                PS.d.pastas = PS.d.pastas.filter((p) => !ids.has(p.id));
                PS.d.conjuntos = PS.d.conjuntos.filter((c) => !(c.removido && ids.has(c.pastaId)));
            } else PS.d[nome] = PS.d[nome].filter((i) => i.id !== b.dataset.id);
            PS.salvar(); PS.desenhar();
        }),
        'esvaziar-lixeira': () => PS.confirmar('Apagar de vez tudo o que está na lixeira?', () => {
            for (const nome of Object.values(listaDoTipo)) PS.d[nome] = PS.d[nome].filter((i) => !i.removido);
            PS.salvar(); PS.desenhar();
        })
    });

    /* ----- pacotes ----- */

    PS.telas.pacotes = function () {
        const pacotes = Dados.ativos(PS.d.pacotes);
        PS.$('#conteudo').innerHTML = `
            <a class="voltar" href="#biblioteca">&larr; Biblioteca</a>
            <div class="cabeca"><div><h1>📦 Pacotes</h1><p class="sub">Um pacote junta conjuntos sobre um tema — por exemplo, “Revisão do 2º bimestre”. Exporte o pacote num arquivo para levar a outro computador ou entregar a colegas; quem recebe importa e tem uma cópia para editar.</p></div>
            <div class="botoes"><button class="btn" data-acao="importar-pacote">⬆ Importar pacote</button><button class="btn btn-principal" data-acao="novo-pacote">+ Novo pacote</button></div></div>
            <div class="grade-cartoes">${pacotes.map((p) => `<a class="cartao-painel item-pacote" href="#pacote/${p.id}">
                ${p.imagem ? `<img src="${esc(p.imagem)}" alt="">` : '<div class="capa-pacote" aria-hidden="true">📦</div>'}
                <h3>${esc(p.nome)}</h3><p>${esc(p.descricao || '')}</p><small>${PS.plural(p.conjuntos.filter((id) => PS.conjunto(id) && !PS.conjunto(id).removido).length, 'conjunto')}</small></a>`).join('') || '<p class="vazio">Nenhum pacote ainda.</p>'}</div>`;
    };

    PS.telas.pacote = function (id) {
        const p = PS.pacote(id);
        if (!p || p.removido) { PS.ir('pacotes'); return; }
        const conjuntos = p.conjuntos.map(PS.conjunto).filter((c) => c && !c.removido);
        PS.$('#conteudo').innerHTML = `
            <a class="voltar" href="#pacotes">&larr; Pacotes</a>
            <div class="cabeca cabeca-pacote">
                <label class="capa-editavel" title="Trocar imagem">${p.imagem ? `<img src="${esc(p.imagem)}" alt="">` : '<span>📦<small>pôr imagem</small></span>'}<input type="file" accept="image/*" id="imagem-pacote" hidden></label>
                <div class="cabeca-texto">
                    <input class="titulo-editavel" type="text" value="${esc(p.nome)}" id="nome-pacote" aria-label="Nome do pacote" maxlength="100">
                    <textarea id="descricao-pacote" rows="2" placeholder="Descrição (para quem receber o pacote)" maxlength="400">${esc(p.descricao || '')}</textarea>
                </div>
            </div>
            <div class="botoes margem">
                <button class="btn" data-acao="pacote-adicionar">+ Conjuntos</button>
                <button class="btn btn-principal" data-acao="pacote-exportar">⬇ Exportar arquivo</button>
                ${navigator.share ? '<button class="btn" data-acao="pacote-compartilhar">↗ Compartilhar</button>' : ''}
                <button class="btn btn-perigo" data-acao="pacote-excluir">Excluir pacote</button>
            </div>
            <div class="lista-itens">${conjuntos.map((c) => `<div class="linha-item">
                <a class="linha-principal" href="#conjunto/${c.id}"><span class="icone-item conjunto-icone">${c.questoes.length}</span><span class="linha-texto"><strong>${esc(c.titulo)}</strong><small>${PS.plural(c.questoes.length, 'pergunta')}</small></span></a>
                <button class="btn btn-p btn-icone btn-perigo" data-acao="pacote-tirar" data-id="${c.id}" title="Tirar do pacote (o conjunto continua na biblioteca)">✕</button></div>`).join('') || '<p class="vazio">Pacote vazio. Use “+ Conjuntos”.</p>'}</div>`;
        PS.$('#nome-pacote').oninput = (e) => { p.nome = e.target.value; PS.tocar(p); };
        PS.$('#descricao-pacote').oninput = (e) => { p.descricao = e.target.value; PS.tocar(p); };
        PS.$('#imagem-pacote').onchange = async (e) => {
            try { p.imagem = await Midia.reduzirImagem(e.target.files[0], 500); PS.tocar(p); PS.telas.pacote(id); } catch (erro) { PS.avisar(erro.message); }
        };
        PS.$('#conteudo').dataset.pacote = p.id;
    };

    function arquivoPacote(p) {
        const texto = JSON.stringify(Dados.exportarPacote(PS.d, p));
        return new File([texto], PS.nomeArquivo(p.nome) + '.provashow.json', { type: 'application/json' });
    }

    Object.assign(PS.acoes, {
        'novo-pacote': () => PS.perguntar('Nome do pacote', '', (nome) => {
            const p = { id: Dados.novoId(), nome, descricao: '', imagem: '', conjuntos: [], alterado: new Date().toISOString(), removido: null };
            PS.d.pacotes.push(p); PS.salvar(); PS.ir('pacote/' + p.id);
        }),
        'pacote-adicionar': () => {
            const p = PS.pacote(PS.$('#conteudo').dataset.pacote);
            const todos = Dados.ativos(PS.d.conjuntos).sort((a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR'));
            PS.dialogo(`<h2>Conjuntos do pacote</h2><div class="lista-marcar rolar">${todos.map((c) => `<label><input type="checkbox" value="${c.id}" ${p.conjuntos.includes(c.id) ? 'checked' : ''}> ${esc(c.titulo)} <small>(${c.questoes.length})</small></label>`).join('')}</div>`, (dlg) => {
                p.conjuntos = Array.from(dlg.querySelectorAll('input:checked')).map((x) => x.value);
                PS.tocar(p); PS.desenhar();
            });
        },
        'pacote-tirar': (e, b) => { const p = PS.pacote(PS.$('#conteudo').dataset.pacote); p.conjuntos = p.conjuntos.filter((x) => x !== b.dataset.id); PS.tocar(p); PS.desenhar(); },
        'pacote-exportar': () => { const p = PS.pacote(PS.$('#conteudo').dataset.pacote); PS.baixar(arquivoPacote(p).name, arquivoPacote(p)); },
        'pacote-compartilhar': async () => {
            const p = PS.pacote(PS.$('#conteudo').dataset.pacote);
            const arquivo = arquivoPacote(p);
            try {
                if (navigator.canShare && navigator.canShare({ files: [arquivo] })) await navigator.share({ files: [arquivo], title: p.nome, text: 'Pacote do ProvaShow Malu: ' + p.nome });
                else PS.baixar(arquivo.name, arquivo);
            } catch (erro) { /* cancelado */ }
        },
        'pacote-excluir': () => {
            const p = PS.pacote(PS.$('#conteudo').dataset.pacote);
            Dados.remover(p); PS.salvar(); PS.ir('pacotes');
            PS.avisar('Pacote na lixeira (os conjuntos continuam na biblioteca).', () => { Dados.restaurar(p); PS.salvar(); PS.desenhar(); });
        },
        'importar-pacote': async () => {
            const arquivo = await PS.escolherArquivo('application/json,.json');
            if (!arquivo) return;
            try {
                const p = Dados.importarPacote(PS.d, JSON.parse(await arquivo.text()));
                PS.salvar(); PS.ir('pacote/' + p.id); PS.avisar(`Pacote “${p.nome}” importado.`);
            } catch (erro) { PS.avisar(erro.message.includes('pacote') ? erro.message : 'Esse arquivo não é um pacote do ProvaShow.'); }
        }
    });

    /* ----- explorar (biblioteca pública) ----- */

    const filtro = { area: '' };
    PS.telas.explorar = function () {
        const areas = [...new Set(Explorar.PACOTES.map((p) => p.area))];
        const lista = Explorar.PACOTES.map((p, i) => ({ p, i })).filter(({ p }) => !filtro.area || p.area === filtro.area);
        PS.$('#conteudo').innerHTML = `
            <a class="voltar" href="#biblioteca">&larr; Biblioteca</a>
            <div class="cabeca"><div><h1>🌐 Explorar</h1><p class="sub">Pacotes prontos para começar. Ao adicionar, você ganha uma cópia na sua biblioteca para editar como quiser.</p></div></div>
            <div class="filtro-areas"><button class="btn btn-p ${!filtro.area ? 'btn-principal' : ''}" data-acao="explorar-area" data-area="">Todos</button>${areas.map((a) => `<button class="btn btn-p ${filtro.area === a ? 'btn-principal' : ''}" data-acao="explorar-area" data-area="${esc(a)}">${esc(a)}</button>`).join('')}</div>
            <div class="grade-cartoes">${lista.map(({ p, i }) => {
                const n = p.conjuntos.reduce((s, c) => s + c.questoes.length, 0);
                return `<article class="cartao-painel item-pacote">
                    <span class="selo">${esc(p.area)}</span><h3>${esc(p.pacote.nome)}</h3><p>${esc(p.pacote.descricao)}</p><small>${PS.plural(n, 'pergunta')}</small>
                    <details><summary>Ver perguntas</summary><ol>${p.conjuntos.flatMap((c) => c.questoes).map((x) => `<li>${PS.html(x.enunciado)}</li>`).join('')}</ol></details>
                    <button class="btn btn-principal btn-p" data-acao="explorar-trazer" data-i="${i}">+ Adicionar à minha biblioteca</button>
                </article>`;
            }).join('')}</div>`;
    };
    Object.assign(PS.acoes, {
        'explorar-area': (e, b) => { filtro.area = b.dataset.area; PS.telas.explorar(); },
        'explorar-trazer': (e, b) => {
            const p = Dados.importarPacote(PS.d, JSON.parse(JSON.stringify(Explorar.PACOTES[+b.dataset.i])));
            PS.salvar();
            PS.avisar(`“${p.nome}” está na sua biblioteca.`);
            b.textContent = '✓ Adicionado';
            b.disabled = true;
        }
    });
})();
