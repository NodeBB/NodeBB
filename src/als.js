'use strict';

const { AsyncLocalStorage } = require('async_hooks');

const asyncLocalStorage = new AsyncLocalStorage();

module.exports = asyncLocalStorage;
