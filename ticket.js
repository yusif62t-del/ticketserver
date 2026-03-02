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

const ticketData = new Map();

client.once('ready', () => {
    console.log(`✅ بوت sp8 جاهز | تم تسجيل الدخول كـ ${client.user.tag}`);
});

// --- 🛠️ أمر Setup ---
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (message.content === '!setup') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;
        const row = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('select_ticket')
                .setPlaceholder('اختر نوع التذكرة')
                .addOptions(Object.keys(CONFIG).map(key => ({ label: CONFIG[key].label, value: key })))
        );
        const embed = new EmbedBuilder()
            .setTitle('نظام التذاكر | sp8').setDescription('اختر القسم المناسب لفتح تذكرة.').setImage(LOGO_URL).setColor('#D4AF37');
        await message.channel.send({ embeds: [embed], components: [row] });
        return message.delete().catch(() => {});
    }
});

// --- 📩 التعامل مع التفاعلات (القائمة والأزرار) ---
client.on('interactionCreate', async (interaction) => {
    // 1. فتح التكت عبر القائمة
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
            await interaction.editReply({ content: `تم فتح تذكرتك: ${ticketChannel}` });
            
            const buttons = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`claim_${selected.role}`).setLabel('استلام').setStyle(ButtonStyle.Success).setEmoji('✅'),
                new ButtonBuilder().setCustomId('close_ticket').setLabel('إغلاق').setStyle(ButtonStyle.Danger).setEmoji('🔒')
            );
            await ticketChannel.send({ 
                content: `🔔 <@&${selected.role}> محادثة جديدة!`, 
                embeds: [new EmbedBuilder().setTitle(`قسم ${selected.label}`).setDescription(`حياك الله <@${interaction.user.id}>، انتظر رد المسؤول.`).setColor('#D4AF37')],
                components: [buttons] 
            });
        } catch (e) { console.error(e); }
    }

    // 2. معالجة ضغطات الأزرار
    if (interaction.isButton()) {
        const data = ticketData.get(interaction.channel.id) || { userId: interaction.user.id };

        // زر الاستلام
        if (interaction.customId.startsWith('claim_')) {
            const roleId = interaction.customId.split('_')[1];
            if (!interaction.member.roles.cache.has(roleId)) {
                return interaction.reply({ content: "❌ هذا الزر للمسؤولين فقط.", ephemeral: true });
            }
            ticketData.set(interaction.channel.id, { ...data, claimer: interaction.user.id });
            await interaction.reply({ content: `✅ التذكرة الآن تحت إشراف: <@${interaction.user.id}>` });
            
            const disabledRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('claimed').setLabel(`مستلمة من: ${interaction.user.username}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
                new ButtonBuilder().setCustomId('close_ticket').setLabel('إغلاق').setStyle(ButtonStyle.Danger).setEmoji('🔒')
            );
            await interaction.message.edit({ components: [disabledRow] });
        }

        // زر الإغلاق
        if (interaction.customId === 'close_ticket') {
            await interaction.reply("🔒 جاري أرشفة التذكرة وإغلاقها...");
            await closeTicket(interaction.channel, data.userId);
        }
    }
});

async function closeTicket(channel, userId) {
    try {
        await channel.setParent(CLOSED_CATEGORY_ID);
        await channel.lockPermissions();
        await channel.setName(`closed-${channel.name}`);
        const user = await client.users.fetch(userId).catch(() => null);
        if (user) await user.send(`📂 تم إغلاق تذكرتك في سيرفر **sp8**.`).catch(() => {});
    } catch (e) { console.error(e); }
}

if (!process.env.TOKEN) console.error("⚠️ خطأ: لم يتم العثور على التوكن في إعدادات البيئة!");

