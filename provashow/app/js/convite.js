/* Convite por link: a página que o professor abre pelo WhatsApp.

   #cadastro/TOKEN  professor NOVO: vê o próprio nome, escolhe o e-mail
                    (que vira o login) e a senha. A conta nasce na hora.
   #senha/TOKEN     quem JÁ tem conta: cria uma senha nova (o e-mail fica).

   Abre antes do login (conta.js chama PS.telaConvite). Depois de aceitar,
   o app já entra com a conta nova, sem pedir a senha de novo. */
(function () {
    'use strict';
    const { esc } = PS;

    PS.primeiroNome = (nome) => String(nome || '').trim().split(/\s+/)[0] || '';

    PS.rotaConvite = function () {
        const m = location.hash.match(/^#(cadastro|senha)\/([A-Za-z0-9_-]{20,200})$/);
        return m ? { tipo: m[1], token: m[2] } : null;
    };

    /* link aberto com o app já rodando: recarrega para a tela do convite vir antes de tudo */
    PS.telas.cadastro = PS.telas.senha = () => location.reload();

    /* o endereço do convite, a partir de onde o app está aberto */
    PS.linkConvite = (tipo, token) => location.origin + location.pathname + '#' + tipo + '/' + encodeURIComponent(token);

    PS.telaConvite = function (rota) {
        const tela = PS.$('#tela-convite');
        const caixa = tela.querySelector('.login-caixa');
        document.body.classList.add('sem-login');
        PS.$('#tela-login').hidden = true;
        tela.hidden = false;
        const topo = `<img class="login-escola" src="../escola.png" alt="EEMTI Prof. Maria Luiza Saboia Ribeiro">
            <div class="marca"><span class="marca-icone" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span>ProvaShow <small>Malu</small></span></div>`;
        caixa.innerHTML = topo + '<p class="sub">Abrindo o seu convite…</p>';

        return new Promise(async (ok) => {
            const fechar = (resultado) => { tela.hidden = true; ok(resultado); };
            const novo = rota.tipo === 'cadastro';
            let info;
            try {
                info = novo ? await Nuvem.convites.ver(rota.token) : await Nuvem.convites.senhaVer(rota.token);
            } catch (erro) {
                caixa.innerHTML = topo + `<h1 class="convite-titulo">Convite indisponível</h1>
                    <p class="convite-erro" role="alert">${esc(erro.message)}</p>
                    <button class="btn btn-principal" type="button" id="convite-login">Ir para o login</button>`;
                caixa.querySelector('#convite-login').onclick = () => fechar(null);
                return;
            }
            const nome = PS.primeiroNome(info.nome);
            caixa.innerHTML = topo + `
                <h1 class="convite-titulo">Olá, ${esc(nome)}! 👋</h1>
                <p class="sub">${novo
                    ? 'Você foi convidado(a) para o <strong>ProvaShow Malu</strong>. Crie o seu acesso: o e-mail vira o seu login.'
                    : `Crie uma senha nova para entrar no <strong>ProvaShow Malu</strong>. O seu login continua sendo <strong>${esc(info.email)}</strong>.`}</p>
                <form id="form-convite-aceitar" autocomplete="on">
                    ${novo ? `<label for="cv-email">Seu e-mail</label>
                        <input type="email" id="cv-email" autocomplete="username" inputmode="email" placeholder="nome@exemplo.com" required>`
                        : `<input type="email" id="cv-email" autocomplete="username" value="${esc(info.email)}" hidden readonly>`}
                    <label for="cv-senha">Crie uma senha (pelo menos 8 caracteres)</label>
                    <input type="password" id="cv-senha" autocomplete="new-password" minlength="8" required>
                    <label for="cv-senha2">Repita a senha</label>
                    <input type="password" id="cv-senha2" autocomplete="new-password" minlength="8" required>
                    <label class="interruptor"><input type="checkbox" id="cv-mostrar"> Mostrar a senha</label>
                    <button class="btn btn-principal" type="submit">${novo ? 'Criar minha conta' : 'Salvar senha e entrar'}</button>
                    <p class="login-mensagem" id="cv-msg" role="alert"></p>
                </form>
                <p class="sub">O link vale até ${esc(PS.dataCurta(info.expiraEm))} e só pode ser usado uma vez.</p>`;

            const form = caixa.querySelector('#form-convite-aceitar');
            const msg = caixa.querySelector('#cv-msg');
            caixa.querySelector('#cv-mostrar').onchange = (e) => {
                caixa.querySelectorAll('#cv-senha, #cv-senha2').forEach((x) => { x.type = e.target.checked ? 'text' : 'password'; });
            };
            setTimeout(() => caixa.querySelector(novo ? '#cv-email' : '#cv-senha').focus(), 50);

            form.onsubmit = async (e) => {
                e.preventDefault();
                const email = caixa.querySelector('#cv-email').value.trim().toLowerCase();
                const senha = caixa.querySelector('#cv-senha').value;
                if (novo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { msg.textContent = 'Confira o e-mail.'; return; }
                if (senha.length < 8) { msg.textContent = 'A senha precisa ter pelo menos 8 caracteres.'; return; }
                if (senha !== caixa.querySelector('#cv-senha2').value) { msg.textContent = 'As duas senhas não são iguais.'; return; }
                const botao = form.querySelector('button[type=submit]');
                botao.disabled = true;
                msg.textContent = novo ? 'Criando a sua conta…' : 'Salvando…';
                let r;
                try {
                    r = novo ? await Nuvem.convites.aceitar(rota.token, email, senha) : await Nuvem.convites.senhaAceitar(rota.token, senha);
                } catch (erro) {
                    msg.textContent = erro.message;
                    botao.disabled = false;
                    return;
                }
                msg.textContent = 'Entrando…';
                PS.boasVindas = novo ? `Conta criada! Bem-vindo(a), ${nome}.` : 'Senha salva. Bom trabalho!';
                try {
                    fechar(await Nuvem.entrar(r.email || email, senha, true));
                } catch (erro) {
                    /* a conta já existe: segue para a tela de login normal */
                    PS.boasVindas = '';
                    fechar(null);
                }
            };
        });
    };
})();
