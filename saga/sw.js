/* Funcionamento sem internet, como no Montador de Provas: na primeira
   visita com internet o app inteiro fica guardado no aparelho; daí em
   diante abre sem conexão. Os dados do jogo moram no localStorage, que não
   depende de rede. Mudou um arquivo do app? Suba VERSAO. */
const VERSAO = 'saga-v1';
const ARQUIVOS = [
    './',
    './index.html',
    './app.css?v=2',
    './logo.png',
    './manifest.webmanifest',
    './js/regras.js',
    './js/escola.js',
    './js/motor.js',
    './js/conselheiro.js',
    './js/questoes.js',
    './js/armazem.js',
    './js/demo.js',
    './js/app.js'
];

self.addEventListener('install', (e) => {
    e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
    e.waitUntil(caches.keys()
        .then((chaves) => Promise.all(chaves.filter((k) => k !== VERSAO).map((k) => caches.delete(k))))
        .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
    if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
    e.respondWith(caches.open(VERSAO).then((cache) => cache.match(e.request).then((guardado) => {
        const daRede = fetch(e.request).then((resposta) => {
            if (resposta && resposta.ok) cache.put(e.request, resposta.clone());
            return resposta;
        }).catch(() => guardado);
        return guardado || daRede;
    })));
});
