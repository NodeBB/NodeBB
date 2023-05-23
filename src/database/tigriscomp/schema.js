'use strict';

module.exports = {
	title: 'objects',
	additionalProperties: false,
	type: 'object',
	properties: {
		$k: {
			type: 'array',
			items: {
				type: 'string',
			},
		},
		_key: {
			type: 'string',
			searchIndex: true,
		},
		admin: {
			type: 'integer',
			format: 'int32',
		},
		adminReloginDuration: {
			type: 'integer',
			format: 'int32',
		},
		administrators: {
			type: 'string',
		},
		allowAccountDelete: {
			type: 'integer',
			format: 'int32',
		},
		allowGuestHandles: {
			type: 'integer',
			format: 'int32',
		},
		allowGuestReplyNotifications: {
			type: 'integer',
			format: 'int32',
		},
		allowMultipleBadges: {
			type: 'integer',
			format: 'int32',
		},
		allowPrivateGroups: {
			type: 'integer',
			format: 'int32',
		},
		allowProfileImageUploads: {
			type: 'integer',
			format: 'int32',
		},
		allowTopicsThumbnail: {
			type: 'integer',
			format: 'int32',
		},
		allowUserHomePage: {
			type: 'integer',
			format: 'int32',
		},
		allowedFileExtensions: {
			type: 'string',
		},
		autoApproveTime: {
			type: 'integer',
			format: 'int32',
		},
		autoDetectLang: {
			type: 'integer',
			format: 'int32',
		},
		banned___users: {
			type: 'string',
		},
		bgColor: {
			type: 'string',
		},
		bodyShort: {
			type: 'string',
		},
		bookmarkThreshold: {
			type: 'integer',
			format: 'int32',
		},
		bootswatchSkin: {
			type: 'string',
		},
		categoriesPerPage: {
			type: 'integer',
			format: 'int32',
		},
		categoryWatchState: {
			type: 'string',
		},
		chatDeleteDuration: {
			type: 'integer',
			format: 'int32',
		},
		chatEditDuration: {
			type: 'integer',
			format: 'int32',
		},
		chatMessageDelay: {
			type: 'integer',
			format: 'int32',
		},
		cid: {
			type: 'integer',
			format: 'int32',
		},
		cid___0___privileges___groups___ban: {
			type: 'string',
		},
		cid___0___privileges___groups___chat: {
			type: 'string',
		},
		cid___0___privileges___groups___local___login: {
			type: 'string',
		},
		cid___0___privileges___groups___search___content: {
			type: 'string',
		},
		cid___0___privileges___groups___search___tags: {
			type: 'string',
		},
		cid___0___privileges___groups___search___users: {
			type: 'string',
		},
		cid___0___privileges___groups___signature: {
			type: 'string',
		},
		cid___0___privileges___groups___upload___post___file: {
			type: 'string',
		},
		cid___0___privileges___groups___upload___post___image: {
			type: 'string',
		},
		cid___0___privileges___groups___view___groups: {
			type: 'string',
		},
		cid___0___privileges___groups___view___tags: {
			type: 'string',
		},
		cid___0___privileges___groups___view___users: {
			type: 'string',
		},
		cid___0___privileges___groups___view___users___info: {
			type: 'string',
		},
		cid___1___privileges___groups___find: {
			type: 'string',
		},
		cid___1___privileges___groups___posts___delete: {
			type: 'string',
		},
		cid___1___privileges___groups___posts___downvote: {
			type: 'string',
		},
		cid___1___privileges___groups___posts___edit: {
			type: 'string',
		},
		cid___1___privileges___groups___posts___history: {
			type: 'string',
		},
		cid___1___privileges___groups___posts___upvote: {
			type: 'string',
		},
		cid___1___privileges___groups___posts___view_deleted: {
			type: 'string',
		},
		cid___1___privileges___groups___purge: {
			type: 'string',
		},
		cid___1___privileges___groups___read: {
			type: 'string',
		},
		cid___1___privileges___groups___topics___create: {
			type: 'string',
		},
		cid___1___privileges___groups___topics___delete: {
			type: 'string',
		},
		cid___1___privileges___groups___topics___read: {
			type: 'string',
		},
		cid___1___privileges___groups___topics___reply: {
			type: 'string',
		},
		cid___1___privileges___groups___topics___schedule: {
			type: 'string',
		},
		cid___1___privileges___groups___topics___tag: {
			type: 'string',
		},
		cid___2___privileges___groups___find: {
			type: 'string',
		},
		cid___2___privileges___groups___posts___delete: {
			type: 'string',
		},
		cid___2___privileges___groups___posts___downvote: {
			type: 'string',
		},
		cid___2___privileges___groups___posts___edit: {
			type: 'string',
		},
		cid___2___privileges___groups___posts___history: {
			type: 'string',
		},
		cid___2___privileges___groups___posts___upvote: {
			type: 'string',
		},
		cid___2___privileges___groups___posts___view_deleted: {
			type: 'string',
		},
		cid___2___privileges___groups___purge: {
			type: 'string',
		},
		cid___2___privileges___groups___read: {
			type: 'string',
		},
		cid___2___privileges___groups___topics___create: {
			type: 'string',
		},
		cid___2___privileges___groups___topics___delete: {
			type: 'string',
		},
		cid___2___privileges___groups___topics___read: {
			type: 'string',
		},
		cid___2___privileges___groups___topics___reply: {
			type: 'string',
		},
		cid___2___privileges___groups___topics___schedule: {
			type: 'string',
		},
		cid___2___privileges___groups___topics___tag: {
			type: 'string',
		},
		cid___3___privileges___groups___find: {
			type: 'string',
		},
		cid___3___privileges___groups___posts___delete: {
			type: 'string',
		},
		cid___3___privileges___groups___posts___downvote: {
			type: 'string',
		},
		cid___3___privileges___groups___posts___edit: {
			type: 'string',
		},
		cid___3___privileges___groups___posts___history: {
			type: 'string',
		},
		cid___3___privileges___groups___posts___upvote: {
			type: 'string',
		},
		cid___3___privileges___groups___posts___view_deleted: {
			type: 'string',
		},
		cid___3___privileges___groups___purge: {
			type: 'string',
		},
		cid___3___privileges___groups___read: {
			type: 'string',
		},
		cid___3___privileges___groups___topics___create: {
			type: 'string',
		},
		cid___3___privileges___groups___topics___delete: {
			type: 'string',
		},
		cid___3___privileges___groups___topics___read: {
			type: 'string',
		},
		cid___3___privileges___groups___topics___reply: {
			type: 'string',
		},
		cid___3___privileges___groups___topics___schedule: {
			type: 'string',
		},
		cid___3___privileges___groups___topics___tag: {
			type: 'string',
		},
		cid___4___privileges___groups___find: {
			type: 'string',
		},
		cid___4___privileges___groups___posts___delete: {
			type: 'string',
		},
		cid___4___privileges___groups___posts___downvote: {
			type: 'string',
		},
		cid___4___privileges___groups___posts___edit: {
			type: 'string',
		},
		cid___4___privileges___groups___posts___history: {
			type: 'string',
		},
		cid___4___privileges___groups___posts___upvote: {
			type: 'string',
		},
		cid___4___privileges___groups___posts___view_deleted: {
			type: 'string',
		},
		cid___4___privileges___groups___purge: {
			type: 'string',
		},
		cid___4___privileges___groups___read: {
			type: 'string',
		},
		cid___4___privileges___groups___topics___create: {
			type: 'string',
		},
		cid___4___privileges___groups___topics___delete: {
			type: 'string',
		},
		cid___4___privileges___groups___topics___read: {
			type: 'string',
		},
		cid___4___privileges___groups___topics___reply: {
			type: 'string',
		},
		cid___4___privileges___groups___topics___schedule: {
			type: 'string',
		},
		cid___4___privileges___groups___topics___tag: {
			type: 'string',
		},
		class: {
			type: 'string',
		},
		color: {
			type: 'string',
		},
		composer__allowPluginHelp: {
			type: 'integer',
			format: 'int32',
		},
		composer__showHelpTab: {
			type: 'integer',
			format: 'int32',
		},
		content: {
			type: 'string',
		},
		createtime: {
			type: 'number',
		},
		cross___origin___embedder___policy: {
			type: 'integer',
			format: 'int32',
		},
		cross___origin___opener___policy: {
			type: 'string',
		},
		cross___origin___resource___policy: {
			type: 'string',
		},
		dailyDigestFreq: {
			type: 'string',
		},
		datetime: {
			type: 'number',
		},
		defaultLang: {
			type: 'string',
		},
		description: {
			type: 'string',
		},
		descriptionParsed: {
			type: 'string',
		},
		digestHour: {
			type: 'integer',
			format: 'int32',
		},
		disableChat: {
			type: 'integer',
			format: 'int32',
		},
		disableCustomUserSkins: {
			type: 'integer',
			format: 'int32',
		},
		disableEmailSubscriptions: {
			type: 'integer',
			format: 'int32',
		},
		disableJoinRequests: {
			type: 'integer',
			format: 'int32',
		},
		disableLeave: {
			type: 'integer',
			format: 'int32',
		},
		disableRecentCategoryFilter: {
			type: 'integer',
			format: 'int32',
		},
		disableSignatures: {
			type: 'integer',
			format: 'int32',
		},
		disabled: {
			type: 'integer',
			format: 'int32',
		},
		downvote__disabled: {
			type: 'integer',
			format: 'int32',
		},
		downvotesPerDay: {
			type: 'integer',
			format: 'int32',
		},
		downvotesPerUserPerDay: {
			type: 'integer',
			format: 'int32',
		},
		eid: {
			type: 'integer',
			format: 'int32',
		},
		emailConfirmExpiry: {
			type: 'integer',
			format: 'int32',
		},
		emailConfirmInterval: {
			type: 'integer',
			format: 'int32',
		},
		emailPrompt: {
			type: 'integer',
			format: 'int32',
		},
		email__disableEdit: {
			type: 'integer',
			format: 'int32',
		},
		email__smtpTransport__pool: {
			type: 'integer',
			format: 'int32',
		},
		enablePostHistory: {
			type: 'integer',
			format: 'int32',
		},
		enabled: {
			type: 'boolean',
		},
		eventLoopCheckEnabled: {
			type: 'integer',
			format: 'int32',
		},
		eventLoopInterval: {
			type: 'integer',
			format: 'int32',
		},
		eventLoopLagThreshold: {
			type: 'integer',
			format: 'int32',
		},
		feeds__disableRSS: {
			type: 'integer',
			format: 'int32',
		},
		feeds__disableSitemap: {
			type: 'integer',
			format: 'int32',
		},
		flags__actionOnReject: {
			type: 'string',
		},
		flags__actionOnResolve: {
			type: 'string',
		},
		flags__autoFlagOnDownvoteThreshold: {
			type: 'integer',
			format: 'int32',
		},
		flags__limitPerTarget: {
			type: 'integer',
			format: 'int32',
		},
		gdpr_enabled: {
			type: 'integer',
			format: 'int32',
		},
		global___moderators: {
			type: 'string',
		},
		groupTitle: {
			type: 'string',
		},
		groups: {
			type: 'string',
		},
		groupsExemptFromMaintenanceMode: {
			type: 'string',
		},
		groupsExemptFromPostQueue: {
			type: 'string',
		},
		guestsIncrementTopicViews: {
			type: 'integer',
			format: 'int32',
		},
		hidden: {
			type: 'integer',
			format: 'int32',
		},
		hideEmail: {
			type: 'integer',
			format: 'int32',
		},
		hideFullname: {
			type: 'integer',
			format: 'int32',
		},
		hsts___enabled: {
			type: 'integer',
			format: 'int32',
		},
		hsts___maxage: {
			type: 'integer',
			format: 'int32',
		},
		hsts___preload: {
			type: 'integer',
			format: 'int32',
		},
		hsts___subdomains: {
			type: 'integer',
			format: 'int32',
		},
		icon: {
			type: 'string',
		},
		iconClass: {
			type: 'string',
		},
		id: {
			type: 'string',
		},
		image: {
			type: 'string',
		},
		imageClass: {
			type: 'string',
		},
		importance: {
			type: 'integer',
			format: 'int32',
		},
		includeUnverifiedEmails: {
			type: 'integer',
			format: 'int32',
		},
		incrementTopicViewsInterval: {
			type: 'integer',
			format: 'int32',
		},
		initialPostDelay: {
			type: 'integer',
			format: 'int32',
		},
		inviteExpiration: {
			type: 'integer',
			format: 'int32',
		},
		ip: {
			type: 'string',
		},
		isSection: {
			type: 'integer',
			format: 'int32',
		},
		joindate: {
			type: 'number',
		},
		lastonline: {
			type: 'number',
		},
		lastposttime: {
			type: 'string',
		},
		link: {
			type: 'string',
		},
		lockoutDuration: {
			type: 'integer',
			format: 'int32',
		},
		loginAttempts: {
			type: 'integer',
			format: 'int32',
		},
		loginDays: {
			type: 'integer',
			format: 'int32',
		},
		loginSeconds: {
			type: 'integer',
			format: 'int32',
		},
		mainPid: {
			type: 'integer',
			format: 'int32',
		},
		maintenanceMode: {
			type: 'integer',
			format: 'int32',
		},
		maintenanceModeStatus: {
			type: 'integer',
			format: 'int32',
		},
		maxPostsPerPage: {
			type: 'integer',
			format: 'int32',
		},
		maxReconnectionAttempts: {
			type: 'integer',
			format: 'int32',
		},
		maxTopicsPerPage: {
			type: 'integer',
			format: 'int32',
		},
		maxUserSessions: {
			type: 'integer',
			format: 'int32',
		},
		maximumAboutMeLength: {
			type: 'integer',
			format: 'int32',
		},
		maximumChatMessageLength: {
			type: 'integer',
			format: 'int32',
		},
		maximumCoverImageSize: {
			type: 'integer',
			format: 'int32',
		},
		maximumFileSize: {
			type: 'integer',
			format: 'int32',
		},
		maximumGroupNameLength: {
			type: 'integer',
			format: 'int32',
		},
		maximumGroupTitleLength: {
			type: 'integer',
			format: 'int32',
		},
		maximumInvites: {
			type: 'integer',
			format: 'int32',
		},
		maximumPostLength: {
			type: 'integer',
			format: 'int32',
		},
		maximumProfileImageSize: {
			type: 'integer',
			format: 'int32',
		},
		maximumRelatedTopics: {
			type: 'integer',
			format: 'int32',
		},
		maximumSignatureLength: {
			type: 'integer',
			format: 'int32',
		},
		maximumTagLength: {
			type: 'integer',
			format: 'int32',
		},
		maximumTagsPerTopic: {
			type: 'integer',
			format: 'int32',
		},
		maximumTitleLength: {
			type: 'integer',
			format: 'int32',
		},
		maximumUsernameLength: {
			type: 'integer',
			format: 'int32',
		},
		maximumUsersInChatRoom: {
			type: 'integer',
			format: 'int32',
		},
		memberCount: {
			type: 'integer',
			format: 'int32',
		},
		members: {
			type: 'array',
			items: {
				type: 'string',
			},
		},
		min__rep__aboutme: {
			type: 'integer',
			format: 'int32',
		},
		min__rep__chat: {
			type: 'integer',
			format: 'int32',
		},
		min__rep__cover___picture: {
			type: 'integer',
			format: 'int32',
		},
		min__rep__downvote: {
			type: 'integer',
			format: 'int32',
		},
		min__rep__flag: {
			type: 'integer',
			format: 'int32',
		},
		min__rep__profile___picture: {
			type: 'integer',
			format: 'int32',
		},
		min__rep__signature: {
			type: 'integer',
			format: 'int32',
		},
		min__rep__upvote: {
			type: 'integer',
			format: 'int32',
		},
		min__rep__website: {
			type: 'integer',
			format: 'int32',
		},
		minimumPasswordLength: {
			type: 'integer',
			format: 'int32',
		},
		minimumPasswordStrength: {
			type: 'integer',
			format: 'int32',
		},
		minimumPostLength: {
			type: 'integer',
			format: 'int32',
		},
		minimumTagLength: {
			type: 'integer',
			format: 'int32',
		},
		minimumTagsPerTopic: {
			type: 'integer',
			format: 'int32',
		},
		minimumTitleLength: {
			type: 'integer',
			format: 'int32',
		},
		minimumUsernameLength: {
			type: 'integer',
			format: 'int32',
		},
		name: {
			type: 'string',
		},
		necroThreshold: {
			type: 'integer',
			format: 'int32',
		},
		newbiePostDelay: {
			type: 'integer',
			format: 'int32',
		},
		newbiePostDelayThreshold: {
			type: 'integer',
			format: 'int32',
		},
		newbiePostEditDuration: {
			type: 'integer',
			format: 'int32',
		},
		nextCid: {
			type: 'integer',
			format: 'int32',
		},
		nextEid: {
			type: 'integer',
			format: 'int32',
		},
		nextPid: {
			type: 'integer',
			format: 'int32',
		},
		nextTid: {
			type: 'integer',
			format: 'int32',
		},
		nextUid: {
			type: 'integer',
			format: 'int32',
		},
		nid: {
			type: 'string',
		},
		notificationSendDelay: {
			type: 'integer',
			format: 'int32',
		},
		notificationType_follow: {
			type: 'string',
		},
		notificationType_group___invite: {
			type: 'string',
		},
		notificationType_group___leave: {
			type: 'string',
		},
		notificationType_group___request___membership: {
			type: 'string',
		},
		notificationType_mention: {
			type: 'string',
		},
		notificationType_new___chat: {
			type: 'string',
		},
		notificationType_new___group___chat: {
			type: 'string',
		},
		notificationType_new___post___flag: {
			type: 'string',
		},
		notificationType_new___register: {
			type: 'string',
		},
		notificationType_new___reply: {
			type: 'string',
		},
		notificationType_new___topic: {
			type: 'string',
		},
		notificationType_new___user___flag: {
			type: 'string',
		},
		notificationType_post___edit: {
			type: 'string',
		},
		notificationType_post___queue: {
			type: 'string',
		},
		notificationType_upvote: {
			type: 'string',
		},
		numRecentReplies: {
			type: 'integer',
			format: 'int32',
		},
		onlineCutoff: {
			type: 'integer',
			format: 'int32',
		},
		order: {
			type: 'integer',
			format: 'int32',
		},
		orphanExpiryDays: {
			type: 'integer',
			format: 'int32',
		},
		parentCid: {
			type: 'integer',
			format: 'int32',
		},
		password: {
			type: 'string',
		},
		passwordExpiryDays: {
			type: 'integer',
			format: 'int32',
		},
		password__shaWrapped: {
			type: 'integer',
			format: 'int32',
		},
		pid: {
			type: 'integer',
			format: 'int32',
		},
		postCacheSize: {
			type: 'integer',
			format: 'int32',
		},
		postCount: {
			type: 'integer',
			format: 'int32',
		},
		postDelay: {
			type: 'integer',
			format: 'int32',
		},
		postDeleteDuration: {
			type: 'integer',
			format: 'int32',
		},
		postEditDuration: {
			type: 'integer',
			format: 'int32',
		},
		postQueue: {
			type: 'integer',
			format: 'int32',
		},
		postQueueReputationThreshold: {
			type: 'integer',
			format: 'int32',
		},
		post_count: {
			type: 'integer',
			format: 'int32',
		},
		postcount: {
			type: 'integer',
			format: 'int32',
		},
		postercount: {
			type: 'integer',
			format: 'int32',
		},
		postsPerPage: {
			type: 'integer',
			format: 'int32',
		},
		preventTopicDeleteAfterReplies: {
			type: 'integer',
			format: 'int32',
		},
		private: {
			type: 'integer',
			format: 'int32',
		},
		privateUploads: {
			type: 'integer',
			format: 'int32',
		},
		profileImageDimension: {
			type: 'integer',
			format: 'int32',
		},
		profile__convertProfileImageToPNG: {
			type: 'integer',
			format: 'int32',
		},
		profile__keepAllUserImages: {
			type: 'integer',
			format: 'int32',
		},
		recentMaxTopics: {
			type: 'integer',
			format: 'int32',
		},
		reconnectionDelay: {
			type: 'integer',
			format: 'int32',
		},
		registered___users: {
			type: 'string',
		},
		registrationApprovalType: {
			type: 'string',
		},
		registrationType: {
			type: 'string',
		},
		rejectImageHeight: {
			type: 'integer',
			format: 'int32',
		},
		rejectImageWidth: {
			type: 'integer',
			format: 'int32',
		},
		removeEmailNotificationImages: {
			type: 'integer',
			format: 'int32',
		},
		reputation__disabled: {
			type: 'integer',
			format: 'int32',
		},
		requireEmailAddress: {
			type: 'integer',
			format: 'int32',
		},
		resizeImageQuality: {
			type: 'integer',
			format: 'int32',
		},
		resizeImageWidth: {
			type: 'integer',
			format: 'int32',
		},
		resizeImageWidthThreshold: {
			type: 'integer',
			format: 'int32',
		},
		route: {
			type: 'string',
		},
		score: {
			type: 'string',
		},
		searchDefaultIn: {
			type: 'string',
		},
		searchDefaultInQuick: {
			type: 'string',
		},
		searchDefaultSortBy: {
			type: 'string',
		},
		sendEmailToBanned: {
			type: 'integer',
			format: 'int32',
		},
		sendValidationEmail: {
			type: 'integer',
			format: 'int32',
		},
		sessionDuration: {
			type: 'integer',
			format: 'int32',
		},
		showAverageApprovalTime: {
			type: 'integer',
			format: 'int32',
		},
		showFullnameAsDisplayName: {
			type: 'integer',
			format: 'int32',
		},
		showPostPreviewsOnHover: {
			type: 'integer',
			format: 'int32',
		},
		showSiteTitle: {
			type: 'integer',
			format: 'int32',
		},
		sidebar___footer: {
			type: 'string',
		},
		signatures__hideDuplicates: {
			type: 'integer',
			format: 'int32',
		},
		sitemapTopics: {
			type: 'integer',
			format: 'int32',
		},
		slug: {
			type: 'string',
		},
		status: {
			type: 'string',
		},
		stripEXIFData: {
			type: 'integer',
			format: 'int32',
		},
		subCategoriesPerPage: {
			type: 'integer',
			format: 'int32',
		},
		submitPluginUsage: {
			type: 'integer',
			format: 'int32',
		},
		system: {
			type: 'integer',
			format: 'int32',
		},
		systemTags: {
			type: 'string',
		},
		teaserPost: {
			type: 'string',
		},
		text: {
			type: 'string',
		},
		textClass: {
			type: 'string',
		},
		theme__id: {
			type: 'string',
		},
		theme__src: {
			type: 'string',
		},
		theme__staticDir: {
			type: 'string',
		},
		theme__templates: {
			type: 'string',
		},
		theme__type: {
			type: 'string',
		},
		tid: {
			type: 'integer',
			format: 'int32',
		},
		timeagoCutoff: {
			type: 'integer',
			format: 'int32',
		},
		timestamp: {
			type: 'number',
		},
		title: {
			type: 'string',
		},
		topicBacklinks: {
			type: 'integer',
			format: 'int32',
		},
		topicCount: {
			type: 'integer',
			format: 'int32',
		},
		topicStaleDays: {
			type: 'integer',
			format: 'int32',
		},
		topicThumbSize: {
			type: 'integer',
			format: 'int32',
		},
		topic_count: {
			type: 'integer',
			format: 'int32',
		},
		topiccount: {
			type: 'integer',
			format: 'int32',
		},
		topicsPerPage: {
			type: 'integer',
			format: 'int32',
		},
		type: {
			type: 'string',
		},
		uid: {
			type: 'integer',
			format: 'int32',
		},
		undoTimeout: {
			type: 'integer',
			format: 'int32',
		},
		unreadCutoff: {
			type: 'integer',
			format: 'int32',
		},
		unverified___users: {
			type: 'string',
		},
		updateUrlWithPostIndex: {
			type: 'integer',
			format: 'int32',
		},
		uploadRateLimitCooldown: {
			type: 'integer',
			format: 'int32',
		},
		uploadRateLimitThreshold: {
			type: 'integer',
			format: 'int32',
		},
		upvotesPerDay: {
			type: 'integer',
			format: 'int32',
		},
		upvotesPerUserPerDay: {
			type: 'integer',
			format: 'int32',
		},
		useCompression: {
			type: 'integer',
			format: 'int32',
		},
		userCount: {
			type: 'integer',
			format: 'int32',
		},
		userSearchResultsPerPage: {
			type: 'integer',
			format: 'int32',
		},
		userTitle: {
			type: 'string',
		},
		userTitleEnabled: {
			type: 'integer',
			format: 'int32',
		},
		username: {
			type: 'string',
		},
		username__disableEdit: {
			type: 'integer',
			format: 'int32',
		},
		userslug: {
			type: 'string',
		},
		value: {
			type: 'string',
		},
		verified___users: {
			type: 'string',
		},
		viewcount: {
			type: 'integer',
			format: 'int32',
		},
		votesArePublic: {
			type: 'integer',
			format: 'int32',
		},
		_id: {
			type: 'string',
			format: 'byte',
		},
	},
	primary_key: [
		'_id',
	],
};
