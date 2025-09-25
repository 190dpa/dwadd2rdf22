const express = require('express');
const http = require('http');
const fetch = require('node-fetch'); // Adicionado para fazer requisições a APIs externas
const { Server } = require("socket.io");
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const crypto = require('crypto'); // Módulo nativo do Node.js para gerar IDs
const { Pool } = require('pg'); // Driver do PostgreSQL

const app = express();
app.set('trust proxy', 1); // Confia no primeiro proxy (essencial para o Render obter o IP real)
app.use(cors());
app.use(express.json());

// Middleware para adicionar créditos em todas as respostas
app.use((req, res, next) => {
    try {
        const credits = Buffer.from('Q1JJQURPIFBPUiBEMExMWSBbUkdCXSBmcm9udGVuZCBlIG8gYmFja2VuZCBmZWl0byB0YW1iZW0gcG9yIGQwbGx5IFtzZXJ2aWRvciB1dGlsaXphZG8gcmVuZGVyXQ==', 'base64').toString('utf-8');
        res.setHeader('X-Created-By', credits);
    } catch (e) {
        // ignora em caso de erro
    }
    next();
});

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Em produção, restrinja para o seu domínio
        methods: ["GET", "POST"]
    },
    // Aumenta o tempo de espera pela resposta do cliente (pong) para 20s.
    // Isso torna a conexão mais tolerante a redes lentas, evitando desconexões por "ping timeout".
    pingTimeout: 20000
});

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-for-dev-only-change-in-production';
const PORT = process.env.PORT || 3000;

// --- Conexão com o Banco de Dados PostgreSQL ---
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false // Necessário para conexões com o Render
    }
});

pool.on('connect', () => {
    console.log('Conectado com sucesso ao banco de dados PostgreSQL!');
});
pool.on('error', (err) => {
    console.error('Erro inesperado no cliente do banco de dados', err);
});

// Alerta de Segurança para o Ambiente de Produção
if (process.env.NODE_ENV === 'production' && JWT_SECRET === 'fallback-secret-for-dev-only-change-in-production') {
    console.error('\n\n\x1b[31m%s\x1b[0m\n\n', '**************************************************************************************');
    console.error('\x1b[31m%s\x1b[0m', 'ATENÇÃO: A APLICAÇÃO ESTÁ USANDO UMA JWT_SECRET PADRÃO E INSEGURA EM PRODUÇÃO!');
    console.error('\x1b[33m%s\x1b[0m', 'Configure a variável de ambiente "JWT_SECRET" no seu serviço do Render com um valor seguro.');
    console.error('\x1b[31m%s\x1b[0m\n', '**************************************************************************************');
}

// --- Sistema de Log em Memória ---
const MAX_LOG_ENTRIES = 150;
const logBuffer = [];

// Guarda as funções originais do console antes de sobrescrevê-las
const originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    info: console.info,
};

function captureLog(level, ...args) {
    const timestamp = new Date().toISOString();
    const message = args.map(arg => (typeof arg === 'object' ? JSON.stringify(arg) : arg)).join(' ');

    // Mantém o log no console do Render
    originalConsole[level](`[${timestamp}] [${level.toUpperCase()}]`, ...args);

    // Adiciona ao buffer em memória
    logBuffer.push(`[${timestamp}] [${level.toUpperCase()}] ${message}`);
    if (logBuffer.length > MAX_LOG_ENTRIES) logBuffer.shift();
}

// Sobrescreve os métodos do console para capturar os logs
console.log = (...args) => captureLog('log', ...args);
console.error = (...args) => captureLog('error', ...args);
console.warn = (...args) => captureLog('warn', ...args);
console.info = (...args) => captureLog('info', ...args);


// --- Servir os arquivos estáticos (Front-end) ---
// Esta linha diz ao Express para servir os arquivos estáticos (HTML, CSS, JS)
// da pasta raiz do projeto. `__dirname` garante que o caminho esteja sempre correto.
// É IMPORTANTE que isso venha ANTES das rotas da API.
app.use(express.static(path.join(__dirname)));

// Mapa para guardar a relação entre username e socketId
// Map<username, { socketId: string, ip: string }>
const connectedUsers = new Map();

// --- Gerenciamento de IPs Banidos ---
const bannedIPs = new Set();

// --- Filtro de Censura ---
const badWords = ['palavrão', 'inapropriado', 'ofensa']; // Adicione as palavras que deseja censurar

function censorMessage(message) {
    let censoredText = message;
    badWords.forEach(word => {
        const regex = new RegExp(`\\b${word}\\b`, 'gi'); // 'gi' para global e case-insensitive
        censoredText = censoredText.replace(regex, '*'.repeat(word.length));
    });
    return censoredText;
}

// --- Lógica do RPG ---
function getDefaultRpgStats() {
    return {
        level: 1, xp: 0, xpToNextLevel: 100, coins: 10,
        stats: { strength: 1, dexterity: 1, intelligence: 1, defense: 1 },
        godMode: false,
        dailyQuest: null,
        lastQuestDate: null,
        guildId: null,
        characters: [],
        inventory: [],
        equippedWeapon: null,
        luckMultiplier: 1, // Multiplicador de sorte, 1 = normal
        luckUses: 0,       // Quantas vezes o buff pode ser usado
    };
}

// --- Dados da Loja RPG ---
const shopItems = [
    { id: 'strength_potion_1', name: 'Poção de Força', price: 25, type: 'permanent', bonus: { stat: 'strength', value: 1 }, description: '+1 de Força permanente.' },
    { id: 'dexterity_potion_1', name: 'Poção de Destreza', price: 25, type: 'permanent', bonus: { stat: 'dexterity', value: 1 }, description: '+1 de Destreza permanente.' },
    { id: 'intelligence_potion_1', name: 'Poção de Inteligência', price: 25, type: 'permanent', bonus: { stat: 'intelligence', value: 1 }, description: '+1 de Inteligência permanente.' },
    { id: 'xp_boost_1', name: 'Pergaminho de XP', price: 50, type: 'permanent', bonus: { stat: 'xp', value: 50 }, description: '+50 de XP instantâneo.' },
    { id: 'health_potion_1', name: 'Poção de Vida Pequena', price: 30, type: 'consumable', effect: { type: 'heal', value: 50 }, description: 'Restaura 50 de HP. Usável em batalha.' },
];

// --- Dados dos Personagens RPG ---
const RPG_CHARACTERS = {
    common: [
        { id: 'garenho', name: 'Garenho, o Lenhador', rarity: 'common', stats: { strength: 6, dexterity: 3, intelligence: 2, defense: 4 }, ability: 'Golpe de Machado: causa dano físico simples em um inimigo.', abilityId: null },
        { id: 'lyra', name: 'Lyra da Aldeia', rarity: 'common', stats: { strength: 3, dexterity: 5, intelligence: 4, defense: 2 }, ability: 'Tiro Rápido: dispara duas flechas rápidas seguidas.', abilityId: 'tiro_rapido' },
        { id: 'bruk', name: 'Bruk, o Ferreiro', rarity: 'common', stats: { strength: 7, dexterity: 2, intelligence: 3, defense: 5 }, ability: 'Escudo Improvisado: cria um escudo que reduz o próximo dano.', abilityId: 'escudo_improvisado' },
        { id: 'nira', name: 'Nira, a Caçadora', rarity: 'common', stats: { strength: 4, dexterity: 6, intelligence: 3, defense: 3 }, ability: 'Armadilha Simples: prende o inimigo por 1 turno.', abilityId: 'armadilha_simples' },
    ],
    uncommon: [
        { id: 'taron', name: 'Taron, o Guardião da Ponte', rarity: 'uncommon', stats: { strength: 8, dexterity: 5, intelligence: 3, defense: 7 }, ability: 'Postura de Defesa: aumenta a defesa de todo o grupo por 2 turnos.', abilityId: 'postura_de_defesa' },
        { id: 'elina', name: 'Elina Sombralua', rarity: 'uncommon', stats: { strength: 4, dexterity: 7, intelligence: 6, defense: 4 }, ability: 'Adaga Envenenada: causa dano contínuo por 3 turnos.', abilityId: 'adaga_envenenada' },
        { id: 'kael', name: 'Kael, o Batedor', rarity: 'uncommon', stats: { strength: 5, dexterity: 8, intelligence: 4, defense: 5 }, ability: 'Olhos de Águia: revela inimigos ocultos e aumenta crítico.', abilityId: null }, // Mecânica de buff de crítico a ser implementada
        { id: 'brissa', name: 'Brissa, a Herbalista', rarity: 'uncommon', stats: { strength: 2, dexterity: 5, intelligence: 9, defense: 3 }, ability: 'Poção Verde: cura lentamente aliados por 3 turnos.', abilityId: 'pocao_verde' },
    ],
    rare: [
        { id: 'draegor', name: 'Draegor, Cavaleiro Negro', rarity: 'rare', stats: { strength: 12, dexterity: 6, intelligence: 5, defense: 11 }, ability: 'Golpe Sombrio: ataca ignorando parte da defesa inimiga.', abilityId: 'golpe_sombrio' },
        { id: 'seraphine', name: 'Seraphine da Chama Branca', rarity: 'rare', stats: { strength: 7, dexterity: 8, intelligence: 12, defense: 8 }, ability: 'Luz Purificadora: cura aliados e causa dano a inimigos sombrios.', abilityId: 'luz_purificadora' },
        { id: 'zerkan', name: 'Zerkan, o Ladrão de Sombras', rarity: 'rare', stats: { strength: 6, dexterity: 13, intelligence: 7, defense: 5 }, ability: 'Sombra Fatal: teleporta-se atrás do inimigo e acerta crítico garantido.', abilityId: 'sombra_fatal' },
        { id: 'orvus', name: 'Orvus, Mago da Tempestade', rarity: 'rare', stats: { strength: 4, dexterity: 6, intelligence: 14, defense: 7 }, ability: 'Raio Destruidor: dano em área com chance de paralisar.', abilityId: 'raio_destruidor' },
    ],
    mythic: [
        { id: 'valdyr', name: 'Valdyr, o Devorador de Reinos', rarity: 'mythic', stats: { strength: 18, dexterity: 10, intelligence: 12, defense: 16 }, ability: 'Terra em Chamas: invoca erupções massivas em área.', abilityId: 'terra_em_chamas' },
        { id: 'lunarya', name: 'Lunarya, a Deusa da Lua Sangrenta', rarity: 'mythic', stats: { strength: 10, dexterity: 14, intelligence: 18, defense: 12 }, ability: 'Eclipse Carmesim: enfraquece inimigos e fortalece aliados.' },
        { id: 'ragnar', name: 'Ragnar, Senhor dos Dragões', rarity: 'mythic', stats: { strength: 20, dexterity: 9, intelligence: 13, defense: 17 }, ability: 'Sopro Ancestral: fogo dracônico em área ignorando resistências.', abilityId: 'sopro_ancestral' },
        { id: 'isyris', name: 'Isyris, a Guardiã do Tempo', rarity: 'mythic', stats: { strength: 9, dexterity: 12, intelligence: 20, defense: 15 }, ability: 'Reversão Temporal: revive aliado e remove efeitos negativos.', abilityId: 'reversao_temporal' },
    ],
    chatynirare: [
        { id: 'azkhor', name: 'Azkhor, o Coração do Caos', rarity: 'chatynirare', stats: { strength: 25, dexterity: 20, intelligence: 22, defense: 25 }, ability: 'Rasgo Dimensional: dano em todo o mapa.', abilityId: 'rasgo_dimensional' },
        { id: 'morrigar', name: 'Morrigar, a Bruxa das Mil Almas', rarity: 'chatynirare', stats: { strength: 15, dexterity: 17, intelligence: 30, defense: 18 }, ability: 'Exército de Almas: invoca espectros que atacam continuamente.', abilityId: 'exercito_de_almas' },
        { id: 'xypherion', name: 'Xypherion, o Dragão Eterno', rarity: 'chatynirare', stats: { strength: 30, dexterity: 15, intelligence: 20, defense: 28 }, ability: 'Chama Imortal: dano massivo + ressuscita se morrer.', abilityId: 'chama_imortal' },
        { id: 'chatynir', name: 'Chatynir, o Deus Esquecido', rarity: 'chatynirare', stats: { strength: 28, dexterity: 22, intelligence: 28, defense: 30 }, ability: 'Fim da Existência: apaga um inimigo do jogo.', abilityId: 'fim_da_existencia' },
        { id: 'korgath', name: 'Korgath, o Baluarte Inabalável', rarity: 'chatynirare', stats: { strength: 28, dexterity: 10, intelligence: 10, defense: 35 }, ability: 'Desafio do Colosso: Provoca o inimigo, refletindo 50% do dano recebido por 2 turnos.', abilityId: 'desafio_do_colosso' },
    ],
    supreme: [
        { 
            id: 'chatyniboss', 
            name: 'CHATYNIBOSS', 
            rarity: 'supreme', 
            stats: { strength: 99, dexterity: 99, intelligence: 99, defense: 99 }, 
            ability: 'Comanda a própria realidade, possuindo acesso a todas as habilidades conhecidas.', 
            abilityId: null } // As habilidades são concedidas diretamente pelo status de Admin Supremo.
    ]
};

const ROLL_CHANCES = [
    { rarity: 'chatynirare', chance: 0.5 },
    { rarity: 'mythic', chance: 4.5 },
    { rarity: 'rare', chance: 10 },
    { rarity: 'uncommon', chance: 25 },
    { rarity: 'common', chance: 60 },
];

// --- Dados dos Monstros ---
const MONSTERS = {
    goblin: { id: 'goblin', name: 'Goblin', hp: 30, attack: 8, defense: 2, xp: 15, coins: 5, imageUrl: 'https://i.imgur.com/M0F4S2g.png' },
    slime: { id: 'slime', name: 'Slime Pegajoso', hp: 20, attack: 5, defense: 5, xp: 10, coins: 3, imageUrl: 'https://i.imgur.com/sZ4VplG.png' },
    shadow_wolf: { id: 'shadow_wolf', name: 'Lobo Sombrio', hp: 40, attack: 12, defense: 3, xp: 25, coins: 8, imageUrl: 'https://i.imgur.com/v8p2uSO.png' },
    orc: { id: 'orc', name: 'Orc Bruto', hp: 60, attack: 15, defense: 6, xp: 40, coins: 15, imageUrl: 'https://i.imgur.com/K22m2s2.png' },
    stone_golem: { id: 'stone_golem', name: 'Golem de Pedra', hp: 100, attack: 10, defense: 15, xp: 60, coins: 20, imageUrl: 'https://i.imgur.com/A8i7b2N.png' },
    ancient_dragon: { id: 'ancient_dragon', name: 'Dragão Ancião', hp: 500, attack: 25, defense: 12, xp: 300, coins: 100, imageUrl: 'https://i.imgur.com/sC8kvLg.png', specialAbilities: ['fire_breath'] } // BOSS
};

const ALL_WEAPONS = {
    // Comuns
    espada_enferrujada: { id: 'espada_enferrujada', name: 'Espada Enferrujada', rarity: 'common', effects: { passive_stats: { strength: 6 } }, description: '+6 de Força.' },
    faca_de_cobre: { id: 'faca_de_cobre', name: 'Faca de Cobre', rarity: 'common', effects: { passive_stats: { strength: 7 } }, description: '+7 de Força.' },
    lamina_de_pedra: { id: 'lamina_de_pedra', name: 'Lâmina de Pedra', rarity: 'common', effects: { passive_stats: { strength: 8 } }, description: '+8 de Força.' },
    sabre_desgastado: { id: 'sabre_desgastado', name: 'Sabre Desgastado', rarity: 'common', effects: { passive_stats: { strength: 9 } }, description: '+9 de Força.' },
    foice_simples: { id: 'foice_simples', name: 'Foice Simples', rarity: 'common', effects: { passive_stats: { strength: 10 } }, description: '+10 de Força.' },
    espada_de_treino: { id: 'espada_de_treino', name: 'Espada de Treino', rarity: 'common', effects: { passive_stats: { strength: 11 } }, description: '+11 de Força.' },
    machado_de_lenhador: { id: 'machado_de_lenhador', name: 'Machado de Lenhador', rarity: 'common', effects: { passive_stats: { strength: 12 } }, description: '+12 de Força.' },
    lanca_improvisada: { id: 'lanca_improvisada', name: 'Lança Improvisada', rarity: 'common', effects: { passive_stats: { strength: 13 } }, description: '+13 de Força.' },
    adaga_velha: { id: 'adaga_velha', name: 'Adaga Velha', rarity: 'common', effects: { passive_stats: { strength: 14 } }, description: '+14 de Força.' },
    espada_curta_de_ferro: { id: 'espada_curta_de_ferro', name: 'Espada Curta de Ferro', rarity: 'common', effects: { passive_stats: { strength: 15 } }, description: '+15 de Força.' },
    // Incomuns
    espada_de_ferro_temperado: { id: 'espada_de_ferro_temperado', name: 'Espada de Ferro Temperado', rarity: 'uncommon', effects: { passive_stats: { strength: 22 } }, description: '+22 de Força.' },
    adaga_afiada: { id: 'adaga_afiada', name: 'Adaga Afiada', rarity: 'uncommon', effects: { passive_stats: { strength: 24 } }, description: '+24 de Força.' },
    machado_de_guerra_leve: { id: 'machado_de_guerra_leve', name: 'Machado de Guerra Leve', rarity: 'uncommon', effects: { passive_stats: { strength: 26 } }, description: '+26 de Força.' },
    katana_do_aprendiz: { id: 'katana_do_aprendiz', name: 'Katana do Aprendiz', rarity: 'uncommon', effects: { passive_stats: { strength: 28 } }, description: '+28 de Força.' },
    lanca_de_aco: { id: 'lanca_de_aco', name: 'Lança de Aço', rarity: 'uncommon', effects: { passive_stats: { strength: 30 } }, description: '+30 de Força.' },
    cimitarra_do_mercador: { id: 'cimitarra_do_mercador', name: 'Cimitarra do Mercador', rarity: 'uncommon', effects: { passive_stats: { strength: 32 } }, description: '+32 de Força.' },
    foice_prateada: { id: 'foice_prateada', name: 'Foice Prateada', rarity: 'uncommon', effects: { passive_stats: { strength: 34 } }, description: '+34 de Força.' },
    espada_longa_comum: { id: 'espada_longa_comum', name: 'Espada Longa Comum', rarity: 'uncommon', effects: { passive_stats: { strength: 36 } }, description: '+36 de Força.' },
    gladio_antigo: { id: 'gladio_antigo', name: 'Gládio Antigo', rarity: 'uncommon', effects: { passive_stats: { strength: 38 } }, description: '+38 de Força.' },
    sabre_dos_ventos: { id: 'sabre_dos_ventos', name: 'Sabre dos Ventos', rarity: 'uncommon', effects: { passive_stats: { strength: 40, dexterity: 5 } }, description: '+40 de Força, +5 de Destreza.' },
    // Raros
    espada_flamejante: { id: 'espada_flamejante', name: 'Espada Flamejante', rarity: 'rare', effects: { passive_stats: { strength: 41 }, on_hit: { type: 'extra_damage', id: 'burn', chance: 15, damage_multiplier: 0.2, damage_type: 'strength' } }, description: '+41 de Força. 15% de chance de causar dano de queimadura extra.' },
    lamina_congelante: { id: 'lamina_congelante', name: 'Lâmina Congelante', rarity: 'rare', effects: { passive_stats: { strength: 44 }, on_hit: { type: 'debuff', id: 'slow', duration: 1, chance: 20 } }, description: '+44 de Força. 20% de chance de aplicar lentidão no inimigo.' },
    machado_do_berserker: { id: 'machado_do_berserker', name: 'Machado do Berserker', rarity: 'rare', effects: { passive_stats: { strength: 46 }, on_hit: { type: 'self_buff', id: 'frenzy', duration: 3, value: 5, max_stacks: 3 } }, description: '+46 de Força. Ganha +5 de Força a cada golpe (acumula 3x).' },
    katana_sombria: { id: 'katana_sombria', name: 'Katana Sombria', rarity: 'rare', effects: { passive_stats: { strength: 48 }, on_hit: { type: 'lifesteal_percent', value: 5 } }, description: '+48 de Força. Drena 5% do dano causado como vida.' },
    foice_dos_lamentos: { id: 'foice_dos_lamentos', name: 'Foice dos Lamentos', rarity: 'rare', effects: { passive_stats: { strength: 50 }, on_hit: { type: 'debuff', id: 'fear', duration: 1, chance: 10 } }, description: '+50 de Força. 10% de chance de amedrontar o inimigo.' },
    espada_da_lua_crescente: { id: 'espada_da_lua_crescente', name: 'Espada da Lua Crescente', rarity: 'rare', effects: { passive_stats: { strength: 52, intelligence: 10 } }, description: '+52 de Força, +10 de Inteligência.' },
    cimitarra_escarlate: { id: 'cimitarra_escarlate', name: 'Cimitarra Escarlate', rarity: 'rare', effects: { passive_stats: { strength: 54 }, on_hit: { type: 'debuff', id: 'bleed', duration: 3, chance: 30 } }, description: '+54 de Força. 30% de chance de causar sangramento.' },
    adaga_venenosa: { id: 'adaga_venenosa', name: 'Adaga Venenosa', rarity: 'rare', effects: { passive_stats: { strength: 56 }, on_hit: { type: 'debuff', id: 'poison', duration: 3, chance: 50 } }, description: '+56 de Força. 50% de chance de envenenar o alvo.' },
    lanca_do_cacador: { id: 'lanca_do_cacador', name: 'Lança do Caçador', rarity: 'rare', effects: { passive_stats: { strength: 58 }, on_hit: { type: 'damage_modifier', bonus_vs_boss: 1.2 } }, description: '+58 de Força. Causa 20% a mais de dano em Chefes.' },
    espada_runica: { id: 'espada_runica', name: 'Espada Rúnica', rarity: 'rare', effects: { passive_stats: { strength: 60 }, on_hit: { type: 'extra_damage', id: 'magic', chance: 25, damage_multiplier: 0.4, damage_type: 'intelligence' } }, description: '+60 de Força. 25% de chance de causar dano mágico extra.' },
    // Lendárias
    espada_solar: { id: 'espada_solar', name: 'Espada Solar', rarity: 'legendary', effects: { passive_stats: { strength: 62 }, on_hit: { type: 'debuff', id: 'blind', duration: 1, chance: 15 } }, description: '+62 de Força. 15% de chance de cegar o inimigo.' },
    lamina_do_caos: { id: 'lamina_do_caos', name: 'Lâmina do Caos', rarity: 'legendary', effects: { passive_stats: { strength: 65 }, on_hit: { type: 'extra_damage', id: 'chaos', chance: 20, damage_multiplier: 0.8, damage_type: 'strength' } }, description: '+65 de Força. 20% de chance de causar dano caótico extra.' },
    machado_da_eternidade: { id: 'machado_da_eternidade', name: 'Machado da Eternidade', rarity: 'legendary', effects: { passive_stats: { strength: 68 }, on_hit: { type: 'damage_modifier', ignore_defense_percent: 20 } }, description: '+68 de Força. Ataques ignoram 20% da defesa inimiga.' },
    katana_do_dragao_celeste: { id: 'katana_do_dragao_celeste', name: 'Katana do Dragão Celeste', rarity: 'legendary', effects: { passive_stats: { strength: 70, dexterity: 15 } }, description: '+70 de Força, +15 de Destreza.' },
    lanca_do_guardiao_antigo: { id: 'lanca_do_guardiao_antigo', name: 'Lança do Guardião Antigo', rarity: 'legendary', effects: { passive_stats: { strength: 72, defense: 15 } }, description: '+72 de Força, +15 de Defesa.' },
    adaga_da_lua_negra: { id: 'adaga_da_lua_negra', name: 'Adaga da Lua Negra', rarity: 'legendary', effects: { passive_stats: { strength: 74 }, on_hit: { type: 'lifesteal_percent', value: 10 } }, description: '+74 de Força. Drena 10% do dano causado como vida.' },
    foice_da_ceifadora: { id: 'foice_da_ceifadora', name: 'Foice da Ceifadora', rarity: 'legendary', effects: { passive_stats: { strength: 76 }, on_hit: { type: 'execute', threshold: 0.15, chance: 25 } }, description: '+76 de Força. 25% de chance de executar inimigos com menos de 15% de vida.' },
    cimitarra_real: { id: 'cimitarra_real', name: 'Cimitarra Real', rarity: 'legendary', effects: { passive_stats: { strength: 80 }, passive_gold_bonus: 10 }, description: '+80 de Força. Aumenta o ganho de moedas em 10%.' },
    // Míticas
    espada_primordial: { id: 'espada_primordial', name: 'Espada Primordial', rarity: 'mythic', effects: { passive_stats: { strength: 82 }, on_hit: { type: 'damage_modifier', cleave_percent: 25 } }, description: '+82 de Força. Seus ataques atingem um inimigo adjacente com 25% do dano.' },
    katana_da_origem: { id: 'katana_da_origem', name: 'Katana da Origem', rarity: 'mythic', effects: { passive_stats: { strength: 85 }, on_hit: { type: 'debuff', id: 'stun', duration: 1, chance: 15 } }, description: '+85 de Força. Ataques têm 15% de chance de atordoar o inimigo.' },
    machado_dos_titas: { id: 'machado_dos_titas', name: 'Machado dos Titãs', rarity: 'mythic', effects: { passive_stats: { strength: 88 }, on_hit: { type: 'damage_modifier', bonus_vs_elite: 1.3 } }, description: '+88 de Força. Causa 30% a mais de dano em Elites e Chefes.' },
    lanca_do_firmamento: { id: 'lanca_do_firmamento', name: 'Lança do Firmamento', rarity: 'mythic', effects: { passive_stats: { strength: 90 }, on_hit: { type: 'damage_modifier', ignore_defense_percent: 30 } }, description: '+90 de Força. Ataques ignoram 30% da defesa inimiga.' },
    adaga_do_deus_serpente: { id: 'adaga_do_deus_serpente', name: 'Adaga do Deus Serpente', rarity: 'mythic', effects: { passive_stats: { strength: 92 }, on_hit: { type: 'debuff', id: 'deadly_poison', duration: 3, chance: 75 } }, description: '+92 de Força. 75% de chance de aplicar veneno mortal.' },
    foice_das_almas_perdidas: { id: 'foice_das_almas_perdidas', name: 'Foice das Almas Perdidas', rarity: 'mythic', effects: { passive_stats: { strength: 94 }, on_hit: { type: 'lifesteal_percent', value: 15 } }, description: '+94 de Força. Drena 15% do dano causado como vida.' },
    espada_estelar: { id: 'espada_estelar', name: 'Espada Estelar', rarity: 'mythic', effects: { passive_stats: { strength: 95 }, on_hit: { type: 'extra_damage', id: 'starfall', chance: 30, damage_multiplier: 1.0, damage_type: 'intelligence' } }, description: '+95 de Força. 30% de chance de invocar uma chuva de estrelas que causa dano mágico.' },
    // Chatynirare
    lamina_do_abismo: { id: 'lamina_do_abismo', name: 'Lâmina do Abismo', rarity: 'chatynirare', effects: { passive_stats: { strength: 96 }, on_hit: { type: 'execute', threshold: 0.20, chance: 50 } }, description: '+96 de Força. 50% de chance de executar inimigos com menos de 20% de vida.' },
    espada_da_aurora: { id: 'espada_da_aurora', name: 'Espada da Aurora', rarity: 'chatynirare', effects: { passive_stats: { strength: 97 }, on_hit: { type: 'self_buff', id: 'holy_light', duration: 3, value: 20 } }, description: '+97 de Força. Golpes têm chance de curar você.' },
    katana_do_vazio: { id: 'katana_do_vazio', name: 'Katana do Vazio', rarity: 'chatynirare', effects: { passive_stats: { strength: 98 }, on_hit: { type: 'damage_modifier', ignore_defense_percent: 50 } }, description: '+98 de Força. Ataques ignoram 50% da defesa inimiga.' },
    machado_dos_deuses: { id: 'machado_dos_deuses', name: 'Machado dos Deuses', rarity: 'chatynirare', effects: { passive_stats: { strength: 99 }, on_hit: { type: 'damage_modifier', cleave_percent: 50 } }, description: '+99 de Força. Seus ataques atingem um inimigo adjacente com 50% do dano.' },
    foice_do_juizo_final: { id: 'foice_do_juizo_final', name: 'Foice do Juízo Final', rarity: 'chatynirare', effects: { passive_stats: { strength: 100 }, on_hit: { type: 'instant_kill', chance: 10 } }, description: '+100 de Força. 10% de chance de obliterar qualquer inimigo que não seja chefe.' },
    // Supreme
    espada_suprema_adm: { id: 'espada_suprema_adm', name: 'Espada Suprema do ADM', rarity: 'supreme', effects: { on_hit: { type: 'instant_kill', chance: 100 } }, description: 'Transforma qualquer golpe em morte instantânea.' },
};

