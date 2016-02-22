'use strict';
const {
  defaultsDeep,
  get,
  isEmpty,
  isNumber,
  isString,
  find,
  defaults,
  omit,
  isArray
  } = require('lodash');
const Service = require('trails-service');
const model = Symbol('model');
const association = Symbol('association');
const limit = Symbol('limit');
const forge = Symbol('forge');
const related = Symbol('forge');

const BELONGS_TO = 'belongsTo';

const findModelByName = (modelName, models) =>
  find(models, model => model.getModelName() === modelName);

const omitModelAutoValues = (model, values = {}) => {
  let omitAttrs = [model.idAttribute];
  let { hasTimestamps } = model;
  if (hasTimestamps) {
    if (!isArray(hasTimestamps)) {
      hasTimestamps = ['created_at', 'updated_at'];
    }
    omitAttrs = omitAttrs.concat(hasTimestamps);
  }
  return omit(values, omitAttrs);
};

const defaultCriteria = (model, criteria = {}) => {
  if (isEmpty(criteria)) {
    criteria = { whereNotNull: model.idAttribute };
  }
  return criteria;
};

const idCriteria = (model, criteria = {}) => {
  if (isString(criteria) || isNumber(criteria)) {
    criteria = { [model.idAttribute]: criteria };
  }
  return criteria;
};

/**
 * Trails Service that maps abstract ORM methods to their respective Bookshelf
 * methods. This service can be thought of as an "adapter" between trails and
 * Bookshelf. All methods return native ES6 Promises.
 */
