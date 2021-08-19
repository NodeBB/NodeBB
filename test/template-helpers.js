'use strict';

const nconf = require('nconf');
const assert = require('assert');

const db = require('./mocks/databasemock');
const helpers = require('../public/src/modules/helpers');

describe('helpers', () => {
	it('should return false if item doesn\'t exist', (done) => {
		const flag = helpers.displayMenuItem({ navigation: [] }, 0);
		assert(!flag);
		done();
	});

	it('should return false if route is /users and user does not have view:users privilege', (done) => {
		const flag = helpers.displayMenuItem({
			navigation: [{ route: '/users' }],
			user: {
				privileges: {
					'view:users': false,
				},
			},
		}, 0);
		assert(!flag);
		done();
	});

	it('should return false if route is /tags and user does not have view:tags privilege', (done) => {
		const flag = helpers.displayMenuItem({
			navigation: [{ route: '/tags' }],
			user: {
				privileges: {
					'view:tags': false,
				},
			},
		}, 0);
		assert(!flag);
		done();
	});

	it('should return false if route is /groups and user does not have view:groups privilege', (done) => {
		const flag = helpers.displayMenuItem({
			navigation: [{ route: '/groups' }],
			user: {
				privileges: {
					'view:groups': false,
				},
			},
		}, 0);
		assert(!flag);
		done();
	});

	it('should stringify object', (done) => {
		const str = helpers.stringify({ a: 'herp < derp > and & quote "' });
		assert.equal(str, '{&quot;a&quot;:&quot;herp &lt; derp &gt; and &amp; quote \\&quot;&quot;}');
		done();
	});

	it('should escape html', (done) => {
		const str = helpers.escape('gdkfhgk < some > and &');
		assert.equal(str, 'gdkfhgk &lt; some &gt; and &amp;');
		done();
	});

	it('should return empty string if category is falsy', (done) => {
		assert.equal(helpers.generateCategoryBackground(null), '');
		done();
	});

	it('should generate category background', (done) => {
		const category = {
			bgColor: '#ff0000',
			color: '#00ff00',
			backgroundImage: '/assets/uploads/image.png',
			imageClass: 'auto',
		};
		const bg = helpers.generateCategoryBackground(category);
		assert.equal(bg, 'background-color: #ff0000; color: #00ff00; background-image: url(/assets/uploads/image.png); background-size: auto;');
		done();
	});

	it('should return empty string if category has no children', (done) => {
		const category = {
			children: [],
		};
		const bg = helpers.generateChildrenCategories(category);
		assert.equal(bg, '');
		done();
	});

	it('should generate html for children', (done) => {
		const category = {
			children: [
				{
					link: '',
					bgColor: '#ff0000',
					color: '#00ff00',
					name: 'children',
				},
			],
		};
		const html = helpers.generateChildrenCategories(category);
		assert.equal(html, `<span class="category-children"><span class="category-children-item pull-left"><div role="presentation" class="icon pull-left" style="background-color: #ff0000; color: #00ff00;"><i class="fa fa-fw undefined"></i></div><a href="${nconf.get('relative_path')}/category/undefined"><small>children</small></a></span></span>`);
		done();
	});

	it('should generate topic class', (done) => {
		const className = helpers.generateTopicClass({ locked: true, pinned: true, deleted: true, unread: true });
		assert.equal(className, 'locked pinned deleted unread');
		done();
	});

	it('should show leave button if isMember and group is not administrators', (done) => {
		const btn = helpers.membershipBtn({ displayName: 'some group', name: 'some group', isMember: true });
		assert.equal(btn, '<button class="btn btn-danger" data-action="leave" data-group="some group"><i class="fa fa-times"></i> [[groups:membership.leave-group]]</button>');
		done();
	});

	it('should show pending button if isPending and group is not administrators', (done) => {
		const btn = helpers.membershipBtn({ displayName: 'some group', name: 'some group', isPending: true });
		assert.equal(btn, '<button class="btn btn-warning disabled"><i class="fa fa-clock-o"></i> [[groups:membership.invitation-pending]]</button>');
		done();
	});

	it('should show reject invite button if isInvited', (done) => {
		const btn = helpers.membershipBtn({ displayName: 'some group', name: 'some group', isInvited: true });
		assert.equal(btn, '<button class="btn btn-link" data-action="rejectInvite" data-group="some group">[[groups:membership.reject]]</button><button class="btn btn-success" data-action="acceptInvite" data-group="some group"><i class="fa fa-plus"></i> [[groups:membership.accept-invitation]]</button>');
		done();
	});

	it('should show join button if join requests are not disabled and group is not administrators', (done) => {
		const btn = helpers.membershipBtn({ displayName: 'some group', name: 'some group', disableJoinRequests: false });
		assert.equal(btn, '<button class="btn btn-success" data-action="join" data-group="some group"><i class="fa fa-plus"></i> [[groups:membership.join-group]]</button>');
		done();
	});

	it('should show nothing if group is administrators ', (done) => {
		const btn = helpers.membershipBtn({ displayName: 'administrators', name: 'administrators' });
		assert.equal(btn, '');
		done();
	});

	it('should spawn privilege states', (done) => {
		const privs = {
			find: true,
			read: true,
		};
		const html = helpers.spawnPrivilegeStates('guests', privs);
		assert.equal(html, '<td class="text-center" data-privilege="find" data-value="true"><input autocomplete="off" type="checkbox" checked /></td><td class="text-center" data-privilege="read" data-value="true"><input autocomplete="off" type="checkbox" checked /></td>');
		done();
	});

	it('should render thumb as topic image', (done) => {
		const topicObj = { thumb: '/uploads/1.png', user: { username: 'baris' } };
		const html = helpers.renderTopicImage(topicObj);
		assert.equal(html, `<img src="${topicObj.thumb}" class="img-circle user-img" title="${topicObj.user.username}" />`);
		done();
	});

	it('should render user picture as topic image', (done) => {
		const topicObj = { thumb: '', user: { uid: 1, username: 'baris', picture: '/uploads/2.png' } };
		const html = helpers.renderTopicImage(topicObj);
		assert.equal(html, `<img component="user/picture" data-uid="${topicObj.user.uid}" src="${topicObj.user.picture}" class="user-img" title="${topicObj.user.username}" />`);
		done();
	});

	it('should render digest avatar', (done) => {
		const block = { teaser: { user: { username: 'baris', picture: '/uploads/1.png' } } };
		const html = helpers.renderDigestAvatar(block);
		assert.equal(html, `<img style="vertical-align: middle; width: 32px; height: 32px; border-radius: 50%;" src="${block.teaser.user.picture}" title="${block.teaser.user.username}" />`);
		done();
	});

	it('should render digest avatar', (done) => {
		const block = { teaser: { user: { username: 'baris', 'icon:text': 'B', 'icon:bgColor': '#ff000' } } };
		const html = helpers.renderDigestAvatar(block);
		assert.equal(html, `<div style="vertical-align: middle; width: 32px; height: 32px; line-height: 32px; font-size: 16px; background-color: ${block.teaser.user['icon:bgColor']}; color: white; text-align: center; display: inline-block; border-radius: 50%;">${block.teaser.user['icon:text']}</div>`);
		done();
	});

	it('should render digest avatar', (done) => {
		const block = { user: { username: 'baris', picture: '/uploads/1.png' } };
		const html = helpers.renderDigestAvatar(block);
		assert.equal(html, `<img style="vertical-align: middle; width: 32px; height: 32px; border-radius: 50%;" src="${block.user.picture}" title="${block.user.username}" />`);
		done();
	});

	it('should render digest avatar', (done) => {
		const block = { user: { username: 'baris', 'icon:text': 'B', 'icon:bgColor': '#ff000' } };
		const html = helpers.renderDigestAvatar(block);
		assert.equal(html, `<div style="vertical-align: middle; width: 32px; height: 32px; line-height: 32px; font-size: 16px; background-color: ${block.user['icon:bgColor']}; color: white; text-align: center; display: inline-block; border-radius: 50%;">${block.user['icon:text']}</div>`);
		done();
	});

	it('shoud render user agent/browser icons', (done) => {
		const html = helpers.userAgentIcons({ platform: 'Linux', browser: 'Chrome' });
		assert.equal(html, '<i class="fa fa-fw fa-linux"></i><i class="fa fa-fw fa-chrome"></i>');
		done();
	});

	it('shoud render user agent/browser icons', (done) => {
		const html = helpers.userAgentIcons({ platform: 'Microsoft Windows', browser: 'Firefox' });
		assert.equal(html, '<i class="fa fa-fw fa-windows"></i><i class="fa fa-fw fa-firefox"></i>');
		done();
	});

	it('shoud render user agent/browser icons', (done) => {
		const html = helpers.userAgentIcons({ platform: 'Apple Mac', browser: 'Safari' });
		assert.equal(html, '<i class="fa fa-fw fa-apple"></i><i class="fa fa-fw fa-safari"></i>');
		done();
	});

	it('shoud render user agent/browser icons', (done) => {
		const html = helpers.userAgentIcons({ platform: 'Android', browser: 'IE' });
		assert.equal(html, '<i class="fa fa-fw fa-android"></i><i class="fa fa-fw fa-internet-explorer"></i>');
		done();
	});

	it('shoud render user agent/browser icons', (done) => {
		const html = helpers.userAgentIcons({ platform: 'iPad', browser: 'Edge' });
		assert.equal(html, '<i class="fa fa-fw fa-tablet"></i><i class="fa fa-fw fa-edge"></i>');
		done();
	});

	it('shoud render user agent/browser icons', (done) => {
		const html = helpers.userAgentIcons({ platform: 'iPhone', browser: 'unknow' });
		assert.equal(html, '<i class="fa fa-fw fa-mobile"></i><i class="fa fa-fw fa-question-circle"></i>');
		done();
	});

	it('shoud render user agent/browser icons', (done) => {
		const html = helpers.userAgentIcons({ platform: 'unknow', browser: 'unknown' });
		assert.equal(html, '<i class="fa fa-fw fa-question-circle"></i><i class="fa fa-fw fa-question-circle"></i>');
		done();
	});
});
