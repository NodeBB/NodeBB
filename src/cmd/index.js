'use strict';

var program = require('commander');
var async = require('async');

var db = require('../database');
var plugins = require('../plugins');



program
	.command('cmd [command]')
	.description('Launch a plugin command')
	.action(function () {

      async.waterfall([
      db.init,
      function(callback) {
        plugins.init(null, null, callback)
      },

      function(callback) {

        loadPluginCommands(plugins.pluginsData)

        var arg = program.args[0];

        if(arg === 'list') {
          printCommandsList();
          callback();
        } else {
          callCommand(program, program.args[0], program.args.slice(1), callback);
        }


  })


  if (process.argv.length === 2) {
    program.help();
  }

  program.executables = false;

  program.parse(process.argv);

