'use strict';
const loggerController = {};
loggerController.get = function (req, res) {
    res.render('admin/development/logger', {});
};
