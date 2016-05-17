/*
	IISNodePlugin 
    
    Resolves the issues when trying to run NodeBB within IIS.
*/

if (require.main.filename.indexOf('iisnode\\interceptor.js') > 0) {
    require.main._req_ = require.main.require;

    var tryGetModule = function (mod) {
        var result = {
            module: undefined,
            err: undefined,
            hasError: false
        };
        try {
            result.module = require.main._req_(mod);
        } catch (e) {
            result.hasError = true;
            result.err = e;
        }

        return result;
    }

    require.main.require = function (mod) {
        var result = tryGetModule(mod).module || tryGetModule(__dirname + '\\' + mod).module || tryGetModule(__dirname + '\\node_modules\\' + mod).module || tryGetModule(mod);

        if (result.hasError) {
            throw result.err;
        }

        return result;
    }
}