/*
 * Copyright (c) 2026 Infosys
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Unit tests for lib/oipf/oipfObjectFactory.js
 *
 * Focus:
 *   - the factory exposes all four public methods
 *   - createXObject() delegates to the matching constructor
 *   - isObjectSupported() returns true for every supported MIME type and false
 *     for everything else (unsupported type, empty string, undefined)
 *
 * The module patches document.getElementById and document.createElement at
 * load time. global.document is stubbed before each load so those assignments
 * succeed without a real browser environment.
 */

const { expect } = require('chai');
const proxyquire = require('proxyquire').noCallThru();

function loadFactory() {
    // Stub the browser globals that the module patches at load time.
    global.document = {
        getElementById: function () { return null; },
        createElement: function () { return { tagName: 'DIV', setAttribute: function () {} }; }
    };

    // Track constructor calls so the create* tests can assert the right class was used.
    const calls = { VideoBroadcast: 0, ApplicationManager: 0, Configuration: 0 };

    function VideoBroadcast() { calls.VideoBroadcast++; }
    function ApplicationManager() { calls.ApplicationManager++; }
    function Configuration() { calls.Configuration++; }

    delete require.cache[require.resolve('oipf/oipfObjectFactory')];
    const mod = proxyquire('oipf/oipfObjectFactory', {
        'oipf/VideoBroadcast': VideoBroadcast,
        'oipf/ApplicationManager': ApplicationManager,
        'oipf/Configuration': Configuration
    });

    return { factory: mod.default, calls };
}

describe('oipf/oipfObjectFactory', () => {
    let factory;
    let calls;
    let originalDocument;

    before(() => {
        originalDocument = global.document;
        ({ factory, calls } = loadFactory());
    });

    after(() => {
        if (typeof originalDocument === 'undefined') {
            delete global.document;
        } else {
            global.document = originalDocument;
        }
     });

    describe('shape', () => {
        it('exposes all four public methods', () => {
            const methods = [
                'createVideoBroadcastObject',
                'createApplicationManagerObject',
                'createConfigurationObject',
                'isObjectSupported'
            ];
            methods.forEach(function (m) {
                expect(factory[m], m).to.be.a('function');
            });
        });
    });

    describe('createVideoBroadcastObject', () => {
        it('delegates to the VideoBroadcast constructor', () => {
            const before = calls.VideoBroadcast;
            factory.createVideoBroadcastObject();
            expect(calls.VideoBroadcast).to.equal(before + 1);
        });
    });

    describe('createApplicationManagerObject', () => {
        it('delegates to the ApplicationManager constructor', () => {
            const before = calls.ApplicationManager;
            factory.createApplicationManagerObject();
            expect(calls.ApplicationManager).to.equal(before + 1);
        });
    });

    describe('createConfigurationObject', () => {
        it('delegates to the Configuration constructor', () => {
            const before = calls.Configuration;
            factory.createConfigurationObject();
            expect(calls.Configuration).to.equal(before + 1);
        });
    });

    describe('isObjectSupported', () => {
        it('returns true for video/broadcast', () => {
            expect(factory.isObjectSupported('video/broadcast')).to.equal(true);
        });

        it('returns true for application/oipfApplicationManager', () => {
            expect(factory.isObjectSupported('application/oipfApplicationManager')).to.equal(true);
        });

        it('returns true for application/oipfConfiguration', () => {
            expect(factory.isObjectSupported('application/oipfConfiguration')).to.equal(true);
        });

        it('returns false for an unsupported MIME type', () => {
            expect(factory.isObjectSupported('application/x-unknown')).to.equal(false);
        });

        it('returns false for an empty string', () => {
            expect(factory.isObjectSupported('')).to.equal(false);
        });

        it('returns false for undefined', () => {
            expect(factory.isObjectSupported(undefined)).to.equal(false);
        });
    });
});
