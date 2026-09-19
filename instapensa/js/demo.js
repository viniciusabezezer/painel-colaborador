/* InstaPensa — feed de exemplo.
   Serve para o professor ver a dinâmica funcionando antes de montar o dele.
   Como no uso real cada post é um print de uma publicação, as imagens daqui
   são desenhadas (SVG) imitando um print: barra de status, perfil, foto,
   curtidas, legenda e comentários dentro da própria imagem. Assim o exemplo
   não depende de internet nem de arquivo nenhum. */
(function (global) {
    'use strict';

    const W = 1080;
    const FONT = 'Helvetica,Arial,sans-serif';

    function esc(text) {
        return String(text === null || typeof text === 'undefined' ? '' : text)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    /* Quebra o texto em linhas de no máximo `max` caracteres. */
    function wrap(text, max, limit) {
        const words = String(text).split(/\s+/);
        const lines = [];
        let line = '';
        words.forEach(function (word) {
            const candidate = line ? line + ' ' + word : word;
            if (candidate.length > max && line) {
                lines.push(line);
                line = word;
            } else {
                line = candidate;
            }
        });
        if (line) lines.push(line);
        if (limit && lines.length > limit) {
            const kept = lines.slice(0, limit);
            kept[limit - 1] = kept[limit - 1].replace(/\s+\S*$/, '') + '… mais';
            return kept;
        }
        return lines;
    }

    function lines(text, x, y, step, size, fill, weight, max, limit) {
        return wrap(text, max, limit).map(function (line, i) {
            return '<text x="' + x + '" y="' + (y + i * step) + '" font-family="' + FONT +
                '" font-size="' + size + '" fill="' + fill + '"' +
                (weight ? ' font-weight="' + weight + '"' : '') + '>' + esc(line) + '</text>';
        }).join('');
    }

    function hueOf(name) {
        let hash = 0;
        for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) % 360;
        return hash;
    }

    function initials(name) {
        const parts = String(name).replace(/[^\p{L}\p{N} ]/gu, ' ').trim().split(/\s+/);
        if (!parts[0]) return '?';
        return (parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }

    function statusBar(y) {
        return '<text x="60" y="' + (y + 42) + '" font-family="' + FONT + '" font-size="34" font-weight="bold" fill="#262626">9:41</text>' +
            '<rect x="900" y="' + (y + 16) + '" width="52" height="26" rx="6" fill="#262626" opacity=".85"/>' +
            '<rect x="966" y="' + (y + 14) + '" width="54" height="30" rx="8" fill="none" stroke="#262626" stroke-width="4" opacity=".85"/>' +
            '<rect x="972" y="' + (y + 20) + '" width="34" height="18" rx="3" fill="#262626" opacity=".85"/>';
    }

    function header(y, username, verified, meta) {
        const hue = hueOf(username);
        let out = '<circle cx="110" cy="' + (y + 62) + '" r="52" fill="hsl(' + hue + ',62%,52%)"/>' +
            '<text x="110" y="' + (y + 80) + '" text-anchor="middle" font-family="' + FONT +
            '" font-size="42" font-weight="bold" fill="#ffffff">' + esc(initials(username)) + '</text>' +
            '<text x="186" y="' + (y + (meta ? 52 : 74)) + '" font-family="' + FONT +
            '" font-size="38" font-weight="bold" fill="#262626">' + esc(username) + '</text>';
        if (verified) {
            const x = 186 + username.length * 20 + 16;
            out += '<circle cx="' + x + '" cy="' + (y + (meta ? 40 : 62)) + '" r="17" fill="#0095F6"/>' +
                '<path d="M' + (x - 8) + ' ' + (y + (meta ? 40 : 62)) + ' l6 6 11 -12" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>';
        }
        if (meta) {
            out += '<text x="186" y="' + (y + 96) + '" font-family="' + FONT +
                '" font-size="30" fill="#262626" opacity=".85">' + esc(meta) + '</text>';
        }
        out += '<g fill="#262626"><circle cx="965" cy="' + (y + 62) + '" r="7"/><circle cx="995" cy="' + (y + 62) + '" r="7"/><circle cx="1025" cy="' + (y + 62) + '" r="7"/></g>';
        return out;
    }

    function photo(y, height, emoji, label, hue, index, total) {
        let out = '<defs><linearGradient id="g' + hue + index + '" x1="0" y1="0" x2="1" y2="1">' +
            '<stop offset="0" stop-color="hsl(' + hue + ',72%,62%)"/>' +
            '<stop offset="1" stop-color="hsl(' + ((hue + 45) % 360) + ',68%,38%)"/>' +
            '</linearGradient></defs>' +
            '<rect x="0" y="' + y + '" width="' + W + '" height="' + height + '" fill="url(#g' + hue + index + ')"/>' +
            '<circle cx="880" cy="' + (y + height * 0.22) + '" r="' + (W * 0.2) + '" fill="rgba(255,255,255,.12)"/>' +
            '<text x="540" y="' + (y + height * 0.52) + '" text-anchor="middle" font-size="' + Math.round(height * 0.3) + '">' + emoji + '</text>' +
            wrap(label, 26, 2).map(function (line, i) {
                return '<text x="540" y="' + (y + height * 0.76 + i * 54) + '" text-anchor="middle" font-family="' + FONT +
                    '" font-size="46" font-weight="bold" fill="#ffffff">' + esc(line) + '</text>';
            }).join('') +
            '<text x="540" y="' + (y + height * 0.86) + '" text-anchor="middle" font-family="' + FONT +
            '" font-size="28" fill="rgba(255,255,255,.75)">print de exemplo — troque pelo seu</text>';
        return out;
    }

    const GLYPH = {
        heart: 'M12 20.7C10.4 19.6 3 14.7 3 9.9 3 7 5.2 4.8 8 4.8c1.7 0 3.2.9 4 2.2.8-1.3 2.3-2.2 4-2.2 2.8 0 5 2.2 5 5.1 0 4.8-7.4 9.7-9 10.8z',
        comment: 'M12 3.3c-5 0-9 3.5-9 7.9 0 2.4 1.2 4.6 3.2 6.1l-1.1 4 4.3-2.1c.8.2 1.7.3 2.6.3 5 0 9-3.5 9-7.9s-4-8.3-9-8.3z',
        send: 'M21.6 3.1 2.9 9.9c-.8.3-.8 1.4 0 1.6l7 2.1 2.1 7c.3.8 1.4.8 1.7 0l6.8-18.7c.3-.7-.4-1.3-.9-.8z',
        bookmark: 'M6 3h12a.9.9 0 0 1 .9 1v17.1L12 17.3l-6.9 3.8V4A.9.9 0 0 1 6 3z'
    };

    /* Ícone de 24x24 colocado por translate/scale — nada de contas à mão. */
    function glyph(name, x, y, size) {
        const scale = (size / 24).toFixed(4);
        return '<g transform="translate(' + x + ',' + y + ') scale(' + scale + ')">' +
            '<path d="' + GLYPH[name] + '" fill="none" stroke="#262626" stroke-width="1.7" ' +
            'stroke-linecap="round" stroke-linejoin="round"/></g>';
    }

    function actions(y) {
        return glyph('heart', 40, y, 66) +
            glyph('comment', 140, y, 66) +
            glyph('send', 240, y, 66) +
            glyph('bookmark', 974, y, 66);
    }

    /* Print completo de uma publicação. */
    function print(opts) {
        const ratio = opts.ratio || 1;
        const photoH = Math.round(W / ratio);
        const captionLines = wrap(opts.username + ' ' + opts.caption, 44, 3);
        let y = 0;
        let body = '';

        body += statusBar(y); y += 64;
        body += header(y, opts.username, opts.verified, opts.meta); y += 132;
        body += photo(y, photoH, opts.emoji, opts.label, opts.hue, opts.index || 0, opts.total || 1);
        y += photoH + 26;
        body += actions(y); y += 100;
        body += '<text x="40" y="' + (y + 36) + '" font-family="' + FONT +
            '" font-size="36" font-weight="bold" fill="#262626">' + esc(opts.likes) + ' curtidas</text>';
        y += 80;
        body += captionLines.map(function (line, i) {
            if (i === 0) {
                /* A primeira linha começa com o perfil em negrito, como no app. */
                const rest = line.slice(opts.username.length);
                return '<text x="40" y="' + y + '" font-family="' + FONT +
                    '" font-size="36" fill="#262626"><tspan font-weight="bold">' +
                    esc(opts.username) + '</tspan>' + esc(rest) + '</text>';
            }
            return '<text x="40" y="' + (y + i * 50) + '" font-family="' + FONT +
                '" font-size="36" fill="#262626">' + esc(line) + '</text>';
        }).join('');
        y += (captionLines.length - 1) * 50 + 56;
        body += '<text x="40" y="' + y + '" font-family="' + FONT +
            '" font-size="34" fill="#8e8e8e">Ver todos os ' + esc(opts.comments) + ' comentários</text>';
        y += 58;
        if (opts.comment) {
            body += '<text x="40" y="' + y + '" font-family="' + FONT +
                '" font-size="34" fill="#262626"><tspan font-weight="bold">' + esc(opts.comment[0]) +
                '</tspan> ' + esc(opts.comment[1]) + '</text>';
            y += 56;
        }
        body += '<text x="40" y="' + y + '" font-family="' + FONT +
            '" font-size="30" fill="#8e8e8e">' + esc(opts.time) + '</text>';
        y += 46;

        const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + y +
            '" viewBox="0 0 ' + W + ' ' + y + '">' +
            '<rect width="' + W + '" height="' + y + '" fill="#ffffff"/>' + body + '</svg>';
        return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    }

    /* Print só dos comentários, para mostrar como fica um post com dois prints. */
    function printComments(opts) {
        let y = 0;
        let body = statusBar(y);
        y = 96;
        body += '<text x="40" y="' + (y + 40) + '" font-family="' + FONT +
            '" font-size="42" font-weight="bold" fill="#262626">Comentários</text>';
        y += 110;
        opts.comments.forEach(function (pair) {
            const hue = hueOf(pair[0]);
            body += '<circle cx="80" cy="' + (y + 30) + '" r="40" fill="hsl(' + hue + ',62%,52%)"/>' +
                '<text x="80" y="' + (y + 44) + '" text-anchor="middle" font-family="' + FONT +
                '" font-size="32" font-weight="bold" fill="#fff">' + esc(initials(pair[0])) + '</text>' +
                '<text x="148" y="' + (y + 22) + '" font-family="' + FONT +
                '" font-size="34" font-weight="bold" fill="#262626">' + esc(pair[0]) + '</text>' +
                lines(pair[1], 148, y + 70, 46, 34, '#262626', null, 34, 3) +
                '<text x="148" y="' + (y + 132) + '" font-family="' + FONT +
                '" font-size="28" fill="#8e8e8e">responder · curtir</text>';
            y += 190;
        });
        y += 40;
        const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + y +
            '" viewBox="0 0 ' + W + ' ' + y + '">' +
            '<rect width="' + W + '" height="' + y + '" fill="#ffffff"/>' + body + '</svg>';
        return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    }

    function media(url, alt) {
        return { kind: 'image', mediaId: '', url: url, alt: alt };
    }

    const POSTS = [
        {
            print: {
                username: 'passostenis.oficial', verified: true, meta: 'Patrocinado',
                emoji: '👟', label: 'LANÇAMENTO', hue: 12, ratio: 1,
                likes: '12.487', comments: '834', time: 'há 2 horas',
                caption: 'Ele chegou. O tênis que todo mundo vai querer usar essa semana. Link na bio 👟✨ #novidade #corra #edicaolimitada',
                comment: ['ana.vitoria21', 'preciso desse 😍']
            },
            extra: {
                comments: [
                    ['ana.vitoria21', 'preciso desse 😍'],
                    ['lucas.sk8', 'quanto custa? a marca nunca responde'],
                    ['passostenis.oficial', 'chama no direct que a gente te ajuda 💙'],
                    ['duda.correr', 'comprei ontem e chegou rápido']
                ]
            },
            material: {
                title: 'Post 1 — Publicidade disfarçada de novidade',
                text: 'Esta publicação é um anúncio — e avisa isso em letra miúda, embaixo do nome do perfil: "Patrocinado". Repare no que ela faz em poucos segundos: cria urgência ("só hoje"), promete pertencimento ("todo mundo vai usar") e esconde a informação mais concreta — o preço.',
                questions: [
                    'Quem vê esse post sabe que é anúncio? Onde está escrito?',
                    'Que palavras do post criam pressa? Por que a pressa ajuda quem está vendendo?',
                    'A que grupo o post promete que você vai pertencer se comprar?',
                    'Qual informação importante ficou de fora da publicação?'
                ],
                links: []
            }
        },
        {
            print: {
                username: 'vida.em.movimento', verified: false, meta: 'Academia Central',
                emoji: '💪', label: 'ANTES & DEPOIS', hue: 200, ratio: 0.8,
                likes: '5.302', comments: '412', time: 'há 5 horas',
                caption: 'Foram 90 dias de disciplina. Sem desculpa, sem atalho. Quem quiser a minha rotina, chama no direct 💪 #foco #transformacao',
                comment: ['marinasp', 'que inspiração! me sinto um fracasso perto disso']
            },
            material: {
                title: 'Post 2 — O corpo como vitrine',
                text: 'Fotos de "antes e depois" mostram dois instantes escolhidos a dedo: luz, pose, ângulo e recorte. O que fica invisível é o intervalo entre eles — tempo, dinheiro, acompanhamento profissional, condições de vida.',
                questions: [
                    'O que a foto mostra e o que ela deixa de fora?',
                    'O comentário da Marina diz que ela se sentiu um fracasso. Por que um post assim produz esse efeito?',
                    'Quem ganha alguma coisa quando a gente se compara com essa imagem?'
                ],
                links: []
            }
        },
        {
            print: {
                username: 'saude.ceara', verified: true, meta: 'Governo do Estado',
                emoji: '💉', label: 'VACINAÇÃO ABERTA', hue: 150, ratio: 1.91,
                likes: '1.905', comments: '73', time: 'há 8 horas',
                caption: 'Campanha de vacinação nas escolas até sexta. Leve o cartão e um documento com foto. É de graça e protege a turma toda. #saudepublica',
                comment: ['prof.sandra', 'compartilhando com as famílias!']
            },
            material: {
                title: 'Post 3 — Informação de serviço público',
                text: 'Compare a linguagem deste post com a dos dois anteriores. Aqui há um emissor identificável, uma instrução clara, um prazo e nenhuma tentativa de vender algo.',
                questions: [
                    'Que marcas do texto mostram que a intenção é informar, e não vender?',
                    'Como você confere se um perfil que fala em nome do governo é mesmo oficial?',
                    'Qual a diferença entre o selo azul deste post e a fama de um influenciador?'
                ],
                links: []
            }
        },
        {
            print: {
                username: 'sitedenoticias.agora', verified: false, meta: '',
                emoji: '📰', label: 'VOCÊ NÃO VAI CRER', hue: 0, ratio: 1.2,
                likes: '28.140', comments: '3.902', time: 'há 1 dia',
                caption: 'URGENTE: descoberta muda TUDO o que você sabia sobre alimentação. A verdade que a indústria não quer que você leia 👉 link na bio',
                comment: ['bruno.ct', 'cadê a fonte disso?']
            },
            material: {
                title: 'Post 4 — Manchete que promete demais',
                text: 'O texto usa três iscas clássicas: caixa alta, promessa de revelação e um inimigo vago ("a indústria"). Nada disso é checável — e é justamente o ponto: o post quer o clique, não o entendimento.',
                questions: [
                    'Que pergunta o Bruno faz nos comentários? Por que ela é a pergunta certa?',
                    'O post cita um estudo, um autor, uma data? O que isso indica?',
                    'Antes de encaminhar para um grupo, o que dá para verificar em dois minutos?'
                ],
                links: [{ label: 'Agência Lupa — como checar uma informação', url: 'https://lupa.uol.com.br/' }]
            }
        },
        {
            print: {
                username: 'padaria.dona.ines', verified: false, meta: 'Paracuru, Ceará',
                emoji: '🥖', label: 'SAINDO DO FORNO', hue: 35, ratio: 0.8,
                likes: '312', comments: '28', time: 'há 20 minutos',
                caption: 'Bolo de macaxeira saindo agora. Quem passar até as 17h leva ainda quentinho ☕',
                comment: ['seu.raimundo', 'já estou indo!']
            },
            material: {
                title: 'Post 5 — Quando a rede aproxima',
                text: 'Mesmo formato, outro uso: aqui a rede serve a um comércio do bairro falando com quem mora perto. Baixa produção, linguagem simples, compromisso verificável — é só atravessar a rua.',
                questions: [
                    'Por que este post não precisa de urgência artificial nem de número grande de curtidas?',
                    'Que usos das redes sociais fazem bem à vida da nossa cidade?',
                    'Compare as 312 curtidas daqui com as 28 mil do post anterior: curtida é medida de quê?'
                ],
                links: []
            }
        },
        {
            print: {
                username: 'viaja.comigo', verified: false, meta: 'Jericoacoara',
                emoji: '🌅', label: 'PARAÍSO', hue: 190, ratio: 1.3,
                likes: '9.876', comments: '540', time: 'há 2 dias',
                caption: 'Acordar assim todo dia não tem preço. Roteiro completo nos stories 🌊 #trabalheremotamente #sonhorealizado',
                comment: ['ju.contadora', 'e como faz pra viver disso?']
            },
            material: {
                title: 'Post 6 — A vida editada',
                text: 'Paisagem, leveza, promessa de roteiro: o post mostra o resultado e esconde o processo. E a resposta do perfil nos comentários revela o que está sendo vendido de verdade.',
                questions: [
                    'O que o perfil realmente vende: viagem ou mentoria?',
                    'Que custos e dificuldades desse estilo de vida o post não mostra?',
                    'Se você fosse postar o seu dia de hoje, o que escolheria mostrar? E esconder?'
                ],
                links: []
            }
        },
        {
            print: {
                username: 'coletivo.rio.limpo', verified: false, meta: 'Foz do Rio Curu',
                emoji: '🌱', label: 'MUTIRÃO SÁBADO', hue: 120, ratio: 1.2,
                likes: '748', comments: '96', time: 'há 3 dias',
                caption: 'Sábado, 7h, na foz. Traga luva e garrafa de água. Na última limpeza foram 84 sacos de plástico retirados. Vem?',
                comment: ['bio.prof.marcos', 'a turma do 2º ano vai em bloco']
            },
            material: {
                title: 'Post 7 — Chamado à ação',
                text: 'Este post quer um comportamento, não um clique: data, hora, lugar, o que levar e um dado concreto do resultado anterior. É o tipo de publicação que se mede fora da tela.',
                questions: [
                    'Quais informações tornam o convite confiável?',
                    'Que diferença faz citar "84 sacos" em vez de dizer "muita sujeira"?',
                    'Que causa da nossa escola daria um post assim? Escreva a legenda.'
                ],
                links: []
            }
        },
        {
            print: {
                username: 'memes.da.sala', verified: false, meta: '',
                emoji: '😂', label: 'PROVA AMANHÃ', hue: 55, ratio: 0.8,
                likes: '4.021', comments: '187', time: 'há 4 dias',
                caption: 'eu explicando pro professor que estudei: 💀 #meme #escola',
                comment: ['prof.vinicius', 'estou vendo tudo 👀']
            },
            material: {
                title: 'Post 8 — Humor também é discurso',
                text: 'O meme parece inofensivo, mas ele afirma coisas: sobre estudo, sobre autoridade, sobre o que é normal na turma. Rir junto é uma forma de concordar.',
                questions: [
                    'Com o que exatamente a gente concorda quando compartilha esse meme?',
                    'O humor aqui critica alguém ou alguma ideia? Quem ou qual?',
                    'Existe meme neutro? Justifique com um exemplo que você já compartilhou.'
                ],
                links: []
            }
        }
    ];

    function build() {
        const model = global.FeedAula.model;
        const feed = model.newFeed('Exemplo — Leitura de imagens: o que o feed quer de nós');
        feed.profile.brand = 'InstaPensa';

        feed.posts = POSTS.map(function (raw) {
            const post = model.newPost();
            const total = raw.extra ? 2 : 1;
            const shot = Object.assign({}, raw.print, { index: 0, total: total });
            post.media = [media(print(shot), 'Print da publicação de @' + raw.print.username)];
            if (raw.extra) {
                post.media.push(media(printComments(raw.extra),
                    'Print dos comentários da publicação de @' + raw.print.username));
            }
            post.material = {
                title: raw.material.title,
                text: raw.material.text,
                questions: raw.material.questions,
                links: raw.material.links || []
            };
            return post;
        });

        return feed;
    }

    function create() {
        const feed = build();
        return global.FeedAula.db.saveFeed(feed).then(function () { return feed; });
    }

    global.FeedAula = global.FeedAula || {};
    global.FeedAula.demo = { build: build, create: create };
}(window));
