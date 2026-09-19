/* InstaPensa — desenho do feed imitando a interface do Instagram.
   Usado nos dois lugares: na pré-visualização do editor e na projeção em sala.
   É só interface: não há login, nem envio de dados, nem conexão com a rede
   social de verdade. */
(function (global) {
    'use strict';

    function esc(text) {
        return String(text === null || typeof text === 'undefined' ? '' : text)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    /* Selo de verificado: círculo "serrilhado" como o do Instagram. */
    function badgePath() {
        const points = [];
        const teeth = 11;
        for (let i = 0; i < teeth * 2; i += 1) {
            const angle = (Math.PI * i) / teeth - Math.PI / 2;
            const radius = i % 2 === 0 ? 12 : 9.6;
            points.push([
                (12 + radius * Math.cos(angle)).toFixed(2),
                (12 + radius * Math.sin(angle)).toFixed(2)
            ].join(','));
        }
        return 'M' + points.join('L') + 'Z';
    }
    const BADGE_PATH = badgePath();

    const ICON = {
        heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.7C10.4 19.6 3 14.7 3 9.9 3 7 5.2 4.8 8 4.8c1.7 0 3.2.9 4 2.2.8-1.3 2.3-2.2 4-2.2 2.8 0 5 2.2 5 5.1 0 4.8-7.4 9.7-9 10.8z"/></svg>',
        comment: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.3c-5 0-9 3.5-9 7.9 0 2.4 1.2 4.6 3.2 6.1l-1.1 4 4.3-2.1c.8.2 1.7.3 2.6.3 5 0 9-3.5 9-7.9s-4-8.3-9-8.3z"/></svg>',
        send: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21.6 3.1 2.9 9.9c-.8.3-.8 1.4 0 1.6l7 2.1 2.1 7c.3.8 1.4.8 1.7 0l6.8-18.7c.3-.7-.4-1.3-.9-.8z"/><path d="M21.4 3.2 9.9 13.6" /></svg>',
        bookmark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12a.9.9 0 0 1 .9 1v17.1L12 17.3l-6.9 3.8V4A.9.9 0 0 1 6 3z"/></svg>',
        more: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="18" cy="12" r="1.6"/></svg>',
        home: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 10.2 12 3.4l8.5 6.8V21h-6v-6h-5v6h-6z"/></svg>',
        search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.6" cy="10.6" r="7"/><path d="M15.8 15.8 21 21"/></svg>',
        reels: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><path d="M3.5 8.5h17M9 3.3 12.4 8.5M15.4 3.3 18.8 8.5"/><path d="M10.4 12.2 15 14.8l-4.6 2.6z" class="ig-ico-fill"/></svg>',
        shop: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h16l-1.3 12.5H5.3z"/><path d="M8.5 8V6.6a3.5 3.5 0 0 1 7 0V8"/></svg>',
        verified: '<svg viewBox="0 0 24 24" class="ig-verified" aria-label="Verificado"><path d="' + BADGE_PATH + '" fill="#0095F6"/><path d="M10.6 15.4 7.4 12.2l1.3-1.3 1.9 1.9 4.7-4.7 1.3 1.3z" fill="#fff"/></svg>',
        camera: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="1.1" class="ig-ico-fill"/></svg>'
    };

    function el(html) {
        const wrap = document.createElement('div');
        wrap.innerHTML = html.trim();
        return wrap.firstElementChild;
    }

    function initials(name) {
        const parts = String(name || '').replace(/[^\p{L}\p{N} ]/gu, ' ').trim().split(/\s+/);
        if (!parts[0]) return '?';
        if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }

    /* Cor estável a partir do nome, para o avatar sem foto. */
    function hueOf(name) {
        let hash = 0;
        const text = String(name || 'feed');
        for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) % 360;
        return hash;
    }

    function avatarHtml(author, size) {
        const url = global.FeedAula.media.refUrl({ mediaId: author.avatarMediaId, url: author.avatarUrl });
        const name = author.username || author.displayName || '';
        if (url) {
            return '<span class="ig-avatar" style="--s:' + size + 'px">' +
                '<img src="' + esc(url) + '" alt="" loading="lazy"></span>';
        }
        return '<span class="ig-avatar ig-avatar--letters" style="--s:' + size + 'px;--hue:' +
            hueOf(name) + '">' + esc(initials(name)) + '</span>';
    }

    function username(author) {
        return author.username || 'perfil.sem.nome';
    }

    /* Legenda: escapa tudo e só depois destaca #hashtags e @perfis. */
    function captionHtml(text) {
        return esc(text)
            .replace(/(^|\s)(#[\p{L}\p{N}_]+)/gu, '$1<span class="ig-tag">$2</span>')
            .replace(/(^|\s)(@[\p{L}\p{N}_.]+)/gu, '$1<span class="ig-tag">$2</span>')
            .replace(/\n/g, '<br>');
    }

    function likesHtml(post) {
        const count = (post.likesCount || '').trim();
        const by = (post.likedBy || '').trim();
        if (!count && !by) return '';
        if (by && count) {
            return 'Curtido por <b>' + esc(by) + '</b> e outras <b>' + esc(count) + ' pessoas</b>';
        }
        if (by) return 'Curtido por <b>' + esc(by) + '</b>';
        return '<b>' + esc(count) + '</b>';
    }

    function mediaSlideHtml(item, index, interactive) {
        const url = global.FeedAula.media.refUrl(item);
        if (!url) {
            return '<div class="ig-slide ig-slide--empty" data-slide="' + index + '">' +
                ICON.camera + '<span>Sem mídia</span></div>';
        }
        if (item.kind === 'video') {
            return '<div class="ig-slide" data-slide="' + index + '">' +
                '<video class="ig-video" src="' + esc(url) + '" playsinline muted loop preload="metadata"' +
                (interactive ? '' : ' controls') + '></video>' +
                '<button class="ig-mute" type="button" aria-label="Som">' +
                '<span class="ig-mute__off">🔇</span><span class="ig-mute__on">🔊</span></button>' +
                '</div>';
        }
        return '<div class="ig-slide" data-slide="' + index + '">' +
            '<img class="ig-img" src="' + esc(url) + '" alt="' + esc(item.alt) + '" loading="lazy">' +
            '</div>';
    }

    function postHtml(post, index, opts) {
        const author = post.author || {};
        const media = post.media || [];
        const comments = post.comments || [];
        const hasCarousel = media.length > 1;
        const caption = (post.caption || '').trim();
        const likes = likesHtml(post);
        const total = (post.commentsTotal || '').trim();

        let html = '<article class="ig-post" data-post-id="' + esc(post.id) + '" data-index="' + index + '">';

        html += '<header class="ig-post__head">' +
            avatarHtml(author, 32) +
            '<div class="ig-post__who">' +
            '<span class="ig-post__user">' + esc(username(author)) +
            (author.verified ? ICON.verified : '') + '</span>' +
            (post.sponsored
                ? '<span class="ig-post__meta">Patrocinado</span>'
                : (post.location ? '<span class="ig-post__meta">' + esc(post.location) + '</span>' : '')) +
            '</div>' +
            '<button class="ig-icon-btn ig-post__more" type="button" aria-label="Mais">' + ICON.more + '</button>' +
            '</header>';

        html += '<div class="ig-media' + (hasCarousel ? ' ig-media--carousel' : '') + '">' +
            '<div class="ig-track">' +
            (media.length ? media.map(function (item, i) {
                return mediaSlideHtml(item, i, opts.interactive);
            }).join('') : mediaSlideHtml({}, 0, opts.interactive)) +
            '</div>' +
            '<span class="ig-heart-pop" aria-hidden="true">' + ICON.heart + '</span>';
        if (hasCarousel) {
            html += '<span class="ig-counter">1/' + media.length + '</span>' +
                '<button class="ig-nav ig-nav--prev" type="button" aria-label="Anterior"></button>' +
                '<button class="ig-nav ig-nav--next" type="button" aria-label="Próxima"></button>';
        }
        html += '</div>';

        html += '<div class="ig-actions">' +
            '<button class="ig-icon-btn ig-like" type="button" aria-label="Curtir">' + ICON.heart + '</button>' +
            '<button class="ig-icon-btn" type="button" aria-label="Comentar">' + ICON.comment + '</button>' +
            '<button class="ig-icon-btn" type="button" aria-label="Compartilhar">' + ICON.send + '</button>' +
            '<span class="ig-actions__gap"></span>';
        if (hasCarousel) {
            html += '<span class="ig-dots">' + media.map(function (_, i) {
                return '<i class="ig-dot' + (i === 0 ? ' is-on' : '') + '"></i>';
            }).join('') + '</span><span class="ig-actions__gap"></span>';
        }
        html += '<button class="ig-icon-btn ig-save" type="button" aria-label="Salvar">' + ICON.bookmark + '</button>' +
            '</div>';

        html += '<div class="ig-body">';
        if (likes) html += '<p class="ig-likes">' + likes + '</p>';
        if (caption) {
            html += '<p class="ig-caption is-clamped"><b>' + esc(username(author)) + '</b> ' +
                captionHtml(caption) + '</p>';
        }
        if (total) {
            html += '<button class="ig-comments-all" type="button">Ver todos os ' + esc(total) + ' comentários</button>';
        }
        comments.forEach(function (comment) {
            if (!comment.text && !comment.user) return;
            html += '<p class="ig-comment"><b>' + esc(comment.user || 'alguem') + '</b> ' +
                captionHtml(comment.text) +
                (comment.likes ? '<span class="ig-comment__likes">' + esc(comment.likes) + ' curtidas</span>' : '') +
                '</p>';
        });
        if (post.time) html += '<p class="ig-time">' + esc(post.time) + '</p>';
        html += '</div></article>';

        return html;
    }

    function storiesHtml(feed) {
        const stories = (feed.stories || []).filter(function (s) {
            return s.label || s.mediaId || s.url;
        });
        if (!stories.length) return '';
        return '<div class="ig-stories">' + stories.map(function (story) {
            const url = global.FeedAula.media.refUrl(story);
            const inner = url
                ? '<img src="' + esc(url) + '" alt="" loading="lazy">'
                : '<span class="ig-story__letters" style="--hue:' + hueOf(story.label) + '">' +
                  esc(initials(story.label)) + '</span>';
            return '<div class="ig-story' + (story.seen ? ' is-seen' : '') + '">' +
                '<span class="ig-story__ring"><span class="ig-story__inner">' + inner + '</span></span>' +
                '<span class="ig-story__label">' + esc(story.label || '') + '</span></div>';
        }).join('') + '</div>';
    }

    function topBarHtml(feed) {
        const brand = (feed.profile && feed.profile.brand) || '';
        return '<header class="ig-topbar">' +
            '<span class="ig-brand">' + esc(brand) + '</span>' +
            '<span class="ig-topbar__icons">' +
            '<button class="ig-icon-btn" type="button" aria-label="Curtidas">' + ICON.heart + '</button>' +
            '<button class="ig-icon-btn" type="button" aria-label="Mensagens">' + ICON.send +
            '<span class="ig-badge-count">3</span></button>' +
            '</span></header>';
    }

    function bottomNavHtml(feed) {
        const first = (feed.posts || [])[0] || global.FeedAula.model.newPost();
        return '<nav class="ig-bottomnav">' +
            '<button class="ig-icon-btn is-on" type="button" aria-label="Início">' + ICON.home + '</button>' +
            '<button class="ig-icon-btn" type="button" aria-label="Buscar">' + ICON.search + '</button>' +
            '<button class="ig-icon-btn" type="button" aria-label="Reels">' + ICON.reels + '</button>' +
            '<button class="ig-icon-btn" type="button" aria-label="Loja">' + ICON.shop + '</button>' +
            '<span class="ig-bottomnav__me">' + avatarHtml(first.author || {}, 26) + '</span>' +
            '</nav>';
    }

    /* ===== Montagem ===== */

    /* Devolve o elemento do feed pronto. Chame FeedAula.media.warm(feed) antes,
       para as mídias locais já estarem em cache. */
    function render(feed, options) {
        const opts = Object.assign({ interactive: true, onPostChange: null }, options || {});
        const profile = feed.profile || {};
        const root = el('<div class="ig ig--' + (profile.theme === 'dark' ? 'dark' : 'light') + '"></div>');

        root.innerHTML =
            topBarHtml(feed) +
            '<div class="ig-scroll">' +
            (profile.showStories === false ? '' : storiesHtml(feed)) +
            '<div class="ig-posts">' +
            (feed.posts || []).map(function (post, i) { return postHtml(post, i, opts); }).join('') +
            '</div>' +
            '<div class="ig-end">Você viu todas as publicações</div>' +
            '</div>' +
            (profile.showBottomNav === false ? '' : bottomNavHtml(feed));

        const scroll = root.querySelector('.ig-scroll');
        wireMedia(root);
        setupCaptions(root);
        if (opts.interactive) wireInteractions(root);
        wireVideos(root, scroll);
        if (opts.onPostChange) watchCurrentPost(root, scroll, opts.onPostChange);

        root.feedApi = {
            scroll: scroll,
            posts: Array.prototype.slice.call(root.querySelectorAll('.ig-post')),
            goTo: function (index) { goTo(root, index); },
            currentIndex: function () { return currentIndex(root, scroll); },
            pauseVideos: function () { pauseVideos(root); }
        };
        return root;
    }

    /* Proporção da mídia como no Instagram: entre retrato 4:5 e paisagem 1.91:1. */
    function fitSlide(slide, width, height) {
        if (!width || !height) return;
        const ratio = Math.min(1.91, Math.max(0.8, width / height));
        slide.style.setProperty('--ratio', ratio.toFixed(4));
        const media = slide.closest('.ig-media');
        if (media && !media.style.getPropertyValue('--ratio')) {
            media.style.setProperty('--ratio', ratio.toFixed(4));
        }
    }

    function wireMedia(root) {
        root.querySelectorAll('.ig-img').forEach(function (img) {
            const apply = function () { fitSlide(img.parentElement, img.naturalWidth, img.naturalHeight); };
            if (img.complete && img.naturalWidth) apply();
            else img.addEventListener('load', apply);
            img.addEventListener('error', function () {
                img.parentElement.classList.add('ig-slide--broken');
            });
        });
        root.querySelectorAll('.ig-video').forEach(function (video) {
            video.addEventListener('loadedmetadata', function () {
                fitSlide(video.parentElement, video.videoWidth, video.videoHeight);
            });
            video.addEventListener('error', function () {
                video.parentElement.classList.add('ig-slide--broken');
            });
        });
    }

    /* Legenda longa: o Instagram corta em duas linhas e encosta "… mais" no fim
       do texto. Para isso é preciso medir com a legenda já na tela e ir tirando
       palavras até o conjunto (texto + botão) caber nas duas linhas. */
    const FULL_CAPTIONS = new WeakMap();

    function setupCaptions(root) {
        const check = function () {
            if (!root.isConnected) {
                global.requestAnimationFrame(check);
                return;
            }
            root.querySelectorAll('.ig-caption.is-clamped').forEach(prepareCaption);
        };
        global.requestAnimationFrame(check);
    }

    function prepareCaption(caption) {
        if (FULL_CAPTIONS.has(caption)) return;
        if (!overflows(caption)) {
            caption.classList.remove('is-clamped');
            return;
        }
        FULL_CAPTIONS.set(caption, caption.innerHTML);
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'ig-more-link';
        button.textContent = '… mais';
        caption.appendChild(button);
        trimToFit(caption);
    }

    function overflows(node) {
        return node.scrollHeight > node.clientHeight + 1;
    }

    function trimToFit(caption) {
        const walker = document.createTreeWalker(caption, NodeFilter.SHOW_TEXT, null);
        const nodes = [];
        while (walker.nextNode()) {
            const node = walker.currentNode;
            if (!node.parentElement.closest('.ig-more-link')) nodes.push(node);
        }
        for (let i = nodes.length - 1; i >= 0; i -= 1) {
            const node = nodes[i];
            const parts = node.nodeValue.split(/(\s+)/);
            while (parts.length && overflows(caption)) {
                parts.pop();
                node.nodeValue = parts.join('');
            }
            if (!overflows(caption)) return;
            node.nodeValue = '';
        }
    }

    function wireInteractions(root) {
        root.addEventListener('click', function (event) {
            const likeBtn = event.target.closest('.ig-like');
            if (likeBtn) { toggleLike(likeBtn.closest('.ig-post'), likeBtn.classList.contains('is-on') ? -1 : 1); return; }

            const saveBtn = event.target.closest('.ig-save');
            if (saveBtn) { saveBtn.classList.toggle('is-on'); return; }

            const moreLink = event.target.closest('.ig-more-link');
            if (moreLink) {
                const caption = moreLink.parentElement;
                if (FULL_CAPTIONS.has(caption)) caption.innerHTML = FULL_CAPTIONS.get(caption);
                caption.classList.remove('is-clamped');
                return;
            }

            const commentsAll = event.target.closest('.ig-comments-all');
            if (commentsAll) { commentsAll.closest('.ig-post').classList.add('is-comments-open'); return; }

            const mute = event.target.closest('.ig-mute');
            if (mute) {
                const video = mute.parentElement.querySelector('.ig-video');
                video.muted = !video.muted;
                mute.classList.toggle('is-on', !video.muted);
                if (!video.muted) video.play().catch(function () {});
                return;
            }

            const nav = event.target.closest('.ig-nav');
            if (nav) {
                slide(nav.closest('.ig-media'), nav.classList.contains('ig-nav--next') ? 1 : -1);
                return;
            }

            const slideEl = event.target.closest('.ig-slide');
            if (slideEl && slideEl.querySelector('.ig-video')) {
                const video = slideEl.querySelector('.ig-video');
                if (video.paused) video.play().catch(function () {}); else video.pause();
            }
        });

        /* Duplo clique/toque curte, como no app. */
        root.querySelectorAll('.ig-media').forEach(function (media) {
            media.addEventListener('dblclick', function () {
                const post = media.closest('.ig-post');
                const btn = post.querySelector('.ig-like');
                if (!btn.classList.contains('is-on')) toggleLike(post, 1);
                popHeart(media);
            });
        });

        root.querySelectorAll('.ig-track').forEach(function (track) {
            track.addEventListener('scroll', function () { syncDots(track); }, { passive: true });
        });
    }

    function toggleLike(post, direction) {
        const btn = post.querySelector('.ig-like');
        btn.classList.toggle('is-on', direction > 0);
        /* O número de curtidas é o último <b> da linha ("Curtido por X e outras N"). */
        const bolds = post.querySelectorAll('.ig-likes b');
        const likes = bolds[bolds.length - 1];
        if (!likes) return;
        const raw = likes.textContent.replace(/\./g, '').replace(/\s/g, '');
        const number = parseInt(raw, 10);
        if (!isNaN(number)) {
            likes.textContent = (number + direction).toLocaleString('pt-BR');
        }
    }

    function popHeart(media) {
        const pop = media.querySelector('.ig-heart-pop');
        if (!pop) return;
        pop.classList.remove('is-on');
        void pop.offsetWidth;
        pop.classList.add('is-on');
    }

    function slide(media, direction) {
        const track = media.querySelector('.ig-track');
        track.scrollBy({ left: direction * track.clientWidth, behavior: 'smooth' });
    }

    function syncDots(track) {
        const media = track.closest('.ig-media');
        const index = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
        const dots = media.parentElement.querySelectorAll('.ig-dot');
        dots.forEach(function (dot, i) { dot.classList.toggle('is-on', i === index); });
        const counter = media.querySelector('.ig-counter');
        if (counter) counter.textContent = (index + 1) + '/' + track.children.length;
    }

    /* Vídeo toca sozinho, sem som, quando entra na tela — e para ao sair. */
    function wireVideos(root, scroll) {
        const videos = root.querySelectorAll('.ig-video');
        if (!videos.length || !global.IntersectionObserver) return;
        const observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                const video = entry.target;
                if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
                    video.play().catch(function () {});
                } else {
                    video.pause();
                }
            });
        }, { root: scroll, threshold: [0, 0.6, 1] });
        videos.forEach(function (video) { observer.observe(video); });
    }

    function pauseVideos(root) {
        root.querySelectorAll('.ig-video').forEach(function (video) { video.pause(); });
    }

    /* Distância do topo do post até o topo da área de rolagem. */
    function topOf(node, scroll) {
        return node.getBoundingClientRect().top - scroll.getBoundingClientRect().top + scroll.scrollTop;
    }

    function currentIndex(root, scroll) {
        const posts = root.querySelectorAll('.ig-post');
        const middle = scroll.scrollTop + scroll.clientHeight * 0.35;
        let index = 0;
        posts.forEach(function (post, i) {
            if (topOf(post, scroll) <= middle) index = i;
        });
        return index;
    }

    function watchCurrentPost(root, scroll, callback) {
        let last = -1;
        const check = function () {
            const index = currentIndex(root, scroll);
            if (index !== last) {
                last = index;
                callback(index);
            }
        };
        scroll.addEventListener('scroll', function () {
            global.requestAnimationFrame(check);
        }, { passive: true });
        global.requestAnimationFrame(check);
    }

    function goTo(root, index) {
        const posts = root.querySelectorAll('.ig-post');
        const scroll = root.querySelector('.ig-scroll');
        const target = posts[Math.max(0, Math.min(posts.length - 1, index))];
        if (!target) return;
        scroll.scrollTo({ top: Math.max(0, topOf(target, scroll) - 2), behavior: 'smooth' });
    }

    global.FeedAula = global.FeedAula || {};
    global.FeedAula.feed = {
        render: render,
        esc: esc
    };
}(window));
