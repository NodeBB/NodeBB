'use strict';

const { initializeApp } = require('firebase/app');
const { getFirestore } = require('firebase/firestore/lite');

const firebaseConfig = {
	apiKey: process.env.apiKey,
	appId: process.env.appId,
	projectId: process.env.projectId,
	storageBucket: process.env.storageBucket,
};

initializeApp(firebaseConfig);

const globalFirestoreDB = getFirestore();
const connection = module.exports;

connection.connect = function () {
	return globalFirestoreDB;
};
