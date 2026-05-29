import { handleAssetGroup } from '../asset/_group.js';
export default (req, res) => handleAssetGroup(req, res, { route: 'fii/profile', forceType: 'FII', group: 'profile' });
