import { handleAssetGroup } from '../asset/_group.js';
export default (req, res) => handleAssetGroup(req, res, { route: 'fii/patrimonial', forceType: 'FII', group: 'patrimonial' });
