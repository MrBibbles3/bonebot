const mongoose = require('mongoose');
const cooldowns = new Map();
const {Client, REST, Routes, SlashCommandBuilder, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle} = require('discord.js');
const cards = require('./data/cards');
const rarities = require('./data/rarities');
const User = require('./models/User');
let currentShopMessages = [];
let shopEndTime = null;
let countdownInterval = null;
let shopHeaderMessage = null;
const BOT_VERSION = "0.15";


const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

async function clearShopChannel(channel) {
  try {
    const messages = await channel.messages.fetch({ limit: 100 });

    if (messages.size > 0) {
      await channel.bulkDelete(messages, true);
    }

    console.log("Shop channel cleared.");
  } catch (err) {
    console.error("Failed to clear shop channel:", err);
  }
}


client.once('clientReady', async () => {
  console.log(`Logged in as ${client.user.tag}`);

  try {
    const shopChannel = await client.channels.fetch('1471357861526241350');

    // 🔥 Clear entire channel first
    await clearShopChannel(shopChannel);

    // Post fresh shop
    await postShop(shopChannel);

    // Update!
    await shopChannel.send(`Update ${BOT_VERSION} is live!`);


    // Rotate every 45 minutes
    setInterval(async () => {
      await postShop(shopChannel);
    }, 45 * 60 * 1000);

  } catch (err) {
    console.error("Shop boot error:", err);
  }
});



console.log("Attempting MongoDB connection...");
//mongoose.connect('mongodb://127.0.0.1:27017/bonebot')
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Mongo Error:', err.message));


//client.login('token');
client.login(process.env.TOKEN);


//Enable Slash Commands
const commands = [
  new SlashCommandBuilder()
  .setName('inventory')
  .setDescription('View a card collection')
  .addUserOption(option =>
    option
      .setName('user')
      .setDescription('User to view')
      .setRequired(false)
  ),


  new SlashCommandBuilder()
    .setName('daily')
    .setDescription('Claim your daily Bones reward'),

  new SlashCommandBuilder()
    .setName('balance')
    .setDescription('Check a Bone balance')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('User to view')
        .setRequired(false)
    )
].map(command => command.toJSON());


const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => { 
  try {
    console.log('Registering slash commands...');

    await rest.put(
      Routes.applicationGuildCommands(
        '1471165869588742418',  // CLIENT ID
        '1470496896698028053'        // SERVER ID
      ),
      { body: commands }
    );

    console.log('Slash commands registered.');
  } catch (error) {
    console.error(error);
  }
})();





//Card Shop
function getRandomCard(rarityKey) {
  const pool = cards[rarityKey];

  if (!pool || pool.length === 0) return null;

  const card = pool[Math.floor(Math.random() * pool.length)];

  return {
    ...card,
    rarity: rarityKey
  };
}


//
// Shop Function
//
async function postShop(channel) {

  // Clear old countdown interval
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }

  // Delete previous shop messages
  for (const msg of currentShopMessages) {
    try {
      await msg.delete();
    } catch (err) {}
  }

  currentShopMessages = [];

  const shopItems = generateShop();

  shopEndTime = Date.now() + (45 * 60 * 1000); // 45 minutes

  // Send header
  shopHeaderMessage = await channel.send("Loading shop...");

  currentShopMessages.push(shopHeaderMessage);

  // Send cards
  for (const card of shopItems) {

    const rarityData = rarities[card.rarity];

    const cardEmbed = new EmbedBuilder()
      .setColor(rarityData.color)
      .setTitle(card.name)
      .setDescription(
        `${rarityData.emoji} **${rarityData.name}** ${rarityData.emoji}\n\n` +
        `**Price:** \`${card.price} Bones\`\n` +
        `**Card ID:** \`${card.id}\``
      )
      .setThumbnail(`https://cdn.jsdelivr.net/gh/MrBibbles3/bonebot@main/images/${card.id}.png?update=${Date.now()}`)
      .setFooter({ text: "Click Buy to purchase" });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`buy_${card.id}`)
        .setLabel('Buy')
        .setStyle(ButtonStyle.Primary)
    );

    const msg = await channel.send({
      embeds: [cardEmbed],
      components: [row]
    });

    currentShopMessages.push(msg);
  }

  // Start countdown updater
  // Start countdown updater
