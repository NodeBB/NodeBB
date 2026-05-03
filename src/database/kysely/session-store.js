'use strict';

const { Store } = require('express-session');

const DEFAULT_PRUNE_INTERVAL_SECONDS = 60 * 15; // 15 minutes
const DEFAULT_TTL_SECONDS = 14 * 24 * 60 * 60; // 14 days

class KyselySessionStore extends Store {
	constructor(options) {
		super(options);
		this.db = options.db;
		this.dialect = options.dialect;
		this.helpers = options.helpers;

		// `ttl` and `pruneSessionInterval` arrive from `kysely.js:createSessionStore`
		// in seconds. NodeBB's `meta.getSessionTTLSeconds()` defaults to 14 days.
		this.ttlMs = (options.ttl || DEFAULT_TTL_SECONDS) * 1000;

		// Skip the touch-on-every-request when sessions don't need rolling
		// expiration. Halves session-store traffic for read-heavy paths.
		this.disableTouch = !!options.disableTouch;

		// `pruneSessionInterval`: false to disable; otherwise interval in seconds.
		// The randomised delay (50–150% of the configured interval) prevents
		// multi-instance deployments from synchronising prune storms.
		this.pruneIntervalMs = options.pruneSessionInterval === false ?
			false :
			(options.pruneSessionInterval || DEFAULT_PRUNE_INTERVAL_SECONDS) * 1000;

		this._closed = false;
		this._pruneTimer = null;
		this._initPruneTimer();
	}

	_resolveTtlMs(session) {
		if (session && session.cookie) {
			if (session.cookie.expires) {
				const remaining = new Date(session.cookie.expires).valueOf() - Date.now();
				if (remaining > 0) return remaining;
			}
			if (session.cookie.maxAge) return session.cookie.maxAge;
		}
		return this.ttlMs;
	}

	_initPruneTimer() {
		if (!this.pruneIntervalMs || this._closed || this._pruneTimer) return;
		const delay = Math.ceil((this.pruneIntervalMs / 2) + (this.pruneIntervalMs * Math.random()));
		this._pruneTimer = setTimeout(() => {
			this._pruneTimer = null;
			this.cleanupExpired().catch(() => {}).finally(() => this._initPruneTimer());
		}, delay);
		if (typeof this._pruneTimer.unref === 'function') this._pruneTimer.unref();
	}

	_clearPruneTimer() {
		if (this._pruneTimer) {
			clearTimeout(this._pruneTimer);
			this._pruneTimer = null;
		}
	}

	async close() {
		this._closed = true;
		this._clearPruneTimer();
	}

	async ensureSessionsTable() {
		const { dialect } = this;
		try {
			await this.db.selectFrom('sessions').select('sid').limit(1).execute();
		} catch (err) {
			let builder = this.db.schema.createTable('sessions')
				.ifNotExists()
				.addColumn('sid', 'varchar(255)', col => col.primaryKey())
				.addColumn('sess', 'text', col => col.notNull());
			if (dialect === 'mysql') {
				builder = builder.addColumn('expireAt', 'datetime');
			} else if (dialect === 'postgres' || dialect === 'pglite') {
				builder = builder.addColumn('expireAt', 'timestamp');
			} else {
				builder = builder.addColumn('expireAt', 'text');
			}
			await builder.execute();
			await this.db.schema.createIndex('sessions_expireAt_idx')
				.ifNotExists().on('sessions').column('expireAt').execute();
		}
	}

	get(sid, callback) {
		this._get(sid).then(
			session => callback(null, session),
			err => callback(err),
		);
	}

	async _get(sid) {
		const now = new Date().toISOString();
		const result = await this.db.selectFrom('sessions')
			.select('sess')
			.where('sid', '=', sid)
			.where(eb => eb.or([
				eb('expireAt', 'is', null),
				eb('expireAt', '>', now),
			]))
			.executeTakeFirst();

		if (!result) return null;

		try {
			return typeof result.sess === 'string' ? JSON.parse(result.sess) : result.sess;
		} catch (err) {
			// Corrupt row — drop it so subsequent gets don't keep wasting a
			// SELECT to discover the same parse failure. Matches connect-pg-simple.
			await this._destroy(sid).catch(() => {});
			return null;
		}
	}

	set(sid, session, callback) {
		this._set(sid, session).then(
			() => callback(null),
			err => callback(err),
		);
	}

	async _set(sid, session) {
		const { helpers, db } = this;
		const expireAt = new Date(Date.now() + this._resolveTtlMs(session)).toISOString();
		const sess = JSON.stringify(session);
		await helpers.upsert(
			db, 'sessions', { sid, sess, expireAt }, ['sid'], { sess, expireAt }
		);
	}

	destroy(sid, callback) {
		this._destroy(sid).then(
			() => callback(null),
			err => callback(err),
		);
	}

	async _destroy(sid) {
		await this.db.deleteFrom('sessions').where('sid', '=', sid).execute();
	}

	touch(sid, session, callback) {
		if (this.disableTouch) {
			process.nextTick(callback, null);
			return;
		}
		this._touch(sid, session).then(
			() => callback(null),
			err => callback(err),
		);
	}

	async _touch(sid, session) {
		const expireAt = new Date(Date.now() + this._resolveTtlMs(session)).toISOString();
		await this.db.updateTable('sessions')
			.set({ expireAt })
			.where('sid', '=', sid)
			.execute();
	}

	all(callback) {
		this._all().then(
			sessions => callback(null, sessions),
			err => callback(err),
		);
	}

	async _all() {
		const now = new Date().toISOString();
		const rows = await this.db.selectFrom('sessions')
			.select(['sid', 'sess'])
			.where(eb => eb.or([
				eb('expireAt', 'is', null),
				eb('expireAt', '>', now),
			]))
			.execute();
		const out = {};
		for (const { sid, sess } of rows) {
			try {
				out[sid] = typeof sess === 'string' ? JSON.parse(sess) : sess;
			} catch { /* ignore corrupt rows */ }
		}
		return out;
	}

	length(callback) {
		this._length().then(
			len => callback(null, len),
			err => callback(err),
		);
	}

	async _length() {
		const now = new Date().toISOString();
		const row = await this.db.selectFrom('sessions')
			.select(eb => eb.fn.count('sid').as('count'))
			.where(eb => eb.or([
				eb('expireAt', 'is', null),
				eb('expireAt', '>', now),
			]))
			.executeTakeFirst();
		return row ? parseInt(row.count, 10) : 0;
	}

	clear(callback) {
		this._clear().then(
			() => callback(null),
			err => callback(err),
		);
	}

	async _clear() {
		await this.db.deleteFrom('sessions').execute();
	}

	async cleanupExpired() {
		const now = new Date().toISOString();
		await this.db.deleteFrom('sessions').where('expireAt', '<', now).execute();
	}
}

module.exports = KyselySessionStore;
