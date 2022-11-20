'use strict';

const widgetsController  = {} as any;
import admin from '../../widgets/admin';

widgetsController.get = async function (req, res) {
	const data = await admin.get();
	res.render('admin/extend/widgets', data);
};
