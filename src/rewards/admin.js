"use strict";

var rewards = {},
	async = require('async'),
	plugins = require('../plugins'),
	db = require('../database');

var defaults = {
	conditionals: [
		{
			"name": ">",
			"conditional": "greaterthan"
		},
		{
			"name": ">=",
			"conditional": "greaterorequalthan"
		},
		{
			"name": "<",
			"conditional": "lesserthan"
		},
		{
			"name": "<=",
			"conditional": "lesserorequalthan"
		},
		{
			"name": "string:",
			"conditional": "string"
		}
	]
};

rewards.save = function(data, callback) {
	
};

rewards.get = function(callback) {
	async.parallel({
		active: getActiveRewards,
		conditions: function(next) {
			plugins.fireHook('filter:rewards.conditions', [
				{
					"name": "Reputation",
					"condition": "reputation"
				},
				{
					"name": "Post Count",
					"condition": "postcount"
				},
				{
					"name": "Last Logged in Time",
					"condition": "lastLoggedIn"
				}
			], next);
		},
		conditionals: function(next) {
			plugins.fireHook('filter:rewards.conditionals', defaults.conditionals, next);
		},
		rewards: function(next) {
			plugins.fireHook('filter:rewards.rewards', [
				{
					"id": "core:add-to-group",
					"name": "Add to Group",
					"inputs": [
						{
							"type": "select",
							"name": "groupname",
							"label": "Group Name:",
							"values": [
								{
									"name": "Group 1",
									"value": "group1"
								},
								{
									"name": "Group 2",
									"value": "group2"
								},
								{
									"name": "Group 3",
									"value": "group3"
								}
							],
						}
					]
				},
				{
					"id": "core:alert-user",
					"name": "Send alert message",
					"inputs": [
						{
							"type": "text",
							"name": "title",
							"label": "Title:"
						},
						{
							"type": "text",
							"name": "message",
							"label": "Message:"
						}
					]
				}
			], next);
		}
	}, callback);
};

function getConditions() {

}

function getActiveRewards(callback) {
	callback(false, [
		{
			"id": "core:alert-user",
			"condition": "postcount",
			"conditional": "greaterthan",
			"rewards": {
				"title": "Here is a title",
				"message": "here is a message"
			},
			"value": 100,
			"disabled": false
		},
		{
			"id": "core:add-to-group",
			"condition": "lastLoggedIn",
			"conditional": "lesserthan",
			"rewards": {
				"groupname": "group2"
			},
			"value": 10,
			"disabled": true
		}
	]);
}

module.exports = rewards;