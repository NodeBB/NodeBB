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
exports.default = {
    name: 'Widget visibility groups',
    timestamp: Date.UTC(2018, 10, 10),
    method: function () {
        return __awaiter(this, void 0, void 0, function* () {
            const widgetAdmin = require('../../widgets/admin');
            const widgets = require('../../widgets');
            const areas = yield widgetAdmin.getAreas();
            for (const area of areas) {
                if (area.data.length) {
                    // area.data is actually an array of widgets
                    area.widgets = area.data;
                    area.widgets.forEach((widget) => {
                        if (widget && widget.data) {
                            const groupsToShow = ['administrators', 'Global Moderators'];
                            if (widget.data['hide-guests'] !== 'on') {
                                groupsToShow.push('guests');
                            }
                            if (widget.data['hide-registered'] !== 'on') {
                                groupsToShow.push('registered-users');
                            }
                            widget.data.groups = groupsToShow;
                            // if we are showing to all 4 groups, set to empty array
                            // empty groups is shown to everyone
                            if (groupsToShow.length === 4) {
                                widget.data.groups.length = 0;
                            }
                        }
                    });
                    // eslint-disable-next-line no-await-in-loop
                    yield widgets.setArea(area);
                }
            }
        });
    },
};
