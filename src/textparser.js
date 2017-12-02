import cheerio from 'cheerio';

export const parseCardTextBlock = (element) => {
  const raw = cheerio(element).html();
  const parsedText = raw.replace(/<img[^>]*alt="([^"]*)"[^>]*>/g, '{$1}')
    .replace(/<\/?i>/g, '')
    .replace(/&#x2212;/g, '−')
    .replace(/(&#x2019;|&apos;)/g, "'")
    .replace(/&quot;/g, '"')
    .trim();

  return parsedText;
};

const parseCardText = (cardTextElement) => {
  const textParts = [];

  cheerio(' > *', cardTextElement).each((index, element) => {
    textParts.push(parseCardTextBlock(element));
  });

  return textParts.join('\n').trim();;
};

export default parseCardText;
