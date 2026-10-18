/* App do professor do ProvaShow Malu: biblioteca de perguntas, turmas (com
   os cartões de cada aluno), a aula ao vivo e os relatórios.

   Os dados moram neste navegador (Dados.carregar/salvar). Na aula ao vivo o
   app é quem manda: guarda as respostas, decide o que o telão mostra e
   repete o estado no canal da aula (Canal) para o scanner e o telão. */
(function () {
    'use strict';

    let d = Dados.carregar();
    const $ = (s, r) => (r || document).querySelector(s);
    const conteudo = $('#conteudo');

    function esc(t) {
        return String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    let tempoSalvar = null;
    function salvar(agora) {
        clearTimeout(tempoSalvar);
        const fazer = () => {
            if (!Dados.salvar(d)) avisar('Não foi possível guardar: o armazenamento do navegador está cheio. Tire algumas imagens ou baixe uma cópia de segurança.');
        };
        if (agora) fazer(); else tempoSalvar = setTimeout(fazer, 300);
    }

    let tempoAviso = null;
    function avisar(texto) {
        const a = $('#aviso');
        a.textContent = texto;
        a.hidden = false;
        clearTimeout(tempoAviso);
        tempoAviso = setTimeout(() => { a.hidden = true; }, 3200);
    }

    const conjunto = (id) => d.conjuntos.find((c) => c.id === id);
    const turma = (id) => d.turmas.find((t) => t.id === id);
    const dataCurta = (iso) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const horaCurta = (iso) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    /* ================= rotas ================= */

    function rota() {
        const [nome, id] = (location.hash.replace(/^#/, '') || 'biblioteca').split('/');
        return { nome, id };
    }

    function desenhar() {
        const r = rota();
        const aba = { conjunto: 'biblioteca', turma: 'turmas' }[r.nome] || r.nome;
        document.querySelectorAll('#abas a').forEach((a) => a.classList.toggle('ativa', a.dataset.aba === aba));
        $('#ponto-vivo').hidden = !aula;
        const telas = { biblioteca: telaBiblioteca, conjunto: telaConjunto, turmas: telaTurmas, turma: telaTurma, aula: telaAula, relatorios: telaRelatorios };
        (telas[r.nome] || telaBiblioteca)(r.id);
    }
    window.addEventListener('hashchange', desenhar);

    /* ================= biblioteca ================= */

    function telaBiblioteca() {
        const itens = d.conjuntos.slice().sort((a, b) => (b.alterado || '').localeCompare(a.alterado || ''));
        conteudo.innerHTML = `
            <div class="cabeca">
                <div>
                    <h1>Biblioteca</h1>
                    <p class="sub">Conjuntos de perguntas para usar nas aulas. Cada pergunta tem de 2 a 4 alternativas — os alunos respondem girando o cartão.</p>
                </div>
                <button class="btn btn-principal" data-acao="novo-conjunto">+ Novo conjunto</button>
            </div>
            <div class="grade-conjuntos">
                ${itens.length ? itens.map((c) => `
                    <a class="item-conjunto cartao-painel" href="#conjunto/${c.id}">
                        <h3>${esc(c.titulo || 'Sem título')}</h3>
                        <p>${c.questoes.length} pergunta${c.questoes.length === 1 ? '' : 's'}</p>
                        <ol>${c.questoes.slice(0, 3).map((q) => `<li>${esc(q.enunciado || '(sem enunciado)')}</li>`).join('')}</ol>
                        <div class="filas">${d.turmas.filter((t) => t.fila.includes(c.id)).map((t) => `<span class="selo">na fila: ${esc(t.nome)}</span>`).join('')}</div>
                    </a>`).join('') : '<p class="vazio">Nenhum conjunto ainda. Crie o primeiro!</p>'}
            </div>`;
    }

    function novoConjunto() {
        const c = { id: Dados.novoId(), titulo: 'Novo conjunto', questoes: [novaQuestao()], criado: new Date().toISOString(), alterado: new Date().toISOString() };
        d.conjuntos.push(c);
        salvar();
        location.hash = 'conjunto/' + c.id;
    }

    function novaQuestao() {
        return { id: Dados.novoId(), enunciado: '', imagem: '', opcoes: ['', '', '', ''], correta: 'A' };
    }

    function telaConjunto(id) {
        const c = conjunto(id);
        if (!c) { location.hash = 'biblioteca'; return; }
        conteudo.innerHTML = `
            <a class="voltar" href="#biblioteca">&larr; Biblioteca</a>
            <div class="cabeca">
                <input class="titulo-editavel" type="text" value="${esc(c.titulo)}" data-campo="titulo" aria-label="Título do conjunto" maxlength="120">
                <div class="botoes">
                    <button class="btn" data-acao="colar-questoes">📋 Colar várias</button>
                    <button class="btn" data-acao="por-na-fila">➜ Pôr na fila de uma turma</button>
                    <button class="btn" data-acao="duplicar-conjunto">Duplicar</button>
                    <button class="btn btn-perigo" data-acao="excluir-conjunto">Excluir</button>
                </div>
            </div>
            <div id="questoes">${c.questoes.map((q, i) => blocoQuestao(q, i, c.questoes.length)).join('')}</div>
            <button class="btn btn-principal adicionar" data-acao="nova-questao">+ Nova pergunta</button>`;
        conteudo.dataset.conjunto = c.id;
    }

    function blocoQuestao(q, i, total) {
        const enquete = !q.correta;
        return `
        <section class="questao cartao-painel" data-questao="${q.id}">
            <div class="questao-topo">
                <span class="numero">${i + 1}</span>
                <div class="botoes">
                    <button class="btn btn-p btn-icone" data-acao="subir" title="Subir" ${i === 0 ? 'disabled' : ''}>↑</button>
                    <button class="btn btn-p btn-icone" data-acao="descer" title="Descer" ${i === total - 1 ? 'disabled' : ''}>↓</button>
                    <button class="btn btn-p btn-icone btn-perigo" data-acao="excluir-questao" title="Excluir pergunta">✕</button>
                </div>
            </div>
            <textarea data-campo="enunciado" placeholder="Escreva a pergunta…" rows="2" maxlength="600">${esc(q.enunciado)}</textarea>
            <div class="imagem-questao">
                ${q.imagem ? `<img src="${q.imagem}" alt="Imagem da pergunta ${i + 1}"><button class="btn btn-p btn-perigo" data-acao="tirar-imagem">Tirar imagem</button>`
                    : '<button class="btn btn-p" data-acao="por-imagem">🖼 Pôr imagem</button>'}
            </div>
            <div class="opcoes">
                ${q.opcoes.map((o, k) => `
                    <div class="opcao ${q.correta === Dados.LETRAS[k] ? 'certa' : ''}">
                        <span class="letra letra-${Dados.LETRAS[k]}">${Dados.LETRAS[k]}</span>
                        <input type="text" data-campo="opcao" data-indice="${k}" value="${esc(o)}" placeholder="Alternativa ${Dados.LETRAS[k]}" maxlength="200">
                        <label class="marcar-certa" title="Marcar como a certa"><input type="radio" name="certa-${q.id}" data-campo="correta" value="${Dados.LETRAS[k]}" ${q.correta === Dados.LETRAS[k] ? 'checked' : ''}> certa</label>
                        ${q.opcoes.length > 2 ? `<button class="btn btn-p btn-icone" data-acao="tirar-opcao" data-indice="${k}" title="Tirar alternativa">✕</button>` : ''}
                    </div>`).join('')}
            </div>
            <div class="questao-pe">
                ${q.opcoes.length < 4 ? '<button class="btn btn-p" data-acao="mais-opcao">+ Alternativa</button>' : ''}
                <button class="btn btn-p" data-acao="verdadeiro-falso">Verdadeiro/Falso</button>
                <label class="marcar-enquete"><input type="radio" name="certa-${q.id}" data-campo="correta" value="" ${enquete ? 'checked' : ''}> Enquete (sem resposta certa)</label>
            </div>
        </section>`;
    }

    function questaoDoEvento(e) {
        const c = conjunto(conteudo.dataset.conjunto);
        const bloco = e.target.closest('[data-questao]');
        if (!c || !bloco) return {};
        const i = c.questoes.findIndex((q) => q.id === bloco.dataset.questao);
        return { c, q: c.questoes[i], i };
    }

    function tocarConjunto(c) {
        c.alterado = new Date().toISOString();
        salvar();
    }

    conteudo.addEventListener('input', (e) => {
        const campo = e.target.dataset.campo;
        if (!campo) return;
        if (rota().nome === 'conjunto') {
            const c = conjunto(conteudo.dataset.conjunto);
            if (campo === 'titulo') { c.titulo = e.target.value; tocarConjunto(c); return; }
            const { q } = questaoDoEvento(e);
            if (!q) return;
            if (campo === 'enunciado') q.enunciado = e.target.value;
            if (campo === 'opcao') q.opcoes[+e.target.dataset.indice] = e.target.value;
            if (campo === 'correta') {
                q.correta = e.target.value || null;
                e.target.closest('.questao').querySelectorAll('.opcao').forEach((o, k) => o.classList.toggle('certa', Dados.LETRAS[k] === q.correta));
            }
            tocarConjunto(c);
        } else if (rota().nome === 'turma') {
            editarTurma(e);
        }
    });

    function redesenharQuestao(c, i) {
        const velho = conteudo.querySelector(`[data-questao="${c.questoes[i].id}"]`);
        if (velho) velho.outerHTML = blocoQuestao(c.questoes[i], i, c.questoes.length);
    }

    /* Foto da questão: reduzida a 900 px e JPEG, para caber no navegador. */
    function lerImagem(arquivo) {
        return new Promise((ok, falha) => {
            const img = new Image();
            const url = URL.createObjectURL(arquivo);
            img.onload = () => {
                const escala = Math.min(1, 900 / Math.max(img.width, img.height));
                const tela = document.createElement('canvas');
                tela.width = Math.round(img.width * escala);
                tela.height = Math.round(img.height * escala);
                const ctx = tela.getContext('2d');
                ctx.fillStyle = '#fff';
                ctx.fillRect(0, 0, tela.width, tela.height);
                ctx.drawImage(img, 0, 0, tela.width, tela.height);
                URL.revokeObjectURL(url);
                ok(tela.toDataURL('image/jpeg', 0.78));
            };
            img.onerror = () => { URL.revokeObjectURL(url); falha(new Error('imagem')); };
            img.src = url;
        });
    }

    let questaoDaImagem = null;
    $('#arquivo-imagem').addEventListener('change', async (e) => {
        const arquivo = e.target.files[0];
        e.target.value = '';
        if (!arquivo || !questaoDaImagem) return;
        try {
            const { c, i } = questaoDaImagem;
            c.questoes[i].imagem = await lerImagem(arquivo);
            tocarConjunto(c);
            redesenharQuestao(c, i);
        } catch (erro) {
            avisar('Não consegui abrir essa imagem.');
        }
    });

    /* ================= turmas ================= */

    function telaTurmas() {
        conteudo.innerHTML = `
            <div class="cabeca">
                <div>
                    <h1>Turmas</h1>
                    <p class="sub">Cada aluno recebe um número de cartão (de 1 a 63). O mesmo jogo de cartões serve para todas as turmas.</p>
                </div>
                <button class="btn btn-principal" data-acao="nova-turma">+ Nova turma</button>
            </div>
            <div class="grade-conjuntos">
                ${d.turmas.length ? d.turmas.map((t) => `
                    <a class="item-conjunto item-turma cartao-painel" href="#turma/${t.id}">
                        <h3>${esc(t.nome)}</h3>
                        <p>${t.alunos.length} aluno${t.alunos.length === 1 ? '' : 's'} · ${t.fila.length} na fila</p>
                        <div class="filas">${t.fila.map(conjunto).filter(Boolean).slice(0, 3).map((c) => `<span class="selo selo-cinza">${esc(c.titulo)}</span>`).join('')}</div>
                    </a>`).join('') : '<p class="vazio">Nenhuma turma ainda.</p>'}
            </div>`;
    }

    function novaTurma() {
        const t = { id: Dados.novoId(), nome: 'Nova turma', alunos: [], fila: [] };
        d.turmas.push(t);
        salvar();
        location.hash = 'turma/' + t.id;
    }

    function telaTurma(id) {
        const t = turma(id);
        if (!t) { location.hash = 'turmas'; return; }
        conteudo.dataset.turma = t.id;
        const alunos = t.alunos.slice().sort((a, b) => a.cartao - b.cartao);
        const naFila = t.fila.map(conjunto).filter(Boolean);
        const fora = d.conjuntos.filter((c) => !t.fila.includes(c.id));
        conteudo.innerHTML = `
            <a class="voltar" href="#turmas">&larr; Turmas</a>
            <div class="cabeca">
                <input class="titulo-editavel" type="text" value="${esc(t.nome)}" data-campo="nome-turma" aria-label="Nome da turma" maxlength="80">
                <div class="botoes">
                    <a class="btn" href="../cartoes/?turma=${encodeURIComponent(t.id)}" target="_blank" rel="noopener">🖨 Cartões com os nomes</a>
                    <button class="btn btn-perigo" data-acao="excluir-turma">Excluir turma</button>
                </div>
            </div>
            <div class="duas-colunas">
                <section class="cartao-painel">
                    <div class="secao-topo">
                        <h2>Alunos <span class="selo">${t.alunos.length}</span></h2>
                        <div class="botoes">
                            <button class="btn btn-p" data-acao="colar-alunos">📋 Colar lista</button>
                            <button class="btn btn-p btn-principal" data-acao="novo-aluno">+ Aluno</button>
                        </div>
                    </div>
                    ${alunos.length ? `<table class="tabela-alunos">
                        <thead><tr><th>Cartão</th><th>Nome</th><th></th></tr></thead>
                        <tbody>${alunos.map((a) => `
                            <tr data-aluno="${a.id}">
                                <td><input type="number" min="1" max="63" value="${a.cartao}" data-campo="cartao-aluno" aria-label="Cartão de ${esc(a.nome)}"></td>
                                <td><input type="text" value="${esc(a.nome)}" data-campo="nome-aluno" aria-label="Nome do aluno" maxlength="80"></td>
                                <td><button class="btn btn-p btn-icone btn-perigo" data-acao="excluir-aluno" title="Tirar aluno">✕</button></td>
                            </tr>`).join('')}</tbody>
                    </table>` : '<p class="vazio">Nenhum aluno. Cole a lista da chamada ou adicione um por um.</p>'}
                </section>
                <section class="cartao-painel">
                    <div class="secao-topo"><h2>Fila da turma</h2></div>
                    <p class="sub">O que vai ser apresentado nesta turma, na ordem.</p>
                    <ol class="fila">
                        ${naFila.length ? naFila.map((c, i) => `
                            <li data-fila="${c.id}">
                                <div><strong>${esc(c.titulo)}</strong><small>${c.questoes.length} pergunta${c.questoes.length === 1 ? '' : 's'}</small></div>
                                <div class="botoes">
                                    <button class="btn btn-p btn-verde" data-acao="apresentar" title="Começar a aula com este conjunto">▶ Apresentar</button>
                                    <button class="btn btn-p btn-icone" data-acao="fila-subir" ${i === 0 ? 'disabled' : ''} title="Subir">↑</button>
                                    <button class="btn btn-p btn-icone btn-perigo" data-acao="fila-tirar" title="Tirar da fila">✕</button>
                                </div>
                            </li>`).join('') : '<li class="vazio">A fila está vazia.</li>'}
                    </ol>
                    ${fora.length ? `<div class="linha-add">
                        <select id="add-fila" aria-label="Conjunto para pôr na fila">${fora.map((c) => `<option value="${c.id}">${esc(c.titulo)}</option>`).join('')}</select>
                        <button class="btn btn-p" data-acao="fila-adicionar">+ Pôr na fila</button>
                    </div>` : ''}
                </section>
            </div>`;
    }

    function editarTurma(e) {
        const t = turma(conteudo.dataset.turma);
        if (!t) return;
        const campo = e.target.dataset.campo;
        if (campo === 'nome-turma') t.nome = e.target.value;
        const linha = e.target.closest('[data-aluno]');
        const a = linha && t.alunos.find((x) => x.id === linha.dataset.aluno);
        if (a && campo === 'nome-aluno') a.nome = e.target.value;
        if (a && campo === 'cartao-aluno') {
            const n = parseInt(e.target.value, 10);
            const dono = t.alunos.find((x) => x.cartao === n && x !== a);
            const valido = n >= 1 && n <= 63 && !dono;
            e.target.classList.toggle('invalido', !valido);
            e.target.title = dono ? `O cartão ${n} já é de ${dono.nome}` : (valido ? '' : 'Use um número de 1 a 63');
            if (valido) a.cartao = n;
        }
        salvar();
    }

    conteudo.addEventListener('change', (e) => {
        if (e.target.dataset.campo === 'cartao-aluno' && rota().nome === 'turma') telaTurma(conteudo.dataset.turma);
        if (e.target.id === 'filtro-turma' || e.target.id === 'filtro-de' || e.target.id === 'filtro-ate') {
            filtros.turma = $('#filtro-turma').value;
            filtros.de = $('#filtro-de').value;
            filtros.ate = $('#filtro-ate').value;
            telaRelatorios();
        }
        if (e.target.id === 'aula-turma') { escolhaAula.turma = e.target.value; telaAula(); }
    });

    /* ================= diálogos ================= */

    function dialogo(html, aoConfirmar) {
        const dlg = $('#dialogo');
        dlg.innerHTML = `<form method="dialog">${html}
            <div class="dialogo-botoes"><button class="btn" value="nao">Cancelar</button><button class="btn btn-principal" value="sim">Confirmar</button></div></form>`;
        /* No envio (e não no fechamento, que chega depois), para a tela já
           voltar atualizada. */
        dlg.querySelector('form').addEventListener('submit', (e) => {
            if (e.submitter && e.submitter.value === 'sim') aoConfirmar(dlg);
        });
        dlg.showModal();
    }

    function confirmar(texto, aoConfirmar) {
        dialogo(`<h2>${esc(texto)}</h2>`, aoConfirmar);
    }

    /* ================= cliques ================= */

    document.addEventListener('click', (e) => {
        const botao = e.target.closest('[data-acao]');
        const mais = $('#menu-mais');
        if (e.target.closest('#botao-mais')) {
            mais.hidden = !mais.hidden;
            $('#botao-mais').setAttribute('aria-expanded', String(!mais.hidden));
            return;
        }
        if (!e.target.closest('#menu-mais')) mais.hidden = true;
        if (!botao) return;
        const acao = botao.dataset.acao;
        const f = acoes[acao];
        if (f) { e.preventDefault(); f(e, botao); }
    });

    const acoes = {
        'novo-conjunto': novoConjunto,
        'nova-turma': novaTurma,
        'nova-questao': () => {
            const c = conjunto(conteudo.dataset.conjunto);
            c.questoes.push(novaQuestao());
            tocarConjunto(c);
            telaConjunto(c.id);
            const ultimo = conteudo.querySelector('.questao:last-of-type textarea');
            if (ultimo) { ultimo.focus(); ultimo.scrollIntoView({ block: 'center' }); }
        },
        'excluir-questao': (e) => {
            const { c, i } = questaoDoEvento(e);
            confirmar('Excluir esta pergunta?', () => { c.questoes.splice(i, 1); tocarConjunto(c); telaConjunto(c.id); });
        },
        'subir': (e) => mover(e, -1),
        'descer': (e) => mover(e, 1),
        'mais-opcao': (e) => {
            const { c, q, i } = questaoDoEvento(e);
            if (q.opcoes.length < 4) q.opcoes.push('');
            tocarConjunto(c); redesenharQuestao(c, i);
        },
        'tirar-opcao': (e, b) => {
            const { c, q, i } = questaoDoEvento(e);
            const k = +b.dataset.indice;
            q.opcoes.splice(k, 1);
            const ic = Dados.LETRAS.indexOf(q.correta);
            if (ic === k) q.correta = 'A'; else if (ic > k) q.correta = Dados.LETRAS[ic - 1];
            tocarConjunto(c); redesenharQuestao(c, i);
        },
        'verdadeiro-falso': (e) => {
            const { c, q, i } = questaoDoEvento(e);
            q.opcoes = ['Verdadeiro', 'Falso'];
            if (!['A', 'B'].includes(q.correta)) q.correta = 'A';
            tocarConjunto(c); redesenharQuestao(c, i);
        },
        'por-imagem': (e) => { questaoDaImagem = questaoDoEvento(e); $('#arquivo-imagem').click(); },
        'tirar-imagem': (e) => { const { c, q, i } = questaoDoEvento(e); q.imagem = ''; tocarConjunto(c); redesenharQuestao(c, i); },
        'excluir-conjunto': () => {
            const c = conjunto(conteudo.dataset.conjunto);
            confirmar(`Excluir o conjunto "${c.titulo}"? Os relatórios das aulas já dadas continuam.`, () => {
                d.conjuntos = d.conjuntos.filter((x) => x !== c);
                d.turmas.forEach((t) => { t.fila = t.fila.filter((id) => id !== c.id); });
                salvar(true);
                location.hash = 'biblioteca';
            });
        },
        'duplicar-conjunto': () => {
            const c = conjunto(conteudo.dataset.conjunto);
            const copia = JSON.parse(JSON.stringify(c));
            copia.id = Dados.novoId();
            copia.titulo = c.titulo + ' (cópia)';
            copia.questoes.forEach((q) => { q.id = Dados.novoId(); });
            copia.alterado = new Date().toISOString();
            d.conjuntos.push(copia);
            salvar();
            location.hash = 'conjunto/' + copia.id;
        },
        'colar-questoes': () => {
            dialogo(`<h2>Colar várias perguntas</h2>
                <p class="sub">Numere as perguntas e use a), b), c), d) nas alternativas. Marque a certa com * antes da letra ou com uma linha "Resposta: B".</p>
                <textarea name="texto" rows="12" placeholder="1) Qual é a capital do Ceará?&#10;a) Recife&#10;*b) Fortaleza&#10;c) Natal"></textarea>`, (dlg) => {
                const novas = Dados.lerQuestoesColadas(dlg.querySelector('textarea').value);
                if (!novas.length) { avisar('Não encontrei perguntas nesse texto.'); return; }
                const c = conjunto(conteudo.dataset.conjunto);
                c.questoes = c.questoes.filter((q) => q.enunciado.trim() || q.opcoes.some((o) => o.trim())).concat(novas);
                tocarConjunto(c); telaConjunto(c.id);
                avisar(`${novas.length} pergunta${novas.length === 1 ? '' : 's'} adicionada${novas.length === 1 ? '' : 's'}.`);
            });
        },
        'por-na-fila': () => {
            const c = conjunto(conteudo.dataset.conjunto);
            if (!d.turmas.length) { avisar('Crie uma turma primeiro.'); return; }
            dialogo(`<h2>Pôr "${esc(c.titulo)}" na fila de:</h2>
                <div class="lista-marcar">${d.turmas.map((t) => `<label><input type="checkbox" value="${t.id}" ${t.fila.includes(c.id) ? 'checked' : ''}> ${esc(t.nome)}</label>`).join('')}</div>`, (dlg) => {
                dlg.querySelectorAll('input[type=checkbox]').forEach((cx) => {
                    const t = turma(cx.value);
                    const tem = t.fila.includes(c.id);
                    if (cx.checked && !tem) t.fila.push(c.id);
                    if (!cx.checked && tem) t.fila = t.fila.filter((id) => id !== c.id);
                });
                salvar(); avisar('Filas atualizadas.');
            });
        },
        'novo-aluno': () => {
            const t = turma(conteudo.dataset.turma);
            const usados = new Set(t.alunos.map((a) => a.cartao));
            let n = 1;
            while (usados.has(n)) n++;
            if (n > 63) { avisar('Os 63 cartões já estão em uso nesta turma.'); return; }
            t.alunos.push({ id: Dados.novoId(), nome: '', cartao: n });
            salvar(); telaTurma(t.id);
            const linha = conteudo.querySelector(`[data-aluno="${t.alunos[t.alunos.length - 1].id}"] input[type=text]`);
            if (linha) linha.focus();
        },
        'excluir-aluno': (e) => {
            const t = turma(conteudo.dataset.turma);
            const id = e.target.closest('[data-aluno]').dataset.aluno;
            t.alunos = t.alunos.filter((a) => a.id !== id);
            salvar(); telaTurma(t.id);
        },
        'colar-alunos': () => {
            dialogo(`<h2>Colar a lista de alunos</h2>
                <p class="sub">Um nome por linha (pode vir da chamada ou de uma planilha). Os cartões são numerados na ordem, a partir do primeiro livre.</p>
                <textarea name="texto" rows="12" placeholder="Ana Clara&#10;Bruno Lima&#10;…"></textarea>`, (dlg) => {
                const t = turma(conteudo.dataset.turma);
                const novos = Dados.lerListaAlunos(dlg.querySelector('textarea').value, t.alunos);
                t.alunos.push(...novos);
                salvar(); telaTurma(t.id);
                avisar(`${novos.length} aluno${novos.length === 1 ? '' : 's'} adicionado${novos.length === 1 ? '' : 's'}.`);
            });
        },
        'excluir-turma': () => {
            const t = turma(conteudo.dataset.turma);
            confirmar(`Excluir a turma "${t.nome}" e os relatórios dela?`, () => {
                d.turmas = d.turmas.filter((x) => x !== t);
                d.sessoes = d.sessoes.filter((s) => s.turmaId !== t.id);
                salvar(true);
                location.hash = 'turmas';
            });
        },
        'fila-adicionar': () => {
            const t = turma(conteudo.dataset.turma);
            t.fila.push($('#add-fila').value);
            salvar(); telaTurma(t.id);
        },
        'fila-subir': (e) => {
            const t = turma(conteudo.dataset.turma);
            const id = e.target.closest('[data-fila]').dataset.fila;
            const i = t.fila.indexOf(id);
            if (i > 0) [t.fila[i - 1], t.fila[i]] = [t.fila[i], t.fila[i - 1]];
            salvar(); telaTurma(t.id);
        },
        'fila-tirar': (e) => {
            const t = turma(conteudo.dataset.turma);
            const id = e.target.closest('[data-fila]').dataset.fila;
            t.fila = t.fila.filter((x) => x !== id);
            salvar(); telaTurma(t.id);
        },
        'apresentar': (e) => {
            const id = e.target.closest('[data-fila]').dataset.fila;
            comecarAula(conteudo.dataset.turma, id);
        },
        'comecar-aula': (e, b) => comecarAula(b.dataset.turma, b.dataset.conjunto),
        'aula-anterior': () => irPara(aula.indice - 1),
        'aula-proxima': () => irPara(aula.indice + 1),
        'aula-ir': (e, b) => irPara(+b.dataset.indice),
        'aula-grafico': () => { aula.mostrarGrafico = !aula.mostrarGrafico; mudouAula(); },
        'aula-revelar': () => { aula.revelar = !aula.revelar; if (aula.revelar) aula.mostrarGrafico = true; mudouAula(); },
        'aula-limpar': () => confirmar('Apagar as respostas desta pergunta e ler de novo?', () => {
            const s = sessaoAtual();
            if (s) { d.sessoes = d.sessoes.filter((x) => x !== s); delete aula.sessoes[questaoAtual().id]; salvar(); }
            aula.revelar = false; aula.mostrarGrafico = false;
            mudouAula();
        }),
        'aula-telao': () => abrirJanela('../telao/?sala=' + aula.codigo, 'provashow-telao'),
        'aula-camera': () => abrirJanela('../scanner/?sala=' + aula.codigo, 'provashow-scanner'),
        'aula-encerrar': () => confirmar('Encerrar a aula ao vivo? As respostas já estão guardadas nos relatórios.', encerrarAula),
        'aula-resposta-manual': (e, b) => {
            const s = garantirSessao();
            const cartao = +b.dataset.cartao;
            const atual = s.respostas[cartao];
            const opcoes = questaoAtual().opcoes.length;
            const i = atual ? Dados.LETRAS.indexOf(atual) + 1 : 0;
            if (i >= opcoes) delete s.respostas[cartao]; else s.respostas[cartao] = Dados.LETRAS[i];
            salvar(); mudouAula();
        },
        'excluir-sessao': (e, b) => confirmar('Apagar o registro desta pergunta?', () => {
            d.sessoes = d.sessoes.filter((s) => s.id !== b.dataset.sessao);
            salvar(true); telaRelatorios();
        }),
        'baixar-planilha': baixarPlanilha,
        'exportar-backup': () => {
            baixar(`provashow-malu-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(d, null, 1), 'application/json');
        },
        'importar-backup': () => $('#arquivo-backup').click(),
        'recomecar': () => confirmar('Apagar todas as turmas, perguntas e relatórios deste navegador?', () => {
            d = Dados.exemplo();
            salvar(true);
            location.hash = 'biblioteca';
            desenhar();
        })
    };

    function mover(e, passo) {
        const { c, i } = questaoDoEvento(e);
        const j = i + passo;
        if (j < 0 || j >= c.questoes.length) return;
        [c.questoes[i], c.questoes[j]] = [c.questoes[j], c.questoes[i]];
        tocarConjunto(c); telaConjunto(c.id);
    }

    function baixar(nome, texto, tipo) {
        const url = URL.createObjectURL(new Blob([texto], { type: tipo }));
        const a = document.createElement('a');
        a.href = url; a.download = nome;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
    }

    $('#arquivo-backup').addEventListener('change', async (e) => {
        const arquivo = e.target.files[0];
        e.target.value = '';
        if (!arquivo) return;
        try {
            const novo = JSON.parse(await arquivo.text());
            if (!novo || !Array.isArray(novo.conjuntos) || !Array.isArray(novo.turmas)) throw new Error('formato');
            confirmar('Substituir tudo o que está neste navegador pela cópia de segurança?', () => {
                d = Object.assign(Dados.vazio(), novo);
                salvar(true); desenhar(); avisar('Cópia de segurança restaurada.');
            });
        } catch (erro) {
            avisar('Esse arquivo não é uma cópia de segurança do ProvaShow.');
        }
    });

    /* ================= aula ao vivo ================= */

    const CHAVE_AULA = 'provashow-malu-aula';
    let aula = null;          /* { codigo, turmaId, conjuntoId, indice, mostrarGrafico, revelar, sessoes: { questaoId: sessaoId } } */
    let canal = null;
    let conexao = { local: false, nuvem: 'desligada' };
    const aparelhos = new Map();  /* papel+id -> último sinal */
    let tempoEstado = null;
    const escolhaAula = { turma: '' };

    function guardarAula() {
        try {
            if (aula) localStorage.setItem(CHAVE_AULA, JSON.stringify(aula));
            else localStorage.removeItem(CHAVE_AULA);
        } catch (erro) { /* sem armazenamento */ }
    }

    const questaoAtual = () => conjunto(aula.conjuntoId).questoes[aula.indice];
    const sessaoAtual = () => {
        const id = aula.sessoes[questaoAtual().id];
        return id ? d.sessoes.find((s) => s.id === id) : null;
    };

    function garantirSessao() {
        let s = sessaoAtual();
        if (!s) {
            const q = questaoAtual();
            s = {
                id: Dados.novoId(), turmaId: aula.turmaId, conjuntoId: aula.conjuntoId, questaoId: q.id,
                conjuntoTitulo: conjunto(aula.conjuntoId).titulo,
                questao: { enunciado: q.enunciado, opcoes: q.opcoes.slice(), correta: q.correta, temImagem: !!q.imagem },
                respostas: {}, data: new Date().toISOString()
            };
            d.sessoes.push(s);
            aula.sessoes[q.id] = s.id;
            guardarAula();
        }
        return s;
    }

    function ligarCanal() {
        if (canal) canal.fechar();
        canal = Canal.abrir(aula.codigo, 'app', receber, (c) => { conexao = c; atualizarConexao(); });
        clearInterval(tempoEstado);
        tempoEstado = setInterval(() => { enviarEstado(); atualizarConexao(); }, 3000);
        enviarEstado();
    }

    function comecarAula(turmaId, conjuntoId) {
        const t = turma(turmaId), c = conjunto(conjuntoId);
        if (!t || !c) return;
        if (!c.questoes.length) { avisar('Esse conjunto não tem perguntas.'); return; }
        if (!t.alunos.length) { avisar('Cadastre os alunos da turma antes de começar.'); return; }
        const codigo = aula ? aula.codigo : Canal.novoCodigo();
        aula = { codigo, turmaId, conjuntoId, indice: 0, mostrarGrafico: false, revelar: false, sessoes: {} };
        guardarAula();
        ligarCanal();
        location.hash = 'aula';
        desenhar();
    }

    function encerrarAula() {
        if (canal) { canal.enviar('encerrada', {}); canal.fechar(); }
        canal = null;
        clearInterval(tempoEstado);
        aula = null;
        guardarAula();
        aparelhos.clear();
        desenhar();
    }

    function irPara(i) {
        const c = conjunto(aula.conjuntoId);
        if (i < 0 || i >= c.questoes.length) return;
        aula.indice = i;
        aula.mostrarGrafico = false;
        aula.revelar = false;
        mudouAula();
    }

    function mudouAula() {
        guardarAula();
        enviarEstado();
        if (rota().nome === 'aula') telaAula();
    }

    function estadoParaEnviar() {
        const t = turma(aula.turmaId), c = conjunto(aula.conjuntoId), q = questaoAtual();
        const s = sessaoAtual();
        return {
            codigo: aula.codigo,
            turma: { nome: t.nome, alunos: t.alunos.map((a) => ({ cartao: a.cartao, nome: a.nome })) },
            conjunto: c.titulo, indice: aula.indice, total: c.questoes.length,
            questao: { id: q.id, enunciado: q.enunciado, imagem: q.imagem || '', opcoes: q.opcoes, correta: q.correta },
            respostas: s ? s.respostas : {},
            mostrarGrafico: aula.mostrarGrafico, revelar: aula.revelar
        };
    }

    function enviarEstado() {
        if (!canal || !aula || !conjunto(aula.conjuntoId) || !turma(aula.turmaId)) return;
        const e = estadoParaEnviar();
        const leve = Object.assign({}, e, { questao: Object.assign({}, e.questao, { imagem: '', temImagem: !!e.questao.imagem }) });
        canal.enviar('estado', e, { paraNuvem: leve });
    }

    function receber(tipo, dados, papel) {
        if (!aula) return;
        if (dados && dados.aparelho) aparelhos.set(papel + ':' + dados.aparelho, { papel, quando: Date.now() });
        if (tipo === 'ola') { enviarEstado(); atualizarConexao(); return; }
        if (tipo === 'respostas' && dados && dados.respostas) {
            if (dados.questaoId && dados.questaoId !== questaoAtual().id) return;
            const t = turma(aula.turmaId);
            let mudou = false;
            const s = garantirSessao();
            for (const [cartao, letra] of Object.entries(dados.respostas)) {
                if (s.respostas[cartao] !== letra && Dados.registrarResposta(s, t, cartao, letra)) mudou = true;
            }
            if (!Object.keys(s.respostas).length) {
                d.sessoes = d.sessoes.filter((x) => x !== s);
                delete aula.sessoes[questaoAtual().id];
                guardarAula();
            }
            if (mudou) { salvar(); mudouAula(); }
            return;
        }
        if (tipo === 'comando' && dados) {
            const mapa = { grafico: 'aula-grafico', revelar: 'aula-revelar', proxima: 'aula-proxima', anterior: 'aula-anterior' };
            if (mapa[dados.acao]) acoes[mapa[dados.acao]]();
        }
    }

    function aparelhosLigados(papel) {
        const agora = Date.now();
        let n = 0;
        for (const [chave, v] of aparelhos) {
            if (agora - v.quando > 12000) aparelhos.delete(chave);
            else if (v.papel === papel) n++;
        }
        return n;
    }

    function textoConexao() {
        const nuvem = { ligada: 'internet ligada', conectando: 'conectando à internet…', falhou: 'sem internet (só neste computador)', desligada: 'só neste computador' }[conexao.nuvem];
        return nuvem;
    }

    function atualizarConexao() {
        const caixa = $('#conexao');
        if (!caixa) return;
        const sc = aparelhosLigados('scanner'), tl = aparelhosLigados('telao');
        caixa.innerHTML = `
            <span class="selo ${conexao.nuvem === 'ligada' ? 'selo-verde' : 'selo-cinza'}">● ${textoConexao()}</span>
            <span class="selo ${sc ? 'selo-verde' : 'selo-cinza'}">📱 ${sc} scanner${sc === 1 ? '' : 's'}</span>
            <span class="selo ${tl ? 'selo-verde' : 'selo-cinza'}">🖥 ${tl} telão${tl === 1 ? '' : 'ões'}</span>`;
    }

    function enderecoScanner() {
        return new URL('../scanner/?sala=' + aula.codigo, location.href).href;
    }

    function qrSvg(texto) {
        try {
            const qr = qrcode(0, 'M');
            qr.addData(texto);
            qr.make();
            return qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
        } catch (erro) {
            return '';
        }
    }

    function abrirJanela(url, nome) {
        const w = window.open(url, nome);
        if (!w) avisar('O navegador bloqueou a janela. Permita janelas deste site.');
    }

    function telaAula() {
        if (!aula) return telaEscolherAula();
        const t = turma(aula.turmaId), c = conjunto(aula.conjuntoId);
        if (!t || !c || !c.questoes[aula.indice]) { encerrarAula(); return; }
        const q = questaoAtual();
        const s = sessaoAtual();
        const respostas = s ? s.respostas : {};
        const cont = Dados.contagem({ questao: q, respostas });
        const responderam = Object.keys(respostas).length;
        const maior = Math.max(1, ...Object.values(cont));
        const alunos = t.alunos.slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
        conteudo.innerHTML = `
            <div class="aula">
                <div class="aula-cabeca">
                    <div>
                        <span class="selo">AO VIVO · ${esc(t.nome)}</span>
                        <h1>${esc(c.titulo)}</h1>
                    </div>
                    <div class="botoes">
                        <button class="btn" data-acao="aula-telao">🖥 Abrir telão</button>
                        <button class="btn" data-acao="aula-camera">📷 Ler com a câmera deste computador</button>
                        <button class="btn btn-perigo" data-acao="aula-encerrar">Encerrar aula</button>
                    </div>
                </div>
                <div class="aula-corpo">
                    <section class="cartao-painel aula-questao">
                        <div class="aula-nav">
                            <button class="btn btn-p" data-acao="aula-anterior" ${aula.indice === 0 ? 'disabled' : ''}>← Anterior</button>
                            <div class="pontos">${c.questoes.map((x, i) => `<button class="pontinho ${i === aula.indice ? 'atual' : ''} ${aula.sessoes[x.id] ? 'feita' : ''}" data-acao="aula-ir" data-indice="${i}" title="Pergunta ${i + 1}">${i + 1}</button>`).join('')}</div>
                            <button class="btn btn-p" data-acao="aula-proxima" ${aula.indice === c.questoes.length - 1 ? 'disabled' : ''}>Próxima →</button>
                        </div>
                        <h2 class="enunciado">${esc(q.enunciado || '(sem enunciado)')}</h2>
                        ${q.imagem ? `<img class="aula-imagem" src="${q.imagem}" alt="">` : ''}
                        <div class="aula-opcoes">
                            ${q.opcoes.map((o, k) => {
                                const l = Dados.LETRAS[k];
                                const certa = aula.revelar && q.correta === l;
                                return `<div class="aula-opcao ${certa ? 'certa' : ''} ${aula.revelar && q.correta && !certa ? 'apagada' : ''}">
                                    <span class="letra letra-${l}">${l}</span><span class="texto">${esc(o)}</span>
                                    <span class="barra"><i class="letra-${l}" style="width:${aula.mostrarGrafico ? Math.round(cont[l] / maior * 100) : 0}%"></i></span>
                                    <span class="conta">${aula.mostrarGrafico ? cont[l] : ''}</span>
                                </div>`;
                            }).join('')}
                        </div>
                        <div class="aula-controles">
                            <button class="btn ${aula.mostrarGrafico ? 'btn-principal' : ''}" data-acao="aula-grafico">📊 ${aula.mostrarGrafico ? 'Esconder gráfico' : 'Mostrar gráfico'}</button>
                            ${q.correta ? `<button class="btn ${aula.revelar ? 'btn-verde' : ''}" data-acao="aula-revelar">✔ ${aula.revelar ? 'Esconder resposta' : 'Revelar resposta'}</button>` : '<span class="selo selo-cinza">Enquete — sem resposta certa</span>'}
                            <button class="btn btn-p btn-perigo" data-acao="aula-limpar" ${s ? '' : 'disabled'}>Ler de novo</button>
                        </div>
                    </section>
                    <aside class="aula-lado">
                        <section class="cartao-painel ligar">
                            <h3>Leia os cartões com o celular</h3>
                            <div class="ligar-corpo">
                                <div class="qr">${qrSvg(enderecoScanner())}</div>
                                <div>
                                    <p>Aponte a câmera do celular para o código, ou abra <strong>${esc(new URL('../scanner/', location.href).href)}</strong> e digite:</p>
                                    <p class="codigo-aula">${aula.codigo}</p>
                                </div>
                            </div>
                            <div class="conexao" id="conexao"></div>
                        </section>
                        <section class="cartao-painel">
                            <div class="secao-topo">
                                <h3>Responderam</h3>
                                <span class="selo ${responderam === t.alunos.length ? 'selo-verde' : ''}" id="contagem-aula">${responderam} de ${t.alunos.length}</span>
                            </div>
                            <p class="sub">Toque num aluno para lançar ou trocar a resposta à mão.</p>
                            <div class="chamada">
                                ${alunos.map((a) => {
                                    const r = respostas[a.cartao];
                                    const classe = !r ? '' : (aula.revelar && q.correta ? (r === q.correta ? 'acertou' : 'errou') : 'respondeu');
                                    return `<button class="aluno ${classe}" data-acao="aula-resposta-manual" data-cartao="${a.cartao}" title="Cartão ${a.cartao}">
                                        <span class="n">${a.cartao}</span><span class="nome">${esc(a.nome || 'Cartão ' + a.cartao)}</span>${r ? `<span class="r letra-${r}">${aula.mostrarGrafico || aula.revelar ? r : '✓'}</span>` : ''}
                                    </button>`;
                                }).join('')}
                            </div>
                        </section>
                    </aside>
                </div>
            </div>`;
        atualizarConexao();
    }

    function telaEscolherAula() {
        const t = turma(escolhaAula.turma) || d.turmas[0];
        conteudo.innerHTML = `
            <div class="cabeca">
                <div>
                    <h1>Aula ao vivo</h1>
                    <p class="sub">Escolha a turma e o conjunto. O telão mostra a pergunta; você lê os cartões com o celular (ou com a webcam) e as respostas aparecem na hora.</p>
                </div>
            </div>
            ${!d.turmas.length ? '<p class="vazio">Crie uma turma primeiro, em <a href="#turmas">Turmas</a>.</p>' : `
            <div class="cartao-painel escolher-aula">
                <label for="aula-turma">Turma</label>
                <select id="aula-turma">${d.turmas.map((x) => `<option value="${x.id}" ${x === t ? 'selected' : ''}>${esc(x.nome)} (${x.alunos.length} alunos)</option>`).join('')}</select>
                <h3>Da fila desta turma</h3>
                <div class="lista-comecar">
                    ${t.fila.map(conjunto).filter(Boolean).map((c) => linhaComecar(t, c)).join('') || '<p class="vazio">A fila está vazia.</p>'}
                </div>
                <h3>Outros conjuntos da biblioteca</h3>
                <div class="lista-comecar">
                    ${d.conjuntos.filter((c) => !t.fila.includes(c.id)).map((c) => linhaComecar(t, c)).join('') || '<p class="vazio">—</p>'}
                </div>
            </div>`}`;
    }

    function linhaComecar(t, c) {
        return `<div class="linha-comecar"><div><strong>${esc(c.titulo)}</strong><small>${c.questoes.length} pergunta${c.questoes.length === 1 ? '' : 's'}</small></div>
            <button class="btn btn-verde btn-p" data-acao="comecar-aula" data-turma="${t.id}" data-conjunto="${c.id}">▶ Começar</button></div>`;
    }

    /* ================= relatórios ================= */

    const filtros = { turma: '', de: '', ate: '' };

    function telaRelatorios() {
        const t = turma(filtros.turma) || d.turmas[0];
        if (!t) { conteudo.innerHTML = '<h1>Relatórios</h1><p class="vazio">Sem turmas ainda.</p>'; return; }
        filtros.turma = t.id;
        const sessoes = sessoesFiltradas(t);
        const r = Dados.relatorioTurma(t, sessoes);
        const alunos = r.alunos.slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
        const media = alunos.filter((a) => a.percentual != null);
        const mediaTurma = media.length ? Math.round(media.reduce((s, a) => s + a.percentual, 0) / media.length) : null;
        conteudo.innerHTML = `
            <div class="cabeca">
                <div><h1>Relatórios</h1><p class="sub">Cada pergunta apresentada fica registrada com as respostas de cada aluno.</p></div>
                <button class="btn" data-acao="baixar-planilha" ${sessoes.length ? '' : 'disabled'}>⬇ Planilha (CSV)</button>
            </div>
            <div class="filtros cartao-painel">
                <div><label for="filtro-turma">Turma</label><select id="filtro-turma">${d.turmas.map((x) => `<option value="${x.id}" ${x === t ? 'selected' : ''}>${esc(x.nome)}</option>`).join('')}</select></div>
                <div><label for="filtro-de">De</label><input type="date" id="filtro-de" value="${filtros.de}"></div>
                <div><label for="filtro-ate">Até</label><input type="date" id="filtro-ate" value="${filtros.ate}"></div>
                <div class="resumo"><strong>${sessoes.length}</strong> pergunta${sessoes.length === 1 ? '' : 's'} · média da turma <strong>${mediaTurma == null ? '—' : mediaTurma + '%'}</strong></div>
            </div>
            ${!sessoes.length ? '<p class="vazio">Nenhuma pergunta apresentada nesse período.</p>' : `
            <div class="cartao-painel rolagem">
                <table class="placar">
                    <thead><tr><th class="fixa">Aluno</th><th>%</th>${r.sessoes.map((s, i) => `<th title="${esc(s.questao.enunciado)}"><span class="q">Q${i + 1}</span><small>${dataCurta(s.data)}</small></th>`).join('')}</tr></thead>
                    <tbody>
                        ${alunos.map((a) => `<tr>
                            <td class="fixa"><span class="n">${a.cartao}</span> ${esc(a.nome)}</td>
                            <td class="pct ${a.percentual == null ? '' : a.percentual >= 70 ? 'bom' : a.percentual >= 50 ? 'medio' : 'baixo'}">${a.percentual == null ? '—' : a.percentual + '%'}</td>
                            ${r.sessoes.map((s) => {
                                const resp = s.respostas[a.cartao];
                                const classe = !resp ? 'sem' : !s.questao.correta ? 'enquete' : resp === s.questao.correta ? 'certo' : 'errado';
                                return `<td class="cel ${classe}">${resp || '·'}</td>`;
                            }).join('')}
                        </tr>`).join('')}
                    </tbody>
                    <tfoot><tr><td class="fixa">Acerto da turma</td><td></td>${r.sessoes.map((s) => `<td class="pct">${s.percentual == null ? '—' : s.percentual + '%'}</td>`).join('')}</tr></tfoot>
                </table>
            </div>
            <h2 class="titulo-secao">Perguntas</h2>
            <div class="lista-sessoes">
                ${r.sessoes.slice().reverse().map((s) => {
                    const cont = Dados.contagem(s);
                    const total = Math.max(1, s.responderam);
                    const n = r.sessoes.indexOf(s) + 1;
                    return `<article class="cartao-painel sessao">
                        <div class="secao-topo">
                            <div><span class="selo">Q${n}</span> <small>${dataCurta(s.data)} às ${horaCurta(s.data)}</small></div>
                            <button class="btn btn-p btn-icone btn-perigo" data-acao="excluir-sessao" data-sessao="${s.id}" title="Apagar registro">✕</button>
                        </div>
                        <h3>${esc(s.questao.enunciado)}</h3>
                        ${s.questao.opcoes.map((o, k) => {
                            const l = Dados.LETRAS[k];
                            return `<div class="mini-barra ${s.questao.correta === l ? 'certa' : ''}"><span class="letra letra-${l}">${l}</span><span class="texto">${esc(o)}</span><span class="barra"><i class="letra-${l}" style="width:${Math.round(cont[l] / total * 100)}%"></i></span><span>${cont[l]}</span></div>`;
                        }).join('')}
                        <p class="sub">${s.responderam} responderam${s.percentual == null ? ' · enquete' : ` · ${s.percentual}% de acerto`}</p>
                    </article>`;
                }).join('')}
            </div>`}`;
    }

    function sessoesFiltradas(t) {
        return d.sessoes
            .filter((s) => s.turmaId === t.id)
            .filter((s) => !filtros.de || s.data.slice(0, 10) >= filtros.de)
            .filter((s) => !filtros.ate || s.data.slice(0, 10) <= filtros.ate)
            .sort((a, b) => a.data.localeCompare(b.data));
    }

    function baixarPlanilha() {
        const t = turma(filtros.turma);
        const r = Dados.relatorioTurma(t, sessoesFiltradas(t));
        const nome = t.nome.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '-').toLowerCase();
        baixar(`provashow-${nome}.csv`, Dados.csvRelatorio(t, r), 'text/csv;charset=utf-8');
    }

    /* ================= início ================= */

    try {
        const guardada = JSON.parse(localStorage.getItem(CHAVE_AULA) || 'null');
        if (guardada && turma(guardada.turmaId) && conjunto(guardada.conjuntoId)) {
            aula = guardada;
            ligarCanal();
        }
    } catch (erro) { /* começa sem aula */ }

    window.addEventListener('storage', (e) => {
        if (e.key === Dados.CHAVE) { d = Dados.carregar(); desenhar(); }
    });

    desenhar();

    /* Para os testes de navegador. */
    window.ProvaShowApp = { dados: () => d, aula: () => aula };
})();
