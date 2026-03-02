const { Client, GatewayIntentBits, ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder, PermissionsBitField, ChannelType, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const express = require('express');

// --- 🌐 خادم الويب للبقاء حياً 24 ساعة ---
const app = express();
app.get('/', (req, res) => { res.send('البوت يعمل بنجاح 24/7!'); });
app.listen(3000, () => { console.log('✅ خادم الويب جاهز على المنفذ 3000'); });

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent
    ]
});

// --- ⚙️ الإعدادات ---
// ملاحظة: قم بتغيير التوكن فوراً من موقع المطورين لأن التوكن القديم مكشوف الآن
const TOKEN = ''; 
const CLOSED_CATEGORY_ID = '1477924415982534666'; 
const LOGO_URL = 'https://cdn.discordapp.com/attachments/1414721768714797208/1477926712196071434/87884DD4-16E0-48A9-AE6B-4CEBC81783DA.png'; 

const CONFIG = {
    support: { role: '1477660079275901069', category: '1477660330204070083', label: 'استفسار' },
    transfer: { role: '1477660062171402577', category: '1477924687949332636', label: 'نقل' },
    store: { role: '1477660043842158674', category: '1477924744191021099', label: 'شراء من المتجر' },
    higher_admin: { role: '1477660055859105963', category: '1477924998831149116', label: 'شكوى ضد إدارة عليا' },
    admin_comp: { role: '1477660091854487654', category: '1477925187319234714', label: 'شكوى ضد إداري' },
    citizen_comp: { role: '1477660084510130207', category: '1477925414143004693', label: 'شكوى ضد مواطن' },
    dev_apply: { role: '1477660043842158674', category: '1477925319762772069', label: 'تقديم على فريق التطوير' }
};

const ticketTimers = new Map();
const cooldowns = new Map();
const ticketData = new Map();

client.once('clientReady', () => {
    console.log(`✅ بوت sp8 جاهز | تم ربط نظام التكت بنجاح`);
});

// --- 🛠️ أمر إنشاء قائمة التكتات (Setup) ---
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // اكتب !setup في القناة لإظهار لوحة التكتات
    if (message.content === '!setup') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;

        const row = new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('select_ticket')
                    .setPlaceholder('اختر نوع التذكرة التي تريد فتحها')
                    .addOptions(Object.keys(CONFIG).map(key => ({
                        label: CONFIG[key].label,
                        value: key
                    })))
            );

        const embed = new EmbedBuilder()
            .setTitle('نظام التذاكر | sp8')
            .setDescription('يرجى اختيار القسم المناسب من القائمة بالأسفل لفتح تذكرة.')
            .setImage(LOGO_URL)
            .setColor('#D4AF37');

        await message.channel.send({ embeds: [embed], components: [row] });
        return message.delete().catch(() => {});
    }

    // إدارة وقت التكت (تحديث التايمر عند إرسال رسالة)
    if (ticketTimers.has(message.channel.id)) {
        const data = ticketTimers.get(message.channel.id);
        clearTimeout(data.userPing); clearTimeout(data.warning); clearTimeout(data.close);
        startTicketTimer(message.channel, data.userId);
    }
});

