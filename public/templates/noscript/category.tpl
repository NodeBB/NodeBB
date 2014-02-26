		<ol class="breadcrumb">
			<li itemscope="itemscope" itemtype="http://data-vocabulary.org/Breadcrumb">
				<a href="{relative_path}/" itemprop="url"><span itemprop="title">[[global:home]]</span></a>
			</li>
			<li class="active" itemscope="itemscope" itemtype="http://data-vocabulary.org/Breadcrumb">
				<span itemprop="title">{name} <a target="_blank" href="../{cid}.rss"><i class="fa fa-rss-square"></i></a></span>
			</li>
		</ol>
		<ul class="topics" itemscope itemtype="http://www.schema.org/ItemList" data-nextstart="{nextStart}">
			<!-- BEGIN topics -->
			<li itemprop="itemListElement">
				<meta itemprop="name" content="{topics.title}">
				<span class="timestamp">{topics.teaser.timestamp}</span>
				<a href="../../topic/{topics.slug}" itemprop="url">{topics.title} ({topics.postcount})</a>
				<div class="teaser">
					<img class="img-thumbnail" src="{topics.teaser.picture}" />
					<div class="clear"></div>
				</div>
			</li>
			<!-- END topics -->
		</ul>
		<div class="text-center">
			<ul class="pagination">
				<!-- BEGIN pages -->
				<li <!-- IF pages.active -->class="active"<!-- ENDIF pages.active -->><a href="?page={pages.page}">{pages.page}</a></li>
				<!-- END pages -->
			</ul>
		</div>