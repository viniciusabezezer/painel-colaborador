/* Mídia das perguntas: imagem, gif, vídeo do YouTube (com início e fim) e
   áudio (gravado no próprio app ou de um arquivo). Imagens são reduzidas
   antes de guardar; gifs e áudios vão como vieram, até um limite de tamanho. */
(function (global) {
    'use strict';

    const LIMITE_ARQUIVO = 4 * 1024 * 1024;

    function esc(t) {
        return String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    function idYoutube(url) {
        const m = String(url || '').match(/(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/);
        return m ? m[1] : null;
    }

    /* "1:30" -> 90; "90" -> 90 */
    function segundos(t) {
        if (t == null || t === '') return null;
        const partes = String(t).trim().split(':').map(Number);
        if (partes.some((n) => !Number.isFinite(n) || n < 0)) return null;
        return partes.reduce((s, n) => s * 60 + n, 0);
    }

    function tempo(s) {
        if (s == null) return '';
        return Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
    }

    function urlSegura(src) {
        return /^(data:(image|audio|video)\/[\w.+-]+;base64,|https:\/\/)/.test(String(src || ''));
    }

    /* opcoes.tocar: no telão, o vídeo/áudio pode tocar; no editor, só prévia. */
    function html(midia, opcoes) {
        const o = opcoes || {};
        if (!midia || !midia.src) return '';
        const ajuste = midia.ajuste === 'fill' ? 'preencher' : 'caber';
        if (midia.tipo === 'imagem' || midia.tipo === 'gif') {
            if (!urlSegura(midia.src)) return '';
            return `<img class="midia midia-imagem ${ajuste}" src="${esc(midia.src)}" alt="${esc(midia.descricao || '')}">`;
        }
        if (midia.tipo === 'video') {
            const id = idYoutube(midia.src);
            if (!id) return '';
            const p = new URLSearchParams({ rel: '0', modestbranding: '1', playsinline: '1' });
            if (midia.inicio != null) p.set('start', midia.inicio);
            if (midia.fim != null) p.set('end', midia.fim);
            if (o.tocar) p.set('autoplay', '0');
            return `<div class="midia midia-video"><iframe src="https://www.youtube-nocookie.com/embed/${id}?${p}" title="Vídeo da pergunta" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>`;
        }
        if (midia.tipo === 'audio') {
            if (!urlSegura(midia.src)) return '';
            return `<div class="midia midia-audio"><span aria-hidden="true">🔊</span><audio controls preload="metadata" src="${esc(midia.src)}"></audio></div>`;
        }
        return '';
    }

    function lerComoDataURL(arquivo) {
        return new Promise((ok, falha) => {
            const r = new FileReader();
            r.onload = () => ok(r.result);
            r.onerror = () => falha(r.error);
            r.readAsDataURL(arquivo);
        });
    }

    /* Foto: reduzida a `maximo` px e JPEG (ou PNG, se tiver transparência e for pequena). */
    function reduzirImagem(arquivo, maximo) {
        return new Promise((ok, falha) => {
            const img = new Image();
            const url = URL.createObjectURL(arquivo);
            img.onload = () => {
                const escala = Math.min(1, (maximo || 900) / Math.max(img.width, img.height));
                const tela = document.createElement('canvas');
                tela.width = Math.max(1, Math.round(img.width * escala));
                tela.height = Math.max(1, Math.round(img.height * escala));
                const ctx = tela.getContext('2d');
                ctx.fillStyle = '#fff';
                ctx.fillRect(0, 0, tela.width, tela.height);
                ctx.drawImage(img, 0, 0, tela.width, tela.height);
                URL.revokeObjectURL(url);
                ok(tela.toDataURL('image/jpeg', 0.8));
            };
            img.onerror = () => { URL.revokeObjectURL(url); falha(new Error('Não consegui abrir essa imagem.')); };
            img.src = url;
        });
    }

    async function deArquivo(arquivo, maximo) {
        if (!arquivo) throw new Error('Nenhum arquivo.');
        if (/^image\/gif$/.test(arquivo.type)) {
            if (arquivo.size > LIMITE_ARQUIVO) throw new Error('Gif grande demais (máximo 4 MB).');
            return { tipo: 'gif', src: await lerComoDataURL(arquivo), ajuste: 'fit' };
        }
        if (/^image\//.test(arquivo.type)) return { tipo: 'imagem', src: await reduzirImagem(arquivo, maximo), ajuste: 'fit' };
        if (/^audio\//.test(arquivo.type)) {
            if (arquivo.size > LIMITE_ARQUIVO) throw new Error('Áudio grande demais (máximo 4 MB).');
            return { tipo: 'audio', src: await lerComoDataURL(arquivo) };
        }
        throw new Error('Tipo de arquivo não aceito. Use imagem, gif ou áudio.');
    }

    /* Gravação de áudio pelo microfone. Devolve { parar(): Promise<midia> }. */
    async function gravarAudio() {
        const fluxo = await navigator.mediaDevices.getUserMedia({ audio: true });
        const tipo = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find((t) => global.MediaRecorder && MediaRecorder.isTypeSupported(t)) || '';
        const gravador = new MediaRecorder(fluxo, tipo ? { mimeType: tipo } : undefined);
        const pedacos = [];
        gravador.ondataavailable = (e) => { if (e.data.size) pedacos.push(e.data); };
        gravador.start();
        return {
            parar: () => new Promise((ok) => {
                gravador.onstop = async () => {
                    fluxo.getTracks().forEach((t) => t.stop());
                    const blob = new Blob(pedacos, { type: gravador.mimeType || 'audio/webm' });
                    ok({ tipo: 'audio', src: await lerComoDataURL(blob) });
                };
                gravador.stop();
            })
        };
    }

    const Midia = { html, idYoutube, segundos, tempo, deArquivo, reduzirImagem, gravarAudio, urlSegura };
    if (typeof module === 'object' && module.exports) module.exports = Midia;
    else global.Midia = Midia;
})(typeof self !== 'undefined' ? self : this);
