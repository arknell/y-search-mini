/**
 * RDB의 내용을 ldb로 복사
 */
"use strict";

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.run = run;
exports.add = add;
exports.update = update;
exports.index = index;
exports.indexInfo = indexInfo;
exports.create = create;
exports.getColumns = getColumns;
exports.getIndexInfo = getIndexInfo;
exports.remove = remove;
exports.init = init;
var rdb = require('../../components/commons/rdb');

var mongodb = require('../commons/mongo');
var util = require('../commons/utils');
var _ = require('lodash');

var logger = require('../../components/loggers/logger');

/**
 * RDB 내용을 복사
 * @param {Object} opts
 * {
 *      ipp : number, // 한번에 가져올 갯수 (성능에 영향)
 *      total : number, // 전체 타겟 수
 *      iter : number, // 시작점
 *      name : string,
 *      pk : string,
 *      sql : string,
 *      config : {Object}
 * }
 * @param cb        // callback
 */
function run(opts, cb) {

	//name, uniqueKey, sql, config(mssql)
	if (!validate(opts, cb)) {
		return;
	}

	opts.ipp = opts.ipp || 10000; // 1만
	opts.total = opts.total || 1000000; // 100만
	opts.iter = opts.iter || 0;
	opts.order = opts.order ? opts.order.name : 1;
	opts.recentUpdate = opts.order != 1 ? opts.recentUpdate || '0' : '1';

	console.log('try to open collection..');
	return mongodb.open('batch', opts._id).then(function (collection) {
		console.log('collection is open');
		return async(collection, opts, function () {
			// mssql.close();
			/*console.log(timeArr);
    console.log((new Date() - stime) + 'ms');*/
			return cb(null, 'copy success');
		});
	}).catch(function (err) {
		console.log(err);
		return cb(err);
	});
}

/**
 * 증분 색인
 * @param opts  // mongodb collection core의 내용
 * @param cb    // callback
 */
function add(opts, cb) {
	if (opts.keys.length < 1) {
		util.errorHandler('opts.keys array is empty.', cb);
		return;
	}
	var ops = [];
	//console.log(sql);
	return rdb.getItem({ dbo: opts.dbo, keys: opts.keys, apiurl: opts.apiurl, name: opts._id.split('_')[1] }).then(function (res) {
		//	console.log(opts.index.pk);
		var parentKey = opts.index.columns.find(function (o) {
			return o.type == 'parent';
		});
		var pk = opts.index.columns.find(function (o) {
			return o.type == 'unique';
		});
		for (var i = 0; i < res.length; i++) {
			var key = parentKey ? res[i][parentKey.name] + res[i][pk.name] : res[i][pk.name.toUpperCase()] || res[i][pk.name.toLowerCase()];
			var obj = { _id: key };
			obj = util.mergeSumObj(obj, res[i]);
			ops.push(obj);
		}
		return mongodb.open('batch', opts._id);
	}).then(function (collection) {
		//	console.log(ops);
		return collection.insert(ops, function (err) {
			if (err) {
				if (err.code == 11000) {
					//duplicate key error
					return duplicateHandler(collection, ops, cb);
				} else throw err;
			}

			return cb(ops);
		});
	}).catch(function (err) {
		return util.errorHandler(err.message, cb);
	});
}

function duplicateHandler(collection, ops, cb) {
	console.log('run duplication handler');
	var done = _.after(ops.length, function () {
		return cb(ops);
	});

	for (var i = 0; i < ops.length; i++) {
		collection.save(ops[i], function (err) {
			if (err) {

				done();
				return console.log(err);
			}

			return done();
		});
	}
}

/**
 * run 함수 용 - validate opts 파라메터
 * @param opts
 * @param cb
 * @returns {boolean}
 */
function validate(opts, cb) {
	if (!_.isObject(opts)) {
		util.errorHandler('opts is not a object.', cb);
		return false;
	}

	if (!opts.name) {
		util.errorHandler('opts.name is undefined.', cb);
		return false;
	}

	if (!opts.pk) {
		util.errorHandler('opts.pk is undefined.', cb);
		return false;
	}

	if (!opts.config) {
		util.errorHandler('opts.config is undefined.', cb);
		return false;
	}

	return true;
}

/**
 * 반복적으로 RDB의 내용을 불러옴
 * 비동기 처리를 위함
 * @param db            // 복사할 mongodb collection (target)
 * @param opts          // run 함수의 opts
 * @param callback
 */
