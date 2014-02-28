
<input type="hidden" template-variable="category_id" value="{cid}" />
<input type="hidden" template-variable="category_name" value="{name}" />
<input type="hidden" template-variable="currentPage" value="{currentPage}" />
<input type="hidden" template-variable="pageCount" value="{pageCount}" />

<ol class="breadcrumb">
	<li itemscope="itemscope" itemtype="http://data-vocabulary.org/Breadcrumb">
		<a href="{relative_path}/" itemprop="url"><span itemprop="title">[[global:home]]</span></a>
	</li>
	<li class="active" itemscope="itemscope" itemtype="http://data-vocabulary.org/Breadcrumb">
		<span itemprop="title">{name} <a target="_blank" href="../{cid}.rss"><i class="fa fa-rss-square"></i></a></span>
	</li>
</ol>

<div>
	<!-- IF privileges.write -->
	<button id="new_post" class="btn btn-primary">[[category:new_topic_button]]</button>
	<!-- ENDIF privileges.write -->
	<!-- IF !config.disableSocialButtons -->
	<div class="inline-block pull-right">
		<a href="#" id="facebook-share"><i class="fa fa-facebook-square fa-2x"></i></a>&nbsp;
		<a href="#" id="twitter-share"><i class="fa fa-twitter-square fa-2x"></i></a>&nbsp;
		<a href="#" id="google-share"><i class="fa fa-google-plus-square fa-2x"></i></a>&nbsp;
	</div>
	<!-- ENDIF !config.disableSocialButtons -->
</div>

<hr/>

<!-- IF !topics.length -->
<div class="alert alert-warning" id="category-no-topics">
	[[category:no_topics]]
</div>
<!-- ENDIF !topics.length -->

<div class="category row">
	<div class="{topic_row_size}" no-widget-class="col-lg-12 col-sm-12">
		<ul id="topics-container" itemscope itemtype="http://www.schema.org/ItemList" data-nextstart="{nextStart}">
			<meta itemprop="itemListOrder" content="descending">
			<!-- BEGIN topics -->
			<li class="category-item <!-- IF topics.deleted -->deleted<!-- ENDIF topics.deleted --><!-- IF topics.unread -->unread<!-- ENDIF topics.unread -->" itemprop="itemListElement" data-tid="{topics.tid}" data-index="{topics.index}">

				<div class="col-md-12 col-xs-12 panel panel-default topic-row">

					<!--
						todo: tidy this up, not sure what to do with the topic thumbs
						todo: fix this nesting if issue#1065 is a win
						todo: add a check for config.allowTopicsThumbnail if issue#1066 is a win
					-->
					<a href="../../user/{topics.userslug}" class="pull-left">
						<img src="<!-- IF topics.thumb -->{topics.thumb}<!-- ELSE -->{topics.picture}<!-- ENDIF topics.thumb -->" class="img-rounded user-img" title="{topics.username}"/>
					</a>

					<h3>
						<a href="../../topic/{topics.slug}" itemprop="url">
							<meta itemprop="name" content="{topics.title}">

							<strong><!-- IF topics.pinned --><i class="fa fa-thumb-tack"></i><!-- ENDIF topics.pinned --> <!-- IF topics.locked --><i class="fa fa-lock"></i><!-- ENDIF topics.locked --></strong>
							<span class="topic-title">{topics.title}</span>
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
							<a href="../../user/{topics.teaser.userslug}">
								<img class="teaser-pic" src="{topics.teaser.picture}" title="{topics.teaser.username}"/>
							</a>
							<a href="../../topic/{topics.slug}#{topics.teaser.pid}">
								[[category:replied]]
							</a>
							<span class="timeago" title="{topics.teaser.timestamp}"></span>
							<!-- ENDIF topics.unreplied -->
						</span>
					</small>

				</div>

			</li>
			<!-- END topics -->
		</ul>
		<!-- IF config.usePagination -->
		<div class="text-center">
			<ul class="pagination">
				<li class="previous pull-left"><a href="#"><i class="fa fa-chevron-left"></i> [[global:previouspage]]</a></li>
				<li class="next pull-right"><a href="#">[[global:nextpage]] <i class="fa fa-chevron-right"></i></a></li>
			</ul>
		</div>
		<!-- ENDIF config.usePagination -->
	</div>

	<!-- IF topics.length -->
	<div widget-area="sidebar" class="col-md-3 col-xs-12 category-sidebar">
		<!-- BEGIN widgets -->
		{widgets.html}
		<!-- END widgets -->
	</div>
	<!-- ENDIF topics.length -->
</div>

