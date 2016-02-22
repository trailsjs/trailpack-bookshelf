'use strict';
const chai = require('chai');
chai.should();
chai.use(require('chai-as-promised'));

const TrailsApp = require('trails');

before(() => {
  global.app = new TrailsApp(require('./app'));
  return global.app.start().catch(global.app.stop);
});

after(() => global.app.stop());
