/* Editor de conjunto: perguntas avaliadas (uma ou mais certas) ou enquetes,
   texto com negrito/itálico/sublinhado/índices e equações em LaTeX, mídia
   (imagem, gif, vídeo do YouTube com início e fim, áudio gravado ou de
   arquivo), layout do slide, imagens nas alternativas, embaralhar, colar
   várias perguntas e prévia do slide. Tudo se salva sozinho. */
(function () {
    'use strict';
    const { esc } = PS;
    const L = Dados.LETRAS;

    const cx = () => PS.conjunto(PS.$('#conteudo').dataset.conjunto);

    PS.telas.conjunto = function (id) {
        const c = PS.conjunto(id);
        if (!c || c.removido) { PS.ir('biblioteca'); return; }
        const conteudo = PS.$('#conteudo');
        conteudo.dataset.conjunto = c.id;
        const trilha = c.pastaId ? Dados.caminhoPasta(PS.d, c.pastaId) : [];
        conteudo.innerHTML = `
            <nav class="trilha"><a href="#biblioteca">Biblioteca</a>${trilha.map((p) => ` / <a href="#biblioteca/${p.id}">${esc(p.nome)}</a>`).join('')}</nav>
            <div class="cabeca cabeca-editor">
                <input class="titulo-editavel" type="text" value="${esc(c.titulo)}" data-campo="titulo" aria-label="Título do conjunto" maxlength="120">
                <div class="botoes">
                    <button class="btn btn-verde" data-acao="apresentar-conjunto">▶ Apresentar</button>
                    <button class="btn" data-acao="previa">👁 Prévia</button>
                    <button class="btn" data-acao="colar-questoes">📋 Colar várias</button>
                    <button class="btn btn-p btn-icone" data-acao="menu-editor" aria-label="Mais opções">⋯</button>
                </div>
            </div>
            <div class="opcoes-conjunto">
                <label class="interruptor"><input type="checkbox" data-campo="embaralhar" ${c.embaralhar ? 'checked' : ''}> 🔀 Embaralhar as alternativas ao apresentar</label>
                <span class="sub">${PS.plural(c.questoes.length, 'pergunta')} · salvo automaticamente</span>
            </div>
            <div class="editor-corpo">
                <ol class="indice-questoes" aria-label="Perguntas">${c.questoes.map((x, i) => `<li><a href="#q-${x.id}" data-questao-link="${x.id}"><span>${i + 1}</span>${esc(PS.simples(x.enunciado) || '(sem enunciado)')}</a></li>`).join('')}</ol>
                <div id="questoes">${c.questoes.map((x, i) => bloco(x, i, c.questoes.length)).join('')}
                    <button class="btn btn-principal adicionar" data-acao="nova-questao">+ Nova pergunta</button>
                    <p class="dica-atalhos">Atalhos no texto: <kbd>Ctrl</kbd>+<kbd>B</kbd> negrito, <kbd>Ctrl</kbd>+<kbd>I</kbd> itálico, <kbd>Ctrl</kbd>+<kbd>U</kbd> sublinhado, <kbd>Ctrl</kbd>+<kbd>E</kbd> equação, <kbd>Ctrl</kbd>+<kbd>Enter</kbd> nova pergunta.</p>
                </div>
            </div>`;
    };

    function bloco(q, i, total) {
        const enquete = q.tipo === 'enquete';
        const m = q.midia;
        return `
        <section class="questao cartao-painel ${enquete ? 'e-enquete' : ''}" data-questao="${q.id}" id="q-${q.id}">
            <div class="questao-topo">
                <span class="numero">${i + 1}</span>
                <div class="alternar-tipo" role="group" aria-label="Tipo de pergunta">
                    <button class="${!enquete ? 'ativo' : ''}" data-acao="tipo" data-tipo="avaliada" title="Tem resposta certa">✔ Avaliada</button>
                    <button class="${enquete ? 'ativo' : ''}" data-acao="tipo" data-tipo="enquete" title="Sem resposta certa: opinião da turma">📊 Enquete</button>
                </div>
                <div class="botoes">
                    <button class="btn btn-p btn-icone" data-acao="subir" title="Subir" ${i === 0 ? 'disabled' : ''}>↑</button>
                    <button class="btn btn-p btn-icone" data-acao="descer" title="Descer" ${i === total - 1 ? 'disabled' : ''}>↓</button>
                    <button class="btn btn-p btn-icone" data-acao="duplicar-questao" title="Duplicar pergunta">⧉</button>
                    <button class="btn btn-p btn-icone btn-perigo" data-acao="excluir-questao" title="Excluir pergunta">✕</button>
                </div>
            </div>
            <div class="barra-formatar" role="toolbar" aria-label="Formatar texto">
                <button data-acao="formatar" data-marca="**" title="Negrito (Ctrl+B)"><b>N</b></button>
                <button data-acao="formatar" data-marca="*" title="Itálico (Ctrl+I)"><i>I</i></button>
                <button data-acao="formatar" data-marca="__" title="Sublinhado (Ctrl+U)"><u>S</u></button>
                <button data-acao="formatar" data-marca="^" title="Expoente">x²</button>
                <button data-acao="formatar" data-marca="~" title="Índice">x₂</button>
                <button data-acao="equacao" title="Equação (Ctrl+E)">∑ Equação</button>
                <span class="separador"></span>
                <button data-acao="midia-imagem" title="Imagem ou gif">🖼 Imagem/GIF</button>
                <button data-acao="midia-video" title="Vídeo do YouTube">🎬 Vídeo</button>
                <button data-acao="midia-audio" title="Gravar ou enviar áudio">🔊 Áudio</button>
            </div>
            <textarea data-campo="enunciado" placeholder="Escreva a pergunta…" rows="2" maxlength="1000">${esc(q.enunciado)}</textarea>
            <div class="previa-texto" ${/[*_^~$]/.test(q.enunciado) ? '' : 'hidden'}>${PS.html(q.enunciado)}</div>
            ${m ? `<div class="midia-editor">
                <div class="midia-previa">${Midia.html(m)}</div>
                <div class="midia-opcoes">
                    ${m.tipo === 'video' ? `<label>Começa em <input type="text" data-campo="midia-inicio" value="${esc(Midia.tempo(m.inicio))}" placeholder="0:00" inputmode="numeric"></label>
                        <label>Termina em <input type="text" data-campo="midia-fim" value="${esc(Midia.tempo(m.fim))}" placeholder="fim" inputmode="numeric"></label>` : ''}
                    ${m.tipo === 'imagem' || m.tipo === 'gif' ? `<div class="alternar-tipo pequeno" role="group" aria-label="Ajuste">
                        <button class="${m.ajuste !== 'fill' ? 'ativo' : ''}" data-acao="midia-ajuste" data-ajuste="fit">Caber</button>
                        <button class="${m.ajuste === 'fill' ? 'ativo' : ''}" data-acao="midia-ajuste" data-ajuste="fill">Preencher</button></div>` : ''}
                    <div class="alternar-tipo pequeno" role="group" aria-label="Posição no slide">
                        <button class="${q.layout === 'esquerda' ? 'ativo' : ''}" data-acao="layout" data-layout="esquerda" title="Texto à esquerda, mídia à direita">◧</button>
                        <button class="${q.layout === 'centro' ? 'ativo' : ''}" data-acao="layout" data-layout="centro" title="Mídia no centro">▣</button>
                        <button class="${q.layout === 'direita' ? 'ativo' : ''}" data-acao="layout" data-layout="direita" title="Mídia à esquerda, texto à direita">◨</button>
                    </div>
                    <button class="btn btn-p btn-perigo" data-acao="tirar-midia">Tirar ${({ imagem: 'imagem', gif: 'gif', video: 'vídeo', audio: 'áudio' })[m.tipo]}</button>
                </div>
            </div>` : ''}
            <div class="opcoes">
                ${q.opcoes.map((o, k) => {
                    const certa = !enquete && q.corretas.includes(L[k]);
                    return `<div class="opcao ${certa ? 'certa' : ''}">
                        <button class="letra letra-${L[k]} marcar" data-acao="marcar-certa" data-indice="${k}" title="${enquete ? 'Enquete: sem resposta certa' : (certa ? 'Certa (clique para desmarcar)' : 'Marcar como certa')}" aria-pressed="${certa}">${L[k]}</button>
                        ${o.imagem ? `<span class="opcao-img"><img src="${esc(o.imagem)}" alt=""><button class="tirar" data-acao="tirar-imagem-opcao" data-indice="${k}" title="Tirar imagem">✕</button></span>` : ''}
                        <input type="text" data-campo="opcao" data-indice="${k}" value="${esc(o.texto)}" placeholder="Alternativa ${L[k]}" maxlength="300">
                        ${certa ? '<span class="selo selo-verde">certa</span>' : ''}
                        <button class="btn btn-p btn-icone" data-acao="imagem-opcao" data-indice="${k}" title="Imagem na alternativa">🖼</button>
                        ${q.opcoes.length > 2 ? `<button class="btn btn-p btn-icone" data-acao="tirar-opcao" data-indice="${k}" title="Tirar alternativa">✕</button>` : ''}
                    </div>`;
                }).join('')}
            </div>
            <div class="questao-pe">
                ${q.opcoes.length < 4 ? '<button class="btn btn-p" data-acao="mais-opcao">+ Alternativa</button>' : ''}
                <button class="btn btn-p" data-acao="verdadeiro-falso">Verdadeiro/Falso</button>
                <span class="sub dica-certa">${enquete ? 'Enquete: a turma opina, ninguém erra.' : 'Toque na letra para marcar a certa (pode haver mais de uma).'}</span>
            </div>
        </section>`;
    }

    function daQuestao(e) {
        const c = cx();
        const b = e.target.closest('[data-questao]');
        if (!c || !b) return {};
        const i = c.questoes.findIndex((x) => x.id === b.dataset.questao);
        return { c, q: c.questoes[i], i, bloco: b };
    }

    function redesenhar(c, i, focar) {
        const velho = PS.$(`[data-questao="${c.questoes[i].id}"]`);
        if (velho) velho.outerHTML = bloco(c.questoes[i], i, c.questoes.length);
        const link = PS.$(`[data-questao-link="${c.questoes[i].id}"]`);
        if (link) link.innerHTML = `<span>${i + 1}</span>${esc(PS.simples(c.questoes[i].enunciado) || '(sem enunciado)')}`;
        if (focar) { const t = PS.$(`[data-questao="${c.questoes[i].id}"] ${focar}`); if (t) t.focus(); }
    }

    function mudou(c) { PS.tocar(c); }

    document.addEventListener('input', (e) => {
        if (PS.rota().nome !== 'conjunto') return;
        const campo = e.target.dataset.campo;
        if (!campo) return;
        const c = cx();
        if (campo === 'titulo') { c.titulo = e.target.value; mudou(c); return; }
        if (campo === 'embaralhar') { c.embaralhar = e.target.checked; mudou(c); return; }
        const { q, bloco: b, i } = daQuestao(e);
        if (!q) return;
        if (campo === 'enunciado') {
            q.enunciado = e.target.value;
            const prev = b.querySelector('.previa-texto');
            prev.hidden = !/[*_^~$]/.test(q.enunciado);
            prev.innerHTML = PS.html(q.enunciado);
            const link = PS.$(`[data-questao-link="${q.id}"]`);
            if (link) link.innerHTML = `<span>${i + 1}</span>${esc(PS.simples(q.enunciado) || '(sem enunciado)')}`;
        }
        if (campo === 'opcao') q.opcoes[+e.target.dataset.indice].texto = e.target.value;
        if (campo === 'midia-inicio') q.midia.inicio = Midia.segundos(e.target.value);
        if (campo === 'midia-fim') q.midia.fim = Midia.segundos(e.target.value);
        mudou(c);
    });
    document.addEventListener('change', (e) => {
        if (PS.rota().nome !== 'conjunto') return;
        if (/midia-(inicio|fim)/.test(e.target.dataset.campo || '')) { const { c, i } = daQuestao(e); redesenhar(c, i); }
    });

    /* atalhos no texto */
    document.addEventListener('keydown', (e) => {
        if (PS.rota().nome !== 'conjunto' || !(e.ctrlKey || e.metaKey)) return;
        const alvo = e.target;
        if (!alvo.matches || !alvo.matches('textarea[data-campo=enunciado], input[data-campo=opcao]')) {
            if (e.key === 'Enter') { e.preventDefault(); PS.acoes['nova-questao'](); }
            return;
        }
        const marcas = { b: '**', i: '*', u: '__' };
        if (marcas[e.key.toLowerCase()]) { e.preventDefault(); envolver(alvo, marcas[e.key.toLowerCase()]); }
        else if (e.key.toLowerCase() === 'e') { e.preventDefault(); dialogoEquacao(alvo); }
        else if (e.key === 'Enter') { e.preventDefault(); PS.acoes['nova-questao'](); }
    });

    function envolver(campo, marca, fim) {
        const ini = campo.selectionStart, f = campo.selectionEnd;
        const sel = campo.value.slice(ini, f) || 'texto';
        campo.setRangeText(marca + sel + (fim || marca), ini, f, 'select');
        campo.setSelectionRange(ini + marca.length, ini + marca.length + sel.length);
        campo.focus();
        campo.dispatchEvent(new Event('input', { bubbles: true }));
    }

    const MODELOS_TEX = [['Fração', '\\frac{a}{b}'], ['Raiz', '\\sqrt{x}'], ['Potência', 'x^{2}'], ['Índice', 'a_{n}'], ['Somatório', '\\sum_{i=1}^{n} i'], ['Integral', '\\int_a^b f(x)\\,dx'],
        ['Pi', '\\pi'], ['≠', '\\neq'], ['≤', '\\leq'], ['≥', '\\geq'], ['×', '\\times'], ['÷', '\\div'], ['±', '\\pm'], ['∞', '\\infty'], ['Grau', '30^{\\circ}'], ['Vetor', '\\vec{v}'], ['Seta', '\\rightarrow']];

    function dialogoEquacao(campo) {
        const atual = campo.value.slice(campo.selectionStart, campo.selectionEnd).replace(/^\$|\$$/g, '');
        PS.dialogo(`<h2>Equação</h2>
            <p class="sub">Escreva em LaTeX ou use os botões.</p>
            <div class="modelos-tex">${MODELOS_TEX.map(([n, t]) => `<button type="button" data-tex="${esc(t)}" title="${esc(t)}">${n}</button>`).join('')}</div>
            <input type="text" id="tex" value="${esc(atual)}" placeholder="\\frac{1}{2}" autofocus spellcheck="false">
            <div class="previa-tex" id="previa-tex"></div>`, (dlg) => {
            const tex = dlg.querySelector('#tex').value.trim();
            if (!tex) return false;
            campo.focus();
            campo.setRangeText('$' + tex + '$', campo.selectionStart, campo.selectionEnd, 'end');
            campo.dispatchEvent(new Event('input', { bubbles: true }));
        }, {
            confirmar: 'Inserir',
            aoAbrir: (dlg) => {
                const tex = dlg.querySelector('#tex');
                const prev = () => { dlg.querySelector('#previa-tex').innerHTML = tex.value.trim() ? PS.html('$' + tex.value + '$') : ''; };
                tex.oninput = prev;
                dlg.querySelectorAll('[data-tex]').forEach((b) => b.onclick = () => { tex.setRangeText(b.dataset.tex, tex.selectionStart, tex.selectionEnd, 'end'); tex.focus(); prev(); });
                prev();
            }
        });
    }

    Object.assign(PS.acoes, {
        'nova-questao': () => {
            const c = cx();
            if (!c) return;
            c.questoes.push(Dados.novaQuestao());
            mudou(c);
            PS.telas.conjunto(c.id);
            const ultimo = PS.$$('.questao textarea[data-campo=enunciado]').pop();
            if (ultimo) { ultimo.focus(); ultimo.scrollIntoView({ block: 'center' }); }
        },
        'excluir-questao': (e) => {
            const { c, i } = daQuestao(e);
            const [tirada] = c.questoes.splice(i, 1);
            mudou(c); PS.telas.conjunto(c.id);
            PS.avisar('Pergunta excluída.', () => { c.questoes.splice(i, 0, tirada); mudou(c); PS.telas.conjunto(c.id); });
        },
        'duplicar-questao': (e) => {
            const { c, q, i } = daQuestao(e);
            c.questoes.splice(i + 1, 0, Object.assign(JSON.parse(JSON.stringify(q)), { id: Dados.novoId() }));
            mudou(c); PS.telas.conjunto(c.id);
        },
        'subir': (e) => mover(e, -1),
        'descer': (e) => mover(e, 1),
        'tipo': (e, b) => {
            const { c, q, i } = daQuestao(e);
            q.tipo = b.dataset.tipo;
            if (q.tipo === 'avaliada' && !q.corretas.length) q.corretas = ['A'];
            mudou(c); redesenhar(c, i);
        },
        'marcar-certa': (e, b) => {
            const { c, q, i } = daQuestao(e);
            if (q.tipo === 'enquete') { q.tipo = 'avaliada'; q.corretas = []; }
            const l = L[+b.dataset.indice];
            q.corretas = q.corretas.includes(l) ? q.corretas.filter((x) => x !== l) : [...q.corretas, l].sort();
            if (!q.corretas.length) q.tipo = 'enquete';
            mudou(c); redesenhar(c, i);
        },
        'mais-opcao': (e) => { const { c, q, i } = daQuestao(e); if (q.opcoes.length < 4) q.opcoes.push({ texto: '', imagem: '' }); mudou(c); redesenhar(c, i, '.opcao:last-child input[type=text]'); },
        'tirar-opcao': (e, b) => {
            const { c, q, i } = daQuestao(e);
            const k = +b.dataset.indice;
            q.opcoes.splice(k, 1);
            q.corretas = q.corretas.map((l) => L.indexOf(l)).filter((x) => x !== k).map((x) => L[x > k ? x - 1 : x]);
            if (q.tipo === 'avaliada' && !q.corretas.length) q.corretas = ['A'];
            mudou(c); redesenhar(c, i);
        },
        'verdadeiro-falso': (e) => {
            const { c, q, i } = daQuestao(e);
            q.opcoes = [{ texto: 'Verdadeiro', imagem: '' }, { texto: 'Falso', imagem: '' }];
            q.corretas = q.corretas.filter((l) => l === 'A' || l === 'B');
            if (q.tipo === 'avaliada' && !q.corretas.length) q.corretas = ['A'];
            mudou(c); redesenhar(c, i);
        },
        'formatar': (e, b) => envolver(daQuestao(e).bloco.querySelector('textarea'), b.dataset.marca),
        'equacao': (e) => dialogoEquacao(daQuestao(e).bloco.querySelector('textarea')),
        'midia-imagem': async (e) => {
            const { c, q, i } = daQuestao(e);
            const arquivo = await PS.escolherArquivo('image/*');
            if (!arquivo) return;
            try { q.midia = await Midia.deArquivo(arquivo); mudou(c); redesenhar(c, i); } catch (erro) { PS.avisar(erro.message); }
        },
        'midia-video': (e) => {
            const { c, q, i } = daQuestao(e);
            const m = q.midia && q.midia.tipo === 'video' ? q.midia : {};
            PS.dialogo(`<h2>Vídeo do YouTube</h2>
                <label for="url-video">Endereço do vídeo</label><input type="text" id="url-video" value="${esc(m.src || '')}" placeholder="https://www.youtube.com/watch?v=…" autofocus>
                <div class="duas-colunas-form"><div><label for="v-inicio">Começa em</label><input type="text" id="v-inicio" value="${esc(Midia.tempo(m.inicio))}" placeholder="0:00"></div>
                <div><label for="v-fim">Termina em</label><input type="text" id="v-fim" value="${esc(Midia.tempo(m.fim))}" placeholder="até o fim"></div></div>
                <p class="sub">O vídeo toca no telão (precisa de internet no computador do projetor).</p>`, (dlg) => {
                const src = dlg.querySelector('#url-video').value.trim();
                if (!Midia.idYoutube(src)) { PS.avisar('Esse endereço não é de um vídeo do YouTube.'); return false; }
                q.midia = { tipo: 'video', src, inicio: Midia.segundos(dlg.querySelector('#v-inicio').value), fim: Midia.segundos(dlg.querySelector('#v-fim').value) };
                mudou(c); redesenhar(c, i);
            });
        },
        'midia-audio': (e) => {
            const { c, q, i } = daQuestao(e);
            let gravacao = null;
            PS.dialogo(`<h2>Áudio da pergunta</h2>
                <p class="sub">Grave pelo microfone (leitura do enunciado, um trecho de música, a pronúncia de uma palavra…) ou envie um arquivo de áudio.</p>
                <div class="botoes"><button type="button" class="btn btn-principal" id="gravar">⏺ Gravar</button><button type="button" class="btn" id="arquivo-audio">📁 Escolher arquivo</button></div>
                <p class="sub" id="estado-audio"></p><div id="previa-audio"></div>`, () => {
                if (!q.midia || q.midia.tipo !== 'audio') return false;
                mudou(c); redesenhar(c, i);
            }, {
                confirmar: 'Usar este áudio',
                aoAbrir: (dlg) => {
                    const mostrar = () => { dlg.querySelector('#previa-audio').innerHTML = q.midia && q.midia.tipo === 'audio' ? Midia.html(q.midia) : ''; };
                    dlg.querySelector('#gravar').onclick = async (ev) => {
                        const b = ev.currentTarget;
                        if (!gravacao) {
                            try { gravacao = await Midia.gravarAudio(); b.textContent = '⏹ Parar'; dlg.querySelector('#estado-audio').textContent = 'Gravando…'; } catch (erro) { dlg.querySelector('#estado-audio').textContent = 'Sem acesso ao microfone.'; }
                        } else {
                            q.midia = await gravacao.parar(); gravacao = null; b.textContent = '⏺ Gravar de novo';
                            dlg.querySelector('#estado-audio').textContent = 'Gravado. Ouça antes de usar:'; mostrar();
                        }
                    };
                    dlg.querySelector('#arquivo-audio').onclick = async () => {
                        const arquivo = await PS.escolherArquivo('audio/*');
                        if (!arquivo) return;
                        try { q.midia = await Midia.deArquivo(arquivo); mostrar(); } catch (erro) { dlg.querySelector('#estado-audio').textContent = erro.message; }
                    };
                    mostrar();
                }
            });
        },
        'midia-ajuste': (e, b) => { const { c, q, i } = daQuestao(e); q.midia.ajuste = b.dataset.ajuste; mudou(c); redesenhar(c, i); },
        'layout': (e, b) => { const { c, q, i } = daQuestao(e); q.layout = b.dataset.layout; mudou(c); redesenhar(c, i); },
        'tirar-midia': (e) => { const { c, q, i } = daQuestao(e); q.midia = null; mudou(c); redesenhar(c, i); },
        'imagem-opcao': async (e, b) => {
            const { c, q, i } = daQuestao(e);
            const arquivo = await PS.escolherArquivo('image/*');
            if (!arquivo) return;
            try { q.opcoes[+b.dataset.indice].imagem = await Midia.reduzirImagem(arquivo, 400); mudou(c); redesenhar(c, i); } catch (erro) { PS.avisar(erro.message); }
        },
        'tirar-imagem-opcao': (e, b) => { const { c, q, i } = daQuestao(e); q.opcoes[+b.dataset.indice].imagem = ''; mudou(c); redesenhar(c, i); },
        'apresentar-conjunto': () => PS.escolherTurmaParaApresentar(cx()),
        'previa': () => previa(cx(), 0),
        'menu-editor': (e, b) => {
            const c = cx();
            const m = document.createElement('div');
            const itens = [
                ['➜ Pôr na fila…', () => PS.porNaFila(c)],
                ['📁 Mover para…', () => PS.moverPara('Mover “' + c.titulo + '”', c.pastaId, null, (destino) => { c.pastaId = destino; mudou(c); PS.desenhar(); })],
                ['⧉ Duplicar conjunto', () => { const copia = PS.duplicarConjunto(c); PS.ir('conjunto/' + copia.id); }],
                ['⬇ Exportar como pacote', () => {
                    const arquivo = JSON.stringify(Dados.exportarPacote(PS.d, { nome: c.titulo, descricao: '', conjuntos: [c.id] }));
                    PS.baixar(PS.nomeArquivo(c.titulo) + '.provashow.json', arquivo, 'application/json');
                }],
                ['🖨 Imprimir perguntas', () => imprimirConjunto(c)],
                ['🗑 Excluir conjunto', () => { PS.excluirConjunto(c); PS.ir('biblioteca' + (c.pastaId ? '/' + c.pastaId : '')); }]
            ];
            m.className = 'menu menu-flutuante';
            m.innerHTML = itens.map(([t], k) => `<button data-k="${k}" class="${k === itens.length - 1 ? 'btn-perigo' : ''}">${t}</button>`).join('');
            document.body.appendChild(m);
            const r = b.getBoundingClientRect();
            m.style.top = (window.scrollY + r.bottom + 4) + 'px';
            m.style.left = Math.max(8, r.right - m.offsetWidth) + 'px';
            m.onclick = (ev) => { const x = ev.target.closest('[data-k]'); if (x) { m.remove(); itens[+x.dataset.k][1](); } };
            setTimeout(() => document.addEventListener('click', function fora(ev) { if (!m.contains(ev.target)) { m.remove(); document.removeEventListener('click', fora); } }), 0);
        },
        'colar-questoes': () => dialogoColar()
    });

    function mover(e, passo) {
        const { c, i } = daQuestao(e);
        const j = i + passo;
        if (j < 0 || j >= c.questoes.length) return;
        [c.questoes[i], c.questoes[j]] = [c.questoes[j], c.questoes[i]];
        mudou(c); PS.telas.conjunto(c.id);
        PS.$(`[data-questao="${c.questoes[j].id}"]`).scrollIntoView({ block: 'center' });
    }

    /* ----- colar várias, com prévia ----- */
    function dialogoColar() {
        PS.dialogo(`<h2>Colar várias perguntas</h2>
            <p class="sub">Cole do Word, do PDF ou de uma planilha. Numere as perguntas e use a), b), c), d) nas alternativas; marque a certa com <code>*</code> antes da letra ou com uma linha <code>Resposta: B</code> (várias: <code>Resposta: A, C</code>). Planilha: colunas pergunta, A, B, C, D, certa.</p>
            <div class="colar-grade">
                <div>
                    <textarea id="texto-colado" rows="14" placeholder="1) Qual é a capital do Ceará?&#10;a) Recife&#10;*b) Fortaleza&#10;c) Natal"></textarea>
                    <div class="duas-colunas-form">
                        <div><label for="n-alternativas">Alternativas por pergunta</label><select id="n-alternativas"><option value="0">Como vier (até 4)</option><option value="2">2 (V/F)</option><option value="3">3</option><option value="4">4</option></select></div>
                        <div><label for="remover-texto">Tirar este texto de tudo</label><input type="text" id="remover-texto" placeholder="ex.: (ENEM 2019)"></div>
                    </div>
                </div>
                <div class="colar-previa" id="colar-previa"><p class="vazio">A prévia aparece aqui.</p></div>
            </div>`, (dlg) => {
            const novas = ler(dlg);
            if (!novas.length) { PS.avisar('Não encontrei perguntas nesse texto.'); return false; }
            const c = cx();
            c.questoes = c.questoes.filter((x) => x.enunciado.trim() || x.opcoes.some((o) => o.texto.trim()) || x.midia).concat(novas);
            mudou(c); PS.telas.conjunto(c.id);
            PS.avisar(`${PS.plural(novas.length, 'pergunta adicionada', 'perguntas adicionadas')}.`);
        }, {
            largo: true, confirmar: 'Adicionar',
            aoAbrir: (dlg) => {
                const atualizar = () => {
                    const q = ler(dlg);
                    dlg.querySelector('#colar-previa').innerHTML = q.length ? `<p class="sub">${PS.plural(q.length, 'pergunta')}:</p>` + q.map((x, i) => `<div class="previa-q"><strong>${i + 1}. ${PS.html(x.enunciado)}</strong>
                        <ul>${x.opcoes.map((o, k) => `<li class="${x.corretas.includes(L[k]) ? 'certa' : ''}"><span class="letra letra-${L[k]}">${L[k]}</span> ${PS.html(o.texto)}</li>`).join('')}</ul>
                        ${x.tipo === 'enquete' ? '<small>sem resposta certa (enquete)</small>' : ''}</div>`).join('') : '<p class="vazio">A prévia aparece aqui.</p>';
                };
                dlg.querySelectorAll('textarea, input, select').forEach((x) => x.addEventListener('input', atualizar));
            }
        });
    }
    const ler = (dlg) => Dados.lerQuestoesColadas(dlg.querySelector('#texto-colado').value, {
        alternativas: +dlg.querySelector('#n-alternativas').value, remover: dlg.querySelector('#remover-texto').value
    });

    /* ----- prévia do slide ----- */
    function previa(c, i) {
        if (!c.questoes.length) return;
        const q = c.questoes[i];
        const dlg = PS.dialogo(`<div class="previa-slide-topo"><strong>${i + 1} / ${c.questoes.length}</strong>
            <span><button type="button" class="btn btn-p" id="pv-ant" ${i === 0 ? 'disabled' : ''}>←</button> <button type="button" class="btn btn-p" id="pv-prox" ${i === c.questoes.length - 1 ? 'disabled' : ''}>→</button>
            <label class="interruptor"><input type="checkbox" id="pv-revelar"> mostrar a certa</label></span></div>
            <div class="previa-slide telao-tema" id="pv-slide">${Slide.html(q, {})}</div>`, null, { largo: true, confirmar: 'Fechar', semCancelar: true });
        dlg.querySelector('#pv-ant').onclick = () => { dlg.close(); previa(c, i - 1); };
        dlg.querySelector('#pv-prox').onclick = () => { dlg.close(); previa(c, i + 1); };
        dlg.querySelector('#pv-revelar').onchange = (e) => {
            dlg.querySelector('#pv-slide').innerHTML = Slide.html(q, { revelar: e.target.checked, mostrarGrafico: e.target.checked, contagem: {}, total: 0 });
        };
    }

    function imprimirConjunto(c) {
        const w = window.open('', '_blank');
        if (!w) { PS.avisar('Permita janelas deste site para imprimir.'); return; }
        w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(c.titulo)}</title>
            <style>body{font-family:system-ui,sans-serif;margin:24px;color:#111}h1{font-size:20px}ol{padding-left:22px}li{margin-bottom:14px;break-inside:avoid}ul{list-style:none;padding:0;margin:6px 0}
            .certa{font-weight:700}.certa::after{content:" ✔"}img{max-height:140px;max-width:260px;display:block;margin:6px 0}</style></head><body>
            <h1>${esc(c.titulo)}</h1><ol>${c.questoes.map((q) => `<li>${PS.html(q.enunciado)}${q.midia && (q.midia.tipo === 'imagem' || q.midia.tipo === 'gif') ? Midia.html(q.midia) : ''}
            <ul>${q.opcoes.map((o, k) => `<li class="${q.tipo !== 'enquete' && q.corretas.includes(L[k]) ? 'certa' : ''}">${L[k]}) ${PS.html(o.texto)}</li>`).join('')}</ul></li>`).join('')}</ol>
            <script>onload=()=>print()<\/script></body></html>`);
        w.document.close();
    }

    PS.previaConjunto = previa;
})();
