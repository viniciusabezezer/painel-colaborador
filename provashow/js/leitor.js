/* O leitor de cartões: recebe um quadro da câmera e devolve os cartões que
   enxergou, cada um com a letra que está em cima.

   Tudo roda no aparelho, em JavaScript puro, sem enviar imagem a lugar nenhum:
   1. tons de cinza e limiar adaptativo (cada pixel comparado com a média da
      vizinhança, para aguentar sala com luz desigual);
   2. manchas escuras ligadas (a moldura preta de cada cartão é uma mancha);
   3. os 4 cantos de cada mancha e a perspectiva (homografia) que leva o
      quadrado 7×7 do cartão até eles;
   4. leitura das 49 casas, conferência da moldura e busca do código em
      Cartao.identificar, que tolera até 2 casas erradas.
   A letra sai do ângulo do lado "A" do cartão na imagem. */
(function (global) {
    'use strict';

    const Cartao = global.Cartao || (typeof require === 'function' ? require('./cartao.js') : null);
    const LADO = Cartao.LADO;

    /* RGBA (ImageData) -> cinza */
    function cinza(dados, largura, altura) {
        const n = largura * altura;
        const g = new Uint8Array(n);
        if (dados.length === n) { g.set(dados); return g; }
        for (let i = 0, j = 0; i < n; i++, j += 4) {
            g[i] = (dados[j] * 77 + dados[j + 1] * 150 + dados[j + 2] * 29) >> 8;
        }
        return g;
    }

    /* 1 = escuro em relação à vizinhança */
    function limiar(g, w, h, raio, folga) {
        const integral = new Float64Array((w + 1) * (h + 1));
        for (let y = 0; y < h; y++) {
            let soma = 0;
            for (let x = 0; x < w; x++) {
                soma += g[y * w + x];
                integral[(y + 1) * (w + 1) + x + 1] = integral[y * (w + 1) + x + 1] + soma;
            }
        }
        const b = new Uint8Array(w * h);
        for (let y = 0; y < h; y++) {
            const y0 = Math.max(0, y - raio), y1 = Math.min(h, y + raio + 1);
            for (let x = 0; x < w; x++) {
                const x0 = Math.max(0, x - raio), x1 = Math.min(w, x + raio + 1);
                const area = (x1 - x0) * (y1 - y0);
                const s = integral[y1 * (w + 1) + x1] - integral[y0 * (w + 1) + x1] - integral[y1 * (w + 1) + x0] + integral[y0 * (w + 1) + x0];
                b[y * w + x] = g[y * w + x] * area < s - folga * area ? 1 : 0;
            }
        }
        return b;
    }

    /* Manchas escuras (vizinhança de 4). Devolve as que têm tamanho de cartão,
       com a lista dos seus pixels. */
    function manchas(b, w, h, minimo, maximo) {
        const rotulo = new Int32Array(w * h);
        const fila = new Int32Array(w * h);
        const lista = [];
        let proximo = 1;
        for (let i = 0; i < w * h; i++) {
            if (!b[i] || rotulo[i]) continue;
            let ini = 0, fim = 0;
            fila[fim++] = i;
            rotulo[i] = proximo;
            let x0 = w, x1 = 0, y0 = h, y1 = 0;
            while (ini < fim) {
                const p = fila[ini++];
                const x = p % w, y = (p - x) / w;
                if (x < x0) x0 = x; if (x > x1) x1 = x;
                if (y < y0) y0 = y; if (y > y1) y1 = y;
                if (x > 0 && b[p - 1] && !rotulo[p - 1]) { rotulo[p - 1] = proximo; fila[fim++] = p - 1; }
                if (x < w - 1 && b[p + 1] && !rotulo[p + 1]) { rotulo[p + 1] = proximo; fila[fim++] = p + 1; }
                if (y > 0 && b[p - w] && !rotulo[p - w]) { rotulo[p - w] = proximo; fila[fim++] = p - w; }
                if (y < h - 1 && b[p + w] && !rotulo[p + w]) { rotulo[p + w] = proximo; fila[fim++] = p + w; }
            }
            proximo++;
            const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
            if (fim < minimo || fim > maximo || bw < 12 || bh < 12 || bw > bh * 3 || bh > bw * 3) continue;
            lista.push({ pixels: fila.slice(0, fim), x0, x1, y0, y1 });
        }
        return lista;
    }

    /* Os 4 cantos de uma mancha quase quadrada, em sentido horário (na tela). */
    function cantos(m, w) {
        const px = m.pixels;
        const n = px.length;
        let cx = 0, cy = 0;
        for (let i = 0; i < n; i++) { const p = px[i]; cx += p % w; cy += (p - p % w) / w; }
        cx /= n; cy /= n;
        const ponto = (p) => [p % w, (p - p % w) / w];
        let a = null, d = -1;
        for (let i = 0; i < n; i++) {
            const [x, y] = ponto(px[i]);
            const dd = (x - cx) * (x - cx) + (y - cy) * (y - cy);
            if (dd > d) { d = dd; a = [x, y]; }
        }
        let c = null; d = -1;
        for (let i = 0; i < n; i++) {
            const [x, y] = ponto(px[i]);
            const dd = (x - a[0]) * (x - a[0]) + (y - a[1]) * (y - a[1]);
            if (dd > d) { d = dd; c = [x, y]; }
        }
        let b = null, e = null, db = 0, de = 0;
        const vx = c[0] - a[0], vy = c[1] - a[1];
        for (let i = 0; i < n; i++) {
            const [x, y] = ponto(px[i]);
            const s = vx * (y - a[1]) - vy * (x - a[0]);
            if (s > db) { db = s; b = [x, y]; }
            if (s < de) { de = s; e = [x, y]; }
        }
        if (!b || !e) return null;
        /* Os pixels são centros; os cantos de verdade ficam meio pixel para fora. */
        const quatro = [a, b, c, e].map(([x, y]) => {
            const dx = x - cx, dy = y - cy, l = Math.hypot(dx, dy) || 1;
            return [x + 0.5 + dx / l * 0.7, y + 0.5 + dy / l * 0.7];
        });
        quatro.sort((p, q) => Math.atan2(p[1] - cy - 0.5, p[0] - cx - 0.5) - Math.atan2(q[1] - cy - 0.5, q[0] - cx - 0.5));
        return quatro;
    }

    function quadradoRazoavel(q) {
        const lados = [0, 1, 2, 3].map((i) => Math.hypot(q[(i + 1) % 4][0] - q[i][0], q[(i + 1) % 4][1] - q[i][1]));
        const menor = Math.min(...lados), maior = Math.max(...lados);
        if (menor < 10 || maior > menor * 2.5) return false;
        /* convexo */
        let sinal = 0;
        for (let i = 0; i < 4; i++) {
            const p = q[i], r = q[(i + 1) % 4], s = q[(i + 2) % 4];
            const z = (r[0] - p[0]) * (s[1] - r[1]) - (r[1] - p[1]) * (s[0] - r[0]);
            if (!sinal) sinal = Math.sign(z); else if (Math.sign(z) !== sinal) return false;
        }
        return true;
    }

    /* Homografia que leva (0,0),(L,0),(L,L),(0,L) aos 4 cantos. */
    function homografia(q, L) {
        const origem = [[0, 0], [L, 0], [L, L], [0, L]];
        const A = [], v = [];
        for (let i = 0; i < 4; i++) {
            const [x, y] = origem[i], [u, w] = q[i];
            A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); v.push(u);
            A.push([0, 0, 0, x, y, 1, -w * x, -w * y]); v.push(w);
        }
        for (let c = 0; c < 8; c++) {
            let piv = c;
            for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
            if (Math.abs(A[piv][c]) < 1e-9) return null;
            [A[c], A[piv]] = [A[piv], A[c]]; [v[c], v[piv]] = [v[piv], v[c]];
            for (let r = 0; r < 8; r++) {
                if (r === c) continue;
                const f = A[r][c] / A[c][c];
                for (let k = c; k < 8; k++) A[r][k] -= f * A[c][k];
                v[r] -= f * v[c];
            }
        }
        const h = v.map((x, i) => x / A[i][i]);
        return (x, y) => {
            const z = h[6] * x + h[7] * y + 1;
            return [(h[0] * x + h[1] * y + h[2]) / z, (h[3] * x + h[4] * y + h[5]) / z];
        };
    }

    function amostra(g, w, h, x, y) {
        const xi = Math.min(w - 2, Math.max(0, Math.floor(x))), yi = Math.min(h - 2, Math.max(0, Math.floor(y)));
        const fx = Math.min(1, Math.max(0, x - xi)), fy = Math.min(1, Math.max(0, y - yi));
        const i = yi * w + xi;
        return g[i] * (1 - fx) * (1 - fy) + g[i + 1] * fx * (1 - fy) + g[i + w] * (1 - fx) * fy + g[i + w + 1] * fx * fy;
    }

    /* Lê as 49 casas. Devolve o cartão identificado ou null. */
    function lerCartao(g, w, h, q) {
        const H = homografia(q, LADO);
        if (!H) return null;
        const valores = [];
        const desvios = [-0.22, 0, 0.22];
        for (let y = 0; y < LADO; y++) {
            for (let x = 0; x < LADO; x++) {
                let s = 0;
                for (const dy of desvios) for (const dx of desvios) {
                    const [u, v] = H(x + 0.5 + dx, y + 0.5 + dy);
                    s += amostra(g, w, h, u, v);
                }
                valores.push(s / 9);
            }
        }
        /* Limiar entre os dois grupos de casas (preto x branco), por k-médias. */
        let lo = Math.min(...valores), hi = Math.max(...valores);
        if (hi - lo < 30) return null;
        let corte = (lo + hi) / 2;
        for (let it = 0; it < 6; it++) {
            let a = 0, na = 0, b = 0, nb = 0;
            for (const v of valores) { if (v < corte) { a += v; na++; } else { b += v; nb++; } }
            if (!na || !nb) break;
            corte = (a / na + b / nb) / 2;
        }
        let molduraClara = 0;
        let bits = 0;
        for (let y = 0; y < LADO; y++) {
            for (let x = 0; x < LADO; x++) {
                const preta = valores[y * LADO + x] < corte;
                if (x === 0 || y === 0 || x === LADO - 1 || y === LADO - 1) {
                    if (!preta) molduraClara++;
                } else if (preta) {
                    bits |= 1 << ((y - 1) * (LADO - 2) + (x - 1));
                }
            }
        }
        if (molduraClara > 2) return null;
        const achado = Cartao.identificar(bits);
        if (!achado) return null;
        /* Lado A na imagem: depois de k giros horários, o "em cima" do cartão
           foi para o lado k da grade lida (0 cima, 1 direita, 2 baixo, 3 esquerda). */
        const meio = (i) => [(q[i][0] + q[(i + 1) % 4][0]) / 2, (q[i][1] + q[(i + 1) % 4][1]) / 2];
        const centro = [(q[0][0] + q[1][0] + q[2][0] + q[3][0]) / 4, (q[0][1] + q[1][1] + q[2][1] + q[3][1]) / 4];
        const ladoA = meio(achado.giro);
        const angulo = Math.atan2(ladoA[0] - centro[0], -(ladoA[1] - centro[1]));
        const quarto = ((Math.round(angulo / (Math.PI / 2)) % 4) + 4) % 4;
        return {
            cartao: achado.cartao,
            letra: Cartao.LETRA_POR_GIRO[quarto],
            erros: achado.erros,
            cantos: q,
            centro
        };
    }

    /* A entrada: { data, width, height } (ImageData ou cinza). */
    function lerQuadro(imagem, opcoes) {
        const o = Object.assign({ folga: 8 }, opcoes);
        const w = imagem.width, h = imagem.height;
        const g = cinza(imagem.data, w, h);
        const raio = Math.max(6, Math.round(Math.min(w, h) / 30));
        const b = limiar(g, w, h, raio, o.folga);
        const lista = manchas(b, w, h, 60, w * h / 3);
        const vistos = new Map();
        for (const m of lista) {
            const q = cantos(m, w);
            if (!q || !quadradoRazoavel(q)) continue;
            const r = lerCartao(g, w, h, q);
            if (!r) continue;
            const antes = vistos.get(r.cartao);
            if (!antes || r.erros < antes.erros) vistos.set(r.cartao, r);
        }
        return [...vistos.values()].sort((a, b) => a.cartao - b.cartao);
    }

    const Leitor = { lerQuadro, homografia, cinza, limiar };

    if (typeof module === 'object' && module.exports) module.exports = Leitor;
    else global.Leitor = Leitor;
})(typeof self !== 'undefined' ? self : this);
