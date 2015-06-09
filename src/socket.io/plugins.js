'use strict';

var	SocketPlugins = {};

/*
	This file is provided exclusively so that plugins can require it and add their own socket listeners.

	How? From your plugin:

		var SocketPlugins = require.main.require('./src/socket.io/modules');
		SocketPlugins.myPlugin = {};
		SocketPlugins.myPlugin.myMethod = function() { ... };

	Be a good lad and namespace your methods.
*/

module.exports = SocketPlugins;
