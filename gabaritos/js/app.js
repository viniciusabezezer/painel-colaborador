/* Malu Gabaritos — telas. O cartão lido é o gabarito do Montador. */
(function () {
    'use strict';

    var U = window.U;
    var esc = U.esc;
    var ic = U.ic;
    var telaEl = document.getElementById('tela');
    var navEl = document.getElementById('nav');
    var faixa = document.getElementById('faixa');
    var CHAVE = 'malu-gabaritos-estado';

    var st = carregar();

    function carregar() {
        var base = {
            modo: 'demo',
            perfil: null,
            provaSel: 'demo-cn',
            ajustes: { limiar: 0.55, fonteMaior: false, contraste: false },
            historicoChave: {},
            provas: [],
            leituras: [],
            recuperacoes: {},
            envios: []
        };
        try {
            var g = JSON.parse(localStorage.getItem(CHAVE) || 'null');
            if (g && g.ajustes) base.ajustes = Object.assign(base.ajustes, g.ajustes);
            if (g && g.historicoChave) base.historicoChave = g.historicoChave;
        } catch (e) { /* estado novo */ }
        return base;
    }

    function persistir() {
        localStorage.setItem(CHAVE, JSON.stringify({
            ajustes: st.ajustes,
            historicoChave: st.historicoChave,
            modo: st.modo
        }));
        document.documentElement.classList.toggle('fonte-maior', !!st.ajustes.fonteMaior);
        document.documentElement.classList.toggle('alto-contraste', !!st.ajustes.contraste);
    }

    function semearDemo() {
        var d = MaluDemo.montar();
        st.modo = 'demo';
        st.perfil = d.professor;
        st.provas = d.provas;
        st.leituras = d.leituras;
        st.recuperacoes = d.recuperacoes;
        st.envios = d.envios || [];
        if (!st.provas.some(function (p) { return p.id === st.provaSel; })) st.provaSel = d.provas[0].id;
    }

    function provaAtual() {
        return st.provas.filter(function (p) { return p.id === st.provaSel; })[0] || st.provas[0];
    }

    function comCodigo(p) { return !!(p && p.codigoVerificacao); }

    function podeCorrigir(p) {
        if (st.modo === 'demo') return true;
        var eu = st.perfil;
        if (!eu || !p) return false;
        if (eu.papel === 'gestao') return false;
        if (eu.papel === 'pca' && eu.area === p.componente) return true;
        if (eu.papel === 'professor') {
            if ((p.codigos || []).some(function (c) { return c.professorId && c.professorId === eu.id; })) return true;
            if ((p.secoes || []).some(function (s) { return s.responsavel === eu.id; })) return true;
        }
        return false;
    }

    function podeEnviarPresente(p) {
        return !!(globalThis.MaluPresente && MaluPresente.podeEnviar(st.perfil, p));
    }

    function enviosDa(provaId) {
        return (st.envios || []).filter(function (e) { return e.provaId === provaId; });
    }

    function consultaDe(nome) {
        var q = {};
        String(st.consulta || '').split('&').forEach(function (par) {
            if (!par) return;
            var p = par.split('=');
            q[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || '');
        });
        return q[nome] || '';
    }

    function leiturasDa(provaId) {
        return st.leituras.filter(function (l) { return l.provaId === provaId; });
    }

    function hoje() { return new Date().toISOString().slice(0, 10); }

    function notaDe(l, p) {
        return MaluAnalise.notaLeitura(l, p);
    }

    /* Quem errou ou deixou o código em branco deve 1 ponto. A nota registrada
       continua com esse −1. A situação (aberto, recuperado, não recuperado)
       só acompanha o que o professor já resolveu no registro dele. */
    function devePonto(l) {
        return l.statusCodigo === 'incorreto' || l.statusCodigo === 'em_branco';
    }

    function situacaoPonto(l, p) {
        if (!devePonto(l)) return null;
        var rec = MaluAnalise.recuperacaoEfetiva(st.recuperacoes[l.id], hoje()) || { status: 'aberta', prazo: p.prazoNotas };
        return rec;
    }

    function rotuloPonto(rec) {
        if (!rec || rec.status === 'aberta') return 'Aberto';
        if (rec.status === 'recuperada') return 'Recuperado — ajuste a nota no seu registro';
        return 'Não recuperado';
    }

    function nomeModalidade(id) {
        return { a_tarefa: 'tarefa avulsa', b_restaurativa: 'medida restaurativa', c_oral: 'mini teste oral' }[id] || '';
    }

    function alunoDe(p, l) {
        return (p.alunos || []).filter(function (a) { return a.id === l.alunoId || (a.copiaId === l.copiaId && a.turma === l.turma); })[0];
    }

    function nomeVisivel(p, l) {
        if (!p || !l || !globalThis.MaluListas) return l && l.nome;
        var achado = (p.alunos || []).filter(function (a) {
            return MaluListas.turmaCurta(a.turma) === MaluListas.turmaCurta(l.turma) && Number(a.lista) === Number(l.lista);
        })[0];
        return (achado && achado.nome) || l.nome;
    }

    function turmasDe(p) {
        var mapa = {};
        (p.alunos || []).forEach(function (a) {
            var id = a.turma + '|' + a.sala;
            if (!mapa[id]) mapa[id] = { id: id, nome: a.turma, sala: a.sala, total: 0, lidas: 0 };
            mapa[id].total++;
        });
        leiturasDa(p.id).forEach(function (l) {
            var id = l.turma + '|' + l.sala;
            if (mapa[id]) mapa[id].lidas++;
        });
        return Object.keys(mapa).map(function (k) { return mapa[k]; });
    }

    function pendentes(p) {
        return leiturasDa(p.id).filter(function (l) {
            return l.revisar || (l.alertas && l.alertas.length) || l.statusCodigo === 'ambiguo' ||
                Object.keys(l.respostas || {}).some(function (q) {
                    var r = l.respostas[q];
                    return r && (r.status === 'ambigua' || r.status === 'dupla');
                });
        });
    }

    function comDivida(p) {
        if (!comCodigo(p)) return [];
        return leiturasDa(p.id).filter(devePonto);
    }

    function emAberto(p) {
        return comDivida(p).filter(function (l) {
            var rec = situacaoPonto(l, p);
            return !rec || rec.status === 'aberta';
        });
    }

    /* ---------- navegação ---------- */

    function rotear() {
        var hash = (location.hash || '#/inicio').replace(/^#\/?/, '');
        var consulta = '';
        if (hash.indexOf('?') !== -1) {
            consulta = hash.slice(hash.indexOf('?') + 1);
            hash = hash.slice(0, hash.indexOf('?'));
        }
        var partes = hash.split('/').filter(Boolean);
        var nome = partes[0] || 'inicio';
        st.consulta = consulta;
        var fn = telas[nome] || telas.inicio;
        var tela = fn(partes);
        telaEl.innerHTML = tela.html;
        if (tela.montar) tela.montar(telaEl);
        desenharNav(nome);
        faixa.hidden = st.modo !== 'demo';
        faixa.textContent = st.modo === 'demo' ? 'Demonstração · dados fictícios · nada foi gravado no servidor' : '';
        persistir();
    }

    function desenharNav(nome) {
        var p = provaAtual();
        var rev = p ? pendentes(p).length : 0;
        var itens = [
            ['inicio', 'casa', 'Início'],
            ['escanear', 'camera', 'Escanear'],
            ['revisar', 'revisar', 'Revisar'],
            ['resultados', 'grafico', 'Resultados'],
            ['ajustes', 'ajustes', 'Ajustes']
        ];
        navEl.innerHTML = itens.map(function (it) {
            var atual = (nome === it[0] || (it[0] === 'resultados' && (nome === 'aluno' || nome === 'itens' || nome === 'ponto' || nome === 'exportar'))) ? ' aria-current="page"' : '';
            var badge = it[0] === 'revisar' && rev ? '<span class="badge">' + rev + '</span>' : '';
            return '<a href="#/' + it[0] + '"' + atual + '>' + ic(it[1], 22) + badge + it[2] + '</a>';
        }).join('');
    }

    function topo(titulo, sub, voltar) {
        return (voltar ? '<a class="voltar" href="' + voltar + '">' + ic('voltar', 20) + ' Voltar</a>' : '') +
            '<div class="cabeca-tela"><h1>' + titulo + '</h1>' + (sub ? '<p class="suave">' + sub + '</p>' : '') + '</div>';
    }

    function barra(a, b) {
        return '<div class="barra" role="progressbar" aria-valuemin="0" aria-valuemax="' + b + '" aria-valuenow="' + a + '"><i style="width:' + (b ? Math.round(a / b * 100) : 0) + '%"></i></div>';
    }

    function seloCodigo(p) {
        return comCodigo(p) ? '<span class="chip laranja">Com código</span>' : '<span class="chip neutro">Sem código</span>';
    }

    function fmtNota(n) { return n == null || n.nota == null ? '—' : U.fmt(n.nota); }

    /* ---------- início ---------- */

    var telas = {};

    telas.inicio = function () {
        var nome = (st.perfil && (st.perfil.primeiro || st.perfil.nome)) || 'professor';
        var cards = st.provas.map(function (p) {
            var lidas = leiturasDa(p.id).length;
            var total = (p.alunos || []).length || lidas;
            return '<a class="cartao clicavel prova-card" href="#/prova" data-prova="' + esc(p.id) + '">' +
                '<div class="linha entre"><h3>' + esc(p.titulo) + '</h3><span class="chip">Travada</span></div>' +
                '<div class="linha" style="margin-top:6px">' + seloCodigo(p) +
                '<span class="chip neutro">' + esc(p.serie) + 'ª série</span><span class="chip neutro">' + esc(p.componenteNome || p.componente) + '</span></div>' +
                barra(lidas, total) + '<p class="suave" style="margin:6px 0 0">' + lidas + ' de ' + total + ' cartões lidos</p></a>';
        }).join('');
        var p = provaAtual();
        return {
            html: '<div class="pilha"><div class="ola"><h1>Olá, ' + esc(nome) + '</h1><p class="suave">Estas provas vieram do Montador. Escolha uma para corrigir os cartões.</p></div>' +
                (st.modo === 'demo' ? '<div class="aviso">' + ic('alerta') + '<span>Isto é uma demonstração com estudantes fictícios. Para usar uma prova de verdade, entre com a mesma conta do Montador.</span></div>' : '') +
                '<a class="btn primario grande" href="#/prova" data-prova="' + esc(p ? p.id : '') + '">' + ic('camera') + ' Corrigir cartões</a>' +
                '<h2>Suas provas</h2><div class="grade c2">' + (cards || '<p class="suave">Nenhuma prova travada para você.</p>') + '</div>' +
                '<h2>Atalhos</h2><div class="atalhos">' +
                '<a class="btn" href="#/enviar">' + ic('enviar', 20) + ' Enviar fotos</a>' +
                (p && comCodigo(p) ? '<a class="btn" href="#/ponto">' + ic('alerta', 20) + ' Ponto devido</a>' : '') +
                '<a class="btn" href="#/exportar">' + ic('baixar', 20) + ' Exportar CSV</a>' +
                (p && podeEnviarPresente(p) ? '<a class="btn" href="#/presente">' + ic('enviar', 20) + ' Notas no Malu Presente</a>' : '') +
                (st.modo === 'demo' ? '<a class="btn" href="#/entrar">' + ic('pessoa', 20) + ' Entrar</a>' : '<button class="btn" id="sair" type="button">' + ic('semrede', 20) + ' Sair</button>') +
                '</div></div>',
            montar: function (el) {
                el.querySelectorAll('[data-prova]').forEach(function (a) {
                    a.addEventListener('click', function () { st.provaSel = a.getAttribute('data-prova'); });
                });
                var sair = el.querySelector('#sair');
                if (sair) sair.onclick = async function () { await MaluNuvem.sair(); semearDemo(); location.hash = '#/inicio'; rotear(); };
            }
        };
    };

    telas.entrar = function () {
        return {
            html: '<div class="pilha">' + topo('Entrar', 'Use o mesmo e-mail e a mesma senha do Montador.', '#/inicio') +
                '<form class="cartao pilha" id="form-entrar"><label class="rotulo" for="email">E-mail</label><input class="campo" id="email" type="email" autocomplete="username" required>' +
                '<label class="rotulo" for="senha">Senha</label><input class="campo" id="senha" type="password" autocomplete="current-password" required>' +
                '<p class="aviso erro" id="erro-entrar" hidden></p>' +
                '<button class="btn primario grande" type="submit">Entrar</button></form>' +
                '<button class="btn bloco" type="button" id="ficar-demo">Continuar na demonstração</button></div>',
            montar: function (el) {
                el.querySelector('#ficar-demo').onclick = function () { semearDemo(); location.hash = '#/inicio'; };
                el.querySelector('#form-entrar').onsubmit = async function (e) {
                    e.preventDefault();
                    var erro = el.querySelector('#erro-entrar');
                    erro.hidden = true;
                    try {
                        await MaluNuvem.entrar(el.querySelector('#email').value, el.querySelector('#senha').value);
                        await carregarConta();
                        location.hash = '#/inicio';
                    } catch (falha) {
                        erro.hidden = false;
                        erro.textContent = falha.message || 'Não entrou. Confira o e-mail e a senha.';
                    }
                };
            }
        };
    };

    telas.prova = function () {
        var p = provaAtual();
        if (!p) return { html: topo('Nenhuma prova', '', '#/inicio') + '<p>Não há prova travada.</p>' };
        var turmas = turmasDe(p).map(function (t) {
            return '<a class="cartao clicavel turma-linha" href="#/resultados?turma=' + encodeURIComponent(t.id) + '"><div class="linha entre"><h3>' + esc(t.nome) + ' · sala ' + esc(t.sala) + '</h3><span class="chip">' + t.lidas + ' de ' + t.total + '</span></div>' + barra(t.lidas, t.total) + '</a>';
        }).join('');
        var chave = Object.keys(p.gabarito).map(function (q) {
            return '<span><b>' + q + '</b><strong>' + esc(p.gabarito[q]) + '</strong></span>';
        }).join('');
        var corrige = podeCorrigir(p);
        return {
            html: '<div class="pilha">' + topo(esc(p.titulo), esc(p.serie) + 'ª série · ' + esc(p.componenteNome) + ' · <span class="chip">Travada</span> ' + seloCodigo(p), '#/inicio') +
                (!corrige ? '<div class="aviso">' + ic('alerta') + '<span>A coordenação vê o resultado. Quem corrige é o professor da turma e o PCA da área.</span></div>' : '') +
                (!comCodigo(p) ? '<div class="aviso">' + ic('alerta') + '<span>Esta prova não tem código de verificação. A nota é só das questões.</span></div>' : '') +
                '<div class="grade c2">' + turmas + '</div>' +
                (corrige ? '<div class="acoes3"><a class="btn primario grande" href="#/escanear">' + ic('camera') + ' Escanear com a câmera</a>' +
                    '<a class="btn grande" href="#/enviar">' + ic('enviar') + ' Enviar fotos</a>' +
                    '<a class="btn grande" href="#/resultados">' + ic('grafico') + ' Ver resultados</a></div>' :
                    '<a class="btn primario grande" href="#/resultados">' + ic('grafico') + ' Ver resultados</a>') +
                (podeEnviarPresente(p) ? '<a class="btn laranja grande" href="#/presente">' + ic('enviar') + ' Enviar notas para o Malu Presente</a>' : '') +
                (globalThis.MaluListas && MaluListas.podePedir(st.perfil) ? '<a class="btn grande" href="#/lista">' + ic('pessoa') + ' Puxar lista do Malu Presente</a>' : '') +
                '<section class="cartao"><div class="linha entre"><h2>Chave do Montador</h2>' +
                (corrige ? '<button class="btn mini" type="button" id="corrigir-chave">' + ic('chave', 20) + ' Corrigir a chave</button>' : '') +
                '</div><p class="suave">Se uma resposta da chave estiver errada, corrija aqui. As notas são recalculadas e a mudança fica registrada.</p><div class="chave">' + chave + '</div></section></div>',
            montar: function (el) {
                var b = el.querySelector('#corrigir-chave');
                if (b) b.onclick = function () { abrirChave(p); };
            }
        };
    };

    function abrirChave(p) {
        var qs = Object.keys(p.gabarito);
        var q = qs[0];
        var op = qs.map(function (n) { return '<option value="' + n + '">Questão ' + n + ' (atual: ' + p.gabarito[n] + ')</option>'; }).join('');
        U.folha('Corrigir a chave',
            '<label class="rotulo" for="sel-q">Qual questão?</label><select class="campo" id="sel-q">' + op + '</select>' +
            '<div class="opcoes-resp" id="letras"></div><p class="suave" id="efeito"></p>' +
            '<button class="btn primario grande" type="button" id="salvar-chave">Corrigir e recalcular</button>',
            function (f) {
                var nova = p.gabarito[q];
                function pintar() {
                    f.querySelector('#letras').innerHTML = 'ABCDE'.split('').map(function (L) {
                        return '<button type="button" class="btn" data-l="' + L + '" aria-pressed="' + (L === nova) + '">' + L + '</button>';
                    }).join('');
                    f.querySelectorAll('#letras .btn').forEach(function (b) {
                        b.onclick = function () { nova = b.dataset.l; pintar(); };
                    });
                }
                pintar();
                f.querySelector('#sel-q').onchange = function (e) { q = e.target.value; nova = p.gabarito[q]; pintar(); };
                f.querySelector('#salvar-chave').onclick = async function () {
                    if (nova === p.gabarito[q]) { U.toast('Essa já é a resposta da chave.'); return; }
                    var de = p.gabarito[q];
                    p.gabarito[q] = nova;
                    st.historicoChave[p.id] = st.historicoChave[p.id] || [];
                    st.historicoChave[p.id].push({ questao: q, de: de, para: nova, quando: U.agora(), por: st.perfil.nome });
                    if (st.modo !== 'demo') await MaluNuvem.salvarChave({ provaId: p.id, questao: Number(q), de: de, para: nova });
                    U.fecharFolha();
                    U.toast('Chave corrigida. Notas recalculadas.');
                    rotear();
                };
            });
    }

    /* ---------- escanear e enviar ---------- */

    var cameraParada = true;

    telas.escanear = function () {
        var p = provaAtual();
        if (!p || !podeCorrigir(p)) return { html: topo('Escanear', '', '#/prova') + '<div class="aviso">' + ic('alerta') + '<span>Só o professor da turma e o PCA corrigem.</span></div>' };
        return {
            html: '<div class="pilha">' + topo('Escanear', esc(p.titulo), '#/prova') +
                avisoFoto() +
                '<div class="camera" id="camera"><video id="video" playsinline autoplay muted></video><div class="moldura"><i class="canto tl"></i><i class="canto tr"></i><i class="canto bl"></i><i class="canto br"></i></div><div class="dica"><span id="dica-cam">Aponte para o cartão inteiro.</span></div><div class="flash" id="flash"></div></div>' +
                '<div class="camera-barra"><button class="btn" type="button" id="parar">' + ic('pausa', 20) + ' Parar</button><a class="btn" href="#/enviar">' + ic('enviar', 20) + ' Enviar fotos</a></div>' +
                '<p class="suave" id="cam-erro" hidden></p><ul class="fila-lidos" id="fila-cam"></ul></div>',
            montar: function (el) { iniciarCamera(el, p); },
            desmontar: pararCamera
        };
    };

    function avisoFoto() {
        return '<div class="aviso">' + ic('alerta') + '<span>A foto do cartão fica guardada por 3 dias e depois é apagada. Depois disso, para ler de novo, é preciso fotografar o cartão outra vez. As respostas e a nota continuam guardadas.</span></div>';
    }

    function pararCamera() {
        cameraParada = true;
        var v = document.getElementById('video');
        if (v && v.srcObject) {
            v.srcObject.getTracks().forEach(function (t) { t.stop(); });
            v.srcObject = null;
        }
    }

    async function iniciarCamera(el, p) {
        cameraParada = false;
        var video = el.querySelector('#video');
        var dica = el.querySelector('#dica-cam');
        var erro = el.querySelector('#cam-erro');
        try {
            var stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
            video.srcObject = stream;
            await video.play();
        } catch (e) {
            erro.hidden = false;
            erro.textContent = 'A câmera não abriu neste aparelho. Envie as fotos pelo botão ao lado.';
            return;
        }
        var estavel = [];
        var ultimo = 0;
        var canvas = document.createElement('canvas');
        function quadro() {
            if (cameraParada) return;
            requestAnimationFrame(quadro);
            var agora = Date.now();
            if (agora - ultimo < 280 || !video.videoWidth) return;
            ultimo = agora;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            var ctx = canvas.getContext('2d', { willReadFrequently: true });
            ctx.drawImage(video, 0, 0);
            var img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            var geo = MontarGabarito.geometria({ total: Object.keys(p.gabarito).length, alternativas: p.alternativas || 5 });
            var lido = MaluOMR.ler(img, geo, { codigo: comCodigo(p), limiarMarcada: st.ajustes.limiar });
            var nitido = nitidez(img);
            var cantos = el.querySelectorAll('.canto');
            cantos.forEach(function (c) { c.classList.toggle('aceso', !!(lido.ok && nitido > 12)); });
            if (!lido.ok || nitido < 12) {
                estavel = [];
                dica.textContent = lido.ok ? 'Chegue mais perto: a foto está tremida.' : 'Enquadre o cartão inteiro, com as marcas pretas visíveis.';
                return;
            }
            var chave = (lido.lista && lido.lista.numero) + '|' + (lido.codigo && lido.codigo.texto);
            estavel.push(chave);
            if (estavel.length > 3) estavel.shift();
            dica.textContent = estavel.length < 3 ? 'Segure firme…' : 'Lendo…';
            if (estavel.length === 3 && estavel.every(function (x) { return x === chave; })) {
                estavel = [];
                el.querySelector('#flash').classList.remove('vai');
                void el.querySelector('#flash').offsetWidth;
                el.querySelector('#flash').classList.add('vai');
                var jpeg = canvas.toDataURL('image/jpeg', 0.7);
                registrar(p, lido, jpeg);
                var li = document.createElement('li');
                li.innerHTML = '<span>Lista ' + esc(lido.lista && lido.lista.numero) + '</span><span>' + esc(resumoCurto(p, lido)) + '</span>';
                el.querySelector('#fila-cam').prepend(li);
                U.toast(resumoCurto(p, lido));
            }
        }
        requestAnimationFrame(quadro);
    }

    function nitidez(img) {
        var g = img.data;
        var w = img.width;
        var h = img.height;
        var passo = Math.max(4, Math.floor(Math.min(w, h) / 80));
        var vals = [];
        for (var y = passo; y < h - passo; y += passo) {
            for (var x = passo; x < w - passo; x += passo) {
                var i = (y * w + x) * 4;
                var c = g[i];
                var l = g[i - 4] + g[i + 4] + g[i - w * 4] + g[i + w * 4] - 4 * c;
                vals.push(l);
            }
        }
        if (!vals.length) return 0;
        var m = vals.reduce(function (s, n) { return s + n; }, 0) / vals.length;
        return vals.reduce(function (s, n) { return s + (n - m) * (n - m); }, 0) / vals.length;
    }

    function resumoCurto(p, lido) {
        var ac = 0;
        var total = Object.keys(p.gabarito).length;
        Object.keys(p.gabarito).forEach(function (q) {
            var r = lido.respostas[q];
            if (r && r.status === 'marcada' && r.valor === p.gabarito[q]) ac++;
        });
        var cod = '';
        if (comCodigo(p) && lido.codigo) {
            var stc = MontarCodigo.conferir(codigoEsperado(p, lido), lido.codigo);
            cod = stc === 'correto' ? ' · código certo' : (stc === 'em_branco' ? ' · código em branco' : ' · código ' + stc);
        }
        return ac + '/' + total + ' acertos' + cod;
    }

    function codigoEsperado(p, lidoOuLista, turma) {
        var lista = typeof lidoOuLista === 'number' ? lidoOuLista : (lidoOuLista.lista && lidoOuLista.lista.numero);
        var achados = (p.codigos || []).filter(function (c) { return c.lista === lista && (!turma || c.turma === turma); });
        return achados[0] ? achados[0].codigo : '';
    }

    function registrar(p, lido, jpeg) {
        var lista = lido.lista && lido.lista.numero;
        var candidatos = (p.alunos || []).filter(function (a) { return a.lista === lista; });
        var aluno = candidatos[0];
        if (candidatos.length > 1) aluno = candidatos[0];
        var status = null;
        var codigoLido = null;
        if (comCodigo(p)) {
            codigoLido = lido.codigo ? lido.codigo.texto : '';
            status = MontarCodigo.conferir(aluno ? aluno.codigo : codigoEsperado(p, lista), lido.codigo || '');
        }
        var alertas = (lido.alertas || []).slice();
        var revisar = alertas.length > 0 || status === 'ambiguo';
        Object.keys(lido.respostas || {}).forEach(function (q) {
            var r = lido.respostas[q];
            if (r && (r.status === 'ambigua' || r.status === 'dupla') && !alertas.some(function (a) { return a.campo === 'q' + q; })) {
                alertas.push({ tipo: r.status, campo: 'q' + q, detalhe: 'Questão ' + q + ' precisa de revisão.' });
                revisar = true;
            }
        });
        var id = 'lei-' + p.id + '-' + (aluno ? aluno.copiaId : ('lista-' + lista)) + '-' + Date.now().toString(36);
        var expira = new Date(Date.now() + 3 * 86400000).toISOString();
        var item = {
            id: id,
            provaId: p.id,
            alunoId: aluno ? aluno.id : null,
            nome: aluno ? aluno.nome : ('Lista ' + String(lista || '?').padStart(2, '0')),
            turma: aluno ? aluno.turma : '',
            sala: aluno ? aluno.sala : '',
            lista: lista,
            copiaId: aluno ? aluno.copiaId : null,
            respostas: lido.respostas || {},
            codigoLido: codigoLido,
            statusCodigo: status,
            alertas: alertas,
            revisar: revisar,
            lidoEm: new Date().toISOString(),
            imagemExpira: expira,
            imagemLocal: jpeg || null,
            confianca: lido.erroPx == null ? 0.5 : Math.max(0, 1 - lido.erroPx / 8)
        };
        var anterior = st.leituras.filter(function (l) {
            return l.provaId === p.id && l.copiaId && l.copiaId === item.copiaId;
        })[0];
        if (anterior && (anterior.confianca || 0) > item.confianca) return item;
        st.leituras = st.leituras.filter(function (l) { return !(l.provaId === p.id && l.copiaId && l.copiaId === item.copiaId); });
        st.leituras.push(item);
        if (comCodigo(p) && status && status !== 'correto' && status !== 'ambiguo') {
            st.recuperacoes[item.id] = { leituraId: item.id, provaId: p.id, status: 'aberta', modalidade: null, prazo: p.prazoNotas, obs: '' };
        }
        if (st.modo !== 'demo') {
            MaluNuvem.salvarLeitura(item);
            if (jpeg) {
                fetch(jpeg).then(function (r) { return r.blob(); }).then(function (blob) {
                    return MaluNuvem.enviarFoto(p.id, item.id, blob);
                }).then(function (caminho) {
                    if (!caminho) return;
                    item.imagemPath = caminho;
                    item.imagemLocal = null;
                    MaluNuvem.salvarLeitura(item);
                }).catch(function () {});
            }
        }
        guardarLocal();
        return item;
    }

    function guardarLocal() {
        try {
            var leves = st.leituras.map(function (l) {
                var c = Object.assign({}, l);
                if (c.imagemLocal && c.imagemLocal.length > 200000) c.imagemLocal = null;
                return c;
            });
            sessionStorage.setItem('malu-gabaritos-leituras', JSON.stringify({ leituras: leves, recuperacoes: st.recuperacoes, provas: st.modo === 'demo' ? null : st.provas.map(function (p) { return p.id; }) }));
        } catch (e) { /* sessão cheia: a leitura continua na memória */ }
    }

    telas.enviar = function () {
        var p = provaAtual();
        if (!p || !podeCorrigir(p)) return { html: topo('Enviar fotos', '', '#/prova') + '<p>Sem permissão para corrigir esta prova.</p>' };
        return {
            html: '<div class="pilha">' + topo('Enviar fotos', 'Várias de uma vez. PDF do scanner também entra, uma página por cartão.', '#/prova') +
                avisoFoto() +
                '<div class="soltar" id="soltar"><p><strong>Toque para escolher</strong> ou solte as fotos aqui.</p><input id="arquivos" type="file" accept="image/*,application/pdf" multiple hidden></div>' +
                '<ul class="arquivos" id="lista-arq"></ul></div>',
            montar: function (el) {
                var input = el.querySelector('#arquivos');
                var zona = el.querySelector('#soltar');
                zona.onclick = function () { input.click(); };
                zona.ondragover = function (e) { e.preventDefault(); zona.classList.add('sobre'); };
                zona.ondragleave = function () { zona.classList.remove('sobre'); };
                zona.ondrop = function (e) { e.preventDefault(); zona.classList.remove('sobre'); receberArquivos(p, e.dataTransfer.files, el.querySelector('#lista-arq')); };
                input.onchange = function () { receberArquivos(p, input.files, el.querySelector('#lista-arq')); input.value = ''; };
            }
        };
    };

    async function receberArquivos(p, files, lista) {
        var arr = Array.prototype.slice.call(files || []);
        for (var i = 0; i < arr.length; i++) {
            var file = arr[i];
            var li = document.createElement('li');
            li.innerHTML = '<span class="nome">' + esc(file.name) + '</span><span class="suave">Lendo…</span>';
            lista.appendChild(li);
            try {
                var imagens = file.type === 'application/pdf' ? await paginasPdf(file) : [await arquivoParaImagem(file)];
                var textos = [];
                for (var k = 0; k < imagens.length; k++) {
                    var lido = MaluOMR.ler(imagens[k], MontarGabarito.geometria({ total: Object.keys(p.gabarito).length, alternativas: p.alternativas || 5 }), { codigo: comCodigo(p), limiarMarcada: st.ajustes.limiar });
                    if (!lido.ok) { textos.push('Cartão ' + (k + 1) + ': não li as marcas.'); continue; }
                    registrar(p, lido, null);
                    textos.push('Cartão ' + (k + 1) + ': ' + resumoCurto(p, lido));
                }
                li.lastElementChild.textContent = textos.join(' ');
            } catch (e) {
                li.lastElementChild.textContent = 'Não consegui ler este arquivo. Se for PDF, exporte as páginas como foto.';
            }
        }
        U.toast('Envio concluído.');
    }

    function arquivoParaImagem(file) {
        return new Promise(function (ok, erro) {
            var img = new Image();
            img.onload = function () {
                var c = document.createElement('canvas');
                var escala = Math.min(1, 1600 / Math.max(img.width, img.height));
                c.width = Math.round(img.width * escala);
                c.height = Math.round(img.height * escala);
                c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
                ok(c.getContext('2d').getImageData(0, 0, c.width, c.height));
            };
            img.onerror = erro;
            img.src = URL.createObjectURL(file);
        });
    }

    async function paginasPdf(file) {
        if (!window.pdfjsLib) throw new Error('pdf');
        pdfjsLib.GlobalWorkerOptions.workerSrc = '../provas/vendor/pdf.worker.min.js';
        var pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
        var saida = [];
        for (var i = 1; i <= pdf.numPages; i++) {
            var page = await pdf.getPage(i);
            var vp = page.getViewport({ scale: 2 });
            var c = document.createElement('canvas');
            c.width = vp.width;
            c.height = vp.height;
            await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
            saida.push(c.getContext('2d').getImageData(0, 0, c.width, c.height));
        }
        return saida;
    }

    /* ---------- revisão ---------- */

    telas.revisar = function () {
        var p = provaAtual();
        var itens = p ? pendentes(p) : [];
        if (!itens.length) {
            return { html: '<div class="pilha">' + topo('Revisão', 'Nada duvidoso nesta prova.', '#/prova') + '<div class="caixa-verde"><p>Todos os cartões lidos estão definidos. Pode ir para os resultados.</p></div></div>' };
        }
        var l = itens[0];
        var campos = [];
        Object.keys(l.respostas || {}).forEach(function (q) {
            var r = l.respostas[q];
            if (r && (r.status === 'ambigua' || r.status === 'dupla')) campos.push({ tipo: 'questao', q: q, r: r });
        });
        if (l.statusCodigo === 'ambiguo') campos.push({ tipo: 'codigo' });
        var campo = campos[0];
        var botoes = '';
        if (campo && campo.tipo === 'questao') {
            botoes = '<p class="suave">Questão ' + campo.q + '. O que o aluno marcou?</p><div class="opcoes-resp">' +
                'ABCDE'.split('').map(function (L) { return '<button type="button" class="btn" data-v="' + L + '">' + L + '</button>'; }).join('') +
                '<button type="button" class="btn" data-v="">Em branco</button></div>';
        } else if (campo && campo.tipo === 'codigo') {
            botoes = '<p class="suave">Código lido: <span class="codigo-leitura">' + esc(l.codigoLido || '') + '</span></p><p class="suave">Confirme o código de 6 caracteres (letras A C E F P R T V e algarismos 3 a 9).</p><input class="campo" id="cod-rev" value="' + esc((l.codigoLido || '').replace(/[_?]/g, '')) + '" maxlength="6">';
        }
        return {
            html: '<div class="pilha">' + topo('Revisão', itens.length + ' cartão(ões) com dúvida', '#/prova') +
                '<article class="cartao revisao"><h2>' + esc(nomeVisivel(p, l)) + '</h2><p class="suave">' + esc(l.turma) + ' · lista ' + esc(l.lista) + '</p>' +
                (l.alertas || []).map(function (a) { return '<p>' + esc(a.detalhe) + '</p>'; }).join('') +
                botoes + '<button class="btn primario grande" type="button" id="resolver">Confirmar e seguir</button></article></div>',
            montar: function (el) {
                var escolha = campo && campo.tipo === 'questao' ? (campo.r.valor || '') : '';
                el.querySelectorAll('[data-v]').forEach(function (b) {
                    b.onclick = function () {
                        escolha = b.dataset.v;
                        el.querySelectorAll('[data-v]').forEach(function (x) { x.setAttribute('aria-pressed', x === b); });
                    };
                });
                el.querySelector('#resolver').onclick = function () {
                    if (campo && campo.tipo === 'questao') {
                        l.respostas[campo.q] = { valor: escolha, status: escolha ? 'marcada' : 'branca' };
                    }
                    if (campo && campo.tipo === 'codigo') {
                        l.codigoLido = (el.querySelector('#cod-rev').value || '').toUpperCase();
                        var aluno = alunoDe(p, l);
                        l.statusCodigo = MontarCodigo.conferir(aluno ? aluno.codigo : '', { texto: l.codigoLido });
                    }
                    l.alertas = (l.alertas || []).filter(function (a) {
                        if (campo && campo.tipo === 'questao') return a.campo !== 'q' + campo.q;
                        return a.tipo !== 'codigo';
                    });
                    l.revisar = pendenteAinda(l);
                    if (st.modo !== 'demo') MaluNuvem.salvarLeitura(l);
                    guardarLocal();
                    U.toast('Revisão salva.');
                    rotear();
                };
            }
        };
    };

    function pendenteAinda(l) {
        if (l.statusCodigo === 'ambiguo') return true;
        return Object.keys(l.respostas || {}).some(function (q) {
            var r = l.respostas[q];
            return r && (r.status === 'ambigua' || r.status === 'dupla');
        });
    }

    /* ---------- resultados ---------- */

    telas.resultados = function (partes) {
        var p = provaAtual();
        if (!p) return { html: '<p>Sem prova.</p>' };
        var turma = '';
        if ((st.consulta || '').indexOf('turma=') !== -1) turma = decodeURIComponent((st.consulta.split('turma=')[1] || '').split('&')[0]);
        var ls = leiturasDa(p.id).filter(function (l) { return !turma || (l.turma + '|' + l.sala) === turma; });
        var notas = ls.map(function (l) { return notaDe(l, p).nota; }).filter(function (n) { return n != null; });
        var media = notas.length ? notas.reduce(function (s, n) { return s + n; }, 0) / notas.length : null;
        var linhas = ls.map(function (l) {
            var n = notaDe(l, p);
            var chip = '';
            if (comCodigo(p)) {
                if (l.statusCodigo === 'correto') chip = '<span class="chip">código +1</span>';
                else if (l.statusCodigo === 'ambiguo') chip = '<span class="chip laranja">código em revisão</span>';
                else if (devePonto(l)) {
                    var recLista = situacaoPonto(l, p);
                    var cls = recLista && recLista.status === 'recuperada' ? 'chip laranja' : 'chip erro';
                    chip = '<span class="' + cls + '">' + esc(rotuloPonto(recLista)) + '</span>';
                }
            }
            return '<a class="aluno-item" href="#/aluno?id=' + encodeURIComponent(l.id) + '"><span><strong>' + esc(nomeVisivel(p, l)) + '</strong><br><span class="suave">lista ' + esc(l.lista) + ' · ' + esc(l.turma) + '</span></span><span class="nota">' + fmtNota(n) + '</span><span class="sub">' + chip + '</span></a>';
        }).join('');
        var dias = MaluAnalise.diasAte(p.prazoNotas, hoje());
        return {
            html: '<div class="pilha">' + topo('Resultados', esc(p.titulo), '#/prova') +
                '<div class="abas"><a href="#/resultados" aria-current="page">Alunos</a><a href="#/itens">Itens</a>' +
                (comCodigo(p) ? '<a href="#/ponto">Ponto devido</a>' : '') + '<a href="#/exportar">Exportar</a></div>' +
                (dias != null && dias <= 3 ? '<div class="aviso">' + ic('alerta') + '<span>Faltam ' + dias + ' dia(s) para o fim do prazo de lançamento das notas (' + U.dataBR(p.prazoNotas) + ').</span></div>' : '') +
                '<div class="cartao numeros"><span>Média <b>' + (media == null ? '—' : U.fmt(media)) + '</b></span><span>Lidos <b>' + ls.length + '</b></span>' +
                (comCodigo(p) ? '<span>Em aberto <b>' + emAberto(p).length + '</b></span>' : '') + '</div>' +
                '<div class="lista">' + (linhas || '<p class="suave">Nenhum cartão lido ainda.</p>') + '</div></div>'
        };
    };

    telas.aluno = function () {
        var id = decodeURIComponent(((st.consulta || '').split('id=')[1] || '').split('&')[0]);
        var l = st.leituras.filter(function (x) { return x.id === id; })[0];
        var p = l && st.provas.filter(function (x) { return x.id === l.provaId; })[0];
        if (!l || !p) return { html: topo('Aluno', '', '#/resultados') + '<p>Leitura não encontrada.</p>' };
        var n = notaDe(l, p);
        var grade = Object.keys(p.gabarito).map(function (q) {
            var r = (l.respostas || {})[q] || {};
            var ok = r.status === 'marcada' && r.valor === p.gabarito[q];
            return '<div class="' + (ok ? 'ok' : 'erra') + '"><b>' + q + '</b>' + esc(r.valor || '—') + '</div>';
        }).join('');
        var foto = l.imagemExpira ? '<p class="suave">Foto disponível até ' + U.dataBR(l.imagemExpira) + '. Depois disso é preciso fotografar de novo para reler.</p>' : '<p class="suave">Sem foto guardada. Para reler, fotografe o cartão de novo.</p>';
        var cod = '';
        var avisoNota = '';
        if (comCodigo(p)) {
            var recAluno = situacaoPonto(l, p);
            cod = '<p>Código esperado: <span class="codigo-leitura">' + esc((alunoDe(p, l) || {}).codigo || '') + '</span></p>' +
                '<p>Código lido: <span class="codigo-leitura">' + esc(l.codigoLido || '—') + '</span></p>';
            if (n.ponto === 1) cod += '<p class="suave">Código certo: +1 já está nesta nota (teto 10).</p>';
            if (recAluno) {
                var extra = recAluno.modalidade ? ' · ' + nomeModalidade(recAluno.modalidade) : '';
                var prazo = recAluno.prazo ? ' · prazo ' + U.dataBR(recAluno.prazo) : '';
                avisoNota = '<div class="aviso">' + ic('alerta') + '<span><strong>' + esc(rotuloPonto(recAluno)) + '</strong>' + esc(extra + prazo) + '. A nota acima continua com o −1. Este app não altera a nota quando o aluno recupera.</span></div>';
            }
        }
        return {
            html: '<div class="pilha">' + topo(esc(nomeVisivel(p, l)), esc(l.turma) + ' · lista ' + esc(l.lista), '#/resultados') +
                '<div class="cartao"><p class="nota" style="font-size:2rem;color:var(--verde-esc)">' + fmtNota(n) + '</p>' +
                '<p class="suave">Questões: ' + U.fmt(n.base == null ? 0 : n.base) + (n.ponto === 1 ? ' · código +1' : n.ponto === -1 ? ' · código −1, já na nota' : '') + '</p>' +
                avisoNota + cod + foto + '<div class="q-grade">' + grade + '</div></div></div>'
        };
    };

    telas.itens = function () {
        var p = provaAtual();
        var lista = MaluAnalise.itens(leiturasDa(p.id), p.gabarito);
        var cards = lista.map(function (it) {
            var dist = 'ABCDE'.split('').map(function (L) {
                var qtd = it.distratores[L] || 0;
                var max = Math.max(1, it.acertos + (it.distratores.branco || 0));
                return '<div class="dist-linha' + (L === it.gabarito ? ' gab' : '') + '"><b>' + L + '</b><span class="b"><i style="width:' + Math.round(qtd / (leiturasDa(p.id).length || 1) * 100) + '%"></i></span><span>' + qtd + '</span></div>';
            }).join('');
            return '<article class="item-q' + (it.alerta ? ' alerta' : '') + '"><div class="linha entre"><h3>Questão ' + it.questao + '</h3><span class="chip">' + esc(it.faixa) + '</span></div>' +
                '<p class="suave">Gabarito ' + it.gabarito + ' · acerto ' + Math.round(it.proporcao * 100) + '%' +
                (it.discriminacao == null ? '' : ' · discriminação ' + String(it.discriminacao).replace('.', ',')) + '</p>' +
                (it.alerta ? '<p>Esta questão separa ao contrário: quem vai bem na prova erra mais ela. Vale conferir a chave.</p>' : '') +
                '<div class="dist">' + dist + '</div></article>';
        }).join('');
        return { html: '<div class="pilha">' + topo('Análise dos itens', esc(p.titulo), '#/resultados') +
            '<div class="abas"><a href="#/resultados">Alunos</a><a href="#/itens" aria-current="page">Itens</a>' +
            (comCodigo(p) ? '<a href="#/ponto">Ponto devido</a>' : '') + '<a href="#/exportar">Exportar</a></div>' + cards + '</div>' };
    };

    telas.ponto = function () {
        var p = provaAtual();
        if (!comCodigo(p)) return { html: topo('Ponto devido', '', '#/prova') + '<p>Esta prova não tem código.</p>' };
        var dias = MaluAnalise.diasAte(p.prazoNotas, hoje());
        var lista = comDivida(p).map(function (l) {
            var rec = situacaoPonto(l, p);
            var chipCls = rec.status === 'recuperada' ? 'chip laranja' : 'chip erro';
            var modo = rec.modalidade ? ' · ' + nomeModalidade(rec.modalidade) : '';
            return '<article class="cartao"><div class="linha entre"><h3>' + esc(nomeVisivel(p, l)) + '</h3><span class="' + chipCls + '">' + esc(rotuloStatus(l.statusCodigo)) + '</span></div>' +
                '<p><strong>' + esc(rotuloPonto(rec)) + '</strong></p>' +
                '<p class="suave">' + esc(l.turma) + ' · lista ' + esc(l.lista) + esc(modo) + (rec.prazo ? ' · até ' + U.dataBR(rec.prazo) : '') + '</p>' +
                '<p class="suave">Nota registrada: ' + fmtNota(notaDe(l, p)) + ' (o −1 continua aqui).</p>' +
                (podeCorrigir(p) && rec.status === 'aberta' ? '<button class="btn mini" type="button" data-rec="' + esc(l.id) + '">Registrar recuperação</button>' : '') +
                '</article>';
        }).join('');
        return {
            html: '<div class="pilha">' + topo('Ponto devido', 'Prazo ' + U.dataBR(p.prazoNotas) + (dias != null ? ' · ' + dias + ' dia(s)' : ''), '#/resultados') +
                '<div class="aviso">' + ic('alerta') + '<span>A nota registrada já está com o −1 (piso 0). Aberto, recuperado ou não recuperado só acompanha a situação. Quando o aluno recuperar, a nota daqui não muda: ajuste a nota no seu registro. Um jeito só: tarefa, medida restaurativa ou mini teste oral.</span></div>' +
                (lista || '<p class="suave">Ninguém deve ponto nesta prova.</p>') + '</div>',
            montar: function (el) {
                el.querySelectorAll('[data-rec]').forEach(function (b) {
                    b.onclick = function () { abrirRecuperacao(p, b.dataset.rec); };
                });
            }
        };
    };

    function rotuloStatus(s) {
        return { incorreto: 'código errado', em_branco: 'código em branco', ambiguo: 'em revisão', correto: 'certo' }[s] || s || '';
    }

    function abrirRecuperacao(p, leituraId) {
        var rec = st.recuperacoes[leituraId] || { leituraId: leituraId, provaId: p.id, status: 'aberta', prazo: p.prazoNotas };
        U.folha('Recuperação',
            '<label class="radio-cartao"><input type="radio" name="mod" value="a_tarefa"> Tarefa avulsa definida pelo professor</label>' +
            '<label class="radio-cartao"><input type="radio" name="mod" value="b_restaurativa"> Medida restaurativa simples</label>' +
            '<label class="radio-cartao"><input type="radio" name="mod" value="c_oral"> Mini teste oral de 2 ou 3 perguntas</label>' +
            '<label class="rotulo" for="obs">O que foi feito e o resultado</label><textarea class="campo" id="obs"></textarea>' +
            '<p class="suave">Isto não muda a nota registrada. Se marcar como recuperado, ajuste a nota no seu registro.</p>' +
            '<button class="btn primario grande" type="button" id="aceitar">Marcar como recuperado</button>' +
            '<button class="btn" type="button" id="nao">Não recuperou</button>',
            function (f) {
                f.querySelector('#aceitar').onclick = function () { fecharRec(f, rec, 'recuperada'); };
                f.querySelector('#nao').onclick = function () { fecharRec(f, rec, 'nao_recuperada'); };
            });
    }

    async function fecharRec(f, rec, status) {
        var mod = (f.querySelector('input[name="mod"]:checked') || {}).value || null;
        if (status === 'recuperada' && !mod) { U.toast('Escolha um jeito só de recuperar.'); return; }
        rec.status = status;
        rec.modalidade = mod;
        rec.obs = f.querySelector('#obs').value;
        rec.quando = hoje();
        rec.prazo = provaAtual().prazoNotas;
        st.recuperacoes[rec.leituraId] = rec;
        if (st.modo !== 'demo') await MaluNuvem.salvarRecuperacao(rec);
        guardarLocal();
        U.fecharFolha();
        U.toast(status === 'recuperada' ? 'Recuperado — ajuste a nota no seu registro.' : 'Não recuperado. A nota continua com o −1.');
        rotear();
    }

    telas.lista = function () {
        var p = provaAtual();
        if (!p) return { html: topo('Lista', '', '#/inicio') + '<p>Não há prova.</p>' };
        if (!globalThis.MaluListas || !MaluListas.podePedir(st.perfil)) {
            return {
                html: '<div class="pilha">' + topo('Lista do Malu Presente', esc(p.titulo), '#/prova') +
                    '<div class="aviso">' + ic('alerta') + '<span>' + esc(MaluListas.mensagemRecusa(st.perfil)) + '</span></div></div>'
            };
        }
        st.listas = st.listas || {};
        st.rascunhoLista = st.rascunhoLista || {};
        var oficial = st.listas[p.id];
        var texto = st.rascunhoLista[p.id] != null ? st.rascunhoLista[p.id] : (oficial ? MaluListas.textoDaLista(oficial) : '');
        var mudancas = oficial ? MaluListas.diferencas(oficial, MaluListas.lerTexto(texto)) : [];
        return {
            html: '<div class="pilha">' + topo('Puxar lista do Malu Presente', esc(p.titulo), '#/prova') +
                '<p class="suave">O número 7 daqui é o mesmo aluno do Identificador e do Montador. Os nomes ficam só neste navegador. Ajuste a lista se precisar: vale nesta prova agora. A lista oficial só muda se a secretaria aceitar a sugestão.</p>' +
                '<p class="aviso" id="aviso-lista"' + (oficial ? '' : ' hidden') + '>' + (oficial ? 'Lista nesta tela. Ela não foi gravada no servidor.' : '') + '</p>' +
                '<button class="btn primario grande" type="button" id="puxar-lista">' + ic('baixar') + ' Puxar do Malu Presente</button>' +
                '<label class="rotulo" for="texto-lista">Lista desta prova</label>' +
                '<textarea class="campo" id="texto-lista" rows="10" spellcheck="false">' + esc(texto) + '</textarea>' +
                '<button class="btn grande" type="button" id="usar-lista">Usar nesta prova</button>' +
                '<button class="btn laranja grande" type="button" id="sugerir-lista"' + (mudancas.length ? '' : ' hidden') + '>Enviar estas mudanças como sugestão para a secretaria</button></div>',
            montar: function (el) {
                var caixa = el.querySelector('#aviso-lista');
                var area = el.querySelector('#texto-lista');
                function aviso(msg) { caixa.hidden = !msg; caixa.textContent = msg || ''; }
                function sincronizar() {
                    st.rascunhoLista[p.id] = area.value;
                    var tem = oficial && MaluListas.diferencas(oficial, MaluListas.lerTexto(area.value)).length;
                    el.querySelector('#sugerir-lista').hidden = !tem;
                }
                area.addEventListener('input', sincronizar);
                el.querySelector('#puxar-lista').onclick = async function () {
                    var botao = el.querySelector('#puxar-lista');
                    botao.disabled = true;
                    try {
                        var filtro = (p.alunos || []).map(function (a) { return a.turma; });
                        var resposta;
                        if (st.modo === 'demo') {
                            resposta = MaluListas.simular({ ano: p.ano || '2026' });
                            aviso('Demonstração com estudantes fictícios. Nada foi pedido ao Malu Presente.');
                        } else {
                            resposta = await MaluNuvem.chamarPresente({ acao: 'listas', ano: String(p.ano || '') });
                            aviso('Lista puxada. Os nomes ficam só neste navegador.');
                        }
                        var textoNovo = MaluListas.textoDaLista(resposta, filtro);
                        oficial = MaluListas.pacoteAtivo({ ano: resposta.ano, turmas: (resposta.turmas || []).filter(function (t) {
                            return !filtro.length || filtro.map(MaluListas.turmaCurta).indexOf(MaluListas.turmaCurta(t.turma)) !== -1;
                        }) });
                        st.listas[p.id] = oficial;
                        area.value = textoNovo;
                        st.rascunhoLista[p.id] = textoNovo;
                        sincronizar();
                    } catch (falha) {
                        aviso(falha.message || 'Não consegui puxar a lista.');
                    } finally {
                        botao.disabled = false;
                    }
                };
                el.querySelector('#usar-lista').onclick = function () {
                    aplicarListaNaProva(p, area.value);
                    U.toast('Lista aplicada nesta prova, só neste navegador.');
                };
                el.querySelector('#sugerir-lista').onclick = async function () {
                    var mud = MaluListas.diferencas(oficial, MaluListas.lerTexto(area.value));
                    var grupos = MaluListas.agrupar(p.ano || (oficial && oficial.ano), mud);
                    if (st.modo === 'demo') {
                        aplicarListaNaProva(p, area.value);
                        oficial = MaluListas.lerTexto(area.value);
                        st.listas[p.id] = oficial;
                        sincronizar();
                        aviso('Nesta demonstração a sugestão não sai do aparelho. Com a conta, a secretaria recebe e decide se aceita.');
                        return;
                    }
                    try {
                        var resp = await MaluNuvem.chamarPresente({ acao: 'sugestoes', ano: String(p.ano || ''), grupos: grupos });
                        aplicarListaNaProva(p, area.value);
                        oficial = MaluListas.lerTexto(area.value);
                        st.listas[p.id] = oficial;
                        sincronizar();
                        aviso('Sugestão enviada (' + (resp.enviadas || mud.length) + '). Ela só vale na lista oficial depois que a secretaria aceitar. Nesta prova, a lista nova já vale.');
                    } catch (falha) {
                        aviso(falha.message || 'Não consegui enviar a sugestão.');
                    }
                };
            }
        };
    };

    function aplicarListaNaProva(p, texto) {
        var lido = MaluListas.lerTexto(texto);
        if (!lido.turmas.length) return;
        var tocadas = {};
        lido.turmas.forEach(function (t) { tocadas[t.turma] = true; });
        var salaDe = {};
        var nomeTurma = {};
        (p.alunos || []).forEach(function (a) {
            var c = MaluListas.turmaCurta(a.turma);
            salaDe[c] = a.sala || salaDe[c] || '';
            nomeTurma[c] = a.turma;
        });
        var novos = [];
        lido.turmas.forEach(function (t) {
            var turma = nomeTurma[t.turma] || MaluListas.turmaPresente(t.turma);
            var sala = salaDe[t.turma] || '';
            t.alunos.forEach(function (a) {
                novos.push({
                    id: p.id + ':' + t.turma + ':' + a.numero,
                    nome: a.nome,
                    turma: turma,
                    sala: sala,
                    lista: a.numero,
                    copiaId: turma + '-' + String(a.numero).padStart(2, '0')
                });
            });
        });
        var mantidos = (p.alunos || []).filter(function (a) { return !tocadas[MaluListas.turmaCurta(a.turma)]; });
        p.alunos = mantidos.concat(novos);
    }

    telas.presente = function () {
        var id = consultaDe('prova');
        if (id) st.provaSel = id;
        var p = provaAtual();
        if (!p) return { html: topo('Malu Presente', '', '#/inicio') + '<p>Não há prova fechada.</p>' };
        if (!podeEnviarPresente(p)) {
            return {
                html: '<div class="pilha">' + topo('Malu Presente', esc(p.titulo), '#/prova') +
                    '<div class="aviso">' + ic('alerta') + '<span>' + esc(MaluPresente.mensagemRecusa(st.perfil, p)) + ' A administração do Malu Presente revisa e aprova antes de os pais verem.</span></div></div>'
            };
        }
        var pacote = MaluPresente.resumo(p, leiturasDa(p.id), st.recuperacoes, hoje());
        var ultimo = enviosDa(p.id)[0];
        var motivo = MaluPresente.motivoReenvio(ultimo && ultimo.ok ? ultimo.assinatura : '', pacote.notas);
        var turmas = pacote.turmas.map(function (t) {
            return '<li><strong>' + esc(t.turma) + '</strong> · ' + t.notas + (t.notas === 1 ? ' nota' : ' notas') + '</li>';
        }).join('');
        var aviso = '';
        if (pacote.bloqueado) {
            aviso = '<div class="aviso erro">' + ic('alerta') + '<span>Há ' + pacote.pendentes + (pacote.pendentes === 1 ? ' leitura' : ' leituras') + ' na revisão. O envio fica bloqueado até você resolver essa fila.</span></div>';
        } else if (motivo === 'recuperacao') {
            aviso = '<div class="aviso">' + ic('alerta') + '<span>A recuperação de alguém mudou. Pode enviar de novo. O Malu Presente atualiza só o aviso; a nota no seu registro continua a que você ajusta.</span></div>';
        } else if (motivo === 'correcoes') {
            aviso = '<div class="aviso">' + ic('alerta') + '<span>Há correção desde o último envio. Pode enviar de novo.</span></div>';
        } else if (motivo === null) {
            aviso = '<p class="suave">Estas notas já foram enviadas. Envie de novo se corrigir uma nota ou se mudar a recuperação de alguém.</p>';
        }
        var historico = enviosDa(p.id).map(function (e) {
            var fora = (e.semCorrespondencia || []).map(function (s) {
                return '<li>Turma ' + esc(s.turma) + ', lista ' + esc(s.lista) + '</li>';
            }).join('');
            return '<article class="cartao"><div class="linha entre"><h3>' + (e.ok ? 'Enviado' : 'Não enviado') + '</h3><span class="chip' + (e.ok ? '' : ' erro') + '">' + esc(U.dataBR(e.enviadoEm)) + '</span></div>' +
                '<p class="suave">' + esc(e.enviadoPorNome || '') + '</p><p class="suave" style="word-break:break-all">Lote ' + esc(e.loteId) + '</p>' +
                '<p>' + (e.recebidas == null ? '—' : e.recebidas) + ' nota(s) recebidas.</p>' +
                (e.erro ? '<p class="aviso erro">' + esc(e.erro) + '</p>' : '') +
                (fora ? '<p><strong>Sem correspondência no Malu Presente</strong></p><ul>' + fora + '</ul><p class="suave">Confira a turma e o número da lista. O nome do estudante não sai daqui.</p>' : '') +
                '</article>';
        }).join('');
        var pode = !pacote.bloqueado && motivo !== null && pacote.quantidade > 0;
        return {
            html: '<div class="pilha">' + topo('Enviar notas para o Malu Presente', esc(p.titulo), '#/prova') +
                '<p class="suave">Vão turma, número da lista e a nota já com o +1 ou o −1. Não vão nome, resposta, código nem foto. A administração do Malu Presente revisa e aprova antes de os pais verem.</p>' +
                aviso +
                '<section class="cartao"><h2>Resumo</h2><ul>' + (turmas || '<li>Nenhuma nota pronta.</li>') + '</ul>' +
                '<p><strong>' + pacote.quantidade + '</strong> ' + (pacote.quantidade === 1 ? 'nota pronta' : 'notas prontas') + '.</p></section>' +
                '<button class="btn primario grande" type="button" id="enviar-presente"' + (pode ? '' : ' disabled') + '>' + ic('enviar') +
                (ultimo && ultimo.ok ? ' Enviar de novo' : ' Enviar notas para o Malu Presente') + '</button>' +
                (historico ? '<h2>Envios</h2>' + historico : '') +
                '</div>',
            montar: function (el) {
                var botao = el.querySelector('#enviar-presente');
                if (!botao) return;
                botao.onclick = function () {
                    var atual = MaluPresente.resumo(p, leiturasDa(p.id), st.recuperacoes, hoje());
                    if (atual.bloqueado || !atual.notas.length) return;
                    var linhas = atual.turmas.map(function (t) {
                        return '<li>' + esc(t.turma) + ' · ' + t.notas + (t.notas === 1 ? ' nota' : ' notas') + '</li>';
                    }).join('');
                    U.folha('Confirmar envio',
                        '<p>Enviar <strong>' + atual.quantidade + '</strong> ' + (atual.quantidade === 1 ? 'nota' : 'notas') + ' de ' + esc(p.titulo) + '?</p><ul>' + linhas + '</ul>' +
                        '<p class="suave">A nota registrada segue com o +1 ou o −1. Recuperar um ponto não muda esse número aqui.</p>' +
                        '<button class="btn primario grande" type="button" id="confirmar-presente">Enviar agora</button>',
                        function (f) {
                            f.querySelector('#confirmar-presente').onclick = async function () {
                                var btn = f.querySelector('#confirmar-presente');
                                btn.disabled = true;
                                try {
                                    var resp;
                                    if (st.modo === 'demo') {
                                        resp = MaluPresente.simular(atual, '77777777-7777-4777-8777-777777777777').body;
                                    } else {
                                        resp = await MaluNuvem.enviarPresente(p.id);
                                    }
                                    st.envios.unshift({
                                        provaId: p.id,
                                        loteId: resp.lote_id,
                                        enviadoPorNome: st.perfil.nome,
                                        enviadoEm: new Date().toISOString(),
                                        recebidas: resp.recebidas,
                                        semCorrespondencia: resp.sem_correspondencia || [],
                                        assinatura: resp.assinatura || MaluPresente.assinatura(atual.notas),
                                        ok: true,
                                        erro: null
                                    });
                                    U.fecharFolha();
                                    var fora = (resp.sem_correspondencia || []).length;
                                    U.toast(fora ? 'Enviado. ' + fora + ' sem correspondência.' : 'Notas enviadas ao Malu Presente.');
                                    rotear();
                                } catch (falha) {
                                    btn.disabled = false;
                                    U.toast(falha.message || 'Não consegui enviar.');
                                }
                            };
                        });
                };
            }
        };
    };

    telas.exportar = function () {
        var p = provaAtual();
        return {
            html: '<div class="pilha">' + topo('Exportar', esc(p.titulo), '#/resultados') +
                '<p class="suave">O arquivo traz turma, lista, nome e a nota já com o +1 ou o −1. A recuperação sai numa coluna à parte (aberto, recuperado ou não recuperado) e não altera essa nota. Não leva foto.</p>' +
                '<button class="btn primario grande" type="button" id="baixar">' + ic('baixar') + ' Baixar CSV</button></div>',
            montar: function (el) {
                el.querySelector('#baixar').onclick = function () {
                    var cab = ['turma', 'sala', 'lista', 'nome', 'acertos', 'nota'];
                    if (comCodigo(p)) cab.push('codigo', 'situacao_codigo', 'ponto', 'modalidade', 'prazo');
                    var linhas = [cab];
                    leiturasDa(p.id).forEach(function (l) {
                        var n = notaDe(l, p);
                        var cont = MaluAnalise.acertosDe(l.respostas, p.gabarito);
                        var row = [l.turma, l.sala, l.lista, nomeVisivel(p, l), cont.acertos, n.nota == null ? '' : String(n.nota).replace('.', ',')];
                        if (comCodigo(p)) {
                            var recCsv = situacaoPonto(l, p);
                            var ponto = !recCsv ? (l.statusCodigo === 'correto' ? 'certo' : '') : (recCsv.status === 'recuperada' ? 'recuperado' : recCsv.status === 'nao_recuperada' ? 'nao recuperado' : 'aberto');
                            row.push(l.codigoLido || '', l.statusCodigo || '', ponto, recCsv && nomeModalidade(recCsv.modalidade) || '', (recCsv && recCsv.prazo) || p.prazoNotas || '');
                        }
                        linhas.push(row);
                    });
                    var blob = new Blob(['\ufeff' + MaluAnalise.csv(linhas)], { type: 'text/csv;charset=utf-8' });
                    var a = document.createElement('a');
                    a.href = URL.createObjectURL(blob);
                    a.download = 'malu-gabaritos-' + (p.id || 'prova') + '.csv';
                    a.click();
                };
            }
        };
    };

    telas.ajustes = function () {
        var p = provaAtual();
        return {
            html: '<div class="pilha">' + topo('Ajustes', 'Leitura e cuidado com os dados', '#/inicio') +
                '<section class="cartao"><h2>Limiar da bolha</h2><p class="suave">Mais alto exige marca mais forte. O padrão é 0,55.</p>' +
                '<input type="range" id="limiar" min="0.35" max="0.75" step="0.01" value="' + st.ajustes.limiar + '"><p id="limiar-n">' + String(st.ajustes.limiar).replace('.', ',') + '</p></section>' +
                '<section class="cartao"><label class="opcao-linha"><span class="tx">Letra maior</span><input class="chave-sw" type="checkbox" id="fonte"' + (st.ajustes.fonteMaior ? ' checked' : '') + '></label>' +
                '<label class="opcao-linha"><span class="tx">Contraste alto</span><input class="chave-sw" type="checkbox" id="contraste"' + (st.ajustes.contraste ? ' checked' : '') + '></label></section>' +
                '<section class="cartao"><h2>Fotos e LGPD</h2><p>Os alunos são menores. A foto do cartão serve só para revisar a leitura e fica 3 dias. Depois é apagada, e para reler é preciso fotografar de novo.</p>' +
                '<p>O cartão leva o número da lista. A nota e as respostas ficam na escola, no mesmo lugar do Montador. Nada disso vai para uma inteligência artificial de fora.</p>' +
                (p ? '<p class="suave">Prazo das notas desta prova: ' + (p.prazoNotas ? U.dataBR(p.prazoNotas) : 'ainda não informado no Montador') + '.</p>' : '') +
                '</section></div>',
            montar: function (el) {
                el.querySelector('#limiar').oninput = function (e) {
                    st.ajustes.limiar = Number(e.target.value);
                    el.querySelector('#limiar-n').textContent = String(st.ajustes.limiar).replace('.', ',');
                    persistir();
                };
                el.querySelector('#fonte').onchange = function (e) { st.ajustes.fonteMaior = e.target.checked; persistir(); };
                el.querySelector('#contraste').onchange = function (e) { st.ajustes.contraste = e.target.checked; persistir(); };
            }
        };
    };

    async function carregarConta() {
        st.perfil = await MaluNuvem.perfil();
        if (!st.perfil) { semearDemo(); return; }
        st.modo = 'conta';
        st.provas = await MaluNuvem.provasTravadas();
        if (st.provas[0]) st.provaSel = st.provas[0].id;
        var ids = st.provas.map(function (p) { return p.id; });
        if (ids.length && MaluNuvem.obter()) {
            var resp = await MaluNuvem.obter().from('corretor_leituras').select('*').in('prova_id', ids);
            if (!resp.error) {
                st.leituras = (resp.data || []).map(MaluNuvem.linhaParaLeitura);
                await MaluNuvem.limparFotosVencidas(st.leituras);
                st.leituras.forEach(function (l) {
                    if (l.imagemExpira && Date.parse(l.imagemExpira) < Date.now()) {
                        l.imagemPath = null;
                        l.imagemExpira = null;
                    }
                });
            }
            var recs = await MaluNuvem.obter().from('corretor_recuperacoes').select('*').in('prova_id', ids);
            st.recuperacoes = {};
            if (!recs.error) (recs.data || []).forEach(function (r) {
                st.recuperacoes[r.leitura_id] = {
                    id: r.id, leituraId: r.leitura_id, provaId: r.prova_id, status: r.status,
                    modalidade: r.modalidade, quando: r.quando, obs: r.obs, prazo: r.prazo
                };
            });
            st.envios = await MaluNuvem.enviosDasProvas(ids);
        }
    }

    window.addEventListener('hashchange', function () { pararCamera(); rotear(); });

    semearDemo();
    MaluNuvem.sessao().then(function (s) {
        if (s) return carregarConta();
    }).catch(function () {}).then(rotear);
})();
