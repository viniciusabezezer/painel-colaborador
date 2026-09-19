/* Feed da Aula — armazenamento local (IndexedDB).
   Guarda os feeds montados pelo professor e as mídias (imagens/vídeos) que ele
   sobe do computador. Nada sai do navegador: não há servidor nem login. */
(function (global) {
    'use strict';

    const DB_NAME = 'feed-aula';
    const DB_VERSION = 1;
    const STORE_FEEDS = 'feeds';
    const STORE_MEDIA = 'media';

    let dbPromise = null;

    function open() {
        if (dbPromise) return dbPromise;
        dbPromise = new Promise(function (resolve, reject) {
            if (!global.indexedDB) {
                reject(new Error('Este navegador não tem IndexedDB. Abra o Feed da Aula pelo endereço do site (https), não por um arquivo local.'));
                return;
            }
            const req = global.indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = function () {
                const db = req.result;
                if (!db.objectStoreNames.contains(STORE_FEEDS)) {
                    db.createObjectStore(STORE_FEEDS, { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains(STORE_MEDIA)) {
                    db.createObjectStore(STORE_MEDIA, { keyPath: 'id' });
                }
            };
            req.onsuccess = function () { resolve(req.result); };
            req.onerror = function () { reject(req.error); };
        });
        return dbPromise;
    }

    function run(storeName, mode, fn) {
        return open().then(function (db) {
            return new Promise(function (resolve, reject) {
                const tx = db.transaction(storeName, mode);
                const store = tx.objectStore(storeName);
                let result;
                try {
                    result = fn(store);
                } catch (err) {
                    reject(err);
                    return;
                }
                tx.oncomplete = function () {
                    resolve(result && typeof result.result !== 'undefined' ? result.result : result);
                };
                tx.onerror = function () { reject(tx.error); };
                tx.onabort = function () { reject(tx.error); };
            });
        });
    }

    /* ===== Feeds ===== */

    function listFeeds() {
        return run(STORE_FEEDS, 'readonly', function (store) {
            return store.getAll();
        }).then(function (feeds) {
            return (feeds || []).sort(function (a, b) {
                return (b.updatedAt || 0) - (a.updatedAt || 0);
            });
        });
    }

    function getFeed(id) {
        return run(STORE_FEEDS, 'readonly', function (store) { return store.get(id); });
    }

    function saveFeed(feed) {
        feed.updatedAt = Date.now();
        if (!feed.createdAt) feed.createdAt = feed.updatedAt;
        return run(STORE_FEEDS, 'readwrite', function (store) {
            store.put(feed);
        }).then(function () { return feed; });
    }

    function deleteFeed(id) {
        return run(STORE_FEEDS, 'readwrite', function (store) {
            store.delete(id);
        }).then(collectGarbage);
    }

    /* ===== Mídias ===== */

    function putMedia(record) {
        return run(STORE_MEDIA, 'readwrite', function (store) {
            store.put(record);
        }).then(function () { return record; });
    }

    function getMedia(id) {
        return run(STORE_MEDIA, 'readonly', function (store) { return store.get(id); });
    }

    function getAllMedia() {
        return run(STORE_MEDIA, 'readonly', function (store) { return store.getAll(); });
    }

    /* Apaga as mídias que nenhum feed usa mais (posts removidos, avatares trocados). */
    function collectGarbage() {
        return Promise.all([listFeeds(), getAllMedia()]).then(function (res) {
            const feeds = res[0] || [];
            const media = res[1] || [];
            const used = new Set();
            feeds.forEach(function (feed) {
                global.FeedAula.model.mediaIdsOf(feed).forEach(function (id) { used.add(id); });
            });
            const orphans = media.filter(function (m) { return !used.has(m.id); });
            if (!orphans.length) return 0;
            return run(STORE_MEDIA, 'readwrite', function (store) {
                orphans.forEach(function (m) { store.delete(m.id); });
            }).then(function () { return orphans.length; });
        });
    }

    /* Quanto espaço o app está usando (mostrado na biblioteca). */
    function usage() {
        if (!global.navigator.storage || !global.navigator.storage.estimate) {
            return Promise.resolve(null);
        }
        return global.navigator.storage.estimate().then(function (est) {
            return { used: est.usage || 0, quota: est.quota || 0 };
        }).catch(function () { return null; });
    }

    global.FeedAula = global.FeedAula || {};
    global.FeedAula.db = {
        listFeeds: listFeeds,
        getFeed: getFeed,
        saveFeed: saveFeed,
        deleteFeed: deleteFeed,
        putMedia: putMedia,
        getMedia: getMedia,
        getAllMedia: getAllMedia,
        collectGarbage: collectGarbage,
        usage: usage
    };
}(window));