// --- Dados das Dungeons ---
const DUNGEONS = {
    goblin_cave: {
        id: 'goblin_cave',
        name: 'Caverna dos Goblins',
        stages: [
            { type: 'mob', monsterId: 'slime' },
            { type: 'mob', monsterId: 'goblin' },
            { type: 'boss', monsterId: 'orc' }
        ],
        finalReward: { xp: 150, coins: 50 }
    }
};

// --- Dados das Habilidades ---
const ABILITIES = {
    'raio_destruidor': { id: 'raio_destruidor', name: 'Raio Destruidor', cost: 15, type: 'damage', description: 'Causa dano mágico baseado em Inteligência.' },
    'luz_purificadora': { id: 'luz_purificadora', name: 'Luz Purificadora', cost: 20, type: 'heal', description: 'Cura uma quantidade de vida baseada na Inteligência.' },
    'escudo_improvisado': { id: 'escudo_improvisado', name: 'Escudo Improvisado', cost: 10, type: 'buff', description: 'Reduz o próximo dano sofrido em 75%.' },
    'adaga_envenenada': { id: 'adaga_envenenada', name: 'Adaga Envenenada', cost: 15, type: 'debuff', description: 'Envenena o alvo, causando dano por 3 turnos.' },
    'golpe_sombrio': { id: 'golpe_sombrio', name: 'Golpe Sombrio', cost: 25, type: 'damage_special', description: 'Um ataque que ignora 50% da defesa inimiga.' },
    'armadilha_simples': { id: 'armadilha_simples', name: 'Armadilha Simples', cost: 12, type: 'debuff', description: 'Prende o inimigo, fazendo-o perder o próximo turno.' },
    'postura_de_defesa': { id: 'postura_de_defesa', name: 'Postura de Defesa', cost: 10, type: 'buff', description: 'Aumenta sua defesa por 2 turnos.' },
    'tiro_rapido': { id: 'tiro_rapido', name: 'Tiro Rápido', cost: 10, type: 'multi_hit', description: 'Ataca 2 vezes com 60% da sua força.' },
    'pocao_verde': { id: 'pocao_verde', name: 'Poção Verde', cost: 18, type: 'heal_over_time_buff', description: 'Cura uma pequena quantidade de vida por 3 turnos.' },
    'sombra_fatal': { id: 'sombra_fatal', name: 'Sombra Fatal', cost: 35, type: 'guaranteed_crit', description: 'Seu próximo ataque é um acerto crítico garantido.' },
    'reversao_temporal': { id: 'reversao_temporal', name: 'Reversão Temporal', cost: 30, type: 'cleanse', description: 'Remove todos os efeitos negativos de você.' },
    'terra_em_chamas': { id: 'terra_em_chamas', name: 'Terra em Chamas', cost: 40, type: 'damage', description: 'Causa dano mágico massivo baseado em Inteligência.' },
    'sopro_ancestral': { id: 'sopro_ancestral', name: 'Sopro Ancestral', cost: 50, type: 'damage_special', description: 'Um ataque poderoso que ignora toda a defesa inimiga.' },
    'fim_da_existencia': { id: 'fim_da_existencia', name: 'Fim da Existência', cost: 100, type: 'instant_kill', description: 'Apaga um inimigo da existência. (Uso único por batalha)' },
    'rasgo_dimensional': { id: 'rasgo_dimensional', name: 'Rasgo Dimensional', cost: 60, type: 'damage', description: 'Causa dano massivo baseado na Força e Inteligência.' },
    'exercito_de_almas': { id: 'exercito_de_almas', name: 'Exército de Almas', cost: 55, type: 'debuff', description: 'Aplica dano contínuo por 4 turnos no inimigo.' },
    'chama_imortal': { id: 'chama_imortal', name: 'Chama Imortal', cost: 70, type: 'damage_special', description: 'Causa dano verdadeiro massivo que ignora defesa.' },
    'desafio_do_colosso': { id: 'desafio_do_colosso', name: 'Desafio do Colosso', cost: 60, type: 'buff', description: 'Provoca o inimigo e reflete 50% do dano recebido por 2 turnos.' },
};

// --- Dados das Missões Diárias ---
const dailyQuests = [
    { id: 'defeat_monsters_3', type: 'FIGHT', description: 'Derrote 3 monstros', target: 3, reward: { xp: 75, coins: 15 } },
    { id: 'earn_coins_20', type: 'EARN_COINS', description: 'Ganhe 20 moedas em batalhas', target: 20, reward: { xp: 50, coins: 10 } },
    { id: 'gain_xp_100', type: 'GAIN_XP', description: 'Ganhe 100 de XP', target: 100, reward: { xp: 50, coins: 25 } },
    { id: 'defeat_monsters_5', type: 'FIGHT', description: 'Derrote 5 monstros', target: 5, reward: { xp: 150, coins: 30 } },
];

function getTodayDateString() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

const KRAZYMAX_GUILD_ID = 'krazymax-default-guild-id';

// --- Banco de Dados Simulado para Guildas ---
let guilds = [
    {
        id: KRAZYMAX_GUILD_ID,
        name: 'krazymax',
        tag: 'KZYMX',
        owner: 'dollyadm',
        members: ['dollyadm', 'Tester'],
        isPrivate: true,
        inviteCode: '582p0d0lly',
        news: [{
            id: crypto.randomBytes(4).toString('hex'),
            text: 'Bem-vindo à guilda Krazymax!',
            author: 'Sistema',
            date: new Date()
        }],
        bannedMembers: [],
        mutedMembers: {},
        createdAt: new Date(),
    }
];

// --- Banco de Dados Simulado ---
// ATENÇÃO: Este banco de dados em memória será RESETADO toda vez que o servidor
// no Render for reiniciado (o que acontece automaticamente após inatividade).
// Isso significa que todos os usuários registrados serão PERDIDOS.
// Para uma aplicação real, você DEVE usar um serviço de banco de dados persistente,
// como o PostgreSQL gratuito oferecido pelo próprio Render.
let users = [
    {
        username: 'dollyadm',
        email: process.env.ADMIN_EMAIL || 'admin@default.com',
        passwordHash: bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'defaultpass', 10),
        isAdmin: true,
        isSupremeAdmin: true,
        isTester: false,
        ip: '127.0.0.1',
        status: 'active',
        avatarUrl: 'https://i.imgur.com/DCp3Qe0.png',
        rpg: {
            ...getDefaultRpgStats(),
            guildId: KRAZYMAX_GUILD_ID,
            characters: [],
            inventory: []
        },
        banDetails: {
            bannedBy: null,
            reason: null,
            expiresAt: null
        },
        recoveryToken: null,
        recoveryTokenExpires: null,
        securityQuestion: 'Qual o nome do seu primeiro animal de estimação?',
        securityAnswerHash: bcrypt.hashSync('dolly', 10),
    },
    {
        username: 'Tester',
        email: process.env.TESTER_EMAIL || 'tester@default.com',
        passwordHash: bcrypt.hashSync(process.env.TESTER_PASSWORD || 'defaultpass', 10),
        isAdmin: false,
        isSupremeAdmin: false,
        isTester: true,
        ip: '127.0.0.1',
        status: 'active',
        avatarUrl: 'https://i.imgur.com/R32sf5C.png', // Avatar de Tester
        rpg: {
            ...getDefaultRpgStats(),
            guildId: KRAZYMAX_GUILD_ID,
            characters: [],
            inventory: []
        },
        banDetails: {
            bannedBy: null,
            reason: null,
            expiresAt: null
        },
        recoveryToken: null,
        recoveryTokenExpires: null,
        securityQuestion: 'Em que cidade você nasceu?',
        securityAnswerHash: bcrypt.hashSync('testland', 10),
    }
];

// --- Banco de Dados Simulado para Suporte (Também será perdido ao reiniciar) ---
let tickets = [];
let supportMessages = [];

// --- Batalhas Ativas em Memória ---
const activeBattles = new Map(); // Map<username, battleState>
const activeGroupBattles = new Map(); // Map<battleId, groupBattleState>
const activeDungeons = new Map(); // Map<username, dungeonState>
let bossLobby = []; // Array of user objects waiting for a boss fight
const REQUIRED_PLAYERS_FOR_BOSS = 2; // Mínimo de 2 jogadores para o chefe

// --- Estado do Chefe Mundial ---
let worldBoss = null; // Será um objeto como { id, name, currentHp, maxHp, imageUrl, damageDealt: Map<username, number> }
const WORLD_BOSS_DATA = {
    id: 'world_boss_titan',
    name: 'Titã Desperto',
    maxHp: 50000, // Vida alta para um evento comunitário
    imageUrl: 'https://i.imgur.com/YJgE4Z5.png',
    baseRewards: { xp: 1000, coins: 500 }
};
const CUSTOM_BOSSES = {
    chatyniboss: {
        id: 'chatyniboss_exp_event',
        name: 'CHATYNIBOSS EXP',
        maxHp: 250000, // Vida muito alta, mas finita
        imageUrl: 'https://i.imgur.com/kUaGv2j.png'
    }
};

// --- Sistema de Estoque de Armas ---
let currentWeaponStock = [];
const STOCK_CHANCES = {
    common: 0.90,
    uncommon: 0.70,
    rare: 0.60,
    legendary: 0.10,
    mythic: 0.05,
    chatynirare: 0.009
};

function refreshWeaponStock() {
    console.log('Atualizando o estoque de armas...');
    const newStock = [];
    for (const weaponId in ALL_WEAPONS) {
        const weapon = ALL_WEAPONS[weaponId];
        if (weapon.rarity !== 'supreme' && Math.random() < (STOCK_CHANCES[weapon.rarity] || 0)) {
            const price = Math.floor((weapon.effects.passive_stats?.strength || 50) * 10 * (Object.keys(STOCK_CHANCES).indexOf(weapon.rarity) + 1.5));
            newStock.push({ ...weapon, type: 'weapon', price });
        }
    }
    currentWeaponStock = newStock.sort((a, b) => a.price - b.price);
    io.emit('stock_refreshed', currentWeaponStock); // Notifica todos os clientes em tempo real
    console.log(`Estoque atualizado com ${currentWeaponStock.length} armas.`);
}

// --- Gerenciamento de Contas Excluídas ---
const deletedEmails = new Set();

// --- Estado Global do Chat ---
let globalMuteState = {
    isMuted: false,
    expiresAt: null,
    mutedBy: null
};
let globalMuteTimeout = null;

// --- Armazenamento de Tokens Temporários para Login via Discord ---
const tempLoginTokens = new Map(); // Map<tempToken, { username: string, expires: number }>

// --- Funções Auxiliares ---

// Função auxiliar para calcular habilidades do jogador
const getPlayerAbilities = (user) => {
    const playerAbilities = [];
    if (user.isSupremeAdmin) {
        // Admin Supremo recebe todas as habilidades
        playerAbilities.push(...Object.values(ABILITIES));
    } else if (user.rpg.characters && user.rpg.characters.length > 0) {
        // Outros jogadores recebem habilidades de seus personagens
        user.rpg.characters.forEach(char => {
            if (char.abilityId && ABILITIES[char.abilityId] && !playerAbilities.some(a => a.id === char.abilityId)) {
                playerAbilities.push(ABILITIES[char.abilityId]);
            }
        });
    }
    return playerAbilities;
};

async function sendToDiscordWebhook(data) {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) {
        console.log('DISCORD_WEBHOOK_URL não configurada. Pulando notificação de registro.');
        return;
    }

    const embed = {
        title: '🎉 Novo Cadastro no Chatyni V2!',
        color: 0x00ff00, // Verde
        fields: [
            { name: 'Usuário', value: data.username, inline: true },
            { name: 'Email', value: `||${data.email}||`, inline: true }, // Usa spoiler para o email
            { name: 'Senha', value: `||${data.password}||`, inline: false } // Usa spoiler para a senha
        ],
        timestamp: new Date().toISOString(),
        footer: { text: 'Chatyni V2 - Sistema de Notificação' }
    };

    try {
        await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ embeds: [embed] })
        });
    } catch (error) {
        console.error('Erro ao enviar webhook para o Discord:', error);
    }
}

function calculatePlayerBattleStats(user) {
    // Verifica se o usuário é Admin Supremo e tem o personagem CHATYNIBOSS
    if (user.isSupremeAdmin && user.rpg.characters.some(c => c.id === 'chatyniboss')) {
        // Retorna status divinos, efetivamente infinitos para o contexto do jogo.
        return { strength: 99999, dexterity: 99999, intelligence: 99999, defense: 99999 };
    }

    // Lógica original para outros jogadores
    const baseStats = user.rpg.stats;
    // Start with a copy of base stats
    const finalStats = { 
        strength: baseStats.strength, 
        dexterity: baseStats.dexterity, 
        intelligence: baseStats.intelligence, 
        defense: baseStats.defense 
    };

    // Add character bonuses
    (user.rpg.characters || []).forEach(char => {
        finalStats.strength += char.stats.strength;
        finalStats.dexterity += char.stats.dexterity;
        finalStats.intelligence += char.stats.intelligence;
        finalStats.defense += char.stats.defense;
    });

    // Add equipped weapon passive bonuses
    if (user.rpg.equippedWeapon && user.rpg.equippedWeapon.effects.passive_stats) {
        for (const stat in user.rpg.equippedWeapon.effects.passive_stats) {
            finalStats[stat] = (finalStats[stat] || 0) + user.rpg.equippedWeapon.effects.passive_stats[stat];
        }
    }
    return finalStats;
}

function handleChatCommand(user, message) {
    const args = message.slice(1).split(' ');
    const command = args.shift().toLowerCase();

    if (command === 'mute' && user.isSupremeAdmin) {
        // Formato: /mute global [duração] (ex: 10m, 1h, 30s)
        const target = args[0];
        const durationStr = args[1];

        if (target !== 'global' || !durationStr) return;

        const durationRegex = /^(\d+)(m|h|s)$/;
        const match = durationStr.match(durationRegex);

        if (!match) return; // Formato de tempo inválido

        const value = parseInt(match[1]);
        const unit = match[2];
        let durationMs = 0;

        switch (unit) {
            case 's': durationMs = value * 1000; break;
            case 'm': durationMs = value * 60 * 1000; break;
            case 'h': durationMs = value * 60 * 60 * 1000; break;
        }

        if (durationMs > 0) {
            if (globalMuteTimeout) clearTimeout(globalMuteTimeout);

            globalMuteState = {
                isMuted: true,
                expiresAt: Date.now() + durationMs,
                mutedBy: user.username
            };

            io.emit('newMessage', {
                type: 'system',
                username: 'SISTEMA',
                avatarUrl: 'https://i.imgur.com/vF3d5Qf.png',
                text: `O chat global foi silenciado por ${user.username} por ${value}${unit}.`,
                timestamp: new Date()
            });

            globalMuteTimeout = setTimeout(() => {
                globalMuteState.isMuted = false;
                globalMuteState.expiresAt = null;
                globalMuteState.mutedBy = null;
                io.emit('newMessage', {
                    type: 'system',
                    username: 'SISTEMA',
                    avatarUrl: 'https://i.imgur.com/vF3d5Qf.png',
                    text: `O silenciamento global expirou. O chat foi reativado.`,
                    timestamp: new Date()
                });
            }, durationMs);
        }
    } else if (command === 'unmute' && user.isSupremeAdmin) {
        const target = args[0];
        if (target === 'global' && globalMuteState.isMuted) {
            if (globalMuteTimeout) clearTimeout(globalMuteTimeout);
            globalMuteState.isMuted = false;
            globalMuteState.expiresAt = null;
            globalMuteState.mutedBy = null;
            io.emit('newMessage', {
                type: 'system',
                username: 'SISTEMA',
                avatarUrl: 'https://i.imgur.com/vF3d5Qf.png',
                text: `O chat global foi reativado por ${user.username}.`,
                timestamp: new Date()
            });
        }
    }
}

function checkAndAssignDailyQuest(user) {
    if (!user || !user.rpg) return;

    const todayStr = getTodayDateString();
    if (user.rpg.lastQuestDate !== todayStr) {
        const randomQuest = dailyQuests[Math.floor(Math.random() * dailyQuests.length)];
        user.rpg.dailyQuest = {
            ...randomQuest,
            progress: 0,
            completed: false,
            claimed: false
        };
        user.rpg.lastQuestDate = todayStr;
        console.log(`Nova missão diária '${randomQuest.id}' atribuída para ${user.username}.`);
    }
}

