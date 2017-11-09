import fs from 'fs';
import path from 'path';
import redis from 'redis';
import nodeFetch from 'node-fetch';

const configPath = path.join(__dirname, '..', 'config.json');

const defaultOptions = {
  redis: {
    active: true,
    host: '127.0.0.1',
    port: 6379,
    timeout: 7 * 24 * 60 * 60,  // in seconds. Defaults to one week.
    ignoreTimeout: false, // consider everything on redis cache to be valid, even if beyond the defined timeout
    ignoreCache: false, // write to redis, but ignore everything that's already there
  },
};

let redisClient = null;
let configData = {};

const redisSet = (key, value, timeout = -1) => {
  if (!redisClient) throw new Error('cannot set key with no redis connection.');

  if (timeout === -1) {
    timeout = configData.redis.timeout;
  }

  const expirationDate = Date.now + timeout * 1000;

  redisClient.set(
    key,
    JSON.stringify({
      contents: value,
      expirationDate,
    })
  );
};

const redisGet = (key) => {
  if (configData.redis && configData.redis.ignoreCache) return Promise.resolve(null);

  return new Promise((accept, reject) => {
    if (!redisClient) throw new Error('cannot get key with no redis connection.');

    redisClient.get(
      key,
      (err, replyRaw) => {
        if (err) {
          reject(err);
          return;
        }

        if (!replyRaw) {
          accept(null);
          return;
        }

        let reply = null;
        try {
          reply = JSON.parse(replyRaw);
        } catch (e) {
          console.log('Invalid data for key %s', key);
          accept(null);
          return;
        }

        // Check if expired
        const isExpired = configData.redis.ignoreTimeout
          ? false
          : Date.now > reply.expirationDate;

        // console.log('%s loaded from cache.', key);
        accept(isExpired ? null : reply.contents);
      }
    );
  });
};

// Inits network
let networkLoaded = false;
let initNetworkPromise = null;
export const initNetwork = (options = {}) => {
  if (networkLoaded) return Promise.resolve(configData);
  if (initNetworkPromise) return initNetworkPromise;

  initNetworkPromise = new Promise((accept, reject) => {
    fs.readFile(configPath, 'utf8', (err, data) => {
      if (err) {
        console.log('cannot read config file. continuing with no options.')
        configData = {
          ...defaultOptions,
          ...options,
        };

        accept(configData);
        return;
      }

      const parsedData = JSON.parse(data);
      // TODO: This will not work with nested keys.
      configData = {
        ...defaultOptions,
        ...configData,
        ...options,
      };

      accept(configData);
    });
  })
  .then(config => {
    if (config.redis && config.redis.active) {
      redisClient = redis.createClient(
        config.redis.port || 6379,
        config.redis.host || '127.0.0.1'
      );
    }

    initNetworkPromise = null;
    networkLoaded = true;
    return config;
  })
  .catch(err => {
    console.error('error initializing network. Check your config file.');
    throw(err);
  });

  return initNetworkPromise;
};

export const closeNetwork = () => {
  if (redisClient) {
    redisClient.quit();
    redisClient = null;
  }

  console.log('network closed.');
};

// Fetch data from network. Store into redis cache if relevant.
const fetchFromNetwork = (url) => new Promise((accept, reject) => {
  nodeFetch(url)
    .then(res => res.text())
    .then(body => {
      if (configData.redis && configData.redis.active) {
        redisSet(url, body);
      }

      return body;
    })
    .then(accept)
    .catch(reject);
});

export const fetch = (url) => new Promise((accept, reject) => {
  initNetwork()
    .then(() => {
      if (configData.redis && configData.redis.active) {
        // Using redis
        return redisGet(url)
          .then(value => {
            if (!value) return fetchFromNetwork(url);
            return value;
          })
          .catch(reject);
      } else {
        // Regular stuff
        return fetchFromNetwork(url);
      }
    })
    .then(accept)
    .catch(reject);
});
