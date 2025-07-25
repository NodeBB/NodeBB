const { test, expect } = require('@playwright/test');

test.describe('Threading Backward Compatibility', () => {
  let topicUrl;
  let mainPostPid;

  test.beforeAll(async ({ browser }) => {
    // Create a test user and topic for all tests
    const context = await browser.newContext();
    const page = await context.newPage();

    // Register test user (assuming registration is available)
    await page.goto('/register');
    await page.fill('input[name="username"]', 'compattest');
    await page.fill('input[name="email"]', 'compattest@example.com');
    await page.fill('input[name="password"]', 'TestPass123!');
    await page.fill('input[name="password-confirm"]', 'TestPass123!');
    await page.click('button[type="submit"]');
    
    // Wait for registration to complete
    await page.waitForURL(/^((?!register).)*$/);

    // Create a test topic
    await page.goto('/category/1'); // Assuming category 1 exists
    await page.click('button[data-action="create"]');
    await page.fill('input[name="title"]', 'Compatibility Test Topic');
    await page.fill('textarea[name="content"]', 'This topic tests backward compatibility with non-threaded posts');
    await page.click('button[type="submit"]');
    
    // Wait for topic creation and get URL
    await page.waitForURL(/\/topic\/\d+/);
    topicUrl = page.url();
    
    // Get main post PID
    const mainPost = await page.locator('[component="post"]').first();
    mainPostPid = await mainPost.getAttribute('data-pid');

    await context.close();
  });

  test.describe('Non-threaded Topics (Threading Disabled)', () => {
    test('should not show threading toggle when feature is disabled', async ({ page }) => {
      // Simulate threading being disabled globally
      await page.addInitScript(() => {
        window.config = window.config || {};
        window.config.threadingEnabled = false;
      });

      await page.goto(topicUrl);
      
      // Threading toggle should not exist
      const threadingToggle = page.locator('[component="topic/threading/toggle"]');
      await expect(threadingToggle).not.toBeVisible();
    });

    test('should display all posts in flat view only', async ({ page }) => {
      await page.addInitScript(() => {
        window.config = window.config || {};
        window.config.threadingEnabled = false;
      });

      await page.goto(topicUrl);

      // Create some replies
      for (let i = 0; i < 3; i++) {
        await page.click('[component="topic/reply"]');
        await page.fill('[component="composer"] textarea', `Flat reply ${i + 1}`);
        await page.click('[component="composer/submit"]');
        await page.waitForSelector(`[component="post"]:has-text("Flat reply ${i + 1}")`);
      }

      // All posts should be at the same level (no indentation)
      const posts = await page.locator('[component="post"]').all();
      for (const post of posts) {
        const depth = await post.getAttribute('data-depth');
        expect(depth).toBeNull(); // No depth attribute when threading is disabled
        
        // Check no threading UI elements
        const collapseBtn = post.locator('[component="post/thread/collapse"]');
        await expect(collapseBtn).not.toBeVisible();
        
        const replyToIndicator = post.locator('[component="post/parent-indicator"]');
        await expect(replyToIndicator).not.toBeVisible();
      }
    });

    test('should not include parentPid in post data when disabled', async ({ page }) => {
      await page.goto(topicUrl);

      // Intercept API calls to check post data
      const responsePromise = page.waitForResponse(resp => 
        resp.url().includes('/api/v3/topics/') && resp.url().includes('/posts')
      );

      // Trigger a post load (refresh or navigate)
      await page.reload();
      
      const response = await responsePromise;
      const data = await response.json();
      
      // Check that posts don't have parentPid when threading is disabled
      expect(data.posts).toBeDefined();
      data.posts.forEach(post => {
        expect(post.parentPid).toBeUndefined();
      });
    });
  });

  test.describe('Flat View Mode (Threading Enabled but Flat View)', () => {
    test('should show threading toggle in flat mode', async ({ page }) => {
      await page.goto(topicUrl);
      
      // Ensure we're in flat view
      const toggle = page.locator('[component="topic/threading/toggle"]');
      await expect(toggle).toBeVisible();
      
      // Should show "Threaded" text (indicating we can switch TO threaded)
      await expect(toggle).toContainText('Threaded');
    });

    test('should display posts without indentation in flat view', async ({ page }) => {
      await page.goto(topicUrl);

      // Create nested replies
      await page.click('[component="topic/reply"]');
      await page.fill('[component="composer"] textarea', 'Parent reply');
      await page.click('[component="composer/submit"]');
      await page.waitForSelector('[component="post"]:has-text("Parent reply")');

      // Reply to the parent reply
      const parentPost = page.locator('[component="post"]:has-text("Parent reply")');
      await parentPost.locator('[component="post/reply"]').click();
      await page.fill('[component="composer"] textarea', 'Child reply');
      await page.click('[component="composer/submit"]');
      await page.waitForSelector('[component="post"]:has-text("Child reply")');

      // In flat view, posts should not be indented
      const posts = await page.locator('[component="post"]').all();
      for (const post of posts) {
        const style = await post.getAttribute('style');
        expect(style).not.toContain('margin-left');
        expect(style).not.toContain('padding-left');
      }

      // But parent indicators should still be visible
      const childPost = page.locator('[component="post"]:has-text("Child reply")');
      const parentIndicator = childPost.locator('[component="post/parent-indicator"]');
      await expect(parentIndicator).toBeVisible();
    });

    test('should maintain chronological order in flat view', async ({ page }) => {
      await page.goto(topicUrl);

      // Get all post timestamps
      const timestamps = await page.locator('[component="post"] [data-timestamp]').evaluateAll(
        elements => elements.map(el => parseInt(el.getAttribute('data-timestamp')))
      );

      // Verify chronological order (ascending)
      for (let i = 1; i < timestamps.length; i++) {
        expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i - 1]);
      }
    });
  });

  test.describe('Mixed Topics (Some with parentPid, some without)', () => {
    test('should handle mixed reply types correctly', async ({ page }) => {
      await page.goto(topicUrl);

      // Create a regular reply (no parent)
      await page.click('[component="topic/reply"]');
      await page.fill('[component="composer"] textarea', 'Regular reply');
      await page.click('[component="composer/submit"]');
      await page.waitForSelector('[component="post"]:has-text("Regular reply")');

      // Create a threaded reply
      const regularPost = page.locator('[component="post"]:has-text("Regular reply")');
      await regularPost.locator('[component="post/reply"]').click();
      await page.fill('[component="composer"] textarea', 'Threaded reply');
      await page.click('[component="composer/submit"]');
      await page.waitForSelector('[component="post"]:has-text("Threaded reply")');

      // Switch to threaded view
      await page.click('[component="topic/threading/toggle"]');
      await expect(page.locator('[component="topic/threading/toggle"]')).toContainText('Flat');

      // Verify structure
      const threadedReply = page.locator('[component="post"]:has-text("Threaded reply")');
      const threadedDepth = await threadedReply.getAttribute('data-depth');
      expect(parseInt(threadedDepth)).toBeGreaterThan(0);

      const regularReply = page.locator('[component="post"]:has-text("Regular reply")');
      const regularDepth = await regularReply.getAttribute('data-depth');
      expect(parseInt(regularDepth)).toBe(0);
    });
  });

  test.describe('Legacy Post Compatibility', () => {
    test('should handle posts with toPid field correctly', async ({ page }) => {
      // Create a post with toPid (legacy field)
      await page.goto(topicUrl);
      
      // Simulate a legacy post creation
      await page.evaluate(async (pid) => {
        // This would typically be done server-side, but simulating for test
        await fetch('/api/v3/posts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: 'Legacy reply using toPid',
            tid: window.ajaxify.data.tid,
            toPid: pid // Using old field name
          })
        });
      }, mainPostPid);

      await page.reload();
      
      // The post should still appear and work correctly
      const legacyPost = page.locator('[component="post"]:has-text("Legacy reply using toPid")');
      await expect(legacyPost).toBeVisible();
      
      // Should have parent indicator
      const parentIndicator = legacyPost.locator('[component="post/parent-indicator"]');
      await expect(parentIndicator).toBeVisible();
    });

    test('should not break existing post editing', async ({ page }) => {
      await page.goto(topicUrl);

      // Create a post
      await page.click('[component="topic/reply"]');
      await page.fill('[component="composer"] textarea', 'Post to edit');
      await page.click('[component="composer/submit"]');
      await page.waitForSelector('[component="post"]:has-text("Post to edit")');

      // Edit the post
      const post = page.locator('[component="post"]:has-text("Post to edit")');
      await post.locator('[component="post/edit"]').click();
      
      // Clear and add new content
      await page.fill('[component="composer"] textarea', 'Edited post content');
      await page.click('[component="composer/submit"]');

      // Verify edit was successful
      await expect(post).toContainText('Edited post content');
      await expect(post).not.toContainText('Post to edit');
    });

    test('should preserve post metadata during operations', async ({ page }) => {
      await page.goto(topicUrl);

      // Create a post with votes/bookmarks
      await page.click('[component="topic/reply"]');
      await page.fill('[component="composer"] textarea', 'Post with metadata');
      await page.click('[component="composer/submit"]');
      await page.waitForSelector('[component="post"]:has-text("Post with metadata")');

      const post = page.locator('[component="post"]:has-text("Post with metadata")');
      
      // Upvote the post
      await post.locator('[component="post/upvote"]').click();
      
      // Bookmark the post
      await post.locator('[component="post/bookmark"]').click();

      // Switch view modes
      await page.click('[component="topic/threading/toggle"]');
      await page.click('[component="topic/threading/toggle"]');

      // Verify metadata is preserved
      const upvoteCount = await post.locator('[component="post/vote-count"]').textContent();
      expect(parseInt(upvoteCount)).toBeGreaterThan(0);
      
      const bookmarkBtn = post.locator('[component="post/bookmark"]');
      await expect(bookmarkBtn).toHaveClass(/bookmarked/);
    });
  });

  test.describe('Performance with Non-threaded Posts', () => {
    test('should load large flat topics efficiently', async ({ page }) => {
      await page.goto(topicUrl);

      // Measure initial load time
      const startTime = Date.now();
      
      // Create multiple posts quickly
      const postPromises = [];
      for (let i = 0; i < 10; i++) {
        postPromises.push(
          page.evaluate(async (content) => {
            await fetch('/api/v3/posts', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                content: content,
                tid: window.ajaxify.data.tid
              })
            });
          }, `Performance test post ${i}`)
        );
      }
      
      await Promise.all(postPromises);
      await page.reload();
      
      const loadTime = Date.now() - startTime;
      
      // Should load in reasonable time (adjust threshold as needed)
      expect(loadTime).toBeLessThan(5000); // 5 seconds
      
      // All posts should be visible
      const posts = await page.locator('[component="post"]').count();
      expect(posts).toBeGreaterThanOrEqual(11); // Original + 10 new posts
    });
  });
});