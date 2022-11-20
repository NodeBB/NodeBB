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
const user_1 = __importDefault(require("../../user"));
const meta_1 = __importDefault(require("../../meta"));
const helpers_1 = __importDefault(require("../helpers"));
const groups = require('../../groups');
const accountHelpers = require('./helpers').defualt;
const privileges = require('../../privileges');
const file = require('../../file');
const editController = {};
editController.get = function (req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const [userData, canUseSignature] = yield Promise.all([
            accountHelpers.getUserDataByUserSlug(req.params.userslug, req.uid, req.query),
            privileges.global.can('signature', req.uid),
        ]);
        if (!userData) {
            return next();
        }
        userData.maximumSignatureLength = meta_1.default.config.maximumSignatureLength;
        userData.maximumAboutMeLength = meta_1.default.config.maximumAboutMeLength;
        userData.maximumProfileImageSize = meta_1.default.config.maximumProfileImageSize;
        userData.allowProfilePicture = !userData.isSelf || !!meta_1.default.config['reputation:disabled'] || userData.reputation >= meta_1.default.config['min:rep:profile-picture'];
        userData.allowCoverPicture = !userData.isSelf || !!meta_1.default.config['reputation:disabled'] || userData.reputation >= meta_1.default.config['min:rep:cover-picture'];
        userData.allowProfileImageUploads = meta_1.default.config.allowProfileImageUploads;
        userData.allowedProfileImageExtensions = user_1.default.getAllowedProfileImageExtensions().map((ext) => `.${ext}`).join(', ');
        userData.allowMultipleBadges = meta_1.default.config.allowMultipleBadges === 1;
        userData.allowAccountDelete = meta_1.default.config.allowAccountDelete === 1;
        userData.allowWebsite = !userData.isSelf || !!meta_1.default.config['reputation:disabled'] || userData.reputation >= meta_1.default.config['min:rep:website'];
        userData.allowAboutMe = !userData.isSelf || !!meta_1.default.config['reputation:disabled'] || userData.reputation >= meta_1.default.config['min:rep:aboutme'];
        userData.allowSignature = canUseSignature && (!userData.isSelf || !!meta_1.default.config['reputation:disabled'] || userData.reputation >= meta_1.default.config['min:rep:signature']);
        userData.profileImageDimension = meta_1.default.config.profileImageDimension;
        userData.defaultAvatar = user_1.default.getDefaultAvatar();
        userData.groups = userData.groups.filter((g) => g && g.userTitleEnabled && !groups.isPrivilegeGroup(g.name) && g.name !== 'registered-users');
        if (!userData.allowMultipleBadges) {
            userData.groupTitle = userData.groupTitleArray[0];
        }
        userData.groups.sort((a, b) => {
            const i1 = userData.groupTitleArray.indexOf(a.name);
            const i2 = userData.groupTitleArray.indexOf(b.name);
            if (i1 === -1) {
                return 1;
            }
            else if (i2 === -1) {
                return -1;
            }
            return i1 - i2;
        });
        userData.groups.forEach((group) => {
            group.userTitle = group.userTitle || group.displayName;
            group.selected = userData.groupTitleArray.includes(group.name);
        });
        userData.groupSelectSize = Math.min(10, Math.max(5, userData.groups.length + 1));
        userData.title = `[[pages:account/edit, ${userData.username}]]`;
        userData.breadcrumbs = helpers_1.default.buildBreadcrumbs([
            {
                text: userData.username,
                url: `/user/${userData.userslug}`,
            },
            {
                text: '[[user:edit]]',
            },
        ]);
        userData.editButtons = [];
        res.render('account/edit', userData);
    });
};
editController.password = function (req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        yield renderRoute('password', req, res, next);
    });
};
editController.username = function (req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        yield renderRoute('username', req, res, next);
    });
};
editController.email = function (req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const targetUid = yield user_1.default.getUidByUserslug(req.params.userslug);
        if (!targetUid) {
            return next();
        }
        const [isAdminOrGlobalMod, canEdit] = yield Promise.all([
            user_1.default.isAdminOrGlobalMod(req.uid),
            privileges.users.canEdit(req.uid, targetUid),
        ]);
        if (!isAdminOrGlobalMod && !canEdit) {
            return next();
        }
        req.session.returnTo = `/uid/${targetUid}`;
        req.session.registration = req.session.registration || {};
        req.session.registration.updateEmail = true;
        req.session.registration.uid = targetUid;
        helpers_1.default.redirect(res, '/register/complete');
    });
};
function renderRoute(name, req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const userData = yield getUserData(req);
        if (!userData) {
            return next();
        }
        if (meta_1.default.config[`${name}:disableEdit`] && !userData.isAdmin) {
            return helpers_1.default.notAllowed(req, res);
        }
        if (name === 'password') {
            userData.minimumPasswordLength = meta_1.default.config.minimumPasswordLength;
            userData.minimumPasswordStrength = meta_1.default.config.minimumPasswordStrength;
        }
        userData.title = `[[pages:account/edit/${name}, ${userData.username}]]`;
        userData.breadcrumbs = helpers_1.default.buildBreadcrumbs([
            {
                text: userData.username,
                url: `/user/${userData.userslug}`,
            },
            {
                text: '[[user:edit]]',
                url: `/user/${userData.userslug}/edit`,
            },
            {
                text: `[[user:${name}]]`,
            },
        ]);
        res.render(`account/edit/${name}`, userData);
    });
}
function getUserData(req) {
    return __awaiter(this, void 0, void 0, function* () {
        const userData = yield accountHelpers.getUserDataByUserSlug(req.params.userslug, req.uid, req.query);
        if (!userData) {
            return null;
        }
        userData.hasPassword = yield user_1.default.hasPassword(userData.uid);
        return userData;
    });
}
editController.uploadPicture = function (req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const userPhoto = req.files.files[0];
        try {
            const updateUid = yield user_1.default.getUidByUserslug(req.params.userslug);
            const isAllowed = yield privileges.users.canEdit(req.uid, updateUid);
            if (!isAllowed) {
                return helpers_1.default.notAllowed(req, res);
            }
            yield user_1.default.checkMinReputation(req.uid, updateUid, 'min:rep:profile-picture');
            const image = yield user_1.default.uploadCroppedPictureFile({
                callerUid: req.uid,
                uid: updateUid,
                file: userPhoto,
            });
            res.json([{
                    name: userPhoto.name,
                    url: image.url,
                }]);
        }
        catch (err) {
            next(err);
        }
        finally {
            yield file.delete(userPhoto.path);
        }
    });
};