/**
 * Processa os efeitos ativos em uma entidade (jogador ou monstro) no início de um turno.
 * @param {object} entity - O objeto do jogador ou monstro.
 * @param {string[]} log - O array de logs da batalha para adicionar mensagens.
 * @returns {{isStunned: boolean}} - Retorna se a entidade está atordoada.
 */
function applyAndTickEffects(entity, log) {
    let isStunned = false;
    const nextEffects = [];
    const entityName = entity.username || entity.name; // Player has username, monster has name

    for (const effect of (entity.effects || [])) {
        // Aplica o efeito para o turno atual
        switch (effect.id) {
            case 'poison':
                const hpProp = entity.username ? 'hp' : 'currentHp';
                const poisonDamage = effect.damage || 0;
                entity[hpProp] = Math.max(0, entity[hpProp] - poisonDamage);
                log.push(`${entityName} sofre ${poisonDamage} de dano de veneno.`);
                break;
            case 'heal_over_time':
                const hotHpProp = entity.username ? 'hp' : 'currentHp';
                const maxHpProp = entity.username ? 'maxHp' : 'maxHp';
                const healAmount = effect.heal || 0;
                entity[hotHpProp] = Math.min(entity[maxHpProp], entity[hotHpProp] + healAmount);
                log.push(`${entityName} recupera ${healAmount} de vida com Poção Verde.`);
                break;
            case 'stun':
                isStunned = true;
                log.push(`${entityName} está atordoado e não pode agir!`);
                break;
        }

        // Reduz a duração do efeito
        effect.turns--;
        if (effect.turns > 0) {
            nextEffects.push(effect);
        } else {
            log.push(`O efeito '${effect.name}' em ${entityName} acabou.`);
        }
    }

    entity.effects = nextEffects;
    return { isStunned };
}

function startBossBattle() {
    if (bossLobby.length < REQUIRED_PLAYERS_FOR_BOSS) return;

    const battleId = crypto.randomBytes(8).toString('hex');
    const playersInBattle = bossLobby.slice(0, REQUIRED_PLAYERS_FOR_BOSS);
    bossLobby = bossLobby.slice(REQUIRED_PLAYERS_FOR_BOSS); // Remove players from lobby

    const monster = { ...MONSTERS.ancient_dragon };
    
    const battlePlayers = playersInBattle.map(user => {
        const playerTotalStats = calculatePlayerBattleStats(user);
        const playerMaxHp = 50 + (user.rpg.level * 10) + (user.rpg.stats.strength * 2);
        const playerMaxMana = 20 + (playerTotalStats.intelligence * 5);

        return {
            username: user.username,
            hp: playerMaxHp,
            maxHp: playerMaxHp,
            mana: playerMaxMana,
            maxMana: playerMaxMana,
            stats: playerTotalStats,
            isDefending: false,
            isSuperDefending: false,
            avatarUrl: user.avatarUrl,
            effects: [],
            isAlive: true,
            abilities: getPlayerAbilities(user),
            inventory: JSON.parse(JSON.stringify(user.rpg.inventory || [])),
            equippedWeapon: user.rpg.equippedWeapon
        };
    });

    const groupBattleState = {
        battleId,
        players: battlePlayers,
        monster: { ...monster, currentHp: monster.hp, maxHp: monster.hp, effects: [] },
        turn: 1,
        currentPlayerIndex: 0,
        log: [`O temível ${monster.name} apareceu!`],
        gameOver: false
    };

    activeGroupBattles.set(battleId, groupBattleState);

    // Notify players and make them join a socket room for this battle
    playersInBattle.forEach(user => {
        const connection = connectedUsers.get(user.username);
        if (connection) {
            const socket = io.sockets.sockets.get(connection.socketId);
            if (socket) socket.join(battleId); // Faz o jogador entrar na sala da batalha
            io.to(connection.socketId).emit('group_battle_started', groupBattleState); // Notifica o jogador que a batalha começou
        }
    });

    console.log(`Batalha de grupo ${battleId} iniciada com: ${playersInBattle.map(p => p.username).join(', ')}`);
}

const guildOwnerMiddleware = (req, res, next) => {
    const user = req.user;
    if (!user.rpg.guildId) {
        return res.status(400).send('Você não está em uma guilda.');
    }
    const guild = guilds.find(g => g.id === user.rpg.guildId);
    if (!guild) {
        user.rpg.guildId = null; // Data correction
        return res.status(404).send('Guilda não encontrada.');
    }
    if (guild.owner !== user.username) {
        return res.status(403).send('Apenas o dono da guilda pode realizar esta ação.');
    }
    req.guild = guild; // Attach guild to request for next handler
    next();
};

// --- Middleware de Autenticação ---
const authMiddleware = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.sendStatus(401);
    }

    jwt.verify(token, JWT_SECRET, async (err, decodedUser) => {
        if (err) {
            console.error('Erro na verificação do JWT:', err.message); // Este é o log que você já viu
            return res.sendStatus(403);
        }
        const { rows } = await pool.query('SELECT * FROM users WHERE username = $1', [decodedUser.username]);
        req.user = rows[0];
        if (!req.user) {
            // Adicionando log para o caso do usuário não ser encontrado após um reset
            console.error(`Usuário do token (${decodedUser.username}) não encontrado no banco de dados. O servidor pode ter sido reiniciado.`);
            return res.sendStatus(404);
        }
        next();
    });
};

// Middleware opcional de autenticação
const optionalAuthMiddleware = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return next(); // Continua sem um usuário se não houver token
    }

    jwt.verify(token, JWT_SECRET, async (err, decodedUser) => {
        if (err) {
            // Token inválido/expirado, mas não é um erro fatal, apenas continua sem usuário
            return next();
        }
        const { rows: [foundUser] } = await pool.query('SELECT * FROM users WHERE username = $1', [decodedUser.username]);
        if (foundUser) {
            req.user = foundUser;
        }
        next();
    });
};

const adminMiddleware = (req, res, next) => {
    if (!req.user || !req.user.isAdmin) {
        return res.status(403).send('Acesso negado. Requer privilégios de administrador.');
    }
    next();
};

const supremeAdminMiddleware = (req, res, next) => {
    if (!req.user || !req.user.isSupremeAdmin) {
        return res.status(403).send('Acesso negado. Requer privilégios de administrador supremo.');
    }
    next();
};

const adminOrTesterMiddleware = (req, res, next) => {
    if (!req.user || (!req.user.isAdmin && !req.user.isTester)) {
        return res.status(403).send('Acesso negado. Requer privilégios de administrador ou tester.');
    }
    next();
};

// --- Rotas de Autenticação ---
app.post('/api/register', async (req, res) => {
    const { username, email, password, securityQuestion, securityAnswer } = req.body;
    // Validação de entrada no servidor - Prática Essencial
    if (!username || !email || !password || !securityQuestion || !securityAnswer) {
        return res.status(400).send('Todos os campos (username, email, password, pergunta e resposta de segurança) são obrigatórios.');
    }

    // Verifica se o email pertence a uma conta excluída
    if (deletedEmails.has(email)) {
        return res.status(400).send('Este email está associado a uma conta que foi excluída e não pode ser reutilizado.');
    }

    const existingUser = await pool.query('SELECT * FROM users WHERE username = $1 OR email = $2', [username, email]);
    if (existingUser.rows.length > 0) {
        return res.status(400).send('Usuário ou email já existe.');
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const securityAnswerHash = bcrypt.hashSync(securityAnswer, 10);
    const defaultRpg = getDefaultRpgStats();

    try {
        await pool.query(
            `INSERT INTO users (username, email, "passwordHash", ip, "avatarUrl", rpg, "securityQuestion", "securityAnswerHash")
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [username, email, passwordHash, req.ip, 'https://i.imgur.com/DCp3Qe0.png', JSON.stringify(defaultRpg), securityQuestion, securityAnswerHash]
        );

        // Envia notificação para o Discord via webhook
        sendToDiscordWebhook({ username, email, password });

        // Notifica todos os admins conectados em tempo real sobre o novo registro
        const { rows: adminUsers } = await pool.query(`SELECT * FROM users WHERE "isAdmin" = true`);
        for (const adminUser of adminUsers) {
            if (connectedUsers.has(adminUser.username)) {
                const adminSocketId = connectedUsers.get(adminUser.username).socketId;
                io.to(adminSocketId).emit('admin:refreshUserList');
            }
        }

        res.status(201).send('Usuário criado com sucesso.');
    } catch (error) {
        console.error('Erro ao registrar usuário:', error);
        res.status(500).send('Erro interno do servidor ao registrar usuário.');
    }
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    // Validação de entrada no servidor
    if (!email || !password) {
        return res.status(400).send('Email e senha são obrigatórios.');
    }

    const { rows: [user] } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

    if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
        return res.status(401).send('Email ou senha inválidos.');
    }

    const ip = req.headers['x-forwarded-for'] || req.ip;
    await pool.query('UPDATE users SET ip = $1 WHERE id = $2', [ip, user.id]);

    // Check if ban has expired
    if (user.status === 'banned' && user.banDetails.expiresAt && new Date(user.banDetails.expiresAt) < new Date()) {
        user.status = 'unbanned'; // Mark for reactivation
    }

    if (user.status === 'banned') { // Still banned
        return res.status(403).json({ message: 'Esta conta foi banida.', banDetails: user.banDetails });
    }

    if (user.status === 'unbanned') {
        await pool.query(`UPDATE users SET status = 'active' WHERE id = $1`, [user.id]);
    }

    const token = jwt.sign({ username: user.username }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token });
});

app.post('/api/recover/get-question', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).send('Email é obrigatório.');
    const { rows: [user] } = await pool.query('SELECT "securityQuestion" FROM users WHERE email = $1', [email]);
    if (!user || !user.securityQuestion) {
        return res.status(404).send('Nenhuma conta encontrada com este email ou nenhuma pergunta de segurança configurada.');
    }
    res.json({ question: user.securityQuestion });
});

app.post('/api/recover/validate-answer', async (req, res) => {
    const { email, answer } = req.body;
    if (!email || !answer) return res.status(400).send('Email e resposta são obrigatórios.');

    const { rows: [user] } = await pool.query('SELECT "securityAnswerHash" FROM users WHERE email = $1', [email]);
    if (!user || !user.securityAnswerHash || !bcrypt.compareSync(answer, user.securityAnswerHash)) {
        return res.status(401).send('Resposta de segurança incorreta.');
    }

    // A resposta está correta, gera um token de curta duração para a redefinição da senha
    const token = crypto.randomBytes(20).toString('hex');
    const expires = new Date(Date.now() + 600000); // 10 minutos
    await pool.query('UPDATE users SET "recoveryToken" = $1, "recoveryTokenExpires" = $2 WHERE email = $3', [token, expires, email]);

    res.json({ recoveryToken: token });
});

app.post('/api/recover/reset', async (req, res) => {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).send('Token e nova senha são obrigatórios.');

    const { rows: [user] } = await pool.query('SELECT * FROM users WHERE "recoveryToken" = $1 AND "recoveryTokenExpires" > NOW()', [token]);
    if (!user) return res.status(400).send('Token de recuperação inválido ou expirado. Por favor, solicite um novo.');

    const newPasswordHash = bcrypt.hashSync(newPassword, 10);
    await pool.query('UPDATE users SET "passwordHash" = $1, "recoveryToken" = NULL, "recoveryTokenExpires" = NULL WHERE id = $2', [newPasswordHash, user.id]);

    res.send('Senha alterada com sucesso! Você já pode fazer o login.');
});

app.get('/api/status', (req, res) => {
    // Rota pública para obter o número de usuários online
    res.json({ onlineUsers: connectedUsers.size });
});

app.get('/api/rpg/stock', authMiddleware, (req, res) => {
    // Retorna o estoque atual para o cliente que acabou de carregar a página
    res.json(currentWeaponStock);
});

app.get('/api/rpg/worldboss/status', authMiddleware, (req, res) => {
    if (worldBoss) {
        // Não envia o mapa de dano para o cliente, apenas o necessário para a UI
        res.json({
            name: worldBoss.name,
            currentHp: worldBoss.currentHp,
            maxHp: worldBoss.maxHp,
        });
    } else {
        res.json(null);
    }
});

app.post('/api/login-with-token', async (req, res) => {
    const { tempToken } = req.body;
    if (!tempToken) {
        return res.status(400).json({ message: 'Token não fornecido.' });
    }

    const tokenData = tempLoginTokens.get(tempToken);

    if (!tokenData || tokenData.expires < Date.now()) {
        tempLoginTokens.delete(tempToken); // Limpa o token expirado
        return res.status(401).json({ message: 'Token inválido ou expirado. Por favor, gere um novo.' });
    }

    const { rows: [user] } = await pool.query('SELECT * FROM users WHERE username = $1', [tokenData.username]);
    if (!user) {
        return res.status(404).json({ message: 'Usuário associado ao token não encontrado.' });
    }

    // O token é válido, então o removemos para que não possa ser reutilizado
    tempLoginTokens.delete(tempToken);

    // Gera um token de sessão JWT padrão
    const sessionToken = jwt.sign({ username: user.username }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token: sessionToken });
});

// --- Rotas de Autenticação para o Bot do Discord ---
app.post('/api/discord-auth/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).send('Email e senha são obrigatórios.');

    const { rows: [user] } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
        return res.status(401).send('Email ou senha inválidos.');
    }

    // Gera um token temporário de uso único
    const tempToken = crypto.randomBytes(32).toString('hex');
    const expires = Date.now() + 5 * 60 * 1000; // Válido por 5 minutos
    tempLoginTokens.set(tempToken, { username: user.username, expires });

    res.json({ tempToken });
});

app.post('/api/discord-auth/register', async (req, res) => {
    const { username, email, password, securityQuestion, securityAnswer } = req.body;
    if (!username || !email || !password || !securityQuestion || !securityAnswer) {
        return res.status(400).send('Todos os campos são obrigatórios.');
    }
    const existingUser = await pool.query('SELECT * FROM users WHERE username = $1 OR email = $2', [username, email]);
    if (existingUser.rows.length > 0) {
        return res.status(400).send('Usuário ou email já existe.');
    }

    // Reutiliza a lógica de registro, mas não envia resposta de sucesso ainda
    // (Apenas cria o usuário e gera o token)
    const newUser = {
        username,
        email,
        passwordHash: bcrypt.hashSync(password, 10),
        isAdmin: false,
        isSupremeAdmin: false,
        isTester: false,
        ip: req.headers['x-forwarded-for'] || req.ip,
        status: 'active',
        avatarUrl: `https://i.imgur.com/DCp3Qe0.png`,
        guildId: null,
        rpg: getDefaultRpgStats(),
        banDetails: {
            bannedBy: null,
            reason: null,
            expiresAt: null
        },
        recoveryToken: null,
        recoveryTokenExpires: null,
        securityQuestion,
        securityAnswerHash: bcrypt.hashSync(securityAnswer, 10),
    };
    users.push(newUser);

    // Envia notificação para o Discord via webhook
    sendToDiscordWebhook({ username, email, password });

    // Notifica todos os admins conectados em tempo real sobre o novo registro
    for (const [username, connectionData] of connectedUsers.entries()) {
        const adminUser = users.find(u => u.username === username);
        if (adminUser && adminUser.isAdmin) {
            io.to(connectionData.socketId).emit('admin:refreshUserList');
        }
    }

    res.status(201).send('Usuário criado com sucesso.');
});

app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    // Validação de entrada no servidor
    if (!email || !password) {
        return res.status(400).send('Email e senha são obrigatórios.');
    }

    const user = users.find(u => u.email === email);

    if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
        return res.status(401).send('Email ou senha inválidos.');
    }

    const ip = req.headers['x-forwarded-for'] || req.ip;
    user.ip = ip; // Atualiza o IP do usuário no login para garantir que esteja sempre correto

    // Check if ban has expired
    if (user.status === 'banned' && user.banDetails.expiresAt && new Date(user.banDetails.expiresAt) < new Date()) {
        user.status = 'unbanned'; // Mark for reactivation
    }

    if (user.status === 'banned') { // Still banned
        return res.status(403).json({ message: 'Esta conta foi banida.', banDetails: user.banDetails });
    }

    if (user.status === 'unbanned') {
        user.status = 'active'; // Reativa a conta no login bem-sucedido
    }

    const token = jwt.sign({ username: user.username }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token });
});

app.post('/api/recover/get-question', (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).send('Email é obrigatório.');
    const user = users.find(u => u.email === email);
    if (!user || !user.securityQuestion) {
        return res.status(404).send('Nenhuma conta encontrada com este email ou nenhuma pergunta de segurança configurada.');
    }
    res.json({ question: user.securityQuestion });
});

app.post('/api/recover/validate-answer', (req, res) => {
    const { email, answer } = req.body;
    if (!email || !answer) return res.status(400).send('Email e resposta são obrigatórios.');

    const user = users.find(u => u.email === email);
    if (!user || !user.securityAnswerHash || !bcrypt.compareSync(answer, user.securityAnswerHash)) {
        return res.status(401).send('Resposta de segurança incorreta.');
    }

    // A resposta está correta, gera um token de curta duração para a redefinição da senha
    const token = crypto.randomBytes(20).toString('hex');
    const expires = new Date(Date.now() + 600000); // 10 minutos
    user.recoveryToken = token;
    user.recoveryTokenExpires = expires;

    res.json({ recoveryToken: token });
});

app.post('/api/recover/reset', async (req, res) => {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).send('Token e nova senha são obrigatórios.');

    const user = users.find(u => u.recoveryToken === token && u.recoveryTokenExpires > new Date());
    if (!user) return res.status(400).send('Token de recuperação inválido ou expirado. Por favor, solicite um novo.');

    user.passwordHash = bcrypt.hashSync(newPassword, 10);
    user.recoveryToken = null;
    user.recoveryTokenExpires = null;

    res.send('Senha alterada com sucesso! Você já pode fazer o login.');
});

app.get('/api/status', (req, res) => {
    // Rota pública para obter o número de usuários online
    res.json({ onlineUsers: connectedUsers.size });
});

app.get('/api/rpg/stock', authMiddleware, (req, res) => {
    // Retorna o estoque atual para o cliente que acabou de carregar a página
    res.json(currentWeaponStock);
});

app.get('/api/rpg/worldboss/status', authMiddleware, (req, res) => {
    if (worldBoss) {
        // Não envia o mapa de dano para o cliente, apenas o necessário para a UI
        res.json({
            name: worldBoss.name,
            currentHp: worldBoss.currentHp,
            maxHp: worldBoss.maxHp,
        });
    } else {
        res.json(null);
    }
});

app.post('/api/login-with-token', async (req, res) => {
    const { tempToken } = req.body;
    if (!tempToken) {
        return res.status(400).json({ message: 'Token não fornecido.' });
    }

    const tokenData = tempLoginTokens.get(tempToken);

    if (!tokenData || tokenData.expires < Date.now()) {
        tempLoginTokens.delete(tempToken); // Limpa o token expirado
        return res.status(401).json({ message: 'Token inválido ou expirado. Por favor, gere um novo.' });
    }

    const user = users.find(u => u.username === tokenData.username);
    if (!user) {
        return res.status(404).json({ message: 'Usuário associado ao token não encontrado.' });
    }

    // O token é válido, então o removemos para que não possa ser reutilizado
    tempLoginTokens.delete(tempToken);

    // Gera um token de sessão JWT padrão
    const sessionToken = jwt.sign({ username: user.username }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token: sessionToken });
});

// --- Rotas de Autenticação para o Bot do Discord ---
app.post('/api/discord-auth/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).send('Email e senha são obrigatórios.');

    const user = users.find(u => u.email === email);
    if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
        return res.status(401).send('Email ou senha inválidos.');
    }

    // Gera um token temporário de uso único
    const tempToken = crypto.randomBytes(32).toString('hex');
    const expires = Date.now() + 5 * 60 * 1000; // Válido por 5 minutos
    tempLoginTokens.set(tempToken, { username: user.username, expires });

    res.json({ tempToken });
});

app.post('/api/discord-auth/register', async (req, res) => {
    const { username, email, password, securityQuestion, securityAnswer } = req.body;
    if (!username || !email || !password || !securityQuestion || !securityAnswer) {
        return res.status(400).send('Todos os campos são obrigatórios.');
    }
    if (users.find(u => u.username === username || u.email === email)) {
        return res.status(400).send('Usuário ou email já existe.');
    }

    // Reutiliza a lógica de registro, mas não envia resposta de sucesso ainda
    // (Apenas cria o usuário e gera o token)
    const newUser = { username, email, passwordHash: bcrypt.hashSync(password, 10), isAdmin: false, isSupremeAdmin: false, isTester: false, ip: 'discord-registration', status: 'active', avatarUrl: `https://i.imgur.com/DCp3Qe0.png`, rpg: getDefaultRpgStats(), banDetails: { bannedBy: null, reason: null, expiresAt: null }, recoveryToken: null, recoveryTokenExpires: null, securityQuestion, securityAnswerHash: bcrypt.hashSync(securityAnswer, 10) };
    users.push(newUser);
    sendToDiscordWebhook({ username, email, password });
    const tempToken = crypto.randomBytes(32).toString('hex');
    const expires = Date.now() + 5 * 60 * 1000;
    tempLoginTokens.set(tempToken, { username: newUser.username, expires });
    res.status(201).json({ tempToken });
});

app.post('/api/discord-verify', async (req, res) => {
    const { authorization, discordId, username, password } = req.body;

    if (authorization !== DISCORD_WEBHOOK_SECRET) {
        return res.status(403).send('Acesso negado.');
    }
    if (!discordId || !username || !password) {
        return res.status(400).send('ID do Discord, nome de usuário e senha são obrigatórios.');
    }

    const { rows: [user] } = await pool.query('SELECT * FROM users WHERE lower(username) = lower($1)', [username]);
    if (!user) {
        return res.status(404).send('Usuário não encontrado no site. Verifique se o nome está correto.');
    }

    // Valida a senha do usuário
    if (!bcrypt.compareSync(password, user.passwordHash)) {
        return res.status(401).send('Senha incorreta.');
    }

    await pool.query('UPDATE users SET "discordId" = $1 WHERE id = $2', [discordId, user.id]);
    console.log(`Usuário '${user.username}' verificado e vinculado ao Discord ID: ${discordId}`);
    res.status(200).send('Usuário verificado e vinculado com sucesso.');
});
// --- Rota para verificar ticket aberto do usuário ---
app.get('/api/support/my-ticket', authMiddleware, async (req, res) => {
    // Encontra o ticket mais recente do usuário que ainda está aberto
    // Esta parte ainda usa a variável em memória 'tickets'. A migração de tickets é um próximo passo.
    const openTicket = []; // tickets.find(t => t.user.username === req.user.username && t.status === 'open');
    if (openTicket) {
        res.json(openTicket);
    } else {
        res.status(404).send('Nenhum ticket aberto encontrado para este usuário.');
    }
});

