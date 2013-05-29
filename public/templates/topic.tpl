<div class="container">
	<ul class="breadcrumb">
		<li><a href="/">Home</a><span class="divider">/</span></li>
		<li><a href="/category/{category_slug}">{category_name}</a><span class="divider">/</span></li>
		<li class="active">{topic_name}</li>
		<div id="thread_active_users" class="hidden-phone"></div>
	</ul>
</div>

<ul id="post-container" class="post-container container">
	


	<!-- BEGIN main_posts -->
		<li class="row post-row main-post" data-pid="{main_posts.pid}" data-uid="{main_posts.uid}" data-deleted="{main_posts.deleted}">
			<div class="span12">
				<div class="post-block">
					<a class="main-avatar" href="/users/{main_posts.username}">
						<img src="{main_posts.gravatar}?s=80&default=identicon" align="left" /><br />
						<div class="hover-overlay">
							{main_posts.username}<br />
							<i class="icon-star"></i><span class="user_rep_{main_posts.uid}">{main_posts.user_rep}</span>
							<i class="icon-pencil"></i><span class="user_posts_{main_posts.uid}">8</span>
						</div>
					</a>
					<h3><p id="topic_title_{main_posts.pid}" class="topic-title">{topic_name}</p> 
						<div class="pull-right hidden-phone" style="margin-right: 10px;">
							<button id="ids_{main_posts.pid}_{main_posts.uid}" class="btn edit {main_posts.display_moderator_tools}" type="button"><i class="icon-pencil"></i></button>
							<button id="ids_{main_posts.pid}_{main_posts.uid}" class="btn delete {main_posts.display_moderator_tools}" type="button"><i class="icon-trash"></i></button>
							<button id="quote_{main_posts.pid}_{main_posts.uid}" class="btn quote" type="button"><i class="icon-quote-left"></i></button>

							<button id="favs_{main_posts.pid}_{main_posts.uid}" class="favourite btn" type="button"><span class="post_rep_{main_posts.pid}">Favourite {main_posts.post_rep} </span><i class="{main_posts.fav_star_class}"></i></button>
							<button id="post_reply" class="btn btn-primary btn post_reply" type="button">Reply <i class="icon-reply"></i></button>
						</div>
					</h3>


					<hr />
					<small>
						posted {main_posts.relativeTime} ago by <strong><a href="/users/{main_posts.username}" class="username-field">{main_posts.username}</a></strong>
						<span class="{main_posts.edited-class}"><i class="icon-edit" title="edited by {main_posts.editor} {main_posts.relativeEditTime} ago"></i></span>
					</small>

					<div style="clear:both; margin-bottom: 10px;"></div>

					<div id="content_{main_posts.pid}" class="post-content">{main_posts.content}</div>
					<div class="post-signature">{main_posts.signature}</div>
					<div class="profile-block"></div>
				</div>
			</div>
		</li>
	<!-- END main_posts -->

	<!-- BEGIN posts -->
		<li class="row post-row" data-pid="{posts.pid}" data-uid="{posts.uid}" data-username="{posts.username}" data-deleted="{posts.deleted}">
			<div class="span1 profile-image-block visible-desktop">
				<!--<i class="icon-spinner icon-spin icon-2x pull-left"></i>-->
				<a href="/users/{posts.username}">
					<img src="{posts.gravatar}?s=80&default=identicon" align="left" />
				</a>
				<i class="icon-star"></i><span class="user_rep_{posts.uid} formatted-number">{posts.user_rep}</span>
			</div>
			<div class="span11">
				<div class="post-block">
					<div id="content_{posts.pid}" class="post-content">{posts.content}</div>
					<div class="post-signature">{posts.signature}</div>
					<div class="profile-block">
						<span class="post-buttons">
							<div id="ids_{posts.pid}_{posts.uid}" class="chat hidden-phone"><i class="icon-comment"></i></div>
							<div id="ids_{posts.pid}_{posts.uid}" class="edit {posts.display_moderator_tools} hidden-phone"><i class="icon-pencil"></i></div>
							<div id="ids_{posts.pid}_{posts.uid}" class="delete {posts.display_moderator_tools} hidden-phone"><i class="icon-trash"></i></div>
							<div id="quote_{posts.pid}_{posts.uid}" class="quote hidden-phone"><i class="icon-quote-left"></i></div>
							<div id="favs_{posts.pid}_{posts.uid}" class="favourite hidden-phone"><span class="post_rep_{posts.pid}">{posts.post_rep}</span><i class="{posts.fav_star_class}"></i></div>
							<div class="post_reply"><i class="icon-reply"></i></div>
						</span>
						<img class="hidden-desktop" src="{posts.gravatar}?s=10&default=identicon" align="left" /> posted by <strong><a class="username-field" href="/users/{posts.username}">{posts.username}</a></strong> {posts.relativeTime} ago
						<span class="{posts.edited-class} hidden-phone">| last edited by <strong><a href="/users/{posts.editor}">{posts.editor}</a></strong> {posts.relativeEditTime} ago</span>
						<span class="{posts.edited-class}"><i class="icon-edit visible-phone" title="edited by {posts.editor} {posts.relativeEditTime} ago"></i></span>
					</div>
				</div>
			</div>
		</li>
	<!-- END posts -->
</ul>
<hr />
<button id="post_reply" class="btn btn-primary btn-large post_reply" type="button">Reply</button>
<div class="btn-group pull-right" id="thread-tools" style="visibility: hidden;">
	<button class="btn dropdown-toggle" data-toggle="dropdown" type="button">Thread Tools <span class="caret"></span></button>
	<ul class="dropdown-menu">
		<li><a href="#" id="pin_thread"><i class="icon-pushpin"></i> Pin Thread</a></li>
		<li><a href="#" id="lock_thread"><i class="icon-lock"></i> Lock Thread</a></li>
		<li class="divider"></li>
		<li><a href="#" id="move_thread"><i class="icon-move"></i> Move Thread</a></li>
		<li class="divider"></li>
		<li><a href="#" id="delete_thread"><span class="text-error"><i class="icon-trash"></i> Delete Thread</span></a></li>
	</ul>
</div>
<div id="move_thread_modal" class="modal hide fade">
	<div class="modal-header">
		<button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>
		<h3>Move Thread</h3>
	</div>
	<div class="modal-body">
		<p id="categories-loading"><i class="icon-spin icon-refresh"></i> Loading Categories</p>
		<ul class="category-list"></ul>
		<div id="move-confirm" style="display: none;">
			<hr />
			<div class="alert">This topic will be moved to the category <strong><span id="confirm-category-name"></span></strong></div>
		</div>
	</div>
	<div class="modal-footer">
		<button type="button" class="btn" data-dismiss="modal" id="move_thread_cancel">Close</a>
		<button type="button" class="btn btn-primary" id="move_thread_commit" disabled>Move</a>
	</div>
</div>

<input type="hidden" template-variable="expose_tools" value="{expose_tools}" />
<input type="hidden" template-variable="topic_id" value="{topic_id}" />
<input type="hidden" template-variable="locked" value="{locked}" />
<input type="hidden" template-variable="deleted" value="{deleted}" />
<input type="hidden" template-variable="pinned" value="{pinned}" />
<input type="hidden" template-variable="topic_name" value="{topic_name}" />



<script type="text/javascript" src="/src/forum/topic.js"></script>