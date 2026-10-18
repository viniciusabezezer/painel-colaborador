# ProvaShow Malu — app nativo (Android e iOS)

O ProvaShow já funciona **inteiro como webapp no celular** (abra
`provashow/app/` e, se quiser, "Adicionar à tela inicial"). Esta pasta é a
**segunda possibilidade**: o mesmo app embalado como aplicativo nativo pelo
[Capacitor](https://capacitorjs.com/), para distribuir pela Play Store, pela
App Store ou pelo gerenciador de aparelhos da escola.

Por dentro é exatamente o mesmo código (`provashow/`): biblioteca, turmas,
aula ao vivo com a câmera lendo os cartões, telão pelo código da aula,
relatórios. O app abre direto no app do professor.

## O que já está pronto

| Arquivo | O que faz |
| --- | --- |
| `package.json` | Capacitor 7 (core, cli, android, ios) e os comandos abaixo |
| `capacitor.config.json` | nome, identificador (`br.ce.eemti.provashow`) e esquema `https` (a câmera exige endereço seguro) |
| `preparar.mjs` | copia `provashow/` para `www/` (o que vai dentro do app) |
| `permissoes.mjs` | põe as permissões de câmera e microfone no Android e os textos de permissão no iOS |
| `../../.github/workflows/provashow-android.yml` | compila o APK no GitHub a cada mudança em `provashow/` |

## APK sem instalar nada

No GitHub: **Actions → ProvaShow Android → Run workflow**. No fim, baixe
`provashow-malu-apk` em *Artifacts* e instale no Android (é preciso permitir
"instalar apps de fontes desconhecidas"). É um APK de teste (debug); para a Play
Store, gere um AAB assinado (abaixo).

## Na sua máquina

Precisa de Node 22 e, para Android, do Android Studio (com JDK 21); para iOS,
de um Mac com Xcode.

```bash
cd provashow/nativo
npm install
npm run android        # gera/atualiza android/ com o ProvaShow e as permissões
npx cap open android   # abre no Android Studio: Run, ou Build → Generate Signed Bundle
npm run ios            # (Mac) gera/atualiza ios/
npx cap open ios       # abre no Xcode
```

Sempre que o ProvaShow mudar, rode `npm run android` (ou `ios`) de novo para
copiar a versão nova para dentro do app.

## Webapp ou nativo?

| | Webapp (PWA) | Nativo (Capacitor) |
| --- | --- | --- |
| Instalar | link + "Adicionar à tela inicial" | APK, Play Store, App Store ou MDM |
| Atualizar | sozinho, ao abrir com internet | nova versão do app |
| Câmera, telão, relatórios | sim | sim |
| Sem internet | sim, depois da 1ª abertura | sim, desde a instalação |
| Custo | nenhum | conta de desenvolvedor das lojas (Google: única; Apple: anual) |

Para uma escola, o webapp costuma bastar: é o mesmo app, sem loja e sempre
atualizado. O nativo vale quando a escola distribui apps por MDM ou quer o
ProvaShow na loja.
