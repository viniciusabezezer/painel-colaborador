/* Pacotes prontos para começar (a "biblioteca pública" do ProvaShow).
   Cada um é um pacote no mesmo formato do arquivo exportado pelo app:
   ao trazer, vira cópia na biblioteca do professor, que pode editar à vontade. */
(function (global) {
    'use strict';

    const op = (lista) => lista.map((texto) => ({ texto, imagem: '' }));
    const av = (enunciado, opcoes, certa) => ({ tipo: 'avaliada', enunciado, opcoes: op(opcoes), corretas: [].concat(certa), layout: 'centro', midia: null });
    const enq = (enunciado, opcoes) => ({ tipo: 'enquete', enunciado, opcoes: op(opcoes), corretas: [], layout: 'centro', midia: null });
    const pacote = (nome, descricao, area, conjuntos) => ({ tipo: 'provashow-pacote', versao: 2, area, pacote: { nome, descricao, imagem: '' }, conjuntos });

    const PACOTES = [
        pacote('Primeiros minutos da aula', 'Enquetes rápidas para abrir e fechar a aula: humor da turma, autoavaliação e saída.', 'Rotina', [
            {
                titulo: 'Entrada e saída', questoes: [
                    enq('Como você chegou hoje?', ['Animado(a)', 'Tranquilo(a)', 'Cansado(a)', 'Preocupado(a)']),
                    enq('O quanto você lembra da aula passada?', ['Tudo', 'Quase tudo', 'Um pouco', 'Nada']),
                    enq('Quanto você entendeu do conteúdo de hoje?', ['Consigo explicar para um colega', 'Entendi', 'Entendi em parte', 'Não entendi']),
                    enq('O que mais ajudaria você agora?', ['Mais exemplos', 'Exercícios', 'Explicação de novo', 'Tirar dúvida individual'])
                ]
            }
        ]),
        pacote('Matemática — frações e porcentagem', 'Revisão de 6º ao 9º ano, com equações escritas em LaTeX.', 'Matemática', [
            {
                titulo: 'Frações e porcentagem', embaralhar: true, questoes: [
                    av('Quanto é $\\frac{1}{2} + \\frac{1}{4}$?', ['$\\frac{2}{6}$', '$\\frac{3}{4}$', '$\\frac{1}{6}$', '$\\frac{2}{4}$'], 'B'),
                    av('25% de 80 é:', ['20', '25', '40', '8'], 'A'),
                    av('Qual fração é equivalente a $0{,}75$?', ['$\\frac{7}{5}$', '$\\frac{3}{4}$', '$\\frac{1}{75}$', '$\\frac{4}{3}$'], 'B'),
                    av('Um produto de R\\$ 50 teve 10% de desconto. Quanto ficou?', ['R\\$ 40', 'R\\$ 45', 'R\\$ 49', 'R\\$ 55'], 'B'),
                    av('Qual é o maior número?', ['$\\frac{2}{3}$', '$\\frac{3}{5}$', '$0{,}6$', '$\\frac{5}{8}$'], 'A')
                ]
            }
        ]),
        pacote('Língua Portuguesa — gramática essencial', 'Classes de palavras, acentuação e concordância.', 'Linguagens', [
            {
                titulo: 'Gramática essencial', questoes: [
                    av('Em "O menino **correu** depressa", a palavra destacada é:', ['Substantivo', 'Adjetivo', 'Verbo', 'Advérbio'], 'C'),
                    av('Qual palavra está acentuada corretamente?', ['Juíz', 'Saúde', 'Ítem', 'Heroíco'], 'B'),
                    av('Assinale a frase com concordância correta:', ['Fazem dois anos que mudei.', 'Houveram muitos problemas.', 'Faz dois anos que mudei.', 'Existe muitas dúvidas.'], 'C'),
                    av('"Mas" em "Estudei, mas não passei" indica:', ['Adição', 'Oposição', 'Conclusão', 'Explicação'], 'B'),
                    av('O plural de "cidadão" é:', ['Cidadões', 'Cidadães', 'Cidadãos', 'Cidadans'], 'C')
                ]
            }
        ]),
        pacote('Ciências da Natureza — ENEM', 'Questões curtas de biologia, química e física no estilo ENEM.', 'Ciências da Natureza', [
            {
                titulo: 'Ciências — revisão ENEM', questoes: [
                    av('A organela responsável pela respiração celular é:', ['Ribossomo', 'Mitocôndria', 'Lisossomo', 'Complexo golgiense'], 'B'),
                    av('A fórmula da água é H~2~O. Quantos átomos há em uma molécula?', ['1', '2', '3', '4'], 'C'),
                    av('A unidade de força no Sistema Internacional é:', ['Joule', 'Watt', 'Newton', 'Pascal'], 'C'),
                    av('O gás mais abundante na atmosfera terrestre é:', ['Oxigênio', 'Gás carbônico', 'Nitrogênio', 'Argônio'], 'C'),
                    av('A fotossíntese acontece principalmente:', ['Nas raízes', 'Nos cloroplastos', 'No núcleo', 'Nas mitocôndrias'], 'B')
                ]
            }
        ]),
        pacote('Geografia do Ceará e do Brasil', 'Regiões, biomas, clima e capitais.', 'Ciências Humanas', [
            {
                titulo: 'Geografia — Brasil e Ceará', questoes: [
                    av('O bioma predominante no Ceará é:', ['Cerrado', 'Caatinga', 'Pampa', 'Mata Atlântica'], 'B'),
                    av('A capital do Brasil é:', ['Rio de Janeiro', 'São Paulo', 'Brasília', 'Salvador'], 'C'),
                    av('O Ceará fica na região:', ['Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste'], 'B'),
                    av('O rio mais extenso que passa pelo Ceará é o:', ['Jaguaribe', 'São Francisco', 'Parnaíba', 'Amazonas'], 'A'),
                    av('O clima semiárido tem como característica:', ['Chuvas o ano todo', 'Chuvas irregulares e escassas', 'Neve no inverno', 'Muita umidade'], 'B')
                ]
            }
        ]),
        pacote('Verdadeiro ou falso — cultura geral', 'Aquecimento rápido para qualquer turma.', 'Rotina', [
            {
                titulo: 'Verdadeiro ou falso', questoes: [
                    av('O Sol é uma estrela.', ['Verdadeiro', 'Falso'], 'A'),
                    av('A Lua tem luz própria.', ['Verdadeiro', 'Falso'], 'B'),
                    av('O Brasil é o maior país da América do Sul.', ['Verdadeiro', 'Falso'], 'A'),
                    av('Os morcegos são aves.', ['Verdadeiro', 'Falso'], 'B'),
                    av('$2^{10}$ é maior que mil.', ['Verdadeiro', 'Falso'], 'A')
                ]
            }
        ])
    ];

    const Explorar = { PACOTES };
    if (typeof module === 'object' && module.exports) module.exports = Explorar;
    else global.Explorar = Explorar;
})(typeof self !== 'undefined' ? self : this);
