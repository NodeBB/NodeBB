import * as bootbox from 'bootbox';
import * as tx from 'translator';

bootbox.setDefaults({
	locale: config.userLang,
});

tx.translateKeys([
	'modules:bootbox.ok',
	'modules:bootbox.cancel',
	'modules:bootbox.confirm',
]).then((translations) => {
	bootbox.addLocale(config.userLang, {
		OK: translations[0],
		CANCEL: translations[1],
		CONFIRM: translations[2],
	});
	bootbox.setLocale(config.userLang);
});

export async function dialog(opts) {
	const [title, message, buttons] = await Promise.all([
		tx.translate(opts.title || ''),
		normalizeMessage(opts) || '',
		translateButtons(opts.buttons),
	]);

	const modal = bootbox.dialog({
		...opts,
		title,
		message,
		buttons,
	});
	return modal;
}

export async function alert(opts, callback) {
	const [title, message] = await Promise.all([
		opts && opts.title ? tx.translate(opts.title) : null,
		normalizeMessage(opts),
	]);
	callback = typeof callback === 'function' ? callback : opts.callback;

	return bootbox.alert({ ...opts, title, message, callback });
}

export async function confirm(opts, callback) {
	const [title, message] = await Promise.all([
		opts && opts.title ? tx.translate(opts.title) : null,
		normalizeMessage(opts),
	]);
	callback = typeof callback === 'function' ? callback : opts.callback;

	return bootbox.confirm({ ...opts, title, message, callback });
}

export async function prompt(opts, callback) {
	const [title, message] = await Promise.all([
		tx.translate(typeof opts === 'string' ? opts : opts.title),
		opts && opts.message ? normalizeMessage(opts) : null,
	]);
	callback = typeof callback === 'function' ? callback : opts.callback;

	return bootbox.prompt({ ...opts, title, message, callback });
}

function normalizeMessage(opts) {
	const msg = opts && opts.message ? opts.message : opts;
	if (msg instanceof jQuery) {
		// should be translated already via benchpress.render or translator.translate
		return msg;
	}
	return tx.translate(msg || '');
}

async function translateButtons(buttons) {
	if (!Object.keys(buttons || {}).length) return;
	const btnData = Object.values(buttons);
	return await Promise.all(btnData.map(async (btnData) => {
		return { ...btnData, label: await tx.translateKey(btnData.label) };
	}));
}
