'use strict';

const user = require('../../user');
const meta = require('../../meta');
const helpers = require('../helpers');
const groups = require('../../groups');
const privileges = require('../../privileges');
const plugins = require('../../plugins');
const file = require('../../file');

const editController = module.exports;

editController.get = async function (req, res, next) {
	const { userData } = res.locals;
	if (!userData) {
		return next();
	}
	const {
		username,
		userslug,
		isSelf,
		reputation,
		groups: _groups,
		groupTitleArray,
		allowMultipleBadges,
	} = userData;

	const [canUseSignature, canManageUsers] = await Promise.all([
		privileges.global.can('signature', req.uid),
		privileges.admin.can('admin:users', req.uid),
	]);

	userData.maximumSignatureLength = meta.config.maximumSignatureLength;
	userData.maximumAboutMeLength = meta.config.maximumAboutMeLength;
	userData.maximumProfileImageSize = meta.config.maximumProfileImageSize;
	userData.allowMultipleBadges = meta.config.allowMultipleBadges === 1;
	userData.allowAccountDelete = meta.config.allowAccountDelete === 1;
	userData.allowWebsite = !isSelf || !!meta.config['reputation:disabled'] || reputation >= meta.config['min:rep:website'];
	userData.allowAboutMe = !isSelf || !!meta.config['reputation:disabled'] || reputation >= meta.config['min:rep:aboutme'];
	userData.allowSignature = canUseSignature && (!isSelf || !!meta.config['reputation:disabled'] || reputation >= meta.config['min:rep:signature']);
	userData.profileImageDimension = meta.config.profileImageDimension;
	userData.defaultAvatar = user.getDefaultAvatar();

	userData.groups = _groups.filter(g => g && g.userTitleEnabled && !groups.isPrivilegeGroup(g.name) && g.name !== 'registered-users');

	if (req.uid === res.locals.uid || canManageUsers) {
		const { associations } = await plugins.hooks.fire('filter:auth.list', { uid: res.locals.uid, associations: [] });
		userData.sso = associations;
	}

	if (!allowMultipleBadges) {
		userData.groupTitle = groupTitleArray[0];
	}

	userData.groups.sort((a, b) => {
		const i1 = groupTitleArray.indexOf(a.name);
		const i2 = groupTitleArray.indexOf(b.name);
		if (i1 === -1) {
			return 1;
		} else if (i2 === -1) {
			return -1;
		}
		return i1 - i2;
	});
	userData.groups.forEach((group) => {
		group.userTitle = group.userTitle || group.displayName;
		group.selected = groupTitleArray.includes(group.name);
	});
	userData.groupSelectSize = Math.min(10, Math.max(5, userData.groups.length + 1));

	userData.title = `[[pages:account/edit, ${username}]]`;
	userData.breadcrumbs = helpers.buildBreadcrumbs([
		{
			text: username,
			url: `/user/${userslug}`,
		},
		{
			text: '[[user:edit]]',
		},
	]);
	userData.editButtons = [];

	res.render('account/edit', userData);
};

editController.password = async function (req, res, next) {
	await renderRoute('password', req, res, next);
};

editController.username = async function (req, res, next) {
	await renderRoute('username', req, res, next);
};

editController.email = async function (req, res, next) {
	const targetUid = await user.getUidByUserslug(req.params.userslug);
	if (!targetUid || req.uid !== parseInt(targetUid, 10)) {
		return next();
	}

	req.session.returnTo = `/uid/${targetUid}`;
	req.session.registration = req.session.registration || {};
	req.session.registration.updateEmail = true;
	req.session.registration.uid = targetUid;
	helpers.redirect(res, '/register/complete');
};

async function renderRoute(name, req, res) {
	const { userData } = res.locals;
	const [isAdmin, { username, userslug }, hasPassword] = await Promise.all([
		privileges.admin.can('admin:users', req.uid),
		user.getUserFields(res.locals.uid, ['username', 'userslug']),
		user.hasPassword(res.locals.uid),
	]);

	if (meta.config[`${name}:disableEdit`] && !isAdmin) {
		return helpers.notAllowed(req, res);
	}

	userData.hasPassword = hasPassword;
	if (name === 'password') {
		userData.minimumPasswordLength = meta.config.minimumPasswordLength;
		userData.minimumPasswordStrength = meta.config.minimumPasswordStrength;
	}

	userData.title = `[[pages:account/edit/${name}, ${username}]]`;
	userData.breadcrumbs = helpers.buildBreadcrumbs([
		{
			text: username,
			url: `/user/${userslug}`,
		},
		{
			text: '[[user:edit]]',
			url: `/user/${userslug}/edit`,
		},
		{
			text: `[[user:${name}]]`,
		},
	]);

	res.render(`account/edit/${name}`, userData);
}

editController.uploadPicture = async function (req, res, next) {
	const userPhoto = req.files.files[0];
	try {
		const updateUid = await user.getUidByUserslug(req.params.userslug);
		const isAllowed = await privileges.users.canEdit(req.uid, updateUid);
		if (!isAllowed) {
			return helpers.notAllowed(req, res);
		}
		await user.checkMinReputation(req.uid, updateUid, 'min:rep:profile-picture');

		const image = await user.uploadCroppedPictureFile({
			callerUid: req.uid,
			uid: updateUid,
			file: userPhoto,
		});

		res.json([{
			name: userPhoto.name,
			url: image.url,
		}]);
	} catch (err) {
		next(err);
	} finally {
		await file.delete(userPhoto.path);
	}
};
