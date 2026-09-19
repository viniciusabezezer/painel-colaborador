/* InstaPensa — desenho do feed imitando a interface do Instagram.
   Cada post é o print que o professor subiu (o print já traz perfil, curtidas
   e legenda da publicação original), com uma barra de curtir e o botão de
   cérebro embaixo. Usado na pré-visualização do editor e na projeção em sala.
   É só interface: não há login, nem envio de dados, nem conexão com a rede
   social de verdade. */
(function (global) {
    'use strict';

    function esc(text) {
        return String(text === null || typeof text === 'undefined' ? '' : text)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

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

    /* Um post é o print que o professor subiu. O print já traz o perfil, as
       curtidas e a legenda da publicação original, então aqui embaixo ficam só
       as duas coisas que são da aula: curtir e abrir a reflexão. */
    function postHtml(post, index, opts) {
        const media = post.media || [];
        const hasCarousel = media.length > 1;

        let html = '<article class="ig-post" data-post-id="' + esc(post.id) + '" data-index="' + index + '">';

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
            '<button class="ig-icon-btn ig-like' + (post.liked ? ' is-on' : '') +
            '" type="button" aria-pressed="' + (post.liked ? 'true' : 'false') +
            '" aria-label="Curtir o post ' + (index + 1) + '">' + ICON.heart + '</button>' +
            '<span class="ig-actions__gap"></span>';
        if (hasCarousel) {
            html += '<span class="ig-dots">' + media.map(function (_, i) {
                return '<i class="ig-dot' + (i === 0 ? ' is-on' : '') + '"></i>';
            }).join('') + '</span><span class="ig-actions__gap"></span>';
        }
        html += '<button class="ig-icon-btn ig-reflect" type="button" aria-label="Abrir reflexão do post ' + (index + 1) + '" title="Refletir sobre esta postagem" aria-haspopup="dialog">' +
            '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5a3 3 0 0 0-5.8-1A4 4 0 0 0 3 10a4 4 0 0 0 1 7 4 4 0 0 0 8 2V5Zm0 0a3 3 0 0 1 5.8-1A4 4 0 0 1 21 10a4 4 0 0 1-1 7 4 4 0 0 1-8 2"/><path d="M7 4v3m-4 3h3l2 2m-4 5h3l1-2m9-11v3m4 3h-3l-2 2m4 5h-3l-1-2"/></svg></button>' +
            '</div>';

        html += '</article>';

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

    function bottomNavHtml() {
        return '<nav class="ig-bottomnav">' +
            '<button class="ig-icon-btn is-on" type="button" aria-label="Início">' + ICON.home + '</button>' +
            '<button class="ig-icon-btn" type="button" aria-label="Buscar">' + ICON.search + '</button>' +
            '<button class="ig-icon-btn" type="button" aria-label="Reels">' + ICON.reels + '</button>' +
            '<button class="ig-icon-btn" type="button" aria-label="Loja">' + ICON.shop + '</button>' +
            '<span class="ig-bottomnav__me">' +
            '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8.4" r="3.6"/>' +
            '<path d="M4.8 20.4a7.2 7.2 0 0 1 14.4 0"/></svg></span>' +
            '</nav>';
    }

    /* ===== Montagem ===== */

    /* Devolve o elemento do feed pronto. Chame FeedAula.media.warm(feed) antes,
       para as mídias locais já estarem em cache. */
    function render(feed, options) {
        const opts = Object.assign({
            interactive: true,
            onPostChange: null,
            onLike: null
        }, options || {});
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
            (profile.showBottomNav === false ? '' : bottomNavHtml());

        const scroll = root.querySelector('.ig-scroll');
        wireMedia(root);
        if (opts.interactive) wireInteractions(root, feed, opts);
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
        /* O print manda na altura: nada de recortar a publicação do professor.
           O limite largo só evita uma imagem degenerada esticar o feed. */
        const ratio = Math.min(3, Math.max(0.34, width / height));
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

    function wireInteractions(root, feed, opts) {
        root.addEventListener('click', function (event) {
            const reflect = event.target.closest('.ig-reflect');
            if (reflect) {
                const index = Number(reflect.closest('.ig-post').dataset.index);
                global.FeedAula.reflection.open(feed.posts[index], index, reflect);
                return;
            }
            const likeBtn = event.target.closest('.ig-like');
            if (likeBtn) {
                toggleLike(likeBtn.closest('.ig-post'), !likeBtn.classList.contains('is-on'), opts);
                return;
            }

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
                const postEl = media.closest('.ig-post');
                const btn = postEl.querySelector('.ig-like');
                if (!btn.classList.contains('is-on')) toggleLike(postEl, true, opts);
                popHeart(media);
            });
        });

        root.querySelectorAll('.ig-track').forEach(function (track) {
            track.addEventListener('scroll', function () { syncDots(track); }, { passive: true });
        });
    }

    function toggleLike(postEl, liked, opts) {
        const btn = postEl.querySelector('.ig-like');
        btn.classList.toggle('is-on', liked);
        btn.setAttribute('aria-pressed', liked ? 'true' : 'false');
        if (opts && opts.onLike) opts.onLike(Number(postEl.dataset.index), liked);
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
