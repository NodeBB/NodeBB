'use strict';

const { csrfSync } = require('csrf-sync');

const {
	generateToken,
	csrfSynchronisedProtection,
} = csrfSync({
	size: 64
});

module.exports = {
	generateToken,
	csrfSynchronisedProtection,
};
