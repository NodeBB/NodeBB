'use strict';

const SocketPlugins  = {} as any;

/*
	This file is provided exclusively so that plugins can require it and add their own socket listeners.

	How? From your plugin:

		const SocketPlugins = require.main.require('./src/socket.io/plugins');
		SocketPlugins.myPlugin  = {} as any;
		SocketPlugins.myPlugin.myMethod = function(socket, data, callback) { ... };

	Be a good lad and namespace your methods.
*/

export default  SocketPlugins;
