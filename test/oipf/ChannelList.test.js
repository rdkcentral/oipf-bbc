/**
 * Unit tests for lib/oipf/ChannelList.js — wraps a Firebolt channel list in an
 * array that follows the OIPF channel list interface. Focus:
 *   - each valid Firebolt channel becomes an oipf Channel, in order
 *   - a channel with no locator is skipped (Channel throws) without aborting
 *     the rest of the build
 *   - a missing/empty input yields an empty list
 *   - the item() helper indexes into the resulting array
 */

const { expect } = require('chai');
const ChannelList = require('oipf/ChannelList').default;

describe('oipf/ChannelList', () => {
    it('maps each valid Firebolt channel into the list, preserving order', () => {
        const list = ChannelList([
            { locator: 'tune://pgmno=1', channelId: '0001', name: 'One' },
            { locator: 'tune://pgmno=2', channelId: '0002', name: 'Two' }
        ]);

        expect(list).to.have.lengthOf(2);
        expect(list[0].ccid).to.equal('ccid:0001');
        expect(list[1].ccid).to.equal('ccid:0002');
    });

    it('skips a channel with no locator without dropping the valid ones', () => {
        const list = ChannelList([
            { locator: 'tune://pgmno=1', channelId: '0001', name: 'One' },
            { channelId: '0099', name: 'No Locator' },
            { locator: 'tune://pgmno=2', channelId: '0002', name: 'Two' }
        ]);

        expect(list).to.have.lengthOf(2);
        expect(list.map(c => c.ccid)).to.deep.equal(['ccid:0001', 'ccid:0002']);
    });

    it('returns an empty list when given no channels', () => {
        expect(ChannelList()).to.deep.equal([]);
        expect(ChannelList(null)).to.deep.equal([]);
        expect(ChannelList([])).to.deep.equal([]);
    });

    it('exposes item() to index into the list', () => {
        const list = ChannelList([{ locator: 'tune://pgmno=1', channelId: '0001' }]);
        expect(list.item(0)).to.equal(list[0]);
    });
});
