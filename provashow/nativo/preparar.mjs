/* Copia o ProvaShow (a pasta de cima) para www/, que é o que vai dentro do
   app nativo. O app abre direto no app do professor; o site continua lá
   como site.html. Rode de novo sempre que o ProvaShow mudar. */
import { cp, rm, writeFile, rename, readdir, mkdir } from 'node:fs/promises';
import { join, resolve, basename } from 'node:path';

const AQUI = resolve(import.meta.dirname);
const ORIGEM = resolve(AQUI, '..');
const DESTINO = join(AQUI, 'www');
const FORA = new Set(['nativo', 'test', 'vercel.json', 'README.md', 'node_modules']);

await rm(DESTINO, { recursive: true, force: true });
await mkdir(DESTINO);
/* item a item (www/ fica dentro da pasta copiada) */
for (const nome of await readdir(ORIGEM)) {
    if (FORA.has(nome) || nome.startsWith('.')) continue;
    await cp(join(ORIGEM, nome), join(DESTINO, nome), { recursive: true, filter: (o) => !basename(o).startsWith('.') });
}
await rename(join(DESTINO, 'index.html'), join(DESTINO, 'site.html'));
await writeFile(join(DESTINO, 'index.html'), `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta http-equiv="refresh" content="0; url=app/"><title>ProvaShow Malu</title></head><body><a href="app/">Abrir o ProvaShow</a></body></html>\n`);
console.log('www/ pronto:', DESTINO);
