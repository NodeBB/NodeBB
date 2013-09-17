<div class="topic">
	<ol class="breadcrumb">
		<li itemscope="itemscope" itemtype="http://data-vocabulary.org/Breadcrumb">
			<a href="/" itemprop="url"><span itemprop="title">Home</span></a>
		</li>
		<li itemscope="itemscope" itemtype="http://data-vocabulary.org/Breadcrumb">
			<a href="/category/{category_slug}" itemprop="url"><span itemprop="title">{category_name}</span></a>
		</li>
		<li class="active" itemscope="itemscope" itemtype="http://data-vocabulary.org/Breadcrumb">
			<span itemprop="title">{topic_name} <a target="_blank" href="../{topic_id}.rss"><i class="icon-rss-sign"></i></a></span>
		</li>
		<div id="thread_active_users" class="active-users pull-right hidden-xs"></div>
	</ol>

	<ul id="post-container" class="container" data-tid="{topic_id}">
		<!-- BEGIN main_posts -->
			<a id="post_anchor_{main_posts.pid}" name="{main_posts.pid}"></a>
			<li class="row post-row main-post" data-pid="{main_posts.pid}" data-uid="{main_posts.uid}" data-username="{main_posts.username}" data-deleted="{main_posts.deleted}">
				<div class="col-md-12">
					<div class="post-block">
						<a class="avatar" href="/users/{main_posts.userslug}">
							<img src="{main_posts.picture}" align="left" class="img-thumbnail" width=150 height=150 /><br />
						</a>
						<h3>
							<p id="topic_title_{main_posts.pid}" class="topic-title">{topic_name}</p>
						</h3>

						<div class="topic-buttons">
							<div class="btn-group">
								<button class="btn btn-sm btn-default dropdown-toggle" data-toggle="dropdown" type="button" title="Posted by {main_posts.username}">
									<span class="username-field" href="/users/{main_posts.userslug}">{main_posts.username}&nbsp;</span>
									<span class="caret"></span>
								</button>
							    <ul class="dropdown-menu">
									<li><a href="/users/{main_posts.userslug}"><i class="icon-user"></i> Profile</a></li>
									<li><div class="chat"><i class="icon-comment"></i> Chat</div></li>
							    </ul>
							</div>

							<div class="btn-group">
								<button class="btn btn-sm btn-default follow" type="button" title="Be notified of new replies in this topic"><i class="icon-eye-open"></i></button>
								<button class="favourite btn btn-sm btn-default {main_posts.fav_button_class}" type="button">
									<span class="favourite-text">Favourite</span>
									<span class="post_rep_{main_posts.pid}">{main_posts.post_rep} </span><i class="{main_posts.fav_star_class}"></i>
								</button>
							</div>
							<div class="btn-group">
								<button class="btn btn-sm btn-default quote" type="button" title="Quote"><i class="icon-quote-left"></i></button>
								<button class="btn btn-sm btn-primary btn post_reply" type="button">Reply <i class="icon-reply"></i></button>
							</div>

							<div class="btn-group pull-right post-tools">
								<button class="btn btn-sm btn-default edit {main_posts.display_moderator_tools}" type="button" title="Edit"><i class="icon-pencil"></i></button>
								<button class="btn btn-sm btn-default delete {main_posts.display_moderator_tools}" type="button" title="Delete"><i class="icon-trash"></i></button>
							</div>
						</div>

						<div id="content_{main_posts.pid}" class="post-content">{main_posts.content}</div>
						<div class="post-signature">{main_posts.signature}</div>
						<div class="post-info">
							<span class="pull-right">
								posted <span class="relativeTimeAgo">{main_posts.relativeTime} ago</span>
								<span class="{main_posts.edited-class}">| last edited by <strong><a href="/users/{main_posts.editorslug}">{main_posts.editorname}</a></strong> {main_posts.relativeEditTime} ago</span>
							</span>
							<div style="clear:both;"></div>
						</div>
					</div>
				</div>
			</li>
		<!-- END main_posts -->

		<!-- BEGIN posts -->
			<a id="post_anchor_{posts.pid}" name="{posts.pid}"></a>
			<li class="row post-row sub-posts" data-pid="{posts.pid}" data-uid="{posts.uid}" data-username="{posts.username}" data-deleted="{posts.deleted}">
				<div class="col-md-1 profile-image-block hidden-xs hidden-sm">
					<a href="/users/{posts.userslug}">
						<img src="{posts.picture}" align="left" class="img-thumbnail" />
					</a>
					<span class="label label-danger {posts.show_banned}">banned</span>
				</div>
				<div class="col-md-11">
					<div class="post-block">
						<div class="topic-buttons">
							<div class="btn-group">
								<button class="btn btn-sm btn-default dropdown-toggle" data-toggle="dropdown" type="button" title="Posted by {posts.username}">
									<span class="username-field" href="/users/{posts.userslug}">{posts.username}&nbsp;</span>
									<span class="caret"></span>
								</button>

							    <ul class="dropdown-menu">
									<li><a href="/users/{posts.userslug}"><i class="icon-user"></i> Profile</a></li>
									<li><div class="chat"><i class="icon-comment"></i> Chat</div></li>
							    </ul>
							</div>

							<div class="btn-group">
								<button class="favourite btn btn-sm btn-default {posts.fav_button_class}" type="button">
									<span class="favourite-text">Favourite</span>
									<span class="post_rep_{posts.pid}">{posts.post_rep} </span><i class="{posts.fav_star_class}"></i>
								</button>
							</div>
							<div class="btn-group">
								<button class="btn btn-sm btn-default quote" type="button" title="Quote"><i class="icon-quote-left"></i></button>
								<button class="btn btn-sm btn-primary btn post_reply" type="button">Reply <i class="icon-reply"></i></button>
							</div>

							<div class="btn-group pull-right post-tools">
								<button class="btn btn-sm btn-default edit {posts.display_moderator_tools}" type="button" title="Edit"><i class="icon-pencil"></i></button>
								<button class="btn btn-sm btn-default delete {posts.display_moderator_tools}" type="button" title="Delete"><i class="icon-trash"></i></button>
							</div>
						</div>

						<div id="content_{posts.pid}" class="post-content">{posts.content}</div>
						<div class="post-signature">{posts.signature}</div>
						<div class="post-info">
							<span class="pull-right">
								posted <span class="relativeTimeAgo">{posts.relativeTime} ago</span>
								<span class="{posts.edited-class}">| last edited by <strong><a href="/users/{posts.editorslug}">{posts.editorname}</a></strong> {posts.relativeEditTime} ago</span>
							</span>
							<div style="clear:both;"></div>
						</div>
					</div>
				</div>
			</li>
		<!-- END posts -->
	</ul>

	<div id="loading-indicator" style="text-align:center;" class="hide" done="0">
		<i class="icon-spinner icon-spin icon-large"></i>
	</div>

	<hr />

	<div class="topic-main-buttons">
		<button id="post_reply" class="btn btn-primary btn-lg post_reply" type="button">Reply</button>
		<div class="btn-group pull-right" id="thread-tools" style="visibility: hidden;">
			<button class="btn btn-default btn-lg dropdown-toggle" data-toggle="dropdown" type="button">Thread Tools <span class="caret"></span></button>
			<ul class="dropdown-menu">
				<li><a href="#" id="pin_thread"><i class="icon-pushpin"></i> Pin Thread</a></li>
				<li><a href="#" id="lock_thread"><i class="icon-lock"></i> Lock Thread</a></li>
				<li class="divider"></li>
				<li><a href="#" id="move_thread"><i class="icon-move"></i> Move Thread</a></li>
				<li class="divider"></li>
				<li><a href="#" id="delete_thread"><span class="text-error"><i class="icon-trash"></i> Delete Thread</span></a></li>
			</ul>
		</div>
	</div>

	<div class="mobile-author-overlay">
		<div class="row">
			<div class="col-xs-3">
				<img id="mobile-author-image" src="" width=50 height=50 />
			</div>
			<div class="col-xs-9">
				<h4><div id="mobile-author-overlay"></div></h4>
			</div>
		</div>
	</div>

	<div id="move_thread_modal" class="modal" tabindex="-1" role="dialog" aria-labelledby="Chat" aria-hidden="true">
		<div class="modal-dialog">
			<div class="modal-content">
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
					<button type="button" class="btn btn-default" data-dismiss="modal" id="move_thread_cancel">Close</a>
					<button type="button" class="btn btn-primary" id="move_thread_commit" disabled>Move</a>
				</div>
			</div>
		</div>
	</div>

</div>

<input type="hidden" template-variable="expose_tools" value="{expose_tools}" />
<input type="hidden" template-variable="topic_id" value="{topic_id}" />
<input type="hidden" template-variable="locked" value="{locked}" />
<input type="hidden" template-variable="deleted" value="{deleted}" />
<input type="hidden" template-variable="pinned" value="{pinned}" />
<input type="hidden" template-variable="topic_name" value="{topic_name}" />
<input type="hidden" template-variable="postcount" value="{postcount}" />



<script type="text/javascript" src="{relative_path}/src/forum/topic.js"></script>