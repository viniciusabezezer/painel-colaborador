/* O "slide" da pergunta: o mesmo desenho no telão, na prévia do editor e
   na aula ao vivo do app. Layout: mídia à esquerda, no centro (em cima) ou
   à direita; alternativas com texto e/ou imagem; gráfico e resposta certa
   quando o professor decide. */
(function (global) {
    'use strict';

    const LETRAS = ['A', 'B', 'C', 'D'];

    function texto(o) { return typeof o === 'string' ? o : (o && o.texto) || ''; }
    function imagem(o) { return typeof o === 'string' ? '' : (o && o.imagem) || ''; }

    /* questao: { enunciado, midia, layout, opcoes, corretas }
       estado: { mostrarGrafico, revelar, contagem: {A:n}, total, tocar } */
    function html(questao, estado) {
        const e = estado || {};
        const T = global.Texto, M = global.Midia;
        const corretas = e.revelar ? (questao.corretas || []) : [];
        const temCerta = (questao.corretas || []).length > 0;
        const mostrar = e.mostrarGrafico || e.revelar;
        const total = Math.max(1, e.total || 0);
        const midia = questao.midia && questao.midia.src ? M.html(questao.midia, { tocar: e.tocar }) : '';
        const layout = midia ? (questao.layout || 'centro') : 'sem-midia';
        const comImagens = (questao.opcoes || []).some((o) => imagem(o));
        const opcoes = (questao.opcoes || []).map((o, k) => {
            const l = LETRAS[k];
            const certa = corretas.includes(l);
            const n = e.contagem ? (e.contagem[l] || 0) : 0;
            const pct = Math.round(n / total * 100);
            const img = imagem(o);
            return `<div class="slide-opcao ${certa ? 'certa' : ''} ${e.revelar && temCerta && !certa ? 'apagada' : ''}">
                <span class="letra letra-${l}">${l}</span>
                ${img && M.urlSegura(img) ? `<img class="opcao-imagem" src="${T.esc(img)}" alt="">` : ''}
                <span class="slide-opcao-texto">${T.html(texto(o))}</span>
                ${mostrar ? `<span class="slide-barra"><i class="letra-${l}" style="width:${pct}%"></i></span><span class="slide-conta">${n}</span>` : ''}
                ${certa ? '<span class="selo-certa">✔</span>' : ''}
            </div>`;
        }).join('');
        return `<div class="slide layout-${layout} ${mostrar ? 'com-grafico' : ''} ${comImagens ? 'opcoes-com-imagem' : ''} ${(questao.opcoes || []).length <= 2 ? 'duas' : ''}">
            <div class="slide-topo">
                <div class="slide-enunciado">${T.html(questao.enunciado || '')}</div>
                ${midia ? `<div class="slide-midia">${midia}</div>` : ''}
            </div>
            <div class="slide-opcoes">${opcoes}</div>
        </div>`;
    }

    global.Slide = { html, texto, imagem };
})(typeof self !== 'undefined' ? self : this);
