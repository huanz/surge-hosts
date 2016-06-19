var fs = require('fs');
var LineByLineReader = require('line-by-line');
var AV = require('leanengine');
var shell = require('./shell');
var ip = /^(\d{1,2}|1\d\d|2[0-4]\d|25[0-5])(\.(\d{1,2}|1\d\d|2[0-4]\d|25[0-5])){3}/;

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
                    'cd AppleDNS && git pull'
                ];
            } else {
                cmds = [
                    'rm -rf hosts surge-hosts AppleDNS',
                    'git clone --depth 1 --branch master --single-branch https://github.com/racaljk/hosts.git',
                    'git clone --depth 1 --branch master --single-branch https://github.com/gongjianhui/AppleDNS.git',
                    'git clone --depth 1 --branch master --single-branch ' + GHTOKEN
                ];
            }
        } catch (e) {
            cmds = [
                'git clone --depth 1 --branch master --single-branch https://github.com/racaljk/hosts.git',
                'git clone --depth 1 --branch master --single-branch https://github.com/gongjianhui/AppleDNS.git',
                'git clone --depth 1 --branch master --single-branch ' + GHTOKEN
            ];
        }
        shell.series(cmds.concat([
            'python AppleDNS/fetch-timeout.py AppleDNS/ChinaUnicom.json',
            'python AppleDNS/export-configure.py surge > AppleDNS/ChinaUnicom.conf',
            'python AppleDNS/fetch-timeout.py AppleDNS/ChinaNet.json',
            'python AppleDNS/export-configure.py surge > AppleDNS/ChinaNet.conf',
            'python AppleDNS/fetch-timeout.py AppleDNS/CMCC.json',
            'python AppleDNS/export-configure.py surge > AppleDNS/CMCC.conf'
        ]), function (err) {
            if (err === null) {
                var hostsArr = [];
                var lr = new LineByLineReader('hosts/hosts');
                lr.on('line', function (line) {
                    line = line.trim();
                    if (line && !line.startsWith('#')) {
                        var tmp = line.split(/\s+/);
                        if (tmp[0] && tmp[1] && tmp[1] !== 'localhost' && tmp[1] !== 'broadcasthost' && tmp[1] !== 'm.youtube.com') {
                            hostsArr.push(tmp[1] + ' = ' + tmp[0]);
                        }
                    }
                });
                lr.on('end', function () {
                    var ChinaUnicom = fs.readFileSync('AppleDNS/ChinaUnicom.conf').toString().replace(/#[ \S]+\n/g, '');
                    var ChinaNet = fs.readFileSync('AppleDNS/ChinaNet.conf').toString().replace(/#[ \S]+\n/g, '');
                    var CMCC = fs.readFileSync('AppleDNS/CMCC.conf').toString().replace(/#[ \S]+\n/g, '');
                    var final = fs.readFileSync('surge.conf').toString() + hostsArr.join('\n') + '\n';

                    fs.writeFileSync('surge-hosts/ChinaUnicom.conf', final + ChinaUnicom);
                    fs.writeFileSync('surge-hosts/ChinaNet.conf', final + ChinaNet);
                    fs.writeFileSync('surge-hosts/CMCC.conf', final + CMCC);
                    shell.series([
                        'cp hosts/hosts surge-hosts',
                        'git config --global user.name "huanz"',
                        'git config --global user.email "yhz1219@gmail.com"',
                        'cd surge-hosts && git add -u',
                        'cd surge-hosts && git commit -m "hosts updated at $(date -u +\'%Y-%m-%d %H:%M:%S\')"',
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
                cb(err);
            }
        });
    });
};