// --- 📩 معالجة التفاعلات (Buttons & Menus) ---
client.on('interactionCreate', async (interaction) => {
    if (interaction.isStringSelectMenu() && interaction.customId === 'select_ticket') {
        await interaction.deferReply({ ephemeral: true });
        const selected = CONFIG[interaction.values[0]];
        
        try {
            const ticketChannel = await interaction.guild.channels.create({
                name: `${selected.label}-${interaction.user.username}`,
                type: ChannelType.GuildText,
                parent: selected.category,
                permissionOverwrites: [
                    { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                    { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                    { id: selected.role, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                ],
            });

            ticketData.set(ticketChannel.id, { userId: interaction.user.id, claimer: 'لم يتم الاستلام' });
            await interaction.editReply({ content: `تم فتح تذكرتك بنجاح: ${ticketChannel}` });

            const buttons = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`claim_${selected.role}`).setLabel('استلام التكت').setStyle(ButtonStyle.Success).setEmoji('✅'),
                new ButtonBuilder().setCustomId(`ping_${selected.role}`).setLabel('تذكير المسؤول (15د)').setStyle(ButtonStyle.Primary).setEmoji('🔔'),
                new ButtonBuilder().setCustomId('close_ticket').setLabel('إغلاق').setStyle(ButtonStyle.Danger).setEmoji('🔒')
            );

            await ticketChannel.send({ 
                content: `🔔 منشن للمسؤولين: <@&${selected.role}>`, 
                embeds: [new EmbedBuilder().setTitle(`قسم ${selected.label}`).setDescription(`حياك الله <@${interaction.user.id}>`).setColor('#D4AF37')],
                components: [buttons],
                allowedMentions: { roles: [selected.role] } 
            });
            
            startTicketTimer(ticketChannel, interaction.user.id);
        } catch (e) {
            console.error(e);
            await interaction.editReply({ content: "❌ حدث خطأ أثناء إنشاء التكت. تأكد من صلاحيات البوت وقسم الفئات." });
        }
    }

    // باقي كود الأزرار (Claim & Close) يوضع هنا كما هو في ملفك الأصلي...
    if (interaction.isButton()) {
        const data = ticketData.get(interaction.channel.id) || { userId: interaction.user.id };

        if (interaction.customId.startsWith('claim_')) {
            const roleId = interaction.customId.split('_')[1];
            if (!interaction.member.roles.cache.has(roleId)) return interaction.reply({ content: "❌ لست المسؤول.", ephemeral: true });
            
            ticketData.set(interaction.channel.id, { ...data, claimer: `<@${interaction.user.id}>` });
            await interaction.reply({ content: `✅ تم استلام التكت بواسطة: <@${interaction.user.id}>` });
            
            const updatedButtons = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('claimed').setLabel(`مستلم من: ${interaction.user.username}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
                new ButtonBuilder().setCustomId(`ping_${roleId}`).setLabel('تذكير (15د)').setStyle(ButtonStyle.Primary).setEmoji('🔔'),
                new ButtonBuilder().setCustomId('close_ticket').setLabel('إغلاق').setStyle(ButtonStyle.Danger).setEmoji('🔒')
            );
            await interaction.message.edit({ components: [updatedButtons] });
        }

        if (interaction.customId === 'close_ticket') {
            await interaction.reply("جاري الأرشفة وحفظ السجلات...");
            await closeTicket(interaction.channel, data.userId, `<@${interaction.user.id}>`, "إغلاق يدوي");
        }
    }
});

// الدوال المساعدة (Timer & Close)
function startTicketTimer(channel, userId) {
    const userPing = setTimeout(() => channel.send(`⚠️ تنبيه <@${userId}>، هل لا زلت هنا؟`), 20*60*1000);
    const warning = setTimeout(() => channel.send(`⚠️ <@${userId}>، سيتم الأرشفة تلقائياً بعد ساعة.`), 60*60*1000);
    const close = setTimeout(() => closeTicket(channel, userId, "النظام التلقائي", "عدم الاستجابة"), 120*60*1000);
    ticketTimers.set(channel.id, { userPing, warning, close, userId });
}

async function closeTicket(channel, userId, closer, reason) {
    try {
        const data = ticketData.get(channel.id) || { claimer: 'لم يتم الاستلام' };
        const messages = await channel.messages.fetch({ limit: 100 });
        const logContent = messages.reverse().map(m => `${m.author.tag}: ${m.content}`).join('\n');
        const attachment = new AttachmentBuilder(Buffer.from(logContent, 'utf-8'), { name: `transcript-${channel.name}.txt` });

        const user = await client.users.fetch(userId).catch(() => null);
        if (user) {
            const dmEmbed = new EmbedBuilder()
                .setTitle('📂 ملخص محادثة التكت | sp8')
                .addFields(
                    { name: '👤 صاحب التكت', value: `<@${userId}>`, inline: true },
                    { name: '✅ استلم التكت', value: `${data.claimer}`, inline: true },
                    { name: '🔒 أغلق التكت', value: `${closer}`, inline: true },
                    { name: '📝 السبب', value: reason }
                ).setColor('#D4AF37').setTimestamp();
            await user.send({ embeds: [dmEmbed], files: [attachment] }).catch(() => {});
        }

        await channel.setParent(CLOSED_CATEGORY_ID);
        await channel.lockPermissions();
        await channel.setName(`closed-${channel.name}`);
        ticketTimers.delete(channel.id);
    } catch (e) { console.error(e); }
}

client.login(process.env.TOKEN);