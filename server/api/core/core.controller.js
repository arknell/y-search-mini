/**
 * 색인 DB Core 관리
 * Using Rails-like standard naming convention for endpoints.
 * GET     /api/cores              ->  index
 * 2018.05.23 batch 전용으로 변경되었음
 */

'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.index = index;
exports.meta = meta;
exports.metaSave = metaSave;
exports.save = save;
exports.indexInfo = indexInfo;
exports.create = create;
exports.testConnection = testConnection;
exports.getColumns = getColumns;
exports.getIndexInfo = getIndexInfo;
exports.remove = remove;
exports.init = init;
var _ = require('lodash');
var mongodb = require('../../components/commons/mongo');
var rdb = require('../../components/commons/rdb');

var logger = require('../../components/loggers/logger');

/**
 * 전체 목록가져오기, db 이름 순으로 가져옴
 * @param req   // 요청 객체 (req.body : 요청 파라메터)  이하 동일 (모든 controller에서 사용)
 * @param res   // 응답 객체                           이하 동일 (모든 controller에서 사용)
 */
function index(req, res) {
	var sitePrefix = req.body.sitePrefix;
	var temp = [];
	var query = {};
	if (sitePrefix) {
		query._id = { $regex: new RegExp(sitePrefix + "_.*") };
	}

	mongodb.open('core', 'coredb').then(function (coredb) {
		return coredb.find(query).sort({ _id: 1 }).toArray(function (err, result) {
			if (result == null || result == undefined) return res.json(temp);

			for (var i = 0; i < result.length; i++) {
				temp.push(result[i]);
			}

			logger.log('info', 'Get all List : take all database list success');
			return res.json(temp);
		});
	}).catch(function (err) {
		return console.log(err);
	});
}

function meta(req, res) {
	var temp = [];
	mongodb.open('core', 'coredb_meta', true).then(function (coredb) {
		return coredb.find().sort({ _id: 1 }).toArray(function (err, result) {
			if (result == null || result == undefined) return res.json(temp);

			for (var i = 0; i < result.length; i++) {
				temp.push(result[i]);
			}

			logger.log('info', 'Get all List : take all database list success');
			return res.json(temp);
		});
	}).catch(function (err) {
		return console.log(err);
	});
}

function metaSave(req, res) {
	var coreList = req.body;
	return mongodb.open('core', 'coredb_meta', true).then(function (coredb) {
		coredb.remove({}, function (err) {
			if (coreList.length > 0) {

				coredb.insert(coreList, function (err) {
					//	console.log(err);
					res.json({ result: 'done' });
				});
			}
		});
	}).catch(function (err) {
		return console.log(err);
	});
}

function save(req, res) {
	var core = req.body.core;
	var prefix = req.body.prefix;
	return mongodb.open('core', 'coredb', true).then(function (coredb) {
		coredb.save(core, function (err) {
			//	console.log(err);
			res.json({ result: 'done' });
		});
	}).catch(function (err) {
		return console.log(err);
	});
}

// 일반 목록 가져오기 --> 보안 문제로 DB 정보 제거
// db 이름 순으로 정렬
// Gets a list of Cores
function indexInfo(req, res) {
	var temp = [];
	return mongodb.open('core', 'coredb').then(function (coredb) {
		return coredb.find().sort({
			_id: 1
		}).toArray(function (err, result) {
			for (var i = 0; i < result.length; i++) {
				temp.push(_.omit(result[i], ['db', 'index']));
			}

			return res.json(temp);
		});
	}).catch(function (err) {
		return console.log(err);
	});
}

// Core 생성 및 재저장
function create(req, res) {
	return mongodb.open('core', 'coredb').then(function (coredb) {
		return coredb.save(req.body, function (err) {
			if (err) {
				throw err;
			}

			return res.status(201).json({
				result: 'success'
			});
		});
	}).catch(function (err) {
		return console.log(err);
	});
}

// RDB 커넥션 테스트
function testConnection(req, res) {
	var config = req.body;
	return rdb[config.type].connect(config, function (err, conn) {
		if (err) {
			logger.log('error', 'Test Connection : connect RDB fail\n' + err.message);

			return res.json(403, err.message);
		}

		return res.json({
			result: 'success'
		});
	});
}

// RDB에서 컬럼 가져오기
function getColumns(req, res) {
	var config = req.body;

	//console.log(req.body);

	var sql = rdb[config.type].getPagingSql(req.body.sql);

	var params = [{ key: 'firstIndex', value: 1, type: 'Int' }, { key: 'lastIndex', value: 2, type: 'Int' }];

	return rdb[config.type].queryWithConn(sql, params, config, function (rows, cnt) {
		return res.json({
			keys: _.keys(rows[0]),
			sample: rows[0],
			// fulldata : rows
			cnt: cnt
		});
	});
}

// 색인 정보 가져오기
function getIndexInfo(req, res) {

	var name = req.body._id;
	return mongodb.open('core', name).then(function (localdb) {
		return localdb.count(function (err, count) {
			logger.log('info', 'Get Index : get Index Information\ncount:' + count);

			return res.json(count);
		});
	}).catch(function (err) {
		return console.log(err);
	});
}

// Core 삭제
function remove(req, res) {
	var name = req.body.key;
	return mongodb.open('core', 'coredb').then(function (coredb) {
		return coredb.deleteOne({ _id: req.body.key }, function (err) {
			if (err) {
				logger.log('error', 'Remove Core : remove ' + req.params.key + ' from coredb fail\n' + err.message);
				throw err;
			}

			mongodb.destroy('core', name).then(function () {
				return mongodb.destroy('core', name + "_term");
			}).then(function () {
				return mongodb.destroy('core', name + "_posting");
			}).then(function () {
				logger.log('info', 'Remove Core : removed ' + req.params.key + ' from coredb success');
				res.json({ result: "success" });
			});
		});
	}).catch(function (err) {
		return console.log(err);
	});
}

/**
 * mongodb 초기화
 * @param req
 * @param res
 * @returns {*}
 */
function init(req, res) {
	return mongodb.open('core', 'coredb').then(function (coredb) {
		return coredb.find({}, function (err, result) {
			var _loop = function _loop(i) {
				var docdb = result[i]._id;

				mongodb.destroy('core', docdb).then(function () {
					return mongodb.destroy('core', docdb + "_term");
				}).then(function () {
					return mongodb.destroy('core', docdb + "_posting");
				}).then(function () {
					return coredb.remove({}, function () {
						res.json({ result: "success" });
					});
				});
			};

			for (var i = 0; i < result.length; i++) {
				_loop(i);
			}
		});
	}).catch(function (err) {
		return console.log(err);
	});
}
//# sourceMappingURL=core.controller.js.map
