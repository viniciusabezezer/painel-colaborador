/* InstaPensa — modo aula: o feed projetado dentro de um celular, com o
   material didático do post ao lado. Tudo pelo teclado, para o professor não
   precisar caçar botões no meio da explicação. */
(function (global) {
    'use strict';

    const model = global.FeedAula.model;
    const media = global.FeedAula.media;
    const esc = function (v) { return global.FeedAula.feed.esc(v); };

    const SIZES = [340, 400, 460, 520, 600];
    const STORE_SIZE = 'feed-aula:phone-size';
    const STORE_PANEL = 'feed-aula:panel';

    const root = document.getElementById('present');
    const phoneBox = document.getElementById('present-phone');
    const titleBox = document.getElementById('present-title');
    const progressBox = document.getElementById('present-progress');
    const panelBtn = document.getElementById('present-panel');

    const materialTitle = document.getElementById('material-title');
    const materialEyebrow = document.getElementById('material-eyebrow');
    const materialText = document.getElementById('material-text');
    const materialQuestions = document.getElementById('material-questions');
    const materialLinks = document.getElementById('material-links');
    const materialEmpty = document.getElementById('material-empty');

    let feed = null;
    let rendered = null;
    let current = 0;
    let revealed = 0;
    let revealAll = false;
    let sizeIndex = 1;
    let idleTimer = null;
    let keyHandler = null;
    let wakeHandler = null;
    let likeTimer = null;

    function start(loaded) {
        feed = loaded;
        current = 0;
        revealAll = false;
        titleBox.textContent = feed.name;
        sizeIndex = readSize();
        setPanel(!global.matchMedia('(max-width: 820px)').matches &&
            global.localStorage.getItem(STORE_PANEL) !== 'off');

        return media.warm(feed).then(function () {
            if (feed !== loaded) return;
            const phone = document.createElement('div');
            phone.className = 'ig-phone';
            phone.style.setProperty('--phone-width', SIZES[sizeIndex] + 'px');
            const screen = document.createElement('div');
            screen.className = 'ig-phone__screen';
            const notch = document.createElement('div');
            notch.className = 'ig-phone__notch';
            screen.appendChild(notch);

            rendered = global.FeedAula.feed.render(feed, {
                interactive: true,
                onPostChange: function (index) {
                    current = index;
                    showMaterial(index);
                },
                onLike: function (index, liked) {
                    if (!feed || !feed.posts[index]) return;
                    feed.posts[index].liked = liked;
                    saveLikes();
                }
            });
            screen.appendChild(rendered);
            phone.appendChild(screen);
            phoneBox.innerHTML = '';
            phoneBox.appendChild(phone);

            showMaterial(0);
            wireKeys();
            wireIdle();
        }).catch(global.FeedAula.app.fail);
    }

    /* A curtida dada em aula fica gravada: ao rolar de volta para o post — e na
       próxima vez que o feed abrir — o coração continua vermelho. */
    function saveLikes() {
        global.clearTimeout(likeTimer);
        likeTimer = global.setTimeout(function () {
            if (!feed) return;
            global.FeedAula.db.saveFeed(feed).catch(global.FeedAula.app.fail);
        }, 400);
    }

    function stop() {
        if (rendered && rendered.feedApi) rendered.feedApi.pauseVideos();
        if (keyHandler) {
            global.removeEventListener('keydown', keyHandler);
            keyHandler = null;
        }
        global.clearTimeout(idleTimer);
        global.clearTimeout(likeTimer);
        if (feed) global.FeedAula.db.saveFeed(feed).catch(function () {});
        if (wakeHandler) {
            root.removeEventListener('mousemove', wakeHandler);
            root.removeEventListener('click', wakeHandler);
            wakeHandler = null;
        }
        root.classList.remove('is-idle', 'is-zoom', 'is-help');
        phoneBox.innerHTML = '';
        rendered = null;
        feed = null;
    }

    /* ===== Material da aula ===== */

    function showMaterial(index) {
        if (!feed) return;
        const post = feed.posts[index];
        if (!post) return;
        const material = post.material || {};
        const questions = material.questions || [];
        const links = material.links || [];
        const hasAny = (material.text && material.text.trim()) || questions.length || links.length;

        progressBox.textContent = 'Post ' + (index + 1) + ' de ' + feed.posts.length;
        materialEyebrow.textContent = '🧠 Post ' + (index + 1) + ' · reflexão';
        materialTitle.textContent = material.title && material.title.trim()
            ? material.title
            : model.postLabel(post, index);

        materialText.textContent = material.text || '';
        materialText.hidden = !(material.text && material.text.trim());

        materialQuestions.innerHTML = questions.map(function (question) {
            return '<li class="is-hidden"><span>' + esc(question) + '</span></li>';
        }).join('');

        materialLinks.innerHTML = links.map(function (link) {
            return '<a href="' + esc(link.url) + '" target="_blank" rel="noopener noreferrer">🔗 ' +
                esc(link.label || link.url) + '</a>';
        }).join('');

        materialEmpty.hidden = !!hasAny;

        revealed = revealAll ? questions.length : 0;
        paintQuestions();
    }

    function paintQuestions() {
        const items = materialQuestions.querySelectorAll('li');
        items.forEach(function (item, i) {
            item.classList.toggle('is-hidden', i >= revealed);
        });
    }

    function revealNext() {
        const total = materialQuestions.querySelectorAll('li').length;
        if (!total) return;
        if (!root.classList.contains('has-panel')) setPanel(true);
        revealed = Math.min(total, revealed + 1);
        paintQuestions();
    }

    /* ===== Navegação ===== */

    function goTo(index) {
        if (!rendered || !rendered.feedApi) return;
        const max = feed.posts.length - 1;
        const target = Math.max(0, Math.min(max, index));
        current = target;
        rendered.feedApi.goTo(target);
        showMaterial(target);
    }

    function setPanel(on) {
        root.classList.toggle('has-panel', !!on);
        panelBtn.classList.toggle('is-on', !!on);
        panelBtn.setAttribute('aria-expanded', String(!!on));
        if (!on) root.classList.remove('is-zoom');
        if (!global.matchMedia('(max-width: 820px)').matches) {
            global.localStorage.setItem(STORE_PANEL, on ? 'on' : 'off');
        }
    }

    function readSize() {
        const stored = parseInt(global.localStorage.getItem(STORE_SIZE), 10);
        return isNaN(stored) ? 1 : Math.max(0, Math.min(SIZES.length - 1, stored));
    }

    function setSize(index) {
        sizeIndex = Math.max(0, Math.min(SIZES.length - 1, index));
        global.localStorage.setItem(STORE_SIZE, String(sizeIndex));
        const phone = phoneBox.querySelector('.ig-phone');
        if (phone) phone.style.setProperty('--phone-width', SIZES[sizeIndex] + 'px');
    }

    function toggleFullscreen() {
        if (!document.fullscreenElement) {
            if (root.requestFullscreen) root.requestFullscreen().catch(function () {});
        } else if (document.exitFullscreen) {
            document.exitFullscreen().catch(function () {});
        }
    }

    function exit() {
        if (document.fullscreenElement && document.exitFullscreen) {
            document.exitFullscreen().catch(function () {});
        }
        global.FeedAula.app.go('#/');
    }

    /* ===== Teclado e ociosidade ===== */

    function wireKeys() {
        keyHandler = function (event) {
            if (global.FeedAula.reflection.isOpen()) return;
            if (event.target && /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)) return;
            const key = event.key;

            if (key === 'Escape') {
                if (root.classList.contains('is-help')) { root.classList.remove('is-help'); return; }
                if (root.classList.contains('is-zoom')) { root.classList.remove('is-zoom'); return; }
                exit();
                return;
            }
            if (key === 'ArrowDown' || key === 'ArrowRight' || key === ' ' || key === 'PageDown') {
                event.preventDefault();
                goTo(current + 1);
                return;
            }
            if (key === 'ArrowUp' || key === 'ArrowLeft' || key === 'PageUp') {
                event.preventDefault();
                goTo(current - 1);
                return;
            }
            if (/^[1-9]$/.test(key)) { goTo(parseInt(key, 10) - 1); return; }

            const lower = key.toLowerCase();
            if (lower === 'm') { setPanel(!root.classList.contains('has-panel')); return; }
            if (lower === 'n') { revealNext(); return; }
            if (lower === 't') {
                revealAll = true;
                revealed = materialQuestions.querySelectorAll('li').length;
                paintQuestions();
                return;
            }
            if (lower === 'a') { root.classList.toggle('is-zoom'); return; }
            if (lower === 'f') { toggleFullscreen(); return; }
            if (key === '?' || lower === 'h') { root.classList.toggle('is-help'); return; }
            if (key === '+' || key === '=') { setSize(sizeIndex + 1); return; }
            if (key === '-' || key === '_') { setSize(sizeIndex - 1); }
        };
        global.addEventListener('keydown', keyHandler);
    }

    /* Some com a barra de cima quando ninguém mexe no mouse. */
    function wireIdle() {
        const wake = function () {
            root.classList.remove('is-idle');
            global.clearTimeout(idleTimer);
            idleTimer = global.setTimeout(function () {
                root.classList.add('is-idle');
            }, 4000);
        };
        root.addEventListener('mousemove', wake);
        root.addEventListener('click', wake);
        wakeHandler = wake;
        wake();
    }

    /* ===== Botões da barra ===== */

    document.getElementById('present-exit').addEventListener('click', exit);
    document.getElementById('present-next').addEventListener('click', function () { goTo(current + 1); });
    document.getElementById('present-prev').addEventListener('click', function () { goTo(current - 1); });
    panelBtn.addEventListener('click', function () {
        setPanel(!root.classList.contains('has-panel'));
    });
    document.getElementById('present-size').addEventListener('click', function () {
        setSize((sizeIndex + 1) % SIZES.length);
    });
    document.getElementById('present-full').addEventListener('click', toggleFullscreen);
    document.getElementById('present-help').addEventListener('click', function () {
        root.classList.toggle('is-help');
    });
    document.getElementById('shortcuts-close').addEventListener('click', function () {
        root.classList.remove('is-help');
    });
    document.getElementById('reveal-next').addEventListener('click', revealNext);
    document.getElementById('reveal-all').addEventListener('click', function () {
        revealAll = true;
        revealed = materialQuestions.querySelectorAll('li').length;
        paintQuestions();
    });
    document.getElementById('reveal-reset').addEventListener('click', function () {
        revealAll = false;
        revealed = 0;
        paintQuestions();
    });
    document.getElementById('material-zoom').addEventListener('click', function () {
        root.classList.toggle('is-zoom');
    });
    document.getElementById('material-close').addEventListener('click', function () {
        setPanel(false);
        panelBtn.focus();
    });

    global.FeedAula = global.FeedAula || {};
    global.FeedAula.present = {
        start: start,
        stop: stop
    };
}(window));
