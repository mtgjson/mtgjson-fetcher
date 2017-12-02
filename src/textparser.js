import cheerio from 'cheerio';

const manaMap = {
  white: 'W',
  blue: 'U',
  black: 'B',
  red: 'R',
  green: 'G',
  colorless: 'C',
  tap: 'T',

  'variable Colorless': 'X',

  0: '0',
  1: '1',
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: '8',
  9: '9',
};

export const parseCardTextBlock = (element) => {
  const raw = cheerio(element).html();
  const parsedText = raw
    .replace(
      /<img[^>]*alt="([^"]*)"[^>]*>/g,
      (matchExpression, inner) => {
        const retVal = manaMap[inner.toLowerCase()];

        if (!retVal) {
          console.warn(`No match for replacing '${inner}'`);
        }

        return retVal
          ? `{${retVal}}`
          : matchExpression;
      }
    )
    .replace(/<\/?i>/g, '')
    .replace(/(&#x2019;|&apos;)/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#x2212;/g, '−')
    .replace(/&#x2014;/g, '—')
    .trim();

  return parsedText;
};

const parseCardText = (cardTextElement) => {
  const textParts = [];

  cheerio(' > *', cardTextElement).each((index, element) => {
    textParts.push(parseCardTextBlock(element));
  });

  return textParts.join('\n').trim();
};

export default parseCardText;
