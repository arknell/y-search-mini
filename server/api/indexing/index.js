/**
 * 색인 APIs
 */
'use strict';

var _express = require('express');

var _indexing = require('./indexing.controller');

var controller = _interopRequireWildcard(_indexing);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

var router = new _express.Router();

router.all('/*', function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "POST,GET,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

/**
 * 각 요청에 따른 컨트롤러내의 함수 호출
 */
router.post('/one', controller.indexingOne);
router.post('/remove', controller.remove);
router.post('/modify', controller.modify);
router.post('/content', controller.indexingWithInformation);
router.post('/math', controller.indexingMath);
router.post('/getTotal', controller.getTotal);
router.post('/copy', controller.copy);
router.post('/indexing', controller.indexing);
router.post('/updateColumn', controller.update);
router.post('/removeAll', controller.destroy);
router.post('/checkKey', controller.indexingCheck);

module.exports = router;
//# sourceMappingURL=index.js.map
