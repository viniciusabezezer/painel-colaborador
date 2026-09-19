/* Feed da Aula — formato dos dados.
   Um "feed" é a aula inteira: identidade do perfil + os posts na ordem em que
   serão rolados + o material didático que o professor amarra em cada post. */
(function (global) {
    'use strict';

    const FORMAT = 'feed-aula/v1';

    function uid(prefix) {
        return (prefix || 'id') + '-' + Date.now().toString(36) + '-' +
            Math.random().toString(36).slice(2, 8);
    }

    function newComment(user, text) {
        return { user: user || '', text: text || '', likes: '' };
    }

    function newMedia(kind) {
        return { id: uid('m'), kind: kind || 'image', mediaId: '', url: '', alt: '' };
    }

    function newPost() {
        return {
            id: uid('p'),
            author: { username: '', displayName: '', avatarMediaId: '', avatarUrl: '', verified: false },
            location: '',
            media: [],
            caption: '',
            likesCount: '',
            likedBy: '',
            time: '',
            comments: [],
            commentsTotal: '',
            sponsored: false,
            material: { title: '', text: '', questions: [], links: [] }
        };
    }

    function newFeed(name) {
        const feed = {
            format: FORMAT,
            id: uid('feed'),
            name: name || 'Feed sem título',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            profile: {
                brand: 'Instagram',
                showStories: true,
                showBottomNav: true,
                theme: 'light'
            },
            stories: [],
            posts: [newPost()]
        };
        return feed;
    }

    /* Aceita feeds vindos de arquivo (importação) ou de versões anteriores e
       devolve um objeto completo, sem campos faltando. */
    function migrate(raw) {
        const base = newFeed();
        const feed = Object.assign({}, base, raw || {});
        feed.format = FORMAT;
        feed.id = raw && raw.id ? raw.id : base.id;
        feed.name = str(feed.name) || 'Feed sem título';
        feed.profile = Object.assign({}, base.profile, feed.profile || {});
        feed.profile.brand = str(feed.profile.brand);
        feed.profile.theme = feed.profile.theme === 'dark' ? 'dark' : 'light';
        feed.stories = Array.isArray(feed.stories) ? feed.stories.map(migrateStory) : [];
        feed.posts = Array.isArray(feed.posts) && feed.posts.length
            ? feed.posts.map(migratePost)
            : [newPost()];
        return feed;
    }

    function migrateStory(raw) {
        return {
            id: raw && raw.id ? raw.id : uid('s'),
            label: str(raw && raw.label),
            mediaId: str(raw && raw.mediaId),
            url: str(raw && raw.url),
            seen: !!(raw && raw.seen)
        };
    }

    function migratePost(raw) {
        const post = Object.assign(newPost(), raw || {});
        post.id = raw && raw.id ? raw.id : uid('p');
        post.author = Object.assign(newPost().author, (raw && raw.author) || {});
        post.author.username = str(post.author.username);
        post.author.displayName = str(post.author.displayName);
        post.author.verified = !!post.author.verified;
        post.location = str(post.location);
        post.caption = str(post.caption);
        post.likesCount = str(post.likesCount);
        post.likedBy = str(post.likedBy);
        post.time = str(post.time);
        post.commentsTotal = str(post.commentsTotal);
        post.sponsored = !!post.sponsored;
        post.media = (Array.isArray(post.media) ? post.media : []).map(function (m) {
            return {
                id: m && m.id ? m.id : uid('m'),
                kind: m && m.kind === 'video' ? 'video' : 'image',
                mediaId: str(m && m.mediaId),
                url: str(m && m.url),
                alt: str(m && m.alt)
            };
        });
        post.comments = (Array.isArray(post.comments) ? post.comments : []).map(function (c) {
            return { user: str(c && c.user), text: str(c && c.text), likes: str(c && c.likes) };
        });
        const material = Object.assign({ title: '', text: '', questions: [], links: [] }, post.material || {});
        post.material = {
            title: str(material.title),
            text: str(material.text),
            questions: (Array.isArray(material.questions) ? material.questions : [])
                .map(str).filter(function (q) { return q.trim() !== ''; }),
            links: (Array.isArray(material.links) ? material.links : []).map(function (l) {
                return { label: str(l && l.label), url: str(l && l.url) };
            }).filter(function (l) { return l.url.trim() !== ''; })
        };
        return post;
    }

    function str(value) {
        if (value === null || typeof value === 'undefined') return '';
        return String(value);
    }

    /* Todas as mídias guardadas no IndexedDB que este feed referencia. */
    function mediaIdsOf(feed) {
        const ids = [];
        if (!feed) return ids;
        (feed.stories || []).forEach(function (s) { if (s.mediaId) ids.push(s.mediaId); });
        (feed.posts || []).forEach(function (post) {
            if (post.author && post.author.avatarMediaId) ids.push(post.author.avatarMediaId);
            (post.media || []).forEach(function (m) { if (m.mediaId) ids.push(m.mediaId); });
        });
        return ids;
    }

    function duplicate(feed, name) {
        const copy = migrate(JSON.parse(JSON.stringify(feed)));
        copy.id = uid('feed');
        copy.name = name || (feed.name + ' (cópia)');
        copy.createdAt = Date.now();
        copy.updatedAt = Date.now();
        return copy;
    }

    /* Nome de arquivo amigável para exportação. */
    function slug(text) {
        return str(text).normalize('NFD').replace(/[̀-ͯ]/g, '')
            .toLowerCase().replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '').slice(0, 60) || 'feed-da-aula';
    }

    function postLabel(post, index) {
        const material = post.material || {};
        if (material.title && material.title.trim()) return material.title.trim();
        if (post.caption && post.caption.trim()) {
            const line = post.caption.trim().split('\n')[0];
            return line.length > 48 ? line.slice(0, 48) + '…' : line;
        }
        return 'Post ' + (index + 1);
    }

    global.FeedAula = global.FeedAula || {};
    global.FeedAula.model = {
        FORMAT: FORMAT,
        uid: uid,
        newFeed: newFeed,
        newPost: newPost,
        newMedia: newMedia,
        newComment: newComment,
        migrate: migrate,
        mediaIdsOf: mediaIdsOf,
        duplicate: duplicate,
        slug: slug,
        postLabel: postLabel
    };
}(window));
