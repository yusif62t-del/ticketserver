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

const ticketTimers = new Map();
const ticketData = new Map();

// --- ✅ تعديل السطر 36 هنا ---
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

// --- 📩 التعامل مع التفاعلات ---
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
            await interaction.editReply({ content: `تم فتح تذكرتك: ${ticketChannel}` });
            const buttons = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`claim_${selected.role}`).setLabel('استلام').setStyle(ButtonStyle.Success).setEmoji('✅'),
                new ButtonBuilder().setCustomId('close_ticket').setLabel('إغلاق').setStyle(ButtonStyle.Danger).setEmoji('🔒')
            );
            await ticketChannel.send({ content: `🔔 <@&${selected.role}>`, components: [buttons] });
        } catch (e) { console.error(e); }
    }
    // (بقية كود الأزرار والإغلاق تظل كما هي في ملفك الأصلي)
    if (interaction.isButton()) {
        if (interaction.customId === 'close_ticket') {
            await interaction.reply("جاري الإغلاق...");
            const data = ticketData.get(interaction.channel.id) || { userId: interaction.user.id };
            await closeTicket(interaction.channel, data.userId, `<@${interaction.user.id}>`, "إغلاق يدوي");
        }
    }
});

async function closeTicket(channel, userId, closer, reason) {
    try {
        await channel.setParent(CLOSED_CATEGORY_ID);
        await channel.setName(`closed-${channel.name}`);
        // إضافة سجلات أو حذف القناة حسب رغبتك هنا
    } catch (e) { console.error(e); }
}

client.login(process.env.TOKEN);
