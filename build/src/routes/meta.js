'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const nconf_1 = __importDefault(require("nconf"));
function default_1(app, middleware, controllers) {
    app.get('/sitemap.xml', controllers.sitemap.render);
    app.get('/sitemap/pages.xml', controllers.sitemap.getPages);
    app.get('/sitemap/categories.xml', controllers.sitemap.getCategories);
    app.get(/\/sitemap\/topics\.(\d+)\.xml/, controllers.sitemap.getTopicPage);
    app.get('/robots.txt', controllers.robots);
    app.get('/manifest.webmanifest', controllers.manifest);
    app.get('/css/previews/:theme', controllers.admin.themes.get);
    app.get('/osd.xml', controllers.osd.handle);
    app.get('/service-worker.js', (req, res) => {
        res.status(200).type('application/javascript').set('Service-Worker-Allowed', `${nconf_1.default.get('relative_path')}/`).sendFile(path_1.default.join(__dirname, '../../../public/src/service-worker.js'));
    });
}
exports.default = default_1;
;
