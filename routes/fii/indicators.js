import { handleAssetGroup } from '../asset/_group.js';
export default (req, res) => handleAssetGroup(req, res, { route: 'fii/indicators', kind: 'indicators', group: 'indicators', forceType: 'FII' });
