/* Conta e nuvem no app do professor.

   - Login obrigatório (contas do Montador de Provas, criadas pela gestão).
   - Os dados ficam na nuvem da escola; o aparelho guarda um espelho para
     funcionar sem internet. Sincroniza sozinho: ao abrir, alguns segundos
     depois de cada mudança, a cada 45 s, ao voltar a internet e ao voltar
     para a aba. O selo no topo mostra se está tudo salvo na nuvem.
   - Trocar senha (pede a atual), sair (podendo apagar a cópia deste
     aparelho — computador compartilhado).
   - A gestão vê os relatórios de todos os professores (Relatórios da escola). */
(function () {
    'use strict';
    const { esc } = PS;

    const conta = { usuario: null, perfil: null, estado: 'parado', erro: '', ultima: null, pendentes: 0 };
    PS.conta = conta;

    /* ----- login ----- */

    function mostrarLogin(mensagem) {
        document.body.classList.add('sem-login');
        const tela = PS.$('#tela-login');
        tela.hidden = false;
        PS.$('#login-mensagem').textContent = mensagem || '';
        PS.$('#login-lembrar').checked = Nuvem.lembrar();
        setTimeout(() => PS.$('#login-email').focus(), 50);
    }

    function esconderLogin() {
        document.body.classList.remove('sem-login');
        PS.$('#tela-login').hidden = true;
    }

    /* Espera até haver uma conta válida (sessão guardada ou login novo). */
    conta.garantirLogin = async function () {
        if (!Nuvem.disponivel()) {
            mostrarLogin('Não foi possível carregar o acesso à nuvem da escola. Confira a internet e recarregue a página.');
            return new Promise(() => {});
        }
        try {
            const salvo = await Nuvem.iniciar();
            if (salvo) return salvo;
        } catch (erro) {
            mostrarLogin('Não foi possível conferir a sua conta agora. Tente entrar de novo.');
        }
        mostrarLogin();
        return new Promise((ok) => {
            const form = PS.$('#form-login');
            form.onsubmit = async (e) => {
                e.preventDefault();
                const botao = form.querySelector('button[type=submit]');
                botao.disabled = true;
                PS.$('#login-mensagem').textContent = 'Entrando…';
                try {
                    const r = await Nuvem.entrar(PS.$('#login-email').value, PS.$('#login-senha').value, PS.$('#login-lembrar').checked);
                    PS.$('#login-senha').value = '';
                    ok(r);
                } catch (erro) {
                    PS.$('#login-mensagem').textContent = erro.message;
                    PS.$('#login-senha').select();
                } finally {
                    botao.disabled = false;
                }
            };
        });
    };

    conta.depoisDeEntrar = async function (quem) {
        conta.usuario = quem.usuario;
        conta.perfil = quem.perfil;
        esconderLogin();
        desenharSelo();
        await sincronizar(true);
        /* conta nova, nuvem vazia: começa com o exemplo (turma e conjunto) */
        if (!PS.d.turmas.length && !PS.d.conjuntos.length && conta.estado === 'ok') {
            const ex = Dados.exemplo();
            PS.d.turmas = ex.turmas; PS.d.conjuntos = ex.conjuntos;
            PS.salvar(true);
            PS.desenhar();
        }
        oferecerCopiaSemConta();
        setInterval(() => sincronizar(), 45000);
        window.addEventListener('online', () => sincronizar());
        document.addEventListener('visibilitychange', () => { if (!document.hidden) sincronizar(); });
    };

    async function oferecerCopiaSemConta() {
        const marca = 'provashow-copia-decidida:' + conta.usuario.id;
        try { if (localStorage.getItem(marca)) return; } catch (e) { /* segue */ }
        const copia = await Armazem.copiaSemConta();
        if (!copia) return;
        const turmas = copia.turmas.filter((t) => !t.removido).length;
        PS.dialogo(`<h2>Dados de antes do login</h2>
            <p class="sub">Este aparelho tem dados do ProvaShow guardados antes do login: ${PS.plural(turmas, 'turma')}, ${PS.plural(copia.conjuntos.filter((c) => !c.removido).length, 'conjunto')} e ${PS.plural(copia.sessoes.length, 'pergunta respondida', 'perguntas respondidas')} nos relatórios.</p>
            <p class="sub">Trazer para a sua conta? Eles vão para a nuvem da escola e passam a aparecer em qualquer aparelho em que você entrar. Só faça isso se os dados forem seus.</p>`, async () => {
            Dados.mesclar(PS.d, copia);
            await PS.salvar(true);
            await Armazem.esquecerCopiaSemConta();
            try { localStorage.setItem(marca, 'trazida'); } catch (e) { /* nada */ }
            PS.desenhar();
            sincronizar();
            PS.avisar('Dados trazidos para a sua conta.');
        }, { confirmar: 'Trazer para a minha conta', aoAbrir: (dlg) => {
            dlg.querySelector('[value="nao"]').textContent = 'Agora não';
            dlg.addEventListener('close', () => { if (dlg.returnValue === 'nao') { try { localStorage.setItem(marca, 'recusada'); } catch (e) { /* nada */ } } }, { once: true });
        } });
    }

    /* ----- sincronização ----- */

    let rodando = null, deNovo = false, tempo = null;

    async function sincronizar(primeira) {
        if (!conta.usuario) return;
        if (rodando) { deNovo = true; return rodando; }
        rodando = (async () => {
            conta.estado = 'enviando';
            desenharSelo();
            try {
                await Armazem.salvar(PS.d);   /* direto: PS.salvar chamaria outra sincronização */
                const estado = await Armazem.lerSinc();
                const r = await Nuvem.sincronizar(PS.d, estado);
                await Armazem.gravarSinc(r.estado);
                conta.estado = 'ok';
                conta.erro = '';
                conta.ultima = new Date();
                conta.pendentes = 0;
                if (r.recebidos) {
                    await Armazem.salvar(PS.d);
                    redesenharSePuder(primeira);
                }
            } catch (erro) {
                const estado = await Armazem.lerSinc().catch(() => null);
                conta.pendentes = Nuvem.quantosPendentes(PS.d, estado);
                if (Nuvem.erroDeRede(erro)) { conta.estado = 'offline'; conta.erro = ''; }
                else if (/JWT|token|401|403|not authorized|permission/i.test(String(erro.message || erro))) {
                    conta.estado = 'erro'; conta.erro = 'A sessão expirou. Saia e entre de novo para continuar salvando na nuvem.';
                } else { conta.estado = 'erro'; conta.erro = String(erro.message || erro); }
            }
            desenharSelo();
        })();
        await rodando;
        rodando = null;
        if (deNovo) { deNovo = false; return sincronizar(); }
    }
    PS.sincronizarNuvem = sincronizar;

    function redesenharSePuder(forcar) {
        const ativo = document.activeElement;
        const digitando = ativo && /^(INPUT|TEXTAREA|SELECT)$/.test(ativo.tagName);
        if (forcar || (!digitando && !PS.$('#dialogo').open && PS.rota().nome !== 'aula')) PS.desenhar();
    }

    /* cada mudança guardada no aparelho sobe para a nuvem alguns segundos depois */
    PS.aoSalvar.push(() => {
        if (!conta.usuario) return;
        conta.pendentes = Math.max(conta.pendentes, 1);
        if (conta.estado === 'ok') { conta.estado = 'pendente'; desenharSelo(); }
        clearTimeout(tempo);
        tempo = setTimeout(() => sincronizar(), 3000);
    });

    function textoSelo() {
        return {
            parado: ['☁', 'Nuvem', ''],
            enviando: ['⏳', 'Salvando…', 'Sincronizando com a nuvem da escola'],
            pendente: ['⏳', 'Salvando…', 'Há alterações para enviar à nuvem'],
            ok: ['☁', 'Salvo', 'Tudo salvo na nuvem da escola' + (conta.ultima ? ' às ' + conta.ultima.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '')],
            offline: ['⚠', 'Sem internet', `Sem internet: ${PS.plural(conta.pendentes, 'alteração guardada', 'alterações guardadas')} só neste aparelho, até a conexão voltar`],
            erro: ['⚠', 'Não salvo', conta.erro || 'Não foi possível salvar na nuvem']
        }[conta.estado];
    }

    function desenharSelo() {
        const s = PS.$('#estado-nuvem');
        if (!s) return;
        const [icone, curto, longo] = textoSelo();
        s.className = 'estado-nuvem ' + conta.estado;
        s.innerHTML = `<span aria-hidden="true">${icone}</span><span class="texto-selo">${esc(curto)}</span>`;
        s.title = longo;
        s.setAttribute('aria-label', longo || curto);
        const detalhe = PS.$('#detalhe-nuvem');
        if (detalhe) detalhe.textContent = longo;
    }
    PS.aoTrocarTela.push(() => setTimeout(desenharSelo, 0));

    /* avisa antes de fechar com alterações que ainda não subiram */
    window.addEventListener('beforeunload', (e) => {
        if (conta.usuario && (conta.estado === 'pendente' || conta.estado === 'enviando')) { e.preventDefault(); e.returnValue = ''; }
    });

    /* ----- conta (na tela Mais) ----- */

    PS.htmlConta = function () {
        const p = conta.perfil || {};
        const papel = { gestao: 'Gestão', pca: 'PCA', professor: 'Professor(a)' }[p.papel] || '';
        return `<section class="cartao-painel conta-cartao">
            <h2>👤 Sua conta</h2>
            <p><strong>${esc(p.nome || '')}</strong><br><span class="sub">${esc(p.email || (conta.usuario && conta.usuario.email) || '')} · ${papel}${p.area ? ' · ' + esc(p.area) : ''}</span></p>
            <p class="sub" id="detalhe-nuvem"></p>
            <div class="botoes">
                <button class="btn btn-p" data-acao="sincronizar-agora">☁ Sincronizar agora</button>
                <button class="btn btn-p" data-acao="trocar-senha">🔑 Trocar senha</button>
                <button class="btn btn-p btn-perigo" data-acao="sair">Sair</button>
            </div>
            ${p.papel === 'gestao' ? '<p class="margem"><a class="btn btn-principal" href="#escola">🏫 Relatórios da escola (todos os professores)</a></p>' : ''}
            <p class="sub">A mesma conta do Montador de Provas. Esqueceu a senha? A gestão define uma nova em Montador → Professores → Editar.</p>
        </section>`;
    };

    Object.assign(PS.acoes, {
        'sincronizar-agora': async () => { await sincronizar(); PS.avisar(conta.estado === 'ok' ? 'Tudo salvo na nuvem.' : textoSelo()[2]); },
        'trocar-senha': () => PS.dialogo(`<h2>Trocar senha</h2>
            <label for="senha-atual">Senha atual</label><input type="password" id="senha-atual" autocomplete="current-password" required autofocus>
            <label for="senha-nova">Nova senha (pelo menos 8 caracteres)</label><input type="password" id="senha-nova" autocomplete="new-password" minlength="8" required>
            <label for="senha-nova2">Repita a nova senha</label><input type="password" id="senha-nova2" autocomplete="new-password" minlength="8" required>
            <p class="sub" id="senha-msg" role="alert"></p>`, (dlg) => {
            const atual = dlg.querySelector('#senha-atual').value, nova = dlg.querySelector('#senha-nova').value;
            const msg = dlg.querySelector('#senha-msg');
            if (nova !== dlg.querySelector('#senha-nova2').value) { msg.textContent = 'As duas novas senhas não são iguais.'; return false; }
            if (nova.length < 8) { msg.textContent = 'A nova senha precisa ter pelo menos 8 caracteres.'; return false; }
            msg.textContent = 'Trocando…';
            Nuvem.trocarSenha(atual, nova).then(() => { dlg.close(); PS.avisar('Senha trocada.'); }).catch((erro) => { msg.textContent = erro.message; });
            return false;
        }, { confirmar: 'Trocar senha' }),
        'sair': () => PS.dialogo(`<h2>Sair da conta</h2>
            <p class="sub">${conta.estado === 'ok' ? 'Tudo está salvo na nuvem da escola.' : '⚠ Há alterações que ainda não chegaram à nuvem (' + esc(textoSelo()[2]) + '). Se apagar a cópia deste aparelho, elas se perdem.'}</p>
            <label class="interruptor"><input type="checkbox" id="apagar-copia"> Apagar a cópia dos meus dados deste aparelho (computador compartilhado)</label>`, (dlg) => {
            if (PS.aulaViva) { PS.avisar('Encerre a aula ao vivo antes de sair.'); return false; }
            const apagar = dlg.querySelector('#apagar-copia').checked;
            (async () => {
                await sincronizar();
                if (apagar) await Armazem.apagarCopiaDaConta();
                await Nuvem.sair();
                location.hash = '';
                location.reload();
            })();
        }, { confirmar: 'Sair' })
    });

    /* ----- gestão: relatórios de todos os professores ----- */

    const escola = { professor: '', dados: null, turma: '' };

    PS.telas.escola = async function () {
        if (!conta.perfil || conta.perfil.papel !== 'gestao') { PS.ir('mais'); return; }
        const conteudo = PS.$('#conteudo');
        conteudo.innerHTML = `<a class="voltar" href="#mais">&larr; Mais</a>
            <div class="cabeca"><div><h1>🏫 Relatórios da escola</h1><p class="sub">Os relatórios de todos os professores, guardados na nuvem da escola — inclusive de quem não está mais na escola. Só leitura.</p></div></div>
            <p class="vazio">Carregando…</p>`;
        let professores;
        try { professores = await Nuvem.listarProfessores(); } catch (erro) {
            conteudo.querySelector('.vazio').textContent = 'Não foi possível carregar agora (sem internet?).';
            return;
        }
        const desenhar = () => {
            const d = escola.dados;
            const turmas = d ? d.turmas.filter((t) => !t.removido) : [];
            const t = turmas.find((x) => x.id === escola.turma) || turmas[0];
            const r = t ? Dados.relatorioTurma(t, d.sessoes.filter((s) => s.turmaId === t.id).sort((a, b) => a.data.localeCompare(b.data))) : null;
            conteudo.innerHTML = `<a class="voltar" href="#mais">&larr; Mais</a>
                <div class="cabeca"><div><h1>🏫 Relatórios da escola</h1><p class="sub">Os relatórios de todos os professores, guardados na nuvem da escola. Só leitura.</p></div>
                ${r && r.sessoes.length ? '<button class="btn" data-acao="escola-csv">⬇ CSV</button>' : ''}</div>
                <div class="filtros cartao-painel">
                    <div><label for="escola-prof">Professor(a)</label><select id="escola-prof"><option value="">Escolha…</option>${professores.map((p) => `<option value="${p.id}" ${p.id === escola.professor ? 'selected' : ''}>${esc(p.nome)}${p.ativo ? '' : ' (inativo)'}</option>`).join('')}</select></div>
                    <div><label for="escola-turma">Turma</label><select id="escola-turma" ${turmas.length ? '' : 'disabled'}>${turmas.map((x) => `<option value="${x.id}" ${t && x.id === t.id ? 'selected' : ''}>${esc(x.nome)}${x.arquivada ? ' (arquivada)' : ''}</option>`).join('')}</select></div>
                    ${r ? `<div class="resumo"><strong>${r.sessoes.length}</strong> perguntas · média <strong>${r.media == null ? '—' : r.media + '%'}</strong></div>` : ''}
                </div>
                ${!escola.professor ? '<p class="vazio">Escolha um professor.</p>' : !t ? '<p class="vazio">Nenhuma turma na nuvem para este professor.</p>' : !r.sessoes.length ? '<p class="vazio">Nenhuma pergunta apresentada nesta turma.</p>' : `
                <div class="cartao-painel rolagem"><table class="placar">
                    <thead><tr><th class="fixa">Aluno</th><th>%</th>${r.sessoes.map((s, i) => `<th title="${esc(PS.simples(s.questao.enunciado))}"><span class="q">Q${i + 1}</span><small>${PS.dataCurta(s.data).slice(0, 5)}</small></th>`).join('')}</tr></thead>
                    <tbody>${r.alunos.map((a) => `<tr><td class="fixa"><span class="n">${a.cartao}</span> ${esc(a.nome)}</td><td class="pct">${a.percentual == null ? '—' : a.percentual + '%'}</td>
                        ${r.sessoes.map((s) => { const x = s.respostas[a.cartao]; const c = !x ? 'sem' : !Dados.avaliada(s.questao) ? 'enquete' : Dados.acertou(s.questao, x) ? 'certo' : 'errado'; return `<td class="cel ${c}">${x || '·'}</td>`; }).join('')}</tr>`).join('')}</tbody>
                </table></div>`}`;
            PS.$('#escola-prof').onchange = async (e) => {
                escola.professor = e.target.value; escola.dados = null; escola.turma = '';
                if (escola.professor) {
                    conteudo.insertAdjacentHTML('beforeend', '<p class="vazio" id="carregando">Carregando…</p>');
                    try { escola.dados = await Nuvem.dadosDoProfessor(escola.professor); } catch (erro) { PS.avisar('Não foi possível carregar.'); }
                }
                desenhar();
            };
            const st = PS.$('#escola-turma');
            if (st) st.onchange = (e) => { escola.turma = e.target.value; desenhar(); };
            escola.relatorio = r; escola.turmaAtual = t;
        };
        desenhar();
    };
    PS.acoes['escola-csv'] = () => {
        const t = escola.turmaAtual;
        PS.baixar(`provashow-${PS.nomeArquivo(t.nome)}.csv`, Dados.csvRelatorio(t, escola.relatorio), 'text/csv;charset=utf-8');
    };
})();
