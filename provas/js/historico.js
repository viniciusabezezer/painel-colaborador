/* Os últimos arquivos gerados, guardados neste navegador (IndexedDB).
   Nada vai para servidor: fica só neste aparelho, neste navegador, até sair do
   limite (os mais antigos dão lugar aos novos) ou alguém apagar. */
(function (global) {
    'use strict';

    const LIMITE = 60;
    const BANCO = 'identificador-provas-malu';
    const LOJA = 'arquivos';

    let bancoPromessa = null;
    function abrir() {
        if (!bancoPromessa) {
            bancoPromessa = new Promise(function (resolve, reject) {
                if (!global.indexedDB) { reject(new Error('Este navegador não guarda arquivos.')); return; }
                const pedido = global.indexedDB.open(BANCO, 1);
                pedido.onupgradeneeded = function () {
                    const loja = pedido.result.createObjectStore(LOJA, { keyPath: 'id', autoIncrement: true });
                    loja.createIndex('criadoEm', 'criadoEm');
                };
                pedido.onsuccess = function () { resolve(pedido.result); };
                pedido.onerror = function () { reject(pedido.error); };
            });
            bancoPromessa.catch(function () { bancoPromessa = null; });
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
                if (pedido instanceof IDBRequest) {
                    pedido.onsuccess = function () { resultado = pedido.result; };
                }
            });
        });
    }

    /* Do mais novo para o mais antigo, sem os bytes (a lista fica leve). */
    function listar() {
        return transacao('readonly', function (loja) { return loja.getAll(); }).then(function (itens) {
            return (itens || []).map(function (item) {
                return { id: item.id, nome: item.nome, rotulo: item.rotulo, titulo: item.titulo,
                    tipo: item.tipo, tamanho: item.tamanho, criadoEm: item.criadoEm };
            }).sort(function (a, b) { return b.criadoEm - a.criadoEm || b.id - a.id; });
        });
    }

    function obter(id) {
        return transacao('readonly', function (loja) { return loja.get(id); });
    }

    function apagar(id) {
        return transacao('readwrite', function (loja) { loja.delete(id); });
    }

    function apagarTudo() {
        return transacao('readwrite', function (loja) { loja.clear(); });
    }

    /* Tira os mais antigos até sobrarem `manter`. */
    function podar(manter) {
        return listar().then(function (itens) {
            const sobra = itens.slice(manter);
            if (!sobra.length) return 0;
            return transacao('readwrite', function (loja) {
                sobra.forEach(function (item) { loja.delete(item.id); });
            }).then(function () { return sobra.length; });
        });
    }

    function gravarUm(arquivo, titulo) {
        const bytes = arquivo.bytes instanceof Blob ? arquivo.bytes : new Blob([arquivo.bytes], { type: arquivo.tipo });
        return transacao('readwrite', function (loja) {
            loja.add({
                nome: arquivo.nome, rotulo: arquivo.rotulo, titulo: titulo, tipo: arquivo.tipo,
                tamanho: bytes.size, criadoEm: Date.now(), bytes: bytes
            });
        });
    }

    function ehFaltaDeEspaco(erro) {
        return erro && (erro.name === 'QuotaExceededError' || /quota/i.test(erro.message || ''));
    }

    /* Guarda os arquivos de um conjunto e mantém só os LIMITE mais novos.
       Se o navegador reclamar de espaço, abre caminho tirando os mais antigos
       e tenta de novo; se nem assim couber, desiste sem travar a geração. */
    async function guardar(arquivos, titulo) {
        for (const arquivo of arquivos) {
            try {
                await gravarUm(arquivo, titulo);
            } catch (erro) {
                if (!ehFaltaDeEspaco(erro)) throw erro;
                const itens = await listar();
                if (!itens.length) throw erro;
                await podar(Math.floor(itens.length / 2));
                await gravarUm(arquivo, titulo);
            }
        }
        return podar(LIMITE);
    }

    const api = { LIMITE: LIMITE, listar: listar, obter: obter, guardar: guardar, apagar: apagar, apagarTudo: apagarTudo };
    global.ProvasHistorico = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
