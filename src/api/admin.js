'use strict';

const nconf = require('nconf');

const meta = require('../meta');
const analytics = require('../analytics');
const privileges = require('../privileges');
const groups = require('../groups');
const plugins = require('../plugins');
const events = require('../events');
const postsCache = require('../posts/cache');

const adminApi = module.exports;

adminApi.updateSetting = async (caller, { setting, value }) => {
	const ok = await privileges.admin.can('admin:settings', caller.uid);
	if (!ok) {
		throw new Error('[[error:no-privileges]]');
	}

	await meta.configs.set(setting, value);
};

adminApi.getAnalyticsKeys = async () => {
	const keys = await analytics.getKeys();

	// Sort keys alphabetically
	return keys.sort((a, b) => (a < b ? -1 : 1));
};

adminApi.getAnalyticsData = async (caller, { set, until, amount, units }) => {
	// Default returns views from past 24 hours, by hour
	if (!amount) {
		if (units === 'days') {
			amount = 30;
		} else {
			amount = 24;
		}
	}
	const getStats = units === 'days' ? analytics.getDailyStatsForSet : analytics.getHourlyStatsForSet;
	return await getStats(`analytics:${set}`, parseInt(until, 10) || Date.now(), amount);
};

adminApi.listGroups = async () => {
	// N.B. Returns all groups, even hidden. Beware of leakage.
	// Access control handled at controller level

	const payload = await groups.getNonPrivilegeGroups('groups:createtime', 0, -1, { ephemeral: false });
	return { groups: payload };
};
adminApi.plugins = {};
adminApi.plugins.install = async (caller, { id, version }) => {
	if (!id || !version) {
		throw new Error('[[error:invalid-data]]');
	}
	if (await plugins.isSystemPlugin(id)) {
		throw new Error('[[error:cannot-install-system-plugin]]');
	}

	const isStarterPlan = nconf.get('saas_plan') === 'starter';
	if (isStarterPlan || nconf.get('acpPluginInstallDisabled')) {
		throw new Error('[[error:plugin-installation-via-acp-disabled]]');
	}

	postsCache.reset();

	await plugins.checkWhitelist(id, version);
	await plugins.toggleInstall(id, version, 'install');
	await events.log({
		type: 'plugin-install',
		text: id,
		version: version,
		uid: caller.uid,
	});
};

adminApi.plugins.uninstall = async (caller, { id }) => {
	if (!id) {
		throw new Error('[[error:invalid-data]]');
	}
	if (await plugins.isSystemPlugin(id)) {
		throw new Error('[[error:cannot-uninstall-system-plugin]]');
	}
	const isInstalled = await plugins.isInstalled(id);
	if (!isInstalled) {
		throw new Error('[[error:plugin-not-installed]]');
	}
	const isStarterPlan = nconf.get('saas_plan') === 'starter';
	if (isStarterPlan || nconf.get('acpPluginInstallDisabled')) {
		throw new Error('[[error:plugin-installation-via-acp-disabled]]');
	}

	postsCache.reset();

	await plugins.toggleInstall(id, '', 'uninstall');
	await events.log({
		type: 'plugin-uninstall',
		text: id,
		uid: caller.uid,
	});
};

adminApi.plugins.setActive = async (caller, { id, active }) => {
	if (await plugins.isSystemPlugin(id)) {
		throw new Error('[[error:cannot-toggle-system-plugin]]');
	}
	postsCache.reset();
	const data = await plugins.toggleActive(id, active);
	await events.log({
		type: `plugin-${data.active ? 'activate' : 'deactivate'}`,
		text: id,
		uid: caller.uid,
	});
	return data;
};

adminApi.plugins.upgrade = async (caller, { id, version}) => {
	if (!id || !version) {
		throw new Error('[[error:invalid-data]]');
	}
	if (await plugins.isSystemPlugin(id)) {
		throw new Error('[[error:cannot-upgrade-system-plugin]]');
	}
	const isInstalled = await plugins.isInstalled(id);
	if (!isInstalled) {
		throw new Error('[[error:plugin-not-installed]]');
	}
	if (nconf.get('acpPluginInstallDisabled')) {
		throw new Error('[[error:plugin-installation-via-acp-disabled]]');
	}

	await plugins.checkWhitelist(id, version);
	return await plugins.upgrade(id, version);
};