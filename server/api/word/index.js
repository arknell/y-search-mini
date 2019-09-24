'use strict';

var express = require('express');
var controller = require('./word.controller.js');

var router = express.Router();

router.all('/*', function (req, res, next) {
	res.header("Access-Control-Allow-Origin", "*");
	res.header("Access-Control-Allow-Methods", "POST,GET,OPTIONS");
	res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
	next();
});

router.post('/all', controller.index);
router.post('/search', controller.search);
router.post('/', controller.run);

module.exports = router;
//# sourceMappingURL=index.js.map
