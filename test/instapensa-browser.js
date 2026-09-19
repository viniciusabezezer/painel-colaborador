/* Regressão no navegador: execute via agent-browser eval --stdin em uma sessão de teste. */
(async function () {
    const results = [];
    const app = window.FeedAula;
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    async function until(check) {
        for (let n = 0; n < 100; n++) {
            if (await check()) return;
            await wait(30);
        }
        throw new Error('Tempo esgotado: ' + check.toString());
    }
    function assert(ok, message) {
        if (!ok) throw new Error(message);
        results.push(message);
    }
    function click(selector) { document.querySelector(selector).click(); }
    function fill(selector, value) {
        const input = document.querySelector(selector);
        input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    app.app.go('#/');
    await until(() => document.body.dataset.view === 'library');
    click('#new-feed');
    await until(() => app.editor.current());
    const id = app.editor.current().id;
    fill('#feed-name', 'InstaPensa — teste de persistência');
    fill('[data-bind="caption"]', 'Publicação de teste #educação');
    fill('[data-bind="material.title"]', 'Leitura crítica');
    fill('#questions', 'Quem publicou?\nQual é a intenção?');
    click('#editor-back');
    await until(() => document.body.dataset.view === 'library');
    const saved = await app.db.getFeed(id);
    assert(saved.name === 'InstaPensa — teste de persistência' && saved.posts[0].caption.includes('#educação'), 'Salva alterações ao sair imediatamente do editor');
    app.app.go('#/editar/' + id);
    await until(() => app.editor.current());
    assert(document.querySelector('#questions').value.includes('Qual é a intenção?'), 'Reabre o material didático salvo');
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="480"><rect width="480" height="480" fill="green"/></svg>';
    const files = new DataTransfer();
    files.items.add(new File([svg], 'teste.svg', { type: 'image/svg+xml' }));
    document.querySelector('#media-drop').dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: files }));
    await until(() => app.editor.current().posts[0].media.length === 1);
    await app.editor.flush();
    const withMedia = await app.db.getFeed(id);
    const mediaId = withMedia.posts[0].media[0].mediaId;
    const bundle = await app.media.exportBundle(withMedia);
    assert(bundle.media.length === 1 && bundle.media[0].dataUrl.startsWith('data:image/svg+xml'), 'Exporta a aula com a imagem local embutida');
    const original = await app.db.getMedia(mediaId);
    const imported = await app.media.importBundle(bundle);
    assert(imported.posts[0].media[0].mediaId !== mediaId && (await app.db.getMedia(mediaId)).size === original.size, 'Importa mídias com novos identificadores sem sobrescrever aulas existentes');
    const beforeImport = (await app.db.listFeeds()).length;
    click('#editor-back');
    await until(() => document.body.dataset.view === 'library');
    const inputFiles = new DataTransfer();
    inputFiles.items.add(new File([JSON.stringify(bundle)], 'aula.json', { type: 'application/json' }));
    document.querySelector('#file-import').files = inputFiles.files;
    document.querySelector('#file-import').dispatchEvent(new Event('change'));
    await until(async () => (await app.db.listFeeds()).length === beforeImport + 1);
    assert(true, 'Importação pela interface cria uma cópia independente');
    app.app.go('#/editar/' + id);
    await until(() => app.editor.current());
    click('[data-post-act="duplicate"]');
    fill('[data-bind="material.title"]', 'Segundo post');
    click('#editor-present');
    await until(() => document.querySelector('#present-phone .ig'));
    assert(document.querySelectorAll('#present-phone .ig-post').length === 2, 'Apresenta os dois posts, incluindo a última edição');
    click('#present-phone .ig-post:last-child .ig-reflect');
    assert(app.reflection.isOpen() && document.querySelector('#reflection-title').textContent === 'Segundo post', 'Cérebro abre o material da postagem clicada');
    click('[data-reflection="next"]');
    assert(document.querySelectorAll('.reflection__questions li:not([hidden])').length === 1, 'Janela revela uma pergunta por vez');
    click('[data-reflection="all"]');
    assert(document.querySelectorAll('.reflection__questions li:not([hidden])').length === 2, 'Janela mostra todas as perguntas');
    click('[data-reflection="reset"]');
    assert(document.querySelectorAll('.reflection__questions li:not([hidden])').length === 0, 'Janela esconde as perguntas novamente');
    click('[data-reflection="close"]');
    assert(!app.reflection.isOpen() && document.body.dataset.view === 'present', 'Fechar reflexão mantém a apresentação');
    click('#reveal-next');
    assert(document.querySelectorAll('#material-questions li:not(.is-hidden)').length === 1, 'Revela uma pergunta por vez');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    await until(() => document.querySelector('#material-title').textContent === 'Segundo post');
    await wait(650);
    assert(document.querySelector('#present-progress').textContent === 'Post 2 de 2', 'Navega pelo teclado e sincroniza o material do post');
    click('#present-phone .ig-post:last-child .ig-like');
    assert(document.querySelector('#present-phone .ig-post:last-child .ig-like').classList.contains('is-on'), 'Curtida simulada funciona na apresentação');
    click('#material-zoom');
    assert(document.querySelector('#present').classList.contains('is-zoom'), 'Amplia o material para a turma');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    click('#present-exit');
    await until(() => document.body.dataset.view === 'library');
    return { passed: results.length, results };
}());