countdownInterval = setInterval(async () => {

  const timeLeft = shopEndTime - Date.now();

  if (timeLeft <= 0) {
    clearInterval(countdownInterval);
    countdownInterval = null;
    return;
  }

  const secondsTotal = Math.floor(timeLeft / 1000);
  const minutes = Math.floor(secondsTotal / 60);
  const seconds = secondsTotal % 60;

  const formatted = `${minutes}m ${seconds}s`;

  try {
    await shopHeaderMessage.edit(
      `# 🦴 The Bone Emporium!\n🔥 Rotating Stock 🔥\n\n⏳ Refreshes in: **${formatted}**`
    );
  } catch (err) {}

  // 🔥 Switch to 1 second updates when 30 seconds remain
  if (timeLeft <= 30000 && countdownInterval) {

    clearInterval(countdownInterval);

    countdownInterval = setInterval(async () => {

      const finalTimeLeft = shopEndTime - Date.now();

      if (finalTimeLeft <= 0) {
        clearInterval(countdownInterval);
        countdownInterval = null;
        return;
      }

      const sec = Math.floor(finalTimeLeft / 1000);
      const m = Math.floor(sec / 60);
      const s = sec % 60;

      try {
        await shopHeaderMessage.edit(
          `# 🦴 The Bone Emporium!\n🔥 Rotating Stock 🔥\n\n⏳ Refreshes in: **${m}m ${s}s**`
        );
      } catch (err) {}

    }, 1000);

  }

}, 10000); // Start with 10 second interval

}


function generateShop() {
  const shop = [];

  shop.push(getRandomCard('COMMON'));
  shop.push(getRandomCard('EPIC'));

  const midRarity = Math.random() < 0.5 ? 'SECRET' : 'NIGHTMARE';
  shop.push(getRandomCard(midRarity));

  if (Math.random() < 0.10) {
    shop.push(getRandomCard('APEX'));
  }

  return shop.filter(card => card !== null);
}











// Message commands and counter

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  // ----------------------
  // GIVE CARD COMMAND
  // ----------------------
  if (message.content.startsWith('!givecard')) {

    if (!message.member.permissions.has('Administrator')) {
      return message.reply("You don't have permission to use this command.");
    }

    const args = message.content.split(' ');

    const target = message.mentions.users.first();
    const cardId = args[2];
    const amount = parseInt(args[3]) || 1;

    if (!target || !cardId || amount <= 0) {
      return message.reply("Usage: !givecard @user CARD_ID [amount]");
    }

    // Find card in your card pool
    const allCards = Object.values(cards).flat();
    const card = allCards.find(c => c.id === cardId);

    if (!card) {
      return message.reply("Invalid Card ID.");
    }

    let user = await User.findOne({ userId: target.id });

    if (!user) {
      user = new User({
        userId: target.id,
        bones: 0,
        inventory: []
      });
    }

    const existingCard = user.inventory.find(i => i.itemId === card.id);

    if (existingCard) {
      existingCard.quantity += amount;
    } else {
      user.inventory.push({
        itemId: card.id,
        quantity: amount
      });
    }

    await user.save();

    return message.channel.send(
      `Gave \`${amount}\`x **${card.name}** to ${target}.`
    );
  }

  // ----------------------
  // REMOVE CARD COMMAND
  // ----------------------
  if (message.content.startsWith('!removecard')) {

    if (!message.member.permissions.has('Administrator')) {
      return message.reply("You don't have permission to use this command.");
    }

    const args = message.content.split(' ');

    const target = message.mentions.users.first();
    const cardId = args[2];
    const amount = parseInt(args[3]) || 1;

    if (!target || !cardId || amount <= 0) {
      return message.reply("Usage: !removecard @user CARD_ID [amount]");
    }

    let user = await User.findOne({ userId: target.id });

    if (!user) {
      return message.reply("That user has no inventory.");
    }

    const existingCard = user.inventory.find(i => i.itemId === cardId);

    if (!existingCard) {
      return message.reply("That user does not own this card.");
    }

    existingCard.quantity -= amount;

    if (existingCard.quantity <= 0) {
      user.inventory = user.inventory.filter(i => i.itemId !== cardId);
    }

    await user.save();

    return message.channel.send(
      `Removed \`${amount}\`x card \`${cardId}\` from ${target}.`
    );
  }


  // ----------------------
  // Bones Command
  // ----------------------
  if (message.content.startsWith('!givebones')) {

  // Only allow admins
  if (!message.member.permissions.has('Administrator')) {
    return message.reply("You don't have permission to use this command.");
  }

  const args = message.content.split(' ');

  const target = message.mentions.users.first();
  const amount = parseInt(args[2]);

  if (!target || isNaN(amount) || amount <= 0) {
    return message.reply("Usage: !givebones @user <amount>");
  }

  let user = await User.findOne({ userId: target.id });

  if (!user) {
    user = new User({
      userId: target.id,
      bones: 0,
      inventory: []
    });
  }

  user.bones += amount;
  await user.save();

  return message.channel.send(
    `Added \`${amount}\` Bones to ${target}.`
  );
}
  // ----------------------
