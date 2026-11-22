/* =====================================================================
   Malu Gabaritos · leitura óptica (OMR) em JavaScript puro
   Sem OpenCV, sem dependências. Exposto em window.MaluOMR.ler(imageData, geometria, opcoes)

   Passos:
   1. tons de cinza            → Uint8 por pixel
   2. limiar de Otsu           → "escuro" = cinza <= limiar
   3. componentes conexos      → flood fill iterativo (pilha de Int32)
   4. candidatos a marca       → quase quadrados, densos, de área parecida
   5. ancoragem                → 4 extremos dão uma homografia grosseira (mm → px);
                                 depois todas as 28 marcas da grade + 4 do código são
                                 "casadas" e a homografia é refeita por mínimos quadrados
   6. leitura das bolhas       → fração de preenchimento (escuridão média) num disco de 0,7 × raio
   7. classificação por grupo  → marcada / ambígua / dupla / em branco
   ===================================================================== */
(function (global) {
  'use strict';

  /* ---------- 1. tons de cinza ---------- */
  function paraCinza(img) {
    var d = img.data, n = img.width * img.height, g = new Uint8Array(n);
    for (var i = 0, j = 0; i < n; i++, j += 4) {
      g[i] = (d[j] * 77 + d[j + 1] * 150 + d[j + 2] * 29) >> 8;
    }
    return g;
  }

  /* ---------- 2. Otsu ---------- */
  function otsu(g) {
    var hist = new Float64Array(256), i, total = g.length;
    for (i = 0; i < total; i++) hist[g[i]]++;
    var soma = 0;
    for (i = 0; i < 256; i++) soma += i * hist[i];
    var somaB = 0, wB = 0, melhor = -1, limiar = 127;
    for (i = 0; i < 256; i++) {
      wB += hist[i];
      if (!wB) continue;
      var wF = total - wB;
      if (!wF) break;
      somaB += i * hist[i];
      var mB = somaB / wB, mF = (soma - somaB) / wF;
      var v = wB * wF * (mB - mF) * (mB - mF);
      if (v > melhor) { melhor = v; limiar = i; }
    }
    return limiar;
  }

  /* ---------- 3. componentes conexos (4-vizinhança, sem recursão) ---------- */
  function componentes(g, w, h, limiar) {
    var n = w * h, visto = new Uint8Array(n), pilha = new Int32Array(n), saida = [];
    for (var s = 0; s < n; s++) {
      if (visto[s] || g[s] > limiar) continue;
      var sp = 0, area = 0, sx = 0, sy = 0, x0 = w, x1 = 0, y0 = h, y1 = 0;
      pilha[sp++] = s; visto[s] = 1;
      while (sp) {
        var p = pilha[--sp], x = p % w, y = (p - x) / w;
        area++; sx += x; sy += y;
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
        if (x > 0     && !visto[p - 1] && g[p - 1] <= limiar) { visto[p - 1] = 1; pilha[sp++] = p - 1; }
        if (x < w - 1 && !visto[p + 1] && g[p + 1] <= limiar) { visto[p + 1] = 1; pilha[sp++] = p + 1; }
        if (y > 0     && !visto[p - w] && g[p - w] <= limiar) { visto[p - w] = 1; pilha[sp++] = p - w; }
        if (y < h - 1 && !visto[p + w] && g[p + w] <= limiar) { visto[p + w] = 1; pilha[sp++] = p + w; }
      }
      if (area >= 25) {
        saida.push({ area: area, x: sx / area, y: sy / area, bw: x1 - x0 + 1, bh: y1 - y0 + 1 });
      }
    }
    return saida;
  }

  /* ---------- 4. candidatos a marca de alinhamento ---------- */
  function candidatosMarca(comps) {
    var dens = comps.filter(function (c) {
      var asp = c.bw / c.bh, preench = c.area / (c.bw * c.bh);
      return asp > 0.75 && asp < 1.33 && preench >= 0.82 && c.bw >= 6;
    });
    if (dens.length < 4) return [];
    // área típica = mediana; descarta quadrados muito maiores/menores (ex.: cabeçalho da lista)
    var areas = dens.map(function (c) { return c.area; }).sort(function (a, b) { return a - b; });
    var med = areas[areas.length >> 1];
    return dens.filter(function (c) { return c.area > 0.55 * med && c.area < 1.7 * med; });
  }

  /* ---------- 5. homografia (DLT) ---------- */
  // Resolve A·x = b (n×n) por eliminação gaussiana com pivô parcial.
  function gauss(A, b) {
    var n = b.length, i, j, k;
    for (i = 0; i < n; i++) {
      var piv = i;
      for (k = i + 1; k < n; k++) if (Math.abs(A[k][i]) > Math.abs(A[piv][i])) piv = k;
      if (Math.abs(A[piv][i]) < 1e-12) return null;
      var t = A[i]; A[i] = A[piv]; A[piv] = t;
      var tb = b[i]; b[i] = b[piv]; b[piv] = tb;
      for (k = i + 1; k < n; k++) {
        var f = A[k][i] / A[i][i];
        for (j = i; j < n; j++) A[k][j] -= f * A[i][j];
        b[k] -= f * b[i];
      }
    }
    var x = new Array(n);
    for (i = n - 1; i >= 0; i--) {
      var s = b[i];
      for (j = i + 1; j < n; j++) s -= A[i][j] * x[j];
      x[i] = s / A[i][i];
    }
    return x;
  }

  // pares: [{mm:[x,y], px:[x,y]}] (≥ 4). Com 4 pontos é a DLT exata (8×8);
  // com mais, mínimos quadrados pelas equações normais (também 8×8).
  function ajustarHomografia(pares, S) {
    var M = [], r = [], i, j, k;
    for (i = 0; i < 8; i++) { M.push(new Array(8).fill(0)); r.push(0); }
    pares.forEach(function (p) {
      var X = p.mm[0] / 100, Y = p.mm[1] / 100, u = p.px[0] / S, v = p.px[1] / S;
      var l1 = [X, Y, 1, 0, 0, 0, -X * u, -Y * u], l2 = [0, 0, 0, X, Y, 1, -X * v, -Y * v];
      [[l1, u], [l2, v]].forEach(function (par) {
        for (j = 0; j < 8; j++) {
          r[j] += par[0][j] * par[1];
          for (k = 0; k < 8; k++) M[j][k] += par[0][j] * par[0][k];
        }
      });
    });
    var h = gauss(M, r);
    return h ? { h: h, S: S } : null;
  }

  function projetar(H, xmm, ymm) {
    var X = xmm / 100, Y = ymm / 100, h = H.h;
    var w = h[6] * X + h[7] * Y + 1;
    return [(h[0] * X + h[1] * Y + h[2]) / w * H.S, (h[3] * X + h[4] * Y + h[5]) / w * H.S];
  }

  function escalaLocal(H, x, y) { // px por mm perto de (x, y)
    var a = projetar(H, x, y), b = projetar(H, x + 1, y), c = projetar(H, x, y + 1);
    return (Math.hypot(b[0] - a[0], b[1] - a[1]) + Math.hypot(c[0] - a[0], c[1] - a[1])) / 2;
  }

  // Casa as marcas do modelo com as detectadas, projetando com H.
  function casarMarcas(H, modelo, cands) {
    var pares = [], usados = {};
    modelo.forEach(function (m) {
      var p = projetar(H, m.cx, m.cy), tol = 3.5 * escalaLocal(H, m.cx, m.cy);
      var melhor = -1, dmin = tol;
      cands.forEach(function (c, i) {
        var d = Math.hypot(c.x - p[0], c.y - p[1]);
        if (d < dmin && !usados[i]) { dmin = d; melhor = i; }
      });
      if (melhor >= 0) {
        usados[melhor] = true;
        pares.push({ mm: [m.cx, m.cy], px: [cands[melhor].x, cands[melhor].y], m: m, idx: melhor });
      }
    });
    return pares;
  }

  function ancorar(cands, geo, S, comCodigo) {
    var modelo = [];
    geo.marcas_grade.forEach(function (m) { modelo.push({ cx: m.cx, cy: m.cy, tipo: 'grade', fileira: m.fileira, linha: m.linha }); });
    if (comCodigo) geo.marcas_codigo.forEach(function (m) { modelo.push({ cx: m.cx, cy: m.cy, tipo: 'codigo' }); });

    var tl = min(cands, function (c) { return c.x + c.y; }), tr = max(cands, function (c) { return c.x - c.y; }),
        bl = min(cands, function (c) { return c.x - c.y; }), br = max(cands, function (c) { return c.x + c.y; });
    var xe = geo.marcas_grade[0].cx, xd = geo.marcas_grade[geo.marcas_grade.length - 1].cx;
    var yt = geo.marcas_grade[0].cy;
    var ygrade = geo.marcas_grade[geo.marcas_grade.length - 1].cy;           // linha 30
    var ycod = geo.marcas_codigo[geo.marcas_codigo.length - 1].cy;           // base do bloco do código
    var melhor = null;

    // Hipótese A: os extremos inferiores são as marcas do código; B: são as da grade (linha 30).
    [ycod, ygrade].forEach(function (yb) {
      var H = ajustarHomografia([
        { mm: [xe, yt], px: [tl.x, tl.y] }, { mm: [xd, yt], px: [tr.x, tr.y] },
        { mm: [xe, yb], px: [bl.x, bl.y] }, { mm: [xd, yb], px: [br.x, br.y] }], S);
      if (!H) return;
      var pares = casarMarcas(H, modelo, cands);
      for (var it = 0; it < 3 && pares.length >= 4; it++) {      // refinamento por mínimos quadrados
        var H2 = ajustarHomografia(pares, S);
        if (!H2) break;
        H = H2; pares = casarMarcas(H, modelo, cands);
      }
      if (pares.length >= 4 && (!melhor || pares.length > melhor.pares.length)) melhor = { H: H, pares: pares };
    });
    return melhor;
  }
  function min(a, f) { return a.reduce(function (m, c) { return f(c) < f(m) ? c : m; }); }
  function max(a, f) { return a.reduce(function (m, c) { return f(c) > f(m) ? c : m; }); }

  /* ---------- 6. fração de preenchimento num disco ---------- */
  // Níveis de referência: papel = percentil 90 dos cinzas; tinta = média dos pixels abaixo do limiar de Otsu.
  function niveis(g, limiar) {
    var hist = new Float64Array(256), i, n = g.length, somaT = 0, nT = 0;
    for (i = 0; i < n; i++) hist[g[i]]++;
    for (i = 0; i <= limiar; i++) { somaT += i * hist[i]; nT += hist[i]; }
    var acum = 0, papel = 255;   // papel = valor a partir do qual ficam os 10% mais claros
    for (i = 255; i >= 0; i--) { acum += hist[i]; if (acum >= 0.1 * n) { papel = i; break; } }
    return { papel: papel, tinta: nT ? somaT / nT : 0 };
  }

  // Média da "escuridão" (0 = papel, 1 = tinta cheia) dentro do disco. Para tinta cheia
  // equivale à fração de pixels escuros; para marca fraca (ex.: 35 % de opacidade) dá ~0,35.
  function fracaoEscura(g, w, h, cx, cy, r, nv) {
    var x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(w - 1, Math.ceil(cx + r));
    var y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(h - 1, Math.ceil(cy + r));
    var r2 = r * r, n = 0, d = 0, faixa = Math.max(1, nv.papel - nv.tinta);
    for (var y = y0; y <= y1; y++) {
      for (var x = x0; x <= x1; x++) {
        var dx = x - cx, dy = y - cy;
        if (dx * dx + dy * dy <= r2) {
          n++;
          var e = (nv.papel - g[y * w + x]) / faixa;
          d += e < 0 ? 0 : e > 1 ? 1 : e;
        }
      }
    }
    return n ? d / n : 0;
  }

  /* ---------- 7. classificação de um grupo (questão, coluna, casa) ---------- */
  // itens: [{valor, fracao}] → {valor, status, fracoes, marcadas:[valores], duvidosas:[valores]}
  function classificarGrupo(itens, lim) {
    var fr = {}, ord = itens.slice().sort(function (a, b) { return b.fracao - a.fracao; });
    itens.forEach(function (i) { fr[i.valor] = Math.round(i.fracao * 1000) / 1000; });
    var marc = ord.filter(function (i) { return i.fracao >= lim; });
    var r = { valor: '', status: 'branca', fracoes: fr, marcadas: [], duvidosas: [] };
    if (marc.length >= 2) {
      r.status = 'dupla';
      r.marcadas = marc.map(function (i) { return i.valor; });
      r.valor = r.marcadas.slice().sort().join('');
    } else if (marc.length === 1) {
      var seg = ord[1] ? ord[1].fracao : 0;
      r.valor = marc[0].valor;
      if (seg >= 0.2 && seg >= 0.7 * marc[0].fracao) {      // a 2ª está perto da 1ª
        r.status = 'ambigua'; r.duvidosas = [marc[0].valor, ord[1].valor];
      } else { r.status = 'marcada'; r.marcadas = [marc[0].valor]; }
    } else if (ord[0] && ord[0].fracao >= 0.2) {            // fraca demais para valer
      r.status = 'ambigua'; r.valor = ord[0].valor;
      r.duvidosas = ord.filter(function (i) { return i.fracao >= 0.2; }).map(function (i) { return i.valor; });
    }
    return r;
  }

  /* ---------- função pública ---------- */
  function ler(img, geo, opcoes) {
    var t0 = (global.performance || Date).now();
    opcoes = opcoes || {};
    var lim = opcoes.limiarMarcada || 0.55;
    var comCodigo = opcoes.codigo !== false;   // {codigo:false}: prova sem código, ignora o bloco inteiro
    var w = img.width, h = img.height;
    var g = paraCinza(img), tOtsu = otsu(g), nv = niveis(g, tOtsu);
    var comps = componentes(g, w, h, tOtsu);
    var cands = candidatosMarca(comps);
    var res = { ok: false, largura: w, altura: h, limiarOtsu: tOtsu, marcas: [], cantos: [], bolhas: [],
                lista: null, respostas: {}, codigo: null, alertas: [], erroPx: null, ms: 0 };

    var anc = cands.length >= 4 ? ancorar(cands, geo, Math.max(w, h), comCodigo) : null;
    if (!anc || anc.pares.length < 8) {
      res.alertas.push({ tipo: 'ilegivel', campo: 'cartao', detalhe: 'Não encontrei as marcas de alinhamento. Enquadre o cartão inteiro, com boa luz.' });
      res.marcas = cands.map(function (c) { return { x: c.x, y: c.y, tam: Math.max(c.bw, c.bh), tipo: 'outra' }; });
      res.ms = Math.round((global.performance || Date).now() - t0);
      return res;
    }
    var H = anc.H, usado = {};
    anc.pares.forEach(function (p) { usado[p.idx] = p.m; });
    var soma = 0;
    anc.pares.forEach(function (p) { var q = projetar(H, p.mm[0], p.mm[1]); soma += Math.pow(q[0] - p.px[0], 2) + Math.pow(q[1] - p.px[1], 2); });
    res.erroPx = Math.round(Math.sqrt(soma / anc.pares.length) * 100) / 100;
    res.marcas = cands.map(function (c, i) {
      return { x: c.x, y: c.y, tam: Math.max(c.bw, c.bh), tipo: usado[i] ? usado[i].tipo : 'outra' };
    });
    // os 4 cantos da grade principal: (fileira 0|3, linha 0|30)
    anc.pares.forEach(function (p) {
      var m = p.m;
      if (m.tipo === 'grade' && (m.fileira === 0 || m.fileira === 3) && (m.linha === 0 || m.linha === 30)) {
        res.cantos.push({ x: p.px[0], y: p.px[1], fileira: m.fileira, linha: m.linha });
      }
    });
    res.homografia = H.h;

    var raioLeitura = 0.7;
    function medir(b, grupo) {
      var c = projetar(H, b.cx, b.cy), rpx = geo.raio * escalaLocal(H, b.cx, b.cy);
      var f = fracaoEscura(g, w, h, c[0], c[1], raioLeitura * rpx, nv);
      return { grupo: grupo, valor: b.valor, x: c[0], y: c[1], r: rpx, fracao: f, estado: null };
    }
    function agrupar(lista, chave, tag) {
      var mapa = {}, ordem = [];
      lista.forEach(function (b) {
        var k = chave(b);
        if (!mapa[k]) { mapa[k] = []; ordem.push(k); }
        var m = medir(b, tag + ':' + k);
        mapa[k].push(m); res.bolhas.push(m);
      });
      return ordem.map(function (k) { return { chave: k, medidas: mapa[k] }; });
    }
    // aplica o estado do grupo às bolhas (para o desenho)
    function pintar(grp, cls) {
      var est = cls.status === 'dupla' ? 'dupla' : cls.status === 'ambigua' ? 'ambigua' : 'marcada';
      grp.medidas.forEach(function (m) {
        if (cls.status === 'dupla' && cls.marcadas.indexOf(m.valor) >= 0) m.estado = 'dupla';
        else if (cls.status === 'ambigua' && cls.duvidosas.indexOf(m.valor) >= 0) m.estado = 'ambigua';
        else if (cls.status === 'marcada' && cls.marcadas[0] === m.valor) m.estado = est;
      });
    }
    function classificar(grp) {
      var cls = classificarGrupo(grp.medidas.map(function (m) { return { valor: m.valor, fracao: m.fracao }; }), lim);
      pintar(grp, cls);
      return cls;
    }

    // Núm. da lista: duas casas (dezena, unidade)
    var casas = agrupar(geo.bolhas_lista, function (b) { return b.casa; }, 'lista');
    var cd = classificar(casas.filter(function (c) { return c.chave === 'dezena'; })[0]);
    var cu = classificar(casas.filter(function (c) { return c.chave === 'unidade'; })[0]);
    var okLista = cd.status === 'marcada' && cu.status === 'marcada';
    res.lista = { valor: okLista ? cd.valor + cu.valor : null, numero: okLista ? parseInt(cd.valor + cu.valor, 10) : null,
                  dezena: cd, unidade: cu, status: okLista ? 'marcada' : 'duvidosa' };
    if (!okLista) res.alertas.push({ tipo: 'lista', campo: 'lista', detalhe: 'Não consegui ler o número da lista com segurança.' });

    // Questões
    agrupar(geo.bolhas_questoes, function (b) { return b.questao; }, 'q').forEach(function (grp) {
      var c = classificar(grp);
      res.respostas[grp.chave] = { valor: c.valor, status: c.status, fracoes: c.fracoes };
      if (c.status === 'ambigua') res.alertas.push({ tipo: 'fraca', campo: 'q' + grp.chave, detalhe: 'Marca fraca ou duvidosa na questão ' + grp.chave + '.' });
      if (c.status === 'dupla') res.alertas.push({ tipo: 'dupla', campo: 'q' + grp.chave, detalhe: 'Duas bolhas marcadas na questão ' + grp.chave + ' (' + c.valor.split('').join(' e ') + ').' });
    });

    // Código de verificação: 3 colunas de letras + 3 de algarismos (só nas provas com código)
    if (comCodigo) {
    var pos = [];
    agrupar(geo.bolhas_letras, function (b) { return b.posicao; }, 'cod').concat(
      agrupar(geo.bolhas_digitos, function (b) { return b.posicao; }, 'cod')).forEach(function (grp) {
      pos[parseInt(grp.chave, 10) - 1] = classificar(grp);
    });
    var texto = pos.map(function (c) { return c.status === 'marcada' ? c.valor : c.status === 'branca' ? '_' : '?'; }).join('');
    var tudo = pos.every(function (c) { return c.status === 'marcada'; });
    res.codigo = { texto: texto, completo: tudo, posicoes: pos,
                   status: tudo ? 'lido' : (pos.every(function (c) { return c.status === 'branca'; }) ? 'em_branco' : 'ilegivel') };
    if (res.codigo.status === 'ilegivel') res.alertas.push({ tipo: 'codigo', campo: 'codigo', detalhe: 'Código de verificação com coluna dupla ou fraca.' });
    } else res.codigo = null;
    res.comCodigo = comCodigo;

    res.ok = true;
    res.ms = Math.round((global.performance || Date).now() - t0);
    return res;
  }

  var api = { ler: ler, versao: '1.1', _interno: { otsu: otsu, ajustarHomografia: ajustarHomografia, projetar: projetar } };
  global.MaluOMR = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
