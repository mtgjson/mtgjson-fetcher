import fs from 'fs';
import path from 'path';
import async from 'async';

const setConfigPath = path.join(__dirname, '..', 'sets');
const jsonPath = path.join(__dirname, '..', 'json');

const loadSet = setCode => new Promise((accept, rejectCallback) => {
  const setConfig = path.join(setConfigPath, `${setCode}.json`);
  const setData = path.join(jsonPath, `${setCode}.json`);

  let rejected = false;

  const SET = {
    'SET': null,
    'SET_CORRECTIONS': null,
    'data': null,
  };

  const reject = reason => {
    rejected = true;
    rejectCallback(reason);
  };

  try {
    async.series([
      callback => {
        if (rejected) {
          callback();
          return;
        }

        fs.readFile(setConfig, 'utf8', (err, data) => {
          if (err) {
            reject(err);
            return;
          }
          
          const parsedData = JSON.parse(data);

          SET.SET = parsedData.SET;
          SET.SET_CORRECTIONS = parsedData.SET_CORRECTIONS;
          callback();
        });        
      },
      callback => {
        if (rejected) {
          callback();
          return;
        }

        fs.readFile(setData, 'utf8', (err, data) => {
          if (err) {
            // Do not reject.
            //console.log('File %s not found', setData);
            callback();
            return;
          }

          const parsedData = JSON.parse(data);
          SET.data = parsedData;

          callback();
        });
      },
      callback => {
        accept(SET);
        callback();
      },
    ]);
  } catch (err) {
    reject(err);
  }
});

export default loadSet;
