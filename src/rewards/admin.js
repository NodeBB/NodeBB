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
				"name": "string:",
				"conditional": "string"
			}
		],
		active: [
			{
				"rewardID": 1,
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
				"rewardID": 0,
				"condition": "lastLoggedIn",
				"conditional": "lesserthan",
				"rewards": {
					"groupname": "group2"
				},
				"value": 10,
				"disabled": true
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
				"rewardID": 1,
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
		]
	});
};

function getConditions() {

}

function getRewards() {

}

module.exports = rewards;