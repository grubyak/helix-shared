/*
 * Copyright 2018 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

const URI = require('uri-js');
const GitUrl = require('./GitUrl.js');
const Origin = require('./Origin');

/**
 * Static content handling
 */
class Static {
  constructor(cfg, defaults) {
    this._url = new GitUrl(cfg, defaults);
    this._magic = cfg.magic || false;
    this._allow = cfg.allow || [];
    this._deny = cfg.deny || [];

    if (!this._url.path) {
      // todo: ... this is a by ugly
      // eslint-disable-next-line no-underscore-dangle
      this._url._path = '/htdocs';
    }
  }

  get url() {
    return this._url;
  }

  get magic() {
    return this._magic;
  }

  get allow() {
    return this._allow;
  }

  get deny() {
    return this._deny;
  }

  get path() {
    return this._url.path;
  }

  get owner() {
    return this._url.owner;
  }

  get repo() {
    return this._url.repo;
  }

  get ref() {
    return this._url.ref;
  }

  /**
   * JSON Serialization of Static
   * @typedef Static~JSON
   * @augments GitUrl~JSON
   * @property {boolean} magic
   * @property {String[]} allow
   * @property {String[]} deny
   */

  /**
   * Returns a json representation
   * @returns {Static~JSON}
   */
  toJSON() {
    return Object.assign({}, this.url.toJSON(), {
      magic: this.magic,
      allow: this.allow,
      deny: this.deny,
    });
  }
}

/**
 * Performance Definition
 */
class Performance {
  constructor(cfg = {}) {
    this._device = cfg.device || '';
    this._location = cfg.location || '';
    this._connection = cfg.connection || '';
  }


  get device() {
    return this._device;
  }

  get location() {
    return this._location;
  }

  get connection() {
    return this._connection;
  }

  /**
   * JSON Serialization of Performance
   * @typedef Performance~JSON
   * @property {String} device
   * @property {String} location
   * @property {String} connection
   */

  /**
   * Returns a json representation
   * @returns {Performance~JSON}
   */
  toJSON() {
    return {
      device: this.device,
      location: this.location,
      connection: this.connection,
    };
  }
}

/**
 * Strain
 */
class Strain {
  constructor(name, cfg) {
    this._name = name;
    if (cfg.origin) {
      // proxy
      this._origin = new Origin(cfg.origin);
    } else {
      this._origin = null;
      this._content = new GitUrl(cfg.content);
      this._code = new GitUrl(cfg.code);
      // todo: 1. do we still need whilelists?
      // todo: 2. do we want to fall back to code here, or should static be mandatory?
      const staticDefaults = Object.assign({ }, this._code.toJSON());
      this._static = new Static(cfg.static || {}, staticDefaults);
      // todo: default for directory index from schema?
      this._directoryIndex = cfg.directoryIndex || 'index.html';
    }

    // todo: schema for perf
    this._perf = new Performance(cfg.perf);
    this._condition = cfg.condition || '';

    // when `sticky` is not set
    // assume the strain to be sticky when there is a condition
    this._sticky = cfg.sticky === undefined ? this._condition !== '' : !!cfg.sticky;

    // todo: I assume this will go into the new condition language
    // todo: if not, I would only have 1 property `url` that can be single or multi valued
    this._url = cfg.url ? URI.normalize(cfg.url) : '';
    this._urls = new Set(Array.isArray(cfg.urls) ? cfg.urls.map(URI.normalize) : []);
    if (this._url) {
      this._urls.add(this._url);
    }
  }

  get url() {
    return this._url;
  }

  get urls() {
    return Array.from(this._urls.values());
  }

  get sticky() {
    return this._sticky;
  }

  get name() {
    return this._name;
  }

  get content() {
    return this._content;
  }

  set content(url) {
    this._content = url;
  }

  get code() {
    return this._code;
  }

  set code(code) {
    this._code = code;
  }

  get static() {
    return this._static;
  }

  get condition() {
    return this._condition;
  }

  get directoryIndex() {
    return this._directoryIndex;
  }

  get perf() {
    return this._perf;
  }

  get origin() {
    return this._origin;
  }

  isProxy() {
    return this._origin !== null;
  }

  /**
   * JSON Serialization of a Strain
   * @typedef Strain~JSON
   * @property {String} name
   * @property {String} code
   * @property {GitUrl~JSON} content
   * @property {Static~JSON} static
   * @property {String} condition
   * @property {String} directoryIndex
   * @property {Performance~JSON} perf
   * @property {Origin~JSON} origin
   */

  /**
   * Returns a json representation
   * @returns {Strain~JSON}
   */
  toJSON() {
    const json = {
      name: this.name,
      sticky: this.sticky,
      condition: this.condition,
      perf: this.perf.toJSON(),
      url: this.url,
      urls: this.urls,
    };
    if (this.isProxy()) {
      return Object.assign({
        origin: this.origin.toJSON(),
      }, json);
    }
    return Object.assign({
      code: this.code.toJSON(),
      content: this.content.toJSON(),
      directoryIndex: this.directoryIndex,
      static: this.static.toJSON(),
    }, json);
  }
}

module.exports = Strain;
