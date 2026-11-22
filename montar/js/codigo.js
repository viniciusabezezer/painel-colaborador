/* Código de verificação da prova.

   Cada cópia impressa recebe um código de 6 caracteres, sempre o mesmo para
   a mesma prova e a mesma cópia. As três primeiras posições são letras
   distintas de A C E F P R T V: a primeira letra de uma palavra do enunciado
   sai sublinhada, na mesma cor do texto. As três últimas são algarismos de
   3 a 9: o resultado de uma soma de dois números escrita no meio de outra
   frase, sem marca nenhuma. Letras primeiro, depois algarismos, cada grupo
   na ordem das questões.

   O sorteio replica o gerador do Python (random.Random com semente de 64
   bits vinda do SHA-256), para a mesma prova e a mesma cópia darem o mesmo
   código. Não usa modelo de linguagem. */
(function (global) {
    'use strict';

    const LETRAS_OK = 'ACEFPRTV';
    const DIGITOS_OK = [3, 4, 5, 6, 7, 8, 9];
    const STOP = {
        essa: 1, esse: 1, este: 1, esta: 1, estas: 1, estes: 1, isso: 1, isto: 1,
        aquele: 1, aquela: 1, aqueles: 1, aquelas: 1, aquilo: 1,
        para: 1, pela: 1, pelo: 1, pelas: 1, pelos: 1, como: 1, quando: 1, onde: 1,
        apos: 1, desde: 1, entre: 1, sem: 1, com: 1, mais: 1, muito: 1, bem: 1,
        ainda: 1, tambem: 1, uma: 1, umas: 1, uns: 1, sobre: 1
    };
    const PALAVRA = /[A-Za-zÀ-ÿÁáÂâÃãÀàÉéÊêÍíÓóÔôÕõÚúÜüÇç]+/g;

    const TEXTO_INSTRUCOES = [
        'Código de verificação. O código tem 6 caracteres e segue a ordem das questões, da primeira até a última.',
        '1º, 2º e 3º: em três questões, a primeira letra de uma palavra do enunciado está sublinhada, no mesmo preto do texto. Essa letra entra no código. As letras possíveis são A, C, E, F, P, R, T e V, e as três são diferentes.',
        '4º, 5º e 6º: em outras três questões há uma soma de dois números no meio da frase, escrita como o resto do texto, sem marca, sem caixa e sem sinal de igual. O algarismo do código é o resultado dessa soma, de 3 a 9.',
        'No cartão-resposta, pinte uma bolha em cada uma das 6 colunas do código.',
        'Código certo: +1 ponto, já contado na nota desta prova.',
        'Código em branco ou errado: você fica devendo 1 ponto. Dá para recuperar até o fim do prazo de lançamento das notas no sistema oficial, de um jeito só, à escolha do professor: uma tarefa avulsa, uma medida restaurativa simples, ou um mini teste oral de 2 ou 3 perguntas corrigido pelo professor.'
    ];

    /* ---------- SHA-256 (navegador sem crypto.subtle no file://) ---------- */

    function sha256Bytes(texto) {
        if (global.ProvasSha256) return global.ProvasSha256.bytes(texto);
        if (typeof require === 'function') {
            try {
                return Array.from(require('crypto').createHash('sha256').update(String(texto), 'utf8').digest());
            } catch (e) { /* segue para o erro abaixo */ }
        }
        throw new Error('SHA-256 indisponível');
    }

    /* Semente de 64 bits, os 8 primeiros bytes do SHA-256, como inteiro. */
    function semente(provaId, copiaId) {
        const b = sha256Bytes(String(provaId) + '|' + String(copiaId));
        let n = 0n;
        for (let i = 0; i < 8; i++) n = (n << 8n) | BigInt(b[i]);
        return n;
    }

    /* ---------- o mesmo Mersenne Twister do random.Random do Python ---------- */

    const N = 624;
    const M = 397;
    const MATRIX_A = 0x9908b0df;
    const UPPER = 0x80000000;
    const LOWER = 0x7fffffff;

    function mt() {
        const estado = new Uint32Array(N);
        let index = N;
        function initGen(s) {
            estado[0] = s >>> 0;
            for (let i = 1; i < N; i++) {
                const prev = estado[i - 1];
                estado[i] = (Math.imul(1812433253, (prev ^ (prev >>> 30)) >>> 0) + i) >>> 0;
            }
            index = N;
        }
        function initByArray(chave) {
            initGen(19650218);
            let i = 1;
            let j = 0;
            const kmax = N > chave.length ? N : chave.length;
            for (let k = kmax; k; k--) {
                const prev = estado[i - 1];
                const mist = (estado[i] ^ Math.imul((prev ^ (prev >>> 30)) >>> 0, 1664525)) >>> 0;
                estado[i] = (mist + (chave[j] >>> 0) + j) >>> 0;
                i++; j++;
                if (i >= N) { estado[0] = estado[N - 1]; i = 1; }
                if (j >= chave.length) j = 0;
            }
            for (let k = N - 1; k; k--) {
                const prev = estado[i - 1];
                const mist = (estado[i] ^ Math.imul((prev ^ (prev >>> 30)) >>> 0, 1566083941)) >>> 0;
                estado[i] = (mist - i) >>> 0;
                i++;
                if (i >= N) { estado[0] = estado[N - 1]; i = 1; }
            }
            estado[0] = 0x80000000;
            index = N;
        }
        function gen() {
            if (index >= N) {
                let kk;
                for (kk = 0; kk < N - M; kk++) {
                    const y = (estado[kk] & UPPER) | (estado[kk + 1] & LOWER);
                    estado[kk] = (estado[kk + M] ^ (y >>> 1) ^ ((y & 1) ? MATRIX_A : 0)) >>> 0;
                }
                for (; kk < N - 1; kk++) {
                    const y = (estado[kk] & UPPER) | (estado[kk + 1] & LOWER);
                    estado[kk] = (estado[kk + (M - N)] ^ (y >>> 1) ^ ((y & 1) ? MATRIX_A : 0)) >>> 0;
                }
                const y = (estado[N - 1] & UPPER) | (estado[0] & LOWER);
                estado[N - 1] = (estado[M - 1] ^ (y >>> 1) ^ ((y & 1) ? MATRIX_A : 0)) >>> 0;
                index = 0;
            }
            let y = estado[index++];
            y ^= y >>> 11;
            y ^= (y << 7) & 0x9d2c5680;
            y ^= (y << 15) & 0xefc60000;
            y ^= y >>> 18;
            return y >>> 0;
        }
        function getrandbits(k) {
            if (k <= 0) throw new Error('getrandbits');
            if (k <= 32) return gen() >>> (32 - k);
            throw new Error('getrandbits grande');
        }
        function randbelow(n) {
            if (n <= 0) throw new Error('randbelow');
            const k = 32 - Math.clz32(n);
            let r = getrandbits(k);
            while (r >= n) r = getrandbits(k);
            return r;
        }
        function shuffle(lista) {
            for (let i = lista.length - 1; i > 0; i--) {
                const j = randbelow(i + 1);
                const t = lista[i];
                lista[i] = lista[j];
                lista[j] = t;
            }
            return lista;
        }
        function choice(lista) { return lista[randbelow(lista.length)]; }
        function semear(valor) {
            let n = typeof valor === 'bigint' ? valor : BigInt(valor);
            if (n < 0n) n = -n;
            const chave = [];
            if (n === 0n) chave.push(0);
            else {
                while (n > 0n) {
                    chave.push(Number(n & 0xffffffffn));
                    n >>= 32n;
                }
            }
            initByArray(chave);
        }
        return { semear: semear, shuffle: shuffle, choice: choice, getrandbits: getrandbits };
    }

    function rngDaSemente(seed) {
        const g = mt();
        g.semear(seed);
        return g;
    }

    /* ---------- palavras e somas ---------- */

    function semAcento(texto) {
        return String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }

    function primeiraLetra(palavra) {
        const base = semAcento(palavra);
        if (!base) return null;
        const ch = base[0].toUpperCase();
        return LETRAS_OK.indexOf(ch) === -1 ? null : ch;
    }

    function palavrasCandidatas(enunciado) {
        const out = [];
        const re = new RegExp(PALAVRA.source, 'g');
        let m;
        const texto = String(enunciado || '');
        while ((m = re.exec(texto))) {
            const palavra = m[0];
            if (palavra.length < 4) continue;
            if (STOP[semAcento(palavra).toLowerCase()]) continue;
            const letra = primeiraLetra(palavra);
            if (!letra) continue;
            out.push({ palavra: palavra, letra: letra, start: m.index, end: m.index + palavra.length });
        }
        return out;
    }

    function montarSoma(rng, resultado) {
        if (DIGITOS_OK.indexOf(resultado) === -1) throw new Error('resultado fora de 3–9: ' + resultado);
        const pares = [];
        for (let a = 1; a < resultado; a++) pares.push([a, resultado - a]);
        const par = rng.choice(pares);
        return par[0] + ' + ' + par[1];
    }

    function avaliarConta(expr) {
        const m = /^\s*(\d+)\s*\+\s*(\d+)\s*$/.exec(String(expr || ''));
        if (!m) throw new Error('soma inválida: ' + expr);
        const valor = Number(m[1]) + Number(m[2]);
        if (DIGITOS_OK.indexOf(valor) === -1) throw new Error('resultado fora de 3–9: ' + expr);
        return valor;
    }

    /* questoes: [{ numero, enunciado }] na ordem da prova. */
    function gerarCopia(provaId, copiaId, questoes) {
        const lista = (questoes || []).map(function (q, i) {
            return { numero: q.numero || (i + 1), enunciado: String(q.enunciado || '') };
        });
        if (lista.length < 6) {
            throw new Error('O código precisa de pelo menos 6 questões com enunciado.');
        }
        const seed = semente(provaId, copiaId);
        const rng = rngDaSemente(seed);
        const porNumero = {};
        lista.forEach(function (q) { porNumero[q.numero] = q; });
        const qs = lista.map(function (q) { return q.numero; });
        rng.shuffle(qs);

        const marcasL = [];
        const usadas = {};
        const resto = [];
        qs.forEach(function (qn) {
            if (marcasL.length < 3) {
                const cands = palavrasCandidatas(porNumero[qn].enunciado).filter(function (c) { return !usadas[c.letra]; });
                if (cands.length) {
                    const c = rng.choice(cands);
                    usadas[c.letra] = 1;
                    marcasL.push({
                        posicao: 0, questao: qn, letra: c.letra, palavra: c.palavra, start: c.start, end: c.end
                    });
                    return;
                }
            }
            resto.push(qn);
        });
        if (marcasL.length < 3) throw new Error('Não há 3 palavras com iniciais diferentes no conjunto A C E F P R T V.');
        if (resto.length < 3) throw new Error('Não restaram 3 questões para as somas.');

        marcasL.sort(function (a, b) { return a.questao - b.questao || a.start - b.start; });
        marcasL.forEach(function (m, i) { m.posicao = i + 1; });

        const somasQs = resto.slice(0, 3).slice().sort(function (a, b) { return a - b; });
        const contas = somasQs.map(function (qn, i) {
            const digito = rng.choice(DIGITOS_OK);
            const expr = montarSoma(rng, digito);
            if (avaliarConta(expr) !== digito) throw new Error('soma inconsistente');
            return { posicao: i + 4, questao: qn, expressao: expr, resultado: digito };
        });

        const codigo = marcasL.map(function (m) { return m.letra; }).join('') +
            contas.map(function (m) { return String(m.resultado); }).join('');
        return {
            provaId: String(provaId),
            copiaId: String(copiaId),
            seed: seed.toString(),
            codigo: codigo,
            letras: marcasL,
            contas: contas
        };
    }

    function verificar(copia, questoes) {
        const porNumero = {};
        (questoes || []).forEach(function (q) { porNumero[q.numero] = String(q.enunciado || ''); });
        const letras = copia.letras.slice().sort(function (a, b) { return a.questao - b.questao || a.start - b.start; });
        const contas = copia.contas.slice().sort(function (a, b) { return a.questao - b.questao; });
        letras.forEach(function (m) {
            const en = porNumero[m.questao];
            if (!en || en.slice(m.start, m.end) !== m.palavra) throw new Error('palavra não bate com o enunciado');
            if (primeiraLetra(m.palavra) !== m.letra) throw new Error('inicial não confere');
            if (LETRAS_OK.indexOf(m.letra) === -1) throw new Error('letra inválida');
        });
        const letrasSet = {};
        letras.forEach(function (m) { letrasSet[m.letra] = 1; });
        if (Object.keys(letrasSet).length !== 3) throw new Error('letras repetidas');
        const recon = letras.map(function (m) { return m.letra; }).join('') +
            contas.map(function (m) { return String(avaliarConta(m.expressao)); }).join('');
        if (recon !== copia.codigo) throw new Error('código não derivável');
        const usados = {};
        letras.concat(contas).forEach(function (m) {
            if (usados[m.questao]) throw new Error('questão repetida');
            usados[m.questao] = 1;
        });
        if (Object.keys(usados).length !== 6) throw new Error('faltam questões');
        return true;
    }

    /* Compara o código lido nas bolhas com o guardado.
       leitura: string de 6 caracteres, com '_' em branco e '?' ambíguo,
       ou o objeto que o leitor devolve em `codigo`. */
    function conferir(esperado, leitura) {
        let texto = '';
        if (leitura && typeof leitura === 'object') {
            if (leitura.status === 'em_branco') return 'em_branco';
            texto = String(leitura.texto || '');
        } else {
            texto = String(leitura || '');
        }
        if (!texto || /^_+$/.test(texto)) return 'em_branco';
        if (texto.indexOf('?') !== -1) return 'ambiguo';
        if (texto.indexOf('_') !== -1) return 'incorreto';
        return texto === String(esperado || '') ? 'correto' : 'incorreto';
    }

    /* Nota em 0–10. O ponto do código entra na nota registrada e fica lá:
       certo soma 1 (teto 10); em branco ou errado tira 1 (piso 0).
       Recuperar o ponto não muda este número. O professor ajusta a nota
       no registro dele; o app só guarda a situação (aberto, recuperado
       ou não recuperado). */
    function notaDaProva(op) {
        op = op || {};
        const total = op.total || 0;
        const base = total ? (op.acertos || 0) / total * 10 : 0;
        const arred = function (n) { return Math.round(n * 10) / 10; };
        if (!op.comCodigo) return { nota: arred(base), ponto: null, base: arred(base) };
        if (op.statusCodigo === 'correto') return { nota: arred(Math.min(10, base + 1)), ponto: 1, base: arred(base) };
        if (op.statusCodigo === 'ambiguo' || !op.statusCodigo) return { nota: null, ponto: null, base: arred(base), pendente: true };
        return { nota: arred(Math.max(0, base - 1)), ponto: -1, base: arred(base) };
    }

    /* ---------- pistas no enunciado (só na cópia impressa) ---------- */

    function sublinhar(enunciado, marca) {
        const texto = String(enunciado || '');
        if (texto.slice(marca.start, marca.end) !== marca.palavra) return texto;
        const inicial = marca.palavra.charAt(0);
        const resto = marca.palavra.slice(1);
        return texto.slice(0, marca.start) + '{{u:' + inicial + '}}' + resto + texto.slice(marca.end);
    }

    /* A soma entra no meio da primeira frase, antes da palavra do meio.
       Se a frase for curta demais, a soma fecha o enunciado. */
    function inserirSoma(enunciado, expr) {
        const texto = String(enunciado || '');
        const nl = texto.indexOf('\n');
        const par = nl === -1 ? texto : texto.slice(0, nl);
        const depoisPar = nl === -1 ? '' : texto.slice(nl);
        const fim = par.search(/[.!?]/);
        const sentenca = fim === -1 ? par : par.slice(0, fim);
        const cauda = fim === -1 ? '' : par.slice(fim);
        const palavras = [];
        const re = /\S+/g;
        let m;
        while ((m = re.exec(sentenca))) palavras.push(m.index);
        if (palavras.length < 4) {
            const base = sentenca.replace(/\s+$/, '');
            const ponto = fim === -1 ? '.' : '';
            return base + ' Em ' + expr + ' casos' + ponto + cauda + depoisPar;
        }
        const alvo = palavras[Math.floor(palavras.length / 2)];
        const antes = sentenca.slice(0, alvo).replace(/\s+$/, '');
        return antes + ' ' + expr + ' ' + sentenca.slice(alvo) + cauda + depoisPar;
    }

    /* Devolve uma prova nova, com as pistas só nos enunciados desta cópia.
       A prova guardada não muda. */
    function aplicar(prova, copia) {
        const clone = JSON.parse(JSON.stringify(prova));
        const letras = {};
        const contas = {};
        (copia.letras || []).forEach(function (m) { letras[m.questao] = m; });
        (copia.contas || []).forEach(function (m) { contas[m.questao] = m; });
        let n = 0;
        (clone.secoes || []).forEach(function (s) {
            (s.questoes || []).forEach(function (q) {
                if (q.tipo === 'texto') return;
                n++;
                if (letras[n]) q.enunciado = sublinhar(q.enunciado, letras[n]);
                if (contas[n]) q.enunciado = inserirSoma(q.enunciado, contas[n].expressao);
            });
        });
        clone.copiaImpressa = {
            copiaId: copia.copiaId, codigo: copia.codigo, turma: copia.turma || '',
            sala: copia.sala || '', lista: copia.lista || null
        };
        return clone;
    }

    function idEstavel(prova) {
        if (prova && prova.nuvem && prova.nuvem.id) return String(prova.nuvem.id);
        if (prova && prova.id) return String(prova.id);
        return [prova && prova.ano, prova && prova.bimestre, prova && prova.serie, prova && prova.componente, prova && prova.titulo].join('|');
    }

    function questoesDaProva(prova, numeradas) {
        const itens = numeradas || [];
        return itens.filter(function (item) { return item.questao && item.questao.tipo !== 'texto'; }).map(function (item) {
            return { numero: item.numero, enunciado: item.questao.enunciado || '' };
        });
    }

    /* Gera (ou recusa) todas as cópias das turmas cadastradas. */
    function gerarPacote(prova, numeradas) {
        const questoes = questoesDaProva(prova, numeradas);
        const turmas = Array.isArray(prova.turmasCodigo) ? prova.turmasCodigo : [];
        const copias = [];
        const erros = [];
        turmas.forEach(function (t) {
            const qtd = Math.max(0, t.quantidade | 0);
            for (let i = 1; i <= qtd; i++) {
                const lista = String(i).padStart(2, '0');
                const copiaId = String(t.turma || 'turma').trim() + '-' + lista;
                try {
                    const c = gerarCopia(idEstavel(prova), copiaId, questoes);
                    c.turma = String(t.turma || '').trim();
                    c.sala = String(t.sala || '').trim();
                    c.lista = i;
                    c.professorId = t.professorId || null;
                    copias.push(c);
                } catch (e) {
                    erros.push(copiaId + ': ' + e.message);
                }
            }
        });
        return { copias: copias, erros: erros, provaId: idEstavel(prova) };
    }

    const api = {
        LETRAS_OK: LETRAS_OK,
        DIGITOS_OK: DIGITOS_OK,
        TEXTO_INSTRUCOES: TEXTO_INSTRUCOES,
        semente: semente,
        rngDaSemente: rngDaSemente,
        palavrasCandidatas: palavrasCandidatas,
        montarSoma: montarSoma,
        avaliarConta: avaliarConta,
        gerarCopia: gerarCopia,
        verificar: verificar,
        conferir: conferir,
        notaDaProva: notaDaProva,
        sublinhar: sublinhar,
        inserirSoma: inserirSoma,
        aplicar: aplicar,
        idEstavel: idEstavel,
        gerarPacote: gerarPacote
    };

    global.MontarCodigo = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
