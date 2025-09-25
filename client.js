// --- Gerenciamento Global de Erros ---
window.addEventListener('error', (event) => {
    console.error('Algo deu errado... (Uncaught Exception)', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Algo deu errado... (Unhandled Promise Rejection)', event.reason);
});

// --- Configuração Global ---
const API_URL = ''; // Deixe em branco, o servidor servirá a API na mesma URL
const socket = io(window.location.origin, { autoConnect: false, auth: {} });

// Injeta o estilo para o efeito RGB dos créditos, garantindo que esteja sempre disponível
const style = document.createElement('style');
style.innerHTML = `
    /* Rework da Tela de Introdução v2 */
    #initial-view { 
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        display: flex; 
        justify-content: center; 
        align-items: center; 
        text-align: center; 
        background: #0a0a14; /* Um azul bem escuro */
        font-family: 'Poppins', sans-serif;
        overflow: hidden;
        z-index: 9999; /* Garante que fique acima de tudo no início */
    }
    #particle-canvas {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 1;
    }
    .intro-container { 
        z-index: 2;
        opacity: 0;
        animation: fadeInContainer 1s ease-out 0.5s forwards;
    }
    @keyframes fadeInContainer { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
    
    .intro-logo {
        font-weight: 700;
        font-size: 6rem;
        color: #fff;
        margin-bottom: 1rem;
        animation: logo-glow 3s ease-in-out infinite alternate;
    }

    @keyframes logo-glow {
        from {
            text-shadow: 0 0 10px rgba(255, 255, 255, 0.2), 0 0 20px var(--primary-color);
        }
        to {
            text-shadow: 0 0 20px rgba(255, 255, 255, 0.4), 0 0 40px var(--primary-color), 0 0 60px var(--primary-color);
        }
    }

    .intro-subtitle { 
        font-size: 1.2rem; 
        color: #ccc; 
        letter-spacing: 8px; 
        text-transform: uppercase; 
        margin: 2rem 0 3rem 0; 
        font-weight: 300;
    }
    .intro-button { 
        background: transparent; 
        border: 2px solid var(--primary-color); 
        color: var(--primary-color); 
        padding: 15px 45px; 
        font-size: 1.2rem; 
        font-weight: 700; 
        letter-spacing: 2px; 
        cursor: pointer; 
        transition: all 0.3s ease; 
        border-radius: 5px; 
    }
    .intro-button:hover { 
        background: var(--primary-color); 
        color: #0a0a14; 
        box-shadow: 0 0 25px var(--primary-color); 
    }

    /* Rework da Barra de Progresso v2 */
    .progress-container.show {
        opacity: 1;
        visibility: visible;
    }
    .progress-bar-wrapper {
        width: 80%;
        max-width: 500px;
        height: 12px; /* Um pouco mais grossa */
        background-color: rgba(0, 0, 0, 0.25);
        border-radius: 12px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        overflow: hidden;
        box-shadow: inset 0 1px 3px rgba(0,0,0,0.5);
    }
    .progress-bar {
        width: 0%;
        height: 100%;
        background: linear-gradient(90deg, var(--primary-color), #00c6ff); /* Gradiente mais vibrante */
        border-radius: 12px;
        transition: width 3s cubic-bezier(0.4, 0, 0.2, 1);
        position: relative;
        overflow: hidden; /* Para conter o brilho */
    }
    /* Efeito de brilho que se move */
    .progress-bar::after {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.3) 50%, rgba(255,255,255,0) 100%);
        transform: translateX(-100%);
        animation: shimmer-effect 2s infinite linear;
    }
    @keyframes shimmer-effect {
        from { transform: translateX(-100%); }
        to { transform: translateX(100%); }
    }
    .progress-text {
        margin-top: 20px;
        color: #ccc;
        font-size: 1rem;
        letter-spacing: 1px;
        transition: opacity 0.5s ease;
        opacity: 0; /* Começa invisível */
    }

    /* ================================== */
    /* ==      CURSOR PERSONALIZADO    == */
    /* ================================== */
    body {
        cursor: none; /* Esconde o cursor padrão */
    }
    .custom-cursor {
        width: 20px;
        height: 20px;
        background-color: #9c27b0; /* Roxo */
        border-radius: 50%;
        position: fixed;
        pointer-events: none; /* Permite clicar através do cursor */
        z-index: 10000;
        transform: translate(-50%, -50%);
        transition: width 0.2s ease, height 0.2s ease, background-color 0.2s ease;
    }
    /* Efeito ao passar por cima de links e botões */
    a:hover ~ .custom-cursor, button:hover ~ .custom-cursor {
        width: 30px;
        height: 30px;
        background-color: rgba(156, 39, 176, 0.5);
    }

    /* ================================== */
    /* ==      REWORK DE BOTÕES        == */
    /* ================================== */

    /* --- Botão Principal (Login, etc.) --- */
    .rgb-button {
        background: var(--primary-color);
        color: white;
        border: none;
        padding: 12px 25px;
        font-size: 1.1rem;
        font-weight: 600;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.3s ease;
        text-transform: uppercase;
        letter-spacing: 1px;
        box-shadow: 0 4px 15px rgba(0, 123, 255, 0.2);
    }
    .rgb-button:hover:not(:disabled) {
        background: var(--primary-color-dark);
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(0, 123, 255, 0.3);
    }
    .rgb-button:disabled {
        background: #555;
        box-shadow: none;
        transform: none;
        cursor: not-allowed;
    }

    /* --- Botões do Mundo RPG --- */
    .rpg-action-btn {
        padding: 12px 20px;
        font-size: 1em;
        font-weight: bold;
        border-radius: 8px;
        border: 1px solid rgba(255, 255, 255, 0.2);
        cursor: pointer;
        transition: all 0.2s ease;
        background: rgba(255, 255, 255, 0.05);
        color: #eee;
    }
    .rpg-action-btn:hover:not(:disabled) {
        background: rgba(255, 255, 255, 0.1);
        border-color: var(--primary-color);
        color: var(--primary-color);
        transform: translateY(-2px);
    }
    .rpg-action-btn.dungeon-btn { border-color: #7b1fa2; color: #ce93d8; }
    .rpg-action-btn.dungeon-btn:hover:not(:disabled) { background: #4a148c; color: #fff; border-color: #7b1fa2; }
    .rpg-action-btn.boss-btn { border-color: #ab47bc; color: #e1bee7; }
    .rpg-action-btn.boss-btn:hover:not(:disabled) { background: #6a1b9a; color: #fff; border-color: #ab47bc; }

    /* --- Botões do Painel de Admin --- */
    .admin-btn {
        padding: 8px 12px;
        border-radius: 5px;
        border: none;
        color: white;
        cursor: pointer;
        font-size: 0.9em;
        transition: all 0.2s ease;
        text-transform: uppercase;
        font-weight: 600;
    }
    .admin-btn:hover:not(:disabled) { opacity: 0.85; transform: translateY(-1px); }
    .admin-btn.warn { background-color: #f57c00; }
    .admin-btn.ban { background-color: #d32f2f; }
    .admin-btn.kick { background-color: #ffa000; }
    .admin-btn.delete { background-color: #b71c1c; }
    .admin-btn.promote { background-color: #388e3c; }
    .admin-btn.demote { background-color: #757575; }
    .admin-btn.edit-rpg { background-color: #1976d2; }
    .admin-btn.change-pass { background-color: #512da8; }

    /* --- Botões do Modal --- */
    .modal-btn {
        padding: 10px 20px;
        border-radius: 6px;
        border: 1px solid #555;
        background: #333;
        color: #eee;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        text-transform: uppercase;
    }
    .modal-btn:hover { background: #444; border-color: #777; }
    .modal-btn.primary { background: var(--primary-color); border-color: var(--primary-color); color: white; }
    .modal-btn.primary:hover { background: var(--primary-color-dark); border-color: var(--primary-color-dark); }

    /* --- Outros Botões --- */
    .shop-item-buy-btn, #chat-form button, #guild-chat-form button, .setting-save-btn {
        background: var(--primary-color);
        color: white;
        border: none;
        padding: 10px 15px;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 600;
        transition: all 0.2s ease;
        text-transform: uppercase;
    }
    .shop-item-buy-btn:hover:not(:disabled), #chat-form button:hover, #guild-chat-form button:hover, .setting-save-btn:hover:not(:disabled) {
        background: var(--primary-color-dark);
        transform: translateY(-1px);
    }
    .setting-save-btn { background: #388e3c; }
    .setting-save-btn:hover:not(:disabled) { background: #2e7d32; }
    .shop-item-buy-btn:disabled { background-color: #555; cursor: not-allowed; transform: none; }

    /* --- Botões de Batalha --- */
    .battle-action-btn { padding: 12px 20px; font-size: 1em; font-weight: bold; border-radius: 8px; border: none; cursor: pointer; transition: all 0.2s; color: white; }
    .battle-action-btn[data-action="attack"] { background-color: #c62828; }
    .battle-action-btn[data-action="attack"]:hover:not(:disabled) { background-color: #e53935; }
    .battle-action-btn[data-action="defend"] { background-color: #1565c0; }
    .battle-action-btn[data-action="defend"]:hover:not(:disabled) { background-color: #1e88e5; }
    .battle-action-btn.flee { background-color: #555; }
    .battle-action-btn.flee:hover:not(:disabled) { background-color: #777; }
    .battle-action-btn.ability:hover:not(:disabled) { background-color: #ab47bc; }
    .battle-action-btn:disabled { background-color: #444 !important; color: #888 !important; cursor: not-allowed; transform: none; }

    /* Light Theme */
    [data-theme="light"] {
        --bg-color: #f0f2f5;
        --text-color: #1c1e21;
        --panel-bg: #ffffff;
        --sidebar-bg: #ffffff;
        --sidebar-text: #333;
        --sidebar-hover-bg: #f0f2f5;
        --border-color: #ddd;
        --input-bg: #f0f2f5;
        --input-border: #ccd0d5;
        --primary-color-dark: #0056b3;
    }

    [data-theme="light"] body { background-color: var(--bg-color); color: var(--text-color); }
    [data-theme="light"] .sidebar { background: var(--sidebar-bg); border-right: 1px solid var(--border-color); }
    [data-theme="light"] .sidebar a { color: var(--sidebar-text); }
    [data-theme="light"] .sidebar a:hover { background: var(--sidebar-hover-bg); }
    [data-theme="light"] .sidebar a.active { background: var(--primary-color); color: #fff; }
    [data-theme="light"] .content-panel { background-color: transparent; }
    [data-theme="light"] h1, [data-theme="light"] h2, [data-theme="light"] h3 { color: #1c1e21; }
    [data-theme="light"] p, [data-theme="light"] label { color: #333; }
    [data-theme="light"] .auth-form { background: var(--panel-bg); box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1), 0 8px 16px rgba(0, 0, 0, 0.1); border: 1px solid var(--border-color); }
    [data-theme="light"] input, [data-theme="light"] select, [data-theme="light"] textarea { background-color: var(--input-bg); border: 1px solid var(--input-border); color: #1c1e21; }
    [data-theme="light"] input:focus, [data-theme="light"] select:focus, [data-theme="light"] textarea:focus { border-color: var(--primary-color); }
    [data-theme="light"] #chat-messages { background-color: #fff; border: 1px solid var(--border-color); }
    [data-theme="light"] .chat-bubble { background-color: #e4e6eb; color: #050505; }
    [data-theme="light"] .chat-bubble.self { background-color: var(--primary-color); color: white; }
    [data-theme="light"] #modal-container { background: #fff; color: #1c1e21; border: 1px solid #ccc; }
    [data-theme="light"] .modal-close-btn { color: #888; }
    [data-theme="light"] .modal-close-btn:hover { color: #000; }
    [data-theme="light"] .rpg-stats-container, 
    [data-theme="light"] .rpg-actions-container, 
    [data-theme="light"] .rpg-shop-container, 
    [data-theme="light"] .rpg-ranking-container, 
    [data-theme="light"] .rpg-inventory-container,
    [data-theme="light"] .rpg-character-roll-container,
    [data-theme="light"] .rpg-quest-container,
    [data-theme="light"] .rpg-character-collection-container {
        background-color: var(--panel-bg);
        border: 1px solid var(--border-color);
    }
    [data-theme="light"] .shop-item, 
    [data-theme="light"] .ranking-item, 
    [data-theme="light"] .inventory-item, 
    [data-theme="light"] .character-card {
        background-color: #f9f9f9;
    }
    [data-theme="light"] #battle-modal-container { background-color: #f9f9f9; }
    [data-theme="light"] .battle-participant.player { background-color: #fff; border-left-color: var(--primary-color); }
    [data-theme="light"] #battle-log-container { background-color: #e9e9e9; color: #333; }
    [data-theme="light"] #guild-chat-container { background-color: #fff; }
    [data-theme="light"] #guild-chat-input { background-color: #f0f2f5; border-color: #ccc; color: #1c1e21; }
    [data-theme="light"] #initial-view { background: #f0f2f5; }
    [data-theme="light"] .intro-logo { color: #1c1e21; animation: none; text-shadow: none; }
    [data-theme="light"] .intro-subtitle { color: #555; }
    [data-theme="light"] #particle-canvas { display: none; }
    [data-theme="light"] .progress-container { background-color: #f0f2f5; }
    [data-theme="light"] .progress-bar-wrapper { background-color: #e0e0e0; }
    [data-theme="light"] .progress-text { color: #333; }

    [data-theme="light"] .rgb-button { box-shadow: 0 4px 15px rgba(0, 123, 255, 0.2); }
    [data-theme="light"] .rgb-button:hover:not(:disabled) { box-shadow: 0 6px 20px rgba(0, 123, 255, 0.3); }
    [data-theme="light"] .rpg-action-btn { background: rgba(0, 0, 0, 0.03); border-color: #ddd; color: #333; }
    [data-theme="light"] .rpg-action-btn:hover:not(:disabled) { background: rgba(0, 0, 0, 0.05); color: var(--primary-color); }
    [data-theme="light"] .rpg-action-btn.dungeon-btn { border-color: #e0e0e0; color: #6a1b9a; }
    [data-theme="light"] .rpg-action-btn.dungeon-btn:hover:not(:disabled) { background: #f3e5f5; color: #4a148c; }
    [data-theme="light"] .rpg-action-btn.boss-btn { border-color: #e0e0e0; color: #8e24aa; }
    [data-theme="light"] .rpg-action-btn.boss-btn:hover:not(:disabled) { background: #f3e5f5; color: #6a1b9a; }
    [data-theme="light"] .modal-btn { background: #eee; border-color: #ccc; color: #333; }
    [data-theme="light"] .modal-btn:hover { background: #e0e0e0; }
    [data-theme="light"] .modal-btn.primary { background: var(--primary-color); border-color: var(--primary-color); color: white; }
    [data-theme="light"] .modal-btn.primary:hover { background: var(--primary-color-dark); border-color: var(--primary-color-dark); }
    [data-theme="light"] #chat-form button, [data-theme="light"] #guild-chat-form button { color: white; }


    .dolly-rgb { font-weight: bold; animation: dolly-rgb-animation 4s linear infinite; background: linear-gradient(to right, #ff0000, #ff7f00, #ffff00, #00ff00, #0000ff, #4b0082, #9400d3); -webkit-background-clip: text; background-clip: text; color: transparent; }
    @keyframes dolly-rgb-animation { 0% { filter: hue-rotate(0deg); } 100% { filter: hue-rotate(360deg); } }
    .credits-box { text-align: center; margin-top: 2rem; }
    .credit-line { font-size: 1.2rem; color: #aaa; }
    .credit-name { font-size: 3rem; margin: 0.5rem 0; }
    .credit-details { font-size: 1rem; color: #888; }
    .credit-server { font-size: 0.9rem; color: #666; margin-top: 2rem; }

    /* Estilos para a rolagem das categorias na sidebar */
    #sidebar ul {
        overflow-y: auto; /* Adiciona a barra de rolagem vertical quando necessário */
        /* Limita a altura da lista para que a rolagem apareça em telas menores ou com mais itens.
           Ajuste 75vh se houver um cabeçalho/rodapé fixo na sidebar. */
        max-height: 75vh;
    }

    /* Estilos do RPG e Loja */
    .rpg-layout { display: flex; gap: 20px; flex-wrap: wrap; }
    .rpg-stats-container, .rpg-actions-container, .rpg-shop-container, .rpg-ranking-container, .rpg-inventory-container, .rpg-armory-container {
        flex: 1;
        min-width: 280px;
        background-color: rgba(0,0,0,0.2);
        padding: 15px;
        border-radius: 8px;
    }
    #rpg-shop-items {
        list-style: none;
        padding: 0;
        margin-top: 15px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        max-height: 40vh;
        overflow-y: auto;
    }
    #rpg-armory-items {
        list-style: none;
        padding: 0;
        margin-top: 15px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        max-height: 40vh;
        overflow-y: auto;
    }
    .shop-item { background-color: rgba(255,255,255,0.05); padding: 10px; border-radius: 6px; border-left: 3px solid var(--primary-color); }
    .shop-item-header { display: flex; justify-content: space-between; align-items: center; font-weight: bold; }
    .shop-item-price { color: #ffc107; }
    .shop-item-desc { font-size: 0.9em; color: #ccc; margin: 5px 0; }

    /* Estilos do Ranking */
    #rpg-ranking-list {
        list-style: none;
        padding: 0;
        margin-top: 15px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        max-height: 40vh;
        overflow-y: auto;
    }
    .ranking-item {
        display: flex;
        align-items: center;
        gap: 10px;
        background-color: rgba(255,255,255,0.05);
        padding: 8px;
        border-radius: 6px;
    }
    .ranking-position {
        font-size: 1.2em;
        font-weight: bold;
        color: #aaa;
        width: 30px;
        text-align: center;
    }
    .ranking-avatar { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; }
    .ranking-info { flex: 1; }
    .ranking-username { font-weight: bold; display: block; }
    .ranking-stats { font-size: 0.9em; color: #ccc; }

    /* Estilos da Missão Diária */
    .rpg-quest-container {
        flex-basis: 100%; /* Ocupa a largura toda */
        order: -1; /* Coloca no topo */
    }
    #daily-quest-content { text-align: center; }
    .quest-progress-bar-outer {
        width: 100%;
        background-color: #333;
        border-radius: 10px;
        height: 20px;
        margin: 10px 0;
        overflow: hidden;
    }
    #quest-progress-bar-inner {
        height: 100%;
        width: 0%; /* Começa em 0 */
        background-color: var(--primary-color);
        border-radius: 10px;
        transition: width 0.5s ease-in-out;
    }
    #quest-claim-btn.can-claim {
        background-color: #ffc107;
        color: #000;
        animation: glow 1.5s infinite alternate;
    }
    @keyframes glow { from { box-shadow: 0 0 5px #ffc107; } to { box-shadow: 0 0 20px #ffc107, 0 0 30px #ffeb3b; } }

    /* Estilos do Painel Admin RPG (admind0lu) */
    #rpg-admin-panel {
        background-color: rgba(150, 0, 0, 0.2);
        border: 1px solid #ff4444;
        border-radius: 8px;
        padding: 15px;
        margin-bottom: 20px;
    }
    #rpg-admin-panel h2 { margin-top: 0; color: #ff6666; }
    .rpg-admin-actions { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
    .rpg-admin-btn { background-color: #b71c1c; color: white; border: none; padding: 10px 15px; border-radius: 5px; cursor: pointer; }
    .rpg-admin-btn:hover { background-color: #d32f2f; }
    #rpg-admin-donate-form { display: flex; gap: 5px; }
    #rpg-admin-donate-form input { width: 100px; }

    /* Rolar Personagem */
    .rpg-character-roll-container {
        flex-basis: 100%;
        background-color: rgba(0,0,0,0.2);
        padding: 15px;
        border-radius: 8px;
        text-align: center;
        margin-bottom: 20px;
    }
    .roll-chances-container {
        margin: 15px 0;
        font-size: 0.9em;
        color: #aaa;
    }
    .roll-chances-container span {
        font-weight: bold;
    }

    /* Coleção de Personagens */
    .rpg-character-collection-container {
        flex-basis: 100%;
        margin-top: 20px;
    }
    #rpg-character-list {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 15px;
        margin-top: 15px;
        max-height: 60vh;
        overflow-y: auto;
        padding: 5px;
    }
    .character-card {
        background-color: rgba(255,255,255,0.05);
        border-radius: 8px;
        padding: 15px;
        border-left: 4px solid #555;
    }
    .character-card h4 { margin: 0 0 10px 0; }
    .character-card p { font-size: 0.85em; color: #ccc; margin: 2px 0; }

    /* Cores de Raridade */
    .rarity-common { color: #b0b0b0; border-color: #b0b0b0 !important; }
    .rarity-uncommon { color: #4caf50; border-color: #4caf50 !important; }
    .rarity-rare { color: #2196f3; border-color: #2196f3 !important; }
    .rarity-mythic { color: #9c27b0; border-color: #9c27b0 !important; }
    .rarity-chatynirare { color: #ff9800; border-color: #ff9800 !important; animation: glow-rare 1.5s infinite alternate; }
    .rarity-supreme { border-color: #fff !important; animation: dolly-rgb-animation 4s linear infinite; background: linear-gradient(to right, #ff0000, #ff7f00, #ffff00, #00ff00, #0000ff, #4b0082, #9400d3); -webkit-background-clip: text; background-clip: text; color: transparent; }

    /* Estilos para Mensagem de Sistema */
    .chat-message.system {
        width: 100%;
        justify-content: center;
        text-align: center;
        margin: 10px 0;
        color: #ffc107;
        font-style: italic;
        font-weight: bold;
    }
    @keyframes glow-rare {
        from { text-shadow: 0 0 5px #ff9800; }
        to { text-shadow: 0 0 15px #ff9800, 0 0 25px #ffc107; }
    }

    /* Modal de Resultado da Rolagem */
    .roll-result-modal-content { text-align: center; }
    .roll-result-modal-content h3 { font-size: 2em; margin-bottom: 10px; }
    .roll-result-modal-content .rarity-label { text-transform: uppercase; font-weight: bold; font-size: 1.2em; }
    .roll-result-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 5px 15px; text-align: left; margin: 20px auto; max-width: 250px; }
    .roll-result-ability { margin-top: 20px; font-style: italic; color: #ddd; }

    /* Modal Genérico */
    .modal-close-btn {
        position: absolute;
        top: 10px;
        right: 15px;
        background: none;
        border: none;
        font-size: 2rem;
        color: #aaa;
        cursor: pointer;
        line-height: 1;
        padding: 0;
    }
    .modal-close-btn:hover {
        color: #fff;
    }

    /* Estilos da Mana (MP) */
    .mp-bar-container { background-color: #333; border-radius: 5px; height: 12px; overflow: hidden; border: 1px solid #555; margin-top: 5px; }
    .mp-bar { height: 100%; background: linear-gradient(to right, #1e88e5, #42a5f5); transition: width 0.5s ease-in-out; }
    .battle-action-btn.ability { background-color: #8e24aa; color: white; }

    #dungeon-hub { text-align: center; padding: 20px; display: none; }
    #dungeon-hub h2 { font-size: 2em; color: #ffc107; }
    .dungeon-hub-actions { margin-top: 20px; display: flex; justify-content: center; gap: 20px; }

    /* Estilos do Inventário */
    #rpg-inventory-list { list-style: none; padding: 0; margin-top: 15px; display: flex; flex-direction: column; gap: 10px; max-height: 40vh; overflow-y: auto; }
    .inventory-item { display: flex; justify-content: space-between; align-items: center; background-color: rgba(255,255,255,0.05); padding: 10px; border-radius: 6px; }
    .inventory-item-name { font-weight: bold; }
    .inventory-item-quantity { font-weight: bold; color: #ffc107; }
    .inventory-item-actions { display: flex; gap: 5px; }
    .inventory-equip-btn { padding: 4px 8px; font-size: 0.8em; }
    .battle-action-btn.item { background-color: #4caf50; color: white; }
    .battle-action-btn.item:hover:not(:disabled) { background-color: #66bb6a; }

    /* Estilos do Modal de Batalha */
    #battle-modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.85); z-index: 1000; display: flex; justify-content: center; align-items: center; }
    #battle-modal-container { background-color: #1a1a1a; border: 1px solid #444; border-radius: 12px; padding: 20px; width: 90%; max-width: 800px; text-align: center; }
    .battle-scene { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 20px; }
    .battle-party-container { display: flex; flex-direction: column; gap: 15px; justify-content: flex-end; flex: 1; }
    .battle-participant { flex: 1; max-width: 200px; }
    .battle-participant.player {
        background-color: rgba(255,255,255,0.05); padding: 10px; border-radius: 8px;
        border-left: 3px solid #1e88e5; transition: all 0.3s ease;
    }
    .battle-participant.player.active-turn { border-color: #ffc107; box-shadow: 0 0 15px #ffc107; transform: scale(1.05); }
    .battle-participant.player.dead { opacity: 0.4; filter: grayscale(1); transform: scale(0.95); }
    .player-sprite { width: 50px; height: 50px; border-radius: 50%; border: 2px solid var(--primary-color); margin-bottom: 5px; }
    .battle-participant.monster { text-align: left; }
    .monster-sprite { width: 120px; image-rendering: pixelated; }
    .hp-bar-container { background-color: #333; border-radius: 5px; height: 20px; overflow: hidden; border: 1px solid #555; }
    .hp-bar { height: 100%; background: linear-gradient(to right, #d32f2f, #f44336); transition: width 0.5s ease-in-out; }
    .battle-participant h3 { margin: 5px 0; }
    .battle-participant p { margin: 5px 0; font-size: 0.9em; color: #ccc; }
    #battle-log-container { height: 120px; background-color: rgba(0,0,0,0.4); border-radius: 8px; margin-bottom: 20px; padding: 10px; overflow-y: auto; text-align: left; font-family: 'Courier New', Courier, monospace; }
    #battle-log p { margin: 0 0 5px 0; padding-bottom: 5px; border-bottom: 1px dashed #333; font-size: 0.95em; }
    #battle-log p:last-child { border-bottom: none; }
    #battle-controls { min-height: 50px; } /* Garante espaço para os botões */
    #battle-actions, #battle-ability-list, #battle-item-list { display: flex; flex-wrap: wrap; justify-content: center; gap: 15px; }
    .battle-log-victory { color: #ffc107; font-weight: bold; }
    .battle-log-defeat { color: #f44336; font-weight: bold; }
    .battle-log-levelup { color: #4caf50; font-weight: bold; animation: glow 1.5s infinite alternate; }

    /* Estilos do Painel Supremo */
    #supreme-admin-self-panel { background-color: rgba(255, 215, 0, 0.1); border: 1px solid #ffd700; border-radius: 8px; padding: 15px; }
    #supreme-admin-self-panel h2 { color: #ffd700; margin-top: 0; }
    .character-checklist { max-height: 300px; overflow-y: auto; border: 1px solid #444; padding: 10px; border-radius: 6px; display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; background-color: rgba(0,0,0,0.2); }
    .character-checklist-group { margin-bottom: 15px; }
    .character-checklist-group h4 { margin: 0 0 5px 0; text-transform: capitalize; padding-bottom: 5px; border-bottom: 1px solid #444; }
    .character-checklist-item { display: flex; align-items: center; gap: 8px; }
    .character-checklist-item label { cursor: pointer; }
    textarea.admin-input { height: 80px; resize: vertical; }
    .admin-input { width: 100%; padding: 8px; background-color: #222; border: 1px solid #444; color: #fff; border-radius: 4px; margin-bottom: 10px; box-sizing: border-box; }



    /* Estilos da Guilda */
    .chat-guild-tag { color: #aaa; font-weight: bold; margin-right: 5px; }
    .guild-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: start; }
    .guild-creation-form, .guild-list-container { flex: 1; min-width: 300px; }
    #guild-list, #guild-members-list, #guild-news-list { list-style: none; padding: 0; max-height: 50vh; overflow-y: auto; }
    .guild-list-item, .guild-member-item { display: flex; justify-content: space-between; align-items: center; background-color: rgba(255,255,255,0.05); padding: 10px; border-radius: 8px; margin-bottom: 8px; transition: background-color 0.2s; }
    .guild-list-item:hover { background-color: rgba(255,255,255,0.1); }
    .guild-member-info { display: flex; align-items: center; gap: 10px; }
    .guild-member-avatar { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; }
    .guild-news-item { background-color: rgba(0,0,0,0.2); padding: 15px; border-radius: 8px; margin-bottom: 12px; border-left: 3px solid var(--primary-color); }
    .guild-news-item p { margin: 0 0 10px 0; }
    .guild-news-header { font-size: 0.8em; color: #888; margin-bottom: 5px; }
    .guild-tag { background-color: var(--primary-color); padding: 2px 6px; border-radius: 4px; font-weight: bold; }
    .guild-main-header { display: flex; align-items: center; gap: 15px; margin-bottom: 20px; border-bottom: 1px solid #333; padding-bottom: 15px; }
    .guild-main-header h1 { margin: 0; }
    .guild-tabs { display: flex; border-bottom: 1px solid #444; margin-bottom: 20px; }
    .guild-tab-btn { background: none; border: none; color: #aaa; padding: 10px 15px; cursor: pointer; border-bottom: 3px solid transparent; font-size: 1rem; display: flex; align-items: center; gap: 8px; transition: color 0.2s, border-color 0.2s; }
    .guild-tab-btn .icon { font-size: 1.2rem; }
    .guild-tab-btn:hover { color: #fff; }
    .guild-tab-btn.active { color: #fff; border-bottom-color: var(--primary-color); font-weight: bold; }
    .guild-tab-content { display: none; }
    .guild-tab-content.active { display: block; }
    #guild-chat-container { background-color: rgba(0,0,0,0.2); border-radius: 8px; padding: 10px; display: flex; flex-direction: column; height: 60vh; }
    #guild-chat-messages { flex-grow: 1; overflow-y: auto; margin-bottom: 10px; display: flex; flex-direction: column; gap: 15px; padding-right: 5px; }
    #guild-chat-form { display: flex; gap: 10px; }
    #guild-chat-input { flex-grow: 1; background-color: #222; border: 1px solid #444; border-radius: 5px; color: #fff; padding: 10px; }
    #guild-chat-form button { background-color: var(--primary-color); border: none; color: white; padding: 10px 15px; border-radius: 5px; cursor: pointer; font-weight: bold; }
    #guild-chat-form button:hover { background-color: var(--primary-color-dark); }
    .guild-member-actions button { margin-left: 5px; padding: 2px 5px; font-size: 0.8em; }
    .guild-admin-section { margin-top: 20px; padding-top: 20px; border-top: 1px solid #444; }
    .guild-admin-section h3 { margin-top: 0; }
    #guild-add-news-form textarea { width: 100%; height: 80px; }
    #guild-add-news-form button { margin-top: 10px; }
    #guild-invite-code-container { margin-top: 10px; }

    /* Ajuste do formulário de criação */
    .guild-creation-form { background-color: rgba(0,0,0,0.2); padding: 20px; border-radius: 8px; }
    #guild-create-form { display: flex; gap: 10px; }
`;
document.head.appendChild(style);


const startButton = document.getElementById('startButton');
const initialView = document.getElementById('initial-view');
const progressContainer = document.getElementById('progressContainer');
const sidebar = document.getElementById('sidebar');
const hamburgerMenu = document.getElementById('hamburgerMenu');
const connectionStatus = document.getElementById('connection-status');
const statusText = connectionStatus.querySelector('.status-text');
const customCursor = document.getElementById('custom-cursor');

if (customCursor) {
    window.addEventListener('mousemove', e => {
        customCursor.style.left = `${e.clientX}px`;
        customCursor.style.top = `${e.clientY}px`;
    });
    document.body.addEventListener('mouseleave', () => {
        customCursor.style.display = 'none';
    });
    document.body.addEventListener('mouseenter', () => {
        customCursor.style.display = 'block';
    });
}

const sidebarOverlay = document.getElementById('sidebar-overlay');

// Elementos do Modal
const modalOverlay = document.getElementById('modal-overlay');
const modalTitle = document.getElementById('modal-title');
const modalContent = document.getElementById('modal-content');
const modalCancelBtn = document.getElementById('modal-cancel-btn');
const modalConfirmBtn = document.getElementById('modal-confirm-btn');
const modalCloseBtn = document.getElementById('modal-close-btn');
// Painéis de Conteúdo
const allPanels = document.querySelectorAll('.content-panel');

// Formulários de Autenticação
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const showSignup = document.getElementById('showSignup');
const showLogin = document.getElementById('showLogin');
const showRecover = document.getElementById('showRecover');
const showTokenLogin = document.getElementById('showTokenLogin');
const backToLogin = document.getElementById('backToLogin');
const recoverForm = document.getElementById('recoverForm');
const userTableBody = document.getElementById('user-table-body');
const robloxUsernameForm = document.getElementById('robloxUsernameForm');
const robloxUsernameInput = document.getElementById('robloxUsernameInput');
const robloxLoginView = document.getElementById('roblox-login-view');
const chatView = document.getElementById('chat-view');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const loginEmail = document.getElementById('loginEmail');
const loginPassword = document.getElementById('loginPassword');

// Elementos de Configurações
const profilePic = document.getElementById('profilePic');
const profilePicInput = document.getElementById('profilePicInput');
const changePicBtn = document.querySelector('.change-pic-btn');
const signupUsername = document.getElementById('signupUsername');
const signupEmail = document.getElementById('signupEmail');
const welcomeUsername = document.getElementById('welcomeUsername');
const usernameChangeInput = document.getElementById('username-change');
const saveUsernameBtn = document.getElementById('saveUsernameBtn');
const newPassword = document.getElementById('newPassword');
const confirmNewPassword = document.getElementById('confirmNewPassword');
const savePasswordBtn = document.getElementById('savePasswordBtn');

// Elementos de Suporte
const supportForm = document.getElementById('supportForm');
const reactivateAccountBtn = document.getElementById('reactivateAccountBtn');

// Itens de Navegação da Sidebar
const navLogin = document.getElementById('nav-login');
const navStory = document.getElementById('nav-story');
const navSettings = document.getElementById('nav-settings');
const navLogout = document.getElementById('nav-logout');
const navAdmin = document.getElementById('nav-admin');
const impersonateTesterBtn = document.getElementById('impersonateTesterBtn');
const navTester = document.getElementById('nav-tester');
const navGuild = document.getElementById('nav-guild');
const navRpg = document.getElementById('nav-rpg');
const navSupport = document.getElementById('nav-support');
const navMyTicket = document.getElementById('nav-my-ticket');

// --- Gerenciamento de Estado ---
let isLoggedIn = false;
let currentUsername = '';
let isAdmin = false;
let isSupremeAdmin = false;
let currentUser = null; // Armazena o objeto completo do usuário logado
let isTester = false;
let myOpenTicketId = null; // Armazena o ID do ticket aberto do usuário logado
let currentOpenTicketId = null; // Para rastrear o chat de suporte atualmente aberto

// --- Sistema de Modal e Notificações ---
let modalConfirmCallback = null;

function hideModal() {
    modalOverlay.classList.add('hidden');
}

// Função genérica para exibir o modal
function showModal({ title, contentHTML, confirmText = 'Confirmar', cancelText = 'Cancelar', onConfirm, hideCancel = false }) {
    modalTitle.textContent = title;
    modalContent.innerHTML = contentHTML;
    modalConfirmBtn.textContent = confirmText;
    modalCancelBtn.textContent = cancelText;
    
    modalCancelBtn.classList.toggle('hidden', hideCancel);

    modalConfirmCallback = onConfirm;
    modalOverlay.classList.remove('hidden');
}

modalCancelBtn.addEventListener('click', hideModal);
modalCloseBtn.addEventListener('click', hideModal);

modalConfirmBtn.addEventListener('click', () => {
    if (typeof modalConfirmCallback === 'function') {
        const inputs = modalContent.querySelectorAll('input');
        if (inputs.length > 0) {
            const values = {};
            inputs.forEach(input => { values[input.id] = input.value; });
            modalConfirmCallback(values);
        } else {
            modalConfirmCallback(); // Para confirmações simples
        }
    }
    hideModal();
});

// Wrapper para alertas simples
function showCustomAlert(message, title = 'Aviso') {
    const formattedMessage = message.replace(/\n/g, '<br>');
    showModal({ title, contentHTML: `<p>${formattedMessage}</p>`, confirmText: 'OK', hideCancel: true, onConfirm: () => {} });
}

// Wrapper para confirmações simples
function showCustomConfirm(message, title = 'Confirmação', onConfirm) {
    showModal({ title, contentHTML: `<p>${message}</p>`, onConfirm });
}


// --- Internacionalização (i18n) e Temas ---

const translations = {
    en: {
        navLogin: 'Login / Register',
        navChat: 'Global Chat',
        navStory: 'Story',
        navCredits: 'Credits',
        navSupport: 'Support',
        navRpg: 'RPG World',
        navGuild: 'Guild',
        navMyTicket: 'My Open Ticket',
        navSettings: 'Settings',
        navTester: 'Tester Panel',
        navAdmin: 'Admin Panel',
        navLogout: 'Logout',
        // Login
        loginTitle: 'Login',
        loginEmailPlaceholder: 'Email',
        loginPasswordPlaceholder: 'Password',
        loginButton: 'Log In',
        loginNoAccount: "Don't have an account?",
        loginSignUpLink: 'Sign up',
        loginRecoverLink: 'Recover account',
        // Register
        signupTitle: 'Register',
        signupUsernamePlaceholder: 'Username',
        signupButton: 'Create Account',
        signupHaveAccount: 'Already have an account?',
        signupLoginLink: 'Log in',
        // Recover
        recoverTitle: 'Recover Account',
        recoverInstructions: 'Enter your email to receive recovery instructions.',
        recoverSendButton: 'Send',
        recoverBackToLogin: 'Back to login',
        // Settings
        settingsTitle: 'Settings',
        settingsAppearanceTitle: 'Appearance',
        settingsTheme: 'Dark Mode',
        settingsLanguage: 'Language',
        settingsProfileChange: 'Change',
        settingsUsernameLabel: 'Username',
        settingsSaveButton: 'Save',
        settingsSavePasswordButton: 'Save New Password',
        // Story
        storyTitle: 'The Remastering of Chatyni',
        // Reset Password
        resetPasswordTitle: 'Reset Password',
        resetPasswordInstructions: 'Create a new password for your account.',
        resetConfirmPasswordPlaceholder: 'Confirm New Password',
        resetPasswordButton: 'Save New Password',
    },
    pt: {
        navLogin: 'Login / Cadastrar',
        navChat: 'Chat Global',
        navStory: 'História',
        navCredits: 'Créditos',
        navSupport: 'Suporte',
        navRpg: 'Mundo RPG',
        navGuild: 'Guilda',
        navMyTicket: 'Meu Ticket Aberto',
        navSettings: 'Configurações',
        navTester: 'Painel Tester',
        navAdmin: 'Painel Admin',
        navLogout: 'Sair',
        loginTitle: 'Login',
        loginEmailPlaceholder: 'Email',
        loginPasswordPlaceholder: 'Senha',
        loginButton: 'Entrar',
        loginNoAccount: 'Não tem uma conta?',
        loginSignUpLink: 'Cadastre-se',
        loginRecoverLink: 'Recuperar conta',
        signupTitle: 'Cadastro',
        signupUsernamePlaceholder: 'Nome de usuário',
        signupButton: 'Criar Conta',
        signupHaveAccount: 'Já tem uma conta?',
        signupLoginLink: 'Faça login',
        recoverTitle: 'Recuperar Conta',
        recoverInstructions: 'Insira seu email para receber as instruções de recuperação.',
        recoverSendButton: 'Enviar',
        recoverBackToLogin: 'Voltar para o login',
        settingsTitle: 'Configurações',
        settingsAppearanceTitle: 'Aparência',
        settingsTheme: 'Modo Escuro',
        settingsLanguage: 'Idioma',
        settingsProfileChange: 'Alterar',
        settingsUsernameLabel: 'Nome de Usuário',
        settingsSaveButton: 'Salvar',
        settingsSavePasswordButton: 'Salvar Nova Senha',
        storyTitle: 'A Remasterização do Chatyni',
        // Reset Password
        resetPasswordTitle: 'Redefinir Senha',
        resetPasswordInstructions: 'Crie uma nova senha para sua conta.',
        resetConfirmPasswordPlaceholder: 'Confirmar Nova Senha',
        resetPasswordButton: 'Salvar Nova Senha',
    }
};

function applyTranslations(lang = 'pt') {
    document.querySelectorAll('[data-translate-key], [data-translate-placeholder-key]').forEach(el => {
        const key = el.dataset.translateKey;
        const placeholderKey = el.dataset.translatePlaceholderKey;

        if (key) {
            const translation = translations[lang][key];
            if (translation) {
                if (el.title !== undefined && (el.tagName === 'BUTTON' || el.tagName === 'A')) {
                    el.title = translation;
                } else {
                    el.textContent = translation;
                }
            }
        }

        if (placeholderKey) {
            const translation = translations[lang][placeholderKey];
            if (translation && el.placeholder !== undefined) {
                el.placeholder = translation;
            }
        }
    });
}

function setLanguage(lang) {
    localStorage.setItem('chatyni_language', lang);
    document.documentElement.lang = lang;
    applyTranslations(lang);
    const languageSelector = document.getElementById('languageSelector');
    if (languageSelector) languageSelector.value = lang;
}

function setTheme(theme) {
    localStorage.setItem('chatyni_theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) themeToggle.checked = theme === 'dark';
}

function updateUIForLoginState() {
    navLogin.classList.toggle('hidden', isLoggedIn);
    navSettings.classList.toggle('hidden', !isLoggedIn);
    navLogout.classList.toggle('hidden', !isLoggedIn);
    navAdmin.classList.toggle('hidden', !isAdmin);
    navTester.classList.toggle('hidden', !isTester);
    navRpg.classList.toggle('hidden', !isLoggedIn);
    navGuild.classList.toggle('hidden', !isLoggedIn);
    navMyTicket.classList.toggle('hidden', !myOpenTicketId); // Mostra/esconde o botão do ticket

    // Atualiza o texto do link da guilda
    const guildLinkText = navGuild.querySelector('.text');
    if (guildLinkText) {
        guildLinkText.textContent = (isLoggedIn && currentUser?.rpg?.guildId) ? 'Painel da Guilda' : 'Guilda';
    }
    // O link de suporte agora é sempre visível, a classe 'hidden' foi removida do HTML.

    if (isLoggedIn) {
        welcomeUsername.textContent = currentUsername || 'Usuário';
        setActivePanel('welcomeContent');
    } else {
        setActivePanel('loginContent');
    }
}

function updateRpgPanel() {
    if (!currentUser || !currentUser.rpg) return;

    const { level, xp, xpToNextLevel, coins, godMode } = currentUser.rpg;
    const rpgAdminPanel = document.getElementById('rpg-admin-panel');
    const godModeBtn = document.getElementById('rpg-admin-godmode-btn');
    const statsContainer = document.querySelector('.rpg-stats-container');

    // --- Lógica de Cálculo de Status (replicada do servidor para a UI) ---
    let finalStats;
    // Verifica se o usuário é Admin Supremo e tem o personagem CHATYNIBOSS
    if (currentUser.isSupremeAdmin && currentUser.rpg.characters.some(c => c.id === 'chatyniboss')) {
        finalStats = { strength: 99999, dexterity: 99999, intelligence: 99999, defense: 99999 };
    } else {
        finalStats = { ...currentUser.rpg.stats }; // Começa com os status base
        // Adiciona bônus dos personagens
        (currentUser.rpg.characters || []).forEach(char => {
            finalStats.strength += char.stats.strength;
            finalStats.dexterity += char.stats.dexterity;
            finalStats.intelligence += char.stats.intelligence;
            finalStats.defense += char.stats.defense;
        });
    }
    // --- Fim da Lógica de Cálculo ---

    // Mostra o painel de admin RPG se for admin ou tester
    rpgAdminPanel.classList.toggle('hidden', !isAdmin && !isTester);

    document.getElementById('rpg-level').textContent = level;
    document.getElementById('rpg-xp').textContent = xp;
    document.getElementById('rpg-xp-next').textContent = xpToNextLevel;
    document.getElementById('rpg-coins').textContent = coins;
    document.getElementById('rpg-stat-strength').textContent = finalStats.strength;
    document.getElementById('rpg-stat-dexterity').textContent = finalStats.dexterity;
    document.getElementById('rpg-stat-intelligence').textContent = finalStats.intelligence;
    document.getElementById('rpg-stat-defense').textContent = finalStats.defense || 1;
    
    const equippedWeapon = currentUser.rpg.equippedWeapon;
    document.getElementById('rpg-equipped-weapon').textContent = equippedWeapon ? equippedWeapon.name : 'Nenhuma';
    document.getElementById('rpg-equipped-weapon').className = equippedWeapon ? `rarity-${equippedWeapon.rarity}` : '';

    // Feedback visual para God Mode
    if (godModeBtn) godModeBtn.textContent = godMode ? 'Desativar God Mode' : 'Ativar God Mode';
    if (statsContainer) statsContainer.style.border = godMode ? '2px solid #ffc107' : 'none';
}

function updateDailyQuestPanel() {
    if (!currentUser || !currentUser.rpg) return;

    const quest = currentUser.rpg.dailyQuest;
    const descriptionEl = document.getElementById('quest-description');
    const progressBarEl = document.getElementById('quest-progress-bar-inner');
    const progressTextEl = document.getElementById('quest-progress-text');
    const claimBtnEl = document.getElementById('quest-claim-btn');

    if (!quest || quest.claimed) {
        descriptionEl.textContent = 'Você já completou sua missão de hoje!';
        progressTextEl.textContent = 'Volte amanhã para uma nova aventura.';
        progressBarEl.style.width = '100%';
        progressBarEl.style.backgroundColor = '#4caf50'; // Verde para completo
        claimBtnEl.textContent = 'Concluído';
        claimBtnEl.disabled = true;
        claimBtnEl.classList.remove('can-claim');
        return;
    }

    const progress = Math.min(quest.progress, quest.target); // Evita que a barra passe de 100%
    const progressPercent = (progress / quest.target) * 100;

    descriptionEl.textContent = quest.description;
    progressTextEl.textContent = `${progress} / ${quest.target}`;
    progressBarEl.style.width = `${progressPercent}%`;
    progressBarEl.style.backgroundColor = 'var(--primary-color)';

    if (quest.completed) {
        claimBtnEl.textContent = 'Coletar Recompensa';
        claimBtnEl.disabled = false;
        claimBtnEl.classList.add('can-claim');
    } else {
        claimBtnEl.textContent = 'Em Progresso...';
        claimBtnEl.disabled = true;
        claimBtnEl.classList.remove('can-claim');
    }
}

document.getElementById('quest-claim-btn')?.addEventListener('click', handleClaimQuestReward);


function setActivePanel(panelId) {
    // Lógica para esconder/mostrar a navegação da sidebar em caso de banimento
    const sidebarNavList = document.querySelector('#sidebar ul');
    if (sidebarNavList) {
        // Esconde toda a lista de navegação se o painel for 'bannedContent', e mostra para qualquer outro.
        sidebarNavList.classList.toggle('hidden', panelId === 'bannedContent');
    }

    // Desativa todos os painéis e links da sidebar
    allPanels.forEach(panel => panel.classList.remove('active'));
    document.querySelectorAll('.sidebar a[data-target]').forEach(link => link.classList.remove('active'));

    // Ativa o painel de conteúdo alvo
    const targetPanel = document.getElementById(panelId);
    if (targetPanel) {
        targetPanel.classList.add('active');
    }

    // Ativa o link correspondente na sidebar
    const targetLink = document.querySelector(`.sidebar a[data-target="${panelId}"]`);
    if (targetLink) {
        targetLink.classList.add('active');
    }

    // Aplica traduções sempre que um painel é ativado
    applyTranslations(localStorage.getItem('chatyni_language') || 'pt');

    // Preenche o campo de nome nas configurações quando o painel é aberto
    if (panelId === 'settingsContent') {
        usernameChangeInput.value = currentUsername;
    }
    if (panelId === 'adminContent') {
        buildAdminUserTable();
        buildBannedIpList();
        if (isAdmin) {
            buildSupportTicketTable();
        }

        // Lógica para o painel de auto-edição do admin supremo
        const selfPanel = document.getElementById('supreme-admin-self-panel');
        if (selfPanel) {
            if (isSupremeAdmin) {
                selfPanel.classList.remove('hidden');
                buildSupremeAdminPanel(); // Popula o formulário com os dados atuais
            } else {
                selfPanel.classList.add('hidden');
            }
        }
    }
    if (panelId === 'supportContent') {
        const emailGroup = document.getElementById('support-email-group');
        // Mostra o campo de email apenas se o usuário não estiver logado
        emailGroup.classList.toggle('hidden', isLoggedIn);
    }
    if (panelId === 'rpgContent') {
        updateRpgPanel();
        buildRpgShop();
        buildWeaponStock(); // Constrói o novo painel de estoque
        fetchWorldBossStatus(); // Verifica se há um chefe mundial ativo
        buildRpgRanking();
        updateDailyQuestPanel();
        buildCharacterList();
        buildInventoryList();
        buildArmory();
    }
    if (panelId === 'guildContent') {
        if (isLoggedIn) {
            buildGuildPanel();
        }
    }
    // Lógica para mostrar a view correta dentro do painel de chat
    if (panelId === 'chatContent') {
        if (currentUser && currentUser.robloxUsername) {
            robloxLoginView.classList.add('hidden');
            chatView.classList.remove('hidden');
        } else {
            robloxLoginView.classList.remove('hidden');
            chatView.classList.add('hidden');
        }
    }

    // Fecha a sidebar ao selecionar um painel
    sidebar.classList.remove('show');
    hamburgerMenu.classList.remove('active');
    sidebarOverlay.classList.remove('show');
}

async function refreshCurrentUser(token) {
    try {
        const res = await fetch(`${API_URL}/api/users/me`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) throw new Error('Não foi possível atualizar os dados do usuário.');
        const user = await res.json();
        currentUser = user; // Update the global state object
        profilePic.src = user.avatarUrl; // Also update the profile pic in settings
        return user;
    } catch (error) {
        console.error(error);
        alert(error.message);
        return null;
    }
}

async function checkMyOpenTicket(token) {
    try {
        const res = await fetch(`${API_URL}/api/support/my-ticket`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) { // Um 404 é esperado se não houver ticket, então não é um erro
            myOpenTicketId = null;
        } else {
            const ticket = await res.json();
            myOpenTicketId = ticket._id;
        }
        updateUIForLoginState(); // Atualiza a UI para mostrar ou esconder o botão
    } catch (error) {
        console.error("Erro ao verificar ticket aberto:", error);
    }
}
// --- Fluxo Inicial e Persistência ---
function checkInitialState() {
    // Carrega tema e idioma salvos
    const savedLang = localStorage.getItem('chatyni_language') || 'pt';
    const savedTheme = localStorage.getItem('chatyni_theme') || 'dark';
    setLanguage(savedLang);
    setTheme(savedTheme);

    const token = localStorage.getItem('chatyni_token');
    if (token) {
        fetchAndSetUser(token);
    }

    // Handle password recovery token from URL
    const urlParams = new URLSearchParams(window.location.search);
    const recoveryToken = urlParams.get('token');
    const hash = window.location.hash;

    if (recoveryToken && hash === '#reset-password') {
        // Store token and show reset panel
        localStorage.setItem('recovery_token', recoveryToken);
        // Hide the intro view and show the reset panel directly
        initialView.classList.add('hidden');
        hamburgerMenu.classList.add('show');
        connectionStatus.classList.add('show');
        setActivePanel('resetPasswordContent');
        // Clean the URL
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}

async function fetchAndSetUser(token) {
    try {
        const res = await fetch(`${API_URL}/api/users/me`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) throw new Error('Sessão inválida');
        const user = await res.json();

        currentUser = user; // Armazena o objeto do usuário
        isLoggedIn = true;
        currentUsername = user.username;
        isAdmin = user.isAdmin;
        isSupremeAdmin = user.isSupremeAdmin;
        isTester = user.isTester;
        profilePic.src = user.avatarUrl;

        // Conecta ao chat
        socket.auth.token = token;
        socket.connect();
        await checkMyOpenTicket(token); // Verifica se o usuário tem um ticket aberto

        initialView.classList.add('hidden'); // Pula a tela de "Iniciar" se já estiver logado
        hamburgerMenu.classList.add('show');
        updateUIForLoginState();
    } catch (error) {
        console.error(error);
        logout(); // Limpa o token inválido
    }
}

startButton.addEventListener('click', () => {
    initialView.style.opacity = '0';

    // Após o fade-out da tela inicial, mostra a barra de progresso
    setTimeout(() => {
        initialView.classList.add('hidden');
        progressContainer.classList.add('show');

        // Animação da barra de progresso
        const progressBar = document.getElementById('progressBar');
        // Força um reflow para garantir que a transição CSS seja aplicada
        progressBar.getBoundingClientRect(); 
        progressBar.style.width = '100%'; // Inicia a animação da barra

        // Textos de carregamento dinâmicos com fade
        const progressText = document.getElementById('progressText');
        const loadingMessages = [
            'Inicializando sistema...',
            'Carregando módulos de RPG...',
            'Conectando aos servidores globais...',
            'Renderizando interface...',
            'Quase pronto!'
        ];
        let messageIndex = 0;
        
        // Exibe a primeira mensagem com fade-in
        progressText.textContent = loadingMessages[messageIndex];
        setTimeout(() => { progressText.style.opacity = 1; }, 100); // Pequeno delay para garantir a transição

        const messageInterval = setInterval(() => {
            messageIndex++;
            if (messageIndex < loadingMessages.length) {
                progressText.style.opacity = 0; // Inicia o fade-out
                setTimeout(() => {
                    progressText.textContent = loadingMessages[messageIndex];
                    progressText.style.opacity = 1; // Inicia o fade-in com o novo texto
                }, 300); // Tempo para o fade-out terminar
            } else {
                clearInterval(messageInterval);
            }
        }, 700); // Intervalo um pouco maior para acomodar o fade

    }, 500); // Delay para o fade-out da tela inicial

    // Após o tempo total da animação, esconde a barra e mostra o conteúdo principal
    setTimeout(() => {
        progressContainer.classList.remove('show');

        setTimeout(() => {
            hamburgerMenu.classList.add('show');
            connectionStatus.classList.add('show');
            updateUIForLoginState();
        }, 500); // Delay para o fade-in dos elementos principais

    }, 4000); // Aumenta o tempo total para acomodar a animação de texto
});

// --- Menu Hamburger ---
hamburgerMenu.addEventListener('click', () => {
    hamburgerMenu.classList.toggle('active');
    sidebar.classList.toggle('show');
    sidebarOverlay.classList.toggle('show');
});

// Fecha o menu ao clicar fora (no overlay)
sidebarOverlay.addEventListener('click', () => {
    hamburgerMenu.classList.remove('active');
    sidebar.classList.remove('show');
    sidebarOverlay.classList.remove('show');
});

// --- Troca de Formulário de Autenticação ---
showSignup.addEventListener('click', (e) => {
    e.preventDefault();
    loginForm.classList.remove('show');
    signupForm.classList.add('show');
});

showLogin.addEventListener('click', (e) => {
    e.preventDefault();
    signupForm.classList.remove('show');
    loginForm.classList.add('show');
});

showRecover.addEventListener('click', (e) => {
    e.preventDefault();
    setActivePanel('recoverContent');
});

backToLogin.addEventListener('click', (e) => {
    e.preventDefault();
    setActivePanel('loginContent');
});

showTokenLogin.addEventListener('click', (e) => {
    e.preventDefault();
    showModal({
        title: 'Logar com Token',
        contentHTML: `
            <p>Insira o token de uso único que você recebeu do bot no Discord.</p>
            <input type="text" id="loginTokenInput" class="admin-input" placeholder="Seu token aqui..." required>
        `,
        confirmText: 'Entrar',
        onConfirm: async (values) => {
            const token = values.loginTokenInput;
            if (!token) return showCustomAlert('O token não pode estar em branco.');
            await loginWithToken(token);
        }
    });
});

backToLoginFromRecover.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('recover-step-1').classList.remove('hidden');
    document.getElementById('recover-step-2').classList.add('hidden');
    recoverForm.reset();
    setActivePanel('loginContent');
});

recoverForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('recoverEmail').value;
    if (!email) return;

    try {
        const res = await fetch(`${API_URL}/api/recover/get-question`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        if (!res.ok) throw new Error(await res.text());
        const { question } = await res.json();

        document.getElementById('recover-step-1').classList.add('hidden');
        document.getElementById('recover-step-2').classList.remove('hidden');
        document.getElementById('securityQuestionText').textContent = question;
    } catch (error) {
        showCustomAlert(`Erro: ${error.message}`);
    }
});

