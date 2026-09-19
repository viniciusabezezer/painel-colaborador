/* InstaPensa — feed de exemplo.
   Serve para o professor ver a dinâmica funcionando antes de montar a dele.
   As imagens são desenhadas aqui mesmo (SVG), então o exemplo não depende de
   internet nem de arquivo nenhum. */
(function (global) {
    'use strict';

    /* Imagem de espaço reservado: gradiente + emoji + rótulo. */
    function art(emoji, label, hue, ratio) {
        label = label.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const width = 1080;
        const height = Math.round(width / (ratio || 1));
        const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + ' ' + height + '">' +
            '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
            '<stop offset="0" stop-color="hsl(' + hue + ',72%,62%)"/>' +
            '<stop offset="1" stop-color="hsl(' + ((hue + 45) % 360) + ',68%,38%)"/>' +
            '</linearGradient></defs>' +
            '<rect width="' + width + '" height="' + height + '" fill="url(#g)"/>' +
            '<circle cx="' + (width * 0.82) + '" cy="' + (height * 0.18) + '" r="' + (width * 0.22) + '" fill="rgba(255,255,255,.12)"/>' +
            '<circle cx="' + (width * 0.16) + '" cy="' + (height * 0.86) + '" r="' + (width * 0.18) + '" fill="rgba(0,0,0,.12)"/>' +
            '<text x="50%" y="46%" text-anchor="middle" font-size="' + Math.round(height * 0.3) + '">' + emoji + '</text>' +
            '<text x="50%" y="72%" text-anchor="middle" fill="#ffffff" font-family="Helvetica,Arial,sans-serif" ' +
            'font-size="' + Math.round(height * 0.055) + '" font-weight="bold" letter-spacing="1">' + label + '</text>' +
            '<text x="50%" y="79%" text-anchor="middle" fill="rgba(255,255,255,.75)" font-family="Helvetica,Arial,sans-serif" ' +
            'font-size="' + Math.round(height * 0.032) + '">imagem de exemplo — troque pela sua</text>' +
            '</svg>';
        return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    }

    function image(emoji, label, hue, ratio) {
        return { kind: 'image', mediaId: '', url: art(emoji, label, hue, ratio), alt: label };
    }

    const POSTS = [
        {
            username: 'passostenis.oficial', verified: true, location: '', sponsored: true,
            media: [image('👟', 'LANÇAMENTO', 12), image('🏷️', '50% OFF SÓ HOJE', 350, 0.8)],
            caption: 'Ele chegou. O tênis que todo mundo vai querer usar essa semana. Link na bio 👟✨ #novidade #corra #edicaolimitada',
            likedBy: 'jhon.paracuru', likes: '12.487', total: '834', time: 'há 2 horas',
            comments: [
                ['ana.vitoria21', 'preciso desse 😍'],
                ['lucas.sk8', 'quanto custa? a marca nunca responde']
            ],
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
            username: 'vida.em.movimento', verified: false, location: 'Academia Central',
            media: [image('💪', 'ANTES & DEPOIS', 200, 0.8)],
            caption: 'Foram 90 dias de disciplina. Sem desculpa, sem atalho. Quem quiser a minha rotina, chama no direct 💪 #foco #transformacao',
            likedBy: 'coach.dudu', likes: '5.302', total: '412', time: 'há 5 horas',
            comments: [
                ['marinasp', 'que inspiração! me sinto um fracasso perto disso'],
                ['edu.personal', 'trabalho lindo 👏']
            ],
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
            username: 'saude.ceara', verified: true, location: 'Governo do Estado',
            media: [image('💉', 'VACINAÇÃO ABERTA', 150, 1.91)],
            caption: 'Campanha de vacinação nas escolas até sexta. Leve o cartão e um documento com foto. É de graça e protege a turma toda. #saudepublica',
            likedBy: 'escola.malu', likes: '1.905', total: '73', time: 'há 8 horas',
            comments: [
                ['prof.sandra', 'compartilhando com as famílias!'],
                ['ze.duvidas', 'e quem perdeu a primeira dose?']
            ],
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
            username: 'sitedenoticias.agora', verified: false, location: '',
            media: [image('📰', 'VOCÊ NÃO VAI CRER', 0, 1.2)],
            caption: 'URGENTE: descoberta muda TUDO o que você sabia sobre alimentação. A verdade que a indústria não quer que você leia 👉 link na bio',
            likedBy: 'grupo.da.familia', likes: '28.140', total: '3.902', time: 'há 1 dia',
            comments: [
                ['tia.lourdes', 'já mandei no grupo da família'],
                ['bruno.ct', 'cadê a fonte disso?'],
                ['sitedenoticias.agora', 'leia a matéria completa no link 🔗']
            ],
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
            username: 'padaria.dona.ines', verified: false, location: 'Paracuru, Ceará',
            media: [image('🥖', 'SAINDO DO FORNO', 35, 0.8)],
            caption: 'Bolo de macaxeira saindo agora. Quem passar até as 17h leva ainda quentinho ☕',
            likedBy: 'vizinhanca', likes: '312', total: '28', time: 'há 20 minutos',
            comments: [
                ['seu.raimundo', 'já estou indo!'],
                ['carla.mendes', 'o melhor da cidade, sem exagero']
            ],
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
            username: 'viaja.comigo', verified: false, location: 'Jericoacoara',
            media: [image('🌅', 'PARAÍSO', 190, 1.91), image('🧳', 'BAGAGEM LEVE', 210), image('📍', 'ROTEIRO NOS STORIES', 170, 0.8)],
            caption: 'Acordar assim todo dia não tem preço. Roteiro completo nos stories 🌊 #trabalheremotamente #sonhorealizado',
            likedBy: 'mundo.aberto', likes: '9.876', total: '540', time: 'há 2 dias',
            comments: [
                ['ju.contadora', 'e como faz pra viver disso?'],
                ['viaja.comigo', 'mentoria aberta, chama no direct 💬']
            ],
            material: {
                title: 'Post 6 — O carrossel e a vida editada',
                text: 'Três imagens, uma narrativa: paisagem, leveza, promessa de roteiro. O carrossel é um recurso de montagem — ele conta uma história na ordem que o autor escolheu. E a resposta ao comentário revela o que está sendo vendido de verdade.',
                questions: [
                    'Se a ordem das três imagens fosse invertida, a história mudaria? Como?',
                    'O que o perfil realmente vende: viagem ou mentoria?',
                    'Que custos e dificuldades desse estilo de vida o post não mostra?'
                ],
                links: []
            }
        },
        {
            username: 'coletivo.rio.limpo', verified: false, location: 'Foz do Rio Curu',
            media: [image('🌱', 'MUTIRÃO SÁBADO', 120, 1.2)],
            caption: 'Sábado, 7h, na foz. Traga luva e garrafa de água. Na última limpeza foram 84 sacos de plástico retirados. Vem?',
            likedBy: 'grêmio.estudantil', likes: '748', total: '96', time: 'há 3 dias',
            comments: [
                ['bio.prof.marcos', 'a turma do 2º ano vai em bloco'],
                ['helena.rs', 'levo mais dois amigos']
            ],
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
            username: 'memes.da.sala', verified: false, location: '',
            media: [image('😂', 'PROVA AMANHÃ', 55, 0.8)],
            caption: 'eu explicando pro professor que estudei: 💀 #meme #escola',
            likedBy: 'turma.201', likes: '4.021', total: '187', time: 'há 4 dias',
            comments: [
                ['gabriel.m', 'sou eu literalmente'],
                ['prof.vinicius', 'estou vendo tudo 👀']
            ],
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
        feed.profile.showStories = true;
        feed.stories = [
            { id: model.uid('s'), label: 'Seu story', url: '', mediaId: '', seen: false },
            { id: model.uid('s'), label: 'passostenis', url: '', mediaId: '', seen: false },
            { id: model.uid('s'), label: 'saude.ceara', url: '', mediaId: '', seen: false },
            { id: model.uid('s'), label: 'padaria', url: '', mediaId: '', seen: true },
            { id: model.uid('s'), label: 'rio.limpo', url: '', mediaId: '', seen: true }
        ];

        feed.posts = POSTS.map(function (raw) {
            const post = model.newPost();
            post.author.username = raw.username;
            post.author.verified = raw.verified;
            post.location = raw.location;
            post.sponsored = !!raw.sponsored;
            post.media = raw.media;
            post.caption = raw.caption;
            post.likedBy = raw.likedBy;
            post.likesCount = raw.likes;
            post.commentsTotal = raw.total;
            post.time = raw.time;
            post.comments = raw.comments.map(function (pair) {
                return { user: pair[0], text: pair[1], likes: '' };
            });
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
