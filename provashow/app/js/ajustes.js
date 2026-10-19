/* Início e Mais (conta, ajustes, instalar, cópia de segurança). Os dados
   entre os aparelhos do professor vão pela nuvem da escola (conta.js). */
(function () {
    'use strict';
    const { esc } = PS;

    /* ----- início ----- */
    PS.telas.inicio = function () {
        const turmas = Dados.ativos(PS.d.turmas).filter((t) => !t.arquivada);
        const recentes = Dados.ativos(PS.d.conjuntos).sort((a, b) => (b.alterado || '').localeCompare(a.alterado || '')).slice(0, 5);
        const aulas = PS.d.aulas.slice().sort((a, b) => b.inicio.localeCompare(a.inicio)).slice(0, 4);
        const aula = PS.aulaViva;
        PS.$('#conteudo').innerHTML = `
            ${aula ? `<a class="faixa-ao-vivo" href="#aula">● Aula ao vivo em andamento — ${esc((PS.turma(aula.turmaId) || {}).nome || '')} · código ${aula.codigo} <strong>Voltar à aula →</strong></a>` : ''}
            <div class="cabeca"><div><h1>Olá, professor(a)!</h1><p class="sub">Prepare as perguntas, escolha a turma e leia a sala inteira com o celular.</p></div>
            <div class="botoes"><button class="btn btn-principal" data-acao="novo-conjunto-inicio">+ Novo conjunto</button></div></div>
            <h2 class="titulo-secao">Suas turmas</h2>
            <div class="grade-cartoes">${turmas.map((t) => {
                const prox = t.fila.map(PS.conjunto).find((c) => c && !c.removido);
                return `<section class="cartao-painel item-turma" style="--cor:${t.cor}">
                    <a href="#turma/${t.id}"><h3>${esc(t.nome)}</h3></a>
                    <p>${PS.plural(PS.alunosAtivos(t).length, 'aluno')}</p>
                    ${prox ? `<button class="btn btn-verde btn-p" data-acao="comecar-aula" data-turma="${t.id}" data-conjunto="${prox.id}">▶ ${esc(prox.titulo)}</button>` : `<a class="btn btn-p" href="#turma/${t.id}/fila">Pôr algo na fila</a>`}
                </section>`;
            }).join('')}<button class="cartao-painel item-novo" data-acao="nova-turma">+ Nova turma</button></div>
            <div class="duas-colunas">
                <section><h2 class="titulo-secao">Editados recentemente</h2><div class="lista-itens">${recentes.map((c) => `<a class="linha-item linha-principal" href="#conjunto/${c.id}"><span class="icone-item conjunto-icone">${c.questoes.length}</span><span class="linha-texto"><strong>${esc(c.titulo)}</strong><small>${PS.dataCurta(c.alterado)}</small></span></a>`).join('') || '<p class="vazio">—</p>'}</div></section>
                <section><h2 class="titulo-secao">Últimas aulas</h2><div class="lista-itens">${aulas.map((a) => `<a class="linha-item linha-principal" href="#relatorio-aula/${a.id}"><span class="icone-item">📊</span><span class="linha-texto"><strong>${esc(a.titulo)}</strong><small>${esc((PS.turma(a.turmaId) || {}).nome || '')} · ${PS.dataCurta(a.inicio)}</small></span></a>`).join('') || '<p class="vazio">Nenhuma aula ainda.</p>'}</div></section>
            </div>
            <div class="atalhos-inicio">
                <a class="cartao-painel" href="../cartoes/" target="_blank" rel="noopener"><span>🖨</span><strong>Imprimir cartões</strong><small>63 cartões, 4 modelos</small></a>
                <a class="cartao-painel" href="#explorar"><span>🌐</span><strong>Explorar</strong><small>pacotes prontos</small></a>
                <a class="cartao-painel" href="#mais"><span>☁</span><strong>Nuvem da escola</strong><small>tudo salvo, em qualquer aparelho</small></a>
                <a class="cartao-painel" href="#mais"><span>📲</span><strong>Instalar no celular</strong><small>usa sem internet</small></a>
            </div>`;
    };
    PS.acoes['novo-conjunto-inicio'] = () => { const c = PS.novoConjunto(null); PS.ir('conjunto/' + c.id); };

    /* ----- mais / ajustes ----- */
    let pedidoInstalar = null;
    window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); pedidoInstalar = e; });

    PS.telas.mais = PS.telas.ajustes = async function () {
        const cfg = PS.d.config;
        const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
        const instalado = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
        PS.$('#conteudo').innerHTML = `
            <div class="cabeca"><h1>Mais</h1></div>
            <div class="duas-colunas">
                ${PS.htmlConta()}
                <section class="cartao-painel">
                    <h2>📲 Usar no celular</h2>
                    <p class="sub">O ProvaShow inteiro funciona no celular do professor: crie perguntas, abra a aula ao vivo e leia os cartões com a câmera do próprio aparelho. O telão (no computador do projetor) recebe tudo pelo código da aula.</p>
                    ${instalado ? '<p class="selo selo-verde">✓ Instalado neste aparelho</p>' :
                        ios ? '<p>No iPhone/iPad: toque em <strong>Compartilhar</strong> (□↑) e depois em <strong>Adicionar à Tela de Início</strong>.</p>' :
                        `<button class="btn btn-principal" data-acao="instalar" ${pedidoInstalar ? '' : 'disabled'}>Instalar o app neste aparelho</button>
                        <p class="sub">${pedidoInstalar ? '' : 'Se o botão estiver apagado, use o menu do navegador → “Instalar app” ou “Adicionar à tela inicial”.'}</p>`}
                    <p class="sub">Depois de aberto uma vez com internet, o app abre e funciona sem internet (a aula com telão em outro aparelho precisa de internet).</p>
                    <p class="sub">Com login, os mesmos dados aparecem em qualquer aparelho em que você entrar: é só entrar com a sua conta.</p>
                </section>
                <section class="cartao-painel">
                    <h2>⚙ Padrões da aula</h2>
                    <label for="cfg-lista">Lista de alunos no telão</label>
                    <select id="cfg-lista"><option value="leitura">Só durante a leitura</option><option value="sempre">Sempre</option><option value="nunca">Nunca</option></select>
                    <label class="interruptor"><input type="checkbox" id="cfg-esconder" ${cfg.telao.esconderRespostas ? 'checked' : ''}> Esconder respostas individuais no telão</label>
                    <label for="cfg-cron">Cronômetro</label>
                    <select id="cfg-cron"><option value="livre">Cronômetro (conta para cima)</option>${[15, 30, 45, 60, 90, 120, 180, 300].map((s) => `<option value="${s}">Contagem regressiva de ${Midia.tempo(s)}</option>`).join('')}</select>
                    <label class="interruptor"><input type="checkbox" id="cfg-travar" ${cfg.cronometro.travarAoZerar ? 'checked' : ''}> Encerrar respostas quando a contagem zerar</label>
                    <label class="interruptor"><input type="checkbox" id="cfg-som" ${cfg.leitura.som ? 'checked' : ''}> Bipe a cada cartão lido</label>
                </section>
                <section class="cartao-painel">
                    <h2>💾 Cópia de segurança</h2>
                    <p class="sub">Tudo fica guardado na nuvem da escola (e uma cópia neste aparelho, para funcionar sem internet). Os relatórios nunca são apagados de verdade: há histórico de cada mudança. Se quiser, baixe também uma cópia para guardar.</p>
                    <div class="botoes"><button class="btn" data-acao="exportar-backup">⬇ Baixar cópia</button><button class="btn" data-acao="importar-backup">⬆ Restaurar cópia</button></div>
                    <p class="sub" id="uso-armazenamento"></p>
                </section>
                <section class="cartao-painel">
                    <h2>Ajuda</h2>
                    <p><a href="../ajuda/" target="_blank" rel="noopener">Central de ajuda do ProvaShow</a> · <a href="../" target="_blank" rel="noopener">Site</a> · <a href="../cartoes/" target="_blank" rel="noopener">Cartões</a></p>
                    <h3 class="margem">Zona de perigo</h3>
                    <button class="btn btn-perigo" data-acao="recomecar">Apagar tudo deste aparelho</button>
                </section>
            </div>`;
        PS.$('#cfg-lista').value = cfg.telao.lista;
        PS.$('#cfg-cron').value = cfg.cronometro.modo === 'livre' ? 'livre' : String(cfg.cronometro.segundos);
        const salvarCfg = () => {
            cfg.telao.lista = PS.$('#cfg-lista').value;
            cfg.telao.esconderRespostas = PS.$('#cfg-esconder').checked;
            const v = PS.$('#cfg-cron').value;
            cfg.cronometro.modo = v === 'livre' ? 'livre' : 'regressivo';
            if (v !== 'livre') cfg.cronometro.segundos = +v;
            cfg.cronometro.travarAoZerar = PS.$('#cfg-travar').checked;
            cfg.leitura.som = PS.$('#cfg-som').checked;
            PS.salvar();
            PS.avisar('Ajustes salvos.');
        };
        PS.$$('#conteudo select, #conteudo input[type=checkbox]').forEach((x) => { x.onchange = salvarCfg; });
        if (navigator.storage && navigator.storage.estimate) {
            const e = await navigator.storage.estimate();
            const el = PS.$('#uso-armazenamento');
            if (el) el.textContent = `Usando ${(e.usage / 1048576).toFixed(1)} MB deste aparelho.`;
        }
    };

    Object.assign(PS.acoes, {
        'instalar': async () => { if (!pedidoInstalar) return; pedidoInstalar.prompt(); await pedidoInstalar.userChoice; pedidoInstalar = null; PS.desenhar(); },
        'exportar-backup': () => PS.baixar(`provashow-malu-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(PS.d), 'application/json'),
        'importar-backup': async () => {
            const arquivo = await PS.escolherArquivo('application/json,.json');
            if (!arquivo) return;
            try {
                const novo = JSON.parse(await arquivo.text());
                if (!novo || !Array.isArray(novo.conjuntos) || !Array.isArray(novo.turmas)) throw new Error('formato');
                PS.dialogo('<h2>Restaurar a cópia de segurança</h2><p class="sub">Juntar com o que já está aqui (vence a alteração mais nova) ou substituir tudo?</p><label class="interruptor"><input type="checkbox" id="substituir"> Substituir tudo (apaga o que está neste aparelho)</label>', (dlg) => {
                    if (dlg.querySelector('#substituir').checked) PS.d = Dados.migrar(novo);
                    else Dados.mesclar(PS.d, novo);
                    PS.salvar(true); PS.desenhar(); PS.avisar('Cópia de segurança restaurada.');
                }, { confirmar: 'Restaurar' });
            } catch (erro) { PS.avisar('Esse arquivo não é uma cópia de segurança do ProvaShow.'); }
        },
        'recomecar': () => PS.confirmar('Apagar todas as turmas, perguntas e relatórios deste aparelho?', () => {
            PS.d = Dados.exemplo(); PS.salvar(true); PS.ir('inicio');
        }, 'Apaga a cópia deste aparelho. O que já está na nuvem da escola volta na próxima sincronização.')
    });


})();