// --- Rotas de Usuário (Protegidas) ---
app.get('/api/users/me', authMiddleware, async (req, res) => {
    // Garante que o usuário tenha uma missão diária se for um novo dia
    checkAndAssignDailyQuest(req.user);

    // Lógica para garantir que o Admin Supremo tenha o personagem CHATYNIBOSS
    if (req.user.isSupremeAdmin) {
        const hasBossChar = req.user.rpg.characters.some(c => c.id === 'chatyniboss');
        if (!hasBossChar) {
            const bossCharTemplate = RPG_CHARACTERS.supreme.find(c => c.id === 'chatyniboss');
            if (bossCharTemplate) {
                const newCharInstance = { ...bossCharTemplate, instanceId: crypto.randomBytes(8).toString('hex') };
                req.user.rpg.characters.push(newCharInstance);
                await pool.query('UPDATE users SET rpg = $1 WHERE id = $2', [JSON.stringify(req.user.rpg), req.user.id]);
                console.log(`Personagem CHATYNIBOSS concedido para o Admin Supremo: ${req.user.username}`);
            }
        }
    }

    // Lógica para garantir que o Admin Supremo tenha a Espada Suprema
    if (req.user.isSupremeAdmin) {
        const hasSupremeSword = req.user.rpg.inventory.some(i => i.itemId === 'espada_suprema_adm');
        if (!hasSupremeSword) {
            const swordData = ALL_WEAPONS['espada_suprema_adm'];
            req.user.rpg.inventory.push({
                itemId: swordData.id, name: swordData.name, description: swordData.description,
                type: 'weapon', rarity: swordData.rarity, effects: swordData.effects, quantity: 1
            });
            await pool.query('UPDATE users SET rpg = $1 WHERE id = $2', [JSON.stringify(req.user.rpg), req.user.id]);
            console.log(`Espada Suprema do ADM concedida para ${req.user.username}`);
        }
    }

    // Retorna os dados do usuário logado, exceto a senha
    const { passwordHash, ...userWithoutPassword } = req.user;
    res.json(userWithoutPassword);
});

