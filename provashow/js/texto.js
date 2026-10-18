/* Texto das perguntas: uma marcação curta, segura e fácil de digitar.
     **negrito**   *itálico*   __sublinhado__   x^2^ (expoente)   H~2~O (índice)
     $\frac{1}{2}$  equação em LaTeX (desenhada pelo KaTeX, em MathML)
   Tudo o que não é marcação é escapado: o texto nunca vira HTML de verdade. */
(function (global) {
    'use strict';

    function esc(t) {
        return String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    function katex() {
        if (global.katex) return global.katex;
        if (typeof require === 'function') { try { return require('../vendor/katex.min.js'); } catch (e) { return null; } }
        return null;
    }

    function equacao(tex) {
        const k = katex();
        if (!k) return `<code class="tex">${esc(tex)}</code>`;
        try {
            return k.renderToString(tex, { output: 'mathml', throwOnError: false, strict: 'ignore' });
        } catch (erro) {
            return `<code class="tex">${esc(tex)}</code>`;
        }
    }

    function marcacao(t) {
        return esc(t)
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/__(.+?)__/g, '<u>$1</u>')
            .replace(/(^|[^*\w])\*(?!\s)(.+?)\*(?!\w)/g, '$1<em>$2</em>')
            .replace(/\^(.+?)\^/g, '<sup>$1</sup>')
            .replace(/~(.+?)~/g, '<sub>$1</sub>')
            .replace(/\n/g, '<br>');
    }

    /* As equações ($...$) viram marcadores, a marcação corre no texto
       inteiro (assim **$x^2$** fica em negrito) e depois as equações voltam.
       \$ é cifrão de verdade. */
    function html(t) {
        const s = String(t == null ? '' : t);
        const equacoes = [];
        let texto = '';
        let i = 0;
        while (i < s.length) {
            let ini = -1;
            for (let k = i; k < s.length; k++) if (s[k] === '$' && s[k - 1] !== '\\') { ini = k; break; }
            let fim = -1;
            if (ini >= 0) for (let k = ini + 1; k < s.length; k++) if (s[k] === '$' && s[k - 1] !== '\\') { fim = k; break; }
            if (ini < 0 || fim < 0 || fim === ini + 1) { texto += s.slice(i); break; }
            texto += s.slice(i, ini) + '\u0000' + equacoes.length + '\u0000';
            equacoes.push(s.slice(ini + 1, fim));
            i = fim + 1;
        }
        return marcacao(texto.replace(/\\\$/g, '$')).replace(/\u0000(\d+)\u0000/g, (m, n) => equacao(equacoes[+n]));
    }

    /* Versão sem marcação, para títulos, planilhas e listas. */
    function simples(t) {
        return String(t == null ? '' : t)
            .replace(/\$(.+?)\$/g, '$1')
            .replace(/\*\*|__|\^|~/g, '')
            .replace(/(^|\s)\*(\S.*?)\*/g, '$1$2')
            .replace(/\s+/g, ' ').trim();
    }

    const Texto = { esc, html, simples };
    if (typeof module === 'object' && module.exports) module.exports = Texto;
    else global.Texto = Texto;
})(typeof self !== 'undefined' ? self : this);
