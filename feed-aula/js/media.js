/* InstaPensa — entrada e leitura de mídias.
   Imagens grandes são reduzidas antes de guardar (aula projetada não precisa de
   4000px e o navegador tem limite de espaço). Vídeos são guardados como vieram. */
(function (global) {
    'use strict';

    const MAX_IMAGE_SIDE = 1600;
    const IMAGE_QUALITY = 0.85;
    const KEEP_AS_IS = ['image/gif', 'image/svg+xml'];

    const urlCache = new Map();

    function isVideo(file) { return /^video\//.test(file.type); }
    function isImage(file) { return /^image\//.test(file.type); }

    /* Guarda um arquivo escolhido pelo professor e devolve o id da mídia. */
    function addFile(file) {
        if (!file) return Promise.reject(new Error('Nenhum arquivo.'));
        if (!isImage(file) && !isVideo(file)) {
            return Promise.reject(new Error('"' + file.name + '" não é imagem nem vídeo.'));
        }
        const prepare = isImage(file) && KEEP_AS_IS.indexOf(file.type) === -1
            ? shrinkImage(file)
            : Promise.resolve({ blob: file, type: file.type, width: 0, height: 0 });

        return prepare.then(function (prepared) {
            const record = {
                id: global.FeedAula.model.uid('media'),
                kind: isVideo(file) ? 'video' : 'image',
                type: prepared.type || file.type,
                name: file.name || '',
                width: prepared.width || 0,
                height: prepared.height || 0,
                size: prepared.blob.size,
                blob: prepared.blob,
                createdAt: Date.now()
            };
            return global.FeedAula.db.putMedia(record).then(function () {
                return { mediaId: record.id, kind: record.kind, name: record.name, size: record.size };
            });
        });
    }

    function addFiles(fileList) {
        const files = Array.prototype.slice.call(fileList || []);
        return files.reduce(function (chain, file) {
            return chain.then(function (done) {
                return addFile(file).then(function (item) {
                    done.added.push(item);
                    return done;
                }).catch(function (err) {
                    done.errors.push(err.message || String(err));
                    return done;
                });
            });
        }, Promise.resolve({ added: [], errors: [] }));
    }

    function shrinkImage(file) {
        return loadImage(file).then(function (img) {
            const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
            const width = Math.round(img.naturalWidth * scale);
            const height = Math.round(img.naturalHeight * scale);
            if (scale === 1 && file.size < 900 * 1024) {
                return { blob: file, type: file.type, width: width, height: height };
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            return new Promise(function (resolve) {
                canvas.toBlob(function (blob) {
                    if (!blob) {
                        resolve({ blob: file, type: file.type, width: width, height: height });
                        return;
                    }
                    resolve({ blob: blob, type: 'image/jpeg', width: width, height: height });
                }, 'image/jpeg', IMAGE_QUALITY);
            });
        }).catch(function () {
            return { blob: file, type: file.type, width: 0, height: 0 };
        });
    }

    function loadImage(blob) {
        return new Promise(function (resolve, reject) {
            const url = URL.createObjectURL(blob);
            const img = new Image();
            img.onload = function () { URL.revokeObjectURL(url); resolve(img); };
            img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('Imagem inválida.')); };
            img.src = url;
        });
    }

    /* URL utilizável em <img>/<video> para uma mídia guardada. */
    function urlFor(mediaId) {
        if (!mediaId) return Promise.resolve('');
        if (urlCache.has(mediaId)) return Promise.resolve(urlCache.get(mediaId));
        return global.FeedAula.db.getMedia(mediaId).then(function (record) {
            if (!record || !record.blob) return '';
            const url = URL.createObjectURL(record.blob);
            urlCache.set(mediaId, url);
            return url;
        });
    }

    /* Deixa em cache tudo que o feed usa, para a renderização ser síncrona. */
    function warm(feed) {
        const ids = global.FeedAula.model.mediaIdsOf(feed);
        return Promise.all(ids.map(urlFor)).then(function () { return cached; });
    }

    function cached(mediaId) {
        return urlCache.get(mediaId) || '';
    }

    /* URL de exibição de uma referência {mediaId, url}: arquivo local ganha do link. */
    function refUrl(ref) {
        if (!ref) return '';
        if (ref.mediaId && urlCache.has(ref.mediaId)) return urlCache.get(ref.mediaId);
        return (ref.url || '').trim();
    }

    /* ===== Exportar / importar (arquivo .json com as mídias embutidas) ===== */

    function exportBundle(feed) {
        const ids = Array.from(new Set(global.FeedAula.model.mediaIdsOf(feed)));
        return Promise.all(ids.map(function (id) {
            return global.FeedAula.db.getMedia(id).then(function (record) {
                if (!record || !record.blob) return null;
                return blobToDataUrl(record.blob).then(function (dataUrl) {
                    return {
                        id: record.id,
                        kind: record.kind,
                        type: record.type,
                        name: record.name,
                        width: record.width,
                        height: record.height,
                        dataUrl: dataUrl
                    };
                });
            });
        })).then(function (items) {
            return {
                format: global.FeedAula.model.FORMAT,
                exportedAt: new Date().toISOString(),
                feed: feed,
                media: items.filter(Boolean)
            };
        });
    }

    function importBundle(bundle) {
        if (!bundle || typeof bundle !== 'object') {
            return Promise.reject(new Error('Arquivo vazio ou ilegível.'));
        }
        const rawFeed = bundle.feed || (bundle.posts ? bundle : null);
        if (!rawFeed) {
            return Promise.reject(new Error('Este arquivo não parece ser um feed exportado aqui.'));
        }
        const feed = global.FeedAula.model.migrate(rawFeed);
        const ids = new Map();
        const media = Array.isArray(bundle.media) ? bundle.media : [];
        return media.reduce(function (chain, item) {
            return chain.then(function () {
                if (!item || !item.id || !item.dataUrl) return null;
                const blob = dataUrlToBlob(item.dataUrl, item.type);
                if (!blob) return null;
                const id = global.FeedAula.model.uid('media');
                ids.set(item.id, id);
                return global.FeedAula.db.putMedia({
                    id: id,
                    kind: item.kind === 'video' ? 'video' : 'image',
                    type: item.type || blob.type,
                    name: item.name || '',
                    width: item.width || 0,
                    height: item.height || 0,
                    size: blob.size,
                    blob: blob,
                    createdAt: Date.now()
                });
            });
        }, Promise.resolve()).then(function () {
            feed.stories.forEach(function (story) {
                if (ids.has(story.mediaId)) story.mediaId = ids.get(story.mediaId);
            });
            feed.posts.forEach(function (post) {
                const avatar = post.author.avatarMediaId;
                if (ids.has(avatar)) post.author.avatarMediaId = ids.get(avatar);
                post.media.forEach(function (item) {
                    if (ids.has(item.mediaId)) item.mediaId = ids.get(item.mediaId);
                });
            });
            return feed;
        });
    }

    function blobToDataUrl(blob) {
        return new Promise(function (resolve, reject) {
            const reader = new FileReader();
            reader.onload = function () { resolve(reader.result); };
            reader.onerror = function () { reject(reader.error); };
            reader.readAsDataURL(blob);
        });
    }

    function dataUrlToBlob(dataUrl, fallbackType) {
        const match = /^data:([^;,]*)(;base64)?,(.*)$/s.exec(dataUrl || '');
        if (!match) return null;
        const type = match[1] || fallbackType || 'application/octet-stream';
        const body = match[3] || '';
        if (!match[2]) {
            return new Blob([decodeURIComponent(body)], { type: type });
        }
        const binary = atob(body);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
        return new Blob([bytes], { type: type });
    }

    function formatSize(bytes) {
        if (!bytes) return '0 KB';
        if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1).replace('.', ',') + ' MB';
    }

    global.FeedAula = global.FeedAula || {};
    global.FeedAula.media = {
        addFile: addFile,
        addFiles: addFiles,
        urlFor: urlFor,
        warm: warm,
        cached: cached,
        refUrl: refUrl,
        exportBundle: exportBundle,
        importBundle: importBundle,
        formatSize: formatSize
    };
}(window));
