'use strict';
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.log = exports.status = exports.restart = exports.stop = exports.start = void 0;
const fs = __importStar(require("fs"));
const childProcess = require('child_process');
const chalk = require('chalk');
const fork = require('../meta/debugFork').default;
const { paths } = require('../constants');
const cwd = paths.baseDir;
const child = fork(paths.loader, process.argv.slice(3), {
    env: process.env,
    cwd,
});
function getRunningPid(callback) {
    fs.readFile(paths.pidfile, {
        encoding: 'utf-8',
    }, (err, pid) => {
        if (err) {
            return callback(err);
        }
        // @ts-ignore
        pid = parseInt(pid, 10);
        try {
            // @ts-ignore
            process.kill(pid, 0);
            callback(null, pid);
        }
        catch (e) {
            callback(e);
        }
    });
}
function start(options) {
    if (options.dev) {
        process.env.NODE_ENV = 'development';
        fork(paths.loader, ['--no-daemon', '--no-silent'], {
            env: process.env,
            stdio: 'inherit',
            cwd,
        });
        return;
    }
    if (options.log) {
        console.log(`\n${[
            chalk.bold('Starting NodeBB with logging output'),
            chalk.red('Hit ') + chalk.bold('Ctrl-C ') + chalk.red('to exit'),
            'The NodeBB process will continue to run in the background',
            `Use "${chalk.yellow('./nodebb stop')}" to stop the NodeBB server`,
        ].join('\n')}`);
    }
    else if (!options.silent) {
        console.log(`\n${[
            chalk.bold('Starting NodeBB'),
            `  "${chalk.yellow('./nodebb stop')}" to stop the NodeBB server`,
            `  "${chalk.yellow('./nodebb log')}" to view server output`,
            `  "${chalk.yellow('./nodebb help')}" for more commands\n`,
        ].join('\n')}`);
    }
    // Spawn a new NodeBB process
    if (options.log) {
        childProcess.spawn('tail', ['-F', './logs/output.log'], {
            stdio: 'inherit',
            cwd,
        });
    }
    return child;
}
exports.start = start;
function stop() {
    getRunningPid((err, pid) => {
        if (!err) {
            process.kill(pid, 'SIGTERM');
            console.log('Stopping NodeBB. Goodbye!');
        }
        else {
            console.log('NodeBB is already stopped.');
        }
    });
}
exports.stop = stop;
function restart(options) {
    getRunningPid((err, pid) => {
        if (!err) {
            console.log(chalk.bold('\nRestarting NodeBB'));
            process.kill(pid, 'SIGTERM');
            options.silent = true;
            start(options);
        }
        else {
            console.warn('NodeBB could not be restarted, as a running instance could not be found.');
        }
    });
}
exports.restart = restart;
function status() {
    getRunningPid((err, pid) => {
        if (!err) {
            console.log(`\n${[
                chalk.bold('NodeBB Running ') + chalk.cyan(`(pid ${pid.toString()})`),
                `\t"${chalk.yellow('./nodebb stop')}" to stop the NodeBB server`,
                `\t"${chalk.yellow('./nodebb log')}" to view server output`,
                `\t"${chalk.yellow('./nodebb restart')}" to restart NodeBB\n`,
            ].join('\n')}`);
        }
        else {
            console.log(chalk.bold('\nNodeBB is not running'));
            console.log(`\t"${chalk.yellow('./nodebb start')}" to launch the NodeBB server\n`);
        }
    });
}
exports.status = status;
function log() {
    console.log(`${chalk.red('\nHit ') + chalk.bold('Ctrl-C ') + chalk.red('to exit\n')}\n`);
    // @ts-ignore
    // child(process as any).spawn('tail', ['-F', './logs/output.log'], {
    // 	stdio: 'inherit',
    // 	cwd,
    // });
}
exports.log = log;
