'use strict';


const navigationAdmin = require('../../navigation/admin');
const groups = require('../../groups');

const navigationController = module.exports;

navigationController.get = async function (req, res) {
	const [admin, allGroups] = await Promise.all([
		navigationAdmin.getAdmin(),
		groups.getNonPrivilegeGroups('groups:createtime', 0, -1),
	]);

	allGroups.sort((a, b) => b.system - a.system);

	admin.groups = allGroups.map(group => ({ name: group.name, displayName: group.displayName }));
	admin.enabled.forEach(function (enabled, index) {
		enabled.index = index;
		enabled.selected = index === 0;

		enabled.groups = admin.groups.map(function (group) {
			return {
				displayName: group.displayName,
				selected: enabled.groups.includes(group.name),
			};
		});
	});

	admin.available.forEach(function (available) {
		available.groups = groups;
	});

	admin.navigation = admin.enabled.slice();

	res.render('admin/general/navigation', admin);
};
