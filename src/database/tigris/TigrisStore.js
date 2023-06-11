'use strict';

const __createBinding = (this && this.__createBinding) || (Object.create ? (function (o, m, k, k2) {
	if (k2 === undefined) k2 = k;
	Object.defineProperty(o, k2, { enumerable: true, get: function () { return m[k]; } });
}) : (function (o, m, k, k2) {
	if (k2 === undefined) k2 = k;
	o[k2] = m[k];
}));
const __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function (o, v) {
	Object.defineProperty(o, 'default', { enumerable: true, value: v });
}) : function (o, v) {
	o.default = v;
});
const __importStar = (this && this.__importStar) || function (mod) {
	if (mod && mod.__esModule) return mod;
	const result = {};
	if (mod != null) for (const k in mod) if (k !== 'default' && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
	__setModuleDefault(result, mod);
	return result;
};
const __importDefault = (this && this.__importDefault) || function (mod) {
	return (mod && mod.__esModule) ? mod : { default: mod };
};
Object.defineProperty(exports, '__esModule', { value: true });
const console_1 = require('console');
const util_1 = __importDefault(require('util'));
const session = __importStar(require('express-session'));
const { Tigris } = require('@tigrisdata/core');
const debug_1 = __importDefault(require('debug'));

const debug = debug_1.default('connect-tigris');
// eslint-disable-next-line @typescript-eslint/no-empty-function
const noop = () => { };
const unit = a => a;
function defaultSerializeFunction(session) {
	// Copy each property of the session to a new object
	const obj = {};
	let prop;
	for (prop in session) {
		if (prop === 'cookie') {
			// Convert the cookie instance to an object, if possible
			// This gets rid of the duplicate object under session.cookie.data property
			// @ts-ignore FIXME:
			obj.cookie = session.cookie.toJSON ? // @ts-ignore FIXME:
				session.cookie.toJSON() :
				session.cookie;
		} else {
			// @ts-ignore FIXME:
			obj[prop] = session[prop];
		}
	}
	return obj;
}
function computeTransformFunctions(options) {
	if (options.serialize || options.unserialize) {
		return {
			serialize: options.serialize || defaultSerializeFunction,
			unserialize: options.unserialize || unit,
		};
	}
	if (options.stringify === false) {
		return {
			serialize: defaultSerializeFunction,
			unserialize: unit,
		};
	}
	// Default case
	return {
		serialize: JSON.stringify,
		unserialize: JSON.parse,
	};
}
class TigrisStore extends session.Store {
	constructor({ collectionName = 'sessions', ttl = 1209600, mongoOptions = {}, autoRemove = 'native', autoRemoveInterval = 10, touchAfter = 0, stringify = true, crypto, ...required }) {
		super();
		this.crypto = null;
		debug('create TigrisStore instance');
		const options = {
			collectionName,
			ttl,
			mongoOptions,
			autoRemove,
			autoRemoveInterval,
			touchAfter,
			stringify,
			crypto: {
				...{
					secret: false,
					algorithm: 'aes-256-gcm',
					hashing: 'sha512',
					encodeas: 'base64',
					key_size: 32,
					iv_size: 16,
					at_size: 16,
				},
				...crypto,
			},
			...required,
		};
		// Check params
		console_1.assert(options.mongoUrl || options.clientPromise || options.client, 'You must provide either mongoUrl|clientPromise|client in options');
		console_1.assert(options.createAutoRemoveIdx === null ||
            options.createAutoRemoveIdx === undefined, 'options.createAutoRemoveIdx has been reverted to autoRemove and autoRemoveInterval');
		console_1.assert(!options.autoRemoveInterval || options.autoRemoveInterval <= 71582,
			/* (Math.pow(2, 32) - 1) / (1000 * 60) */ 'autoRemoveInterval is too large. options.autoRemoveInterval is in minutes but not seconds nor mills');
		this.transformFunctions = computeTransformFunctions(options);
		let _clientP;
		if (options.mongoUrl) {
			_clientP = new Tigris(options);
		} else if (options.clientPromise) {
			_clientP = options.clientPromise;
		} else if (options.client) {
			_clientP = Promise.resolve(options.client);
		} else {
			throw new Error('Cannot init client. Please provide correct options');
		}
		console_1.assert(!!_clientP, 'Client is null|undefined');
		this.clientP = _clientP;
		this.options = options;
		this.collectionP = _clientP.then(async (con) => {
			const schema = {
				_id: { type: 'string', format: 'byte' },
				session: { type: 'string' },
				expires: { type: 'date-time' },
			};
			await con.getDatabase()
				.createOrUpdateCollection(options.collectionName, schema);
			const collection = con
				.getDatabase()
				.getCollection(options.collectionName);
			await this.setAutoRemove(collection);
			return collection;
		});
		if (options.crypto.secret) {
			this.crypto = require('kruptein')(options.crypto);
		}
	}

	static create(options) {
		return new TigrisStore(options);
	}

	setAutoRemove(collection) {
		const removeQuery = () => ({
			expires: {
				$lt: new Date(),
			},
		});
		switch (this.options.autoRemove) {
			case 'native':
				debug('Creating MongoDB TTL index');
				this.timer = setInterval(() => collection.deleteMany({
					filter: removeQuery(),
				}), this.options.autoRemoveInterval * 1000 * 60);
				this.timer.unref();
				return Promise.resolve();
			case 'interval':
				debug('create Timer to remove expired sessions');
				this.timer = setInterval(() => collection.deleteMany({
					filter: removeQuery(),
				}), this.options.autoRemoveInterval * 1000 * 60);
				this.timer.unref();
				return Promise.resolve();
			case 'disabled':
			default:
				return Promise.resolve();
		}
	}

	computeStorageId(sessionId) {
		if (this.options.transformId &&
            typeof this.options.transformId === 'function') {
			return this.options.transformId(sessionId);
		}
		return sessionId;
	}

	/**
     * promisify and bind the `this.crypto.get` function.
     * Please check !!this.crypto === true before using this getter!
     */
	get cryptoGet() {
		if (!this.crypto) {
			throw new Error('Check this.crypto before calling this.cryptoGet!');
		}
		return util_1.default.promisify(this.crypto.get).bind(this.crypto);
	}

	/**
     * Decrypt given session data
     * @param session session data to be decrypt. Mutate the input session.
     */
	async decryptSession(session) {
		if (this.crypto && session) {
			const plaintext = await this.cryptoGet(this.options.crypto.secret, session.session).catch((err) => {
				throw new Error(err);
			});
			// @ts-ignore
			session.session = JSON.parse(plaintext);
		}
	}

	/**
     * Get a session from the store given a session ID (sid)
     * @param sid session ID
     */
	get(sid, callback) {
		(async () => {
			try {
				debug(`TigrisStore#get=${sid}`);
				const collection = await this.collectionP;
				const session = await collection.findOne({
					filter: {
						$or: [
							{ _id: this.computeStorageId(sid) },
							{ _id: this.computeStorageId(sid), expires: { $gt: new Date() } },
						],

					},
				});
				if (this.crypto && session) {
					await this.decryptSession(session).catch(err => callback(err));
				}
				const s = session && this.transformFunctions.unserialize(session.session);
				if (this.options.touchAfter > 0 && (session === null || session === void 0 ? void 0 : session.lastModified)) {
					s.lastModified = session.lastModified;
				}
				this.emit('get', sid);
				callback(null, s === undefined ? null : s);
			} catch (error) {
				callback(error);
			}
		})();
	}

	/**
     * Upsert a session into the store given a session ID (sid) and session (session) object.
     * @param sid session ID
     * @param session session object
     */
	set(sid, session, callback = noop) {
		(async () => {
			let _a;
			try {
				debug(`TigrisStore#set=${sid}`);
				// Removing the lastModified prop from the session object before update
				// @ts-ignore
				if (this.options.touchAfter > 0 && (session === null || session === void 0 ? void 0 : session.lastModified)) {
					// @ts-ignore
					delete session.lastModified;
				}
				const s = {
					_id: this.computeStorageId(sid),
					session: this.transformFunctions.serialize(session),
				};
				// Expire handling
				if ((_a = session === null || session === void 0 ? void 0 : session.cookie) === null || _a === void 0 ? void 0 : _a.expires) {
					s.expires = new Date(session.cookie.expires);
				} else {
					// If there's no expiration date specified, it is
					// browser-session cookie or there is no cookie at all,
					// as per the connect docs.
					//
					// So we set the expiration to two-weeks from now
					// - as is common practice in the industry (e.g Django) -
					// or the default specified in the options.
					s.expires = new Date(Date.now() + this.options.ttl * 1000);
				}
				// Last modify handling
				if (this.options.touchAfter > 0) {
					s.lastModified = new Date();
				}
				if (this.crypto) {
					const cryptoSet = util_1.default.promisify(this.crypto.set).bind(this.crypto);
					const data = await cryptoSet(this.options.crypto.secret, s.session).catch((err) => {
						throw new Error(err);
					});
					s.session = data;
				}
				const collection = await this.collectionP;
				const exist = await collection.findOne({ filter: { _id: s._id } });
				const rawResp = exist ? await collection.updateOne({
					filter: { _id: s._id },
					fields: s,
				}) :
					await collection.insertOne(s);


				if (!exist) {
					this.emit('create', sid);
				} else {
					this.emit('update', sid);
				}
				this.emit('set', sid);
			} catch (error) {
				return callback(error);
			}
			return callback(null);
		})();
	}

	touch(sid, session, callback = noop) {
		(async () => {
			let _a;
			try {
				debug(`TigrisStore#touch=${sid}`);
				const updateFields = {};
				const touchAfter = this.options.touchAfter * 1000;
				const lastModified = session.lastModified ?
					session.lastModified.getTime() :
					0;
				const currentDate = new Date();
				// If the given options has a touchAfter property, check if the
				// current timestamp - lastModified timestamp is bigger than
				// the specified, if it's not, don't touch the session
				if (touchAfter > 0 && lastModified > 0) {
					const timeElapsed = currentDate.getTime() - lastModified;
					if (timeElapsed < touchAfter) {
						debug(`Skip touching session=${sid}`);
						return callback(null);
					}
					updateFields.lastModified = currentDate;
				}
				if ((_a = session === null || session === void 0 ? void 0 : session.cookie) === null || _a === void 0 ? void 0 : _a.expires) {
					updateFields.expires = new Date(session.cookie.expires);
				} else {
					updateFields.expires = new Date(Date.now() + this.options.ttl * 1000);
				}
				const collection = await this.collectionP;
				// const rawResp = await collection.updateOne({ _id: this.computeStorageId(sid) }, { $set: updateFields }, { writeConcern: this.options.writeOperationOptions });
				const rawResp = await collection.updateOne({
					filter: { _id: this.computeStorageId(sid) },
					fields: updateFields,
				});
				if (rawResp._modifiedCount === 0) {
					return callback(new Error('Unable to find the session to touch'));
				}

				this.emit('touch', sid, session);
				return callback(null);
			} catch (error) {
				return callback(error);
			}
		})();
	}

	/**
     * Get all sessions in the store as an array
     */
	all(callback) {
		(async () => {
			try {
				debug('TigrisStore#all()');
				const collection = await this.collectionP;
				const sessions = collection.findMany();
				const results = [];
				for await (const session of sessions) {
					if (session && session.expires && session.expires < new Date()) {
						// eslint-disable-next-line no-continue
						continue;
					}
					if (this.crypto && session) {
						await this.decryptSession(session);
					}
					results.push(this.transformFunctions.unserialize(session.session));
				}
				this.emit('all', results);
				callback(null, results);
			} catch (error) {
				callback(error);
			}
		})();
	}

	/**
     * Destroy/delete a session from the store given a session ID (sid)
     * @param sid session ID
     */
	destroy(sid, callback = noop) {
		debug(`TigrisStore#destroy=${sid}`);
		this.collectionP
			.then(colleciton => colleciton.deleteOne({
				filter: { _id: this.computeStorageId(sid) },
			}))
			.then(() => {
				this.emit('destroy', sid);
				callback(null);
			})
			.catch(err => callback(err));
	}

	/**
     * Get the count of all sessions in the store
     */
	length(callback) {
		debug('TigrisStore#length()');
		this.collectionP
			.then(collection => collection.count())
			.then(c => callback(null, c))
		// @ts-ignore
			.catch(err => callback(err));
	}

	/**
     * Delete all sessions from the store.
     */
	clear(callback = noop) {
		debug('TigrisStore#clear()');
		this.clientP.dropCollection()
			.then(() => callback(null))
			.catch(err => callback(err));
	}

	/**
     * Close database connection
     */
	close() {
		debug('TigrisStore#close()');
		return this.clientP.then(c => c.close());
	}
}
exports.default = TigrisStore;
