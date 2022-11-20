'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const webpack_merge_1 = require("webpack-merge");
const common = require("./webpack.common");
module.exports = (0, webpack_merge_1.merge)(common, {
    mode: 'development',
    // devtool: 'eval-source-map',
});
