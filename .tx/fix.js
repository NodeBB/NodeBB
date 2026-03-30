'use strict';

const { readFile, writeFile } = require('fs').promises;

(async () => {
	const contents = await readFile('./config', { encoding: 'utf-8' });
	const blocks = contents
		.split('\n\n')
		.map((block) => {
			block = block.split('\n').sort((a, b) => {
				if (!a.startsWith('trans') || !b.startsWith('trans')) {
					return 0;
				}

				return a.localeCompare(b);
			})

			return block.join('\n');
		});

	await writeFile('./config', blocks.join('\n\n'), { encoding: 'utf-8' });
})();