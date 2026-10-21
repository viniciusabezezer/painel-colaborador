/* A interface da Saga. Toda ação vira um EVENTO (ver motor.js); a tela é
   sempre desenhada a partir do estado refeito dos eventos. Os cliques são
   tratados num só lugar, pelo atributo data-acao.

   Vocabulário de jogo, para o estudante reconhecer na hora: HP (a Vida do
   motor), Mana (a Energia do motor), XP, ouro, guilda, quest, boss, K.O. e
   respawn. */
(function () {
    'use strict';

    const Regras = window.SagaRegras;
    const Escola = window.SagaEscola;
    const Motor = window.SagaMotor;
    const Conselheiro = window.SagaConselheiro;
    const Questoes = window.SagaQuestoes;
    const Armazem = window.SagaArmazem;
    const Demo = window.SagaDemo;

    const TURMA_DEMO = 'Demonstração';

    const D = Armazem.carregar();
    if (!D.perfil) D.perfil = Escola.perfilPadrao();
    if (!D.regras) D.regras = Regras.regrasPadrao(D.perfil.tipo);
    let E = Motor.reproduzir(D.eventos, D.regras);

    const tela = { aba: 'turma', selecao: new Set(), sorteado: null, batalha: null, filtroMissoes: 'ativas', comprador: null };

    /* ===== utilidades ===== */

    const $ = (sel, raiz) => (raiz || document).querySelector(sel);
    const $$ = (sel, raiz) => Array.from((raiz || document).querySelectorAll(sel));

    function h(texto) {
        return String(texto === undefined || texto === null ? '' : texto)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    const hoje = () => Motor.dataLocal();
    const dataBR = (d) => (d ? d.split('-').reverse().join('/') : '');
    const turma = () => D.turma;
    const moeda = () => D.perfil.moeda || { nome: 'Ouro', simbolo: '🪙' };
    const classe = (id) => Motor.classeDe(D.regras, id);
    const avatar = (a) => (a.caido ? '😵' : a.avatar || classe(a.classe).icone);

    function salvarDados() {
        const erro = Armazem.salvar(D);
        if (erro) avisar(erro, 'erro');
    }

    function recalcular() {
        E = Motor.reproduzir(D.eventos, D.regras);
        salvarDados();
        desenhar();
    }

    function emitir(tipo, dados) {
        const ev = Motor.criarEvento(tipo, dados, { autor: D.professor });
        D.eventos.push(ev);
        recalcular();
        return ev;
    }

    function desfazer(evId) {
        D.eventos.push(Motor.criarEvento('desfazer', { alvo: evId }, { autor: D.professor }));
        recalcular();
        avisar('Desfeito.');
    }

    function avisar(texto, tipo, desfazerId) {
        const caixa = document.createElement('div');
        caixa.className = `aviso-flutuante${tipo === 'erro' ? ' aviso-flutuante--erro' : ''}`;
        caixa.innerHTML = `<span>${h(texto)}</span>${desfazerId ? `<button type="button" class="btn btn--pequeno" data-acao="desfazer" data-ev="${h(desfazerId)}">Desfazer</button>` : ''}`;
        $('#avisos').appendChild(caixa);
        while ($('#avisos').children.length > 3) $('#avisos').firstElementChild.remove();
        setTimeout(() => caixa.remove(), desfazerId ? 7000 : 3500);
    }

    function abrirModal(html, classeExtra) {
        $('#modal-corpo').innerHTML = html;
        $('.modal-caixa').className = `modal-caixa${classeExtra ? ` ${classeExtra}` : ''}`;
        $('#modal').hidden = false;
        document.body.style.overflow = 'hidden';
        const foco = $('#modal-corpo [autofocus]') || $('#modal-corpo button, #modal-corpo input');
        if (foco) foco.focus();
    }

    function fecharModal() {
        $('#modal').hidden = true;
        $('#modal-corpo').innerHTML = '';
        document.body.style.overflow = '';
    }

    function baixar(nome, conteudo, tipo) {
        const blob = new Blob([conteudo], { type: tipo });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = nome;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    }

    function copiarTexto(texto) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(texto).then(() => avisar('Copiado!'), () => avisar('Selecione o texto e copie.', 'erro'));
        }
        avisar('Selecione o texto e copie.', 'erro');
        return Promise.resolve();
    }

    function alunosTurma() { return Motor.alunosDaTurma(E, turma()); }
    function turmas() {
        const lista = D.perfil.turmas.slice();
        if (Object.values(E.alunos).some((a) => a.ativo && a.turma === TURMA_DEMO) && !lista.includes(TURMA_DEMO)) lista.push(TURMA_DEMO);
        return lista;
    }

    function barra(valor, max, tipo, rotulo) {
        const pct = max > 0 ? Math.max(0, Math.min(100, Math.round(valor / max * 100))) : 0;
        return `<div class="barra barra--${tipo}" title="${h(rotulo)}: ${valor}/${max}" aria-label="${h(rotulo)} ${valor} de ${max}">
            <b>${h(rotulo)}</b><span style="width:${pct}%"></span><em>${valor}</em></div>`;
    }

    function progressoXp(a) {
        const ini = Regras.xpParaNivel(a.nivel);
        const fim = Regras.xpParaNivel(a.nivel + 1);
        return { atual: a.xp - ini, total: fim - ini, falta: fim - a.xp };
    }

    function chamadaDeHoje() { return E.chamadas[`${turma()}|${hoje()}`]; }
    function diaDeHoje() { const d = E.dias[turma()]; return d && d.data === hoje() ? d : null; }

    /* ===== topo ===== */

    function desenharTopo() {
        $('#escola-rotulo').textContent = `${D.perfil.nome} · ${Escola.rotulo(D.perfil)}`;
        const sel = $('#turma-atual');
        const lista = turmas();
        if (!lista.includes(D.turma)) D.turma = lista[0] || '';
        sel.innerHTML = lista.map((t) => `<option ${t === D.turma ? 'selected' : ''}>${h(t)}</option>`).join('');
        $('#professor-atual').textContent = D.professor ? `🎲 ${D.professor}` : '🎲 Mestre do jogo?';
        for (const b of $$('.aba')) {
            b.classList.toggle('ativa', b.dataset.aba === tela.aba);
            b.setAttribute('aria-selected', b.dataset.aba === tela.aba ? 'true' : 'false');
        }
    }

    function desenharSelecao() {
        const vivos = new Set(alunosTurma().map((a) => a.id));
        for (const id of Array.from(tela.selecao)) if (!vivos.has(id)) tela.selecao.delete(id);
        const n = tela.selecao.size;
        $('#barra-selecao').hidden = !(n && tela.aba === 'turma');
        $('#selecao-contagem').textContent = `${n} selecionado${n > 1 ? 's' : ''}`;
    }

    /* ===== aba Turma ===== */

    function cartaoAluno(a, ausentes) {
        const c = classe(a.classe);
        const p = progressoXp(a);
        const cls = ['cartao-aluno'];
        if (tela.selecao.has(a.id)) cls.push('selecionado');
        if (a.caido) cls.push('caido');
        if (ausentes.has(a.id)) cls.push('ausente');
        return `<div class="${cls.join(' ')}">
            <span class="nivel-selo" title="Nível ${a.nivel}">${a.nivel}</span>
            <button type="button" class="cartao-toque" data-acao="selecionar" data-id="${a.id}" aria-pressed="${tela.selecao.has(a.id)}">
                <span class="avatar" aria-hidden="true">${avatar(a)}</span>
                <span class="cartao-nome">${h(a.nome)}</span>
                <span class="cartao-sub">${a.caido ? 'K.O.' : `${h(c.nome)} · ${h(Regras.titulo(a.nivel))}`}${ausentes.has(a.id) ? ' · faltou' : ''}</span>
            </button>
            ${barra(a.vida, c.vidaMax, 'vida', 'HP')}
            ${barra(a.energia, c.energiaMax, 'energia', 'MP')}
            ${barra(p.atual, p.total, 'xp', 'XP')}
            <div class="cartao-rodape">
                <span title="${h(moeda().nome)}">${h(moeda().simbolo)} ${a.moeda}</span>
                <button type="button" class="link-ficha" data-acao="ficha" data-id="${a.id}">ficha ›</button>
            </div>
        </div>`;
    }

    function desenharTurma() {
        const alunos = alunosTurma();
        if (!turma()) return '<div class="vazio"><p>Cadastre as turmas na aba <strong>Escola</strong>.</p></div>';
        if (!alunos.length) {
            return `<div class="vazio">
                <p class="vazio-icone">⚔️</p>
                <h2>A ${h(turma())} ainda não tem heróis</h2>
                <p>Cole a lista de estudantes na aba Cadastro. A Saga distribui as classes e forma as guildas sozinha.</p>
                <div class="acoes-lista acoes-centro">
                    <button type="button" class="btn btn--primary" data-acao="ir" data-aba="cadastro">📋 Cadastrar estudantes</button>
                    <button type="button" class="btn" data-acao="demo">Ver uma turma de demonstração</button>
                </div>
            </div>`;
        }
        const ausentes = new Set(chamadaDeHoje() || []);
        const dia = diaDeHoje();
        let topo = '';
        if (!dia) {
            topo = `<div class="faixa-dia">
                <div><strong>O dia ainda não começou na ${h(turma())}.</strong>
                <span>Sorteie o evento do dia, faça a chamada e a Mana da turma recarrega.</span></div>
                <button type="button" class="btn btn--primary" data-acao="comecar-dia">🎲 Começar o dia</button>
            </div>`;
        } else {
            const ev = dia.evento || {};
            const desafio = ev.efeito && ev.efeito.tipo === 'desafio';
            topo = `<div class="faixa-dia faixa-dia--evento">
                <div class="evento-icone" aria-hidden="true">${h(ev.icone || '🎲')}</div>
                <div><strong>Evento do dia: ${h(ev.nome || '')}</strong><span>${h(ev.texto || '')}</span></div>
                <div class="acoes-lista">
                    ${desafio ? `<button type="button" class="btn btn--positivo" data-acao="desafio-cumprido">🎉 Desafio cumprido</button>` : ''}
                    ${chamadaDeHoje() ? `<span class="contagem">Chamada feita · ${ausentes.size} falta${ausentes.size === 1 ? '' : 's'}</span>`
                        : `<button type="button" class="btn" data-acao="chamada">✅ Fazer chamada</button>`}
                </div>
            </div>`;
        }
        const grupos = Motor.guildasDaTurma(E, turma()).map((j) => ({ j, m: Motor.membros(E, j.id).sort((x, y) => x.nome.localeCompare(y.nome, 'pt-BR')) }));
        const soltos = alunos.filter((a) => !a.guilda || !E.guildas[a.guilda]);
        const secao = (titulo, sub, lista, guildaId) => `<section class="grupo">
            <header class="grupo-topo">
                <h3>${titulo}</h3><span class="contagem">${sub}</span>
                <button type="button" class="btn btn--pequeno" data-acao="selecionar-grupo" data-guilda="${guildaId || ''}">Selecionar</button>
            </header>
            <div class="grade-alunos">${lista.map((a) => cartaoAluno(a, ausentes)).join('')}</div>
        </section>`;
        return `${topo}
            <div class="acoes-lista">
                <button type="button" class="btn btn--pequeno" data-acao="selecionar-todos">Selecionar a turma toda</button>
                <span class="contagem">Toque nos estudantes para selecionar e use a barra que aparece embaixo.</span>
            </div>
            ${grupos.map(({ j, m }) => secao(`🏰 ${h(j.nome)}`, `${m.length} na guilda · ${m.reduce((s, a) => s + a.xp, 0)} XP`, m, j.id)).join('')}
            ${soltos.length ? secao(grupos.length ? 'Sem guilda' : 'Estudantes', `${soltos.length}`, soltos, '') : ''}`;
    }

    function modalComecarDia() {
        const eventos = D.regras.eventos;
        const sorteado = eventos[Math.floor(Math.random() * eventos.length)];
        const alunos = alunosTurma();
        abrirModal(`<h2 id="modal-titulo">🎲 Começar o dia na ${h(turma())}</h2>
            <div class="roleta" id="roleta" data-evento="${h(sorteado.id)}">
                <div class="roleta-icone" id="roleta-icone">🎲</div>
                <div class="roleta-texto" id="roleta-texto"><strong>Rolando o dado do evento…</strong></div>
            </div>
            <h3>Quem faltou?</h3>
            <p class="dica">Marque só quem não veio. Presença seguida rende bônus (a cada ${D.regras.presenca.bonusACada} dias, +${D.regras.presenca.xp} XP${D.regras.presenca.ouro ? ` e ${D.regras.presenca.ouro} ${h(moeda().simbolo)}` : ''}), e três faltas seguidas acendem o alerta de Busca Ativa no Oráculo.</p>
            <div class="lista-marcar">${alunos.map((a) => `<label><input type="checkbox" name="ausente" value="${a.id}"> ${h(a.nome)}</label>`).join('')}</div>
            <div class="acoes-lista">
                <button type="button" class="btn btn--primary" data-acao="confirmar-dia" disabled id="btn-confirmar-dia">Começar o dia</button>
                <label class="check-inline"><input type="checkbox" id="pular-chamada"> Fazer a chamada depois</label>
            </div>`);
        let giros = 0;
        const icone = $('#roleta-icone');
        const timer = setInterval(() => {
            const e = eventos[giros % eventos.length];
            if (icone) icone.textContent = e.icone;
            giros++;
            if (giros > 14) {
                clearInterval(timer);
                if (!$('#roleta')) return;
                icone.textContent = sorteado.icone;
                $('#roleta-texto').innerHTML = `<strong>${h(sorteado.nome)}</strong><span>${h(sorteado.texto)}</span>`;
                $('#roleta').classList.add('roleta--pronta');
                $('#btn-confirmar-dia').disabled = false;
            }
        }, 90);
    }

    function modalChamada() {
        abrirModal(`<h2 id="modal-titulo">✅ Chamada da ${h(turma())} — ${dataBR(hoje())}</h2>
            <p class="dica">Marque só quem faltou.</p>
            <div class="lista-marcar">${alunosTurma().map((a) => `<label><input type="checkbox" name="ausente" value="${a.id}"> ${h(a.nome)}</label>`).join('')}</div>
            <div class="acoes-lista"><button type="button" class="btn btn--primary" data-acao="confirmar-chamada">Registrar chamada</button></div>`);
    }

    function modalReconhecer() {
        const ids = Array.from(tela.selecao);
        const dia = diaDeHoje();
        const lista = D.regras.comportamentos.filter((c) => c.tipo === 'positivo');
        abrirModal(`<h2 id="modal-titulo">＋ XP para ${ids.length} estudante${ids.length > 1 ? 's' : ''}</h2>
            <p class="dica">${h(nomesCurtos(ids))}</p>
            ${dia && dia.multiplicador > 1 ? `<p class="aviso aviso--ok">${h(dia.evento.icone)} ${h(dia.evento.nome)}: ${dia.so ? `“${h((lista.find((c) => c.id === dia.so) || {}).nome || '')}”` : 'todo reconhecimento'} vale ×${dia.multiplicador} hoje.</p>` : ''}
            <label class="campo-bloco">Observação (opcional)<input type="text" id="nota-comportamento" maxlength="120" placeholder="ex.: explicou a questão 3 para a guilda"></label>
            <div class="grade-comportamentos">${lista.map((c) => `<button type="button" class="botao-comportamento botao-comportamento--positivo" data-acao="aplicar-comportamento" data-comp="${h(c.id)}">
                <span class="bc-icone">${h(c.icone || '⭐')}</span><span class="bc-nome">${h(c.nome)}</span><span class="bc-valor">+${c.xp} XP</span></button>`).join('')}</div>`);
    }

    function modalDescontar(compId) {
        const ids = Array.from(tela.selecao);
        const lista = D.regras.comportamentos.filter((c) => c.tipo === 'negativo');
        const escolhido = lista.find((c) => c.id === compId);
        const dia = diaDeHoje();
        let protecao = '';
        if (escolhido) {
            const linhas = ids.map((id) => {
                const a = E.alunos[id];
                const ps = Motor.protetores(E, D.regras, id);
                if (!ps.length || a.caido) return '';
                return `<label class="linha-protecao">${h(a.nome)}: <select data-protegido="${id}">
                    <option value="">ninguém protege</option>
                    ${ps.map((p) => `<option value="${p.aluno.id}">${h(avatar(p.aluno))} ${h(p.aluno.nome)} usa ${h(p.poder.nome)} (−${p.poder.custo} MP, leva ${Math.round(escolhido.vida * (1 - p.poder.efeito.reducao))} de dano)</option>`).join('')}
                </select></label>`;
            }).join('');
            protecao = `<div class="painel-escolha">
                <p><strong>${h(escolhido.icone)} ${h(escolhido.nome)}</strong> — ${escolhido.vida} de dano no HP${dia && dia.semDano ? ' <em>(zona segura: hoje não tira HP)</em>' : ''}.</p>
                ${linhas ? `<p class="dica">Um(a) Guerreiro(a) da mesma guilda pode tankar o dano no lugar do colega:</p>${linhas}` : ''}
                ${escolhido.ocorrencia ? avisoOcorrencia() : ''}
                <label class="campo-bloco">Observação (opcional)<input type="text" id="nota-comportamento" maxlength="120"></label>
                <div class="acoes-lista"><button type="button" class="btn btn--negativo" data-acao="aplicar-comportamento" data-comp="${h(escolhido.id)}">Aplicar dano</button></div>
            </div>`;
        }
        abrirModal(`<h2 id="modal-titulo">− HP de ${ids.length} estudante${ids.length > 1 ? 's' : ''}</h2>
            <p class="dica">${h(nomesCurtos(ids))}. O dano tira HP, nunca XP. Quem chega a zero fica K.O. e volta por uma missão de respawn.</p>
            <div class="grade-comportamentos">${lista.map((c) => `<button type="button" class="botao-comportamento botao-comportamento--negativo${c.id === compId ? ' escolhido' : ''}" data-acao="escolher-desconto" data-comp="${h(c.id)}">
                <span class="bc-icone">${h(c.icone || '⚠️')}</span><span class="bc-nome">${h(c.nome)}</span><span class="bc-valor">−${c.vida} HP</span></button>`).join('')}</div>
            ${protecao}`);
    }

    function avisoOcorrencia() {
        const url = D.perfil.ocorrenciasUrl;
        return `<div class="aviso">
            <strong>Isto também pede registro de ocorrência.</strong> O jogo não substitui o registro oficial.
            Lembre: assinatura do(a) estudante na lista da Coordenação e o horário do registro.
            ${url ? `<br><a href="${h(url)}" target="_blank" rel="noopener">Abrir o formulário de ocorrências →</a>` : ''}
        </div>`;
    }

    function nomesCurtos(ids) {
        const nomes = ids.map((id) => (E.alunos[id] || {}).nome).filter(Boolean);
        return nomes.length > 5 ? `${nomes.slice(0, 5).join(', ')} e mais ${nomes.length - 5}` : nomes.join(', ');
    }

    function aplicarComportamento(compId) {
        const c = D.regras.comportamentos.find((x) => x.id === compId);
        if (!c) return;
        const ids = Array.from(tela.selecao);
        const nota = ($('#nota-comportamento') || {}).value || '';
        const protecoes = {};
        for (const sel of $$('[data-protegido]')) if (sel.value) protecoes[sel.dataset.protegido] = sel.value;
        const ev = emitir('comportamento', { alunoIds: ids, comportamento: Regras.copiar(c), nota: nota.trim(), protecoes });
        fecharModal();
        tela.selecao.clear();
        desenhar();
        const quedas = E.registros.filter((r) => r.ev === ev.id && r.tipo === 'queda').map((r) => E.alunos[r.alunoId].nome);
        const niveis = E.registros.filter((r) => r.ev === ev.id && r.tipo === 'nivel').map((r) => E.alunos[r.alunoId].nome);
        let texto = c.tipo === 'positivo' ? `${c.icone || ''} ${c.nome}: +XP para ${ids.length}` : `${c.nome}: dano em ${ids.length}`;
        if (niveis.length) texto += ` · LEVEL UP: ${niveis.join(', ')}!`;
        if (quedas.length) texto += ` · K.O.: ${quedas.join(', ')}`;
        avisar(texto, null, ev.id);
    }

    /* ===== ficha do estudante ===== */

    function modalFicha(id) {
        const a = E.alunos[id];
        if (!a) return;
        const c = classe(a.classe);
        const p = progressoXp(a);
        const guilda = a.guilda && E.guildas[a.guilda];
        const colegas = Motor.membros(E, a.guilda).filter((x) => x.id !== a.id);
        const poderes = Motor.poderesDe(D.regras, a).sort((x, y) => x.nivel - y.nivel);
        const registros = E.registros.filter((r) => r.alunoId === id).slice(-25).reverse();
        const desfazivel = (r) => {
            const ev = D.eventos.find((e) => e.id === r.ev);
            return ev && Motor.DESFAZIVEIS.has(ev.tipo);
        };
        const delta = (r) => [r.xp ? `${r.xp > 0 ? '+' : ''}${r.xp} XP` : '', r.vida ? `${r.vida > 0 ? '+' : ''}${r.vida} HP` : '',
            r.energia ? `${r.energia > 0 ? '+' : ''}${r.energia} MP` : '', r.moeda ? `${r.moeda > 0 ? '+' : ''}${r.moeda} ${moeda().simbolo}` : ''].filter(Boolean).join(' · ');

        const blocoPoderes = poderes.map((pd) => {
            const motivo = Motor.motivoPoder(E, D.regras, a.id, pd.id, colegas[0] && colegas[0].id);
            const passivo = pd.efeito.tipo === 'proteger';
            const precisaColega = pd.efeito.alvo === 'colega';
            const liberado = a.nivel >= pd.nivel;
            const usavel = !passivo && (!motivo || (precisaColega && !/nível|Mana|respawn/.test(motivo)));
            return `<li class="poder${liberado ? '' : ' poder--bloqueado'}">
                <div><strong>${liberado ? '' : '🔒 '}${h(pd.nome)}</strong> <span class="contagem">nível ${pd.nivel} · ${pd.custo} MP</span><br><span class="dica-inline">${h(pd.descricao)}</span></div>
                ${passivo ? '<span class="selo">usado na hora do dano</span>'
                    : usavel ? `<div class="poder-acao">${precisaColega ? `<select id="alvo-${pd.id}">${colegas.filter((x) => !x.caido).map((x) => `<option value="${x.id}">${h(x.nome)}</option>`).join('')}</select>` : ''}
                        <button type="button" class="btn btn--pequeno btn--primary" data-acao="usar-poder" data-id="${a.id}" data-poder="${pd.id}">Usar</button></div>`
                        : `<span class="selo selo--cinza">${h(motivo || '')}</span>`}
            </li>`;
        }).join('');

        const respawn = a.caido ? `<div class="painel-escolha painel-escolha--queda">
            <h3>😵 K.O. — missão de respawn</h3>
            <p class="dica">Combine com o(a) estudante (e o PDT) uma forma de reparar o que aconteceu. Concluída, volta para a guilda com ${Math.round((D.regras.voltaDaQueda || 0.5) * 100)}% do HP.</p>
            <select id="reparacao-escolha">${D.regras.reparacoes.map((r) => `<option value="${h(r.id)}">${h(r.nome)}</option>`).join('')}</select>
            <label class="campo-bloco">Como foi (opcional)<input type="text" id="reparacao-nota" maxlength="160"></label>
            <button type="button" class="btn btn--primary" data-acao="concluir-reparacao" data-id="${a.id}">Respawn: missão concluída</button>
        </div>` : '';

        abrirModal(`<div class="ficha-topo">
                <div class="avatar avatar--grande" aria-hidden="true">${avatar(a)}</div>
                <div><h2 id="modal-titulo">${h(a.nome)}</h2>
                <p class="dica"><strong>Nível ${a.nivel} · ${h(Regras.titulo(a.nivel))}</strong> · ${h(c.nome)} (${h(c.funcao)}) · ${h(a.turma)}${guilda ? ` · guilda ${h(guilda.nome)}` : ''}</p>
                <p class="dica-inline">${h(c.papel)}</p></div>
            </div>
            <div class="ficha-barras">
                <div><span>❤️ HP</span>${barra(a.vida, c.vidaMax, 'vida', 'HP')}</div>
                <div><span>💧 Mana</span>${barra(a.energia, c.energiaMax, 'energia', 'MP')}</div>
                <div><span>⭐ XP</span>${barra(p.atual, p.total, 'xp', 'XP')}<small>${a.xp} XP no total · faltam ${p.falta} para o nível ${a.nivel + 1}</small></div>
                <div><span>${h(moeda().simbolo)} ${h(moeda().nome)}</span><strong>${a.moeda}</strong></div>
            </div>
            ${respawn}
            <h3>Visual</h3>
            <div class="avatares">${(c.avatares || [c.icone]).map((v) => `<button type="button" class="avatar-opcao${v === (a.avatar || c.icone) ? ' escolhido' : ''}" data-acao="trocar-avatar" data-id="${a.id}" data-avatar="${h(v)}" aria-label="Visual ${h(v)}">${h(v)}</button>`).join('')}</div>
            <h3>Árvore de poderes — ${h(c.nome)}</h3>
            <ul class="lista-poderes">${blocoPoderes}</ul>
            <h3>Histórico</h3>
            ${registros.length ? `<ul class="historico">${registros.map((r) => `<li class="hist hist--${r.tipo}">
                <span class="hist-data">${dataBR(r.data)}</span><span class="hist-texto">${h(r.texto)}${r.autor ? ` <em>· ${h(r.autor)}</em>` : ''}</span>
                <span class="hist-delta">${h(delta(r))}</span>
                ${desfazivel(r) ? `<button type="button" class="link-ficha" data-acao="desfazer" data-ev="${h(r.ev)}" title="Desfaz o evento inteiro (todos os estudantes dele)">desfazer</button>` : ''}
            </li>`).join('')}</ul>` : '<p class="dica">Nada registrado ainda.</p>'}`, 'modal-caixa--larga');
    }

    /* ===== aba Telão ===== */

    function desenharTelao() {
        const alunos = alunosTurma();
        const dia = diaDeHoje();
        const semana = E.registros.filter((r) => r.turma === turma() && Conselheiro.diasEntre(r.data, hoje()) < 7 && r.xp > 0);
        const xpDe = (ids) => semana.filter((r) => ids.has(r.alunoId)).reduce((s, r) => s + r.xp, 0);
        const ranking = Motor.guildasDaTurma(E, turma()).map((j) => {
            const m = Motor.membros(E, j.id);
            return { j, xp: xpDe(new Set(m.map((a) => a.id))), n: m.length };
        }).sort((x, y) => y.xp - x.xp);
        const maior = Math.max(1, ...ranking.map((r) => r.xp));
        const d = Conselheiro.destaques(E, turma(), hoje());
        const s = tela.sorteado && E.alunos[tela.sorteado];
        const medalha = ['🥇', '🥈', '🥉'];
        return `<div class="telao" id="telao">
            <div class="telao-topo">
                <h2>${h(turma())} <span>· ${h(D.perfil.sigla || D.perfil.nome)}</span></h2>
                <button type="button" class="btn btn--pequeno" data-acao="tela-cheia">⛶ Tela cheia</button>
            </div>
            <div class="telao-grade">
                <section class="telao-cartao telao-evento">
                    <div class="telao-icone">${h(dia ? dia.evento.icone : '🎲')}</div>
                    <h3>${h(dia ? dia.evento.nome : 'O dia ainda não começou')}</h3>
                    <p>${h(dia ? dia.evento.texto : 'Comece o dia na aba Turma para rolar o evento.')}</p>
                </section>
                <section class="telao-cartao telao-sorteio">
                    <h3>Quem responde?</h3>
                    <div class="sorteado${s ? ' sorteado--pronto' : ''}" id="sorteado">${s ? `${h(avatar(s))} ${h(s.nome)}` : '🎲'}</div>
                    <div class="acoes-lista acoes-centro">
                        <button type="button" class="btn btn--primary" data-acao="sortear" ${alunos.length ? '' : 'disabled'}>Rolar o dado</button>
                        ${s ? `<button type="button" class="btn btn--positivo" data-acao="reconhecer-sorteado">＋ XP</button>` : ''}
                    </div>
                    <p class="telao-nota">Sorteio justo: quem participou menos na semana tem mais chance, e quem faltou hoje não entra.</p>
                </section>
                <section class="telao-cartao telao-ranking">
                    <h3>🏆 Ranking das guildas (semana)</h3>
                    ${ranking.length ? ranking.map((r, i) => `<div class="rank-linha">
                        <span class="rank-pos">${medalha[i] || `${i + 1}º`}</span><span class="rank-nome">${h(r.j.nome)}</span>
                        <span class="rank-barra"><span style="width:${Math.round(r.xp / maior * 100)}%"></span></span><span class="rank-xp">${r.xp} XP</span>
                    </div>`).join('') : '<p>Forme as guildas para ver o ranking.</p>'}
                </section>
                <section class="telao-cartao telao-destaques">
                    <h3>⭐ MVPs da semana</h3>
                    ${d.semana.length ? d.semana.map((x) => `<div class="destaque">${h(avatar(x.aluno))} <strong>${h(x.aluno.nome)}</strong> <span>+${x.xp} XP</span></div>`).join('') : '<p>Ainda sem MVPs nesta semana.</p>'}
                </section>
            </div>
            <p class="telao-nota">O Telão mostra só conquistas: HP e danos ficam na tela do professor.</p>
        </div>`;
    }

    function sortear() {
        const alvo = $('#sorteado');
        const candidatos = alunosTurma();
        let n = 0;
        const timer = setInterval(() => {
            const a = candidatos[Math.floor(Math.random() * candidatos.length)];
            if (alvo) alvo.textContent = a.nome;
            if (++n > 12) {
                clearInterval(timer);
                const escolhido = Conselheiro.sortear(E, turma(), hoje(), Math.random, tela.sorteado ? [tela.sorteado] : []);
                tela.sorteado = escolhido ? escolhido.id : null;
                desenhar();
            }
        }, 80);
    }

    /* ===== aba Quests ===== */

    const MODELOS_MISSAO = [
        { titulo: 'Simulado SPAECE — Língua Portuguesa', area: 'Linguagens e Códigos', habilidade: 'LP D4 — Inferir uma informação implícita em um texto', xp: 60, moeda: 10 },
        { titulo: 'Lista de Matemática — tabelas e gráficos', area: 'Matemática', habilidade: 'MT D34 — Resolver problema com informações apresentadas em tabelas e/ou gráficos', xp: 50, moeda: 10 },
        { titulo: 'Leitura do mês', area: 'Linguagens e Códigos', habilidade: 'LP D6 — Identificar o tema de um texto', xp: 40, moeda: 5 },
        { titulo: 'Etapa do projeto do NTPPS', area: '', habilidade: 'Pesquisa e projeto de vida', xp: 50, moeda: 10 },
        { titulo: 'Revisão para o ENEM — Ciências da Natureza', area: 'Ciências da Natureza', habilidade: 'ENEM — Ciências da Natureza', xp: 50, moeda: 10 }
    ];

    function missoesDaTurma(ativas) {
        return Object.values(E.missoes)
            .filter((m) => (!m.turmas || !m.turmas.length || m.turmas.includes(turma())) && (ativas ? m.ativa : !m.ativa))
            .sort((x, y) => (x.prazo || '9999') < (y.prazo || '9999') ? -1 : 1);
    }

    function desenharMissoes() {
        const alunos = alunosTurma();
        const ativas = missoesDaTurma(true);
        const arquivadas = missoesDaTurma(false);
        const lista = tela.filtroMissoes === 'ativas' ? ativas : arquivadas;
        const cartao = (m) => {
            const feitos = alunos.filter((a) => m.concluidas[a.id]).length;
            const pct = alunos.length ? Math.round(feitos / alunos.length * 100) : 0;
            const atrasada = m.prazo && m.prazo < hoje() && m.ativa;
            return `<article class="missao">
                <div class="missao-topo"><h3>📜 ${h(m.titulo)}</h3><span class="selo">+${m.xp || 0} XP${m.moeda ? ` · +${m.moeda} ${h(moeda().simbolo)}` : ''}</span></div>
                <p class="dica-inline">${[m.area, m.habilidade].filter(Boolean).map(h).join(' · ')}${m.prazo ? ` · prazo ${dataBR(m.prazo)}${atrasada ? ' (vencido)' : ''}` : ''}</p>
                ${m.descricao ? `<p>${h(m.descricao)}</p>` : ''}
                <div class="progresso"><span style="width:${pct}%"></span></div>
                <p class="contagem">${feitos} de ${alunos.length} da ${h(turma())} completaram (${pct}%)${pct < 40 && m.ativa && alunos.length ? ' — vale retomar a habilidade em sala' : ''}</p>
                ${m.ativa ? `<div class="acoes-lista">
                    <button type="button" class="btn btn--primary btn--pequeno" data-acao="concluir-missao" data-id="${m.id}">Marcar quem completou</button>
                    <button type="button" class="btn btn--pequeno" data-acao="arquivar-missao" data-id="${m.id}">Arquivar</button>
                </div>` : ''}
            </article>`;
        };
        return `<div class="duas-colunas">
            <section>
                <div class="abas abas--mini">
                    <button class="aba${tela.filtroMissoes === 'ativas' ? ' ativa' : ''}" data-acao="filtro-missoes" data-filtro="ativas">Ativas (${ativas.length})</button>
                    <button class="aba${tela.filtroMissoes === 'arquivadas' ? ' ativa' : ''}" data-acao="filtro-missoes" data-filtro="arquivadas">Arquivadas (${arquivadas.length})</button>
                </div>
                ${lista.length ? lista.map(cartao).join('') : `<div class="vazio vazio--pequeno"><p>${tela.filtroMissoes === 'ativas' ? 'Nenhuma quest ativa para esta turma. Crie a primeira ao lado.' : 'Nada arquivado.'}</p></div>`}
            </section>
            <section class="passo">
                <h3>Nova quest</h3>
                <p class="dica">Quest é tarefa com recompensa em XP e ouro: lista, leitura, simulado, etapa de projeto. Ligue a uma habilidade (descritor) para o PCA acompanhar.</p>
                <div class="chips">${MODELOS_MISSAO.map((m, i) => `<button type="button" class="chip" data-acao="modelo-missao" data-i="${i}">${h(m.titulo)}</button>`).join('')}</div>
                <label class="campo-bloco">Título<input type="text" id="m-titulo" maxlength="80"></label>
                <label class="campo-bloco">O que fazer<textarea id="m-descricao" rows="2" maxlength="300"></textarea></label>
                <div class="linha-campos">
                    <label>Área<select id="m-area"><option value="">—</option>${D.perfil.areas.map((a) => `<option>${h(a.nome)}</option>`).join('')}</select></label>
                    <label class="campo-largo">Habilidade / descritor<input type="text" id="m-habilidade" list="habilidades" maxlength="120"></label>
                </div>
                <datalist id="habilidades">${Questoes.HABILIDADES.map((x) => `<option value="${h(x)}">`).join('')}</datalist>
                <div class="linha-campos">
                    <label>XP<input type="number" id="m-xp" value="50" min="0" max="500"></label>
                    <label>${h(moeda().nome)}<input type="number" id="m-moeda" value="5" min="0" max="100"></label>
                    <label>Prazo<input type="date" id="m-prazo"></label>
                </div>
                <fieldset class="campo-bloco"><legend>Turmas</legend>
                    <div class="lista-marcar lista-marcar--linha">${turmas().map((t) => `<label><input type="checkbox" name="m-turma" value="${h(t)}" ${t === turma() ? 'checked' : ''}> ${h(t)}</label>`).join('')}</div>
                </fieldset>
                <button type="button" class="btn btn--primary" data-acao="criar-missao">Criar quest</button>
            </section>
        </div>`;
    }

    /* ===== aba Boss ===== */

    function bancoQuestoes(area) {
        const daEscola = Object.values(E.questoes);
        const todas = daEscola.concat(Questoes.EXEMPLOS.filter(() => !D.semExemplos));
        return area ? todas.filter((q) => q.area === area) : todas;
    }

    function embaralhar(lista) {
        const l = lista.slice();
        for (let i = l.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [l[i], l[j]] = [l[j], l[i]];
        }
        return l;
    }

    function desenharBatalha() {
        const b = tela.batalha;
        if (!b || b.turma !== turma()) return desenharPreparoBatalha();
        const chefe = b.chefe;
        const pctVida = Math.round(b.vida / b.vidaMax * 100);
        const fim = b.vida <= 0 || b.indice >= b.questoes.length;
        const topo = `<div class="chefe${b.vida <= 0 ? ' chefe--derrotado' : ''}">
            <div class="chefe-icone">${h(chefe.icone)}</div>
            <div class="chefe-info"><p class="chefe-rotulo">BOSS</p><h2>${h(chefe.nome)}</h2>
                <div class="barra barra--chefe"><b>HP</b><span style="width:${pctVida}%"></span><em>${b.vida}/${b.vidaMax}</em></div>
                <p class="contagem">Questão ${Math.min(b.indice + 1, b.questoes.length)} de ${b.questoes.length} · loot: +${chefe.xp} XP${chefe.ouro ? ` e ${chefe.ouro} ${h(moeda().simbolo)}` : ''} para cada participante</p></div>
        </div>`;
        if (fim) {
            const vitoria = b.vida <= 0;
            return `${topo}<div class="vazio">
                <p class="vazio-icone">${vitoria ? '🏆' : '🌫️'}</p>
                <h2>${vitoria ? `VITÓRIA! A ${h(turma())} derrotou ${h(chefe.nome)}` : `${h(chefe.nome)} escapou desta vez`}</h2>
                <p>${vitoria ? `Cada um dos ${b.participantes.length} participantes ganha ${chefe.xp} XP${chefe.ouro ? ` e ${chefe.ouro} de ouro` : ''}.` : 'Ninguém perde nada: revanche em outro dia, com a matéria revisada.'}</p>
                <div class="acoes-lista acoes-centro">
                    ${b.registrada ? '<span class="selo">Resultado registrado</span>' : `<button type="button" class="btn btn--primary" data-acao="registrar-batalha">Registrar resultado</button>`}
                    <button type="button" class="btn" data-acao="nova-batalha">Nova batalha</button>
                </div></div>`;
        }
        const q = b.questoes[b.indice];
        return `${topo}
            <article class="questao-telao">
                <p class="contagem">${h([q.area, q.habilidade].filter(Boolean).join(' · '))}</p>
                <h3>${h(q.enunciado)}</h3>
                <ol class="alternativas">${q.alternativas.map((alt, i) => `<li class="${b.mostrar && i === q.correta ? 'correta' : ''}"><strong>${Questoes.LETRAS[i]})</strong> ${h(alt)}</li>`).join('')}</ol>
            </article>
            <div class="acoes-lista">
                ${b.mostrar ? '' : '<button type="button" class="btn" data-acao="mostrar-resposta">👁️ Mostrar resposta</button>'}
            </div>
            <h3>Quem acertou?</h3>
            <div class="grupos-acerto">${b.grupos.map((g) => `<button type="button" class="botao-acerto${b.acertos[g.id] ? ' acertou' : ''}" data-acao="marcar-acerto" data-grupo="${h(g.id)}">
                ${b.acertos[g.id] ? '✅' : '⬜'} ${h(g.nome)}${g.golpes > 1 ? ' <span class="selo">🏹 crítico ×2</span>' : ''}</button>`).join('')}</div>
            <div class="acoes-lista">
                <button type="button" class="btn btn--primary" data-acao="golpear">⚔️ Atacar e ir para a próxima</button>
                <button type="button" class="btn btn--pequeno" data-acao="encerrar-batalha">Encerrar</button>
            </div>`;
    }

    function desenharPreparoBatalha() {
        const banco = bancoQuestoes('');
        return `<div class="passo">
            <h3>🐉 Batalha contra o boss</h3>
            <p class="dica">Revisão em forma de raid. Cada guilda que acerta ataca o boss; guilda com Arqueiro(a) de pé dá golpe crítico (dano dobrado). O HP do boss cresce com o número de guildas. Vencendo, todos os participantes levam o loot. Errar não tira nada.</p>
            <div class="grade-chefes">${D.regras.chefes.map((c, i) => `<label class="cartao-chefe">
                <input type="radio" name="chefe" value="${h(c.id)}" ${i === 0 ? 'checked' : ''}>
                <span class="chefe-icone">${h(c.icone)}</span><strong>${h(c.nome)}</strong>
                <span class="dica-inline">${h(c.texto)}</span><span class="selo">${c.vida + 4} questões · +${c.xp} XP${c.ouro ? ` · +${c.ouro} ${h(moeda().simbolo)}` : ''}</span>
            </label>`).join('')}</div>
            <div class="linha-campos">
                <label>Área das questões<select id="b-area"><option value="">Todas (${banco.length})</option>
                    ${D.perfil.areas.map((a) => `<option value="${h(a.nome)}">${h(a.nome)} (${bancoQuestoes(a.nome).length})</option>`).join('')}</select></label>
            </div>
            <p class="dica">Cadastre as questões da escola na aba Cadastro (dá para colar várias de uma vez). As de exemplo ajudam a testar.</p>
            <button type="button" class="btn btn--primary" data-acao="iniciar-batalha" ${alunosTurma().length ? '' : 'disabled'}>Começar a batalha na ${h(turma())}</button>
        </div>`;
    }

    function iniciarBatalha() {
        const chefeId = ($('input[name="chefe"]:checked') || {}).value;
        const chefe = D.regras.chefes.find((c) => c.id === chefeId) || D.regras.chefes[0];
        const area = $('#b-area').value;
        const banco = bancoQuestoes(area);
        if (!banco.length) { avisar('Não há questões nessa área. Cadastre na aba Cadastro.', 'erro'); return; }
        const ausentes = new Set(chamadaDeHoje() || []);
        const participantes = alunosTurma().filter((a) => !ausentes.has(a.id)).map((a) => a.id);
        let grupos = Motor.guildasDaTurma(E, turma()).map((j) => ({ id: j.id, nome: j.nome, golpes: Motor.golpesDaGuilda(E, D.regras, j.id) }));
        if (!grupos.length) grupos = [{ id: 'turma-1', nome: 'Lado esquerdo', golpes: 1 }, { id: 'turma-2', nome: 'Lado direito', golpes: 1 }];
        let questoes = embaralhar(banco);
        while (questoes.length < chefe.vida + 3 && questoes.length < 40) questoes = questoes.concat(embaralhar(banco));
        const golpesPorRodada = grupos.reduce((s, g) => s + g.golpes, 0);
        const vidaMax = Math.max(chefe.vida, Math.round(chefe.vida * golpesPorRodada * 0.5));
        tela.batalha = { turma: turma(), chefe: Regras.copiar(chefe), vida: vidaMax, vidaMax, questoes: questoes.slice(0, chefe.vida + 4), indice: 0, mostrar: false, acertos: {}, grupos, participantes, registrada: false };
        desenhar();
    }

    /* ===== aba Loja ===== */

    function desenharLoja() {
        const alunos = alunosTurma();
        if (!alunos.length) return '<div class="vazio"><p>Cadastre a turma para abrir a loja.</p></div>';
        if (!tela.comprador || !alunos.some((a) => a.id === tela.comprador)) tela.comprador = alunos[0].id;
        const a = E.alunos[tela.comprador];
        const compras = E.registros.filter((r) => r.turma === turma() && r.tipo === 'compra').slice(-10).reverse();
        return `<div class="duas-colunas">
            <section>
                <div class="passo loja-cliente">
                    <label class="campo-bloco">Quem está comprando?
                        <select id="comprador">${alunos.map((x) => `<option value="${x.id}" ${x.id === a.id ? 'selected' : ''}>${h(x.nome)} — ${x.moeda} ${h(moeda().simbolo)}</option>`).join('')}</select>
                    </label>
                    <p class="saldo">${h(avatar(a))} <strong>${h(a.nome)}</strong> tem <strong>${a.moeda} ${h(moeda().simbolo)}</strong> ${h(moeda().nome.toLowerCase())}</p>
                </div>
                <div class="grade-loja">${D.regras.loja.map((i) => {
                    const falta = a.moeda < i.preco;
                    const bloqueado = falta || (a.caido && i.efeito.tipo !== 'privilegio');
                    return `<div class="item-loja${bloqueado ? ' item-loja--bloqueado' : ''}">
                        <span class="item-icone">${h(i.icone)}</span><strong>${h(i.nome)}</strong>
                        <span class="dica-inline">${h(i.descricao)}</span>
                        <button type="button" class="btn btn--primary btn--pequeno" data-acao="comprar" data-item="${h(i.id)}" ${bloqueado ? 'disabled' : ''}>${i.preco} ${h(moeda().simbolo)}</button>
                    </div>`;
                }).join('')}</div>
                <p class="dica">Ouro vem dos níveis, das quests, do loot dos bosses e da sequência de presença. Os itens e preços se mudam na aba Escola (regras em JSON).</p>
            </section>
            <section class="passo">
                <h3>Últimas compras na ${h(turma())}</h3>
                ${compras.length ? `<ul class="lista-simples">${compras.map((r) => `<li>${dataBR(r.data)} · <strong>${h((E.alunos[r.alunoId] || {}).nome)}</strong> — ${h(r.texto.replace(/^Comprou /, '').split(':')[0])} (${r.moeda} ${h(moeda().simbolo)})
                    <button type="button" class="link-ficha" data-acao="desfazer" data-ev="${h(r.ev)}">desfazer</button></li>`).join('')}</ul>` : '<p class="dica">Nenhuma compra ainda.</p>'}
            </section>
        </div>`;
    }

    /* ===== aba Oráculo ===== */

    function desenharConselheiro() {
        const s = Conselheiro.saude(E, D.regras, turma(), hoje());
        const al = Conselheiro.alertas(E, D.regras, turma(), hoje(), D.perfil);
        const eq = Conselheiro.equilibrio(E, D.regras, turma());
        const d = Conselheiro.destaques(E, turma(), hoje());
        const prop = s.proporcao === null ? '—' : s.proporcao === Infinity ? 'só XP' : `${s.proporcao.toFixed(1).replace('.', ',')} : 1`;
        const pdt = D.perfil.pdts && D.perfil.pdts[turma()];
        const visaoEscola = turmas().map((t) => {
            const st = Conselheiro.saude(E, D.regras, t, hoje());
            const altas = Conselheiro.alertas(E, D.regras, t, hoje(), D.perfil).filter((x) => x.nivel === 'alta').length;
            return { t, st, altas };
        }).filter((x) => x.st.alunos);
        return `<p class="dica">O Oráculo é a visão do mestre do jogo: lê o histórico e aponta o que pede atenção. Os estudantes não veem esta tela.</p>
            <div class="indicadores">
                <div class="indicador"><strong>${prop}</strong><span>reconhecimentos (+XP) por dano (14 dias)</span></div>
                <div class="indicador"><strong>${Math.round(s.alcance * 100)}%</strong><span>da turma ganhou XP ao menos uma vez</span></div>
                <div class="indicador"><strong>${Math.round(s.vidaMedia * 100)}%</strong><span>HP médio</span></div>
                <div class="indicador"><strong>${s.xpSemana}</strong><span>XP na semana</span></div>
                <div class="indicador${s.caidos ? ' indicador--alerta' : ''}"><strong>${s.caidos}</strong><span>K.O. aguardando respawn</span></div>
            </div>
            <div class="duas-colunas">
                <section>
                    <h3>O que pede atenção na ${h(turma())}</h3>
                    ${al.length ? `<ul class="alertas">${al.map((a) => `<li class="alerta alerta--${a.nivel}">
                        <div><strong>${h(a.titulo)}</strong><span>${h(a.detalhe)}</span></div>
                        ${a.alunoId ? `<button type="button" class="btn btn--pequeno" data-acao="ficha" data-id="${a.alunoId}">Abrir ficha</button>` : ''}
                        ${a.acao === 'formar' ? '<button type="button" class="btn btn--pequeno" data-acao="sugerir-guildas">Ver sugestão</button>' : ''}
                    </li>`).join('')}</ul>` : '<p class="aviso aviso--ok">Nada fora do lugar nesta turma. GG!</p>'}
                    <h3>MVPs da semana</h3>
                    ${d.semana.length ? `<ul class="lista-simples">${d.semana.map((x) => `<li>${h(avatar(x.aluno))} <strong>${h(x.aluno.nome)}</strong> · +${x.xp} XP
                        <button type="button" class="link-ficha" data-acao="certificado" data-id="${x.aluno.id}">certificado</button></li>`).join('')}</ul>` : '<p class="dica">Sem MVPs ainda.</p>'}
                    ${d.viradas.length ? `<h3>Viraram o jogo</h3><p class="dica">Tomavam dano na semana passada e nesta só ganharam XP. Vale dizer isso a eles.</p>
                        <ul class="lista-simples">${d.viradas.map((x) => `<li>🔄 <strong>${h(x.aluno.nome)}</strong> <button type="button" class="link-ficha" data-acao="certificado" data-id="${x.aluno.id}">certificado</button></li>`).join('')}</ul>` : ''}
                </section>
                <section>
                    <h3>Guildas</h3>
                    ${eq.guildas.length ? `<table class="tabela"><thead><tr><th>Guilda</th><th>Membros</th><th>Classes</th><th>XP médio</th></tr></thead><tbody>
                        ${eq.guildas.map((j) => `<tr><td>🏰 ${h(j.nome)}</td><td>${j.membros}</td><td>${j.classes}/${D.regras.classes.length}</td><td>${Math.round(j.xpMedio)}</td></tr>`).join('')}
                    </tbody></table>` : '<p class="dica">Esta turma ainda não tem guildas.</p>'}
                    ${eq.desequilibrada ? `<p class="aviso">${h(eq.motivo)}</p>` : ''}
                    <button type="button" class="btn" data-acao="sugerir-guildas">🧮 Sugerir guildas equilibradas</button>
                    <h3>Resumo para o PDT${pdt ? ` (${h(pdt)})` : ''}</h3>
                    <p class="dica">Pronto para colar no WhatsApp ou levar ao Conselho de Classe.</p>
                    <textarea id="resumo-pdt" rows="10" readonly>${h(Conselheiro.resumoPDT(E, D.regras, D.perfil, turma(), hoje()))}</textarea>
                    <button type="button" class="btn" data-acao="copiar-resumo">📋 Copiar resumo</button>
                </section>
            </div>
            ${visaoEscola.length > 1 ? `<h3>Visão da escola</h3>
            <div class="tabela-rolagem"><table class="tabela"><thead><tr><th>Turma</th><th>Estudantes</th><th>XP na semana</th><th>+XP : dano</th><th>Alcance</th><th>Alertas graves</th></tr></thead><tbody>
                ${visaoEscola.map(({ t, st, altas }) => `<tr><td><button type="button" class="link-ficha" data-acao="ir-turma" data-turma="${h(t)}">${h(t)}</button></td><td>${st.alunos}</td><td>${st.xpSemana}</td>
                    <td>${st.positivos} : ${st.negativos}</td><td>${Math.round(st.alcance * 100)}%</td><td>${altas ? `<strong class="texto-alerta">${altas}</strong>` : '0'}</td></tr>`).join('')}
            </tbody></table></div>` : ''}`;
    }

    function modalSugerirGuildas() {
        const alunos = alunosTurma();
        if (alunos.length < 2) { avisar('Cadastre a turma primeiro.', 'erro'); return; }
        const sugestao = Conselheiro.formarGuildas(alunos, D.regras.tamanhoGuilda, { prefixoId: Motor.novoId('j') + '-' });
        tela.sugestao = sugestao;
        abrirModal(`<h2 id="modal-titulo">🧮 Guildas equilibradas para a ${h(turma())}</h2>
            <p class="dica">Cada guilda com tanque, suporte, mana e dano sempre que possível, e XP total parecido. Aplicar desfaz as guildas atuais da turma (o XP de cada estudante continua o mesmo).</p>
            <div class="grade-sugestao">${sugestao.guildas.map((j) => {
                const m = alunos.filter((a) => sugestao.membros[a.id] === j.id);
                return `<div class="sugestao"><strong>🏰 ${h(j.nome)}</strong><span class="contagem">${m.reduce((s, a) => s + a.xp, 0)} XP</span>
                    <ul>${m.map((a) => `<li>${h(classe(a.classe).icone)} ${h(a.nome)}</li>`).join('')}</ul></div>`;
            }).join('')}</div>
            <div class="acoes-lista"><button type="button" class="btn btn--primary" data-acao="aplicar-guildas">Aplicar estas guildas</button></div>`, 'modal-caixa--larga');
    }

    function certificado(id) {
        const a = E.alunos[id];
        const janela = window.open('', '_blank');
        if (!janela) { avisar('Libere as janelas pop-up para imprimir o certificado.', 'erro'); return; }
        janela.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Certificado — ${h(a.nome)}</title>
            <style>body{font-family:Georgia,serif;margin:0;display:grid;place-items:center;min-height:100vh;background:#fff}
            .c{border:10px double #3b1f6b;padding:48px 64px;max-width:820px;text-align:center}
            h1{font-size:40px;margin:0 0 8px;color:#3b1f6b}h2{font-size:30px;margin:24px 0}p{font-size:18px;line-height:1.6}
            .assin{margin-top:56px;display:flex;justify-content:space-around;gap:40px}.assin span{border-top:1px solid #333;padding-top:6px;min-width:220px}
            @media print{@page{size:landscape;margin:12mm}}</style></head><body><div class="c">
            <div style="font-size:48px">${h(avatar(a))}</div><h1>Certificado de Conquista</h1>
            <p>${h(D.perfil.nome)} — ${h(D.perfil.municipio)}</p>
            <p>Certificamos que</p><h2>${h(a.nome)}</h2>
            <p>da turma ${h(a.turma)} alcançou o <strong>nível ${a.nivel} — ${h(Regras.titulo(a.nivel))}</strong> na Saga, como <strong>${h(classe(a.classe).nome)}</strong>,
            com dedicação, cooperação e respeito à sua guilda.</p>
            <p>${dataBR(hoje())}</p>
            <div class="assin"><span>${h(D.professor || 'Professor(a)')}</span><span>Coordenação Pedagógica</span></div>
            </div><script>setTimeout(function(){window.print()},300)<\/script></body></html>`);
        janela.document.close();
    }

    /* ===== aba Cadastro ===== */

    function desenharCadastro() {
        const alunos = alunosTurma();
        const guildas = Motor.guildasDaTurma(E, turma());
        const questoesEscola = Object.values(E.questoes);
        return `<div class="duas-colunas">
            <section class="passo">
                <h3>Estudantes da ${h(turma())} (${alunos.length})</h3>
                ${alunos.length ? `<div class="tabela-rolagem"><table class="tabela tabela--edicao"><thead><tr><th>Nome ou apelido</th><th>Classe</th><th>Guilda</th><th></th></tr></thead><tbody>
                    ${alunos.map((a) => `<tr>
                        <td><input type="text" value="${h(a.nome)}" data-mudar="aluno" data-campo="nome" data-id="${a.id}" aria-label="Nome"></td>
                        <td><select data-mudar="aluno" data-campo="classe" data-id="${a.id}" aria-label="Classe">${D.regras.classes.map((c) => `<option value="${c.id}" ${c.id === a.classe ? 'selected' : ''}>${h(c.icone)} ${h(c.nome)}</option>`).join('')}</select></td>
                        <td><select data-mudar="aluno" data-campo="guilda" data-id="${a.id}" aria-label="Guilda"><option value="">—</option>${guildas.map((j) => `<option value="${j.id}" ${j.id === a.guilda ? 'selected' : ''}>${h(j.nome)}</option>`).join('')}</select></td>
                        <td><button type="button" class="link-ficha" data-acao="remover-aluno" data-id="${a.id}">remover</button></td>
                    </tr>`).join('')}
                </tbody></table></div>` : '<p class="dica">Nenhum estudante ainda.</p>'}
                <h3>Adicionar estudantes</h3>
                <p class="dica">Um por linha. Prefira o apelido ou o primeiro nome: os dados ficam neste aparelho, mas quanto menos dado pessoal, melhor (LGPD). As classes são distribuídas em rodízio para a turma ter todas; o ideal é cada estudante escolher a sua no começo — dá para trocar aqui.</p>
                <textarea id="novos-alunos" rows="6" placeholder="Ana Clara&#10;Bruno&#10;Cauã"></textarea>
                <div class="acoes-lista"><button type="button" class="btn btn--primary" data-acao="adicionar-alunos">Adicionar à ${h(turma())}</button></div>
            </section>
            <section>
                <div class="passo">
                    <h3>Guildas da ${h(turma())}</h3>
                    ${guildas.length ? `<ul class="lista-simples">${guildas.map((j) => `<li>🏰 <input type="text" value="${h(j.nome)}" data-mudar="guilda" data-id="${j.id}" aria-label="Nome da guilda" class="input-curto">
                        <span class="contagem">${Motor.membros(E, j.id).length} membros</span>
                        <button type="button" class="link-ficha" data-acao="remover-guilda" data-id="${j.id}">remover</button></li>`).join('')}</ul>` : '<p class="dica">Sem guildas.</p>'}
                    <div class="linha-campos"><label class="campo-largo">Nova guilda<input type="text" id="nova-guilda" placeholder="ex.: Dragões do Mar" maxlength="40"></label></div>
                    <div class="acoes-lista">
                        <button type="button" class="btn" data-acao="criar-guilda">Criar</button>
                        <button type="button" class="btn btn--primary" data-acao="sugerir-guildas">🧮 Formar automaticamente</button>
                    </div>
                </div>
                <div class="passo">
                    <h3>Banco de questões da escola (${questoesEscola.length})</h3>
                    <p class="dica">Usadas nas batalhas contra o boss. Cole uma ou várias, separadas por linha em branco, neste formato:</p>
                    <pre class="exemplo">Quanto é 25% de 80?\nA) 15\nB) 20\nC) 25\nResposta: B</pre>
                    <div class="linha-campos">
                        <label>Área<select id="q-area"><option value="">—</option>${D.perfil.areas.map((a) => `<option>${h(a.nome)}</option>`).join('')}</select></label>
                        <label class="campo-largo">Habilidade<input type="text" id="q-habilidade" list="habilidades-q"></label>
                    </div>
                    <datalist id="habilidades-q">${Questoes.HABILIDADES.map((x) => `<option value="${h(x)}">`).join('')}</datalist>
                    <textarea id="q-texto" rows="6"></textarea>
                    <div class="acoes-lista"><button type="button" class="btn btn--primary" data-acao="adicionar-questoes">Adicionar questões</button></div>
                    ${questoesEscola.length ? `<ul class="lista-simples lista-questoes">${questoesEscola.map((q) => `<li><span>${h(q.enunciado.slice(0, 90))}${q.enunciado.length > 90 ? '…' : ''} <em class="contagem">${h(q.area || '')}</em></span>
                        <button type="button" class="link-ficha" data-acao="remover-questao" data-id="${q.id}">remover</button></li>`).join('')}</ul>` : ''}
                    <label class="check-inline"><input type="checkbox" data-mudar="sem-exemplos" ${D.semExemplos ? 'checked' : ''}> Não usar as ${Questoes.EXEMPLOS.length} questões de exemplo nas batalhas</label>
                </div>
            </section>
        </div>`;
    }

    function adicionarAlunos() {
        const nomes = $('#novos-alunos').value.split('\n').map((l) => l.split(';')[0].trim()).filter(Boolean);
        if (!nomes.length) { avisar('Cole ao menos um nome.', 'erro'); return; }
        const existentes = alunosTurma();
        const contagem = {};
        for (const c of D.regras.classes) contagem[c.id] = existentes.filter((a) => a.classe === c.id).length;
        const t0 = Date.now();
        nomes.forEach((nome, i) => {
            const classeId = Object.keys(contagem).sort((x, y) => contagem[x] - contagem[y])[0];
            contagem[classeId]++;
            D.eventos.push(Motor.criarEvento('aluno.novo', { aluno: { id: Motor.novoId('a'), nome, turma: turma(), classe: classeId } }, { autor: D.professor, agora: t0 + i }));
        });
        recalcular();
        avisar(`${nomes.length} estudante${nomes.length > 1 ? 's' : ''} na ${turma()}. Agora forme as guildas.`);
    }

    /* ===== aba Escola ===== */

    function desenharEscola() {
        const p = D.perfil;
        const r = D.regras;
        return `<div class="duas-colunas">
            <section class="passo">
                <h3>🏫 Perfil da escola</h3>
                <p class="dica">É o que adapta a Saga a qualquer escola estadual do Ceará. Os comportamentos sugeridos mudam com o tipo (EEMTI tem NTPPS e Eletivas; EEEP, estágio e laboratório).</p>
                <label class="campo-bloco">Nome<input type="text" id="p-nome" value="${h(p.nome)}"></label>
                <div class="linha-campos">
                    <label>Sigla<input type="text" id="p-sigla" value="${h(p.sigla)}" maxlength="12"></label>
                    <label class="campo-largo">Município<input type="text" id="p-municipio" value="${h(p.municipio)}"></label>
                </div>
                <div class="linha-campos">
                    <label class="campo-largo">CREDE / SEFOR<select id="p-crede">${Escola.CREDES.map((c) => `<option ${c === p.crede ? 'selected' : ''}>${h(c)}</option>`).join('')}</select></label>
                    <label class="campo-largo">Tipo<select id="p-tipo">${Escola.TIPOS.map((t) => `<option value="${t.id}" ${t.id === p.tipo ? 'selected' : ''}>${h(t.nome)}</option>`).join('')}</select></label>
                </div>
                <label class="campo-bloco">Turmas <small>separadas por vírgula ou uma por linha</small><textarea id="p-turmas" rows="2">${h(p.turmas.join(', '))}</textarea></label>
                <h3>Diretores de Turma (PPDT)</h3>
                <div class="grade-pdt">${p.turmas.map((t) => `<label>${h(t)}<input type="text" data-pdt="${h(t)}" value="${h((p.pdts || {})[t] || '')}"></label>`).join('')}</div>
                <h3>Áreas e PCAs</h3>
                <div class="grade-pdt">${p.areas.map((a, i) => `<label><input type="text" data-area-nome="${i}" value="${h(a.nome)}" aria-label="Área"><input type="text" data-area-pca="${i}" value="${h(a.pca)}" placeholder="PCA" aria-label="PCA"></label>`).join('')}</div>
                <h3>Moeda do jogo</h3>
                <div class="linha-campos">
                    <label class="campo-largo">Nome<input type="text" id="p-moeda" value="${h(p.moeda.nome)}"></label>
                    <label>Símbolo<input type="text" id="p-simbolo" value="${h(p.moeda.simbolo)}" maxlength="3"></label>
                    <label>Por nível<input type="number" id="r-moeda-nivel" value="${r.moeda.porNivel}" min="0" max="100"></label>
                </div>
                <label class="campo-bloco">Link do formulário de ocorrências <small>aparece quando um dano pede registro oficial</small><input type="text" id="p-ocorrencias" value="${h(p.ocorrenciasUrl)}"></label>
                <div class="acoes-lista">
                    <button type="button" class="btn btn--primary" data-acao="salvar-perfil">Salvar perfil</button>
                    <button type="button" class="btn btn--pequeno" data-acao="perfil-modelo" data-modelo="malu">Modelo EEMTI MALU</button>
                    <button type="button" class="btn btn--pequeno" data-acao="perfil-modelo" data-modelo="generica">Começar de uma escola em branco</button>
                </div>
            </section>
            <section>
                <div class="passo">
                    <h3>⚖️ Comportamentos</h3>
                    <p class="dica">Combine com a turma no começo do ano. Valor é XP para os positivos e dano no HP para os negativos.</p>
                    <div class="tabela-rolagem"><table class="tabela tabela--edicao"><thead><tr><th></th><th>Nome</th><th>Tipo</th><th>Valor</th><th title="Lembra de registrar ocorrência oficial">Ocorr.</th><th></th></tr></thead><tbody id="tabela-comportamentos">
                        ${r.comportamentos.map((c, i) => linhaComportamento(c, i)).join('')}
                    </tbody></table></div>
                    <div class="acoes-lista">
                        <button type="button" class="btn btn--pequeno" data-acao="nova-linha-comportamento">+ Linha</button>
                        <button type="button" class="btn btn--primary" data-acao="salvar-comportamentos">Salvar comportamentos</button>
                    </div>
                </div>
                <div class="passo">
                    <h3>⚙️ Ritmo do jogo</h3>
                    <div class="linha-campos">
                        <label>Mana por dia<input type="number" id="r-energia-dia" value="${r.energiaPorDia}" min="0" max="50"></label>
                        <label>HP por dia<input type="number" id="r-vida-dia" value="${r.vidaPorDia}" min="0" max="50"></label>
                        <label>Tamanho da guilda<input type="number" id="r-tamanho" value="${r.tamanhoGuilda}" min="2" max="10"></label>
                    </div>
                    <div class="linha-campos">
                        <label>Bônus de presença a cada<span class="com-unidade"><input type="number" id="r-pres-cada" value="${r.presenca.bonusACada}" min="0" max="30"><span>dias</span></span></label>
                        <label>XP do bônus<input type="number" id="r-pres-xp" value="${r.presenca.xp}" min="0" max="200"></label>
                        <label>Ouro do bônus<input type="number" id="r-pres-ouro" value="${r.presenca.ouro || 0}" min="0" max="100"></label>
                        <label>Respawn com<span class="com-unidade"><input type="number" id="r-volta" value="${Math.round(r.voltaDaQueda * 100)}" min="10" max="100"><span>% do HP</span></span></label>
                    </div>
                    <label class="campo-bloco">Dano em grupo <small>HP que os colegas da guilda perdem quando alguém fica K.O. (0 = desligado; o Classcraft liga, a Saga não, por padrão)</small><input type="number" id="r-solidariedade" value="${r.solidariedade}" min="0" max="30"></label>
                    <button type="button" class="btn btn--primary" data-acao="salvar-ritmo">Salvar ritmo</button>
                    <details class="avancado"><summary>Avançado: todas as regras em JSON (classes, poderes, loja, eventos, bosses, respawn)</summary>
                        <textarea id="regras-json" rows="14" spellcheck="false">${h(JSON.stringify(r, null, 2))}</textarea>
                        <div class="acoes-lista">
                            <button type="button" class="btn btn--pequeno btn--primary" data-acao="salvar-json">Salvar regras</button>
                            <button type="button" class="btn btn--pequeno" data-acao="restaurar-regras">Restaurar o padrão</button>
                        </div>
                    </details>
                </div>
                <div class="passo">
                    <h3>💾 Dados deste aparelho</h3>
                    <p class="dica">Tudo fica neste navegador e funciona sem internet. Faça backup com frequência. Para juntar o trabalho de colegas que usam a Saga em outro aparelho, importe o backup deles com <strong>Juntar</strong>: nada se perde nem duplica.</p>
                    <div class="acoes-lista">
                        <button type="button" class="btn btn--primary" data-acao="exportar">⬇️ Baixar backup</button>
                        <label class="btn">⬆️ Juntar backup<input type="file" accept=".json,application/json" data-mudar="importar" data-modo="juntar" hidden></label>
                        <label class="btn">♻️ Substituir por backup<input type="file" accept=".json,application/json" data-mudar="importar" data-modo="substituir" hidden></label>
                    </div>
                    <h3>Demonstração</h3>
                    <div class="acoes-lista">
                        <button type="button" class="btn" data-acao="demo">Carregar turma de demonstração</button>
                        <button type="button" class="btn btn--pequeno" data-acao="remover-demo">Remover demonstração</button>
                    </div>
                    <h3>Recomeçar</h3>
                    <button type="button" class="btn btn--pequeno btn--perigo" data-acao="apagar-tudo">Apagar todos os dados deste aparelho</button>
                    <p class="dica">${D.eventos.length} eventos guardados${E.ignorados.length ? ` · ${E.ignorados.length} não aplicados (ex.: chamada repetida)` : ''}.</p>
                </div>
            </section>
        </div>`;
    }

    function linhaComportamento(c, i) {
        return `<tr data-linha="${i}">
            <td><input type="text" class="input-icone" data-c="icone" value="${h(c.icone || '')}" maxlength="4" aria-label="Ícone"></td>
            <td><input type="text" data-c="nome" value="${h(c.nome)}" aria-label="Nome"><input type="hidden" data-c="id" value="${h(c.id)}"></td>
            <td><select data-c="tipo" aria-label="Tipo"><option value="positivo" ${c.tipo === 'positivo' ? 'selected' : ''}>＋ XP</option><option value="negativo" ${c.tipo === 'negativo' ? 'selected' : ''}>− HP</option></select></td>
            <td><input type="number" data-c="valor" value="${c.tipo === 'positivo' ? c.xp : c.vida}" min="1" max="200" class="input-num" aria-label="Valor"></td>
            <td><input type="checkbox" data-c="ocorrencia" ${c.ocorrencia ? 'checked' : ''} aria-label="Pede ocorrência"></td>
            <td><button type="button" class="link-ficha" data-acao="remover-linha">×</button></td>
        </tr>`;
    }

    function lerComportamentos() {
        return $$('#tabela-comportamentos tr').map((tr) => {
            const v = (c) => $(`[data-c="${c}"]`, tr);
            const nome = v('nome').value.trim();
            const tipo = v('tipo').value;
            const valor = Math.max(1, parseInt(v('valor').value, 10) || 1);
            const c = { id: v('id').value || Motor.novoId('c'), nome, tipo, icone: v('icone').value.trim() };
            if (tipo === 'positivo') c.xp = valor; else c.vida = valor;
            if (v('ocorrencia').checked) c.ocorrencia = true;
            return c;
        }).filter((c) => c.nome);
    }

    function trocarRegras(novas) {
        const erros = Regras.validar(novas);
        if (erros.length) { avisar(erros[0], 'erro'); return false; }
        D.regras = novas;
        recalcular();
        return true;
    }

    function salvarPerfil() {
        const p = Regras.copiar(D.perfil);
        p.nome = $('#p-nome').value.trim();
        p.sigla = $('#p-sigla').value.trim();
        p.municipio = $('#p-municipio').value.trim();
        p.crede = $('#p-crede').value;
        const tipoAntes = p.tipo;
        p.tipo = $('#p-tipo').value;
        p.turmas = Escola.lerTurmas($('#p-turmas').value);
        p.pdts = {};
        for (const el of $$('[data-pdt]')) if (el.value.trim()) p.pdts[el.dataset.pdt] = el.value.trim();
        p.areas = $$('[data-area-nome]').map((el) => ({ nome: el.value.trim(), pca: $(`[data-area-pca="${el.dataset.areaNome}"]`).value.trim() })).filter((a) => a.nome);
        p.moeda = { nome: $('#p-moeda').value.trim(), simbolo: $('#p-simbolo').value.trim() || '🪙' };
        p.ocorrenciasUrl = $('#p-ocorrencias').value.trim();
        const erros = Escola.validar(p);
        if (erros.length) { avisar(erros[0], 'erro'); return; }
        D.perfil = p;
        D.regras.moeda.porNivel = Math.max(0, parseInt($('#r-moeda-nivel').value, 10) || 0);
        if (tipoAntes !== p.tipo && confirm(`Trocar os comportamentos pelos sugeridos para ${p.tipo}? (Os já registrados continuam no histórico.)`)) {
            D.regras.comportamentos = Regras.comportamentosPadrao(p.tipo);
        }
        recalcular();
        avisar('Perfil salvo.');
    }

    function importar(input) {
        const arquivo = input.files && input.files[0];
        if (!arquivo) return;
        const modo = input.dataset.modo;
        arquivo.text().then((texto) => {
            const { backup, erro } = Armazem.lerBackup(texto);
            if (erro) { avisar(erro, 'erro'); return; }
            if (modo === 'substituir') {
                if (!confirm(`Substituir TUDO deste aparelho pelo backup de ${backup.professor || 'outro aparelho'} (${backup.eventos.length} eventos)?`)) return;
                D.eventos = backup.eventos;
                if (backup.perfil) D.perfil = backup.perfil;
                if (backup.regras && !Regras.validar(backup.regras).length) D.regras = backup.regras;
            } else {
                const antes = D.eventos.length;
                D.eventos = Motor.juntar(D.eventos, backup.eventos);
                avisar(`${D.eventos.length - antes} eventos novos trazidos de ${backup.professor || 'outro aparelho'}.`);
            }
            recalcular();
        }).finally(() => { input.value = ''; });
    }

    function carregarDemo() {
        if (Object.values(E.alunos).some((a) => a.turma === TURMA_DEMO && a.ativo)) {
            D.turma = TURMA_DEMO; tela.aba = 'turma'; desenhar(); return;
        }
        D.eventos = Motor.juntar(D.eventos, Demo.gerar(D.regras, TURMA_DEMO, new Date().toISOString(), D.professor));
        D.turma = TURMA_DEMO;
        tela.aba = 'turma';
        recalcular();
        avisar('Turma de demonstração carregada, com duas semanas simuladas. Os nomes são inventados.');
    }

    /* ===== desenho geral ===== */

    function desenhar() {
        desenharTopo();
        const vistas = { turma: desenharTurma, telao: desenharTelao, missoes: desenharMissoes, batalha: desenharBatalha, loja: desenharLoja, conselheiro: desenharConselheiro, cadastro: desenharCadastro, escola: desenharEscola };
        const rolagem = window.scrollY;
        $('#conteudo').innerHTML = (vistas[tela.aba] || desenharTurma)();
        window.scrollTo(0, rolagem);
        desenharSelecao();
    }

    function boasVindas() {
        abrirModal(`<h2 id="modal-titulo">⚔️ Bem-vindo(a) à Saga</h2>
            <p>O RPG da sala de aula. Os estudantes são heróis, você é o <strong>mestre do jogo</strong>. Em português, gratuito e funcionando sem internet.</p>
            <ul class="lista-simples">
                <li>🛡️🌿🔮🏹 Cada estudante escolhe uma classe — <strong>Guerreiro(a)</strong> (tanque), <strong>Curandeiro(a)</strong> (suporte), <strong>Mago(a)</strong> (mana) ou <strong>Arqueiro(a)</strong> (dano) — e entra numa guilda.</li>
                <li>⭐ Bom comportamento dá XP; XP sobe de nível; nível libera poderes e privilégios reais. 🪙 Ouro compra itens na loja.</li>
                <li>❤️ Mau comportamento tira HP, nunca XP. Quem zera fica K.O. e volta com uma missão de respawn.</li>
                <li>🐉 Revisão vira batalha contra o boss; tarefas viram quests.</li>
                <li>🦉 O Oráculo avisa quem está sumindo, tomando dano ou faltando — e escreve o resumo para o PDT.</li>
            </ul>
            <label class="campo-bloco">Seu nome de mestre do jogo (aparece nos registros)<input type="text" id="nome-professor" placeholder="ex.: Prof. Vinícius" maxlength="40" autofocus></label>
            <p class="dica">A escola já vem configurada como <strong>${h(D.perfil.nome)}</strong>. Outra escola? Troque na aba Escola.</p>
            <div class="acoes-lista">
                <button type="button" class="btn btn--primary" data-acao="salvar-professor" data-depois="demo">Entrar e ver a demonstração</button>
                <button type="button" class="btn" data-acao="salvar-professor" data-depois="cadastro">Entrar e cadastrar minha turma</button>
            </div>`);
    }

    /* ===== ações ===== */

    const ACOES = {
        'fechar-modal': fecharModal,
        ir: (el) => { tela.aba = el.dataset.aba; desenhar(); },
        'ir-turma': (el) => { D.turma = el.dataset.turma; salvarDados(); desenhar(); },
        selecionar: (el) => {
            const id = el.dataset.id;
            if (tela.selecao.has(id)) tela.selecao.delete(id); else tela.selecao.add(id);
            const cartao = el.closest('.cartao-aluno');
            cartao.classList.toggle('selecionado', tela.selecao.has(id));
            el.setAttribute('aria-pressed', tela.selecao.has(id));
            desenharSelecao();
        },
        'selecionar-todos': () => {
            const ausentes = new Set(chamadaDeHoje() || []);
            alunosTurma().filter((a) => !ausentes.has(a.id)).forEach((a) => tela.selecao.add(a.id));
            desenhar();
        },
        'selecionar-grupo': (el) => {
            const lista = el.dataset.guilda ? Motor.membros(E, el.dataset.guilda) : alunosTurma().filter((a) => !a.guilda || !E.guildas[a.guilda]);
            const todos = lista.every((a) => tela.selecao.has(a.id));
            lista.forEach((a) => (todos ? tela.selecao.delete(a.id) : tela.selecao.add(a.id)));
            desenhar();
        },
        'limpar-selecao': () => { tela.selecao.clear(); desenhar(); },
        reconhecer: modalReconhecer,
        descontar: () => modalDescontar(null),
        'escolher-desconto': (el) => modalDescontar(el.dataset.comp),
        'aplicar-comportamento': (el) => aplicarComportamento(el.dataset.comp),
        desfazer: (el) => { desfazer(el.dataset.ev); if (!$('#modal').hidden) fecharModal(); },
        ficha: (el) => modalFicha(el.dataset.id),
        'trocar-avatar': (el) => {
            emitir('aluno.editar', { alunoId: el.dataset.id, campos: { avatar: el.dataset.avatar } });
            modalFicha(el.dataset.id);
        },
        'comecar-dia': modalComecarDia,
        'confirmar-dia': () => {
            const evento = D.regras.eventos.find((e) => e.id === $('#roleta').dataset.evento);
            const ausentes = $$('input[name="ausente"]:checked').map((i) => i.value);
            const pular = $('#pular-chamada').checked;
            emitir('novoDia', { turma: turma(), evento: Regras.copiar(evento) });
            if (!pular) emitir('presenca', { turma: turma(), ausentes });
            fecharModal();
            avisar(`${evento.icone} ${evento.nome}! Mana da turma recarregada.`);
        },
        chamada: modalChamada,
        'confirmar-chamada': () => {
            emitir('presenca', { turma: turma(), ausentes: $$('input[name="ausente"]:checked').map((i) => i.value) });
            fecharModal();
            avisar('Chamada registrada.');
        },
        'desafio-cumprido': () => {
            const dia = diaDeHoje();
            const ausentes = new Set(chamadaDeHoje() || []);
            const ids = alunosTurma().filter((a) => !ausentes.has(a.id)).map((a) => a.id);
            const ev = emitir('bonus', { alunoIds: ids, xp: dia.evento.efeito.xp || 20, motivo: `Desafio cumprido: ${dia.evento.nome}` });
            avisar(`🎉 +${dia.evento.efeito.xp || 20} XP para ${ids.length} estudantes!`, null, ev.id);
        },
        'usar-poder': (el) => {
            const alvoSel = $(`#alvo-${el.dataset.poder}`);
            const alvoId = alvoSel ? alvoSel.value : undefined;
            const motivo = Motor.motivoPoder(E, D.regras, el.dataset.id, el.dataset.poder, alvoId);
            if (motivo) { avisar(motivo, 'erro'); return; }
            const ev = emitir('poder', { alunoId: el.dataset.id, poderId: el.dataset.poder, alvoId });
            modalFicha(el.dataset.id);
            avisar(`${Motor.poderDe(D.regras, el.dataset.poder).nome} usado!`, null, ev.id);
        },
        'concluir-reparacao': (el) => {
            const r = D.regras.reparacoes.find((x) => x.id === $('#reparacao-escolha').value);
            emitir('reparacao', { alunoId: el.dataset.id, reparacao: Regras.copiar(r), nota: $('#reparacao-nota').value.trim() });
            modalFicha(el.dataset.id);
            avisar('Respawn! De volta à guilda.');
        },
        'tela-cheia': () => {
            const el = $('#telao');
            if (document.fullscreenElement) document.exitFullscreen();
            else if (el && el.requestFullscreen) el.requestFullscreen().catch(() => {});
        },
        sortear,
        'reconhecer-sorteado': () => { tela.selecao = new Set([tela.sorteado]); modalReconhecer(); },
        'filtro-missoes': (el) => { tela.filtroMissoes = el.dataset.filtro; desenhar(); },
        'modelo-missao': (el) => {
            const m = MODELOS_MISSAO[+el.dataset.i];
            $('#m-titulo').value = m.titulo;
            $('#m-area').value = m.area;
            $('#m-habilidade').value = m.habilidade;
            $('#m-xp').value = m.xp;
            $('#m-moeda').value = m.moeda;
        },
        'criar-missao': () => {
            const titulo = $('#m-titulo').value.trim();
            const ts = $$('input[name="m-turma"]:checked').map((i) => i.value);
            if (!titulo) { avisar('Dê um título à quest.', 'erro'); return; }
            if (!ts.length) { avisar('Escolha ao menos uma turma.', 'erro'); return; }
            emitir('missao.nova', { missao: {
                id: Motor.novoId('m'), titulo, descricao: $('#m-descricao').value.trim(), area: $('#m-area').value,
                habilidade: $('#m-habilidade').value.trim(), xp: Math.max(0, +$('#m-xp').value || 0),
                moeda: Math.max(0, +$('#m-moeda').value || 0), prazo: $('#m-prazo').value, turmas: ts
            } });
            avisar('Quest criada.');
        },
        'concluir-missao': (el) => {
            const m = E.missoes[el.dataset.id];
            abrirModal(`<h2 id="modal-titulo">📜 ${h(m.titulo)}</h2>
                <p class="dica">Marque quem completou na ${h(turma())}. Cada um ganha ${m.xp} XP${m.moeda ? ` e ${m.moeda} ${h(moeda().simbolo)}` : ''}, uma vez só.</p>
                <button type="button" class="btn btn--pequeno" data-acao="marcar-todos">Marcar todos</button>
                <div class="lista-marcar">${alunosTurma().map((a) => `<label><input type="checkbox" name="concluiu" value="${a.id}" ${m.concluidas[a.id] ? 'checked disabled' : ''}> ${h(a.nome)}${m.concluidas[a.id] ? ` <em class="contagem">(${dataBR(m.concluidas[a.id])})</em>` : ''}</label>`).join('')}</div>
                <div class="acoes-lista"><button type="button" class="btn btn--primary" data-acao="confirmar-missao" data-id="${m.id}">Registrar</button></div>`);
        },
        'marcar-todos': () => $$('input[name="concluiu"]:not(:disabled)').forEach((i) => { i.checked = true; }),
        'confirmar-missao': (el) => {
            const ids = $$('input[name="concluiu"]:checked:not(:disabled)').map((i) => i.value);
            if (!ids.length) { fecharModal(); return; }
            const ev = emitir('missao.concluir', { missaoId: el.dataset.id, alunoIds: ids });
            fecharModal();
            avisar(`Quest completada por ${ids.length}.`, null, ev.id);
        },
        'arquivar-missao': (el) => { if (confirm('Arquivar a quest? Ela sai da lista de ativas (o XP já dado continua).')) emitir('missao.arquivar', { missaoId: el.dataset.id }); },
        'iniciar-batalha': iniciarBatalha,
        'mostrar-resposta': () => { tela.batalha.mostrar = true; desenhar(); },
        'marcar-acerto': (el) => { const g = el.dataset.grupo; tela.batalha.acertos[g] = !tela.batalha.acertos[g]; desenhar(); },
        golpear: () => {
            const b = tela.batalha;
            const golpes = b.grupos.filter((g) => b.acertos[g.id]).reduce((s, g) => s + g.golpes, 0);
            const criticos = b.grupos.some((g) => b.acertos[g.id] && g.golpes > 1);
            b.vida = Math.max(0, b.vida - golpes);
            b.indice += 1;
            b.mostrar = false;
            b.acertos = {};
            desenhar();
            if (golpes) avisar(`⚔️ ${golpes} de dano em ${b.chefe.nome}!${criticos ? ' 🏹 CRÍTICO!' : ''}`);
        },
        'encerrar-batalha': () => { tela.batalha.indice = tela.batalha.questoes.length; desenhar(); },
        'registrar-batalha': () => {
            const b = tela.batalha;
            emitir('batalha', { turma: b.turma, chefe: b.chefe, vitoria: b.vida <= 0, participantes: b.participantes });
            b.registrada = true;
            desenhar();
            avisar('Resultado registrado.');
        },
        'nova-batalha': () => { tela.batalha = null; desenhar(); },
        comprar: (el) => {
            const item = D.regras.loja.find((i) => i.id === el.dataset.item);
            const a = E.alunos[tela.comprador];
            if (!confirm(`${a.nome} compra ${item.nome} por ${item.preco} ${moeda().simbolo}?`)) return;
            const ev = emitir('compra', { alunoId: a.id, item: Regras.copiar(item) });
            const ok = !E.ignorados.some((x) => x.id === ev.id);
            avisar(ok ? `${item.icone} ${a.nome} comprou ${item.nome}!` : 'Compra não realizada.', ok ? null : 'erro', ok ? ev.id : null);
        },
        'sugerir-guildas': modalSugerirGuildas,
        'aplicar-guildas': () => {
            emitir('guildas.formar', { turma: turma(), guildas: tela.sugestao.guildas, membros: tela.sugestao.membros });
            fecharModal();
            avisar('Guildas formadas. Boa jornada!');
        },
        'copiar-resumo': () => copiarTexto($('#resumo-pdt').value),
        certificado: (el) => certificado(el.dataset.id),
        'adicionar-alunos': adicionarAlunos,
        'remover-aluno': (el) => {
            const a = E.alunos[el.dataset.id];
            if (confirm(`Remover ${a.nome} da ${a.turma}? O histórico fica guardado.`)) emitir('aluno.remover', { alunoId: a.id });
        },
        'criar-guilda': () => {
            const nome = $('#nova-guilda').value.trim();
            if (!nome) { avisar('Dê um nome à guilda.', 'erro'); return; }
            emitir('guilda.nova', { guilda: { id: Motor.novoId('j'), nome, turma: turma() } });
        },
        'remover-guilda': (el) => { if (confirm('Remover a guilda? Os membros ficam sem guilda.')) emitir('guilda.remover', { guildaId: el.dataset.id }); },
        'adicionar-questoes': () => {
            const { questoes, erros } = Questoes.lerColadas($('#q-texto').value);
            if (erros.length) avisar(erros[0], 'erro');
            if (!questoes.length) return;
            const area = $('#q-area').value;
            const habilidade = $('#q-habilidade').value.trim();
            const t0 = Date.now();
            questoes.forEach((q, i) => D.eventos.push(Motor.criarEvento('questao.nova', { questao: Object.assign({ id: Motor.novoId('q'), area, habilidade }, q) }, { autor: D.professor, agora: t0 + i })));
            recalcular();
            avisar(`${questoes.length} quest${questoes.length > 1 ? 'ões' : 'ão'} no banco.`);
        },
        'remover-questao': (el) => emitir('questao.remover', { questaoId: el.dataset.id }),
        'salvar-perfil': salvarPerfil,
        'perfil-modelo': (el) => {
            if (!confirm('Trocar o perfil da escola pelo modelo? (Estudantes e histórico continuam.)')) return;
            D.perfil = Escola.perfilPadrao(el.dataset.modelo);
            D.regras.comportamentos = Regras.comportamentosPadrao(D.perfil.tipo);
            recalcular();
        },
        'nova-linha-comportamento': () => {
            $('#tabela-comportamentos').insertAdjacentHTML('beforeend', linhaComportamento({ id: '', nome: '', tipo: 'positivo', xp: 10, icone: '⭐' }, $$('#tabela-comportamentos tr').length));
        },
        'remover-linha': (el) => el.closest('tr').remove(),
        'salvar-comportamentos': () => {
            const novas = Regras.copiar(D.regras);
            novas.comportamentos = lerComportamentos();
            if (trocarRegras(novas)) avisar('Comportamentos salvos.');
        },
        'salvar-ritmo': () => {
            const novas = Regras.copiar(D.regras);
            const n = (id, min) => Math.max(min || 0, parseInt($(id).value, 10) || 0);
            novas.energiaPorDia = n('#r-energia-dia');
            novas.vidaPorDia = n('#r-vida-dia');
            novas.tamanhoGuilda = n('#r-tamanho', 2);
            novas.presenca = { bonusACada: n('#r-pres-cada'), xp: n('#r-pres-xp'), ouro: n('#r-pres-ouro') };
            novas.voltaDaQueda = Math.min(1, n('#r-volta', 10) / 100);
            novas.solidariedade = n('#r-solidariedade');
            if (trocarRegras(novas)) avisar('Ritmo salvo. O histórico foi recalculado com as regras novas.');
        },
        'salvar-json': () => {
            let novas;
            try { novas = JSON.parse($('#regras-json').value); } catch (erro) { avisar('JSON inválido: confira vírgulas e aspas.', 'erro'); return; }
            if (trocarRegras(novas)) avisar('Regras salvas.');
        },
        'restaurar-regras': () => {
            if (confirm('Voltar todas as regras ao padrão?') && trocarRegras(Regras.regrasPadrao(D.perfil.tipo))) avisar('Regras restauradas.');
        },
        exportar: () => {
            baixar(`saga-backup-${(D.perfil.sigla || 'escola').toLowerCase()}-${hoje()}.json`, JSON.stringify(Armazem.paraBackup(D), null, 1), 'application/json');
        },
        demo: () => { fecharModal(); carregarDemo(); },
        'remover-demo': () => {
            D.eventos = D.eventos.filter((e) => !String(e.id).startsWith('demo-'));
            if (D.turma === TURMA_DEMO) D.turma = D.perfil.turmas[0];
            recalcular();
            avisar('Demonstração removida.');
        },
        'apagar-tudo': () => {
            if (!confirm('Apagar TODOS os dados da Saga neste aparelho? Baixe um backup antes.')) return;
            if (!confirm('Tem certeza? Não dá para desfazer.')) return;
            Object.assign(D, Armazem.vazio(), { perfil: Escola.perfilPadrao(), regras: Regras.regrasPadrao('EEMTI'), professor: D.professor });
            tela.batalha = null;
            recalcular();
        },
        'trocar-professor': () => boasVindas(),
        'salvar-professor': (el) => {
            const nome = $('#nome-professor').value.trim();
            if (!nome) { avisar('Escreva seu nome.', 'erro'); $('#nome-professor').focus(); return; }
            D.professor = nome;
            salvarDados();
            fecharModal();
            if (el.dataset.depois === 'demo') carregarDemo();
            else { tela.aba = 'cadastro'; desenhar(); }
        }
    };

    document.addEventListener('click', (e) => {
        const el = e.target.closest('[data-acao]');
        if (el && ACOES[el.dataset.acao]) {
            e.preventDefault();
            ACOES[el.dataset.acao](el, e);
            return;
        }
        const aba = e.target.closest('[data-aba]');
        if (aba && aba.classList.contains('aba')) {
            tela.aba = aba.dataset.aba;
            desenhar();
            window.scrollTo(0, 0);
        }
        if (e.target.id === 'modal') fecharModal();
    });

    document.addEventListener('change', (e) => {
        const el = e.target;
        if (el.id === 'turma-atual') {
            D.turma = el.value;
            tela.selecao.clear();
            tela.sorteado = null;
            salvarDados();
            desenhar();
            return;
        }
        if (el.id === 'comprador') { tela.comprador = el.value; desenhar(); return; }
        const tipo = el.dataset.mudar;
        if (tipo === 'aluno') {
            const a = E.alunos[el.dataset.id];
            const campo = el.dataset.campo;
            const valor = el.value.trim();
            if (campo === 'nome' && !valor) { el.value = a.nome; return; }
            if ((a[campo] || '') !== valor) emitir('aluno.editar', { alunoId: a.id, campos: { [campo]: valor } });
        } else if (tipo === 'guilda') {
            if (el.value.trim()) emitir('guilda.editar', { guildaId: el.dataset.id, nome: el.value.trim() });
        } else if (tipo === 'importar') {
            importar(el);
        } else if (tipo === 'sem-exemplos') {
            D.semExemplos = el.checked;
            salvarDados();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !$('#modal').hidden) fecharModal();
    });

    desenhar();
    if (!D.professor) boasVindas();

    window.SagaApp = { dados: D, estado: () => E, tela };
})();
