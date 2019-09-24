'use strict';

var _keys = require('babel-runtime/core-js/object/keys');

var _keys2 = _interopRequireDefault(_keys);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * 검색 엔진이 갑자기 죽은 후 살아 날 때 인덱싱되지 못한 문항을 인덱싱 하기 위함
 * @author ChanWoo Kwon
 * date : 2018-04-16
 */

var rdb = require('../commons/rdb');

var logger = require('../loggers/logger');
var mongodb = require('../commons/mongo');

var adder = require('../indexers/adder');
var dbCopy = require('../indexers/dbcopy');
var util = require('../commons/utils');
var reader = require('../indexers/reader');
var indexer = require('../indexers/indexer');

var properties = require('../../config/environment');

var cron = require('node-cron');

var _ = require('lodash');

var RecoveryManager = function () {
	function RecoveryManager() {
		(0, _classCallCheck3.default)(this, RecoveryManager);
	}

	(0, _createClass3.default)(RecoveryManager, [{
		key: 'recovery',
		value: function recovery(done) {
			var _this = this;

			return mongodb.open('recovery', 'coredb', false).then(function (collection) {
				collection.find().toArray(function (err, res) {
					if (err) return;
					var index = 0;

					var cb = function cb() {
						var value = res[index];
						if (!value) return done();

						index++;

						// -- 단일 색인 중 프로그램이 종료된 경우
						if (value.nowIndexingOne) {
							console.log(value._id + ' need recovery');
							return _this.getNonIndexedData(value, cb);
						} else return cb();
					};

					return cb();
				});
			}).catch(function (err) {
				console.log(err);
				return done();
			});
		}

		/**
   * 초 단위로 날짜가 기록되기 때문에 마지막 기록 시간에 인덱싱 된 문항도 다시 색인한다.
   * 서버에서 동시간에 문항이 기록될 수도 있기 때문
   * @param info
   * @param cb
   * @returns {*}
   */

	}, {
		key: 'getNonIndexedData',
		value: function getNonIndexedData(info, cb) {
			var column = info.index.columns.find(function (o) {
				return o.type === 'order';
			});

			if (column == undefined || info.lastOrderKeyValue == undefined) return cb();

			return rdb.getRecoveryByOrderKey({
				apiurl: info.apiurl,
				dbo: info.dbo,
				name: info._id.split("_")[1],
				orderKey: column.name,
				lastOrderKeyValue: info.lastOrderKeyValue
			}).then(function (res) {
				logger.log('info', 'start indexing, ' + info._id);
				mongodb.open('recovery', info._id, false).then(function (db) {
					var afterCopy = function afterCopy(dataList) {
						var index = 0;
						var wordIndexingList = [];
						var wordIndexing = function wordIndexing() {
							var data = dataList[index++];

							if (!data) {
								return adder(wordIndexingList, { name: info._id }, function () {
									console.log(info._id, 'end word index');
									return cb();
								});
							}

							return reader.readDataOne(info.apiurl, data, db, info.index.columns, false, false, function (err, doc, body, docdb, paraParentKey, math) {
								if (err) {
									return cb(true);
								}

								return reader.doIndexing(info.apiurl, doc, body, docdb, wordIndexingList, math, function () {
									return wordIndexing();
								});
							});
						};

						return wordIndexing();
					};

					var ops = [];

					var pk = info.index.columns.find(function (o) {
						return o.type == "unique";
					});

					var parent = info.index.columns.find(function (o) {
						return o.type == "parent";
					});

					for (var i = 0; i < res.length; i++) {
						var key = parent && res[i][parent] ? res[i][parent] + res[i][pk] : res[i][pk];
						//console.log('index key', key);
						var obj = { _id: key };
						obj = util.mergeSumObj(obj, res[i]);
						ops.push(obj);
					}

					return db.insert(ops, function (err) {
						var mustHandler = false;
						if (err) {
							if (err.code == 11000) {
								// -- duplicate error
								mustHandler = true;
							} else {
								return console.log(err);
							}
						}

						if (mustHandler) return dbCopy.duplicateHandler(db, ops, afterCopy);else return afterCopy(ops);
					});
				});
			});
		}
	}, {
		key: 'scheduling',
		value: function scheduling() {
			var _this2 = this;

			cron.schedule(properties.scheduleTime, function () {
				logger.log('info', 'start indexing according to schedule..');

				return mongodb.open('recovery', 'coredb', false).then(function (collection) {
					collection.find().toArray(function (err, res) {
						if (err) return;
						var index = 0;

						var cb = function cb(canNext) {
							if (canNext) index++;

							var value = res[index];
							if (!value) return logger.log('info', 'schedule indexing is done');

							var kind = "";

							if (value._id.indexOf('quizdoc') != -1) {
								kind = "QUIZ";
							} else if (value._id.indexOf('conceptdoc') != -1) {
								kind = "CONC";
							} else if (value._id.indexOf('paperdoc') != -1) {
								kind = "TEST";
							} else if (value._id.indexOf('passagedoc') != -1) {
								kind = "PQUIZ";
							} else {
								return cb(true);
							}

							return _this2.doIndexing(value, kind, cb);
						};

						return cb(false);
					});
				}).catch(function (err) {
					console.log(err);
					return done();
				});
			});
		}
	}, {
		key: 'doIndexing',
		value: function doIndexing(info, kind, cb) {
			var indexing = [];
			var remove = [];
			var statusUpdate = [];

			if (!info.dbo) return cb(true);
			return rdb.getRecovery({ dbo: info.dbo, kind: kind, apiurl: info.apiurl }).then(function (res) {
				//	console.log(info.dbo, kind);
				if (res.length == 0) return cb(true);

				for (var i = 0; i < res.length; i++) {
					var doc = res[i];

					if (doc.EDITGB == 'IU') {
						// -- indexing
						indexing.push({ code: doc.CONTID, seq: doc.SRCHIDX_HISTORY_SEQ });
					} else {
						// -- removing
						remove.push({ code: doc.CONTID, seq: doc.SRCHIDX_HISTORY_SEQ });
					}
				}

				// -- 색인 실행
				var executeIndex = function executeIndex() {
					var indexingKeys = [];

					for (var _i = 0; _i < indexing.length; _i++) {
						indexingKeys.push(indexing[_i].code);
					}

					return rdb.getItem({ name: info.dbo, keys: indexingKeys, apiurl: info.apiurl }).then(function (res) {
						if (res.length == 0) return cb();

						logger.log('info', 'start indexing, ' + info._id + " " + indexing.length);
						return mongodb.open('recovery', info._id, false).then(function (db) {
							var afterCopy = function afterCopy(dataList) {
								var index = 0;
								var wordIndexingList = [];
								var wordIndexing = function wordIndexing() {
									var data = dataList[index++];

									if (!data) {
										return adder(wordIndexingList, { name: info._id }, function () {
											console.log(info._id, 'end word index');
											for (var _i2 = 0; _i2 < indexing.length; _i2++) {
												statusUpdate.push(indexing[_i2].seq);
											}

											return rdb.updateRecovery({ dbo: info.dbo, keys: statusUpdate, apiurl: info.apiurl }).then(function (res) {

												return cb(false);
											});
										});
									}

									return reader.readDataOne(info.apiurl, data, db, info.index.columns, false, false, function (err, doc, body, docdb, paraParentKey, math) {
										if (err) {
											return cb(true);
										}

										return reader.doIndexing(info.apiurl, doc, body, docdb, wordIndexingList, math, function () {
											return wordIndexing();
										});
									});
								};

								return wordIndexing();
							};

							var ops = [];

							var pk = info.index.columns.find(function (o) {
								return o.type == "unique";
							});

							var parent = info.index.columns.find(function (o) {
								return o.type == "parent";
							});

							for (var i = 0; i < res.length; i++) {
								var key = parent && res[i][parent] ? res[i][parent] + res[i][pk] : res[i][pk];
								//console.log('index key', key);
								var obj = { _id: key };
								obj = util.mergeSumObj(obj, res[i]);
								ops.push(obj);
							}

							return db.insert(ops, function (err) {
								var mustHandler = false;
								if (err) {
									if (err.code == 11000) {
										// -- duplicate error
										mustHandler = true;
									} else {
										return console.log(err);
									}
								}

								if (mustHandler) return dbCopy.duplicateHandler(db, ops, afterCopy);else return afterCopy(ops);
							});
						});
					});
				};

				// -- 삭제 실행
				var executeRemove = function executeRemove() {
					var removeQuery = [];
					var newRemove = [];
					newRemove = newRemove.concat(remove);
					newRemove = newRemove.concat(indexing);

					for (var _i3 = 0; _i3 < newRemove.length; _i3++) {
						removeQuery.push({ _id: newRemove[_i3].code });
					}

					mongodb.open('recovery', info._id, false).then(function (collection) {
						console.log('remove all', info._id, (0, _keys2.default)(newRemove).length);
						collection.find({ $or: removeQuery }).toArray(function (err, res) {
							if (err) {
								return console.log(err);
							}
							//console.log(info._id, removeQuery, res);
							var words = {};
							var key = [];

							for (var _i4 = 0; _i4 < res.length; _i4++) {
								var tf = res[_i4].tf;

								for (var word in tf) {
									if (words.hasOwnProperty(word)) {
										words[word].freq += tf[word].freq;
										words[word].ndocs++;
									} else {
										words[word] = {
											freq: tf[word].freq,
											ndocs: 1
										};
									}
								}

								key.push(res[_i4]._id);
							}

							indexer.removeAndUpdateRecovery(info._id, words, key, function (err) {
								if (err) {
									console.log(err);
								} else {
									// update status rdb

									for (var _i5 = 0; _i5 < remove.length; _i5++) {
										statusUpdate.push(remove[_i5].seq);
									}
								}

								return executeIndex();
							});
						});
					});
				};

				if (remove.length == 0 && indexing.length == 0) return cb(true);

				return executeRemove();
			});
		}
	}]);
	return RecoveryManager;
}();

module.exports = RecoveryManager;
//# sourceMappingURL=RecoveryManager.js.map
