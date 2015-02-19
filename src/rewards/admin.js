"use strict";

var rewards = {};


rewards.get = function(callback) {
	callback(false, {
		conditions: [
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
		],
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
				"name": "is string:",
				"conditional": "isstring"
			}
		],
		active: [
			{
				"rewardID": 0,
				"condition": "postcount",
				"conditional": "greaterthan",
				"value": 100,
				"disabled": 0
			},
			{
				"rewardID": 0,
				"condition": "lastLoggedIn",
				"conditional": "lesserthan",
				"value": 10,
				"disabled": 0
			}
		],
		rewards: [
			{
				"rewardID": 0,
				"name": "Add to Group",
				"inputs": [
					{
						"type": "select",
						"name": "groupname",
						"values": ["Group 1", "Group 2", "Group 3"],
					}
				]
			},
			{
				"rewardID": 1,
				"name": "Send alert message",
				"inputs": [
					{
						"type": "text",
						"name": "title",
					},
					{
						"type": "text",
						"name": "message",
					}
				]
			}
		]
	});
};

function getConditions() {

}

function getRewards() {

}

module.exports = rewards;