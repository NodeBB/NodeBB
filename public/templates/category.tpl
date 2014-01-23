<ol class="breadcrumb">
	<li itemscope="itemscope" itemtype="http://data-vocabulary.org/Breadcrumb">
		<a href="{relative_path}/" itemprop="url"><span itemprop="title">[[global:home]]</span></a>
	</li>
	<li class="active" itemscope="itemscope" itemtype="http://data-vocabulary.org/Breadcrumb">
		<span itemprop="title">{category_name} <a target="_blank" href="../{category_id}.rss"><i class="fa fa-rss-square"></i></a></span>
	</li>
</ol>

<div>
	<!-- IF privileges.write -->
	<button id="new_post" class="btn btn-primary {show_topic_button}">[[category:new_topic_button]]</button>
	<!-- ENDIF privileges.write -->
	<!-- IF !disableSocialButtons -->
	<div class="inline-block pull-right">
		<a href="#" id="facebook-share"><i class="fa fa-facebook-square fa-2x"></i></a>&nbsp;
		<a href="#" id="twitter-intent"><i class="fa fa-twitter-square fa-2x"></i></a>&nbsp;
		<a href="#" id="google-share"><i class="fa fa-google-plus-square fa-2x"></i></a>&nbsp;
	</div>
	<!-- ENDIF !disableSocialButtons -->
</div>

<hr/>

<div class="alert alert-warning hide {no_topics_message}" id="category-no-topics">
	[[category:no_topics]]
</div>

<div class="category row">
	<div class="{topic_row_size}">
		<ul id="topics-container" itemscope itemtype="http://www.schema.org/ItemList">
			<meta itemprop="itemListOrder" content="descending">
			<!-- BEGIN topics -->
			<li class="category-item {topics.deleted-class}" itemprop="itemListElement">

				<div class="col-md-12 col-xs-12 panel panel-default topic-row">
					<a href="../../user/{topics.userslug}" class="pull-left">
						<img class="img-rounded user-img" src="{topics.picture}" title="{topics.username}" />
					</a>

					<h3>
						<a href="../../topic/{topics.slug}" itemprop="url">
							<meta itemprop="name" content="{topics.title}">

							<span class="topic-title">
								<strong><i class="fa {topics.pin-icon}"></i> <i class="fa {topics.lock-icon}"></i></strong>
								{topics.title}
							</span>
						</a>
					</h3>

					<small>
						<span class="topic-stats">
							[[category:posts]]
							<strong class="human-readable-number" title="{topics.postcount}">{topics.postcount}</strong>
						</span>
						|
						<span class="topic-stats">
							[[category:views]]
							<strong class="human-readable-number" title="{topics.viewcount}">{topics.viewcount}</strong>
						</span>
						|
						<span>
							[[category:posted]] <span class="timeago" title="{topics.relativeTime}"></span>
						</span>

						<span class="pull-right">
							<!-- IF topics.unreplied -->
							[[category:no_replies]]
							<!-- ELSE -->
							<a href="../../user/{topics.teaser_userslug}">
								<img class="teaser-pic" src="{topics.teaser_userpicture}" title="{topics.teaser_username}"/>
							</a>
							<a href="../../topic/{topics.slug}#{topics.teaser_pid}">
								[[category:replied]]
							</a>
							<span class="timeago" title="{topics.teaser_timestamp}"></span>
							<!-- ENDIF topics.unreplied -->
						</span>
					</small>

				</div>

			</li>
			<!-- END topics -->
		</ul>
	</div>
	<div class="col-md-3 col-xs-12 {show_sidebar} category-sidebar">
		<div class="panel panel-default">
			<div class="panel-heading">[[category:sidebar.recent_replies]]</div>
			<div class="panel-body recent-replies">
				<ul id="category_recent_replies"></ul>
			</div>
		</div>

		<div class="panel panel-default">
			<div class="panel-heading">[[category:sidebar.active_participants]]</div>
			<div class="panel-body active-users">
				<!-- BEGIN active_users -->
				<a data-uid="{active_users.uid}" href="../../user/{active_users.userslug}"><img title="{active_users.username}" src="{active_users.picture}" class="img-rounded user-img" /></a>
				<!-- END active_users -->
			</div>
		</div>

		<div class="panel panel-default {moderator_block_class}">
			<div class="panel-heading">[[category:sidebar.moderators]]</div>
			<div class="panel-body moderators">
				<!-- BEGIN moderators -->
				<a href="../../user/{moderators.userslug}"><img title="{moderators.username}" src="{moderators.picture}" class="img-rounded" /></a>
				<!-- END moderators -->
			</div>
		</div>

		<!-- BEGIN sidebars -->
		<div class="panel panel-default">
			<div class="panel panel-default {sidebars.block_class}">{sidebars.header}</div>
			<div class="panel-body">{sidebars.content}</div>
		</div>
		<!-- END sidebars -->
	</div>
</div>

<input type="hidden" template-variable="category_id" value="{category_id}" />
<input type="hidden" template-variable="category_name" value="{category_name}" />