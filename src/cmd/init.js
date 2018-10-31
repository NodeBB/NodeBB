'use strict';

var path = require('path');
var async = require('async');
var plugins = require('../plugins');

module.exports = {

  loadPluginCommands: function(next) {

    async.waterfall([

      // load NodeBB plugins
      function(callback) {
        plugins.init(null, null, callback)
      },

      // parse plugins commands
      function(callback) {

        var commands = [];
        var pluginList = Object.keys(plugins.pluginsData);

        pluginList.forEach(function(pluginName) {

          var pluginData = plugins.pluginsData[pluginName];
          var pluginCommands = pluginData.commands || [];

          if(pluginCommands.length === 0) {
            return
          }

          pluginCommands.forEach(function(cmdData) {

            var cmdName = pluginName.replace('nodebb-plugin-', '') + ':' + cmdData.cmd;
            var scriptFile = path.resolve(pluginData.path, cmdData.library);

            commands.push({
              name: cmdName,
              description: cmdData.description,
              options: cmdData.options,
              scriptFile: scriptFile,
              method: cmdData.method
            });
          });

        });

        next(null, commands);
      }

    ])




  },

  registerCommands: function() {

  },

}
