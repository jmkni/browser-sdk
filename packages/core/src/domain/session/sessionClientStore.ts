import { ClientStorageType } from '../configuration'
import type { CookieOptions } from '../../browser/cookie'
import { getCookie, setCookie } from '../../browser/cookie'
import { isChromium } from '../../tools/browserDetection'
import * as utils from '../../tools/utils'
import { monitor } from '../internalMonitoring'
import type { SessionState } from './sessionStore'
import { SESSION_EXPIRATION_DELAY } from './sessionStore'

const SESSION_ENTRY_REGEXP = /^([a-z]+)=([a-z0-9-]+)$/
const SESSION_ENTRY_SEPARATOR = '&'

export const SESSION_IDENTIFIER = '_dd_s'

// arbitrary values
export const LOCK_RETRY_DELAY = 10
export const MAX_NUMBER_OF_LOCK_RETRIES = 100

let SESSION_STRING = '';

type Operations = {
  options: CookieOptions
  clientStorageType: ClientStorageType
  process: (cookieSession: SessionState) => SessionState | undefined
  after?: (cookieSession: SessionState) => void
}

const bufferedOperations: Operations[] = []
let ongoingOperations: Operations | undefined

export function withClientLockAccess(operations: Operations, numberOfRetries = 0) {
  if (!ongoingOperations) {
    ongoingOperations = operations
  }
  if (operations !== ongoingOperations) {
    bufferedOperations.push(operations)
    return
  }
  if (numberOfRetries >= MAX_NUMBER_OF_LOCK_RETRIES) {
    next()
    return
  }
  let currentLock: string
  let currentSession = retrieveSession(operations.clientStorageType)
  if (isCookieLockEnabled()) {
    // if someone has lock, retry later
    if (currentSession.lock) {
      retryLater(operations, numberOfRetries)
      return
    }
    // acquire lock
    currentLock = utils.generateUUID()
    currentSession.lock = currentLock
    setSession(currentSession, operations.options, operations.clientStorageType)
    // if lock is not acquired, retry later
    currentSession = retrieveSession(operations.clientStorageType)
    if (currentSession.lock !== currentLock) {
      retryLater(operations, numberOfRetries)
      return
    }
  }
  let processedSession = operations.process(currentSession)
  if (isCookieLockEnabled()) {
    // if lock corrupted after process, retry later
    currentSession = retrieveSession(operations.clientStorageType)
    if (currentSession.lock !== currentLock!) {
      retryLater(operations, numberOfRetries)
      return
    }
  }
  if (processedSession) {
    persistSession(processedSession, operations.options, operations.clientStorageType)
  }
  if (isCookieLockEnabled()) {
    // correctly handle lock around expiration would require to handle this case properly at several levels
    // since we don't have evidence of lock issues around expiration, let's just not do the corruption check for it
    if (!(processedSession && isExpiredState(processedSession))) {
      // if lock corrupted after persist, retry later
      currentSession = retrieveSession(operations.clientStorageType)
      if (currentSession.lock !== currentLock!) {
        retryLater(operations, numberOfRetries)
        return
      }
      delete currentSession.lock
      setSession(currentSession, operations.options, operations.clientStorageType)
      processedSession = currentSession
    }
  }
  // call after even if session is not persisted in order to perform operations on
  // up-to-date cookie value, the value could have been modified by another tab
  operations.after?.(processedSession || currentSession)
  next()
}

/**
 * Cookie lock strategy allows mitigating issues due to concurrent access to cookie.
 * This issue concerns only chromium browsers and enabling this on firefox increase cookie write failures.
 */
function isCookieLockEnabled() {
  return isChromium()
}

function retryLater(operations: Operations, currentNumberOfRetries: number) {
  setTimeout(
    monitor(() => {
      withClientLockAccess(operations, currentNumberOfRetries + 1)
    }),
    LOCK_RETRY_DELAY
  )
}

function next() {
  ongoingOperations = undefined
  const nextOperations = bufferedOperations.shift()
  if (nextOperations) {
    withClientLockAccess(nextOperations)
  }
}

export function persistSession(session: SessionState, options: CookieOptions, clientStorageType: ClientStorageType) {
  if (isExpiredState(session)) {
    clearSession(options, clientStorageType)
    return
  }
  session.expire = String(Date.now() + SESSION_EXPIRATION_DELAY)
  setSession(session, options, clientStorageType)
}

function setSession(session: SessionState, options: CookieOptions, clientStorageType: ClientStorageType) {
  const sessionString = toSessionString(session);
  switch (clientStorageType) {
    case ClientStorageType.COOKIE:
      setCookie(SESSION_IDENTIFIER, sessionString, SESSION_EXPIRATION_DELAY, options);
      break;
    case ClientStorageType.LOCALSTORAGE:
      localStorage.setItem(SESSION_IDENTIFIER, sessionString);
      break;
    case ClientStorageType.MEMORY:
      SESSION_STRING = sessionString;
      break;
    case ClientStorageType.SESSIONSTORAGE:
      sessionStorage.setItem(SESSION_IDENTIFIER, sessionString);
      break;
    default:
      throw Error();
  }

}

export function toSessionString(session: SessionState) {
  return utils
    .objectEntries(session)
    .map(([key, value]) => `${key}=${value as string}`)
    .join(SESSION_ENTRY_SEPARATOR)
}

export function retrieveSession(clientStorageType: ClientStorageType): SessionState {

  let sessionString:string;

  switch (clientStorageType) {
    case ClientStorageType.COOKIE:
      sessionString = getCookie(SESSION_IDENTIFIER) || '';
      break;
    case ClientStorageType.LOCALSTORAGE:
      sessionString = localStorage.getItem(SESSION_IDENTIFIER) || '';
      break;
    case ClientStorageType.MEMORY:
      sessionString = SESSION_STRING;
      break;
    case ClientStorageType.SESSIONSTORAGE:
      sessionString = sessionStorage.getItem(SESSION_IDENTIFIER) || '';
      break;
    default:
      throw Error();
  }

  const session: SessionState = {}
  if (isValidSessionString(sessionString)) {
    sessionString.split(SESSION_ENTRY_SEPARATOR).forEach((entry) => {
      const matches = SESSION_ENTRY_REGEXP.exec(entry)
      if (matches !== null) {
        const [, key, value] = matches
        session[key] = value
      }
    })
  }
  return session
}

function isValidSessionString(sessionString: string | undefined): sessionString is string {
  return (
    sessionString !== undefined &&
    (sessionString.indexOf(SESSION_ENTRY_SEPARATOR) !== -1 || SESSION_ENTRY_REGEXP.test(sessionString))
  )
}

function isExpiredState(session: SessionState) {
  return utils.isEmptyObject(session)
}

function clearSession(options: CookieOptions, clientStorageType: ClientStorageType) {
  switch (clientStorageType) {
    case ClientStorageType.COOKIE:
      setCookie(SESSION_IDENTIFIER, '', 0, options);
      break;
    case ClientStorageType.LOCALSTORAGE:
      localStorage.removeItem(SESSION_IDENTIFIER);
      break;
    case ClientStorageType.MEMORY:
      SESSION_STRING = '';
      break;
    case ClientStorageType.SESSIONSTORAGE:
      sessionStorage.removeItem(SESSION_IDENTIFIER);
      break;
    default:
      throw Error();
  }
  
}
