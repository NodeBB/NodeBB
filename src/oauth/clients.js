'use strict';

const crypto = require('crypto');

const db = require('../database');

const clients = module.exports;

const SUPPORTED_GRANTS = ['authorization_code', 'refresh_token', 'client_credentials'];

clients.SUPPORTED_GRANTS = SUPPORTED_GRANTS;

function hashSecret(secret) {
	return crypto.createHash('sha256').update(secret).digest('hex');
}

function normalizeClient(client, raw) {
	const normalized = {
		id: client.id,
		name: client.name,
		description: client.description || '',
		redirectUris: (client.redirectUris || []).map(String),
		grants: (client.grants || []).filter(g => SUPPORTED_GRANTS.includes(g)),
		scopes: (client.scopes || []).map(String),
		public: !!client.public,
		ownerUid: client.ownerUid !== undefined ? parseInt(client.ownerUid, 10) : 0,
		disabled: !!client.disabled,
		createdAt: client.createdAt,
	};

	if (raw) {
		normalized.secretHash = raw.secretHash || null;
	}

	return normalized;
}

clients.validate = function (data) {
	if (!data || typeof data !== 'object') {
		throw new Error('[[error:invalid-data]]');
	}
	if (typeof data.name !== 'string' || !data.name.trim()) {
		throw new Error('[[error:invalid-data]]');
	}
	if (!Array.isArray(data.redirectUris) || !data.redirectUris.length) {
		throw new Error('[[error:invalid-data]]');
	}
	data.redirectUris.forEach((uri) => {
		if (typeof uri !== 'string' || !/^https?:\/\//.test(uri)) {
			throw new Error('[[error:invalid-data]]');
		}
	});
	if (data.grants !== undefined &&
		(!Array.isArray(data.grants) || !data.grants.every(g => SUPPORTED_GRANTS.includes(g)))) {
		throw new Error('[[error:invalid-data]]');
	}
	if (data.scopes !== undefined && !Array.isArray(data.scopes)) {
		throw new Error('[[error:invalid-data]]');
	}
};

clients.create = async (data) => {
	clients.validate(data);

	const id = crypto.randomBytes(16).toString('hex');
	const secret = data.public ? null : crypto.randomBytes(24).toString('hex');
	const createdAt = Date.now();

	const client = normalizeClient({
		...data,
		id,
		createdAt,
		grants: data.grants || ['authorization_code', 'refresh_token'],
		scopes: data.scopes || [],
	}, {
		secretHash: secret ? hashSecret(secret) : null,
	});

	await Promise.all([
		db.setObject(`oauth:client:${id}`, {
			id: client.id,
			name: client.name,
			description: client.description,
			redirectUris: JSON.stringify(client.redirectUris),
			grants: JSON.stringify(client.grants),
			scopes: JSON.stringify(client.scopes),
			public: client.public ? '1' : '0',
			secretHash: client.secretHash,
			ownerUid: String(client.ownerUid),
			disabled: client.disabled ? '1' : '0',
			createdAt: String(createdAt),
		}),
		db.sortedSetAdd('oauth:clients', createdAt, id),
	]);

	return { client, secret };
};

clients.get = async (id) => {
	if (typeof id !== 'string' || !id.trim()) {
		return null;
	}
	const raw = await db.getObject(`oauth:client:${id}`);
	if (!raw) {
		return null;
	}
	return normalizeClient({
		id: raw.id,
		name: raw.name,
		description: raw.description,
		redirectUris: JSON.parse(raw.redirectUris || '[]'),
		grants: JSON.parse(raw.grants || '[]'),
		scopes: JSON.parse(raw.scopes || '[]'),
		public: raw.public === '1',
		ownerUid: parseInt(raw.ownerUid, 10) || 0,
		disabled: raw.disabled === '1',
		createdAt: parseInt(raw.createdAt, 10) || 0,
	}, raw);
};

clients.list = async (start = 0, stop = -1) => {
	const ids = await db.getSortedSetRange(`oauth:clients`, start, stop);
	return (await Promise.all(ids.map(clients.get))).filter(Boolean);
};

clients.count = async () => db.sortedSetCard('oauth:clients');

clients.update = async (id, data) => {
	const existing = await clients.get(id);
	if (!existing) {
		throw new Error('[[error:no-such-client]]');
	}
	clients.validate({
		...data,
		name: data.name !== undefined ? data.name : existing.name,
		redirectUris: data.redirectUris !== undefined ? data.redirectUris : existing.redirectUris,
	});

	const updated = normalizeClient({
		name: data.name !== undefined ? data.name : existing.name,
		description: data.description !== undefined ? data.description : existing.description,
		redirectUris: data.redirectUris !== undefined ? data.redirectUris : existing.redirectUris,
		grants: data.grants !== undefined ? data.grants : existing.grants,
		scopes: data.scopes !== undefined ? data.scopes : existing.scopes,
		public: data.public !== undefined ? data.public : existing.public,
		ownerUid: data.ownerUid !== undefined ? data.ownerUid : existing.ownerUid,
		disabled: data.disabled !== undefined ? data.disabled : existing.disabled,
		id,
		createdAt: existing.createdAt,
	}, {
		secretHash: data.secret !== undefined ? hashSecret(data.secret) : existing.secretHash,
	});

	await db.setObject(`oauth:client:${id}`, {
		id: updated.id,
		name: updated.name,
		description: updated.description,
		redirectUris: JSON.stringify(updated.redirectUris),
		grants: JSON.stringify(updated.grants),
		scopes: JSON.stringify(updated.scopes),
		public: updated.public ? '1' : '0',
		secretHash: updated.secretHash,
		ownerUid: String(updated.ownerUid),
		disabled: updated.disabled ? '1' : '0',
		createdAt: String(updated.createdAt),
	});

	return updated;
};

clients.rotateSecret = async (id) => {
	const existing = await clients.get(id);
	if (!existing) {
		throw new Error('[[error:no-such-client]]');
	}
	if (existing.public) {
		throw new Error('[[error:invalid-data]]');
	}
	const secret = crypto.randomBytes(24).toString('hex');
	await db.setObject(`oauth:client:${id}`, {
		...(await db.getObject(`oauth:client:${id}`)),
		secretHash: hashSecret(secret),
	});
	return secret;
};

clients.delete = async (id) => {
	const existing = await clients.get(id);
	if (!existing) {
		return;
	}
	await Promise.all([
		db.delete(`oauth:client:${id}`),
		db.sortedSetRemove('oauth:clients', id),
	]);
};

clients.verifySecret = async (client, secret) => {
	if (!client || client.public || !secret) {
		return false;
	}
	return client.secretHash === hashSecret(secret);
};

clients.redirectUriMatches = (client, redirectUri) => {
	if (!redirectUri) {
		return false;
	}
	return client.redirectUris.includes(redirectUri);
};

clients.formatForAdmin = (client) => {
	// eslint-disable-next-line no-unused-vars
	const { secretHash, ...rest } = client;
	return {
		...rest,
		createdAtISO: rest.createdAt ? new Date(rest.createdAt).toISOString() : null,
	};
};