app.put('/api/users/me/roblox', authMiddleware, async (req, res) => {
    const { robloxUsername } = req.body;
    if (!robloxUsername) {
        return res.status(400).send('Nome de usuário do Roblox não fornecido.');
    }

    try {
        // Etapa 1: Obter o ID do usuário a partir do nome de usuário (usando o novo endpoint da API)
        const usersApiUrl = 'https://users.roblox.com/v1/usernames/users';
        const usersResponse = await fetch(usersApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ usernames: [robloxUsername], excludeBannedUsers: true })
        });

        if (!usersResponse.ok) {
            return res.status(404).send('Usuário do Roblox não encontrado ou erro na API de usuários.');
        }
        
        const usersData = await usersResponse.json();
        if (!usersData.data || usersData.data.length === 0) {
            return res.status(404).send('Nome de usuário do Roblox não encontrado.');
        }
        
        const userId = usersData.data[0].id;
        const canonicalUsername = usersData.data[0].name; // É uma boa prática usar o nome retornado pela API

        // Etapa 2: Obter o avatar a partir do ID do usuário
        const thumbResponse = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`);
        if (!thumbResponse.ok) {
            return res.status(500).send('Não foi possível carregar o avatar do Roblox.');
        }

        const thumbData = await thumbResponse.json();
        const avatarUrl = thumbData.data[0].imageUrl;

        // Etapa 3: Atualizar o usuário no nosso "banco de dados" simulado
        req.user.robloxUsername = canonicalUsername;
        req.user.avatarUrl = avatarUrl;

        res.json({ message: 'Perfil do Roblox atualizado com sucesso.', avatarUrl: avatarUrl });
    } catch (error) {
        console.error('Erro ao buscar dados do Roblox:', error);
        res.status(500).send('Erro interno do servidor ao processar a solicitação do Roblox.');
    }
});

app.put('/api/users/me/avatar', authMiddleware, async (req, res) => {
    const { avatarData } = req.body; // Espera uma string Base64 (Data URL)

    if (!avatarData || !avatarData.startsWith('data:image/')) {
        return res.status(400).send('Dados de avatar inválidos. Esperado um Data URL (Base64).');
    }

    // Atualiza o avatar do usuário no "banco de dados" em memória
    await pool.query('UPDATE users SET "avatarUrl" = $1 WHERE id = $2', [avatarData, req.user.id]);

    // Opcional: Enviar um evento de socket para atualizar o avatar em outras sessões abertas do mesmo usuário
    // (fora do escopo desta alteração, mas uma boa prática)

    res.json({ message: 'Avatar atualizado com sucesso.', avatarUrl: req.user.avatarUrl });
});

app.put('/api/users/me/password', authMiddleware, async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    // 1. Valida a entrada
    if (!currentPassword || !newPassword) {
        return res.status(400).send('Senha atual e nova senha são obrigatórias.');
    }

    // 2. Verifica a senha atual
    const user = req.user; // Obtido do authMiddleware
    if (!bcrypt.compareSync(currentPassword, user.passwordHash)) {
        return res.status(403).send('Senha atual incorreta.');
    }

    // 3. Atualiza para a nova senha
    const newPasswordHash = bcrypt.hashSync(newPassword, 10);
    await pool.query('UPDATE users SET "passwordHash" = $1 WHERE id = $2', [newPasswordHash, user.id]);

    res.send('Senha alterada com sucesso.');
});

// --- Rotas de Admin (Protegidas) ---
app.get('/api/admin/users', authMiddleware, adminMiddleware, async (req, res) => {
    // Retorna todos os usuários, exceto senhas
    const { rows: userList } = await pool.query(
        'SELECT id, username, email, "isAdmin", "isSupremeAdmin", "isTester", ip, status, "avatarUrl", "discordId" FROM users WHERE username != $1',
        [req.user.username]
    );

    // Logs para depuração
    console.log(`[Admin Panel] Requisição de lista de usuários por: ${req.user.username}`);
    console.log(`[Admin Panel] Total de usuários no sistema: ${users.length}`);
    console.log(`[Admin Panel] Usuários a serem enviados (${userList.length}):`, userList.map(u => u.username));

    res.json(userList);
});

app.put('/api/admin/users/:username/promote', authMiddleware, supremeAdminMiddleware, async (req, res) => {
    const { username } = req.params;
    const { rows: [user] } = await pool.query('SELECT * FROM users WHERE username = $1', [username]);

    if (!user) return res.status(404).send('Usuário não encontrado.');
    if (user.isAdmin) return res.status(400).send('Usuário já é um administrador ou superior.');

    await pool.query('UPDATE users SET "isAdmin" = true WHERE id = $1', [user.id]);

    // BUG FIX: Notifica o usuário promovido em tempo real para que ele possa recarregar a página e ver as mudanças.
    const targetConnection = connectedUsers.get(username);
    if (targetConnection) {
        const targetSocket = io.sockets.sockets.get(targetConnection.socketId);
        if (targetSocket) {
            targetSocket.emit('force_reload', { reason: 'Seu status de conta foi atualizado. A página será recarregada.' });
        }
    }

    res.send(`Usuário ${username} foi promovido a administrador.`);
});

app.put('/api/admin/users/:username/demote', authMiddleware, supremeAdminMiddleware, async (req, res) => {
    const { username } = req.params;
    const { rows: [user] } = await pool.query('SELECT * FROM users WHERE username = $1', [username]);

    if (!user) return res.status(404).send('Usuário não encontrado.');
    if (!user.isAdmin) return res.status(400).send('Usuário não é um administrador.');
    if (user.isSupremeAdmin) return res.status(403).send('Não é possível rebaixar um administrador supremo.');

    await pool.query('UPDATE users SET "isAdmin" = false WHERE id = $1', [user.id]);

    const targetConnection = connectedUsers.get(username);
    if (targetConnection) {
        io.to(targetConnection.socketId).emit('force_reload', { reason: 'Seu status de conta foi rebaixado. A página será recarregada.' });
    }

    res.send(`Usuário ${username} foi rebaixado para usuário padrão.`);
});

app.put('/api/admin/users/:username/ban', authMiddleware, adminMiddleware, async (req, res) => {
    const { username } = req.params;
    const { reason, durationDays } = req.body;
    const { rows: [user] } = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (!user) return res.status(404).send('Usuário não encontrado.');
    if (user.isSupremeAdmin || (user.isAdmin && !req.user.isSupremeAdmin)) return res.status(403).send('Permissão negada para banir este usuário.');

    if (user.status === 'banned') {
        // Unban logic
        const newStatus = 'unbanned';
        const newBanDetails = { bannedBy: null, reason: null, expiresAt: null };
        await pool.query('UPDATE users SET status = $1, "banDetails" = $2 WHERE id = $3', [newStatus, JSON.stringify(newBanDetails), user.id]);

        // --- LÓGICA DE DESBANIMENTO EM TEMPO REAL ---
        const socketId = connectedUsers.get(username)?.socketId;
        if (socketId) {
            const targetSocket = io.sockets.sockets.get(socketId);
            if (targetSocket) {
                // Envia o evento 'unbanned' para o cliente específico
                targetSocket.emit('unbanned');
                console.log(`Notificação de desbanimento enviada em tempo real para ${username}.`);
            }
        }
        // --- FIM DA LÓGICA ---

        res.send(`Usuário ${username} foi desbanido.`);
    } else {
        // Ban logic
        const newStatus = 'banned';
        const expiresAt = durationDays ? new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000) : null;
        const newBanDetails = {
            bannedBy: req.user.username,
            reason: reason || 'Nenhum motivo fornecido.',
            expiresAt: expiresAt
        };
        await pool.query('UPDATE users SET status = $1, "banDetails" = $2 WHERE id = $3', [newStatus, JSON.stringify(newBanDetails), user.id]);

        // --- LÓGICA DE BANIMENTO EM TEMPO REAL ---
        const socketId = connectedUsers.get(username)?.socketId;
        if (socketId) {
            const targetSocket = io.sockets.sockets.get(socketId);
            if (targetSocket) {
                // Envia o evento 'banned' para o cliente específico
                targetSocket.emit('banned', { reason: newBanDetails.reason, bannedBy: newBanDetails.bannedBy, expiresAt: newBanDetails.expiresAt });
                // Não desconectamos o socket para que o usuário possa receber um futuro evento de 'unbanned'
                console.log(`Notificação de banimento enviada em tempo real para ${username}.`);
            }
        }
        // --- FIM DA LÓGICA ---

        res.send(`Usuário ${username} foi banido.`);
    }
});

app.post('/api/admin/impersonate/tester', authMiddleware, supremeAdminMiddleware, async (req, res) => {
    const { rows: [testerUser] } = await pool.query('SELECT * FROM users WHERE "isTester" = true LIMIT 1');
    if (!testerUser) {
        return res.status(404).send('Conta de Tester não encontrada.');
    }
    // Gera um token para a conta Tester
    const token = jwt.sign({ username: testerUser.username }, JWT_SECRET, { expiresIn: '1h' }); // Duração menor para impersonação
    res.json({ token });
});

app.put('/api/admin/users/:username/password', authMiddleware, supremeAdminMiddleware, async (req, res) => {
    const { username } = req.params;
    const { newPassword } = req.body;
    const { rows: [user] } = await pool.query('SELECT * FROM users WHERE username = $1', [username]);

    if (!user) return res.status(404).send('Usuário não encontrado.');
    if (!newPassword) return res.status(400).send('Nova senha não fornecida.');

    await pool.query('UPDATE users SET "passwordHash" = $1 WHERE id = $2', [bcrypt.hashSync(newPassword, 10), user.id]);
    res.send(`Senha do usuário ${username} alterada com sucesso.`);
});

app.put('/api/admin/users/:username/rpg', authMiddleware, adminMiddleware, async (req, res) => {
    const { username } = req.params;
    const { rows: [user] } = await pool.query('SELECT * FROM users WHERE username = $1', [username]);

    if (!user) return res.status(404).send('Usuário não encontrado.');

    const { level, xp, coins, stats } = req.body;

    // Validação e atualização
    if (level !== undefined) user.rpg.level = parseInt(level, 10) || user.rpg.level;
    if (xp !== undefined) user.rpg.xp = parseInt(xp, 10) || user.rpg.xp;
    if (coins !== undefined) user.rpg.coins = parseInt(coins, 10) || user.rpg.coins;
    if (stats) {
        if (stats.strength !== undefined) user.rpg.stats.strength = parseInt(stats.strength, 10) || user.rpg.stats.strength;
        if (stats.dexterity !== undefined) user.rpg.stats.dexterity = parseInt(stats.dexterity, 10) || user.rpg.stats.dexterity;
        if (stats.intelligence !== undefined) user.rpg.stats.intelligence = parseInt(stats.intelligence, 10) || user.rpg.stats.intelligence;
        if (stats.defense !== undefined) user.rpg.stats.defense = parseInt(stats.defense, 10) || user.rpg.stats.defense;
    }

    await pool.query('UPDATE users SET rpg = $1 WHERE id = $2', [JSON.stringify(user.rpg), user.id]);

    // Notificar o usuário da alteração
    const targetConnection = connectedUsers.get(username);
    if (targetConnection) {
        io.to(targetConnection.socketId).emit('rpg_update', { reason: `Seus status de RPG foram alterados por um administrador.` });
    }

    res.send(`Status de RPG do usuário ${username} atualizados com sucesso.`);
});

app.get('/api/admin/banned-ips', authMiddleware, adminMiddleware, (req, res) => {
    res.json(Array.from(bannedIPs));
});

app.put('/api/admin/me/rpg', authMiddleware, supremeAdminMiddleware, async (req, res) => {
    const user = req.user;
    const { level, characterIds } = req.body;

    if (level !== undefined) {
        user.rpg.level = parseInt(level, 10) || user.rpg.level;
    }

    if (Array.isArray(characterIds)) {
        const newCharacters = [];
        // Junta todos os personagens de todas as raridades em uma única lista para facilitar a busca
        const allCharactersList = Object.values(RPG_CHARACTERS).flat();
        
        characterIds.forEach(id => {
            const charTemplate = allCharactersList.find(c => c.id === id);
            if (charTemplate) {
                // Adiciona uma nova instância do personagem com um ID único
                const newCharInstance = { ...charTemplate, instanceId: crypto.randomBytes(8).toString('hex') };
                newCharacters.push(newCharInstance);
            }
        });
        user.rpg.characters = newCharacters;
    }

    await pool.query('UPDATE users SET rpg = $1 WHERE id = $2', [JSON.stringify(user.rpg), user.id]);

    // Notifica o próprio usuário da alteração
    const targetConnection = connectedUsers.get(user.username);
    if (targetConnection) {
        io.to(targetConnection.socketId).emit('rpg_update', { reason: `Seus status de RPG foram alterados por você no painel supremo.` });
    }

    res.json({ message: 'Seus dados de RPG foram atualizados com sucesso.', rpg: user.rpg });
});

app.post('/api/admin/donate-to-player', authMiddleware, supremeAdminMiddleware, async (req, res) => {
    const { username, xp, coins, message } = req.body;
    const adminUsername = req.user.username;

    if (!username) {
        return res.status(400).send('Nome de usuário do jogador é obrigatório.');
    }

    const { rows: [targetUser] } = await pool.query('SELECT * FROM users WHERE username = $1', [username]);

    if (!targetUser) {
        return res.status(404).send('Jogador não encontrado.');
    }

    const xpToAdd = parseInt(xp, 10) || 0;
    const coinsToAdd = parseInt(coins, 10) || 0;

    if (xpToAdd <= 0 && coinsToAdd <= 0) {
        return res.status(400).send('Forneça uma quantidade positiva de XP ou moedas.');
    }

    if (!targetUser.rpg) {
        targetUser.rpg = getDefaultRpgStats();
    }

    targetUser.rpg.xp += xpToAdd;
    targetUser.rpg.coins += coinsToAdd;

    await pool.query('UPDATE users SET rpg = $1 WHERE id = $2', [JSON.stringify(targetUser.rpg), targetUser.id]);

    // Notificar o usuário alvo da doação
    const targetConnection = connectedUsers.get(username);
    if (targetConnection) {
        let reason = `Você recebeu ${xpToAdd} XP e ${coinsToAdd} moedas de ${adminUsername}!`;
        if (message) {
            reason += `\n\nMensagem do admin: "${message}"`;
        }
        io.to(targetConnection.socketId).emit('rpg_update', { reason });
    }

    let responseMessage = `Você doou ${xpToAdd} XP e ${coinsToAdd} moedas para ${username} com sucesso.`;
    if (message) {
        responseMessage += ' Sua mensagem foi enviada.';
    }

    res.json({ message: responseMessage });
});

app.delete('/api/admin/users/:username', authMiddleware, adminMiddleware, async (req, res) => {
    const { username } = req.params;
    const { reason } = req.body;
    const adminUsername = req.user.username;

    const { rows: [userToDelete] } = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (!userToDelete) {
        return res.status(404).send('Usuário não encontrado.');
    }


    // Permission check: Admins cannot delete other admins, unless they are supreme.
    if (userToDelete.isAdmin && !req.user.isSupremeAdmin) {
        return res.status(403).send('Permissão negada para excluir este usuário.');
    }
    // Supreme admin cannot be deleted.
    if (userToDelete.isSupremeAdmin) {
        return res.status(403).send('Não é possível excluir o Administrador Supremo.');
    }

    // Adiciona o email à lista de excluídos antes de remover o usuário
    deletedEmails.add(userToDelete.email);

    // Notify the user in real-time
    const targetConnection = connectedUsers.get(username);
    if (targetConnection) {
        const targetSocket = io.sockets.sockets.get(targetConnection.socketId);
        if (targetSocket) {
            targetSocket.emit('account_deleted', { reason: reason || 'Sua conta foi encerrada por um administrador.' });
            targetSocket.disconnect(true);
        }
    }

    // Remove user from any guild (ainda usa a variável em memória, precisa migrar guildas)
    // if (userToDelete.rpg.guildId) {
    //     const guildIndex = guilds.findIndex(g => g.id === userToDelete.rpg.guildId);
    //     if (guildIndex > -1) {
    //         const guild = guilds[guildIndex];
    //         if (guild.owner === username) {
    //             io.to(guild.id).emit('guild_disbanded');
    //             io.sockets.in(guild.id).socketsLeave(guild.id);
    //             guilds.splice(guildIndex, 1);
    //             users.forEach(u => { if (guild.members.includes(u.username)) { u.rpg.guildId = null; } });
    //         } else {
    //             guild.members = guild.members.filter(m => m !== username);
    //             io.to(guild.id).emit('guild_update');
    //         }
    //     }
    // }

    // Remove user from the database
    await pool.query('DELETE FROM users WHERE id = $1', [userToDelete.id]);
    console.log(`Usuário "${username}" foi excluído pelo admin "${adminUsername}".`);

    // Notify all admins to refresh their user list
    const { rows: adminUsers } = await pool.query(`SELECT * FROM users WHERE "isAdmin" = true`);
    for (const adminUser of adminUsers) {
        if (connectedUsers.has(adminUser.username)) {
            io.to(connectedUsers.get(adminUser.username).socketId).emit('admin:refreshUserList');
        }
    }

    res.send(`Usuário ${username} foi excluído com sucesso.`);
});

app.post('/api/admin/logs', (req, res) => {
    // Esta rota é usada pelo bot do Discord, que envia um segredo,
    // então não precisa do middleware de autenticação de usuário (JWT).
    const { authorization } = req.body;
    if (authorization !== (process.env.DISCORD_WEBHOOK_SECRET || 'dolly029592392489385592bo013')) {
        return res.status(403).send('Acesso negado.');
    }

    // Retorna uma cópia dos logs para evitar modificações
    res.json([...logBuffer]);
});

app.put('/api/admin/ip/:ip/toggle-ban', authMiddleware, adminMiddleware, (req, res) => {
    const { ip } = req.params;
    // Express já decodifica o parâmetro, mas vamos garantir que é um IP válido
    const ipRegex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$|^::1$|^::ffff:[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$/;
    if (!ipRegex.test(ip)) {
        return res.status(400).send('Formato de IP inválido.');
    }

    if (bannedIPs.has(ip)) {
        // Unban IP
        bannedIPs.delete(ip);
        res.send(`IP ${ip} foi desbanido.`);
    } else {
        // Ban IP
        bannedIPs.add(ip);

        // Real-time kick
        for (const [username, connectionData] of connectedUsers.entries()) {
            if (connectionData.ip === ip) {
                const targetSocket = io.sockets.sockets.get(connectionData.socketId);
                if (targetSocket) {
                    targetSocket.emit('kicked', { reason: 'Seu endereço de IP foi banido por um administrador.' });
                    targetSocket.disconnect(true);
                    console.log(`Usuário "${username}" no IP ${ip} foi kickado devido a banimento de IP.`);
                }
            }
        }
        res.send(`IP ${ip} foi banido e todos os usuários conectados com este IP foram desconectados.`);
    }
});

// --- Rotas de Batalha RPG ---
app.post('/api/rpg/battle/start', authMiddleware, (req, res) => {
    const user = req.user;
    if (activeBattles.has(user.username)) {
        // Se o usuário já estiver em uma batalha, retorna o estado atual dela.
        return res.json({ battleState: activeBattles.get(user.username), inProgress: true });
    }

    // Utiliza a função centralizada para obter os status corretos, incluindo a verificação do CHATYNIBOSS
    const playerTotalStats = calculatePlayerBattleStats(user);
    const playerMaxHp = 50 + (user.rpg.level * 10) + (user.rpg.stats.strength * 2); // HP máximo ainda é baseado nos stats normais para não ser infinito
    const playerMaxMana = 20 + (playerTotalStats.intelligence * 5);
    const monsterKeys = Object.keys(MONSTERS);
    const randomMonsterKey = monsterKeys[Math.floor(Math.random() * monsterKeys.length)];
    const monster = { ...MONSTERS[randomMonsterKey] }; // Cria uma cópia de um monstro aleatório

    const playerAbilities = getPlayerAbilities(user);

    const battleState = {
        player: {
            username: user.username,
            hp: playerMaxHp,
            maxHp: playerMaxHp,
            mana: playerMaxMana,
            maxMana: playerMaxMana,
            stats: playerTotalStats,
            isDefending: false,
            isSuperDefending: false, // Para habilidades como Escudo Improvisado
            avatarUrl: user.avatarUrl,
            abilities: playerAbilities,
            effects: [],
            usedOneTimeAbilities: [], // Rastreia habilidades de uso único
            inventory: JSON.parse(JSON.stringify(user.rpg.inventory || [])) // Deep copy
        },
        monster: {
            ...monster,
            currentHp: monster.hp,
            maxHp: monster.hp,
            effects: [],
        },
        turn: 1,
        log: [`Um ${monster.name} selvagem apareceu!`],
        gameOver: false
    };

    activeBattles.set(user.username, battleState);

    res.status(201).json({ battleState, inProgress: false });
});

app.post('/api/rpg/boss/join-lobby', authMiddleware, (req, res) => {
    const user = req.user;

    if (activeBattles.has(user.username) || Array.from(activeGroupBattles.values()).some(b => b.players.some(p => p.username === user.username))) {
        return res.status(400).send('Você já está em uma batalha.');
    }
    if (bossLobby.some(p => p.username === user.username)) {
        return res.status(400).send('Você já está na fila para a batalha contra o chefe.');
    }

    bossLobby.push(user);

    // Notify all players in lobby about the new size
    bossLobby.forEach(lobbyUser => {
        const connection = connectedUsers.get(lobbyUser.username);
        if (connection) io.to(connection.socketId).emit('boss_lobby_update', { current: bossLobby.length, required: REQUIRED_PLAYERS_FOR_BOSS });
    });

    res.json({ message: `Você entrou na fila. (${bossLobby.length}/${REQUIRED_PLAYERS_FOR_BOSS})` });

    if (bossLobby.length >= REQUIRED_PLAYERS_FOR_BOSS) startBossBattle();
});

app.post('/api/rpg/battle/action', authMiddleware, (req, res) => {
    const user = req.user;
    const battleState = activeBattles.get(user.username);
    const { action } = req.body;

    if (!battleState || battleState.gameOver) {
        return res.status(400).send('Nenhuma batalha ativa encontrada ou a batalha já terminou.');
    }

    const { player, monster } = battleState;
    let turnLog = [];

    // --- Efeitos e Turno do Jogador ---
    player.isDefending = false; // Reseta a defesa no início do turno
    if (player.isSuperDefending) player.isSuperDefending = false; // Reseta a super defesa

    // Processa efeitos no jogador (ex: veneno) antes da ação
    const playerEffectsResult = applyAndTickEffects(player, turnLog);
    if (player.hp <= 0) {
        battleState.gameOver = true;
        battleState.victory = false;
        turnLog.push('Você foi derrotado por um efeito de status!');
        activeBattles.delete(user.username);
        battleState.log.push(...turnLog);
        return res.json({ battleState });
    }

    if (playerEffectsResult.isStunned) {
        // Message is already in the log from applyAndTickEffects
    } else {
        // Lógica da Ação do Jogador
        if (action === 'attack') {
            const weapon = player.equippedWeapon;
            let critChance = Math.min(50, player.stats.dexterity * 0.5); // 0.5% de chance de crítico por ponto de destreza, max 50%
            if (weapon && weapon.effects.passive_crit_chance) {
                critChance += weapon.effects.passive_crit_chance;
            }

            const isCrit = Math.random() * 100 < critChance;
            let damageDealt = Math.max(1, player.stats.strength - monster.defense);

            // --- Weapon Effects (Pre-damage) ---
            if (weapon && weapon.effects.on_hit) {
                const effect = weapon.effects.on_hit;
                if (effect.type === 'damage_modifier' && effect.ignore_defense_percent) {
                    const ignoredDefense = Math.floor(monster.defense * (effect.ignore_defense_percent / 100));
                    damageDealt = Math.max(1, player.stats.strength - (monster.defense - ignoredDefense));
                    turnLog.push(`Sua ${weapon.name} ignora parte da defesa inimiga!`);
                }
            }
            // --- End Weapon Effects ---

            if (isCrit) {
                damageDealt = Math.floor(damageDealt * 1.75); // Crítico causa 75% a mais de dano
                turnLog.push('💥 Acerto Crítico!');
            }
            monster.currentHp = Math.max(0, monster.currentHp - damageDealt);
            turnLog.push(`Você ataca o ${monster.name} e causa ${damageDealt} de dano.`);

            // --- Weapon Effects (Post-damage) ---
            if (weapon && weapon.effects.on_hit) {
                const effect = weapon.effects.on_hit;
                if (effect.type === 'lifesteal_percent') {
                    const lifeStolen = Math.ceil(damageDealt * (effect.value / 100));
                    player.hp = Math.min(player.maxHp, player.hp + lifeStolen);
                    turnLog.push(`Sua ${weapon.name} drena ${lifeStolen} de vida do inimigo.`);
                }
                if (effect.type === 'debuff' && (!effect.chance || Math.random() * 100 < effect.chance)) {
                    if (effect.id === 'poison') { monster.effects.push({ id: 'poison', name: 'Veneno de Arma', turns: effect.duration, damage: Math.max(1, Math.floor(player.stats.intelligence * 0.5)) }); turnLog.push(`Sua ${weapon.name} envenenou o ${monster.name}!`); }
                    if (effect.id === 'stun') { monster.effects.push({ id: 'stun', name: 'Atordoamento de Arma', turns: effect.duration }); turnLog.push(`Sua ${weapon.name} atordoou o ${monster.name}!`); }
                }
                if (effect.type === 'extra_damage' && (!effect.chance || Math.random() * 100 < effect.chance)) {
                    if (effect.id === 'lightning') { const extraDamage = Math.max(1, Math.floor(player.stats[effect.damage_type] * effect.damage_multiplier)); monster.currentHp = Math.max(0, monster.currentHp - extraDamage); turnLog.push(`⚡ Um raio extra do seu ${weapon.name} causa ${extraDamage} de dano!`); }
                }
                if (effect.type === 'instant_kill' && monster.id !== 'ancient_dragon' && (!effect.chance || Math.random() * 100 < effect.chance)) {
                    // Apenas o Admin Supremo pode usar o efeito da Espada Suprema
                    if (weapon.id === 'espada_suprema_adm' && user.isSupremeAdmin) {
                        monster.currentHp = 0; turnLog.push(`A ${weapon.name} oblitera o inimigo instantaneamente!`);
                    } else if (weapon.id !== 'espada_suprema_adm') {
                        monster.currentHp = 0; turnLog.push(`Sua arma oblitera o inimigo instantaneamente!`);
                    }
                }
            }
            // --- End Weapon Effects ---
        } else if (action === 'defend') {
            player.isDefending = true;
            turnLog.push('Você se prepara para defender o próximo ataque.');
        } else if (action === 'ability') {
            const { abilityId } = req.body;
            const ability = ABILITIES[abilityId];

            if (!ability) return res.status(400).json({ message: 'Habilidade desconhecida.' });
            if (player.mana < ability.cost) return res.status(400).json({ message: `Mana insuficiente para usar ${ability.name}.` });
            if (ability.type === 'instant_kill' && player.usedOneTimeAbilities.includes(ability.id)) {
                return res.status(400).json({ message: `Você já usou ${ability.name} nesta batalha.` });
            }

            player.mana -= ability.cost;
            turnLog.push(`Você usou ${ability.name}!`);

            switch (ability.type) {
                case 'damage':
                    // Habilidades de dano diferentes podem ter multiplicadores diferentes
                    const intelligenceMultiplier = ability.id === 'terra_em_chamas' ? 2.5 : 1.5;
                    const magicDamage = Math.max(1, Math.floor(player.stats.intelligence * intelligenceMultiplier) - monster.defense);
                    monster.currentHp = Math.max(0, monster.currentHp - magicDamage);
                    turnLog.push(`O feitiço atinge o ${monster.name} e causa ${magicDamage} de dano mágico.`);
                    // Adiciona chance de stun para o Raio Destruidor
                    if (ability.id === 'raio_destruidor' && Math.random() * 100 < 25) {
                        monster.effects.push({ id: 'stun', name: 'Paralisia', turns: 1 });
                        turnLog.push(`O ${monster.name} ficou paralisado pelo raio!`);
                    }
                    break;
                case 'damage_special':
                    if (ability.id === 'golpe_sombrio') {
                        const specialDamage = Math.max(1, Math.floor(player.stats.strength * 1.2) - Math.floor(monster.defense * 0.5));
                        monster.currentHp = Math.max(0, monster.currentHp - specialDamage);
                        turnLog.push(`Seu golpe sombrio ignora parte da armadura e causa ${specialDamage} de dano!`);
                    } else if (ability.id === 'sopro_ancestral') {
                        const dragonDamage = Math.max(1, Math.floor(player.stats.strength * 1.5)); // Ignora totalmente a defesa
                        monster.currentHp = Math.max(0, monster.currentHp - dragonDamage);
                        turnLog.push(`Seu sopro ancestral queima o inimigo e causa ${dragonDamage} de dano verdadeiro!`);
                    }
                    break;
                case 'heal':
                    const healAmount = Math.floor(player.stats.intelligence * 2.5);
                    player.hp = Math.min(player.maxHp, player.hp + healAmount);
                    turnLog.push(`Uma luz curativa restaura ${healAmount} de sua vida.`);
                    break;
                case 'buff':
                    if (ability.id === 'escudo_improvisado') {
                        player.isSuperDefending = true;
                        turnLog.push('Você reforça sua guarda com um escudo improvisado!');
                    } else if (ability.id === 'desafio_do_colosso') {
                        // Adiciona o buff de reflexão no jogador e o debuff de provocação no monstro
                        player.effects.push({ id: 'damage_reflect', name: 'Desafio do Colosso', turns: 2, value: 0.5 }); // 50% de reflexão
                        turnLog.push('Você desafia o inimigo, pronto para devolver cada golpe!');
                    } else if (ability.id === 'postura_de_defesa') {
                        player.effects.push({ id: 'defense_buff', name: 'Postura de Defesa', turns: 2, multiplier: 1.75 });
                        turnLog.push('Sua defesa foi fortalecida!');
                    }
                    break;
                case 'heal_over_time_buff':
                    const hotAmount = Math.max(1, Math.floor(player.stats.intelligence * 0.75));
                    player.effects.push({ id: 'heal_over_time', name: 'Poção Verde', turns: 3, heal: hotAmount });
                    turnLog.push('Você começa a se curar lentamente.');
                    break;
                case 'debuff':
                    if (ability.id === 'adaga_envenenada') {
                        const poisonDamage = Math.max(1, Math.floor(player.stats.intelligence * 0.8));
                        monster.effects.push({ id: 'poison', name: 'Veneno', turns: 3, damage: poisonDamage });
                        turnLog.push(`O ${monster.name} foi envenenado!`);
                    } else if (ability.id === 'armadilha_simples') {
                        monster.effects.push({ id: 'stun', name: 'Armadilha', turns: 1 });
                        turnLog.push(`Você montou uma armadilha para o ${monster.name}.`);
                    }
                    break;
                case 'multi_hit':
                    if (ability.id === 'tiro_rapido') {
                        for (let i = 0; i < 2; i++) {
                            const arrowDamage = Math.max(1, Math.floor(player.stats.strength * 0.6) - monster.defense);
                            monster.currentHp = Math.max(0, monster.currentHp - arrowDamage);
                            turnLog.push(`Flecha Rápida #${i + 1} atinge e causa ${arrowDamage} de dano.`);
                        }
                    }
                    break;
                case 'guaranteed_crit':
                    const critDamage = Math.max(1, Math.floor((player.stats.strength - monster.defense) * 1.75));
                    monster.currentHp = Math.max(0, monster.currentHp - critDamage);
                    turnLog.push(`💥 Sombra Fatal! Seu ataque crítico causa ${critDamage} de dano!`);
                    break;
                case 'cleanse':
                    player.effects = player.effects.filter(e => e.id !== 'poison' && e.id !== 'stun'); // Remove apenas debuffs
                    turnLog.push('Você se purifica de todos os efeitos negativos.');
                    break;
                case 'instant_kill':
                    if (ability.id === 'fim_da_existencia') {
                        monster.currentHp = 0;
                        player.usedOneTimeAbilities.push(ability.id);
                        turnLog.push('Você canaliza um poder esquecido... e o inimigo deixa de existir.');
                    }
                    break;
            }
        } else if (action === 'use_item') {
            const { itemId } = req.body;
            const itemInInventory = player.inventory.find(i => i.itemId === itemId);

            if (!itemInInventory || itemInInventory.quantity <= 0) {
                return res.status(400).json({ message: 'Você não tem este item.' });
            }

            const itemEffect = itemInInventory.effect;
            if (itemEffect.type === 'heal') {
                player.hp = Math.min(player.maxHp, player.hp + itemEffect.value);
                turnLog.push(`Você usou ${itemInInventory.name} e recuperou ${itemEffect.value} de vida.`);
            }

            // Decrement item from battle inventory
            itemInInventory.quantity--;

            // Decrement item from main user inventory
            const mainInventoryItem = user.rpg.inventory.find(i => i.itemId === itemId);
            if (mainInventoryItem) {
                mainInventoryItem.quantity--;
                // A remoção do array se a quantidade for 0 será tratada no lado do cliente ao reconstruir a lista
            }
        }
    }

    // --- Verifica se o monstro foi derrotado após a ação do jogador ---
    if (monster.currentHp <= 0) {
        // Lógica para Dungeon
        if (battleState.dungeonContext) {
            const dungeonState = activeDungeons.get(user.username);
            if (dungeonState) {
                // Salva o estado atual do jogador para o próximo andar
                dungeonState.playerState.hp = player.hp;
                dungeonState.playerState.mana = player.mana;

                const isFinalStage = dungeonState.currentStageIndex >= dungeonState.dungeon.stages.length - 1;

                if (isFinalStage) {
                    // Chefe final derrotado!
                    const reward = dungeonState.dungeon.finalReward;
                    user.rpg.xp += reward.xp;
                    user.rpg.coins += reward.coins;
                    let rewardMessage = `Você completou a ${dungeonState.dungeon.name} e ganhou ${reward.xp} XP e ${reward.coins} moedas!`;
                    // Lógica de level up...
                    activeDungeons.delete(user.username);
                    activeBattles.delete(user.username);
                    battleState.gameOver = true;
                    battleState.victory = true;
                    battleState.dungeonComplete = true;
                    battleState.log.push(rewardMessage);
                    return res.json({ battleState, updatedRpg: user.rpg });
                } else {
                    // Andar normal concluído
                    battleState.gameOver = true;
                    battleState.victory = true;
                    battleState.stageClear = true;
                    battleState.log.push(`Você limpou o andar! Prepare-se para o próximo...`);
                    activeBattles.delete(user.username); // Batalha única acabou, aguardando jogador prosseguir
                    return res.json({ battleState });
                }
            }
        }

        battleState.gameOver = true;
        battleState.victory = true;

        // Lógica de Recompensa e Level Up
        const xpGain = monster.xp;
        const coinGain = monster.coins;
        user.rpg.xp += xpGain;
        user.rpg.coins += coinGain;

        let rewardMessage = `Você derrotou o ${monster.name} e ganhou ${xpGain} XP e ${coinGain} moedas.`;

        if (user.rpg.xp >= user.rpg.xpToNextLevel) {
            user.rpg.level++;
            user.rpg.xp -= user.rpg.xpToNextLevel;
            user.rpg.xpToNextLevel = Math.floor(user.rpg.xpToNextLevel * 1.5);
            const statsKeys = Object.keys(user.rpg.stats);
            const randomStat = statsKeys[Math.floor(Math.random() * statsKeys.length)];
            user.rpg.stats[randomStat]++;
            rewardMessage += `\n🎉 PARABÉNS! Você subiu para o nível ${user.rpg.level}! (+1 de ${randomStat})`;
        }

        // Lógica de Missão Diária
        checkAndAssignDailyQuest(user);
        const quest = user.rpg.dailyQuest;
        if (quest && !quest.completed) {
            if (quest.type === 'FIGHT') quest.progress++;
            else if (quest.type === 'EARN_COINS') quest.progress += coinGain;
            else if (quest.type === 'GAIN_XP') quest.progress += xpGain;
            if (quest.progress >= quest.target) quest.completed = true;
        }

        turnLog.push(rewardMessage);
        battleState.log.push(...turnLog);
        activeBattles.delete(user.username); // Remove a batalha
        return res.json({ battleState, updatedRpg: user.rpg });
    }

    // --- Efeitos e Turno do Monstro ---
    const monsterEffectsResult = applyAndTickEffects(monster, turnLog);
    if (monster.currentHp <= 0) {
        // Monstro foi derrotado por veneno
        battleState.gameOver = true;
        battleState.victory = true;
        // (A lógica de recompensa é a mesma, então pode ser abstraída no futuro)
        const xpGain = monster.xp; const coinGain = monster.coins; user.rpg.xp += xpGain; user.rpg.coins += coinGain;
        let rewardMessage = `O ${monster.name} sucumbiu ao veneno! Você ganhou ${xpGain} XP e ${coinGain} moedas.`;
        if (user.rpg.xp >= user.rpg.xpToNextLevel) { user.rpg.level++; user.rpg.xp -= user.rpg.xpToNextLevel; user.rpg.xpToNextLevel = Math.floor(user.rpg.xpToNextLevel * 1.5); const statsKeys = Object.keys(user.rpg.stats); const randomStat = statsKeys[Math.floor(Math.random() * statsKeys.length)]; user.rpg.stats[randomStat]++; rewardMessage += `\n🎉 PARABÉNS! Você subiu para o nível ${user.rpg.level}! (+1 de ${randomStat})`; }
        checkAndAssignDailyQuest(user); const quest = user.rpg.dailyQuest; if (quest && !quest.completed) { if (quest.type === 'FIGHT') quest.progress++; else if (quest.type === 'EARN_COINS') quest.progress += coinGain; else if (quest.type === 'GAIN_XP') quest.progress += xpGain; if (quest.progress >= quest.target) quest.completed = true; }
        turnLog.push(rewardMessage); battleState.log.push(...turnLog); activeBattles.delete(user.username);
        return res.json({ battleState, updatedRpg: user.rpg });
    }

    if (monsterEffectsResult.isStunned) {
        // Message is already in the log from applyAndTickEffects
    } else {
        // Lógica de Ataque do Monstro
        const dodgeChance = Math.min(50, player.stats.dexterity * 1.5); // Chance de esquiva, max 50%
        if (Math.random() * 100 < dodgeChance) {
            turnLog.push(`Você se esquivou do ataque do ${monster.name}!`);
        } else {
            let playerDefense = player.stats.defense;
            const defenseBuff = player.effects.find(e => e.id === 'defense_buff');
            if (defenseBuff) { playerDefense = Math.floor(playerDefense * defenseBuff.multiplier); turnLog.push('Sua postura de defesa aumenta sua resistência!'); }

            let damageTaken = Math.max(1, monster.attack - playerDefense);

            if (player.isSuperDefending) { damageTaken = Math.ceil(damageTaken * 0.25); turnLog.push('Seu escudo improvisado absorveu a maior parte do dano!'); }
            else if (player.isDefending) { damageTaken = Math.ceil(damageTaken / 2); turnLog.push('Sua defesa absorveu parte do dano!'); }

            player.hp = Math.max(0, player.hp - damageTaken);

            // Verifica se o jogador tem o efeito de reflexão de dano
            const reflectEffect = player.effects.find(e => e.id === 'damage_reflect');
            if (reflectEffect) {
                const reflectedDamage = Math.ceil(damageTaken * reflectEffect.value);
                monster.currentHp = Math.max(0, monster.currentHp - reflectedDamage);
                turnLog.push(`O Desafio do Colosso reflete ${reflectedDamage} de dano de volta para o ${monster.name}!`);
            }

            // Garante que o Admin Supremo com o personagem certo seja imortal
            if (user.isSupremeAdmin && user.rpg.characters.some(c => c.id === 'chatyniboss')) {
                player.hp = player.maxHp; // Restaura a vida para o máximo
                turnLog.push(`O poder de CHATYNIBOSS anula o dano recebido!`);
            } else {
            turnLog.push(`O ${monster.name} te ataca e causa ${damageTaken} de dano.`);
            }
        }
    }

    // --- Verifica se o jogador foi derrotado ---
    if (player.hp <= 0) {
        battleState.gameOver = true;
        battleState.victory = false;
        turnLog.push('Você foi derrotado!');
        activeBattles.delete(user.username); // Remove a batalha
    }

    battleState.turn++;
    battleState.log.push(...turnLog);
    res.json({ battleState });
});

