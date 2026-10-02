/* As provas do professor, guardadas neste navegador (IndexedDB, que aguenta
   as imagens das questões). Nada vai para servidor. Para levar a prova a
   outro computador ou entregar à coordenação, o app exporta um arquivo .json
   que se importa do outro lado. Se o navegador não deixar guardar (janela
   anônima de alguns navegadores), as provas vivem só enquanto a aba estiver
   aberta — e o app avisa. */
(function (global) {
    'use strict';

    const BANCO = 'montador-provas-malu';
    const LOJA = 'provas';

    let bancoPromessa = null;
    let memoria = null;

    function abrir() {
        if (!bancoPromessa) {
            bancoPromessa = new Promise(function (resolve, reject) {
                if (!global.indexedDB) { reject(new Error('sem IndexedDB')); return; }
                const pedido = global.indexedDB.open(BANCO, 1);
                pedido.onupgradeneeded = function () {
                    pedido.result.createObjectStore(LOJA, { keyPath: 'id' });
                };
                pedido.onsuccess = function () { resolve(pedido.result); };
                pedido.onerror = function () { reject(pedido.error); };
            });
            bancoPromessa.catch(function () { memoria = memoria || new Map(); });
        }
        return bancoPromessa;
    }

    function transacao(modo, trabalho) {
        return abrir().then(function (banco) {
            return new Promise(function (resolve, reject) {
                const tx = banco.transaction(LOJA, modo);
                let resultado;
                tx.oncomplete = function () { resolve(resultado); };
                tx.onerror = function () { reject(tx.error); };
                tx.onabort = function () { reject(tx.error || new Error('Gravação cancelada.')); };
                const pedido = trabalho(tx.objectStore(LOJA));
                if (pedido instanceof IDBRequest) pedido.onsuccess = function () { resultado = pedido.result; };
            });
        });
    }

    function emMemoria() { return memoria || (memoria = new Map()); }

    function listar() {
        return transacao('readonly', function (loja) { return loja.getAll(); })
            .catch(function () { return Array.from(emMemoria().values()); })
            .then(function (itens) {
                return (itens || []).sort(function (a, b) { return b.atualizadaEm - a.atualizadaEm; });
            });
    }

    function obter(id) {
        return transacao('readonly', function (loja) { return loja.get(id); })
            .catch(function () { return emMemoria().get(id); });
    }

    function salvar(prova) {
        prova.atualizadaEm = Date.now();
        const copia = JSON.parse(JSON.stringify(prova));
        return transacao('readwrite', function (loja) { loja.put(copia); })
            .catch(function () { emMemoria().set(copia.id, copia); });
    }

    function apagar(id) {
        return transacao('readwrite', function (loja) { loja.delete(id); })
            .catch(function () { emMemoria().delete(id); });
    }

    function persistente() {
        return abrir().then(function () { return true; }, function () { return false; });
    }

    const api = { listar: listar, obter: obter, salvar: salvar, apagar: apagar, persistente: persistente };
    global.MontarArmazem = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
