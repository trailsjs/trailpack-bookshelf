# trailpack-bookshelf

[![Build status][ci-image]][ci-url]
[![Dependency Status][daviddm-image]][daviddm-url]
[![codecov.io][codecov-image]][codecov-url]

Loads Application Models (in `api/models`) into the [Bookshelf ORM](http://bookshelfjs.org/); Integrates with [trailpack-router](https://github.com/trailsjs/trailpack-router) to
generate Footprints for routes.

## Install
```sh
$ npm install --save trailpack-bookshelf
```

## Configure
### main.js
```js
// config/main.js
module.exports = {
  // ...
  packs: [
    require('trailpack-bookshelf')
  ]
}
```
### database.js
```js
// config/database.js
module.exports = {
  stores: {
    knexPostgres: {
      orm: 'bookshelf',
      client: 'pg',

      /**
       * knex connection object
       * see: http://knexjs.org/#Installation-client
       */
      connection: {
        host: 'localhost',
        user: 'admin',
        password: '1234',
        database: 'mydb'
      }
    }
  },

  /**
   * Supported Migrate Settings:
   * - none
   * - drop
   */
  migrate: 'none',
  defaultStore: 'knexPostgres'
}
```
## Usage
### Models
Models are constructed by `bookshelf.Model.extend()` with values returned by `schema()` as
the first argument and values from `config()` as the second argument.
```js
// api/models/User.js
class User extends Model {
  static schema(app, table) {
    //table definition for migrate='drop'
    if (table) {
      table.increments('id').primary();
      table.string('name').notNullable();
      return
    } else {
      // booskelf model prototypeProperties
      return {
        profile() {
          return this.hasOne('profile');
        }
      }
    }
  }
}

// api/models/Profile.js
class Profile extends Model {
  static config(app, bookshelf) {
    // booskelf model classProperties
    return {
      tableName: 'user_profile'
    };
  }
  static schema(app, table) {
    //table definition for migrate='drop'
    if (table) {
      table.string('first_name');
      table.string('last_name');
      table.integer('user_id').notNullable().references('id').inTable('user');
      return table;
    } else {
      // booskelf model prototypeProperties
      return {
        user() {
          return this.belongsTo('User');
        }
      };
    }
  }
}
```
### Query
After the trailpack is initialized you can find all your bookshelf models in the `this.app.orm`.
See [bookshelf docs](http://bookshelfjs.org/).
```js
// api/services/UserService.js
module.exports = {
  /**
   * Fetches user with profile by id.
   * @return Promise
   * @example {
   *    name: 'jdoe',
   *    proflie: {
   *      first_name: 'John',
   *      last_name: 'Doe'
   *    }
   * }
   */
  fetchUserWithProfile(id) {
    return this.orm.User.forge({ id: id }).fetch({ withRelated: 'profile' });
  }
}
```

## Contributing
We love contributions! Please check out our [Contributor's Guide](https://github.com/trailsjs/trails/blob/master/CONTRIBUTING.md) for more
information on how our projects are organized and how to get started.


## License
[MIT](https://github.com/trailsjs/trailpack-waterline/blob/master/LICENSE)

[ci-image]: https://img.shields.io/travis/trailsjs/trailpack-bookshelf/master.svg?style=flat-square
[ci-url]: https://travis-ci.org/trailsjs/trailpack-bookshelf
[daviddm-image]: http://img.shields.io/david/trailsjs/trailpack-bookshelf.svg?style=flat-square
[daviddm-url]: https://david-dm.org/trailsjs/trailpack-bookshelf
[gitter-image]: http://img.shields.io/badge/+%20GITTER-JOIN%20CHAT%20%E2%86%92-1DCE73.svg?style=flat-square
[gitter-url]: https://gitter.im/trailsjs/trails
[codecov-image]: https://codecov.io/github/zuker/trailpack-bookshelf/coverage.svg?branch=master
[codecov-url]: https://codecov.io/github/zuker/trailpack-bookshelf?branch=master