document.getElementById('validateAnswerBtn').addEventListener('click', async () => {
    const email = document.getElementById('recoverEmail').value;
    const answer = document.getElementById('securityAnswerInput').value;

    if (!answer) { showCustomAlert('Por favor, insira sua resposta.'); return; }

    try {
        const res = await fetch(`${API_URL}/api/recover/validate-answer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, answer })
        });
        if (!res.ok) throw new Error(await res.text());
        const { recoveryToken } = await res.json();

        localStorage.setItem('recovery_token', recoveryToken);
        setActivePanel('resetPasswordContent');

        document.getElementById('recover-step-1').classList.remove('hidden');
        document.getElementById('recover-step-2').classList.add('hidden');
        recoverForm.reset();

    } catch (error) {
        showCustomAlert(`Erro: ${error.message}`);
    }
});

const resetPasswordForm = document.getElementById('resetPasswordForm');
if (resetPasswordForm) {
    resetPasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newPassword = document.getElementById('resetNewPassword').value;
        const confirmPassword = document.getElementById('resetConfirmPassword').value;
        const token = localStorage.getItem('recovery_token');

        if (!token) { showCustomAlert('Token de recuperação não encontrado. Por favor, use o link do seu email novamente.'); return; }
        if (newPassword !== confirmPassword) { showCustomAlert('As senhas não coincidem.'); return; }
        if (newPassword.length < 4) { showCustomAlert('A senha deve ter pelo menos 4 caracteres.'); return; }

        try {
            const res = await fetch(`${API_URL}/api/recover/reset`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, newPassword })
            });
            const message = await res.text();
            if (!res.ok) throw new Error(message);
            showCustomAlert(message, 'Sucesso!');
            localStorage.removeItem('recovery_token');
            setActivePanel('loginContent');
        } catch (error) { showCustomAlert(`Erro: ${error.message}`); }
    });
}

// --- Simulação de Login/Logout ---
async function handleAuth(e) {
    e.preventDefault(); // Previne o envio real do formulário
    const form = e.target;
    const isRegister = form.id === 'signupForm';
    const endpoint = isRegister ? '/api/register' : '/api/login';
    const submitButton = form.querySelector('button[type="submit"]');
    const originalButtonText = submitButton.textContent;

    submitButton.disabled = true;
    submitButton.textContent = 'Processando...';
    const body = {};

    if (isRegister) {
        body.username = form.querySelector('#signupUsername').value;
        body.email = form.querySelector('#signupEmail').value;
        body.password = form.querySelector('#signupPassword').value;
        body.securityQuestion = form.querySelector('#signupSecurityQuestion').value;
        body.securityAnswer = form.querySelector('#signupSecurityAnswer').value;
    } else {
        body.email = form.querySelector('#loginEmail').value;
        body.password = form.querySelector('#loginPassword').value;
    }

    try {
        const res = await fetch(API_URL + endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (!res.ok) {
            // Adiciona uma verificação extra para o formulário de registro
            if (isRegister && (!body.securityQuestion || !body.securityAnswer)) {
                throw new Error('Por favor, preencha a pergunta e resposta de segurança.');
            }

            const errorData = await res.json().catch(() => ({ message: res.statusText }));
            if (res.status === 403) {
                if (errorData.banDetails) {
                    // User is banned, show ban screen
                    document.getElementById('bannedBy').textContent = errorData.banDetails.bannedBy || 'Sistema';
                    document.getElementById('banReason').textContent = errorData.banDetails.reason || 'N/A';
                    document.getElementById('banExpires').textContent = errorData.banDetails.expiresAt ? new Date(errorData.banDetails.expiresAt).toLocaleString('pt-BR') : 'Permanente';
                    setActivePanel('bannedContent');
                    return; // Stop the login process
                }
            }
            throw new Error(errorData.message || 'Ocorreu um erro.');
        }

        if (isRegister) {
            showCustomAlert('Cadastro realizado com sucesso! Por favor, faça o login.');
            setActivePanel('loginContent');
            form.reset();
        } else {
            const { token } = await res.json();
            localStorage.setItem('chatyni_token', token);
            await fetchAndSetUser(token);
        }
    } catch (error) {
        showCustomAlert(error.message, 'Erro');
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = originalButtonText;
    }
}

async function loginWithToken(tempToken) {
    try {
        const res = await fetch(`${API_URL}/api/login-with-token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tempToken })
        });

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({ message: res.statusText }));
            throw new Error(errorData.message || 'Ocorreu um erro.');
        }

        const { token } = await res.json();
        localStorage.setItem('chatyni_token', token);
        await fetchAndSetUser(token);
    } catch (error) { showCustomAlert(error.message, 'Erro'); }
}
function logout() {
    currentUsername = '';
    isLoggedIn = false;
    currentUser = null;
    isAdmin = false;
    isSupremeAdmin = false;
    isTester = false;
    myOpenTicketId = null;
    localStorage.removeItem('chatyni_token');
    socket.disconnect();
    updateUIForLoginState();
}