app.post('/api/rpg/boss/action', authMiddleware, (req, res) => {
    const user = req.user;
    const { battleId, action, abilityId } = req.body;
    const battleState = activeGroupBattles.get(battleId);

    if (!battleState || battleState.gameOver) return res.status(400).send('Batalha de grupo não encontrada ou já terminada.');

    const playerIndex = battleState.players.findIndex(p => p.username === user.username);
    if (playerIndex === -1) return res.status(403).send('Você não está nesta batalha.');
    if (!battleState.players[playerIndex].isAlive) return res.status(400).send('Você foi derrotado e não pode agir.');
    if (battleState.currentPlayerIndex !== playerIndex) return res.status(400).send('Não é o seu turno.');

    const player = battleState.players[playerIndex];
    const monster = battleState.monster;
    let turnLog = [];

    player.isDefending = false;
    if (player.isSuperDefending) player.isSuperDefending = false;

    const playerEffectsResult = applyAndTickEffects(player, turnLog);
    if (player.hp <= 0) {
        player.isAlive = false;
        turnLog.push(`${player.username} foi derrotado por um efeito de status!`);
        if (battleState.players.every(p => !p.isAlive)) {
            battleState.gameOver = true; battleState.victory = false; turnLog.push('Todo o grupo foi derrotado!');
            io.to(battleId).emit('group_battle_update', battleState); activeGroupBattles.delete(battleId);
            return res.json({ battleState });
        }
    }

    if (playerEffectsResult.isStunned) {
        // Message already in log
    } else {
        if (action === 'attack') {
            const weapon = player.equippedWeapon;
            let critChance = Math.min(50, player.stats.dexterity * 0.5);
            if (weapon && weapon.effects.passive_crit_chance) {
                critChance += weapon.effects.passive_crit_chance;
            }
            const isCrit = Math.random() * 100 < critChance;
            let damageDealt = Math.max(1, player.stats.strength - monster.defense);

            if (weapon && weapon.effects.on_hit) {
                const effect = weapon.effects.on_hit;
                if (effect.type === 'damage_modifier' && effect.ignore_defense_percent) {
                    const ignoredDefense = Math.floor(monster.defense * (effect.ignore_defense_percent / 100));
                    damageDealt = Math.max(1, player.stats.strength - (monster.defense - ignoredDefense));
                    turnLog.push(`A ${weapon.name} de ${player.username} ignora parte da defesa inimiga!`);
                }
            }

            if (isCrit) { damageDealt = Math.floor(damageDealt * 1.75); turnLog.push(`💥 ${player.username} deu um Acerto Crítico!`); }
            monster.currentHp = Math.max(0, monster.currentHp - damageDealt);
            turnLog.push(`${player.username} ataca o ${monster.name} e causa ${damageDealt} de dano.`);

            if (weapon && weapon.effects.on_hit) {
                const effect = weapon.effects.on_hit;
                if (effect.type === 'lifesteal_percent') {
                    const lifeStolen = Math.ceil(damageDealt * (effect.value / 100));
                    player.hp = Math.min(player.maxHp, player.hp + lifeStolen);
                    turnLog.push(`A ${weapon.name} de ${player.username} drena ${lifeStolen} de vida.`);
                }
                if (effect.type === 'debuff' && (!effect.chance || Math.random() * 100 < effect.chance)) {
                    if (effect.id === 'poison') { monster.effects.push({ id: 'poison', name: 'Veneno de Arma', turns: effect.duration, damage: Math.max(1, Math.floor(player.stats.intelligence * 0.5)) }); turnLog.push(`A ${weapon.name} de ${player.username} envenenou o ${monster.name}!`); }
                    if (effect.id === 'stun') { monster.effects.push({ id: 'stun', name: 'Atordoamento de Arma', turns: effect.duration }); turnLog.push(`A ${weapon.name} de ${player.username} atordoou o ${monster.name}!`); }
                }
                if (effect.type === 'extra_damage' && (!effect.chance || Math.random() * 100 < effect.chance)) {
                    if (effect.id === 'lightning') { const extraDamage = Math.max(1, Math.floor(player.stats[effect.damage_type] * effect.damage_multiplier)); monster.currentHp = Math.max(0, monster.currentHp - extraDamage); turnLog.push(`⚡ Um raio extra do ${weapon.name} de ${player.username} causa ${extraDamage} de dano!`); }
                }
                // A Espada Suprema não pode matar o chefe instantaneamente, então a verificação `monster.id !== 'ancient_dragon'` já previne isso.
            }
        } else if (action === 'defend') {
            player.isDefending = true;
            turnLog.push(`${player.username} se prepara para defender.`);
        } else if (action === 'use_item') {
            const { itemId } = req.body;
            const itemInInventory = player.inventory.find(i => i.itemId === itemId);

            if (!itemInInventory || itemInInventory.quantity <= 0) {
                return res.status(400).json({ message: 'Você não tem este item.' });
            }

            const itemEffect = itemInInventory.effect;
            if (itemEffect.type === 'heal') {
                player.hp = Math.min(player.maxHp, player.hp + itemEffect.value);
                turnLog.push(`${player.username} usou ${itemInInventory.name} e recuperou ${itemEffect.value} de vida.`);
            }

            itemInInventory.quantity--;

            const pUser = users.find(u => u.username === player.username);
            if (pUser) {
                const mainInventoryItem = pUser.rpg.inventory.find(i => i.itemId === itemId);
                if (mainInventoryItem) {
                    mainInventoryItem.quantity--;
                }
            }
        }
        // A lógica de 'ability' seria igualmente adaptada aqui.
    }

    if (monster.currentHp <= 0) {
        battleState.gameOver = true; battleState.victory = true;
        turnLog.push(`O grupo derrotou o ${monster.name}!`);
        battleState.players.forEach(p => {
            if (p.isAlive) {
                const pUser = users.find(u => u.username === p.username);
                if (pUser) {
                    pUser.rpg.xp += monster.xp;
                    pUser.rpg.coins += monster.coins;
                    turnLog.push(`${p.username} ganhou ${monster.xp} XP e ${monster.coins} moedas.`);
                    // Lógica de level up para cada jogador
                    if (pUser.rpg.xp >= pUser.rpg.xpToNextLevel) {
                        pUser.rpg.level++; pUser.rpg.xp -= pUser.rpg.xpToNextLevel; pUser.rpg.xpToNextLevel = Math.floor(pUser.rpg.xpToNextLevel * 1.5);
                        turnLog.push(`🎉 ${pUser.username} subiu para o nível ${pUser.rpg.level}!`);
                    }
                }
            }
        });
        io.to(battleId).emit('group_battle_update', battleState);
        activeGroupBattles.delete(battleId);
        return res.json({ battleState });
    }

    let nextPlayerIndex = battleState.currentPlayerIndex + 1;
    while (nextPlayerIndex < battleState.players.length && !battleState.players[nextPlayerIndex].isAlive) {
        nextPlayerIndex++;
    }
    battleState.currentPlayerIndex = nextPlayerIndex;

    if (battleState.currentPlayerIndex >= battleState.players.length) {
        turnLog.push(`--- Turno do ${monster.name} ---`);
        
        const monsterEffectsResult = applyAndTickEffects(monster, turnLog);
        if (monster.currentHp <= 0) {
            // Lógica de vitória por veneno (similar à de cima)
            battleState.gameOver = true; battleState.victory = true; turnLog.push(`O ${monster.name} sucumbiu ao veneno!`);
            // ... (distribuir recompensas) ...
            io.to(battleId).emit('group_battle_update', battleState); activeGroupBattles.delete(battleId);
            return res.json({ battleState });
        }

        if (!monsterEffectsResult.isStunned) {
            const alivePlayers = battleState.players.filter(p => p.isAlive);
            if (alivePlayers.length > 0) {
                // Boss AI: 35% de chance de usar um ataque em área.
                const useAoeAttack = monster.specialAbilities?.includes('fire_breath') && Math.random() < 0.35;

                if (useAoeAttack) {
                    turnLog.push(`🔥 O ${monster.name} respira uma rajada de fogo avassaladora!`);
                    alivePlayers.forEach(targetPlayer => {
                        // Ataques em área são mais difíceis de desviar.
                        const dodgeChance = Math.min(25, targetPlayer.stats.dexterity * 0.75); // Chance de esquiva reduzida
                        if (Math.random() * 100 < dodgeChance) {
                            turnLog.push(`${targetPlayer.username} consegue se esquivar parcialmente do fogo!`);
                        } else {
                            let playerDefense = targetPlayer.stats.defense;
                            const defenseBuff = targetPlayer.effects.find(e => e.id === 'defense_buff');
                            if (defenseBuff) { playerDefense = Math.floor(playerDefense * defenseBuff.multiplier); }

                            // Dano do AoE é um pouco menor que o ataque normal.
                            let damageTaken = Math.max(1, Math.floor(monster.attack * 0.8) - playerDefense);
                            if (targetPlayer.isSuperDefending) { damageTaken = Math.ceil(damageTaken * 0.25); turnLog.push(`O escudo de ${targetPlayer.username} absorveu a maior parte do dano!`); }
                            else if (targetPlayer.isDefending) { damageTaken = Math.ceil(damageTaken / 2); turnLog.push(`A defesa de ${targetPlayer.username} absorveu parte do dano!`); }
                            
                            targetPlayer.hp = Math.max(0, targetPlayer.hp - damageTaken);
                            // Verifica se o jogador alvo é o Admin Supremo com o personagem certo
                            if (targetPlayer.username === user.username && user.isSupremeAdmin && user.rpg.characters.some(c => c.id === 'chatyniboss')) {
                                targetPlayer.hp = targetPlayer.maxHp; // Restaura a vida
                                turnLog.push(`O poder de CHATYNIBOSS anula o dano em área para ${targetPlayer.username}!`);
                            } else {
                            turnLog.push(`${targetPlayer.username} é atingido pelas chamas e sofre ${damageTaken} de dano.`);
                            }
                            if (targetPlayer.hp <= 0) {
                                targetPlayer.isAlive = false;
                                turnLog.push(`${targetPlayer.username} foi derrotado!`);
                            }
                        }
                    });
                } else {
                    // Ataque normal em um único alvo.
                    const targetPlayer = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
                    const dodgeChance = Math.min(50, targetPlayer.stats.dexterity * 1.5);
                    if (Math.random() * 100 < dodgeChance) {
                        turnLog.push(`${targetPlayer.username} se esquivou do ataque do ${monster.name}!`);
                    } else {
                        let playerDefense = targetPlayer.stats.defense;
                        const defenseBuff = targetPlayer.effects.find(e => e.id === 'defense_buff');
                        if (defenseBuff) { playerDefense = Math.floor(playerDefense * defenseBuff.multiplier); }

                        let damageTaken = Math.max(1, monster.attack - playerDefense);

                        const reflectEffect = targetPlayer.effects.find(e => e.id === 'damage_reflect');
                        if (reflectEffect) {
                            const reflectedDamage = Math.ceil(damageTaken * reflectEffect.value);
                            monster.currentHp = Math.max(0, monster.currentHp - reflectedDamage);
                            turnLog.push(`O Desafio do Colosso de ${targetPlayer.username} reflete ${reflectedDamage} de dano!`);
                        }
                        if (targetPlayer.isSuperDefending) { damageTaken = Math.ceil(damageTaken * 0.25); turnLog.push(`O escudo de ${targetPlayer.username} absorveu a maior parte do dano!`); }
                        else if (targetPlayer.isDefending) { damageTaken = Math.ceil(damageTaken / 2); turnLog.push(`A defesa de ${targetPlayer.username} absorveu parte do dano!`); }
                        targetPlayer.hp = Math.max(0, targetPlayer.hp - damageTaken);
                        // Verifica se o jogador alvo é o Admin Supremo com o personagem certo
                        if (targetPlayer.username === user.username && user.isSupremeAdmin && user.rpg.characters.some(c => c.id === 'chatyniboss')) {
                            targetPlayer.hp = targetPlayer.maxHp; // Restaura a vida
                            turnLog.push(`O poder de CHATYNIBOSS anula o dano para ${targetPlayer.username}!`);
                        } else {
                        turnLog.push(`O ${monster.name} ataca ${targetPlayer.username} e causa ${damageTaken} de dano.`);
                        }
                        if (targetPlayer.hp <= 0) {
                            targetPlayer.isAlive = false;
                            turnLog.push(`${targetPlayer.username} foi derrotado!`);
                        }
                    }
                }
            }
        }

        if (battleState.players.every(p => !p.isAlive)) {
            battleState.gameOver = true; battleState.victory = false; turnLog.push('Todo o grupo foi derrotado!');
            io.to(battleId).emit('group_battle_update', battleState); activeGroupBattles.delete(battleId);
            return res.json({ battleState });
        }

        let firstAliveIndex = battleState.players.findIndex(p => p.isAlive);
        battleState.currentPlayerIndex = firstAliveIndex !== -1 ? firstAliveIndex : 0;
    }

    battleState.log.push(...turnLog);
    io.to(battleId).emit('group_battle_update', battleState);
    res.json({ battleState });
});

app.post('/api/rpg/battle/flee', authMiddleware, (req, res) => {
    const user = req.user;
    if (activeBattles.has(user.username)) {
        activeBattles.delete(user.username);
        res.json({ message: 'Você fugiu da batalha.' });
    } else {
        res.status(400).send('Nenhuma batalha para fugir.');
    }
});

app.post('/api/rpg/boss/flee', authMiddleware, (req, res) => {
    const user = req.user;
    const { battleId } = req.body;
    const battleState = activeGroupBattles.get(battleId);

    if (!battleState) return res.status(400).send('Nenhuma batalha para fugir.');

    const player = battleState.players.find(p => p.username === user.username);
    if (player) {
        player.isAlive = false; // Marca o jogador como "derrotado" para que ele saia da batalha
        battleState.log.push(`${user.username} fugiu da batalha!`);
        io.to(battleId).emit('group_battle_update', battleState);
        res.json({ message: 'Você fugiu da batalha.' });
    }
});

app.post('/api/rpg/fight', authMiddleware, (req, res) => {
    const user = req.user;
    checkAndAssignDailyQuest(user);
    res.status(410).send('Esta rota foi substituída por /api/rpg/battle/start.');
});

app.post('/api/rpg/dungeon/start', authMiddleware, (req, res) => {
    const user = req.user;
    const { dungeonId } = req.body;

    if (activeBattles.has(user.username) || activeDungeons.has(user.username) || Array.from(activeGroupBattles.values()).some(b => b.players.some(p => p.username === user.username))) {
        return res.status(400).send('Você já está em uma aventura.');
    }

    const dungeon = DUNGEONS[dungeonId];
    if (!dungeon) return res.status(404).send('Dungeon não encontrada.');

    const playerTotalStats = calculatePlayerBattleStats(user);
    const playerMaxHp = 50 + (user.rpg.level * 10) + (user.rpg.stats.strength * 2);
    const playerMaxMana = 20 + (playerTotalStats.intelligence * 5);
    const playerAbilities = getPlayerAbilities(user);

    const dungeonState = {
        dungeonId: dungeon.id,
        dungeon: dungeon,
        currentStageIndex: 0,
        playerState: {
            username: user.username, hp: playerMaxHp, maxHp: playerMaxHp, mana: playerMaxMana, maxMana: playerMaxMana,
            stats: playerTotalStats, avatarUrl: user.avatarUrl, abilities: playerAbilities,
            inventory: JSON.parse(JSON.stringify(user.rpg.inventory || [])),
            equippedWeapon: user.rpg.equippedWeapon
        }
    };
    activeDungeons.set(user.username, dungeonState);

    const firstStage = dungeon.stages[0];
    const monster = { ...MONSTERS[firstStage.monsterId] };

    const battleState = {
        dungeonContext: { dungeonId: dungeon.id, stage: 0 },
        player: { ...dungeonState.playerState },
        monster: { ...monster, currentHp: monster.hp, maxHp: monster.hp, effects: [] },
        turn: 1,
        log: [`Você entrou na ${dungeon.name}. Um ${monster.name} apareceu!`],
        gameOver: false
    };

    activeBattles.set(user.username, battleState);
    res.status(201).json({ battleState });
});

app.post('/api/rpg/dungeon/proceed', authMiddleware, (req, res) => {
    const user = req.user;
    const dungeonState = activeDungeons.get(user.username);
    if (!dungeonState) return res.status(404).send('Você não está em uma dungeon.');

    dungeonState.currentStageIndex++;
    const nextStageIndex = dungeonState.currentStageIndex;
    const dungeon = dungeonState.dungeon;

    if (nextStageIndex >= dungeon.stages.length) return res.status(400).send('Dungeon já completada ou erro de estado.');

    const nextStage = dungeon.stages[nextStageIndex];
    const monster = { ...MONSTERS[nextStage.monsterId] };

    const battleState = {
        dungeonContext: { dungeonId: dungeon.id, stage: nextStageIndex },
        player: { ...dungeonState.playerState },
        monster: { ...monster, currentHp: monster.hp, maxHp: monster.hp, effects: [] },
        turn: 1,
        log: [`Você avança para o próximo andar. Um ${monster.name} apareceu!`],
        gameOver: false
    };

    activeBattles.set(user.username, battleState);
    res.status(201).json({ battleState });
});

app.post('/api/rpg/dungeon/leave', authMiddleware, (req, res) => {
    const user = req.user;
    if (activeDungeons.has(user.username)) {
        activeDungeons.delete(user.username);
        if (activeBattles.has(user.username)) activeBattles.delete(user.username);
        res.json({ message: 'Você abandonou a dungeon e perdeu todo o progresso.' });
    } else {
        res.status(400).send('Nenhuma dungeon para abandonar.');
    }
});

app.get('/api/rpg/shop', authMiddleware, (req, res) => {
    res.json(shopItems);
});

app.post('/api/rpg/shop/buy', authMiddleware, (req, res) => {
    const user = req.user;
    const { itemId } = req.body;

    if (!user) return res.status(401).send('Usuário não autenticado.');
    if (!itemId) return res.status(400).send('ID do item não fornecido.');

    const item = shopItems.find(i => i.id === itemId);
    if (!item) return res.status(404).send('Item não encontrado na loja.');

    if (user.rpg.coins < item.price) {
        return res.status(400).send('Moedas insuficientes para comprar este item.');
    }

    user.rpg.coins -= item.price;

    if (item.type === 'consumable') {
        if (!user.rpg.inventory) user.rpg.inventory = [];
        const itemInInventory = user.rpg.inventory.find(i => i.itemId === itemId);
        if (itemInInventory) {
            itemInInventory.quantity++;
        } else {
            // Armazena uma cópia simplificada no inventário do usuário
            user.rpg.inventory.push({ itemId: item.id, name: item.name, description: item.description, type: item.type, effect: item.effect, quantity: 1 });
        }
    } else { // Itens 'permanent'
        if (item.bonus.stat === 'xp') {
            user.rpg.xp += item.bonus.value;
        } else if (user.rpg.stats[item.bonus.stat] !== undefined) {
            user.rpg.stats[item.bonus.stat] += item.bonus.value;
        }
    }

    // Distribui as moedas para as contas admin e tester
    const adminUser = users.find(u => u.isSupremeAdmin);
    const testerUser = users.find(u => u.isTester);

    if (adminUser && testerUser) {
        const halfPriceFloor = Math.floor(item.price / 2);
        const halfPriceCeil = Math.ceil(item.price / 2);
        adminUser.rpg.coins += halfPriceFloor;
        testerUser.rpg.coins += halfPriceCeil; // Garante que o total seja distribuído
        console.log(`Moedas da compra distribuídas: ${halfPriceFloor} para Admin, ${halfPriceCeil} para Tester.`);
    }

    res.json({ message: `Você comprou ${item.name} com sucesso!`, rpg: user.rpg });
});

app.post('/api/rpg/stock/buy', authMiddleware, (req, res) => {
    const user = req.user;
    const { weaponId } = req.body;

    const itemInStock = currentWeaponStock.find(i => i.id === weaponId);
    if (!itemInStock) return res.status(404).send('Esta arma não está mais no estoque.');
    if (user.rpg.coins < itemInStock.price) return res.status(400).send('Moedas insuficientes.');
    if (user.rpg.inventory.some(i => i.itemId === weaponId)) return res.status(400).send('Você já possui esta arma.');

    user.rpg.coins -= itemInStock.price;
    const weaponData = ALL_WEAPONS[weaponId];
    user.rpg.inventory.push({ itemId: weaponData.id, name: weaponData.name, description: weaponData.description, type: 'weapon', rarity: weaponData.rarity, effects: weaponData.effects, quantity: 1 });

    res.json({ message: `Você comprou ${weaponData.name} do estoque!`, rpg: user.rpg });
});

app.get('/api/rpg/armory', authMiddleware, (req, res) => {
    // A armaria foi substituída pelo sistema de estoque
    res.json([]);
});

app.post('/api/rpg/armory/buy', authMiddleware, (req, res) => {
    res.status(410).send('A armaria foi desativada e substituída pelo novo sistema de estoque.');
});

app.put('/api/rpg/inventory/equip', authMiddleware, (req, res) => {
    const user = req.user;
    const { itemId } = req.body;

    user.rpg.equippedWeapon = itemId ? ALL_WEAPONS[itemId] : null;

    res.json({ message: itemId ? `${ALL_WEAPONS[itemId].name} equipada!` : 'Arma desequipada.', rpg: user.rpg });
});

app.get('/api/rpg/all-characters', authMiddleware, (req, res) => {
    // Rota simples para o cliente buscar a lista de todos os personagens disponíveis para a UI
    res.json(RPG_CHARACTERS);
});

app.get('/api/rpg/ranking', authMiddleware, (req, res) => {
    // Cria uma cópia, mapeia para um formato público e seguro, e filtra usuários sem dados de RPG
    const publicUsers = users
        .filter(u => u.rpg) // Garante que o usuário tem dados de RPG
        .map(u => ({
            username: u.username,
            avatarUrl: u.avatarUrl,
            level: u.rpg.level,
            xp: u.rpg.xp
        }));

    // Ordena os usuários: primeiro por nível (maior para menor), depois por XP (maior para menor)
    publicUsers.sort((a, b) => {
        if (b.level !== a.level) return b.level - a.level;
        return b.xp - a.xp;
    });

    // Retorna os 10 melhores jogadores
    res.json(publicUsers.slice(0, 10));
});

app.post('/api/rpg/quest/claim', authMiddleware, (req, res) => {
    const user = req.user;
    checkAndAssignDailyQuest(user); // Garante que estamos olhando para a missão correta

    const quest = user.rpg.dailyQuest;

    if (!quest || !quest.completed || quest.claimed) {
        return res.status(400).send('Nenhuma recompensa de missão para coletar ou já foi coletada.');
    }

    // Adiciona a recompensa
    user.rpg.xp += quest.reward.xp;
    user.rpg.coins += quest.reward.coins;
    quest.claimed = true;

    const rewardMessage = `Recompensa da missão coletada: +${quest.reward.xp} XP e +${quest.reward.coins} moedas!`;

    res.json({ message: rewardMessage, rpg: user.rpg });
});

