/* Funcionamento sem internet. Na primeira visita com internet, o app inteiro
   (página, estilos, scripts, brasão) fica guardado no aparelho; daí em diante
   abre e monta provas sem conexão. As provas e os arquivos gerados já moram
   no IndexedDB, que não depende de rede.

   Estratégia: responde do que está guardado (rápido e sem rede) e, quando há
   internet, busca a versão nova por trás e guarda para a próxima abertura.
   Mudou um arquivo do app? Suba VERSAO para limpar os guardados antigos. */
const VERSAO = 'montador-v6';
const ARQUIVOS = [
    './',
    './index.html',
    './app.css',
    './folha.css',
    './logo.png',
    './manifest.webmanifest',
    './js/texto.js',
    './js/modelos.js',
    './js/icones.js',
    './js/gabarito.js',
    './js/importar.js',
    './js/colar.js',
    './js/paginar.js',
    './js/armazem.js',
    './js/app.js'
];

self.addEventListener('install', (evento) => {
    evento.waitUntil(caches.open(VERSAO).then((cache) => cache.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (evento) => {
    evento.waitUntil(
        caches.keys()
            .then((nomes) => Promise.all(nomes.filter((n) => n !== VERSAO).map((n) => caches.delete(n))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (evento) => {
    const pedido = evento.request;
    if (pedido.method !== 'GET') return;
    const url = new URL(pedido.url);
    const daqui = url.origin === self.location.origin;
    /* a fonte da interface (Outfit) também fica guardada, quando vier */
    const fonte = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
    if (!daqui && !fonte) return;

    evento.respondWith(caches.open(VERSAO).then((cache) =>
        cache.match(pedido, { ignoreSearch: daqui }).then((guardado) => {
            const daRede = fetch(pedido).then((resposta) => {
                if (resposta && (resposta.ok || resposta.type === 'opaque')) cache.put(pedido, resposta.clone());
                return resposta;
            }).catch(() => {
                if (guardado) return guardado;
                if (pedido.mode === 'navigate') return cache.match('./index.html');
                /* sem rede e sem cópia da fonte da interface: segue com a do sistema */
                if (fonte) return new Response('', { headers: { 'Content-Type': 'text/css' } });
                return Response.error();
            });
            return guardado || daRede;
        })
    ));
});
