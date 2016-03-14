'use strict';

var ip = require('ip'),
	winston = require('winston'),
	async = require('async');

var	meta = module.parent.exports;

var Blacklist = {
		_rules: []
	};

Blacklist.load = function(callback) {
	async.waterfall([
		async.apply(meta.settings.getOne, 'blacklist', 'rules'),
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
	var rules = (rules || '').split('\n'),
		ipv4 = [],
		ipv6 = [],
		cidr = [],
		invalid = [];

	var isCidrSubnet = /^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])(\/([0-9]|[1-2][0-9]|3[0-2]))$/;

	// Filter out blank lines and lines starting with the hash character (comments)
	rules = rules.map(function(rule) {
		rule = rule.trim();
		return rule.length && !rule.startsWith('#') ? rule : null;
	}).filter(Boolean);

	// Filter out invalid rules
	rules = rules.filter(function(rule) {
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