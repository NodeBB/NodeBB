'use strict';

var program = require('commander');
var async = require('async');
var path = require('path');

require('./bootstrap');

var db = require('../database');
var cmdInit = require('./init');

// remove the cmd segment from argvs
process.argv.splice(2, 1);

async.waterfall([

  // Init database
  db.init,

  // Load installed plugins command
  cmdInit.loadPluginCommands,

], function(err, commands) {

  commands.forEach(cmd => {

    var regCommand = program.command(cmd.name);

    // register options
    cmd.options.forEach(function(opt) {
      regCommand.option(opt.flags, opt.description || null, null, opt.default || null);
    })

    regCommand
      .description(cmd.description)
      .action(function () {

        // resolve plugin command method
        var method = require(cmd.scriptFile)[cmd.method]

        method(program, function() {
          process.exit();
        })

      })

  });

  program.parse(process.argv);
});