loginForm.addEventListener('submit', handleAuth);
signupForm.addEventListener('submit', handleAuth);

navMyTicket.addEventListener('click', (e) => {
    e.preventDefault();
    if (myOpenTicketId) {
        openUserSupportChat(myOpenTicketId);
    }
});

changePicBtn.addEventListener('click', () => {
    profilePicInput.click();
});

// Desabilita o botão de salvar nome de usuário, pois não está implementado
saveUsernameBtn.disabled = true;
saveUsernameBtn.title = 'Funcionalidade a ser implementada no futuro.';

savePasswordBtn.addEventListener('click', async () => {
    const currentPass = document.getElementById('currentPassword').value;
    const newPass = newPassword.value;
    const confirmPass = confirmNewPassword.value;

    if (!currentPass || !newPass || !confirmPass) {
        showCustomAlert('Por favor, preencha todos os campos de senha.');
        return;
    }
    if (newPass !== confirmPass) {
        showCustomAlert('As novas senhas não coincidem.');
        return;
    }
    
    try {
        const token = localStorage.getItem('chatyni_token');
        const res = await fetch(`${API_URL}/api/users/me/password`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ currentPassword: currentPass, newPassword: newPass })
        });

        const responseText = await res.text();
        if (!res.ok) throw new Error(responseText);

        showCustomAlert(responseText, 'Sucesso');
        document.getElementById('currentPassword').value = '';
        newPassword.value = '';
        confirmNewPassword.value = '';
    } catch (error) {
        showCustomAlert(error.message, 'Erro ao Alterar Senha');
    }
});

