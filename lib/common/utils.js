var $ = require('preconditions').singleton();
var _ = require('lodash');
var BigNumber = require('bignumber.js');

//var bitcorex = require('bitcore-lib');
//var cryptox = bitcore.crypto;
//var encodingx = bitcore.encoding;
var secp256k1 = require('secp256k1');

var Utils = {};
//var Bitcorex = require('bitcore-lib');
var Bitcore_ = {
  //btc: Bitcorex,
  //bch: require('bitcore-lib-cash'),
  proc: require('proccore-lib'),
};



Utils.getMissingFields = function(obj, args) {
  args = [].concat(args);
  if (!_.isObject(obj)) return args;
  var missing = _.filter(args, function(arg) {
    return !obj.hasOwnProperty(arg);
  });
  return missing;
};

/* TODO: It would be nice to be compatible with bitcoind signmessage. How
 * the hash is calculated there? */
Utils.hashMessage = function(text, noReverse,coin) {
  $.checkArgument(text);
  var buf = new Buffer(text);
  var ret = Bitcore_[coin].crypto.Hash.sha256sha256(buf);
  if (!noReverse) {
    ret = new bitcore.encoding.BufferReader(ret).readReverse();
  }
  return ret;
};

Utils.verifyMessage = function(text, signature, publicKey, coin) {
  $.checkArgument(text);

  var hash = Utils.hashMessage(text, true, coin);

  var sig = this._tryImportSignature(signature);
  if (!sig) {
    return false;
  }

  var publicKeyBuffer = this._tryImportPublicKey(publicKey);
  if (!publicKeyBuffer) {
    return false;
  }

  return this._tryVerifyMessage(hash, sig, publicKeyBuffer);
};

Utils._tryImportPublicKey = function(publicKey) {
  var publicKeyBuffer = publicKey;
  try {
    if (!Buffer.isBuffer(publicKey)) {
      publicKeyBuffer = new Buffer(publicKey, 'hex');
    }
    return publicKeyBuffer;
  } catch (e) {
    return false;
  }
};

Utils._tryImportSignature = function(signature) {
  try {
    var signatureBuffer = signature;
    if (!Buffer.isBuffer(signature)) {
      signatureBuffer = new Buffer(signature, 'hex');
    }
    return secp256k1.signatureImport(signatureBuffer);
  } catch (e) {
    return false;
  }
};

Utils._tryVerifyMessage = function(hash, sig, publicKeyBuffer) {
  try {
    return secp256k1.verify(hash, sig, publicKeyBuffer);
  } catch (e) {
    return false;
  }
};

var log = require('npmlog');

Utils.formatAmount = function(satoshis, unit, opts) {
  var UNITS = {
    btc: {
      toSatoshis: '100000000',
      maxDecimals: 6,
      minDecimals: 2,
    },
    bit: {
      toSatoshis: '100',
      maxDecimals: 0,
      minDecimals: 0,
    },
    sat: {
      toSatoshis: '1',
      maxDecimals: 0,
      minDecimals: 0,
    },
    bch: {
      toSatoshis: '100000000',
      maxDecimals: 6,
      minDecimals: 2,
    },
  };

  //$.shouldBeNumber(satoshis);
  $.checkArgument(_.contains(_.keys(UNITS), unit));

  function addSeparators(nStr, thousands, decimal, minDecimals) {
    nStr = nStr.replace('.', decimal);
    var x = nStr.split(decimal);
    var x0 = x[0];
    var x1 = x[1];

    x1 = _.dropRightWhile(x1, function(n, i) {
      return n == '0' && i >= minDecimals;
    }).join('');
    var x2 = x.length > 1 ? decimal + x1 : '';

    x0 = x0.replace(/\B(?=(\d{3})+(?!\d))/g, thousands);
    return x0 + x2;
  }

  opts = opts || {};

  var u = _.assign(UNITS[unit], opts);
  var amount = (satoshis.div(u.toSatoshis)).toFixed(u.maxDecimals);
  return addSeparators(amount, opts.thousandsSeparator || ',', opts.decimalSeparator || '.', u.minDecimals);
};

Utils.formatAmountInBtc = function(amount) {
  return Utils.formatAmount(amount, 'btc', {
    minDecimals: 8,
    maxDecimals: 8,
  }) + 'btc';
};

Utils.formatUtxos = function(utxos) {
  if (_.isEmpty(utxos)) return 'none';
  return _.map([].concat(utxos), function(i) {
    var amount = Utils.formatAmountInBtc(i.satoshis);
    var confirmations = i.confirmations ? i.confirmations + 'c' : 'u';
    return amount + '/' + confirmations;
  }).join(', ');
};

Utils.formatRatio = function(ratio) {
  return (ratio.times('100')).toFixed(4) + '%';
};

Utils.formatSize = function(size) {
  return (size.div('1000')).toFixed(4) + 'kB';
};

Utils.parseVersion = function(version) {
  var v = {};

  if (!version) return null;

  var x = version.split('-');
  if (x.length != 2) {
    v.agent = version;
    return v;
  }
  v.agent = _.contains(['bwc', 'bws'], x[0]) ? 'bwc' : x[0];
  x = x[1].split('.');
  v.major = parseInt(x[0]);
  v.minor = parseInt(x[1]);
  v.patch = parseInt(x[2]);

  return v;
};

Utils.checkValueInCollection = function(value, collection) {
  if (!value || !_.isString(value)) return false;
  return _.contains(_.values(collection), value);
};


Utils.getAddressCoin = function(address) {
  try {
    new Bitcore_['btc'].Address(address);
    return 'btc';
  } catch (e) {
    try {
      new Bitcore_['bch'].Address(address);
      return 'bch';
    } catch (e) {
      return;
    }
  }
};

Utils.translateAddress = function(address, coin) {
  var origCoin = Utils.getAddressCoin(address);
  var origAddress = new Bitcore_[origCoin].Address(address);
  var origObj = origAddress.toObject();

  var result = Bitcore_[coin].Address.fromObject(origObj)
  return result.toString();
};

function byString(o, s) {
    s = s.replace(/\[(\w+)\]/g, '.$1'); // convert indexes to properties
    s = s.replace(/^\./, '');           // strip a leading dot
    var a = s.split('.');
    for (var i = 0, n = a.length; i < n; ++i) {
        var k = a[i];
        if (k in o) {
            o = o[k];
        } else {
            return;
        }
    }
    return o;
}

Utils.sum = function(array, member){
    var ret = new BigNumber(0);
    for (var i = 0; i < array.length; i++)
        ret = ret.plus(byString(array[i], member));
    return ret;
}

Utils.estimateFee = function(estimatedSize, feePerKb) {
  return new BigNumber('1').plus(Math.floor(estimatedSize / 1000)).times(feePerKb);
};

module.exports = Utils;
