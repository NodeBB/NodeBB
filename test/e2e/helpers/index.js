const { expect } = require('@playwright/test');

/**
 * Helper functions for E2E tests
 */

async function loginAsUser(page, username, password) {
  await page.goto('/login');
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/^((?!login).)*$/); // Wait for redirect away from login
}

async function createTopic(page, categoryId, title, content) {
  await page.goto(`/category/${categoryId}`);
  await page.click('button[component="category/post"]');
  
  // Wait for composer to open
  await page.waitForSelector('.composer');
  
  await page.fill('input[placeholder="Enter your topic title here..."]', title);
  await page.fill('.composer textarea[component="composer/editor"]', content);
  await page.click('button[component="composer/submit"]');
  
  // Wait for navigation to the new topic
  await page.waitForURL(/\/topic\/\d+/);
  
  // Extract topic ID from URL
  const url = page.url();
  const match = url.match(/\/topic\/(\d+)/);
  return match ? match[1] : null;
}

async function createReply(page, content, parentPid = null) {
  if (parentPid) {
    // Click reply button on specific post
    await page.click(`[component="post"][data-pid="${parentPid}"] [component="post/reply"]`);
  } else {
    // Use quick reply
    await page.click('[component="topic/reply"]');
  }
  
  // Wait for composer
  await page.waitForSelector('.composer');
  
  // Fill in reply content
  await page.fill('.composer textarea[component="composer/editor"]', content);
  
  // If replying to specific post, the parentPid should be set automatically
  // We need to ensure it's passed to the API
  if (parentPid) {
    await page.evaluate((pid) => {
      // Inject parentPid into composer data
      if (window.app && window.app.composer) {
        const composerData = window.app.composer.posts[0] || {};
        composerData.parentPid = pid;
      }
    }, parentPid);
  }
  
  // Submit reply
  await page.click('button[component="composer/submit"]');
  
  // Wait for the reply to appear
  await page.waitForTimeout(1000); // Give time for post to be created
}

async function toggleThreadView(page) {
  await page.click('[data-action="toggle-threading"]');
  await page.waitForTimeout(500); // Wait for view transition
}

async function expandThread(page, postPid) {
  const threadToggle = page.locator(`[component="post"][data-pid="${postPid}"] .thread-toggle`);
  if (await threadToggle.isVisible()) {
    await threadToggle.click();
    await page.waitForTimeout(300); // Animation time
  }
}

async function collapseThread(page, postPid) {
  const threadToggle = page.locator(`[component="post"][data-pid="${postPid}"] .thread-toggle`);
  if (await threadToggle.isVisible()) {
    await threadToggle.click();
    await page.waitForTimeout(300); // Animation time
  }
}

async function getPostDepth(page, postPid) {
  const post = page.locator(`[component="post"][data-pid="${postPid}"]`);
  return await post.getAttribute('data-depth') || '0';
}

async function getThreadedPosts(page) {
  // Get all posts with their hierarchy
  return await page.evaluate(() => {
    const posts = [];
    document.querySelectorAll('[component="post"]').forEach(post => {
      posts.push({
        pid: post.getAttribute('data-pid'),
        depth: parseInt(post.getAttribute('data-depth') || '0'),
        content: post.querySelector('.post-content')?.textContent?.trim(),
        hasChildren: !!post.querySelector('.threaded-children'),
        isVisible: post.offsetParent !== null,
      });
    });
    return posts;
  });
}

async function waitForSocketEvent(page, eventName, timeout = 5000) {
  return await page.evaluate((event, ms) => {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout waiting for socket event: ${event}`));
      }, ms);
      
      if (window.socket) {
        window.socket.once(event, (data) => {
          clearTimeout(timer);
          resolve(data);
        });
      } else {
        clearTimeout(timer);
        reject(new Error('Socket not available'));
      }
    });
  }, eventName, timeout);
}

module.exports = {
  loginAsUser,
  createTopic,
  createReply,
  toggleThreadView,
  expandThread,
  collapseThread,
  getPostDepth,
  getThreadedPosts,
  waitForSocketEvent,
};