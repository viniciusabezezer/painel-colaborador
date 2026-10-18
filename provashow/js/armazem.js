/* Onde os dados do ProvaShow moram no aparelho: IndexedDB (cabe muito mais
   que o localStorage — imagens, áudios e gifs das perguntas). Sem IndexedDB
   (navegação privada antiga), cai no localStorage. Avisa as outras abas e
   janelas do mesmo aparelho quando algo muda. */
(function (global) {
    'use strict';

    const BANCO = 'provashow-malu';
    const LOJA = 'dados';
    const CHAVE = 'principal';
    const CHAVE_V1 = 'provashow-malu-v1';
    const CHAVE_LOCAL = 'provashow-malu-v2';
    const aviso = typeof global.BroadcastChannel === 'function' ? new global.BroadcastChannel('provashow-dados') : null;
    const eu = Math.random().toString(36).slice(2);

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

    async function carregar() {
        let d = null;
        try {
            d = await pedir((await loja('readonly')).get(CHAVE));
        } catch (erro) {
            try { d = JSON.parse(global.localStorage.getItem(CHAVE_LOCAL) || 'null'); } catch (e) { d = null; }
        }
        if (!d) {
            /* dados da primeira versão (localStorage) */
            try { d = JSON.parse(global.localStorage.getItem(CHAVE_V1) || 'null'); } catch (e) { d = null; }
        }
        return d ? global.Dados.migrar(d) : global.Dados.exemplo();
    }

    async function salvar(d) {
        try {
            await pedir((await loja('readwrite')).put(d, CHAVE));
        } catch (erro) {
            global.localStorage.setItem(CHAVE_LOCAL, JSON.stringify(d));
        }
        if (aviso) aviso.postMessage({ de: eu, quando: Date.now() });
        return true;
    }

    function aoMudarFora(f) {
        if (aviso) aviso.addEventListener('message', (e) => { if (e.data && e.data.de !== eu) f(); });
    }

    const Armazem = { carregar, salvar, aoMudarFora };
    global.Armazem = Armazem;
})(typeof self !== 'undefined' ? self : this);
