

'use strict';
var winston = require('winston');

var ratelimit = {};

var allowedCallsPerSecond = 20;


ratelimit.isFlooding = function(socket) {
	socket.callsPerSecond = socket.callsPerSecond || 0;
	socket.elapsedTime = socket.elapsedTime || 0;
	socket.lastCallTime = socket.lastCallTime || Date.now();

	++socket.callsPerSecond;

	var now = Date.now();
	socket.elapsedTime += now - socket.lastCallTime;

	if (socket.callsPerSecond > allowedCallsPerSecond && socket.elapsedTime < 1000) {
		winston.warn('Flooding detected! Calls : ' + socket.callsPerSecond + ', Duration : ' + socket.elapsedTime);
		return true;
	}

	if (socket.elapsedTime >= 1000) {
		socket.elapsedTime = 0;
		socket.callsPerSecond = 0;
	}

	socket.lastCallTime = now;
	return false;
};

module.exports = ratelimit;
