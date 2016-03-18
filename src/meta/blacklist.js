'use strict';

var ip = require('ip');
var winston = require('winston');
var async = require('async');
var db = require('../database');

var Blacklist = {
		_rules: []
	};

Blacklist.load = function(callback) {
	async.waterfall([
		async.apply(db.get, 'ip-blacklist-rules'),
		async.apply(Blacklist.validate)
	], function(err, rules) {
		if (err) {
			return callback(err);
		}

		winston.verbose('[meta/blacklist] Loading ' + rules.valid.length + ' blacklist rules');
		if (rules.invalid.length) {
			winston.warn('[meta/blacklist] ' + rules.invalid.length + ' invalid blacklist rule(s) were ignored.');
		}

		Blacklist._rules = {
			ipv4: rules.ipv4,
			ipv6: rules.ipv6,
			cidr: rules.cidr
		};

		callback();
	});
};

Blacklist.save = function(rules, callback) {
	db.set('ip-blacklist-rules', rules, function(err) {
		if (err) {
			return callback(err);
		}
		Blacklist.load(callback);
	});
};

Blacklist.get = function(callback) {
	db.get('ip-blacklist-rules', callback);
};

Blacklist.test = function(clientIp, callback) {
	if (
		Blacklist._rules.ipv4.indexOf(clientIp) === -1	// not explicitly specified in ipv4 list
		&& Blacklist._rules.ipv6.indexOf(clientIp) === -1	// not explicitly specified in ipv6 list
		&& !Blacklist._rules.cidr.some(function(subnet) {
			return ip.cidrSubnet(subnet).contains(clientIp);
		})	// not in a blacklisted cidr range
	) {
		if (typeof callback === 'function') {
			callback();
		} else {
			return false;
		}
	} else {
		var err = new Error('[[error:blacklisted-ip]]');
		err.code = 'blacklisted-ip';

		if (typeof callback === 'function') {
			callback(err);
		} else {
			return true;
		}
	}
};

Blacklist.validate = function(rules, callback) {
	rules = (rules || '').split('\n');
	var ipv4 = [];
	var ipv6 = [];
	var cidr = [];
	var invalid = [];

	var isCidrSubnet = /^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])(\/([0-9]|[1-2][0-9]|3[0-2]))$/,
		inlineCommentMatch = /#.*$/,
		whitelist = ['127.0.0.1', '::1', '::ffff:0:127.0.0.1'];

	// Filter out blank lines and lines starting with the hash character (comments)
	// Also trim inputs and remove inline comments
	rules = rules.map(function(rule) {
		rule = rule.replace(inlineCommentMatch, '').trim();
		return rule.length && !rule.startsWith('#') ? rule : null;
	}).filter(Boolean);

	// Filter out invalid rules
	rules = rules.filter(function(rule) {
		if (whitelist.indexOf(rule) !== -1) {
			invalid.push(rule);
			return false;
		}

		if (ip.isV4Format(rule)) {
			ipv4.push(rule);
			return true;
		} else if (ip.isV6Format(rule)) {
			ipv6.push(rule);
			return true;
		} else if (isCidrSubnet.test(rule)) {
			cidr.push(rule);
			return true;
		} else {
			invalid.push(rule);
			return false;
		}

		return true;
	});

	callback(null, {
		numRules: rules.length + invalid.length,
		ipv4: ipv4,
		ipv6: ipv6,
		cidr: cidr,
		valid: rules,
		invalid: invalid
	});
};

module.exports = Blacklist;