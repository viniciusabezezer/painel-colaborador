/* A parte compartilhada do Montador: login, cadastro de professores e as
   provas da área, montadas a várias mãos (Supabase, tabelas montador_*).

   A prova da área abre no mesmo editor das provas pessoais. A diferença é o
   objeto prova.nuvem, que diz quem está editando, o que essa pessoa pode
   mexer e o que já foi para o servidor ("base"). Quem decide o que cada um
   pode fazer é o banco (RLS); a tela só acompanha.

   Sincronização: a cada alteração, o app compara a prova com a base e manda
   só o que mudou — o casco (formato, instruções) se for o PCA, as seções se
   for o PCA, e as questões das seções que a pessoa pode escrever. Sem
   internet, as mudanças esperam: a cópia local fica no IndexedDB e a próxima
   tentativa manda tudo. As mudanças dos colegas chegam em tempo real e
   entram na prova sem atropelar o que a pessoa está editando. */
(function (global) {
    'use strict';

    const Modelos = global.MontarModelos;
    const CONFIG = global.MONTADOR_NUVEM || {};

    /* campos do "casco" da prova: tudo menos as seções e as questões */
    const CASCO = ['titulo', 'serie', 'componente', 'bimestre', 'ano', 'turma', 'professor', 'data', 'valor', 'disciplina',
        'layout', 'ajustes', 'fixo', 'modeloId', 'modeloNome', 'gabaritoImagem'];

    let cliente = null;
    let perfilAtual = null;
    const ouvintes = [];

    /* ===================== cliente ===================== */

    function obterCliente() {
        if (cliente) return cliente;
        /* nos testes, um servidor de mentira entra no lugar do Supabase */
        if (global.MONTADOR_CLIENTE_FALSO) {
            cliente = global.MONTADOR_CLIENTE_FALSO;
        } else if (global.supabase && CONFIG.url) {
            cliente = global.supabase.createClient(CONFIG.url, CONFIG.chave, {
                auth: { persistSession: true, autoRefreshToken: true, storageKey: 'montador-provas-sessao' }
            });
        }
        return cliente;
    }

    function disponivel() { return !!obterCliente(); }

    function aoMudarSessao(fn) { ouvintes.push(fn); }
    function avisar() { ouvintes.forEach(function (fn) { try { fn(perfilAtual); } catch (e) { /* segue */ } }); }

    function mensagem(erro) {
        if (!erro) return '';
        const m = erro.message || String(erro);
        if (/Invalid login credentials/i.test(m)) return 'E-mail ou senha não conferem.';
        if (/banned/i.test(m)) return 'Esta conta está desativada. Fale com a gestão.';
        if (/Failed to fetch|NetworkError|network/i.test(m)) return 'Sem conexão com o servidor.';
        if (/row-level security|permission denied/i.test(m)) return 'Você não tem permissão para isso.';
        return m;
    }

    function semRede(erro) {
        return !!erro && /Failed to fetch|NetworkError|network|Load failed|fetch/i.test(erro.message || String(erro));
    }

    async function exigir(resposta) {
        const r = await resposta;
        if (r && r.error) throw r.error;
        return r ? r.data : null;
    }

    /* ===================== sessão ===================== */

    async function carregarPerfil() {
        const c = obterCliente();
        if (!c) { perfilAtual = null; return null; }
        const { data } = await c.auth.getSession();
        const usuario = data && data.session && data.session.user;
        if (!usuario) { perfilAtual = null; return null; }
        try {
            const perfil = await exigir(c.from('montador_perfis').select('*').eq('id', usuario.id).maybeSingle());
            perfilAtual = perfil && perfil.ativo ? perfil : null;
            if (perfilAtual) guardarPerfilLocal(perfilAtual);
        } catch (erro) {
            /* sem internet: vale o perfil da última vez */
            perfilAtual = semRede(erro) ? lerPerfilLocal(usuario.id) : null;
        }
        return perfilAtual;
    }

    function guardarPerfilLocal(p) { try { localStorage.setItem('montador-provas:perfil', JSON.stringify(p)); } catch (e) { /* segue */ } }
    function lerPerfilLocal(id) {
        try { const p = JSON.parse(localStorage.getItem('montador-provas:perfil') || 'null'); return p && p.id === id ? p : null; } catch (e) { return null; }
    }

    async function iniciar() {
        const c = obterCliente();
        if (!c) return null;
        await carregarPerfil();
        if (c.auth.onAuthStateChange) {
            c.auth.onAuthStateChange(function (evento) {
                if (evento === 'SIGNED_OUT') { perfilAtual = null; avisar(); }
            });
        }
        avisar();
        return perfilAtual;
    }

    function perfil() { return perfilAtual; }

    async function entrar(email, senha) {
        const c = obterCliente();
        const { error } = await c.auth.signInWithPassword({ email: String(email).trim().toLowerCase(), password: senha });
        if (error) throw new Error(mensagem(error));
        const p = await carregarPerfil();
        if (!p) {
            await c.auth.signOut();
            throw new Error('Esta conta não tem acesso ao Montador. Peça o cadastro à gestão.');
        }
        avisar();
        return p;
    }

    async function sair() {
        const c = obterCliente();
        if (c) await c.auth.signOut();
        perfilAtual = null;
        try { localStorage.removeItem('montador-provas:perfil'); } catch (e) { /* segue */ }
        avisar();
    }

    async function trocarSenha(nova) {
        if (String(nova).length < 8) throw new Error('A senha precisa ter pelo menos 8 caracteres.');
        const { error } = await obterCliente().auth.updateUser({ password: nova });
        if (error) throw new Error(mensagem(error));
    }

    /* ===================== gestão (função montador-usuarios) ===================== */

    async function funcao(corpo) {
        const { data, error } = await obterCliente().functions.invoke(CONFIG.funcaoUsuarios || 'montador-usuarios', { body: corpo });
        if (data && data.erro) throw new Error(data.erro);
        if (error) {
            /* o corpo do erro traz a explicação da função */
            let texto = '';
            try { texto = (await error.context.json()).erro; } catch (e) { /* segue */ }
            throw new Error(texto || mensagem(error));
        }
        return data;
    }

    async function primeiroAcessoAberto() {
        try { return !!(await funcao({ acao: 'situacao' })).primeiroAcesso; } catch (e) { return false; }
    }

    async function primeiroAcesso(dados) {
        await funcao(Object.assign({ acao: 'primeiro-acesso' }, dados));
        return entrar(dados.email, dados.senha);
    }

    function criarProfessor(dados) { return funcao(Object.assign({ acao: 'criar' }, dados)); }
    function atualizarProfessor(id, dados) { return funcao(Object.assign({ acao: 'atualizar', id: id }, dados)); }
    function excluirProfessor(id) { return funcao({ acao: 'excluir', id: id }); }

    async function perfis() {
        return (await exigir(obterCliente().from('montador_perfis').select('*').order('nome'))) || [];
    }

    /* ===================== provas da área ===================== */

    function coordena(componente) {
        const p = perfilAtual;
        return !!p && (p.papel === 'gestao' || (p.papel === 'pca' && p.area === componente));
    }

    async function listarProvas() {
        const c = obterCliente();
        const provas = (await exigir(c.from('montador_provas').select('*').order('atualizada_em', { ascending: false }))) || [];
        if (!provas.length) return [];
        const secoes = (await exigir(c.from('montador_secoes').select('*').in('prova_id', provas.map(function (p) { return p.id; })))) || [];
        const questoes = (await exigir(c.from('montador_questoes').select('id, prova_id, secao_id').in('prova_id', provas.map(function (p) { return p.id; })))) || [];
        return provas.map(function (p) {
            const minhas = secoes.filter(function (s) { return s.prova_id === p.id; }).sort(function (a, b) { return a.ordem - b.ordem; });
            return Object.assign({}, p, {
                secoes: minhas.map(function (s) {
                    return Object.assign({}, s, { total: questoes.filter(function (q) { return q.secao_id === s.id; }).length });
                })
            });
        });
    }

    function uuid() {
        if (global.crypto && crypto.randomUUID) return crypto.randomUUID();
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0;
            return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
    }

    function casco(prova) {
        const dados = {};
        CASCO.forEach(function (k) { if (prova[k] !== undefined) dados[k] = prova[k]; });
        return dados;
    }

    /* Cria a prova da área: o casco sai do modelo escolhido; as seções, da
       lista com o responsável de cada uma. */
    async function criarProva(opcoes) {
        const modelo = Modelos.obter(opcoes.modeloId) || Modelos.obter(Modelos.FIXO_ID);
        const local = Modelos.criarProva(modelo, { serie: opcoes.serie, componente: opcoes.componente, bimestre: opcoes.bimestre, ano: opcoes.ano });
        const c = obterCliente();
        const linha = await exigir(c.from('montador_provas').insert({
            titulo: local.titulo, componente: opcoes.componente, serie: local.serie, bimestre: local.bimestre, ano: local.ano,
            modelo_id: modelo.id, prazo: opcoes.prazo || null, dados: casco(local)
        }).select().single());
        const secoes = (opcoes.secoes || []).filter(function (s) { return s.titulo || s.responsavel; }).map(function (s, i) {
            return { id: uuid(), prova_id: linha.id, titulo: s.titulo || '', icone: 'auto', ordem: i, responsavel: s.responsavel || null };
        });
        if (secoes.length) await exigir(c.from('montador_secoes').insert(secoes));
        return linha.id;
    }

    async function apagarProva(id) {
        await exigir(obterCliente().from('montador_provas').delete().eq('id', id));
    }

    /* ----- imagens ----- */

    function extensao(src) {
        const tipo = (/^data:image\/(\w+)/.exec(src || '') || [])[1] || 'jpeg';
        return tipo === 'jpeg' ? 'jpg' : tipo;
    }

    function dataUrlParaBlob(url) {
        const partes = url.split(',');
        const tipo = (/data:([^;]+)/.exec(partes[0]) || [])[1] || 'image/png';
        const bin = atob(partes[1] || '');
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return new Blob([bytes], { type: tipo });
    }

    function blobParaDataUrl(blob) {
        return new Promise(function (ok, erro) {
            const leitor = new FileReader();
            leitor.onload = function () { ok(leitor.result); };
            leitor.onerror = function () { erro(leitor.error); };
            leitor.readAsDataURL(blob);
        });
    }

    function imagensDe(q) {
        return (q.imagens || []).concat((q.altImagens || []).filter(Boolean));
    }

    /* manda as imagens novas da questão para o storage (pasta = id da prova) */
    async function enviarImagens(provaId, q) {
        const c = obterCliente();
        for (const img of imagensDe(q)) {
            if (img.path || !img.src) continue;
            const caminho = provaId + '/' + (img.id || Modelos.novoId('img')) + '-' + Date.now().toString(36) + '.' + extensao(img.src);
            const blob = dataUrlParaBlob(img.src);
            const { error } = await c.storage.from(CONFIG.bucketImagens || 'montador-imagens').upload(caminho, blob, { contentType: blob.type, upsert: true });
            if (error) throw error;
            img.path = caminho;
        }
    }

    const cacheImagens = new Map();
    async function baixarImagem(caminho) {
        if (cacheImagens.has(caminho)) return cacheImagens.get(caminho);
        const guardada = global.MontarArmazem && await global.MontarArmazem.obterImagem(caminho).catch(function () { return null; });
        if (guardada) { cacheImagens.set(caminho, guardada); return guardada; }
        const { data, error } = await obterCliente().storage.from(CONFIG.bucketImagens || 'montador-imagens').download(caminho);
        if (error) throw error;
        const url = await blobParaDataUrl(data);
        cacheImagens.set(caminho, url);
        if (global.MontarArmazem) global.MontarArmazem.guardarImagem(caminho, url).catch(function () {});
        return url;
    }

    async function resolverImagens(prova) {
        const pendentes = [];
        prova.secoes.forEach(function (s) {
            s.questoes.forEach(function (q) {
                imagensDe(q).forEach(function (img) {
                    if (img.path && !img.src) {
                        pendentes.push(baixarImagem(img.path).then(function (url) { img.src = url; }).catch(function () { /* fica sem */ }));
                    }
                });
            });
        });
        await Promise.all(pendentes);
    }

    /* o que vai para o banco: a questão sem as imagens em data: (que moram no storage) */
    function dadosQuestao(q) {
        const copia = Modelos.copiar(q);
        imagensDe(copia).forEach(function (img) { if (img.path) delete img.src; });
        return copia;
    }

    function chaveQuestao(q, secaoId, ordem) {
        return JSON.stringify({ s: secaoId, o: ordem, d: dadosQuestao(q) });
    }

    function chaveSecao(s, ordem) {
        return JSON.stringify({ titulo: s.titulo || '', icone: s.icone || 'auto', ordem: ordem, responsavel: s.responsavel || null });
    }

    /* ----- carregar ----- */

    function montarLocal(linha, secoes, questoes, nomes) {
        const dados = linha.dados || {};
        const prova = Object.assign({}, dados, {
            id: 'nuvem:' + linha.id,
            titulo: linha.titulo,
            componente: linha.componente,
            serie: linha.serie,
            bimestre: linha.bimestre,
            ano: linha.ano,
            modeloId: dados.modeloId || linha.modelo_id,
            secoes: [],
            atualizadaEm: Date.parse(linha.atualizada_em) || Date.now()
        });
        const base = { casco: '', secoes: {}, questoes: {} };
        secoes.sort(function (a, b) { return a.ordem - b.ordem; }).forEach(function (s, i) {
            const qs = questoes.filter(function (q) { return q.secao_id === s.id; }).sort(function (a, b) { return a.ordem - b.ordem; });
            prova.secoes.push({
                id: s.id, titulo: s.titulo, icone: s.icone, responsavel: s.responsavel,
                questoes: qs.map(function (q) { return Modelos.normalizarQuestao(Object.assign({}, q.dados, { id: q.id })); })
            });
            base.secoes[s.id] = chaveSecao(s, i);
        });
        Modelos.normalizarProva(prova);
        prova.secoes.forEach(function (s) {
            s.questoes.forEach(function (q, i) { base.questoes[q.id] = chaveQuestao(q, s.id, i); });
        });
        base.casco = JSON.stringify(casco(prova));
        prova.nuvem = {
            id: linha.id,
            situacao: linha.situacao,
            prazo: linha.prazo,
            componente: linha.componente,
            criadaPor: linha.criada_por,
            secoes: {},
            nomes: nomes,
            base: base
        };
        secoes.forEach(function (s) {
            prova.nuvem.secoes[s.id] = { responsavel: s.responsavel, situacao: s.situacao, atualizadaEm: s.atualizada_em };
        });
        return prova;
    }

    async function buscar(id) {
        const c = obterCliente();
        const linha = await exigir(c.from('montador_provas').select('*').eq('id', id).maybeSingle());
        if (!linha) return null;
        const secoes = (await exigir(c.from('montador_secoes').select('*').eq('prova_id', id))) || [];
        const questoes = (await exigir(c.from('montador_questoes').select('*').eq('prova_id', id))) || [];
        const nomes = {};
        ((await exigir(c.from('montador_perfis').select('id, nome, papel, area'))) || []).forEach(function (p) { nomes[p.id] = p.nome; });
        return { linha: linha, secoes: secoes, questoes: questoes, nomes: nomes };
    }

    async function carregarProva(id) {
        const r = await buscar(id);
        if (!r) return null;
        const prova = montarLocal(r.linha, r.secoes, r.questoes, r.nomes);
        await resolverImagens(prova);
        return prova;
    }

    /* ----- permissões vistas pela tela (o banco confere de novo) ----- */

    function eu() { return perfilAtual || {}; }

    function podeFormatar(prova) {
        return !prova.nuvem || (prova.nuvem.situacao === 'aberta' && coordena(prova.nuvem.componente));
    }

    function podeEscrever(prova, secao) {
        if (!prova.nuvem) return true;
        if (prova.nuvem.situacao !== 'aberta') return false;
        if (coordena(prova.nuvem.componente)) return true;
        const meta = prova.nuvem.secoes[secao.id];
        /* seção nova, criada por mim e ainda não enviada: só o PCA cria seções */
        if (!meta) return false;
        return meta.responsavel === eu().id && meta.situacao !== 'aprovada';
    }

    /* ----- enviar ----- */

    function pendencias(prova) {
        const n = prova.nuvem;
        if (!n) return 0;
        let total = 0;
        if (podeFormatar(prova) && JSON.stringify(casco(prova)) !== n.base.casco) total++;
        prova.secoes.forEach(function (s, i) {
            if (coordena(n.componente) && chaveSecao(s, i) !== n.base.secoes[s.id]) total++;
            if (!podeEscrever(prova, s)) return;
            s.questoes.forEach(function (q, j) {
                if (chaveQuestao(q, s.id, j) !== n.base.questoes[q.id]) total++;
            });
        });
        /* sumiu daqui, de uma seção que eu escrevo: é apagamento pendente */
        const todas = new Set();
        prova.secoes.forEach(function (s) { s.questoes.forEach(function (q) { todas.add(q.id); }); });
        Object.keys(n.base.questoes).forEach(function (id) {
            if (todas.has(id)) return;
            const secao = prova.secoes.find(function (s) { return s.id === JSON.parse(n.base.questoes[id]).s; });
            if (secao && podeEscrever(prova, secao)) total++;
        });
        return total;
    }

    let enviando = null;

    /* Manda ao servidor tudo o que difere da base. Devolve { pendentes, erro }. */
    function sincronizar(prova) {
        if (enviando) return enviando.then(function () { return sincronizar(prova); });
        enviando = enviarAgora(prova).finally(function () { enviando = null; });
        return enviando;
    }

    async function enviarAgora(prova) {
        const n = prova.nuvem;
        const c = obterCliente();
        if (!n || !c) return { pendentes: 0 };
        const idProva = n.id;
        try {
            /* 1. casco (só o PCA e a gestão) */
            if (podeFormatar(prova)) {
                const atual = casco(prova);
                const chave = JSON.stringify(atual);
                if (chave !== n.base.casco) {
                    await exigir(c.from('montador_provas').update({
                        titulo: prova.titulo || '', serie: prova.serie || null, bimestre: prova.bimestre || null,
                        ano: prova.ano || null, dados: atual
                    }).eq('id', idProva));
                    n.base.casco = chave;
                }
            }

            /* 2. seções (só o PCA e a gestão) */
            if (coordena(n.componente) && n.situacao === 'aberta') {
                const locais = new Set();
                for (let i = 0; i < prova.secoes.length; i++) {
                    const s = prova.secoes[i];
                    locais.add(s.id);
                    const chave = chaveSecao(s, i);
                    if (chave === n.base.secoes[s.id]) continue;
                    const linha = { titulo: s.titulo || '', icone: s.icone || 'auto', ordem: i, responsavel: s.responsavel || null };
                    if (n.base.secoes[s.id] === undefined) {
                        await exigir(c.from('montador_secoes').insert(Object.assign({ id: s.id, prova_id: idProva }, linha)));
                        n.secoes[s.id] = { responsavel: linha.responsavel, situacao: 'rascunho' };
                    } else {
                        await exigir(c.from('montador_secoes').update(linha).eq('id', s.id));
                        if (n.secoes[s.id]) n.secoes[s.id].responsavel = linha.responsavel;
                    }
                    n.base.secoes[s.id] = chave;
                }
                for (const id of Object.keys(n.base.secoes)) {
                    if (locais.has(id)) continue;
                    await exigir(c.from('montador_secoes').delete().eq('id', id));
                    delete n.base.secoes[id];
                    delete n.secoes[id];
                    Object.keys(n.base.questoes).forEach(function (q) {
                        if (JSON.parse(n.base.questoes[q]).s === id) delete n.base.questoes[q];
                    });
                }
            }

            /* 3. questões das seções que eu escrevo */
            const presentes = new Set();
            for (const s of prova.secoes) {
                if (!podeEscrever(prova, s) || n.base.secoes[s.id] === undefined) continue;
                for (let j = 0; j < s.questoes.length; j++) {
                    const q = s.questoes[j];
                    presentes.add(q.id);
                    if (chaveQuestao(q, s.id, j) === n.base.questoes[q.id]) continue;
                    await enviarImagens(idProva, q);
                    await exigir(c.from('montador_questoes').upsert({
                        id: q.id, prova_id: idProva, secao_id: s.id, ordem: j, dados: dadosQuestao(q)
                    }));
                    n.base.questoes[q.id] = chaveQuestao(q, s.id, j);
                }
            }
            prova.secoes.forEach(function (s) { s.questoes.forEach(function (q) { presentes.add(q.id); }); });
            for (const id of Object.keys(n.base.questoes)) {
                if (presentes.has(id)) continue;
                const antes = JSON.parse(n.base.questoes[id]);
                const secao = prova.secoes.find(function (s) { return s.id === antes.s; });
                if (secao && !podeEscrever(prova, secao)) continue;
                await exigir(c.from('montador_questoes').delete().eq('id', id));
                delete n.base.questoes[id];
            }
            n.erro = null;
            n.offline = false;
            return { pendentes: pendencias(prova) };
        } catch (erro) {
            n.offline = semRede(erro);
            n.erro = n.offline ? null : mensagem(erro);
            return { pendentes: pendencias(prova), erro: n.erro, offline: n.offline };
        }
    }

    /* ----- receber as mudanças dos colegas ----- */

    /* Junta o que está no servidor com a prova aberta: o que a pessoa não mexeu
       desde a última sincronização é trocado pela versão do servidor; o que
       ela mexeu (e ainda não foi) fica como está. Devolve true se mudou algo. */
    async function atualizarDoServidor(prova) {
        const n = prova.nuvem;
        const r = await buscar(n.id);
        if (!r) return { apagada: true };
        const remoto = montarLocal(r.linha, r.secoes, r.questoes, r.nomes);
        let mudou = false;

        n.situacao = r.linha.situacao;
        n.prazo = r.linha.prazo;
        n.nomes = r.nomes;

        /* casco */
        if (JSON.stringify(casco(prova)) === n.base.casco && remoto.nuvem.base.casco !== n.base.casco) {
            CASCO.forEach(function (k) { if (remoto[k] !== undefined) prova[k] = remoto[k]; });
            n.base.casco = remoto.nuvem.base.casco;
            mudou = true;
        }

        /* seções: situação e responsável vêm sempre do servidor */
        const porId = {};
        prova.secoes.forEach(function (s) { porId[s.id] = s; });
        const novasSecoes = [];
        remoto.secoes.forEach(function (rs, i) {
            const meta = remoto.nuvem.secoes[rs.id];
            if (JSON.stringify(n.secoes[rs.id]) !== JSON.stringify(meta)) mudou = true;
            n.secoes[rs.id] = meta;
            let local = porId[rs.id];
            if (!local) {
                if (n.base.secoes[rs.id] !== undefined) return; /* apaguei aqui e ainda não foi */
                local = { id: rs.id, titulo: rs.titulo, icone: rs.icone, responsavel: rs.responsavel, questoes: [] };
                mudou = true;
            } else if (chaveSecao(local, prova.secoes.indexOf(local)) === n.base.secoes[rs.id]) {
                if (local.titulo !== rs.titulo || local.icone !== rs.icone || local.responsavel !== rs.responsavel) mudou = true;
                local.titulo = rs.titulo;
                local.icone = rs.icone;
                local.responsavel = rs.responsavel;
            }
            n.base.secoes[rs.id] = remoto.nuvem.base.secoes[rs.id];
            novasSecoes.push({ remota: rs, local: local, ordem: i });
        });
        /* seções que só existem aqui: novas (mantém) ou apagadas lá (some) */
        prova.secoes.forEach(function (s) {
            if (remoto.secoes.some(function (rs) { return rs.id === s.id; })) return;
            if (n.base.secoes[s.id] !== undefined) {
                /* existia no servidor e foi apagada lá */
                delete n.base.secoes[s.id];
                delete n.secoes[s.id];
                mudou = true;
                return;
            }
            novasSecoes.push({ remota: null, local: s, ordem: prova.secoes.indexOf(s) + 0.5 });
        });

        /* questões */
        const remotas = {};
        remoto.secoes.forEach(function (rs) { rs.questoes.forEach(function (q, j) { remotas[q.id] = { q: q, s: rs.id, o: j }; }); });
        const locais = {};
        prova.secoes.forEach(function (s) { s.questoes.forEach(function (q, j) { locais[q.id] = { q: q, s: s.id, o: j }; }); });
        const finais = {}; /* secaoId → [questões] */
        function por(secaoId) { return finais[secaoId] || (finais[secaoId] = []); }

        Object.keys(remotas).forEach(function (id) {
            const rr = remotas[id];
            const ll = locais[id];
            const chaveRemota = remoto.nuvem.base.questoes[id];
            if (ll) {
                const intocada = chaveQuestao(ll.q, ll.s, ll.o) === n.base.questoes[id];
                if (intocada) {
                    if (chaveRemota !== n.base.questoes[id]) mudou = true;
                    por(rr.s).push({ q: rr.q, o: rr.o });
                    n.base.questoes[id] = chaveRemota;
                } else {
                    por(ll.s).push({ q: ll.q, o: ll.o });
                }
            } else if (n.base.questoes[id] === undefined || n.base.questoes[id] !== chaveRemota) {
                /* nova lá (ou mudou lá depois que apaguei aqui): entra */
                por(rr.s).push({ q: rr.q, o: rr.o });
                n.base.questoes[id] = chaveRemota;
                mudou = true;
            }
            /* senão: apaguei aqui e ainda não foi — continua apagada */
        });
        Object.keys(locais).forEach(function (id) {
            if (remotas[id]) return;
            const ll = locais[id];
            if (n.base.questoes[id] !== undefined && chaveQuestao(ll.q, ll.s, ll.o) === n.base.questoes[id]) {
                delete n.base.questoes[id]; /* apagada lá */
                mudou = true;
                return;
            }
            por(ll.s).push({ q: ll.q, o: ll.o + 0.5 }); /* nova aqui, ainda não foi */
        });

        prova.secoes = novasSecoes.sort(function (a, b) { return a.ordem - b.ordem; }).map(function (item) {
            item.local.questoes = por(item.local.id).sort(function (a, b) { return a.o - b.o; }).map(function (x) { return x.q; });
            return item.local;
        });
        await resolverImagens(prova);
        return { mudou: mudou };
    }

    /* ----- tempo real ----- */

    function assinar(provaId, aoMudar) {
        const c = obterCliente();
        if (!c || !c.channel) return function () {};
        const canal = c.channel('montador-prova-' + provaId);
        ['montador_provas', 'montador_secoes', 'montador_questoes', 'montador_comentarios'].forEach(function (tabela) {
            canal.on('postgres_changes', {
                event: '*', schema: 'public', table: tabela,
                filter: tabela === 'montador_provas' ? 'id=eq.' + provaId : 'prova_id=eq.' + provaId
            }, function (mudanca) { aoMudar(tabela, mudanca); });
        });
        canal.subscribe();
        return function () { c.removeChannel(canal); };
    }

    /* ----- fluxo da seção ----- */

    async function marcarSecao(secaoId, pronta, nota) {
        return exigir(obterCliente().rpc('montador_marcar_secao', { p_secao: secaoId, p_pronta: !!pronta, p_nota: nota || null }));
    }

    async function decidirSecao(provaId, secaoId, situacao, texto) {
        const c = obterCliente();
        await exigir(c.from('montador_secoes').update({ situacao: situacao }).eq('id', secaoId));
        const tipo = situacao === 'devolvida' ? 'devolucao' : situacao === 'aprovada' ? 'aprovacao' : 'comentario';
        const padrao = situacao === 'aprovada' ? 'Seção aprovada.' : 'Seção devolvida para ajustes.';
        await exigir(c.from('montador_comentarios').insert({
            prova_id: provaId, secao_id: secaoId, texto: String(texto || '').trim() || padrao, tipo: tipo, autor: eu().id
        }));
    }

    async function comentar(provaId, secaoId, texto) {
        await exigir(obterCliente().from('montador_comentarios').insert({
            prova_id: provaId, secao_id: secaoId || null, texto: String(texto).trim(), tipo: 'comentario', autor: eu().id
        }));
    }

    async function comentarios(provaId) {
        return (await exigir(obterCliente().from('montador_comentarios').select('*').eq('prova_id', provaId).order('criado_em'))) || [];
    }

    async function travar(provaId, travada) {
        await exigir(obterCliente().from('montador_provas').update({ situacao: travada ? 'travada' : 'aberta' }).eq('id', provaId));
    }

    async function mudarPrazo(provaId, prazo) {
        await exigir(obterCliente().from('montador_provas').update({ prazo: prazo || null }).eq('id', provaId));
    }

    const api = {
        disponivel: disponivel,
        iniciar: iniciar,
        perfil: perfil,
        aoMudarSessao: aoMudarSessao,
        entrar: entrar,
        sair: sair,
        trocarSenha: trocarSenha,
        primeiroAcessoAberto: primeiroAcessoAberto,
        primeiroAcesso: primeiroAcesso,
        criarProfessor: criarProfessor,
        atualizarProfessor: atualizarProfessor,
        excluirProfessor: excluirProfessor,
        perfis: perfis,
        coordena: coordena,
        listarProvas: listarProvas,
        criarProva: criarProva,
        apagarProva: apagarProva,
        carregarProva: carregarProva,
        sincronizar: sincronizar,
        atualizarDoServidor: atualizarDoServidor,
        pendencias: pendencias,
        podeFormatar: podeFormatar,
        podeEscrever: podeEscrever,
        assinar: assinar,
        marcarSecao: marcarSecao,
        decidirSecao: decidirSecao,
        comentar: comentar,
        comentarios: comentarios,
        travar: travar,
        mudarPrazo: mudarPrazo,
        uuid: uuid,
        mensagem: mensagem,
        semRede: semRede
    };
    global.MontarNuvem = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
