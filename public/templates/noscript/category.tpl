		<ol class="breadcrumb">
			<li itemscope="itemscope" itemtype="http://data-vocabulary.org/Breadcrumb">
				<a href="{relative_path}/" itemprop="url"><span itemprop="title">[[global:home]]</span></a>
			</li>
			<li class="active" itemscope="itemscope" itemtype="http://data-vocabulary.org/Breadcrumb">
				<span itemprop="title">{category_name} <a target="_blank" href="../{category_id}.rss"><i class="fa fa-rss-square"></i></a></span>
			</li>
		</ol>
		<ul class="topics" itemscope itemtype="http://www.schema.org/ItemList" data-nextstart="{nextStart}">
			<!-- BEGIN topics -->
			<li itemprop="itemListElement">
				<meta itemprop="name" content="{topics.title}">
				<span class="timestamp">{topics.teaser_timestamp}</span>
				<a href="../../topic/{topics.slug}" itemprop="url">{topics.title} ({topics.postcount})</a>
				<div class="teaser">
					<img class="img-thumbnail" src="{topics.teaser_userpicture}" />
					<div class="clear"></div>
				</div>
			</li>
			<!-- END topics -->
		</ul>