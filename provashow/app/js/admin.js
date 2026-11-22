/* Administração (só a gestão): convidar professores pelo WhatsApp.

   - Professor novo: a gestão digita o nome (e, se quiser, o WhatsApp). O app
     gera um link (#cadastro/…) e abre o WhatsApp com a mensagem pronta. Pelo
     link a pessoa escolhe o e-mail e a senha (convite.js).
   - Convites enviados: aguardando, conta criada, vencido ou cancelado;
     reenviar gera um link novo e cancela o anterior.
   - Professores com conta: link para criar uma senha nova (#senha/…), para
     quem esqueceu a senha ou nunca entrou. O e-mail continua o mesmo.

   Quem garante que só a gestão faz isso é o servidor (funções
   provashow-convites e montador-convites); esconder a tela é só conforto. */
(function () {
    'use strict';
    const { esc } = PS;
    const AREAS = { LIN: 'Linguagens', NAT: 'Ciências da Natureza', HUM: 'Ciências Humanas', MAT: 'Matemática', RED: 'Redação' };
    const PAPEIS = { gestao: 'Gestão', pca: 'PCA', professor: 'Professor(a)' };

    const ehGestao = () => ((PS.conta && PS.conta.perfil) || Nuvem.perfil() || {}).papel === 'gestao';

    /* o botão do topo só aparece para a gestão */
    PS.desenharAdmin = function () {
        const b = PS.$('#botao-admin');
        if (b) b.hidden = !ehGestao();
    };

    function mensagem(tipo, nome, url, email) {
        const primeiro = PS.primeiroNome(nome);
        if (tipo === 'cadastro') {
            return `Olá, ${primeiro}! 👋\n\nVocê foi convidado(a) para o *ProvaShow Malu*, o app de perguntas ao vivo com cartões da EEMTI Maria Luiza Sabóia.\n\n`
                + `Toque no link, escolha o seu e-mail e crie a sua senha:\n${url}\n\n`
                + 'O link vale por 7 dias e só pode ser usado uma vez.';
        }
        return `Olá, ${primeiro}! 👋\n\nAqui está o link para criar uma senha nova no *ProvaShow Malu*:\n${url}\n\n`
            + `O seu login continua sendo ${email}. O link vale por 7 dias e só pode ser usado uma vez.`;
    }

    function linkWhatsApp(telefone, texto) {
        return 'https://wa.me/' + (telefone || '') + '?text=' + encodeURIComponent(texto);
    }

    /* mostra a mensagem pronta, com Enviar pelo WhatsApp e Copiar */
    function compartilhar(tipo, r, email) {
        const url = PS.linkConvite(tipo, r.token);
        const texto = mensagem(tipo, r.nome, url, email);
        const dlg = PS.dialogo(`<h2>Convite pronto para ${esc(PS.primeiroNome(r.nome))}</h2>
            <p class="sub">Envie pelo WhatsApp. ${r.telefone ? 'A conversa com o número informado abre direto.' : 'Escolha o contato na hora de enviar.'}</p>
            <textarea class="mensagem-convite" readonly rows="8">${esc(texto)}</textarea>
            <div class="botoes margem">
                <a class="btn btn-whatsapp" href="${esc(linkWhatsApp(r.telefone, texto))}" target="_blank" rel="noopener">💬 Enviar pelo WhatsApp</a>
                <button class="btn" type="button" id="copiar-convite">📋 Copiar mensagem</button>
            </div>
            <p class="sub">Este link só aparece agora. Se perder, use “Reenviar” na lista: sai um link novo e o antigo deixa de valer.</p>`,
        null, { confirmar: 'Pronto', semCancelar: true });
        dlg.querySelector('#copiar-convite').onclick = async () => {
            try { await navigator.clipboard.writeText(texto); PS.avisar('Mensagem copiada. É só colar no WhatsApp.'); }
            catch (e) { const t = dlg.querySelector('textarea'); t.select(); document.execCommand('copy'); PS.avisar('Mensagem copiada.'); }
        };
    }

    function seloConvite(c) {
        if (c.situacao === 'usado') return `<span class="selo selo-verde">✓ Conta criada${c.email ? ' · ' + esc(c.email) : ''}</span>`;
        if (c.situacao === 'aberto') return `<span class="selo">⏳ Aguardando · vale até ${esc(PS.dataCurta(c.expiraEm))}</span>`;
        if (c.situacao === 'vencido') return '<span class="selo selo-cinza">Venceu</span>';
        return '<span class="selo selo-cinza">Cancelado</span>';
    }

    async function desenharConvites() {
        const caixa = PS.$('#lista-convites');
        if (!caixa) return;
        try {
            const lista = await Nuvem.convites.listar();
            if (!PS.$('#lista-convites')) return;
            caixa.innerHTML = lista.length ? lista.map((c) => `<div class="linha-item linha-convite">
                <span class="icone-item">${c.situacao === 'usado' ? '✅' : c.situacao === 'aberto' ? '✉️' : '⌛'}</span>
                <span class="linha-texto"><strong>${esc(c.nome)}</strong><small>${PAPEIS[c.papel] || ''}${c.area ? ' · ' + esc(AREAS[c.area] || c.area) : ''} · enviado em ${esc(PS.dataCurta(c.criadoEm))}</small>${seloConvite(c)}</span>
                ${c.situacao === 'usado' ? '' : `<span class="botoes">
                    <button class="btn btn-p" data-acao="convite-reenviar" data-id="${c.id}" title="Gera um link novo; o anterior deixa de valer">↻ Reenviar</button>
                    ${c.situacao === 'aberto' ? `<button class="btn btn-p btn-perigo" data-acao="convite-cancelar" data-id="${c.id}" data-nome="${esc(c.nome)}">Cancelar</button>` : ''}
                </span>`}
            </div>`).join('') : '<p class="vazio">Nenhum convite enviado ainda.</p>';
        } catch (erro) {
            caixa.innerHTML = `<p class="vazio">Não consegui carregar os convites: ${esc(erro.message)}</p>`;
        }
    }

    let professores = [];
    async function desenharProfessores() {
        const caixa = PS.$('#lista-profs');
        if (!caixa) return;
        try {
            const [lista, acessos] = await Promise.all([Nuvem.listarProfessores(), Nuvem.convites.acessos()]);
            const nunca = new Map((acessos || []).map((a) => [a.id, a.nuncaEntrou]));
            professores = lista.map((p) => Object.assign({}, p, { nuncaEntrou: nunca.get(p.id) }));
            filtrarProfessores();
        } catch (erro) {
            caixa.innerHTML = `<p class="vazio">Não consegui carregar os professores: ${esc(erro.message)}</p>`;
        }
    }

    function filtrarProfessores() {
        const caixa = PS.$('#lista-profs');
        if (!caixa) return;
        const termo = Dados.semAcento((PS.$('#busca-profs') || {}).value || '').toLowerCase();
        const lista = professores.filter((p) => !termo || Dados.semAcento(p.nome + ' ' + p.email).toLowerCase().includes(termo));
        PS.$('#conta-profs').textContent = PS.plural(professores.length, 'conta');
        caixa.innerHTML = lista.map((p) => `<div class="linha-item">
            <span class="icone-item">${p.papel === 'gestao' ? '🛡' : '👤'}</span>
            <span class="linha-texto"><strong>${esc(p.nome)}</strong><small>${esc(p.email)} · ${PAPEIS[p.papel] || ''}${p.area ? ' · ' + esc(p.area) : ''}</small></span>
            <span class="linha-selos">${!p.ativo ? '<span class="selo selo-cinza">Desativada</span>' : p.nuncaEntrou ? '<span class="selo">Nunca entrou</span>' : ''}</span>
            ${p.ativo ? `<button class="btn btn-p" data-acao="convite-senha" data-id="${p.id}" title="Manda um link para criar uma senha nova">🔑 Link de senha</button>` : ''}
        </div>`).join('') || '<p class="vazio">Ninguém com esse nome.</p>';
    }

    PS.telas.admin = function () {
        if (!ehGestao()) {
            PS.$('#conteudo').innerHTML = `<div class="cabeca"><div><h1>Administração</h1></div></div>
                <section class="cartao-painel"><p>Esta área é só da gestão da escola.</p><p class="margem"><a class="btn" href="#inicio">Voltar ao início</a></p></section>`;
            return;
        }
        PS.$('#conteudo').innerHTML = `
            <div class="cabeca"><div><h1>Administração</h1><p class="sub">Convide os professores pelo WhatsApp. Cada um abre o link, escolhe o e-mail e cria a própria senha. A conta vale no ProvaShow e no Montador de Provas.</p></div></div>
            <div class="duas-colunas">
                <section class="cartao-painel">
                    <h2>✉️ Convidar professor novo</h2>
                    <form id="form-convidar" autocomplete="off">
                        <label for="cv-nome">Nome do professor</label>
                        <input type="text" id="cv-nome" maxlength="120" placeholder="Ex.: Maria Fernandes" required>
                        <div class="duas-colunas-form">
                            <div><label for="cv-papel">Função</label>
                                <select id="cv-papel"><option value="professor">Professor(a)</option><option value="pca">PCA</option></select></div>
                            <div><label for="cv-area">Área (opcional)</label>
                                <select id="cv-area"><option value="">—</option>${Object.entries(AREAS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
                        </div>
                        <label for="cv-tel">WhatsApp (opcional)</label>
                        <input type="tel" id="cv-tel" inputmode="tel" placeholder="(88) 99999-0000">
                        <p class="sub">Com o número, a conversa abre direto. Sem ele, você escolhe o contato no WhatsApp.</p>
                        <button class="btn btn-principal margem" type="submit">Gerar convite</button>
                        <p class="login-mensagem" id="cv-msg" role="alert"></p>
                    </form>
                </section>
                <section class="cartao-painel">
                    <div class="secao-topo"><h2>📨 Convites enviados</h2><button class="btn btn-p" data-acao="convites-atualizar">↻ Atualizar</button></div>
                    <div class="lista-itens" id="lista-convites"><p class="vazio">Carregando…</p></div>
                </section>
            </div>
            <h2 class="titulo-secao">Professores com conta <small class="sub" id="conta-profs"></small></h2>
            <section class="cartao-painel">
                <p class="sub">Esqueceu a senha ou nunca entrou? Mande um <strong>link de senha</strong>: a pessoa cria uma senha nova e o e-mail continua o mesmo.</p>
                <input type="search" id="busca-profs" class="margem" placeholder="Buscar professor…">
                <div class="lista-itens" id="lista-profs"><p class="vazio">Carregando…</p></div>
            </section>`;

        PS.$('#busca-profs').oninput = filtrarProfessores;
        PS.$('#form-convidar').onsubmit = async (e) => {
            e.preventDefault();
            const msg = PS.$('#cv-msg');
            const botao = e.target.querySelector('button[type=submit]');
            botao.disabled = true;
            msg.textContent = 'Gerando…';
            try {
                const r = await Nuvem.convites.criar({
                    nome: PS.$('#cv-nome').value, papel: PS.$('#cv-papel').value,
                    area: PS.$('#cv-area').value, telefone: PS.$('#cv-tel').value
                });
                msg.textContent = '';
                e.target.reset();
                compartilhar('cadastro', r);
                desenharConvites();
            } catch (erro) {
                msg.textContent = erro.message;
            } finally { botao.disabled = false; }
        };
        desenharConvites();
        desenharProfessores();
    };

    Object.assign(PS.acoes, {
        'convites-atualizar': () => { desenharConvites(); desenharProfessores(); },
        'convite-reenviar': async (e, botao) => {
            botao.disabled = true;
            try { const r = await Nuvem.convites.renovar(botao.dataset.id); compartilhar('cadastro', r); desenharConvites(); }
            catch (erro) { PS.avisar(erro.message); botao.disabled = false; }
        },
        'convite-cancelar': (e, botao) => PS.confirmar(`Cancelar o convite de ${botao.dataset.nome}?`, () => {
            Nuvem.convites.cancelar(botao.dataset.id).then(() => { PS.avisar('Convite cancelado.'); desenharConvites(); }).catch((erro) => PS.avisar(erro.message));
        }, 'O link deixa de funcionar. Dá para mandar um novo depois.'),
        'convite-senha': async (e, botao) => {
            const p = professores.find((x) => x.id === botao.dataset.id);
            botao.disabled = true;
            try { const r = await Nuvem.convites.senhaGerar(botao.dataset.id); compartilhar('senha', Object.assign({ telefone: '' }, r), r.email || (p && p.email)); }
            catch (erro) { PS.avisar(erro.message); }
            finally { botao.disabled = false; }
        }
    });
})();
