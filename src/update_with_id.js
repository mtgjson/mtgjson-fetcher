import fs from 'fs';
import path from 'path';
import uuid from 'uuid/v4';
import async from 'async';

import { closeNetwork } from './network';

import loadSet from './load_set';
import { fetchGathererCardList, fetchMultiverseCard } from './card_fetcher';

const multiverseIds = [];
const loadedSets = {};
const loadPromises = {};

if (process.argv.length < 3) {
  console.error('You need to provide at least one multiverseid to fetch.');
  process.exit(-1);
}

process.argv.slice(2).forEach(param => {
  // TODO: Check for '--ignore-cache' and handle accordingly
  // TODO: Check for '--ignore-timeout' and handle accordingly
  multiverseIds.push(parseInt(param));
});

const saveSets = callback => {
  async.each(
    Object.keys(loadedSets),
    setCode => {
      fs.writeFile(
        path.join(__dirname, '..', 'json', setCode + '.json'),
        JSON.stringify(loadedSets[setCode].data, null, 2),
        'utf8',
        (err) => {
          if (err) throw err;
          callback();
        }
      );
    }
  );
};

const loadSetCache = setCode => {
  if (loadedSets[setCode]) return Promise.resolve(loadedSets[setCode]);
  if (loadPromises[setCode]) return loadPromises[setCode];

  return new Promise((accept, reject) => {
    console.log(`Loading set ${setCode} from disk.`);

    loadPromises[setCode] = loadSet(setCode)
      .then(setData => {
        loadedSets[setCode] = setData;
        loadPromises[setCode] = null;

        accept(setData);
      })
      .catch(reject);
  });
};

async.eachSeries(
  multiverseIds,
  (multiverseid, callback) => {
    let fetchedCard = null;

    fetchMultiverseCard(multiverseid)
      .then(cardInfo => {
        if (!cardInfo) {
          throw new Error(`Cannot find card with multiverseid ${multiverseid}.`);
        }
        fetchedCard = cardInfo;

        return loadSetCache(cardInfo.set);
      })
      .then(setInfo => {
        loadedSets[fetchedCard.set] = setInfo;

        if (!setInfo.data) {
          throw new Error(`Set ${fetchedCard.set} was not initialized.`);
        }

        const setCard = setInfo.data.cards.find(card => card.multiverseid === fetchedCard.multiverseid);
        if (!setCard) {
          throw new Error(`SET ${fetchedCard.set} has no card with multiverseid ${multiverseid}. Card data: ${JSON.stringify(fetchedCard)}`);
        }

        // Replace with new data
        Object.keys(fetchedCard).forEach(key => {
          setCard[key] = fetchedCard[key];
        });

        // Properly order card object
        Object.keys(setCard).sort().forEach(key => {
          const value = setCard[key];
          delete setCard[key];
          setCard[key] = value;
        });

        console.log(`card ${setCard.name} updated.`);
      })
      .then(callback)
      .catch(err => {
        console.error(err);
        callback();
      });
  },
  () => {
    saveSets(() => {
      console.log(`sets ${Object.keys(loadedSets).join(', ')} saved.`);
    });
    closeNetwork();
  }
);

