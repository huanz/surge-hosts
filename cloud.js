var fs = require('fs');
var execSync = require('child_process').execSync;
var LineByLineReader = require('line-by-line');
var AV = require('leanengine');
var shell = require('./shell');
var ip = /^(\d{1,2}|1\d\d|2[0-4]\d|25[0-5])(\.(\d{1,2}|1\d\d|2[0-4]\d|25[0-5])){3}/;
var confPrefix = [
    '[General]',
    'skip-proxy = 192.168.0.0/16, 10.0.0.0/8, 172.16.0.0/12, localhost, *.local',
    'bypass-tun = 192.168.0.0/16, 10.0.0.0/8, 172.16.0.0/12',
    'loglevel = notify',
    '',
    '[Rule]',
    'FINAL,DIRECT',
    '',
    '[Host]'
];

AV.Cloud.define('surge', function (req, res) {
    console.log(GHTOKEN);
    var time = req.params.time;
    if (Date.now() - time < 60 * 60 * 1000) {
        res.error('更新频率过高');
        return false;
    }
    var cmds = [];
    if (fs.statSync('AppleDNS').isDirectory()) {
        cmds = [
            'cd hosts && git pull',
            'cd surge-hosts && git pull',
            'cd AppleDNS && git pull'
        ];
    } else {
        cmds = [
            'git clone --depth 1 --branch master --single-branch https://github.com/racaljk/hosts.git',
            'git clone --depth 1 --branch master --single-branch https://github.com/huanz/surge-hosts.git',
            'git clone --depth 1 --branch master --single-branch https://github.com/gongjianhui/AppleDNS.git'
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
                if (!line.startsWith('#')) {
                    var tmp = line.split(/\s+/);
                    if (tmp[0] && tmp[1] && tmp[1] !== 'localhost' && tmp[1] !== 'broadcasthost') {
                        hostsArr.push(tmp[1] + ' = ' + tmp[0]);
                    }
                }
            });
            lr.on('end', function () {
                var all = confPrefix.concat(hostsArr);
                var ChinaUnicom = fs.readFileSync('AppleDNS/ChinaUnicom.conf').toString().replace(/#[ \S]+\n/g, '');
                var ChinaNet = fs.readFileSync('AppleDNS/ChinaNet.conf').toString().replace(/#[ \S]+\n/g, '');
                var CMCC = fs.readFileSync('AppleDNS/CMCC.conf').toString().replace(/#[ \S]+\n/g, '');
                var final = all.join('\n') + '\n';

                fs.writeFileSync('surge-hosts/ChinaUnicom.conf', final + ChinaUnicom);
                fs.writeFileSync('surge-hosts/ChinaNet.conf', final + ChinaNet);
                fs.writeFileSync('surge-hosts/CMCC.conf', final + CMCC);
                execSync('cp hosts/hosts surge-hosts');

                res.success();
            });
            lr.on('error', function (err) {
                console.log('executed apple dns error: ' + err);
                res.error();
            });
        } else {
            console.log('executed apple dns error: ' + err);
            res.error();
        }
    });
});

module.exports = AV.Cloud;