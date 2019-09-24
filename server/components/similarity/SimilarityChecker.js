'use strict';

var _keys = require('babel-runtime/core-js/object/keys');

var _keys2 = _interopRequireDefault(_keys);

var _promise = require('babel-runtime/core-js/promise');

var _promise2 = _interopRequireDefault(_promise);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * 문항 세트의 서로 유사도를 검사하는 모듈
 * @author ChanWoo Kwon
 * date : 2018-05-08
 */

var reader = require('../indexers/reader');
var util = require('../commons/utils');
var mongodb = require('../commons/mongo');
var ne = require('../commons/ne');

var SimilarityChecker = function () {
	function SimilarityChecker() {
		(0, _classCallCheck3.default)(this, SimilarityChecker);
	}

	(0, _createClass3.default)(SimilarityChecker, [{
		key: 'readContentFromCode',
		value: function readContentFromCode(apiurl, name, list, limitRatio) {
			var _this = this;

			var collection = undefined;
			return new _promise2.default(function (resolve, reject) {
				return mongodb.open('similarityChecker', name, false).then(function (db) {
					collection = db;
					return mongodb.open('similarityChecker', 'coredb', false);
				}).then(function (core) {

					var orOperation = [];
					for (var i in list) {
						var quiz = list[i];

						orOperation.push({ _id: quiz });
					}

					return collection.find({ $or: orOperation }).toArray(function (err, res) {
						if (err) return reject(err);

						var tfList = {};

						var done = function done() {
							return _this.calSimilarity(tfList, limitRatio).then(function (res) {
								return resolve(res);
							});
						};

						var i = 0;
						var getContentTf = function getContentTf() {
							var info = res[i++];
							if (!info) {
								return done();
							}

							if (info.QUIZBODY || info.quizbody) {
								// quiz body is content
								return ne(apiurl, info.QUIZBODY || info.quizbody).then(function (wordList) {
									tfList[info._id] = util.tf(wordList, 'all');
									return getContentTf();
								}).catch(function (err) {
									reject(err);
								});
							} else {
								// quiz path is content
								return core.findOne({ _id: name }, function (err, doc) {
									if (err || !doc) return reject(err || { message: 'doc is null, ' + name });

									return reader.getQuizDoc(doc, info.key, true, false, function (err, doc, body, docdb, parentKey) {
										return ne(apiurl, body || '').then(function (keyword) {

											tfList[info._id] = util.tf(keyword, 'all');
											return getContentTf();
										}).catch(function (err) {
											return reject(err);
										});
									});
								});
							}
						};

						return getContentTf();
					});
				});
			});
		}
	}, {
		key: 'calSimilarityWithoutTF',
		value: function calSimilarityWithoutTF(wordList, wordList2) {
			var bagOfWord = {};
			var makeVector = function makeVector(list) {
				var vector = new Array((0, _keys2.default)(bagOfWord).length).fill(0);
				for (var i = 0; i < list.length; i++) {
					var word = list[i];
					vector[bagOfWord[word]] = 1;
				}

				return vector;
			};
			var total = wordList.concat(wordList2);
			for (var i = 0; i < total.length; i++) {
				// -- make bagOfWord
				var word = total[i];
				var code = (0, _keys2.default)(bagOfWord).length;
				if (bagOfWord.hasOwnProperty(word) == false) bagOfWord[word] = code;
			}

			var vector1 = makeVector(wordList);
			var vector2 = makeVector(wordList2);

			return util.similarity(vector1, vector2);
		}
	}, {
		key: 'calSimilarity',
		value: function calSimilarity(tfList, limitRatio) {
			return new _promise2.default(function (resolve, reject) {
				var bagOfWord = {};
				for (var key in tfList) {
					// -- make bagOfWord
					for (var word in tfList[key]) {
						var code = (0, _keys2.default)(bagOfWord).length;
						if (bagOfWord.hasOwnProperty(word) == false && word.indexOf(':') == -1) bagOfWord[word] = code;
					}
				}

				var vectorList = {};

				for (var _key in tfList) {
					// -- make vector
					var vector = new Array((0, _keys2.default)(bagOfWord).length).fill(0);
					for (var _word in tfList[_key]) {
						vector[bagOfWord[_word]] = tfList[_key][_word].freq;
					}

					vectorList[_key] = vector;
				}
				//console.log(vectorList, bagOfWord);
				var newRank = {};

				for (var _key2 in vectorList) {
					// -- cal similarity O(n * log n)

					var quiz = vectorList[_key2];

					delete vectorList[_key2];

					var rank = util.rankingWithoutZeroKey(quiz, vectorList);
					for (var i in rank) {
						var rankOne = rank[i];
						if (parseFloat(rankOne.sim) >= limitRatio[1] / 100 && parseFloat(rankOne.sim) <= limitRatio[0] / 100) {

							if (newRank.hasOwnProperty(_key2)) {
								newRank[_key2].destination.push({ key: rankOne.key, sim: rankOne.sim });
							} else {
								newRank[_key2] = { destination: [{ key: rankOne.key, sim: rankOne.sim }] };
							}
						}
					}
				}

				var result = [];
				for (var _key3 in newRank) {
					newRank[_key3].destination.sort(function (o1, o2) {
						return o2.sim - o1.sim;
					});

					result.push({
						source: _key3,
						destination: newRank[_key3].destination
					});
				}

				return resolve(result);
			});
		}

		// -- 나중에 사용

	}, {
		key: 'getSimilarityContent',
		value: function getSimilarityContent(apiurl, list, ratio) {
			var _this2 = this;

			return new _promise2.default(function (resolve, reject) {
				var tfList = {};
				var done = function done() {
					return _this2.calSimilarity(tfList, ratio).then(function (res) {
						return resolve(res);
					});
				};
				var i = 0;
				var getTd = function getTd() {
					var quiz = list[i++];

					if (!quiz) return done();

					ne(apiurl, quiz.content, false).then(function (content) {
						tfList[quiz.key] = util.tf(content);

						return getTd();
					}).catch(function (err) {
						return reject(err);
					});
				};

				return getTd();
			});
		}
	}]);
	return SimilarityChecker;
}();

module.exports = SimilarityChecker;
//# sourceMappingURL=SimilarityChecker.js.map