impersonateTesterBtn.addEventListener('click', async () => {
    showCustomConfirm(
        'Isso irá deslogar você da sua conta de Admin e logar como Tester. Deseja continuar?',
        'Entrar como Tester',
        async () => {
            try {
                const token = localStorage.getItem('chatyni_token');
                const res = await fetch(`${API_URL}/api/admin/impersonate/tester`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!res.ok) throw new Error(await res.text());

                const { token: testerToken } = await res.json();
                localStorage.setItem('chatyni_token', testerToken);
                showCustomAlert('Logado como Tester com sucesso! A página será recarregada.');
                window.location.reload();
            } catch (error) {
                showCustomAlert(`Erro ao entrar na conta Tester: ${error.message}`);
            }
        }
    );
});

// --- Navegação da Sidebar ---
sidebar.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (!link) return;

    const targetPanel = link.dataset.target;
    const action = link.dataset.action;

    if (targetPanel) {
        e.preventDefault();
        setActivePanel(targetPanel);
    } else if (action === 'logout') {
        e.preventDefault();
        logout();
    }
});

const settingsContainer = document.querySelector('.settings-container');
if (settingsContainer) {
    const tabButtons = settingsContainer.querySelectorAll('.settings-tab-btn');
    const tabContents = settingsContainer.querySelectorAll('.settings-tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Remove a classe 'active' de todos os botões e conteúdos
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            // Adiciona a classe 'active' ao botão clicado e ao conteúdo correspondente
            button.classList.add('active');
            const tabId = button.dataset.tab;
            document.getElementById(`tab-${tabId}`).classList.add('active');
        });
    });
}

profilePicInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = async (event) => {
            const base64String = event.target.result;

            try {
                const token = localStorage.getItem('chatyni_token');
                const res = await fetch(`${API_URL}/api/users/me/avatar`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ avatarData: base64String })
                });

                if (!res.ok) {
                    throw new Error(await res.text());
                }

                const data = await res.json();
                profilePic.src = data.avatarUrl; // Atualiza a foto no painel
                await refreshCurrentUser(token); // Sincroniza o usuário para atualizar o avatar em outros lugares
                showCustomAlert('Foto de perfil atualizada com sucesso!');

            } catch (error) {
                console.error('Erro ao atualizar avatar:', error);
                showCustomAlert(`Erro ao atualizar foto: ${error.message}`);
            }
        };
        reader.readAsDataURL(file);
    }
});

async function buildBannedIpList() {
    try {
        const token = localStorage.getItem('chatyni_token');
        const res = await fetch(`${API_URL}/api/admin/banned-ips`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) throw new Error('Não foi possível carregar a lista de IPs banidos.');
        const bannedIPs = await res.json();

        const bannedIpListEl = document.getElementById('bannedIpList');
        bannedIpListEl.innerHTML = ''; // Limpa a lista

        if (bannedIPs.length === 0) {
            bannedIpListEl.innerHTML = '<li>Nenhum IP banido.</li>';
        } else {
            bannedIPs.forEach(ip => {
                const li = document.createElement('li');
                li.textContent = ip;
                bannedIpListEl.appendChild(li);
            });
        }
    } catch (error) {
        showCustomAlert(error.message, 'Erro no Admin Panel');
    }
}

document.getElementById('ipBanForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const ipInput = document.getElementById('ipBanInput');
    const ip = ipInput.value.trim();
    if (!ip) return;

    try {
        const token = localStorage.getItem('chatyni_token');
        const res = await fetch(`${API_URL}/api/admin/ip/${encodeURIComponent(ip)}/toggle-ban`, { method: 'PUT', headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) throw new Error(await res.text());
        showCustomAlert(await res.text(), 'Gerenciamento de IP');
        ipInput.value = '';
        buildAdminUserTable(); // Refresh user list to show updated status
        buildBannedIpList(); // Refresh banned IP list
    } catch (error) {
        showCustomAlert(`Erro ao gerenciar IP: ${error.message}`);
    }
});

async function buildAdminUserTable() {
    try {
        const token = localStorage.getItem('chatyni_token');
        const res = await fetch(`${API_URL}/api/admin/users`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) throw new Error('Não foi possível carregar os usuários.');
        const users = await res.json();

        userTableBody.innerHTML = ''; // Limpa a tabela
        users.forEach(user => {
            const row = document.createElement('tr');
            row.dataset.username = user.username;
            const isBanned = user.status === 'banned';
            if (isBanned) row.style.cssText = 'opacity: 0.5; text-decoration: line-through;';
            
            let actionButtonsHTML = '';
            
            if (user.isSupremeAdmin) {
                actionButtonsHTML = '<span>Admin Supremo</span>';
            } else if (user.isAdmin) {
                // Ações para um admin normal, só visíveis para o admin supremo
                if (isSupremeAdmin) {
                    actionButtonsHTML = `
                        <button class="admin-btn warn">Avisar</button>
                        <button class="admin-btn ban">${isBanned ? 'Desbanir' : 'Banir'}</button>
                        <button class="admin-btn kick">Kickar</button>
                        <button class="admin-btn delete">Excluir</button>
                        <button class="admin-btn change-pass">Alterar Senha</button>
                        <button class="admin-btn demote">Rebaixar</button>
                    `;
                } else {
                    actionButtonsHTML = '<span>Admin</span>';
                }
            } else {
                // Ações para um usuário normal
                actionButtonsHTML = `
                    <button class="admin-btn warn">Avisar</button>
                    <button class="admin-btn ban">${isBanned ? 'Desbanir' : 'Banir'}</button>
                    <button class="admin-btn kick">Kickar</button>
                    <button class="admin-btn delete">Excluir</button>
                `;
                // Apenas o admin supremo pode alterar senha e promover
                if (isSupremeAdmin) {
                    actionButtonsHTML += `<button class="admin-btn change-pass">Alterar Senha</button>`;
                    actionButtonsHTML += `<button class="admin-btn edit-rpg">Editar RPG</button>`;
                    actionButtonsHTML += `<button class="admin-btn promote">Promover</button>`;
                }
            }

            row.innerHTML = `
                <td>${user.username}</td>
                <td>${user.ip}</td>
                <td class="action-buttons">
                    ${actionButtonsHTML}
                </td>
            `;
            userTableBody.appendChild(row);
        });
    } catch (error) {
        showCustomAlert(error.message, 'Erro no Admin Panel');
    }
}

if (supportForm) {
    supportForm.addEventListener('submit', handleSupportSubmit);
}

document.getElementById('deletedLogoutBtn')?.addEventListener('click', logout);

document.getElementById('supreme-admin-self-form')?.addEventListener('submit', handleSupremeAdminSelfEdit);

document.getElementById('supreme-admin-donate-form')?.addEventListener('submit', handleSupremeAdminDonate);

document.getElementById('rpg-enter-dungeon-btn')?.addEventListener('click', handleEnterDungeon);

document.getElementById('rpg-armory-items')?.addEventListener('click', handleArmoryBuy);

document.getElementById('rpg-fight-btn')?.addEventListener('click', handleStartBattle);
document.getElementById('rpg-fight-boss-btn')?.addEventListener('click', handleJoinBossLobby);

document.getElementById('world-boss-attack-btn')?.addEventListener('click', handleWorldBossAttack);

document.getElementById('rpg-roll-character-btn')?.addEventListener('click', handleRollCharacter);
const rpgShopItems = document.getElementById('rpg-shop-items');
if (rpgShopItems) {
    rpgShopItems.addEventListener('click', handleRpgBuy);
}

const weaponStockItems = document.getElementById('rpg-stock-items');
if (weaponStockItems) {
    weaponStockItems.addEventListener('click', handleStockBuy);
}

// Event Listeners para o painel admind0lu
document.getElementById('rpg-admin-nuke-btn')?.addEventListener('click', handleRpgAdminNuke);
document.getElementById('rpg-admin-godmode-btn')?.addEventListener('click', handleRpgAdminGodMode);
document.getElementById('rpg-admin-donate-form')?.addEventListener('submit', handleRpgAdminDonate);

// Event Listeners para o painel de Guilda
document.getElementById('guild-create-form')?.addEventListener('submit', handleCreateGuild);
document.getElementById('guild-list')?.addEventListener('click', handleJoinGuild);
document.getElementById('guild-leave-btn')?.addEventListener('click', handleLeaveGuild);
document.getElementById('guild-disband-btn')?.addEventListener('click', handleDisbandGuild);
document.querySelector('.guild-tabs')?.addEventListener('click', handleGuildTabClick);
document.getElementById('guild-chat-form')?.addEventListener('submit', handleSendGuildMessage);
document.getElementById('guild-settings-form')?.addEventListener('submit', handleSaveGuildSettings);
document.getElementById('guild-add-news-form')?.addEventListener('submit', handleAddGuildNews);
document.getElementById('guild-members-list')?.addEventListener('click', handleGuildMemberAction);


// Delegação de eventos para a tabela de tickets de suporte no painel de admin
document.getElementById('adminContent')?.addEventListener('click', (e) => {
    const row = e.target.closest('#support-ticket-table-body tr');
    if (row && row.dataset.ticketId) {
        openSupportChat(row.dataset.ticketId);
    }
});

