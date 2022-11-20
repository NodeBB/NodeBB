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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const helpers = {};
const winston_1 = __importDefault(require("winston"));
const middleware = require('../middleware');
const controllerHelpers = require('../controllers/helpers');
// router, name, middleware(deprecated), middlewares(optional), controller
helpers.setupPageRoute = function (...args) {
    const [router, name] = args;
    let middlewares = args.length > 3 ? args[args.length - 2] : [];
    const controller = args[args.length - 1];
    if (args.length === 5) {
        winston_1.default.warn(`[helpers.setupPageRoute(${name})] passing \`middleware\` as the third param is deprecated, it can now be safely removed`);
    }
    middlewares = [
        middleware.authenticateRequest,
        middleware.maintenanceMode,
        middleware.registrationComplete,
        middleware.pluginHooks,
        ...middlewares,
        middleware.pageView,
    ];
    router.get(name, middleware.busyCheck, middlewares, middleware.buildHeader, helpers.tryRoute(controller));
    router.get(`/api${name}`, middlewares, helpers.tryRoute(controller));
};
// router, name, middleware(deprecated), middlewares(optional), controller
helpers.setupAdminPageRoute = function (...args) {
    const [router, name] = args;
    const middlewares = args.length > 3 ? args[args.length - 2] : [];
    const controller = args[args.length - 1];
    if (args.length === 5) {
        winston_1.default.warn(`[helpers.setupAdminPageRoute(${name})] passing \`middleware\` as the third param is deprecated, it can now be safely removed`);
    }
    router.get(name, middleware.admin.buildHeader, middlewares, helpers.tryRoute(controller));
    router.get(`/api${name}`, middlewares, helpers.tryRoute(controller));
};
// router, verb, name, middlewares(optional), controller
helpers.setupApiRoute = function (...args) {
    const [router, verb, name] = args;
    let middlewares = args.length > 4 ? args[args.length - 2] : [];
    const controller = args[args.length - 1];
    middlewares = [
        middleware.authenticateRequest,
        middleware.maintenanceMode,
        middleware.registrationComplete,
        middleware.pluginHooks,
        ...middlewares,
    ];
    router[verb](name, middlewares, helpers.tryRoute(controller, (err, res) => {
        controllerHelpers.formatApiResponse(400, res, err);
    }));
};
helpers.tryRoute = function (controller, handler) {
    // `handler` is optional
    if (controller && controller.constructor && controller.constructor.name === 'AsyncFunction') {
        return function (req, res, next) {
            return __awaiter(this, void 0, void 0, function* () {
                try {
                    yield controller(req, res, next);
                }
                catch (err) {
                    if (handler) {
                        return handler(err, res);
                    }
                    next(err);
                }
            });
        };
    }
    return controller;
};
