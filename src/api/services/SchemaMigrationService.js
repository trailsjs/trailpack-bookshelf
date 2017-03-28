'use strict';

const { isUndefined, values, isArray } = require('lodash');
const { each } = require('bluebird');
const Service = require('trails-service');

/**
 * @module SchemaMigrationService
 * @description Schema Migrations
 */
module.exports = class SchemaMigrationService extends Service {
  drop(txn, models) {
    return each(values(models), model => {
      const tableName = model.getTableName();
      this.app.log
        .debug(`SchemaMigrationService: performing "drop" migration for model ${tableName}`);
      return txn.schema.dropTableIfExists(tableName);
    });
  }

  create(txn, models) {
    const { hasTimestamps } = this.app.config.database.models;
    return each(values(models), model => {
      const tableName = model.getTableName();
      const config = model.constructor.config(this.app) || {};
      this.app.log
        .debug(`SchemaMigrationService: performing "create" migration for model ${tableName}`);
      return txn.schema.createTableIfNotExists(model.getTableName(), table => {
        let { idAttribute } = config;
        idAttribute = idAttribute || 'id';
        table.increments(idAttribute).primary();
        if (config.hasTimestamps || (isUndefined(config.hasTimestamps) && hasTimestamps)) {
          if (isArray(hasTimestamps)) {
            table.timestamp(hasTimestamps[0]).defaultTo(table.client.raw('CURRENT_TIMESTAMP'));
            table.timestamp(hasTimestamps[1]).defaultTo(table.client.raw('CURRENT_TIMESTAMP'));
          } else {
            table.timestamp('created_at').defaultTo(table.client.raw('CURRENT_TIMESTAMP'));
            table.timestamp('updated_at').defaultTo(table.client.raw('CURRENT_TIMESTAMP'));
          }
        }
        return model.constructor.schema(this.app, table);
      });
    });
  }


  alter(txn, model) {
    throw new Error('trailpack-bookshelf does not currently support migrate=alter');
  }
};
