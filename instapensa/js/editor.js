/* InstaPensa — editor: monta os posts e amarra o material didático a cada um. */
(function (global) {
    'use strict';

    const db = global.FeedAula.db;
    const model = global.FeedAula.model;
    const media = global.FeedAula.media;
    const esc = function (v) { return global.FeedAula.feed.esc(v); };

    let feed = null;
    let selected = 0;
    let saveTimer = null;
    let previewTimer = null;
    let dirty = false;
    let revision = 0;
    let saving = Promise.resolve();

    const listBox = document.getElementById('post-list');
    const formBox = document.getElementById('post-form');
    const previewBox = document.getElementById('preview-stage');
    const stateBox = document.getElementById('save-state');
    const nameInput = document.getElementById('feed-name');
    const brandInput = document.getElementById('brand');
    const themeInput = document.getElementById('theme');

    function open(loaded) {
        feed = loaded;
        selected = 0;
        nameInput.value = feed.name;
        brandInput.value = feed.profile.brand;
        themeInput.value = feed.profile.theme;
        stateBox.textContent = '';
        renderList();
        renderForm();
        renderPreview();
    }

    function close() {
        global.clearTimeout(saveTimer);
        global.clearTimeout(previewTimer);
        saveTimer = null;
        dirty = false;
        feed = null;
        previewBox.innerHTML = '';
    }

    /* ===== Gravação ===== */

    function flush() {
        global.clearTimeout(saveTimer);
        saveTimer = null;
        if (!feed || !dirty) return saving;
        const current = feed;
        const version = revision;
        const snapshot = JSON.parse(JSON.stringify(current));
        saving = db.saveFeed(snapshot).then(function () {
            if (feed === current && revision === version) {
                dirty = false;
                stateBox.textContent = 'Salvo ' + new Date().toLocaleTimeString('pt-BR', {
                    hour: '2-digit', minute: '2-digit'
                });
            }
        });
        return saving;
    }

    function touch(options) {
        if (!feed) return;
        dirty = true;
        revision += 1;
        const opts = options || {};
        stateBox.textContent = 'Salvando…';
        global.clearTimeout(saveTimer);
        saveTimer = global.setTimeout(function () {
            flush().catch(global.FeedAula.app.fail);
        }, 500);

        if (opts.list !== false) renderList();
        if (opts.preview !== false) schedulePreview();
    }

    function schedulePreview() {
        global.clearTimeout(previewTimer);
        previewTimer = global.setTimeout(renderPreview, 450);
    }

    /* ===== Lista de posts ===== */

    function renderList() {
        if (!feed) return;
        listBox.innerHTML = '';
        feed.posts.forEach(function (post, index) {
            const item = document.createElement('div');
            item.className = 'post-item' + (index === selected ? ' is-on' : '');
            const label = model.postLabel(post, index);
            const hasMaterial = (post.material.text && post.material.text.trim()) ||
                post.material.questions.length ||
                (post.material.title && post.material.title.trim());
            item.innerHTML =
                '<span class="post-item__thumb"></span>' +
                '<span class="post-item__text"><strong>' + (index + 1) + '. ' + esc(label) + '</strong>' +
                '<span>' + (post.media.length || 0) + (post.media.length === 1 ? ' print' : ' prints') +
                (hasMaterial ? ' · com reflexão' : ' · sem reflexão') + '</span></span>' +
                '<span class="post-move">' +
                '<button type="button" data-move="-1" title="Subir">▲</button>' +
                '<button type="button" data-move="1" title="Descer">▼</button>' +
                '</span>';

            const thumbBox = item.querySelector('.post-item__thumb');
            const firstMedia = post.media[0];
            const url = firstMedia ? media.refUrl(firstMedia) : '';
            if (url && firstMedia.kind === 'image') {
                thumbBox.innerHTML = '<img src="' + esc(url) + '" alt="">';
            } else if (firstMedia && firstMedia.kind === 'video') {
                thumbBox.textContent = '▶';
            } else {
                thumbBox.textContent = index + 1;
            }

            item.addEventListener('click', function (event) {
                const move = event.target.closest('[data-move]');
                if (move) {
                    movePost(index, parseInt(move.dataset.move, 10));
                    return;
                }
                selected = index;
                renderList();
                renderForm();
                scrollPreviewTo(index);
            });
            listBox.appendChild(item);
        });
    }

    function movePost(index, direction) {
        const target = index + direction;
        if (target < 0 || target >= feed.posts.length) return;
        const posts = feed.posts;
        const tmp = posts[target];
        posts[target] = posts[index];
        posts[index] = tmp;
        selected = target;
        touch();
        renderForm();
    }

    /* ===== Formulário do post ===== */

    function renderForm() {
        if (!feed) return;
        const post = feed.posts[selected];
        if (!post) {
            formBox.innerHTML = '<p class="panel__hint">Selecione um post na lista ao lado.</p>';
            return;
        }

        formBox.innerHTML =
            '<div class="toolbar" style="margin:0 0 14px">' +
            '<strong style="font-size:17px">Post ' + (selected + 1) + ' de ' + feed.posts.length + '</strong>' +
            '<span class="toolbar__gap"></span>' +
            '<button class="btn btn--sm" data-post-act="duplicate">Duplicar post</button>' +
            '<button class="btn btn--sm btn--danger" data-post-act="delete">Excluir post</button>' +
            '</div>' +

            '<div class="form-section"><h3>Print da publicação <span class="tag">imagem ou vídeo</span></h3>' +
            '<p class="panel__hint">Suba o print da publicação como ela é: o perfil, as curtidas, a legenda e os comentários já aparecem na própria imagem, então não há nada disso para preencher aqui.</p>' +
            '<div class="media-list" id="media-list"></div>' +
            '<div class="dropzone" id="media-drop"><strong>Clique para escolher</strong> ou arraste os prints aqui.' +
            '<br><span style="font-size:12px">Vários prints no mesmo post viram carrossel, como no Instagram.</span></div>' +
            '<div class="row" style="margin-top:10px">' +
            '<input type="url" id="media-url" placeholder="…ou cole o endereço de uma imagem/vídeo da internet">' +
            '<button class="btn btn--sm" id="media-url-add" style="flex:0 0 auto">Adicionar link</button>' +
            '</div></div>' +

            '<div class="form-section"><h3>🧠 Reflexão do post <span class="tag">abre no botão de cérebro</span></h3>' +
            '<p class="panel__hint">É o que a turma vê quando você clica no cérebro deste post, na projeção.</p>' +
            field('Título', input('text', 'material.title', post.material.title, 'ex.: Quem fala nesse post?')) +
            field('Texto de apoio', '<textarea data-bind="material.text" rows="5" placeholder="Um parágrafo, um trecho de texto, uma explicação, a fonte da imagem…">' +
                esc(post.material.text) + '</textarea>') +
            field('Perguntas para a turma <span class="hint">Uma por linha — na projeção você revela uma a uma.</span>',
                '<textarea id="questions" rows="5" placeholder="O que essa imagem quer que a gente sinta?\nQuem lucra com essa publicação?">' +
                esc(post.material.questions.join('\n')) + '</textarea>') +
            '<div id="link-list"></div>' +
            '<button class="btn btn--sm" id="add-link">+ Link de apoio</button>' +
            '</div>';

        bindFields(post);
        renderMediaList(post);
        renderLinks(post);
        wireMediaIntake(post);

        formBox.querySelector('#add-link').addEventListener('click', function () {
            post.material.links.push({ label: '', url: '' });
            touch({ list: false, preview: false });
            renderLinks(post);
        });

        formBox.querySelectorAll('[data-post-act]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                if (btn.dataset.postAct === 'duplicate') {
                    const copy = model.migrate({ posts: [JSON.parse(JSON.stringify(post))] }).posts[0];
                    copy.id = model.uid('p');
                    feed.posts.splice(selected + 1, 0, copy);
                    selected += 1;
                    touch();
                    renderForm();
                    return;
                }
                if (feed.posts.length === 1) {
                    global.FeedAula.app.toast('Um feed precisa de pelo menos um post.', true);
                    return;
                }
                if (!global.confirm('Excluir o post ' + (selected + 1) + '?')) return;
                feed.posts.splice(selected, 1);
                selected = Math.max(0, selected - 1);
                touch();
                renderForm();
            });
        });
    }

    function field(label, control) {
        return '<label class="field"><span>' + label + '</span>' + control + '</label>';
    }

    function input(type, path, value, placeholder) {
        return '<input type="' + type + '" data-bind="' + path + '" value="' + esc(value) +
            '" placeholder="' + esc(placeholder || '') + '">';
    }

    function getPath(target, path) {
        return path.split('.').reduce(function (acc, key) { return acc ? acc[key] : undefined; }, target);
    }

    function setPath(target, path, value) {
        const keys = path.split('.');
        const last = keys.pop();
        const parent = keys.reduce(function (acc, key) { return acc[key]; }, target);
        parent[last] = value;
    }

    function bindFields(post) {
        formBox.querySelectorAll('[data-bind]').forEach(function (el) {
            const path = el.dataset.bind;
            const isCheck = el.type === 'checkbox';
            el.addEventListener(isCheck ? 'change' : 'input', function () {
                setPath(post, path, isCheck ? el.checked : el.value);
                touch({ list: path === 'caption' || path === 'material.title' });
            });
        });

        const questions = formBox.querySelector('#questions');
        questions.addEventListener('input', function () {
            post.material.questions = questions.value.split('\n')
                .map(function (line) { return line.trim(); })
                .filter(function (line) { return line !== ''; });
            touch({ preview: false });
        });
    }

    /* ===== Mídias ===== */

    /* Descrição curta da origem: URLs longas (e data:) estouravam a coluna. */
    function mediaOrigin(item) {
        if (item.mediaId) return 'arquivo deste computador';
        const url = (item.url || '').trim();
        if (!url) return 'sem origem';
        if (/^data:/i.test(url)) return 'print embutido no exemplo';
        try {
            return 'link · ' + new URL(url).hostname;
        } catch (err) {
            return 'link · ' + url.slice(0, 40);
        }
    }

    function renderMediaList(post) {
        const box = formBox.querySelector('#media-list');
        box.innerHTML = post.media.map(function (item, index) {
            const url = media.refUrl(item);
            const thumb = url
                ? (item.kind === 'video'
                    ? '<video src="' + esc(url) + '" muted></video>'
                    : '<img src="' + esc(url) + '" alt="">')
                : 'sem prévia';
            return '<div class="media-row">' +
                '<span class="media-row__thumb">' + thumb + '</span>' +
                '<span class="media-row__meta"><strong>' + (index + 1) + '. ' +
                (item.kind === 'video' ? 'Vídeo' : 'Imagem') + '</strong>' +
                '<span class="media-row__origin">' + esc(mediaOrigin(item)) + '</span>' +
                '<input type="text" data-media-alt="' + index + '" value="' + esc(item.alt) +
                '" placeholder="Descrição da imagem (acessibilidade)" style="margin-top:6px">' +
                '</span>' +
                '<span class="media-row__tools">' +
                '<button class="btn btn--sm btn--icon" data-media-move="-1" data-index="' + index + '" title="Subir">▲</button>' +
                '<button class="btn btn--sm btn--icon" data-media-move="1" data-index="' + index + '" title="Descer">▼</button>' +
                '<button class="btn btn--sm btn--icon btn--danger" data-media-remove="' + index + '" title="Remover">✕</button>' +
                '</span></div>';
        }).join('');

        box.querySelectorAll('[data-media-alt]').forEach(function (el) {
            el.addEventListener('input', function () {
                post.media[parseInt(el.dataset.mediaAlt, 10)].alt = el.value;
                touch({ list: false });
            });
        });
        box.querySelectorAll('[data-media-move]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                const index = parseInt(btn.dataset.index, 10);
                const target = index + parseInt(btn.dataset.mediaMove, 10);
                if (target < 0 || target >= post.media.length) return;
                const tmp = post.media[target];
                post.media[target] = post.media[index];
                post.media[index] = tmp;
                touch();
                renderMediaList(post);
            });
        });
        box.querySelectorAll('[data-media-remove]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                post.media.splice(parseInt(btn.dataset.mediaRemove, 10), 1);
                touch();
                renderMediaList(post);
            });
        });
    }

    function wireMediaIntake(post) {
        const drop = formBox.querySelector('#media-drop');
        const picker = function () {
            pickFiles('image/*,video/*', true).then(function (files) {
                return addFiles(post, files);
            }).catch(global.FeedAula.app.fail);
        };
        drop.addEventListener('click', picker);
        ['dragenter', 'dragover'].forEach(function (name) {
            drop.addEventListener(name, function (event) {
                event.preventDefault();
                drop.classList.add('is-over');
            });
        });
        ['dragleave', 'drop'].forEach(function (name) {
            drop.addEventListener(name, function () { drop.classList.remove('is-over'); });
        });
        drop.addEventListener('drop', function (event) {
            event.preventDefault();
            addFiles(post, event.dataTransfer.files).catch(global.FeedAula.app.fail);
        });

        const urlInput = formBox.querySelector('#media-url');
        const addUrl = function () {
            const value = urlInput.value.trim();
            if (!value) return;
            const item = model.newMedia(/\.(mp4|webm|ogv|mov|m4v)(\?|$)/i.test(value) ? 'video' : 'image');
            item.url = value;
            post.media.push(item);
            urlInput.value = '';
            touch();
            renderMediaList(post);
        };
        formBox.querySelector('#media-url-add').addEventListener('click', addUrl);
        urlInput.addEventListener('keydown', function (event) {
            if (event.key === 'Enter') { event.preventDefault(); addUrl(); }
        });

    }

    function addFiles(post, files) {
        const list = Array.prototype.slice.call(files || []);
        if (!list.length) return Promise.resolve();
        global.FeedAula.app.toast('Preparando ' + list.length + ' arquivo(s)…');
        return media.addFiles(list).then(function (result) {
            result.added.forEach(function (item) {
                const entry = model.newMedia(item.kind);
                entry.mediaId = item.mediaId;
                post.media.push(entry);
            });
            touch();
            renderMediaList(post);
            if (result.errors.length) {
                global.FeedAula.app.toast(result.errors.join(' '), true);
            } else {
                global.FeedAula.app.toast(result.added.length + ' mídia(s) adicionada(s).');
            }
        });
    }

    function pickFiles(accept, multiple) {
        return new Promise(function (resolve) {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = accept;
            input.multiple = !!multiple;
            input.addEventListener('change', function () {
                resolve(Array.prototype.slice.call(input.files || []));
            });
            input.click();
        });
    }

    /* ===== Comentários e links ===== */

    function renderLinks(post) {
        const box = formBox.querySelector('#link-list');
        box.innerHTML = post.material.links.map(function (link, index) {
            return '<div class="repeat-row"><div class="row">' +
                '<input type="text" data-link="label" data-index="' + index + '" value="' +
                esc(link.label) + '" placeholder="Rótulo (ex.: Reportagem no jornal)">' +
                '<input type="url" data-link="url" data-index="' + index + '" value="' +
                esc(link.url) + '" placeholder="https://…">' +
                '</div><div class="repeat-row__tools">' +
                '<button class="btn btn--sm btn--danger" data-link-remove="' + index + '">Remover</button>' +
                '</div></div>';
        }).join('');

        box.querySelectorAll('[data-link]').forEach(function (el) {
            el.addEventListener('input', function () {
                post.material.links[parseInt(el.dataset.index, 10)][el.dataset.link] = el.value;
                touch({ list: false, preview: false });
            });
        });
        box.querySelectorAll('[data-link-remove]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                post.material.links.splice(parseInt(btn.dataset.linkRemove, 10), 1);
                touch({ list: false, preview: false });
                renderLinks(post);
            });
        });
    }

    /* ===== Pré-visualização ===== */

    function renderPreview() {
        if (!feed) return;
        media.warm(feed).then(function () {
            if (!feed) return;
            const phone = document.createElement('div');
            phone.className = 'ig-phone';
            const screen = document.createElement('div');
            screen.className = 'ig-phone__screen';
            const notch = document.createElement('div');
            notch.className = 'ig-phone__notch';
            screen.appendChild(notch);
            screen.appendChild(global.FeedAula.feed.render(feed, {
                interactive: true,
                onLike: function (index, liked) {
                    if (!feed || !feed.posts[index]) return;
                    feed.posts[index].liked = liked;
                    touch({ list: false, preview: false });
                }
            }));
            phone.appendChild(screen);
            previewBox.innerHTML = '';
            previewBox.appendChild(phone);
            scrollPreviewTo(selected);
        }).catch(global.FeedAula.app.fail);
    }

    function scrollPreviewTo(index) {
        const rendered = previewBox.querySelector('.ig');
        if (rendered && rendered.feedApi) rendered.feedApi.goTo(index);
    }

    /* ===== Barra do editor e campos do feed ===== */

    nameInput.addEventListener('input', function () {
        if (!feed) return;
        feed.name = nameInput.value;
        touch({ list: false, preview: false });
    });

    brandInput.addEventListener('input', function () {
        if (!feed) return;
        feed.profile.brand = brandInput.value;
        touch({ list: false });
    });

    themeInput.addEventListener('change', function () {
        if (!feed) return;
        feed.profile.theme = themeInput.value;
        touch({ list: false });
    });

    document.getElementById('add-post').addEventListener('click', function () {
        if (!feed) return;
        const post = model.newPost();
        feed.posts.push(post);
        selected = feed.posts.length - 1;
        touch();
        renderForm();
    });

    document.getElementById('editor-back').addEventListener('click', function () {
        global.FeedAula.app.go('#/');
    });

    document.getElementById('editor-present').addEventListener('click', function () {
        if (!feed) return;
        global.FeedAula.app.go('#/apresentar/' + feed.id);
    });

    document.getElementById('editor-export').addEventListener('click', function () {
        if (feed) global.FeedAula.app.exportFeed(feed);
    });

    document.getElementById('editor-duplicate').addEventListener('click', function () {
        if (!feed) return;
        const copy = model.duplicate(feed);
        db.saveFeed(copy).then(function () {
            global.FeedAula.app.toast('Feed duplicado.');
            global.FeedAula.app.go('#/editar/' + copy.id);
        }).catch(global.FeedAula.app.fail);
    });

    document.getElementById('editor-delete').addEventListener('click', function () {
        if (!feed) return;
        if (!global.confirm('Excluir "' + feed.name + '"? Isso não volta atrás.')) return;
        const id = feed.id;
        close();
        db.deleteFeed(id).then(function () {
            global.FeedAula.app.toast('Feed excluído.');
            global.FeedAula.app.go('#/');
        }).catch(global.FeedAula.app.fail);
    });

    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden') flush().catch(global.FeedAula.app.fail);
    });
    global.addEventListener('beforeunload', function (event) {
        if (!dirty) return;
        flush().catch(global.FeedAula.app.fail);
        event.preventDefault();
        event.returnValue = '';
    });

    global.FeedAula = global.FeedAula || {};
    global.FeedAula.editor = {
        open: open,
        close: close,
        flush: flush,
        current: function () { return feed; }
    };
}(window));
