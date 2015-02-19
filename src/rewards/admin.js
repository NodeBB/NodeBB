"use strict";

var rewards = {};


rewards.get = function(callback) {
	callback({
		conditions: ["Reputation", "Post Count", "Last Logged in Time"],
		conditionals: [">", ">=", "<", "<=", "is string:"],
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
				],
				"disabled": 0
			},
			{
				"rewardID": 0,
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
				],
				"disabled": 0
			}
		]
	})
};

function getConditions() {

}

function getRewards() {

}

module.exports = rewards;