function async(db, opts, callback) {

	console.log(opts.iter, opts.total);

	if (opts.iter >= opts.total) {
		callback();
		return;
	}

	opts.firstIndex = opts.iter + 1;
	opts.lastIndex = opts.iter + opts.ipp;

	// rdb에서 데이터 가져오기
	return rdb.getBatch(opts).then(function (res) {
		var ops = [];
		for (var i = 0; i < res.length; i++) {
			// level db query 생성 --> levelup API 참조
			var key = opts.parentkey && res[i][opts.parentkey] ? res[i][opts.parentkey] + res[i][opts.pk] : res[i][opts.pk];
			//console.log('index key', key);
			var obj = { _id: key };
			obj = util.mergeSumObj(obj, res[i]);
			ops.push(obj);
		}

		if (res.length == 0) return callback();

		return db.insert(ops, function (err) {
			var mustHandler = false;
			if (err) {
				if (err.code == 11000) {
					mustHandler = true;
				} else {
					return console.log(err);
				}
			}

			var done = function done() {
				if (res.length < opts.ipp) {
					console.log('indexed ' + (opts.iter + res.length));
					console.log('end of documents');
				} else {
					opts.iter = opts.iter + opts.ipp;
					console.log('indexed ' + opts.iter);
					console.log(new Date());

					return async(db, opts, callback); // 재귀 반복 호출
				}
			};

			if (mustHandler) return duplicateHandler(db, ops, done);else return done();
		});
	});
}

/**
 * 인덱싱이 필요하지 않는 컬럼이 추가되었을 경우 인덱싱을 다시 하지 않고 컬럼만 추가하는 API
 * 차후 추가된 컬럼 인덱싱 기능 구현해야함 (2017.07.20)
 * @author ChanWoo Kwon 2017.07.18
 * @param core core db 정보
 * @param lastkey 마지막 indexing key
 * @param curr 현재 indexing 수
 */
function update(core, lastkey, curr) {
	var dataList = [];
	return mongodb.open('batch', core._id).then(function (collection) {
		var updateValue = function updateValue(res) {
			var bulk = collection.initializeUnorderedBulkOp();
			for (var i = 0; i < res.length; i++) {
				bulk.find({ _id: res[i].quizcode }).update({ $set: res[i] });
			}

			bulk.execute().then(function () {
				console.log(curr, " is done");

				if (curr < core.index.originalCount) return update(core, lastkey, curr);
			}).catch(function (err) {
				return console.log(err);
			});
		};

		return collection.find({ _id: { $gt: lastkey + "" } }).sort({ _id: 1 }).limit(10000).toArray(function (err, result) {
			if (err) return console.log(err);

			for (var i = 0; i < result.length; i++) {
				dataList.push(result[i]._id);
			}

			curr += dataList.length;
			lastkey = dataList[dataList.length - 1];

			return rdb.getItem({ name: core._id.split('_')[1], keys: dataList, apiurl: core.apiurl }).then(function (res) {
				return updateValue(res);
			}).catch(function (err) {
				console.log(err);
			});
		});
	}).catch(function (err) {
		return console.log(err);
	});
}

/**
 * @param dataList
 * @param dbConfig
 * @param callback
 * @returns {*}
 */
function updateColumn(dataList, dbConfig, callback) {
	var sql = dbConfig.sql;

	//이미 where문이 있을 경우
	if (/\s+where/.test(sql) == true) sql += " and ";else sql += " where ";
	sql += " quizcode in (";
	for (var i = 0; i < dataList.length; i++) {

		sql += "'" + dataList[i] + "'";

		if (i != dataList.length - 1) sql += ",";
	}

	sql += ")";

	return rdb[dbConfig.type].queryWithConn(sql, undefined, dbConfig, function (res, count) {
		return callback(res);
	});
}

/**
 * 전체 목록가져오기, db 이름 순으로 가져옴
 * @param req   // 요청 객체 (req.body : 요청 파라메터)  이하 동일 (모든 controller에서 사용)
 * @param res   // 응답 객체                           이하 동일 (모든 controller에서 사용)
 */
function index(req, res) {
	var temp = [];
	mongodb.open('core', 'coredb').then(function (coredb) {
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
	return mongodb.open('core', 'coredb').then(function (coredb) {
		return coredb.deleteOne({ _id: req.params.key }, function (err) {
			if (err) {
				logger.log('error', 'Remove Core : remove ' + req.params.key + ' from coredb fail\n' + err.message);
				throw err;
			}

			logger.log('info', 'Remove Core : removed ' + req.params.key + ' from coredb success');
			return res.json({ result: 'success' });
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
//# sourceMappingURL=dbcopy.js.map
