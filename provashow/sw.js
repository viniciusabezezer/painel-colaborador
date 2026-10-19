/* ProvaShow Malu sem internet. Na primeira visita com internet, o app
   inteiro (app do professor, scanner, telão, modo aluno, cartões e ajuda)
   fica guardado no aparelho; daí em diante abre sem conexão. Os dados já
   moram no IndexedDB, que não depende de rede.

   Responde do que está guardado (rápido) e, havendo internet, busca a
   versão nova por trás para a próxima abertura. Mudou um arquivo? Suba
   VERSAO para limpar os guardados antigos. */
const VERSAO = 'provashow-v3';
const ARQUIVOS = [
    './', './index.html', './estilo.css', './site.css', './manifest.webmanifest', './icone.svg', './icone-192.png', './icone-512.png', './logo.png', './escola.png',
    './app/', './app/index.html', './app/app.css',
    './app/js/nucleo.js', './app/js/biblioteca.js', './app/js/editor.js', './app/js/turmas.js', './app/js/aula.js', './app/js/relatorios.js', './app/js/ajustes.js', './app/js/conta.js',
    './js/cartao.js', './js/leitor.js', './js/camera.js', './js/texto.js', './js/midia.js', './js/slide.js', './js/dados.js', './js/armazem.js', './js/nuvem.js', './js/explorar.js', './js/config.js', './js/canal.js',
    './vendor/katex.min.js', './vendor/supabase.js', './vendor/qrcode.js',
    './scanner/', './scanner/index.html', './scanner/scanner.css', './scanner/scanner.js',
    './telao/', './telao/index.html', './telao/telao.css', './telao/telao.js',
    './aluno/', './aluno/index.html', './aluno/aluno.css', './aluno/aluno.js',
    './cartoes/', './cartoes/index.html', './cartoes/cartoes.css',
    './ajuda/', './ajuda/index.html'
];

self.addEventListener('install', (e) => {
    e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
    e.waitUntil(caches.keys()
        .then((nomes) => Promise.all(nomes.filter((n) => n.startsWith('provashow-') && n !== VERSAO).map((n) => caches.delete(n))))
        .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
    const url = new URL(e.request.url);
    if (e.request.method !== 'GET' || url.origin !== location.origin) return;
    e.respondWith(caches.open(VERSAO).then(async (cache) => {
        const chave = url.pathname.endsWith('/') ? url.pathname : e.request;
        const guardada = await cache.match(chave, { ignoreSearch: true });
        const nova = fetch(e.request).then((r) => {
            if (r.ok) cache.put(chave, r.clone());
            return r;
        }).catch(() => guardada);
        return guardada || nova;
    }));
});
