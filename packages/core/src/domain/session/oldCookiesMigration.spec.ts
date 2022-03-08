import type { CookieOptions } from '../../browser/cookie'
import { getCookie, setCookie } from '../../browser/cookie'
import {
  OLD_LOGS_COOKIE_NAME,
  OLD_RUM_COOKIE_NAME,
  OLD_SESSION_IDENTIFIER,
  tryOldCookiesMigration,
} from './oldCookiesMigration'
import { SESSION_EXPIRATION_DELAY } from './sessionStore'
import { SESSION_IDENTIFIER } from './sessionClientStore'

describe('old cookies migration', () => {
  const options: CookieOptions = {}

  it('should not touch current cookie', () => {
    setCookie(SESSION_IDENTIFIER, 'id=abcde&rum=0&logs=1', SESSION_EXPIRATION_DELAY)

    tryOldCookiesMigration(options)

    expect(getCookie(SESSION_IDENTIFIER)).toBe('id=abcde&rum=0&logs=1')
  })

  it('should create new cookie from old cookie values', () => {
    setCookie(OLD_SESSION_IDENTIFIER, 'abcde', SESSION_EXPIRATION_DELAY)
    setCookie(OLD_LOGS_COOKIE_NAME, '1', SESSION_EXPIRATION_DELAY)
    setCookie(OLD_RUM_COOKIE_NAME, '0', SESSION_EXPIRATION_DELAY)

    tryOldCookiesMigration(options)

    expect(getCookie(SESSION_IDENTIFIER)).toContain('id=abcde')
    expect(getCookie(SESSION_IDENTIFIER)).toContain('rum=0')
    expect(getCookie(SESSION_IDENTIFIER)).toContain('logs=1')
  })

  it('should create new cookie from a single old cookie', () => {
    setCookie(OLD_RUM_COOKIE_NAME, '0', SESSION_EXPIRATION_DELAY)

    tryOldCookiesMigration(options)

    expect(getCookie(SESSION_IDENTIFIER)).not.toContain('id=')
    expect(getCookie(SESSION_IDENTIFIER)).toContain('rum=0')
  })
})
