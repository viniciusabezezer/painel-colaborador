// Repassa a lista oficial e as sugestões de mudança ao Malu Presente.
//
// NÃO está publicada. Quando for publicar, no projeto MapaDeAulas:
//   supabase functions deploy presente-listas
// Os segredos são os mesmos do envio das notas: MALU_PRESENTE_URL e
// MALU_PRESENTE_TOKEN. Eles não voltam para o navegador.
//
// Quem pode chamar: gestão, PCA ou professor ativo. Os nomes dos alunos
// só atravessam esta função. Nada é gravado.
import { createClient } from 'npm:@supabase/supabase-js@2';
import './listas.js';

const Listas = (globalThis as { MaluListas: {
    podePedir: (perfil: unknown) => boolean;
    mensagemRecusa: (perfil: unknown) => string;
    buscar: (op: Record<string, unknown>) => Promise<{ status: number; body: unknown }>;
    sugerir: (op: Record<string, unknown>) => Promise<{ status: number; body: unknown }>;
} }).MaluListas;

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
        if (!Listas.podePedir(perfil)) return resposta({ erro: Listas.mensagemRecusa(perfil) }, perfil ? 403 : 401);

        const corpo = await req.json().catch(() => ({} as Record<string, unknown>));
        const env = {
            url: Deno.env.get('MALU_PRESENTE_URL') || '',
            token: Deno.env.get('MALU_PRESENTE_TOKEN') || ''
        };
        const acao = String(corpo.acao || '');
        if (acao === 'listas') {
            const envio = await Listas.buscar({
                perfil: perfil,
                ano: corpo.ano,
                turma: corpo.turma || '',
                env: env,
                fetch: fetch
            });
            return resposta(envio.body, envio.status);
        }
        if (acao === 'sugestoes') {
            const envio = await Listas.sugerir({
                perfil: perfil,
                ano: corpo.ano,
                grupos: corpo.grupos || [],
                env: env,
                fetch: fetch
            });
            return resposta(envio.body, envio.status);
        }
        return resposta({ erro: 'Ação desconhecida.' }, 400);
    } catch (erro) {
        console.error(erro instanceof Error ? erro.name : 'falha');
        return resposta({ erro: 'Não consegui falar com o Malu Presente.' }, 500);
    }
});
