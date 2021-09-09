'use strict';

var SocketPlugins = {};

/*
	This file is provided exclusively so that plugins can require it and add their own socket listeners.

	How? From your plugin:

		var SocketPlugins = require.main.require('./src/socket.io/plugins');
		SocketPlugins.myPlugin = {};
		SocketPlugins.myPlugin.myMethod = function(socket, data, callback) { ... };

	Be a good lad and namespace your methods.
*/

module.exports = SocketPlugins;
