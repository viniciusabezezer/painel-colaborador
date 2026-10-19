/* A cópia dos dados no aparelho: IndexedDB (cabe muito mais que o
   localStorage — imagens, áudios e gifs das perguntas). Sem IndexedDB
   (navegação privada antiga), cai no localStorage. Avisa as outras abas e
   janelas do mesmo aparelho quando algo muda.

   Cada conta tem a sua cópia (chave "conta:<id>"), para dois professores
   poderem usar o mesmo computador sem misturar nada. A cópia sem conta, da
   época antes do login, continua em "principal" até o professor trazê-la
   para a conta. A cópia do aparelho é só um espelho: o original fica na
   nuvem da escola (Nuvem). */
(function (global) {
    'use strict';

    const BANCO = 'provashow-malu';
    const LOJA = 'dados';
    const SEM_CONTA = 'principal';
    const CHAVE_V1 = 'provashow-malu-v1';
    const aviso = typeof global.BroadcastChannel === 'function' ? new global.BroadcastChannel('provashow-dados') : null;
    const eu = Math.random().toString(36).slice(2);
    let chave = SEM_CONTA;

    function abrir() {
        return new Promise((ok, falha) => {
            if (!global.indexedDB) { falha(new Error('sem IndexedDB')); return; }
            const pedido = global.indexedDB.open(BANCO, 1);
            pedido.onupgradeneeded = () => pedido.result.createObjectStore(LOJA);
            pedido.onsuccess = () => ok(pedido.result);
            pedido.onerror = () => falha(pedido.error);
        });
    }

    let banco = null;
    async function loja(modo) {
        if (!banco) banco = await abrir();
        return banco.transaction(LOJA, modo).objectStore(LOJA);
    }

    function pedir(p) {
        return new Promise((ok, falha) => { p.onsuccess = () => ok(p.result); p.onerror = () => falha(p.error); });
    }

    async function ler(k) {
        try { return await pedir((await loja('readonly')).get(k)); } catch (erro) {
            try { return JSON.parse(global.localStorage.getItem('provashow-' + k) || 'null'); } catch (e) { return null; }
        }
    }

    async function gravar(k, valor) {
        try { await pedir((await loja('readwrite')).put(valor, k)); } catch (erro) {
            global.localStorage.setItem('provashow-' + k, JSON.stringify(valor));
        }
    }

    async function apagar(k) {
        try { await pedir((await loja('readwrite')).delete(k)); } catch (erro) { /* nada */ }
        try { global.localStorage.removeItem('provashow-' + k); } catch (e) { /* nada */ }
    }

    /* Qual cópia usar: a da conta (id do usuário) ou a sem conta. */
    function usar(idConta) { chave = idConta ? 'conta:' + idConta : SEM_CONTA; }

    async function carregar() {
        let d = await ler(chave);
        if (!d && chave === SEM_CONTA) {
            try { d = JSON.parse(global.localStorage.getItem(CHAVE_V1) || 'null'); } catch (e) { d = null; }
            if (!d) return global.Dados.exemplo();
        }
        return d ? global.Dados.migrar(d) : global.Dados.vazio();
    }

    async function salvar(d) {
        await gravar(chave, d);
        if (aviso) aviso.postMessage({ de: eu, chave, quando: Date.now() });
        return true;
    }

    /* A cópia de antes do login, se houver algo nela que valha trazer. */
    async function copiaSemConta() {
        let d = await ler(SEM_CONTA);
        if (!d) { try { d = JSON.parse(global.localStorage.getItem(CHAVE_V1) || 'null'); } catch (e) { d = null; } }
        if (!d) return null;
        d = global.Dados.migrar(d);
        const temAlgo = d.sessoes.length || d.turmas.some((t) => t.nome !== 'Turma de exemplo') || d.conjuntos.some((c) => !c.titulo.startsWith('Exemplo'));
        return temAlgo ? d : null;
    }

    async function esquecerCopiaSemConta() {
        await apagar(SEM_CONTA);
        try { global.localStorage.removeItem(CHAVE_V1); } catch (e) { /* nada */ }
    }

    /* Estado da sincronização da conta atual. */
    const lerSinc = () => ler('sinc:' + chave);
    const gravarSinc = (e) => gravar('sinc:' + chave, e);

    /* Sair num computador compartilhado: apaga a cópia da conta neste aparelho. */
    async function apagarCopiaDaConta() {
        await apagar(chave);
        await apagar('sinc:' + chave);
    }

    function aoMudarFora(f) {
        if (aviso) aviso.addEventListener('message', (e) => { if (e.data && e.data.de !== eu && e.data.chave === chave) f(); });
    }

    const Armazem = { usar, carregar, salvar, aoMudarFora, copiaSemConta, esquecerCopiaSemConta, lerSinc, gravarSinc, apagarCopiaDaConta };
    global.Armazem = Armazem;
})(typeof self !== 'undefined' ? self : this);
