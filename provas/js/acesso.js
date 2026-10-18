/* Acesso ao Identificador: só entra quem tem conta ativa no Montador de
   Provas com papel de gestão. A página nasce com <html class="trancado">, que
   esconde o app; este arquivo só tira a trava depois de conferir a conta.
   A sessão usa a mesma chave do Montador: no mesmo endereço, quem já entrou
   num entra no outro. Sem internet, vale o perfil conferido da última vez. */
(function (global) {
    'use strict';

    const CONFIG = global.IDENTIFICADOR_ACESSO || {};
    const CHAVE_PERFIL = 'montador-provas:perfil';
    let cliente = null;

    function obterCliente() {
        if (cliente) return cliente;
        /* nos testes, um cliente de mentira entra no lugar do Supabase */
        if (global.IDENTIFICADOR_CLIENTE_FALSO) {
            cliente = global.IDENTIFICADOR_CLIENTE_FALSO;
        } else if (global.supabase && CONFIG.url) {
            cliente = global.supabase.createClient(CONFIG.url, CONFIG.chave, {
                auth: { persistSession: true, autoRefreshToken: true, storageKey: 'montador-provas-sessao' }
            });
        }
        return cliente;
    }

    function semRede(erro) {
        return !!erro && /Failed to fetch|NetworkError|network|Load failed|fetch/i.test(erro.message || String(erro));
    }

    function guardarPerfil(p) { try { localStorage.setItem(CHAVE_PERFIL, JSON.stringify(p)); } catch (e) { /* segue */ } }
    function lerPerfil(id) {
        try { const p = JSON.parse(localStorage.getItem(CHAVE_PERFIL) || 'null'); return p && p.id === id ? p : null; } catch (e) { return null; }
    }

    function autorizado(perfil) {
        return !!perfil && perfil.ativo !== false && (CONFIG.papeis || ['gestao']).indexOf(perfil.papel) !== -1;
    }

    async function perfilDaSessao() {
        const c = obterCliente();
        if (!c) return null;
        const { data } = await c.auth.getSession();
        const usuario = data && data.session && data.session.user;
        if (!usuario) return null;
        try {
            const r = await c.from('montador_perfis').select('*').eq('id', usuario.id).maybeSingle();
            if (r.error) throw r.error;
            const perfil = r.data && r.data.ativo ? r.data : null;
            if (perfil) guardarPerfil(perfil);
            return perfil ? Object.assign({ email: usuario.email }, perfil) : null;
        } catch (erro) {
            const guardado = semRede(erro) ? lerPerfil(usuario.id) : null;
            return guardado ? Object.assign({ email: usuario.email }, guardado) : null;
        }
    }

    function mensagemErro(erro) {
        const texto = (erro && (erro.message || String(erro))) || '';
        if (/invalid login credentials/i.test(texto)) return 'E-mail ou senha incorretos.';
        if (/email not confirmed/i.test(texto)) return 'Este e-mail ainda não foi confirmado.';
        if (semRede(erro)) return 'Sem conexão com a internet. Tente de novo quando a rede voltar.';
        return 'Não foi possível entrar agora. Tente de novo.';
    }

    const $ = (id) => document.getElementById(id);

    function liberar(perfil) {
        const nome = perfil.nome || perfil.email || '';
        $('conta-nome').textContent = nome;
        $('conta-identificador').hidden = false;
        document.documentElement.classList.remove('trancado');
    }

    function trancar(aviso) {
        $('conta-identificador').hidden = true;
        document.documentElement.classList.add('trancado');
        $('acesso-erro').textContent = aviso || '';
        $('acesso-erro').hidden = !aviso;
        $('acesso-carregando').hidden = true;
        $('acesso-form').hidden = false;
    }

    async function entrar(evento) {
        evento.preventDefault();
        const c = obterCliente();
        const botao = $('acesso-entrar');
        if (!c) { trancar('O login não carregou. Confira a internet e recarregue a página.'); return; }
        botao.disabled = true;
        botao.textContent = 'Entrando…';
        try {
            const email = $('acesso-email').value.trim().toLowerCase();
            const { error } = await c.auth.signInWithPassword({ email: email, password: $('acesso-senha').value });
            if (error) throw error;
            const perfil = await perfilDaSessao();
            if (!autorizado(perfil)) {
                await c.auth.signOut();
                trancar('Esta conta não tem acesso ao Identificador de Provas. O acesso é só da gestão.');
                return;
            }
            $('acesso-senha').value = '';
            liberar(perfil);
        } catch (erro) {
            trancar(mensagemErro(erro));
        } finally {
            botao.disabled = false;
            botao.textContent = 'Entrar';
        }
    }

    async function sair() {
        const c = obterCliente();
        try { if (c) await c.auth.signOut(); } catch (e) { /* segue */ }
        try { localStorage.removeItem(CHAVE_PERFIL); } catch (e) { /* segue */ }
        trancar('');
    }

    async function iniciar() {
        $('acesso-form').addEventListener('submit', entrar);
        $('conta-sair').addEventListener('click', sair);
        if (!obterCliente()) { trancar('O login não carregou. Confira a internet e recarregue a página.'); return; }
        try {
            const perfil = await perfilDaSessao();
            if (autorizado(perfil)) liberar(perfil);
            else trancar(perfil ? 'Esta conta não tem acesso ao Identificador de Provas. O acesso é só da gestão.' : '');
        } catch (erro) {
            trancar('');
        }
    }

    global.IdentificadorAcesso = { autorizado: autorizado };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
    else iniciar();
})(typeof window !== 'undefined' ? window : globalThis);
