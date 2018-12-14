'use strict';

var ipaddr = require('ipaddr.js');
var winston = require('winston');
var async = require('async');
var _ = require('lodash');

var db = require('../database');
var pubsub = require('../pubsub');
var plugins = require('../plugins');
var analytics = require('../analytics');

var Blacklist = module.exports;
Blacklist._rules = [];

Blacklist.load = function (callback) {
	callback = callback || function () {};

	async.waterfall([
		Blacklist.get,
		Blacklist.validate,
		function (rules, next) {
			winston.verbose('[meta/blacklist] Loading ' + rules.valid.length + ' blacklist rule(s)' + (rules.duplicateCount > 0 ? ', ignored ' + rules.duplicateCount + ' duplicate(s)' : ''));
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
	// clientIp = '127.0.15.1:3443'; // IPv4 with port strip port to not fail
	if (!clientIp) {
		return setImmediate(callback);
	}
	clientIp = clientIp.split(':').length === 2 ? clientIp.split(':')[0] : clientIp;

	var addr;
	try {
		addr = ipaddr.parse(clientIp);
	} catch (err) {
		winston.error('[meta/blacklist] Error parsing client IP : ' + clientIp);
		return callback(err);
	}

	if (
		!Blacklist._rules.ipv4.includes(clientIp) &&	// not explicitly specified in ipv4 list
		!Blacklist._rules.ipv6.includes(clientIp) &&	// not explicitly specified in ipv6 list
		!Blacklist._rules.cidr.some(function (subnet) {
			var cidr = ipaddr.parseCIDR(subnet);
			if (addr.kind() !== cidr[0].kind()) {
				return false;
			}
			return addr.match(cidr);
		})	// not in a blacklisted IPv4 or IPv6 cidr range
	) {
		plugins.fireHook('filter:blacklist.test', {	// To return test failure, pass back an error in callback
			ip: clientIp,
		}, function (err) {
			if (err) {
				analytics.increment('blacklist');
			}

			callback(err);
		});
	} else {
		var err = new Error('[[error:blacklisted-ip]]');
		err.code = 'blacklisted-ip';

		analytics.increment('blacklist');

		setImmediate(callback, err);
	}
};

Blacklist.validate = function (rules, callback) {
	rules = (rules || '').split('\n');
	var ipv4 = [];
	var ipv6 = [];
	var cidr = [];
	var invalid = [];
	var duplicateCount = 0;

	var inlineCommentMatch = /#.*$/;
	var whitelist = ['127.0.0.1', '::1', '::ffff:0:127.0.0.1'];

	// Filter out blank lines and lines starting with the hash character (comments)
	// Also trim inputs and remove inline comments
	rules = rules.map(function (rule) {
		rule = rule.replace(inlineCommentMatch, '').trim();
		return rule.length && !rule.startsWith('#') ? rule : null;
	}).filter(Boolean);

	// Filter out duplicates
	const uniqRules = _.uniq(rules);
	duplicateCount += rules.length - uniqRules.length;
	rules = uniqRules;

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

		if (!addr || whitelist.includes(rule)) {
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
		duplicateCount: duplicateCount,
	});
};

Blacklist.addRule = function (rule, callback) {
	var valid;
	async.waterfall([
		function (next) {
			Blacklist.validate(rule, next);
		},
		function (result, next) {
			valid = result.valid;
			if (!valid.length) {
				return next(new Error('[[error:invalid-rule]]'));
			}
			Blacklist.get(next);
		},
		function (rules, next) {
			rules = rules + '\n' + valid[0];
			Blacklist.save(rules, next);
		},
	], callback);
};
