// Envia as notas de uma prova fechada para o Malu Presente.
//
// NÃO está publicada. Quando for publicar, no projeto MapaDeAulas:
//   supabase functions deploy gabaritos-enviar-presente
// e crie os segredos MALU_PRESENTE_URL e MALU_PRESENTE_TOKEN
// (a URL é a origem do portal, sem caminho; o token não vai para o navegador).
//
// Quem chama precisa ser o PCA ativo da área da prova. Gestão e professor
// recebem recusa. O corpo que sai segue o contrato de
// POST /api/integracao/notas-bimestrais.
import { createClient } from 'npm:@supabase/supabase-js@2';
import './lote.js';

const Presente = (globalThis as { MaluPresente: {
    enviarLote: (op: Record<string, unknown>) => Promise<{ status: number; body: unknown }>;
    prepararEnvio: (bruto: Record<string, unknown>) => { prova: Record<string, unknown> };
    mensagemRecusa: (perfil: unknown, prova: unknown) => string;
} }).MaluPresente;

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

function resposta(corpo: unknown, status = 200) {
    return new Response(JSON.stringify(corpo), {
        status,
        headers: { ...CORS, 'Content-Type': 'application/json' }
    });
}

const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } }
);

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    if (req.method !== 'POST') return resposta({ erro: 'Use POST.' }, 405);
    try {
        const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
        if (!token) return resposta({ erro: 'Entre com a sua conta.' }, 401);
        const { data: usuario, error: erroUsuario } = await admin.auth.getUser(token);
        if (erroUsuario || !usuario.user) return resposta({ erro: 'Sessão expirada. Entre de novo.' }, 401);

        const { data: perfil } = await admin.from('montador_perfis')
            .select('id,nome,papel,area,ativo').eq('id', usuario.user.id).maybeSingle();
        if (!perfil) return resposta({ erro: 'Entre com a sua conta.' }, 401);

        const corpo = await req.json().catch(() => ({}));
        const provaId = String(corpo.prova_id || corpo.provaId || '');
        if (!provaId) return resposta({ erro: 'Informe a prova.' }, 400);

        const { data: prova } = await admin.from('montador_provas')
            .select('id,titulo,componente,serie,bimestre,ano,situacao,dados,criada_em,atualizada_em')
            .eq('id', provaId).maybeSingle();
        if (!prova) return resposta({ erro: 'Prova não encontrada.' }, 404);

        const secoes = await admin.from('montador_secoes').select('id,ordem').eq('prova_id', provaId);
        const questoes = await admin.from('montador_questoes').select('id,secao_id,ordem,dados').eq('prova_id', provaId);
        const leituras = await admin.from('corretor_leituras')
            .select('id,turma,lista,respostas,status_codigo,alertas').eq('prova_id', provaId);
        if (secoes.error || questoes.error || leituras.error) {
            return resposta({ erro: 'Não consegui ler as notas desta prova.' }, 500);
        }

        const dados = (prova.dados || {}) as { prazoNotas?: string };
        const preparado = Presente.prepararEnvio({
            prova: prova,
            secoes: secoes.data || [],
            questoes: questoes.data || [],
            leituras: leituras.data || [],
            prazoTabela: dados.prazoNotas || ''
        });

        const loteId = crypto.randomUUID();
        const envio = await Presente.enviarLote({
            perfil: perfil,
            prova: preparado.prova,
            leituras: (preparado as { leituras: unknown }).leituras,
            loteId: loteId,
            env: {
                url: Deno.env.get('MALU_PRESENTE_URL') || '',
                token: Deno.env.get('MALU_PRESENTE_TOKEN') || ''
            },
            fetch: fetch,
            gravar: async (registro: {
                lote_id: string;
                recebidas: number;
                sem_correspondencia: unknown;
                assinatura: string;
                ok: boolean;
                erro: string | null;
            }) => {
                const { error } = await admin.from('corretor_envios_presente').insert({
                    prova_id: provaId,
                    lote_id: registro.lote_id,
                    enviado_por: perfil.id,
                    enviado_por_nome: perfil.nome,
                    recebidas: registro.recebidas,
                    sem_correspondencia: registro.sem_correspondencia,
                    assinatura: registro.assinatura,
                    ok: registro.ok,
                    erro: registro.erro
                });
                if (error) {
                    const falta = /corretor_envios_presente|schema cache|does not exist/i.test(error.message || '');
                    throw new Error(falta
                        ? 'O histórico de envios ainda não existe. Aplique a migração 006 no MapaDeAulas.'
                        : 'Não consegui guardar o envio.');
                }
            }
        });
        return resposta(envio.body, envio.status);
    } catch (erro) {
        console.error(erro instanceof Error ? erro.message : 'falha');
        return resposta({ erro: 'Não consegui enviar as notas.' }, 500);
    }
});
