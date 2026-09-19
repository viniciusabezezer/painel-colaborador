/* InstaPensa — biblioteca de feeds, navegação e importação/exportação. */
(function (global) {
    'use strict';

    const db = global.FeedAula.db;
    const model = global.FeedAula.model;
    const media = global.FeedAula.media;

    const body = document.body;
    const cardsBox = document.getElementById('feed-cards');
    const toastBox = document.getElementById('toast');
    const fileInput = document.getElementById('file-import');
    let toastTimer = null;
    let routeVersion = 0;

    function toast(message, isError) {
        toastBox.textContent = message;
        toastBox.classList.toggle('is-error', !!isError);
        toastBox.classList.add('is-on');
        global.clearTimeout(toastTimer);
        toastTimer = global.setTimeout(function () {
            toastBox.classList.remove('is-on');
        }, isError ? 6000 : 3200);
    }

    function fail(err) {
        console.error(err);
        toast(err && err.message ? err.message : 'Algo deu errado.', true);
    }

    /* ===== Navegação por hash ===== */

    function go(hash) {
        if (global.location.hash === hash) route();
        else global.location.hash = hash;
    }

    async function route() {
        global.FeedAula.reflection.close();
        const version = ++routeVersion;
        try {
            await global.FeedAula.editor.flush();
        } catch (err) {
            fail(err);
            return;
        }
        if (version !== routeVersion) return;
        const hash = global.location.hash || '#/';
        const editMatch = /^#\/editar\/(.+)$/.exec(hash);
        const presentMatch = /^#\/apresentar\/(.+)$/.exec(hash);

        global.FeedAula.present.stop();
        global.FeedAula.editor.close();

        if (editMatch) {
            db.getFeed(editMatch[1]).then(function (raw) {
                if (version !== routeVersion) return;
                if (!raw) { toast('Este feed não existe mais.', true); go('#/'); return; }
                body.dataset.view = 'editor';
                global.FeedAula.editor.open(model.migrate(raw));
            }).catch(fail);
            return;
        }

        if (presentMatch) {
            db.getFeed(presentMatch[1]).then(function (raw) {
                if (version !== routeVersion) return;
                if (!raw) { toast('Este feed não existe mais.', true); go('#/'); return; }
                body.dataset.view = 'present';
                global.FeedAula.present.start(model.migrate(raw));
            }).catch(fail);
            return;
        }

        body.dataset.view = 'library';
        global.FeedAula.editor.close();
        renderLibrary();
    }

    /* ===== Biblioteca ===== */

    function renderLibrary() {
        db.listFeeds().then(function (feeds) {
            if (!feeds.length) {
                cardsBox.innerHTML = '<div class="empty"><strong>Nenhum feed por aqui ainda</strong>' +
                    'Clique em <b>+ Novo feed</b> para montar a sua aula, ou em ' +
                    '<b>Carregar exemplo pronto</b> para ver como fica.</div>';
                return;
            }
            cardsBox.innerHTML = '';
            feeds.forEach(function (raw) {
                const feed = model.migrate(raw);
                cardsBox.appendChild(feedCard(feed));
            });
        }).catch(fail).then(showUsage);
    }

    function feedCard(feed) {
        const esc = global.FeedAula.feed.esc;
        const posts = feed.posts || [];
        const withMaterial = posts.filter(function (p) {
            const m = p.material || {};
            return (m.text && m.text.trim()) || (m.questions && m.questions.length);
        }).length;

        const card = document.createElement('article');
        card.className = 'feed-card';
        card.innerHTML =
            '<div class="feed-card__thumb"><span class="feed-card__count">' +
            posts.length + (posts.length === 1 ? ' post' : ' posts') + '</span></div>' +
            '<div class="feed-card__body">' +
            '<h3>' + esc(feed.name) + '</h3>' +
            '<p>' + withMaterial + ' de ' + posts.length + ' com material da aula · ' +
            'editado ' + when(feed.updatedAt) + '</p>' +
            '</div>' +
            '<div class="feed-card__actions">' +
            '<button class="btn btn--accent btn--sm" data-act="present">Apresentar</button>' +
            '<button class="btn btn--sm" data-act="edit">Editar</button>' +
            '<button class="btn btn--sm" data-act="export">Exportar</button>' +
            '<button class="btn btn--sm" data-act="duplicate">Duplicar</button>' +
            '<button class="btn btn--sm btn--danger" data-act="delete">Excluir</button>' +
            '</div>';

        const thumb = card.querySelector('.feed-card__thumb');
        const first = firstImage(feed);
        if (first) {
            media.urlFor(first.mediaId).then(function (url) {
                const src = url || first.url;
                if (!src) return;
                const img = document.createElement('img');
                img.src = src;
                img.alt = '';
                thumb.insertBefore(img, thumb.firstChild);
            });
        }

        card.addEventListener('click', function (event) {
            const btn = event.target.closest('[data-act]');
            if (!btn) return;
            const act = btn.dataset.act;
            if (act === 'present') { go('#/apresentar/' + feed.id); return; }
            if (act === 'edit') { go('#/editar/' + feed.id); return; }
            if (act === 'export') { exportFeed(feed); return; }
            if (act === 'duplicate') {
                db.saveFeed(model.duplicate(feed)).then(function () {
                    toast('Feed duplicado.');
                    renderLibrary();
                }).catch(fail);
                return;
            }
            if (act === 'delete') {
                if (!global.confirm('Excluir "' + feed.name + '"? Isso não volta atrás.')) return;
                db.deleteFeed(feed.id).then(function () {
                    toast('Feed excluído.');
                    renderLibrary();
                }).catch(fail);
            }
        });

        return card;
    }

    function firstImage(feed) {
        let found = null;
        (feed.posts || []).some(function (post) {
            return (post.media || []).some(function (item) {
                if (item.kind === 'image' && (item.mediaId || item.url)) {
                    found = item;
                    return true;
                }
                return false;
            });
        });
        return found;
    }

    function when(timestamp) {
        if (!timestamp) return 'agora';
        const diff = Date.now() - timestamp;
        const minutes = Math.round(diff / 60000);
        if (minutes < 1) return 'agora';
        if (minutes < 60) return 'há ' + minutes + ' min';
        const hours = Math.round(minutes / 60);
        if (hours < 24) return 'há ' + hours + (hours === 1 ? ' hora' : ' horas');
        return 'em ' + new Date(timestamp).toLocaleDateString('pt-BR');
    }

    function showUsage() {
        const box = document.getElementById('usage');
        if (!box) return;
        db.usage().then(function (info) {
            if (!info || !info.used) { box.textContent = ''; return; }
            box.textContent = 'Guardado neste navegador: ' + media.formatSize(info.used);
        });
    }

    /* ===== Exportar / importar ===== */

    function exportFeed(feed) {
        media.exportBundle(feed).then(function (bundle) {
            const json = JSON.stringify(bundle);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'instapensa-' + model.slug(feed.name) + '.json';
            document.body.appendChild(link);
            link.click();
            link.remove();
            global.setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
            toast('Arquivo gerado (' + media.formatSize(blob.size) + '). Leve para o computador da sala e use "Importar arquivo".');
        }).catch(fail);
    }

    function importFile(file) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function () {
            let bundle;
            try {
                bundle = JSON.parse(reader.result);
            } catch (err) {
                fail(new Error('Não consegui ler o arquivo: ele não é um JSON válido.'));
                return;
            }
            media.importBundle(bundle).then(function (feed) {
                return db.getFeed(feed.id).then(function (existing) {
                    if (existing) feed.id = model.uid('feed');
                    return db.saveFeed(feed);
                });
            }).then(function (feed) {
                toast('Feed "' + feed.name + '" importado.');
                renderLibrary();
            }).catch(fail);
        };
        reader.onerror = function () { fail(reader.error || new Error('Falha ao ler o arquivo.')); };
        reader.readAsText(file);
    }

    /* ===== Ligações da tela ===== */

    document.getElementById('new-feed').addEventListener('click', function () {
        const feed = model.newFeed('Feed sem título');
        db.saveFeed(feed).then(function () { go('#/editar/' + feed.id); }).catch(fail);
    });

    document.getElementById('import-feed').addEventListener('click', function () {
        fileInput.value = '';
        fileInput.click();
    });

    fileInput.addEventListener('change', function () {
        importFile(fileInput.files && fileInput.files[0]);
    });

    document.getElementById('load-demo').addEventListener('click', function () {
        global.FeedAula.demo.create().then(function (feed) {
            toast('Exemplo carregado. Abra e troque pelos seus posts.');
            go('#/editar/' + feed.id);
        }).catch(fail);
    });

    global.addEventListener('hashchange', route);

    global.FeedAula.app = {
        toast: toast,
        fail: fail,
        go: go,
        exportFeed: exportFeed,
        renderLibrary: renderLibrary
    };

    route();
}(window));
