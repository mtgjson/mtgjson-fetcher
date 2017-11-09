import cheerio from 'cheerio';
import { fetch } from './network';

const buildPageListUrl = (setName, page = 1) => `http://gatherer.wizards.com/Pages/Search/Default.aspx?output=compact&page=${page}&set=%5b%22${setName.replace(/ /g, '+')}%22%5d`;
const buildMultiverseUrl = (multiverseid, printed = false) => `http://gatherer.wizards.com/Pages/Card/Details.aspx?multiverseid=${multiverseid}&printed=${printed}`;

const extractMultiverseFromUrl = url => {
  const match = url.match(/multiverseid=([0-9]*)/);
  if (!match) return null;
  return parseInt(match[1]);
};

const extractManaCostFromImages = element => {
  const manaElements = cheerio('img', element);
  const mana = [];

  manaElements.each((idx, element) => {
    const manaUrl = cheerio(element).attr('src');
    const manaValue = manaUrl.match(/name=([^&]*)/);
    mana.push(manaValue[1]);
  });

  const manaCost = mana.map(x => `{${x}}`).join('') || null;

  return manaCost;
};

export const fetchGathererCardList = (setName) => new Promise((accept, reject) => {
  let maxPage = 0;
  let currentPage = 0;
  const cardList = [];

  const fetchCurrentPage = (done, pageNumber) => {
    const url = buildPageListUrl(setName, pageNumber);
    fetch(url)
      .then(body => {
        if (!body) {
          throw new Error('cannot load body from url ' + url);
        }

        return cheerio.load(body)
      })
      .then($ => {
        if (!$) {
          throw new Error('cannot load contents of ' + url);
        }
        // update Max Page
        const pages = $('#ctl00_ctl00_ctl00_MainContent_SubContent_bottomPagingControlsContainer a');
        pages.each((idx, element) => {
          const elementContents = $(element).text();
          const elementValue = parseInt(elementContents) - 1; // in gatherer, the page '1' uses '0' as the index.
          if (!isNaN(elementValue) && elementValue > maxPage) {
            maxPage = elementValue;
          }
        });

        // Parse cards in this page
        const cards = $('tr.cardItem');
        cards.each((idx, element) => {
          const card = {};
          const cardNameElement = cheerio('.name a', element);
          const cardUrl = cardNameElement.attr('href');
          const cardName = cardNameElement.text().trim();
          const multiverseid = extractMultiverseFromUrl(cardUrl);
          const manaElements = cheerio('.mana img', element);
          const manaCost = extractManaCostFromImages(manaElements);

          const type = cheerio('.type', element).text().trim();

          const numericalElements = cheerio('.numerical', element);
          const numericalData = [];
          numericalElements.each((idx, element) => {
            numericalData.push($(element).text().trim());
          });

          const printingElements = cheerio('.printings a', element);

          // console.log(cardName);
          // console.log(multiverseid);
          // console.log(manaCost);
          // console.log(type);
          // console.log(numericalData);

          card.name = cardName;
          card.multiverseid = multiverseid;
          card.manaCost = manaCost;
          card.type = type;

          if (numericalData[1] !== '') {
            if (numericalData[0] !== '') {
              card.power = numericalData[0];
              card.toughness = numericalData[1];
            } else {
              card.loyalty = numericalData[1];
            }
          }

          // Store every version of the card.
          printingElements.each((idx, element) => {
            const cardUrl = cheerio(element).attr('href');
            const multiverseid = extractMultiverseFromUrl(cardUrl);
            const imgElement = cheerio('img', element);
            const imgUrl = imgElement.attr('src');
            const rarity = imgUrl.match(/rarity=([^&]*)/)[1];

            const newCard = {
              ...card,
              multiverseid,
              rarity,
            };

            cardList.push(newCard);
          });
        });

        done();
      })
      .catch(reject);
  };

  const done = () => {
    accept(cardList);
  };

  const callback = () => {
    if (maxPage >= currentPage) {
      fetchCurrentPage(callback, currentPage);
      currentPage++;
    } else {
      done();
    }
  };

  // Start fetching
  callback();
});

const parseRightCol = (rightColElement) => {
  const cardData = {};

  const idPrefix = rightColElement.attr('id').replace('_rightCol', '');

  const extractElement = (suffix, noValue = false) => cheerio(`#${idPrefix}_${suffix} ${noValue ? '' : '.value'}`, rightColElement);

  const cardNameElement = extractElement('nameRow');
  const cardName = cardNameElement.text().trim();
  const manaCostElement = extractElement('manaRow');
  const manaCost = extractManaCostFromImages(manaCostElement);
  const cmcElement = extractElement('cmcRow');
  const cmc = cmcElement && parseInt(cmcElement.text().trim());
  const typeElement = extractElement('typeRow');
  const type = typeElement.text().trim();

  // TODO: parse text
  // TODO: parse flavour
  
  // Extract multiverseid and set name
  const setElement = extractElement('currentSetSymbol', true);
  const setLinkElement = cheerio('a', setElement);
  const multiverseid = extractMultiverseFromUrl(setLinkElement.attr('href'));
  const setImageElement = cheerio('img', setLinkElement);
  const imgUrl = setImageElement.attr('src');
  const setName = imgUrl.match(/set=([^&]*)/)[1];
  const cardRarity = imgUrl.match(/rarity=([^&]*)/)[1];

  const numberRow$ = extractElement('numberRow');
  const number = numberRow$.text().trim();
  const artistRow$ = extractElement('artistRow');
  const artist = artistRow$.text().trim();

  // TODO: parse rulings

  cardData.name = cardName;
  if (manaCost) cardData.manaCost = manaCost;
  if (cmc) cardData.cmc = cmc;
  cardData.multiverseid = multiverseid;
  cardData.type = type;
  cardData.set = setName;
  cardData.rarity = cardRarity;
  cardData.number = number;
  cardData.artist = artist;

  return cardData;
};

export const fetchMultiverseCard = multiverseid => new Promise((accept, reject) => {
  const pageUrl = buildMultiverseUrl(multiverseid, false);
  const printedPageUrl = buildMultiverseUrl(multiverseid, true);

  const cardData = {
    multiverseid,
  };

  fetch(pageUrl)
    .then(body => {
      if (!body) {
        throw new Error('cannot load body from url ' + url);
      }

      return cheerio.load(body)
    })
    .then($ => {
      const parsedCards = [];
      $('td.rightCol').each((idx, element) => {
        parsedCards.push(parseRightCol(cheerio(element)));
      });

      let cardNames = null;
      if (parsedCards.length > 1) {
        cardNames = parsedCards.map(card => card.name);
      }

      const currentCard = parsedCards.find(card => card.multiverseid == multiverseid);

      if (cardNames) currentCard.names = cardNames;

      accept(currentCard);
    })
    .catch(reject);
});
