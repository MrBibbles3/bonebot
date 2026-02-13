const generateImage = require('./generatePlaceholder');
const fs = require('fs');
const readline = require('readline');

const FILE_PATH = './data/cards.js';

const rarityPrefixes = {
  COMMON: 'C',
  EPIC: 'E',
  SECRET: 'S',
  NIGHTMARE: 'N',
  APEX: 'A'
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(question) {
  return new Promise(resolve => rl.question(question, resolve));
}

async function main() {
  const name = await ask('Card Name: ');
  let rarity = await ask('Rarity (COMMON, EPIC, SECRET, NIGHTMARE, APEX): ');
  const price = await ask('Price: ');

  rarity = rarity.toUpperCase();

  if (!rarityPrefixes[rarity]) {
    console.log('❌ Invalid rarity.');
    rl.close();
    return;
  }

  const fileContent = fs.readFileSync(FILE_PATH, 'utf8');

  const prefix = rarityPrefixes[rarity];

  // Find highest ID
  const idRegex = new RegExp(`'${prefix}(\\d+)'`, 'g');
  let match;
  let highest = 0;

  while ((match = idRegex.exec(fileContent)) !== null) {
    const num = parseInt(match[1]);
    if (num > highest) highest = num;
  }

  const newId = `${prefix}${highest + 1}`;

  const rarityLower = rarity.toLowerCase();

  const newCardBlock = `
        {
            id: '${newId}',
            name: '${name.replace(/'/g, "\\'")}',
            price: ${parseInt(price)},
            rarity: '${rarityLower}'            
        }`;

  // Insert into correct rarity array
  const arrayRegex = new RegExp(`${rarity}: \\[(.*?)\\n\\s*\\]`, 's');

  const updatedContent = fileContent.replace(arrayRegex, (match) => {
    if (match.includes('{')) {
      return match.replace(']', `,${newCardBlock}\n    ]`);
    } else {
      return match.replace('[', `[\n${newCardBlock}\n    `);
    }
  });

  fs.writeFileSync(FILE_PATH, updatedContent);

  console.log('\n✅ Card created successfully!');
  console.log(`ID: ${newId}`);
  console.log(`Name: ${name}`);
  console.log(`Rarity: ${rarity}`);
  console.log(`Price: ${price}`);

    // Check if image exists
    const imagePath = `./images/${newId}.png`;

    if (!fs.existsSync(imagePath)) {
    await generateImage(newId, name, rarityLower);
    }


  rl.close();
}

main();
