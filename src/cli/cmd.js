'use strict';

require('colors');
var path = require('path');
var winston = require('winston');
var async = require('async');
var fs = require('fs');

var db = require('../database');
var plugins = require('../plugins');

var dirname = require('./paths').baseDir;

exports.call = function (program) {

  async.waterfall([
    db.init,
    next => { plugins.init(null, null, next) },
    next => { plugins.init(null, null, next) },


  ], (err, res) => {
    console.log('DONE');
    process.exit(0);
  })

};


