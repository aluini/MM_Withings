/* Magic Mirror
 * Module: MM_Withings.js
 *
 * By Jonathan Loriette http://github.com/john7002
 * based on Netatmo module by Christopher Fenner http://github.com/CFenner
 * contrib by Alexandre LUINI http://github.com/aluini
 * MIT Licensed.
 */
Module.register('MM_Withings', {
  // default config
  defaults: {
    refreshToken: null,
    updateInterval: 2, // every 15 minutes,
    animationSpeed: 1000,
    hideLoadTimer: false,
    api: {
      base: 'https://wbsapi.withings.net/',
      baseV2: 'https://wbsapi.withings.net/v2/',
      measure_weight: 'measure?action=getmeas&',
      measure_activity: 'measure?action=getactivity&',
      measure_sleep: 'sleep?action=getsummary&',
      authPayload: 'oauth_consumer_key={0}&oauth_nonce={1}&oauth_signature={2}&', // authPayload: 'grant_type=refresh_token&refresh_token={0}&client_id={1}&client_secret={2}',
      authPayload2: 'oauth_signature_method=HMAC-SHA1&oauth_timestamp={0}&&oauth_token={1}&',
      authPayload3: 'oauth_version=1.0&userid={0}&',
      authPayload_weight: 'meastype=1&limit=1', // get only the last measure from the scale
      authPayload_fat: 'meastype=6&limit=1',
      authPayload_activity: 'date=',
      authPayload_sleep: 'lastupdate='
    }
  },
  // init method
  start: function () {
    this.α = 0
    // set interval for reload timer
    this.t = this.config.updateInterval * 60 * 1000 / 360
    this.weight = 0
    this.fat = 0
    this.steps = 0
    this.distance = 0
    this.lightsleep = 0
    this.deepsleep = 0

    this.updateLoad()
  },
  updateLoad: function () {
    Log.info(this.name + 'refresh triggered')
    var that = this

    return Q.fcall(
      this.load.get_URL.bind(that, 'weight'),
      this.renderError.bind(that)
    ).then(
        this.extractweight.bind(that), // weight
        this.renderError.bind(that)
    ).then(
      this.load.get_URL.bind(that, 'fat'),
      this.renderError.bind(that)
    ).then(
      this.extractfat.bind(that), // fat
      this.renderError.bind(that)
      )
    .then(
      this.load.get_URL.bind(that, 'activity'),
      this.renderError.bind(that)
    ).then(
        this.extractactivity.bind(that), // activity
        this.renderError.bind(that)
    ).then(
      this.load.get_URL.bind(that, 'sleep'),
      this.renderError.bind(that)
    ).then(
        this.extractsleep.bind(that),
        this.renderError.bind(that)
      )
    .done(
      this.updateWait.bind(that)
    )
  },
  updateWait: function () {
    this.α++
    this.α %= 360
    var r = (this.α * Math.PI / 180)
    var x = Math.sin(r) * 125
    var y = Math.cos(r) * -125
    var mid = (this.α > 180) ? 1 : 0
    var anim = 'M 0 0 v -125 A 125 125 1 ' +
       mid + ' 1 ' +
       x + ' ' +
       y + ' z'

    var loader = $('.MM_Withings__container .loadTimer .loader')
    if (loader.length > 0) {
      loader.attr('d', anim)
    }
    var border = $('.MM_Withings__container .loadTimer .border')
    if (border.length > 0) {
      border.attr('d', anim)
    }
    if (r === 0) {
      // refresh data
      this.updateLoad()
    } else {
      // wait further
      setTimeout(this.updateWait.bind(this), this.t)
    }
  },

  load: {
    get_URL: function (data_type) {
      switch (data_type) {
        case 'weight':
          base = this.config.api.base
          base2 = this.config.api.measure_weight
          end = this.config.api.authPayload_weight
          break
        case 'fat':
          base = this.config.api.base
          base2 = this.config.api.measure_weight
          end = this.config.api.authPayload_fat
          break
        case 'activity':
          var today = new Date()
          var dd = ('0' + String(today.getDate())).slice(-2)
          var mm = ('0' + String(today.getMonth() + 1)).slice(-2) // January is 0!
          var yyyy = String(today.getFullYear())
          var date_today = yyyy + '-' + mm + '-' + dd
          base = this.config.api.baseV2
          base2 = this.config.api.measure_activity
          end = this.config.api.authPayload_activity + date_today
          break
        case 'sleep':
          // 604800 is 1 week in epoch time. We gets the last sleep night and only display the last one. Date.now() return millisecond, withings api needs seconds.
          date_seven = Math.floor(Date.now() / 1e3) - 604800
          base = this.config.api.baseV2
          base2 = this.config.api.measure_sleep
          end = this.config.api.authPayload_sleep + date_seven
          break
        default:
          return ''
      }

      return Q($.ajax({
        type: 'POST',
        url: base + base2,
        data: this.config.api.authPayload.format(
              this.config.oauth_consumer_key,
              Array(32 + 1).join((Math.random().toString(36) + '00000000000000000').slice(2, 18)).slice(0, 32),
              this.config.oauth_signature) +
              this.config.api.authPayload2.format(
              Date.now(),
              this.config.oauth_token,
              this.config.oauth_signature) +
              this.config.api.authPayload3.format(
              this.config.clientID) + end
      }))
    }
  },
  extractweight: function (data) {
    var obj = JSON.parse(data)
    Log.info('status=' + obj.status)
    Log.info('time=' + obj.body.measuregrps[0].date)
    if (obj.body.measuregrps != null) {
      this.weight = (obj.body.measuregrps[0].measures[0].value * Math.pow(10, obj.body.measuregrps[0].measures[0].unit)).toFixed(3)
      this.dateweight = obj.body.measuregrps[0].date
      Log.info('weight=' + this.weight + '; date=' + this.dateweight)
    }
  },

  extractfat: function (data) {
    var obj = JSON.parse(data)
    if (obj.measuregrps != null) {
      Log.info('status=' + obj.status)
      Log.info('time=' + obj.body.measuregrps[0].date)
      this.fat = Number(obj.body.measuregrps[0].measures[0].value * Math.pow(10, obj.body.measuregrps[0].measures[0].unit)).toFixed(2)
      this.fatweight = obj.body.measuregrps[0].date
      Log.info('fat=' + this.fat + '; date=' + this.fatweight)
    }
  },

  extractactivity: function (data) {
    if (typeof data.body.steps != 'undefined') {
      this.steps = data.body.steps
      this.distance = Number(data.body.distance * Math.pow(10, -3)).toFixed(2)
      Log.info('pas=' + this.steps + '; distance=' + this.distance)
    }
  },

  extractsleep: function (data) {
    Log.info('data=' + data)
    if (data != null) {
      for (var i in data.body.series)
        {
        this.lightsleep = data.body.series[i].data.lightsleepduration
        this.deepsleep = data.body.series[i].data.deepsleepduration
        this.datesleep = data.body.series[i].date
      }
      var sec_num = parseInt(this.deepsleep, 10) // don't forget the second param
      var hours = Math.floor(sec_num / 3600)
      var minutes = Math.floor((sec_num - (hours * 3600)) / 60)
      this.deepsleep = hours + ':' + minutes + 'h'
      var sec_num = parseInt(this.lightsleep, 10) // don't forget the second param
      var hours = Math.floor(sec_num / 3600)
      var minutes = Math.floor((sec_num - (hours * 3600)) / 60)
      this.lightsleep = hours + ':' + minutes + 'h'

      Log.info('light sleep=' + this.lightsleep + '; deepsleep=' + this.deepsleep + ';date=' + this.datesleep)
      this.updateDom(this.config.animationSpeed)
    }
    else {
      Log.info('data is null')
    }
    return Q({})
  },

  renderError: function (reason) {
    console.log('error ' + reason)
  },

  getScripts: function () {
    return [
      'String.format.js',
      '//cdnjs.cloudflare.com/ajax/libs/jquery/2.2.2/jquery.js',
      'q.min.js',
      'moment.js'
    ]
  },
  getStyles: function () {
    return [
      'MM_Withings.css'
    ]
  },
  getTranslations: function () {
    return {
      en: 'l18n/en.json',
      fr: 'l18n/fr.json'
    }
  },
  getDom: function () {
    return $(
      '<div>' +
        '<div class="small' + (this.weight == 0 ? ' hide' : '') + '">' +
          '<span>' + this.translate(('WEIGHT')) + ' : </span> ' +
            this.weight +
          ' kg' +
        '</div>' +
        '<div class="small' + (this.fat == 0 ? ' hide' : '') + '">' +
          '<span>' + this.translate(('FAT')) + ' : </span> ' +
            this.fat +
          '%' +
        '</div>' +
        '<div class="small' + (this.steps == 0 ? ' hide' : '') + '">' +
          '<span>' + this.translate(('STEPS')) + ' : </span> ' +
            this.steps +
          ' ' + this.translate(('UNIT_STEPS')) +
        '</div>' +
        '<div class="small' + (this.distance == 0 ? ' hide' : '') + '">' +
          '<span>' + this.translate(('DISTANCE')) + ' : </span> ' +
            this.distance +
          ' km' +
        '</div>' +
        '<div class="small' + (this.deepsleep == '0:0h' ? ' hide' : '') + '">' +
          '<span>' + this.translate(('LIGHT SLEEP')) + ' : </span> ' +
            this.lightsleep +
        '</div>' +
        '<div class="small' + (this.deepsleep == '0:0h' ? ' hide' : '') + '">' +
          '<span>' + this.translate(('DEEP SLEEP')) + ' : </span> ' +
            this.deepsleep +
        '</div>' +
      '</div>')[0]
  }
})
