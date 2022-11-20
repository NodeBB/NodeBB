'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ipaddr = require('ipaddr.js');
const winston_1 = __importDefault(require("winston"));
const _ = require('lodash');
const validator = require('validator');
const database_1 = __importDefault(require("../database"));
const pubsub = require('../pubsub').default;
const plugins = require('../plugins');
const analytics = require('../analytics');
const Blacklist = {};
Blacklist._rules = {};
Blacklist.load = function () {
    return __awaiter(this, void 0, void 0, function* () {
        let rules = yield Blacklist.get();
        rules = Blacklist.validate(rules);
        winston_1.default.verbose(`[meta/blacklist] Loading ${rules.valid.length} blacklist rule(s)${rules.duplicateCount > 0 ? `, ignored ${rules.duplicateCount} duplicate(s)` : ''}`);
        if (rules.invalid.length) {
            winston_1.default.warn(`[meta/blacklist] ${rules.invalid.length} invalid blacklist rule(s) were ignored.`);
        }
        Blacklist._rules = {
            ipv4: rules.ipv4,
            ipv6: rules.ipv6,
            cidr: rules.cidr,
            cidr6: rules.cidr6,
        };
    });
};
pubsub.on('blacklist:reload', Blacklist.load);
Blacklist.save = function (rules) {
    return __awaiter(this, void 0, void 0, function* () {
        yield database_1.default.setObject('ip-blacklist-rules', { rules: rules });
        yield Blacklist.load();
        pubsub.publish('blacklist:reload');
    });
};
Blacklist.get = function () {
    return __awaiter(this, void 0, void 0, function* () {
        const data = yield database_1.default.getObject('ip-blacklist-rules');
        return data && data.rules;
    });
};
Blacklist.test = function (clientIp) {
    return __awaiter(this, void 0, void 0, function* () {
        // Some handy test addresses
        // clientIp = '2001:db8:85a3:0:0:8a2e:370:7334'; // IPv6
        // clientIp = '127.0.15.1'; // IPv4
        // clientIp = '127.0.15.1:3443'; // IPv4 with port strip port to not fail
        if (!clientIp) {
            return;
        }
        clientIp = clientIp.split(':').length === 2 ? clientIp.split(':')[0] : clientIp;
        let addr;
        try {
            addr = ipaddr.parse(clientIp);
        }
        catch (err) {
            winston_1.default.error(`[meta/blacklist] Error parsing client IP : ${clientIp}`);
            throw err;
        }
        if (!Blacklist._rules.ipv4.includes(clientIp) && // not explicitly specified in ipv4 list
            !Blacklist._rules.ipv6.includes(clientIp) && // not explicitly specified in ipv6 list
            !Blacklist._rules.cidr.some((subnet) => {
                const cidr = ipaddr.parseCIDR(subnet);
                if (addr.kind() !== cidr[0].kind()) {
                    return false;
                }
                return addr.match(cidr);
            }) // not in a blacklisted IPv4 or IPv6 cidr range
        ) {
            try {
                // To return test failure, pass back an error in callback
                yield plugins.hooks.fire('filter:blacklist.test', { ip: clientIp });
            }
            catch (err) {
                analytics.increment('blacklist');
                throw err;
            }
        }
        else {
            const err = new Error('[[error:blacklisted-ip]]');
            err.code = 'blacklisted-ip';
            analytics.increment('blacklist');
            throw err;
        }
    });
};
Blacklist.validate = function (rules) {
    rules = (rules || '').split('\n');
    const ipv4 = [];
    const ipv6 = [];
    const cidr = [];
    const invalid = [];
    let duplicateCount = 0;
    const inlineCommentMatch = /#.*$/;
    const whitelist = ['127.0.0.1', '::1', '::ffff:0:127.0.0.1'];
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
        let addr;
        let isRange = false;
        try {
            addr = ipaddr.parse(rule);
        }
        catch (e) {
            // Do nothing
        }
        try {
            addr = ipaddr.parseCIDR(rule);
            isRange = true;
        }
        catch (e) {
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
        }
        else {
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
Blacklist.addRule = function (rule) {
    return __awaiter(this, void 0, void 0, function* () {
        const { valid } = Blacklist.validate(rule);
        if (!valid.length) {
            throw new Error('[[error:invalid-rule]]');
        }
        let rules = yield Blacklist.get();
        rules = `${rules}\n${valid[0]}`;
        yield Blacklist.save(rules);
    });
};
