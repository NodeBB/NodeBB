'use strict';

require('colors');
var path = require('path');
var winston = require('winston');
var async = require('async');

var db = require('../database');
var plugins = require('../plugins');
var dirname = require('./paths').baseDir;

var commands = [];

function loadPluginCommands(plugins, callback) {

  Object.keys(plugins).forEach(function(pluginName) {
    var pluginCommands = (plugins[pluginName].commands || []);
    pluginCommands.forEach(function(cmdData) {
      commands.push({
        name:  pluginName.replace('nodebb-plugin-', '') + ':' + cmdData.cmd,
        description: cmdData.description || cmdData.desc,
        options: cmdData.options || cmdData.args
      });
    });

  });
}

function printCommandsList() {
  commands.forEach(function(cmd) {
    console.log(cmd.name)
  })
  process.exit();
}

function callCommand(program, commandName, args, callback) {

  program.command('cmd prova')
    .option('-p, --plugins', 'Check installed plugins for updates', false)
    .action(function (scripts, options) {
      console.log('suca');
    })

  console.log(commandName)

  process.exit();

  // pluginCommand = function() {

  // }

  // async.waterfall([
  //   pluginCommand,
  // ], function(err, res) {
  //   process.exit();
  // });
}


module.exports = {


  call: function (program) {

    t0 = Date.now();

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
      },

    ], function(err, res)  {
      process.exit(0);
    })

  }

}




