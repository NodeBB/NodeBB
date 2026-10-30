'use strict';

const nconf = require('nconf');
const proxyaddr = require('proxy-addr');
const ipaddr = require('ipaddr.js');

function getTrustFunction() {
	const trustProxy = nconf.get('trust_proxy');

	if (trustProxy === true) {
		return () => true;
	}

	if (trustProxy === false || trustProxy == null) {
		return () => false;
	}

	if (typeof trustProxy === 'number') {
		return (_addr, i) => i < trustProxy;
	}

	try {
		return proxyaddr.compile(trustProxy);
	} catch (err) {
		return () => false;
	}
}

function getSocketRemoteAddress(request) {
	return request?.socket?.remoteAddress || request?.connection?.remoteAddress || '';
}

function normalizeIp(ip) {
	if (!ip) {
		return '';
	}

	try {
		const parsed = ipaddr.parse(String(ip).trim());
		if (parsed.kind() === 'ipv6' && parsed.isIPv4MappedAddress()) {
			return parsed.toIPv4Address().toString();
		}
		return parsed.toString();
	} catch (err) {
		return '';
	}
}

exports.getClientIp = function (request) {
	if (!request) {
		return '';
	}

	const trustFn = getTrustFunction();
	const remoteAddress = getSocketRemoteAddress(request);
	const normalizedRemote = normalizeIp(remoteAddress);
	const req = {
		headers: request.headers || {},
		connection: {
			remoteAddress: remoteAddress,
		},
	};

	try {
		const resolved = proxyaddr(req, trustFn) || req.connection.remoteAddress || '';
		return normalizeIp(resolved) || normalizedRemote;
	} catch (err) {
		return normalizedRemote;
	}
};