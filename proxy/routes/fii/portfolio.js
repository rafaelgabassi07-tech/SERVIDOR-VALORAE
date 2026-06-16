import { handleAssetGroup } from '../asset/_group.js';
export default (req, res) => handleAssetGroup(req, res, { route: 'fii/portfolio', forceType: 'FII', group: 'portfolio' });
