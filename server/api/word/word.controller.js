/**
 * 유사어 저장 및 목록 조회
 */
'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.index = index;
exports.run = run;
exports.search = search;
var synonym = require('../../components/synonyms/synonym');
var logger = require('../../components/loggers/logger');
var _ = require('lodash');

// Gets a list of Leveldbs
function index(req, res) {
	synonym.getAllWord(res);
}

// Gets a list of Leveldbs
function run(req, res) {
	var doing = req.body;
	var method = doing.method;

	if (method === 'delete') {
		var key = doing.data;
		synonym.remove(key);
	} else if (method === 'save') {
		var words = doing.data;
		synonym.save(words);
	} else {
		logger.log('error', 'unknown method \'' + method + '\'');
	}

	res.json({});
}

function search(req, res) {
	var data = req.body.word;
	if (data == null || data === '') return index(req, res);

	return synonym.search(data, function (result) {
		res.json(result);
	});
}
//# sourceMappingURL=word.controller.js.map