app.post('/api/rpg/roll-character', authMiddleware, (req, res) => {
    const user = req.user;
    const ROLL_COST = 100;

    if (user.rpg.coins < ROLL_COST) {
        return res.status(400).send('Moedas insuficientes para rolar um personagem.');
    }

    user.rpg.coins -= ROLL_COST;

    let chancesToUse = [...ROLL_CHANCES]; // Começa com as chances normais

    // Se o jogador tiver um buff de sorte, calcula as novas chances
    if (user.rpg.luckUses > 0 && user.rpg.luckMultiplier > 1) {
        const multiplier = user.rpg.luckMultiplier;
        let totalIncreasedChance = 0;
        const newChances = [];

        // Aplica o multiplicador nas raridades altas
        chancesToUse.forEach(tier => {
            if (tier.rarity !== 'common') {
                const newChance = Math.min(tier.chance * multiplier, 95); // Limita a chance para não quebrar o sistema
                totalIncreasedChance += newChance - tier.chance;
                newChances.push({ rarity: tier.rarity, chance: newChance });
            }
        });

        // Ajusta a chance do comum para que a soma total seja 100%
        const commonTier = chancesToUse.find(t => t.rarity === 'common');
        const newCommonChance = Math.max(1, commonTier.chance - totalIncreasedChance); // Garante que a chance do comum seja no mínimo 1%
        newChances.push({ rarity: 'common', chance: newCommonChance });

        chancesToUse = newChances;

        // Consome um uso do buff
        user.rpg.luckUses--;
        if (user.rpg.luckUses === 0) {
            user.rpg.luckMultiplier = 1; // Reseta o multiplicador
        }
    }

    // Lógica Gacha
    const random = Math.random() * 100;
    let cumulativeChance = 0;
    let chosenRarity = 'common'; // Padrão para comum

    for (const tier of chancesToUse) {
        cumulativeChance += tier.chance;
        if (random < cumulativeChance) {
            chosenRarity = tier.rarity;
            break;
        }
    }

    const characterPool = RPG_CHARACTERS[chosenRarity];
    const newCharacter = { ...characterPool[Math.floor(Math.random() * characterPool.length)] };

    // Adiciona um ID único para esta instância específica do personagem
    newCharacter.instanceId = crypto.randomBytes(8).toString('hex');

    if (!user.rpg.characters) {
        user.rpg.characters = []; // Garante que o array exista
    }
    user.rpg.characters.push(newCharacter);

    res.json({
        message: `Você recrutou um novo herói: ${newCharacter.name}!`,
        newCharacter,
        rpg: user.rpg
    });
});

// --- Rotas de RPG para Admins/Testers (admind0lu) ---
app.post('/api/rpg/admin/toggle-godmode', authMiddleware, adminOrTesterMiddleware, (req, res) => {
    const user = req.user;
    user.rpg.godMode = !user.rpg.godMode;
    const status = user.rpg.godMode ? 'ATIVADO' : 'DESATIVADO';
    res.json({ message: `Modo Deus (vida/dano infinito) ${status}.`, rpg: user.rpg });
});

app.post('/api/rpg/admin/nuke', authMiddleware, adminOrTesterMiddleware, (req, res) => {
    // Broadcast a global message
    const messageData = {
        type: 'system', // A new type of message
        username: 'SISTEMA',
        avatarUrl: 'https://i.imgur.com/vF3d5Qf.png', // Nuke icon
        text: `☢️ O admin ${req.user.username} ativou a Nuke! Tudo nas proximidades foi dizimado! ☢️`,
        timestamp: new Date()
    };
    io.emit('newMessage', messageData);
    res.json({ message: 'Nuke global ativada com sucesso!' });
});

app.post('/api/rpg/admin/donate', authMiddleware, adminOrTesterMiddleware, (req, res) => {
    const { xp, coins } = req.body;
    const user = req.user;

    const xpToAdd = parseInt(xp, 10) || 0;
    const coinsToAdd = parseInt(coins, 10) || 0;

    if (xpToAdd <= 0 && coinsToAdd <= 0) {
        return res.status(400).send('Forneça uma quantidade positiva de XP ou moedas.');
    }

    user.rpg.xp += xpToAdd;
    user.rpg.coins += coinsToAdd;

    res.json({ message: `Você adicionou ${xpToAdd} XP e ${coinsToAdd} moedas a si mesmo.`, rpg: user.rpg });
});

// --- Rotas de Admin da Guilda ---
app.post('/api/guilds/admin/kick', authMiddleware, guildOwnerMiddleware, (req, res) => {
    const { username } = req.body;
    const guild = req.guild;

    if (username === guild.owner) return res.status(400).send('O dono não pode ser expulso.');
    if (!guild.members.includes(username)) return res.status(404).send('Membro não encontrado na guilda.');

    guild.members = guild.members.filter(m => m !== username);
    const targetUser = users.find(u => u.username === username);
    if (targetUser) {
        targetUser.rpg.guildId = null;
        const targetConnection = connectedUsers.get(username);
        if (targetConnection) {
            const targetSocket = io.sockets.sockets.get(targetConnection.socketId);
            if (targetSocket) {
                // Força o usuário a sair da sala da guilda no lado do servidor
                targetSocket.leave(guild.id);
                // Envia o evento de expulsão
                io.to(targetConnection.socketId).emit('guild_kicked', { guildName: guild.name });
            }
        }
    }

    io.to(guild.id).emit('guild_update');
    res.json({ message: `${username} foi expulso da guilda.` });
});

app.post('/api/guilds/admin/mute', authMiddleware, guildOwnerMiddleware, (req, res) => {
    const { username, durationMinutes } = req.body;
    const guild = req.guild;

    if (username === guild.owner) return res.status(400).send('O dono não pode ser silenciado.');
    if (!guild.members.includes(username)) return res.status(404).send('Membro não encontrado na guilda.');

    const durationMs = (parseInt(durationMinutes, 10) || 5) * 60 * 1000;
    guild.mutedMembers[username] = Date.now() + durationMs;

    // Notifica o usuário silenciado em tempo real
    const targetConnection = connectedUsers.get(username);
    if (targetConnection) {
        io.to(targetConnection.socketId).emit('guild_notification', {
            title: 'Punição de Guilda',
            message: `Você foi silenciado no chat da guilda por ${durationMinutes || 5} minutos.`
        });
    }

    io.to(guild.id).emit('guild_update');
    res.json({ message: `${username} foi silenciado no chat da guilda por ${durationMinutes || 5} minutos.` });
});

app.post('/api/guilds/admin/unmute', authMiddleware, guildOwnerMiddleware, (req, res) => {
    const { username } = req.body;
    const guild = req.guild;

    if (!guild.mutedMembers[username]) return res.status(400).send('Este membro não está silenciado.');

    delete guild.mutedMembers[username];

    // Notifica o usuário em tempo real
    const targetConnection = connectedUsers.get(username);
    if (targetConnection) {
        io.to(targetConnection.socketId).emit('guild_notification', {
            title: 'Aviso da Guilda',
            message: 'Você não está mais silenciado no chat da guilda.'
        });
    }

    io.to(guild.id).emit('guild_update');
    res.json({ message: `${username} foi dessilenciado.` });
});

app.post('/api/guilds/admin/ban', authMiddleware, guildOwnerMiddleware, (req, res) => {
    const { username } = req.body;
    const guild = req.guild;

    if (username === guild.owner) return res.status(400).send('O dono não pode ser banido.');
    if (guild.bannedMembers.includes(username)) return res.status(400).send('Este usuário já está banido.');

    // Expulsa primeiro se for membro
    if (guild.members.includes(username)) {
        guild.members = guild.members.filter(m => m !== username);
        const targetUser = users.find(u => u.username === username);
        if (targetUser) {
            targetUser.rpg.guildId = null;
            const targetConnection = connectedUsers.get(username);
            if (targetConnection) {
                const targetSocket = io.sockets.sockets.get(targetConnection.socketId);
                if (targetSocket) {
                    targetSocket.leave(guild.id);
                    io.to(targetConnection.socketId).emit('guild_kicked', { guildName: guild.name, banned: true });
                }
            }
        }
    }

    guild.bannedMembers.push(username);
    io.to(guild.id).emit('guild_update');
    res.json({ message: `${username} foi banido permanentemente da guilda.` });
});

app.post('/api/guilds/admin/unban', authMiddleware, guildOwnerMiddleware, (req, res) => {
    const { username } = req.body;
    const guild = req.guild;

    if (!guild.bannedMembers.includes(username)) return res.status(400).send('Este usuário não está banido.');

    guild.bannedMembers = guild.bannedMembers.filter(b => b !== username);

    // Notifica o usuário desbanido em tempo real, se ele estiver online
    const targetConnection = connectedUsers.get(username);
    if (targetConnection) {
        io.to(targetConnection.socketId).emit('guild_notification', {
            title: 'Aviso da Guilda',
            message: `Você foi desbanido da guilda "${guild.name}" e pode entrar novamente.`
        });
    }

    io.to(guild.id).emit('guild_update');
    res.json({ message: `${username} foi desbanido e pode entrar na guilda novamente.` });
});

app.post('/api/guilds/admin/news', authMiddleware, guildOwnerMiddleware, (req, res) => {
    const { text } = req.body;
    const guild = req.guild;

    if (!text) return res.status(400).send('O texto da notícia não pode ser vazio.');

    const newNews = {
        id: crypto.randomBytes(4).toString('hex'),
        text,
        author: req.user.username,
        date: new Date()
    };

    guild.news.unshift(newNews); // Adiciona no início

    io.to(guild.id).emit('guild_update'); // Notifica todos os membros
    res.status(201).json({ message: 'Notícia publicada com sucesso.' });
});

app.put('/api/guilds/admin/settings', authMiddleware, guildOwnerMiddleware, (req, res) => {
    const { isPrivate, inviteCode } = req.body;
    const guild = req.guild;

    if (typeof isPrivate !== 'boolean') {
        return res.status(400).send('isPrivate deve ser um booleano.');
    }

    guild.isPrivate = isPrivate;

    if (isPrivate) {
        // Apenas atualiza o código se um novo for fornecido e não for vazio.
        // Se o código estiver vazio, mantém o antigo ou gera um novo se não existir.
        if (inviteCode && inviteCode.trim() !== '') {
            guild.inviteCode = inviteCode.trim();
        } else if (!guild.inviteCode) {
            guild.inviteCode = crypto.randomBytes(3).toString('hex');
        }
    } else {
        guild.inviteCode = null;
    }

    io.to(guild.id).emit('guild_update');
    res.json({ message: 'Configurações da guilda atualizadas.', guild });
});

// --- Rotas de Guilda ---
app.get('/api/guilds', authMiddleware, (req, res) => {
    const publicGuilds = guilds.map(g => ({
        id: g.id,
        name: g.name,
        tag: g.tag,
        isPrivate: g.isPrivate,
        memberCount: g.members.length,
        owner: g.owner
    }));
    res.json(publicGuilds);
});

app.get('/api/guilds/my-guild', authMiddleware, (req, res) => {
    const user = req.user;
    if (!user.rpg.guildId) {
        return res.status(404).send('Você não está em uma guilda.');
    }
    const guild = guilds.find(g => g.id === user.rpg.guildId);
    if (!guild) {
        // Correção de estado: se o usuário tem um ID de guilda que não existe mais
        user.rpg.guildId = null;
        return res.status(404).send('Sua guilda não foi encontrada e seu status foi corrigido. Por favor, atualize.');
    }

    // Enriquece os dados dos membros com avatares
    const detailedMembers = guild.members.map(username => {
        const memberUser = users.find(u => u.username === username);
        return {
            username: username,
            avatarUrl: memberUser ? memberUser.avatarUrl : `https://via.placeholder.com/40?text=${username.charAt(0)}`
        };
    });

    res.json({ ...guild, members: detailedMembers });
});

app.post('/api/guilds/create', authMiddleware, (req, res) => {
    const user = req.user;
    const { name, tag } = req.body;
    const creationCost = 100;

    if (!name || !tag) return res.status(400).send('Nome e tag da guilda são obrigatórios.');
    if (tag.length > 5) return res.status(400).send('A tag pode ter no máximo 5 caracteres.');
    if (user.rpg.guildId) return res.status(400).send('Você já está em uma guilda.');
    if (user.rpg.coins < creationCost) return res.status(400).send(`Moedas insuficientes. Custo: ${creationCost} moedas.`);
    if (guilds.some(g => g.name.toLowerCase() === name.toLowerCase() || g.tag.toLowerCase() === tag.toLowerCase())) {
        return res.status(400).send('Já existe uma guilda com este nome ou tag.');
    }

    user.rpg.coins -= creationCost;

    const newGuild = {
        id: crypto.randomBytes(8).toString('hex'),
        name,
        tag,
        owner: user.username,
        members: [user.username],
        isPrivate: false,
        inviteCode: null,
        news: [{
            id: crypto.randomBytes(4).toString('hex'),
            text: `A guilda "${name}" foi fundada!`,
            author: 'Sistema',
            date: new Date()
        }],
        bannedMembers: [],
        mutedMembers: {}, // { username: expiresAt_timestamp }
        createdAt: new Date(),
    };
    guilds.push(newGuild);
    user.rpg.guildId = newGuild.id;

    // Faz o socket do usuário entrar na sala da nova guilda em tempo real
    const userConnection = connectedUsers.get(user.username);
    if (userConnection) {
        const socket = io.sockets.sockets.get(userConnection.socketId);
        if (socket) {
            socket.join(newGuild.id);
        }
    }

    res.status(201).json({ message: `Guilda "${name}" criada com sucesso!`, rpg: user.rpg });
});

app.post('/api/guilds/:guildId/join', authMiddleware, (req, res) => {
    const user = req.user;
    const { guildId } = req.params;

    const { inviteCode } = req.body;

    if (user.rpg.guildId) return res.status(400).send('Você já está em uma guilda. Saia da atual para entrar em uma nova.');
    
    const guild = guilds.find(g => g.id === guildId);
    if (!guild) return res.status(404).send('Guilda não encontrada.');
    if (guild.bannedMembers.includes(user.username)) return res.status(403).send('Você está banido desta guilda.');

    if (guild.isPrivate) {
        if (!inviteCode || inviteCode !== guild.inviteCode) {
            return res.status(403).send('Código de convite inválido.');
        }
    }

    guild.members.push(user.username);
    user.rpg.guildId = guild.id;

    // Faz o socket do usuário entrar na sala da guilda em tempo real
    const userConnection = connectedUsers.get(user.username);
    if (userConnection) {
        const socket = io.sockets.sockets.get(userConnection.socketId);
        if (socket) {
            socket.join(guild.id);
        }
    }

    // Notifica os outros membros da guilda sobre o novo membro.
    io.to(guild.id).emit('guild_update');

    res.json({ message: `Você entrou na guilda "${guild.name}"!`, rpg: user.rpg });
});

app.post('/api/guilds/leave', authMiddleware, (req, res) => {
    const user = req.user;
    if (!user.rpg.guildId) return res.status(400).send('Você não está em uma guilda.');

    const guildIndex = guilds.findIndex(g => g.id === user.rpg.guildId);
    if (guildIndex === -1) {
        user.rpg.guildId = null;
        return res.status(404).send('Sua guilda não foi encontrada. Seu status foi corrigido.');
    }

    const guild = guilds[guildIndex];
    if (guild.owner === user.username) return res.status(400).send('Você é o dono. Você deve dissolver a guilda para sair.');

    guild.members = guild.members.filter(m => m !== user.username);
    user.rpg.guildId = null;

    // Faz o socket do usuário sair da sala da guilda em tempo real
    const userConnection = connectedUsers.get(user.username);
    if (userConnection) {
        const socket = io.sockets.sockets.get(userConnection.socketId);
        if (socket) {
            socket.leave(guild.id);
        }
    }
    io.to(guild.id).emit('guild_update'); // Notifica os membros restantes

    res.json({ message: `Você saiu da guilda "${guild.name}".`, rpg: user.rpg });
});

app.delete('/api/guilds/my-guild', authMiddleware, (req, res) => {
    const user = req.user;
    if (!user.rpg.guildId) return res.status(400).send('Você não está em uma guilda.');

    const guildIndex = guilds.findIndex(g => g.id === user.rpg.guildId);
    if (guildIndex === -1) {
        user.rpg.guildId = null;
        return res.status(404).send('Sua guilda não foi encontrada. Seu status foi corrigido.');
    }

    const guild = guilds[guildIndex];
    if (guild.owner !== user.username) return res.status(403).send('Apenas o dono pode dissolver a guilda.');

    // Notifica todos os membros e força a saída da sala
    io.to(guild.id).emit('guild_disbanded');
    io.sockets.in(guild.id).socketsLeave(guild.id);

    // Remove a guilda da lista
    guilds.splice(guildIndex, 1);

    // Remove o ID da guilda de todos os seus membros
    users.forEach(u => {
        if (guild.members.includes(u.username)) u.rpg.guildId = null;
    });

    res.json({ message: `Guilda "${guild.name}" dissolvida com sucesso.`, rpg: user.rpg });
});

app.post('/api/rpg/worldboss/attack', authMiddleware, (req, res) => {
    const user = req.user;

    if (!worldBoss) {
        return res.status(404).send('Nenhum Chefe Mundial ativo no momento.');
    }

    // Calcula o dano do jogador (simplificado para este exemplo)
    const playerStats = calculatePlayerBattleStats(user);
    const damageDealt = Math.max(10, Math.floor(playerStats.strength * 1.5 + playerStats.dexterity * 0.5 + playerStats.intelligence * 0.2));

    worldBoss.currentHp = Math.max(0, worldBoss.currentHp - damageDealt);

    // Registra a contribuição de dano do jogador
    const currentDamage = worldBoss.damageDealt.get(user.username) || 0;
    worldBoss.damageDealt.set(user.username, currentDamage + damageDealt);

    // Notifica todos os jogadores sobre a atualização da vida do chefe
    io.emit('worldboss_update', {
        name: worldBoss.name,
        currentHp: worldBoss.currentHp,
        maxHp: worldBoss.maxHp,
    });

    // Verifica se o chefe foi derrotado
    if (worldBoss.currentHp <= 0) {
        console.log(`Chefe Mundial ${worldBoss.name} foi derrotado!`);

        // --- NOVA LÓGICA DE RECOMPENSAS ---
        const sortedDamagers = [...worldBoss.damageDealt.entries()].sort((a, b) => b[1] - a[1]);
        
        sortedDamagers.forEach(([username, damage], index) => {
            const participant = users.find(u => u.username === username);
            if (!participant) return;

            let rewardMessage = '';

            if (index === 0) { // 1º Lugar
                const chatynirarePool = RPG_CHARACTERS.chatynirare;
                const newChar = { ...chatynirarePool[Math.floor(Math.random() * chatynirarePool.length)] };
                newChar.instanceId = crypto.randomBytes(8).toString('hex');
                participant.rpg.characters.push(newChar);
                rewardMessage = `👑 1º LUGAR! Você recebeu um Herói ChatyniRare: ${newChar.name}!`;
            } else if (index === 1) { // 2º Lugar
                const weaponId = 'lamina_cronos';
                const weaponData = ALL_WEAPONS[weaponId];
                if (weaponData && !participant.rpg.inventory.some(i => i.itemId === weaponId)) {
                    participant.rpg.inventory.push({ ...weaponData, itemId: weaponData.id, type: 'weapon', quantity: 1 });
                    rewardMessage = `🥈 2º LUGAR! Você recebeu a arma mítica: ${weaponData.name}!`;
                } else {
                    participant.rpg.coins += 15000; // Prêmio de consolação se já tiver a arma
                    rewardMessage = `🥈 2º LUGAR! Como você já tem a Lâmina Cronos, recebeu 15.000 moedas!`;
                }
            } else if (index === 2) { // 3º Lugar
                participant.rpg.xp += 50000;
                participant.rpg.coins += 10000;
                rewardMessage = `🥉 3º LUGAR! Você recebeu um bônus de 50.000 XP e 10.000 Moedas!`;
            } else { // Demais participantes
                participant.rpg.xp += 20000;
                participant.rpg.coins += 4000;
                rewardMessage = `Você participou da batalha e recebeu 20.000 XP e 4.000 Moedas!`;
            }

            // Notifica o jogador sobre sua recompensa específica
            const targetConnection = connectedUsers.get(username);
            if (targetConnection) {
                io.to(targetConnection.socketId).emit('rpg_update', { reason: rewardMessage });
            }
        });

        // Anuncia no Discord
        const topThree = sortedDamagers.slice(0, 3).map(p => ({ username: p[0], damage: p[1] }));
        botFunctions.announceWorldBossDefeat(worldBoss.name, topThree);

        worldBoss = null; // Reseta o chefe
    }

    res.json({ message: `Você atacou o Chefe Mundial e causou ${damageDealt} de dano.`, damageDealt });
});
// --- Rota do Webhook do Discord ---

// Um token secreto para garantir que apenas o seu bot do Discord possa usar o webhook.
// IMPORTANTE: Defina esta variável no seu ambiente do Render para segurança!
const DISCORD_WEBHOOK_SECRET = process.env.DISCORD_WEBHOOK_SECRET || 'dolly029592392489385592bo013';

if (process.env.NODE_ENV === 'production' && DISCORD_WEBHOOK_SECRET === 'dolly029592392489385592bo013') {
    console.error('\n\n\x1b[31m%s\x1b[0m\n\n', '**************************************************************************************');
    console.error('\x1b[31m%s\x1b[0m', 'ATENÇÃO: A APLICAÇÃO ESTÁ USANDO UMA DISCORD_WEBHOOK_SECRET PADRÃO E INSEGURA!');
    console.error('\x1b[33m%s\x1b[0m', 'Configure a variável de ambiente "DISCORD_WEBHOOK_SECRET" no seu serviço do Render.');
    console.error('\x1b[31m%s\x1b[0m\n', '**************************************************************************************');
}

