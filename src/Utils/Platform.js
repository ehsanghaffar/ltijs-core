
// Utis
const Database = require('./Database')
const Auth = require('./Auth')
const provPlatformDebug = require('debug')('provider:platform')

/**
 * @description Class representing a registered platform.
 */
class Platform {
  #platformName
  #platformUrl
  #clientId
  #authEndpoint
  #authConfig
  #ENCRYPTIONKEY
  #accesstokenEndpoint
  #kid

  /**
     * @param {string} name - Platform name.
     * @param {string} platformUrl - Platform url.
     * @param {string} clientId - Client Id generated by the platform.
     * @param {string} authenticationEndpoint - Authentication endpoint that the tool will use to authenticate within the platform.
     * @param {string} accesstokenEndpoint - Access token endpoint for the platform.
     * @param {string} kid - Key id for local keypair used to sign messages to this platform.
     * @param {string} _ENCRYPTIONKEY - Encryption key used
     * @param {Object} _authConfig - Authentication configurations for the platform.
     */
  constructor (name, platformUrl, clientId, authenticationEndpoint, accesstokenEndpoint, kid, _ENCRYPTIONKEY, _authConfig) {
    this.#authConfig = _authConfig
    this.#ENCRYPTIONKEY = _ENCRYPTIONKEY

    this.#platformName = name
    this.#platformUrl = platformUrl
    this.#clientId = clientId
    this.#authEndpoint = authenticationEndpoint
    this.#accesstokenEndpoint = accesstokenEndpoint
    this.#kid = kid
  }

  /**
     * @description Sets/Gets the platform name.
     * @param {string} [name] - Platform name.
     */
  async platformName (name) {
    if (!name) return this.#platformName
    try {
      await Database.Modify(false, 'platform', { platformUrl: this.#platformUrl }, { platformName: name })
    } catch (err) {
      provPlatformDebug(err)
      return false
    }
    this.#platformName = name
    return this
  }

  /**
     * @description Sets/Gets the platform url.
     * @param {string} [url] - Platform url.
     */
  async platformUrl (url) {
    if (!url) return this.#platformUrl
    try {
      await Database.Modify(false, 'platform', { platformUrl: this.#platformUrl }, { platformUrl: url })
    } catch (err) {
      provPlatformDebug(err)
      return false
    }
    this.#platformUrl = url
    return this
  }

  /**
     * @description Sets/Gets the platform client id.
     * @param {string} [clientId] - Platform client id.
     */
  async platformClientId (clientId) {
    if (!clientId) return this.#clientId
    try {
      await Database.Modify(false, 'platform', { platformUrl: this.#platformUrl }, { clientId: clientId })
    } catch (err) {
      provPlatformDebug(err)
      return false
    }
    this.#clientId = clientId
    return this
  }

  /**
     * @description Gets the platform key_id.
     */
  platformKid () {
    return this.#kid
  }

  /**
     * @description Gets the RSA public key assigned to the platform.
     *
     */
  async platformPublicKey () {
    try {
      let key = await Database.Get(this.#ENCRYPTIONKEY, 'publickey', { kid: this.#kid })
      return key[0].key
    } catch (err) {
      provPlatformDebug(err)
      return false
    }
  }

  /**
     * @description Gets the RSA private key assigned to the platform.
     *
     */
  async platformPrivateKey () {
    try {
      let key = await Database.Get(this.#ENCRYPTIONKEY, 'privatekey', { kid: this.#kid })
      return key[0].key
    } catch (err) {
      provPlatformDebug(err)
      return false
    }
  }

  /**
     * @description Sets/Gets the platform authorization configurations used to validate it's messages.
     * @param {string} method - Method of authorization "RSA_KEY" or "JWK_KEY" or "JWK_SET".
     * @param {string} key - Either the RSA public key provided by the platform, or the JWK key, or the JWK keyset address.
     */
  async platformAuthConfig (method, key) {
    if (!method && !key) return this.#authConfig

    if (method !== 'RSA_KEY' && method !== 'JWK_KEY' && method !== 'JWK_SET') throw new Error('Invalid message validation method. Valid methods are "RSA_KEY", "JWK_KEY", "JWK_SET"')

    if (!key) throw new Error('Missing secong argument key or keyset_url.')

    let authConfig = {
      method: method,
      key: key
    }

    try {
      await Database.Modify(false, 'platform', { platformUrl: this.#platformUrl }, { authConfig: authConfig })
    } catch (err) {
      provPlatformDebug(err)
      return false
    }

    this.#authConfig = authConfig
    return this
  }

  /**
     * @description Sets/Gets the platform authorization endpoint used to perform the OIDC login.
     * @param {string} [authEndpoint] - Platform authorization endpoint.
     */
  async platformAuthEndpoint (authEndpoint) {
    if (!authEndpoint) return this.#authEndpoint

    try {
      await Database.Modify(false, 'platform', { platformUrl: this.#platformUrl }, { authEndpoint: authEndpoint })
    } catch (err) {
      provPlatformDebug(err)
      return false
    }
    this.#authEndpoint = authEndpoint
    return this
  }

  /**
     * @description Sets/Gets the platform access token endpoint used to authenticate messages to the platform.
     * @param {string} [accesstokenEndpoint] - Platform access token endpoint.
     */
  async platformAccessTokenEndpoint (accesstokenEndpoint) {
    if (!accesstokenEndpoint) return this.#accesstokenEndpoint
    try {
      await Database.Modify(false, 'platform', { platformUrl: this.#platformUrl }, { accesstokenEndpoint: accesstokenEndpoint })
    } catch (err) {
      provPlatformDebug(err)
      return false
    }
    this.#accesstokenEndpoint = accesstokenEndpoint
    return this
  }

  /**
     * @description Gets the platform access token or attempts to generate a new one.
     */
  async platformAccessToken () {
    let token = await Database.Get(this.#ENCRYPTIONKEY, 'accesstoken', { platformUrl: this.#platformUrl })

    if (!token) {
      provPlatformDebug('Access_token for ' + this.#platformUrl + ' not found')
      provPlatformDebug('Attempting to generate new access_token for ' + this.#platformUrl)

      let res = await Auth.getAccessToken(this, this.#ENCRYPTIONKEY)
      return res
    } else {
      provPlatformDebug('Access_token found')
      if ((Date.now() - token[0].createdAt) / 1000 > token[0].expires_in) {
        provPlatformDebug('Token expired')
        provPlatformDebug('Access_token for ' + this.#platformUrl + ' not found')
        provPlatformDebug('Attempting to generate new access_token for ' + this.#platformUrl)

        let res = await Auth.getAccessToken(this, this.#ENCRYPTIONKEY)
        return res
      }
      return token[0].token
    }
  }

  /**
   * @description Deletes a registered platform.
   */
  async remove () {
    try {
      return Promise.all([Database.Delete('platform', { platformUrl: this.#platformUrl }), Database.Delete('publickey', { kid: this.#kid }), Database.Delete('privatekey', { kid: this.#kid })])
    } catch (err) {
      provPlatformDebug(err)
      return false
    }
  }
}

module.exports = Platform
