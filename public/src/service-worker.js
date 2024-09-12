'use strict';

self.addEventListener('install', () => {
	// Register self as the primary service worker
	self.skipWaiting();
});

self.addEventListener('activate', (event) => {
	// Take responsibility over existing clients from old service worker
	event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', function (event) {
	// This is the code that ignores post requests
	// https://github.com/NodeBB/NodeBB/issues/9151
	// https://github.com/w3c/ServiceWorker/issues/1141
	// https://stackoverflow.com/questions/54448367/ajax-xmlhttprequest-progress-monitoring-doesnt-work-with-service-workers
	if (event.request.method === 'POST') {
		return;
	}

	event.respondWith(caches.match(event.request).then(function (response) {
		if (!response) {
			return fetch(event.request);
		}

		return response;
	}));
});

/**
 * The following code is used by nodebb-plugin-web-push
 * There is a very strong argument to be made that this is plugin-specific
 * code and does not belong in core.
 *
 * Additional R&D is required to determine how to allow plugins to inject
 * code into the service worker.
 */

// Register event listener for the 'push' event.
self.addEventListener('push', function (event) {
	// Keep the service worker alive until the notification is created.
	const { title, body, data } = event.data.json();
	event.waitUntil(
		self.registration.showNotification(title, { body, data })
	);
});

self.addEventListener('notificationclick', (event) => {
	event.notification.close();
	let target;
	if (event.notification.data && event.notification.data.url) {
		target = new URL(event.notification.data.url);
	}

	// This looks to see if the current is already open and focuses if it is
	event.waitUntil(
		self.clients
			.matchAll({
				type: 'window',
				includeUncontrolled: true,
			})
			.then((clientList) => {
				// eslint-disable-next-line no-restricted-syntax
				for (const client of clientList) {
					const { hostname } = new URL(client.url);
					if (target && hostname === target.hostname && 'focus' in client) {
						client.postMessage({
							action: 'ajaxify',
							url: target.pathname,
						});
						return client.focus();
					}
				}
				if (self.clients.openWindow) return self.clients.openWindow(target.pathname);
			})
	);
});
