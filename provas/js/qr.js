/* QR Code das provas: gera a matriz de módulos e a converte em retângulos.
   Os retângulos vão desenhados como vetor dentro do PDF (nada de imagem), o
   que mantém o QR nítido em qualquer impressora e o arquivo leve. */
(function (global) {
    'use strict';

    const gerador = global.qrcode || (typeof require === 'function' ? require('../vendor/qrcode.js') : null);

    /* Os nomes têm acento, então o QR precisa gravar em UTF-8. */
    if (gerador && gerador.stringToBytesFuncs && gerador.stringToBytesFuncs['UTF-8']) {
        gerador.stringToBytes = gerador.stringToBytesFuncs['UTF-8'];
    }

    /* Nível de correção M: aguenta borrão de impressão e cópia sem inflar o
       tamanho do código. */
    function matriz(texto, nivel) {
        const qr = gerador(0, nivel || 'M');
        qr.addData(String(texto));
        qr.make();
        const tamanho = qr.getModuleCount();
        const linhas = [];
        for (let l = 0; l < tamanho; l++) {
            const linha = [];
            for (let c = 0; c < tamanho; c++) linha.push(qr.isDark(l, c));
            linhas.push(linha);
        }
        return { tamanho: tamanho, linhas: linhas };
    }

    /* Junta módulos escuros vizinhos da mesma linha num retângulo só: o PDF sai
       com umas 300 formas em vez de mais de mil. Coordenadas em módulos, com a
       linha 0 no topo. */
    function retangulos(texto, nivel) {
        const m = matriz(texto, nivel);
        const formas = [];
        for (let l = 0; l < m.tamanho; l++) {
            let inicio = -1;
            for (let c = 0; c <= m.tamanho; c++) {
                const escuro = c < m.tamanho && m.linhas[l][c];
                if (escuro && inicio === -1) {
                    inicio = c;
                } else if (!escuro && inicio !== -1) {
                    formas.push({ coluna: inicio, linha: l, largura: c - inicio, altura: 1 });
                    inicio = -1;
                }
            }
        }
        return { tamanho: m.tamanho, formas: formas };
    }

    /* Mesmo QR na tela, para a coordenação ver a prévia antes de gerar. */
    function desenharNoCanvas(canvas, texto, nivel) {
        const m = matriz(texto, nivel);
        const borda = 2; /* zona de silêncio, em módulos */
        const total = m.tamanho + borda * 2;
        const lado = Math.max(1, Math.floor(canvas.width / total));
        const ctx = canvas.getContext('2d');
        canvas.width = lado * total;
        canvas.height = lado * total;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#000000';
        for (let l = 0; l < m.tamanho; l++) {
            for (let c = 0; c < m.tamanho; c++) {
                if (m.linhas[l][c]) ctx.fillRect((c + borda) * lado, (l + borda) * lado, lado, lado);
            }
        }
    }

    const api = { matriz: matriz, retangulos: retangulos, desenharNoCanvas: desenharNoCanvas };

    global.ProvasQr = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
