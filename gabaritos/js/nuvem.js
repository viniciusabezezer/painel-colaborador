/* Liga o Malu Gabaritos no mesmo Supabase do Montador. Se a migração 005 ainda
   não foi aplicada, as provas travadas continuam aparecendo e as leituras
   ficam só neste aparelho. */
(function (global) {
    'use strict';

    const CONFIG = global.MONTADOR_NUVEM || {};
    let cliente = null;

    function obter() {
        if (cliente) return cliente;
        if (global.supabase && CONFIG.url && CONFIG.chave) {
            cliente = global.supabase.createClient(CONFIG.url, CONFIG.chave, {
                auth: { persistSession: true, autoRefreshToken: true, storageKey: 'montador-provas-sessao' }
            });
        }
        return cliente;
    }

    async function sessao() {
        const c = obter();
        if (!c) return null;
        const { data } = await c.auth.getSession();
        return data && data.session;
    }

    async function entrar(email, senha) {
        const { error } = await obter().auth.signInWithPassword({ email: email.trim(), password: senha });
        if (error) throw new Error(error.message);
    }

    async function sair() {
        if (obter()) await obter().auth.signOut();
    }

    async function perfil() {
        const c = obter();
        const s = await sessao();
        if (!c || !s) return null;
        const { data, error } = await c.from('montador_perfis').select('id,nome,email,papel,area,disciplinas,ativo').eq('id', s.user.id).maybeSingle();
        if (error || !data || !data.ativo) return null;
        const partes = String(data.nome || '').trim().split(/\s+/);
        return Object.assign({}, data, { primeiro: partes[0] || data.nome });
    }

    function letraDe(q) {
        const d = q.dados || {};
        return d.correta || null;
    }

    async function provasTravadas() {
        const c = obter();
        const { data: provas, error } = await c.from('montador_provas')
            .select('id,titulo,componente,serie,bimestre,ano,situacao,dados,prazo')
            .eq('situacao', 'travada');
        if (error) throw new Error(error.message);
        const ids = (provas || []).map(function (p) { return p.id; });
        if (!ids.length) return [];
        const secoes = await c.from('montador_secoes').select('id,prova_id,ordem,titulo,responsavel').in('prova_id', ids);
        const questoes = await c.from('montador_questoes').select('id,prova_id,secao_id,ordem,dados').in('prova_id', ids);
        let copias = [];
        let leituras = [];
        const tabelaCopias = await c.from('corretor_copias').select('*').in('prova_id', ids);
        if (!tabelaCopias.error) copias = tabelaCopias.data || [];
        const tabelaLeituras = await c.from('corretor_leituras').select('*').in('prova_id', ids);
        if (!tabelaLeituras.error) leituras = tabelaLeituras.data || [];
        const prazos = await c.from('corretor_prazos').select('ano,bimestre,prazo');
        const mapaPrazo = {};
        if (!prazos.error) (prazos.data || []).forEach(function (p) { mapaPrazo[p.ano + '|' + p.bimestre] = p.prazo; });

        const nomes = { LIN: 'Linguagens', NAT: 'Ciências da Natureza', HUM: 'Ciências Humanas', MAT: 'Matemática', RED: 'Redação' };
        return (provas || []).map(function (linha) {
            const dados = linha.dados || {};
            const ss = (secoes.data || []).filter(function (s) { return s.prova_id === linha.id; }).sort(function (a, b) { return a.ordem - b.ordem; });
            const gabarito = {};
            let n = 0;
            ss.forEach(function (s) {
                (questoes.data || []).filter(function (q) { return q.secao_id === s.id; }).sort(function (a, b) { return a.ordem - b.ordem; }).forEach(function (q) {
                    const tipo = (q.dados && q.dados.tipo) || 'objetiva';
                    if (tipo === 'texto') return;
                    n++;
                    if (tipo !== 'discursiva' && letraDe(q)) gabarito[n] = letraDe(q);
                });
            });
            const doBanco = copias.filter(function (k) { return k.prova_id === linha.id; }).map(function (k) {
                return {
                    copiaId: k.copia_id, turma: k.turma, sala: k.sala, lista: k.lista,
                    codigo: k.codigo, seed: k.semente, letras: k.letras, contas: k.contas, professorId: k.professor_id
                };
            });
            const codigos = doBanco.length ? doBanco : (dados.codigos || []);
            const alunos = codigos.map(function (k) {
                return {
                    id: linha.id + ':' + k.copiaId,
                    nome: 'Lista ' + String(k.lista).padStart(2, '0'),
                    turma: k.turma, sala: k.sala, lista: k.lista, copiaId: k.copiaId, codigo: k.codigo
                };
            });
            return {
                id: linha.id,
                titulo: linha.titulo,
                componente: linha.componente,
                componenteNome: nomes[linha.componente] || linha.componente,
                /* a chave que o Montador põe no PDF e o Identificador no QR de cada aluno */
                chave: global.MaluIdentificar ? global.MaluIdentificar.chaveDaProva(linha.id) : '',
                serie: linha.serie,
                bimestre: linha.bimestre,
                ano: linha.ano,
                situacao: linha.situacao,
                codigoVerificacao: !!dados.codigoVerificacao,
                prazoNotas: dados.prazoNotas || mapaPrazo[linha.ano + '|' + linha.bimestre] || '',
                alternativas: (dados.ajustes && dados.ajustes.alternativas) || (dados.layout && dados.layout.alternativas) || 5,
                gabarito: gabarito,
                secoes: ss,
                codigos: codigos,
                alunos: alunos,
                remoto: true,
                semTabela: !!tabelaCopias.error
            };
        });
    }

    function leituraParaLinha(l) {
        return {
            id: l.id,
            prova_id: l.provaId,
            copia_id: l.copiaId,
            turma: l.turma || '',
            sala: l.sala || '',
            lista: l.lista,
            respostas: l.respostas || {},
            codigo_lido: l.codigoLido,
            status_codigo: l.statusCodigo,
            confianca: l.confianca,
            alertas: l.alertas || [],
            versao_chave: 1,
            imagem_path: l.imagemPath || null,
            imagem_expira_em: l.imagemExpira || null,
            nome_lista: l.nome || null
        };
    }

    function linhaParaLeitura(row) {
        return {
            id: row.id,
            provaId: row.prova_id,
            copiaId: row.copia_id,
            turma: row.turma,
            sala: row.sala,
            lista: row.lista,
            nome: row.nome_lista || ('Lista ' + String(row.lista || '').padStart(2, '0')),
            alunoId: row.prova_id + ':' + row.copia_id,
            respostas: row.respostas || {},
            codigoLido: row.codigo_lido,
            statusCodigo: row.status_codigo,
            alertas: row.alertas || [],
            revisar: (row.alertas || []).length > 0 || row.status_codigo === 'ambiguo',
            lidoEm: row.lido_em,
            imagemPath: row.imagem_path,
            imagemExpira: row.imagem_expira_em,
            confianca: row.confianca
        };
    }

    async function salvarLeitura(l) {
        const c = obter();
        if (!c) return { ok: false, local: true };
        const { error } = await c.from('corretor_leituras').upsert(leituraParaLinha(l));
        if (error) return { ok: false, local: true, motivo: error.message };
        return { ok: true };
    }

    async function salvarChave(ajuste) {
        const c = obter();
        if (!c) return { ok: false };
        const { error } = await c.from('corretor_chave_ajustes').insert({
            prova_id: ajuste.provaId, questao: ajuste.questao, de: ajuste.de, para: ajuste.para
        });
        return { ok: !error, motivo: error && error.message };
    }

    async function enviarFoto(provaId, leituraId, blob) {
        const c = obter();
        if (!c) return null;
        const caminho = provaId + '/' + leituraId + '.jpg';
        const { error } = await c.storage.from('corretor-cartoes').upload(caminho, blob, { contentType: 'image/jpeg', upsert: true });
        if (error) return null;
        return caminho;
    }

    async function apagarFoto(caminho) {
        const c = obter();
        if (!c || !caminho) return;
        await c.storage.from('corretor-cartoes').remove([caminho]);
    }

    function linhaParaEnvio(row) {
        return {
            id: row.id,
            provaId: row.prova_id,
            loteId: row.lote_id,
            enviadoPorNome: row.enviado_por_nome,
            enviadoEm: row.enviado_em,
            recebidas: row.recebidas,
            semCorrespondencia: row.sem_correspondencia || [],
            assinatura: row.assinatura || '',
            ok: row.ok,
            erro: row.erro
        };
    }

    async function enviosDasProvas(ids) {
        const c = obter();
        if (!c || !ids || !ids.length) return [];
        const { data, error } = await c.from('corretor_envios_presente')
            .select('id,prova_id,lote_id,enviado_por_nome,enviado_em,recebidas,sem_correspondencia,assinatura,ok,erro')
            .in('prova_id', ids)
            .order('enviado_em', { ascending: false });
        if (error) return [];
        return (data || []).map(linhaParaEnvio);
    }

    async function chamarPresente(corpo) {
        const c = obter();
        if (!c) throw new Error('Entre com a sua conta.');
        const { data, error } = await c.functions.invoke('presente-listas', { body: corpo });
        if (error) {
            let texto = '';
            try { texto = (await error.context.json()).erro; } catch (e) { /* a função explica no corpo */ }
            throw new Error(texto || error.message || 'Não consegui falar com o Malu Presente.');
        }
        if (data && data.erro) throw new Error(data.erro);
        return data;
    }

    async function enviarPresente(provaId) {
        const c = obter();
        if (!c) throw new Error('Entre com a sua conta.');
        const { data, error } = await c.functions.invoke('gabaritos-enviar-presente', { body: { prova_id: provaId } });
        if (error) {
            let texto = '';
            try { texto = (await error.context.json()).erro; } catch (e) { /* a função explica no corpo */ }
            throw new Error(texto || error.message || 'Não consegui enviar.');
        }
        if (data && data.erro) throw new Error(data.erro);
        return data;
    }

    async function limparFotosVencidas(leituras) {
        const agora = Date.now();
        const vencidas = (leituras || []).filter(function (l) {
            return l.imagemPath && l.imagemExpira && Date.parse(l.imagemExpira) < agora;
        });
        for (let i = 0; i < vencidas.length; i++) await apagarFoto(vencidas[i].imagemPath);
        return vencidas.length;
    }

    global.MaluNuvem = {
        obter: obter,
        sessao: sessao,
        entrar: entrar,
        sair: sair,
        perfil: perfil,
        provasTravadas: provasTravadas,
        linhaParaLeitura: linhaParaLeitura,
        salvarLeitura: salvarLeitura,
        salvarChave: salvarChave,
        enviarFoto: enviarFoto,
        apagarFoto: apagarFoto,
        limparFotosVencidas: limparFotosVencidas,
        enviosDasProvas: enviosDasProvas,
        enviarPresente: enviarPresente,
        chamarPresente: chamarPresente
    };
})(typeof globalThis !== 'undefined' ? globalThis : this);
