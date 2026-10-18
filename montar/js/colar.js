/* O que vem da área de transferência. Do Word, de sites e de PDFs abertos no
   navegador o texto chega também como HTML: daqui sai a marcação do app
   (**negrito**, *itálico*, ~índice~, ^expoente^), uma linha por parágrafo,
   sem as cores, fontes e tamanhos de lá — o formato é o da prova.
   Imagens coladas chegam como arquivo (print, imagem copiada) ou como
   data: dentro do HTML. */
(function (global) {
    'use strict';

    const BLOCOS = /^(P|DIV|LI|H[1-6]|TR|BLOCKQUOTE|SECTION|ARTICLE|UL|OL|TABLE)$/;

    function estiloDe(no) {
        const s = (no.getAttribute && no.getAttribute('style')) || '';
        const tag = no.tagName;
        const peso = /font-weight\s*:\s*(bold|[6-9]00)/i.test(s);
        const leve = /font-weight\s*:\s*(normal|[1-4]00)/i.test(s);
        return {
            b: tag === 'B' || tag === 'STRONG' || (peso && !leve),
            i: tag === 'I' || tag === 'EM' || /font-style\s*:\s*italic/i.test(s),
            sub: tag === 'SUB' || /vertical-align\s*:\s*sub/i.test(s),
            sup: tag === 'SUP' || /vertical-align\s*:\s*super/i.test(s)
        };
    }

    /* Percorre o HTML e devolve as linhas já com a marcação. */
    function htmlParaMarcacao(html) {
        const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
        doc.querySelectorAll('style,script,head,title,meta,o\\:p').forEach(function (n) { n.remove(); });
        const linhas = [''];

        function texto(t, estilo) {
            t = t.replace(/[\s ]+/g, ' ');
            if (!t) return;
            const atual = linhas[linhas.length - 1];
            if (!atual && t === ' ') return;
            if (!/\S/.test(t)) { linhas[linhas.length - 1] = atual + ' '; return; }
            const ini = /^\s/.test(t) ? ' ' : '';
            const fim = /\s$/.test(t) ? ' ' : '';
            let miolo = t.trim().replace(/\*/g, '\\*');
            if (estilo.sub) miolo = '~' + miolo + '~';
            else if (estilo.sup) miolo = '^' + miolo + '^';
            if (estilo.i) miolo = '*' + miolo + '*';
            if (estilo.b) miolo = '**' + miolo + '**';
            linhas[linhas.length - 1] = atual + ini + miolo + fim;
        }

        function quebra() {
            if (linhas[linhas.length - 1].trim()) linhas.push('');
        }

        function andar(no, estilo) {
            if (no.nodeType === 3) { texto(no.nodeValue, estilo); return; }
            if (no.nodeType !== 1) return;
            if (no.tagName === 'BR') { quebra(); return; }
            if (no.tagName === 'IMG') return;
            const proprio = estiloDe(no);
            const junto = {
                b: estilo.b || proprio.b, i: estilo.i || proprio.i,
                sub: estilo.sub || proprio.sub, sup: estilo.sup || proprio.sup
            };
            const bloco = BLOCOS.test(no.tagName);
            if (bloco) quebra();
            if (no.tagName === 'TD' || no.tagName === 'TH') {
                if (linhas[linhas.length - 1].trim()) linhas[linhas.length - 1] += ' | ';
            }
            no.childNodes.forEach(function (filho) { andar(filho, junto); });
            if (bloco) quebra();
        }

        andar(doc.body, { b: false, i: false, sub: false, sup: false });
        return linhas.map(function (l) {
            /* marcas vizinhas se fundem: **a** **b** → **a b** */
            return l.replace(/\*\*\s\*\*/g, ' ').replace(/\*\*\*\*/g, '').replace(/\s+/g, ' ').trim();
        }).filter(Boolean).join('\n');
    }

    /* Imagens do HTML que vieram embutidas (data:). As de file:// ou http://
       não dá para ler daqui. */
    function imagensDoHtml(html) {
        const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
        const imgs = Array.from(doc.querySelectorAll('img'));
        return {
            embutidas: imgs.map(function (i) { return i.getAttribute('src') || ''; }).filter(function (s) { return /^data:image\//.test(s); }),
            total: imgs.length
        };
    }

    function dataUrlParaArquivo(url) {
        const partes = url.split(',');
        const tipo = (/data:([^;]+)/.exec(partes[0]) || [])[1] || 'image/png';
        const bin = atob(partes[1] || '');
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return new File([bytes], 'colada', { type: tipo });
    }

    /* Lê um evento de colar. Devolve { texto, imagens: [File], perdidas } */
    function ler(evento) {
        const dados = evento.clipboardData;
        if (!dados) return { texto: '', imagens: [], perdidas: 0 };
        const arquivos = Array.from(dados.files || []).filter(function (f) { return /^image\//.test(f.type); });
        const html = dados.getData('text/html');
        const puro = dados.getData('text/plain');
        let texto = html ? htmlParaMarcacao(html) : '';
        if (!texto.trim()) texto = (puro || '').replace(/\r/g, '');
        let imagens = arquivos;
        let perdidas = 0;
        if (html) {
            const doHtml = imagensDoHtml(html);
            if (!imagens.length) imagens = doHtml.embutidas.map(dataUrlParaArquivo);
            perdidas = Math.max(0, doHtml.total - imagens.length);
        }
        /* O Word põe no clipboard, além do texto, um desenho da seleção
           inteira. Com texto de verdade junto, esse desenho não é figura. */
        if (texto.trim() && arquivos.length && html && !imagensDoHtml(html).total) imagens = [];
        return { texto: texto, imagens: imagens, perdidas: perdidas };
    }

    const api = { htmlParaMarcacao: htmlParaMarcacao, ler: ler };
    global.MontarColar = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
