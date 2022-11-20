'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
function default_1(module) {
    module.transaction = function (perform, txClient) {
        return __awaiter(this, void 0, void 0, function* () {
            let res;
            if (txClient) {
                yield txClient.query(`SAVEPOINT nodebb_subtx`);
                try {
                    res = yield perform(txClient);
                }
                catch (err) {
                    yield txClient.query(`ROLLBACK TO SAVEPOINT nodebb_subtx`);
                    throw err;
                }
                yield txClient.query(`RELEASE SAVEPOINT nodebb_subtx`);
                return res;
            }
            // see https://node-postgres.com/features/transactions#a-pooled-client-with-async-await
            const client = yield module.pool.connect();
            try {
                yield client.query('BEGIN');
                res = yield perform(client);
                yield client.query('COMMIT');
            }
            catch (err) {
                yield client.query('ROLLBACK');
                throw err;
            }
            finally {
                client.release();
            }
            return res;
        });
    };
}
exports.default = default_1;
;
