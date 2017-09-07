'use strict';

var ipaddr = require('ipaddr.js');
var winston = require('winston');
var async = require('async');

var db = require('../database');
var pubsub = require('../pubsub');
var plugins = require('../plugins');
var analytics = require('../analytics');

var Blacklist = {
	_rules: [],
};

Blacklist.load = function (callback) {
	callback = callback || function () {};

	async.waterfall([
		Blacklist.get,
		Blacklist.validate,
		function (rules, next) {
			winston.verbose('[meta/blacklist] Loading ' + rules.valid.length + ' blacklist rules');
			if (rules.invalid.length) {
				winston.warn('[meta/blacklist] ' + rules.invalid.length + ' invalid blacklist rule(s) were ignored.');
			}

			Blacklist._rules = {
				ipv4: rules.ipv4,
				ipv6: rules.ipv6,
				cidr: rules.cidr,
				cidr6: rules.cidr6,
			};
			next();
		},
	], callback);
};

pubsub.on('blacklist:reload', Blacklist.load);

Blacklist.save = function (rules, callback) {
	async.waterfall([
		function (next) {
			db.setObject('ip-blacklist-rules', { rules: rules }, next);
		},
		function (next) {
			Blacklist.load(next);
			pubsub.publish('blacklist:reload');
		},
	], callback);
};

Blacklist.get = function (callback) {
	async.waterfall([
		function (next) {
			db.getObject('ip-blacklist-rules', next);
		},
		function (data, next) {
			next(null, data && data.rules);
		},
	], callback);
};

Blacklist.test = function (clientIp, callback) {
	// Some handy test addresses
	// clientIp = '2001:db8:85a3:0:0:8a2e:370:7334';	// IPv6
	// clientIp = '127.0.15.1';	// IPv4
	var addr = ipaddr.parse(clientIp);

	if (
		Blacklist._rules.ipv4.indexOf(clientIp) === -1 &&	// not explicitly specified in ipv4 list
		Blacklist._rules.ipv6.indexOf(clientIp) === -1 &&	// not explicitly specified in ipv6 list
		!Blacklist._rules.cidr.some(function (subnet) {
			return addr.match(ipaddr.parseCIDR(subnet));
			// return ip.cidrSubnet(subnet).contains(clientIp);
		})	// not in a blacklisted IPv4 or IPv6 cidr range
	) {
		plugins.fireHook('filter:blacklist.test', {	// To return test failure, pass back an error in callback
			ip: clientIp,
		}, function (err) {
			if (err) {
				analytics.increment('blacklist');
			}

			if (typeof callback === 'function') {
				callback(err);
			} else {
				return !!err;
			}
		});
	} else {
		var err = new Error('[[error:blacklisted-ip]]');
		err.code = 'blacklisted-ip';

		analytics.increment('blacklist');

		if (typeof callback === 'function') {
			setImmediate(callback, err);
		} else {
			return true;
		}
	}
};

Blacklist.validate = function (rules, callback) {
	rules = (rules || '').split('\n');
	var ipv4 = [];
	var ipv6 = [];
	var cidr = [];
	var invalid = [];

	var inlineCommentMatch = /#.*$/;
	var whitelist = ['127.0.0.1', '::1', '::ffff:0:127.0.0.1'];

	// Filter out blank lines and lines starting with the hash character (comments)
	// Also trim inputs and remove inline comments
	rules = rules.map(function (rule) {
		rule = rule.replace(inlineCommentMatch, '').trim();
		return rule.length && !rule.startsWith('#') ? rule : null;
	}).filter(Boolean);

	// Filter out invalid rules
	rules = rules.filter(function (rule) {
		var addr;
		var isRange = false;
		try {
			addr = ipaddr.parse(rule);
		} catch (e) {
			// Do nothing
		}

		try {
			addr = ipaddr.parseCIDR(rule);
			isRange = true;
		} catch (e) {
			// Do nothing
		}

		if (!addr || whitelist.indexOf(rule) !== -1) {
			invalid.push(rule);
			return false;
		}

		if (!isRange) {
			if (addr.kind() === 'ipv4' && ipaddr.IPv4.isValid(rule)) {
				ipv4.push(rule);
				return true;
			}
			if (addr.kind() === 'ipv6' && ipaddr.IPv6.isValid(rule)) {
				ipv6.push(rule);
				return true;
			}
		} else {
			cidr.push(rule);
			return true;
		}
		return false;
	});

	callback(null, {
		numRules: rules.length + invalid.length,
		ipv4: ipv4,
		ipv6: ipv6,
		cidr: cidr,
		valid: rules,
		invalid: invalid,
	});
};

module.exports = Blacklist;
