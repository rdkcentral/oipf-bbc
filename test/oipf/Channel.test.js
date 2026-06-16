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
 * Unit tests for lib/oipf/Channel.js — converts a Firebolt channel into an
 * OIPF channel object. Focus:
 *   - IPTV (http/https/dvb-mcast) locators set idType = ID_IPTV_URI
 *   - DVB (tune://) locators set idType = ID_DVB_C and extract pgmno → sid
 *   - a channel with a missing locator is invalid and throws (ChannelList
 *     catches this so one malformed entry doesn't crash the whole build)
 */

const { expect } = require('chai');
const Channel = require('oipf/Channel').default;

const ID_DVB_C = 10;
const ID_IPTV_URI = 41;
const CHANNEL_TYPES_TV = 0;
const CHANNEL_TYPES_RADIO = 1;

describe('oipf/Channel', () => {
    it('parses a DVB tune:// locator and extracts pgmno as sid', () => {
        const channel = new Channel({
            locator: 'tune://pgmno=10113&frequency=26700000&modulation=16',
            channelId: '0245',
            channelNumber: 101,
            name: 'BBC One'
        });

        expect(channel.idType).to.equal(ID_DVB_C);
        expect(channel.sid).to.equal('10113');
        expect(channel.ccid).to.equal('ccid:0245');
        expect(channel.majorChannel).to.equal(101);
        expect(channel.name).to.equal('BBC One');
        expect(channel.channelType).to.equal(CHANNEL_TYPES_TV);
    });

    it('recognises an IPTV (https) locator', () => {
        const channel = new Channel({
            locator: 'https://example.cdn.com/dash/manifest.mpd?duration=1804000',
            channelId: '0064'
        });

        expect(channel.idType).to.equal(ID_IPTV_URI);
    });

    it('marks radio channels with the radio channel type', () => {
        const channel = new Channel({ locator: 'tune://pgmno=5', isRadio: true });
        expect(channel.channelType).to.equal(CHANNEL_TYPES_RADIO);
    });

    it('throws when the channel has no locator', () => {
        //a locator-less entry is not a valid channel — it must throw so the
        //ChannelList can catch it and skip that one entry.
        expect(() => {
            new Channel({ channelId: '0099', channelNumber: 99 });
        }).to.throw();
    });

    it('throws when constructed with no argument', () => {
        expect(() => new Channel()).to.throw();
    });
});