userTableBody.addEventListener('click', async (e) => {
    const target = e.target;
    if (target.classList.contains('admin-btn')) {
        try {
            const userRow = target.closest('tr');
            const username = userRow.dataset.username;
            const token = localStorage.getItem('chatyni_token');
            
            // Encontrar o objeto do usuário para obter dados atuais para modais
            let targetUser = null;
            const usersRes = await fetch(`${API_URL}/api/admin/users`, { headers: { 'Authorization': `Bearer ${token}` } });
            const users = await usersRes.json();
            targetUser = users.find(u => u.username === username);


            if (target.classList.contains('warn')) {
                showModal({
                    title: `Avisar Usuário: ${username}`,
                    contentHTML: `
                        <label for="warnReasonInput">Motivo do Aviso</label>
                        <input type="text" id="warnReasonInput" placeholder="Ex: Linguagem imprópria no chat" required>
                    `,
                    confirmText: 'Enviar Aviso',
                    onConfirm: (values) => {
                        const reason = values.warnReasonInput;
                        if (!reason) {
                            showCustomAlert('O motivo é obrigatório para enviar um aviso.');
                            return;
                        }
                        // Emite o evento de aviso para o servidor
                        socket.emit('adminWarnUser', { username, reason });
                        showCustomAlert(`Aviso enviado para ${username}.`);
                    }
                });
            } else if (target.classList.contains('ban')) {
                const isBanning = !target.textContent.includes('Desbanir');
                if (isBanning) {
                    showModal({
                        title: `Banir Usuário: ${username}`,
                        contentHTML: `
                            <label for="banReasonInput">Motivo do Banimento</label>
                            <input type="text" id="banReasonInput" placeholder="Ex: Comportamento inadequado" required>
                            <label for="banDurationInput">Duração (em dias)</label>
                            <input type="number" id="banDurationInput" placeholder="Deixe em branco para permanente">
                        `,
                        onConfirm: async (values) => {
                            const reason = values.banReasonInput;
                            if (!reason) {
                                showCustomAlert('O motivo é obrigatório para banir um usuário.');
                                return;
                            }
                            const res = await fetch(`${API_URL}/api/admin/users/${username}/ban`, {
                                method: 'PUT',
                                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                                body: JSON.stringify({ reason, durationDays: values.banDurationInput || null })
                            });
                            if (!res.ok) throw new Error(await res.text());
                            showCustomAlert(await res.text());
                            buildAdminUserTable();
                        }
                    });
                } else { // Unbanning
                    showCustomConfirm(`Tem certeza que deseja desbanir ${username}?`, 'Confirmar Desbanimento', async () => {
                        const res = await fetch(`${API_URL}/api/admin/users/${username}/ban`, { 
                            method: 'PUT', headers: { 'Authorization': `Bearer ${token}` } 
                        });
                        if (!res.ok) throw new Error(await res.text());
                        showCustomAlert(await res.text());
                        buildAdminUserTable();
                    });
                }
            } else if (target.classList.contains('kick')) {
                showCustomConfirm(`Tem certeza que deseja kickar ${username} do site? Ele será desconectado imediatamente.`, 'Kickar Usuário', () => {
                    socket.emit('adminKickUser', { username });
                    showCustomAlert(`Sinal para kickar ${username} foi enviado.`);
                });
            } else if (target.classList.contains('delete')) {
                showModal({
                    title: `EXCLUIR CONTA: ${username}`,
                    contentHTML: `
                        <p style="color: #ff4444; font-weight: bold;">ATENÇÃO: Esta ação é permanente e não pode ser desfeita.</p>
                        <label for="deleteReasonInput">Motivo da Exclusão (obrigatório)</label>
                        <input type="text" id="deleteReasonInput" placeholder="Ex: Violação grave dos termos de serviço" required>
                    `,
                    confirmText: 'Excluir Permanentemente',
                    onConfirm: async (values) => {
                        const reason = values.deleteReasonInput;
                        if (!reason) {
                            showCustomAlert('O motivo é obrigatório para excluir uma conta.');
                            return;
                        }
                        try {
                            const res = await fetch(`${API_URL}/api/admin/users/${username}`, {
                                method: 'DELETE',
                                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                                body: JSON.stringify({ reason })
                            });
                            if (!res.ok) throw new Error(await res.text());
                            showCustomAlert(await res.text());
                        } catch (error) { showCustomAlert(`Erro ao excluir usuário: ${error.message}`); }
                    }
                });
            } else if (target.classList.contains('change-pass')) {
                showModal({
                    title: `Alterar Senha de: ${username}`,
                    contentHTML: `
                        <label for="newPasswordAdminInput">Nova Senha</label>
                        <input type="password" id="newPasswordAdminInput" placeholder="Digite a nova senha" required>
                    `,
                    onConfirm: async (values) => {
                        const newPassword = values.newPasswordAdminInput;
                        if (!newPassword) {
                            showCustomAlert('A nova senha não pode estar em branco.');
                            return;
                        }
                        const res = await fetch(`${API_URL}/api/admin/users/${username}/password`, {
                            method: 'PUT',
                            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                            body: JSON.stringify({ newPassword })
                        });
                        if (!res.ok) throw new Error(await res.text());
                        showCustomAlert(await res.text());
                    }
                });
            } else if (target.classList.contains('promote')) {
                showCustomConfirm(`Tem certeza que deseja promover ${username} a administrador? Esta ação não pode ser desfeita.`, 'Promover a Admin', async () => {
                    const res = await fetch(`${API_URL}/api/admin/users/${username}/promote`, { method: 'PUT', headers: { 'Authorization': `Bearer ${token}` } });
                    if (!res.ok) throw new Error(await res.text());
                    showCustomAlert(await res.text());
        // A atualização em tempo real para o usuário promovido é tratada pelo servidor (evento 'force_reload')
                    buildAdminUserTable();
                });
            } else if (target.classList.contains('demote')) {
                showCustomConfirm(`Tem certeza que deseja rebaixar ${username} para usuário padrão? Ele perderá todos os privilégios de administrador.`, 'Rebaixar Administrador', async () => {
                    const res = await fetch(`${API_URL}/api/admin/users/${username}/demote`, { method: 'PUT', headers: { 'Authorization': `Bearer ${token}` } });
                    if (!res.ok) throw new Error(await res.text());
                    showCustomAlert(await res.text());
                    // O servidor enviará 'force_reload' para o usuário rebaixado.
                    buildAdminUserTable();
                });
            } else if (target.classList.contains('edit-rpg')) {
                if (!targetUser || !targetUser.rpg) {
                    showCustomAlert('Não foi possível carregar os dados de RPG do usuário.');
                    return;
                }
                showModal({
                    title: `Editar RPG de: ${username}`,
                    contentHTML: `
                        <div class="rpg-edit-grid">
                            <label for="rpgLevelInput">Nível</label>
                            <input type="number" id="rpgLevelInput" value="${targetUser.rpg.level}">
                            <label for="rpgXpInput">XP</label>
                            <input type="number" id="rpgXpInput" value="${targetUser.rpg.xp}">
                            <label for="rpgCoinsInput">Moedas</label>
                            <input type="number" id="rpgCoinsInput" value="${targetUser.rpg.coins}">
                            <label for="rpgStrInput">Força</label>
                            <input type="number" id="rpgStrInput" value="${targetUser.rpg.stats.strength}">
                            <label for="rpgDexInput">Destreza</label>
                            <input type="number" id="rpgDexInput" value="${targetUser.rpg.stats.dexterity}">
                            <label for="rpgIntInput">Inteligência</label>
                            <input type="number" id="rpgIntInput" value="${targetUser.rpg.stats.intelligence}">
                            <label for="rpgDefInput">Defesa</label>
                            <input type="number" id="rpgDefInput" value="${targetUser.rpg.stats.defense || 1}">
                        </div>
                    `,
                    confirmText: 'Salvar Alterações',
                    onConfirm: async (values) => {
                        const rpgData = {
                            level: values.rpgLevelInput,
                            xp: values.rpgXpInput,
                            coins: values.rpgCoinsInput,
                            stats: {
                                strength: values.rpgStrInput,
                                dexterity: values.rpgDexInput,
                                intelligence: values.rpgIntInput,
                                defense: values.rpgDefInput
                            }
                        };
                        const res = await fetch(`${API_URL}/api/admin/users/${username}/rpg`, {
                            method: 'PUT', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(rpgData)
                        });
                        if (!res.ok) throw new Error(await res.text());
                        showCustomAlert(await res.text());
                    }
                });
            }
        } catch (error) {
            showCustomAlert(`Erro na ação de admin: ${error.message}`);
        }
    }
});

socket.on('banWarning', (data) => {
    const reason = data.reason || 'Comportamento inadequado.';
    const admin = data.admin || 'um administrador';
    showCustomAlert(`Você recebeu um aviso de ${admin}.\n\nMotivo: ${reason}\n\nEste é um aviso de banimento. A reincidência pode levar à suspensão da sua conta.`, 'AVISO');
});

socket.on('banned', (data) => {
    console.log('Você foi banido em tempo real!', data.reason);

    // 1. Mostra uma mensagem para o usuário
    showCustomAlert(`Você foi banido! Motivo: ${data.reason}`, 'Conta Suspensa');

    // 2. Atualiza os detalhes na página de banimento
    document.getElementById('bannedBy').textContent = data.bannedBy || 'Sistema';
    document.getElementById('banReason').textContent = data.reason || 'N/A';
    document.getElementById('banExpires').textContent = data.expiresAt ? new Date(data.expiresAt).toLocaleString('pt-BR') : 'Permanente';

    // 3. Mostra a tela de banimento
    setActivePanel('bannedContent');
});

socket.on('unbanned', () => {
    console.log('Você foi desbanido em tempo real!');

    // 1. Mostra uma mensagem para o usuário
    showCustomAlert('Sua conta foi desbanida e está pronta para ser reativada.', 'Você foi Desbanido!');

    // 2. Mostra a tela de reativação. O usuário precisará fazer login novamente.
    setActivePanel('unbannedContent');
});

reactivateAccountBtn.addEventListener('click', () => {
    // Limpa o estado e leva o usuário de volta à tela de login
    logout();
});

socket.on('admin:newTicket', (ticket) => {
    if (isAdmin) {
        showCustomAlert(`Novo ticket de suporte de ${ticket.user.username}!`, 'Novo Suporte');
        if (document.getElementById('adminContent').classList.contains('active')) {
            buildSupportTicketTable();
        } else {
            const badge = navSupport.querySelector('.notification-badge');
            const currentCount = badge ? parseInt(badge.textContent, 10) : 0;
            updateSupportNotification(currentCount + 1);
        }
    }
});

socket.on('support:newMessage', (data) => {
    if (data.ticketId === currentOpenTicketId) {
        // O chat já está aberto, apenas adiciona a nova mensagem
        addMessageToSupportChat(data);
    } else if (!isAdmin && data.sender.isAdmin) {
        // O usuário não está com o chat aberto e um admin respondeu
        myOpenTicketId = data.ticketId; // Garante que temos o ID do ticket
        navMyTicket.classList.remove('hidden'); // Mostra o botão do ticket

        showCustomConfirm(
            `Um administrador respondeu ao seu ticket de suporte. Deseja abrir o chat?`,
            'Nova Mensagem de Suporte',
            () => {
                openUserSupportChat(data.ticketId);
            }
        );
    }
});

socket.on('support:statusChanged', ({ ticketId, status }) => {
    if (!isAdmin) {
        showCustomAlert(`Seu ticket de suporte foi atualizado para: ${status === 'resolved' ? 'Resolvido' : 'Reaberto'}.`, 'Status do Suporte');
        myOpenTicketId = status === 'open' ? ticketId : null;
        updateUIForLoginState(); // Atualiza a visibilidade do botão "Meu Ticket Aberto"
    }
});

socket.on('newGuildMessage', (data) => {
    addMessageToGuildChat(data);
});

socket.on('guild_kicked', (data) => {
    const message = data.banned ? 'Você foi banido da guilda.' : `Você foi expulso da guilda "${data.guildName}".`;
    showCustomAlert(message, 'Aviso da Guilda');
    // Força a atualização do painel de guilda
    if (document.getElementById('guildContent').classList.contains('active')) {
        buildGuildPanel();
    }
});

socket.on('guild_disbanded', () => {
    showCustomAlert('Sua guilda foi dissolvida pelo dono.', 'Aviso da Guilda');
    currentUser.rpg.guildId = null; // Limpa o ID da guilda localmente
    if (document.getElementById('guildContent').classList.contains('active')) {
        buildGuildPanel();
    }
});

socket.on('guild_update', () => {
    // Se o painel da guilda estiver aberto, atualiza-o
    if (document.getElementById('guildContent').classList.contains('active')) {
        buildGuildPanel();
    }
});

socket.on('guild_notification', (data) => {
    showCustomAlert(data.message, data.title || 'Aviso da Guilda');
});

socket.on('kicked', (data) => {
    const reason = data.reason || 'Você foi desconectado por um moderador.';
    showCustomAlert(reason, 'Desconectado');
    logout();
});

socket.on('auth_error', (data) => {
    console.error('Erro de autenticação do Socket:', data.message);
    showCustomAlert(data.message, 'Sessão Inválida');
    logout();
});

socket.on('account_deleted', (data) => {
    document.getElementById('deletedReason').textContent = data.reason || 'Motivo não especificado.';

    // Limpa o estado local do usuário sem redirecionar para a tela de login
    currentUsername = '';
    isLoggedIn = false;
    currentUser = null;
    isAdmin = false;
    isSupremeAdmin = false;
    isTester = false;
    myOpenTicketId = null;
    localStorage.removeItem('chatyni_token');

    setActivePanel('deletedContent');
});

socket.on('chat_error', (data) => {
    showCustomAlert(data.message, 'Chat Global');
});

socket.on('admin:refreshUserList', () => {
    // Apenas atualiza se o usuário for um admin e estiver com o painel aberto
    if (isAdmin && document.getElementById('adminContent').classList.contains('active')) {
        console.log('Novo usuário registrado. Atualizando a lista de usuários...');
        buildAdminUserTable();
    }
});

// BUG FIX: Adiciona um listener para forçar o reload quando o estado do usuário muda no servidor (ex: promoção)
socket.on('force_reload', (data) => {
    showCustomAlert(data.reason || 'Sua conta foi atualizada. A página será recarregada para aplicar as mudanças.');
    setTimeout(() => window.location.reload(), 3000);
});

socket.on('rpg_update', async (data) => {
    showCustomAlert(data.reason || 'Seus status de RPG foram atualizados.');
    const token = localStorage.getItem('chatyni_token');
    await refreshCurrentUser(token); // Atualiza os dados do usuário
    updateRpgPanel(); // Atualiza a UI do painel de RPG se estiver visível
});

socket.on('connect', () => {
    console.log('Conectado ao servidor!');
    connectionStatus.classList.add('connected');
    statusText.textContent = 'Conectado';
});

socket.on('disconnect', () => {
    console.log('Desconectado do servidor.');
    connectionStatus.classList.remove('connected');
    statusText.textContent = 'Desconectado';
});

socket.on('newMessage', (data) => {
    addMessageToChat(data);
});
    
    socket.on('worldboss_update', (bossState) => {
        updateWorldBossPanel(bossState);
    });

    socket.on('stock_refreshed', (newStock) => {
        updateWeaponStockUI(newStock);
    });


function addMessageToChat(data) {
    const chatMessages = document.getElementById('chat-messages');
    const messageEl = document.createElement('div');
    messageEl.classList.add('chat-message');

    if (data.type === 'system') {
        messageEl.classList.add('system');
        messageEl.innerHTML = `
            <img src="${data.avatarUrl}" alt="Sistema" class="chat-avatar" style="width: 24px; height: 24px;">
            <span>${data.text}</span>
        `;
    } else {
        let messageContentHTML = '';
        if (data.type === 'image' && data.imageUrl) {
            messageContentHTML = `<img src="${data.imageUrl}" alt="Imagem enviada por ${data.username}" class="chat-image">`;
        } else {
            messageContentHTML = `<div class="chat-text">${data.text}</div>`;
        }
        
        const isSelf = data.username === currentUsername;
        messageEl.classList.add(isSelf ? 'self' : 'other');
        const guildTagHTML = data.guildTag ? `<span class="chat-guild-tag">[${data.guildTag}]</span>` : '';

        messageEl.innerHTML = `
            <img src="${data.avatarUrl}" alt="${data.username}" class="chat-avatar">
            <div class="chat-bubble">
                <div class="chat-username">${guildTagHTML}${data.username}</div>
                ${messageContentHTML}
            </div>
        `;
    }
    chatMessages.appendChild(messageEl);
    chatMessages.scrollTop = chatMessages.scrollHeight; // Rola para a mensagem mais recente
}

function addMessageToGuildChat(data) {
    const chatMessages = document.getElementById('guild-chat-messages');
    if (!chatMessages) return;

    const messageEl = document.createElement('div');
    const isSelf = data.username === currentUsername;
    messageEl.className = `chat-message ${isSelf ? 'self' : 'other'}`;
    messageEl.innerHTML = `
        <img src="${data.avatarUrl}" alt="${data.username}" class="chat-avatar">
        <div class="chat-bubble">
            <div class="chat-username">${data.username}</div>
            <div class="chat-text">${data.text}</div>
        </div>
    `;
    chatMessages.appendChild(messageEl);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

robloxUsernameForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = robloxUsernameInput.value.trim();
    if (!username) return;

    const submitButton = e.target.querySelector('button');
    const originalButtonText = submitButton.textContent;
    submitButton.textContent = 'Buscando...';
    submitButton.disabled = true;

    try {
        const token = localStorage.getItem('chatyni_token');
        const res = await fetch(`${API_URL}/api/users/me/roblox`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ robloxUsername: username })
        });

        if (!res.ok) throw new Error(await res.text());

        await refreshCurrentUser(token);
        setActivePanel('chatContent'); // Re-ativa o painel para atualizar a view

    } catch (error) {
        showCustomAlert(`Erro: ${error.message}`);
    } finally {
        submitButton.textContent = originalButtonText;
        submitButton.disabled = false;
    }
});

chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const messageText = chatInput.value.trim();
    if (messageText) {
        socket.emit('sendMessage', messageText);
    }
    chatInput.value = '';
});

document.getElementById('kickUserForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const kickIpInput = document.getElementById('kickIpInput');
    const ipToKick = kickIpInput.value.trim();
    if (ipToKick) {
        socket.emit('kickUserByIp', ipToKick);
        showCustomAlert(`Sinal para kickar o IP ${ipToKick} foi enviado.`);
        kickIpInput.value = '';
    }
});

document.getElementById('sendImageForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const imageUrlInput = document.getElementById('imageUrlInput');
    const imageUrl = imageUrlInput.value.trim();
    if (imageUrl) {
        socket.emit('sendImageMessage', imageUrl);
        imageUrlInput.value = '';
        // Opcional: fechar o painel ou dar feedback
        showCustomAlert('Imagem enviada!');
    }
});

function initializeAppearanceSettings() {
    // A lógica de criação de elementos foi movida para o HTML.
    // Agora, apenas adicionamos os event listeners aos elementos que já existem.
    const themeToggle = document.getElementById('themeToggle');
    const languageSelector = document.getElementById('languageSelector');

    if (!themeToggle || !languageSelector) {
        console.error("Elementos de tema ou idioma não encontrados na aba de aparência!");
        return;
    }

    themeToggle.addEventListener('change', (e) => {
        setTheme(e.target.checked ? 'dark' : 'light');
    });

    languageSelector.addEventListener('change', (e) => {
        setLanguage(e.target.value);
    });
}

async function handleRollCharacter(e) {
    const button = e.target;
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = 'Rolando...';

    try {
        const token = localStorage.getItem('chatyni_token');
        const res = await fetch(`${API_URL}/api/rpg/roll-character`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) throw new Error(await res.text());

        const result = await res.json();
        currentUser.rpg = result.rpg; // Atualiza o estado local do usuário

        updateRpgPanel(); // Atualiza a exibição de moedas, etc.
        showCharacterRollResult(result.newCharacter);
        buildCharacterList(); // Atualiza a lista de personagens possuídos

    } catch (error) {
        showCustomAlert(`Erro ao rolar personagem: ${error.message}`);
    } finally {
        button.disabled = false;
        button.textContent = originalText;
    }
}

