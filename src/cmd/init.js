'use strict';

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
          var pluginCommands = (plugins.pluginsData[pluginName].commands || []);

          pluginCommands.forEach(function(cmdData) {
            commands.push({
              name:  pluginName.replace('nodebb-plugin-', '') + ':' + cmdData.cmd,
              description: cmdData.description || cmdData.desc,
              options: cmdData.options || cmdData.args
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
