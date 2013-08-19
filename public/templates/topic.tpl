<div class="container">
	<ul class="breadcrumb">
		<li itemscope="itemscope" itemtype="http://data-vocabulary.org/Breadcrumb">
			<a href="/" itemprop="url"><span itemprop="title">Home</span></a>
			<span class="divider">/</span>
		</li>
		<li itemscope="itemscope" itemtype="http://data-vocabulary.org/Breadcrumb">
			<a href="/category/{category_slug}" itemprop="url"><span itemprop="title">{category_name}</span></a>
			<span class="divider">/</span>
		</li>
		<li class="active" itemscope="itemscope" itemtype="http://data-vocabulary.org/Breadcrumb">
			<span itemprop="title">{topic_name}</span>
		</li>
		<div id="thread_active_users" class="hidden-phone"></div>
	</ul>
</div>

<ul id="post-container" class="post-container container" data-tid="{topic_id}">
	


	<!-- BEGIN main_posts -->
		<a id="post_anchor_{main_posts.pid}" name="{main_posts.pid}"></a>
		<li class="row post-row main-post" data-pid="{main_posts.pid}" data-uid="{main_posts.uid}" data-deleted="{main_posts.deleted}">
			<div class="span12">
				<div class="post-block">
					<a class="main-avatar" href="/users/{main_posts.userslug}">
						<img src="{main_posts.picture}" align="left" class="img-polaroid"/><br />
						<div class="hover-overlay">
							{main_posts.username}<br />
							<i class="icon-star"></i><span class="user_rep_{main_posts.uid}">{main_posts.user_rep}</span>
							<i class="icon-pencil"></i><span class="user_posts_{main_posts.uid}">{main_posts.user_postcount}</span>
						</div>
					</a>
					<h3><p id="topic_title_{main_posts.pid}" class="topic-title">{topic_name}</p></h3>


					<hr />

					<div class="topic-buttons pull-left">
						<button id="ids_{main_posts.pid}_{main_posts.uid}" class="btn edit {main_posts.display_moderator_tools}" type="button" title="Edit"><i class="icon-pencil"></i></button>
						<button id="ids_{main_posts.pid}_{main_posts.uid}" class="btn delete {main_posts.display_moderator_tools}" type="button" title="Delete"><i class="icon-trash"></i></button>
						<div class="btn-group">
							<button class="btn follow" type="button" title="Be notified of new replies in this topic"><i class="icon-eye-open"></i></button>
							<button id="favs_{main_posts.pid}_{main_posts.uid}" class="favourite btn {main_posts.fav_button_class}" type="button">
								<span>Favourite</span>
								<span class="post_rep_{main_posts.pid}">{main_posts.post_rep} </span><i class="{main_posts.fav_star_class}"></i>
							</button>
						</div>
						<div class="btn-group">
							<button id="quote_{main_posts.pid}_{main_posts.uid}" class="btn quote" type="button" title="Quote"><i class="icon-quote-left"></i></button>
							<button class="btn btn-primary btn post_reply" type="button">Reply <i class="icon-reply"></i></button>
						</div>
					</div>
					<div style="clear:both; margin-bottom: 10px;"></div>

					<div id="content_{main_posts.pid}" class="post-content">{main_posts.content}</div>
					<div id="images_{main_posts.pid}" class="post-images">
						<!-- BEGIN uploadedImages -->
						<i class="icon-picture icon-1"></i><a href="{main_posts.uploadedImages.url}"> {main_posts.uploadedImages.name}</a><br/>
						<!-- END uploadedImages -->
					</div>
					<div class="post-signature">{main_posts.signature}</div>
					<div class="profile-block">
						<img class="hidden-desktop" src="{main_posts.picture}" align="left" /> posted by <strong><a class="username-field" href="/users/{main_posts.userslug}">{main_posts.username}</a></strong> {main_posts.relativeTime} ago
						<span class="{main_posts.edited-class} hidden-phone">| last edited by <strong><a href="/users/{main_posts.editorslug}">{main_posts.editorname}</a></strong> {main_posts.relativeEditTime} ago</span>
						<span class="{main_posts.edited-class}"><i class="icon-edit visible-phone" title="edited by {main_posts.editorname} {main_posts.relativeEditTime} ago"></i></span>
						<div class="post-buttons visible-phone">
							<button class="post_reply btn-link"><i class="icon-reply"></i></button>
						</div>
						<div class="post-buttons">
							<a href="../{topic_id}.rss" target="_blank"><i class="icon-rss"></i></a>
						</div>
					</div>
				</div>
			</div>
		</li>
	<!-- END main_posts -->

	<!-- BEGIN posts -->
		<a id="post_anchor_{posts.pid}" name="{posts.pid}"></a>
		<li class="row-fluid post-row" data-pid="{posts.pid}" data-uid="{posts.uid}" data-username="{posts.username}" data-deleted="{posts.deleted}">
			<div class="span1 profile-image-block hidden-phone hidden-tablet">
				<!--<i class="icon-spinner icon-spin icon-2x pull-left"></i>-->
				<a href="/users/{posts.userslug}">
					<img src="{posts.picture}" align="left" class="img-polaroid"/>
				</a>
				<div class="stats">
					<i class="icon-star"></i><span class="user_rep_{posts.uid} formatted-number">{posts.user_rep}</span>
					<div id="ids_{posts.pid}_{posts.uid}" class="chat hidden-phone" title="Chat"><i class="icon-comment"></i></div>
				</div>
				<span class="label label-important {posts.show_banned}">banned</span>			
			</div>
			<div class="span11 span12-tablet">
				<div class="post-block speech-bubble">
					<div id="content_{posts.pid}" class="post-content">{posts.content}</div>
					<div id="images_{posts.pid}" class="post-images">
						<!-- BEGIN uploadedImages -->
						<i class="icon-picture icon-1"></i><a href="{posts.uploadedImages.url}"> {posts.uploadedImages.name}</a><br/>
						<!-- END uploadedImages -->
					</div>
					<div class="post-signature">{posts.signature}</div>
					<div class="profile-block">
						<span class="post-buttons">
							<button id="ids_{posts.pid}_{posts.uid}" class="edit {posts.display_moderator_tools} btn-link hidden-phone" title="Edit"><i class="icon-pencil"></i></button>
							<button id="ids_{posts.pid}_{posts.uid}" class="delete {posts.display_moderator_tools} btn-link hidden-phone" title="Delete"><i class="icon-trash"></i></button>
							<button id="favs_{posts.pid}_{posts.uid}" class="favourite btn-link hidden-phone" title="Favourite"><span class="post_rep_{posts.pid}">{posts.post_rep} </span><i class="{posts.fav_star_class}"></i></button>
							<button id="quote_{posts.pid}_{posts.uid}" class="quote btn-link hidden-phone" title="Quote"><i class="icon-quote-left"></i></button>
							<button class="post_reply btn-link" title="Reply"><i class="icon-reply"></i></button>
						</span>
						<img class="hidden-desktop" src="{posts.picture}" align="left" /> posted by <strong><a class="username-field" href="/users/{posts.userslug}">{posts.username}</a></strong> {posts.relativeTime} ago
						<span class="{posts.edited-class} hidden-phone">| last edited by <strong><a href="/users/{posts.editorslug}">{posts.editorname}</a></strong> {posts.relativeEditTime} ago</span>
						<span class="{posts.edited-class}"><i class="icon-edit visible-phone" title="edited by {posts.editorname} {posts.relativeEditTime} ago"></i></span>
					</div>
				</div>
			</div>
		</li>
	<!-- END posts -->
</ul>
<hr />
<button id="post_reply" class="btn btn-primary btn-large post_reply" type="button">Reply</button>
<div class="btn-group pull-right" id="thread-tools" style="visibility: hidden;">
	<button class="btn btn-large dropdown-toggle" data-toggle="dropdown" type="button">Thread Tools <span class="caret"></span></button>
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



<script type="text/javascript" src="{relative_path}/src/forum/topic.js"></script>