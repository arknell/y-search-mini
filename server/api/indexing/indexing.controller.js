/**
 * Using Rails-like standard naming convention for endpoints.
 * GET     /api/indexings              ->  index
 */

'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.indexingOne = indexingOne;
exports.indexingWithInformation = indexingWithInformation;
exports.indexingMath = indexingMath;
exports.remove = remove;
exports.modify = modify;
exports.getTotal = getTotal;
exports.copy = copy;
exports.indexing = indexing;
exports.update = update;
exports.destroy = destroy;
exports.indexingCheck = indexingCheck;
var _ = require('lodash');
//var mssql = require('../../components/commons/mssql');
var logger = require('../../components/loggers/logger');
// 2017.04.26 seeker 추가
var seeker = require('../../components/seekers/indexingSeeker');
var mongodb = require('../../components/commons/mongo');
var dbcopy = require('../../components/indexers/dbcopy');
var indexer = require('../../components/indexers/indexer');

/**
 * 문항 : 한 문항 색인 (증분색인) --> 팀스워드에서 호출
 * 그외 : 한 문서 색인 (증분색인) --> 문서 생성시에 호출해야 함 ex) 시험지 만들기에서 시험지 만든 후 {name: 'paperdoc', keys: [testcode1, testcode2]}
 * @param req
 * @param res
 */
function indexingOne(req, res) {
	// 2017.04.27 indexing one 요청 시 queue에 저장
	var obj = req.body;
	try {
		var keys = obj.keys;
		var name = obj.name || obj._id;
		for (var i = 0; i < keys.length; i++) {
			var newObj = { "keys": [keys[i]], "name": name };

			//indexing db 바꿀때까지 수행 안함 (2017.08.14) -> 교체 완료. 문제 없음(2017.08.17)
			seeker.send({ "req": newObj, "action": seeker.indexingOne });
		}
	} catch (e) {
		console.log(e.message);
	}

	return res.json({
		result: 'insert start'
	});
}

/**
 * 인덱싱할 내용을 함께 요청하였을 때 외부 인터페이스
 * @param req
 * @param res
 */
function indexingWithInformation(req, res) {
	var obj = req.body;
	var keys = obj.keys;
	var name = obj.name;
	var contents = obj.content;
	var classInfos = obj.classInfo;

	for (var i = 0; i < keys.length; i++) {
		var newObj = { "keys": [keys[i]], "name": name, "content": contents[i], "classInfo": classInfos[i] };

		seeker.send({ "req": newObj, "action": seeker.indexingOneWithContent });
	}

	return res.json({
		result: 'insert start'
	});
}

/**
 * 수식을 인덱싱 할 때 외부 인터페이스
 * @param req
 * @param res
 */
function indexingMath(req, res) {
	var obj = req.body;
	var keys = obj.keys;
	var contents = obj.content;
	var name = obj.name;

	for (var i = 0; i < keys.length; i++) {
		var newObj = { "keys": [keys[i]], "name": name, "content": contents[i] };

		seeker.send({ "req": newObj, "action": seeker.indexingMath });
	}

	return res.json({
		result: 'insert start'
	});
}

/**
 * 색인 삭제
 * @param req   // {name: 'paperdoc', keys: [testcode1, testcode2]}
 * @param res
 */
function remove(req, res) {
	// 2017.04.27 remove 요청 시 queue에 저장
	var obj = req.body;
	var keys = obj.keys;
	var name = obj.name || obj._id;
	for (var i = 0; i < keys.length; i++) {
		var newObj = { "keys": [keys[i]], "name": name };

		seeker.send({ "req": newObj, "action": seeker.remove });
	}

	return res.json({
		result: 'remove start'
	});
}

/**
 * 색인 수정 (삭제 후 재색인)
 * @param req
 * @param res
 */
function modify(req, res) {
	// 2017.04.27 modify 요청 시 queue에 저장
	var obj = req.body;
	var keys = obj.keys;
	var name = obj.name || obj._id;
	for (var i = 0; i < keys.length; i++) {
		var newObj = { "keys": [keys[i]], "name": name };

		seeker.send({ "req": newObj, "action": seeker.modify });
	}

	return res.json({
		result: 'modify start'
	});
}

function getTotal(req, res) {
	var dbname = req.body.dbname;

	return mongodb.open('batch', dbname).then(function (db) {
		var count = 0;

		return db.count(function (err, count) {
			if (err) res.json(err);

			res.json({
				result: "success",
				count: count
			});
		});
	}).catch(function (err) {
		console.log(err);
		return res.json({
			result: "fail"
		});
	});
}

