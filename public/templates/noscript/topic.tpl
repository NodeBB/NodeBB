		<ol class="breadcrumb">
			<li itemscope="itemscope" itemtype="http://data-vocabulary.org/Breadcrumb">
				<a href="{relative_path}/" itemprop="url"><span itemprop="title">[[global:home]]</span></a>
			</li>
			<li itemscope="itemscope" itemtype="http://data-vocabulary.org/Breadcrumb">
				<a href="{relative_path}/category/{category.slug}" itemprop="url"><span itemprop="title">{category.name}</span></a>
			</li>
			<li class="active" itemscope="itemscope" itemtype="http://data-vocabulary.org/Breadcrumb">
				<span itemprop="title">{title} <a target="_blank" href="../{tid}.rss"><i class="fa fa-rss-square"></i></a></span>
			</li>
		</ol>
		<ul class="posts">
			<!-- BEGIN posts -->
			<li itemscope itemtype="http://schema.org/Comment">
				<meta itemprop="datePublished" content="{posts.relativeTime}">
				<meta itemprop="dateModified" content="{posts.relativeEditTime}">
				<a name="{posts.pid}"></a>
				<div class="row">
					<div class="col-lg-2 profile">
						<img class="img-thumbnail" src="{posts.picture}" itemprop="image" /><br />
						<span class="username" itemprop="author">{posts.username}</span>
					</div>
					<div class="col-lg-10" itemprop="text">
						{posts.content}
					</div>
					<div class="clear"></div>
				</div>
			</li>
			<!-- END posts -->
		</ul>
		<div class="text-center">
			<ul class="pagination">
				<!-- BEGIN pages -->
				<li <!-- IF pages.active -->class="active"<!-- ENDIF pages.active -->><a href="?page={pages.page}">{pages.page}</a></li>
				<!-- END pages -->
			</ul>
		</div>