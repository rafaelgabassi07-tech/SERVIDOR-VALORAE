import { handleAssetGroup } from '../asset/_group.js';
export default (req, res) => handleAssetGroup(req, res, { route: 'fii/vacancy', forceType: 'FII', group: 'vacancy' });