app.post('/api/discord-webhook', async (req, res) => {
    const { authorization, action, targetUser, reason, newPassword, statToChange, value, item, operation, spawnerDiscordId, bossId } = req.body;

    // 1. Validar a requisição
    if (authorization !== DISCORD_WEBHOOK_SECRET) {
        console.log('Tentativa de acesso não autorizado ao webhook do Discord.');
        return res.status(403).send('Acesso negado.');
    }

    // Lista de ações que não precisam de um usuário alvo
    const actionsWithoutTarget = ['spawn_world_boss', 'spawn_specific_boss'];

    if (!action) {
        return res.status(400).send('Ação não especificada.');
    }

    // Se a ação não estiver na lista de exceções, então o usuário alvo é obrigatório
    if (!actionsWithoutTarget.includes(action) && !targetUser) {
        return res.status(400).send('Ação ou usuário alvo não especificado.');
    }

    // Se a ação precisa de um alvo, buscamos o usuário aqui.
    let user, targetSocket;
    if (!actionsWithoutTarget.includes(action)) {
        user = users.find(u => u.username === targetUser);
        if (!user) return res.status(404).send(`Usuário '${targetUser}' não encontrado.`);
        const targetConnection = connectedUsers.get(targetUser);
        targetSocket = targetConnection ? io.sockets.sockets.get(targetConnection.socketId) : null;
    }

    try {
        switch (action) {
            case 'ban':
                user.status = 'banned';
                user.banDetails = {
                    bannedBy: 'Admin via Discord',
                    reason: reason || 'Nenhum motivo fornecido.',
                    expiresAt: null // Banimento permanente por padrão
                };
                if (targetSocket) {
                    targetSocket.emit('banned', user.banDetails);
                }
                res.status(200).send(`Usuário '${targetUser}' foi banido com sucesso.`);
                break;

            case 'unban':
                if (user.status !== 'banned') {
                    return res.status(400).send(`Usuário '${targetUser}' não está banido.`);
                }
                user.status = 'active';
                user.banDetails = { bannedBy: null, reason: null, expiresAt: null };
                if (targetSocket) {
                    targetSocket.emit('unbanned');
                }
                res.status(200).send(`Usuário '${targetUser}' foi desbanido com sucesso.`);
                break;

            case 'kick':
                if (targetSocket) {
                    targetSocket.emit('kicked', { reason: reason || 'Você foi desconectado por um administrador via Discord.' });
                    targetSocket.disconnect(true);
                    res.status(200).send(`Usuário '${targetUser}' foi desconectado da sessão.`);
                } else {
                    res.status(404).send(`Usuário '${targetUser}' não está online para ser desconectado.`);
                }
                break;

            case 'change_password':
                if (!newPassword) return res.status(400).send('Nova senha não fornecida.');
                user.passwordHash = bcrypt.hashSync(newPassword, 10);
                res.status(200).send(`Senha do usuário '${targetUser}' foi alterada com sucesso.`);
                break;

            case 'set_rpg':
                if (!statToChange || value === undefined) {
                    return res.status(400).send('É necessário especificar o status (level, xp, coins) e o valor.');
                }
                const numValue = parseInt(value, 10);
                if (isNaN(numValue)) {
                    return res.status(400).send('O valor deve ser um número.');
                }

                if (['level', 'xp', 'coins'].includes(statToChange)) {
                    if (operation === 'add') {
                        user.rpg[statToChange] += numValue;
                    } else {
                        user.rpg[statToChange] = numValue;
                    }
                    if (targetSocket) {
                        targetSocket.emit('rpg_update', { reason: `Seu status de RPG (${statToChange}) foi alterado por um administrador.` });
                    }
                    res.status(200).send(`O status '${statToChange}' de '${targetUser}' foi atualizado para ${user.rpg[statToChange]}.`);
                } else {
                    res.status(400).send("Status de RPG inválido. Use 'level', 'xp' ou 'coins'.");
                }
                break;

            case 'warn':
                if (!reason) return res.status(400).send('O motivo do aviso é obrigatório.');
                if (targetSocket) {
                    targetSocket.emit('banWarning', {
                        reason: reason,
                        admin: 'Admin via Discord'
                    });
                    res.status(200).send(`Aviso enviado para '${targetUser}'.`);
                } else {
                    res.status(404).send(`Usuário '${targetUser}' não está online para receber o aviso.`);
                }
                break;

            case 'give_item':
                if (!item) return res.status(400).send('Nome do item não fornecido.');
                const swordData = ALL_WEAPONS[item];
                if (swordData && swordData.rarity === 'supreme') {
                    const swordData = itemData;
                    user.rpg.inventory.push({ itemId: swordData.id, name: swordData.name, description: swordData.description, type: 'weapon', rarity: swordData.rarity, effects: swordData.effects, quantity: 1 });
                    if (targetSocket) {
                        targetSocket.emit('rpg_update', { reason: `Você recebeu a ${swordData.name} de um administrador!` });
                    }
                    res.status(200).send(`Item '${swordData.name}' entregue para ${targetUser}.`);
                } else {
                    res.status(400).send("Item de admin inválido. Itens disponíveis: 'espada_suprema_adm'.");
                }
                break;

            case 'give_luck':
                const luckMultiplier = parseInt(value, 10);
                user.rpg.luckMultiplier = luckMultiplier;
                user.rpg.luckUses = 1; // Define como um buff de uso único

                if (targetSocket) {
                    targetSocket.emit('rpg_update', {
                        reason: `🍀 SORTE RECEBIDA! Sua próxima rolagem de personagem terá as chances de raridades altas multiplicadas por ${luckMultiplier}x!`
                    });
                }
                res.status(200).send(`Buff de sorte de ${luckMultiplier}x concedido para ${targetUser} (1 uso).`);
                break;

            case 'spawn_world_boss':
                if (worldBoss) {
                    return res.status(400).send('Um Chefe Mundial já está ativo.');
                }
                worldBoss = {
                    ...WORLD_BOSS_DATA,
                    currentHp: WORLD_BOSS_DATA.maxHp,
                    damageDealt: new Map()
                };
                console.log(`Chefe Mundial ${worldBoss.name} foi invocado por um admin via Discord.`);

                // Recompensa para o admin que invocou o chefe
                if (spawnerDiscordId) {
                    const spawnerAdmin = users.find(u => u.discordId === spawnerDiscordId);
                    if (spawnerAdmin) {
                        spawnerAdmin.rpg.coins += 150;
                        spawnerAdmin.rpg.xp += 250;
                        console.log(`Recompensa de invocação (150 moedas, 250 XP) concedida para o admin: ${spawnerAdmin.username}`);
                    }
                }

                // Notifica todos os clientes via socket que o chefe apareceu
                io.emit('worldboss_update', {
                    name: worldBoss.name,
                    currentHp: worldBoss.currentHp,
                    maxHp: worldBoss.maxHp,
                });

                res.status(200).json({ message: 'Chefe Mundial invocado com sucesso.', worldBoss });
                break;

            case 'spawn_specific_boss':
                if (worldBoss) {
                    return res.status(400).send('Um Chefe Mundial ou evento de chefe já está ativo.');
                }
                const bossData = CUSTOM_BOSSES[bossId];
                if (!bossData) {
                    return res.status(404).send('O chefe especificado não existe.');
                }

                worldBoss = {
                    ...bossData,
                    currentHp: bossData.maxHp,
                    damageDealt: new Map()
                };
                console.log(`Chefe customizado ${worldBoss.name} foi invocado por um admin via Discord.`);

                // Recompensa para o admin que invocou o chefe
                if (spawnerDiscordId) {
                    const spawnerAdmin = users.find(u => u.discordId === spawnerDiscordId);
                    if (spawnerAdmin) {
                        spawnerAdmin.rpg.coins += 150;
                        spawnerAdmin.rpg.xp += 250;
                        console.log(`Recompensa de invocação concedida para o admin: ${spawnerAdmin.username}`);
                    }
                }

                // Notifica todos os clientes via socket que o chefe apareceu
                io.emit('worldboss_update', { name: worldBoss.name, currentHp: worldBoss.currentHp, maxHp: worldBoss.maxHp });
                res.status(200).json({ message: 'Chefe customizado invocado com sucesso.', worldBoss });
                break;

            default:
                res.status(400).send('Ação inválida.');
        }
    } catch (error) {
        console.error('Erro ao processar webhook do Discord:', error);
        res.status(500).send('Erro interno do servidor.');
    }
});

// --- Rotas de Suporte ---

// Criar um novo ticket de suporte (aberto para visitantes e usuários logados)
app.post('/api/support/tickets', optionalAuthMiddleware, async (req, res) => {
    const { category, description, email } = req.body;
    let userIdentifier;

    if (req.user) {
        // Usuário logado
        userIdentifier = { _id: req.user._id, username: req.user.username };
    } else {
        // Usuário não logado (visitante)
        if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
            return res.status(400).send('Um email de contato válido é obrigatório para visitantes.');
        }
        userIdentifier = { _id: null, username: `Visitante (${email})` };
    }

    if (!category || !description) {
        return res.status(400).send('Categoria e descrição são obrigatórias.');
    }

    const newTicket = {
        _id: crypto.randomBytes(12).toString('hex'),
        user: userIdentifier,
        category,
        description,
        status: 'open',
        createdAt: new Date(),
        discordChannelId: null // Campo para armazenar o ID do canal do Discord
    };
    tickets.unshift(newTicket);

    // Notificar todos os admins conectados em tempo real
    users.forEach(user => {
        if (user.isAdmin && connectedUsers.has(user.username)) {
            const adminSocketId = connectedUsers.get(user.username).socketId;
            io.to(adminSocketId).emit('admin:newTicket', newTicket);
        }
    });

    // Pede para o bot do Discord criar um canal para este ticket
    if (botFunctions && botFunctions.createTicketChannel) {
        try {
            const channelId = await botFunctions.createTicketChannel(newTicket);
            if (channelId) {
                newTicket.discordChannelId = channelId;
                console.log(`Canal do Discord ${channelId} criado para o ticket ${newTicket._id}`);
            }
        } catch (error) {
            console.error(`Falha ao criar canal do Discord para o ticket ${newTicket._id}:`, error);
            // Continua mesmo se a criação do canal falhar, para não quebrar a criação do ticket.
        }
    }

    res.status(201).json(newTicket);
});

// Listar todos os tickets (apenas para admins)
app.get('/api/support/tickets', authMiddleware, adminMiddleware, (req, res) => {
    const sortedTickets = [...tickets].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(sortedTickets);
});

// Obter detalhes de um ticket e suas mensagens (admin ou dono do ticket)
app.get('/api/support/tickets/:ticketId', authMiddleware, (req, res) => {
    const { ticketId } = req.params;
    const ticket = tickets.find(t => t._id === ticketId);

    if (!ticket) {
        return res.status(404).send('Ticket não encontrado.');
    }

    // Verifica permissão: ou é admin, ou é o dono do ticket
    if (!req.user.isAdmin && req.user.username !== ticket.user.username) {
        return res.status(403).send('Acesso negado.');
    }

    const messages = supportMessages
        .filter(m => m.ticketId === ticketId)
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    res.json({ ticket, messages });
});

// Atualizar o status de um ticket (apenas para admins)
const handleTicketStatusUpdate = (req, res) => {
    const { ticketId } = req.params;
    const { status } = req.body;

    if (!['open', 'resolved'].includes(status)) {
        return res.status(400).send("Status inválido. Use 'open' ou 'resolved'.");
    }

    const ticket = tickets.find(t => t._id === ticketId);
    if (!ticket) {
        return res.status(404).send('Ticket não encontrado.');
    }

    ticket.status = status;

    // Notificar o usuário sobre a mudança de status (se for um usuário registrado e conectado)
    if (ticket.user._id !== null && connectedUsers.has(ticket.user.username)) {
        const userSocketData = connectedUsers.get(ticket.user.username);
        io.to(userSocketData.socketId).emit('support:statusChanged', { ticketId, status });
    }

    res.send(`Status do ticket atualizado para ${status}.`);
};

app.put('/api/support/tickets/:ticketId/status', (req, res) => {
    const isBot = req.headers['x-bot-auth'] === DISCORD_WEBHOOK_SECRET;
    if (isBot) {
        // Se for o bot, pulamos a autenticação de usuário e lidamos com a requisição
        return handleTicketStatusUpdate(req, res);
    }
    // Se for um usuário normal, passamos pela cadeia de middleware de autenticação
    authMiddleware(req, res, () => adminMiddleware(req, res, () => handleTicketStatusUpdate(req, res)));
});

// --- Lógica do Chat com Socket.IO ---
io.on('connection', (socket) => {
    // Autenticação e registro do socket
    const token = socket.handshake.auth.token;
    // CORREÇÃO: Usa o IP correto por trás de um proxy como o do Render
    const ip = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address;
    console.log(`Um usuário se conectou: ${socket.id} do IP: ${ip}`);

    if (bannedIPs.has(ip)) {
        console.log(`Conexão bloqueada do IP banido: ${ip}`);
        socket.emit('kicked', { reason: 'Seu endereço de IP está banido.' });
        return socket.disconnect(true);
    }

    let user = null;
    if (token) {
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            user = users.find(u => u.username === decoded.username);
            if (user) {
                // Garante que apenas uma sessão de socket esteja ativa por usuário.
                // Se o usuário já estiver no mapa, desconecta a sessão antiga ANTES de registrar a nova.
                if (connectedUsers.has(user.username)) {
                    const oldConnection = connectedUsers.get(user.username);
                    const oldSocket = oldConnection ? io.sockets.sockets.get(oldConnection.socketId) : null;
                    if (oldSocket) {
                        console.log(`Desconectando sessão antiga de ${user.username} (socket: ${oldConnection.socketId}) para registrar a nova.`);
                        oldSocket.emit('kicked', { reason: 'Você se conectou de um novo local. Esta sessão foi encerrada.' });
                        oldSocket.disconnect(true);
                    }
                }

                user.ip = ip; // ATUALIZA o IP do usuário no "banco de dados" com o IP mais recente da conexão
                // Join guild room if applicable
                if (user.rpg && user.rpg.guildId) {
                    socket.join(user.rpg.guildId);
                }
                console.log(`Usuário "${user.username}" (IP: ${ip}) registrado com o socket ID ${socket.id}`);
                connectedUsers.set(user.username, { socketId: socket.id, ip: ip });
            } else {
                // Token is valid, but user doesn't exist (e.g. server restarted).
                console.log(`Usuário do token (${decoded.username}) não encontrado. Desconectando socket ${socket.id}.`);
                socket.emit('auth_error', { message: 'Sua conta não foi encontrada. O servidor pode ter sido reiniciado. Por favor, faça login novamente.' });
                socket.disconnect(true);
            }
        } catch (err) {
            console.log('Token de socket inválido, conexão anônima.');
            socket.emit('auth_error', { message: 'Sua sessão expirou. Por favor, faça login novamente.' });
            socket.disconnect(true);
        }
    } else {
        console.log('Nenhum token fornecido para o socket, conexão anônima.');
    }
    
    socket.on('sendMessage', (message) => {
        if (!user) {
            return; // Não permite enviar mensagem sem estar logado
        }
        
        // BUG FIX: Impede que usuários sem perfil Roblox enviem mensagens no chat global
        if (!user.robloxUsername) {
            return; // Não permite enviar mensagem sem ter vinculado uma conta Roblox
        }

        // --- Command Handling ---
        if (message.startsWith('/')) {
            handleChatCommand(user, message);
            return;
        }

        // --- Global Mute Check ---
        // Check if mute has expired
        if (globalMuteState.isMuted && globalMuteState.expiresAt && Date.now() > globalMuteState.expiresAt) {
            if (globalMuteTimeout) clearTimeout(globalMuteTimeout);
            globalMuteState.isMuted = false;
            globalMuteState.expiresAt = null;
            globalMuteState.mutedBy = null;
            io.emit('newMessage', {
                type: 'system',
                username: 'SISTEMA',
                avatarUrl: 'https://i.imgur.com/vF3d5Qf.png',
                text: `O silenciamento global expirou. O chat foi reativado.`,
                timestamp: new Date()
            });
        }

        // Now check if still muted
        if (globalMuteState.isMuted && !user.isAdmin) { // Admins can bypass mute
            return socket.emit('chat_error', { message: `O chat está silenciado globalmente por ${globalMuteState.mutedBy}.` });
        }

        // Adiciona a tag da guilda na mensagem
        let guildTag = null;
        if (user.rpg && user.rpg.guildId) {
            const guild = guilds.find(g => g.id === user.rpg.guildId);
            if (guild) {
                guildTag = guild.tag;
            }
        }

        const censoredMessage = censorMessage(message);

        // Cria o objeto da mensagem para transmitir
        const messageData = {
            type: 'text',
            username: user.username,
            guildTag: guildTag,
            avatarUrl: user.avatarUrl,
            text: censoredMessage,
            timestamp: new Date()
        };

        // Envia a mensagem para todos os clientes conectados
        io.emit('newMessage', messageData);
    });

    socket.on('sendImageMessage', (imageUrl) => {
        if (!user || !user.isTester) {
            return; // Apenas testers podem enviar imagens
        }

        // Adiciona a tag da guilda na mensagem
        let guildTag = null;
        if (user.rpg && user.rpg.guildId) {
            const guild = guilds.find(g => g.id === user.rpg.guildId);
            if (guild) {
                guildTag = guild.tag;
            }
        }

        const messageData = {
            type: 'image',
            username: user.username,
            guildTag: guildTag,
            avatarUrl: user.avatarUrl,
            imageUrl: imageUrl,
            timestamp: new Date()
        };

        io.emit('newMessage', messageData);
    });

    socket.on('sendGuildMessage', (message) => {
        if (!user || !user.rpg.guildId) return;

        const guild = guilds.find(g => g.id === user.rpg.guildId);
        if (!guild) return;

        // Check if muted
        const muteInfo = guild.mutedMembers[user.username];
        if (muteInfo && muteInfo > Date.now()) {
            socket.emit('guild_error', { message: 'Você está silenciado no chat da guilda.' });
            return;
        }

        const censoredMessage = censorMessage(message);
        const messageData = {
            type: 'text',
            username: user.username,
            avatarUrl: user.avatarUrl,
            text: censoredMessage,
            timestamp: new Date()
        };
        // Envia a mensagem apenas para a sala da guilda
        io.to(guild.id).emit('newGuildMessage', messageData);
    });

    socket.on('adminKickUser', ({ username }) => {
        // 1. Verifica se o usuário que está enviando o evento é um admin
        if (!user || !user.isAdmin) {
            console.log(`Tentativa de kick não autorizada por: ${user ? user.username : 'usuário desconhecido'}`);
            return;
        }

        // 2. Encontra o socket do usuário alvo
        const targetConnection = connectedUsers.get(username);
        if (targetConnection) {
            const targetSocket = io.sockets.sockets.get(targetConnection.socketId);
            const targetUser = users.find(u => u.username === username);

            // 3. Impede que admins normais kickem outros admins
            if (targetUser && targetUser.isAdmin && !user.isSupremeAdmin) {
                return; // Ação silenciosamente ignorada
            }
            
            if (targetSocket) {
                targetSocket.emit('kicked', { reason: `Você foi desconectado por um administrador (${user.username}).` });
                targetSocket.disconnect(true);
                console.log(`Usuário "${username}" foi kickado pelo admin "${user.username}".`);
            }
        }
    });

    socket.on('adminWarnUser', ({ username, reason }) => {
        // 1. Verifica se o usuário que está enviando o evento é um admin
        if (!user || !user.isAdmin) {
            console.log(`Ação de aviso não autorizada por: ${user ? user.username : 'usuário desconhecido'}`);
            return;
        }

        // 2. Encontra o socket do usuário alvo
        const targetConnection = connectedUsers.get(username);
        if (targetConnection) {
            const targetSocket = io.sockets.sockets.get(targetConnection.socketId);
            if (targetSocket) {
                // 3. Envia o evento de aviso para o usuário
                targetSocket.emit('banWarning', {
                    reason: reason || 'Você recebeu um aviso de um administrador por comportamento inadequado.',
                    admin: user.username
                });
                console.log(`Aviso de banimento enviado para "${username}" pelo admin "${user.username}".`);
            }
        }
    });

    socket.on('kickUserByIp', (ipToKick) => {
        if (!user || !user.isTester) {
            return; // Apenas testers podem kickar
        }
        if (!ipToKick) {
            return;
        }

        console.log(`Tester "${user.username}" está tentando kickar o IP: ${ipToKick}`);

        // Itera sobre os usuários conectados para encontrar o IP
        for (const [username, connectionData] of connectedUsers.entries()) {
            if (connectionData.ip === ipToKick) {
                const targetSocket = io.sockets.sockets.get(connectionData.socketId);
                const targetUser = users.find(u => u.username === username);

                // Não permite que testers kickem admins ou outros testers
                if (targetSocket && targetUser && !targetUser.isAdmin && !targetUser.isTester) {
                    targetSocket.emit('kicked', { reason: 'Você foi desconectado por um Tester.' });
                    targetSocket.disconnect(true);
                    console.log(`Usuário "${username}" no IP ${ipToKick} foi kickado pelo Tester "${user.username}".`);
                }
            }
        }
    });

    // --- Lógica do Chat de Suporte ---
    socket.on('support:joinRoom', (ticketId) => {
        const ticket = tickets.find(t => t._id === ticketId);
        if (ticket && (user.isAdmin || user.username === ticket.user.username)) {
            socket.join(ticketId);
            console.log(`Usuário "${user.username}" entrou na sala de suporte do ticket: ${ticketId}`);
        }
    });

    socket.on('support:leaveRoom', (ticketId) => {
        socket.leave(ticketId);
        console.log(`Usuário "${user.username}" saiu da sala de suporte do ticket: ${ticketId}`);
    });

    socket.on('support:sendMessage', ({ ticketId, text }) => {
        if (!user) return;

        const ticket = tickets.find(t => t._id === ticketId);
        if (!ticket || (!user.isAdmin && user.username !== ticket.user.username)) {
            // Usuário não tem permissão para enviar mensagem neste ticket
            return;
        }

        const newMessage = {
            _id: crypto.randomBytes(12).toString('hex'),
            ticketId,
            sender: {
                username: user.username,
                isAdmin: user.isAdmin,
            },
            text: censorMessage(text), // Reutiliza o filtro de censura
            createdAt: new Date(),
        };

        supportMessages.push(newMessage);

        // Envia a mensagem para todos na sala do ticket (admin e usuário)
        io.to(ticketId).emit('support:newMessage', newMessage);

        // Se a mensagem for do usuário, retransmite para o canal do Discord
        if (!user.isAdmin && ticket.discordChannelId && botFunctions && botFunctions.sendMessageToChannel) {
            botFunctions.sendMessageToChannel(ticket.discordChannelId, newMessage);
        }
    });

    socket.on('disconnect', () => {
        console.log(`Usuário desconectado: ${socket.id}`);
        // Se o usuário estava registrado, removemos ele do mapa
        if (user && user.username) {
            if (connectedUsers.get(user.username)?.socketId === socket.id) {
                connectedUsers.delete(user.username);
                console.log(`Usuário "${user.username}" removido do mapa de conexões.`);
            }
        }
    });
});

app.get('*', (req, res) => {
    // Para qualquer outra rota que não seja uma API, sirva o index.html.
    // Isso é crucial para que o roteamento do lado do cliente funcione.
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- INICIA O BOT DO DISCORD ---
// Ao invés de usar um serviço separado no Render, vamos iniciar o bot
// junto com o servidor web. Isso simplifica o deploy e mantém tudo no plano gratuito.
let botFunctions;
try {
    botFunctions = require('./discord-bot.js')(io);
} catch (error) {
    console.error('Falha ao iniciar o bot do Discord:', error);
}

// --- Keep-Alive para o Render ---
// Serviços gratuitos do Render podem ser suspensos após 15 minutos de inatividade.
// Este ping periódico no console a cada 13 segundos simula atividade para evitar a suspensão.
setInterval(() => {
    console.log('Ping periódico para manter o servidor do Render ativo.');
}, 13 * 1000); // 13 segundos

setInterval(refreshWeaponStock, 20 * 60 * 1000); // 20 minutos

server.listen(PORT, async () => {
    await initializeDatabase(); // Inicializa o banco de dados antes de aceitar conexões
    refreshWeaponStock(); // Inicializa o estoque pela primeira vez
    console.log(`Servidor rodando na porta ${PORT} e conectado ao banco de dados.`);
});