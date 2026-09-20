# Como capturar os prints

O InstaPensa vive de prints: o professor sobe de 8 a 10 capturas de publicações
reais e a turma lê aquilo projetado. A qualidade da aula depende da qualidade
da captura — e o que está dentro da imagem vai para a parede da sala, do jeito
que estiver.

Este guia usa o [Shottr](https://shottr.cc/) (gratuito), que tem as três coisas
de que esta ferramenta precisa: **captura com rolagem**, **marcação com
borrão** e **OCR**. Qualquer outro capturador serve, desde que faça o mesmo.

## 1. Apague a identificação antes de salvar

Uma publicação real traz nome de perfil, foto, @ e nomes de quem comentou — de
pessoas que não autorizaram nada e que a turma pode conhecer. A aula é sobre o
conteúdo, não sobre quem postou.

Na marcação do Shottr, use a ferramenta de borrão/pixelização sobre nome, @,
foto de perfil e nomes nos comentários **antes de salvar o arquivo**. O borrão
é aplicado na imagem: o arquivo que sai já não tem o dado.

Isso precisa acontecer na captura, não depois. Uma vez que o print entra no
InstaPensa, ele é guardado no IndexedDB e viaja embutido no `.json` de
exportação — quando o feed for passado para outro professor, o que estiver na
imagem vai junto.

Quando o objetivo da aula for justamente discutir uma conta pública conhecida
(campanha, órgão, veículo de imprensa), aí não há o que borrar. A regra vale
para pessoa comum.

## 2. Poste inteiro: carrossel, não uma captura gigante

A tentação é usar a captura com rolagem para pegar o post inteiro — legenda,
todos os comentários — numa imagem só. Não faça isso aqui.

`js/media.js` reduz toda imagem para **no máximo 1600px no maior lado**. Uma
captura rolada de 1200 × 4000 vira 480 × 1600: na projeção, ninguém lê. Duas ou
três capturas normais do mesmo post viram um **carrossel** (o editor aceita
vários arquivos por post) e cada uma chega legível.

Use a captura com rolagem quando a thread longa *for* o assunto e você quiser
mostrar o volume dela — aí a ilegibilidade é o ponto.

## 3. Tamanho: mire em 1600px e menos de 900KB

O tratamento de imagem tem um atalho que vale conhecer:

- Se o print couber em **1600px** no maior lado **e** pesar **menos de 900KB**,
  ele é guardado **como veio** — um PNG continua PNG, sem perda. Texto pequeno
  fica nítido.
- Fora disso, é redesenhado e salvo como **JPEG com qualidade 0.85**. Texto
  pequeno ganha aquela sujeira em volta das letras.

Num Mac Retina a captura sai com o dobro de pixels da área selecionada, então é
fácil estourar os 1600px sem perceber. O Shottr mostra as dimensões ao salvar:
se passar muito, reduza a escala na exportação. GIF e SVG passam intactos em
qualquer tamanho.

## 4. Use o OCR em vez de redigitar a legenda

A reflexão de cada post pede título, texto de apoio, perguntas e links — e boa
parte disso costuma sair da própria legenda ou de um comentário.

O OCR do Shottr extrai o texto da imagem capturada e joga na área de
transferência. Cole no campo de reflexão e edite. Serve também para links que
aparecem escritos no print e que você teria de copiar letra por letra.

Vale lembrar que o OCR roda na sua máquina: o texto não passa por serviço
nenhum.

## 5. Preparou em casa, apresenta na escola

O feed fica no navegador da máquina onde foi montado. Para levar, use
**Exportar** — o `.json` sai com as mídias embutidas — e **Importar arquivo** na
outra máquina. Detalhes no [README](README.md).

## Resumo

| Antes de salvar o print | Por quê |
|---|---|
| Borrar nome, @, foto e nomes nos comentários | vai ser projetado e viaja no `.json` exportado |
| Preferir 2–3 capturas em carrossel a uma rolada | acima de 1600px o texto some na projeção |
| Conferir se ficou ≤1600px e <900KB | abaixo disso o arquivo é preservado sem recompressão |
| Passar o OCR na legenda | a reflexão já nasce escrita |
