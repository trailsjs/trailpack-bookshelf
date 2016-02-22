'use strict';
const { isEmpty } = require('lodash');

describe('api.services.FootprintService', () => {
  let FootprintService;
  before(() => FootprintService = global.app.services.FootprintService);
  describe('#create', () => {
    const create = { name: 'createtest' };
    it('should insert a record', () => FootprintService
      .create('role', create)
      .then(res => {
        const role = res.toJSON();
        role.should.include(create);
        return app.orm.Role.forge(role).fetch();
      })
      .then(res => res.toJSON())
      .should
      .eventually
      .include(create));
  });

  describe('#find', () => {
    let role;
    before(() => FootprintService
      .create('role', { name: 'findtest' })
      .then(res => role = res.toJSON()));
    it('should find a single record', () => FootprintService
      .find('role', role.id)
      .then(res => res.toJSON())
      .should
      .eventually
      .include(role));

    it('should find a set of records', () => FootprintService
      .find('role', { where: { name: role.name } })
      .then(role => role.toJSON())
      .should
      .eventually
      .have.lengthOf(1)
      .and.deep.include.members([role]));
  });

  describe('#update', () => {
    let role;
    const update = { name: 'updated' };
    before(() => FootprintService
      .create('role', { name: 'updatetest' })
      .then(res => role = res.toJSON()));
    it('should update a set of records', () => FootprintService
      .update(
        'role',
        { where: { name: role.name } },
        update
      )
      .then(res => {
        JSON.parse(JSON.stringify(res))
          .should
          .have.lengthOf(1)
          .and.deep.include.members([Object.assign(role, update)]);
        return app.orm.Role.forge().query({ where: update }).fetchAll();
      })
      .then(res => res.toJSON())
      .should
      .eventually
      .have.lengthOf(1)
      .and.deep.include.members([Object.assign(role, update)]));
  });

  describe('#destroy', () => {
    let role;
    before(() => FootprintService
      .create('role', { name: 'destroytest' })
      .then(res => role = res.toJSON()));
    it('should delete a set of records', () => FootprintService
      .destroy('role', { where: { name: role.name } })
      .then(res => app.orm.Role.forge({ name: role.name }).fetch())
      .then(res => isEmpty(res))
      .should
      .eventually
      .be.true);
  });

  describe('associations', () => {
    let user;
    let user_id;
    before(() =>  FootprintService
      .create('user', { name: 'createassociationtest' })
      .then(res => {
        user = res.toJSON();
        ({id: user_id} = user);
      }));

    describe('#createAssociation', () => {
      describe('belongsToMany', () => {
        describe('through', () => {
          const create = {
            name: 'createassociatedrole'
          };
          it('should insert an associated record', () => FootprintService
            .createAssociation(
              'user',
              user.id,
              'roles',
              create
            )
            .then(role => Promise.all([
              role.toJSON(),
              app.orm.UserRole.forge({ user_id: user.id }).fetch()
            ]))
            .then(([role, userRole]) => {
              role
                .should
                .include(create);
              userRole
                .toJSON()
                .should
                .have.property('role_id', role.id);
            }));
        });
      });
      describe('hasMany', () => {
        const create = {
          title: 'post',
          text: 'post text'
        };
        it('should insert an associated record', () => {
          it('should insert an associated record', () => FootprintService
            .createAssociation(
              'user',
              user.id,
              'posts',
              create
            )
            .then(post => post.toJSON())
            .should
            .eventually
            .include(Object.assign(create, { user_id })));
        });
      });
      describe('hasOne', () => {
        const create = {
          first_name: 'first',
          last_name: 'last'
        };
        it('should insert an associated record', () => {
          it('should insert an associated record', () => FootprintService
            .createAssociation(
              'user',
              user.id,
              'profile',
              create
            )
            .then(profile =>profile.toJSON())
            .should
            .eventually
            .include(create)
            .then.should
            .eventually
            .include(Object.assign(create, { user_id })));
        });
      });
    });

    describe('#findAssociation', () => {
      describe('belongsToMany', () => {
        describe('through', () => {
          let role;
          const create = { name: 'findassociatedrole' };
          before(() => FootprintService.create('role', create)
            .then(res => {
              role = res.toJSON();
              return app.orm.UserRole.forge({ role_id: role.id, user_id: user.id }).save();
            }));
          it('should find an associated records', () => FootprintService
            .findAssociation('user', user.id, 'roles', { where: create })
            .then(roles => {
              roles = roles.toJSON();
              roles.should.have.lengthOf(1);
              return roles.pop();
            })
            .should
            .eventually
            .include(role));
        });
      });
      describe('belongsTo', () => {
        let post;
        before(() => app.orm.Post
          .forge({ title: 'title', text: 'text', user_id: user.id })
          .save()
          .then(res => post = res.toJSON()));
        it('should find an associated record', () => FootprintService
          .findAssociation('post', post.id, 'user')
          .then(res => res.toJSON())
          .should
          .eventually
          .include(user));
      });
      describe('hasMany', () => {
        let post;
        const text = 'text1';
        const title = 'title1';
        before(() => app.orm.Post
          .forge({ title, text, user_id })
          .save()
          .then(res => post = res.toJSON()));
        it('should find an associated records', () => FootprintService
          .findAssociation('user', user.id, 'posts', { where: { title, text } })
          .then(res => {
            res = res.toJSON();
            res.should.have.lengthOf(1);
            return res.pop();
          })
          .should
          .eventually
          .include(post));
      });

      describe('hasOne', () => {
        let profile;
        let user;
        before(() => app.orm.User
          .forge({ name: 'test1' })
          .save()
          .then(res => {
            user = res.toJSON();
            return app.orm.Profile
              .forge({ first_name: 'test', last_name: 'test', user_id: user.id })
              .save();
          })
          .then(res => profile = res.toJSON()));
        it('should find an associated record', () => FootprintService
          .findAssociation('user', user.id, 'profile')
          .then(res => res.toJSON())
          .should
          .eventually
          .include(profile));
      });
    });

    describe('#updateAssociation', () => {
      describe('belongsToMany', () => {
        describe('through', () => {
          let role;
          const update = { name: 'updateassociatedrole' };
          const create = { name: 'updateassociationtest' };
          before(() => FootprintService.create('role', create)
            .then(res => {
              role = res.toJSON();
              return app.orm.UserRole.forge({ role_id: role.id, user_id: user.id }).save();
            }));
          it('should update an associated records', () => FootprintService
            .updateAssociation('user', user.id, 'roles', { where: create }, update)
            .then(res => {
              res = JSON.parse(JSON.stringify(res));
              res
                .should
                .include(update);
              return app.orm.Role.forge().query({ where: update }).fetchAll();
            })
            .then(res => {
              res = res.toJSON();
              res.should.have.lengthOf(1);
              return res.pop();
            })
            .should
            .eventually
            .include(Object.assign(role, update)));
        });
      });
      describe('belongsTo', () => {
        let post;
        const update = { name: 'updatedassociationname' };
        const text = 'text2';
        const title = 'title2';
        before(() => FootprintService.create('post', { text, title, user_id })
          .then(res => post = res.toJSON()));
        it('should update an associated record', () => FootprintService
          .updateAssociation('post', post.id, 'user', { where: { text, title } }, update)
          .then(res => {
            res = JSON.parse(JSON.stringify(res));
            res
              .should
              .include(update);
            return app.orm.User.forge().query({ where: update }).fetchAll();
          })
          .then(res => {
            res = res.toJSON();
            res.should.have.lengthOf(1);
            return res.pop();
          })
          .should
          .eventually
          .include(Object.assign(user, update)));
      });
      describe('hasMany', () => {
        let post;
        const update = { title: 'title4' };
        const text = 'text3';
        const title = 'title3';
        before(() => FootprintService.create('post', { text, title, user_id })
          .then(res => post = res.toJSON()));
        it('should update an associated records', () => FootprintService
          .updateAssociation('user', user.id, 'posts', { where: { text, title } }, update)
          .then(res => {
            res = JSON.parse(JSON.stringify(res));
            res
              .should
              .include(update);
            return app.orm.Post.forge().query({ where: update }).fetchAll();
          })
          .then(res => {
            res = res.toJSON();
            res.should.have.lengthOf(1);
            return res.pop();
          })
          .should
          .eventually
          .include(Object.assign(post, update)));
      });
      describe('hasOne', () => {
        let profile;
        let user;
        const update = { first_name: 'updatedassociationfirst' };
        const first_name = 'first';
        const last_name = 'last';
        before(() => app.orm.User
          .forge({ name: 'testupdatehasone' })
          .save()
          .then(res => {
            user = res.toJSON();
            return app.orm.Profile.forge({ first_name, last_name, user_id: user_id }).save();
          })
          .then(res => profile = res.toJSON()));
        it('should update an associated record', () => FootprintService
          .updateAssociation(
            'user',
            user.id,
            'profile',
            { where: { first_name, last_name } },
            update
          )
          .then(res => {
            res = JSON.parse(JSON.stringify(res));
            res
              .should
              .include(update);
            return app.orm.Profile.forge().query({ where: update }).fetchAll();
          })
          .then(res => {
            res = res.toJSON();
            res.should.have.lengthOf(1);
            return res.pop();
          })
          .should
          .eventually
          .include(Object.assign(profile, update)));
      });
    });

    describe('#destroyAssociation', () => {
      describe('belongsToMany', () => {
        describe('through', () => {
          let role;
          const create = { name: 'destroyassociationtest' };
          before(() => FootprintService.create('role', create)
            .then(res => {
              role = res.toJSON();
              return app.orm.UserRole.forge({ role_id: role.id, user_id: user.id }).save();
            }));
          it('should destroy an associated record pivots', () => FootprintService
            .destroyAssociation('user', user.id, 'roles')
            .then(res => Promise.all([
              app.orm.Role.forge().fetchAll(),
              app.orm.UserRole.forge({ user_id }).fetchAll()
            ]))
            .then(([roles, userRoles]) => {
              roles = roles.toJSON();
              userRoles = userRoles.toJSON();
              roles.should.not.be.empty;
              isEmpty(userRoles).should.be.true;
            }));
        });
      });

      describe('hasMany', () => {
        const text = 'text4';
        const title = 'title4';
        before(() => FootprintService.create('post', { text, title, user_id }));
        it('should destroy an associated records', () => FootprintService
          .destroyAssociation('user', user.id, 'posts', { where: { text, title } })
          .then(res => app.orm.Post.forge({ user_id }).query({ where: { text, title } }).fetchAll())
          .then(res => isEmpty(res.toJSON()))
          .should
          .eventually
          .be.true);
      });

      describe('hasOne', () => {
        let user;
        const create = { first_name: 'first', last_name: 'last' };
        before(() => app.orm.User.forge({ name: 'testdestroyhasone' }).save()
          .then(res => {
            user = res.toJSON();
            return app.orm.Profile.forge(Object.assign(create, { user_id: user.id })).save();
          }));
        it('should destroy associated record', () => FootprintService
          .destroyAssociation('user', user.id, 'profile')
          .then(() => app.orm.Profile.forge({ user_id: user.id }).fetch())
          .then(res => isEmpty(res))
          .should
          .eventually.be.true);
      });
    });
  });
});
