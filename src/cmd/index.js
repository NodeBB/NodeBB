'use strict';

var program = require('commander');
var async = require('async');


require('./bootstrap');


var db = require('../database');
var cmdInit = require('./init');


async.waterfall([

  // Init database
  db.init,

  // Load installed plugins command
  cmdInit.loadPluginCommands,


], function(err, data) {
  console.log('DONE', data);
  process.exit();
});


// program
// 	.command('cmd [command]')
// 	.description('Launch a plugin command')
// 	.action(function () { })


// if (process.argv.length === 2) {
//   program.help();
// }

// program.executables = false;

// program.parse(process.argv);
