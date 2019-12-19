/*
 * Copyright 2019 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */
const fs = require('fs-extra');
const path = require('path');
const Ajv = require('ajv');
const { match } = require('@adobe/helix-vulcain-filters');
const BaseConfig = require('./BaseConfig.js');

class SchemaDerivedConfig extends BaseConfig {
  constructor({
    filename,
    schemas = {},
    handlers = {},
  } = {}) {
    super(filename);

    this._content = null;
    this._schemas = schemas;
    this._handlers = handlers;
  }

  async validate() {
    const ajv = new Ajv({
      allErrors: true,
      verbose: true,
      useDefaults: true,
      coerceTypes: 'array',
    });

    for (const [_, value] of Object.entries(this._schemas || {})) {
      ajv.addSchema(value);
    }

    const res = ajv.validate(this._schemas['^/$'], this._cfg);
    if (res) {
      return res;
    }
    throw new Error(ajv.errorsText());
  }

  static matches(path) {
    return (pattern) => new RegExp(pattern).test(path);
  }

  defaultHandler(root = '/') {
    return {
      get: (target, prop, receiver) => {
        if (prop === 'then') {
          return target[prop];
        }
        if (prop === 'toJSON') {
          return () => this._cfg;
        }
        const handler = this.getHandler(root + prop);

        return new Proxy(target[prop], handler);
      },
    };
  }

  getHandler(path) {
    const matching = Object.keys(this._handlers).filter(SchemaDerivedConfig.matches(path));
    if (matching.length > 0) {
      const [firstmatch] = matching;
      console.log('custom handler for ', path);
      return this._handlers[firstmatch];
    }
    return this.defaultHandler(path);
  }

  async init() {
    await this.loadConfig();

    for (const [key, value] of Object.entries(this._schemas || {})) {
      const schema = await fs.readJson(path.resolve(__dirname, 'schemas', value));
      this._schemas[key] = schema;
    }

    await this.validate();

    this._content = new Proxy(this._cfg, this.getHandler('/'));

    return this._content;
  }

  toJSON() {
    return this._cfg;
  }
}

module.exports = SchemaDerivedConfig;