// REMOVE BONES COMMAND
// ----------------------
if (message.content.startsWith('!removebones')) {

  // Admin only
  if (!message.member.permissions.has('Administrator')) {
    return message.reply("You don't have permission to use this command.");
  }

  const args = message.content.split(' ');

  const target = message.mentions.users.first();
  const amount = parseInt(args[2]);

  if (!target || isNaN(amount) || amount <= 0) {
    return message.reply("Usage: !removebones @user <amount>");
  }

  let user = await User.findOne({ userId: target.id });

  if (!user) {
    return message.reply("That user does not have an account yet.");
  }

  user.bones -= amount;

  if (user.bones < 0) {
    user.bones = 0;
  }

  await user.save();

  return message.channel.send(
    `Removed \`${amount}\` Bones from ${target}.\nNew Balance: \`${user.bones}\``
  );
}


  // ----------------------
  // Shop Command
  // ----------------------

  if (message.content.toLowerCase() === '!shop') {

    const shopItems = generateShop();

    // Header Message
    await message.channel.send(
      "# 🦴 The Bone Emporium!\n🔥 Check out the current Rotating Stock! 🔥"
    );

    // Send each card as its own embed
    for (const card of shopItems) {

      const rarityData = rarities[card.rarity];

      const cardEmbed = new EmbedBuilder()
        .setColor(rarityData.color)
        .setTitle(card.name)
        .setDescription(
          `${rarityData.emoji} **${rarityData.name}** ${rarityData.emoji}\n\n` +
          `**Price:** \`${card.price} Bones\`\n` +
          `**Card ID:** \`${card.id}\``
        )
        .setThumbnail(`https://cdn.jsdelivr.net/gh/MrBibbles3/bonebot@main/images/${card.id}.png?update=${Date.now()}`)
        .setFooter({ text: "Click Buy to purchase" });


        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
          .setCustomId(`buy_${card.id}`)
          .setLabel('Buy')
          .setStyle(ButtonStyle.Primary)
        );

        await message.channel.send({
          embeds: [cardEmbed],
          components: [row]
        });

    }
    return;
  }



  // ----------------------
  // BONES EARNING SYSTEM
  // ----------------------

  const now = Date.now();
  const cooldownAmount = 60 * 1000; // 60 seconds

  if (cooldowns.has(message.author.id)) {
    const expirationTime = cooldowns.get(message.author.id) + cooldownAmount;

    if (now < expirationTime) {
      return; // Still on cooldown, do nothing
    }
  }

  cooldowns.set(message.author.id, now);

  let user = await User.findOne({ userId: message.author.id });

  if (!user) {
    user = new User({
      userId: message.author.id,
      bones: 500,
      inventory: []
    });
  }

  const bonesEarned = Math.floor(Math.random() * 4) + 1;
  user.bones += bonesEarned;

  await user.save();

  console.log(`${message.author.username} earned ${bonesEarned} bones and now has ${user.bones}`);
});




