'use strict';

const winston = require('winston');

const connection = module.exports;

connection.connect = function (options) {
	const Sqlite3 = require('better-sqlite3');
	const db = new Sqlite3(options.path, {});
	addFunctions(db);
	return db;
};

function addFunctions(db) {
  db.function('json_inc', { deterministic: true }, (json, name, amount) => {
    const object = (json) ? JSON.parse(json) : {};
    object[name] = object[name] ? object[name] + amount : amount;
    return JSON.stringify(object);
  });
  db.function('json_set', { deterministic: true }, (json, name, jsonValue) => {
    const object = (json) ? JSON.parse(json) : {};
    const value = (jsonValue) ? JSON.parse(jsonValue) : null;
    object[name] = value;
    return JSON.stringify(object);
  });
  db.function('json_get', { deterministic: true }, (json, name) => {
    const object = (json) ? JSON.parse(json) : {};
    return JSON.stringify(object[name] ?? null);
  });
  db.function('json_gather', { deterministic: true, varargs: true }, (json, ...names) => {
    const object = (json) ? JSON.parse(json) : {};
    const res = {};
    for (const name of names) {
      res[name] = object[name] ?? null;
    }
    return JSON.stringify(res);
  });
  db.function('json_delete', { deterministic: true, varargs: true }, (json, ...names) => {
    const object = (json) ? JSON.parse(json) : {};
    for (const name of names) {
      delete object[name];
    }
    return JSON.stringify(object);
  });
  db.function('json_has', { deterministic: true, varargs: true }, (json, ...names) => {
    const object = (json) ? JSON.parse(json) : {};
    for (const name of names) {
      if (object[name] != undefined) {
        return 1;
      }
    }
    return 0;
  }); 
  db.function('json_keys', { deterministic: true }, (json) => {
    const object = (json) ? JSON.parse(json) : {};
    const keys = Object.keys(object);
    return JSON.stringify(keys);
  });
  db.function('json_merge', { deterministic: true }, (json, jsonAddendum) => {
    const object = (json) ? JSON.parse(json) : {};
    const addendum = (jsonAddendum) ? JSON.parse(jsonAddendum) : {};
    Object.assign(object, addendum);
    return JSON.stringify(object);
  });
  db.function('json_array_append', { deterministic: true }, (json, jsonAddendum) => {
    const array = (json) ? JSON.parse(json) : [];
    const addendum = (jsonAddendum) ? JSON.parse(jsonAddendum) : [];
    for (const item of addendum) {
      array.push(item);
    }
    return JSON.stringify(array);
  });
  db.function('json_array_remove', { deterministic: true }, (json, jsonRemoval) => {
    const array = (json) ? JSON.parse(json) : [];
    const removal = (jsonRemoval) ? JSON.parse(jsonRemoval) : [];
    const list = array.filter(i => !removal.includes(i));
    return JSON.stringify(list);
  });
  db.function('json_array_slice', { deterministic: true }, (json, start, stop) => {
    const array = (json) ? JSON.parse(json) : [];
    const end = (stop > 0) ? stop : array.length + stop;
    const list = array.slice(start, end);
    return JSON.stringify(list);
  });
  db.function('json_array_length', { deterministic: true }, (json) => {
    const array = (json) ? JSON.parse(json) : [];
    return array.length;
  });
}

require('../../promisify')(connection);
