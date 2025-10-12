require("dotenv").config();

const fs = require("fs");
const path = require('path');
const pluginRSS = require("@11ty/eleventy-plugin-rss");
const localImages = require("eleventy-plugin-local-images");
const lazyImages = require("eleventy-plugin-lazyimages");
const ghostContentAPI = require("@tryghost/content-api");
const readingTime = require('eleventy-plugin-reading-time');
const syntaxHighlight = require('@11ty/eleventy-plugin-syntaxhighlight');
const htmlMinTransform = require("./src/html-min-transform.js");
const { DateTime } = require('luxon');
const { JSDOM } = require("jsdom");
const Prism = require("prismjs");
const loadLanguages = require("prismjs/components/");

// optional: preload common languages
loadLanguages(['markup','css','clike','javascript','bash','json','yaml','markdown','typescript']);

// helper to ensure a language is loaded
function ensureLanguage(lang) {
  if (!Prism.languages[lang]) {
    try { loadLanguages([lang]); } catch(_) {}
  }
}

// Init Ghost API
const api = new ghostContentAPI({
  url: process.env.GHOST_API_URL,
  key: process.env.GHOST_CONTENT_API_KEY,
  version: "v2.0"
});

// Strip Ghost domain from urls
const stripDomain = url => {
  return url
    .replace(process.env.GHOST_API_URL, "")
    .replace(process.env.SITE_URL || "", "")
    .replace('https://www.ryanc.me', "");
};

const isDev = process.env.ELEVENTY_ENV === 'development';
const isProd = process.env.ELEVENTY_ENV === 'production'

const manifestPath = path.resolve(
  __dirname,
  'dist',
  'assets',
  'manifest.json'
);

const manifest = isDev
  ? {
      'main.js': '/assets/main.js',
      'main.css': '/assets/main.css',
    }
  : JSON.parse(fs.readFileSync(manifestPath, { encoding: 'utf8' }));

