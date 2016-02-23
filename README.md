# trailpack-bookshelf

[![Gitter][gitter-image]][gitter-url]
[![Build status][ci-image]][ci-url]
[![Dependency Status][daviddm-image]][daviddm-url]

Loads Application Models (in `api/models`) into the Bookshelf ORM; Integrates with [trailpack-router](https://github.com/trailsjs/trailpack-router) to
generate Footprints for routes.

## Usage

### Configure

```js
// config/main.js
module.exports = {
  // ...
  packs: [
    require('trailpack-waterline')
  ]
}
```

### Query

```js
// api/services/BirthdayService.js
module.exports = {
  /**
   * Finds people with the given birthday.
   * @return Promise
   * @example {
   *    name: 'Ludwig Beethoven',
   *    birthday: Sun Dec 16 1770 00:00:00 GMT-0500 (EST),
   *    favoriteColors: [
   *      { name: 'yellow', hex: 'ffff00' },
   *      { name: 'black', hex: '000000' }
   *     ]
   * }
   */
  findPeopleByName(name) {
    return this.orm.Person.forge({ name }).fetch({ withRelated: 'favoriteColors' });
  }
}
```

## Contributing
We love contributions! Please check out our [Contributor's Guide](https://github.com/trailsjs/trails/blob/master/CONTRIBUTING.md) for more
information on how our projects are organized and how to get started.


## License
[MIT](https://github.com/trailsjs/trailpack-waterline/blob/master/LICENSE)

[ci-image]: https://img.shields.io/travis/zuker/trailpack-bookshelf/master.svg?style=flat-square
[ci-url]: https://travis-ci.org/zuker/trailpack-bookshelf
[daviddm-image]: http://img.shields.io/david/zuker/trailpack-bookshelf.svg?style=flat-square
[daviddm-url]: https://david-dm.org/zuker/trailpack-bookshelf
[gitter-image]: http://img.shields.io/badge/+%20GITTER-JOIN%20CHAT%20%E2%86%92-1DCE73.svg?style=flat-square
[gitter-url]: https://gitter.im/trailsjs/trails
