'use strict';

const { collection, getDocs, query } = require('firebase/firestore/lite');

function extractDataFromDocs(docs) {
	return docs.map(doc => doc.data());
}

module.exports = function (module, globalFirestoreDB) {
	module.get = async function getCollectionDocs(collectionName) {
		const collectionRef = collection(globalFirestoreDB, collectionName);
		const refQuery = query(collectionRef);
		const rawDocuments = await getDocs(refQuery);

		return extractDataFromDocs(rawDocuments.docs);
	};
};