client.on('interactionCreate', async interaction => {

  // =====================================================
  // SLASH COMMANDS
  // =====================================================
  if (interaction.isChatInputCommand()) {

    if (interaction.commandName === 'daily') {

  let user = await User.findOne({ userId: interaction.user.id });

  if (!user) {
    user = new User({
      userId: interaction.user.id,
      bones: 500,
      inventory: [],
      dailyStreak: 0
    });
  }

  const now = new Date();
const cooldown = 16 * 60 * 60 * 1000; // 16 hours
const streakWindow = 24 * 60 * 60 * 1000; // 24h to maintain streak
const maxStreak = 7;

if (user.dailyLastClaim) {
  const timePassed = now - user.dailyLastClaim;

  // Still on cooldown
  if (timePassed < cooldown) {
    const timeLeft = cooldown - timePassed;

    const hours = Math.floor(timeLeft / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));

    return interaction.reply({
      content: `You already claimed your daily reward.\nCome back in ${hours}h ${minutes}m.`,
      flags: 64
    });
  }

  // Missed streak window
  if (timePassed > streakWindow) {
    user.dailyStreak = 0;
  }
}

// Increase streak but cap at 7
if (user.dailyStreak < maxStreak) {
  user.dailyStreak += 1;
}

const baseReward = Math.floor(Math.random() * 21) + 90; // 90–110
const streakBonus = user.dailyStreak * 10;
const totalReward = baseReward + streakBonus;

user.bones += totalReward;
user.dailyLastClaim = now;

await user.save();

return interaction.reply({
  content:
    `🦴 Daily claimed!\n\n` +
    `Base: \`${baseReward}\`\n` +
    `Streak Bonus: \`${streakBonus}\`\n` +
    `Total: \`${totalReward}\`\n\n` +
    `🔥 Current Streak: ${user.dailyStreak}/7`,
  flags: 64
});

}



  if (interaction.commandName === 'balance') {

  const targetUser = interaction.options.getUser('user') || interaction.user;

  let user = await User.findOne({ userId: targetUser.id });

  if (!user) {
    user = new User({
      userId: targetUser.id,
      bones: 500,
      inventory: []
    });
    await user.save();
  }

  const balanceEmbed = new EmbedBuilder()
    .setColor(0xE5C07B)
    .setTitle('🦴 Bone Balance 🦴')
    .setDescription(`${targetUser}'s balance:`)
    .addFields(
      { name: 'Bones', value: `\`${user.bones}\``, inline: true }
    )
    .setTimestamp();

  return interaction.reply({
    embeds: [balanceEmbed],
    flags: 64
  });
}



    if (interaction.commandName === 'inventory') {

      const targetUser = interaction.options.getUser('user') || interaction.user;//*********************** */

      const target = interaction.options.getUser('user') || interaction.user;

      const user = await User.findOne({ userId: target.id });


      if (!user || user.inventory.length === 0) {
        const ownerUser = await client.users.fetch(target.id);

        return interaction.reply({
          content: `${ownerUser.username} doesn't own any cards yet.`,
          flags: 64
        });
      }


      const inventoryEmbed = new EmbedBuilder()
        .setColor(0x2B2D31)
        .setTitle(`📦 ${target.username}'s Card Collection`)
        .setDescription("Select an option below:")
        .setTimestamp();

      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`inv_list_${target.id}_${interaction.user.id}`)
          .setLabel('List')
          .setEmoji('✅')
          .setStyle(ButtonStyle.Secondary),

        new ButtonBuilder()
          .setCustomId(`inv_COMMON_${target.id}_${interaction.user.id}`)
          .setEmoji('🟩')
          .setStyle(ButtonStyle.Secondary),

        new ButtonBuilder()
          .setCustomId(`inv_EPIC_${target.id}_${interaction.user.id}`)
          .setEmoji('🟪')
          .setStyle(ButtonStyle.Secondary),

        new ButtonBuilder()
          .setCustomId(`inv_SECRET_${target.id}_${interaction.user.id}`)
          .setEmoji('🟥')
          .setStyle(ButtonStyle.Secondary),

        new ButtonBuilder()
          .setCustomId(`inv_NIGHTMARE_${target.id}_${interaction.user.id}`)
          .setEmoji('⬛')
          .setStyle(ButtonStyle.Secondary)
      );

      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`inv_APEX_${target.id}_${interaction.user.id}`)
          .setEmoji('💠')
          .setStyle(ButtonStyle.Secondary)
      );

      return interaction.reply({
        embeds: [inventoryEmbed],
        components: [row1, row2],
        flags: 64
      });
    }
  }

  // =====================================================
  // BUTTON INTERACTIONS
  // =====================================================
  if (interaction.isButton()) {



// =============================
// PAGINATION (ARROWS)
// =============================
if (interaction.customId.startsWith('inv_next_') || interaction.customId.startsWith('inv_prev_')) {

  const parts = interaction.customId.split('_');

  const direction = parts[1]; // next or prev
  const rarity = parts[2];
  const currentIndex = parseInt(parts[3]);
  const ownerId = parts[4];
  const viewerId = parts[5];


  if (interaction.user.id !== viewerId) {
    return interaction.reply({
      content: "This is not your inventory.",
      flags: 64
    });
  }
  const user = await User.findOne({ userId: ownerId });

  if (!user) {
    return interaction.reply({
      content: "No inventory found.",
      flags: 64
    });
  }

  const ownedCards = user.inventory.filter(invItem =>
    cards[rarity].some(c => c.id === invItem.itemId)
  );

  if (ownedCards.length === 0) {
    return interaction.reply({
      content: "No cards found.",
      flags: 64
    });
  }

  let newIndex = currentIndex;

  if (direction === 'next') {
    newIndex++;
    if (newIndex >= ownedCards.length) newIndex = 0; // loop
  }

  if (direction === 'prev') {
    newIndex--;
    if (newIndex < 0) newIndex = ownedCards.length - 1; // loop
  }

  const cardId = ownedCards[newIndex].itemId;
  const cardData = cards[rarity].find(c => c.id === cardId);

  const embed = new EmbedBuilder()
    .setColor(rarities[rarity].color)
    .setTitle(`${rarities[rarity].emoji} ${rarities[rarity].name} ${rarities[rarity].emoji}`)
    .setDescription(`**${cardData.name}**\nID: \`${cardData.id}\`\nQty: \`${ownedCards[newIndex].quantity}\``)
    .setImage(`https://cdn.jsdelivr.net/gh/MrBibbles3/bonebot@main/images/${cardData.id}.png?update=${Date.now()}`)
    .setFooter({ text: `Page ${newIndex + 1} of ${ownedCards.length}` });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`inv_prev_${rarity}_${newIndex}_${ownerId}_${viewerId}`)
      .setLabel('◀')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId(`inv_next_${rarity}_${newIndex}_${ownerId}_${viewerId}`)
      .setLabel('▶')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId(`inv_menu_${ownerId}_${viewerId}`)
      .setLabel('Return')
      .setStyle(ButtonStyle.Danger)
  );

  return interaction.update({
    embeds: [embed],
    components: [row]
  });
}


    // -----------------------------------------------------
    // BUY BUTTONS
    // -----------------------------------------------------
    if (interaction.customId.startsWith('buy_')) {

      const cardId = interaction.customId.replace('buy_', '');

      const allCards = Object.values(cards).flat();
      const card = allCards.find(c => c.id === cardId);

      if (!card) {
        return interaction.reply({ content: "Card not found.", flags: 64 });
      }

      let user = await User.findOne({ userId: interaction.user.id });

      if (!user) {
        return interaction.reply({ content: "You don't have an account yet.", flags: 64 });
      }

      if (user.bones < card.price) {
        return interaction.reply({ content: "You don't have enough Bones!", flags: 64 });
      }

      user.bones -= card.price;

      const existingCard = user.inventory.find(i => i.itemId === card.id);

      if (existingCard) {
        existingCard.quantity += 1;
      } else {
        user.inventory.push({
          itemId: card.id,
          quantity: 1
        });
      }

      await user.save();

      return interaction.reply({
        content: `You successfully purchased **${card.name}** for ${card.price} Bones!`,
        flags: 64
      });
    }

    // -----------------------------------------------------
    // INVENTORY BUTTONS
    // -----------------------------------------------------
    if (interaction.customId.startsWith('inv_')) {

  const parts = interaction.customId.split('_');

  const action = parts[1];      // list / COMMON / EPIC etc
  const ownerId = parts[2];
  const viewerId = parts[3];

  if (interaction.user.id !== viewerId) {
    return interaction.reply({
      content: "This is not your inventory.",
      flags: 64
    });
  }

  const user = await User.findOne({ userId: ownerId });

  if (!user) {
    return interaction.reply({ content: "No inventory found.", flags: 64 });
  }


      // LIST VIEW
     if (action === 'list') {

        const rarityOrder = ['COMMON', 'EPIC', 'SECRET', 'NIGHTMARE', 'APEX'];
        const allCards = Object.values(cards).flat();

        const sortedInventory = user.inventory
          .map(invItem => {
            const cardData = allCards.find(c => c.id === invItem.itemId);
            if (!cardData) return null;

            let rarityKey = null;
            for (const key of Object.keys(cards)) {
              if (cards[key].some(c => c.id === invItem.itemId)) {
                rarityKey = key;
                break;
              }
            }

            return {
              ...cardData,
              quantity: invItem.quantity,
              rarity: rarityKey
            };
          })
          .filter(Boolean)
          .sort((a, b) => rarityOrder.indexOf(a.rarity) - rarityOrder.indexOf(b.rarity));

        if (sortedInventory.length === 0) {
          return interaction.reply({ content: "Inventory empty.", flags: 64 });
        }

        const ownerUser = await client.users.fetch(ownerId);
        const listEmbed = new EmbedBuilder()
          .setColor(0x2B2D31)
          .setTitle(`📜 ${ownerUser.username}'s Cards`)
          .setTimestamp();

        sortedInventory.forEach(card => {
          const rarityEmoji = rarities[card.rarity].emoji;
          listEmbed.addFields({
            name: `${rarityEmoji} ${card.name}`,
            value: `ID: \`${card.id}\` • Qty: \`${card.quantity}\``,
            inline: false
          });
        });

        const returnRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`inv_menu_${ownerId}_${viewerId}`)
            .setLabel('Return')
            .setStyle(ButtonStyle.Danger)
        );

        return interaction.update({
          embeds: [listEmbed],
          components: [returnRow]
        });
      }

