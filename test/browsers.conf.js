// Capabilities: https://www.browserstack.com/automate/capabilities

module.exports = {
  EDGE: {
    base: 'BrowserStack',
    browser: 'Edge',
    browser_version: '86',
    os: 'Windows',
    os_version: '10',
  },
  FIREFOX: {
    base: 'BrowserStack',
    browser: 'Firefox',
    browser_version: '78.0',
    os: 'Windows',
    os_version: '10',
  },
  SAFARI: {
    base: 'BrowserStack',
    browser: 'Safari',
    browser_version: '12.0',
    os: 'OS X',
    os_version: 'Mojave',
  },
  CHROME_MOBILE: {
    base: 'BrowserStack',
    os: 'android',
    os_version: '10.0',
    browser: 'android',
    device: 'Google Pixel 4',
    browser_version: null,
    real_mobile: true,
  },
  SAFARI_MOBILE: {
    base: 'BrowserStack',
    os: 'ios',
    os_version: '12',
    device: 'iPhone XR',
    browser: 'iPhone',
    browser_version: null,
    real_mobile: true,
  },
  IE_11: {
    base: 'BrowserStack',
    browser: 'IE',
    browser_version: '11.0',
    os: 'Windows',
    os_version: '10',
  },
}
