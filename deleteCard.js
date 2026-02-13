const fs = require('fs');
const readline = require('readline');

const FILE_PATH = './data/cards.js';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(question) {
  return new Promise(resolve => rl.question(question, resolve));
}

async function main() {

  const cardId = (await ask('Enter Card ID to delete (e.g. C3): ')).toUpperCase();

  let fileContent = fs.readFileSync(FILE_PATH, 'utf8');

  const cardRegex = new RegExp(
    `\\{[^}]*id:\\s*'${cardId}'[^}]*\\},?`,
    's'
  );

  if (!cardRegex.test(fileContent)) {
    console.log('❌ Card not found.');
    rl.close();
    return;
  }

  fileContent = fileContent.replace(cardRegex, '');

  fs.writeFileSync(FILE_PATH, fileContent);

  console.log(`\n💀 Card ${cardId} deleted successfully.`);

  rl.close();
}

main();
