'use strict';
import widgetAdmin from '../../widgets/admin';
import widgets from '../../widgets';

export const obj = {
	name: 'Widget visibility groups',
	timestamp: Date.UTC(2018, 10, 10),
	method: async function () {

		const areas = await widgetAdmin.getAreas();
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
				await widgets.setArea(area);
			}
		}
	},
};
