/*
 * Copyright 2020 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

/* eslint-env mocha */

const assert = require('assert');
const fs = require('fs-extra');
const path = require('path');
const RedirectConfig = require('../src/RedirectConfig');
const { setupPolly } = require('./utils.js');

const SPEC_ROOT = path.resolve(__dirname, 'specs/redirectsconfig');
describe('Redirects Config Loading (from GitHub)', () => {
  setupPolly({
    recordIfMissing: false,
    logging: false,
  });

  it('Retrieves Document from GitHub', async function get() {
    const { server } = this.polly;

    server.get('https://adobeioruntime.net/api/v1/web/helix/helix-services/:path').intercept((req, res) => {
      if (req.query.src.startsWith('https://adobe.sharepoint.com/')) {
        return res.status(200).json([
          {
            from: '/foo',
            to: '/bar',
          },
          {
            from: 'https://blog.adobe.com/en/2020/08/17/redefining%20-he-digital-experience-for-creating-and-collaborating-on-learning-content.html',
            to: 'https://blog.adobe.com/en/2020/08/17/redefining-the-digital-experience-for-creating-and-collaborating-on-learning-content.html',
          },
        ]);
      } else if (req.query.src.startsWith('https://docs.google.com/')) {
        return res.status(200).json([{
          src: '/bar',
          target: '/baz',
          kind: 'temporary',
        }]);
      }

      throw new Error('unsupported source');
    });

    const config = await new RedirectConfig()
      .withCache({ maxSize: 1 })
      .withRepo('trieloff', 'helix-demo', '4e05a4e2c7aac6dd8d5f2b6dcf05815994812d7d')
      .init();

    assert.deepEqual(config.toJSON().redirects, [
      'https://adobe.sharepoint.com/sites/TheBlog/_layouts/15/guestaccess.aspx?share=ESR1N29Z7HpCh1Zfs_0YS_gB4gVSuKyWRut-kNcHVSvkew&email=helix%40adobe.com&e=hx0OUl',
      'https://docs.google.com/spreadsheets/d/1IX0g5P74QnHPR3GW1AMCdTk_-m954A-FKZRT2uOZY7k/edit?ouid=107837958797411838063&usp=sheets_home&ths=true',
      'https://raw.githubusercontent.com/adobe/helix-demo/master/config/redirects.csv',
      {
        from: '(.*)\\.php',
        to: '$1.html',
      },
      {
        from: '/content/dam/(.*)$',
        to: '/htdocs/$1',
      },
    ]);

    assert.equal(config.redirects.length, 5);

    assert.deepEqual(await config.match('/content/dam/test.png'), {
      url: '/htdocs/test.png',
      type: 'permanent',
    });

    assert.deepEqual(await config.match('/content/dam/test.php'), {
      url: '/content/dam/test.html',
      type: 'permanent',
    });

    assert.deepEqual(await config.match('/foo'), {
      url: '/bar',
      type: 'permanent',
    });

    assert.deepEqual(await config.match('/bar'), {
      url: '/baz',
      type: 'temporary',
    });

    assert.deepEqual(await config.match('/en/2020/08/17/redefining%20-he-digital-experience-for-creating-and-collaborating-on-learning-content.html'), {
      url: 'https://blog.adobe.com/en/2020/08/17/redefining-the-digital-experience-for-creating-and-collaborating-on-learning-content.html',
      type: 'permanent',
    });

    assert.deepEqual(await config.match('/en/2020/08/17/redefining -he-digital-experience-for-creating-and-collaborating-on-learning-content.html'), {
      url: 'https://blog.adobe.com/en/2020/08/17/redefining-the-digital-experience-for-creating-and-collaborating-on-learning-content.html',
      type: 'permanent',
    });
  }).timeout(10000);
});

const tests = [
  {
    title: 'loads a theblog example',
    config: 'redirects.yaml',
    result: 'redirects.json',
  },
  {
    title: 'loads an empty redirects config',
    config: 'empty.yaml',
    result: 'empty.json',
  },
  {
    title: 'loads a feed config',
    config: 'feeds.yaml',
    result: 'feeds.json',
  },
];

describe('Redirect Config Loading', () => {
  tests.forEach((test) => {
    it(test.title, async () => {
      try {
        const cfg = new RedirectConfig()
          .withConfigPath(path.resolve(SPEC_ROOT, test.config));
        await cfg.init();
        if (test.result) {
          const expected = JSON.parse(await fs.readFile(path.resolve(SPEC_ROOT, test.result), 'utf-8'));
          const actual = cfg.toJSON();
          assert.deepEqual(actual, expected);
        } else {
          assert.fail(`${test.title} should be invalid.`);
        }
      } catch (e) {
        if (test.error) {
          assert.equal(e.toString(), test.error);
        } else {
          throw e;
        }
      }
    });
  });

  it('Does not trip over unset config', async () => {
    const cfg = new RedirectConfig();

    await cfg.init();

    const actual = cfg.toJSON();
    const expected = JSON.parse(await fs.readFile(path.resolve(SPEC_ROOT, 'empty.json'), 'utf-8'));

    assert.deepEqual(actual, expected);
  });

  it('Does not trip over non-existing config', async () => {
    const cfg = new RedirectConfig()
      .withDirectory(SPEC_ROOT);
    await cfg.init();

    // assert.strictEqual(cfg.getQuery('foo', 'bar'), undefined);

    const actual = cfg.toJSON();
    const expected = JSON.parse(await fs.readFile(path.resolve(SPEC_ROOT, 'empty.json'), 'utf-8'));

    assert.deepEqual(actual, expected);
  });

  it('theblog Redirects Config gets loaded from JSON', async () => {
    const cfg = new RedirectConfig()
      .withJSON(fs.readJSONSync(path.resolve(SPEC_ROOT, 'redirects.json')));
    await cfg.init();
    assert.equal(cfg.redirects.length, 5);
    assert.ok(Array.isArray(cfg.redirects));
    assert.equal(cfg.vanity[0].name, 'canonical');
    // eslint-disable-next-line no-template-curly-in-string
    assert.equal(cfg.vanity[0].fetch, 'https://${repo}-${owner}.project-helix.page/${path}');

    assert.equal(cfg.redirects[4].type, 'temporary');

    assert.equal(cfg.redirects[3].match('/test.php').type, 'internal');
  });

  it('feed Redirects Config gets loaded from YAML', async () => {
    const cfg = new RedirectConfig()
      .withSource(fs.readFileSync(path.resolve(SPEC_ROOT, 'feeds.yaml')).toString());
    await cfg.init();
    assert.equal(cfg.redirects.length, 2);

    assert.equal((await cfg.match('/tags/news/feed')).url, '/feed.xml');
    assert.equal((await cfg.match('/tags/news/feed/')).url, '/feed.xml');
  });
});