// RARITY VIEW
const rarityKeys = ['COMMON', 'EPIC', 'SECRET', 'NIGHTMARE', 'APEX'];

for (const rarity of rarityKeys) {
  if (action === rarity) {

    const ownedCards = user.inventory.filter(invItem =>
      cards[rarity].some(c => c.id === invItem.itemId)
    );

    if (ownedCards.length === 0) {

      const ownerUser = await client.users.fetch(ownerId);

      const emptyEmbed = new EmbedBuilder()
        .setColor(0x2B2D31)
        .setTitle(`📦 ${ownerUser.username}'s Card Collection`)
        .setDescription(
          `❌ ${ownerUser.username} doesn't own any ${rarities[rarity].name} cards.`
        )
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`inv_menu_${ownerId}_${viewerId}`)
          .setLabel('Return')
          .setStyle(ButtonStyle.Danger)
      );

      return interaction.update({
        embeds: [emptyEmbed],
        components: [row]
      });
    }


    const firstCardId = ownedCards[0].itemId;
    const cardData = cards[rarity].find(c => c.id === firstCardId);

    const embed = new EmbedBuilder()
    .setColor(rarities[rarity].color)
    .setTitle(`${rarities[rarity].emoji} ${rarities[rarity].name} ${rarities[rarity].emoji}`)
    .setDescription(
      `**${cardData.name}**\n` +
      `ID: \`${cardData.id}\`\n` +
      `Qty: \`${ownedCards[0].quantity}\``
    )
    .setImage(`https://cdn.jsdelivr.net/gh/MrBibbles3/bonebot@main/images/${cardData.id}.png?update=${Date.now()}`)
    .setFooter({ text: `Page 1 of ${ownedCards.length}` });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`inv_prev_${rarity}_0_${ownerId}_${viewerId}`)
        .setLabel('◀')
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId(`inv_next_${rarity}_0_${ownerId}_${viewerId}`)
        .setLabel('▶')
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId(`inv_menu_${ownerId}_${viewerId}`)
        .setLabel('Return')
        .setStyle(ButtonStyle.Danger)
    );

    return interaction.update({
      embeds: [embed],
      components: [row]
    });
  }
}


      // RETURN TO MENU
      if (action === 'menu') {
        const ownerUser = await client.users.fetch(ownerId);
        const inventoryEmbed = new EmbedBuilder()
          .setColor(0x2B2D31)
          .setTitle(`📦 ${ownerUser.username}'s Card Collection`)
          .setDescription("Select an option below:")
          .setTimestamp();

        const row1 = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`inv_list_${ownerId}_${viewerId}`)
            .setLabel('List')
            .setEmoji('✅')
            .setStyle(ButtonStyle.Secondary),

          new ButtonBuilder()
            .setCustomId(`inv_COMMON_${ownerId}_${viewerId}`)
            .setEmoji('🟩')
            .setStyle(ButtonStyle.Secondary),

          new ButtonBuilder()
            .setCustomId(`inv_EPIC_${ownerId}_${viewerId}`)
            .setEmoji('🟪')
            .setStyle(ButtonStyle.Secondary),

          new ButtonBuilder()
            .setCustomId(`inv_SECRET_${ownerId}_${viewerId}`)
            .setEmoji('🟥')
            .setStyle(ButtonStyle.Secondary),

          new ButtonBuilder()
            .setCustomId(`inv_NIGHTMARE_${ownerId}_${viewerId}`)
            .setEmoji('⬛')
            .setStyle(ButtonStyle.Secondary)
        );

        const row2 = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`inv_APEX_${ownerId}_${viewerId}`)
            .setEmoji('💠')
            .setStyle(ButtonStyle.Secondary)
        );

        return interaction.update({
          embeds: [inventoryEmbed],
          components: [row1, row2]
        });
      }

      }
  }

});
