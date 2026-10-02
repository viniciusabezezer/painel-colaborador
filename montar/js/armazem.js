/* As provas do professor e os últimos arquivos gerados, guardados neste
   navegador (IndexedDB, que aguenta as imagens). Nada vai para servidor, e
   tudo funciona sem internet.

   - provas: o que está sendo montado; salva sozinho a cada alteração.
   - arquivos: cada vez que uma prova é impressa ou salva em PDF, uma cópia
     dela naquele momento fica guardada (os 40 últimos). Se alguém mexer na
     prova depois, a versão que foi para a gráfica continua aqui.

   O app pede ao navegador armazenamento persistente, para ele não apagar
   nada sozinho quando o disco aperta. Para levar a prova a outro computador,
   o app exporta um arquivo .json que se importa do outro lado. Se o navegador
   não deixar guardar (janela anônima de alguns navegadores), as provas vivem
   só enquanto a aba estiver aberta — e o app avisa. */
(function (global) {
    'use strict';

    const BANCO = 'montador-provas-malu';
    const PROVAS = 'provas';
    const ARQUIVOS = 'arquivos';
    const IMAGENS = 'imagens'; /* imagens das provas da área, para abrir sem internet */
    const LIMITE_ARQUIVOS = 40;

    let bancoPromessa = null;
    const memoria = { provas: new Map(), arquivos: new Map(), imagens: new Map() };

    function abrir() {
        if (!bancoPromessa) {
            bancoPromessa = new Promise(function (resolve, reject) {
                if (!global.indexedDB) { reject(new Error('sem IndexedDB')); return; }
                const pedido = global.indexedDB.open(BANCO, 3);
                pedido.onupgradeneeded = function () {
                    const banco = pedido.result;
                    if (!banco.objectStoreNames.contains(PROVAS)) banco.createObjectStore(PROVAS, { keyPath: 'id' });
                    if (!banco.objectStoreNames.contains(ARQUIVOS)) banco.createObjectStore(ARQUIVOS, { keyPath: 'id' });
                    if (!banco.objectStoreNames.contains(IMAGENS)) banco.createObjectStore(IMAGENS, { keyPath: 'id' });
                };
                pedido.onsuccess = function () { resolve(pedido.result); };
                pedido.onerror = function () { reject(pedido.error); };
                pedido.onblocked = function () { reject(new Error('banco bloqueado por outra aba')); };
            });
            bancoPromessa.catch(function () { /* cai na memória */ });
        }
        return bancoPromessa;
    }

    function transacao(loja, modo, trabalho) {
        return abrir().then(function (banco) {
            return new Promise(function (resolve, reject) {
                const tx = banco.transaction(loja, modo);
                let resultado;
                tx.oncomplete = function () { resolve(resultado); };
                tx.onerror = function () { reject(tx.error); };
                tx.onabort = function () { reject(tx.error || new Error('Gravação cancelada.')); };
                const pedido = trabalho(tx.objectStore(loja));
                if (pedido instanceof IDBRequest) pedido.onsuccess = function () { resultado = pedido.result; };
            });
        });
    }

    function copia(objeto) { return JSON.parse(JSON.stringify(objeto)); }

    function todos(loja) {
        return transacao(loja, 'readonly', function (l) { return l.getAll(); })
            .catch(function () { return Array.from(memoria[loja].values()); });
    }

    function um(loja, id) {
        return transacao(loja, 'readonly', function (l) { return l.get(id); })
            .catch(function () { return memoria[loja].get(id); });
    }

    function gravar(loja, objeto) {
        const c = copia(objeto);
        return transacao(loja, 'readwrite', function (l) { l.put(c); })
            .catch(function () { memoria[loja].set(c.id, c); });
    }

    function remover(loja, id) {
        return transacao(loja, 'readwrite', function (l) { l.delete(id); })
            .catch(function () { memoria[loja].delete(id); });
    }

    /* ----- provas ----- */

    function listar() {
        return todos(PROVAS).then(function (itens) {
            return (itens || []).sort(function (a, b) { return b.atualizadaEm - a.atualizadaEm; });
        });
    }

    function obter(id) { return um(PROVAS, id); }

    function salvar(prova) {
        prova.atualizadaEm = Date.now();
        pedirPersistencia();
        return gravar(PROVAS, prova);
    }

    function apagar(id) { return remover(PROVAS, id); }

    /* ----- últimos arquivos gerados ----- */

    function guardarArquivo(prova, info) {
        const registro = {
            id: 'arq-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6),
            provaId: prova.id,
            titulo: prova.titulo || 'Prova sem título',
            nome: info.nome,
            tipo: info.tipo || 'prova',
            paginas: info.paginas || 0,
            criadoEm: Date.now(),
            prova: copia(prova)
        };
        return gravar(ARQUIVOS, registro).then(function () {
            return todos(ARQUIVOS);
        }).then(function (lista) {
            /* só os mais novos ficam */
            const sobrando = (lista || []).sort(function (a, b) { return b.criadoEm - a.criadoEm; }).slice(LIMITE_ARQUIVOS);
            return Promise.all(sobrando.map(function (a) { return remover(ARQUIVOS, a.id); }));
        }).then(function () { return registro; });
    }

    /* do mais novo para o mais antigo, sem a prova inteira (lista leve) */
    function listarArquivos() {
        return todos(ARQUIVOS).then(function (itens) {
            return (itens || []).map(function (a) {
                return { id: a.id, provaId: a.provaId, titulo: a.titulo, nome: a.nome, tipo: a.tipo, paginas: a.paginas, criadoEm: a.criadoEm };
            }).sort(function (a, b) { return b.criadoEm - a.criadoEm; });
        });
    }

    function obterArquivo(id) { return um(ARQUIVOS, id); }
    function apagarArquivo(id) { return remover(ARQUIVOS, id); }

    /* ----- imagens das provas da área ----- */

    function obterImagem(caminho) {
        return um(IMAGENS, caminho).then(function (r) { return r ? r.src : null; });
    }

    function guardarImagem(caminho, src) {
        return gravar(IMAGENS, { id: caminho, src: src });
    }

    /* ----- persistência ----- */

    let pedido = false;
    function pedirPersistencia() {
        if (pedido) return;
        pedido = true;
        try {
            if (global.navigator && navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
        } catch (erro) { /* navegador antigo */ }
    }

    function persistente() {
        return abrir().then(function () { return true; }, function () { return false; });
    }

    const api = {
        listar: listar, obter: obter, salvar: salvar, apagar: apagar,
        guardarArquivo: guardarArquivo, listarArquivos: listarArquivos, obterArquivo: obterArquivo, apagarArquivo: apagarArquivo,
        obterImagem: obterImagem, guardarImagem: guardarImagem,
        persistente: persistente, LIMITE_ARQUIVOS: LIMITE_ARQUIVOS
    };
    global.MontarArmazem = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
