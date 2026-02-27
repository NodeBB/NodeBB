'use strict';

const {Store} = require('express-session');

class KyselySessionStore extends Store {
	constructor(options) {
		super(options);
		this.db = options.db;
		this.dialect = options.dialect;
		this.helpers = options.helpers;
	}

	async ensureSessionsTable() {
		const {dialect} = this;
		try {
			await this.db.selectFrom('sessions').select('sid').limit(1).execute();
		} catch (err) {
			// Table doesn't exist, create it
			let builder = this.db.schema.createTable('sessions')
				.ifNotExists()
				.addColumn('sid', 'varchar(255)', col => col.primaryKey())
				.addColumn('sess', 'text', col => col.notNull());

			// Add expireAt column based on dialect
			if (dialect === 'mysql') {
				builder = builder.addColumn('expireAt', 'datetime');
			} else if (dialect === 'postgres') {
				builder = builder.addColumn('expireAt', 'timestamp');
			} else {
				// SQLite
				builder = builder.addColumn('expireAt', 'text');
			}

			await builder.execute();

			// Create index on expireAt
			await this.db.schema.createIndex('sessions_expireAt_idx')
				.ifNotExists()
				.on('sessions')
				.column('expireAt')
				.execute();
		}
	}

	get(sid, callback) {
		this._get(sid).then(
			session => callback(null, session),
			err => callback(err)
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

		if (!result) {
			return null;
		}

		try {
			return typeof result.sess === 'string' ? JSON.parse(result.sess) : result.sess;
		} catch (err) {
			return null;
		}
	}

	set(sid, session, callback) {
		this._set(sid, session).then(
			() => callback(null),
			err => callback(err)
		);
	}

	async _set(sid, session) {
		const {helpers, db} = this;
		const ttl = session.cookie && session.cookie.maxAge ? session.cookie.maxAge : 86400000;
		const expireAt = new Date(Date.now() + ttl).toISOString();
		const sess = JSON.stringify(session);

		await helpers.upsert(db, 'sessions', {
			sid: sid,
			sess: sess,
			expireAt: expireAt,
		}, ['sid'], {
			sess: sess,
			expireAt: expireAt,
		});
	}

	destroy(sid, callback) {
		this._destroy(sid).then(
			() => callback(null),
			err => callback(err)
		);
	}

	async _destroy(sid) {
		await this.db.deleteFrom('sessions')
			.where('sid', '=', sid)
			.execute();
	}

	touch(sid, session, callback) {
		this._touch(sid, session).then(
			() => callback(null),
			err => callback(err)
		);
	}

	async _touch(sid, session) {
		const ttl = session.cookie && session.cookie.maxAge ? session.cookie.maxAge : 86400000;
		const expireAt = new Date(Date.now() + ttl).toISOString();

		await this.db.updateTable('sessions')
			.set({ expireAt: expireAt })
			.where('sid', '=', sid)
			.execute();
	}

	all(callback) {
		this._all().then(
			sessions => callback(null, sessions),
			err => callback(err)
		);
	}

	async _all() {
		const now = new Date().toISOString();

		const result = await this.db.selectFrom('sessions')
			.select(['sid', 'sess'])
			.where(eb => eb.or([
				eb('expireAt', 'is', null),
				eb('expireAt', '>', now),
			]))
			.execute();

		return result.reduce((sessions, { sid, sess }) => {
			try {
				return { ...sessions, [sid]: typeof sess === 'string' ? JSON.parse(sess) : sess };
			} catch (err) {
				return sessions; // Ignore invalid sessions
			}
		}, {});
	}

	length(callback) {
		this._length().then(
			len => callback(null, len),
			err => callback(err)
		);
	}

	async _length() {
		const now = new Date().toISOString();

		const result = await this.db.selectFrom('sessions')
			.select(eb => eb.fn.count('sid').as('count'))
			.where(eb => eb.or([
				eb('expireAt', 'is', null),
				eb('expireAt', '>', now),
			]))
			.executeTakeFirst();

		return result ? parseInt(result.count, 10) : 0;
	}

	clear(callback) {
		this._clear().then(
			() => callback(null),
			err => callback(err)
		);
	}

	async _clear() {
		await this.db.deleteFrom('sessions').execute();
	}

	// Cleanup expired sessions
	async cleanupExpired() {
		const now = new Date().toISOString();

		await this.db.deleteFrom('sessions')
			.where('expireAt', '<', now)
			.execute();
	}
}

module.exports = KyselySessionStore;