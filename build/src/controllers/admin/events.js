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
const database_1 = __importDefault(require("../../database"));
const events = require('../../events');
const pagination = require('../../pagination');
const eventsController = {};
eventsController.get = function (req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const page = parseInt(req.query.page, 10) || 1;
        const itemsPerPage = parseInt(req.query.perPage, 10) || 20;
        const start = (page - 1) * itemsPerPage;
        const stop = start + itemsPerPage - 1;
        // Limit by date
        let from = req.query.start ? new Date(req.query.start) || undefined : undefined;
        let to = req.query.end ? new Date(req.query.end) || undefined : new Date();
        from = from && from.setHours(0, 0, 0, 0); // setHours returns a unix timestamp (Number, not Date)
        to = to && to.setHours(23, 59, 59, 999); // setHours returns a unix timestamp (Number, not Date)
        const currentFilter = req.query.type || '';
        const [eventCount, eventData, counts] = yield Promise.all([
            database_1.default.sortedSetCount(`events:time${currentFilter ? `:${currentFilter}` : ''}`, from || '-inf', to),
            events.getEvents(currentFilter, start, stop, from || '-inf', to),
            database_1.default.sortedSetsCard([''].concat(events.types).map(type => `events:time${type ? `:${type}` : ''}`)),
        ]);
        const types = [''].concat(events.types).map((type, index) => ({
            value: type,
            name: type || 'all',
            selected: type === currentFilter,
            count: counts[index],
        }));
        const pageCount = Math.max(1, Math.ceil(eventCount / itemsPerPage));
        res.render('admin/advanced/events', {
            events: eventData,
            pagination: pagination.create(page, pageCount, req.query),
            types: types,
            query: req.query,
        });
    });
};
