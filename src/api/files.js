// SPDX-FileCopyrightText: 2013-2021 NodeBB Inc
//
// SPDX-License-Identifier: GPL-3.0-or-later

'use strict';

const fs = require('fs').promises;

const filesApi = module.exports;

// path assertion and traversal guarding logic is in src/middleware/assert.js

filesApi.delete = async (_, { path }) => await fs.unlink(path);

filesApi.createFolder = async (_, { path }) => await fs.mkdir(path);