module.exports = class FootprintService extends Service {
  [limit](criteria, options) {
    const { defaultLimit } = defaultsDeep(
      {},
      options,
      get(this.app.config, 'footprints.models.options')
    );
    return defaults(criteria || {}, { limit: defaultLimit });
  }
  [model](modelName) {
    let Model = findModelByName(modelName, this.app.models);
    if (Model) {
      const { name } = Model.constructor;
      Model = this.app.orm[name] || this.app.packs.bookshelf.models[name];
    }
    if (Model && Model.bookshelf) {
      return Promise.resolve(Model);
    } else {
      //TODO find Model in another FootprintServices
      return Promise.reject(new Error('Model not found'));
    }
  }
  [association](parentModelName, childAttributeName, parentId) {
    return this[model](parentModelName, childAttributeName)
      .then(ParentModel => {
        const parentModel = new ParentModel({ [ParentModel.forge().idAttribute]: parentId });
        if (parentModel[childAttributeName]) {
          return parentModel[childAttributeName]();
        } else {
          return Promise.reject(new Error('Association not defined'));
        }
      });
  }
  [forge](modelName, values = {}) {
    return this[model](modelName)
      .then(Model => {
        return Model.forge(idCriteria(Model.forge(), values));
      })
  }
  [related](parentModelName, relationName, parentId, withParent = false) {
    return this[forge](parentModelName, parentId)
      .then(parentModel => {
        let relation = parentModel.related(relationName);
        if (relation) {
          if (withParent) {
            return [relation, parentModel];
          } else {
            return relation;
          }
        } else {
          return Promise.reject(new Error('Association not defined'));
        }
      });
  }
  /**
   * Create a model, or models. Multiple models will be created if "values" is
   * an array.
   *
   * @param modelName The name of the model to create
   * @param values The model's values
   * @param options
   * @return Promise
   */
  create(modelName, values, options) {
    return this[forge](modelName).then(model =>
      model.set(omitModelAutoValues(model, values)).save(options));
  }

  /**
   * Find all models that satisfy the given criteria. If a primary key is given,
   * the return value will be a single Object instead of an Array.
   *
   * @param modelName The name of the model
   * @param criteria The criteria that filter the model resultset
   * @param options
   * @return Promise
   */
  find(modelName, criteria, options) {
    if (isNumber(criteria) || isString(criteria)) {
      return this[forge](modelName, criteria).then(model => model.fetch(options));
    } else {
      return this[forge](modelName)
        .then(model => model
          .query(this[limit](criteria, options))
          .fetchAll(options));
    }
  }

  /**
   * Update an existing model, or models, matched by the given by criteria, with
   * the given values. If the criteria given is the primary key, then return
   * exactly the object that is updated; otherwise, return an array of objects.
   *
   * @param modelName The name of the model
   * @param criteria The criteria that determine which models are to be updated
   * @param values
   * @param options
   * @return Promise
   */
  update(modelName, criteria, values, options) {
    if (isNumber(criteria) || isString(criteria)) {
      return this[forge](modelName, criteria)
        .then(model => model.set(omitModelAutoValues(model, values)).save(options));
    } else {
      return this[forge](modelName)
        .then(model => {
          criteria = this[limit](defaultCriteria(model, criteria));
          return model
            .query(criteria, options)
            .save(
              omitModelAutoValues(model, values),
              Object.assign(options || {}, { method: 'update', patch: true, require: false })
            )
            .then(model => model
              .query({ where: values })
              .fetchAll());
        });
    }
  }

  /**
   * Destroy (delete) the model, or models, that match the given criteria.
   *
   * @param modelName The name of the model
   * @param criteria The criteria that determine which models are to be updated
   * @param options
   * @return Promise
   */
  destroy(modelName, criteria, options) {
    if (isNumber(criteria) || isString(criteria)) {
      return this[forge](modelName, criteria).then(model => model.destroy(options));
    } else {
      return this[forge](modelName)
        .then(model => model
          .query(defaultCriteria(model, criteria))
          .destroy(Object.assign(options || {}, { require: false })));
    }
  }

  /**
   * Create a model, and associate it with its parent model.
   *
   * @param parentModelName The name of the model's parent
   * @param childAttributeName The name of the model to create
   * @param parentId The id (required) of the parent model
   * @param values The model's values
   * @param options
   * @return Promise
   */
  createAssociation (parentModelName, parentId, childAttributeName, values, options) {
    return this[related](parentModelName, childAttributeName, parentId)
      .then(relation => {
        if (relation.create) {
          return relation.create(omitModelAutoValues(relation.model.forge(), values), options);
        } else if (relation.save) {
          return relation.set(omitModelAutoValues(relation, values)).save(options);
        }
      });
  }

  /**
   * Find all models that satisfy the given criteria, and which is associated
   * with the given Parent Model.
   *
   * @param parentModelName The name of the model's parent
   * @param childAttributeName The name of the model to create
   * @param parentId The id (required) of the parent model
   * @param criteria The search criteria
   * @param options
   * @return Promise
   */
  findAssociation(parentModelName, parentId, childAttributeName, criteria, options) {
    criteria = this[limit](criteria, options);
    return this[related](parentModelName, childAttributeName, parentId, true)
      .then(([relation, parentModel]) => {
        const { type } = relation.relatedData;
        if (type === BELONGS_TO) {
          return parentModel
            .fetch({ withRelated: [childAttributeName] })
            .then(res => res.related(childAttributeName));
        } else {
          return relation
            .query(idCriteria(relation.model || relation, criteria))
            .fetch(options);
        }
      });
  }

  /**
   * Update models by criteria, and which is associated with the given
   * Parent Model.
   *
   * @param parentModelName The name of the model's parent
   * @param parentId The id (required) of the parent model
   * @param childAttributeName The name of the model to create
   * @param criteria The search criteria
   * @param update
   * @param options
   * @return Promise
   */
  updateAssociation(parentModelName, parentId, childAttributeName, criteria, update, options) {
    options = Object.assign(options || {}, { method: 'update', patch: true });
    return this[related](parentModelName, childAttributeName, parentId, true)
      .then(([relation, parentModel]) => {
        const { type } = relation.relatedData;
        if (type === BELONGS_TO) {
          return parentModel
            .fetch({ withRelated: [childAttributeName] })
            .then(res => {
              let model = res.related(childAttributeName);
              return model.save(omitModelAutoValues(model, update), options);
            });
        } else {
          if (relation.save) {
            return relation
              .query(defaultCriteria(relation, criteria))
              .save(omitModelAutoValues(relation, update), options);
          } else {
            const model = relation.model.forge();
            return model
              .query(defaultCriteria(model, idCriteria(model, criteria)))
              .save(
                omitModelAutoValues(model, update),
                Object.assign(options, { require: false })
              );
          }
        }
      });
  }

  /**
   * Destroy models by criteria, and which is associated with the
   * given Parent Model.
   *
   * @param parentModelName The name of the model's parent
   * @param parentId The id (required) of the parent model
   * @param childAttributeName The name of the model to create
   * @param criteria The search criteria
   * @param options
   * @return Promise
   */
  destroyAssociation(parentModelName, parentId, childAttributeName, criteria, options) {
    return this[related](parentModelName, childAttributeName, parentId)
      .then(relation => {
        const { relatedData, model } = relation;
        const { throughTarget, parentTableName, parentIdAttribute, foreignKey } = relatedData;
        if (throughTarget) {
          if (isEmpty(criteria)) {
            const through = throughTarget.forge({
              [foreignKey || `${parentTableName}_${parentIdAttribute}`]: parentId
            });
            return through
              .where(through.idAttribute, '>', 0)
              .destroy();
          } else {
            return Promise.reject(new Error('Criteria is not supported for'));
          }
        } else {
          if (model) {
            return model
              .query(defaultCriteria(model, idCriteria(model, criteria)))
              .destroy(options);
          } else {
            return relation
              .query(defaultCriteria(relation, criteria))
              .destroy(options);
          }
        }
      });
  }
};