module.exports = function(config) {
  // Minify HTML
  if (isProd) {
    config.addTransform("htmlmin", htmlMinTransform);
  }

  // syntax highlighting
  config.addTransform("ghostPrism", (content, outputPath) => {
    if (outputPath && outputPath.endsWith(".html")) {
      const dom = new JSDOM(content);
      const { document } = dom.window;

      document.querySelectorAll("pre > code[class*='language-']").forEach(codeEl => {
        const className = Array.from(codeEl.classList).find(c => c.startsWith("language-"));
        if (!className) return;
        const lang = className.replace("language-", "") || "markup";

        ensureLanguage(lang);
        const grammar = Prism.languages[lang] || Prism.languages.markup;

        const raw = codeEl.textContent;
        const highlighted = Prism.highlight(raw, grammar, lang);

        codeEl.innerHTML = highlighted;

        const pre = codeEl.parentElement;
        pre.classList.add(`language-${lang}`);
        pre.classList.add("line-numbers"); // enable line numbers

        // Count lines (don’t count a trailing newline as an extra line)
        const lineCount = (raw.match(/\n(?!$)/g) || []).length + 1;

        // Create/update the rows container
        let rows = pre.querySelector(".line-numbers-rows");
        if (!rows) {
          rows = document.createElement("span");
          rows.className = "line-numbers-rows";
          rows.setAttribute("aria-hidden", "true");
          pre.appendChild(rows);
        }
        rows.innerHTML = "<span></span>".repeat(lineCount);

        // Optional: support custom starting line via data-start on <pre>
        const startAttr = pre.getAttribute("data-start");
        if (startAttr) {
          const start = parseInt(startAttr, 10);
          if (!Number.isNaN(start)) {
            // Many themes use CSS var --start to offset the counter
            pre.style.setProperty("--start", String(start - 1));
          }
        }
      });

      return dom.serialize();
    }
    return content;
  });


  config.addNunjucksGlobal("getTag", function(tags, tagSlug) {
    if (!tags) return null;
    return tags.find(tag => tag.slug === tagSlug);
  });

  config.addNunjucksGlobal("getTagPosts", function(posts, tagSlug) {
    if (!posts) return null;
    // get posts with a matching tag
    return posts.filter(post => post.tags.find(tag => tag.slug === tagSlug));
  });

  // Assist RSS feed template
  config.addPlugin(pluginRSS);

  // Apply performance attributes to images
  // config.addPlugin(lazyImages, {
  //   cacheFile: ""
  // });

  // Copy images over from Ghost
  // config.addPlugin(localImages, {
  //   distPath: "dist",
  //   assetPath: "/assets/images",
  //   selector: "img",
  //   attribute: "data-src", // Lazy images attribute
  //   verbose: false
  // });

  // post reading time
  config.addPlugin(readingTime);

  // setup mermaid markdown highlighter
  // const highlighter = config.markdownHighlighter;
  // config.addMarkdownHighlighter((str, language) => {
  //   if (language === 'mermaid') {
  //     return `<pre class="mermaid">${str}</pre>`;
  //   }
  //   return highlighter(str, language);
  // });

  config.addFilter('excerpt', (post) => {
    const content = post.replace(/(<([^>]+)>)/gi, '');
    return content.substr(0, content.lastIndexOf(' ', 200)) + '...';
  });

  config.addFilter('readableDate', (dateObj) => {
    return DateTime.fromJSDate(dateObj, { zone: 'utc' }).toFormat(
      'dd LLL yyyy'
    );
  });
  config.addFilter('isoDate', (dateObj) => {
    return DateTime.fromJSDate(dateObj, { zone: 'utc' }).toFormat(
      'yyyy-LL-dd'
    );
  });

  config.addFilter('htmlDateString', (dateObj) => {
    return DateTime.fromJSDate(dateObj, { zone: 'utc' }).toFormat('yyyy-LL-dd');
  });

  config.addFilter('dateToIso', (dateString) => {
    return new Date(dateString).toISOString()
  });

  config.addFilter('head', (array, n) => {
    if (n < 0) {
      return array.slice(n);
    }

    return array.slice(0, n);
  });

  config.setDataDeepMerge(true);
  config.addPassthroughCopy({ 'src/images': 'assets/images' });
  config.addPassthroughCopy({ 'images/favicon.ico': 'favicon.ico' });

  config.addShortcode('bundledcss', function () {
    return manifest['main.css']
      ? `<link href="${manifest['main.css']}" rel="stylesheet" />`
      : '';
  });

  config.addShortcode('bundledjs', function () {
    return manifest['main.js']
      ? `<script src="${manifest['main.js']}"></script>`
      : '';
  });

  // Don't ignore the same files ignored in the git repo
  config.setUseGitIgnore(false);

  // Get all pages, called 'docs' to prevent
  // conflicting the eleventy page object
  config.addCollection("docs", async function(collection) {
    collection = await api.pages
      .browse({
        include: "authors",
        limit: "all"
      })
      .catch(err => {
        console.error(err);
      });

    collection.map(doc => {
      doc.url = stripDomain(doc.url);
      doc.primary_author.url = stripDomain(doc.primary_author.url);

      // Convert publish date into a Date object
      doc.published_at = new Date(doc.published_at);
      return doc;
    });

    return collection;
  });

  // Get all posts
  config.addCollection("posts", async function(collection) {
    collection = await api.posts
      .browse({
        include: "tags,authors",
        limit: "all"
      })
      .catch(err => {
        console.error(err);
      });

    collection.forEach(post => {
      post.url = stripDomain(post.url);
      post.primary_author.url = stripDomain(post.primary_author.url);
      post.tags.map(tag => (tag.url = stripDomain(tag.url)));

      // Convert publish date into a Date object
      post.published_at = new Date(post.published_at);
    });

    // Bring featured post to the top of the list
    collection.sort((post, nextPost) => nextPost.featured - post.featured);

    return collection;
  });

  // // Get all authors
  // config.addCollection("authors", async function(collection) {
  //   collection = await api.authors
  //     .browse({
  //       limit: "all"
  //     })
  //     .catch(err => {
  //       console.error(err);
  //     });

  //   // Get all posts with their authors attached
  //   const posts = await api.posts
  //     .browse({
  //       include: "authors",
  //       limit: "all"
  //     })
  //     .catch(err => {
  //       console.error(err);
  //     });

  //   // Attach posts to their respective authors
  //   collection.forEach(async author => {
  //     const authorsPosts = posts.filter(post => {
  //       post.url = stripDomain(post.url);
  //       return post.primary_author.id === author.id;
  //     });
  //     if (authorsPosts.length) author.posts = authorsPosts;

  //     author.url = stripDomain(author.url);
  //   });

  //   return collection;
  // });

  // Get all tags
  config.addCollection("tags", async function(collection) {
    collection = await api.tags
      .browse({
        include: "count.posts",
        limit: "all"
      })
      .catch(err => {
        console.error(err);
      });

    // Get all posts with their tags attached
    const posts = await api.posts
      .browse({
        include: "tags,authors",
        limit: "all"
      })
      .catch(err => {
        console.error(err);
      });

    // Attach posts to their respective tags
    collection.forEach(async tag => {
      const taggedPosts = posts.filter(post => {
        post.url = stripDomain(post.url);
        return post.primary_tag && post.primary_tag.slug === tag.slug;
      });
      if (taggedPosts.length) tag.posts = taggedPosts;

      tag.url = stripDomain(tag.url);
    });

    return collection;
  });

  // Display 404 page in BrowserSnyc
  config.setBrowserSyncConfig({
    callbacks: {
      ready: (err, bs) => {
        const content_404 = fs.readFileSync("dist/404.html");

        bs.addMiddleware("*", (req, res) => {
          // Provides the 404 content without redirect.
          res.write(content_404);
          res.end();
        });
      }
    },
    files: [manifestPath] 
  });

  // Eleventy configuration
  return {
    dir: {
      input: "src",
      output: "dist",
      layouts: "layouts",
      includes: "partials",
    },

    // Files read by Eleventy, add as needed
    templateFormats: ["css", "njk", "md", "txt"],
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk",
    passthroughFileCopy: true
  };
};
