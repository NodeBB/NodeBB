<div class="account">
	<!-- IMPORT partials/account/header.tpl -->

	<div class="row">
		<div class="col-xs-12 col-md-6">
			<!-- IF !disableCustomUserSkins -->
			<h4>[[user:select-skin]]</h4>
			<div class="well">
				<select class="form-control" id="bootswatchSkin" data-property="bootswatchSkin">
					{{{each bootswatchSkinOptions}}}
					<option value="{bootswatchSkinOptions.value}" <!-- IF bootswatchSkinOptions.selected -->selected<!-- ENDIF bootswatchSkinOptions.selected -->>{bootswatchSkinOptions.name}</option>
					{{{end}}}
				</select>
			</div>
			<!-- ENDIF !disableCustomUserSkins -->

			<!-- IF allowUserHomePage -->
			<h4>[[user:select-homepage]]</h4>
			<div class="well">
				<div class="form-group">
					<label for="homePageRoute">[[user:homepage]]</label>
					<select class="form-control" id="homePageRoute" data-property="homePageRoute">
						<option value="none">None</option>
						{{{each homePageRoutes}}}
						<option value="{homePageRoutes.route}" <!-- IF homePageRoutes.selected -->selected="1"<!-- ENDIF homePageRoutes.selected -->>{homePageRoutes.name}</option>
						{{{end}}}
					</select>
					<p class="help-block">[[user:homepage_description]]</p>
				</div>
				<div id="homePageCustom" class="form-group" style="display: none;">
					<label for="homePageCustom">[[user:custom_route]]</label>
					<input type="text" class="form-control" data-property="homePageCustom" id="homePageCustom" value="{settings.homePageRoute}"/>
					<p class="help-block">[[user:custom_route_help]]</p>
				</div>
			</div>
			<!-- ENDIF allowUserHomePage -->

			<h4>[[global:privacy]]</h4>
			<div class="well">
				<!-- IF !hideEmail -->
				<div class="checkbox">
					<label>
						<input type="checkbox" data-property="showemail" <!-- IF settings.showemail -->checked <!-- ENDIF settings.showemail -->/> <strong>[[user:show_email]]</strong>
					</label>
				</div>
				<!-- ENDIF !hideEmail -->

				<!-- IF !hideFullname -->
				<div class="checkbox">
					<label>
						<input type="checkbox" data-property="showfullname" <!-- IF settings.showfullname -->checked<!-- ENDIF settings.showfullname -->/> <strong>[[user:show_fullname]]</strong>
					</label>
				</div>
				<!-- ENDIF !hideFullname -->
				<!-- IF !config.disableChat -->
				<div class="checkbox">
					<label>
						<input type="checkbox" data-property="restrictChat" <!-- IF settings.restrictChat -->checked<!-- ENDIF settings.restrictChat -->/> <strong>[[user:restrict_chats]]</strong>
					</label>
				</div>
				<!-- ENDIF !config.disableChat -->
			</div>

			<h4>[[user:browsing]]</h4>
			<div class="well">
				<div class="checkbox">
					<label>
						<input type="checkbox" data-property="openOutgoingLinksInNewTab" <!-- IF settings.openOutgoingLinksInNewTab -->checked<!-- ENDIF settings.openOutgoingLinksInNewTab -->/> <strong>[[user:open_links_in_new_tab]]</strong>
					</label>
				</div>
				<!-- IF inTopicSearchAvailable -->
				<div class="checkbox">
					<label>
						<input type="checkbox" data-property="topicSearchEnabled" <!-- IF settings.topicSearchEnabled -->checked<!-- ENDIF settings.topicSearchEnabled -->/> <strong>[[user:enable_topic_searching]]</strong>
					</label>
				</div>
				<p class="help-block">[[user:topic_search_help]]</p>
				<!-- ENDIF inTopicSearchAvailable -->
				<div class="checkbox">
					<label>
						<input type="checkbox" data-property="updateUrlWithPostIndex" {{{ if settings.updateUrlWithPostIndex }}}checked{{{ end }}}/> <strong>[[user:update_url_with_post_index]]</strong>
					</label>
				</div>
				<div class="checkbox">
					<label>
						<input type="checkbox" data-property="scrollToMyPost" <!-- IF settings.scrollToMyPost -->checked<!-- ENDIF settings.scrollToMyPost -->/> <strong>[[user:scroll_to_my_post]]</strong>
					</label>
				</div>
			</div>

			<h4>[[global:pagination]]</h4>
			<div class="well">
				<div class="checkbox">
					<label>
						<input type="checkbox" data-property="usePagination" <!-- IF settings.usePagination -->checked<!-- ENDIF settings.usePagination -->> <strong>[[user:paginate_description]]</strong>
					</label>
				</div>

				<strong>[[user:topics_per_page]] ([[user:max_items_per_page, {maxTopicsPerPage}]])</strong><br /> <input type="text" class="form-control" data-property="topicsPerPage" value="{settings.topicsPerPage}"><br />
				<strong>[[user:posts_per_page]] ([[user:max_items_per_page, {maxPostsPerPage}]])</strong><br /> <input type="text" class="form-control" data-property="postsPerPage" value="{settings.postsPerPage}"><br />
			</div>

			<!-- IF !disableEmailSubscriptions -->
			<h4>[[global:email]]</h4>
			<div class="well">
				<div class="form-group">
					<label for="dailyDigestFreq">[[user:digest_label]]</label>
					<select class="form-control" id="dailyDigestFreq" data-property="dailyDigestFreq" autocomplete="off">
						{{{each dailyDigestFreqOptions}}}
						<option value="{dailyDigestFreqOptions.value}" <!-- IF dailyDigestFreqOptions.selected -->selected="1"<!-- ENDIF dailyDigestFreqOptions.selected -->>{dailyDigestFreqOptions.name}</option>
						{{{end}}}
					</select>
					<p class="help-block">[[user:digest_description]]</p>
				</div>
			</div>
			<!-- ENDIF !disableEmailSubscriptions -->

			{{{each customSettings}}}
			<h4>{customSettings.title}</h4>
			<div class="well">
				{customSettings.content}
			</div>
			{{{end}}}

		</div>

		<div class="col-xs-12 col-md-6">
			<h4>[[global:language]]</h4>
			<div class="well">
				<div class="row">
					<div class="form-group col-lg-12">
						<select data-property="userLang" class="form-control">
							{{{each languages}}}
							<option value="{languages.code}" <!-- IF languages.selected -->selected<!-- ENDIF languages.selected -->>{languages.name} ({languages.code})</option>
							{{{end}}}
						</select>
					</div>
				</div>
				<!-- IF isAdmin -->
				<!-- IF isSelf -->
				<label>[[user:acp_language]]</label>
				<div class="row">
					<div class="form-group col-lg-12">
						<select data-property="acpLang" class="form-control">
							{{{each acpLanguages}}}
							<option value="{acpLanguages.code}" <!-- IF acpLanguages.selected -->selected<!-- ENDIF acpLanguages.selected -->>{acpLanguages.name} ({acpLanguages.code})</option>
							{{{end}}}
						</select>
					</div>
				</div>
				<!-- ENDIF isSelf -->
				<!-- ENDIF isAdmin -->
			</div>

			<h4>[[topic:watch]]</h4>
			<div class="well">
				<div class="checkbox">
					<label>
						<input type="checkbox" data-property="followTopicsOnCreate" <!-- IF settings.followTopicsOnCreate -->checked <!-- ENDIF settings.followTopicsOnCreate -->/> <strong>[[user:follow_topics_you_create]]</strong>
					</label>
				</div>
				<div class="checkbox">
					<label>
						<input type="checkbox" data-property="followTopicsOnReply" <!-- IF settings.followTopicsOnReply -->checked<!-- ENDIF settings.followTopicsOnReply -->/> <strong>[[user:follow_topics_you_reply_to]]</strong>
					</label>
				</div>
				<div class="form-group">
					<label>[[user:default-category-watch-state]]</label>
					<select class="form-control" data-property="categoryWatchState">
						<option value="watching" <!-- IF categoryWatchState.watching -->selected<!-- ENDIF categoryWatchState.watching -->>[[category:watching]]</option>
						<option value="notwatching" <!-- IF categoryWatchState.notwatching -->selected<!-- ENDIF categoryWatchState.notwatching -->>[[category:not-watching]]</option>
						<option value="ignoring" <!-- IF categoryWatchState.ignoring -->selected<!-- ENDIF categoryWatchState.ignoring -->>[[category:ignoring]]</option>
					</select>
				</div>
			</div>


			<h4>[[user:notifications]]</h4>
			<div class="well">
				{{{each notificationSettings}}}
				<div class="row">
					<div class="col-xs-7">
						<label>{notificationSettings.label}</label>
					</div>
					<div class="form-group col-xs-5">
						<select class="form-control" data-property="{notificationSettings.name}">
							<option value="none" <!-- IF notificationSettings.none -->selected<!-- ENDIF notificationSettings.none -->>[[notifications:none]]</option>
							<option value="notification" <!-- IF notificationSettings.notification -->selected<!-- ENDIF notificationSettings.notification -->>[[notifications:notification_only]]</option>
							<option value="email" <!-- IF notificationSettings.email -->selected<!-- ENDIF notificationSettings.email -->>[[notifications:email_only]]</option>
							<option value="notificationemail" <!-- IF notificationSettings.notificationemail -->selected<!-- ENDIF notificationSettings.notificationemail -->>[[notifications:notification_and_email]]</option>
						</select>
					</div>
				</div>
				{{{end}}}

				<div class="row">
					<div class="col-xs-7">
						<label for="upvote-notif-freq">[[user:upvote-notif-freq]]</label>
					</div>
					<div class="form-group col-xs-5">
						<select class="form-control" id="upvote-notif-freq" name="upvote-notif-freq" data-property="upvoteNotifFreq">
							{{{each upvoteNotifFreq}}}
							<option value="{upvoteNotifFreq.name}" <!-- IF upvoteNotifFreq.selected -->selected<!-- ENDIF upvoteNotifFreq.selected -->>
								[[user:upvote-notif-freq.{upvoteNotifFreq.name}]]
							</option>
							{{{end}}}
						</select>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="form-actions">
		<a id="submitBtn" href="#" class="btn btn-primary">[[global:save_changes]]</a>
	</div>
</div>