function showCharacterRollResult(character) {
    const rarityClass = `rarity-${character.rarity}`;
    const contentHTML = `
        <div class="roll-result-modal-content">
            <h3 class="${rarityClass}">${character.name}</h3>
            <p class="rarity-label ${rarityClass}">${character.rarity}</p>
            <div class="roll-result-stats">
                <span>💪 Força:</span> <strong>${character.stats.strength}</strong>
                <span>🏃 Destreza:</span> <strong>${character.stats.dexterity}</strong>
                <span>🧠 Inteligência:</span> <strong>${character.stats.intelligence}</strong>
                <span>🛡️ Defesa:</span> <strong>${character.stats.defense}</strong>
            </div>
            <p class="roll-result-ability">"${character.ability}"</p>
        </div>
    `;

    showModal({
        title: 'Novo Herói Recrutado!',
        contentHTML: contentHTML,
        confirmText: 'OK',
        hideCancel: true
    });
}

function buildCharacterList() {
    const listContainer = document.getElementById('rpg-character-list');
    if (!listContainer) return;

    const characters = currentUser?.rpg?.characters || [];

    if (characters.length === 0) {
        listContainer.innerHTML = '<p>Você ainda não recrutou nenhum herói. Tente a sorte na Taverna!</p>';
        return;
    }

    listContainer.innerHTML = ''; // Limpa a lista
    characters.forEach(char => {
        const card = document.createElement('div');
        const rarityClass = `rarity-${char.rarity}`;
        card.className = `character-card ${rarityClass}`;
        card.innerHTML = `
            <h4 class="${rarityClass}">${char.name}</h4>
            <p><strong>For:</strong> ${char.stats.strength} | <strong>Dex:</strong> ${char.stats.dexterity}</p>
            <p><strong>Int:</strong> ${char.stats.intelligence} | <strong>Def:</strong> ${char.stats.defense}</p>
        `;
        listContainer.appendChild(card);
    });
}

function buildInventoryList() {
    const inventoryList = document.getElementById('rpg-inventory-list');
    if (!inventoryList) return;

    const inventory = currentUser?.rpg?.inventory || [];
    inventoryList.innerHTML = '';

    const filteredInventory = inventory.filter(item => item.quantity > 0);

    if (filteredInventory.length === 0) {
        inventoryList.innerHTML = '<li>Seu inventário está vazio.</li>';
        return;
    }

    filteredInventory.forEach(item => {
        const li = document.createElement('li');
        li.className = 'inventory-item';
        const isEquipped = item.type === 'weapon' && currentUser.rpg.equippedWeapon?.id === item.itemId;
        const actionsHTML = item.type === 'weapon' ? `
            <div class="inventory-item-actions">
                <button class="inventory-equip-btn rpg-action-btn" data-action="equip" data-item-id="${item.itemId}" ${isEquipped ? 'disabled' : ''}>${isEquipped ? 'Equipada' : 'Equipar'}</button>
                ${isEquipped ? `<button class="inventory-equip-btn rpg-action-btn flee" data-action="unequip" title="Desequipar">X</button>` : ''}
            </div>` : '';

        li.innerHTML = `
            <div>
                <span class="inventory-item-name rarity-${item.rarity}" title="${item.description}">${item.name}</span>
                ${item.quantity > 1 ? `<span class="inventory-item-quantity">x${item.quantity}</span>` : ''}
            </div>
            ${actionsHTML}
        `;
        inventoryList.appendChild(li);
    });
    inventoryList.onclick = handleInventoryAction;
}

// --- Funções de Batalha RPG ---

let currentBattle = { id: null, type: null }; // 'solo' or 'group'

async function handleStartBattle() {
    const fightButton = document.getElementById('rpg-fight-btn');
    fightButton.disabled = true;
    fightButton.textContent = 'Iniciando Batalha...';

    try {
        currentBattle = { id: null, type: 'solo' };
        const token = localStorage.getItem('chatyni_token');
        const res = await fetch(`${API_URL}/api/rpg/battle/start`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error(await res.text());

        const { battleState } = await res.json();
        showBattleModal(battleState);

    } catch (error) {
        showCustomAlert(`Erro ao iniciar batalha: ${error.message}`);
    } finally {
        fightButton.disabled = false;
        fightButton.textContent = 'Procurar Batalha';
    }
}

function showBattleModal(state) {
    const modal = document.getElementById('battle-modal-overlay');
    modal.classList.remove('hidden');
    document.getElementById('battle-log').innerHTML = ''; // Limpa o log
    updateBattleUI(state);

    // Adiciona listeners de ação uma única vez
    const controlsContainer = document.getElementById('battle-controls');
    controlsContainer.onclick = (e) => {
        const button = e.target.closest('.battle-action-btn');
        if (!button || button.disabled) return;

        const action = button.dataset.action;

        // Lógica para mostrar/esconder menu de habilidades
        if (button.id === 'battle-show-abilities-btn' && !button.disabled) {
            document.getElementById('battle-actions').classList.add('hidden');
            document.getElementById('battle-item-list').classList.add('hidden');
            document.getElementById('battle-ability-list').classList.remove('hidden');
            return;
        }
        if (button.id === 'battle-show-items-btn' && !button.disabled) {
            document.getElementById('battle-actions').classList.add('hidden');
            document.getElementById('battle-ability-list').classList.add('hidden');
            document.getElementById('battle-item-list').classList.remove('hidden');
            return;
        }
        if (button.id === 'battle-back-to-actions-btn' && !button.disabled) {
            document.getElementById('battle-actions').classList.remove('hidden');
            document.getElementById('battle-ability-list').classList.add('hidden');
            document.getElementById('battle-item-list').classList.add('hidden');
            return;
        }

        // Lógica para ações de batalha
        if (button.id === 'battle-flee-btn') {
            handleFleeBattle();
        } else if (action === 'ability') {
            const abilityId = button.dataset.abilityId;
            sendPlayerAction({ action: 'ability', abilityId });
        } else if (action === 'use_item') {
            const itemId = button.dataset.itemId;
            sendPlayerAction({ action: 'use_item', itemId });
        } else {
            sendPlayerAction({ action });
        }
    };
}

async function handleFleeBattle() {
    showCustomConfirm('Tem certeza que quer fugir da batalha?', 'Fugir', async () => {
        try {
            const token = localStorage.getItem('chatyni_token');
            const endpoint = currentBattle.type === 'group' ? '/api/rpg/boss/flee' : '/api/rpg/battle/flee';
            const res = await fetch(API_URL + endpoint, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ battleId: currentBattle.id })
            });
            if (!res.ok) throw new Error(await res.text());
            showCustomAlert(await res.text());
            closeBattleModal();
        } catch (error) {
            showCustomAlert(`Erro ao fugir: ${error.message}`);
        }
    });
}

function updateBattleUI(state) {
    const isGroupBattle = !!state.players;
    currentBattle.id = state.battleId || currentBattle.id;

    // Atualiza Monstro
    document.getElementById('monster-name').textContent = state.monster.name;
    document.getElementById('monster-image').src = state.monster.imageUrl;
    const monsterHpPercent = (state.monster.currentHp / state.monster.maxHp) * 100;
    document.getElementById('monster-hp-bar').style.width = `${monsterHpPercent}%`;
    document.getElementById('monster-hp-text').textContent = `${state.monster.currentHp} / ${state.monster.maxHp}`;

    // Atualiza Jogador(es)
    const partyContainer = document.getElementById('battle-party-container');
    partyContainer.innerHTML = '';
    const players = isGroupBattle ? state.players : [state.player];

    players.forEach((player, index) => {
        const playerCard = document.createElement('div');
        playerCard.className = 'battle-participant player';
        if (!player.isAlive) playerCard.classList.add('dead');

        const isActiveTurn = isGroupBattle ? state.currentPlayerIndex === index : true;
        if (isActiveTurn && player.isAlive) playerCard.classList.add('active-turn');

        const playerHpPercent = (player.hp / player.maxHp) * 100;
        const playerMpPercent = (player.mana / player.maxMana) * 100;

        playerCard.innerHTML = `
            <img src="${player.avatarUrl}" alt="${player.username}" class="player-sprite">
            <h3>${player.username}</h3>
            <div class="hp-bar-container"><div class="hp-bar" style="width: ${playerHpPercent}%;"></div></div>
            <p>${player.hp} / ${player.maxHp}</p>
            <div class="mp-bar-container"><div class="mp-bar" style="width: ${playerMpPercent}%;"></div></div>
            <p>${player.mana} / ${player.maxMana}</p>
        `;
        partyContainer.appendChild(playerCard);
    });

    // Habilita/desabilita botões de ação
    const myUsername = currentUser.username;
    const myTurn = isGroupBattle ? (state.players[state.currentPlayerIndex]?.username === myUsername && state.players[state.currentPlayerIndex]?.isAlive) : true;
    document.querySelectorAll('#battle-controls .battle-action-btn').forEach(btn => {
        btn.disabled = !myTurn;
    });
    // O botão de fugir sempre fica habilitado
    document.getElementById('battle-flee-btn').disabled = false;

    const currentPlayer = isGroupBattle ? state.players.find(p => p.username === myUsername) : state.player;

    // Atualiza Log
    const logContainer = document.getElementById('battle-log');
    state.log.forEach(line => {
        const p = document.createElement('p');
        if (line.includes('derrotou')) p.className = 'battle-log-victory';
        if (line.includes('derrotado')) p.className = 'battle-log-defeat';
        if (line.includes('PARABÉNS')) p.className = 'battle-log-levelup';
        p.innerHTML = line.replace(/\n/g, '<br>'); // Permite quebras de linha no log
        logContainer.appendChild(p);
    });
    logContainer.scrollTop = logContainer.scrollHeight;
    state.log = []; // Limpa o log do estado para não duplicar

    // Popula a lista de habilidades
    const abilityListContainer = document.getElementById('battle-ability-list');
    const backButtonHTML = '<button id="battle-back-to-actions-btn" class="battle-action-btn">⬅️ Voltar</button>';
    abilityListContainer.innerHTML = ''; // Limpa
    
    const abilities = isGroupBattle ? (state.players.find(p => p.username === myUsername)?.abilities || []) : state.player.abilities;
    if (abilities.length > 0) {
        document.getElementById('battle-show-abilities-btn').classList.remove('hidden');
        const abilityButtonsHTML = abilities.map(ability => {
            const canAfford = currentPlayer.mana >= ability.cost;
            return `<button class="battle-action-btn ability" data-action="ability" data-ability-id="${ability.id}" ${!canAfford ? 'disabled' : ''} title="${ability.description}">
                        ${ability.name} (${ability.cost})
                    </button>`;
        }).join('');
        abilityListContainer.innerHTML = abilityButtonsHTML + backButtonHTML;
    } else {
        document.getElementById('battle-show-abilities-btn').classList.add('hidden');
    }
    
    // Popula a lista de itens
    const itemListContainer = document.getElementById('battle-item-list');
    itemListContainer.innerHTML = ''; // Limpa

    const inventory = currentPlayer?.inventory || [];
    const usableItems = inventory.filter(item => item.type === 'consumable' && item.quantity > 0);

    if (usableItems.length > 0) {
        document.getElementById('battle-show-items-btn').classList.remove('hidden');
        const itemButtonsHTML = usableItems.map(item => {
            return `<button class="battle-action-btn item" data-action="use_item" data-item-id="${item.itemId}" title="${item.description}">
                        ${item.name} (x${item.quantity})
                    </button>`;
        }).join('');
        itemListContainer.innerHTML = itemButtonsHTML + backButtonHTML;
    } else {
        document.getElementById('battle-show-items-btn').classList.add('hidden');
    }
    
    document.getElementById('battle-actions').classList.remove('hidden');
    document.getElementById('battle-ability-list').classList.add('hidden');
    document.getElementById('battle-item-list').classList.add('hidden');

    // Gerencia o fim da batalha
    if (state.gameOver) {
        if (state.dungeonComplete) {
            // Vitória final da Dungeon
            document.querySelectorAll('#battle-controls .battle-action-btn').forEach(btn => btn.disabled = true);
            setTimeout(() => {
                closeBattleModal();
                currentUser.rpg = state.updatedRpg;
                updateRpgPanel();
                updateDailyQuestPanel();
                buildRpgRanking();
            }, 5000); // Tempo maior para ler a recompensa
        } else if (state.stageClear) {
            // Mostra o hub da dungeon para prosseguir
            showDungeonHub(state);
        } else {
            // Fim de batalha normal (solo ou derrota na dungeon)
            document.querySelectorAll('#battle-controls .battle-action-btn').forEach(btn => btn.disabled = true);
            setTimeout(() => {
                closeBattleModal();
                if (state.victory && state.updatedRpg) { // Apenas se for vitória de batalha normal
                    currentUser.rpg = state.updatedRpg;
                    updateRpgPanel();
                    updateDailyQuestPanel();
                    buildRpgRanking();
                }
            }, 4000);
        }
    }
}

async function sendPlayerAction(actionData) {
    const actionButtons = document.querySelectorAll('#battle-controls .battle-action-btn');
    actionButtons.forEach(btn => btn.disabled = true);

    try {
        const token = localStorage.getItem('chatyni_token');
        const endpoint = currentBattle.type === 'group' ? '/api/rpg/boss/action' : '/api/rpg/battle/action';
        const body = currentBattle.type === 'group' ? { ...actionData, battleId: currentBattle.id } : actionData;
        const res = await fetch(API_URL + endpoint, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        // Trata erro de "mana insuficiente" sem fechar o modal
        if (res.status === 400) {
            const error = await res.json();
            showCustomAlert(error.message || 'Ação inválida.');
            actionButtons.forEach(btn => btn.disabled = false); // Reabilita botões para nova tentativa
            return;
        }

        if (!res.ok) throw new Error(await res.text());

        const { battleState } = await res.json();
        updateBattleUI(battleState);

    } catch (error) {
        showCustomAlert(`Erro na ação: ${error.message}`);
    } finally {
        // Re-abilita os botões se a batalha não acabou
        if (!document.getElementById('battle-modal-overlay').classList.contains('hidden')) {
             // A re-habilitação agora é controlada pelo updateBattleUI com base no turno
        }
    }
}

function closeBattleModal() {
    document.getElementById('battle-modal-overlay').classList.add('hidden');
    document.getElementById('battle-controls').onclick = null; // Remove o listener para evitar múltiplos registros
}

async function handleJoinBossLobby() {
    const bossButton = document.getElementById('rpg-fight-boss-btn');
    const originalText = bossButton.textContent;
    bossButton.disabled = true;
    bossButton.textContent = 'Entrando na fila...';

    try {
        currentBattle = { id: null, type: 'group' };
        const token = localStorage.getItem('chatyni_token');
        const res = await fetch(`${API_URL}/api/rpg/boss/join-lobby`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error(await res.text());
        const result = await res.json();
        showCustomAlert(result.message, 'Fila para o Chefe');
        // O botão será atualizado pelo evento 'boss_lobby_update'
    } catch (error) {
        showCustomAlert(`Erro ao entrar na fila: ${error.message}`);
        bossButton.disabled = false;
        bossButton.textContent = originalText;
    }
}

async function handleEnterDungeon() {
    const dungeonButton = document.getElementById('rpg-enter-dungeon-btn');
    dungeonButton.disabled = true;
    dungeonButton.textContent = 'Entrando...';

    try {
        currentBattle = { id: null, type: 'dungeon' };
        const token = localStorage.getItem('chatyni_token');
        const res = await fetch(`${API_URL}/api/rpg/dungeon/start`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ dungeonId: 'goblin_cave' }) // Futuramente, pode ser dinâmico
        });
        if (!res.ok) throw new Error(await res.text());

        const { battleState } = await res.json();
        showBattleModal(battleState);

    } catch (error) {
        showCustomAlert(`Erro ao entrar na dungeon: ${error.message}`);
    } finally {
        dungeonButton.disabled = false;
        dungeonButton.textContent = 'Entrar na Caverna';
    }
}

function showDungeonHub(state) {
    const battleContainer = document.getElementById('battle-modal-container');
    
    battleContainer.querySelector('.battle-scene').style.display = 'none';
    battleContainer.querySelector('#battle-controls').style.display = 'none';

    let hub = document.getElementById('dungeon-hub');
    if (!hub) {
        hub = document.createElement('div');
        hub.id = 'dungeon-hub';
        battleContainer.insertBefore(hub, battleContainer.querySelector('#battle-log-container'));
    }
    
    hub.style.display = 'block';
    hub.innerHTML = `
        <h2>Andar Concluído!</h2>
        <p>Sua vida e mana foram preservadas. Deseja continuar?</p>
        <div class="dungeon-hub-actions">
            <button id="dungeon-proceed-btn" class="rpg-action-btn">Avançar</button>
            <button id="dungeon-leave-btn" class="rpg-action-btn flee">Abandonar Dungeon</button>
        </div>
    `;

    document.getElementById('dungeon-proceed-btn').onclick = handleDungeonProceed;
    document.getElementById('dungeon-leave-btn').onclick = handleDungeonLeave;
}

async function handleDungeonProceed() {
    const proceedBtn = document.getElementById('dungeon-proceed-btn');
    proceedBtn.disabled = true;
    proceedBtn.textContent = 'Avançando...';

    try {
        const token = localStorage.getItem('chatyni_token');
        const res = await fetch(`${API_URL}/api/rpg/dungeon/proceed`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error(await res.text());

        const { battleState } = await res.json();
        
        document.getElementById('dungeon-hub').style.display = 'none';
        document.getElementById('battle-modal-container').querySelector('.battle-scene').style.display = 'flex';
        document.getElementById('battle-modal-container').querySelector('#battle-controls').style.display = 'block';

        updateBattleUI(battleState);

    } catch (error) {
        showCustomAlert(`Erro ao avançar: ${error.message}`);
        closeBattleModal();
    }
}

function handleDungeonLeave() {
    showCustomConfirm('Tem certeza que quer abandonar a dungeon? Todo o progresso e recompensas serão perdidos.', 'Abandonar', async () => {
        try {
            const token = localStorage.getItem('chatyni_token');
            const res = await fetch(`${API_URL}/api/rpg/dungeon/leave`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
            if (!res.ok) throw new Error(await res.text());
            showCustomAlert((await res.json()).message);
            closeBattleModal();
        } catch (error) {
            showCustomAlert(`Erro ao abandonar: ${error.message}`);
        }
    });
}

async function handleInventoryAction(e) {
    const button = e.target.closest('button[data-action]');
    if (!button) return;

    const action = button.dataset.action;
    const itemId = button.dataset.itemId;

    if (action === 'equip' || action === 'unequip') {
        try {
            const token = localStorage.getItem('chatyni_token');
            const res = await fetch(`${API_URL}/api/rpg/inventory/equip`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ itemId: action === 'equip' ? itemId : null }) // Envia null para desequipar
            });
            if (!res.ok) throw new Error(await res.text());
            const result = await res.json();
            currentUser.rpg = result.rpg;
            showCustomAlert(result.message, 'Equipamento');
            updateRpgPanel();
            buildInventoryList(); // Rebuild to show new equipped status
        } catch (error) {
            showCustomAlert(`Erro: ${error.message}`);
        }
    }
}

