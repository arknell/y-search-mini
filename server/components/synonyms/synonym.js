/**
 * Created by KCW on 2017-06-05.
 * 사용 db
 *   - word : 유사어 목록 (관리용)
 *   - word_net : 유사어 네트워크 구성
 * @author ChanWoo Kwon
 */

"use strict";

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.save = save;
exports.getAllWord = getAllWord;
exports.remove = remove;
exports.search = search;
exports.getWord = getWord;
var ldb = require('../commons/mongo');
var logger = require('../../components/loggers/logger');
var _ = require('lodash');

/**
 * 웹에서 설정한 유사어를 db에 저장
 * 2017.06.05
 * ChanWoo Kwon
 * @param words
 */
function save(words) {
	return ldb.open('synonym', 'word').then(function (wordDb) {
		var _loop = function _loop(i) {
			var word = words[i];

			if (word.word === '' || word.synonyms === '') {
				//do nothing when key or value is empty
				return 'continue';
			}

			//callback function
			var done = _.after(word.length, function () {
				return logger.log('info', 'save synonyms ' + word.toString() + ' is success');
			});

			//유효성 검사 구현 (2017.06.07)
			//synonym 수정 시 갱신
			wordDb.findOne({ _id: word.word }, function (err, res) {
				if (err) {
					return logger.log('error', 'find synonyms is fail');
				}

				var value = word.synonyms;
				var wordList = [];
				wordList.push(word.word);

				var synonymsList = value.split(';');

				if (res !== undefined && res != null) {
					for (var _i = 0; _i < synonymsList.length; _i++) {
						res.synonyms = res.synonyms.replace(synonymsList[_i], '');
					}

					var spliter = res.synonyms.split(';');

					for (var _i2 = 0; _i2 < spliter.length; _i2++) {
						if (spliter[_i2] !== '') {
							removeNet(spliter[_i2]);
						}
					}
				}

				word._id = word.word;

				return wordDb.save(word, function (err) {
					if (err) {
						return logger.log('error', 'Create : create core database fail\n' + err.message);
					}

					for (var _i3 = 0; _i3 < synonymsList.length; _i3++) {
						var synonymItem = synonymsList[_i3];
						if (synonymItem.trim() === '') continue;

						wordList.push(synonymItem.trim());
					}

					return saveNet(wordList, word.word, done);
				});
			});
		};

		for (var i = 0; i < words.length; i++) {
			var _ret = _loop(i);

			if (_ret === 'continue') continue;
		}
	}).catch(function (err) {
		return logger.log('error', err.message);
	});
}

/**
 * 웹에서 설정한 유사어 목록을 read
 * @param res
 */
function getAllWord(res) {
	return ldb.open('synonym', 'word').then(function (wordDB) {

		wordDB.find().toArray(function (err, result) {
			if (result == null) return res.json([]);

			return res.json(result);
		});
	}).catch(function (err) {
		return logger.log('error', err.message);
	});
}

/**
 * 유사어 목록에서 제거
 * @param word
 */
function remove(word) {
	return ldb.open('synonym', 'word').then(function (wordDB) {
		return wordDB.findOne({ _id: word }, function (err, res) {
			if (err) {
				return logger.log('error', 'delete ' + word + "' is fail");
			}

			wordDB.deleteOne({ _id: word }, function (err) {
				if (err) {
					return logger.log('error', 'delete ' + word + "' is fail");
				}

				removeNet(word);
			});

			var synonymsList = res.synonyms.split(';');

			for (var i = 0; i < synonymsList.length; i++) {
				var synonymItem = synonymsList[i];
				if (synonymItem.trim() === '') continue;

				removeNet(synonymItem.trim());
			}
		});
	}).catch(function (err) {
		return logger.log('error', err.message);
	});
}

function search(word, callback) {
	return ldb.open('synonym', 'word_net').then(function (wordNetDB) {
		return wordNetDB.findOne({ _id: word }, function (err, res) {
			if (err) {
				if (err.notFound) {
					return callback('');
				}

				return logger.log('error', 'read word_net Fail' + err);
			}

			ldb.open('synonym', 'word').then(function (wordDB) {
				return wordDB.findOne({ _id: res.manager }, function (err, res) {
					if (err) {
						return logger.log('error', 'read word Fail' + err);
					}

					if (res == null) {
						return callback('');
					}

					return callback([res]);
				});
			}).catch(function (err) {
				return logger.log('error', err.message);
			});
		});
	}).catch(function (err) {
		return logger.log('error', err.message);
	});
}

function getWord(word, callback) {
	return ldb.open('synonym', 'word_net').then(function (wordNetDB) {
		return wordNetDB.findOne({ _id: word }, function (err, res) {
			if (err) {
				return logger.log('error', 'read word_net fail');
			}

			//word가 유사어 네트워크에 존재하지 않을 경우 빈 문자 반환
			if (res == null) return callback('');

			return callback(res.synonyms);
		});
	}).catch(function (err) {
		return logger.log('error', err.message);
	});
}

/**
 * word_net
 * 유사어 검색 기능 때문에 추가 (2017.06.12)
 *  key : 단어
 *  value {
 *      synonyms : 유사어목록 (;로 구분)
 *      manager  : word db에 저장될 때의 관리 단어
 *  }
 * @param wordList
 * @param mainWord
 * @param callback
 */
var saveNet = function saveNet(wordList, mainWord, callback) {
	return ldb.open('synonym', 'word_net').then(function (wordNetDb) {

		var done = _.after(wordList.length, function () {
			return callback();
		});

		var _loop2 = function _loop2(i) {
			var value = '';
			var key = wordList[i];
			for (var j = 0; j < wordList.length; j++) {
				if (i != j) value += wordList[j] + ';';
			}

			//manager 단어와 key, value 저장
			wordNetDb.save({
				_id: key,
				synonyms: value.trim(),
				manager: mainWord
			}, function (err) {
				if (err) return logger.log('error', 'save \'' + key + ':' + value + '\' is fail');

				return done();
			});
		};

		for (var i = 0; i < wordList.length; i++) {
			_loop2(i);
		}
	}).catch(function (err) {
		return logger.log('error', err.message);
	});
};

var removeNet = function removeNet(word) {
	return ldb.open('synonym', 'word_net').then(function (wordNetDB) {
		return wordNetDB.deleteOne({ _id: word });
	}).catch(function (err) {
		return logger.log('error', err.message);
	});
};
//# sourceMappingURL=synonym.js.map
