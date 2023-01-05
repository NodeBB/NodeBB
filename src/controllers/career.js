'use strict';

const careerController = module.exports;

careerController.get = async function (req, res) {
	const careerData = {};
	res.render('career', careerData);
};
