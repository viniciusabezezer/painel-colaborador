# Painel do Colaborador (Malu Serviços) + InstaPensa + Provas

Ferramentas da EEMTI Profª Maria Luíza Sabóia Ribeiro para professores e
coordenação. **HTML/CSS/JS puro, sem build, sem npm.** Site estático na Vercel
(projeto `instapensa`). Tudo em português.

Três apps no mesmo repo — trabalhe só na pasta da tarefa:

| App | Onde | Doc |
|---|---|---|
| **Malu Serviços** (painel de formulários, ocorrências, chat da Malu) | `index.html`, `style.css` na raiz | — |
| **InstaPensa** (feed fictício para aula, dados em IndexedDB) | `instapensa/` | `instapensa/README.md` |
| **Provas Identificadas** (cabeçalho + QR nas provas, tudo no navegador) | `provas/` | `provas/README.md` |

Os READMEs são longos: leia só a seção necessária (`Arquivos`, `Testes`, `Publicação`).

## Roteamento (`vercel.json`)

`/` redireciona para `/instapensa/`; o painel fica em `/index.html`. `/provas/`
também pode ser publicado como site próprio (Root Directory = `provas`, usa
`provas/vercel.json`). HTML e rotas de pasta têm `no-cache` — ao criar rota nova de
pasta, adicione o header lá também.

## Testes

```bash
node --test test/codigos.test.cjs          # numeração de ocorrências (apps-script-codigos.gs)
node --test provas/test/provas.test.cjs    # lógica das provas
node provas/test/provas-browser.mjs        # E2E com Playwright/Chromium
python3 -m http.server 8765                # servir e abrir /instapensa/ ou /provas/
```

`test/instapensa-browser.js` roda dentro do navegador (`agent-browser eval --stdin`).

## Backends e integrações

- Chat da Malu → Apps Script do repo **`malubot-backend`** (`SCRIPT_URL` no `index.html`).
- `apps-script-codigos.gs` (numeração única de ocorrências) e
  `apps-script-relatorio.gs` (relatório interno) são **implantados à mão** no Apps
  Script; editar aqui não publica. Arquivos `*.gs` ficam fora do deploy.
- Links de Google Forms estão fixos no `index.html`.
- `liberacao-professor.js` é um add-on **desligado**: só ativa com
  `<script src="liberacao-professor.js">` no `index.html`.

## Regras

- InstaPensa: **não renomear** o banco IndexedDB `feed-aula` nem o formato
  `feed-aula/v1` — quebraria aulas salvas e exportações antigas.
- Provas: nada sai do navegador; bibliotecas ficam em `provas/vendor/` (sem CDN).
  O app precisa funcionar tanto em `/provas/` quanto na raiz do domínio.
- Privacidade: dados de alunos nunca vão para servidor (só o código da ocorrência).
- Commits: frase em português no presente ("Gera …", "Adiciona …", "Corrige …").
