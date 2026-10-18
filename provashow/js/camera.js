/* A câmera que lê os cartões — a mesma no scanner (celular como controle
   remoto) e no app (celular ou webcam fazendo tudo).

   Regras da leitura:
   - um cartão só vale quando aparece com a mesma letra em dois quadros
     seguidos (ou num quadro sem nenhuma casa duvidosa): não registra o
     cartão no meio do giro;
   - o aluno pode mudar de ideia: vale a última letra confirmada;
   - ao passar para a próxima pergunta, os cartões que continuam no ar com a
     resposta anterior ficam em espera até o aluno baixar (ou girar);
   - "pausar" mantém a câmera ligada sem registrar nada (o botão de ler).
   Extras: lanterna e zoom (quando o aparelho deixa), câmera da frente/de
   trás, bipe e vibração a cada cartão novo. */
(function (global) {
    'use strict';

    function criar(o) {
        const video = o.video;
        const sobre = o.sobreposicao;
        const tela = document.createElement('canvas');
        const ctx = tela.getContext('2d', { willReadFrequently: true });
        let fluxo = null;
        let lendo = false;
        let pausado = !!o.comecarPausado;
        let frente = false;
        let confirmadas = {};
        const candidatos = new Map();
        const emEspera = new Map();
        let ultimoQuadro = 0;
        let audio = null;

        function bipe() {
            if (!o.som || !o.som()) return;
            try {
                audio = audio || new (global.AudioContext || global.webkitAudioContext)();
                const osc = audio.createOscillator(), g = audio.createGain();
                osc.frequency.value = 1320;
                g.gain.setValueAtTime(0.08, audio.currentTime);
                g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.09);
                osc.connect(g).connect(audio.destination);
                osc.start();
                osc.stop(audio.currentTime + 0.1);
            } catch (erro) { /* sem som */ }
        }

        async function ligar() {
            desligarFluxo();
            fluxo = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: { facingMode: { ideal: frente ? 'user' : 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
            });
            video.srcObject = fluxo;
            video.muted = true;
            video.setAttribute('playsinline', '');
            await video.play();
            lendo = true;
            requestAnimationFrame(ciclo);
            return capacidades();
        }

        function desligarFluxo() {
            if (fluxo) fluxo.getTracks().forEach((t) => t.stop());
            fluxo = null;
        }

        function desligar() {
            lendo = false;
            desligarFluxo();
            limparMarcas();
        }

        const trilha = () => (fluxo ? fluxo.getVideoTracks()[0] : null);

        function capacidades() {
            const t = trilha();
            const c = t && t.getCapabilities ? t.getCapabilities() : {};
            return { lanterna: !!c.torch, zoom: c.zoom ? { min: c.zoom.min, max: c.zoom.max, passo: c.zoom.step || 0.1 } : null };
        }

        async function lanterna(ligada) {
            const t = trilha();
            if (!t) return false;
            try { await t.applyConstraints({ advanced: [{ torch: !!ligada }] }); return true; } catch (erro) { return false; }
        }

        async function zoom(valor) {
            const t = trilha();
            if (!t) return false;
            try { await t.applyConstraints({ advanced: [{ zoom: valor }] }); return true; } catch (erro) { return false; }
        }

        async function trocarCamera() {
            frente = !frente;
            if (lendo) await ligar();
            return frente;
        }

        function ciclo(instante) {
            if (!lendo) return;
            requestAnimationFrame(ciclo);
            if (instante - ultimoQuadro < 80 || !video.videoWidth) return;
            ultimoQuadro = instante;
            const escala = Math.min(1, 720 / Math.max(video.videoWidth, video.videoHeight));
            tela.width = Math.round(video.videoWidth * escala);
            tela.height = Math.round(video.videoHeight * escala);
            ctx.drawImage(video, 0, 0, tela.width, tela.height);
            const leituras = global.Leitor.lerQuadro(ctx.getImageData(0, 0, tela.width, tela.height));
            processar(leituras);
            desenharMarcas(leituras, escala);
        }

        function processar(leituras) {
            const agora = Date.now();
            for (const [cartao, e] of emEspera) if (agora - e.visto > 800) emEspera.delete(cartao);
            if (pausado) return;
            const alunos = o.alunos ? o.alunos() : null;
            const alternativas = o.alternativas ? o.alternativas() : 4;
            let nova = false;
            for (const l of leituras) {
                const espera = emEspera.get(l.cartao);
                if (espera) {
                    if (espera.letra === l.letra) { espera.visto = agora; continue; }
                    emEspera.delete(l.cartao);
                }
                const c = candidatos.get(l.cartao);
                const mesma = c && c.letra === l.letra && agora - c.quando < 1500;
                const vezes = (mesma ? c.vezes : 0) + (l.erros === 0 ? 2 : 1);
                candidatos.set(l.cartao, { letra: l.letra, vezes, quando: agora });
                if (vezes < 2 || confirmadas[l.cartao] === l.letra) continue;
                if (alunos && !alunos.has(l.cartao)) continue;
                if ('ABCD'.indexOf(l.letra) >= alternativas) continue;
                const primeira = !confirmadas[l.cartao];
                confirmadas[l.cartao] = l.letra;
                if (primeira) nova = true;
                if (o.aoConfirmar) o.aoConfirmar(l.cartao, l.letra, primeira);
            }
            if (nova) {
                if (navigator.vibrate) navigator.vibrate(12);
                bipe();
            }
        }

        function novaPergunta(respostasJaDadas) {
            const agora = Date.now();
            emEspera.clear();
            for (const [cartao, c] of candidatos) if (agora - c.quando < 1500) emEspera.set(cartao, { letra: c.letra, visto: c.quando });
            candidatos.clear();
            confirmadas = Object.assign({}, respostasJaDadas || {});
        }

        function limparMarcas() {
            if (!sobre) return;
            const g = sobre.getContext('2d');
            g.clearRect(0, 0, sobre.width, sobre.height);
        }

        function desenharMarcas(leituras, escala) {
            if (!sobre) return;
            const r = video.getBoundingClientRect();
            const dpr = global.devicePixelRatio || 1;
            sobre.width = Math.round(r.width * dpr);
            sobre.height = Math.round(r.height * dpr);
            const g = sobre.getContext('2d');
            g.setTransform(dpr, 0, 0, dpr, 0, 0);
            const vw = video.videoWidth * escala, vh = video.videoHeight * escala;
            const cobrir = getComputedStyle(video).objectFit !== 'contain';
            const k = cobrir ? Math.max(r.width / vw, r.height / vh) : Math.min(r.width / vw, r.height / vh);
            const ox = (r.width - vw * k) / 2, oy = (r.height - vh * k) / 2;
            /* o vídeo não é espelhado na tela (nem a câmera da frente): o
               cartão aparece como a câmera o vê, com a letra certa em cima */
            const px = (x) => ox + x * k;
            const alunos = o.alunos ? o.alunos() : null;
            const mostrarLetra = o.mostrarLetras ? o.mostrarLetras() : true;
            for (const l of leituras) {
                const daTurma = !alunos || alunos.has(l.cartao);
                const esperando = emEspera.has(l.cartao);
                const ok = confirmadas[l.cartao] === l.letra;
                const cinza = !daTurma || esperando || pausado;
                g.beginPath();
                l.cantos.forEach(([x, y], i) => (i ? g.lineTo : g.moveTo).call(g, px(x), oy + y * k));
                g.closePath();
                g.lineWidth = 4;
                g.strokeStyle = cinza ? 'rgba(200,200,200,.85)' : ok ? '#2ecc71' : '#f5b700';
                g.fillStyle = cinza ? 'rgba(120,120,120,.25)' : ok ? 'rgba(46,204,113,.3)' : 'rgba(245,183,0,.2)';
                g.fill();
                g.stroke();
                const cx = px(l.centro[0]), cy = oy + l.centro[1] * k;
                const nome = alunos && alunos.get(l.cartao);
                const rotulo = !daTurma ? '#' + l.cartao + ' (sem aluno)' : esperando ? 'baixe o cartão' : ((nome || '#' + l.cartao).split(' ')[0]);
                g.font = '700 15px Outfit, system-ui, sans-serif';
                g.textAlign = 'center';
                const larg = g.measureText(rotulo).width + 14;
                g.fillStyle = 'rgba(28,22,48,.85)';
                g.fillRect(cx - larg / 2, cy - 30, larg, 22);
                g.fillStyle = '#fff';
                g.fillText(rotulo, cx, cy - 14);
                if (daTurma && !esperando && !pausado) {
                    g.font = '800 26px Outfit, system-ui, sans-serif';
                    g.fillText(mostrarLetra ? l.letra : '✓', cx, cy + 16);
                }
            }
        }

        return {
            ligar, desligar, lanterna, zoom, trocarCamera, capacidades, novaPergunta,
            pausar(sim) { pausado = !!sim; if (pausado) candidatos.clear(); },
            pausado: () => pausado,
            ligada: () => lendo,
            confirmadas: () => Object.assign({}, confirmadas),
            esquecer(cartao) { delete confirmadas[cartao]; },
            /* testes: uma imagem qualquer como se fosse da câmera */
            lerImagem(imagem) { const l = global.Leitor.lerQuadro(imagem); processar(l); return l; }
        };
    }

    global.Camera = { criar };
})(typeof self !== 'undefined' ? self : this);
