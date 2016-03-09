'use strict';
const TrailsApp = require('trails');

const configPath = './config';

module.exports = function app(config) {
  if (!config) {
    delete require.cache[require.resolve(configPath)];
    config = require(configPath);
  }
  const app = new TrailsApp(config);
  return app
    .start()
    .then(() => app, err => {
      app.stop();
      return Promise.reject(err);
    });
};
