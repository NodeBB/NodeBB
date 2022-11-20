'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const nconf_1 = __importDefault(require("nconf"));
const util = require('util');
const winston_1 = __importDefault(require("winston"));
const { EventEmitter } = require('events');
const connection = require('./connection');
let channelName;
const PubSub = function () {
    // @ts-ignore
    const self = this;
    channelName = `db:${nconf_1.default.get('redis:database')}:pubsub_channel`;
    self.queue = [];
    connection.connect().then((client) => {
        self.subClient = client;
        self.subClient.subscribe(channelName);
        self.subClient.on('message', (channel, message) => {
            if (channel !== channelName) {
                return;
            }
            try {
                const msg = JSON.parse(message);
                self.emit(msg.event, msg.data);
            }
            catch (err) {
                winston_1.default.error(err.stack);
            }
        });
    });
    connection.connect().then((client) => {
        self.pubClient = client;
        self.queue.forEach(payload => client.publish(channelName, payload));
        self.queue.length = 0;
    });
};
util.inherits(PubSub, EventEmitter);
PubSub.prototype.publish = function (event, data) {
    const payload = JSON.stringify({ event: event, data: data });
    if (this.pubClient) {
        this.pubClient.publish(channelName, payload);
    }
    else {
        this.queue.push(payload);
    }
};
exports.default = new PubSub();
