/* Banco de questões das batalhas. As de exemplo vêm daqui (não se apagam);
   as da escola são cadastradas na aba Cadastro e moram nos eventos.
   As habilidades sugeridas seguem descritores da matriz de referência do
   SAEB/SPAECE usados no Ensino Médio — a lista é só ponto de partida: o
   campo é livre e cada PCA escreve a habilidade que quiser. */
(function (global) {
    'use strict';

    const HABILIDADES = [
        'LP D1 — Localizar informações explícitas em um texto',
        'LP D3 — Inferir o sentido de uma palavra ou expressão',
        'LP D4 — Inferir uma informação implícita em um texto',
        'LP D6 — Identificar o tema de um texto',
        'LP D14 — Distinguir um fato da opinião relativa a esse fato',
        'MT D34 — Resolver problema com informações apresentadas em tabelas e/ou gráficos',
        'MT — Porcentagem e desconto',
        'MT — Proporcionalidade',
        'MT — Média aritmética',
        'ENEM — Ciências da Natureza',
        'ENEM — Ciências Humanas'
    ];

    const EXEMPLOS = [
        { id: 'ex-1', area: 'Matemática', habilidade: 'MT — Porcentagem e desconto',
            enunciado: 'Uma camisa custa R$ 80,00 e está com 25% de desconto. Quanto ela passa a custar?',
            alternativas: ['R$ 55,00', 'R$ 60,00', 'R$ 65,00', 'R$ 70,00', 'R$ 75,00'], correta: 1 },
        { id: 'ex-2', area: 'Matemática', habilidade: 'MT — Proporcionalidade',
            enunciado: 'Uma jangada percorre 12 km em 2 horas, sempre na mesma velocidade. Quantos quilômetros ela percorre em 5 horas?',
            alternativas: ['24 km', '27 km', '30 km', '36 km', '60 km'], correta: 2 },
        { id: 'ex-3', area: 'Matemática', habilidade: 'MT — Média aritmética',
            enunciado: 'As notas de uma estudante nas três avaliações foram 6, 8 e 7. Qual é a média dessas notas?',
            alternativas: ['6', '6,5', '7', '7,5', '8'], correta: 2 },
        { id: 'ex-4', area: 'Matemática', habilidade: 'MT D34 — Resolver problema com informações apresentadas em tabelas e/ou gráficos',
            enunciado: 'Numa tabela de temperaturas do litoral, às 6h marcava 24 °C e às 14h marcava 31 °C. Quantos graus a temperatura subiu nesse intervalo?',
            alternativas: ['5 °C', '6 °C', '7 °C', '8 °C', '55 °C'], correta: 2 },
        { id: 'ex-5', area: 'Linguagens e Códigos', habilidade: 'LP D14 — Distinguir um fato da opinião relativa a esse fato',
            enunciado: 'Qual destas frases expressa uma OPINIÃO?',
            alternativas: ['O Ceará fica na Região Nordeste.', 'As aulas começam às 7 horas.', 'A praia mais bonita do Ceará é a do nosso município.', 'A escola tem oito turmas.', 'Fortaleza é a capital do Ceará.'], correta: 2 },
        { id: 'ex-6', area: 'Linguagens e Códigos', habilidade: 'LP D3 — Inferir o sentido de uma palavra ou expressão',
            enunciado: '"Choveu tanto no inverno que o açude sangrou." No falar do Ceará, "o açude sangrou" quer dizer que o açude:',
            alternativas: ['secou', 'transbordou', 'rachou', 'foi esvaziado', 'ficou sujo'], correta: 1 },
        { id: 'ex-7', area: 'Linguagens e Códigos', habilidade: 'LP D1 — Localizar informações explícitas em um texto',
            enunciado: 'Leia: "A jangada saiu às 5h da Pedra Rachada e voltou às 13h, trazendo 30 kg de peixe." A que horas a jangada voltou?',
            alternativas: ['5h', '8h', '13h', '15h', '30h'], correta: 2 },
        { id: 'ex-8', area: 'Ciências da Natureza', habilidade: 'ENEM — Ciências da Natureza',
            enunciado: 'Ao nível do mar, a água ferve a 100 °C e vira vapor. Essa mudança do estado líquido para o gasoso se chama:',
            alternativas: ['fusão', 'solidificação', 'vaporização', 'condensação', 'sublimação'], correta: 2 },
        { id: 'ex-9', area: 'Ciências Humanas', habilidade: 'ENEM — Ciências Humanas',
            enunciado: 'O Ceará aboliu a escravidão em 1884, quatro anos antes da Lei Áurea. Por esse pioneirismo, o estado ficou conhecido como:',
            alternativas: ['Terra da Luz', 'Terra do Sol', 'Terra da Garoa', 'Terra das Palmeiras', 'Terra dos Bandeirantes'], correta: 0 }
    ];

    const LETRAS = ['A', 'B', 'C', 'D', 'E'];

    /* Cadastro rápido: o professor cola
         enunciado (uma ou mais linhas)
         A) ...  B) ...  (uma alternativa por linha, até E)
         Resposta: C
       e pode colar várias, separadas por uma linha em branco. */
    function lerColadas(texto) {
        const blocos = String(texto || '').replace(/\r/g, '').split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
        const questoes = [];
        const erros = [];
        blocos.forEach((bloco, i) => {
            const enunciado = [];
            const alternativas = [];
            let correta = -1;
            for (const linha of bloco.split('\n').map((l) => l.trim()).filter(Boolean)) {
                const alt = linha.match(/^([A-Ea-e])\s*[)\].:-]\s*(.+)$/);
                const resp = linha.match(/^(?:resposta|gabarito|correta)\s*[:=-]?\s*([A-Ea-e])\b/i);
                if (resp) correta = LETRAS.indexOf(resp[1].toUpperCase());
                else if (alt && alternativas.length === LETRAS.indexOf(alt[1].toUpperCase())) alternativas.push(alt[2].trim());
                else if (!alternativas.length) enunciado.push(linha);
                else alternativas[alternativas.length - 1] += ` ${linha}`;
            }
            if (!enunciado.length) erros.push(`Questão ${i + 1}: falta o enunciado.`);
            else if (alternativas.length < 2) erros.push(`Questão ${i + 1}: precisa de ao menos duas alternativas (A, B...).`);
            else if (correta < 0 || correta >= alternativas.length) erros.push(`Questão ${i + 1}: falta a linha "Resposta: letra".`);
            else questoes.push({ enunciado: enunciado.join(' '), alternativas, correta });
        });
        return { questoes, erros };
    }

    const api = { HABILIDADES, EXEMPLOS, LETRAS, lerColadas };
    global.JangadaQuestoes = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
