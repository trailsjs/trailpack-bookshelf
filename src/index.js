'use strict';

const { merge, reduce, isArray, isEmpty, each, find, mapValues, values, uniq, pickBy } = require('lodash');
const DatastoreTrailpack = require('trailpack-datastore');
const { object, string, any, boolean, validate } = require('joi');
const { resolve, reject, fromCallback, each: promiseEach } = require('bluebird');
const knex = require('knex');
const bookshelf = require('bookshelf');

const config = require('./config');
const pkg = require('../package');
const api = require('./api');

const databaseConfigSchema = object().keys({
  models: object().keys({
    defaultStore: string().required(),
    migrate: any().allow(['none', 'drop', 'create']),
    hasTimestamps: boolean()
  }),
  stores: object()
});

const failsafeConfig =  {
  footprints: {
    models: { }
  }
};

const findBsStores = stores => reduce(stores, (res, store, storeName) =>
  Object.assign(res, store.orm === 'bookshelf' ? { [storeName]: store } : {}), {});

/**
 * Waterline Trailpack
 *
 * Allow the trails application to interface with the Waterline ORM. Similar to
 * the Sails "orm" hook, but cleaner and less crazy.
 *
 * @see {@link https://github.com/balderdashy/sails/blob/master/lib/hooks/orm/build-orm.js}
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
    return super
      .validate()
      .then(() => find(findBsStores(database.stores), store => {
        try {
          require(store.client);
        } catch(e) {
          return reject(e);
        }
      }))
      .then(() => fromCallback(cb => validate(database, databaseConfigSchema, cb)));
  }

  /**
   * Merge configuration into models.
   */
  configure() {
    super.configure();
    const { orm } = this.app.config.database;
    const bookshelfArr = ['bookshelf'];
    this.app.config.database.orm = orm ? (isArray(orm) ? orm.concat(bookshelfArr) : [orm, 'bookshelf']) : bookshelfArr;
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
    return promiseEach(values(this.stores), store => store.bookshelf.knex.destroy());
  }
};
