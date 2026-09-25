/* Montagem dos PDFs: pega a primeira página enviada pela coordenação e devolve
   uma via por aluno, cada uma com o cabeçalho de identificação colado no espaço
   em branco que o professor deixou no alto da folha.
   Tudo acontece dentro do navegador, com o pdf-lib que está em vendor/.

   O cabeçalho é a única identificação da prova: leva o logotipo da escola, o
   nome da avaliação, o espaço para o aluno escrever a data, o nome do aluno,
   a série, a turma, o número da lista, o código único e o QR Code encaixado
   nele. Fora da Redação, leva também os quadros de ACERTOS e PONTOS para o
   professor preencher na correção.

   Duas saídas:
     montarPrimeirasPaginas — o cabeçalho colado na primeira página;
     montarEtiquetas        — o mesmo cabeçalho em grade, para recortar e colar
                              quando a prova é impressa direto do Word. */
(function (global) {
    'use strict';

    const PDFLib = global.PDFLib || (typeof require === 'function' ? require('../vendor/pdf-lib.min.js') : null);
    const Qr = global.ProvasQr || (typeof require === 'function' ? require('./qr.js') : null);

    const PDFDocument = PDFLib.PDFDocument;
    const StandardFonts = PDFLib.StandardFonts;
    const rgb = PDFLib.rgb;

    const A4 = [595.28, 841.89];
    const CM = 28.3465;

    /* Medidas padrão do cabeçalho, em centímetros. */
    const PADRAO = { xCm: 1, yCm: 1, larguraCm: 19, alturaCm: 2.8 };

    const PRETO = rgb(0, 0, 0);
    const CINZA = rgb(0.38, 0.38, 0.38);
    const BRANCO = rgb(1, 1, 1);

    /* Sinais tipográficos que vêm de texto copiado do Word e não existem no
       WinAnsi das fontes padrão do PDF: viram o equivalente simples. */
    const TROCAS = {
        '“': '"', '”': '"', '„': '"', '‘': "'", '’': "'",
        '–': '-', '—': '-', '−': '-', '…': '...',
        ' ': ' ', '•': '-', '‹': '<', '›': '>'
    };

    /* As fontes padrão do PDF escrevem o repertório WinAnsi, que cobre todo o
       português. Qualquer caractere fora disso derrubaria o pdf-lib, então os
       sinais viram o equivalente simples e o resto cai na versão sem acento. */
    function textoSeguro(texto) {
        const bruto = String(texto == null ? '' : texto);
        let saida = '';
        for (const c of bruto) {
            if (/[\x20-\x7E\xA1-\xFF]/.test(c)) {
                saida += c;
            } else if (TROCAS[c]) {
                saida += TROCAS[c];
            } else {
                const sem = c.normalize('NFD').replace(/[̀-ͯ]/g, '');
                saida += /^[\x20-\x7E]+$/.test(sem) ? sem : ' ';
            }
        }
        return saida;
    }

    /* Diminui a fonte até o texto caber na largura disponível. */
    function tamanhoQueCabe(fonte, texto, ideal, larguraMax, minimo) {
        let tamanho = ideal;
        const piso = minimo || 6;
        while (tamanho > piso && fonte.widthOfTextAtSize(texto, tamanho) > larguraMax) {
            tamanho -= 0.25;
        }
        return tamanho;
    }

    /* Quebra o texto nas linhas que forem necessárias, sem limite. */
    function quebrarEmLinhas(fonte, texto, tamanho, larguraMax) {
        const palavras = String(texto).split(' ').filter(Boolean);
        const linhas = [];
        let atual = '';
        for (const palavra of palavras) {
            const tentativa = atual ? atual + ' ' + palavra : palavra;
            if (!atual || fonte.widthOfTextAtSize(tentativa, tamanho) <= larguraMax) {
                atual = tentativa;
            } else {
                linhas.push(atual);
                atual = palavra;
            }
        }
        if (atual) linhas.push(atual);
        return linhas;
    }

    /* Quebra em no máximo `maxLinhas` linhas, cortando o que passar. Serve para
       a folha de conferência, onde a coluna é fixa. */
    function quebrarTexto(fonte, texto, tamanho, larguraMax, maxLinhas) {
        const linhas = quebrarEmLinhas(fonte, texto, tamanho, larguraMax);
        if (linhas.length > maxLinhas) linhas.length = maxLinhas;
        const ultima = linhas.length - 1;
        while (ultima >= 0 && fonte.widthOfTextAtSize(linhas[ultima], tamanho) > larguraMax && linhas[ultima].length > 6) {
            linhas[ultima] = linhas[ultima].slice(0, -4) + '...';
        }
        return linhas;
    }

    /* O nome do aluno nunca pode sair cortado: é a identificação da prova.
       A fonte diminui até o nome inteiro caber nas linhas disponíveis. */
    function encaixarNome(fonte, texto, ideal, larguraMax, maxLinhas, piso) {
        const limite = piso || 5.5;
        let tamanho = ideal;
        while (tamanho > limite) {
            const linhas = quebrarEmLinhas(fonte, texto, tamanho, larguraMax);
            if (linhas.length <= maxLinhas) return { tamanho: tamanho, linhas: linhas };
            tamanho -= 0.25;
        }
        return { tamanho: limite, linhas: quebrarTexto(fonte, texto, limite, larguraMax, maxLinhas) };
    }

    /* Desenha o QR como vetor: um retângulo por sequência de módulos escuros.
       Sai nítido em qualquer impressora e não pesa no arquivo. */
    function desenharQr(pagina, conteudo, x, y, lado) {
        const { tamanho, formas } = Qr.retangulos(conteudo, 'M');
        const borda = 2; /* zona de silêncio exigida pelo padrão, em módulos */
        const total = tamanho + borda * 2;
        const modulo = lado / total;

        pagina.drawRectangle({ x: x, y: y, width: lado, height: lado, color: BRANCO });
        formas.forEach(function (forma) {
            pagina.drawRectangle({
                x: x + (forma.coluna + borda) * modulo,
                /* A matriz conta as linhas de cima para baixo e o PDF de baixo
                   para cima. */
                y: y + lado - (forma.linha + borda + forma.altura) * modulo,
                width: forma.largura * modulo,
                height: forma.altura * modulo,
                color: PRETO
            });
        });
    }

    /* Dois quadros empilhados, compridos e baixos, centralizados na altura do
       bloco: o rótulo fica à esquerda, no meio da altura, e o resto do quadro
       fica livre para o professor escrever à mão. */
    function desenharQuadrosCorrecao(pagina, fontes, area, escala) {
        const vao = 3 * escala;
        const alturaQuadro = Math.min(0.8 * CM * escala, (area.altura - vao) / 2);
        const topo = area.y + (area.altura + alturaQuadro * 2 + vao) / 2;
        const tamanhoRotulo = Math.min(6.4 * escala, alturaQuadro * 0.4);
        ['ACERTOS', 'PONTOS'].forEach(function (rotulo, i) {
            const y = topo - (i + 1) * alturaQuadro - i * vao;
            pagina.drawRectangle({
                x: area.x, y: y, width: area.largura, height: alturaQuadro,
                borderColor: PRETO, borderWidth: 0.6
            });
            pagina.drawText(rotulo, {
                x: area.x + 3 * escala, y: y + (alturaQuadro - tamanhoRotulo * 0.7) / 2,
                size: tamanhoRotulo, font: fontes.normal, color: CINZA
            });
        });
    }

    /* O CABEÇALHO DE IDENTIFICAÇÃO.

       ┌──────┬──────────────────────────────────────┬──────────────┬──────┐
       │ ╭──╮ │ AVALIAÇÃO BIMESTRAL DE LINGUAGENS    │              │ ▓▓▓▓ │
       │ LOGO │ JOSÉ ÍTALO GONÇALVES DA CONCEIÇÃO    │ ACERTOS      │ ▓QR▓ │
       │      │ 1ª SÉRIE · TURMA 1A · Nº 03  DATA: __ │ PONTOS       │ ▓▓▓▓ │
       │ ╰──╯ │ MLS-2026-B3-1A-003-LIN-K45X          │              │ ▓▓▓▓ │
       └──────┴──────────────────────────────────────┴──────────────┴──────┘

       O nome é o maior elemento, porque é ele que impede a prova de rodar de
       carteira em carteira. O QR e o logotipo ficam encaixados na altura do
       bloco, cada um de um lado. Os quadros de ACERTOS e PONTOS só saem na
       prova (não na etiqueta) e nunca na Redação. Na prova, o logotipo fica
       um pouco menor e o nome vai sempre numa linha só, encolhendo a letra se
       for preciso. */
    function desenharCabecalho(pagina, fontes, prova, caixa, opcoes) {
        const escala = caixa.escala || 1;
        const incluirQr = opcoes.incluirQr !== false;
        const incluirCodigo = opcoes.incluirCodigo !== false;
        const recuo = 5 * escala;

        pagina.drawRectangle({ x: caixa.x, y: caixa.y, width: caixa.largura, height: caixa.altura, color: BRANCO });
        if (opcoes.moldura !== false) {
            pagina.drawRectangle({
                x: caixa.x, y: caixa.y, width: caixa.largura, height: caixa.altura,
                borderColor: PRETO, borderWidth: 0.8
            });
        }

        /* O QR ocupa a altura útil do bloco, sem passar de um terço da largura. */
        let ladoQr = 0;
        if (incluirQr) {
            ladoQr = Math.max(0, Math.min(caixa.altura - recuo * 2, caixa.largura * 0.34));
            if (opcoes.ladoQrCm) ladoQr = Math.min(ladoQr, opcoes.ladoQrCm * CM * escala);
            const xQr = opcoes.qrNaEsquerda
                ? caixa.x + recuo
                : caixa.x + caixa.largura - ladoQr - recuo;
            desenharQr(pagina, prova.conteudoQr, xQr, caixa.y + (caixa.altura - ladoQr) / 2, ladoQr);
        }

        /* O logotipo da escola vai no lado oposto ao QR, na mesma altura, sem
           passar de um quinto da largura. */
        let ladoLogo = 0;
        if (fontes.logo && opcoes.incluirLogo !== false) {
            const alturaUtil = caixa.altura - recuo * 2;
            const proporcao = fontes.logo.width / fontes.logo.height;
            let alturaLogo = Math.max(0, Math.min(alturaUtil, (caixa.largura * 0.2) / proporcao));
            if (opcoes.ladoLogoCm) alturaLogo = Math.min(alturaLogo, (opcoes.ladoLogoCm * CM * escala) / proporcao);
            ladoLogo = alturaLogo * proporcao;
            const xLogo = opcoes.qrNaEsquerda
                ? caixa.x + caixa.largura - ladoLogo - recuo
                : caixa.x + recuo;
            pagina.drawImage(fontes.logo, {
                x: xLogo, y: caixa.y + (caixa.altura - alturaLogo) / 2,
                width: ladoLogo, height: alturaLogo
            });
        }

        const ladoEsquerdo = opcoes.qrNaEsquerda ? ladoQr : ladoLogo;
        let tx = caixa.x + (ladoEsquerdo ? ladoEsquerdo + recuo * 2.4 : recuo * 2);
        let largura = caixa.largura - ladoQr - ladoLogo - recuo * 4.4 - (ladoQr && ladoLogo ? recuo * 1.4 : 0);

        /* Quadros da correção: ACERTOS e PONTOS, empilhados entre o texto e o
           QR, para o professor preencher. A Redação não leva, porque é
           corrigida por competências. */
        if (opcoes.incluirCorrecao && prova.componente !== 'RED') {
            const larguraQuadros = Math.min(3.2 * CM * escala, caixa.largura * 0.2);
            const folga = recuo * 1.4;
            if (largura - larguraQuadros - folga > 10) {
                largura -= larguraQuadros + folga;
                if (opcoes.qrNaEsquerda) tx += larguraQuadros + folga;
                const xQuadros = opcoes.qrNaEsquerda ? tx - folga - larguraQuadros : tx + largura + folga;
                desenharQuadrosCorrecao(pagina, fontes, {
                    x: xQuadros, y: caixa.y + recuo, largura: larguraQuadros, altura: caixa.altura - recuo * 2
                }, escala);
            }
        }
        if (largura <= 10) return;

        const linhas = [];

        const corpoNome = (opcoes.corpoNome || 15) * escala;
        const nome = encaixarNome(fontes.negrito, textoSeguro(prova.nome), corpoNome, largura, opcoes.nomeEmUmaLinha ? 1 : 2, 6 * escala);

        /* Linha de cima: o nome da avaliação, que a coordenação escreve no
           passo 1. Sai grande, só um pouco menor que o nome do aluno; se não
           couber numa linha, encolhe um pouco e depois quebra em duas. */
        const avaliacao = textoSeguro(String(opcoes.avaliacao || '').trim().toUpperCase());
        const fonteAvaliacao = fontes.titulo || fontes.negrito;
        if (avaliacao) {
            const ideal = Math.min(corpoNome * 0.8, nome.tamanho * 0.9);
            let encaixe = { tamanho: tamanhoQueCabe(fonteAvaliacao, avaliacao, ideal, largura, ideal * 0.75), linhas: [avaliacao] };
            if (fonteAvaliacao.widthOfTextAtSize(avaliacao, encaixe.tamanho) > largura) {
                encaixe = encaixarNome(fonteAvaliacao, avaliacao, ideal, largura, 2, 5.5);
            }
            encaixe.linhas.forEach(function (parte) {
                linhas.push({ texto: parte, fonte: fonteAvaliacao, tamanho: encaixe.tamanho, cor: PRETO });
            });
            linhas[linhas.length - 1].espacoDepois = 2.5 * escala;
        }

        /* O espaço para o aluno escrever a data vai na linha da série e da
           turma, encostado à direita; se não couber, ganha uma linha própria. */
        const data = opcoes.incluirData !== false
            ? { texto: 'DATA: ____/____/________', fonte: fontes.normal, tamanho: 7.6 * escala }
            : null;

        if (prova.generica) {
            /* Prova reserva: no lugar do nome, uma linha para escrever à mão. */
            linhas.push({ texto: '', linhaEmBranco: true, fonte: fontes.negrito, tamanho: corpoNome, cor: PRETO });
        } else {
            nome.linhas.forEach(function (parte) {
                linhas.push({ texto: parte, fonte: fontes.negrito, tamanho: nome.tamanho, cor: PRETO });
            });
        }

        /* Série, turma e número da lista. O componente só entra na etiqueta,
           que vive solta; na prova ele já está no cabeçalho do professor. */
        const partes = [];
        if (opcoes.serieNome) partes.push(opcoes.serieNome);
        partes.push('TURMA ' + prova.turma);
        partes.push('Nº ' + prova.numeroCurto);
        const componente = opcoes.incluirComponente ? textoSeguro(prova.componenteNome.toUpperCase()) : '';

        /* Quando a linha aperta (etiqueta estreita, com logo e QR dos lados), os
           separadores encolhem e, se ainda não couber, o componente desce para
           uma linha própria, em vez de o texto invadir o QR. */
        function montarDados(comComponente, separador) {
            const texto = textoSeguro(partes.concat(comComponente ? [componente] : []).join(separador));
            const tamanho = tamanhoQueCabe(fontes.negrito, texto, 9.6 * escala, largura, 5.5);
            return { texto: texto, tamanho: tamanho, cabe: fontes.negrito.widthOfTextAtSize(texto, tamanho) <= largura };
        }
        let escolha = null;
        const tentativas = componente ? [true, false] : [false];
        tentativas.some(function (comComponente) {
            return ['   ·   ', '  ·  ', ' · '].some(function (separador) {
                escolha = montarDados(comComponente, separador);
                escolha.comComponente = comComponente;
                return escolha.cabe;
            });
        });
        const dados = escolha.texto;
        const tamanhoDados = escolha.tamanho;
        const componenteSolto = componente && !escolha.comComponente;
        const codigo = textoSeguro(prova.id);
        const tamanhoCodigo = Math.max(5.5, Math.min(8.4 * escala, tamanhoDados));

        const larguraDados = fontes.negrito.widthOfTextAtSize(dados, tamanhoDados);
        const dataJunto = data && (larguraDados + data.fonte.widthOfTextAtSize(data.texto, data.tamanho) + 12 * escala <= largura);

        linhas.push({
            texto: dados,
            fonte: fontes.negrito,
            tamanho: tamanhoDados,
            cor: PRETO,
            aDireita: dataJunto ? data : null
        });

        if (componenteSolto) {
            linhas.push({
                texto: componente,
                fonte: fontes.negrito,
                tamanho: tamanhoQueCabe(fontes.negrito, componente, tamanhoDados, largura, 4.6),
                cor: PRETO
            });
        }

        if (data && !dataJunto) {
            data.tamanho = tamanhoQueCabe(data.fonte, data.texto, data.tamanho, largura, 5);
            linhas.push({ texto: data.texto, fonte: data.fonte, tamanho: data.tamanho, cor: PRETO });
        }

        /* O código fecha o bloco, numa linha própria. */
        if (incluirCodigo) {
            linhas.push({
                texto: codigo,
                fonte: fontes.mono,
                tamanho: tamanhoQueCabe(fontes.mono, codigo, tamanhoCodigo, largura, 4.6),
                cor: PRETO
            });
        }

        const entrelinha = 1.3;
        let alturaTexto = linhas.reduce(function (soma, l) { return soma + l.tamanho * entrelinha + (l.espacoDepois || 0); }, 0);

        /* Se o conjunto não couber na altura do bloco (nome em duas linhas,
           cabeçalho baixo), tudo encolhe na mesma proporção. */
        const alturaUtil = caixa.altura - recuo * 2;
        if (alturaTexto > alturaUtil) {
            const fator = alturaUtil / alturaTexto;
            linhas.forEach(function (l) {
                l.tamanho *= fator;
                if (l.espacoDepois) l.espacoDepois *= fator;
                if (l.aDireita) l.aDireita.tamanho *= fator;
            });
            alturaTexto = alturaUtil;
        }

        let cursor = caixa.y + caixa.altura - Math.max(recuo, (caixa.altura - alturaTexto) / 2);

        linhas.forEach(function (l) {
            cursor -= l.tamanho;
            if (l.texto) pagina.drawText(l.texto, { x: tx, y: cursor, size: l.tamanho, font: l.fonte, color: l.cor });
            if (l.linhaEmBranco) {
                pagina.drawLine({
                    start: { x: tx, y: cursor }, end: { x: tx + largura, y: cursor },
                    thickness: 0.7, color: PRETO
                });
            }
            if (l.aDireita) {
                const direita = tx + largura - l.aDireita.fonte.widthOfTextAtSize(l.aDireita.texto, l.aDireita.tamanho);
                pagina.drawText(l.aDireita.texto, {
                    x: direita, y: cursor, size: l.aDireita.tamanho, font: l.aDireita.fonte, color: PRETO
                });
            }
            cursor -= l.tamanho * (entrelinha - 1) + (l.espacoDepois || 0);
        });
    }

    /* Onde o cabeçalho fica na folha. As medidas são em centímetros contados da
       borda superior esquerda da PÁGINA ORIGINAL — é como se mede numa folha
       impressa na mão. Se a prova tiver sido reduzida para abrir espaço, o
       cabeçalho passa pela mesma redução e pelo mesmo deslocamento, e assim cai
       onde foi marcado. */
    function resolverCaixa(marca, largura, altura, transformacao) {
        const t = transformacao || { escala: 1, dx: 0, dy: 0 };
        const noEspacoAberto = !!marca.noEspacoAberto;

        const larguraPedida = (marca.larguraCm || PADRAO.larguraCm) * CM;
        const alturaPedida = (marca.alturaCm || PADRAO.alturaCm) * CM;

        /* No espaço aberto pelo próprio app, o cabeçalho não encolhe: ele vive
           na faixa nova, em cima da prova reduzida. */
        const escala = noEspacoAberto ? 1 : t.escala;
        const larguraCaixa = Math.min(largura - 4, larguraPedida * escala);
        const alturaCaixa = Math.min(altura - 4, alturaPedida * escala);

        const xPedido = (marca.xCm != null ? marca.xCm : PADRAO.xCm) * CM;
        const yPedido = (marca.yCm != null ? marca.yCm : PADRAO.yCm) * CM;

        const x = noEspacoAberto ? xPedido : t.dx + xPedido * t.escala;
        const topo = noEspacoAberto ? yPedido : (altura - t.dy - (altura - yPedido) * t.escala);

        return {
            x: Math.max(2, Math.min(largura - larguraCaixa - 2, x)),
            y: Math.max(2, Math.min(altura - alturaCaixa - 2, altura - topo - alturaCaixa)),
            largura: larguraCaixa,
            altura: alturaCaixa,
            escala: escala
        };
    }

    /* Uma página em branco não tem /Contents. Incorporar uma dessas faria o
       pdf-lib falhar só no fim, ao salvar o arquivo todo. */
    function temConteudo(pagina) {
        try {
            return !!(pagina.node && pagina.node.Contents && pagina.node.Contents());
        } catch (erro) {
            return false;
        }
    }

    /* Encosta a prova no alto da área que sobrou, para não abrir um vão entre o
       cabeçalho e o começo da prova. */
    function posicaoVertical(area, alturaUsada) {
        if (area.alinhar === 'centro') return area.y + (area.altura - alturaUsada) / 2;
        return area.y + area.altura - alturaUsada;
    }

    /* Prepara uma página de um PDF enviado: devolve o tamanho e uma função que
       a redesenha dentro de qualquer retângulo, sem distorcer. */
    async function prepararPaginaPdf(destino, origem, indice) {
        const pagina = origem.getPage(indice);
        const tam = pagina.getSize();
        const giro = ((pagina.getRotation().angle % 360) + 360) % 360;

        /* Página escaneada de lado: o giro entra na matriz do objeto, para a
           cópia sair em pé e o cabeçalho ficar no lugar certo. */
        let matriz = null;
        let largura = tam.width;
        let altura = tam.height;
        if (giro === 90) {
            matriz = [0, -1, 1, 0, 0, tam.width];
            largura = tam.height; altura = tam.width;
        } else if (giro === 180) {
            matriz = [-1, 0, 0, -1, tam.width, tam.height];
        } else if (giro === 270) {
            matriz = [0, 1, -1, 0, tam.height, 0];
            largura = tam.height; altura = tam.width;
        }

        /* Página sem conteúdo nenhum (folha em branco no arquivo enviado):
           não há o que incorporar, e a via do aluno sai só com o cabeçalho,
           em vez de a geração toda parar. */
        let incorporada = null;
        if (temConteudo(pagina)) {
            incorporada = matriz
                ? await destino.embedPage(pagina, undefined, matriz)
                : await destino.embedPage(pagina);
        }

        return {
            largura: largura,
            altura: altura,
            vazia: !incorporada,
            desenhar: function (folha, area) {
                if (!incorporada) return;
                const escala = Math.min(area.largura / largura, area.altura / altura);
                folha.drawPage(incorporada, {
                    x: area.x + (area.largura - largura * escala) / 2,
                    y: posicaoVertical(area, altura * escala),
                    xScale: escala,
                    yScale: escala
                });
            }
        };
    }

    /* Prepara a prova enviada. Do PDF saem a capa, que recebe o cabeçalho, e
       as páginas que vão intactas atrás dela: só o verso, para a coordenação
       imprimir a capa e mandar o resto para o xerox, ou, com `provaInteira`,
       todas as outras páginas, para imprimir a prova completa direto do
       arquivo. Imagem (JPG/PNG) é só a capa. */
    async function prepararFonte(destino, arquivo, provaInteira) {
        const tipo = String(arquivo.tipo || '').toLowerCase();

        if (tipo === 'pdf') {
            let origem;
            try {
                origem = await PDFDocument.load(arquivo.bytes, { ignoreEncryption: true });
            } catch (erro) {
                throw new Error('Não consegui abrir este PDF (' + (erro.message || erro) + '). Se ele estiver protegido por senha, salve uma cópia sem senha e envie de novo.');
            }
            if (origem.getPageCount() === 0) throw new Error('Este PDF não tem nenhuma página.');

            const capa = await prepararPaginaPdf(destino, origem, 0);
            capa.paginas = origem.getPageCount();
            /* Cada página é incorporada uma vez só e desenhada em todas as
               vias: o arquivo não cresce página a página com a turma. */
            const ultima = provaInteira ? origem.getPageCount() : Math.min(2, origem.getPageCount());
            capa.seguintes = [];
            for (let i = 1; i < ultima; i++) capa.seguintes.push(await prepararPaginaPdf(destino, origem, i));
            return capa;
        }

        if (tipo === 'jpg' || tipo === 'jpeg' || tipo === 'png') {
            const imagem = tipo === 'png'
                ? await destino.embedPng(arquivo.bytes)
                : await destino.embedJpg(arquivo.bytes);
            return {
                largura: A4[0],
                altura: A4[1],
                paginas: 1,
                imagem: true,
                seguintes: [],
                desenhar: function (folha, area) {
                    const escala = Math.min(area.largura / imagem.width, area.altura / imagem.height);
                    folha.drawImage(imagem, {
                        x: area.x + (area.largura - imagem.width * escala) / 2,
                        y: posicaoVertical(area, imagem.height * escala),
                        width: imagem.width * escala,
                        height: imagem.height * escala
                    });
                }
            };
        }

        throw new Error('Formato não reconhecido: envie a primeira página em PDF, JPG ou PNG.');
    }

    /* Junto das fontes vai o logotipo da escola, quando o app o fornece (os
       bytes do logo.png). Sem ele, o cabeçalho sai só com texto e QR. */
    async function carregarFontes(destino, logoBytes) {
        return {
            normal: await destino.embedFont(StandardFonts.Helvetica),
            negrito: await destino.embedFont(StandardFonts.HelveticaBold),
            mono: await destino.embedFont(StandardFonts.CourierBold),
            /* Fonte com serifa só para o nome da avaliação, para ele não se
               confundir com o nome do aluno, que vai em Helvetica. */
            titulo: await destino.embedFont(StandardFonts.TimesRomanBold),
            logo: logoBytes ? await destino.embedPng(logoBytes) : null
        };
    }

    /* Uma via por aluno: a capa com o cabeçalho de identificação e, logo
       atrás, sem cabeçalho, o verso ou (com `provaInteira`) o resto da prova. */
    async function montarPrimeirasPaginas(opcoes) {
        const provas = opcoes.identificacoes || [];
        if (!provas.length) throw new Error('Nenhum aluno para identificar.');

        const cabecalho = opcoes.cabecalho || {};
        const destino = await PDFDocument.create();
        const fontes = await carregarFontes(destino, opcoes.logo);
        const fonte = await prepararFonte(destino, opcoes.arquivo, opcoes.provaInteira);

        /* Espaço aberto no topo: a prova desce e encolhe o necessário. Em zero
           — o caso normal, quando o professor já deixou a faixa em branco na
           prova —, a cópia sai em tamanho original e nada é redimensionado. */
        const espacoTopo = Math.max(0, (opcoes.espacoTopoCm || 0) * CM);
        const area = espacoTopo > 0
            ? { x: 0, y: 0, largura: fonte.largura, altura: fonte.altura - espacoTopo, alinhar: 'topo' }
            : { x: 0, y: 0, largura: fonte.largura, altura: fonte.altura, alinhar: 'centro' };

        const escala = Math.min(area.largura / fonte.largura, area.altura / fonte.altura);
        const transformacao = {
            escala: escala,
            dx: area.x + (area.largura - fonte.largura * escala) / 2,
            dy: posicaoVertical(area, fonte.altura * escala)
        };

        const marca = {
            xCm: cabecalho.xCm, yCm: cabecalho.yCm,
            larguraCm: cabecalho.larguraCm, alturaCm: cabecalho.alturaCm,
            noEspacoAberto: espacoTopo > 0
        };

        destino.setTitle(textoSeguro(opcoes.tituloArquivo || 'Provas identificadas'));
        destino.setCreator('Provas Identificadas — Painel do Colaborador');
        destino.setProducer('Provas Identificadas — Painel do Colaborador');

        for (let i = 0; i < provas.length; i++) {
            const folha = destino.addPage([fonte.largura, fonte.altura]);
            fonte.desenhar(folha, area);
            desenharCabecalho(folha, fontes, provas[i], resolverCaixa(marca, fonte.largura, fonte.altura, transformacao), {
                incluirQr: cabecalho.incluirQr,
                incluirCodigo: cabecalho.incluirCodigo,
                qrNaEsquerda: cabecalho.qrNaEsquerda,
                moldura: cabecalho.moldura,
                rotulo: cabecalho.rotulo,
                corpoNome: cabecalho.corpoNome,
                serieNome: opcoes.serieNome,
                avaliacao: opcoes.avaliacao,
                incluirCorrecao: true,
                nomeEmUmaLinha: true,
                ladoLogoCm: 1.9
            });

            /* As páginas seguintes vêm logo atrás da capa, do jeito que foram
               enviadas e sem cabeçalho. */
            fonte.seguintes.forEach(function (seguinte) {
                const folhaSeguinte = destino.addPage([seguinte.largura, seguinte.altura]);
                seguinte.desenhar(folhaSeguinte, {
                    x: 0, y: 0, largura: seguinte.largura, altura: seguinte.altura, alinhar: 'centro'
                });
            });

            /* Prova inteira com número ímpar de páginas: uma página em branco
               no fim, para que, impresso frente e verso, a capa do aluno
               seguinte não saia no verso da última folha deste. */
            if (opcoes.provaInteira && fonte.seguintes.length % 2 === 0 && fonte.seguintes.length > 0) {
                destino.addPage([fonte.largura, fonte.altura]);
            }
            if (opcoes.aoProgresso) opcoes.aoProgresso(i + 1, provas.length);
        }

        return destino.save();
    }

    /* Prova reserva, sem identificação: capa e verso iguais aos das provas
       identificadas, mas o cabeçalho traz linhas em branco no lugar do nome e
       do número, e nem QR nem código. Serve para substituir a prova de alguém
       (folha rasgada, aluno fora da lista) na hora da aplicação. */
    function montarProvaGenerica(opcoes) {
        const cabecalho = Object.assign({}, opcoes.cabecalho || {}, { incluirQr: false, incluirCodigo: false });
        const generica = {
            generica: true, nome: '', turma: opcoes.turma || '________', numeroCurto: '______', id: '',
            componente: opcoes.componente
        };
        return montarPrimeirasPaginas(Object.assign({}, opcoes, { cabecalho: cabecalho, identificacoes: [generica] }));
    }

    /* Etiquetas: o mesmo cabeçalho em grade, para recortar e colar. É a saída
       para quem imprime a prova direto do Word. Aqui o componente entra, porque
       a etiqueta anda solta antes de ser colada. */
    async function montarEtiquetas(opcoes) {
        const provas = opcoes.identificacoes || [];
        if (!provas.length) throw new Error('Nenhum aluno para identificar.');

        const destino = await PDFDocument.create();
        const fontes = await carregarFontes(destino, opcoes.logo);
        const colunas = Math.max(1, opcoes.colunas || 2);
        const linhas = Math.max(1, opcoes.linhas || 7);
        const margem = 28;
        const porFolha = colunas * linhas;
        const celulaLargura = (A4[0] - margem * 2) / colunas;
        const celulaAltura = (A4[1] - margem * 2) / linhas;

        let folha = null;
        provas.forEach(function (prova, indice) {
            const posicao = indice % porFolha;
            if (posicao === 0) folha = destino.addPage(A4);
            const coluna = posicao % colunas;
            const linha = Math.floor(posicao / colunas);
            /* A etiqueta fica com a altura do conteúdo, centralizada na célula:
               sem isso a moldura sobraria vazia embaixo do texto. */
            const alturaEtiqueta = Math.min(celulaAltura - 6, 2.9 * CM);
            const caixa = {
                x: margem + coluna * celulaLargura + 3,
                y: A4[1] - margem - (linha + 1) * celulaAltura + (celulaAltura - alturaEtiqueta) / 2,
                largura: celulaLargura - 6,
                altura: alturaEtiqueta,
                escala: Math.min(1, (celulaLargura - 6) / (13 * CM))
            };
            desenharCabecalho(folha, fontes, prova, caixa, {
                incluirQr: opcoes.incluirQr,
                serieNome: opcoes.serieNome,
                incluirComponente: true,
                corpoNome: 12,
                avaliacao: opcoes.avaliacao
            });
        });

        destino.setTitle(textoSeguro('Etiquetas de identificação — ' + (opcoes.subtitulo || '')));
        return destino.save();
    }

    /* Folha de conferência: a lista que fica com a coordenação ligando cada
       código ao aluno. É o único lugar onde nome e código aparecem juntos fora
       da prova, e sai como arquivo para você guardar onde quiser. */
    async function montarFolhaConferencia(opcoes) {
        const provas = opcoes.identificacoes || [];
        const destino = await PDFDocument.create();
        const fontes = await carregarFontes(destino);

        const largura = A4[0];
        const altura = A4[1];
        const margem = 34;
        const alturaLinha = 19;
        const colunas = { numero: margem, nome: margem + 34, id: margem + 250, assinatura: margem + 400 };

        let folha = null;
        let cursor = 0;
        let indicePagina = 0;

        function novaFolha() {
            folha = destino.addPage([largura, altura]);
            indicePagina++;
            cursor = altura - margem;

            folha.drawText(textoSeguro('FOLHA DE CONFERÊNCIA DAS PROVAS'), {
                x: margem, y: cursor - 12, size: 12, font: fontes.negrito, color: PRETO
            });
            cursor -= 26;
            folha.drawText(textoSeguro(opcoes.subtitulo || ''), {
                x: margem, y: cursor - 9, size: 9.5, font: fontes.normal, color: PRETO
            });
            cursor -= 22;
            folha.drawText(textoSeguro('Página ' + indicePagina), {
                x: largura - margem - 50, y: altura - margem - 12, size: 8, font: fontes.normal, color: CINZA
            });

            ['Nº', 'ALUNO(A)', 'IDENTIFICAÇÃO DA PROVA', 'ASSINATURA'].forEach(function (titulo, i) {
                const x = [colunas.numero, colunas.nome, colunas.id, colunas.assinatura][i];
                folha.drawText(textoSeguro(titulo), { x: x, y: cursor, size: 7.5, font: fontes.negrito, color: CINZA });
            });
            cursor -= 6;
            folha.drawLine({ start: { x: margem, y: cursor }, end: { x: largura - margem, y: cursor }, thickness: 0.8, color: PRETO });
            cursor -= alturaLinha;
        }

        novaFolha();

        provas.forEach(function (prova) {
            if (cursor < margem + alturaLinha) novaFolha();
            const nome = quebrarTexto(fontes.normal, textoSeguro(prova.nome), 9, colunas.id - colunas.nome - 10, 1)[0] || '';
            folha.drawText(textoSeguro(prova.numeroCurto), { x: colunas.numero, y: cursor + 5, size: 9, font: fontes.normal, color: PRETO });
            folha.drawText(nome, { x: colunas.nome, y: cursor + 5, size: 9, font: fontes.normal, color: PRETO });
            folha.drawText(textoSeguro(prova.id), { x: colunas.id, y: cursor + 5, size: 7.6, font: fontes.mono, color: PRETO });
            folha.drawLine({
                start: { x: margem, y: cursor }, end: { x: largura - margem, y: cursor },
                thickness: 0.4, color: rgb(0.7, 0.7, 0.7)
            });
            cursor -= alturaLinha;
        });

        destino.setTitle(textoSeguro('Folha de conferência — ' + (opcoes.subtitulo || '')));
        return destino.save();
    }

    const api = {
        A4: A4,
        CM: CM,
        PADRAO: PADRAO,
        textoSeguro: textoSeguro,
        quebrarTexto: quebrarTexto,
        quebrarEmLinhas: quebrarEmLinhas,
        encaixarNome: encaixarNome,
        resolverCaixa: resolverCaixa,
        desenharCabecalho: desenharCabecalho,
        montarPrimeirasPaginas: montarPrimeirasPaginas,
        montarProvaGenerica: montarProvaGenerica,
        montarEtiquetas: montarEtiquetas,
        montarFolhaConferencia: montarFolhaConferencia
    };

    global.ProvasPdf = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
