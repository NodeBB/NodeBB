"use strict";

var rewards = require('../../rewards'),
	rewards = {};

rewards.save = function(socket, data, callback) {
	console.log(data);
	callback(new Error('derp'));
	//callback(err ? err.message : null);
};


module.exports = rewards;