async function buildArmory() {
    const armoryList = document.getElementById('rpg-armory-items');
    if (!armoryList) return;
    armoryList.innerHTML = '<li>Carregando...</li>';
    try {
        const token = localStorage.getItem('chatyni_token');
        const res = await fetch(`${API_URL}/api/rpg/armory`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) throw new Error('Não foi possível carregar a armaria.');
        const items = await res.json();
        armoryList.innerHTML = '';
        items.forEach(item => {
            const li = document.createElement('li');
            li.className = 'shop-item'; // Reusing shop item style
            const canAfford = currentUser.rpg.coins >= item.price;
            const ownsItem = currentUser.rpg.inventory.some(i => i.itemId === item.id);
            li.innerHTML = `
                <div class="shop-item-header">
                    <span class="rarity-${item.rarity}">${item.name}</span>
                    <span class="shop-item-price">${item.price} 🪙</span>
                </div>
                <p class="shop-item-desc">${item.description}</p>
                <button class="shop-item-buy-btn" data-weapon-id="${item.id}" ${canAfford && !ownsItem ? '' : 'disabled'}>
                    ${ownsItem ? 'Adquirida' : (canAfford ? 'Forjar' : 'Moedas insuficientes')}
                </button>
            `;
            armoryList.appendChild(li);
        });
    } catch (error) {
        armoryList.innerHTML = `<li>Erro: ${error.message}</li>`;
    }
}

async function handleArmoryBuy(e) {
    if (!e.target.matches('.shop-item-buy-btn[data-weapon-id]')) return;
    const button = e.target;
    const weaponId = button.dataset.weaponId;
    showCustomConfirm(`Forjar esta arma?`, 'Confirmar Forja', async () => {
        try {
            const token = localStorage.getItem('chatyni_token');
            const res = await fetch(`${API_URL}/api/rpg/armory/buy`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ weaponId })
            });
            if (!res.ok) throw new Error(await res.text());
            const result = await res.json();
            currentUser.rpg = result.rpg;
            showCustomAlert(result.message, 'Sucesso!');
            updateRpgPanel();
            buildInventoryList();
            buildArmory(); // Rebuild to update button states
        } catch (error) {
            showCustomAlert(`Erro ao forjar: ${error.message}`);
        }
    });
}

async function fetchWorldBossStatus() {
    try {
        const token = localStorage.getItem('chatyni_token');
        const res = await fetch(`${API_URL}/api/rpg/worldboss/status`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Falha ao buscar status do chefe.');
        const bossState = await res.json();
        updateWorldBossPanel(bossState);
    } catch (error) {
        console.warn(error.message);
        updateWorldBossPanel(null);
    }
}

function updateWorldBossPanel(bossState) {
    const panel = document.getElementById('world-boss-panel');
    if (!panel) return;

    if (bossState && bossState.currentHp > 0) {
        panel.classList.remove('hidden');
        document.getElementById('world-boss-name').textContent = bossState.name;
        const hpPercent = (bossState.currentHp / bossState.maxHp) * 100;
        document.getElementById('world-boss-hp-bar').style.width = `${hpPercent}%`;
        document.getElementById('world-boss-hp-text').textContent = `${bossState.currentHp} / ${bossState.maxHp}`;
    } else {
        panel.classList.add('hidden');
    }
}

async function handleWorldBossAttack() {
    const button = document.getElementById('world-boss-attack-btn');
    button.disabled = true;

    try {
        const token = localStorage.getItem('chatyni_token');
        const res = await fetch(`${API_URL}/api/rpg/worldboss/attack`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error(await res.text());

        const result = await res.json();
        // A UI será atualizada pelo evento de socket 'worldboss_update'
        // Mas podemos mostrar um feedback imediato
        showCustomAlert(`Você causou ${result.damageDealt} de dano ao Chefe Mundial!`, 'Ataque Realizado');

    } catch (error) {
        showCustomAlert(`Erro ao atacar: ${error.message}`);
    } finally {
        // Reabilita o botão após um cooldown para evitar spam
        setTimeout(() => { button.disabled = false; }, 2000); // Cooldown de 2 segundos
    }
}
// --- Funções do Sistema de Suporte ---

async function handleRpgAdminNuke() {
    showCustomConfirm('Tem certeza que quer lançar uma Nuke global? Isso enviará uma mensagem para todos no chat.', 'Confirmar Nuke', async () => {
        try {
            const token = localStorage.getItem('chatyni_token');
            const res = await fetch(`${API_URL}/api/rpg/admin/nuke`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error(await res.text());
            const result = await res.json();
            showCustomAlert(result.message, 'Sucesso!');
        } catch (error) {
            showCustomAlert(`Erro ao lançar nuke: ${error.message}`);
        }
    });
}

async function handleRpgAdminGodMode() {
    try {
        const token = localStorage.getItem('chatyni_token');
        const res = await fetch(`${API_URL}/api/rpg/admin/toggle-godmode`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error(await res.text());
        const result = await res.json();
        currentUser.rpg = result.rpg; // Atualiza o estado local
        updateRpgPanel(); // Atualiza a UI
        showCustomAlert(result.message, 'Modo Admin');
    } catch (error) {
        showCustomAlert(`Erro ao alterar God Mode: ${error.message}`);
    }
}

async function handleRpgAdminDonate(e) {
    e.preventDefault();
    const xpInput = document.getElementById('rpg-admin-donate-xp');
    const coinsInput = document.getElementById('rpg-admin-donate-coins');
    const xp = xpInput.value;
    const coins = coinsInput.value;

    if (!xp && !coins) return;

    try {
        const token = localStorage.getItem('chatyni_token');
        const res = await fetch(`${API_URL}/api/rpg/admin/donate`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ xp, coins })
        });
        if (!res.ok) throw new Error(await res.text());
        const result = await res.json();
        currentUser.rpg = result.rpg; // Atualiza o estado local
        updateRpgPanel(); // Atualiza a UI
        showCustomAlert(result.message, 'Doação Realizada');
        xpInput.value = '';
        coinsInput.value = '';
    } catch (error) {
        showCustomAlert(`Erro ao doar: ${error.message}`);
    }
}

async function handleClaimQuestReward() {
    const claimBtn = document.getElementById('quest-claim-btn');
    claimBtn.disabled = true;

    try {
        const token = localStorage.getItem('chatyni_token');
        const res = await fetch(`${API_URL}/api/rpg/quest/claim`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error(await res.text());

        const result = await res.json();
        currentUser.rpg = result.rpg; // Atualiza o estado local com a recompensa
        showCustomAlert(result.message, 'Recompensa Coletada!');
        updateRpgPanel(); // Atualiza painel de status (moedas, xp)
        updateDailyQuestPanel(); // Atualiza painel da missão para "Concluído"
    } catch (error) {
        showCustomAlert(`Erro ao coletar recompensa: ${error.message}`);
    }
}

async function buildGuildPanel() {
    const guildView = document.getElementById('guild-view');
    const noGuildViewContainer = document.getElementById('no-guild-view');
    const noGuildView = document.getElementById('no-guild-view');

    await refreshCurrentUser(localStorage.getItem('chatyni_token'));

    if (currentUser.rpg.guildId) {
        guildView.classList.remove('hidden');
        noGuildView.classList.add('hidden');
        await fetchAndDisplayMyGuild();
    } else {
        guildView.classList.add('hidden');
        noGuildView.classList.remove('hidden');
        await fetchAndDisplayGuildList();
    }
}

async function fetchAndDisplayMyGuild() {
    try {
        const token = localStorage.getItem('chatyni_token');
        const res = await fetch(`${API_URL}/api/guilds/my-guild`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) throw new Error(await res.text());

        const guild = await res.json();

        document.getElementById('guild-view-name').textContent = guild.name;
        document.getElementById('guild-view-tag').textContent = guild.tag;
        document.getElementById('guild-view-member-count').textContent = guild.members.length;

        const memberList = document.getElementById('guild-members-list');
        memberList.innerHTML = '';
        guild.members.forEach(member => {
            const li = document.createElement('li');
            li.className = 'guild-member-item';
            let memberActionsHTML = '';
            const isMuted = guild.mutedMembers[member.username] && guild.mutedMembers[member.username] > Date.now();

            // Ações visíveis para o dono
            if (currentUser.username === guild.owner && member.username !== guild.owner) {
                memberActionsHTML = `
                    <div class="guild-member-actions">
                        <button class="admin-btn warn" data-action="kick" data-username="${member.username}">Expulsar</button>
                        <button class="admin-btn ban" data-action="ban" data-username="${member.username}">Banir</button>
                        <button class="admin-btn" data-action="${isMuted ? 'unmute' : 'mute'}" data-username="${member.username}">${isMuted ? 'Dessilenciar' : 'Silenciar'}</button>
                    </div>
                `;
            }

            li.innerHTML = `
                <div class="guild-member-info">
                    <img src="${member.avatarUrl}" alt="${member.username}" class="guild-member-avatar">
                    <span>${member.username} ${isMuted ? '🔇' : ''} ${member.username === guild.owner ? '<span style="color: #ffc107;">(Dono)</span>' : ''}</span>
                </div>
                ${memberActionsHTML}`;
            memberList.appendChild(li);
        });

        const newsList = document.getElementById('guild-news-list');
        newsList.innerHTML = guild.news.length > 0 ? guild.news.map(n => `<li class="guild-news-item"><p>${n.text}</p><div class="guild-news-header">Por ${n.author} em ${new Date(n.date).toLocaleDateString()}</div></li>`).join('') : '<li>Nenhuma notícia postada.</li>';

        const isOwner = currentUser.username === guild.owner;
        document.getElementById('guild-admin-tab-btn').classList.toggle('hidden', !isOwner);
        document.getElementById('guild-disband-btn').style.display = isOwner ? 'inline-block' : 'none';
        document.getElementById('guild-leave-btn').style.display = isOwner ? 'none' : 'inline-block';

        // Preenche o painel de admin da guilda
        if (isOwner) {
            const privateCheckbox = document.getElementById('guild-private-checkbox');
            const codeContainer = document.getElementById('guild-invite-code-container');
            const codeInput = document.getElementById('guild-invite-code-input');
            privateCheckbox.checked = guild.isPrivate;
            codeContainer.classList.toggle('hidden', !guild.isPrivate);
            codeInput.value = guild.inviteCode || '';
            privateCheckbox.onchange = () => codeContainer.classList.toggle('hidden', !privateCheckbox.checked);
        }

    } catch (error) {
        showCustomAlert(`Erro ao carregar sua guilda: ${error.message}`);
        // Se a guilda não for encontrada, o servidor corrige o estado, então reconstruímos o painel
        buildGuildPanel();
    }
}

async function fetchAndDisplayGuildList() {
    try {
        const token = localStorage.getItem('chatyni_token');
        const res = await fetch(`${API_URL}/api/guilds`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) throw new Error(await res.text());

        const guilds = await res.json();
        const guildList = document.getElementById('guild-list');
        guildList.innerHTML = '';

        if (guilds.length === 0) {
            guildList.innerHTML = '<li>Nenhuma guilda foi criada ainda. Seja o primeiro!</li>';
            return;
        }

        guilds.forEach(guild => {
            const li = document.createElement('li');
            li.className = 'guild-list-item';
            li.innerHTML = `
                <div>
                    <strong>${guild.name} ${guild.isPrivate ? '🔒' : ''}</strong> <span class="guild-tag">${guild.tag}</span>
                    <small style="display: block; color: #aaa;">Membros: ${guild.memberCount}</small>
                </div>
                <button class="rpg-action-btn" data-guild-id="${guild.id}" data-guild-private="${guild.isPrivate}">Entrar</button>
            `;
            guildList.appendChild(li);
        });
    } catch (error) {
        showCustomAlert(`Erro ao carregar lista de guildas: ${error.message}`);
    }
}

async function handleCreateGuild(e) {
    e.preventDefault();
    const name = document.getElementById('guild-create-name').value;
    const tag = document.getElementById('guild-create-tag').value;

    showCustomConfirm(`Criar a guilda "${name}" por 100 moedas?`, 'Confirmar Criação', async () => {
        try {
            const token = localStorage.getItem('chatyni_token');
            const res = await fetch(`${API_URL}/api/guilds/create`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, tag })
            });
            if (!res.ok) throw new Error(await res.text());
            const result = await res.json();
            showCustomAlert(result.message, 'Sucesso!');
            await buildGuildPanel();
            await refreshCurrentUser(token); // Refresh user to update coin count
        } catch (error) {
            showCustomAlert(`Erro ao criar guilda: ${error.message}`);
        }
    });
}

async function handleJoinGuild(e) {
    const button = e.target.closest('button[data-guild-id]');
    if (!button) return;

    const guildId = button.dataset.guildId;
    const isPrivate = button.dataset.guildPrivate === 'true';

    const joinAction = async (inviteCode = null) => {
        try {
            const token = localStorage.getItem('chatyni_token');
            const res = await fetch(`${API_URL}/api/guilds/${guildId}/join`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ inviteCode })
            });
            if (!res.ok) throw new Error(await res.text());
            const result = await res.json();
            showCustomAlert(result.message, 'Bem-vindo!');
            await buildGuildPanel();
        } catch (error) {
            showCustomAlert(`Erro ao entrar na guilda: ${error.message}`);
        }
    };

    if (isPrivate) {
        showModal({
            title: 'Guilda Privada',
            contentHTML: `
                <p>Esta guilda é privada. Por favor, insira o código de convite.</p>
                <input type="text" id="guildInviteCodeModal" placeholder="Código de Convite" required>
            `,
            confirmText: 'Entrar',
            onConfirm: (values) => {
                joinAction(values.guildInviteCodeModal);
            }
        });
    } else {
        joinAction();
    }
}

function handleLeaveGuild() {
    showCustomConfirm('Tem certeza que deseja sair da sua guilda?', 'Sair da Guilda', async () => {
        try {
            const token = localStorage.getItem('chatyni_token');
            const res = await fetch(`${API_URL}/api/guilds/leave`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error(await res.text());
            const result = await res.json();
            showCustomAlert(result.message, 'Até logo!');
        } catch (error) {
            showCustomAlert(`Erro ao sair da guilda: ${error.message}`);
        }
    });
}

function handleDisbandGuild() {
    showCustomConfirm('Você tem certeza que quer dissolver sua guilda? Esta ação é irreversível e todos os membros serão removidos.', 'Disbandar Guilda', async () => {
        try {
            const token = localStorage.getItem('chatyni_token');
            const res = await fetch(`${API_URL}/api/guilds/my-guild`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
            if (!res.ok) throw new Error(await res.text());
            const result = await res.json();
            showCustomAlert(result.message, 'Guilda Dissolvida');
        } catch (error) {
            showCustomAlert(`Erro ao dissolver a guilda: ${error.message}`);
        }
    });
}

function handleGuildTabClick(e) {
    const tabBtn = e.target.closest('.guild-tab-btn');
    if (!tabBtn) return;

    // Desativa todas as abas e conteúdos
    document.querySelectorAll('.guild-tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.guild-tab-content').forEach(content => content.classList.remove('active'));

    // Ativa a aba clicada e seu conteúdo
    tabBtn.classList.add('active');
    const contentPanel = document.getElementById(tabBtn.dataset.tab);
    if (contentPanel) contentPanel.classList.add('active');
}

function handleSendGuildMessage(e) {
    e.preventDefault();
    const input = document.getElementById('guild-chat-input');
    const message = input.value.trim();
    if (message) {
        socket.emit('sendGuildMessage', message);
        input.value = '';
    }
}

async function handleAddGuildNews(e) {
    e.preventDefault();
    const text = document.getElementById('guild-add-news-text').value.trim();
    if (!text) return;

    try {
        const token = localStorage.getItem('chatyni_token');
        const res = await fetch(`${API_URL}/api/guilds/admin/news`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
        });
        if (!res.ok) throw new Error(await res.text());
        const result = await res.json();
        showCustomAlert(result.message, 'Sucesso');
        document.getElementById('guild-add-news-text').value = '';
        // A atualização da UI será feita pelo evento 'guild_update' do socket
    } catch (error) {
        showCustomAlert(`Erro ao publicar notícia: ${error.message}`);
    }
}

async function handleGuildMemberAction(e) {
    const button = e.target.closest('button[data-action]');
    if (!button) return;

    const action = button.dataset.action;
    const username = button.dataset.username;
    const token = localStorage.getItem('chatyni_token');
    let endpoint = '';
    let body = { username };
    let confirmationMsg = '';

    switch (action) {
        case 'kick':
            endpoint = '/api/guilds/admin/kick';
            confirmationMsg = `Tem certeza que quer expulsar ${username}?`;
            break;
        case 'ban':
            endpoint = '/api/guilds/admin/ban';
            confirmationMsg = `Tem certeza que quer BANIR ${username} da guilda? Ele não poderá entrar novamente.`;
            break;
        case 'mute':
            endpoint = '/api/guilds/admin/mute';
            confirmationMsg = `Silenciar ${username} no chat da guilda por 5 minutos?`;
            break;
        case 'unmute':
            endpoint = '/api/guilds/admin/unmute';
            confirmationMsg = `Dessilenciar ${username}?`;
            break;
        default: return;
    }

    showCustomConfirm(confirmationMsg, 'Confirmar Ação', async () => {
        try {
            const res = await fetch(API_URL + endpoint, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            if (!res.ok) throw new Error(await res.text());
            showCustomAlert(await res.text(), 'Sucesso');
        } catch (error) {
            showCustomAlert(`Erro: ${error.message}`);
        }
    });
}

async function handleSaveGuildSettings(e) {
    e.preventDefault();
    const isPrivate = document.getElementById('guild-private-checkbox').checked;
    const inviteCode = document.getElementById('guild-invite-code-input').value;

    const settings = { isPrivate, inviteCode };

    try {
        const token = localStorage.getItem('chatyni_token');
        const res = await fetch(`${API_URL}/api/guilds/admin/settings`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(settings)
        });
        if (!res.ok) throw new Error(await res.text());
        const result = await res.json();
        showCustomAlert(result.message, 'Sucesso');
        // A UI será atualizada pelo evento 'guild_update'
    } catch (error) {
        showCustomAlert(`Erro ao salvar configurações: ${error.message}`);
    }
}

async function buildRpgRanking() {
    const rankingList = document.getElementById('rpg-ranking-list');
    if (!rankingList) return;

    rankingList.innerHTML = '<li>Carregando ranking...</li>';

    try {
        const token = localStorage.getItem('chatyni_token');
        const res = await fetch(`${API_URL}/api/rpg/ranking`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Não foi possível carregar o ranking.');

        const ranking = await res.json();
        rankingList.innerHTML = ''; // Limpa a lista

        if (ranking.length === 0) {
            rankingList.innerHTML = '<li>Nenhum jogador no ranking ainda.</li>';
            return;
        }

        const medals = ['🥇', '🥈', '🥉'];

        ranking.forEach((player, index) => {
            const li = document.createElement('li');
            li.className = 'ranking-item';
            
            const position = medals[index] || `${index + 1}.`;

            li.innerHTML = `
                <span class="ranking-position">${position}</span>
                <img src="${player.avatarUrl}" alt="${player.username}" class="ranking-avatar">
                <div class="ranking-info">
                    <span class="ranking-username">${player.username}</span>
                    <span class="ranking-stats">Nível ${player.level} - ${player.xp} XP</span>
                </div>
            `;
            rankingList.appendChild(li);
        });
    } catch (error) {
        rankingList.innerHTML = `<li>Erro ao carregar o ranking: ${error.message}</li>`;
    }
}

async function buildRpgShop() {
    const shopList = document.getElementById('rpg-shop-items');
    if (!shopList) return;

    shopList.innerHTML = '<li>Carregando itens...</li>';

    try {
        const token = localStorage.getItem('chatyni_token');
        const res = await fetch(`${API_URL}/api/rpg/shop`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Não foi possível carregar a loja.');

        const items = await res.json();
        shopList.innerHTML = ''; // Limpa a lista

        if (items.length === 0) {
            shopList.innerHTML = '<li>A loja está vazia no momento.</li>';
            return;
        }

        items.forEach(item => {
            const li = document.createElement('li');
            li.className = 'shop-item';
            const canAfford = currentUser.rpg.coins >= item.price;

            li.innerHTML = `
                <div class="shop-item-header">
                    <span>${item.name}</span>
                    <span class="shop-item-price">${item.price} 🪙</span>
                </div>
                <p class="shop-item-desc">${item.description}</p>
                <button class="shop-item-buy-btn" data-item-id="${item.id}" data-item-name="${item.name}" data-item-price="${item.price}" ${canAfford ? '' : 'disabled'}>
                    ${canAfford ? 'Comprar' : 'Moedas insuficientes'}
                </button>
            `;
            shopList.appendChild(li);
        });

    } catch (error) {
        shopList.innerHTML = `<li>Erro ao carregar a loja: ${error.message}</li>`;
    }
}

async function handleRpgBuy(e) {
    if (!e.target.classList.contains('shop-item-buy-btn')) return;

    const button = e.target;
    const itemId = button.dataset.itemId;
    const itemName = button.dataset.itemName;
    const itemPrice = button.dataset.itemPrice;

    showCustomConfirm(`Você tem certeza que quer comprar "${itemName}" por ${itemPrice} moedas?`, 'Confirmar Compra', async () => {
        try {
            const token = localStorage.getItem('chatyni_token');
            const res = await fetch(`${API_URL}/api/rpg/shop/buy`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ itemId })
            });
            if (!res.ok) throw new Error(await res.text());
            const result = await res.json();
            currentUser.rpg = result.rpg; // Atualiza o estado local
            updateRpgPanel(); // Atualiza a UI de status
            buildRpgShop(); // Reconstrói a loja para atualizar os botões (ex: disabled)
            buildInventoryList(); // Atualiza a lista de inventário
            buildRpgRanking(); // Atualiza o ranking após a compra
            showCustomAlert(result.message, 'Compra Realizada!');
        } catch (error) {
            showCustomAlert(`Erro na compra: ${error.message}`);
        }
    });
}

