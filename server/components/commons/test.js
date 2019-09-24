/**
 * 테스트 실행 코드
 * 비동기 색인 실행을 추적하기 위해 작성됨
 */
"use strict";

var stime = new Date();
var mssql = require('./mssql');

var ldb = require('./ldb');

var total = 200000 //1273788
,
    ipp = 4000;

var ttime = stime;
var timeArr = [];

var sql = 'declare @rn int \n' + ' set @rn = 0 \n' + ' SELECT * ' + ' FROM ( ' + '     SELECT row_number() over(order by @rn) rownum, ' + ' 	    quizcode, cmsid, inputuser, cdate, ctime, uuser, udate, utime, ' + '       title, quizpath, iostype, ioskind, jobstatus, pcode, groupno, hard2, ' + '       class1, class2, class3, class4, class5, class6, class7, class8, class9, class10, class11, class12, classa, ' + '       keyword, savetypef, supervisestatus, schcd, webox, cspcd ' + ' FROM tbl_quiz_quiz ' + ' ) paging ' + ' where rownum between @firstIndex and @lastIndex ';

var quizldb = ldb.open('quizdoc');

//quizldb.del();

function async(iter, callback) {
    if (iter >= total) {
        callback();return;
    }
    var param = [{ key: 'firstIndex', value: iter + 1, type: 'Int' }, { key: 'lastIndex', value: iter + ipp, type: 'Int' }];
    /*mssql.connect(function(){
        mssql.query(sql, param, function(res, cnt){
            var now = new Date();
            timeArr.push((now - ttime));
            console.log(cnt, i, (now-ttime));
            ttime = now;
            async( i + ipp, callback );
        });
    });*/
    mssql.queryWithConn(sql, param, function (res, cnt) {
        var now = new Date();
        timeArr.push(now - ttime);
        var ops = [];
        for (var i = 0; i < res.length; i++) {
            var obj = { type: 'put', key: res[i].quizcode, value: res[i] };
            ops.push(obj);
        }
        quizldb.batch(ops, function (err) {
            if (err) throw err;
            console.log(cnt, iter, now - ttime, new Date() - now);
            ttime = now;
            async(iter + ipp, callback);
        });
    });
}

async(0, function () {
    // mssql.close();
    quizldb.close();
    console.log(timeArr);
    console.log(new Date() - stime + 'ms');
});

//console.log(path.normalize(__dirname + '/../../dbs/name'));
//# sourceMappingURL=test.js.map
