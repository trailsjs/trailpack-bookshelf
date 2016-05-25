'use strict';

const {
  merge,
  reduce,
  isArray,
  isEmpty,
  each,
  find,
  mapValues,
  values,
  uniq,
  pickBy,
  pick
  } = require('lodash');
const DatastoreTrailpack = require('trailpack-datastore');
const { object, string, any, boolean, validate } = require('joi');
const { fromCallback, each: promiseEach, resolve, reject } = require('bluebird');
const knex = require('knex');
const bookshelf = require('bookshelf');

const config = require('./config');
const pkg = require('../package');
const api = require('./api');

const BOOKSHELF = 'bookshelf';

const databaseConfigSchema = object().keys({
  models: object().keys({
    defaultStore: string().required(),
    migrate: any().allow(['none', 'drop', 'alter']),
    hasTimestamps: boolean()
  }),
  stores: object(),
  orm: any()
});

const storeSchema = object().keys({
  client: any().allow(['sqlite3', 'pg', 'mysql']),
  connection: any(),
  orm: any().allow('bookshelf')
}).unknown();

const failsafeConfig =  {
  footprints: {
    models: {}
  }
};

const findBsStores = stores => reduce(stores, (res, store, storeName) =>
  Object.assign(
    res,
    store.orm === BOOKSHELF ?
    { [storeName]: pick(store, 'client', 'connection', 'useNullAsDefault') } :
    {}
  ), {});

/**
 * Bookshelf Trailpack
 *
 * Allow the trails application to interface with the Bookshelf ORM.
 *
 * @see {@link http://bookshelfjs.org}
 */
module.exports = class BookshelfTrailpack extends DatastoreTrailpack {
  constructor(app) {
    super(app, { config, pkg, api });
  }

  /**
   * Validate the database config, and api.model definitions
   */
  validate() {
    const { database } = this.app.config;
    const bsStores = findBsStores(database.stores);
    return resolve(super.validate())
      .then(() => fromCallback(cb => validate(database, databaseConfigSchema, cb)))
      .then(() => promiseEach(
        values(bsStores),
        store => fromCallback(cb => validate(store, storeSchema, cb)))
      )
      .then(() => {
        const invalidStore = find(bsStores, store => {
          try {
            require.resolve(store.client);
          } catch (e) {
            return true;
          }
        });
        if (invalidStore) {
          return reject(new Error(`Invalid store client ${invalidStore.client}`));
        }
      });
  }

  /**
   * Merge configuration into models.
   */
  configure() {
    this.app.config.database.orm = 'bookshelf';
    merge(this.app.config, failsafeConfig);
  }

  /**
   * Initialize Bookshelf. This will compile the schema and connect to the
   * database.
   */
  initialize() {
    if (!this.app.orm) {
      this.app.orm = {};
    }
    const { config, services } = this.app;
    const { SchemaMigrationService } = services;
    const { stores, models: modelsConfig } = config.database;
    const bsStores = findBsStores(stores);
    return resolve(super.initialize())
      .then(() => {
        this.stores = mapValues(
          bsStores,
          (store, storeName) => {
            delete require.cache[require.resolve(store.client)];
            const bs = bookshelf(knex(store));
            let { plugins } = store;
            if (isArray(plugins)) {
              plugins.push('registry');
            } else if (isEmpty(plugins)) {
              plugins = ['registry'];
            } else {
              plugins = [plugins, 'registry'];
            }
            bs.plugin(uniq(plugins));
            return Object.assign(
              store,
              {
                bookshelf: bs,
                models: pickBy(this.app.models, { store: storeName })
              }
            );
          }
        );
        return values(this.stores);
      })
      .map(store => {
        const { bookshelf, models } = store;
        const { migrate } = modelsConfig;
        return bookshelf
          .knex
          .transaction(txn => {
            if (migrate === 'create') {
              return SchemaMigrationService.create(txn, models);
            }
            if (migrate === 'drop') {
              return SchemaMigrationService
                .drop(txn, models)
                .then(() => SchemaMigrationService.create(txn, models));
            } else if (migrate === 'alter') {
              return SchemaMigrationService.alter(txn, models);
            } else {
              return resolve();
            }
          })
          .then(() => store);
      })
      .then(stores => each(
        stores,
        ({models}) => each(
          values(models),
          model => {
            const { bookshelf } = this.stores[model.store];
            const { constructor } = model;
            const { name } = constructor;
            let { config, schema } = constructor;
            config = config() || {};
            schema = schema() || {};
            this.app.orm[name] = bookshelf
              .model(
                name,
                Object.assign(
                  schema,
                  {
                    tableName: model.getTableName()
                  }
                ),
                Object.assign(
                  config,
                  {
                    bookshelf
                  }
                )
              );
          }
        )
      ));
  }

  /**
   * Close all database connections
   */
  unload() {
    return promiseEach(values(this.stores), ({bookshelf}) => {
      /*eslint no-underscore-dangle: 0*/
      delete bookshelf._models;
      return bookshelf.knex.destroy();
    });
  }
};