async function buildSupremeAdminPanel() {
    const checklistContainer = document.getElementById('my-characters-checklist');
    const levelInput = document.getElementById('my-level-input');
    if (!checklistContainer || !levelInput) return;

    levelInput.value = currentUser.rpg.level;
    const myCharacterIds = new Set((currentUser.rpg.characters || []).map(c => c.id));

    try {
        const token = localStorage.getItem('chatyni_token');
        const res = await fetch(`${API_URL}/api/rpg/all-characters`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) throw new Error('Falha ao carregar lista de personagens.');
        
        const allCharacters = await res.json();
        checklistContainer.innerHTML = '';

        for (const rarity in allCharacters) {
            const groupDiv = document.createElement('div');
            groupDiv.className = 'character-checklist-group';
            
            const title = document.createElement('h4');
            title.textContent = rarity;
            title.className = `rarity-${rarity}`;
            groupDiv.appendChild(title);

            allCharacters[rarity].forEach(char => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'character-checklist-item';
                const isChecked = myCharacterIds.has(char.id);
                itemDiv.innerHTML = `
                    <input type="checkbox" id="char-check-${char.id}" value="${char.id}" ${isChecked ? 'checked' : ''}>
                    <label for="char-check-${char.id}" class="rarity-${char.rarity}">${char.name}</label>
                `;
                groupDiv.appendChild(itemDiv);
            });
            checklistContainer.appendChild(groupDiv);
        }

    } catch (error) {
        checklistContainer.innerHTML = `<p style="color: red;">${error.message}</p>`;
    }
}

async function handleSupremeAdminSelfEdit(e) {
    e.preventDefault();
    const level = document.getElementById('my-level-input').value;
    const checkedBoxes = document.querySelectorAll('#my-characters-checklist input[type="checkbox"]:checked');
    const characterIds = Array.from(checkedBoxes).map(cb => cb.value);

    const data = { level: parseInt(level, 10), characterIds };

    try {
        const token = localStorage.getItem('chatyni_token');
        const res = await fetch(`${API_URL}/api/admin/me/rpg`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error(await res.text());
        const result = await res.json();
        showCustomAlert(result.message, 'Sucesso');

        // Atualiza o estado local e a UI imediatamente para uma experiência em tempo real
        currentUser.rpg = result.rpg;
        updateRpgPanel();

    } catch (error) {
        showCustomAlert(`Erro ao salvar alterações: ${error.message}`);
    }
}

async function handleSupremeAdminDonate(e) {
    e.preventDefault();
    const form = e.target;
    const username = form.querySelector('#donate-username-input').value;
    const xp = form.querySelector('#donate-xp-input').value;
    const coins = form.querySelector('#donate-coins-input').value;
    const message = form.querySelector('#donate-message-input').value;

    if (!username) {
        showCustomAlert('Por favor, insira o nome de um jogador.');
        return;
    }
    if ((!xp || xp <= 0) && (!coins || coins <= 0)) {
        showCustomAlert('Por favor, insira uma quantidade positiva de XP ou moedas para doar.');
        return;
    }

    const data = {
        username,
        xp: parseInt(xp, 10) || 0,
        coins: parseInt(coins, 10) || 0,
        message: message.trim()
    };

    try {
        const token = localStorage.getItem('chatyni_token');
        const res = await fetch(`${API_URL}/api/admin/donate-to-player`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error(await res.text());
        showCustomAlert((await res.json()).message, 'Doação Enviada');
        form.reset();
    } catch (error) {
        showCustomAlert(`Erro ao doar: ${error.message}`);
    }
}

async function handleSupportSubmit(e) {
    e.preventDefault();
    const category = document.getElementById('support-category').value;
    const description = document.getElementById('support-description').value;

    const body = { category, description };
    const headers = { 'Content-Type': 'application/json' };
    const token = localStorage.getItem('chatyni_token');

    if (isLoggedIn && token) {
        headers['Authorization'] = `Bearer ${token}`;
    } else {
        const email = document.getElementById('support-email').value;
        if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
            showCustomAlert('Por favor, insira um email válido para que possamos entrar em contato.');
            return;
        }
        body.email = email;
    }

    if (!description.trim()) {
        showCustomAlert('Por favor, descreva seu problema em detalhes.');
        return;
    }

    try {
        const res = await fetch(`${API_URL}/api/support/tickets`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(body)
        });

        if (!res.ok) throw new Error(await res.text());

        const newTicket = await res.json();
        myOpenTicketId = newTicket._id; // Armazena o ID do novo ticket

        showCustomAlert('Seu ticket de suporte foi enviado com sucesso! Nossa equipe responderá em breve.', 'Suporte Enviado');
        supportForm.reset();
        // Volta para a tela de login se não estiver logado, ou para a de boas-vindas se estiver
        setActivePanel(isLoggedIn ? 'welcomeContent' : 'loginContent');
        updateUIForLoginState(); // Mostra o botão "Meu Ticket Aberto" imediatamente

    } catch (error) {
        showCustomAlert(`Erro ao enviar ticket: ${error.message}`, 'Erro');
    }
}

async function buildSupportTicketTable() {
    if (!isAdmin) return;
    const container = document.querySelector('.support-ticket-container');
    if (!container) return;

    try {
        const token = localStorage.getItem('chatyni_token');
        const res = await fetch(`${API_URL}/api/support/tickets`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) throw new Error('Não foi possível carregar os tickets de suporte.');
        const tickets = await res.json();

        const tableBody = document.getElementById('support-ticket-table-body');
        tableBody.innerHTML = '';
        let openTicketsCount = 0;

        if (tickets.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Nenhum ticket de suporte encontrado.</td></tr>';
        } else {
            tickets.forEach(ticket => {
                const row = document.createElement('tr');
                row.dataset.ticketId = ticket._id;
                const isResolved = ticket.status === 'resolved';
                if (!isResolved) openTicketsCount++;

                row.innerHTML = `
                    <td>${ticket.user.username}</td>
                    <td>${ticket.category}</td>
                    <td>${new Date(ticket.createdAt).toLocaleString('pt-BR')}</td>
                    <td><span class="ticket-status ${isResolved ? 'resolved' : 'open'}">${isResolved ? 'Resolvido' : 'Aberto'}</span></td>
                `;
                tableBody.appendChild(row);
            });
        }
        updateSupportNotification(openTicketsCount);
    } catch (error) {
        console.error("Erro ao construir tabela de suporte:", error);
    }
}

function updateSupportNotification(count) {
    const link = navSupport.querySelector('a');
    let badge = link.querySelector('.notification-badge');
    if (count > 0) {
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'notification-badge';
            link.appendChild(badge);
        }
        badge.textContent = count;
    } else {
        badge?.remove();
    }
}

async function openSupportChat(ticketId) {
    currentOpenTicketId = ticketId;
    socket.emit('support:joinRoom', ticketId);

    try {
        const token = localStorage.getItem('chatyni_token');
        const res = await fetch(`${API_URL}/api/support/tickets/${ticketId}`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) throw new Error('Não foi possível carregar os detalhes do ticket.');
        const { ticket, messages } = await res.json();

        const chatContentHTML = `
            <div id="support-chat-messages" style="height: 40vh; overflow-y: auto; padding: 10px; background: #111; border-radius: 8px; margin-bottom: 15px; display: flex; flex-direction: column; gap: 10px;"></div>
            <form id="support-chat-form">
                <input type="text" id="support-chat-input" placeholder="Digite sua mensagem..." required style="width: 100%; padding: 10px; box-sizing: border-box; background-color: #111; color: #fff; border: 1px solid #444; border-radius: 6px;">
            </form>
        `;

        modalTitle.textContent = `Suporte: ${ticket.user.username} (${ticket.category})`;
        modalContent.innerHTML = chatContentHTML;

        modalConfirmBtn.classList.add('hidden');
        modalCancelBtn.classList.add('hidden');

        document.getElementById('support-chat-actions')?.remove();
        const modalActionsContainer = document.getElementById('modal-actions');
        const supportActions = document.createElement('div');
        supportActions.id = 'support-chat-actions';
        supportActions.innerHTML = `
            <div class="ticket-resolution-btns">
                <button id="resolveTicketBtn" class="modal-btn primary">Resolvido</button>
                <button id="unresolveTicketBtn" class="modal-btn">Não Resolvido</button>
            </div>
            <button id="closeSupportChatBtn" class="modal-btn">Fechar</button>
        `;
        modalActionsContainer.prepend(supportActions);

        modalOverlay.classList.remove('hidden');

        const messagesContainer = document.getElementById('support-chat-messages');
        messagesContainer.innerHTML = '';
        messages.forEach(msg => addMessageToSupportChat(msg));

        document.getElementById('closeSupportChatBtn').onclick = () => {
            socket.emit('support:leaveRoom', currentOpenTicketId);
            currentOpenTicketId = null;
            document.getElementById('support-chat-actions').remove();
            hideModal();
        };

        document.getElementById('support-chat-form').onsubmit = (e) => {
            e.preventDefault();
            const input = document.getElementById('support-chat-input');
            const text = input.value.trim();
            if (text) {
                socket.emit('support:sendMessage', { ticketId: currentOpenTicketId, text });
                input.value = '';
            }
        };

        document.getElementById('resolveTicketBtn').onclick = () => handleTicketResolution(currentOpenTicketId, 'resolved');
        document.getElementById('unresolveTicketBtn').onclick = () => handleTicketResolution(currentOpenTicketId, 'open');

    } catch (error) {
        showCustomAlert(error.message, 'Erro');
    }
}

async function openUserSupportChat(ticketId) {
    currentOpenTicketId = ticketId;
    socket.emit('support:joinRoom', ticketId);

    try {
        const token = localStorage.getItem('chatyni_token');
        const res = await fetch(`${API_URL}/api/support/tickets/${ticketId}`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) throw new Error('Não foi possível carregar os detalhes do seu ticket.');
        const { ticket, messages } = await res.json();

        const chatContentHTML = `
            <div id="support-chat-messages" style="height: 40vh; overflow-y: auto; padding: 10px; background: #111; border-radius: 8px; margin-bottom: 15px; display: flex; flex-direction: column; gap: 10px;"></div>
            <form id="support-chat-form">
                <input type="text" id="support-chat-input" placeholder="Digite sua mensagem..." required style="width: 100%; padding: 10px; box-sizing: border-box; background-color: #111; color: #fff; border: 1px solid #444; border-radius: 6px;">
            </form>
        `;

        modalTitle.textContent = `Suporte: ${ticket.category}`;
        modalContent.innerHTML = chatContentHTML;

        modalConfirmBtn.classList.add('hidden');
        modalCancelBtn.classList.add('hidden');

        document.getElementById('support-chat-actions')?.remove();
        const modalActionsContainer = document.getElementById('modal-actions');
        const supportActions = document.createElement('div');
        supportActions.id = 'support-chat-actions';
        supportActions.innerHTML = `<button id="closeSupportChatBtn" class="modal-btn">Fechar</button>`;
        modalActionsContainer.prepend(supportActions);

        modalOverlay.classList.remove('hidden');

        const messagesContainer = document.getElementById('support-chat-messages');
        messagesContainer.innerHTML = '';
        messages.forEach(msg => addMessageToSupportChat(msg));

        document.getElementById('closeSupportChatBtn').onclick = () => {
            socket.emit('support:leaveRoom', currentOpenTicketId);
            currentOpenTicketId = null;
            document.getElementById('support-chat-actions').remove();
            hideModal();
        };

        document.getElementById('support-chat-form').onsubmit = (e) => {
            e.preventDefault();
            const input = document.getElementById('support-chat-input');
            const text = input.value.trim();
            if (text) {
                socket.emit('support:sendMessage', { ticketId: currentOpenTicketId, text });
                input.value = '';
            }
        };
    } catch (error) {
        showCustomAlert(error.message, 'Erro');
    }
}

function addMessageToSupportChat(data) {
    const messagesContainer = document.getElementById('support-chat-messages');
    if (!messagesContainer) return;

    const messageEl = document.createElement('div');
    const senderName = data.sender.username;
    const isSenderAdmin = data.sender.isAdmin;

    messageEl.style.cssText = `padding: 8px 12px; border-radius: 8px; max-width: 80%; word-wrap: break-word; line-height: 1.4;`;
    messageEl.innerHTML = `<strong>${senderName}${isSenderAdmin ? ' (Admin)' : ''}:</strong><br>${data.text}`;

    if ((isAdmin && isSenderAdmin) || (!isAdmin && !isSenderAdmin)) {
        messageEl.style.backgroundColor = '#005f7e';
        messageEl.style.alignSelf = 'flex-end';
    } else {
        messageEl.style.backgroundColor = '#2a2a2a';
        messageEl.style.alignSelf = 'flex-start';
    }

    messagesContainer.appendChild(messageEl);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

async function handleTicketResolution(ticketId, status) {
    try {
        const token = localStorage.getItem('chatyni_token');
        const res = await fetch(`${API_URL}/api/support/tickets/${ticketId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ status })
        });
        if (!res.ok) throw new Error(await res.text());

        showCustomAlert(`Ticket marcado como '${status === 'resolved' ? 'Resolvido' : 'Aberto'}'!`);
        buildSupportTicketTable();
        document.getElementById('closeSupportChatBtn').click();

    } catch (error) {
        showCustomAlert(error.message, 'Erro');
    }
}

function initParticleAnimation() {
    const canvas = document.getElementById('particle-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;
    let particles = [];

    class Particle {
        constructor() {
            this.x = Math.random() * width;
            this.y = Math.random() * height;
            this.vx = -1 + Math.random() * 2;
            this.vy = -1 + Math.random() * 2;
            this.radius = Math.random() * 1.5;
        }
        update() {
            this.x += this.vx;
            this.y += this.vy;
            if (this.x < 0 || this.x > width) this.vx = -this.vx;
            if (this.y < 0 || this.y > height) this.vy = -this.vy;
        }
        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0, 191, 255, 0.4)'; // Deep Sky Blue, semi-transparent
            ctx.fill();
        }
    }
    function createParticles() {
        particles = [];
        const particleCount = (width * height) / 12000;
        for (let i = 0; i < particleCount; i++) {
            particles.push(new Particle());
        }
    }
    function animate() {
        ctx.clearRect(0, 0, width, height);
        particles.forEach(p => { p.update(); p.draw(); });
        requestAnimationFrame(animate);
    }
    window.addEventListener('resize', () => { width = canvas.width = window.innerWidth; height = canvas.height = window.innerHeight; createParticles(); });
    createParticles();
    animate();
}

// Inicializa as novas funcionalidades
initializeAppearanceSettings();
initParticleAnimation();

// Verifica o estado de login assim que a página carrega
checkInitialState();
