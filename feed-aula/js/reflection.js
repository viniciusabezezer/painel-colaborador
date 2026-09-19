/* Janela de reflexão compartilhada pela prévia e pelo modo aula. */
(function (global) {
    'use strict';
    const dialog = document.createElement('dialog');
    dialog.className = 'reflection';
    dialog.setAttribute('aria-labelledby', 'reflection-title');
    dialog.innerHTML = '<header class="reflection__head">' +
        '<div><span class="reflection__label">InstaPensa · reflexão</span><h2 id="reflection-title"></h2></div>' +
        '<button type="button" class="btn btn--sm" data-reflection="close" aria-label="Fechar reflexão">✕ Fechar</button></header>' +
        '<div class="reflection__body"><p class="reflection__text"></p><ol class="reflection__questions"></ol>' +
        '<div class="reflection__links"></div><p class="reflection__empty">Este post ainda não tem material de reflexão. Adicione o texto e as perguntas no editor, em Material da aula.</p></div>' +
        '<footer class="reflection__foot"><span class="reflection__progress" role="status"></span>' +
        '<div class="reflection__controls"><button class="btn btn--primary" data-reflection="next">Revelar pergunta</button>' +
        '<button class="btn" data-reflection="all">Mostrar todas</button><button class="btn" data-reflection="reset">Esconder perguntas</button></div></footer>';
    let revealed = 0;
    let questions = [];
    let trigger = null;

    function paint() {
        questions.forEach(function (item, i) { item.hidden = i >= revealed; });
        dialog.querySelector('.reflection__progress').textContent = questions.length
            ? revealed + ' de ' + questions.length + ' perguntas' : 'Sem perguntas neste post';
        dialog.querySelector('[data-reflection="next"]').disabled = revealed >= questions.length;
        dialog.querySelector('[data-reflection="all"]').disabled = revealed >= questions.length;
        dialog.querySelector('[data-reflection="reset"]').disabled = revealed === 0;
    }
    function close() { if (dialog.open) dialog.close(); }
    function open(post, index, button) {
        close();
        trigger = button;
        // Dentro do elemento em tela cheia, para continuar visível na projeção.
        (button.closest('.present') || document.body).appendChild(dialog);
        const material = post.material || {};
        const title = material.title || global.FeedAula.model.postLabel(post, index);
        dialog.querySelector('#reflection-title').textContent = title;
        dialog.querySelector('.reflection__label').textContent = 'InstaPensa · reflexão do post ' + (index + 1);
        const text = dialog.querySelector('.reflection__text');
        text.textContent = material.text || '';
        text.hidden = !text.textContent.trim();
        const list = dialog.querySelector('.reflection__questions');
        list.replaceChildren();
        questions = (material.questions || []).map(function (question) {
            const item = document.createElement('li');
            item.textContent = question;
            list.appendChild(item);
            return item;
        });
        const links = dialog.querySelector('.reflection__links');
        links.replaceChildren();
        (material.links || []).forEach(function (link) {
            let url;
            try { url = new URL(link.url); } catch (_) { return; }
            if (!/^https?:$/.test(url.protocol)) return;
            const anchor = document.createElement('a');
            anchor.href = url.href;
            anchor.textContent = link.label || link.url;
            anchor.target = '_blank';
            anchor.rel = 'noopener noreferrer';
            links.appendChild(anchor);
        });
        dialog.querySelector('.reflection__empty').hidden = !text.hidden || questions.length > 0 || links.children.length > 0;
        revealed = 0;
        paint();
        button.closest('.ig').feedApi.pauseVideos();
        dialog.showModal();
        dialog.querySelector('[data-reflection="close"]').focus();
    }
    function action(name) {
        if (name === 'close') { close(); return; }
        if (name === 'next') revealed = Math.min(questions.length, revealed + 1);
        if (name === 'all') revealed = questions.length;
        if (name === 'reset') revealed = 0;
        paint();
    }
    dialog.addEventListener('click', function (event) {
        const button = event.target.closest('[data-reflection]');
        if (button) action(button.dataset.reflection);
    });
    dialog.addEventListener('keydown', function (event) {
        event.stopPropagation();
        if (event.key.toLowerCase() === 'n') { event.preventDefault(); action('next'); }
        if (event.key.toLowerCase() === 't') { event.preventDefault(); action('all'); }
    });
    document.addEventListener('fullscreenchange', function () {
        if (!document.fullscreenElement && dialog.open) close();
    });
    dialog.addEventListener('close', function () {
        if (trigger && trigger.isConnected) trigger.focus({ preventScroll: true });
    });
    global.FeedAula = global.FeedAula || {};
    global.FeedAula.reflection = { open: open, close: close, isOpen: function () { return dialog.open; } };
}(window));
