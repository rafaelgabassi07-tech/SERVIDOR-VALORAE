import { handleAssetGroup } from '../asset/_group.js';
export default (req, res) => handleAssetGroup(req, res, { route: 'fii/checklist', forceType: 'FII', kind: 'fii-checklist' });
