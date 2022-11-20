'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
function default_1(module) {
    // TODO
    module.transaction = function (perform, callback) {
        perform(module.client, callback);
    };
}
exports.default = default_1;
;
