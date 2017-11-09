import fs from 'fs';
import path from 'path';
import uuid from 'uuid/v4';
import async from 'async';

import { closeNetwork } from './network';

import loadSet from './load_set';
import { fetchGathererCardList, fetchMultiverseCard } from './card_fetcher';

const loadFetchAndSave = setCode => {
  let SET = null;
  let cards = null;
  loadSet(setCode)
    .then(setData => {
      SET = setData;
      return fetchGathererCardList(setData.SET.name);
    })
    .then(cardList => {
      cards = cardList;

      let savedCards = [];
      if (SET.data && SET.data.cards) {
        savedCards = SET.data.cards;
      }
      
      const SET_CONTENTS = {
        cards: [
          ...savedCards,
        ],
        ...SET.SET,
      };

      cardList.forEach(cardEntry => {
        let setCard = SET_CONTENTS.cards.find(card => {
          return parseInt(card.multiverseid) == parseInt(cardEntry.multiverseid);
        });

        if (!setCard) {
          setCard = {
            ...cardEntry,
            _id: uuid(),
          };
          SET_CONTENTS.cards.push(setCard);
        } else {
          Object.keys(cardEntry).forEach(cardEntryKey => {
            setCard[cardEntryKey] = cardEntry[cardEntryKey];
          });
        }
      });

      SET_CONTENTS.cards = SET_CONTENTS.cards.sort((a, b) => a.name.localeCompare(b.name));

      async.eachSeries(
        SET_CONTENTS.cards,
        (card, callback) => {
          console.log(`Fetching ${card.multiverseid}...`);
          fetchMultiverseCard(card.multiverseid)
            .then(fetchedCard => {
              console.log(`done with ${card.multiverseid}.`);
              callback();
            });
        }
      );

      fs.writeFile(
        path.join(__dirname, '..', 'json', setCode + '.json'),
        JSON.stringify(SET_CONTENTS, null, 2),
        'utf8',
        (err) => {
          if (err) throw err;

          console.log('file saving completed');
        }
      );
    })
    .catch(err => {
      console.error(err);
    });  
};

//loadFetchAndSave('ORI');

fetchMultiverseCard(398423)
  .then(cardInfo => {
    console.log(cardInfo);
  })
  .catch(err => {
    if (err) throw(err);
  })
  .then(() => {
    console.log('closing network...');
    closeNetwork();
  })
