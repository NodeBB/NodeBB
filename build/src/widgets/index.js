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
const winston_1 = __importDefault(require("winston"));
const _ = require('lodash');
const Benchpress = require('benchpressjs');
const plugins = require('../plugins');
const groups = require('../groups');
const translator = require('../translator');
const database = __importStar(require("../database"));
const db = database;
const apiController = require('../controllers/api');
const meta_1 = __importDefault(require("../meta"));
const widgets = {};
widgets.render = function (uid, options) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!options.template) {
            throw new Error('[[error:invalid-data]]');
        }
        const data = yield widgets.getWidgetDataForTemplates(['global', options.template]);
        delete data.global.drafts;
        const locations = _.uniq(Object.keys(data.global).concat(Object.keys(data[options.template])));
        const widgetData = yield Promise.all(locations.map(location => renderLocation(location, data, uid, options)));
        const returnData = {};
        locations.forEach((location, i) => {
            if (Array.isArray(widgetData[i]) && widgetData[i].length) {
                returnData[location] = widgetData[i].filter(Boolean);
            }
        });
        return returnData;
    });
};
function renderLocation(location, data, uid, options) {
    return __awaiter(this, void 0, void 0, function* () {
        const widgetsAtLocation = (data[options.template][location] || []).concat(data.global[location] || []);
        if (!widgetsAtLocation.length) {
            return [];
        }
        const renderedWidgets = yield Promise.all(widgetsAtLocation.map(widget => renderWidget(widget, uid, options)));
        return renderedWidgets;
    });
}
function renderWidget(widget, uid, options) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!widget || !widget.data || (!!widget.data['hide-mobile'] && options.req.useragent.isMobile)) {
            return;
        }
        const isVisible = yield widgets.checkVisibility(widget.data, uid);
        if (!isVisible) {
            return;
        }
        let config = options.res.locals.config || {};
        if (options.res.locals.isAPI) {
            config = yield apiController.loadConfig(options.req);
        }
        const userLang = config.userLang || meta_1.default.config.defaultLang || 'en-GB';
        const templateData = _.assign({}, options.templateData, { config: config });
        const data = yield plugins.hooks.fire(`filter:widget.render:${widget.widget}`, {
            uid: uid,
            area: options,
            templateData: templateData,
            data: widget.data,
            req: options.req,
            res: options.res,
        });
        if (!data) {
            return;
        }
        let { html } = data;
        if (widget.data.container && widget.data.container.match('{body}')) {
            html = yield Benchpress.compileRender(widget.data.container, {
                title: widget.data.title,
                body: html,
                template: data.templateData && data.templateData.template,
            });
        }
        if (html) {
            html = yield translator.translate(html, userLang);
        }
        return { html };
    });
}
widgets.checkVisibility = function (data, uid) {
    return __awaiter(this, void 0, void 0, function* () {
        let isVisible = true;
        let isHidden = false;
        if (data.groups.length) {
            isVisible = yield groups.isMemberOfAny(uid, data.groups);
        }
        if (data.groupsHideFrom.length) {
            isHidden = yield groups.isMemberOfAny(uid, data.groupsHideFrom);
        }
        return isVisible && !isHidden;
    });
};
widgets.getWidgetDataForTemplates = function (templates) {
    return __awaiter(this, void 0, void 0, function* () {
        const keys = templates.map(tpl => `widgets:${tpl}`);
        const data = yield db.getObjects(keys);
        const returnData = {};
        templates.forEach((template, index) => {
            returnData[template] = returnData[template] || {};
            const templateWidgetData = data[index] || {};
            const locations = Object.keys(templateWidgetData);
            locations.forEach((location) => {
                if (templateWidgetData && templateWidgetData[location]) {
                    try {
                        returnData[template][location] = parseWidgetData(templateWidgetData[location]);
                    }
                    catch (err) {
                        winston_1.default.error(`can not parse widget data. template:  ${template} location: ${location}`);
                        returnData[template][location] = [];
                    }
                }
                else {
                    returnData[template][location] = [];
                }
            });
        });
        return returnData;
    });
};
widgets.getArea = function (template, location) {
    return __awaiter(this, void 0, void 0, function* () {
        const result = yield db.getObjectField(`widgets:${template}`, location);
        if (!result) {
            return [];
        }
        return parseWidgetData(result);
    });
};
function parseWidgetData(data) {
    const widgets = JSON.parse(data);
    widgets.forEach((widget) => {
        if (widget) {
            widget.data.groups = widget.data.groups || [];
            if (widget.data.groups && !Array.isArray(widget.data.groups)) {
                widget.data.groups = [widget.data.groups];
            }
            widget.data.groupsHideFrom = widget.data.groupsHideFrom || [];
            if (widget.data.groupsHideFrom && !Array.isArray(widget.data.groupsHideFrom)) {
                widget.data.groupsHideFrom = [widget.data.groupsHideFrom];
            }
        }
    });
    return widgets;
}
widgets.setArea = function (area) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!area.location || !area.template) {
            throw new Error('Missing location and template data');
        }
        yield db.setObjectField(`widgets:${area.template}`, area.location, JSON.stringify(area.widgets));
    });
};
widgets.setAreas = function (areas) {
    return __awaiter(this, void 0, void 0, function* () {
        const templates = {};
        areas.forEach((area) => {
            if (!area.location || !area.template) {
                throw new Error('Missing location and template data');
            }
            templates[area.template] = templates[area.template] || {};
            templates[area.template][area.location] = JSON.stringify(area.widgets);
        });
        yield db.setObjectBulk(Object.keys(templates).map(tpl => [`widgets:${tpl}`, templates[tpl]]));
    });
};
widgets.reset = function () {
    return __awaiter(this, void 0, void 0, function* () {
        const defaultAreas = [
            { name: 'Draft Zone', template: 'global', location: 'header' },
            { name: 'Draft Zone', template: 'global', location: 'footer' },
            { name: 'Draft Zone', template: 'global', location: 'sidebar' },
        ];
        const [areas, drafts] = yield Promise.all([
            plugins.hooks.fire('filter:widgets.getAreas', defaultAreas),
            widgets.getArea('global', 'drafts'),
        ]);
        let saveDrafts = drafts || [];
        for (const area of areas) {
            /* eslint-disable no-await-in-loop */
            const areaData = yield widgets.getArea(area.template, area.location);
            saveDrafts = saveDrafts.concat(areaData);
            area.widgets = [];
            yield widgets.setArea(area);
        }
        yield widgets.setArea({
            template: 'global',
            location: 'drafts',
            widgets: saveDrafts,
        });
    });
};
widgets.resetTemplate = function (template) {
    return __awaiter(this, void 0, void 0, function* () {
        const area = yield db.getObject(`widgets:${template}.tpl`);
        const toBeDrafted = _.flatMap(Object.values(area), value => JSON.parse(value));
        yield db.delete(`widgets:${template}.tpl`);
        let draftWidgets = yield db.getObjectField('widgets:global', 'drafts');
        draftWidgets = JSON.parse(draftWidgets).concat(toBeDrafted);
        yield db.setObjectField('widgets:global', 'drafts', JSON.stringify(draftWidgets));
    });
};
widgets.resetTemplates = function (templates) {
    return __awaiter(this, void 0, void 0, function* () {
        for (const template of templates) {
            /* eslint-disable no-await-in-loop */
            yield widgets.resetTemplate(template);
        }
    });
};
require('../promisify').promisify(widgets);
