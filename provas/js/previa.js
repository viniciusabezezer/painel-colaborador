/* Prévia da primeira página na tela, para a coordenação apontar onde a
   identificação deve entrar. Usa o pdf.js que está em vendor/, carregado só
   quando a prévia é pedida — quem vai direto pelo modelo pronto não paga o
   download da biblioteca. */
(function (global) {
    'use strict';

    const CM = 28.3465;
    let promessaBiblioteca = null;

    function carregarBiblioteca() {
        if (global.pdfjsLib) return Promise.resolve(global.pdfjsLib);
        if (promessaBiblioteca) return promessaBiblioteca;

        promessaBiblioteca = new Promise(function (resolve, reject) {
            const script = document.createElement('script');
            script.src = 'vendor/pdf.min.js';
            script.onload = function () {
                if (!global.pdfjsLib) {
                    reject(new Error('O pdf.js não carregou.'));
                    return;
                }
                global.pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
                resolve(global.pdfjsLib);
            };
            script.onerror = function () {
                reject(new Error('Não consegui carregar vendor/pdf.min.js.'));
            };
            document.head.appendChild(script);
        });
        return promessaBiblioteca;
    }

    /* Desenha a primeira página no canvas e devolve as medidas da página em
       centímetros, que é o que o resto do app usa para posicionar as marcas. */
    async function desenharPdf(canvas, bytes, larguraAlvo) {
        const pdfjs = await carregarBiblioteca();
        /* O pdf.js assume o buffer que recebe, então vai uma cópia. */
        const documento = await pdfjs.getDocument({ data: bytes.slice(0) }).promise;
        const pagina = await documento.getPage(1);

        const original = pagina.getViewport({ scale: 1 });
        const escala = larguraAlvo / original.width;
        const vista = pagina.getViewport({ scale: escala });

        canvas.width = Math.round(vista.width);
        canvas.height = Math.round(vista.height);
        const contexto = canvas.getContext('2d');
        contexto.fillStyle = '#ffffff';
        contexto.fillRect(0, 0, canvas.width, canvas.height);
        await pagina.render({ canvasContext: contexto, viewport: vista }).promise;

        return {
            larguraCm: original.width / CM,
            alturaCm: original.height / CM,
            pixelsPorCm: canvas.width / (original.width / CM),
            paginas: documento.numPages
        };
    }

    /* Imagem enviada em vez de PDF: entra numa folha A4, igual ao que o
       gerador faz no PDF final. */
    function desenharImagem(canvas, bytes, tipo, larguraAlvo) {
        return new Promise(function (resolve, reject) {
            const blob = new Blob([bytes], { type: tipo === 'png' ? 'image/png' : 'image/jpeg' });
            const url = URL.createObjectURL(blob);
            const imagem = new Image();
            imagem.onload = function () {
                const larguraFolha = 21;
                const alturaFolha = 29.7;
                canvas.width = Math.round(larguraAlvo);
                canvas.height = Math.round(larguraAlvo * alturaFolha / larguraFolha);
                const contexto = canvas.getContext('2d');
                contexto.fillStyle = '#ffffff';
                contexto.fillRect(0, 0, canvas.width, canvas.height);

                const escala = Math.min(canvas.width / imagem.width, canvas.height / imagem.height);
                const largura = imagem.width * escala;
                const altura = imagem.height * escala;
                contexto.drawImage(imagem, (canvas.width - largura) / 2, 0, largura, altura);
                URL.revokeObjectURL(url);
                resolve({
                    larguraCm: larguraFolha,
                    alturaCm: alturaFolha,
                    pixelsPorCm: canvas.width / larguraFolha,
                    paginas: 1
                });
            };
            imagem.onerror = function () {
                URL.revokeObjectURL(url);
                reject(new Error('Não consegui abrir esta imagem.'));
            };
            imagem.src = url;
        });
    }

    function desenhar(canvas, arquivo, larguraAlvo) {
        if (arquivo.tipo === 'pdf') return desenharPdf(canvas, arquivo.bytes, larguraAlvo);
        return desenharImagem(canvas, arquivo.bytes, arquivo.tipo, larguraAlvo);
    }

    global.ProvasPrevia = { desenhar: desenhar, carregarBiblioteca: carregarBiblioteca, CM: CM };
})(typeof globalThis !== 'undefined' ? globalThis : this);
