'use strict';

const ipaddr = require('ipaddr.js');
const winston = require('winston');
const _ = require('lodash');
const validator = require('validator');

const db = require('../database');
const pubsub = require('../pubsub');
const plugins = require('../plugins');
const analytics = require('../analytics');

const Blacklist = module.exports;
Blacklist._rules = {};

Blacklist.load = async function () {
	let rules = await Blacklist.get();
	rules = Blacklist.validate(rules);

	winston.verbose(`[meta/blacklist] Loading ${rules.valid.length} blacklist rule(s)${rules.duplicateCount > 0 ? `, ignored ${rules.duplicateCount} duplicate(s)` : ''}`);
	if (rules.invalid.length) {
		winston.warn(`[meta/blacklist] ${rules.invalid.length} invalid blacklist rule(s) were ignored.`);
	}

	Blacklist._rules = {
		ipv4: rules.ipv4,
		ipv6: rules.ipv6,
		cidr: rules.cidr,
		cidr6: rules.cidr6,
	};
};

pubsub.on('blacklist:reload', Blacklist.load);

Blacklist.save = async function (rules) {
	await db.setObject('ip-blacklist-rules', { rules: rules });
	await Blacklist.load();
	pubsub.publish('blacklist:reload');
};

Blacklist.get = async function () {
	const data = await db.getObject('ip-blacklist-rules');
	return data && data.rules;
};

Blacklist.test = async function (clientIp) {
	// Some handy test addresses
	// clientIp = '2001:db8:85a3:0:0:8a2e:370:7334';	// IPv6
	// clientIp = '127.0.15.1';	// IPv4
	// clientIp = '127.0.15.1:3443'; // IPv4 with port strip port to not fail
	if (!clientIp) {
		return;
	}
	clientIp = clientIp.split(':').length === 2 ? clientIp.split(':')[0] : clientIp;

	var addr;
	try {
		addr = ipaddr.parse(clientIp);
	} catch (err) {
		winston.error(`[meta/blacklist] Error parsing client IP : ${clientIp}`);
		throw err;
	}

	if (
		!Blacklist._rules.ipv4.includes(clientIp) &&	// not explicitly specified in ipv4 list
		!Blacklist._rules.ipv6.includes(clientIp) &&	// not explicitly specified in ipv6 list
		!Blacklist._rules.cidr.some((subnet) => {
			var cidr = ipaddr.parseCIDR(subnet);
			if (addr.kind() !== cidr[0].kind()) {
				return false;
			}
			return addr.match(cidr);
		})	// not in a blacklisted IPv4 or IPv6 cidr range
	) {
		try {
			// To return test failure, pass back an error in callback
			await plugins.hooks.fire('filter:blacklist.test', { ip: clientIp });
		} catch (err) {
			analytics.increment('blacklist');
			throw err;
		}
	} else {
		var err = new Error('[[error:blacklisted-ip]]');
		err.code = 'blacklisted-ip';

		analytics.increment('blacklist');
		throw err;
	}
};

Blacklist.validate = function (rules) {
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
	rules = rules.map((rule) => {
		rule = rule.replace(inlineCommentMatch, '').trim();
		return rule.length && !rule.startsWith('#') ? rule : null;
	}).filter(Boolean);

	// Filter out duplicates
	const uniqRules = _.uniq(rules);
	duplicateCount += rules.length - uniqRules.length;
	rules = uniqRules;

	// Filter out invalid rules
	rules = rules.filter((rule) => {
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
			invalid.push(validator.escape(rule));
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

	return {
		numRules: rules.length + invalid.length,
		ipv4: ipv4,
		ipv6: ipv6,
		cidr: cidr,
		valid: rules,
		invalid: invalid,
		duplicateCount: duplicateCount,
	};
};

Blacklist.addRule = async function (rule) {
	var valid;
	const result = Blacklist.validate(rule);
	valid = result.valid;
	if (!valid.length) {
		throw new Error('[[error:invalid-rule]]');
	}
	let rules = await Blacklist.get();
	rules = `${rules}\n${valid[0]}`;
	await Blacklist.save(rules);
};
