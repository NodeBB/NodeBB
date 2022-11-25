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
const winston = require('winston');
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');
const webpack = require('webpack');
const nconf = require('nconf');
const Benchpress = require('benchpressjs');
const mkdirp = require('mkdirp');
const { paths } = require('../src/constants');
const sass = require('../src/utils').default.getSass();
const app = express();
let server;
const formats = [
    winston.format.colorize(),
];
const timestampFormat = winston.format((info) => {
    const dateString = `${new Date().toISOString()} [${global.process.pid}]`;
    info.level = `${dateString} - ${info.level}`;
    return info;
});
formats.push(timestampFormat());
formats.push(winston.format.splat());
formats.push(winston.format.simple());
winston.configure({
    level: 'verbose',
    format: winston.format.combine.apply(null, formats),
    transports: [
        new winston.transports.Console({
            handleExceptions: true,
        }),
        new winston.transports.File({
            filename: 'logs/webinstall.log',
            handleExceptions: true,
        }),
    ],
});
const web = {};
let installing = false;
let success = false;
let error = false;
let launchUrl;
const viewsDir = path.join(paths.baseDir, 'build/public/templates');
web.install = function (port) {
    return __awaiter(this, void 0, void 0, function* () {
        port = port || 4567;
        winston.info(`Launching web installer on port ${port}`);
        app.use(express.static('public', {}));
        app.use('/assets', express.static(path.join(__dirname, '../build/public'), {}));
        app.engine('tpl', (filepath, options, callback) => {
            filepath = filepath.replace(/\.tpl$/, '.js');
            Benchpress.__express(filepath, options, callback);
        });
        app.set('view engine', 'tpl');
        app.set('views', viewsDir);
        app.use(bodyParser.urlencoded({
            extended: true,
        }));
        try {
            yield Promise.all([
                compileTemplate(),
                compileSass(),
                runWebpack(),
                copyCSS(),
                loadDefaults(),
            ]);
            setupRoutes();
            launchExpress(port);
        }
        catch (err) {
            winston.error(err.stack);
        }
    });
};
function runWebpack() {
    return __awaiter(this, void 0, void 0, function* () {
        const util = require('util');
        const webpackCfg = require('../webpack.installer');
        const compiler = webpack(webpackCfg);
        const webpackRun = util.promisify(compiler.run).bind(compiler);
        yield webpackRun();
    });
}
function launchExpress(port) {
    server = app.listen(port, () => {
        winston.info('Web installer listening on http://%s:%s', '0.0.0.0', port);
    });
}
function setupRoutes() {
    app.get('/', welcome);
    app.post('/', install);
    app.post('/launch', launch);
    app.get('/ping', ping);
    app.get('/sping', ping);
}
function ping(req, res) {
    res.status(200).send(req.path === '/sping' ? 'healthy' : '200');
}
function welcome(req, res) {
    const dbs = ['mongo', 'redis', 'postgres'];
    const databases = dbs.map((databaseName) => {
        const questions = require(`../src/database/${databaseName}`).default.questions.filter(question => question && !question.hideOnWebInstall);
        return {
            name: databaseName,
            questions: questions,
        };
    });
    const defaults = require('./data/defaults.json');
    res.render('install/index', {
        url: nconf.get('url') || (`${req.protocol}://${req.get('host')}`),
        launchUrl: launchUrl,
        skipGeneralSetup: true,
        databases: databases,
        skipDatabaseSetup: true,
        error: error,
        success: success,
        values: req.body,
        minimumPasswordLength: defaults.minimumPasswordLength,
        minimumPasswordStrength: defaults.minimumPasswordStrength,
        installing: installing,
    });
}
function install(req, res) {
    // if (installing) {
    // 	return welcome(req, res);
    // }
    req.setTimeout(0);
    installing = true;
    const database = nconf.get('database') || req.body.database || 'mongo';
    const setupEnvVars = Object.assign(Object.assign({}, process.env), { NODEBB_URL: nconf.get('url') || req.body.url || (`${req.protocol}://${req.get('host')}`), NODEBB_PORT: nconf.get('port') || 4567, NODEBB_ADMIN_USERNAME: nconf.get('admin:username') || req.body['admin:username'], NODEBB_ADMIN_PASSWORD: nconf.get('admin:password') || req.body['admin:password'], NODEBB_ADMIN_EMAIL: nconf.get('admin:email') || req.body['admin:email'], NODEBB_DB: database, NODEBB_DB_HOST: nconf.get(`${database}:host`) || req.body[`${database}:host`], NODEBB_DB_PORT: nconf.get(`${database}:port`) || req.body[`${database}:port`], NODEBB_DB_USER: nconf.get(`${database}:username`) || req.body[`${database}:username`], NODEBB_DB_PASSWORD: nconf.get(`${database}:password`) || req.body[`${database}:password`], NODEBB_DB_NAME: nconf.get(`${database}:database`) || req.body[`${database}:database`], NODEBB_DB_SSL: nconf.get(`${database}:ssl`) || req.body[`${database}:ssl`], defaultPlugins: JSON.stringify(nconf.get('defaultplugins') || nconf.get('defaultPlugins') || []) });
    winston.info('Starting setup process');
    launchUrl = setupEnvVars.NODEBB_URL;
    const child = require('child_process').fork('build/app', ['--setup'], {
        env: setupEnvVars,
    });
    child.on('close', (data) => {
        installing = false;
        success = data === 0;
        error = data !== 0;
        welcome(req, res);
    });
}
function launch(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            res.json({});
            server.close();
            req.setTimeout(0);
            let child;
            if (!nconf.get('launchCmd')) {
                child = childProcess.spawn('node', ['loader.js'], {
                    detached: true,
                    stdio: ['ignore', 'ignore', 'ignore'],
                });
                console.log('\nStarting NodeBB');
                console.log('    "./nodebb stop" to stop the NodeBB server');
                console.log('    "./nodebb log" to view server output');
                console.log('    "./nodebb restart" to restart NodeBB');
            }
            else {
                // Use launchCmd instead, if specified
                child = childProcess.exec(nconf.get('launchCmd'), {
                    detached: true,
                    stdio: ['ignore', 'ignore', 'ignore'],
                });
            }
            const filesToDelete = [
                path.join(__dirname, '../../public', 'installer.css'),
                path.join(__dirname, '../../public', 'bootstrap.min.css'),
                path.join(__dirname, '../build/public', 'installer.min.js'),
            ];
            try {
                yield Promise.all(filesToDelete.map(filename => fs.promises.unlink(filename)));
            }
            catch (err) {
                console.log(err.stack);
            }
            child.unref();
            process.exit(0);
        }
        catch (err) {
            winston.error(err.stack);
            throw err;
        }
    });
}
// this is necessary because otherwise the compiled templates won't be available on a clean install
function compileTemplate() {
    return __awaiter(this, void 0, void 0, function* () {
        const sourceFile = path.join(__dirname, '../src/views/install/index.tpl');
        const destTpl = path.join(viewsDir, 'install/index.tpl');
        const destJs = path.join(viewsDir, 'install/index.js');
        const source = yield fs.promises.readFile(sourceFile, 'utf8');
        const [compiled] = yield Promise.all([
            Benchpress.precompile(source, { filename: 'install/index.tpl' }),
            mkdirp(path.dirname(destJs)),
        ]);
        yield Promise.all([
            fs.promises.writeFile(destJs, compiled),
            fs.promises.writeFile(destTpl, source),
        ]);
    });
}
function compileSass() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const installSrc = path.join(__dirname, '../../public/scss/install.scss');
            const style = yield fs.promises.readFile(installSrc);
            const scssOutput = sass.compileString(String(style), {
                loadPaths: [
                    path.join(__dirname, '../../public/scss'),
                ],
            });
            console.log('BOOOMINGGGG!!!!');
            yield fs.promises.writeFile(path.join(__dirname, '../../public/installer.css'), scssOutput.css.toString());
        }
        catch (err) {
            winston.error(`Unable to compile SASS: \n${err.stack}`);
            throw err;
        }
    });
}
function copyCSS() {
    return __awaiter(this, void 0, void 0, function* () {
        yield fs.promises.copyFile(path.join(__dirname, '../../node_modules/bootstrap/dist/css/bootstrap.min.css'), path.join(__dirname, '../../public/bootstrap.min.css'));
    });
}
function loadDefaults() {
    return __awaiter(this, void 0, void 0, function* () {
        const setupDefaultsPath = path.join(__dirname, '../setup.json');
        try {
            // eslint-disable-next-line no-bitwise
            yield fs.promises.access(setupDefaultsPath, fs.constants.F_OK | fs.constants.R_OK);
        }
        catch (err) {
            // setup.json not found or inaccessible, proceed with no defaults
            if (err.code !== 'ENOENT') {
                throw err;
            }
            return;
        }
        winston.info('[installer] Found setup.json, populating default values');
        nconf.file({
            file: setupDefaultsPath,
        });
    });
}
exports.default = web;
