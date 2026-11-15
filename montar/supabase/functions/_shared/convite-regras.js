/* Regras do convite por link, sem banco e sem e-mail.
   A Edge Function montador-convites e o servidor de mentira dos testes
   usam este arquivo, para os dois responderem a mesma coisa.
   O token em claro só vive no link; no banco fica o SHA-256 em hexadecimal. */

export const PRAZO_DIAS = 7;
const PRAZO_MS = PRAZO_DIAS * 24 * 60 * 60 * 1000;

export function expiraEm(desde = new Date()) {
    return new Date(desde.getTime() + PRAZO_MS).toISOString();
}

/* 32 bytes aleatórios em base64url: ~43 caracteres, sem +, / ou =. */
export function novoToken() {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function tokenNoFormato(token) {
    return /^[A-Za-z0-9_-]{43,128}$/.test(String(token || ''));
}

export async function hashToken(token) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(token)));
    return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function erroSenha(senha) {
    if (String(senha ?? '').length < 8) return 'A senha precisa ter pelo menos 8 caracteres.';
    return '';
}

/* Convite ausente e token desconhecido respondem igual, para não revelar
   se aquele hash existe. Revogado, usado, vencido e conta desativada
   explicam o caso — a pessoa está com o link na mão. */
export function avaliarConvite(convite, perfil, agora) {
    if (!convite || !perfil) return { ok: false, erro: 'Convite inválido.', status: 404 };
    if (convite.revogado_em) {
        return { ok: false, erro: 'Este convite foi substituído por um novo. Peça o link mais recente à gestão.', status: 410 };
    }
    if (convite.usado_em) {
        return { ok: false, erro: 'Este convite já foi usado. Entre com o seu e-mail e a senha, ou peça um novo à gestão.', status: 410 };
    }
    const expira = new Date(convite.expira_em).getTime();
    if (!Number.isFinite(expira) || expira <= agora.getTime()) {
        return { ok: false, erro: 'Este convite venceu. Peça um novo à gestão.', status: 410 };
    }
    if (!perfil.ativo) return { ok: false, erro: 'Esta conta está desativada. Fale com a gestão.', status: 403 };
    return { ok: true };
}
