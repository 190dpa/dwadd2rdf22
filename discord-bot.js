const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, InteractionType, ChannelType, PermissionsBitField } = require('discord.js');
const axios = require('axios');

module.exports = (io) => {
    // --- CONFIGURAÇÃO SEGURA ---
    const BOT_TOKEN = process.env.BOT_TOKEN;
    const SERVER_URL = process.env.SERVER_URL;
    const WEBHOOK_SECRET = process.env.DISCORD_WEBHOOK_SECRET;
    const ADMIN_ROLE_ID = process.env.ADMIN_ROLE_ID;
    const GUILD_ID = process.env.DISCORD_GUILD_ID;
    const TICKET_CATEGORY_ID = process.env.DISCORD_TICKET_CATEGORY_ID;
    const ANNOUNCEMENT_CHANNEL_ID = process.env.DISCORD_ANNOUNCEMENT_CHANNEL_ID;
    const VERIFIED_ROLE_ID = process.env.VERIFIED_ROLE_ID;
    const UNVERIFIED_ROLE_ID = process.env.UNVERIFIED_ROLE_ID;
    // --- FIM DA CONFIGURAÇÃO ---

    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent,
            GatewayIntentBits.GuildMembers, // Necessário para detectar novos membros
        ],
    });

    client.once('clientReady', () => {
        if (client.user) {
            console.log(`Bot ${client.user.tag} está online e pronto!`);
        } else {
            console.error("O bot conectou, mas o objeto 'client.user' é nulo. Verifique as permissões e o token.");
        }
    });

    // --- Keep-Alive para o Render ---
    setInterval(() => {
        console.log('Ping periódico para manter o bot do Render ativo.');
    }, 14 * 60 * 1000); // 14 minutos

    // Adiciona o cargo "Não Verificado" para novos membros
    client.on('guildMemberAdd', async member => {
        if (!UNVERIFIED_ROLE_ID) {
            console.warn('[BOT] UNVERIFIED_ROLE_ID não está configurado. Não foi possível adicionar cargo ao novo membro.');
            return;
        }
        try {
            const role = await member.guild.roles.fetch(UNVERIFIED_ROLE_ID);
            if (role) {
                await member.roles.add(role);
                console.log(`Cargo 'Não Verificado' adicionado para ${member.user.tag}`);
            } else {
                console.error(`[BOT] O cargo com ID ${UNVERIFIED_ROLE_ID} (UNVERIFIED_ROLE_ID) não foi encontrado no servidor.`);
            }
        } catch (error) {
            console.error(`[BOT] Falha ao adicionar cargo para o novo membro ${member.user.tag}:`, error);
        }
    });

    client.on('messageCreate', async (message) => {
        // Ignora mensagens de outros bots
        if (message.author.bot) return;

        // Lógica para retransmitir mensagens de admin em canais de ticket para o site
        if (message.channel.name.startsWith('ticket-') && message.member.roles.cache.has(ADMIN_ROLE_ID)) {
            const ticketId = message.channel.name.split('-')[1];
            const messageData = {
                _id: message.id,
                ticketId,
                sender: {
                    username: message.author.username,
                    isAdmin: true,
                },
                text: message.content,
                createdAt: new Date(),
            };
            // Emite para a sala do ticket no Socket.IO
            io.to(ticketId).emit('support:newMessage', messageData);
            return;
        }

        // Lógica de comandos com '!'
        if (!message.content.startsWith('!')) return;

        // Verifica se o autor da mensagem tem o cargo de admin
        if (!message.member.roles.cache.has(ADMIN_ROLE_ID)) {
            return message.reply('Você não tem permissão para usar este comando.');
        }

        const args = message.content.slice(1).trim().split(/ +/);
        const command = args.shift().toLowerCase();

        // --- COMANDO DE STATUS (PÚBLICO) ---
        if (command === 'status') {
            try {
                const res = await axios.get(`${SERVER_URL}/api/status`);
                const { onlineUsers } = res.data;

                const embed = new EmbedBuilder()
                    .setColor(0x3498db) // Azul
                    .setTitle('📊 Status do Chatyni V2')
                    .addFields(
                        { name: 'Usuários Online', value: `**${onlineUsers}**`, inline: true },
                        { name: 'Status do Servidor', value: '✅ Online', inline: true }
                    )
                    .setTimestamp()
                    .setFooter({ text: 'Informações em tempo real' });

                return message.reply({ embeds: [embed] });
            } catch (error) {
                return message.reply('❌ Não foi possível obter o status do servidor no momento.');
            }
        }

        // --- COMANDO DE INFORMAÇÕES DO CHEFE (PÚBLICO) ---
        if (command === 'bossinfo') {
            const embed = new EmbedBuilder()
                .setColor(0xFF0000) // Vermelho para perigo
                .setTitle('🔥 CHATYNIBOSS EXP - O FIM DE TUDO 🔥')
                .setDescription(
                    'Uma entidade que transcende a própria realidade do Chatyni. ' +
                    'Dizem que ele é a manifestação dos dados corrompidos e do poder esquecido do V1, ' +
                    'agora com um propósito sombrio: testar os limites dos mais poderosos.'
                )
                .setImage('https://i.imgur.com/kUaGv2j.png') // Uma imagem mais ameaçadora
                .addFields(
                    { name: '❤️ Vida (HP)', value: '∞ (Imortal)', inline: true },
                    { name: '⚔️ Ataque', value: '999,999', inline: true },
                    { name: '🛡️ Defesa', value: '999,999', inline: true },
                    { name: '✨ Habilidade Especial: "Paradoxo da Realidade"', value: 'Altera as regras do jogo a cada turno, podendo reverter curas em dano, anular defesas ou até mesmo copiar as habilidades do oponente.' },
                    { name: 'Recompensa pela Derrota', value: 'Desconhecida. Ninguém jamais sobreviveu para contar.' }
                )
                .setFooter({ text: 'Este chefe não pode ser encontrado em batalhas normais.' });

            return message.reply({ embeds: [embed] });
        }

        // --- COMANDO DE DEBUG ---
        if (command === 'myroleid') {
            const adminRole = message.member.roles.cache.get(ADMIN_ROLE_ID);
            if (adminRole) {
                return message.reply(`✅ Eu encontrei o cargo de admin em você! O ID configurado é: \`${ADMIN_ROLE_ID}\``);
            } else {
                return message.reply(`❌ Não encontrei o cargo de admin em você. O ID que estou procurando é \`${ADMIN_ROLE_ID}\`. Verifique se este é o ID correto do seu cargo de "Admin" e se você o possui.`);
            }
        }

        if (command === 'painel') {
            const targetUser = args[0];
            if (!targetUser) {
                return message.reply('Formato incorreto. Use: `!painel [usuário]`');
            }

            const embed = new EmbedBuilder()
                .setColor(0x6f2dbd)
                .setTitle(`Painel de Controle: ${targetUser}`)
                .setDescription(`Selecione uma ação para executar no usuário **${targetUser}**.\n\n*As ações que requerem mais informações (como motivo ou quantidade) abrirão uma janela pop-up.*`)
                .setTimestamp()
                .setFooter({ text: 'Chatyni V2 Admin System' });

            const row1 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder().setCustomId(`panel_ban_${targetUser}`).setLabel('Banir').setStyle(ButtonStyle.Danger).setEmoji('🔨'),
                    new ButtonBuilder().setCustomId(`panel_unban_${targetUser}`).setLabel('Desbanir').setStyle(ButtonStyle.Secondary).setEmoji('🔓'),
                    new ButtonBuilder().setCustomId(`panel_kick_${targetUser}`).setLabel('Kickar').setStyle(ButtonStyle.Secondary).setEmoji('👢'),
                    new ButtonBuilder().setCustomId(`panel_warn_${targetUser}`).setLabel('Avisar').setStyle(ButtonStyle.Primary).setEmoji('⚠️'),
                );

            const row2 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder().setCustomId(`panel_givexp_${targetUser}`).setLabel('Doar XP').setStyle(ButtonStyle.Success).setEmoji('✨'),
                    new ButtonBuilder().setCustomId(`panel_giveitem_${targetUser}`).setLabel('Dar Espada ADM').setStyle(ButtonStyle.Success).setEmoji('⚔️'),
                );

            try {
                await message.reply({ embeds: [embed], components: [row1, row2] });
            } catch (error) {
                console.error("Erro ao enviar painel interativo:", error);
                message.reply("Ocorreu um erro ao tentar criar o painel.");
            }
            return; // Impede que o código continue para o switch de comandos antigos
        }

        if (command === 'setup-login') {
            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle('Bem-vindo ao Chatyni V2')
                .setDescription('Use os botões abaixo para acessar sua conta ou criar uma nova diretamente pelo Discord.\n\nApós o login ou cadastro, você receberá um **token de uso único** na sua DM. Use este token no site para logar.')
                .setThumbnail(client.user.displayAvatarURL())
                .setFooter({ text: 'Sistema de Autenticação Integrada' });

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('login_with_bot')
                        .setLabel('Login')
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('🔑'),
                    new ButtonBuilder()
                        .setCustomId('register_with_bot')
                        .setLabel('Cadastrar')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('📝')
                );
            
            return message.channel.send({ embeds: [embed], components: [row] });
        }

        if (command === 'setup-verify') {
            if (!VERIFIED_ROLE_ID) {
                return message.reply('❌ A variável de ambiente `VERIFIED_ROLE_ID` não está configurada.');
            }
            const embed = new EmbedBuilder()
                .setColor(0x2ecc71)
                .setTitle('✅ Verificação de Conta')
                .setDescription('Para obter acesso completo ao servidor, clique no botão abaixo e vincule sua conta do Chatyni V2 ao seu perfil do Discord.')
                .setFooter({ text: 'Sistema de Verificação' });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('verify_account').setLabel('Verificar').setStyle(ButtonStyle.Success).setEmoji('🔗')
            );

            await message.channel.send({ embeds: [embed], components: [row] });
            return;
        }

        if (command === 'logs') {
            try {
                // Informa ao usuário que está buscando os logs
                const workingMessage = await message.reply('🔍 Buscando os logs mais recentes do servidor...');

                const res = await axios.post(`${SERVER_URL}/api/admin/logs`, {
                    authorization: WEBHOOK_SECRET,
                });

                const logs = res.data;

                if (!logs || logs.length === 0) {
                    return workingMessage.edit('ℹ️ Nenhum log recente encontrado no servidor.');
                }

                // Cria um buffer com os logs para enviar como arquivo
                const logBuffer = Buffer.from(logs.join('\n'), 'utf-8');

                // Edita a mensagem original para enviar o arquivo de log
                await workingMessage.edit({
                    content: '✅ Logs do servidor recuperados com sucesso!',
                    files: [{ attachment: logBuffer, name: 'server-logs.txt' }]
                });
            } catch (error) { message.reply(`❌ **Erro ao buscar logs:** ${error.response ? error.response.data : error.message}`); }
            return;
        }

        if (command === 'worldboss') {
            const subCommand = args[0]?.toLowerCase();
            if (subCommand === 'spawn') {
                try {
                    await message.reply('Invocando o Chefe Mundial...');
                    const res = await axios.post(`${SERVER_URL}/api/discord-webhook`, {
                        authorization: WEBHOOK_SECRET,
                        action: 'spawn_world_boss',
                    });

                    const boss = res.data.worldBoss;
                    const announcementChannel = await client.channels.fetch(ANNOUNCEMENT_CHANNEL_ID);

                    if (announcementChannel) {
                        const embed = new EmbedBuilder()
                            .setColor(0xff0000)
                            .setTitle('🔥 UM CHEFE MUNDIAL APARECEU! 🔥')
                            .setDescription(`O temível **${boss.name}** surgiu e ameaça a todos! Juntem-se no site para derrotá-lo e ganhar recompensas!`)
                            .setImage(boss.imageUrl)
                            .addFields({ name: 'Vida do Chefe', value: `**${boss.maxHp} HP**` })
                            .setTimestamp()
                            .setFooter({ text: 'A união faz a força!' });

                        await announcementChannel.send({ content: '@everyone', embeds: [embed] });
                        await message.reply('✅ Chefe Mundial invocado e anunciado com sucesso!');
                    } else {
                        await message.reply('⚠️ Chefe invocado, mas o canal de anúncios não foi encontrado. Verifique a variável `DISCORD_ANNOUNCEMENT_CHANNEL_ID`.');
                    }
                } catch (error) {
                    message.reply(`❌ **Erro ao invocar chefe:** ${error.response ? error.response.data : error.message}`);
                }
            }
        }

        if (command === 'spawnboss') {
            const bossToSpawn = args[0]?.toLowerCase();
            if (bossToSpawn !== 'chatyniboss') {
                return message.reply('Chefe inválido. Use: `!spawnboss chatyniboss`');
            }

            try {
                await message.reply(`Invocando o chefe supremo: ${bossToSpawn}...`);
                const res = await axios.post(`${SERVER_URL}/api/discord-webhook`, {
                    authorization: WEBHOOK_SECRET,
                    action: 'spawn_specific_boss',
                    bossId: bossToSpawn,
                    spawnerDiscordId: message.author.id
                });

                const boss = res.data.worldBoss;
                const announcementChannel = await client.channels.fetch(ANNOUNCEMENT_CHANNEL_ID);

                if (announcementChannel) {
                    const embed = new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setTitle(`🔥 O DESAFIO FINAL APARECEU! 🔥`)
                        .setDescription(`A entidade suprema, **${boss.name}**, materializou-se em nosso mundo! Derrotem-na para provar seu valor e obter recompensas lendárias!`)
                        .setImage(boss.imageUrl)
                        .addFields({ name: 'Vida do Chefe', value: `**${boss.maxHp.toLocaleString('pt-BR')} HP**` })
                        .setTimestamp();
                    await announcementChannel.send({ content: '@everyone', embeds: [embed] });
                    await message.reply('✅ Chefe Supremo invocado e anunciado com sucesso!');
                }
            } catch (error) {
                message.reply(`❌ **Erro ao invocar chefe:** ${error.response ? error.response.data : error.message}`);
            }
        }

        const targetUser = args[0];
        if (!targetUser) {
            return message.reply('Por favor, especifique um usuário alvo. Ex: `!ban NomeDoUsuario Motivo`');
        }

        let responseMessage = '';

        try {
            switch (command) {
                case 'ban': {
                    const reason = args.slice(1).join(' ') || 'Nenhum motivo fornecido.';
                    const res = await axios.post(`${SERVER_URL}/api/discord-webhook`, {
                        authorization: WEBHOOK_SECRET,
                        action: 'ban',
                        targetUser: targetUser,
                        reason: reason,
                    });
                    responseMessage = `✅ **Sucesso:** ${res.data}`;
                    break;
                }

                case 'kick': {
                    const reason = args.slice(1).join(' ') || 'Nenhum motivo fornecido.';
                    const res = await axios.post(`${SERVER_URL}/api/discord-webhook`, {
                        authorization: WEBHOOK_SECRET,
                        action: 'kick',
                        targetUser: targetUser,
                        reason: reason,
                    });
                    responseMessage = `✅ **Sucesso:** ${res.data}`;
                    break;
                }

                case 'changepassword': {
                    const newPassword = args[1];
                    if (!newPassword) {
                        return message.reply('Por favor, forneça a nova senha. Ex: `!changepassword NomeDoUsuario NovaSenha123`');
                    }
                    const res = await axios.post(`${SERVER_URL}/api/discord-webhook`, {
                        authorization: WEBHOOK_SECRET,
                        action: 'change_password',
                        targetUser: targetUser,
                        newPassword: newPassword,
                    });
                    responseMessage = `✅ **Sucesso:** ${res.data}`;
                    break;
                }

                case 'unban': {
                    const res = await axios.post(`${SERVER_URL}/api/discord-webhook`, {
                        authorization: WEBHOOK_SECRET,
                        action: 'unban',
                        targetUser: targetUser,
                    });
                    responseMessage = `✅ **Sucesso:** ${res.data}`;
                    break;
                }

                case 'rpg': {
                    const statToChange = args[1]?.toLowerCase();
                    const value = args[2];
                    if (!statToChange || value === undefined) {
                        return message.reply('Formato incorreto. Use: `!rpg [usuário] [level/xp/coins] [valor]`');
                    }
                    const res = await axios.post(`${SERVER_URL}/api/discord-webhook`, {
                        authorization: WEBHOOK_SECRET,
                        action: 'set_rpg',
                        targetUser: targetUser,
                        statToChange: statToChange,
                        value: value
                    });
                    responseMessage = `✅ **Sucesso:** ${res.data}`;
                    break;
                }

                case 'giveitem': {
                    const itemToGive = args[1];
                    if (!itemToGive) {
                        return message.reply('Formato incorreto. Use: `!giveitem [usuário] [nome_do_item]`');
                    }
                    const res = await axios.post(`${SERVER_URL}/api/discord-webhook`, {
                        authorization: WEBHOOK_SECRET,
                        action: 'give_item',
                        targetUser: targetUser,
                        item: itemToGive
                    });
                    responseMessage = `✅ **Sucesso:** ${res.data}`;
                    break;
                }
                
                case 'sorterecebida': {
                    const multiplier = args[1]; // O multiplicador de sorte, ex: "10"
                    if (!multiplier || isNaN(parseInt(multiplier)) || parseInt(multiplier) <= 1) {
                        return message.reply('Formato incorreto. Use: `!sorterecebida [usuário] [multiplicador]` (ex: 10 para 10x). O multiplicador deve ser maior que 1.');
                    }
                    const res = await axios.post(`${SERVER_URL}/api/discord-webhook`, { authorization: WEBHOOK_SECRET, action: 'give_luck', targetUser: targetUser, value: parseInt(multiplier, 10) });
                    responseMessage = `✅ **Sucesso:** ${res.data}`;
                    break;
                }

                default:
                    // Se o comando não for reconhecido, não faz nada.
                    return;
            }
            
            await message.reply(responseMessage);

        } catch (error) {
            // Se o servidor responder com um erro (ex: usuário não encontrado), mostra a mensagem de erro.
            const errorMessage = error.response ? error.response.data : error.message;
            await message.reply(`❌ **Erro:** ${errorMessage}`);
        }
    });

    client.on('interactionCreate', async interaction => {
        // Verifica se a interação é um clique em botão
        if (interaction.isButton()) {
            if (interaction.customId === 'login_with_bot') {
                const modal = new ModalBuilder().setCustomId('modal_login').setTitle('Login no Chatyni V2');
                const emailInput = new TextInputBuilder().setCustomId('emailInput').setLabel("Seu Email").setStyle(TextInputStyle.Short).setRequired(true);
                const passwordInput = new TextInputBuilder().setCustomId('passwordInput').setLabel("Sua Senha").setStyle(TextInputStyle.Short).setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(emailInput), new ActionRowBuilder().addComponents(passwordInput));
                return interaction.showModal(modal);
            }

            if (interaction.customId === 'register_with_bot') {
                const modal = new ModalBuilder().setCustomId('modal_register').setTitle('Cadastro no Chatyni V2');
                const usernameInput = new TextInputBuilder().setCustomId('usernameInput').setLabel("Nome de Usuário").setStyle(TextInputStyle.Short).setRequired(true);
                const emailInput = new TextInputBuilder().setCustomId('emailInput').setLabel("Email").setStyle(TextInputStyle.Short).setRequired(true);
                const passwordInput = new TextInputBuilder().setCustomId('passwordInput').setLabel("Senha (mínimo 4 caracteres)").setStyle(TextInputStyle.Short).setRequired(true);
                const questionInput = new TextInputBuilder().setCustomId('questionInput').setLabel("Pergunta de Segurança").setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('Ex: Nome do primeiro animal?');
                const answerInput = new TextInputBuilder().setCustomId('answerInput').setLabel("Resposta de Segurança").setStyle(TextInputStyle.Short).setRequired(true);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(usernameInput),
                    new ActionRowBuilder().addComponents(emailInput),
                    new ActionRowBuilder().addComponents(passwordInput),
                    new ActionRowBuilder().addComponents(questionInput),
                    new ActionRowBuilder().addComponents(answerInput)
                );
                return interaction.showModal(modal);
            }

            if (interaction.customId === 'verify_account') {
                const modal = new ModalBuilder().setCustomId('modal_verify').setTitle('Verificar Conta');
                const usernameInput = new TextInputBuilder().setCustomId('websiteUsernameInput').setLabel("Seu nome de usuário no site").setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('Ex: D0LLY');
                const passwordInput = new TextInputBuilder().setCustomId('websitePasswordInput').setLabel("Sua senha do site").setStyle(TextInputStyle.Short).setRequired(true);
                modal.addComponents(
                    new ActionRowBuilder().addComponents(usernameInput),
                    new ActionRowBuilder().addComponents(passwordInput)
                );
                return interaction.showModal(modal);
            }

            if (interaction.customId.startsWith('panel_')) {
                const parts = interaction.customId.split('_');
                const action = parts[1];
                const targetUser = parts.slice(2).join('_'); // Lida com nomes de usuário que contêm '_'

                // Verifica se o usuário que clicou tem permissão
                if (!interaction.member.roles.cache.has(ADMIN_ROLE_ID)) {
                    return interaction.reply({ content: 'Você não tem permissão para usar este painel.', ephemeral: true });
                }

                try {
                    switch (action) {
                        case 'unban':
                        case 'giveitem': {
                            // Para ações diretas, nós deferimos a resposta primeiro
                            await interaction.deferReply({ ephemeral: true });

                            const payload = { authorization: WEBHOOK_SECRET, targetUser: targetUser };
                            if (action === 'giveitem') {
                                payload.action = 'give_item';
                                payload.item = 'espada_suprema_adm';
                            } else {
                                payload.action = action;
                            }
                            const res = await axios.post(`${SERVER_URL}/api/discord-webhook`, payload);
                            await interaction.editReply({ content: `✅ **Sucesso:** ${res.data}`, ephemeral: true });
                            break;
                        }
                        case 'ban':
                        case 'warn':
                        case 'kick': {
                            // Para ações que abrem um modal, a resposta é o próprio modal.
                            // Não usamos deferReply() aqui.
                            let modalTitle = '';
                            if (action === 'ban') modalTitle = 'Banir';
                            else if (action === 'warn') modalTitle = 'Avisar';
                            else if (action === 'kick') modalTitle = 'Kickar';

                            const modal = new ModalBuilder()
                                .setCustomId(`modal_${action}_${targetUser}`)
                                .setTitle(`${modalTitle} Usuário: ${targetUser}`);
                            const reasonInput = new TextInputBuilder().setCustomId('reasonInput').setLabel("Motivo").setStyle(TextInputStyle.Paragraph).setPlaceholder(`Motivo para ${modalTitle.toLowerCase()}...`).setRequired(true);
                            modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
                            await interaction.showModal(modal);
                            break;
                        }
                        case 'givexp': {
                            // O mesmo para o modal de XP.
                            // A resposta à interação do botão é a abertura do modal.
                            const modal = new ModalBuilder().setCustomId(`modal_givexp_${targetUser}`).setTitle(`Doar XP para: ${targetUser}`);
                            const xpInput = new TextInputBuilder().setCustomId('xpInput').setLabel("Quantidade de XP").setStyle(TextInputStyle.Short).setPlaceholder('Ex: 100').setRequired(true);
                            modal.addComponents(new ActionRowBuilder().addComponents(xpInput));
                            await interaction.showModal(modal);
                            break;
                        }
                    }
                } catch (error) {
                    const errorMessage = error.response ? error.response.data : error.message;
                    // Se a interação já foi respondida (ex: modal falhou ao abrir), tentamos editar a resposta.
                    // Se não, enviamos uma nova resposta.
                    if (interaction.deferred || interaction.replied) {
                        await interaction.editReply({ content: `❌ **Erro:** ${errorMessage}`, ephemeral: true });
                    } else {
                        await interaction.reply({ content: `❌ **Erro:** ${errorMessage}`, ephemeral: true });
                    }
                }
            } else if (interaction.customId.startsWith('ticket_')) {
                await interaction.deferReply({ ephemeral: true });
                const parts = interaction.customId.split('_');
                const action = parts[1];
                const ticketId = parts[2];

                try {
                    const status = action === 'resolve' ? 'resolved' : 'open';
                    await axios.put(`${SERVER_URL}/api/support/tickets/${ticketId}/status`, 
                        { status }, 
                        { headers: { 'x-bot-auth': WEBHOOK_SECRET } }
                    );

                    await interaction.editReply({ content: `✅ Ticket marcado como **${status}**.` });

                    if (status === 'resolved') {
                        await interaction.channel.send('Este ticket foi resolvido. O canal será excluído em 10 segundos.');
                        setTimeout(() => interaction.channel.delete('Ticket resolvido.').catch(console.error), 10000);
                    }
                } catch (error) {
                    const errorMessage = error.response ? error.response.data : error.message;
                    await interaction.editReply({ content: `❌ **Erro:** ${errorMessage}` });
                }
            }
        }

        // Lida com o envio dos modais (janelas pop-up)
        if (interaction.type === InteractionType.ModalSubmit && interaction.customId.startsWith('modal_')) {
            if (interaction.customId === 'modal_login') {
                await interaction.deferReply({ ephemeral: true });
                const email = interaction.fields.getTextInputValue('emailInput');
                const password = interaction.fields.getTextInputValue('passwordInput');
                try {
                    const res = await axios.post(`${SERVER_URL}/api/discord-auth/login`, { email, password });
                    const { tempToken } = res.data;

                    await interaction.user.send(`Olá! Aqui está seu token de login para o Chatyni V2. Ele é válido por 5 minutos e pode ser usado apenas uma vez.\n\n\`\`\`${tempToken}\`\`\``);
                    return interaction.editReply({ content: '✅ **Login bem-sucedido!** Verifique sua DM para receber o token de acesso.', ephemeral: true });
                } catch (error) {
                    const errorMessage = error.response ? error.response.data : error.message;
                    return interaction.editReply({ content: `❌ **Erro no login:** ${errorMessage}`, ephemeral: true });
                }
            }

            if (interaction.customId === 'modal_register') {
                await interaction.deferReply({ ephemeral: true });
                const username = interaction.fields.getTextInputValue('usernameInput');
                const email = interaction.fields.getTextInputValue('emailInput');
                const password = interaction.fields.getTextInputValue('passwordInput');
                const securityQuestion = interaction.fields.getTextInputValue('questionInput');
                const securityAnswer = interaction.fields.getTextInputValue('answerInput');

                if (password.length < 4) {
                    return interaction.editReply({ content: '❌ **Erro:** A senha deve ter pelo menos 4 caracteres.', ephemeral: true });
                }

                try {
                    const res = await axios.post(`${SERVER_URL}/api/discord-auth/register`, {
                        username,
                        email,
                        password,
                        securityQuestion,
                        securityAnswer
                    });
                    const { tempToken } = res.data;

                    await interaction.user.send(`Bem-vindo(a) ao Chatyni V2, ${username}! Aqui está seu primeiro token de login. Ele é válido por 5 minutos e pode ser usado apenas uma vez.\n\n\`\`\`${tempToken}\`\`\``);
                    return interaction.editReply({ content: '✅ **Cadastro realizado com sucesso!** Verifique sua DM para receber o token de acesso.', ephemeral: true });

                } catch (error) {
                    const errorMessage = error.response ? error.response.data : error.message;
                    return interaction.editReply({ content: `❌ **Erro no cadastro:** ${errorMessage}`, ephemeral: true });
                }
            }

            if (interaction.customId === 'modal_verify') {
                await interaction.deferReply({ ephemeral: true });
                const websiteUsername = interaction.fields.getTextInputValue('websiteUsernameInput');
                const websitePassword = interaction.fields.getTextInputValue('websitePasswordInput');
                const discordUser = interaction.user;

                try {
                    await axios.post(`${SERVER_URL}/api/discord-verify`, {
                        authorization: WEBHOOK_SECRET,
                        discordId: discordUser.id,
                        username: websiteUsername,
                        password: websitePassword
                    });

                    const member = await interaction.guild.members.fetch(discordUser.id);
                    await member.roles.add(VERIFIED_ROLE_ID);
                    if (UNVERIFIED_ROLE_ID) {
                        await member.roles.remove(UNVERIFIED_ROLE_ID);
                    }

                    return interaction.editReply({ content: '✅ **Conta verificada com sucesso!** Você agora tem acesso total ao servidor.', ephemeral: true });
                } catch (error) {
                    const errorMessage = error.response ? error.response.data : error.message;
                    return interaction.editReply({ content: `❌ **Erro na verificação:** ${errorMessage}`, ephemeral: true });
                }
            }

            await interaction.deferReply({ ephemeral: true });

            const parts = interaction.customId.split('_');
            const action = parts[1];
            const targetUser = parts.slice(2).join('_');

            try {
                let payload = { authorization: WEBHOOK_SECRET, targetUser: targetUser };
                let res;

                switch (action) {
                    case 'ban':
                    case 'warn':
                    case 'kick': {
                        const reason = interaction.fields.getTextInputValue('reasonInput');
                        payload.action = action;
                        payload.reason = reason;
                        res = await axios.post(`${SERVER_URL}/api/discord-webhook`, payload);
                        break;
                    }
                    case 'givexp': {
                        const xpAmount = interaction.fields.getTextInputValue('xpInput');
                        if (isNaN(parseInt(xpAmount))) {
                            return interaction.editReply({ content: '❌ **Erro:** A quantidade de XP deve ser um número.', ephemeral: true });
                        }
                        payload.action = 'set_rpg';
                        payload.statToChange = 'xp';
                        payload.value = xpAmount;
                        payload.operation = 'add'; // Informa ao servidor para somar, não substituir
                        res = await axios.post(`${SERVER_URL}/api/discord-webhook`, payload);
                        break;
                    }
                }
                await interaction.editReply({ content: `✅ **Sucesso:** ${res.data}`, ephemeral: true });
            } catch (error) {
                const errorMessage = error.response ? error.response.data : error.message;
                await interaction.editReply({ content: `❌ **Erro:** ${errorMessage}`, ephemeral: true });
            }
        }
    });

    // --- Funções exportadas para o server.js ---

    async function announceWorldBossDefeat(bossName, topDamagers) {
        try {
            const channel = await client.channels.fetch(ANNOUNCEMENT_CHANNEL_ID);
            if (!channel) return;

            const topDamagersList = topDamagers.map((p, i) => `${i + 1}. **${p.username}** - ${p.damage} de dano`).join('\n');

            const embed = new EmbedBuilder()
                .setColor(0x00ff00)
                .setTitle(`🏆 ${bossName.toUpperCase()} FOI DERROTADO! 🏆`)
                .setDescription('Graças ao esforço de todos, a ameaça foi neutralizada! Recompensas foram distribuídas aos participantes.')
                .addFields({ name: 'Maiores Contribuições', value: topDamagersList || 'Ninguém atacou o chefe.' })
                .setTimestamp();

            await channel.send({ embeds: [embed] });
        } catch (error) {
            console.error('[BOT] Erro ao anunciar derrota do Chefe Mundial:', error);
        }
    }

    if (BOT_TOKEN) {
        // Log de verificação: mostra uma parte do token para confirmar que ele foi carregado corretamente.
        const tokenPreview = `${BOT_TOKEN.substring(0, 5)}...${BOT_TOKEN.substring(BOT_TOKEN.length - 5)}`;
        console.log(`[INFO DO BOT] Tentando fazer login com o token que começa com "${tokenPreview}".`);

        client.login(BOT_TOKEN).catch(err => {
            // Este log de erro é mais detalhado e ajuda a identificar o problema exato.
            console.error(`\n\x1b[31m[ERRO DO BOT] Falha ao fazer login: ${err.message}\x1b[0m`);
            console.error('\x1b[33mVerifique se o BOT_TOKEN configurado no Render está correto e não expirou.\x1b[0m\n');
        });
    } else {
        // Avisa se a variável de ambiente do token não for encontrada.
        console.log('[AVISO DO BOT] A variável de ambiente BOT_TOKEN não foi encontrada. O bot não será iniciado.');
    }

    async function createTicketChannel(ticket) {
        if (!GUILD_ID || !TICKET_CATEGORY_ID) {
            console.error('[BOT] DISCORD_GUILD_ID ou DISCORD_TICKET_CATEGORY_ID não estão configurados nas variáveis de ambiente.');
            return null;
        }
        const guild = await client.guilds.fetch(GUILD_ID);
        if (!guild) return null;

        const channel = await guild.channels.create({
            name: `ticket-${ticket._id}`,
            type: ChannelType.GuildText,
            parent: TICKET_CATEGORY_ID,
            permissionOverwrites: [
                { id: guild.roles.everyone, deny: [PermissionsBitField.Flags.ViewChannel] },
                { id: ADMIN_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
            ],
        });

        const embed = new EmbedBuilder()
            .setColor(0xffa500) // Laranja
            .setTitle(`Novo Ticket: ${ticket.category}`)
            .setAuthor({ name: ticket.user.username })
            .setDescription(ticket.description)
            .addFields({ name: 'ID do Ticket', value: `\`${ticket._id}\`` })
            .setTimestamp(new Date(ticket.createdAt))
            .setFooter({ text: 'Chatyni V2 Support System' });

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder().setCustomId(`ticket_resolve_${ticket._id}`).setLabel('Resolvido').setStyle(ButtonStyle.Success).setEmoji('✅'),
                new ButtonBuilder().setCustomId(`ticket_reopen_${ticket._id}`).setLabel('Reabrir').setStyle(ButtonStyle.Secondary).setEmoji('🔄'),
            );

        await channel.send({ embeds: [embed], components: [row] });
        return channel.id;
    }

    async function sendMessageToChannel(channelId, message) {
        try {
            const channel = await client.channels.fetch(channelId);
            if (channel) {
                const embed = new EmbedBuilder()
                    .setColor(0x3498db) // Azul
                    .setAuthor({ name: message.sender.username })
                    .setDescription(message.text)
                    .setTimestamp(new Date(message.createdAt));
                await channel.send({ embeds: [embed] });
            }
        } catch (error) {
            console.error(`[BOT] Erro ao enviar mensagem para o canal ${channelId}:`, error);
        }
    }

    return {
        createTicketChannel,
        sendMessageToChannel,
        announceWorldBossDefeat
    };
};