function copy(req, res) {
	var dbo = req.body.dbo;
	var core = req.body.core;
	return mongodb.open('batch', 'coredb').then(function (coredb) {
		return coredb.save(core, function (err) {
			if (err) {
				return logger.log('error', 'copy : put to core db fail\n' + err.message);
			}

			var orderKey = core.index.columns.find(function (o) {
				return o.type == 'order';
			});

			var recentDate = core.recentUpdate;

			var pk = core.index.columns.find(function (o) {
				return o.type == "unique";
			});

			var parent = core.index.columns.find(function (o) {
				return o.type == "parent";
			});

			dbcopy.run({
				_id: core._id,
				dbo: dbo, // LDB 이름 (테이블명)
				name: core._id.split('_')[1], // DB 종류
				total: core.index.originalCount, // 전체 색인 count
				pk: pk.name, // key 값 !! 문서 마다 고유한 값이어야함
				parentkey: parent ? parent.name : undefined, // parent key 값
				config: core.db, // core DB 정보(커넥션)
				ipp: 100, // 한번에 복사할 문서 수
				order: orderKey, // 정렬할 key, 문서 당 1개씩만 - 2017.08.07, KCW
				recentUpdate: recentDate, // 최근 복사날짜, 해당 날짜 이후의 문항만 복사함 - 2017.08.07, KCW
				apiurl: core.apiurl
			}, function (err, result) {
				// callback 비동기로 처리
				if (err) {
					return logger.log('error', 'copy : Copy RDB to LDB fail\n' + err.message);
				}

				return logger.log('info', 'copy : Copy RDB to LDB success\n' + result);
			});

			return res.status(201).json({
				result: 'success'
			});
		});
	}).catch(function (err) {
		return console.log(err);
	});
}

// 색인 시작
function indexing(req, res) {
	var core = req.body.core;
	var isEach = req.body.isEach;

	logger.log('info', 'indexing : indexing run start' + core._id);
	indexer.run({
		name: core._id, // core 이름(테이블명)
		isEach: isEach // 각개 색인 여부 (2017.08.09, KCW)
	}, function (done) {
		return logger.log('info', "indexing : indexing run success\n" + done);
	});

	return res.json({
		result: 'success'
	});
}

function update(req, res) {
	var core = req.body.core;
	//console.log(core);
	res.send("");
	return dbcopy.update(core, 0, 0);
}

// 색인된 ldb 삭제
function destroy(req, res) {
	var name = req.body.name;
	var done = function done() {
		return mongodb.open('batch', 'coredb').then(function (coredb) {
			// core의 내용 가져와서 업데이트
			return coredb.findOne({ _id: name }, function (err, doc) {
				if (err) {
					return logger.log('error', 'destroy : update information from core fail\n' + err.message);
				}

				doc.index["doneCnt"] = 0; // 색인된 문서의 수
				doc.index["lastKey"] = '0'; // 마지막으로 색인된 key
				doc.index["total"] = 0;
				doc.recentUpdate = undefined;

				return coredb.save(doc, function (err) {
					if (err) {
						return logger.log('error', 'destroy : update information from core fail\n' + err.message);
					}

					logger.log('info', 'destroy : remove LDB success');
					return res.json({
						result: 'success'
					});
				});
			});
		}).catch(function (err) {
			logger.log('error', 'destroy : update information from core fail\n' + err.message);
			return res.json(err);
		});
	};

	// 색인된 ldb 삭제
	return mongodb.destroy('batch', name).then(function () {
		return mongodb.destroy('batch', name + '_posting');
	}).then(function () {
		return mongodb.destroy('batch', name + '_term');
	}).then(function () {
		return done();
	}).catch(function (err) {
		console.log(err);
		return done();
	});
}

/**
 * 인덱싱 되어있는지 채크하는 인터페이스
 * @param reqf
 * @param res
 * @returns {*}
 */
function indexingCheck(req, res) {
	var core = req.body.core;
	var key = req.body.key;
	return mongodb.open('batch', core._id).then(function (docdb) {

		return docdb.findOne({ _id: key }, function (err, doc) {
			if (err) {
				return res.json({ result: false, message: err.message });
			}

			if (doc == null || !doc.tf) return res.json({ result: false });

			return res.json({ result: true });
		});
	}).catch(function (err) {
		res.json({ result: false });
	});
}
//# sourceMappingURL=indexing.controller.js.map
