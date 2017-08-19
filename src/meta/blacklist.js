'use strict';

var ip = require('ip');
var ipRangeCheck = require('ip-range-check');
var winston = require('winston');
var async = require('async');

var db = require('../database');
var pubsub = require('../pubsub');

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
			db.set('ip-blacklist-rules', rules, next);
		},
		function (next) {
			Blacklist.load(next);
			pubsub.publish('blacklist:reload');
		},
	], callback);
};

Blacklist.get = function (callback) {
	db.get('ip-blacklist-rules', callback);
};

Blacklist.test = function (clientIp, callback) {
	if (
		Blacklist._rules.ipv4.indexOf(clientIp) === -1 &&	// not explicitly specified in ipv4 list
		Blacklist._rules.ipv6.indexOf(clientIp) === -1 &&	// not explicitly specified in ipv6 list
		!Blacklist._rules.cidr.some(function (subnet) {
			return ip.cidrSubnet(subnet).contains(clientIp);
		}) &&	// not in a blacklisted IPv4 cidr range
		!ipRangeCheck(clientIp, Blacklist._rules.cidr6)	// not in a blacklisted IPv6 cidr range
	) {
		if (typeof callback === 'function') {
			setImmediate(callback);
		} else {
			return false;
		}
	} else {
		var err = new Error('[[error:blacklisted-ip]]');
		err.code = 'blacklisted-ip';

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
	var cidr6 = [];
	var invalid = [];

	var isIPv4CidrSubnet = /^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])(\/([0-9]|[1-2][0-9]|3[0-2]))$/;
	var isIPv6CidrSubnet = /^s*((([0-9A-Fa-f]{1,4}:){7}([0-9A-Fa-f]{1,4}|:))|(([0-9A-Fa-f]{1,4}:){6}(:[0-9A-Fa-f]{1,4}|((25[0-5]|2[0-4]d|1dd|[1-9]?d)(.(25[0-5]|2[0-4]d|1dd|[1-9]?d)){3})|:))|(([0-9A-Fa-f]{1,4}:){5}(((:[0-9A-Fa-f]{1,4}){1,2})|:((25[0-5]|2[0-4]d|1dd|[1-9]?d)(.(25[0-5]|2[0-4]d|1dd|[1-9]?d)){3})|:))|(([0-9A-Fa-f]{1,4}:){4}(((:[0-9A-Fa-f]{1,4}){1,3})|((:[0-9A-Fa-f]{1,4})?:((25[0-5]|2[0-4]d|1dd|[1-9]?d)(.(25[0-5]|2[0-4]d|1dd|[1-9]?d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){3}(((:[0-9A-Fa-f]{1,4}){1,4})|((:[0-9A-Fa-f]{1,4}){0,2}:((25[0-5]|2[0-4]d|1dd|[1-9]?d)(.(25[0-5]|2[0-4]d|1dd|[1-9]?d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){2}(((:[0-9A-Fa-f]{1,4}){1,5})|((:[0-9A-Fa-f]{1,4}){0,3}:((25[0-5]|2[0-4]d|1dd|[1-9]?d)(.(25[0-5]|2[0-4]d|1dd|[1-9]?d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){1}(((:[0-9A-Fa-f]{1,4}){1,6})|((:[0-9A-Fa-f]{1,4}){0,4}:((25[0-5]|2[0-4]d|1dd|[1-9]?d)(.(25[0-5]|2[0-4]d|1dd|[1-9]?d)){3}))|:))|(:(((:[0-9A-Fa-f]{1,4}){1,7})|((:[0-9A-Fa-f]{1,4}){0,5}:((25[0-5]|2[0-4]d|1dd|[1-9]?d)(.(25[0-5]|2[0-4]d|1dd|[1-9]?d)){3}))|:)))(%.+)?s*(\/([0-9]|[1-9][0-9]|1[0-1][0-9]|12[0-8]))?$/;
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
		if (whitelist.indexOf(rule) !== -1) {
			invalid.push(rule);
			return false;
		}

		if (ip.isV4Format(rule)) {
			ipv4.push(rule);
			return true;
		}
		if (ip.isV6Format(rule)) {
			ipv6.push(rule);
			return true;
		}
		if (isIPv4CidrSubnet.test(rule)) {
			cidr.push(rule);
			return true;
		}
		if (isIPv6CidrSubnet.test(rule)) {
			cidr6.push(rule);
			return true;
		}

		invalid.push(rule);
		return false;
	});

	callback(null, {
		numRules: rules.length + invalid.length,
		ipv4: ipv4,
		ipv6: ipv6,
		cidr: cidr,
		cidr6: cidr6,
		valid: rules,
		invalid: invalid,
	});
};

module.exports = Blacklist;
