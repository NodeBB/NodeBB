"use strict";

var	widgets = require('../widgets'),

	SocketWidgets = {};

SocketWidgets.render = function(socket, data, callback) {
	widgets.render(socket.uid, data, callback);
};

module.exports = SocketWidgets;
