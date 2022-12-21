'use strict';

const winston = require('winston');

const ratelimit = module.exports;

const allowedCalls = 100;
const timeframe = 10000;

ratelimit.isFlooding = function (socket) {
	socket.callsPerSecond = socket.callsPerSecond || 0;
	socket.elapsedTime = socket.elapsedTime || 0;
	socket.lastCallTime = socket.lastCallTime || Date.now();

	socket.callsPerSecond += 1;

	const now = Date.now();
	socket.elapsedTime += now - socket.lastCallTime;

	if (socket.callsPerSecond > allowedCalls && socket.elapsedTime < timeframe) {
		winston.warn(`Flooding detected! Calls : ${socket.callsPerSecond}, Duration : ${socket.elapsedTime}`);
		return true;
	}

	if (socket.elapsedTime >= timeframe) {
		socket.elapsedTime = 0;
		socket.callsPerSecond = 0;
	}

	socket.lastCallTime = now;
	return false;
};
