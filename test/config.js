'use strict';
const { defaultsDeep } = require('lodash');
const { FailsafeConfig } = require('smokesignals');
const Model = require('trails-model');

module.exports = defaultsDeep({
  pkg: {
    name: 'trailpack-bookshelf-test'
  },
  api: {
    models: {
      User: class User extends Model {
        static config() {
          return {};
        }
        static schema (app, table) {
          if (table) {
            table.increments('id').primary();
            table.string('name').notNullable().unique();
            return table;
          } else {
            return {
              roles() {
                return this.belongsToMany('Role').through('UserRole');
              },
              profile() {
                return this.hasOne('Profile');
              },
              posts() {
                return this.hasMany('Post');
              }
            };
          }
        }
      },
      UserRole: class UserRole extends Model {
        static config() {
          return {
            tableName: 'user_role'
          };
        }
        static schema(app, table) {
          if (table) {
            table.increments('id').primary();
            table.integer('user_id').notNullable().references('id').inTable('user');
            table.integer('role_id').notNullable().references('id').inTable('role');
            return table;
          } else {
            return {
              user() {
                return this.belongsTo('User');
              },
              role() {
                return this.belongsTo('Role');
              }
            };
          }
        }
      },
      Role: class Role extends Model {
        static config() {
          return {};
        }
        static schema(app, table) {
          if (table) {
            table.increments('id').primary();
            table.string('name').notNullable().unique();
            return table;
          } else {
            return {
              users() {
                return this.belongsToMany('User').through('UserRole');
              }
            };
          }
        }
      },
      Profile: class Profile extends Model {
        static config() {
          return {};
        }
        static schema(app, table) {
          if (table) {
            table.increments('id').primary();
            table.string('first_name');
            table.string('last_name');
            table.integer('user_id').notNullable().references('id').inTable('user');
            return table;
          } else {
            return {
              user() {
                return this.belongsTo('User');
              }
            };
          }
        }
      },
      Post: class Post extends Model {
        static config() {
          return {};
        }
        static schema(app, table) {
          if (table) {
            table.increments('id').primary();
            table.string('title').notNullable();
            table.string('text').notNullable();
            table.integer('user_id').notNullable().references('id').inTable('user');
            return table;
          } else {
            return {
              user() {
                return this.belongsTo('User');
              }
            };
          }
        }
      }
    }
  },
  config: {
    main: {
      packs: [
        require('trailpack-core'),
        require('../src')
      ]
    },
    database: {
      stores: {
        teststore: {
          orm: 'bookshelf',
          client: 'sqlite3',
          connection: { filename: require('path').resolve(__dirname, '.app.db') },
          useNullAsDefault: true
        }
      },
      models: {
        defaultStore: 'teststore',
        migrate: 'drop'
      }
    }
  }
}, FailsafeConfig);
