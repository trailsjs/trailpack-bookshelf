'use strict';
const Pack = require('../src');
const TrailsApp = require('trails');
const start = require('./app');
const DatastoreTrailpack = require('trailpack-datastore');
const Model = require('trails-model');
const {each} = require('bluebird');

const configPath = './config';

describe('Trailpack', () => {
  let pack;
  let app;
  let config;
  beforeEach(() => {
    delete require.cache[require.resolve(configPath)];
    config = require(configPath);
    app = new TrailsApp(config);
    pack = new Pack(app);
  });
  describe('#validate()', () => {
    it('should succeed with valid config', () => pack.validate());
    it('should fail if store.client is not supported', () => {
      const { client } = app.config.database.stores.teststore;
      app.config.database.stores.teststore.client = 'not_supported';
      return pack
        .validate()
        .then(() => Promise.reject(new Error()))
        .catch(() => {
          app.config.database.stores.teststore.client = client;
        });
    });
    it('should fail if store.client is not installed', () => {
      const { client } = app.config.database.stores.teststore;
      app.config.database.stores.teststore.client = 'mysql';
      return pack
        .validate()
        .then(() => Promise.reject(new Error()))
        .catch(() => app.config.database.stores.teststore.client = client);
    });
    it('should validate stores only with orm = "bookshelf"', () => {
      app.config.database.stores.other_store = {
        test: 'test'
      };
      return pack
        .validate()
        .then(() => Promise.reject(new Error()))
        .catch(() => {
          delete app.config.database.stores.other_store;
        });
    });
    it('should succeed after #unload()', () => pack
      .validate()
      .then(() => pack.unload())
      .then(() => pack.validate())
    );
    it('should succeed after #configure() and #unload()', () => {
      pack.configure();
      return pack
        .unload()
        .then(() => pack.validate());
    });
  });
  describe('#configure()', () => {
    it('should configure pack without an error', () => pack.configure());
    it('should set app.config.database.orm', () => {
      pack.configure();
      app.config.database.orm.should.be.equal('bookshelf');
    });
    it('should not overwrite existing app.config.database.orm', () => {
      app.config.database.orm = 'other_orm';
      pack.configure();
      app.config.database.orm.should.not.be.equal('bookshelf');
    });
    it('should add "bookshelf" to existing app.config.database.orm', () => {
      app.config.database.orm = 'other_orm';
      pack.configure();
      app.config.database.orm.should.be.eql(['other_orm', 'bookshelf']);
      app.config.database.orm = ['other_orm', 'yet_another_orm'];
      pack.configure();
      app.config.database.orm.should.be.eql(['other_orm', 'yet_another_orm', 'bookshelf']);
    });
  });
  describe('#initialize()', () => {
    const startApp = (config) => start(config).then(_app => app = _app);
    afterEach(() => app.stop());
    it('should extend app.orm with bookshelf models', () => startApp()
      .then(() => Object.keys(config.api.models).forEach(modelName => {
        const { [modelName]: model } = app.orm;
        model.should.be.ok;
        model.forge().should.be.ok;
      })));
    it('should not overwrite app.orm', () => {
      const { packs } = config.config.main.packs;
      config.config.main.packs.push(class extends DatastoreTrailpack {
        constructor(app) {
          super(
            app,
            {
              config: {
                trailpack: {}
              },
              pkg: { name: 'trailpack-fake_orm' },
              api: {}
            }
          );
        }
        initialize() {
          super.initialize();
          this.app.orm.FakeModel = true;
          return Promise.resolve();
        }
      });
      return startApp(config)
        .then(() => {
          app.orm.FakeModel.should.be.ok;
          Object.assign(config.config.main, { packs });
        });
    });
    it('should not load models from non-bookshelf stores', () => {
      const { models } = config.api;
      config.api.models.FakeModel = class FakeModel extends Model {
        static config() {
          return {
            store: 'test_store'
          };
        }
        static schema() {
          return {};
        }
      };
      return startApp(config)
        .then(() => {
          app.orm.should.not.have.property('FakeModel');
          Object.assign(config.api, { models });
        });
    });
    it('should create tables if config.models.migrate = "drop"', () => startApp()
      .then(() => each(Object.keys(config.api.models), modelName =>
        app.orm[modelName].forge().fetchAll())));
    it('should do nothing with DB with if config.models.migrate = "none" is set', () => startApp()
      .then(() => each(Object.keys(config.api.models), modelName => {
        const { [modelName]: model } = app.orm;
        return model.bookshelf.knex.schema.dropTableIfExists(model.forge().tableName);
      }))
      .then(() => app.stop())
      .then(() => {
        config.config.database.models.migrate = 'none';
        return startApp(config);
      })
      .then(() => each(Object.keys(config.api.models), modelName => {
        const { [modelName]: model } = app.orm;
        model.bookshelf.knex.schema.hasTable(model.forge().tableName).should.eventually.be.false;
      }))
      .then(() => config.config.database.models.migrate = 'drop'));
    it('should succeed after #unload(), #configure(), #initialize(), #unload', () => startApp(config)
      .then(() => app.packs.bookshelf.unload())
      .then(() => {
        app.packs.bookshelf.configure();
        return app.packs.bookshelf.initialize();
      }));
  });
  describe('#unload()', () => {
    const startApp = (config) => start(config).then(_app => app = _app);
    beforeEach(() => startApp());
    it('should destroy all knex connections', () => app
      .stop()
      .then(() => app.packs.bookshelf.stores.teststore.bookshelf.knex.client)
      .should.eventually
      .have.property('pool').not.exist
    );
  });
});
