'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const nconf = require('nconf');
const validator = require('validator');
const jwt = require('jsonwebtoken');
const { setTimeout } = require('node:timers/promises');

const db = require('./mocks/databasemock');
const User = require('../src/user');
const Topics = require('../src/topics');
const Categories = require('../src/categories');
const Posts = require('../src/posts');
const groups = require('../src/groups');
const messaging = require('../src/messaging');
const helpers = require('./helpers');
const meta = require('../src/meta');
const file = require('../src/file');
const socketUser = require('../src/socket.io/user');
const apiUser = require('../src/api/users');
const utils = require('../src/utils');
const privileges = require('../src/privileges');
const request = require('../src/request');

describe('User', () => {
	let userData;
	let testUid;
	let testCid;

	const plugins = require('../src/plugins');

	async function dummyEmailerHook(data) {
		// pretend to handle sending emails
	}
	before((done) => {
		// Attach an emailer hook so related requests do not error
		plugins.hooks.register('emailer-test', {
			hook: 'static:email.send',
			method: dummyEmailerHook,
		});

		Categories.create({
			name: 'Test Category',
			description: 'A test',
			order: 1,
		}, (err, categoryObj) => {
			if (err) {
				return done(err);
			}

			testCid = categoryObj.cid;
			done();
		});
	});
	after(() => {
		plugins.hooks.unregister('emailer-test', 'static:email.send');
	});

	beforeEach(() => {
		userData = {
			username: 'John Smith',
			fullname: 'John Smith McNamara',
			password: 'swordfish',
			email: 'john@example.com',
			callback: undefined,
		};
	});

	const goodImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABwAAAAgCAYAAAABtRhCAAAACXBIWXMAAC4jAAAuIwF4pT92AAAKT2lDQ1BQaG90b3Nob3AgSUNDIHByb2ZpbGUAAHjanVNnVFPpFj333vRCS4iAlEtvUhUIIFJCi4AUkSYqIQkQSoghodkVUcERRUUEG8igiAOOjoCMFVEsDIoK2AfkIaKOg6OIisr74Xuja9a89+bN/rXXPues852zzwfACAyWSDNRNYAMqUIeEeCDx8TG4eQuQIEKJHAAEAizZCFz/SMBAPh+PDwrIsAHvgABeNMLCADATZvAMByH/w/qQplcAYCEAcB0kThLCIAUAEB6jkKmAEBGAYCdmCZTAKAEAGDLY2LjAFAtAGAnf+bTAICd+Jl7AQBblCEVAaCRACATZYhEAGg7AKzPVopFAFgwABRmS8Q5ANgtADBJV2ZIALC3AMDOEAuyAAgMADBRiIUpAAR7AGDIIyN4AISZABRG8lc88SuuEOcqAAB4mbI8uSQ5RYFbCC1xB1dXLh4ozkkXKxQ2YQJhmkAuwnmZGTKBNA/g88wAAKCRFRHgg/P9eM4Ors7ONo62Dl8t6r8G/yJiYuP+5c+rcEAAAOF0ftH+LC+zGoA7BoBt/qIl7gRoXgugdfeLZrIPQLUAoOnaV/Nw+H48PEWhkLnZ2eXk5NhKxEJbYcpXff5nwl/AV/1s+X48/Pf14L7iJIEyXYFHBPjgwsz0TKUcz5IJhGLc5o9H/LcL//wd0yLESWK5WCoU41EScY5EmozzMqUiiUKSKcUl0v9k4t8s+wM+3zUAsGo+AXuRLahdYwP2SycQWHTA4vcAAPK7b8HUKAgDgGiD4c93/+8//UegJQCAZkmScQAAXkQkLlTKsz/HCAAARKCBKrBBG/TBGCzABhzBBdzBC/xgNoRCJMTCQhBCCmSAHHJgKayCQiiGzbAdKmAv1EAdNMBRaIaTcA4uwlW4Dj1wD/phCJ7BKLyBCQRByAgTYSHaiAFiilgjjggXmYX4IcFIBBKLJCDJiBRRIkuRNUgxUopUIFVIHfI9cgI5h1xGupE7yAAygvyGvEcxlIGyUT3UDLVDuag3GoRGogvQZHQxmo8WoJvQcrQaPYw2oefQq2gP2o8+Q8cwwOgYBzPEbDAuxsNCsTgsCZNjy7EirAyrxhqwVqwDu4n1Y8+xdwQSgUXACTYEd0IgYR5BSFhMWE7YSKggHCQ0EdoJNwkDhFHCJyKTqEu0JroR+cQYYjIxh1hILCPWEo8TLxB7iEPENyQSiUMyJ7mQAkmxpFTSEtJG0m5SI+ksqZs0SBojk8naZGuyBzmULCAryIXkneTD5DPkG+Qh8lsKnWJAcaT4U+IoUspqShnlEOU05QZlmDJBVaOaUt2ooVQRNY9aQq2htlKvUYeoEzR1mjnNgxZJS6WtopXTGmgXaPdpr+h0uhHdlR5Ol9BX0svpR+iX6AP0dwwNhhWDx4hnKBmbGAcYZxl3GK+YTKYZ04sZx1QwNzHrmOeZD5lvVVgqtip8FZHKCpVKlSaVGyovVKmqpqreqgtV81XLVI+pXlN9rkZVM1PjqQnUlqtVqp1Q61MbU2epO6iHqmeob1Q/pH5Z/YkGWcNMw09DpFGgsV/jvMYgC2MZs3gsIWsNq4Z1gTXEJrHN2Xx2KruY/R27iz2qqaE5QzNKM1ezUvOUZj8H45hx+Jx0TgnnKKeX836K3hTvKeIpG6Y0TLkxZVxrqpaXllirSKtRq0frvTau7aedpr1Fu1n7gQ5Bx0onXCdHZ4/OBZ3nU9lT3acKpxZNPTr1ri6qa6UbobtEd79up+6Ynr5egJ5Mb6feeb3n+hx9L/1U/W36p/VHDFgGswwkBtsMzhg8xTVxbzwdL8fb8VFDXcNAQ6VhlWGX4YSRudE8o9VGjUYPjGnGXOMk423GbcajJgYmISZLTepN7ppSTbmmKaY7TDtMx83MzaLN1pk1mz0x1zLnm+eb15vft2BaeFostqi2uGVJsuRaplnutrxuhVo5WaVYVVpds0atna0l1rutu6cRp7lOk06rntZnw7Dxtsm2qbcZsOXYBtuutm22fWFnYhdnt8Wuw+6TvZN9un2N/T0HDYfZDqsdWh1+c7RyFDpWOt6azpzuP33F9JbpL2dYzxDP2DPjthPLKcRpnVOb00dnF2e5c4PziIuJS4LLLpc+Lpsbxt3IveRKdPVxXeF60vWdm7Obwu2o26/uNu5p7ofcn8w0nymeWTNz0MPIQ+BR5dE/C5+VMGvfrH5PQ0+BZ7XnIy9jL5FXrdewt6V3qvdh7xc+9j5yn+M+4zw33jLeWV/MN8C3yLfLT8Nvnl+F30N/I/9k/3r/0QCngCUBZwOJgUGBWwL7+Hp8Ib+OPzrbZfay2e1BjKC5QRVBj4KtguXBrSFoyOyQrSH355jOkc5pDoVQfujW0Adh5mGLw34MJ4WHhVeGP45wiFga0TGXNXfR3ENz30T6RJZE3ptnMU85ry1KNSo+qi5qPNo3ujS6P8YuZlnM1VidWElsSxw5LiquNm5svt/87fOH4p3iC+N7F5gvyF1weaHOwvSFpxapLhIsOpZATIhOOJTwQRAqqBaMJfITdyWOCnnCHcJnIi/RNtGI2ENcKh5O8kgqTXqS7JG8NXkkxTOlLOW5hCepkLxMDUzdmzqeFpp2IG0yPTq9MYOSkZBxQqohTZO2Z+pn5mZ2y6xlhbL+xW6Lty8elQfJa7OQrAVZLQq2QqboVFoo1yoHsmdlV2a/zYnKOZarnivN7cyzytuQN5zvn//tEsIS4ZK2pYZLVy0dWOa9rGo5sjxxedsK4xUFK4ZWBqw8uIq2Km3VT6vtV5eufr0mek1rgV7ByoLBtQFr6wtVCuWFfevc1+1dT1gvWd+1YfqGnRs+FYmKrhTbF5cVf9go3HjlG4dvyr+Z3JS0qavEuWTPZtJm6ebeLZ5bDpaql+aXDm4N2dq0Dd9WtO319kXbL5fNKNu7g7ZDuaO/PLi8ZafJzs07P1SkVPRU+lQ27tLdtWHX+G7R7ht7vPY07NXbW7z3/T7JvttVAVVN1WbVZftJ+7P3P66Jqun4lvttXa1ObXHtxwPSA/0HIw6217nU1R3SPVRSj9Yr60cOxx++/p3vdy0NNg1VjZzG4iNwRHnk6fcJ3/ceDTradox7rOEH0x92HWcdL2pCmvKaRptTmvtbYlu6T8w+0dbq3nr8R9sfD5w0PFl5SvNUyWna6YLTk2fyz4ydlZ19fi753GDborZ752PO32oPb++6EHTh0kX/i+c7vDvOXPK4dPKy2+UTV7hXmq86X23qdOo8/pPTT8e7nLuarrlca7nuer21e2b36RueN87d9L158Rb/1tWeOT3dvfN6b/fF9/XfFt1+cif9zsu72Xcn7q28T7xf9EDtQdlD3YfVP1v+3Njv3H9qwHeg89HcR/cGhYPP/pH1jw9DBY+Zj8uGDYbrnjg+OTniP3L96fynQ89kzyaeF/6i/suuFxYvfvjV69fO0ZjRoZfyl5O/bXyl/erA6xmv28bCxh6+yXgzMV70VvvtwXfcdx3vo98PT+R8IH8o/2j5sfVT0Kf7kxmTk/8EA5jz/GMzLdsAAAAgY0hSTQAAeiUAAICDAAD5/wAAgOkAAHUwAADqYAAAOpgAABdvkl/FRgAACcJJREFUeNqMl9tvnNV6xn/f+s5z8DCeg88Zj+NYdhJH4KShFoJAIkzVphLVJnsDaiV6gUKaC2qQUFVATbnoValAakuQYKMqBKUUJCgI9XBBSmOROMqGoCStHbA9sWM7nrFn/I3n9B17kcwoabfarj9gvet53+d9nmdJAwMDAAgh8DyPtbU1XNfFMAwkScK2bTzPw/M8dF1/SAhxKAiCxxVF2aeqqqTr+q+Af+7o6Ch0d3f/69TU1KwkSRiGwbFjx3jmmWd47rnn+OGHH1BVFYX/5QRBkPQ87xeSJP22YRi/oapqStM0PM/D931kWSYIgnHf98cXFxepVqtomjZt2/Zf2bb990EQ4Pv+PXfeU1CSpGYhfN9/TgjxQTQaJQgCwuEwQRBQKpUwDAPTNPF9n0ajAYDv+8zPzzM+Pr6/Wq2eqdVqfxOJRA6Zpnn57hrivyEC0IQQZ4Mg+MAwDCKRCJIkUa/XEUIQi8XQNI1QKIQkSQghUBQFIQSmaTI7OwtAuVxOTE9Pfzc9Pf27lUqlBUgulUoUi0VKpRKqqg4EQfAfiqLsDIfDAC0E4XCYaDSKEALXdalUKvfM1/d9hBBYlkUul2N4eJi3335bcl33mW+++aaUz+cvSJKE8uKLL6JpGo7j8Omnn/7d+vp6sr+/HyEEjuMgyzKu6yJJEsViEVVV8TyPjY2NVisV5fZkTNMkkUhw8+ZN6vU6Kysr7Nmzh9OnT7/12GOPDS8sLByT7rQR4A9XV1d/+cILLzA9PU0kEmF4eBhFUTh//jyWZaHrOkII0uk0jUaDWq1GJpOhWCyysrLC1tYWnuehqir79+9H13W6urp48803+f7773n++ef/4G7S/H4ikUCSJNbX11trcuvWLcrlMrIs4zgODzzwABMTE/i+T7lcpq2tjUqlwubmJrZts7y8jBCCkZERGo0G2WyWkydPkkql6Onp+eMmwihwc3JyMvrWW2+RTCYBcF0XWZbRdZ3l5WX27NnD008/TSwWQ1VVyuVy63GhUIhEIkEqlcJxHCzLIhaLMTQ0xJkzZ7Btm3379lmS53kIIczZ2dnFsbGxRK1Wo729HQDP8zAMg5WVFXp7e5mcnKSzs5N8Po/rutTrdVzXbQmHrutEo1FM00RVVXp7e0kkEgRBwMWLF9F1vaxUq1UikUjtlVdeuV6pVBJ9fX3Ytn2bwrLMysoKXV1dTE5OkslksCwLTdMwDANVVdnY2CAIApLJJJFIBMdxiMfj7Nq1C1VViUajLQCvvvrqkhKJRJiZmfmdb7/99jeTySSyLLfWodFoEAqFOH78OLt37yaXy2GaJoqisLy8zNTUFFevXiUIAtrb29m5cyePPPJIa+cymQz1eh2A0dFRCoXCsgIwNTW1J5/P093dTbFYRJZlJEmiWq1y4MABxsbGqNVqhEIh6vU6QRBQLpcxDIPh4WE8z2NxcZFTp05x7tw5Xn755ZY6dXZ2tliZzWa/EwD1ev3RsbExxsfHSafTVCoVGo0Gqqqya9cuIpEIQgh832dtbY3FxUUA+vr62LZtG2NjYxw5coTDhw+ztLTEyZMnuXr1KoVC4R4d3bt375R84sQJEY/H/2Jubq7N9326urqwbZt6vY5pmhw5coS+vr4W9YvFIrdu3WJqagohBFeuXOHcuXOtue7evRtN01rtfO+991haWmJkZGQrkUi8JIC9iqL0BkFAIpFACMETTzxBV1cXiUSC7u5uHMfB8zyCIMA0TeLxONlsFlmW8X2fwcFBHMdhfn6eer1Oe3s7Dz30EBMTE1y6dImjR49y6tSppR07dqwrjuM8+OWXXzI0NMTly5e5du0aQ0NDTExMkMvlCIKAIAhaIh2LxQiHw0QiEfL5POl0mlqtRq1Wo6OjA8uykGWZdDrN0tISvb29vPPOOzz++OPk83lELpf7rXfffRfDMOjo6MBxHEqlEocOHWLHjh00Gg0kSULTNIS4bS6qqhKPxxkaGmJ4eJjR0VH279/PwMAA27dvJ5vN4vs+X331FR9//DGzs7OEQiE++eQTlPb29keuX7/OtWvXOH78ONVqlZs3b9LW1kYmk8F13dZeCiGQJAnXdRFCYBgGsiwjhMC2bQqFAkEQoOs6P/74Iw8++CCDg4Pous6xY8f47LPPkIIguDo2Nrbzxo0bfPjhh9i2zczMTHNvcF2XpsZalkWj0cB1Xe4o1O3YoCisra3x008/EY/H6erqAuDAgQNEIhGCIODQoUP/ubCwMCKAjx599FHW19f56KOP6OjooFgsks/niUajKIqCbds4joMQAiFESxxs226xd2Zmhng8Tl9fH67r0mg0sG2bbDZLpVIhl8vd5gHwtysrKy8Dcdd1mZubo6enh1gsRrVabZlrk6VND/R9n3q9TqVSQdd1QqEQi4uLnD9/nlKpxODgIHv37gXAcRyCICiFQiHEzp07i1988cUfKYpCIpHANE22b9/eUhNFUVotDIKghc7zPCzLolKpsLW1RVtbG0EQ4DgOmqbR09NDM1qUSiWAPwdQ7ujjmf7+/kQymfxrSZJQVZWtra2WG+i63iKH53m4rku1WqVcLmNZFu3t7S2x7+/vJ51O89prr7VYfenSpcPAP1UqFeSHH36YeDxOKpW6eP/9988Bv9d09nw+T7VapVKptJjZnE2tVmNtbY1cLke5XGZra4vNzU16enp49tlnGRgYaD7iTxqNxgexWIzDhw+jNEPQHV87NT8/f+PChQtnR0ZGqFarrUVuOsDds2u2b2FhgVQqRSQSYWFhgStXrtDf308ymcwBf3nw4EEOHjx4O5c2lURVVRzHYXp6+t8uX7785IULFz7LZDLous59991HOBy+h31N9xgdHSWTyVCtVhkaGmLfvn1MT08zPz/PzMzM6c8//9xr+uE9QViWZer1OhsbGxiG8fns7OzPc7ncx729vXR3d1OpVNi2bRuhUAhZljEMA9/3sW0bVVVZWlri4sWLjI+P8/rrr/P111/z5JNPXrIs69cn76ZeGoaBpmm0tbX9Q6FQeHhubu7fC4UCkUiE1dVVstks8Xgc0zSRZZlGo9ESAdM02djYoNFo8MYbb2BZ1mYoFOKuZPjr/xZBEHCHred83x/b3Nz8l/X19aRlWWxsbNDZ2cnw8DDhcBjf96lWq/T09HD06FGeeuopXnrpJc6ePUs6nb4hhPi/C959ZFn+TtO0lG3bJ0ql0p85jsPW1haFQoG2tjYkSWpF/Uwmw9raGu+//z7A977vX2+GrP93wSZiTdNOGIbxy3K5/DPHcfYXCoVe27Yzpmm2m6bppVKp/Orqqnv69OmoZVn/mEwm/9TzvP9x138NAMpJ4VFTBr6SAAAAAElFTkSuQmCC';

	describe('.create(), when created', () => {
		it('should be created properly', async () => {
			testUid = await User.create({ username: userData.username, password: userData.password });
			assert.ok(testUid);

			await User.setUserField(testUid, 'email', userData.email);
			await User.email.confirmByUid(testUid);
		});

		it('should be created properly', async () => {
			const email = '<h1>test</h1>@gmail.com';
			const uid = await User.create({ username: 'weirdemail', email: email });
			const data = await User.getUserData(uid);

			const validationPending = await User.email.isValidationPending(uid, email);
			assert.strictEqual(validationPending, true);

			assert.equal(data.email, '');
			assert.strictEqual(data.profileviews, 0);
			assert.strictEqual(data.reputation, 0);
			assert.strictEqual(data.postcount, 0);
			assert.strictEqual(data.topiccount, 0);
			assert.strictEqual(data.lastposttime, 0);
			assert.strictEqual(data.banned, false);
		});

		it('should have a valid email, if using an email', (done) => {
			User.create({ username: userData.username, password: userData.password, email: 'fakeMail' }, (err) => {
				assert(err);
				assert.equal(err.message, '[[error:invalid-email]]');
				done();
			});
		});

		it('should error with invalid password', (done) => {
			User.create({ username: 'test', password: '1' }, (err) => {
				assert.equal(err.message, '[[reset_password:password-too-short]]');
				done();
			});
		});

		it('should error with invalid password', (done) => {
			User.create({ username: 'test', password: {} }, (err) => {
				assert.equal(err.message, '[[error:invalid-password]]');
				done();
			});
		});

		it('should error with a too long password', (done) => {
			let toolong = '';
			for (let i = 0; i < 5000; i++) {
				toolong += 'a';
			}
			User.create({ username: 'test', password: toolong }, (err) => {
				assert.equal(err.message, '[[error:password-too-long]]');
				done();
			});
		});

		it('should error if username is already taken or rename user', async () => {
			let err;
			async function tryCreate(data) {
				try {
					return await User.create(data);
				} catch (_err) {
					err = _err;
				}
			}

			const [uid1, uid2] = await Promise.all([
				tryCreate({ username: 'dupe1' }),
				tryCreate({ username: 'dupe1' }),
			]);
			if (err) {
				assert.strictEqual(err.message, '[[error:username-taken]]');
			} else {
				const userData = await User.getUsersFields([uid1, uid2], ['username']);
				const userNames = userData.map(u => u.username);
				// make sure only 1 dupe1 is created
				assert.equal(userNames.filter(username => username === 'dupe1').length, 1);
				assert.equal(userNames.filter(username => username === 'dupe1 0').length, 1);
			}
		});

		it('should error if email is already taken', async () => {
			let err;
			async function tryCreate(data) {
				try {
					return await User.create(data);
				} catch (_err) {
					err = _err;
				}
			}

			await Promise.all([
				tryCreate({ username: 'notdupe1', email: 'dupe@dupe.com' }),
				tryCreate({ username: 'notdupe2', email: 'dupe@dupe.com' }),
			]);
			assert.strictEqual(err.message, '[[error:email-taken]]');
		});
	});

	describe('.uniqueUsername()', () => {
		it('should deal with collisions', async () => {
			const users = [];
			for (let i = 0; i < 10; i += 1) {
				users.push({
					username: 'Jane Doe',
					email: `jane.doe${i}@example.com`,
				});
			}
			for (const user of users) {
				// eslint-disable-next-line no-await-in-loop
				await User.create(user);
			}

			const username = await User.uniqueUsername({
				username: 'Jane Doe',
				userslug: 'jane-doe',
			});
			assert.strictEqual(username, 'Jane Doe 9');
		});
	});

	describe('.isModerator()', () => {
		it('should return false', (done) => {
			User.isModerator(testUid, testCid, (err, isModerator) => {
				assert.equal(err, null);
				assert.equal(isModerator, false);
				done();
			});
		});

		it('should return two false results', (done) => {
			User.isModerator([testUid, testUid], testCid, (err, isModerator) => {
				assert.equal(err, null);
				assert.equal(isModerator[0], false);
				assert.equal(isModerator[1], false);
				done();
			});
		});

		it('should return two false results', (done) => {
			User.isModerator(testUid, [testCid, testCid], (err, isModerator) => {
				assert.equal(err, null);
				assert.equal(isModerator[0], false);
				assert.equal(isModerator[1], false);
				done();
			});
		});
	});

	describe('.getModeratorUids()', () => {
		before((done) => {
			groups.join('cid:1:privileges:moderate', 1, done);
		});

		it('should retrieve all users with moderator bit in category privilege', (done) => {
			User.getModeratorUids((err, uids) => {
				assert.ifError(err);
				assert.strictEqual(1, uids.length);
				assert.strictEqual(1, parseInt(uids[0], 10));
				done();
			});
		});

		after((done) => {
			groups.leave('cid:1:privileges:moderate', 1, done);
		});
	});

	describe('.getModeratorUids()', () => {
		before(async () => {
			await groups.create({ name: 'testGroup' });
			await groups.join('cid:1:privileges:groups:moderate', 'testGroup');
			await groups.join('testGroup', 1);
		});

		it('should retrieve all users with moderator bit in category privilege', (done) => {
			User.getModeratorUids((err, uids) => {
				assert.ifError(err);
				assert.strictEqual(1, uids.length);
				assert.strictEqual(1, parseInt(uids[0], 10));
				done();
			});
		});

		after(async () => {
			groups.leave('cid:1:privileges:groups:moderate', 'testGroup');
			groups.destroy('testGroup');
		});
	});

	describe('.isReadyToPost()', () => {
		it('should allow a post if the last post time is > 10 seconds', (done) => {
			User.setUserField(testUid, 'lastposttime', +new Date() - (11 * 1000), () => {
				Topics.post({
					uid: testUid,
					title: 'Topic 3',
					content: 'lorem ipsum',
					cid: testCid,
				}, (err) => {
					assert.ifError(err);
					done();
				});
			});
		});

		it('should error when a new user posts if the last post time is 10 < 30 seconds', (done) => {
			meta.config.newbiePostDelay = 30;
			meta.config.newbieReputationThreshold = 3;

			User.setUserField(testUid, 'lastposttime', +new Date() - (20 * 1000), () => {
				Topics.post({
					uid: testUid,
					title: 'Topic 4',
					content: 'lorem ipsum',
					cid: testCid,
				}, (err) => {
					assert(err);
					done();
				});
			});
		});

		it('should not error if a non-newbie user posts if the last post time is 10 < 30 seconds', (done) => {
			User.setUserFields(testUid, {
				lastposttime: +new Date() - (20 * 1000),
				reputation: 10,
			}, () => {
				Topics.post({
					uid: testUid,
					title: 'Topic 5',
					content: 'lorem ipsum',
					cid: testCid,
				}, (err) => {
					assert.ifError(err);
					done();
				});
			});
		});

		it('should only post 1 topic out of 10', async () => {
			await User.create({ username: 'flooder', password: '123456' });
			const { jar } = await helpers.loginUser('flooder', '123456');
			const titles = new Array(10).fill('topic title');
			const res = await Promise.allSettled(titles.map(async (title) => {
				const { body } = await helpers.request('post', '/api/v3/topics', {
					body: {
						cid: testCid,
						title: title,
						content: 'the content',
					},
					jar: jar,
				});
				return body.status;
			}));
			const failed = res.filter(res => res.value.code === 'bad-request');
			const success = res.filter(res => res.value.code === 'ok');
			assert.strictEqual(failed.length, 9);
			assert.strictEqual(success.length, 1);
		});
	});

	describe('.search()', () => {
		let adminUid;
		let uid;
		before(async () => {
			adminUid = await User.create({ username: 'noteadmin' });
			await groups.join('administrators', adminUid);
		});

		it('should return an object containing an array of matching users', (done) => {
			User.search({ query: 'john' }, (err, searchData) => {
				assert.ifError(err);
				uid = searchData.users[0].uid;
				assert.equal(Array.isArray(searchData.users) && searchData.users.length > 0, true);
				assert.equal(searchData.users[0].username, 'John Smith');
				done();
			});
		});

		it('should search user', async () => {
			const searchData = await apiUser.search({ uid: testUid }, { query: 'john' });
			assert.equal(searchData.users[0].username, 'John Smith');
		});

		it('should error for guest', async () => {
			try {
				await apiUser.search({ uid: 0 }, { query: 'john' });
				assert(false);
			} catch (err) {
				assert.equal(err.message, '[[error:no-privileges]]');
			}
		});

		it('should error with invalid data', async () => {
			try {
				await apiUser.search({ uid: testUid }, null);
				assert(false);
			} catch (err) {
				assert.equal(err.message, '[[error:invalid-data]]');
			}
		});

		it('should error for unprivileged user', async () => {
			try {
				await apiUser.search({ uid: testUid }, { searchBy: 'ip', query: '123' });
				assert(false);
			} catch (err) {
				assert.equal(err.message, '[[error:no-privileges]]');
			}
		});

		it('should error for unprivileged user', async () => {
			try {
				await apiUser.search({ uid: testUid }, { filters: ['banned'], query: '123' });
				assert(false);
			} catch (err) {
				assert.equal(err.message, '[[error:no-privileges]]');
			}
		});

		it('should error for unprivileged user', async () => {
			try {
				await apiUser.search({ uid: testUid }, { filters: ['flagged'], query: '123' });
				assert(false);
			} catch (err) {
				assert.equal(err.message, '[[error:no-privileges]]');
			}
		});

		it('should search users by ip', async () => {
			const uid = await User.create({ username: 'ipsearch' });
			await db.sortedSetAdd('ip:1.1.1.1:uid', [1, 1], [testUid, uid]);
			const data = await apiUser.search({ uid: adminUid }, { query: '1.1.1.1', searchBy: 'ip' });
			assert(Array.isArray(data.users));
			assert.equal(data.users.length, 2);
		});

		it('should search users by uid', async () => {
			const data = await apiUser.search({ uid: testUid }, { query: uid, searchBy: 'uid' });
			assert(Array.isArray(data.users));
			assert.equal(data.users[0].uid, uid);
		});

		it('should search users by fullname', async () => {
			const uid = await User.create({ username: 'fullnamesearch1', fullname: 'Mr. Fullname' });
			const data = await apiUser.search({ uid: adminUid }, { query: 'mr', searchBy: 'fullname' });
			assert(Array.isArray(data.users));
			assert.equal(data.users.length, 1);
			assert.equal(uid, data.users[0].uid);
		});

		it('should search users by fullname', async () => {
			const uid = await User.create({ username: 'fullnamesearch2', fullname: 'Baris:Usakli' });
			const data = await apiUser.search({ uid: adminUid }, { query: 'baris:', searchBy: 'fullname' });
			assert(Array.isArray(data.users));
			assert.equal(data.users.length, 1);
			assert.equal(uid, data.users[0].uid);
		});

		it('should return empty array if query is empty', async () => {
			const data = await apiUser.search({ uid: testUid }, { query: '' });
			assert.equal(data.users.length, 0);
		});

		it('should filter users', async () => {
			const uid = await User.create({ username: 'ipsearch_filter' });
			await User.bans.ban(uid, 0, '');
			await User.setUserFields(uid, { flags: 10 });
			const data = await apiUser.search({ uid: adminUid }, {
				query: 'ipsearch',
				filters: ['online', 'banned', 'flagged'],
			});
			assert.equal(data.users[0].username, 'ipsearch_filter');
		});

		it('should sort results by username', async () => {
			await User.create({ username: 'brian' });
			await User.create({ username: 'baris' });
			await User.create({ username: 'bzari' });
			const data = await User.search({
				uid: testUid,
				query: 'b',
				sortBy: 'username',
				paginate: false,
			});
			assert.equal(data.users[0].username, 'baris');
			assert.equal(data.users[1].username, 'brian');
			assert.equal(data.users[2].username, 'bzari');
		});
	});

	describe('.delete()', () => {
		let uid;
		before((done) => {
			User.create({ username: 'usertodelete', password: '123456', email: 'delete@me.com' }, (err, newUid) => {
				assert.ifError(err);
				uid = newUid;
				done();
			});
		});

		it('should delete a user account', (done) => {
			User.delete(1, uid, (err) => {
				assert.ifError(err);
				User.existsBySlug('usertodelete', (err, exists) => {
					assert.ifError(err);
					assert.equal(exists, false);
					done();
				});
			});
		});

		it('should not re-add user to users:postcount if post is purged after user account deletion', async () => {
			const uid = await User.create({ username: 'olduserwithposts' });
			assert(await db.isSortedSetMember('users:postcount', uid));

			const result = await Topics.post({
				uid: uid,
				title: 'old user topic',
				content: 'old user topic post content',
				cid: testCid,
			});
			assert.equal(await db.sortedSetScore('users:postcount', uid), 1);
			await User.deleteAccount(uid);
			assert(!await db.isSortedSetMember('users:postcount', uid));
			await Posts.purge(result.postData.pid, 1);
			assert(!await db.isSortedSetMember('users:postcount', uid));
		});

		it('should not re-add user to users:reputation if post is upvoted after user account deletion', async () => {
			const uid = await User.create({ username: 'olduserwithpostsupvote' });
			assert(await db.isSortedSetMember('users:reputation', uid));

			const result = await Topics.post({
				uid: uid,
				title: 'old user topic',
				content: 'old user topic post content',
				cid: testCid,
			});
			assert.equal(await db.sortedSetScore('users:reputation', uid), 0);
			await User.deleteAccount(uid);
			assert(!await db.isSortedSetMember('users:reputation', uid));
			await Posts.upvote(result.postData.pid, 1);
			assert(!await db.isSortedSetMember('users:reputation', uid));
		});

		it('should delete user even if they started a chat', async () => {
			const socketModules = require('../src/socket.io/modules');
			const uid1 = await User.create({ username: 'chatuserdelete1' });
			const uid2 = await User.create({ username: 'chatuserdelete2' });
			const roomId = await messaging.newRoom(uid1, { uids: [uid2] });
			await messaging.addMessage({
				uid: uid1,
				content: 'hello',
				roomId,
			});
			await messaging.leaveRoom([uid2], roomId);
			await User.delete(1, uid1);
			assert.strictEqual(await User.exists(uid1), false);
		});
	});

	describe('hash methods', () => {
		it('should return uid from email', (done) => {
			User.getUidByEmail('john@example.com', (err, uid) => {
				assert.ifError(err);
				assert.equal(parseInt(uid, 10), parseInt(testUid, 10));
				done();
			});
		});

		it('should return uid from username', (done) => {
			User.getUidByUsername('John Smith', (err, uid) => {
				assert.ifError(err);
				assert.equal(parseInt(uid, 10), parseInt(testUid, 10));
				done();
			});
		});

		it('should return uid from userslug', (done) => {
			User.getUidByUserslug('john-smith', (err, uid) => {
				assert.ifError(err);
				assert.equal(parseInt(uid, 10), parseInt(testUid, 10));
				done();
			});
		});

		it('should get user data even if one uid is NaN', (done) => {
			User.getUsersData([NaN, testUid], (err, data) => {
				assert.ifError(err);
				assert(data[0]);
				assert.equal(data[0].username, '[[global:guest]]');
				assert(data[1]);
				assert.equal(data[1].username, userData.username);
				done();
			});
		});

		it('should not return private user data', (done) => {
			User.setUserFields(testUid, {
				fb_token: '123123123',
				another_secret: 'abcde',
				postcount: '123',
			}, (err) => {
				assert.ifError(err);
				User.getUserData(testUid, (err, userData) => {
					assert.ifError(err);
					assert(!userData.hasOwnProperty('fb_token'));
					assert(!userData.hasOwnProperty('another_secret'));
					assert(!userData.hasOwnProperty('password'));
					assert(!userData.hasOwnProperty('rss_token'));
					assert.strictEqual(userData.postcount, 123);
					assert.strictEqual(userData.uid, testUid);
					done();
				});
			});
		});

		it('should not return password even if explicitly requested', (done) => {
			User.getUserFields(testUid, ['password'], (err, payload) => {
				assert.ifError(err);
				assert(!payload.hasOwnProperty('password'));
				done();
			});
		});

		it('should not modify the fields array passed in', async () => {
			const fields = ['username', 'email'];
			await User.getUserFields(testUid, fields);
			assert.deepStrictEqual(fields, ['username', 'email']);
		});

		it('should return an icon text and valid background if username and picture is explicitly requested', async () => {
			const payload = await User.getUserFields(testUid, ['username', 'picture']);
			const validBackgrounds = await User.getIconBackgrounds();
			assert.strictEqual(payload['icon:text'], userData.username.slice(0, 1).toUpperCase());
			assert(payload['icon:bgColor']);
			assert(validBackgrounds.includes(payload['icon:bgColor']));
		});

		it('should return a valid background, even if an invalid background colour is set', async () => {
			await User.setUserField(testUid, 'icon:bgColor', 'teal');
			const payload = await User.getUserFields(testUid, ['username', 'picture']);
			const validBackgrounds = await User.getIconBackgrounds();

			assert(payload['icon:bgColor']);
			assert(validBackgrounds.includes(payload['icon:bgColor']));
		});

		it('should return private data if field is whitelisted', (done) => {
			function filterMethod(data, callback) {
				data.whitelist.push('another_secret');
				callback(null, data);
			}

			plugins.hooks.register('test-plugin', { hook: 'filter:user.whitelistFields', method: filterMethod });
			User.getUserData(testUid, (err, userData) => {
				assert.ifError(err);
				assert(!userData.hasOwnProperty('fb_token'));
				assert.equal(userData.another_secret, 'abcde');
				plugins.hooks.unregister('test-plugin', 'filter:user.whitelistFields', filterMethod);
				done();
			});
		});

		it('should return 0 as uid if username is falsy', (done) => {
			User.getUidByUsername('', (err, uid) => {
				assert.ifError(err);
				assert.strictEqual(uid, 0);
				done();
			});
		});

		it('should get username by userslug', (done) => {
			User.getUsernameByUserslug('john-smith', (err, username) => {
				assert.ifError(err);
				assert.strictEqual('John Smith', username);
				done();
			});
		});

		it('should get uids by emails', (done) => {
			User.getUidsByEmails(['john@example.com'], (err, uids) => {
				assert.ifError(err);
				assert.equal(uids[0], testUid);
				done();
			});
		});

		it('should not get groupTitle for guests', (done) => {
			User.getUserData(0, (err, userData) => {
				assert.ifError(err);
				assert.strictEqual(userData.groupTitle, '');
				assert.deepStrictEqual(userData.groupTitleArray, []);
				done();
			});
		});

		it('should load guest data', (done) => {
			User.getUsersData([1, 0], (err, data) => {
				assert.ifError(err);
				assert.strictEqual(data[1].username, '[[global:guest]]');
				assert.strictEqual(data[1].userslug, '');
				assert.strictEqual(data[1].uid, 0);
				done();
			});
		});

		it('should return null if field or user doesn not exist', async () => {
			assert.strictEqual(await User.getUserField('1', 'doesnotexist'), null);
			assert.strictEqual(await User.getUserField('doesnotexistkey', 'doesnotexist'), null);
			assert.strictEqual(await User.getUserField('0', 'doesnotexist'), null);
		});
	});

	describe('profile methods', () => {
		let uid;
		let jar;
		let csrf_token;

		before(async () => {
			const newUid = await User.create({ username: 'updateprofile', email: 'update@me.com', password: '123456' });
			uid = newUid;

			await User.setUserField(uid, 'email', 'update@me.com');
			await User.email.confirmByUid(uid);

			({ jar, csrf_token } = await helpers.loginUser('updateprofile', '123456'));
		});

		it('should return error if not logged in', async () => {
			try {
				await apiUser.update({ uid: 0 }, { uid: 1 });
				assert(false);
			} catch (err) {
				assert.equal(err.message, '[[error:invalid-uid]]');
			}
		});

		it('should return error if data is invalid', async () => {
			try {
				await apiUser.update({ uid: uid }, null);
				assert(false);
			} catch (err) {
				assert.equal(err.message, '[[error:invalid-data]]');
			}
		});

		it('should return error if data is missing uid', async () => {
			try {
				await apiUser.update({ uid: uid }, { username: 'bip', email: 'bop' });
				assert(false);
			} catch (err) {
				assert.equal(err.message, '[[error:invalid-data]]');
			}
		});

		describe('.updateProfile()', () => {
			let uid;

			it('should update a user\'s profile', async () => {
				uid = await User.create({ username: 'justforupdate', email: 'just@for.updated', password: '123456' });
				await User.setUserField(uid, 'email', 'just@for.updated');
				await User.email.confirmByUid(uid);

				const data = {
					uid: uid,
					username: 'updatedUserName',
					email: 'updatedEmail@me.com',
					fullname: 'updatedFullname',
					groupTitle: 'testGroup',
					birthday: '01/01/1980',
					signature: 'nodebb is good',
					password: '123456',
				};
				const result = await apiUser.update({ uid: uid }, {
					...data, password: '123456', invalid: 'field',
				});
				assert.equal(result.username, 'updatedUserName');
				assert.equal(result.userslug, 'updatedusername');
				assert.equal(result.fullname, 'updatedFullname');

				const userData = await db.getObject(`user:${uid}`);
				Object.keys(data).forEach((key) => {
					if (key === 'email') {
						assert.strictEqual(userData.email, 'just@for.updated'); // email remains the same until confirmed
					} else if (key !== 'password') {
						assert.equal(data[key], userData[key]);
					} else {
						assert(userData[key].startsWith('$2b$'));
					}
				});
				// updateProfile only saves valid fields
				assert.strictEqual(userData.invalid, undefined);
			});

			it('should not change the username to escaped version', async () => {
				const uid = await User.create({
					username: 'ex\'ample_user', email: '13475@test.com', password: '123456',
				});
				await User.setUserField(uid, 'email', '13475@test.com');
				await User.email.confirmByUid(uid);

				const data = {
					uid: uid,
					username: 'ex\'ample_user',
					password: '123456',
				};
				const result = await apiUser.update({ uid: uid }, {
					...data, password: '123456', invalid: 'field',
				});
				const storedUsername = await db.getObjectField(`user:${uid}`, 'username');
				assert.equal(result.username, 'ex&#x27;ample_user');
				assert.equal(storedUsername, 'ex\'ample_user');
				assert.equal(result.userslug, 'ex-ample_user');
			});

			it('should also generate an email confirmation code for the changed email', async () => {
				const confirmSent = await User.email.isValidationPending(uid, 'updatedemail@me.com');
				assert.strictEqual(confirmSent, true);
			});
		});

		it('should change a user\'s password', async () => {
			const uid = await User.create({ username: 'changepassword', password: '123456' });
			await apiUser.changePassword({ uid: uid }, { uid: uid, newPassword: '654321', currentPassword: '123456' });
			const correct = await User.isPasswordCorrect(uid, '654321', '127.0.0.1');
			assert(correct);
		});

		it('should not let user change their password to their current password', async () => {
			const uid = await User.create({ username: 'changepasswordsame', password: '123456' });
			await assert.rejects(
				apiUser.changePassword({ uid: uid }, {
					uid: uid,
					newPassword: '123456',
					currentPassword: '123456',
				}),
				{ message: '[[user:change-password-error-same-password]]' },
			);
		});

		it('should not let user change another user\'s password', async () => {
			const regularUserUid = await User.create({ username: 'regularuserpwdchange', password: 'regularuser1234' });
			const uid = await User.create({ username: 'changeadminpwd1', password: '123456' });
			try {
				await apiUser.changePassword({ uid: uid }, { uid: regularUserUid, newPassword: '654321', currentPassword: '123456' });
				assert(false);
			} catch (err) {
				assert.equal(err.message, '[[user:change-password-error-privileges]]');
			}
		});

		it('should not let user change admin\'s password', async () => {
			const adminUid = await User.create({ username: 'adminpwdchange', password: 'admin1234' });
			await groups.join('administrators', adminUid);
			const uid = await User.create({ username: 'changeadminpwd2', password: '123456' });
			try {
				await apiUser.changePassword({ uid: uid }, { uid: adminUid, newPassword: '654321', currentPassword: '123456' });
				assert(false);
			} catch (err) {
				assert.equal(err.message, '[[user:change-password-error-privileges]]');
			}
		});

		it('should let admin change another users password', async () => {
			const adminUid = await User.create({ username: 'adminpwdchange2', password: 'admin1234' });
			await groups.join('administrators', adminUid);
			const uid = await User.create({ username: 'forgotmypassword', password: '123456' });

			await apiUser.changePassword({ uid: adminUid }, { uid: uid, newPassword: '654321' });
			const correct = await User.isPasswordCorrect(uid, '654321', '127.0.0.1');
			assert(correct);
		});

		it('should not let admin change their password if current password is incorrect', async () => {
			const adminUid = await User.create({ username: 'adminforgotpwd', password: 'admin1234' });
			await groups.join('administrators', adminUid);

			try {
				await apiUser.changePassword({ uid: adminUid }, { uid: adminUid, newPassword: '654321', currentPassword: 'wrongpwd' });
				assert(false);
			} catch (err) {
				assert.equal(err.message, '[[user:change-password-error-wrong-current]]');
			}
		});

		it('should change username', async () => {
			await apiUser.update({ uid: uid }, { uid: uid, username: 'updatedAgain', password: '123456' });
			const username = await db.getObjectField(`user:${uid}`, 'username');
			assert.equal(username, 'updatedAgain');
		});

		it('should not let setting an empty username', async () => {
			await apiUser.update({ uid: uid }, { uid: uid, username: '', password: '123456' });
			const username = await db.getObjectField(`user:${uid}`, 'username');
			assert.strictEqual(username, 'updatedAgain');
		});

		it('should let updating profile if current username is above max length and it is not being changed', async () => {
			const maxLength = meta.config.maximumUsernameLength + 1;
			const longName = new Array(maxLength).fill('a').join('');
			const uid = await User.create({ username: longName });
			await apiUser.update({ uid: uid }, { uid: uid, username: longName, email: 'verylong@name.com' });
			const userData = await db.getObject(`user:${uid}`);
			const awaitingValidation = await User.email.isValidationPending(uid, 'verylong@name.com');

			assert.strictEqual(userData.username, longName);
			assert.strictEqual(awaitingValidation, true);
		});

		it('should not update a user\'s username if it did not change', async () => {
			await apiUser.update({ uid: uid }, { uid: uid, username: 'updatedAgain', password: '123456' });
			const data = await db.getSortedSetRevRange(`user:${uid}:usernames`, 0, -1);
			assert.equal(data.length, 2);
			assert(data[0].startsWith('updatedAgain'));
		});

		it('should not update a user\'s username if a password is not supplied', async () => {
			try {
				await apiUser.update({ uid: uid }, { uid: uid, username: 'updatedAgain', password: '' });
				assert(false);
			} catch (err) {
				assert.strictEqual(err.message, '[[error:invalid-password]]');
			}
		});

		it('should properly change username and clean up old sorted sets', async () => {
			const uid = await User.create({ username: 'DennyO', password: '123456' });
			let usernames = await db.getSortedSetRevRangeWithScores('username:uid', 0, -1);
			usernames = usernames.filter(d => d.score === uid);
			assert.deepStrictEqual(usernames, [{ value: 'DennyO', score: uid }]);

			await apiUser.update({ uid: uid }, { uid: uid, username: 'DennyO\'s', password: '123456' });
			usernames = await db.getSortedSetRevRangeWithScores('username:uid', 0, -1);
			usernames = usernames.filter(d => d.score === uid);
			assert.deepStrictEqual(usernames, [{ value: 'DennyO\'s', score: uid }]);

			await apiUser.update({ uid: uid }, { uid: uid, username: 'Denny O', password: '123456' });
			usernames = await db.getSortedSetRevRangeWithScores('username:uid', 0, -1);
			usernames = usernames.filter(d => d.score === uid);
			assert.deepStrictEqual(usernames, [{ value: 'Denny O', score: uid }]);
		});

		it('should send validation email', async () => {
			const uid = await User.create({ username: 'pooremailupdate', email: 'poor@update.me', password: '123456' });
			await User.email.expireValidation(uid);
			await apiUser.update({ uid: uid }, { uid: uid, email: 'updatedAgain@me.com', password: '123456' });

			assert.strictEqual(await User.email.isValidationPending(uid, 'updatedAgain@me.com'.toLowerCase()), true);
		});

		it('should update cover image', (done) => {
			const position = '50.0301% 19.2464%';
			socketUser.updateCover({ uid: uid }, { uid: uid, imageData: goodImage, position: position }, (err, result) => {
				assert.ifError(err);
				assert(result.url);
				db.getObjectFields(`user:${uid}`, ['cover:url', 'cover:position'], (err, data) => {
					assert.ifError(err);
					assert.equal(data['cover:url'], result.url);
					assert.equal(data['cover:position'], position);
					done();
				});
			});
		});

		it('should remove cover image', async () => {
			const coverPath = await User.getLocalCoverPath(uid);
			await socketUser.removeCover({ uid: uid }, { uid: uid });
			const coverUrlNow = await db.getObjectField(`user:${uid}`, 'cover:url');
			assert.strictEqual(coverUrlNow, null);
			assert.strictEqual(fs.existsSync(coverPath), false);
		});

		it('should set user status', (done) => {
			socketUser.setStatus({ uid: uid }, 'away', (err, data) => {
				assert.ifError(err);
				assert.equal(data.uid, uid);
				assert.equal(data.status, 'away');
				done();
			});
		});

		it('should fail for invalid status', (done) => {
			socketUser.setStatus({ uid: uid }, '12345', (err) => {
				assert.equal(err.message, '[[error:invalid-user-status]]');
				done();
			});
		});

		it('should get user status', (done) => {
			socketUser.checkStatus({ uid: uid }, uid, (err, status) => {
				assert.ifError(err);
				assert.equal(status, 'away');
				done();
			});
		});

		it('should change user picture', async () => {
			await apiUser.changePicture({ uid: uid }, { type: 'default', uid: uid });
			const picture = await User.getUserField(uid, 'picture');
			assert.equal(picture, '');
		});

		it('should let you set an external image', async () => {
			const token = await helpers.getCsrfToken(jar);
			const { body } = await request.put(`${nconf.get('url')}/api/v3/users/${uid}/picture`, {
				jar,
				headers: {
					'x-csrf-token': token,
				},
				body: {
					type: 'external',
					url: 'https://example.org/picture.jpg',
				},
			});

			assert(body && body.status && body.response);
			assert.strictEqual(body.status.code, 'ok');

			const picture = await User.getUserField(uid, 'picture');
			assert.strictEqual(picture, validator.escape('https://example.org/picture.jpg'));
		});

		it('should fail to change user picture with invalid data', async () => {
			try {
				await apiUser.changePicture({ uid: uid }, null);
				assert(false);
			} catch (err) {
				assert.equal(err.message, '[[error:invalid-data]]');
			}
		});

		it('should fail to change user picture with invalid uid', async () => {
			try {
				await apiUser.changePicture({ uid: 0 }, { uid: 1 });
				assert(false);
			} catch (err) {
				assert.equal(err.message, '[[error:no-privileges]]');
			}
		});

		it('should set user picture to uploaded', async () => {
			await User.setUserField(uid, 'uploadedpicture', '/test');
			await apiUser.changePicture({ uid: uid }, { type: 'uploaded', uid: uid });
			const picture = await User.getUserField(uid, 'picture');
			assert.equal(picture, `${nconf.get('relative_path')}/test`);
		});

		it('should return error if profile image uploads disabled', (done) => {
			meta.config.allowProfileImageUploads = 0;
			const picture = {
				path: path.join(nconf.get('base_dir'), 'test/files/test_copy.png'),
				size: 7189,
				name: 'test.png',
				type: 'image/png',
			};
			User.uploadCroppedPicture({
				callerUid: uid,
				uid: uid,
				file: picture,
			}, (err) => {
				assert.equal(err.message, '[[error:profile-image-uploads-disabled]]');
				meta.config.allowProfileImageUploads = 1;
				done();
			});
		});

		it('should return error if profile image has no mime type', (done) => {
			User.uploadCroppedPicture({
				callerUid: uid,
				uid: uid,
				imageData: 'data:image/invalid;base64,R0lGODlhPQBEAPeoAJosM/',
			}, (err) => {
				assert.equal(err.message, '[[error:invalid-image]]');
				done();
			});
		});

		describe('user.uploadCroppedPicture', () => {
			const badImage = 'data:audio/mp3;base64,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';

			it('should upload cropped profile picture', async () => {
				const result = await socketUser.uploadCroppedPicture({ uid: uid }, { uid: uid, imageData: goodImage });
				assert(result.url);
				const data = await db.getObjectFields(`user:${uid}`, ['uploadedpicture', 'picture']);
				assert.strictEqual(result.url, data.uploadedpicture);
				assert.strictEqual(result.url, data.picture);
			});

			it('should upload cropped profile picture in chunks', async () => {
				const socketUploads = require('../src/socket.io/uploads');
				const socketData = {
					uid,
					method: 'user.uploadCroppedPicture',
					size: goodImage.length,
					progress: 0,
				};
				const chunkSize = 1000;
				let result;
				do {
					const chunk = goodImage.slice(socketData.progress, socketData.progress + chunkSize);
					socketData.progress += chunk.length;
					// eslint-disable-next-line
					result = await socketUploads.upload({ uid: uid }, {
						chunk: chunk,
						params: socketData,
					});
				} while (socketData.progress < socketData.size);

				assert(result.url);
				const data = await db.getObjectFields(`user:${uid}`, ['uploadedpicture', 'picture']);
				assert.strictEqual(result.url, data.uploadedpicture);
				assert.strictEqual(result.url, data.picture);
			});

			it('should error if both file and imageData are missing', (done) => {
				User.uploadCroppedPicture({}, (err) => {
					assert.equal('[[error:invalid-data]]', err.message);
					done();
				});
			});

			it('should error if file size is too big', (done) => {
				const temp = meta.config.maximumProfileImageSize;
				meta.config.maximumProfileImageSize = 1;
				User.uploadCroppedPicture({
					callerUid: uid,
					uid: 1,
					imageData: goodImage,
				}, (err) => {
					assert.equal('[[error:file-too-big, 1]]', err.message);

					// Restore old value
					meta.config.maximumProfileImageSize = temp;
					done();
				});
			});

			it('should not allow image data with bad MIME type to be passed in', (done) => {
				User.uploadCroppedPicture({
					callerUid: uid,
					uid: 1,
					imageData: badImage,
				}, (err) => {
					assert.equal('[[error:invalid-image]]', err.message);
					done();
				});
			});

			it('should get profile pictures', (done) => {
				socketUser.getProfilePictures({ uid: uid }, { uid: uid }, (err, data) => {
					assert.ifError(err);
					assert(data);
					assert(Array.isArray(data));
					assert.equal(data[0].type, 'default');
					assert.equal(data[0].username, '[[user:default-picture]]');
					assert.equal(data[1].type, 'uploaded');
					assert.equal(data[1].username, '[[user:uploaded-picture]]');
					done();
				});
			});

			it('should get default profile avatar', (done) => {
				assert.strictEqual(User.getDefaultAvatar(), '');
				meta.config.defaultAvatar = 'https://path/to/default/avatar';
				assert.strictEqual(User.getDefaultAvatar(), meta.config.defaultAvatar);
				meta.config.defaultAvatar = '/path/to/default/avatar';
				assert.strictEqual(User.getDefaultAvatar(), nconf.get('relative_path') + meta.config.defaultAvatar);
				meta.config.defaultAvatar = '';
				done();
			});

			it('should fail to get profile pictures with invalid data', (done) => {
				socketUser.getProfilePictures({ uid: uid }, null, (err) => {
					assert.equal(err.message, '[[error:invalid-data]]');
					socketUser.getProfilePictures({ uid: uid }, { uid: null }, (err) => {
						assert.equal(err.message, '[[error:invalid-data]]');
						done();
					});
				});
			});

			it('should remove uploaded picture', async () => {
				const avatarPath = await User.getLocalAvatarPath(uid);
				assert.notStrictEqual(avatarPath, false);
				await socketUser.removeUploadedPicture({ uid: uid }, { uid: uid });
				const uploadedPicture = await User.getUserField(uid, 'uploadedpicture');
				assert.strictEqual(uploadedPicture, '');
				assert.strictEqual(fs.existsSync(avatarPath), false);
			});

			it('should fail to remove uploaded picture with invalid-data', (done) => {
				socketUser.removeUploadedPicture({ uid: uid }, null, (err) => {
					assert.equal(err.message, '[[error:invalid-data]]');
					socketUser.removeUploadedPicture({ uid: uid }, { }, (err) => {
						assert.equal(err.message, '[[error:invalid-data]]');
						socketUser.removeUploadedPicture({ uid: null }, { }, (err) => {
							assert.equal(err.message, '[[error:invalid-data]]');
							done();
						});
					});
				});
			});
		});

		it('should load profile page', async () => {
			const { response, body } = await request.get(`${nconf.get('url')}/api/user/updatedagain`, { jar });
			assert.equal(response.statusCode, 200);
			assert(body);
		});

		it('should load settings page', async () => {
			const { response, body } = await request.get(`${nconf.get('url')}/api/user/updatedagain/settings`, { jar });
			assert.equal(response.statusCode, 200);
			assert(body.settings);
			assert(body.languages);
			assert(body.homePageRoutes);
		});

		it('should load edit page', async () => {
			const { response, body } = await request.get(`${nconf.get('url')}/api/user/updatedagain/edit`, { jar });
			assert.equal(response.statusCode, 200);
			assert(body);
		});

		it('should load edit/email page', async () => {
			const { response, body } = await request.get(`${nconf.get('url')}/api/user/updatedagain/edit/email`, { jar });
			assert.strictEqual(response.statusCode, 200);
			assert(body);

			// Accessing this page will mark the user's account as needing an updated email, below code undo's.
			await request.post(`${nconf.get('url')}/register/abort`, {
				jar,
				headers: {
					'x-csrf-token': csrf_token,
				},
			});
		});

		it('should load user\'s groups page', async () => {
			await groups.create({
				name: 'Test',
				description: 'Foobar!',
			});

			await groups.join('Test', uid);
			const { body } = await request.get(`${nconf.get('url')}/api/user/updatedagain/groups`, { jar });

			assert(Array.isArray(body.groups));
			assert.equal(body.groups[0].name, 'Test');
		});
	});

	describe('user info', () => {
		let testUserUid;
		let verifiedTestUserUid;

		before(async () => {
			// Might be the first user thus a verified one if this test part is ran alone
			verifiedTestUserUid = await User.create({ username: 'bannedUser', password: '123456', email: 'banneduser@example.com' });
			await User.setUserField(verifiedTestUserUid, 'email:confirmed', 1);
			testUserUid = await User.create({ username: 'bannedUser2', password: '123456', email: 'banneduser2@example.com' });
		});

		it('should return error if there is no ban reason', (done) => {
			User.getLatestBanInfo(123, (err) => {
				assert.equal(err.message, 'no-ban-info');
				done();
			});
		});

		it('should get history from set', async () => {
			const now = Date.now();
			await db.sortedSetAdd(`user:${testUserUid}:usernames`, now, `derp:${now}`);
			const data = await User.getHistory(`user:${testUserUid}:usernames`);
			assert.equal(data[0].value, 'derp');
			assert.equal(data[0].timestamp, now);
		});

		it('should return the correct ban reason', async () => {
			await User.bans.ban(testUserUid, 0, '');
			const data = await User.getModerationHistory(testUserUid);
			assert.equal(data.bans.length, 1, 'one ban');
			assert.equal(data.bans[0].reason, '[[user:info.banned-no-reason]]', 'no ban reason');
			await User.bans.unban(testUserUid);
		});

		it('should ban user permanently', (done) => {
			User.bans.ban(testUserUid, (err) => {
				assert.ifError(err);
				User.bans.isBanned(testUserUid, (err, isBanned) => {
					assert.ifError(err);
					assert.equal(isBanned, true);
					User.bans.unban(testUserUid, done);
				});
			});
		});

		it('should ban user temporarily', async () => {
			await User.bans.ban(testUserUid, Date.now() + 2000);
			let isBanned = await User.bans.isBanned(testUserUid);
			assert.equal(isBanned, true);
			await setTimeout(3000);
			isBanned = await User.bans.isBanned(testUserUid);
			assert.equal(isBanned, false);
			await User.bans.unban(testUserUid);
		});

		it('should error if until is NaN', (done) => {
			User.bans.ban(testUserUid, 'asd', (err) => {
				assert.equal(err.message, '[[error:ban-expiry-missing]]');
				done();
			});
		});

		it('should be member of "banned-users" system group only after a ban', async () => {
			await User.bans.ban(testUserUid);

			const systemGroups = groups.systemGroups.filter(group => group !== groups.BANNED_USERS);
			const isMember = await groups.isMember(testUserUid, groups.BANNED_USERS);
			const isMemberOfAny = await groups.isMemberOfAny(testUserUid, systemGroups);

			assert.strictEqual(isMember, true);
			assert.strictEqual(isMemberOfAny, false);
		});

		it('should restore system group memberships after an unban (for an unverified user)', async () => {
			await User.bans.unban(testUserUid);

			const isMemberOfGroups = await groups.isMemberOfGroups(testUserUid, groups.systemGroups);
			const membership = new Map(groups.systemGroups.map((item, index) => [item, isMemberOfGroups[index]]));

			assert.strictEqual(membership.get('registered-users'), true);
			assert.strictEqual(membership.get('verified-users'), false);
			assert.strictEqual(membership.get('unverified-users'), true);
			assert.strictEqual(membership.get(groups.BANNED_USERS), false);
			// administrators cannot be banned
			assert.strictEqual(membership.get('administrators'), false);
			// This will not restored
			assert.strictEqual(membership.get('Global Moderators'), false);
		});

		it('should restore system group memberships after an unban (for a verified user)', async () => {
			await User.bans.ban(verifiedTestUserUid);
			await User.bans.unban(verifiedTestUserUid);

			const isMemberOfGroups = await groups.isMemberOfGroups(verifiedTestUserUid, groups.systemGroups);
			const membership = new Map(groups.systemGroups.map((item, index) => [item, isMemberOfGroups[index]]));

			assert.strictEqual(membership.get('verified-users'), true);
			assert.strictEqual(membership.get('unverified-users'), false);
		});

		it('should be able to post in category for banned users', async () => {
			const { cid } = await Categories.create({
				name: 'Test Category',
				description: 'A test',
				order: 1,
			});
			const testUid = await User.create({ username: userData.username });
			await User.bans.ban(testUid);
			let _err;
			try {
				await Topics.post({ title: 'banned topic', content: 'tttttttttttt', cid: cid, uid: testUid });
			} catch (err) {
				_err = err;
			}
			assert.strictEqual(_err && _err.message, '[[error:no-privileges]]');

			await Promise.all([
				privileges.categories.give(['groups:topics:create', 'groups:topics:reply'], cid, 'banned-users'),
				privileges.categories.rescind(['groups:topics:create', 'groups:topics:reply'], cid, 'registered-users'),
			]);

			const result = await Topics.post({ title: 'banned topic', content: 'tttttttttttt', cid: cid, uid: testUid });
			assert(result);
			assert.strictEqual(result.topicData.title, 'banned topic');
		});
	});

	describe('Digest.getSubscribers', () => {
		const uidIndex = {};

		before(async () => {
			const testUsers = ['daysub', 'offsub', 'nullsub', 'weeksub'];
			await Promise.all(testUsers.map(async (username) => {
				const uid = await User.create({ username, email: `${username}@example.com` });
				if (username === 'nullsub') {
					return;
				}
				uidIndex[username] = uid;

				const sub = username.slice(0, -3);
				await User.updateDigestSetting(uid, sub);
				await User.setSetting(uid, 'dailyDigestFreq', sub);
			}));
		});

		it('should accurately build digest list given ACP default "null" (not set)', (done) => {
			User.digest.getSubscribers('day', (err, subs) => {
				assert.ifError(err);
				assert.strictEqual(subs.length, 1);

				done();
			});
		});

		it('should accurately build digest list given ACP default "day"', async () => {
			await meta.configs.set('dailyDigestFreq', 'day');
			const subs = await User.digest.getSubscribers('day');

			assert.strictEqual(subs.includes(uidIndex.daysub.toString()), true); // daysub does get emailed
			assert.strictEqual(subs.includes(uidIndex.weeksub.toString()), false); // weeksub does not get emailed
			assert.strictEqual(subs.includes(uidIndex.offsub.toString()), false); // offsub doesn't get emailed
		});

		it('should accurately build digest list given ACP default "week"', async () => {
			await meta.configs.set('dailyDigestFreq', 'week');
			const subs = await User.digest.getSubscribers('week');

			assert.strictEqual(subs.includes(uidIndex.weeksub.toString()), true); // weeksub gets emailed
			assert.strictEqual(subs.includes(uidIndex.daysub.toString()), false); // daysub gets emailed
			assert.strictEqual(subs.includes(uidIndex.offsub.toString()), false); // offsub does not get emailed
		});

		it('should accurately build digest list given ACP default "off"', async () => {
			await meta.configs.set('dailyDigestFreq', 'off');
			const subs = await User.digest.getSubscribers('day');
			assert.strictEqual(subs.length, 1);
		});
	});

	describe('digests', () => {
		let uid;
		before(async () => {
			uid = await User.create({ username: 'digestuser', email: 'test@example.com' });
			await User.updateDigestSetting(uid, 'day');
			await User.setSetting(uid, 'dailyDigestFreq', 'day');
			await User.setSetting(uid, 'notificationType_test', 'notificationemail');
		});

		it('should send digests', async () => {
			const oldValue = meta.config.includeUnverifiedEmails;
			meta.config.includeUnverifiedEmails = true;
			const uid = await User.create({ username: 'digest' });
			await User.setUserField(uid, 'email', 'email@test.com');
			await User.email.confirmByUid(uid);
			await User.digest.execute({
				interval: 'day',
				subscribers: [uid],
			});
			meta.config.includeUnverifiedEmails = oldValue;
		});

		it('should return 0', async () => {
			const sent = await User.digest.send({ subscribers: [] });
			assert.strictEqual(sent, 0);
		});

		it('should get users with single uid', async () => {
			const res = await User.digest.getUsersInterval(1);
			assert.strictEqual(res, false);
		});

		it('should not send digests', async () => {
			const oldValue = meta.config.disableEmailSubsriptions;
			meta.config.disableEmailSubsriptions = 1;
			const res = await User.digest.execute({});
			assert.strictEqual(res, false);
			meta.config.disableEmailSubsriptions = oldValue;
		});

		it('should not send digests', async () => {
			await User.digest.execute({ interval: 'month' });
		});

		it('should get delivery times', async () => {
			const data = await User.digest.getDeliveryTimes(0, -1);
			const users = data.users.filter(u => u.username === 'digestuser');
			assert.strictEqual(users[0].setting, 'day');
		});

		describe('unsubscribe via POST', () => {
			it('should unsubscribe from digest if one-click unsubscribe is POSTed', async () => {
				const token = jwt.sign({
					template: 'digest',
					uid: uid,
				}, nconf.get('secret'));

				const { response } = await request.post(`${nconf.get('url')}/email/unsubscribe/${token}`);
				assert.strictEqual(response.statusCode, 200);
				const value = await db.getObjectField(`user:${uid}:settings`, 'dailyDigestFreq');
				assert.strictEqual(value, 'off');
			});

			it('should unsubscribe from notifications if one-click unsubscribe is POSTed', async () => {
				const token = jwt.sign({
					template: 'notification',
					type: 'test',
					uid: uid,
				}, nconf.get('secret'));

				const { response } = await request.post(`${nconf.get('url')}/email/unsubscribe/${token}`);
				assert.strictEqual(response.statusCode, 200);

				const value = await db.getObjectField(`user:${uid}:settings`, 'notificationType_test');
				assert.strictEqual(value, 'notification');
			});

			it('should return errors on missing template in token', async () => {
				const token = jwt.sign({
					uid: uid,
				}, nconf.get('secret'));

				const { response } = await request.post(`${nconf.get('url')}/email/unsubscribe/${token}`);
				assert.strictEqual(response.statusCode, 404);
			});

			it('should return errors on wrong template in token', async () => {
				const token = jwt.sign({
					template: 'user',
					uid: uid,
				}, nconf.get('secret'));

				const { response } = await request.post(`${nconf.get('url')}/email/unsubscribe/${token}`);
				assert.strictEqual(response.statusCode, 404);
			});

			it('should return errors on missing token', async () => {
				const { response } = await request.post(`${nconf.get('url')}/email/unsubscribe/`);
				assert.strictEqual(response.statusCode, 404);
			});

			it('should return errors on token signed with wrong secret (verify-failure)', async () => {
				const token = jwt.sign({
					template: 'notification',
					type: 'test',
					uid: uid,
				}, `${nconf.get('secret')}aababacaba`);

				const { response } = await request.post(`${nconf.get('url')}/email/unsubscribe/${token}`);
				assert.strictEqual(response.statusCode, 403);
			});
		});
	});

	describe('socket methods', () => {
		const socketUser = require('../src/socket.io/user');
		let delUid;

		it('should fail with invalid data', (done) => {
			meta.userOrGroupExists(null, (err) => {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('should return true/false if user/group exists or not', async () => {
			assert.strictEqual(await meta.userOrGroupExists('registered-users'), true);
			assert.strictEqual(await meta.userOrGroupExists('John Smith'), true);
			assert.strictEqual(await meta.userOrGroupExists('doesnot exist'), false);
			assert.deepStrictEqual(await meta.userOrGroupExists(['doesnot exist', 'nope not here']), [false, false]);
			assert.deepStrictEqual(await meta.userOrGroupExists(['doesnot exist', 'John Smith']), [false, true]);
			assert.deepStrictEqual(await meta.userOrGroupExists(['administrators', 'John Smith']), [true, true]);

			await assert.rejects(
				meta.userOrGroupExists(['', undefined]),
				{ message: '[[error:invalid-data]]' },
			);
		});

		it('should delete user', async () => {
			delUid = await User.create({ username: 'willbedeleted' });

			// Upload some avatars and covers before deleting
			meta.config['profile:keepAllUserImages'] = 1;
			let result = await socketUser.uploadCroppedPicture({ uid: delUid }, { uid: delUid, imageData: goodImage });
			assert(result.url);
			result = await socketUser.uploadCroppedPicture({ uid: delUid }, { uid: delUid, imageData: goodImage });
			assert(result.url);

			const position = '50.0301% 19.2464%';
			result = await socketUser.updateCover({ uid: delUid }, { uid: delUid, imageData: goodImage, position: position });
			assert(result.url);
			result = await socketUser.updateCover({ uid: delUid }, { uid: delUid, imageData: goodImage, position: position });
			assert(result.url);
			meta.config['profile:keepAllUserImages'] = 0;

			await apiUser.deleteAccount({ uid: delUid }, { uid: delUid });
			const exists = await meta.userOrGroupExists('willbedeleted');
			assert(!exists);
		});

		it('should clean profile images after account deletion', () => {
			const allProfileFiles = fs.readdirSync(path.join(nconf.get('upload_path'), 'profile'));
			const deletedUserImages = allProfileFiles.filter(
				f => f.startsWith(`${delUid}-profilecover`) || f.startsWith(`${delUid}-profileavatar`)
			);
			assert.strictEqual(deletedUserImages.length, 0);
		});

		it('should fail to delete user with wrong password', async () => {
			const uid = await User.create({ username: 'willbedeletedpwd', password: '123456' });
			try {
				await apiUser.deleteAccount({ uid: uid }, { uid: uid, password: '654321' });
				assert(false);
			} catch (err) {
				assert.strictEqual(err.message, '[[error:invalid-password]]');
			}
		});

		it('should delete user with correct password', async () => {
			const uid = await User.create({ username: 'willbedeletedcorrectpwd', password: '123456' });
			await apiUser.deleteAccount({ uid: uid }, { uid: uid, password: '123456' });
			const exists = await User.exists(uid);
			assert(!exists);
		});

		it('should fail to delete user if account deletion is not allowed', async () => {
			const oldValue = meta.config.allowAccountDelete;
			meta.config.allowAccountDelete = 0;
			const uid = await User.create({ username: 'tobedeleted' });
			try {
				await apiUser.deleteAccount({ uid: uid }, { uid: uid });
				assert(false);
			} catch (err) {
				assert.strictEqual(err.message, '[[error:account-deletion-disabled]]');
			}
			meta.config.allowAccountDelete = oldValue;
		});

		it('should send reset email', (done) => {
			socketUser.reset.send({ uid: 0 }, 'john@example.com', (err) => {
				assert.ifError(err);
				done();
			});
		});

		it('should return invalid-data error', (done) => {
			socketUser.reset.send({ uid: 0 }, null, (err) => {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('should not error', (done) => {
			socketUser.reset.send({ uid: 0 }, 'doestnot@exist.com', (err) => {
				assert.ifError(err);
				done();
			});
		});

		it('should commit reset', (done) => {
			db.getObject('reset:uid', (err, data) => {
				assert.ifError(err);
				const code = Object.keys(data).find(code => parseInt(data[code], 10) === parseInt(testUid, 10));
				socketUser.reset.commit({ uid: 0 }, { code: code, password: 'pwdchange' }, (err) => {
					assert.ifError(err);
					done();
				});
			});
		});

		it('should save user settings', async () => {
			const data = {
				uid: testUid,
				settings: {
					bootswatchSkin: 'default',
					homePageRoute: 'none',
					homePageCustom: '',
					openOutgoingLinksInNewTab: 0,
					scrollToMyPost: 1,
					userLang: 'en-GB',
					usePagination: 1,
					topicsPerPage: '10',
					postsPerPage: '5',
					showemail: 1,
					showfullname: 1,
					disableIncomingMessages: 0,
					followTopicsOnCreate: 1,
					followTopicsOnReply: 1,
				},
			};
			await apiUser.updateSettings({ uid: testUid }, data);
			const userSettings = await User.getSettings(testUid);
			assert.strictEqual(userSettings.usePagination, true);
		});

		it('should properly escape homePageRoute', async () => {
			const data = {
				uid: testUid,
				settings: {
					bootswatchSkin: 'default',
					homePageRoute: 'category/6/testing-ground',
					homePageCustom: '',
					openOutgoingLinksInNewTab: 0,
					scrollToMyPost: 1,
					userLang: 'en-GB',
					usePagination: 1,
					topicsPerPage: '10',
					postsPerPage: '5',
					showemail: 1,
					showfullname: 1,
					disableIncomingMessages: 0,
					followTopicsOnCreate: 1,
					followTopicsOnReply: 1,
				},
			};
			await apiUser.updateSettings({ uid: testUid }, data);
			const userSettings = await User.getSettings(testUid);
			assert.strictEqual(userSettings.homePageRoute, 'category/6/testing-ground');
		});


		it('should error if language is invalid', async () => {
			const data = {
				uid: testUid,
				settings: {
					userLang: '<invalid-string>',
					topicsPerPage: '10',
					postsPerPage: '5',
				},
			};
			try {
				await apiUser.updateSettings({ uid: testUid }, data);
				assert(false);
			} catch (err) {
				assert.equal(err.message, '[[error:invalid-language]]');
			}
		});

		it('should set moderation note', async () => {
			const adminUid = await User.create({ username: 'noteadmin' });
			await groups.join('administrators', adminUid);
			await socketUser.setModerationNote({ uid: adminUid }, { uid: testUid, note: 'this is a test user' });
			await setTimeout(50);
			await socketUser.setModerationNote({ uid: adminUid }, { uid: testUid, note: '<svg/onload=alert(document.location);//' });
			const notes = await User.getModerationNotes(testUid, 0, -1);
			assert.equal(notes[0].note, '');
			assert.equal(notes[0].uid, adminUid);
			assert.equal(notes[1].note, 'this is a test user');
			assert(notes[0].timestamp);
		});

		it('should get unread count 0 for guest', async () => {
			const count = await socketUser.getUnreadCount({ uid: 0 });
			assert.strictEqual(count, 0);
		});

		it('should get unread count for user', async () => {
			const count = await socketUser.getUnreadCount({ uid: testUid });
			assert.strictEqual(count, 4);
		});

		it('should get unread chat count 0 for guest', async () => {
			const count = await socketUser.getUnreadChatCount({ uid: 0 });
			assert.strictEqual(count, 0);
		});

		it('should get unread chat count for user', async () => {
			const count = await socketUser.getUnreadChatCount({ uid: testUid });
			assert.strictEqual(count, 0);
		});

		it('should get unread counts 0 for guest', async () => {
			const counts = await socketUser.getUnreadCounts({ uid: 0 });
			assert.deepStrictEqual(counts, {});
		});

		it('should get unread counts for user', async () => {
			const counts = await socketUser.getUnreadCounts({ uid: testUid });
			assert.deepStrictEqual(counts, {
				unreadChatCount: 0,
				unreadCounts: {
					'': 4,
					new: 4,
					unreplied: 4,
					watched: 0,
				},
				unreadNewTopicCount: 4,
				unreadNotificationCount: 0,
				unreadTopicCount: 4,
				unreadUnrepliedTopicCount: 4,
				unreadWatchedTopicCount: 0,
			});
		});

		it('should get user data by uid', async () => {
			const userData = await socketUser.getUserByUID({ uid: testUid }, testUid);
			assert.strictEqual(userData.uid, testUid);
		});

		it('should get user data by username', async () => {
			const userData = await socketUser.getUserByUsername({ uid: testUid }, 'John Smith');
			assert.strictEqual(userData.uid, testUid);
		});

		it('should get user data by email', async () => {
			const userData = await socketUser.getUserByEmail({ uid: testUid }, 'john@example.com');
			assert.strictEqual(userData.uid, testUid);
		});

		it('should check/consent gdpr status', async () => {
			const consent = await socketUser.gdpr.check({ uid: testUid }, { uid: testUid });
			assert(!consent);
			await socketUser.gdpr.consent({ uid: testUid });
			const consentAfter = await socketUser.gdpr.check({ uid: testUid }, { uid: testUid });
			assert(consentAfter);
		});
	});

	describe('approval queue', () => {
		let oldRegistrationApprovalType;
		let adminUid;
		before((done) => {
			oldRegistrationApprovalType = meta.config.registrationApprovalType;
			meta.config.registrationApprovalType = 'admin-approval';
			User.create({ username: 'admin', password: '123456' }, (err, uid) => {
				assert.ifError(err);
				adminUid = uid;
				groups.join('administrators', uid, done);
			});
		});

		after((done) => {
			meta.config.registrationApprovalType = oldRegistrationApprovalType;
			done();
		});

		it('should add user to approval queue', async () => {
			await helpers.registerUser({
				username: 'rejectme',
				password: '123456',
				'password-confirm': '123456',
				email: '<script>alert("ok")<script>reject@me.com',
				gdpr_consent: true,
			});
			const { jar } = await helpers.loginUser('admin', '123456');
			const { body: { users } } = await request.get(`${nconf.get('url')}/api/admin/manage/registration`, { jar });
			assert.equal(users[0].username, 'rejectme');
			assert.equal(users[0].email, '&lt;script&gt;alert(&quot;ok&quot;)&lt;script&gt;reject@me.com');
		});

		it('should fail to add user to queue if username is taken', async () => {
			const { body } = await helpers.registerUser({
				username: 'rejectme',
				password: '123456',
				'password-confirm': '123456',
				email: '<script>alert("ok")<script>reject@me.com',
				gdpr_consent: true,
			});
			assert.equal(body, '[[error:username-taken]]');
		});

		it('should fail to add user to queue if email is taken', async () => {
			const { body } = await helpers.registerUser({
				username: 'rejectmenew',
				password: '123456',
				'password-confirm': '123456',
				email: '<script>alert("ok")<script>reject@me.com',
				gdpr_consent: true,
			});
			assert.equal(body, '[[error:email-taken]]');
		});

		it('should reject user registration', async () => {
			await socketUser.rejectRegistration({ uid: adminUid }, { username: 'rejectme' });
			const users = await User.getRegistrationQueue(0, -1);
			assert.equal(users.length, 0);
		});

		it('should accept user registration', async () => {
			await helpers.registerUser({
				username: 'acceptme',
				password: '123456',
				'password-confirm': '123456',
				email: 'accept@me.com',
				gdpr_consent: true,
			});

			const uid = await socketUser.acceptRegistration({ uid: adminUid }, { username: 'acceptme' });
			const exists = await User.exists(uid);
			assert(exists);
			const users = await User.getRegistrationQueue(0, -1);
			assert.equal(users.length, 0);
		});

		it('should trim username and add user to registration queue', async () => {
			await helpers.registerUser({
				username: 'invalidname\r\n',
				password: '123456',
				'password-confirm': '123456',
				email: 'invalidtest@test.com',
				gdpr_consent: true,
			});

			const users = await db.getSortedSetRange('registration:queue', 0, -1);
			assert.equal(users[0], 'invalidname');
		});
	});

	describe('invites', () => {
		let notAnInviterUid;
		let inviterUid;
		let adminUid;

		const PUBLIC_GROUP = 'publicGroup';
		const PRIVATE_GROUP = 'privateGroup';
		const OWN_PRIVATE_GROUP = 'ownPrivateGroup';
		const HIDDEN_GROUP = 'hiddenGroup';

		const COMMON_PW = '123456';

		before(async () => {
			const results = await utils.promiseParallel({
				publicGroup: groups.create({ name: PUBLIC_GROUP, private: 0 }),
				privateGroup: groups.create({ name: PRIVATE_GROUP, private: 1 }),
				hiddenGroup: groups.create({ name: HIDDEN_GROUP, hidden: 1 }),
				notAnInviter: User.create({ username: 'notAnInviter', password: COMMON_PW }),
				inviter: User.create({ username: 'inviter', password: COMMON_PW }),
				admin: User.create({ username: 'adminInvite', password: COMMON_PW }),
			});

			notAnInviterUid = results.notAnInviter;
			inviterUid = results.inviter;
			adminUid = results.admin;

			await User.setUserField(inviterUid, 'email', 'inviter@nodebb.org');
			await Promise.all([
				groups.create({ name: OWN_PRIVATE_GROUP, ownerUid: inviterUid, private: 1 }),
				groups.join('administrators', adminUid),
				groups.join('cid:0:privileges:invite', inviterUid),
				User.email.confirmByUid(inviterUid),
			]);
		});

		describe('when inviter is not an admin and does not have invite privilege', () => {
			let csrf_token;
			let jar;

			before(async () => {
				({ jar, csrf_token } = await helpers.loginUser('notAnInviter', COMMON_PW));
			});

			it('should error if user does not have invite privilege', async () => {
				const { response, body } = await helpers.invite({ emails: 'invite1@test.com', groupsToJoin: [] }, notAnInviterUid, jar, csrf_token);
				assert.strictEqual(response.statusCode, 403);
				assert.strictEqual(body.status.message, 'You do not have enough privileges for this action.');
			});

			it('should error out if user tries to use an inviter\'s uid via the API', async () => {
				const { response, body } = await helpers.invite({ emails: 'invite1@test.com', groupsToJoin: [] }, inviterUid, jar, csrf_token);
				const numInvites = await User.getInvitesNumber(inviterUid);
				assert.strictEqual(response.statusCode, 403);
				assert.strictEqual(body.status.message, 'You do not have enough privileges for this action.');
				assert.strictEqual(numInvites, 0);
			});
		});

		describe('when inviter has invite privilege', () => {
			let csrf_token;
			let jar;

			before(async () => {
				({ jar, csrf_token } = await helpers.loginUser('inviter', COMMON_PW));
			});

			it('should error with invalid data', async () => {
				const { response, body } = await helpers.invite({}, inviterUid, jar, csrf_token);
				assert.strictEqual(response.statusCode, 400);
				assert.strictEqual(body.status.message, 'Invalid Data');
			});

			it('should error if user is not admin and type is admin-invite-only', async () => {
				meta.config.registrationType = 'admin-invite-only';
				const { response, body } = await helpers.invite({ emails: 'invite1@test.com', groupsToJoin: [] }, inviterUid, jar, csrf_token);
				assert.strictEqual(response.statusCode, 403);
				assert.strictEqual(body.status.message, 'You do not have enough privileges for this action.');
			});

			it('should send invitation email (without groups to be joined)', async () => {
				meta.config.registrationType = 'normal';
				const { response } = await helpers.invite({ emails: 'invite1@test.com', groupsToJoin: [] }, inviterUid, jar, csrf_token);
				assert.strictEqual(response.statusCode, 200);
			});

			it('should send multiple invitation emails (with a public group to be joined)', async () => {
				const { response, body } = await helpers.invite({ emails: 'invite2@test.com,invite3@test.com', groupsToJoin: [PUBLIC_GROUP] }, inviterUid, jar, csrf_token);
				assert.strictEqual(response.statusCode, 200);
			});

			it('should error if the user has not permission to invite to the group', async () => {
				const { response, body } = await helpers.invite({ emails: 'invite4@test.com', groupsToJoin: [PRIVATE_GROUP] }, inviterUid, jar, csrf_token);
				assert.strictEqual(response.statusCode, 403);
				assert.strictEqual(body.status.message, 'You do not have enough privileges for this action.');
			});

			it('should error if a non-admin tries to invite to the administrators group', async () => {
				const { response, body } = await helpers.invite({ emails: 'invite4@test.com', groupsToJoin: ['administrators'] }, inviterUid, jar, csrf_token);
				assert.strictEqual(response.statusCode, 403);
				assert.strictEqual(body.status.message, 'You do not have enough privileges for this action.');
			});

			it('should to invite to own private group', async () => {
				const { response } = await helpers.invite({ emails: 'invite4@test.com', groupsToJoin: [OWN_PRIVATE_GROUP] }, inviterUid, jar, csrf_token);
				assert.strictEqual(response.statusCode, 200);
			});

			it('should to invite to multiple groups', async () => {
				const { response } = await helpers.invite({ emails: 'invite5@test.com', groupsToJoin: [PUBLIC_GROUP, OWN_PRIVATE_GROUP] }, inviterUid, jar, csrf_token);
				assert.strictEqual(response.statusCode, 200);
			});

			it('should error if tries to invite to hidden group', async () => {
				const { response } = await helpers.invite({ emails: 'invite6@test.com', groupsToJoin: [HIDDEN_GROUP] }, inviterUid, jar, csrf_token);
				assert.strictEqual(response.statusCode, 403);
			});

			it('should error if out of invitations', async () => {
				meta.config.maximumInvites = 1;
				const { response, body } = await helpers.invite({ emails: 'invite6@test.com', groupsToJoin: [] }, inviterUid, jar, csrf_token);
				assert.strictEqual(response.statusCode, 403);
				assert.strictEqual(body.status.message, `You have invited the maximum amount of people (${5} out of ${1}).`);
				meta.config.maximumInvites = 10;
			});

			it('should send invitation email after maximumInvites increased', async () => {
				const { response } = await helpers.invite({ emails: 'invite6@test.com', groupsToJoin: [] }, inviterUid, jar, csrf_token);
				assert.strictEqual(response.statusCode, 200);
			});

			it('should error if invite is sent via API with a different UID', async () => {
				const { response, body } = await helpers.invite({ emails: 'inviter@nodebb.org', groupsToJoin: [] }, adminUid, jar, csrf_token);
				const numInvites = await User.getInvitesNumber(adminUid);
				assert.strictEqual(response.statusCode, 403);
				assert.strictEqual(body.status.message, 'You do not have enough privileges for this action.');
				assert.strictEqual(numInvites, 0);
			});

			it('should succeed if email exists but not actually send an invite', async () => {
				const { response } = await helpers.invite({ emails: 'inviter@nodebb.org', groupsToJoin: [] }, inviterUid, jar, csrf_token);
				const numInvites = await User.getInvitesNumber(adminUid);

				assert.strictEqual(response.statusCode, 200);
				assert.strictEqual(numInvites, 0);
			});
		});

		describe('when inviter is an admin', () => {
			let csrf_token;
			let jar;

			before(async () => {
				({ jar, csrf_token } = await helpers.loginUser('adminInvite', COMMON_PW));
			});

			it('should escape email', async () => {
				await helpers.invite({ emails: '<script>alert("ok");</script>', groupsToJoin: [] }, adminUid, jar, csrf_token);
				const data = await User.getInvites(adminUid);
				assert.strictEqual(data[0], '&lt;script&gt;alert(&quot;ok&quot;);&lt;&#x2F;script&gt;');
				await User.deleteInvitationKey('<script>alert("ok");</script>');
			});

			it('should invite to the administrators group if inviter is an admin', async () => {
				const { response } = await helpers.invite({ emails: 'invite99@test.com', groupsToJoin: ['administrators'] }, adminUid, jar, csrf_token);
				assert.strictEqual(response.statusCode, 200);
			});
		});

		describe('after invites checks', () => {
			it('should get user\'s invites', (done) => {
				User.getInvites(inviterUid, (err, data) => {
					assert.ifError(err);
					Array.from(Array(6)).forEach((_, i) => {
						assert.notEqual(data.indexOf(`invite${i + 1}@test.com`), -1);
					});
					done();
				});
			});

			it('should get all invites', (done) => {
				User.getAllInvites((err, data) => {
					assert.ifError(err);

					const adminData = data.filter(d => parseInt(d.uid, 10) === adminUid)[0];
					assert.notEqual(adminData.invitations.indexOf('invite99@test.com'), -1);

					const inviterData = data.filter(d => parseInt(d.uid, 10) === inviterUid)[0];
					Array.from(Array(6)).forEach((_, i) => {
						assert.notEqual(inviterData.invitations.indexOf(`invite${i + 1}@test.com`), -1);
					});

					done();
				});
			});

			it('should fail to verify invitation with invalid data', (done) => {
				User.verifyInvitation({ token: '', email: '' }, (err) => {
					assert.strictEqual(err.message, '[[register:invite.error-invite-only]]');
					done();
				});
			});

			it('should fail to verify invitation with invalid email', (done) => {
				User.verifyInvitation({ token: 'test', email: 'doesnotexist@test.com' }, (err) => {
					assert.strictEqual(err.message, '[[register:invite.error-invalid-data]]');
					done();
				});
			});

			it('should verify installation with no errors', (done) => {
				const email = 'invite1@test.com';
				db.get(`invitation:uid:${inviterUid}:invited:${email}`, 'token', (err, token) => {
					assert.ifError(err);
					User.verifyInvitation({ token: token, email: 'invite1@test.com' }, (err) => {
						assert.ifError(err);
						done();
					});
				});
			});

			it('should error with invalid username', (done) => {
				User.deleteInvitation('doesnotexist', 'test@test.com', (err) => {
					assert.equal(err.message, '[[error:invalid-username]]');
					done();
				});
			});

			it('should delete invitation', (done) => {
				const socketUser = require('../src/socket.io/user');
				socketUser.deleteInvitation({ uid: adminUid }, { invitedBy: 'inviter', email: 'invite1@test.com' }, (err) => {
					assert.ifError(err);
					db.isSetMember(`invitation:uid:${inviterUid}`, 'invite1@test.com', (err, isMember) => {
						assert.ifError(err);
						assert.equal(isMember, false);
						done();
					});
				});
			});

			it('should delete invitation key', (done) => {
				User.deleteInvitationKey('invite99@test.com', (err) => {
					assert.ifError(err);
					db.isSetMember(`invitation:uid:${adminUid}`, 'invite99@test.com', (err, isMember) => {
						assert.ifError(err);
						assert.equal(isMember, false);
						db.isSetMember('invitation:uids', adminUid, (err, isMember) => {
							assert.ifError(err);
							assert.equal(isMember, false);
							done();
						});
					});
				});
			});

			it('should joined the groups from invitation after registration', async () => {
				const email = 'invite5@test.com';
				const groupsToJoin = [PUBLIC_GROUP, OWN_PRIVATE_GROUP];
				const token = await db.get(`invitation:uid:${inviterUid}:invited:${email}`);

				const { body } = await helpers.registerUser({
					username: 'invite5',
					password: '123456',
					'password-confirm': '123456',
					email: email,
					gdpr_consent: true,
					token: token,
				});

				const memberships = await groups.isMemberOfGroups(body.uid, groupsToJoin);
				const joinedToAll = memberships.filter(Boolean);
				assert.strictEqual(joinedToAll.length, groupsToJoin.length, 'Not joined to the groups');
			});
		});

		describe('invite groups', () => {
			let csrf_token;
			let jar;

			before(async () => {
				({ jar, csrf_token } = await helpers.loginUser('inviter', COMMON_PW));
			});

			it('should show a list of groups for adding to an invite', async () => {
				const { body } = await helpers.request('get', `/api/v3/users/${inviterUid}/invites/groups`, {
					jar,
				});

				assert(Array.isArray(body.response));
				assert.strictEqual(2, body.response.length);
				assert.deepStrictEqual(body.response, ['ownPrivateGroup', 'publicGroup']);
			});

			it('should error out if you request invite groups for another uid', async () => {
				const { response } = await helpers.request('get', `/api/v3/users/${adminUid}/invites/groups`, {
					jar,
				});

				assert.strictEqual(response.statusCode, 403);
			});
		});
	});

	describe('email confirm', () => {
		it('should error with invalid code', (done) => {
			User.email.confirmByCode('asdasda', (err) => {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('should confirm email of user', async () => {
			const email = 'confirm@me.com';
			const uid = await User.create({
				username: 'confirme',
				email: email,
			});

			const code = await User.email.sendValidationEmail(uid, { email, force: 1 });
			const unverified = await groups.isMember(uid, 'unverified-users');
			assert.strictEqual(unverified, true);
			await User.email.confirmByCode(code);
			const [confirmed, isVerified] = await Promise.all([
				db.getObjectField(`user:${uid}`, 'email:confirmed'),
				groups.isMember(uid, 'verified-users', uid),
			]);
			assert.strictEqual(parseInt(confirmed, 10), 1);
			assert.strictEqual(isVerified, true);
		});

		it('should confirm email of user by uid', async () => {
			const email = 'confirm2@me.com';
			const uid = await User.create({
				username: 'confirme2',
				email,
			});
			await User.setUserField(uid, 'email', email);

			const unverified = await groups.isMember(uid, 'unverified-users');
			assert.strictEqual(unverified, true);
			await User.email.confirmByUid(uid);
			const [confirmed, isVerified] = await Promise.all([
				db.getObjectField(`user:${uid}`, 'email:confirmed'),
				groups.isMember(uid, 'verified-users', uid),
			]);
			assert.strictEqual(parseInt(confirmed, 10), 1);
			assert.strictEqual(isVerified, true);
		});

		it('should remove the email from a different account if the email is already in use', async () => {
			const email = 'confirm2@me.com';
			const uid = await User.create({
				username: 'confirme3',
			});

			const oldUid = await db.sortedSetScore('email:uid', email);
			const code = await User.email.sendValidationEmail(uid, email);
			await User.email.confirmByCode(code);

			const oldUserData = await User.getUserData(oldUid);

			assert.strictEqual((await db.sortedSetScore('email:uid', email)), uid);
			assert.strictEqual(oldUserData.email, '');
		});
	});

	describe('user jobs', () => {
		it('should start user jobs', (done) => {
			User.startJobs();
			done();
		});

		it('should stop user jobs', (done) => {
			User.stopJobs();
			done();
		});

		it('should send digest', (done) => {
			db.sortedSetAdd('digest:day:uids', [Date.now(), Date.now()], [1, 2], (err) => {
				assert.ifError(err);
				User.digest.execute({ interval: 'day' }, (err) => {
					assert.ifError(err);
					done();
				});
			});
		});
	});

	describe('hideEmail/hideFullname', () => {
		const COMMON_PW = '123456';
		const hidingUser = {
			username: 'hiddenemail',
			email: 'should@be.hidden',
			fullname: 'baris soner usakli',
			password: COMMON_PW,
		};
		const regularUser = {
			username: 'regularUser',
			email: 'regular@example.com',
			fullname: 'regular user',
			password: COMMON_PW,
		};
		let hidingUserJar;
		let adminUid;
		let adminJar;
		let globalModJar;
		let regularUserJar;

		before(async () => {
			adminUid = await User.create({
				username: 'adminhideemail',
				password: COMMON_PW,
			});
			await groups.join('administrators', adminUid);
			({ jar: adminJar } = await helpers.loginUser('adminhideemail', COMMON_PW));

			// Edge case: In a grepped test, this user should not be created as the first user to have its email not confirmed
			hidingUser.uid = await User.create(hidingUser);
			({ jar: hidingUserJar } = await helpers.loginUser(hidingUser.username, COMMON_PW));

			const globalModUid = await User.create({
				username: 'globalmodhideemail',
				password: COMMON_PW,
			});
			await groups.join('Global Moderators', globalModUid);
			({ jar: globalModJar } = await helpers.loginUser('globalmodhideemail', COMMON_PW));

			regularUser.uid = await User.create(regularUser);
			({ jar: regularUserJar } = await helpers.loginUser(regularUser.username, COMMON_PW));
		});

		after((done) => {
			meta.config.hideEmail = 0;
			meta.config.hideFullname = 0;
			done();
		});

		async function assertPrivacy({ expectVisible, jar, v3Api, emailOnly }) {
			const path = v3Api ? `v3/users/${hidingUser.uid}` : `user/${hidingUser.username}`;
			const { body } = await request.get(`${nconf.get('url')}/api/${path}`, { jar });
			const userData = v3Api ? body.response : body;

			assert.strictEqual(userData.email, expectVisible ? hidingUser.email : '');
			if (!emailOnly) {
				assert.strictEqual(userData.fullname, expectVisible ? hidingUser.fullname : '');
			}
		}

		it('should hide unconfirmed emails on profile pages', async () => {
			await assertPrivacy({ v3Api: false, emailOnly: true });
			await assertPrivacy({ v3Api: false, jar: hidingUserJar, emailOnly: true });
			await assertPrivacy({ v3Api: false, jar: adminJar, emailOnly: true });
			await assertPrivacy({ v3Api: false, jar: globalModJar, emailOnly: true });
			await assertPrivacy({ v3Api: false, jar: regularUserJar, emailOnly: true });

			// Let's confirm for afterwards
			await User.setUserField(hidingUser.uid, 'email', 'should@be.hidden');
			await User.email.confirmByUid(hidingUser.uid);
		});

		it('should hide from guests by default', async () => {
			await assertPrivacy({ v3Api: false });
		});

		it('should hide from unprivileged users by default', async () => {
			await assertPrivacy({ v3Api: false, jar: regularUserJar });
			await assertPrivacy({ v3Api: true, jar: regularUserJar });
		});

		it('should be visible to self by default', async () => {
			await assertPrivacy({ v3Api: false, jar: hidingUserJar, expectVisible: true });
			await assertPrivacy({ v3Api: true, jar: hidingUserJar, expectVisible: true });
		});

		it('should be visible to privileged users by default', async () => {
			await assertPrivacy({ v3Api: false, jar: adminJar, expectVisible: true });
			await assertPrivacy({ v3Api: true, jar: adminJar, expectVisible: true });
			await assertPrivacy({ v3Api: false, jar: globalModJar, expectVisible: true });
			await assertPrivacy({ v3Api: true, jar: globalModJar, expectVisible: true });
		});

		it('should hide from guests (system-wide: hide, by-user: hide)', async () => {
			meta.config.hideEmail = 1;
			meta.config.hideFullname = 1;
			// Explicitly set user's privacy settings to hide its email and fullname
			const data = { uid: hidingUser.uid, settings: { showemail: 0, showfullname: 0 } };
			await apiUser.updateSettings({ uid: hidingUser.uid }, data);

			await assertPrivacy({ v3Api: false });
		});

		it('should hide from unprivileged users (system-wide: hide, by-user: hide)', async () => {
			await assertPrivacy({ v3Api: false, jar: regularUserJar });
			await assertPrivacy({ v3Api: true, jar: regularUserJar });
		});

		it('should be visible to self (system-wide: hide, by-user: hide)', async () => {
			await assertPrivacy({ v3Api: false, jar: hidingUserJar, expectVisible: true });
			await assertPrivacy({ v3Api: true, jar: hidingUserJar, expectVisible: true });
		});

		it('should be visible to privileged users (system-wide: hide, by-user: hide)', async () => {
			await assertPrivacy({ v3Api: false, jar: adminJar, expectVisible: true });
			await assertPrivacy({ v3Api: true, jar: adminJar, expectVisible: true });
			await assertPrivacy({ v3Api: false, jar: globalModJar, expectVisible: true });
			await assertPrivacy({ v3Api: true, jar: globalModJar, expectVisible: true });
		});

		it('should hide from guests (system-wide: show, by-user: hide)', async () => {
			meta.config.hideEmail = 0;
			meta.config.hideFullname = 0;

			await assertPrivacy({ v3Api: false });
		});

		it('should hide from unprivileged users (system-wide: show, by-user: hide)', async () => {
			await assertPrivacy({ v3Api: false, jar: regularUserJar });
			await assertPrivacy({ v3Api: true, jar: regularUserJar });
		});

		it('should be visible to self (system-wide: show, by-user: hide)', async () => {
			await assertPrivacy({ v3Api: false, jar: hidingUserJar, expectVisible: true });
			await assertPrivacy({ v3Api: true, jar: hidingUserJar, expectVisible: true });
		});

		it('should be visible to privileged users (system-wide: show, by-user: hide)', async () => {
			await assertPrivacy({ v3Api: false, jar: adminJar, expectVisible: true });
			await assertPrivacy({ v3Api: true, jar: adminJar, expectVisible: true });
			await assertPrivacy({ v3Api: false, jar: globalModJar, expectVisible: true });
			await assertPrivacy({ v3Api: true, jar: globalModJar, expectVisible: true });
		});

		it('should be visible to guests (system-wide: show, by-user: show)', async () => {
			meta.config.hideEmail = 0;
			meta.config.hideFullname = 0;

			// Set user's individual privacy settings to show its email and fullname
			const data = { uid: hidingUser.uid, settings: { showemail: 1, showfullname: 1 } };
			await apiUser.updateSettings({ uid: hidingUser.uid }, data);

			await assertPrivacy({ v3Api: false, expectVisible: true });
		});

		it('should be visible to unprivileged users (system-wide: show, by-user: show)', async () => {
			await assertPrivacy({ v3Api: false, jar: regularUserJar, expectVisible: true });
			await assertPrivacy({ v3Api: true, jar: regularUserJar, expectVisible: true });
		});

		// System-wide "hide" prioritized over individual users' settings
		it('should hide from guests (system-wide: hide, by-user: show)', async () => {
			meta.config.hideEmail = 1;
			meta.config.hideFullname = 1;

			await assertPrivacy({ v3Api: false });
		});

		it('should hide from unprivileged users (system-wide: hide, by-user: show)', async () => {
			await assertPrivacy({ v3Api: false, jar: regularUserJar });
			await assertPrivacy({ v3Api: true, jar: regularUserJar });
		});

		it('should be visible to self (system-wide: hide, by-user: show)', async () => {
			await assertPrivacy({ v3Api: false, jar: hidingUserJar, expectVisible: true });
			await assertPrivacy({ v3Api: true, jar: hidingUserJar, expectVisible: true });
		});

		it('should be visible to privileged users (system-wide: hide, by-user: show)', async () => {
			await assertPrivacy({ v3Api: false, jar: adminJar, expectVisible: true });
			await assertPrivacy({ v3Api: true, jar: adminJar, expectVisible: true });
			await assertPrivacy({ v3Api: false, jar: globalModJar, expectVisible: true });
			await assertPrivacy({ v3Api: true, jar: globalModJar, expectVisible: true });
		});

		it('should handle array of user data (system-wide: hide)', async () => {
			const userData = await User.hidePrivateData([hidingUser, regularUser], hidingUser.uid);
			assert.strictEqual(userData[0].fullname, hidingUser.fullname);
			assert.strictEqual(userData[0].email, hidingUser.email);
			assert.strictEqual(userData[1].fullname, '');
			assert.strictEqual(userData[1].email, '');
		});

		it('should hide fullname in topic list and topic', async () => {
			await Topics.post({
				uid: hidingUser.uid,
				title: 'Topic hidden',
				content: 'lorem ipsum',
				cid: testCid,
			});

			const { body: body1 } = await request.get(`${nconf.get('url')}/api/recent`);
			assert(!body1.topics[0].user.hasOwnProperty('fullname'));

			const { body: body2 } = await request.get(`${nconf.get('url')}/api/topic/${body1.topics[0].slug}`);
			assert(!body2.posts[0].user.hasOwnProperty('fullname'));
		});
	});

	describe('user blocking methods', (done) => {
		let blockeeUid;
		before((done) => {
			User.create({
				username: 'blockee',
				email: 'blockee@example.org',
				fullname: 'Block me',
			}, (err, uid) => {
				blockeeUid = uid;
				done(err);
			});
		});

		describe('.toggle()', () => {
			it('should toggle block', (done) => {
				socketUser.toggleBlock({ uid: 1 }, { blockerUid: 1, blockeeUid: blockeeUid, action: 'block' }, (err) => {
					assert.ifError(err);
					User.blocks.is(blockeeUid, 1, (err, blocked) => {
						assert.ifError(err);
						assert(blocked);
						done();
					});
				});
			});

			it('should toggle block', (done) => {
				socketUser.toggleBlock({ uid: 1 }, { blockerUid: 1, blockeeUid: blockeeUid, action: 'unblock' }, (err) => {
					assert.ifError(err);
					User.blocks.is(blockeeUid, 1, (err, blocked) => {
						assert.ifError(err);
						assert(!blocked);
						done();
					});
				});
			});
		});

		describe('.add()', () => {
			it('should block a uid', (done) => {
				User.blocks.add(blockeeUid, 1, (err) => {
					assert.ifError(err);
					User.blocks.list(1, (err, blocked_uids) => {
						assert.ifError(err);
						assert.strictEqual(Array.isArray(blocked_uids), true);
						assert.strictEqual(blocked_uids.length, 1);
						assert.strictEqual(blocked_uids.includes(blockeeUid), true);
						done();
					});
				});
			});

			it('should automatically increment corresponding user field', (done) => {
				db.getObjectField('user:1', 'blocksCount', (err, count) => {
					assert.ifError(err);
					assert.strictEqual(parseInt(count, 10), 1);
					done();
				});
			});

			it('should error if you try to block the same uid again', (done) => {
				User.blocks.add(blockeeUid, 1, (err) => {
					assert.equal(err.message, '[[error:already-blocked]]');
					done();
				});
			});
		});

		describe('.remove()', () => {
			it('should unblock a uid', (done) => {
				User.blocks.remove(blockeeUid, 1, (err) => {
					assert.ifError(err);
					User.blocks.list(1, (err, blocked_uids) => {
						assert.ifError(err);
						assert.strictEqual(Array.isArray(blocked_uids), true);
						assert.strictEqual(blocked_uids.length, 0);
						done();
					});
				});
			});

			it('should automatically decrement corresponding user field', (done) => {
				db.getObjectField('user:1', 'blocksCount', (err, count) => {
					assert.ifError(err);
					assert.strictEqual(parseInt(count, 10), 0);
					done();
				});
			});

			it('should error if you try to unblock the same uid again', (done) => {
				User.blocks.remove(blockeeUid, 1, (err) => {
					assert.equal(err.message, '[[error:already-unblocked]]');
					done();
				});
			});
		});

		describe('.is()', () => {
			before((done) => {
				User.blocks.add(blockeeUid, 1, done);
			});

			it('should return a Boolean with blocked status for the queried uid', (done) => {
				User.blocks.is(blockeeUid, 1, (err, blocked) => {
					assert.ifError(err);
					assert.strictEqual(blocked, true);
					done();
				});
			});
		});

		describe('.list()', () => {
			it('should return a list of blocked uids', (done) => {
				User.blocks.list(1, (err, blocked_uids) => {
					assert.ifError(err);
					assert.strictEqual(Array.isArray(blocked_uids), true);
					assert.strictEqual(blocked_uids.length, 1);
					assert.strictEqual(blocked_uids.includes(blockeeUid), true);
					done();
				});
			});
		});

		describe('.filter()', () => {
			it('should remove entries by blocked uids and return filtered set', (done) => {
				User.blocks.filter(1, [{
					foo: 'foo',
					uid: blockeeUid,
				}, {
					foo: 'bar',
					uid: 1,
				}, {
					foo: 'baz',
					uid: blockeeUid,
				}], (err, filtered) => {
					assert.ifError(err);
					assert.strictEqual(Array.isArray(filtered), true);
					assert.strictEqual(filtered.length, 1);
					assert.equal(filtered[0].uid, 1);
					done();
				});
			});

			it('should allow property argument to be passed in to customise checked property', (done) => {
				User.blocks.filter(1, 'fromuid', [{
					foo: 'foo',
					fromuid: blockeeUid,
				}, {
					foo: 'bar',
					fromuid: 1,
				}, {
					foo: 'baz',
					fromuid: blockeeUid,
				}], (err, filtered) => {
					assert.ifError(err);
					assert.strictEqual(Array.isArray(filtered), true);
					assert.strictEqual(filtered.length, 1);
					assert.equal(filtered[0].fromuid, 1);
					done();
				});
			});

			it('should not process invalid sets', (done) => {
				User.blocks.filter(1, [{ foo: 'foo' }, { foo: 'bar' }, { foo: 'baz' }], (err, filtered) => {
					assert.ifError(err);
					assert.strictEqual(Array.isArray(filtered), true);
					assert.strictEqual(filtered.length, 3);
					filtered.forEach((obj) => {
						assert.strictEqual(obj.hasOwnProperty('foo'), true);
					});
					done();
				});
			});

			it('should process plain sets that just contain uids', (done) => {
				User.blocks.filter(1, [1, blockeeUid], (err, filtered) => {
					assert.ifError(err);
					assert.strictEqual(filtered.length, 1);
					assert.strictEqual(filtered[0], 1);
					done();
				});
			});

			it('should filter uids that are blocking targetUid', (done) => {
				User.blocks.filterUids(blockeeUid, [1, 2], (err, filtered) => {
					assert.ifError(err);
					assert.deepEqual(filtered, [2]);
					done();
				});
			});
		});
	});

	describe('status/online', () => {
		it('should return offline if user is guest', (done) => {
			const status = User.getStatus({ uid: 0 });
			assert.strictEqual(status, 'offline');
			done();
		});

		it('should return offline if user is guest', async () => {
			assert.strictEqual(await User.isOnline(0), false);
		});

		it('should return true', async () => {
			assert.strictEqual(await User.isOnline(testUid), true);
		});
	});

	describe('isPrivilegedOrSelf', () => {
		it('should return not error if self', (done) => {
			User.isPrivilegedOrSelf(1, 1, (err) => {
				assert.ifError(err);
				done();
			});
		});

		it('should not error if privileged', (done) => {
			User.create({ username: 'theadmin' }, (err, uid) => {
				assert.ifError(err);
				groups.join('administrators', uid, (err) => {
					assert.ifError(err);
					User.isPrivilegedOrSelf(uid, 2, (err) => {
						assert.ifError(err);
						done();
					});
				});
			});
		});

		it('should error if not privileged', (done) => {
			User.isPrivilegedOrSelf(0, 1, (err) => {
				assert.equal(err.message, '[[error:no-privileges]]');
				done();
			});
		});
	});

	it('should get admins and mods', (done) => {
		User.getAdminsandGlobalMods((err, data) => {
			assert.ifError(err);
			assert(Array.isArray(data));
			done();
		});
	});

	it('should allow user to login even if password is weak', async () => {
		await User.create({ username: 'weakpwd', password: '123456' });
		const oldValue = meta.config.minimumPasswordStrength;
		meta.config.minimumPasswordStrength = 3;
		await helpers.loginUser('weakpwd', '123456');
		meta.config.minimumPasswordStrength = oldValue;
	});

	describe('User\'s', async () => {
		let files;

		before(async () => {
			files = await file.walk(path.resolve(__dirname, './user'));
		});

		it('subfolder tests', () => {
			files.forEach((filePath) => {
				require(filePath);
			});
		});
	});
});
