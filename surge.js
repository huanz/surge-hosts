var fs = require('fs');
var LineByLineReader = require('line-by-line');
var AV = require('leanengine');
var shell = require('./shell');
var ip = /^(\d{1,2}|1\d\d|2[0-4]\d|25[0-5])(\.(\d{1,2}|1\d\d|2[0-4]\d|25[0-5])){3}/;
var formatNow = function (fmt) {
    var now = new Date();
    var o = {
        'M+': now.getMonth() + 1, //月份 
        'd+': now.getDate(), //日 
        'h+': now.getHours(), //小时 
        'm+': now.getMinutes(), //分 
        's+': now.getSeconds(), //秒 
        'q+': Math.floor((now.getMonth() + 3) / 3), //季度 
        'S': now.getMilliseconds() //毫秒 
    };
    if (/(y+)/.test(fmt)) {
        fmt = fmt.replace(RegExp.$1, (now.getFullYear() + '').substr(4 - RegExp.$1.length));
    }
    for (var k in o) {
        if (new RegExp('(' + k + ')').test(fmt)) {
            fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (('00' + o[k]).substr(('' + o[k]).length)));
        }
    }
    return fmt;
};

exports.update = function (params, cb) {
    if ((Date.now() - params.time) < 60 * 60 * 1000) {
        return cb('更新频率过高');
    }
    var query = new AV.Query('Token');
    query.first().then(function(res) {
        var GHTOKEN = res.get('token');
        var cmds = [];
        try {
            var stat = fs.statSync('surge-hosts');
            if (stat.isDirectory()) {
                cmds = [
                    'cd hosts && git pull',
                    'cd surge-hosts && git pull',
                    'cd ipv6-hosts && git pull'
                ];
            } else {
                cmds = [
                    'rm -rf hosts surge-hosts ipv6-hosts',
                    'git clone --depth 1 --branch master --single-branch https://github.com/googlehosts/hosts.git',
                    'git clone --depth 1 --branch master --single-branch https://github.com/lennylxx/ipv6-hosts.git',
                    'git clone --depth 1 --branch master --single-branch ' + GHTOKEN
                ];
            }
        } catch (e) {
            cmds = [
                'git clone --depth 1 --branch master --single-branch https://github.com/googlehosts/hosts.git',
                'git clone --depth 1 --branch master --single-branch https://github.com/lennylxx/ipv6-hosts.git',
                'git clone --depth 1 --branch master --single-branch ' + GHTOKEN
            ];
        }
        
        shell.series(cmds, function (err) {
            if (err === null) {
                var hostsArr = [];
                var lr = new LineByLineReader('hosts/hosts-files/hosts');
                lr.on('line', function (line) {
                    line = line.trim();
                    if (line && !line.startsWith('#')) {
                        var tmp = line.split(/\s+/);
                        if (tmp[0] && tmp[1] && tmp[1] !== 'localhost' && tmp[1] !== 'broadcasthost') {
                            hostsArr.push(tmp[1] + ' = ' + tmp[0]);
                        }
                    }
                });
                lr.on('end', function () {
                    var final = fs.readFileSync('surge.conf').toString() + hostsArr.join('\n') + '\n';
                    var updateDate = formatNow('yyyy-MM-dd hh:mm:ss');
                    var surgeConf = '#!MANAGED-CONFIG http://surge.noonme.com/surge.conf interval=86400\n#UPDATE: ' + updateDate + '\n' + final;
                    fs.writeFileSync('surge-hosts/surge.conf', surgeConf);
                    shell.series([
                        'cp ipv6-hosts/hosts surge-hosts/ipv6_hosts',
                        'cp hosts/hosts-files/hosts surge-hosts',
                        'git config --global user.name "huanz"',
                        'git config --global user.email "yhz1219@gmail.com"',
                        'cd surge-hosts && git add -u',
                        'cd surge-hosts && git commit -m "hosts updated at ' + updateDate + '"',
                        'cd surge-hosts && git branch -m master',
                        'cd surge-hosts && git push -q ' + GHTOKEN + ' HEAD:master'
                    ], function (err) {
                        cb(err);
                        if (err) {
                            console.log('update surge hosts error: ' + err);
                            shell.exec('rm -rf surge-hosts');
                        }
                    });
                });
                lr.on('error', function (err) {
                    console.log('read hosts error: ' + err);
                    cb(err);
                });
            } else {
                console.log('executed apple dns error: ' + err);	
-                cb(err);
            }
        });
    });
};
