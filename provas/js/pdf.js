/* Montagem dos PDFs: pega a primeira página enviada pela coordenação e devolve
   uma via por aluno, cada uma com a identificação no lugar escolhido.
   Tudo acontece dentro do navegador, com o pdf-lib que está em vendor/.

   As marcas são combináveis, porque cada prova tem um espaço livre diferente:
     quadrado  — quadradinho com o QR e o código, encaixado no topo da folha;
     linha     — uma linha de texto, para cair dentro do campo "ALUNO (A):";
     faixa     — faixa larga no topo ou no pé da página;
     caixa     — retângulo no canto, com QR.
   Quando `espacoTopoCm` é zero a prova é copiada em tamanho original, sem
   redimensionar nada: é o que preserva as marcas de alinhamento da folha de
   respostas. */
(function (global) {
    'use strict';

    const PDFLib = global.PDFLib || (typeof require === 'function' ? require('../vendor/pdf-lib.min.js') : null);
    const Qr = global.ProvasQr || (typeof require === 'function' ? require('./qr.js') : null);

    const PDFDocument = PDFLib.PDFDocument;
    const StandardFonts = PDFLib.StandardFonts;
    const rgb = PDFLib.rgb;

    const A4 = [595.28, 841.89];
    const CM = 28.3465;
    const MARGEM = 16;
    const FAIXA = 96;
    const CAIXA_CANTO = { largura: 268, altura: 80 };
    const QUADRADO_LADO = 3.4 * CM;

    const PRETO = rgb(0, 0, 0);
    const CINZA = rgb(0.35, 0.35, 0.35);
    const BRANCO = rgb(1, 1, 1);

    /* As fontes padrão do PDF escrevem o repertório WinAnsi, que cobre todo o
       português. Qualquer caractere fora disso derrubaria o pdf-lib, então cai
       para a versão sem acento. */
    /* Sinais tipográficos que vêm de texto copiado do Word e não existem no
       WinAnsi das fontes padrão: viram o equivalente simples. */
    const TROCAS = {
        '\u201c': '"', '\u201d': '"', '\u201e': '"', '\u2018': "'", '\u2019': "'",
        '\u2013': '-', '\u2014': '-', '\u2212': '-', '\u2026': '...',
        '\u00a0': ' ', '\u2022': '-', '\u2039': '<', '\u203a': '>'
    };

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

    /* Quebra em no máximo `maxLinhas` linhas, cortando com reticências o que
       passar. Serve para a folha de conferência, onde a coluna é fixa. */
    function quebrarTexto(fonte, texto, tamanho, larguraMax, maxLinhas) {
        const linhas = quebrarEmLinhas(fonte, texto, tamanho, larguraMax);
        if (linhas.length > maxLinhas) linhas.length = maxLinhas;
        const ultima = linhas.length - 1;
        while (ultima >= 0 && fonte.widthOfTextAtSize(linhas[ultima], tamanho) > larguraMax && linhas[ultima].length > 4) {
            linhas[ultima] = linhas[ultima].slice(0, -4) + '...';
        }
        return linhas;
    }

    /* O nome do aluno nunca pode sair cortado: é ele que amarra a prova à
       pessoa. Então a fonte diminui até o nome inteiro caber. */
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

    function centralizar(caixa, fonte, texto, tamanho) {
        return caixa.x + (caixa.largura - fonte.widthOfTextAtSize(texto, tamanho)) / 2;
    }

    /* Parte o código em dois pedaços, para caber na largura do quadradinho. */
    function partirId(id) {
        const partes = String(id).split('-');
        if (partes.length < 7) return [id];
        return [partes.slice(0, 4).join('-'), partes.slice(4).join('-')];
    }

    /* MARCA "quadrado": o quadradinho do topo. Leva o QR, o número da lista, a
       turma e o código; o nome é opcional, porque num quadrado de 3,4 cm ele
       sairia miúdo — o lugar do nome é o campo "ALUNO (A):" da prova. */
    function desenharQuadrado(pagina, fontes, prova, caixa, opcoes) {
        pagina.drawRectangle({ x: caixa.x, y: caixa.y, width: caixa.largura, height: caixa.altura, color: BRANCO });
        pagina.drawRectangle({
            x: caixa.x, y: caixa.y, width: caixa.largura, height: caixa.altura,
            borderColor: PRETO, borderWidth: 0.8
        });

        const interno = caixa.largura - 10;
        let cursor = caixa.y + caixa.altura - 5;

        if (opcoes.incluirQr !== false) {
            /* Reserva embaixo do QR o que o rótulo e as duas linhas do código
               ocupam, senão o código sai cortado na moldura. */
            const lado = Math.min(interno, caixa.altura - (opcoes.incluirNome ? 58 : 42));
            desenharQr(pagina, prova.conteudoQr, caixa.x + (caixa.largura - lado) / 2, cursor - lado, lado);
            cursor -= lado + 4;
        }

        const rotulo = textoSeguro('Nº ' + prova.numeroCurto + '  ·  ' + prova.turma + '  ·  ' + prova.componente);
        const tamanhoRotulo = tamanhoQueCabe(fontes.negrito, rotulo, 8.5, interno, 5.5);
        cursor -= tamanhoRotulo;
        pagina.drawText(rotulo, {
            x: centralizar(caixa, fontes.negrito, rotulo, tamanhoRotulo),
            y: cursor, size: tamanhoRotulo, font: fontes.negrito, color: PRETO
        });
        cursor -= 2.5;

        partirId(prova.id).forEach(function (pedaco) {
            const tamanho = tamanhoQueCabe(fontes.mono, pedaco, 6.6, interno, 4.6);
            cursor -= tamanho;
            pagina.drawText(pedaco, {
                x: centralizar(caixa, fontes.mono, pedaco, tamanho),
                y: cursor, size: tamanho, font: fontes.mono, color: PRETO
            });
            cursor -= 1;
        });

        if (opcoes.incluirNome && cursor - caixa.y > 6) {
            const nome = encaixarNome(fontes.negrito, textoSeguro(prova.nome), 6.5, interno, 2, 4.8);
            nome.linhas.forEach(function (parte) {
                cursor -= nome.tamanho;
                pagina.drawText(parte, {
                    x: centralizar(caixa, fontes.negrito, parte, nome.tamanho),
                    y: cursor, size: nome.tamanho, font: fontes.negrito, color: PRETO
                });
                cursor -= 0.8;
            });
        }
    }

    /* MARCA "linha": uma única linha de texto, do tamanho de um campo de
       formulário. É o que entra no "ALUNO (A): ____" que o professor já deixou
       na prova. Não pinta fundo por padrão, para não apagar a linha impressa. */
    function desenharLinha(pagina, fontes, prova, caixa, opcoes) {
        const campos = opcoes.campos || ['nome', 'numero', 'turma', 'id'];
        const pedacos = [];
        if (campos.indexOf('nome') !== -1) pedacos.push({ texto: prova.nome, fonte: fontes.negrito });
        if (campos.indexOf('numero') !== -1) pedacos.push({ texto: 'Nº ' + prova.numeroCurto, fonte: fontes.normal });
        if (campos.indexOf('turma') !== -1) pedacos.push({ texto: 'TURMA ' + prova.turma, fonte: fontes.normal });
        if (campos.indexOf('id') !== -1) pedacos.push({ texto: prova.id, fonte: fontes.mono });

        const separador = '   ·   ';
        function larguraTotal(tamanho) {
            return pedacos.reduce(function (soma, pedaco, indice) {
                const extra = indice ? fontes.normal.widthOfTextAtSize(separador, tamanho) : 0;
                return soma + extra + pedaco.fonte.widthOfTextAtSize(textoSeguro(pedaco.texto), tamanho);
            }, 0);
        }

        let tamanho = opcoes.tamanho || 9;
        while (tamanho > 4.5 && larguraTotal(tamanho) > caixa.largura) tamanho -= 0.25;

        if (opcoes.fundoBranco) {
            pagina.drawRectangle({
                x: caixa.x - 2, y: caixa.y - tamanho * 0.28,
                width: caixa.largura + 4, height: tamanho * 1.35, color: BRANCO
            });
        }

        let x = caixa.x;
        pedacos.forEach(function (pedaco, indice) {
            if (indice) {
                pagina.drawText(separador, { x: x, y: caixa.y, size: tamanho, font: fontes.normal, color: CINZA });
                x += fontes.normal.widthOfTextAtSize(separador, tamanho);
            }
            const texto = textoSeguro(pedaco.texto);
            pagina.drawText(texto, { x: x, y: caixa.y, size: tamanho, font: pedaco.fonte, color: PRETO });
            x += pedaco.fonte.widthOfTextAtSize(texto, tamanho);
        });
    }

    /* MARCA "faixa"/"caixa"/etiqueta: bloco com moldura, texto à esquerda e QR à
       direita. Monta a lista de linhas antes de desenhar, para centralizar tudo
       na vertical. */
    function desenharBloco(pagina, fontes, prova, caixa, opcoes) {
        const compacto = !!opcoes.compacto;
        const incluirQr = opcoes.incluirQr !== false;

        pagina.drawRectangle({ x: caixa.x, y: caixa.y, width: caixa.largura, height: caixa.altura, color: BRANCO });
        pagina.drawRectangle({
            x: caixa.x, y: caixa.y, width: caixa.largura, height: caixa.altura,
            borderColor: PRETO, borderWidth: 0.8
        });

        let limiteTexto = caixa.x + caixa.largura - 8;
        if (incluirQr) {
            const lado = Math.min(caixa.altura - 10, compacto ? 68 : 74);
            const qrX = caixa.x + caixa.largura - lado - 6;
            desenharQr(pagina, prova.conteudoQr, qrX, caixa.y + (caixa.altura - lado) / 2, lado);
            limiteTexto = qrX - 8;
        }

        const tx = caixa.x + 9;
        const largura = limiteTexto - tx;
        const linhas = [];

        function juntar(texto, fonte, tamanho, cor, recuo) {
            const seguro = textoSeguro(texto);
            const usado = tamanhoQueCabe(fonte, seguro, tamanho, largura - (recuo || 0), 5.5);
            linhas.push({ texto: seguro, fonte: fonte, tamanho: usado, cor: cor || PRETO, recuo: recuo || 0 });
        }

        if (!compacto && opcoes.cabecalho) juntar(opcoes.cabecalho, fontes.normal, 6.4, CINZA);

        juntar(
            prova.componenteNome.toUpperCase() + '  ·  ' + (opcoes.serieNome || '') + '  ·  TURMA ' + prova.turma,
            fontes.negrito,
            compacto ? 9 : 11.5
        );

        const rotulo = 'Nº ' + prova.numeroCurto + '  ·  ';
        const idealNome = compacto ? 8.5 : 11;
        const larguraRotulo = fontes.negrito.widthOfTextAtSize(rotulo, idealNome);
        const nome = encaixarNome(fontes.negrito, textoSeguro(prova.nome), idealNome, largura - larguraRotulo, 2, 5.8);
        const recuoNome = fontes.negrito.widthOfTextAtSize(rotulo, nome.tamanho);
        nome.linhas.forEach(function (parte, indice) {
            linhas.push({
                texto: indice === 0 ? rotulo + parte : parte,
                fonte: fontes.negrito,
                tamanho: nome.tamanho,
                cor: PRETO,
                recuo: indice === 0 ? 0 : recuoNome
            });
        });

        juntar(prova.id, fontes.mono, compacto ? 7.2 : 8.6);

        if (!compacto && opcoes.aviso !== false) {
            juntar('Prova pessoal e numerada. Confira se o nome acima é o seu antes de começar.', fontes.normal, 6.4, CINZA);
        }

        const entrelinha = 1.32;
        const alturaTexto = linhas.reduce(function (soma, l) { return soma + l.tamanho * entrelinha; }, 0);
        let cursor = caixa.y + caixa.altura - Math.max(6, (caixa.altura - alturaTexto) / 2);

        linhas.forEach(function (l) {
            cursor -= l.tamanho;
            pagina.drawText(l.texto, { x: tx + l.recuo, y: cursor, size: l.tamanho, font: l.fonte, color: l.cor });
            cursor -= l.tamanho * (entrelinha - 1);
        });
    }

    /* Onde cada marca fica na folha. As medidas que a coordenação informa são em
       centímetros, contados da borda superior esquerda — é como se mede numa
       folha impressa na mão. */
    function resolverCaixa(marca, largura, altura, transformacao) {
        const tipo = marca.tipo || 'quadrado';

        /* Marca colada num ponto da prova (o campo "ALUNO (A):", por exemplo):
           as medidas são as da página original, então passam pela mesma redução
           e pelo mesmo deslocamento que o conteúdo sofreu. Sem isso, abrir
           espaço no topo desalinharia a marca do campo. */
        if (tipo === 'linha' || marca.ancora === 'livre') {
            const t = transformacao || { escala: 1, dx: 0, dy: 0 };
            const xOriginal = (marca.xCm || 0) * CM;
            const yOriginal = altura - (marca.yCm || 0) * CM;
            const larguraMarca = tipo === 'linha'
                ? (marca.larguraCm || 12) * CM
                : (marca.ladoCm ? marca.ladoCm * CM : QUADRADO_LADO);
            const alturaMarca = tipo === 'linha'
                ? 0
                : (marca.ladoCm ? marca.ladoCm * CM : QUADRADO_LADO);
            return {
                x: t.dx + xOriginal * t.escala,
                y: t.dy + (yOriginal - alturaMarca) * t.escala,
                largura: larguraMarca * t.escala,
                altura: alturaMarca * t.escala,
                escala: t.escala
            };
        }

        if (tipo === 'faixa') {
            const noRodape = marca.local === 'rodape';
            return {
                x: MARGEM,
                y: noRodape ? MARGEM : altura - FAIXA + 8,
                largura: largura - MARGEM * 2,
                altura: FAIXA - 16
            };
        }

        const dimensoes = tipo === 'caixa'
            ? { largura: (marca.larguraCm ? marca.larguraCm * CM : CAIXA_CANTO.largura), altura: (marca.alturaCm ? marca.alturaCm * CM : CAIXA_CANTO.altura) }
            : { largura: (marca.ladoCm ? marca.ladoCm * CM : QUADRADO_LADO), altura: (marca.ladoCm ? marca.ladoCm * CM : QUADRADO_LADO) };

        const larguraCaixa = Math.min(dimensoes.largura, largura - 8);
        const alturaCaixa = Math.min(dimensoes.altura, altura - 8);
        const ancora = marca.ancora || 'topo-direita';

        let x;
        if (ancora === 'topo-esquerda') x = MARGEM;
        else if (ancora === 'topo-centro') x = (largura - larguraCaixa) / 2;
        else x = largura - larguraCaixa - MARGEM;

        const topo = marca.margemTopoCm != null ? marca.margemTopoCm * CM : 6;

        return {
            x: Math.max(2, Math.min(largura - larguraCaixa - 2, x)),
            y: Math.max(2, Math.min(altura - alturaCaixa - 2, altura - topo - alturaCaixa)),
            largura: larguraCaixa,
            altura: alturaCaixa,
            escala: 1
        };
    }

    function desenharMarca(pagina, fontes, prova, marca, largura, altura, comuns) {
        const caixa = resolverCaixa(marca, largura, altura, comuns.transformacao);
        const opcoes = {
            incluirQr: marca.incluirQr !== false,
            incluirNome: !!marca.incluirNome,
            campos: marca.campos,
            /* A marca que acompanha a prova encolhe junto com ela. */
            tamanho: (marca.tamanho || 9) * (caixa.escala || 1),
            fundoBranco: !!marca.fundoBranco,
            cabecalho: comuns.cabecalho,
            serieNome: comuns.serieNome,
            aviso: comuns.aviso,
            compacto: marca.tipo === 'caixa' ? caixa.largura < 330 : false
        };

        if (marca.tipo === 'linha') return desenharLinha(pagina, fontes, prova, caixa, opcoes);
        if (marca.tipo === 'faixa' || marca.tipo === 'caixa') return desenharBloco(pagina, fontes, prova, caixa, opcoes);
        return desenharQuadrado(pagina, fontes, prova, caixa, opcoes);
    }

    /* Encosta a prova no alto da área que sobrou, para não abrir um vão entre a
       identificação e o cabeçalho que o professor escreveu. */
    function posicaoVertical(area, alturaUsada) {
        if (area.alinhar === 'centro') return area.y + (area.altura - alturaUsada) / 2;
        return area.y + area.altura - alturaUsada;
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

    /* Prepara a página enviada: devolve o tamanho e uma função que a redesenha
       dentro de qualquer retângulo, sem distorcer. */
    async function prepararFonte(destino, arquivo) {
        const tipo = String(arquivo.tipo || '').toLowerCase();

        if (tipo === 'pdf') {
            let origem;
            try {
                origem = await PDFDocument.load(arquivo.bytes, { ignoreEncryption: true });
            } catch (erro) {
                throw new Error('Não consegui abrir este PDF (' + (erro.message || erro) + '). Se ele estiver protegido por senha, salve uma cópia sem senha e envie de novo.');
            }
            if (origem.getPageCount() === 0) throw new Error('Este PDF não tem nenhuma página.');

            const pagina = origem.getPage(0);
            const tam = pagina.getSize();
            const giro = ((pagina.getRotation().angle % 360) + 360) % 360;

            /* Página escaneada de lado: o giro entra na matriz do objeto, para a
               cópia sair em pé e a identificação ficar no lugar certo. */
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
               não há o que incorporar, e a via do aluno sai só com a
               identificação, em vez de a geração toda parar. O pdf-lib só
               reclamaria na hora de salvar, então a checagem vem antes. */
            let incorporada = null;
            if (temConteudo(pagina)) {
                incorporada = matriz
                    ? await destino.embedPage(pagina, undefined, matriz)
                    : await destino.embedPage(pagina);
            }

            return {
                largura: largura,
                altura: altura,
                paginas: origem.getPageCount(),
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

        if (tipo === 'jpg' || tipo === 'jpeg' || tipo === 'png') {
            const imagem = tipo === 'png'
                ? await destino.embedPng(arquivo.bytes)
                : await destino.embedJpg(arquivo.bytes);
            return {
                largura: A4[0],
                altura: A4[1],
                paginas: 1,
                imagem: true,
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

    async function carregarFontes(destino) {
        return {
            normal: await destino.embedFont(StandardFonts.Helvetica),
            negrito: await destino.embedFont(StandardFonts.HelveticaBold),
            mono: await destino.embedFont(StandardFonts.CourierBold)
        };
    }

    /* Uma via da primeira página por aluno. */
    async function montarPrimeirasPaginas(opcoes) {
        const provas = opcoes.identificacoes || [];
        if (!provas.length) throw new Error('Nenhum aluno para identificar.');

        const marcas = (opcoes.marcas && opcoes.marcas.length) ? opcoes.marcas : [{ tipo: 'quadrado', ancora: 'topo-direita' }];
        const destino = await PDFDocument.create();
        const fontes = await carregarFontes(destino);
        const fonte = await prepararFonte(destino, opcoes.arquivo);

        /* Espaço aberto no topo: a prova desce e encolhe só o necessário. Em
           zero, a cópia sai em tamanho original e a identificação é sobreposta —
           é o modo que não mexe nas marcas da folha de respostas. */
        const espacoTopo = Math.max(0, (opcoes.espacoTopoCm || 0) * CM);
        const area = espacoTopo > 0
            ? { x: 0, y: 0, largura: fonte.largura, altura: fonte.altura - espacoTopo, alinhar: 'topo' }
            : { x: 0, y: 0, largura: fonte.largura, altura: fonte.altura, alinhar: 'centro' };

        /* A mesma conta que `desenhar` usa, para as marcas posicionadas sobre a
           prova acompanharem a redução e o deslocamento do conteúdo. */
        const escala = Math.min(area.largura / fonte.largura, area.altura / fonte.altura);
        const comuns = {
            cabecalho: opcoes.cabecalho,
            serieNome: opcoes.serieNome,
            aviso: opcoes.aviso,
            transformacao: {
                escala: escala,
                dx: area.x + (area.largura - fonte.largura * escala) / 2,
                dy: posicaoVertical(area, fonte.altura * escala)
            }
        };

        destino.setTitle(textoSeguro(opcoes.tituloArquivo || 'Provas identificadas'));
        destino.setCreator('Provas Identificadas — Painel do Colaborador');
        destino.setProducer('Provas Identificadas — Painel do Colaborador');

        for (let i = 0; i < provas.length; i++) {
            const folha = destino.addPage([fonte.largura, fonte.altura]);
            fonte.desenhar(folha, area);
            marcas.forEach(function (marca) {
                desenharMarca(folha, fontes, provas[i], marca, fonte.largura, fonte.altura, comuns);
            });
            if (opcoes.aoProgresso) opcoes.aoProgresso(i + 1, provas.length);
        }

        return destino.save();
    }

    /* Etiquetas: a mesma identificação em grade, para recortar e colar na prova.
       É a saída para quem imprime a prova direto do Word e não quer converter
       nada: a folha de etiquetas sai daqui e a prova sai do Word como sempre. */
    async function montarEtiquetas(opcoes) {
        const provas = opcoes.identificacoes || [];
        if (!provas.length) throw new Error('Nenhum aluno para identificar.');

        const destino = await PDFDocument.create();
        const fontes = await carregarFontes(destino);
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
            const alturaEtiqueta = Math.min(celulaAltura - 6, 96);
            const caixa = {
                x: margem + coluna * celulaLargura + 3,
                y: A4[1] - margem - (linha + 1) * celulaAltura + (celulaAltura - alturaEtiqueta) / 2,
                largura: celulaLargura - 6,
                altura: alturaEtiqueta
            };
            desenharBloco(folha, fontes, prova, caixa, {
                compacto: caixa.largura < 330,
                incluirQr: opcoes.incluirQr,
                cabecalho: opcoes.cabecalho,
                serieNome: opcoes.serieNome
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
        FAIXA: FAIXA,
        QUADRADO_LADO: QUADRADO_LADO,
        textoSeguro: textoSeguro,
        quebrarTexto: quebrarTexto,
        quebrarEmLinhas: quebrarEmLinhas,
        encaixarNome: encaixarNome,
        partirId: partirId,
        resolverCaixa: resolverCaixa,
        montarPrimeirasPaginas: montarPrimeirasPaginas,
        montarEtiquetas: montarEtiquetas,
        montarFolhaConferencia: montarFolhaConferencia
    };

    global.ProvasPdf = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
