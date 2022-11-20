'use strict';

import admin from '../../rewards/admin';

const rewardsController  = {} as any;

rewardsController.get = async function (req, res) {
	const data = await admin.get();
	res.render('admin/extend/rewards', data);
};
