'use strict';

var winston = require('winston');

var ratelimit = module.exports;

var allowedCalls = 100;
var timeframe = 10000;

ratelimit.isFlooding = function (socket) {
	socket.callsPerSecond = socket.callsPerSecond || 0;
	socket.elapsedTime = socket.elapsedTime || 0;
	socket.lastCallTime = socket.lastCallTime || Date.now();

	socket.callsPerSecond += 1;

	var now = Date.now();
	socket.elapsedTime += now - socket.lastCallTime;

	if (socket.callsPerSecond > allowedCalls && socket.elapsedTime < timeframe) {
		winston.warn('Flooding detected! Calls : ' + socket.callsPerSecond + ', Duration : ' + socket.elapsedTime);
		return true;
	}

	if (socket.elapsedTime >= timeframe) {
		socket.elapsedTime = 0;
		socket.callsPerSecond = 0;
	}

	socket.lastCallTime = now;
	return false;
};
