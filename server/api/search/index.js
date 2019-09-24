/**
 * 검색 API
 */
'use strict';

var express = require('express');
var controller = require('./search.controller');

var router = express.Router();

router.all('/*', function (req, res, next) {
	res.header("Access-Control-Allow-Origin", "*");
	res.header("Access-Control-Allow-Methods", "POST,GET,OPTIONS");
	res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
	next();
});

router.get('/', controller.index);
router.post('/', controller.search); // 검색 요청

module.exports = router;
//# sourceMappingURL=index.js.map
