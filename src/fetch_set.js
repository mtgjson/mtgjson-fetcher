import fs from 'fs';
import path from 'path';
import uuid from 'uuid/v4';
import async from 'async';

import { closeNetwork } from './network';

import loadSet from './load_set';
import { fetchGathererCardList, fetchMultiverseCard } from './card_fetcher';

const setList = [];

process.argv.slice(2).forEach(param => {
  // TODO: Check for '--ignore-cache' and handle accordingly
  // TODO: Check for '--ignore-timeout' and handle accordingly
  setList.push(param);
});

const loadFetchAndSave = setCode => {
  let SET = null;
  let cards = null;
  let SET_CONTENTS = null;

  return loadSet(setCode)
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
      
      SET_CONTENTS = {
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
    })
    .then(() => new Promise((accept, reject) => {
      async.eachSeries(
        SET_CONTENTS.cards,
        (card, callback) => {
          console.log(`Fetching ${card.name} (${card.multiverseid})...`);

          fetchMultiverseCard(card.multiverseid)
            .then(fetchedCard => {
              Object.keys(fetchedCard).forEach(key => {
                card[key] = fetchedCard[key];
              });

              callback();
            });
        },
        accept
      );
    }))
    .then(() => new Promise((accept, reject) => {
      fs.writeFile(
        path.join(__dirname, '..', 'json', setCode + '.json'),
        JSON.stringify(SET_CONTENTS, null, 2),
        'utf8',
        (err) => {
          if (err) reject(err);

          accept();
        }
      );
    }))
    .catch(err => {
      console.error(err);
    });  
};

async.each(
  setList,
  (setCode, callback) => {
    loadFetchAndSave(setCode).then(callback);
  },
  () => {
    closeNetwork();
    console.log('all done.');
  }
);
